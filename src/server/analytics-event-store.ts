import { createHash, randomUUID } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname } from "node:path"

import { z } from "zod"

import { AstraPlanSchema } from "../types/auth"
import {
  AstraFeatureSurfaceSchema,
  AstraOperatingTierSchema,
  AstraTaskClassSchema,
} from "../types/operating-model"

import type { RelayEnv } from "./types"

export const AnalyticsEventCategorySchema = z.enum([
  "activation",
  "learning",
  "retention",
  "membership",
  "cost",
  "support",
])
export type AnalyticsEventCategory = z.infer<typeof AnalyticsEventCategorySchema>

export const AnalyticsEventNameSchema = z.enum([
  "onboarding_started",
  "onboarding_completed",
  "first_translation_completed",
  "first_save_completed",
  "first_review_completed",
  "translation_completed",
  "sentence_saved",
  "review_completed",
  "digest_viewed",
  "app_opened",
  "weekly_digest_opened",
  "sync_completed",
  "plan_selected",
  "checkout_started",
  "portal_opened",
  "trial_intent_recorded",
  "cancellation_reason_submitted",
  "ai_task_completed",
  "quota_limited",
  "cache_used",
  "support_report_created",
  "known_issue_viewed",
  "support_bundle_copied",
])
export type AnalyticsEventName = z.infer<typeof AnalyticsEventNameSchema>

export const AnalyticsOutcomeSchema = z.enum(["success", "failure", "skipped", "limited", "unknown"])
export const AnalyticsSourceTypeSchema = z.enum(["extension", "web", "mobile", "email", "server", "unknown"])
export const AnalyticsGrainSchema = z.enum(["day", "week"])

export const ANALYTICS_EVENT_CATEGORY_BY_NAME: Record<AnalyticsEventName, AnalyticsEventCategory> = {
  onboarding_started: "activation",
  onboarding_completed: "activation",
  first_translation_completed: "activation",
  first_save_completed: "activation",
  first_review_completed: "activation",
  translation_completed: "learning",
  sentence_saved: "learning",
  review_completed: "learning",
  digest_viewed: "learning",
  app_opened: "retention",
  weekly_digest_opened: "retention",
  sync_completed: "retention",
  plan_selected: "membership",
  checkout_started: "membership",
  portal_opened: "membership",
  trial_intent_recorded: "membership",
  cancellation_reason_submitted: "membership",
  ai_task_completed: "cost",
  quota_limited: "cost",
  cache_used: "cost",
  support_report_created: "support",
  known_issue_viewed: "support",
  support_bundle_copied: "support",
}

const AnalyticsEventPropertiesSchema = z.object({
  plan: AstraPlanSchema.optional(),
  tier: AstraOperatingTierSchema.optional(),
  cohort: z.string().trim().min(1).max(80).regex(/^[a-zA-Z0-9._:-]+$/).optional(),
  sourceType: AnalyticsSourceTypeSchema.optional(),
  taskClass: AstraTaskClassSchema.optional(),
  surface: AstraFeatureSurfaceSchema.optional(),
  outcome: AnalyticsOutcomeSchema.optional(),
  flags: z.record(z.string().trim().min(1).max(40).regex(/^[a-zA-Z0-9._:-]+$/), z.boolean()).optional(),
}).strict()
export type AnalyticsEventProperties = z.infer<typeof AnalyticsEventPropertiesSchema>

const AnalyticsEventInputSchema = z.object({
  eventId: z.string().trim().min(1).max(120).optional(),
  name: AnalyticsEventNameSchema,
  category: AnalyticsEventCategorySchema.optional(),
  timestamp: z.string().datetime().optional(),
  properties: z.record(z.string(), z.unknown()).default({}),
}).passthrough()
export type AnalyticsEventInput = z.infer<typeof AnalyticsEventInputSchema>

export interface AnalyticsEventRecord {
  id: string
  ownerUserId: string
  ownerEmailHash: string
  eventId: string | null
  name: AnalyticsEventName
  category: AnalyticsEventCategory
  timestamp: string
  receivedAt: string
  properties: AnalyticsEventProperties
}

interface AnalyticsEventDatabase {
  schema: "astra-analytics-events.v1"
  events: AnalyticsEventRecord[]
}

export interface AnalyticsIngestResult {
  acceptedCount: number
  events: AnalyticsEventRecord[]
  serverTime: string
}

