import { createHash, randomUUID } from "node:crypto"
import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"

import { z } from "zod"

import type { RelayEnv } from "./types"

export const OpsAuditActionSchema = z.enum([
  "ops_user_lookup",
  "ops_cost_summary_viewed",
  "ops_provider_health_viewed",
  "ops_cockpit_summary_viewed",
  "ops_long_tasks_viewed",
  "ops_long_task_updated",
  "ops_support_reports_viewed",
  "ops_support_summary_viewed",
  "ops_support_triage_updated",
  "ops_support_handoff_updated",
  "ops_known_issues_updated",
  "ops_feature_flags_viewed",
  "ops_feature_flags_updated",
  "ops_audit_summary_viewed",
  "ops_cancellation_reasons_viewed",
  "ops_analytics_cohort_summary_viewed",
  "ops_mobile_retention_summary_viewed",
  "ops_weekly_digest_delivery_run",
  "ops_weekly_digest_delivery_summary_viewed",
  "support_report_submitted",
  "cancellation_reason_submitted",
])
export type OpsAuditAction = z.infer<typeof OpsAuditActionSchema>

const OpsAuditActorSchema = z.enum(["operator", "user", "system"])
const OpsAuditOutcomeSchema = z.enum(["success", "denied", "failure"])

export const OpsAuditLogEntrySchema = z.object({
  id: z.string().trim().min(1),
  timestamp: z.string().datetime(),
  actor: OpsAuditActorSchema,
  action: OpsAuditActionSchema,
  outcome: OpsAuditOutcomeSchema.default("success"),
  operatorTokenHash: z.string().trim().min(1).nullable().default(null),
  subjectUserId: z.string().trim().min(1).nullable().default(null),
  subjectEmailHash: z.string().trim().min(1).nullable().default(null),
  supportReportId: z.string().trim().min(1).nullable().default(null),
  metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).default({}),
  privacy: z.object({
    userConsent: z.boolean().nullable().default(null),
    contentIncluded: z.boolean().default(false),
    contentAccess: z.enum(["none", "metadata_only", "user_consented_content"]).default("none"),
  }).default({ contentIncluded: false, contentAccess: "none", userConsent: null }),
}).strict()
export type OpsAuditLogEntry = z.infer<typeof OpsAuditLogEntrySchema>

export interface OpsAuditSummary {
  schema: "astra-ops-audit-summary.v1"
  generatedAt: string
  totalEvents: number
  retainedEventLimit: number
  byAction: Array<{ action: OpsAuditAction; count: number }>
  byActor: Array<{ actor: OpsAuditLogEntry["actor"]; count: number }>
  privacy: {
    userConsentTrueCount: number
    metadataOnlyCount: number
    contentIncludedCount: number
  }
  recent: OpsAuditLogEntry[]
}

export type WeeklyDigestDeliverySummaryChannel = "email" | "push" | "unknown"

export interface OpsWeeklyDigestDeliveryChannelSummary {
  channel: WeeklyDigestDeliverySummaryChannel
  runCount: number
  dryRunCount: number
  consideredCount: number
  relayAcceptedCount: number
  unavailableCount: number
  failedCount: number
  lastRunAt: string | null
}

export interface OpsWeeklyDigestDeliveryRecentRunSummary {
  timestamp: string
  channel: WeeklyDigestDeliverySummaryChannel
  dryRun: boolean
  consideredCount: number
  relayAcceptedCount: number
  unavailableCount: number
  failedCount: number
}

export interface OpsWeeklyDigestDeliverySummary {
  schema: "astra-weekly-digest-delivery-summary.v1"
  generatedAt: string
  source: "ops_audit_log_weekly_digest_delivery_run_metadata"
  retainedEventLimit: number
  totalRuns: number
  byChannel: OpsWeeklyDigestDeliveryChannelSummary[]
  recentRuns: OpsWeeklyDigestDeliveryRecentRunSummary[]
  limitations: {
    relayAcceptedOnly: true
    providerWebhookReceiptsIncluded: false
    inboxDeliveryConfirmed: false
    deviceDeliveryConfirmed: false
    apnsFcmReceiptsIncluded: false
    resendEventIngestionIncluded: false
  }
  privacy: {
    metadataOnly: true
    aggregateOnly: true
    perUserRows: false
    rawEmailsIncluded: false
    pushTokensIncluded: false
    digestContentIncluded: false
  }
}

const OpsAuditLogDatabaseSchema = z.object({
  version: z.literal(1),
  entries: z.array(OpsAuditLogEntrySchema).default([]),
})

type OpsAuditLogDatabase = z.infer<typeof OpsAuditLogDatabaseSchema>

const DEFAULT_RETAINED_EVENT_LIMIT = 500

function resolveOpsAuditLogPath(env: RelayEnv): string {
  return env.opsAuditLogPath ?? join(dirname(env.featureFlagRuntimePath || env.userDbPath), "ops-audit-log.json")
}

