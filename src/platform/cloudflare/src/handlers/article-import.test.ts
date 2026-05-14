import { afterEach, describe, expect, it, vi } from "vitest"

import type { AstraRequestContext } from "../context"
import type { AstraPlatformEnv } from "../env"
import { handleArticleImport } from "./article-import"

function createEnv(
  mode: "proxy" | "shadow" | "native",
  overrides: Partial<AstraPlatformEnv> = {},
) {
  const prepare = vi.fn(() => ({
    bind: vi.fn().mockReturnThis(),
    run: vi.fn(async () => ({ success: true })),
    all: vi.fn(async () => ({ success: true, results: [] })),
    first: vi.fn(async () => null),
  }))
  const put = vi.fn(async () => {})
  const head = vi.fn(async () => null)
  const get = vi.fn(async () => null)
  const kvPut = vi.fn(async () => {})
  const send = vi.fn(async () => {})

  const env: AstraPlatformEnv = {
    ASTRA_PLATFORM_DB: {
      prepare,
    },
    ASTRA_IMPORT_PAYLOADS: {
      put,
      head,
    },
    ASTRA_IDEMPOTENCY_KV: {
      get,
      put: kvPut,
    },
    ARTICLE_IMPORT_QUEUE: {
      send,
    },
    NODE_RELAY_ORIGIN: "https://relay.astra.example",
    ARTICLE_IMPORT_MODE: mode,
    ASTRA_ENV: "test",
    ...overrides,
  }

  return {
    env,
    prepare,
    put,
    head,
    get,
    kvPut,
    send,
  }
}

function createContext(
  mode: "proxy" | "shadow" | "native",
  overrides: Partial<AstraRequestContext["config"]> = {},
) {
  const pending: Promise<unknown>[] = []
  const waitUntil = vi.fn((promise: Promise<unknown>) => {
    pending.push(promise)
  })

  const ctx: AstraRequestContext = {
    requestId: "req_test",
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
      articleImportArtifactRetentionDays: 7,
      articleImportArtifactRetentionClass: "import-shadow",
      continuityExportArtifactRetentionDays: 7,
      continuityDeleteGracePeriodSeconds: 1_800,
      continuityJobHistoryRetentionDays: 90,
      continuityTombstoneRetentionDays: 30,
      syncTombstoneRetentionDays: 30,
      syncCompactionBatchSize: 500,
      syncCompactionDryRun: true,
      ...overrides,
      articleImportMaxShadowBytes: overrides.articleImportMaxShadowBytes ?? 262_144,
      articleImportMaxNativeBytes: overrides.articleImportMaxNativeBytes ?? 2_097_152,
    },
    execution: {
      waitUntil,
    },
  }

  return {
    ctx,
    waitUntil,
    async flushWaitUntil() {
      await Promise.allSettled(pending.splice(0))
    },
  }
}

function getStoredKeys(put: ReturnType<typeof vi.fn>): string[] {
  return (put.mock.calls as Array<[string, ...unknown[]]>).map((call) => call[0])
}

