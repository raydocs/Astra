import Dexie from "dexie"
import { z } from "zod"

import {
  VideoNoteJobStatusSchema,
  VideoNotePlatformSchema,
  VideoTranscriptSegmentSchema,
} from "@/types/video-notes"

const RECENT_IMPORTS_STORAGE_KEY = "astra.web.recent-imports.v1"
const TEXT_WORKSPACE_STORAGE_KEY = "astra.web.text-workspace.v1"
const ARTICLE_WORKSPACE_STORAGE_KEY = "astra.web.article-workspace.v1"
const PDF_WORKSPACE_STORAGE_KEY = "astra.web.pdf-workspace.v1"
const EPUB_WORKSPACE_STORAGE_KEY = "astra.web.epub-workspace.v1"
const SUBTITLE_WORKSPACE_STORAGE_KEY = "astra.web.subtitle-workspace.v1"
const VIDEO_NOTE_WORKSPACE_STORAGE_KEY = "astra.web.video-note-workspace.v1"
const ACCOUNT_PREFS_STORAGE_KEY = "astra.web.account-prefs.v1"
const WORKSPACE_DB_NAME = "astra-web-workspaces"
const LIBRARY_MIGRATION_VERSION = 1

const RecentImportRouteSchema = z.enum(["/articles", "/files/pdf", "/files/epub", "/files/subtitles", "/video-notes", "/assets"])
const RecentImportSourceSchema = z.enum(["article", "pdf", "epub", "subtitle", "video-note", "asset"])
const TextTransferSourceSchema = z.enum(["article", "pdf", "epub", "subtitle"])
const FileFormatSchema = z.enum(["srt", "vtt", "ass", "markdown", "txt", "html"])
const TextTaskSchema = z.enum(["translate", "explain", "custom"])
const ArticleImportScopeSchema = z.enum(["article", "page"])
export const LibraryItemKindSchema = z.enum(["article", "pdf", "epub", "subtitle", "video-note", "asset"])
export const LibraryOwnerModeSchema = z.enum(["local", "account"])
export const LibrarySyncStateSchema = z.enum(["local_only", "pending_import", "synced", "import_failed"])

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
  importedDraftSource: TextTransferSourceSchema.nullable().default(null),
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

const VideoNoteWorkspaceSnapshotSchema = z.object({
  jobId: z.string().trim().min(1),
  artifactId: z.string().trim().min(1).nullable().default(null),
  sourceUrl: z.string().trim().min(1).refine(isSafeHttpUrl, "Video URL must use http(s)."),
  platform: VideoNotePlatformSchema,
  title: z.string().trim().min(1).nullable().default(null),
  status: VideoNoteJobStatusSchema,
  markdown: z.string(),
  transcriptSegments: z.array(VideoTranscriptSegmentSchema).default([]),
  keyMoments: z.array(z.object({
    label: z.string().trim().min(1),
    startMs: z.number().int().nonnegative(),
  })).default([]),
  screenshots: z.array(z.object({
    id: z.string().trim().min(1),
    startMs: z.number().int().nonnegative().nullable().default(null),
    url: z.string().trim().min(1),
  })).default([]),
  generatedAt: z.string().trim().min(1),
  updatedAt: z.string().trim().min(1),
  lastViewedAt: z.string().trim().min(1).nullable().default(null),
})

const AccountPreferencesSchema = z.object({
  lastEmail: z.string().trim().email().nullable().default(null),
})

export const LibraryItemSchema = z.object({
  id: z.string().trim().min(1),
  kind: LibraryItemKindSchema,
  title: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  detail: z.string().trim().min(1),
  route: RecentImportRouteSchema,
  ownerMode: LibraryOwnerModeSchema,
  accountId: z.string().trim().min(1).nullable().default(null),
  sourceLegacyKey: z.string().trim().min(1).nullable().default(null),
  legacySignature: z.string().trim().min(1).nullable().default(null),
  createdAt: z.string().trim().min(1),
  updatedAt: z.string().trim().min(1),
  importedAt: z.string().trim().min(1),
  lastOpenedAt: z.string().trim().min(1).nullable().default(null),
  removedAt: z.string().trim().min(1).nullable().default(null),
  syncState: LibrarySyncStateSchema,
  metadata: z.record(z.string(), z.unknown()).default({}),
})

const LibrarySnapshotRecordSchema = z.object({
  libraryItemId: z.string().trim().min(1),
  kind: LibraryItemKindSchema,
  snapshot: z.unknown(),
  updatedAt: z.number().int().nonnegative(),
})

export const DOCUMENT_SNAPSHOT_PAYLOAD_BUDGET = {
  version: 1,
  maxExtractedTextChars: 400_000,
  chunkThresholdChars: 48_000,
  chunkSizeChars: 32_000,
  maxChunkCount: 13,
  retentionPolicy: "latest_snapshot_per_library_item",
  originalFileBytes: "out_of_scope_reimport_required",
} as const

const DocumentSnapshotStatusSchema = z.enum(["available", "empty", "oversized"])
const DocumentSnapshotChunkSchema = z.object({
  index: z.number().int().nonnegative(),
  text: z.string(),
  charCount: z.number().int().nonnegative(),
})

export const LibraryDocumentSnapshotRecordSchema = z.object({
  libraryItemId: z.string().trim().min(1),
  kind: LibraryItemKindSchema,
  version: z.literal(1).default(1),
  metadata: z.record(z.string(), z.unknown()).default({}),
  extractionStatus: DocumentSnapshotStatusSchema,
  extractedText: z.object({
    status: DocumentSnapshotStatusSchema,
    charCount: z.number().int().nonnegative(),
    chunkCount: z.number().int().nonnegative(),
    chunks: z.array(DocumentSnapshotChunkSchema).default([]),
    failureCode: z.enum(["EXTRACTED_TEXT_EMPTY", "EXTRACTED_TEXT_TOO_LARGE"]).nullable().default(null),
    failureMessage: z.string().trim().min(1).nullable().default(null),
  }),
  snapshot: z.unknown().nullable().default(null),
  byteAvailability: z.object({
    originalFileBytesSynced: z.literal(false).default(false),
    requiresReimportForBinaryView: z.literal(true).default(true),
    message: z.string().trim().min(1),
  }),
  updatedAt: z.number().int().nonnegative(),
})

export const LibraryDocumentSnapshotSyncManifestSchema = z.object({
  kind: z.literal("web_library_document_snapshot_manifest_v1"),
  libraryItemId: z.string().trim().min(1),
  itemKind: LibraryItemKindSchema,
  version: z.literal(1),
  metadata: z.record(z.string(), z.unknown()).default({}),
  extractedTextStatus: DocumentSnapshotStatusSchema,
  extractedTextCharCount: z.number().int().nonnegative(),
  chunkCount: z.number().int().nonnegative(),
  budget: z.object({
    maxExtractedTextChars: z.number().int().positive(),
    chunkThresholdChars: z.number().int().positive(),
    chunkSizeChars: z.number().int().positive(),
    retentionPolicy: z.literal("latest_snapshot_per_library_item"),
  }),
  failureCode: z.enum(["EXTRACTED_TEXT_EMPTY", "EXTRACTED_TEXT_TOO_LARGE"]).nullable().default(null),
  failureMessage: z.string().trim().min(1).nullable().default(null),
  byteAvailability: z.object({
    originalFileBytesSynced: z.literal(false),
    requiresReimportForBinaryView: z.literal(true),
    message: z.string().trim().min(1),
  }),
  updatedAt: z.number().int().nonnegative(),
}).strict()

