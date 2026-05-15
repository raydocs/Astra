interface RelayLiteEnv {
  OPENROUTER_API_KEY: string
  ASTRA_SESSION_SECRET: string
  ASTRA_OPENROUTER_MODEL?: string
  ASTRA_CORS_ALLOWED_ORIGINS?: string
  ASTRA_FREE_DAILY_REQUESTS?: string
  ASTRA_FREE_DAILY_CHARACTERS?: string
  ASTRA_FREE_RPM?: string
  ASTRA_SESSION_TTL_SECONDS?: string
}

type SessionPayload = {
  sessionId: string
  deviceId: string | null
  email: string
  identityMode: "anonymous" | "authenticated"
  issuedAt: string
  expiresAt: string
}

const CORS_HEADERS = "authorization, content-type, idempotency-key, x-astra-device-id"
const PROVIDER_ENTITLEMENTS = ["google_translate", "openai", "gemini"] as const
const SYNC_COLLECTIONS = ["config", "vocabulary", "review_schedule", "reading_history", "study_progress"] as const

function json(data: unknown, init: ResponseInit = {}, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...extraHeaders,
      ...init.headers,
    },
  })
}

function error(status: number, code: string, message: string, requestId: string, headers: Record<string, string>) {
  return json({ error: { code, message, requestId } }, { status }, headers)
}

function allowedOrigin(request: Request, env: RelayLiteEnv) {
  const origin = request.headers.get("origin")?.trim()
  if (!origin) return null
  const allowed = (env.ASTRA_CORS_ALLOWED_ORIGINS ?? "*").split(",").map((entry) => entry.trim()).filter(Boolean)
  if (allowed.includes("*")) return "*"
  return allowed.includes(origin) ? origin : null
}

function corsHeaders(request: Request, env: RelayLiteEnv) {
  const origin = allowedOrigin(request, env)
  if (!origin) return {}
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "access-control-allow-headers": CORS_HEADERS,
    "access-control-max-age": "86400",
    ...(origin === "*" ? {} : { vary: "Origin" }),
  }
}

function base64Url(bytes: ArrayBuffer | Uint8Array) {
  const array = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let binary = ""
  array.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

function base64UrlDecode(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=")
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

async function hmac(secret: string, input: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  return base64Url(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(input)))
}

async function signSession(payload: SessionPayload, env: RelayLiteEnv) {
  const body = base64Url(new TextEncoder().encode(JSON.stringify(payload)))
  const signature = await hmac(env.ASTRA_SESSION_SECRET, body)
  return `${body}.${signature}`
}

async function verifySession(request: Request, env: RelayLiteEnv): Promise<SessionPayload | null> {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim()
  if (!token) return null
  const [body, signature] = token.split(".")
  if (!body || !signature) return null
  const expected = await hmac(env.ASTRA_SESSION_SECRET, body)
  if (signature !== expected) return null
  const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(body))) as SessionPayload
  if (Date.parse(payload.expiresAt) <= Date.now()) return null
  return payload
}

