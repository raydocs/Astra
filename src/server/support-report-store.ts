import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import { dirname } from "node:path"

import { z } from "zod"

import {
  SupportBundleSchema,
  SupportReportDraftSchema,
  isMetadataOnlySupportBundle,
  type KnownIssueMetadata,
  type SupportBundle,
} from "../utils/support-bundle"
import {
  findSupportFirstResponseMacroById,
  summarizeSupportFirstResponseMacroCoverage,
  type AstraSupportFirstResponseMacroSummary,
} from "../utils/support-response-macros"

import type { RelayEnv } from "./types"

export const SupportReportTriageStatusSchema = z.enum([
  "new",
  "investigating",
  "waiting_for_user",
  "linked_known_issue",
  "resolved",
  "wont_fix",
])
export type SupportReportTriageStatus = z.infer<typeof SupportReportTriageStatusSchema>

export const SupportReportTriagePrioritySchema = z.enum(["low", "normal", "high", "urgent"])
export type SupportReportTriagePriority = z.infer<typeof SupportReportTriagePrioritySchema>

export const SupportReportFollowUpPathSchema = z.enum([
  "not_selected",
  "known_issue",
  "email_follow_up",
  "support_queue",
  "no_follow_up_needed",
])
export type SupportReportFollowUpPath = z.infer<typeof SupportReportFollowUpPathSchema>

export const SupportReportFollowUpStatusSchema = z.enum([
  "not_started",
  "selected",
  "handed_off",
  "completed",
])
export type SupportReportFollowUpStatus = z.infer<typeof SupportReportFollowUpStatusSchema>

export const SupportReportFollowUpReasonSchema = z.enum([
  "matched_known_issue",
  "needs_manual_email",
  "needs_support_queue_review",
  "macro_ready",
  "no_follow_up_needed",
  "other_metadata_reason",
])
export type SupportReportFollowUpReason = z.infer<typeof SupportReportFollowUpReasonSchema>

const SupportReportFollowUpMacroIdSchema = z.string().trim().min(1).refine((macroId) => Boolean(findSupportFirstResponseMacroById(macroId)), {
  message: "Unknown support first-response macro id.",
})

const DEFAULT_SUPPORT_REPORT_FOLLOW_UP = {
  path: "not_selected",
  status: "not_started",
  macroId: null,
  reason: null,
  updatedAt: null,
  updatedBy: null,
} as const

const DEFAULT_SUPPORT_REPORT_TRIAGE = {
  status: "new",
  assignedTo: null,
  priority: "normal",
  resolution: null,
  updatedAt: null,
  updatedBy: null,
  followUp: DEFAULT_SUPPORT_REPORT_FOLLOW_UP,
} as const

export const SupportReportFollowUpSchema = z.object({
  path: SupportReportFollowUpPathSchema.default(DEFAULT_SUPPORT_REPORT_FOLLOW_UP.path),
  status: SupportReportFollowUpStatusSchema.default(DEFAULT_SUPPORT_REPORT_FOLLOW_UP.status),
  macroId: SupportReportFollowUpMacroIdSchema.nullable().default(DEFAULT_SUPPORT_REPORT_FOLLOW_UP.macroId),
  reason: SupportReportFollowUpReasonSchema.nullable().default(DEFAULT_SUPPORT_REPORT_FOLLOW_UP.reason),
  updatedAt: z.string().datetime().nullable().default(DEFAULT_SUPPORT_REPORT_FOLLOW_UP.updatedAt),
  updatedBy: z.string().trim().min(1).max(120).nullable().default(DEFAULT_SUPPORT_REPORT_FOLLOW_UP.updatedBy),
}).strict()
export type SupportReportFollowUp = z.infer<typeof SupportReportFollowUpSchema>

