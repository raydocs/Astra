import Dexie from "dexie"
import { z } from "zod"

const RECENT_IMPORTS_STORAGE_KEY = "astra.web.recent-imports.v1"
const TEXT_WORKSPACE_STORAGE_KEY = "astra.web.text-workspace.v1"
const ARTICLE_WORKSPACE_STORAGE_KEY = "astra.web.article-workspace.v1"
const PDF_WORKSPACE_STORAGE_KEY = "astra.web.pdf-workspace.v1"
const EPUB_WORKSPACE_STORAGE_KEY = "astra.web.epub-workspace.v1"
const SUBTITLE_WORKSPACE_STORAGE_KEY = "astra.web.subtitle-workspace.v1"
const ACCOUNT_PREFS_STORAGE_KEY = "astra.web.account-prefs.v1"
const WORKSPACE_DB_NAME = "astra-web-workspaces"

const RecentImportRouteSchema = z.enum(["/articles", "/files/pdf", "/files/epub", "/files/subtitles"])
const RecentImportSourceSchema = z.enum(["article", "pdf", "epub", "subtitle"])
const FileFormatSchema = z.enum(["srt", "vtt", "ass", "markdown", "txt", "html"])
const TextTaskSchema = z.enum(["translate", "explain", "custom"])
const ArticleImportScopeSchema = z.enum(["article", "page"])

function isSafeHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value)
    return parsed.protocol === "http:" || parsed.protocol === "https:"
  } catch {
    return false
  }
}

const RecentWebImportSchema = z.object({
  source: RecentImportSourceSchema,
  route: RecentImportRouteSchema,
  title: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  detail: z.string().trim().min(1),
  importedAt: z.string().trim().min(1),
})

const TextWorkspaceDraftSchema = z.object({
  sourceText: z.string(),
  sourceLang: z.string(),
  targetLang: z.string().trim().min(1),
  task: TextTaskSchema,
  customPrompt: z.string(),
  resultText: z.string(),
  importedDraftTitle: z.string().trim().min(1).nullable().default(null),
  importedDraftSource: RecentImportSourceSchema.nullable().default(null),
  updatedAt: z.string().trim().min(1),
})

const ArticleWorkspaceSnapshotSchema = z.object({
  url: z.string().trim().min(1).refine(isSafeHttpUrl, "Article URL must use http(s)."),
  title: z.string().trim().min(1),
  hostname: z.string().trim().min(1),
  byline: z.string().trim().min(1).nullable().default(null),
  scope: ArticleImportScopeSchema,
  summary: z.string().trim().min(1).nullable().default(null),
  blocks: z.array(z.string().trim().min(1)).default([]),
  importedAt: z.string().trim().min(1),
})

const PdfPagePreviewSchema = z.object({
  pageNumber: z.number().int().positive(),
  excerpt: z.string(),
  blocks: z.array(z.string()),
  blockCount: z.number().int().nonnegative(),
  wordCount: z.number().int().nonnegative(),
})

const PdfWorkspaceSnapshotSchema = z.object({
  fileName: z.string().trim().min(1),
  sizeLabel: z.string().trim().min(1),
  pageCount: z.number().int().nonnegative(),
  selectedPageNumber: z.number().int().positive(),
  pages: z.array(PdfPagePreviewSchema),
  importedAt: z.string().trim().min(1),
})

const EpubChapterItemSchema = z.object({
  href: z.string().trim().min(1),
  label: z.string().trim().min(1),
  depth: z.number().int().nonnegative(),
})

const EpubChapterPreviewSchema = EpubChapterItemSchema.extend({
  paragraphs: z.array(z.string()),
  excerpt: z.string(),
  wordCount: z.number().int().nonnegative(),
})

const EpubWorkspaceSnapshotSchema = z.object({
  fileName: z.string().trim().min(1),
  title: z.string().trim().min(1),
  author: z.string().trim().min(1),
  selectedChapterHref: z.string().trim().min(1).nullable(),
  chapters: z.array(EpubChapterItemSchema),
  loadedChapters: z.array(EpubChapterPreviewSchema),
  importedAt: z.string().trim().min(1),
})

