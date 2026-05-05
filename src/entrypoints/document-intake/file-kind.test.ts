import { describe, expect, it } from "vitest"

import {
  UnsupportedDocumentIntakeError,
  buildDocumentIntakeReopenHint,
  detectDocumentIntakeFileKind,
  documentIntakeAcceptList,
} from "./file-kind"

describe("document intake file-kind detection", () => {
  it.each([
    ["paper.PDF", "application/octet-stream", "pdf", "pdf", "PDF", "/pdf-reader.html"],
    ["book.epub", "", "epub", "epub", "EPUB", "/epub-reader.html"],
    ["captions.srt", "text/plain", "subtitle", "subtitle-file", "SRT", "/subtitle-reader.html"],
    ["captions.vtt", "text/vtt", "subtitle", "subtitle-file", "VTT", "/subtitle-reader.html"],
  ] as const)("detects %s", (name, type, kind, sourceType, label, readerPath) => {
    expect(detectDocumentIntakeFileKind({ name, type })).toEqual({
      kind,
      sourceType,
      extension: name.split(".").pop()?.toLowerCase(),
      label,
      readerPath,
    })
  })

  it("uses MIME fallbacks where the file name is ambiguous", () => {
    expect(detectDocumentIntakeFileKind({ name: "download", type: "application/pdf" }).extension).toBe("pdf")
    expect(detectDocumentIntakeFileKind({ name: "book", type: "application/epub+zip" }).extension).toBe("epub")
    expect(detectDocumentIntakeFileKind({ name: "captions", type: "text/vtt" }).extension).toBe("vtt")
  })

  it("throws an explicit unsupported error", () => {
    expect(() => detectDocumentIntakeFileKind({ name: "notes.docx", type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }))
      .toThrow(UnsupportedDocumentIntakeError)
    expect(() => detectDocumentIntakeFileKind({ name: "notes.docx", type: "" }))
      .toThrow("Choose a PDF, EPUB, SRT, or VTT file")
  })

  it("documents accepted formats and honest reopen hint copy", () => {
    expect(documentIntakeAcceptList()).toContain(".pdf")
    expect(documentIntakeAcceptList()).toContain(".vtt")
    const detection = detectDocumentIntakeFileKind({ name: "captions.vtt", type: "text/vtt" })
    expect(buildDocumentIntakeReopenHint("captions.vtt", detection)).toContain("Choose the same local VTT file")
  })
})
