import type { D1Database } from "../bindings"
import { assertD1Success } from "../lib/d1"
import type {
  ShadowAuthIssueRequestRow,
  ShadowAuthIssueRequestSnapshot,
} from "../types/shadow-state"

interface ShadowAuthIssueRequestDatabaseRow {
  request_key: string
  route_kind: ShadowAuthIssueRequestRow["routeKind"]
  user_id: string | null
  install_id: string | null
  device_id: string
  session_id: string
  node_mirror_status: ShadowAuthIssueRequestRow["nodeMirrorStatus"]
  created_at: string
  last_attempt_at: string
  completed_at: string | null
  failed_at: string | null
  error_code: string | null
  error_message: string | null
  shadow_updated_at: string
}

const AUTH_ISSUE_REQUEST_SELECT = `
  SELECT
    request_key,
    route_kind,
    user_id,
    install_id,
    device_id,
    session_id,
    node_mirror_status,
    created_at,
    last_attempt_at,
    completed_at,
    failed_at,
    error_code,
    error_message,
    shadow_updated_at
  FROM auth_issue_requests
`

function normalizeAuthIssueRequest(
  snapshot: ShadowAuthIssueRequestSnapshot,
): ShadowAuthIssueRequestRow {
  return {
    ...snapshot,
    userId: snapshot.userId ?? null,
    installId: snapshot.installId ?? null,
    completedAt: snapshot.completedAt ?? null,
    failedAt: snapshot.failedAt ?? null,
    errorCode: snapshot.errorCode ?? null,
    errorMessage: snapshot.errorMessage ?? null,
    shadowUpdatedAt: snapshot.shadowUpdatedAt ?? snapshot.lastAttemptAt,
  }
}

function mapAuthIssueRequestRow(
  row: ShadowAuthIssueRequestDatabaseRow,
): ShadowAuthIssueRequestRow {
  return {
    requestKey: row.request_key,
    routeKind: row.route_kind,
    userId: row.user_id,
    installId: row.install_id,
    deviceId: row.device_id,
    sessionId: row.session_id,
    nodeMirrorStatus: row.node_mirror_status,
    createdAt: row.created_at,
    lastAttemptAt: row.last_attempt_at,
    completedAt: row.completed_at,
    failedAt: row.failed_at,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    shadowUpdatedAt: row.shadow_updated_at,
  }
}

export async function getAuthIssueRequest(
  db: D1Database,
  requestKey: string,
): Promise<ShadowAuthIssueRequestRow | null> {
  const row = await db.prepare<ShadowAuthIssueRequestDatabaseRow>(`
    ${AUTH_ISSUE_REQUEST_SELECT}
    WHERE request_key = ?
  `)
    .bind(requestKey)
    .first<ShadowAuthIssueRequestDatabaseRow>()

  return row ? mapAuthIssueRequestRow(row) : null
}

export async function createPendingAuthIssueRequest(
  db: D1Database,
  snapshot: ShadowAuthIssueRequestSnapshot,
): Promise<ShadowAuthIssueRequestRow> {
  const row = normalizeAuthIssueRequest({
    ...snapshot,
    nodeMirrorStatus: "pending",
    completedAt: null,
    failedAt: null,
    errorCode: null,
    errorMessage: null,
  })
  const result = await db.prepare(`
    INSERT INTO auth_issue_requests (
      request_key,
      route_kind,
      user_id,
      install_id,
      device_id,
      session_id,
      node_mirror_status,
      created_at,
      last_attempt_at,
      completed_at,
      failed_at,
      error_code,
      error_message,
      shadow_updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(request_key) DO UPDATE SET
      route_kind = excluded.route_kind,
      user_id = excluded.user_id,
      install_id = excluded.install_id,
      device_id = excluded.device_id,
      session_id = excluded.session_id,
      node_mirror_status = excluded.node_mirror_status,
      created_at = excluded.created_at,
      last_attempt_at = excluded.last_attempt_at,
      completed_at = excluded.completed_at,
      failed_at = excluded.failed_at,
      error_code = excluded.error_code,
      error_message = excluded.error_message,
      shadow_updated_at = excluded.shadow_updated_at
  `)
    .bind(
      row.requestKey,
      row.routeKind,
      row.userId,
      row.installId,
      row.deviceId,
      row.sessionId,
      row.nodeMirrorStatus,
      row.createdAt,
      row.lastAttemptAt,
      row.completedAt,
      row.failedAt,
      row.errorCode,
      row.errorMessage,
      row.shadowUpdatedAt,
    )
    .run()
  assertD1Success(result, "create pending auth issue request")

  return row
}

export async function markAuthIssueRequestCompleted(
  db: D1Database,
  params: {
    requestKey: string
    completedAt: string
    lastAttemptAt?: string
    shadowUpdatedAt?: string
  },
): Promise<void> {
  const result = await db.prepare(`
    UPDATE auth_issue_requests
    SET
      node_mirror_status = 'completed',
      completed_at = ?,
      failed_at = NULL,
      error_code = NULL,
      error_message = NULL,
      last_attempt_at = ?,
      shadow_updated_at = ?
    WHERE request_key = ?
  `)
    .bind(
      params.completedAt,
      params.lastAttemptAt ?? params.completedAt,
      params.shadowUpdatedAt ?? params.completedAt,
      params.requestKey,
    )
    .run()
  assertD1Success(result, "mark auth issue request completed")
}

export async function markAuthIssueRequestFailed(
  db: D1Database,
  params: {
    requestKey: string
    failedAt: string
    errorCode?: string | null
    errorMessage?: string | null
    lastAttemptAt?: string
    shadowUpdatedAt?: string
  },
): Promise<void> {
  const result = await db.prepare(`
    UPDATE auth_issue_requests
    SET
      node_mirror_status = 'failed',
      completed_at = NULL,
      failed_at = ?,
      error_code = ?,
      error_message = ?,
      last_attempt_at = ?,
      shadow_updated_at = ?
    WHERE request_key = ?
  `)
    .bind(
      params.failedAt,
      params.errorCode ?? null,
      params.errorMessage ?? null,
      params.lastAttemptAt ?? params.failedAt,
      params.shadowUpdatedAt ?? params.failedAt,
      params.requestKey,
    )
    .run()
  assertD1Success(result, "mark auth issue request failed")
}
