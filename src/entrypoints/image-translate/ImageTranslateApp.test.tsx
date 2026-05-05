import { act } from "react"
import ReactDOM from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_ASTRA_CONFIG } from "@/types/config"
import { createTranslationPathMarker, summarizeTranslationPathMarkers } from "@/utils/providers/routing-metadata"

const {
  readConfigMock,
  translateTextsMock,
  extractTextFromImageFileMock,
  consumeImageTranslateHandoffMock,
} = vi.hoisted(() => ({
  readConfigMock: vi.fn(),
  translateTextsMock: vi.fn(),
  extractTextFromImageFileMock: vi.fn(),
  consumeImageTranslateHandoffMock: vi.fn(),
}))

vi.mock("@/utils/storage/config", () => ({
  readConfig: readConfigMock,
}))

vi.mock("@/utils/translate/translate", () => ({
  translateTexts: translateTextsMock,
}))

vi.mock("@/utils/ocr/image-translation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/ocr/image-translation")>()
  return {
    ...actual,
    extractTextFromImageFile: extractTextFromImageFileMock,
  }
})

vi.mock("./handoff", () => ({
  consumeImageTranslateHandoff: consumeImageTranslateHandoffMock,
  IMAGE_TRANSLATE_HANDOFF_QUERY_PARAM: "handoff",
}))

import { ImageTranslateApp } from "./ImageTranslateApp"

function createPathSummary() {
  return summarizeTranslationPathMarkers([
    createTranslationPathMarker({
      route: "direct",
      attemptedTransports: ["direct"],
      finalTransport: "direct",
      fallbackUsed: false,
    }),
    createTranslationPathMarker({
      route: "relay",
      attemptedTransports: ["relay"],
      finalTransport: "relay",
      fallbackUsed: false,
    }),
    createTranslationPathMarker({
      route: "fallback",
      attemptedTransports: ["direct", "relay"],
      finalTransport: "relay",
      fallbackUsed: true,
    }),
  ])!
}

function createImageFetchResponse(body: string, type = "image/svg+xml"): Response {
  const bytes = new TextEncoder().encode(body)
  const blob = new Blob([bytes], { type })
  return {
    ok: true,
    status: 200,
    headers: new Headers({
      "content-type": type,
      "content-length": String(bytes.byteLength),
    }),
    blob: () => Promise.resolve(blob),
  } as Response
}

