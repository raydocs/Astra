import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname } from "node:path"

import { z } from "zod"

import {
  VideoNoteArtifactSchema,
  VideoNoteCreateRequestSchema,
  VideoNoteJobStatusSchema,
  VideoNotePlatformSchema,
  VideoNoteTranscriptSourceSchema,
} from "../types/video-notes"

import type { RelayEnv, VideoNoteArtifactRecord, VideoNoteJobRecord } from "./types"

const VideoNoteJobRecordSchema = z.object({
  id: z.string().trim().min(1),
  ownerEmail: z.string().trim().min(1),
  sourceUrl: z.string().trim().url(),
  sourceKey: z.string().trim().min(1),
  platform: VideoNotePlatformSchema,
  title: z.string().trim().min(1).nullable().default(null),
  status: VideoNoteJobStatusSchema,
  transcriptSource: VideoNoteTranscriptSourceSchema.nullable().default(null),
  errorCode: z.string().trim().min(1).nullable().default(null),
  errorMessage: z.string().trim().min(1).nullable().default(null),
  createdAt: z.string().trim().min(1),
  updatedAt: z.string().trim().min(1),
  startedAt: z.string().trim().min(1).nullable().default(null),
  completedAt: z.string().trim().min(1).nullable().default(null),
  artifactId: z.string().trim().min(1).nullable().default(null),
  request: VideoNoteCreateRequestSchema,
})

const VideoNoteArtifactRecordSchema = VideoNoteArtifactSchema.extend({
  ownerEmail: z.string().trim().min(1),
})

const VideoNoteDatabaseSchema = z.object({
  version: z.literal(1),
  jobs: z.array(VideoNoteJobRecordSchema).default([]),
  artifacts: z.array(VideoNoteArtifactRecordSchema).default([]),
})

type VideoNoteDatabase = z.infer<typeof VideoNoteDatabaseSchema>

async function createEmptyVideoNoteDatabase(): Promise<VideoNoteDatabase> {
  return {
    version: 1,
    jobs: [],
    artifacts: [],
  }
}

async function loadAuthoritativeVideoNoteDatabase(env: RelayEnv): Promise<VideoNoteDatabase> {
  try {
    const raw = await readFile(env.videoNoteStorePath, "utf8")
    const parsed = VideoNoteDatabaseSchema.safeParse(JSON.parse(raw))
    if (parsed.success) {
      return parsed.data
    }
    const empty = await createEmptyVideoNoteDatabase()
    await saveAuthoritativeVideoNoteDatabase(env, empty)
    return empty
  } catch {
    const empty = await createEmptyVideoNoteDatabase()
    await saveAuthoritativeVideoNoteDatabase(env, empty)
    return empty
  }
}

async function saveAuthoritativeVideoNoteDatabase(env: RelayEnv, db: VideoNoteDatabase): Promise<void> {
  await mkdir(dirname(env.videoNoteStorePath), { recursive: true })
  await writeFile(env.videoNoteStorePath, JSON.stringify(db, null, 2))
}

export class FileVideoNoteStore {
  private cache: VideoNoteDatabase | null = null

  constructor(private readonly env: RelayEnv) {}

  private async load(): Promise<VideoNoteDatabase> {
    if (this.cache) return this.cache
    const db = await loadAuthoritativeVideoNoteDatabase(this.env)
    this.cache = db
    return db
  }

  private async save(db: VideoNoteDatabase): Promise<void> {
    this.cache = db
    await saveAuthoritativeVideoNoteDatabase(this.env, db)
  }

  async createJob(record: VideoNoteJobRecord): Promise<VideoNoteJobRecord> {
    const db = await this.load()
    const parsed = VideoNoteJobRecordSchema.parse(record)
    db.jobs.push(parsed)
    await this.save(db)
    return parsed
  }

  async getJob(jobId: string): Promise<VideoNoteJobRecord | null> {
    const db = await this.load()
    return db.jobs.find((job) => job.id === jobId) ?? null
  }

  async getJobForOwner(ownerEmail: string, jobId: string): Promise<VideoNoteJobRecord | null> {
    const db = await this.load()
    return db.jobs.find((job) => job.id === jobId && job.ownerEmail === ownerEmail.trim()) ?? null
  }

  async findReusableJob(
    ownerEmail: string,
    sourceKey: string,
    statuses: VideoNoteJobRecord["status"][],
  ): Promise<VideoNoteJobRecord | null> {
    const db = await this.load()
    return db.jobs
      .filter((job) =>
        job.ownerEmail === ownerEmail.trim()
        && job.sourceKey === sourceKey
        && statuses.includes(job.status),
      )
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0] ?? null
  }

  async updateJob(
    jobId: string,
    updater: (current: VideoNoteJobRecord) => VideoNoteJobRecord,
  ): Promise<VideoNoteJobRecord | null> {
    const db = await this.load()
    const index = db.jobs.findIndex((job) => job.id === jobId)
    if (index === -1) return null
    const next = VideoNoteJobRecordSchema.parse(updater(db.jobs[index]!))
    db.jobs[index] = next
    await this.save(db)
    return next
  }

  async upsertArtifact(record: VideoNoteArtifactRecord): Promise<VideoNoteArtifactRecord> {
    const db = await this.load()
    const parsed = VideoNoteArtifactRecordSchema.parse(record)
    const index = db.artifacts.findIndex((artifact) => artifact.jobId === parsed.jobId)
    if (index >= 0) {
      db.artifacts[index] = parsed
    } else {
      db.artifacts.push(parsed)
    }
    await this.save(db)
    return parsed
  }

  async getArtifactForOwner(ownerEmail: string, jobId: string): Promise<VideoNoteArtifactRecord | null> {
    const db = await this.load()
    return db.artifacts.find((artifact) => artifact.ownerEmail === ownerEmail.trim() && artifact.jobId === jobId) ?? null
  }

  async markNonTerminalJobsFailed(params: {
    statuses: VideoNoteJobRecord["status"][]
    errorCode: string
    errorMessage: string
    updatedAt?: string
  }): Promise<number> {
    const db = await this.load()
    const timestamp = params.updatedAt ?? new Date().toISOString()
    let changed = 0

    db.jobs = db.jobs.map((job) => {
      if (!params.statuses.includes(job.status)) {
        return job
      }

      changed += 1
      return VideoNoteJobRecordSchema.parse({
        ...job,
        status: "failed",
        errorCode: params.errorCode,
        errorMessage: params.errorMessage,
        updatedAt: timestamp,
        completedAt: job.completedAt ?? timestamp,
      })
    })

    if (changed > 0) {
      await this.save(db)
    }

    return changed
  }
}
