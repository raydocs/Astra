import { browser } from "#imports"
import { z } from "zod"

import type { TranslationTask } from "@/types/messages"
import type { TranslationErrorCode } from "@/types/translation"
import type { ProviderId } from "@/types/config"
import { summarizeProviderRoute, type ProviderRoute, type ProviderTransport } from "@/utils/providers/routing-metadata"

const TranslationRouteSchema = z.enum(["direct", "relay", "fallback"])

const StoredTranslationUsageEventSchema = z.object({
  id: z.string(),
  timestamp: z.number(),
  providerId: z.enum(["openai", "gemini"]),
  model: z.string(),
  task: z.enum(["translate", "explain", "custom"]),
  textCount: z.number().int().nonnegative(),
  charCount: z.number().int().nonnegative(),
  estimatedInputTokens: z.number().int().nonnegative(),
  estimatedOutputTokens: z.number().int().nonnegative().optional(),
  estimatedCostUsd: z.number().nonnegative().optional(),
  durationMs: z.number().int().nonnegative().optional(),
  requestSource: z.enum(["page-translation", "selection", "hover", "input", "pdf", "epub", "subtitle"]).optional(),
  attemptedTransports: z.array(z.enum(["direct", "relay"])),
  finalTransport: z.enum(["direct", "relay"]).nullable(),
  fallbackUsed: z.boolean(),
  route: TranslationRouteSchema.nullable().optional(),
  success: z.boolean(),
  errorCode: z.enum([
    "CONFIG_MISSING",
    "CONTENT_UNAVAILABLE",
    "PROVIDER_REQUEST_FAILED",
    "PROVIDER_PARSE_FAILED",
    "INVALID_RESPONSE",
    "SITE_DISABLED",
    "QUOTA_EXCEEDED",
    "UNKNOWN",
  ]).optional(),
})

const StoredTranslationUsageStoreSchema = z.object({
  sessionStartedAt: z.number().nullable(),
  events: z.array(StoredTranslationUsageEventSchema),
})

type StoredTranslationUsageEvent = z.infer<typeof StoredTranslationUsageEventSchema>

export interface TranslationUsageEvent extends Omit<StoredTranslationUsageEvent, "route"> {
  route: ProviderRoute | null
}

interface TranslationUsageStore {
  sessionStartedAt: number | null
  events: TranslationUsageEvent[]
}

export type RequestSource = "page-translation" | "selection" | "hover" | "input" | "pdf" | "epub" | "subtitle"

export interface TranslationUsageAggregate {
  requests: number
  texts: number
  chars: number
  estimatedInputTokens: number
  estimatedOutputTokens: number
  estimatedCostUsd: number
  directRequests: number
  relayRequests: number
  fallbackRequests: number
  failedRequests: number
  avgDurationMs: number
  bySource: Partial<Record<RequestSource, number>>
}

export interface TranslationUsageSummary {
  sessionStartedAt: number | null
  session: TranslationUsageAggregate
  today: TranslationUsageAggregate
  lastEvent: TranslationUsageEvent | null
}

export interface RecordTranslationUsageInput {
  timestamp?: number
  providerId: ProviderId
  model: string
  task?: TranslationTask
  texts: string[]
  attemptedTransports?: ProviderTransport[]
  finalTransport?: ProviderTransport | null
  fallbackUsed?: boolean
  route?: ProviderRoute | null
  success: boolean
  errorCode?: TranslationErrorCode
  estimatedOutputTokens?: number
  estimatedCostUsd?: number
  durationMs?: number
  requestSource?: RequestSource
}

export const TRANSLATION_USAGE_STORAGE_KEY = "astra.translation_usage.v1"
const MAX_EVENTS = 120
const MAX_EVENT_AGE_MS = 1000 * 60 * 60 * 24 * 7

function createEmptyAggregate(): TranslationUsageAggregate {
  return {
    requests: 0,
    texts: 0,
    chars: 0,
    estimatedInputTokens: 0,
    estimatedOutputTokens: 0,
    estimatedCostUsd: 0,
    directRequests: 0,
    relayRequests: 0,
    fallbackRequests: 0,
    failedRequests: 0,
    avgDurationMs: 0,
    bySource: {},
  }
}

function estimateInputTokens(charCount: number): number {
  if (charCount <= 0) return 0
  return Math.max(1, Math.round(charCount / 4))
}

function createEventId(timestamp: number): string {
  return `${timestamp}-${Math.random().toString(36).slice(2, 8)}`
}

function normalizeEvent(event: StoredTranslationUsageEvent): TranslationUsageEvent {
  return {
    ...event,
    route: event.route ?? summarizeProviderRoute(event.attemptedTransports, event.finalTransport),
  }
}

function parseStoredUsage(raw: unknown): TranslationUsageStore {
  const parsed = StoredTranslationUsageStoreSchema.safeParse(raw)
  if (parsed.success) {
    return {
      sessionStartedAt: parsed.data.sessionStartedAt,
      events: parsed.data.events.map(normalizeEvent),
    }
  }

  return {
    sessionStartedAt: null,
    events: [],
  }
}

