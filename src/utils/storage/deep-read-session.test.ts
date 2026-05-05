import { beforeEach, describe, expect, it } from "vitest"

import { createMockBrowser, setMockBrowser } from "../../../test/utils/mockBrowser"
import {
  applyDeepReadSessionSyncMutations,
  buildDeepReadSessionSyncRecordMap,
  buildDeepReadSessionRecord,
  clearDeepReadSessions,
  getDeepReadSession,
  getLatestDeepReadSession,
  readSyncSafeDeepReadSessions,
  replaceDeepReadSessions,
  saveDeepReadSession,
  type DeepReadSessionRecord,
} from "./deep-read-session"

function createSession(patch: Partial<DeepReadSessionRecord> = {}): DeepReadSessionRecord {
  return {
    pageUrl: "https://example.com/article",
    pageTitle: "Example article",
    hostname: "example.com",
    sentences: ["Sentence one.", "Sentence two."],
    selectedSentenceAnchor: {
      sentenceText: "Sentence one.",
      sentenceHash: "fnv1a:test",
      sentenceIndex: 0,
    },
    selectedSentenceIndex: 0,
    updatedAt: 1000,
    ...patch,
  }
}

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

  it("builds sync-safe record maps by normalized URL and latest timestamp", () => {
    const records = buildDeepReadSessionSyncRecordMap([
      createSession({
        pageUrl: "https://example.com/article?utm=old#top",
        pageTitle: "Old",
        updatedAt: 1000,
      }),
      createSession({
        pageUrl: "https://example.com/article?utm=new",
        pageTitle: "New",
        updatedAt: 2000,
        selectedSentenceIndex: 1,
      }),
    ])

    expect(Object.keys(records)).toEqual(["https://example.com/article"])
    expect(records["https://example.com/article"]).toMatchObject({
      pageTitle: "New",
      selectedSentenceIndex: 1,
      updatedAt: 2000,
    })
  })

  it("applies deep-read sync upserts and deletes by normalized page URL", () => {
    const local = createSession({
      pageUrl: "https://example.com/article",
      pageTitle: "Local newer",
      updatedAt: 3000,
    })
    const staleRemote = createSession({
      pageUrl: "https://example.com/article?remote=1",
      pageTitle: "Remote stale",
      updatedAt: 2000,
    })

    expect(applyDeepReadSessionSyncMutations([local], [{
      recordId: "https://example.com/article?remote=1",
      operation: "upsert",
      payload: staleRemote,
    }])[0]?.pageTitle).toBe("Local newer")

    expect(applyDeepReadSessionSyncMutations([local], [{
      recordId: "https://example.com/article#top",
      operation: "delete",
      payload: null,
    }])).toEqual([])
  })

  it("replaces sessions in latest-first order and caps sync-safe storage", async () => {
    setMockBrowser(createMockBrowser())
    const sessions = Array.from({ length: 32 }, (_, index) => createSession({
      pageUrl: `https://example.com/article-${index}?utm=1`,
      pageTitle: `Article ${index}`,
      updatedAt: index,
    }))

    await replaceDeepReadSessions(sessions)

    const syncSessions = await readSyncSafeDeepReadSessions()
    expect(syncSessions).toHaveLength(30)
    expect(syncSessions[0]?.pageUrl).toBe("https://example.com/article-31")
    expect(syncSessions.at(-1)?.pageUrl).toBe("https://example.com/article-2")
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
