import { describe, expect, it } from "vitest"

import {
  assessReadingComfort,
  countActiveVocabularyOnPage,
  deriveKnownWordSet,
  isKnownWord,
} from "./known-words"
import type { VocabularyEntry } from "@/utils/storage/vocabulary-core"

function entry(text: string, srsBox: number): VocabularyEntry {
  return {
    id: text,
    text,
    savedAt: 0,
    srsBox,
  } as VocabularyEntry
}

describe("known-words", () => {
  it("derives a known set from mastered single English words only", () => {
    const known = deriveKnownWordSet([
      entry("Resilience", 5), // mastered → included (normalized)
      entry("mitigate", 4), // still learning → excluded
      entry("give up", 5), // phrase → excluded
      entry("韧性", 5), // CJK → excluded
    ])
    expect([...known]).toEqual(["resilience"])
    expect(isKnownWord(known, "RESILIENCE")).toBe(true)
    expect(isKnownWord(known, "mitigate")).toBe(false)
  })

  it("counts distinct active vocabulary appearing on the page, split by mastery", () => {
    const entries = [
      entry("resilience", 5), // mastered, on page
      entry("mitigate", 2), // learning, on page
      entry("nuance", 3), // learning, on page
      entry("ubiquitous", 1), // learning, NOT on page
    ]
    const counts = countActiveVocabularyOnPage(
      "Her resilience helped her mitigate the nuance of the debate.",
      entries,
    )
    expect(counts).toEqual({ learningMatches: 2, masteredMatches: 1 })
  })

  it("maps overlap to calm comfort buckets honestly", () => {
    // Two+ still-learning words on the page → slow down.
    expect(assessReadingComfort({ learningMatches: 2, masteredMatches: 0 })).toBe("slow")
    // Only mastered matches, nothing still-learning → smooth.
    expect(assessReadingComfort({ learningMatches: 0, masteredMatches: 2 })).toBe("smooth")
    // No meaningful overlap → neutral, encouraging default (not a fake "easy").
    expect(assessReadingComfort({ learningMatches: 0, masteredMatches: 0 })).toBe("some_new")
    expect(assessReadingComfort({ learningMatches: 1, masteredMatches: 0 })).toBe("some_new")
  })
})
