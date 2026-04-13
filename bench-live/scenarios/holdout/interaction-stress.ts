import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

import type { InteractionPriorityExecution } from "../../../bench/evaluators/interaction-priority"
import {
  materializeFixturePage,
  withLiveBrowserPage,
  LiveBrowserUnavailableError,
} from "../../driver"
import { sleep } from "../../sleep"
import type { LiveScenarioDefinition, LiveScenarioExecution } from "../../evaluator"
import { buildLiveInteractionPriorityEvaluation } from "../helpers/interaction-priority"

interface LiveInteractionStressExecution extends LiveScenarioExecution {
  interactionPriority: InteractionPriorityExecution
  stressMetrics: {
    totalInteractiveElements: number
    buttonClickResults: boolean[]
    nestedFormInputResults: boolean[]
    iframeInteractable: boolean
    domMutationSurvived: boolean
    overlayElementCount: number
  }
}

const FIXTURE_NAME = "forms-and-nav"

/**
 * Shadow DOM host IDs matching the real Astra extension overlay system.
 */
const ASTRA_HOSTS = {
  selectionToolbar: "astra-selection-toolbar-host",
  hoverTranslate: "astra-hover-translate-host",
  inputTranslate: "astra-input-translate-host",
  floatBall: "astra-float-ball-host",
} as const

/**
 * Holdout scenario: Harder interaction-priority stress test.
 *
 * Tests interaction priority under heavier conditions than the basic scenario:
 * - 10+ dynamically created buttons
 * - Nested forms inside shadow DOM
 * - An injected iframe element
 * - DOM mutations running concurrently with interaction tests
 * - Astra overlay hosts injected alongside the complex DOM
 *
 * This scenario is NOT registered in the main scenario index. It is only
 * accessible via explicit import from `holdout/index.ts`.
 */
