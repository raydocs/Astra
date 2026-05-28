import { describe, expect, it } from "vitest"

import { AstraPlanSchema } from "../types/auth"
import { COPY_DICTIONARY, findForbiddenUserCopyTerms } from "./copy-dictionary"
import { ENTITLEMENT_MATRIX, canUseTask, getPlanEntitlement, shouldMeterTask } from "./entitlements"

describe("entitlements", () => {
  it("accepts trial as an Astra plan", () => {
    expect(AstraPlanSchema.parse("trial")).toBe("trial")
  })

  it("defines every task for every plan", () => {
    expect(Object.keys(ENTITLEMENT_MATRIX)).toEqual(["free", "trial", "pro"])
    expect(ENTITLEMENT_MATRIX.trial.deep_reading.access).toBe("limited")
    expect(ENTITLEMENT_MATRIX.pro.instant_phrase.access).toBe("included")
  })

  it("returns task access decisions", () => {
    expect(canUseTask("free", "instant_phrase")).toBe(true)
    expect(getPlanEntitlement("free", "deep_reading")).toMatchObject({ access: "sample", monthlyAllowance: 1 })
    expect(getPlanEntitlement("pro", "video_summary")).toMatchObject({ access: "limited", monthlyAllowance: 50 })
  })

  it("meters higher-cost task classes only", () => {
    expect(shouldMeterTask("deep_reading")).toBe(true)
    expect(shouldMeterTask("video_summary")).toBe(true)
    expect(shouldMeterTask("review_card")).toBe(false)
  })

  it("keeps entitlement and shared dictionary messages plain", () => {
    for (const plan of Object.values(ENTITLEMENT_MATRIX)) {
      for (const entitlement of Object.values(plan)) {
        expect(findForbiddenUserCopyTerms(entitlement.userMessage)).toEqual([])
      }
    }

    for (const copy of Object.values(COPY_DICTIONARY)) {
      expect(findForbiddenUserCopyTerms(copy)).toEqual([])
    }
  })
})