describe("ImageTranslateApp", () => {
  let container: HTMLDivElement
  let root: ReactDOM.Root

  beforeEach(async () => {
    vi.clearAllMocks()
    window.history.replaceState(null, "", "/image-translate.html")
    readConfigMock.mockResolvedValue({ ...DEFAULT_ASTRA_CONFIG, targetLang: "ja" })
    translateTextsMock.mockResolvedValue({ ok: true, translations: ["こんにちは Astra", "メモ"] })
    consumeImageTranslateHandoffMock.mockResolvedValue({ ok: false, reason: "invalid" })
    extractTextFromImageFileMock.mockResolvedValue({
      ok: true,
      text: "Hello Astra\nNote without box",
      lineCount: 2,
      source: "svg-text",
      lines: [
        { text: "Hello Astra", bbox: { left: 10, top: 20, width: 35, height: 12 } },
        { text: "Note without box" },
      ],
    })
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:astra-image"),
    })
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    })
    container = document.createElement("div")
    document.body.appendChild(container)
    root = ReactDOM.createRoot(container)

    await act(async () => {
      root.render(<ImageTranslateApp />)
      await Promise.resolve()
      await Promise.resolve()
    })
    consumeImageTranslateHandoffMock.mockClear()
  })

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root.unmount()
        await Promise.resolve()
      })
    }
    container.remove()
    vi.unstubAllGlobals()
  })

  async function flushAppEffects() {
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  }

  async function remountAt(path: string) {
    await act(async () => {
      root.unmount()
      await Promise.resolve()
    })
    window.history.replaceState(null, "", path)
    root = ReactDOM.createRoot(container)
    await act(async () => {
      root.render(<ImageTranslateApp />)
      await flushAppEffects()
    })
  }

  async function upload(file: File) {
    const input = container.querySelector('[data-testid="image-translation-file-input"]') as HTMLInputElement
    Object.defineProperty(input, "files", {
      configurable: true,
      value: [file],
    })
    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }))
      await flushAppEffects()
    })
  }

  it("extracts OCR text, translates lines, and renders approximate overlay with bbox fallback rows", async () => {
    const file = new File(["<svg><text>Hello Astra</text><text>Note without box</text></svg>"], "hello.svg", { type: "image/svg+xml" })
    await upload(file)

    expect(extractTextFromImageFileMock).toHaveBeenCalledWith(file)
    expect(translateTextsMock).toHaveBeenCalledWith(expect.objectContaining({
      texts: ["Hello Astra", "Note without box"],
      targetLang: "ja",
      task: "translate",
    }))
    expect(container.querySelector('[data-testid="image-translation-result-panel"]')).toBeTruthy()
    expect(container.querySelector('[data-testid="image-translation-quality-tier-card"]')?.getAttribute("data-quality-tier")).toBe("tier_2")
    expect(container.querySelector('[data-testid="image-translation-quality-tier-card"]')?.textContent).toContain("Quality Tier v1")
    expect(container.querySelector('[data-testid="image-translation-quality-tier-card"]')?.textContent).toContain("Compare recommended")
    expect(container.querySelector('[data-testid="image-translation-overlay-box"]')?.textContent).toContain("こんにちは Astra")
    expect(container.querySelector('[data-testid="image-translation-overlay-quality-summary"]')?.textContent).toContain("1/2 row(s) safe")
    expect(container.querySelector('[data-testid="image-translation-overlay-fallback-rows"]')?.textContent).toContain("Note without box")
    expect(container.querySelector('[data-testid="image-translation-overlay-reason-missing_bbox"]')?.textContent).toContain("No OCR box")
    expect(container.textContent).toContain("Translated overlay is approximate")
    expect(container.textContent).toContain("Compare rows")

    const compareButton = container.querySelector('[data-testid="image-translation-mode-compare"]') as HTMLButtonElement
    await act(async () => {
      compareButton.click()
      await Promise.resolve()
    })

    expect(container.querySelector('[data-testid="image-translation-compare-panel"]')).toBeTruthy()
    expect(container.textContent).toContain("Hello Astra")
    expect(container.textContent).toContain("こんにちは Astra")
  })

  it("renders Dual Path Marker v1 from OCR runtime route metadata", async () => {
    translateTextsMock.mockResolvedValueOnce({
      ok: true,
      translations: ["こんにちは Astra", "メモ"],
      pathSummary: createPathSummary(),
    })

    await upload(new File(["<svg><text>Hello Astra</text><text>Note without box</text></svg>"], "path-marker.svg", { type: "image/svg+xml" }))

    const card = container.querySelector('[data-testid="image-translation-path-marker-card"]')
    expect(card?.getAttribute("data-path-marker-version")).toBe("1")
    expect(card?.getAttribute("data-path-marker-kinds")).toBe("basic_direct enhanced_relay fallback")
    expect(card?.textContent).toContain("Path used · Dual Path Marker v1")
    expect(card?.textContent).toContain("Basic/direct path")
    expect(card?.textContent).toContain("Enhanced/Astra relay path")
    expect(card?.textContent).toContain("Fallback path")
    expect(card?.textContent).toContain("Direct failed; Astra relay completed the batch.")
  })

  it("renders only safe overlay rows and badges every risky fallback reason", async () => {
    extractTextFromImageFileMock.mockResolvedValueOnce({
      ok: true,
      text: "Safe row\nMissing box\nInvalid box\nLow confidence\nCollision row\nMissing translation",
      lineCount: 6,
      source: "provided-text",
      lines: [
        { text: "Safe row", bbox: { left: 5, top: 5, width: 20, height: 10 }, confidence: 0.95 },
        { text: "Missing box" },
        { text: "Invalid box", bbox: { left: 98, top: 5, width: 5, height: 10 }, confidence: 0.95 },
        { text: "Low confidence", bbox: { left: 5, top: 24, width: 20, height: 10 }, confidence: 0.2 },
        { text: "Collision row", bbox: { left: 7, top: 7, width: 18, height: 10 }, confidence: 0.95 },
        { text: "Missing translation", bbox: { left: 5, top: 42, width: 20, height: 10 }, confidence: 0.95 },
      ],
    })
    translateTextsMock.mockResolvedValueOnce({ ok: true, translations: ["安全", "箱なし", "無効", "低信頼", "衝突"] })

    await upload(new File(["provided"], "noisy.png", { type: "image/png" }))

    expect(container.querySelectorAll('[data-testid="image-translation-overlay-box"]')).toHaveLength(1)
    expect(container.querySelector('[data-testid="image-translation-quality-tier-card"]')?.getAttribute("data-quality-tier")).toBe("tier_3")
    expect(container.querySelector('[data-testid="image-translation-quality-tier-card"]')?.textContent).toContain("Review required")
    expect(container.querySelector('[data-testid="image-translation-overlay-box"]')?.textContent).toContain("安全")
    expect(container.querySelector('[data-testid="image-translation-overlay-quality-summary"]')?.textContent).toContain("1/6 row(s) safe")
    expect(container.querySelector('[data-testid="image-translation-overlay-quality-summary"]')?.textContent).toContain("5 row(s) kept")
    expect(container.querySelector('[data-testid="image-translation-overlay-reason-missing_bbox"]')).toBeTruthy()
    expect(container.querySelector('[data-testid="image-translation-overlay-reason-invalid_bbox"]')).toBeTruthy()
    expect(container.querySelector('[data-testid="image-translation-overlay-reason-low_confidence"]')).toBeTruthy()
    expect(container.querySelector('[data-testid="image-translation-overlay-reason-collision_risk"]')).toBeTruthy()
    expect(container.querySelector('[data-testid="image-translation-overlay-reason-missing_translation"]')).toBeTruthy()
    expect(container.querySelector('[data-testid="image-translation-overlay-fallback-rows"]')?.textContent).toContain("reason badges")
  })

  it("consumes a context-menu handoff, preloads the image file, and runs the existing pipeline", async () => {
    consumeImageTranslateHandoffMock.mockResolvedValueOnce({
      ok: true,
      handoff: {
        token: "img_ctx",
        imageUrl: "https://example.com/menu.svg",
        pageUrl: "https://example.com/article",
        source: "context-menu-image",
        createdAt: 1,
        expiresAt: 2,
      },
    })
    const fetchMock = vi.fn().mockResolvedValue(createImageFetchResponse("<svg><text>Hello Astra</text></svg>"))
    vi.stubGlobal("fetch", fetchMock)

    await remountAt("/image-translate.html?handoff=img_ctx")
    await act(async () => {
      await flushAppEffects()
    })

    expect(consumeImageTranslateHandoffMock).toHaveBeenCalledWith("img_ctx")
    expect(window.location.search).not.toContain("handoff")
    expect(fetchMock).toHaveBeenCalledWith("https://example.com/menu.svg", expect.objectContaining({
      credentials: "include",
    }))
    const preloadedFile = extractTextFromImageFileMock.mock.calls.at(-1)?.[0] as File
    expect(preloadedFile).toBeInstanceOf(File)
    expect(preloadedFile.name).toBe("menu.svg")
    expect(preloadedFile.type).toBe("image/svg+xml")
    expect(translateTextsMock).toHaveBeenLastCalledWith(expect.objectContaining({ targetLang: "ja" }))
    expect(container.querySelector('[data-testid="image-translation-result-panel"]')).toBeTruthy()
    expect(container.textContent).toContain("こんにちは Astra")
  })

  it("prefers a captured context-menu payload without fetching the original image URL", async () => {
    consumeImageTranslateHandoffMock.mockResolvedValueOnce({
      ok: true,
      handoff: {
        token: "img_captured",
        imageUrl: "https://example.com/private/menu.svg",
        pageUrl: "https://example.com/article",
        source: "context-menu-image",
        captured: {
          dataUrl: "data:image/svg+xml;base64,PHN2Zz48dGV4dD5IZWxsbyBBc3RyYTwvdGV4dD48L3N2Zz4=",
          mimeType: "image/svg+xml",
          fileName: "captured-menu.svg",
          byteLength: 35,
        },
        createdAt: 1,
        expiresAt: 2,
      },
    })
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    await remountAt("/image-translate.html?handoff=img_captured")
    await act(async () => {
      await flushAppEffects()
    })

    expect(fetchMock).not.toHaveBeenCalled()
    const preloadedFile = extractTextFromImageFileMock.mock.calls.at(-1)?.[0] as File
    expect(preloadedFile).toBeInstanceOf(File)
    expect(preloadedFile.name).toBe("captured-menu.svg")
    expect(preloadedFile.type).toBe("image/svg+xml")
    expect(container.querySelector('[data-testid="image-translation-result-panel"]')).toBeTruthy()
  })

  it("falls back to URL fetch when a captured context-menu payload is invalid", async () => {
    consumeImageTranslateHandoffMock.mockResolvedValueOnce({
      ok: true,
      handoff: {
        token: "img_bad_capture",
        imageUrl: "https://example.com/menu.svg",
        source: "context-menu-image",
        captured: {
          dataUrl: "not-a-data-url",
          mimeType: "image/svg+xml",
          fileName: "bad.svg",
        },
        createdAt: 1,
        expiresAt: 2,
      },
    })
    const fetchMock = vi.fn().mockResolvedValue(createImageFetchResponse("<svg><text>Hello Astra</text></svg>"))
    vi.stubGlobal("fetch", fetchMock)

    await remountAt("/image-translate.html?handoff=img_bad_capture")
    await act(async () => {
      await flushAppEffects()
    })

    expect(fetchMock).toHaveBeenCalledWith("https://example.com/menu.svg", expect.objectContaining({
      credentials: "include",
    }))
    const preloadedFile = extractTextFromImageFileMock.mock.calls.at(-1)?.[0] as File
    expect(preloadedFile.name).toBe("menu.svg")
    expect(container.querySelector('[data-testid="image-translation-result-panel"]')).toBeTruthy()
  })

  it("shows explicit fallback when a context-menu handoff is invalid or expired", async () => {
    consumeImageTranslateHandoffMock.mockResolvedValueOnce({ ok: false, reason: "expired" })
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    await remountAt("/image-translate.html?handoff=expired")
    await act(async () => {
      await flushAppEffects()
    })

    expect(container.querySelector('[data-testid="image-translation-error"]')).toBeTruthy()
    expect(container.textContent).toContain("Reason: handoff_invalid")
    expect(container.textContent).toContain("Right-click the image again, or upload/paste it here instead")
    expect(fetchMock).not.toHaveBeenCalled()
    expect(extractTextFromImageFileMock).not.toHaveBeenCalled()
  })

  it("shows explicit fallback when context-menu image preload fetch fails", async () => {
    consumeImageTranslateHandoffMock.mockResolvedValueOnce({
      ok: true,
      handoff: {
        token: "img_ctx",
        imageUrl: "https://example.com/private.png",
        source: "context-menu-image",
        createdAt: 1,
        expiresAt: 2,
      },
    })
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("blocked")))

    await remountAt("/image-translate.html?handoff=img_ctx")
    await act(async () => {
      await flushAppEffects()
    })

    expect(container.querySelector('[data-testid="image-translation-error"]')).toBeTruthy()
    expect(container.textContent).toContain("Reason: handoff_fetch_failed")
    expect(container.textContent).toContain("Upload or paste the image here instead")
    expect(extractTextFromImageFileMock).not.toHaveBeenCalled()
  })

  it("shows explicit OCR failure taxonomy copy", async () => {
    extractTextFromImageFileMock.mockResolvedValueOnce({
      ok: false,
      reason: "ocr_unavailable",
      message: "OCR is not available in this browser build yet.",
    })

    await upload(new File(["pixels"], "screen.png", { type: "image/png" }))

    expect(container.querySelector('[data-testid="image-translation-error"]')).toBeTruthy()
    expect(container.textContent).toContain("Reason: ocr_unavailable")
    expect(container.textContent).toContain("OCR is not available in this browser build yet.")
    expect(translateTextsMock).not.toHaveBeenCalled()
  })
})
