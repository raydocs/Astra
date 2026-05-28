export const MIN_TOUCH_TARGET = 44

export const TOUCH_TARGET_HIT_SLOP = {
  top: 8,
  right: 8,
  bottom: 8,
  left: 8,
} as const

export const MIN_TOUCH_TARGET_STYLE = {
  minHeight: MIN_TOUCH_TARGET,
  minWidth: MIN_TOUCH_TARGET,
} as const

export type ReviewRatingAccessibilityKey = "again" | "good" | "easy" | "skip" | "notUseful"

const REVIEW_RATING_LABELS: Record<ReviewRatingAccessibilityKey, string> = {
  again: "Again, review rating",
  good: "Good, review rating",
  easy: "Easy, review rating",
  skip: "Skip this card",
  notUseful: "Not useful, remove from Today",
}

export function buildReviewProgressAccessibilityLabel(completedCount: number, totalCount: number): string {
  if (totalCount <= 0) return "Review progress: no cards ready."
  const remainingCount = Math.max(totalCount - completedCount, 0)
  return `Review progress: ${completedCount} of ${totalCount} cards completed. ${remainingCount} ${remainingCount === 1 ? "card remains" : "cards remain"}.`
}

export function buildReviewCardAccessibilityLabel(cardType: "word" | "sentence", sourceTitle: string): string {
  const kind = cardType === "sentence" ? "Sentence" : "Word"
  return `${kind} review card from ${sourceTitle}.`
}

export function buildReviewFrontAccessibilityLabel(cardType: "word" | "sentence", front: string): string {
  const kind = cardType === "sentence" ? "Sentence front" : "Word front"
  return `${kind}: ${front}`
}

export function buildReviewRatingAccessibilityLabel(rating: ReviewRatingAccessibilityKey): string {
  return REVIEW_RATING_LABELS[rating]
}

export function buildPreferenceOptionAccessibilityLabel(group: string, option: string, selected: boolean): string {
  return `${group}: ${option}. ${selected ? "Selected" : "Not selected"}.`
}
