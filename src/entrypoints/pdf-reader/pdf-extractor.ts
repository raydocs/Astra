/**
 * PDF text extraction using pdf.js.
 *
 * Extracts text blocks from each page, preserving reading order.
 */

import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs"

const IS_NODE_BENCH_ENV = typeof process !== "undefined" && !!process.versions?.node
const STANDARD_FONT_DATA_URL = (() => {
  if (!IS_NODE_BENCH_ENV) {
    return undefined
  }

  const nodeProcess = process as typeof process & {
    getBuiltinModule?: (id: string) => Record<string, unknown> | undefined
  }
  const nodePath = nodeProcess.getBuiltinModule?.("node:path") as {
    dirname?: (value: string) => string
    resolve?: (...segments: string[]) => string
  } | undefined
  const nodeUrl = nodeProcess.getBuiltinModule?.("node:url") as {
    fileURLToPath?: (value: URL | string) => string
  } | undefined

  if (nodePath?.dirname && nodePath.resolve && nodeUrl?.fileURLToPath && import.meta.url.startsWith("file:")) {
    const moduleDir = nodePath.dirname(nodeUrl.fileURLToPath(import.meta.url))
    return `${nodePath.resolve(moduleDir, "../../../node_modules/pdfjs-dist/standard_fonts")}/`
  }

  return `${process.cwd()}/node_modules/pdfjs-dist/standard_fonts/`
})()

// In the browser bundle we still prefer the bundled worker, but in Node-based
// bench harness runs we disable workers entirely to avoid worker resolution
// issues and keep extraction deterministic.
if (!IS_NODE_BENCH_ENV) {
  GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString()
}

export interface PdfTextBlock {
  text: string
  x: number
  y: number
  width: number
  height: number
}

export interface PdfPage {
  pageNumber: number
  width: number
  height: number
  blocks: PdfTextBlock[]
}

/**
 * Merge text items from pdf.js into logical paragraph blocks.
 * Groups items that are on the same line or consecutive lines.
 */
function mergeTextItems(
  items: Array<{ str: string; transform: number[]; width: number; height: number }>,
  pageHeight: number,
): PdfTextBlock[] {
  if (items.length === 0) return []

  const blocks: PdfTextBlock[] = []
  let currentBlock: { texts: string[]; x: number; y: number; maxX: number; minY: number; height: number } | null = null

  const LINE_MERGE_THRESHOLD = 3 // pixels

  for (const item of items) {
    if (!item.str.trim()) continue

    const x = item.transform[4]
    const y = pageHeight - item.transform[5]
    const w = item.width
    const h = item.height || 12

    if (
      currentBlock
      && Math.abs(y - currentBlock.y) < LINE_MERGE_THRESHOLD
    ) {
      // Same line — append
      currentBlock.texts.push(item.str)
      currentBlock.maxX = Math.max(currentBlock.maxX, x + w)
    } else if (
      currentBlock
      && y > currentBlock.y
      && y - currentBlock.y < h * 2
      && Math.abs(x - currentBlock.x) < 50
    ) {
      // Next line, same paragraph — append with space
      currentBlock.texts.push(item.str)
      currentBlock.minY = Math.min(currentBlock.minY, y)
      currentBlock.maxX = Math.max(currentBlock.maxX, x + w)
      currentBlock.y = y
      currentBlock.height += h
    } else {
      // New block
      if (currentBlock) {
        blocks.push({
          text: currentBlock.texts.join(" ").replace(/\s+/g, " ").trim(),
          x: currentBlock.x,
          y: currentBlock.minY,
          width: currentBlock.maxX - currentBlock.x,
          height: currentBlock.height,
        })
      }
      currentBlock = {
        texts: [item.str],
        x,
        y,
        maxX: x + w,
        minY: y,
        height: h,
      }
    }
  }

  if (currentBlock) {
    blocks.push({
      text: currentBlock.texts.join(" ").replace(/\s+/g, " ").trim(),
      x: currentBlock.x,
      y: currentBlock.minY,
      width: currentBlock.maxX - currentBlock.x,
      height: currentBlock.height,
    })
  }

  // Filter out very short blocks (page numbers, headers)
  return blocks.filter((b) => b.text.length >= 5)
}

export async function extractPdfPages(data: Uint8Array): Promise<PdfPage[]> {
  const pdf = await getDocument({
    data,
    disableWorker: IS_NODE_BENCH_ENV,
    ...(STANDARD_FONT_DATA_URL ? { standardFontDataUrl: STANDARD_FONT_DATA_URL } : {}),
  } as Parameters<typeof getDocument>[0]).promise
  const pages: PdfPage[] = []

  try {
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale: 1.0 })
    const textContent = await page.getTextContent()

    const items = textContent.items
      .filter((item): item is typeof item & { str: string; transform: number[]; width: number; height: number } =>
        "str" in item && typeof item.str === "string",
      )

    const blocks = mergeTextItems(items, viewport.height)

    pages.push({
      pageNumber: i,
      width: viewport.width,
      height: viewport.height,
      blocks,
    })
  }

  return pages
  } finally {
    await pdf.destroy()
  }
}
