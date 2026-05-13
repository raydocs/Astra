import { describe, expect, it, vi } from "vitest"

import type { AstraRequestContext } from "../context"
import { fetchNodeRelay } from "./proxy"

function createContext(): AstraRequestContext {
  return {
    requestId: "req_proxy_test",
    nowEpochMs: Date.parse("2026-04-11T12:00:00.000Z"),
    config: {
      environment: "test",
      nodeRelayOrigin: new URL("https://relay.astra.example"),
      articleImportMode: "proxy",
      articleImportModeOverrides: {},
      platformMirrorSecret: "mirror-secret",
      sessionPublicBaseURL: "https://platform.astra.example/v1",
      authAnonymousIssueMode: "proxy",
      authSessionIssueMode: "proxy",
      authSessionReadMode: "proxy",
      authSessionRevokeWriteMode: "proxy",
      accountSummaryReadMode: "proxy",
      deviceListReadMode: "proxy",
      deviceRevokeWriteMode: "proxy",
      syncBootstrapReadMode: "proxy",
      syncPullReadMode: "proxy",
      syncPushWriteMode: "proxy",
      syncMaxMutationsPerRequest: 200,
      articleImportAllowedHosts: [],
      articleImportBlockedHosts: [],
      articleImportForceProxyHosts: [],
      articleImportRateLimitMax: null,
      articleImportRateLimitWindowSeconds: 60,
      articleImportMaxQueueAttempts: 3,
      articleImportMaxShadowBytes: 262_144,
      articleImportMaxNativeBytes: 2_097_152,
      articleImportArtifactRetentionDays: 7,
      articleImportArtifactRetentionClass: "import-shadow",
      continuityExportArtifactRetentionDays: 7,
      continuityDeleteGracePeriodSeconds: 604_800,
      continuityJobHistoryRetentionDays: 90,
      continuityTombstoneRetentionDays: 30,
      syncTombstoneRetentionDays: 30,
      syncCompactionBatchSize: 500,
      syncCompactionDryRun: true,
    },
    execution: {
      waitUntil: vi.fn(),
    },
  }
}

describe("fetchNodeRelay", () => {
  it("materializes a POST request body before forwarding to the Node relay", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("ok"))
    const request = new Request("https://platform.astra.example/v1/auth/session?debug=1", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Host: "platform.astra.example",
      },
      body: JSON.stringify({ ok: true }),
    })

    const response = await fetchNodeRelay(request, createContext())
    const [, init] = fetchSpy.mock.calls[0]!

    expect(response.status).toBe(200)
    expect(String(fetchSpy.mock.calls[0]![0])).toBe("https://relay.astra.example/v1/auth/session?debug=1")
    expect(init?.method).toBe("POST")
    expect(init?.body).toBeInstanceOf(ArrayBuffer)
    expect(new TextDecoder().decode(init?.body as ArrayBuffer)).toBe(JSON.stringify({ ok: true }))
    expect((init?.headers as Headers).get("host")).toBeNull()
    expect((init?.headers as Headers).get("x-astra-request-id")).toBe("req_proxy_test")
  })

  it("fails deterministically when asked to proxy an already-consumed body", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("ok"))
    const request = new Request("https://platform.astra.example/v1/auth/session", {
      method: "POST",
      body: JSON.stringify({ ok: true }),
    })
    await request.text()

    await expect(fetchNodeRelay(request, createContext())).rejects.toThrow("already been consumed")
    expect(fetchSpy).toHaveBeenCalledTimes(0)
  })

  it("does not require an unused body for GET requests", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("ok"))
    const request = new Request("https://platform.astra.example/v1/auth/session", {
      method: "GET",
    })

    await fetchNodeRelay(request, createContext())

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(fetchSpy.mock.calls[0]?.[1]?.body).toBeUndefined()
  })
})
