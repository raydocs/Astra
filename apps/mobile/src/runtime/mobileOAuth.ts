import Constants from "expo-constants"
import { Platform } from "react-native"

import type { MobileOAuthIdentity } from "../api/astraClient"

export type MobileOAuthProvider = "apple" | "google"

export type MobileOAuthStartResult =
  | { status: "success"; identity: Extract<MobileOAuthIdentity, { idToken: string }> }
  | { status: "unavailable"; message: string }
  | { status: "cancelled"; message: string }
  | { status: "failed"; message: string }

export interface MobileOAuthConfig {
  googleClientId: string | null
}

type EnvLike = Partial<Record<string, string | undefined>>
type ConstantsLike = {
  expoConfig?: { extra?: Record<string, unknown> }
  manifest2?: { extra?: Record<string, unknown> }
  manifest?: { extra?: Record<string, unknown> }
}

type ExpoCryptoModule = {
  getRandomBytes?: (byteCount: number) => Uint8Array
  getRandomBytesAsync?: (byteCount: number) => Promise<Uint8Array>
}

const GOOGLE_SIGN_IN_UNAVAILABLE = "Google sign-in is not available here yet. Use email or a desktop link to continue."
const APPLE_SIGN_IN_UNAVAILABLE = "Apple sign-in is not available on this device. Use email or a desktop link to continue."
const SIGN_IN_CANCELLED = "Sign-in was cancelled."
const SIGN_IN_FAILED = "Could not complete sign-in. Try again or use another sign-in method."

function normalizeConfigValue(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null
}

function readConstantsExtra(): Record<string, unknown> {
  const constants = Constants as unknown as ConstantsLike
  const extra = constants.expoConfig?.extra ?? constants.manifest2?.extra ?? constants.manifest?.extra
  return extra && typeof extra === "object" ? extra : {}
}

export function resolveMobileOAuthConfig(
  env: EnvLike = (globalThis as unknown as { process?: { env?: EnvLike } }).process?.env ?? {},
  extra: Record<string, unknown> = readConstantsExtra(),
): MobileOAuthConfig {
  return {
    googleClientId:
      normalizeConfigValue(env.EXPO_PUBLIC_ASTRA_GOOGLE_OAUTH_CLIENT_ID)
      ?? normalizeConfigValue(extra.EXPO_PUBLIC_ASTRA_GOOGLE_OAUTH_CLIENT_ID)
      ?? normalizeConfigValue(extra.astraGoogleOAuthClientId)
      ?? normalizeConfigValue(extra.googleOAuthClientId),
  }
}

function encodeBase64(bytes: Uint8Array): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
  let encoded = ""
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index]
    const second = bytes[index + 1]
    const third = bytes[index + 2]
    encoded += alphabet[first >> 2]
    encoded += alphabet[((first & 0x03) << 4) | ((second ?? 0) >> 4)]
    encoded += second === undefined ? "=" : alphabet[((second & 0x0f) << 2) | ((third ?? 0) >> 6)]
    encoded += third === undefined ? "=" : alphabet[third & 0x3f]
  }
  return encoded
}

export function encodeOAuthNonceBytes(bytes: Uint8Array): string {
  return encodeBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

export async function createMobileOAuthNonce(byteCount = 32, cryptoModule?: ExpoCryptoModule): Promise<string> {
  const crypto = cryptoModule ?? await import("expo-crypto") as ExpoCryptoModule
  const bytes = crypto.getRandomBytes?.(byteCount) ?? await crypto.getRandomBytesAsync?.(byteCount)
  if (!bytes || bytes.length < 16) throw new Error("Secure sign-in setup is unavailable.")
  return encodeOAuthNonceBytes(bytes)
}

function isCancelledError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const record = error as { code?: unknown; message?: unknown }
  return record.code === "ERR_REQUEST_CANCELED" || (typeof record.message === "string" && record.message.toLowerCase().includes("cancel"))
}

export async function isAppleSignInAvailable(): Promise<boolean> {
  try {
    const AppleAuthentication = await import("expo-apple-authentication")
    return await AppleAuthentication.isAvailableAsync()
  } catch {
    return false
  }
}

export async function startAppleSignIn(): Promise<MobileOAuthStartResult> {
  try {
    const AppleAuthentication = await import("expo-apple-authentication")
    if (!await AppleAuthentication.isAvailableAsync()) {
      return { status: "unavailable", message: APPLE_SIGN_IN_UNAVAILABLE }
    }

    const nonce = await createMobileOAuthNonce()
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL],
      nonce,
    })
    const idToken = credential.identityToken?.trim()
    if (!idToken) return { status: "unavailable", message: APPLE_SIGN_IN_UNAVAILABLE }
    return { status: "success", identity: { provider: "apple", idToken, nonce } }
  } catch (error) {
    if (isCancelledError(error)) return { status: "cancelled", message: SIGN_IN_CANCELLED }
    return { status: "failed", message: SIGN_IN_FAILED }
  }
}

export async function startGoogleSignIn(config: MobileOAuthConfig = resolveMobileOAuthConfig()): Promise<MobileOAuthStartResult> {
  if (!config.googleClientId) return { status: "unavailable", message: GOOGLE_SIGN_IN_UNAVAILABLE }

  try {
    const [AuthSession, GoogleProvider, WebBrowser] = await Promise.all([
      import("expo-auth-session"),
      import("expo-auth-session/providers/google"),
      import("expo-web-browser"),
    ])
    WebBrowser.maybeCompleteAuthSession()

    const nonce = await createMobileOAuthNonce()
    const redirectUri = AuthSession.makeRedirectUri({ scheme: "astra-review", path: "oauth/google" })
    const request = await AuthSession.loadAsync({
      clientId: config.googleClientId,
      responseType: AuthSession.ResponseType.IdToken,
      redirectUri,
      scopes: ["openid", "email", "profile"],
      usePKCE: false,
      extraParams: { nonce },
    }, GoogleProvider.discovery)
    const result = await request.promptAsync(GoogleProvider.discovery)

    if (result.type === "cancel" || result.type === "dismiss") return { status: "cancelled", message: SIGN_IN_CANCELLED }
    if (result.type !== "success") return { status: "failed", message: SIGN_IN_FAILED }

    const idToken = result.params.id_token?.trim()
    if (!idToken) return { status: "failed", message: SIGN_IN_FAILED }
    return { status: "success", identity: { provider: "google", idToken, nonce } }
  } catch (error) {
    if (isCancelledError(error)) return { status: "cancelled", message: SIGN_IN_CANCELLED }
    return { status: Platform.OS === "web" ? "failed" : "unavailable", message: Platform.OS === "web" ? SIGN_IN_FAILED : GOOGLE_SIGN_IN_UNAVAILABLE }
  }
}
