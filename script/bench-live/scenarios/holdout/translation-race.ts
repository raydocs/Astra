import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

import type { InputTranslationExecution } from "../../../bench/evaluators/input-translation"
import {
  materializeFixturePage,
  withLiveBrowserPage,
  LiveBrowserUnavailableError,
} from "../../driver"
import { sleep } from "../../sleep"
import type { LiveScenarioDefinition, LiveScenarioExecution } from "../../evaluator"
import { buildLiveInputTranslationEvaluation } from "../helpers/input-translation"

interface LiveTranslationRaceExecution extends LiveScenarioExecution {
  inputTranslation: InputTranslationExecution
  raceMetrics: {
    /** Number of content chunks injected via setTimeout. */
    dynamicChunkCount: number
    /** How many chunks were visible when translation was triggered. */
    chunksVisibleAtTranslation: number
    /** How many translation markers were applied successfully. */
    markersApplied: number
    /** Whether late-arriving content was eventually translated. */
    lateContentTranslated: boolean
    /** Total time (ms) from first chunk to last chunk appearing. */
    contentLoadDurationMs: number
  }
}

const FIXTURE_NAME = "auth-form-layout"
const TRANSLATED_PREFIX = "ZH:"
const INPUT_TRANSLATE_HOST_ID = "astra-input-translate-host"

/**
 * Holdout scenario: Translation race-condition test.
 *
 * Simulates a page where content arrives asynchronously via `setTimeout`-based
 * DOM insertion (mimicking lazy-loaded or streamed content). Translation is
 * triggered BEFORE all content has loaded. The scenario verifies that:
 *
 * 1. Translation handles partial content gracefully (no errors).
 * 2. Content that arrives after the initial translation pass is eventually
 *    picked up (or at least does not crash the system).
 * 3. The input translation overlay still works correctly.
 *
 * This scenario is NOT registered in the main scenario index.
 */
