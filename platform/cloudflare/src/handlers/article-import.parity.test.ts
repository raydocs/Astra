import { afterEach, describe, expect, it, vi } from "vitest"

import type { AstraRequestContext } from "../context"
import type { AstraPlatformEnv } from "../env"
import type { ImportedReadableArticle } from "../types/article-import"
import { handleArticleImport } from "./article-import"
import { loadArticleImportParityFixtures } from "../../tests/fixtures/article-import-parity"
import { buildParityDelta, extractRelayArticleFromHtml } from "../../tests/helpers/article-import-parity"

function createEnv(mode: "proxy" | "shadow" | "native"): AstraPlatformEnv {
  return {
    ASTRA_PLATFORM_DB: {
      prepare: vi.fn(() => ({
        bind: vi.fn().mockReturnThis(),
        run: vi.fn(async () => ({ success: true })),
        all: vi.fn(async () => ({ success: true, results: [] })),
        first: vi.fn(async () => null),
      })),
    },
    ASTRA_IMPORT_PAYLOADS: {
      put: vi.fn(async () => {}),
      head: vi.fn(async () => null),
    },
    ASTRA_IDEMPOTENCY_KV: {
      get: vi.fn(async () => null),
      put: vi.fn(async () => {}),
    },
    ARTICLE_IMPORT_QUEUE: {
      send: vi.fn(async () => {}),
    },
    NODE_RELAY_ORIGIN: "https://relay.astra.example",
    ARTICLE_IMPORT_MODE: mode,
    ASTRA_ENV: "test",
  }
}

function createContext(mode: "proxy" | "shadow" | "native") {
  const pending: Promise<unknown>[] = []

  const ctx: AstraRequestContext = {
    requestId: `req_${mode}`,
    nowEpochMs: Date.now(),
    config: {
      environment: "test",
      nodeRelayOrigin: new URL("https://relay.astra.example"),
      articleImportMode: mode,
      articleImportModeOverrides: {},
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
      continuityDeleteGracePeriodSeconds: 1_800,
      continuityJobHistoryRetentionDays: 90,
      continuityTombstoneRetentionDays: 30,
      syncTombstoneRetentionDays: 30,
      syncCompactionBatchSize: 500,
      syncCompactionDryRun: true,
    },
    execution: {
      waitUntil(promise: Promise<unknown>) {
        pending.push(promise)
      },
    },
  }

  return {
    ctx,
    async flushWaitUntil() {
      await Promise.allSettled(pending.splice(0))
    },
  }
}

function readHeader(headers: HeadersInit | undefined, key: string): string | null {
  if (!headers) return null

  const target = key.toLowerCase()
  if (headers instanceof Headers) {
    return headers.get(target)
  }

  if (Array.isArray(headers)) {
    for (const [name, value] of headers) {
      if (name.toLowerCase() === target) return String(value)
    }
    return null
  }

  for (const [name, value] of Object.entries(headers)) {
    if (name.toLowerCase() === target) {
      return Array.isArray(value) ? String(value[0]) : String(value)
    }
  }

  return null
}

function summarizeParity(deltas: ReturnType<typeof buildParityDelta>[]): string {
  return deltas.map((delta) => {
    const mismatchFlags = [
      delta.diff.titleMatch ? null : "title",
      delta.diff.bylineMatch ? null : "byline",
      delta.diff.scopeMatch ? null : "scope",
      delta.diff.summaryMatch ? null : "summary",
    ].filter(Boolean)

    return [
      `fixture=${delta.fixtureId}`,
      `route=${delta.nativeRoute}`,
      `overlap=${delta.diff.overlapRatio}`,
      `blockDelta=${delta.diff.blockCountDelta}`,
      `mismatch=${mismatchFlags.length > 0 ? mismatchFlags.join(",") : "none"}`,
      `nativeOnly=${delta.diff.nativeOnlySample.join(" || ") || "-"}`,
      `relayOnly=${delta.diff.relayOnlySample.join(" || ") || "-"}`,
    ].join(" | ")
  }).join("\n")
}

describe("article import parity fixtures", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("captures native-versus-relay deltas for representative article fixtures", async () => {
    const fixtures = await loadArticleImportParityFixtures()
    const fixturesById = new Map(fixtures.map((fixture) => [fixture.id, fixture]))
    const fixturesByUrl = new Map(fixtures.map((fixture) => [fixture.url, fixture]))
    const relayByFixtureId = new Map(
      fixtures.map((fixture) => [fixture.id, extractRelayArticleFromHtml(fixture.url, fixture.html)]),
    )

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const requestUrl = input instanceof Request ? input.url : input instanceof URL ? input.toString() : String(input)

      const fixtureForNative = fixturesByUrl.get(requestUrl)
      if (fixtureForNative) {
        return new Response(fixtureForNative.html, {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" },
        })
      }

      if (requestUrl === "https://relay.astra.example/v1/import/article") {
        const fixtureId = input instanceof Request
          ? input.headers.get("x-parity-fixture-id")
          : readHeader(init?.headers, "x-parity-fixture-id")

        const fixture = fixtureId ? fixturesById.get(fixtureId) : null
        if (!fixture) {
          throw new Error(`Missing parity fixture id for relay call: ${requestUrl}`)
        }

        const relayPayload = relayByFixtureId.get(fixture.id)
        if (!relayPayload) {
          throw new Error(`Missing relay payload for fixture: ${fixture.id}`)
        }

        return new Response(JSON.stringify(relayPayload), {
          status: 200,
          headers: { "content-type": "application/json; charset=utf-8" },
        })
      }

      throw new Error(`Unexpected fetch url: ${requestUrl}`)
    })

    const deltas: ReturnType<typeof buildParityDelta>[] = []

    for (const fixture of fixtures) {
      const body = JSON.stringify({ url: fixture.url })
      const headers = {
        "content-type": "application/json",
        "x-parity-fixture-id": fixture.id,
      }

      const nativeContext = createContext("native")
      const nativeResponse = await handleArticleImport(
        new Request("https://platform.astra.example/v1/import/article", {
          method: "POST",
          headers,
          body,
        }),
        createEnv("native"),
        nativeContext.ctx,
      )
      await nativeContext.flushWaitUntil()
      const relayResponse = await handleArticleImport(
        new Request("https://platform.astra.example/v1/import/article", {
          method: "POST",
          headers,
          body,
        }),
        createEnv("proxy"),
        createContext("proxy").ctx,
      )

      const nativePayload = await nativeResponse.json() as ImportedReadableArticle
      const relayPayload = await relayResponse.json() as ImportedReadableArticle

      expect(nativeResponse.status).toBe(200)
      expect(nativeResponse.headers.get("x-astra-platform-route")).toBe("native")
      expect(relayResponse.status).toBe(200)
      expect(relayResponse.headers.get("x-astra-platform-route")).toBe("proxy")

      deltas.push(buildParityDelta({
        fixtureId: fixture.id,
        fixtureDescription: fixture.description,
        sourcePath: fixture.sourcePath,
        nativeRoute: nativeResponse.headers.get("x-astra-platform-route"),
        native: nativePayload,
        relay: relayPayload,
      }))
    }

    expect(fetchSpy).toHaveBeenCalledTimes(fixtures.length * 2)
    expect(deltas).toMatchSnapshot()
    expect(summarizeParity(deltas)).toMatchSnapshot()
  })
})
