import type { MobileRetentionUploadEvent } from "../domain/retentionAnalytics"
import type { MobileDigestSnapshot, SourceContentType } from "../domain/review"

export interface MobileDeviceIdentity {
  deviceId: string
  label: string
  platform: "ios" | "android" | "web" | "unknown"
  appKind: "mobile"
  appVersion: string
}

export interface MobileAstraSession {
  version: number
  sessionToken: string
  sessionId: string | null
  deviceId: string | null
  identityMode: "anonymous" | "authenticated"
  relayBaseURL: string
  email: string
  plan: "free" | "trial" | "pro" | string
  subscriptionStatus: string
  expiresAt: string
}

export interface MobileLinkChallenge {
  code: string
  expiresAt: string
  link: string | null
}

export interface MobileEmailSignInChallenge {
  code: string | null
  expiresAt: string
  delivery: string
}

export type MobileOAuthIdentity =
  | {
    provider: "apple" | "google"
    idToken: string
    nonce: string
    subject?: never
    email?: never
    emailVerified?: never
  }
  | {
    provider: "apple" | "google"
    subject: string
    email?: string | null
    emailVerified?: boolean
    idToken?: never
    nonce?: never
  }

export type MobileSyncCollection = "config" | "vocabulary" | "review_schedule" | "reading_history" | "study_progress"
export type MobileCloudDataDeleteCollection = "vocabulary" | "review_schedule" | "reading_history" | "study_progress"
export type MobileCloudDataDeleteStatus = "queued" | "scheduled" | "running" | "completed" | "failed" | "canceled"

export interface MobileRetentionUploadResponse {
  acceptedCount: number
  serverTime: string
}

export interface MobileWeeklyDigestEmailResponse {
  delivery: "email" | "unavailable" | string
  digest: MobileDigestSnapshot
}

export interface MobileWeeklyDigestPreferenceResponse {
  preference: { weekly_digest: boolean }
  serverTime: string
}

export interface MobileDevicePushTokenResponse {
  deviceId: string
  pushTokenStored: boolean
  serverTime: string
}

export type MobileSupportFeatureSurface = "review" | "library" | "account" | "onboarding" | "settings" | "digest"
export type MobileSupportIssueCategory = "review_library" | "account_access" | "privacy_question" | "other"

export interface MobileSupportReportResponse {
  reportId: string
  status: string
  createdAt: string
  updatedAt: string
  submittedAt: string
  issueCategory: string | null
  defaultContentIncluded: boolean
  knownIssue: unknown | null
}

export interface MobileAccountDataExport {
  schema: "astra-account-data-export.v1" | string
  generatedAt: string
  account?: Record<string, unknown>
  currentSession?: Record<string, unknown>
  devices?: unknown[]
  sessions?: unknown[]
  oauthIdentities?: unknown[]
  syncMutations?: unknown[]
  weeklyDigests?: unknown[]
  mobileRetentionEvents?: unknown[]
}

export interface MobileCloudDataDeleteJob {
  jobId: string
  scope: { collections: MobileCloudDataDeleteCollection[] }
  status: MobileCloudDataDeleteStatus
  requestedAt: string
  scheduledForAt: string
  completedAt: string | null
  gracePeriodSeconds: number
}

export interface MobileSyncMutationInput {
  collection: MobileSyncCollection
  schemaVersion: number
  recordId: string
  operation: "upsert" | "delete"
  clientMutationId: string
  deviceId: string
  clientUpdatedAt: string
  payload?: Record<string, unknown> | null
}

export interface MobileSyncPushResponse {
  accepted: Array<{ collection: string; recordId: string; clientMutationId: string }>
  rejected: Array<{ collection: string; clientMutationId: string; code: string; message: string }>
  nextCursors?: Partial<Record<MobileSyncCollection, string | null>>
}

export interface MobileSyncMutationRecord extends MobileSyncMutationInput {
  ownerId?: string
  email?: string
  serverMutationId?: string
  serverUpdatedAt?: string
  cursor: string
}

export interface MobileSyncPullResponse {
  serverTime: string | null
  deltas: Partial<Record<MobileSyncCollection, MobileSyncMutationRecord[]>>
  nextCursors: Partial<Record<MobileSyncCollection, string | null>>
}

