import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const {
  ensureAstraDeviceIdentityMock,
  clearPendingAstraSignInAttemptMock,
  clearPendingAnonymousBootstrapKeyMock,
  readPendingAstraSignInAttemptMock,
  readPendingAnonymousBootstrapKeyMock,
  savePendingAstraSignInAttemptMock,
  savePendingAnonymousBootstrapKeyMock,
} = vi.hoisted(() => ({
  ensureAstraDeviceIdentityMock: vi.fn(async () => ({
    version: 1 as const,
    deviceId: "device-123",
    label: "Chrome on macOS",
    platform: "macos" as const,
    browserFamily: "chrome" as const,
    appKind: "extension" as const,
    appVersion: "0.1.0-test",
    createdAt: "2026-04-09T00:00:00.000Z",
    updatedAt: "2026-04-09T00:00:00.000Z",
  })),
  clearPendingAstraSignInAttemptMock: vi.fn(async () => {}),
  clearPendingAnonymousBootstrapKeyMock: vi.fn(async () => {}),
  readPendingAstraSignInAttemptMock: vi.fn<() => Promise<{ email: string; idempotencyKey: string } | null>>(async () => null),
  readPendingAnonymousBootstrapKeyMock: vi.fn<() => Promise<string | null>>(async () => null),
  savePendingAstraSignInAttemptMock: vi.fn(async (email: string, idempotencyKey: string) => ({ email, idempotencyKey })),
  savePendingAnonymousBootstrapKeyMock: vi.fn(async (key: string) => key),
}))

vi.mock("@/utils/storage/auth", () => ({
  clearPendingAstraSignInAttempt: clearPendingAstraSignInAttemptMock,
  clearPendingAnonymousBootstrapKey: clearPendingAnonymousBootstrapKeyMock,
  ensureAstraDeviceIdentity: ensureAstraDeviceIdentityMock,
  readPendingAstraSignInAttempt: readPendingAstraSignInAttemptMock,
  readPendingAnonymousBootstrapKey: readPendingAnonymousBootstrapKeyMock,
  savePendingAstraSignInAttempt: savePendingAstraSignInAttemptMock,
  savePendingAnonymousBootstrapKey: savePendingAnonymousBootstrapKeyMock,
}))

import {
  AstraAuthRequestError,
  bootstrapAnonymousAstraSession,
  createAnonymousAstraSession,
  createAstraSession,
  parseAstraSessionPayload,
  refreshAstraSession,
  revokeAstraSession,
} from "./auth"

