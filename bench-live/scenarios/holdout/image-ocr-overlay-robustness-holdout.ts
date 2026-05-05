import { createServer } from "node:http"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

import {
  withExtensionBrowserPage,
  LiveBrowserUnavailableError,
  ExtensionBuildNotFoundError,
  type ExtensionBrowserContext,
} from "../../driver"
import type { LiveEvaluationResult, LiveScenarioDefinition, LiveScenarioExecution } from "../../evaluator"

interface RelayTranslateRequest {
  texts?: string[]
  targetLang?: string
  task?: string
}

interface ImageOcrOverlayRobustnessExecution extends LiveScenarioExecution {
  imageOcrOverlayRobustness?: {
    pageLoaded: boolean
    safeOverlayRendered: boolean
    overlayBoxCount: number
    overlayTitles: string[]
    overlappingRowsSkipped: boolean
    fallbackRowsVisible: boolean
    comparePanelVisible: boolean
    compareCollisionRiskShown: boolean
    collisionRiskBadgeCount: number
    overlayQualitySummaryVisible: boolean
    artifactsCaptured: boolean
    relayRequestCount: number
    consoleErrors: string[]
  }
}

async function createImageOcrOverlayRelayServer() {
  const translateRequests: RelayTranslateRequest[] = []
  const server = createServer((req, res) => {
    const requestUrl = new URL(req.url ?? "/", "http://127.0.0.1")

    if (req.method === "OPTIONS" && requestUrl.pathname === "/translate") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        Connection: "close",
      })
      res.end()
      return
    }

    if (req.method === "POST" && requestUrl.pathname === "/translate") {
      const chunks: Uint8Array[] = []
      req.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
      req.on("end", () => {
        const payload = JSON.parse(Buffer.concat(chunks).toString("utf8")) as RelayTranslateRequest
        translateRequests.push(payload)
        const sourceTexts = payload.texts ?? []
        res.writeHead(200, {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          Connection: "close",
        })
        res.end(JSON.stringify({ translations: sourceTexts.map((text) => `ZH:${text.trim()}`) }))
      })
      return
    }

    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", "Access-Control-Allow-Origin": "*", Connection: "close" })
    res.end("Not found")
  })

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject)
    server.listen(0, "127.0.0.1", () => resolve())
  })

  const address = server.address()
  if (!address || typeof address === "string") {
    throw new Error("Image/OCR overlay relay server did not expose a TCP port.")
  }

  return {
    origin: `http://127.0.0.1:${address.port}`,
    translateRequests,
    async close() {
      server.closeAllConnections?.()
      server.closeIdleConnections?.()
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()))
      })
    },
  }
}