export interface AnalyticsCohortSummaryBucket {
  bucket: string
  category: AnalyticsEventCategory
  eventName: AnalyticsEventName
  plan: string
  cohort: string
  count: number
}

export interface AnalyticsCohortSummary {
  schema: "astra-analytics-cohort-summary.v1"
  source: "metadata_only_analytics_events"
  grain: z.infer<typeof AnalyticsGrainSchema>
  generatedAt: string
  totalEvents: number
  buckets: AnalyticsCohortSummaryBucket[]
  byCategory: Array<{ category: AnalyticsEventCategory; count: number }>
  privacy: {
    metadataOnly: true
    perUserRows: false
    rawContentIncluded: false
    identifiersIncluded: false
  }
}

const AnalyticsEventRecordSchema: z.ZodType<AnalyticsEventRecord> = z.object({
  id: z.string().trim().min(1),
  ownerUserId: z.string().trim().min(1),
  ownerEmailHash: z.string().trim().min(1),
  eventId: z.string().trim().min(1).nullable(),
  name: AnalyticsEventNameSchema,
  category: AnalyticsEventCategorySchema,
  timestamp: z.string().datetime(),
  receivedAt: z.string().datetime(),
  properties: AnalyticsEventPropertiesSchema,
}).strict()

const AnalyticsEventDatabaseSchema: z.ZodType<AnalyticsEventDatabase> = z.object({
  schema: z.literal("astra-analytics-events.v1"),
  events: z.array(AnalyticsEventRecordSchema).default([]),
}).strict()

const UNSAFE_KEY_PATTERN = /(^|[_-])(text|prompt|output|transcript|sentence|paragraph|page|html|markdown|url|uri|email|user(id)?|device(id)?|session(id)?|token|secret|password|api[-_]?key|identifier)s?$/i
const UNSAFE_CAMEL_KEY_PATTERN = /(Text|Prompt|Output|Transcript|Sentence|Paragraph|Page|Html|Markdown|Url|Uri|Email|UserId|DeviceId|SessionId|Token|Secret|Password|ApiKey|Identifier)s?$/
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
const URL_PATTERN = /https?:\/\//i
const DEFAULT_MAX_EVENTS = 10_000
const DEFAULT_LIST_LIMIT = 100

function analyticsStorePath(env: RelayEnv): string {
  return env.analyticsEventStorePath ?? env.userDbPath.replace(/[^/\\]+$/, "analytics-events.json")
}

function hashEmail(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex")
}

function assertNoUnsafeShape(value: unknown, path = "event"): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoUnsafeShape(item, `${path}[${index}]`))
    return
  }
  if (typeof value === "string") {
    if (EMAIL_PATTERN.test(value) || URL_PATTERN.test(value)) {
      throw new Error(`Analytics event contains raw identifier or URL at ${path}.`)
    }
    return
  }
  if (typeof value !== "object" || value === null) return

  for (const [key, nested] of Object.entries(value)) {
    if (UNSAFE_KEY_PATTERN.test(key) || UNSAFE_CAMEL_KEY_PATTERN.test(key)) {
      throw new Error(`Analytics event contains unsafe field: ${path}.${key}.`)
    }
    assertNoUnsafeShape(nested, `${path}.${key}`)
  }
}

function sanitizeProperties(raw: Record<string, unknown>): AnalyticsEventProperties {
  const candidate: Record<string, unknown> = {}
  for (const key of ["plan", "tier", "cohort", "sourceType", "taskClass", "surface", "outcome", "flags"]) {
    if (Object.prototype.hasOwnProperty.call(raw, key)) candidate[key] = raw[key]
  }
  return AnalyticsEventPropertiesSchema.parse(candidate)
}

function toUtcDay(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function startOfUtcWeek(date: Date): string {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const day = start.getUTCDay()
  const delta = day === 0 ? 6 : day - 1
  start.setUTCDate(start.getUTCDate() - delta)
  return toUtcDay(start)
}

function summaryKey(record: AnalyticsEventRecord, grain: "day" | "week"): string {
  const date = new Date(record.timestamp)
  const bucket = grain === "week" ? startOfUtcWeek(date) : toUtcDay(date)
  const plan = record.properties.plan ?? record.properties.tier ?? "unknown"
  const cohort = record.properties.cohort ?? "unknown"
  return [bucket, record.category, record.name, plan, cohort].join("|")
}

async function loadDatabase(path: string): Promise<AnalyticsEventDatabase> {
  try {
    return AnalyticsEventDatabaseSchema.parse(JSON.parse(await readFile(path, "utf8")))
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "ENOENT") {
      return { schema: "astra-analytics-events.v1", events: [] }
    }
    throw error
  }
}

