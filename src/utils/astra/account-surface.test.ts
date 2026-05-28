import { describe, expect, it } from "vitest"

import {
  buildQuotaInfoFromAccountState,
  formatAstraPlanLabel,
  formatAstraSubscriptionStatusLabel,
} from "./account-surface"

describe("account surface labels", () => {
  it("uses launch-safe free beta and unavailable paid labels", () => {
    expect(formatAstraPlanLabel("free")).toBe("Free beta")
    expect(formatAstraPlanLabel("trial")).toBe("Trial access (not launched)")
    expect(formatAstraPlanLabel("pro")).toBe("Pro plan (not launched)")
    expect(formatAstraPlanLabel(null)).toBe("Local only")
    expect(formatAstraSubscriptionStatusLabel("active")).toBe("Active beta session")
  })

  it("preserves trial quota plan without narrowing type failures", () => {
    const quotaInfo = buildQuotaInfoFromAccountState({
      account: {
        id: "acct_1",
        relayBaseURL: "https://relay.example/v1",
        email: "demo@astra.local",
        billingEmail: "demo@astra.local",
        createdAt: "2026-05-27T00:00:00.000Z",
        plan: "trial",
        subscriptionStatus: "active",
        providerEntitlements: ["openai"],
      },
      usage: {
        generatedAt: "2026-05-27T00:00:00.000Z",
        quota: {
          dailyRequestsLimit: 20,
          dailyCharactersLimit: 1000,
          requestsPerMinuteLimit: 5,
          remainingDailyRequests: 19,
          remainingDailyCharacters: 900,
        },
        usage: {
          totalRequests: 1,
          totalCharacters: 100,
          dailyRequestsUsed: 1,
          dailyCharactersUsed: 100,
          lastRequestAt: "2026-05-27T00:00:00.000Z",
          recentEvents: [],
        },
      },
      session: null,
    })

    expect(quotaInfo?.plan).toBe("trial")
  })
})
