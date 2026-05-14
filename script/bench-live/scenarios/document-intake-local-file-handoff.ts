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
const DOCUMENT_FILE_HANDOFF_STORAGE_KEY = "astra.documentFileHandoffs.v1"

interface DocumentIntakeLocalFileHandoffExecution extends LiveScenarioExecution {
  localFileHandoff?: {
    pageLoaded: boolean
    intakeReadyVisible: boolean
    handoffUrlPresent: boolean
    readerOpened: boolean
    readerParsedFile: boolean
    manualReselectPromptAbsent: boolean
    handoffStoreEmpty: boolean
    ownedReadingHasSubtitle: boolean
    ownedReadingPayloadBytesAbsent: boolean
    boundaryCopyVisible: boolean
    consoleErrors: string[]
  }
}

export const documentIntakeLocalFileHandoffScenario: LiveScenarioDefinition<DocumentIntakeLocalFileHandoffExecution> = {
  id: "bench-live/document-intake-local-file-handoff",
  title: "Live Document Intake local file handoff proof",
  surface: "document-intake",
  fixture: "files:vtt-local-handoff",
  description: "Uploads a local VTT through Document Intake, verifies the one-shot token opens the subtitle reader without reselect, and confirms local bytes stay out of owned-reading continuity.",
  tags: ["playwright", "browser", "extension-loaded", "document-intake", "local-file-handoff", "subtitle-file"],
  async run(runtime, context) {
    runtime.start(context.id, context.title)
    runtime.log("Starting Document Intake local file handoff proof.")

    let extCtx: ExtensionBrowserContext | null = null

    try {
      const artifactDir = await prepareLiveArtifactDir(context.runId)
      const vttPath = path.join(artifactDir, "local-handoff-proof.vtt")
      await writeFile(vttPath, "WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nHello Astra handoff\n", "utf8")

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
      const boundaryCopyVisible = await extCtx.page.locator("text=File bytes stay local and are not synced").isVisible()

      await extCtx.page.setInputFiles('[data-testid="document-intake-file-input"]', vttPath)
      await extCtx.page.waitForSelector('[data-testid="document-intake-ready"]', { timeout: 12_000 })
      const intakeReadyVisible = await extCtx.page.locator('[data-testid="document-intake-ready"]', { hasText: "Short-lived local handoff ready" }).isVisible()

      await extCtx.page.waitForTimeout(1_000)
      const subtitleReaderPage = extCtx.context.pages().find((page) => page.url().includes("/subtitle-reader.html?")) ?? null
      const readerOpened = !!subtitleReaderPage
      const handoffUrlPresent = subtitleReaderPage?.url().includes("handoffToken=doc_") ?? false

      let readerParsedFile = false
      let manualReselectPromptAbsent = false
      if (subtitleReaderPage) {
        subtitleReaderPage.on("console", (msg) => {
          if (msg.type() === "error") consoleErrors.push(msg.text())
        })
        await subtitleReaderPage.waitForLoadState("domcontentloaded", { timeout: 12_000 }).catch(() => undefined)
        await subtitleReaderPage.waitForFunction(() => document.body.innerText.includes("Parsed 1 cues from VTT file"), undefined, { timeout: 12_000 })
        const text = await subtitleReaderPage.locator("body").innerText()
        readerParsedFile = text.includes("Parsed 1 cues from VTT file") && text.includes("local-handoff-proof.vtt")
        manualReselectPromptAbsent = !text.includes("Drop SRT, VTT, ASS") && !text.includes("click to choose a file")
      }

      const storageState = await extCtx.page.evaluate(async (keys) => {
        const extensionChrome = (globalThis as unknown as {
          chrome?: { storage?: { local?: { get: (keys: string[]) => Promise<Record<string, unknown>> } } }
        }).chrome
        if (!extensionChrome?.storage?.local) return {}
        return extensionChrome.storage.local.get(keys)
      }, [OWNED_READING_STORAGE_KEY, DOCUMENT_FILE_HANDOFF_STORAGE_KEY]) as Record<string, unknown>

      const handoffStore = storageState[DOCUMENT_FILE_HANDOFF_STORAGE_KEY] as Record<string, unknown> | undefined
      const handoffStoreEmpty = Object.keys(handoffStore ?? {}).length === 0
      const ownedReadingPayload = JSON.stringify(storageState[OWNED_READING_STORAGE_KEY] ?? {})
      const ownedReadingHasSubtitle = ownedReadingPayload.includes("subtitle-file") && ownedReadingPayload.includes("local-handoff-proof.vtt")
      const ownedReadingPayloadBytesAbsent = !ownedReadingPayload.includes("bytesBase64") && !ownedReadingPayload.includes("Hello Astra handoff")

      const screenshotPath = path.join(artifactDir, "document-intake-local-file-handoff.png")
      await extCtx.page.screenshot({ path: screenshotPath, fullPage: true })
      const snapshotPath = path.join(artifactDir, "document-intake-local-file-handoff.snapshot.html")
      await writeFile(snapshotPath, await extCtx.page.content(), "utf8")

      runtime.attachArtifact("documentIntakeLocalFileHandoff", {
        screenshotPath,
        snapshotPath,
        vttPath,
        subtitleReaderUrl: subtitleReaderPage?.url() ?? null,
        consoleErrors,
      })
      runtime.complete("Document Intake local file handoff proof completed.")
      const snapshot = runtime.snapshot()

      return {
        status: snapshot.status,
        summary: "Verified Document Intake created a one-shot local file handoff token and subtitle reader consumed it without manual reselect.",
        notes: [
          `Browser executable: ${extCtx.browserExecutablePath}`,
          `Subtitle reader URL carried token: ${handoffUrlPresent ? "yes" : "no"}`,
        ],
        artifacts: {
          screenshotPath,
          snapshotPath,
        },
        runtime: snapshot,
        startedAt: snapshot.startedAt,
        finishedAt: snapshot.finishedAt,
        localFileHandoff: {
          pageLoaded,
          intakeReadyVisible,
          handoffUrlPresent,
          readerOpened,
          readerParsedFile,
          manualReselectPromptAbsent,
          handoffStoreEmpty,
          ownedReadingHasSubtitle,
          ownedReadingPayloadBytesAbsent,
          boundaryCopyVisible,
          consoleErrors,
        },
      }
    } catch (error) {
      if (error instanceof LiveBrowserUnavailableError || error instanceof ExtensionBuildNotFoundError) {
        runtime.skip(error.message)
        const snapshot = runtime.snapshot()
        return {
          status: snapshot.status,
          summary: "Document Intake local file handoff proof skipped because the browser or extension build was unavailable.",
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
    const handoff = execution.localFileHandoff
    const issues: string[] = []
    if (!handoff?.pageLoaded) issues.push("Document Intake page did not load.")
    if (!handoff?.boundaryCopyVisible) issues.push("Local-only handoff boundary copy was not visible.")
    if (!handoff?.intakeReadyVisible) issues.push("Document Intake did not show local handoff ready state.")
    if (!handoff?.readerOpened) issues.push("Subtitle reader did not open from Document Intake.")
    if (!handoff?.handoffUrlPresent) issues.push("Reader URL did not carry a local file handoff token.")
    if (!handoff?.readerParsedFile) issues.push("Subtitle reader did not parse the handed-off local file.")
    if (!handoff?.manualReselectPromptAbsent) issues.push("Reader still showed immediate manual reselect prompt after successful handoff.")
    if (!handoff?.handoffStoreEmpty) issues.push("One-shot handoff store was not scrubbed after reader consume.")
    if (!handoff?.ownedReadingHasSubtitle) issues.push("Owned-reading continuity did not record the subtitle file metadata row.")
    if (!handoff?.ownedReadingPayloadBytesAbsent) issues.push("Owned-reading continuity payload appeared to contain local file bytes.")
    if ((handoff?.consoleErrors.length ?? 0) > 0) issues.push(`Console errors: ${handoff?.consoleErrors.join(" | ")}`)

    return {
      runId: context.runId,
      scenario: context.scenario,
      status: issues.length === 0 ? "pass" : "fail",
      pass: issues.length === 0,
      score: issues.length === 0 ? 100 : 0,
      summary: issues.length === 0
        ? "Document Intake local file handoff passed: one-shot token opened the reader, scrubbed bytes, and kept continuity metadata-only."
        : "Document Intake local file handoff failed one or more token/reader/boundary checks.",
      issues,
      nextActions: issues.length === 0 ? [] : ["Fix Document Intake local file handoff creation, reader consumption, or metadata-only boundary."],
      notes: execution.notes ?? [],
    }
  },
}
