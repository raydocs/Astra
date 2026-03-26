import { createServer, type IncomingMessage, type ServerResponse } from "node:http"

import { z } from "zod"

import { AstraError, toTranslationError } from "../src/types/translation"
import { ProviderIdSchema } from "../src/types/config"
import { TranslateBatchPayloadSchema } from "../src/types/messages"
import { AstraPlanSchema } from "../src/types/auth"

import { loadRelayEnv } from "./config"
import {
  issueSession,
  parseBearerToken,
  verifySessionToken,
} from "./auth"
import { createCheckoutLink, createPortalLink } from "./billing"
import { translateViaManagedProvider } from "./providers"
import { FileUserStore } from "./user-store"
import type { RelayEnv, RelayTranslateRequest } from "./types"

const LoginSchema = z.object({
  email: z.string().trim().min(1),
  password: z.string().min(1),
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

function requireSession(request: IncomingMessage, env: RelayEnv) {
  const token = parseBearerToken(request.headers.authorization ?? null)
  const authenticated = verifySessionToken(token, env)
  if (!authenticated) {
    throw new AstraError("CONFIG_MISSING", "Invalid or missing Astra session.")
  }
  return authenticated
}

function assertProviderEntitlement(provider: RelayTranslateRequest["provider"], entitlements: string[]) {
  if (!entitlements.includes(provider)) {
    throw new AstraError(
      "CONFIG_MISSING",
      `Current Astra plan does not allow provider: ${provider}.`,
    )
  }
}

async function handleAuthSession(
  request: IncomingMessage,
  response: ServerResponse,
  env: RelayEnv,
  revokedTokens: Set<string>,
  users: FileUserStore,
) {
  if (request.method === "POST") {
    const payload = LoginSchema.parse(await readJsonBody(request))
    const user = await users.validateCredentials(payload.email, payload.password)
    if (!user) {
      sendError(response, 401, "Invalid Astra credentials.", "CONFIG_MISSING")
      return
    }

    sendJson(response, 200, issueSession(user, env).session)
    return
  }

  if (request.method === "GET") {
    const authenticated = requireSession(request, env)
    if (revokedTokens.has(authenticated.token)) {
      sendError(response, 401, "Astra session has been revoked.", "CONFIG_MISSING")
      return
    }
    const session = await users.getSession(authenticated.claims.email, authenticated.token)
    if (!session) {
      sendError(response, 401, "Unknown Astra user.", "CONFIG_MISSING")
      return
    }
    sendJson(response, 200, session)
    return
  }

  if (request.method === "DELETE") {
    const authenticated = requireSession(request, env)
    revokedTokens.add(authenticated.token)
    response.writeHead(204)
    response.end()
    return
  }

  sendError(response, 405, "Method not allowed.", "INVALID_RESPONSE")
}

async function handleAccount(
  request: IncomingMessage,
  response: ServerResponse,
  env: RelayEnv,
  revokedTokens: Set<string>,
  users: FileUserStore,
) {
  const authenticated = requireSession(request, env)
  if (revokedTokens.has(authenticated.token)) {
    throw new AstraError("CONFIG_MISSING", "Astra session has been revoked.")
  }

  const account = await users.getAccount(authenticated.claims.email)
  if (!account) {
    throw new AstraError("CONFIG_MISSING", "Unknown Astra user.")
  }

  sendJson(response, 200, account)
}

async function handlePlanUpdate(
  request: IncomingMessage,
  response: ServerResponse,
  env: RelayEnv,
  revokedTokens: Set<string>,
  users: FileUserStore,
) {
  const authenticated = requireSession(request, env)
  if (revokedTokens.has(authenticated.token)) {
    throw new AstraError("CONFIG_MISSING", "Astra session has been revoked.")
  }

  const payload = PlanUpdateSchema.parse(await readJsonBody(request))
  const account = await users.updatePlan(authenticated.claims.email, payload.plan)
  if (!account) {
    throw new AstraError("CONFIG_MISSING", "Unknown Astra user.")
  }

  sendJson(response, 200, account)
}

async function handleUsage(
  request: IncomingMessage,
  response: ServerResponse,
  env: RelayEnv,
  revokedTokens: Set<string>,
  users: FileUserStore,
) {
  const authenticated = requireSession(request, env)
  if (revokedTokens.has(authenticated.token)) {
    throw new AstraError("CONFIG_MISSING", "Astra session has been revoked.")
  }

  const usage = await users.getUsageSnapshot(authenticated.claims.email)
  if (!usage) {
    throw new AstraError("CONFIG_MISSING", "Unknown Astra user.")
  }

  sendJson(response, 200, usage)
}

async function handleBillingCheckout(
  request: IncomingMessage,
  response: ServerResponse,
  env: RelayEnv,
  revokedTokens: Set<string>,
  users: FileUserStore,
) {
  const authenticated = requireSession(request, env)
  if (revokedTokens.has(authenticated.token)) {
    throw new AstraError("CONFIG_MISSING", "Astra session has been revoked.")
  }

  const payload = BillingCheckoutSchema.parse(await readJsonBody(request))
  const user = await users.findUserByEmail(authenticated.claims.email)
  if (!user) {
    throw new AstraError("CONFIG_MISSING", "Unknown Astra user.")
  }

  sendJson(response, 200, createCheckoutLink(user, env, payload.plan))
}

async function handleBillingPortal(
  request: IncomingMessage,
  response: ServerResponse,
  env: RelayEnv,
  revokedTokens: Set<string>,
  users: FileUserStore,
) {
  const authenticated = requireSession(request, env)
  if (revokedTokens.has(authenticated.token)) {
    throw new AstraError("CONFIG_MISSING", "Astra session has been revoked.")
  }

  const user = await users.findUserByEmail(authenticated.claims.email)
  if (!user) {
    throw new AstraError("CONFIG_MISSING", "Unknown Astra user.")
  }

  sendJson(response, 200, createPortalLink(user, env))
}

async function handleTranslate(
  request: IncomingMessage,
  response: ServerResponse,
  env: RelayEnv,
  revokedTokens: Set<string>,
  users: FileUserStore,
) {
  const authenticated = requireSession(request, env)
  if (revokedTokens.has(authenticated.token)) {
    throw new AstraError("CONFIG_MISSING", "Astra session has been revoked.")
  }
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
  sendJson(response, 200, { translations })
}

async function routeRequest(
  request: IncomingMessage,
  response: ServerResponse,
  env: RelayEnv,
  revokedTokens: Set<string>,
  users: FileUserStore,
) {
  try {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`)

    if (url.pathname === "/v1/auth/session") {
      await handleAuthSession(request, response, env, revokedTokens, users)
      return
    }

    if (url.pathname === "/v1/account" && request.method === "GET") {
      await handleAccount(request, response, env, revokedTokens, users)
      return
    }

    if (url.pathname === "/v1/account/plan" && request.method === "PATCH") {
      await handlePlanUpdate(request, response, env, revokedTokens, users)
      return
    }

    if (url.pathname === "/v1/account/usage" && request.method === "GET") {
      await handleUsage(request, response, env, revokedTokens, users)
      return
    }

    if (url.pathname === "/v1/billing/checkout" && request.method === "POST") {
      await handleBillingCheckout(request, response, env, revokedTokens, users)
      return
    }

    if (url.pathname === "/v1/billing/portal" && request.method === "POST") {
      await handleBillingPortal(request, response, env, revokedTokens, users)
      return
    }

    if (url.pathname === "/v1/translate" && request.method === "POST") {
      await handleTranslate(request, response, env, revokedTokens, users)
      return
    }

    sendError(response, 404, "Route not found.", "CONTENT_UNAVAILABLE")
  } catch (error) {
    const translationError = toTranslationError(error, "UNKNOWN")
    sendJson(response, 400, { error: translationError })
  }
}

export function createAstraRelayServer(env: RelayEnv = loadRelayEnv()) {
  const revokedTokens = new Set<string>()
  const users = new FileUserStore(env)
  return createServer((request, response) => {
    void routeRequest(request, response, env, revokedTokens, users)
  })
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const env = loadRelayEnv()
  const server = createAstraRelayServer(env)
  server.listen(env.port, env.host, () => {
    console.log(`Astra relay listening at ${env.publicBaseURL}`)
  })
}
