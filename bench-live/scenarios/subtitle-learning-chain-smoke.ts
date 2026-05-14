import { writeFile } from "node:fs/promises"
import path from "node:path"

import {
  prepareLiveArtifactDir,
  withExtensionBrowserPage,
  LiveBrowserUnavailableError,
  ExtensionBuildNotFoundError,
  type ExtensionBrowserContext,
} from "../driver"
import { sleep } from "../sleep"
import type { LiveScenarioDefinition, LiveScenarioExecution, LiveScenarioMetadata, LiveEvaluationResult } from "../evaluator"

const VOCABULARY_STORAGE_KEY = "astra.vocabulary.v1"
const OWNED_READING_STORAGE_KEY = "astra.owned_reading.v1"

interface SubtitleLearningChainExecution extends LiveScenarioExecution {
  chain: {
    listContextVisible: boolean
    reviewContextVisible: boolean
    resumeOpenedSubtitleReader: boolean
    reopenBannerVisible: boolean
    consoleErrors: string[]
  }
}

export const subtitleLearningChainSmokeScenario: LiveScenarioDefinition<SubtitleLearningChainExecution> = {
  id: "bench-live/subtitle-learning-chain-smoke",
  title: "Live subtitle-reader learning-chain smoke",
  surface: "subtitle-file",
  fixture: "storage:seeded-subtitle-learning-chain",
  description:
    "Seeds a subtitle-reader vocabulary entry plus owned-reading row, verifies Vocabulary and Review show subtitle-reader continuity, and verifies Resume reopens subtitle-reader with the saved reopen hint.",
  tags: ["playwright", "subtitle-file", "vocabulary", "review", "reading-queue", "extension-loaded", "smoke"],
  async run(runtime, context) {
    runtime.start(context.id, context.title)
    runtime.log("Starting subtitle-reader learning-chain smoke.")

    const artifactDir = await prepareLiveArtifactDir(context.runId)

    const subtitleEntry = {
      id: "bench-subtitle-vocab-1",
      text: "subtitle-word",
      translation: "字幕词",
      explanation: "Points back to the subtitle-reader row.",
      context: "sample.srt · row 2",
      url: "astra-local://subtitle/sample.srt",
      hostname: "subtitle-reader",
      savedAt: Date.now(),
      srsBox: 1,
      nextReviewAt: Date.now() - 1_000,
      reviewCount: 0,
      lastReviewedAt: null,
      sourceContext: {
        surface: "subtitle_reader" as const,
        pageTitle: "sample.srt",
        pageUrl: "astra-local://subtitle/sample.srt",
        hostname: "subtitle-reader",
        contentSummary: "SRT · 12 items",
        sentenceText: "subtitle-word",
        sentenceIndex: 1,
        ownedReadingItemId: "or_subtitle_sample",
        ownedReadingSourceType: "subtitle-file" as const,
        ownedReadingTitle: "sample.srt · SRT · 12 items",
      },
    }

    const ownedReadingSeed = {
      version: 1,
      items: [{
        id: "or_subtitle_sample",
        sourceType: "subtitle-file",
        title: "sample.srt · SRT · 12 items",
        sourceUrl: null,
        localUri: "astra-local://subtitle/sample.srt",
        reopenHint: "Open the subtitle reader and choose the same file: sample.srt · continue from row 2",
        openedAt: Date.now(),
        status: "saved",
        progress: { sentenceIndex: 1 },
        studyProgressRecordId: null,
      }],
    }

    let extCtx: ExtensionBrowserContext | null = null

    try {
      extCtx = await withExtensionBrowserPage({
        initialUrl: "about:blank",
        waitForExtensionInject: 0,
        storageState: {
          [VOCABULARY_STORAGE_KEY]: [subtitleEntry],
          [OWNED_READING_STORAGE_KEY]: ownedReadingSeed,
        },
      })

      const consoleErrors: string[] = []
      extCtx.page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text())
      })

      const listUrl = `chrome-extension://${extCtx.extensionId}/vocabulary.html`
      await extCtx.page.goto(listUrl, { waitUntil: "domcontentloaded", timeout: 15_000 })
      await extCtx.page.waitForSelector('[data-role="vocabulary-entry-card"][data-entry-id="bench-subtitle-vocab-1"]', { timeout: 10_000 })
      await extCtx.page.locator('[data-role="vocabulary-entry-card"][data-entry-id="bench-subtitle-vocab-1"]').click()
      await sleep(300)

      const listContextVisible = await extCtx.page.evaluate(() => {
        const body = document.body.innerText
        return body.includes("Subtitle reader")
          && body.includes("sample.srt")
          && body.includes("File: astra-local://subtitle/sample.srt")
          && body.includes("Reading asset")
          && body.includes("sample.srt · SRT · 12 items · Subtitle file")
          && body.includes("Last row: 2")
      })

      const listScreenshotPath = path.join(artifactDir, "subtitle-learning-chain-vocabulary.png")
      await extCtx.page.screenshot({ path: listScreenshotPath, fullPage: true })

      const reviewUrl = `chrome-extension://${extCtx.extensionId}/vocabulary.html?tab=review`
      await extCtx.page.goto(reviewUrl, { waitUntil: "domcontentloaded", timeout: 15_000 })
      await extCtx.page.waitForSelector('[role="button"]', { timeout: 10_000 })
      await extCtx.page.locator('[role="button"]').first().click()
      await sleep(300)

      const reviewContextVisible = await extCtx.page.evaluate(() => {
        const body = document.body.innerText
        return body.includes("Subtitle reader")
          && body.includes("sample.srt")
          && body.includes("File: astra-local://subtitle/sample.srt")
          && body.includes("Summary: SRT · 12 items")
          && body.includes("Resume reading asset")
      })

      const reviewScreenshotPath = path.join(artifactDir, "subtitle-learning-chain-review.png")
      await extCtx.page.screenshot({ path: reviewScreenshotPath, fullPage: true })

      await extCtx.page.getByRole("button", { name: "Resume reading asset", exact: true }).click()
      await sleep(800)

      const subtitleReaderPage = extCtx.context.pages().find((page) => page.url().includes(`/subtitle-reader.html?reopenHint=`)) ?? null
      const resumeOpenedSubtitleReader = !!subtitleReaderPage

      let reopenBannerVisible = false
      let subtitleReaderScreenshotPath: string | null = null
      if (subtitleReaderPage) {
        await subtitleReaderPage.bringToFront()
        await subtitleReaderPage.waitForLoadState("domcontentloaded", { timeout: 10_000 }).catch(() => undefined)
        await sleep(300)
        reopenBannerVisible = await subtitleReaderPage.evaluate(() => {
          const body = document.body.innerText
          return body.includes("Open the subtitle reader and choose the same file: sample.srt")
            && body.includes("continue from row 2")
        })
        subtitleReaderScreenshotPath = path.join(artifactDir, "subtitle-learning-chain-reader.png")
        await subtitleReaderPage.screenshot({ path: subtitleReaderScreenshotPath, fullPage: true })
      }

      const snapshotHtmlPath = path.join(artifactDir, "subtitle-learning-chain-review.snapshot.html")
      await writeFile(snapshotHtmlPath, await extCtx.page.content(), "utf8")

      runtime.attachArtifact("subtitleLearningChainCapture", {
        listScreenshotPath,
        reviewScreenshotPath,
        subtitleReaderScreenshotPath,
        snapshotHtmlPath,
        browserExecutablePath: extCtx.browserExecutablePath,
        listContextVisible,
        reviewContextVisible,
        resumeOpenedSubtitleReader,
        reopenBannerVisible,
        consoleErrors,
      })
      runtime.complete("Subtitle-reader learning-chain smoke completed.")
      const snapshot = runtime.snapshot()

      return {
        status: snapshot.status,
        summary: "Verified subtitle-reader continuity into vocabulary, review, and subtitle-reader reopen handoff.",
        notes: [
          `Browser executable: ${extCtx.browserExecutablePath}`,
          `Artifact directory: ${artifactDir}`,
          `listContextVisible=${listContextVisible}`,
          `reviewContextVisible=${reviewContextVisible}`,
          `resumeOpenedSubtitleReader=${resumeOpenedSubtitleReader}`,
          `reopenBannerVisible=${reopenBannerVisible}`,
        ],
        artifacts: {
          browserExecutablePath: extCtx.browserExecutablePath,
          listScreenshotPath,
          reviewScreenshotPath,
          subtitleReaderScreenshotPath,
          snapshotHtmlPath,
        },
        runtime: snapshot,
        startedAt: snapshot.startedAt,
        finishedAt: snapshot.finishedAt,
        chain: {
          listContextVisible,
          reviewContextVisible,
          resumeOpenedSubtitleReader,
          reopenBannerVisible,
          consoleErrors,
        },
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
          chain: {
            listContextVisible: false,
            reviewContextVisible: false,
            resumeOpenedSubtitleReader: false,
            reopenBannerVisible: false,
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
          chain: {
            listContextVisible: false,
            reviewContextVisible: false,
            resumeOpenedSubtitleReader: false,
            reopenBannerVisible: false,
            consoleErrors: [],
          },
        }
      }

      throw error
    } finally {
      await extCtx?.close()
    }
  },

  evaluate(execution, context) {
    const chain = execution.chain ?? {
      listContextVisible: false,
      reviewContextVisible: false,
      resumeOpenedSubtitleReader: false,
      reopenBannerVisible: false,
      consoleErrors: [] as string[],
    }
    const issues: string[] = []
    const nextActions: string[] = []

    if (!chain.listContextVisible) {
      issues.push("Vocabulary list did not show subtitle-reader continuity details.")
      nextActions.push("Check VocabularyApp subtitle source-context rendering and owned-reading matching.")
    }
    if (!chain.reviewContextVisible) {
      issues.push("Review mode did not show subtitle-reader continuity details.")
      nextActions.push("Check ReviewMode subtitle source-context rendering.")
    }
    if (!chain.resumeOpenedSubtitleReader) {
      issues.push("Resume reading asset did not reopen subtitle-reader.")
      nextActions.push("Check subtitle-file resume target construction and browser.tabs.create wiring.")
    }
    if (!chain.reopenBannerVisible) {
      issues.push("Subtitle-reader reopen hint banner was not visible after resume.")
      nextActions.push("Check subtitle-reader reopenHint parsing/rendering.")
    }
    if (chain.consoleErrors.length > 0) {
      issues.push(`${chain.consoleErrors.length} console error(s) occurred during the subtitle learning chain smoke.`)
      nextActions.push("Inspect console errors from vocabulary/review/subtitle-reader bootstraps.")
    }

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
      score: pass ? 100 : Math.max(0, 100 - issues.length * 20),
      summary: pass
        ? "Subtitle-reader learning-chain smoke passed: vocabulary, review, and resume handoff all held."
        : "Subtitle-reader learning-chain smoke failed: one or more continuity steps diverged.",
      issues,
      nextActions,
      notes: execution.notes ?? [],
      rubrics: [],
      artifacts: execution.artifacts ?? {},
      runtime: context.runtime,
    } as unknown as Partial<LiveEvaluationResult>
  },
}