export interface MobileSyncBootstrapResponse {
  serverTime: string | null
  collections: Record<string, { enabled: boolean; defaultEnabled: boolean; cursor: string | null }>
}

export class MobileAstraApiError extends Error {
  status: number
  code: string | null

  constructor(params: { message: string; status: number; code?: string | null }) {
    super(params.message)
    this.name = "MobileAstraApiError"
    this.status = params.status
    this.code = params.code ?? null
  }
}

export interface MobileAstraClient {
  signIn(params: { email: string; password: string; device: MobileDeviceIdentity; idempotencyKey: string }): Promise<MobileAstraSession>
  requestEmailSignInCode(params: { email: string }): Promise<MobileEmailSignInChallenge>
  redeemEmailSignInCode(params: { email: string; code: string; device: MobileDeviceIdentity; idempotencyKey: string }): Promise<MobileAstraSession>
  redeemOAuthIdentity(params: { identity: MobileOAuthIdentity; device: MobileDeviceIdentity; idempotencyKey: string }): Promise<MobileAstraSession>
  requestMobileLink(params: { session: Pick<MobileAstraSession, "sessionToken" | "relayBaseURL">; device: MobileDeviceIdentity }): Promise<MobileLinkChallenge>
  redeemMobileLink(params: { code: string; device: MobileDeviceIdentity; idempotencyKey: string }): Promise<MobileAstraSession>
  refreshSession(params: { session: Pick<MobileAstraSession, "sessionToken" | "relayBaseURL">; device: MobileDeviceIdentity }): Promise<MobileAstraSession>
  revokeSession(params: { session: Pick<MobileAstraSession, "sessionToken" | "relayBaseURL">; device: MobileDeviceIdentity }): Promise<void>
  deleteAccount(params: { session: Pick<MobileAstraSession, "sessionToken" | "relayBaseURL">; device: MobileDeviceIdentity }): Promise<void>
  fetchWeeklyDigest(params: { session: Pick<MobileAstraSession, "sessionToken" | "relayBaseURL">; device: MobileDeviceIdentity; now?: Date }): Promise<MobileDigestSnapshot>
  requestWeeklyDigestEmail(params: { session: Pick<MobileAstraSession, "sessionToken" | "relayBaseURL">; device: MobileDeviceIdentity; now?: Date }): Promise<MobileWeeklyDigestEmailResponse>
  updateWeeklyDigestPreference(params: { session: Pick<MobileAstraSession, "sessionToken" | "relayBaseURL">; device: MobileDeviceIdentity; enabled: boolean }): Promise<MobileWeeklyDigestPreferenceResponse>
  updateCurrentDevicePushToken(params: { session: Pick<MobileAstraSession, "sessionToken" | "relayBaseURL">; device: MobileDeviceIdentity; expoPushToken: string | null; platform?: string | null }): Promise<MobileDevicePushTokenResponse>
  submitSupportReport(params: { session: Pick<MobileAstraSession, "sessionToken" | "relayBaseURL" | "plan">; device: MobileDeviceIdentity; featureSurface: MobileSupportFeatureSurface; issueCategory?: MobileSupportIssueCategory; action?: string }): Promise<MobileSupportReportResponse>
  exportAccountData(params: { session: Pick<MobileAstraSession, "sessionToken" | "relayBaseURL">; device: MobileDeviceIdentity }): Promise<MobileAccountDataExport>
  fetchSyncBootstrap(params: { session: Pick<MobileAstraSession, "sessionToken" | "relayBaseURL">; device: MobileDeviceIdentity }): Promise<MobileSyncBootstrapResponse>
  pullSyncDeltas(params: { session: Pick<MobileAstraSession, "sessionToken" | "relayBaseURL">; device: MobileDeviceIdentity; cursors: Partial<Record<MobileSyncCollection, string | null>> }): Promise<MobileSyncPullResponse>
  pushSyncMutations(params: { session: Pick<MobileAstraSession, "sessionToken" | "relayBaseURL">; device: MobileDeviceIdentity; mutations: MobileSyncMutationInput[] }): Promise<MobileSyncPushResponse>
  requestCloudDataDelete(params: { session: Pick<MobileAstraSession, "sessionToken" | "relayBaseURL">; device: MobileDeviceIdentity; collections: MobileCloudDataDeleteCollection[]; idempotencyKey: string }): Promise<MobileCloudDataDeleteJob>
  fetchCloudDataDeleteJob(params: { session: Pick<MobileAstraSession, "sessionToken" | "relayBaseURL">; device: MobileDeviceIdentity; jobId: string }): Promise<MobileCloudDataDeleteJob>
  uploadMobileRetentionEvents(params: { session: Pick<MobileAstraSession, "sessionToken" | "relayBaseURL">; device: MobileDeviceIdentity; events: MobileRetentionUploadEvent[]; idempotencyKey: string }): Promise<MobileRetentionUploadResponse>
}