const SubtitleCueSnapshotSchema = z.object({
  index: z.number().int().positive(),
  startTime: z.string().trim().min(1),
  endTime: z.string().trim().min(1),
  text: z.string(),
  rawTimeline: z.string().trim().min(1),
})

const DocumentEntrySnapshotSchema = z.object({
  index: z.number().int().positive(),
  text: z.string(),
})

const TranslationEntrySchema = z.object({
  index: z.number().int().nonnegative(),
  text: z.string(),
})

const SubtitleWorkspaceSnapshotSchema = z.object({
  fileName: z.string().trim().min(1),
  format: FileFormatSchema,
  cues: z.array(SubtitleCueSnapshotSchema).default([]),
  documents: z.array(DocumentEntrySnapshotSchema).default([]),
  translations: z.array(TranslationEntrySchema).default([]),
  importedAt: z.string().trim().min(1),
  lastExportedAt: z.string().trim().min(1).nullable().default(null),
})

const AccountPreferencesSchema = z.object({
  lastEmail: z.string().trim().email().nullable().default(null),
})

const ImportLibraryEntrySchema = z.object({
  source: RecentImportSourceSchema,
  route: RecentImportRouteSchema,
  title: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  detail: z.string().trim().min(1),
  importedAt: z.string().trim().min(1),
})

export type RecentWebImport = z.infer<typeof RecentWebImportSchema>
export type TextWorkspaceDraft = z.infer<typeof TextWorkspaceDraftSchema>
export type ArticleWorkspaceSnapshot = z.infer<typeof ArticleWorkspaceSnapshotSchema>
export type PdfWorkspaceSnapshot = z.infer<typeof PdfWorkspaceSnapshotSchema>
export type EpubChapterItem = z.infer<typeof EpubChapterItemSchema>
export type EpubChapterPreviewSnapshot = z.infer<typeof EpubChapterPreviewSchema>
export type EpubWorkspaceSnapshot = z.infer<typeof EpubWorkspaceSnapshotSchema>
export type SubtitleWorkspaceSnapshot = z.infer<typeof SubtitleWorkspaceSnapshotSchema>
export type ImportLibraryEntry = z.infer<typeof ImportLibraryEntrySchema>

interface WorkspaceRecord {
  key: string
  snapshot: unknown
  updatedAt: number
}

class WorkspaceDB extends Dexie {
  workspaces!: Dexie.Table<WorkspaceRecord, string>

  constructor() {
    super(WORKSPACE_DB_NAME)
    this.version(1).stores({
      workspaces: "&key, updatedAt",
    })
  }
}

const workspaceDb = new WorkspaceDB()
const LARGE_WORKSPACE_KEYS = {
  article: "article",
  pdf: "pdf",
  epub: "epub",
  subtitle: "subtitle",
} as const
const LARGE_WORKSPACE_DEFINITIONS = [
  {
    key: LARGE_WORKSPACE_KEYS.article,
    schema: ArticleWorkspaceSnapshotSchema,
    legacyStorageKey: ARTICLE_WORKSPACE_STORAGE_KEY,
    label: "Article workspace",
  },
  {
    key: LARGE_WORKSPACE_KEYS.pdf,
    schema: PdfWorkspaceSnapshotSchema,
    legacyStorageKey: PDF_WORKSPACE_STORAGE_KEY,
    label: "PDF workspace",
  },
  {
    key: LARGE_WORKSPACE_KEYS.epub,
    schema: EpubWorkspaceSnapshotSchema,
    legacyStorageKey: EPUB_WORKSPACE_STORAGE_KEY,
    label: "EPUB workspace",
  },
  {
    key: LARGE_WORKSPACE_KEYS.subtitle,
    schema: SubtitleWorkspaceSnapshotSchema,
    legacyStorageKey: SUBTITLE_WORKSPACE_STORAGE_KEY,
    label: "Subtitle workspace",
  },
] as const

