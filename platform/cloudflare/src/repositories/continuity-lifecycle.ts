import type { D1Database } from "../bindings"
import { assertD1Changed, assertD1Success, parseJsonColumn, selectAll, serializeJsonColumn } from "../lib/d1"
import type {
  ContinuityDeleteCollection,
  ContinuityDeleteJobRow,
  ContinuityDeleteJobStatus,
  ContinuityExportCollection,
  ContinuityExportJobRow,
  ContinuityExportJobStatus,
} from "../types/continuity-lifecycle"

interface ContinuityExportJobDatabaseRow {
  job_id: string
  user_id: string
  requested_by_device_id: string
  scope_json: string
  status: ContinuityExportJobStatus
  requested_at: string
  started_at: string | null
  completed_at: string | null
  failed_at: string | null
  expires_at: string | null
  artifact_object_key: string | null
  artifact_sha256: string | null
  artifact_bytes: number | string | null
  error_code: string | null
  error_message: string | null
  shadow_updated_at: string
}

interface ContinuityDeleteJobDatabaseRow {
  job_id: string
  user_id: string
  requested_by_device_id: string
  scope_json: string
  status: ContinuityDeleteJobStatus
  requested_at: string
  scheduled_for_at: string
  started_at: string | null
  completed_at: string | null
  failed_at: string | null
  canceled_at: string | null
  grace_period_seconds: number | string
  deleted_records_json: string | null
  error_code: string | null
  error_message: string | null
  shadow_updated_at: string
}

export interface ContinuityExportScope {
  collections: ContinuityExportCollection[]
}

export interface ContinuityDeleteScope {
  collections: ContinuityDeleteCollection[]
}

const CONTINUITY_EXPORT_JOB_SELECT = `
  SELECT
    job_id,
    user_id,
    requested_by_device_id,
    scope_json,
    status,
    requested_at,
    started_at,
    completed_at,
    failed_at,
    expires_at,
    artifact_object_key,
    artifact_sha256,
    artifact_bytes,
    error_code,
    error_message,
    shadow_updated_at
  FROM account_export_jobs
`

const CONTINUITY_DELETE_JOB_SELECT = `
  SELECT
    job_id,
    user_id,
    requested_by_device_id,
    scope_json,
    status,
    requested_at,
    scheduled_for_at,
    started_at,
    completed_at,
    failed_at,
    canceled_at,
    grace_period_seconds,
    deleted_records_json,
    error_code,
    error_message,
    shadow_updated_at
  FROM account_data_delete_jobs
`

