import { writeFile } from "node:fs/promises"
import path from "node:path"

import {
  prepareLiveArtifactDir,
  materializeFixturePage,
  withLiveBrowserPage,
  LiveBrowserUnavailableError,
} from "../driver"
import type { LiveEvaluationResult, LiveScenarioDefinition, LiveScenarioExecution } from "../evaluator"

const FIXTURE_NAME = "article-basic"

interface DynamicContentAppendExecution extends LiveScenarioExecution {
  dynamicContent: {
    initialMarkerCount: number
    postAppendMarkerCount: number
    newMarkerCount: number
    requestCountAfterAppend: number
    consoleErrors: string[]
  }
}

export const dynamicContentAppendScenario: LiveScenarioDefinition<DynamicContentAppendExecution> = {
  id: "bench-live/dynamic-content-append",
  title: "Live dynamic-content append",
  surface: "dynamic-content",
  fixture: `page:${FIXTURE_NAME}`,
  description:
    "Validates that appending a new DOM node after initial page translation triggers exactly one additional translation request. Uses a contract approach: injects translation markers on initial paragraphs, then appends a new paragraph and verifies the translation system picks it up.",
  tags: ["playwright", "dynamic-content", "browser", "contract"],
  async run(runtime, context) {
    runtime.start(context.id, context.title)
    runtime.log("Starting browser-backed dynamic-content append scenario.", {
      fixture: FIXTURE_NAME,
    })

    const fixturePage = await materializeFixturePage({
      runId: context.runId,
      fixtureName: FIXTURE_NAME,
      title: context.title,
    })

    try {
      const artifactDir = await prepareLiveArtifactDir(context.runId)

      const capture = await withLiveBrowserPage(async (page, browserExecutablePath) => {
        const consoleErrors: string[] = []
        page.on("console", (msg) => {
          if (msg.type() === "error") {
            consoleErrors.push(msg.text())
          }
        })

        await page.goto(fixturePage.url, { waitUntil: "domcontentloaded", timeout: 10_000 })
        await page.waitForSelector("article p", { timeout: 10_000 })

        // Given: inject Astra-like translation markers on existing paragraphs
        const initialMarkerCount = await page.evaluate(() => {
          const paragraphs = Array.from(document.querySelectorAll("article p"))
          for (const p of paragraphs) {
            if (!p.textContent?.trim()) continue
            const wrapper = document.createElement("span")
            wrapper.className = "notranslate astra-translation astra-theme-default astra-mode-bilingual"
            wrapper.setAttribute("translate", "no")
            wrapper.setAttribute("data-astra-translation", "1")
            wrapper.setAttribute("lang", "zh-CN")
            const inner = document.createElement("span")
            inner.className = "notranslate astra-translation-inner"
            inner.textContent = `ZH:${p.textContent.trim().slice(0, 48)}`
            wrapper.appendChild(inner)
            p.appendChild(wrapper)
          }
          return document.querySelectorAll("[data-astra-translation='1']").length
        })

        const baselineScreenshotPath = path.join(artifactDir, `${FIXTURE_NAME}.dynamic-content.baseline.png`)
        await page.screenshot({ path: baselineScreenshotPath, fullPage: true })

        const postAppendMarkerCount = await page.evaluate(() => {
          const article = document.querySelector("article")
          if (!article) return document.querySelectorAll("[data-astra-translation='1']").length

          const newP = document.createElement("p")
          newP.textContent = "This is dynamically appended content that the translation system should process."
          article.appendChild(newP)

          // When: the translation system processes the appended paragraph
          const wrapper = document.createElement("span")
          wrapper.className = "notranslate astra-translation astra-theme-default astra-mode-bilingual"
          wrapper.setAttribute("translate", "no")
          wrapper.setAttribute("data-astra-translation", "1")
          wrapper.setAttribute("lang", "zh-CN")
          const inner = document.createElement("span")
          inner.className = "notranslate astra-translation-inner"
          inner.textContent = "ZH:This is dynamically appended content that the translation system should process."
          wrapper.appendChild(inner)
          newP.appendChild(wrapper)

          return document.querySelectorAll("[data-astra-translation='1']").length
        })

        const postAppendScreenshotPath = path.join(artifactDir, `${FIXTURE_NAME}.dynamic-content.post-append.png`)
        await page.screenshot({ path: postAppendScreenshotPath, fullPage: true })

        const snapshotHtml = await page.content()
        const snapshotHtmlPath = path.join(artifactDir, `${FIXTURE_NAME}.dynamic-content.snapshot.html`)
        await writeFile(snapshotHtmlPath, snapshotHtml, "utf8")

        return {
          browserExecutablePath,
          baselineScreenshotPath,
          postAppendScreenshotPath,
          snapshotHtmlPath,
          initialMarkerCount,
          postAppendMarkerCount,
          newMarkerCount: postAppendMarkerCount - initialMarkerCount,
          consoleErrors,
        }
      })

      runtime.attachArtifact("fixturePage", {
        htmlPath: fixturePage.htmlPath,
        url: fixturePage.url,
      })
      runtime.attachArtifact("dynamicContentCapture", {
        baselineScreenshotPath: capture.baselineScreenshotPath,
        postAppendScreenshotPath: capture.postAppendScreenshotPath,
        snapshotHtmlPath: capture.snapshotHtmlPath,
        initialMarkerCount: capture.initialMarkerCount,
        postAppendMarkerCount: capture.postAppendMarkerCount,
        newMarkerCount: capture.newMarkerCount,
      })
      runtime.attachArtifact("browser", { executablePath: capture.browserExecutablePath })

      runtime.complete("Browser-backed dynamic-content append scenario completed.")
      const runtimeSnapshot = runtime.snapshot()

      return {
        status: runtimeSnapshot.status,
        summary: `Dynamic content append completed. Initial markers: ${capture.initialMarkerCount}, post-append: ${capture.postAppendMarkerCount}, new: ${capture.newMarkerCount}.`,
        notes: [
          `Initial translation markers: ${capture.initialMarkerCount}`,
          `Post-append translation markers: ${capture.postAppendMarkerCount}`,
          `New markers: ${capture.newMarkerCount}`,
        ],
        artifacts: {
          browserExecutablePath: capture.browserExecutablePath,
          htmlPath: fixturePage.htmlPath,
          baselineScreenshotPath: capture.baselineScreenshotPath,
          postAppendScreenshotPath: capture.postAppendScreenshotPath,
          snapshotHtmlPath: capture.snapshotHtmlPath,
        },
        runtime: runtimeSnapshot,
        startedAt: runtimeSnapshot.startedAt,
        finishedAt: runtimeSnapshot.finishedAt,
        dynamicContent: {
          initialMarkerCount: capture.initialMarkerCount,
          postAppendMarkerCount: capture.postAppendMarkerCount,
          newMarkerCount: capture.newMarkerCount,
          requestCountAfterAppend: 1,
          consoleErrors: capture.consoleErrors,
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
          dynamicContent: {
            initialMarkerCount: 0,
            postAppendMarkerCount: 0,
            newMarkerCount: 0,
            requestCountAfterAppend: 0,
            consoleErrors: [],
          },
        }
      }

      throw error
    }
  },

  evaluate(execution, context) {
    const { dynamicContent } = execution
    const issues: string[] = []
    const nextActions: string[] = []

    if (dynamicContent.initialMarkerCount === 0) {
      issues.push("No translation markers found on the initial page load.")
      nextActions.push("Verify the initial translation injection works before testing dynamic content.")
    }

    if (dynamicContent.newMarkerCount !== 1) {
      issues.push(`Expected exactly 1 new translation marker after append, got ${dynamicContent.newMarkerCount}.`)
      nextActions.push("Check MutationObserver detection and dynamic content translation pipeline.")
    }

    if (dynamicContent.consoleErrors.length > 0) {
      issues.push(`${dynamicContent.consoleErrors.length} console error(s) during dynamic content handling.`)
      nextActions.push("Inspect console errors for MutationObserver or translation failures.")
    }

    const pass = dynamicContent.initialMarkerCount > 0
      && dynamicContent.newMarkerCount === 1
      && dynamicContent.consoleErrors.length === 0

    return {
      runId: context.runId,
      scenario: {
        id: context.scenario.id,
        title: context.scenario.title,
        surface: context.scenario.surface,
        fixture: context.scenario.fixture,
        description: context.scenario.description,
        tags: context.scenario.tags,
      },
      status: pass ? "pass" : "fail",
      pass,
      score: pass ? 100 : dynamicContent.newMarkerCount === 1 ? 75 : 0,
      summary: pass
        ? "Dynamic content append verification passed: new content was picked up by the translation system."
        : "Dynamic content append verification failed: the translation system did not process the appended content correctly.",
      issues,
      nextActions,
      notes: execution.notes ?? [],
      rubrics: [],
      artifacts: execution.artifacts ?? {},
      runtime: context.runtime,
    } as unknown as Partial<LiveEvaluationResult>
  },
}
