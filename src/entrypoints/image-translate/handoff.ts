import { browser } from "#imports"

export const IMAGE_TRANSLATE_HANDOFF_STORAGE_KEY = "astra.imageTranslate.handoffs.v1"
export const IMAGE_TRANSLATE_HANDOFF_TTL_MS = 2 * 60 * 1000
export const IMAGE_TRANSLATE_HANDOFF_QUERY_PARAM = "handoff"

export type ImageTranslateHandoffSource = "context-menu-image"

export interface ImageTranslateCapturedPayload {
  dataUrl: string
  mimeType: string
  fileName?: string
  byteLength?: number
}

export interface ImageTranslateHandoffRecord {
  token: string
  imageUrl: string
  pageUrl?: string
  pageTitle?: string
  source: ImageTranslateHandoffSource
  captured?: ImageTranslateCapturedPayload
  createdAt: number
  expiresAt: number
}

export type ConsumeImageTranslateHandoffResult =
  | { ok: true; handoff: ImageTranslateHandoffRecord }
  | { ok: false; reason: "invalid" | "missing" | "expired" }

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isHandoffRecord(value: unknown): value is ImageTranslateHandoffRecord {
  if (!isObject(value)) return false
  return (
    typeof value.token === "string"
    && typeof value.imageUrl === "string"
    && value.imageUrl.length > 0
    && value.source === "context-menu-image"
    && (value.captured === undefined || isCapturedPayload(value.captured))
    && typeof value.createdAt === "number"
    && typeof value.expiresAt === "number"
  )
}

function isCapturedPayload(value: unknown): value is ImageTranslateCapturedPayload {
  if (!isObject(value)) return false
  return (
    typeof value.dataUrl === "string"
    && value.dataUrl.startsWith("data:image/")
    && typeof value.mimeType === "string"
    && value.mimeType.startsWith("image/")
    && (value.fileName === undefined || typeof value.fileName === "string")
    && (value.byteLength === undefined || typeof value.byteLength === "number")
  )
}

function normalizeStore(value: unknown, now: number): Record<string, ImageTranslateHandoffRecord> {
  if (!isObject(value)) return {}

  const entries = Object.entries(value)
    .filter((entry): entry is [string, ImageTranslateHandoffRecord] => isHandoffRecord(entry[1]))
    .filter(([token, handoff]) => token === handoff.token && handoff.expiresAt > now)

  return Object.fromEntries(entries)
}

async function readHandoffStore(now: number): Promise<Record<string, ImageTranslateHandoffRecord>> {
  const stored = await browser.storage.local.get(IMAGE_TRANSLATE_HANDOFF_STORAGE_KEY) as Record<string, unknown>
  return normalizeStore(stored[IMAGE_TRANSLATE_HANDOFF_STORAGE_KEY], now)
}

async function writeHandoffStore(store: Record<string, ImageTranslateHandoffRecord>): Promise<void> {
  await browser.storage.local.set({ [IMAGE_TRANSLATE_HANDOFF_STORAGE_KEY]: store })
}

function createHandoffToken(): string {
  const cryptoApi = globalThis.crypto
  if (typeof cryptoApi?.randomUUID === "function") {
    return `img_${cryptoApi.randomUUID()}`
  }

  const bytes = new Uint8Array(16)
  if (typeof cryptoApi?.getRandomValues === "function") {
    cryptoApi.getRandomValues(bytes)
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256)
    }
  }

  return `img_${Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("")}`
}

export async function createImageTranslateHandoff(
  input: {
    imageUrl: string
    pageUrl?: string
    pageTitle?: string
    source?: ImageTranslateHandoffSource
    captured?: ImageTranslateCapturedPayload
  },
  now = Date.now(),
): Promise<ImageTranslateHandoffRecord> {
  const token = createHandoffToken()
  const handoff: ImageTranslateHandoffRecord = {
    token,
    imageUrl: input.imageUrl,
    ...(input.pageUrl ? { pageUrl: input.pageUrl } : {}),
    ...(input.pageTitle ? { pageTitle: input.pageTitle } : {}),
    source: input.source ?? "context-menu-image",
    ...(input.captured ? { captured: input.captured } : {}),
    createdAt: now,
    expiresAt: now + IMAGE_TRANSLATE_HANDOFF_TTL_MS,
  }
  const store = await readHandoffStore(now)
  await writeHandoffStore({ ...store, [token]: handoff })
  return handoff
}

export async function consumeImageTranslateHandoff(
  token: string | null | undefined,
  now = Date.now(),
): Promise<ConsumeImageTranslateHandoffResult> {
  const normalizedToken = token?.trim()
  if (!normalizedToken) return { ok: false, reason: "invalid" }

  const stored = await browser.storage.local.get(IMAGE_TRANSLATE_HANDOFF_STORAGE_KEY) as Record<string, unknown>
  const rawStore = isObject(stored[IMAGE_TRANSLATE_HANDOFF_STORAGE_KEY])
    ? stored[IMAGE_TRANSLATE_HANDOFF_STORAGE_KEY] as Record<string, unknown>
    : {}
  const handoff = rawStore[normalizedToken]
  const nextStore = normalizeStore(rawStore, now)
  delete nextStore[normalizedToken]
  await writeHandoffStore(nextStore)

  if (!isHandoffRecord(handoff) || handoff.token !== normalizedToken) {
    return { ok: false, reason: "missing" }
  }

  if (handoff.expiresAt <= now) {
    return { ok: false, reason: "expired" }
  }

  return { ok: true, handoff }
}
