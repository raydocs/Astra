import { createServer, type Server } from "node:http"
import { writeFile } from "node:fs/promises"
import path from "node:path"

import type { Page } from "playwright"

import {
  prepareLiveArtifactDir,
  withExtensionBrowserPage,
  LiveBrowserUnavailableError,
  ExtensionBuildNotFoundError,
  type ExtensionBrowserContext,
} from "../driver"
import type { LiveEvaluationResult, LiveScenarioDefinition, LiveScenarioExecution, LiveScenarioMetadata } from "../evaluator"

const PAGE_HOST = "127.0.0.1"
const VOCABULARY_STORAGE_KEY = "astra.vocabulary.v1"
const SELECTED_TEXT = "selection save review proof phrase"
const PAGE_TITLE = "Selection save review proof"

interface VocabularyEntrySnapshot {
  id?: string
  text?: string
  url?: string
  context?: string
  sourceContext?: {
    surface?: string
    pageTitle?: string
    pageUrl?: string
    sentenceText?: string
    languageLevel?: string
    explainMode?: string
  }
}

interface SelectionSaveReviewProof {
  fixtureUrl: string
  contentMessageOk: boolean
  storageEntryFound: boolean
  sourceContextSurface: string | null
  sourceContextPageTitle: string | null
  sourceContextSentenceText: string | null
  reviewUrlOpened: boolean
  reviewEntryVisible: boolean
  reviewUiVisible: boolean
  consoleErrors: string[]
}

interface SelectionSaveReviewExecution extends LiveScenarioExecution {
  selectionSaveReview?: SelectionSaveReviewProof
}

async function createFixtureServer(): Promise<{ origin: string; url: string; close: () => Promise<void> }> {
  const server: Server = createServer((req, res) => {
    const requestUrl = new URL(req.url ?? "/", `http://${PAGE_HOST}`)
    if (req.method === "GET" && requestUrl.pathname === "/selection-save-review") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", Connection: "close" })
      res.end(`<!doctype html>
<html>
<head><meta charset="utf-8"><title>${PAGE_TITLE}</title></head>
<body>
  <main>
    <h1>${PAGE_TITLE}</h1>
    <p id="target">${SELECTED_TEXT}</p>
  </main>
</body>
</html>`)
      return
    }
    if (req.method === "GET" && requestUrl.pathname === "/favicon.ico") {
      res.writeHead(204, { Connection: "close" })
      res.end()
      return
    }
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", Connection: "close" })
    res.end("Not found")
  })

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject)
    server.listen(0, PAGE_HOST, () => resolve())
  })

  const address = server.address()
  if (!address || typeof address === "string") {
    throw new Error("Selection save live server did not expose a TCP port.")
  }
  const origin = `http://${PAGE_HOST}:${address.port}`
  return {
    origin,
    url: `${origin}/selection-save-review`,
    async close() {
      server.closeAllConnections?.()
      server.closeIdleConnections?.()
      await new Promise<void>((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve())
      })
    },
  }
}

async function readVocabularyEntries(page: Page): Promise<VocabularyEntrySnapshot[]> {
  return await page.evaluate(async ({ storageKey }) => {
    const extensionApi = (globalThis as typeof globalThis & { chrome: any }).chrome
    const raw = await extensionApi.storage.local.get(storageKey)
    return raw[storageKey] ?? []
  }, { storageKey: VOCABULARY_STORAGE_KEY }) as VocabularyEntrySnapshot[]
}

async function waitForSavedVocabularyEntry(page: Page, selectedText: string): Promise<{
  entries: VocabularyEntrySnapshot[]
  entry: VocabularyEntrySnapshot | undefined
}> {
  const deadline = Date.now() + 5_000
  let entries: VocabularyEntrySnapshot[] = []

  do {
    entries = await readVocabularyEntries(page)
    const entry = entries.find((candidate) => candidate.text === selectedText)
    if (entry) return { entries, entry }
    await page.waitForTimeout(200)
  } while (Date.now() < deadline)

  return { entries, entry: entries.find((candidate) => candidate.text === selectedText) }
}

function emptyProof(fixtureUrl = ""): SelectionSaveReviewProof {
  return {
    fixtureUrl,
    contentMessageOk: false,
    storageEntryFound: false,
    sourceContextSurface: null,
    sourceContextPageTitle: null,
    sourceContextSentenceText: null,
    reviewUrlOpened: false,
    reviewEntryVisible: false,
    reviewUiVisible: false,
    consoleErrors: [],
  }
}

