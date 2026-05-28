import { createHash, createPublicKey, randomInt, verify as verifySignature } from "node:crypto"
import { createServer, type IncomingMessage, type ServerResponse } from "node:http"
import { lookup } from "node:dns/promises"

import { JSDOM } from "jsdom"
import { z } from "zod"

import { AstraError, toTranslationError, type TranslationError } from "../types/translation"
import { ProviderIdSchema } from "../types/config"
import { TranslateBatchPayloadSchema } from "../types/messages"
import {
  AstraPlanSchema,
  AstraSubscriptionStatusSchema,
  AstraUsageEventSchema,
} from "../types/auth"
import {
  VideoNoteArtifactResponseSchema,
  VideoNoteCreateRequestSchema,
  VideoNoteCreateResponseSchema,
  VideoNoteStatusResponseSchema,
} from "../types/video-notes"
import {
  AstraLongRunningTaskCreateRequestSchema,
  AstraLongRunningTaskCreateResponseSchema,
  AstraLongRunningTaskListResponseSchema,
  AstraLongRunningTaskStatusResponseSchema,
  AstraLongRunningTaskUpdateSchema,
} from "../types/long-running-tasks"
import { extractReadableDocumentMetadata, resolveExtractionPlan } from "../utils/dom/extraction"
import { getCostBucketForTask, getLatencyBucket, getTaskClassForTranslationRequest, isHighCostTask, normalizeOperatingTier } from "../utils/operating-model"
import { buildAstraCancellationReasonSubmission } from "../utils/cancellation-reasons"
import { SupportBundleSchema, isMetadataOnlySupportBundle } from "../utils/support-bundle"
import { findSupportFirstResponseMacro } from "../utils/support-response-macros"
import { buildAstraOpsCockpitSummary } from "../utils/operating-review"
import { roleCanPerform, roleCanViewModule, type AstraOpsRoleId } from "../utils/ops-console"

import { FileAnalyticsEventStore } from "./analytics-event-store"
import { buildRelaySession, parseBearerToken, verifySessionToken } from "./auth"
import { createBetaTrialLifecycleContract, createCheckoutLink, createPortalLink } from "./billing"
import { FileCancellationReasonStore } from "./cancellation-reason-store"
import { loadRelayEnv } from "./config"
import { FileFeatureFlagRuntimeStore, type RemoteFeatureFlagRuntime } from "./feature-flag-runtime-store"
import { FileLongRunningTaskStore, type LongRunningTaskRecord } from "./long-running-task-store"
import { FileOpsAuditLogStore, type OpsAuditAction } from "./ops-audit-log-store"
import { recommendProviderHealthMitigation } from "./provider-health-mitigation"
import { resolveManagedTranslationRequest, translateViaManagedProviderDetailed } from "./providers"
import { FileSupportKnownIssueStore } from "./support-known-issue-store"
import { FileSupportReportStore, type SupportReportInboxRecord } from "./support-report-store"
import { VideoNoteService } from "./video-note-service"
import type {
  DeviceMetadataInput,
  MirroredAnonymousIssueInput,
  MirroredAuthenticatedIssueInput,
  RelayEnv,
  RelayOperatorPrincipal,
  AstraWeeklyDigestSnapshot,
  ResolvedRelayTranslateRequest,
  ValidatedSessionContext,
  ManagedProviderMetadata,
  ManagedProviderRoute,
  ServerMobileRetentionEventInput,
  ServerUsageEventMetadata,
} from "./types"
import { FileUserStore, isSessionExpired } from "./user-store"

const DeviceDescriptorSchema = z.object({
  label: z.string().trim().min(1).max(80).optional(),
  platform: z.string().trim().min(1).max(40).optional(),
  browserFamily: z.string().trim().min(1).max(40).optional(),
  appKind: z.string().trim().min(1).max(20).optional(),
  appVersion: z.string().trim().min(1).max(40).optional(),
})

const DeviceMetadataSchema = DeviceDescriptorSchema.extend({
  deviceId: z.string().trim().min(1).optional(),
  installId: z.string().trim().min(1).optional(),
  device: DeviceDescriptorSchema.optional(),
})

const AnonymousAuthSchema = DeviceMetadataSchema.refine(
  (value) => Boolean(value.deviceId ?? value.installId),
  { message: "deviceId or installId is required.", path: ["deviceId"] },
)

const LoginSchema = DeviceMetadataSchema.extend({
  email: z.string().trim().min(1),
  password: z.string().min(1),
  deviceId: z.string().trim().min(1),
})

const MobileLinkRedeemSchema = DeviceMetadataSchema.extend({
  code: z.string().trim().min(4),
  deviceId: z.string().trim().min(1),
})

const EmailSignInCodeRequestSchema = z.object({
  email: z.string().trim().email().max(254),
}).strict()

const EmailSignInCodeRedeemSchema = DeviceMetadataSchema.extend({
  email: z.string().trim().email().max(254),
  code: z.string().trim().min(4).max(64),
  deviceId: z.string().trim().min(1),
})

const OAuthIdentityRedeemSchema = DeviceMetadataSchema.extend({
  provider: z.enum(["apple", "google"]),
  idToken: z.string().trim().min(20).max(20_000).optional(),
  nonce: z.string().trim().min(1).max(255).optional(),
  subject: z.string().trim().min(1).max(255).optional(),
  email: z.string().trim().email().max(254).optional(),
  emailVerified: z.boolean().optional(),
  verified: z.literal(true).optional(),
  deviceId: z.string().trim().min(1),
}).refine(
  (value) => Boolean(value.idToken) || (Boolean(value.subject) && value.verified === true),
  { message: "idToken or verified development identity is required.", path: ["idToken"] },
)

const TranslateSchema = TranslateBatchPayloadSchema.extend({
  provider: ProviderIdSchema.optional(),
  model: z.string().trim().min(1).optional(),
})

const PlanUpdateSchema = z.object({
  plan: AstraPlanSchema,
  // Operator-only: target account for a paid (pro/trial) grant. Ignored/forbidden
  // for self-serve "free" downgrades (a user can only change their own plan).
  // Format + length validated here; case normalized at the handler.
  email: z.string().trim().min(3).max(254).regex(/^[^@\s]+@[^@\s]+\.[^@\s]+$/, "must be a valid email").optional(),
})

const BillingCheckoutSchema = z.object({
  plan: AstraPlanSchema,
})

const CancellationReasonCreateSchema = z.object({
  reason: z.string().trim().min(1),
  source: z.enum(["billing_portal", "refund_request", "settings", "support", "unknown"]).optional(),
}).strict()

const ArticleImportSchema = z.object({
  url: z.string().trim().min(1),
})

const SupportReportCreateSchema = z.object({
  bundle: SupportBundleSchema,
}).strict()

const SyncMutationSchema = z.object({
  collection: z.enum(["config", "vocabulary", "review_schedule", "reading_history", "study_progress"]),
  schemaVersion: z.number().int().positive(),
  recordId: z.string().trim().min(1),
  operation: z.enum(["upsert", "delete"]),
  clientMutationId: z.string().trim().min(1),
  deviceId: z.string().trim().min(1),
  clientUpdatedAt: z.string().trim().min(1),
  payload: z.record(z.string(), z.unknown()).nullable().optional(),
})

const SyncPushSchema = z.object({
  mutations: z.array(SyncMutationSchema).default([]),
})

const MobileRetentionEventNameSchema = z.enum([
  "app_opened",
  "app_hydrated",
  "review_rated",
  "review_skipped",
  "sync_attempted",
  "sync_succeeded",
  "sync_failed",
  "reminder_preference_changed",
  "notification_tapped",
  "sign_in_succeeded",
  "sign_in_failed",
  "link_succeeded",
  "link_failed",
  "source_hidden",
  "source_restored",
  "source_removed",
  "cloud_learning_delete_requested",
  "cloud_learning_delete_succeeded",
  "cloud_learning_delete_failed",
])

const MobileRetentionUploadSchema = z.object({
  schema: z.literal("astra-mobile-retention-events.v1"),
  events: z.array(z.object({
    id: z.string().trim().min(1).max(120),
    name: MobileRetentionEventNameSchema,
    timestamp: z.number().finite(),
    metadata: z.record(z.string(), z.unknown()).default({}),
  })).max(50).default([]),
}).strict()

const AnalyticsEventsUploadSchema = z.object({
  schema: z.literal("astra-analytics-events-ingest.v1"),
  events: z.array(z.unknown()).max(50).default([]),
}).strict()

const MOBILE_RETENTION_METADATA_KEYS_BY_EVENT: Record<z.infer<typeof MobileRetentionEventNameSchema>, Set<string>> = {
  app_opened: new Set(["surface"]),
  app_hydrated: new Set(["signedIn", "sampleDeck", "status"]),
  review_rated: new Set(["rating", "sampleDeck", "sourceScoped", "sourceType", "dueCount"]),
  review_skipped: new Set(["rating", "reason", "sampleDeck", "sourceScoped", "sourceType", "dueCount"]),
  sync_attempted: new Set(["pendingCount"]),
  sync_succeeded: new Set(["status"]),
  sync_failed: new Set(["status", "reason"]),
  reminder_preference_changed: new Set(["reviewReminder", "preferredTime", "weeklyDigest", "enabled"]),
  notification_tapped: new Set(["action"]),
  sign_in_succeeded: new Set(["sampleDeck", "syncStatus"]),
  sign_in_failed: new Set(["reason"]),
  link_succeeded: new Set(["sampleDeck", "syncStatus"]),
  link_failed: new Set(["reason"]),
  source_hidden: new Set(["sampleDeck"]),
  source_restored: new Set(["sampleDeck", "fromRemoved"]),
  source_removed: new Set(["sampleDeck"]),
  cloud_learning_delete_requested: new Set(["signedIn"]),
  cloud_learning_delete_succeeded: new Set(["status"]),
  cloud_learning_delete_failed: new Set(["reason"]),
}

const SyncPullSchema = z.object({
  cursors: z.object({
    config: z.string().trim().min(1).nullable().optional(),
    vocabulary: z.string().trim().min(1).nullable().optional(),
    review_schedule: z.string().trim().min(1).nullable().optional(),
    reading_history: z.string().trim().min(1).nullable().optional(),
    study_progress: z.string().trim().min(1).nullable().optional(),
  }).partial().default({}),
}).default({ cursors: {} })
const SyncPreferenceCollectionSchema = z.enum(["reading_history", "study_progress"])
const SyncCollectionPreferenceSchema = z.object({
  enabled: z.boolean(),
})
const WeeklyDigestPreferenceSchema = z.object({
  enabled: z.boolean(),
}).strict()
const DevicePushTokenSchema = z.object({
  expoPushToken: z.string().trim().min(1).max(4096).nullable(),
  platform: z.string().trim().min(1).max(40).nullable().optional(),
}).strict()
const WeeklyDigestDeliveryRunSchema = z.object({
  dryRun: z.boolean().default(false),
  limit: z.number().int().positive().max(200).default(50),
  now: z.string().datetime().optional(),
}).strict().default({ dryRun: false, limit: 50 })

const MirroredDeviceSchema = z.object({
  deviceId: z.string().trim().min(1),
  userId: z.string().trim().min(1),
  email: z.string().trim().min(1),
  identityMode: z.enum(["anonymous", "authenticated"]),
  label: z.string().trim().min(1),
  platform: z.string().trim().min(1).nullable(),
  browserFamily: z.string().trim().min(1).nullable(),
  appKind: z.string().trim().min(1),
  appVersion: z.string().trim().min(1).nullable(),
  firstSeenAt: z.string().trim().min(1),
  lastSeenAt: z.string().trim().min(1),
  lastSyncAt: z.string().trim().min(1).nullable(),
  status: z.enum(["active", "revoked"]),
  expoPushToken: z.string().trim().min(1).nullable().default(null),
  expoPushTokenUpdatedAt: z.string().trim().min(1).nullable().default(null),
  expoPushTokenPlatform: z.string().trim().min(1).nullable().default(null),
  updatedAt: z.string().trim().min(1),
  revokedAt: z.string().trim().min(1).nullable(),
})

const MirroredSessionSchema = z.object({
  sessionId: z.string().trim().min(1),
  userId: z.string().trim().min(1),
  email: z.string().trim().min(1),
  deviceId: z.string().trim().min(1),
  identityMode: z.enum(["anonymous", "authenticated"]),
  issuedAt: z.string().trim().min(1),
  expiresAt: z.string().trim().min(1).nullable(),
  createdAt: z.string().trim().min(1),
  lastSeenAt: z.string().trim().min(1),
  lastVerifiedAt: z.string().trim().min(1).nullable(),
  status: z.enum(["active", "revoked"]),
  revokedAt: z.string().trim().min(1).nullable(),
})

const MirroredAnonymousUserSchema = z.object({
  id: z.string().trim().min(1),
  email: z.string().trim().min(1),
  billingEmail: z.string().trim().min(1),
  createdAt: z.string().trim().min(1),
  passwordHash: z.string().trim().min(1),
  plan: AstraPlanSchema,
  subscriptionStatus: AstraSubscriptionStatusSchema,
  providerEntitlements: z.array(ProviderIdSchema),
  limits: z.object({
    dailyRequests: z.number().int().nonnegative(),
    dailyCharacters: z.number().int().nonnegative(),
    requestsPerMinute: z.number().int().nonnegative(),
  }),
  usage: z.object({
    usageDay: z.string().trim().min(1),
    requestsToday: z.number().int().nonnegative(),
    charactersToday: z.number().int().nonnegative(),
    totalRequests: z.number().int().nonnegative(),
    totalCharacters: z.number().int().nonnegative(),
    lastRequestAt: z.string().trim().min(1).nullable(),
    recentRequestTimestamps: z.array(z.string().trim().min(1)),
    recentEvents: z.array(AstraUsageEventSchema),
    taskUsageMonth: z.string().trim().min(1).default("1970-01"),
    monthlyTaskRequests: z.record(z.string(), z.number().int().nonnegative()).default({}),
  }),
  identityMode: z.literal("anonymous"),
  syncPreferences: z.object({
    reading_history: z.boolean(),
    study_progress: z.boolean(),
    weekly_digest: z.boolean(),
  }),
  installId: z.string().trim().min(1).optional(),
})

const MirroredAuthenticatedIssueSchema = z.object({
  userId: z.string().trim().min(1),
  email: z.string().trim().min(1),
  device: MirroredDeviceSchema,
  session: MirroredSessionSchema,
})

const MirroredAnonymousIssueSchema = z.object({
  user: MirroredAnonymousUserSchema,
  device: MirroredDeviceSchema,
  session: MirroredSessionSchema,
})

class HttpRouteError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = "HttpRouteError"
  }
}

const MAX_IMPORTED_ARTICLE_BYTES = 2 * 1024 * 1024
const MAX_IMPORTED_ARTICLE_REDIRECTS = 5
const BLOCKED_URL_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "0.0.0.0",
])

const CORS_ALLOW_HEADERS = [
  "authorization",
  "content-type",
  "idempotency-key",
  "x-astra-device-id",
  "x-astra-import-surface",
  "x-astra-operator-token",
].join(", ")

const CORS_ALLOW_METHODS = "GET, POST, PATCH, DELETE, OPTIONS"

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)))
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim()
  if (!raw) return {}
  return JSON.parse(raw)
}

function sendJson(response: ServerResponse, status: number, payload: unknown) {
  response.writeHead(status, { "Content-Type": "application/json" })
  response.end(JSON.stringify(payload))
}

function sendError(response: ServerResponse, status: number, message: string, code = "UNKNOWN") {
  sendJson(response, status, {
    error: {
      code,
      message,
    },
  })
}

function resolveCorsOrigin(request: IncomingMessage, env: RelayEnv): string | null {
  const origin = request.headers.origin?.trim()
  if (!origin) return null
  const allowedOrigins = env.corsAllowedOrigins ?? ["*"]
  if (allowedOrigins.includes("*")) return "*"
  return allowedOrigins.includes(origin) ? origin : null
}

function applyCorsHeaders(request: IncomingMessage, response: ServerResponse, env: RelayEnv) {
  const allowedOrigin = resolveCorsOrigin(request, env)
  if (!allowedOrigin) return

  response.setHeader("Access-Control-Allow-Origin", allowedOrigin)
  response.setHeader("Access-Control-Allow-Methods", CORS_ALLOW_METHODS)
  response.setHeader("Access-Control-Allow-Headers", CORS_ALLOW_HEADERS)
  response.setHeader("Access-Control-Max-Age", "86400")
  if (allowedOrigin !== "*") {
    response.setHeader("Vary", "Origin")
  }
}

function isKnownProductionAstraHost(value: string): boolean {
  try {
    const hostname = new URL(value).hostname.trim().toLowerCase()
    return hostname === "astra.app"
      || hostname.endsWith(".astra.app")
      || hostname === "astra.so"
      || hostname.endsWith(".astra.so")
      || hostname === "astra.ai"
      || hostname.endsWith(".astra.ai")
  } catch {
    return true
  }
}

function isOAuthDevelopmentRedeemAllowed(env: RelayEnv): boolean {
  if (!env.oauthIdentityDevelopmentRedeem) return false
  if (process.env.NODE_ENV === "production") return false
  return !isKnownProductionAstraHost(env.publicBaseURL) && !isKnownProductionAstraHost(env.sessionPublicBaseURL)
}

type OAuthJwtHeader = {
  alg?: unknown
  kid?: unknown
  typ?: unknown
}

type OAuthJwtClaims = {
  iss?: unknown
  aud?: unknown
  sub?: unknown
  exp?: unknown
  nbf?: unknown
  nonce?: unknown
  email?: unknown
  email_verified?: unknown
}

type VerifiedOAuthIdentity = {
  provider: "apple" | "google"
  subject: string
  email?: string
  emailVerified: boolean
}

const GOOGLE_OAUTH_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs"
const APPLE_OAUTH_JWKS_URL = "https://appleid.apple.com/auth/keys"

function decodeBase64UrlJson<T>(segment: string): T {
  try {
    return JSON.parse(Buffer.from(segment, "base64url").toString("utf8")) as T
  } catch {
    throw new HttpRouteError(401, "AUTH_REQUIRED", "OAuth identity token is invalid.")
  }
}

function getJwtAudienceValues(value: unknown): string[] {
  if (typeof value === "string") return [value]
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string")
  return []
}

function parseJwtEmailVerified(value: unknown): boolean {
  return value === true || value === "true" || value === "1"
}

async function fetchOAuthJwks(jwksUrl: string): Promise<Array<Record<string, unknown>>> {
  const response = await fetch(jwksUrl, { headers: { Accept: "application/json" } })
  if (!response.ok) {
    throw new HttpRouteError(503, "CONFIG_MISSING", "OAuth identity verification keys are unavailable.")
  }
  const payload = await response.json() as { keys?: unknown }
  return Array.isArray(payload.keys)
    ? payload.keys.filter((key): key is Record<string, unknown> => typeof key === "object" && key !== null && !Array.isArray(key))
    : []
}

