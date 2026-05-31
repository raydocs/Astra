import { act } from "react"
import ReactDOM from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createMockBrowser, setMockBrowser } from "../../../test/utils/mockBrowser"
import { createTranslationPathMarker, summarizeTranslationPathMarkers } from "@/utils/providers/routing-metadata"
import { PdfReaderApp } from "./PdfReaderApp"
import { shouldShowDebugDiagnostics } from "@/utils/dev-diagnostics"

const { extractPdfPagesMock, translatePdfPageMock, consumeDocumentFileHandoffMock, readDocumentFileBytesMock } = vi.hoisted(() => ({
  extractPdfPagesMock: vi.fn(),
  translatePdfPageMock: vi.fn(),
  consumeDocumentFileHandoffMock: vi.fn(),
  readDocumentFileBytesMock: vi.fn(),
}))

vi.mock("./pdf-extractor", () => ({
  extractPdfPages: extractPdfPagesMock,
}))

vi.mock("./pdf-translator", () => ({
  translatePdfPage: translatePdfPageMock,
}))

vi.mock("@/utils/reading/document-file-handoff", () => ({
  consumeDocumentFileHandoff: consumeDocumentFileHandoffMock,
  describeDocumentFileHandoffFailure: (reason: string, fileName?: string | null) => {
    if (reason === "missing") return `Astra could not find the one-time local handoff for ${fileName ?? "the local file"}. Choose the same file again to continue.`
    return `handoff ${reason}: ${fileName ?? "choose the same file again"}`
  },
  readDocumentFileBytes: readDocumentFileBytesMock,
  DOCUMENT_FILE_HANDOFF_FAILURE_QUERY_PARAM: "handoffFailure",
  DOCUMENT_FILE_HANDOFF_QUERY_PARAM: "handoffToken",
}))

vi.mock("@/utils/dev-diagnostics", () => ({
  shouldShowDebugDiagnostics: vi.fn(() => true),
}))

function createPdfPage(text: string, pageNumber = 1) {
  return {
    pageNumber,
    width: 600,
    height: 800,
    blocks: [
      { text, x: 10, y: 20, width: 120, height: 16 },
    ],
  }
}

function createTranslations(sourceText: string, translation: string) {
  return {
    translations: [
      { sourceIndex: 0, sourceText, translation },
    ],
  }
}

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

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })
  return { promise, resolve, reject }
}

