import { afterEach, describe, expect, it, vi } from "vitest"
import {
  classifyImageTranslationQuality,
  classifyPdfTranslationQuality,
  extractTextFromImageFile,
  getImageTranslationFailureCopy,
  normalizeExtractedOcrText,
  planImageTranslationOverlayQuality,
} from "./image-translation"

describe("image translation OCR helper", () => {
  afterEach(() => {
    vi.restoreAllMocks()
    delete (globalThis as { TextDetector?: unknown }).TextDetector
    delete (globalThis as { createImageBitmap?: unknown }).createImageBitmap
  })

  it("normalizes OCR text into stable non-empty lines", () => {
    expect(normalizeExtractedOcrText("  Hello\t world \r\n\n  Bonjour\u00a0Astra  ")).toEqual({
      ok: true,
      text: "Hello world\nBonjour Astra",
      lineCount: 2,
      source: "provided-text",
      lines: [{ text: "Hello world" }, { text: "Bonjour Astra" }],
    })
  })

  it("returns explicit no_text_detected for blank normalized OCR text", () => {
    const result = normalizeExtractedOcrText(" \n\t ")
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe("no_text_detected")
      expect(result.message).toBe(getImageTranslationFailureCopy("no_text_detected"))
    }
  })

  it("extracts readable text directly from SVG text nodes", async () => {
    const file = new File([
      `<svg xmlns="http://www.w3.org/2000/svg"><text>Bonjour Astra</text><text>Menu du jour</text></svg>`,
    ], "menu.svg", { type: "image/svg+xml" })

    const result = await extractTextFromImageFile(file)
    expect(result).toMatchObject({
      ok: true,
      text: "Bonjour Astra\nMenu du jour",
      lineCount: 2,
      source: "svg-text",
      lines: [{ text: "Bonjour Astra" }, { text: "Menu du jour" }],
    })
  })

  it("normalizes SVG text bboxes into image-relative percentages when coordinates are available", async () => {
    const file = new File([
      `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><text x="20" y="50" font-size="20">Bonjour</text></svg>`,
    ], "menu.svg", { type: "image/svg+xml" })

    const result = await extractTextFromImageFile(file)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.lines[0]?.text).toBe("Bonjour")
      expect(result.lines[0]?.bbox).toEqual(expect.objectContaining({ left: 10, top: 30, height: 25 }))
      expect(result.lines[0]?.bbox?.width).toBeCloseTo(40.6)
    }
  })

  it("classifies overlay rows by safety reason and keeps only renderable rows", () => {
    const plan = planImageTranslationOverlayQuality([
      { sourceText: "safe", translatedText: "安全", bbox: { left: 5, top: 5, width: 20, height: 10 }, confidence: 0.9 },
      { sourceText: "missing box", translatedText: "なし" },
      { sourceText: "invalid", translatedText: "無効", bbox: { left: 95, top: 5, width: 10, height: 10 } },
      { sourceText: "low", translatedText: "低い", bbox: { left: 5, top: 22, width: 20, height: 10 }, confidence: 0.2 },
      { sourceText: "collision", translatedText: "重なる", bbox: { left: 8, top: 7, width: 18, height: 10 }, confidence: 0.99 },
      { sourceText: "missing translation", translatedText: "", bbox: { left: 5, top: 40, width: 20, height: 10 } },
    ])

    expect(plan.overlayRows.map((row) => row.sourceText)).toEqual(["safe"])
    expect(plan.fallbackRows.map((row) => row.overlayReason)).toEqual([
      "missing_bbox",
      "invalid_bbox",
      "low_confidence",
      "collision_risk",
      "missing_translation",
    ])
    expect(plan.summary).toMatchObject({
      total: 6,
      renderable: 1,
      fallback: 5,
      reasons: {
        renderable: 1,
        missing_bbox: 1,
        invalid_bbox: 1,
        low_confidence: 1,
        collision_risk: 1,
        missing_translation: 1,
      },
    })
  })

  it("classifies image quality tiers from deterministic overlay summary", () => {
    const ready = planImageTranslationOverlayQuality([
      { sourceText: "safe", translatedText: "安全", bbox: { left: 5, top: 5, width: 20, height: 10 } },
    ])
    const compare = planImageTranslationOverlayQuality([
      { sourceText: "safe", translatedText: "安全", bbox: { left: 5, top: 5, width: 20, height: 10 } },
      { sourceText: "missing box", translatedText: "比較" },
    ])
    const review = planImageTranslationOverlayQuality([
      { sourceText: "missing translation", translatedText: "", bbox: { left: 5, top: 5, width: 20, height: 10 } },
    ])

    expect(classifyImageTranslationQuality({ source: "svg-text", overlaySummary: ready.summary })).toMatchObject({
      version: 1,
      surface: "image",
      tier: "tier_1",
      label: "Tier 1 · Ready",
      metrics: { overlayCoveragePercent: 100, source: "svg-text" },
    })
    expect(classifyImageTranslationQuality({ source: "text-detector", overlaySummary: compare.summary })).toMatchObject({
      tier: "tier_2",
      metrics: { overlayReadyRows: 1, fallbackRows: 1 },
    })
    expect(classifyImageTranslationQuality({ source: "provided-text", overlaySummary: review.summary })).toMatchObject({
      tier: "tier_3",
      metrics: { missingTranslations: 1 },
    })
  })

  it("classifies translated fallback-only image rows as compare recommended", () => {
    const fallbackOnly = planImageTranslationOverlayQuality([
      { sourceText: "missing box", translatedText: "比較" },
      { sourceText: "low confidence", translatedText: "低信頼", bbox: { left: 5, top: 5, width: 20, height: 10 }, confidence: 0.2 },
    ])

    expect(fallbackOnly.summary).toMatchObject({
      total: 2,
      renderable: 0,
      fallback: 2,
      reasons: { missing_translation: 0 },
    })
    expect(classifyImageTranslationQuality({ source: "text-detector", overlaySummary: fallbackOnly.summary })).toMatchObject({
      tier: "tier_2",
      label: "Tier 2 · Compare recommended",
      metrics: {
        overlayReadyRows: 0,
        fallbackRows: 2,
        missingTranslations: 0,
        overlayCoveragePercent: 0,
      },
    })
  })

  it("classifies PDF quality tiers from extracted block translation coverage", () => {
    expect(classifyPdfTranslationQuality([
      { blockCount: 2, translatedCount: 2, phase: "done" },
      { blockCount: 1, translatedCount: 1, phase: "done" },
    ])).toMatchObject({
      version: 1,
      surface: "pdf",
      tier: "tier_1",
      metrics: { blockCount: 3, translatedBlocks: 3, translationCoveragePercent: 100 },
    })

    expect(classifyPdfTranslationQuality([
      { blockCount: 2, translatedCount: 1, phase: "pending" },
    ])).toMatchObject({
      tier: "tier_2",
      metrics: { pendingPages: 1, missingTranslations: 1 },
    })

    expect(classifyPdfTranslationQuality([
      { blockCount: 2, translatedCount: 1, phase: "done" },
    ])).toMatchObject({
      tier: "tier_3",
      metrics: { missingTranslations: 1 },
    })
  })

  it("uses browser TextDetector for raster images when available", async () => {
    const bitmap = { width: 200, height: 100, close: vi.fn() }
    ;(globalThis as unknown as { createImageBitmap: typeof createImageBitmap }).createImageBitmap = vi.fn(async () => bitmap as unknown as ImageBitmap)
    ;(globalThis as { TextDetector?: unknown }).TextDetector = class {
      async detect() {
        return [
          { rawValue: "Hola", confidence: 0.92, boundingBox: { x: 20, y: 10, width: 60, height: 20 } },
          { rawValue: "mundo" },
        ]
      }
    }

    const file = new File(["not-real-pixels"], "screen.png", { type: "image/png" })
    await expect(extractTextFromImageFile(file)).resolves.toEqual({
      ok: true,
      text: "Hola\nmundo",
      lineCount: 2,
      source: "text-detector",
      lines: [
        { text: "Hola", bbox: { left: 10, top: 10, width: 30, height: 20 }, confidence: 0.92 },
        { text: "mundo" },
      ],
    })
    expect(bitmap.close).toHaveBeenCalledOnce()
  })

  it("surfaces explicit failure reasons for unsupported raster OCR", async () => {
    const file = new File(["not-real-pixels"], "screen.png", { type: "image/png" })
    const result = await extractTextFromImageFile(file)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe("ocr_unavailable")
    }
  })

  it("rejects unsupported formats before OCR", async () => {
    const file = new File(["hello"], "notes.txt", { type: "text/plain" })
    const result = await extractTextFromImageFile(file)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe("unsupported_format")
    }
  })
})