async function saveDatabase(path: string, db: AnalyticsEventDatabase): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, JSON.stringify(db, null, 2))
}

export class FileAnalyticsEventStore {
  constructor(private readonly env: RelayEnv) {}

  async ingestForUser(params: {
    userId: string
    email: string
    events: unknown[]
    now?: Date
  }): Promise<AnalyticsIngestResult> {
    const now = params.now ?? new Date()
    const receivedAt = now.toISOString()
    const records = params.events.map((raw) => {
      assertNoUnsafeShape(raw)
      const parsed = AnalyticsEventInputSchema.parse(raw)
      const category = ANALYTICS_EVENT_CATEGORY_BY_NAME[parsed.name]
      if (parsed.category && parsed.category !== category) {
        throw new Error("Analytics event category does not match canonical event name.")
      }
      const timestamp = parsed.timestamp ?? receivedAt
      const eventTime = new Date(timestamp)
      if (!Number.isFinite(eventTime.getTime())) {
        throw new Error("Analytics event timestamp is invalid.")
      }
      return {
        id: randomUUID(),
        ownerUserId: params.userId,
        ownerEmailHash: hashEmail(params.email),
        eventId: parsed.eventId ?? null,
        name: parsed.name,
        category,
        timestamp: eventTime.toISOString(),
        receivedAt,
        properties: sanitizeProperties(parsed.properties),
      } satisfies AnalyticsEventRecord
    })

    const path = analyticsStorePath(this.env)
    const db = await loadDatabase(path)
    const keys = new Set(db.events.map((event) => `${event.ownerUserId}:${event.eventId ?? event.id}`))
    const deduped = records.filter((record) => {
      if (!record.eventId) return true
      const key = `${record.ownerUserId}:${record.eventId}`
      if (keys.has(key)) return false
      keys.add(key)
      return true
    })
    db.events.push(...deduped)
    db.events = db.events.slice(-DEFAULT_MAX_EVENTS)
    await saveDatabase(path, db)
    return { acceptedCount: deduped.length, events: deduped, serverTime: receivedAt }
  }

  async listForUser(userId: string, options: { limit?: number } = {}): Promise<AnalyticsEventRecord[]> {
    const path = analyticsStorePath(this.env)
    const db = await loadDatabase(path)
    const limit = Math.max(1, Math.min(options.limit ?? DEFAULT_LIST_LIMIT, 500))
    return db.events
      .filter((event) => event.ownerUserId === userId)
      .slice(-limit)
      .reverse()
  }

  async summarizeCohorts(options: { grain?: "day" | "week" } = {}): Promise<AnalyticsCohortSummary> {
    const grain = AnalyticsGrainSchema.parse(options.grain ?? "day")
    const path = analyticsStorePath(this.env)
    const db = await loadDatabase(path)
    const bucketMap = new Map<string, AnalyticsCohortSummaryBucket>()
    const byCategoryMap = new Map<AnalyticsEventCategory, number>()

    for (const event of db.events) {
      byCategoryMap.set(event.category, (byCategoryMap.get(event.category) ?? 0) + 1)
      const key = summaryKey(event, grain)
      const existing = bucketMap.get(key)
      if (existing) {
        existing.count += 1
        continue
      }
      const [bucket, category, eventName, plan, cohort] = key.split("|") as [
        string,
        AnalyticsEventCategory,
        AnalyticsEventName,
        string,
        string,
      ]
      bucketMap.set(key, { bucket, category, eventName, plan, cohort, count: 1 })
    }

    return {
      schema: "astra-analytics-cohort-summary.v1",
      source: "metadata_only_analytics_events",
      grain,
      generatedAt: new Date().toISOString(),
      totalEvents: db.events.length,
      buckets: Array.from(bucketMap.values()).sort((a, b) => a.bucket.localeCompare(b.bucket) || a.category.localeCompare(b.category)),
      byCategory: Array.from(byCategoryMap.entries()).map(([category, count]) => ({ category, count })),
      privacy: {
        metadataOnly: true,
        perUserRows: false,
        rawContentIncluded: false,
        identifiersIncluded: false,
      },
    }
  }
}
