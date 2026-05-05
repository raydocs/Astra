import { createServer, type IncomingMessage, type ServerResponse } from "node:http"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

import {
  withExtensionBrowserPage,
  LiveBrowserUnavailableError,
  ExtensionBuildNotFoundError,
  type ExtensionBrowserContext,
} from "../driver"
import type { LiveEvaluationResult, LiveScenarioDefinition, LiveScenarioExecution, LiveScenarioMetadata } from "../evaluator"

const AUTH_STORAGE_KEY = "astra.auth.v1"
const DEVICE_STORAGE_KEY = "astra.device.v1"
const VOCABULARY_STORAGE_KEY = "astra.vocabulary.v1"
const STUDY_PROGRESS_STORAGE_KEY = "astra.study_progress.v1"
const PHASE_ONE_SYNC_STATE_KEY = "astra.sync.phase1.v1"

const DEVICE_ID = "bench-continuity-device"
const ACCOUNT_EMAIL = "continuity@example.com"
const SESSION_TOKEN = "bench-continuity-token"
const STUDY_URL = "https://example.com/continuity-proof"
const NOW_ISO = "2026-04-09T01:00:00.000Z"

type CollectionName = "config" | "vocabulary" | "reading_history" | "study_progress"

type SyncMutation = {
  collection: CollectionName
  schemaVersion: number
  recordId: string
  operation: "upsert" | "delete"
  clientMutationId: string
  deviceId: string
  clientUpdatedAt: string
  payload?: Record<string, unknown> | null
}

type StoredRecord = SyncMutation & {
  ownerId: string
  email: string
  serverMutationId: string
  serverUpdatedAt: string
  cursor: string
}

interface LearningContinuitySyncProofExecution extends LiveScenarioExecution {
  continuitySync?: {
    commitSucceeded: boolean
    recoverySucceeded: boolean
    pushedVocabulary: boolean
    pushedStudyProgress: boolean
    recoveredVocabulary: boolean
    recoveredStudyProgress: boolean
    recoveredExplainProfile: boolean
    srsScheduleStayedLocalOnly: boolean
    popupStatusVisible: boolean
    popupCommitCardVisible: boolean
    consoleErrors: string[]
    pushCount: number
    pullCount: number
  }
}

function json(res: ServerResponse, status: number, payload: unknown): void {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Astra-Device-Id, Idempotency-Key",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    Connection: "close",
  })
  res.end(JSON.stringify(payload))
}

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
    req.on("end", () => {
      try {
        resolve(chunks.length > 0 ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {})
      } catch (error) {
        reject(error)
      }
    })
    req.on("error", reject)
  })
}

function createCollectionState() {
  return {
    records: new Map<string, StoredRecord>(),
    cursor: null as string | null,
  }
}

