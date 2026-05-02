import { browser } from "#imports"

export const DOCUMENT_FILE_HANDOFF_STORAGE_KEY = "astra.documentFileHandoffs.v1"
export const DOCUMENT_FILE_HANDOFF_TTL_MS = 2 * 60 * 1000
export const DOCUMENT_FILE_HANDOFF_MAX_BYTES = 5 * 1024 * 1024
export const DOCUMENT_FILE_HANDOFF_QUERY_PARAM = "handoffToken"
export const DOCUMENT_FILE_HANDOFF_FAILURE_QUERY_PARAM = "handoffFailure"

export type DocumentFileHandoffKind = "pdf" | "epub" | "subtitle"
export type DocumentFileHandoffFailureReason = "invalid" | "missing" | "expired" | "oversize" | "corrupt" | "storage_error"

export interface DocumentFileHandoffRecord {
  token: string
  kind: DocumentFileHandoffKind
  fileName: string
  mimeType: string
  byteLength: number
  bytesBase64: string
  createdAt: number
  expiresAt: number
}

export type CreateDocumentFileHandoffResult =
  | { ok: true; handoff: DocumentFileHandoffRecord }
  | { ok: false; reason: Extract<DocumentFileHandoffFailureReason, "oversize" | "storage_error">; message: string }

export type ConsumeDocumentFileHandoffResult =
  | { ok: true; file: File; handoff: Omit<DocumentFileHandoffRecord, "bytesBase64"> }
  | { ok: false; reason: Exclude<DocumentFileHandoffFailureReason, "oversize"> }

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isDocumentFileHandoffKind(value: unknown): value is DocumentFileHandoffKind {
  return value === "pdf" || value === "epub" || value === "subtitle"
}

function isHandoffRecord(value: unknown): value is DocumentFileHandoffRecord {
  if (!isObject(value)) return false
  return (
    typeof value.token === "string"
    && isDocumentFileHandoffKind(value.kind)
    && typeof value.fileName === "string"
    && value.fileName.trim().length > 0
    && typeof value.mimeType === "string"
    && typeof value.byteLength === "number"
    && value.byteLength > 0
    && value.byteLength <= DOCUMENT_FILE_HANDOFF_MAX_BYTES
    && typeof value.bytesBase64 === "string"
    && value.bytesBase64.length > 0
    && typeof value.createdAt === "number"
    && typeof value.expiresAt === "number"
  )
}

function normalizeStore(value: unknown, now: number): Record<string, DocumentFileHandoffRecord> {
  if (!isObject(value)) return {}

  return Object.fromEntries(
    Object.entries(value)
      .filter((entry): entry is [string, DocumentFileHandoffRecord] => isHandoffRecord(entry[1]))
      .filter(([token, handoff]) => token === handoff.token && handoff.expiresAt > now),
  )
}

async function readHandoffStore(now: number): Promise<Record<string, DocumentFileHandoffRecord>> {
  const stored = await browser.storage.local.get(DOCUMENT_FILE_HANDOFF_STORAGE_KEY) as Record<string, unknown>
  return normalizeStore(stored[DOCUMENT_FILE_HANDOFF_STORAGE_KEY], now)
}

async function writeHandoffStore(store: Record<string, DocumentFileHandoffRecord>): Promise<void> {
  await browser.storage.local.set({ [DOCUMENT_FILE_HANDOFF_STORAGE_KEY]: store })
}

function scheduleHandoffExpiry(token: string, expiresAt: number): void {
  if (typeof setTimeout !== "function") return
  const delay = Math.max(0, expiresAt - Date.now())
  const timer = setTimeout(() => {
    void purgeExpiredDocumentFileHandoffs(Date.now(), token)
  }, delay)
  ;(timer as { unref?: () => void }).unref?.()
}

function createHandoffToken(): string {
  const cryptoApi = globalThis.crypto
  if (typeof cryptoApi?.randomUUID === "function") {
    return `doc_${cryptoApi.randomUUID()}`
  }

  const bytes = new Uint8Array(16)
  if (typeof cryptoApi?.getRandomValues === "function") {
    cryptoApi.getRandomValues(bytes)
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256)
    }
  }

  return `doc_${Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("")}`
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ""
  const chunkSize = 0x8000
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize)
    binary += String.fromCharCode(...chunk)
  }
  return btoa(binary)
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

export async function readDocumentFileBytes(file: File): Promise<Uint8Array> {
  if (typeof file.arrayBuffer === "function") {
    return new Uint8Array(await file.arrayBuffer())
  }

  if (typeof file.text === "function") {
    return new TextEncoder().encode(await file.text())
  }

  if (typeof FileReader !== "undefined") {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onerror = () => reject(reader.error ?? new Error("Could not read local file handoff bytes."))
      reader.onload = () => {
        if (reader.result instanceof ArrayBuffer) {
          resolve(new Uint8Array(reader.result))
          return
        }
        if (typeof reader.result === "string") {
          resolve(new TextEncoder().encode(reader.result))
          return
        }
        reject(new Error("Could not read local file handoff bytes."))
      }
      reader.readAsArrayBuffer(file)
    })
  }

  throw new Error("This browser cannot read local file handoff bytes.")
}

function cloneRecordWithoutBytes(record: DocumentFileHandoffRecord): Omit<DocumentFileHandoffRecord, "bytesBase64"> {
  const { bytesBase64: _bytesBase64, ...metadata } = record
  return metadata
}

