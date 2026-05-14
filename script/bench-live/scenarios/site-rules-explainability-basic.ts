import { createServer } from "node:http"
import { writeFile } from "node:fs/promises"
import path from "node:path"

import {
  prepareLiveArtifactDir,
  ExtensionBuildNotFoundError,
  LiveBrowserUnavailableError,
  openExtensionActionPopup,
  withExtensionBrowserPage,
  type ExtensionBrowserContext,
} from "../driver"
import type {
  LiveEvaluationResult,
  LiveScenarioDefinition,
  LiveScenarioExecution,
  LiveScenarioMetadata,
} from "../evaluator"

const SCENARIO_ID = "bench-live/site-rules-explainability-basic"

const FIXTURE_HTML = `<!doctype html>
<html>
  <head><meta charset="utf-8"><title>Site rules explainability fixture</title></head>
  <body>
    <main>
      <article class="article-body">
        <h1>Site rules explainability fixture</h1>
        <p>Readers need a clear reason when a page is not translated.</p>
        <p>Selectors can be valid yet still match no collected translation blocks.</p>
      </article>
      <aside class="ad-slot">Sponsored sidebar text should never matter.</aside>
    </main>
  </body>
</html>`

interface SiteRulesExplainabilityExecution extends LiveScenarioExecution {
  siteRulesExplainability: {
    popupRendered: boolean
    panelVisible: boolean
    ruleSourceVisible: boolean
    invalidSelectorVisible: boolean
    noMatchVisible: boolean
    runtimeDiagnosticsVisible: boolean
    honestFallbackAbsent: boolean
    includeQuickFixVisible: boolean
    includeQuickFixCleared: boolean
    consoleErrors: string[]
  }
}

function startFixtureServer(): Promise<{ origin: string; url: string; close: () => Promise<void> }> {
  const server = createServer((req, res) => {
    if (req.url === "/" || req.url?.startsWith("/site-rules-explainability")) {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" })
      res.end(FIXTURE_HTML)
      return
    }

    if (req.url === "/favicon.ico") {
      res.writeHead(204)
      res.end()
      return
    }

    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" })
    res.end("Not found")
  })

  return new Promise((resolve, reject) => {
    server.once("error", reject)
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      if (!address || typeof address === "string") {
        reject(new Error("Fixture server did not expose a TCP port."))
        return
      }
      const origin = `http://127.0.0.1:${address.port}`
      resolve({
        origin,
        url: `${origin}/site-rules-explainability/index.html`,
        async close() {
          server.closeAllConnections?.()
          server.closeIdleConnections?.()
          await new Promise<void>((closeResolve, closeReject) => {
            server.close((error) => (error ? closeReject(error) : closeResolve()))
          })
        },
      })
    })
  })
}

