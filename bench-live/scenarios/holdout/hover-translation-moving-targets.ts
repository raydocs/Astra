import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"

import type { HoverExecution } from "../../../bench/evaluators/hover"
import {
  prepareLiveArtifactDir,
  withLiveBrowserPage,
  LiveBrowserUnavailableError,
} from "../../driver"
import type { LiveScenarioDefinition, LiveScenarioExecution } from "../../evaluator"
import { buildLiveHoverEvaluation } from "../helpers/hover"

interface HoverHoldoutExecution extends LiveScenarioExecution {
  hover?: HoverExecution
  holdout?: {
    dedupedRequestCount: boolean
    overlayInterferenceSuppressed: boolean
    movingTargetRendered: boolean
    rapidTransitionCount: number
  }
}

const FIXTURE_NAME = "hover-translation-moving-targets"
const HOST_ID = "astra-hover-translate-host"
const TRANSLATED_PREFIX = "ZH:"

function buildFixtureHtml() {
  return [
    "<!doctype html>",
    "<html>",
    "<head>",
    '  <meta charset=\"utf-8\" />',
    "  <title>Astra Hover Translation Holdout</title>",
    "  <style>",
    "    body { font-family: system-ui, sans-serif; margin: 24px auto; max-width: 860px; line-height: 1.6; color: #0f172a; }",
    "    #lane { display: flex; gap: 18px; align-items: center; flex-wrap: wrap; margin-top: 28px; }",
    "    .chip { display: inline-flex; align-items: center; justify-content: center; min-width: 140px; padding: 12px 14px; border-radius: 999px; background: #eff6ff; border: 1px solid #93c5fd; font-weight: 600; }",
    "    .decoy { background: #fef3c7; border-color: #fbbf24; }",
    "  </style>",
    "</head>",
    "<body>",
    "  <main>",
    "    <h1>Hover moving-target holdout</h1>",
    "    <p>Rapid pointer motion, moving targets, and overlay interference should not duplicate hover requests.</p>",
    "    <div id=\"lane\">",
    "      <span id=\"target-a\" class=\"chip\">hover source alpha</span>",
    "      <span id=\"target-b\" class=\"chip\">hover source beta</span>",
    "      <span id=\"decoy\" class=\"chip decoy\">overlay interference</span>",
    "    </div>",
    "  </main>",
    "</body>",
    "</html>",
  ].join("\n")
}

export const hoverTranslationMovingTargetsHoldoutScenario: LiveScenarioDefinition<HoverHoldoutExecution> = {
  id: "bench-live/holdout/hover-translation-moving-targets",
  title: "Holdout: hover translation moving targets",
  surface: "hover",
  fixture: `page:${FIXTURE_NAME}`,
  description:
    "Exercises hover translation under rapid pointer movement, moving target layout, and overlay interference to verify request dedupe and tooltip stability.",
  tags: ["playwright", "hover", "browser", "holdout", "moving-targets"],
  async run(runtime, context) {
    runtime.start(context.id, context.title)
    runtime.log("Starting hover moving-target holdout scenario.")

    try {
      const artifactDir = await prepareLiveArtifactDir(context.runId)
      const html = buildFixtureHtml()
      const htmlPath = path.join(artifactDir, `${FIXTURE_NAME}.html`)
      await writeFile(htmlPath, html, "utf8")

      const capture = await withLiveBrowserPage(async (page, browserExecutablePath) => {
        await page.setContent(html, { waitUntil: "domcontentloaded" })
        await page.waitForSelector("#target-a", { timeout: 10_000 })

        const baselineScreenshotPath = path.join(artifactDir, `${FIXTURE_NAME}.baseline.png`)
        await page.screenshot({ path: baselineScreenshotPath, fullPage: true })

        const runtimeScript = await readFile(new URL("../helpers/hover-runtime.js", import.meta.url), "utf8")
        await page.addScriptTag({ content: runtimeScript })

        const execution = await page.evaluate(async ({ hostId, translatedPrefix }) => {
          return await (window as typeof window & {
            __astraHoverRuntime?: {
              runMovingTargets: (options: { hostId: string; translatedPrefix: string }) => Promise<unknown>
            }
          }).__astraHoverRuntime!.runMovingTargets({ hostId, translatedPrefix })
        }, { hostId: HOST_ID, translatedPrefix: TRANSLATED_PREFIX }) as (HoverExecution & { holdout: HoverHoldoutExecution["holdout"] }) | { error: string }

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

      runtime.attachArtifact("hoverHoldoutCapture", {
        htmlPath: capture.htmlPath,
        baselineScreenshotPath: capture.baselineScreenshotPath,
        translatedScreenshotPath: capture.translatedScreenshotPath,
        snapshotHtmlPath: capture.snapshotHtmlPath,
      })
      runtime.attachArtifact("browser", { executablePath: capture.browserExecutablePath })
      runtime.complete("Completed hover moving-target holdout scenario.")

      return {
        status: "completed",
        summary: "Executed the hover moving-target holdout in a real browser.",
        notes: [
          `Artifact directory: ${artifactDir}`,
          `Browser executable: ${capture.browserExecutablePath}`,
          `Holdout request count: ${capture.execution.requestCount}`,
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
        holdout: capture.execution.holdout,
      }
    } catch (error) {
      if (error instanceof LiveBrowserUnavailableError) {
        runtime.skip(error.message)
        const snapshot = runtime.snapshot()
        return {
          status: snapshot.status,
          summary: "The hover moving-target holdout is wired, but no supported local browser executable is available in this environment.",
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
    const extraIssues: string[] = []
    const extraNotes: string[] = []
    const holdout = execution.holdout

    if (!holdout) {
      extraIssues.push("Holdout execution payload was missing.")
    } else {
      if (!holdout.dedupedRequestCount) {
        extraIssues.push("Hover holdout issued duplicate requests under rapid pointer movement.")
      }
      if (!holdout.overlayInterferenceSuppressed) {
        extraIssues.push("Hover holdout allowed overlay interference to trigger extra requests.")
      }
      if (!holdout.movingTargetRendered) {
        extraIssues.push("Hover holdout did not preserve rendering after the target shifted position.")
      }
      extraNotes.push(`holdout.dedupedRequestCount=${holdout.dedupedRequestCount}`)
      extraNotes.push(`holdout.overlayInterferenceSuppressed=${holdout.overlayInterferenceSuppressed}`)
      extraNotes.push(`holdout.movingTargetRendered=${holdout.movingTargetRendered}`)
      extraNotes.push(`holdout.rapidTransitionCount=${holdout.rapidTransitionCount}`)
    }

    return buildLiveHoverEvaluation(execution, context.runId, context.scenario, context.runtime, {
      expected: {
        shouldRequest: true,
        shouldShowOverlay: true,
        expectedTriggerLabel: "Alt + Hover",
        expectedTask: "translate",
        maxLatencyMs: 650,
      },
      successSummary: "Hover moving-target holdout passed: rapid pointer movement, moving targets, and overlay interference preserved a single stable hover translation request.",
      failureSummary: "Hover moving-target holdout failed: the hover overlay duplicated requests or lost stability under movement/interference.",
      extraIssues,
      extraNotes,
    })
  },
}
