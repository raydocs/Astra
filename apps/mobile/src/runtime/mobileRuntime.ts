import * as Application from "expo-application"
import Constants from "expo-constants"
import { Platform } from "react-native"

import type { MobileDeviceIdentity } from "../api/astraClient"
import type { MobileKeyValueStorage } from "../state/mobileStorage"

export const MOBILE_DEVICE_ID_STORAGE_KEY = "astra.mobile.device-id.v1"

const DEFAULT_LOCAL_API_BASE_URL = "http://127.0.0.1:8787/v1"

type EnvLike = Partial<Record<string, string | undefined>>
type ConstantsLike = {
  expoConfig?: { extra?: Record<string, unknown>; version?: string }
  manifest2?: { extra?: Record<string, unknown> }
  manifest?: { extra?: Record<string, unknown> }
}

function randomId(): string {
  const random = Math.random().toString(36).slice(2, 10)
  return `mobile-${Date.now().toString(36)}-${random}`
}

function expoExtraValue(key: string): string | undefined {
  const constants = Constants as unknown as ConstantsLike
  const extra = constants.expoConfig?.extra ?? constants.manifest2?.extra ?? constants.manifest?.extra
  if (!extra || typeof extra !== "object") return undefined
  const value = (extra as Record<string, unknown>)[key]
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined
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

function trimApiBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "")
}

function isDevelopmentBundle(): boolean {
  return (globalThis as unknown as { __DEV__?: boolean }).__DEV__ !== false
}

export function resolveMobileApiBaseUrl(env: EnvLike = (globalThis as unknown as { process?: { env?: EnvLike } }).process?.env ?? {}): string {
  const explicit = env.EXPO_PUBLIC_ASTRA_API_BASE_URL ? trimApiBaseUrl(env.EXPO_PUBLIC_ASTRA_API_BASE_URL) : undefined
  const configured = explicit || expoExtraValue("defaultApiBaseUrl") || DEFAULT_LOCAL_API_BASE_URL
  const profile = env.EAS_BUILD_PROFILE ?? env.EXPO_PUBLIC_ASTRA_BUILD_PROFILE
  const releaseLike = !isDevelopmentBundle() || profile === "preview" || profile === "production"
  if (releaseLike && (!explicit || !isDeployedHttpsMobileApiBaseUrl(configured))) {
    throw new Error("Preview and production mobile builds require EXPO_PUBLIC_ASTRA_API_BASE_URL to be an explicit deployed HTTPS relay URL.")
  }
  if (!explicit && Platform.OS === "android" && configured === DEFAULT_LOCAL_API_BASE_URL) {
    return "http://10.0.2.2:8787/v1"
  }
  return configured
}

export async function getOrCreateMobileDeviceIdentity(storage: MobileKeyValueStorage): Promise<MobileDeviceIdentity> {
  const stored = await storage.getItem(MOBILE_DEVICE_ID_STORAGE_KEY)
  const deviceId = stored?.trim() || randomId()
  if (!stored) await storage.setItem(MOBILE_DEVICE_ID_STORAGE_KEY, deviceId)

  const platform = Platform.OS === "ios" || Platform.OS === "android" ? Platform.OS : "unknown"
  return {
    deviceId,
    label: Application.applicationName ?? "Astra Review",
    platform,
    appKind: "mobile",
    appVersion: Application.nativeApplicationVersion ?? (Constants as unknown as ConstantsLike).expoConfig?.version ?? "0.1.0",
  }
}
