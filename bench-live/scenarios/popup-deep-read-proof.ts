import { createServer } from "node:http"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

import {
  materializeFixturePage,
  openExtensionActionPopup,
  serveMaterializedFixturePage,
  withExtensionBrowserPage,
  LiveBrowserUnavailableError,
  ExtensionBuildNotFoundError,
  type ExtensionBrowserContext,
} from "../driver"
import type {
  LiveEvaluationResult,
  LiveScenarioDefinition,
  LiveScenarioExecution,
  LiveScenarioMetadata,
} from "../evaluator"

const FIXTURE_NAME = "article-basic"
const POPUP_DEEP_READ_PROOF_ID = "bench-live/popup-deep-read-proof"
const POPUP_DEEP_READ_PROOF_SLUG = "popup-deep-read-proof"

interface RelayTranslateRequest {
  texts?: string[]
  targetLang?: string
  context?: {
    pageTitle?: string
    pageUrl?: string
    hostname?: string
    metaDescription?: string
    contentSummary?: string
    selectionContext?: string
  }
  task?: string
  customSystemPrompt?: string
}

interface PopupDeepReadProofExecution extends LiveScenarioExecution {
  popupDeepRead: {
    popupRendered: boolean
    articleExcerptVisible: boolean
    sentenceDeckPresent: boolean
    explainWorked: boolean
    saveWorked: boolean
    destinationOpened: boolean
    sourceContextVisible: boolean
    consoleErrors: string[]
    relayRequestCount: number
  }
}

