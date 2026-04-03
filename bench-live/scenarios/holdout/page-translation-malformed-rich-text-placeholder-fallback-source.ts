import { writeFile } from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"

import { stripRichTextPlaceholders } from "@/utils/dom/rich-text-placeholders"
import type { LiveEvaluationResult, LiveScenarioDefinition, LiveScenarioExecution } from "../../evaluator"
import {
  LiveBrowserUnavailableError,
  materializeFixturePage,
  withLiveBrowserPage,
} from "../../driver"
import { runSourceBackedPageTranslation } from "../../source-runtime"

interface LivePageTranslationExecution extends LiveScenarioExecution {
  pageTranslation: NonNullable<Awaited<ReturnType<typeof runSourceBackedPageTranslation>>["pageTranslation"]>
}

const FIXTURE_NAME = "dense-inline"
const TARGET_LANG = "zh-CN"

function buildDenseInlineFallbackFixtureHtml(baseHtml: string) {
  const richTextAppend = `
    <p class="holdout-rich-text-fallback">
      Release <strong>notes with <em>nested emphasis</em></strong>, adjacent <strong>bold</strong><em>emphasis</em><code>code</code>, and <mark>highlighted warnings</mark> should survive malformed placeholder fallback.
    </p>
    <p class="holdout-rich-text-fallback">
      Mixed inline <small>annotations</small>, <sub>subscripts</sub>, <sup>superscripts</sup>, and <span>plain spans</span> should fall back to plain text without leaking placeholder tokens.
    </p>
  `

  const updatedHtml = baseHtml.replace("</article>", `${richTextAppend}\n  </article>`)
  if (updatedHtml === baseHtml) {
    throw new Error("dense-inline fixture no longer contains </article>; malformed placeholder holdout fixture injection failed")
  }

  return updatedHtml
}

function createMalformedRichTextTranslation(text: string) {
  const malformed = text.replace(/__ASTRA_RT_(\d+)_OPEN_[A-Z]+__/, "__ASTRA_RT_$1_CLOSE__")
  return `ZH:${malformed}`
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim()
}

