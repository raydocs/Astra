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

async function waitForReaderTab(extCtx: ExtensionBrowserContext, readerPath: string): Promise<boolean> {
  const deadline = Date.now() + 5_000
  while (Date.now() < deadline) {
    if (extCtx.context.pages().some((page) => page.url().includes(`${readerPath}?reopenHint=`))) {
      return true
    }
    await extCtx.page.waitForTimeout(100)
  }
  return extCtx.context.pages().some((page) => page.url().includes(`${readerPath}?reopenHint=`))
}

interface DocumentIntakeBasicExecution extends LiveScenarioExecution {
  documentIntake?: {
    pageLoaded: boolean
    pdfReadyVisible: boolean
    epubReadyVisible: boolean
    subtitleReadyVisible: boolean
    honestLimitationVisible: boolean
    unsupportedErrorVisible: boolean
    pdfReaderOpened: boolean
    epubReaderOpened: boolean
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
  fixture: "files:pdf+epub+vtt+unsupported-docx",
  description: "Opens the extension Document Intake Hub, uploads PDF, EPUB, and VTT files, verifies owned-reading queue continuity, confirms existing reader handoff tabs, and checks unsupported-format boundary copy.",
  tags: ["playwright", "browser", "extension-loaded", "document-intake", "reading-queue", "pdf", "epub", "subtitle-file", "unsupported-format"],
  async run(runtime, context) {
    runtime.start(context.id, context.title)
    runtime.log("Starting Document Intake Hub live scenario.")

    let extCtx: ExtensionBrowserContext | null = null

    try {
      const artifactDir = await prepareLiveArtifactDir(context.runId)
      const pdfPath = path.join(artifactDir, "intake-proof.pdf")
      const epubPath = path.join(artifactDir, "intake-proof.epub")
      const vttPath = path.join(artifactDir, "intake-proof.vtt")
      const unsupportedPath = path.join(artifactDir, "intake-proof.docx")
      await writeFile(pdfPath, "%PDF-1.4\n% Astra intake proof placeholder\n", "utf8")
      await writeFile(epubPath, "PK\u0003\u0004\nAstra EPUB intake proof placeholder\n", "utf8")
      await writeFile(vttPath, "WEBVTT\n\n00:00.000 --> 00:01.000\nHello Astra intake\n", "utf8")
      await writeFile(unsupportedPath, "Astra unsupported document intake proof placeholder\n", "utf8")

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
      const pageLoaded = await extCtx.page.locator("text=Open a reading file").isVisible()
      const honestLimitationVisible = await extCtx.page.locator("text=Local file handoff:").isVisible()

      await extCtx.page.setInputFiles('[data-testid="document-intake-file-input"]', pdfPath)
      await extCtx.page.waitForSelector('[data-testid="document-intake-ready"]', { timeout: 12_000 })
      const pdfReadyVisible = await extCtx.page.locator('[data-testid="document-intake-ready"]', { hasText: "intake-proof.pdf" }).isVisible()
      const pdfReaderOpened = await waitForReaderTab(extCtx, "/pdf-reader.html")

      await extCtx.page.setInputFiles('[data-testid="document-intake-file-input"]', epubPath)
      await extCtx.page.waitForFunction(() => document.body.innerText.includes("intake-proof.epub"), undefined, { timeout: 12_000 })
      const epubReadyVisible = await extCtx.page.locator('[data-testid="document-intake-ready"]', { hasText: "EPUB" }).isVisible()
      const epubReaderOpened = await waitForReaderTab(extCtx, "/epub-reader.html")

      await extCtx.page.setInputFiles('[data-testid="document-intake-file-input"]', vttPath)
      await extCtx.page.waitForFunction(() => document.body.innerText.includes("intake-proof.vtt"), undefined, { timeout: 12_000 })
      const subtitleReadyVisible = await extCtx.page.locator('[data-testid="document-intake-ready"]', { hasText: "VTT" }).isVisible()
      const subtitleReaderOpened = await waitForReaderTab(extCtx, "/subtitle-reader.html")

      await extCtx.page.setInputFiles('[data-testid="document-intake-file-input"]', unsupportedPath)
      await extCtx.page.waitForSelector('[data-testid="document-intake-error"]', { timeout: 12_000 })
      const unsupportedErrorVisible = await extCtx.page.locator('[data-testid="document-intake-error"]', { hasText: "Unsupported file type for intake-proof.docx" }).isVisible()

      await extCtx.page.getByRole("button", { name: "Open reading queue" }).first().click()
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
        epubPath,
        vttPath,
        unsupportedPath,
        ownedReadingTypes,
        ownedReadingTitles,
        consoleErrors,
      })
      runtime.complete("Document Intake Hub live scenario completed.")
      const snapshot = runtime.snapshot()

      return {
        status: snapshot.status,
        summary: "Uploaded PDF, EPUB, and VTT files into Document Intake, confirmed reader handoff, unsupported-format boundary handling, and Reading queue continuity.",
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
          epubReadyVisible,
          subtitleReadyVisible,
          honestLimitationVisible,
          unsupportedErrorVisible,
          pdfReaderOpened,
          epubReaderOpened,
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
    if (!intake?.epubReadyVisible) issues.push("EPUB intake did not show a ready state.")
    if (!intake?.subtitleReadyVisible) issues.push("VTT subtitle intake did not show a ready state.")
    if (!intake?.honestLimitationVisible) issues.push("Local-file handoff boundary copy was not visible.")
    if (!intake?.unsupportedErrorVisible) issues.push("Unsupported-format boundary error was not visible for DOCX.")
    if (!intake?.pdfReaderOpened) issues.push("PDF intake did not open the existing PDF reader handoff.")
    if (!intake?.epubReaderOpened) issues.push("EPUB intake did not open the existing EPUB reader handoff.")
    if (!intake?.subtitleReaderOpened) issues.push("VTT intake did not open the existing subtitle reader handoff.")
    if (!intake?.queueOpened) issues.push("Reading queue confirmation did not open Vocabulary Reading tab.")
    if (intake?.ownedReadingTypes.includes("pdf") !== true) issues.push("Owned-reading store did not contain a PDF row.")
    if (intake?.ownedReadingTypes.includes("epub") !== true) issues.push("Owned-reading store did not contain an EPUB row.")
    if (intake?.ownedReadingTypes.includes("subtitle-file") !== true) issues.push("Owned-reading store did not contain a subtitle-file row.")
    if (intake?.ownedReadingTitles.some((title) => title.includes("intake-proof.pdf")) !== true) issues.push("PDF owned-reading title was missing.")
    if (intake?.ownedReadingTitles.some((title) => title.includes("intake-proof.epub")) !== true) issues.push("EPUB owned-reading title was missing.")
    if (intake?.ownedReadingTitles.some((title) => title.includes("intake-proof.vtt")) !== true) issues.push("VTT owned-reading title was missing.")
    if (intake?.ownedReadingTitles.some((title) => title.includes("intake-proof.docx")) === true) issues.push("Unsupported DOCX was written to owned-reading store.")
    if ((intake?.consoleErrors.length ?? 0) > 0) issues.push(`Console errors: ${intake?.consoleErrors.join(" | ")}`)

    return {
      runId: context.runId,
      scenario: context.scenario,
      status: issues.length === 0 ? "pass" : "fail",
      pass: issues.length === 0,
      score: issues.length === 0 ? 100 : 0,
      summary: issues.length === 0
        ? "Document Intake Hub proved PDF, EPUB, and VTT entry, existing reader handoff, unsupported-format boundary copy, honest local-file handoff copy, and Reading queue continuity."
        : "Document Intake Hub live proof failed one or more handoff/continuity checks.",
      issues,
      nextActions: issues.length === 0 ? [] : ["Fix Document Intake Hub handoff or owned-reading continuity regression."],
      notes: execution.notes ?? [],
    }
  },
}
