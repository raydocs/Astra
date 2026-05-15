import { describe, expect, it } from "vitest"

import relayLite from "./index"

const env = {
  OPENROUTER_API_KEY: "test-openrouter-key",
  ASTRA_SESSION_SECRET: "test-session-secret",
}

async function createSession() {
  const response = await relayLite.fetch(new Request("https://relay-lite.example/v1/auth/anonymous", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ deviceId: "device-test", email: "demo@astra.local" }),
  }), env)
  expect(response.status).toBe(200)
  return await response.json() as { sessionToken: string; providerEntitlements: string[] }
}

function authHeaders(sessionToken: string) {
  return {
    authorization: `Bearer ${sessionToken}`,
    "x-astra-device-id": "device-test",
  }
}

describe("relay-lite capability advertising", () => {
  it("advertises only provider entitlements backed by relay-lite translation", async () => {
    const session = await createSession()

    expect(session.providerEntitlements).toEqual(["google_translate", "openai", "gemini"])
  })

  it("does not advertise sync collections as enabled without push/repair support", async () => {
    const session = await createSession()
    const response = await relayLite.fetch(new Request("https://relay-lite.example/v1/sync/bootstrap", {
      method: "GET",
      headers: authHeaders(session.sessionToken),
    }), env)

    expect(response.status).toBe(200)
    const bootstrap = await response.json() as {
      collections: Record<string, { enabled: boolean; defaultEnabled: boolean; cursor: string | null }>
    }

    expect(Object.keys(bootstrap.collections).sort()).toEqual([
      "config",
      "reading_history",
      "review_schedule",
      "study_progress",
      "vocabulary",
    ])
    expect(Object.values(bootstrap.collections)).toEqual(
      expect.arrayContaining([
        { enabled: false, defaultEnabled: false, cursor: null },
      ]),
    )
    expect(Object.values(bootstrap.collections).every((collection) =>
      collection.enabled === false && collection.defaultEnabled === false && collection.cursor === null
    )).toBe(true)
  })

  it("keeps account summary sync capabilities consistent with bootstrap", async () => {
    const session = await createSession()
    const response = await relayLite.fetch(new Request("https://relay-lite.example/v1/account/summary", {
      method: "GET",
      headers: authHeaders(session.sessionToken),
    }), env)

    expect(response.status).toBe(200)
    const summary = await response.json() as {
      account: { providerEntitlements: string[] }
      sync: { collections: Record<string, { enabled: boolean; defaultEnabled: boolean }> }
    }

    expect(summary.account.providerEntitlements).toEqual(["google_translate", "openai", "gemini"])
    expect(Object.values(summary.sync.collections).every((collection) =>
      collection.enabled === false && collection.defaultEnabled === false
    )).toBe(true)
  })
})
