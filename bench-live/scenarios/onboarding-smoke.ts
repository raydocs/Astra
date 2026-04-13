import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

import {
  withExtensionBrowserPage,
  LiveBrowserUnavailableError,
  ExtensionBuildNotFoundError,
  type ExtensionBrowserContext,
} from "../driver"
import { sleep } from "../sleep"
import type { LiveEvaluationResult, LiveScenarioDefinition, LiveScenarioExecution, LiveScenarioMetadata } from "../evaluator"

interface OnboardingSmokeExecution extends LiveScenarioExecution {
  onboarding: {
    rendersWithoutCrash: boolean
    headingTextPresent: boolean
    stepIndicatorPresent: boolean
    languageOptionsPresent: boolean
    consoleErrors: string[]
  }
}

export const onboardingSmokeScenario: LiveScenarioDefinition<OnboardingSmokeExecution> = {
  id: "bench-live/onboarding-smoke",
  title: "Live onboarding smoke test",
  surface: "onboarding",
  description:
    "Loads the Astra extension and verifies the onboarding page renders without crashing, shows a heading, displays a step indicator, and presents language options.",
  tags: ["playwright", "onboarding", "browser", "extension-loaded", "smoke"],
  async run(runtime, context) {
    runtime.start(context.id, context.title)
    runtime.log("Starting extension-loaded onboarding smoke test.")

    const artifactDir = path.join(process.cwd(), "bench-live-results", context.runId)
    await mkdir(artifactDir, { recursive: true })

    let extCtx: ExtensionBrowserContext | null = null

    try {
      extCtx = await withExtensionBrowserPage({
        initialUrl: "about:blank",
        waitForExtensionInject: 0,
      })

      runtime.checkpoint("Extension browser context launched for onboarding.", {
        extensionPath: extCtx.extensionPath,
      })
      const page = extCtx.page

      const consoleErrors: string[] = []
      page.on("console", (msg) => {
        if (msg.type() === "error") {
          consoleErrors.push(msg.text())
        }
      })

      const onboardingUrl = `chrome-extension://${extCtx.extensionId}/onboarding.html`
      await page.goto(onboardingUrl, { waitUntil: "domcontentloaded", timeout: 10_000 })

      let rendersWithoutCrash = false
      try {
        await page.waitForSelector("h1, h2, [class*='step'], [class*='title']", { timeout: 5_000 })
        rendersWithoutCrash = true
      } catch {
        rendersWithoutCrash = false
      }

      const headingTextPresent = await page.evaluate(() => {
        const headings = document.querySelectorAll("h1, h2, h3")
        return Array.from(headings).some((h) => h.textContent && h.textContent.trim().length > 0)
      })

      const stepIndicatorPresent = await page.evaluate(() => {
        return Array.from(document.querySelectorAll("div")).some((node) => {
          const children = Array.from(node.children)
          if (children.length < 3) {
            return false
          }

          return children.every((child) => {
            if (!(child instanceof HTMLDivElement)) {
              return false
            }

            const style = window.getComputedStyle(child)
            const width = Number.parseFloat(style.width)
            const height = Number.parseFloat(style.height)
            const borderRadius = Number.parseFloat(style.borderRadius)
            return width > 0 && width <= 24 && height > 0 && height <= 12 && borderRadius >= 4
          })
        })
      })

      const detectLanguageOptions = () => page.evaluate(() => {
        const selects = document.querySelectorAll("select, [role='listbox'], [class*='language']")
        const radioButtons = document.querySelectorAll("input[type='radio']")
        return selects.length > 0 || radioButtons.length > 0
      })
      let languageOptionsPresent = await detectLanguageOptions()

      if (!languageOptionsPresent) {
        const getStartedButton = page.getByRole("button", { name: /get started/i })
        if (await getStartedButton.count() > 0) {
          await getStartedButton.click()
          try {
            await page.waitForSelector("select, input[type='radio']", { timeout: 5_000 })
          } catch {
            // Fall through to the post-click detection below.
          }
          languageOptionsPresent = await detectLanguageOptions()
        }
      }

      const screenshotPath = path.join(artifactDir, "onboarding-smoke.png")
      await page.screenshot({ path: screenshotPath, fullPage: true })

      const snapshotHtml = await page.content()
      const snapshotHtmlPath = path.join(artifactDir, "onboarding-smoke.snapshot.html")
      await writeFile(snapshotHtmlPath, snapshotHtml, "utf8")

      await sleep(500)

      runtime.attachArtifact("onboardingCapture", {
        rendersWithoutCrash,
        headingTextPresent,
        stepIndicatorPresent,
        languageOptionsPresent,
        screenshotPath,
        snapshotHtmlPath,
        consoleErrors,
      })
      runtime.complete("Onboarding smoke test completed.")
      const snapshot = runtime.snapshot()

      const onboarding = {
        rendersWithoutCrash,
        headingTextPresent,
        stepIndicatorPresent,
        languageOptionsPresent,
        consoleErrors,
      }

      return {
        status: snapshot.status,
        summary: rendersWithoutCrash
          ? `Onboarding page rendered. Heading: ${headingTextPresent}, Steps: ${stepIndicatorPresent}, Languages: ${languageOptionsPresent}.`
          : "Onboarding page failed to render.",
        notes: [
          `Renders without crash: ${rendersWithoutCrash}`,
          `Heading text present: ${headingTextPresent}`,
          `Step indicator present: ${stepIndicatorPresent}`,
          `Language options present: ${languageOptionsPresent}`,
          `Console errors: ${consoleErrors.length}`,
        ],
        artifacts: {
          browserExecutablePath: extCtx.browserExecutablePath,
          extensionPath: extCtx.extensionPath,
          screenshotPath,
          snapshotHtmlPath,
        },
        runtime: snapshot,
        startedAt: snapshot.startedAt,
        finishedAt: snapshot.finishedAt,
        onboarding,
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
          onboarding: {
            rendersWithoutCrash: false,
            headingTextPresent: false,
            stepIndicatorPresent: false,
            languageOptionsPresent: false,
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
          onboarding: {
            rendersWithoutCrash: false,
            headingTextPresent: false,
            stepIndicatorPresent: false,
            languageOptionsPresent: false,
            consoleErrors: [],
          },
        }
      }

      throw error
    } finally {
      await extCtx?.close()
    }
  },

  evaluate(execution, context) {
    const onboarding = execution.onboarding ?? {
      rendersWithoutCrash: false,
      headingTextPresent: false,
      stepIndicatorPresent: false,
      languageOptionsPresent: false,
      consoleErrors: [] as string[],
    }
    const issues: string[] = []
    const nextActions: string[] = []

    if (!onboarding.rendersWithoutCrash) {
      issues.push("Onboarding page did not render.")
      nextActions.push("Check OnboardingApp.tsx for runtime errors and content script injection issues.")
    }

    if (!onboarding.headingTextPresent) {
      issues.push("No heading text found on the onboarding page.")
      nextActions.push("Verify the onboarding page renders its heading component.")
    }

    if (!onboarding.stepIndicatorPresent) {
      issues.push("No step indicator found on the onboarding page.")
      nextActions.push("Verify the step/dot indicator component renders.")
    }

    if (!onboarding.languageOptionsPresent) {
      issues.push("No language selection options found on the onboarding page.")
      nextActions.push("Verify the language selection form controls render.")
    }

    if (onboarding.consoleErrors.length > 0) {
      issues.push(`${onboarding.consoleErrors.length} console error(s) during onboarding load.`)
      nextActions.push("Inspect console errors for initialization failures.")
    }

    const pass = onboarding.rendersWithoutCrash
      && onboarding.headingTextPresent
      && onboarding.stepIndicatorPresent
      && onboarding.languageOptionsPresent
      && onboarding.consoleErrors.length === 0

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
      score: pass ? 100 : onboarding.rendersWithoutCrash ? 50 : 0,
      summary: pass
        ? "Onboarding smoke test passed: page renders without errors, heading found."
        : "Onboarding smoke test failed: page did not render correctly.",
      issues,
      nextActions,
      notes: execution.notes ?? [],
      rubrics: [],
      artifacts: execution.artifacts ?? {},
      runtime: context.runtime,
    } as unknown as Partial<LiveEvaluationResult>
  },
}
