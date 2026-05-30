import { describe, expect, it } from "vitest"

import { computeReviewStreak, reviewStreakCopy } from "./streak"

const DAY = 24 * 60 * 60 * 1000
const NOW = Date.UTC(2026, 4, 29, 15, 0, 0) // a mid-day "now"
const TODAY = Date.UTC(2026, 4, 29, 9, 0, 0)
const YESTERDAY = TODAY - DAY
const TWO_DAYS_AGO = TODAY - 2 * DAY

describe("computeReviewStreak", () => {
  it("returns 0 with no review timestamps", () => {
    expect(computeReviewStreak([], NOW)).toBe(0)
  })

  it("counts a single review done today as a 1-day streak", () => {
    expect(computeReviewStreak([TODAY], NOW)).toBe(1)
  })

  it("counts consecutive days ending today", () => {
    expect(computeReviewStreak([TODAY, YESTERDAY, TWO_DAYS_AGO], NOW)).toBe(3)
  })

  it("keeps the streak alive when reviewed yesterday but not yet today", () => {
    expect(computeReviewStreak([YESTERDAY, TWO_DAYS_AGO], NOW)).toBe(2)
  })

  it("breaks (returns 0) when the most recent review is older than yesterday", () => {
    expect(computeReviewStreak([TWO_DAYS_AGO, TWO_DAYS_AGO - DAY], NOW)).toBe(0)
  })

  it("stops at the first gap and ignores days before it", () => {
    expect(computeReviewStreak([TODAY, YESTERDAY, TWO_DAYS_AGO - DAY], NOW)).toBe(2)
  })

  it("de-duplicates multiple reviews on the same day", () => {
    const t1 = TODAY
    const t2 = TODAY + 60 * 60 * 1000
    expect(computeReviewStreak([t1, t2, YESTERDAY], NOW)).toBe(2)
  })

  it("ignores zero, negative, and non-finite timestamps", () => {
    expect(computeReviewStreak([0, -1, Number.NaN, TODAY], NOW)).toBe(1)
  })

  it("formats the brand-approved soft-progress copy", () => {
    expect(reviewStreakCopy(5)).toBe("You came back 5 days in a row.")
  })
})
