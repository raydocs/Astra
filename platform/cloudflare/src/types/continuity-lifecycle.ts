import type { AstraSyncCollection } from "../../../../src/types/config"

export const CONTINUITY_LIFECYCLE_VERSION = 1 as const
export const CONTINUITY_LIFECYCLE_IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60
export const CONTINUITY_EXPORT_DEFAULT_RETENTION_DAYS = 7
export const CONTINUITY_DELETE_DEFAULT_GRACE_PERIOD_SECONDS = 7 * 24 * 60 * 60
export const CONTINUITY_JOB_HISTORY_DEFAULT_RETENTION_DAYS = 90
export const CONTINUITY_TOMBSTONE_RETENTION_DEFAULT_DAYS = 30

export const CONTINUITY_EXPORT_COLLECTIONS = [
  "config",
  "vocabulary",
  "review_schedule",
  "reading_history",
  "study_progress",
] as const satisfies readonly AstraSyncCollection[]

export const CONTINUITY_DELETE_COLLECTIONS = [
  "vocabulary",
  "review_schedule",
  "reading_history",
  "study_progress",
] as const

export type ContinuityExportCollection = (typeof CONTINUITY_EXPORT_COLLECTIONS)[number]
export type ContinuityDeleteCollection = (typeof CONTINUITY_DELETE_COLLECTIONS)[number]
export type ContinuityExportJobStatus = "queued" | "running" | "completed" | "failed" | "expired"
export type ContinuityDeleteJobStatus = "queued" | "scheduled" | "running" | "completed" | "failed" | "canceled"
export type ContinuityLifecycleJobKind = "export" | "cloud-data-delete"

export interface ContinuityLifecyclePolicy {
  exportArtifactRetentionDays: number
  deleteGracePeriodSeconds: number
  jobHistoryRetentionDays: number
  tombstoneRetentionDays: number
}

export interface ContinuityExportQueueMessage {
  version: typeof CONTINUITY_LIFECYCLE_VERSION
  kind: "export"
  jobId: string
  userId: string
  enqueuedAt: string
}

export interface ContinuityDeleteQueueMessage {
  version: typeof CONTINUITY_LIFECYCLE_VERSION
  kind: "cloud-data-delete"
  jobId: string
  userId: string
  enqueuedAt: string
}

export type ContinuityLifecycleQueueMessage = ContinuityExportQueueMessage | ContinuityDeleteQueueMessage

export interface ContinuityExportJobRow {
  jobId: string
  userId: string
  requestedByDeviceId: string
  scopeJson: string
  status: ContinuityExportJobStatus
  requestedAt: string
  startedAt: string | null
  completedAt: string | null
  failedAt: string | null
  expiresAt: string | null
  artifactObjectKey: string | null
  artifactSha256: string | null
  artifactBytes: number | null
  errorCode: string | null
  errorMessage: string | null
  shadowUpdatedAt: string
}

export interface ContinuityDeleteJobRow {
  jobId: string
  userId: string
  requestedByDeviceId: string
  scopeJson: string
  status: ContinuityDeleteJobStatus
  requestedAt: string
  scheduledForAt: string
  startedAt: string | null
  completedAt: string | null
  failedAt: string | null
  canceledAt: string | null
  gracePeriodSeconds: number
  deletedRecordsJson: string | null
  errorCode: string | null
  errorMessage: string | null
  shadowUpdatedAt: string
}
