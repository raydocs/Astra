import { createServer } from "node:http"
import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import type { SelectionExplainExecution } from "../../bench/evaluators/selection-explain"
import {
  prepareLiveArtifactDir,
  materializeFixturePage,
  withLiveBrowserPage,
  LiveBrowserUnavailableError,
} from "../driver"
import type { LiveScenarioDefinition, LiveScenarioExecution } from "../evaluator"
import { buildLiveSelectionExplainEvaluation } from "./helpers/selection-explain"

const FIXTURE_NAME = "selection-explain-basic"
const TOOLBAR_HOST_ID = "astra-selection-toolbar-host"
const PAGE_HOST = "127.0.0.1"
const SELECTION_RUNTIME_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), "helpers", "selection-explain-runtime.js")

interface RelayTranslateRequest {
  provider?: string
  model?: string
  texts?: string[]
  targetLang?: string
  sourceLang?: string
  context?: {
    pageTitle?: string
    pageUrl?: string
    hostname?: string
    metaDescription?: string
    contentSummary?: string
    selectionContext?: string
  }
  task?: string
  customSystemPrompt?: string
  languageLevel?: string
  explainMode?: string
}

interface SelectionExplainCapture {
  buttonLabels: string[]
  resultText: string
  selectedText: string
}

interface LiveSelectionExplainScenarioExecution extends LiveScenarioExecution {
  selectionExplain?: SelectionExplainExecution
}

async function createSelectionExplainServer() {
  const translateRequests: RelayTranslateRequest[] = []

  const server = createServer((req, res) => {
    const requestUrl = new URL(req.url ?? "/", `http://${PAGE_HOST}`)

    if (req.method === "OPTIONS" && requestUrl.pathname === "/translate") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        Connection: "close",
      })
      res.end()
      return
    }

    if (req.method === "POST" && requestUrl.pathname === "/translate") {
      const chunks: Buffer[] = []
      req.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
      req.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf8")
        const payload = JSON.parse(raw) as RelayTranslateRequest
        translateRequests.push(payload)

        const sourceText = payload.texts?.[0]?.trim() ?? ""
        const selectionContext = payload.context?.selectionContext?.trim() ?? ""
        const responseText = payload.task === "explain"
          ? `EXPLAIN:${sourceText} | CONTEXT:${selectionContext}`
          : `ZH:${sourceText}`

        res.writeHead(200, {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          Connection: "close",
        })
        res.end(JSON.stringify({ translations: [responseText] }))
      })
      return
    }

    if (req.method === "GET" && requestUrl.pathname === "/favicon.ico") {
      res.writeHead(204, { Connection: "close" })
      res.end()
      return
    }

    res.writeHead(404, {
      "Content-Type": "text/plain; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      Connection: "close",
    })
    res.end("Not found")
  })

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject)
    server.listen(0, PAGE_HOST, () => resolve())
  })

  const address = server.address()
  if (!address || typeof address === "string") {
    throw new Error("Selection explain live server did not expose a TCP port.")
  }

  const origin = `http://${PAGE_HOST}:${address.port}`

  return {
    origin,
    translateRequests,
    async close() {
      server.closeAllConnections?.()
      server.closeIdleConnections?.()
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()))
      })
    },
  }
}

