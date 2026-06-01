import { describe, expect, it } from "vitest"

import { buildClozeFromSentence, CLOZE_BLANK, resolveReviewPresentation } from "./cloze"

describe("mobile cloze", () => {
  it("blanks the target word inside its sentence", () => {
    expect(buildClozeFromSentence("The team showed resilience under pressure.", "resilience")).toEqual({
      prompt: `The team showed ${CLOZE_BLANK} under pressure.`,
      answer: "resilience",
    })
  })

  it("returns null when there is no real sentence or the word is absent", () => {
    expect(buildClozeFromSentence("resilience", "resilience")).toBeNull()
    expect(buildClozeFromSentence("A sentence without it.", "resilience")).toBeNull()
  })

  it("resolves a word saved with its sentence to a cloze", () => {
    expect(resolveReviewPresentation({
      type: "word",
      front: "resilience",
      translation: "韧性",
      context: "The team showed resilience under pressure.",
    })).toEqual({ mode: "cloze", prompt: `The team showed ${CLOZE_BLANK} under pressure.` })
  })

  it("resolves a short phrase with a meaning to reverse recall", () => {
    expect(resolveReviewPresentation({
      type: "sentence",
      front: "give up",
      translation: "放弃",
      context: "",
    })).toEqual({ mode: "reverse" })
  })

  it("falls back to standard for a bare word or a full sentence", () => {
    expect(resolveReviewPresentation({ type: "word", front: "serendipity", translation: "机缘巧合", context: "" }))
      .toEqual({ mode: "standard" })
    expect(resolveReviewPresentation({
      type: "sentence",
      front: "This is a long saved sentence that should not be reversed.",
      translation: "……",
      context: "",
    })).toEqual({ mode: "standard" })
  })
})
