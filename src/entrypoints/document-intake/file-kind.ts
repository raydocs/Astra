import type { OwnedReadingSourceType } from "@/utils/storage/owned-reading"

export type DocumentIntakeKind = "pdf" | "epub" | "subtitle"
export type DocumentIntakeExtension = "pdf" | "epub" | "srt" | "vtt"

export interface DocumentIntakeDetection {
  kind: DocumentIntakeKind
  sourceType: Extract<OwnedReadingSourceType, "pdf" | "epub" | "subtitle-file">
  extension: DocumentIntakeExtension
  label: "PDF" | "EPUB" | "SRT" | "VTT"
  readerPath: "/pdf-reader.html" | "/epub-reader.html" | "/subtitle-reader.html"
}

export class UnsupportedDocumentIntakeError extends Error {
  constructor(fileName: string) {
    super(`Unsupported file type for ${fileName || "selected file"}. Choose a PDF, EPUB, SRT, or VTT file.`)
    this.name = "UnsupportedDocumentIntakeError"
  }
}

function extensionFromName(fileName: string): string | null {
  const match = /\.([a-z0-9]+)$/i.exec(fileName.trim())
  return match?.[1]?.toLowerCase() ?? null
}

export function detectDocumentIntakeFileKind(file: Pick<File, "name" | "type">): DocumentIntakeDetection {
  const extension = extensionFromName(file.name)
  const mime = file.type.trim().toLowerCase()

  if (extension === "pdf" || mime === "application/pdf") {
    return {
      kind: "pdf",
      sourceType: "pdf",
      extension: "pdf",
      label: "PDF",
      readerPath: "/pdf-reader.html",
    }
  }

  if (extension === "epub" || mime === "application/epub+zip") {
    return {
      kind: "epub",
      sourceType: "epub",
      extension: "epub",
      label: "EPUB",
      readerPath: "/epub-reader.html",
    }
  }

  if (extension === "srt" || mime === "application/x-subrip") {
    return {
      kind: "subtitle",
      sourceType: "subtitle-file",
      extension: "srt",
      label: "SRT",
      readerPath: "/subtitle-reader.html",
    }
  }

  if (extension === "vtt" || mime === "text/vtt") {
    return {
      kind: "subtitle",
      sourceType: "subtitle-file",
      extension: "vtt",
      label: "VTT",
      readerPath: "/subtitle-reader.html",
    }
  }

  throw new UnsupportedDocumentIntakeError(file.name)
}

export function buildDocumentIntakeReopenHint(fileName: string, detection: DocumentIntakeDetection): string {
  const safeName = fileName.trim() || `document.${detection.extension}`
  switch (detection.kind) {
    case "pdf":
      return `Document Intake saved ${safeName} to Reading queue. Choose the same local PDF in the PDF reader to continue.`
    case "epub":
      return `Document Intake saved ${safeName} to Reading queue. Choose the same local EPUB in the ePub reader to continue.`
    case "subtitle":
      return `Document Intake saved ${safeName} to Reading queue. Choose the same local ${detection.label} file in the subtitle reader to continue.`
  }
}

export function documentIntakeAcceptList(): string {
  return ".pdf,.epub,.srt,.vtt,application/pdf,application/epub+zip,text/vtt,application/x-subrip"
}
