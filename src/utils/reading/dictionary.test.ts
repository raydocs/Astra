import { describe, expect, it } from "vitest"

import { isDictionaryLookupCandidate, lookupInLexicon, normalizeDictionaryKey, type Lexicon } from "./dictionary"

const lexicon: Lexicon = {
  resilience: { ipa: "ri'ziliәns", gloss: "弹回，有弹力，恢复力" },
  run: { ipa: "rʌn", gloss: "跑，赛跑" },
}

describe("dictionary lookup", () => {
  it("normalizes selections to a lowercased headword key", () => {
    expect(normalizeDictionaryKey("  Resilience ")).toBe("resilience")
    expect(normalizeDictionaryKey("RUN")).toBe("run")
  })

  it("treats only single English headwords as lookup candidates", () => {
    expect(isDictionaryLookupCandidate("resilience")).toBe(true)
    expect(isDictionaryLookupCandidate("well-being")).toBe(true)
    expect(isDictionaryLookupCandidate("give up")).toBe(false) // phrase
    expect(isDictionaryLookupCandidate("韧性")).toBe(false) // CJK
    expect(isDictionaryLookupCandidate("")).toBe(false)
  })

  it("returns the entry on a case-insensitive hit and null on a miss", () => {
    expect(lookupInLexicon(lexicon, "Resilience")).toEqual({ ipa: "ri'ziliәns", gloss: "弹回，有弹力，恢复力" })
    expect(lookupInLexicon(lexicon, "ubiquitous")).toBeNull()
    expect(lookupInLexicon(lexicon, "give up")).toBeNull()
  })
})
