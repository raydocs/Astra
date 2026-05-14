export const ARTICLE_IMPORT_SHADOW_VERSION = 1 as const
export const ARTICLE_IMPORT_MAX_SHADOW_BYTES = 256 * 1024
export const ARTICLE_IMPORT_IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60
export const ARTICLE_IMPORT_MAX_NATIVE_BYTES = 2 * 1024 * 1024
export const ARTICLE_IMPORT_DEFAULT_MAX_SHADOW_BYTES = ARTICLE_IMPORT_MAX_SHADOW_BYTES
export const ARTICLE_IMPORT_DEFAULT_MAX_NATIVE_BYTES = ARTICLE_IMPORT_MAX_NATIVE_BYTES
export const ARTICLE_IMPORT_MAX_REDIRECTS = 5
export const ARTICLE_IMPORT_DEFAULT_QUEUE_MAX_ATTEMPTS = 3
export const ARTICLE_IMPORT_DEFAULT_RATE_LIMIT_WINDOW_SECONDS = 60
export const ARTICLE_IMPORT_DEFAULT_ARTIFACT_RETENTION_DAYS = 7
export const ARTICLE_IMPORT_DEFAULT_ARTIFACT_RETENTION_CLASS = "import-shadow"
export const ARTICLE_IMPORT_OPERATOR_TOKEN_HEADER = "x-astra-operator-token"
export const ARTICLE_IMPORT_OPERATOR_ID_HEADER = "x-astra-operator-id"
export const ARTICLE_IMPORT_DEFAULT_REPLAY_BATCH_LIMIT = 10
export const ARTICLE_IMPORT_MAX_REPLAY_BATCH_LIMIT = 25

export type ArticleImportShadowStatus =
  | "received"
  | "queued"
  | "consumed"
  | "completed"
  | "failed"
  | "skipped"
  | "dead_lettered"

export type ArticleImportReplayableStatus = Extract<ArticleImportShadowStatus, "failed" | "dead_lettered">

export interface ArticleImportQueueMessage {
  version: typeof ARTICLE_IMPORT_SHADOW_VERSION
  jobId: string
  requestObjectKey: string
  requestHash: string
  traceId: string
  receivedAtEpochMs: number
}

export interface ArticleImportShadowJobRow {
  id: string
  status: ArticleImportShadowStatus
  shadow_version: number
  mode: string
  route: string
  surface: string
  target_hostname: string | null
  decision_reason: string | null
  fallback_reason: string | null
  artifact_retention_class: string
  artifact_retention_until_epoch_ms: number | null
  request_hash: string
  request_object_key: string | null
  response_object_key: string | null
  source_object_key: string | null
  request_object_bytes: number | null
  response_object_bytes: number | null
  source_object_bytes: number | null
  request_object_sha256: string | null
  response_object_sha256: string | null
  source_object_sha256: string | null
  idempotency_key: string | null
  content_type: string | null
  content_length: number | null
  proxy_status: number | null
  trace_id: string
  error_code: string | null
  last_failure_error_code: string | null
  queue_attempt_count: number
  last_queue_attempt_epoch_ms: number | null
  consumed_at_epoch_ms: number | null
  dead_lettered_at_epoch_ms: number | null
  replay_count: number
  last_replayed_at_epoch_ms: number | null
  last_replay_reason: string | null
  last_replayed_by: string | null
  created_at_epoch_ms: number
  updated_at_epoch_ms: number
}

export interface ImportedReadableArticle {
  url: string
  title: string
  hostname: string
  byline: string | null
  scope: "article" | "page"
  summary: string | null
  blocks: string[]
}