export async function purgeExpiredDocumentFileHandoffs(now = Date.now(), tokenToRemove?: string): Promise<void> {
  const stored = await browser.storage.local.get(DOCUMENT_FILE_HANDOFF_STORAGE_KEY) as Record<string, unknown>
  const rawStore = isObject(stored[DOCUMENT_FILE_HANDOFF_STORAGE_KEY])
    ? stored[DOCUMENT_FILE_HANDOFF_STORAGE_KEY] as Record<string, unknown>
    : {}
  const nextStore = normalizeStore(rawStore, now)
  if (tokenToRemove) {
    delete nextStore[tokenToRemove]
  }
  await writeHandoffStore(nextStore)
}

export async function createDocumentFileHandoff(
  input: { file: File; kind: DocumentFileHandoffKind },
  now = Date.now(),
): Promise<CreateDocumentFileHandoffResult> {
  if (input.file.size > DOCUMENT_FILE_HANDOFF_MAX_BYTES) {
    return {
      ok: false,
      reason: "oversize",
      message: `This file is ${Math.ceil(input.file.size / 1024 / 1024)} MB, above Astra's ${Math.floor(DOCUMENT_FILE_HANDOFF_MAX_BYTES / 1024 / 1024)} MB local handoff limit.`,
    }
  }

  try {
    const bytes = await readDocumentFileBytes(input.file)
    if (bytes.byteLength > DOCUMENT_FILE_HANDOFF_MAX_BYTES) {
      return {
        ok: false,
        reason: "oversize",
        message: `This file is ${Math.ceil(bytes.byteLength / 1024 / 1024)} MB, above Astra's ${Math.floor(DOCUMENT_FILE_HANDOFF_MAX_BYTES / 1024 / 1024)} MB local handoff limit.`,
      }
    }

    const token = createHandoffToken()
    const handoff: DocumentFileHandoffRecord = {
      token,
      kind: input.kind,
      fileName: input.file.name.trim() || defaultFileName(input.kind),
      mimeType: input.file.type || defaultMimeType(input.kind),
      byteLength: bytes.byteLength,
      bytesBase64: bytesToBase64(bytes),
      createdAt: now,
      expiresAt: now + DOCUMENT_FILE_HANDOFF_TTL_MS,
    }

    const store = await readHandoffStore(now)
    await writeHandoffStore({ ...store, [token]: handoff })
    scheduleHandoffExpiry(token, handoff.expiresAt)
    return { ok: true, handoff }
  } catch (error) {
    return {
      ok: false,
      reason: "storage_error",
      message: error instanceof Error ? error.message : "Astra could not save a local file handoff.",
    }
  }
}

export async function consumeDocumentFileHandoff(
  token: string | null | undefined,
  expectedKind: DocumentFileHandoffKind,
  now = Date.now(),
): Promise<ConsumeDocumentFileHandoffResult> {
  const normalizedToken = token?.trim()
  if (!normalizedToken) return { ok: false, reason: "invalid" }

  let handoff: unknown
  try {
    const stored = await browser.storage.local.get(DOCUMENT_FILE_HANDOFF_STORAGE_KEY) as Record<string, unknown>
    const rawStore = isObject(stored[DOCUMENT_FILE_HANDOFF_STORAGE_KEY])
      ? stored[DOCUMENT_FILE_HANDOFF_STORAGE_KEY] as Record<string, unknown>
      : {}
    handoff = rawStore[normalizedToken]
    const nextStore = normalizeStore(rawStore, now)
    delete nextStore[normalizedToken]
    await writeHandoffStore(nextStore)
  } catch {
    return { ok: false, reason: "storage_error" }
  }

  if (!isHandoffRecord(handoff) || handoff.token !== normalizedToken) {
    return { ok: false, reason: "missing" }
  }

  if (handoff.expiresAt <= now) {
    return { ok: false, reason: "expired" }
  }

  if (handoff.kind !== expectedKind) {
    return { ok: false, reason: "corrupt" }
  }

  try {
    const bytes = base64ToBytes(handoff.bytesBase64)
    if (bytes.byteLength !== handoff.byteLength || bytes.byteLength > DOCUMENT_FILE_HANDOFF_MAX_BYTES) {
      return { ok: false, reason: "corrupt" }
    }
    const blobPart = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
    return {
      ok: true,
      file: new File([blobPart], handoff.fileName, { type: handoff.mimeType }),
      handoff: cloneRecordWithoutBytes(handoff),
    }
  } catch {
    return { ok: false, reason: "corrupt" }
  }
}

export async function readDocumentFileText(file: File): Promise<string> {
  if (typeof file.text === "function") {
    return file.text()
  }
  return new TextDecoder().decode(await readDocumentFileBytes(file))
}

export function describeDocumentFileHandoffFailure(
  reason: DocumentFileHandoffFailureReason,
  fileName?: string | null,
): string {
  const target = fileName?.trim() ? ` ${fileName.trim()}` : " the local file"
  switch (reason) {
    case "expired":
      return `Astra's local handoff for${target} expired. Choose the same file again to continue.`
    case "oversize":
      return `Astra could not auto-open${target} because it is above the local handoff size limit. Choose it manually in this reader.`
    case "missing":
      return `Astra could not find the one-time local handoff for${target}. Choose the same file again to continue.`
    case "corrupt":
      return `Astra could not read the local handoff for${target}. Choose the same file again to continue.`
    case "storage_error":
      return `Astra could not save a local handoff for${target}. Choose it manually in this reader.`
    case "invalid":
    default:
      return `Astra received an invalid local handoff token. Choose the same file again to continue.`
  }
}

function defaultFileName(kind: DocumentFileHandoffKind): string {
  if (kind === "pdf") return "document.pdf"
  if (kind === "epub") return "book.epub"
  return "subtitles.srt"
}

function defaultMimeType(kind: DocumentFileHandoffKind): string {
  if (kind === "pdf") return "application/pdf"
  if (kind === "epub") return "application/epub+zip"
  return "text/plain"
}
