import { act } from "react"
import ReactDOM from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createMockBrowser, setMockBrowser } from "../../../test/utils/mockBrowser"
import { OWNED_READING_STORAGE_KEY } from "@/utils/storage/owned-reading"
import { DOCUMENT_FILE_HANDOFF_STORAGE_KEY } from "@/utils/reading/document-file-handoff"
import { DocumentIntakeApp } from "./DocumentIntakeApp"

describe("DocumentIntakeApp", () => {
  let container: HTMLDivElement
  let root: ReactDOM.Root
  let browserMock: ReturnType<typeof createMockBrowser>

  beforeEach(async () => {
    browserMock = setMockBrowser(createMockBrowser()) as ReturnType<typeof createMockBrowser>
    browserMock.runtime.getURL.mockImplementation((path: string) => path)
    browserMock.i18n.getMessage.mockImplementation((key: string) => {
      if (key === "vocabulary_actionOpenReadingQueue") return "Open reading queue"
      return key
    })
    browserMock.tabs.create.mockResolvedValue(undefined)
    container = document.createElement("div")
    document.body.appendChild(container)
    root = ReactDOM.createRoot(container)

    await act(async () => {
      root.render(<DocumentIntakeApp />)
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

  async function flushIntakeAsyncWork() {
    await Promise.resolve()
    await Promise.resolve()
    await new Promise((resolve) => setTimeout(resolve, 25))
    await Promise.resolve()
    await Promise.resolve()
  }

  async function upload(file: File) {
    const input = container.querySelector('[data-testid="document-intake-file-input"]') as HTMLInputElement
    Object.defineProperty(input, "files", {
      configurable: true,
      value: [file],
    })

    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }))
      await flushIntakeAsyncWork()
    })
  }

  it("routes a PDF into the existing PDF reader and creates owned-reading queue continuity", async () => {
    await upload(new File(["%PDF-1.4"], "paper.pdf", { type: "application/pdf" }))

    expect(container.querySelector('[data-testid="document-intake-quality-tier-note"]')?.textContent).toContain("Quality Tier v1")
    expect(container.querySelector('[data-testid="document-intake-ready"]')?.textContent).toContain("paper.pdf")
    expect(container.textContent).toContain("Saved to Reading queue")
    expect(container.textContent).toContain("Short-lived local handoff ready")
    expect(container.textContent).toContain("File bytes stay local and are not synced")
    expect(browserMock.tabs.create).toHaveBeenCalledWith({
      url: expect.stringContaining("/pdf-reader.html?reopenHint="),
    })
    expect(browserMock.tabs.create).toHaveBeenCalledWith({
      url: expect.stringContaining("handoffToken=doc_"),
    })
    expect(browserMock.runtime.sendMessage).toHaveBeenCalledWith({
      type: "runtime/learning-continuity-sync",
      reason: "document-intake-owned-reading",
    })

    const store = browserMock.__storage[OWNED_READING_STORAGE_KEY] as { items: Array<{ sourceType: string; title: string; localUri?: string; reopenHint?: string; status: string }> }
    expect(store.items).toHaveLength(1)
    expect(store.items[0]).toEqual(expect.objectContaining({
      sourceType: "pdf",
      title: "paper.pdf",
      localUri: "astra-local://pdf/paper.pdf",
      status: "in_progress",
    }))
    expect(store.items[0]?.reopenHint).toContain("paper.pdf")
    expect(JSON.stringify(store.items)).not.toContain("%PDF-1.4")
    const handoffStore = browserMock.__storage[DOCUMENT_FILE_HANDOFF_STORAGE_KEY] as Record<string, { fileName: string; bytesBase64: string }>
    const handoff = Object.values(handoffStore)[0]
    expect(handoff).toEqual(expect.objectContaining({ fileName: "paper.pdf" }))
    expect(handoff.bytesBase64).toBeTruthy()
  })

  it("routes VTT subtitles to the subtitle reader and can open the Reading queue", async () => {
    await upload(new File(["WEBVTT\n\n00:00.000 --> 00:01.000\nHello"], "captions.vtt", { type: "text/vtt" }))

    expect(container.querySelector('[data-testid="document-intake-ready"]')?.textContent).toContain("VTT")
    expect(browserMock.tabs.create).toHaveBeenCalledWith({
      url: expect.stringContaining("/subtitle-reader.html?reopenHint="),
    })
    expect(browserMock.tabs.create).toHaveBeenCalledWith({
      url: expect.stringContaining("handoffToken=doc_"),
    })

    const queueButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Open reading queue") as HTMLButtonElement
    expect(queueButton).toBeTruthy()
    await act(async () => {
      queueButton.click()
      await Promise.resolve()
    })

    expect(browserMock.tabs.create).toHaveBeenCalledWith({ url: "/vocabulary.html?tab=reading" })
    const store = browserMock.__storage[OWNED_READING_STORAGE_KEY] as { items: Array<{ sourceType: string; title: string; localUri?: string; status: string }> }
    expect(store.items[0]).toEqual(expect.objectContaining({
      sourceType: "subtitle-file",
      title: "captions.vtt · VTT · 0 items",
      localUri: "astra-local://subtitle/captions.vtt",
      status: "in_progress",
    }))
  })

  it("falls back to manual reselect with an explicit oversize reason", async () => {
    const bytes = new Uint8Array(5 * 1024 * 1024 + 1)
    await upload(new File([bytes], "huge.pdf", { type: "application/pdf" }))

    expect(container.querySelector('[data-testid="document-intake-ready"]')?.textContent).toContain("huge.pdf")
    expect(container.textContent).toContain("above the local handoff size limit")
    expect(browserMock.tabs.create).toHaveBeenCalledWith({
      url: expect.stringContaining("handoffFailure=oversize"),
    })
    expect(browserMock.__storage[DOCUMENT_FILE_HANDOFF_STORAGE_KEY]).toBeUndefined()
    const store = browserMock.__storage[OWNED_READING_STORAGE_KEY] as { items: Array<{ title: string }> }
    expect(JSON.stringify(store.items)).not.toContain("bytesBase64")
  })

  it("shows an unsupported-file error without opening a reader", async () => {
    await upload(new File(["hello"], "notes.docx", { type: "application/docx" }))

    expect(container.querySelector('[data-testid="document-intake-error"]')?.textContent).toContain("Unsupported file type")
    expect(browserMock.tabs.create).not.toHaveBeenCalled()
    expect(browserMock.__storage[OWNED_READING_STORAGE_KEY]).toBeUndefined()
  })
})