export const LibraryDocumentSnapshotSyncChunkSchema = z.object({
  kind: z.literal("web_library_document_snapshot_chunk_v1"),
  libraryItemId: z.string().trim().min(1),
  itemKind: LibraryItemKindSchema,
  version: z.literal(1),
  chunkIndex: z.number().int().nonnegative(),
  chunkCount: z.number().int().positive(),
  text: z.string().max(DOCUMENT_SNAPSHOT_PAYLOAD_BUDGET.chunkSizeChars),
  charCount: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
}).strict()

const MigrationJournalRecordSchema = z.object({
  id: z.string().trim().min(1),
  version: z.number().int().positive(),
  sourceKey: z.string().trim().min(1),
  targetLibraryItemId: z.string().trim().min(1).nullable().default(null),
  status: z.enum(["started", "copied", "validated", "failed"]),
  startedAt: z.string().trim().min(1),
  updatedAt: z.string().trim().min(1),
  error: z.string().trim().min(1).nullable().default(null),
})

const LegacyMappingRecordSchema = z.object({
  legacyKey: z.string().trim().min(1),
  libraryItemId: z.string().trim().min(1),
  kind: LibraryItemKindSchema,
  legacySignature: z.string().trim().min(1).nullable().default(null),
  migratedAt: z.string().trim().min(1),
})

const ImportLibraryEntrySchema = z.object({
  id: z.string().trim().min(1),
  source: RecentImportSourceSchema,
  route: RecentImportRouteSchema,
  title: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  detail: z.string().trim().min(1),
  importedAt: z.string().trim().min(1),
  ownerMode: LibraryOwnerModeSchema.default("local"),
  syncState: LibrarySyncStateSchema.default("local_only"),
  snapshotStatus: DocumentSnapshotStatusSchema.nullable().default(null),
  requiresReimportForBinaryView: z.boolean().default(true),
})

export type RecentWebImport = z.infer<typeof RecentWebImportSchema>
export type TextWorkspaceDraft = z.infer<typeof TextWorkspaceDraftSchema>
export type ArticleWorkspaceSnapshot = z.infer<typeof ArticleWorkspaceSnapshotSchema>
export type PdfWorkspaceSnapshot = z.infer<typeof PdfWorkspaceSnapshotSchema>
export type EpubChapterItem = z.infer<typeof EpubChapterItemSchema>
export type EpubChapterPreviewSnapshot = z.infer<typeof EpubChapterPreviewSchema>
export type EpubWorkspaceSnapshot = z.infer<typeof EpubWorkspaceSnapshotSchema>
export type SubtitleWorkspaceSnapshot = z.infer<typeof SubtitleWorkspaceSnapshotSchema>
export type VideoNoteWorkspaceSnapshot = z.infer<typeof VideoNoteWorkspaceSnapshotSchema>
export type LibraryItemKind = z.infer<typeof LibraryItemKindSchema>
export type LibraryOwnerMode = z.infer<typeof LibraryOwnerModeSchema>
export type LibrarySyncState = z.infer<typeof LibrarySyncStateSchema>
export type LibraryItem = z.infer<typeof LibraryItemSchema>
export type LibraryDocumentSnapshotRecord = z.infer<typeof LibraryDocumentSnapshotRecordSchema>
export type LibraryDocumentSnapshotSyncManifest = z.infer<typeof LibraryDocumentSnapshotSyncManifestSchema>
export type LibraryDocumentSnapshotSyncChunk = z.infer<typeof LibraryDocumentSnapshotSyncChunkSchema>
export type LibraryDocumentSnapshotStatus = z.infer<typeof DocumentSnapshotStatusSchema>
export type ImportLibraryEntry = z.infer<typeof ImportLibraryEntrySchema>

const LARGE_WORKSPACE_KEYS = {
  article: "article",
  pdf: "pdf",
  epub: "epub",
  subtitle: "subtitle",
  videoNote: "video-note",
} as const

type LargeWorkspaceKey = typeof LARGE_WORKSPACE_KEYS[keyof typeof LARGE_WORKSPACE_KEYS]
interface WorkspaceRecord {
  key: string
  snapshot: unknown
  updatedAt: number
}

interface LibrarySnapshotRecord {
  libraryItemId: string
  kind: LibraryItemKind
  snapshot: unknown
  updatedAt: number
}

interface LibraryDocumentSnapshotDatabaseRecord extends LibraryDocumentSnapshotRecord {
  extractionStatus: LibraryDocumentSnapshotStatus
}

interface MigrationJournalRecord {
  id: string
  version: number
  sourceKey: string
  targetLibraryItemId: string | null
  status: "started" | "copied" | "validated" | "failed"
  startedAt: string
  updatedAt: string
  error: string | null
}

interface LegacyMappingRecord {
  legacyKey: string
  libraryItemId: string
  kind: LibraryItemKind
  legacySignature: string | null
  migratedAt: string
}

class WorkspaceDB extends Dexie {
  workspaces!: Dexie.Table<WorkspaceRecord, string>
  libraryItems!: Dexie.Table<LibraryItem, string>
  librarySnapshots!: Dexie.Table<LibrarySnapshotRecord, string>
  libraryDocumentSnapshots!: Dexie.Table<LibraryDocumentSnapshotDatabaseRecord, string>
  migrationJournal!: Dexie.Table<MigrationJournalRecord, string>
  legacyMappings!: Dexie.Table<LegacyMappingRecord, string>

  constructor() {
    super(WORKSPACE_DB_NAME)
    this.version(1).stores({
      workspaces: "&key, updatedAt",
    })
    this.version(2).stores({
      workspaces: "&key, updatedAt",
      libraryItems: "&id, kind, ownerMode, accountId, importedAt, updatedAt, removedAt, syncState",
      librarySnapshots: "&libraryItemId, kind, updatedAt",
      migrationJournal: "&id, version, sourceKey, status, updatedAt",
      legacyMappings: "&legacyKey, libraryItemId, kind, legacySignature, migratedAt",
    })
    this.version(3).stores({
      workspaces: "&key, updatedAt",
      libraryItems: "&id, kind, ownerMode, accountId, importedAt, updatedAt, removedAt, syncState",
      librarySnapshots: "&libraryItemId, kind, updatedAt",
      libraryDocumentSnapshots: "&libraryItemId, kind, extractionStatus, updatedAt",
      migrationJournal: "&id, version, sourceKey, status, updatedAt",
      legacyMappings: "&legacyKey, libraryItemId, kind, legacySignature, migratedAt",
    })
  }
}

const workspaceDb = new WorkspaceDB()
const ACTIVE_MAPPING_PREFIX = "active:"
let configuredAccountId: string | null = null

const LARGE_WORKSPACE_DEFINITIONS = [
  {
    key: LARGE_WORKSPACE_KEYS.article,
    kind: "article",
    schema: ArticleWorkspaceSnapshotSchema,
    legacyStorageKey: ARTICLE_WORKSPACE_STORAGE_KEY,
    label: "Article workspace",
  },
  {
    key: LARGE_WORKSPACE_KEYS.pdf,
    kind: "pdf",
    schema: PdfWorkspaceSnapshotSchema,
    legacyStorageKey: PDF_WORKSPACE_STORAGE_KEY,
    label: "PDF workspace",
  },
  {
    key: LARGE_WORKSPACE_KEYS.epub,
    kind: "epub",
    schema: EpubWorkspaceSnapshotSchema,
    legacyStorageKey: EPUB_WORKSPACE_STORAGE_KEY,
    label: "EPUB workspace",
  },
  {
    key: LARGE_WORKSPACE_KEYS.subtitle,
    kind: "subtitle",
    schema: SubtitleWorkspaceSnapshotSchema,
    legacyStorageKey: SUBTITLE_WORKSPACE_STORAGE_KEY,
    label: "Subtitle workspace",
  },
  {
    key: LARGE_WORKSPACE_KEYS.videoNote,
    kind: "video-note",
    schema: VideoNoteWorkspaceSnapshotSchema,
    legacyStorageKey: VIDEO_NOTE_WORKSPACE_STORAGE_KEY,
    label: "Video-note workspace",
  },
] as const

