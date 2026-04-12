import { beforeEach, describe, expect, it } from "vitest"

import type { AstraSession } from "@/types/auth"

import { createMockBrowser, setMockBrowser } from "../../../test/utils/mockBrowser"
import {
  ASTRA_ANONYMOUS_BOOTSTRAP_KEY_STORAGE_KEY,
  ASTRA_AUTH_STORAGE_KEY,
  ASTRA_AUTH_SIGN_IN_KEY_STORAGE_KEY,
  ASTRA_DEVICE_STORAGE_KEY,
  clearAstraSession,
  clearPendingAstraSignInAttempt,
  clearPendingAnonymousBootstrapKey,
  ensureAstraDeviceIdentity,
  readAstraSession,
  readPendingAstraSignInAttempt,
  readPendingAnonymousBootstrapKey,
  saveAstraSession,
  savePendingAstraSignInAttempt,
  savePendingAnonymousBootstrapKey,
} from "./auth"

describe("auth storage", () => {
  const session: AstraSession = {
    version: 1 as const,
    sessionToken: "astra-session",
    sessionId: null,
    deviceId: null,
    identityMode: "authenticated",
    relayBaseURL: "https://astra.example/v1",
    email: "user@example.com",
    plan: "pro" as const,
    subscriptionStatus: "active" as const,
    providerEntitlements: ["openai", "gemini"],
    quota: {
      dailyRequestsLimit: 0,
      dailyCharactersLimit: 0,
      requestsPerMinuteLimit: 0,
      remainingDailyRequests: 0,
      remainingDailyCharacters: 0,
    },
    usage: {
      totalRequests: 0,
      totalCharacters: 0,
      dailyRequestsUsed: 0,
      dailyCharactersUsed: 0,
      lastRequestAt: null,
      recentEvents: [],
    },
    issuedAt: null,
    expiresAt: null,
  }

  beforeEach(() => {
    setMockBrowser(createMockBrowser())
  })

  it("creates and persists a stable device identity", async () => {
    const browser = setMockBrowser(createMockBrowser()) as ReturnType<typeof createMockBrowser>

    const device = await ensureAstraDeviceIdentity()
    const sameDevice = await ensureAstraDeviceIdentity()

    expect(device.deviceId).toBeTruthy()
    expect(device.deviceId).toBe(sameDevice.deviceId)
    expect(browser.__storage[ASTRA_DEVICE_STORAGE_KEY]).toEqual(device)
  })

  it("persists and reads a normalized Astra session", async () => {
    const saved = await saveAstraSession(session)

    expect(saved.email).toBe("user@example.com")
    expect(saved.deviceId).toBeTruthy()
    expect(await readAstraSession()).toEqual({
      ...saved,
    })
  })

  it("hydrates a stored legacy session with the local device id", async () => {
    const device = await ensureAstraDeviceIdentity()
    const browser = setMockBrowser(createMockBrowser({
      [ASTRA_DEVICE_STORAGE_KEY]: device,
      [ASTRA_AUTH_STORAGE_KEY]: {
        ...session,
      },
    })) as ReturnType<typeof createMockBrowser>

    const restored = await readAstraSession()

    expect(restored?.deviceId).toBe(device.deviceId)
    expect(browser.__storage[ASTRA_AUTH_STORAGE_KEY]).toMatchObject({
      deviceId: device.deviceId,
    })
  })

  it("clears invalid session payloads from storage", async () => {
    const browser = setMockBrowser(createMockBrowser({
      [ASTRA_AUTH_STORAGE_KEY]: {
        sessionToken: "",
      },
    })) as ReturnType<typeof createMockBrowser>

    expect(await readAstraSession()).toBeNull()
    expect(browser.__storage[ASTRA_AUTH_STORAGE_KEY]).toBeUndefined()
  })

  it("persists and clears the pending anonymous bootstrap key", async () => {
    const browser = setMockBrowser(createMockBrowser()) as ReturnType<typeof createMockBrowser>

    await savePendingAnonymousBootstrapKey("anon-key-1")
    expect(await readPendingAnonymousBootstrapKey()).toBe("anon-key-1")
    expect(browser.__storage[ASTRA_ANONYMOUS_BOOTSTRAP_KEY_STORAGE_KEY]).toBe("anon-key-1")

    await clearPendingAnonymousBootstrapKey()
    expect(await readPendingAnonymousBootstrapKey()).toBeNull()
    expect(browser.__storage[ASTRA_ANONYMOUS_BOOTSTRAP_KEY_STORAGE_KEY]).toBeUndefined()
  })

  it("persists and clears the pending authenticated sign-in attempt", async () => {
    const browser = setMockBrowser(createMockBrowser()) as ReturnType<typeof createMockBrowser>

    await savePendingAstraSignInAttempt("Demo@Astra.Local", "sign-in-key-1")
    expect(await readPendingAstraSignInAttempt()).toEqual({
      email: "demo@astra.local",
      idempotencyKey: "sign-in-key-1",
    })
    expect(browser.__storage[ASTRA_AUTH_SIGN_IN_KEY_STORAGE_KEY]).toEqual({
      email: "demo@astra.local",
      idempotencyKey: "sign-in-key-1",
    })

    await clearPendingAstraSignInAttempt()
    expect(await readPendingAstraSignInAttempt()).toBeNull()
    expect(browser.__storage[ASTRA_AUTH_SIGN_IN_KEY_STORAGE_KEY]).toBeUndefined()
  })

  it("removes the stored session on clear", async () => {
    const browser = setMockBrowser(createMockBrowser()) as ReturnType<typeof createMockBrowser>

    await saveAstraSession(session)
    await clearAstraSession()

    expect(browser.__storage[ASTRA_AUTH_STORAGE_KEY]).toBeUndefined()
  })
})
