import { describe, expect, it } from "vitest"
import {
  BOX_INTERVALS_MS,
  AGAIN_INTERVAL_MS,
  HARD_INTERVAL_MULTIPLIER,
  EASY_INTERVAL_MULTIPLIER,
  createDefaultSrsFields,
  promoteBox,
  demoteBox,
  applyReview,
  isDue,
  getDueCards,
  getBoxDistribution,
  isMastered,
  type SrsFields,
} from "./leitner"

const T0 = 1_700_000_000_000 // deterministic base timestamp

describe("createDefaultSrsFields", () => {
  it("returns box 1 with nextReviewAt = now", () => {
    const fields = createDefaultSrsFields(T0)
    expect(fields).toEqual({
      srsBox: 1,
      nextReviewAt: T0,
      reviewCount: 0,
      lastReviewedAt: null,
    })
  })
})

describe("promoteBox", () => {
  it("moves from box 1 to box 2 with correct interval", () => {
    const fields = createDefaultSrsFields(T0)
    const promoted = promoteBox(fields, T0 + 1000)
    expect(promoted.srsBox).toBe(2)
    expect(promoted.nextReviewAt).toBe(T0 + 1000 + BOX_INTERVALS_MS[2])
    expect(promoted.reviewCount).toBe(1)
    expect(promoted.lastReviewedAt).toBe(T0 + 1000)
  })

  it("clamps at box 5", () => {
    const fields: SrsFields = {
      srsBox: 5,
      nextReviewAt: T0,
      reviewCount: 10,
      lastReviewedAt: T0 - 1000,
    }
    const promoted = promoteBox(fields, T0 + 1000)
    expect(promoted.srsBox).toBe(5)
    expect(promoted.nextReviewAt).toBe(T0 + 1000 + BOX_INTERVALS_MS[5])
    expect(promoted.reviewCount).toBe(11)
  })

  it("progresses through all boxes with correct intervals", () => {
    let fields = createDefaultSrsFields(T0)
    let t = T0

    for (let expectedBox = 2; expectedBox <= 5; expectedBox++) {
      t += BOX_INTERVALS_MS[fields.srsBox]
      fields = promoteBox(fields, t)
      expect(fields.srsBox).toBe(expectedBox)
      expect(fields.nextReviewAt).toBe(t + BOX_INTERVALS_MS[expectedBox])
    }
  })
})

describe("demoteBox", () => {
  it("always resets to box 1", () => {
    const fields: SrsFields = {
      srsBox: 4,
      nextReviewAt: T0,
      reviewCount: 5,
      lastReviewedAt: T0 - 1000,
    }
    const demoted = demoteBox(fields, T0 + 1000)
    expect(demoted.srsBox).toBe(1)
    expect(demoted.nextReviewAt).toBe(T0 + 1000 + BOX_INTERVALS_MS[1])
    expect(demoted.reviewCount).toBe(6)
    expect(demoted.lastReviewedAt).toBe(T0 + 1000)
  })
})

