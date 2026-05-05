import { browser } from "#imports"

import {
  AstraBrowserFamilySchema,
  AstraDeviceIdentitySchema,
  AstraDevicePlatformSchema,
  AstraSessionSchema,
  type AstraBrowserFamily,
  type AstraDeviceIdentity,
  type AstraDevicePlatform,
  type AstraSession,
} from "@/types/auth"

export const ASTRA_AUTH_STORAGE_KEY = "astra.auth.v1"
export const ASTRA_DEVICE_STORAGE_KEY = "astra.device.v1"
export const ASTRA_ANONYMOUS_BOOTSTRAP_KEY_STORAGE_KEY = "astra.auth.anonymous-bootstrap-key.v1"
export const ASTRA_AUTH_SIGN_IN_KEY_STORAGE_KEY = "astra.auth.sign-in-key.v1"

function generateOpaqueDeviceId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }

  return `astra-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function detectPlatform(): AstraDevicePlatform {
  const userAgent = globalThis.navigator?.userAgent ?? ""
  const platform = globalThis.navigator?.platform ?? ""
  const normalized = `${platform} ${userAgent}`.toLowerCase()

  if (normalized.includes("iphone") || normalized.includes("ipad") || normalized.includes("ios")) {
    return AstraDevicePlatformSchema.parse("ios")
  }
  if (normalized.includes("android")) {
    return AstraDevicePlatformSchema.parse("android")
  }
  if (normalized.includes("mac")) {
    return AstraDevicePlatformSchema.parse("macos")
  }
  if (normalized.includes("win")) {
    return AstraDevicePlatformSchema.parse("windows")
  }
  if (normalized.includes("linux")) {
    return AstraDevicePlatformSchema.parse("linux")
  }

  return AstraDevicePlatformSchema.parse("unknown")
}

function detectBrowserFamily(): AstraBrowserFamily {
  const userAgent = (globalThis.navigator?.userAgent ?? "").toLowerCase()

  if (userAgent.includes("edg/")) {
    return AstraBrowserFamilySchema.parse("edge")
  }
  if (userAgent.includes("firefox/")) {
    return AstraBrowserFamilySchema.parse("firefox")
  }
  if (userAgent.includes("safari/") && !userAgent.includes("chrome/") && !userAgent.includes("chromium/")) {
    return AstraBrowserFamilySchema.parse("safari")
  }
  if (userAgent.includes("chrome/") || userAgent.includes("chromium/") || userAgent.includes("crios/")) {
    return AstraBrowserFamilySchema.parse("chrome")
  }

  return AstraBrowserFamilySchema.parse("unknown")
}

function formatPlatformLabel(platform: AstraDevicePlatform): string {
  switch (platform) {
    case "macos":
      return "macOS"
    case "ios":
      return "iOS"
    default:
      return platform.charAt(0).toUpperCase() + platform.slice(1)
  }
}

function formatBrowserLabel(browserFamily: AstraBrowserFamily): string {
  switch (browserFamily) {
    case "edge":
      return "Edge"
    case "firefox":
      return "Firefox"
    case "safari":
      return "Safari"
    case "chrome":
      return "Chrome"
    default:
      return "Browser"
  }
}

function createDeviceIdentity(): AstraDeviceIdentity {
  const now = new Date().toISOString()
  const platform = detectPlatform()
  const browserFamily = detectBrowserFamily()
  const appVersion = browser.runtime?.getManifest?.()?.version ?? "0.1.0"

  return AstraDeviceIdentitySchema.parse({
    version: 1,
    deviceId: generateOpaqueDeviceId(),
    label: `${formatBrowserLabel(browserFamily)} on ${formatPlatformLabel(platform)}`,
    platform,
    browserFamily,
    appKind: "extension",
    appVersion,
    createdAt: now,
    updatedAt: now,
  })
}

function normalizeDeviceIdentity(value: unknown): AstraDeviceIdentity | null {
  const parsed = AstraDeviceIdentitySchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

function normalizeSession(
  value: unknown,
  device: AstraDeviceIdentity | null,
): AstraSession | null {
  const parsed = AstraSessionSchema.safeParse(value)
  if (!parsed.success) return null

  return AstraSessionSchema.parse({
    ...parsed.data,
    deviceId: parsed.data.deviceId ?? device?.deviceId ?? null,
  })
}

export async function readAstraDeviceIdentity(): Promise<AstraDeviceIdentity | null> {
  const stored = await browser.storage.local.get(ASTRA_DEVICE_STORAGE_KEY)
  const device = normalizeDeviceIdentity(stored[ASTRA_DEVICE_STORAGE_KEY])

  if (!device && stored[ASTRA_DEVICE_STORAGE_KEY] !== undefined) {
    await browser.storage.local.remove(ASTRA_DEVICE_STORAGE_KEY)
  }

  return device
}

export async function ensureAstraDeviceIdentity(): Promise<AstraDeviceIdentity> {
  const existingDevice = await readAstraDeviceIdentity()
  if (existingDevice) return existingDevice

  const device = createDeviceIdentity()
  await browser.storage.local.set({
    [ASTRA_DEVICE_STORAGE_KEY]: device,
  })
  return device
}

export async function readAstraSession(): Promise<AstraSession | null> {
  const [stored, device] = await Promise.all([
    browser.storage.local.get(ASTRA_AUTH_STORAGE_KEY),
    readAstraDeviceIdentity(),
  ])
  const session = normalizeSession(stored[ASTRA_AUTH_STORAGE_KEY], device)

  if (!session && stored[ASTRA_AUTH_STORAGE_KEY] !== undefined) {
    await browser.storage.local.remove(ASTRA_AUTH_STORAGE_KEY)
  }

  if (session && JSON.stringify(session) !== JSON.stringify(stored[ASTRA_AUTH_STORAGE_KEY])) {
    await browser.storage.local.set({
      [ASTRA_AUTH_STORAGE_KEY]: session,
    })
  }

  return session
}

export async function saveAstraSession(session: AstraSession): Promise<AstraSession> {
  const device = await ensureAstraDeviceIdentity()
  const normalized = AstraSessionSchema.parse({
    ...session,
    deviceId: session.deviceId ?? device.deviceId,
  })
  await browser.storage.local.set({
    [ASTRA_AUTH_STORAGE_KEY]: normalized,
  })
  return normalized
}

export async function clearAstraSession(): Promise<void> {
  await browser.storage.local.remove(ASTRA_AUTH_STORAGE_KEY)
}

function normalizePendingBootstrapKey(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function normalizePendingSignInEmail(value: unknown): string | null {
  return typeof value === "string" && value.trim()
    ? value.trim().toLowerCase()
    : null
}

function normalizePendingSignInAttempt(value: unknown): { email: string; idempotencyKey: string } | null {
  if (typeof value !== "object" || value === null) {
    return null
  }

  const candidate = value as { email?: unknown; idempotencyKey?: unknown }
  const email = normalizePendingSignInEmail(candidate.email)
  const idempotencyKey = normalizePendingBootstrapKey(candidate.idempotencyKey)
  if (!email || !idempotencyKey) {
    return null
  }

  return {
    email,
    idempotencyKey,
  }
}

export async function readPendingAnonymousBootstrapKey(): Promise<string | null> {
  const stored = await browser.storage.local.get(ASTRA_ANONYMOUS_BOOTSTRAP_KEY_STORAGE_KEY)
  const key = normalizePendingBootstrapKey(stored[ASTRA_ANONYMOUS_BOOTSTRAP_KEY_STORAGE_KEY])

  if (!key && stored[ASTRA_ANONYMOUS_BOOTSTRAP_KEY_STORAGE_KEY] !== undefined) {
    await browser.storage.local.remove(ASTRA_ANONYMOUS_BOOTSTRAP_KEY_STORAGE_KEY)
  }

  return key
}

export async function savePendingAnonymousBootstrapKey(idempotencyKey: string): Promise<string> {
  const normalized = normalizePendingBootstrapKey(idempotencyKey)
  if (!normalized) {
    throw new Error("Anonymous bootstrap idempotency key is required.")
  }

  await browser.storage.local.set({
    [ASTRA_ANONYMOUS_BOOTSTRAP_KEY_STORAGE_KEY]: normalized,
  })
  return normalized
}

export async function clearPendingAnonymousBootstrapKey(): Promise<void> {
  await browser.storage.local.remove(ASTRA_ANONYMOUS_BOOTSTRAP_KEY_STORAGE_KEY)
}

export async function readPendingAstraSignInAttempt(): Promise<{ email: string; idempotencyKey: string } | null> {
  const stored = await browser.storage.local.get(ASTRA_AUTH_SIGN_IN_KEY_STORAGE_KEY)
  const attempt = normalizePendingSignInAttempt(stored[ASTRA_AUTH_SIGN_IN_KEY_STORAGE_KEY])

  if (!attempt && stored[ASTRA_AUTH_SIGN_IN_KEY_STORAGE_KEY] !== undefined) {
    await browser.storage.local.remove(ASTRA_AUTH_SIGN_IN_KEY_STORAGE_KEY)
  }

  return attempt
}

export async function savePendingAstraSignInAttempt(email: string, idempotencyKey: string): Promise<{ email: string; idempotencyKey: string }> {
  const normalizedEmail = normalizePendingSignInEmail(email)
  const normalizedKey = normalizePendingBootstrapKey(idempotencyKey)
  if (!normalizedEmail) {
    throw new Error("Authenticated sign-in email is required.")
  }
  if (!normalizedKey) {
    throw new Error("Authenticated sign-in idempotency key is required.")
  }

  const attempt = {
    email: normalizedEmail,
    idempotencyKey: normalizedKey,
  }
  await browser.storage.local.set({
    [ASTRA_AUTH_SIGN_IN_KEY_STORAGE_KEY]: attempt,
  })
  return attempt
}

export async function clearPendingAstraSignInAttempt(): Promise<void> {
  await browser.storage.local.remove(ASTRA_AUTH_SIGN_IN_KEY_STORAGE_KEY)
}