async function createContinuityRelayServer() {
  const collections: Record<CollectionName, ReturnType<typeof createCollectionState>> = {
    config: createCollectionState(),
    vocabulary: createCollectionState(),
    reading_history: createCollectionState(),
    study_progress: createCollectionState(),
  }
  const pushBatches: SyncMutation[][] = []
  const pullRequests: unknown[] = []
  let cursorCounter = 0

  const nextCursor = (collection: CollectionName) => `${collection}-${(++cursorCounter).toString().padStart(4, "0")}`

  const server = createServer(async (req, res) => {
    const requestUrl = new URL(req.url ?? "/", "http://127.0.0.1")
    const pathName = requestUrl.pathname.replace(/^\/v1/, "")

    if (req.method === "OPTIONS") {
      json(res, 204, {})
      return
    }

    if (req.method === "GET" && pathName === "/devices") {
      json(res, 200, {
        devices: [{
          deviceId: DEVICE_ID,
          label: "Bench Continuity Chrome",
          platform: "macos",
          browserFamily: "chrome",
          appKind: "extension",
          appVersion: "0.1.0-test",
          firstSeenAt: NOW_ISO,
          lastSeenAt: NOW_ISO,
          lastSyncAt: collections.vocabulary.cursor ?? collections.study_progress.cursor ? NOW_ISO : null,
          status: "active",
          isCurrentDevice: true,
        }],
      })
      return
    }

    if (req.method === "GET" && pathName === "/auth/session") {
      json(res, 200, {
        version: 1,
        sessionToken: SESSION_TOKEN,
        sessionId: "sess-continuity",
        deviceId: DEVICE_ID,
        identityMode: "authenticated",
        relayBaseURL: `http://127.0.0.1:${(server.address() as { port: number }).port}/v1`,
        email: ACCOUNT_EMAIL,
        plan: "pro",
        subscriptionStatus: "active",
        providerEntitlements: ["openai", "gemini"],
        issuedAt: NOW_ISO,
        expiresAt: null,
      })
      return
    }

    if (req.method === "GET" && pathName === "/account/summary") {
      const collectionSummary = (collection: CollectionName) => ({
        enabled: true,
        defaultEnabled: true,
        cursor: collections[collection].cursor,
        mutationCount: collections[collection].records.size,
        activeCount: collections[collection].records.size,
        lastSyncAt: collections[collection].cursor ? NOW_ISO : null,
        compactionFloorCursor: null,
      })
      json(res, 200, {
        serverTime: NOW_ISO,
        account: {
          id: "acct-continuity",
          relayBaseURL: `http://127.0.0.1:${(server.address() as { port: number }).port}/v1`,
          email: ACCOUNT_EMAIL,
          billingEmail: ACCOUNT_EMAIL,
          createdAt: NOW_ISO,
          plan: "pro",
          subscriptionStatus: "active",
          providerEntitlements: ["openai", "gemini"],
        },
        usage: {
          generatedAt: NOW_ISO,
          quota: { dailyRequestsLimit: 0, dailyCharactersLimit: 0, requestsPerMinuteLimit: 0, remainingDailyRequests: 0, remainingDailyCharacters: 0 },
          usage: { totalRequests: 0, totalCharacters: 0, dailyRequestsUsed: 0, dailyCharactersUsed: 0, lastRequestAt: null, recentEvents: [] },
        },
        session: { sessionId: "sess-continuity", deviceId: DEVICE_ID, issuedAt: NOW_ISO, expiresAt: null, identityMode: "authenticated", status: "active" },
        devices: { activeCount: 1, revokedCount: 0, current: null, entries: [] },
        sync: {
          maxMutationsPerRequest: 100,
          collections: {
            config: collectionSummary("config"),
            vocabulary: collectionSummary("vocabulary"),
            reading_history: collectionSummary("reading_history"),
            study_progress: collectionSummary("study_progress"),
          },
        },
      })
      return
    }

    if (req.method === "GET" && pathName === "/sync/bootstrap") {
      json(res, 200, {
        serverTime: NOW_ISO,
        deviceId: DEVICE_ID,
        collections: {
          config: { enabled: true, defaultEnabled: true, cursor: collections.config.cursor },
          vocabulary: { enabled: true, defaultEnabled: true, cursor: collections.vocabulary.cursor },
          reading_history: { enabled: true, defaultEnabled: true, cursor: collections.reading_history.cursor },
          study_progress: { enabled: true, defaultEnabled: true, cursor: collections.study_progress.cursor },
        },
        limits: { maxMutationsPerRequest: 100 },
        transport: { deviceHeader: "X-Astra-Device-Id", idempotencyKey: "clientMutationId", cursorMode: "per-collection" },
      })
      return
    }

    if (req.method === "POST" && pathName === "/sync/push") {
      const body = await readJsonBody(req) as { mutations?: SyncMutation[] }
      const mutations = body.mutations ?? []
      pushBatches.push(mutations)
      const accepted = mutations.map((mutation) => {
        const cursor = nextCursor(mutation.collection)
        const record: StoredRecord = {
          ...mutation,
          ownerId: "acct-continuity",
          email: ACCOUNT_EMAIL,
          serverMutationId: `srv-${cursor}`,
          serverUpdatedAt: NOW_ISO,
          cursor,
        }
        collections[mutation.collection].cursor = cursor
        if (mutation.operation === "delete") {
          collections[mutation.collection].records.delete(mutation.recordId)
        } else {
          collections[mutation.collection].records.set(mutation.recordId, record)
        }
        return {
          collection: mutation.collection,
          clientMutationId: mutation.clientMutationId,
          recordId: mutation.recordId,
          operation: mutation.operation,
          serverUpdatedAt: NOW_ISO,
          cursor,
          deduped: false,
        }
      })
      json(res, 200, {
        serverTime: NOW_ISO,
        accepted,
        rejected: [],
        nextCursors: {
          config: collections.config.cursor,
          vocabulary: collections.vocabulary.cursor,
          reading_history: collections.reading_history.cursor,
          study_progress: collections.study_progress.cursor,
        },
      })
      return
    }

    if (req.method === "POST" && pathName === "/sync/pull") {
      const body = await readJsonBody(req) as { cursors?: Partial<Record<CollectionName, string | null>> }
      pullRequests.push(body)
      const deltas = (Object.keys(collections) as CollectionName[]).reduce((acc, collection) => {
        const requestedCursor = body.cursors?.[collection] ?? null
        acc[collection] = requestedCursor === collections[collection].cursor
          ? []
          : Array.from(collections[collection].records.values())
        return acc
      }, {} as Record<CollectionName, StoredRecord[]>)
      json(res, 200, {
        serverTime: NOW_ISO,
        deltas,
        nextCursors: {
          config: collections.config.cursor,
          vocabulary: collections.vocabulary.cursor,
          reading_history: collections.reading_history.cursor,
          study_progress: collections.study_progress.cursor,
        },
      })
      return
    }

    if (req.method === "POST" && pathName === "/sync/repair") {
      json(res, 200, {
        serverTime: NOW_ISO,
        collections: Object.fromEntries((Object.keys(collections) as CollectionName[]).map((collection) => [
          collection,
          {
            enabled: true,
            defaultEnabled: true,
            latestCursor: collections[collection].cursor,
            compactionFloorCursor: null,
            records: Array.from(collections[collection].records.values()).map((record) => ({
              recordId: record.recordId,
              payload: record.payload,
              lastClientMutationId: record.clientMutationId,
              lastDeviceId: record.deviceId,
              lastServerUpdatedAt: record.serverUpdatedAt,
              cursor: record.cursor,
            })),
          },
        ])),
      })
      return
    }

    json(res, 404, { error: { message: `No route for ${req.method} ${pathName}` } })
  })

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject)
    server.listen(0, "127.0.0.1", () => resolve())
  })
  const address = server.address()
  if (!address || typeof address === "string") throw new Error("Continuity relay did not bind to a TCP port.")

  return {
    origin: `http://127.0.0.1:${address.port}/v1`,
    pushBatches,
    pullRequests,
    async close() {
      server.closeAllConnections?.()
      server.closeIdleConnections?.()
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    },
  }
}

