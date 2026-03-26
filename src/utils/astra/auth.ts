import { z } from "zod"

import { AstraSessionSchema, type AstraSession } from "@/types/auth"

const AuthResponseSchema = AstraSessionSchema

function buildAuthUrl(baseURL: string): string {
  return `${baseURL.trim().replace(/\/+$/, "")}/auth/session`
}

async function parseAuthResponse(response: Response): Promise<AstraSession> {
  const payload = await response.json()
  return AuthResponseSchema.parse(payload)
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const payload = await response.json() as { error?: { message?: string }; message?: string }
    return payload.error?.message || payload.message || `Astra auth request failed with status ${response.status}.`
  } catch {
    return `Astra auth request failed with status ${response.status}.`
  }
}

function requireBaseURL(baseURL: string): string {
  const trimmed = baseURL.trim()
  if (!trimmed) {
    throw new Error("Astra API base URL is required.")
  }
  return trimmed
}

export async function createAstraSession(params: {
  baseURL: string
  email: string
  password: string
}): Promise<AstraSession> {
  const response = await fetch(buildAuthUrl(requireBaseURL(params.baseURL)), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: params.email.trim(),
      password: params.password,
    }),
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response))
  }

  return parseAuthResponse(response)
}

export async function refreshAstraSession(params: {
  baseURL: string
  sessionToken: string
}): Promise<AstraSession> {
  const response = await fetch(buildAuthUrl(requireBaseURL(params.baseURL)), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${params.sessionToken}`,
    },
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response))
  }

  return parseAuthResponse(response)
}

export async function revokeAstraSession(params: {
  baseURL: string
  sessionToken: string
}): Promise<void> {
  const response = await fetch(buildAuthUrl(requireBaseURL(params.baseURL)), {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${params.sessionToken}`,
    },
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response))
  }
}

export function parseAstraSessionPayload(payload: unknown): AstraSession {
  return AuthResponseSchema.parse(payload)
}

export const astraAuthResponseSchema = AuthResponseSchema
