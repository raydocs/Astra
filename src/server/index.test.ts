import { createHash } from "node:crypto"
import { mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

function toFetchUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input
  if (input instanceof URL) return input.toString()
  return input.url
}

function timedTextJson(events: Array<{ startMs: number; durationMs: number; text: string }>) {
  return JSON.stringify({
    events: events.map((event) => ({
      tStartMs: event.startMs,
      dDurationMs: event.durationMs,
      segs: [{ utf8: event.text }],
    })),
  })
}

function buildYouTubeWatchHtml(options: {
  title?: string
  lengthSeconds?: number
  captionTracks?: Array<Record<string, unknown>>
  streamingFormats?: Array<Record<string, unknown>>
}) {
  return `<!doctype html><html><head><title>${options.title ?? "Demo video"} - YouTube</title></head><body><script>var ytInitialPlayerResponse = ${JSON.stringify({
    videoDetails: {
      title: options.title ?? "Demo video",
      lengthSeconds: String(options.lengthSeconds ?? 120),
    },
    captions: {
      playerCaptionsTracklistRenderer: {
        captionTracks: options.captionTracks ?? [],
      },
    },
    streamingData: {
      adaptiveFormats: options.streamingFormats ?? [],
    },
  })};</script></body></html>`
}

import { checkAnonymousRateLimit, createAstraRelayServer, resetAnonymousRateLimits } from "./index"
import type { RelayEnv } from "./types"

const { translateViaManagedProviderMock } = vi.hoisted(() => ({
  translateViaManagedProviderMock: vi.fn(),
}))

vi.mock("./providers", () => ({
  translateViaManagedProvider: translateViaManagedProviderMock,
}))

async function createUserDb(limits?: Partial<{ dailyRequests: number; dailyCharacters: number; requestsPerMinute: number }>) {
  const dir = await mkdtemp(join(tmpdir(), "astra-relay-"))
  const path = join(dir, "users.json")
  await writeFile(path, JSON.stringify({
    version: 1,
    users: [{
      id: "usr_demo",
      email: "demo@astra.local",
      billingEmail: "billing@astra.local",
      createdAt: "2026-03-01T00:00:00.000Z",
      passwordHash: createHash("sha256").update("astra-demo-pass").digest("hex"),
      plan: "pro",
      subscriptionStatus: "active",
      providerEntitlements: ["openai", "gemini"],
      limits: {
        dailyRequests: limits?.dailyRequests ?? 2000,
        dailyCharacters: limits?.dailyCharacters ?? 500_000,
        requestsPerMinute: limits?.requestsPerMinute ?? 120,
      },
      usage: {
        usageDay: "2026-03-25",
        requestsToday: 0,
        charactersToday: 0,
        totalRequests: 0,
        totalCharacters: 0,
        lastRequestAt: null,
        recentRequestTimestamps: [],
        recentEvents: [],
      },
      identityMode: "authenticated",
    }],
  }, null, 2))
  return path
}

async function readUserDb(path: string): Promise<{
  version: number
  users: Array<{ id: string; email: string; installId?: string }>
  devices: Array<{ deviceId: string; userId: string; email: string }>
  sessions: Array<{ sessionId: string; deviceId: string; userId: string; email: string }>
}> {
  return JSON.parse(await readFile(path, "utf8")) as {
    version: number
    users: Array<{ id: string; email: string; installId?: string }>
    devices: Array<{ deviceId: string; userId: string; email: string }>
    sessions: Array<{ sessionId: string; deviceId: string; userId: string; email: string }>
  }
}

