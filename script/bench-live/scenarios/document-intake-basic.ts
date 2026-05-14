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

const OWNED_READING_STORAGE_KEY = "astra.owned_reading.v1"

interface DocumentIntakeBasicExecution extends LiveScenarioExecution {
  documentIntake?: {
    pageLoaded: boolean
    pdfReadyVisible: boolean
    subtitleReadyVisible: boolean
    honestLimitationVisible: boolean
    pdfReaderOpened: boolean
    subtitleReaderOpened: boolean
    queueOpened: boolean
    ownedReadingTypes: string[]
    ownedReadingTitles: string[]
    consoleErrors: string[]
  }
}

export const documentIntakeBasicScenario: LiveScenarioDefinition<DocumentIntakeBasicExecution> = {
  id: "bench-live/document-intake-basic",
  title: "Live Document Intake Hub basic handoff",
  surface: "document-intake",
  fixture: "files:pdf+vtt",
  description: "Opens the extension Document Intake Hub, uploads PDF and VTT files, verifies owned-reading queue continuity, and confirms existing reader handoff tabs.",
  tags: ["playwright", "browser", "extension-loaded", "document-intake", "reading-queue", "pdf", "subtitle-file"],
  async run(runtime, context) {
    runtime.start(context.id, context.title)
    runtime.log("Starting Document Intake Hub live scenario.")

    let extCtx: ExtensionBrowserContext | null = null

    try {
      const artifactDir = await prepareLiveArtifactDir(context.runId)
      const pdfPath = path.join(artifactDir, "intake-proof.pdf")
      const vttPath = path.join(artifactDir, "intake-proof.vtt")
      await writeFile(pdfPath, "%PDF-1.4\n% Astra intake proof placeholder\n", "utf8")
      await writeFile(vttPath, "WEBVTT\n\n00:00.000 --> 00:01.000\nHello Astra intake\n", "utf8")

      extCtx = await withExtensionBrowserPage({
        initialUrl: "about:blank",
        waitForExtensionInject: 0,
      })

      const consoleErrors: string[] = []
      extCtx.page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text())
      })

      await extCtx.page.goto(`chrome-extension://${extCtx.extensionId}/document-intake.html`, {
        waitUntil: "domcontentloaded",
        timeout: 20_000,
      })
      await extCtx.page.waitForSelector('[data-testid="document-intake-page"]', { timeout: 12_000 })
      const pageLoaded = await extCtx.page.locator("text=Unified Document Intake Hub v1").isVisible()
      const honestLimitationVisible = await extCtx.page.locator("text=Local-file limitation:").isVisible()

      await extCtx.page.setInputFiles('[data-testid="document-intake-file-input"]', pdfPath)
      await extCtx.page.waitForSelector('[data-testid="document-intake-ready"]', { timeout: 12_000 })
      const pdfReadyVisible = await extCtx.page.locator('[data-testid="document-intake-ready"]', { hasText: "intake-proof.pdf" }).isVisible()
      const pdfReaderOpened = extCtx.context.pages().some((page) => page.url().includes("/pdf-reader.html?reopenHint="))

      await extCtx.page.setInputFiles('[data-testid="document-intake-file-input"]', vttPath)
      await extCtx.page.waitForFunction(() => document.body.innerText.includes("intake-proof.vtt"), undefined, { timeout: 12_000 })
      const subtitleReadyVisible = await extCtx.page.locator('[data-testid="document-intake-ready"]', { hasText: "VTT" }).isVisible()
      const subtitleReaderOpened = extCtx.context.pages().some((page) => page.url().includes("/subtitle-reader.html?reopenHint="))

      await extCtx.page.getByRole("button", { name: "Open reading queue" }).click()
      await extCtx.page.waitForTimeout(800)
      const queueOpened = extCtx.context.pages().some((page) => page.url().includes("/vocabulary.html?tab=reading"))

      const ownedReading = await extCtx.page.evaluate(async (storageKey) => {
        const extensionChrome = (globalThis as unknown as {
          chrome?: { storage?: { local?: { get: (key: string) => Promise<Record<string, unknown>> } } }
        }).chrome
        if (!extensionChrome?.storage?.local) return { items: [] }
        const raw = await extensionChrome.storage.local.get(storageKey)
        return raw[storageKey] as { items?: Array<{ sourceType?: string; title?: string }> } | undefined ?? { items: [] }
      }, OWNED_READING_STORAGE_KEY)
      const ownedReadingItems = ownedReading.items ?? []
      const ownedReadingTypes = ownedReadingItems.map((item) => item.sourceType ?? "")
      const ownedReadingTitles = ownedReadingItems.map((item) => item.title ?? "")

      const screenshotPath = path.join(artifactDir, "document-intake-basic.png")
      await extCtx.page.screenshot({ path: screenshotPath, fullPage: true })
      const snapshotPath = path.join(artifactDir, "document-intake-basic.snapshot.html")
      await writeFile(snapshotPath, await extCtx.page.content(), "utf8")

      runtime.attachArtifact("documentIntake", {
        screenshotPath,
        snapshotPath,
        pdfPath,
        vttPath,
        ownedReadingTypes,
        ownedReadingTitles,
        consoleErrors,
      })
      runtime.complete("Document Intake Hub live scenario completed.")
      const snapshot = runtime.snapshot()

      return {
        status: snapshot.status,
        summary: "Uploaded PDF and VTT files into Document Intake, confirmed reader handoff and Reading queue continuity.",
        notes: [
          `Browser executable: ${extCtx.browserExecutablePath}`,
          `Owned reading types: ${ownedReadingTypes.join(", ")}`,
        ],
        artifacts: {
          screenshotPath,
          snapshotPath,
        },
        runtime: snapshot,
        startedAt: snapshot.startedAt,
        finishedAt: snapshot.finishedAt,
        documentIntake: {
          pageLoaded,
          pdfReadyVisible,
          subtitleReadyVisible,
          honestLimitationVisible,
          pdfReaderOpened,
          subtitleReaderOpened,
          queueOpened,
          ownedReadingTypes,
          ownedReadingTitles,
          consoleErrors,
        },
      }
    } catch (error) {
      if (error instanceof LiveBrowserUnavailableError || error instanceof ExtensionBuildNotFoundError) {
        runtime.skip(error.message)
        const snapshot = runtime.snapshot()
        return {
          status: snapshot.status,
          summary: "Document Intake Hub live scenario skipped because the browser or extension build was unavailable.",
          notes: [error.message],
          runtime: snapshot,
          startedAt: snapshot.startedAt,
          finishedAt: snapshot.finishedAt,
        }
      }
      throw error
    } finally {
      await extCtx?.close()
    }
  },
  evaluate(execution, context): Partial<LiveEvaluationResult> {
    const intake = execution.documentIntake
    const issues: string[] = []
    if (!intake?.pageLoaded) issues.push("Document Intake page did not load.")
    if (!intake?.pdfReadyVisible) issues.push("PDF intake did not show a ready state.")
    if (!intake?.subtitleReadyVisible) issues.push("VTT subtitle intake did not show a ready state.")
    if (!intake?.honestLimitationVisible) issues.push("Local-file reopen limitation copy was not visible.")
    if (!intake?.pdfReaderOpened) issues.push("PDF intake did not open the existing PDF reader handoff.")
    if (!intake?.subtitleReaderOpened) issues.push("VTT intake did not open the existing subtitle reader handoff.")
    if (!intake?.queueOpened) issues.push("Reading queue confirmation did not open Vocabulary Reading tab.")
    if (intake?.ownedReadingTypes.includes("pdf") !== true) issues.push("Owned-reading store did not contain a PDF row.")
    if (intake?.ownedReadingTypes.includes("subtitle-file") !== true) issues.push("Owned-reading store did not contain a subtitle-file row.")
    if (intake?.ownedReadingTitles.some((title) => title.includes("intake-proof.pdf")) !== true) issues.push("PDF owned-reading title was missing.")
    if (intake?.ownedReadingTitles.some((title) => title.includes("intake-proof.vtt")) !== true) issues.push("VTT owned-reading title was missing.")
    if ((intake?.consoleErrors.length ?? 0) > 0) issues.push(`Console errors: ${intake?.consoleErrors.join(" | ")}`)

    return {
      runId: context.runId,
      scenario: context.scenario,
      status: issues.length === 0 ? "pass" : "fail",
      pass: issues.length === 0,
      score: issues.length === 0 ? 100 : 0,
      summary: issues.length === 0
        ? "Document Intake Hub proved PDF and VTT entry, existing reader handoff, honest local-file limitation copy, and Reading queue continuity."
        : "Document Intake Hub live proof failed one or more handoff/continuity checks.",
      issues,
      nextActions: issues.length === 0 ? [] : ["Fix Document Intake Hub handoff or owned-reading continuity regression."],
      notes: execution.notes ?? [],
    }
  },
}
