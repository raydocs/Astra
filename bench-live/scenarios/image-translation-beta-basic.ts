import { createServer } from "node:http"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

import {
  withExtensionBrowserPage,
  LiveBrowserUnavailableError,
  ExtensionBuildNotFoundError,
  type ExtensionBrowserContext,
} from "../driver"
import type { LiveEvaluationResult, LiveScenarioDefinition, LiveScenarioExecution } from "../evaluator"

interface RelayTranslateRequest {
  texts?: string[]
  targetLang?: string
  task?: string
}

interface ImageTranslationBetaExecution extends LiveScenarioExecution {
  imageTranslationBeta?: {
    pageLoaded: boolean
    comparePanelVisible: boolean
    extractedTextVisible: boolean
    translatedTextVisible: boolean
    approximateCopyVisible: boolean
    overlayQualitySummaryVisible: boolean
    overlayBoxCount: number
    fallbackRowsVisible: boolean
    reasonBadgeTexts: string[]
    relayRequestCount: number
    consoleErrors: string[]
  }
}

async function createImageTranslationRelayServer() {
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
        res.end(JSON.stringify({ translations: sourceTexts.map((text) => text.trim() === "Blank translation" ? "" : `ZH:${text.trim()}`) }))
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
    throw new Error("Image translation relay server did not expose a TCP port.")
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

export const imageTranslationBetaBasicScenario: LiveScenarioDefinition<ImageTranslationBetaExecution> = {
  id: "bench-live/image-translation-beta-basic",
  title: "Live Image/OCR Translation Beta basic path",
  surface: "image-translation",
  fixture: "image:svg-text",
  description: "Opens the extension Image/OCR Translation Beta page, uploads an SVG image with text, verifies approximate translated overlay, bbox fallback rows, and compare rows.",
  tags: ["playwright", "browser", "extension-loaded", "image-translation", "ocr", "beta"],
  async run(runtime, context) {
    runtime.start(context.id, context.title)
    runtime.log("Starting Image/OCR Translation Beta live scenario.")

    let extCtx: ExtensionBrowserContext | null = null
    let relayServer: Awaited<ReturnType<typeof createImageTranslationRelayServer>> | null = null

    try {
      relayServer = await createImageTranslationRelayServer()
      const artifactDir = path.join(process.cwd(), "bench-live-results", context.runId)
      await mkdir(artifactDir, { recursive: true })
      const svgPath = path.join(artifactDir, "image-translation-beta-basic.svg")
      await writeFile(svgPath, `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="280"><text x="32" y="72" font-size="24">Bonjour Astra</text><text x="32" y="132" font-size="24">Menu du jour</text><text x="36" y="76" font-size="24">Collision row</text><text x="620" y="72" font-size="24">Noisy edge</text><text x="32" y="192" font-size="24">Blank translation</text><text>Fallback row</text></svg>`, "utf8")

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
          accessToken: "bench-live-image-translation-token",
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
      const approximateCopyVisible = await extCtx.page.locator("text=translated overlay preview is approximate").isVisible()

      await extCtx.page.setInputFiles("[data-testid='image-translation-file-input']", svgPath)
      await extCtx.page.waitForSelector("[data-testid='image-translation-result-panel']", { timeout: 20_000 })
      await extCtx.page.waitForSelector("[data-testid='image-translation-overlay-box']", { timeout: 20_000 })

      const resultPanel = extCtx.page.locator("[data-testid='image-translation-result-panel']")
      const overlayBoxCount = await extCtx.page.locator("[data-testid='image-translation-overlay-box']").count()
      const fallbackRowsVisible = await extCtx.page.locator("[data-testid='image-translation-overlay-fallback-rows']").isVisible()
      const overlayQualitySummaryVisible = await extCtx.page.locator("[data-testid='image-translation-overlay-quality-summary']", { hasText: "2/6 row(s) safe" }).isVisible()
      const reasonBadgeTexts = await extCtx.page.locator("[data-testid^='image-translation-overlay-reason-']").allTextContents()
      const resultPanelText = await resultPanel.textContent()
      const extractedTextVisible = resultPanelText?.includes("Bonjour Astra") === true
        && resultPanelText.includes("Menu du jour")
        && resultPanelText.includes("Fallback row")
        && resultPanelText.includes("Collision row")
        && resultPanelText.includes("Noisy edge")
        && resultPanelText.includes("Blank translation")
      const translatedTextVisible = resultPanelText?.includes("ZH:Bonjour Astra") === true
        && resultPanelText.includes("ZH:Menu du jour")
        && resultPanelText.includes("ZH:Fallback row")
        && resultPanelText.includes("ZH:Collision row")
        && resultPanelText.includes("ZH:Noisy edge")

      await extCtx.page.locator("[data-testid='image-translation-mode-compare']").click()
      await extCtx.page.waitForSelector("[data-testid='image-translation-compare-panel']", { timeout: 10_000 })
      const comparePanel = extCtx.page.locator("[data-testid='image-translation-compare-panel']")
      const comparePanelVisible = await comparePanel.isVisible()
      const screenshotPath = path.join(artifactDir, "image-translation-beta-basic.png")
      await extCtx.page.screenshot({ path: screenshotPath, fullPage: true })

      runtime.attachArtifact("imageTranslationBeta", {
        screenshotPath,
        svgPath,
        relayRequestCount: relayServer.translateRequests.length,
        translatePayloads: relayServer.translateRequests,
      })
      runtime.complete("Image/OCR Translation Beta basic live scenario completed.")
      const snapshot = runtime.snapshot()

      return {
        status: snapshot.status,
        summary: "Uploaded SVG image text into the beta page and verified approximate translated overlay plus compare rows fallback.",
        notes: [
          `Relay requests: ${relayServer.translateRequests.length}`,
          `Browser executable: ${extCtx.browserExecutablePath}`,
        ],
        artifacts: {
          screenshotPath,
          svgPath,
        },
        runtime: snapshot,
        startedAt: snapshot.startedAt,
        finishedAt: snapshot.finishedAt,
        imageTranslationBeta: {
          pageLoaded,
          comparePanelVisible,
          extractedTextVisible,
          translatedTextVisible,
          approximateCopyVisible,
          overlayQualitySummaryVisible,
          overlayBoxCount,
          fallbackRowsVisible,
          reasonBadgeTexts,
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
          summary: "Image/OCR Translation Beta live scenario skipped because the browser or extension build was unavailable.",
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
    const beta = execution.imageTranslationBeta
    const issues: string[] = []
    if (!beta?.pageLoaded) issues.push("Image Translation Beta page did not load.")
    if (!beta?.comparePanelVisible) issues.push("Translated compare panel was not visible after switching to Compare rows.")
    if (!beta?.extractedTextVisible) issues.push("Extracted OCR text was not visible.")
    if (!beta?.translatedTextVisible) issues.push("Translated OCR text was not visible.")
    if (!beta?.approximateCopyVisible) issues.push("Approximate overlay beta copy was not visible.")
    if (!beta?.overlayQualitySummaryVisible) issues.push("Overlay quality summary did not report the noisy/collision fixture gate counts.")
    if ((beta?.overlayBoxCount ?? 0) !== 2) issues.push("Translated overlay boxes did not render only the safe bbox OCR rows.")
    if (!beta?.fallbackRowsVisible) issues.push("Risky OCR row fallback compare rows were not visible in overlay mode.")
    const expectedReasonBadges = ["No OCR box", "Unsafe OCR box", "Overlaps another row", "Missing translation"]
    for (const reasonBadge of expectedReasonBadges) {
      if (beta?.reasonBadgeTexts.includes(reasonBadge) !== true) issues.push(`Missing overlay fallback reason badge: ${reasonBadge}`)
    }
    if ((beta?.relayRequestCount ?? 0) < 1) issues.push("Translation pipeline relay was not called.")
    if ((beta?.consoleErrors.length ?? 0) > 0) issues.push(`Console errors: ${beta?.consoleErrors.join(" | ")}`)

    return {
      runId: context.runId,
      scenario: context.scenario,
      status: issues.length === 0 ? "pass" : "fail",
      pass: issues.length === 0,
      score: issues.length === 0 ? 100 : 0,
      summary: issues.length === 0
        ? "Image/OCR Translation Beta rendered upload, extraction, approximate translated overlay boxes, bbox fallback rows, and compare rows in the extension page."
        : "Image/OCR Translation Beta live scenario failed one or more required checks.",
      issues,
      nextActions: issues.length === 0 ? [] : ["Fix the Image/OCR Translation Beta live scenario regression."],
      notes: execution.notes ?? [],
    }
  },
}
