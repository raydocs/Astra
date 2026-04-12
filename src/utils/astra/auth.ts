import { z } from "zod"

import { AstraSessionSchema, type AstraIdentityMode, type AstraSession } from "@/types/auth"
import {
  clearPendingAstraSignInAttempt,
  clearPendingAnonymousBootstrapKey,
  ensureAstraDeviceIdentity,
  readPendingAstraSignInAttempt,
  readPendingAnonymousBootstrapKey,
  savePendingAstraSignInAttempt,
  savePendingAnonymousBootstrapKey,
} from "@/utils/storage/auth"

const AuthResponseSchema = AstraSessionSchema

function buildAuthUrl(baseURL: string): string {
  return `${baseURL.trim().replace(/\/+$/, "")}/auth/session`
}

function buildAnonymousAuthUrl(baseURL: string): string {
  return `${baseURL.trim().replace(/\/+$/, "")}/auth/anonymous`
}

async function parseAuthResponse(
  response: Response,
  fallback: Partial<Pick<AstraSession, "deviceId" | "identityMode">>,
): Promise<AstraSession> {
  const payload = await response.json()
  return AuthResponseSchema.parse({
    ...payload,
    deviceId: z.string().trim().min(1).safeParse((payload as { deviceId?: unknown })?.deviceId).success
      ? (payload as { deviceId: string }).deviceId
      : fallback.deviceId ?? null,
    identityMode: z.enum(["anonymous", "authenticated"]).safeParse((payload as { identityMode?: unknown })?.identityMode).success
      ? (payload as { identityMode: AstraIdentityMode }).identityMode
      : fallback.identityMode ?? "authenticated",
  })
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const payload = await response.json() as { error?: { message?: string }; message?: string }
    return payload.error?.message || payload.message || `Astra auth request failed with status ${response.status}.`
  } catch {
    return `Astra auth request failed with status ${response.status}.`
  }
}

async function readErrorPayload(response: Response): Promise<{
  code: string | null
  message: string
  fallbackReason: string | null
}> {
  const fallbackReason = response.headers.get("x-astra-platform-fallback-reason")?.trim() || null
  try {
    const payload = await response.json() as { error?: { code?: string; message?: string }; message?: string }
    return {
      code: payload.error?.code?.trim() || null,
      message: payload.error?.message || payload.message || `Astra auth request failed with status ${response.status}.`,
      fallbackReason,
    }
  } catch {
    return {
      code: null,
      message: `Astra auth request failed with status ${response.status}.`,
      fallbackReason,
    }
  }
}

export class AstraAuthRequestError extends Error {
  readonly status: number
  readonly code: string | null
  readonly fallbackReason: string | null

  constructor(params: {
    status: number
    code: string | null
    message: string
    fallbackReason?: string | null
  }) {
    super(params.message)
    this.name = "AstraAuthRequestError"
    this.status = params.status
    this.code = params.code
    this.fallbackReason = params.fallbackReason ?? null
  }
}

function createOpaqueIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }

  return `astra-idem-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function requireBaseURL(baseURL: string): string {
  const trimmed = baseURL.trim()
  if (!trimmed) {
    throw new Error("Astra API base URL is required.")
  }
  return trimmed
}

function normalizeAccountEmail(email: string): string {
  return email.trim().toLowerCase()
}

async function issueAuthenticatedAstraSession(params: {
  baseURL: string
  email: string
  password: string
  idempotencyKey: string
}): Promise<AstraSession> {
  const device = await ensureAstraDeviceIdentity()
  const response = await fetch(buildAuthUrl(requireBaseURL(params.baseURL)), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": params.idempotencyKey,
      "X-Astra-Device-Id": device.deviceId,
    },
    body: JSON.stringify({
      email: params.email.trim(),
      password: params.password,
      deviceId: device.deviceId,
      device: {
        label: device.label,
        platform: device.platform,
        browserFamily: device.browserFamily,
        appKind: device.appKind,
        appVersion: device.appVersion,
      },
    }),
  })

  if (!response.ok) {
    const error = await readErrorPayload(response)
    throw new AstraAuthRequestError({
      status: response.status,
      code: error.code,
      message: error.message,
      fallbackReason: error.fallbackReason,
    })
  }

  return parseAuthResponse(response, {
    deviceId: device.deviceId,
    identityMode: "authenticated",
  })
}

export async function createAstraSession(params: {
  baseURL: string
  email: string
  password: string
}): Promise<AstraSession> {
  const normalizedEmail = normalizeAccountEmail(params.email)
  const pendingAttempt = await readPendingAstraSignInAttempt()
  const idempotencyKey = pendingAttempt?.email === normalizedEmail
    ? pendingAttempt.idempotencyKey
    : createOpaqueIdempotencyKey()

  if (pendingAttempt?.email !== normalizedEmail || pendingAttempt?.idempotencyKey !== idempotencyKey) {
    await savePendingAstraSignInAttempt(normalizedEmail, idempotencyKey)
  }

  try {
    const session = await issueAuthenticatedAstraSession({
      ...params,
      idempotencyKey,
    })
    await clearPendingAstraSignInAttempt()
    return session
  } catch (error) {
    if (
      error instanceof AstraAuthRequestError
      && !(error.status === 503 && error.fallbackReason === "mirror_back_commit_unknown")
    ) {
      await clearPendingAstraSignInAttempt()
    }
    throw error
  }
}

export async function refreshAstraSession(params: {
  baseURL: string
  sessionToken: string
}): Promise<AstraSession> {
  const device = await ensureAstraDeviceIdentity()
  const response = await fetch(buildAuthUrl(requireBaseURL(params.baseURL)), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${params.sessionToken}`,
      "X-Astra-Device-Id": device.deviceId,
    },
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response))
  }

  return parseAuthResponse(response, {
    deviceId: device.deviceId,
    identityMode: "authenticated",
  })
}