interface WorkspaceDefinition<T = unknown> {
  key: LargeWorkspaceKey
  kind: LibraryItemKind
  schema: z.ZodType<T>
  legacyStorageKey: string
  label: string
}

export interface WorkspaceStorageHealthRecord {
  key: string
  label: string
  indexedDbState: "missing" | "healthy" | "corrupted"
  legacyState: "missing" | "healthy" | "corrupted"
  libraryState: "missing" | "healthy" | "corrupted"
  indexedDbUpdatedAt: number | null
  issues: string[]
}

export interface WorkspaceStorageHealthSnapshot {
  dbName: string
  indexedDbAvailable: boolean
  indexedDbReachable: boolean
  indexedDbRecordCount: number
  libraryItemCount: number
  librarySnapshotCount: number
  libraryDocumentSnapshotCount: number
  migrationJournalCount: number
  legacyMappingCount: number
  legacyStorageKeysPresent: string[]
  records: WorkspaceStorageHealthRecord[]
  corruptedKeys: string[]
}

export interface WorkspaceStorageRepairReport {
  removedIndexedDbKeys: string[]
  removedLibraryItemIds: string[]
  removedLibrarySnapshotIds: string[]
  removedLibraryDocumentSnapshotIds: string[]
  removedMigrationJournalIds: string[]
  removedLegacyMappingKeys: string[]
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

function nowIso() {
  return new Date().toISOString()
}

function createOpaqueId(prefix: string): string {
  const cryptoApi = globalThis.crypto
  if (cryptoApi && "randomUUID" in cryptoApi) {
    return `${prefix}_${cryptoApi.randomUUID()}`
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`
}

function activeMappingKey(key: LargeWorkspaceKey): string {
  return `${ACTIVE_MAPPING_PREFIX}${key}`
}

function routeForKind(kind: LibraryItemKind): RecentWebImport["route"] {
  if (kind === "article") return "/articles"
  if (kind === "pdf") return "/files/pdf"
  if (kind === "epub") return "/files/epub"
  if (kind === "subtitle") return "/files/subtitles"
  if (kind === "video-note") return "/video-notes"
  return "/assets"
}

function sourceForKind(kind: LibraryItemKind): RecentWebImport["source"] {
  return kind === "video-note" ? "video-note" : kind
}

function getWorkspaceSignature(kind: LibraryItemKind, snapshot: unknown): string {
  if (kind === "article") {
    const parsed = ArticleWorkspaceSnapshotSchema.parse(snapshot)
    return `article:${parsed.url}:${parsed.importedAt}`
  }
  if (kind === "pdf") {
    const parsed = PdfWorkspaceSnapshotSchema.parse(snapshot)
    return `pdf:${parsed.fileName}:${parsed.importedAt}`
  }
  if (kind === "epub") {
    const parsed = EpubWorkspaceSnapshotSchema.parse(snapshot)
    return `epub:${parsed.fileName}:${parsed.importedAt}`
  }
  if (kind === "subtitle") {
    const parsed = SubtitleWorkspaceSnapshotSchema.parse(snapshot)
    return `subtitle:${parsed.fileName}:${parsed.importedAt}`
  }
  if (kind === "video-note") {
    const parsed = VideoNoteWorkspaceSnapshotSchema.parse(snapshot)
    return `video-note:${parsed.jobId}`
  }
  return `asset:${Date.now()}`
}

function summarizeSnapshot(kind: LibraryItemKind, snapshot: unknown): Pick<LibraryItem, "title" | "summary" | "detail" | "importedAt" | "metadata"> {
  if (kind === "article") {
    const article = ArticleWorkspaceSnapshotSchema.parse(snapshot)
    return {
      title: article.title,
      summary: article.hostname,
      detail: article.scope === "article" ? "Readable article import" : "Readable page import",
      importedAt: article.importedAt,
      metadata: {
        url: article.url,
        hostname: article.hostname,
        byline: article.byline,
        scope: article.scope,
        blockCount: article.blocks.length,
      },
    }
  }

  if (kind === "pdf") {
    const pdf = PdfWorkspaceSnapshotSchema.parse(snapshot)
    return {
      title: pdf.fileName,
      summary: `${pdf.pageCount} pages`,
      detail: "Resume PDF workspace",
      importedAt: pdf.importedAt,
      metadata: {
        fileName: pdf.fileName,
        sizeLabel: pdf.sizeLabel,
        pageCount: pdf.pageCount,
        selectedPageNumber: pdf.selectedPageNumber,
      },
    }
  }

  if (kind === "epub") {
    const epub = EpubWorkspaceSnapshotSchema.parse(snapshot)
    return {
      title: epub.title,
      summary: epub.author,
      detail: "Resume EPUB workspace",
      importedAt: epub.importedAt,
      metadata: {
        fileName: epub.fileName,
        author: epub.author,
        chapterCount: epub.chapters.length,
        loadedChapterCount: epub.loadedChapters.length,
      },
    }
  }

  if (kind === "subtitle") {
    const subtitle = SubtitleWorkspaceSnapshotSchema.parse(snapshot)
    return {
      title: subtitle.fileName,
      summary: subtitle.format.toUpperCase(),
      detail: "Resume subtitle/document workspace",
      importedAt: subtitle.importedAt,
      metadata: {
        fileName: subtitle.fileName,
        format: subtitle.format,
        cueCount: subtitle.cues.length,
        documentCount: subtitle.documents.length,
        translationCount: subtitle.translations.length,
      },
    }
  }

  if (kind === "video-note") {
    const video = VideoNoteWorkspaceSnapshotSchema.parse(snapshot)
    return {
      title: video.title ?? video.sourceUrl,
      summary: `${video.platform} · ${video.status}`,
      detail: "Resume video-note workspace",
      importedAt: video.generatedAt,
      metadata: {
        jobId: video.jobId,
        artifactId: video.artifactId,
        sourceUrl: video.sourceUrl,
        platform: video.platform,
        status: video.status,
        transcriptSegmentCount: video.transcriptSegments.length,
      },
    }
  }

  return {
    title: "Asset",
    summary: "Local asset",
    detail: "Library asset metadata",
    importedAt: nowIso(),
    metadata: {},
  }
}

function createLibraryItem(kind: LibraryItemKind, snapshot: unknown, options: {
  id?: string
  sourceLegacyKey?: string | null
  ownerMode?: LibraryOwnerMode
  accountId?: string | null
} = {}): LibraryItem {
  const createdAt = nowIso()
  const summary = summarizeSnapshot(kind, snapshot)
  const ownerMode = options.ownerMode ?? (configuredAccountId ? "account" : "local")
  return LibraryItemSchema.parse({
    id: options.id ?? createOpaqueId(`lib_${kind.replace(/-/g, "_")}`),
    kind,
    title: summary.title,
    summary: summary.summary,
    detail: summary.detail,
    route: routeForKind(kind),
    ownerMode,
    accountId: ownerMode === "account" ? (options.accountId ?? configuredAccountId) : null,
    sourceLegacyKey: options.sourceLegacyKey ?? null,
    legacySignature: getWorkspaceSignature(kind, snapshot),
    createdAt,
    updatedAt: createdAt,
    importedAt: summary.importedAt,
    lastOpenedAt: createdAt,
    removedAt: null,
    syncState: ownerMode === "account" ? "pending_import" : "local_only",
    metadata: summary.metadata,
  })
}

async function putMigrationJournal(record: MigrationJournalRecord) {
  await workspaceDb.migrationJournal.put(MigrationJournalRecordSchema.parse(record))
}

async function hasValidatedMigration(sourceKey: string): Promise<boolean> {
  const journal = await workspaceDb.migrationJournal.get(`library-v${LIBRARY_MIGRATION_VERSION}:${sourceKey}`).catch(() => null)
  return journal?.status === "validated"
}

function chunkText(text: string): Array<{ index: number; text: string; charCount: number }> {
  const chunks: Array<{ index: number; text: string; charCount: number }> = []
  for (let offset = 0; offset < text.length; offset += DOCUMENT_SNAPSHOT_PAYLOAD_BUDGET.chunkSizeChars) {
    const chunk = text.slice(offset, offset + DOCUMENT_SNAPSHOT_PAYLOAD_BUDGET.chunkSizeChars)
    chunks.push({ index: chunks.length, text: chunk, charCount: chunk.length })
  }
  return chunks
}

function buildSnapshotSyncProjection(kind: LibraryItemKind, snapshot: unknown): unknown {
  if (kind === "article") return ArticleWorkspaceSnapshotSchema.parse(snapshot)
  if (kind === "pdf") return PdfWorkspaceSnapshotSchema.parse(snapshot)
  if (kind === "epub") return EpubWorkspaceSnapshotSchema.parse(snapshot)
  if (kind === "subtitle") return SubtitleWorkspaceSnapshotSchema.parse(snapshot)
  if (kind === "video-note") {
    const video = VideoNoteWorkspaceSnapshotSchema.parse(snapshot)
    return VideoNoteWorkspaceSnapshotSchema.parse({
      ...video,
      // Original media/still bytes and potentially data/blob screenshot URLs stay device-local.
      screenshots: video.screenshots.filter((screenshot) => /^https?:\/\//i.test(screenshot.url)),
    })
  }
  return null
}

function getDocumentExtractedText(kind: LibraryItemKind, snapshot: unknown): string {
  if (kind === "article") {
    return ArticleWorkspaceSnapshotSchema.parse(snapshot).blocks.join("\n\n")
  }
  if (kind === "pdf") {
    return PdfWorkspaceSnapshotSchema.parse(snapshot).pages
      .map((page) => page.blocks.join("\n\n"))
      .filter((text) => text.trim().length > 0)
      .join("\n\n")
  }
  if (kind === "epub") {
    return EpubWorkspaceSnapshotSchema.parse(snapshot).loadedChapters
      .map((chapter) => chapter.paragraphs.join("\n\n"))
      .filter((text) => text.trim().length > 0)
      .join("\n\n")
  }
  if (kind === "subtitle") {
    const subtitle = SubtitleWorkspaceSnapshotSchema.parse(snapshot)
    const sourceRows = subtitle.documents.length > 0
      ? subtitle.documents.map((entry) => entry.text)
      : subtitle.cues.map((cue) => cue.text)
    return sourceRows.filter((text) => text.trim().length > 0).join("\n\n")
  }
  if (kind === "video-note") {
    const video = VideoNoteWorkspaceSnapshotSchema.parse(snapshot)
    const transcriptText = video.transcriptSegments
      .map((segment) => (segment as { text?: unknown }).text)
      .filter((text): text is string => typeof text === "string" && text.trim().length > 0)
      .join("\n\n")
    return [video.markdown, transcriptText].filter((text) => text.trim().length > 0).join("\n\n")
  }
  return ""
}

function buildDocumentSnapshotRecord(item: LibraryItem, snapshot: unknown, updatedAt = Date.now()): LibraryDocumentSnapshotDatabaseRecord {
  const extractedText = getDocumentExtractedText(item.kind, snapshot)
  const charCount = extractedText.length
  const base = {
    libraryItemId: item.id,
    kind: item.kind,
    version: 1 as const,
    metadata: item.metadata,
    snapshot: charCount <= DOCUMENT_SNAPSHOT_PAYLOAD_BUDGET.maxExtractedTextChars ? snapshot : null,
    byteAvailability: {
      originalFileBytesSynced: false as const,
      requiresReimportForBinaryView: true as const,
      message: "Original file bytes are not synced in this milestone. Re-import the source file on this browser when binary viewer access is required.",
    },
    updatedAt,
  }

  if (charCount === 0) {
    return {
      ...base,
      extractionStatus: "empty",
      extractedText: {
        status: "empty",
        charCount,
        chunkCount: 0,
        chunks: [],
        failureCode: "EXTRACTED_TEXT_EMPTY",
        failureMessage: "No extracted text was available for this library item.",
      },
    }
  }

  if (charCount > DOCUMENT_SNAPSHOT_PAYLOAD_BUDGET.maxExtractedTextChars) {
    return {
      ...base,
      extractionStatus: "oversized",
      extractedText: {
        status: "oversized",
        charCount,
        chunkCount: 0,
        chunks: [],
        failureCode: "EXTRACTED_TEXT_TOO_LARGE",
        failureMessage: `Extracted text is ${charCount.toLocaleString()} characters, above Astra Web's ${DOCUMENT_SNAPSHOT_PAYLOAD_BUDGET.maxExtractedTextChars.toLocaleString()} character snapshot sync budget. Re-import on this browser or split the source document.`,
      },
    }
  }

  const chunks = charCount > DOCUMENT_SNAPSHOT_PAYLOAD_BUDGET.chunkThresholdChars
    ? chunkText(extractedText)
    : [{ index: 0, text: extractedText, charCount }]

  return {
    ...base,
    extractionStatus: "available",
    extractedText: {
      status: "available",
      charCount,
      chunkCount: chunks.length,
      chunks,
      failureCode: null,
      failureMessage: null,
    },
  }
}

