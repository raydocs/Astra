import { beforeEach, describe, expect, it } from "vitest"

import type { AstraSession } from "@/types/auth"

import { createMockBrowser, setMockBrowser } from "../../../test/utils/mockBrowser"
import {
  ASTRA_AUTH_STORAGE_KEY,
  clearAstraSession,
  readAstraSession,
  saveAstraSession,
} from "./auth"

describe("auth storage", () => {
  const session: AstraSession = {
    version: 1 as const,
    sessionToken: "astra-session",
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
    expiresAt: null,
  }

  beforeEach(() => {
    setMockBrowser(createMockBrowser())
  })

  it("persists and reads a normalized Astra session", async () => {
    const saved = await saveAstraSession(session)

    expect(saved.email).toBe("user@example.com")
    expect(await readAstraSession()).toEqual({
      ...saved,
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

  it("removes the stored session on clear", async () => {
    const browser = setMockBrowser(createMockBrowser()) as ReturnType<typeof createMockBrowser>

    await saveAstraSession(session)
    await clearAstraSession()

    expect(browser.__storage[ASTRA_AUTH_STORAGE_KEY]).toBeUndefined()
  })
})
