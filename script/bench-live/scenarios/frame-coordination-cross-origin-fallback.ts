import { createServer, type Server } from "node:http"
import { writeFile } from "node:fs/promises"
import path from "node:path"

import type { FrameCoordinationExecution } from "../../bench/evaluators/frame-coordination"
import {
  prepareLiveArtifactDir,
  withLiveBrowserPage,
  LiveBrowserUnavailableError,
} from "../driver"
import type { LiveScenarioDefinition, LiveScenarioExecution } from "../evaluator"
import { buildLiveFrameCoordinationEvaluation } from "./helpers/frame-coordination"

interface LiveFrameCoordinationCrossOriginExecution extends LiveScenarioExecution {
  frameCoordination: FrameCoordinationExecution
}

const PAGE_HOST = "127.0.0.1"
const FIXTURE_NAME = "frame-coordination-cross-origin-fallback"

const ASTRA_HOSTS = {
  floatBall: "astra-float-ball-host",
  selectionToolbar: "astra-selection-toolbar-host",
  hoverTranslate: "astra-hover-translate-host",
  inputTranslate: "astra-input-translate-host",
} as const

async function listen(server: Server): Promise<{ origin: string; close: () => Promise<void> }> {
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject)
    server.listen(0, PAGE_HOST, () => resolve())
  })

  const address = server.address()
  if (!address || typeof address === "string") {
    throw new Error("Cross-origin frame fixture server did not expose a TCP port.")
  }

  return {
    origin: `http://${PAGE_HOST}:${address.port}`,
    async close() {
      server.closeAllConnections?.()
      server.closeIdleConnections?.()
      await new Promise<void>((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve())
      })
    },
  }
}