function numberEnv(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function relayBaseUrl(request: Request) {
  return `${new URL(request.url).origin}/v1`
}

function usage(env: RelayLiteEnv, generatedAt = new Date().toISOString()) {
  const dailyRequestsLimit = numberEnv(env.ASTRA_FREE_DAILY_REQUESTS, 200)
  const dailyCharactersLimit = numberEnv(env.ASTRA_FREE_DAILY_CHARACTERS, 200000)
  return {
    generatedAt,
    quota: {
      dailyRequestsLimit,
      dailyCharactersLimit,
      requestsPerMinuteLimit: numberEnv(env.ASTRA_FREE_RPM, 20),
      remainingDailyRequests: dailyRequestsLimit,
      remainingDailyCharacters: dailyCharactersLimit,
    },
    usage: {
      totalRequests: 0,
      totalCharacters: 0,
      dailyRequestsUsed: 0,
      dailyCharactersUsed: 0,
      lastRequestAt: null,
      recentEvents: [],
    },
  }
}

function sessionResponse(request: Request, env: RelayLiteEnv, payload: SessionPayload, token: string) {
  return {
    version: 1,
    sessionToken: token,
    sessionId: payload.sessionId,
    deviceId: payload.deviceId,
    identityMode: payload.identityMode,
    relayBaseURL: relayBaseUrl(request),
    email: payload.email,
    plan: "free",
    subscriptionStatus: "active",
    providerEntitlements: [...PROVIDER_ENTITLEMENTS],
    quota: usage(env).quota,
    usage: usage(env).usage,
    issuedAt: payload.issuedAt,
    expiresAt: payload.expiresAt,
  }
}

function account(request: Request, payload: SessionPayload) {
  return {
    id: payload.sessionId,
    relayBaseURL: relayBaseUrl(request),
    email: payload.email,
    billingEmail: payload.email,
    createdAt: payload.issuedAt,
    plan: "free",
    subscriptionStatus: "active",
    providerEntitlements: [...PROVIDER_ENTITLEMENTS],
  }
}

function deviceEntry(payload: SessionPayload, requestDeviceId: string | null) {
  const deviceId = requestDeviceId || payload.deviceId || "web"
  return {
    deviceId,
    label: "Astra Web",
    platform: "unknown",
    browserFamily: "unknown",
    appKind: "web",
    appVersion: "0.1.0-web",
    firstSeenAt: payload.issuedAt,
    lastSeenAt: new Date().toISOString(),
    lastSyncAt: null,
    status: "active",
    isCurrentDevice: true,
  }
}

function syncCollections() {
  return Object.fromEntries(SYNC_COLLECTIONS.map((collection) => [
    collection,
    { enabled: false, defaultEnabled: false, cursor: null },
  ]))
}

function syncSummaryCollections() {
  return Object.fromEntries(SYNC_COLLECTIONS.map((collection) => [
    collection,
    { enabled: false, defaultEnabled: false, cursor: null, mutationCount: 0, activeCount: 0, lastSyncAt: null, compactionFloorCursor: null },
  ]))
}

async function createAnonymousSession(request: Request, env: RelayLiteEnv, headers: Record<string, string>) {
  const body = await request.json().catch(() => ({})) as { deviceId?: string; email?: string }
  const now = new Date()
  const expiresAt = new Date(now.getTime() + numberEnv(env.ASTRA_SESSION_TTL_SECONDS, 2592000) * 1000)
  const payload: SessionPayload = {
    sessionId: crypto.randomUUID(),
    deviceId: body.deviceId ?? request.headers.get("x-astra-device-id") ?? null,
    email: body.email ?? "anonymous@astra.local",
    identityMode: "anonymous",
    issuedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  }
  const token = await signSession(payload, env)
  return json(sessionResponse(request, env, payload, token), { status: 200 }, headers)
}

async function requireSession(request: Request, env: RelayLiteEnv, requestId: string, headers: Record<string, string>) {
  const payload = await verifySession(request, env)
  if (!payload) {
    return {
      payload: null,
      response: error(401, "UNAUTHENTICATED", "A valid Astra session is required.", requestId, headers),
    }
  }
  return { payload, response: null }
}

function buildTranslationPrompt(body: Record<string, unknown>) {
  const texts = Array.isArray(body.texts) ? body.texts.map(String) : []
  const task = typeof body.task === "string" ? body.task : "translate"
  const targetLang = typeof body.targetLang === "string" ? body.targetLang : "zh-CN"
  const context = typeof body.context === "string" ? body.context : ""
  return [
    `Task: ${task}`,
    `Target language: ${targetLang}`,
    context ? `Context: ${context}` : "",
    "Return only a JSON array of strings, in the same order and length as the input array.",
    `Input JSON: ${JSON.stringify(texts)}`,
  ].filter(Boolean).join("\n")
}

function parseTranslations(content: string, expectedLength: number) {
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "")
  const parsed = JSON.parse(cleaned)
  if (!Array.isArray(parsed) || parsed.length !== expectedLength || !parsed.every((item) => typeof item === "string")) {
    throw new Error("OpenRouter returned an invalid translation array.")
  }
  return parsed.map((item) => item.trim())
}

async function translate(request: Request, env: RelayLiteEnv, requestId: string, headers: Record<string, string>) {
  const auth = await requireSession(request, env, requestId, headers)
  if (auth.response) return auth.response

  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  const texts = Array.isArray(body?.texts) ? body.texts.map(String) : []
  const characterCount = texts.reduce((sum, text) => sum + text.length, 0)
  if (texts.length === 0 || texts.length > 20 || characterCount > 5000) {
    return error(400, "INVALID_REQUEST", "Translate requests must include 1-20 texts and at most 5000 characters.", requestId, headers)
  }

  const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "authorization": `Bearer ${env.OPENROUTER_API_KEY}`,
      "content-type": "application/json",
      "http-referer": "https://astra-web.pages.dev",
      "x-title": "Astra",
    },
    body: JSON.stringify({
      model: env.ASTRA_OPENROUTER_MODEL || "openai/gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: "You are Astra's bilingual reading assistant. Follow the requested task and return strict JSON only." },
        { role: "user", content: buildTranslationPrompt(body ?? {}) },
      ],
    }),
  })

  if (!upstream.ok) {
    const message = await upstream.text().catch(() => "")
    return error(502, "PROVIDER_REQUEST_FAILED", message || `OpenRouter request failed with status ${upstream.status}.`, requestId, headers)
  }

  const payload = await upstream.json() as { choices?: Array<{ message?: { content?: string } }> }
  const content = payload.choices?.[0]?.message?.content
  if (!content) {
    return error(502, "PROVIDER_PARSE_FAILED", "OpenRouter returned an empty response.", requestId, headers)
  }

  try {
    return json({ translations: parseTranslations(content, texts.length) }, { status: 200 }, headers)
  } catch (parseError) {
    return error(
      502,
      "PROVIDER_PARSE_FAILED",
      parseError instanceof Error ? parseError.message : "OpenRouter returned an invalid response.",
      requestId,
      headers,
    )
  }
}

