import { randomUUID } from "node:crypto"
import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"

import { z } from "zod"

import {
  AstraLongRunningPartialResultMetadataSchema,
  AstraLongRunningRetryHintsSchema,
  AstraLongRunningTaskCreateRequestSchema,
  AstraLongRunningTaskErrorSchema,
  AstraLongRunningTaskProgressSchema,
  AstraLongRunningTaskSchema,
  AstraLongRunningTaskUpdateSchema,
  type AstraLongRunningTask,
  type AstraLongRunningTaskCreateRequest,
  type AstraLongRunningTaskStatus,
  type AstraLongRunningTaskUpdate,
} from "../types/long-running-tasks"

import type { RelayEnv } from "./types"

const TERMINAL_LONG_RUNNING_TASK_STATUSES = new Set<AstraLongRunningTaskStatus>([
  "succeeded",
  "failed",
  "canceled",
])

const LongRunningTaskRecordSchema = AstraLongRunningTaskSchema.extend({
  ownerEmail: z.string().trim().min(1),
  ownerUserId: z.string().trim().min(1),
  deviceId: z.string().trim().min(1),
  sessionId: z.string().trim().min(1),
}).strict()

export type LongRunningTaskRecord = z.infer<typeof LongRunningTaskRecordSchema>

const LongRunningTaskDatabaseSchema = z.object({
  version: z.literal(1),
  tasks: z.array(LongRunningTaskRecordSchema).default([]),
})

type LongRunningTaskDatabase = z.infer<typeof LongRunningTaskDatabaseSchema>

function resolveLongRunningTaskStorePath(env: RelayEnv): string {
  return env.longRunningTaskStorePath ?? join(dirname(env.videoNoteStorePath || env.userDbPath), "long-tasks.json")
}

function createEmptyLongRunningTaskDatabase(): LongRunningTaskDatabase {
  return { version: 1, tasks: [] }
}

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error
}

async function loadAuthoritativeLongRunningTaskDatabase(env: RelayEnv): Promise<LongRunningTaskDatabase> {
  const storePath = resolveLongRunningTaskStorePath(env)
  let raw: string
  try {
    raw = await readFile(storePath, "utf8")
  } catch (error) {
    if (isErrnoException(error) && error.code === "ENOENT") {
      const empty = createEmptyLongRunningTaskDatabase()
      await saveAuthoritativeLongRunningTaskDatabase(env, empty)
      return empty
    }
    throw new Error(`Long-running task store could not be read at ${storePath}.`, { cause: error })
  }

  let decoded: unknown
  try {
    decoded = JSON.parse(raw)
  } catch {
    throw new Error(`Long-running task store at ${storePath} is invalid JSON; refusing to overwrite retained task metadata.`)
  }

  const parsed = LongRunningTaskDatabaseSchema.safeParse(decoded)
  if (!parsed.success) {
    throw new Error(`Long-running task store at ${storePath} failed schema validation; refusing to overwrite retained task metadata.`)
  }
  return parsed.data
}

async function saveAuthoritativeLongRunningTaskDatabase(
  env: RelayEnv,
  db: LongRunningTaskDatabase,
): Promise<void> {
  const storePath = resolveLongRunningTaskStorePath(env)
  await mkdir(dirname(storePath), { recursive: true })
  const tempPath = `${storePath}.tmp-${process.pid}-${Date.now()}`
  await writeFile(tempPath, JSON.stringify(db, null, 2))
  await rename(tempPath, storePath)
}

function toPublicTask(record: LongRunningTaskRecord): AstraLongRunningTask {
  const task = { ...record }
  delete (task as Partial<LongRunningTaskRecord>).ownerEmail
  delete (task as Partial<LongRunningTaskRecord>).ownerUserId
  delete (task as Partial<LongRunningTaskRecord>).deviceId
  delete (task as Partial<LongRunningTaskRecord>).sessionId
  return AstraLongRunningTaskSchema.parse(task)
}

