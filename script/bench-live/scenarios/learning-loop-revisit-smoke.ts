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
import { sleep } from "../sleep"
import type { LiveScenarioDefinition, LiveScenarioExecution, LiveScenarioMetadata, LiveEvaluationResult } from "../evaluator"
/** Mirror extension storage keys — do not import app modules here (they use `#imports`, unavailable in tsx bench). */
const VOCABULARY_STORAGE_KEY = "astra.vocabulary.v1"
const READING_HISTORY_STORAGE_KEY = "astra.reading_history.v1"
const STUDY_PROGRESS_STORAGE_KEY = "astra.study_progress.v1"
const OWNED_READING_STORAGE_KEY = "astra.owned_reading.v1"

function buildStudyProgressRecordIdForBench(url: string): string {
  const trimmed = url.trim()
  try {
    const parsed = new URL(trimmed)
    parsed.search = ""
    parsed.hash = ""
    return parsed.toString()
  } catch {
    return trimmed
  }
}

const FIXTURE_HTML = `<!doctype html><html><head><meta charset="utf-8"/><title>Revisit fixture</title></head><body><article><h1>Learning loop revisit fixture</h1><p>Fixture page for bench-live revisit smoke.</p></article></body></html>`

interface LearningLoopRevisitSmokeExecution extends LiveScenarioExecution {
  revisit: {
    fixtureOrigin: string
    vocabularyOpened: boolean
    readingTabOpened: boolean
    openButtonEnabled: boolean
    pageReviewButtonVisible: boolean
    pageReviewTabOpened: boolean
    pageReviewUrlHasStudyUrl: boolean
    pageReviewUrlHasEntryId: boolean
    learningDeskDeepReadNextStepVisible: boolean
    rowDeepReadNextStepButtonVisible: boolean
    deepReadNextStepTabOpened: boolean
    deepReadNextStepUrlHasPageUrl: boolean
    reviewCompletionResumeVisible: boolean
    reviewCompletionDeepReadReturnVisible: boolean
    reviewCompletionResumeOpenedFixture: boolean
    pageIdentityVisible: boolean
    translatedCountVisible: boolean
    studyLoopVisible: boolean
    nextStepVisible: boolean
    documentRowsVisible: boolean
    documentFormatBadgesVisible: boolean
    documentSavedContextVisible: boolean
    documentReviewButtonsVisible: boolean
    unavailableDocumentStateVisible: boolean
    epubResumeHandoffOpened: boolean
    newTabUrlMatchesFixture: boolean
    consoleErrors: string[]
  }
}

function startFixtureServer(): Promise<{ origin: string; close: () => Promise<void> }> {
  const server = createServer((req, res) => {
    if (req.url === "/" || req.url?.startsWith("/learning-loop-revisit")) {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" })
      res.end(FIXTURE_HTML)
      return
    }
    if (req.url === "/favicon.ico") {
      res.writeHead(204, { "cache-control": "no-store" })
      res.end()
      return
    }
    res.writeHead(404, { "content-type": "text/plain" })
    res.end("not found")
  })

  return new Promise((resolve, reject) => {
    server.once("error", reject)
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address()
      if (!addr || typeof addr === "string") {
        reject(new Error("Fixture server did not bind to a port."))
        return
      }
      const origin = `http://127.0.0.1:${addr.port}`
      resolve({
        origin,
        close: () => new Promise((res, rej) => {
          server.close((err) => (err ? rej(err) : res()))
        }),
      })
    })
  })
}

