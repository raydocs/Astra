import { browser } from "#imports"
import { z } from "zod"

export const PAGE_ANNOTATIONS_STORAGE_KEY = "astra.page_annotations.v1"
export const MAX_PAGE_ANNOTATIONS = 500

export const PageAnnotationTypeSchema = z.enum(["mark", "highlight", "sticky_note"])
export type PageAnnotationType = z.infer<typeof PageAnnotationTypeSchema>

export const PageAnnotationStateSchema = z.enum(["active", "unresolved"])
export type PageAnnotationState = z.infer<typeof PageAnnotationStateSchema>

export const TextPositionAnchorSchema = z.object({
  start: z.number().int().nonnegative(),
  end: z.number().int().positive(),
})

export const TextQuoteAnchorSchema = z.object({
  exact: z.string().trim().min(1),
  prefix: z.string().optional(),
  suffix: z.string().optional(),
})

export const SelectorAnchorSchema = z.object({
  selector: z.string().trim().min(1),
  textNodeIndex: z.number().int().nonnegative().optional(),
})

export const PageAnnotationAnchorSchema = z.object({
  textPosition: TextPositionAnchorSchema.optional(),
  textQuote: TextQuoteAnchorSchema,
  selector: SelectorAnchorSchema.optional(),
})

export const PageAnnotationUnresolvedAnchorSchema = z.object({
  unresolved: z.boolean(),
  reason: z.string().optional(),
  lastTriedAt: z.number().int().nonnegative().optional(),
})

