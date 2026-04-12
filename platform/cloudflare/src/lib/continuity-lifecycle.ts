import {
  AstraAccountExportJobSchema,
  AstraCloudDataDeleteJobSchema,
  type AstraAccountExportJob,
  type AstraCloudDataDeleteJob,
  type AstraContinuityLifecyclePolicy,
} from "../../../../src/types/auth"
import type { PlatformConfig } from "../env"
import {
  parseContinuityDeleteScope,
  parseContinuityExportScope,
  parseDeletedRecords,
} from "../repositories/continuity-lifecycle"
import type { ContinuityDeleteJobRow, ContinuityExportJobRow } from "../types/continuity-lifecycle"

export function buildContinuityLifecyclePolicy(config: PlatformConfig): AstraContinuityLifecyclePolicy {
  return {
    exportArtifactRetentionDays: config.continuityExportArtifactRetentionDays,
    deleteGracePeriodSeconds: config.continuityDeleteGracePeriodSeconds,
    jobHistoryRetentionDays: config.continuityJobHistoryRetentionDays,
    tombstoneRetentionDays: config.continuityTombstoneRetentionDays,
  }
}

export function toAstraAccountExportJob(
  row: ContinuityExportJobRow,
  config: PlatformConfig,
): AstraAccountExportJob {
  return AstraAccountExportJobSchema.parse({
    jobId: row.jobId,
    scope: parseContinuityExportScope(row),
    status: row.status,
    requestedAt: row.requestedAt,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    failedAt: row.failedAt,
    expiresAt: row.expiresAt,
    artifact: {
      objectKey: row.artifactObjectKey,
      sha256: row.artifactSha256,
      bytes: row.artifactBytes,
      downloadPath: row.artifactObjectKey ? `/v1/account/export/${encodeURIComponent(row.jobId)}/download` : null,
    },
    error: row.errorCode && row.errorMessage
      ? {
          code: row.errorCode,
          message: row.errorMessage,
        }
      : null,
    policy: buildContinuityLifecyclePolicy(config),
  })
}

export function toAstraCloudDataDeleteJob(
  row: ContinuityDeleteJobRow,
  config: PlatformConfig,
): AstraCloudDataDeleteJob {
  return AstraCloudDataDeleteJobSchema.parse({
    jobId: row.jobId,
    scope: parseContinuityDeleteScope(row),
    status: row.status,
    requestedAt: row.requestedAt,
    scheduledForAt: row.scheduledForAt,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    failedAt: row.failedAt,
    canceledAt: row.canceledAt,
    gracePeriodSeconds: row.gracePeriodSeconds,
    deletedRecords: parseDeletedRecords(row),
    error: row.errorCode && row.errorMessage
      ? {
          code: row.errorCode,
          message: row.errorMessage,
        }
      : null,
    policy: buildContinuityLifecyclePolicy(config),
  })
}
