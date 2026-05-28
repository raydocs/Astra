import { describe, expect, it, vi } from "vitest"

vi.mock("expo-constants", () => ({ default: { expoConfig: { extra: {} } } }))
vi.mock("react-native", () => ({ Platform: { OS: "ios" } }))

import { createMobileOAuthNonce, encodeOAuthNonceBytes, resolveMobileOAuthConfig } from "./mobileOAuth"

describe("mobile OAuth runtime helpers", () => {
  it("reads the Google client ID from public env first", () => {
    expect(resolveMobileOAuthConfig({
      EXPO_PUBLIC_ASTRA_GOOGLE_OAUTH_CLIENT_ID: " env-client-id ",
    }, {
      astraGoogleOAuthClientId: "extra-client-id",
    })).toEqual({ googleClientId: "env-client-id" })
  })

  it("falls back to Expo extra Google client ID values", () => {
    expect(resolveMobileOAuthConfig({}, { astraGoogleOAuthClientId: " extra-client-id " })).toEqual({ googleClientId: "extra-client-id" })
    expect(resolveMobileOAuthConfig({}, { googleOAuthClientId: " legacy-extra-client-id " })).toEqual({ googleClientId: "legacy-extra-client-id" })
  })

  it("returns null when Google sign-in is not configured", () => {
    expect(resolveMobileOAuthConfig({}, {})).toEqual({ googleClientId: null })
  })

  it("encodes nonce bytes as URL-safe base64 without padding", () => {
    expect(encodeOAuthNonceBytes(new Uint8Array([251, 255, 255]))).toBe("-___")
    expect(encodeOAuthNonceBytes(new Uint8Array([1, 2]))).not.toContain("=")
  })

  it("requires enough random bytes for nonce creation", async () => {
    await expect(createMobileOAuthNonce(8, { getRandomBytes: () => new Uint8Array(8) })).rejects.toThrow("Secure sign-in setup")
    await expect(createMobileOAuthNonce(16, { getRandomBytes: () => new Uint8Array(16).fill(7) })).resolves.toMatch(/^[A-Za-z0-9_-]+$/)
  })
})
