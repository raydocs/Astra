import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Platform } from "react-native"

import { resolveMobileApiBaseUrl } from "./mobileRuntime"

vi.mock("expo-application", () => ({
  applicationName: "Astra Review",
  nativeApplicationVersion: "0.1.0-test",
}))

vi.mock("expo-constants", () => ({
  default: {
    expoConfig: {
      version: "0.1.0-test",
      extra: {
        defaultApiBaseUrl: "http://127.0.0.1:8787/v1",
      },
    },
  },
}))

vi.mock("react-native", () => ({
  Platform: { OS: "ios" },
}))

describe("mobile runtime API base URL", () => {
  const originalDev = (globalThis as { __DEV__?: boolean }).__DEV__

  beforeEach(() => {
    ;(Platform as { OS: string }).OS = "ios"
    ;(globalThis as { __DEV__?: boolean }).__DEV__ = true
  })

  afterEach(() => {
    ;(globalThis as { __DEV__?: boolean }).__DEV__ = originalDev
  })

  it("uses an explicit HTTPS endpoint for production builds", () => {
    expect(resolveMobileApiBaseUrl({
      EAS_BUILD_PROFILE: "production",
      EXPO_PUBLIC_ASTRA_API_BASE_URL: " https://relay.example/v1/ ",
    })).toBe("https://relay.example/v1")
  })

  it("uses the public Expo build profile marker when EAS_BUILD_PROFILE is unavailable", () => {
    expect(resolveMobileApiBaseUrl({
      EXPO_PUBLIC_ASTRA_BUILD_PROFILE: "production",
      EXPO_PUBLIC_ASTRA_API_BASE_URL: "https://relay.example/v1",
    })).toBe("https://relay.example/v1")
    expect(() => resolveMobileApiBaseUrl({ EXPO_PUBLIC_ASTRA_BUILD_PROFILE: "production" })).toThrow("explicit deployed HTTPS relay URL")
    expect(() => resolveMobileApiBaseUrl({ EXPO_PUBLIC_ASTRA_BUILD_PROFILE: "preview" })).toThrow("explicit deployed HTTPS relay URL")
  })

  it("rejects production builds that would fall back to the local development endpoint", () => {
    expect(() => resolveMobileApiBaseUrl({ EAS_BUILD_PROFILE: "production" })).toThrow("explicit deployed HTTPS relay URL")
  })

  it("rejects non-dev bundles without an explicit HTTPS endpoint even when build profile is unavailable", () => {
    ;(globalThis as { __DEV__?: boolean }).__DEV__ = false
    expect(() => resolveMobileApiBaseUrl({})).toThrow("explicit deployed HTTPS relay URL")
  })

  it("rejects non-dev bundles with a local explicit endpoint", () => {
    ;(globalThis as { __DEV__?: boolean }).__DEV__ = false
    expect(() => resolveMobileApiBaseUrl({ EXPO_PUBLIC_ASTRA_API_BASE_URL: "http://127.0.0.1:8787/v1" })).toThrow("explicit deployed HTTPS relay URL")
    expect(() => resolveMobileApiBaseUrl({ EXPO_PUBLIC_ASTRA_API_BASE_URL: "https://localhost:8787/v1" })).toThrow("explicit deployed HTTPS relay URL")
  })

  it("rejects preview builds with non-HTTPS endpoints", () => {
    expect(() => resolveMobileApiBaseUrl({
      EXPO_PUBLIC_ASTRA_BUILD_PROFILE: "preview",
      EXPO_PUBLIC_ASTRA_API_BASE_URL: "http://relay.example/v1",
    })).toThrow("explicit deployed HTTPS relay URL")
  })

  it("keeps the iOS local development fallback for local runs", () => {
    expect(resolveMobileApiBaseUrl({})).toBe("http://127.0.0.1:8787/v1")
  })

  it("maps the Android local development fallback to the emulator host", () => {
    ;(Platform as { OS: string }).OS = "android"
    expect(resolveMobileApiBaseUrl({})).toBe("http://10.0.2.2:8787/v1")
  })
})