async function putLibraryDocumentSnapshot(item: LibraryItem, snapshot: unknown) {
  const record = buildDocumentSnapshotRecord(item, snapshot)
  await workspaceDb.libraryDocumentSnapshots.put(LibraryDocumentSnapshotRecordSchema.parse(record) as LibraryDocumentSnapshotDatabaseRecord)
}

async function putLibrarySnapshot(item: LibraryItem, snapshot: unknown) {
  const updatedAt = Date.now()
  await workspaceDb.librarySnapshots.put(LibrarySnapshotRecordSchema.parse({
    libraryItemId: item.id,
    kind: item.kind,
    snapshot,
    updatedAt,
  }))
  await putLibraryDocumentSnapshot(item, snapshot)
}

async function updateLegacyActiveMapping(definition: WorkspaceDefinition, item: LibraryItem) {
  const migratedAt = nowIso()
  await workspaceDb.legacyMappings.bulkPut([
    LegacyMappingRecordSchema.parse({
      legacyKey: definition.key,
      libraryItemId: item.id,
      kind: definition.kind,
      legacySignature: item.legacySignature,
      migratedAt,
    }),
    LegacyMappingRecordSchema.parse({
      legacyKey: activeMappingKey(definition.key),
      libraryItemId: item.id,
      kind: definition.kind,
      legacySignature: item.legacySignature,
      migratedAt,
    }),
  ])
}

