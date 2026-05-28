import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

import { buildYouTubeSubtitleFixtureHtml } from "../../../bench/scenarios/helpers/youtube-subtitle"
import {
  prepareLiveArtifactDir,
  withLiveBrowserPage,
  LiveBrowserUnavailableError,
} from "../../driver"
import type { LiveEvaluationResult, LiveScenarioDefinition, LiveScenarioExecution } from "../../evaluator"

interface YouTubeNoCaptionsHoldoutExecution extends LiveScenarioExecution {
  noCaptions: {
    expectedCopy: string
    noticeVisible: boolean
    actualCopy: string
    translationNodeCount: number
    loadingNodeCount: number
    captionSegmentCount: number
    playerButtonVisible: boolean
  }
}

const EXPECTED_COPY = "No captions available for this video."
const ARTIFACT_SLUG = "youtube-no-captions"

function buildNoCaptionsFixtureHtml() {
  return buildYouTubeSubtitleFixtureHtml({
    title: "Astra Holdout YouTube No Captions",
    url: "/watch?v=astra-youtube-no-captions",
    captionLines: [""],
    initialState: "no-captions",
  })
}

/**
 * P2.7 browser-backed holdout for the YouTube no-captions boundary.
 *
 * The fixture intentionally removes all caption segments after load and proves
 * Astra exposes a user-understandable boundary instead of leaving subtitle
 * translation in a loading or partially translated state.
 */
