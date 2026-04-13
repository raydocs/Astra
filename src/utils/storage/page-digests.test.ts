import { beforeEach, describe, expect, it } from "vitest"

import { createMockBrowser, setMockBrowser } from "../../../test/utils/mockBrowser"
import { getPageDigest, PAGE_DIGESTS_STORAGE_KEY } from "./page-digests"

describe("page digest storage", () => {
  beforeEach(() => {
    setMockBrowser(createMockBrowser())
  })

  it("hydrates legacy digest records without enriched study fields", async () => {
    setMockBrowser(createMockBrowser({
      [PAGE_DIGESTS_STORAGE_KEY]: {
        digests: [{
          url: "https://example.com/article",
          hostname: "example.com",
          title: "Example article",
          targetLang: "zh-CN",
          languageLevel: "beginner",
          generatedAt: 123,
          sourceFingerprint: "fp-1",
          headline: "Legacy headline",
          summary: "Legacy summary",
          keyPoints: ["Legacy point"],
        }],
      },
    }))

    const digest = await getPageDigest("https://example.com/article?ref=1")

    expect(digest?.headline).toBe("Legacy headline")
    expect(digest?.vocabularyFocus).toEqual([])
    expect(digest?.grammarFocus).toEqual([])
    expect(digest?.suggestedAction).toBe("")
  })
})