export const siteRulesExplainabilityBasicScenario: LiveScenarioDefinition<SiteRulesExplainabilityExecution> = {
  id: SCENARIO_ID,
  title: "Live site-rules explainability basic",
  surface: "popup",
  fixture: "page:site-rules-explainability",
  description:
    "Loads a real page with a no-match site selector rule, opens the popup, and verifies the Why this page panel explains rule source, invalid selector handling, no-match filters, runtime diagnostics, and the include-selector quick fix.",
  tags: ["playwright", "popup", "site-rules", "explainability", "browser", "extension-loaded"],
  async run(runtime, context) {
    runtime.start(context.id, context.title)
    runtime.log("Starting site-rules explainability scenario.")

    const fixtureServer = await startFixtureServer()
    let extCtx: ExtensionBrowserContext | null = null
    const consoleErrors: string[] = []

    try {
      const artifactDir = await prepareLiveArtifactDir(context.runId)

      const liveConfig = {
        version: 1,
        targetLang: "zh-CN",
        connectionMode: "custom",
        hoverTrigger: "alt",
        contentScope: "page",
        inputTranslation: "disabled",
        inputTranslationMode: "replace",
        languageLevel: "beginner",
        explainMode: "exam",
        privacyMode: false,
        provider: {
          id: "openai",
          accessToken: "bench-live-site-rules-token",
          relayBaseURL: fixtureServer.origin,
          model: "gpt-5.4-nano",
        },
        presentation: {
          mode: "bilingual",
          theme: "default",
          fontSize: 0.92,
          translationColor: "#64748b",
        },
        sites: {
          "127.0.0.1": {
            enabled: true,
            alwaysTranslate: true,
            selectors: [".does-not-match-any-block", "article["],
            excludeSelectors: [".ad-slot"],
            paragraphMinLength: 30,
          },
        },
        customActions: [],
      }

      extCtx = await withExtensionBrowserPage({
        waitForExtensionInject: 0,
        storageState: {
          "astra.config.v1": liveConfig,
        },
      })

      extCtx.page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text())
      })

      await extCtx.page.goto(fixtureServer.url, { waitUntil: "domcontentloaded", timeout: 15_000 })
      await extCtx.page.waitForFunction(
        () => document.body.innerText.includes("Site rules explainability fixture"),
        undefined,
        { timeout: 10_000 },
      )
      await extCtx.page.reload({ waitUntil: "domcontentloaded", timeout: 15_000 })
      await extCtx.page.waitForFunction(
        () => document.body.innerText.includes("Site rules explainability fixture"),
        undefined,
        { timeout: 10_000 },
      )
      await extCtx.page.waitForTimeout(1_000)

      const popupPage = await openExtensionActionPopup({
        context: extCtx.context,
        extensionId: extCtx.extensionId,
        extensionPath: extCtx.extensionPath,
        timeoutMs: 12_000,
        page: extCtx.page,
      })
      popupPage.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text())
      })

      let popupRendered = false
      let panelVisible = false
      let ruleSourceVisible = false
      let invalidSelectorVisible = false
      let noMatchVisible = false
      let runtimeDiagnosticsVisible = false
      let honestFallbackAbsent = false
      let includeQuickFixVisible = false
      let includeQuickFixCleared = false

      try {
        await popupPage.locator("summary", { hasText: "More tools" }).click({ timeout: 12_000 })
        await popupPage.waitForSelector('[data-testid="site-rules-explainability-panel"]', { timeout: 12_000 })
        popupRendered = true
        const panelText = await popupPage.locator('[data-testid="site-rules-explainability-panel"]').innerText()
        panelVisible = panelText.includes("Why this page?")
        ruleSourceVisible = panelText.includes("Saved site rule for 127.0.0.1")
        invalidSelectorVisible = panelText.includes("Include selectors invalid") && panelText.includes("article[")
        noMatchVisible = panelText.includes("filters matched no translatable blocks")
          || panelText.includes("Include selectors currently match no collected text blocks")
        runtimeDiagnosticsVisible = panelText.includes("Runtime diagnostics") && panelText.includes("available")
        honestFallbackAbsent = !panelText.includes("unavailable")
        const includeQuickFix = popupPage.locator('[data-testid="site-rules-quick-fix-clear-include-selectors"]')
        includeQuickFixVisible = await includeQuickFix.isVisible({ timeout: 1_000 }).catch(() => false)
        if (includeQuickFixVisible) {
          await includeQuickFix.click()
          includeQuickFixCleared = await popupPage.waitForFunction(async (storageKey) => {
            const extensionChrome = (globalThis as unknown as {
              chrome?: { storage?: { local?: { get: (key: string) => Promise<Record<string, unknown>> } } }
            }).chrome
            if (!extensionChrome?.storage?.local) return false
            const raw = await extensionChrome.storage.local.get(storageKey)
            const config = raw[storageKey] as { sites?: Record<string, { selectors?: unknown; excludeSelectors?: unknown }> } | undefined
            const rule = config?.sites?.["127.0.0.1"]
            return !!rule && rule.selectors === undefined && Array.isArray(rule.excludeSelectors)
          }, "astra.config.v1", { timeout: 5_000 }).then(() => true, () => false)
        }
      } finally {
        const screenshotPath = path.join(artifactDir, "site-rules-explainability-basic.popup.png")
        await popupPage.screenshot({ path: screenshotPath, fullPage: true })
        const snapshotPath = path.join(artifactDir, "site-rules-explainability-basic.popup.html")
        await writeFile(snapshotPath, await popupPage.content(), "utf8")
        runtime.attachArtifact("siteRulesExplainabilityCapture", {
          screenshotPath,
          snapshotPath,
          consoleErrors,
          fixtureUrl: fixtureServer.url,
        })
      }

      runtime.complete("Site-rules explainability scenario completed.")
      const snapshot = runtime.snapshot()
      return {
        status: snapshot.status,
        summary: "Site-rules explainability popup scenario executed.",
        notes: [
          `Popup rendered: ${popupRendered}`,
          `Panel visible: ${panelVisible}`,
          `Rule source visible: ${ruleSourceVisible}`,
          `Invalid selector visible: ${invalidSelectorVisible}`,
          `No-match visible: ${noMatchVisible}`,
          `Runtime diagnostics visible: ${runtimeDiagnosticsVisible}`,
          `Honest fallback absent after runtime diagnostics: ${honestFallbackAbsent}`,
          `Include quick fix visible: ${includeQuickFixVisible}`,
          `Include quick fix cleared selectors: ${includeQuickFixCleared}`,
          `Console errors: ${consoleErrors.length}`,
        ],
        artifacts: {
          fixtureUrl: fixtureServer.url,
          extensionPath: extCtx.extensionPath,
          browserExecutablePath: extCtx.browserExecutablePath,
        },
        runtime: snapshot,
        startedAt: snapshot.startedAt,
        finishedAt: snapshot.finishedAt,
        siteRulesExplainability: {
          popupRendered,
          panelVisible,
          ruleSourceVisible,
          invalidSelectorVisible,
          noMatchVisible,
          runtimeDiagnosticsVisible,
          honestFallbackAbsent,
          includeQuickFixVisible,
          includeQuickFixCleared,
          consoleErrors,
        },
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
          siteRulesExplainability: {
            popupRendered: false,
            panelVisible: false,
            ruleSourceVisible: false,
            invalidSelectorVisible: false,
            noMatchVisible: false,
            runtimeDiagnosticsVisible: false,
            honestFallbackAbsent: false,
            includeQuickFixVisible: false,
            includeQuickFixCleared: false,
            consoleErrors: [],
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
          siteRulesExplainability: {
            popupRendered: false,
            panelVisible: false,
            ruleSourceVisible: false,
            invalidSelectorVisible: false,
            noMatchVisible: false,
            runtimeDiagnosticsVisible: false,
            honestFallbackAbsent: false,
            includeQuickFixVisible: false,
            includeQuickFixCleared: false,
            consoleErrors: [],
          },
        }
      }

      throw error
    } finally {
      await extCtx?.close()
      await fixtureServer.close()
    }
  },
  evaluate(execution, context) {
    const details = execution.siteRulesExplainability ?? {
      popupRendered: false,
      panelVisible: false,
      ruleSourceVisible: false,
      invalidSelectorVisible: false,
      noMatchVisible: false,
      runtimeDiagnosticsVisible: false,
      honestFallbackAbsent: false,
      includeQuickFixVisible: false,
      includeQuickFixCleared: false,
      consoleErrors: [],
    }
    const issues: string[] = []
    const nextActions: string[] = []

    if (!details.popupRendered || !details.panelVisible) {
      issues.push("Why this page panel did not render in the popup.")
      nextActions.push("Check popup App integration and SiteRulesExplainabilityPanel rendering.")
    }
    if (!details.ruleSourceVisible) issues.push("Panel did not show the saved site-rule source.")
    if (!details.invalidSelectorVisible) issues.push("Panel did not show invalid selector diagnostics.")
    if (!details.noMatchVisible) issues.push("Panel did not show selector no-match diagnostics.")
    if (!details.runtimeDiagnosticsVisible) issues.push("Panel did not show runtime diagnostics as available.")
    if (!details.honestFallbackAbsent) issues.push("Panel still reported diagnostics unavailable after runtime diagnostics arrived.")
    if (!details.includeQuickFixVisible) issues.push("Panel did not show the include-selector quick fix CTA.")
    if (!details.includeQuickFixCleared) issues.push("Include-selector quick fix did not clear persisted selectors.")
    if (details.consoleErrors.length > 0) issues.push(`${details.consoleErrors.length} console error(s) were captured.`)

    const pass = details.popupRendered
      && details.panelVisible
      && details.ruleSourceVisible
      && details.invalidSelectorVisible
      && details.noMatchVisible
      && details.runtimeDiagnosticsVisible
      && details.honestFallbackAbsent
      && details.includeQuickFixVisible
      && details.includeQuickFixCleared
      && details.consoleErrors.length === 0

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
      score: pass ? 100 : details.panelVisible ? 50 : 0,
      summary: pass
        ? "Site-rules explainability passed: popup explains rule source, invalid selector/no-match behavior, runtime diagnostics, and quick-fix clearing."
        : "Site-rules explainability failed: popup diagnostics are incomplete.",
      issues,
      nextActions,
      notes: execution.notes ?? [],
      rubrics: [],
      artifacts: execution.artifacts ?? {},
      runtime: context.runtime,
    } as unknown as Partial<LiveEvaluationResult>
  },
}
