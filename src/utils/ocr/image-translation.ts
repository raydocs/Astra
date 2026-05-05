export const IMAGE_TRANSLATION_MAX_FILE_BYTES = 10 * 1024 * 1024

export type ImageTranslationOcrFailureReason =
  | "unsupported_format"
  | "file_too_large"
  | "image_decode_failed"
  | "ocr_unavailable"
  | "ocr_failed"
  | "no_text_detected"

export interface ImageTranslationOcrFailure {
  ok: false
  reason: ImageTranslationOcrFailureReason
  message: string
}

export interface ImageTranslationOcrBox {
  left: number
  top: number
  width: number
  height: number
}

export interface ImageTranslationOcrLine {
  text: string
  bbox?: ImageTranslationOcrBox
  confidence?: number
}

export type ImageTranslationOverlayQualityReason =
  | "missing_bbox"
  | "invalid_bbox"
  | "low_confidence"
  | "collision_risk"
  | "missing_translation"
  | "renderable"

export interface ImageTranslationOverlayPlanInputRow {
  sourceText: string
  translatedText: string
  bbox?: ImageTranslationOcrBox
  confidence?: number
}

export interface ImageTranslationOverlayPlannedRow extends ImageTranslationOverlayPlanInputRow {
  index: number
  overlayReason: ImageTranslationOverlayQualityReason
  renderInOverlay: boolean
}

export interface ImageTranslationOverlayQualitySummary {
  total: number
  renderable: number
  fallback: number
  reasons: Record<ImageTranslationOverlayQualityReason, number>
}

export interface ImageTranslationOverlayQualityPlan {
  rows: ImageTranslationOverlayPlannedRow[]
  overlayRows: ImageTranslationOverlayPlannedRow[]
  fallbackRows: ImageTranslationOverlayPlannedRow[]
  summary: ImageTranslationOverlayQualitySummary
}

export type TranslationQualityTier = "tier_1" | "tier_2" | "tier_3"
export type TranslationQualitySurface = "image" | "pdf"

export interface TranslationQualitySummary {
  version: 1
  surface: TranslationQualitySurface
  tier: TranslationQualityTier
  label: string
  headline: string
  details: string[]
  metrics: Record<string, number | string>
}

export interface ImageTranslationQualityInput {
  source: ImageTranslationOcrSuccess["source"]
  overlaySummary: ImageTranslationOverlayQualitySummary
}

export interface PdfTranslationQualityPageInput {
  blockCount: number
  translatedCount: number
  phase?: "pending" | "translating" | "done" | "error"
}

export const translationQualityTierLabels: Record<TranslationQualityTier, string> = {
  tier_1: "Tier 1 · Ready",
  tier_2: "Tier 2 · Compare recommended",
  tier_3: "Tier 3 · Review required",
}

function getCoveragePercent(done: number, total: number): number {
  if (total <= 0) return 0
  return Math.round((done / total) * 100)
}

export function classifyImageTranslationQuality(input: ImageTranslationQualityInput): TranslationQualitySummary {
  const { overlaySummary, source } = input
  const missingTranslations = overlaySummary.reasons.missing_translation
  const coverage = getCoveragePercent(overlaySummary.renderable, overlaySummary.total)
  let tier: TranslationQualityTier
  let headline: string

  if (overlaySummary.total <= 0 || missingTranslations > 0) {
    tier = "tier_3"
    headline = "Review OCR output before relying on this translation."
  } else if (overlaySummary.fallback > 0) {
    tier = "tier_2"
    headline = "Translations are ready, but compare rows are recommended."
  } else if (overlaySummary.renderable === 0) {
    tier = "tier_3"
    headline = "Review OCR output before relying on this translation."
  } else {
    tier = "tier_1"
    headline = "All translated rows are safe for approximate overlay."
  }

  return {
    version: 1,
    surface: "image",
    tier,
    label: translationQualityTierLabels[tier],
    headline,
    details: [
      `${overlaySummary.renderable}/${overlaySummary.total} row(s) are overlay-ready.`,
      `${overlaySummary.fallback} row(s) use compare fallback.`,
      source === "svg-text"
        ? "SVG text was extracted directly."
        : source === "text-detector"
          ? "Raster OCR depends on browser TextDetector confidence and boxes."
          : "Provided OCR text was normalized before translation.",
    ],
    metrics: {
      lineCount: overlaySummary.total,
      overlayReadyRows: overlaySummary.renderable,
      fallbackRows: overlaySummary.fallback,
      missingTranslations,
      overlayCoveragePercent: coverage,
      source,
    },
  }
}

