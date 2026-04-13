import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

import {
  withExtensionBrowserPage,
  resolveExtensionId,
  LiveBrowserUnavailableError,
  ExtensionBuildNotFoundError,
  type ExtensionBrowserContext,
} from "../driver"
import type { LiveEvaluationResult, LiveScenarioDefinition, LiveScenarioExecution, LiveScenarioMetadata } from "../evaluator"

interface VocabularySrsSmokeExecution extends LiveScenarioExecution {
  vocabulary: {
    rendersWithoutCrash: boolean
    headingPresent: boolean
    tableOrListPresent: boolean
    reviewButtonPresent: boolean
    consoleErrors: string[]
  }
}

export const vocabularySrsSmokeScenario: LiveScenarioDefinition<VocabularySrsSmokeExecution> = {
  id: "bench-live/vocabulary-srs-smoke",
  title: "Live vocabulary/SRS smoke test",
  surface: "vocabulary",
  description:
    "Loads the Astra extension and verifies the vocabulary management page renders without crashing, shows a heading, displays a word list or table, and exposes a review button. Validates the vocabulary UI surface bootstraps correctly in the extension context.",
  tags: ["playwright", "vocabulary", "browser", "extension-loaded", "smoke"],
  async run(runtime, context) {
    runtime.start(context.id, context.title)
    runtime.log("Starting extension-loaded vocabulary/SRS smoke test.")

    const artifactDir = path.join(process.cwd(), "bench-live-results", context.runId)
    await mkdir(artifactDir, { recursive: true })

    let extCtx: ExtensionBrowserContext | null = null

    try {
      extCtx = await withExtensionBrowserPage({
        initialUrl: "about:blank",
        waitForExtensionInject: 0,
      })

      runtime.checkpoint("Extension browser context launched for vocabulary.", {
        extensionPath: extCtx.extensionPath,
      })

      const consoleErrors: string[] = []
      extCtx.page.on("console", (msg) => {
        if (msg.type() === "error") {
          consoleErrors.push(msg.text())
        }
      })

      const vocabularyUrl = `chrome-extension://${await resolveExtensionId(extCtx.context)}/vocabulary/index.html`
      await extCtx.page.goto(vocabularyUrl, { waitUntil: "domcontentloaded", timeout: 10_000 })

      let rendersWithoutCrash = false
      try {
        await extCtx.page.waitForSelector("h1, h2, h3, [class*='vocabulary'], [class*='vocab']", { timeout: 5_000 })
        rendersWithoutCrash = true
      } catch {
        rendersWithoutCrash = false
      }

      const headingPresent = await extCtx.page.evaluate(() => {
        const headings = document.querySelectorAll("h1, h2, h3")
        return Array.from(headings).some((h) => h.textContent && h.textContent.trim().length > 0)
      })

      const tableOrListPresent = await extCtx.page.evaluate(() => {
        const table = document.querySelector("table, [role='table']")
        const list = document.querySelector("ul, ol, [role='list'], [class*='vocab'], [class*='word']")
        const cards = document.querySelector("[class*='card'], [class*='item']")
        return !!(table || list || cards)
      })

      const reviewButtonPresent = await extCtx.page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll("button, a[role='button'], [role='link']"))
        const reviewLabels = ["review", "practice", "due", "study", "复习", "练习"]
        return buttons.some((btn) => {
          const text = btn.textContent?.toLowerCase() ?? ""
          return reviewLabels.some((label) => text.includes(label))
        })
      })

      const screenshotPath = path.join(artifactDir, "vocabulary-srs-smoke.png")
      await extCtx.page.screenshot({ path: screenshotPath, fullPage: true })

      const snapshotHtml = await extCtx.page.content()
      const snapshotHtmlPath = path.join(artifactDir, "vocabulary-srs-smoke.snapshot.html")
      await writeFile(snapshotHtmlPath, snapshotHtml, "utf8")

      await extCtx.page.waitForTimeout(500)

      runtime.attachArtifact("vocabularyCapture", {
        rendersWithoutCrash,
        headingPresent,
        tableOrListPresent,
        reviewButtonPresent,
        screenshotPath,
        snapshotHtmlPath,
        consoleErrors,
      })
      runtime.complete("Vocabulary/SRS smoke test completed.")
      const snapshot = runtime.snapshot()

      const vocabulary = {
        rendersWithoutCrash,
        headingPresent,
        tableOrListPresent,
        reviewButtonPresent,
        consoleErrors,
      }

      return {
        status: snapshot.status,
        summary: rendersWithoutCrash
          ? `Vocabulary page rendered. Heading: ${headingPresent}, List/Table: ${tableOrListPresent}, Review: ${reviewButtonPresent}.`
          : "Vocabulary page failed to render.",
        notes: [
          `Renders without crash: ${rendersWithoutCrash}`,
          `Heading present: ${headingPresent}`,
          `Table or list present: ${tableOrListPresent}`,
          `Review button present: ${reviewButtonPresent}`,
          `Console errors: ${consoleErrors.length}`,
        ],
        artifacts: {
          browserExecutablePath: extCtx.browserExecutablePath,
          extensionPath: extCtx.extensionPath,
          screenshotPath,
          snapshotHtmlPath,
        },
        runtime: snapshot,
        startedAt: snapshot.startedAt,
        finishedAt: snapshot.finishedAt,
        vocabulary,
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
          vocabulary: {
            rendersWithoutCrash: false,
            headingPresent: false,
            tableOrListPresent: false,
            reviewButtonPresent: false,
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
          vocabulary: {
            rendersWithoutCrash: false,
            headingPresent: false,
            tableOrListPresent: false,
            reviewButtonPresent: false,
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
    const { vocabulary } = execution
    const issues: string[] = []
    const nextActions: string[] = []

    if (!vocabulary.rendersWithoutCrash) {
      issues.push("Vocabulary page did not render.")
      nextActions.push("Check VocabularyApp.tsx for runtime errors and extension context issues.")
    }

    if (!vocabulary.headingPresent) {
      issues.push("No heading text found on the vocabulary page.")
      nextActions.push("Verify VocabularyApp.tsx renders its heading component.")
    }

    if (!vocabulary.tableOrListPresent) {
      issues.push("No word list or table found on the vocabulary page.")
      nextActions.push("Verify the vocabulary list component renders when entries exist.")
    }

    if (!vocabulary.reviewButtonPresent) {
      issues.push("No review/practice button found on the vocabulary page.")
      nextActions.push("Verify ReviewMode.tsx's review entry point renders.")
    }

    if (vocabulary.consoleErrors.length > 0) {
      issues.push(`${vocabulary.consoleErrors.length} console error(s) during vocabulary page load.`)
      nextActions.push("Inspect console errors for initialization failures.")
    }

    const pass = vocabulary.rendersWithoutCrash
      && vocabulary.headingPresent
      && vocabulary.tableOrListPresent
      && vocabulary.reviewButtonPresent
      && vocabulary.consoleErrors.length === 0

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
      score: pass ? 100 : vocabulary.rendersWithoutCrash ? 50 : 0,
      summary: pass
        ? "Vocabulary/SRS smoke test passed: page renders without errors, heading found."
        : "Vocabulary/SRS smoke test failed: page did not render correctly.",
      issues,
      nextActions,
      notes: execution.notes ?? [],
      rubrics: [],
      artifacts: execution.artifacts ?? {},
      runtime: context.runtime,
    } as unknown as Partial<LiveEvaluationResult>
  },
}
