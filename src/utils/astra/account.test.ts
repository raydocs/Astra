import { afterEach, describe, expect, it, vi } from "vitest"

import {
  createAstraCheckoutLink,
  createAstraPortalLink,
  fetchAstraAccount,
  fetchAstraUsageSnapshot,
  updateAstraPlan,
} from "./account"

describe("Astra account client", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("fetches an account profile with bearer auth", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: "usr_demo",
      relayBaseURL: "https://astra.example/v1",
      email: "user@example.com",
      billingEmail: "billing@example.com",
      createdAt: "2026-03-01T00:00:00.000Z",
      plan: "pro",
      subscriptionStatus: "active",
      providerEntitlements: ["openai", "gemini"],
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }))
    vi.stubGlobal("fetch", fetchMock)

    const account = await fetchAstraAccount({
      baseURL: "https://astra.example/v1",
      sessionToken: "astra-session",
    })

    expect(account.id).toBe("usr_demo")
    expect(fetchMock).toHaveBeenCalledWith("https://astra.example/v1/account", expect.objectContaining({
      method: "GET",
      headers: {
        Authorization: "Bearer astra-session",
      },
    }))
  })

  it("fetches a usage snapshot with bearer auth", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      generatedAt: "2026-03-26T00:01:00.000Z",
      quota: {
        dailyRequestsLimit: 2000,
        dailyCharactersLimit: 500000,
        requestsPerMinuteLimit: 120,
        remainingDailyRequests: 1999,
        remainingDailyCharacters: 499995,
      },
      usage: {
        totalRequests: 1,
        totalCharacters: 5,
        dailyRequestsUsed: 1,
        dailyCharactersUsed: 5,
        lastRequestAt: "2026-03-26T00:00:00.000Z",
        recentEvents: [{
          timestamp: "2026-03-26T00:00:00.000Z",
          provider: "openai",
          requestCount: 1,
          characterCount: 5,
        }],
      },
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }))
    vi.stubGlobal("fetch", fetchMock)

    const usage = await fetchAstraUsageSnapshot({
      baseURL: "https://astra.example/v1",
      sessionToken: "astra-session",
    })

    expect(usage.usage.totalRequests).toBe(1)
    expect(fetchMock).toHaveBeenCalledWith("https://astra.example/v1/account/usage", expect.objectContaining({
      method: "GET",
      headers: {
        Authorization: "Bearer astra-session",
      },
    }))
  })

  it("updates the current plan through the account endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: "usr_demo",
      relayBaseURL: "https://astra.example/v1",
      email: "user@example.com",
      billingEmail: "billing@example.com",
      createdAt: "2026-03-01T00:00:00.000Z",
      plan: "free",
      subscriptionStatus: "active",
      providerEntitlements: ["openai"],
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }))
    vi.stubGlobal("fetch", fetchMock)

    const account = await updateAstraPlan({
      baseURL: "https://astra.example/v1",
      sessionToken: "astra-session",
      plan: "free",
    })

    expect(account.plan).toBe("free")
    expect(fetchMock).toHaveBeenCalledWith("https://astra.example/v1/account/plan", expect.objectContaining({
      method: "PATCH",
      headers: {
        Authorization: "Bearer astra-session",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ plan: "free" }),
    }))
  })

  it("creates a checkout link for plan upgrades", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      kind: "checkout",
      url: "https://billing.example/checkout?targetPlan=pro",
      generatedAt: "2026-03-26T00:03:00.000Z",
      plan: "pro",
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }))
    vi.stubGlobal("fetch", fetchMock)

    const link = await createAstraCheckoutLink({
      baseURL: "https://astra.example/v1",
      sessionToken: "astra-session",
      plan: "pro",
    })

    expect(link.kind).toBe("checkout")
    expect(fetchMock).toHaveBeenCalledWith("https://astra.example/v1/billing/checkout", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ plan: "pro" }),
    }))
  })

  it("creates a billing portal link", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      kind: "portal",
      url: "https://billing.example/portal",
      generatedAt: "2026-03-26T00:03:00.000Z",
      plan: "pro",
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }))
    vi.stubGlobal("fetch", fetchMock)

    const link = await createAstraPortalLink({
      baseURL: "https://astra.example/v1",
      sessionToken: "astra-session",
    })

    expect(link.kind).toBe("portal")
    expect(fetchMock).toHaveBeenCalledWith("https://astra.example/v1/billing/portal", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({}),
    }))
  })
})