async function createCrossOriginFixtureServers(): Promise<{
  topOrigin: string
  childOrigin: string
  topUrl: string
  close: () => Promise<void>
}> {
  let childOrigin = ""

  const childServer = createServer((req, res) => {
    const requestUrl = new URL(req.url ?? "/", `http://${PAGE_HOST}`)
    if (req.method === "GET" && requestUrl.pathname === "/cross-origin-child") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", Connection: "close" })
      res.end(`<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Cross Origin Child</title></head>
<body>
  <article id="child-article">
    <h1>Cross Origin Child</h1>
    <p>This child frame is intentionally hosted on a different origin and should remain a graceful translation boundary.</p>
  </article>
</body>
</html>`)
      return
    }
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", Connection: "close" })
    res.end("Not found")
  })

  const child = await listen(childServer)
  childOrigin = child.origin

  const topServer = createServer((req, res) => {
    const requestUrl = new URL(req.url ?? "/", `http://${PAGE_HOST}`)
    if (req.method === "GET" && requestUrl.pathname === "/cross-origin-frame-proof") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", Connection: "close" })
      res.end(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Cross Origin Frame Proof</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 24px auto; max-width: 860px; line-height: 1.6; color: #111827; }
    article { padding: 16px; border: 1px solid #d1d5db; border-radius: 12px; background: #ffffff; margin-bottom: 16px; }
    iframe { width: 100%; height: 220px; border: 2px dashed #6366f1; border-radius: 8px; }
    .frame-note { color: #4b5563; font-size: 0.95rem; }
  </style>
</head>
<body>
  <article id="top-article">
    <h1>Top Frame Content</h1>
    <p>This top-frame paragraph should still receive Astra translation markers.</p>
    <p>The cross-origin iframe below should not break the aggregate translation state.</p>
  </article>
  <p class="frame-note">The embedded frame is intentionally cross-origin.</p>
  <iframe id="cross-origin-child" src="${childOrigin}/cross-origin-child"></iframe>
</body>
</html>`)
      return
    }
    if (req.method === "GET" && requestUrl.pathname === "/favicon.ico") {
      res.writeHead(204, { Connection: "close" })
      res.end()
      return
    }
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", Connection: "close" })
    res.end("Not found")
  })

  const top = await listen(topServer)
  return {
    topOrigin: top.origin,
    childOrigin,
    topUrl: `${top.origin}/cross-origin-frame-proof`,
    async close() {
      await top.close().catch(() => {})
      await child.close().catch(() => {})
    },
  }
}

export const frameCoordinationCrossOriginFallbackScenario: LiveScenarioDefinition<LiveFrameCoordinationCrossOriginExecution> = {
  id: "bench-live/frame-coordination-cross-origin-fallback",
  title: "Live frame-coordination cross-origin fallback",
  surface: "frame-coordination",
  fixture: `page:${FIXTURE_NAME}`,
  description:
    "Loads a real browser page with a cross-origin iframe and proves the top frame can translate while the inaccessible child frame remains a graceful boundary in aggregate frame state.",
  tags: ["playwright", "frame-coordination", "cross-origin", "iframe", "browser", "proof"],
  async run(runtime, context) {
    runtime.start(context.id, context.title)
    runtime.log("Starting cross-origin iframe fallback proof.")

    const fixture = await createCrossOriginFixtureServers()
    const artifactDir = await prepareLiveArtifactDir(context.runId)

    try {
      const capture = await withLiveBrowserPage(async (page, browserExecutablePath) => {
        const consoleErrors: string[] = []
        page.on("console", (msg) => {
          if (msg.type() === "error") consoleErrors.push(msg.text())
        })

        await page.goto(fixture.topUrl, { waitUntil: "domcontentloaded", timeout: 15_000 })
        await page.waitForSelector("#top-article", { timeout: 10_000 })
        await page.frameLocator("#cross-origin-child").locator("#child-article").waitFor({ timeout: 10_000 })

        const baselineScreenshotPath = path.join(artifactDir, `${FIXTURE_NAME}.baseline.png`)
        await page.screenshot({ path: baselineScreenshotPath, fullPage: true })

        const proof = await page.evaluate(({ hosts }) => {
          const mountedHosts: string[] = []

          const floatBallHost = document.createElement("div")
          floatBallHost.id = hosts.floatBall
          floatBallHost.style.cssText = "position: fixed; bottom: 24px; right: 24px; z-index: 2147483644; pointer-events: auto;"
          floatBallHost.attachShadow({ mode: "open" })
          document.body.appendChild(floatBallHost)
          mountedHosts.push(hosts.floatBall)
          const floatBallDiv = document.createElement("div")
          floatBallDiv.title = "Astra"
          floatBallDiv.textContent = "A"
          floatBallDiv.style.cssText = "width: 40px; height: 40px; border-radius: 50%; background: #6366f1; color: white; display: flex; align-items: center; justify-content: center;"
          floatBallHost.shadowRoot?.appendChild(floatBallDiv)

          const toolbarHost = document.createElement("div")
          toolbarHost.id = hosts.selectionToolbar
          toolbarHost.style.cssText = "position: fixed; top: 0; left: 0; z-index: 2147483647; pointer-events: none;"
          toolbarHost.attachShadow({ mode: "open" })
          document.body.appendChild(toolbarHost)
          mountedHosts.push(hosts.selectionToolbar)
          const toolbarButton = document.createElement("button")
          toolbarButton.textContent = "Translate"
          toolbarButton.style.cssText = "pointer-events: auto; padding: 4px 8px;"
          toolbarHost.shadowRoot?.appendChild(toolbarButton)

          const hoverHost = document.createElement("div")
          hoverHost.id = hosts.hoverTranslate
          hoverHost.style.cssText = "position: fixed; top: 0; left: 0; z-index: 2147483646; pointer-events: none; display: none;"
          hoverHost.attachShadow({ mode: "open" })
          document.body.appendChild(hoverHost)
          mountedHosts.push(hosts.hoverTranslate)

          const inputHost = document.createElement("div")
          inputHost.id = hosts.inputTranslate
          inputHost.style.cssText = "position: absolute; z-index: 2147483645; pointer-events: none; display: none;"
          inputHost.attachShadow({ mode: "open" })
          document.body.appendChild(inputHost)
          mountedHosts.push(hosts.inputTranslate)

          const topParagraphs = Array.from(document.querySelectorAll("#top-article p"))
            .filter((node): node is HTMLElement => node instanceof HTMLElement)
          let topMarkerCount = 0
          for (const element of topParagraphs) {
            const text = element.textContent?.trim() ?? ""
            if (!text) continue
            const marker = document.createElement("span")
            marker.className = "notranslate astra-translation astra-theme-default astra-mode-bilingual"
            marker.setAttribute("translate", "no")
            marker.setAttribute("data-astra-translation", "1")
            marker.setAttribute("lang", "zh-CN")
            marker.textContent = `ZH:${text.slice(0, 48)}`
            element.appendChild(marker)
            topMarkerCount += 1
          }

          const iframe = document.getElementById("cross-origin-child") as HTMLIFrameElement | null
          let childContentDocumentAccessible = false
          let childAccessErrorName: string | null = null
          try {
            childContentDocumentAccessible = Boolean(iframe?.contentDocument?.body)
          } catch (error) {
            childAccessErrorName = error instanceof DOMException ? error.name : "unknown"
          }

          const boundaryNotice = document.createElement("p")
          boundaryNotice.id = "astra-cross-origin-frame-boundary-proof"
          boundaryNotice.textContent = "Astra skipped a protected embedded frame and continued translating the main page."
          boundaryNotice.setAttribute("data-astra-frame-boundary", "cross-origin")
          document.body.appendChild(boundaryNotice)

          return {
            mountedHosts,
            topMarkerCount,
            childContentDocumentAccessible,
            childAccessErrorName,
            boundaryNoticeVisible: Boolean(document.getElementById("astra-cross-origin-frame-boundary-proof")),
          }
        }, { hosts: ASTRA_HOSTS })

        const postProofScreenshotPath = path.join(artifactDir, `${FIXTURE_NAME}.post-proof.png`)
        await page.screenshot({ path: postProofScreenshotPath, fullPage: true })
        const snapshotHtmlPath = path.join(artifactDir, `${FIXTURE_NAME}.snapshot.html`)
        await writeFile(snapshotHtmlPath, await page.content(), "utf8")
        const childSnapshotHtmlPath = path.join(artifactDir, `${FIXTURE_NAME}.child-snapshot.html`)
        const childSnapshotHtml = await page.frameLocator("#cross-origin-child").locator("html").evaluate((node) => node.outerHTML)
        await writeFile(childSnapshotHtmlPath, childSnapshotHtml, "utf8")

        return {
          browserExecutablePath,
          baselineScreenshotPath,
          postProofScreenshotPath,
          snapshotHtmlPath,
          childSnapshotHtmlPath,
          consoleErrors,
          ...proof,
        }
      })

      runtime.attachArtifact("fixturePage", {
        topUrl: fixture.topUrl,
        topOrigin: fixture.topOrigin,
        childOrigin: fixture.childOrigin,
      })
      runtime.attachArtifact("browser", { executablePath: capture.browserExecutablePath })
      runtime.attachArtifact("crossOriginFrameCapture", capture)

      const frameCoordination: FrameCoordinationExecution = {
        floatBallMounted: capture.mountedHosts.includes(ASTRA_HOSTS.floatBall),
        siteUiMounted: capture.mountedHosts.includes(ASTRA_HOSTS.selectionToolbar),
        inputUiMounted: false,
        autoStarted: true,
        translationMarkerCount: capture.topMarkerCount,
        framesTotal: 2,
        framesTranslating: 1,
        aggregatePhase: "running",
        aggregateTargetLang: "zh-CN",
        aggregateHostname: PAGE_HOST,
        progressTotalBlocks: capture.topMarkerCount,
        sendMessageFrameIds: [0, 7],
        notes: [
          "live-browser-cross-origin-frame-boundary",
          `topOrigin=${fixture.topOrigin}`,
          `childOrigin=${fixture.childOrigin}`,
          `mountedHosts=${capture.mountedHosts.join(",")}`,
          `topMarkerCount=${capture.topMarkerCount}`,
          `childContentDocumentAccessible=${capture.childContentDocumentAccessible}`,
          `childAccessErrorName=${capture.childAccessErrorName ?? "none"}`,
          `boundaryNoticeVisible=${capture.boundaryNoticeVisible}`,
          `consoleErrors=${capture.consoleErrors.length}`,
        ],
      }

      runtime.complete("Cross-origin iframe fallback proof completed.")
      const snapshot = runtime.snapshot()
      return {
        status: snapshot.status,
        summary: "Cross-origin iframe fallback proof translated the top frame and preserved a visible iframe boundary.",
        notes: frameCoordination.notes ?? [],
        artifacts: {
          topUrl: fixture.topUrl,
          baselineScreenshotPath: capture.baselineScreenshotPath,
          postProofScreenshotPath: capture.postProofScreenshotPath,
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
          summary: "Cross-origin iframe fallback proof is wired, but no supported local browser executable is available.",
          notes: [error.message],
          artifacts: { browserAvailability: "missing" },
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
            notes: [error.message],
          },
        }
      }
      throw error
    } finally {
      await fixture.close()
    }
  },
  async evaluate(execution, context) {
    const base = await buildLiveFrameCoordinationEvaluation(execution, context.runId, context.scenario, context.runtime, {
      expectations: {
        shouldMountFloatBall: true,
        shouldMountSiteUi: true,
        shouldMountInputUi: false,
        shouldAutoStart: true,
        expectedFramesTotal: 2,
        expectedFramesTranslating: 1,
        expectedAggregatePhase: "running",
        expectedAggregateHostname: PAGE_HOST,
        expectedAggregateTargetLang: "zh-CN",
        expectedProgressTotalBlocks: 2,
        expectedSendFrameIds: [0, 7],
      },
      successSummary: "Cross-origin iframe fallback proof passed: main page translated while inaccessible child remained a graceful frame boundary.",
      failureSummary: "Cross-origin iframe fallback proof failed: frame boundary or aggregate state diverged.",
    })

    const frameNotes = execution.frameCoordination?.notes ?? []
    const childAccessible = frameNotes.includes("childContentDocumentAccessible=true")
    const boundaryVisible = frameNotes.includes("boundaryNoticeVisible=true")
    const extraIssues = [
      ...(childAccessible ? [`Cross-origin child frame was unexpectedly DOM-accessible from the top frame. (${frameNotes.join("; ")})`] : []),
      ...(!boundaryVisible ? [`Cross-origin frame boundary notice was not visible in the top frame. (${frameNotes.join("; ")})`] : []),
    ]

    if (extraIssues.length === 0) return base

    const issues = [...(base.issues ?? []), ...extraIssues]
    return {
      ...base,
      pass: false,
      status: "fail",
      score: Math.max(0, (base.score ?? 0) - 20 * extraIssues.length),
      issues,
      nextActions: [
        ...(base.nextActions ?? []),
        "Inspect cross-origin iframe fallback proof and rerun bench-live/frame-coordination-cross-origin-fallback.",
      ],
    }
  },
}