export function classifyPdfTranslationQuality(pages: PdfTranslationQualityPageInput[]): TranslationQualitySummary {
  const pageCount = pages.length
  const blockCount = pages.reduce((sum, page) => sum + Math.max(0, page.blockCount), 0)
  const translatedCount = pages.reduce((sum, page) => sum + Math.max(0, Math.min(page.translatedCount, page.blockCount)), 0)
  const errorPages = pages.filter((page) => page.phase === "error").length
  const pendingPages = pages.filter((page) => page.phase === "pending" || page.phase === "translating").length
  const missingTranslations = Math.max(0, blockCount - translatedCount)
  const coverage = getCoveragePercent(translatedCount, blockCount)
  let tier: TranslationQualityTier
  let headline: string

  if (blockCount <= 0 || errorPages > 0 || (pendingPages === 0 && missingTranslations > 0)) {
    tier = "tier_3"
    headline = "Review PDF extraction and missing translations."
  } else if (pendingPages > 0 || missingTranslations > 0) {
    tier = "tier_2"
    headline = "PDF translation is usable, but still needs comparison."
  } else {
    tier = "tier_1"
    headline = "Every extracted PDF block has a rendered translation."
  }

  return {
    version: 1,
    surface: "pdf",
    tier,
    label: translationQualityTierLabels[tier],
    headline,
    details: [
      `${translatedCount}/${blockCount} extracted block(s) have translations.`,
      `${pageCount} page(s) extracted; ${errorPages} page(s) need attention.`,
      pendingPages > 0 ? `${pendingPages} page(s) are still translating.` : "No pages are pending translation.",
    ],
    metrics: {
      pageCount,
      blockCount,
      translatedBlocks: translatedCount,
      missingTranslations,
      errorPages,
      pendingPages,
      translationCoveragePercent: coverage,
    },
  }
}

export interface ImageTranslationOcrSuccess {
  ok: true
  text: string
  lineCount: number
  source: "svg-text" | "text-detector" | "provided-text"
  lines: ImageTranslationOcrLine[]
}

export type ImageTranslationOcrResult = ImageTranslationOcrSuccess | ImageTranslationOcrFailure

interface DetectedTextBlock {
  rawValue?: string
  confidence?: number
  boundingBox?: {
    x?: number
    y?: number
    left?: number
    top?: number
    width?: number
    height?: number
  }
}

interface TextDetectorLike {
  detect(image: ImageBitmap): Promise<DetectedTextBlock[]>
}

interface TextDetectorConstructorLike {
  new(): TextDetectorLike
}

interface TextDetectorGlobal {
  TextDetector?: TextDetectorConstructorLike
}

const SUPPORTED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/bmp",
  "image/svg+xml",
])

const OVERLAY_CONFIDENCE_MIN = 0.55
const OVERLAY_COLLISION_MIN_INTERSECTION_RATIO = 0.18

function createEmptyOverlayReasonCounts(): Record<ImageTranslationOverlayQualityReason, number> {
  return {
    missing_bbox: 0,
    invalid_bbox: 0,
    low_confidence: 0,
    collision_risk: 0,
    missing_translation: 0,
    renderable: 0,
  }
}

function hasValidOverlayBox(bbox: ImageTranslationOcrBox): boolean {
  const values = [bbox.left, bbox.top, bbox.width, bbox.height]
  if (!values.every((value) => Number.isFinite(value))) return false
  if (bbox.width <= 0 || bbox.height <= 0) return false
  if (bbox.left < 0 || bbox.top < 0) return false
  if (bbox.left + bbox.width > 100 || bbox.top + bbox.height > 100) return false
  return true
}

function getOverlayBoxArea(bbox: ImageTranslationOcrBox): number {
  return Math.max(0, bbox.width) * Math.max(0, bbox.height)
}

function hasOverlayCollisionRisk(bbox: ImageTranslationOcrBox, acceptedBoxes: ImageTranslationOcrBox[]): boolean {
  const area = getOverlayBoxArea(bbox)
  if (area <= 0) return true

  return acceptedBoxes.some((acceptedBox) => {
    const horizontalOverlap = Math.max(0, Math.min(bbox.left + bbox.width, acceptedBox.left + acceptedBox.width) - Math.max(bbox.left, acceptedBox.left))
    const verticalOverlap = Math.max(0, Math.min(bbox.top + bbox.height, acceptedBox.top + acceptedBox.height) - Math.max(bbox.top, acceptedBox.top))
    const intersection = horizontalOverlap * verticalOverlap
    if (intersection <= 0) return false
    const acceptedArea = getOverlayBoxArea(acceptedBox)
    return intersection / Math.max(1, Math.min(area, acceptedArea)) >= OVERLAY_COLLISION_MIN_INTERSECTION_RATIO
  })
}

