import { createServer } from "node:http"
import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import type { HoverExecution } from "../../bench/evaluators/hover"
import {
  prepareLiveArtifactDir,
  withLiveBrowserPage,
  LiveBrowserUnavailableError,
} from "../driver"
import type { LiveScenarioDefinition, LiveScenarioExecution } from "../evaluator"
import { buildLiveHoverEvaluation } from "./helpers/hover"

interface LiveHoverTranslationExecution extends LiveScenarioExecution {
  hover?: HoverExecution
}

interface RelayTranslateRequest {
  provider?: string
  model?: string
  texts?: string[]
  targetLang?: string
  task?: string
  context?: {
    pageTitle?: string
    pageUrl?: string
    hostname?: string
    selectionContext?: string
  }
}

const FIXTURE_NAME = "hover-translation-basic"
const HOST_ID = "astra-hover-translate-host"
const TRANSLATED_PREFIX = "ZH:"
const PAGE_HOST = "127.0.0.1"
const HOVER_RUNTIME_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), "helpers", "hover-runtime.js")

function buildFixtureHtml() {
  return [
    "<!doctype html>",
    "<html>",
    "<head>",
    '  <meta charset="utf-8" />',
    "  <title>Astra Hover Translation Basic</title>",
    "  <style>",
    "    body { font-family: system-ui, sans-serif; margin: 24px auto; max-width: 760px; line-height: 1.7; color: #0f172a; }",
    "    main { display: grid; gap: 20px; }",
    "    p { margin: 0; }",
    "    .target { display: inline; background: #f8fafc; padding: 2px 4px; border-radius: 6px; }",
    "    .note { color: #475569; font-size: 0.95rem; }",
    "  </style>",
    "</head>",
    "<body>",
    "  <main>",
    "    <article>",
    "      <h1>Hover translation fixture</h1>",
    "      <p class=\"note\">Hold Alt while moving across the highlighted phrase to trigger Astra hover translation.</p>",
    "      <p id=\"container\">The highlighted phrase <span id=\"target\" class=\"target\">hello world from Astra</span> should render a bilingual hover overlay.</p>",
    "    </article>",
    "  </main>",
    "</body>",
    "</html>",
  ].join("\n")
}