function applyLifecycleTimestamps(
  current: LongRunningTaskRecord,
  patch: AstraLongRunningTaskUpdate,
  updatedAt: string,
): LongRunningTaskRecord {
  const nextStatus = patch.status ?? current.status
  const partialResult = patch.partialResult
    ? AstraLongRunningPartialResultMetadataSchema.parse({
        ...patch.partialResult,
        updatedAt: patch.partialResult.available ? (patch.partialResult.updatedAt ?? updatedAt) : patch.partialResult.updatedAt,
      })
    : current.partialResult

  const next = LongRunningTaskRecordSchema.parse({
    ...current,
    ...patch,
    status: nextStatus,
    progress: patch.progress ? AstraLongRunningTaskProgressSchema.parse(patch.progress) : current.progress,
    partialResult,
    retryHints: patch.retryHints ? AstraLongRunningRetryHintsSchema.parse(patch.retryHints) : current.retryHints,
    error: patch.error === undefined ? current.error : (patch.error == null ? null : AstraLongRunningTaskErrorSchema.parse(patch.error)),
    updatedAt,
    startedAt: (nextStatus === "running" || nextStatus === "partial" || nextStatus === "succeeded")
      ? (current.startedAt ?? updatedAt)
      : current.startedAt,
    partialAt: (nextStatus === "partial" || partialResult.available)
      ? (current.partialAt ?? updatedAt)
      : current.partialAt,
    completedAt: nextStatus === "succeeded" ? (current.completedAt ?? updatedAt) : current.completedAt,
    failedAt: nextStatus === "failed" ? (current.failedAt ?? updatedAt) : current.failedAt,
    canceledAt: nextStatus === "canceled" ? (current.canceledAt ?? updatedAt) : current.canceledAt,
  })

  return next
}

export class FileLongRunningTaskStore {
  private cache: LongRunningTaskDatabase | null = null
  private writeQueue: Promise<void> = Promise.resolve()

  constructor(private readonly env: RelayEnv) {}

  private async load(): Promise<LongRunningTaskDatabase> {
    if (this.cache) return this.cache
    const db = await loadAuthoritativeLongRunningTaskDatabase(this.env)
    this.cache = db
    return db
  }

  private async save(db: LongRunningTaskDatabase): Promise<void> {
    this.cache = db
    await saveAuthoritativeLongRunningTaskDatabase(this.env, db)
  }

  async createTask(params: {
    ownerEmail: string
    ownerUserId: string
    deviceId: string
    sessionId: string
    input: AstraLongRunningTaskCreateRequest
    createdAt?: string
  }): Promise<AstraLongRunningTask> {
    let created: AstraLongRunningTask | null = null
    const write = async () => {
      const input = AstraLongRunningTaskCreateRequestSchema.parse(params.input)
      const timestamp = params.createdAt ?? new Date().toISOString()
      const db = await this.load()
      if (input.clientRequestId) {
        const reusable = db.tasks.find((task) =>
          task.ownerEmail === params.ownerEmail.trim()
          && task.clientRequestId === input.clientRequestId,
        )
        if (reusable) {
          created = toPublicTask(reusable)
          return
        }
      }

      const record = LongRunningTaskRecordSchema.parse({
        schema: "astra-long-running-task.v1",
        taskId: randomUUID(),
        clientRequestId: input.clientRequestId ?? null,
        ownerEmail: params.ownerEmail.trim(),
        ownerUserId: params.ownerUserId.trim(),
        deviceId: params.deviceId.trim(),
        sessionId: params.sessionId.trim(),
        taskClass: input.taskClass,
        category: input.category,
        surface: input.surface,
        source: input.source,
        status: "queued",
        progress: { stage: "queued" },
        partialResult: {},
        retryHints: input.retryHints ?? {},
        privacy: {},
        error: null,
        createdAt: timestamp,
        updatedAt: timestamp,
        startedAt: null,
        partialAt: null,
        completedAt: null,
        failedAt: null,
        canceledAt: null,
      })

      await this.save({ ...db, tasks: [...db.tasks, record] })
      created = toPublicTask(record)
    }

    const queuedWrite = this.writeQueue.then(write, write)
    this.writeQueue = queuedWrite.then(() => undefined, () => undefined)
    await queuedWrite
    return AstraLongRunningTaskSchema.parse(created)
  }

