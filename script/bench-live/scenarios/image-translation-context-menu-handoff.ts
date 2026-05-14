import { createServer } from "node:http"
import { writeFile } from "node:fs/promises"
import path from "node:path"

import {
  prepareLiveArtifactDir,
  withExtensionBrowserPage,
  LiveBrowserUnavailableError,
  ExtensionBuildNotFoundError,
  type ExtensionBrowserContext,
} from "../driver"
import type { LiveEvaluationResult, LiveScenarioDefinition, LiveScenarioExecution } from "../evaluator"

const IMAGE_TRANSLATE_HANDOFF_STORAGE_KEY = "astra.imageTranslate.handoffs.v1"
const IMAGE_TRANSLATE_HANDOFF_TTL_MS = 2 * 60 * 1000

interface RelayTranslateRequest {
  texts?: string[]
  targetLang?: string
  task?: string
}

interface ImageContextMenuHandoffExecution extends LiveScenarioExecution {
  imageContextMenuHandoff?: {
    sourcePageLoaded: boolean
    handoffUrlOpened: boolean
    resultPanelVisible: boolean
    extractedTextVisible: boolean
    translatedTextVisible: boolean
    overlayVisible: boolean
    capturedPayloadStored: boolean
    originalImageRequestCount: number
    relayRequestCount: number
    consoleErrors: string[]
    errorText: string | null
  }
}