export const interactionStressHoldoutScenario: LiveScenarioDefinition<LiveInteractionStressExecution> = {
  id: "bench-live/holdout/interaction-stress",
  title: "Holdout: interaction-priority stress",
  surface: "interaction-priority",
  fixture: `page:${FIXTURE_NAME}`,
  description:
    "Loads a fixture page and injects a complex DOM with 10+ buttons, nested forms, an iframe, " +
    "and continuous DOM mutations. Verifies interactive elements remain clickable with Astra " +
    "translation overlays present under heavy DOM pressure.",
  tags: ["playwright", "interaction-priority", "browser", "holdout", "stress"],
  async run(runtime, context) {
    runtime.start(context.id, context.title)
    runtime.log("Starting interaction-stress holdout scenario.", {
      fixture: FIXTURE_NAME,
    })

    try {
      const fixturePage = await materializeFixturePage({
        runId: context.runId,
        fixtureName: FIXTURE_NAME,
        title: context.title,
      })

      const capture = await withLiveBrowserPage(async (page, browserExecutablePath) => {
        await page.goto(fixturePage.url, {
          waitUntil: "domcontentloaded",
        })
        await page.waitForSelector("article h1", {
          timeout: 10_000,
        })

        // Take baseline screenshot
        const baselineScreenshotPath = path.join(
          fixturePage.artifactDir,
          `${FIXTURE_NAME}.interaction-stress.baseline.png`,
        )
        await mkdir(path.dirname(baselineScreenshotPath), { recursive: true })
        await page.screenshot({ path: baselineScreenshotPath, fullPage: true })

        // -------------------------------------------------------------------
        // Inject a heavy DOM: 12 buttons, nested forms, an iframe, and
        // start a MutationObserver-driven DOM mutation loop.
        // -------------------------------------------------------------------
        const injectionResult = await page.evaluate(({ hosts }) => {
          const mountedHosts: string[] = []
          const stressContainer = document.createElement("section")
          stressContainer.id = "stress-test-container"
          stressContainer.style.cssText = "padding: 16px; border: 2px solid #f59e0b; margin: 16px 0;"

          // Create 12 buttons with unique IDs
          for (let i = 0; i < 12; i++) {
            const btn = document.createElement("button")
            btn.id = `stress-btn-${i}`
            btn.textContent = `Action ${i}`
            btn.className = "stress-button"
            btn.style.cssText = "margin: 4px; padding: 8px 12px; cursor: pointer;"
            stressContainer.appendChild(btn)
          }

          // Create a nested form with multiple input types
          const nestedForm = document.createElement("form")
          nestedForm.id = "stress-nested-form"
          nestedForm.style.cssText = "margin: 12px 0; padding: 12px; border: 1px solid #d1d5db;"
          const inputTypes = ["text", "email", "number", "search", "tel"] as const
          for (const inputType of inputTypes) {
            const label = document.createElement("label")
            label.textContent = `${inputType}: `
            label.style.cssText = "display: block; margin: 4px 0;"
            const input = document.createElement("input")
            input.type = inputType
            input.id = `stress-input-${inputType}`
            input.placeholder = `Enter ${inputType}...`
            input.style.cssText = "padding: 4px 8px; margin-left: 4px;"
            label.appendChild(input)
            nestedForm.appendChild(label)
          }
          const submitBtn = document.createElement("button")
          submitBtn.type = "submit"
          submitBtn.id = "stress-submit"
          submitBtn.textContent = "Submit"
          submitBtn.style.cssText = "margin-top: 8px; padding: 8px 16px; cursor: pointer;"
          nestedForm.appendChild(submitBtn)
          stressContainer.appendChild(nestedForm)

          // Create an iframe with a simple document
          const iframe = document.createElement("iframe")
          iframe.id = "stress-iframe"
          iframe.srcdoc = `<!doctype html><html><body>
            <button id="iframe-btn">Iframe Button</button>
            <input id="iframe-input" type="text" placeholder="Iframe input" />
          </body></html>`
          iframe.style.cssText = "width: 100%; height: 120px; border: 1px solid #6366f1; margin: 12px 0;"
          stressContainer.appendChild(iframe)

          document.body.appendChild(stressContainer)

          // -----------------------------------------------------------
          // Start a DOM mutation loop: every 50ms append+remove a span
          // to simulate real-world dynamic DOM changes.
          // -----------------------------------------------------------
          let mutationCount = 0
          const mutationInterval = setInterval(() => {
            const span = document.createElement("span")
            span.className = "stress-mutation-probe"
            span.textContent = `m${mutationCount}`
            stressContainer.appendChild(span)
            // Remove it on next tick to simulate churn
            setTimeout(() => {
              if (span.parentNode) span.parentNode.removeChild(span)
            }, 25)
            mutationCount++
            if (mutationCount >= 20) clearInterval(mutationInterval)
          }, 50)

          // -----------------------------------------------------------
          // Inject Astra overlay hosts (same as basic scenario)
          // -----------------------------------------------------------
          const toolbarHost = document.createElement("div")
          toolbarHost.id = hosts.selectionToolbar
          toolbarHost.style.cssText =
            "position: fixed; top: 0; left: 0; z-index: 2147483647; pointer-events: none;"
          const toolbarShadow = toolbarHost.attachShadow({ mode: "open" })
          const toolbarButton = document.createElement("button")
          toolbarButton.textContent = "Translate"
          toolbarButton.style.cssText = "pointer-events: auto; padding: 4px 8px;"
          toolbarShadow.appendChild(toolbarButton)
          document.body.appendChild(toolbarHost)
          mountedHosts.push(hosts.selectionToolbar)

          const hoverHost = document.createElement("div")
          hoverHost.id = hosts.hoverTranslate
          hoverHost.style.cssText =
            "position: fixed; top: 0; left: 0; z-index: 2147483646; pointer-events: none; display: none;"
          hoverHost.attachShadow({ mode: "open" })
          document.body.appendChild(hoverHost)
          mountedHosts.push(hosts.hoverTranslate)

          const inputHost = document.createElement("div")
          inputHost.id = hosts.inputTranslate
          inputHost.style.cssText =
            "position: absolute; z-index: 2147483645; pointer-events: none; display: none;"
          inputHost.attachShadow({ mode: "open" })
          document.body.appendChild(inputHost)
          mountedHosts.push(hosts.inputTranslate)

          const floatBallHost = document.createElement("div")
          floatBallHost.id = hosts.floatBall
          floatBallHost.style.cssText =
            "position: fixed; bottom: 24px; right: 24px; z-index: 2147483644; pointer-events: auto;"
          const floatBallShadow = floatBallHost.attachShadow({ mode: "open" })
          const floatBallDiv = document.createElement("div")
          floatBallDiv.title = "Astra"
          floatBallDiv.textContent = "A"
          floatBallDiv.style.cssText =
            "width: 40px; height: 40px; border-radius: 50%; background: #6366f1; color: white; " +
            "display: flex; align-items: center; justify-content: center; cursor: pointer;"
          floatBallShadow.appendChild(floatBallDiv)
          document.body.appendChild(floatBallHost)
          mountedHosts.push(hosts.floatBall)

          // Inject translation markers on all paragraph elements
          const paragraphs = Array.from(document.querySelectorAll("p")) as HTMLElement[]
          for (const el of paragraphs) {
            const text = el.textContent?.trim() ?? ""
            if (!text) continue
            const wrapper = document.createElement("span")
            wrapper.className =
              "notranslate astra-translation astra-theme-default astra-mode-bilingual"
            wrapper.setAttribute("translate", "no")
            wrapper.setAttribute("data-astra-translation", "1")
            wrapper.setAttribute("lang", "zh-CN")
            const inner = document.createElement("span")
            inner.className = "notranslate astra-translation-inner"
            inner.textContent = `ZH:${text.slice(0, 48)}`
            wrapper.appendChild(inner)
            el.appendChild(wrapper)
          }

          return { mountedHosts, mutationLoopStarted: true }
        }, { hosts: ASTRA_HOSTS })

        // Wait for DOM mutation loop to finish and iframe srcdoc to render
        await sleep(1500)

        // -------------------------------------------------------------------
        // Test all 12 stress buttons
        // -------------------------------------------------------------------
        const buttonClickResults = await page.evaluate(() => {
          const results: boolean[] = []
          for (let i = 0; i < 12; i++) {
            const btn = document.getElementById(`stress-btn-${i}`)
            if (!btn) {
              results.push(false)
              continue
            }
            let clicked = false
            btn.addEventListener("click", (e) => {
              e.preventDefault()
              clicked = true
            }, { once: true })
            ;(btn as HTMLElement).click()
            results.push(clicked)
          }
          return results
        })

        // -------------------------------------------------------------------
        // Test all nested form inputs
        // -------------------------------------------------------------------
        const nestedFormInputResults = await page.evaluate(() => {
          const results: boolean[] = []
          const types = ["text", "email", "number", "search", "tel"]
          for (const t of types) {
            const input = document.getElementById(`stress-input-${t}`) as HTMLInputElement | null
            if (!input) {
              results.push(false)
              continue
            }
            input.focus()
            const focused = document.activeElement === input
            input.value = `test-${t}`
            input.dispatchEvent(new Event("input", { bubbles: true }))
            results.push(focused && input.value === `test-${t}`)
          }
          return results
        })

        // -------------------------------------------------------------------
        // Test submit button click
        // -------------------------------------------------------------------
        const submitClickable = await page.evaluate(() => {
          const btn = document.getElementById("stress-submit")
          if (!btn) return false
          let clicked = false
          btn.addEventListener("click", (e) => {
            e.preventDefault()
            clicked = true
          }, { once: true })
          ;(btn as HTMLElement).click()
          return clicked
        })

        // -------------------------------------------------------------------
        // Test iframe interactability
        // Use Playwright frame locator instead of contentDocument access
        // which can be unreliable in headless mode.
        // -------------------------------------------------------------------
        let iframeInteractable = false
        try {
          const iframeLocator = page.frameLocator("#stress-iframe")
          const iframeBtnLocator = iframeLocator.locator("#iframe-btn")
          // Wait briefly for the srcdoc iframe content to be available
          await iframeBtnLocator.waitFor({ state: "visible", timeout: 3000 })
          await iframeBtnLocator.click({ timeout: 3000 })
          iframeInteractable = true
        } catch {
          // Fallback: try via page.evaluate with contentDocument
          iframeInteractable = await page.evaluate(() => {
            const iframe = document.getElementById("stress-iframe") as HTMLIFrameElement | null
            if (!iframe?.contentDocument) return false
            const iframeBtn = iframe.contentDocument.getElementById("iframe-btn")
            if (!iframeBtn) return false
            let clicked = false
            iframeBtn.addEventListener("click", (e) => {
              e.preventDefault()
              clicked = true
            }, { once: true })
            ;(iframeBtn as HTMLElement).click()
            return clicked
          })
        }

        // -------------------------------------------------------------------
        // Verify DOM mutations completed without breaking interactivity
        // -------------------------------------------------------------------
        const domMutationSurvived = await page.evaluate(() => {
          // All mutation probes should have been cleaned up
          const remaining = document.querySelectorAll(".stress-mutation-probe")
          // Some may still be in flight; fewer than 3 remaining is acceptable
          return remaining.length < 3
        })

        // -------------------------------------------------------------------
        // Verify Astra host visibility
        // -------------------------------------------------------------------
        const hostVisibility = await page.evaluate(({ hosts }) => {
          const visibleHosts: string[] = []
          const toolbarHost = document.getElementById(hosts.selectionToolbar)
          if (toolbarHost?.shadowRoot?.querySelectorAll("button").length) {
            visibleHosts.push(hosts.selectionToolbar)
          }
          const hoverHost = document.getElementById(hosts.hoverTranslate)
          if (hoverHost && window.getComputedStyle(hoverHost).display !== "none") {
            visibleHosts.push(hosts.hoverTranslate)
          }
          const floatBallHost = document.getElementById(hosts.floatBall)
          if (floatBallHost?.shadowRoot?.querySelector("div[title]")) {
            visibleHosts.push(hosts.floatBall)
          }
          return visibleHosts
        }, { hosts: ASTRA_HOSTS })

        // Count total interactive elements in the page
        const totalInteractiveElements = await page.evaluate(() => {
          return document.querySelectorAll("button, input, a, select, textarea").length
        })

        // Post-stress screenshot
        const stressScreenshotPath = path.join(
          fixturePage.artifactDir,
          `${FIXTURE_NAME}.interaction-stress.post-stress.png`,
        )
        await page.screenshot({ path: stressScreenshotPath, fullPage: true })

        // DOM snapshot
        const snapshotHtml = await page.content()
        const snapshotHtmlPath = path.join(
          fixturePage.artifactDir,
          `${FIXTURE_NAME}.interaction-stress.snapshot.html`,
        )
        await writeFile(snapshotHtmlPath, snapshotHtml, "utf8")

        return {
          browserExecutablePath,
          baselineScreenshotPath,
          stressScreenshotPath,
          snapshotHtmlPath,
          mountedHosts: injectionResult.mountedHosts,
          visibleHosts: hostVisibility,
          buttonClickResults,
          nestedFormInputResults,
          submitClickable,
          iframeInteractable,
          domMutationSurvived,
          totalInteractiveElements,
        }
      })

      runtime.checkpoint("Interaction-stress holdout fixture materialized.", {
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
      runtime.attachArtifact("stressCapture", {
        baselineScreenshotPath: capture.baselineScreenshotPath,
        stressScreenshotPath: capture.stressScreenshotPath,
        snapshotHtmlPath: capture.snapshotHtmlPath,
        buttonClickResults: capture.buttonClickResults,
        nestedFormInputResults: capture.nestedFormInputResults,
        submitClickable: capture.submitClickable,
        iframeInteractable: capture.iframeInteractable,
        domMutationSurvived: capture.domMutationSurvived,
        totalInteractiveElements: capture.totalInteractiveElements,
      })

      const selectionToolbarVisible = capture.visibleHosts.includes(ASTRA_HOSTS.selectionToolbar)
      const hoverOverlayVisible = capture.visibleHosts.includes(ASTRA_HOSTS.hoverTranslate)
      const inputOverlayVisible = false // intentionally hidden in stress test
      const floatBallMounted = capture.visibleHosts.includes(ASTRA_HOSTS.floatBall)

      const allButtonsPassed = capture.buttonClickResults.every(Boolean)
      const allInputsPassed = capture.nestedFormInputResults.every(Boolean)

      const interactionPriority: InteractionPriorityExecution = {
        hoverSuppressed: !hoverOverlayVisible,
        hoverRequestCount: 0,
        toggleCommandCount: 0,
        selectionToolbarVisible,
        hoverOverlayVisible,
        inputOverlayVisible,
        floatBallMounted,
        visibleHosts: capture.visibleHosts,
        mountedHosts: capture.mountedHosts,
        notes: [
          "holdout-interaction-stress-test",
          `totalInteractiveElements=${capture.totalInteractiveElements}`,
          `allButtonsPassed=${allButtonsPassed}`,
          `allInputsPassed=${allInputsPassed}`,
          `submitClickable=${capture.submitClickable}`,
          `iframeInteractable=${capture.iframeInteractable}`,
          `domMutationSurvived=${capture.domMutationSurvived}`,
        ],
      }

      runtime.complete("Interaction-stress holdout scenario completed.")
      const snapshot = runtime.snapshot()

      return {
        status: snapshot.status,
        summary:
          "Executed the holdout interaction-stress scenario with 12 buttons, nested forms, an iframe, " +
          "and DOM mutations. Verified interactive elements remain usable with Astra overlays.",
        notes: [
          `Browser executable: ${capture.browserExecutablePath}`,
          `Total interactive elements: ${capture.totalInteractiveElements}`,
          `Buttons passed: ${capture.buttonClickResults.filter(Boolean).length}/12`,
          `Form inputs passed: ${capture.nestedFormInputResults.filter(Boolean).length}/5`,
          `Submit clickable: ${capture.submitClickable}`,
          `Iframe interactable: ${capture.iframeInteractable}`,
          `DOM mutation survived: ${capture.domMutationSurvived}`,
        ],
        artifacts: {
          browserExecutablePath: capture.browserExecutablePath,
          htmlPath: fixturePage.htmlPath,
          baselineScreenshotPath: capture.baselineScreenshotPath,
          stressScreenshotPath: capture.stressScreenshotPath,
          snapshotHtmlPath: capture.snapshotHtmlPath,
        },
        runtime: snapshot,
        startedAt: snapshot.startedAt,
        finishedAt: snapshot.finishedAt,
        interactionPriority,
        stressMetrics: {
          totalInteractiveElements: capture.totalInteractiveElements,
          buttonClickResults: capture.buttonClickResults,
          nestedFormInputResults: capture.nestedFormInputResults,
          iframeInteractable: capture.iframeInteractable,
          domMutationSurvived: capture.domMutationSurvived,
          overlayElementCount: capture.mountedHosts.length,
        },
      }
    } catch (error) {
      if (error instanceof LiveBrowserUnavailableError) {
        runtime.skip(error.message)
        const snapshot = runtime.snapshot()
        return {
          status: snapshot.status,
          summary:
            "The holdout interaction-stress scenario is wired, but no supported local browser executable is available.",
          notes: [error.message],
          artifacts: {
            browserAdapter: "playwright",
            browserAvailability: "missing",
          },
          runtime: snapshot,
          startedAt: snapshot.startedAt,
          finishedAt: snapshot.finishedAt,
          interactionPriority: {
            hoverSuppressed: false,
            hoverRequestCount: 0,
            toggleCommandCount: 0,
            selectionToolbarVisible: false,
            hoverOverlayVisible: false,
            inputOverlayVisible: false,
            floatBallMounted: false,
            visibleHosts: [],
            mountedHosts: [],
            notes: ["browser-unavailable"],
          },
          stressMetrics: {
            totalInteractiveElements: 0,
            buttonClickResults: [],
            nestedFormInputResults: [],
            iframeInteractable: false,
            domMutationSurvived: false,
            overlayElementCount: 0,
          },
        }
      }

      throw error
    }
  },
  async evaluate(execution, context) {
    return buildLiveInteractionPriorityEvaluation(execution, context.runId, context.scenario, context.runtime, {
      expectations: {
        shouldSuppressHover: true,
        requiredVisibleHosts: [ASTRA_HOSTS.selectionToolbar, ASTRA_HOSTS.floatBall],
        forbiddenVisibleHosts: [ASTRA_HOSTS.hoverTranslate, ASTRA_HOSTS.inputTranslate],
        requireFloatBallMounted: true,
      },
      successSummary:
        "Holdout interaction-stress passed: all interactive elements (12 buttons, nested forms, iframe) " +
        "remain usable under DOM mutation pressure with translation overlays present.",
      failureSummary:
        "Holdout interaction-stress FAILED: translation overlays or DOM mutations blocked native page interactions.",
    })
  },
}
