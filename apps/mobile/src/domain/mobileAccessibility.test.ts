import { describe, expect, it } from "vitest"

import {
  MIN_TOUCH_TARGET,
  MIN_TOUCH_TARGET_STYLE,
  TOUCH_TARGET_HIT_SLOP,
  buildPreferenceOptionAccessibilityLabel,
  buildReviewCardAccessibilityLabel,
  buildReviewFrontAccessibilityLabel,
  buildReviewProgressAccessibilityLabel,
  buildReviewRatingAccessibilityLabel,
} from "./mobileAccessibility"

describe("mobile accessibility helpers", () => {
  it("defines a 44 point touch baseline and reusable hit slop", () => {
    expect(MIN_TOUCH_TARGET).toBe(44)
    expect(MIN_TOUCH_TARGET_STYLE).toEqual({ minHeight: 44, minWidth: 44 })
    expect(TOUCH_TARGET_HIT_SLOP).toEqual({ top: 8, right: 8, bottom: 8, left: 8 })
  })

  it("builds understandable review progress copy", () => {
    expect(buildReviewProgressAccessibilityLabel(1, 3)).toBe("Review progress: 1 of 3 cards completed. 2 cards remain.")
    expect(buildReviewProgressAccessibilityLabel(2, 3)).toBe("Review progress: 2 of 3 cards completed. 1 card remains.")
    expect(buildReviewProgressAccessibilityLabel(0, 0)).toBe("Review progress: no cards ready.")
  })

  it("builds review card and front labels", () => {
    expect(buildReviewCardAccessibilityLabel("word", "Example source")).toBe("Word review card from Example source.")
    expect(buildReviewFrontAccessibilityLabel("sentence", "Bonjour tout le monde.")).toBe("Sentence front: Bonjour tout le monde.")
  })

  it("builds non-color-only rating labels", () => {
    expect(buildReviewRatingAccessibilityLabel("again")).toBe("Again, review rating")
    expect(buildReviewRatingAccessibilityLabel("good")).toBe("Good, review rating")
    expect(buildReviewRatingAccessibilityLabel("easy")).toBe("Easy, review rating")
    expect(buildReviewRatingAccessibilityLabel("skip")).toBe("Skip this card")
    expect(buildReviewRatingAccessibilityLabel("notUseful")).toBe("Not useful, remove from Today")
  })

  it("marks preference option state in labels", () => {
    expect(buildPreferenceOptionAccessibilityLabel("Review reminder", "Daily", true)).toBe("Review reminder: Daily. Selected.")
    expect(buildPreferenceOptionAccessibilityLabel("Preferred time", "Morning", false)).toBe("Preferred time: Morning. Not selected.")
  })
})