export const learningContinuitySyncProofScenario: LiveScenarioDefinition<LearningContinuitySyncProofExecution> = {
  id: "bench-live/learning-continuity-sync-proof",
  title: "Live authenticated learning continuity sync proof",
  surface: "background",
  fixture: "extension:storage",
  description:
    "Seeds authenticated learning assets, commits phase-one sync through the real background runtime, clears local learning stores, and proves vocabulary/sourceContext plus study progress recover through authenticated continuity.",
  tags: ["playwright", "background", "continuity", "learning-loop", "sync", "extension-loaded", "proof"],
  async run(runtime, context) {
    runtime.start(context.id, context.title)
    const relay = await createContinuityRelayServer()
    const artifactDir = path.join(process.cwd(), "bench-live-results", context.runId)
    await mkdir(artifactDir, { recursive: true })

    const seededVocabulary = [{
      id: "continuity-vocab-1",
      text: "continuity phrase",
      explanation: "Explain profile proof",
      context: "Readers recover saved learning assets across devices.",
      url: STUDY_URL,
      hostname: "example.com",
      savedAt: Date.now(),
      srsBox: 5,
      nextReviewAt: Date.now() + 86_400_000,
      reviewCount: 7,
      lastReviewedAt: Date.now(),
      sourceContext: {
        surface: "popup_deep_read" as const,
        pageTitle: "Continuity proof article",
        pageUrl: STUDY_URL,
        hostname: "example.com",
        contentSummary: "Authenticated continuity preserves learning-loop assets.",
        sentenceText: "Readers recover saved learning assets across devices.",
        sentenceIndex: 0,
        languageLevel: "beginner" as const,
        explainMode: "exam" as const,
        studyProgressRecordId: STUDY_URL,
      },
    }]
    const seededStudyProgress = {
      pages: [{
        url: STUDY_URL,
        hostname: "example.com",
        title: "Continuity proof article",
        completedSteps: ["read", "explain", "vocab_save", "vocab_review"],
        sentencesExplained: 1,
        vocabSaved: 1,
        vocabReviewed: 1,
        startedAt: Date.now() - 120_000,
        lastActivityAt: Date.now(),
      }],
      dailyStats: { date: new Date().toISOString().slice(0, 10), pagesStudied: 1, sentencesExplained: 1, vocabSaved: 1, vocabReviewed: 1 },
    }

    let extCtx: ExtensionBrowserContext | null = null
    try {
      extCtx = await withExtensionBrowserPage({
        initialUrl: "about:blank",
        waitForExtensionInject: 0,
        storageState: {
          [DEVICE_STORAGE_KEY]: {
            version: 1,
            deviceId: DEVICE_ID,
            label: "Bench Continuity Chrome",
            platform: "macos",
            browserFamily: "chrome",
            appKind: "extension",
            appVersion: "0.1.0-test",
            createdAt: NOW_ISO,
            updatedAt: NOW_ISO,
          },
          [AUTH_STORAGE_KEY]: {
            version: 1,
            sessionToken: SESSION_TOKEN,
            sessionId: "sess-continuity",
            deviceId: DEVICE_ID,
            identityMode: "authenticated",
            relayBaseURL: relay.origin,
            email: ACCOUNT_EMAIL,
            plan: "pro",
            subscriptionStatus: "active",
            providerEntitlements: ["openai", "gemini"],
          },
          [VOCABULARY_STORAGE_KEY]: seededVocabulary,
          [STUDY_PROGRESS_STORAGE_KEY]: seededStudyProgress,
        },
      })

      const consoleErrors: string[] = []
      extCtx.page.on("console", (msg) => {
        if (msg.type() === "error" && !msg.text().includes("favicon.ico") && !msg.text().includes("404")) consoleErrors.push(msg.text())
      })

      await extCtx.page.goto(`chrome-extension://${extCtx.extensionId}/popup.html`, { waitUntil: "domcontentloaded", timeout: 15_000 })
      await extCtx.page.waitForSelector("body", { timeout: 10_000 })

      const commitResponse = await extCtx.page.evaluate(async () => {
        const extensionApi = (globalThis as typeof globalThis & { chrome: any }).chrome
        return await extensionApi.runtime.sendMessage({ type: "runtime/learning-continuity-sync", reason: "popup-save" })
      }) as { type?: string }
      const commitSucceeded = commitResponse.type === "runtime/learning-continuity-sync:success"

      const pushedMutations = relay.pushBatches.flat()
      const vocabularyMutation = pushedMutations.find((mutation) => mutation.collection === "vocabulary" && mutation.recordId === "continuity-vocab-1")
      const studyProgressMutation = pushedMutations.find((mutation) => mutation.collection === "study_progress" && mutation.recordId === STUDY_URL)
      const vocabularyPayload = vocabularyMutation?.payload as Record<string, unknown> | undefined
      const sourceContext = vocabularyPayload?.sourceContext as Record<string, unknown> | undefined
      const pushedVocabulary = !!vocabularyMutation
        && sourceContext?.languageLevel === "beginner"
        && sourceContext?.explainMode === "exam"
      const pushedStudyProgress = !!studyProgressMutation
      const srsScheduleStayedLocalOnly = !!vocabularyPayload
        && !("srsBox" in vocabularyPayload)
        && !("nextReviewAt" in vocabularyPayload)
        && !("reviewCount" in vocabularyPayload)
        && !("lastReviewedAt" in vocabularyPayload)

      await extCtx.page.evaluate(async ({ authKey, session, vocabKey, progressKey, syncKey }) => {
        const extensionApi = (globalThis as typeof globalThis & { chrome: any }).chrome
        await extensionApi.storage.local.remove(authKey)
        await extensionApi.storage.local.remove([vocabKey, progressKey, syncKey])
        await extensionApi.storage.local.set({ [authKey]: session })
      }, {
        authKey: AUTH_STORAGE_KEY,
        session: {
          version: 1,
          sessionToken: SESSION_TOKEN,
          sessionId: "sess-continuity",
          deviceId: DEVICE_ID,
          identityMode: "authenticated",
          relayBaseURL: relay.origin,
          email: ACCOUNT_EMAIL,
          plan: "pro",
          subscriptionStatus: "active",
          providerEntitlements: ["openai", "gemini"],
        },
        vocabKey: VOCABULARY_STORAGE_KEY,
        progressKey: STUDY_PROGRESS_STORAGE_KEY,
        syncKey: PHASE_ONE_SYNC_STATE_KEY,
      })

      const recoveryResponse = await extCtx.page.evaluate(async () => {
        const extensionApi = (globalThis as typeof globalThis & { chrome: any }).chrome
        return await extensionApi.runtime.sendMessage({ type: "runtime/learning-continuity-sync", reason: "review-answer" })
      }) as { type?: string }
      const recoverySucceeded = recoveryResponse.type === "runtime/learning-continuity-sync:success"
      await extCtx.page.waitForFunction(async ({ vocabKey, progressKey, expectedId, expectedUrl }) => {
        const extensionApi = (globalThis as typeof globalThis & { chrome: any }).chrome
        const stored = await extensionApi.storage.local.get([vocabKey, progressKey])
        const vocabulary = stored[vocabKey] as Array<{ id?: string }> | undefined
        const progress = stored[progressKey] as { pages?: Array<{ url?: string }> } | undefined
        return !!vocabulary?.some((entry) => entry.id === expectedId)
          && !!progress?.pages?.some((page) => page.url === expectedUrl)
      }, { vocabKey: VOCABULARY_STORAGE_KEY, progressKey: STUDY_PROGRESS_STORAGE_KEY, expectedId: "continuity-vocab-1", expectedUrl: STUDY_URL }, { timeout: 10_000 })

      const recovered = await extCtx.page.evaluate(async ({ vocabKey, progressKey }) => {
        const extensionApi = (globalThis as typeof globalThis & { chrome: any }).chrome
        return await extensionApi.storage.local.get([vocabKey, progressKey])
      }, { vocabKey: VOCABULARY_STORAGE_KEY, progressKey: STUDY_PROGRESS_STORAGE_KEY }) as Record<string, unknown>
      const recoveredVocabularyEntries = recovered[VOCABULARY_STORAGE_KEY] as Array<Record<string, unknown>> | undefined
      const recoveredStudyProgress = recovered[STUDY_PROGRESS_STORAGE_KEY] as { pages?: Array<Record<string, unknown>> } | undefined
      const recoveredEntry = recoveredVocabularyEntries?.find((entry) => entry.id === "continuity-vocab-1")
      const recoveredSourceContext = recoveredEntry?.sourceContext as Record<string, unknown> | undefined
      const recoveredVocabulary = !!recoveredEntry
      const recoveredStudyProgressVisible = !!recoveredStudyProgress?.pages?.some((page) => page.url === STUDY_URL && page.vocabReviewed === 1)
      const recoveredExplainProfile = recoveredSourceContext?.languageLevel === "beginner" && recoveredSourceContext?.explainMode === "exam"

      await extCtx.page.reload({ waitUntil: "domcontentloaded", timeout: 15_000 })
      await extCtx.page.waitForSelector("body", { timeout: 10_000 })
      await extCtx.page.waitForSelector('[data-testid="learning-continuity-commit-card"]', { timeout: 10_000 })
      await extCtx.page.waitForSelector('[data-testid="learning-continuity-sync-status"]', { state: "attached", timeout: 10_000 })
      const popupStatusVisible = await extCtx.page.locator('[data-testid="learning-continuity-sync-status"]').evaluate((element) => (
        element.textContent ?? ""
      ).includes("Learning continuity commit:")).catch(() => false)
      const popupCommitCardVisible = await extCtx.page.locator('[data-testid="learning-continuity-commit-card"]').evaluate((element) => {
        const text = element.textContent ?? ""
        return text.includes("Learning continuity commit")
          && text.includes("Sync now")
          && text.includes("SRS schedule remains local-only")
      }).catch(() => false)

      const screenshotPath = path.join(artifactDir, "learning-continuity-sync-proof.popup.png")
      await extCtx.page.screenshot({ path: screenshotPath, fullPage: true })
      const snapshotPath = path.join(artifactDir, "learning-continuity-sync-proof.snapshot.html")
      await writeFile(snapshotPath, await extCtx.page.content(), "utf8")
      const payloadPath = path.join(artifactDir, "learning-continuity-sync-proof.payload.json")
      await writeFile(payloadPath, JSON.stringify({ pushedMutations, recovered, recoveryResponse, pullRequests: relay.pullRequests }, null, 2), "utf8")

      runtime.attachArtifact("learningContinuitySyncProof", {
        screenshotPath,
        snapshotPath,
        payloadPath,
        pushCount: relay.pushBatches.length,
        pullCount: relay.pullRequests.length,
        consoleErrors,
      })
      runtime.complete("Authenticated learning continuity sync proof finished.")
      const snapshot = runtime.snapshot()

      return {
        status: snapshot.status,
        summary: "Authenticated continuity commit and recovery proof executed against the real extension background.",
        notes: [`Relay origin: ${relay.origin}`],
        artifacts: {
          screenshotPath,
          snapshotPath,
          payloadPath,
        },
        runtime: snapshot,
        continuitySync: {
          commitSucceeded,
          recoverySucceeded,
          pushedVocabulary,
          pushedStudyProgress,
          recoveredVocabulary,
          recoveredStudyProgress: recoveredStudyProgressVisible,
          recoveredExplainProfile,
          srsScheduleStayedLocalOnly,
          popupStatusVisible,
          popupCommitCardVisible,
          consoleErrors,
          pushCount: relay.pushBatches.length,
          pullCount: relay.pullRequests.length,
        },
      }
    } catch (error) {
      if (error instanceof LiveBrowserUnavailableError) {
        runtime.skip(error.message)
        const snapshot = runtime.snapshot()
        return { status: snapshot.status, summary: "No supported browser executable available.", notes: [error.message], artifacts: { browserAvailability: "missing" }, runtime: snapshot }
      }
      if (error instanceof ExtensionBuildNotFoundError) {
        runtime.skip(error.message)
        const snapshot = runtime.snapshot()
        return { status: snapshot.status, summary: "Extension build not found. Run pnpm build first.", notes: [error.message], artifacts: { extensionBuild: "missing" }, runtime: snapshot }
      }
      throw error
    } finally {
      await extCtx?.close()
      await relay.close()
    }
  },
  evaluate(execution, context) {
    const proof = execution.continuitySync ?? {
      commitSucceeded: false,
      recoverySucceeded: false,
      pushedVocabulary: false,
      pushedStudyProgress: false,
      recoveredVocabulary: false,
      recoveredStudyProgress: false,
      recoveredExplainProfile: false,
      srsScheduleStayedLocalOnly: false,
      popupStatusVisible: false,
      popupCommitCardVisible: false,
      consoleErrors: [],
      pushCount: 0,
      pullCount: 0,
    }
    const issues: string[] = []
    if (!proof.commitSucceeded) issues.push("Runtime learning continuity commit did not succeed.")
    if (!proof.pushedVocabulary) issues.push("Vocabulary mutation with explain profile was not pushed.")
    if (!proof.pushedStudyProgress) issues.push("Study progress mutation was not pushed.")
    if (!proof.recoverySucceeded) issues.push("Second authenticated continuity sync did not succeed.")
    if (!proof.recoveredVocabulary) issues.push("Vocabulary entry was not recovered after local clear.")
    if (!proof.recoveredStudyProgress) issues.push("Study progress was not recovered after local clear.")
    if (!proof.recoveredExplainProfile) issues.push("Recovered vocabulary sourceContext did not include explain profile.")
    if (!proof.srsScheduleStayedLocalOnly) issues.push("Sync payload included local-only SRS schedule fields.")
    if (!proof.popupStatusVisible) issues.push("Popup did not preserve diagnostics learning continuity commit status.")
    if (!proof.popupCommitCardVisible) issues.push("Popup did not expose the first-class learning continuity commit card.")
    if (proof.consoleErrors.length > 0) issues.push(`${proof.consoleErrors.length} console error(s) captured.`)

    const pass = issues.length === 0
    const scenario: LiveScenarioMetadata = {
      id: context.scenario.id,
      title: context.scenario.title,
      surface: context.scenario.surface,
      fixture: context.scenario.fixture,
      description: context.scenario.description,
      tags: context.scenario.tags,
    }

    return {
      runId: context.runId,
      scenario,
      status: pass ? "pass" : "fail",
      pass,
      score: pass ? 100 : 50,
      summary: pass
        ? "Authenticated learning continuity proof passed: saved learning assets and explain profile recovered after phase-one sync."
        : "Authenticated learning continuity proof failed: continuity commit/recovery contract is incomplete.",
      issues,
      nextActions: pass ? [] : ["Inspect learning-continuity-sync-proof artifacts and background runtime sync handling."],
      notes: execution.notes ?? [],
      rubrics: [],
      artifacts: execution.artifacts ?? {},
      runtime: context.runtime,
    } as unknown as Partial<LiveEvaluationResult>
  },
}