async function migrateSnapshotCopyFirst(definition: WorkspaceDefinition, snapshot: unknown, sourceKey: string, forcedId?: string): Promise<LibraryItem | null> {
  const parsedSnapshot = definition.schema.parse(snapshot)
  const journalId = `library-v${LIBRARY_MIGRATION_VERSION}:${sourceKey}`
  const startedAt = nowIso()

  await putMigrationJournal({
    id: journalId,
    version: LIBRARY_MIGRATION_VERSION,
    sourceKey,
    targetLibraryItemId: forcedId ?? null,
    status: "started",
    startedAt,
    updatedAt: startedAt,
    error: null,
  })

  try {
    const mapping = await workspaceDb.legacyMappings.get(definition.key)
    const existing = mapping ? await workspaceDb.libraryItems.get(mapping.libraryItemId) : null
    const existingSummary = summarizeSnapshot(definition.kind, parsedSnapshot)
    const item = existing
      ? LibraryItemSchema.parse({
        ...existing,
        ...existingSummary,
        title: existing.metadata.displayTitleOverridden === true || existing.title !== existingSummary.title ? existing.title : existingSummary.title,
        sourceLegacyKey: definition.key,
        legacySignature: getWorkspaceSignature(definition.kind, parsedSnapshot),
        removedAt: null,
        updatedAt: nowIso(),
      })
      : createLibraryItem(definition.kind, parsedSnapshot, {
        id: forcedId,
        sourceLegacyKey: definition.key,
        ownerMode: "local",
        accountId: null,
      })

    await workspaceDb.libraryItems.put(item)
    await putLibrarySnapshot(item, parsedSnapshot)
    await updateLegacyActiveMapping(definition, item)
    await putMigrationJournal({
      id: journalId,
      version: LIBRARY_MIGRATION_VERSION,
      sourceKey,
      targetLibraryItemId: item.id,
      status: "copied",
      startedAt,
      updatedAt: nowIso(),
      error: null,
    })

    const readBack = await workspaceDb.librarySnapshots.get(item.id)
    definition.schema.parse(readBack?.snapshot)

    await putMigrationJournal({
      id: journalId,
      version: LIBRARY_MIGRATION_VERSION,
      sourceKey,
      targetLibraryItemId: item.id,
      status: "validated",
      startedAt,
      updatedAt: nowIso(),
      error: null,
    })
    return item
  } catch (error) {
    await putMigrationJournal({
      id: journalId,
      version: LIBRARY_MIGRATION_VERSION,
      sourceKey,
      targetLibraryItemId: forcedId ?? null,
      status: "failed",
      startedAt,
      updatedAt: nowIso(),
      error: error instanceof Error ? error.message : "unknown migration error",
    })
    return null
  }
}

async function migrateLegacyWorkspace(definition: WorkspaceDefinition): Promise<void> {
  const indexedDbSourceKey = `indexeddb:${definition.key}`
  const stored = await workspaceDb.workspaces.get(definition.key).catch(() => null)
  if (stored && !(await hasValidatedMigration(indexedDbSourceKey))) {
    await migrateSnapshotCopyFirst(definition, stored.snapshot, indexedDbSourceKey, `legacy_${definition.key}`)
  }

  const indexedDbValidated = stored ? await hasValidatedMigration(indexedDbSourceKey) : false
  const localStorageSourceKey = `localstorage:${definition.legacyStorageKey}`
  const legacy = readJsonStorage(definition.legacyStorageKey, definition.schema)
  if (legacy && !indexedDbValidated && !(await hasValidatedMigration(localStorageSourceKey))) {
    await migrateSnapshotCopyFirst(definition, legacy, localStorageSourceKey, `legacy_${definition.key}`)
  }
}

async function ensureLibraryMigration(): Promise<void> {
  try {
    for (const definition of LARGE_WORKSPACE_DEFINITIONS) {
      await migrateLegacyWorkspace(definition)
    }
  } catch {
    // Legacy readers still fall back below if migration cannot complete.
  }
}

async function findActiveLibrarySnapshot<T>(definition: WorkspaceDefinition<T>): Promise<T | null> {
  const active = await workspaceDb.legacyMappings.get(activeMappingKey(definition.key)).catch(() => null)
  const candidates: LibraryItem[] = []

  if (active) {
    const item = await workspaceDb.libraryItems.get(active.libraryItemId).catch(() => null)
    if (item && !item.removedAt) candidates.push(item)
  }

  if (candidates.length === 0) {
    const items = await workspaceDb.libraryItems
      .where("kind")
      .equals(definition.kind)
      .toArray()
      .catch(() => [])
    candidates.push(...items
      .filter((item) => !item.removedAt)
      .sort((left, right) => new Date(right.lastOpenedAt ?? right.updatedAt).getTime() - new Date(left.lastOpenedAt ?? left.updatedAt).getTime()))
  }

  for (const item of candidates) {
    const snapshot = await workspaceDb.librarySnapshots.get(item.id).catch(() => null)
    if (!snapshot) continue
    try {
      return definition.schema.parse(snapshot.snapshot)
    } catch {
      // Try the next candidate.
    }
  }

  return null
}

async function readLargeWorkspace<T>(
  key: LargeWorkspaceKey,
  schema: z.ZodType<T>,
  legacyStorageKey: string,
): Promise<T | null> {
  const definition = LARGE_WORKSPACE_DEFINITIONS.find((item) => item.key === key) as WorkspaceDefinition<T> | undefined
  if (!definition) return null

  await ensureLibraryMigration()

  const librarySnapshot = await findActiveLibrarySnapshot(definition)
  if (librarySnapshot) return librarySnapshot

  try {
    const stored = await workspaceDb.workspaces.get(key)
    if (stored) {
      return schema.parse(stored.snapshot)
    }
  } catch {
    // Fall back to legacy localStorage below.
  }

  return readJsonStorage(legacyStorageKey, schema)
}