export const SupportReportTriageSchema = z.object({
  status: SupportReportTriageStatusSchema.default(DEFAULT_SUPPORT_REPORT_TRIAGE.status),
  assignedTo: z.string().trim().min(1).max(120).nullable().default(DEFAULT_SUPPORT_REPORT_TRIAGE.assignedTo),
  priority: SupportReportTriagePrioritySchema.default(DEFAULT_SUPPORT_REPORT_TRIAGE.priority),
  resolution: z.string().trim().min(1).max(1000).nullable().default(DEFAULT_SUPPORT_REPORT_TRIAGE.resolution),
  updatedAt: z.string().datetime().nullable().default(DEFAULT_SUPPORT_REPORT_TRIAGE.updatedAt),
  updatedBy: z.string().trim().min(1).max(120).nullable().default(DEFAULT_SUPPORT_REPORT_TRIAGE.updatedBy),
  followUp: SupportReportFollowUpSchema.default(DEFAULT_SUPPORT_REPORT_TRIAGE.followUp),
}).strict()
export type SupportReportTriage = z.infer<typeof SupportReportTriageSchema>

export const SupportReportFollowUpUpdateSchema = z.object({
  path: SupportReportFollowUpPathSchema.optional(),
  status: SupportReportFollowUpStatusSchema.optional(),
  macroId: SupportReportFollowUpMacroIdSchema.nullable().optional(),
  reason: SupportReportFollowUpReasonSchema.nullable().optional(),
  updatedBy: z.string().trim().min(1).max(120).nullable().optional(),
}).strict().refine((value) => Object.values(value).some((field) => field !== undefined), {
  message: "At least one follow-up field is required.",
})
export type SupportReportFollowUpUpdate = z.infer<typeof SupportReportFollowUpUpdateSchema>

export const SupportReportTriageUpdateSchema = z.object({
  status: SupportReportTriageStatusSchema.optional(),
  assignedTo: z.string().trim().min(1).max(120).nullable().optional(),
  priority: SupportReportTriagePrioritySchema.optional(),
  resolution: z.string().trim().min(1).max(1000).nullable().optional(),
  updatedBy: z.string().trim().min(1).max(120).nullable().optional(),
  followUp: SupportReportFollowUpUpdateSchema.optional(),
}).strict().refine((value) => Object.values(value).some((field) => field !== undefined), {
  message: "At least one triage field is required.",
})
export type SupportReportTriageUpdate = z.infer<typeof SupportReportTriageUpdateSchema>

const SupportReportInboxRecordSchema = SupportReportDraftSchema.extend({
  ownerEmail: z.string().trim().min(1),
  deviceId: z.string().trim().min(1),
  sessionId: z.string().trim().min(1),
  submittedAt: z.string().datetime(),
  triage: SupportReportTriageSchema.optional().default(DEFAULT_SUPPORT_REPORT_TRIAGE),
}).strict()

export type SupportReportInboxRecord = z.infer<typeof SupportReportInboxRecordSchema>

export interface SupportReportSummaryBucket {
  key: string
  count: number
  latestSubmittedAt: string
  hostname: string | null
  featureSurface: string
  issueCategory: string | null
  extensionVersion: string
  browser: string
  membershipState: string
  privacyMode: boolean
  knownIssueId: string | null
  knownIssueStatus: string | null
  triageStatus: SupportReportTriageStatus
}

export interface SupportReportWeeklyTopIssue {
  weekStart: string
  key: string
  reportCount: number
  latestSubmittedAt: string
  hostname: string | null
  featureSurface: string
  issueCategory: string | null
  knownIssueId: string | null
  knownIssueStatus: string | null
}

export interface SupportReportHandoffSummary {
  byPath: Array<{ path: SupportReportFollowUpPath; count: number }>
  byStatus: Array<{ status: SupportReportFollowUpStatus; count: number }>
}

export interface SupportReportSlaRiskSummary {
  generatedAt: string
  currentNow: string
  unresolvedCount: number
  urgentUnresolvedCount: number
  staleTriageByAgeBucket: {
    under24h: number
    from24hTo72h: number
    from72hTo168h: number
    over168h: number
  }
  followUpOverdueCount: number
  oldestUnresolvedAgeHours: number | null
  oldestUnresolvedAgeDays: number | null
}