describe("PdfReaderApp", () => {
  let container: HTMLDivElement
  let root: ReactDOM.Root

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.mocked(shouldShowDebugDiagnostics).mockReturnValue(true)
    window.history.replaceState(null, "", "/pdf-reader.html")
    setMockBrowser(createMockBrowser())
    extractPdfPagesMock.mockResolvedValue([
      {
        pageNumber: 1,
        width: 600,
        height: 800,
        blocks: [
          { text: "Bonjour Astra", x: 10, y: 20, width: 120, height: 16 },
          { text: "Menu du jour", x: 10, y: 44, width: 110, height: 16 },
        ],
      },
    ])
    translatePdfPageMock.mockResolvedValue({
      translations: [
        { sourceIndex: 0, sourceText: "Bonjour Astra", translation: "你好 Astra" },
        { sourceIndex: 1, sourceText: "Menu du jour", translation: "今日菜单" },
      ],
    })
    consumeDocumentFileHandoffMock.mockResolvedValue({ ok: false, reason: "invalid" })
    readDocumentFileBytesMock.mockResolvedValue(new TextEncoder().encode("%PDF-1.4"))
    container = document.createElement("div")
    document.body.appendChild(container)
    root = ReactDOM.createRoot(container)

    await act(async () => {
      root.render(<PdfReaderApp />)
      await Promise.resolve()
    })
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
      await Promise.resolve()
    })
    container.remove()
  })

  async function flushAppEffects() {
    await Promise.resolve()
    await Promise.resolve()
    await new Promise((resolve) => setTimeout(resolve, 25))
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
      root.render(<PdfReaderApp />)
      await flushAppEffects()
    })
  }

  async function upload(file: File) {
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    if (typeof file.arrayBuffer !== "function") {
      Object.defineProperty(file, "arrayBuffer", {
        configurable: true,
        value: vi.fn(async () => new TextEncoder().encode("%PDF-1.4").buffer),
      })
    }
    Object.defineProperty(input, "files", {
      configurable: true,
      value: [file],
    })

    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }))
      await flushAppEffects()
    })
  }

  function dispatchDrop(file: File) {
    const app = container.firstElementChild as HTMLDivElement
    const event = new Event("drop", { bubbles: true, cancelable: true })
    Object.defineProperty(event, "dataTransfer", {
      configurable: true,
      value: { files: [file] },
    })
    app.dispatchEvent(event)
  }

  async function flushMicrotasks(count = 5) {
    for (let i = 0; i < count; i++) {
      await Promise.resolve()
    }
  }

  it("consumes a local file handoff token and opens without manual reselect", async () => {
    const handoffFile = new File(["%PDF-1.4"], "handoff.pdf", { type: "application/pdf" })
    consumeDocumentFileHandoffMock.mockResolvedValueOnce({ ok: true, file: handoffFile, handoff: { token: "doc_pdf" } })

    await remountAt(`/pdf-reader.html?handoffToken=doc_pdf&reopenHint=${encodeURIComponent("Choose handoff.pdf")}`)

    expect(consumeDocumentFileHandoffMock).toHaveBeenCalledWith("doc_pdf", "pdf")
    expect(readDocumentFileBytesMock).toHaveBeenCalledWith(handoffFile)
    expect(extractPdfPagesMock).toHaveBeenCalledOnce()
    expect(container.textContent).toContain("Opened handoff.pdf from Document Intake local handoff")
    expect(container.textContent).toContain("Bonjour Astra")
    expect(container.textContent).not.toContain("Drop a PDF file here or click to select")
  })

  it("shows an explicit manual fallback when handoff expired", async () => {
    consumeDocumentFileHandoffMock.mockResolvedValueOnce({ ok: false, reason: "missing" })
    await remountAt(`/pdf-reader.html?handoffToken=missing-token&reopenHint=${encodeURIComponent("paper.pdf")}`)

    expect(container.textContent).toContain("could not find the one-time local handoff")
    expect(container.textContent).toContain("paper.pdf")
    expect(extractPdfPagesMock).not.toHaveBeenCalled()
  })

  it("renders Quality Tier v1 when every extracted PDF block has a translation", async () => {
    await upload(new File(["%PDF-1.4"], "menu.pdf", { type: "application/pdf" }))

    expect(extractPdfPagesMock).toHaveBeenCalledOnce()
    expect(translatePdfPageMock).toHaveBeenCalledOnce()
    expect(container.textContent).toContain("Bonjour Astra")
    expect(container.textContent).toContain("你好 Astra")
    const card = container.querySelector('[data-testid="pdf-reader-quality-tier-card"]')
    expect(card?.getAttribute("data-quality-tier")).toBe("tier_1")
    expect(card?.textContent).toContain("Quality Tier v1")
    expect(card?.textContent).toContain("Every extracted PDF block")
    expect(card?.textContent).toContain("2/2 extracted block")
  })

  it("marks incomplete completed PDF translations as review-required", async () => {
    translatePdfPageMock.mockResolvedValueOnce({
      translations: [
        { sourceIndex: 0, sourceText: "Bonjour Astra", translation: "你好 Astra" },
      ],
    })

    await upload(new File(["%PDF-1.4"], "partial.pdf", { type: "application/pdf" }))

    const card = container.querySelector('[data-testid="pdf-reader-quality-tier-card"]')
    expect(card?.getAttribute("data-quality-tier")).toBe("tier_3")
    expect(card?.textContent).toContain("Review PDF extraction")
    expect(card?.textContent).toContain("1/2 extracted block")
  })

  it("does not treat intentionally skipped tiny PDF blocks as missing translations", async () => {
    extractPdfPagesMock.mockResolvedValueOnce([
      {
        pageNumber: 1,
        width: 600,
        height: 800,
        blocks: [
          { text: "Bonjour Astra", x: 10, y: 20, width: 120, height: 16 },
          { text: "p.1", x: 290, y: 780, width: 16, height: 8 },
          { text: "Menu du jour", x: 10, y: 44, width: 110, height: 16 },
        ],
      },
    ])
    translatePdfPageMock.mockResolvedValueOnce({
      translations: [
        { sourceIndex: 0, sourceText: "Bonjour Astra", translation: "你好 Astra" },
        { sourceIndex: 2, sourceText: "Menu du jour", translation: "今日菜单" },
      ],
    })

    await upload(new File(["%PDF-1.4"], "tiny-block.pdf", { type: "application/pdf" }))

    expect(container.textContent).toContain("p.1")
    const card = container.querySelector('[data-testid="pdf-reader-quality-tier-card"]')
    expect(card?.getAttribute("data-quality-tier")).toBe("tier_1")
    expect(card?.textContent).toContain("Every extracted PDF block")
    expect(card?.textContent).toContain("2/2 extracted block")
  })

  it("renders Dual Path Marker v1 from PDF runtime route metadata", async () => {
    translatePdfPageMock.mockResolvedValueOnce({
      translations: [
        { sourceIndex: 0, sourceText: "Bonjour Astra", translation: "你好 Astra" },
        { sourceIndex: 1, sourceText: "Menu du jour", translation: "今日菜单" },
      ],
      pathSummary: createPathSummary(),
    })

    await upload(new File(["%PDF-1.4"], "path-marker.pdf", { type: "application/pdf" }))

    const card = container.querySelector('[data-testid="pdf-reader-path-marker-card"]')
    expect(card?.getAttribute("data-path-marker-version")).toBe("1")
    expect(card?.getAttribute("data-path-marker-kinds")).toBe("basic_direct enhanced_relay fallback")
    expect(card?.textContent).toContain("Path used · Dual Path Marker v1")
    expect(card?.textContent).toContain("Basic/direct path")
    expect(card?.textContent).toContain("Enhanced/Astra relay path")
    expect(card?.textContent).toContain("Fallback path")
    expect(card?.textContent).toContain("Direct failed; Astra relay completed the batch.")
  })

  it("hides the routing path card from ordinary users when diagnostics are off", async () => {
    vi.mocked(shouldShowDebugDiagnostics).mockReturnValue(false)
    translatePdfPageMock.mockResolvedValueOnce({
      translations: [
        { sourceIndex: 0, sourceText: "Bonjour Astra", translation: "你好 Astra" },
        { sourceIndex: 1, sourceText: "Menu du jour", translation: "今日菜单" },
      ],
      pathSummary: createPathSummary(),
    })

    await upload(new File(["%PDF-1.4"], "path-marker.pdf", { type: "application/pdf" }))

    // The bilingual PDF result still renders; only the relay/direct routing
    // diagnostics card is gated away for ordinary users.
    expect(container.querySelector('[data-testid="pdf-reader-quality-tier-card"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="pdf-reader-path-marker-card"]')).toBeNull()
    expect(container.textContent).not.toContain("Astra relay path")
  })

  it("ignores a stale extraction result after a newer load starts", async () => {
    const staleExtraction = deferred<ReturnType<typeof createPdfPage>[]>()
    extractPdfPagesMock
      .mockReturnValueOnce(staleExtraction.promise)
      .mockResolvedValueOnce([createPdfPage("Fresh PDF text")])
    translatePdfPageMock.mockResolvedValue(createTranslations("Fresh PDF text", "Fresh translation"))

    await act(async () => {
      dispatchDrop(new File(["%PDF-stale"], "stale.pdf", { type: "application/pdf" }))
      await flushMicrotasks()
      dispatchDrop(new File(["%PDF-fresh"], "fresh.pdf", { type: "application/pdf" }))
      await flushAppEffects()
    })

    expect(container.textContent).toContain("fresh.pdf")
    expect(container.textContent).toContain("Fresh PDF text")
    expect(container.textContent).toContain("Fresh translation")

    await act(async () => {
      staleExtraction.resolve([createPdfPage("Stale PDF text")])
      await flushAppEffects()
    })

    expect(container.textContent).toContain("fresh.pdf")
    expect(container.textContent).toContain("Fresh PDF text")
    expect(container.textContent).not.toContain("Stale PDF text")
  })

  it("ignores a stale translation result after a newer load starts", async () => {
    const staleTranslation = deferred<ReturnType<typeof createTranslations>>()
    extractPdfPagesMock
      .mockResolvedValueOnce([createPdfPage("Stale translated text")])
      .mockResolvedValueOnce([createPdfPage("Fresh translated text")])
    translatePdfPageMock
      .mockReturnValueOnce(staleTranslation.promise)
      .mockResolvedValueOnce(createTranslations("Fresh translated text", "Fresh translated output"))

    await act(async () => {
      dispatchDrop(new File(["%PDF-stale"], "stale-translation.pdf", { type: "application/pdf" }))
      await flushMicrotasks()
      dispatchDrop(new File(["%PDF-fresh"], "fresh-translation.pdf", { type: "application/pdf" }))
      await flushAppEffects()
    })

    expect(container.textContent).toContain("fresh-translation.pdf")
    expect(container.textContent).toContain("Fresh translated text")
    expect(container.textContent).toContain("Fresh translated output")

    await act(async () => {
      staleTranslation.resolve(createTranslations("Stale translated text", "Stale translated output"))
      await flushAppEffects()
    })

    expect(container.textContent).toContain("Fresh translated output")
    expect(container.textContent).not.toContain("Stale translated output")
  })

  it("ignores a stale failure after the current load succeeds", async () => {
    const staleExtraction = deferred<ReturnType<typeof createPdfPage>[]>()
    extractPdfPagesMock
      .mockReturnValueOnce(staleExtraction.promise)
      .mockResolvedValueOnce([createPdfPage("Successful current text")])
    translatePdfPageMock.mockResolvedValue(createTranslations("Successful current text", "Successful current output"))

    await act(async () => {
      dispatchDrop(new File(["%PDF-stale"], "stale-failure.pdf", { type: "application/pdf" }))
      await flushMicrotasks()
      dispatchDrop(new File(["%PDF-current"], "current-success.pdf", { type: "application/pdf" }))
      await flushAppEffects()
    })

    await act(async () => {
      staleExtraction.reject(new Error("stale parse failed"))
      await flushAppEffects()
    })

    expect(container.textContent).toContain("current-success.pdf")
    expect(container.textContent).toContain("Successful current text")
    expect(container.textContent).toContain("Successful current output")
    expect(container.textContent).not.toContain("stale parse failed")
  })

  it("ignores a late handoff resolution after a newer user load starts", async () => {
    const handoff = deferred<{ ok: true; file: File; handoff: { token: string } }>()
    const handoffFile = new File(["%PDF-handoff"], "handoff-stale.pdf", { type: "application/pdf" })
    const userFile = new File(["%PDF-user"], "user-current.pdf", { type: "application/pdf" })
    consumeDocumentFileHandoffMock.mockReturnValueOnce(handoff.promise)
    extractPdfPagesMock.mockResolvedValueOnce([createPdfPage("User current text")])
    translatePdfPageMock.mockResolvedValueOnce(createTranslations("User current text", "User current output"))

    await remountAt(`/pdf-reader.html?handoffToken=doc_pdf&reopenHint=${encodeURIComponent("handoff-stale.pdf")}`)
    await upload(userFile)

    await act(async () => {
      handoff.resolve({ ok: true, file: handoffFile, handoff: { token: "doc_pdf" } })
      await flushAppEffects()
    })

    expect(consumeDocumentFileHandoffMock).toHaveBeenCalledWith("doc_pdf", "pdf")
    expect(readDocumentFileBytesMock.mock.calls.some(([file]) => file === userFile)).toBe(true)
    expect(readDocumentFileBytesMock.mock.calls.some(([file]) => file === handoffFile)).toBe(false)
    expect(container.textContent).toContain("user-current.pdf")
    expect(container.textContent).toContain("User current text")
    expect(container.textContent).toContain("User current output")
    expect(container.textContent).not.toContain("Opened handoff-stale.pdf")
  })
})
