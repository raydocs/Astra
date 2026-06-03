import { describe, expect, it } from "vitest"

import { buildClozeFromSentence, CLOZE_BLANK } from "./cloze"

describe("buildClozeFromSentence", () => {
  it("blanks the target word inside its sentence and returns the answer", () => {
    const cloze = buildClozeFromSentence("The team showed resilience under pressure.", "resilience")
    expect(cloze).toEqual({
      prompt: `The team showed ${CLOZE_BLANK} under pressure.`,
      answer: "resilience",
    })
  })

  it("matches case-insensitively but preserves the sentence's casing in the answer", () => {
    const cloze = buildClozeFromSentence("Resilience matters most under pressure.", "resilience")
    expect(cloze?.prompt).toBe(`${CLOZE_BLANK} matters most under pressure.`)
    expect(cloze?.answer).toBe("Resilience")
  })

  it("only blanks whole words, not substrings", () => {
    const cloze = buildClozeFromSentence("The car is parked.", "car")
    expect(cloze?.prompt).toBe(`The ${CLOZE_BLANK} is parked.`)
  })

  it("returns null when there is no real sentence (word equals the saved text)", () => {
    expect(buildClozeFromSentence("resilience", "resilience")).toBeNull()
  })

  it("returns null when the word is absent from the sentence", () => {
    expect(buildClozeFromSentence("A sentence without the term.", "resilience")).toBeNull()
  })

  it("blanks every occurrence so a repeated word is not given away", () => {
    const cloze = buildClozeFromSentence("Run fast, then run again to run home.", "run")
    expect(cloze?.prompt).toBe(`${CLOZE_BLANK} fast, then ${CLOZE_BLANK} again to ${CLOZE_BLANK} home.`)
    expect(cloze?.answer).toBe("Run")
  })
})