export const selectionSaveReviewLoopScenario: LiveScenarioDefinition<SelectionSaveReviewExecution> = {
  id: "bench-live/selection-save-review-loop",
  title: "Live selection save to Review loop",
  surface: "selection-review",
  fixture: "page:selection-save-review",
  description:
    "Loads the real extension on a fixture page, sends the same content/save-selection command used by the context-menu save action, verifies vocabulary sourceContext, and opens focused Review for the saved entry.",
  tags: ["playwright", "selection", "review", "vocabulary", "extension-loaded", "proof"],
  async run(runtime, context) {
    runtime.start(context.id, context.title)
    runtime.log("Starting selection save-to-Review live proof.")

    const fixture = await createFixtureServer()
    const artifactDir = await prepareLiveArtifactDir(context.runId)
    let extCtx: ExtensionBrowserContext | null = null

    try {
      extCtx = await withExtensionBrowserPage({
        initialUrl: fixture.url,
        waitForExtensionInject: 8_000,
      })

      const consoleErrors: string[] = []
      extCtx.page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text())
      })

      await extCtx.page.waitForSelector("#target", { timeout: 10_000 })
      await extCtx.page.evaluate(() => {
        const target = document.getElementById("target")
        if (!target) return
        const range = document.createRange()
        range.selectNodeContents(target)
        const selection = window.getSelection()
        selection?.removeAllRanges()
        selection?.addRange(range)
      })

      const controlPage = await extCtx.context.newPage()
      await controlPage.goto(`chrome-extension://${extCtx.extensionId}/vocabulary.html`, { waitUntil: "domcontentloaded", timeout: 15_000 })

      const contentResponse = await controlPage.evaluate(async ({ fixtureUrl, selectedText }) => {
        const extensionApi = (globalThis as typeof globalThis & { chrome: any }).chrome
        const tabs = await extensionApi.tabs.query({})
        const targetTab = tabs.find((tab: { id?: number; url?: string }) => tab.url === fixtureUrl)
        if (!targetTab?.id) return { ok: false, reason: "target-tab-missing" }
        return await extensionApi.tabs.sendMessage(targetTab.id, {
          type: "content/save-selection",
          payload: { text: selectedText },
        })
      }, { fixtureUrl: fixture.url, selectedText: SELECTED_TEXT }) as { ok?: boolean; reason?: string }

      const { entries, entry } = await waitForSavedVocabularyEntry(controlPage, SELECTED_TEXT)
      const entryId = entry?.id ?? ""

      const reviewUrl = `chrome-extension://${extCtx.extensionId}/vocabulary.html?tab=review${entryId ? `&entryId=${encodeURIComponent(entryId)}` : ""}`
      await controlPage.goto(reviewUrl, { waitUntil: "domcontentloaded", timeout: 15_000 })
      await controlPage.waitForSelector("body", { timeout: 10_000 })
      await controlPage.waitForTimeout(800)

      const reviewSignals = await controlPage.evaluate(({ selectedText }) => {
        const body = document.body.innerText
        const buttons = Array.from(document.querySelectorAll("button"))
          .map((button) => button.textContent?.trim().toLowerCase() ?? "")
        return {
          reviewEntryVisible: body.includes(selectedText),
          reviewUiVisible: body.toLowerCase().includes("review")
            || buttons.some((label) => ["again", "hard", "good", "easy", "show answer"].some((expected) => label.includes(expected))),
        }
      }, { selectedText: SELECTED_TEXT }) as { reviewEntryVisible: boolean; reviewUiVisible: boolean }

      const screenshotPath = path.join(artifactDir, "selection-save-review-loop.png")
      await controlPage.screenshot({ path: screenshotPath, fullPage: true })
      const snapshotHtmlPath = path.join(artifactDir, "selection-save-review-loop.snapshot.html")
      await writeFile(snapshotHtmlPath, await controlPage.content(), "utf8")

      const proof: SelectionSaveReviewProof = {
        fixtureUrl: fixture.url,
        contentMessageOk: contentResponse?.ok === true || (contentResponse == null && !!entry),
        storageEntryFound: !!entry,
        sourceContextSurface: entry?.sourceContext?.surface ?? null,
        sourceContextPageTitle: entry?.sourceContext?.pageTitle ?? null,
        sourceContextSentenceText: entry?.sourceContext?.sentenceText ?? null,
        reviewUrlOpened: controlPage.url().includes("/vocabulary.html?tab=review") && (entryId ? controlPage.url().includes(`entryId=${encodeURIComponent(entryId)}`) : false),
        reviewEntryVisible: reviewSignals.reviewEntryVisible,
        reviewUiVisible: reviewSignals.reviewUiVisible,
        consoleErrors,
      }

      runtime.attachArtifact("selectionSaveReview", {
        ...proof,
        screenshotPath,
        snapshotHtmlPath,
        entryId,
        contentResponse: contentResponse ?? null,
        entryCount: entries.length,
      })
      runtime.attachArtifact("browser", {
        executablePath: extCtx.browserExecutablePath,
        extensionPath: extCtx.extensionPath,
      })
      runtime.complete("Selection save-to-Review live proof completed.")
      const snapshot = runtime.snapshot()

      return {
        status: snapshot.status,
        summary: proof.storageEntryFound
          ? "Selection save-to-Review proof saved a vocabulary entry and opened focused Review."
          : "Selection save-to-Review proof did not find the saved vocabulary entry.",
        notes: [
          `fixtureUrl=${fixture.url}`,
          `contentMessageOk=${proof.contentMessageOk}`,
          `storageEntryFound=${proof.storageEntryFound}`,
          `sourceContextSurface=${proof.sourceContextSurface}`,
          `reviewEntryVisible=${proof.reviewEntryVisible}`,
        ],
        artifacts: {
          browserExecutablePath: extCtx.browserExecutablePath,
          extensionPath: extCtx.extensionPath,
          screenshotPath,
          snapshotHtmlPath,
          entryId,
        },
        runtime: snapshot,
        startedAt: snapshot.startedAt,
        finishedAt: snapshot.finishedAt,
        selectionSaveReview: proof,
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
          selectionSaveReview: emptyProof(fixture.url),
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
          selectionSaveReview: emptyProof(fixture.url),
        }
      }

      throw error
    } finally {
      await extCtx?.close()
      await fixture.close()
    }
  },
  evaluate(execution, context) {
    const proof = execution.selectionSaveReview ?? emptyProof()
    const issues: string[] = []
    const nextActions: string[] = []

    if (!proof.contentMessageOk) issues.push("content/save-selection message did not return ok.")
    if (!proof.storageEntryFound) issues.push("Saved vocabulary entry was not found in extension storage.")
    if (proof.sourceContextSurface !== "selection_toolbar") issues.push("Saved entry sourceContext.surface was not selection_toolbar.")
    if (proof.sourceContextPageTitle !== PAGE_TITLE) issues.push("Saved entry did not preserve the page title in sourceContext.")
    if (proof.sourceContextSentenceText !== SELECTED_TEXT) issues.push("Saved entry did not preserve selected sentence text in sourceContext.")
    if (!proof.reviewUrlOpened) issues.push("Focused Review URL did not open for the saved entry.")
    if (!proof.reviewEntryVisible) issues.push("Review UI did not show the saved selection text.")
    if (!proof.reviewUiVisible) issues.push("Review UI controls or review state were not visible.")
    if (proof.consoleErrors.length > 0) issues.push(`${proof.consoleErrors.length} console error(s) captured during selection save proof.`)

    if (issues.length > 0) {
      nextActions.push("Inspect content/save-selection messaging, vocabulary storage sourceContext, and ReviewMode focused entry loading.")
    }

    const skipped = execution.status === "skipped"
    const pass = !skipped && issues.length === 0
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
      status: skipped ? "skipped" : pass ? "pass" : "fail",
      pass,
      score: pass ? 100 : 0,
      summary: pass
        ? "Selection save-to-Review proof passed: content command saved the selection with sourceContext and focused Review displayed it."
        : "Selection save-to-Review proof failed.",
      issues: skipped ? [] : issues,
      nextActions: skipped ? [] : nextActions,
      notes: execution.notes ?? [],
      rubrics: [],
      artifacts: {
        browserArtifacts: execution.artifacts ?? {},
        selectionSaveReview: proof,
      },
      runtime: context.runtime,
    } as unknown as Partial<LiveEvaluationResult>
  },
}