export const imageOcrOverlayRobustnessHoldoutScenario: LiveScenarioDefinition<ImageOcrOverlayRobustnessExecution> = {
  id: "bench-live/image-ocr-overlay-robustness-holdout",
  title: "Holdout: Image/OCR overlay robustness",
  surface: "image-translation",
  fixture: "image:svg-overlapping-ocr-regions",
  description:
    "Opens the Image/OCR Translation Beta page with overlapping SVG OCR rows and verifies that only safe boxes render while collision-risk rows remain in compare fallback with artifacts captured.",
  tags: ["playwright", "browser", "extension-loaded", "image-translation", "ocr", "overlay", "holdout"],
  async run(runtime, context) {
    runtime.start(context.id, context.title)
    runtime.log("Starting Image/OCR overlay robustness holdout.")

    let extCtx: ExtensionBrowserContext | null = null
    let relayServer: Awaited<ReturnType<typeof createImageOcrOverlayRelayServer>> | null = null

    try {
      relayServer = await createImageOcrOverlayRelayServer()
      const artifactDir = path.join(process.cwd(), "bench-live-results", context.runId)
      await mkdir(artifactDir, { recursive: true })
      const svgPath = path.join(artifactDir, "image-ocr-overlay-robustness-holdout.svg")
      await writeFile(svgPath, `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="320" viewBox="0 0 720 320"><rect width="720" height="320" fill="#fff7ed"/><text x="48" y="72" font-size="26">Safe Header</text><text x="52" y="76" font-size="26">Overlap Header</text><text x="48" y="140" font-size="26">Safe Footer</text><text x="54" y="144" font-size="26">Overlap Footer</text></svg>`, "utf8")

      const liveConfig = {
        version: 1,
        targetLang: "zh-CN",
        connectionMode: "custom",
        hoverTrigger: "alt",
        contentScope: "page",
        inputTranslation: "disabled",
        inputTranslationMode: "replace",
        languageLevel: "intermediate",
        explainMode: "deep",
        privacyMode: false,
        provider: {
          id: "openai",
          accessToken: "bench-live-image-ocr-overlay-token",
          relayBaseURL: relayServer.origin,
          model: "gpt-5.4-nano",
        },
        presentation: {
          mode: "bilingual",
          theme: "default",
          fontSize: 0.92,
          translationColor: "#64748b",
        },
        sites: {},
        customActions: [],
      }

      extCtx = await withExtensionBrowserPage({
        waitForExtensionInject: 0,
        storageState: {
          "astra.config.v1": liveConfig,
        },
      })

      const consoleErrors: string[] = []
      extCtx.page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text())
      })

      await extCtx.page.goto(`chrome-extension://${extCtx.extensionId}/image-translate.html`, {
        waitUntil: "domcontentloaded",
        timeout: 20_000,
      })
      await extCtx.page.waitForSelector("[data-testid='image-translation-beta-page']", { timeout: 12_000 })
      const pageLoaded = await extCtx.page.locator("text=Image/OCR Translation Beta").isVisible()

      await extCtx.page.setInputFiles("[data-testid='image-translation-file-input']", svgPath)
      await extCtx.page.waitForSelector("[data-testid='image-translation-result-panel']", { timeout: 20_000 })
      await extCtx.page.waitForSelector("[data-testid='image-translation-overlay-box']", { timeout: 20_000 })

      const overlayBoxes = extCtx.page.locator("[data-testid='image-translation-overlay-box']")
      const overlayBoxCount = await overlayBoxes.count()
      const overlayTitles = await overlayBoxes.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("title") ?? ""))
      const safeOverlayRendered = overlayTitles.includes("Safe Header") && overlayTitles.includes("Safe Footer")
      const overlappingRowsSkipped = !overlayTitles.includes("Overlap Header") && !overlayTitles.includes("Overlap Footer")
      const fallbackRowsVisible = await extCtx.page.locator("[data-testid='image-translation-overlay-fallback-rows']").isVisible()
      const overlayQualitySummaryVisible = await extCtx.page.locator("[data-testid='image-translation-overlay-quality-summary']", { hasText: "2/4 row(s) safe" }).isVisible()

      await extCtx.page.locator("[data-testid='image-translation-mode-compare']").click()
      await extCtx.page.waitForSelector("[data-testid='image-translation-compare-panel']", { timeout: 10_000 })
      const comparePanel = extCtx.page.locator("[data-testid='image-translation-compare-panel']")
      const comparePanelVisible = await comparePanel.isVisible()
      const collisionRiskBadgeCount = await comparePanel.locator("[data-testid='image-translation-overlay-reason-collision_risk']").count()
      const comparePanelText = await comparePanel.textContent()
      const compareCollisionRiskShown = collisionRiskBadgeCount >= 2 && comparePanelText?.includes("Overlaps another row") === true
      const snapshotHtml = await extCtx.page.content()
      const snapshotHtmlPath = path.join(artifactDir, "image-ocr-overlay-robustness-holdout.snapshot.html")
      const screenshotPath = path.join(artifactDir, "image-ocr-overlay-robustness-holdout.png")
      await writeFile(snapshotHtmlPath, snapshotHtml, "utf8")
      await extCtx.page.screenshot({ path: screenshotPath, fullPage: true })
      const artifactsCaptured = Boolean(svgPath && screenshotPath && snapshotHtmlPath)

      runtime.attachArtifact("imageOcrOverlayRobustness", {
        svgPath,
        screenshotPath,
        snapshotHtmlPath,
        relayRequestCount: relayServer.translateRequests.length,
        translatePayloads: relayServer.translateRequests,
        overlayTitles,
        collisionRiskBadgeCount,
      })
      runtime.complete("Image/OCR overlay robustness holdout completed.")
      const snapshot = runtime.snapshot()

      return {
        status: snapshot.status,
        summary: "Uploaded overlapping SVG OCR rows and verified safe overlay boxes plus collision-risk compare fallback.",
        notes: [
          `Relay requests: ${relayServer.translateRequests.length}`,
          `Browser executable: ${extCtx.browserExecutablePath}`,
          `Overlay titles: ${overlayTitles.join(", ")}`,
          `Collision-risk badges: ${collisionRiskBadgeCount}`,
        ],
        artifacts: {
          screenshotPath,
          svgPath,
          snapshotHtmlPath,
        },
        runtime: snapshot,
        startedAt: snapshot.startedAt,
        finishedAt: snapshot.finishedAt,
        imageOcrOverlayRobustness: {
          pageLoaded,
          safeOverlayRendered,
          overlayBoxCount,
          overlayTitles,
          overlappingRowsSkipped,
          fallbackRowsVisible,
          comparePanelVisible,
          compareCollisionRiskShown,
          collisionRiskBadgeCount,
          overlayQualitySummaryVisible,
          artifactsCaptured,
          relayRequestCount: relayServer.translateRequests.length,
          consoleErrors,
        },
      }
    } catch (error) {
      if (error instanceof LiveBrowserUnavailableError || error instanceof ExtensionBuildNotFoundError) {
        runtime.skip(error.message)
        const snapshot = runtime.snapshot()
        return {
          status: snapshot.status,
          summary: "Image/OCR overlay robustness holdout skipped because the browser or extension build was unavailable.",
          notes: [error.message],
          runtime: snapshot,
          startedAt: snapshot.startedAt,
          finishedAt: snapshot.finishedAt,
        }
      }
      throw error
    } finally {
      await extCtx?.close()
      await relayServer?.close()
    }
  },
  evaluate(execution, context): Partial<LiveEvaluationResult> {
    const robustness = execution.imageOcrOverlayRobustness
    const issues: string[] = []
    if (!robustness?.pageLoaded) issues.push("Image Translation Beta page did not load.")
    if (!robustness?.safeOverlayRendered) issues.push("Safe OCR rows did not render in the translated overlay.")
    if ((robustness?.overlayBoxCount ?? 0) !== 2) issues.push("Overlay did not render exactly the two safe OCR rows.")
    if (!robustness?.overlappingRowsSkipped) issues.push("Overlapping OCR rows were rendered in the overlay instead of being skipped.")
    if (!robustness?.fallbackRowsVisible) issues.push("Overlay fallback rows were not visible for skipped OCR regions.")
    if (!robustness?.comparePanelVisible) issues.push("Compare fallback panel was not visible.")
    if (!robustness?.compareCollisionRiskShown) issues.push("collision_risk was not shown in compare fallback for overlapping OCR rows.")
    if (!robustness?.overlayQualitySummaryVisible) issues.push("Overlay quality summary did not report the 2/4 safe-row holdout gate.")
    if (!robustness?.artifactsCaptured) issues.push("Expected SVG, screenshot, and HTML snapshot artifacts were not captured.")
    if ((robustness?.relayRequestCount ?? 0) < 1) issues.push("Translation pipeline relay was not called.")
    if ((robustness?.consoleErrors.length ?? 0) > 0) issues.push(`Console errors: ${robustness?.consoleErrors.join(" | ")}`)

    return {
      runId: context.runId,
      scenario: context.scenario,
      status: issues.length === 0 ? "pass" : "fail",
      pass: issues.length === 0,
      score: issues.length === 0 ? 100 : 0,
      summary: issues.length === 0
        ? "Image/OCR overlay robustness holdout passed: safe boxes rendered, overlapping OCR rows skipped, collision_risk compare fallback shown, and artifacts captured."
        : "Image/OCR overlay robustness holdout failed one or more required checks.",
      issues,
      nextActions: issues.length === 0 ? [] : ["Fix or roll back the Image/OCR overlay robustness holdout regression."],
      notes: execution.notes ?? [],
    }
  },
}
