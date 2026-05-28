import { afterEach, describe, expect, it, vi } from "vitest"

import { listAstraKnownIssues, submitAstraCancellationReason } from "./support"

describe("Astra support API", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("submits metadata-only cancellation feedback to the relay", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      schema: "astra-cancellation-reason-submission.v1",
      submission: {
        id: "cancel_1",
        submittedAt: "2026-05-27T00:00:00.000Z",
        reason: "privacy_concerns",
        plan: "pro",
        source: "settings",
        subscriptionStatus: "active",
      },
    }), { status: 201 }))
    vi.stubGlobal("fetch", fetchMock)

    await expect(submitAstraCancellationReason({
      baseURL: "https://astra.example/v1/",
      sessionToken: "astra-session",
      deviceId: "device-123",
      reason: "privacy_concerns",
      source: "settings",
    })).resolves.toMatchObject({
      schema: "astra-cancellation-reason-submission.v1",
      submission: { reason: "privacy_concerns", source: "settings" },
    })

    expect(fetchMock).toHaveBeenCalledWith("https://astra.example/v1/account/cancellation-reasons", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({
        Authorization: "Bearer astra-session",
        "X-Astra-Device-Id": "device-123",
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({ reason: "privacy_concerns", source: "settings" }),
    }))
  })

  it("lists privacy-safe known issues from the relay", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      schema: "astra-known-issues.v1",
      issues: [{
        issueId: "issue_video_subtitles",
        status: "workaround",
        featureSurface: "video",
        issueCategory: "video_subtitles",
        affectedVersions: [],
        firstSeenAt: "2026-05-27T00:00:00.000Z",
        updatedAt: "2026-05-27T01:00:00.000Z",
        workaroundKey: "try_transcript_panel",
      }],
    }), { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    await expect(listAstraKnownIssues({ baseURL: "https://astra.example/v1/" })).resolves.toEqual([
      expect.objectContaining({
        issueId: "issue_video_subtitles",
        status: "workaround",
        featureSurface: "video",
        issueCategory: "video_subtitles",
      }),
    ])
    expect(fetchMock).toHaveBeenCalledWith("https://astra.example/v1/support/known-issues")
  })
})
