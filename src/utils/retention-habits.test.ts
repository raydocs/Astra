import { describe, expect, it } from "vitest"

import {
  ASTRA_RETENTION_LOOP_POLICIES,
  evaluateAstraRetentionTouchpoint,
} from "./retention-habits"

describe("retention habit policy", () => {
  it("catalogs the operating-model retention loops with non-shaming guardrails", () => {
    expect(ASTRA_RETENTION_LOOP_POLICIES.map((policy) => policy.loopId)).toEqual([
      "today_review",
      "continue_reading",
      "continue_watching",
      "weekly_digest",
      "forgotten_words",
      "source_return",
      "pro_value_summary",
      "win_back",
    ])

    const serialized = JSON.stringify(ASTRA_RETENTION_LOOP_POLICIES).toLowerCase()
    expect(serialized).toContain("no guilt")
    expect(serialized).toContain("no unsolicited email")
    expect(serialized).toContain("unsubscribeable")

    const userFacingCopy = ASTRA_RETENTION_LOOP_POLICIES
      .flatMap((policy) => [policy.primaryCopy, policy.userFeeling])
      .join(" ")
      .toLowerCase()
    expect(userFacingCopy).not.toContain("token")
    expect(userFacingCopy).not.toContain("provider")
    expect(userFacingCopy).not.toContain("api key")
  })

  it("shows Today Review only when reviewable cards exist", () => {
    expect(evaluateAstraRetentionTouchpoint({
      loopId: "today_review",
      reviewableCardCount: 0,
    })).toMatchObject({
      decision: "suppress",
      reason: "no_reviewable_content",
      channels: [],
    })

    expect(evaluateAstraRetentionTouchpoint({
      loopId: "today_review",
      reviewableCardCount: 3,
    })).toMatchObject({
      decision: "show",
      reason: "not_suppressed",
      channels: ["in_product", "popup_badge", "optional_notification"],
      copy: "3 cards are ready. Finish in about 2 minutes.",
      analyticsSignals: expect.arrayContaining(["review_opened", "reminder_disabled"]),
    })
  })

  it("keeps Weekly Digest privacy-safe and suppresses empty or opted-out reminders", () => {
    expect(evaluateAstraRetentionTouchpoint({
      loopId: "weekly_digest",
      savedMomentCount: 0,
      reviewableCardCount: 0,
      sourceCount: 0,
    })).toMatchObject({
      decision: "suppress",
      reason: "no_digest_value",
    })

    expect(evaluateAstraRetentionTouchpoint({
      loopId: "weekly_digest",
      savedMomentCount: 4,
      sourceCount: 2,
      privacyMode: true,
    })).toMatchObject({
      decision: "show",
      channels: ["in_product", "account_digest"],
      copy: "Your weekly learning summary is ready. Astra records product events, not the text you read.",
      analyticsSignals: expect.arrayContaining(["digest_opened", "digest_viewed"]),
    })

    expect(evaluateAstraRetentionTouchpoint({
      loopId: "weekly_digest",
      savedMomentCount: 4,
      userOptedOutOfReminders: true,
    })).toMatchObject({
      decision: "suppress",
      reason: "user_opted_out",
    })
  })

  it("requires actionable source targets and low-frequency win-back boundaries", () => {
    expect(evaluateAstraRetentionTouchpoint({
      loopId: "continue_reading",
      sourceCount: 0,
    })).toMatchObject({
      decision: "suppress",
      reason: "no_continue_target",
    })

    expect(evaluateAstraRetentionTouchpoint({
      loopId: "continue_reading",
      sourceCount: 1,
    })).toMatchObject({
      decision: "show",
      channels: ["in_product", "popup_badge"],
      analyticsSignals: expect.arrayContaining(["continue_clicked", "resumed_reading"]),
    })

    expect(evaluateAstraRetentionTouchpoint({
      loopId: "win_back",
      daysSinceLastActive: 6,
      savedMomentCount: 3,
    })).toMatchObject({
      decision: "suppress",
      reason: "not_enough_inactivity",
    })

    expect(evaluateAstraRetentionTouchpoint({
      loopId: "win_back",
      daysSinceLastActive: 14,
      savedMomentCount: 3,
      emailUnsubscribed: true,
    })).toMatchObject({
      decision: "show",
      channels: ["in_product"],
      copy: "Your saved items are waiting when you’re ready.",
      analyticsSignals: expect.arrayContaining(["winback_sent"]),
    })
  })

  it("only frames Pro summaries around actual trial/pro learning value", () => {
    expect(evaluateAstraRetentionTouchpoint({
      loopId: "pro_value_summary",
      tier: "free",
      savedMomentCount: 8,
    })).toMatchObject({
      decision: "suppress",
      reason: "not_a_membership_value_moment",
    })

    expect(evaluateAstraRetentionTouchpoint({
      loopId: "pro_value_summary",
      tier: "pro",
      savedMomentCount: 8,
    })).toMatchObject({
      decision: "show",
      channels: ["account_digest", "in_product"],
      copy: "Your saved items stay organized for review.",
      analyticsSignals: expect.arrayContaining(["pro_value_seen"]),
    })
  })
})