async function saveLargeWorkspace<T>(
  key: LargeWorkspaceKey,
  schema: z.ZodType<T>,
  legacyStorageKey: string,
  workspace: T,
): Promise<T> {
  const next = schema.parse(workspace)
  const definition = LARGE_WORKSPACE_DEFINITIONS.find((item) => item.key === key) as WorkspaceDefinition<T> | undefined
  if (!definition) return next
  const nextSignature = getWorkspaceSignature(definition.kind, next)

  try {
    await ensureLibraryMigration()
    const active = await workspaceDb.legacyMappings.get(activeMappingKey(key))
    const activeItem = active ? await workspaceDb.libraryItems.get(active.libraryItemId) : null
    const shouldUpdateActive = activeItem && !activeItem.removedAt && activeItem.kind === definition.kind && activeItem.legacySignature === nextSignature
    const item = shouldUpdateActive
      ? (() => {
        const summary = summarizeSnapshot(definition.kind, next)
        return LibraryItemSchema.parse({
          ...activeItem,
          ...summary,
          title: activeItem.metadata.displayTitleOverridden === true || activeItem.title !== summary.title ? activeItem.title : summary.title,
          legacySignature: nextSignature,
          updatedAt: nowIso(),
          lastOpenedAt: nowIso(),
        })
      })()
      : createLibraryItem(definition.kind, next, {
        sourceLegacyKey: key,
      })

    await workspaceDb.libraryItems.put(item)
    await putLibrarySnapshot(item, next)
    await updateLegacyActiveMapping(definition, item)
    await workspaceDb.workspaces.put({
      key,
      snapshot: next,
      updatedAt: Date.now(),
    })
    // Do not delete legacy localStorage here; copy-first migration keeps rollback/readback possible.
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

async function clearLargeWorkspace(key: LargeWorkspaceKey, legacyStorageKey: string): Promise<void> {
  try {
    const definition = LARGE_WORKSPACE_DEFINITIONS.find((item) => item.key === key)
    const active = definition ? await workspaceDb.legacyMappings.get(activeMappingKey(key)) : null
    if (active) {
      const item = await workspaceDb.libraryItems.get(active.libraryItemId)
      if (item) {
        await workspaceDb.libraryItems.put(LibraryItemSchema.parse({
          ...item,
          removedAt: nowIso(),
          updatedAt: nowIso(),
        }))
      }
      await workspaceDb.legacyMappings.delete(activeMappingKey(key))
    }
    await workspaceDb.workspaces.delete(key)
  } catch {
    // Ignore IndexedDB removal failures and still clear legacy state.
  }

  removeStorage(legacyStorageKey)
}

export function configureLibraryAccountContext(accountId: string | null) {
  configuredAccountId = accountId?.trim() || null
}

export async function listLibraryItems(kind?: LibraryItemKind, options: { includeRemoved?: boolean } = {}): Promise<LibraryItem[]> {
  await ensureLibraryMigration()
  const items = kind
    ? await workspaceDb.libraryItems.where("kind").equals(kind).toArray()
    : await workspaceDb.libraryItems.toArray()
  return items
    .map((item) => LibraryItemSchema.parse(item))
    .filter((item) => options.includeRemoved || !item.removedAt)
    .sort((left, right) => new Date(right.lastOpenedAt ?? right.updatedAt).getTime() - new Date(left.lastOpenedAt ?? left.updatedAt).getTime())
}

export async function readLibraryItemSnapshot<T = unknown>(libraryItemId: string, schema?: z.ZodType<T>): Promise<T | unknown | null> {
  const record = await workspaceDb.librarySnapshots.get(libraryItemId).catch(() => null)
  if (record) {
    const parsed = LibrarySnapshotRecordSchema.parse(record)
    return schema ? schema.parse(parsed.snapshot) : parsed.snapshot
  }

  const documentSnapshot = await readLibraryDocumentSnapshot(libraryItemId)
  if (!documentSnapshot?.snapshot) return null
  return schema ? schema.parse(documentSnapshot.snapshot) : documentSnapshot.snapshot
}

export async function readLibraryDocumentSnapshot(libraryItemId: string): Promise<LibraryDocumentSnapshotRecord | null> {
  const record = await workspaceDb.libraryDocumentSnapshots.get(libraryItemId).catch(() => null)
  if (!record) return null
  return LibraryDocumentSnapshotRecordSchema.parse(record)
}

export async function listLibraryDocumentSnapshots(libraryItemIds?: string[]): Promise<LibraryDocumentSnapshotRecord[]> {
  const records = libraryItemIds && libraryItemIds.length > 0
    ? (await workspaceDb.libraryDocumentSnapshots.bulkGet(libraryItemIds)).filter((record): record is LibraryDocumentSnapshotDatabaseRecord => Boolean(record))
    : await workspaceDb.libraryDocumentSnapshots.toArray()
  return records.map((record) => LibraryDocumentSnapshotRecordSchema.parse(record))
}

export function toLibraryDocumentSnapshotManifestRecordId(libraryItemId: string): string {
  return `__web_library_document_snapshot_v1__:${libraryItemId}:manifest`
}

export function toLibraryDocumentSnapshotChunkRecordId(libraryItemId: string, chunkIndex: number): string {
  return `__web_library_document_snapshot_v1__:${libraryItemId}:chunk:${chunkIndex}`
}

export function buildLibraryDocumentSnapshotSyncPayloads(snapshot: LibraryDocumentSnapshotRecord): {
  manifest: LibraryDocumentSnapshotSyncManifest
  chunks: LibraryDocumentSnapshotSyncChunk[]
} {
  const parsed = LibraryDocumentSnapshotRecordSchema.parse(snapshot)
  const syncProjection = parsed.extractedText.status === "available" && parsed.snapshot
    ? buildSnapshotSyncProjection(parsed.kind, parsed.snapshot)
    : null
  const serializedSnapshot = syncProjection ? JSON.stringify(syncProjection) : ""
  const rawSyncChunks = serializedSnapshot.length > 0 ? chunkText(serializedSnapshot) : []
  const syncOverflow = rawSyncChunks.length > DOCUMENT_SNAPSHOT_PAYLOAD_BUDGET.maxChunkCount
  const syncChunks = syncOverflow ? [] : rawSyncChunks
  const syncStatus = syncOverflow ? "oversized" : parsed.extractedText.status
  const manifest = LibraryDocumentSnapshotSyncManifestSchema.parse({
    kind: "web_library_document_snapshot_manifest_v1",
    libraryItemId: parsed.libraryItemId,
    itemKind: parsed.kind,
    version: 1,
    metadata: parsed.metadata,
    extractedTextStatus: syncStatus,
    extractedTextCharCount: parsed.extractedText.charCount,
    chunkCount: syncChunks.length,
    budget: {
      maxExtractedTextChars: DOCUMENT_SNAPSHOT_PAYLOAD_BUDGET.maxExtractedTextChars,
      chunkThresholdChars: DOCUMENT_SNAPSHOT_PAYLOAD_BUDGET.chunkThresholdChars,
      chunkSizeChars: DOCUMENT_SNAPSHOT_PAYLOAD_BUDGET.chunkSizeChars,
      retentionPolicy: DOCUMENT_SNAPSHOT_PAYLOAD_BUDGET.retentionPolicy,
    },
    failureCode: syncOverflow ? "EXTRACTED_TEXT_TOO_LARGE" : parsed.extractedText.failureCode,
    failureMessage: syncOverflow ? "Structured document snapshot exceeded Astra Web's chunk budget; re-import on this browser or split the source document." : parsed.extractedText.failureMessage,
    byteAvailability: parsed.byteAvailability,
    updatedAt: parsed.updatedAt,
  })
  const chunks = syncChunks.map((chunk) => LibraryDocumentSnapshotSyncChunkSchema.parse({
    kind: "web_library_document_snapshot_chunk_v1",
    libraryItemId: parsed.libraryItemId,
    itemKind: parsed.kind,
    version: 1,
    chunkIndex: chunk.index,
    chunkCount: syncChunks.length,
    text: chunk.text,
    charCount: chunk.charCount,
    updatedAt: parsed.updatedAt,
  }))
  return { manifest, chunks }
}

export async function writeLibraryDocumentSnapshotFromSync(params: {
  item: LibraryItem
  manifest: LibraryDocumentSnapshotSyncManifest
  chunks: LibraryDocumentSnapshotSyncChunk[]
}): Promise<LibraryDocumentSnapshotRecord | null> {
  const orderedChunks = [...params.chunks].sort((left, right) => left.chunkIndex - right.chunkIndex)
  const isComplete = params.manifest.extractedTextStatus !== "available"
    || (params.manifest.chunkCount > 0 && orderedChunks.length === params.manifest.chunkCount && orderedChunks.every((chunk, index) => chunk.chunkIndex === index))
  if (!isComplete) return null

  const joined = orderedChunks.map((chunk) => chunk.text).join("")
  if (params.manifest.extractedTextStatus === "available" && joined.trim().length > 0) {
    try {
      const snapshot = JSON.parse(joined)
      await workspaceDb.libraryItems.put(params.item)
      await workspaceDb.librarySnapshots.put(LibrarySnapshotRecordSchema.parse({
        libraryItemId: params.item.id,
        kind: params.item.kind,
        snapshot,
        updatedAt: params.manifest.updatedAt,
      }))
      const record = LibraryDocumentSnapshotRecordSchema.parse({
        ...buildDocumentSnapshotRecord(params.item, snapshot, params.manifest.updatedAt),
        metadata: params.manifest.metadata,
      }) as LibraryDocumentSnapshotDatabaseRecord
      await workspaceDb.libraryDocumentSnapshots.put(record)
      return LibraryDocumentSnapshotRecordSchema.parse(record)
    } catch {
      return null
    }
  }

  const record = LibraryDocumentSnapshotRecordSchema.parse({
    libraryItemId: params.item.id,
    kind: params.item.kind,
    version: 1,
    metadata: params.manifest.metadata,
    extractionStatus: params.manifest.extractedTextStatus,
    extractedText: {
      status: params.manifest.extractedTextStatus,
      charCount: params.manifest.extractedTextCharCount,
      chunkCount: 0,
      chunks: [],
      failureCode: params.manifest.failureCode,
      failureMessage: params.manifest.failureMessage,
    },
    snapshot: null,
    byteAvailability: params.manifest.byteAvailability,
    updatedAt: params.manifest.updatedAt,
  }) as LibraryDocumentSnapshotDatabaseRecord
  await workspaceDb.libraryItems.put(params.item)
  await workspaceDb.libraryDocumentSnapshots.put(record)
  return LibraryDocumentSnapshotRecordSchema.parse(record)
}

export async function openLibraryItem(libraryItemId: string): Promise<LibraryItem | null> {
  const item = await workspaceDb.libraryItems.get(libraryItemId).catch(() => null)
  if (!item || item.removedAt) return null

  const next = LibraryItemSchema.parse({
    ...item,
    lastOpenedAt: nowIso(),
    updatedAt: nowIso(),
  })
  await workspaceDb.libraryItems.put(next)

  const definition = LARGE_WORKSPACE_DEFINITIONS.find((candidate) => candidate.kind === next.kind)
  const snapshot = await workspaceDb.librarySnapshots.get(next.id).catch(() => null)
  if (definition && snapshot) {
    await updateLegacyActiveMapping(definition, next)
    await workspaceDb.workspaces.put({
      key: definition.key,
      snapshot: definition.schema.parse(snapshot.snapshot),
      updatedAt: Date.now(),
    })
  }

  return next
}

export async function renameLibraryItem(libraryItemId: string, title: string): Promise<LibraryItem | null> {
  const trimmed = title.trim()
  if (!trimmed) return null
  const item = await workspaceDb.libraryItems.get(libraryItemId).catch(() => null)
  if (!item || item.removedAt) return null
  const next = LibraryItemSchema.parse({
    ...item,
    title: trimmed,
    updatedAt: nowIso(),
    metadata: {
      ...item.metadata,
      displayTitleOverridden: true,
    },
    syncState: item.ownerMode === "account" && item.syncState === "synced" ? "pending_import" : item.syncState,
  })
  await workspaceDb.libraryItems.put(next)
  return next
}

export async function removeLibraryItem(libraryItemId: string): Promise<void> {
  const item = await workspaceDb.libraryItems.get(libraryItemId).catch(() => null)
  if (!item) return
  await workspaceDb.libraryItems.put(LibraryItemSchema.parse({
    ...item,
    removedAt: nowIso(),
    updatedAt: nowIso(),
    syncState: item.ownerMode === "account" ? "pending_import" : item.syncState,
  }))
  await workspaceDb.librarySnapshots.delete(libraryItemId).catch(() => undefined)
  await workspaceDb.libraryDocumentSnapshots.delete(libraryItemId).catch(() => undefined)

  const definition = LARGE_WORKSPACE_DEFINITIONS.find((candidate) => candidate.kind === item.kind)
  if (definition) {
    const active = await workspaceDb.legacyMappings.get(activeMappingKey(definition.key)).catch(() => null)
    if (active?.libraryItemId === libraryItemId) {
      await workspaceDb.legacyMappings.delete(activeMappingKey(definition.key))
      await workspaceDb.workspaces.delete(definition.key).catch(() => undefined)
    }
  }
}

export async function markLibraryItemsImportedToAccount(libraryItemIds: string[], accountId: string): Promise<void> {
  const normalizedAccountId = accountId.trim()
  if (!normalizedAccountId) return
  const items = await workspaceDb.libraryItems.bulkGet(libraryItemIds)
  await workspaceDb.libraryItems.bulkPut(items.flatMap((item) => item ? [LibraryItemSchema.parse({
    ...item,
    ownerMode: "account",
    accountId: normalizedAccountId,
    syncState: "synced",
    updatedAt: nowIso(),
  })] : []))
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

export async function readVideoNoteWorkspace(): Promise<VideoNoteWorkspaceSnapshot | null> {
  return readLargeWorkspace(LARGE_WORKSPACE_KEYS.videoNote, VideoNoteWorkspaceSnapshotSchema, VIDEO_NOTE_WORKSPACE_STORAGE_KEY)
}

export async function saveVideoNoteWorkspace(workspace: VideoNoteWorkspaceSnapshot): Promise<VideoNoteWorkspaceSnapshot> {
  return saveLargeWorkspace(LARGE_WORKSPACE_KEYS.videoNote, VideoNoteWorkspaceSnapshotSchema, VIDEO_NOTE_WORKSPACE_STORAGE_KEY, workspace)
}

export async function clearVideoNoteWorkspace(): Promise<void> {
  await clearLargeWorkspace(LARGE_WORKSPACE_KEYS.videoNote, VIDEO_NOTE_WORKSPACE_STORAGE_KEY)
}

export async function clearAllPersistedWorkspaces(): Promise<void> {
  await Promise.all([
    clearArticleWorkspace(),
    clearPdfWorkspace(),
    clearEpubWorkspace(),
    clearSubtitleWorkspace(),
    clearVideoNoteWorkspace(),
  ])
}

async function inspectLibraryStateForDefinition(definition: WorkspaceDefinition): Promise<Pick<WorkspaceStorageHealthRecord, "libraryState" | "issues">> {
  const issues: string[] = []
  const items = await workspaceDb.libraryItems.where("kind").equals(definition.kind).toArray().catch(() => [])
  const activeItems = items.filter((item) => !item.removedAt)
  if (activeItems.length === 0) return { libraryState: "missing", issues }

  for (const item of activeItems) {
    const parsedItem = LibraryItemSchema.safeParse(item)
    if (!parsedItem.success) {
      issues.push(`Library item parse failed: ${parsedItem.error.message}`)
      continue
    }
    const snapshot = await workspaceDb.librarySnapshots.get(item.id).catch(() => null)
    const documentSnapshot = await workspaceDb.libraryDocumentSnapshots.get(item.id).catch(() => null)
    if (!snapshot && !documentSnapshot) {
      issues.push(`Missing library document snapshot for ${item.id}`)
      continue
    }
    if (documentSnapshot && !LibraryDocumentSnapshotRecordSchema.safeParse(documentSnapshot).success) {
      issues.push(`Library document snapshot record parse failed for ${item.id}`)
    }
    if (snapshot) {
      const parsedSnapshotRecord = LibrarySnapshotRecordSchema.safeParse(snapshot)
      if (!parsedSnapshotRecord.success) {
        issues.push(`Library snapshot record parse failed: ${parsedSnapshotRecord.error.message}`)
        continue
      }
      const parsedSnapshot = definition.schema.safeParse(parsedSnapshotRecord.data.snapshot)
      if (!parsedSnapshot.success) {
        issues.push(`Library snapshot parse failed for ${item.id}: ${parsedSnapshot.error.message}`)
      }
    }
  }

  return { libraryState: issues.length > 0 ? "corrupted" : "healthy", issues }
}

export async function inspectWorkspaceStorageHealth(): Promise<WorkspaceStorageHealthSnapshot> {
  let indexedDbReachable = true
  let indexedDbRecordCount = 0
  let libraryItemCount = 0
  let librarySnapshotCount = 0
  let libraryDocumentSnapshotCount = 0
  let migrationJournalCount = 0
  let legacyMappingCount = 0

  try {
    await ensureLibraryMigration()
    indexedDbRecordCount = await workspaceDb.workspaces.count()
    libraryItemCount = await workspaceDb.libraryItems.count()
    librarySnapshotCount = await workspaceDb.librarySnapshots.count()
    libraryDocumentSnapshotCount = await workspaceDb.libraryDocumentSnapshots.count()
    migrationJournalCount = await workspaceDb.migrationJournal.count()
    legacyMappingCount = await workspaceDb.legacyMappings.count()
  } catch {
    indexedDbReachable = false
  }

  const records: WorkspaceStorageHealthRecord[] = []

  for (const definition of LARGE_WORKSPACE_DEFINITIONS) {
    const issues: string[] = []
    let indexedDbState: WorkspaceStorageHealthRecord["indexedDbState"] = "missing"
    let indexedDbUpdatedAt: number | null = null
    let libraryState: WorkspaceStorageHealthRecord["libraryState"] = "missing"

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
        const library = await inspectLibraryStateForDefinition(definition)
        libraryState = library.libraryState
        issues.push(...library.issues)
      } catch (error) {
        indexedDbState = "corrupted"
        libraryState = "corrupted"
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
      libraryState,
      indexedDbUpdatedAt,
      issues,
    })
  }

  return {
    dbName: WORKSPACE_DB_NAME,
    indexedDbAvailable: typeof indexedDB !== "undefined",
    indexedDbReachable,
    indexedDbRecordCount,
    libraryItemCount,
    librarySnapshotCount,
    libraryDocumentSnapshotCount,
    migrationJournalCount,
    legacyMappingCount,
    legacyStorageKeysPresent: LARGE_WORKSPACE_DEFINITIONS
      .filter((definition) => readStringStorage(definition.legacyStorageKey) !== null)
      .map((definition) => definition.legacyStorageKey),
    corruptedKeys: records
      .filter((record) => record.indexedDbState === "corrupted" || record.legacyState === "corrupted" || record.libraryState === "corrupted")
      .map((record) => record.key),
    records,
  }
}

export async function repairWorkspaceStorageCorruption(): Promise<WorkspaceStorageRepairReport> {
  const removedIndexedDbKeys: string[] = []
  const removedLibraryItemIds: string[] = []
  const removedLibrarySnapshotIds: string[] = []
  const removedLibraryDocumentSnapshotIds: string[] = []
  const removedMigrationJournalIds: string[] = []
  const removedLegacyMappingKeys: string[] = []
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
      if (stored) {
        const parsed = definition.schema.safeParse(stored.snapshot)
        if (!parsed.success) {
          await workspaceDb.workspaces.delete(definition.key)
          removedIndexedDbKeys.push(definition.key)
        }
      }

      const items = await workspaceDb.libraryItems.where("kind").equals(definition.kind).toArray()
      for (const item of items) {
        const parsedItem = LibraryItemSchema.safeParse(item)
        if (!parsedItem.success) {
          await workspaceDb.libraryItems.delete(item.id)
          await workspaceDb.libraryDocumentSnapshots.delete(item.id).catch(() => undefined)
          removedLibraryItemIds.push(item.id)
          removedLibraryDocumentSnapshotIds.push(item.id)
          continue
        }
        const snapshot = await workspaceDb.librarySnapshots.get(item.id)
        const documentSnapshot = await workspaceDb.libraryDocumentSnapshots.get(item.id)
        if (!item.removedAt && !snapshot && !documentSnapshot) {
          await workspaceDb.libraryItems.put(LibraryItemSchema.parse({
            ...item,
            removedAt: nowIso(),
            updatedAt: nowIso(),
          }))
          removedLibraryItemIds.push(item.id)
          continue
        }
        if (snapshot && !definition.schema.safeParse(snapshot.snapshot).success) {
          await workspaceDb.librarySnapshots.delete(item.id)
          removedLibrarySnapshotIds.push(item.id)
        }
        if (documentSnapshot && !LibraryDocumentSnapshotRecordSchema.safeParse(documentSnapshot).success) {
          await workspaceDb.libraryDocumentSnapshots.delete(item.id)
          removedLibraryDocumentSnapshotIds.push(item.id)
        }
      }
    } catch (error) {
      errors.push(`Failed to inspect IndexedDB key ${definition.key}: ${error instanceof Error ? error.message : "unknown error"}`)
    }
  }

  try {
    const journals = await workspaceDb.migrationJournal.toArray()
    for (const journal of journals) {
      if (!MigrationJournalRecordSchema.safeParse(journal).success) {
        await workspaceDb.migrationJournal.delete(journal.id)
        removedMigrationJournalIds.push(journal.id)
      }
    }
  } catch (error) {
    errors.push(`Failed to inspect migration journal: ${error instanceof Error ? error.message : "unknown error"}`)
  }

  try {
    const mappings = await workspaceDb.legacyMappings.toArray()
    for (const mapping of mappings) {
      if (!LegacyMappingRecordSchema.safeParse(mapping).success) {
        await workspaceDb.legacyMappings.delete(mapping.legacyKey)
        removedLegacyMappingKeys.push(mapping.legacyKey)
      }
    }
  } catch (error) {
    errors.push(`Failed to inspect legacy mappings: ${error instanceof Error ? error.message : "unknown error"}`)
  }

  return {
    removedIndexedDbKeys,
    removedLibraryItemIds,
    removedLibrarySnapshotIds,
    removedLibraryDocumentSnapshotIds,
    removedMigrationJournalIds,
    removedLegacyMappingKeys,
    clearedLegacyKeys,
    errors,
  }
}