function createEmptyOpsAuditLogDatabase(): OpsAuditLogDatabase {
  return { version: 1, entries: [] }
}

function hashOptionalSecret(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  if (!trimmed) return null
  return createHash("sha256").update(trimmed).digest("hex")
}

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error
}

async function loadAuthoritativeOpsAuditLogDatabase(env: RelayEnv): Promise<OpsAuditLogDatabase> {
  const path = resolveOpsAuditLogPath(env)
  let raw: string
  try {
    raw = await readFile(path, "utf8")
  } catch (error) {
    if (isErrnoException(error) && error.code === "ENOENT") {
      const empty = createEmptyOpsAuditLogDatabase()
      await saveAuthoritativeOpsAuditLogDatabase(env, empty)
      return empty
    }
    throw new Error(`Ops audit log could not be read at ${path}.`)
  }

  let decoded: unknown
  try {
    decoded = JSON.parse(raw)
  } catch {
    throw new Error(`Ops audit log at ${path} is invalid JSON; refusing to overwrite retained audit entries.`)
  }

  const parsed = OpsAuditLogDatabaseSchema.safeParse(decoded)
  if (!parsed.success) {
    throw new Error(`Ops audit log at ${path} failed schema validation; refusing to overwrite retained audit entries.`)
  }
  return parsed.data
}

async function saveAuthoritativeOpsAuditLogDatabase(env: RelayEnv, db: OpsAuditLogDatabase): Promise<void> {
  const path = resolveOpsAuditLogPath(env)
  await mkdir(dirname(path), { recursive: true })
  const tempPath = `${path}.tmp-${process.pid}-${Date.now()}`
  await writeFile(tempPath, JSON.stringify(db, null, 2))
  await rename(tempPath, path)
}

function countBy<T extends string>(entries: T[]): Array<{ value: T; count: number }> {
  const counts = new Map<T, number>()
  for (const entry of entries) counts.set(entry, (counts.get(entry) ?? 0) + 1)
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((left, right) => right.count - left.count || left.value.localeCompare(right.value))
}

function readMetadataNumber(value: OpsAuditLogEntry["metadata"][string]): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}

function readMetadataBoolean(value: OpsAuditLogEntry["metadata"][string]): boolean {
  return value === true
}

function readWeeklyDigestDeliveryChannel(entry: OpsAuditLogEntry): WeeklyDigestDeliverySummaryChannel {
  const channel = entry.metadata.channel
  if (channel === "email" || channel === "push") return channel
  if ("emailConfigured" in entry.metadata) return "email"
  return "unknown"
}

function compareAuditEntriesDescending(left: OpsAuditLogEntry, right: OpsAuditLogEntry): number {
  return right.timestamp.localeCompare(left.timestamp)
}

export class FileOpsAuditLogStore {
  private cache: OpsAuditLogDatabase | null = null
  private writeQueue: Promise<void> = Promise.resolve()

  constructor(private readonly env: RelayEnv) {}

  private async load(): Promise<OpsAuditLogDatabase> {
    if (this.cache) return this.cache
    const db = await loadAuthoritativeOpsAuditLogDatabase(this.env)
    this.cache = db
    return db
  }

  private async save(db: OpsAuditLogDatabase): Promise<void> {
    this.cache = db
    await saveAuthoritativeOpsAuditLogDatabase(this.env, db)
  }

  async record(input: {
    actor: OpsAuditLogEntry["actor"]
    action: OpsAuditAction
    outcome?: OpsAuditLogEntry["outcome"]
    operatorToken?: string | null
    subjectUserId?: string | null
    subjectEmailHash?: string | null
    supportReportId?: string | null
    metadata?: OpsAuditLogEntry["metadata"]
    privacy?: Partial<OpsAuditLogEntry["privacy"]>
    timestamp?: string
  }): Promise<OpsAuditLogEntry> {
    let recordedEntry: OpsAuditLogEntry | null = null
    const write = async () => {
      const entry = OpsAuditLogEntrySchema.parse({
        id: `audit_${randomUUID()}`,
        timestamp: input.timestamp ?? new Date().toISOString(),
        actor: input.actor,
        action: input.action,
        outcome: input.outcome ?? "success",
        operatorTokenHash: hashOptionalSecret(input.operatorToken),
        subjectUserId: input.subjectUserId ?? null,
        subjectEmailHash: input.subjectEmailHash ?? null,
        supportReportId: input.supportReportId ?? null,
        metadata: input.metadata ?? {},
        privacy: {
          userConsent: input.privacy?.userConsent ?? null,
          contentIncluded: input.privacy?.contentIncluded ?? false,
          contentAccess: input.privacy?.contentAccess ?? "none",
        },
      })
      const db = await this.load()
      const nextDb: OpsAuditLogDatabase = {
        ...db,
        entries: [entry, ...db.entries].slice(0, DEFAULT_RETAINED_EVENT_LIMIT),
      }
      await this.save(nextDb)
      recordedEntry = entry
    }

    const queuedWrite = this.writeQueue.then(write, write)
    this.writeQueue = queuedWrite.then(() => undefined, () => undefined)
    await queuedWrite
    return OpsAuditLogEntrySchema.parse(recordedEntry)
  }

