import { describe, expect, it } from "vitest"

import { AGAIN_INTERVAL_MS, BOX_INTERVALS_MS, applyReview, createDefaultSrsFields } from "./srs"

// These expectations mirror the canonical scheduler in src/utils/srs/leitner.ts.
// If the canonical box intervals or grade transitions change, update BOTH modules
// and this test in lockstep — mobile, web, and desktop must schedule identically.
describe("mobile Leitner SRS mirror", () => {
  const T = Date.UTC(2026, 4, 27, 12, 0, 0)
  const DAY = 24 * 60 * 60 * 1000

  it("keeps the canonical box intervals (1/2/4/8/16 days)", () => {
    expect(BOX_INTERVALS_MS[1]).toBe(1 * DAY)
    expect(BOX_INTERVALS_MS[2]).toBe(2 * DAY)
    expect(BOX_INTERVALS_MS[3]).toBe(4 * DAY)
    expect(BOX_INTERVALS_MS[4]).toBe(8 * DAY)
    expect(BOX_INTERVALS_MS[5]).toBe(16 * DAY)
  })

  it("'good' promotes one box and schedules the next box interval into the future", () => {
    const fresh = createDefaultSrsFields(T)
    const afterGood = applyReview(fresh, { grade: "good" }, T)
    expect(afterGood).toEqual({ srsBox: 2, nextReviewAt: T + 2 * DAY, reviewCount: 1, lastReviewedAt: T })

    const afterSecondGood = applyReview(afterGood, { grade: "good" }, T + 2 * DAY)
    expect(afterSecondGood).toEqual({ srsBox: 3, nextReviewAt: T + 2 * DAY + 4 * DAY, reviewCount: 2, lastReviewedAt: T + 2 * DAY })
  })

  it("'easy' jumps two boxes with the 1.5x interval and caps at box 5", () => {
    const box4 = { srsBox: 4, nextReviewAt: T, reviewCount: 3, lastReviewedAt: T - DAY }
    const afterEasy = applyReview(box4, { grade: "easy" }, T)
    expect(afterEasy).toEqual({ srsBox: 5, nextReviewAt: T + 16 * DAY * 1.5, reviewCount: 4, lastReviewedAt: T })
  })

  it("'again' resets to box 1 with the short relearn interval", () => {
    const box3 = { srsBox: 3, nextReviewAt: T, reviewCount: 5, lastReviewedAt: T - DAY }
    const afterAgain = applyReview(box3, { grade: "again" }, T)
    expect(afterAgain).toEqual({ srsBox: 1, nextReviewAt: T + AGAIN_INTERVAL_MS, reviewCount: 6, lastReviewedAt: T })
  })

  it("'hard' holds the current box at half the interval", () => {
    const box2 = { srsBox: 2, nextReviewAt: T, reviewCount: 1, lastReviewedAt: T - DAY }
    const afterHard = applyReview(box2, { grade: "hard" }, T)
    expect(afterHard).toEqual({ srsBox: 2, nextReviewAt: T + DAY, reviewCount: 2, lastReviewedAt: T })
  })

  it("never schedules a reviewed card as immediately due (the bug this fixes)", () => {
    const fresh = createDefaultSrsFields(T)
    for (const grade of ["again", "hard", "good", "easy"] as const) {
      const next = applyReview(fresh, { grade }, T)
      expect(next.nextReviewAt).toBeGreaterThan(T)
    }
  })
})