export interface WorkspaceStorageHealthRecord {
  key: string
  label: string
  indexedDbState: "missing" | "healthy" | "corrupted"
  legacyState: "missing" | "healthy" | "corrupted"
  indexedDbUpdatedAt: number | null
  issues: string[]
}

export interface WorkspaceStorageHealthSnapshot {
  dbName: string
  indexedDbAvailable: boolean
  indexedDbReachable: boolean
  indexedDbRecordCount: number
  legacyStorageKeysPresent: string[]
  records: WorkspaceStorageHealthRecord[]
  corruptedKeys: string[]
}

export interface WorkspaceStorageRepairReport {
  removedIndexedDbKeys: string[]
  clearedLegacyKeys: string[]
  errors: string[]
}

function readStringStorage(key: string): string | null {
  if (typeof window === "undefined") return null

  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStringStorage(key: string, value: string) {
  if (typeof window === "undefined") return

  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Ignore storage failures so the web shell continues to operate.
  }
}

function readJsonStorage<T>(key: string, schema: z.ZodType<T>): T | null {
  const raw = readStringStorage(key)
  if (!raw) return null

  try {
    return schema.parse(JSON.parse(raw))
  } catch {
    return null
  }
}

function writeJsonStorage(key: string, value: unknown) {
  writeStringStorage(key, JSON.stringify(value))
}

function removeStorage(key: string) {
  if (typeof window === "undefined") return

  try {
    window.localStorage.removeItem(key)
  } catch {
    // Ignore removal failures for parity with writes.
  }
}

function parseLegacySnapshot(
  key: string,
  schema: z.ZodType<unknown>,
): { state: "missing" | "healthy" | "corrupted"; issues: string[] } {
  const raw = readStringStorage(key)
  if (!raw) {
    return { state: "missing", issues: [] }
  }

  try {
    const parsed = JSON.parse(raw)
    schema.parse(parsed)
    return { state: "healthy", issues: [] }
  } catch (error) {
    return {
      state: "corrupted",
      issues: [`Legacy localStorage parse failed: ${error instanceof Error ? error.message : "unknown error"}`],
    }
  }
}

async function readLargeWorkspace<T>(
  key: string,
  schema: z.ZodType<T>,
  legacyStorageKey: string,
): Promise<T | null> {
  try {
    const stored = await workspaceDb.workspaces.get(key)
    if (stored) {
      return schema.parse(stored.snapshot)
    }
  } catch {
    // Fall back to legacy localStorage below.
  }

  const legacy = readJsonStorage(legacyStorageKey, schema)
  if (!legacy) {
    return null
  }

  try {
    await workspaceDb.workspaces.put({
      key,
      snapshot: legacy,
      updatedAt: Date.now(),
    })
    removeStorage(legacyStorageKey)
  } catch {
    // Keep the legacy copy when IndexedDB is unavailable.
  }

  return legacy
}

async function saveLargeWorkspace<T>(
  key: string,
  schema: z.ZodType<T>,
  legacyStorageKey: string,
  workspace: T,
): Promise<T> {
  const next = schema.parse(workspace)

  try {
    await workspaceDb.workspaces.put({
      key,
      snapshot: next,
      updatedAt: Date.now(),
    })
    removeStorage(legacyStorageKey)
  } catch {
    try {
      await workspaceDb.workspaces.delete(key)
    } catch {
      // Ignore cleanup failures and fall back to localStorage below.
    }
    writeJsonStorage(legacyStorageKey, next)
  }

  return next
}

async function clearLargeWorkspace(key: string, legacyStorageKey: string): Promise<void> {
  try {
    await workspaceDb.workspaces.delete(key)
  } catch {
    // Ignore IndexedDB removal failures and still clear legacy state.
  }

  removeStorage(legacyStorageKey)
}

