import { describe, expect, it } from "vitest"

import {
  isContentCommandResponse,
  isContentStudyContextResponse,
  isRuntimeResponse,
} from "./messages"

describe("message response guards", () => {
  it("rejects runtime success payloads with non-string translations", () => {
    const candidate = {
      type: "runtime/translate-batch:success",
      payload: {
        translations: ["ok", 123],
      },
    }

    expect(isRuntimeResponse(candidate)).toBe(false)
  })

  it("accepts valid runtime success payloads", () => {
    const candidate = {
      type: "runtime/translate-batch:success",
      payload: {
        translations: ["你好"],
      },
    }

    expect(isRuntimeResponse(candidate)).toBe(true)
  })

  it("rejects content success payloads with incomplete translation state", () => {
    const candidate = {
      ok: true,
      state: {
        phase: "running",
      },
    }

    expect(isContentCommandResponse(candidate)).toBe(false)
  })

  it("accepts valid content responses", () => {
    const candidate = {
      ok: true,
      state: {
        phase: "idle",
        sessionId: 1,
        targetLang: "zh-CN",
        lastError: null,
        progress: {
          totalBlocks: 0,
          queuedBlocks: 0,
          inFlightBlocks: 0,
          translatedBlocks: 0,
          failedBlocks: 0,
        },
        presentation: {
          mode: "bilingual",
          theme: "default",
        },
        site: {
          hostname: "example.com",
          enabled: true,
          alwaysTranslate: false,
        },
      },
    }

    expect(isContentCommandResponse(candidate)).toBe(true)
  })

  it("accepts valid study-context responses", () => {
    const candidate = {
      ok: true,
      context: {
        pageTitle: "Example article",
        pageUrl: "https://example.com/article",
        hostname: "example.com",
        contentSummary: "Summary text",
      },
    }

    expect(isContentStudyContextResponse(candidate)).toBe(true)
  })
})
