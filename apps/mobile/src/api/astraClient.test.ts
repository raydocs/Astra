import { afterEach, describe, expect, it, vi } from "vitest"

import { createMobileAstraClient, normalizeMobileApiBaseUrl, type MobileDeviceIdentity } from "./astraClient"

const device: MobileDeviceIdentity = {
  deviceId: "device-mobile",
  label: "iPhone preview",
  platform: "ios",
  appKind: "mobile",
  appVersion: "0.1.0-test",
}

function jsonResponse(payload: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  })
}

describe("mobile Astra client", () => {
  const originalDev = (globalThis as { __DEV__?: boolean }).__DEV__

  afterEach(() => {
    ;(globalThis as { __DEV__?: boolean }).__DEV__ = originalDev
  })

  it("normalizes base URLs and rejects empty endpoints", () => {
    expect(normalizeMobileApiBaseUrl(" https://relay.example/v1/// ")).toBe("https://relay.example/v1")
    expect(() => normalizeMobileApiBaseUrl("   ")).toThrow("Astra sign-in endpoint is required")
  })

  it("requires deployed HTTPS session endpoints in non-dev bundles", () => {
    ;(globalThis as { __DEV__?: boolean }).__DEV__ = false
    expect(normalizeMobileApiBaseUrl(" https://relay.example/v1/// ")).toBe("https://relay.example/v1")
    expect(() => normalizeMobileApiBaseUrl("http://127.0.0.1:8787/v1")).toThrow("deployed HTTPS Astra account service URL")
    expect(() => normalizeMobileApiBaseUrl("https://localhost:8787/v1")).toThrow("deployed HTTPS Astra account service URL")
    expect(() => normalizeMobileApiBaseUrl("http://relay.example/v1")).toThrow("deployed HTTPS Astra account service URL")
  })

  it("signs in with mobile device metadata and idempotency", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({
      version: 1,
      sessionToken: "session-token",
      sessionId: "session-1",
      deviceId: "device-mobile",
      identityMode: "authenticated",
      relayBaseURL: "https://relay.example/v1",
      email: "user@example.com",
      plan: "pro",
      subscriptionStatus: "active",
      expiresAt: "2026-05-28T00:00:00.000Z",
    })) as unknown as typeof fetch
    const client = createMobileAstraClient({ baseURL: "https://relay.example/v1", fetchImpl })

    const session = await client.signIn({ email: " user@example.com ", password: "secret", device, idempotencyKey: "idem-1" })

    expect(session).toMatchObject({ sessionToken: "session-token", email: "user@example.com", plan: "pro" })
    expect(fetchImpl).toHaveBeenCalledWith("https://relay.example/v1/auth/session", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({
        "Idempotency-Key": "idem-1",
        "X-Astra-Device-Id": "device-mobile",
      }),
    }))
    const body = JSON.parse((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].body)
    expect(body).toMatchObject({ email: "user@example.com", deviceId: "device-mobile", device: { appKind: "mobile" } })
  })

  it("requests and redeems email sign-in codes", async () => {
    const fetchImpl = vi.fn(async (url: RequestInfo | URL) => {
      if (String(url).endsWith("/auth/email-code")) {
        return jsonResponse({ code: "654321", expiresAt: "2026-05-28T00:10:00.000Z", delivery: "development_response" })
      }
      return jsonResponse({
        version: 1,
        sessionToken: "email-code-session",
        sessionId: "session-email-code",
        deviceId: "device-mobile",
        identityMode: "authenticated",
        relayBaseURL: "https://relay.example/v1",
        email: "user@example.com",
        plan: "pro",
        subscriptionStatus: "active",
        expiresAt: "2026-05-28T00:00:00.000Z",
      })
    }) as unknown as typeof fetch
    const client = createMobileAstraClient({ baseURL: "https://relay.example/v1", fetchImpl })

    const challenge = await client.requestEmailSignInCode({ email: " user@example.com " })
    const session = await client.redeemEmailSignInCode({ email: " user@example.com ", code: " 654-321 ", device, idempotencyKey: "email-code-1" })

    expect(challenge).toEqual({ code: "654321", expiresAt: "2026-05-28T00:10:00.000Z", delivery: "development_response" })
    expect(session).toMatchObject({ sessionToken: "email-code-session", deviceId: "device-mobile" })
    expect(fetchImpl).toHaveBeenNthCalledWith(1, "https://relay.example/v1/auth/email-code", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ "Content-Type": "application/json" }),
    }))
    expect(fetchImpl).toHaveBeenNthCalledWith(2, "https://relay.example/v1/auth/email-code/redeem", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ "Idempotency-Key": "email-code-1", "X-Astra-Device-Id": "device-mobile" }),
    }))
    const body = JSON.parse((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[1][1].body)
    expect(body).toMatchObject({ email: "user@example.com", code: "654-321", deviceId: "device-mobile", device: { appKind: "mobile" } })
  })

  it("accepts email sign-in responses without a development code echo", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ expiresAt: "2026-05-28T00:10:00.000Z", delivery: "unavailable" })) as unknown as typeof fetch
    const client = createMobileAstraClient({ baseURL: "https://relay.example/v1", fetchImpl })

    await expect(client.requestEmailSignInCode({ email: "user@example.com" })).resolves.toEqual({
      code: null,
      expiresAt: "2026-05-28T00:10:00.000Z",
      delivery: "unavailable",
    })
  })

  it("redeems verified OAuth identity for an Astra session", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({
      version: 1,
      sessionToken: "oauth-session",
      sessionId: "session-oauth",
      deviceId: "device-mobile",
      identityMode: "authenticated",
      relayBaseURL: "https://relay.example/v1",
      email: "user@example.com",
      plan: "free",
      subscriptionStatus: "active",
      expiresAt: "2026-05-28T00:00:00.000Z",
    })) as unknown as typeof fetch
    const client = createMobileAstraClient({ baseURL: "https://relay.example/v1", fetchImpl })

    const session = await client.redeemOAuthIdentity({
      identity: { provider: "apple", subject: " apple-subject ", email: " user@example.com ", emailVerified: true },
      device,
      idempotencyKey: "oauth-1",
    })

    expect(session).toMatchObject({ sessionToken: "oauth-session", email: "user@example.com" })
    expect(fetchImpl).toHaveBeenCalledWith("https://relay.example/v1/auth/oauth/redeem", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ "Idempotency-Key": "oauth-1", "X-Astra-Device-Id": "device-mobile" }),
    }))
    const body = JSON.parse((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].body)
    expect(body).toMatchObject({
      provider: "apple",
      subject: "apple-subject",
      email: "user@example.com",
      emailVerified: true,
      verified: true,
      deviceId: "device-mobile",
      device: { appKind: "mobile" },
    })
  })

  it("requires a nonce when redeeming a provider ID token", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({})) as unknown as typeof fetch
    const client = createMobileAstraClient({ baseURL: "https://relay.example/v1", fetchImpl })

    await expect(client.redeemOAuthIdentity({
      identity: { provider: "google", idToken: " provider.jwt.token " } as never,
      device,
      idempotencyKey: "oauth-token-missing-nonce",
    })).rejects.toMatchObject({ status: 400, code: "INVALID_REQUEST" })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it("sends provider ID tokens without development verified payload fields", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({
      version: 1,
      sessionToken: "oauth-token-session",
      sessionId: "session-oauth-token",
      deviceId: "device-mobile",
      identityMode: "authenticated",
      relayBaseURL: "https://relay.example/v1",
      email: "user@example.com",
      plan: "free",
      subscriptionStatus: "active",
      expiresAt: "2026-05-28T00:00:00.000Z",
    })) as unknown as typeof fetch
    const client = createMobileAstraClient({ baseURL: "https://relay.example/v1", fetchImpl })

    await client.redeemOAuthIdentity({
      identity: { provider: "google", idToken: " provider.jwt.token ", nonce: " nonce-1 " },
      device,
      idempotencyKey: "oauth-token-1",
    })

    const body = JSON.parse((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].body)
    expect(body).toMatchObject({
      provider: "google",
      idToken: "provider.jwt.token",
      nonce: "nonce-1",
      deviceId: "device-mobile",
    })
    expect(body).not.toHaveProperty("verified")
    expect(body).not.toHaveProperty("subject")
  })

  it("requests and redeems mobile link codes", async () => {
    const fetchImpl = vi.fn(async (url: RequestInfo | URL) => {
      if (String(url).endsWith("/auth/mobile-link")) {
        return jsonResponse({ code: "123456", expiresAt: "2026-05-28T00:10:00.000Z", link: "astra-review://link?code=123456" })
      }
      return jsonResponse({
        version: 1,
        sessionToken: "linked-session",
        sessionId: "session-linked",
        deviceId: "device-mobile",
        identityMode: "authenticated",
        relayBaseURL: "https://relay.example/v1",
        email: "user@example.com",
        plan: "pro",
        subscriptionStatus: "active",
        expiresAt: "2026-05-28T00:00:00.000Z",
      })
    }) as unknown as typeof fetch
    const client = createMobileAstraClient({ baseURL: "https://relay.example/v1", fetchImpl })

    const challenge = await client.requestMobileLink({ session: { sessionToken: "desktop-session", relayBaseURL: "https://relay.example/v1" }, device })
    const session = await client.redeemMobileLink({ code: " 123-456 ", device, idempotencyKey: "link-1" })

    expect(challenge).toEqual({ code: "123456", expiresAt: "2026-05-28T00:10:00.000Z", link: "astra-review://link?code=123456" })
    expect(session).toMatchObject({ sessionToken: "linked-session", deviceId: "device-mobile" })
    expect(fetchImpl).toHaveBeenNthCalledWith(1, "https://relay.example/v1/auth/mobile-link", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ Authorization: "Bearer desktop-session", "X-Astra-Device-Id": "device-mobile" }),
    }))
    expect(fetchImpl).toHaveBeenNthCalledWith(2, "https://relay.example/v1/auth/mobile-link/redeem", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ "Idempotency-Key": "link-1", "X-Astra-Device-Id": "device-mobile" }),
    }))
    const body = JSON.parse((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[1][1].body)
    expect(body).toMatchObject({ code: "123-456", deviceId: "device-mobile", device: { appKind: "mobile" } })
  })

  it("pulls review deltas with cursors", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({
      serverTime: "2026-05-27T12:00:00.000Z",
      deltas: { vocabulary: [], review_schedule: [] },
      nextCursors: { vocabulary: "voc-1", review_schedule: "rev-1" },
    })) as unknown as typeof fetch
    const client = createMobileAstraClient({ baseURL: "https://relay.example/v1", fetchImpl })

    await client.pullSyncDeltas({
      session: { sessionToken: "session-token", relayBaseURL: "https://relay.example/v1" },
      device,
      cursors: { vocabulary: null, review_schedule: "rev-0" },
    })

    expect(fetchImpl).toHaveBeenCalledWith("https://relay.example/v1/sync/pull", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({
        Authorization: "Bearer session-token",
        "X-Astra-Device-Id": "device-mobile",
        "Content-Type": "application/json",
      }),
    }))
    const body = JSON.parse((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].body)
    expect(body).toEqual({ cursors: { vocabulary: null, review_schedule: "rev-0" } })
  })

  it("pushes sync mutations with bearer auth and device header", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ accepted: [], rejected: [], nextCursors: {} })) as unknown as typeof fetch
    const client = createMobileAstraClient({ baseURL: "https://relay.example/v1", fetchImpl })

    await client.pushSyncMutations({
      session: { sessionToken: "session-token", relayBaseURL: "https://relay.example/v1" },
      device,
      mutations: [{
        collection: "review_schedule",
        schemaVersion: 1,
        recordId: "vocab-1",
        operation: "upsert",
        clientMutationId: "mutation-1",
        deviceId: "device-mobile",
        clientUpdatedAt: "2026-05-27T12:00:00.000Z",
        payload: { vocabularyEntryId: "vocab-1" },
      }],
    })

    expect(fetchImpl).toHaveBeenCalledWith("https://relay.example/v1/sync/push", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({
        Authorization: "Bearer session-token",
        "X-Astra-Device-Id": "device-mobile",
        "Content-Type": "application/json",
      }),
    }))
  })

  it("deletes an account with bearer auth and device header", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 })) as unknown as typeof fetch
    const client = createMobileAstraClient({ baseURL: "https://relay.example/v1", fetchImpl })

    await client.deleteAccount({
      session: { sessionToken: "session-token", relayBaseURL: "https://relay.example/v1" },
      device,
    })

    expect(fetchImpl).toHaveBeenCalledWith("https://relay.example/v1/account", expect.objectContaining({
      method: "DELETE",
      headers: expect.objectContaining({
        Authorization: "Bearer session-token",
        "X-Astra-Device-Id": "device-mobile",
      }),
    }))
  })

  it("fetches weekly digest archive with bearer auth and device header", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({
      digestId: "digest_2026-05-25",
      periodStart: "2026-05-25T00:00:00.000Z",
      periodEnd: "2026-06-01T00:00:00.000Z",
      reviewedCount: 1,
      savedCount: 2,
      sourceBreakdown: [{ type: "page", count: 2 }],
      highlightedWords: ["resilient"],
      highlightedSentences: [],
      nextReviewCount: 3,
      generatedAt: "2026-05-29T12:00:00.000Z",
    })) as unknown as typeof fetch
    const client = createMobileAstraClient({ baseURL: "https://relay.example/v1", fetchImpl })

    const digest = await client.fetchWeeklyDigest({
      session: { sessionToken: "session-token", relayBaseURL: "https://relay.example/v1" },
      device,
      now: new Date("2026-05-29T12:00:00.000Z"),
    })

    expect(digest).toMatchObject({ digestId: "digest_2026-05-25", savedCount: 2, highlightedWords: ["resilient"] })
    expect(fetchImpl).toHaveBeenCalledWith("https://relay.example/v1/account/weekly-digest?now=2026-05-29T12%3A00%3A00.000Z", expect.objectContaining({
      method: "GET",
      headers: expect.objectContaining({
        Authorization: "Bearer session-token",
        "X-Astra-Device-Id": "device-mobile",
      }),
    }))
  })

  it("requests weekly digest email delivery with bearer auth and device header", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({
      delivery: "email",
      digest: {
        digestId: "digest_2026-05-25",
        periodStart: "2026-05-25T00:00:00.000Z",
        periodEnd: "2026-06-01T00:00:00.000Z",
        reviewedCount: 1,
        savedCount: 2,
        sourceBreakdown: [{ type: "page", count: 2 }],
        highlightedWords: ["resilient"],
        highlightedSentences: [],
        nextReviewCount: 3,
        generatedAt: "2026-05-29T12:00:00.000Z",
      },
    })) as unknown as typeof fetch
    const client = createMobileAstraClient({ baseURL: "https://relay.example/v1", fetchImpl })

    const result = await client.requestWeeklyDigestEmail({
      session: { sessionToken: "session-token", relayBaseURL: "https://relay.example/v1" },
      device,
      now: new Date("2026-05-29T12:00:00.000Z"),
    })

    expect(result).toMatchObject({ delivery: "email", digest: { digestId: "digest_2026-05-25", savedCount: 2 } })
    expect(fetchImpl).toHaveBeenCalledWith("https://relay.example/v1/account/weekly-digest/email?now=2026-05-29T12%3A00%3A00.000Z", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({
        Authorization: "Bearer session-token",
        "X-Astra-Device-Id": "device-mobile",
      }),
    }))
  })

  it("updates current device push token with bearer auth and device header", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({
      deviceId: "device-mobile",
      pushTokenStored: true,
      serverTime: "2026-05-29T12:00:00.000Z",
    })) as unknown as typeof fetch
    const client = createMobileAstraClient({ baseURL: "https://relay.example/v1", fetchImpl })

    const result = await client.updateCurrentDevicePushToken({
      session: { sessionToken: "session-token", relayBaseURL: "https://relay.example/v1" },
      device,
      expoPushToken: "ExponentPushToken[test]",
    })

    expect(result).toEqual({ deviceId: "device-mobile", pushTokenStored: true, serverTime: "2026-05-29T12:00:00.000Z" })
    expect(fetchImpl).toHaveBeenCalledWith("https://relay.example/v1/account/devices/current/push-token", expect.objectContaining({
      method: "PATCH",
      headers: expect.objectContaining({
        Authorization: "Bearer session-token",
        "X-Astra-Device-Id": "device-mobile",
        "Content-Type": "application/json",
      }),
    }))
    const body = JSON.parse((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].body)
    expect(body).toEqual({ expoPushToken: "ExponentPushToken[test]", platform: "ios" })
  })

  it("submits metadata-only mobile support reports", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({
      report: {
        reportId: "rpt_mobile_00000001",
        status: "submitted",
        createdAt: "2026-05-29T12:00:00.000Z",
        updatedAt: "2026-05-29T12:00:00.000Z",
        submittedAt: "2026-05-29T12:00:00.000Z",
        issueCategory: "other",
        defaultContentIncluded: false,
        knownIssue: null,
      },
    }, { status: 201 })) as unknown as typeof fetch
    const client = createMobileAstraClient({ baseURL: "https://relay.example/v1", fetchImpl })

    const result = await client.submitSupportReport({
      session: { sessionToken: "session-token", relayBaseURL: "https://relay.example/v1", plan: "pro" },
      device,
      featureSurface: "settings",
      issueCategory: "other",
    })

    expect(result).toMatchObject({ reportId: "rpt_mobile_00000001", status: "submitted", defaultContentIncluded: false })
    expect(fetchImpl).toHaveBeenCalledWith("https://relay.example/v1/support/reports", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({
        Authorization: "Bearer session-token",
        "X-Astra-Device-Id": "device-mobile",
        "Content-Type": "application/json",
      }),
    }))
    const body = JSON.parse((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].body)
    expect(body.bundle).toMatchObject({
      schema: "astra-support-bundle.v1",
      userConsent: true,
      extensionVersion: "0.1.0-test",
      browser: "Astra mobile ios",
      os: "ios",
      featureSurface: "settings",
      action: "mobile_help_note_sent",
      issueCategory: "other",
      runtimeSurface: "mobile_companion",
      privacyMode: true,
      membershipState: "pro",
      userMessageIncluded: false,
      contactIncluded: false,
      contentIncluded: { enabled: false, type: "none" },
    })
    expect(body.bundle.reportId).toMatch(/^rpt_[a-z0-9]+_[a-z0-9]{1,}$/)
  })

  it("exports account data with bearer auth and device header", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({
      schema: "astra-account-data-export.v1",
      generatedAt: "2026-05-29T12:00:00.000Z",
      account: { id: "usr_demo", email: "demo@astra.local" },
      currentSession: { sessionId: "session-1", deviceId: "device-mobile" },
      devices: [{ deviceId: "device-mobile", expoPushTokenStored: false }],
      sessions: [],
      oauthIdentities: [],
      syncMutations: [],
      weeklyDigests: [],
      mobileRetentionEvents: [],
    })) as unknown as typeof fetch
    const client = createMobileAstraClient({ baseURL: "https://relay.example/v1", fetchImpl })

    const exported = await client.exportAccountData({
      session: { sessionToken: "session-token", relayBaseURL: "https://relay.example/v1" },
      device,
    })

    expect(exported).toMatchObject({ schema: "astra-account-data-export.v1", account: { id: "usr_demo" } })
    expect(exported.devices).toHaveLength(1)
    expect(fetchImpl).toHaveBeenCalledWith("https://relay.example/v1/account/export", expect.objectContaining({
      method: "GET",
      headers: expect.objectContaining({
        Authorization: "Bearer session-token",
        "X-Astra-Device-Id": "device-mobile",
      }),
    }))
  })

  it("updates weekly digest preference with bearer auth and device header", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({
      preference: { weekly_digest: false },
      serverTime: "2026-05-29T12:00:00.000Z",
    })) as unknown as typeof fetch
    const client = createMobileAstraClient({ baseURL: "https://relay.example/v1", fetchImpl })

    const result = await client.updateWeeklyDigestPreference({
      session: { sessionToken: "session-token", relayBaseURL: "https://relay.example/v1" },
      device,
      enabled: false,
    })

    expect(result).toEqual({ preference: { weekly_digest: false }, serverTime: "2026-05-29T12:00:00.000Z" })
    expect(fetchImpl).toHaveBeenCalledWith("https://relay.example/v1/account/preferences/weekly-digest", expect.objectContaining({
      method: "PATCH",
      headers: expect.objectContaining({
        Authorization: "Bearer session-token",
        "X-Astra-Device-Id": "device-mobile",
        "Content-Type": "application/json",
      }),
    }))
    const body = JSON.parse((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].body)
    expect(body).toEqual({ enabled: false })
  })

  it("requests cloud review data deletion with idempotency", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({
      jobId: "del_job_1",
      scope: { collections: ["vocabulary", "review_schedule"] },
      status: "scheduled",
      requestedAt: "2026-05-27T12:00:00.000Z",
      scheduledForAt: "2026-06-03T12:00:00.000Z",
      completedAt: null,
      gracePeriodSeconds: 604800,
    })) as unknown as typeof fetch
    const client = createMobileAstraClient({ baseURL: "https://relay.example/v1", fetchImpl })

    const job = await client.requestCloudDataDelete({
      session: { sessionToken: "session-token", relayBaseURL: "https://relay.example/v1" },
      device,
      collections: ["vocabulary", "review_schedule"],
      idempotencyKey: "delete-1",
    })

    expect(job).toMatchObject({ jobId: "del_job_1", status: "scheduled", scope: { collections: ["vocabulary", "review_schedule"] } })
    expect(fetchImpl).toHaveBeenCalledWith("https://relay.example/v1/account/cloud-data-delete", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({
        Authorization: "Bearer session-token",
        "X-Astra-Device-Id": "device-mobile",
        "Content-Type": "application/json",
        "Idempotency-Key": "delete-1",
      }),
    }))
    const body = JSON.parse((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].body)
    expect(body).toEqual({ collections: ["vocabulary", "review_schedule"] })
  })

  it("uploads mobile retention events with bearer auth, device header, idempotency, and stable payload", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ acceptedCount: 1, serverTime: "2026-05-27T12:00:00.000Z" })) as unknown as typeof fetch
    const client = createMobileAstraClient({ baseURL: "https://relay.example/v1", fetchImpl })

    const response = await client.uploadMobileRetentionEvents({
      session: { sessionToken: "session-token", relayBaseURL: "https://relay.example/v1" },
      device,
      idempotencyKey: "retention-1",
      events: [{
        id: "event-1",
        name: "sync_succeeded",
        timestamp: Date.UTC(2026, 4, 27, 12),
        metadata: { status: "synced" },
      }],
    })

    expect(response).toEqual({ acceptedCount: 1, serverTime: "2026-05-27T12:00:00.000Z" })
    expect(fetchImpl).toHaveBeenCalledWith("https://relay.example/v1/account/mobile-retention-events", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({
        Authorization: "Bearer session-token",
        "X-Astra-Device-Id": "device-mobile",
        "Content-Type": "application/json",
        "Idempotency-Key": "retention-1",
      }),
    }))
    const body = JSON.parse((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].body)
    expect(body).toEqual({
      schema: "astra-mobile-retention-events.v1",
      events: [{ id: "event-1", name: "sync_succeeded", timestamp: Date.UTC(2026, 4, 27, 12), metadata: { status: "synced" } }],
    })
  })

  it("fetches cloud review data deletion job status", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({
      jobId: "del_job_1",
      scope: { collections: ["vocabulary", "review_schedule"] },
      status: "completed",
      requestedAt: "2026-05-27T12:00:00.000Z",
      scheduledForAt: "2026-06-03T12:00:00.000Z",
      completedAt: "2026-06-03T12:01:00.000Z",
      gracePeriodSeconds: 604800,
    })) as unknown as typeof fetch
    const client = createMobileAstraClient({ baseURL: "https://relay.example/v1", fetchImpl })

    const job = await client.fetchCloudDataDeleteJob({
      session: { sessionToken: "session-token", relayBaseURL: "https://relay.example/v1" },
      device,
      jobId: "del/job 1",
    })

    expect(job).toMatchObject({ jobId: "del_job_1", status: "completed" })
    expect(fetchImpl).toHaveBeenCalledWith("https://relay.example/v1/account/cloud-data-delete/del%2Fjob%201", expect.objectContaining({
      method: "GET",
      headers: expect.objectContaining({
        Authorization: "Bearer session-token",
        "X-Astra-Device-Id": "device-mobile",
      }),
    }))
  })
})
