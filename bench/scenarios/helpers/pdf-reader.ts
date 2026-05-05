import { access, readFile } from "node:fs/promises"
import path from "node:path"

import { JSDOM } from "jsdom"

import { extractPdfPages, type PdfPage } from "@/entrypoints/pdf-reader/pdf-extractor"
import { translatePdfPage } from "@/entrypoints/pdf-reader/pdf-translator"

import { installBenchBrowser, type TranslateCallRecord, type TranslationBatchPayload } from "../../runtime/browser"
import type { PdfTranslationExecution } from "../../evaluators/pdf"

export type PdfReaderMode = "bilingual" | "translation-only"

export interface PdfReaderRenderedBlock {
  sourceIndex: number
  sourceText: string
  translation: string
}

export interface PdfReaderRenderedPage {
  pageNumber: number
  blocks: PdfReaderRenderedBlock[]
}

export interface PdfReaderModeSummary {
  mode: PdfReaderMode
  pageCount: number
  blockCount: number
  sectionCount: number
  sourceCount: number
  translationCount: number
  sourceTexts: string[]
  translationTexts: string[]
}

export interface PdfReaderSkeletonSummary {
  fileName: string
  modes: PdfReaderModeSummary[]
}

export interface PdfReaderFixtureDefinition {
  name: string
  fileName: string
  pages: string[][]
  notes?: string[]
}

export interface PdfReaderHarnessResult {
  execution: PdfTranslationExecution
  renderedHtml: string
  translateCalls: TranslateCallRecord[]
  summary: PdfReaderSkeletonSummary
}

function normalizeTranslateCallContext(context: TranslationBatchPayload["context"]): Record<string, unknown> | null {
  if (!context || typeof context !== "object") {
    return null
  }
  return context as Record<string, unknown>
}

export const PDF_READER_FIRST_CUT_FIXTURE = "pdf-reader-first-cut"
export const PDF_READER_LAYOUT_NOISE_FIXTURE = "pdf-reader-layout-noise"

const PDF_FIXTURES: Record<string, PdfReaderFixtureDefinition> = {
  [PDF_READER_FIRST_CUT_FIXTURE]: {
    name: PDF_READER_FIRST_CUT_FIXTURE,
    fileName: "pdf-reader-first-cut.pdf",
    pages: [
      [
        "Astra PDF reader first cut keeps bilingual lines aligned across the visible reading flow.",
      ],
      [
        "Translation only mode should preserve page boundaries while hiding the original source text blocks.",
      ],
    ],
    notes: ["generated-inline-fixture"],
  },
  [PDF_READER_LAYOUT_NOISE_FIXTURE]: {
    name: PDF_READER_LAYOUT_NOISE_FIXTURE,
    fileName: "pdf-reader-layout-noise.pdf",
    pages: [
      [
        "Primary article text stays readable even when page furniture and side annotations are present nearby.",
        "Footnote references and sidebar notes should not collapse the translated page into the wrong reading order.",
      ],
      [
        "Delayed secondary blocks and appendix notes should still render as translated blocks on the correct page.",
        "Bilingual rendering must keep source and translation parity under layout noise.",
      ],
    ],
    notes: ["generated-inline-holdout-fixture", "layout-noise"],
  },
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function escapePdfText(value: string) {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)")
    .replaceAll("\r", " ")
    .replaceAll("\n", " ")
}

function buildPdfContentStream(lines: string[]) {
  const commands = ["BT", "/F1 12 Tf"]
  let y = 720
  for (const line of lines) {
    commands.push(`1 0 0 1 72 ${y} Tm (${escapePdfText(line)}) Tj`)
    y -= 22
  }
  commands.push("ET")
  return commands.join("\n")
}