  async summarize(generatedAt = new Date().toISOString(), recentLimit = 20): Promise<OpsAuditSummary> {
    await this.writeQueue
    const db = await this.load()
    const entries = db.entries.map((entry) => OpsAuditLogEntrySchema.parse(entry))
    const byAction = countBy(entries.map((entry) => entry.action)).map(({ value, count }) => ({ action: value, count }))
    const byActor = countBy(entries.map((entry) => entry.actor)).map(({ value, count }) => ({ actor: value, count }))
    return {
      schema: "astra-ops-audit-summary.v1",
      generatedAt,
      totalEvents: entries.length,
      retainedEventLimit: DEFAULT_RETAINED_EVENT_LIMIT,
      byAction,
      byActor,
      privacy: {
        userConsentTrueCount: entries.filter((entry) => entry.privacy.userConsent === true).length,
        metadataOnlyCount: entries.filter((entry) => entry.privacy.contentAccess === "metadata_only").length,
        contentIncludedCount: entries.filter((entry) => entry.privacy.contentIncluded).length,
      },
      recent: entries.slice(0, recentLimit),
    }
  }

  async summarizeWeeklyDigestDelivery(
    generatedAt = new Date().toISOString(),
    recentLimit = 20,
  ): Promise<OpsWeeklyDigestDeliverySummary> {
    await this.writeQueue
    const db = await this.load()
    const deliveryEntries = db.entries
      .map((entry) => OpsAuditLogEntrySchema.parse(entry))
      .filter((entry) => entry.action === "ops_weekly_digest_delivery_run")
      .sort(compareAuditEntriesDescending)

    const summaries = new Map<WeeklyDigestDeliverySummaryChannel, OpsWeeklyDigestDeliveryChannelSummary>()
    const ensureSummary = (channel: WeeklyDigestDeliverySummaryChannel): OpsWeeklyDigestDeliveryChannelSummary => {
      const existing = summaries.get(channel)
      if (existing) return existing
      const created: OpsWeeklyDigestDeliveryChannelSummary = {
        channel,
        runCount: 0,
        dryRunCount: 0,
        consideredCount: 0,
        relayAcceptedCount: 0,
        unavailableCount: 0,
        failedCount: 0,
        lastRunAt: null,
      }
      summaries.set(channel, created)
      return created
    }

    for (const entry of deliveryEntries) {
      const channel = readWeeklyDigestDeliveryChannel(entry)
      const summary = ensureSummary(channel)
      summary.runCount += 1
      if (readMetadataBoolean(entry.metadata.dryRun)) summary.dryRunCount += 1
      summary.consideredCount += readMetadataNumber(entry.metadata.consideredCount)
      summary.relayAcceptedCount += readMetadataNumber(entry.metadata.deliveredCount)
      summary.unavailableCount += readMetadataNumber(entry.metadata.unavailableCount)
      summary.failedCount += readMetadataNumber(entry.metadata.failedCount)
      if (!summary.lastRunAt || entry.timestamp > summary.lastRunAt) summary.lastRunAt = entry.timestamp
    }

    const channelOrder: WeeklyDigestDeliverySummaryChannel[] = ["email", "push", "unknown"]
    return {
      schema: "astra-weekly-digest-delivery-summary.v1",
      generatedAt,
      source: "ops_audit_log_weekly_digest_delivery_run_metadata",
      retainedEventLimit: DEFAULT_RETAINED_EVENT_LIMIT,
      totalRuns: deliveryEntries.length,
      byChannel: channelOrder.map((channel) => ensureSummary(channel)).filter((summary) => summary.runCount > 0),
      recentRuns: deliveryEntries.slice(0, recentLimit).map((entry) => ({
        timestamp: entry.timestamp,
        channel: readWeeklyDigestDeliveryChannel(entry),
        dryRun: readMetadataBoolean(entry.metadata.dryRun),
        consideredCount: readMetadataNumber(entry.metadata.consideredCount),
        relayAcceptedCount: readMetadataNumber(entry.metadata.deliveredCount),
        unavailableCount: readMetadataNumber(entry.metadata.unavailableCount),
        failedCount: readMetadataNumber(entry.metadata.failedCount),
      })),
      limitations: {
        relayAcceptedOnly: true,
        providerWebhookReceiptsIncluded: false,
        inboxDeliveryConfirmed: false,
        deviceDeliveryConfirmed: false,
        apnsFcmReceiptsIncluded: false,
        resendEventIngestionIncluded: false,
      },
      privacy: {
        metadataOnly: true,
        aggregateOnly: true,
        perUserRows: false,
        rawEmailsIncluded: false,
        pushTokensIncluded: false,
        digestContentIncluded: false,
      },
    }
  }
}