export function planImageTranslationOverlayQuality(rows: ImageTranslationOverlayPlanInputRow[]): ImageTranslationOverlayQualityPlan {
  const acceptedBoxes: ImageTranslationOcrBox[] = []
  const reasons = createEmptyOverlayReasonCounts()

  const plannedRows = rows.map((row, index): ImageTranslationOverlayPlannedRow => {
    let overlayReason: ImageTranslationOverlayQualityReason = "renderable"

    if (!row.translatedText.trim()) {
      overlayReason = "missing_translation"
    } else if (!row.bbox) {
      overlayReason = "missing_bbox"
    } else if (!hasValidOverlayBox(row.bbox)) {
      overlayReason = "invalid_bbox"
    } else if (typeof row.confidence === "number" && Number.isFinite(row.confidence) && row.confidence < OVERLAY_CONFIDENCE_MIN) {
      overlayReason = "low_confidence"
    } else if (hasOverlayCollisionRisk(row.bbox, acceptedBoxes)) {
      overlayReason = "collision_risk"
    }

    const renderInOverlay = overlayReason === "renderable"
    if (renderInOverlay && row.bbox) acceptedBoxes.push(row.bbox)
    reasons[overlayReason] += 1

    return {
      ...row,
      index,
      overlayReason,
      renderInOverlay,
    }
  })

  const overlayRows = plannedRows.filter((row) => row.renderInOverlay)
  const fallbackRows = plannedRows.filter((row) => !row.renderInOverlay)

  return {
    rows: plannedRows,
    overlayRows,
    fallbackRows,
    summary: {
      total: plannedRows.length,
      renderable: overlayRows.length,
      fallback: fallbackRows.length,
      reasons,
    },
  }
}

export function getImageTranslationFailureCopy(reason: ImageTranslationOcrFailureReason): string {
  switch (reason) {
    case "unsupported_format":
      return "This beta currently accepts PNG, JPEG, WebP, GIF, BMP, and SVG images."
    case "file_too_large":
      return "This image is too large for the beta OCR path. Try an image under 10 MB."
    case "image_decode_failed":
      return "Astra could not decode this image. Try a different export or screenshot."
    case "ocr_unavailable":
      return "OCR is not available in this browser build yet. SVG text can still be extracted; raster OCR needs a browser TextDetector engine."
    case "ocr_failed":
      return "The OCR engine failed while reading this image. Try a clearer crop or another screenshot."
    case "no_text_detected":
      return "No readable text was detected in this image. Try a sharper image or crop to the text area."
  }
}

function normalizeOcrLine(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter((line) => line.length > 0)
    .join(" ")
    .trim()
}

export function normalizeExtractedOcrText(
  text: string,
  source: ImageTranslationOcrSuccess["source"] = "provided-text",
  lines?: ImageTranslationOcrLine[],
): ImageTranslationOcrResult {
  const normalizedLines = (lines?.length ? lines : text.split(/\r\n?|\n/g).map((line) => ({ text: line })))
    .map((line) => ({ ...line, text: normalizeOcrLine(line.text) }))
    .filter((line) => line.text.length > 0)

  const normalized = normalizedLines.map((line) => line.text).join("\n").trim()

  if (!normalized) {
    return {
      ok: false,
      reason: "no_text_detected",
      message: getImageTranslationFailureCopy("no_text_detected"),
    }
  }

  return {
    ok: true,
    text: normalized,
    lineCount: normalizedLines.length,
    source,
    lines: normalizedLines,
  }
}

function validateImageFile(file: File): ImageTranslationOcrFailure | null {
  if (file.size > IMAGE_TRANSLATION_MAX_FILE_BYTES) {
    return {
      ok: false,
      reason: "file_too_large",
      message: getImageTranslationFailureCopy("file_too_large"),
    }
  }

  if (!SUPPORTED_IMAGE_TYPES.has(file.type)) {
    return {
      ok: false,
      reason: "unsupported_format",
      message: getImageTranslationFailureCopy("unsupported_format"),
    }
  }

  return null
}

function parseSvgNumber(value: string | null): number | null {
  if (!value) return null
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : null
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value))
}

function getSvgDimensions(document: Document): { width: number, height: number } | null {
  const svg = document.documentElement
  const viewBox = svg.getAttribute("viewBox")?.trim().split(/[\s,]+/).map((part) => Number.parseFloat(part))
  if (viewBox?.length === 4 && viewBox.every((value) => Number.isFinite(value)) && viewBox[2] > 0 && viewBox[3] > 0) {
    return { width: viewBox[2], height: viewBox[3] }
  }

  const width = parseSvgNumber(svg.getAttribute("width"))
  const height = parseSvgNumber(svg.getAttribute("height"))
  if (width && height && width > 0 && height > 0) return { width, height }
  return null
}