export const PageAnnotationSchema = z.object({
  id: z.string().trim().min(1),
  pageUrl: z.string().trim().min(1),
  pageOrigin: z.string().trim().min(1),
  pageTitle: z.string().trim().optional(),
  quoteText: z.string().trim().min(1),
  noteText: z.string().trim().optional(),
  type: PageAnnotationTypeSchema,
  state: PageAnnotationStateSchema,
  anchor: PageAnnotationAnchorSchema,
  unresolvedAnchor: PageAnnotationUnresolvedAnchorSchema.optional(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
})

export type PageAnnotation = z.infer<typeof PageAnnotationSchema>
export type PageAnnotationAnchor = z.infer<typeof PageAnnotationAnchorSchema>
export type PageAnnotationUnresolvedAnchor = z.infer<typeof PageAnnotationUnresolvedAnchorSchema>

const PageAnnotationStoreSchema = z.object({
  annotations: z.array(PageAnnotationSchema),
  lastEviction: z.object({
    evictedCount: z.number().int().nonnegative(),
    evictedAt: z.number().int().nonnegative(),
    maxAnnotations: z.number().int().positive(),
  }).optional(),
})

type PageAnnotationStore = z.infer<typeof PageAnnotationStoreSchema>

export interface SavePageAnnotationResult {
  annotation: PageAnnotation
  evictedCount: number
  maxAnnotations: number
}

export function normalizeAnnotationPageUrl(url?: string | null): string | undefined {
  const trimmed = url?.trim()
  if (!trimmed) return undefined

  try {
    const parsed = new URL(trimmed)
    parsed.hash = ""
    return parsed.toString()
  } catch {
    return trimmed
  }
}

export function getAnnotationOrigin(url?: string | null): string | undefined {
  const normalized = normalizeAnnotationPageUrl(url)
  if (!normalized) return undefined

  try {
    return new URL(normalized).origin
  } catch {
    return undefined
  }
}

function normalizeAnnotation(record: PageAnnotation): PageAnnotation | null {
  const parsed = PageAnnotationSchema.safeParse(record)
  if (!parsed.success) return null

  const pageUrl = normalizeAnnotationPageUrl(parsed.data.pageUrl)
  const pageOrigin = getAnnotationOrigin(pageUrl) ?? parsed.data.pageOrigin.trim()
  const quoteText = parsed.data.quoteText.trim()
  if (!pageUrl || !pageOrigin || !quoteText) return null

  const state: PageAnnotationState = parsed.data.unresolvedAnchor?.unresolved ? "unresolved" : parsed.data.state

  return PageAnnotationSchema.parse({
    ...parsed.data,
    pageUrl,
    pageOrigin,
    pageTitle: parsed.data.pageTitle?.trim() || undefined,
    quoteText,
    noteText: parsed.data.noteText?.trim() || undefined,
    state,
  })
}

function normalizeAnnotations(records: PageAnnotation[]): PageAnnotation[] {
  const byId = new Map<string, PageAnnotation>()
  for (const record of records) {
    const normalized = normalizeAnnotation(record)
    if (!normalized) continue
    const existing = byId.get(normalized.id)
    if (!existing || normalized.updatedAt >= existing.updatedAt) {
      byId.set(normalized.id, normalized)
    }
  }

  return [...byId.values()]
    .sort((left, right) => right.updatedAt - left.updatedAt || right.createdAt - left.createdAt)
}

function enforceCap(records: PageAnnotation[]): { annotations: PageAnnotation[]; evictedCount: number } {
  const normalized = normalizeAnnotations(records)
  if (normalized.length <= MAX_PAGE_ANNOTATIONS) {
    return { annotations: normalized, evictedCount: 0 }
  }

  return {
    annotations: normalized.slice(0, MAX_PAGE_ANNOTATIONS),
    evictedCount: normalized.length - MAX_PAGE_ANNOTATIONS,
  }
}

async function readStore(): Promise<PageAnnotationStore> {
  const raw = await browser.storage.local.get(PAGE_ANNOTATIONS_STORAGE_KEY)
  const parsed = PageAnnotationStoreSchema.safeParse(raw[PAGE_ANNOTATIONS_STORAGE_KEY])
  return parsed.success ? parsed.data : { annotations: [] }
}

async function writeStore(records: PageAnnotation[], explicitEvictedCount = 0): Promise<{ annotations: PageAnnotation[]; evictedCount: number }> {
  const capped = enforceCap(records)
  const evictedCount = Math.max(explicitEvictedCount, capped.evictedCount)
  const store: PageAnnotationStore = {
    annotations: capped.annotations,
    ...(evictedCount > 0
      ? {
          lastEviction: {
            evictedCount,
            evictedAt: Date.now(),
            maxAnnotations: MAX_PAGE_ANNOTATIONS,
          },
        }
      : {}),
  }

  await browser.storage.local.set({ [PAGE_ANNOTATIONS_STORAGE_KEY]: store })
  return { annotations: capped.annotations, evictedCount }
}

export function buildPageAnnotation(params: {
  type: PageAnnotationType
  pageUrl: string
  pageTitle?: string
  quoteText: string
  anchor: PageAnnotationAnchor
  noteText?: string
  now?: number
  id?: string
}): PageAnnotation | null {
  const pageUrl = normalizeAnnotationPageUrl(params.pageUrl)
  const pageOrigin = getAnnotationOrigin(pageUrl)
  const quoteText = params.quoteText.trim()
  if (!pageUrl || !pageOrigin || !quoteText) return null

  const now = params.now ?? Date.now()
  const id = params.id ?? `pa_${now.toString(36)}_${Math.random().toString(36).slice(2, 10)}`

  return PageAnnotationSchema.parse({
    id,
    pageUrl,
    pageOrigin,
    pageTitle: params.pageTitle?.trim() || undefined,
    quoteText,
    noteText: params.noteText?.trim() || undefined,
    type: params.type,
    state: "active",
    anchor: params.anchor,
    createdAt: now,
    updatedAt: now,
  })
}

export async function savePageAnnotation(annotation: PageAnnotation): Promise<SavePageAnnotationResult> {
  const normalized = normalizeAnnotation(annotation)
  if (!normalized) {
    throw new Error("Invalid page annotation.")
  }

  const store = await readStore()
  const withoutExisting = store.annotations.filter((record) => record.id !== normalized.id)
  const written = await writeStore([normalized, ...withoutExisting])
  return {
    annotation: written.annotations.find((record) => record.id === normalized.id) ?? normalized,
    evictedCount: written.evictedCount,
    maxAnnotations: MAX_PAGE_ANNOTATIONS,
  }
}

export async function listPageAnnotations(pageUrl?: string): Promise<PageAnnotation[]> {
  const store = await readStore()
  const annotations = normalizeAnnotations(store.annotations)
  const normalizedPageUrl = normalizeAnnotationPageUrl(pageUrl)
  if (!normalizedPageUrl) return annotations
  return annotations.filter((annotation) => annotation.pageUrl === normalizedPageUrl)
}

export async function deletePageAnnotation(annotationId: string): Promise<void> {
  const store = await readStore()
  await writeStore(store.annotations.filter((record) => record.id !== annotationId))
}

export async function markPageAnnotationUnresolved(
  annotationId: string,
  unresolved: PageAnnotationUnresolvedAnchor,
): Promise<PageAnnotation | null> {
  const store = await readStore()
  const annotations = normalizeAnnotations(store.annotations)
  const index = annotations.findIndex((record) => record.id === annotationId)
  if (index === -1) return null

  const current = annotations[index]
  const next = PageAnnotationSchema.parse({
    ...current,
    state: unresolved.unresolved ? "unresolved" : "active",
    unresolvedAnchor: unresolved.unresolved ? unresolved : undefined,
    updatedAt: Math.max(current.updatedAt, unresolved.lastTriedAt ?? Date.now()),
  })
  annotations[index] = next
  await writeStore(annotations)
  return next
}

export async function replacePageAnnotations(records: PageAnnotation[]): Promise<void> {
  await writeStore(records)
}

export async function clearPageAnnotations(): Promise<void> {
  await browser.storage.local.set({ [PAGE_ANNOTATIONS_STORAGE_KEY]: { annotations: [] } })
}