describe("handleArticleImport", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("serves article import natively from the Worker when extraction succeeds", async () => {
    const { env, prepare, put, send } = createEnv("native")
    const context = createContext("native")
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const requestUrl = input instanceof Request ? input.url : String(input)
      if (requestUrl === "https://example.com/readable") {
        return new Response(`
          <html>
            <head><title>Edge Imported Article</title></head>
            <body>
              <article>
                <h1>Edge Imported Article</h1>
                <div class="byline">Edge Writer</div>
                <p>First paragraph extracted by the Worker-native import path.</p>
                <p>Second paragraph confirms the Worker is the serving path.</p>
                <p>Third paragraph keeps the article scoring above the minimum threshold.</p>
              </article>
            </body>
          </html>
        `, {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" },
        })
      }

      throw new Error(`Unexpected fetch url: ${requestUrl}`)
    })

    const response = await handleArticleImport(
      new Request("https://platform.astra.example/v1/import/article", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-astra-import-surface": "web",
        },
        body: JSON.stringify({ url: "https://example.com/readable" }),
      }),
      env,
      context.ctx,
    )

    const payload = await response.json() as {
      title: string
      byline: string | null
      blocks: string[]
    }

    expect(response.status).toBe(200)
    expect(response.headers.get("x-astra-platform-route")).toBe("native")
    expect(response.headers.get("x-astra-platform-mode")).toBe("native")
    expect(response.headers.get("x-astra-platform-surface")).toBe("web")
    expect(payload.title).toBe("Edge Imported Article")
    expect(payload.byline).toBe("Edge Writer")
    expect(payload.blocks).toEqual(expect.arrayContaining([
      "First paragraph extracted by the Worker-native import path.",
      "Second paragraph confirms the Worker is the serving path.",
    ]))
    expect(fetchSpy).toHaveBeenCalledTimes(1)

    await context.flushWaitUntil()

    expect(context.waitUntil).toHaveBeenCalledTimes(2)
    expect(put).toHaveBeenCalledTimes(3)
    expect(getStoredKeys(put)).toEqual(expect.arrayContaining([
      expect.stringMatching(/\/request\.bin$/),
      expect.stringMatching(/\/response\.bin$/),
      expect.stringMatching(/\/source\.html$/),
    ]))
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      version: 1,
      requestObjectKey: expect.stringMatching(/\/request\.bin$/),
    }))
    expect(put).toHaveBeenCalledWith(
      expect.stringMatching(/\/request\.bin$/),
      expect.anything(),
      expect.objectContaining({
        customMetadata: expect.objectContaining({
          artifactType: "request",
          shadowVersion: "1",
          environment: "test",
          mode: "native",
          route: "native",
          surface: "web",
          targetHostname: "example.com",
          retentionClass: "import-shadow",
          retentionUntilEpochMs: expect.any(String),
          artifactSha256: expect.stringMatching(/^[0-9a-f]{64}$/),
        }),
      }),
    )
    const prepareCalls = prepare.mock.calls as unknown[][]
    expect(prepareCalls.some((call) => String(call[0]).includes("artifact_retention_class"))).toBe(true)
  })

  it("falls back to the Node relay when native import cannot fetch a usable article", async () => {
    const { env, put, send } = createEnv("native")
    const context = createContext("native")
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const requestUrl = input instanceof Request ? input.url : String(input)

      if (requestUrl === "https://example.com/blocked") {
        return new Response("blocked", {
          status: 403,
          headers: { "content-type": "text/html; charset=utf-8" },
        })
      }

      if (requestUrl === "https://relay.astra.example/v1/import/article") {
        return new Response(JSON.stringify({
          url: "https://example.com/blocked",
          title: "Relay Imported Article",
          hostname: "example.com",
          byline: "Relay Writer",
          scope: "article",
          summary: "Relay fallback summary",
          blocks: ["Relay fallback paragraph."],
        }), {
          status: 200,
          headers: { "content-type": "application/json; charset=utf-8" },
        })
      }

      throw new Error(`Unexpected fetch url: ${requestUrl}`)
    })

    const response = await handleArticleImport(
      new Request("https://platform.astra.example/v1/import/article", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-astra-import-surface": "web",
        },
        body: JSON.stringify({ url: "https://example.com/blocked" }),
      }),
      env,
      context.ctx,
    )

    const payload = await response.json() as { title: string; blocks: string[] }

    expect(response.status).toBe(200)
    expect(response.headers.get("x-astra-platform-route")).toBe("native-fallback-proxy")
    expect(response.headers.get("x-astra-platform-fallback-reason")).toBe("CONTENT_UNAVAILABLE")
    expect(payload.title).toBe("Relay Imported Article")
    expect(payload.blocks).toEqual(["Relay fallback paragraph."])
    expect(fetchSpy).toHaveBeenCalledTimes(2)

    await context.flushWaitUntil()

    expect(context.waitUntil).toHaveBeenCalledTimes(2)
    expect(put).toHaveBeenCalledTimes(2)
    expect(getStoredKeys(put)).toEqual(expect.arrayContaining([
      expect.stringMatching(/\/request\.bin$/),
      expect.stringMatching(/\/response\.bin$/),
    ]))
    expect(getStoredKeys(put)).not.toEqual(expect.arrayContaining([
      expect.stringMatching(/\/source\.html$/),
    ]))
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      version: 1,
      requestObjectKey: expect.stringMatching(/\/request\.bin$/),
    }))
  })

  it("rejects local targets before attempting a native or proxied fetch", async () => {
    const { env, put, send } = createEnv("native")
    const context = createContext("native")
    const fetchSpy = vi.spyOn(globalThis, "fetch")

    const response = await handleArticleImport(
      new Request("https://platform.astra.example/v1/import/article", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-astra-import-surface": "web",
        },
        body: JSON.stringify({ url: "http://127.0.0.1/private" }),
      }),
      env,
      context.ctx,
    )

    const payload = await response.json() as { error: { code: string; message: string } }

    expect(response.status).toBe(400)
    expect(response.headers.get("x-astra-platform-route")).toBe("preflight-error")
    expect(payload.error.code).toBe("INVALID_REQUEST")
    expect(payload.error.message).toContain("Local or private network URLs are not allowed")
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(put).not.toHaveBeenCalled()
    expect(send).not.toHaveBeenCalled()
  })

  it("captures shadow-mode request and response artifacts while returning the proxied Node response", async () => {
    const { env, put, send } = createEnv("shadow")
    const context = createContext("shadow")
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const requestUrl = input instanceof Request ? input.url : String(input)

      if (requestUrl === "https://relay.astra.example/v1/import/article") {
        return new Response(JSON.stringify({
          url: "https://example.com/shadowed",
          title: "Shadow Imported Article",
          hostname: "example.com",
          byline: "Relay Writer",
          scope: "article",
          summary: "Shadow summary",
          blocks: ["Shadow paragraph."],
        }), {
          status: 200,
          headers: { "content-type": "application/json; charset=utf-8" },
        })
      }

      throw new Error(`Unexpected fetch url: ${requestUrl}`)
    })

    const response = await handleArticleImport(
      new Request("https://platform.astra.example/v1/import/article", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-astra-import-surface": "web",
        },
        body: JSON.stringify({ url: "https://example.com/shadowed" }),
      }),
      env,
      context.ctx,
    )

    const payload = await response.json() as { title: string; blocks: string[] }

    expect(response.status).toBe(200)
    expect(response.headers.get("x-astra-platform-route")).toBe("shadow-proxy")
    expect(payload.title).toBe("Shadow Imported Article")
    expect(payload.blocks).toEqual(["Shadow paragraph."])
    expect(fetchSpy).toHaveBeenCalledTimes(1)

    await context.flushWaitUntil()

    expect(context.waitUntil).toHaveBeenCalledTimes(2)
    expect(put).toHaveBeenCalledTimes(2)
    expect(getStoredKeys(put)).toEqual(expect.arrayContaining([
      expect.stringMatching(/\/request\.bin$/),
      expect.stringMatching(/\/response\.bin$/),
    ]))
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      version: 1,
      requestObjectKey: expect.stringMatching(/\/request\.bin$/),
    }))
    expect(put).toHaveBeenCalledWith(
      expect.stringMatching(/\/response\.bin$/),
      expect.anything(),
      expect.objectContaining({
        customMetadata: expect.objectContaining({
          artifactType: "response",
          route: "shadow-proxy",
          retentionClass: "import-shadow",
        }),
      }),
    )
  })

  it("forces a proxy route for configured hostnames even when the default mode is native", async () => {
    const { env } = createEnv("native", {
      ARTICLE_IMPORT_FORCE_PROXY_HOSTS: "example.com",
    })
    const context = createContext("native", {
      articleImportForceProxyHosts: ["example.com"],
    })
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const requestUrl = input instanceof Request ? input.url : String(input)
      if (requestUrl === "https://relay.astra.example/v1/import/article") {
        return new Response(JSON.stringify({
          url: "https://example.com/forced-proxy",
          title: "Forced Proxy Article",
          hostname: "example.com",
          byline: null,
          scope: "article",
          summary: null,
          blocks: ["Forced proxy paragraph."],
        }), {
          status: 200,
          headers: { "content-type": "application/json; charset=utf-8" },
        })
      }

      throw new Error(`Unexpected fetch url: ${requestUrl}`)
    })

    const response = await handleArticleImport(
      new Request("https://platform.astra.example/v1/import/article", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-astra-import-surface": "web",
        },
        body: JSON.stringify({ url: "https://example.com/forced-proxy" }),
      }),
      env,
      context.ctx,
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("x-astra-platform-route")).toBe("proxy")
    expect(response.headers.get("x-astra-platform-mode")).toBe("proxy")
    expect(response.headers.get("x-astra-platform-default-mode")).toBe("native")
    expect(response.headers.get("x-astra-platform-decision-reason")).toBe("forced_proxy_host")
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ href: "https://relay.astra.example/v1/import/article" }),
      expect.anything(),
    )
  })

  it("falls back to proxy when a native rollout allowlist excludes the target hostname", async () => {
    const { env } = createEnv("native", {
      ARTICLE_IMPORT_ALLOWED_HOSTS: "docs.astra.example",
    })
    const context = createContext("native", {
      articleImportAllowedHosts: ["docs.astra.example"],
    })
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const requestUrl = input instanceof Request ? input.url : String(input)
      if (requestUrl === "https://relay.astra.example/v1/import/article") {
        return new Response(JSON.stringify({
          url: "https://example.com/proxy-fallback",
          title: "Allowlist Proxy Article",
          hostname: "example.com",
          byline: null,
          scope: "article",
          summary: null,
          blocks: ["Allowlist proxy paragraph."],
        }), {
          status: 200,
          headers: { "content-type": "application/json; charset=utf-8" },
        })
      }

      throw new Error(`Unexpected fetch url: ${requestUrl}`)
    })

    const response = await handleArticleImport(
      new Request("https://platform.astra.example/v1/import/article", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-astra-import-surface": "web",
        },
        body: JSON.stringify({ url: "https://example.com/proxy-fallback" }),
      }),
      env,
      context.ctx,
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("x-astra-platform-route")).toBe("proxy")
    expect(response.headers.get("x-astra-platform-mode")).toBe("proxy")
    expect(response.headers.get("x-astra-platform-decision-reason")).toBe("allowlist_proxy_fallback")
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it("rate limits repeated requests with the same client IP when configured", async () => {
    const kvState = new Map<string, string>()
    const { env } = createEnv("proxy", {
      ARTICLE_IMPORT_RATE_LIMIT_MAX: "1",
      ASTRA_IDEMPOTENCY_KV: {
        get: vi.fn(async (key: string) => kvState.get(key) ?? null),
        put: vi.fn(async (key: string, value: string) => {
          kvState.set(key, value)
        }),
      },
    })
    const context = createContext("proxy", {
      articleImportRateLimitMax: 1,
    })
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response(JSON.stringify({
      url: "https://example.com/limited",
      title: "Proxy Article",
      hostname: "example.com",
      byline: null,
      scope: "article",
      summary: null,
      blocks: ["Proxy paragraph."],
    }), {
      status: 200,
      headers: { "content-type": "application/json; charset=utf-8" },
    }))

    const requestInit = {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-astra-import-surface": "web",
        "cf-connecting-ip": "203.0.113.10",
      },
      body: JSON.stringify({ url: "https://example.com/limited" }),
    } satisfies RequestInit

    const firstResponse = await handleArticleImport(
      new Request("https://platform.astra.example/v1/import/article", requestInit),
      env,
      context.ctx,
    )
    const secondResponse = await handleArticleImport(
      new Request("https://platform.astra.example/v1/import/article", requestInit),
      env,
      context.ctx,
    )

    expect(firstResponse.status).toBe(200)
    expect(secondResponse.status).toBe(429)
    expect(secondResponse.headers.get("x-astra-platform-route")).toBe("rate-limited")
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })
})
