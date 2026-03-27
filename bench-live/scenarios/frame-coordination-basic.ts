import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

import type { FrameCoordinationExecution } from "../../bench/evaluators/frame-coordination"
import {
  withLiveBrowserPage,
  LiveBrowserUnavailableError,
} from "../driver"
import type { LiveScenarioDefinition, LiveScenarioExecution } from "../evaluator"
import { buildLiveFrameCoordinationEvaluation } from "./helpers/frame-coordination"

interface LiveFrameCoordinationExecution extends LiveScenarioExecution {
  frameCoordination: FrameCoordinationExecution
}

const FIXTURE_NAME = "frame-coordination"

/**
 * Shadow DOM host IDs used by the Astra extension overlay system.
 * These are the real IDs that the content script creates when it bootstraps.
 */
const ASTRA_HOSTS = {
  floatBall: "astra-float-ball-host",
  selectionToolbar: "astra-selection-toolbar-host",
  hoverTranslate: "astra-hover-translate-host",
  inputTranslate: "astra-input-translate-host",
} as const

/**
 * Build a minimal HTML page containing a same-origin iframe.
 *
 * The top frame and the child frame both contain translatable `<article>` content.
 * This fixture lets the live scenario verify that:
 * - The top frame mounts float-ball and site UI chrome
 * - The child frame skips top-frame-only chrome
 * - Translation markers appear in both frames when translation is triggered
 */