export interface SupportReportSummary {
  totalReports: number
  generatedAt: string
  buckets: SupportReportSummaryBucket[]
  weeklyTopIssues: SupportReportWeeklyTopIssue[]
  macroCoverage: AstraSupportFirstResponseMacroSummary
  handoffSummary: SupportReportHandoffSummary
  slaRisk: SupportReportSlaRiskSummary
}

const SupportReportInboxDatabaseSchema = z.object({
  version: z.literal(1),
  reports: z.array(SupportReportInboxRecordSchema).default([]),
})

type SupportReportInboxDatabase = z.infer<typeof SupportReportInboxDatabaseSchema>

function buildSupportReportSummaryKey(record: SupportReportInboxRecord): string {
  const bundle = record.bundle
  return [
    bundle.hostname ?? "unknown_host",
    bundle.featureSurface,
    bundle.issueCategory ?? "unknown_issue",
    bundle.extensionVersion,
    bundle.browser,
    bundle.membershipState,
    bundle.privacyMode ? "privacy_on" : "privacy_off",
    record.knownIssue?.issueId ?? "no_known_issue",
  ].join("|")
}

function getUtcWeekStartDate(value: string): string {
  const date = new Date(value)
  const day = date.getUTCDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  const weekStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  weekStart.setUTCDate(weekStart.getUTCDate() + mondayOffset)
  return weekStart.toISOString().slice(0, 10)
}

function buildWeeklyTopIssueKey(record: SupportReportInboxRecord): string {
  const bundle = record.bundle
  return [
    getUtcWeekStartDate(record.submittedAt),
    bundle.hostname ?? "unknown_host",
    bundle.featureSurface,
    bundle.issueCategory ?? "unknown_issue",
    record.knownIssue?.issueId ?? "no_known_issue",
  ].join("|")
}

function summarizeFollowUpHandoffs(reports: SupportReportInboxRecord[]): SupportReportHandoffSummary {
  const pathCounts = new Map<SupportReportFollowUpPath, number>()
  const statusCounts = new Map<SupportReportFollowUpStatus, number>()

  for (const record of reports) {
    const followUp = SupportReportTriageSchema.parse(record.triage).followUp
    pathCounts.set(followUp.path, (pathCounts.get(followUp.path) ?? 0) + 1)
    statusCounts.set(followUp.status, (statusCounts.get(followUp.status) ?? 0) + 1)
  }

  return {
    byPath: SupportReportFollowUpPathSchema.options.map((path) => ({ path, count: pathCounts.get(path) ?? 0 })),
    byStatus: SupportReportFollowUpStatusSchema.options.map((status) => ({ status, count: statusCounts.get(status) ?? 0 })),
  }
}

const SLA_RISK_MS_PER_HOUR = 60 * 60 * 1000
const SLA_RISK_FOLLOW_UP_OVERDUE_HOURS = 48
const UNRESOLVED_TRIAGE_STATUSES = new Set<SupportReportTriageStatus>([
  "new",
  "investigating",
  "waiting_for_user",
  "linked_known_issue",
])
const FOLLOW_UP_OVERDUE_PATHS = new Set<SupportReportFollowUpPath>([
  "known_issue",
  "email_follow_up",
  "support_queue",
])
const FOLLOW_UP_OPEN_STATUSES = new Set<SupportReportFollowUpStatus>(["selected", "handed_off"])

function hoursBetween(olderIso: string, newerIso: string): number {
  const older = new Date(olderIso).getTime()
  const newer = new Date(newerIso).getTime()
  if (!Number.isFinite(older) || !Number.isFinite(newer) || newer <= older) return 0
  return (newer - older) / SLA_RISK_MS_PER_HOUR
}