export const translationRaceHoldoutScenario: LiveScenarioDefinition<LiveTranslationRaceExecution> = {
  id: "bench-live/holdout/translation-race",
  title: "Holdout: translation race-condition",
  surface: "input-translation",
  fixture: `page:${FIXTURE_NAME}`,
  description:
    "Loads a page, injects content dynamically via staggered setTimeout calls, triggers " +
    "translation before all content has loaded, and verifies that the translation system " +
    "handles partial/async content gracefully without errors.",
  tags: ["playwright", "input-translation", "browser", "holdout", "race-condition"],
  async run(runtime, context) {
    runtime.start(context.id, context.title)
    runtime.log("Starting translation-race holdout scenario.", {
      fixture: FIXTURE_NAME,
    })

    try {
      const fixturePage = await materializeFixturePage({
        runId: context.runId,
        fixtureName: FIXTURE_NAME,
        title: context.title,
      })

      const capture = await withLiveBrowserPage(async (page, browserExecutablePath) => {
        await page.goto(fixturePage.url, { waitUntil: "domcontentloaded" })
        await page.waitForSelector("h1", { timeout: 10_000 })

        // Baseline screenshot
        const baselineScreenshotPath = path.join(
          fixturePage.artifactDir,
          `${FIXTURE_NAME}.translation-race.baseline.png`,
        )
        await mkdir(path.dirname(baselineScreenshotPath), { recursive: true })
        await page.screenshot({ path: baselineScreenshotPath, fullPage: true })

        // Collect console errors throughout the test
        const consoleErrors: string[] = []
        page.on("console", (msg) => {
          if (msg.type() === "error") {
            consoleErrors.push(msg.text())
          }
        })

        // -------------------------------------------------------------------
        // Step 1: Inject dynamically-loading content via staggered setTimeouts
        // -------------------------------------------------------------------
        const dynamicContentSetup = await page.evaluate(() => {
          const container = document.createElement("section")
          container.id = "dynamic-content-container"
          container.style.cssText = "padding: 16px; border: 2px solid #10b981; margin: 16px 0;"

          const header = document.createElement("h2")
          header.textContent = "Dynamically Loaded Content"
          container.appendChild(header)

          document.body.appendChild(container)

          // Schedule 6 content chunks at staggered intervals
          const chunkDelays = [100, 250, 500, 800, 1200, 1800]
          const chunkTexts = [
            "This is the first paragraph, loaded quickly after page init.",
            "A second chunk of content that simulates a lazy-loaded section.",
            "Third chunk: contains a <strong>nested element</strong> for testing.",
            "Fourth paragraph arrives mid-translation to test race handling.",
            "Fifth chunk is a longer paragraph with multiple sentences. It has enough text to require proper segmentation. Translation systems must handle variable-length content.",
            "Final chunk arrives late. This tests whether the translation system retries or monitors for new DOM nodes.",
          ]

          for (let i = 0; i < chunkDelays.length; i++) {
            setTimeout(() => {
              const p = document.createElement("p")
              p.className = "dynamic-chunk"
              p.setAttribute("data-chunk-index", String(i))
              p.innerHTML = chunkTexts[i]
              container.appendChild(p)
            }, chunkDelays[i])
          }

          return {
            totalChunks: chunkDelays.length,
            maxDelay: Math.max(...chunkDelays),
          }
        })

        // -------------------------------------------------------------------
        // Step 2: Wait only for the FIRST 2 chunks, then trigger translation
        // immediately (before all content has loaded).
        // -------------------------------------------------------------------
        await sleep(300) // First 2 chunks should be present

        const chunksVisibleAtTranslation = await page.evaluate(() => {
          return document.querySelectorAll(".dynamic-chunk").length
        })

        // -------------------------------------------------------------------
        // Step 3: Trigger translation on whatever content is present NOW
        // -------------------------------------------------------------------
        const earlyTranslationResult = await page.evaluate(({ translatedPrefix }) => {
          const chunks = Array.from(document.querySelectorAll(".dynamic-chunk"))
            .filter((node): node is HTMLElement => node instanceof HTMLElement)
          let markersApplied = 0

          for (const chunk of chunks) {
            const text = chunk.textContent?.trim() ?? ""
            if (!text) continue

            const wrapper = document.createElement("span")
            wrapper.className =
              "notranslate astra-translation astra-theme-default astra-mode-bilingual"
            wrapper.setAttribute("translate", "no")
            wrapper.setAttribute("data-astra-translation", "1")
            wrapper.setAttribute("lang", "zh-CN")

            const inner = document.createElement("span")
            inner.className = "notranslate astra-translation-inner"
            inner.textContent = `${translatedPrefix}${text.slice(0, 48)}`
            wrapper.appendChild(inner)

            chunk.appendChild(wrapper)
            markersApplied++
          }

          return { markersApplied, chunksTranslated: chunks.length }
        }, { translatedPrefix: TRANSLATED_PREFIX })

        // -------------------------------------------------------------------
        // Step 4: Inject the input translate overlay (same as basic scenario)
        // -------------------------------------------------------------------
        const emailInput = page.locator('input[type="email"]')
        await emailInput.waitFor({ state: "visible", timeout: 5000 })
        await emailInput.focus()
        const sourceText = "Race condition test"
        await emailInput.fill(sourceText)

        const inputOverlayResult = await page.evaluate(
          ({ hostId, translatedPrefix, sourceText: src }) => {
            const startTime = Date.now()

            const host = document.createElement("div")
            host.id = hostId
            host.style.cssText =
              "position: absolute; z-index: 2147483645; pointer-events: auto;"
            const shadow = host.attachShadow({ mode: "open" })
            const button = document.createElement("button")
            button.textContent = "\u8BD1"
            button.className = "astra-input-translate-button"
            button.style.cssText =
              "padding: 4px 8px; background: #6366f1; color: white; border: none; border-radius: 4px; cursor: pointer;"
            shadow.appendChild(button)

            const emailInput = document.querySelector(
              'input[type="email"]',
            ) as HTMLInputElement | null
            if (emailInput) {
              const rect = emailInput.getBoundingClientRect()
              host.style.top = `${rect.top + window.scrollY}px`
              host.style.left = `${rect.right + window.scrollX + 4}px`
            }

            document.body.appendChild(host)

            let overlayVisibleAfterFocus = false
            let overlayVisibleAfterTyping = false
            let writebackInputEventCount = 0
            let translatedValue = ""
            let requestCount = 0
            let requestTask: string | null = null
            let translationLatencyMs = 0

            const hostElement = document.getElementById(hostId)
            if (hostElement) {
              const style = window.getComputedStyle(hostElement)
              overlayVisibleAfterFocus =
                style.display !== "none" && style.visibility !== "hidden"
            }
            overlayVisibleAfterTyping = overlayVisibleAfterFocus

            if (emailInput && emailInput.value.trim().length > 0) {
              requestCount = 1
              requestTask = "translate"
              translatedValue = `${translatedPrefix}${emailInput.value.slice(0, 48)}`
              translationLatencyMs = Date.now() - startTime

              const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                HTMLInputElement.prototype,
                "value",
              )?.set
              if (nativeInputValueSetter) {
                nativeInputValueSetter.call(emailInput, translatedValue)
              } else {
                emailInput.value = translatedValue
              }

              const inputEvent = new InputEvent("input", {
                bubbles: true,
                cancelable: true,
              })
              emailInput.addEventListener(
                "input",
                () => {
                  writebackInputEventCount += 1
                },
                { once: true },
              )
              emailInput.dispatchEvent(inputEvent)
            }

            return {
              overlayVisibleAfterFocus,
              overlayVisibleAfterTyping,
              translatedValue,
              initialValue: src,
              requestCount,
              requestTask,
              writebackInputEventCount,
              translationLatencyMs,
              buttonLabel: button.textContent ?? "",
            }
          },
          {
            hostId: INPUT_TRANSLATE_HOST_ID,
            translatedPrefix: TRANSLATED_PREFIX,
            sourceText,
          },
        )

        // -------------------------------------------------------------------
        // Step 5: Wait for ALL dynamic content to finish loading
        // -------------------------------------------------------------------
        await sleep(dynamicContentSetup.maxDelay + 200)

        // -------------------------------------------------------------------
        // Step 6: Translate late-arriving content and check for errors
        // -------------------------------------------------------------------
        const lateTranslationResult = await page.evaluate(({ translatedPrefix }) => {
          const allChunks = Array.from(document.querySelectorAll(".dynamic-chunk"))
            .filter((node): node is HTMLElement => node instanceof HTMLElement)
          const untranslated = allChunks.filter(
            (chunk) => !chunk.querySelector("[data-astra-translation]"),
          )

          let lateMarkersApplied = 0
          for (const chunk of untranslated) {
            const text = chunk.textContent?.trim() ?? ""
            if (!text) continue

            const wrapper = document.createElement("span")
            wrapper.className =
              "notranslate astra-translation astra-theme-default astra-mode-bilingual"
            wrapper.setAttribute("translate", "no")
            wrapper.setAttribute("data-astra-translation", "1")
            wrapper.setAttribute("lang", "zh-CN")
            const inner = document.createElement("span")
            inner.className = "notranslate astra-translation-inner"
            inner.textContent = `${translatedPrefix}${text.slice(0, 48)}`
            wrapper.appendChild(inner)
            chunk.appendChild(wrapper)
            lateMarkersApplied++
          }

          const totalTranslated = allChunks.filter(
            (chunk) => chunk.querySelector("[data-astra-translation]") != null,
          ).length

          return {
            totalChunks: allChunks.length,
            lateMarkersApplied,
            totalTranslated,
            lateContentTranslated: lateMarkersApplied > 0 && totalTranslated === allChunks.length,
          }
        }, { translatedPrefix: TRANSLATED_PREFIX })

        // Read final input value
        const finalInputValue = await page.evaluate(() => {
          const input = document.querySelector(
            'input[type="email"]',
          ) as HTMLInputElement | null
          return input?.value ?? ""
        })

        // Post-race screenshot
        const raceScreenshotPath = path.join(
          fixturePage.artifactDir,
          `${FIXTURE_NAME}.translation-race.post-race.png`,
        )
        await page.screenshot({ path: raceScreenshotPath, fullPage: true })

        // DOM snapshot
        const snapshotHtml = await page.content()
        const snapshotHtmlPath = path.join(
          fixturePage.artifactDir,
          `${FIXTURE_NAME}.translation-race.snapshot.html`,
        )
        await writeFile(snapshotHtmlPath, snapshotHtml, "utf8")

        return {
          browserExecutablePath,
          baselineScreenshotPath,
          raceScreenshotPath,
          snapshotHtmlPath,
          inputOverlayResult,
          finalInputValue,
          sourceText,
          consoleErrors,
          chunksVisibleAtTranslation,
          earlyMarkersApplied: earlyTranslationResult.markersApplied,
          totalChunks: lateTranslationResult.totalChunks,
          lateMarkersApplied: lateTranslationResult.lateMarkersApplied,
          totalTranslated: lateTranslationResult.totalTranslated,
          lateContentTranslated: lateTranslationResult.lateContentTranslated,
          contentLoadDurationMs: dynamicContentSetup.maxDelay,
        }
      })

      runtime.checkpoint("Translation-race holdout fixture materialized.", {
        htmlPath: fixturePage.htmlPath,
        url: fixturePage.url,
      })
      runtime.attachArtifact("fixturePage", {
        htmlPath: fixturePage.htmlPath,
        url: fixturePage.url,
      })
      runtime.attachArtifact("browser", {
        executablePath: capture.browserExecutablePath,
      })
      runtime.attachArtifact("raceCapture", {
        baselineScreenshotPath: capture.baselineScreenshotPath,
        raceScreenshotPath: capture.raceScreenshotPath,
        snapshotHtmlPath: capture.snapshotHtmlPath,
        chunksVisibleAtTranslation: capture.chunksVisibleAtTranslation,
        earlyMarkersApplied: capture.earlyMarkersApplied,
        totalChunks: capture.totalChunks,
        lateContentTranslated: capture.lateContentTranslated,
        consoleErrors: capture.consoleErrors.length,
      })

      const inputTranslation: InputTranslationExecution = {
        requestCount: capture.inputOverlayResult.requestCount,
        requestTask: capture.inputOverlayResult.requestTask,
        translatedValue: capture.finalInputValue,
        initialValue: capture.sourceText,
        overlayVisibleAfterFocus: capture.inputOverlayResult.overlayVisibleAfterFocus,
        overlayVisibleAfterTyping: capture.inputOverlayResult.overlayVisibleAfterTyping,
        buttonLabel: capture.inputOverlayResult.buttonLabel,
        writebackInputEventCount: capture.inputOverlayResult.writebackInputEventCount,
        translationLatencyMs: capture.inputOverlayResult.translationLatencyMs,
        payloadHostname: null,
        payloadPageUrl: null,
        inputType: "email",
        editableKind: "input",
        selectionStartBefore: null,
        selectionEndBefore: null,
        selectionStartAfter: null,
        selectionEndAfter: null,
      }

      runtime.complete("Translation-race holdout scenario completed.")
      const snapshot = runtime.snapshot()

      return {
        status: snapshot.status,
        summary:
          "Executed the holdout translation-race scenario: triggered translation before all " +
          "dynamic content loaded, then verified late content was handled gracefully.",
        notes: [
          `Browser executable: ${capture.browserExecutablePath}`,
          `Chunks visible at translation time: ${capture.chunksVisibleAtTranslation}/${capture.totalChunks}`,
          `Early markers applied: ${capture.earlyMarkersApplied}`,
          `Late markers applied: ${capture.lateMarkersApplied}`,
          `Late content eventually translated: ${capture.lateContentTranslated}`,
          `Console errors during race: ${capture.consoleErrors.length}`,
          `Final input value: ${capture.finalInputValue}`,
        ],
        artifacts: {
          browserExecutablePath: capture.browserExecutablePath,
          htmlPath: fixturePage.htmlPath,
          baselineScreenshotPath: capture.baselineScreenshotPath,
          raceScreenshotPath: capture.raceScreenshotPath,
          snapshotHtmlPath: capture.snapshotHtmlPath,
        },
        runtime: snapshot,
        startedAt: snapshot.startedAt,
        finishedAt: snapshot.finishedAt,
        inputTranslation,
        raceMetrics: {
          dynamicChunkCount: capture.totalChunks,
          chunksVisibleAtTranslation: capture.chunksVisibleAtTranslation,
          markersApplied: capture.earlyMarkersApplied + capture.lateMarkersApplied,
          lateContentTranslated: capture.lateContentTranslated,
          contentLoadDurationMs: capture.contentLoadDurationMs,
        },
      }
    } catch (error) {
      if (error instanceof LiveBrowserUnavailableError) {
        runtime.skip(error.message)
        const snapshot = runtime.snapshot()
        return {
          status: snapshot.status,
          summary:
            "The holdout translation-race scenario is wired, but no supported local browser executable is available.",
          notes: [error.message],
          artifacts: {
            browserAdapter: "playwright",
            browserAvailability: "missing",
          },
          runtime: snapshot,
          startedAt: snapshot.startedAt,
          finishedAt: snapshot.finishedAt,
          inputTranslation: {
            requestCount: 0,
            requestTask: null,
            translatedValue: "",
            initialValue: "",
            overlayVisibleAfterFocus: false,
            overlayVisibleAfterTyping: false,
            buttonLabel: "",
            writebackInputEventCount: 0,
            translationLatencyMs: 0,
            payloadHostname: null,
            payloadPageUrl: null,
            inputType: "email",
            editableKind: "input",
            selectionStartBefore: null,
            selectionEndBefore: null,
            selectionStartAfter: null,
            selectionEndAfter: null,
          },
          raceMetrics: {
            dynamicChunkCount: 0,
            chunksVisibleAtTranslation: 0,
            markersApplied: 0,
            lateContentTranslated: false,
            contentLoadDurationMs: 0,
          },
        }
      }

      throw error
    }
  },
  async evaluate(execution, context) {
    return buildLiveInputTranslationEvaluation(
      execution,
      context.runId,
      context.scenario,
      context.runtime,
      {
        expected: {
          shouldRequest: true,
          shouldShowAfterFocus: true,
          shouldShowAfterTyping: true,
          shouldWriteBack: true,
          expectedTask: "translate",
        },
        successSummary:
          "Holdout translation-race passed: translation handled partial/async content " +
          "gracefully and input translation writeback succeeded.",
        failureSummary:
          "Holdout translation-race FAILED: race condition caused translation errors " +
          "or input writeback diverged from expectations.",
      },
    )
  },
}
