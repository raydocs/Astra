import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import type Book from "epubjs/types/book"
import type { NavItem } from "epubjs/types/navigation"

import type {
  AstraAccount,
  AstraContinuityDeleteCollection,
  AstraContinuityExportCollection,
  AstraDeviceIdentity,
  AstraPlan,
  AstraSession,
  AstraUsageSnapshot,
} from "@/types/auth"
import {
  formatAstraPlanLabel,
  formatAstraSubscriptionStatusLabel,
} from "@/utils/astra/account-surface"
import { summarizeConfigContinuity, type AstraConfig } from "@/types/config"
import type { PdfPage } from "@/entrypoints/pdf-reader/pdf-extractor"
import {
  detectDocumentFormat,
  exportBilingualSrt,
  exportBilingualVtt,
  exportMarkdownBilingual,
  formatLabel,
  parseDocument,
  parseSubtitles,
  type DocumentEntry,
  type FileFormat,
  type SubtitleCue,
} from "@/entrypoints/subtitle-reader/subtitle-parser"
import {
  clearTextTransferDraft,
  clearWebSession,
  createWebCloudDataDelete,
  createWebAnonymousSession,
  createWebContinuityExport,
  createWebSession,
  createWebVideoNoteJob,
  repairWebCloudSync,
  downloadWebContinuityExport,
  ensureWebDeviceIdentity,
  fetchWebAccountWorkspace,
  fetchWebCloudDataDeleteJob,
  fetchWebCloudAssets,
  fetchWebContinuityExportJob,
  fetchWebImportQueueObservability,
  fetchWebVideoNoteArtifact,
  fetchWebVideoNoteJob,
  importWebLibraryMetadataToAccount,
  mergeWebConfig,
  normalizeApiBaseUrl,
  openBillingCheckout,
  openBillingPortal,
  readApiBaseUrl,
  readArticleImportBaseUrl,
  readTextTransferDraft,
  readWebConfig,
  readWebSession,
  refreshWebSession,
  revokeWebDevice,
  revokeWebSession,
  saveApiBaseUrl,
  saveTextTransferDraft,
  saveWebSession,
  translateWithWebRelay,
  updateWebSyncCollectionPreference,
  replayWebImportJobs,
  type TextTransferDraft,
  type WebCloudAssetsWorkspace,
  type WebCloudDataDeleteJob,
  type WebContinuityExportJob,
  type WebDeviceEntry,
  type WebImportQueueObservability,
  type WebSyncRepairResult,
  type WebVideoNoteArtifact,
} from "./lib/astra-web"
import { importReadableArticleFromUrl } from "./lib/article-import"
import {
  clearArticleWorkspace,
  clearEpubWorkspace,
  clearPdfWorkspace,
  clearRecentImports,
  clearSubtitleWorkspace,
  clearTextWorkspaceDraft,
  clearVideoNoteWorkspace,
  configureLibraryAccountContext,
  inspectWorkspaceStorageHealth,
  listLibraryItems,
  markLibraryItemsImportedToAccount,
  openLibraryItem,
  readArticleWorkspace,
  readEpubWorkspace,
  readImportLibrary,
  readLastAccountEmail,
  readPdfWorkspace,
  readRecentImports,
  readSubtitleWorkspace,
  readTextWorkspaceDraft,
  readVideoNoteWorkspace,
  saveArticleWorkspace,
  saveEpubWorkspace,
  removeRecentImport,
  saveLastAccountEmail,
  savePdfWorkspace,
  saveRecentImport,
  saveSubtitleWorkspace,
  saveTextWorkspaceDraft,
  saveVideoNoteWorkspace,
  resetWorkspaceStorageLifecycle,
  repairWorkspaceStorageCorruption,
  removeLibraryItem,
  renameLibraryItem,
  writeLibraryDocumentSnapshotFromSync,
  type WorkspaceStorageHealthSnapshot,
  type ArticleWorkspaceSnapshot,
  type EpubChapterItem,
  type EpubChapterPreviewSnapshot,
  type EpubWorkspaceSnapshot,
  type ImportLibraryEntry,
  type PdfWorkspaceSnapshot,
  type RecentWebImport,
  type SubtitleWorkspaceSnapshot,
  type VideoNoteWorkspaceSnapshot,
} from "./lib/workspace-store"

type AppRoute = "/" | "/sign-in" | "/text" | "/articles" | "/files/pdf" | "/files/epub" | "/files/subtitles" | "/video-notes" | "/assets" | "/account"
type AuthState = "idle" | "refreshing" | "signing-in" | "signing-out"

const CONTINUITY_EXPORT_COLLECTION_OPTIONS: AstraContinuityExportCollection[] = [
  "config",
  "vocabulary",
  "review_schedule",
  "reading_history",
  "study_progress",
]
const CONTINUITY_DELETE_COLLECTION_OPTIONS: AstraContinuityDeleteCollection[] = [
  "vocabulary",
  "review_schedule",
  "reading_history",
  "study_progress",
]

interface NavigationItem {
  route: AppRoute
  label: string
  detail: string
}

interface PdfPagePreview {
  pageNumber: number
  excerpt: string
  blocks: string[]
  blockCount: number
  wordCount: number
}

interface PdfPreviewState {
  name: string
  sizeLabel: string
  pageCount: number
  selectedPageNumber: number
  pages: PdfPagePreview[]
  importedAt: string
  restored: boolean
}

const ASTRA_CERT_PDF_ROWS: WorkspaceSurfaceRow[] = [
  {
    title: "Calvino · Six memos for the next millennium.pdf",
    meta: "12 MB · 124 pages",
    lang: "IT → EN",
    progress: 38,
  },
  {
    title: "The Anatomy of Type — a primer.pdf",
    meta: "8 MB · 56 pages",
    lang: "EN → 中文",
    progress: 100,
    statusLabel: "done",
  },
  {
    title: "宇野常寛 · ゼロ年代の想像力.pdf",
    meta: "21 MB · 318 pages",
    lang: "JP → EN",
    progress: 0,
    statusLabel: "new",
  },
]

const ASTRA_CERT_WORKSPACE_SURFACE_CARDS: Array<{
  route: string
  title: string
  kind: string
  tone?: "accent" | "muted" | "ok" | "warn"
  rows: WorkspaceSurfaceRow[]
  emptyHint: string
}> = [
  {
    route: "/files/pdf",
    title: "PDFs",
    kind: "documents",
    tone: "accent",
    rows: ASTRA_CERT_PDF_ROWS,
    emptyHint: "First drop replaces this with an empty state. Page-range translation lives in the reader, not here.",
  },
  {
    route: "/files/epub",
    title: "EPUBs",
    kind: "books",
    tone: "accent",
    rows: [
      { title: "Hilary Mantel · Wolf Hall.epub", meta: "1.4 MB · ch. 14 of 32", lang: "EN → 中文", progress: 42 },
      { title: "Italo Calvino · Le città invisibili.epub", meta: "0.8 MB · ch. 6 of 11", lang: "IT → EN", progress: 54 },
      { title: "村上春樹 · ノルウェイの森.epub", meta: "1.1 MB · ch. 2 of 12", lang: "JP → EN", progress: 16 },
    ],
    emptyHint: "EPUB chapters open in the Reader; the row links to the last chapter you read.",
  },
  {
    route: "/files/subtitles",
    title: "Subtitles",
    kind: "srt · vtt",
    tone: "accent",
    rows: [
      { title: "Chungking Express · 1994 · BluRay.srt", meta: "1,247 cues · 1h 42m", lang: "中文 → EN", progress: 100 },
      { title: "Drive My Car · 2021.vtt", meta: "1,963 cues · 2h 59m", lang: "JP → EN", progress: 22 },
      { title: "Petite Maman · 2021 · FR.srt", meta: "842 cues · 1h 12m", lang: "FR → EN", progress: 0 },
    ],
    emptyHint: "Subtitles open as bilingual reading sessions, paced by timecode rather than paragraph.",
  },
  {
    route: "/video-notes",
    title: "Video notes",
    kind: "timestamps",
    tone: "accent",
    rows: [
      { title: "Lex Fridman × Murakami (excerpts).txt", meta: "32 notes · 1h 18m", lang: "JP → EN", progress: 64 },
      { title: "Tsutaya · interview with K. Tanikawa.txt", meta: "11 notes · 24m", lang: "JP → EN", progress: 100 },
      { title: "Architecture school · Junya Ishigami.txt", meta: "8 notes · 38m", lang: "JP → EN", progress: 0 },
    ],
    emptyHint: "Notes you took from a video — paired with timestamps you can jump back to.",
  },
]

const ASTRA_CERT_WORKSPACE_ASSETS = [
  ["marginalia · saved deck", "284 words"],
  ["Wolf Hall · ch.14 excerpt", "8 highlights"],
  ["六龜山隧道.jpg", "shared 2026"],
  ["Calvino · cover.png", "imported"],
  ["Drive My Car · ED", "video still"],
  ["+ new asset", "drop a file"],
] as const

const ASTRA_CERT_PDF_PREVIEW: PdfPreviewState = {
  name: "Calvino · Six memos for the next millennium.pdf",
  sizeLabel: "12 MB",
  pageCount: 124,
  selectedPageNumber: 47,
  importedAt: "2026-03-21T20:42:00.000Z",
  restored: false,
  pages: [
    {
      pageNumber: 47,
      excerpt: "Lightness, quickness, exactitude — each memo becomes a way to keep thought agile without losing precision.",
      blocks: [
        "Lightness for me goes with precision and determination, not with vagueness and the haphazard.",
        "Astra keeps the current page as a reading surface: extracted paragraphs stay inspectable, resumable, and ready to send into a bilingual text workspace.",
        "This certification seed is local-only demo content. It exists so screenshots show the populated density of a real PDF library row without changing user storage.",
      ],
      blockCount: 3,
      wordCount: 63,
    },
    {
      pageNumber: 48,
      excerpt: "The memo continues with a short passage about momentum, exactness, and reader attention.",
      blocks: [
        "Quickness is not haste; it is the ability to move among ideas while preserving their shape.",
      ],
      blockCount: 1,
      wordCount: 17,
    },
  ],
}

const ASTRA_CERT_ASSET_TILES = [
  { id: "cert-asset-deck", title: "marginalia · saved deck", meta: "284 words", route: "/assets" as AppRoute, tone: "local" },
  { id: "cert-asset-wolf-hall", title: "Wolf Hall · ch.14 excerpt", meta: "8 highlights", route: "/files/epub" as AppRoute, tone: "history" },
  { id: "cert-asset-tunnel", title: "六龜山隧道.jpg", meta: "shared 2026", route: "/assets" as AppRoute, tone: "history" },
  { id: "cert-asset-calvino", title: "Calvino · cover.png", meta: "imported", route: "/files/pdf" as AppRoute, tone: "local" },
  { id: "cert-asset-drive", title: "Drive My Car · ED", meta: "video still", route: "/video-notes" as AppRoute, tone: "vocab" },
  { id: "cert-asset-new", title: "+ new asset", meta: "drop a file", route: "/assets" as AppRoute, tone: "empty" },
]

const ASTRA_CERT_IMPORT_LIBRARY: ImportLibraryEntry[] = [
  {
    id: "cert-library-pdf",
    source: "pdf",
    route: "/files/pdf",
    title: "Calvino · Six memos for the next millennium.pdf",
    summary: "124 pages · 486 text blocks",
    detail: "Last opened page 47 · IT → EN",
    importedAt: "2026-03-21T20:42:00.000Z",
    ownerMode: "local",
    syncState: "local_only",
    snapshotStatus: "available",
    requiresReimportForBinaryView: true,
  },
  {
    id: "cert-library-epub",
    source: "epub",
    route: "/files/epub",
    title: "Wolf Hall · ch.14 excerpt",
    summary: "Chapter 14 · 8 highlights",
    detail: "Saved deck preview with bilingual marginalia excerpts.",
    importedAt: "2026-03-20T17:12:00.000Z",
    ownerMode: "local",
    syncState: "local_only",
    snapshotStatus: "available",
    requiresReimportForBinaryView: true,
  },
]

const ASTRA_CERT_READING_HISTORY = [
  {
    id: "cert-history-1",
    title: "Why I Still Carry a Notebook",
    hostname: "theatlantic.com",
    wordsTranslated: 1840,
    visitedAt: Date.parse("2026-03-21T18:30:00.000Z"),
  },
  {
    id: "cert-history-2",
    title: "The Quiet Year of Solitude",
    hostname: "newyorker.com",
    wordsTranslated: 1260,
    visitedAt: Date.parse("2026-03-20T09:15:00.000Z"),
  },
]

const ASTRA_CERT_STUDY_PAGES = [
  {
    url: "https://newyorker.com/quiet-year",
    title: "The Quiet Year of Solitude",
    hostname: "newyorker.com",
    completedSteps: ["read", "guided_read", "explain", "vocab_save"],
  },
  {
    url: "astra-local://pdf/calvino-six-memos",
    title: "Calvino · Six memos",
    hostname: "local pdf",
    completedSteps: ["read", "vocab_save", "vocab_review"],
  },
]

const ASTRA_CERT_VOCABULARY = [
  {
    id: "cert-vocab-1",
    text: "marginalia",
    translation: "页边批注；旁注",
    explanation: "notes kept in the margin of a text",
    hostname: "newyorker.com",
  },
  {
    id: "cert-vocab-2",
    text: "unalterable",
    translation: "无法改变的；不可动摇的",
    explanation: "not able to be changed",
    hostname: "newyorker.com",
  },
  {
    id: "cert-vocab-3",
    text: "hush",
    translation: "近乎屏息的安静",
    explanation: "a quiet stillness",
    hostname: "theatlantic.com",
  },
]

interface ArticleWorkspaceState extends ArticleWorkspaceSnapshot {
  restored: boolean
}

interface EpubPreviewState {
  name: string
  title: string
  author: string
  chapters: EpubChapterItem[]
  loadedChapters: EpubChapterPreviewSnapshot[]
  selectedChapterHref: string | null
  importedAt: string
  restored: boolean
}

interface SubtitleWorkspaceState {
  fileName: string
  format: Exclude<FileFormat, "unknown">
  cues: SubtitleCue[]
  documents: DocumentEntry[]
  translations: Map<number, string>
  importedAt: string
  lastExportedAt: string | null
  restored: boolean
}

const NAV_ITEMS: NavigationItem[] = [
  { route: "/", label: "Overview", detail: "usable MVP" },
  { route: "/text", label: "Text", detail: "translate / explain" },
  { route: "/articles", label: "Articles", detail: "URL import + read-only" },
  { route: "/files/pdf", label: "PDF", detail: "reader + resume" },
  { route: "/files/epub", label: "EPUB", detail: "chapter reader" },
  { route: "/files/subtitles", label: "Subtitle & docs", detail: "translate + export" },
  { route: "/video-notes", label: "Video notes", detail: "job + artifact viewer" },
  { route: "/assets", label: "Assets", detail: "library + details" },
  { route: "/account", label: "Account", detail: "session / usage / billing" },
]

const PUBLIC_ONLY_ROUTES = ["/sign-in"] as const satisfies readonly AppRoute[]

const PORTABLE_SURFACES = [
  "text translation, explain, and custom prompts",
  "URL article import with readable extraction and local resume",
  "resumable PDF / EPUB / subtitle workspaces",
  "recent imports and explicit file-to-text handoff",
  "account, quota, billing, sync health, and read-only cloud continuity surfaces",
]

const EXTENSION_ONLY_SURFACES = [
  "live webpage translation on third-party pages",
  "hover, selection, and input-box overlays",
  "tab-aware page controls and browser commands",
  "live site subtitle overlays and frame coordination",
]

function isRoute(value: string): value is AppRoute {
  return NAV_ITEMS.some((item) => item.route === value) || PUBLIC_ONLY_ROUTES.some((route) => route === value)
}

async function loadPdfExtractor() {
  return import("@/entrypoints/pdf-reader/pdf-extractor")
}

async function loadEpubModule() {
  return import("epubjs")
}

function parseHashLocation(): { route: AppRoute; searchParams: URLSearchParams } {
  const raw = window.location.hash.replace(/^#/, "") || "/"
  const [rawRoute, rawQuery = ""] = raw.split("?", 2)
  const route = isRoute(rawRoute) ? rawRoute : "/"
  return {
    route,
    searchParams: new URLSearchParams(rawQuery),
  }
}

function readAstraCertificationParams(): { enabled: boolean; certState: string | null } {
  const searchParams = new URLSearchParams()
  const hashParams = new URLSearchParams()
  try {
    new URLSearchParams(window.location.search).forEach((value, key) => searchParams.set(key, value))
    parseHashLocation().searchParams.forEach((value, key) => hashParams.set(key, value))
  } catch {
    return { enabled: false, certState: null }
  }

  return {
    enabled: searchParams.get("astraCert") === "1" || hashParams.get("astraCert") === "1",
    certState: hashParams.get("certState")?.trim() || searchParams.get("certState")?.trim() || null,
  }
}

function readRouteFromHash(): AppRoute {
  return parseHashLocation().route
}

function readVideoNoteJobIdFromHash(): string {
  const location = parseHashLocation()
  if (location.route !== "/video-notes") return ""
  return location.searchParams.get("jobId")?.trim() ?? ""
}

function navigate(route: AppRoute) {
  window.location.hash = route
}

function formatRelativeDate(value: string | null | undefined): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}

function formatNumber(value: number | null | undefined): string {
  return new Intl.NumberFormat().format(value ?? 0)
}

function formatDeviceHost(device: Pick<WebDeviceEntry, "browserFamily" | "platform" | "appKind" | "appVersion">): string {
  const segments = [device.browserFamily, device.platform, device.appKind, device.appVersion].filter(Boolean)
  return segments.length > 0 ? segments.join(" · ") : "Unknown client"
}

function formatStudyStepLabel(step: string): string {
  return step.replace(/_/g, " ")
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

function formatDurationMs(value: number | null | undefined): string {
  if (value == null || value <= 0) return "—"
  if (value < 1000) return `${Math.round(value)} ms`
  const seconds = value / 1000
  if (seconds < 60) return `${seconds.toFixed(1)} s`
  const minutes = seconds / 60
  if (minutes < 60) return `${minutes.toFixed(1)} min`
  return `${(minutes / 60).toFixed(1)} h`
}

function countWords(text: string): number {
  const trimmed = text.trim()
  return trimmed ? trimmed.split(/\s+/).length : 0
}

function downloadBlobFile(fileName: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = fileName
  document.body.append(anchor)
  anchor.click()
  window.setTimeout(() => {
    URL.revokeObjectURL(url)
    anchor.remove()
  }, 0)
}

function downloadTextFile(fileName: string, content: string) {
  downloadBlobFile(fileName, new Blob([content], { type: "text/plain;charset=utf-8" }))
}

function readLifecycleErrorMessage(reason: unknown, fallback: string): string {
  if (reason instanceof Error && reason.message.trim()) {
    return reason.message.trim()
  }
  return fallback
}

function formatLifecycleActionError(
  action: "export_create" | "export_refresh" | "export_download" | "delete_create" | "delete_refresh" | "repair" | "revoke",
  reason: unknown,
): string {
  const message = readLifecycleErrorMessage(reason, "Unexpected lifecycle failure.")

  switch (action) {
    case "export_create":
      return `Continuity export failed. ${message} Refresh status once; if no queued job appears, create a fresh export.`
    case "export_refresh":
      return `Continuity export status refresh failed. ${message} Treat the export as pending until a refresh or a new export proves otherwise.`
    case "export_download":
      return `Continuity export download failed. ${message} If the artifact is expired or not ready, refresh status and create a new export if needed.`
    case "delete_create":
      return `Cloud delete scheduling failed. ${message} Destructive deletes stay scheduled until the grace window expires, so confirm the selected collections and retry.`
    case "delete_refresh":
      return `Cloud delete status refresh failed. ${message} Treat the delete as pending until the Worker reports completed, failed, or canceled.`
    case "repair":
      return `Cloud sync repair failed. ${message} Refresh the cloud snapshot first; if the failure persists after auth or cursor recovery, escalate.`
    case "revoke":
      return `Device revoke failed. ${message} Refresh the device list once before retrying; if the target already disappeared, trust the refreshed state.`
    default:
      return message
  }
}

function describeContinuityExportJob(job: WebContinuityExportJob): string {
  switch (job.status) {
    case "queued":
      return "Queued in the lifecycle worker. Wait for polling or refresh status before treating the export as missing."
    case "running":
      return "The export bundle is building now. Leave the job in place until it either completes or fails."
    case "completed":
      return job.expiresAt
        ? `Ready to download until ${formatRelativeDate(job.expiresAt)}.`
        : "Ready to download now."
    case "failed":
      return `Export failed${job.error?.code ? ` (${job.error.code})` : ""}. Refresh once, then create a new export if the failure is persistent.`
    case "expired":
      return "The export artifact expired. Create a fresh export before promising that a download still exists."
    default:
      return "No export lifecycle state available yet."
  }
}

function describeCloudDeleteJob(job: WebCloudDataDeleteJob): string {
  switch (job.status) {
    case "scheduled":
      return `Deletion is scheduled for ${formatRelativeDate(job.scheduledForAt)}. Do not describe this as already deleted.`
    case "queued":
      return "The grace window elapsed and the delete job is queued. Wait for completion before claiming cloud data is removed."
    case "running":
      return "Deletion is running now. Wait for completed status and deleted-record counts before closing the incident."
    case "completed":
      return "Delete mutations were appended. Clients still need normal sync pull to observe the removal."
    case "failed":
      return `Delete failed${job.error?.code ? ` (${job.error.code})` : ""}. Keep the data treated as present until a later completed job proves removal.`
    case "canceled":
      return "Deletion was canceled during the grace window. No removal should be claimed from this job."
    default:
      return "No cloud delete lifecycle state available yet."
  }
}

function flattenNavItems(items: NavItem[], depth = 0): EpubChapterItem[] {
  const flattened: EpubChapterItem[] = []

  items.forEach((item) => {
    const label = item.label?.trim() || item.href?.trim() || `Chapter ${flattened.length + 1}`
    if (item.href?.trim()) {
      flattened.push({
        href: item.href,
        label,
        depth,
      })
    }

    if (Array.isArray(item.subitems) && item.subitems.length > 0) {
      flattened.push(...flattenNavItems(item.subitems, depth + 1))
    }
  })

  const seen = new Set<string>()
  return flattened.filter((item) => {
    if (seen.has(item.href)) return false
    seen.add(item.href)
    return true
  })
}

function createPdfPagePreview(page: PdfPage): PdfPagePreview {
  const blocks = page.blocks.map((block) => block.text.trim()).filter(Boolean)
  const combined = blocks.join("\n\n")
  return {
    pageNumber: page.pageNumber,
    excerpt: blocks.slice(0, 2).join(" ").slice(0, 220) || `Page ${page.pageNumber}`,
    blocks,
    blockCount: blocks.length,
    wordCount: countWords(combined),
  }
}

function createPdfPreviewState(file: File, pages: PdfPage[]): PdfPreviewState {
  const pagePreviews = pages.map(createPdfPagePreview)
  return {
    name: file.name,
    sizeLabel: formatBytes(file.size),
    pageCount: pagePreviews.length,
    selectedPageNumber: pagePreviews[0]?.pageNumber ?? 1,
    pages: pagePreviews,
    importedAt: new Date().toISOString(),
    restored: false,
  }
}

function toPdfWorkspaceSnapshot(preview: PdfPreviewState): PdfWorkspaceSnapshot {
  return {
    fileName: preview.name,
    sizeLabel: preview.sizeLabel,
    pageCount: preview.pageCount,
    selectedPageNumber: preview.selectedPageNumber,
    pages: preview.pages,
    importedAt: preview.importedAt,
  }
}

function fromPdfWorkspaceSnapshot(snapshot: PdfWorkspaceSnapshot): PdfPreviewState {
  return {
    name: snapshot.fileName,
    sizeLabel: snapshot.sizeLabel,
    pageCount: snapshot.pageCount,
    selectedPageNumber: snapshot.selectedPageNumber,
    pages: snapshot.pages,
    importedAt: snapshot.importedAt,
    restored: true,
  }
}

async function loadEpubChapterPreview(book: Book, chapter: EpubChapterItem): Promise<EpubChapterPreviewSnapshot | null> {
  const baseHref = chapter.href.split("#")[0]
  const section = book.spine.get(chapter.href) ?? book.spine.get(baseHref)
  if (!section) return null

  await Promise.resolve(section.load(book.load.bind(book)))
  const doc = section.document
  if (!doc) return null

  const paragraphs: string[] = []
  doc.querySelectorAll("h1, h2, h3, h4, p, li, blockquote, pre").forEach((node) => {
    const text = node.textContent?.replace(/\s+/g, " ").trim()
    if (text && text.length > 0) {
      paragraphs.push(text)
    }
  })

  section.unload?.()

  if (paragraphs.length === 0) return null

  const combined = paragraphs.join("\n\n")
  return {
    ...chapter,
    paragraphs,
    excerpt: paragraphs.slice(0, 2).join(" ").slice(0, 240),
    wordCount: countWords(combined),
  }
}

function toEpubWorkspaceSnapshot(preview: EpubPreviewState): EpubWorkspaceSnapshot {
  return {
    fileName: preview.name,
    title: preview.title,
    author: preview.author,
    selectedChapterHref: preview.selectedChapterHref,
    chapters: preview.chapters,
    loadedChapters: preview.loadedChapters,
    importedAt: preview.importedAt,
  }
}

function fromEpubWorkspaceSnapshot(snapshot: EpubWorkspaceSnapshot): EpubPreviewState {
  return {
    name: snapshot.fileName,
    title: snapshot.title,
    author: snapshot.author,
    selectedChapterHref: snapshot.selectedChapterHref,
    chapters: snapshot.chapters,
    loadedChapters: snapshot.loadedChapters,
    importedAt: snapshot.importedAt,
    restored: true,
  }
}

function toSubtitleWorkspaceSnapshot(workspace: SubtitleWorkspaceState): SubtitleWorkspaceSnapshot {
  return {
    fileName: workspace.fileName,
    format: workspace.format,
    cues: workspace.cues,
    documents: workspace.documents,
    translations: Array.from(workspace.translations.entries()).map(([index, text]) => ({ index, text })),
    importedAt: workspace.importedAt,
    lastExportedAt: workspace.lastExportedAt,
  }
}

function fromSubtitleWorkspaceSnapshot(snapshot: SubtitleWorkspaceSnapshot): SubtitleWorkspaceState {
  return {
    fileName: snapshot.fileName,
    format: snapshot.format,
    cues: snapshot.cues,
    documents: snapshot.documents,
    translations: new Map(snapshot.translations.map((entry) => [entry.index, entry.text])),
    importedAt: snapshot.importedAt,
    lastExportedAt: snapshot.lastExportedAt,
    restored: true,
  }
}

function summarizePdfImport(preview: PdfPreviewState): RecentWebImport {
  const blockCount = preview.pages.reduce((sum, page) => sum + page.blockCount, 0)
  return {
    source: "pdf",
    route: "/files/pdf",
    title: preview.name,
    summary: `${formatNumber(preview.pageCount)} pages · ${formatNumber(blockCount)} blocks`,
    detail: `Saved ${formatRelativeDate(preview.importedAt)}`,
    importedAt: preview.importedAt,
  }
}

function summarizeEpubImport(preview: EpubPreviewState): RecentWebImport {
  return {
    source: "epub",
    route: "/files/epub",
    title: preview.title,
    summary: `${preview.author} · ${formatNumber(preview.chapters.length)} chapters`,
    detail: `Saved ${formatRelativeDate(preview.importedAt)}`,
    importedAt: preview.importedAt,
  }
}

function summarizeSubtitleImport(workspace: SubtitleWorkspaceState): RecentWebImport {
  const isDocument = workspace.format === "markdown" || workspace.format === "txt" || workspace.format === "html"
  const count = isDocument ? workspace.documents.length : workspace.cues.length
  return {
    source: "subtitle",
    route: "/files/subtitles",
    title: workspace.fileName,
    summary: `${formatLabel(workspace.format)} · ${formatNumber(count)} ${isDocument ? "paragraphs" : "cues"}`,
    detail: workspace.lastExportedAt
      ? `Last export ${formatRelativeDate(workspace.lastExportedAt)}`
      : `Saved ${formatRelativeDate(workspace.importedAt)}`,
    importedAt: workspace.importedAt,
  }
}

function summarizeArticleImport(workspace: ArticleWorkspaceState): RecentWebImport {
  return {
    source: "article",
    route: "/articles",
    title: workspace.title,
    summary: `${workspace.hostname} · ${formatNumber(workspace.blocks.length)} reading blocks`,
    detail: `Saved ${formatRelativeDate(workspace.importedAt)}`,
    importedAt: workspace.importedAt,
  }
}

function useInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [installState, setInstallState] = useState<"idle" | "installing" | "accepted" | "dismissed">("idle")

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setInstallEvent(event as BeforeInstallPromptEvent)
    }

    const handleInstalled = () => {
      setInstallState("accepted")
      setInstallEvent(null)
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
    window.addEventListener("appinstalled", handleInstalled)
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
      window.removeEventListener("appinstalled", handleInstalled)
    }
  }, [])

  const promptInstall = useCallback(async () => {
    if (!installEvent) return

    setInstallState("installing")
    await installEvent.prompt()
    const result = await installEvent.userChoice
    setInstallState(result.outcome === "accepted" ? "accepted" : "dismissed")
    if (result.outcome === "accepted") {
      setInstallEvent(null)
    }
  }, [installEvent])

  return {
    canInstall: Boolean(installEvent),
    installState,
    promptInstall,
  }
}