describe("Astra relay server", () => {
  let server: ReturnType<typeof createAstraRelayServer>
  let baseURL = ""
  let env: RelayEnv

  async function closeServer() {
    if (!server) return
    const currentServer = server
    server = undefined as unknown as ReturnType<typeof createAstraRelayServer>
    await new Promise<void>((resolve, reject) => {
      currentServer.close((error) => {
        if (error) reject(error)
        else resolve()
      })
    })
  }

  async function startServer(userDbPath: string) {
    env = {
      port: 8787,
      host: "127.0.0.1",
      publicBaseURL: "http://127.0.0.1:8787/v1",
      sessionPublicBaseURL: "https://platform.astra.example/v1",
      sessionSecret: "test-secret",
      platformMirrorSecret: "mirror-secret",
      userDbPath,
      videoNoteStorePath: join(dirname(userDbPath), "video-notes.json"),
      loginEmail: "demo@astra.local",
      loginPassword: "astra-demo-pass",
      plan: "pro",
      subscriptionStatus: "active",
      providerEntitlements: ["openai", "gemini"],
      billingCheckoutBaseURL: "https://billing.example/checkout",
      billingPortalBaseURL: "https://billing.example/portal",
      openaiApiKey: "openai-key",
      googleApiKey: "google-key",
      openrouterApiKey: "",
      useOpenRouter: false,
      openrouterModelMap: {},
      freeDailyRequests: 200,
      freeDailyCharacters: 200_000,
      freeRpm: 20,
      proDailyRequests: 2000,
      proDailyCharacters: 500_000,
      proRpm: 120,
      sessionTtlMs: 30 * 24 * 60 * 60 * 1000,
      syncMaxMutationsPerRequest: 200,
      videoNoteMaxConcurrentJobs: 1,
    }

    server = createAstraRelayServer(env)

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve())
    })

    const address = server.address()
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind relay test server.")
    }
    baseURL = `http://127.0.0.1:${address.port}`
  }

  async function createSession(deviceId = "device-main") {
    const authResponse = await fetch(`${baseURL}/v1/auth/session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Astra-Device-Id": deviceId,
      },
      body: JSON.stringify({
        email: env.loginEmail,
        password: env.loginPassword,
        deviceId,
        device: {
          label: `Device ${deviceId}`,
          browserFamily: "chrome",
          platform: "macos",
          appKind: "extension",
          appVersion: "1.0.0",
        },
      }),
    })

    const session = await authResponse.json() as {
      sessionToken: string
      sessionId: string
      deviceId: string
      email: string
      identityMode: string
      relayBaseURL: string
      quota: { dailyRequestsLimit: number }
    }

    return { response: authResponse, session, deviceId }
  }

  function authHeaders(token: string, deviceId: string) {
    return {
      Authorization: `Bearer ${token}`,
      "X-Astra-Device-Id": deviceId,
    }
  }

  async function waitForVideoNoteJob(
    jobId: string,
    token: string,
    deviceId: string,
    predicate: (job: {
      status: string
      transcriptSource?: string | null
      error: { code: string; message: string } | null
    }) => boolean,
    timeoutMessage: string,
  ) {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const response = await fetch(`${baseURL}/v1/video-notes/jobs/${jobId}`, {
        headers: authHeaders(token, deviceId),
      })
      expect(response.status).toBe(200)
      const payload = await response.json() as {
        job: {
          status: string
          transcriptSource?: string | null
          error: { code: string; message: string } | null
        }
      }
      if (predicate(payload.job)) {
        return payload.job
      }
      await new Promise((resolve) => setTimeout(resolve, 20))
    }

    throw new Error(timeoutMessage)
  }

  async function waitForVideoNoteTerminalStatus(jobId: string, token: string, deviceId: string) {
    return waitForVideoNoteJob(
      jobId,
      token,
      deviceId,
      (job) => job.status === "completed" || job.status === "failed",
      `Video-note job ${jobId} did not reach a terminal status in time.`,
    )
  }

  beforeEach(() => {
    translateViaManagedProviderMock.mockReset()
  })

  afterEach(async () => {
    await closeServer()
  })

  it("creates a device-bound session from valid credentials and returns quota metadata", async () => {
    await startServer(await createUserDb())

    const { response, session } = await createSession("device-login")
    expect(response.status).toBe(200)
    expect(session.email).toBe(env.loginEmail)
    expect(session.sessionToken.length).toBeGreaterThan(10)
    expect(session.sessionId.length).toBeGreaterThan(10)
    expect(session.deviceId).toBe("device-login")
    expect(session.identityMode).toBe("authenticated")
    expect(session.relayBaseURL).toBe(env.sessionPublicBaseURL)
    expect(session.quota.dailyRequestsLimit).toBe(2000)
  })

  it("rejects unauthorized internal authenticated mirror-back requests", async () => {
    await startServer(await createUserDb())

    const response = await fetch(`${baseURL}/_internal/cloudflare/auth/issue/authenticated`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId: "usr_demo",
        email: "demo@astra.local",
        device: {
          deviceId: "device-mirror-auth",
          userId: "usr_demo",
          email: "demo@astra.local",
          identityMode: "authenticated",
          label: "Mirror device",
          platform: "macos",
          browserFamily: "chrome",
          appKind: "extension",
          appVersion: "1.0.0",
          firstSeenAt: "2026-04-12T00:00:00.000Z",
          lastSeenAt: "2026-04-12T00:00:00.000Z",
          lastSyncAt: null,
          status: "active",
          updatedAt: "2026-04-12T00:00:00.000Z",
          revokedAt: null,
        },
        session: {
          sessionId: "sess_mirror_auth_unauthorized",
          userId: "usr_demo",
          email: "demo@astra.local",
          deviceId: "device-mirror-auth",
          identityMode: "authenticated",
          issuedAt: "2026-04-12T00:00:00.000Z",
          expiresAt: null,
          createdAt: "2026-04-12T00:00:00.000Z",
          lastSeenAt: "2026-04-12T00:00:00.000Z",
          lastVerifiedAt: "2026-04-12T00:00:00.000Z",
          status: "active",
          revokedAt: null,
        },
      }),
    })

    const payload = await response.json() as { error: { code: string } }
    expect(response.status).toBe(401)
    expect(payload.error.code).toBe("SESSION_REQUIRED")
  })

  it("upserts authenticated mirror-back device/session records through the internal endpoint", async () => {
    const userDbPath = await createUserDb()
    await startServer(userDbPath)

    const payload = {
      userId: "usr_demo",
      email: "demo@astra.local",
      device: {
        deviceId: "device-mirror-auth",
        userId: "usr_demo",
        email: "demo@astra.local",
        identityMode: "authenticated" as const,
        label: "Mirror device",
        platform: "macos",
        browserFamily: "chrome",
        appKind: "extension",
        appVersion: "1.0.0",
        firstSeenAt: "2026-04-12T00:00:00.000Z",
        lastSeenAt: "2026-04-12T00:00:00.000Z",
        lastSyncAt: null,
        status: "active" as const,
        updatedAt: "2026-04-12T00:00:00.000Z",
        revokedAt: null,
      },
      session: {
        sessionId: "sess_mirror_auth",
        userId: "usr_demo",
        email: "demo@astra.local",
        deviceId: "device-mirror-auth",
        identityMode: "authenticated" as const,
        issuedAt: "2026-04-12T00:00:00.000Z",
        expiresAt: null,
        createdAt: "2026-04-12T00:00:00.000Z",
        lastSeenAt: "2026-04-12T00:00:00.000Z",
        lastVerifiedAt: "2026-04-12T00:00:00.000Z",
        status: "active" as const,
        revokedAt: null,
      },
    }

    const sendMirror = () => fetch(`${baseURL}/_internal/cloudflare/auth/issue/authenticated`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.platformMirrorSecret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    expect((await sendMirror()).status).toBe(204)
    expect((await sendMirror()).status).toBe(204)

    const db = await readUserDb(userDbPath)
    expect(db.devices.filter((device) => device.deviceId === payload.device.deviceId)).toHaveLength(1)
    expect(db.sessions.filter((session) => session.sessionId === payload.session.sessionId)).toHaveLength(1)
  })

  it("upserts anonymous mirror-back user/device/session records idempotently through the internal endpoint", async () => {
    const userDbPath = await createUserDb()
    await startServer(userDbPath)

    const payload = {
      user: {
        id: "usr_anonmirror",
        email: "anon_mirror@astra.anonymous",
        billingEmail: "anon_mirror@astra.anonymous",
        createdAt: "2026-04-12T00:00:00.000Z",
        passwordHash: createHash("sha256").update("anon-mirror-secret").digest("hex"),
        plan: "free" as const,
        subscriptionStatus: "active" as const,
        providerEntitlements: ["openai"],
        limits: {
          dailyRequests: 200,
          dailyCharacters: 200_000,
          requestsPerMinute: 20,
        },
        usage: {
          usageDay: "2026-04-12",
          requestsToday: 0,
          charactersToday: 0,
          totalRequests: 0,
          totalCharacters: 0,
          lastRequestAt: null,
          recentRequestTimestamps: [],
          recentEvents: [],
        },
        identityMode: "anonymous" as const,
        syncPreferences: {
          reading_history: false,
          study_progress: false,
        },
        installId: "install-mirror-anon",
      },
      device: {
        deviceId: "device-mirror-anon",
        userId: "usr_anonmirror",
        email: "anon_mirror@astra.anonymous",
        identityMode: "anonymous" as const,
        label: "Anonymous mirror device",
        platform: "macos",
        browserFamily: "chrome",
        appKind: "extension",
        appVersion: "1.0.0",
        firstSeenAt: "2026-04-12T00:00:00.000Z",
        lastSeenAt: "2026-04-12T00:00:00.000Z",
        lastSyncAt: null,
        status: "active" as const,
        updatedAt: "2026-04-12T00:00:00.000Z",
        revokedAt: null,
      },
      session: {
        sessionId: "sess_mirror_anon",
        userId: "usr_anonmirror",
        email: "anon_mirror@astra.anonymous",
        deviceId: "device-mirror-anon",
        identityMode: "anonymous" as const,
        issuedAt: "2026-04-12T00:00:00.000Z",
        expiresAt: null,
        createdAt: "2026-04-12T00:00:00.000Z",
        lastSeenAt: "2026-04-12T00:00:00.000Z",
        lastVerifiedAt: "2026-04-12T00:00:00.000Z",
        status: "active" as const,
        revokedAt: null,
      },
    }

    const sendMirror = () => fetch(`${baseURL}/_internal/cloudflare/auth/issue/anonymous`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.platformMirrorSecret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    expect((await sendMirror()).status).toBe(204)
    expect((await sendMirror()).status).toBe(204)

    const db = await readUserDb(userDbPath)
    expect(db.users.filter((user) => user.id === payload.user.id)).toHaveLength(1)
    expect(db.devices.filter((device) => device.deviceId === payload.device.deviceId)).toHaveLength(1)
    expect(db.sessions.filter((session) => session.sessionId === payload.session.sessionId)).toHaveLength(1)
  })

  it("translates text for an authenticated session and records usage", async () => {
    await startServer(await createUserDb())
    translateViaManagedProviderMock.mockResolvedValue(["你好"])

    const { session, deviceId } = await createSession()

    const translateResponse = await fetch(`${baseURL}/v1/translate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.sessionToken}`,
      },
      body: JSON.stringify({
        provider: "openai",
        model: "gpt-5.4-nano",
        texts: ["hello"],
        targetLang: "zh-CN",
        task: "translate",
      }),
    })

    expect(translateResponse.status).toBe(200)
    expect(await translateResponse.json()).toEqual({ translations: ["你好"] })

    const refreshResponse = await fetch(`${baseURL}/v1/auth/session`, {
      headers: authHeaders(session.sessionToken, deviceId),
    })
    const refreshed = await refreshResponse.json() as { usage: { totalRequests: number; totalCharacters: number }; quota: { remainingDailyRequests: number } }

    expect(refreshed.usage.totalRequests).toBe(1)
    expect(refreshed.usage.totalCharacters).toBe(5)
    expect(refreshed.quota.remainingDailyRequests).toBe(1999)
  })

  it("returns account, usage, and account-summary snapshots for an authenticated user", async () => {
    await startServer(await createUserDb())
    const { session, deviceId } = await createSession()

    const [accountResponse, usageResponse, summaryResponse] = await Promise.all([
      fetch(`${baseURL}/v1/account`, {
        headers: {
          Authorization: `Bearer ${session.sessionToken}`,
        },
      }),
      fetch(`${baseURL}/v1/account/usage`, {
        headers: {
          Authorization: `Bearer ${session.sessionToken}`,
        },
      }),
      fetch(`${baseURL}/v1/account/summary`, {
        headers: authHeaders(session.sessionToken, deviceId),
      }),
    ])

    const account = await accountResponse.json() as { id: string; billingEmail: string }
    const usage = await usageResponse.json() as { generatedAt: string; quota: { dailyRequestsLimit: number } }
    const summary = await summaryResponse.json() as {
      account: { id: string; billingEmail: string }
      usage: { quota: { dailyRequestsLimit: number } }
      session: { sessionId: string; deviceId: string; status: string }
      devices: { activeCount: number; current: { deviceId: string } | null; entries: Array<{ deviceId: string }> }
      sync: { maxMutationsPerRequest: number }
    }

    expect(accountResponse.status).toBe(200)
    expect(account.id).toBe("usr_demo")
    expect(account.billingEmail).toBe("billing@astra.local")
    expect(usageResponse.status).toBe(200)
    expect(usage.quota.dailyRequestsLimit).toBe(2000)
    expect(typeof usage.generatedAt).toBe("string")
    expect(summaryResponse.status).toBe(200)
    expect(summary.account.id).toBe("usr_demo")
    expect(summary.account.billingEmail).toBe("billing@astra.local")
    expect(summary.usage.quota.dailyRequestsLimit).toBe(2000)
    expect(summary.session.sessionId).toBe(session.sessionId)
    expect(summary.session.deviceId).toBe(deviceId)
    expect(summary.session.status).toBe("active")
    expect(summary.devices.activeCount).toBe(1)
    expect(summary.devices.current?.deviceId).toBe(deviceId)
    expect(summary.devices.entries).toHaveLength(1)
    expect(summary.sync.maxMutationsPerRequest).toBe(200)
  })

  it("updates the account plan and applies downgraded provider access", async () => {
    await startServer(await createUserDb())
    const { session } = await createSession()

    const patchResponse = await fetch(`${baseURL}/v1/account/plan`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.sessionToken}`,
      },
      body: JSON.stringify({ plan: "free" }),
    })
    const patched = await patchResponse.json() as { plan: string; providerEntitlements: string[] }

    expect(patchResponse.status).toBe(200)
    expect(patched.plan).toBe("free")
    expect(patched.providerEntitlements).toEqual(["openai"])

    const translateResponse = await fetch(`${baseURL}/v1/translate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.sessionToken}`,
      },
      body: JSON.stringify({
        provider: "gemini",
        model: "gemini-3.1-flash-lite-preview",
        texts: ["hello"],
        targetLang: "zh-CN",
      }),
    })

    const errorPayload = await translateResponse.json() as { error: { message: string } }
    expect(translateResponse.status).toBe(400)
    expect(errorPayload.error.message).toContain("does not allow provider: gemini")
    expect(translateViaManagedProviderMock).not.toHaveBeenCalled()
  })

  it("rejects translate requests when the per-minute limit is exhausted", async () => {
    await startServer(await createUserDb({ requestsPerMinute: 0 }))
    const { session } = await createSession()

    const response = await fetch(`${baseURL}/v1/translate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.sessionToken}`,
      },
      body: JSON.stringify({
        provider: "openai",
        model: "gpt-5.4-nano",
        texts: ["hello"],
        targetLang: "zh-CN",
      }),
    })

    const payload = await response.json() as { error: { message: string } }
    expect(response.status).toBe(400)
    expect(payload.error.message).toContain("Rate limit exceeded")
    expect(translateViaManagedProviderMock).not.toHaveBeenCalled()
  })

  it("creates, dedupes, and serves a structured video-note artifact when capture is provided", async () => {
    await startServer(await createUserDb())
    const { session, deviceId } = await createSession("device-video-note")

    const requestBody = {
      sourceUrl: "https://www.youtube.com/watch?v=demo123",
      platformHint: "youtube",
      sourceTitle: "Demo video",
      capture: {
        language: "en",
        deepLinkTemplate: "https://www.youtube.com/watch?v=demo123&t={startSeconds}s",
        durationSec: 120,
        transcriptSegments: [
          { startMs: 0, endMs: 2500, text: "Hello and welcome to the demo video." },
          { startMs: 3000, endMs: 6200, text: "We are testing the relay video note scaffold." },
          { startMs: 7000, endMs: 11200, text: "The backend already has create, status, and artifact routes wired up." },
          { startMs: 14000, endMs: 18200, text: "Now we want transcript-backed notes to feel structured and useful instead of skeletal." },
          { startMs: 21000, endMs: 25200, text: "The next step after this will be URL-only subtitle acquisition for supported platforms." },
        ],
      },
    }

    const create = await fetch(`${baseURL}/v1/video-notes/jobs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(session.sessionToken, deviceId),
      },
      body: JSON.stringify(requestBody),
    })
    expect(create.status).toBe(202)
    const createdPayload = await create.json() as {
      deduped: boolean
      job: { jobId: string; status: string }
    }
    expect(createdPayload.deduped).toBe(false)
    expect(createdPayload.job.status).toBe("queued")

    const duplicate = await fetch(`${baseURL}/v1/video-notes/jobs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(session.sessionToken, deviceId),
      },
      body: JSON.stringify(requestBody),
    })
    expect(duplicate.status).toBe(202)
    const duplicatePayload = await duplicate.json() as {
      deduped: boolean
      job: { jobId: string }
    }
    expect(duplicatePayload.deduped).toBe(true)
    expect(duplicatePayload.job.jobId).toBe(createdPayload.job.jobId)

    const job = await waitForVideoNoteTerminalStatus(createdPayload.job.jobId, session.sessionToken, deviceId)
    expect(job.status).toBe("completed")

    const artifactResponse = await fetch(`${baseURL}/v1/video-notes/jobs/${createdPayload.job.jobId}/artifact`, {
      headers: authHeaders(session.sessionToken, deviceId),
    })
    expect(artifactResponse.status).toBe(200)
    const artifactPayload = await artifactResponse.json() as {
      job: { status: string }
      artifact: { title: string | null; transcriptSegments: Array<{ text: string }>; markdown: string }
    }
    expect(artifactPayload.job.status).toBe("completed")
    expect(artifactPayload.artifact.title).toBe("Demo video")
    expect(artifactPayload.artifact.transcriptSegments).toHaveLength(5)
    expect(artifactPayload.artifact.markdown).toContain("## Summary")
    expect(artifactPayload.artifact.markdown).toContain("## Key takeaways")
    expect(artifactPayload.artifact.markdown).toContain("## Section notes")
    expect(artifactPayload.artifact.markdown).toContain("## Key moments")
    expect(artifactPayload.artifact.markdown).toContain("[00:00](https://www.youtube.com/watch?v=demo123&t=0s)")
    expect(artifactPayload.artifact.markdown).not.toContain("Skeleton video-note artifact")
    expect(artifactPayload.artifact.markdown).toContain("Demo video")
  })

  it("creates, dedupes, and completes a YouTube URL-only video-note job via server-side subtitles", async () => {
    await startServer(await createUserDb())
    const { session, deviceId } = await createSession("device-video-note-youtube-url")
    const nativeFetch = globalThis.fetch.bind(globalThis)
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = toFetchUrl(input)
      if (url === "https://www.youtube.com/watch?v=demo123") {
        expect(init?.signal).toBeInstanceOf(AbortSignal)
        return new Response(buildYouTubeWatchHtml({
          title: "Server-side YouTube note",
          lengthSeconds: 93,
          captionTracks: [
            {
              baseUrl: "https://www.youtube.com/api/timedtext?v=demo123&lang=en&fmt=srv3",
              languageCode: "en",
              kind: "standard",
              isTranslatable: true,
            },
          ],
        }), { status: 200, headers: { "Content-Type": "text/html" } })
      }
      if (url.startsWith("https://www.youtube.com/api/timedtext?v=demo123")) {
        expect(init?.signal).toBeInstanceOf(AbortSignal)
        return new Response(timedTextJson([
          { startMs: 0, durationMs: 2500, text: "Hello and welcome to the server-side note demo." },
          { startMs: 4000, durationMs: 3200, text: "The relay can fetch YouTube subtitles even without extension capture." },
          { startMs: 9000, durationMs: 3600, text: "Next we can build more URL-only subtitle acquisition on top of this path." },
        ]), { status: 200, headers: { "Content-Type": "application/json" } })
      }
      return nativeFetch(input, init)
    })

    try {
      const firstRequest = {
        sourceUrl: "https://youtu.be/demo123?si=share-token",
        platformHint: "bilibili",
      }

      const create = await fetch(`${baseURL}/v1/video-notes/jobs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(session.sessionToken, deviceId),
        },
        body: JSON.stringify(firstRequest),
      })
      expect(create.status).toBe(202)
      const createdPayload = await create.json() as {
        deduped: boolean
        job: { jobId: string; status: string; platform: string; sourceUrl: string }
      }
      expect(createdPayload.deduped).toBe(false)
      expect(createdPayload.job.status).toBe("queued")
      expect(createdPayload.job.platform).toBe("youtube")
      expect(createdPayload.job.sourceUrl).toBe("https://www.youtube.com/watch?v=demo123")

      const duplicate = await fetch(`${baseURL}/v1/video-notes/jobs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(session.sessionToken, deviceId),
        },
        body: JSON.stringify({
          sourceUrl: "https://www.youtube.com/watch?v=demo123&list=PL123&t=30s",
        }),
      })
      expect(duplicate.status).toBe(202)
      const duplicatePayload = await duplicate.json() as {
        deduped: boolean
        job: { jobId: string }
      }
      expect(duplicatePayload.deduped).toBe(true)
      expect(duplicatePayload.job.jobId).toBe(createdPayload.job.jobId)

      const job = await waitForVideoNoteTerminalStatus(createdPayload.job.jobId, session.sessionToken, deviceId)
      expect(job.status).toBe("completed")

      const artifactResponse = await fetch(`${baseURL}/v1/video-notes/jobs/${createdPayload.job.jobId}/artifact`, {
        headers: authHeaders(session.sessionToken, deviceId),
      })
      expect(artifactResponse.status).toBe(200)
      const artifactPayload = await artifactResponse.json() as {
        job: { status: string; platform: string; title: string | null; transcriptSource: string | null }
        artifact: {
          title: string | null
          transcriptSource: string | null
          transcriptLanguage: string | null
          transcriptSegments: Array<{ text: string }>
          markdown: string
          deepLinkTemplate: string | null
          durationSec: number | null
        }
      }
      expect(artifactPayload.job.status).toBe("completed")
      expect(artifactPayload.job.platform).toBe("youtube")
      expect(artifactPayload.job.title).toBe("Server-side YouTube note")
      expect(artifactPayload.job.transcriptSource).toBe("platform_subtitles")
      expect(artifactPayload.artifact.title).toBe("Server-side YouTube note")
      expect(artifactPayload.artifact.transcriptSource).toBe("platform_subtitles")
      expect(artifactPayload.artifact.transcriptLanguage).toBe("en")
      expect(artifactPayload.artifact.transcriptSegments).toHaveLength(3)
      expect(artifactPayload.artifact.deepLinkTemplate).toBe("https://www.youtube.com/watch?v=demo123&t={startSeconds}s")
      expect(artifactPayload.artifact.durationSec).toBe(93)
      expect(artifactPayload.artifact.markdown).toContain("## Summary")
      expect(artifactPayload.artifact.markdown).toContain("[00:00](https://www.youtube.com/watch?v=demo123&t=0s)")
      expect(artifactPayload.artifact.markdown).toContain("server-side note")
    } finally {
      fetchMock.mockRestore()
    }
  })

  it("completes a YouTube URL-only video-note job via backend transcription fallback when subtitles are unavailable", async () => {
    await startServer(await createUserDb())
    const { session, deviceId } = await createSession("device-video-note-youtube-transcription")
    const nativeFetch = globalThis.fetch.bind(globalThis)
    let resolveTranscriptionResponse: ((value: Response) => void) | null = null
    const transcriptionResponse = new Promise<Response>((resolve) => {
      resolveTranscriptionResponse = resolve
    })

    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = toFetchUrl(input)
      if (url === "https://www.youtube.com/watch?v=transcribe123") {
        expect(init?.signal).toBeInstanceOf(AbortSignal)
        return new Response(buildYouTubeWatchHtml({
          title: "Backend transcription note",
          lengthSeconds: 64,
          captionTracks: [],
          streamingFormats: [{
            url: "https://rr1---sn-demo.googlevideo.com/videoplayback?id=transcribe123",
            mimeType: 'audio/mp4; codecs="mp4a.40.2"',
            bitrate: 128000,
          }],
        }), { status: 200, headers: { "Content-Type": "text/html" } })
      }
      if (url === "https://rr1---sn-demo.googlevideo.com/videoplayback?id=transcribe123") {
        expect(init?.signal).toBeInstanceOf(AbortSignal)
        return new Response(new Uint8Array([0, 1, 2, 3]), {
          status: 200,
          headers: { "Content-Type": "audio/mp4" },
        })
      }
      if (url === "https://api.openai.com/v1/audio/transcriptions") {
        expect(init?.method).toBe("POST")
        expect(init?.signal).toBeInstanceOf(AbortSignal)
        expect(init?.body instanceof FormData).toBe(true)
        const formData = init?.body as FormData
        expect(formData.get("model")).toBe("whisper-1")
        expect(formData.get("response_format")).toBe("verbose_json")
        expect(formData.get("timestamp_granularities[]")).toBe("segment")
        return transcriptionResponse
      }
      return nativeFetch(input, init)
    })

    try {
      const create = await fetch(`${baseURL}/v1/video-notes/jobs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(session.sessionToken, deviceId),
        },
        body: JSON.stringify({
          sourceUrl: "https://www.youtube.com/watch?v=transcribe123",
        }),
      })
      expect(create.status).toBe(202)
      const createdPayload = await create.json() as {
        job: { jobId: string }
      }

      const transcribingJob = await waitForVideoNoteJob(
        createdPayload.job.jobId,
        session.sessionToken,
        deviceId,
        (job) => job.status === "transcribing",
        `Video-note job ${createdPayload.job.jobId} did not reach transcribing status in time.`,
      )
      expect(transcribingJob.status).toBe("transcribing")
      expect(transcribingJob.transcriptSource).toBe("transcription")

      expect(resolveTranscriptionResponse).not.toBeNull()
      resolveTranscriptionResponse!(new Response(JSON.stringify({
        language: "en",
        segments: [
          { start: 0, end: 2.6, text: "Backend transcription fallback can still produce useful notes." },
          { start: 3.2, end: 6.5, text: "The relay keeps the existing subtitle-first behavior for YouTube." },
          { start: 7.1, end: 10.4, text: "When subtitles are missing, the job can continue through transcribing and finish with an artifact." },
        ],
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }))

      const job = await waitForVideoNoteTerminalStatus(createdPayload.job.jobId, session.sessionToken, deviceId)
      expect(job.status).toBe("completed")
      expect(job.transcriptSource).toBe("transcription")

      const artifactResponse = await fetch(`${baseURL}/v1/video-notes/jobs/${createdPayload.job.jobId}/artifact`, {
        headers: authHeaders(session.sessionToken, deviceId),
      })
      expect(artifactResponse.status).toBe(200)
      const artifactPayload = await artifactResponse.json() as {
        job: { status: string; title: string | null; transcriptSource: string | null }
        artifact: {
          title: string | null
          transcriptSource: string | null
          transcriptLanguage: string | null
          transcriptSegments: Array<{ text: string }>
          deepLinkTemplate: string | null
          durationSec: number | null
          markdown: string
        }
      }
      expect(artifactPayload.job.status).toBe("completed")
      expect(artifactPayload.job.title).toBe("Backend transcription note")
      expect(artifactPayload.job.transcriptSource).toBe("transcription")
      expect(artifactPayload.artifact.title).toBe("Backend transcription note")
      expect(artifactPayload.artifact.transcriptSource).toBe("transcription")
      expect(artifactPayload.artifact.transcriptLanguage).toBe("en")
      expect(artifactPayload.artifact.transcriptSegments).toHaveLength(3)
      expect(artifactPayload.artifact.deepLinkTemplate).toBe("https://www.youtube.com/watch?v=transcribe123&t={startSeconds}s")
      expect(artifactPayload.artifact.durationSec).toBe(64)
      expect(artifactPayload.artifact.markdown).toContain("## Summary")
      expect(artifactPayload.artifact.markdown).toContain("[00:00](https://www.youtube.com/watch?v=transcribe123&t=0s)")
    } finally {
      fetchMock.mockRestore()
    }
  })

  it("fails clearly when backend transcription fallback returns no transcript segments", async () => {
    await startServer(await createUserDb())
    const { session, deviceId } = await createSession("device-video-note-youtube-transcription-empty")
    const nativeFetch = globalThis.fetch.bind(globalThis)
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = toFetchUrl(input)
      if (url === "https://www.youtube.com/watch?v=emptytranscript123") {
        expect(init?.signal).toBeInstanceOf(AbortSignal)
        return new Response(buildYouTubeWatchHtml({
          title: "Empty transcription demo",
          lengthSeconds: 52,
          captionTracks: [],
          streamingFormats: [{
            url: "https://rr2---sn-demo.googlevideo.com/videoplayback?id=emptytranscript123",
            mimeType: 'audio/mp4; codecs="mp4a.40.2"',
            bitrate: 96000,
          }],
        }), { status: 200, headers: { "Content-Type": "text/html" } })
      }
      if (url === "https://rr2---sn-demo.googlevideo.com/videoplayback?id=emptytranscript123") {
        return new Response(new Uint8Array([9, 8, 7, 6]), {
          status: 200,
          headers: { "Content-Type": "audio/mp4" },
        })
      }
      if (url === "https://api.openai.com/v1/audio/transcriptions") {
        return new Response(JSON.stringify({ language: "en", segments: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      }
      return nativeFetch(input, init)
    })

    try {
      const create = await fetch(`${baseURL}/v1/video-notes/jobs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(session.sessionToken, deviceId),
        },
        body: JSON.stringify({
          sourceUrl: "https://www.youtube.com/watch?v=emptytranscript123",
        }),
      })
      expect(create.status).toBe(202)
      const createdPayload = await create.json() as {
        job: { jobId: string }
      }

      const job = await waitForVideoNoteTerminalStatus(createdPayload.job.jobId, session.sessionToken, deviceId)
      expect(job.status).toBe("failed")
      expect(job.transcriptSource).toBe("transcription")
      expect(job.error?.code).toBe("SUBTITLE_UNAVAILABLE")
      expect(job.error?.message).toContain("backend transcription fallback could not produce transcript segments")
      expect(job.error?.message).toContain("did not return any usable transcript segments")
    } finally {
      fetchMock.mockRestore()
    }
  })

  it("fails clearly when backend transcription fallback resolves a blocked audio host", async () => {
    await startServer(await createUserDb())
    const { session, deviceId } = await createSession("device-video-note-youtube-blocked-host")
    const nativeFetch = globalThis.fetch.bind(globalThis)
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = toFetchUrl(input)
      if (url === "https://www.youtube.com/watch?v=blockedhost123") {
        return new Response(buildYouTubeWatchHtml({
          title: "Blocked host demo",
          lengthSeconds: 38,
          captionTracks: [],
          streamingFormats: [{
            url: "https://rr-blocked---sn-demo.googlevideo.com/videoplayback?id=blockedhost123",
            mimeType: 'audio/mp4; codecs="mp4a.40.2"',
            bitrate: 128000,
          }],
        }), { status: 200, headers: { "Content-Type": "text/html" } })
      }
      if (url === "https://rr-blocked---sn-demo.googlevideo.com/videoplayback?id=blockedhost123") {
        return new Response(null, {
          status: 302,
          headers: {
            Location: "https://media.example/audio/blockedhost123.m4a",
          },
        })
      }
      return nativeFetch(input, init)
    })

    try {
      const create = await fetch(`${baseURL}/v1/video-notes/jobs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(session.sessionToken, deviceId),
        },
        body: JSON.stringify({
          sourceUrl: "https://www.youtube.com/watch?v=blockedhost123",
        }),
      })
      expect(create.status).toBe(202)
      const createdPayload = await create.json() as {
        job: { jobId: string }
      }

      const job = await waitForVideoNoteTerminalStatus(createdPayload.job.jobId, session.sessionToken, deviceId)
      expect(job.status).toBe("failed")
      expect(job.transcriptSource).toBe("transcription")
      expect(job.error?.code).toBe("SUBTITLE_UNAVAILABLE")
      expect(job.error?.message).toContain("backend safety checks")
      expect(job.error?.message).not.toContain("media.example")
    } finally {
      fetchMock.mockRestore()
    }
  })

  it("fails clearly when backend transcription fallback audio exceeds backend size limits", async () => {
    await startServer(await createUserDb())
    const { session, deviceId } = await createSession("device-video-note-youtube-audio-too-large")
    const nativeFetch = globalThis.fetch.bind(globalThis)
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = toFetchUrl(input)
      if (url === "https://www.youtube.com/watch?v=toolargeaudio123") {
        return new Response(buildYouTubeWatchHtml({
          title: "Large audio demo",
          lengthSeconds: 73,
          captionTracks: [],
          streamingFormats: [{
            url: "https://rr3---sn-demo.googlevideo.com/videoplayback?id=toolargeaudio123",
            mimeType: 'audio/mp4; codecs="mp4a.40.2"',
            bitrate: 128000,
          }],
        }), { status: 200, headers: { "Content-Type": "text/html" } })
      }
      if (url === "https://rr3---sn-demo.googlevideo.com/videoplayback?id=toolargeaudio123") {
        return new Response(new Uint8Array([1, 2, 3, 4]), {
          status: 200,
          headers: {
            "Content-Type": "audio/mp4",
            "Content-Length": String(500_000_000),
          },
        })
      }
      return nativeFetch(input, init)
    })

    try {
      const create = await fetch(`${baseURL}/v1/video-notes/jobs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(session.sessionToken, deviceId),
        },
        body: JSON.stringify({
          sourceUrl: "https://www.youtube.com/watch?v=toolargeaudio123",
        }),
      })
      expect(create.status).toBe(202)
      const createdPayload = await create.json() as {
        job: { jobId: string }
      }

      const job = await waitForVideoNoteTerminalStatus(createdPayload.job.jobId, session.sessionToken, deviceId)
      expect(job.status).toBe("failed")
      expect(job.transcriptSource).toBe("transcription")
      expect(job.error?.code).toBe("SUBTITLE_UNAVAILABLE")
      expect(job.error?.message).toContain("size limits")
    } finally {
      fetchMock.mockRestore()
    }
  })

  it("sanitizes noisy upstream OpenAI transcription errors for backend transcription fallback", async () => {
    await startServer(await createUserDb())
    const { session, deviceId } = await createSession("device-video-note-youtube-upstream-error")
    const nativeFetch = globalThis.fetch.bind(globalThis)
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = toFetchUrl(input)
      if (url === "https://www.youtube.com/watch?v=upstreamerror123") {
        return new Response(buildYouTubeWatchHtml({
          title: "Upstream error demo",
          lengthSeconds: 58,
          captionTracks: [],
          streamingFormats: [{
            url: "https://rr4---sn-demo.googlevideo.com/videoplayback?id=upstreamerror123",
            mimeType: 'audio/mp4; codecs="mp4a.40.2"',
            bitrate: 128000,
          }],
        }), { status: 200, headers: { "Content-Type": "text/html" } })
      }
      if (url === "https://rr4---sn-demo.googlevideo.com/videoplayback?id=upstreamerror123") {
        return new Response(new Uint8Array([4, 3, 2, 1]), {
          status: 200,
          headers: { "Content-Type": "audio/mp4" },
        })
      }
      if (url === "https://api.openai.com/v1/audio/transcriptions") {
        return new Response(JSON.stringify({
          error: {
            message: "Rate limit exceeded for org secret-org-123. Contact support@example.com.",
          },
        }), {
          status: 429,
          headers: { "Content-Type": "application/json" },
        })
      }
      return nativeFetch(input, init)
    })

    try {
      const create = await fetch(`${baseURL}/v1/video-notes/jobs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(session.sessionToken, deviceId),
        },
        body: JSON.stringify({
          sourceUrl: "https://www.youtube.com/watch?v=upstreamerror123",
        }),
      })
      expect(create.status).toBe(202)
      const createdPayload = await create.json() as {
        job: { jobId: string }
      }

      const job = await waitForVideoNoteTerminalStatus(createdPayload.job.jobId, session.sessionToken, deviceId)
      expect(job.status).toBe("failed")
      expect(job.transcriptSource).toBe("transcription")
      expect(job.error?.code).toBe("SUBTITLE_UNAVAILABLE")
      expect(job.error?.message).toContain("temporarily rate limited")
      expect(job.error?.message).not.toContain("secret-org-123")
      expect(job.error?.message).not.toContain("support@example.com")
    } finally {
      fetchMock.mockRestore()
    }
  })

  it("fails a YouTube URL-only video-note job clearly when subtitles are unavailable", async () => {
    await startServer(await createUserDb())
    const { session, deviceId } = await createSession("device-video-note-youtube-nosubs")
    const nativeFetch = globalThis.fetch.bind(globalThis)
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = toFetchUrl(input)
      if (url === "https://www.youtube.com/watch?v=nosubs123") {
        return new Response(buildYouTubeWatchHtml({
          title: "No subtitles demo",
          lengthSeconds: 41,
          captionTracks: [],
        }), { status: 200, headers: { "Content-Type": "text/html" } })
      }
      return nativeFetch(input, init)
    })

    try {
      const create = await fetch(`${baseURL}/v1/video-notes/jobs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(session.sessionToken, deviceId),
        },
        body: JSON.stringify({
          sourceUrl: "https://www.youtube.com/watch?v=nosubs123",
        }),
      })
      expect(create.status).toBe(202)
      const createdPayload = await create.json() as {
        job: { jobId: string }
      }

      const job = await waitForVideoNoteTerminalStatus(createdPayload.job.jobId, session.sessionToken, deviceId)
      expect(job.status).toBe("failed")
      expect(job.transcriptSource).toBe("transcription")
      expect(job.error?.code).toBe("SUBTITLE_UNAVAILABLE")
      expect(job.error?.message).toContain("No usable YouTube subtitles were available")
      expect(job.error?.message).toContain("usable YouTube audio stream")
    } finally {
      fetchMock.mockRestore()
    }
  })

  it("rejects video-note job creation for anonymous sessions", async () => {
    await startServer(await createUserDb())

    const anonymousAuth = await fetch(`${baseURL}/v1/auth/anonymous`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId: "anon-video-note" }),
    })
    expect(anonymousAuth.status).toBe(200)
    const anonymousSession = await anonymousAuth.json() as {
      sessionToken: string
      deviceId: string
    }

    const create = await fetch(`${baseURL}/v1/video-notes/jobs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(anonymousSession.sessionToken, anonymousSession.deviceId),
      },
      body: JSON.stringify({
        sourceUrl: "https://www.youtube.com/watch?v=anon123",
      }),
    })
    expect(create.status).toBe(403)
    const payload = await create.json() as { error: { code: string } }
    expect(payload.error.code).toBe("AUTH_REQUIRED")
  })

  it("marks stale non-terminal video-note jobs as failed on relay startup", async () => {
    const userDbPath = await createUserDb()
    const videoNoteStorePath = join(dirname(userDbPath), "video-notes.json")
    await writeFile(videoNoteStorePath, JSON.stringify({
      version: 1,
      jobs: [{
        id: "job-stale-1",
        ownerEmail: "demo@astra.local",
        sourceUrl: "https://www.youtube.com/watch?v=stale123",
        sourceKey: "https://www.youtube.com/watch?v=stale123",
        platform: "youtube",
        title: "Stale job",
        status: "generating_markdown",
        transcriptSource: null,
        errorCode: null,
        errorMessage: null,
        createdAt: "2026-04-12T00:00:00.000Z",
        updatedAt: "2026-04-12T00:00:00.000Z",
        startedAt: "2026-04-12T00:01:00.000Z",
        completedAt: null,
        artifactId: null,
        request: {
          sourceUrl: "https://www.youtube.com/watch?v=stale123",
          platformHint: "youtube",
          sourceTitle: "Stale job",
          forceRegenerate: false,
          capture: null,
        },
      }],
      artifacts: [],
    }, null, 2))

    await startServer(userDbPath)
    const { session, deviceId } = await createSession("device-stale-video-note")

    const response = await fetch(`${baseURL}/v1/video-notes/jobs/job-stale-1`, {
      headers: authHeaders(session.sessionToken, deviceId),
    })
    expect(response.status).toBe(200)
    const payload = await response.json() as {
      job: {
        status: string
        error: { code: string; message: string } | null
      }
    }
    expect(payload.job.status).toBe("failed")
    expect(payload.job.error?.code).toBe("RELAY_RESTARTED")
  })

  it("returns a valid anonymous device-bound session", async () => {
    await startServer(await createUserDb())

    const response = await fetch(`${baseURL}/v1/auth/anonymous`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceId: "anon-device-1",
        browserFamily: "chrome",
        platform: "macos",
      }),
    })

    expect(response.status).toBe(200)
    const payload = await response.json() as {
      sessionToken: string
      sessionId: string
      deviceId: string
      email: string
      plan: string
      identityMode: string
      providerEntitlements: string[]
    }
    expect(payload.sessionToken.length).toBeGreaterThan(10)
    expect(payload.sessionId.length).toBeGreaterThan(10)
    expect(payload.deviceId).toBe("anon-device-1")
    expect(typeof payload.email).toBe("string")
    expect(payload.plan).toBe("free")
    expect(payload.identityMode).toBe("anonymous")
    expect(Array.isArray(payload.providerEntitlements)).toBe(true)
  })

  it("creates anonymous session and reuses it with the same device id", async () => {
    await startServer(await createUserDb())

    const first = await fetch(`${baseURL}/v1/auth/anonymous`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId: "anon-reuse-1" }),
    })
    const firstPayload = await first.json() as { email: string }
    expect(first.status).toBe(200)

    const second = await fetch(`${baseURL}/v1/auth/anonymous`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId: "anon-reuse-1" }),
    })
    const secondPayload = await second.json() as { email: string }
    expect(second.status).toBe(200)

    expect(firstPayload.email).toBe(secondPayload.email)
  })

  it("returns 429 after too many anonymous registrations from the same IP", async () => {
    await startServer(await createUserDb())
    resetAnonymousRateLimits()

    for (let i = 0; i < 3; i++) {
      const response = await fetch(`${baseURL}/v1/auth/anonymous`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId: `rate-limit-test-${i}` }),
      })
      expect(response.status).toBe(200)
    }

    const blocked = await fetch(`${baseURL}/v1/auth/anonymous`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId: "rate-limit-test-blocked" }),
    })
    expect(blocked.status).toBe(429)
    const payload = await blocked.json() as { error: { message: string } }
    expect(payload.error.message).toBe("Too many anonymous registrations")
  })

  it("allows reusing an existing device id even when anonymous rate limit is exceeded", async () => {
    await startServer(await createUserDb())
    resetAnonymousRateLimits()

    for (let i = 0; i < 3; i++) {
      await fetch(`${baseURL}/v1/auth/anonymous`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId: `reuse-test-${i}` }),
      })
    }

    const reuse = await fetch(`${baseURL}/v1/auth/anonymous`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId: "reuse-test-0" }),
    })
    expect(reuse.status).toBe(200)
  })

  it("persists session revocation across server restart", async () => {
    const userDbPath = await createUserDb()
    await startServer(userDbPath)
    const { session, deviceId } = await createSession("device-revoke")

    const revoke = await fetch(`${baseURL}/v1/auth/session`, {
      method: "DELETE",
      headers: authHeaders(session.sessionToken, deviceId),
    })
    expect(revoke.status).toBe(204)

    await closeServer()
    await startServer(userDbPath)

    const refresh = await fetch(`${baseURL}/v1/auth/session`, {
      headers: authHeaders(session.sessionToken, deviceId),
    })
    const payload = await refresh.json() as { error: { code: string } }
    expect(refresh.status).toBe(401)
    expect(payload.error.code).toBe("SESSION_REVOKED")
  })

  it("lists current devices for the authenticated account", async () => {
    await startServer(await createUserDb())
    const { session, deviceId } = await createSession("device-list-1")
    await createSession("device-list-2")

    const response = await fetch(`${baseURL}/v1/devices`, {
      headers: authHeaders(session.sessionToken, deviceId),
    })
    const payload = await response.json() as { devices: Array<{ deviceId: string; label: string; isCurrentDevice: boolean }> }

    expect(response.status).toBe(200)
    expect(payload.devices).toHaveLength(2)
    expect(payload.devices.some((device) => device.deviceId === "device-list-1" && device.label === "Device device-list-1" && device.isCurrentDevice)).toBe(true)
    expect(payload.devices.some((device) => device.deviceId === "device-list-2" && device.label === "Device device-list-2")).toBe(true)
  })

  it("revokes another device and blocks its future refreshes", async () => {
    await startServer(await createUserDb())
    const { session, deviceId } = await createSession("device-current")
    const revokedTarget = await createSession("device-remote")

    const revoke = await fetch(`${baseURL}/v1/devices/device-remote/revoke`, {
      method: "POST",
      headers: authHeaders(session.sessionToken, deviceId),
    })
    const revokePayload = await revoke.json() as { devices: Array<{ deviceId: string; status: string }> }

    expect(revoke.status).toBe(200)
    expect(revokePayload.devices.find((device) => device.deviceId === "device-remote")?.status).toBe("revoked")

    const refresh = await fetch(`${baseURL}/v1/auth/session`, {
      headers: authHeaders(revokedTarget.session.sessionToken, revokedTarget.deviceId),
    })
    const refreshPayload = await refresh.json() as { error: { code: string } }
    expect(refresh.status).toBe(401)
    expect(refreshPayload.error.code).toBe("DEVICE_REVOKED")
  })

  it("rejects remote revoke requests for the current device", async () => {
    await startServer(await createUserDb())
    const { session, deviceId } = await createSession("device-current-only")

    const revoke = await fetch(`${baseURL}/v1/devices/device-current-only/revoke`, {
      method: "POST",
      headers: authHeaders(session.sessionToken, deviceId),
    })
    const payload = await revoke.json() as { error: { code: string } }

    expect(revoke.status).toBe(409)
    expect(payload.error.code).toBe("CURRENT_DEVICE_REVOKE_FORBIDDEN")
  })

  it("supports initial sync bootstrap, push, and pull APIs", async () => {
    await startServer(await createUserDb())
    const { session, deviceId } = await createSession("device-sync")

    const bootstrap = await fetch(`${baseURL}/v1/sync/bootstrap`, {
      headers: authHeaders(session.sessionToken, deviceId),
    })
    const bootstrapPayload = await bootstrap.json() as {
      deviceId: string
      collections: { config: { enabled: boolean; cursor: string | null } }
    }
    expect(bootstrap.status).toBe(200)
    expect(bootstrapPayload.deviceId).toBe(deviceId)
    expect(bootstrapPayload.collections.config.enabled).toBe(true)

    const push = await fetch(`${baseURL}/v1/sync/push`, {
      method: "POST",
      headers: {
        ...authHeaders(session.sessionToken, deviceId),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mutations: [{
          collection: "config",
          schemaVersion: 1,
          recordId: "global",
          operation: "upsert",
          clientMutationId: "mut-1",
          deviceId,
          clientUpdatedAt: "2026-04-09T12:00:00.000Z",
          payload: {
            kind: "global",
            config: {
              version: 1,
              targetLang: "zh-CN",
              connectionMode: "astra",
              hoverTrigger: "alt",
              contentScope: "page",
              inputTranslation: "enabled",
              inputTranslationMode: "replace",
              languageLevel: "intermediate",
              privacyMode: false,
              provider: {
                id: "openai",
                model: "gpt-5.4-nano",
              },
              tts: {
                enabled: true,
                engine: "browser",
                rate: 0.9,
                pitch: 1,
                highlightSentences: true,
              },
              presentation: {
                mode: "bilingual",
                theme: "default",
                fontSize: 0.92,
                translationColor: "#64748b",
              },
            },
          },
        }],
      }),
    })
    const pushPayload = await push.json() as { accepted: Array<{ clientMutationId: string; deduped: boolean }> }
    expect(push.status).toBe(200)
    expect(pushPayload.accepted[0]?.clientMutationId).toBe("mut-1")
    expect(pushPayload.accepted[0]?.deduped).toBe(false)

    const pull = await fetch(`${baseURL}/v1/sync/pull`, {
      method: "POST",
      headers: {
        ...authHeaders(session.sessionToken, deviceId),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ cursors: { config: null } }),
    })
    const pullPayload = await pull.json() as { deltas: { config: Array<{ clientMutationId: string }> } }
    expect(pull.status).toBe(200)
    expect(pullPayload.deltas.config[0]?.clientMutationId).toBe("mut-1")

    const devices = await fetch(`${baseURL}/v1/devices`, {
      headers: authHeaders(session.sessionToken, deviceId),
    })
    const devicesPayload = await devices.json() as { devices: Array<{ deviceId: string; lastSyncAt: string | null }> }
    expect(devicesPayload.devices.find((device) => device.deviceId === deviceId)?.lastSyncAt).toBeTruthy()
  })

  it("updates the reading history sync preference and accepts history mutations", async () => {
    await startServer(await createUserDb())
    const { session, deviceId } = await createSession("device-history")

    const toggle = await fetch(`${baseURL}/v1/sync/collections/reading_history`, {
      method: "PATCH",
      headers: {
        ...authHeaders(session.sessionToken, deviceId),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ enabled: true }),
    })
    const togglePayload = await toggle.json() as {
      collections: { reading_history: { enabled: boolean; defaultEnabled: boolean } }
    }

    expect(toggle.status).toBe(200)
    expect(togglePayload.collections.reading_history.enabled).toBe(true)
    expect(togglePayload.collections.reading_history.defaultEnabled).toBe(false)

    const push = await fetch(`${baseURL}/v1/sync/push`, {
      method: "POST",
      headers: {
        ...authHeaders(session.sessionToken, deviceId),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mutations: [{
          collection: "reading_history",
          schemaVersion: 1,
          recordId: "https://example.com/article",
          operation: "upsert",
          clientMutationId: "mut-history-1",
          deviceId,
          clientUpdatedAt: "2026-04-09T12:00:00.000Z",
          payload: {
            id: "https://example.com/article",
            url: "https://example.com/article?utm=1",
            hostname: "example.com",
            title: "History entry",
            wordsTranslated: 12,
            visitedAt: 1234,
          },
        }],
      }),
    })
    const pushPayload = await push.json() as { accepted: Array<{ clientMutationId: string }> }

    expect(push.status).toBe(200)
    expect(pushPayload.accepted[0]?.clientMutationId).toBe("mut-history-1")

    const pull = await fetch(`${baseURL}/v1/sync/pull`, {
      method: "POST",
      headers: {
        ...authHeaders(session.sessionToken, deviceId),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ cursors: { reading_history: null } }),
    })
    const pullPayload = await pull.json() as { deltas: { reading_history: Array<{ recordId: string; payload: { url: string } }> } }

    expect(pull.status).toBe(200)
    expect(pullPayload.deltas.reading_history[0]?.recordId).toBe("https://example.com/article")
    expect(pullPayload.deltas.reading_history[0]?.payload.url).toBe("https://example.com/article")
  })

  it("updates the study progress sync preference and accepts durable page progress mutations", async () => {
    await startServer(await createUserDb())
    const { session, deviceId } = await createSession("device-progress")

    const toggle = await fetch(`${baseURL}/v1/sync/collections/study_progress`, {
      method: "PATCH",
      headers: {
        ...authHeaders(session.sessionToken, deviceId),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ enabled: true }),
    })
    const togglePayload = await toggle.json() as {
      collections: { study_progress: { enabled: boolean; defaultEnabled: boolean } }
    }

    expect(toggle.status).toBe(200)
    expect(togglePayload.collections.study_progress.enabled).toBe(true)
    expect(togglePayload.collections.study_progress.defaultEnabled).toBe(false)

    const push = await fetch(`${baseURL}/v1/sync/push`, {
      method: "POST",
      headers: {
        ...authHeaders(session.sessionToken, deviceId),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mutations: [{
          collection: "study_progress",
          schemaVersion: 1,
          recordId: "https://example.com/article",
          operation: "upsert",
          clientMutationId: "mut-progress-1",
          deviceId,
          clientUpdatedAt: "2026-04-09T12:00:00.000Z",
          payload: {
            url: "https://example.com/article?utm=1",
            hostname: "example.com",
            title: "Study page",
            completedSteps: ["guided_read", "read", "read"],
            sentencesExplained: 2,
            vocabSaved: 1,
            startedAt: 1234,
            lastActivityAt: 2234,
          },
        }],
      }),
    })
    const pushPayload = await push.json() as { accepted: Array<{ clientMutationId: string }> }

    expect(push.status).toBe(200)
    expect(pushPayload.accepted[0]?.clientMutationId).toBe("mut-progress-1")

    const pull = await fetch(`${baseURL}/v1/sync/pull`, {
      method: "POST",
      headers: {
        ...authHeaders(session.sessionToken, deviceId),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ cursors: { study_progress: null } }),
    })
    const pullPayload = await pull.json() as { deltas: { study_progress: Array<{ recordId: string; payload: { url: string; completedSteps: string[] } }> } }

    expect(pull.status).toBe(200)
    expect(pullPayload.deltas.study_progress[0]?.recordId).toBe("https://example.com/article")
    expect(pullPayload.deltas.study_progress[0]?.payload.url).toBe("https://example.com/article")
    expect(pullPayload.deltas.study_progress[0]?.payload.completedSteps).toEqual(["read", "guided_read"])
  })

  it("imports readable article content through the relay fetch path", async () => {
    await startServer(await createUserDb())

    const originalFetch = globalThis.fetch
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const requestUrl = typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url

      if (requestUrl.startsWith(baseURL)) {
        return originalFetch(input, init)
      }

      if (requestUrl === "https://example.com/readable") {
        return Promise.resolve(new Response(`
          <html>
            <head>
              <title>Fallback Title</title>
              <meta name="author" content="Relay Writer" />
            </head>
            <body>
              <article>
                <h1>Relay Imported Article</h1>
                <p>First paragraph extracted from the relay fetch path.</p>
                <p>Second paragraph confirms readable content extraction.</p>
                <p>Third paragraph keeps article-mode heuristics active.</p>
              </article>
            </body>
          </html>
        `, {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" },
        }))
      }

      return Promise.reject(new Error(`Unexpected fetch url: ${requestUrl}`))
    })

    const response = await fetch(`${baseURL}/v1/import/article`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: "https://example.com/readable" }),
    })
    const payload = await response.json() as {
      title: string
      hostname: string
      byline: string | null
      scope: string
      blocks: string[]
    }

    expect(response.status).toBe(200)
    expect(payload.title).toBe("Relay Imported Article")
    expect(payload.hostname).toBe("example.com")
    expect(payload.byline).toBe("Relay Writer")
    expect(payload.scope).toBe("article")
    expect(payload.blocks).toEqual(expect.arrayContaining([
      "First paragraph extracted from the relay fetch path.",
      "Second paragraph confirms readable content extraction.",
    ]))
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ href: "https://example.com/readable" }),
      expect.objectContaining({
        headers: { Accept: "text/html,application/xhtml+xml" },
        redirect: "manual",
      }),
    )
  })

  it("rejects local article import targets on the relay endpoint", async () => {
    await startServer(await createUserDb())

    const response = await fetch(`${baseURL}/v1/import/article`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: "http://127.0.0.1/private" }),
    })
    const payload = await response.json() as { error: { code: string; message: string } }

    expect(response.status).toBe(400)
    expect(payload.error.code).toBe("INVALID_REQUEST")
    expect(payload.error.message).toContain("Local or private network URLs are not allowed")
  })

  it("creates checkout and portal billing links for the authenticated user", async () => {
    await startServer(await createUserDb())
    const { session } = await createSession()

    const [checkout, portal] = await Promise.all([
      fetch(`${baseURL}/v1/billing/checkout`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.sessionToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ plan: "pro" }),
      }),
      fetch(`${baseURL}/v1/billing/portal`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.sessionToken}`,
        },
      }),
    ])

    const checkoutPayload = await checkout.json() as { kind: string; url: string }
    const portalPayload = await portal.json() as { kind: string; url: string }
    expect(checkout.status).toBe(200)
    expect(checkoutPayload.kind).toBe("checkout")
    expect(checkoutPayload.url).toContain("billing.example")
    expect(portal.status).toBe(200)
    expect(portalPayload.kind).toBe("portal")
  })

  it("tracks anonymous rate-limit windows by IP", () => {
    resetAnonymousRateLimits()
    const now = Date.now()
    expect(checkAnonymousRateLimit("127.0.0.1", now)).toBe(true)
    expect(checkAnonymousRateLimit("127.0.0.1", now + 10)).toBe(true)
  })
})