export async function resetWorkspaceStorageLifecycle(): Promise<void> {
  try {
    workspaceDb.close()
    await workspaceDb.delete()
    await workspaceDb.open()
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
    VIDEO_NOTE_WORKSPACE_STORAGE_KEY,
  ]

  localKeys.forEach((key) => removeStorage(key))
}

export async function readImportLibrary(): Promise<ImportLibraryEntry[]> {
  const entries = await listLibraryItems()
  const snapshots = new Map((await listLibraryDocumentSnapshots(entries.map((item) => item.id))).map((snapshot) => [snapshot.libraryItemId, snapshot]))
  return entries
    .filter((item) => item.kind !== "asset")
    .map((item) => {
      const snapshot = snapshots.get(item.id) ?? null
      return ImportLibraryEntrySchema.parse({
        id: item.id,
        source: sourceForKind(item.kind),
        route: item.route,
        title: item.title,
        summary: item.summary,
        detail: item.detail,
        importedAt: item.importedAt,
        ownerMode: item.ownerMode,
        syncState: item.syncState,
        snapshotStatus: snapshot?.extractedText.status ?? null,
        requiresReimportForBinaryView: snapshot?.byteAvailability.requiresReimportForBinaryView ?? true,
      })
    })
    .sort((left, right) => new Date(right.importedAt).getTime() - new Date(left.importedAt).getTime())
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