function summarizeSlaRisk(reports: SupportReportInboxRecord[], generatedAt: string): SupportReportSlaRiskSummary {
  const staleTriageByAgeBucket: SupportReportSlaRiskSummary["staleTriageByAgeBucket"] = {
    under24h: 0,
    from24hTo72h: 0,
    from72hTo168h: 0,
    over168h: 0,
  }
  let unresolvedCount = 0
  let urgentUnresolvedCount = 0
  let followUpOverdueCount = 0
  let oldestUnresolvedAgeHours: number | null = null

  for (const record of reports) {
    const triage = SupportReportTriageSchema.parse(record.triage)
    if (!UNRESOLVED_TRIAGE_STATUSES.has(triage.status)) continue

    unresolvedCount += 1
    if (triage.priority === "urgent") urgentUnresolvedCount += 1

    const unresolvedAgeHours = hoursBetween(record.submittedAt, generatedAt)
    oldestUnresolvedAgeHours = Math.max(oldestUnresolvedAgeHours ?? 0, unresolvedAgeHours)

    const triageAgeHours = hoursBetween(triage.updatedAt ?? record.submittedAt, generatedAt)
    if (triageAgeHours < 24) {
      staleTriageByAgeBucket.under24h += 1
    } else if (triageAgeHours < 72) {
      staleTriageByAgeBucket.from24hTo72h += 1
    } else if (triageAgeHours < 168) {
      staleTriageByAgeBucket.from72hTo168h += 1
    } else {
      staleTriageByAgeBucket.over168h += 1
    }

    const followUp = triage.followUp
    if (FOLLOW_UP_OVERDUE_PATHS.has(followUp.path) && FOLLOW_UP_OPEN_STATUSES.has(followUp.status)) {
      const followUpAgeHours = hoursBetween(followUp.updatedAt ?? triage.updatedAt ?? record.submittedAt, generatedAt)
      if (followUpAgeHours >= SLA_RISK_FOLLOW_UP_OVERDUE_HOURS) {
        followUpOverdueCount += 1
      }
    }
  }

  const roundedOldestHours = oldestUnresolvedAgeHours == null ? null : Math.round(oldestUnresolvedAgeHours * 10) / 10
  return {
    generatedAt,
    currentNow: generatedAt,
    unresolvedCount,
    urgentUnresolvedCount,
    staleTriageByAgeBucket,
    followUpOverdueCount,
    oldestUnresolvedAgeHours: roundedOldestHours,
    oldestUnresolvedAgeDays: roundedOldestHours == null ? null : Math.round((roundedOldestHours / 24) * 10) / 10,
  }
}

function summarizeWeeklyTopIssues(reports: SupportReportInboxRecord[]): SupportReportWeeklyTopIssue[] {
  const weeklyBuckets = new Map<string, SupportReportWeeklyTopIssue>()

  for (const record of reports) {
    const bundle = record.bundle
    const key = buildWeeklyTopIssueKey(record)
    const existing = weeklyBuckets.get(key)
    if (existing) {
      existing.reportCount += 1
      if (record.submittedAt > existing.latestSubmittedAt) {
        existing.latestSubmittedAt = record.submittedAt
        existing.knownIssueStatus = record.knownIssue?.status ?? null
      }
      continue
    }

    weeklyBuckets.set(key, {
      weekStart: getUtcWeekStartDate(record.submittedAt),
      key,
      reportCount: 1,
      latestSubmittedAt: record.submittedAt,
      hostname: bundle.hostname ?? null,
      featureSurface: bundle.featureSurface,
      issueCategory: bundle.issueCategory ?? null,
      knownIssueId: record.knownIssue?.issueId ?? null,
      knownIssueStatus: record.knownIssue?.status ?? null,
    })
  }

  const bestByWeek = new Map<string, SupportReportWeeklyTopIssue>()
  for (const bucket of weeklyBuckets.values()) {
    const existing = bestByWeek.get(bucket.weekStart)
    if (!existing
      || bucket.reportCount > existing.reportCount
      || (bucket.reportCount === existing.reportCount && bucket.latestSubmittedAt > existing.latestSubmittedAt)
    ) {
      bestByWeek.set(bucket.weekStart, bucket)
    }
  }

  return [...bestByWeek.values()].sort((a, b) => {
    if (b.weekStart !== a.weekStart) return b.weekStart.localeCompare(a.weekStart)
    if (b.reportCount !== a.reportCount) return b.reportCount - a.reportCount
    return b.latestSubmittedAt.localeCompare(a.latestSubmittedAt)
  })
}

