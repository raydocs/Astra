import { JSDOM } from "jsdom"

import { installBenchBrowser, type TranslateCallRecord } from "../../runtime/browser"
import type { EpubTranslationExecution } from "../../evaluators/epub"

export type EpubReaderMode = "bilingual" | "translation-only"

export interface EpubReaderChapter {
  title: string
  paragraphs: string[]
}

export interface EpubReaderFixtureDefinition {
  name: string
  bookTitle: string
  chapters: EpubReaderChapter[]
  activeChapterIndex: number
  resumeChapterIndex: number
  notes?: string[]
}

export interface EpubReaderModeSummary {
  mode: EpubReaderMode
  chapterCount: number
  sectionCount: number
  sourceCount: number
  translationCount: number
  chapterTitles: string[]
  sourceTexts: string[]
  translationTexts: string[]
}

export interface EpubReaderSkeletonSummary {
  bookTitle: string
  activeChapterTitle: string
  resumedChapterTitle: string | null
  chapterTitles: string[]
  modes: EpubReaderModeSummary[]
}

export interface EpubReaderHarnessResult {
  execution: EpubTranslationExecution
  renderedHtml: string
  translateCalls: TranslateCallRecord[]
  summary: EpubReaderSkeletonSummary
}

export const EPUB_READER_FIRST_CUT_FIXTURE = "epub-reader-first-cut"
export const EPUB_READER_LONG_CHAPTER_FIXTURE = "epub-reader-long-chapter"

const EPUB_FIXTURES: Record<string, EpubReaderFixtureDefinition> = {
  [EPUB_READER_FIRST_CUT_FIXTURE]: {
    name: EPUB_READER_FIRST_CUT_FIXTURE,
    bookTitle: "Astra Reading Signals",
    activeChapterIndex: 1,
    resumeChapterIndex: 1,
    chapters: [
      {
        title: "Chapter 1 — Overview",
        paragraphs: [
          "Astra begins each reading session by capturing the local chapter context before any translation work starts.",
          "Readers can switch between bilingual and translation-only layouts without losing the surrounding chapter frame.",
        ],
      },
      {
        title: "Chapter 2 — Signals",
        paragraphs: [
          "Capability scorecards should expose whether a chapter is fully translated or still waiting on additional batches.",
          "The reader keeps chapter navigation visible so the user can move between sections while translations stream in.",
          "Translation-only mode should hide source paragraphs while preserving the chapter title and note rail.",
          "Reading state should restore the previously opened chapter when the reader session resumes.",
        ],
      },
      {
        title: "Chapter 3 — Notes",
        paragraphs: [
          "Operators need evidence that chapter-scoped translation remains stable under repeated navigation.",
          "EPUB parity depends on chapter order, rendering modes, and restored state all staying aligned.",
        ],
      },
    ],
    notes: ["generated-inline-epub-fixture"],
  },
  [EPUB_READER_LONG_CHAPTER_FIXTURE]: {
    name: EPUB_READER_LONG_CHAPTER_FIXTURE,
    bookTitle: "Astra Long Chapter Stress",
    activeChapterIndex: 2,
    resumeChapterIndex: 2,
    chapters: [
      {
        title: "Chapter 1 — Setup",
        paragraphs: [
          "A long-form reader should keep track of the active chapter even as the navigation rail grows.",
          "Each chapter needs to remain addressable after multiple translation batches finish.",
        ],
      },
      {
        title: "Chapter 2 — Context",
        paragraphs: [
          "Sidebar notes and repeated emphasis markers should not reorder the core reading flow.",
          "Translation output must preserve the chapter boundaries expected by the surrounding reader shell.",
        ],
      },
      {
        title: "Chapter 3 — Resume",
        paragraphs: [
          "This holdout chapter is intentionally longer so batching and resume state have to work together.",
          "Paragraph two keeps the same narrative thread while forcing the harness to issue another translation batch.",
          "Paragraph three adds more reading density and checks that source and translation stay paired in bilingual mode.",
          "Paragraph four verifies that translation-only mode still renders every translated paragraph in chapter order.",
          "Paragraph five simulates a user returning to the chapter after navigating away to another section.",
          "Paragraph six keeps the translation queue active long enough to flush multiple batch requests.",
          "Paragraph seven confirms that note-like passages do not erase the active chapter title during rerender.",
          "Paragraph eight ensures the restored chapter state remains visible when the reader snapshot is reopened.",
          "Paragraph nine keeps enough volume in the fixture to make the holdout materially different from the first cut.",
          "Paragraph ten closes the chapter with a final reminder that long-form EPUB reading should remain stable.",
        ],
      },
    ],
    notes: ["generated-inline-epub-holdout", "long-chapter"],
  },
}

