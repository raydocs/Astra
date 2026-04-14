import { beforeEach, describe, expect, it } from "vitest"

import { createMockBrowser, setMockBrowser } from "../../../test/utils/mockBrowser"
import {
  TRANSLATION_USAGE_STORAGE_KEY,
  clearTranslationUsage,
  getTranslationUsageSummary,
  initializeTranslationUsageSession,
  recordTranslationUsage,
} from "./translation-usage"

describe("translation usage storage", () => {
  beforeEach(() => {
    setMockBrowser(createMockBrowser())
  })

  it("records request usage and summarizes session + today counts", async () => {
    await initializeTranslationUsageSession(10_000)

    const directEvent = await recordTranslationUsage({
      timestamp: 11_000,
      providerId: "openai",
      model: "gpt-5.4-nano",
      texts: ["hello", "world"],
      attemptedTransports: ["direct"],
      finalTransport: "direct",
      success: true,
    })

    const fallbackEvent = await recordTranslationUsage({
      timestamp: 12_000,
      providerId: "openai",
      model: "gpt-5.4-nano",
      task: "explain",
      texts: ["explain this sentence"],
      attemptedTransports: ["direct", "relay"],
      finalTransport: "relay",
      fallbackUsed: true,
      success: false,
      errorCode: "PROVIDER_REQUEST_FAILED",
    })

    expect(directEvent.route).toBe("direct")
    expect(fallbackEvent.route).toBe("fallback")

    const summary = await getTranslationUsageSummary(12_500)
    expect(summary.sessionStartedAt).toBe(10_000)
    expect(summary.session.requests).toBe(2)
    expect(summary.session.texts).toBe(3)
    expect(summary.session.directRequests).toBe(1)
    expect(summary.session.relayRequests).toBe(1)
    expect(summary.session.fallbackRequests).toBe(1)
    expect(summary.session.failedRequests).toBe(1)
    expect(summary.session.chars).toBe("hello".length + "world".length + "explain this sentence".length)
    expect(summary.session.estimatedInputTokens).toBeGreaterThan(0)
    expect(summary.today.requests).toBe(2)
    expect(summary.lastEvent).toMatchObject({
      model: "gpt-5.4-nano",
      finalTransport: "relay",
      fallbackUsed: true,
      route: "fallback",
      success: false,
      errorCode: "PROVIDER_REQUEST_FAILED",
    })
  })

  it("keeps today totals but resets session totals after a new session starts", async () => {
    await initializeTranslationUsageSession(1_000)
    const directEvent = await recordTranslationUsage({
      timestamp: 2_000,
      providerId: "gemini",
      model: "gemini-3.1-flash-lite-preview",
      texts: ["first request"],
      finalTransport: "direct",
      success: true,
    })
    expect(directEvent.route).toBe("direct")

    await initializeTranslationUsageSession(3_000, { force: true })
    const relayEvent = await recordTranslationUsage({
      timestamp: 4_000,
      providerId: "openai",
      model: "gpt-5.4-nano",
      texts: ["second request"],
      finalTransport: "relay",
      success: true,
    })
    expect(relayEvent.route).toBe("relay")

    const summary = await getTranslationUsageSummary(4_500)
    expect(summary.today.requests).toBe(2)
    expect(summary.session.requests).toBe(1)
    expect(summary.session.relayRequests).toBe(1)
    expect(summary.session.directRequests).toBe(0)
    expect(summary.lastEvent).toMatchObject({
      model: "gpt-5.4-nano",
      route: "relay",
    })
  })

  it("normalizes legacy stored events that predate the canonical route field", async () => {
    const browser = (globalThis as unknown as { __ASTRA_TEST_BROWSER__: ReturnType<typeof createMockBrowser> }).__ASTRA_TEST_BROWSER__
    browser.__storage[TRANSLATION_USAGE_STORAGE_KEY] = {
      sessionStartedAt: 1_000,
      events: [
        {
          id: "evt-no-route",
          timestamp: 1_400,
          providerId: "openai",
          model: "gpt-5.4-nano",
          task: "translate",
          textCount: 1,
          charCount: 5,
          estimatedInputTokens: 1,
          attemptedTransports: [],
          finalTransport: null,
          fallbackUsed: false,
          success: false,
          errorCode: "CONFIG_MISSING",
        },
        {
          id: "evt-fallback",
          timestamp: 1_300,
          providerId: "openai",
          model: "gpt-5.4-nano",
          task: "translate",
          textCount: 1,
          charCount: 5,
          estimatedInputTokens: 1,
          attemptedTransports: ["direct", "relay"],
          finalTransport: "relay",
          fallbackUsed: true,
          success: false,
          errorCode: "PROVIDER_REQUEST_FAILED",
        },
        {
          id: "evt-relay",
          timestamp: 1_200,
          providerId: "openai",
          model: "gpt-5.4-nano",
          task: "translate",
          textCount: 1,
          charCount: 5,
          estimatedInputTokens: 1,
          attemptedTransports: ["relay"],
          finalTransport: "relay",
          fallbackUsed: false,
          success: true,
        },
        {
          id: "evt-direct",
          timestamp: 1_100,
          providerId: "openai",
          model: "gpt-5.4-nano",
          task: "translate",
          textCount: 1,
          charCount: 5,
          estimatedInputTokens: 1,
          attemptedTransports: ["direct"],
          finalTransport: "direct",
          fallbackUsed: false,
          success: true,
        },
      ],
    }

    await initializeTranslationUsageSession(1_500)

    expect(browser.__storage[TRANSLATION_USAGE_STORAGE_KEY]).toMatchObject({
      sessionStartedAt: 1_000,
      events: [
        expect.objectContaining({ id: "evt-no-route", route: null }),
        expect.objectContaining({ id: "evt-fallback", route: "fallback" }),
        expect.objectContaining({ id: "evt-relay", route: "relay" }),
        expect.objectContaining({ id: "evt-direct", route: "direct" }),
      ],
    })
  })

  it("clears persisted usage state", async () => {
    await initializeTranslationUsageSession(1_000)
    await recordTranslationUsage({
      timestamp: 1_100,
      providerId: "openai",
      model: "gpt-5.4-nano",
      texts: ["hello"],
      finalTransport: "direct",
      success: true,
    })

    await clearTranslationUsage()

    const summary = await getTranslationUsageSummary(1_200)
    expect(summary.sessionStartedAt).toBeNull()
    expect(summary.session.requests).toBe(0)
    expect(summary.today.requests).toBe(0)

    const browser = (globalThis as unknown as { __ASTRA_TEST_BROWSER__: ReturnType<typeof createMockBrowser> }).__ASTRA_TEST_BROWSER__
    expect(browser.__storage[TRANSLATION_USAGE_STORAGE_KEY]).toEqual({
      sessionStartedAt: null,
      events: [],
    })
  })
})