async function verifyOAuthJwt(params: {
  token: string
  issuer: string | string[]
  audiences: string[]
  jwksUrl: string
  nonce: string
}): Promise<OAuthJwtClaims> {
  const [encodedHeader, encodedPayload, encodedSignature] = params.token.split(".")
  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    throw new HttpRouteError(401, "AUTH_REQUIRED", "OAuth identity token is invalid.")
  }

  const header = decodeBase64UrlJson<OAuthJwtHeader>(encodedHeader)
  const claims = decodeBase64UrlJson<OAuthJwtClaims>(encodedPayload)
  if (header.alg !== "RS256" || typeof header.kid !== "string") {
    throw new HttpRouteError(401, "AUTH_REQUIRED", "OAuth identity token is invalid.")
  }

  const jwks = await fetchOAuthJwks(params.jwksUrl)
  const jwk = jwks.find((key) => key.kid === header.kid && key.kty === "RSA")
  if (!jwk) {
    throw new HttpRouteError(401, "AUTH_REQUIRED", "OAuth identity token is invalid.")
  }

  let publicKey: ReturnType<typeof createPublicKey>
  try {
    publicKey = createPublicKey({ key: jwk, format: "jwk" })
  } catch {
    throw new HttpRouteError(401, "AUTH_REQUIRED", "OAuth identity token is invalid.")
  }

  const signingInput = `${encodedHeader}.${encodedPayload}`
  const signature = Buffer.from(encodedSignature, "base64url")
  const signatureValid = verifySignature("RSA-SHA256", Buffer.from(signingInput), publicKey, signature)
  if (!signatureValid) {
    throw new HttpRouteError(401, "AUTH_REQUIRED", "OAuth identity token is invalid.")
  }

  const issuers = Array.isArray(params.issuer) ? params.issuer : [params.issuer]
  if (typeof claims.iss !== "string" || !issuers.includes(claims.iss)) {
    throw new HttpRouteError(401, "AUTH_REQUIRED", "OAuth identity token issuer is invalid.")
  }
  const audiences = getJwtAudienceValues(claims.aud)
  if (!audiences.some((audience) => params.audiences.includes(audience))) {
    throw new HttpRouteError(401, "AUTH_REQUIRED", "OAuth identity token audience is invalid.")
  }
  const nowSeconds = Math.floor(Date.now() / 1000)
  if (typeof claims.exp !== "number" || claims.exp <= nowSeconds) {
    throw new HttpRouteError(401, "AUTH_REQUIRED", "OAuth identity token is expired.")
  }
  if (typeof claims.nbf === "number" && claims.nbf > nowSeconds + 60) {
    throw new HttpRouteError(401, "AUTH_REQUIRED", "OAuth identity token is not active.")
  }
  if (claims.nonce !== params.nonce) {
    throw new HttpRouteError(401, "AUTH_REQUIRED", "OAuth identity token nonce is invalid.")
  }
  if (typeof claims.sub !== "string" || !claims.sub.trim()) {
    throw new HttpRouteError(401, "AUTH_REQUIRED", "OAuth identity token subject is invalid.")
  }

  return claims
}

async function verifyOAuthIdentityIdToken(params: {
  provider: "apple" | "google"
  idToken: string
  nonce?: string
  env: RelayEnv
}): Promise<VerifiedOAuthIdentity> {
  if (!params.nonce?.trim()) {
    throw new HttpRouteError(400, "INVALID_REQUEST", "OAuth nonce is required.")
  }
  const audiences = params.provider === "google" ? params.env.oauthGoogleClientIds : params.env.oauthAppleClientIds
  if (!audiences?.length) {
    throw new HttpRouteError(503, "CONFIG_MISSING", "OAuth sign-in is not configured.")
  }

  const claims = await verifyOAuthJwt({
    token: params.idToken,
    issuer: params.provider === "google" ? ["accounts.google.com", "https://accounts.google.com"] : "https://appleid.apple.com",
    audiences,
    jwksUrl: params.provider === "google" ? GOOGLE_OAUTH_JWKS_URL : APPLE_OAUTH_JWKS_URL,
    nonce: params.nonce.trim(),
  })
  const email = typeof claims.email === "string" && claims.email.trim()
    ? claims.email.trim().toLowerCase()
    : undefined

  return {
    provider: params.provider,
    subject: claims.sub as string,
    ...(email ? { email } : {}),
    emailVerified: parseJwtEmailVerified(claims.email_verified),
  }
}

function normalizeImportedArticleUrl(value: string): URL {
  let parsed: URL
  try {
    parsed = new URL(value.trim())
  } catch {
    throw new HttpRouteError(400, "INVALID_REQUEST", "Enter a valid absolute URL, including https://.")
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new HttpRouteError(400, "INVALID_REQUEST", "Only http(s) article URLs are supported.")
  }

  const hostname = parsed.hostname.trim().toLowerCase()
  if (!hostname) {
    throw new HttpRouteError(400, "INVALID_REQUEST", "Imported article URL hostname is required.")
  }

  return parsed
}

function isBlockedIpv4Address(hostname: string): boolean {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(hostname)
  if (!match) return false

  const octets = match.slice(1).map((part) => Number.parseInt(part, 10))
  if (octets.some((octet) => Number.isNaN(octet) || octet < 0 || octet > 255)) {
    return true
  }

  const [first, second] = octets
  if (first === 10 || first === 127 || first === 0) return true
  if (first === 169 && second === 254) return true
  if (first === 172 && second >= 16 && second <= 31) return true
  if (first === 192 && second === 168) return true
  return false
}

function isBlockedIpv6Address(hostname: string): boolean {
  const normalized = hostname.replace(/^\[|\]$/g, "").toLowerCase()
  if (!normalized.includes(":")) return false

  if (normalized === "::1" || normalized === "::") return true
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true
  if (normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb")) {
    return true
  }

  return false
}

async function assertImportedArticleUrlIsPublic(url: URL): Promise<void> {
  const hostname = url.hostname.trim().toLowerCase()
  if (!hostname) {
    throw new HttpRouteError(400, "INVALID_REQUEST", "Imported article URL hostname is required.")
  }

  if (BLOCKED_URL_HOSTS.has(hostname) || hostname.endsWith(".local")) {
    throw new HttpRouteError(400, "INVALID_REQUEST", "Local or private network URLs are not allowed.")
  }

  if (isBlockedIpv4Address(hostname) || isBlockedIpv6Address(hostname)) {
    throw new HttpRouteError(400, "INVALID_REQUEST", "Local or private network URLs are not allowed.")
  }

  try {
    const resolved = await lookup(hostname, { all: true, verbatim: true })
    if (resolved.some((entry) => isBlockedIpv4Address(entry.address) || isBlockedIpv6Address(entry.address))) {
      throw new HttpRouteError(400, "INVALID_REQUEST", "Local or private network URLs are not allowed.")
    }
  } catch (error) {
    if (error instanceof HttpRouteError) {
      throw error
    }

    throw new HttpRouteError(
      400,
      "CONTENT_UNAVAILABLE",
      "The relay could not resolve this URL. The source may be unavailable.",
    )
  }
}

async function fetchImportedArticleUpstream(articleUrl: URL): Promise<{ response: Response; finalUrl: URL }> {
  let currentUrl = articleUrl

  for (let redirectCount = 0; redirectCount <= MAX_IMPORTED_ARTICLE_REDIRECTS; redirectCount += 1) {
    await assertImportedArticleUrlIsPublic(currentUrl)

    let response: Response
    try {
      response = await fetch(currentUrl, {
        headers: {
          Accept: "text/html,application/xhtml+xml",
        },
        redirect: "manual",
        signal: AbortSignal.timeout(10_000),
      })
    } catch {
      throw new HttpRouteError(
        400,
        "CONTENT_UNAVAILABLE",
        "The relay could not fetch this URL. The source may be blocking access or timing out.",
      )
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location")
      if (!location) {
        throw new HttpRouteError(400, "CONTENT_UNAVAILABLE", "The imported URL redirected without a location header.")
      }

      currentUrl = normalizeImportedArticleUrl(new URL(location, currentUrl).toString())
      continue
    }

    return { response, finalUrl: currentUrl }
  }

  throw new HttpRouteError(400, "CONTENT_UNAVAILABLE", "The imported URL redirected too many times.")
}

function readDeviceIdHeader(request: IncomingMessage): string | null {
  const header = request.headers["x-astra-device-id"]
  if (typeof header === "string") {
    const value = header.trim()
    return value.length ? value : null
  }
  if (Array.isArray(header)) {
    const value = header[0]?.trim() ?? ""
    return value.length ? value : null
  }
  return null
}

function readAuthorizationHeader(request: IncomingMessage): string | null {
  const header = request.headers.authorization
  if (typeof header === "string") {
    return header
  }
  return header?.[0] ?? null
}

function toDeviceMetadata(input: z.infer<typeof DeviceMetadataSchema>): DeviceMetadataInput {
  return {
    deviceId: input.deviceId ?? input.installId ?? "",
    label: input.device?.label ?? input.label,
    platform: input.device?.platform ?? input.platform,
    browserFamily: input.device?.browserFamily ?? input.browserFamily,
    appKind: input.device?.appKind ?? input.appKind,
    appVersion: input.device?.appVersion ?? input.appVersion,
  }
}

async function requireAuthenticatedSession(
  request: IncomingMessage,
  env: RelayEnv,
  users: FileUserStore,
  options: { requireDeviceHeader?: boolean } = {},
): Promise<ValidatedSessionContext> {
  const token = parseBearerToken(request.headers.authorization ?? null)
  const claims = await verifySessionToken(token, env)
  if (!token || !claims) {
    throw new HttpRouteError(401, "SESSION_REQUIRED", "Invalid or missing Astra session.")
  }

  const deviceHeader = readDeviceIdHeader(request)
  if (options.requireDeviceHeader && !deviceHeader) {
    throw new HttpRouteError(400, "DEVICE_REQUIRED", "Missing X-Astra-Device-Id header.")
  }

  const context = await users.getSessionContext(claims.email, claims.sessionId)
  if (!context) {
    throw new HttpRouteError(401, "REAUTH_REQUIRED", "Astra session is no longer available.")
  }

  if (context.session.deviceId !== claims.deviceId || context.session.email !== claims.email) {
    throw new HttpRouteError(401, "REAUTH_REQUIRED", "Astra session metadata is out of date.")
  }

  if (deviceHeader && deviceHeader !== context.session.deviceId) {
    throw new HttpRouteError(409, "DEVICE_MISMATCH", "Astra session is bound to a different device.")
  }

  if (!context.device) {
    throw new HttpRouteError(401, "REAUTH_REQUIRED", "Astra device record is missing.")
  }

  if (context.device.status === "revoked") {
    throw new HttpRouteError(401, "DEVICE_REVOKED", "Astra device has been revoked.")
  }

  if (context.session.status === "revoked") {
    throw new HttpRouteError(401, "SESSION_REVOKED", "Astra session has been revoked.")
  }

  if (isSessionExpired(context.session.expiresAt)) {
    throw new HttpRouteError(401, "SESSION_EXPIRED", "Astra session has expired.")
  }

  return {
    token,
    claims,
    user: context.user,
    device: context.device,
    sessionRecord: context.session,
    session: buildRelaySession(context.user, token, context.session, env.sessionPublicBaseURL),
  }
}

function assertInternalMirrorAuthorized(request: IncomingMessage, env: RelayEnv): void {
  const secret = env.platformMirrorSecret?.trim()
  if (!secret) {
    throw new HttpRouteError(503, "CONFIG_MISSING", "Internal Cloudflare mirror secret is not configured.")
  }

  const token = parseBearerToken(readAuthorizationHeader(request))
  if (token !== secret) {
    throw new HttpRouteError(401, "SESSION_REQUIRED", "Internal Cloudflare mirror request is unauthorized.")
  }
}

function readOperatorToken(request: IncomingMessage): string | null {
  const bearer = parseBearerToken(readAuthorizationHeader(request))
  const header = request.headers["x-astra-operator-token"]
  const operatorToken = typeof header === "string" ? header : header?.[0]
  return bearer ?? operatorToken ?? null
}

function buildOpsEmailHash(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex")
}

function buildOpsDeviceIdHash(deviceId: string): string {
  return createHash("sha256").update(deviceId.trim()).digest("hex")
}

interface ResolvedOperatorPrincipal extends RelayOperatorPrincipal {
  source: "env" | "legacy_platform_operator"
}

const LEGACY_PLATFORM_OPERATOR_ID = "legacy_platform_operator"

function isRole(role: AstraOpsRoleId, allowedRoles: AstraOpsRoleId[]): boolean {
  return allowedRoles.includes(role)
}

function resolveOperatorPrincipal(request: IncomingMessage, env: RelayEnv): ResolvedOperatorPrincipal | null {
  const token = readOperatorToken(request)?.trim()
  if (!token) return null

  const legacySecret = env.platformMirrorSecret?.trim()
  if (legacySecret && token === legacySecret) {
    return {
      id: LEGACY_PLATFORM_OPERATOR_ID,
      role: "admin",
      token,
      source: "legacy_platform_operator",
    }
  }

  const principal = env.operatorPrincipals.find((item) => item.token === token)
  return principal ? { ...principal, source: "env" } : null
}

function operatorAuditMetadata(
  principal: ResolvedOperatorPrincipal,
  metadata: Record<string, string | number | boolean | null> = {},
): Record<string, string | number | boolean | null> {
  return {
    ...metadata,
    operatorId: principal.id,
    operatorRole: principal.role,
    operatorSource: principal.source,
  }
}

async function requireOperatorPrincipal(
  request: IncomingMessage,
  env: RelayEnv,
  auditLog: FileOpsAuditLogStore,
  action: OpsAuditAction,
  canAccess: (role: AstraOpsRoleId) => boolean,
  permission: string,
): Promise<ResolvedOperatorPrincipal> {
  if (!env.platformMirrorSecret?.trim() && env.operatorPrincipals.length === 0) {
    throw new HttpRouteError(503, "CONFIG_MISSING", "Operator token is not configured.")
  }

  const principal = resolveOperatorPrincipal(request, env)
  if (!principal) {
    throw new HttpRouteError(401, "SESSION_REQUIRED", "Operator request is unauthorized.")
  }

  if (!canAccess(principal.role)) {
    await auditLog.record({
      actor: "operator",
      action,
      outcome: "denied",
      operatorToken: principal.token,
      metadata: operatorAuditMetadata(principal, { permission }),
      privacy: { contentIncluded: false, contentAccess: "metadata_only" },
    })
    throw new HttpRouteError(403, "OPERATOR_PERMISSION_DENIED", "Operator role is not permitted to access this ops route.")
  }

  return principal
}

interface MobileLinkCodeRecord {
  userId: string
  email: string
  createdByDeviceId: string
  createdAt: number
  expiresAt: number
}

interface EmailSignInCodeRecord {
  userId: string
  email: string
  createdAt: number
  expiresAt: number
  attempts: number
}

/** In-memory tracker of short-lived desktop-to-mobile link codes. */
const mobileLinkCodes = new Map<string, MobileLinkCodeRecord>()
const emailSignInCodes = new Map<string, EmailSignInCodeRecord>()
const emailSignInCodeRequestsByKey = new Map<string, number[]>()
const emailSignInCodeRedeemsByKey = new Map<string, number[]>()

const MOBILE_LINK_CODE_TTL_MS = 10 * 60 * 1000 // 10 minutes
const MOBILE_LINK_CODE_MAX_ATTEMPTS = 12
const EMAIL_SIGN_IN_CODE_TTL_MS = 10 * 60 * 1000
const EMAIL_SIGN_IN_CODE_REQUEST_RATE_LIMIT = 5
const EMAIL_SIGN_IN_CODE_REQUEST_RATE_WINDOW_MS = 60 * 60 * 1000
const EMAIL_SIGN_IN_CODE_REDEEM_RATE_LIMIT = 12
const EMAIL_SIGN_IN_CODE_REDEEM_RATE_WINDOW_MS = 10 * 60 * 1000
const EMAIL_SIGN_IN_CODE_MAX_REDEEM_ATTEMPTS = 5
const EMAIL_SIGN_IN_CODE_RATE_LIMIT_MAX_KEYS = 1_000

/** In-memory tracker of anonymous account creation timestamps per IP address. */
const anonymousCreationsByIp = new Map<string, number[]>()

const ANONYMOUS_RATE_LIMIT = 3
const ANONYMOUS_RATE_WINDOW_MS = 60 * 60 * 1000 // 1 hour

function getClientIp(request: IncomingMessage): string {
  const forwarded = request.headers["x-forwarded-for"]
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim()
  }
  return request.socket.remoteAddress ?? "unknown"
}

export function checkAnonymousRateLimit(ip: string, now: number = Date.now()): boolean {
  const timestamps = anonymousCreationsByIp.get(ip)
  if (!timestamps) return true
  const windowStart = now - ANONYMOUS_RATE_WINDOW_MS
  const recent = timestamps.filter((t) => t >= windowStart)
  anonymousCreationsByIp.set(ip, recent)
  return recent.length < ANONYMOUS_RATE_LIMIT
}

function recordAnonymousCreation(ip: string, now: number = Date.now()): void {
  const timestamps = anonymousCreationsByIp.get(ip) ?? []
  timestamps.push(now)
  anonymousCreationsByIp.set(ip, timestamps)
}

function normalizeEmailSignInAddress(value: string): string {
  return value.trim().toLowerCase()
}

function getEmailSignInRateLimitIp(request: IncomingMessage): string {
  return request.socket.remoteAddress ?? "unknown"
}

function trimTimestampMapSize(map: Map<string, number[]>, maxKeys: number): void {
  while (map.size > maxKeys) {
    const oldestKey = map.keys().next().value
    if (typeof oldestKey !== "string") return
    map.delete(oldestKey)
  }
}

function pruneTimestampMap(map: Map<string, number[]>, windowStart: number, maxKeys: number): void {
  for (const [key, timestamps] of map) {
    const recent = timestamps.filter((timestamp) => timestamp >= windowStart)
    if (recent.length > 0) {
      map.set(key, recent)
    } else {
      map.delete(key)
    }
  }
  trimTimestampMapSize(map, maxKeys)
}

function checkEmailSignInCodeRequestRateLimit(key: string, now: number = Date.now()): boolean {
  const windowStart = now - EMAIL_SIGN_IN_CODE_REQUEST_RATE_WINDOW_MS
  pruneTimestampMap(emailSignInCodeRequestsByKey, windowStart, EMAIL_SIGN_IN_CODE_RATE_LIMIT_MAX_KEYS)
  const recent = emailSignInCodeRequestsByKey.get(key) ?? []
  emailSignInCodeRequestsByKey.set(key, recent)
  return recent.length < EMAIL_SIGN_IN_CODE_REQUEST_RATE_LIMIT
}

function recordEmailSignInCodeRequest(key: string, now: number = Date.now()): void {
  const timestamps = emailSignInCodeRequestsByKey.get(key) ?? []
  timestamps.push(now)
  emailSignInCodeRequestsByKey.set(key, timestamps)
  trimTimestampMapSize(emailSignInCodeRequestsByKey, EMAIL_SIGN_IN_CODE_RATE_LIMIT_MAX_KEYS)
}

