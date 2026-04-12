import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

import type { HoverExecution } from "../../bench/evaluators/hover"
import {
  withLiveBrowserPage,
  LiveBrowserUnavailableError,
} from "../driver"
import type { LiveScenarioDefinition, LiveScenarioExecution } from "../evaluator"
import { buildLiveHoverEvaluation } from "./helpers/hover"

interface LiveHoverTranslationExecution extends LiveScenarioExecution {
  hover?: HoverExecution
}

const FIXTURE_NAME = "hover-translation-basic"
const HOST_ID = "astra-hover-translate-host"
const TRANSLATED_PREFIX = "ZH:"

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

export const hoverTranslationBasicScenario: LiveScenarioDefinition<LiveHoverTranslationExecution> = {
  id: "bench-live/hover-translation-basic",
  title: "Live hover translation basic",
  surface: "hover",
  fixture: `page:${FIXTURE_NAME}`,
  description:
    "Loads a page with inline text in a real browser, simulates Alt-hover on the target phrase, injects the Astra hover overlay contract, and verifies the translated overlay appears with the expected trigger label.",
  tags: ["playwright", "hover", "browser", "contract"],
  async run(runtime, context) {
    runtime.start(context.id, context.title)
    runtime.log("Starting browser-backed hover translation scenario.")

    try {
      const artifactDir = path.join(process.cwd(), "bench-live-results", context.runId)
      await mkdir(artifactDir, { recursive: true })
      const html = buildFixtureHtml()
      const htmlPath = path.join(artifactDir, `${FIXTURE_NAME}.html`)
      await writeFile(htmlPath, html, "utf8")

      const capture = await withLiveBrowserPage(async (page, browserExecutablePath) => {
        await page.setContent(html, { waitUntil: "domcontentloaded" })
        await page.waitForSelector("#target", { timeout: 10_000 })

        const baselineScreenshotPath = path.join(artifactDir, `${FIXTURE_NAME}.baseline.png`)
        await page.screenshot({ path: baselineScreenshotPath, fullPage: true })

        const runtimeScript = await readFile(new URL("./helpers/hover-runtime.js", import.meta.url), "utf8")
        await page.addScriptTag({ content: runtimeScript })

        const execution = await page.evaluate(async ({ hostId, translatedPrefix }) => {
          return await (window as typeof window & {
            __astraHoverRuntime?: {
              runBasic: (options: { hostId: string; translatedPrefix: string }) => Promise<unknown>
            }
          }).__astraHoverRuntime!.runBasic({ hostId, translatedPrefix })
        }, { hostId: HOST_ID, translatedPrefix: TRANSLATED_PREFIX }) as HoverExecution | { error: string }

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
        }
      })

      if ("error" in capture.execution) {
        throw new Error(String(capture.execution.error))
      }

      runtime.attachArtifact("hoverTranslationCapture", {
        htmlPath: capture.htmlPath,
        baselineScreenshotPath: capture.baselineScreenshotPath,
        translatedScreenshotPath: capture.translatedScreenshotPath,
        snapshotHtmlPath: capture.snapshotHtmlPath,
      })
      runtime.attachArtifact("browser", { executablePath: capture.browserExecutablePath })
      runtime.complete("Completed live hover translation basic scenario.")

      return {
        status: "completed",
        summary: "Executed the live hover translation scenario in a real browser.",
        notes: [
          `Artifact directory: ${artifactDir}`,
          `Browser executable: ${capture.browserExecutablePath}`,
          `Hover request count: ${capture.execution.requestCount}`,
        ],
        artifacts: {
          artifactDir,
          htmlPath: capture.htmlPath,
          baselineScreenshotPath: capture.baselineScreenshotPath,
          translatedScreenshotPath: capture.translatedScreenshotPath,
          snapshotHtmlPath: capture.snapshotHtmlPath,
        },
        runtime: runtime.snapshot(),
        startedAt: runtime.snapshot().startedAt,
        finishedAt: runtime.snapshot().finishedAt,
        hover: capture.execution,
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
    }
  },
  async evaluate(execution, context) {
    return buildLiveHoverEvaluation(execution, context.runId, context.scenario, context.runtime, {
      expected: {
        shouldRequest: true,
        shouldShowOverlay: true,
        expectedTriggerLabel: "Alt + Hover",
        expectedTask: "translate",
        maxLatencyMs: 500,
      },
      successSummary: "Live hover translation passed: Alt-hover rendered a bilingual overlay for the target phrase in a real browser.",
      failureSummary: "Live hover translation failed: the overlay or request behavior diverged from the Astra hover contract.",
    })
  },
}
