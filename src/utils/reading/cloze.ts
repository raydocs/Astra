/**
 * Cloze generation from the user's OWN saved sentence.
 *
 * Deterministic and zero-config: blank the saved word inside the sentence it was
 * met in. No AI, no note-type editor — the spec's "cloze from the user's saved
 * sentence", kept to a single bounded derived card type.
 */

export const CLOZE_BLANK = "_____"

export interface ClozePrompt {
  /** The sentence with the target word replaced by a blank. */
  prompt: string
  /** The removed word, preserving the casing it had in the sentence. */
  answer: string
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * Build a cloze prompt by blanking the first whole-word occurrence of `target`
 * inside `sentence`. Returns null when there is no real sentence to work with
 * (e.g. the saved "sentence" is just the word itself) or the word is absent.
 */
export function buildClozeFromSentence(sentence: string, target: string): ClozePrompt | null {
  const trimmedSentence = sentence.trim()
  const trimmedTarget = target.trim()
  if (!trimmedSentence || !trimmedTarget) return null
  // A cloze needs surrounding context — the word alone is not a sentence.
  if (trimmedSentence.toLowerCase() === trimmedTarget.toLowerCase()) return null

  const pattern = new RegExp(`\\b${escapeRegExp(trimmedTarget)}\\b`, "i")
  const match = pattern.exec(trimmedSentence)
  if (!match) return null

  return {
    prompt: trimmedSentence.replace(pattern, CLOZE_BLANK),
    answer: match[0],
  }
}