export const learningLoopRevisitSmokeScenario: LiveScenarioDefinition<LearningLoopRevisitSmokeExecution> = {
  id: "bench-live/learning-loop-revisit-smoke",
  title: "Live learning-loop revisit smoke",
  surface: "vocabulary",
  fixture: "page:none",
  description:
    "Serves a minimal article page, seeds vocabulary + reading history + study progress, opens vocabulary Reading tab, and verifies Resume launches the same origin in a new tab (Month 3 queue/revisit v1).",
  tags: ["playwright", "vocabulary", "reading-queue", "revisit", "extension-loaded", "smoke"],
  async run(runtime, context) {
    runtime.start(context.id, context.title)

    const fixtureServer = await startFixtureServer()
    const fixtureUrl = `${fixtureServer.origin}/learning-loop-revisit-fixture/index.html`
    const nextStepFixtureUrl = `${fixtureServer.origin}/learning-loop-next-step-fixture/index.html`
    const recordId = buildStudyProgressRecordIdForBench(fixtureUrl)
    const nextStepRecordId = buildStudyProgressRecordIdForBench(nextStepFixtureUrl)
    const FIXTURE_TITLE = "Learning loop revisit fixture"
    const NEXT_STEP_FIXTURE_TITLE = "Learning loop next-step fixture"
    const REMOTE_PDF_URL = `${fixtureServer.origin}/learning-loop-revisit-fixture/bench.pdf`
    const EPUB_LOCAL_URI = "astra-local://epub/bench-book.epub"
    const SUBTITLE_LOCAL_URI = "astra-local://subtitle/bench.srt"

    runtime.log("Starting learning-loop revisit smoke.", { fixtureUrl, recordId, nextStepFixtureUrl, nextStepRecordId })

    const artifactDir = await prepareLiveArtifactDir(context.runId)

    let extCtx: ExtensionBrowserContext | null = null

    const vocabularySeed = [
      {
        id: "bench-revisit-vocab-1",
        text: "fixture-word",
        url: fixtureUrl,
        hostname: "127.0.0.1",
        savedAt: Date.now(),
        srsBox: 1,
        nextReviewAt: Date.now(),
        reviewCount: 0,
        lastReviewedAt: null,
        sourceContext: {
          surface: "popup_deep_read" as const,
          pageTitle: FIXTURE_TITLE,
          pageUrl: fixtureUrl,
          hostname: "127.0.0.1",
          sentenceText: "fixture-word",
          sentenceIndex: 0,
          ownedReadingSourceType: "article" as const,
          studyProgressRecordId: recordId,
        },
      },
      {
        id: "bench-revisit-pdf-vocab",
        text: "pdf-word",
        url: REMOTE_PDF_URL,
        hostname: "pdf-reader",
        savedAt: Date.now() - 1_000,
        srsBox: 1,
        nextReviewAt: Date.now() + 86_400_000,
        reviewCount: 0,
        lastReviewedAt: null,
        sourceContext: {
          surface: "popup_deep_read" as const,
          pageTitle: "Remote bench PDF",
          pageUrl: REMOTE_PDF_URL,
          hostname: "pdf-reader",
          sentenceText: "pdf-word",
          sentenceIndex: 0,
          ownedReadingItemId: "or_bench_pdf_fixture",
          ownedReadingSourceType: "pdf" as const,
          ownedReadingTitle: "Remote bench PDF",
          studyProgressRecordId: REMOTE_PDF_URL,
        },
      },
      {
        id: "bench-revisit-epub-vocab",
        text: "epub-word",
        url: EPUB_LOCAL_URI,
        hostname: "epub-reader",
        savedAt: Date.now() - 2_000,
        srsBox: 1,
        nextReviewAt: Date.now() + 86_400_000,
        reviewCount: 0,
        lastReviewedAt: null,
        sourceContext: {
          surface: "popup_deep_read" as const,
          pageTitle: "Bench Book",
          pageUrl: EPUB_LOCAL_URI,
          hostname: "epub-reader",
          sentenceText: "epub-word",
          sentenceIndex: 0,
          ownedReadingItemId: "or_bench_epub_fixture",
          ownedReadingSourceType: "epub" as const,
          ownedReadingTitle: "Bench Book (bench-book.epub)",
        },
      },
      {
        id: "bench-revisit-subtitle-vocab",
        text: "subtitle-word",
        url: SUBTITLE_LOCAL_URI,
        hostname: "subtitle-reader",
        savedAt: Date.now() - 3_000,
        srsBox: 1,
        nextReviewAt: Date.now() + 86_400_000,
        reviewCount: 0,
        lastReviewedAt: null,
        sourceContext: {
          surface: "subtitle_reader" as const,
          pageTitle: "bench.srt",
          pageUrl: SUBTITLE_LOCAL_URI,
          hostname: "subtitle-reader",
          sentenceText: "subtitle-word",
          sentenceIndex: 2,
          ownedReadingItemId: "or_bench_subtitle_fixture",
          ownedReadingSourceType: "subtitle-file" as const,
          ownedReadingTitle: "bench.srt · SRT · 4 items",
        },
      },
    ]

    const readingHistorySeed = [
      {
        id: recordId,
        url: fixtureUrl,
        hostname: "127.0.0.1",
        title: FIXTURE_TITLE,
        wordsTranslated: 12,
        visitedAt: Date.now() + 10_000,
      },
      {
        id: nextStepRecordId,
        url: nextStepFixtureUrl,
        hostname: "127.0.0.1",
        title: NEXT_STEP_FIXTURE_TITLE,
        wordsTranslated: 5,
        visitedAt: Date.now() - 10_000,
      },
    ]

    const studyProgressSeed = {
      pages: [
        {
          url: recordId,
          hostname: "127.0.0.1",
          title: FIXTURE_TITLE,
          completedSteps: ["read", "explain", "vocab_save"],
          sentencesExplained: 1,
          vocabSaved: 1,
          startedAt: Date.now() - 60_000,
          lastActivityAt: Date.now() + 10_000,
        },
        {
          url: nextStepRecordId,
          hostname: "127.0.0.1",
          title: NEXT_STEP_FIXTURE_TITLE,
          completedSteps: ["read", "guided_read", "explain"],
          sentencesExplained: 1,
          vocabSaved: 0,
          startedAt: Date.now() - 50_000,
          lastActivityAt: Date.now() - 10_000,
        },
      ],
      dailyStats: {
        date: new Date().toISOString().slice(0, 10),
        pagesStudied: 1,
        sentencesExplained: 1,
        vocabSaved: 1,
        vocabReviewed: 0,
      },
    }

    const ownedReadingSeed = {
      version: 1,
      items: [
        {
          id: "or_bench_revisit_fixture",
          sourceType: "article" as const,
          title: FIXTURE_TITLE,
          sourceUrl: recordId,
          openedAt: Date.now() + 10_000,
          status: "saved" as const,
          progress: {},
          readingHistoryRecordId: recordId,
          studyProgressRecordId: recordId,
        },
        {
          id: "or_bench_next_step_fixture",
          sourceType: "article" as const,
          title: NEXT_STEP_FIXTURE_TITLE,
          sourceUrl: nextStepRecordId,
          openedAt: Date.now() - 10_000,
          status: "in_progress" as const,
          progress: {},
          readingHistoryRecordId: nextStepRecordId,
          studyProgressRecordId: nextStepRecordId,
        },
        {
          id: "or_bench_pdf_fixture",
          sourceType: "pdf" as const,
          title: "Remote bench PDF",
          sourceUrl: REMOTE_PDF_URL,
          openedAt: Date.now() - 20_000,
          status: "saved" as const,
          progress: { fraction: 1 },
          readingHistoryRecordId: null,
          studyProgressRecordId: REMOTE_PDF_URL,
        },
        {
          id: "or_bench_epub_fixture",
          sourceType: "epub" as const,
          title: "Bench Book (bench-book.epub)",
          sourceUrl: null,
          localUri: EPUB_LOCAL_URI,
          reopenHint: "Choose the same file in the ePub reader: bench-book.epub",
          openedAt: Date.now() - 30_000,
          status: "saved" as const,
          progress: { chapterId: "chapter-1" },
          readingHistoryRecordId: null,
          studyProgressRecordId: null,
        },
        {
          id: "or_bench_subtitle_fixture",
          sourceType: "subtitle-file" as const,
          title: "bench.srt · SRT · 4 items",
          sourceUrl: null,
          localUri: SUBTITLE_LOCAL_URI,
          reopenHint: "Open the subtitle reader and choose the same file: bench.srt · continue from row 3",
          openedAt: Date.now() - 40_000,
          status: "saved" as const,
          progress: { sentenceIndex: 2 },
          readingHistoryRecordId: null,
          studyProgressRecordId: null,
        },
        {
          id: "or_bench_unavailable_pdf",
          sourceType: "pdf" as const,
          title: "Missing bench PDF context",
          sourceUrl: null,
          openedAt: Date.now() - 50_000,
          status: "saved" as const,
          progress: {},
          readingHistoryRecordId: null,
          studyProgressRecordId: null,
        },
      ],
    }

    try {
      extCtx = await withExtensionBrowserPage({
        initialUrl: "about:blank",
        waitForExtensionInject: 0,
        storageState: {
          [VOCABULARY_STORAGE_KEY]: vocabularySeed,
          [READING_HISTORY_STORAGE_KEY]: readingHistorySeed,
          [STUDY_PROGRESS_STORAGE_KEY]: studyProgressSeed,
          [OWNED_READING_STORAGE_KEY]: ownedReadingSeed,
        },
      })

      const consoleErrors: string[] = []
      extCtx.page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text())
      })

      const vocabularyUrl = `chrome-extension://${extCtx.extensionId}/vocabulary.html?tab=reading`
      await extCtx.page.goto(vocabularyUrl, { waitUntil: "domcontentloaded", timeout: 15_000 })

      await extCtx.page.waitForSelector("button", { timeout: 10_000 })

      const readingTabOpened = await extCtx.page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll("button"))
        return buttons.some((b) => (b.textContent ?? "").includes("Reading"))
      })

      const vocabularyOpened = await extCtx.page.evaluate(() => {
        const body = document.body.innerText
        return body.includes("Revisit reading items") || body.includes("Recent (")
      })

      const openButtonEnabled = await extCtx.page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll("button")).find(
          (b) => (b.textContent ?? "").trim() === "Resume",
        ) as HTMLButtonElement | undefined
        return !!btn && !btn.disabled
      })

      const revisitContextVisible = await extCtx.page.evaluate((expectedUrl) => {
        const body = document.body.innerText
        return {
          pageIdentityVisible: body.includes(`Page: ${expectedUrl}`) && body.includes("Host: 127.0.0.1"),
          translatedCountVisible: body.includes("Translated: 12 words translated"),
          studyLoopVisible: body.includes("Study loop: Read → Explain → Save words")
            && body.includes("Counts: 1 explained · 1 saved · 0 reviewed"),
          nextStepVisible: body.includes("Next: Review the saved card from this page to close the loop."),
        }
      }, fixtureUrl)

      const documentQueueState = await extCtx.page.evaluate(() => {
        const body = document.body.innerText
        return {
          documentRowsVisible: body.includes("Remote bench PDF")
            && body.includes("Bench Book (bench-book.epub)")
            && body.includes("bench.srt · SRT · 4 items"),
          documentFormatBadgesVisible: body.includes("PDF") && body.includes("EPUB") && body.includes("Subtitle"),
          documentSavedContextVisible: body.includes("Saved vocabulary: 1 card")
            && body.includes("Last chapter: chapter-1")
            && body.includes("Last row: 3"),
          documentReviewButtonsVisible: !!document.querySelector('[data-testid="reading-page-review-or_bench_pdf_fixture"]')
            && !!document.querySelector('[data-testid="reading-page-review-or_bench_epub_fixture"]')
            && !!document.querySelector('[data-testid="reading-page-review-or_bench_subtitle_fixture"]'),
          unavailableDocumentStateVisible: body.includes("Missing bench PDF context")
            && body.includes("Resume unavailable for this item."),
        }
      })

      const pageReviewButtonVisible = await extCtx.page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll("button")).find(
          (b) => (b.textContent ?? "").trim() === "Review saved sentences from this page",
        ) as HTMLButtonElement | undefined
        return !!btn && !btn.disabled
      })

      let epubResumeHandoffOpened = false
      const pagesBeforeEpubResume = extCtx.context.pages().length
      await extCtx.page.evaluate(() => {
        const btn = document.querySelector('[data-testid="reading-resume-or_bench_epub_fixture"]') as HTMLButtonElement | null
        btn?.click()
      })
      await sleep(800)
      epubResumeHandoffOpened = extCtx.context.pages().some((p, index) => index >= pagesBeforeEpubResume && p.url().includes("/epub-reader.html"))

      const rowDeepReadNextStepButtonVisible = await extCtx.page.evaluate(() => {
        const btn = document.querySelector('[data-testid="reading-deep-read-next-step-or_bench_next_step_fixture"]') as HTMLButtonElement | null
        return !!btn && !btn.disabled && (btn.textContent ?? "").trim() === "Continue next step in Deep Read"
      })

      const pagesBeforeDeepReadNextStep = extCtx.context.pages().length
      await extCtx.page.evaluate(() => {
        const btn = document.querySelector('[data-testid="reading-deep-read-next-step-or_bench_next_step_fixture"]') as HTMLButtonElement | null
        btn?.click()
      })
      await sleep(800)
      const pagesAfterDeepReadNextStep = extCtx.context.pages()
      const deepReadNextStepTab = pagesAfterDeepReadNextStep.find((p, index) => {
        const url = p.url()
        return index >= pagesBeforeDeepReadNextStep && url.startsWith("chrome-extension://") && url.includes("/deep-read.html?")
      })
      const deepReadNextStepUrl = deepReadNextStepTab?.url() ?? ""
      const deepReadNextStepTabOpened = !!deepReadNextStepTab
      const deepReadNextStepUrlHasPageUrl = deepReadNextStepUrl.includes(`pageUrl=${encodeURIComponent(nextStepFixtureUrl)}`)

      const learningDeskPage = await extCtx.context.newPage()
      await learningDeskPage.goto(`chrome-extension://${extCtx.extensionId}/vocabulary.html`, { waitUntil: "domcontentloaded", timeout: 15_000 })
      await learningDeskPage.waitForSelector("button", { timeout: 10_000 })
      const learningDeskDeepReadNextStepVisible = await learningDeskPage.evaluate(() => {
        const cta = document.querySelector('[data-testid="learning-desk-deep-read-next-step-cta"]')
        const btn = cta?.querySelector("button") as HTMLButtonElement | null
        return !!btn && !btn.disabled && (btn.textContent ?? "").trim() === "Continue next step in Deep Read"
      })
      await learningDeskPage.close().catch(() => undefined)

      await extCtx.page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll("button")).find(
          (b) => (b.textContent ?? "").trim() === "Review saved sentences from this page",
        ) as HTMLButtonElement | undefined
        btn?.click()
      })
      await sleep(800)
      const pageReviewTab = extCtx.context.pages().find((p) => {
        const url = p.url()
        return url.startsWith("chrome-extension://") && url.includes("/vocabulary.html?") && url.includes("loop=page")
      })
      const pageReviewUrl = pageReviewTab?.url() ?? ""
      const pageReviewTabOpened = !!pageReviewTab
      const pageReviewUrlHasStudyUrl = pageReviewUrl.includes(`studyUrl=${encodeURIComponent(recordId)}`)
      const pageReviewUrlHasEntryId = pageReviewUrl.includes("entryId=bench-revisit-vocab-1")

      let reviewCompletionResumeVisible = false
      let reviewCompletionDeepReadReturnVisible = false
      let reviewCompletionResumeOpenedFixture = false
      if (pageReviewTab) {
        await pageReviewTab.waitForLoadState("domcontentloaded", { timeout: 10_000 }).catch(() => undefined)
        await pageReviewTab.waitForSelector("[role='button']", { timeout: 10_000 })
        await pageReviewTab.evaluate(() => {
          const card = document.querySelector('[role="button"]') as HTMLElement | null
          card?.click()
        })
        await sleep(200)
        await pageReviewTab.locator('button[data-review-grade="good"]').click({ timeout: 10_000 })
        await pageReviewTab.waitForFunction(() => document.body.innerText.includes("Page review complete"), null, { timeout: 10_000 }).catch(() => undefined)
        const completionState = await pageReviewTab.evaluate(() => {
          const body = document.body.innerText
          return {
            resumeVisible: body.includes("Resume reading this page"),
            deepReadReturnVisible: body.includes("Return to this sentence in Deep Read"),
          }
        })
        reviewCompletionResumeVisible = completionState.resumeVisible
        reviewCompletionDeepReadReturnVisible = completionState.deepReadReturnVisible

        const pagesBeforeCompletionResume = extCtx.context.pages().length
        await pageReviewTab.evaluate(() => {
          const btn = Array.from(document.querySelectorAll("button")).find(
            (b) => (b.textContent ?? "").trim() === "Resume reading this page",
          ) as HTMLButtonElement | undefined
          btn?.click()
        })
        await sleep(800)
        const completionResumePage = extCtx.context.pages().find((p, index) => index >= pagesBeforeCompletionResume && p.url().startsWith(`${fixtureServer.origin}/`))
        reviewCompletionResumeOpenedFixture = !!completionResumePage
      }

      const pagesBefore = extCtx.context.pages().length
      await extCtx.page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll("button")).find(
          (b) => (b.textContent ?? "").trim() === "Resume",
        ) as HTMLButtonElement | undefined
        btn?.click()
      })

      await sleep(800)
      const pagesAfter = extCtx.context.pages()
      const newPage = pagesAfter.find((p, index) => index >= pagesBefore && !p.url().startsWith("chrome-extension://"))
      const newTabUrlMatchesFixture = newPage
        ? newPage.url().startsWith(`${fixtureServer.origin}/`)
        : false

      const screenshotPath = path.join(artifactDir, "learning-loop-revisit-smoke.png")
      await extCtx.page.screenshot({ path: screenshotPath, fullPage: true })
      const snapshotPath = path.join(artifactDir, "learning-loop-revisit-smoke.snapshot.html")
      await writeFile(snapshotPath, await extCtx.page.content(), "utf8")

      runtime.attachArtifact("revisitSmoke", {
        screenshotPath,
        snapshotPath,
        consoleErrors,
        fixtureUrl,
      })
      runtime.complete("Learning-loop revisit smoke finished.")

      const snapshot = runtime.snapshot()
      const revisit = {
        fixtureOrigin: fixtureServer.origin,
        vocabularyOpened,
        readingTabOpened,
        openButtonEnabled,
        pageReviewButtonVisible,
        pageReviewTabOpened,
        pageReviewUrlHasStudyUrl,
        pageReviewUrlHasEntryId,
        learningDeskDeepReadNextStepVisible,
        rowDeepReadNextStepButtonVisible,
        deepReadNextStepTabOpened,
        deepReadNextStepUrlHasPageUrl,
        reviewCompletionResumeVisible,
        reviewCompletionDeepReadReturnVisible,
        reviewCompletionResumeOpenedFixture,
        pageIdentityVisible: revisitContextVisible.pageIdentityVisible,
        translatedCountVisible: revisitContextVisible.translatedCountVisible,
        studyLoopVisible: revisitContextVisible.studyLoopVisible,
        nextStepVisible: revisitContextVisible.nextStepVisible,
        documentRowsVisible: documentQueueState.documentRowsVisible,
        documentFormatBadgesVisible: documentQueueState.documentFormatBadgesVisible,
        documentSavedContextVisible: documentQueueState.documentSavedContextVisible,
        documentReviewButtonsVisible: documentQueueState.documentReviewButtonsVisible,
        unavailableDocumentStateVisible: documentQueueState.unavailableDocumentStateVisible,
        epubResumeHandoffOpened,
        newTabUrlMatchesFixture,
        consoleErrors,
      }

      return {
        status: snapshot.status,
        summary: newTabUrlMatchesFixture
          ? "Revisit smoke: Resume from Reading queue launched fixture URL."
          : "Revisit smoke: could not confirm resume navigated to fixture origin.",
        notes: [
          `fixtureOrigin=${fixtureServer.origin}`,
          `vocabularyOpened=${vocabularyOpened}`,
          `readingTabOpened=${readingTabOpened}`,
          `openButtonEnabled=${openButtonEnabled}`,
          `pageReviewButtonVisible=${pageReviewButtonVisible}`,
          `pageReviewTabOpened=${pageReviewTabOpened}`,
          `pageReviewUrlHasStudyUrl=${pageReviewUrlHasStudyUrl}`,
          `pageReviewUrlHasEntryId=${pageReviewUrlHasEntryId}`,
          `learningDeskDeepReadNextStepVisible=${learningDeskDeepReadNextStepVisible}`,
          `rowDeepReadNextStepButtonVisible=${rowDeepReadNextStepButtonVisible}`,
          `deepReadNextStepTabOpened=${deepReadNextStepTabOpened}`,
          `deepReadNextStepUrlHasPageUrl=${deepReadNextStepUrlHasPageUrl}`,
          `deepReadNextStepUrl=${deepReadNextStepUrl || "none"}`,
          `reviewCompletionResumeVisible=${reviewCompletionResumeVisible}`,
          `reviewCompletionDeepReadReturnVisible=${reviewCompletionDeepReadReturnVisible}`,
          `reviewCompletionResumeOpenedFixture=${reviewCompletionResumeOpenedFixture}`,
          `pageReviewUrl=${pageReviewUrl || "none"}`,
          `pageIdentityVisible=${revisitContextVisible.pageIdentityVisible}`,
          `translatedCountVisible=${revisitContextVisible.translatedCountVisible}`,
          `studyLoopVisible=${revisitContextVisible.studyLoopVisible}`,
          `nextStepVisible=${revisitContextVisible.nextStepVisible}`,
          `documentRowsVisible=${documentQueueState.documentRowsVisible}`,
          `documentFormatBadgesVisible=${documentQueueState.documentFormatBadgesVisible}`,
          `documentSavedContextVisible=${documentQueueState.documentSavedContextVisible}`,
          `documentReviewButtonsVisible=${documentQueueState.documentReviewButtonsVisible}`,
          `unavailableDocumentStateVisible=${documentQueueState.unavailableDocumentStateVisible}`,
          `epubResumeHandoffOpened=${epubResumeHandoffOpened}`,
          `newTabUrlMatchesFixture=${newTabUrlMatchesFixture}`,
          `newTabUrl=${newPage?.url() ?? "none"}`,
          `tabsBefore=${pagesBefore} tabsAfter=${pagesAfter.length}`,
        ],
        artifacts: {
          browserExecutablePath: extCtx.browserExecutablePath,
          extensionPath: extCtx.extensionPath,
          screenshotPath,
          snapshotPath,
        },
        runtime: snapshot,
        startedAt: snapshot.startedAt,
        finishedAt: snapshot.finishedAt,
        revisit,
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
          revisit: {
            fixtureOrigin: fixtureServer.origin,
            vocabularyOpened: false,
            readingTabOpened: false,
            openButtonEnabled: false,
            pageReviewButtonVisible: false,
            pageReviewTabOpened: false,
            pageReviewUrlHasStudyUrl: false,
            pageReviewUrlHasEntryId: false,
            learningDeskDeepReadNextStepVisible: false,
            rowDeepReadNextStepButtonVisible: false,
            deepReadNextStepTabOpened: false,
            deepReadNextStepUrlHasPageUrl: false,
            reviewCompletionResumeVisible: false,
            reviewCompletionDeepReadReturnVisible: false,
            reviewCompletionResumeOpenedFixture: false,
            pageIdentityVisible: false,
            translatedCountVisible: false,
            studyLoopVisible: false,
            nextStepVisible: false,
            documentRowsVisible: false,
            documentFormatBadgesVisible: false,
            documentSavedContextVisible: false,
            documentReviewButtonsVisible: false,
            unavailableDocumentStateVisible: false,
            epubResumeHandoffOpened: false,
            newTabUrlMatchesFixture: false,
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
          revisit: {
            fixtureOrigin: fixtureServer.origin,
            vocabularyOpened: false,
            readingTabOpened: false,
            openButtonEnabled: false,
            pageReviewButtonVisible: false,
            pageReviewTabOpened: false,
            pageReviewUrlHasStudyUrl: false,
            pageReviewUrlHasEntryId: false,
            learningDeskDeepReadNextStepVisible: false,
            rowDeepReadNextStepButtonVisible: false,
            deepReadNextStepTabOpened: false,
            deepReadNextStepUrlHasPageUrl: false,
            reviewCompletionResumeVisible: false,
            reviewCompletionDeepReadReturnVisible: false,
            reviewCompletionResumeOpenedFixture: false,
            pageIdentityVisible: false,
            translatedCountVisible: false,
            studyLoopVisible: false,
            nextStepVisible: false,
            documentRowsVisible: false,
            documentFormatBadgesVisible: false,
            documentSavedContextVisible: false,
            documentReviewButtonsVisible: false,
            unavailableDocumentStateVisible: false,
            epubResumeHandoffOpened: false,
            newTabUrlMatchesFixture: false,
            consoleErrors: [],
          },
        }
      }

      throw error
    } finally {
      await extCtx?.close()
      await fixtureServer.close().catch(() => undefined)
    }
  },

  evaluate(execution, context) {
    const revisit = execution.revisit ?? {
      fixtureOrigin: "",
      vocabularyOpened: false,
      readingTabOpened: false,
      openButtonEnabled: false,
      pageReviewButtonVisible: false,
      pageReviewTabOpened: false,
      pageReviewUrlHasStudyUrl: false,
      pageReviewUrlHasEntryId: false,
      learningDeskDeepReadNextStepVisible: false,
      rowDeepReadNextStepButtonVisible: false,
      deepReadNextStepTabOpened: false,
      deepReadNextStepUrlHasPageUrl: false,
      reviewCompletionResumeVisible: false,
      reviewCompletionDeepReadReturnVisible: false,
      reviewCompletionResumeOpenedFixture: false,
      pageIdentityVisible: false,
      translatedCountVisible: false,
      studyLoopVisible: false,
      nextStepVisible: false,
      documentRowsVisible: false,
      documentFormatBadgesVisible: false,
      documentSavedContextVisible: false,
      documentReviewButtonsVisible: false,
      unavailableDocumentStateVisible: false,
      epubResumeHandoffOpened: false,
      newTabUrlMatchesFixture: false,
      consoleErrors: [] as string[],
    }

    const issues: string[] = []
    const nextActions: string[] = []

    if (!revisit.vocabularyOpened) {
      issues.push("Vocabulary / reading UI did not appear to load.")
      nextActions.push("Check vocabulary.html bootstrap and VocabularyApp tab rendering.")
    }
    if (!revisit.readingTabOpened) {
      issues.push("Reading tab was not found in the vocabulary shell.")
      nextActions.push("Verify VocabularyApp exposes a Reading tab button.")
    }
    if (!revisit.openButtonEnabled) {
      issues.push("Resume button was missing or disabled on the reading queue.")
      nextActions.push("Check owned-reading sync from reading history and article resume preconditions.")
    }
    if (!revisit.pageIdentityVisible || !revisit.translatedCountVisible || !revisit.studyLoopVisible || !revisit.nextStepVisible) {
      issues.push("Revisit row did not show the expected source/progress summary.")
      nextActions.push("Verify Vocabulary Reading rows render page identity, translated count, ordered study steps, counts, and the next-step hint.")
    }
    if (!revisit.pageReviewButtonVisible || !revisit.pageReviewTabOpened || !revisit.pageReviewUrlHasStudyUrl || !revisit.pageReviewUrlHasEntryId) {
      issues.push("Reading queue page-review handoff did not open the expected page-loop review URL.")
      nextActions.push("Verify VocabularyApp renders the page-review CTA only for matching saved page vocabulary and calls openPageReviewLoop with studyUrl + entryId.")
    }
    if (!revisit.learningDeskDeepReadNextStepVisible || !revisit.rowDeepReadNextStepButtonVisible || !revisit.deepReadNextStepTabOpened || !revisit.deepReadNextStepUrlHasPageUrl) {
      issues.push("Vocabulary Deep Read next-step handoff did not expose or open the expected page-specific Deep Read URL.")
      nextActions.push("Verify Vocabulary Learning Desk and Reading rows render Deep Read CTAs for guided_read/explain/vocab_save and call the shared deep-read page linker.")
    }
    if (!revisit.reviewCompletionResumeVisible || !revisit.reviewCompletionDeepReadReturnVisible || !revisit.reviewCompletionResumeOpenedFixture) {
      issues.push("ReviewMode page-loop completion did not expose both return CTAs or resume the owned reading page.")
      nextActions.push("Verify ReviewMode keeps the Deep Read sentence return and reuses owned-reading resume target/event behavior on page-loop completion.")
    }
    if (!revisit.documentRowsVisible || !revisit.documentFormatBadgesVisible || !revisit.documentSavedContextVisible || !revisit.documentReviewButtonsVisible) {
      issues.push("Document queue rows did not expose the unified format badge, saved-card context, and review action contract.")
      nextActions.push("Verify VocabularyApp builds Reading rows through the shared row model for PDF, EPUB, and subtitle-file owned-reading entries.")
    }
    if (!revisit.unavailableDocumentStateVisible || !revisit.epubResumeHandoffOpened) {
      issues.push("Document reopen behavior did not show both honest unavailable state and local reader handoff.")
      nextActions.push("Verify owned-reading resume targets return null for rows without reopen context and reader-handoff URLs for local documents.")
    }
    if (!revisit.newTabUrlMatchesFixture) {
      issues.push("New tab did not navigate to the expected fixture origin.")
      nextActions.push("Verify browser.tabs.create receives the reading history URL.")
    }
    if (revisit.consoleErrors.length > 0) {
      issues.push(`${revisit.consoleErrors.length} console error(s) captured.`)
    }

    const pass = revisit.openButtonEnabled
      && revisit.pageReviewButtonVisible
      && revisit.pageReviewTabOpened
      && revisit.pageReviewUrlHasStudyUrl
      && revisit.pageReviewUrlHasEntryId
      && revisit.learningDeskDeepReadNextStepVisible
      && revisit.rowDeepReadNextStepButtonVisible
      && revisit.deepReadNextStepTabOpened
      && revisit.deepReadNextStepUrlHasPageUrl
      && revisit.reviewCompletionResumeVisible
      && revisit.reviewCompletionDeepReadReturnVisible
      && revisit.reviewCompletionResumeOpenedFixture
      && revisit.documentRowsVisible
      && revisit.documentFormatBadgesVisible
      && revisit.documentSavedContextVisible
      && revisit.documentReviewButtonsVisible
      && revisit.unavailableDocumentStateVisible
      && revisit.epubResumeHandoffOpened
      && revisit.pageIdentityVisible
      && revisit.translatedCountVisible
      && revisit.studyLoopVisible
      && revisit.nextStepVisible
      && revisit.newTabUrlMatchesFixture
      && revisit.consoleErrors.length === 0

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
        ? "Revisit smoke passed: unified Reading queue rows cover article/document review, Deep Read next-step, completion resume, local handoff, and queue Resume URLs."
        : "Revisit smoke failed: reading queue review/resume/document path incomplete.",
      issues,
      nextActions,
      notes: execution.notes ?? [],
      rubrics: [],
      artifacts: execution.artifacts ?? {},
      runtime: context.runtime,
    } as unknown as Partial<LiveEvaluationResult>
  },
}