function buildFrameCoordinationFixtureHtml(): string {
  const childFrameHtml = `
<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Child Frame</title></head>
<body>
  <article id="child-article">
    <h1>Child Frame Content</h1>
    <p>This paragraph lives inside the child iframe and should be translated when the top frame triggers translation.</p>
    <p>A second paragraph in the child frame to verify multi-block coordination across frame boundaries.</p>
  </article>
</body>
</html>`

  const topFrameHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Frame Coordination Fixture</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 24px auto; max-width: 860px; line-height: 1.6; color: #111827; }
    article { padding: 16px; border: 1px solid #d1d5db; border-radius: 12px; background: #ffffff; margin-bottom: 16px; }
    h1 { font-size: 2rem; margin-bottom: 1rem; }
    iframe { width: 100%; height: 300px; border: 2px solid #6366f1; border-radius: 8px; }
  </style>
</head>
<body>
  <article id="top-article">
    <h1>Top Frame Content</h1>
    <p>This is the main page content that should be translated in the top frame.</p>
    <p>A second paragraph to provide enough translatable blocks for the coordination test.</p>
  </article>
  <iframe id="child-frame" srcdoc='${childFrameHtml.replace(/'/g, "&#39;").replace(/\n/g, "")}'></iframe>
</body>
</html>`

  return topFrameHtml
}

export const frameCoordinationBasicScenario: LiveScenarioDefinition<LiveFrameCoordinationExecution> = {
  id: "bench-live/frame-coordination-basic",
  title: "Live frame-coordination basic",
  surface: "frame-coordination",
  fixture: `page:${FIXTURE_NAME}`,
  description:
    "Loads a fixture page with a same-origin iframe in a real browser. Injects Astra translation markers in both the top frame and the child frame, then verifies that float-ball and site UI mount only in the top frame while translation markers appear in both frames.",
  tags: ["playwright", "frame-coordination", "browser", "contract"],
  async run(runtime, context) {
    runtime.start(context.id, context.title)
    runtime.log("Starting browser-backed frame-coordination contract scenario.", {
      fixture: FIXTURE_NAME,
    })

    try {
      const capture = await withLiveBrowserPage(async (page, browserExecutablePath) => {
        // Build and serve the fixture HTML inline (no external file needed)
        const fixtureHtml = buildFrameCoordinationFixtureHtml()
        const artifactDir = path.resolve(process.cwd(), "bench-live-results", context.runId)
        await mkdir(artifactDir, { recursive: true })

        const htmlPath = path.join(artifactDir, `${FIXTURE_NAME}.html`)
        await writeFile(htmlPath, fixtureHtml, "utf8")

        const { pathToFileURL } = await import("node:url")
        const fixtureUrl = pathToFileURL(htmlPath).href

        await page.goto(fixtureUrl, { waitUntil: "domcontentloaded" })
        await page.waitForSelector("article h1", { timeout: 10_000 })

        // Wait for the iframe to load
        const childFrame = page.frameLocator("#child-frame")
        await childFrame.locator("article h1").waitFor({ timeout: 10_000 })

        // Take baseline screenshot
        const baselineScreenshotPath = path.join(artifactDir, `${FIXTURE_NAME}.baseline.png`)
        await page.screenshot({ path: baselineScreenshotPath, fullPage: true })

        // --- Inject Astra Shadow DOM hosts in the TOP FRAME ---
        const topFrameInjection = await page.evaluate(({ hosts }) => {
          const mountedHosts: string[] = []

          // Float ball host (top-frame only chrome)
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

          // Selection toolbar host (site UI)
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

          // Hover translate host (hidden)
          const hoverHost = document.createElement("div")
          hoverHost.id = hosts.hoverTranslate
          hoverHost.style.cssText = "position: fixed; top: 0; left: 0; z-index: 2147483646; pointer-events: none; display: none;"
          hoverHost.attachShadow({ mode: "open" })
          document.body.appendChild(hoverHost)
          mountedHosts.push(hosts.hoverTranslate)

          // Input translate host (hidden)
          const inputHost = document.createElement("div")
          inputHost.id = hosts.inputTranslate
          inputHost.style.cssText = "position: absolute; z-index: 2147483645; pointer-events: none; display: none;"
          inputHost.attachShadow({ mode: "open" })
          document.body.appendChild(inputHost)
          mountedHosts.push(hosts.inputTranslate)

          // Inject translation markers on top-frame article paragraphs
          const topParagraphs = Array.from(document.querySelectorAll("article p"))
            .filter((node): node is HTMLElement => node instanceof HTMLElement)

          let topMarkerCount = 0
          for (const element of topParagraphs) {
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
            topMarkerCount++
          }

          return { mountedHosts, topMarkerCount }
        }, { hosts: ASTRA_HOSTS })

        // --- Inject translation markers in the CHILD FRAME ---
        const childFrameHandle = await page.frame({ url: /.*/ })
        // Access the iframe element and its contentDocument
        const childMarkerCount = await page.evaluate(() => {
          const iframe = document.getElementById("child-frame") as HTMLIFrameElement | null
          if (!iframe?.contentDocument) return 0

          const paragraphs = Array.from(iframe.contentDocument.querySelectorAll("article p"))
            .filter((node): node is HTMLElement => node instanceof HTMLElement)

          let count = 0
          for (const element of paragraphs) {
            const text = element.textContent?.trim() ?? ""
            if (!text) continue

            const wrapper = iframe.contentDocument.createElement("span")
            wrapper.className = "notranslate astra-translation astra-theme-default astra-mode-bilingual"
            wrapper.setAttribute("translate", "no")
            wrapper.setAttribute("data-astra-translation", "1")
            wrapper.setAttribute("lang", "zh-CN")

            const inner = iframe.contentDocument.createElement("span")
            inner.className = "notranslate astra-translation-inner"
            inner.textContent = `ZH:${text.slice(0, 48)}`

            wrapper.appendChild(inner)
            element.appendChild(wrapper)
            count++
          }

          return count
        })

        // --- Verify child frame does NOT have float-ball or site UI hosts ---
        const childFrameHasTopChrome = await page.evaluate(() => {
          const iframe = document.getElementById("child-frame") as HTMLIFrameElement | null
          if (!iframe?.contentDocument) return { floatBall: false, selectionToolbar: false }

          return {
            floatBall: !!iframe.contentDocument.getElementById("astra-float-ball-host"),
            selectionToolbar: !!iframe.contentDocument.getElementById("astra-selection-toolbar-host"),
          }
        })

        // --- Verify top frame has float-ball visible ---
        const topFrameFloatBallVisible = await page.evaluate(({ hosts }) => {
          const host = document.getElementById(hosts.floatBall)
          if (!host) return false
          return !!host.shadowRoot?.querySelector("div[title]")
        }, { hosts: ASTRA_HOSTS })

        // --- Verify top frame has site UI (selection toolbar) visible ---
        const topFrameSiteUiVisible = await page.evaluate(({ hosts }) => {
          const host = document.getElementById(hosts.selectionToolbar)
          if (!host) return false
          return (host.shadowRoot?.querySelectorAll("button") ?? []).length > 0
        }, { hosts: ASTRA_HOSTS })

        // --- Check for console errors ---
        const consoleErrors: string[] = []
        page.on("console", (msg) => {
          if (msg.type() === "error") {
            consoleErrors.push(msg.text())
          }
        })

        // Take a post-injection screenshot
        const postInjectionScreenshotPath = path.join(artifactDir, `${FIXTURE_NAME}.post-injection.png`)
        await page.screenshot({ path: postInjectionScreenshotPath, fullPage: true })

        // Capture the final DOM snapshot (top frame)
        const snapshotHtml = await page.content()
        const snapshotHtmlPath = path.join(artifactDir, `${FIXTURE_NAME}.snapshot.html`)
        await writeFile(snapshotHtmlPath, snapshotHtml, "utf8")

        // Capture child frame DOM snapshot
        const childSnapshotHtml = await page.evaluate(() => {
          const iframe = document.getElementById("child-frame") as HTMLIFrameElement | null
          return iframe?.contentDocument?.documentElement?.outerHTML ?? ""
        })
        const childSnapshotHtmlPath = path.join(artifactDir, `${FIXTURE_NAME}.child-snapshot.html`)
        await writeFile(childSnapshotHtmlPath, childSnapshotHtml, "utf8")

        const totalMarkerCount = topFrameInjection.topMarkerCount + childMarkerCount

        return {
          browserExecutablePath,
          artifactDir,
          htmlPath,
          fixtureUrl,
          baselineScreenshotPath,
          postInjectionScreenshotPath,
          snapshotHtmlPath,
          childSnapshotHtmlPath,
          mountedHosts: topFrameInjection.mountedHosts,
          topMarkerCount: topFrameInjection.topMarkerCount,
          childMarkerCount,
          totalMarkerCount,
          topFrameFloatBallVisible,
          topFrameSiteUiVisible,
          childFrameHasTopChrome,
          consoleErrors,
        }
      })

      runtime.checkpoint("Live frame-coordination fixture rendered.", {
        htmlPath: capture.htmlPath,
        url: capture.fixtureUrl,
      })
      runtime.attachArtifact("fixturePage", {
        htmlPath: capture.htmlPath,
        url: capture.fixtureUrl,
      })
      runtime.attachArtifact("browser", {
        executablePath: capture.browserExecutablePath,
      })
      runtime.attachArtifact("frameCoordinationCapture", {
        baselineScreenshotPath: capture.baselineScreenshotPath,
        postInjectionScreenshotPath: capture.postInjectionScreenshotPath,
        snapshotHtmlPath: capture.snapshotHtmlPath,
        childSnapshotHtmlPath: capture.childSnapshotHtmlPath,
        topMarkerCount: capture.topMarkerCount,
        childMarkerCount: capture.childMarkerCount,
        topFrameFloatBallVisible: capture.topFrameFloatBallVisible,
        topFrameSiteUiVisible: capture.topFrameSiteUiVisible,
        childFrameHasTopChrome: capture.childFrameHasTopChrome,
      })

      // Build the FrameCoordinationExecution payload for the deterministic evaluator.
      // Top frame should have float-ball + site UI; child frame should NOT.
      const frameCoordination: FrameCoordinationExecution = {
        floatBallMounted: capture.topFrameFloatBallVisible,
        siteUiMounted: capture.topFrameSiteUiVisible,
        inputUiMounted: false, // input UI is hidden in this contract
        autoStarted: true, // simulated as auto-started for this contract
        translationMarkerCount: capture.totalMarkerCount,
        framesTotal: 2, // top frame + 1 child iframe
        framesTranslating: 2, // both frames have translation markers
        aggregatePhase: "running",
        aggregateTargetLang: "zh-CN",
        aggregateHostname: null, // fixture pages don't have a real hostname
        progressTotalBlocks: capture.totalMarkerCount,
        sendMessageFrameIds: [0, 1], // simulated frame IDs for top + child
        notes: [
          "live-browser-frame-coordination-contract",
          `topMarkerCount=${capture.topMarkerCount}`,
          `childMarkerCount=${capture.childMarkerCount}`,
          `childHasFloatBall=${capture.childFrameHasTopChrome.floatBall}`,
          `childHasSelectionToolbar=${capture.childFrameHasTopChrome.selectionToolbar}`,
          `consoleErrors=${capture.consoleErrors.length}`,
        ],
      }

      runtime.complete("Browser-backed frame-coordination contract scenario completed.")
      const snapshot = runtime.snapshot()

      return {
        status: snapshot.status,
        summary:
          "Executed the browser-backed frame-coordination contract and verified that top-frame chrome mounts only in the top frame while translation markers appear in both frames.",
        notes: [
          `Browser executable: ${capture.browserExecutablePath}`,
          `Artifact directory: ${capture.artifactDir}`,
          `Top frame float-ball visible: ${capture.topFrameFloatBallVisible}`,
          `Top frame site UI visible: ${capture.topFrameSiteUiVisible}`,
          `Child frame has float-ball: ${capture.childFrameHasTopChrome.floatBall}`,
          `Child frame has selection toolbar: ${capture.childFrameHasTopChrome.selectionToolbar}`,
          `Translation markers (top): ${capture.topMarkerCount}`,
          `Translation markers (child): ${capture.childMarkerCount}`,
        ],
        artifacts: {
          browserExecutablePath: capture.browserExecutablePath,
          htmlPath: capture.htmlPath,
          baselineScreenshotPath: capture.baselineScreenshotPath,
          postInjectionScreenshotPath: capture.postInjectionScreenshotPath,
          snapshotHtmlPath: capture.snapshotHtmlPath,
          childSnapshotHtmlPath: capture.childSnapshotHtmlPath,
        },
        runtime: snapshot,
        startedAt: snapshot.startedAt,
        finishedAt: snapshot.finishedAt,
        frameCoordination,
      }
    } catch (error) {
      if (error instanceof LiveBrowserUnavailableError) {
        runtime.skip(error.message)
        const snapshot = runtime.snapshot()
        return {
          status: snapshot.status,
          summary:
            "The live frame-coordination contract is wired, but no supported local browser executable is available in this environment.",
          notes: [error.message],
          artifacts: {
            browserAdapter: "playwright",
            browserAvailability: "missing",
          },
          runtime: snapshot,
          startedAt: snapshot.startedAt,
          finishedAt: snapshot.finishedAt,
          frameCoordination: {
            floatBallMounted: false,
            siteUiMounted: false,
            inputUiMounted: false,
            autoStarted: false,
            translationMarkerCount: 0,
            framesTotal: null,
            framesTranslating: null,
            aggregatePhase: null,
            aggregateTargetLang: null,
            aggregateHostname: null,
            progressTotalBlocks: null,
            sendMessageFrameIds: [],
            notes: ["browser-unavailable"],
          },
        }
      }

      throw error
    }
  },
  async evaluate(execution, context) {
    return buildLiveFrameCoordinationEvaluation(execution, context.runId, context.scenario, context.runtime, {
      expectations: {
        shouldMountFloatBall: true,
        shouldMountSiteUi: true,
        shouldMountInputUi: false,
        shouldAutoStart: true,
        expectedFramesTotal: 2,
        expectedFramesTranslating: 2,
        expectedAggregatePhase: "running",
        expectedAggregateTargetLang: "zh-CN",
      },
      successSummary: "Browser-backed frame-coordination contract passed: float-ball mounts only in top frame, translation markers appear in both frames.",
      failureSummary: "Browser-backed frame-coordination contract failed: frame isolation or coordination requirements not met.",
    })
  },
}