const BATCH_SIZE = 3

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function renderModeSection(mode: EpubReaderMode, activeChapter: EpubReaderChapter, translations: string[]) {
  return [
    `<section class="epub-mode epub-mode-${mode}" data-mode="${mode}">`,
    "  <header class=\"epub-mode-header\">",
    `    <span class="epub-mode-name">${escapeHtml(mode)}</span>`,
    `    <span class="epub-mode-chapter">${escapeHtml(activeChapter.title)}</span>`,
    "  </header>",
    `  <article class="epub-chapter" data-role="epub-chapter" data-chapter-title="${escapeHtml(activeChapter.title)}">`,
    activeChapter.paragraphs.map((paragraph, index) => mode === "bilingual"
      ? [
          `    <div class="epub-block" data-block-index="${index}">`,
          `      <div data-role="epub-source" class="epub-source">${escapeHtml(paragraph)}</div>`,
          `      <div data-role="epub-translation" class="epub-translation">${escapeHtml(translations[index] ?? "")}</div>`,
          "    </div>",
        ].join("\n")
      : [
          `    <div class="epub-block epub-block-translation-only" data-block-index="${index}">`,
          `      <div data-role="epub-translation" class="epub-translation">${escapeHtml(translations[index] ?? "")}</div>`,
          "    </div>",
        ].join("\n"),
    ).join("\n"),
    "  </article>",
    "</section>",
  ].join("\n")
}

export function getEpubReaderFixtureDefinition(fixtureName = EPUB_READER_FIRST_CUT_FIXTURE) {
  return EPUB_FIXTURES[fixtureName] ?? EPUB_FIXTURES[EPUB_READER_FIRST_CUT_FIXTURE]
}

export function renderEpubReaderSkeletonHtml(params: {
  fixture: EpubReaderFixtureDefinition
  activeChapter: EpubReaderChapter
  resumedChapterTitle: string | null
  modes: EpubReaderMode[]
  translations: string[]
}) {
  return [
    "<!doctype html>",
    "<html>",
    "<head>",
    '  <meta charset="utf-8" />',
    `  <title>Astra EPUB Reader — ${escapeHtml(params.fixture.bookTitle)}</title>`,
    "  <style>",
    "    body { font-family: system-ui, sans-serif; margin: 24px auto; max-width: 1080px; background: #f8fafc; color: #0f172a; }",
    "    .epub-shell { display: grid; grid-template-columns: 240px minmax(0, 1fr); gap: 20px; }",
    "    .epub-toc { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 16px; display: flex; flex-direction: column; gap: 8px; }",
    "    .epub-toc button { border: none; background: #f8fafc; padding: 10px 12px; border-radius: 10px; text-align: left; color: #334155; font-weight: 600; }",
    "    .epub-toc button[data-active='true'] { background: #eef2ff; color: #4338ca; }",
    "    .epub-main { display: grid; gap: 20px; }",
    "    .epub-mode { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px; box-shadow: 0 4px 16px rgba(15,23,42,0.04); }",
    "    .epub-mode-header { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 14px; color: #6366f1; font-weight: 700; text-transform: uppercase; font-size: 12px; letter-spacing: 0.04em; }",
    "    .epub-block { display: grid; gap: 8px; padding-bottom: 14px; margin-bottom: 14px; border-bottom: 1px dashed #e2e8f0; }",
    "    .epub-source { font-size: 15px; line-height: 1.75; color: #1e293b; }",
    "    .epub-translation { font-size: 14px; line-height: 1.7; color: #4f46e5; background: #eef2ff; border-left: 3px solid #6366f1; padding: 8px 10px; border-radius: 0 8px 8px 0; }",
    "    .epub-block-translation-only .epub-translation { background: #ecfeff; border-left-color: #0891b2; color: #0f766e; }",
    "  </style>",
    "</head>",
    "<body>",
    `  <main class="epub-shell" data-astra-epub-reader="1" data-book-title="${escapeHtml(params.fixture.bookTitle)}" data-chapter-count="${params.fixture.chapters.length}" data-active-chapter-title="${escapeHtml(params.activeChapter.title)}" data-resumed-chapter-title="${escapeHtml(params.resumedChapterTitle ?? "")}">`,
    "    <nav class=\"epub-toc\" data-role=\"epub-toc\">",
    params.fixture.chapters.map((chapter, index) => `      <button type="button" data-role="epub-toc-item" data-chapter-title="${escapeHtml(chapter.title)}" data-active="${index === params.fixture.activeChapterIndex}">${escapeHtml(chapter.title)}</button>`).join("\n"),
    "    </nav>",
    "    <section class=\"epub-main\">",
    params.modes.map((mode) => renderModeSection(mode, params.activeChapter, params.translations)).join("\n"),
    "    </section>",
    "  </main>",
    "</body>",
    "</html>",
  ].join("\n")
}

