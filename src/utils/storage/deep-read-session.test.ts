import { beforeEach, describe, expect, it } from "vitest"

import { createMockBrowser, setMockBrowser } from "../../../test/utils/mockBrowser"
import {
  buildDeepReadSessionRecord,
  clearDeepReadSessions,
  getDeepReadSession,
  getLatestDeepReadSession,
  saveDeepReadSession,
} from "./deep-read-session"

describe("deep read session storage", () => {
  beforeEach(() => {
    setMockBrowser(createMockBrowser())
  })

  it("builds a normalized deep-read session from page study context", () => {
    const record = buildDeepReadSessionRecord({
      context: {
        pageUrl: "https://example.com/article?ref=feed#section",
        pageTitle: " Example article ",
        hostname: " example.com ",
        contentSummary: " First sentence. Second sentence. ",
      },
      selectedSentenceIndex: 1,
    })

    expect(record).toMatchObject({
      pageUrl: "https://example.com/article",
      pageTitle: "Example article",
      hostname: "example.com",
      selectedSentenceIndex: 1,
      sentences: ["First sentence.", "Second sentence."],
      selectedSentenceAnchor: {
        sentenceText: "Second sentence.",
        sentenceIndex: 1,
      },
    })
    expect(record?.selectedSentenceAnchor?.sentenceHash).toMatch(/^fnv1a:/)
  })

  it("saves and reloads the latest session by normalized page url", async () => {
    await saveDeepReadSession({
      context: {
        pageUrl: "https://example.com/article?x=1",
        pageTitle: "Example article",
        hostname: "example.com",
        articleExcerpt: "Sentence one. Sentence two.",
      },
      selectedSentenceIndex: 1,
    })

    const byUrl = await getDeepReadSession("https://example.com/article#top")
    const latest = await getLatestDeepReadSession()

    expect(byUrl).not.toBeNull()
    expect(byUrl?.selectedSentenceIndex).toBe(1)
    expect(latest?.pageUrl).toBe("https://example.com/article")
  })

  it("replaces an existing session for the same normalized url", async () => {
    await saveDeepReadSession({
      context: {
        pageUrl: "https://example.com/article?x=1",
        pageTitle: "Example article",
        hostname: "example.com",
        contentSummary: "Sentence one.",
      },
      selectedSentenceIndex: 0,
    })

    await saveDeepReadSession({
      context: {
        pageUrl: "https://example.com/article?x=2",
        pageTitle: "Example article revised",
        hostname: "example.com",
        contentSummary: "Sentence one. Sentence two.",
      },
      selectedSentenceIndex: 1,
    })

    const latest = await getLatestDeepReadSession()
    expect(latest?.pageTitle).toBe("Example article revised")
    expect(latest?.selectedSentenceIndex).toBe(1)
    expect(latest?.sentences).toEqual(["Sentence one.", "Sentence two."])
  })

  it("clears saved sessions", async () => {
    await saveDeepReadSession({
      context: {
        pageUrl: "https://example.com/article",
        pageTitle: "Example article",
        hostname: "example.com",
        contentSummary: "Sentence one.",
      },
    })

    await clearDeepReadSessions()

    expect(await getLatestDeepReadSession()).toBeNull()
  })
})