interface WorkspaceSurfaceRow {
  title: string
  meta: string
  lang: string
  progress?: number
  statusLabel?: string
  onOpen?: () => void
  onRename?: () => void
  onRemove?: () => void
}

function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value)))
}

function WorkspaceProgressBar(props: { value: number; label: string }) {
  const value = clampProgress(props.value)
  return (
    <div className="workspace-progress" role="progressbar" aria-label={props.label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
      <span style={{ width: `${value}%` }} />
    </div>
  )
}

function WorkspaceSurfaceRows(props: {
  route: string
  title: string
  kind: string
  emptyHint: string
  rows: WorkspaceSurfaceRow[]
}) {
  return (
    <section className="workspace-route-card">
      <header className="workspace-route-card__header">
        <div>
          <div className="workspace-mono">{props.route}</div>
          <h2>{props.title}</h2>
        </div>
        <span className="status-pill">{props.kind}</span>
      </header>
      {props.rows.length === 0 ? (
        <div className="workspace-empty-row">{props.emptyHint}</div>
      ) : (
        <div className="workspace-row-list">
          {props.rows.map((row, index) => {
            const content = (
              <>
                <div>
                  <div className="workspace-row-title">{row.title}</div>
                  <div className="workspace-mono">{row.meta}</div>
                </div>
                <div className="workspace-mono">{row.lang}</div>
                <div className="workspace-row-progress">
                  {typeof row.progress !== "number" ? (
                    <span className="status-pill muted">{row.statusLabel ?? "ready"}</span>
                  ) : row.progress >= 100 ? (
                    <span className="status-pill success">{row.statusLabel ?? "done"}</span>
                  ) : row.progress <= 0 ? (
                    <span className="status-pill muted">{row.statusLabel ?? "new"}</span>
                  ) : (
                    <>
                      <div className="workspace-mono">{clampProgress(row.progress)}%</div>
                      <WorkspaceProgressBar value={row.progress} label={`${row.title} progress`} />
                    </>
                  )}
                </div>
              </>
            )

            return row.onOpen ? (
              <div key={`${row.title}-${index}`} className="workspace-row workspace-row--button">
                <button type="button" className="workspace-row__main" onClick={row.onOpen}>
                  {content}
                </button>
                {(row.onRename || row.onRemove) && (
                  <div className="row gap wrap">
                    {row.onRename && <button type="button" className="button ghost compact-button" onClick={row.onRename}>Rename</button>}
                    {row.onRemove && <button type="button" className="button ghost compact-button" onClick={row.onRemove}>Remove</button>}
                  </div>
                )}
              </div>
            ) : (
              <div key={`${row.title}-${index}`} className="workspace-row">
                {content}
                {(row.onRename || row.onRemove) && (
                  <div className="row gap wrap">
                    {row.onRename && <button type="button" className="button ghost compact-button" onClick={row.onRename}>Rename</button>}
                    {row.onRemove && <button type="button" className="button ghost compact-button" onClick={row.onRemove}>Remove</button>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

function WorkspaceCertificationTag(props: {
  tone?: "accent" | "muted" | "ok" | "warn"
  children: React.ReactNode
}) {
  return <span className={`workspace-cert-tag workspace-cert-tag--${props.tone ?? "muted"}`}>{props.children}</span>
}

function WorkspaceCertificationRouteCard(props: {
  route: string
  title: string
  kind: string
  tone?: "accent" | "muted" | "ok" | "warn"
  rows: WorkspaceSurfaceRow[]
  emptyHint: string
}) {
  return (
    <section className="workspace-cert-route-card">
      <header className="workspace-cert-route-card__header">
        <div className="workspace-cert-route-card__meta">
          <span className="workspace-cert-mono workspace-cert-route">{props.route}</span>
          <WorkspaceCertificationTag tone={props.tone}>{props.kind}</WorkspaceCertificationTag>
        </div>
        <h2>{props.title}</h2>
      </header>

      <div className="workspace-cert-row-list">
        {props.rows.map((row) => (
          <div key={`${props.route}-${row.title}`} className="workspace-cert-row">
            <div>
              <div className="workspace-cert-row-title">{row.title}</div>
              <span className="workspace-cert-mono workspace-cert-row-meta">{row.meta}</span>
            </div>
            <span className="workspace-cert-mono workspace-cert-row-lang">{row.lang}</span>
            <div>
              {row.progress === 100 ? (
                <WorkspaceCertificationTag tone="ok">done</WorkspaceCertificationTag>
              ) : row.progress === 0 ? (
                <WorkspaceCertificationTag>new</WorkspaceCertificationTag>
              ) : (
                <span className="workspace-cert-mono workspace-cert-row-progress">{clampProgress(row.progress ?? 0)}%</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="workspace-cert-empty-hint">{props.emptyHint}</div>
    </section>
  )
}

function WorkspaceSurfacesCertificationPage() {
  return (
    <main className="workspace-surfaces-cert-page" aria-label="Astra workspace surfaces certification plate">
      <section className="workspace-surfaces-cert-hero">
        <div className="workspace-cert-eyebrow">Q · Workspace surfaces · files · video · assets</div>
        <h1>The Library row template, four ways.</h1>
        <p>
          The remaining workspace routes inherit Library&apos;s row design. Only the type column and empty-state copy change. This
          plate locks the four variations so engineering doesn&apos;t re-design a list page per route.
        </p>
      </section>

      <section className="workspace-cert-route-grid" aria-label="Files and video workspace row templates">
        {ASTRA_CERT_WORKSPACE_SURFACE_CARDS.map((card) => (
          <WorkspaceCertificationRouteCard key={card.route} {...card} />
        ))}
      </section>

      <section className="workspace-cert-assets-card" aria-label="Assets workspace thumbnail grid">
        <header className="workspace-cert-assets-card__header">
          <div>
            <span className="workspace-cert-mono workspace-cert-route">/assets</span>
            <h2>Assets — the images, exports, and shared decks</h2>
          </div>
          <WorkspaceCertificationTag tone="warn">grid layout · not the row template</WorkspaceCertificationTag>
        </header>

        <div className="workspace-cert-asset-grid">
          {ASTRA_CERT_WORKSPACE_ASSETS.map(([title, meta], index) => (
            <div
              key={title}
              className={`workspace-cert-asset-tile${index === ASTRA_CERT_WORKSPACE_ASSETS.length - 1 ? " workspace-cert-asset-tile--empty" : ""}`}
              style={{ "--workspace-cert-asset-hue": `${60 + index * 28}` } as React.CSSProperties}
            >
              <div className="workspace-cert-asset-title">{title}</div>
              <span className="workspace-cert-mono workspace-cert-asset-meta">{meta}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="workspace-cert-note-row" aria-label="Workspace surface certification notes">
        <WorkspaceCertificationTag tone="accent">/files/* and /video-notes share Library&apos;s row template — only the type column changes</WorkspaceCertificationTag>
        <WorkspaceCertificationTag tone="accent">/assets is a thumbnail grid — different shape, same paper surface</WorkspaceCertificationTag>
        <WorkspaceCertificationTag tone="warn">Bulk select / delete + drag-to-import live in workspace v2</WorkspaceCertificationTag>
      </section>
    </main>
  )
}

export function AstraWebApp() {
  const [route, setRoute] = useState<AppRoute>(() => readRouteFromHash())
  const [videoNoteDeepLinkedJobId, setVideoNoteDeepLinkedJobId] = useState<string>(() => readVideoNoteJobIdFromHash())
  const [apiBaseUrl, setApiBaseUrl] = useState(() => readApiBaseUrl())
  const [device] = useState<AstraDeviceIdentity>(() => ensureWebDeviceIdentity())
  const [config, setConfig] = useState<AstraConfig>(() => readWebConfig())
  const [session, setSession] = useState<AstraSession | null>(() => readWebSession())
  const [account, setAccount] = useState<AstraAccount | null>(null)
  const [usage, setUsage] = useState<AstraUsageSnapshot | null>(null)
  const [devices, setDevices] = useState<WebDeviceEntry[]>([])
  const [deviceActionBusyId, setDeviceActionBusyId] = useState<string | null>(null)
  const [recentImports, setRecentImports] = useState<RecentWebImport[]>(() => readRecentImports())
  const [cloudAssets, setCloudAssets] = useState<WebCloudAssetsWorkspace | null>(null)
  const [cloudState, setCloudState] = useState<"idle" | "loading" | "ready" | "error">("idle")
  const [cloudError, setCloudError] = useState("")
  const [importOps, setImportOps] = useState<WebImportQueueObservability | null>(null)
  const [importOpsState, setImportOpsState] = useState<"idle" | "loading" | "ready" | "error">("idle")
  const [importOpsError, setImportOpsError] = useState("")
  const [operatorToken, setOperatorToken] = useState("")
  const [storageHealth, setStorageHealth] = useState<WorkspaceStorageHealthSnapshot | null>(null)
  const [storageHealthState, setStorageHealthState] = useState<"idle" | "loading" | "ready" | "error">("idle")
  const [storageHealthError, setStorageHealthError] = useState("")
  const [recoveryState, setRecoveryState] = useState<"idle" | "running">("idle")
  const [bootState, setBootState] = useState<"loading" | "ready">("loading")
  const [authState, setAuthState] = useState<AuthState>("idle")
  const [message, setMessage] = useState<string>("")
  const [lastWorkspaceRefreshAt, setLastWorkspaceRefreshAt] = useState<string | null>(null)
  const visibilityRefreshAtRef = useRef<number>(0)
  const cloudRequestIdRef = useRef(0)

  const installPrompt = useInstallPrompt()

  useEffect(() => {
    const onHashChange = () => {
      setRoute(readRouteFromHash())
      setVideoNoteDeepLinkedJobId(readVideoNoteJobIdFromHash())
    }
    window.addEventListener("hashchange", onHashChange)
    return () => window.removeEventListener("hashchange", onHashChange)
  }, [])

  useEffect(() => {
    configureLibraryAccountContext(session?.email ?? null)
  }, [session?.email])

  useEffect(() => {
    if (!session && route === "/") {
      document.title = "Astra · A bilingual reading room"
      return
    }

    const routeLabel = route === "/sign-in" ? "Sign in" : NAV_ITEMS.find((item) => item.route === route)?.label ?? "Overview"
    document.title = `${routeLabel} · Astra Web`
  }, [route, session])

  const saveRoute = useCallback((nextRoute: AppRoute) => {
    navigate(nextRoute)
  }, [])

  const refreshRecentImports = useCallback(() => {
    setRecentImports(readRecentImports())
  }, [])

  const updateConfig = useCallback((patch: Parameters<typeof mergeWebConfig>[1]) => {
    setConfig((current) => mergeWebConfig(current, patch))
  }, [])

  const refreshAuthenticatedWorkspace = useCallback(async (activeSession: AstraSession, activeDevice: AstraDeviceIdentity) => {
    const workspace = await fetchWebAccountWorkspace({
      session: activeSession,
      device: activeDevice,
    })

    setAccount(workspace.account)
    setUsage(workspace.usage)
    setDevices((current) => workspace.devices ?? current)
    if (workspace.deviceError) {
      setMessage(workspace.deviceError)
    }
    setLastWorkspaceRefreshAt(new Date().toISOString())
  }, [])

  const clearCloudAssets = useCallback(() => {
    cloudRequestIdRef.current += 1
    setCloudAssets(null)
    setCloudState("idle")
    setCloudError("")
  }, [])

  const refreshCloudAssets = useCallback(async (activeSession: AstraSession | null) => {
    if (!activeSession) {
      clearCloudAssets()
      return
    }

    const requestId = ++cloudRequestIdRef.current
    setCloudState("loading")
    setCloudError("")

    try {
      const next = await fetchWebCloudAssets({
        session: activeSession,
        device,
      })
      const cloudItemsById = new Map(next.library.items.map((item) => [item.id, item]))
      await Promise.all(next.library.snapshots.map((snapshot) => {
        const item = cloudItemsById.get(snapshot.libraryItemId)
        if (!item || !snapshot.complete) return Promise.resolve(null)
        return writeLibraryDocumentSnapshotFromSync({ item, manifest: snapshot.manifest, chunks: snapshot.chunks })
      }))
      if (cloudRequestIdRef.current !== requestId) return
      setCloudAssets(next)
      setCloudState("ready")
    } catch (error) {
      if (cloudRequestIdRef.current !== requestId) return
      setCloudState("error")
      setCloudError(error instanceof Error ? error.message : "Cloud asset snapshot failed.")
    }
  }, [clearCloudAssets, device])

  const refreshImportOps = useCallback(async (activeSession: AstraSession | null, nextOperatorToken?: string) => {
    if (!activeSession) {
      setImportOps(null)
      setImportOpsState("idle")
      setImportOpsError("")
      return
    }

    setImportOpsState("loading")
    setImportOpsError("")
    try {
      const snapshot = await fetchWebImportQueueObservability({
        baseURL: readArticleImportBaseUrl(activeSession.relayBaseURL),
        operatorToken: nextOperatorToken ?? operatorToken,
      })
      setImportOps(snapshot)
      setImportOpsState("ready")
    } catch (error) {
      setImportOpsState("error")
      setImportOpsError(error instanceof Error ? error.message : "Import observability request failed.")
    }
  }, [operatorToken])

  const refreshStorageHealth = useCallback(async () => {
    setStorageHealthState("loading")
    setStorageHealthError("")
    try {
      const snapshot = await inspectWorkspaceStorageHealth()
      setStorageHealth(snapshot)
      setStorageHealthState("ready")
    } catch (error) {
      setStorageHealthState("error")
      setStorageHealthError(error instanceof Error ? error.message : "Workspace storage health check failed.")
    }
  }, [])

  const clearAuthenticatedWorkspace = useCallback(() => {
    setSession(null)
    clearWebSession()
    setAccount(null)
    setUsage(null)
    setDevices([])
    clearCloudAssets()
    setImportOps(null)
    setImportOpsState("idle")
    setImportOpsError("")
  }, [clearCloudAssets])

  const refreshSessionState = useCallback(async (existingSession?: AstraSession, options: { silent?: boolean } = {}) => {
    const activeDevice = device
    const storedSession = existingSession ?? readWebSession()
    if (!storedSession) {
      clearCloudAssets()
      void refreshImportOps(null)
      setBootState("ready")
      setAuthState("idle")
      return null
    }

    if (!options.silent) {
      setAuthState("refreshing")
    }

    try {
      const refreshed = await refreshWebSession({
        baseURL: storedSession.relayBaseURL,
        device: activeDevice,
        sessionToken: storedSession.sessionToken,
      })

      const saved = saveWebSession(refreshed)
      setSession(saved)
      saveLastAccountEmail(saved.email)
      await refreshAuthenticatedWorkspace(saved, activeDevice)
      void refreshCloudAssets(saved)
      void refreshImportOps(saved)
      setBootState("ready")
      setAuthState("idle")
      return saved
    } catch (error) {
      clearAuthenticatedWorkspace()
      setBootState("ready")
      setAuthState("idle")
      setMessage(error instanceof Error ? error.message : "Stored Astra session could not be refreshed.")
      return null
    }
  }, [clearAuthenticatedWorkspace, clearCloudAssets, device, refreshAuthenticatedWorkspace, refreshCloudAssets, refreshImportOps])

  useEffect(() => {
    const storedSession = readWebSession()
    void refreshSessionState(storedSession ?? undefined)
  }, [refreshSessionState])

  useEffect(() => {
    void refreshStorageHealth()
  }, [refreshStorageHealth])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible" || !session || authState !== "idle") return
      const now = Date.now()
      if (now - visibilityRefreshAtRef.current < 30_000) return
      visibilityRefreshAtRef.current = now
      void refreshSessionState(session, { silent: true })
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange)
  }, [authState, refreshSessionState, session])

  const handleSaveApiBaseUrl = useCallback((value: string) => {
    const normalized = saveApiBaseUrl(value)
    setApiBaseUrl(normalized)
  }, [])

  const signIn = useCallback(async (credentials: { email: string; password: string }, baseURLOverride?: string) => {
    const activeDevice = device
    const baseURL = baseURLOverride ?? apiBaseUrl
    setAuthState("signing-in")
    setMessage("")

    try {
      const created = await createWebSession({
        baseURL,
        device: activeDevice,
        email: credentials.email,
        password: credentials.password,
      })

      const saved = saveWebSession(created)
      setSession(saved)
      saveLastAccountEmail(saved.email)
      await refreshAuthenticatedWorkspace(saved, activeDevice)
      void refreshCloudAssets(saved)
      void refreshImportOps(saved)
      saveRoute("/text")
      setMessage("Signed in to Astra Web Companion.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sign-in failed.")
      throw error
    } finally {
      setAuthState("idle")
      setBootState("ready")
    }
  }, [apiBaseUrl, device, refreshAuthenticatedWorkspace, refreshCloudAssets, refreshImportOps, saveRoute])

  const startFreeSession = useCallback(async (baseURLOverride?: string) => {
    const activeDevice = device
    const baseURL = baseURLOverride ?? apiBaseUrl
    setAuthState("signing-in")
    setMessage("")

    try {
      const created = await createWebAnonymousSession({
        baseURL,
        device: activeDevice,
      })

      const saved = saveWebSession(created)
      setSession(saved)
      await refreshAuthenticatedWorkspace(saved, activeDevice)
      void refreshCloudAssets(saved)
      void refreshImportOps(saved)
      saveRoute("/text")
      setMessage("Free Astra session is ready. Translation uses the managed Astra relay.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Free start failed.")
      throw error
    } finally {
      setAuthState("idle")
      setBootState("ready")
    }
  }, [apiBaseUrl, device, refreshAuthenticatedWorkspace, refreshCloudAssets, refreshImportOps, saveRoute])

  const signOut = useCallback(async () => {
    const activeDevice = device
    setAuthState("signing-out")

    try {
      if (session) {
        await revokeWebSession({
          baseURL: session.relayBaseURL,
          device: activeDevice,
          sessionToken: session.sessionToken,
        })
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sign-out could not be completed cleanly.")
    } finally {
      clearAuthenticatedWorkspace()
      setAuthState("idle")
      setMessage("Signed out from Astra Web Companion.")
    }
  }, [clearAuthenticatedWorkspace, device, session])

  const refreshAll = useCallback(async () => {
    if (!session) return
    setMessage("")
    await refreshSessionState(session)
  }, [refreshSessionState, session])

  const handleToggleCloudCollection = useCallback(async (
    collection: "reading_history" | "study_progress",
    enabled: boolean,
  ) => {
    if (!session) return
    try {
      await updateWebSyncCollectionPreference({
        session,
        device,
        collection,
        enabled,
      })
      await refreshCloudAssets(session)
      setMessage(enabled
        ? `Enabled ${collection.replace(/_/g, " ")} cloud sync.`
        : `Disabled ${collection.replace(/_/g, " ")} cloud sync.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Cloud collection preference update failed.")
    }
  }, [device, refreshCloudAssets, session])

  const handleReplayImportFailures = useCallback(async (dryRun: boolean) => {
    if (!session || !operatorToken.trim()) {
      setMessage("Enter an operator token before replaying queue failures.")
      return
    }
    try {
      const result = await replayWebImportJobs({
        baseURL: readArticleImportBaseUrl(session.relayBaseURL),
        operatorToken: operatorToken.trim(),
        status: "dead_lettered",
        dryRun,
      })
      await refreshImportOps(session, operatorToken.trim())
      setMessage(dryRun
        ? `Dry-run replay inspected ${formatNumber(result.summary.selected)} jobs.`
        : `Replay queued ${formatNumber(result.summary.replayed)} dead-lettered jobs.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Queue replay failed.")
    }
  }, [operatorToken, refreshImportOps, session])

  const handleRepairStorage = useCallback(async () => {
    setRecoveryState("running")
    try {
      const report = await repairWorkspaceStorageCorruption()
      await refreshStorageHealth()
      const repairedCount = report.removedIndexedDbKeys.length
        + report.removedLibraryItemIds.length
        + report.removedLibrarySnapshotIds.length
        + report.removedLibraryDocumentSnapshotIds.length
        + report.removedMigrationJournalIds.length
        + report.removedLegacyMappingKeys.length
        + report.clearedLegacyKeys.length
      if (repairedCount === 0) {
        setMessage("No corrupted workspace records needed repair.")
      } else {
        setMessage(`Repair cleared ${formatNumber(repairedCount)} corrupted workspace/library records.`)
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Workspace repair failed.")
    } finally {
      setRecoveryState("idle")
    }
  }, [refreshStorageHealth])

  const handleImportLocalLibraryMetadata = useCallback(async () => {
    if (!session) {
      setMessage("Sign in before importing local library metadata.")
      return
    }

    try {
      const localItems = (await listLibraryItems()).filter((item) => item.ownerMode === "local" || item.syncState === "pending_import")
      if (localItems.length === 0) {
        setMessage("No local-only library items need account import.")
        return
      }

      const result = await importWebLibraryMetadataToAccount({
        session,
        device,
        items: localItems,
      })
      if (result.rejected > 0) {
        setMessage(`Imported ${formatNumber(result.metadataAccepted)} library metadata records and ${formatNumber(result.snapshotAccepted)} snapshot records; ${formatNumber(result.rejected)} were rejected.`)
      } else {
        await markLibraryItemsImportedToAccount(localItems.map((item) => item.id), session.email)
        await refreshCloudAssets(session)
        setMessage(`Imported ${formatNumber(result.metadataAccepted)} local library metadata records and ${formatNumber(result.snapshotAccepted)} document snapshot records into ${session.email}. Original file bytes were not uploaded; binary viewer access still requires re-import on each browser.${result.oversizedSnapshots > 0 ? ` ${formatNumber(result.oversizedSnapshots)} oversized snapshot${result.oversizedSnapshots === 1 ? "" : "s"} stored failure metadata only.` : ""}`)
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Local library metadata import failed.")
    }
  }, [device, refreshCloudAssets, session])

  const handleResetStorage = useCallback(async () => {
    const confirmed = typeof window !== "undefined" && typeof window.confirm === "function"
      ? window.confirm("Reset all local Astra Web workspaces and lifecycle state on this browser?")
      : true
    if (!confirmed) return
    setRecoveryState("running")
    try {
      await resetWorkspaceStorageLifecycle()
      refreshRecentImports()
      await refreshStorageHealth()
      setMessage("Local workspace lifecycle storage was reset.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Workspace reset failed.")
    } finally {
      setRecoveryState("idle")
    }
  }, [refreshRecentImports, refreshStorageHealth])

  const handleRevokeDevice = useCallback(async (targetDeviceId: string) => {
    if (!session) return
    if (targetDeviceId === device.deviceId) {
      setMessage("Use Sign out for the current device instead.")
      return
    }

    const confirmed = typeof window !== "undefined" && typeof window.confirm === "function"
      ? window.confirm("Revoke this device's Astra access? It will need to sign in again.")
      : true
    if (!confirmed) {
      return
    }

    setDeviceActionBusyId(targetDeviceId)
    setMessage("")

    try {
      const nextDevices = await revokeWebDevice({
        baseURL: session.relayBaseURL,
        sessionToken: session.sessionToken,
        currentDeviceId: device.deviceId,
        targetDeviceId,
      })
      setDevices(nextDevices)
      setLastWorkspaceRefreshAt(new Date().toISOString())
      const revokedLabel = nextDevices.find((entry) => entry.deviceId === targetDeviceId)?.label ?? "Device"
      setMessage(`Revoked ${revokedLabel}.`)
    } catch (error) {
      setMessage(formatLifecycleActionError("revoke", error))
    } finally {
      setDeviceActionBusyId(null)
    }
  }, [device.deviceId, session])

  const launchBilling = useCallback(async (kind: "checkout" | "portal", plan: AstraPlan = "pro") => {
    if (!session) return

    try {
      const url = kind === "checkout"
        ? await openBillingCheckout({ session, plan })
        : await openBillingPortal({ session })
      window.open(url, "_blank", "noopener,noreferrer")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Billing link could not be opened.")
    }
  }, [session])

  const accountSummary = account ?? (session ? {
    id: "session",
    relayBaseURL: session.relayBaseURL,
    email: session.email,
    billingEmail: session.email,
    createdAt: session.issuedAt ?? new Date().toISOString(),
    plan: session.plan,
    subscriptionStatus: session.subscriptionStatus,
    providerEntitlements: session.providerEntitlements,
  } : null)

  const usageSummary = usage ?? (session ? {
    generatedAt: new Date().toISOString(),
    quota: session.quota,
    usage: session.usage,
  } : null)

  const appKindLabel = device?.appKind === "pwa" ? "Installed PWA" : "Web companion"
  const authStatusLabel = session
    ? authState === "refreshing"
      ? "refreshing"
      : authState === "signing-out"
        ? "signing out"
        : "connected"
    : authState === "signing-in"
      ? "signing in"
      : "signed out"
  const certificationParams = readAstraCertificationParams()
  const certMode = certificationParams.enabled
  const isWorkspaceParityRoute = certificationParams.enabled && (route === "/files/pdf" || route === "/assets")

  if (certMode && (route === "/files/pdf" || route === "/assets")) {
    return <WorkspaceSurfacesCertificationPage />
  }

  if (certMode && route === "/") {
    return <PublicLandingCertificationPage />
  }

  if (!session && route === "/") {
    return (
      <PublicLandingPage
        authState={authState}
        bootState={bootState}
        message={message}
        canInstall={installPrompt.canInstall}
        onDismissMessage={() => setMessage("")}
        onInstall={() => installPrompt.promptInstall()}
        onNavigate={saveRoute}
        onStartFree={startFreeSession}
      />
    )
  }

  if (route === "/sign-in") {
    return (
      <PublicSignInPage
        apiBaseUrl={apiBaseUrl}
        authState={authState}
        bootState={bootState}
        message={message}
        session={session}
        canInstall={installPrompt.canInstall}
        onDismissMessage={() => setMessage("")}
        onInstall={() => installPrompt.promptInstall()}
        onNavigate={saveRoute}
        onSaveApiBaseUrl={handleSaveApiBaseUrl}
        onSignIn={signIn}
        onStartFree={startFreeSession}
      />
    )
  }

  return (
    <div className={`app-shell${isWorkspaceParityRoute ? " web-workspace-cert-shell" : ""}`}>
      <aside className="sidebar workspace-sidebar">
        <div className="brand">
          <div className="brand-mark">A</div>
          <div>
            <div className="brand-title">Astra</div>
            <div className="brand-subtitle">portable workspaces only</div>
          </div>
        </div>

        <nav className="nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.route}
              type="button"
              className={`nav-item${route === item.route ? " is-active" : ""}`}
              onClick={() => saveRoute(item.route)}
            >
              <span>{item.label}</span>
              <small>{item.route} · {item.detail}</small>
            </button>
          ))}
        </nav>

        <RecentImportsCard
          imports={recentImports}
          onOpen={(nextRoute) => saveRoute(nextRoute)}
          onClear={() => {
            clearRecentImports()
            refreshRecentImports()
          }}
        />

        <ExtensionOnlyCard />
      </aside>

      <main className="main-panel">
        <header className="topbar workspace-topbar">
          <div>
            <div className="eyebrow">Quiet Reader workspace</div>
            <h1>{NAV_ITEMS.find((item) => item.route === route)?.label ?? "Workspace"}</h1>
          </div>

          <div className="topbar-actions">
            <span className="status-pill">{appKindLabel}</span>
            <span className={`status-pill${session ? " success" : " muted"}`}>{authStatusLabel}</span>
            {session ? (
              <span className="status-pill success">{session.email}</span>
            ) : (
              <span className="status-pill muted">signed out</span>
            )}
            {installPrompt.canInstall && (
              <button type="button" className="button secondary" onClick={() => void installPrompt.promptInstall()}>
                Install PWA
              </button>
            )}
            {session && (
              <>
                <button type="button" className="button ghost" onClick={() => void refreshAll()} disabled={authState !== "idle" || deviceActionBusyId !== null}>
                  Refresh
                </button>
                <button type="button" className="button ghost" onClick={() => void signOut()} disabled={authState !== "idle" || deviceActionBusyId !== null}>
                  Sign out
                </button>
              </>
            )}
          </div>
        </header>

        {message && (
          <div className="banner">
            <span>{message}</span>
            <button type="button" className="banner-dismiss" onClick={() => setMessage("")}>
              Dismiss
            </button>
          </div>
        )}

        {bootState === "loading" ? (
          <div className="card loading-card">Booting Astra Web Companion…</div>
        ) : (
          <div className="page-grid">
            {route === "/" && (
              <OverviewPage
                session={session}
                account={accountSummary}
                usage={usageSummary}
                recentImports={recentImports}
                cloudAssets={cloudAssets}
                cloudState={cloudState}
                cloudError={cloudError}
                importOps={importOps}
                importOpsState={importOpsState}
                lastWorkspaceRefreshAt={lastWorkspaceRefreshAt}
                onNavigate={saveRoute}
              />
            )}

            {route === "/text" && (
              <TextWorkspacePage
                session={session}
                config={config}
                onConfigChange={updateConfig}
                onNavigate={saveRoute}
              />
            )}

            {route === "/articles" && (
              <ArticleWorkspacePage
                apiBaseUrl={session?.relayBaseURL ?? apiBaseUrl}
                articleImportBaseUrl={readArticleImportBaseUrl(session?.relayBaseURL ?? apiBaseUrl)}
                onSendToText={(draft) => {
                  saveTextTransferDraft(draft)
                  saveRoute("/text")
                }}
                onRecentImportsChange={refreshRecentImports}
              />
            )}

            {route === "/files/pdf" && (
              <PdfWorkspacePage
                onSendToText={(draft) => {
                  saveTextTransferDraft(draft)
                  saveRoute("/text")
                }}
                onRecentImportsChange={refreshRecentImports}
              />
            )}

            {route === "/files/epub" && (
              <EpubWorkspacePage
                onSendToText={(draft) => {
                  saveTextTransferDraft(draft)
                  saveRoute("/text")
                }}
                onRecentImportsChange={refreshRecentImports}
              />
            )}

            {route === "/files/subtitles" && (
              <SubtitleWorkspacePage
                session={session}
                config={config}
                onNavigate={saveRoute}
                onRecentImportsChange={refreshRecentImports}
              />
            )}

            {route === "/video-notes" && (
              <VideoNoteWorkspacePage
                session={session}
                deepLinkedJobId={videoNoteDeepLinkedJobId}
                onNavigate={saveRoute}
              />
            )}

            {route === "/account" && (
              <AccountPage
                apiBaseUrl={apiBaseUrl}
                config={config}
                device={device}
                onSaveApiBaseUrl={handleSaveApiBaseUrl}
                account={accountSummary}
                session={session}
                usage={usageSummary}
                devices={devices}
                authState={authState}
                deviceActionBusyId={deviceActionBusyId}
                cloudAssets={cloudAssets}
                cloudState={cloudState}
                cloudError={cloudError}
                importOps={importOps}
                importOpsState={importOpsState}
                importOpsError={importOpsError}
                operatorToken={operatorToken}
                onOperatorTokenChange={setOperatorToken}
                storageHealth={storageHealth}
                storageHealthState={storageHealthState}
                storageHealthError={storageHealthError}
                recoveryState={recoveryState}
                lastWorkspaceRefreshAt={lastWorkspaceRefreshAt}
                onRefresh={refreshAll}
                onRefreshCloudAssets={() => refreshCloudAssets(session)}
                onRefreshImportOps={() => refreshImportOps(session)}
                onImportLocalLibraryMetadata={handleImportLocalLibraryMetadata}
                onReplayImportFailures={handleReplayImportFailures}
                onToggleCloudCollection={handleToggleCloudCollection}
                onRefreshStorageHealth={refreshStorageHealth}
                onRepairStorage={handleRepairStorage}
                onResetStorage={handleResetStorage}
                onRevokeDevice={handleRevokeDevice}
                onSignIn={signIn}
                onBilling={launchBilling}
              />
            )}

            {route === "/assets" && (
              <AssetLibraryPage
                cloudAssets={cloudAssets}
                cloudState={cloudState}
                importOps={importOps}
                importOpsState={importOpsState}
                recentImports={recentImports}
                onNavigate={saveRoute}
              />
            )}
          </div>
        )}
      </main>
    </div>
  )
}

function PublicLandingCertificationPage() {
  return (
    <div className="public-site public-site--landing-cert">
      <main className="landing-cert-canvas" aria-label="Astra landing certification diagnostic">
        <section className="landing-cert-header">
          <h1>What&apos;s broken on the current page</h1>
          <p>Side-by-side annotation. The current state is on the left; the corresponding fix is on the right.</p>
        </section>

        <section className="landing-cert-diagnosis" aria-label="Landing diagnosis">
          <div className="landing-cert-section-label">
            <span className="landing-cert-handle" aria-hidden="true">⠿</span>
            <span>Diagnosis</span>
          </div>

          <article className="landing-cert-diagnosis-card">
            <div className="landing-cert-column landing-cert-column--now">
              <div className="landing-cert-eyebrow">Now — astra.so</div>
              <h2>Three quiet problems</h2>
              <ol>
                <li>
                  <strong>The headline is shouting.</strong> Six lines of 96px Source Serif occupy the whole left column.
                  Astra&apos;s brand promise is &quot;never repaints what was already legible.&quot; The hero overpaints itself.
                </li>
                <li>
                  <strong>The sign-in floats.</strong> A 380px panel cuts vertically through the headline; the eye doesn&apos;t
                  know whether to read the type or fill the form. Pick one.
                </li>
                <li>
                  <strong>No product shot.</strong> A page about reading-with-translation contains zero translation. The
                  hero should be the product, not a description of it.
                </li>
              </ol>
            </div>

            <div className="landing-cert-column landing-cert-column--next">
              <div className="landing-cert-eyebrow">Next</div>
              <h2>Three corresponding moves</h2>
              <ol>
                <li>
                  <strong>Restrain the headline.</strong> ~64px display serif, two lines maximum. Body copy is also serif —
                  the page reads like the magazine you want to study.
                </li>
                <li>
                  <strong>Move sign-in to its own page.</strong> The hero CTA is &quot;Start reading now.&quot; &quot;Sign in&quot; is a
                  small text link in nav → <code>/sign-in</code>, a small paper card.
                </li>
                <li>
                  <strong>Let the hero be the product.</strong> The right column is a real bilingual sample rendered exactly
                  the way Astra renders it everywhere else — 2px accent rail, margin translation, saved-word chip.
                </li>
              </ol>
            </div>
          </article>
        </section>

        <section className="landing-cert-proposal" aria-label="Landing proposal">
          <h2>A · Marginalia hero — show the product in the hero</h2>
          <p>
            The strongest design move: stop describing Astra and let the hero be a working sample of marginalia
            translation. Headline restrains to ~64px display serif, body copy stays editorial, and sign-in moves to
            its own quiet page.
          </p>
        </section>
      </main>
    </div>
  )
}

function PublicLandingPage(props: {
  authState: AuthState
  bootState: "loading" | "ready"
  message: string
  canInstall: boolean
  onDismissMessage: () => void
  onInstall: () => Promise<void>
  onNavigate: (route: AppRoute) => void
  onStartFree: () => Promise<void>
}) {
  const [error, setError] = useState("")

  const startFree = useCallback(async () => {
    setError("")
    try {
      await props.onStartFree()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Free start failed.")
    }
  }, [props])

  const isBusy = props.bootState === "loading" || props.authState !== "idle"

  return (
    <div className="public-site">
      <header className="public-nav">
        <button type="button" className="public-brand" onClick={() => props.onNavigate("/")}>
          <span className="brand-mark">A</span>
          <span>
            <strong>Astra</strong>
            <small>AI language companion</small>
          </span>
        </button>
        <nav className="public-nav-actions" aria-label="Astra website navigation">
          <button type="button" className="button ghost" onClick={() => props.onNavigate("/articles")}>
            Reader
          </button>
          <button type="button" className="button ghost" onClick={() => props.onNavigate("/files/subtitles")}>
            Subtitles
          </button>
          <button type="button" className="button secondary" onClick={() => props.onNavigate("/sign-in")}>
            Sign in
          </button>
        </nav>
      </header>

      {props.message && (
        <div className="public-message">
          <span>{props.message}</span>
          <button type="button" className="banner-dismiss" onClick={props.onDismissMessage}>
            Dismiss
          </button>
        </div>
      )}

      <main>
        <section className="public-hero">
          <div className="public-hero-copy">
            <div className="eyebrow">Free preview · managed Astra relay</div>
            <h1>A bilingual reading room for the pages <em>you already saved.</em></h1>
            <p>
              Articles, PDFs, EPUBs, and subtitle files — translated in the margin. Use the browser extension for
              live page translation; Astra Web is for imported content, files, and portable reading workspaces.
            </p>
            <div className="hero-actions">
              <button type="button" className="button primary large-button" onClick={() => void startFree()} disabled={isBusy}>
                {props.authState === "signing-in" ? "Starting..." : "Use instantly"}
              </button>
              <button type="button" className="button secondary large-button" onClick={() => props.onNavigate("/sign-in")} disabled={isBusy}>
                Sign in to sync
              </button>
              {props.canInstall && (
                <button type="button" className="button ghost large-button" onClick={() => void props.onInstall()} disabled={isBusy}>
                  Install PWA
                </button>
              )}
            </div>
            {(error || props.bootState === "loading") && (
              <div className={error ? "error-note" : "helper-copy"} role={error ? "alert" : "status"} aria-live={error ? "assertive" : "polite"}>
                {error || "Checking for an existing Astra session..."}
              </div>
            )}
            <div className="public-proof-strip" aria-label="Astra Web preview highlights">
              <span>Imported articles</span>
              <span>PDF + EPUB reading rooms</span>
              <span>Subtitle files in context</span>
            </div>
          </div>

          <div className="public-marginalia-card" aria-label="Static Astra marginalia preview">
            <div className="sample-status-pill"><span /> Static preview</div>
            <div className="sample-meta">
              <span>Imported article</span>
              <span>7 min read</span>
              <span>EN → 中文</span>
            </div>
            <h2>The Quiet Years of the Long-Distance Reader</h2>
            <div className="bilingual-paragraph">
              <p className="source-copy">
                At the turn of the century, the <span className="selected-phrase">marginalia</span> a reader left in a book
                traveled with it across estates and centuries — a quiet correspondence between strangers.
              </p>
              <p className="translation-margin">
                世纪之交，读者留在书中的眉批会随书本流转于宅邸与时代之间——一场陌生人之间的安静通信。
              </p>
            </div>
            <div className="bilingual-paragraph">
              <p className="source-copy">
                Astra keeps the writer’s words in place and lets the translation live beside them, like a pencil note in
                the margin.
              </p>
              <p className="translation-margin">
                Astra 保留作者原文的位置，让译文安静地落在旁边，像页边的一则铅笔注记。
              </p>
            </div>
            <div className="saved-word-row" aria-label="Decorative saved word sample">
              <span className="saved-word-chip">marginalia · 眉批</span>
              <span className="sample-footnote">2px rail · margin translation · saved in context</span>
            </div>
          </div>
        </section>

        <section className="public-section">
          <div className="section-kicker">
            <div className="eyebrow">Astra Web companion</div>
            <h2>Bring reading material into one portable workspace.</h2>
          </div>
          <div className="public-feature-grid">
            {[
              ["Read", "Import articles, PDFs, and EPUBs into a quiet bilingual reading room for focused study."],
              ["Keep", "Save vocabulary and useful context from imported material so review starts from real sentences."],
              ["Watch", "Bring subtitle and document files into Astra for bilingual export and file-based video study."],
            ].map(([title, copy]) => (
              <article key={title} className="public-feature">
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}

function PublicSignInPage(props: {
  apiBaseUrl: string
  authState: AuthState
  bootState: "loading" | "ready"
  message: string
  session: AstraSession | null
  canInstall: boolean
  onDismissMessage: () => void
  onInstall: () => Promise<void>
  onNavigate: (route: AppRoute) => void
  onSaveApiBaseUrl: (value: string) => void
  onSignIn: (credentials: { email: string; password: string }, baseURL?: string) => Promise<void>
  onStartFree: (baseURL?: string) => Promise<void>
}) {
  const certificationParams = readAstraCertificationParams()
  const certMode = certificationParams.enabled
  const displayedSession = certMode ? null : props.session
  const [email, setEmail] = useState(() => certMode ? "rui@thequietreader.com" : readLastAccountEmail())
  const [password, setPassword] = useState("")
  const [apiBaseUrl, setApiBaseUrl] = useState(props.apiBaseUrl)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({})

  useEffect(() => {
    setApiBaseUrl(props.apiBaseUrl)
  }, [props.apiBaseUrl])

  const submit = useCallback(async (event: React.FormEvent) => {
    event.preventDefault()
    if (certMode) return
    setError("")

    const normalizedEmail = email.trim()
    const nextFieldErrors: { email?: string; password?: string } = {}
    if (!normalizedEmail) nextFieldErrors.email = "Email is required."
    if (!password.trim()) nextFieldErrors.password = "Password is required."
    setFieldErrors(nextFieldErrors)
    if (nextFieldErrors.email || nextFieldErrors.password) return

    try {
      const normalizedBaseURL = normalizeApiBaseUrl(apiBaseUrl)
      props.onSaveApiBaseUrl(normalizedBaseURL)
      await props.onSignIn({ email: normalizedEmail, password }, normalizedBaseURL)
      setPassword("")
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Sign-in failed.")
    }
  }, [apiBaseUrl, email, password, props, certMode])

  const startFree = useCallback(async () => {
    if (certMode) return
    setError("")
    setFieldErrors({})
    try {
      const normalizedBaseURL = normalizeApiBaseUrl(apiBaseUrl)
      props.onSaveApiBaseUrl(normalizedBaseURL)
      await props.onStartFree(normalizedBaseURL)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Free start failed.")
    }
  }, [apiBaseUrl, props, certMode])

  const isBusy = props.bootState === "loading" || props.authState !== "idle"

  return (
    <div className={`public-site${certMode ? " public-site--signin-cert" : ""}`}>
      <header className="public-nav">
        <button type="button" className="public-brand" onClick={() => props.onNavigate("/")}>
          <span className="brand-mark">A</span>
          <span>
            <strong>Astra</strong>
            <small>AI language companion</small>
          </span>
        </button>
        <nav className="public-nav-actions" aria-label="Astra website navigation">
          <button type="button" className="button ghost" onClick={() => props.onNavigate("/")}>
            Home
          </button>
          <button type="button" className="button secondary" onClick={() => props.onNavigate("/sign-in")}>
            Sign in
          </button>
        </nav>
      </header>

      {props.message && (
        <div className="public-message">
          <span>{props.message}</span>
          <button type="button" className="banner-dismiss" onClick={props.onDismissMessage}>
            Dismiss
          </button>
        </div>
      )}

      <main className="public-signin-main">
        <section className="public-signin-card" aria-label="Astra sign in">
          <div className="signin-card-brand">
            <span aria-hidden="true">✣</span>
            <span aria-hidden="true">✧</span>
            <strong>Astra</strong>
          </div>

          <div className="signin-card-copy">
            <h1>Welcome back.</h1>
            <p>Sign in to keep your library and reading history on every device you read on.</p>
          </div>

          {displayedSession ? (
            <div className="auth-form public-auth-form">
              <div className="login-panel-heading compact-heading">
                <div>
                  <div className="eyebrow">Account</div>
                  <h2>Already signed in</h2>
                </div>
                <span className="status-pill success">Connected</span>
              </div>
              <p className="helper-copy">You’re already signed in as {displayedSession.email}. Open your workspace to continue reading.</p>
              <button type="button" className="button primary full-width" onClick={() => props.onNavigate("/text")}>
                Open workspace
              </button>
            </div>
          ) : (
            <form className="auth-form public-auth-form public-signin-form" onSubmit={(event) => { void submit(event) }}>
              <label className="field">
                <span>Email</span>
                <input
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value)
                    setFieldErrors((current) => ({ ...current, email: undefined }))
                  }}
                  type="email"
                  placeholder="rui@thequietreader.com"
                  autoComplete="email"
                  aria-invalid={Boolean(fieldErrors.email)}
                  aria-describedby={fieldErrors.email ? "public-sign-in-email-error" : undefined}
                />
                {fieldErrors.email && <span id="public-sign-in-email-error" className="field-error">{fieldErrors.email}</span>}
              </label>

              {!certMode && (
                <label className="field public-signin-password-field">
                  <span>Password</span>
                  <div className="field-inline">
                    <input
                      value={password}
                      onChange={(event) => {
                        setPassword(event.target.value)
                        setFieldErrors((current) => ({ ...current, password: undefined }))
                      }}
                      type={showPassword ? "text" : "password"}
                      placeholder="Password"
                      autoComplete="current-password"
                      aria-invalid={Boolean(fieldErrors.password)}
                      aria-describedby={fieldErrors.password ? "public-sign-in-password-error" : undefined}
                    />
                    <button type="button" className="button ghost" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword((current) => !current)} disabled={isBusy}>
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                  {fieldErrors.password && <span id="public-sign-in-password-error" className="field-error">{fieldErrors.password}</span>}
                </label>
              )}

              <button type={certMode ? "button" : "submit"} className="button primary full-width signin-email-button" disabled={isBusy}>
                <span>{props.authState === "signing-in" ? "Signing in..." : "Continue with email"}</span>
                <span aria-hidden="true">→</span>
              </button>

              <div className="login-divider"><span>or</span></div>

              <button type="button" className="button ghost full-width signin-provider-button" disabled>
                Continue with Google
              </button>
              <button type="button" className="button ghost full-width signin-provider-button" disabled>
                Continue with Apple
              </button>

              {!certMode && (
                <details className="advanced-login-settings public-signin-relay">
                  <summary>Relay endpoint</summary>
                  <label className="field">
                    <span>Astra API base URL</span>
                    <input
                      value={apiBaseUrl}
                      onChange={(event) => setApiBaseUrl(event.target.value)}
                      placeholder="https://api.example.com/v1"
                    />
                  </label>
                </details>
              )}

              {(error || props.bootState === "loading") && (
                <div className={error ? "error-note" : "helper-copy"} role={error ? "alert" : "status"} aria-live={error ? "assertive" : "polite"}>
                  {error || "Checking for an existing Astra session..."}
                </div>
              )}
            </form>
          )}

          {!displayedSession && (
            <div className="signin-local-note">
              <span>No account?</span>{" "}
              <button type="button" onClick={() => void startFree()} disabled={isBusy}>
                Astra works without one.
              </button>{" "}
              <span>Your library will live on this device only.</span>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

function OverviewPage(props: {
  session: AstraSession | null
  account: AstraAccount | null
  usage: AstraUsageSnapshot | null
  recentImports: RecentWebImport[]
  cloudAssets: WebCloudAssetsWorkspace | null
  cloudState: "idle" | "loading" | "ready" | "error"
  cloudError: string
  importOps: WebImportQueueObservability | null
  importOpsState: "idle" | "loading" | "ready" | "error"
  lastWorkspaceRefreshAt: string | null
  onNavigate: (route: AppRoute) => void
}) {
  const [importLibrary, setImportLibrary] = useState<ImportLibraryEntry[]>([])
  const [importLibraryState, setImportLibraryState] = useState<"loading" | "ready">("loading")

  useEffect(() => {
    let cancelled = false
    setImportLibraryState("loading")

    void readImportLibrary()
      .then((entries) => {
        if (!cancelled) {
          setImportLibrary(entries)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setImportLibrary([])
        }
      })
      .finally(() => {
        if (!cancelled) {
          setImportLibraryState("ready")
        }
      })

    return () => {
      cancelled = true
    }
  }, [props.recentImports])

  const workspaceCards = [
    {
      title: "Text workspace",
      detail: "Translate, explain, and continue saved text work without leaving the web shell.",
      route: "/text" as const,
    },
    {
      title: "URL article import",
      detail: "Import readable article content from a URL into a saved, read-only workspace and hand it into text tasks.",
      route: "/articles" as const,
    },
    {
      title: "PDF reader",
      detail: "Import PDFs, move page by page, resume later, and send reading slices into text translation.",
      route: "/files/pdf" as const,
    },
    {
      title: "EPUB reader",
      detail: "Open chapters, cache what you read locally, and continue from the last loaded chapter.",
      route: "/files/epub" as const,
    },
    {
      title: "Subtitle/document workspace",
      detail: "Translate subtitles or docs in-place and export bilingual output from the same saved workspace.",
      route: "/files/subtitles" as const,
    },
    {
      title: "Video-note jobs",
      detail: "Create relay jobs, poll status, and open cached video-note artifacts.",
      route: "/video-notes" as const,
    },
    {
      title: "Asset details",
      detail: "Inspect local and cloud assets, per-item detail views, and import queue operations from one place.",
      route: "/assets" as const,
    },
    {
      title: "Account & quota",
      detail: "Inspect session state, entitlements, usage, billing, devices, and cloud continuity surfaces.",
      route: "/account" as const,
    },
  ]

  const enabledCollections = props.cloudAssets?.syncHealth.collections.filter((collection) => collection.enabled).length ?? 0

  return (
    <>
      <section className="card hero">
        <div className="hero-copy">
          <div className="eyebrow">Portable web companion</div>
          <h2>Astra-owned reading and translation flows that survive refreshes</h2>
          <p>
            This web MVP upgrades the original scaffold into resumable PDF, EPUB, text, and subtitle workflows,
            while staying explicit about where live-page extension capabilities still begin and end.
          </p>
          <div className="hero-actions">
            <button type="button" className="button primary" onClick={() => props.onNavigate("/text")}>
              Open text workspace
            </button>
            <button type="button" className="button secondary" onClick={() => props.onNavigate("/files/pdf")}>
              Resume file workflows
            </button>
          </div>
        </div>

        <div className="hero-stats">
          <MetricCard
            label="Session"
            value={props.session ? "Connected" : "Signed out"}
            hint={props.session ? props.session.email : "Sign in to use Astra relay translation"}
          />
          <MetricCard
            label="Plan"
            value={formatAstraPlanLabel(props.account?.plan ?? props.session?.plan ?? null)}
            hint={props.account?.providerEntitlements.join(", ") ?? "No provider entitlements loaded"}
          />
          <MetricCard
            label="Recent imports"
            value={formatNumber(props.recentImports.length)}
            hint={props.recentImports[0] ? `Last saved ${formatRelativeDate(props.recentImports[0].importedAt)}` : "No saved imports yet"}
          />
          <MetricCard
            label="Remaining daily requests"
            value={formatNumber(props.usage?.quota.remainingDailyRequests)}
            hint={`${formatNumber(props.usage?.usage.dailyRequestsUsed)} used today · Astra account summary`}
          />
          <MetricCard
            label="Last workspace refresh"
            value={props.lastWorkspaceRefreshAt ? formatRelativeDate(props.lastWorkspaceRefreshAt) : "—"}
            hint="account summary, devices, and sync state"
          />
        </div>
      </section>

      <section className="grid cards-2">
        <section className="card">
          <div className="section-heading">
            <div>
              <div className="card-title">Cloud console snapshot</div>
              <div className="card-copy">Read-only snapshot of Astra sync collections from the latest successful fetch.</div>
            </div>
            <button type="button" className="button ghost compact-button" onClick={() => props.onNavigate("/account")}>
              Open account console
            </button>
          </div>

          {!props.session ? (
            <div className="stack list">
              <div className="helper-copy">Sign in to inspect config, vocabulary, review schedules, reading history, study progress, and sync health surfaces.</div>
            </div>
          ) : props.cloudState === "loading" && !props.cloudAssets ? (
            <div className="helper-copy">Loading cloud snapshot…</div>
          ) : !props.cloudAssets ? (
            <div className="helper-copy">Cloud snapshot unavailable right now. Open the account console to retry the fetch.</div>
          ) : (
            <>
              <div className="metrics-grid">
                <MetricCard
                  label="Last fetch"
                  value={formatRelativeDate(props.cloudAssets.fetchedAt)}
                  hint="latest fetched snapshot"
                />
                <MetricCard
                  label="Enabled collections"
                  value={formatNumber(enabledCollections)}
                  hint={`${formatNumber(props.cloudAssets.syncHealth.totalDeviceCount)} devices in continuity snapshot`}
                />
                <MetricCard
                  label="Reading history"
                  value={formatNumber(props.cloudAssets.readingHistory.count)}
                  hint={props.cloudAssets.readingHistory.enabled ? "optional behavioral sync" : "sync off"}
                />
                <MetricCard
                  label="Study pages"
                  value={formatNumber(props.cloudAssets.studyProgress.pageCount)}
                  hint={props.cloudAssets.studyProgress.enabled ? "synced per-page milestones" : "sync off"}
                />
              </div>

              <div className="helper-copy" style={{ marginTop: "1rem" }}>
                Reading history appears only when optional sync is enabled, and study progress shows synced page milestones only.
              </div>
              <div className="helper-copy">
                This is the latest fetched snapshot, not a continuously authoritative cross-device view.
              </div>
            </>
          )}

          {props.cloudError && <div className="error-note">{props.cloudError}</div>}
        </section>

        <section className="card">
          <div className="section-heading">
            <div>
              <div className="card-title">Saved workspace library</div>
              <div className="card-copy">Latest saved workspace per format on this browser.</div>
            </div>
          </div>

          <div className="helper-copy" style={{ marginBottom: "1rem" }}>
            This is a local resume surface, not yet a cloud-backed multi-item library.
          </div>

          {importLibraryState === "loading" ? (
            <div className="helper-copy">Loading saved workspaces…</div>
          ) : importLibrary.length === 0 ? (
            <div className="helper-copy">No saved workspaces yet.</div>
          ) : (
            <div className="stack list">
                {importLibrary.map((entry) => (
                  <button key={entry.id} type="button" className="reader-nav-item" onClick={() => props.onNavigate(entry.route)}>
                  <strong>{entry.title}</strong>
                  <small>{entry.summary}</small>
                  <small>{entry.detail} · {formatRelativeDate(entry.importedAt)}</small>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="card">
          <div className="section-heading">
            <div>
              <div className="card-title">Import queue status</div>
              <div className="card-copy">Queue-driven article import observability from the platform control plane.</div>
            </div>
            <button type="button" className="button ghost compact-button" onClick={() => props.onNavigate("/account")}>
              Open controls
            </button>
          </div>

          {!props.session ? (
            <div className="helper-copy">Sign in to inspect queue backlog, dead-lettered imports, and replay controls.</div>
          ) : props.importOpsState === "loading" && !props.importOps ? (
            <div className="helper-copy">Loading queue observability…</div>
          ) : !props.importOps ? (
            <div className="helper-copy">Queue observability unavailable. Open account controls and retry.</div>
          ) : (
            <div className="metrics-grid">
              <MetricCard label="Queued" value={formatNumber(props.importOps.articleImport.backlog.queued)} hint="pending queue jobs" />
              <MetricCard label="Failed" value={formatNumber(props.importOps.articleImport.backlog.failed)} hint="failed import jobs" />
              <MetricCard label="Dead-lettered" value={formatNumber(props.importOps.articleImport.backlog.deadLettered)} hint="requires replay/repair" />
              <MetricCard label="Oldest queue age" value={formatDurationMs(props.importOps.articleImport.backlog.oldestQueuedAgeMs)} hint={props.importOps.environment} />
            </div>
          )}
        </section>
      </section>

      <section className="grid cards-2">
        {workspaceCards.map((card) => (
          <button key={card.route} type="button" className="card route-card" onClick={() => props.onNavigate(card.route)}>
            <div>
              <div className="card-title">{card.title}</div>
              <div className="card-copy">{card.detail}</div>
            </div>
            <span className="route-arrow">→</span>
          </button>
        ))}
      </section>

      <section className="grid cards-2">
        <SurfaceListCard title="Portable in Astra Web" items={PORTABLE_SURFACES} tone="success" />
        <SurfaceListCard title="Still extension-only" items={EXTENSION_ONLY_SURFACES} tone="warning" />
      </section>
    </>
  )
}

function TextWorkspacePage(props: {
  session: AstraSession | null
  config: AstraConfig
  onConfigChange: (patch: Parameters<typeof mergeWebConfig>[1]) => void
  onNavigate: (route: AppRoute) => void
}) {
  const { config, onConfigChange, onNavigate, session } = props
  const savedDraft = useMemo(() => readTextWorkspaceDraft(), [])
  const [sourceText, setSourceText] = useState(savedDraft?.sourceText ?? "")
  const [sourceLang, setSourceLang] = useState(savedDraft?.sourceLang ?? "")
  const [targetLang, setTargetLang] = useState(savedDraft?.targetLang ?? config.targetLang)
  const [task, setTask] = useState<"translate" | "explain" | "custom">(savedDraft?.task ?? "translate")
  const [customPrompt, setCustomPrompt] = useState(savedDraft?.customPrompt ?? "")
  const [resultText, setResultText] = useState(savedDraft?.resultText ?? "")
  const [runState, setRunState] = useState<"idle" | "running">("idle")
  const [runError, setRunError] = useState("")
  const [transferDraft, setTransferDraft] = useState<TextTransferDraft | null>(null)
  const [importMeta, setImportMeta] = useState<{ title: string; source: TextTransferDraft["source"] } | null>(
    savedDraft?.importedDraftTitle && savedDraft.importedDraftSource
      ? { title: savedDraft.importedDraftTitle, source: savedDraft.importedDraftSource }
      : null,
  )
  const [restoredDraftAt, setRestoredDraftAt] = useState<string | null>(savedDraft?.updatedAt ?? null)

  useEffect(() => {
    const draft = readTextTransferDraft()
    if (!draft) return
    setTransferDraft(draft)
    setImportMeta({ title: draft.title, source: draft.source })
    setRestoredDraftAt(draft.createdAt)
    setSourceText(draft.text)
    setResultText("")
    setRunError("")
    clearTextTransferDraft()
  }, [])

  useEffect(() => {
    const hasContent = Boolean(
      sourceText.trim()
      || sourceLang.trim()
      || resultText.trim()
      || customPrompt.trim()
      || task !== "translate"
      || targetLang !== config.targetLang,
    )

    if (!hasContent && !importMeta) {
      clearTextWorkspaceDraft()
      return
    }

    saveTextWorkspaceDraft({
      sourceText,
      sourceLang,
      targetLang,
      task,
      customPrompt,
      resultText,
      importedDraftTitle: importMeta?.title ?? null,
      importedDraftSource: importMeta?.source ?? null,
    })
  }, [config.targetLang, customPrompt, importMeta, resultText, sourceLang, sourceText, targetLang, task])

  const runTranslation = useCallback(async () => {
    if (!session) {
      onNavigate("/account")
      return
    }

    const trimmed = sourceText.trim()
    if (!trimmed) {
      setRunError("Paste or type some text first.")
      return
    }

    setRunState("running")
    setRunError("")

    onConfigChange({
      ...config,
      targetLang,
    })

    try {
      const result = await translateWithWebRelay({
        session,
        config: {
          ...config,
          targetLang,
        },
        request: {
          texts: [trimmed],
          targetLang,
          ...(sourceLang.trim() ? { sourceLang: sourceLang.trim() } : {}),
          task,
          ...(task === "custom" && customPrompt.trim()
            ? { customSystemPrompt: customPrompt.trim() }
            : {}),
        },
      })

      if (!result.ok) {
        setRunError(result.error.message)
        setResultText("")
        return
      }

      setResultText(result.translations[0] ?? "")
    } catch (error) {
      setRunError(error instanceof Error ? error.message : "Translation failed.")
    } finally {
      setRunState("idle")
    }
  }, [config, customPrompt, onConfigChange, onNavigate, session, sourceLang, sourceText, targetLang, task])

  const exportResult = useCallback(() => {
    if (!resultText.trim()) return
    downloadTextFile("astra-text-workspace.txt", `${sourceText.trim()}\n\n---\n\n${resultText.trim()}`)
  }, [resultText, sourceText])

  const clearWorkspace = useCallback(() => {
    setSourceText("")
    setSourceLang("")
    setTargetLang(config.targetLang)
    setTask("translate")
    setCustomPrompt("")
    setResultText("")
    setRunError("")
    setTransferDraft(null)
    setImportMeta(null)
    setRestoredDraftAt(null)
    clearTextWorkspaceDraft()
  }, [config.targetLang])

  return (
    <>
      {!props.session && (
        <InlineGate
          title="Sign in to translate"
          copy="The web companion uses Astra-managed relay sessions directly. Sign in from the account workspace first."
          actionLabel="Open account workspace"
          onAction={() => props.onNavigate("/account")}
        />
      )}

      {(transferDraft || restoredDraftAt) && (
        <div className="card subtle">
          {transferDraft
            ? <>Imported a {transferDraft.source.toUpperCase()} excerpt from <strong>{transferDraft.title}</strong>.</>
            : <>Restored your saved text workspace from {formatRelativeDate(restoredDraftAt)}.</>}
        </div>
      )}

      <section className="card workspace-reader-card">
        <div className="section-heading">
          <div>
            <div className="card-title">Text translation workspace</div>
            <div className="card-copy">A portable reader desk for pasted text, imported article/file excerpts, translations, and explanations.</div>
          </div>
          <div className="row gap wrap">
            <span className="status-pill">{props.config.provider.id} / {props.config.provider.model}</span>
            <button type="button" className="button ghost" onClick={clearWorkspace}>
              Clear workspace
            </button>
          </div>
        </div>

        <div className="workspace-utility-bar">
          <span className="workspace-mono">{importMeta ? `${importMeta.source} · ${importMeta.title}` : "manual text"}</span>
          <span className="workspace-mono">{sourceLang.trim() || "auto"} → {targetLang}</span>
          <span className={`status-pill${runState === "running" ? "" : " muted"}`}>{runState === "running" ? "streaming" : task}</span>
        </div>

        <div className="workspace-reader-layout">
          <article className="workspace-reader-column">
            <div className="grid form-grid">
              <label className="field">
                <span>Target language</span>
                <input
                  value={targetLang}
                  onChange={(event) => setTargetLang(event.target.value)}
                  placeholder="zh-CN"
                />
              </label>

              <label className="field">
                <span>Source language</span>
                <input
                  value={sourceLang}
                  onChange={(event) => setSourceLang(event.target.value)}
                  placeholder="optional"
                />
              </label>

              <label className="field">
                <span>Task</span>
                <select value={task} onChange={(event) => setTask(event.target.value as typeof task)}>
                  <option value="translate">Translate</option>
                  <option value="explain">Explain</option>
                  <option value="custom">Custom</option>
                </select>
              </label>

              <label className="field">
                <span>Model</span>
                <input
                  value={props.config.provider.model}
                  onChange={(event) => props.onConfigChange({
                    ...props.config,
                    provider: {
                      ...props.config.provider,
                      model: event.target.value,
                    },
                  })}
                />
              </label>
            </div>

            {task === "custom" && (
              <label className="field">
                <span>Custom system prompt</span>
                <textarea
                  rows={4}
                  value={customPrompt}
                  onChange={(event) => setCustomPrompt(event.target.value)}
                  placeholder="Tell Astra how to transform the text."
                />
              </label>
            )}

            <label className="field workspace-editor-field">
              <span>Source text</span>
              <textarea
                rows={16}
                value={sourceText}
                onChange={(event) => setSourceText(event.target.value)}
                placeholder="Paste text, article snippets, chapter excerpts, or anything imported from the file workspaces."
              />
              <small>{formatNumber(sourceText.length)} characters</small>
            </label>

            {runError && <div className="error-note">{runError}</div>}

            <div className="row gap wrap">
              <button type="button" className="button primary" onClick={() => void runTranslation()} disabled={runState === "running" || !props.session}>
                {runState === "running" ? "Running…" : "Run task"}
              </button>
              <button type="button" className="button secondary" onClick={() => void navigator.clipboard.writeText(resultText)} disabled={!resultText.trim()}>
                Copy result
              </button>
              <button type="button" className="button ghost" onClick={exportResult} disabled={!resultText.trim()}>
                Export
              </button>
            </div>
          </article>

          <aside className="workspace-margin-rail">
            <div className="eyebrow">Margin · this session</div>
            <label className="field workspace-editor-field">
              <span>Result</span>
              <textarea
                rows={14}
                value={resultText}
                onChange={(event) => setResultText(event.target.value)}
                placeholder="Translation or explanation output will appear here."
              />
              <small>{formatNumber(resultText.length)} characters</small>
            </label>
            <div className="workspace-note">
              Use the web companion for imported files and portable reading workspaces. Live page translation remains extension-only.
            </div>
            <div className="workspace-note">
              Progress is local to this browser: drafts, imported excerpts, and results are saved until you clear the workspace.
            </div>
          </aside>
        </div>
      </section>
    </>
  )
}

function VideoNoteWorkspacePage(props: {
  session: AstraSession | null
  deepLinkedJobId: string
  onNavigate: (route: AppRoute) => void
}) {
  const { deepLinkedJobId, onNavigate, session } = props
  const [sourceUrl, setSourceUrl] = useState("")
  const [jobId, setJobId] = useState("")
  const [workspace, setWorkspace] = useState<VideoNoteWorkspaceSnapshot | null>(null)
  const [restoreState, setRestoreState] = useState<"loading" | "ready">("loading")
  const [busyAction, setBusyAction] = useState<"create" | "status" | "artifact" | null>(null)
  const [notice, setNotice] = useState("")
  const [error, setError] = useState("")
  const deepLinkAutoloadedJobIdRef = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false

    void readVideoNoteWorkspace()
      .then((saved) => {
        if (!saved || cancelled) return
        setWorkspace(saved)
        setSourceUrl(saved.sourceUrl)
        setJobId(saved.jobId)
      })
      .finally(() => {
        if (!cancelled) {
          setRestoreState("ready")
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!workspace) return
    void saveVideoNoteWorkspace(workspace)
  }, [workspace])

  useEffect(() => {
    const trimmedDeepLinkedJobId = deepLinkedJobId.trim()
    if (!trimmedDeepLinkedJobId) return
    setJobId(trimmedDeepLinkedJobId)
  }, [deepLinkedJobId])

  const applyJobStatus = useCallback((nextJob: {
    jobId: string
    sourceUrl: string
    platform: VideoNoteWorkspaceSnapshot["platform"]
    title: string | null
    status: VideoNoteWorkspaceSnapshot["status"]
    artifactId: string | null
    updatedAt: string
  }) => {
    setWorkspace((current) => ({
      jobId: nextJob.jobId,
      artifactId: nextJob.artifactId,
      sourceUrl: nextJob.sourceUrl,
      platform: nextJob.platform,
      title: nextJob.title,
      status: nextJob.status,
      markdown: current?.jobId === nextJob.jobId ? current.markdown : "",
      transcriptSegments: current?.jobId === nextJob.jobId ? current.transcriptSegments : [],
      keyMoments: current?.jobId === nextJob.jobId ? current.keyMoments : [],
      screenshots: current?.jobId === nextJob.jobId ? current.screenshots : [],
      generatedAt: current?.jobId === nextJob.jobId ? current.generatedAt : nextJob.updatedAt,
      updatedAt: nextJob.updatedAt,
      lastViewedAt: new Date().toISOString(),
    }))
  }, [])

  const applyArtifact = useCallback((artifact: WebVideoNoteArtifact) => {
    const keyMoments = artifact.transcriptSegments.slice(0, 8).map((segment) => ({
      label: segment.text.length > 72 ? `${segment.text.slice(0, 69)}…` : segment.text,
      startMs: segment.startMs,
    }))

    setWorkspace((current) => ({
      jobId: artifact.jobId,
      artifactId: artifact.id,
      sourceUrl: artifact.sourceUrl,
      platform: artifact.platform,
      title: artifact.title,
      status: current?.jobId === artifact.jobId ? current.status : "completed",
      markdown: artifact.markdown,
      transcriptSegments: artifact.transcriptSegments,
      keyMoments,
      screenshots: current?.jobId === artifact.jobId ? current.screenshots : [],
      generatedAt: artifact.generatedAt,
      updatedAt: artifact.updatedAt,
      lastViewedAt: new Date().toISOString(),
    }))
  }, [])

  const requireSession = useCallback((): AstraSession | null => {
    if (session) return session
    onNavigate("/account")
    return null
  }, [onNavigate, session])

  const handleCreate = useCallback(async () => {
    const session = requireSession()
    if (!session) return

    const trimmedSourceUrl = sourceUrl.trim()
    if (!trimmedSourceUrl) {
      setError("Enter a video URL first.")
      return
    }

    setBusyAction("create")
    setError("")
    setNotice("")

    try {
      const created = await createWebVideoNoteJob({
        session,
        request: {
          sourceUrl: trimmedSourceUrl,
          sourceTitle: null,
          forceRegenerate: false,
          capture: null,
        },
      })
      setJobId(created.job.jobId)
      applyJobStatus({
        jobId: created.job.jobId,
        sourceUrl: created.job.sourceUrl,
        platform: created.job.platform,
        title: created.job.title,
        status: created.job.status,
        artifactId: created.job.artifactId,
        updatedAt: created.job.updatedAt,
      })
      setNotice(created.deduped ? "Reused an existing video-note job for this URL." : "Video-note job created.")
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Video-note job creation failed.")
    } finally {
      setBusyAction(null)
    }
  }, [applyJobStatus, requireSession, sourceUrl])

  const handleFetchStatus = useCallback(async () => {
    const session = requireSession()
    if (!session) return

    const trimmedJobId = jobId.trim()
    if (!trimmedJobId) {
      setError("Enter a video-note job id.")
      return
    }

    setBusyAction("status")
    setError("")
    setNotice("")

    try {
      const status = await fetchWebVideoNoteJob({
        session,
        jobId: trimmedJobId,
      })
      applyJobStatus({
        jobId: status.job.jobId,
        sourceUrl: status.job.sourceUrl,
        platform: status.job.platform,
        title: status.job.title,
        status: status.job.status,
        artifactId: status.job.artifactId,
        updatedAt: status.job.updatedAt,
      })
      setNotice(`Job status: ${status.job.status}`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Video-note status fetch failed.")
    } finally {
      setBusyAction(null)
    }
  }, [applyJobStatus, jobId, requireSession])

  const handleFetchArtifact = useCallback(async () => {
    const session = requireSession()
    if (!session) return

    const trimmedJobId = jobId.trim()
    if (!trimmedJobId) {
      setError("Enter a video-note job id.")
      return
    }

    setBusyAction("artifact")
    setError("")
    setNotice("")

    try {
      const artifact = await fetchWebVideoNoteArtifact({
        session,
        jobId: trimmedJobId,
      })
      applyArtifact(artifact)
      setNotice("Video-note artifact loaded and cached locally.")
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Video-note artifact fetch failed.")
    } finally {
      setBusyAction(null)
    }
  }, [applyArtifact, jobId, requireSession])

  useEffect(() => {
    const trimmedDeepLinkedJobId = deepLinkedJobId.trim()
    if (!trimmedDeepLinkedJobId || !session) return
    if (deepLinkAutoloadedJobIdRef.current === trimmedDeepLinkedJobId) return

    deepLinkAutoloadedJobIdRef.current = trimmedDeepLinkedJobId
    setJobId(trimmedDeepLinkedJobId)
    setBusyAction("status")
    setError("")
    setNotice("")

    let cancelled = false

    void (async () => {
      try {
        const status = await fetchWebVideoNoteJob({
          session,
          jobId: trimmedDeepLinkedJobId,
        })
        if (cancelled) return

        applyJobStatus({
          jobId: status.job.jobId,
          sourceUrl: status.job.sourceUrl,
          platform: status.job.platform,
          title: status.job.title,
          status: status.job.status,
          artifactId: status.job.artifactId,
          updatedAt: status.job.updatedAt,
        })

        try {
          const artifact = await fetchWebVideoNoteArtifact({
            session,
            jobId: trimmedDeepLinkedJobId,
          })
          if (cancelled) return
          applyArtifact(artifact)
          setNotice("Deep-linked video-note artifact loaded and cached locally.")
        } catch {
          if (cancelled) return
          setNotice(`Deep-linked job status: ${status.job.status}`)
        }
      } catch (reason) {
        if (cancelled) return
        setError(reason instanceof Error ? reason.message : "Deep-linked video-note load failed.")
      } finally {
        if (!cancelled) {
          setBusyAction(null)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [applyArtifact, applyJobStatus, deepLinkedJobId, session])

  const clearSaved = useCallback(() => {
    setWorkspace(null)
    setNotice("")
    setError("")
    setSourceUrl("")
    setJobId("")
    deepLinkAutoloadedJobIdRef.current = null
    void clearVideoNoteWorkspace()
  }, [])

  const videoNoteRows: WorkspaceSurfaceRow[] = workspace ? [{
    title: workspace.title ?? workspace.sourceUrl,
    meta: `${workspace.platform} · ${formatNumber(workspace.transcriptSegments.length)} segments · ${workspace.jobId}`,
    lang: "transcript → notes",
    ...(workspace.status === "completed" ? { progress: 100 } : {}),
    statusLabel: workspace.status,
  }] : []

  return (
    <section className="card">
      <div className="section-heading">
        <div>
          <div className="card-title">Video-note workspace</div>
          <div className="card-copy">Thin MVP for relay-backed video-note jobs: submit URL, poll status, fetch artifact, and cache note content locally.</div>
        </div>
        <span className="status-pill">{workspace ? `cached · ${workspace.status}` : restoreState === "loading" ? "checking cache…" : "no cached note"}</span>
      </div>

      {!session && (
        <InlineGate
          title="Sign in to use relay video-note jobs"
          copy="Video-note jobs and artifacts are authenticated relay resources."
          actionLabel="Open account workspace"
          onAction={() => onNavigate("/account")}
        />
      )}

      <label className="field">
        <span>Video URL</span>
        <div className="field-inline">
          <input
            value={sourceUrl}
            onChange={(event) => setSourceUrl(event.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
          />
          <button type="button" className="button primary" onClick={() => void handleCreate()} disabled={busyAction !== null}>
            {busyAction === "create" ? "Creating…" : "Create job"}
          </button>
        </div>
      </label>

      <label className="field">
        <span>Job ID</span>
        <div className="field-inline">
          <input
            value={jobId}
            onChange={(event) => setJobId(event.target.value)}
            placeholder="Paste an existing job id"
          />
          <button type="button" className="button secondary" onClick={() => void handleFetchStatus()} disabled={busyAction !== null}>
            {busyAction === "status" ? "Loading…" : "Fetch status"}
          </button>
          <button type="button" className="button secondary" onClick={() => void handleFetchArtifact()} disabled={busyAction !== null}>
            {busyAction === "artifact" ? "Loading…" : "Fetch artifact"}
          </button>
        </div>
      </label>

      {notice && <div className="card subtle inline-card">{notice}</div>}
      {error && <div className="error-note">{error}</div>}

      <WorkspaceSurfaceRows
        route="/video-notes"
        title="Video notes"
        kind="timestamps"
        rows={videoNoteRows}
        emptyHint="Create or fetch a relay-backed video-note job to add a timestamp row. Local-only manual timestamp editing is deferred."
      />

      {workspace && (
        <>
          <div className="row gap wrap" style={{ marginTop: "0.75rem" }}>
            <span className="status-pill">Status: {workspace.status}</span>
            <span className="status-pill">Platform: {workspace.platform}</span>
            {workspace.artifactId && <span className="status-pill success">Artifact ready</span>}
            <button type="button" className="button ghost" onClick={() => window.open(workspace.sourceUrl, "_blank", "noopener,noreferrer")}>
              Open source
            </button>
            <button type="button" className="button ghost" onClick={clearSaved}>
              Clear cached note
            </button>
          </div>

          <div className="grid cards-3 compact" style={{ marginTop: "0.75rem" }}>
            <MetricCard label="Job" value={workspace.jobId} hint={workspace.title ?? "Untitled video"} />
            <MetricCard label="Segments" value={formatNumber(workspace.transcriptSegments.length)} hint={`Updated ${formatRelativeDate(workspace.updatedAt)}`} />
            <MetricCard label="Key moments" value={formatNumber(workspace.keyMoments.length)} hint={workspace.artifactId ? "Artifact cached" : "Waiting for artifact"} />
          </div>

          <div className="reader-shell workspace-document-reader workspace-video-reader" style={{ marginTop: "0.75rem" }}>
            <aside className="reader-sidebar">
              <div className="reader-sidebar-title">Transcript preview</div>
              <div className="stack list">
                {workspace.transcriptSegments.length === 0 && (
                  <div className="preview-block">No transcript segments cached yet.</div>
                )}
                {workspace.transcriptSegments.slice(0, 24).map((segment, index) => (
                  <a
                    key={`${segment.startMs}-${segment.endMs}-${index}`}
                    className="preview-block"
                    href={workspace.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <strong>{formatDurationMs(segment.startMs)}</strong>
                    {"\n"}
                    {segment.text}
                  </a>
                ))}
              </div>
            </aside>

            <div className="reader-content">
              <div className="reader-content-header">
                <div>
                  <div className="card-title">Rendered note content</div>
                  <div className="card-copy">Latest cached markdown artifact from relay.</div>
                </div>
              </div>

              <div className="reader-body stack list">
                <pre className="preview-block" style={{ whiteSpace: "pre-wrap" }}>
                  {workspace.markdown.trim() || "No markdown cached yet. Fetch an artifact for this job."}
                </pre>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  )
}

function ArticleWorkspacePage(props: {
  apiBaseUrl: string
  articleImportBaseUrl: string
  onSendToText: (draft: Omit<TextTransferDraft, "createdAt">) => void
  onRecentImportsChange: () => void
}) {
  const { apiBaseUrl, articleImportBaseUrl, onRecentImportsChange, onSendToText } = props
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle")
  const [restoreState, setRestoreState] = useState<"loading" | "ready">("loading")
  const [error, setError] = useState("")
  const [importUrl, setImportUrl] = useState("")
  const [workspace, setWorkspace] = useState<ArticleWorkspaceState | null>(null)

  const articleText = workspace?.blocks.join("\n\n") ?? ""
  const wordCount = countWords(articleText)

  useEffect(() => {
    let cancelled = false

    void readArticleWorkspace()
      .then((saved) => {
        if (cancelled) return
        if (saved) {
          setImportUrl(saved.url)
          setWorkspace({ ...saved, restored: true })
          setState("ready")
        }
      })
      .finally(() => {
        if (!cancelled) {
          setRestoreState("ready")
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!workspace) return
    void saveArticleWorkspace({
      url: workspace.url,
      title: workspace.title,
      hostname: workspace.hostname,
      byline: workspace.byline,
      scope: workspace.scope,
      summary: workspace.summary,
      blocks: workspace.blocks,
      importedAt: workspace.importedAt,
    })
    saveRecentImport(summarizeArticleImport(workspace))
    onRecentImportsChange()
  }, [onRecentImportsChange, workspace])

  const runImport = useCallback(async () => {
    setState("loading")
    setError("")

    try {
      const imported = await importReadableArticleFromUrl(importUrl, {
        apiBaseUrl,
        platformBaseUrl: articleImportBaseUrl,
      })
      setImportUrl(imported.url)
      setWorkspace({
        ...imported,
        importedAt: new Date().toISOString(),
        restored: false,
      })
      setState("ready")
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Article import failed.")
      setState("error")
    }
  }, [apiBaseUrl, articleImportBaseUrl, importUrl])

  const clearSaved = useCallback(() => {
    setWorkspace(null)
    setState("idle")
    setError("")
    void clearArticleWorkspace()
    removeRecentImport("article")
    onRecentImportsChange()
  }, [onRecentImportsChange])

  const articleRows: WorkspaceSurfaceRow[] = workspace ? [{
    title: workspace.title,
    meta: `${workspace.hostname} · ${formatNumber(workspace.blocks.length)} blocks · ${formatNumber(wordCount)} words`,
    lang: "auto → reader",
    statusLabel: "imported",
  }] : []

  return (
    <section className="card workspace-list-page">
      <div className="section-heading">
        <div>
          <div className="eyebrow">Library</div>
          <div className="card-title">URL article workspace</div>
          <div className="card-copy">Readable imports appear as Library rows, then open into a read-only reader with an import-details margin.</div>
        </div>
        <span className="status-pill">{workspace ? "saved locally" : restoreState === "loading" ? "checking saved article…" : "no article loaded"}</span>
      </div>

      <label className="field">
        <span>Article URL</span>
        <div className="field-inline">
          <input
            value={importUrl}
            onChange={(event) => setImportUrl(event.target.value)}
            placeholder="https://example.com/article"
          />
          <button type="button" className="button primary" onClick={() => void runImport()} disabled={state === "loading"}>
            {state === "loading" ? "Importing…" : "Import URL"}
          </button>
        </div>
      </label>

      <div className="helper-copy">
        Relay-backed import avoids many browser fetch/CORS failures, but some sites still block server fetches or hide readable content behind client-side rendering.
      </div>

      {state === "error" && error && <div className="error-note">{error}</div>}

      {workspace?.restored && (
        <div className="card subtle inline-card">
          Restored your saved article import from {formatRelativeDate(workspace.importedAt)}.
        </div>
      )}

      <div className="workspace-filter-row" aria-label="Article filters">
        <span className="status-pill success">All {workspace ? 1 : 0}</span>
        <span className="status-pill muted">Unread 0</span>
        <span className="status-pill muted">In progress {workspace ? 1 : 0}</span>
        <span className="status-pill muted">With saved words 0</span>
      </div>

      <WorkspaceSurfaceRows
        route="/articles"
        title={`${workspace ? 1 : 0} article${workspace ? "" : "s"} · local library`}
        kind="articles"
        rows={articleRows}
        emptyHint="Import a URL above to create the first truthful article row. Multi-article library, bulk select, and delete are deferred."
      />

      {workspace && (
        <>
          <div className="section-heading" style={{ marginTop: "1rem" }}>
            <div>
              <div className="card-title">{workspace.title}</div>
              <div className="card-copy">{workspace.hostname}{workspace.byline ? ` · ${workspace.byline}` : ""}</div>
            </div>
            <div className="row gap wrap">
              <span className="status-pill">{workspace.scope === "article" ? "article extraction" : "page fallback"}</span>
              <button
                type="button"
                className="button secondary"
                disabled={!articleText.trim()}
                onClick={() => onSendToText({
                  title: workspace.title,
                  source: "article",
                  text: articleText,
                })}
              >
                Send article to text workspace
              </button>
              <button type="button" className="button ghost" onClick={() => void navigator.clipboard.writeText(articleText)} disabled={!articleText.trim()}>
                Copy article text
              </button>
              <button
                type="button"
                className="button ghost"
                onClick={() => {
                  try {
                    const safeUrl = new URL(workspace.url)
                    if (safeUrl.protocol !== "http:" && safeUrl.protocol !== "https:") {
                      throw new Error("Only http(s) URLs are supported.")
                    }
                    window.open(safeUrl.toString(), "_blank", "noopener,noreferrer")
                  } catch {
                    setError("Only http(s) article URLs can be opened from saved imports.")
                  }
                }}
              >
                Open source
              </button>
              <button type="button" className="button ghost" onClick={clearSaved}>
                Clear saved article
              </button>
            </div>
          </div>

          <div className="grid cards-3 compact">
            <MetricCard label="Readable blocks" value={formatNumber(workspace.blocks.length)} hint={workspace.hostname} />
            <MetricCard label="Words" value={formatNumber(wordCount)} hint={`Saved ${formatRelativeDate(workspace.importedAt)}`} />
            <MetricCard label="Source mode" value={workspace.scope} hint={workspace.summary ?? "No summary extracted"} />
          </div>

          {workspace.summary && (
            <div className="card subtle inline-card">
              <div className="card-title">Readable summary</div>
              <div className="card-copy">{workspace.summary}</div>
            </div>
          )}

          <div className="reader-shell workspace-document-reader">
            <aside className="reader-sidebar">
              <div className="reader-sidebar-title">Margin · import details</div>
              <div className="stack list">
                <div className="preview-block"><strong>URL</strong>{"\n"}{workspace.url}</div>
                <div className="preview-block"><strong>Extraction</strong>{"\n"}{workspace.scope === "article" ? "Article-focused readability" : "Full page fallback"}</div>
                <div className="preview-block"><strong>Imported</strong>{"\n"}{formatRelativeDate(workspace.importedAt)}</div>
                <div className="preview-block"><strong>Progress</strong>{"\n"}Read-only web workspace · send to Text to translate or explain.</div>
              </div>
            </aside>

            <div className="reader-content">
              <div className="reader-content-header">
                <div>
                  <div className="card-title">Read-only article text</div>
                  <div className="card-copy">{formatNumber(workspace.blocks.length)} extracted reading blocks</div>
                </div>
              </div>

              <div className="reader-body stack list">
                {workspace.blocks.map((block, index) => (
                  <div key={`${workspace.url}-${index}`} className="preview-block">
                    {block}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  )
}

function PdfWorkspacePage(props: {
  onSendToText: (draft: Omit<TextTransferDraft, "createdAt">) => void
  onRecentImportsChange: () => void
}) {
  const { onRecentImportsChange, onSendToText } = props
  const certMode = readAstraCertificationParams().enabled
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle")
  const [error, setError] = useState("")
  const [preview, setPreview] = useState<PdfPreviewState | null>(null)
  const effectivePreview = certMode ? ASTRA_CERT_PDF_PREVIEW : preview

  const currentPage = effectivePreview?.pages.find((page) => page.pageNumber === effectivePreview.selectedPageNumber) ?? effectivePreview?.pages[0] ?? null
  const currentPageText = currentPage?.blocks.join("\n\n") ?? ""

  useEffect(() => {
    if (certMode) return
    let cancelled = false

    void readPdfWorkspace().then((saved) => {
      if (cancelled || !saved) return
      setPreview(fromPdfWorkspaceSnapshot(saved))
      setState("ready")
    })

    return () => {
      cancelled = true
    }
  }, [certMode])

  useEffect(() => {
    if (!preview || certMode) return
    void savePdfWorkspace(toPdfWorkspaceSnapshot(preview))
    saveRecentImport(summarizePdfImport(preview))
    onRecentImportsChange()
  }, [certMode, onRecentImportsChange, preview])

  const handleFile = useCallback(async (file: File) => {
    setState("loading")
    setError("")

    try {
      const { extractPdfPages } = await loadPdfExtractor()
      const pages = await extractPdfPages(new Uint8Array(await file.arrayBuffer()))
      if (pages.length === 0) {
        throw new Error("No readable pages were extracted from this PDF.")
      }

      setPreview(createPdfPreviewState(file, pages))
      setState("ready")
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "PDF preview could not be extracted.")
      setState("error")
    }
  }, [])

  const clearSaved = useCallback(() => {
    setPreview(null)
    setState("idle")
    setError("")
    void clearPdfWorkspace()
    removeRecentImport("pdf")
    onRecentImportsChange()
  }, [onRecentImportsChange])

  const pdfRows: WorkspaceSurfaceRow[] = certMode ? ASTRA_CERT_PDF_ROWS : preview ? [{
    title: preview.name,
    meta: `${preview.sizeLabel} · ${formatNumber(preview.pageCount)} pages`,
    lang: "file → text",
    progress: preview.pageCount > 0 ? Math.max(1, Math.round((preview.selectedPageNumber / preview.pageCount) * 100)) : 0,
    statusLabel: preview.selectedPageNumber === preview.pageCount ? "done" : "resume",
  }] : []

  return (
    <FileShellCard
      title="PDF reader workspace"
      description="Import a PDF, keep metadata and extracted text durable by library item, and re-import the original file when binary bytes are needed."
      accept=".pdf"
      actionLabel="Choose PDF"
      state={certMode ? "ready" : state}
      error={error}
      onFile={handleFile}
    >
      {certMode && (
        <div className="workspace-note workspace-cert-note">
          Certification demo seed: populated rows below are local screenshot fixtures only and are never written to user storage.
        </div>
      )}
      {preview?.restored && !certMode && (
        <div className="card subtle inline-card">
          Restored your saved PDF extracted-text workflow from {formatRelativeDate(preview.importedAt)}. Original PDF bytes are not synced; re-import if a binary viewer needs them.
        </div>
      )}

      <WorkspaceSurfaceRows
        route="/files/pdf"
        title="PDFs"
        kind="documents"
        rows={pdfRows}
        emptyHint="Drop a PDF above to create the first row. Page-range translation stays in the reader, not in this list."
      />

      {effectivePreview && currentPage && (
        <>
          <div className="section-heading">
            <div>
              <div className="card-title">{effectivePreview.name}</div>
              <div className="card-copy">Select a page, review extracted text blocks, and send the current page into the text workspace.</div>
            </div>
            <div className="row gap wrap">
              {!certMode && (
                <>
                  <button
                    type="button"
                    className="button secondary"
                    disabled={!currentPageText.trim()}
                    onClick={() => onSendToText({
                      title: `${effectivePreview.name} · page ${currentPage.pageNumber}`,
                      source: "pdf",
                      text: currentPageText,
                    })}
                  >
                    Send page to text workspace
                  </button>
                  <button type="button" className="button ghost" onClick={() => void navigator.clipboard.writeText(currentPageText)} disabled={!currentPageText.trim()}>
                    Copy page text
                  </button>
                  <button type="button" className="button ghost" onClick={clearSaved}>
                    Clear saved preview
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="grid cards-3 compact">
            <MetricCard label="Pages" value={formatNumber(effectivePreview.pageCount)} hint={effectivePreview.sizeLabel} />
            <MetricCard label="Current page" value={`${currentPage.pageNumber}`} hint={`${formatNumber(currentPage.blockCount)} text blocks`} />
            <MetricCard label="Words on page" value={formatNumber(currentPage.wordCount)} hint={`Saved ${formatRelativeDate(effectivePreview.importedAt)}`} />
          </div>

          <div className="reader-shell workspace-document-reader">
            <aside className="reader-sidebar">
              <div className="reader-sidebar-title">Pages</div>
              <div className="reader-nav">
                {effectivePreview.pages.map((page) => (
                  <button
                    key={page.pageNumber}
                    type="button"
                    className={`reader-nav-item${effectivePreview.selectedPageNumber === page.pageNumber ? " is-active" : ""}`}
                    onClick={() => {
                      if (certMode) return
                      setPreview((current) => current ? { ...current, selectedPageNumber: page.pageNumber } : current)
                    }}
                  >
                    <strong>Page {page.pageNumber}</strong>
                    <small>{page.excerpt || "No extracted text"}</small>
                  </button>
                ))}
              </div>
            </aside>

            <div className="reader-content">
              <div className="reader-content-header">
                <div>
                  <div className="card-title">Page {currentPage.pageNumber}</div>
                  <div className="card-copy">{formatNumber(currentPage.blockCount)} extracted blocks</div>
                </div>
              </div>

              <div className="reader-body stack list">
                {currentPage.blocks.map((block, index) => (
                  <div key={`${currentPage.pageNumber}-${index}`} className="preview-block">
                    {block}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </FileShellCard>
  )
}

function EpubWorkspacePage(props: {
  onSendToText: (draft: Omit<TextTransferDraft, "createdAt">) => void
  onRecentImportsChange: () => void
}) {
  const { onRecentImportsChange, onSendToText } = props
  const bookRef = useRef<Book | null>(null)
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle")
  const [error, setError] = useState("")
  const [preview, setPreview] = useState<EpubPreviewState | null>(null)

  useEffect(() => () => {
    bookRef.current?.destroy()
    bookRef.current = null
  }, [])

  useEffect(() => {
    let cancelled = false

    void readEpubWorkspace().then((saved) => {
      if (cancelled || !saved) return
      setPreview(fromEpubWorkspaceSnapshot(saved))
      setState("ready")
    })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!preview) return
    void saveEpubWorkspace(toEpubWorkspaceSnapshot(preview))
    saveRecentImport(summarizeEpubImport(preview))
    onRecentImportsChange()
  }, [onRecentImportsChange, preview])

  const currentChapter = preview?.loadedChapters.find((chapter) => chapter.href === preview.selectedChapterHref)
    ?? preview?.loadedChapters[0]
    ?? null
  const currentChapterText = currentChapter?.paragraphs.join("\n\n") ?? ""

  const handleFile = useCallback(async (file: File) => {
    setState("loading")
    setError("")

    let book: Book | null = null
    try {
      bookRef.current?.destroy()
      const { default: ePub } = await loadEpubModule()
      book = ePub(await file.arrayBuffer())
      bookRef.current = book
      await book.ready
      const navigation = await book.loaded.navigation
      let chapters = flattenNavItems(navigation.toc ?? [])

      if (chapters.length === 0) {
        const spineItems = (book.spine as typeof book.spine & { spineItems?: Array<{ href?: string }> }).spineItems ?? []
        chapters = spineItems
          .map((item, index) => item.href ? {
            href: item.href,
            label: `Chapter ${index + 1}`,
            depth: 0,
          } : null)
          .filter((item): item is EpubChapterItem => Boolean(item))
      }

      if (chapters.length === 0) {
        throw new Error("This EPUB did not expose readable chapter navigation.")
      }

      const firstChapter = await loadEpubChapterPreview(book, chapters[0])
      if (!firstChapter) {
        throw new Error("The first EPUB chapter did not contain readable text.")
      }

      setPreview({
        name: file.name,
        title: book.packaging?.metadata?.title ?? file.name,
        author: book.packaging?.metadata?.creator ?? "Unknown author",
        chapters,
        loadedChapters: [firstChapter],
        selectedChapterHref: firstChapter.href,
        importedAt: new Date().toISOString(),
        restored: false,
      })
      setState("ready")
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "EPUB preview could not be loaded.")
      setState("error")
      book?.destroy()
      if (bookRef.current === book) {
        bookRef.current = null
      }
    }
  }, [])

  const selectChapter = useCallback(async (chapter: EpubChapterItem) => {
    setError("")

    const loadedChapter = preview?.loadedChapters.find((item) => item.href === chapter.href)
    if (loadedChapter) {
      setPreview((current) => current ? { ...current, selectedChapterHref: chapter.href } : current)
      return
    }

    if (!bookRef.current) {
      setError("This restored EPUB snapshot only includes chapters you already opened. Re-import the EPUB to load more chapters.")
      return
    }

    setState("loading")
    try {
      const loaded = await loadEpubChapterPreview(bookRef.current, chapter)
      if (!loaded) {
        throw new Error("That chapter did not contain readable text.")
      }

      setPreview((current) => {
        if (!current) return current
        return {
          ...current,
          selectedChapterHref: chapter.href,
          loadedChapters: [...current.loadedChapters, loaded],
          restored: false,
        }
      })
      setState("ready")
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Chapter preview could not be loaded.")
      setState("error")
    }
  }, [preview?.loadedChapters])

  const clearSaved = useCallback(() => {
    bookRef.current?.destroy()
    bookRef.current = null
    setPreview(null)
    setState("idle")
    setError("")
    void clearEpubWorkspace()
    removeRecentImport("epub")
    onRecentImportsChange()
  }, [onRecentImportsChange])

  const epubRows: WorkspaceSurfaceRow[] = preview ? [{
    title: preview.title,
    meta: `${preview.author} · ${formatNumber(preview.loadedChapters.length)} of ${formatNumber(preview.chapters.length)} chapters opened`,
    lang: "file → text",
    progress: preview.chapters.length > 0 ? Math.max(1, Math.round((preview.loadedChapters.length / preview.chapters.length) * 100)) : 0,
    statusLabel: "resume",
  }] : []

  return (
    <FileShellCard
      title="EPUB reader workspace"
      description="Open chapter navigation, persist metadata and extracted chapter text, and re-import the EPUB when unopened chapters require original bytes."
      accept=".epub"
      actionLabel="Choose EPUB"
      state={state}
      error={error}
      onFile={handleFile}
    >
      {preview?.restored && (
        <div className="card subtle inline-card">
          Restored your saved EPUB extracted-text workflow from {formatRelativeDate(preview.importedAt)}. Original EPUB bytes are not synced; re-import to load unopened chapters.
        </div>
      )}

      <WorkspaceSurfaceRows
        route="/files/epub"
        title="EPUBs"
        kind="books"
        rows={epubRows}
        emptyHint="Drop an EPUB above to create the first row. Chapter translation opens inside the reader and only caches chapters you open."
      />

      {preview && currentChapter && (
        <>
          <div className="section-heading">
            <div>
              <div className="card-title">{preview.title}</div>
              <div className="card-copy">{preview.author}</div>
            </div>
            <div className="row gap wrap">
              <button
                type="button"
                className="button secondary"
                disabled={!currentChapterText.trim()}
                onClick={() => onSendToText({
                  title: `${preview.title} · ${currentChapter.label}`,
                  source: "epub",
                  text: currentChapterText,
                })}
              >
                Send chapter to text workspace
              </button>
              <button type="button" className="button ghost" onClick={() => void navigator.clipboard.writeText(currentChapterText)} disabled={!currentChapterText.trim()}>
                Copy chapter text
              </button>
              <button type="button" className="button ghost" onClick={clearSaved}>
                Clear saved preview
              </button>
            </div>
          </div>

          <div className="grid cards-3 compact">
            <MetricCard label="Chapters" value={formatNumber(preview.chapters.length)} hint={preview.name} />
            <MetricCard label="Opened locally" value={formatNumber(preview.loadedChapters.length)} hint={`Current: ${currentChapter.label}`} />
            <MetricCard label="Words in chapter" value={formatNumber(currentChapter.wordCount)} hint={`Saved ${formatRelativeDate(preview.importedAt)}`} />
          </div>

          <div className="reader-shell workspace-document-reader">
            <aside className="reader-sidebar">
              <div className="reader-sidebar-title">Chapters</div>
              <div className="reader-nav">
                {preview.chapters.map((chapter) => {
                  const isLoaded = preview.loadedChapters.some((item) => item.href === chapter.href)
                  const isActive = preview.selectedChapterHref === chapter.href
                  return (
                    <button
                      key={chapter.href}
                      type="button"
                      className={`reader-nav-item${isActive ? " is-active" : ""}`}
                      onClick={() => void selectChapter(chapter)}
                    >
                      <strong style={{ paddingLeft: `${chapter.depth * 0.8}rem` }}>{chapter.label}</strong>
                      <small>{isLoaded ? "Saved locally" : "Load chapter"}</small>
                    </button>
                  )
                })}
              </div>
            </aside>

            <div className="reader-content">
              <div className="reader-content-header">
                <div>
                  <div className="card-title">{currentChapter.label}</div>
                  <div className="card-copy">{formatNumber(currentChapter.paragraphs.length)} extracted reading blocks</div>
                </div>
              </div>

              <div className="reader-body stack list">
                {currentChapter.paragraphs.map((paragraph, index) => (
                  <div key={`${currentChapter.href}-${index}`} className="preview-block">
                    {paragraph}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </FileShellCard>
  )
}

function SubtitleWorkspacePage(props: {
  session: AstraSession | null
  config: AstraConfig
  onNavigate: (route: AppRoute) => void
  onRecentImportsChange: () => void
}) {
  const { config, onNavigate, onRecentImportsChange, session } = props
  const [workspace, setWorkspace] = useState<SubtitleWorkspaceState | null>(null)
  const [state, setState] = useState<"idle" | "parsed" | "translating" | "done" | "error">("idle")
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false

    void readSubtitleWorkspace().then((saved) => {
      if (cancelled || !saved) return
      setWorkspace(fromSubtitleWorkspaceSnapshot(saved))
      setState("parsed")
    })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!workspace) return
    void saveSubtitleWorkspace(toSubtitleWorkspaceSnapshot(workspace))
    saveRecentImport(summarizeSubtitleImport(workspace))
    onRecentImportsChange()
  }, [onRecentImportsChange, workspace])

  const isDocument = workspace?.format === "markdown" || workspace?.format === "txt" || workspace?.format === "html"
  const items = isDocument ? (workspace?.documents ?? []) : (workspace?.cues ?? [])

  const handleFile = useCallback(async (file: File) => {
    try {
      const content = await file.text()
      const documentFormat = detectDocumentFormat(file.name)
      const importedAt = new Date().toISOString()

      if (documentFormat) {
        const documents = parseDocument(content, documentFormat)
        if (documents.length === 0) {
          throw new Error("The selected document did not contain readable paragraphs.")
        }

        setWorkspace({
          fileName: file.name,
          format: documentFormat,
          cues: [],
          documents,
          translations: new Map(),
          importedAt,
          lastExportedAt: null,
          restored: false,
        })
        setState("parsed")
        setError("")
        return
      }

      const subtitles = parseSubtitles(content)
      if (subtitles.format === "unknown" || subtitles.cues.length === 0) {
        throw new Error("Supports SRT, VTT, ASS, SSA, Markdown, TXT, and HTML.")
      }

      setWorkspace({
        fileName: file.name,
        format: subtitles.format,
        cues: subtitles.cues,
        documents: [],
        translations: new Map(),
        importedAt,
        lastExportedAt: null,
        restored: false,
      })
      setState("parsed")
      setError("")
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Subtitle/document parsing failed.")
      setState("error")
    }
  }, [])

  const translateAll = useCallback(async () => {
    if (!session || !workspace) {
      onNavigate("/account")
      return
    }

    const texts = isDocument
      ? workspace.documents.map((entry) => entry.text)
      : workspace.cues.map((cue) => cue.text.replace(/\n/g, " "))

    setState("translating")
    setError("")

    try {
      const result = await translateWithWebRelay({
        session,
        config,
        request: {
          texts,
          targetLang: config.targetLang,
          task: "translate",
        },
      })

      if (!result.ok) {
        setError(result.error.message)
        setState("error")
        return
      }

      const translations = new Map<number, string>()
      result.translations.forEach((translation, index) => translations.set(index, translation))
      setWorkspace({
        ...workspace,
        translations,
        restored: false,
      })
      setState("done")
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Translation failed.")
      setState("error")
    }
  }, [config, isDocument, onNavigate, session, workspace])

  const exportFile = useCallback(() => {
    if (!workspace) return

    const baseName = workspace.fileName.replace(/\.[^.]+$/, "")
    if (isDocument) {
      downloadTextFile(`${baseName}.bilingual.md`, exportMarkdownBilingual(workspace.documents, workspace.translations))
    } else if (workspace.format === "vtt") {
      downloadTextFile(`${baseName}.bilingual.vtt`, exportBilingualVtt(workspace.cues, workspace.translations))
    } else {
      downloadTextFile(`${baseName}.bilingual.srt`, exportBilingualSrt(workspace.cues, workspace.translations))
    }

    setWorkspace({
      ...workspace,
      lastExportedAt: new Date().toISOString(),
      restored: false,
    })
  }, [isDocument, workspace])

  const clearSaved = useCallback(() => {
    setWorkspace(null)
    setState("idle")
    setError("")
    void clearSubtitleWorkspace()
    removeRecentImport("subtitle")
    onRecentImportsChange()
  }, [onRecentImportsChange])

  const subtitleRows: WorkspaceSurfaceRow[] = workspace ? [{
    title: workspace.fileName,
    meta: `${formatLabel(workspace.format)} · ${formatNumber(items.length)} ${isDocument ? "paragraphs" : "cues"}`,
    lang: `file → ${config.targetLang}`,
    progress: items.length > 0 ? Math.round((workspace.translations.size / items.length) * 100) : 0,
    statusLabel: workspace.translations.size === items.length && items.length > 0 ? "done" : "new",
  }] : []

  return (
    <>
      {!session && (
        <InlineGate
          title="Translation uses your Astra session"
          copy="Parsing works locally without sign-in. Translating and export-ready bilingual output requires an Astra session."
          actionLabel="Open account workspace"
          onAction={() => onNavigate("/account")}
        />
      )}

      <FileShellCard
        title="Subtitle and document workspace"
        description="Parse subtitles or docs locally, persist metadata and extracted text by library item, translate via the Astra relay, and export bilingual output."
        accept=".srt,.vtt,.ass,.ssa,.md,.txt,.html"
        actionLabel="Choose file"
        state={state === "parsed" || state === "done" ? "ready" : state}
        error={error}
        onFile={handleFile}
      >
        {workspace?.restored && (
          <div className="card subtle inline-card">
            Restored your saved subtitle/document extracted-text workflow from {formatRelativeDate(workspace.importedAt)}. Original file bytes are not synced; re-import if needed.
          </div>
        )}

        <WorkspaceSurfaceRows
          route="/files/subtitles"
          title="Subtitles and documents"
          kind="srt · vtt · docs"
          rows={subtitleRows}
          emptyHint="Drop a subtitle or document above. Subtitles open as bilingual reading sessions paced by timecode; documents use paragraph rows."
        />

        {workspace && (
          <>
            <div className="section-heading">
              <div>
                <div className="card-title">
                  {workspace.fileName} · {formatLabel(workspace.format)}
                </div>
                <div className="card-copy">
                  {formatNumber(items.length)} {isDocument ? "paragraphs" : "subtitle cues"} parsed inside Astra.
                </div>
              </div>
              <div className="row gap wrap">
                <button type="button" className="button primary" onClick={() => void translateAll()} disabled={!props.session || state === "translating"}>
                  {state === "translating" ? "Translating…" : "Translate all"}
                </button>
                <button type="button" className="button secondary" onClick={exportFile} disabled={workspace.translations.size === 0}>
                  Export bilingual
                </button>
                <button type="button" className="button ghost" onClick={clearSaved}>
                  Clear saved workspace
                </button>
              </div>
            </div>

            <div className="grid cards-3 compact">
              <MetricCard label="Target language" value={props.config.targetLang} hint="shared with text workspace" />
              <MetricCard label="Provider" value={props.config.provider.id} hint={props.config.provider.model} />
              <MetricCard label="Translated items" value={formatNumber(workspace.translations.size)} hint={workspace.lastExportedAt ? `Last export ${formatRelativeDate(workspace.lastExportedAt)}` : "Ready for export"} />
            </div>

            {state === "translating" && (
              <div className="workspace-inline-progress">
                <WorkspaceProgressBar value={items.length > 0 ? (workspace.translations.size / items.length) * 100 : 0} label="Subtitle translation progress" />
                <span className="workspace-mono">Translating via Astra relay…</span>
              </div>
            )}

            <div className="table-wrap workspace-subtitle-table">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    {!isDocument && <th>Time</th>}
                    <th>Original</th>
                    <th>Translation</th>
                  </tr>
                </thead>
                <tbody>
                  {(isDocument ? workspace.documents : workspace.cues).slice(0, 24).map((item, index) => (
                    <tr key={`row-${index}`}>
                      <td>{index + 1}</td>
                      {!isDocument && <td>{(item as SubtitleCue).startTime}</td>}
                      <td>{item.text}</td>
                      <td className="translated-cell">{workspace.translations.get(index) ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </FileShellCard>
    </>
  )
}

function AssetLibraryPage(props: {
  cloudAssets: WebCloudAssetsWorkspace | null
  cloudState: "idle" | "loading" | "ready" | "error"
  importOps: WebImportQueueObservability | null
  importOpsState: "idle" | "loading" | "ready" | "error"
  recentImports: RecentWebImport[]
  onNavigate: (route: AppRoute) => void
}) {
  const certMode = readAstraCertificationParams().enabled
  const [importLibrary, setImportLibrary] = useState<ImportLibraryEntry[]>([])
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(certMode ? ASTRA_CERT_IMPORT_LIBRARY[0]?.id ?? null : null)
  const [libraryState, setLibraryState] = useState<"loading" | "ready">(certMode ? "ready" : "loading")
  const [assetNotice, setAssetNotice] = useState("")

  useEffect(() => {
    if (certMode) {
      setImportLibrary(ASTRA_CERT_IMPORT_LIBRARY)
      setSelectedAssetId((current) => current ?? ASTRA_CERT_IMPORT_LIBRARY[0]?.id ?? null)
      setLibraryState("ready")
      return
    }

    let cancelled = false
    setLibraryState("loading")
    void readImportLibrary()
      .then((entries) => {
        if (cancelled) return
        setImportLibrary(entries)
        setSelectedAssetId((current) => current ?? entries[0]?.id ?? null)
      })
      .finally(() => {
        if (!cancelled) {
          setLibraryState("ready")
        }
      })
    return () => {
      cancelled = true
    }
  }, [certMode, props.recentImports])

  const selectedImport = importLibrary.find((entry) => entry.id === selectedAssetId) ?? null
  const cloudLibraryItems = certMode ? [] : props.cloudAssets?.library.items ?? []
  const readingHistoryEntries = certMode ? ASTRA_CERT_READING_HISTORY : props.cloudAssets?.readingHistory.entries ?? []
  const studyPages = certMode ? ASTRA_CERT_STUDY_PAGES : props.cloudAssets?.studyProgress.pages ?? []
  const vocabularyEntries = certMode ? ASTRA_CERT_VOCABULARY : props.cloudAssets?.vocabulary.entries ?? []
  const assetTiles = certMode ? ASTRA_CERT_ASSET_TILES : [
    ...importLibrary.map((entry) => ({
      id: `local-${entry.id}`,
      title: entry.title,
      meta: entry.summary,
      route: entry.route,
      tone: "local",
    })),
    ...cloudLibraryItems.slice(0, 6).map((entry) => ({
      id: `cloud-library-${entry.id}`,
      title: entry.title,
      meta: `${entry.kind.replace(/-/g, " ")} · ${entry.summary}`,
      route: entry.route,
      tone: "history",
    })),
    ...readingHistoryEntries.slice(0, 4).map((entry) => ({
      id: `history-${entry.id}`,
      title: entry.title,
      meta: `${entry.hostname} · ${formatNumber(entry.wordsTranslated)} words`,
      route: "/articles",
      tone: "history",
    })),
    ...vocabularyEntries.slice(0, 4).map((entry) => ({
      id: `vocab-${entry.id}`,
      title: entry.text,
      meta: entry.translation || entry.explanation || "saved word",
      route: "/assets",
      tone: "vocab",
    })),
  ]

  const refreshLocalLibrary = useCallback(async () => {
    if (certMode) return
    setLibraryState("loading")
    const entries = await readImportLibrary()
    setImportLibrary(entries)
    setSelectedAssetId((current) => entries.some((entry) => entry.id === current) ? current : entries[0]?.id ?? null)
    setLibraryState("ready")
  }, [certMode])

  const openSelectedImport = useCallback(async (entry: ImportLibraryEntry) => {
    if (!certMode) {
      await openLibraryItem(entry.id)
    }
    props.onNavigate(entry.route)
  }, [certMode, props])

  const renameSelectedImport = useCallback(async (entry: ImportLibraryEntry) => {
    if (certMode) return
    const nextTitle = typeof window !== "undefined" && typeof window.prompt === "function"
      ? window.prompt("Rename this library item", entry.title)
      : null
    if (!nextTitle?.trim()) return
    await renameLibraryItem(entry.id, nextTitle)
    await refreshLocalLibrary()
    setAssetNotice("Renamed local library item.")
  }, [certMode, refreshLocalLibrary])

  const removeSelectedImport = useCallback(async (entry: ImportLibraryEntry) => {
    if (certMode) return
    const confirmed = typeof window !== "undefined" && typeof window.confirm === "function"
      ? window.confirm(`Remove ${entry.title} from this device's local library?`)
      : true
    if (!confirmed) return
    await removeLibraryItem(entry.id)
    await refreshLocalLibrary()
    setAssetNotice("Removed local library item from this device.")
  }, [certMode, refreshLocalLibrary])

  return (
    <div className="asset-library-page">
      <section className="card asset-library-hero-card">
        <div className="section-heading">
          <div>
            <div className="card-title">Cloud and local asset detail pages</div>
            <div className="card-copy">Inspect per-asset details across local import workspaces and synced cloud continuity collections.</div>
          </div>
          <button type="button" className="button secondary" onClick={() => props.onNavigate("/account")}>
            Open account controls
          </button>
        </div>

        <div className="grid cards-3 compact asset-summary-metrics">
          <MetricCard label="Local imports" value={formatNumber(importLibrary.length)} hint="saved workspace entries on this device" />
          <MetricCard label="Cloud reading pages" value={formatNumber(readingHistoryEntries.length)} hint="reading history asset records" />
          <MetricCard label="Cloud study pages" value={formatNumber(studyPages.length)} hint="durable study progress assets" />
        </div>

        <div className="asset-grid" aria-label="Asset thumbnail grid">
          {assetTiles.length === 0 ? (
            <div className="asset-tile asset-tile--empty">
              <strong>+ new asset</strong>
              <span>Import an article, PDF, EPUB, subtitle, or sync cloud continuity to fill this grid.</span>
            </div>
          ) : (
            assetTiles.map((tile, index) => (
              <button
                key={tile.id}
                type="button"
                className={`asset-tile asset-tile--${tile.tone}`}
                onClick={() => props.onNavigate(tile.route)}
                style={{ "--asset-hue": `${58 + index * 28}` } as React.CSSProperties}
              >
                <strong>{tile.title}</strong>
                <span>{tile.meta}</span>
              </button>
            ))
          )}
        </div>
        {certMode && (
          <div className="workspace-note workspace-cert-note">
            Certification demo seed: asset cards and detail rows are deterministic local fixtures only.
          </div>
        )}
      </section>

      <section className="grid cards-2 asset-detail-sections">
        <section className="card">
          <div className="section-heading">
            <div>
              <div className="card-title">Local import library</div>
              <div className="card-copy">Choose an imported workspace to view details and jump to the source surface.</div>
            </div>
          </div>

          {libraryState === "loading" ? (
            <div className="helper-copy">Loading local assets…</div>
          ) : importLibrary.length === 0 ? (
            <div className="helper-copy">No local import assets yet.</div>
          ) : (
            <div className="stack list">
              {importLibrary.map((entry) => (
                  <button
                  key={entry.id}
                  type="button"
                  className={`reader-nav-item${selectedAssetId === entry.id ? " is-active" : ""}`}
                  onClick={() => setSelectedAssetId(entry.id)}
                >
                  <strong>{entry.title}</strong>
                  <small>{entry.summary}</small>
                  <small>{formatRelativeDate(entry.importedAt)}</small>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="card subtle">
          <div className="card-title">Selected asset detail</div>
          {!selectedImport ? (
            <div className="helper-copy">Select an asset to inspect details.</div>
          ) : (
            <div className="stack list">
              <div className="preview-block"><strong>Type</strong>{"\n"}{selectedImport.source.toUpperCase()}</div>
              <div className="preview-block"><strong>Summary</strong>{"\n"}{selectedImport.summary}</div>
              <div className="preview-block"><strong>Detail</strong>{"\n"}{selectedImport.detail}</div>
              <div className="preview-block"><strong>Imported</strong>{"\n"}{formatRelativeDate(selectedImport.importedAt)}</div>
              <div className="preview-block"><strong>Scope</strong>{"\n"}{selectedImport.ownerMode === "account" ? `Account metadata/text · ${selectedImport.syncState}` : `Local-only · ${selectedImport.syncState}`}</div>
              <div className="preview-block"><strong>Extracted-text snapshot</strong>{"\n"}{selectedImport.snapshotStatus ?? "not materialized"}</div>
              {selectedImport.requiresReimportForBinaryView && (
                <div className="preview-block"><strong>Original file bytes</strong>{"\n"}Not synced. Re-import the source file on this browser for binary viewer access.</div>
              )}
              <div className="row gap wrap">
                <button type="button" className="button secondary" onClick={() => void openSelectedImport(selectedImport)}>
                  Open source workspace
                </button>
                {!certMode && (
                  <>
                    <button type="button" className="button ghost" onClick={() => void renameSelectedImport(selectedImport)}>
                      Rename
                    </button>
                    <button type="button" className="button ghost" onClick={() => void removeSelectedImport(selectedImport)}>
                      Remove
                    </button>
                  </>
                )}
              </div>
              {assetNotice && <div className="helper-copy">{assetNotice}</div>}
            </div>
          )}
        </section>
      </section>

      <section className="grid cards-2 asset-detail-sections">
        <section className="card subtle">
          <div className="card-title">Reading history asset details</div>
          {props.cloudState === "loading" && !props.cloudAssets ? (
            <div className="helper-copy">Loading cloud assets…</div>
          ) : readingHistoryEntries.length === 0 ? (
            <div className="helper-copy">No synced reading history records.</div>
          ) : (
            <div className="stack list">
              {readingHistoryEntries.slice(0, 8).map((entry) => (
                <div key={entry.id} className="preview-block">
                  <strong>{entry.title}</strong>
                  <div className="card-copy">{entry.hostname}</div>
                  <div className="helper-copy">
                    {formatNumber(entry.wordsTranslated)} words · {formatRelativeDate(new Date(entry.visitedAt).toISOString())}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card subtle">
          <div className="card-title">Study progress asset details</div>
          {props.cloudState === "loading" && !props.cloudAssets ? (
            <div className="helper-copy">Loading cloud assets…</div>
          ) : studyPages.length === 0 ? (
            <div className="helper-copy">No synced study progress pages.</div>
          ) : (
            <div className="stack list">
              {studyPages.slice(0, 8).map((page) => (
                <div key={page.url} className="preview-block">
                  <strong>{page.title}</strong>
                  <div className="card-copy">{page.hostname}</div>
                  <div className="helper-copy">
                    {page.completedSteps.map((step) => formatStudyStepLabel(step)).join(", ") || "No completed steps"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </section>

      <section className="grid cards-2 asset-detail-sections">
        <section className="card subtle">
          <div className="card-title">Vocabulary asset details</div>
          {vocabularyEntries.length === 0 ? (
            <div className="helper-copy">No synced vocabulary entries.</div>
          ) : (
            <div className="stack list">
              {vocabularyEntries.slice(0, 8).map((entry) => (
                <div key={entry.id} className="preview-block">
                  <strong>{entry.text}</strong>
                  <div className="card-copy">{entry.translation || entry.explanation || "No translation"}</div>
                  <div className="helper-copy">{entry.hostname ?? "no hostname"}</div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card subtle">
          <div className="card-title">Import queue status details</div>
          {props.importOpsState === "loading" && !props.importOps ? (
            <div className="helper-copy">Loading queue status…</div>
          ) : !props.importOps ? (
            <div className="helper-copy">Queue observability unavailable. Use account controls to retry.</div>
          ) : (
            <div className="stack list">
              <div className="preview-block">
                <strong>Backlog</strong>{"\n"}
                queued {formatNumber(props.importOps.articleImport.backlog.queued)} · failed {formatNumber(props.importOps.articleImport.backlog.failed)} · dead-lettered {formatNumber(props.importOps.articleImport.backlog.deadLettered)}
              </div>
              {(props.importOps.articleImport.recentFailures.length === 0 ? [null] : props.importOps.articleImport.recentFailures.slice(0, 6)).map((failure, index) => (
                <div key={failure?.jobId ?? `empty-${index}`} className="preview-block">
                  {failure ? (
                    <>
                      <strong>{failure.jobId}</strong>
                      <div className="card-copy">{failure.status} · {failure.route} · {failure.errorCode ?? "unknown error"}</div>
                      <div className="helper-copy">Attempts {formatNumber(failure.queueAttemptCount)} · replays {formatNumber(failure.replayCount)}</div>
                    </>
                  ) : (
                    <div className="helper-copy">No recent failed import jobs.</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </section>
    </div>
  )
}

function AccountPage(props: {
  apiBaseUrl: string
  config: AstraConfig
  device: AstraDeviceIdentity
  onSaveApiBaseUrl: (value: string) => void
  account: AstraAccount | null
  session: AstraSession | null
  usage: AstraUsageSnapshot | null
  devices: WebDeviceEntry[]
  authState: AuthState
  deviceActionBusyId: string | null
  cloudAssets: WebCloudAssetsWorkspace | null
  cloudState: "idle" | "loading" | "ready" | "error"
  cloudError: string
  importOps: WebImportQueueObservability | null
  importOpsState: "idle" | "loading" | "ready" | "error"
  importOpsError: string
  operatorToken: string
  onOperatorTokenChange: (value: string) => void
  storageHealth: WorkspaceStorageHealthSnapshot | null
  storageHealthState: "idle" | "loading" | "ready" | "error"
  storageHealthError: string
  recoveryState: "idle" | "running"
  lastWorkspaceRefreshAt: string | null
  onRefresh: () => Promise<void>
  onRefreshCloudAssets: () => Promise<void>
  onRefreshImportOps: () => Promise<void>
  onImportLocalLibraryMetadata: () => Promise<void>
  onReplayImportFailures: (dryRun: boolean) => Promise<void>
  onToggleCloudCollection: (collection: "reading_history" | "study_progress", enabled: boolean) => Promise<void>
  onRefreshStorageHealth: () => Promise<void>
  onRepairStorage: () => Promise<void>
  onResetStorage: () => Promise<void>
  onRevokeDevice: (deviceId: string) => Promise<void>
  onSignIn: (credentials: { email: string; password: string }) => Promise<void>
  onBilling: (kind: "checkout" | "portal", plan?: AstraPlan) => Promise<void>
}) {
  const [apiBaseUrl, setApiBaseUrl] = useState(props.apiBaseUrl)
  const [email, setEmail] = useState(() => readLastAccountEmail())
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [continuityExportJob, setContinuityExportJob] = useState<WebContinuityExportJob | null>(null)
  const [cloudDeleteJob, setCloudDeleteJob] = useState<WebCloudDataDeleteJob | null>(null)
  const [syncRepairResult, setSyncRepairResult] = useState<WebSyncRepairResult | null>(null)
  const [lifecycleNotice, setLifecycleNotice] = useState("")
  const [lifecycleError, setLifecycleError] = useState("")
  const [exportBusy, setExportBusy] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [downloadBusy, setDownloadBusy] = useState(false)
  const [repairBusy, setRepairBusy] = useState(false)
  const [deleteCollections, setDeleteCollections] = useState<AstraContinuityDeleteCollection[]>([...CONTINUITY_DELETE_COLLECTION_OPTIONS])

  useEffect(() => {
    setApiBaseUrl(props.apiBaseUrl)
  }, [props.apiBaseUrl])

  useEffect(() => {
    if (!props.session) {
      setEmail((current) => current || readLastAccountEmail())
      setContinuityExportJob(null)
      setCloudDeleteJob(null)
      setSyncRepairResult(null)
      setLifecycleNotice("")
      setLifecycleError("")
    }
  }, [props.session])

  useEffect(() => {
    if (!props.session || !continuityExportJob || !["queued", "running"].includes(continuityExportJob.status)) return
    const session = props.session
    const timeoutId = window.setTimeout(() => {
      void fetchWebContinuityExportJob({
        session,
        device: props.device,
        jobId: continuityExportJob.jobId,
      }).then((job) => {
        setContinuityExportJob(job)
      }).catch((reason) => {
        setLifecycleError(formatLifecycleActionError("export_refresh", reason))
      })
    }, 2500)
    return () => window.clearTimeout(timeoutId)
  }, [continuityExportJob, props.device, props.session])

  useEffect(() => {
    if (!props.session || !cloudDeleteJob || !["scheduled", "queued", "running"].includes(cloudDeleteJob.status)) return
    const session = props.session
    const timeoutId = window.setTimeout(() => {
      void fetchWebCloudDataDeleteJob({
        session,
        device: props.device,
        jobId: cloudDeleteJob.jobId,
      }).then((job) => {
        setCloudDeleteJob(job)
      }).catch((reason) => {
        setLifecycleError(formatLifecycleActionError("delete_refresh", reason))
      })
    }, 3000)
    return () => window.clearTimeout(timeoutId)
  }, [cloudDeleteJob, props.device, props.session])

  const submit = useCallback(async (event: React.FormEvent) => {
    event.preventDefault()
    setError("")

    const normalizedEmail = email.trim()
    if (!normalizedEmail || !password.trim()) {
      setError("Email and password are required.")
      return
    }

    try {
      props.onSaveApiBaseUrl(normalizeApiBaseUrl(apiBaseUrl))
      saveLastAccountEmail(normalizedEmail)
      await props.onSignIn({ email: normalizedEmail, password })
      setPassword("")
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Sign-in failed.")
    }
  }, [apiBaseUrl, email, password, props])

  const resetApiBaseUrl = useCallback(() => {
    const normalized = normalizeApiBaseUrl("")
    setApiBaseUrl(normalized)
    props.onSaveApiBaseUrl(normalized)
  }, [props])

  const refreshContinuityExport = useCallback(async () => {
    if (!props.session || !continuityExportJob) return
    const next = await fetchWebContinuityExportJob({
      session: props.session,
      device: props.device,
      jobId: continuityExportJob.jobId,
    })
    setContinuityExportJob(next)
  }, [continuityExportJob, props.device, props.session])

  const refreshCloudDelete = useCallback(async () => {
    if (!props.session || !cloudDeleteJob) return
    const next = await fetchWebCloudDataDeleteJob({
      session: props.session,
      device: props.device,
      jobId: cloudDeleteJob.jobId,
    })
    setCloudDeleteJob(next)
  }, [cloudDeleteJob, props.device, props.session])

  const handleCreateContinuityExport = useCallback(async () => {
    if (!props.session) return
    setLifecycleError("")
    setLifecycleNotice("")
    setExportBusy(true)
    try {
      const job = await createWebContinuityExport({
        session: props.session,
        device: props.device,
        collections: CONTINUITY_EXPORT_COLLECTION_OPTIONS,
        idempotencyKey: `web-export-${props.device.deviceId}-${Date.now()}`,
      })
      setContinuityExportJob(job)
      setLifecycleNotice("Continuity export queued. The control-plane will poll until the bundle is ready.")
    } catch (reason) {
      setLifecycleError(formatLifecycleActionError("export_create", reason))
    } finally {
      setExportBusy(false)
    }
  }, [props.device, props.session])

  const handleDownloadContinuityExport = useCallback(async () => {
    if (!props.session || !continuityExportJob) return
    setLifecycleError("")
    setDownloadBusy(true)
    try {
      const blob = await downloadWebContinuityExport({
        session: props.session,
        device: props.device,
        jobId: continuityExportJob.jobId,
      })
      downloadBlobFile(`astra-continuity-export-${continuityExportJob.jobId}.json`, blob)
      setLifecycleNotice("Downloaded the continuity export bundle.")
    } catch (reason) {
      setLifecycleError(formatLifecycleActionError("export_download", reason))
    } finally {
      setDownloadBusy(false)
    }
  }, [continuityExportJob, props.device, props.session])

  const toggleDeleteCollection = useCallback((collection: AstraContinuityDeleteCollection) => {
    setDeleteCollections((current) => current.includes(collection)
      ? current.filter((value) => value !== collection)
      : [...current, collection])
  }, [])

  const handleCreateCloudDelete = useCallback(async () => {
    if (!props.session) return
    if (deleteCollections.length === 0) {
      setLifecycleError("Select at least one cloud collection to delete.")
      return
    }
    const confirmed = typeof window !== "undefined" && typeof window.confirm === "function"
      ? window.confirm("Schedule cloud deletion for the selected collections after the grace period?")
      : true
    if (!confirmed) return
    setLifecycleError("")
    setLifecycleNotice("")
    setDeleteBusy(true)
    try {
      const job = await createWebCloudDataDelete({
        session: props.session,
        device: props.device,
        collections: deleteCollections,
        idempotencyKey: `web-cloud-delete-${props.device.deviceId}-${Date.now()}`,
      })
      setCloudDeleteJob(job)
      setLifecycleNotice("Cloud delete scheduled. The Worker will enqueue deletion when the grace period expires.")
    } catch (reason) {
      setLifecycleError(formatLifecycleActionError("delete_create", reason))
    } finally {
      setDeleteBusy(false)
    }
  }, [deleteCollections, props.device, props.session])

  const handleRunSyncRepair = useCallback(async () => {
    if (!props.session) return
    setLifecycleError("")
    setLifecycleNotice("")
    setRepairBusy(true)
    try {
      const repair = await repairWebCloudSync({
        session: props.session,
        device: props.device,
      })
      setSyncRepairResult(repair)
      await props.onRefreshCloudAssets()
      const repairedCollections = Object.values(repair.collections)
      const repairedRecordCount = repairedCollections.reduce((sum, collection) => sum + collection.records.length, 0)
      setLifecycleNotice(`Cloud sync repair refreshed ${formatNumber(repairedRecordCount)} materialized records across ${formatNumber(repairedCollections.length)} collections.`)
    } catch (reason) {
      setLifecycleError(formatLifecycleActionError("repair", reason))
    } finally {
      setRepairBusy(false)
    }
  }, [props])

  const currentDevice = props.devices.find((device) => device.isCurrentDevice) ?? null
  const activeDeviceCount = props.devices.filter((device) => device.status === "active").length
  const localOnlySummary = summarizeConfigContinuity(props.config)
  const enabledCollections = props.cloudAssets?.syncHealth.collections.filter((collection) => collection.enabled).length ?? 0
  const readingHistoryWords = props.cloudAssets?.readingHistory.entries.reduce((sum, entry) => sum + entry.wordsTranslated, 0) ?? 0
  const repairCollectionCount = syncRepairResult ? Object.values(syncRepairResult.collections).length : 0
  const repairRecordCount = syncRepairResult
    ? Object.values(syncRepairResult.collections).reduce((sum, collection) => sum + collection.records.length, 0)
    : 0
  const repairFloorCount = syncRepairResult
    ? Object.values(syncRepairResult.collections).filter((collection) => collection.compactionFloorCursor).length
    : 0

  return (
    <>
      <section className="card">
        <div className="section-heading">
          <div>
            <div className="card-title">Astra API session surface</div>
            <div className="card-copy">The web companion keeps its own device/session snapshot and refreshes it on boot and resume.</div>
          </div>
          <span className="status-pill">{props.session ? "authenticated" : "signed out"}</span>
        </div>

        <label className="field">
          <span>Astra API base URL</span>
          <div className="field-inline">
            <input
              value={apiBaseUrl}
              onChange={(event) => setApiBaseUrl(event.target.value)}
              onBlur={() => props.onSaveApiBaseUrl(apiBaseUrl)}
              placeholder="http://127.0.0.1:8787/v1"
            />
            <button type="button" className="button ghost" onClick={resetApiBaseUrl}>
              Reset
            </button>
          </div>
        </label>

        {!props.session ? (
          <form className="auth-form" onSubmit={(event) => { void submit(event) }}>
            <label className="field">
              <span>Email</span>
              <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="user@example.com" />
            </label>

            <label className="field">
              <span>Password</span>
              <div className="field-inline">
                <input value={password} onChange={(event) => setPassword(event.target.value)} type={showPassword ? "text" : "password"} placeholder="••••••••" />
                <button type="button" className="button ghost" onClick={() => setShowPassword((current) => !current)}>
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </label>

            {error && <div className="error-note">{error}</div>}

            <div className="row gap wrap">
              <button type="submit" className="button primary" disabled={props.authState !== "idle"}>
                {props.authState === "signing-in" ? "Signing in…" : "Sign in"}
              </button>
              <span className="helper-copy">Uses `POST /v1/auth/session` and persists a local session snapshot.</span>
            </div>
          </form>
        ) : (
          <div className="grid cards-3 compact">
            <MetricCard label="Email" value={props.account?.email ?? props.session.email} hint="current Astra account" />
            <MetricCard
              label="Plan"
              value={formatAstraPlanLabel(props.account?.plan ?? props.session.plan)}
              hint={formatAstraSubscriptionStatusLabel(props.account?.subscriptionStatus ?? props.session.subscriptionStatus)}
            />
            <MetricCard label="Relay" value={props.session.relayBaseURL} hint={`Last refresh ${formatRelativeDate(props.lastWorkspaceRefreshAt)}`} />
          </div>
        )}
      </section>

      {props.session && (
        <>
          <section className="grid cards-2">
            <div className="card">
              <div className="section-heading">
                <div>
                  <div className="card-title">Quota and recent usage</div>
                  <div className="card-copy">Server-backed account summary for the current signed-in device.</div>
                </div>
                <button type="button" className="button ghost" onClick={() => void props.onRefresh()} disabled={props.authState !== "idle"}>
                  Refresh now
                </button>
              </div>
              <div className="helper-copy" style={{ marginBottom: "1rem" }}>
                Plan, status, and quota prefer <code>/v1/account/summary</code>. Legacy <code>/v1/account</code> and <code>/v1/account/usage</code> reads only backfill rollout fallback.
              </div>
              <div className="metrics-grid">
                <MetricCard
                  label="Remaining daily requests"
                  value={formatNumber(props.usage?.quota.remainingDailyRequests)}
                  hint={`${formatNumber(props.usage?.quota.dailyRequestsLimit)} daily limit`}
                />
                <MetricCard
                  label="Remaining daily characters"
                  value={formatNumber(props.usage?.quota.remainingDailyCharacters)}
                  hint={`${formatNumber(props.usage?.quota.dailyCharactersLimit)} daily limit`}
                />
                <MetricCard
                  label="Requests today"
                  value={formatNumber(props.usage?.usage.dailyRequestsUsed)}
                  hint={`Generated ${formatRelativeDate(props.usage?.generatedAt)}`}
                />
                <MetricCard
                  label="Characters today"
                  value={formatNumber(props.usage?.usage.dailyCharactersUsed)}
                  hint={`Last request ${formatRelativeDate(props.usage?.usage.lastRequestAt)}`}
                />
              </div>
            </div>

            <div className="card">
              <div className="card-title">Billing handoff</div>
              <div className="card-copy">
                Billing stays server-owned. The web shell opens checkout and portal flows without pulling any extension APIs into the path.
              </div>
              <div className="row gap wrap">
                <button type="button" className="button primary" onClick={() => void props.onBilling("checkout", "pro")}>
                  Upgrade to Pro
                </button>
                <button type="button" className="button secondary" onClick={() => void props.onBilling("portal")}>
                  Open billing portal
                </button>
              </div>
              <div className="helper-copy">Session expires: {formatRelativeDate(props.session.expiresAt)}</div>
            </div>
          </section>

          <section className="card">
            <div className="section-heading">
              <div>
                <div className="card-title">Queue-driven import status</div>
                <div className="card-copy">Cloudflare queue backlog, failure buckets, and replay controls for article import operations.</div>
              </div>
              <div className="row gap wrap">
                <button type="button" className="button ghost" onClick={() => void props.onRefreshImportOps()} disabled={props.importOpsState === "loading"}>
                  {props.importOpsState === "loading" ? "Refreshing…" : "Refresh queue status"}
                </button>
              </div>
            </div>

            <label className="field">
              <span>Operator token (optional)</span>
              <input
                type="password"
                value={props.operatorToken}
                onChange={(event) => props.onOperatorTokenChange(event.target.value)}
                placeholder="x-astra-operator-token"
              />
            </label>

            {!props.importOps ? (
              <div className="helper-copy">Queue observability is unavailable. Provide an operator token if this environment requires operator authorization.</div>
            ) : (
              <>
                <div className="metrics-grid">
                  <MetricCard label="Queued" value={formatNumber(props.importOps.articleImport.backlog.queued)} hint="pending jobs" />
                  <MetricCard label="Failed" value={formatNumber(props.importOps.articleImport.backlog.failed)} hint="latest failure bucket" />
                  <MetricCard label="Dead-lettered" value={formatNumber(props.importOps.articleImport.backlog.deadLettered)} hint="replay candidates" />
                  <MetricCard label="Oldest queued age" value={formatDurationMs(props.importOps.articleImport.backlog.oldestQueuedAgeMs)} hint={props.importOps.environment} />
                </div>

                <div className="row gap wrap" style={{ marginTop: "1rem" }}>
                  <button type="button" className="button secondary" onClick={() => void props.onReplayImportFailures(true)} disabled={!props.operatorToken.trim()}>
                    Dry-run replay dead-lettered
                  </button>
                  <button type="button" className="button primary" onClick={() => void props.onReplayImportFailures(false)} disabled={!props.operatorToken.trim()}>
                    Replay dead-lettered
                  </button>
                </div>

                {props.importOps.articleImport.recentFailures.length > 0 && (
                  <div className="table-wrap" style={{ marginTop: "1rem" }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Job</th>
                          <th>Status</th>
                          <th>Route</th>
                          <th>Error</th>
                          <th>Attempts</th>
                          <th>Replays</th>
                        </tr>
                      </thead>
                      <tbody>
                        {props.importOps.articleImport.recentFailures.slice(0, 8).map((failure) => (
                          <tr key={failure.jobId}>
                            <td>{failure.jobId}</td>
                            <td>{failure.status}</td>
                            <td>{failure.route}</td>
                            <td>{failure.errorCode ?? failure.lastFailureErrorCode ?? "—"}</td>
                            <td>{formatNumber(failure.queueAttemptCount)}</td>
                            <td>{formatNumber(failure.replayCount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {props.importOpsError && <div className="error-note">{props.importOpsError}</div>}
          </section>

          <section className="card">
            <div className="section-heading">
              <div>
                <div className="card-title">IndexedDB lifecycle and corruption recovery</div>
                <div className="card-copy">Audit local storage integrity, repair corrupted workspace snapshots, and reset lifecycle state when needed.</div>
              </div>
              <button type="button" className="button ghost" onClick={() => void props.onRefreshStorageHealth()} disabled={props.storageHealthState === "loading" || props.recoveryState === "running"}>
                {props.storageHealthState === "loading" ? "Auditing…" : "Run integrity audit"}
              </button>
            </div>

            {props.storageHealth ? (
              <>
                <div className="metrics-grid">
                  <MetricCard label="IndexedDB" value={props.storageHealth.indexedDbReachable ? "reachable" : "unavailable"} hint={props.storageHealth.dbName} />
                  <MetricCard label="Records" value={formatNumber(props.storageHealth.indexedDbRecordCount)} hint="compat workspace snapshots" />
                  <MetricCard label="Library items" value={formatNumber(props.storageHealth.libraryItemCount)} hint={`${formatNumber(props.storageHealth.librarySnapshotCount)} snapshots`} />
                  <MetricCard label="Migration journal" value={formatNumber(props.storageHealth.migrationJournalCount)} hint={`${formatNumber(props.storageHealth.legacyMappingCount)} legacy id mappings`} />
                  <MetricCard label="Legacy keys" value={formatNumber(props.storageHealth.legacyStorageKeysPresent.length)} hint="localStorage fallback entries" />
                  <MetricCard label="Corrupted keys" value={formatNumber(props.storageHealth.corruptedKeys.length)} hint="repair recommended when > 0" />
                </div>

                <div className="row gap wrap" style={{ marginTop: "1rem" }}>
                  <button type="button" className="button secondary" onClick={() => void props.onRepairStorage()} disabled={props.recoveryState === "running"}>
                    {props.recoveryState === "running" ? "Repairing…" : "Repair corruption"}
                  </button>
                  <button type="button" className="button danger" onClick={() => void props.onResetStorage()} disabled={props.recoveryState === "running"}>
                    {props.recoveryState === "running" ? "Resetting…" : "Reset local lifecycle data"}
                  </button>
                </div>

                <div className="table-wrap" style={{ marginTop: "1rem" }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Workspace</th>
                        <th>IndexedDB</th>
                        <th>Legacy</th>
                        <th>Library</th>
                        <th>Updated</th>
                        <th>Issues</th>
                      </tr>
                    </thead>
                    <tbody>
                      {props.storageHealth.records.map((record) => (
                        <tr key={record.key}>
                          <td>{record.label}</td>
                          <td>{record.indexedDbState}</td>
                          <td>{record.legacyState}</td>
                          <td>{record.libraryState}</td>
                          <td>{record.indexedDbUpdatedAt ? formatRelativeDate(new Date(record.indexedDbUpdatedAt).toISOString()) : "—"}</td>
                          <td>{record.issues[0] ?? "none"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="helper-copy">Run an integrity audit to inspect IndexedDB and fallback localStorage workspace health.</div>
            )}

            {props.storageHealthError && <div className="error-note">{props.storageHealthError}</div>}
          </section>

          <section className="card">
            <div className="section-heading">
              <div>
                <div className="card-title">Synced cloud assets</div>
                <div className="card-copy">Latest fetched continuity snapshot for cloud-safe config, vocabulary, review schedules, optional reading history, and per-page study progress.</div>
              </div>
              <div className="row gap wrap">
                <span className={`status-pill${props.cloudState === "ready" ? " success" : ""}`}>
                  {props.cloudState === "loading" ? "loading" : props.cloudState === "ready" ? "synced snapshot" : props.cloudState}
                </span>
                <button type="button" className="button ghost" onClick={() => void props.onRefreshCloudAssets()} disabled={props.cloudState === "loading"}>
                  {props.cloudState === "loading" ? "Refreshing…" : "Refresh cloud snapshot"}
                </button>
              </div>
            </div>

            {props.cloudAssets ? (
              <>
                <div className="metrics-grid">
                  <MetricCard label="Server time" value={formatRelativeDate(props.cloudAssets.serverTime)} hint="bootstrap + pull snapshot" />
                  <MetricCard label="Last fetch" value={formatRelativeDate(props.cloudAssets.fetchedAt)} hint="web console fetch time" />
                  <MetricCard label="Enabled collections" value={formatNumber(enabledCollections)} hint={`${formatNumber(props.cloudAssets.syncHealth.activeDeviceCount)} active devices`} />
                  <MetricCard label="Current device sync" value={formatRelativeDate(props.cloudAssets.syncHealth.currentDeviceLastSyncAt)} hint="latest device sync in continuity snapshot" />
                  <MetricCard label="Mutation budget" value={formatNumber(props.cloudAssets.syncHealth.maxMutationsPerRequest)} hint="max mutations per request" />
                  <MetricCard label="Cloud library" value={formatNumber(props.cloudAssets.library.count)} hint={`${formatNumber(props.cloudAssets.library.snapshotCount)} metadata/text snapshots`} />
                </div>

                <div className="row gap wrap" style={{ marginTop: "1rem" }}>
                  <button type="button" className="button secondary" onClick={() => void props.onImportLocalLibraryMetadata()} disabled={props.cloudState === "loading"}>
                    Import local library snapshots to account
                  </button>
                </div>
                <div className="helper-copy" style={{ marginTop: "1rem" }}>
                  This is the latest fetched snapshot, not a continuously authoritative cross-device view. Library import uploads metadata and extracted-text snapshots only. Original file bytes are never uploaded in this milestone; binary viewer access requires re-import on each browser.
                </div>
                <div className="helper-copy">
                  Reading history is optional behavioral sync. Study progress reflects synced page milestones only; device-local daily totals stay local.
                </div>
              </>
            ) : (
              <div className="helper-copy" style={{ marginTop: "1rem" }}>
                Cloud snapshot unavailable right now. Refresh the cloud snapshot to retry.
              </div>
            )}
            {props.cloudAssets && props.cloudAssets.deferredCollections.length > 0 && (
              <div className="helper-copy">
                Deferred collections: {props.cloudAssets.deferredCollections.join(", ").replace(/_/g, " ")}
              </div>
            )}

            {props.cloudError && <div className="error-note">{props.cloudError}</div>}
            {props.cloudState === "loading" && !props.cloudAssets && <div className="helper-copy">Loading cloud snapshot…</div>}

            {props.cloudAssets && (
              <>
                <div className="grid cards-2" style={{ marginTop: "1rem" }}>
                  <div className="card subtle">
                    <div className="section-heading">
                      <div>
                        <div className="card-title">Synced config</div>
                        <div className="card-copy">Effective cloud-safe config after applying remote sync records.</div>
                      </div>
                      <span className="status-pill">
                        {props.cloudAssets.config.enabled ? "enabled" : "disabled by server default"}
                      </span>
                    </div>

                    <div className="grid cards-3 compact">
                      <MetricCard label="Target language" value={props.cloudAssets.config.syncedConfig.targetLang} hint="remote effective value" />
                      <MetricCard label="Provider" value={props.cloudAssets.config.syncedConfig.provider.id} hint={props.cloudAssets.config.syncedConfig.provider.model} />
                      <MetricCard label="Site rules" value={formatNumber(Object.keys(props.cloudAssets.config.syncedConfig.sites).length)} hint={`${formatNumber(props.cloudAssets.config.syncedConfig.customActions.length)} custom actions`} />
                    </div>

                    <div className="helper-copy" style={{ marginTop: "1rem" }}>
                      Local-only fields not in cloud sync: {localOnlySummary.localOnlyFields.length > 0 ? localOnlySummary.localOnlyFields.join(", ") : "none"}
                    </div>
                  </div>

                  <div className="card subtle">
                    <div className="section-heading">
                      <div>
                        <div className="card-title">Synced vocabulary</div>
                        <div className="card-copy">Explicitly saved vocabulary entries reconstructed from vocabulary deltas.</div>
                      </div>
                      <span className="status-pill">
                        {props.cloudAssets.vocabulary.enabled ? "enabled" : "disabled by server default"}
                      </span>
                    </div>

                    {props.cloudAssets.vocabulary.entries.length === 0 ? (
                      <div className="helper-copy">No synced vocabulary entries yet.</div>
                    ) : (
                      <div className="stack list">
                        {props.cloudAssets.vocabulary.entries.slice(0, 6).map((entry) => (
                          <div key={entry.id} className="preview-block">
                            <strong>{entry.text}</strong>
                            <div className="card-copy">{entry.translation || entry.explanation || "No translation saved"}</div>
                            <div className="helper-copy">
                              {entry.hostname ?? "no hostname"} · {new Intl.DateTimeFormat(undefined, {
                                dateStyle: "medium",
                                timeStyle: "short",
                              }).format(new Date(entry.savedAt))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="card subtle">
                    <div className="section-heading">
                      <div>
                        <div className="card-title">Reading history</div>
                        <div className="card-copy">Optional behavioral sync for sanitized page URLs and recent visits.</div>
                      </div>
                      <div className="row gap wrap">
                        <span className="status-pill">
                          {props.cloudAssets.readingHistory.enabled ? "enabled" : "sync off"}
                        </span>
                        <button
                          type="button"
                          className="button ghost compact-button"
                          onClick={() => void props.onToggleCloudCollection("reading_history", !props.cloudAssets?.readingHistory.enabled)}
                          disabled={props.cloudState === "loading"}
                        >
                          {props.cloudAssets.readingHistory.enabled ? "Disable sync" : "Enable sync"}
                        </button>
                      </div>
                    </div>

                    <div className="grid cards-3 compact">
                      <MetricCard label="Entries" value={formatNumber(props.cloudAssets.readingHistory.count)} hint={props.cloudAssets.readingHistory.cursor ? `Cursor ${props.cloudAssets.readingHistory.cursor}` : "No reading history cursor yet"} />
                      <MetricCard label="Words translated" value={formatNumber(readingHistoryWords)} hint="summed from synced entries in this snapshot" />
                      <MetricCard label="Last visit" value={props.cloudAssets.readingHistory.entries[0] ? formatRelativeDate(new Date(props.cloudAssets.readingHistory.entries[0].visitedAt).toISOString()) : "—"} hint="newest synced reading event" />
                    </div>

                    <div className="helper-copy" style={{ marginTop: "1rem" }}>
                      Optional behavioral sync. This view only reflects synced reading events when the collection is enabled.
                    </div>

                    {!props.cloudAssets.readingHistory.enabled ? (
                      <div className="helper-copy">Reading history sync is off, so this cloud view may be empty even if this device has local reading activity.</div>
                    ) : props.cloudAssets.readingHistory.entries.length === 0 ? (
                      <div className="helper-copy">No synced reading history entries yet.</div>
                    ) : (
                      <div className="stack list">
                        {props.cloudAssets.readingHistory.entries.slice(0, 4).map((entry) => (
                          <div key={entry.id} className="preview-block">
                            <strong>{entry.title}</strong>
                            <div className="card-copy">{entry.hostname} · {formatNumber(entry.wordsTranslated)} translated words</div>
                            <div className="helper-copy">{formatRelativeDate(new Date(entry.visitedAt).toISOString())}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="card subtle">
                    <div className="section-heading">
                      <div>
                        <div className="card-title">Study progress</div>
                        <div className="card-copy">Durable per-page learning milestones reconstructed from synced study-progress records.</div>
                      </div>
                      <div className="row gap wrap">
                        <span className="status-pill">
                          {props.cloudAssets.studyProgress.enabled ? "enabled" : "sync off"}
                        </span>
                        <button
                          type="button"
                          className="button ghost compact-button"
                          onClick={() => void props.onToggleCloudCollection("study_progress", !props.cloudAssets?.studyProgress.enabled)}
                          disabled={props.cloudState === "loading"}
                        >
                          {props.cloudAssets.studyProgress.enabled ? "Disable sync" : "Enable sync"}
                        </button>
                      </div>
                    </div>

                    <div className="grid cards-3 compact">
                      <MetricCard label="Pages" value={formatNumber(props.cloudAssets.studyProgress.pageCount)} hint={props.cloudAssets.studyProgress.cursor ? `Cursor ${props.cloudAssets.studyProgress.cursor}` : "No study-progress cursor yet"} />
                      <MetricCard label="Explain pages" value={formatNumber(props.cloudAssets.studyProgress.stepCoverage.explain)} hint="pages with sentence explanation activity" />
                      <MetricCard label="Vocab-save pages" value={formatNumber(props.cloudAssets.studyProgress.stepCoverage.vocab_save)} hint="pages with saved vocabulary activity" />
                    </div>

                    <div className="helper-copy" style={{ marginTop: "1rem" }}>
                      Per-page sync only. Device-local daily studied/explained/reviewed totals remain local and are not shown here.
                    </div>

                    {!props.cloudAssets.studyProgress.enabled ? (
                      <div className="helper-copy">Study progress sync is off, so only this device’s local progress exists until the collection is enabled.</div>
                    ) : props.cloudAssets.studyProgress.pages.length === 0 ? (
                      <div className="helper-copy">No synced study-progress pages yet.</div>
                    ) : (
                      <div className="stack list">
                        {props.cloudAssets.studyProgress.pages.slice(0, 4).map((page) => (
                          <div key={page.url} className="preview-block">
                            <strong>{page.title}</strong>
                            <div className="card-copy">{page.hostname} · {page.completedSteps.map((step) => formatStudyStepLabel(step)).join(", ") || "No completed steps"}</div>
                            <div className="helper-copy">Last activity {formatRelativeDate(new Date(page.lastActivityAt).toISOString())}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="card subtle" style={{ marginTop: "1rem" }}>
                  <div className="section-heading">
                    <div>
                      <div className="card-title">Sync health</div>
                      <div className="card-copy">Latest fetched collection status from bootstrap + pull, not live background reconciliation.</div>
                    </div>
                  </div>

                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Collection</th>
                          <th>State</th>
                          <th>Cursor</th>
                          <th>Mutations</th>
                          <th>Active</th>
                        </tr>
                      </thead>
                      <tbody>
                        {props.cloudAssets.syncHealth.collections.map((collection) => (
                          <tr key={collection.key}>
                            <td>{collection.key.replace(/_/g, " ")}</td>
                            <td>{collection.enabled ? "enabled" : "off"}</td>
                            <td>{collection.cursor ?? "—"}</td>
                            <td>{formatNumber(collection.mutationCount)}</td>
                            <td>{formatNumber(collection.activeCount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </section>

          <section className="card">
            <div className="section-heading">
              <div>
                <div className="card-title">Cloud export / delete lifecycle</div>
                <div className="card-copy">Queue-backed continuity controls for exporting cloud data and scheduling collection-scoped deletes with a grace window.</div>
              </div>
            </div>

            <div className="grid cards-3">
              <div className="card subtle">
                <div className="section-heading">
                  <div>
                    <div className="card-title">Continuity export</div>
                    <div className="card-copy">Exports the current cloud continuity snapshot for config, vocabulary, review schedules, reading history, and study progress.</div>
                  </div>
                  <div className="row gap wrap">
                    <button type="button" className="button secondary" onClick={() => void refreshContinuityExport()} disabled={!continuityExportJob || exportBusy || downloadBusy}>
                      Refresh status
                    </button>
                    <button type="button" className="button primary" onClick={() => void handleCreateContinuityExport()} disabled={exportBusy || downloadBusy}>
                      {exportBusy ? "Queuing…" : "Create export"}
                    </button>
                  </div>
                </div>

                <div className="helper-copy">Retention: export bundles expire after {formatNumber(continuityExportJob?.policy.exportArtifactRetentionDays ?? 7)} days.</div>
                <div className="helper-copy">Included collections: {CONTINUITY_EXPORT_COLLECTION_OPTIONS.join(", ").replace(/_/g, " ")}.</div>

                {continuityExportJob ? (
                  <>
                    <div className="grid cards-3 compact" style={{ marginTop: "1rem" }}>
                      <MetricCard label="Status" value={continuityExportJob.status} hint={`Requested ${formatRelativeDate(continuityExportJob.requestedAt)}`} />
                      <MetricCard label="Expires" value={formatRelativeDate(continuityExportJob.expiresAt)} hint={continuityExportJob.artifact.bytes != null ? `${formatNumber(continuityExportJob.artifact.bytes)} bytes` : "artifact pending"} />
                      <MetricCard label="Collections" value={formatNumber(continuityExportJob.scope.collections.length)} hint={continuityExportJob.scope.collections.join(", ").replace(/_/g, " ")} />
                    </div>

                    <div className="helper-copy" style={{ marginTop: "1rem" }}>
                      {describeContinuityExportJob(continuityExportJob)}
                    </div>
                    {continuityExportJob.error && (
                      <div className="error-note" style={{ marginTop: "0.75rem" }}>
                        {continuityExportJob.error.code}: {continuityExportJob.error.message}
                      </div>
                    )}

                    <div className="row gap wrap" style={{ marginTop: "1rem" }}>
                      <button
                        type="button"
                        className="button primary"
                        onClick={() => void handleDownloadContinuityExport()}
                        disabled={downloadBusy || continuityExportJob.status !== "completed"}
                      >
                        {downloadBusy ? "Downloading…" : "Download export"}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="helper-copy" style={{ marginTop: "1rem" }}>No continuity export job yet.</div>
                )}
              </div>

              <div className="card subtle">
                <div className="section-heading">
                  <div>
                    <div className="card-title">Cloud collection delete</div>
                    <div className="card-copy">Schedules delete-mutation fanout for selected cloud collections; propagation follows normal sync pull semantics.</div>
                  </div>
                  <div className="row gap wrap">
                    <button type="button" className="button secondary" onClick={() => void refreshCloudDelete()} disabled={!cloudDeleteJob || deleteBusy}>
                      Refresh status
                    </button>
                    <button type="button" className="button danger" onClick={() => void handleCreateCloudDelete()} disabled={deleteBusy}>
                      {deleteBusy ? "Scheduling…" : "Schedule delete"}
                    </button>
                  </div>
                </div>

                <div className="helper-copy">Grace window: {formatDurationMs((cloudDeleteJob?.policy.deleteGracePeriodSeconds ?? 604800) * 1000)} before queued deletion begins.</div>
                <div className="helper-copy">Tombstones remain retained for at least {formatNumber(cloudDeleteJob?.policy.tombstoneRetentionDays ?? 30)} days.</div>

                <div className="stack list" style={{ marginTop: "1rem" }}>
                  {CONTINUITY_DELETE_COLLECTION_OPTIONS.map((collection) => (
                    <label key={collection} className="field-inline" style={{ justifyContent: "flex-start" }}>
                      <input
                        type="checkbox"
                        checked={deleteCollections.includes(collection)}
                        onChange={() => toggleDeleteCollection(collection)}
                        disabled={deleteBusy}
                      />
                      <span>{collection.replace(/_/g, " ")}</span>
                    </label>
                  ))}
                </div>

                {cloudDeleteJob ? (
                  <>
                    <div className="grid cards-3 compact" style={{ marginTop: "1rem" }}>
                      <MetricCard label="Status" value={cloudDeleteJob.status} hint={`Requested ${formatRelativeDate(cloudDeleteJob.requestedAt)}`} />
                      <MetricCard label="Scheduled" value={formatRelativeDate(cloudDeleteJob.scheduledForAt)} hint={`${formatNumber(cloudDeleteJob.scope.collections.length)} collections`} />
                      <MetricCard label="Deleted records" value={formatNumber(Object.values(cloudDeleteJob.deletedRecords).reduce((sum, count) => sum + count, 0))} hint="delete mutations appended" />
                    </div>
                    <div className="helper-copy" style={{ marginTop: "1rem" }}>
                      {describeCloudDeleteJob(cloudDeleteJob)}
                    </div>
                    {cloudDeleteJob.error && (
                      <div className="error-note" style={{ marginTop: "0.75rem" }}>
                        {cloudDeleteJob.error.code}: {cloudDeleteJob.error.message}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="helper-copy" style={{ marginTop: "1rem" }}>No cloud delete job scheduled yet.</div>
                )}
              </div>

              <div className="card subtle">
                <div className="section-heading">
                  <div>
                    <div className="card-title">Manual sync repair</div>
                    <div className="card-copy">Rebuild the current materialized continuity snapshot when cloud state drifts or a compaction floor forces recovery.</div>
                  </div>
                  <div className="row gap wrap">
                    <button type="button" className="button secondary" onClick={() => void props.onRefreshCloudAssets()} disabled={props.cloudState === "loading" || repairBusy}>
                      Refresh snapshot
                    </button>
                    <button type="button" className="button primary" onClick={() => void handleRunSyncRepair()} disabled={repairBusy}>
                      {repairBusy ? "Repairing…" : "Run sync repair"}
                    </button>
                  </div>
                </div>

                <div className="helper-copy">Bridge-first/Web-PWA-first recovery surface for portable cloud data only. Local IndexedDB repair stays separate above.</div>
                <div className="helper-copy">Use this after `CURSOR_EXPIRED` or whenever a mobile web session needs to reconcile its cloud continuity snapshot.</div>
                <div className="helper-copy">If repair fails, refresh the cloud snapshot first. Persistent auth/cursor failures need operator follow-up rather than repeated blind retries.</div>

                {syncRepairResult ? (
                  <div className="grid cards-3 compact" style={{ marginTop: "1rem" }}>
                    <MetricCard label="Server time" value={formatRelativeDate(syncRepairResult.serverTime)} hint="latest repair snapshot" />
                    <MetricCard label="Collections" value={formatNumber(repairCollectionCount)} hint={`${formatNumber(repairFloorCount)} compaction floors observed`} />
                    <MetricCard label="Records" value={formatNumber(repairRecordCount)} hint="materialized records returned" />
                  </div>
                ) : (
                  <div className="helper-copy" style={{ marginTop: "1rem" }}>No manual repair run yet.</div>
                )}
              </div>
            </div>

            <div className="card subtle" style={{ marginTop: "1rem" }}>
              <div className="card-title">Operator guidance</div>
              <div className="helper-copy" style={{ marginTop: "0.75rem" }}>
                Export: refresh once before declaring a job missing; failed or expired exports require a fresh export job.
              </div>
              <div className="helper-copy">
                Cloud delete: `scheduled` is not deletion yet. Only `completed` plus later client sync proves removal.
              </div>
              <div className="helper-copy">
                Sync repair: use after auth/cursor recovery or `CURSOR_EXPIRED`; repeated failures should be escalated with the request id and route.
              </div>
              <div className="helper-copy">
                Device revoke: refresh the device list once before retrying. Current-device sign-out stays separate from remote revoke.
              </div>
            </div>

            {lifecycleNotice && <div className="helper-copy" style={{ marginTop: "1rem" }}>{lifecycleNotice}</div>}
            {lifecycleError && <div className="error-note" style={{ marginTop: "1rem" }}>{lifecycleError}</div>}
          </section>

          <section className="card">
            <div className="section-heading">
              <div>
                <div className="card-title">Device management</div>
                <div className="card-copy">Review active devices, confirm which one is current, refresh the list, and revoke other devices safely.</div>
              </div>
              <div className="row gap wrap">
                <span className="status-pill">{formatNumber(props.devices.length)} devices</span>
                <button type="button" className="button ghost" onClick={() => void props.onRefresh()} disabled={props.authState !== "idle" || props.deviceActionBusyId !== null}>
                  Refresh list
                </button>
              </div>
            </div>

            <div className="grid cards-3 compact">
              <MetricCard label="Current device" value={currentDevice?.label ?? "—"} hint={currentDevice ? formatDeviceHost(currentDevice) : "No current device known"} />
              <MetricCard label="Active devices" value={formatNumber(activeDeviceCount)} hint={`${formatNumber(props.devices.length - activeDeviceCount)} revoked devices`} />
              <MetricCard label="Last device refresh" value={formatRelativeDate(props.lastWorkspaceRefreshAt)} hint="list, status, and current-device marker" />
            </div>
            <div className="helper-copy" style={{ marginTop: "1rem" }}>
              Use remote revoke only for other active devices. If revoke fails, refresh once before retrying so operators do not overstate current access state.
            </div>

            <div className="helper-copy" style={{ marginTop: "1rem" }}>
              Use the top-bar Sign out button for this device. Remote revoke is only available for other devices.
            </div>

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Label</th>
                    <th>Host</th>
                    <th>Seen</th>
                    <th>Sync</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {props.devices.map((device) => {
                    const revokeDisabled = props.deviceActionBusyId !== null || props.authState !== "idle"
                    const isRevoking = props.deviceActionBusyId === device.deviceId
                    return (
                      <tr key={device.deviceId}>
                        <td>
                          {device.label}
                          {device.isCurrentDevice && <span className="inline-badge">current device</span>}
                        </td>
                        <td>{formatDeviceHost(device)}</td>
                        <td>{formatRelativeDate(device.lastSeenAt)}</td>
                        <td>{formatRelativeDate(device.lastSyncAt)}</td>
                        <td>{device.status}</td>
                        <td>
                          {device.isCurrentDevice ? (
                            <span className="helper-copy">Use Sign out above</span>
                          ) : device.status === "revoked" ? (
                            <span className="helper-copy">Already revoked</span>
                          ) : (
                            <button
                              type="button"
                              className="button danger compact-button"
                              onClick={() => void props.onRevokeDevice(device.deviceId)}
                              disabled={revokeDisabled}
                            >
                              {isRevoking ? "Revoking…" : "Revoke access"}
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </>
  )
}

function FileShellCard(props: {
  title: string
  description: string
  accept: string
  actionLabel: string
  state: "idle" | "loading" | "ready" | "error" | "parsed" | "translating" | "done"
  error: string
  onFile: (file: File) => Promise<void>
  children?: React.ReactNode
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const inputId = useMemo(() => `workspace-file-${props.accept.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "upload"}`, [props.accept])

  const handleInput = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      void props.onFile(file)
    }
    event.target.value = ""
  }, [props])

  const handleDrop = useCallback((event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    const file = event.dataTransfer.files?.[0]
    if (file) {
      void props.onFile(file)
    }
  }, [props])

  return (
    <section className="card file-shell-card">
      <div className="section-heading">
        <div>
          <div className="card-title">{props.title}</div>
          <div className="card-copy">{props.description}</div>
        </div>
      </div>

      <label
        htmlFor={inputId}
        className={`dropzone${props.state === "loading" || props.state === "translating" ? " is-loading" : ""}`}
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
        tabIndex={0}
        aria-label={`${props.actionLabel}: drop a file here or browse`}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            inputRef.current?.click()
          }
        }}
      >
        <input
          ref={inputRef}
          id={inputId}
          className="visually-hidden"
          type="file"
          accept={props.accept}
          onChange={handleInput}
        />
        <div className="dropzone-title">{props.actionLabel}</div>
        <div className="dropzone-copy">Drop a file here or click to browse.</div>
        <small>{props.accept}</small>
      </label>

      {props.state === "loading" && (
        <div className="workspace-inline-progress workspace-inline-progress--indeterminate" aria-live="polite" role="status">
          <span className="helper-copy">Loading preview…</span>
        </div>
      )}
      {props.state === "translating" && (
        <div className="workspace-inline-progress workspace-inline-progress--indeterminate" aria-live="polite" role="status">
          <span className="helper-copy">Translating via Astra relay…</span>
        </div>
      )}
      {props.state === "error" && props.error && <div className="error-note">{props.error}</div>}

      <div className="file-shell-card__body">
        {props.children}
      </div>
    </section>
  )
}

function RecentImportsCard(props: {
  imports: RecentWebImport[]
  onOpen: (route: AppRoute) => void
  onClear: () => void
}) {
  return (
    <section className="card callout success">
      <div className="section-heading">
        <div>
          <div className="card-title">Recent imports</div>
          <div className="card-copy">Saved locally for quick return to active file workflows.</div>
        </div>
        {props.imports.length > 0 && (
          <button type="button" className="button ghost compact-button" onClick={props.onClear}>
            Clear
          </button>
        )}
      </div>

      {props.imports.length === 0 ? (
        <div className="helper-copy">No saved imports yet.</div>
      ) : (
        <div className="stack list">
          {props.imports.map((item) => (
            <button key={item.source} type="button" className="reader-nav-item" onClick={() => props.onOpen(item.route)}>
              <strong>{item.title}</strong>
              <small>{item.summary}</small>
              <small>{item.detail}</small>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

function ExtensionOnlyCard() {
  return (
    <section className="card callout warning">
      <div className="card-title">Extension-only handoff</div>
      <div className="card-copy">
        Use Astra Web for Astra-owned workspaces. Switch to the supported desktop extension when the task requires live page control.
      </div>
      <ul className="bullet-list">
        {EXTENSION_ONLY_SURFACES.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <div className="helper-copy">
        Boundary copy stays explicit on purpose: this shell does not claim arbitrary in-page translation from a normal tab.
      </div>
    </section>
  )
}

function SurfaceListCard(props: {
  title: string
  items: string[]
  tone: "success" | "warning"
}) {
  return (
    <section className={`card callout ${props.tone}`}>
      <div className="card-title">{props.title}</div>
      <ul className="bullet-list">
        {props.items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </section>
  )
}

function MetricCard(props: {
  label: string
  value: string
  hint: string
}) {
  return (
    <div className="metric-card">
      <div className="metric-label">{props.label}</div>
      <div className="metric-value">{props.value}</div>
      <div className="metric-hint">{props.hint}</div>
    </div>
  )
}

function InlineGate(props: {
  title: string
  copy: string
  actionLabel: string
  onAction: () => void
}) {
  return (
    <div className="card callout warning">
      <div className="card-title">{props.title}</div>
      <div className="card-copy">{props.copy}</div>
      <button type="button" className="button secondary" onClick={props.onAction}>
        {props.actionLabel}
      </button>
    </div>
  )
}