function checkEmailSignInCodeRedeemRateLimit(key: string, now: number = Date.now()): boolean {
  const windowStart = now - EMAIL_SIGN_IN_CODE_REDEEM_RATE_WINDOW_MS
  pruneTimestampMap(emailSignInCodeRedeemsByKey, windowStart, EMAIL_SIGN_IN_CODE_RATE_LIMIT_MAX_KEYS)
  const recent = emailSignInCodeRedeemsByKey.get(key) ?? []
  emailSignInCodeRedeemsByKey.set(key, recent)
  return recent.length < EMAIL_SIGN_IN_CODE_REDEEM_RATE_LIMIT
}

function recordEmailSignInCodeRedeemAttempt(key: string, now: number = Date.now()): void {
  const timestamps = emailSignInCodeRedeemsByKey.get(key) ?? []
  timestamps.push(now)
  emailSignInCodeRedeemsByKey.set(key, timestamps)
  trimTimestampMapSize(emailSignInCodeRedeemsByKey, EMAIL_SIGN_IN_CODE_RATE_LIMIT_MAX_KEYS)
}

function isEmailDeliveryConfigured(env: RelayEnv): boolean {
  return env.emailDeliveryProvider === "resend"
    && Boolean(env.emailDeliveryResendApiKey?.trim())
    && Boolean(env.emailDeliveryResendFrom?.trim())
}

function isEmailSignInDeliveryConfigured(env: RelayEnv): boolean {
  return isEmailDeliveryConfigured(env)
}

function buildEmailSignInCodeCreateResponse(
  env: RelayEnv,
  expiresAt: number,
  code?: string,
  options: { deliveryAccepted?: boolean } = {},
): Record<string, string> {
  const developmentEcho = env.emailSignInCodeDevelopmentEcho && code
  const delivery = developmentEcho
    ? "development_response"
    : options.deliveryAccepted || isEmailSignInDeliveryConfigured(env)
      ? "email"
      : "unavailable"
  return {
    ...(developmentEcho ? { code } : {}),
    expiresAt: new Date(expiresAt).toISOString(),
    delivery,
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => {
    switch (character) {
      case "&": return "&amp;"
      case "<": return "&lt;"
      case ">": return "&gt;"
      case "'": return "&#39;"
      case '"': return "&quot;"
      default: return character
    }
  })
}

function resolveResendApiBaseUrl(raw: string | undefined): string {
  if (!raw?.trim()) return "https://api.resend.com"
  try {
    const parsed = new URL(raw.trim())
    if (parsed.protocol === "https:" && parsed.hostname === "api.resend.com") {
      return parsed.toString().replace(/\/+$/, "")
    }
  } catch {
    // Fall back to the canonical Resend API endpoint.
  }
  return "https://api.resend.com"
}

async function sendResendEmail(params: {
  env: RelayEnv
  to: string
  subject: string
  text: string
  html: string
  idempotencyKey: string
}): Promise<boolean> {
  if (!isEmailDeliveryConfigured(params.env)) return false
  const apiKey = params.env.emailDeliveryResendApiKey!.trim()
  const from = params.env.emailDeliveryResendFrom!.trim()
  const baseUrl = resolveResendApiBaseUrl(params.env.emailDeliveryResendApiBaseUrl)

  try {
    const response = await fetch(`${baseUrl}/emails`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": params.idempotencyKey,
      },
      body: JSON.stringify({
        from,
        to: [params.to],
        subject: params.subject,
        text: params.text,
        html: params.html,
      }),
    })
    return response.ok
  } catch {
    return false
  }
}

async function deliverEmailSignInCode(params: {
  env: RelayEnv
  email: string
  code: string
  expiresAt: number
}): Promise<boolean> {
  if (!isEmailSignInDeliveryConfigured(params.env)) return false
  const expiresAtLabel = new Date(params.expiresAt).toISOString()
  const text = `Your Astra sign-in code is ${params.code}. It expires at ${expiresAtLabel}. If you did not request this code, you can ignore this email.`
  const htmlCode = escapeHtml(params.code)
  const htmlExpiresAt = escapeHtml(expiresAtLabel)

  return sendResendEmail({
    env: params.env,
    to: params.email,
    subject: "Your Astra sign-in code",
    text,
    html: `<p>Your Astra sign-in code is <strong>${htmlCode}</strong>.</p><p>It expires at ${htmlExpiresAt}.</p><p>If you did not request this code, you can ignore this email.</p>`,
    idempotencyKey: `email-code-${params.code}`,
  })
}

function digestSourceTypeLabel(type: string): string {
  switch (type) {
    case "page": return "Pages"
    case "video": return "Videos"
    case "pdf": return "PDFs"
    case "doc": return "Docs"
    case "book": return "Books"
    case "writing": return "Writing"
    case "saved": return "Saved items"
    default: return "Sources"
  }
}

function buildWeeklyDigestEmail(params: { digest: AstraWeeklyDigestSnapshot }): { subject: string; text: string; html: string } {
  const { digest } = params
  const periodStart = digest.periodStart.slice(0, 10)
  const periodEnd = digest.periodEnd.slice(0, 10)
  const sourceSummary = digest.sourceBreakdown.length > 0
    ? digest.sourceBreakdown.map((item) => `${digestSourceTypeLabel(item.type)}: ${item.count}`).join(", ")
    : "No saved source activity this week."
  const highlights = [...digest.highlightedWords, ...digest.highlightedSentences]
  const highlightSummary = highlights.length > 0 ? highlights.join("; ") : "No highlights yet."
  const subject = "Your Astra weekly learning note"
  const text = [
    `Your Astra weekly learning note (${periodStart} to ${periodEnd})`,
    `Saved items: ${digest.savedCount}`,
    `Reviewed items: ${digest.reviewedCount}`,
    `Coming up for review: ${digest.nextReviewCount}`,
    `Sources: ${sourceSummary}`,
    `Highlights: ${highlightSummary}`,
  ].join("\n")
  const html = [
    `<p>Your Astra weekly learning note for <strong>${escapeHtml(periodStart)}</strong> to <strong>${escapeHtml(periodEnd)}</strong>.</p>`,
    "<ul>",
    `<li>Saved items: ${digest.savedCount}</li>`,
    `<li>Reviewed items: ${digest.reviewedCount}</li>`,
    `<li>Coming up for review: ${digest.nextReviewCount}</li>`,
    `<li>Sources: ${escapeHtml(sourceSummary)}</li>`,
    `<li>Highlights: ${escapeHtml(highlightSummary)}</li>`,
    "</ul>",
  ].join("")
  return { subject, text, html }
}

async function deliverWeeklyDigestEmail(params: {
  env: RelayEnv
  email: string
  digest: AstraWeeklyDigestSnapshot
}): Promise<boolean> {
  if (!isEmailDeliveryConfigured(params.env)) return false
  const rendered = buildWeeklyDigestEmail({ digest: params.digest })
  return sendResendEmail({
    env: params.env,
    to: params.email,
    subject: rendered.subject,
    text: rendered.text,
    html: rendered.html,
    idempotencyKey: `weekly-digest-${buildOpsEmailHash(params.email).slice(0, 16)}-${params.digest.digestId}`,
  })
}

async function deliverWeeklyDigestPush(params: {
  expoPushToken: string
  digest: AstraWeeklyDigestSnapshot
}): Promise<boolean> {
  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to: params.expoPushToken,
      title: "Your Astra learning note is ready",
      body: "A calm look at what you saved and reviewed this week.",
      data: { astraAction: "open-digest", digestId: params.digest.digestId },
    }),
  })
  if (!response.ok) return false
  const payload = await response.json().catch(() => null) as { data?: { status?: string } } | null
  return payload?.data?.status !== "error"
}

type WeeklyDigestDeliveryStatus = "dry_run" | "email" | "unavailable" | "failed"
type WeeklyDigestPushDeliveryStatus = "dry_run" | "push" | "failed"

interface WeeklyDigestDeliveryRunResult {
  schema: "astra-weekly-digest-delivery-run.v1"
  generatedAt: string
  dryRun: boolean
  emailConfigured: boolean
  consideredCount: number
  deliveredCount: number
  unavailableCount: number
  failedCount: number
  results: Array<{ userId: string; emailHash: string; digestId: string | null; delivery: WeeklyDigestDeliveryStatus }>
}

interface WeeklyDigestPushDeliveryRunResult {
  schema: "astra-weekly-digest-push-delivery-run.v1"
  generatedAt: string
  dryRun: boolean
  consideredCount: number
  deliveredCount: number
  failedCount: number
  results: Array<{ userId: string; emailHash: string; deviceIdHash: string; digestId: string | null; delivery: WeeklyDigestPushDeliveryStatus }>
}

function normalizeMobileLinkCode(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "")
}

function purgeExpiredMobileLinkCodes(now = Date.now()): void {
  for (const [code, record] of mobileLinkCodes) {
    if (record.expiresAt <= now) {
      mobileLinkCodes.delete(code)
    }
  }
  for (const [key, record] of emailSignInCodes) {
    if (record.expiresAt <= now) {
      emailSignInCodes.delete(key)
    }
  }
}

function createMobileLinkCode(now = Date.now()): string {
  purgeExpiredMobileLinkCodes(now)
  for (let attempt = 0; attempt < MOBILE_LINK_CODE_MAX_ATTEMPTS; attempt += 1) {
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0")
    if (!mobileLinkCodes.has(code) && !emailSignInCodes.has(code)) return code
  }
  throw new HttpRouteError(503, "CONFIG_MISSING", "Could not create a mobile link code.")
}

function createEmailSignInCode(now = Date.now()): string {
  purgeExpiredMobileLinkCodes(now)
  for (let attempt = 0; attempt < MOBILE_LINK_CODE_MAX_ATTEMPTS; attempt += 1) {
    const code = String(randomInt(0, 100_000_000)).padStart(8, "0")
    if (!mobileLinkCodes.has(code) && !emailSignInCodes.has(code)) return code
  }
  throw new HttpRouteError(503, "CONFIG_MISSING", "Could not create an email sign-in code.")
}

function buildMobileLinkUrl(code: string): string {
  return `astra-review://link?code=${encodeURIComponent(code)}`
}

/** Exposed for testing – clears all tracked anonymous creation timestamps. */
export function resetAnonymousRateLimits(): void {
  anonymousCreationsByIp.clear()
  mobileLinkCodes.clear()
  emailSignInCodes.clear()
  emailSignInCodeRequestsByKey.clear()
  emailSignInCodeRedeemsByKey.clear()
}

function assertProviderEntitlement(provider: ResolvedRelayTranslateRequest["provider"], entitlements: string[]) {
  if (!entitlements.includes(provider)) {
    throw new AstraError(
      "CONFIG_MISSING",
      `Current Astra plan does not allow provider: ${provider}.`,
    )
  }
}

function assertVideoNoteAccess(authenticated: ValidatedSessionContext) {
  if (authenticated.session.identityMode === "anonymous" || authenticated.user.identityMode === "anonymous") {
    throw new HttpRouteError(403, "AUTH_REQUIRED", "Video-note jobs require an authenticated Astra account.")
  }
}

function assertLongRunningTaskAccess(authenticated: ValidatedSessionContext) {
  if (authenticated.session.identityMode === "anonymous" || authenticated.user.identityMode === "anonymous") {
    throw new HttpRouteError(403, "AUTH_REQUIRED", "Long-running task lifecycle records require an authenticated Astra account.")
  }
}

async function runLongRunningTaskStoreOperation<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Long-running task store")) {
      throw new HttpRouteError(503, "CONFIG_MISSING", "Long-running task metadata is temporarily unavailable.")
    }
    throw error
  }
}

function isForbiddenMobileRetentionMetadataKey(key: string): boolean {
  const normalized = key.toLowerCase()
  return normalized.includes("text")
    || normalized.includes("snippet")
    || normalized.includes("sentence")
    || normalized.includes("context")
    || normalized.includes("translation")
    || normalized.includes("explanation")
    || normalized.includes("url")
    || normalized.includes("href")
    || normalized.includes("email")
    || normalized.includes("password")
    || normalized.includes("secret")
    || normalized.includes("token")
    || normalized.includes("apikey")
}

function isSafeMobileRetentionMetadataValue(value: unknown): value is string | number | boolean | null {
  if (value == null || typeof value === "boolean") return true
  if (typeof value === "number") return Number.isFinite(value)
  if (typeof value !== "string") return false
  if (value.length > 80) return false
  const normalized = value.toLowerCase()
  if (normalized.includes("secret") || normalized.includes("token")) return false
  if (value.includes("://") || value.includes("/") || value.includes("@")) return false
  return true
}

function sanitizeMobileRetentionMetadata(
  name: z.infer<typeof MobileRetentionEventNameSchema>,
  metadata: Record<string, unknown>,
): Record<string, string | number | boolean | null> {
  const allowedKeys = MOBILE_RETENTION_METADATA_KEYS_BY_EVENT[name]
  const safe: Record<string, string | number | boolean | null> = {}
  for (const [key, value] of Object.entries(metadata)) {
    if (!allowedKeys.has(key)) continue
    if (isForbiddenMobileRetentionMetadataKey(key)) continue
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(key)) continue
    if (!isSafeMobileRetentionMetadataValue(value)) continue
    safe[key] = typeof value === "string" ? value.slice(0, 80) : value
  }
  return safe
}

function sanitizeMobileRetentionUploadEvents(
  events: z.infer<typeof MobileRetentionUploadSchema>["events"],
  now = Date.now(),
): ServerMobileRetentionEventInput[] {
  const oldestAllowed = now - 400 * 24 * 60 * 60 * 1000
  const newestAllowed = now + 24 * 60 * 60 * 1000
  return events.map((event) => {
    if (event.timestamp < oldestAllowed || event.timestamp > newestAllowed) {
      throw new HttpRouteError(400, "INVALID_REQUEST", "Mobile retention event timestamp is out of bounds.")
    }
    return {
      id: event.id,
      name: event.name,
      timestamp: event.timestamp,
      metadata: sanitizeMobileRetentionMetadata(event.name, event.metadata),
    }
  })
}

function assertVideoNoteSourceUrl(sourceUrl: string): void {
  let parsed: URL
  try {
    parsed = new URL(sourceUrl)
  } catch {
    throw new HttpRouteError(400, "INVALID_REQUEST", "Enter a valid absolute video URL, including https://.")
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new HttpRouteError(400, "INVALID_REQUEST", "Only http(s) video URLs are supported.")
  }
}

async function handleAnonymousAuth(
  request: IncomingMessage,
  response: ServerResponse,
  users: FileUserStore,
) {
  const ip = getClientIp(request)
  const body = AnonymousAuthSchema.parse(await readJsonBody(request))
  const installId = body.installId ?? body.deviceId

  if (installId) {
    const existing = await users.findAnonymousUserByInstallId(installId)
    if (existing) {
      const issued = await users.issueBoundSession({
        user: existing,
        device: toDeviceMetadata(body),
        identityMode: existing.identityMode,
      })
      sendJson(response, 200, issued.session)
      return
    }
  }

  if (!checkAnonymousRateLimit(ip)) {
    sendError(response, 429, "Too many anonymous registrations", "QUOTA_EXCEEDED")
    return
  }

  const user = await users.createAnonymousUser(installId)
  const issued = await users.issueBoundSession({
    user,
    device: toDeviceMetadata(body),
    identityMode: "anonymous",
  })
  recordAnonymousCreation(ip)
  sendJson(response, 200, issued.session)
}

async function handleAuthSession(
  request: IncomingMessage,
  response: ServerResponse,
  env: RelayEnv,
  users: FileUserStore,
) {
  if (request.method === "POST") {
    const payload = LoginSchema.parse(await readJsonBody(request))
    const user = await users.validateCredentials(payload.email, payload.password)
    if (!user) {
      sendError(response, 401, "Invalid Astra credentials.", "CONFIG_MISSING")
      return
    }

    const issued = await users.issueBoundSession({
      user,
      device: toDeviceMetadata(payload),
      identityMode: "authenticated",
    })
    sendJson(response, 200, issued.session)
    return
  }

  if (request.method === "GET") {
    const authenticated = await requireAuthenticatedSession(request, env, users, { requireDeviceHeader: true })
    await users.touchSession(authenticated.sessionRecord.sessionId, { seenAt: new Date() })
    sendJson(response, 200, authenticated.session)
    return
  }

  if (request.method === "DELETE") {
    const authenticated = await requireAuthenticatedSession(request, env, users, { requireDeviceHeader: true })
    await users.revokeSession(authenticated.user.email, authenticated.sessionRecord.sessionId)
    response.writeHead(204)
    response.end()
    return
  }

  sendError(response, 405, "Method not allowed.", "INVALID_RESPONSE")
}

async function handleEmailSignInCodeCreate(
  request: IncomingMessage,
  response: ServerResponse,
  env: RelayEnv,
  users: FileUserStore,
) {
  if (request.method !== "POST") {
    sendError(response, 405, "Method not allowed.", "INVALID_RESPONSE")
    return
  }
  const payload = EmailSignInCodeRequestSchema.parse(await readJsonBody(request))
  const email = normalizeEmailSignInAddress(payload.email)
  const now = Date.now()
  const expiresAt = now + EMAIL_SIGN_IN_CODE_TTL_MS
  const requestKey = `${email}:${getEmailSignInRateLimitIp(request)}`
  const withinRateLimit = checkEmailSignInCodeRequestRateLimit(requestKey, now)
  recordEmailSignInCodeRequest(requestKey, now)

  const user = await users.findUserByEmail(email)
  if (!withinRateLimit || !user || user.identityMode !== "authenticated") {
    sendJson(response, 200, buildEmailSignInCodeCreateResponse(env, expiresAt))
    return
  }

  const code = createEmailSignInCode(now)
  if (env.emailSignInCodeDevelopmentEcho) {
    emailSignInCodes.set(code, { userId: user.id, email: user.email, createdAt: now, expiresAt, attempts: 0 })
    sendJson(response, 200, buildEmailSignInCodeCreateResponse(env, expiresAt, code))
    return
  }

  if (isEmailSignInDeliveryConfigured(env)) {
    void deliverEmailSignInCode({ env, email: user.email, code, expiresAt })
      .then((delivered) => {
        if (delivered) {
          emailSignInCodes.set(code, { userId: user.id, email: user.email, createdAt: now, expiresAt, attempts: 0 })
        }
      })
      .catch(() => {
        // Email-code delivery failures intentionally do not alter the generic response.
      })
  }
  sendJson(response, 200, buildEmailSignInCodeCreateResponse(env, expiresAt))
}