describe("applyReview", () => {
  const reviewedAt = T0 + 5000
  const boxThreeFields: SrsFields = {
    srsBox: 3,
    nextReviewAt: T0,
    reviewCount: 3,
    lastReviewedAt: T0 - 1000,
  }

  it("schedules Again by resetting to box 1 due in 10 minutes", () => {
    const result = applyReview(boxThreeFields, { grade: "again" }, reviewedAt)

    expect(result).toEqual({
      srsBox: 1,
      nextReviewAt: reviewedAt + AGAIN_INTERVAL_MS,
      reviewCount: 4,
      lastReviewedAt: reviewedAt,
    })
  })

  it("schedules Hard by keeping the current box with a half interval", () => {
    const result = applyReview(boxThreeFields, { grade: "hard" }, reviewedAt)

    expect(result).toEqual({
      srsBox: 3,
      nextReviewAt: reviewedAt + BOX_INTERVALS_MS[3] * HARD_INTERVAL_MULTIPLIER,
      reviewCount: 4,
      lastReviewedAt: reviewedAt,
    })
  })

  it("schedules Good by advancing one box with the normal target-box interval", () => {
    const result = applyReview(boxThreeFields, { grade: "good" }, reviewedAt)

    expect(result).toEqual({
      srsBox: 4,
      nextReviewAt: reviewedAt + BOX_INTERVALS_MS[4],
      reviewCount: 4,
      lastReviewedAt: reviewedAt,
    })
  })

  it("schedules Easy by advancing two boxes with a longer target-box interval", () => {
    const result = applyReview(boxThreeFields, { grade: "easy" }, reviewedAt)

    expect(result).toEqual({
      srsBox: 5,
      nextReviewAt: reviewedAt + BOX_INTERVALS_MS[5] * EASY_INTERVAL_MULTIPLIER,
      reviewCount: 4,
      lastReviewedAt: reviewedAt,
    })
  })

  it("keeps Hard, Good, and Easy distinct at box 5", () => {
    const fields: SrsFields = { srsBox: 5, nextReviewAt: T0, reviewCount: 8, lastReviewedAt: T0 - 1000 }

    expect(applyReview(fields, { grade: "hard" }, reviewedAt)).toEqual({
      srsBox: 5,
      nextReviewAt: reviewedAt + BOX_INTERVALS_MS[5] * HARD_INTERVAL_MULTIPLIER,
      reviewCount: 9,
      lastReviewedAt: reviewedAt,
    })
    expect(applyReview(fields, { grade: "good" }, reviewedAt)).toEqual({
      srsBox: 5,
      nextReviewAt: reviewedAt + BOX_INTERVALS_MS[5],
      reviewCount: 9,
      lastReviewedAt: reviewedAt,
    })
    expect(applyReview(fields, { grade: "easy" }, reviewedAt)).toEqual({
      srsBox: 5,
      nextReviewAt: reviewedAt + BOX_INTERVALS_MS[5] * EASY_INTERVAL_MULTIPLIER,
      reviewCount: 9,
      lastReviewedAt: reviewedAt,
    })
  })

  it("throws for an unsupported runtime grade", () => {
    expect(() => applyReview(boxThreeFields, { grade: "almost" } as never, reviewedAt)).toThrow("Unsupported SRS review grade: almost")
  })
})

describe("isDue", () => {
  it("returns true when now >= nextReviewAt", () => {
    const fields = createDefaultSrsFields(T0)
    expect(isDue(fields, T0)).toBe(true)
    expect(isDue(fields, T0 + 1)).toBe(true)
  })

  it("returns false when now < nextReviewAt", () => {
    const fields: SrsFields = { srsBox: 2, nextReviewAt: T0 + 10_000, reviewCount: 1, lastReviewedAt: T0 }
    expect(isDue(fields, T0 + 5000)).toBe(false)
  })
})

describe("getDueCards", () => {
  it("filters and sorts by most overdue first", () => {
    const entries = [
      { id: "a", nextReviewAt: T0 + 5000, srsBox: 2 },
      { id: "b", nextReviewAt: T0 - 1000, srsBox: 1 },  // most overdue
      { id: "c", nextReviewAt: T0 + 100_000, srsBox: 3 }, // not due
      { id: "d", nextReviewAt: T0, srsBox: 1 },           // due exactly now
    ]
    const due = getDueCards(entries, T0 + 5000)
    expect(due.map((e) => e.id)).toEqual(["b", "d", "a"])
  })

  it("returns empty array when nothing is due", () => {
    const entries = [
      { id: "a", nextReviewAt: T0 + 10_000, srsBox: 2 },
    ]
    expect(getDueCards(entries, T0)).toEqual([])
  })

  it("treats missing nextReviewAt as 0 (always due)", () => {
    const entries = [
      { id: "a" },
      { id: "b", nextReviewAt: T0 + 99_999 },
    ]
    const due = getDueCards(entries, T0)
    expect(due.map((e) => e.id)).toEqual(["a"])
  })
})

describe("getBoxDistribution", () => {
  it("counts entries per box", () => {
    const entries = [
      { srsBox: 1 }, { srsBox: 1 },
      { srsBox: 2 },
      { srsBox: 3 }, { srsBox: 3 }, { srsBox: 3 },
      { srsBox: 5 },
    ]
    expect(getBoxDistribution(entries)).toEqual({
      box1: 2, box2: 1, box3: 3, box4: 0, box5: 1, total: 7,
    })
  })

  it("treats missing srsBox as box 1", () => {
    const entries = [{}]
    const dist = getBoxDistribution(entries)
    expect(dist.box1).toBe(1)
    expect(dist.total).toBe(1)
  })
})

describe("isMastered", () => {
  it("returns true only for box 5", () => {
    expect(isMastered({ srsBox: 5, nextReviewAt: T0, reviewCount: 0, lastReviewedAt: null })).toBe(true)
    expect(isMastered({ srsBox: 4, nextReviewAt: T0, reviewCount: 0, lastReviewedAt: null })).toBe(false)
    expect(isMastered({ srsBox: 1, nextReviewAt: T0, reviewCount: 0, lastReviewedAt: null })).toBe(false)
  })
})