export function readRecentImports(): RecentWebImport[] {
  return readJsonStorage(RECENT_IMPORTS_STORAGE_KEY, z.array(RecentWebImportSchema)) ?? []
}

export function saveRecentImport(entry: Omit<RecentWebImport, "importedAt"> & { importedAt?: string }): RecentWebImport[] {
  const importedAt = entry.importedAt ?? new Date().toISOString()
  const nextEntry = RecentWebImportSchema.parse({
    ...entry,
    importedAt,
  })

  const deduped = readRecentImports().filter((item) => item.source !== nextEntry.source)
  const next = [nextEntry, ...deduped].slice(0, 6)
  writeJsonStorage(RECENT_IMPORTS_STORAGE_KEY, next)
  return next
}

export function clearRecentImports() {
  removeStorage(RECENT_IMPORTS_STORAGE_KEY)
}

export function removeRecentImport(source: RecentWebImport["source"]): RecentWebImport[] {
  const next = readRecentImports().filter((item) => item.source !== source)
  writeJsonStorage(RECENT_IMPORTS_STORAGE_KEY, next)
  return next
}

export function readTextWorkspaceDraft(): TextWorkspaceDraft | null {
  return readJsonStorage(TEXT_WORKSPACE_STORAGE_KEY, TextWorkspaceDraftSchema)
}

export function saveTextWorkspaceDraft(draft: Omit<TextWorkspaceDraft, "updatedAt"> & { updatedAt?: string }): TextWorkspaceDraft {
  const next = TextWorkspaceDraftSchema.parse({
    ...draft,
    updatedAt: draft.updatedAt ?? new Date().toISOString(),
  })
  writeJsonStorage(TEXT_WORKSPACE_STORAGE_KEY, next)
  return next
}

export function clearTextWorkspaceDraft() {
  removeStorage(TEXT_WORKSPACE_STORAGE_KEY)
}

export async function readArticleWorkspace(): Promise<ArticleWorkspaceSnapshot | null> {
  return readLargeWorkspace(LARGE_WORKSPACE_KEYS.article, ArticleWorkspaceSnapshotSchema, ARTICLE_WORKSPACE_STORAGE_KEY)
}

export async function saveArticleWorkspace(workspace: ArticleWorkspaceSnapshot): Promise<ArticleWorkspaceSnapshot> {
  return saveLargeWorkspace(LARGE_WORKSPACE_KEYS.article, ArticleWorkspaceSnapshotSchema, ARTICLE_WORKSPACE_STORAGE_KEY, workspace)
}

export async function clearArticleWorkspace(): Promise<void> {
  await clearLargeWorkspace(LARGE_WORKSPACE_KEYS.article, ARTICLE_WORKSPACE_STORAGE_KEY)
}

export async function readPdfWorkspace(): Promise<PdfWorkspaceSnapshot | null> {
  return readLargeWorkspace(LARGE_WORKSPACE_KEYS.pdf, PdfWorkspaceSnapshotSchema, PDF_WORKSPACE_STORAGE_KEY)
}

export async function savePdfWorkspace(workspace: PdfWorkspaceSnapshot): Promise<PdfWorkspaceSnapshot> {
  return saveLargeWorkspace(LARGE_WORKSPACE_KEYS.pdf, PdfWorkspaceSnapshotSchema, PDF_WORKSPACE_STORAGE_KEY, workspace)
}

export async function clearPdfWorkspace(): Promise<void> {
  await clearLargeWorkspace(LARGE_WORKSPACE_KEYS.pdf, PDF_WORKSPACE_STORAGE_KEY)
}

export async function readEpubWorkspace(): Promise<EpubWorkspaceSnapshot | null> {
  return readLargeWorkspace(LARGE_WORKSPACE_KEYS.epub, EpubWorkspaceSnapshotSchema, EPUB_WORKSPACE_STORAGE_KEY)
}