async function handleEmailSignInCodeRedeem(
  request: IncomingMessage,
  response: ServerResponse,
  users: FileUserStore,
) {
  if (request.method !== "POST") {
    sendError(response, 405, "Method not allowed.", "INVALID_RESPONSE")
    return
  }
  const payload = EmailSignInCodeRedeemSchema.parse(await readJsonBody(request))
  const code = normalizeMobileLinkCode(payload.code)
  const email = normalizeEmailSignInAddress(payload.email)
  const now = Date.now()
  const redeemKey = `${email}:${getEmailSignInRateLimitIp(request)}`
  const withinRedeemRateLimit = checkEmailSignInCodeRedeemRateLimit(redeemKey, now)
  recordEmailSignInCodeRedeemAttempt(redeemKey, now)
  if (!withinRedeemRateLimit) {
    sendError(response, 404, "Email sign-in code expired or unavailable.", "INVALID_REQUEST")
    return
  }
  purgeExpiredMobileLinkCodes(now)
  const pending = emailSignInCodes.get(code)
  if (!pending) {
    sendError(response, 404, "Email sign-in code expired or unavailable.", "INVALID_REQUEST")
    return
  }
  if (normalizeEmailSignInAddress(pending.email) !== email) {
    pending.attempts += 1
    if (pending.attempts >= EMAIL_SIGN_IN_CODE_MAX_REDEEM_ATTEMPTS) {
      emailSignInCodes.delete(code)
    }
    sendError(response, 404, "Email sign-in code expired or unavailable.", "INVALID_REQUEST")
    return
  }
  emailSignInCodes.delete(code)
  const user = await users.findUserByEmail(pending.email)
  if (!user || user.id !== pending.userId || user.identityMode !== "authenticated") {
    sendError(response, 404, "Email sign-in code expired or unavailable.", "INVALID_REQUEST")
    return
  }
  const issued = await users.issueBoundSession({
    user,
    device: toDeviceMetadata(payload),
    identityMode: "authenticated",
  })
  sendJson(response, 200, issued.session)
}

async function handleMobileLinkCreate(
  request: IncomingMessage,
  response: ServerResponse,
  env: RelayEnv,
  users: FileUserStore,
) {
  if (request.method !== "POST") {
    sendError(response, 405, "Method not allowed.", "INVALID_RESPONSE")
    return
  }

  const authenticated = await requireAuthenticatedSession(request, env, users, { requireDeviceHeader: true })
  if (authenticated.session.identityMode !== "authenticated" || authenticated.user.identityMode !== "authenticated") {
    throw new HttpRouteError(403, "AUTH_REQUIRED", "Mobile link codes require an authenticated Astra account.")
  }

  const now = Date.now()
  const code = createMobileLinkCode(now)
  const expiresAt = now + MOBILE_LINK_CODE_TTL_MS
  mobileLinkCodes.set(code, {
    userId: authenticated.user.id,
    email: authenticated.user.email,
    createdByDeviceId: authenticated.device.deviceId,
    createdAt: now,
    expiresAt,
  })

  sendJson(response, 200, {
    code,
    expiresAt: new Date(expiresAt).toISOString(),
    link: buildMobileLinkUrl(code),
  })
}

async function handleOAuthIdentityRedeem(
  request: IncomingMessage,
  response: ServerResponse,
  env: RelayEnv,
  users: FileUserStore,
) {
  if (request.method !== "POST") {
    sendError(response, 405, "Method not allowed.", "INVALID_RESPONSE")
    return
  }
  const payload = OAuthIdentityRedeemSchema.parse(await readJsonBody(request))
  const identity = payload.idToken
    ? await verifyOAuthIdentityIdToken({
      provider: payload.provider,
      idToken: payload.idToken,
      nonce: payload.nonce,
      env,
    })
    : null

  if (!identity && !isOAuthDevelopmentRedeemAllowed(env)) {
    throw new HttpRouteError(503, "CONFIG_MISSING", "OAuth sign-in is not configured.")
  }

  const user = await users.redeemOAuthIdentity(identity ?? {
    provider: payload.provider,
    subject: payload.subject!,
    email: payload.email,
    emailVerified: payload.emailVerified,
  })
  const issued = await users.issueBoundSession({
    user,
    device: toDeviceMetadata(payload),
    identityMode: "authenticated",
  })
  sendJson(response, 200, issued.session)
}

async function handleMobileLinkRedeem(
  request: IncomingMessage,
  response: ServerResponse,
  users: FileUserStore,
) {
  if (request.method !== "POST") {
    sendError(response, 405, "Method not allowed.", "INVALID_RESPONSE")
    return
  }

  const payload = MobileLinkRedeemSchema.parse(await readJsonBody(request))
  const code = normalizeMobileLinkCode(payload.code)
  if (!code) {
    sendError(response, 400, "Enter a valid mobile link code.", "INVALID_REQUEST")
    return
  }

  const now = Date.now()
  purgeExpiredMobileLinkCodes(now)
  const pending = mobileLinkCodes.get(code)
  if (!pending) {
    sendError(response, 404, "Mobile link code expired or unavailable.", "INVALID_REQUEST")
    return
  }
  mobileLinkCodes.delete(code)

  const user = await users.findUserByEmail(pending.email)
  if (!user || user.id !== pending.userId || user.identityMode !== "authenticated") {
    sendError(response, 404, "Mobile link code expired or unavailable.", "INVALID_REQUEST")
    return
  }

  const issued = await users.issueBoundSession({
    user,
    device: toDeviceMetadata(payload),
    identityMode: "authenticated",
  })
  sendJson(response, 200, issued.session)
}

async function handleMirroredAuthenticatedIssue(
  request: IncomingMessage,
  response: ServerResponse,
  env: RelayEnv,
  users: FileUserStore,
) {
  assertInternalMirrorAuthorized(request, env)
  const payload = MirroredAuthenticatedIssueSchema.parse(
    await readJsonBody(request),
  ) satisfies MirroredAuthenticatedIssueInput

  await users.upsertMirroredAuthenticatedIssue(payload)
  response.writeHead(204)
  response.end()
}

async function handleMirroredAnonymousIssue(
  request: IncomingMessage,
  response: ServerResponse,
  env: RelayEnv,
  users: FileUserStore,
) {
  assertInternalMirrorAuthorized(request, env)
  const payload = MirroredAnonymousIssueSchema.parse(
    await readJsonBody(request),
  ) satisfies MirroredAnonymousIssueInput

  await users.upsertMirroredAnonymousIssue(payload)
  response.writeHead(204)
  response.end()
}

async function handleAccount(
  request: IncomingMessage,
  response: ServerResponse,
  env: RelayEnv,
  users: FileUserStore,
) {
  const authenticated = await requireAuthenticatedSession(request, env, users)
  const account = await users.getAccount(authenticated.claims.email)
  if (!account) {
    throw new AstraError("CONFIG_MISSING", "Unknown Astra user.")
  }

  await users.touchSession(authenticated.sessionRecord.sessionId, { seenAt: new Date() })
  sendJson(response, 200, account)
}

async function handleAccountDelete(
  request: IncomingMessage,
  response: ServerResponse,
  env: RelayEnv,
  users: FileUserStore,
  longTasks: FileLongRunningTaskStore,
) {
  const authenticated = await requireAuthenticatedSession(request, env, users, { requireDeviceHeader: true })
  await runLongRunningTaskStoreOperation(() => longTasks.deleteTasksForOwner(authenticated.user.email))
  const result = await users.deleteAccountFoundation(authenticated.user.email)
  if (!result.found) {
    throw new AstraError("CONFIG_MISSING", "Unknown Astra user.")
  }
  response.writeHead(204)
  response.end()
}

async function handlePlanUpdate(
  request: IncomingMessage,
  response: ServerResponse,
  env: RelayEnv,
  users: FileUserStore,
  auditLog: FileOpsAuditLogStore,
) {
  const payload = PlanUpdateSchema.parse(await readJsonBody(request))

  // Paid entitlement = manual operator grant (no gateway/IAP). A user session may
  // only DOWNGRADE its own plan to "free" (self-cancellation); it can never
  // self-grant a paid plan. Paid (pro/trial) grants require an operator principal
  // and a named target account, so the entitlement cannot be self-served.
  if (payload.plan === "free") {
    if (payload.email) {
      throw new HttpRouteError(400, "INVALID_REQUEST", "A self-serve plan change cannot target another account.")
    }
    const authenticated = await requireAuthenticatedSession(request, env, users)
    const account = await users.updatePlan(authenticated.claims.email, "free")
    if (!account) {
      throw new AstraError("CONFIG_MISSING", "Unknown Astra user.")
    }
    await users.touchSession(authenticated.sessionRecord.sessionId, { seenAt: new Date() })
    sendJson(response, 200, account)
    return
  }

  const principal = await requireOperatorPrincipal(
    request,
    env,
    auditLog,
    "ops_account_plan_updated",
    (role) => isRole(role, ["ops_engineer", "admin"]),
    "account_plan:grant",
  )
  // Paid grants require an explicit operator principal (ASTRA_OPERATOR_TOKENS),
  // NOT the deployment-wide legacy platform mirror secret. The mirror secret may
  // still authorize other ops routes, but minting paid entitlement must be an
  // attributable, per-operator action.
  if (principal.source === "legacy_platform_operator") {
    throw new HttpRouteError(
      403,
      "OPERATOR_PERMISSION_DENIED",
      "Paid plan grants require an explicit operator token (ASTRA_OPERATOR_TOKENS), not the legacy platform mirror secret.",
    )
  }
  const targetEmail = payload.email?.trim().toLowerCase()
  if (!targetEmail) {
    throw new HttpRouteError(400, "INVALID_REQUEST", "Operator plan grants require a target account email.")
  }
  const account = await users.updatePlan(targetEmail, payload.plan)
  if (!account) {
    throw new AstraError("CONFIG_MISSING", "Unknown Astra user.")
  }
  await auditLog.record({
    actor: "operator",
    action: "ops_account_plan_updated",
    operatorToken: principal.token,
    subjectUserId: account.id,
    // Attributable target (hashed, metadata-only — no raw email in the audit log).
    subjectEmailHash: createHash("sha256").update(targetEmail).digest("hex"),
    metadata: operatorAuditMetadata(principal, {
      permission: "account_plan:grant",
      targetPlan: payload.plan,
    }),
    privacy: { contentIncluded: false, contentAccess: "metadata_only" },
  })
  sendJson(response, 200, account)
}

async function handleUsage(
  request: IncomingMessage,
  response: ServerResponse,
  env: RelayEnv,
  users: FileUserStore,
) {
  const authenticated = await requireAuthenticatedSession(request, env, users)
  const usage = await users.getUsageSnapshot(authenticated.claims.email)
  if (!usage) {
    throw new AstraError("CONFIG_MISSING", "Unknown Astra user.")
  }

  await users.touchSession(authenticated.sessionRecord.sessionId, { seenAt: new Date() })
  sendJson(response, 200, usage)
}

async function handleAccountSummary(
  request: IncomingMessage,
  response: ServerResponse,
  env: RelayEnv,
  users: FileUserStore,
) {
  const authenticated = await requireAuthenticatedSession(request, env, users, { requireDeviceHeader: true })
  const summary = await users.getAccountSummary({
    email: authenticated.claims.email,
    currentDeviceId: authenticated.device.deviceId,
    currentSessionId: authenticated.sessionRecord.sessionId,
  })
  if (!summary) {
    throw new AstraError("CONFIG_MISSING", "Unknown Astra user.")
  }

  await users.touchSession(authenticated.sessionRecord.sessionId, { seenAt: new Date() })
  sendJson(response, 200, summary)
}

async function handleAccountExport(
  request: IncomingMessage,
  response: ServerResponse,
  env: RelayEnv,
  users: FileUserStore,
) {
  const authenticated = await requireAuthenticatedSession(request, env, users, { requireDeviceHeader: true })
  if (authenticated.session.identityMode !== "authenticated" || authenticated.user.identityMode !== "authenticated") {
    throw new HttpRouteError(403, "AUTH_REQUIRED", "Account data export requires an authenticated Astra account.")
  }
  const exported = await users.exportAccountData({
    email: authenticated.claims.email,
    currentDeviceId: authenticated.device.deviceId,
    currentSessionId: authenticated.sessionRecord.sessionId,
  })
  if (!exported) {
    throw new AstraError("CONFIG_MISSING", "Unknown Astra user.")
  }

  await users.touchSession(authenticated.sessionRecord.sessionId, { seenAt: new Date() })
  response.setHeader("Cache-Control", "no-store")
  response.setHeader("Pragma", "no-cache")
  sendJson(response, 200, exported)
}

async function handleCloudLearningMemoryInventory(
  request: IncomingMessage,
  response: ServerResponse,
  env: RelayEnv,
  users: FileUserStore,
) {
  const authenticated = await requireAuthenticatedSession(request, env, users, { requireDeviceHeader: true })
  if (authenticated.session.identityMode !== "authenticated" || authenticated.user.identityMode !== "authenticated") {
    throw new HttpRouteError(403, "AUTH_REQUIRED", "Cloud learning-memory inventory requires an authenticated Astra account.")
  }
  const inventory = await users.getCloudLearningMemoryInventory({
    email: authenticated.claims.email,
  })
  if (!inventory) {
    throw new AstraError("CONFIG_MISSING", "Unknown Astra user.")
  }

  await users.touchSession(authenticated.sessionRecord.sessionId, { seenAt: new Date() })
  response.setHeader("Cache-Control", "no-store")
  response.setHeader("Pragma", "no-cache")
  sendJson(response, 200, inventory)
}

async function handleCloudLearningMemoryDelete(
  request: IncomingMessage,
  response: ServerResponse,
  env: RelayEnv,
  users: FileUserStore,
) {
  const authenticated = await requireAuthenticatedSession(request, env, users, { requireDeviceHeader: true })
  if (authenticated.session.identityMode !== "authenticated" || authenticated.user.identityMode !== "authenticated") {
    throw new HttpRouteError(403, "AUTH_REQUIRED", "Cloud learning-memory deletion requires an authenticated Astra account.")
  }
  const receipt = await users.deleteCloudLearningMemory({
    email: authenticated.claims.email,
  })
  if (!receipt) {
    throw new AstraError("CONFIG_MISSING", "Unknown Astra user.")
  }

  await users.touchSession(authenticated.sessionRecord.sessionId, { seenAt: new Date() })
  response.setHeader("Cache-Control", "no-store")
  response.setHeader("Pragma", "no-cache")
  sendJson(response, 200, receipt)
}

async function handleMobileRetentionEventsUpload(
  request: IncomingMessage,
  response: ServerResponse,
  env: RelayEnv,
  users: FileUserStore,
) {
  if (request.method !== "POST") {
    sendError(response, 405, "Method not allowed.", "INVALID_RESPONSE")
    return
  }
  const authenticated = await requireAuthenticatedSession(request, env, users, { requireDeviceHeader: true })
  if (authenticated.session.identityMode !== "authenticated" || authenticated.user.identityMode !== "authenticated") {
    throw new HttpRouteError(403, "AUTH_REQUIRED", "Mobile retention upload requires an authenticated Astra account.")
  }

  const payload = MobileRetentionUploadSchema.parse(await readJsonBody(request))
  const result = await users.recordMobileRetentionEvents({
    email: authenticated.user.email,
    deviceId: authenticated.device.deviceId,
    events: sanitizeMobileRetentionUploadEvents(payload.events),
  })
  await users.touchSession(authenticated.sessionRecord.sessionId, { seenAt: new Date() })
  sendJson(response, 200, result)
}

async function handleAnalyticsEvents(
  request: IncomingMessage,
  response: ServerResponse,
  env: RelayEnv,
  users: FileUserStore,
  analyticsEvents: FileAnalyticsEventStore,
  limit: string | null = null,
) {
  const authenticated = await requireAuthenticatedSession(request, env, users, { requireDeviceHeader: true })
  if (authenticated.session.identityMode !== "authenticated" || authenticated.user.identityMode !== "authenticated") {
    throw new HttpRouteError(403, "AUTH_REQUIRED", "Analytics events require an authenticated Astra account.")
  }

  if (request.method === "POST") {
    const payload = AnalyticsEventsUploadSchema.parse(await readJsonBody(request))
    const result = await analyticsEvents.ingestForUser({
      userId: authenticated.user.id,
      email: authenticated.user.email,
      events: payload.events,
    })
    await users.touchSession(authenticated.sessionRecord.sessionId, { seenAt: new Date() })
    sendJson(response, 200, {
      schema: "astra-analytics-events-ingest-result.v1",
      acceptedCount: result.acceptedCount,
      events: result.events.map(({ ownerUserId: _ownerUserId, ownerEmailHash: _ownerEmailHash, ...event }) => event),
      serverTime: result.serverTime,
      privacy: { metadataOnly: true, rawContentIncluded: false, identifiersIncluded: false },
    })
    return
  }

  const parsedLimit = limit ? Number.parseInt(limit, 10) : 100
  const events = await analyticsEvents.listForUser(authenticated.user.id, { limit: Number.isFinite(parsedLimit) ? parsedLimit : 100 })
  await users.touchSession(authenticated.sessionRecord.sessionId, { seenAt: new Date() })
  sendJson(response, 200, {
    schema: "astra-analytics-events-list.v1",
    events: events.map(({ ownerUserId: _ownerUserId, ownerEmailHash: _ownerEmailHash, ...event }) => event),
    privacy: { metadataOnly: true, rawContentIncluded: false, identifiersIncluded: false },
  })
}