describe("Astra auth client", () => {
  beforeEach(() => {
    ensureAstraDeviceIdentityMock.mockClear()
    clearPendingAstraSignInAttemptMock.mockClear()
    clearPendingAnonymousBootstrapKeyMock.mockClear()
    readPendingAstraSignInAttemptMock.mockClear()
    readPendingAnonymousBootstrapKeyMock.mockClear()
    savePendingAstraSignInAttemptMock.mockClear()
    savePendingAnonymousBootstrapKeyMock.mockClear()
    readPendingAstraSignInAttemptMock.mockResolvedValue(null)
    readPendingAnonymousBootstrapKeyMock.mockResolvedValue(null)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("reuses a persisted authenticated sign-in key until issuance succeeds", async () => {
    readPendingAstraSignInAttemptMock.mockResolvedValue({
      email: "user@example.com",
      idempotencyKey: "sign-in-key-1",
    })
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
    expect(session.deviceId).toBe("device-123")
    expect(fetchMock).toHaveBeenCalledWith("https://astra.example/v1/auth/session", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({
        "Idempotency-Key": "sign-in-key-1",
        "X-Astra-Device-Id": "device-123",
      }),
      body: expect.stringContaining("device-123"),
    }))
    expect(savePendingAstraSignInAttemptMock).not.toHaveBeenCalled()
    expect(clearPendingAstraSignInAttemptMock).toHaveBeenCalledTimes(1)
  })

  it("preserves the authenticated sign-in key on ambiguous mirror-back failures", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: {
        code: "UPSTREAM_UNAVAILABLE",
        message: "Retry with the same Idempotency-Key.",
      },
    }), {
      status: 503,
      headers: {
        "Content-Type": "application/json",
        "x-astra-platform-fallback-reason": "mirror_back_commit_unknown",
      },
    }))
    vi.stubGlobal("fetch", fetchMock)

    await expect(createAstraSession({
      baseURL: "https://astra.example/v1",
      email: "User@Example.com",
      password: "secret-pass",
    })).rejects.toMatchObject({
      name: "AstraAuthRequestError",
      status: 503,
      fallbackReason: "mirror_back_commit_unknown",
    } satisfies Partial<AstraAuthRequestError>)

    expect(savePendingAstraSignInAttemptMock).toHaveBeenCalledWith("user@example.com", expect.any(String))
    expect(clearPendingAstraSignInAttemptMock).not.toHaveBeenCalled()
  })

  it("creates an anonymous Astra session with an Idempotency-Key and device payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      version: 1,
      sessionToken: "astra-session-anon",
      relayBaseURL: "https://astra.example/v1",
      email: "anon_demo@astra.anonymous",
      plan: "free",
      providerEntitlements: ["openai"],
      expiresAt: null,
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }))
    vi.stubGlobal("fetch", fetchMock)

    const session = await createAnonymousAstraSession({
      baseURL: "https://astra.example/v1",
      idempotencyKey: "anon-key-1",
    })

    expect(session.sessionToken).toBe("astra-session-anon")
    expect(session.deviceId).toBe("device-123")
    expect(fetchMock).toHaveBeenCalledWith("https://astra.example/v1/auth/anonymous", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({
        "Idempotency-Key": "anon-key-1",
        "X-Astra-Device-Id": "device-123",
      }),
      body: expect.stringContaining("device-123"),
    }))
  })

  it("reuses a persisted anonymous bootstrap key until issuance succeeds", async () => {
    readPendingAnonymousBootstrapKeyMock.mockResolvedValue("anon-pending-1")
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      version: 1,
      sessionToken: "astra-session-anon",
      relayBaseURL: "https://astra.example/v1",
      email: "anon_demo@astra.anonymous",
      plan: "free",
      providerEntitlements: ["openai"],
      expiresAt: null,
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }))
    vi.stubGlobal("fetch", fetchMock)

    const session = await bootstrapAnonymousAstraSession({
      baseURL: "https://astra.example/v1",
    })

    expect(session.identityMode).toBe("anonymous")
    expect(savePendingAnonymousBootstrapKeyMock).not.toHaveBeenCalled()
    expect(clearPendingAnonymousBootstrapKeyMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith("https://astra.example/v1/auth/anonymous", expect.objectContaining({
      headers: expect.objectContaining({
        "Idempotency-Key": "anon-pending-1",
      }),
    }))
  })

  it("preserves the bootstrap key on ambiguous mirror-back failures", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: {
        code: "UPSTREAM_UNAVAILABLE",
        message: "Retry with the same Idempotency-Key.",
      },
    }), {
      status: 503,
      headers: {
        "Content-Type": "application/json",
        "x-astra-platform-fallback-reason": "mirror_back_commit_unknown",
      },
    }))
    vi.stubGlobal("fetch", fetchMock)

    await expect(bootstrapAnonymousAstraSession({
      baseURL: "https://astra.example/v1",
    })).rejects.toMatchObject({
      name: "AstraAuthRequestError",
      status: 503,
      fallbackReason: "mirror_back_commit_unknown",
    } satisfies Partial<AstraAuthRequestError>)

    expect(savePendingAnonymousBootstrapKeyMock).toHaveBeenCalledTimes(1)
    expect(clearPendingAnonymousBootstrapKeyMock).not.toHaveBeenCalled()
  })

  it("refreshes a session with bearer auth and device header", async () => {
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
    expect(session.deviceId).toBe("device-123")
    expect(fetchMock).toHaveBeenCalledWith("https://astra.example/v1/auth/session", expect.objectContaining({
      method: "GET",
      headers: {
        Authorization: "Bearer astra-session",
        "X-Astra-Device-Id": "device-123",
      },
    }))
  })

  it("revokes a session with bearer auth and device header", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal("fetch", fetchMock)

    await revokeAstraSession({
      baseURL: "https://astra.example/v1",
      sessionToken: "astra-session",
    })

    expect(fetchMock).toHaveBeenCalledWith("https://astra.example/v1/auth/session", expect.objectContaining({
      method: "DELETE",
      headers: {
        Authorization: "Bearer astra-session",
        "X-Astra-Device-Id": "device-123",
      },
    }))
  })

  it("parses session payloads with continuity fallbacks", () => {
    const session = parseAstraSessionPayload({
      version: 1,
      sessionToken: "astra-session",
      relayBaseURL: "https://astra.example/v1",
      email: "user@example.com",
      plan: "free",
      providerEntitlements: ["openai", "gemini"],
      expiresAt: null,
    }, {
      deviceId: "device-123",
      identityMode: "anonymous",
    })

    expect(session.plan).toBe("free")
    expect(session.deviceId).toBe("device-123")
    expect(session.identityMode).toBe("anonymous")
  })
})