async function createPopupDeepReadRelayServer() {
  const translateRequests: RelayTranslateRequest[] = []

  const server = createServer((req, res) => {
    const requestUrl = new URL(req.url ?? "/", "http://127.0.0.1")

    if (req.method === "OPTIONS" && requestUrl.pathname === "/translate") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
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

        const sourceText = payload.texts?.[0]?.trim() ?? ""
        const responseText = payload.task === "explain"
          ? `EXPLAIN:${sourceText}`
          : `ZH:${sourceText}`

        res.writeHead(200, {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          Connection: "close",
        })
        res.end(JSON.stringify({ translations: [responseText] }))
      })
      return
    }

    if (req.method === "GET" && requestUrl.pathname === "/favicon.ico") {
      res.writeHead(204, { Connection: "close" })
      res.end()
      return
    }

    res.writeHead(404, {
      "Content-Type": "text/plain; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      Connection: "close",
    })
    res.end("Not found")
  })

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject)
    server.listen(0, "127.0.0.1", () => resolve())
  })

  const address = server.address()
  if (!address || typeof address === "string") {
    throw new Error("Popup deep-read relay server did not expose a TCP port.")
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

export const popupDeepReadProofScenario: LiveScenarioDefinition<PopupDeepReadProofExecution> = {
  id: POPUP_DEEP_READ_PROOF_ID,
  title: "Live popup deep-read proof",
  surface: "popup",
  fixture: `page:${FIXTURE_NAME}`,
  description:
    "Loads a real article page with the Astra extension, opens the real action popup, runs one sentence explain, saves it to vocabulary with popup source-context, and verifies the saved result is recoverable in the vocabulary surface.",
  tags: ["playwright", "popup", "deep-read", "learning-loop", "browser", "extension-loaded", "proof"],
  async run(runtime, context) {
    runtime.start(context.id, context.title)
    runtime.log("Starting popup deep-read proof scenario.", {
      fixture: FIXTURE_NAME,
    })

    const fixturePage = await materializeFixturePage({
      runId: context.runId,
      fixtureName: FIXTURE_NAME,
      title: context.title,
    })
    const servedFixturePage = await serveMaterializedFixturePage(fixturePage)

    let extCtx: ExtensionBrowserContext | null = null
    let relayServer: Awaited<ReturnType<typeof createPopupDeepReadRelayServer>> | null = null

    try {
      relayServer = await createPopupDeepReadRelayServer()

      const artifactDir = path.join(process.cwd(), "bench-live-results", context.runId)
      await mkdir(artifactDir, { recursive: true })

      const liveConfig = {
        version: 1,
        targetLang: "zh-CN",
        connectionMode: "custom",
        hoverTrigger: "alt",
        contentScope: "article",
        inputTranslation: "disabled",
        inputTranslationMode: "replace",
        languageLevel: "beginner",
        privacyMode: false,
        provider: {
          id: "openai",
          // Omit apiKey so the provider router uses relay (matches real relay URL shape: …/translate).
          accessToken: "bench-live-popup-proof-token",
          relayBaseURL: relayServer.origin,
          model: "gpt-5.4-nano",
        },
        presentation: {
          mode: "bilingual",
          theme: "default",
          fontSize: 0.92,
          translationColor: "#64748b",
        },
        sites: {
          localhost: {
            enabled: true,
            alwaysTranslate: false,
          },
        },
        customActions: [],
      }

      // Seed relay config via storageState before the first navigation (same pattern as site-automation).
      extCtx = await withExtensionBrowserPage({
        initialUrl: servedFixturePage.url,
        waitForExtensionInject: 8_000,
        storageState: {
          "astra.config.v1": liveConfig,
        },
      })

      const consoleErrors: string[] = []
      extCtx.page.on("console", (msg) => {
        if (msg.type() === "error") {
          consoleErrors.push(msg.text())
        }
      })

      await extCtx.page.waitForFunction(
        () => !!document.querySelector("article"),
        undefined,
        { timeout: 10_000 },
      )

      // Ensure content scripts pick up freshly seeded storage (MV3 timing can miss the first navigation).
      await extCtx.page.reload({ waitUntil: "domcontentloaded", timeout: 15_000 })
      await extCtx.page.waitForFunction(
        () => !!document.querySelector("article"),
        undefined,
        { timeout: 10_000 },
      )

      const popupPage = await openExtensionActionPopup({
        context: extCtx.context,
        extensionId: extCtx.extensionId,
        extensionPath: extCtx.extensionPath,
        timeoutMs: 12_000,
        page: extCtx.page,
      })

      popupPage.on("console", (msg) => {
        if (msg.type() === "error") {
          consoleErrors.push(msg.text())
        }
      })

      let popupRendered = false
      let articleExcerptVisible = false
      let sentenceDeckPresent = false
      let explainWorked = false
      let saveWorked = false
      let destinationOpened = false
      let sourceContextVisible = false

      try {
        await popupPage.waitForSelector('[data-testid="study-sentence-card-0"]', { timeout: 10_000 })
        popupRendered = true
      } catch {
        popupRendered = false
      }

      if (popupRendered) {
        const popupText = await popupPage.locator("body").innerText()
        articleExcerptVisible = popupText.includes("Readers can keep the original text visible")
          || popupText.includes("This fixture represents")
        sentenceDeckPresent = popupText.includes("Sentence drills")
          || popupText.includes("逐句深读")
          || popupText.includes("句卡精读")
          || popupText.includes("Sentence Drill")

        const popupBeforePath = path.join(artifactDir, `${POPUP_DEEP_READ_PROOF_SLUG}.before-explain.png`)
        await popupPage.screenshot({ path: popupBeforePath, fullPage: true })

        await popupPage.locator('[data-testid="study-sentence-card-0"] button').nth(0).click()
        await popupPage.waitForFunction(
          () => document.body.innerText.includes("EXPLAIN:"),
          undefined,
          { timeout: 25_000 },
        )
        explainWorked = true

        await popupPage.locator('[data-testid="study-sentence-card-0"] button').nth(1).click()
        await popupPage.waitForSelector('[data-testid="study-sentence-saved-cta-0"]', { timeout: 10_000 })
        saveWorked = true

        // Card 0 is the first split sentence of articleExcerpt — often the article title, not the second <p>.
        const savedSentenceText = (
          await popupPage
            .locator('[data-testid="study-sentence-card-0"]')
            .locator(":scope > div")
            .nth(1)
            .innerText()
        ).trim()

        const popupAfterPath = path.join(artifactDir, `${POPUP_DEEP_READ_PROOF_SLUG}.after-save.png`)
        await popupPage.screenshot({ path: popupAfterPath, fullPage: true })
        const popupSnapshotHtmlPath = path.join(artifactDir, `${POPUP_DEEP_READ_PROOF_SLUG}.popup.snapshot.html`)
        await writeFile(popupSnapshotHtmlPath, await popupPage.content(), "utf8")

        const destinationPagePromise = extCtx.context.waitForEvent("page", { timeout: 10_000 })
        await popupPage.locator('[data-testid="study-sentence-open-vocabulary-0"]').click()
        const destinationPage = await destinationPagePromise
        destinationPage.on("console", (msg) => {
          if (msg.type() === "error") {
            consoleErrors.push(msg.text())
          }
        })
        await destinationPage.waitForLoadState("domcontentloaded", { timeout: 10_000 })
        await destinationPage.waitForFunction(
          () => document.body.innerText.includes("Popup deep-read"),
          undefined,
          { timeout: 10_000 },
        )
        destinationOpened = destinationPage.url().includes("/vocabulary")

        const sentenceNeedle = savedSentenceText.length > 48
          ? savedSentenceText.slice(0, 48)
          : savedSentenceText
        await destinationPage.waitForFunction(
          (needle) => document.body.innerText.includes(needle),
          sentenceNeedle,
          { timeout: 15_000 },
        )
        await destinationPage.getByText(sentenceNeedle, { exact: false }).first().click()

        const destinationText = await destinationPage.locator("body").innerText()
        sourceContextVisible = destinationText.includes("Popup deep-read")
          && destinationText.includes("Astra turns long-form reading into bilingual learning.")
          && destinationText.includes("Readers can keep the original text visible")
          && destinationText.includes("Source context")

        const destinationScreenshotPath = path.join(artifactDir, `${POPUP_DEEP_READ_PROOF_SLUG}.vocabulary.png`)
        await destinationPage.screenshot({ path: destinationScreenshotPath, fullPage: true })
        const destinationSnapshotHtmlPath = path.join(artifactDir, `${POPUP_DEEP_READ_PROOF_SLUG}.vocabulary.snapshot.html`)
        await writeFile(destinationSnapshotHtmlPath, await destinationPage.content(), "utf8")

        runtime.attachArtifact("popupDeepReadCapture", {
          popupBeforePath,
          popupAfterPath,
          popupSnapshotHtmlPath,
          destinationScreenshotPath,
          destinationSnapshotHtmlPath,
          relayRequests: relayServer.translateRequests,
          consoleErrors,
        })
      }

      runtime.complete("Popup deep-read proof scenario completed.")
      const snapshot = runtime.snapshot()

      const popupDeepRead = {
        popupRendered,
        articleExcerptVisible,
        sentenceDeckPresent,
        explainWorked,
        saveWorked,
        destinationOpened,
        sourceContextVisible,
        consoleErrors,
        relayRequestCount: relayServer.translateRequests.length,
      }

      return {
        status: snapshot.status,
        summary: popupRendered
          ? "Popup deep-read proof executed against the real extension popup."
          : "Popup deep-read proof could not render the popup sentence deck.",
        notes: [
          `Popup rendered: ${popupRendered}`,
          `Article excerpt visible: ${articleExcerptVisible}`,
          `Sentence deck present: ${sentenceDeckPresent}`,
          `Explain worked: ${explainWorked}`,
          `Save worked: ${saveWorked}`,
          `Destination opened: ${destinationOpened}`,
          `Source context visible: ${sourceContextVisible}`,
          `Relay request count: ${relayServer.translateRequests.length}`,
          `Console errors: ${consoleErrors.length}`,
        ],
        artifacts: {
          artifactDir,
          extensionPath: extCtx.extensionPath,
          browserExecutablePath: extCtx.browserExecutablePath,
          fixtureUrl: servedFixturePage.url,
          relayOrigin: relayServer.origin,
        },
        runtime: snapshot,
        startedAt: snapshot.startedAt,
        finishedAt: snapshot.finishedAt,
        popupDeepRead,
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
          popupDeepRead: {
            popupRendered: false,
            articleExcerptVisible: false,
            sentenceDeckPresent: false,
            explainWorked: false,
            saveWorked: false,
            destinationOpened: false,
            sourceContextVisible: false,
            consoleErrors: [],
            relayRequestCount: 0,
          },
        }
      }

      if (error instanceof ExtensionBuildNotFoundError) {
        runtime.skip(error.message)
        const snapshot = runtime.snapshot()
        return {
          status: snapshot.status,
          summary: "Extension build not found. Run pnpm build first.",
          notes: [error.message],
          artifacts: { extensionBuild: "missing" },
          runtime: snapshot,
          startedAt: snapshot.startedAt,
          finishedAt: snapshot.finishedAt,
          popupDeepRead: {
            popupRendered: false,
            articleExcerptVisible: false,
            sentenceDeckPresent: false,
            explainWorked: false,
            saveWorked: false,
            destinationOpened: false,
            sourceContextVisible: false,
            consoleErrors: [],
            relayRequestCount: 0,
          },
        }
      }

      throw error
    } finally {
      await extCtx?.close()
      await servedFixturePage.close()
      await relayServer?.close()
    }
  },

  evaluate(execution, context) {
    const popupDeepRead = execution.popupDeepRead ?? {
      popupRendered: false,
      articleExcerptVisible: false,
      sentenceDeckPresent: false,
      explainWorked: false,
      saveWorked: false,
      destinationOpened: false,
      sourceContextVisible: false,
      consoleErrors: [],
      relayRequestCount: 0,
    }
    const issues: string[] = []
    const nextActions: string[] = []

    if (!popupDeepRead.popupRendered) {
      issues.push("Popup deep-read surface did not render.")
      nextActions.push("Check popup App.tsx and active-tab study-context wiring.")
    }
    if (!popupDeepRead.articleExcerptVisible) {
      issues.push("Popup did not surface article excerpt text.")
      nextActions.push("Check popup study context extraction and excerpt rendering.")
    }
    if (!popupDeepRead.sentenceDeckPresent) {
      issues.push("Popup sentence deck was not visible.")
      nextActions.push("Check StudySection sentence-card rendering.")
    }
    if (!popupDeepRead.explainWorked) {
      issues.push("Popup sentence explain did not complete.")
      nextActions.push("Check popup explain state and relay routing.")
    }
    if (!popupDeepRead.saveWorked) {
      issues.push("Popup sentence save did not complete.")
      nextActions.push("Check popup save flow and vocabulary storage wiring.")
    }
    if (!popupDeepRead.destinationOpened) {
      issues.push("Popup save CTA did not open the vocabulary surface.")
      nextActions.push("Check popup save CTA wiring to vocabulary tabs.")
    }
    if (!popupDeepRead.sourceContextVisible) {
      issues.push("Saved popup source context was not visible in vocabulary.")
      nextActions.push("Check vocabulary rendering of sourceContext metadata.")
    }
    if (popupDeepRead.consoleErrors.length > 0) {
      issues.push(`${popupDeepRead.consoleErrors.length} console error(s) were captured.`)
      nextActions.push("Inspect popup and vocabulary console errors in the live artifacts.")
    }

    const pass = popupDeepRead.popupRendered
      && popupDeepRead.articleExcerptVisible
      && popupDeepRead.sentenceDeckPresent
      && popupDeepRead.explainWorked
      && popupDeepRead.saveWorked
      && popupDeepRead.destinationOpened
      && popupDeepRead.sourceContextVisible
      && popupDeepRead.consoleErrors.length === 0

    const scenario: LiveScenarioMetadata = {
      id: context.scenario.id,
      title: context.scenario.title,
      surface: context.scenario.surface,
      fixture: context.scenario.fixture,
      description: context.scenario.description,
      tags: context.scenario.tags,
    }

    return {
      runId: context.runId,
      scenario,
      status: pass ? "pass" : "fail",
      pass,
      score: pass ? 100 : popupDeepRead.popupRendered ? 50 : 0,
      summary: pass
        ? "Popup deep-read proof passed: popup explain/save flowed into visible vocabulary source context."
        : "Popup deep-read proof failed: popup explain/save/vocabulary join-up is incomplete.",
      issues,
      nextActions,
      notes: execution.notes ?? [],
      rubrics: [],
      artifacts: execution.artifacts ?? {},
      runtime: context.runtime,
    } as unknown as Partial<LiveEvaluationResult>
  },
}