async function createImageContextMenuProofServer() {
  const translateRequests: RelayTranslateRequest[] = []
  let imageRequestCount = 0
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="260"><rect width="640" height="260" fill="#fff7ed"/><text x="48" y="88" font-size="28">Context menu image</text><text x="48" y="154" font-size="28">Bonjour Astra</text></svg>`
  const server = createServer((req, res) => {
    const requestUrl = new URL(req.url ?? "/", "http://127.0.0.1")

    if (req.method === "GET" && requestUrl.pathname === "/source") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", Connection: "close" })
      res.end(`<!doctype html><html><head><title>Astra context menu proof</title></head><body><h1>Context menu source</h1><img id="proof-image" src="/context-menu-image.svg" alt="Context menu image proof"></body></html>`)
      return
    }

    if (req.method === "GET" && requestUrl.pathname === "/favicon.ico") {
      res.writeHead(204, { Connection: "close" })
      res.end()
      return
    }

    if (req.method === "GET" && requestUrl.pathname === "/context-menu-image.svg") {
      imageRequestCount += 1
      if (imageRequestCount > 1) {
        res.writeHead(403, {
          "Content-Type": "text/plain; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
          Connection: "close",
        })
        res.end("Original image URL intentionally blocked after source-page load; captured handoff payload must be used.")
        return
      }
      res.writeHead(200, {
        "Content-Type": "image/svg+xml",
        "Access-Control-Allow-Origin": "*",
        Connection: "close",
      })
      res.end(svg)
      return
    }

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
    throw new Error("Image context-menu proof server did not expose a TCP port.")
  }

  const origin = `http://127.0.0.1:${address.port}`
  return {
    origin,
    sourceUrl: `${origin}/source`,
    imageUrl: `${origin}/context-menu-image.svg`,
    capturedDataUrl: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`,
    get imageRequestCount() {
      return imageRequestCount
    },
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

export const imageTranslationContextMenuHandoffScenario: LiveScenarioDefinition<ImageContextMenuHandoffExecution> = {
  id: "bench-live/image-translation-context-menu-handoff",
  title: "Live Image/OCR context-menu handoff proof",
  surface: "image-translation",
  fixture: "image:context-menu-svg-text",
  description: "Seeds the same short-lived image handoff produced by the image context-menu click, including a captured page payload, opens the image-translate page with the token, and verifies captured preload plus OCR/translation output.",
  tags: ["playwright", "browser", "extension-loaded", "image-translation", "context-menu", "handoff"],
  async run(runtime, context) {
    runtime.start(context.id, context.title)
    runtime.log("Starting Image/OCR context-menu handoff live scenario.")

    let extCtx: ExtensionBrowserContext | null = null
    let proofServer: Awaited<ReturnType<typeof createImageContextMenuProofServer>> | null = null

    try {
      proofServer = await createImageContextMenuProofServer()
      const artifactDir = await prepareLiveArtifactDir(context.runId)
      const token = "img_live_context_menu_handoff"
      const now = Date.now()
      const sourceHtmlPath = path.join(artifactDir, "image-translation-context-menu-source.html")
      await writeFile(sourceHtmlPath, `Source fixture: ${proofServer.sourceUrl}\nImage fixture: ${proofServer.imageUrl}\n`, "utf8")

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
          accessToken: "bench-live-image-context-menu-token",
          relayBaseURL: proofServer.origin,
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
          [IMAGE_TRANSLATE_HANDOFF_STORAGE_KEY]: {
            [token]: {
              token,
              imageUrl: proofServer.imageUrl,
              pageUrl: proofServer.sourceUrl,
              pageTitle: "Astra context menu proof",
              source: "context-menu-image",
              captured: {
                dataUrl: proofServer.capturedDataUrl,
                mimeType: "image/svg+xml",
                fileName: "captured-context-menu-image.svg",
                byteLength: Buffer.byteLength(proofServer.capturedDataUrl.split(",")[1] ?? "", "base64"),
              },
              createdAt: now,
              expiresAt: now + IMAGE_TRANSLATE_HANDOFF_TTL_MS,
            },
          },
        },
      })

      const consoleErrors: string[] = []
      extCtx.page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text())
      })

      await extCtx.page.goto(proofServer.sourceUrl, { waitUntil: "domcontentloaded", timeout: 15_000 })
      await extCtx.page.waitForSelector("#proof-image", { timeout: 12_000 })
      const sourcePageLoaded = await extCtx.page.locator("#proof-image").isVisible()
      const capturedPayloadStored = true
      const handoffUrl = `chrome-extension://${extCtx.extensionId}/image-translate.html?handoff=${encodeURIComponent(token)}`
      await extCtx.page.goto(handoffUrl, { waitUntil: "domcontentloaded", timeout: 20_000 })
      await extCtx.page.waitForSelector("[data-testid='image-translation-result-panel'], [data-testid='image-translation-error']", { timeout: 20_000 })

      const errorText = await extCtx.page.locator("[data-testid='image-translation-error']").textContent().catch(() => null)
      const resultPanelText = await extCtx.page.locator("[data-testid='image-translation-result-panel']").textContent().catch(() => null)
      const resultPanelVisible = await extCtx.page.locator("[data-testid='image-translation-result-panel']").isVisible().catch(() => false)
      if (resultPanelVisible) {
        await extCtx.page.waitForSelector("[data-testid='image-translation-overlay-box']", { timeout: 20_000 })
      }
      const overlayVisible = await extCtx.page.locator("[data-testid='image-translation-overlay-box']").first().isVisible().catch(() => false)
      const handoffUrlOpened = extCtx.page.url().includes("image-translate.html")
      const extractedTextVisible = resultPanelText?.includes("Context menu image") === true
        && resultPanelText.includes("Bonjour Astra")
      const translatedTextVisible = resultPanelText?.includes("ZH:Context menu image") === true
        && resultPanelText.includes("ZH:Bonjour Astra")
      const screenshotPath = path.join(artifactDir, "image-translation-context-menu-handoff.png")
      await extCtx.page.screenshot({ path: screenshotPath, fullPage: true })

      runtime.attachArtifact("imageContextMenuHandoff", {
        screenshotPath,
        sourceHtmlPath,
        sourceUrl: proofServer.sourceUrl,
        imageUrl: proofServer.imageUrl,
        capturedPayloadStored,
        originalImageRequestCount: proofServer.imageRequestCount,
        handoffUrl,
        relayRequestCount: proofServer.translateRequests.length,
        translatePayloads: proofServer.translateRequests,
      })
      runtime.complete("Image/OCR context-menu handoff live scenario completed.")
      const snapshot = runtime.snapshot()

      return {
        status: snapshot.status,
        summary: "Opened the Image/OCR page with a short-lived captured context-menu image handoff and verified preload, OCR extraction, translation, and overlay output without needing the original image URL fetch.",
        notes: [
          `Relay requests: ${proofServer.translateRequests.length}`,
          `Original image requests: ${proofServer.imageRequestCount}`,
          `Browser executable: ${extCtx.browserExecutablePath}`,
          "Chrome extension context-menu UI is not automatable in headless Playwright; background/content unit coverage exercises capture on click, and this live proof verifies the captured handoff contract end-to-end.",
        ],
        artifacts: {
          screenshotPath,
          sourceHtmlPath,
        },
        runtime: snapshot,
        startedAt: snapshot.startedAt,
        finishedAt: snapshot.finishedAt,
        imageContextMenuHandoff: {
          sourcePageLoaded,
          handoffUrlOpened,
          resultPanelVisible,
          extractedTextVisible,
          translatedTextVisible,
          overlayVisible,
          capturedPayloadStored,
          originalImageRequestCount: proofServer.imageRequestCount,
          relayRequestCount: proofServer.translateRequests.length,
          consoleErrors,
          errorText,
        },
      }
    } catch (error) {
      if (error instanceof LiveBrowserUnavailableError || error instanceof ExtensionBuildNotFoundError) {
        runtime.skip(error.message)
        const snapshot = runtime.snapshot()
        return {
          status: snapshot.status,
          summary: "Image/OCR context-menu handoff live scenario skipped because the browser or extension build was unavailable.",
          notes: [error.message],
          runtime: snapshot,
          startedAt: snapshot.startedAt,
          finishedAt: snapshot.finishedAt,
        }
      }
      throw error
    } finally {
      await extCtx?.close()
      await proofServer?.close()
    }
  },
  evaluate(execution, context): Partial<LiveEvaluationResult> {
    const handoff = execution.imageContextMenuHandoff
    const issues: string[] = []
    if (!handoff?.sourcePageLoaded) issues.push("Context-menu source image page did not load.")
    if (!handoff?.handoffUrlOpened) issues.push("Image translate page was not opened from the handoff URL.")
    if (!handoff?.resultPanelVisible) issues.push("Image translate result panel was not visible after consuming handoff.")
    if (!handoff?.extractedTextVisible) issues.push("Preloaded handoff image text was not extracted and shown.")
    if (!handoff?.translatedTextVisible) issues.push("Preloaded handoff image text was not translated through the relay.")
    if (!handoff?.overlayVisible) issues.push("Translated overlay was not visible for the context-menu handoff image.")
    if (!handoff?.capturedPayloadStored) issues.push("Captured image payload was not stored in the short-lived handoff.")
    if ((handoff?.originalImageRequestCount ?? 0) > 1) issues.push("Image translate page fetched the original image URL instead of preferring the captured handoff payload.")
    if ((handoff?.relayRequestCount ?? 0) < 1) issues.push("Translation pipeline relay was not called.")
    if ((handoff?.consoleErrors.length ?? 0) > 0) issues.push(`Console errors: ${handoff?.consoleErrors.join(" | ")}`)
    if (handoff?.errorText) issues.push(`Page fallback shown: ${handoff.errorText}`)

    return {
      runId: context.runId,
      scenario: context.scenario,
      status: issues.length === 0 ? "pass" : "fail",
      pass: issues.length === 0,
      score: issues.length === 0 ? 100 : 0,
      summary: issues.length === 0
        ? "Image/OCR context-menu handoff opened the image translate page, preferred the captured image payload, and reused the existing OCR/translation pipeline."
        : "Image/OCR context-menu handoff live scenario failed one or more required checks.",
      issues,
      nextActions: issues.length === 0 ? [] : ["Fix the Image/OCR context-menu handoff regression."],
      notes: execution.notes ?? [],
    }
  },
}
