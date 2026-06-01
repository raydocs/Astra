/**
 * "Known enough" set + soft reading-comfort hint.
 *
 * Astra deliberately has NO corpus-wide known-word tracking (that would be a
 * LingQ-style scoreboard, a non-goal). The only honest signal is the user's own
 * saved vocabulary: words they have mastered (Leitner box 5) vs. words they are
 * still learning. We use that small set to nudge calmly — never to display a
 * vocabulary-size number.
 */

import type { VocabularyEntry } from "@/utils/storage/vocabulary-core"

export type ReadingComfortId = "smooth" | "some_new" | "slow"

/** i18n message keys for each comfort bucket (en/zh kept at catalog parity). */
export const READING_COMFORT_COPY_KEYS: Record<ReadingComfortId, string> = {
  smooth: "readingComfortSmooth",
  some_new: "readingComfortSomeNew",
  slow: "readingComfortSlow",
}

const SINGLE_WORD = /^[a-z][a-z'-]*$/

function normalize(word: string): string {
  return word.trim().toLowerCase()
}

// Mirrors cardStateFromVocabularyEntry: box 5 is "mastered".
function isMasteredEntry(entry: VocabularyEntry): boolean {
  return (entry.srsBox ?? 1) >= 5
}

/** Single mastered English headwords — the "known enough" set. */
export function deriveKnownWordSet(entries: VocabularyEntry[]): Set<string> {
  const known = new Set<string>()
  for (const entry of entries) {
    const word = normalize(entry.text)
    if (SINGLE_WORD.test(word) && isMasteredEntry(entry)) known.add(word)
  }
  return known
}

export function isKnownWord(knownSet: Set<string>, word: string): boolean {
  return knownSet.has(normalize(word))
}

/**
 * How much of the user's *active* saved vocabulary appears on this page,
 * split by mastery. Distinct words only; phrases and CJK terms are ignored.
 */
export function countActiveVocabularyOnPage(
  pageText: string,
  entries: VocabularyEntry[],
): { learningMatches: number; masteredMatches: number } {
  const pageWords = new Set(pageText.toLowerCase().match(/[a-z][a-z'-]*/g) ?? [])
  const seen = new Set<string>()
  let learningMatches = 0
  let masteredMatches = 0
  for (const entry of entries) {
    const word = normalize(entry.text)
    if (!SINGLE_WORD.test(word) || seen.has(word) || !pageWords.has(word)) continue
    seen.add(word)
    if (isMasteredEntry(entry)) masteredMatches++
    else learningMatches++
  }
  return { learningMatches, masteredMatches }
}

/**
 * Map page/vocabulary overlap to one calm comfort bucket. With a small known set
 * most pages fall to the neutral "some_new" default — an honest, encouraging
 * nudge rather than a fake difficulty score.
 */
export function assessReadingComfort(
  { learningMatches, masteredMatches }: { learningMatches: number; masteredMatches: number },
): ReadingComfortId {
  if (learningMatches >= 2) return "slow"
  if (masteredMatches >= 1 && learningMatches === 0) return "smooth"
  return "some_new"
}
