import { z } from "zod"

import { AstraIdentityModeSchema } from "../../types/auth"

export const AstraSessionClaimsSchema = z.object({
  email: z.string().trim().min(1),
  relayBaseURL: z.string().trim().min(1),
  issuedAt: z.string().trim().min(1),
  expiresAt: z.string().trim().min(1).nullable(),
  sessionId: z.string().trim().min(1),
  deviceId: z.string().trim().min(1),
  identityMode: AstraIdentityModeSchema.default("authenticated"),
})

export type AstraSessionClaims = z.infer<typeof AstraSessionClaimsSchema>
export const ASTRA_SESSION_TOKEN_FORMAT_VERSION = 1 as const

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ""
  const chunkSize = 0x8000
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize)
    let chunkBinary = ""
    for (const value of chunk) {
      chunkBinary += String.fromCharCode(value)
    }
    binary += chunkBinary
  }
  return btoa(binary)
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

function toBase64Url(value: string): string {
  return value.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

function fromBase64Url(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/")
  return normalized + "=".repeat((4 - (normalized.length % 4)) % 4)
}

function encodeUtf8Base64Url(value: string): string {
  return toBase64Url(bytesToBase64(textEncoder.encode(value)))
}

function decodeUtf8Base64Url(value: string): string {
  return textDecoder.decode(base64ToBytes(fromBase64Url(value)))
}

function splitSessionToken(token: string | null | undefined): [string, string] | null {
  if (!token) return null
  const [payload, signature, ...rest] = token.split(".")
  if (!payload || !signature || rest.length > 0) {
    return null
  }
  return [payload, signature]
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false
  }

  let diff = 0
  for (let index = 0; index < a.length; index += 1) {
    diff |= a[index]! ^ b[index]!
  }
  return diff === 0
}

function parseClaimsPayload(payload: string): AstraSessionClaims | null {
  try {
    return AstraSessionClaimsSchema.parse(JSON.parse(decodeUtf8Base64Url(payload)))
  } catch {
    return null
  }
}

async function signSessionPayload(payload: string, secret: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle
  if (!subtle) {
    throw new Error("Web Crypto subtle API is unavailable for Astra session signing.")
  }

  const key = await subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const signature = await subtle.sign("HMAC", key, textEncoder.encode(payload))
  return toBase64Url(bytesToBase64(new Uint8Array(signature)))
}

export function buildAstraSessionClaims(
  claims: AstraSessionClaims,
): AstraSessionClaims {
  return AstraSessionClaimsSchema.parse(claims)
}

export function parseBearerToken(header: string | null): string | null {
  if (!header) return null
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match ? match[1].trim() : null
}

export function decodeAstraSessionClaims(
  token: string | null | undefined,
): AstraSessionClaims | null {
  const parts = splitSessionToken(token)
  if (!parts) return null
  return parseClaimsPayload(parts[0])
}

export async function issueAstraSessionToken(
  claims: AstraSessionClaims,
  secret: string,
): Promise<string> {
  const payload = encodeUtf8Base64Url(JSON.stringify(buildAstraSessionClaims(claims)))
  const signature = await signSessionPayload(payload, secret)
  return `${payload}.${signature}`
}

export async function createAstraSessionTokenTestVector(params: {
  claims: AstraSessionClaims
  secret: string
}): Promise<{
  formatVersion: typeof ASTRA_SESSION_TOKEN_FORMAT_VERSION
  claims: AstraSessionClaims
  payload: string
  signature: string
  token: string
}> {
  const claims = buildAstraSessionClaims(params.claims)
  const payload = encodeUtf8Base64Url(JSON.stringify(claims))
  const signature = await signSessionPayload(payload, params.secret)

  return {
    formatVersion: ASTRA_SESSION_TOKEN_FORMAT_VERSION,
    claims,
    payload,
    signature,
    token: `${payload}.${signature}`,
  }
}

export async function verifyAstraSessionToken(
  token: string | null | undefined,
  secret: string,
): Promise<AstraSessionClaims | null> {
  const parts = splitSessionToken(token)
  if (!parts) return null

  const [payload, signature] = parts
  const claims = parseClaimsPayload(payload)
  if (!claims) return null

  try {
    const expected = await signSessionPayload(payload, secret)
    const actualBytes = base64ToBytes(fromBase64Url(signature))
    const expectedBytes = base64ToBytes(fromBase64Url(expected))
    if (!constantTimeEqual(actualBytes, expectedBytes)) {
      return null
    }
  } catch {
    return null
  }

  return claims
}