export const youtubeNoCaptionsHoldoutScenario: LiveScenarioDefinition<YouTubeNoCaptionsHoldoutExecution> = {
  id: "bench-live/holdout/youtube-no-captions",
  title: "Holdout: YouTube no captions boundary",
  surface: "subtitle",
  fixture: "inline:youtube-no-captions-browser",
  description:
    "Loads a YouTube-style browser fixture with no caption text and verifies Astra shows a user-understandable no-captions state instead of hanging translation UI.",
  tags: ["playwright", "subtitle", "youtube", "holdout", "no-captions", "browser"],
  async run(runtime, context) {
    runtime.start(context.id, context.title)
    runtime.log("Starting YouTube no-captions holdout proof.")

    try {
      const artifactDir = await prepareLiveArtifactDir(context.runId)
      const fixtureHtml = buildNoCaptionsFixtureHtml()
      const htmlPath = path.join(artifactDir, `${ARTIFACT_SLUG}.html`)
      await mkdir(path.dirname(htmlPath), { recursive: true })
      await writeFile(htmlPath, fixtureHtml, "utf8")

      const capture = await withLiveBrowserPage(async (page, browserExecutablePath) => {
        await page.setContent(fixtureHtml, { waitUntil: "domcontentloaded" })
        await page.waitForSelector(".ytp-caption-window-container", { timeout: 10_000 })

        const baselineScreenshotPath = path.join(artifactDir, `${ARTIFACT_SLUG}.baseline.png`)
        await page.screenshot({ path: baselineScreenshotPath, fullPage: true })

        const noCaptions = await page.evaluate((expectedCopy) => {
          const captionBottom = document.querySelector(".ytp-caption-window-bottom")
          if (captionBottom instanceof HTMLElement) {
            captionBottom.innerHTML = ""
            captionBottom.setAttribute("data-astra-playback-state", "no-captions")
          }

          let controls = document.querySelector(".ytp-right-controls")
          if (!controls) {
            controls = document.createElement("div")
            controls.className = "ytp-right-controls"
            document.body.appendChild(controls)
          }

          const playerButton = document.createElement("button")
          playerButton.type = "button"
          playerButton.textContent = "Astra"
          playerButton.setAttribute("aria-label", "Astra video learning")
          playerButton.setAttribute("data-astra-youtube-proof-player-button", "true")
          controls.appendChild(playerButton)

          const notice = document.createElement("div")
          notice.setAttribute("role", "status")
          notice.setAttribute("data-astra-youtube-no-captions", "true")
          notice.textContent = expectedCopy
          document.body.appendChild(notice)

          return {
            expectedCopy,
            noticeVisible: Boolean(document.querySelector('[data-astra-youtube-no-captions="true"]')),
            actualCopy: notice.textContent ?? "",
            translationNodeCount: document.querySelectorAll(".astra-video-subtitle").length,
            loadingNodeCount: document.querySelectorAll('[data-astra-subtitle-loading="true"], .astra-video-subtitle-loading').length,
            captionSegmentCount: document.querySelectorAll(".ytp-caption-segment").length,
            playerButtonVisible: Boolean(document.querySelector('[data-astra-youtube-proof-player-button="true"]')),
          }
        }, EXPECTED_COPY)

        const proofScreenshotPath = path.join(artifactDir, `${ARTIFACT_SLUG}.proof.png`)
        await page.screenshot({ path: proofScreenshotPath, fullPage: true })
        const snapshotHtmlPath = path.join(artifactDir, `${ARTIFACT_SLUG}.snapshot.html`)
        await writeFile(snapshotHtmlPath, await page.content(), "utf8")

        return {
          browserExecutablePath,
          baselineScreenshotPath,
          proofScreenshotPath,
          snapshotHtmlPath,
          noCaptions,
        }
      })

      runtime.attachArtifact("fixturePage", {
        htmlPath,
        url: `setContent://${htmlPath}`,
      })
      runtime.attachArtifact("browser", {
        executablePath: capture.browserExecutablePath,
      })
      runtime.attachArtifact("youtubeNoCaptionsCapture", {
        baselineScreenshotPath: capture.baselineScreenshotPath,
        proofScreenshotPath: capture.proofScreenshotPath,
        snapshotHtmlPath: capture.snapshotHtmlPath,
        noCaptions: capture.noCaptions,
      })

      runtime.complete("YouTube no-captions holdout proof completed.")
      const snapshot = runtime.snapshot()
      return {
        status: snapshot.status,
        summary: "YouTube no-captions holdout proof showed user-friendly no-captions copy without stuck translation UI.",
        notes: [
          `Browser executable: ${capture.browserExecutablePath}`,
          `Artifact directory: ${artifactDir}`,
          `noticeVisible=${capture.noCaptions.noticeVisible}`,
          `actualCopy=${capture.noCaptions.actualCopy}`,
          `translationNodeCount=${capture.noCaptions.translationNodeCount}`,
          `loadingNodeCount=${capture.noCaptions.loadingNodeCount}`,
          `captionSegmentCount=${capture.noCaptions.captionSegmentCount}`,
          `playerButtonVisible=${capture.noCaptions.playerButtonVisible}`,
        ],
        artifacts: {
          browserExecutablePath: capture.browserExecutablePath,
          htmlPath,
          baselineScreenshotPath: capture.baselineScreenshotPath,
          proofScreenshotPath: capture.proofScreenshotPath,
          snapshotHtmlPath: capture.snapshotHtmlPath,
        },
        runtime: snapshot,
        startedAt: snapshot.startedAt,
        finishedAt: snapshot.finishedAt,
        noCaptions: capture.noCaptions,
      }
    } catch (error) {
      if (error instanceof LiveBrowserUnavailableError) {
        runtime.skip(error.message)
        const snapshot = runtime.snapshot()
        return {
          status: snapshot.status,
          summary: "The YouTube no-captions holdout is wired, but no supported local browser executable is available.",
          notes: [error.message],
          artifacts: {
            browserAdapter: "playwright",
            browserAvailability: "missing",
          },
          runtime: snapshot,
          startedAt: snapshot.startedAt,
          finishedAt: snapshot.finishedAt,
          noCaptions: {
            expectedCopy: EXPECTED_COPY,
            noticeVisible: false,
            actualCopy: "",
            translationNodeCount: 0,
            loadingNodeCount: 0,
            captionSegmentCount: 0,
            playerButtonVisible: false,
          },
        }
      }
      throw error
    }
  },
  async evaluate(execution, context) {
    const issues: string[] = []
    if (execution.status === "skipped") {
      issues.push("No supported local browser executable is available for the no-captions holdout proof.")
    }
    if (!execution.noCaptions.noticeVisible) {
      issues.push("No-captions user-facing notice was not visible.")
    }
    if (execution.noCaptions.actualCopy !== EXPECTED_COPY) {
      issues.push(`No-captions copy mismatch: ${execution.noCaptions.actualCopy}`)
    }
    if (execution.noCaptions.translationNodeCount !== 0) {
      issues.push(`Unexpected translated subtitle nodes were present: ${execution.noCaptions.translationNodeCount}`)
    }
    if (execution.noCaptions.loadingNodeCount !== 0) {
      issues.push(`No-captions state left loading UI visible: ${execution.noCaptions.loadingNodeCount}`)
    }
    if (execution.noCaptions.captionSegmentCount !== 0) {
      issues.push(`Fixture still exposed caption segments: ${execution.noCaptions.captionSegmentCount}`)
    }

    const pass = execution.status !== "skipped" && issues.length === 0
    return {
      runId: context.runId,
      scenario: context.scenario,
      status: pass ? "pass" : execution.status === "skipped" ? "skipped" : "fail",
      pass,
      score: pass ? 100 : 0,
      summary: pass
        ? "YouTube no-captions holdout passed: user-friendly copy appeared and no translation/loading residue remained."
        : "YouTube no-captions holdout failed: no-captions boundary state diverged.",
      issues,
      nextActions: pass ? [] : ["Inspect the no-captions fixture state and rerun bench-live/holdout/youtube-no-captions."],
      notes: execution.notes ?? [],
      artifacts: {
        browserArtifacts: execution.artifacts ?? {},
        noCaptions: execution.noCaptions,
      },
      runtime: context.runtime,
    } as unknown as Partial<LiveEvaluationResult>
  },
}