function isDevelopmentBundle(): boolean {
  return (globalThis as unknown as { __DEV__?: boolean }).__DEV__ !== false
}

function isLocalMobileApiHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "10.0.2.2" || hostname === "::1" || hostname === "[::1]"
}

function isDeployedHttpsMobileApiBaseUrl(value: string): boolean {
  try {
    const parsed = new URL(value)
    return parsed.protocol === "https:" && !isLocalMobileApiHost(parsed.hostname)
  } catch {
    return false
  }
}

export function normalizeMobileApiBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "")
  if (!trimmed) throw new Error("Astra sign-in endpoint is required.")
  if (!isDevelopmentBundle() && !isDeployedHttpsMobileApiBaseUrl(trimmed)) {
    throw new Error("Production mobile sessions require a deployed HTTPS Astra account service URL.")
  }
  return trimmed
}

function requireString(payload: Record<string, unknown>, key: string): string {
  const value = payload[key]
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Astra response is missing ${key}.`)
  }
  return value
}

function parseSession(payload: unknown, fallback: { deviceId: string; identityMode: "anonymous" | "authenticated" }): MobileAstraSession {
  if (!payload || typeof payload !== "object") throw new Error("Astra session response was not an object.")
  const record = payload as Record<string, unknown>
  return {
    version: typeof record.version === "number" ? record.version : 1,
    sessionToken: requireString(record, "sessionToken"),
    sessionId: typeof record.sessionId === "string" ? record.sessionId : null,
    deviceId: typeof record.deviceId === "string" ? record.deviceId : fallback.deviceId,
    identityMode: record.identityMode === "anonymous" || record.identityMode === "authenticated" ? record.identityMode : fallback.identityMode,
    relayBaseURL: typeof record.relayBaseURL === "string" ? record.relayBaseURL : "",
    email: typeof record.email === "string" ? record.email : "",
    plan: typeof record.plan === "string" ? record.plan : "free",
    subscriptionStatus: typeof record.subscriptionStatus === "string" ? record.subscriptionStatus : "unknown",
    expiresAt: typeof record.expiresAt === "string" ? record.expiresAt : "",
  }
}

function parseMobileLinkChallenge(payload: unknown): MobileLinkChallenge {
  if (!payload || typeof payload !== "object") throw new Error("Astra link response was not an object.")
  const record = payload as Record<string, unknown>
  return {
    code: requireString(record, "code"),
    expiresAt: requireString(record, "expiresAt"),
    link: typeof record.link === "string" ? record.link : null,
  }
}

function parseEmailSignInChallenge(payload: unknown): MobileEmailSignInChallenge {
  if (!payload || typeof payload !== "object") throw new Error("Astra email sign-in response was not an object.")
  const record = payload as Record<string, unknown>
  return {
    code: typeof record.code === "string" && record.code.trim().length > 0 ? record.code : null,
    expiresAt: requireString(record, "expiresAt"),
    delivery: typeof record.delivery === "string" ? record.delivery : "unknown",
  }
}

function parseCloudDataDeleteJob(payload: unknown): MobileCloudDataDeleteJob {
  if (!payload || typeof payload !== "object") throw new Error("Astra delete response was not an object.")
  const record = payload as Record<string, unknown>
  const scope = record.scope && typeof record.scope === "object" ? record.scope as Record<string, unknown> : {}
  return {
    jobId: requireString(record, "jobId"),
    scope: {
      collections: Array.isArray(scope.collections)
        ? scope.collections.filter((collection): collection is MobileCloudDataDeleteCollection => (
          collection === "vocabulary"
          || collection === "review_schedule"
          || collection === "reading_history"
          || collection === "study_progress"
        ))
        : [],
    },
    status: typeof record.status === "string" ? record.status as MobileCloudDataDeleteStatus : "queued",
    requestedAt: requireString(record, "requestedAt"),
    scheduledForAt: requireString(record, "scheduledForAt"),
    completedAt: typeof record.completedAt === "string" ? record.completedAt : null,
    gracePeriodSeconds: typeof record.gracePeriodSeconds === "number" ? record.gracePeriodSeconds : 0,
  }
}

function isSourceContentType(value: unknown): value is SourceContentType {
  return value === "page"
    || value === "video"
    || value === "pdf"
    || value === "doc"
    || value === "book"
    || value === "writing"
    || value === "saved"
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
}

function parseWeeklyDigest(payload: unknown): MobileDigestSnapshot {
  if (!payload || typeof payload !== "object") throw new Error("Astra weekly digest response was not an object.")
  const record = payload as Record<string, unknown>
  return {
    digestId: requireString(record, "digestId"),
    periodStart: requireString(record, "periodStart"),
    periodEnd: requireString(record, "periodEnd"),
    reviewedCount: typeof record.reviewedCount === "number" ? record.reviewedCount : 0,
    savedCount: typeof record.savedCount === "number" ? record.savedCount : 0,
    sourceBreakdown: Array.isArray(record.sourceBreakdown)
      ? record.sourceBreakdown.flatMap((item) => {
        if (!item || typeof item !== "object") return []
        const source = item as Record<string, unknown>
        return isSourceContentType(source.type) && typeof source.count === "number"
          ? [{ type: source.type, count: source.count }]
          : []
      })
      : [],
    highlightedWords: stringArray(record.highlightedWords),
    highlightedSentences: stringArray(record.highlightedSentences),
    nextReviewCount: typeof record.nextReviewCount === "number" ? record.nextReviewCount : 0,
    generatedAt: requireString(record, "generatedAt"),
  }
}

function parseWeeklyDigestEmailResponse(payload: unknown): MobileWeeklyDigestEmailResponse {
  if (!payload || typeof payload !== "object") throw new Error("Astra weekly digest email response was not an object.")
  const record = payload as Record<string, unknown>
  return {
    delivery: typeof record.delivery === "string" ? record.delivery : "unknown",
    digest: parseWeeklyDigest(record.digest),
  }
}

function parseWeeklyDigestPreferenceResponse(payload: unknown): MobileWeeklyDigestPreferenceResponse {
  if (!payload || typeof payload !== "object") throw new Error("Astra weekly digest preference response was not an object.")
  const record = payload as Record<string, unknown>
  const preference = record.preference && typeof record.preference === "object" ? record.preference as Record<string, unknown> : {}
  return {
    preference: { weekly_digest: preference.weekly_digest === true },
    serverTime: requireString(record, "serverTime"),
  }
}

function parseDevicePushTokenResponse(payload: unknown): MobileDevicePushTokenResponse {
  if (!payload || typeof payload !== "object") throw new Error("Astra device notification response was not an object.")
  const record = payload as Record<string, unknown>
  return {
    deviceId: requireString(record, "deviceId"),
    pushTokenStored: record.pushTokenStored === true,
    serverTime: requireString(record, "serverTime"),
  }
}

function parseSupportReportResponse(payload: unknown): MobileSupportReportResponse {
  if (!payload || typeof payload !== "object") throw new Error("Astra support response was not an object.")
  const record = payload as Record<string, unknown>
  const report = record.report && typeof record.report === "object" ? record.report as Record<string, unknown> : {}
  return {
    reportId: requireString(report, "reportId"),
    status: requireString(report, "status"),
    createdAt: requireString(report, "createdAt"),
    updatedAt: requireString(report, "updatedAt"),
    submittedAt: requireString(report, "submittedAt"),
    issueCategory: typeof report.issueCategory === "string" ? report.issueCategory : null,
    defaultContentIncluded: report.defaultContentIncluded === true,
    knownIssue: report.knownIssue ?? null,
  }
}

function parseAccountDataExport(payload: unknown): MobileAccountDataExport {
  if (!payload || typeof payload !== "object") throw new Error("Astra data export response was not an object.")
  const record = payload as Record<string, unknown>
  return {
    schema: requireString(record, "schema"),
    generatedAt: requireString(record, "generatedAt"),
    account: record.account && typeof record.account === "object" ? record.account as Record<string, unknown> : undefined,
    currentSession: record.currentSession && typeof record.currentSession === "object" ? record.currentSession as Record<string, unknown> : undefined,
    devices: Array.isArray(record.devices) ? record.devices : [],
    sessions: Array.isArray(record.sessions) ? record.sessions : [],
    oauthIdentities: Array.isArray(record.oauthIdentities) ? record.oauthIdentities : [],
    syncMutations: Array.isArray(record.syncMutations) ? record.syncMutations : [],
    weeklyDigests: Array.isArray(record.weeklyDigests) ? record.weeklyDigests : [],
    mobileRetentionEvents: Array.isArray(record.mobileRetentionEvents) ? record.mobileRetentionEvents : [],
  }
}

function createMobileSupportReportId(timestamp = Date.now()): string {
  return `rpt_${timestamp.toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

function supportMembershipState(plan: string | undefined): "free" | "trial" | "pro" | "expired" | "unknown" {
  if (plan === "free" || plan === "trial" || plan === "pro" || plan === "expired") return plan
  return "unknown"
}

function mobileSupportLocale(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale || "en-US"
  } catch {
    return "en-US"
  }
}

async function readError(response: Response): Promise<{ message: string; code: string | null }> {
  try {
    const payload = await response.json() as { error?: { message?: string; code?: string }; message?: string }
    return {
      message: payload.error?.message || payload.message || `Astra request failed with status ${response.status}.`,
      code: payload.error?.code ?? null,
    }
  } catch {
    return { message: `Astra request failed with status ${response.status}.`, code: null }
  }
}

async function readJson(response: Response): Promise<unknown> {
  if (!response.ok) {
    const error = await readError(response)
    throw new MobileAstraApiError({ message: error.message, code: error.code, status: response.status })
  }
  if (response.status === 204) return null
  return response.json()
}

function authHeaders(sessionToken: string, device: MobileDeviceIdentity, contentType = false): Record<string, string> {
  return {
    Authorization: `Bearer ${sessionToken}`,
    "X-Astra-Device-Id": device.deviceId,
    ...(contentType ? { "Content-Type": "application/json" } : {}),
  }
}

export function createMobileAstraClient(params: { baseURL: string; fetchImpl?: typeof fetch }): MobileAstraClient {
  const baseURL = normalizeMobileApiBaseUrl(params.baseURL)
  const fetchImpl = params.fetchImpl ?? fetch

  return {
    async signIn({ email, password, device, idempotencyKey }) {
      const response = await fetchImpl(`${baseURL}/auth/session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
          "X-Astra-Device-Id": device.deviceId,
        },
        body: JSON.stringify({ email: email.trim(), password, deviceId: device.deviceId, device }),
      })
      return parseSession(await readJson(response), { deviceId: device.deviceId, identityMode: "authenticated" })
    },

    async requestEmailSignInCode({ email }) {
      const response = await fetchImpl(`${baseURL}/auth/email-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      })
      return parseEmailSignInChallenge(await readJson(response))
    },

    async redeemEmailSignInCode({ email, code, device, idempotencyKey }) {
      const response = await fetchImpl(`${baseURL}/auth/email-code/redeem`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
          "X-Astra-Device-Id": device.deviceId,
        },
        body: JSON.stringify({ email: email.trim(), code: code.trim(), deviceId: device.deviceId, device }),
      })
      return parseSession(await readJson(response), { deviceId: device.deviceId, identityMode: "authenticated" })
    },

    async redeemOAuthIdentity({ identity, device, idempotencyKey }) {
      const idToken = "idToken" in identity && typeof identity.idToken === "string" ? identity.idToken.trim() : undefined
      const nonce = "nonce" in identity && typeof identity.nonce === "string" ? identity.nonce.trim() : undefined
      if (idToken && !nonce) {
        throw new MobileAstraApiError({ status: 400, code: "INVALID_REQUEST", message: "OAuth nonce is required." })
      }
      const response = await fetchImpl(`${baseURL}/auth/oauth/redeem`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
          "X-Astra-Device-Id": device.deviceId,
        },
        body: JSON.stringify({
          provider: identity.provider,
          idToken,
          nonce,
          subject: "subject" in identity && typeof identity.subject === "string" ? identity.subject.trim() : undefined,
          email: "email" in identity ? identity.email?.trim() || undefined : undefined,
          emailVerified: "emailVerified" in identity ? identity.emailVerified : undefined,
          verified: idToken ? undefined : true,
          deviceId: device.deviceId,
          device,
        }),
      })
      return parseSession(await readJson(response), { deviceId: device.deviceId, identityMode: "authenticated" })
    },

    async requestMobileLink({ session, device }) {
      const response = await fetchImpl(`${normalizeMobileApiBaseUrl(session.relayBaseURL)}/auth/mobile-link`, {
        method: "POST",
        headers: authHeaders(session.sessionToken, device, true),
        body: JSON.stringify({}),
      })
      return parseMobileLinkChallenge(await readJson(response))
    },

    async redeemMobileLink({ code, device, idempotencyKey }) {
      const response = await fetchImpl(`${baseURL}/auth/mobile-link/redeem`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
          "X-Astra-Device-Id": device.deviceId,
        },
        body: JSON.stringify({ code: code.trim(), deviceId: device.deviceId, device }),
      })
      return parseSession(await readJson(response), { deviceId: device.deviceId, identityMode: "authenticated" })
    },

    async refreshSession({ session, device }) {
      const response = await fetchImpl(`${normalizeMobileApiBaseUrl(session.relayBaseURL)}/auth/session`, {
        method: "GET",
        headers: authHeaders(session.sessionToken, device),
      })
      return parseSession(await readJson(response), { deviceId: device.deviceId, identityMode: "authenticated" })
    },

    async revokeSession({ session, device }) {
      const response = await fetchImpl(`${normalizeMobileApiBaseUrl(session.relayBaseURL)}/auth/session`, {
        method: "DELETE",
        headers: authHeaders(session.sessionToken, device),
      })
      await readJson(response)
    },

    async deleteAccount({ session, device }) {
      const response = await fetchImpl(`${normalizeMobileApiBaseUrl(session.relayBaseURL)}/account`, {
        method: "DELETE",
        headers: authHeaders(session.sessionToken, device),
      })
      await readJson(response)
    },

    async fetchWeeklyDigest({ session, device, now }) {
      const params = now ? `?now=${encodeURIComponent(now.toISOString())}` : ""
      const response = await fetchImpl(`${normalizeMobileApiBaseUrl(session.relayBaseURL)}/account/weekly-digest${params}`, {
        method: "GET",
        headers: authHeaders(session.sessionToken, device),
      })
      return parseWeeklyDigest(await readJson(response))
    },

    async requestWeeklyDigestEmail({ session, device, now }) {
      const params = now ? `?now=${encodeURIComponent(now.toISOString())}` : ""
      const response = await fetchImpl(`${normalizeMobileApiBaseUrl(session.relayBaseURL)}/account/weekly-digest/email${params}`, {
        method: "POST",
        headers: authHeaders(session.sessionToken, device),
      })
      return parseWeeklyDigestEmailResponse(await readJson(response))
    },

    async updateWeeklyDigestPreference({ session, device, enabled }) {
      const response = await fetchImpl(`${normalizeMobileApiBaseUrl(session.relayBaseURL)}/account/preferences/weekly-digest`, {
        method: "PATCH",
        headers: authHeaders(session.sessionToken, device, true),
        body: JSON.stringify({ enabled }),
      })
      return parseWeeklyDigestPreferenceResponse(await readJson(response))
    },

    async updateCurrentDevicePushToken({ session, device, expoPushToken, platform }) {
      const response = await fetchImpl(`${normalizeMobileApiBaseUrl(session.relayBaseURL)}/account/devices/current/push-token`, {
        method: "PATCH",
        headers: authHeaders(session.sessionToken, device, true),
        body: JSON.stringify({ expoPushToken, platform: platform ?? device.platform ?? null }),
      })
      return parseDevicePushTokenResponse(await readJson(response))
    },

    async submitSupportReport({ session, device, featureSurface, issueCategory = "other", action = "mobile_help_note_sent" }) {
      const timestamp = new Date().toISOString()
      const bundle = {
        schema: "astra-support-bundle.v1",
        reportId: createMobileSupportReportId(),
        userConsent: true,
        extensionVersion: device.appVersion,
        browser: `Astra mobile ${device.platform}`,
        os: device.platform,
        locale: mobileSupportLocale(),
        featureSurface,
        action,
        issueCategory,
        runtimeSurface: "mobile_companion",
        timestamp,
        privacyMode: true,
        membershipState: supportMembershipState(session.plan),
        userMessageIncluded: false,
        contactIncluded: false,
        contentIncluded: { enabled: false, type: "none" },
      }
      const response = await fetchImpl(`${normalizeMobileApiBaseUrl(session.relayBaseURL)}/support/reports`, {
        method: "POST",
        headers: authHeaders(session.sessionToken, device, true),
        body: JSON.stringify({ bundle }),
      })
      return parseSupportReportResponse(await readJson(response))
    },

    async exportAccountData({ session, device }) {
      const response = await fetchImpl(`${normalizeMobileApiBaseUrl(session.relayBaseURL)}/account/export`, {
        method: "GET",
        headers: authHeaders(session.sessionToken, device),
      })
      return parseAccountDataExport(await readJson(response))
    },

    async fetchSyncBootstrap({ session, device }) {
      const response = await fetchImpl(`${normalizeMobileApiBaseUrl(session.relayBaseURL)}/sync/bootstrap`, {
        method: "GET",
        headers: authHeaders(session.sessionToken, device),
      })
      return await readJson(response) as MobileSyncBootstrapResponse
    },

    async pullSyncDeltas({ session, device, cursors }) {
      const response = await fetchImpl(`${normalizeMobileApiBaseUrl(session.relayBaseURL)}/sync/pull`, {
        method: "POST",
        headers: authHeaders(session.sessionToken, device, true),
        body: JSON.stringify({ cursors }),
      })
      return await readJson(response) as MobileSyncPullResponse
    },

    async pushSyncMutations({ session, device, mutations }) {
      const response = await fetchImpl(`${normalizeMobileApiBaseUrl(session.relayBaseURL)}/sync/push`, {
        method: "POST",
        headers: authHeaders(session.sessionToken, device, true),
        body: JSON.stringify({ mutations }),
      })
      return await readJson(response) as MobileSyncPushResponse
    },

    async requestCloudDataDelete({ session, device, collections, idempotencyKey }) {
      const response = await fetchImpl(`${normalizeMobileApiBaseUrl(session.relayBaseURL)}/account/cloud-data-delete`, {
        method: "POST",
        headers: {
          ...authHeaders(session.sessionToken, device, true),
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({ collections }),
      })
      return parseCloudDataDeleteJob(await readJson(response))
    },

    async fetchCloudDataDeleteJob({ session, device, jobId }) {
      const response = await fetchImpl(`${normalizeMobileApiBaseUrl(session.relayBaseURL)}/account/cloud-data-delete/${encodeURIComponent(jobId)}`, {
        method: "GET",
        headers: authHeaders(session.sessionToken, device),
      })
      return parseCloudDataDeleteJob(await readJson(response))
    },

    async uploadMobileRetentionEvents({ session, device, events, idempotencyKey }) {
      const response = await fetchImpl(`${normalizeMobileApiBaseUrl(session.relayBaseURL)}/account/mobile-retention-events`, {
        method: "POST",
        headers: {
          ...authHeaders(session.sessionToken, device, true),
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({ schema: "astra-mobile-retention-events.v1", events }),
      })
      return await readJson(response) as MobileRetentionUploadResponse
    },
  }
}
