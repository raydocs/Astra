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

/** Interval per box in milliseconds */
export const BOX_INTERVALS_MS: Record<number, number> = {
  1: 1 * 24 * 60 * 60 * 1000,   //  1 day
  2: 2 * 24 * 60 * 60 * 1000,   //  2 days
  3: 4 * 24 * 60 * 60 * 1000,   //  4 days
  4: 8 * 24 * 60 * 60 * 1000,   //  8 days
  5: 16 * 24 * 60 * 60 * 1000,  // 16 days
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
  const nextBox = Math.min(fields.srsBox + 1, 5)
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
  outcome: { correct: boolean },
  now?: number,
): SrsFields {
  return outcome.correct ? promoteBox(fields, now) : demoteBox(fields, now)
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
