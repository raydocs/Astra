import { createServer } from "node:http"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

import {
  withExtensionBrowserPage,
  LiveBrowserUnavailableError,
  ExtensionBuildNotFoundError,
  type ExtensionBrowserContext,
} from "../driver"
import { sleep } from "../sleep"
import type { LiveScenarioDefinition, LiveScenarioExecution, LiveScenarioMetadata, LiveEvaluationResult } from "../evaluator"
/** Mirror extension storage keys — do not import app modules here (they use `#imports`, unavailable in tsx bench). */
const VOCABULARY_STORAGE_KEY = "astra.vocabulary.v1"
const READING_HISTORY_STORAGE_KEY = "astra.reading_history.v1"
const STUDY_PROGRESS_STORAGE_KEY = "astra.study_progress.v1"

function buildStudyProgressRecordIdForBench(url: string): string {
  const trimmed = url.trim()
  try {
    const parsed = new URL(trimmed)
    parsed.search = ""
    parsed.hash = ""
    return parsed.toString()
  } catch {
    return trimmed
  }
}

const FIXTURE_HTML = `<!doctype html><html><head><meta charset="utf-8"/><title>Revisit fixture</title></head><body><article><h1>Learning loop revisit fixture</h1><p>Fixture page for bench-live revisit smoke.</p></article></body></html>`

interface LearningLoopRevisitSmokeExecution extends LiveScenarioExecution {
  revisit: {
    fixtureOrigin: string
    vocabularyOpened: boolean
    readingTabOpened: boolean
    openButtonEnabled: boolean
    newTabUrlMatchesFixture: boolean
    consoleErrors: string[]
  }
}

function startFixtureServer(): Promise<{ origin: string; close: () => Promise<void> }> {
  const server = createServer((req, res) => {
    if (req.url === "/" || req.url?.startsWith("/learning-loop-revisit")) {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" })
      res.end(FIXTURE_HTML)
      return
    }
    if (req.url === "/favicon.ico") {
      res.writeHead(204, { "cache-control": "no-store" })
      res.end()
      return
    }
    res.writeHead(404, { "content-type": "text/plain" })
    res.end("not found")
  })

  return new Promise((resolve, reject) => {
    server.once("error", reject)
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address()
      if (!addr || typeof addr === "string") {
        reject(new Error("Fixture server did not bind to a port."))
        return
      }
      const origin = `http://127.0.0.1:${addr.port}`
      resolve({
        origin,
        close: () => new Promise((res, rej) => {
          server.close((err) => (err ? rej(err) : res()))
        }),
      })
    })
  })
}