function pruneEvents(events: TranslationUsageEvent[], now: number): TranslationUsageEvent[] {
  return events
    .filter((event) => Number.isFinite(event.timestamp) && now - event.timestamp <= MAX_EVENT_AGE_MS)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, MAX_EVENTS)
}

async function readUsageStore(): Promise<TranslationUsageStore> {
  const stored = await browser.storage.local.get(TRANSLATION_USAGE_STORAGE_KEY)
  return parseStoredUsage(stored[TRANSLATION_USAGE_STORAGE_KEY])
}

async function writeUsageStore(store: TranslationUsageStore): Promise<void> {
  await browser.storage.local.set({
    [TRANSLATION_USAGE_STORAGE_KEY]: store,
  })
}

function isSameLocalDay(timestamp: number, now: number): boolean {
  const left = new Date(timestamp)
  const right = new Date(now)
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate()
}

function accumulate(aggregate: TranslationUsageAggregate, event: TranslationUsageEvent): TranslationUsageAggregate {
  aggregate.requests += 1
  aggregate.texts += event.textCount
  aggregate.chars += event.charCount
  aggregate.estimatedInputTokens += event.estimatedInputTokens
  aggregate.estimatedOutputTokens += event.estimatedOutputTokens ?? 0
  aggregate.estimatedCostUsd += event.estimatedCostUsd ?? 0
  if (event.durationMs != null) {
    const prevTotal = aggregate.avgDurationMs * (aggregate.requests - 1)
    aggregate.avgDurationMs = Math.round((prevTotal + event.durationMs) / aggregate.requests)
  }
  if (event.requestSource) {
    aggregate.bySource[event.requestSource] = (aggregate.bySource[event.requestSource] ?? 0) + 1
  }
  if (event.finalTransport === "direct") {
    aggregate.directRequests += 1
  }
  if (event.finalTransport === "relay") {
    aggregate.relayRequests += 1
  }
  if (event.fallbackUsed) {
    aggregate.fallbackRequests += 1
  }
  if (!event.success) {
    aggregate.failedRequests += 1
  }
  return aggregate
}

export async function initializeTranslationUsageSession(
  now = Date.now(),
  options: { force?: boolean } = {},
): Promise<void> {
  const store = await readUsageStore()
  await writeUsageStore({
    sessionStartedAt: options.force || store.sessionStartedAt == null
      ? now
      : store.sessionStartedAt,
    events: pruneEvents(store.events, now),
  })
}

export async function recordTranslationUsage(input: RecordTranslationUsageInput): Promise<TranslationUsageEvent> {
  const timestamp = input.timestamp ?? Date.now()
  const store = await readUsageStore()
  const charCount = input.texts.reduce((sum, text) => sum + text.length, 0)
  const attemptedTransports = input.attemptedTransports ?? []
  const finalTransport = input.finalTransport ?? null
  const route = input.route ?? summarizeProviderRoute(attemptedTransports, finalTransport)

  const event: TranslationUsageEvent = {
    id: createEventId(timestamp),
    timestamp,
    providerId: input.providerId,
    model: input.model,
    task: input.task ?? "translate",
    textCount: input.texts.length,
    charCount,
    estimatedInputTokens: estimateInputTokens(charCount),
    attemptedTransports,
    finalTransport,
    fallbackUsed: input.fallbackUsed ?? false,
    route,
    success: input.success,
    ...(input.errorCode ? { errorCode: input.errorCode } : {}),
    ...(input.estimatedOutputTokens != null ? { estimatedOutputTokens: input.estimatedOutputTokens } : {}),
    ...(input.estimatedCostUsd != null ? { estimatedCostUsd: input.estimatedCostUsd } : {}),
    ...(input.durationMs != null ? { durationMs: input.durationMs } : {}),
    ...(input.requestSource ? { requestSource: input.requestSource } : {}),
  }

  await writeUsageStore({
    sessionStartedAt: store.sessionStartedAt ?? timestamp,
    events: pruneEvents([event, ...store.events], timestamp),
  })

  return event
}

export async function getTranslationUsageSummary(now = Date.now()): Promise<TranslationUsageSummary> {
  const store = await readUsageStore()
  const events = pruneEvents(store.events, now)
  const sessionStartedAt = store.sessionStartedAt
  const session = createEmptyAggregate()
  const today = createEmptyAggregate()

  for (const event of events) {
    if (sessionStartedAt != null && event.timestamp >= sessionStartedAt) {
      accumulate(session, event)
    }
    if (isSameLocalDay(event.timestamp, now)) {
      accumulate(today, event)
    }
  }

  return {
    sessionStartedAt,
    session,
    today,
    lastEvent: events[0] ?? null,
  }
}

export async function clearTranslationUsage(): Promise<void> {
  await writeUsageStore({
    sessionStartedAt: null,
    events: [],
  })
}