export function summarizeEpubReaderDocument(document: Document): EpubReaderSkeletonSummary {
  const chapterTitles = Array.from(document.querySelectorAll<HTMLElement>("[data-role='epub-toc-item']")).map((node) => node.getAttribute("data-chapter-title") ?? "").filter(Boolean)
  const modes: EpubReaderModeSummary[] = (["bilingual", "translation-only"] as const).map((mode) => {
    const root = document.querySelector<HTMLElement>(`[data-mode="${mode}"]`)
    const sourceNodes = root ? Array.from(root.querySelectorAll<HTMLElement>("[data-role='epub-source']")) : []
    const translationNodes = root ? Array.from(root.querySelectorAll<HTMLElement>("[data-role='epub-translation']")) : []
    return {
      mode,
      chapterCount: chapterTitles.length,
      sectionCount: root ? root.querySelectorAll("[data-role='epub-chapter']").length : 0,
      sourceCount: sourceNodes.length,
      translationCount: translationNodes.length,
      chapterTitles,
      sourceTexts: sourceNodes.map((node) => node.textContent?.trim() ?? "").filter(Boolean),
      translationTexts: translationNodes.map((node) => node.textContent?.trim() ?? "").filter(Boolean),
    }
  })

  return {
    bookTitle: document.querySelector<HTMLElement>("[data-astra-epub-reader]")?.getAttribute("data-book-title") ?? "",
    activeChapterTitle: document.querySelector<HTMLElement>("[data-astra-epub-reader]")?.getAttribute("data-active-chapter-title") ?? "",
    resumedChapterTitle: document.querySelector<HTMLElement>("[data-astra-epub-reader]")?.getAttribute("data-resumed-chapter-title") || null,
    chapterTitles,
    modes,
  }
}

export async function runEpubReaderHarness(options: {
  fixtureName?: string
  modes?: EpubReaderMode[]
} = {}): Promise<EpubReaderHarnessResult> {
  const fixture = getEpubReaderFixtureDefinition(options.fixtureName)
  const browser = installBenchBrowser()
  const activeChapter = fixture.chapters[fixture.activeChapterIndex] ?? fixture.chapters[0]
  if (!activeChapter) {
    throw new Error(`EPUB fixture ${fixture.name} does not define an active chapter.`)
  }

  const translations = new Array(activeChapter.paragraphs.length).fill("") as string[]
  const runtime = browser.browser.runtime as unknown as {
    sendMessage: (message: {
      type: string
      payload: {
        texts: string[]
        targetLang: string
        task: string
      }
    }) => Promise<{
      type: string
      payload?: { translations: string[] }
    }>
  }

  for (let index = 0; index < activeChapter.paragraphs.length; index += BATCH_SIZE) {
    const batch = activeChapter.paragraphs.slice(index, index + BATCH_SIZE)
    const response = await runtime.sendMessage({
      type: "runtime/translate-batch",
      payload: {
        texts: batch,
        targetLang: "zh-CN",
        task: "translate",
      },
    })
    if (response.type !== "runtime/translate-batch:success" || !response.payload) {
      throw new Error(`Unexpected EPUB translation response: ${JSON.stringify(response)}`)
    }
    response.payload.translations.forEach((translation, batchIndex) => {
      translations[index + batchIndex] = translation
    })
  }

  const resumedChapterTitle = fixture.chapters[fixture.resumeChapterIndex]?.title ?? null
  const renderedHtml = renderEpubReaderSkeletonHtml({
    fixture,
    activeChapter,
    resumedChapterTitle,
    modes: options.modes ?? ["bilingual", "translation-only"],
    translations,
  })
  const document = new JSDOM(renderedHtml).window.document
  const summary = summarizeEpubReaderDocument(document)
  const bilingual = summary.modes.find((mode) => mode.mode === "bilingual")
  const translationOnly = summary.modes.find((mode) => mode.mode === "translation-only")

  if (!bilingual || !translationOnly) {
    throw new Error("EPUB reader skeleton did not render both modes.")
  }

  return {
    execution: {
      fixtureName: fixture.name,
      chapterCount: fixture.chapters.length,
      translationRequestCount: browser.getTranslateCalls().length,
      activeChapterTitle: activeChapter.title,
      resumedChapterTitle,
      readingStateRestored: resumedChapterTitle === activeChapter.title,
      bilingual,
      translationOnly,
      notes: [
        `bookTitle=${summary.bookTitle}`,
        `activeChapterTitle=${summary.activeChapterTitle}`,
        `resumedChapterTitle=${summary.resumedChapterTitle ?? "none"}`,
        `chapterTitles=${summary.chapterTitles.join(" | ")}`,
        ...(fixture.notes ?? []),
      ],
    },
    renderedHtml,
    translateCalls: browser.getTranslateCalls(),
    summary,
  }
}
