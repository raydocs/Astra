import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

import {
  materializeFixturePage,
  serveMaterializedFixturePage,
  withExtensionBrowserPage,
  LiveBrowserUnavailableError,
  ExtensionBuildNotFoundError,
  type ExtensionBrowserContext,
} from "../driver"
import type { LiveScenarioDefinition, LiveScenarioExecution, LiveScenarioMetadata, LiveEvaluationResult } from "../evaluator"

const FIXTURE_NAME = "article-basic"
const AUTO_START_HOST = "localhost"

interface SiteAutomationAutostartExecution extends LiveScenarioExecution {
  autoStartResult: {
    floatBallMounted: boolean
    translationMarkersPresent: boolean
    translationMarkerCount: number
    shadowHostsFound: string[]
    consoleErrors: string[]
  }
}

export const siteAutomationAutostartScenario: LiveScenarioDefinition<SiteAutomationAutostartExecution> = {
  id: "bench-live/site-automation-autostart",
  title: "Live site-automation autostart",
  surface: "site-automation",
  fixture: `page:${FIXTURE_NAME}`,
  description:
    "Loads the real Astra extension in Chrome, configures site-automation with alwaysTranslate for the fixture host, and verifies the extension bootstrap path without manual interaction. Validates the content script lifecycle: storage read, config application, and Astra host mounting on a real localhost page.",
  tags: ["playwright", "site-automation", "browser", "extension-loaded"],
  async run(runtime, context) {
    runtime.start(context.id, context.title)
    runtime.log("Starting extension-loaded site-automation autostart scenario.", {
      fixture: FIXTURE_NAME,
    })

    const fixturePage = await materializeFixturePage({
      runId: context.runId,
      fixtureName: FIXTURE_NAME,
      title: context.title,
    })
    const servedFixturePage = await serveMaterializedFixturePage(fixturePage, {
      host: AUTO_START_HOST,
    })

    let extCtx: ExtensionBrowserContext | null = null

    try {
      extCtx = await withExtensionBrowserPage({
        initialUrl: "about:blank",
        waitForExtensionInject: 0,
        storageState: {
          "astra.config.v1": {
            version: 1,
            targetLang: "zh-CN",
            connectionMode: "astra",
            hoverTrigger: "alt",
            contentScope: "page",
            inputTranslation: "disabled",
            inputTranslationMode: "replace",
            languageLevel: "intermediate",
            privacyMode: false,
            provider: {
              id: "openai",
              apiKey: "bench-live-test-key",
              model: "gpt-5.4-nano",
            },
            presentation: {
              mode: "bilingual",
              theme: "default",
              fontSize: 0.92,
              translationColor: "#64748b",
            },
            sites: {
              [AUTO_START_HOST]: {
                enabled: true,
                alwaysTranslate: true,
              },
            },
            customActions: [],
          },
        },
      })

      runtime.checkpoint("Extension browser context launched.", {
        extensionPath: extCtx.extensionPath,
        browserExecutablePath: extCtx.browserExecutablePath,
        extensionId: extCtx.extensionId,
      })

      const consoleErrors: string[] = []
      extCtx.page.on("console", (msg) => {
        if (msg.type() === "error") {
          consoleErrors.push(msg.text())
        }
      })

      await extCtx.page.goto(servedFixturePage.url, {
        waitUntil: "domcontentloaded",
        timeout: 15_000,
      })

      // Bootstrap sequence: read storage → mount content script → apply site rules → start translation
      const injectTimeout = 8_000
      let floatBallMounted = false
      let translationMarkersPresent = false
      let translationMarkerCount = 0
      let shadowHostsFound: string[] = []

      try {
        await extCtx.page.waitForFunction(
          () => !!document.getElementById("astra-float-ball-host"),
          { timeout: injectTimeout },
        )
        floatBallMounted = true
      } catch {
        runtime.log("Float ball host did not appear within timeout.", {
          timeout: injectTimeout,
        })
      }

      if (floatBallMounted) {
        try {
          await extCtx.page.waitForFunction(
            () => document.querySelectorAll("[data-astra-translation='1']").length > 0,
            { timeout: 5_000 },
          )
          translationMarkersPresent = true
        } catch {
          runtime.log("Translation markers did not appear within timeout.", {
            timeout: 5_000,
          })
        }
      }

      translationMarkerCount = await extCtx.page.evaluate(() =>
        document.querySelectorAll("[data-astra-translation='1']").length,
      )

      shadowHostsFound = await extCtx.page.evaluate(() => {
        const hosts: string[] = []
        for (const id of [
          "astra-float-ball-host",
          "astra-selection-toolbar-host",
          "astra-hover-translate-host",
          "astra-input-translate-host",
        ]) {
          if (document.getElementById(id)) {
            hosts.push(id)
          }
        }
        return hosts
      })

      await extCtx.page.waitForTimeout(500)

      const postInjectScreenshotPath = path.join(fixturePage.artifactDir, `${FIXTURE_NAME}.site-automation.autostart.post-inject.png`)
      await mkdir(path.dirname(postInjectScreenshotPath), { recursive: true })

      await extCtx.page.screenshot({
        path: postInjectScreenshotPath,
        fullPage: true,
      })

      const snapshotHtml = await extCtx.page.content()
      const snapshotHtmlPath = path.join(fixturePage.artifactDir, `${FIXTURE_NAME}.site-automation.autostart.snapshot.html`)
      await writeFile(snapshotHtmlPath, snapshotHtml, "utf8")

      runtime.attachArtifact("fixturePage", {
        htmlPath: fixturePage.htmlPath,
        url: servedFixturePage.url,
      })
      runtime.attachArtifact("browser", {
        executablePath: extCtx.browserExecutablePath,
        extensionPath: extCtx.extensionPath,
      })
      runtime.attachArtifact("autoStartCapture", {
        floatBallMounted,
        translationMarkersPresent,
        translationMarkerCount,
        shadowHostsFound,
        consoleErrors,
        screenshotPath: postInjectScreenshotPath,
        snapshotHtmlPath,
      })

      runtime.complete("Extension-loaded site-automation autostart scenario completed.")
      const snapshot = runtime.snapshot()

      const autoStartResult = {
        floatBallMounted,
        translationMarkersPresent,
        translationMarkerCount,
        shadowHostsFound,
        consoleErrors,
      }

      return {
        status: snapshot.status,
        summary: floatBallMounted
          ? `Extension-loaded site automation bootstrapped successfully. Float ball mounted. ${translationMarkerCount} translation markers found.`
          : "Extension-loaded site automation did not bootstrap within timeout.",
        notes: [
          `Float ball mounted: ${floatBallMounted}`,
          `Translation markers: ${translationMarkerCount}`,
          `Shadow hosts found: ${shadowHostsFound.join(", ") || "none"}`,
          `Console errors: ${consoleErrors.length}`,
        ],
        artifacts: {
          browserExecutablePath: extCtx.browserExecutablePath,
          extensionPath: extCtx.extensionPath,
          htmlPath: fixturePage.htmlPath,
          servedUrl: servedFixturePage.url,
          screenshotPath: postInjectScreenshotPath,
          snapshotHtmlPath,
        },
        runtime: snapshot,
        startedAt: snapshot.startedAt,
        finishedAt: snapshot.finishedAt,
        autoStartResult,
      }
    } catch (error) {
      if (error instanceof LiveBrowserUnavailableError) {
        runtime.skip(error.message)
        const snapshot = runtime.snapshot()
        return {
          status: snapshot.status,
          summary: "No supported browser executable available for extension-loaded test.",
          notes: [error.message],
          artifacts: { browserAvailability: "missing" },
          runtime: snapshot,
          startedAt: snapshot.startedAt,
          finishedAt: snapshot.finishedAt,
          autoStartResult: {
            floatBallMounted: false,
            translationMarkersPresent: false,
            translationMarkerCount: 0,
            shadowHostsFound: [],
            consoleErrors: [],
          },
        }
      }

      if (error instanceof ExtensionBuildNotFoundError) {
        runtime.skip(error.message)
        const snapshot = runtime.snapshot()
        return {
          status: snapshot.status,
          summary: "Chrome extension build not found. Run pnpm build first.",
          notes: [error.message],
          artifacts: { extensionBuild: "missing" },
          runtime: snapshot,
          startedAt: snapshot.startedAt,
          finishedAt: snapshot.finishedAt,
          autoStartResult: {
            floatBallMounted: false,
            translationMarkersPresent: false,
            translationMarkerCount: 0,
            shadowHostsFound: [],
            consoleErrors: [],
          },
        }
      }

      throw error
    } finally {
      await extCtx?.close()
      await servedFixturePage.close()
    }
  },

  evaluate(execution, context) {
    const { autoStartResult } = execution
    const issues: string[] = []
    const nextActions: string[] = []

    if (!autoStartResult.floatBallMounted) {
      issues.push("Float ball (#astra-float-ball-host) did not mount within the timeout.")
      nextActions.push("Check content script bootstrap: verify storage read, config application, and DOM injection.")
    }

    if (!autoStartResult.translationMarkersPresent) {
      nextActions.push("Verify that site-automation always-translate triggers page translation after mount once provider/network dependencies are available.")
    }

    if (autoStartResult.consoleErrors.length > 0) {
      issues.push(`${autoStartResult.consoleErrors.length} console error(s) during extension bootstrap.`)
      nextActions.push("Inspect console errors for extension initialization failures.")
    }

    if (autoStartResult.shadowHostsFound.length === 0) {
      issues.push("No Astra shadow DOM hosts were found on the page.")
      nextActions.push("Verify content script injection permissions and content_scripts manifest.")
    }

    const pass = autoStartResult.floatBallMounted
      && autoStartResult.shadowHostsFound.length > 0
      && autoStartResult.consoleErrors.length === 0

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
      score: pass ? 100 : 0,
      summary: pass
        ? "Extension auto-start verification passed: content script bootstrapped and Astra UI hosts mounted without console errors."
        : "Extension auto-start verification failed: the extension did not bootstrap correctly.",
      issues,
      nextActions,
      notes: execution.notes ?? [],
      rubrics: [],
      artifacts: execution.artifacts ?? {},
      runtime: context.runtime,
    } as unknown as Partial<LiveEvaluationResult>
  },
}