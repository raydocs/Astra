import { afterEach, describe, expect, it, vi } from "vitest"

import {
  createAstraSession,
  parseAstraSessionPayload,
  refreshAstraSession,
  revokeAstraSession,
} from "./auth"

describe("Astra auth client", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("creates an Astra session from the relay auth endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      version: 1,
      sessionToken: "astra-session",
      relayBaseURL: "https://astra.example/v1",
      email: "user@example.com",
      plan: "pro",
      providerEntitlements: ["openai", "gemini"],
      expiresAt: null,
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }))
    vi.stubGlobal("fetch", fetchMock)

    const session = await createAstraSession({
      baseURL: "https://astra.example/v1",
      email: "user@example.com",
      password: "secret-pass",
    })

    expect(session.sessionToken).toBe("astra-session")
    expect(fetchMock).toHaveBeenCalledWith("https://astra.example/v1/auth/session", expect.objectContaining({
      method: "POST",
    }))
  })

  it("refreshes a session with bearer auth", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      version: 1,
      sessionToken: "astra-session",
      relayBaseURL: "https://astra.example/v1",
      email: "user@example.com",
      plan: "pro",
      providerEntitlements: ["openai"],
      expiresAt: null,
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }))
    vi.stubGlobal("fetch", fetchMock)

    const session = await refreshAstraSession({
      baseURL: "https://astra.example/v1",
      sessionToken: "astra-session",
    })

    expect(session.providerEntitlements).toEqual(["openai"])
    expect(fetchMock).toHaveBeenCalledWith("https://astra.example/v1/auth/session", expect.objectContaining({
      method: "GET",
      headers: {
        Authorization: "Bearer astra-session",
      },
    }))
  })

  it("revokes a session with bearer auth", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal("fetch", fetchMock)

    await revokeAstraSession({
      baseURL: "https://astra.example/v1",
      sessionToken: "astra-session",
    })

    expect(fetchMock).toHaveBeenCalledWith("https://astra.example/v1/auth/session", expect.objectContaining({
      method: "DELETE",
    }))
  })

  it("parses session payloads with entitlements", () => {
    const session = parseAstraSessionPayload({
      version: 1,
      sessionToken: "astra-session",
      relayBaseURL: "https://astra.example/v1",
      email: "user@example.com",
      plan: "free",
      providerEntitlements: ["openai", "gemini"],
      expiresAt: null,
    })

    expect(session.plan).toBe("free")
  })
})