export const pageTranslationMalformedRichTextPlaceholderFallbackSourceHoldoutScenario: LiveScenarioDefinition<LivePageTranslationExecution> = {
  id: "bench-live/holdout/page-translation-malformed-rich-text-placeholder-fallback-source",
  title: "Holdout: page translation malformed rich-text placeholder fallback source",
  surface: "page-translation",
  fixture: `page:${FIXTURE_NAME}`,
  description:
    "Runs the real page-translation source module against dense inline rich text while the translation backend returns malformed Astra placeholder tokens, verifying fallback to safe plain text without placeholder leakage.",
  tags: ["playwright", "page-translation", "browser", "holdout", "rich-text", "placeholder", "fallback", "source-backed"],
  async run(runtime, context) {
    runtime.start(context.id, context.title)
    runtime.log("Starting source-backed page-translation malformed rich-text placeholder fallback holdout.", {
      fixture: FIXTURE_NAME,
      targetLang: TARGET_LANG,
    })

    try {
      const fixturePage = await materializeFixturePage({
        runId: context.runId,
        fixtureName: FIXTURE_NAME,
        title: context.title,
      })
      const malformedFixtureHtml = buildDenseInlineFallbackFixtureHtml(fixturePage.fixtureHtml)
      const malformedFixtureHtmlPath = path.join(fixturePage.artifactDir, `${FIXTURE_NAME}.malformed-placeholder.fixture.html`)
      const translatedHtmlPath = path.join(fixturePage.artifactDir, `${FIXTURE_NAME}.malformed-placeholder.snapshot.html`)
      await writeFile(malformedFixtureHtmlPath, malformedFixtureHtml, "utf8")

      const sourceResult = await runSourceBackedPageTranslation({
        fixtureHtml: malformedFixtureHtml,
        url: fixturePage.url,
        title: context.title,
        targetLang: TARGET_LANG,
        contentScope: "page",
        translationMode: "bilingual",
        snapshotHtmlPath: translatedHtmlPath,
        translateBatch: (payload) => payload.texts.map((text) => createMalformedRichTextTranslation(text)),
      })

      const capture = await withLiveBrowserPage(async (page, browserExecutablePath) => {
        await page.goto(pathToFileURL(translatedHtmlPath).href, { waitUntil: "domcontentloaded" })
        await page.waitForSelector("[data-astra-translation='1']", { timeout: 10_000 })

        const screenshotPath = path.join(fixturePage.artifactDir, `${FIXTURE_NAME}.malformed-placeholder.png`)
        await page.screenshot({ path: screenshotPath, fullPage: true })

        return {
          browserExecutablePath,
          screenshotPath,
          translatedTexts: (await page.locator("[data-astra-translation='1'] .astra-translation-inner").allTextContents()).map(normalizeText),
          restoredTagCount: await page.locator("[data-astra-translation='1'] .astra-translation-inner strong, [data-astra-translation='1'] .astra-translation-inner em, [data-astra-translation='1'] .astra-translation-inner code, [data-astra-translation='1'] .astra-translation-inner mark, [data-astra-translation='1'] .astra-translation-inner small, [data-astra-translation='1'] .astra-translation-inner sub, [data-astra-translation='1'] .astra-translation-inner sup").count(),
          placeholderLeakCount: await page.locator("text=/__ASTRA_RT_\\d+_/i").count(),
        }
      })

      runtime.attachArtifact("pageTranslationMalformedRichTextFallbackHoldout", {
        htmlPath: fixturePage.htmlPath,
        malformedFixtureHtmlPath,
        translatedHtmlPath,
        screenshotPath: capture.screenshotPath,
        requestCount: sourceResult.requestCount,
        restoredTagCount: capture.restoredTagCount,
        placeholderLeakCount: capture.placeholderLeakCount,
      })
      runtime.complete("Source-backed malformed rich-text placeholder fallback holdout completed.")
      const snapshot = runtime.snapshot()

      return {
        status: snapshot.status,
        summary:
          "Executed a source-backed malformed rich-text placeholder holdout and fell back to safe plain-text translations without leaking Astra placeholder tokens.",
        notes: [
          `Browser executable: ${capture.browserExecutablePath}`,
          `Artifact directory: ${fixturePage.artifactDir}`,
          `Translate requests: ${sourceResult.requestCount}`,
          `Restored rich-text tags after fallback: ${capture.restoredTagCount}`,
        ],
        artifacts: {
          browserExecutablePath: capture.browserExecutablePath,
          htmlPath: fixturePage.htmlPath,
          malformedFixtureHtmlPath,
          translatedHtmlPath,
          screenshotPath: capture.screenshotPath,
          browserTranslatedTexts: capture.translatedTexts,
          browserPlaceholderLeakCount: capture.placeholderLeakCount,
          browserRestoredTagCount: capture.restoredTagCount,
          translateCalls: sourceResult.translateCalls,
        },
        runtime: snapshot,
        startedAt: snapshot.startedAt,
        finishedAt: snapshot.finishedAt,
        pageTranslation: {
          ...sourceResult.pageTranslation,
          translatedTexts: capture.translatedTexts,
          placeholderLeakCount: capture.placeholderLeakCount,
          restoredRichTextTagCount: capture.restoredTagCount,
        },
      }
    } catch (error) {
      if (error instanceof LiveBrowserUnavailableError) {
        runtime.skip(error.message)
        const snapshot = runtime.snapshot()
        return {
          status: snapshot.status,
          summary:
            "The malformed rich-text placeholder fallback holdout ran, but no supported local browser executable was available for artifact capture.",
          notes: [error.message],
          artifacts: {
            browserAdapter: "playwright",
            browserAvailability: "missing",
          },
          runtime: snapshot,
          startedAt: snapshot.startedAt,
          finishedAt: snapshot.finishedAt,
          pageTranslation: {
            translatedNodeCount: 0,
            expectedNodeCount: 0,
            translationMarkerCount: 0,
            hiddenSourceCount: 0,
            requestCount: 0,
            skippedInteractiveTranslations: 0,
            translatedTexts: [],
            expectedTexts: [],
            snapshotPhase: "idle",
            failedBlocks: 0,
            payloadContext: null,
            requestTexts: [],
            requestPlaceholderCount: 0,
            translatedHtmlSnippets: [],
            placeholderLeakCount: 0,
            restoredRichTextTagCount: 0,
            notes: ["browser-unavailable"],
          },
        }
      }

      throw error
    }
  },
  async evaluate(execution, context) {
    if (execution.status === "skipped") {
      return {
        runId: context.runId,
        scenario: context.scenario,
        status: "skipped",
        pass: false,
        score: 0,
        summary: execution.summary ?? "Malformed rich-text placeholder fallback holdout was skipped.",
        issues: [],
        nextActions: [],
        notes: execution.notes ?? [],
        rubrics: [],
        artifacts: {
          browserArtifacts: execution.artifacts ?? {},
        },
        runtime: context.runtime,
      } as unknown as Partial<LiveEvaluationResult>
    }

    const issues: string[] = []
    const requestTexts = execution.pageTranslation.requestTexts ?? []
    const expectedFallbackTexts = requestTexts.map((text) => normalizeText(`ZH:${stripRichTextPlaceholders(text)}`))
    const actualTexts = execution.pageTranslation.translatedTexts.map(normalizeText)

    if ((execution.pageTranslation.requestPlaceholderCount ?? 0) === 0) {
      issues.push("rich-text request did not contain Astra placeholder tokens")
    }

    if ((execution.pageTranslation.placeholderLeakCount ?? 0) > 0) {
      issues.push(`placeholder tokens leaked into rendered DOM (${execution.pageTranslation.placeholderLeakCount})`)
    }

    if ((execution.pageTranslation.restoredRichTextTagCount ?? 0) > 0) {
      issues.push(`malformed placeholder fallback unexpectedly restored inline rich-text tags (${execution.pageTranslation.restoredRichTextTagCount})`)
    }

    if (execution.pageTranslation.failedBlocks > 0 || execution.pageTranslation.snapshotPhase !== "running") {
      issues.push(`page translation did not settle cleanly (phase=${execution.pageTranslation.snapshotPhase}, failedBlocks=${execution.pageTranslation.failedBlocks})`)
    }

    if (execution.pageTranslation.requestCount === 0) {
      issues.push("page translation did not issue any translate requests")
    }

    if (actualTexts.length !== expectedFallbackTexts.length) {
      issues.push(`fallback translated block count mismatch (expected=${expectedFallbackTexts.length}, actual=${actualTexts.length})`)
    } else {
      expectedFallbackTexts.forEach((expectedText, index) => {
        if (actualTexts[index] !== expectedText) {
          issues.push(`fallback text mismatch at block ${index + 1}`)
        }
      })
    }

    const pass = issues.length === 0

    return {
      runId: context.runId,
      scenario: context.scenario,
      status: pass ? "pass" : "fail",
      pass,
      score: pass ? 100 : 0,
      summary: pass
        ? "Malformed rich-text placeholder holdout fell back to safe plain text without leaking Astra tokens in the browser-backed source path."
        : "Malformed rich-text placeholder holdout exposed a browser-backed fallback regression.",
      issues,
      nextActions: pass ? [] : [
        "Inspect rich-text placeholder decode fallback in src/utils/dom/rich-text-placeholders.ts.",
        "Verify DOM injection fallback path in src/utils/dom/inject.ts and src/entrypoints/content/page-translate.ts.",
      ],
      notes: [
        ...(execution.notes ?? []),
        `Expected fallback text count: ${expectedFallbackTexts.length}`,
        `Actual fallback text count: ${actualTexts.length}`,
      ],
      rubrics: [],
      artifacts: {
        browserArtifacts: execution.artifacts ?? {},
        pageTranslationExecution: execution.pageTranslation,
        expectedFallbackTexts,
      },
      runtime: context.runtime,
    } as unknown as Partial<LiveEvaluationResult>
  },
}