export function summarizeSupportReports(
  reports: SupportReportInboxRecord[],
  generatedAt = new Date().toISOString(),
): SupportReportSummary {
  const buckets = new Map<string, SupportReportSummaryBucket>()

  for (const record of reports) {
    const bundle = record.bundle
    const key = buildSupportReportSummaryKey(record)
    const existing = buckets.get(key)
    if (existing) {
      existing.count += 1
      if (record.submittedAt > existing.latestSubmittedAt) {
        existing.latestSubmittedAt = record.submittedAt
        existing.knownIssueStatus = record.knownIssue?.status ?? null
      }
      continue
    }

    buckets.set(key, {
      key,
      count: 1,
      latestSubmittedAt: record.submittedAt,
      hostname: bundle.hostname ?? null,
      featureSurface: bundle.featureSurface,
      issueCategory: bundle.issueCategory ?? null,
      extensionVersion: bundle.extensionVersion,
      browser: bundle.browser,
      membershipState: bundle.membershipState,
      privacyMode: bundle.privacyMode,
      knownIssueId: record.knownIssue?.issueId ?? null,
      knownIssueStatus: record.knownIssue?.status ?? null,
      triageStatus: SupportReportTriageSchema.parse(record.triage).status,
    })
  }

  const sortedBuckets = [...buckets.values()].sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count
    return b.latestSubmittedAt.localeCompare(a.latestSubmittedAt)
  })

  return {
    totalReports: reports.length,
    generatedAt,
    buckets: sortedBuckets,
    weeklyTopIssues: summarizeWeeklyTopIssues(reports),
    macroCoverage: summarizeSupportFirstResponseMacroCoverage({
      generatedAt,
      totalReports: reports.length,
      reportBuckets: sortedBuckets.map((bucket) => ({
        issueCategory: bucket.issueCategory,
        count: bucket.count,
      })),
    }),
    handoffSummary: summarizeFollowUpHandoffs(reports),
    slaRisk: summarizeSlaRisk(reports, generatedAt),
  }
}

async function createEmptySupportReportInboxDatabase(): Promise<SupportReportInboxDatabase> {
  return {
    version: 1,
    reports: [],
  }
}

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error
}

async function loadAuthoritativeSupportReportInboxDatabase(env: RelayEnv): Promise<SupportReportInboxDatabase> {
  let raw: string
  try {
    raw = await readFile(env.supportReportInboxPath, "utf8")
  } catch (error) {
    if (isErrnoException(error) && error.code === "ENOENT") {
      const empty = await createEmptySupportReportInboxDatabase()
      await saveAuthoritativeSupportReportInboxDatabase(env, empty)
      return empty
    }
    throw new Error(`Support report inbox could not be read at ${env.supportReportInboxPath}.`)
  }

  let decoded: unknown
  try {
    decoded = JSON.parse(raw)
  } catch {
    throw new Error(`Support report inbox at ${env.supportReportInboxPath} is invalid JSON; refusing to overwrite retained support reports.`)
  }

  const parsed = SupportReportInboxDatabaseSchema.safeParse(decoded)
  if (!parsed.success) {
    throw new Error(`Support report inbox at ${env.supportReportInboxPath} failed schema validation; refusing to overwrite retained support reports.`)
  }
  return parsed.data
}

async function saveAuthoritativeSupportReportInboxDatabase(
  env: RelayEnv,
  db: SupportReportInboxDatabase,
): Promise<void> {
  await mkdir(dirname(env.supportReportInboxPath), { recursive: true })
  const tempPath = `${env.supportReportInboxPath}.tmp-${process.pid}-${Date.now()}`
  await writeFile(tempPath, JSON.stringify(db, null, 2))
  await rename(tempPath, env.supportReportInboxPath)
}

export class FileSupportReportStore {
  private cache: SupportReportInboxDatabase | null = null
  private writeQueue: Promise<void> = Promise.resolve()

  constructor(private readonly env: RelayEnv) {}

