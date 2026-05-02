import { beforeEach, describe, expect, it } from "vitest"

import { createMockBrowser, setMockBrowser } from "../../../test/utils/mockBrowser"
import {
  consumeDocumentFileHandoff,
  createDocumentFileHandoff,
  describeDocumentFileHandoffFailure,
  readDocumentFileText,
  DOCUMENT_FILE_HANDOFF_MAX_BYTES,
  DOCUMENT_FILE_HANDOFF_STORAGE_KEY,
  DOCUMENT_FILE_HANDOFF_TTL_MS,
  purgeExpiredDocumentFileHandoffs,
} from "./document-file-handoff"

describe("document local file handoff", () => {
  let browserMock: ReturnType<typeof createMockBrowser>

  beforeEach(() => {
    browserMock = setMockBrowser(createMockBrowser()) as ReturnType<typeof createMockBrowser>
  })

  it("creates a short-lived one-shot PDF handoff and reconstructs a File", async () => {
    const now = 10_000
    const file = new File(["%PDF-1.4\nHello"], "paper.pdf", { type: "application/pdf" })
    const created = await createDocumentFileHandoff({ file, kind: "pdf" }, now)

    expect(created.ok).toBe(true)
    if (!created.ok) throw new Error("expected handoff")
    expect(created.handoff.token).toMatch(/^doc_/)
    expect(created.handoff.fileName).toBe("paper.pdf")
    expect(created.handoff.byteLength).toBe(file.size)
    expect(created.handoff.expiresAt).toBe(now + DOCUMENT_FILE_HANDOFF_TTL_MS)
    expect(browserMock.__storage[DOCUMENT_FILE_HANDOFF_STORAGE_KEY]).toEqual({
      [created.handoff.token]: created.handoff,
    })

    const consumed = await consumeDocumentFileHandoff(created.handoff.token, "pdf", now + 1)
    expect(consumed.ok).toBe(true)
    if (!consumed.ok) throw new Error("expected consumed handoff")
    expect(consumed.file.name).toBe("paper.pdf")
    expect(consumed.file.type).toBe("application/pdf")
    expect(await readDocumentFileText(consumed.file)).toBe("%PDF-1.4\nHello")
    expect(consumed.handoff).not.toHaveProperty("bytesBase64")
    expect(browserMock.__storage[DOCUMENT_FILE_HANDOFF_STORAGE_KEY]).toEqual({})

    await expect(consumeDocumentFileHandoff(created.handoff.token, "pdf", now + 2)).resolves.toEqual({
      ok: false,
      reason: "missing",
    })
  })

  it("rejects expired handoffs and prunes bytes", async () => {
    const created = await createDocumentFileHandoff({
      file: new File(["WEBVTT\n\n00:00.000 --> 00:01.000\nHello"], "clip.vtt", { type: "text/vtt" }),
      kind: "subtitle",
    }, 20_000)
    if (!created.ok) throw new Error("expected handoff")

    await expect(consumeDocumentFileHandoff(created.handoff.token, "subtitle", 20_000 + DOCUMENT_FILE_HANDOFF_TTL_MS + 1)).resolves.toEqual({
      ok: false,
      reason: "expired",
    })
    expect(browserMock.__storage[DOCUMENT_FILE_HANDOFF_STORAGE_KEY]).toEqual({})
  })

  it("purges expired unconsumed handoff bytes", async () => {
    const created = await createDocumentFileHandoff({
      file: new File(["private subtitle text"], "private.vtt", { type: "text/vtt" }),
      kind: "subtitle",
    }, 25_000)
    if (!created.ok) throw new Error("expected handoff")
    expect(browserMock.__storage[DOCUMENT_FILE_HANDOFF_STORAGE_KEY]).toEqual({
      [created.handoff.token]: created.handoff,
    })

    await purgeExpiredDocumentFileHandoffs(25_000 + DOCUMENT_FILE_HANDOFF_TTL_MS + 1)

    expect(browserMock.__storage[DOCUMENT_FILE_HANDOFF_STORAGE_KEY]).toEqual({})
  })

  it("returns storage_error when consume cannot access local storage", async () => {
    browserMock.storage.local.get.mockRejectedValueOnce(new Error("storage unavailable"))

    await expect(consumeDocumentFileHandoff("doc_missing", "pdf", 26_000)).resolves.toEqual({
      ok: false,
      reason: "storage_error",
    })
  })

  it("rejects oversized files before storing local bytes", async () => {
    const bytes = new Uint8Array(DOCUMENT_FILE_HANDOFF_MAX_BYTES + 1)
    const result = await createDocumentFileHandoff({
      file: new File([bytes], "huge.epub", { type: "application/epub+zip" }),
      kind: "epub",
    }, 30_000)

    expect(result).toEqual(expect.objectContaining({ ok: false, reason: "oversize" }))
    expect(browserMock.__storage[DOCUMENT_FILE_HANDOFF_STORAGE_KEY]).toBeUndefined()
  })

  it("returns corrupt for mismatched expected reader kind", async () => {
    const created = await createDocumentFileHandoff({
      file: new File(["book"], "book.epub", { type: "application/epub+zip" }),
      kind: "epub",
    }, 40_000)
    if (!created.ok) throw new Error("expected handoff")

    await expect(consumeDocumentFileHandoff(created.handoff.token, "pdf", 40_001)).resolves.toEqual({
      ok: false,
      reason: "corrupt",
    })
    expect(browserMock.__storage[DOCUMENT_FILE_HANDOFF_STORAGE_KEY]).toEqual({})
  })

  it("formats explicit manual reselect reasons", () => {
    expect(describeDocumentFileHandoffFailure("expired", "paper.pdf")).toContain("expired")
    expect(describeDocumentFileHandoffFailure("oversize", "huge.epub")).toContain("above the local handoff size limit")
    expect(describeDocumentFileHandoffFailure("missing")).toContain("Choose the same file again")
  })
})