export async function saveEpubWorkspace(workspace: EpubWorkspaceSnapshot): Promise<EpubWorkspaceSnapshot> {
  return saveLargeWorkspace(LARGE_WORKSPACE_KEYS.epub, EpubWorkspaceSnapshotSchema, EPUB_WORKSPACE_STORAGE_KEY, workspace)
}

export async function clearEpubWorkspace(): Promise<void> {
  await clearLargeWorkspace(LARGE_WORKSPACE_KEYS.epub, EPUB_WORKSPACE_STORAGE_KEY)
}

export async function readSubtitleWorkspace(): Promise<SubtitleWorkspaceSnapshot | null> {
  return readLargeWorkspace(LARGE_WORKSPACE_KEYS.subtitle, SubtitleWorkspaceSnapshotSchema, SUBTITLE_WORKSPACE_STORAGE_KEY)
}

export async function saveSubtitleWorkspace(workspace: SubtitleWorkspaceSnapshot): Promise<SubtitleWorkspaceSnapshot> {
  return saveLargeWorkspace(LARGE_WORKSPACE_KEYS.subtitle, SubtitleWorkspaceSnapshotSchema, SUBTITLE_WORKSPACE_STORAGE_KEY, workspace)
}

export async function clearSubtitleWorkspace(): Promise<void> {
  await clearLargeWorkspace(LARGE_WORKSPACE_KEYS.subtitle, SUBTITLE_WORKSPACE_STORAGE_KEY)
}

export async function clearAllPersistedWorkspaces(): Promise<void> {
  await Promise.all([
    clearArticleWorkspace(),
    clearPdfWorkspace(),
    clearEpubWorkspace(),
    clearSubtitleWorkspace(),
  ])
}

export async function inspectWorkspaceStorageHealth(): Promise<WorkspaceStorageHealthSnapshot> {
  let indexedDbReachable = true
  let indexedDbRecordCount = 0

  try {
    indexedDbRecordCount = await workspaceDb.workspaces.count()
  } catch {
    indexedDbReachable = false
  }

  const records: WorkspaceStorageHealthRecord[] = []

  for (const definition of LARGE_WORKSPACE_DEFINITIONS) {
    const issues: string[] = []
    let indexedDbState: WorkspaceStorageHealthRecord["indexedDbState"] = "missing"
    let indexedDbUpdatedAt: number | null = null

    if (indexedDbReachable) {
      try {
        const stored = await workspaceDb.workspaces.get(definition.key)
        if (stored) {
          indexedDbUpdatedAt = stored.updatedAt
          try {
            definition.schema.parse(stored.snapshot)
            indexedDbState = "healthy"
          } catch (error) {
            indexedDbState = "corrupted"
            issues.push(`IndexedDB parse failed: ${error instanceof Error ? error.message : "unknown error"}`)
          }
        }
      } catch (error) {
        indexedDbState = "corrupted"
        issues.push(`IndexedDB read failed: ${error instanceof Error ? error.message : "unknown error"}`)
      }
    }

    const legacy = parseLegacySnapshot(definition.legacyStorageKey, definition.schema)
    issues.push(...legacy.issues)

    records.push({
      key: definition.key,
      label: definition.label,
      indexedDbState,
      legacyState: legacy.state,
      indexedDbUpdatedAt,
      issues,
    })
  }

  return {
    dbName: WORKSPACE_DB_NAME,
    indexedDbAvailable: typeof indexedDB !== "undefined",
    indexedDbReachable,
    indexedDbRecordCount,
    legacyStorageKeysPresent: LARGE_WORKSPACE_DEFINITIONS
      .filter((definition) => readStringStorage(definition.legacyStorageKey) !== null)
      .map((definition) => definition.legacyStorageKey),
    corruptedKeys: records
      .filter((record) => record.indexedDbState === "corrupted" || record.legacyState === "corrupted")
      .map((record) => record.key),
    records,
  }
}