export async function revokeAstraSession(params: {
  baseURL: string
  sessionToken: string
}): Promise<void> {
  const device = await ensureAstraDeviceIdentity()
  const response = await fetch(buildAuthUrl(requireBaseURL(params.baseURL)), {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${params.sessionToken}`,
      "X-Astra-Device-Id": device.deviceId,
    },
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response))
  }
}

export async function createAnonymousAstraSession(params: {
  baseURL: string
  idempotencyKey: string
}): Promise<AstraSession> {
  const device = await ensureAstraDeviceIdentity()
  const response = await fetch(buildAnonymousAuthUrl(requireBaseURL(params.baseURL)), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": params.idempotencyKey,
      "X-Astra-Device-Id": device.deviceId,
    },
    body: JSON.stringify({
      deviceId: device.deviceId,
      installId: device.deviceId,
      device: {
        label: device.label,
        platform: device.platform,
        browserFamily: device.browserFamily,
        appKind: device.appKind,
        appVersion: device.appVersion,
      },
    }),
  })

  if (!response.ok) {
    const error = await readErrorPayload(response)
    throw new AstraAuthRequestError({
      status: response.status,
      code: error.code,
      message: error.message,
      fallbackReason: error.fallbackReason,
    })
  }

  return parseAuthResponse(response, {
    deviceId: device.deviceId,
    identityMode: "anonymous",
  })
}

export async function bootstrapAnonymousAstraSession(params: {
  baseURL: string
}): Promise<AstraSession> {
  const pendingKey = await readPendingAnonymousBootstrapKey()
  const idempotencyKey = pendingKey ?? createOpaqueIdempotencyKey()

  if (!pendingKey) {
    await savePendingAnonymousBootstrapKey(idempotencyKey)
  }

  try {
    const session = await createAnonymousAstraSession({
      baseURL: params.baseURL,
      idempotencyKey,
    })
    await clearPendingAnonymousBootstrapKey()
    return session
  } catch (error) {
    if (
      error instanceof AstraAuthRequestError
      && (error.status === 409 || (error.status === 400 && error.code === "INVALID_REQUEST"))
    ) {
      await clearPendingAnonymousBootstrapKey()
    }
    throw error
  }
}

export function parseAstraSessionPayload(
  payload: unknown,
  fallback: Partial<Pick<AstraSession, "deviceId" | "identityMode">> = {},
): AstraSession {
  return AuthResponseSchema.parse({
    ...(typeof payload === "object" && payload !== null ? payload : {}),
    deviceId: (typeof payload === "object" && payload !== null && typeof (payload as { deviceId?: unknown }).deviceId === "string")
      ? (payload as { deviceId: string }).deviceId
      : fallback.deviceId ?? null,
    identityMode: (typeof payload === "object" && payload !== null && ((payload as { identityMode?: unknown }).identityMode === "anonymous" || (payload as { identityMode?: unknown }).identityMode === "authenticated"))
      ? (payload as { identityMode: AstraIdentityMode }).identityMode
      : fallback.identityMode ?? "authenticated",
  })
}

export const astraAuthResponseSchema = AuthResponseSchema
