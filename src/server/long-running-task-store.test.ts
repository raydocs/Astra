import { mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { FileLongRunningTaskStore } from "./long-running-task-store"
import type { RelayEnv } from "./types"

async function createEnv(): Promise<RelayEnv> {
  const dir = await mkdtemp(join(tmpdir(), "astra-long-task-store-"))
  return {
    port: 0,
    host: "127.0.0.1",
    publicBaseURL: "http://127.0.0.1:8787/v1",
    sessionPublicBaseURL: "http://127.0.0.1:8787/v1",
    sessionSecret: "test-secret",
    platformMirrorSecret: "operator-secret",
    operatorPrincipals: [],
    userDbPath: join(dir, "users.json"),
    videoNoteStorePath: join(dir, "video-notes.json"),
    longRunningTaskStorePath: join(dir, "long-tasks.json"),
    supportReportInboxPath: join(dir, "support-reports.json"),
    supportKnownIssueStorePath: join(dir, "support-known-issues.json"),
    featureFlagRuntimePath: join(dir, "feature-flags.json"),
    opsAuditLogPath: join(dir, "ops-audit-log.json"),
    cancellationReasonStorePath: join(dir, "cancellation-reasons.json"),
    loginEmail: "demo@astra.local",
    loginPassword: "astra-demo-pass",
    plan: "free",
    subscriptionStatus: "active",
    providerEntitlements: ["openai"],
    billingCheckoutBaseURL: "https://billing.example/checkout",
    billingPortalBaseURL: "https://billing.example/portal",
    openaiApiKey: "",
    googleApiKey: "",
    googleTranslateApiKey: "",
    openrouterApiKey: "",
    useOpenRouter: false,
    openrouterModelMap: {},
    freeDailyRequests: 100,
    freeDailyCharacters: 1000,
    freeRpm: 10,
    trialDailyRequests: 200,
    trialDailyCharacters: 2000,
    trialRpm: 20,
    proDailyRequests: 1000,
    proDailyCharacters: 10000,
    proRpm: 60,
    sessionTtlMs: 60_000,
    syncMaxMutationsPerRequest: 100,
    videoNoteMaxConcurrentJobs: 1,
    emailSignInCodeDevelopmentEcho: false,
    oauthIdentityDevelopmentRedeem: false,
  }
}

function deepReadRequest() {
  return {
    clientRequestId: "client-long-task-001",
    taskClass: "deep_reading" as const,
    category: "long_pdf" as const,
    surface: "file" as const,
    source: {
      type: "pdf" as const,
      sourceFingerprint: "sha256:pdfdemo001",
      hostname: null,
      lengthBucket: "very_long" as const,
    },
    retryHints: {
      retryable: true,
      attempt: 0,
      maxAttempts: 3,
      retryAfterSeconds: null,
      fallbackReason: "none" as const,
      degradePath: "background_finish" as const,
      fallbackAllowed: true,
    },
  }
}

describe("FileLongRunningTaskStore", () => {
  it("creates and updates a metadata-only long-running lifecycle through partial and succeeded states", async () => {
    const env = await createEnv()
    const store = new FileLongRunningTaskStore(env)

    const created = await store.createTask({
      ownerEmail: "reader@example.com",
      ownerUserId: "usr_reader",
      deviceId: "device-reader",
      sessionId: "session-reader",
      input: deepReadRequest(),
      createdAt: "2026-05-28T10:00:00.000Z",
    })

    expect(created).toMatchObject({
      schema: "astra-long-running-task.v1",
      taskClass: "deep_reading",
      category: "long_pdf",
      surface: "file",
      status: "queued",
      privacy: {
        metadataOnly: true,
        contentIncluded: false,
        promptIncluded: false,
        modelOutputIncluded: false,
        rawSourceIncluded: false,
      },
    })

    const running = await store.updateTask(created.taskId, {
      status: "running",
      progress: { stage: "chunking", completedUnits: 1, totalUnits: 5, percent: 20 },
    }, "2026-05-28T10:01:00.000Z")
    expect(running).toMatchObject({
      status: "running",
      startedAt: "2026-05-28T10:01:00.000Z",
      progress: { stage: "chunking", completedUnits: 1, totalUnits: 5, percent: 20 },
    })

    const partial = await store.updateTask(created.taskId, {
      status: "partial",
      progress: { stage: "summarizing", completedUnits: 3, totalUnits: 5, percent: 60 },
      partialResult: {
        available: true,
        kind: "chapter_summary",
        completedUnits: 3,
        totalUnits: 5,
        itemCount: 3,
        artifactRef: "partial:chapter-summary-001",
        cacheStatus: "partial",
      },
      retryHints: {
        retryable: true,
        attempt: 1,
        maxAttempts: 3,
        retryAfterSeconds: 30,
        fallbackReason: "timeout",
        degradePath: "partial_result",
        fallbackAllowed: true,
      },
    }, "2026-05-28T10:02:00.000Z")

    expect(partial).toMatchObject({
      status: "partial",
      partialAt: "2026-05-28T10:02:00.000Z",
      partialResult: {
        available: true,
        kind: "chapter_summary",
        completedUnits: 3,
        totalUnits: 5,
        itemCount: 3,
        artifactRef: "partial:chapter-summary-001",
        cacheStatus: "partial",
        updatedAt: "2026-05-28T10:02:00.000Z",
      },
      retryHints: { fallbackReason: "timeout", degradePath: "partial_result" },
    })

    const succeeded = await store.updateTask(created.taskId, {
      status: "succeeded",
      progress: { stage: "done", completedUnits: 5, totalUnits: 5, percent: 100 },
      partialResult: {
        available: true,
        kind: "chapter_summary",
        completedUnits: 5,
        totalUnits: 5,
        itemCount: 5,
        artifactRef: "artifact:deep-read-001",
        cacheStatus: "hit",
      },
      retryHints: {
        retryable: false,
        attempt: 1,
        maxAttempts: 3,
        retryAfterSeconds: null,
        fallbackReason: "none",
        degradePath: "none",
        fallbackAllowed: false,
      },
    }, "2026-05-28T10:03:00.000Z")

    expect(succeeded).toMatchObject({
      status: "succeeded",
      completedAt: "2026-05-28T10:03:00.000Z",
      progress: { stage: "done", completedUnits: 5, totalUnits: 5, percent: 100 },
    })

    const persisted = JSON.parse(await readFile(env.longRunningTaskStorePath!, "utf8")) as unknown
    const serialized = JSON.stringify(persisted)
    expect(serialized).not.toMatch(/Hello world|chapter body|model output|https:\/\/|private\.example/i)
    expect(serialized).toContain("\"contentIncluded\":false")
  })

  it("rejects unsafe content-shaped lifecycle fields before persistence", async () => {
    const env = await createEnv()
    const store = new FileLongRunningTaskStore(env)

    await store.createTask({
      ownerEmail: "reader@example.com",
      ownerUserId: "usr_reader",
      deviceId: "device-reader",
      sessionId: "session-reader",
      input: deepReadRequest(),
    })

    await expect(store.createTask({
      ownerEmail: "reader@example.com",
      ownerUserId: "usr_reader",
      deviceId: "device-reader",
      sessionId: "session-reader",
      input: {
        ...deepReadRequest(),
        rawSourceUrl: "https://private.example/document.pdf?token=secret",
      } as never,
    })).rejects.toThrow()

    await expect(store.createTask({
      ownerEmail: "reader@example.com",
      ownerUserId: "usr_reader",
      deviceId: "device-reader",
      sessionId: "session-reader",
      input: {
        ...deepReadRequest(),
        partialResult: {
          available: true,
          kind: "outline",
          completedUnits: 1,
          totalUnits: 3,
          itemCount: 1,
          artifactRef: "https://private.example/full-output",
          cacheStatus: "partial",
          updatedAt: null,
        },
      } as never,
    })).rejects.toThrow()

    const persisted = await readFile(env.longRunningTaskStorePath!, "utf8")
    expect(persisted).not.toContain("private.example")
  })

  it("supports multiple long-running task categories and owner boundaries", async () => {
    const env = await createEnv()
    const store = new FileLongRunningTaskStore(env)

    const videoTask = await store.createTask({
      ownerEmail: "video@example.com",
      ownerUserId: "usr_video",
      deviceId: "device-video",
      sessionId: "session-video",
      input: {
        taskClass: "video_summary",
        category: "long_video",
        surface: "video",
        source: { type: "video", sourceFingerprint: "sha256:video001", hostname: "youtube.com", lengthBucket: "long" },
      },
    })
    const digestTask = await store.createTask({
      ownerEmail: "digest@example.com",
      ownerUserId: "usr_digest",
      deviceId: "device-digest",
      sessionId: "session-digest",
      input: {
        taskClass: "digest",
        category: "digest",
        surface: "digest",
        source: { type: "saved", sourceFingerprint: "sha256:digest001", hostname: null, lengthBucket: "medium" },
      },
    })

    await expect(store.getTaskForOwner("video@example.com", videoTask.taskId)).resolves.toMatchObject({ category: "long_video" })
    await expect(store.getTaskForOwner("video@example.com", digestTask.taskId)).resolves.toBeNull()

    const videoTasks = await store.listTasksForOwner("video@example.com")
    expect(videoTasks.map((task) => task.taskId)).toEqual([videoTask.taskId])
  })

  it("refuses to overwrite invalid retained task metadata files", async () => {
    const env = await createEnv()
    await writeFile(env.longRunningTaskStorePath!, "not-json")
    const store = new FileLongRunningTaskStore(env)

    await expect(store.createTask({
      ownerEmail: "reader@example.com",
      ownerUserId: "usr_reader",
      deviceId: "device-reader",
      sessionId: "session-reader",
      input: deepReadRequest(),
    })).rejects.toThrow(/invalid JSON; refusing to overwrite retained task metadata/)

    await expect(readFile(env.longRunningTaskStorePath!, "utf8")).resolves.toBe("not-json")
  })
})
