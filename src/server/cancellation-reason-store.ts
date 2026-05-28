import { randomUUID } from "node:crypto"
import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"

import { z } from "zod"

import { ASTRA_CANCELLATION_REASON_OPTIONS, type AstraCancellationReason, type AstraCancellationReasonSubmission } from "../utils/cancellation-reasons"

import type { RelayEnv } from "./types"

const CancellationReasonSchema = z.enum(
  ASTRA_CANCELLATION_REASON_OPTIONS.map((option) => option.value) as [AstraCancellationReason, ...AstraCancellationReason[]],
)
const CancellationReasonPlanSchema = z.enum(["free", "trial", "pro", "unknown"])
const CancellationReasonSourceSchema = z.enum(["billing_portal", "refund_request", "settings", "support", "unknown"])
const CancellationSubscriptionStatusSchema = z.enum(["active", "past_due", "canceled", "unknown"])

export const CancellationReasonRecordSchema = z.object({
  id: z.string().trim().min(1),
  submittedAt: z.string().datetime(),
  subjectUserId: z.string().trim().min(1),
  subjectEmailHash: z.string().trim().min(1),
  reason: CancellationReasonSchema,
  plan: CancellationReasonPlanSchema,
  source: CancellationReasonSourceSchema,
  subscriptionStatus: CancellationSubscriptionStatusSchema,
  identityMode: z.enum(["anonymous", "authenticated", "unknown"]),
}).strict()
export type CancellationReasonRecord = z.infer<typeof CancellationReasonRecordSchema>

const CancellationReasonDatabaseSchema = z.object({
  version: z.literal(1),
  records: z.array(CancellationReasonRecordSchema).default([]),
})
type CancellationReasonDatabase = z.infer<typeof CancellationReasonDatabaseSchema>

export interface CancellationReasonSummary {
  schema: "astra-cancellation-reason-summary.v1"
  generatedAt: string
  totalSubmissions: number
  retainedEventLimit: number
  reasonCoverage: {
    submittedCount: number
    unknownReasonCount: number
    coverageRate: number | null
  }
  byReason: Array<{
    reason: AstraCancellationReason
    label: string
    productMeaning: string
    count: number
    share: number
  }>
  byPlan: Array<{ plan: AstraCancellationReasonSubmission["plan"]; count: number }>
  bySource: Array<{ source: AstraCancellationReasonSubmission["source"]; count: number }>
}

const DEFAULT_RETAINED_EVENT_LIMIT = 500

function resolveCancellationReasonStorePath(env: RelayEnv): string {
  return env.cancellationReasonStorePath ?? join(dirname(env.featureFlagRuntimePath || env.userDbPath), "cancellation-reasons.json")
}

function createEmptyCancellationReasonDatabase(): CancellationReasonDatabase {
  return { version: 1, records: [] }
}

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error
}

async function loadAuthoritativeCancellationReasonDatabase(env: RelayEnv): Promise<CancellationReasonDatabase> {
  const path = resolveCancellationReasonStorePath(env)
  let raw: string
  try {
    raw = await readFile(path, "utf8")
  } catch (error) {
    if (isErrnoException(error) && error.code === "ENOENT") {
      const empty = createEmptyCancellationReasonDatabase()
      await saveAuthoritativeCancellationReasonDatabase(env, empty)
      return empty
    }
    throw new Error(`Cancellation reason store could not be read at ${path}.`)
  }

  let decoded: unknown
  try {
    decoded = JSON.parse(raw)
  } catch {
    throw new Error(`Cancellation reason store at ${path} is invalid JSON; refusing to overwrite retained cancellation feedback.`)
  }

  const parsed = CancellationReasonDatabaseSchema.safeParse(decoded)
  if (!parsed.success) {
    throw new Error(`Cancellation reason store at ${path} failed schema validation; refusing to overwrite retained cancellation feedback.`)
  }
  return parsed.data
}

async function saveAuthoritativeCancellationReasonDatabase(env: RelayEnv, db: CancellationReasonDatabase): Promise<void> {
  const path = resolveCancellationReasonStorePath(env)
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

export class FileCancellationReasonStore {
  private cache: CancellationReasonDatabase | null = null
  private writeQueue: Promise<void> = Promise.resolve()

  constructor(private readonly env: RelayEnv) {}

  private async load(): Promise<CancellationReasonDatabase> {
    if (this.cache) return this.cache
    const db = await loadAuthoritativeCancellationReasonDatabase(this.env)
    this.cache = db
    return db
  }

  private async save(db: CancellationReasonDatabase): Promise<void> {
    this.cache = db
    await saveAuthoritativeCancellationReasonDatabase(this.env, db)
  }

  async record(input: Omit<CancellationReasonRecord, "id"> & { id?: string }): Promise<CancellationReasonRecord> {
    let recorded: CancellationReasonRecord | null = null
    const write = async () => {
      const record = CancellationReasonRecordSchema.parse({
        id: input.id ?? `cancel_${randomUUID()}`,
        submittedAt: input.submittedAt,
        subjectUserId: input.subjectUserId,
        subjectEmailHash: input.subjectEmailHash,
        reason: input.reason,
        plan: input.plan,
        source: input.source,
        subscriptionStatus: input.subscriptionStatus,
        identityMode: input.identityMode,
      })
      const db = await this.load()
      const nextDb: CancellationReasonDatabase = {
        ...db,
        records: [record, ...db.records].slice(0, DEFAULT_RETAINED_EVENT_LIMIT),
      }
      await this.save(nextDb)
      recorded = record
    }

    const queuedWrite = this.writeQueue.then(write, write)
    this.writeQueue = queuedWrite.then(() => undefined, () => undefined)
    await queuedWrite
    return CancellationReasonRecordSchema.parse(recorded)
  }

  async summarize(generatedAt = new Date().toISOString()): Promise<CancellationReasonSummary> {
    await this.writeQueue
    const db = await this.load()
    const records = db.records.map((record) => CancellationReasonRecordSchema.parse(record))
    const totalSubmissions = records.length
    const reasonCounts = new Map(countBy(records.map((record) => record.reason)).map(({ value, count }) => [value, count]))
    const byReason = ASTRA_CANCELLATION_REASON_OPTIONS.map((option) => {
      const count = reasonCounts.get(option.value) ?? 0
      return {
        reason: option.value,
        label: option.label,
        productMeaning: option.productMeaning,
        count,
        share: totalSubmissions > 0 ? count / totalSubmissions : 0,
      }
    }).sort((left, right) => right.count - left.count || left.reason.localeCompare(right.reason))
    const unknownReasonCount = records.filter((record) => record.reason === "other").length

    return {
      schema: "astra-cancellation-reason-summary.v1",
      generatedAt,
      totalSubmissions,
      retainedEventLimit: DEFAULT_RETAINED_EVENT_LIMIT,
      reasonCoverage: {
        submittedCount: totalSubmissions,
        unknownReasonCount,
        coverageRate: totalSubmissions > 0 ? (totalSubmissions - unknownReasonCount) / totalSubmissions : null,
      },
      byReason,
      byPlan: countBy(records.map((record) => record.plan)).map(({ value, count }) => ({ plan: value, count })),
      bySource: countBy(records.map((record) => record.source)).map(({ value, count }) => ({ source: value, count })),
    }
  }
}