function parseWeeklyDigestNow(request: IncomingMessage): Date {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`)
  const nowParam = url.searchParams.get("now")
  const now = nowParam ? new Date(nowParam) : new Date()
  if (!Number.isFinite(now.getTime())) {
    throw new HttpRouteError(400, "INVALID_REQUEST", "Invalid weekly digest timestamp.")
  }
  return now
}

async function handleWeeklyDigest(
  request: IncomingMessage,
  response: ServerResponse,
  env: RelayEnv,
  users: FileUserStore,
) {
  const authenticated = await requireAuthenticatedSession(request, env, users, { requireDeviceHeader: true })
  const digest = await users.getWeeklyDigest(authenticated.claims.email, parseWeeklyDigestNow(request))
  if (!digest) {
    throw new AstraError("CONFIG_MISSING", "Unknown Astra user.")
  }

  await users.touchSession(authenticated.sessionRecord.sessionId, { seenAt: new Date() })
  sendJson(response, 200, digest)
}

async function handleWeeklyDigestPreference(
  request: IncomingMessage,
  response: ServerResponse,
  env: RelayEnv,
  users: FileUserStore,
) {
  const authenticated = await requireAuthenticatedSession(request, env, users, { requireDeviceHeader: true })
  if (authenticated.session.identityMode !== "authenticated" || authenticated.user.identityMode !== "authenticated") {
    throw new HttpRouteError(403, "AUTH_REQUIRED", "Weekly digest preferences require an authenticated Astra account.")
  }

  const payload = WeeklyDigestPreferenceSchema.parse(await readJsonBody(request))
  const preferences = await users.updateWeeklyDigestPreference(authenticated.user.email, payload.enabled)
  if (!preferences) {
    throw new AstraError("CONFIG_MISSING", "Unknown Astra user.")
  }

  const now = new Date()
  await users.touchSession(authenticated.sessionRecord.sessionId, { seenAt: now })
  sendJson(response, 200, {
    preference: {
      weekly_digest: preferences.weekly_digest,
    },
    serverTime: now.toISOString(),
  })
}

async function handleCurrentDevicePushToken(
  request: IncomingMessage,
  response: ServerResponse,
  env: RelayEnv,
  users: FileUserStore,
) {
  const authenticated = await requireAuthenticatedSession(request, env, users, { requireDeviceHeader: true })
  if (authenticated.session.identityMode !== "authenticated" || authenticated.user.identityMode !== "authenticated") {
    throw new HttpRouteError(403, "AUTH_REQUIRED", "Device notification settings require an authenticated Astra account.")
  }

  const payload = DevicePushTokenSchema.parse(await readJsonBody(request))
  const now = new Date()
  const device = await users.updateCurrentDevicePushToken({
    email: authenticated.user.email,
    deviceId: authenticated.device.deviceId,
    expoPushToken: payload.expoPushToken,
    platform: payload.platform,
    now,
  })
  if (!device) {
    throw new HttpRouteError(404, "DEVICE_REQUIRED", "Current device was not found.")
  }

  await users.touchSession(authenticated.sessionRecord.sessionId, { seenAt: now })
  sendJson(response, 200, {
    deviceId: device.deviceId,
    pushTokenStored: Boolean(device.expoPushToken),
    serverTime: now.toISOString(),
  })
}

async function handleWeeklyDigestEmail(
  request: IncomingMessage,
  response: ServerResponse,
  env: RelayEnv,
  users: FileUserStore,
) {
  const authenticated = await requireAuthenticatedSession(request, env, users, { requireDeviceHeader: true })
  const digest = await users.getWeeklyDigest(authenticated.claims.email, parseWeeklyDigestNow(request))
  if (!digest) {
    throw new AstraError("CONFIG_MISSING", "Unknown Astra user.")
  }

  await users.touchSession(authenticated.sessionRecord.sessionId, { seenAt: new Date() })
  if (!isEmailDeliveryConfigured(env)) {
    sendJson(response, 200, { delivery: "unavailable", digest })
    return
  }

  const delivered = await deliverWeeklyDigestEmail({ env, email: authenticated.user.email, digest })
  if (!delivered) {
    throw new HttpRouteError(502, "PROVIDER_UNAVAILABLE", "Weekly digest email could not be sent.")
  }
  sendJson(response, 200, { delivery: "email", digest })
}

async function handleOpsWeeklyDigestPushDeliveryRun(
  request: IncomingMessage,
  response: ServerResponse,
  env: RelayEnv,
  users: FileUserStore,
  auditLog: FileOpsAuditLogStore,
) {
  const principal = await requireOperatorPrincipal(
    request,
    env,
    auditLog,
    "ops_weekly_digest_delivery_run",
    (role) => isRole(role, ["ops_engineer", "admin"]),
    "weekly_digest_push_delivery:run",
  )
  const payload = WeeklyDigestDeliveryRunSchema.parse(await readJsonBody(request))
  const now = payload.now ? new Date(payload.now) : new Date()
  if (!Number.isFinite(now.getTime())) {
    throw new HttpRouteError(400, "INVALID_REQUEST", "Invalid weekly digest delivery timestamp.")
  }

  const recipients = await users.listWeeklyDigestPushRecipients(payload.limit)
  const result: WeeklyDigestPushDeliveryRunResult = {
    schema: "astra-weekly-digest-push-delivery-run.v1",
    generatedAt: now.toISOString(),
    dryRun: payload.dryRun,
    consideredCount: recipients.length,
    deliveredCount: 0,
    failedCount: 0,
    results: [],
  }

  for (const recipient of recipients) {
    const baseResult = {
      userId: recipient.userId,
      emailHash: buildOpsEmailHash(recipient.email),
      deviceIdHash: buildOpsDeviceIdHash(recipient.deviceId),
    }
    if (payload.dryRun) {
      result.results.push({ ...baseResult, digestId: null, delivery: "dry_run" })
      continue
    }

    const digest = await users.getWeeklyDigest(recipient.email, now, { archive: true })
    if (!digest) {
      result.failedCount += 1
      result.results.push({ ...baseResult, digestId: null, delivery: "failed" })
      continue
    }

    const delivered = await deliverWeeklyDigestPush({ expoPushToken: recipient.expoPushToken, digest })
    if (delivered) {
      result.deliveredCount += 1
      result.results.push({ ...baseResult, digestId: digest.digestId, delivery: "push" })
    } else {
      result.failedCount += 1
      result.results.push({ ...baseResult, digestId: digest.digestId, delivery: "failed" })
    }
  }

  await auditLog.record({
    actor: "operator",
    action: "ops_weekly_digest_delivery_run",
    operatorToken: principal.token,
    metadata: operatorAuditMetadata(principal, {
      channel: "push",
      dryRun: result.dryRun,
      consideredCount: result.consideredCount,
      deliveredCount: result.deliveredCount,
      failedCount: result.failedCount,
    }),
    privacy: { contentIncluded: false, contentAccess: "metadata_only" },
  })

  sendJson(response, 200, result)
}

async function handleOpsWeeklyDigestDeliveryRun(
  request: IncomingMessage,
  response: ServerResponse,
  env: RelayEnv,
  users: FileUserStore,
  auditLog: FileOpsAuditLogStore,
) {
  const principal = await requireOperatorPrincipal(
    request,
    env,
    auditLog,
    "ops_weekly_digest_delivery_run",
    (role) => isRole(role, ["ops_engineer", "admin"]),
    "weekly_digest_delivery:run",
  )
  const payload = WeeklyDigestDeliveryRunSchema.parse(await readJsonBody(request))
  const now = payload.now ? new Date(payload.now) : new Date()
  if (!Number.isFinite(now.getTime())) {
    throw new HttpRouteError(400, "INVALID_REQUEST", "Invalid weekly digest delivery timestamp.")
  }

  const emailConfigured = isEmailDeliveryConfigured(env)
  const recipients = await users.listWeeklyDigestRecipients(payload.limit)
  const result: WeeklyDigestDeliveryRunResult = {
    schema: "astra-weekly-digest-delivery-run.v1",
    generatedAt: now.toISOString(),
    dryRun: payload.dryRun,
    emailConfigured,
    consideredCount: recipients.length,
    deliveredCount: 0,
    unavailableCount: 0,
    failedCount: 0,
    results: [],
  }

  for (const recipient of recipients) {
    const digest = await users.getWeeklyDigest(recipient.email, now, { archive: !payload.dryRun })
    const baseResult = {
      userId: recipient.userId,
      emailHash: buildOpsEmailHash(recipient.email),
      digestId: digest?.digestId ?? null,
    }
    if (!digest) {
      result.failedCount += 1
      result.results.push({ ...baseResult, delivery: "failed" })
      continue
    }
    if (payload.dryRun) {
      result.results.push({ ...baseResult, delivery: "dry_run" })
      continue
    }
    if (!emailConfigured) {
      result.unavailableCount += 1
      result.results.push({ ...baseResult, delivery: "unavailable" })
      continue
    }
    const delivered = await deliverWeeklyDigestEmail({ env, email: recipient.email, digest })
    if (delivered) {
      result.deliveredCount += 1
      result.results.push({ ...baseResult, delivery: "email" })
    } else {
      result.failedCount += 1
      result.results.push({ ...baseResult, delivery: "failed" })
    }
  }

  await auditLog.record({
    actor: "operator",
    action: "ops_weekly_digest_delivery_run",
    operatorToken: principal.token,
    metadata: operatorAuditMetadata(principal, {
      channel: "email",
      dryRun: result.dryRun,
      emailConfigured: result.emailConfigured,
      consideredCount: result.consideredCount,
      deliveredCount: result.deliveredCount,
      unavailableCount: result.unavailableCount,
      failedCount: result.failedCount,
    }),
    privacy: { contentIncluded: false, contentAccess: "metadata_only" },
  })

  sendJson(response, 200, result)
}

async function handleOpsWeeklyDigestDeliverySummaryGet(
  request: IncomingMessage,
  response: ServerResponse,
  env: RelayEnv,
  auditLog: FileOpsAuditLogStore,
) {
  const principal = await requireOperatorPrincipal(
    request,
    env,
    auditLog,
    "ops_weekly_digest_delivery_summary_viewed",
    (role) => isRole(role, ["ops_engineer", "admin"]),
    "weekly_digest_delivery:summary",
  )
  const summary = await auditLog.summarizeWeeklyDigestDelivery()
  await auditLog.record({
    actor: "operator",
    action: "ops_weekly_digest_delivery_summary_viewed",
    operatorToken: principal.token,
    metadata: operatorAuditMetadata(principal, {
      totalRuns: summary.totalRuns,
      channelCount: summary.byChannel.length,
      recentRunCount: summary.recentRuns.length,
    }),
    privacy: { contentIncluded: false, contentAccess: "metadata_only" },
  })
  sendJson(response, 200, summary)
}

async function findLatestTrialIntentAt(
  analyticsEvents: FileAnalyticsEventStore,
  userId: string,
): Promise<string | null> {
  const events = await analyticsEvents.listForUser(userId, { limit: 100 })
  return events.find((event) => event.name === "trial_intent_recorded")?.timestamp ?? null
}

async function handleTrialIntent(
  request: IncomingMessage,
  response: ServerResponse,
  env: RelayEnv,
  users: FileUserStore,
  analyticsEvents: FileAnalyticsEventStore,
) {
  const authenticated = await requireAuthenticatedSession(request, env, users, { requireDeviceHeader: true })
  if (authenticated.session.identityMode !== "authenticated" || authenticated.user.identityMode !== "authenticated") {
    throw new HttpRouteError(403, "AUTH_REQUIRED", "Trial intent requires an authenticated Astra account.")
  }

  let intentRecordedAt = await findLatestTrialIntentAt(analyticsEvents, authenticated.user.id)
  if (request.method === "POST" && !intentRecordedAt) {
    const result = await analyticsEvents.ingestForUser({
      userId: authenticated.user.id,
      email: authenticated.user.email,
      events: [{
        eventId: `trial-intent:${authenticated.user.id}`,
        name: "trial_intent_recorded",
        properties: {
          plan: authenticated.user.plan,
          sourceType: "web",
          outcome: "success",
          flags: {
            billingUnavailable: true,
            paymentCollected: false,
            subscriptionMutation: false,
            proEntitlementGranted: false,
            trialEntitlementGranted: false,
          },
        },
      }],
    })
    intentRecordedAt = result.events[0]?.timestamp ?? new Date().toISOString()
  }

  await users.touchSession(authenticated.sessionRecord.sessionId, { seenAt: new Date() })
  sendJson(response, 200, createBetaTrialLifecycleContract(authenticated.user, { intentRecordedAt }))
}

async function handleBillingCheckout(
  request: IncomingMessage,
  response: ServerResponse,
  env: RelayEnv,
  users: FileUserStore,
) {
  const authenticated = await requireAuthenticatedSession(request, env, users)
  const payload = BillingCheckoutSchema.parse(await readJsonBody(request))
  const user = await users.findUserByEmail(authenticated.claims.email)
  if (!user) {
    throw new AstraError("CONFIG_MISSING", "Unknown Astra user.")
  }

  await users.touchSession(authenticated.sessionRecord.sessionId, { seenAt: new Date() })
  sendJson(response, 200, createCheckoutLink(user, env, payload.plan))
}

async function handleBillingPortal(
  request: IncomingMessage,
  response: ServerResponse,
  env: RelayEnv,
  users: FileUserStore,
) {
  const authenticated = await requireAuthenticatedSession(request, env, users)
  const user = await users.findUserByEmail(authenticated.claims.email)
  if (!user) {
    throw new AstraError("CONFIG_MISSING", "Unknown Astra user.")
  }

  await users.touchSession(authenticated.sessionRecord.sessionId, { seenAt: new Date() })
  sendJson(response, 200, createPortalLink(user, env))
}

function getContentLengthBucket(characterCount: number): ServerUsageEventMetadata["contentLengthBucket"] {
  if (characterCount <= 0) return "unknown"
  if (characterCount <= 500) return "short"
  if (characterCount <= 2_000) return "medium"
  if (characterCount <= 10_000) return "long"
  return "very_long"
}

function getFallbackReasonForServerError(error: unknown): ServerUsageEventMetadata["fallbackReason"] {
  if (error instanceof AstraError) {
    if (error.code === "QUOTA_EXCEEDED") return "cost"
    if (error.code === "CONTENT_UNAVAILABLE") return "length"
    if (error.code === "PROVIDER_PARSE_FAILED" || error.code === "INVALID_RESPONSE") return "quality"
    if (error.code === "PROVIDER_REQUEST_FAILED") {
      return /timeout|abort/i.test(error.message) ? "timeout" : "outage"
    }
  }
  if (error instanceof Error) {
    if (/timeout|abort/i.test(error.message)) return "timeout"
    if (/fetch|network|socket|dns|tls|ssl|connect|econn|enotfound/i.test(error.message)) return "outage"
  }
  return "unknown"
}

function getPlannedManagedProviderRoute(payload: ResolvedRelayTranslateRequest, env: RelayEnv): ManagedProviderRoute {
  return env.useOpenRouter && Boolean(env.openrouterApiKey) && payload.provider !== "google_translate" ? "openrouter" : "direct"
}

function buildServerUsageMetadata(params: {
  payload: ResolvedRelayTranslateRequest
  sessionPlan?: string | null
  characterCount: number
  durationMs?: number
  providerMetadata?: ManagedProviderMetadata | null
  plannedProviderRoute?: ManagedProviderRoute
  success: boolean
  error?: unknown
  omitModel?: boolean
}): ServerUsageEventMetadata {
  const task = params.payload.task ?? "translate"
  const surface: ServerUsageEventMetadata["surface"] = task === "custom" ? "writing" : "page"
  const taskClass = getTaskClassForTranslationRequest({
    task,
    surface,
    characterCount: params.characterCount,
    maxTextLength: Math.max(...params.payload.texts.map((text) => text.length), 0),
  })
  const fallbackReason = params.providerMetadata?.fallbackReason ?? (params.success ? "none" : getFallbackReasonForServerError(params.error))
  return {
    model: params.omitModel ? undefined : params.providerMetadata?.model ?? params.payload.model,
    task,
    textCount: params.payload.texts.length,
    durationMs: typeof params.durationMs === "number" && Number.isFinite(params.durationMs)
      ? Math.max(0, Math.round(params.durationMs))
      : undefined,
    taskClass,
    costBucket: getCostBucketForTask(taskClass),
    latencyBucket: getLatencyBucket(params.durationMs),
    cacheStatus: "disabled",
    fallbackReason,
    tier: normalizeOperatingTier(params.sessionPlan),
    surface,
    contentLengthBucket: getContentLengthBucket(params.characterCount),
    providerRoute: params.providerMetadata?.finalRoute ?? params.plannedProviderRoute,
    fallbackUsed: params.providerMetadata?.fallbackUsed ?? fallbackReason !== "none",
    success: params.success,
    ...(params.error instanceof AstraError ? { errorCode: params.error.code } : {}),
  }
}

type RuntimeKillSwitchRule = RemoteFeatureFlagRuntime["killSwitches"][number]

interface RuntimeKillSwitchContext {
  featureKey?: RuntimeKillSwitchRule["featureKey"]
  taskClass?: RuntimeKillSwitchRule["taskClass"]
  tier?: RuntimeKillSwitchRule["tier"]
  providerId?: RuntimeKillSwitchRule["providerId"]
  surface?: RuntimeKillSwitchRule["surface"]
}

function runtimeKillSwitchMatches(rule: RuntimeKillSwitchRule, context: RuntimeKillSwitchContext): boolean {
  if (!rule.enabled) return false
  if (context.featureKey && rule.featureKey !== context.featureKey) return false
  if (rule.featureKey && rule.featureKey !== context.featureKey) return false
  if (rule.taskClass && rule.taskClass !== context.taskClass) return false
  if (rule.tier && rule.tier !== context.tier) return false
  if (rule.providerId && rule.providerId !== context.providerId) return false
  if (rule.surface && rule.surface !== context.surface) return false
  return true
}

function findRuntimeKillSwitch(
  rules: readonly RuntimeKillSwitchRule[],
  context: RuntimeKillSwitchContext,
): RuntimeKillSwitchRule | null {
  return rules.find((rule) => runtimeKillSwitchMatches(rule, context)) ?? null
}

function buildManagedAiKillSwitchContext(params: {
  featureKey: NonNullable<RuntimeKillSwitchRule["featureKey"]>
  metadata: ServerUsageEventMetadata
  providerId: RuntimeKillSwitchRule["providerId"]
}): RuntimeKillSwitchContext {
  return {
    featureKey: params.featureKey,
    taskClass: params.metadata.taskClass,
    tier: params.metadata.tier,
    providerId: params.providerId,
    surface: params.metadata.surface,
  }
}

function sanitizeRuntimeKillSwitchMessage(message: string | null | undefined): string {
  const trimmed = message?.trim()
  if (!trimmed) return "Astra is temporarily limiting this request. Please try again later."
  return trimmed.replace(/\b(openai|gemini|google_translate|openrouter|gpt[-\w.]*|claude[-\w.]*)\b/gi, "Astra AI")
}

function createRuntimeKillSwitchError(rule: RuntimeKillSwitchRule): AstraError {
  return new AstraError("SITE_DISABLED", sanitizeRuntimeKillSwitchMessage(rule.fallbackMessage))
}

async function recordRuntimeKillSwitchDecisionFailure(params: {
  users: FileUserStore
  email: string
  payload: ResolvedRelayTranslateRequest
  sessionPlan?: string | null
  characterCount: number
  plannedProviderRoute: ManagedProviderRoute
  error: AstraError
}) {
  const metadata = buildServerUsageMetadata({
    payload: params.payload,
    sessionPlan: params.sessionPlan,
    characterCount: params.characterCount,
    plannedProviderRoute: params.plannedProviderRoute,
    success: false,
    error: params.error,
    omitModel: true,
  })
  await params.users.recordTranslationDecisionFailure({
    email: params.email,
    provider: params.payload.provider,
    serviceMode: params.payload.serviceMode ?? "automatic",
    characterCount: params.characterCount,
    metadata,
  }).catch(() => {})
}

async function handleTranslate(
  request: IncomingMessage,
  response: ServerResponse,
  env: RelayEnv,
  users: FileUserStore,
  featureFlags: FileFeatureFlagRuntimeStore,
) {
  const authenticated = await requireAuthenticatedSession(request, env, users)
  const payload = TranslateSchema.parse(await readJsonBody(request))
  const session = await users.getSession(authenticated.claims.email, authenticated.token)
  if (!session) {
    throw new AstraError("CONFIG_MISSING", "Unknown Astra user.")
  }
  const initialScheduledPayload = resolveManagedTranslationRequest(payload, { entitlements: session.providerEntitlements })
  assertProviderEntitlement(initialScheduledPayload.provider, session.providerEntitlements)
  const characterCount = payload.texts.reduce((sum, text) => sum + text.length, 0)
  const initialPlannedProviderRoute = getPlannedManagedProviderRoute(initialScheduledPayload, env)
  const initialUsageMetadata = buildServerUsageMetadata({
    payload: initialScheduledPayload,
    sessionPlan: session.plan,
    characterCount,
    plannedProviderRoute: initialPlannedProviderRoute,
    success: true,
  })
  const runtime = await featureFlags.getRuntime()
  const runtimeRules = runtime.killSwitches
  const hardBlockRule = findRuntimeKillSwitch(
    runtimeRules,
    buildManagedAiKillSwitchContext({
      featureKey: "emergency.disable_managed_ai",
      metadata: initialUsageMetadata,
      providerId: initialScheduledPayload.provider,
    }),
  ) ?? findRuntimeKillSwitch(
    runtimeRules,
    buildManagedAiKillSwitchContext({
      featureKey: "emergency.disable_task_class",
      metadata: initialUsageMetadata,
      providerId: initialScheduledPayload.provider,
    }),
  ) ?? (initialUsageMetadata.tier === "free" && initialUsageMetadata.taskClass && isHighCostTask(initialUsageMetadata.taskClass)
    ? findRuntimeKillSwitch(
        runtimeRules,
        buildManagedAiKillSwitchContext({
          featureKey: "emergency.limit_free_high_cost",
          metadata: initialUsageMetadata,
          providerId: initialScheduledPayload.provider,
        }),
      )
    : null)
  if (hardBlockRule) {
    const error = createRuntimeKillSwitchError(hardBlockRule)
    await recordRuntimeKillSwitchDecisionFailure({
      users,
      email: authenticated.claims.email,
      payload: initialScheduledPayload,
      sessionPlan: session.plan,
      characterCount,
      plannedProviderRoute: initialPlannedProviderRoute,
      error,
    })
    throw error
  }

  const providerHealthSummary = await users.summarizeProviderHealth()
  const providerHealthMitigation = recommendProviderHealthMitigation({
    summary: providerHealthSummary,
    scheduledPayload: initialScheduledPayload,
    entitlements: session.providerEntitlements,
    taskClass: initialUsageMetadata.taskClass,
    requestedProvider: payload.provider,
  })
  const fastModeRule = findRuntimeKillSwitch(
    runtimeRules,
    buildManagedAiKillSwitchContext({
      featureKey: "emergency.force_fast_mode",
      metadata: initialUsageMetadata,
      providerId: initialScheduledPayload.provider,
    }),
  )
  const scheduledPayload: ResolvedRelayTranslateRequest = fastModeRule?.safeMode
    ? { ...initialScheduledPayload, serviceMode: "fast" }
    : providerHealthMitigation.action !== "none"
      ? {
          ...initialScheduledPayload,
          provider: providerHealthMitigation.provider,
          model: providerHealthMitigation.model,
          serviceMode: providerHealthMitigation.serviceMode,
        }
      : initialScheduledPayload
  assertProviderEntitlement(scheduledPayload.provider, session.providerEntitlements)
  const plannedProviderRoute = getPlannedManagedProviderRoute(scheduledPayload, env)
  const plannedUsageMetadata = scheduledPayload === initialScheduledPayload
    ? initialUsageMetadata
    : buildServerUsageMetadata({
        payload: scheduledPayload,
        sessionPlan: session.plan,
        characterCount,
        plannedProviderRoute,
        success: true,
      })
  await users.assertCanTranslate({
    email: authenticated.claims.email,
    characterCount,
    taskClass: plannedUsageMetadata.taskClass,
  })

  const startedAt = Date.now()
  try {
    const result = await translateViaManagedProviderDetailed(scheduledPayload, env)
    const providerMetadata: ManagedProviderMetadata = providerHealthMitigation.action !== "none" && !fastModeRule?.safeMode
      ? {
          ...result.metadata,
          provider: scheduledPayload.provider,
          model: scheduledPayload.model,
          serviceMode: scheduledPayload.serviceMode ?? "automatic",
          fallbackUsed: true,
          fallbackReason: providerHealthMitigation.fallbackReason,
        }
      : result.metadata
    await users.recordTranslationUsage({
      email: authenticated.claims.email,
      provider: scheduledPayload.provider,
      serviceMode: providerMetadata.serviceMode ?? scheduledPayload.serviceMode ?? "automatic",
      characterCount,
      metadata: buildServerUsageMetadata({
        payload: scheduledPayload,
        sessionPlan: session.plan,
        characterCount,
        durationMs: Date.now() - startedAt,
        providerMetadata,
        plannedProviderRoute,
        success: true,
      }),
    })
    await users.touchSession(authenticated.sessionRecord.sessionId, { seenAt: new Date() })
    sendJson(response, 200, { translations: result.translations })
  } catch (error) {
    await users.recordTranslationDecisionFailure({
      email: authenticated.claims.email,
      provider: scheduledPayload.provider,
      serviceMode: scheduledPayload.serviceMode ?? "automatic",
      characterCount,
      metadata: buildServerUsageMetadata({
        payload: scheduledPayload,
        sessionPlan: session.plan,
        characterCount,
        durationMs: Date.now() - startedAt,
        plannedProviderRoute,
        success: false,
        error,
      }),
    }).catch(() => {})
    throw error
  }
}

async function handleArticleImport(
  request: IncomingMessage,
  response: ServerResponse,
) {
  const payload = ArticleImportSchema.parse(await readJsonBody(request))
  const articleUrl = normalizeImportedArticleUrl(payload.url)
  const { response: upstream, finalUrl } = await fetchImportedArticleUpstream(articleUrl)

  if (!upstream.ok) {
    throw new HttpRouteError(
      400,
      "CONTENT_UNAVAILABLE",
      `Article import failed with status ${upstream.status}.`,
    )
  }

  const contentType = upstream.headers.get("content-type") ?? ""
  if (contentType && !/html|xhtml/i.test(contentType)) {
    throw new HttpRouteError(400, "CONTENT_UNAVAILABLE", "The imported URL did not return an HTML document.")
  }

  const contentLength = Number.parseInt(upstream.headers.get("content-length") ?? "", 10)
  if (Number.isFinite(contentLength) && contentLength > MAX_IMPORTED_ARTICLE_BYTES) {
    throw new HttpRouteError(400, "CONTENT_UNAVAILABLE", "The imported page is too large to process safely.")
  }

  const html = await upstream.text()
  if (Buffer.byteLength(html, "utf8") > MAX_IMPORTED_ARTICLE_BYTES) {
    throw new HttpRouteError(400, "CONTENT_UNAVAILABLE", "The imported page is too large to process safely.")
  }

  const dom = new JSDOM(html, { url: finalUrl.toString() })
  const doc = dom.window.document
  const globalScope = globalThis as typeof globalThis & {
    HTMLElement?: typeof dom.window.HTMLElement
    Node?: typeof dom.window.Node
    getComputedStyle?: typeof dom.window.getComputedStyle
  }
  const previousGlobals = {
    HTMLElement: globalScope.HTMLElement,
    Node: globalScope.Node,
    getComputedStyle: globalScope.getComputedStyle,
  }

  try {
    globalScope.HTMLElement = dom.window.HTMLElement
    globalScope.Node = dom.window.Node
    globalScope.getComputedStyle = dom.window.getComputedStyle.bind(dom.window)

    const plan = resolveExtractionPlan(doc, "article")
    const blocks = plan.blocks
      .map((block) => block.text.trim())
      .filter(Boolean)

    if (blocks.length === 0) {
      throw new HttpRouteError(
        400,
        "CONTENT_UNAVAILABLE",
        "The imported URL did not expose readable article text after relay extraction.",
      )
    }

    const metadata = extractReadableDocumentMetadata(doc, finalUrl.toString())
    sendJson(response, 200, {
      url: finalUrl.toString(),
      title: metadata.title,
      hostname: finalUrl.hostname,
      byline: metadata.byline,
      scope: plan.scope,
      summary: plan.summary,
      blocks,
    })
  } finally {
    globalScope.HTMLElement = previousGlobals.HTMLElement
    globalScope.Node = previousGlobals.Node
    globalScope.getComputedStyle = previousGlobals.getComputedStyle
  }
}

async function handleVideoNoteCreate(
  request: IncomingMessage,
  response: ServerResponse,
  env: RelayEnv,
  users: FileUserStore,
  videoNotes: VideoNoteService,
) {
  const authenticated = await requireAuthenticatedSession(request, env, users)
  assertVideoNoteAccess(authenticated)
  const payload = VideoNoteCreateRequestSchema.parse(await readJsonBody(request))
  assertVideoNoteSourceUrl(payload.sourceUrl)
  const result = await videoNotes.createJob(authenticated.user.email, payload)
  await users.touchSession(authenticated.sessionRecord.sessionId, { seenAt: new Date() })
  sendJson(response, 202, VideoNoteCreateResponseSchema.parse(result))
}

async function handleLongRunningTaskCreate(
  request: IncomingMessage,
  response: ServerResponse,
  env: RelayEnv,
  users: FileUserStore,
  longTasks: FileLongRunningTaskStore,
) {
  const authenticated = await requireAuthenticatedSession(request, env, users, { requireDeviceHeader: true })
  assertLongRunningTaskAccess(authenticated)
  const payload = AstraLongRunningTaskCreateRequestSchema.parse(await readJsonBody(request))
  const task = await runLongRunningTaskStoreOperation(() => longTasks.createTask({
    ownerEmail: authenticated.user.email,
    ownerUserId: authenticated.user.id,
    deviceId: authenticated.device.deviceId,
    sessionId: authenticated.sessionRecord.sessionId,
    input: payload,
  }))
  await users.touchSession(authenticated.sessionRecord.sessionId, { seenAt: new Date() })
  sendJson(response, 202, AstraLongRunningTaskCreateResponseSchema.parse({ task }))
}

async function handleLongRunningTaskList(
  request: IncomingMessage,
  response: ServerResponse,
  env: RelayEnv,
  users: FileUserStore,
  longTasks: FileLongRunningTaskStore,
) {
  const authenticated = await requireAuthenticatedSession(request, env, users, { requireDeviceHeader: true })
  assertLongRunningTaskAccess(authenticated)
  const tasks = await runLongRunningTaskStoreOperation(() => longTasks.listTasksForOwner(authenticated.user.email))
  await users.touchSession(authenticated.sessionRecord.sessionId, { seenAt: new Date() })
  sendJson(response, 200, AstraLongRunningTaskListResponseSchema.parse({
    schema: "astra-long-running-task-list.v1",
    tasks,
  }))
}

async function handleLongRunningTaskStatus(
  request: IncomingMessage,
  response: ServerResponse,
  env: RelayEnv,
  users: FileUserStore,
  longTasks: FileLongRunningTaskStore,
  taskId: string,
) {
  const authenticated = await requireAuthenticatedSession(request, env, users, { requireDeviceHeader: true })
  assertLongRunningTaskAccess(authenticated)
  const task = await runLongRunningTaskStoreOperation(() => longTasks.getTaskForOwner(authenticated.user.email, taskId))
  if (!task) {
    throw new HttpRouteError(404, "CONTENT_UNAVAILABLE", "Long-running task could not be found.")
  }
  await users.touchSession(authenticated.sessionRecord.sessionId, { seenAt: new Date() })
  sendJson(response, 200, AstraLongRunningTaskStatusResponseSchema.parse({ task }))
}

async function handleLongRunningTaskCancel(
  request: IncomingMessage,
  response: ServerResponse,
  env: RelayEnv,
  users: FileUserStore,
  longTasks: FileLongRunningTaskStore,
  taskId: string,
) {
  const authenticated = await requireAuthenticatedSession(request, env, users, { requireDeviceHeader: true })
  assertLongRunningTaskAccess(authenticated)
  const task = await runLongRunningTaskStoreOperation(() => longTasks.cancelTaskForOwner(authenticated.user.email, taskId))
  if (!task) {
    throw new HttpRouteError(404, "CONTENT_UNAVAILABLE", "Long-running task could not be found.")
  }
  await users.touchSession(authenticated.sessionRecord.sessionId, { seenAt: new Date() })
  sendJson(response, 200, AstraLongRunningTaskStatusResponseSchema.parse({ task }))
}

function buildOpsLongRunningTaskPayload(record: LongRunningTaskRecord) {
  const task = FileLongRunningTaskStore.toPublicTask(record)
  return {
    ...task,
    ownerEmailHash: buildOpsEmailHash(record.ownerEmail),
    ownerUserId: record.ownerUserId,
    deviceIdHash: buildOpsDeviceIdHash(record.deviceId),
    sessionIdHash: createHash("sha256").update(record.sessionId.trim()).digest("hex"),
  }
}

async function handleOpsLongRunningTasksListGet(
  request: IncomingMessage,
  response: ServerResponse,
  env: RelayEnv,
  longTasks: FileLongRunningTaskStore,
  auditLog: FileOpsAuditLogStore,
  limit: string | null,
) {
  const principal = await requireOperatorPrincipal(
    request,
    env,
    auditLog,
    "ops_long_tasks_viewed",
    (role) => isRole(role, ["support_lead", "ops_engineer", "admin"]),
    "long_tasks:view",
  )
  const parsedLimit = limit ? Number.parseInt(limit, 10) : 50
  const records = await runLongRunningTaskStoreOperation(() => longTasks.listRecentRecords(Number.isFinite(parsedLimit) ? parsedLimit : 50))
  await auditLog.record({
    actor: "operator",
    action: "ops_long_tasks_viewed",
    operatorToken: principal.token,
    metadata: operatorAuditMetadata(principal, { taskCount: records.length }),
    privacy: { contentIncluded: false, contentAccess: "metadata_only" },
  })
  sendJson(response, 200, {
    schema: "astra-ops-long-running-tasks.v1",
    tasks: records.map(buildOpsLongRunningTaskPayload),
  })
}

async function handleOpsLongRunningTaskPatch(
  request: IncomingMessage,
  response: ServerResponse,
  env: RelayEnv,
  longTasks: FileLongRunningTaskStore,
  auditLog: FileOpsAuditLogStore,
  taskId: string,
) {
  const principal = await requireOperatorPrincipal(
    request,
    env,
    auditLog,
    "ops_long_task_updated",
    (role) => isRole(role, ["ops_engineer", "admin"]),
    "long_tasks:update",
  )
  const patch = AstraLongRunningTaskUpdateSchema.parse(await readJsonBody(request))
  const task = await runLongRunningTaskStoreOperation(() => longTasks.updateTask(taskId, patch))
  if (!task) {
    throw new HttpRouteError(404, "CONTENT_UNAVAILABLE", "Long-running task could not be found.")
  }
  await auditLog.record({
    actor: "operator",
    action: "ops_long_task_updated",
    operatorToken: principal.token,
    metadata: operatorAuditMetadata(principal, { taskId, status: task.status, taskClass: task.taskClass, category: task.category }),
    privacy: { contentIncluded: false, contentAccess: "metadata_only" },
  })
  sendJson(response, 200, AstraLongRunningTaskStatusResponseSchema.parse({ task }))
}

async function handleFeatureFlagRuntimeGet(
  request: IncomingMessage,
  response: ServerResponse,
  env: RelayEnv,
  featureFlags: FileFeatureFlagRuntimeStore,
  auditLog: FileOpsAuditLogStore,
) {
  const runtime = await featureFlags.getRuntime()
  const principal = resolveOperatorPrincipal(request, env)
  if (principal && roleCanViewModule(principal.role, "feature_flags")) {
    await auditLog.record({
      actor: "operator",
      action: "ops_feature_flags_viewed",
      operatorToken: principal.token,
      metadata: operatorAuditMetadata(principal, { overrideCount: runtime.overrides.length, killSwitchCount: runtime.killSwitches.length }),
      privacy: { contentIncluded: false, contentAccess: "metadata_only" },
    })
  }
  sendJson(response, 200, runtime)
}

async function handleFeatureFlagRuntimePut(
  request: IncomingMessage,
  response: ServerResponse,
  env: RelayEnv,
  featureFlags: FileFeatureFlagRuntimeStore,
  auditLog: FileOpsAuditLogStore,
) {
  const principal = await requireOperatorPrincipal(
    request,
    env,
    auditLog,
    "ops_feature_flags_updated",
    (role) => isRole(role, ["ops_engineer", "admin"]),
    "feature_flags:write",
  )
  const runtime = await featureFlags.replaceRuntime(await readJsonBody(request))
  await auditLog.record({
    actor: "operator",
    action: "ops_feature_flags_updated",
    operatorToken: principal.token,
    metadata: operatorAuditMetadata(principal, { overrideCount: runtime.overrides.length, killSwitchCount: runtime.killSwitches.length }),
    privacy: { contentIncluded: false, contentAccess: "metadata_only" },
  })
  sendJson(response, 200, runtime)
}

function buildOpsSupportReportPayload(report: SupportReportInboxRecord) {
  const bundle = report.bundle
  const recommendedMacro = findSupportFirstResponseMacro(report.issueCategory ?? bundle.issueCategory ?? null)
  return {
    reportId: report.reportId,
    status: report.status,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
    submittedAt: report.submittedAt,
    ownerEmail: report.ownerEmail,
    deviceId: report.deviceId,
    sessionId: report.sessionId,
    featureSurface: bundle.featureSurface,
    action: bundle.action,
    issueCategory: report.issueCategory ?? null,
    errorCategory: bundle.errorCategory ?? null,
    lastErrorCategory: bundle.lastErrorCategory ?? null,
    runtimeSurface: bundle.runtimeSurface ?? null,
    hostname: bundle.hostname ?? null,
    extensionVersion: bundle.extensionVersion,
    browser: bundle.browser,
    os: bundle.os,
    locale: bundle.locale,
    membershipState: bundle.membershipState,
    privacyMode: bundle.privacyMode,
    userMessageIncluded: bundle.userMessageIncluded,
    contactIncluded: bundle.contactIncluded,
    defaultContentIncluded: report.defaultContentIncluded,
    knownIssue: report.knownIssue,
    triage: report.triage,
    recommendedMacro,
  }
}

async function handleSupportReportsListGet(
  request: IncomingMessage,
  response: ServerResponse,
  env: RelayEnv,
  supportReports: FileSupportReportStore,
  auditLog: FileOpsAuditLogStore,
) {
  const principal = await requireOperatorPrincipal(
    request,
    env,
    auditLog,
    "ops_support_reports_viewed",
    (role) => roleCanViewModule(role, "support_tickets"),
    "support_tickets:view",
  )
  const reports = await supportReports.listReports()
  await auditLog.record({
    actor: "operator",
    action: "ops_support_reports_viewed",
    operatorToken: principal.token,
    metadata: operatorAuditMetadata(principal, { reportCount: reports.length }),
    privacy: { contentIncluded: false, contentAccess: "metadata_only" },
  })
  sendJson(response, 200, {
    schema: "astra-support-report-inbox.v1",
    reports: reports.map(buildOpsSupportReportPayload),
  })
}

async function handleSupportReportTriagePatch(
  request: IncomingMessage,
  response: ServerResponse,
  env: RelayEnv,
  supportReports: FileSupportReportStore,
  auditLog: FileOpsAuditLogStore,
  reportId: string,
) {
  const principal = await requireOperatorPrincipal(
    request,
    env,
    auditLog,
    "ops_support_triage_updated",
    (role) => isRole(role, ["support_agent", "support_lead", "admin"]),
    "support_tickets:triage",
  )
  const patchBody = await readJsonBody(request)
  const followUpPatchPresent = typeof patchBody === "object" && patchBody !== null && Object.prototype.hasOwnProperty.call(patchBody, "followUp")
  const report = await supportReports.updateReportTriage(reportId, patchBody)
  if (!report) {
    throw new HttpRouteError(404, "SUPPORT_REPORT_NOT_FOUND", "Support report could not be found.")
  }
  await auditLog.record({
    actor: "operator",
    action: "ops_support_triage_updated",
    operatorToken: principal.token,
    supportReportId: report.reportId,
    metadata: operatorAuditMetadata(principal, { status: report.triage.status, priority: report.triage.priority }),
    privacy: { contentIncluded: false, contentAccess: "metadata_only" },
  })
  if (followUpPatchPresent) {
    await auditLog.record({
      actor: "operator",
      action: "ops_support_handoff_updated",
      operatorToken: principal.token,
      supportReportId: report.reportId,
      metadata: operatorAuditMetadata(principal, {
        path: report.triage.followUp.path,
        status: report.triage.followUp.status,
        macroId: report.triage.followUp.macroId,
        reason: report.triage.followUp.reason,
      }),
      privacy: { contentIncluded: false, contentAccess: "metadata_only" },
    })
  }
  sendJson(response, 200, { report: buildOpsSupportReportPayload(report) })
}

async function handleSupportReportSummaryGet(
  request: IncomingMessage,
  response: ServerResponse,
  env: RelayEnv,
  supportReports: FileSupportReportStore,
  auditLog: FileOpsAuditLogStore,
) {
  const principal = await requireOperatorPrincipal(
    request,
    env,
    auditLog,
    "ops_support_summary_viewed",
    (role) => roleCanViewModule(role, "support_tickets"),
    "support_tickets:view",
  )
  const summary = await supportReports.summarizeReports()
  await auditLog.record({
    actor: "operator",
    action: "ops_support_summary_viewed",
    operatorToken: principal.token,
    metadata: operatorAuditMetadata(principal, {
      totalReports: summary.totalReports,
      bucketCount: summary.buckets.length,
      weeklyTopIssueCount: summary.weeklyTopIssues.length,
      macroCoverageRate: summary.macroCoverage.reportedCoverage.coverageRate,
      unresolvedCount: summary.slaRisk.unresolvedCount,
      urgentUnresolvedCount: summary.slaRisk.urgentUnresolvedCount,
      followUpOverdueCount: summary.slaRisk.followUpOverdueCount,
    }),
    privacy: { contentIncluded: false, contentAccess: "metadata_only" },
  })
  sendJson(response, 200, summary)
}

async function handleCostUsageSummaryGet(
  request: IncomingMessage,
  response: ServerResponse,
  env: RelayEnv,
  users: FileUserStore,
  auditLog: FileOpsAuditLogStore,
) {
  const principal = await requireOperatorPrincipal(
    request,
    env,
    auditLog,
    "ops_cost_summary_viewed",
    (role) => isRole(role, ["support_lead", "ops_engineer", "admin"]),
    "usage_summary:view",
  )
  const summary = await users.summarizeRecentUsageCost()
  await auditLog.record({
    actor: "operator",
    action: "ops_cost_summary_viewed",
    operatorToken: principal.token,
    metadata: operatorAuditMetadata(principal, { totalEvents: summary.totalEvents, bucketCount: summary.buckets.length }),
    privacy: { contentIncluded: false, contentAccess: "metadata_only" },
  })
  sendJson(response, 200, summary)
}

async function handleOpsCockpitSummaryGet(
  request: IncomingMessage,
  response: ServerResponse,
  env: RelayEnv,
  users: FileUserStore,
  supportReports: FileSupportReportStore,
  cancellationReasons: FileCancellationReasonStore,
  analyticsEvents: FileAnalyticsEventStore,
  auditLog: FileOpsAuditLogStore,
) {
  const principal = await requireOperatorPrincipal(
    request,
    env,
    auditLog,
    "ops_cockpit_summary_viewed",
    (role) => isRole(role, ["support_lead", "ops_engineer", "admin"]),
    "ops_cockpit:view",
  )
  const [cost, support, cancellation, analytics, mobileRetention, weeklyDigestDelivery] = await Promise.all([
    users.summarizeRecentUsageCost(),
    supportReports.summarizeReports(),
    cancellationReasons.summarize(),
    analyticsEvents.summarizeCohorts({ grain: "week" }),
    users.summarizeMobileRetention({ grain: "week" }),
    auditLog.summarizeWeeklyDigestDelivery(),
  ])
  const providerHealth = isRole(principal.role, ["ops_engineer", "admin"])
    ? await users.summarizeProviderHealth()
    : null
  const summary = buildAstraOpsCockpitSummary({
    cost,
    support,
    cancellation,
    analytics,
    mobileRetention,
    weeklyDigestDelivery,
    providerHealth,
  })
  await auditLog.record({
    actor: "operator",
    action: "ops_cockpit_summary_viewed",
    operatorToken: principal.token,
    metadata: operatorAuditMetadata(principal, {
      riskFlagCount: summary.riskFlags.length,
      supportReports: summary.metrics.support.totalReports,
      costEvents: summary.metrics.cost.retainedEvents,
      analyticsEvents: summary.metrics.retentionGrowth.analyticsEvents,
      providerHealthIncluded: summary.sources.providerHealthSummary,
    }),
    privacy: { contentIncluded: false, contentAccess: "metadata_only" },
  })
  sendJson(response, 200, summary)
}

async function handleAnalyticsCohortSummaryGet(
  request: IncomingMessage,
  response: ServerResponse,
  env: RelayEnv,
  analyticsEvents: FileAnalyticsEventStore,
  auditLog: FileOpsAuditLogStore,
  grain: string | null,
) {
  const principal = await requireOperatorPrincipal(
    request,
    env,
    auditLog,
    "ops_analytics_cohort_summary_viewed",
    (role) => isRole(role, ["support_lead", "ops_engineer", "admin"]),
    "usage_summary:view",
  )
  const summary = await analyticsEvents.summarizeCohorts({ grain: grain === "week" ? "week" : "day" })
  await auditLog.record({
    actor: "operator",
    action: "ops_analytics_cohort_summary_viewed",
    operatorToken: principal.token,
    metadata: operatorAuditMetadata(principal, { totalEvents: summary.totalEvents, bucketCount: summary.buckets.length, grain: summary.grain }),
    privacy: { contentIncluded: false, contentAccess: "metadata_only" },
  })
  sendJson(response, 200, summary)
}

async function handleMobileRetentionSummaryGet(
  request: IncomingMessage,
  response: ServerResponse,
  env: RelayEnv,
  users: FileUserStore,
  auditLog: FileOpsAuditLogStore,
  grain: string | null,
) {
  const principal = await requireOperatorPrincipal(
    request,
    env,
    auditLog,
    "ops_mobile_retention_summary_viewed",
    (role) => isRole(role, ["support_lead", "ops_engineer", "admin"]),
    "usage_summary:view",
  )
  const summary = await users.summarizeMobileRetention({ grain: grain === "week" ? "week" : "day" })
  await auditLog.record({
    actor: "operator",
    action: "ops_mobile_retention_summary_viewed",
    operatorToken: principal.token,
    metadata: operatorAuditMetadata(principal, { totalEvents: summary.totalEvents, bucketCount: summary.buckets.length, grain: summary.grain }),
    privacy: { contentIncluded: false, contentAccess: "metadata_only" },
  })
  sendJson(response, 200, summary)
}

async function handleProviderHealthSummaryGet(
  request: IncomingMessage,
  response: ServerResponse,
  env: RelayEnv,
  users: FileUserStore,
  auditLog: FileOpsAuditLogStore,
) {
  const principal = await requireOperatorPrincipal(
    request,
    env,
    auditLog,
    "ops_provider_health_viewed",
    (role) => isRole(role, ["ops_engineer", "admin"]),
    "service_health:view",
  )
  const summary = await users.summarizeProviderHealth()
  await auditLog.record({
    actor: "operator",
    action: "ops_provider_health_viewed",
    operatorToken: principal.token,
    metadata: operatorAuditMetadata(principal, { totalEvents: summary.totalEvents, bucketCount: summary.buckets.length }),
    privacy: { contentIncluded: false, contentAccess: "metadata_only" },
  })
  sendJson(response, 200, summary)
}

async function handleCancellationReasonSummaryGet(
  request: IncomingMessage,
  response: ServerResponse,
  env: RelayEnv,
  cancellationReasons: FileCancellationReasonStore,
  auditLog: FileOpsAuditLogStore,
) {
  const principal = await requireOperatorPrincipal(
    request,
    env,
    auditLog,
    "ops_cancellation_reasons_viewed",
    (role) => isRole(role, ["support_lead", "admin"]),
    "membership:cancellation_reasons:view",
  )
  const summary = await cancellationReasons.summarize()
  await auditLog.record({
    actor: "operator",
    action: "ops_cancellation_reasons_viewed",
    operatorToken: principal.token,
    metadata: operatorAuditMetadata(principal, { totalSubmissions: summary.totalSubmissions, reasonBucketCount: summary.byReason.length }),
    privacy: { contentIncluded: false, contentAccess: "metadata_only" },
  })
  sendJson(response, 200, summary)
}

async function handleOpsUserLookupGet(
  request: IncomingMessage,
  response: ServerResponse,
  env: RelayEnv,
  users: FileUserStore,
  auditLog: FileOpsAuditLogStore,
  query: string | null,
  limit: string | null = null,
) {
  const principal = await requireOperatorPrincipal(
    request,
    env,
    auditLog,
    "ops_user_lookup",
    (role) => isRole(role, ["support_lead", "admin"]),
    "user_overview:lookup",
  )
  const lookupQuery = query?.trim() ?? ""
  if (!lookupQuery) {
    throw new HttpRouteError(400, "OPS_USER_QUERY_REQUIRED", "User lookup requires a query.")
  }
  const requestedLimit = Number(limit ?? "1")
  const resultLimit = Number.isFinite(requestedLimit) ? Math.max(1, Math.floor(requestedLimit)) : 1
  const summary = await users.lookupOpsUser(lookupQuery, new Date(), { limit: resultLimit })
  if (!summary) {
    await auditLog.record({
      actor: "operator",
      action: "ops_user_lookup",
      outcome: "failure",
      operatorToken: principal.token,
      metadata: operatorAuditMetadata(principal, {
        lookupMatched: false,
        queryLength: lookupQuery.length,
        queryContainsAt: lookupQuery.includes("@"),
        queryLooksLikeEmailHash: /^[a-f0-9]{64}$/i.test(lookupQuery),
        queryLooksLikeUserId: lookupQuery.toLowerCase().startsWith("usr_"),
        requestedLimit: resultLimit,
        resultWindowMode: "exact_lookup",
      }),
      privacy: { contentIncluded: false, contentAccess: "metadata_only" },
    })
    throw new HttpRouteError(404, "OPS_USER_NOT_FOUND", "User lookup did not match an account.")
  }
  await auditLog.record({
    actor: "operator",
    action: "ops_user_lookup",
    operatorToken: principal.token,
    subjectUserId: summary.user.userId,
    subjectEmailHash: summary.user.emailHash,
    metadata: operatorAuditMetadata(principal, {
      queryType: summary.queryType,
      usageCategory: summary.user.usage.usageCategory,
      resultLimit: summary.resultWindow.limit,
      returnedCount: summary.resultWindow.returnedCount,
      hasMore: summary.resultWindow.hasMore,
      metadataOnly: summary.snapshotBoundary.metadataOnly,
      exportAvailable: summary.snapshotBoundary.exportAvailable,
    }),
    privacy: { contentIncluded: false, contentAccess: "metadata_only" },
  })
  sendJson(response, 200, summary)
}

async function handleKnownIssuesGet(
  response: ServerResponse,
  knownIssues: FileSupportKnownIssueStore,
) {
  sendJson(response, 200, {
    schema: "astra-known-issues.v1",
    issues: await knownIssues.listIssues(),
  })
}

async function handleOpsAuditSummaryGet(
  request: IncomingMessage,
  response: ServerResponse,
  env: RelayEnv,
  auditLog: FileOpsAuditLogStore,
) {
  const principal = await requireOperatorPrincipal(
    request,
    env,
    auditLog,
    "ops_audit_summary_viewed",
    (role) => roleCanPerform(role, "view_audit_log"),
    "audit_log:view",
  )
  await auditLog.record({
    actor: "operator",
    action: "ops_audit_summary_viewed",
    operatorToken: principal.token,
    metadata: operatorAuditMetadata(principal),
    privacy: { contentIncluded: false, contentAccess: "metadata_only" },
  })
  sendJson(response, 200, await auditLog.summarize())
}

async function handleKnownIssuesPut(
  request: IncomingMessage,
  response: ServerResponse,
  env: RelayEnv,
  knownIssues: FileSupportKnownIssueStore,
  auditLog: FileOpsAuditLogStore,
) {
  const principal = await requireOperatorPrincipal(
    request,
    env,
    auditLog,
    "ops_known_issues_updated",
    (role) => isRole(role, ["support_lead", "admin"]),
    "support_tickets:known_issues:update",
  )
  const issues = await knownIssues.replaceIssues(await readJsonBody(request))
  await auditLog.record({
    actor: "operator",
    action: "ops_known_issues_updated",
    operatorToken: principal.token,
    metadata: operatorAuditMetadata(principal, { issueCount: issues.length }),
    privacy: { contentIncluded: false, contentAccess: "metadata_only" },
  })
  sendJson(response, 200, {
    schema: "astra-known-issues.v1",
    issues,
  })
}

async function handleCancellationReasonCreate(
  request: IncomingMessage,
  response: ServerResponse,
  env: RelayEnv,
  users: FileUserStore,
  cancellationReasons: FileCancellationReasonStore,
  auditLog: FileOpsAuditLogStore,
) {
  const authenticated = await requireAuthenticatedSession(request, env, users, { requireDeviceHeader: true })
  const payload = CancellationReasonCreateSchema.parse(await readJsonBody(request))
  const submission = buildAstraCancellationReasonSubmission({
    reason: payload.reason,
    plan: authenticated.user.plan,
    source: payload.source ?? "settings",
  })
  const subjectEmailHash = buildOpsEmailHash(authenticated.user.email)
  const record = await cancellationReasons.record({
    submittedAt: submission.submittedAt,
    subjectUserId: authenticated.user.id,
    subjectEmailHash,
    reason: submission.reason,
    plan: submission.plan,
    source: submission.source,
    subscriptionStatus: authenticated.user.subscriptionStatus ?? "unknown",
    identityMode: authenticated.user.identityMode ?? "unknown",
  })

  await auditLog.record({
    actor: "user",
    action: "cancellation_reason_submitted",
    subjectUserId: authenticated.user.id,
    subjectEmailHash,
    metadata: { reason: record.reason, plan: record.plan, source: record.source, subscriptionStatus: record.subscriptionStatus },
    privacy: { contentIncluded: false, contentAccess: "metadata_only" },
  })
  await users.touchSession(authenticated.sessionRecord.sessionId, { seenAt: new Date() })

  sendJson(response, 201, {
    schema: "astra-cancellation-reason-submission.v1",
    submission: {
      id: record.id,
      submittedAt: record.submittedAt,
      reason: record.reason,
      plan: record.plan,
      source: record.source,
      subscriptionStatus: record.subscriptionStatus,
    },
  })
}

async function handleSupportReportCreate(
  request: IncomingMessage,
  response: ServerResponse,
  env: RelayEnv,
  users: FileUserStore,
  supportReports: FileSupportReportStore,
  knownIssues: FileSupportKnownIssueStore,
  auditLog: FileOpsAuditLogStore,
) {
  const authenticated = await requireAuthenticatedSession(request, env, users, { requireDeviceHeader: true })
  const payload = SupportReportCreateSchema.parse(await readJsonBody(request))

  if (!payload.bundle.userConsent) {
    throw new HttpRouteError(400, "SUPPORT_CONSENT_REQUIRED", "Support reports require explicit user consent.")
  }

  if (!isMetadataOnlySupportBundle(payload.bundle)) {
    throw new HttpRouteError(
      400,
      "SUPPORT_METADATA_ONLY_REQUIRED",
      "Remote support submission only accepts metadata-only reports.",
    )
  }

  const knownIssue = await knownIssues.findMatch(payload.bundle)
  const report = await supportReports.createReport({
    bundle: payload.bundle,
    ownerEmail: authenticated.user.email,
    deviceId: authenticated.device.deviceId,
    sessionId: authenticated.sessionRecord.sessionId,
    knownIssue,
  })

  await auditLog.record({
    actor: "user",
    action: "support_report_submitted",
    subjectUserId: authenticated.user.id,
    subjectEmailHash: buildOpsEmailHash(authenticated.user.email),
    supportReportId: report.reportId,
    metadata: {
      featureSurface: report.bundle.featureSurface,
      issueCategory: report.issueCategory ?? null,
      defaultContentIncluded: report.defaultContentIncluded,
    },
    privacy: {
      userConsent: payload.bundle.userConsent,
      contentIncluded: report.defaultContentIncluded,
      contentAccess: report.defaultContentIncluded ? "user_consented_content" : "metadata_only",
    },
  })

  await users.touchSession(authenticated.sessionRecord.sessionId, { seenAt: new Date() })
  sendJson(response, 201, {
    report: {
      reportId: report.reportId,
      status: report.status,
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
      submittedAt: report.submittedAt,
      issueCategory: report.issueCategory ?? null,
      defaultContentIncluded: report.defaultContentIncluded,
      knownIssue: report.knownIssue,
    },
  })
}

async function handleVideoNoteStatus(
  request: IncomingMessage,
  response: ServerResponse,
  env: RelayEnv,
  users: FileUserStore,
  videoNotes: VideoNoteService,
  jobId: string,
) {
  const authenticated = await requireAuthenticatedSession(request, env, users)
  assertVideoNoteAccess(authenticated)
  const job = await videoNotes.getJob(authenticated.user.email, jobId)
  if (!job) {
    throw new HttpRouteError(404, "CONTENT_UNAVAILABLE", "Video-note job could not be found.")
  }
  await users.touchSession(authenticated.sessionRecord.sessionId, { seenAt: new Date() })
  sendJson(response, 200, VideoNoteStatusResponseSchema.parse({ job }))
}

async function handleVideoNoteArtifact(
  request: IncomingMessage,
  response: ServerResponse,
  env: RelayEnv,
  users: FileUserStore,
  videoNotes: VideoNoteService,
  jobId: string,
) {
  const authenticated = await requireAuthenticatedSession(request, env, users)
  assertVideoNoteAccess(authenticated)
  const job = await videoNotes.getJob(authenticated.user.email, jobId)
  if (!job) {
    throw new HttpRouteError(404, "CONTENT_UNAVAILABLE", "Video-note job could not be found.")
  }

  const artifact = await videoNotes.getArtifact(authenticated.user.email, jobId)
  if (!artifact) {
    throw new HttpRouteError(404, "CONTENT_UNAVAILABLE", "Video-note artifact is not ready.")
  }

  await users.touchSession(authenticated.sessionRecord.sessionId, { seenAt: new Date() })
  sendJson(response, 200, VideoNoteArtifactResponseSchema.parse({ job, artifact }))
}

async function handleDevices(
  request: IncomingMessage,
  response: ServerResponse,
  env: RelayEnv,
  users: FileUserStore,
) {
  const authenticated = await requireAuthenticatedSession(request, env, users, { requireDeviceHeader: true })
  const devices = await users.listDevices(authenticated.user.email, authenticated.device.deviceId)
  await users.touchSession(authenticated.sessionRecord.sessionId, { seenAt: new Date() })
  sendJson(response, 200, { devices })
}

async function handleDeviceRevoke(
  request: IncomingMessage,
  response: ServerResponse,
  env: RelayEnv,
  users: FileUserStore,
  targetDeviceId: string,
) {
  const authenticated = await requireAuthenticatedSession(request, env, users, { requireDeviceHeader: true })
  const normalizedTargetDeviceId = targetDeviceId.trim()

  if (!normalizedTargetDeviceId) {
    throw new HttpRouteError(400, "DEVICE_REQUIRED", "Target device id is required.")
  }

  if (normalizedTargetDeviceId === authenticated.device.deviceId) {
    throw new HttpRouteError(409, "CURRENT_DEVICE_REVOKE_FORBIDDEN", "Use sign out for the current device instead of remote revoke.")
  }

  const revoked = await users.revokeDevice(authenticated.user.email, normalizedTargetDeviceId)
  if (!revoked.found) {
    throw new HttpRouteError(404, "DEVICE_NOT_FOUND", "Astra device could not be found.")
  }

  await users.touchSession(authenticated.sessionRecord.sessionId, { seenAt: new Date() })
  const devices = await users.listDevices(authenticated.user.email, authenticated.device.deviceId)
  sendJson(response, 200, { devices })
}

async function handleSyncBootstrap(
  request: IncomingMessage,
  response: ServerResponse,
  env: RelayEnv,
  users: FileUserStore,
) {
  const authenticated = await requireAuthenticatedSession(request, env, users, { requireDeviceHeader: true })
  const bootstrap = await users.getSyncBootstrap(authenticated.user.email, authenticated.device.deviceId)
  const now = new Date()
  await users.touchSession(authenticated.sessionRecord.sessionId, { seenAt: now, syncAt: now })
  sendJson(response, 200, bootstrap)
}

async function handleSyncPush(
  request: IncomingMessage,
  response: ServerResponse,
  env: RelayEnv,
  users: FileUserStore,
) {
  const authenticated = await requireAuthenticatedSession(request, env, users, { requireDeviceHeader: true })
  const payload = SyncPushSchema.parse(await readJsonBody(request))
  if (payload.mutations.length > env.syncMaxMutationsPerRequest) {
    throw new HttpRouteError(
      400,
      "INVALID_SYNC_PAYLOAD",
      `Sync push exceeds maxMutationsPerRequest (${env.syncMaxMutationsPerRequest}).`,
    )
  }

  const result = await users.pushSyncMutations(
    authenticated.user.email,
    authenticated.device.deviceId,
    payload.mutations,
  )
  const now = new Date()
  await users.touchSession(authenticated.sessionRecord.sessionId, { seenAt: now, syncAt: now })
  sendJson(response, 200, result)
}

async function handleSyncCollectionPreference(
  request: IncomingMessage,
  response: ServerResponse,
  env: RelayEnv,
  users: FileUserStore,
  rawCollection: string,
) {
  const authenticated = await requireAuthenticatedSession(request, env, users, { requireDeviceHeader: true })
  const collection = SyncPreferenceCollectionSchema.parse(rawCollection)
  const payload = SyncCollectionPreferenceSchema.parse(await readJsonBody(request))

  const updated = await users.updateSyncCollectionPreference(authenticated.user.email, collection, payload.enabled)
  if (!updated) {
    throw new AstraError("CONFIG_MISSING", "Unknown Astra user.")
  }

  const bootstrap = await users.getSyncBootstrap(authenticated.user.email, authenticated.device.deviceId)
  await users.touchSession(authenticated.sessionRecord.sessionId, { seenAt: new Date() })
  sendJson(response, 200, bootstrap)
}

async function handleSyncPull(
  request: IncomingMessage,
  response: ServerResponse,
  env: RelayEnv,
  users: FileUserStore,
) {
  const authenticated = await requireAuthenticatedSession(request, env, users, { requireDeviceHeader: true })
  const payload = SyncPullSchema.parse(await readJsonBody(request))
  const result = await users.pullSyncMutations(authenticated.user.email, payload.cursors)
  const now = new Date()
  await users.touchSession(authenticated.sessionRecord.sessionId, { seenAt: now, syncAt: now })
  sendJson(response, 200, result)
}

function sanitizePublicTranslationError(error: TranslationError): TranslationError {
  if (error.code !== "CONFIG_MISSING") return error
  const technicalConfigurationPattern = /api key|access token|provider|model|relay|upstream|openrouter|google_translate|openai|gemini|[A-Z0-9_]+_API_KEY|GOOGLE_GENERATIVE_AI_API_KEY/i
  if (!technicalConfigurationPattern.test(error.message)) return error
  return {
    code: error.code,
    message: "Sign in to use Astra AI, or try again after Astra reconnects.",
  }
}

async function routeRequest(
  request: IncomingMessage,
  response: ServerResponse,
  env: RelayEnv,
  users: FileUserStore,
  videoNotes: VideoNoteService,
  longTasks: FileLongRunningTaskStore,
  supportReports: FileSupportReportStore,
  knownIssues: FileSupportKnownIssueStore,
  featureFlags: FileFeatureFlagRuntimeStore,
  auditLog: FileOpsAuditLogStore,
  cancellationReasons: FileCancellationReasonStore,
  analyticsEvents: FileAnalyticsEventStore,
) {
  try {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`)
    applyCorsHeaders(request, response, env)

    if (request.method === "OPTIONS") {
      response.writeHead(204)
      response.end()
      return
    }

    if (url.pathname === "/v1/auth/anonymous" && request.method === "POST") {
      await handleAnonymousAuth(request, response, users)
      return
    }

    if (url.pathname === "/v1/auth/session") {
      await handleAuthSession(request, response, env, users)
      return
    }

    if (url.pathname === "/v1/auth/email-code") {
      await handleEmailSignInCodeCreate(request, response, env, users)
      return
    }

    if (url.pathname === "/v1/auth/email-code/redeem") {
      await handleEmailSignInCodeRedeem(request, response, users)
      return
    }

    if (url.pathname === "/v1/auth/oauth/redeem") {
      await handleOAuthIdentityRedeem(request, response, env, users)
      return
    }

    if (url.pathname === "/v1/auth/mobile-link") {
      await handleMobileLinkCreate(request, response, env, users)
      return
    }

    if (url.pathname === "/v1/auth/mobile-link/redeem") {
      await handleMobileLinkRedeem(request, response, users)
      return
    }

    if (url.pathname === "/_internal/cloudflare/auth/issue/authenticated" && request.method === "POST") {
      await handleMirroredAuthenticatedIssue(request, response, env, users)
      return
    }

    if (url.pathname === "/_internal/cloudflare/auth/issue/anonymous" && request.method === "POST") {
      await handleMirroredAnonymousIssue(request, response, env, users)
      return
    }

    if (url.pathname === "/v1/account" && request.method === "GET") {
      await handleAccount(request, response, env, users)
      return
    }

    if (url.pathname === "/v1/account" && request.method === "DELETE") {
      await handleAccountDelete(request, response, env, users, longTasks)
      return
    }

    if (url.pathname === "/v1/account/plan" && request.method === "PATCH") {
      await handlePlanUpdate(request, response, env, users, auditLog)
      return
    }

    if (url.pathname === "/v1/account/usage" && request.method === "GET") {
      await handleUsage(request, response, env, users)
      return
    }

    if (url.pathname === "/v1/account/summary" && request.method === "GET") {
      await handleAccountSummary(request, response, env, users)
      return
    }

    if (url.pathname === "/v1/account/export" && request.method === "GET") {
      await handleAccountExport(request, response, env, users)
      return
    }

    if (url.pathname === "/v1/account/learning-memory/inventory" && request.method === "GET") {
      await handleCloudLearningMemoryInventory(request, response, env, users)
      return
    }

    if (url.pathname === "/v1/account/learning-memory" && request.method === "DELETE") {
      await handleCloudLearningMemoryDelete(request, response, env, users)
      return
    }

    if (url.pathname === "/v1/account/weekly-digest" && request.method === "GET") {
      await handleWeeklyDigest(request, response, env, users)
      return
    }

    if (url.pathname === "/v1/account/weekly-digest/email" && request.method === "POST") {
      await handleWeeklyDigestEmail(request, response, env, users)
      return
    }

    if (url.pathname === "/v1/account/preferences/weekly-digest" && request.method === "PATCH") {
      await handleWeeklyDigestPreference(request, response, env, users)
      return
    }

    if (url.pathname === "/v1/account/devices/current/push-token" && request.method === "PATCH") {
      await handleCurrentDevicePushToken(request, response, env, users)
      return
    }

    if (url.pathname === "/v1/ops/weekly-digest/delivery-summary" && request.method === "GET") {
      await handleOpsWeeklyDigestDeliverySummaryGet(request, response, env, auditLog)
      return
    }

    if (url.pathname === "/v1/ops/weekly-digest/deliver" && request.method === "POST") {
      await handleOpsWeeklyDigestDeliveryRun(request, response, env, users, auditLog)
      return
    }

    if (url.pathname === "/v1/ops/weekly-digest/push" && request.method === "POST") {
      await handleOpsWeeklyDigestPushDeliveryRun(request, response, env, users, auditLog)
      return
    }

    if (url.pathname === "/v1/account/mobile-retention-events" && request.method === "POST") {
      await handleMobileRetentionEventsUpload(request, response, env, users)
      return
    }

    if (url.pathname === "/v1/account/analytics-events" && (request.method === "POST" || request.method === "GET")) {
      await handleAnalyticsEvents(request, response, env, users, analyticsEvents, url.searchParams.get("limit"))
      return
    }

    if (url.pathname === "/v1/account/trial-intent" && (request.method === "POST" || request.method === "GET")) {
      await handleTrialIntent(request, response, env, users, analyticsEvents)
      return
    }

    if (url.pathname === "/v1/billing/checkout" && request.method === "POST") {
      await handleBillingCheckout(request, response, env, users)
      return
    }

    if (url.pathname === "/v1/billing/portal" && request.method === "POST") {
      await handleBillingPortal(request, response, env, users)
      return
    }

    if (url.pathname === "/v1/account/cancellation-reasons" && request.method === "POST") {
      await handleCancellationReasonCreate(request, response, env, users, cancellationReasons, auditLog)
      return
    }

    if (url.pathname === "/v1/import/article" && request.method === "POST") {
      await handleArticleImport(request, response)
      return
    }

    if (url.pathname === "/v1/video-notes/jobs" && request.method === "POST") {
      await handleVideoNoteCreate(request, response, env, users, videoNotes)
      return
    }

    if (url.pathname === "/v1/long-tasks" && request.method === "POST") {
      await handleLongRunningTaskCreate(request, response, env, users, longTasks)
      return
    }

    if (url.pathname === "/v1/long-tasks" && request.method === "GET") {
      await handleLongRunningTaskList(request, response, env, users, longTasks)
      return
    }

    if (url.pathname === "/v1/support/reports" && request.method === "POST") {
      await handleSupportReportCreate(request, response, env, users, supportReports, knownIssues, auditLog)
      return
    }

    if (url.pathname === "/v1/ops/support/reports" && request.method === "GET") {
      await handleSupportReportsListGet(request, response, env, supportReports, auditLog)
      return
    }

    const supportReportTriageMatch = /^\/v1\/ops\/support\/reports\/([^/]+)\/triage$/.exec(url.pathname)
    if (supportReportTriageMatch && request.method === "PATCH") {
      await handleSupportReportTriagePatch(
        request,
        response,
        env,
        supportReports,
        auditLog,
        decodeURIComponent(supportReportTriageMatch[1]),
      )
      return
    }

    if (url.pathname === "/v1/ops/support/reports/summary" && request.method === "GET") {
      await handleSupportReportSummaryGet(request, response, env, supportReports, auditLog)
      return
    }

    if (url.pathname === "/v1/ops/cost/usage-summary" && request.method === "GET") {
      await handleCostUsageSummaryGet(request, response, env, users, auditLog)
      return
    }

    if (url.pathname === "/v1/ops/cockpit/summary" && request.method === "GET") {
      await handleOpsCockpitSummaryGet(request, response, env, users, supportReports, cancellationReasons, analyticsEvents, auditLog)
      return
    }

    if (url.pathname === "/v1/ops/analytics/cohort-summary" && request.method === "GET") {
      await handleAnalyticsCohortSummaryGet(request, response, env, analyticsEvents, auditLog, url.searchParams.get("grain"))
      return
    }

    if (url.pathname === "/v1/ops/mobile-retention/summary" && request.method === "GET") {
      await handleMobileRetentionSummaryGet(request, response, env, users, auditLog, url.searchParams.get("grain"))
      return
    }

    if (url.pathname === "/v1/ops/long-tasks" && request.method === "GET") {
      await handleOpsLongRunningTasksListGet(request, response, env, longTasks, auditLog, url.searchParams.get("limit"))
      return
    }

    const opsLongTaskMatch = /^\/v1\/ops\/long-tasks\/([^/]+)$/.exec(url.pathname)
    if (opsLongTaskMatch && request.method === "PATCH") {
      await handleOpsLongRunningTaskPatch(request, response, env, longTasks, auditLog, decodeURIComponent(opsLongTaskMatch[1]))
      return
    }

    if (url.pathname === "/v1/ops/provider-health/summary" && request.method === "GET") {
      await handleProviderHealthSummaryGet(request, response, env, users, auditLog)
      return
    }

    if (url.pathname === "/v1/ops/cancellations/reasons/summary" && request.method === "GET") {
      await handleCancellationReasonSummaryGet(request, response, env, cancellationReasons, auditLog)
      return
    }

    if (url.pathname === "/v1/ops/users/lookup" && request.method === "GET") {
      await handleOpsUserLookupGet(request, response, env, users, auditLog, url.searchParams.get("query"), url.searchParams.get("limit"))
      return
    }

    if (url.pathname === "/v1/ops/audit/summary" && request.method === "GET") {
      await handleOpsAuditSummaryGet(request, response, env, auditLog)
      return
    }

    if (url.pathname === "/v1/support/known-issues" && request.method === "GET") {
      await handleKnownIssuesGet(response, knownIssues)
      return
    }

    if (url.pathname === "/v1/ops/support/known-issues" && request.method === "PUT") {
      await handleKnownIssuesPut(request, response, env, knownIssues, auditLog)
      return
    }

    if (url.pathname === "/v1/ops/feature-flags" && request.method === "GET") {
      await handleFeatureFlagRuntimeGet(request, response, env, featureFlags, auditLog)
      return
    }

    if (url.pathname === "/v1/ops/feature-flags" && request.method === "PUT") {
      await handleFeatureFlagRuntimePut(request, response, env, featureFlags, auditLog)
      return
    }

    const videoNoteJobMatch = /^\/v1\/video-notes\/jobs\/([^/]+)$/.exec(url.pathname)
    if (videoNoteJobMatch && request.method === "GET") {
      await handleVideoNoteStatus(request, response, env, users, videoNotes, decodeURIComponent(videoNoteJobMatch[1]))
      return
    }

    const longTaskMatch = /^\/v1\/long-tasks\/([^/]+)$/.exec(url.pathname)
    if (longTaskMatch && request.method === "GET") {
      await handleLongRunningTaskStatus(request, response, env, users, longTasks, decodeURIComponent(longTaskMatch[1]))
      return
    }

    const longTaskCancelMatch = /^\/v1\/long-tasks\/([^/]+)\/cancel$/.exec(url.pathname)
    if (longTaskCancelMatch && request.method === "POST") {
      await handleLongRunningTaskCancel(request, response, env, users, longTasks, decodeURIComponent(longTaskCancelMatch[1]))
      return
    }

    const videoNoteArtifactMatch = /^\/v1\/video-notes\/jobs\/([^/]+)\/artifact$/.exec(url.pathname)
    if (videoNoteArtifactMatch && request.method === "GET") {
      await handleVideoNoteArtifact(request, response, env, users, videoNotes, decodeURIComponent(videoNoteArtifactMatch[1]))
      return
    }

    if (url.pathname === "/v1/devices" && request.method === "GET") {
      await handleDevices(request, response, env, users)
      return
    }

    const deviceRevokeMatch = /^\/v1\/devices\/([^/]+)\/revoke$/.exec(url.pathname)
    if (deviceRevokeMatch && request.method === "POST") {
      await handleDeviceRevoke(request, response, env, users, decodeURIComponent(deviceRevokeMatch[1]))
      return
    }

    if (url.pathname === "/v1/sync/bootstrap" && request.method === "GET") {
      await handleSyncBootstrap(request, response, env, users)
      return
    }

    if (url.pathname === "/v1/sync/push" && request.method === "POST") {
      await handleSyncPush(request, response, env, users)
      return
    }

    const syncCollectionMatch = /^\/v1\/sync\/collections\/([^/]+)$/.exec(url.pathname)
    if (syncCollectionMatch && request.method === "PATCH") {
      await handleSyncCollectionPreference(request, response, env, users, decodeURIComponent(syncCollectionMatch[1]))
      return
    }

    if (url.pathname === "/v1/sync/pull" && request.method === "POST") {
      await handleSyncPull(request, response, env, users)
      return
    }

    if (url.pathname === "/v1/translate" && request.method === "POST") {
      await handleTranslate(request, response, env, users, featureFlags)
      return
    }

    sendError(response, 404, "Route not found.", "CONTENT_UNAVAILABLE")
  } catch (error) {
    if (error instanceof HttpRouteError) {
      sendError(response, error.status, error.message, error.code)
      return
    }

    const translationError = sanitizePublicTranslationError(toTranslationError(error, "UNKNOWN"))
    const status = translationError.code === "QUOTA_EXCEEDED" ? 429 : 400
    sendJson(response, status, { error: translationError })
  }
}

export function createAstraRelayServer(env: RelayEnv = loadRelayEnv()) {
  const users = new FileUserStore(env)
  const videoNotes = new VideoNoteService(env)
  const longTasks = new FileLongRunningTaskStore(env)
  const supportReports = new FileSupportReportStore(env)
  const knownIssues = new FileSupportKnownIssueStore(env)
  const featureFlags = new FileFeatureFlagRuntimeStore(env)
  const auditLog = new FileOpsAuditLogStore(env)
  const cancellationReasons = new FileCancellationReasonStore(env)
  const analyticsEvents = new FileAnalyticsEventStore(env)
  return createServer((request, response) => {
    void routeRequest(request, response, env, users, videoNotes, longTasks, supportReports, knownIssues, featureFlags, auditLog, cancellationReasons, analyticsEvents)
  })
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const env = loadRelayEnv()
  const server = createAstraRelayServer(env)
  server.listen(env.port, env.host, () => {
    console.log(`Astra relay listening at ${env.publicBaseURL}`)
  })
}
