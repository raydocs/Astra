import type { LiveScenarioDefinition } from "../evaluator"
import {
  captureFixtureSmokeWithPlaywright,
  LiveBrowserUnavailableError,
} from "../driver"
import { createLiveRubric, type LiveRubricInput } from "../rubrics"

const FIXTURE_NAME = "article-basic"

export const fixturePlaywrightSmokeScenario: LiveScenarioDefinition = {
  id: "bench-live/fixture-playwright-smoke",
  title: "Playwright fixture smoke",
  surface: "live-browser-smoke",
  fixture: `page:${FIXTURE_NAME}`,
  description:
    "Loads a real HTML fixture in a Playwright-backed browser session, captures a screenshot and HTML snapshot, and verifies the main article content is visible.",
  tags: ["playwright", "browser", "smoke", "fixture"],
  rubrics: [
    createLiveRubric({
      id: "heading-visible",
      title: "Fixture heading is visible",
      evaluate(input: LiveRubricInput) {
        const headingText = String(input.execution.headingText ?? "").trim()
        return {
          id: "heading-visible",
          title: "Fixture heading is visible",
          pass: headingText.includes("Astra turns long-form reading"),
          score: headingText.length > 0 ? 100 : 0,
          message: headingText.length > 0 ? headingText : "article h1 was empty",
        }
      },
    }),
    createLiveRubric({
      id: "paragraphs-loaded",
      title: "Fixture paragraphs loaded",
      evaluate(input: LiveRubricInput) {
        const paragraphCount = Number(input.execution.paragraphCount ?? 0)
        return {
          id: "paragraphs-loaded",
          title: "Fixture paragraphs loaded",
          pass: paragraphCount >= 2,
          score: paragraphCount >= 2 ? 100 : 0,
          message: `paragraphCount=${paragraphCount}`,
        }
      },
    }),
    createLiveRubric({
      id: "artifacts-captured",
      title: "Screenshot and HTML snapshot captured",
      evaluate(input: LiveRubricInput) {
        const screenshotPath = String(input.execution.screenshotPath ?? "")
        const snapshotHtmlPath = String(input.execution.snapshotHtmlPath ?? "")
        const pass = screenshotPath.length > 0 && snapshotHtmlPath.length > 0
        return {
          id: "artifacts-captured",
          title: "Screenshot and HTML snapshot captured",
          pass,
          score: pass ? 100 : 0,
          message: pass
            ? "live artifacts were captured"
            : "missing screenshotPath or snapshotHtmlPath in execution artifacts",
        }
      },
    }),
  ],
  async run(runtime, context) {
    runtime.start(context.id, context.title)
    runtime.log("Starting the Playwright-backed live smoke scenario.", {
      fixture: FIXTURE_NAME,
      surface: context.surface,
    })

    try {
      const capture = await captureFixtureSmokeWithPlaywright({
        runId: context.runId,
        fixtureName: FIXTURE_NAME,
        title: context.title,
      })

      runtime.checkpoint("Fixture page materialized for live browser smoke.", {
        htmlPath: capture.htmlPath,
        url: capture.url,
      })
      runtime.attachArtifact("fixturePage", {
        htmlPath: capture.htmlPath,
        url: capture.url,
      })
      runtime.attachArtifact("browser", {
        executablePath: capture.browserExecutablePath,
      })
      runtime.attachArtifact("pageSnapshot", {
        screenshotPath: capture.screenshotPath,
        snapshotHtmlPath: capture.snapshotHtmlPath,
        headingText: capture.headingText,
        paragraphCount: capture.paragraphCount,
        bodyTextLength: capture.bodyTextLength,
        htmlLength: capture.htmlLength,
      })
      runtime.complete("Playwright fixture smoke completed.")

      const snapshot = runtime.snapshot()
      return {
        status: snapshot.status,
        summary:
          "Loaded the article-basic fixture in a real browser session and captured screenshot/HTML artifacts for live evaluation.",
        notes: [
          `Browser executable: ${capture.browserExecutablePath}`,
          `Artifact directory: ${capture.artifactDir}`,
        ],
        artifacts: {
          browserExecutablePath: capture.browserExecutablePath,
          htmlPath: capture.htmlPath,
          screenshotPath: capture.screenshotPath,
          snapshotHtmlPath: capture.snapshotHtmlPath,
          headingText: capture.headingText,
          articleText: capture.articleText,
          paragraphCount: capture.paragraphCount,
          bodyTextLength: capture.bodyTextLength,
          htmlLength: capture.htmlLength,
        },
        runtime: snapshot,
        startedAt: snapshot.startedAt,
        finishedAt: snapshot.finishedAt,
      }
    } catch (error) {
      if (error instanceof LiveBrowserUnavailableError) {
        runtime.skip(error.message)
        const snapshot = runtime.snapshot()
        return {
          status: snapshot.status,
          summary:
            "The live Playwright smoke scenario is wired, but no supported local browser executable is available in this environment.",
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
}