async function createHoverRelayServer() {
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

        res.writeHead(200, {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          Connection: "close",
        })
        res.end(JSON.stringify({ translations: [`${TRANSLATED_PREFIX}${sourceText}`] }))
      })
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
    throw new Error("Hover live relay did not expose a TCP port.")
  }

  return {
    origin: `http://${PAGE_HOST}:${address.port}`,
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

export const hoverTranslationBasicScenario: LiveScenarioDefinition<LiveHoverTranslationExecution> = {
  id: "bench-live/hover-translation-basic",
  title: "Live hover translation basic",
  surface: "hover",
  fixture: `page:${FIXTURE_NAME}`,
  description:
    "Loads a page with inline text in a real browser, simulates Alt-hover on the target phrase, posts one translate request to a local relay stub, and verifies the translated overlay appears with the expected trigger label.",
  tags: ["playwright", "hover", "browser", "contract"],
  async run(runtime, context) {
    runtime.start(context.id, context.title)
    runtime.log("Starting browser-backed hover translation scenario.")

    const relayServer = await createHoverRelayServer()

    try {
      const artifactDir = await prepareLiveArtifactDir(context.runId)
      const html = buildFixtureHtml()
      const htmlPath = path.join(artifactDir, `${FIXTURE_NAME}.html`)
      await writeFile(htmlPath, html, "utf8")

      const capture = await withLiveBrowserPage(async (page, browserExecutablePath) => {
        const consoleErrors: string[] = []
        page.on("console", (msg) => {
          if (msg.type() === "error") {
            consoleErrors.push(msg.text())
          }
        })

        await page.setContent(html, { waitUntil: "domcontentloaded" })
        await page.waitForSelector("#target", { timeout: 10_000 })

        const baselineScreenshotPath = path.join(artifactDir, `${FIXTURE_NAME}.baseline.png`)
        await page.screenshot({ path: baselineScreenshotPath, fullPage: true })

        const runtimeScript = await readFile(HOVER_RUNTIME_PATH, "utf8")
        await page.addScriptTag({ content: runtimeScript })

        const execution = await page.evaluate(async ({ hostId, translatedPrefix, relayUrl }) => {
          return await (window as typeof window & {
            __astraHoverRuntime?: {
              runBasic: (options: { hostId: string; translatedPrefix: string; relayUrl: string }) => Promise<unknown>
            }
          }).__astraHoverRuntime!.runBasic({ hostId, translatedPrefix, relayUrl })
        }, {
          hostId: HOST_ID,
          translatedPrefix: TRANSLATED_PREFIX,
          relayUrl: `${relayServer.origin}/translate`,
        }) as HoverExecution | { error: string }

        const translatedScreenshotPath = path.join(artifactDir, `${FIXTURE_NAME}.translated.png`)
        await page.screenshot({ path: translatedScreenshotPath, fullPage: true })
        const snapshotHtml = await page.content()
        const snapshotHtmlPath = path.join(artifactDir, `${FIXTURE_NAME}.snapshot.html`)
        await writeFile(snapshotHtmlPath, snapshotHtml, "utf8")

        return {
          browserExecutablePath,
          baselineScreenshotPath,
          translatedScreenshotPath,
          snapshotHtmlPath,
          execution,
          htmlPath,
          consoleErrors,
        }
      })

      if ("error" in capture.execution) {
        throw new Error(String(capture.execution.error))
      }

      const request = relayServer.translateRequests[0]
      const hover: HoverExecution = {
        ...capture.execution,
        requestCount: relayServer.translateRequests.length,
        payloadSelectionContext: request?.context?.selectionContext ?? capture.execution.payloadSelectionContext,
        payloadTask: request?.task ?? capture.execution.payloadTask,
      }

      runtime.attachArtifact("hoverTranslationCapture", {
        htmlPath: capture.htmlPath,
        baselineScreenshotPath: capture.baselineScreenshotPath,
        translatedScreenshotPath: capture.translatedScreenshotPath,
        snapshotHtmlPath: capture.snapshotHtmlPath,
        relayOrigin: relayServer.origin,
        relayRequests: relayServer.translateRequests,
        consoleErrors: capture.consoleErrors,
      })
      runtime.attachArtifact("browser", { executablePath: capture.browserExecutablePath })
      runtime.complete("Completed live hover translation basic scenario.")

      return {
        status: "completed",
        summary: "Executed the live hover translation scenario in a real browser.",
        notes: [
          `Artifact directory: ${artifactDir}`,
          `Browser executable: ${capture.browserExecutablePath}`,
          `Hover request count: ${relayServer.translateRequests.length}`,
          `Console errors: ${capture.consoleErrors.length}`,
        ],
        artifacts: {
          artifactDir,
          browserExecutablePath: capture.browserExecutablePath,
          htmlPath: capture.htmlPath,
          baselineScreenshotPath: capture.baselineScreenshotPath,
          translatedScreenshotPath: capture.translatedScreenshotPath,
          snapshotHtmlPath: capture.snapshotHtmlPath,
          relayOrigin: relayServer.origin,
          relayRequests: relayServer.translateRequests,
          consoleErrors: capture.consoleErrors,
        },
        runtime: runtime.snapshot(),
        startedAt: runtime.snapshot().startedAt,
        finishedAt: runtime.snapshot().finishedAt,
        hover,
      }
    } catch (error) {
      if (error instanceof LiveBrowserUnavailableError) {
        runtime.skip(error.message)
        const snapshot = runtime.snapshot()
        return {
          status: snapshot.status,
          summary: "The live hover translation scenario is wired, but no supported local browser executable is available in this environment.",
          notes: [error.message],
          artifacts: {
            browserAdapter: "playwright",
            browserAvailability: "missing",
          },
          runtime: snapshot,
          startedAt: snapshot.startedAt,
          finishedAt: snapshot.finishedAt,
        }
      }

      throw error
    } finally {
      await relayServer.close()
    }
  },
  async evaluate(execution, context) {
    const consoleErrors = Array.isArray((execution.artifacts as { consoleErrors?: string[] } | undefined)?.consoleErrors)
      ? ((execution.artifacts as { consoleErrors?: string[] }).consoleErrors ?? []).map((message) => `browser console error (${message})`)
      : []

    return buildLiveHoverEvaluation(execution, context.runId, context.scenario, context.runtime, {
      expected: {
        shouldRequest: true,
        shouldShowOverlay: true,
        expectedTriggerLabel: "Alt + Hover",
        expectedTask: "translate",
        maxLatencyMs: 500,
      },
      successSummary: "Live hover translation passed: Alt-hover issued one translate request and rendered a bilingual overlay in a real browser.",
      failureSummary: "Live hover translation failed: the overlay or request behavior diverged from the Astra hover contract.",
      extraIssues: consoleErrors,
    })
  },
}
