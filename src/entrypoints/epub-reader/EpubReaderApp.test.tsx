import { act } from "react"
import ReactDOM from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mockSection = vi.hoisted(() => ({
  document: new DOMParser().parseFromString("<html><body><p>Hello Astra chapter</p></body></html>", "text/html"),
  load: vi.fn(async () => undefined),
}))

const mockBook = vi.hoisted(() => ({
  ready: Promise.resolve(),
  packaging: { metadata: { title: "Mock Book" } },
  loaded: { navigation: Promise.resolve({ toc: [{ href: "chapter.xhtml", label: "Chapter 1" }] }) },
  spine: { get: vi.fn(() => mockSection) },
  load: vi.fn(),
  destroy: vi.fn(),
}))

const {
  mockBrowser,
  ePubMock,
  upsertOwnedEpubFromImportMock,
  consumeDocumentFileHandoffMock,
} = vi.hoisted(() => ({
  mockBrowser: {
    storage: {
      local: {
        get: vi.fn(async () => ({ "astra.config.v1": { targetLang: "zh-CN" } })),
      },
    },
    runtime: {
      sendMessage: vi.fn(),
      getURL: vi.fn((path: string) => path),
    },
    tabs: {
      create: vi.fn(async () => undefined),
    },
  },
  ePubMock: vi.fn(() => mockBook),
  upsertOwnedEpubFromImportMock: vi.fn(),
  consumeDocumentFileHandoffMock: vi.fn(),
}))

vi.mock("#imports", () => ({
  browser: mockBrowser,
}))

vi.mock("epubjs", () => ({
  default: ePubMock,
}))

vi.mock("@/utils/storage/owned-reading", () => ({
  upsertOwnedEpubFromImport: upsertOwnedEpubFromImportMock,
}))

vi.mock("@/utils/reading/document-file-handoff", () => ({
  consumeDocumentFileHandoff: consumeDocumentFileHandoffMock,
  describeDocumentFileHandoffFailure: (reason: string, fileName?: string | null) => `handoff ${reason}: ${fileName ?? "choose the same file again"}`,
  readDocumentFileBytes: async () => new TextEncoder().encode("epub bytes"),
  DOCUMENT_FILE_HANDOFF_FAILURE_QUERY_PARAM: "handoffFailure",
  DOCUMENT_FILE_HANDOFF_QUERY_PARAM: "handoffToken",
}))

import { EpubReaderApp } from "./EpubReaderApp"

describe("EpubReaderApp", () => {
  let container: HTMLDivElement
  let root: ReactDOM.Root

  beforeEach(() => {
    vi.clearAllMocks()
    window.history.replaceState(null, "", "/epub-reader.html")
    mockBrowser.runtime.sendMessage.mockResolvedValue({
      type: "runtime/translate-batch:success",
      payload: { translations: ["你好 Astra chapter"] },
    })
    consumeDocumentFileHandoffMock.mockResolvedValue({ ok: false, reason: "invalid" })
    upsertOwnedEpubFromImportMock.mockResolvedValue(undefined)
    container = document.createElement("div")
    document.body.appendChild(container)
    root = ReactDOM.createRoot(container)
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
    await Promise.resolve()
  }

  async function renderAt(path: string) {
    window.history.replaceState(null, "", path)
    await act(async () => {
      root.render(<EpubReaderApp />)
      await flushAppEffects()
    })
  }

  it("consumes a local file handoff token and opens the EPUB without manual reselect", async () => {
    const file = new File(["epub bytes"], "handoff.epub", { type: "application/epub+zip" })
    consumeDocumentFileHandoffMock.mockResolvedValueOnce({ ok: true, file, handoff: { token: "doc_epub" } })

    await renderAt("/epub-reader.html?handoffToken=doc_epub&reopenHint=handoff.epub")

    expect(consumeDocumentFileHandoffMock).toHaveBeenCalledWith("doc_epub", "epub")
    expect(ePubMock).toHaveBeenCalledOnce()
    expect(upsertOwnedEpubFromImportMock).toHaveBeenCalledWith(expect.objectContaining({
      fileName: "handoff.epub",
      bookTitle: "Mock Book",
      status: "in_progress",
    }))
    expect(container.textContent).toContain("Opened handoff.epub from Document Intake local handoff")
    expect(container.textContent).toContain("Mock Book")
    expect(container.textContent).toContain("Hello Astra chapter")
    expect(container.textContent).not.toContain("Drop an ePub file here or click to select")
  })

  it("shows explicit manual fallback copy when handoff is missing", async () => {
    consumeDocumentFileHandoffMock.mockResolvedValueOnce({ ok: false, reason: "missing" })

    await renderAt("/epub-reader.html?handoffToken=missing&reopenHint=book.epub")

    expect(container.textContent).toContain("handoff missing: book.epub")
    expect(ePubMock).not.toHaveBeenCalled()
  })
})