export async function repairWorkspaceStorageCorruption(): Promise<WorkspaceStorageRepairReport> {
  const removedIndexedDbKeys: string[] = []
  const clearedLegacyKeys: string[] = []
  const errors: string[] = []

  for (const definition of LARGE_WORKSPACE_DEFINITIONS) {
    const legacy = parseLegacySnapshot(definition.legacyStorageKey, definition.schema)
    if (legacy.state === "corrupted") {
      try {
        removeStorage(definition.legacyStorageKey)
        clearedLegacyKeys.push(definition.legacyStorageKey)
      } catch (error) {
        errors.push(`Failed to clear legacy ${definition.legacyStorageKey}: ${error instanceof Error ? error.message : "unknown error"}`)
      }
    }

    try {
      const stored = await workspaceDb.workspaces.get(definition.key)
      if (!stored) continue

      try {
        definition.schema.parse(stored.snapshot)
      } catch {
        await workspaceDb.workspaces.delete(definition.key)
        removedIndexedDbKeys.push(definition.key)
      }
    } catch (error) {
      errors.push(`Failed to inspect IndexedDB key ${definition.key}: ${error instanceof Error ? error.message : "unknown error"}`)
    }
  }

  return {
    removedIndexedDbKeys,
    clearedLegacyKeys,
    errors,
  }
}

export async function resetWorkspaceStorageLifecycle(): Promise<void> {
  try {
    workspaceDb.close()
    await workspaceDb.delete()
  } catch {
    // Ignore delete failures and still clear local fallbacks.
  }

  const localKeys = [
    RECENT_IMPORTS_STORAGE_KEY,
    TEXT_WORKSPACE_STORAGE_KEY,
    ARTICLE_WORKSPACE_STORAGE_KEY,
    PDF_WORKSPACE_STORAGE_KEY,
    EPUB_WORKSPACE_STORAGE_KEY,
    SUBTITLE_WORKSPACE_STORAGE_KEY,
  ]

  localKeys.forEach((key) => removeStorage(key))
}

export async function readImportLibrary(): Promise<ImportLibraryEntry[]> {
  const [article, pdf, epub, subtitle] = await Promise.all([
    readArticleWorkspace(),
    readPdfWorkspace(),
    readEpubWorkspace(),
    readSubtitleWorkspace(),
  ])

  const entries: ImportLibraryEntry[] = []

  if (article) {
    entries.push(ImportLibraryEntrySchema.parse({
      source: "article",
      route: "/articles",
      title: article.title,
      summary: article.hostname,
      detail: article.scope === "article" ? "Readable article import" : "Readable page import",
      importedAt: article.importedAt,
    }))
  }

  if (pdf) {
    entries.push(ImportLibraryEntrySchema.parse({
      source: "pdf",
      route: "/files/pdf",
      title: pdf.fileName,
      summary: `${pdf.pageCount} pages`,
      detail: "Resume PDF workspace",
      importedAt: pdf.importedAt,
    }))
  }

  if (epub) {
    entries.push(ImportLibraryEntrySchema.parse({
      source: "epub",
      route: "/files/epub",
      title: epub.title,
      summary: epub.author,
      detail: "Resume EPUB workspace",
      importedAt: epub.importedAt,
    }))
  }

  if (subtitle) {
    entries.push(ImportLibraryEntrySchema.parse({
      source: "subtitle",
      route: "/files/subtitles",
      title: subtitle.fileName,
      summary: subtitle.format.toUpperCase(),
      detail: "Resume subtitle/document workspace",
      importedAt: subtitle.importedAt,
    }))
  }

  return entries.sort((left, right) => new Date(right.importedAt).getTime() - new Date(left.importedAt).getTime())
}

export function readLastAccountEmail(): string {
  return readJsonStorage(ACCOUNT_PREFS_STORAGE_KEY, AccountPreferencesSchema)?.lastEmail ?? ""
}

export function saveLastAccountEmail(email: string): string {
  const trimmed = email.trim()
  writeJsonStorage(ACCOUNT_PREFS_STORAGE_KEY, {
    lastEmail: trimmed.length > 0 ? trimmed : null,
  })
  return trimmed
}
