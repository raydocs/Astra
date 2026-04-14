import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

import type { Page } from "playwright"

import { buildBilibiliSubtitleFixtureHtml } from "../../bench/scenarios/helpers/bilibili-subtitle"
import {
  prepareLiveArtifactDir,
  withLiveBrowserPage,
  LiveBrowserUnavailableError,
} from "../driver"
import type { LiveEvaluationResult, LiveScenarioDefinition, LiveScenarioExecution } from "../evaluator"

interface LiveBilibiliSubtitleBasicExecution extends LiveScenarioExecution {
  captionPanelFound?: boolean
  firstCaptionLine?: string
}

function buildLiveBilibiliEvaluation(
  execution: LiveBilibiliSubtitleBasicExecution,
  runId: string,
  scenario: LiveEvaluationResult["scenario"],
  runtime: LiveEvaluationResult["runtime"],
) {
  const found = execution.captionPanelFound === true
  const line = (execution.firstCaptionLine ?? "").trim()
  const textOk = line.includes("Bilibili")

  if (execution.status === "skipped") {
    return {
      runId,
      scenario,
      status: "skipped" as const,
      pass: false,
      score: 0,
      summary: execution.summary ?? "Bilibili live subtitle scenario skipped (no browser).",
      issues: [],
      nextActions: ["Install Chromium for Playwright or run on a machine with a supported browser."],
      notes: execution.notes ?? [],
      rubrics: [],
      artifacts: { execution },
      runtime,
    } as unknown as Partial<LiveEvaluationResult>
  }

  const pass = found && textOk
  return {
    runId,
    scenario,
    status: pass ? ("pass" as const) : ("fail" as const),
    pass,
    score: pass ? 100 : found ? 50 : 0,
    summary: pass
      ? "Bilibili-shaped subtitle panel rendered and first caption line matched fixture."
      : "Bilibili live fixture did not expose expected caption text or panel.",
    issues: pass ? [] : [!found ? "Subtitle panel selector not satisfied." : `Unexpected first line: ${line || "(empty)"}`],
    nextActions: pass ? [] : ["Inspect bilibili-subtitle-basic.html artifact and DOM selectors."],
    notes: execution.notes ?? [],
    rubrics: [],
    artifacts: { execution },
    runtime,
  } as unknown as Partial<LiveEvaluationResult>
}

export const bilibiliSubtitleBasicScenario: LiveScenarioDefinition<LiveBilibiliSubtitleBasicExecution> = {
  id: "bench-live/bilibili-subtitle-basic",
  title: "Live Bilibili subtitle panel skeleton",
  surface: "subtitle",
  fixture: "inline:bilibili-subtitle",
  description:
    "Loads a Bilibili-shaped subtitle panel fixture in a real browser (Month 4 secondary adapter smoke).",
  tags: ["playwright", "subtitle", "bilibili", "browser", "adapter-skeleton"],
  async run(runtime, context) {
    runtime.start(context.id, context.title)
    runtime.log("Starting Bilibili subtitle live skeleton.", {})

    try {
      const artifactDir = await prepareLiveArtifactDir(context.runId)
      const html = buildBilibiliSubtitleFixtureHtml({
        title: "Astra Bilibili live fixture",
        url: "https://www.bilibili.com/video/BV1astraLive",
        captionLines: ["Bilibili fixture line 1", "Bilibili fixture line 2"],
      })
      const htmlPath = path.join(artifactDir, "bilibili-subtitle-basic.html")
      await mkdir(path.dirname(htmlPath), { recursive: true })
      await writeFile(htmlPath, html, "utf8")

      const capture = await withLiveBrowserPage(async (page: Page, browserExecutablePath: string) => {
        await page.setContent(html, { waitUntil: "domcontentloaded" })
        await page.waitForSelector(".bpx-player-subtitle-panel", { timeout: 10_000 })
        const screenshotPath = path.join(artifactDir, "bilibili-subtitle-basic.png")
        await page.screenshot({ path: screenshotPath, fullPage: true })
        const firstLine = (await page.locator(".bpx-player-subtitle-panel-text").first().innerText()).trim()
        return { browserExecutablePath, screenshotPath, firstLine }
      })

      runtime.attachArtifact("bilibiliSubtitleCapture", {
        htmlPath,
        screenshotPath: capture.screenshotPath,
        browserExecutablePath: capture.browserExecutablePath,
      })
      runtime.complete("Bilibili subtitle live skeleton completed.")
      const snapshot = runtime.snapshot()

      return {
        status: snapshot.status,
        summary: "Opened Bilibili-shaped subtitle fixture and captured panel screenshot.",
        notes: [
          `Browser executable: ${capture.browserExecutablePath}`,
          `Artifact directory: ${artifactDir}`,
        ],
        artifacts: {
          browserExecutablePath: capture.browserExecutablePath,
          htmlPath,
          screenshotPath: capture.screenshotPath,
        },
        runtime: snapshot,
        startedAt: snapshot.startedAt,
        finishedAt: snapshot.finishedAt,
        captionPanelFound: true,
        firstCaptionLine: capture.firstLine,
      }
    } catch (error) {
      if (error instanceof LiveBrowserUnavailableError) {
        runtime.skip(error.message)
        const snapshot = runtime.snapshot()
        return {
          status: snapshot.status,
          summary: "Bilibili subtitle skeleton skipped: no local Chromium for Playwright.",
          notes: [error.message],
          artifacts: { browserAvailability: "missing" },
          runtime: snapshot,
          startedAt: snapshot.startedAt,
          finishedAt: snapshot.finishedAt,
          captionPanelFound: false,
          firstCaptionLine: "",
        }
      }
      throw error
    }
  },
  async evaluate(execution, context) {
    return buildLiveBilibiliEvaluation(execution, context.runId, context.scenario, context.runtime)
  },
}
