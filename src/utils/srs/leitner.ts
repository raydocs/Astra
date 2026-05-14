/**
 * Leitner 5-Box Spaced Repetition System.
 * Pure functions — no browser dependencies.
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

export function createDefaultSrsFields(now?: number): SrsFields {
  const t = now ?? Date.now()
  return {
    srsBox: 1,
    nextReviewAt: t,
    reviewCount: 0,
    lastReviewedAt: null,
  }
}

export function promoteBox(fields: SrsFields, now?: number): SrsFields {
  const t = now ?? Date.now()
  const nextBox = Math.min(clampBox(fields.srsBox) + 1, 5)
  return {
    srsBox: nextBox,
    nextReviewAt: t + BOX_INTERVALS_MS[nextBox],
    reviewCount: fields.reviewCount + 1,
    lastReviewedAt: t,
  }
}

export function demoteBox(fields: SrsFields, now?: number): SrsFields {
  const t = now ?? Date.now()
  return {
    srsBox: 1,
    nextReviewAt: t + BOX_INTERVALS_MS[1],
    reviewCount: fields.reviewCount + 1,
    lastReviewedAt: t,
  }
}

export function applyReview(
  fields: SrsFields,
  outcome: { grade: ReviewGrade },
  now?: number,
): SrsFields {
  const t = now ?? Date.now()
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
    nextReviewAt: t + intervalMs,
    reviewCount: fields.reviewCount + 1,
    lastReviewedAt: t,
  }
}

export function isDue(fields: SrsFields, now?: number): boolean {
  const t = now ?? Date.now()
  return t >= fields.nextReviewAt
}

export interface SrsEntry {
  srsBox?: number
  nextReviewAt?: number
  reviewCount?: number
  lastReviewedAt?: number | null
}

export function getDueCards<T extends SrsEntry>(entries: T[], now?: number): T[] {
  const t = now ?? Date.now()
  return entries
    .filter((e) => t >= (e.nextReviewAt ?? 0))
    .sort((a, b) => (a.nextReviewAt ?? 0) - (b.nextReviewAt ?? 0))
}

export interface BoxDistribution {
  box1: number
  box2: number
  box3: number
  box4: number
  box5: number
  total: number
}

export function getBoxDistribution<T extends SrsEntry>(entries: T[]): BoxDistribution {
  const dist: BoxDistribution = { box1: 0, box2: 0, box3: 0, box4: 0, box5: 0, total: entries.length }
  for (const entry of entries) {
    const box = entry.srsBox ?? 1
    switch (box) {
      case 1: dist.box1++; break
      case 2: dist.box2++; break
      case 3: dist.box3++; break
      case 4: dist.box4++; break
      case 5: dist.box5++; break
      default: dist.box1++; break
    }
  }
  return dist
}

export function isMastered(fields: SrsFields): boolean {
  return fields.srsBox === 5
}
