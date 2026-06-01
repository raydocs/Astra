/**
 * Offline English→Chinese lexical fallback.
 *
 * A frequency/exam-ranked subset of ECDICT (MIT) is packaged at
 * public/dictionary/en-zh-common.json and loaded ONCE in the background service
 * worker (never bundled into content scripts). On a hit, the word-annotation
 * card uses the dictionary's verified IPA + general gloss as ground truth and
 * lets the model supply only the in-context explanation — so a hallucinated
 * pronunciation/meaning can no longer reach a learner who cannot sanity-check it.
 *
 * Regenerate the data with: node script/maintenance/build-dictionary.mjs /tmp/ecdict.csv
 */

import { browser } from "#imports"

export interface DictionaryEntry {
  /** IPA pronunciation as recorded by the dictionary (without surrounding slashes). */
  ipa: string
  /** Concise general-meaning gloss in the target language (Chinese). */
  gloss: string
}

export type Lexicon = Record<string, DictionaryEntry>

export interface PackagedLexicon {
  entries: Lexicon
  aliases?: Record<string, string>
}

const LEXICON_PATH = "/dictionary/en-zh-common.json"

/** Normalize a selection into a dictionary key (single lowercased English headword). */
export function normalizeDictionaryKey(word: string): string {
  return word.trim().toLowerCase()
}

/** True only for a single English headword the packaged lexicon could contain. */
export function isDictionaryLookupCandidate(word: string): boolean {
  return /^[a-z][a-z'-]*$/.test(normalizeDictionaryKey(word))
}

function isPackagedLexicon(lexicon: Lexicon | PackagedLexicon): lexicon is PackagedLexicon {
  return typeof (lexicon as PackagedLexicon).entries === "object"
    && (lexicon as PackagedLexicon).entries !== null
}

/** Pure lookup against an already-loaded lexicon (no I/O — unit-test friendly). */
export function lookupInLexicon(lexicon: Lexicon | PackagedLexicon, word: string): DictionaryEntry | null {
  if (!isDictionaryLookupCandidate(word)) return null
  const key = normalizeDictionaryKey(word)
  if (isPackagedLexicon(lexicon)) {
    const headword = lexicon.aliases?.[key] ?? key
    return lexicon.entries[headword] ?? null
  }
  return lexicon[key] ?? null
}

let lexiconPromise: Promise<Lexicon | PackagedLexicon> | null = null

async function loadLexicon(): Promise<Lexicon | PackagedLexicon> {
  if (!lexiconPromise) {
    lexiconPromise = (async () => {
      try {
        const response = await fetch(browser.runtime.getURL(LEXICON_PATH as "/popup.html"))
        if (!response.ok) return {}
        return (await response.json()) as Lexicon | PackagedLexicon
      } catch {
        // A missing/corrupt asset must never break word lookup — fall back to AI-only.
        return {}
      }
    })()
  }
  return lexiconPromise
}

/**
 * Look up a word in the offline lexicon. Resolves null on a miss, a non-candidate
 * selection (phrase/CJK), or any load failure. Runs in the background worker; the
 * content script reaches it via the runtime/dictionary-lookup message.
 */
export async function lookupDictionary(word: string): Promise<DictionaryEntry | null> {
  if (!isDictionaryLookupCandidate(word)) return null
  const lexicon = await loadLexicon()
  return lookupInLexicon(lexicon, word)
}

export function resetDictionaryLexiconForTests(): void {
  lexiconPromise = null
}