function getInheritedSvgNumber(element: Element, attribute: string): number | null {
  const direct = parseSvgNumber(element.getAttribute(attribute))
  if (direct !== null) return direct
  const textParent = element.parentElement?.closest("text")
  return textParent ? parseSvgNumber(textParent.getAttribute(attribute)) : null
}

function buildSvgTextBox(element: Element, text: string, dimensions: { width: number, height: number } | null): ImageTranslationOcrBox | undefined {
  if (!dimensions) return undefined
  const x = getInheritedSvgNumber(element, "x")
  const y = getInheritedSvgNumber(element, "y")
  if (x === null || y === null) return undefined

  const fontSize = getInheritedSvgNumber(element, "font-size") ?? 16
  const estimatedWidth = Math.max(fontSize, text.length * fontSize * 0.58)
  const estimatedHeight = fontSize * 1.25
  const top = y - estimatedHeight * 0.8

  return {
    left: clampPercent((x / dimensions.width) * 100),
    top: clampPercent((top / dimensions.height) * 100),
    width: clampPercent((estimatedWidth / dimensions.width) * 100),
    height: clampPercent((estimatedHeight / dimensions.height) * 100),
  }
}

function extractSvgText(svgMarkup: string): ImageTranslationOcrResult {
  try {
    const document = new DOMParser().parseFromString(svgMarkup, "image/svg+xml")
    const parserError = document.querySelector("parsererror")
    if (parserError) {
      return {
        ok: false,
        reason: "image_decode_failed",
        message: getImageTranslationFailureCopy("image_decode_failed"),
      }
    }

    const dimensions = getSvgDimensions(document)
    const lines = Array.from(document.querySelectorAll("text, tspan, title, desc"))
      .map((node) => {
        const text = node.textContent ?? ""
        return {
          text,
          bbox: node.matches("text, tspan") ? buildSvgTextBox(node, text, dimensions) : undefined,
        }
      })

    return normalizeExtractedOcrText(lines.map((line) => line.text).join("\n"), "svg-text", lines)
  } catch {
    return {
      ok: false,
      reason: "image_decode_failed",
      message: getImageTranslationFailureCopy("image_decode_failed"),
    }
  }
}

async function readFileText(file: File): Promise<string> {
  if (typeof file.text === "function") {
    return file.text()
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "")
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read image file."))
    reader.readAsText(file)
  })
}

function normalizeTextDetectorBox(block: DetectedTextBlock, bitmap: ImageBitmap): ImageTranslationOcrBox | undefined {
  const box = block.boundingBox
  const width = bitmap.width || 0
  const height = bitmap.height || 0
  if (!box || width <= 0 || height <= 0 || !box.width || !box.height) return undefined

  const left = box.left ?? box.x ?? 0
  const top = box.top ?? box.y ?? 0
  return {
    left: clampPercent((left / width) * 100),
    top: clampPercent((top / height) * 100),
    width: clampPercent((box.width / width) * 100),
    height: clampPercent((box.height / height) * 100),
  }
}

export async function extractTextFromImageFile(file: File): Promise<ImageTranslationOcrResult> {
  const validationFailure = validateImageFile(file)
  if (validationFailure) return validationFailure

  if (file.type === "image/svg+xml") {
    return extractSvgText(await readFileText(file))
  }

  const TextDetectorConstructor = (globalThis as TextDetectorGlobal).TextDetector
  if (!TextDetectorConstructor || typeof createImageBitmap !== "function") {
    return {
      ok: false,
      reason: "ocr_unavailable",
      message: getImageTranslationFailureCopy("ocr_unavailable"),
    }
  }

  let bitmap: ImageBitmap | null = null
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return {
      ok: false,
      reason: "image_decode_failed",
      message: getImageTranslationFailureCopy("image_decode_failed"),
    }
  }

  try {
    const detector = new TextDetectorConstructor()
    const detected = await detector.detect(bitmap)
    const lines = detected.map((block) => ({
      text: block.rawValue ?? "",
      bbox: normalizeTextDetectorBox(block, bitmap),
      ...(typeof block.confidence === "number" && Number.isFinite(block.confidence) ? { confidence: block.confidence } : {}),
    }))
    return normalizeExtractedOcrText(
      lines.map((line) => line.text).join("\n"),
      "text-detector",
      lines,
    )
  } catch {
    return {
      ok: false,
      reason: "ocr_failed",
      message: getImageTranslationFailureCopy("ocr_failed"),
    }
  } finally {
    bitmap.close()
  }
}

export function findImageFileInClipboardItems(items: DataTransferItemList): File | null {
  for (const item of Array.from(items)) {
    if (item.kind === "file" && item.type.startsWith("image/")) {
      return item.getAsFile()
    }
  }

  return null
}