  private async load(): Promise<SupportReportInboxDatabase> {
    if (this.cache) return this.cache
    const db = await loadAuthoritativeSupportReportInboxDatabase(this.env)
    this.cache = db
    return db
  }

  private async save(db: SupportReportInboxDatabase): Promise<void> {
    this.cache = db
    await saveAuthoritativeSupportReportInboxDatabase(this.env, db)
  }

  async createReport(params: {
    bundle: SupportBundle
    ownerEmail: string
    deviceId: string
    sessionId: string
    submittedAt?: string
    knownIssue?: KnownIssueMetadata | null
  }): Promise<SupportReportInboxRecord> {
    let created: SupportReportInboxRecord | null = null
    const write = async () => {
      const bundle = SupportBundleSchema.parse(params.bundle)
      const submittedAt = params.submittedAt ?? new Date().toISOString()
      const draft = SupportReportDraftSchema.parse({
        schema: "astra-support-report-draft.v1",
        reportId: bundle.reportId,
        status: "submitted",
        createdAt: bundle.timestamp,
        updatedAt: submittedAt,
        ...(bundle.issueCategory ? { issueCategory: bundle.issueCategory } : {}),
        bundle,
        knownIssue: params.knownIssue ?? null,
        defaultContentIncluded: false,
      })

      const record = SupportReportInboxRecordSchema.parse({
        ...draft,
        ownerEmail: params.ownerEmail,
        deviceId: params.deviceId,
        sessionId: params.sessionId,
        submittedAt,
      })

      const db = await this.load()
      const nextReports = [...db.reports]
      const index = nextReports.findIndex((report) => report.reportId === record.reportId)
      if (index >= 0) {
        nextReports[index] = record
      } else {
        nextReports.push(record)
      }
      await this.save({ ...db, reports: nextReports })
      created = record
    }

    const queuedWrite = this.writeQueue.then(write, write)
    this.writeQueue = queuedWrite.then(() => undefined, () => undefined)
    await queuedWrite
    return SupportReportInboxRecordSchema.parse(created)
  }

  async listReports(): Promise<SupportReportInboxRecord[]> {
    await this.writeQueue
    const db = await this.load()
    return db.reports.map((report) => SupportReportInboxRecordSchema.parse(report))
  }

  async summarizeReports(generatedAt?: string): Promise<SupportReportSummary> {
    return summarizeSupportReports(await this.listReports(), generatedAt)
  }

  async updateReportTriage(
    reportId: string,
    patchInput: unknown,
    updatedAt = new Date().toISOString(),
  ): Promise<SupportReportInboxRecord | null> {
    let result: SupportReportInboxRecord | null = null
    const write = async () => {
      const patch = SupportReportTriageUpdateSchema.parse(patchInput)
      const db = await this.load()
      const index = db.reports.findIndex((report) => report.reportId === reportId)
      if (index < 0) {
        result = null
        return
      }

      const current = db.reports[index]
      const currentTriage = SupportReportTriageSchema.parse(current.triage)
      const { followUp: followUpPatch, ...triagePatch } = patch
      const triage = SupportReportTriageSchema.parse({
        ...currentTriage,
        ...triagePatch,
        ...(followUpPatch
          ? {
            followUp: {
              ...currentTriage.followUp,
              ...followUpPatch,
              updatedAt,
              updatedBy: followUpPatch.updatedBy ?? patch.updatedBy ?? currentTriage.followUp.updatedBy,
            },
          }
          : {}),
        updatedAt,
      })
      const updated = SupportReportInboxRecordSchema.parse({
        ...current,
        updatedAt,
        triage,
      })
      const nextReports = [...db.reports]
      nextReports[index] = updated
      await this.save({ ...db, reports: nextReports })
      result = updated
    }

    const queuedWrite = this.writeQueue.then(write, write)
    this.writeQueue = queuedWrite.then(() => undefined, () => undefined)
    await queuedWrite
    return result
  }

  static isMetadataOnly(bundle: SupportBundle): boolean {
    return isMetadataOnlySupportBundle(bundle)
  }
}
