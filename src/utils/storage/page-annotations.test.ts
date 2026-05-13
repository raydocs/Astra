import { beforeEach, describe, expect, it } from "vitest"

import { createMockBrowser, setMockBrowser } from "../../../test/utils/mockBrowser"
import {
  buildPageAnnotation,
  clearPageAnnotations,
  deletePageAnnotation,
  listPageAnnotations,
  markPageAnnotationUnresolved,
  MAX_PAGE_ANNOTATIONS,
  PAGE_ANNOTATIONS_STORAGE_KEY,
  replacePageAnnotations,
  savePageAnnotation,
  type PageAnnotation,
} from "./page-annotations"

function createAnnotation(patch: Partial<PageAnnotation> = {}): PageAnnotation {
  return {
    id: "annotation-1",
    pageUrl: "https://example.com/article?chapter=1",
    pageOrigin: "https://example.com",
    pageTitle: "Example article",
    quoteText: "Hello world",
    type: "highlight",
    state: "active",
    anchor: {
      textPosition: { start: 0, end: 11 },
      textQuote: { exact: "Hello world", prefix: "", suffix: " after" },
      selector: { selector: "p" },
    },
    createdAt: 1000,
    updatedAt: 1000,
    ...patch,
  }
}

describe("page annotation storage", () => {
  beforeEach(() => {
    setMockBrowser(createMockBrowser())
  })

  it("builds a normalized page annotation model with URL/origin anchors and timestamps", () => {
    const annotation = buildPageAnnotation({
      id: "fixed-id",
      type: "mark",
      pageUrl: "https://example.com/article?chapter=1#paragraph-2",
      pageTitle: " Example ",
      quoteText: " Hello world ",
      now: 1234,
      anchor: {
        textPosition: { start: 5, end: 16 },
        textQuote: { exact: "Hello world", prefix: "Say ", suffix: "." },
        selector: { selector: "main > p:nth-of-type(1)", textNodeIndex: 0 },
      },
    })

    expect(annotation).toMatchObject({
      id: "fixed-id",
      pageUrl: "https://example.com/article?chapter=1",
      pageOrigin: "https://example.com",
      pageTitle: "Example",
      quoteText: "Hello world",
      type: "mark",
      state: "active",
      createdAt: 1234,
      updatedAt: 1234,
    })
  })

  it("saves, lists by normalized page URL, and deletes annotations without vocabulary state", async () => {
    await savePageAnnotation(createAnnotation())
    await savePageAnnotation(createAnnotation({
      id: "other-page",
      pageUrl: "https://example.com/other",
      updatedAt: 1001,
    }))

    expect(await listPageAnnotations("https://example.com/article?chapter=1#top")).toHaveLength(1)

    await deletePageAnnotation("annotation-1")

    expect(await listPageAnnotations("https://example.com/article?chapter=1")).toEqual([])
    expect(await listPageAnnotations()).toHaveLength(1)
  })

  it("persists unresolved-anchor state without deleting the saved annotation", async () => {
    await savePageAnnotation(createAnnotation())

    const updated = await markPageAnnotationUnresolved("annotation-1", {
      unresolved: true,
      reason: "Quote moved",
      lastTriedAt: 2000,
    })

    expect(updated).toMatchObject({
      id: "annotation-1",
      state: "unresolved",
      unresolvedAnchor: {
        unresolved: true,
        reason: "Quote moved",
        lastTriedAt: 2000,
      },
    })
    expect(await listPageAnnotations("https://example.com/article?chapter=1")).toHaveLength(1)
  })

  it("caps local storage newest-first and records deterministic eviction metadata", async () => {
    const annotations = Array.from({ length: MAX_PAGE_ANNOTATIONS + 2 }, (_, index) => createAnnotation({
      id: `annotation-${index}`,
      pageUrl: `https://example.com/article-${index}`,
      quoteText: `Quote ${index}`,
      anchor: {
        textPosition: { start: 0, end: `Quote ${index}`.length },
        textQuote: { exact: `Quote ${index}` },
      },
      createdAt: index,
      updatedAt: index,
    }))

    await replacePageAnnotations(annotations)

    const saved = await listPageAnnotations()
    expect(saved).toHaveLength(MAX_PAGE_ANNOTATIONS)
    expect(saved[0]?.id).toBe(`annotation-${MAX_PAGE_ANNOTATIONS + 1}`)
    expect(saved.at(-1)?.id).toBe("annotation-2")

    const browser = (globalThis as { __ASTRA_TEST_BROWSER__?: { __storage?: Record<string, unknown> } }).__ASTRA_TEST_BROWSER__
    expect(browser?.__storage?.[PAGE_ANNOTATIONS_STORAGE_KEY]).toMatchObject({
      lastEviction: {
        evictedCount: 2,
        maxAnnotations: MAX_PAGE_ANNOTATIONS,
      },
    })
  })

  it("clears annotations", async () => {
    await savePageAnnotation(createAnnotation())
    await clearPageAnnotations()
    expect(await listPageAnnotations()).toEqual([])
  })
})
