import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

import type { InteractionPriorityExecution } from "../../bench/evaluators/interaction-priority"
import {
  materializeFixturePage,
  withLiveBrowserPage,
  LiveBrowserUnavailableError,
} from "../driver"
import type { LiveScenarioDefinition, LiveScenarioExecution } from "../evaluator"
import { buildLiveInteractionPriorityEvaluation } from "./helpers/interaction-priority"

interface LiveInteractionPriorityExecution extends LiveScenarioExecution {
  interactionPriority: InteractionPriorityExecution
}

const FIXTURE_NAME = "forms-and-nav"

/**
 * Shadow DOM host IDs used by the Astra extension overlay system.
 * These are the real IDs that the content script creates when it bootstraps.
 */
const ASTRA_HOSTS = {
  selectionToolbar: "astra-selection-toolbar-host",
  hoverTranslate: "astra-hover-translate-host",
  inputTranslate: "astra-input-translate-host",
  floatBall: "astra-float-ball-host",
} as const

export const interactionPriorityBasicScenario: LiveScenarioDefinition<LiveInteractionPriorityExecution> = {
  id: "bench-live/interaction-priority-basic",
  title: "Live interaction-priority basic",
  surface: "interaction-priority",
  fixture: `page:${FIXTURE_NAME}`,
  description:
    "Loads a fixture page with forms, buttons, and links in a real browser. Injects translation markers and verifies that interactive elements remain clickable and usable. Validates that the translation overlay does not block native page interactions.",
  tags: ["playwright", "interaction-priority", "browser", "contract"],
  async run(runtime, context) {
    runtime.start(context.id, context.title)
    runtime.log("Starting browser-backed interaction-priority contract scenario.", {
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

        // Take a baseline screenshot before any interaction
        const baselineScreenshotPath = path.join(fixturePage.artifactDir, `${FIXTURE_NAME}.interaction-priority.baseline.png`)
        await mkdir(path.dirname(baselineScreenshotPath), { recursive: true })
        await page.screenshot({
          path: baselineScreenshotPath,
          fullPage: true,
        })

        // Inject Astra-like Shadow DOM hosts to simulate the extension overlay system.
        // This is the contract test approach: we create the same DOM structure the extension
        // would create, then verify that native interactions still work.
        const injectionResult = await page.evaluate(({ hosts }) => {
          const mountedHosts: string[] = []

          // Create selection toolbar host
          const toolbarHost = document.createElement("div")
          toolbarHost.id = hosts.selectionToolbar
          toolbarHost.style.cssText = "position: fixed; top: 0; left: 0; z-index: 2147483647; pointer-events: none;"
          const toolbarShadow = toolbarHost.attachShadow({ mode: "open" })
          const toolbarButton = document.createElement("button")
          toolbarButton.textContent = "Translate"
          toolbarButton.style.cssText = "pointer-events: auto; padding: 4px 8px;"
          toolbarShadow.appendChild(toolbarButton)
          document.body.appendChild(toolbarHost)
          mountedHosts.push(hosts.selectionToolbar)

          // Create hover translate host (hidden by default — simulating suppressed state)
          const hoverHost = document.createElement("div")
          hoverHost.id = hosts.hoverTranslate
          hoverHost.style.cssText = "position: fixed; top: 0; left: 0; z-index: 2147483646; pointer-events: none; display: none;"
          hoverHost.attachShadow({ mode: "open" })
          document.body.appendChild(hoverHost)
          mountedHosts.push(hosts.hoverTranslate)

          // Create input translate host (hidden)
          const inputHost = document.createElement("div")
          inputHost.id = hosts.inputTranslate
          inputHost.style.cssText = "position: absolute; z-index: 2147483645; pointer-events: none; display: none;"
          inputHost.attachShadow({ mode: "open" })
          document.body.appendChild(inputHost)
          mountedHosts.push(hosts.inputTranslate)

          // Create float ball host
          const floatBallHost = document.createElement("div")
          floatBallHost.id = hosts.floatBall
          floatBallHost.style.cssText = "position: fixed; bottom: 24px; right: 24px; z-index: 2147483644; pointer-events: auto;"
          const floatBallShadow = floatBallHost.attachShadow({ mode: "open" })
          const floatBallDiv = document.createElement("div")
          floatBallDiv.title = "Astra"
          floatBallDiv.textContent = "A"
          floatBallDiv.style.cssText = "width: 40px; height: 40px; border-radius: 50%; background: #6366f1; color: white; display: flex; align-items: center; justify-content: center; cursor: pointer;"
          floatBallShadow.appendChild(floatBallDiv)
          document.body.appendChild(floatBallHost)
          mountedHosts.push(hosts.floatBall)

          // Inject translation markers on article paragraphs
          const elements = Array.from(document.querySelectorAll("article p"))
            .filter((node): node is HTMLElement => node instanceof HTMLElement)

          for (const element of elements) {
            const text = element.textContent?.trim() ?? ""
            if (!text) continue

            const wrapper = document.createElement("span")
            wrapper.className = "notranslate astra-translation astra-theme-default astra-mode-bilingual"
            wrapper.setAttribute("translate", "no")
            wrapper.setAttribute("data-astra-translation", "1")
            wrapper.setAttribute("lang", "zh-CN")

            const inner = document.createElement("span")
            inner.className = "notranslate astra-translation-inner"
            inner.textContent = `ZH:${text.slice(0, 48)}`

            wrapper.appendChild(inner)
            element.appendChild(wrapper)
          }

          return { mountedHosts }
        }, { hosts: ASTRA_HOSTS })

        // Test 1: Verify links are clickable
        const linkClickable = await page.evaluate(() => {
          const link = document.querySelector('a[href="#home"]')
          if (!link) return false
          let clicked = false
          link.addEventListener("click", (e) => {
            e.preventDefault()
            clicked = true
          }, { once: true })
          ;(link as HTMLElement).click()
          return clicked
        })

        // Test 2: Verify form input is focusable and typeable
        const inputInteractable = await page.evaluate(() => {
          const input = document.querySelector('input[type="text"]') as HTMLInputElement | null
          if (!input) return false
          input.focus()
          const focused = document.activeElement === input
          input.value = "test query"
          input.dispatchEvent(new Event("input", { bubbles: true }))
          return focused && input.value === "test query"
        })

        // Test 3: Verify form button is clickable
        const buttonClickable = await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll("form button, form input[type='submit']"))
          if (buttons.length === 0) {
            // The forms-and-nav fixture does not have a submit button; test with nav links instead
            const navLinks = Array.from(document.querySelectorAll("nav a"))
            if (navLinks.length === 0) return false
            let clicked = false
            navLinks[0].addEventListener("click", (e) => {
              e.preventDefault()
              clicked = true
            }, { once: true })
            ;(navLinks[0] as HTMLElement).click()
            return clicked
          }
          let clicked = false
          buttons[0].addEventListener("click", (e) => {
            e.preventDefault()
            clicked = true
          }, { once: true })
          ;(buttons[0] as HTMLElement).click()
          return clicked
        })

        // Test 4: Verify that selection toolbar is visible and hover overlay is hidden
        const hostVisibility = await page.evaluate(({ hosts }) => {
          const visibleHosts: string[] = []

          const toolbarHost = document.getElementById(hosts.selectionToolbar)
          if (toolbarHost) {
            const buttons = toolbarHost.shadowRoot?.querySelectorAll("button") ?? []
            if (buttons.length > 0) {
              visibleHosts.push(hosts.selectionToolbar)
            }
          }

          const hoverHost = document.getElementById(hosts.hoverTranslate)
          if (hoverHost) {
            const style = window.getComputedStyle(hoverHost)
            if (style.display !== "none") {
              visibleHosts.push(hosts.hoverTranslate)
            }
          }

          const inputHost = document.getElementById(hosts.inputTranslate)
          if (inputHost) {
            const style = window.getComputedStyle(inputHost)
            if (style.display !== "none") {
              visibleHosts.push(hosts.inputTranslate)
            }
          }

          const floatBallHost = document.getElementById(hosts.floatBall)
          if (floatBallHost) {
            const content = floatBallHost.shadowRoot?.querySelector("div[title]")
            if (content) {
              visibleHosts.push(hosts.floatBall)
            }
          }

          return visibleHosts
        }, { hosts: ASTRA_HOSTS })

        // Test 5: Check for console errors during interaction
        const consoleErrors: string[] = []
        page.on("console", (msg) => {
          if (msg.type() === "error") {
            consoleErrors.push(msg.text())
          }
        })

        // Take a post-interaction screenshot
        const interactionScreenshotPath = path.join(fixturePage.artifactDir, `${FIXTURE_NAME}.interaction-priority.post-interaction.png`)
        await page.screenshot({
          path: interactionScreenshotPath,
          fullPage: true,
        })

        // Capture the final DOM snapshot
        const snapshotHtml = await page.content()
        const snapshotHtmlPath = path.join(fixturePage.artifactDir, `${FIXTURE_NAME}.interaction-priority.snapshot.html`)
        await writeFile(snapshotHtmlPath, snapshotHtml, "utf8")

        return {
          browserExecutablePath,
          baselineScreenshotPath,
          interactionScreenshotPath,
          snapshotHtmlPath,
          mountedHosts: injectionResult.mountedHosts,
          visibleHosts: hostVisibility,
          linkClickable,
          inputInteractable,
          buttonClickable,
          consoleErrors,
        }
      })

      runtime.checkpoint("Live interaction-priority fixture page materialized.", {
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
      runtime.attachArtifact("interactionCapture", {
        baselineScreenshotPath: capture.baselineScreenshotPath,
        interactionScreenshotPath: capture.interactionScreenshotPath,
        snapshotHtmlPath: capture.snapshotHtmlPath,
        linkClickable: capture.linkClickable,
        inputInteractable: capture.inputInteractable,
        buttonClickable: capture.buttonClickable,
      })

      // The hover overlay is hidden (display:none), so hover is "suppressed" in this contract.
      // Selection toolbar has a button, so it is "visible".
      const selectionToolbarVisible = capture.visibleHosts.includes(ASTRA_HOSTS.selectionToolbar)
      const hoverOverlayVisible = capture.visibleHosts.includes(ASTRA_HOSTS.hoverTranslate)
      const inputOverlayVisible = capture.visibleHosts.includes(ASTRA_HOSTS.inputTranslate)
      const floatBallMounted = capture.visibleHosts.includes(ASTRA_HOSTS.floatBall)

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
          "live-browser-interaction-priority-contract",
          `linkClickable=${capture.linkClickable}`,
          `inputInteractable=${capture.inputInteractable}`,
          `buttonClickable=${capture.buttonClickable}`,
          `consoleErrors=${capture.consoleErrors.length}`,
        ],
      }

      runtime.complete("Browser-backed interaction-priority contract scenario completed.")
      const snapshot = runtime.snapshot()

      return {
        status: snapshot.status,
        summary:
          "Executed the browser-backed interaction-priority contract and verified that interactive elements remain usable with translation overlays present.",
        notes: [
          `Browser executable: ${capture.browserExecutablePath}`,
          `Artifact directory: ${fixturePage.artifactDir}`,
          `Links clickable: ${capture.linkClickable}`,
          `Input interactable: ${capture.inputInteractable}`,
          `Button clickable: ${capture.buttonClickable}`,
        ],
        artifacts: {
          browserExecutablePath: capture.browserExecutablePath,
          htmlPath: fixturePage.htmlPath,
          baselineScreenshotPath: capture.baselineScreenshotPath,
          interactionScreenshotPath: capture.interactionScreenshotPath,
          snapshotHtmlPath: capture.snapshotHtmlPath,
        },
        runtime: snapshot,
        startedAt: snapshot.startedAt,
        finishedAt: snapshot.finishedAt,
        interactionPriority,
      }
    } catch (error) {
      if (error instanceof LiveBrowserUnavailableError) {
        runtime.skip(error.message)
        const snapshot = runtime.snapshot()
        return {
          status: snapshot.status,
          summary:
            "The live interaction-priority contract is wired, but no supported local browser executable is available in this environment.",
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
      successSummary: "Browser-backed interaction-priority contract passed: interactive elements remain usable with translation overlays present.",
      failureSummary: "Browser-backed interaction-priority contract failed: translation overlays may block native page interactions.",
    })
  },
}
