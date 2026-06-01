/**
 * Cloze + reverse-recall presentation for mobile review — a dependency-free
 * mirror of src/utils/reading/cloze.ts (Metro can't import the root src tree,
 * the same reason srs.ts mirrors leitner.ts). Keep the two in sync.
 */

export const CLOZE_BLANK = "_____"

export interface ClozePrompt {
  prompt: string
  answer: string
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/** Blank the first whole-word occurrence of `target` inside `sentence`. */
export function buildClozeFromSentence(sentence: string, target: string): ClozePrompt | null {
  const trimmedSentence = sentence.trim()
  const trimmedTarget = target.trim()
  if (!trimmedSentence || !trimmedTarget) return null
  if (trimmedSentence.toLowerCase() === trimmedTarget.toLowerCase()) return null

  const pattern = new RegExp(`\\b${escapeRegExp(trimmedTarget)}\\b`, "i")
  const match = pattern.exec(trimmedSentence)
  if (!match) return null

  return {
    prompt: trimmedSentence.replace(pattern, CLOZE_BLANK),
    answer: match[0],
  }
}

export type ReviewPresentation =
  | { mode: "cloze"; prompt: string }
  | { mode: "reverse" }
  | { mode: "standard" }

interface ReviewPresentationInput {
  type: "word" | "sentence"
  front: string
  translation: string
  context: string
}

/**
 * Choose how to present a review card: a word saved with its sentence becomes a
 * cloze; a short 2-4 word phrase with a known meaning becomes reverse recall;
 * otherwise the standard front. Mirrors the extension's ReviewMode logic.
 */
export function resolveReviewPresentation(card: ReviewPresentationInput): ReviewPresentation {
  if (card.type === "word" && card.context) {
    const cloze = buildClozeFromSentence(card.context, card.front)
    if (cloze) return { mode: "cloze", prompt: cloze.prompt }
  }
  const tokenCount = card.front.trim().split(/\s+/).filter(Boolean).length
  if (tokenCount >= 2 && tokenCount <= 4 && card.translation.trim().length > 0) {
    return { mode: "reverse" }
  }
  return { mode: "standard" }
}
