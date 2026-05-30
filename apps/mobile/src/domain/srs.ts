/**
 * Leitner 5-Box Spaced Repetition System — mobile mirror.
 *
 * This is a faithful, dependency-free copy of `src/utils/srs/leitner.ts` from the
 * extension/web package. The mobile app is a standalone Expo package (its own
 * Metro project root + lockfile), so it cannot import modules from the repo's
 * root `src/` tree. To keep mobile, web, and desktop on the SAME schedule, the
 * box intervals and grade transitions here MUST stay identical to the canonical
 * module. `srs.test.ts` pins the contract so this can't silently drift.
 */

export interface SrsFields {
  srsBox: number
  nextReviewAt: number
  reviewCount: number
  lastReviewedAt: number | null
}

export type ReviewGrade = "again" | "hard" | "good" | "easy"

/** Interval per box in milliseconds */
export const BOX_INTERVALS_MS: Record<number, number> = {
  1: 1 * 24 * 60 * 60 * 1000,   //  1 day
  2: 2 * 24 * 60 * 60 * 1000,   //  2 days
  3: 4 * 24 * 60 * 60 * 1000,   //  4 days
  4: 8 * 24 * 60 * 60 * 1000,   //  8 days
  5: 16 * 24 * 60 * 60 * 1000,  // 16 days
}

export const AGAIN_INTERVAL_MS = 10 * 60 * 1000
export const HARD_INTERVAL_MULTIPLIER = 0.5
export const EASY_INTERVAL_MULTIPLIER = 1.5

function clampBox(box: number): number {
  return Math.min(Math.max(Math.trunc(box), 1), 5)
}

export function createDefaultSrsFields(now: number): SrsFields {
  return {
    srsBox: 1,
    nextReviewAt: now,
    reviewCount: 0,
    lastReviewedAt: null,
  }
}

export function applyReview(
  fields: SrsFields,
  outcome: { grade: ReviewGrade },
  now: number,
): SrsFields {
  const currentBox = clampBox(fields.srsBox)
  let targetBox: number
  let intervalMs: number

  switch (outcome.grade) {
    case "again":
      targetBox = 1
      intervalMs = AGAIN_INTERVAL_MS
      break
    case "hard":
      targetBox = currentBox
      intervalMs = BOX_INTERVALS_MS[targetBox] * HARD_INTERVAL_MULTIPLIER
      break
    case "good":
      targetBox = Math.min(currentBox + 1, 5)
      intervalMs = BOX_INTERVALS_MS[targetBox]
      break
    case "easy":
      targetBox = Math.min(currentBox + 2, 5)
      intervalMs = BOX_INTERVALS_MS[targetBox] * EASY_INTERVAL_MULTIPLIER
      break
    default:
      throw new Error(`Unsupported SRS review grade: ${String((outcome as { grade?: unknown }).grade)}`)
  }

  return {
    srsBox: targetBox,
    nextReviewAt: now + intervalMs,
    reviewCount: fields.reviewCount + 1,
    lastReviewedAt: now,
  }
}

export function isDue(fields: SrsFields, now: number): boolean {
  return now >= fields.nextReviewAt
}