function toNumber(value: number | string | null | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function mapExportJobRow(row: ContinuityExportJobDatabaseRow): ContinuityExportJobRow {
  return {
    jobId: row.job_id,
    userId: row.user_id,
    requestedByDeviceId: row.requested_by_device_id,
    scopeJson: row.scope_json,
    status: row.status,
    requestedAt: row.requested_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    failedAt: row.failed_at,
    expiresAt: row.expires_at,
    artifactObjectKey: row.artifact_object_key,
    artifactSha256: row.artifact_sha256,
    artifactBytes: toNumber(row.artifact_bytes),
    errorCode: row.error_code,
    errorMessage: row.error_message,
    shadowUpdatedAt: row.shadow_updated_at,
  }
}

function mapDeleteJobRow(row: ContinuityDeleteJobDatabaseRow): ContinuityDeleteJobRow {
  return {
    jobId: row.job_id,
    userId: row.user_id,
    requestedByDeviceId: row.requested_by_device_id,
    scopeJson: row.scope_json,
    status: row.status,
    requestedAt: row.requested_at,
    scheduledForAt: row.scheduled_for_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    failedAt: row.failed_at,
    canceledAt: row.canceled_at,
    gracePeriodSeconds: toNumber(row.grace_period_seconds) ?? 0,
    deletedRecordsJson: row.deleted_records_json,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    shadowUpdatedAt: row.shadow_updated_at,
  }
}

export function parseContinuityExportScope(row: Pick<ContinuityExportJobRow, "scopeJson">): ContinuityExportScope {
  return parseJsonColumn<ContinuityExportScope>(row.scopeJson, { collections: [] })
}

export function parseContinuityDeleteScope(row: Pick<ContinuityDeleteJobRow, "scopeJson">): ContinuityDeleteScope {
  return parseJsonColumn<ContinuityDeleteScope>(row.scopeJson, { collections: [] })
}

export function parseDeletedRecords(row: Pick<ContinuityDeleteJobRow, "deletedRecordsJson">): Partial<Record<ContinuityDeleteCollection, number>> {
  return parseJsonColumn<Partial<Record<ContinuityDeleteCollection, number>>>(row.deletedRecordsJson, {})
}

export async function createContinuityExportJob(
  db: D1Database,
  params: {
    jobId: string
    userId: string
    requestedByDeviceId: string
    scope: ContinuityExportScope
    requestedAt: string
  },
): Promise<ContinuityExportJobRow> {
  const shadowUpdatedAt = params.requestedAt
  const result = await db.prepare(`
    INSERT INTO account_export_jobs (
      job_id,
      user_id,
      requested_by_device_id,
      scope_json,
      status,
      requested_at,
      started_at,
      completed_at,
      failed_at,
      expires_at,
      artifact_object_key,
      artifact_sha256,
      artifact_bytes,
      error_code,
      error_message,
      shadow_updated_at
    ) VALUES (?, ?, ?, ?, 'queued', ?, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, ?)
  `)
    .bind(
      params.jobId,
      params.userId,
      params.requestedByDeviceId,
      serializeJsonColumn(params.scope),
      params.requestedAt,
      shadowUpdatedAt,
    )
    .run()
  assertD1Success(result, "create continuity export job")
  return getRequiredContinuityExportJob(db, params.jobId)
}

export async function createContinuityDeleteJob(
  db: D1Database,
  params: {
    jobId: string
    userId: string
    requestedByDeviceId: string
    scope: ContinuityDeleteScope
    requestedAt: string
    scheduledForAt: string
    gracePeriodSeconds: number
  },
): Promise<ContinuityDeleteJobRow> {
  const result = await db.prepare(`
    INSERT INTO account_data_delete_jobs (
      job_id,
      user_id,
      requested_by_device_id,
      scope_json,
      status,
      requested_at,
      scheduled_for_at,
      started_at,
      completed_at,
      failed_at,
      canceled_at,
      grace_period_seconds,
      deleted_records_json,
      error_code,
      error_message,
      shadow_updated_at
    ) VALUES (?, ?, ?, ?, 'scheduled', ?, ?, NULL, NULL, NULL, NULL, ?, NULL, NULL, NULL, ?)
  `)
    .bind(
      params.jobId,
      params.userId,
      params.requestedByDeviceId,
      serializeJsonColumn(params.scope),
      params.requestedAt,
      params.scheduledForAt,
      params.gracePeriodSeconds,
      params.requestedAt,
    )
    .run()
  assertD1Success(result, "create continuity delete job")
  return getRequiredContinuityDeleteJob(db, params.jobId)
}

export async function getContinuityExportJob(
  db: D1Database,
  jobId: string,
): Promise<ContinuityExportJobRow | null> {
  const row = await db.prepare<ContinuityExportJobDatabaseRow>(`
    ${CONTINUITY_EXPORT_JOB_SELECT}
    WHERE job_id = ?
  `)
    .bind(jobId)
    .first<ContinuityExportJobDatabaseRow>()

  return row ? mapExportJobRow(row) : null
}

export async function getRequiredContinuityExportJob(
  db: D1Database,
  jobId: string,
): Promise<ContinuityExportJobRow> {
  const row = await getContinuityExportJob(db, jobId)
  if (!row) {
    throw new Error(`Missing continuity export job: ${jobId}`)
  }
  return row
}

export async function getContinuityDeleteJob(
  db: D1Database,
  jobId: string,
): Promise<ContinuityDeleteJobRow | null> {
  const row = await db.prepare<ContinuityDeleteJobDatabaseRow>(`
    ${CONTINUITY_DELETE_JOB_SELECT}
    WHERE job_id = ?
  `)
    .bind(jobId)
    .first<ContinuityDeleteJobDatabaseRow>()

  return row ? mapDeleteJobRow(row) : null
}

export async function getRequiredContinuityDeleteJob(
  db: D1Database,
  jobId: string,
): Promise<ContinuityDeleteJobRow> {
  const row = await getContinuityDeleteJob(db, jobId)
  if (!row) {
    throw new Error(`Missing continuity delete job: ${jobId}`)
  }
  return row
}

export async function markContinuityExportJobRunning(
  db: D1Database,
  params: {
    jobId: string
    startedAt: string
  },
): Promise<void> {
  const result = await db.prepare(`
    UPDATE account_export_jobs
    SET
      status = 'running',
      started_at = COALESCE(started_at, ?),
      error_code = NULL,
      error_message = NULL,
      shadow_updated_at = ?
    WHERE job_id = ?
  `)
    .bind(params.startedAt, params.startedAt, params.jobId)
    .run()
  assertD1Success(result, "mark continuity export job running")
  assertD1Changed(result, "mark continuity export job running")
}

export async function markContinuityExportJobCompleted(
  db: D1Database,
  params: {
    jobId: string
    completedAt: string
    expiresAt: string
    artifactObjectKey: string
    artifactSha256: string
    artifactBytes: number
  },
): Promise<void> {
  const result = await db.prepare(`
    UPDATE account_export_jobs
    SET
      status = 'completed',
      started_at = COALESCE(started_at, ?),
      completed_at = ?,
      failed_at = NULL,
      expires_at = ?,
      artifact_object_key = ?,
      artifact_sha256 = ?,
      artifact_bytes = ?,
      error_code = NULL,
      error_message = NULL,
      shadow_updated_at = ?
    WHERE job_id = ?
  `)
    .bind(
      params.completedAt,
      params.completedAt,
      params.expiresAt,
      params.artifactObjectKey,
      params.artifactSha256,
      params.artifactBytes,
      params.completedAt,
      params.jobId,
    )
    .run()
  assertD1Success(result, "mark continuity export job completed")
  assertD1Changed(result, "mark continuity export job completed")
}

export async function markContinuityExportJobFailed(
  db: D1Database,
  params: {
    jobId: string
    failedAt: string
    errorCode: string
    errorMessage: string
  },
): Promise<void> {
  const result = await db.prepare(`
    UPDATE account_export_jobs
    SET
      status = 'failed',
      failed_at = ?,
      error_code = ?,
      error_message = ?,
      shadow_updated_at = ?
    WHERE job_id = ?
  `)
    .bind(params.failedAt, params.errorCode, params.errorMessage, params.failedAt, params.jobId)
    .run()
  assertD1Success(result, "mark continuity export job failed")
  assertD1Changed(result, "mark continuity export job failed")
}

export async function markContinuityExportJobExpired(
  db: D1Database,
  params: {
    jobId: string
    expiredAt: string
  },
): Promise<void> {
  const result = await db.prepare(`
    UPDATE account_export_jobs
    SET
      status = 'expired',
      shadow_updated_at = ?
    WHERE job_id = ?
      AND status = 'completed'
  `)
    .bind(params.expiredAt, params.jobId)
    .run()
  assertD1Success(result, "mark continuity export job expired")
}

export async function markContinuityDeleteJobQueued(
  db: D1Database,
  params: {
    jobId: string
    queuedAt: string
  },
): Promise<void> {
  const result = await db.prepare(`
    UPDATE account_data_delete_jobs
    SET
      status = 'queued',
      shadow_updated_at = ?
    WHERE job_id = ?
      AND status = 'scheduled'
  `)
    .bind(params.queuedAt, params.jobId)
    .run()
  assertD1Success(result, "mark continuity delete job queued")
}

export async function markContinuityDeleteJobRunning(
  db: D1Database,
  params: {
    jobId: string
    startedAt: string
  },
): Promise<void> {
  const result = await db.prepare(`
    UPDATE account_data_delete_jobs
    SET
      status = 'running',
      started_at = COALESCE(started_at, ?),
      error_code = NULL,
      error_message = NULL,
      shadow_updated_at = ?
    WHERE job_id = ?
  `)
    .bind(params.startedAt, params.startedAt, params.jobId)
    .run()
  assertD1Success(result, "mark continuity delete job running")
  assertD1Changed(result, "mark continuity delete job running")
}

export async function markContinuityDeleteJobCompleted(
  db: D1Database,
  params: {
    jobId: string
    completedAt: string
    deletedRecords: Partial<Record<ContinuityDeleteCollection, number>>
  },
): Promise<void> {
  const result = await db.prepare(`
    UPDATE account_data_delete_jobs
    SET
      status = 'completed',
      started_at = COALESCE(started_at, ?),
      completed_at = ?,
      failed_at = NULL,
      deleted_records_json = ?,
      error_code = NULL,
      error_message = NULL,
      shadow_updated_at = ?
    WHERE job_id = ?
  `)
    .bind(
      params.completedAt,
      params.completedAt,
      serializeJsonColumn(params.deletedRecords),
      params.completedAt,
      params.jobId,
    )
    .run()
  assertD1Success(result, "mark continuity delete job completed")
  assertD1Changed(result, "mark continuity delete job completed")
}

export async function markContinuityDeleteJobFailed(
  db: D1Database,
  params: {
    jobId: string
    failedAt: string
    errorCode: string
    errorMessage: string
  },
): Promise<void> {
  const result = await db.prepare(`
    UPDATE account_data_delete_jobs
    SET
      status = 'failed',
      failed_at = ?,
      error_code = ?,
      error_message = ?,
      shadow_updated_at = ?
    WHERE job_id = ?
  `)
    .bind(params.failedAt, params.errorCode, params.errorMessage, params.failedAt, params.jobId)
    .run()
  assertD1Success(result, "mark continuity delete job failed")
  assertD1Changed(result, "mark continuity delete job failed")
}

export async function listContinuityLifecycleBacklog(
  db: D1Database,
): Promise<{
  exportStatusCounts: Record<string, number>
  deleteStatusCounts: Record<string, number>
}> {
  const [exportRows, deleteRows] = await Promise.all([
    selectAll<{ key: string | null; count: number | string }>(
      db,
      `SELECT status AS key, COUNT(*) AS count FROM account_export_jobs GROUP BY status`,
    ),
    selectAll<{ key: string | null; count: number | string }>(
      db,
      `SELECT status AS key, COUNT(*) AS count FROM account_data_delete_jobs GROUP BY status`,
    ),
  ])

  return {
    exportStatusCounts: exportRows.reduce<Record<string, number>>((result, row) => {
      if (row.key) result[row.key] = toNumber(row.count) ?? 0
      return result
    }, {}),
    deleteStatusCounts: deleteRows.reduce<Record<string, number>>((result, row) => {
      if (row.key) result[row.key] = toNumber(row.count) ?? 0
      return result
    }, {}),
  }
}