  async getTask(taskId: string): Promise<LongRunningTaskRecord | null> {
    await this.writeQueue
    const db = await this.load()
    const record = db.tasks.find((task) => task.taskId === taskId) ?? null
    return record ? LongRunningTaskRecordSchema.parse(record) : null
  }

  async getTaskForOwner(ownerEmail: string, taskId: string): Promise<AstraLongRunningTask | null> {
    const record = await this.getTask(taskId)
    if (!record || record.ownerEmail !== ownerEmail.trim()) return null
    return toPublicTask(record)
  }

  async listTasksForOwner(ownerEmail: string): Promise<AstraLongRunningTask[]> {
    await this.writeQueue
    const db = await this.load()
    return db.tasks
      .filter((task) => task.ownerEmail === ownerEmail.trim())
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map(toPublicTask)
  }

  async listRecentRecords(limit = 50): Promise<LongRunningTaskRecord[]> {
    await this.writeQueue
    const db = await this.load()
    return db.tasks
      .slice()
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, Math.max(1, Math.min(200, Math.floor(limit))))
      .map((task) => LongRunningTaskRecordSchema.parse(task))
  }

  async updateTask(
    taskId: string,
    patchInput: unknown,
    updatedAt = new Date().toISOString(),
  ): Promise<AstraLongRunningTask | null> {
    let result: AstraLongRunningTask | null = null
    const write = async () => {
      const patch = AstraLongRunningTaskUpdateSchema.parse(patchInput)
      const db = await this.load()
      const index = db.tasks.findIndex((task) => task.taskId === taskId)
      if (index < 0) {
        result = null
        return
      }

      const current = db.tasks[index]
      if (TERMINAL_LONG_RUNNING_TASK_STATUSES.has(current.status) && patch.status && patch.status !== current.status) {
        throw new Error("Terminal long-running task status cannot be changed.")
      }

      const updated = applyLifecycleTimestamps(current, patch, updatedAt)
      const tasks = [...db.tasks]
      tasks[index] = updated
      await this.save({ ...db, tasks })
      result = toPublicTask(updated)
    }

    const queuedWrite = this.writeQueue.then(write, write)
    this.writeQueue = queuedWrite.then(() => undefined, () => undefined)
    await queuedWrite
    return result
  }

  async deleteTasksForOwner(ownerEmail: string): Promise<number> {
    let deletedCount = 0
    const write = async () => {
      const db = await this.load()
      const normalizedOwnerEmail = ownerEmail.trim()
      const retainedTasks = db.tasks.filter((task) => task.ownerEmail !== normalizedOwnerEmail)
      deletedCount = db.tasks.length - retainedTasks.length
      if (deletedCount > 0) {
        await this.save({ ...db, tasks: retainedTasks })
      }
    }

    const queuedWrite = this.writeQueue.then(write, write)
    this.writeQueue = queuedWrite.then(() => undefined, () => undefined)
    await queuedWrite
    return deletedCount
  }

  async cancelTaskForOwner(
    ownerEmail: string,
    taskId: string,
    canceledAt = new Date().toISOString(),
  ): Promise<AstraLongRunningTask | null> {
    const existing = await this.getTask(taskId)
    if (!existing || existing.ownerEmail !== ownerEmail.trim()) return null
    if (TERMINAL_LONG_RUNNING_TASK_STATUSES.has(existing.status)) return toPublicTask(existing)
    return this.updateTask(taskId, {
      status: "canceled",
      retryHints: {
        ...existing.retryHints,
        retryable: false,
        fallbackReason: "none",
        degradePath: "user_action",
        fallbackAllowed: false,
      },
      error: { code: "USER_CANCELED", category: "canceled", retryable: false },
    }, canceledAt)
  }

  static toPublicTask(record: LongRunningTaskRecord): AstraLongRunningTask {
    return toPublicTask(record)
  }
}
