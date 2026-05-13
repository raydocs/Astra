import { createServer, type IncomingMessage, type ServerResponse } from "node:http"
import { lookup } from "node:dns/promises"

import { JSDOM } from "jsdom"
import { z } from "zod"

import { AstraError, toTranslationError } from "../src/types/translation"
import { ProviderIdSchema } from "../src/types/config"
import { TranslateBatchPayloadSchema } from "../src/types/messages"
import {
  AstraPlanSchema,
  AstraSubscriptionStatusSchema,
  AstraUsageEventSchema,
} from "../src/types/auth"
import {
  VideoNoteArtifactResponseSchema,
  VideoNoteCreateRequestSchema,
  VideoNoteCreateResponseSchema,
  VideoNoteStatusResponseSchema,
} from "../src/types/video-notes"
import { extractReadableDocumentMetadata, resolveExtractionPlan } from "../src/utils/dom/extraction"

import { buildRelaySession, parseBearerToken, verifySessionToken } from "./auth"
import { createCheckoutLink, createPortalLink } from "./billing"
import { loadRelayEnv } from "./config"
import { translateViaManagedProvider } from "./providers"
import { VideoNoteService } from "./video-note-service"
import type {
  DeviceMetadataInput,
  MirroredAnonymousIssueInput,
  MirroredAuthenticatedIssueInput,
  RelayEnv,
  RelayTranslateRequest,
  SyncCollection,
  SyncMutationInput,
  ValidatedSessionContext,
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

const TranslateSchema = TranslateBatchPayloadSchema.extend({
  provider: ProviderIdSchema,
  model: z.string().trim().min(1),
})

const PlanUpdateSchema = z.object({
  plan: AstraPlanSchema,
})

const BillingCheckoutSchema = z.object({
  plan: AstraPlanSchema,
})

const ArticleImportSchema = z.object({
  url: z.string().trim().min(1),
})

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
  }),
  identityMode: z.literal("anonymous"),
  syncPreferences: z.object({
    reading_history: z.boolean(),
    study_progress: z.boolean(),
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
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
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

/** Exposed for testing – clears all tracked anonymous creation timestamps. */
export function resetAnonymousRateLimits(): void {
  anonymousCreationsByIp.clear()
}

function assertProviderEntitlement(provider: RelayTranslateRequest["provider"], entitlements: string[]) {
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

async function handlePlanUpdate(
  request: IncomingMessage,
  response: ServerResponse,
  env: RelayEnv,
  users: FileUserStore,
) {
  const authenticated = await requireAuthenticatedSession(request, env, users)
  const payload = PlanUpdateSchema.parse(await readJsonBody(request))
  const account = await users.updatePlan(authenticated.claims.email, payload.plan)
  if (!account) {
    throw new AstraError("CONFIG_MISSING", "Unknown Astra user.")
  }

  await users.touchSession(authenticated.sessionRecord.sessionId, { seenAt: new Date() })
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

async function handleTranslate(
  request: IncomingMessage,
  response: ServerResponse,
  env: RelayEnv,
  users: FileUserStore,
) {
  const authenticated = await requireAuthenticatedSession(request, env, users)
  const payload = TranslateSchema.parse(await readJsonBody(request))
  const session = await users.getSession(authenticated.claims.email, authenticated.token)
  if (!session) {
    throw new AstraError("CONFIG_MISSING", "Unknown Astra user.")
  }
  assertProviderEntitlement(payload.provider, session.providerEntitlements)
  await users.assertCanTranslate({
    email: authenticated.claims.email,
    characterCount: payload.texts.reduce((sum, text) => sum + text.length, 0),
  })

  const translations = await translateViaManagedProvider(payload, env)
  await users.recordTranslationUsage({
    email: authenticated.claims.email,
    provider: payload.provider,
    characterCount: payload.texts.reduce((sum, text) => sum + text.length, 0),
  })
  await users.touchSession(authenticated.sessionRecord.sessionId, { seenAt: new Date() })
  sendJson(response, 200, { translations })
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
    payload.mutations as SyncMutationInput[],
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
  const result = await users.pullSyncMutations(authenticated.user.email, payload.cursors as Partial<Record<SyncCollection, string | null>>)
  const now = new Date()
  await users.touchSession(authenticated.sessionRecord.sessionId, { seenAt: now, syncAt: now })
  sendJson(response, 200, result)
}

async function routeRequest(
  request: IncomingMessage,
  response: ServerResponse,
  env: RelayEnv,
  users: FileUserStore,
  videoNotes: VideoNoteService,
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

    if (url.pathname === "/v1/account/plan" && request.method === "PATCH") {
      await handlePlanUpdate(request, response, env, users)
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

    if (url.pathname === "/v1/billing/checkout" && request.method === "POST") {
      await handleBillingCheckout(request, response, env, users)
      return
    }

    if (url.pathname === "/v1/billing/portal" && request.method === "POST") {
      await handleBillingPortal(request, response, env, users)
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

    const videoNoteJobMatch = /^\/v1\/video-notes\/jobs\/([^/]+)$/.exec(url.pathname)
    if (videoNoteJobMatch && request.method === "GET") {
      await handleVideoNoteStatus(request, response, env, users, videoNotes, decodeURIComponent(videoNoteJobMatch[1]!))
      return
    }

    const videoNoteArtifactMatch = /^\/v1\/video-notes\/jobs\/([^/]+)\/artifact$/.exec(url.pathname)
    if (videoNoteArtifactMatch && request.method === "GET") {
      await handleVideoNoteArtifact(request, response, env, users, videoNotes, decodeURIComponent(videoNoteArtifactMatch[1]!))
      return
    }

    if (url.pathname === "/v1/devices" && request.method === "GET") {
      await handleDevices(request, response, env, users)
      return
    }

    const deviceRevokeMatch = /^\/v1\/devices\/([^/]+)\/revoke$/.exec(url.pathname)
    if (deviceRevokeMatch && request.method === "POST") {
      await handleDeviceRevoke(request, response, env, users, decodeURIComponent(deviceRevokeMatch[1]!))
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
      await handleSyncCollectionPreference(request, response, env, users, decodeURIComponent(syncCollectionMatch[1]!))
      return
    }

    if (url.pathname === "/v1/sync/pull" && request.method === "POST") {
      await handleSyncPull(request, response, env, users)
      return
    }

    if (url.pathname === "/v1/translate" && request.method === "POST") {
      await handleTranslate(request, response, env, users)
      return
    }

    sendError(response, 404, "Route not found.", "CONTENT_UNAVAILABLE")
  } catch (error) {
    if (error instanceof HttpRouteError) {
      sendError(response, error.status, error.message, error.code)
      return
    }

    const translationError = toTranslationError(error, "UNKNOWN")
    const status = translationError.code === "QUOTA_EXCEEDED" ? 429 : 400
    sendJson(response, status, { error: translationError })
  }
}

export function createAstraRelayServer(env: RelayEnv = loadRelayEnv()) {
  const users = new FileUserStore(env)
  const videoNotes = new VideoNoteService(env)
  return createServer((request, response) => {
    void routeRequest(request, response, env, users, videoNotes)
  })
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const env = loadRelayEnv()
  const server = createAstraRelayServer(env)
  server.listen(env.port, env.host, () => {
    console.log(`Astra relay listening at ${env.publicBaseURL}`)
  })
}