async function fetchHandler(request: Request, env: RelayLiteEnv): Promise<Response> {
  const requestId = crypto.randomUUID()
  const headers = corsHeaders(request, env)
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers })

  if (!env.OPENROUTER_API_KEY || !env.ASTRA_SESSION_SECRET) {
    return error(500, "CONFIG_MISSING", "Astra relay secrets are not configured.", requestId, headers)
  }

  const url = new URL(request.url)
  if (url.pathname === "/v1/auth/anonymous" && request.method === "POST") {
    return createAnonymousSession(request, env, headers)
  }

  if (url.pathname === "/v1/auth/session" && request.method === "GET") {
    const auth = await requireSession(request, env, requestId, headers)
    if (auth.response) return auth.response
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ?? ""
    return json(sessionResponse(request, env, auth.payload, token), { status: 200 }, headers)
  }

  if (url.pathname === "/v1/auth/session" && request.method === "DELETE") {
    return new Response(null, { status: 204, headers })
  }

  if (url.pathname === "/v1/account/summary" && request.method === "GET") {
    const auth = await requireSession(request, env, requestId, headers)
    if (auth.response) return auth.response
    const currentDevice = deviceEntry(auth.payload, request.headers.get("x-astra-device-id"))
    return json({
      serverTime: new Date().toISOString(),
      account: account(request, auth.payload),
      usage: usage(env),
      session: {
        sessionId: auth.payload.sessionId,
        deviceId: auth.payload.deviceId,
        issuedAt: auth.payload.issuedAt,
        expiresAt: auth.payload.expiresAt,
        identityMode: auth.payload.identityMode,
        status: "active",
      },
      devices: { activeCount: 1, revokedCount: 0, current: currentDevice, entries: [currentDevice] },
      sync: { maxMutationsPerRequest: 200, collections: syncSummaryCollections() },
    }, { status: 200 }, headers)
  }

  if (url.pathname === "/v1/account" && request.method === "GET") {
    const auth = await requireSession(request, env, requestId, headers)
    return auth.response ?? json(account(request, auth.payload), { status: 200 }, headers)
  }

  if (url.pathname === "/v1/account/usage" && request.method === "GET") {
    const auth = await requireSession(request, env, requestId, headers)
    return auth.response ?? json(usage(env), { status: 200 }, headers)
  }

  if (url.pathname === "/v1/devices" && request.method === "GET") {
    const auth = await requireSession(request, env, requestId, headers)
    return auth.response ?? json({ devices: [deviceEntry(auth.payload, request.headers.get("x-astra-device-id"))] }, { status: 200 }, headers)
  }

  if (url.pathname === "/v1/sync/bootstrap" && request.method === "GET") {
    const auth = await requireSession(request, env, requestId, headers)
    return auth.response ?? json({
      serverTime: new Date().toISOString(),
      deviceId: request.headers.get("x-astra-device-id") || auth.payload.deviceId || "web",
      collections: syncCollections(),
      limits: { maxMutationsPerRequest: 200 },
      transport: { deviceHeader: "X-Astra-Device-Id", idempotencyKey: "clientMutationId", cursorMode: "per-collection" },
    }, { status: 200 }, headers)
  }

  if (url.pathname === "/v1/sync/pull" && request.method === "POST") {
    const auth = await requireSession(request, env, requestId, headers)
    if (auth.response) return auth.response
    return json({
      serverTime: new Date().toISOString(),
      deltas: Object.fromEntries(SYNC_COLLECTIONS.map((collection) => [collection, []])),
      nextCursors: Object.fromEntries(SYNC_COLLECTIONS.map((collection) => [collection, null])),
    }, { status: 200 }, headers)
  }

  if (url.pathname === "/v1/translate" && request.method === "POST") {
    return translate(request, env, requestId, headers)
  }

  return error(404, "NOT_FOUND", "Route not found.", requestId, headers)
}

export default {
  fetch: fetchHandler,
}