export const learningLoopRevisitSmokeScenario: LiveScenarioDefinition<LearningLoopRevisitSmokeExecution> = {
  id: "bench-live/learning-loop-revisit-smoke",
  title: "Live learning-loop revisit smoke",
  surface: "vocabulary",
  fixture: "page:none",
  description:
    "Serves a minimal article page, seeds vocabulary + reading history + study progress, opens vocabulary Reading tab, and verifies Open launches the same origin in a new tab (Month 2 revisit v1).",
  tags: ["playwright", "vocabulary", "reading-queue", "revisit", "extension-loaded", "smoke"],
  async run(runtime, context) {
    runtime.start(context.id, context.title)

    const fixtureServer = await startFixtureServer()
    const fixtureUrl = `${fixtureServer.origin}/learning-loop-revisit-fixture/index.html`
    const recordId = buildStudyProgressRecordIdForBench(fixtureUrl)
    const FIXTURE_TITLE = "Learning loop revisit fixture"

    runtime.log("Starting learning-loop revisit smoke.", { fixtureUrl, recordId })

    const artifactDir = path.join(process.cwd(), "bench-live-results", context.runId)
    await mkdir(artifactDir, { recursive: true })

    let extCtx: ExtensionBrowserContext | null = null

    const vocabularySeed = [
      {
        id: "bench-revisit-vocab-1",
        text: "fixture-word",
        url: fixtureUrl,
        hostname: "127.0.0.1",
        savedAt: Date.now(),
        srsBox: 1,
        nextReviewAt: Date.now(),
        reviewCount: 0,
        lastReviewedAt: null,
        sourceContext: {
          surface: "popup_deep_read" as const,
          pageTitle: FIXTURE_TITLE,
          sentenceText: "fixture-word",
        },
      },
    ]

    const readingHistorySeed = [
      {
        id: recordId,
        url: fixtureUrl,
        hostname: "127.0.0.1",
        title: FIXTURE_TITLE,
        wordsTranslated: 12,
        visitedAt: Date.now(),
      },
    ]

    const studyProgressSeed = {
      pages: [
        {
          url: recordId,
          hostname: "127.0.0.1",
          title: FIXTURE_TITLE,
          completedSteps: ["read", "explain", "vocab_save"],
          sentencesExplained: 1,
          vocabSaved: 1,
          startedAt: Date.now() - 60_000,
          lastActivityAt: Date.now(),
        },
      ],
      dailyStats: {
        date: new Date().toISOString().slice(0, 10),
        pagesStudied: 1,
        sentencesExplained: 1,
        vocabSaved: 1,
        vocabReviewed: 0,
      },
    }

    try {
      extCtx = await withExtensionBrowserPage({
        initialUrl: "about:blank",
        waitForExtensionInject: 0,
        storageState: {
          [VOCABULARY_STORAGE_KEY]: vocabularySeed,
          [READING_HISTORY_STORAGE_KEY]: readingHistorySeed,
          [STUDY_PROGRESS_STORAGE_KEY]: studyProgressSeed,
        },
      })

      const consoleErrors: string[] = []
      extCtx.page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text())
      })

      const vocabularyUrl = `chrome-extension://${extCtx.extensionId}/vocabulary.html?tab=reading`
      await extCtx.page.goto(vocabularyUrl, { waitUntil: "domcontentloaded", timeout: 15_000 })

      await extCtx.page.waitForSelector("button", { timeout: 10_000 })

      const readingTabOpened = await extCtx.page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll("button"))
        return buttons.some((b) => (b.textContent ?? "").includes("Reading"))
      })

      const vocabularyOpened = await extCtx.page.evaluate(() => {
        const body = document.body.innerText
        return body.includes("Revisit pages") || body.includes("Recent")
      })

      const openButtonEnabled = await extCtx.page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll("button")).find(
          (b) => (b.textContent ?? "").trim() === "Open",
        ) as HTMLButtonElement | undefined
        return !!btn && !btn.disabled
      })

      const pagesBefore = extCtx.context.pages().length
      await extCtx.page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll("button")).find(
          (b) => (b.textContent ?? "").trim() === "Open",
        ) as HTMLButtonElement | undefined
        btn?.click()
      })

      await sleep(800)
      const pagesAfter = extCtx.context.pages()
      const newPage = pagesAfter.find((p) => !p.url().startsWith("chrome-extension://"))
      const newTabUrlMatchesFixture = newPage
        ? newPage.url().startsWith(`${fixtureServer.origin}/`)
        : false

      const screenshotPath = path.join(artifactDir, "learning-loop-revisit-smoke.png")
      await extCtx.page.screenshot({ path: screenshotPath, fullPage: true })
      const snapshotPath = path.join(artifactDir, "learning-loop-revisit-smoke.snapshot.html")
      await writeFile(snapshotPath, await extCtx.page.content(), "utf8")

      runtime.attachArtifact("revisitSmoke", {
        screenshotPath,
        snapshotPath,
        consoleErrors,
        fixtureUrl,
      })
      runtime.complete("Learning-loop revisit smoke finished.")

      const snapshot = runtime.snapshot()
      const revisit = {
        fixtureOrigin: fixtureServer.origin,
        vocabularyOpened,
        readingTabOpened,
        openButtonEnabled,
        newTabUrlMatchesFixture,
        consoleErrors,
      }

      return {
        status: snapshot.status,
        summary: newTabUrlMatchesFixture
          ? "Revisit smoke: Open from Reading queue launched fixture URL."
          : "Revisit smoke: could not confirm new tab navigated to fixture origin.",
        notes: [
          `fixtureOrigin=${fixtureServer.origin}`,
          `vocabularyOpened=${vocabularyOpened}`,
          `readingTabOpened=${readingTabOpened}`,
          `openButtonEnabled=${openButtonEnabled}`,
          `newTabUrlMatchesFixture=${newTabUrlMatchesFixture}`,
          `newTabUrl=${newPage?.url() ?? "none"}`,
          `tabsBefore=${pagesBefore} tabsAfter=${pagesAfter.length}`,
        ],
        artifacts: {
          browserExecutablePath: extCtx.browserExecutablePath,
          extensionPath: extCtx.extensionPath,
          screenshotPath,
          snapshotPath,
        },
        runtime: snapshot,
        startedAt: snapshot.startedAt,
        finishedAt: snapshot.finishedAt,
        revisit,
      }
    } catch (error) {
      if (error instanceof LiveBrowserUnavailableError) {
        runtime.skip(error.message)
        const snapshot = runtime.snapshot()
        return {
          status: snapshot.status,
          summary: "No supported browser executable available.",
          notes: [error.message],
          artifacts: { browserAvailability: "missing" },
          runtime: snapshot,
          startedAt: snapshot.startedAt,
          finishedAt: snapshot.finishedAt,
          revisit: {
            fixtureOrigin: fixtureServer.origin,
            vocabularyOpened: false,
            readingTabOpened: false,
            openButtonEnabled: false,
            newTabUrlMatchesFixture: false,
            consoleErrors: [],
          },
        }
      }

      if (error instanceof ExtensionBuildNotFoundError) {
        runtime.skip(error.message)
        const snapshot = runtime.snapshot()
        return {
          status: snapshot.status,
          summary: "Extension build not found. Run pnpm build first.",
          notes: [error.message],
          artifacts: { extensionBuild: "missing" },
          runtime: snapshot,
          startedAt: snapshot.startedAt,
          finishedAt: snapshot.finishedAt,
          revisit: {
            fixtureOrigin: fixtureServer.origin,
            vocabularyOpened: false,
            readingTabOpened: false,
            openButtonEnabled: false,
            newTabUrlMatchesFixture: false,
            consoleErrors: [],
          },
        }
      }

      throw error
    } finally {
      await extCtx?.close()
      await fixtureServer.close().catch(() => undefined)
    }
  },

  evaluate(execution, context) {
    const revisit = execution.revisit ?? {
      fixtureOrigin: "",
      vocabularyOpened: false,
      readingTabOpened: false,
      openButtonEnabled: false,
      newTabUrlMatchesFixture: false,
      consoleErrors: [] as string[],
    }

    const issues: string[] = []
    const nextActions: string[] = []

    if (!revisit.vocabularyOpened) {
      issues.push("Vocabulary / reading UI did not appear to load.")
      nextActions.push("Check vocabulary.html bootstrap and VocabularyApp tab rendering.")
    }
    if (!revisit.readingTabOpened) {
      issues.push("Reading tab was not found in the vocabulary shell.")
      nextActions.push("Verify VocabularyApp exposes a Reading tab button.")
    }
    if (!revisit.openButtonEnabled) {
      issues.push("Open button was missing or disabled on the reading queue.")
      nextActions.push("Check owned-reading sync from reading history and article Open preconditions.")
    }
    if (!revisit.newTabUrlMatchesFixture) {
      issues.push("New tab did not navigate to the expected fixture origin.")
      nextActions.push("Verify browser.tabs.create receives the reading history URL.")
    }
    if (revisit.consoleErrors.length > 0) {
      issues.push(`${revisit.consoleErrors.length} console error(s) captured.`)
    }

    const pass = revisit.openButtonEnabled && revisit.newTabUrlMatchesFixture && revisit.consoleErrors.length === 0

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
      score: pass ? 100 : 0,
      summary: pass
        ? "Revisit smoke passed: Reading queue Open launches the article URL."
        : "Revisit smoke failed: reading queue reopen path incomplete.",
      issues,
      nextActions,
      notes: execution.notes ?? [],
      rubrics: [],
      artifacts: execution.artifacts ?? {},
      runtime: context.runtime,
    } as unknown as Partial<LiveEvaluationResult>
  },
}