function buildPdfBytesFromFixture(definition: PdfReaderFixtureDefinition) {
  const objects: string[] = [""]
  const addObject = (content: string) => {
    objects.push(content)
    return objects.length - 1
  }

  const catalogId = addObject("")
  const pagesId = addObject("")
  const fontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
  const pageIds: number[] = []

  for (const pageLines of definition.pages) {
    const contentStream = buildPdfContentStream(pageLines)
    const contentId = addObject(`<< /Length ${Buffer.byteLength(contentStream, "utf8")} >>\nstream\n${contentStream}\nendstream`)
    const pageId = addObject(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`,
    )
    pageIds.push(pageId)
  }

  objects[pagesId] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`
  objects[catalogId] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`

  let pdf = "%PDF-1.4\n"
  const offsets: number[] = [0]

  for (let index = 1; index < objects.length; index += 1) {
    offsets[index] = Buffer.byteLength(pdf, "utf8")
    pdf += `${index} 0 obj\n${objects[index]}\nendobj\n`
  }

  const xrefOffset = Buffer.byteLength(pdf, "utf8")
  pdf += `xref\n0 ${objects.length}\n`
  pdf += "0000000000 65535 f \n"
  for (let index = 1; index < objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`
  }
  pdf += `trailer\n<< /Size ${objects.length} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`

  return new TextEncoder().encode(pdf)
}

async function pathExists(filePath: string) {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

export function getPdfReaderFixtureDefinition(fixtureName = PDF_READER_FIRST_CUT_FIXTURE) {
  return PDF_FIXTURES[fixtureName] ?? PDF_FIXTURES[PDF_READER_FIRST_CUT_FIXTURE]
}

export async function loadPdfReaderFixtureBytes(fixtureName = PDF_READER_FIRST_CUT_FIXTURE) {
  const fixturePath = path.resolve(process.cwd(), "test/fixtures/pdfs", `${fixtureName}.pdf`)
  if (await pathExists(fixturePath)) {
    return await readFile(fixturePath)
  }

  return buildPdfBytesFromFixture(getPdfReaderFixtureDefinition(fixtureName))
}

function renderModeSection(mode: PdfReaderMode, pages: PdfReaderRenderedPage[]) {
  return [
    `<section class="pdf-mode pdf-mode-${mode}" data-mode="${mode}">`,
    `  <header class="pdf-mode-header">`,
    `    <span class="pdf-mode-name">${escapeHtml(mode)}</span>`,
    `    <span class="pdf-mode-page-count">${pages.length} pages</span>`,
    `  </header>`,
    pages.map((page) => [
      `  <article class="pdf-page" data-page-number="${page.pageNumber}">`,
      `    <h2>Page ${page.pageNumber}</h2>`,
      ...page.blocks.map((block) => mode === "bilingual"
        ? [
            `    <div class="pdf-block" data-block-index="${block.sourceIndex}">`,
            `      <div class="pdf-source" data-role="source">${escapeHtml(block.sourceText)}</div>`,
            `      <div class="pdf-translation" data-role="translation">${escapeHtml(block.translation)}</div>`,
            `    </div>`,
          ].join("\n")
        : [
            `    <div class="pdf-block pdf-block-translation-only" data-block-index="${block.sourceIndex}">`,
            `      <div class="pdf-translation" data-role="translation">${escapeHtml(block.translation)}</div>`,
            `    </div>`,
          ].join("\n")),
      `  </article>`,
    ].join("\n")).join("\n"),
    `</section>`,
  ].join("\n")
}

export function renderPdfReaderSkeletonHtml(params: {
  fileName: string
  pages: PdfReaderRenderedPage[]
  modes: PdfReaderMode[]
}) {
  return [
    "<!doctype html>",
    "<html>",
    "<head>",
    '  <meta charset="utf-8" />',
    `  <title>Astra PDF Reader — ${escapeHtml(params.fileName)}</title>`,
    "  <style>",
    "    :root { color-scheme: light; }",
    "    body { font-family: system-ui, sans-serif; margin: 24px auto; max-width: 960px; background: #f8fafc; color: #0f172a; }",
    "    main { display: flex; flex-direction: column; gap: 24px; }",
    "    .pdf-mode { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 16px; box-shadow: 0 4px 16px rgba(15, 23, 42, 0.04); }",
    "    .pdf-mode-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; font-size: 12px; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }",
    "    .pdf-page { border-top: 1px solid #e2e8f0; padding-top: 16px; margin-top: 16px; }",
    "    .pdf-page h2 { margin: 0 0 12px; font-size: 16px; color: #334155; }",
    "    .pdf-block { display: grid; grid-template-columns: minmax(0, 1fr); gap: 6px; margin-bottom: 14px; padding-bottom: 14px; border-bottom: 1px dashed #e2e8f0; }",
    "    .pdf-source { font-size: 14px; line-height: 1.7; color: #1e293b; }",
    "    .pdf-translation { font-size: 14px; line-height: 1.65; color: #4f46e5; background: #eef2ff; border-left: 3px solid #6366f1; padding: 8px 10px; border-radius: 0 8px 8px 0; }",
    "    .pdf-block-translation-only .pdf-translation { background: #ecfeff; border-left-color: #0891b2; color: #0f766e; }",
    "  </style>",
    "</head>",
    "<body>",
    `  <main data-astra-pdf-reader="1" data-file-name="${escapeHtml(params.fileName)}">`,
    ...params.modes.map((mode) => renderModeSection(mode, params.pages)),
    "  </main>",
    "</body>",
    "</html>",
  ].join("\n")
}

export function summarizePdfReaderDocument(document: Document): PdfReaderSkeletonSummary {
  const modes: PdfReaderModeSummary[] = (["bilingual", "translation-only"] as const).map((mode) => {
    const modeRoot = document.querySelector<HTMLElement>(`[data-mode="${mode}"]`)
    const pageNodes = modeRoot ? Array.from(modeRoot.querySelectorAll<HTMLElement>(".pdf-page")) : []
    const sourceNodes = modeRoot ? Array.from(modeRoot.querySelectorAll<HTMLElement>('[data-role="source"]')) : []
    const translationNodes = modeRoot ? Array.from(modeRoot.querySelectorAll<HTMLElement>('[data-role="translation"]')) : []

    return {
      mode,
      pageCount: pageNodes.length,
      blockCount: modeRoot ? Array.from(modeRoot.querySelectorAll<HTMLElement>(".pdf-block")).length : 0,
      sectionCount: modeRoot ? 1 : 0,
      sourceCount: sourceNodes.length,
      translationCount: translationNodes.length,
      sourceTexts: sourceNodes.map((node) => node.textContent?.trim() ?? "").filter(Boolean),
      translationTexts: translationNodes.map((node) => node.textContent?.trim() ?? "").filter(Boolean),
    }
  })

  return {
    fileName: document.querySelector<HTMLElement>("[data-astra-pdf-reader]")?.getAttribute("data-file-name") ?? "",
    modes,
  }
}

export function buildPdfReaderPagesFromExtractedPages(
  pages: PdfPage[],
  translatedPages: Array<Array<{ sourceIndex: number; translation: string }>>,
  options: {
    translationPrefix?: string
  } = {},
): PdfReaderRenderedPage[] {
  const translationPrefix = options.translationPrefix ?? "ZH:"

  return pages.map((page, pageIndex) => ({
    pageNumber: page.pageNumber,
    blocks: page.blocks.map((block, index) => ({
      sourceIndex: index,
      sourceText: block.text,
      translation:
        translatedPages[pageIndex]?.find((translatedBlock) => translatedBlock.sourceIndex === index)?.translation
        ?? `${translationPrefix}${block.text.slice(0, 48)}`,
    })),
  }))
}

export async function runPdfReaderHarness(options: {
  fixtureName?: string
  modes?: PdfReaderMode[]
} = {}): Promise<PdfReaderHarnessResult> {
  const fixture = getPdfReaderFixtureDefinition(options.fixtureName)
  const browser = installBenchBrowser()
  const pdfBytes = await loadPdfReaderFixtureBytes(fixture.name)
  const pages = await extractPdfPages(pdfBytes)
  const translatedPages = await Promise.all(pages.map(async (page) => await translatePdfPage(page)))
  const renderedPages = buildPdfReaderPagesFromExtractedPages(
    pages,
    translatedPages.map((page) => page.translations),
  )
  const renderedHtml = renderPdfReaderSkeletonHtml({
    fileName: fixture.fileName,
    pages: renderedPages,
    modes: options.modes ?? ["bilingual", "translation-only"],
  })
  const document = new JSDOM(renderedHtml).window.document
  const summary = summarizePdfReaderDocument(document)
  const bilingual = summary.modes.find((mode) => mode.mode === "bilingual")
  const translationOnly = summary.modes.find((mode) => mode.mode === "translation-only")

  if (!bilingual || !translationOnly) {
    throw new Error("PDF reader skeleton did not render both modes.")
  }

  return {
    execution: {
      fixtureName: fixture.name,
      pageCount: pages.length,
      blockCount: renderedPages.reduce((sum, page) => sum + page.blocks.length, 0),
      translationRequestCount: browser.getTranslateCalls().length,
      translateCallContexts: browser.getTranslateCalls().map((call) => normalizeTranslateCallContext(call.payload.context)),
      privacyContextLeakCount: browser.getTranslateCalls().filter((call) => normalizeTranslateCallContext(call.payload.context) !== null).length,
      bilingual,
      translationOnly,
      notes: [
        `renderedModes=${summary.modes.map((mode) => mode.mode).join(",")}`,
        `fileName=${summary.fileName}`,
        `pdfPages=${pages.length}`,
        ...(fixture.notes ?? []),
      ],
    },
    renderedHtml,
    translateCalls: browser.getTranslateCalls(),
    summary,
  }
}
