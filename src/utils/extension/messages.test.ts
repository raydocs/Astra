import { beforeEach, describe, expect, it, vi } from "vitest"

import type { AstraConfig } from "@/types/config"
import { DEFAULT_ASTRA_CONFIG } from "@/types/config"
import { commitLearningContinuitySync, getActiveTabStudyContext, getLearningContinuitySyncStatus, requestDictionaryLookup, saveConfigInBackground } from "./messages"

function getMockBrowser() {
  return (globalThis as { __ASTRA_TEST_BROWSER__?: any }).__ASTRA_TEST_BROWSER__
}

function createConfig(patch: Partial<AstraConfig> = {}): AstraConfig {
  return {
    ...DEFAULT_ASTRA_CONFIG,
    ...patch,
    provider: {
      ...DEFAULT_ASTRA_CONFIG.provider,
      ...patch.provider,
    },
    presentation: {
      ...DEFAULT_ASTRA_CONFIG.presentation,
      ...patch.presentation,
    },
    sites: {
      ...DEFAULT_ASTRA_CONFIG.sites,
      ...patch.sites,
    },
  }
}

describe("extension message helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns the background config on success", async () => {
    const browser = getMockBrowser()
    const config = createConfig({ targetLang: "ja" })
    browser.runtime.sendMessage.mockResolvedValue({
      type: "runtime/save-config:success",
      payload: { config },
    })

    const result = await saveConfigInBackground({ targetLang: "ja" })

    expect(browser.runtime.sendMessage).toHaveBeenCalledWith({
      type: "runtime/save-config",
      payload: { targetLang: "ja" },
    })
    expect(result).toEqual({ ok: true, config })
  })

  it("maps transport failures to UNKNOWN instead of provider errors", async () => {
    const browser = getMockBrowser()
    browser.runtime.sendMessage.mockRejectedValue(new Error("popup channel closed"))

    const result = await saveConfigInBackground({ targetLang: "ja" })

    expect(result).toEqual({
      ok: false,
      error: {
        code: "UNKNOWN",
        message: "popup channel closed",
      },
    })
  })

  it("returns INVALID_RESPONSE when the background payload shape is wrong", async () => {
    const browser = getMockBrowser()
    browser.runtime.sendMessage.mockResolvedValue({ type: "runtime/save-config:success", payload: {} })

    const result = await saveConfigInBackground({ targetLang: "ja" })

    expect(result).toEqual({
      ok: false,
      error: {
        code: "INVALID_RESPONSE",
        message: "Received an invalid config save response.",
      },
    })
  })

  it("commits learning continuity sync through the background", async () => {
    const browser = getMockBrowser()
    browser.runtime.sendMessage.mockResolvedValue({
      type: "runtime/learning-continuity-sync:success",
      payload: {
        result: null,
        status: {
          inFlight: false,
          queued: false,
          lastReason: "selection-save",
          lastStartedAt: null,
          lastFinishedAt: null,
          lastResult: null,
          lastError: null,
          accountEmail: "user@example.com",
          stateLastRunAt: null,
          stateLastSuccessAt: "2026-04-09T01:00:00.000Z",
          stateLastError: null,
          cursors: { config: null, vocabulary: "voc-1", review_schedule: null, reading_history: null, study_progress: "progress-1" },
        },
      },
    })

    const result = await commitLearningContinuitySync("selection-save")

    expect(browser.runtime.sendMessage).toHaveBeenCalledWith({
      type: "runtime/learning-continuity-sync",
      reason: "selection-save",
    })
    expect(result.ok).toBe(true)
    expect(result.ok ? result.status.stateLastSuccessAt : null).toBe("2026-04-09T01:00:00.000Z")
  })

  it("reads learning continuity sync status through the background", async () => {
    const browser = getMockBrowser()
    browser.runtime.sendMessage.mockResolvedValue({
      type: "runtime/learning-continuity-sync-status:success",
      payload: {
        status: {
          inFlight: true,
          queued: true,
          lastReason: "review-answer",
          lastStartedAt: "2026-04-09T01:00:00.000Z",
          lastFinishedAt: null,
          lastResult: null,
          lastError: null,
          accountEmail: "user@example.com",
          stateLastRunAt: "2026-04-09T01:00:00.000Z",
          stateLastSuccessAt: null,
          stateLastError: null,
          cursors: { config: null, vocabulary: null, review_schedule: null, reading_history: null, study_progress: null },
        },
      },
    })

    const result = await getLearningContinuitySyncStatus()

    expect(browser.runtime.sendMessage).toHaveBeenCalledWith({
      type: "runtime/learning-continuity-sync-status",
    })
    expect(result.ok).toBe(true)
    expect(result.ok ? result.status.inFlight : false).toBe(true)
  })

  it("requests offline dictionary entries through the background", async () => {
    const browser = getMockBrowser()
    browser.runtime.sendMessage.mockResolvedValue({
      type: "runtime/dictionary-lookup:result",
      entry: { ipa: "maus", gloss: "老鼠" },
    })

    const result = await requestDictionaryLookup("mice")

    expect(browser.runtime.sendMessage).toHaveBeenCalledWith({
      type: "runtime/dictionary-lookup",
      word: "mice",
    })
    expect(result).toEqual({ ipa: "maus", gloss: "老鼠" })
  })

  it("treats dictionary transport failures as safe misses", async () => {
    const browser = getMockBrowser()
    browser.runtime.sendMessage.mockRejectedValue(new Error("worker asleep"))

    await expect(requestDictionaryLookup("mice")).resolves.toBeNull()
  })

  it("requests study context from the top frame of the active tab", async () => {
    const browser = getMockBrowser()
    browser.tabs.query.mockResolvedValue([{ id: 7, url: "https://example.com/article" }])
    browser.tabs.sendMessage.mockResolvedValue({
      ok: true,
      context: {
        pageTitle: "Example article",
        pageUrl: "https://example.com/article",
        hostname: "example.com",
        contentSummary: "Summary",
        articleExcerpt: "Excerpt",
      },
    })

    const result = await getActiveTabStudyContext()

    expect(browser.tabs.sendMessage).toHaveBeenCalledWith(
      7,
      { type: "content/get-study-context" },
      { frameId: 0 },
    )
    expect(result).toEqual({
      ok: true,
      context: {
        pageTitle: "Example article",
        pageUrl: "https://example.com/article",
        hostname: "example.com",
        contentSummary: "Summary",
        articleExcerpt: "Excerpt",
      },
    })
  })

  it("maps invalid study context payloads to UNKNOWN", async () => {
    const browser = getMockBrowser()
    browser.tabs.query.mockResolvedValue([{ id: 7, url: "https://example.com/article" }])
    browser.tabs.sendMessage.mockResolvedValue({ ok: true, foo: "bar" })

    const result = await getActiveTabStudyContext()

    expect(result).toEqual({
      ok: false,
      error: {
        code: "UNKNOWN",
        message: "Received an unexpected study context response.",
      },
    })
  })
})
