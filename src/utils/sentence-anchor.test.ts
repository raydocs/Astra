import { describe, expect, it } from "vitest"

import {
  buildSentenceAnchor,
  buildSentenceHash,
  normalizeSentenceAnchor,
  resolveSentenceAnchorIndex,
} from "./sentence-anchor"

describe("sentence anchor", () => {
  it("builds a stable normalized hash for the same sentence text", () => {
    expect(buildSentenceHash("  Hello   World. ")).toBe(buildSentenceHash("hello world."))
  })

  it("normalizes sentence text and fills the sentence hash", () => {
    expect(normalizeSentenceAnchor({ sentenceText: "  Example sentence. ", sentenceIndex: 2 })).toEqual({
      sentenceText: "Example sentence.",
      sentenceHash: buildSentenceHash("Example sentence."),
      sentenceIndex: 2,
    })
  })

  it("resolves by exact text first, then hash, then index fallback", () => {
    const sentences = [
      "Intro sentence.",
      "Target sentence with extra spacing.",
      "Closing sentence.",
    ]

    expect(resolveSentenceAnchorIndex({
      sentences,
      anchor: buildSentenceAnchor("Target sentence with extra spacing.", 0),
    })).toBe(1)

    expect(resolveSentenceAnchorIndex({
      sentences,
      anchor: {
        sentenceText: "Target sentence with extra   spacing.",
        sentenceHash: buildSentenceHash("Target sentence with extra spacing."),
        sentenceIndex: 0,
      },
    })).toBe(1)

    expect(resolveSentenceAnchorIndex({
      sentences,
      anchor: {
        sentenceText: "Missing sentence.",
        sentenceHash: buildSentenceHash("Missing sentence."),
        sentenceIndex: 2,
      },
    })).toBe(2)
  })
})