export const selectionExplainBasicScenario: LiveScenarioDefinition<LiveSelectionExplainScenarioExecution> = {
  id: "bench-live/selection-explain-basic",
  title: "Live selection explain basic",
  surface: "selection-explain",
  fixture: `page:${FIXTURE_NAME}`,
  description:
    "Loads a real browser fixture, performs a real DOM text selection, runs the selection toolbar contract in Shadow DOM, posts one explain request to a local relay stub, and verifies the contextual result is rendered.",
  tags: ["playwright", "selection-explain", "browser", "contract"],
  async run(runtime, context) {
    runtime.start(context.id, context.title)
    runtime.log("Starting browser-backed selection explain scenario.", {
      fixture: FIXTURE_NAME,
    })

    const fixturePage = await materializeFixturePage({
      runId: context.runId,
      fixtureName: FIXTURE_NAME,
      title: context.title,
    })
    const selectionServer = await createSelectionExplainServer()

    try {
      const artifactDir = await prepareLiveArtifactDir(context.runId)
      const html = await readFile(fixturePage.htmlPath, "utf8")

      const capture = await withLiveBrowserPage(async (page, browserExecutablePath) => {
        const consoleErrors: string[] = []
        page.on("console", (msg) => {
          if (msg.type() === "error") {
            consoleErrors.push(msg.text())
          }
        })

        await page.setContent(html, { waitUntil: "domcontentloaded" })
        await page.waitForSelector("#target", { timeout: 10_000 })

        const baselineScreenshotPath = path.join(artifactDir, `${FIXTURE_NAME}.selection-explain.baseline.png`)
        await page.screenshot({
          path: baselineScreenshotPath,
          fullPage: true,
        })

        const runtimeScript = await readFile(SELECTION_RUNTIME_PATH, "utf8")
        await page.addScriptTag({ content: runtimeScript })

        const execution = await page.evaluate(async ({ hostId, relayUrl }) => {
          return await (window as typeof window & {
            __astraSelectionRuntime?: {
              runBasic: (options: { hostId: string; relayUrl: string }) => Promise<unknown>
            }
          }).__astraSelectionRuntime!.runBasic({ hostId, relayUrl })
        }, {
          hostId: TOOLBAR_HOST_ID,
          relayUrl: `${selectionServer.origin}/translate`,
        }) as SelectionExplainCapture | { error: string }

        if ("error" in execution) {
          throw new Error(String(execution.error))
        }

        const highlightedScreenshotPath = path.join(artifactDir, `${FIXTURE_NAME}.selection-explain.highlighted.png`)
        await page.screenshot({
          path: highlightedScreenshotPath,
          fullPage: true,
        })

        const snapshotHtml = await page.content()
        const snapshotHtmlPath = path.join(artifactDir, `${FIXTURE_NAME}.selection-explain.snapshot.html`)
        await writeFile(snapshotHtmlPath, snapshotHtml, "utf8")

        return {
          browserExecutablePath,
          baselineScreenshotPath,
          highlightedScreenshotPath,
          snapshotHtmlPath,
          htmlPath: fixturePage.htmlPath,
          consoleErrors,
          execution,
        }
      })

      const request = selectionServer.translateRequests[0]
      const selectionExplain: SelectionExplainExecution = {
        requestCount: selectionServer.translateRequests.length,
        requestTask: request?.task ?? null,
        requestSelectionContext: request?.context?.selectionContext ?? null,
        requestLanguageLevel: request?.languageLevel ?? null,
        requestExplainMode: request?.explainMode ?? null,
        resultText: capture.execution.resultText,
        clipboardWrites: [],
        buttonLabels: capture.execution.buttonLabels,
      }

      runtime.attachArtifact("fixturePage", {
        htmlPath: fixturePage.htmlPath,
      })
      runtime.attachArtifact("browser", {
        executablePath: capture.browserExecutablePath,
      })
      runtime.attachArtifact("selectionExplainCapture", {
        baselineScreenshotPath: capture.baselineScreenshotPath,
        highlightedScreenshotPath: capture.highlightedScreenshotPath,
        snapshotHtmlPath: capture.snapshotHtmlPath,
        requestCount: selectionServer.translateRequests.length,
        requestTask: request?.task ?? null,
        requestSelectionContext: request?.context?.selectionContext ?? null,
        requestLanguageLevel: request?.languageLevel ?? null,
        requestExplainMode: request?.explainMode ?? null,
        selectedText: capture.execution.selectedText,
        consoleErrors: capture.consoleErrors,
      })

      runtime.complete("Browser-backed selection explain scenario completed.")
      const snapshot = runtime.snapshot()

      return {
        status: snapshot.status,
        summary: "Executed the browser-backed selection explain scenario and captured browser artifacts.",
        notes: [
          `Browser executable: ${capture.browserExecutablePath}`,
          `Relay origin: ${selectionServer.origin}`,
          `Selection text: ${capture.execution.selectedText}`,
          `Request count: ${selectionServer.translateRequests.length}`,
          `Console errors: ${capture.consoleErrors.length}`,
        ],
        artifacts: {
          artifactDir,
          browserExecutablePath: capture.browserExecutablePath,
          htmlPath: fixturePage.htmlPath,
          baselineScreenshotPath: capture.baselineScreenshotPath,
          highlightedScreenshotPath: capture.highlightedScreenshotPath,
          snapshotHtmlPath: capture.snapshotHtmlPath,
          relayOrigin: selectionServer.origin,
          relayRequests: selectionServer.translateRequests,
          selectedText: capture.execution.selectedText,
          consoleErrors: capture.consoleErrors,
        },
        runtime: snapshot,
        startedAt: snapshot.startedAt,
        finishedAt: snapshot.finishedAt,
        selectionExplain,
      }
    } catch (error) {
      if (error instanceof LiveBrowserUnavailableError) {
        runtime.skip(error.message)
        const snapshot = runtime.snapshot()
        return {
          status: snapshot.status,
          summary: "No supported browser executable available for selection explain.",
          notes: [error.message],
          artifacts: { browserAvailability: "missing" },
          runtime: snapshot,
          startedAt: snapshot.startedAt,
          finishedAt: snapshot.finishedAt,
        }
      }

      throw error
    } finally {
      await selectionServer.close()
    }
  },
  async evaluate(execution, context) {
    const consoleErrors = Array.isArray((execution.artifacts as { consoleErrors?: string[] } | undefined)?.consoleErrors)
      ? ((execution.artifacts as { consoleErrors?: string[] }).consoleErrors ?? []).map((message) => `browser console error (${message})`)
      : []

    return buildLiveSelectionExplainEvaluation(execution, context.runId, context.scenario, context.runtime, {
      expected: {
        expectedTask: "explain",
        requireContext: true,
        requireExplainProfile: true,
      },
      successSummary: "Live selection explain passed: one explain request carried context/profile and rendered the contextual result in a real browser toolbar.",
      failureSummary: "Live selection explain failed: the request, context, or rendered result diverged from the selection explain contract.",
      extraIssues: consoleErrors,
    })
  },
}
