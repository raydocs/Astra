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
import { buildAstraStorePermissionTrustViewModel } from "@/utils/trust/compliance"
import { buildClozeFromSentence } from "@/utils/reading/cloze"
import { isTtsSupported, speak } from "@/utils/tts"
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
  deleteWebCloudLearningMemory,
  createWebContinuityExport,
  createWebSession,
  createWebTrialIntent,
  createWebVideoNoteJob,
  fetchWebWeeklyDigest,
  repairWebCloudSync,
  downloadWebContinuityExport,
  ensureWebDeviceIdentity,
  fetchWebAccountWorkspace,
  fetchWebCloudDataDeleteJob,
  fetchWebCloudAssets,
  fetchWebCloudLearningMemoryInventory,
  fetchWebContinuityExportJob,
  fetchWebFeatureFlagRuntime,
  fetchWebImportQueueObservability,
  fetchWebCostUsageSummary,
  fetchWebCancellationReasonSummary,
  fetchWebOpsAuditSummary,
  fetchWebOpsCockpitSummary,
  fetchWebOpsUserLookup,
  fetchWebProviderHealthSummary,
  fetchWebSupportReportSummary,
  fetchWebSupportReports,
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
  updateWebFeatureFlagRuntime,
  updateWebSupportReportTriage,
  updateWebSyncCollectionPreference,
  updateWebWeeklyDigestPreference,
  replayWebImportJobs,
  type TextTransferDraft,
  type WebCloudAssetsWorkspace,
  type WebCloudDataDeleteJob,
  type WebCloudLearningMemoryDeletionReceipt,
  type WebCloudLearningMemoryInventory,
  type WebContinuityExportJob,
  type WebCancellationReasonSummary,
  type WebCostUsageSummary,
  type WebDeviceEntry,
  type WebOpsAuditSummary,
  type WebOpsCockpitSummary,
  type WebOpsUserLookupSummary,
  type WebProviderHealthSummary,
  type WebFeatureFlagRuntime,
  type WebImportQueueObservability,
  type WebKillSwitchCategory,
  type WebSupportReportFollowUpPath,
  type WebSupportReportFollowUpReason,
  type WebSupportReportFollowUpStatus,
  type WebSupportReportList,
  type WebSupportReportListEntry,
  type WebSupportReportSummary,
  type WebSupportReportTriagePriority,
  type WebSupportReportTriageStatus,
  type WebSyncRepairResult,
  type WebTrialLifecycleContract,
  type WebWeeklyDigestSnapshot,
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

type AppRoute = "/" | "/sign-in" | "/sample" | "/learn/read-english-webpages" | "/learn/youtube-bilingual-subtitles" | "/learn/save-english-sentences" | "/learn/ai-reading-assistant-chinese" | "/today" | "/text" | "/articles" | "/files/pdf" | "/files/epub" | "/files/subtitles" | "/video-notes" | "/assets" | "/account"
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

const SUPPORT_FOLLOW_UP_PATH_OPTIONS: WebSupportReportFollowUpPath[] = ["not_selected", "known_issue", "email_follow_up", "support_queue", "no_follow_up_needed"]
const SUPPORT_FOLLOW_UP_STATUS_OPTIONS: WebSupportReportFollowUpStatus[] = ["not_started", "selected", "handed_off", "completed"]
const SUPPORT_FOLLOW_UP_REASON_OPTIONS: WebSupportReportFollowUpReason[] = ["matched_known_issue", "needs_manual_email", "needs_support_queue_review", "macro_ready", "no_follow_up_needed", "other_metadata_reason"]

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

type AssetTile = { id: string; title: string; meta: string; route: AppRoute; tone: "local" | "history" | "vocab" | "empty" }

const ASTRA_CERT_ASSET_TILES: AssetTile[] = [
  { id: "cert-asset-deck", title: "marginalia · saved deck", meta: "284 words", route: "/assets", tone: "local" },
  { id: "cert-asset-wolf-hall", title: "Wolf Hall · ch.14 excerpt", meta: "8 highlights", route: "/files/epub", tone: "history" },
  { id: "cert-asset-tunnel", title: "六龜山隧道.jpg", meta: "shared 2026", route: "/assets", tone: "history" },
  { id: "cert-asset-calvino", title: "Calvino · cover.png", meta: "imported", route: "/files/pdf", tone: "local" },
  { id: "cert-asset-drive", title: "Drive My Car · ED", meta: "video still", route: "/video-notes", tone: "vocab" },
  { id: "cert-asset-new", title: "+ new asset", meta: "drop a file", route: "/assets", tone: "empty" },
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
  { route: "/today", label: "Today", detail: "mobile review" },
  { route: "/text", label: "Text", detail: "translate / explain" },
  { route: "/articles", label: "Articles", detail: "URL import + read-only" },
  { route: "/files/pdf", label: "PDF", detail: "reader + resume" },
  { route: "/files/epub", label: "EPUB", detail: "chapter reader" },
  { route: "/files/subtitles", label: "Subtitle & docs", detail: "translate + export" },
  { route: "/video-notes", label: "Video notes", detail: "job + artifact viewer" },
  { route: "/assets", label: "Assets", detail: "library + details" },
  { route: "/account", label: "Account", detail: "session / usage / beta limits" },
]

const PUBLIC_ONLY_ROUTES = [
  "/sign-in",
  "/sample",
  "/learn/read-english-webpages",
  "/learn/youtube-bilingual-subtitles",
  "/learn/save-english-sentences",
  "/learn/ai-reading-assistant-chinese",
] as const satisfies readonly AppRoute[]

const PORTABLE_SURFACES = [
  "text translation, explain, and custom prompts",
  "URL article import with readable extraction and local resume",
  "resumable PDF / EPUB / subtitle workspaces",
  "recent imports and explicit file-to-text handoff",
  "account, quota, beta limits, sync health, and read-only cloud continuity surfaces",
]

const EXTENSION_ONLY_SURFACES = [
  "live webpage translation on third-party pages",
  "hover, selection, and input-box overlays",
  "tab-aware page controls and browser commands",
  "live site subtitle overlays and frame coordination",
]

const PUBLIC_INTENT_ROUTES = [
  "/sample",
  "/learn/read-english-webpages",
  "/learn/youtube-bilingual-subtitles",
  "/learn/save-english-sentences",
  "/learn/ai-reading-assistant-chinese",
] as const satisfies readonly AppRoute[]

type PublicIntentRoute = typeof PUBLIC_INTENT_ROUTES[number]

const PUBLIC_INTENT_PAGES: Record<PublicIntentRoute, {
  intent: string
  eyebrow: string
  title: string
  copy: string
  bullets: string[]
}> = {
  "/sample": {
    intent: "public_sample",
    eyebrow: "Public sample · zero-config preview",
    title: "Try Astra on a static sample before you install.",
    copy: "See the core loop with safe demo text: understand a paragraph, save one expression, then start a private review workspace. No account, API key, or personal page content is needed for this preview.",
    bullets: ["Static demo text only", "Margin translation and saved expression preview", "Start free to continue in your own private workspace"],
  },
  "/learn/read-english-webpages": {
    intent: "read_english_webpages",
    eyebrow: "SEO intent · AI bilingual reading extension",
    title: "Read English webpages with bilingual context.",
    copy: "Astra keeps the original article visible and adds plain-language translation beside it, so learners can read real web content without switching tools.",
    bullets: ["Best for articles, essays, and documentation", "Use the extension for live pages", "Save short expressions for later review"],
  },
  "/learn/youtube-bilingual-subtitles": {
    intent: "youtube_bilingual_subtitles",
    eyebrow: "SEO intent · video language learning",
    title: "Study videos with bilingual subtitle workflows.",
    copy: "Use Astra for subtitle files and video-note workflows that turn timestamps, captions, and useful phrases into reviewable learning material.",
    bullets: ["Bring subtitle files into Astra Web", "Keep notes tied to learning context", "Install the extension for browser video overlays"],
  },
  "/learn/save-english-sentences": {
    intent: "save_english_sentences",
    eyebrow: "SEO intent · sentence review",
    title: "Save English sentences for lightweight review.",
    copy: "Astra is designed around short, user-selected snippets: save the sentence that taught you something, then review it without publishing your reading history.",
    bullets: ["User-selected short snippets only", "Review from real context", "No public hosting of saved sentences"],
  },
  "/learn/ai-reading-assistant-chinese": {
    intent: "ai_reading_assistant_chinese",
    eyebrow: "SEO intent · 中文用户读英文",
    title: "An AI reading assistant for Chinese speakers reading English.",
    copy: "Astra helps Chinese-speaking learners keep English source text in view while reading clear Chinese explanations, vocabulary, and review cards.",
    bullets: ["English source stays visible", "Chinese explanations beside the text", "Zero-config Astra AI handles the setup"],
  },
}

function isPublicIntentRoute(route: AppRoute): route is PublicIntentRoute {
  return PUBLIC_INTENT_ROUTES.some((candidate) => candidate === route)
}

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

interface GrowthLandingContext {
  kind: "sentence_card" | "referral" | "public_sample" | "seo_intent" | null
  campaign: string | null
  intent?: string | null
}

const WEB_GROWTH_EVENT_STORAGE_KEY = "astra.web.growth-events.v1"
const ASTRA_WEB_PERMISSION_TRUST = buildAstraStorePermissionTrustViewModel()

function readCombinedLocationParams(): URLSearchParams {
  const combined = new URLSearchParams()
  new URLSearchParams(window.location.search).forEach((value, key) => combined.set(key, value))
  parseHashLocation().searchParams.forEach((value, key) => combined.set(key, value))
  return combined
}

function sanitizeGrowthCampaign(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? ""
  return /^[a-z0-9_-]{1,64}$/i.test(trimmed) ? trimmed : null
}

function readGrowthLandingContext(): GrowthLandingContext {
  try {
    const params = readCombinedLocationParams()
    const source = params.get("utm_source")?.trim() ?? ""
    const share = params.get("share")?.trim() ?? ""
    const referral = params.get("referral")?.trim() ?? ""
    const kind = share === "sentence" || source === "sentence_card"
      ? "sentence_card"
      : referral === "non_rewarding" || source === "referral"
        ? "referral"
        : null
    return { kind, campaign: sanitizeGrowthCampaign(params.get("utm_campaign")) }
  } catch {
    return { kind: null, campaign: null }
  }
}

function recordWebGrowthLandingEvent(event: "landing_visited" | "landing_install_clicked", context: GrowthLandingContext): void {
  if (!context.kind) return
  try {
    const existing = JSON.parse(window.localStorage.getItem(WEB_GROWTH_EVENT_STORAGE_KEY) ?? "[]") as unknown[]
    const landingDetails = context.kind === "sentence_card"
      ? { shareType: "sentence_card" }
      : context.kind === "referral"
        ? { referralType: "non_rewarding", rewardAvailable: false }
        : context.kind === "public_sample"
          ? { sampleType: "zero_config_static", intent: context.intent ?? "public_sample" }
          : { intent: context.intent ?? "seo_intent" }
    const next = [{
      id: `web_growth_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      type: "feature_usage",
      data: {
        feature: "learning_loop",
        event,
        source: "web_landing",
        landingSource: context.kind,
        ...landingDetails,
        ...(context.campaign ? { campaign: context.campaign } : {}),
      },
    }, ...existing].slice(0, 100)
    window.localStorage.setItem(WEB_GROWTH_EVENT_STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Ignore local analytics failures; growth landing tracking must never block the public page.
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

function formatEstimatedUsd(value: number | null | undefined): string {
  return `$${(value ?? 0).toFixed(4)}`
}

function formatCloudMemoryCollectionLabel(collection: string): string {
  switch (collection) {
    case "config":
      return "Preferences"
    case "vocabulary":
      return "Saved words & sentences"
    case "review_schedule":
      return "Review plan"
    case "reading_history":
      return "Reading history"
    case "study_progress":
      return "Study progress"
    case "weekly_digest_archive":
      return "Weekly digest archive"
    default:
      return collection.replace(/_/g, " ")
  }
}

function summarizeCloudMemoryActiveCount(inventory: WebCloudLearningMemoryInventory | null): number {
  return inventory?.collections.reduce((sum, collection) => sum + collection.activeCount, 0) ?? 0
}

function sanitizeWeeklyDigestForAccount(digest: WebWeeklyDigestSnapshot): WebWeeklyDigestSnapshot {
  return {
    ...digest,
    highlightedWords: [],
    highlightedSentences: [],
  }
}

type MobileReviewRating = "again" | "good" | "easy"

interface MobileReviewCard {
  id: string
  type: "word" | "sentence"
  front: string
  translation: string
  explanation: string
  context: string
  sourceTitle: string
  sourceKind: "Page" | "Video" | "PDF" | "Doc" | "Saved"
  savedAt: number
  sample: boolean
}

interface MobileQueuedReviewEvent {
  eventId: string
  cardId: string
  rating: MobileReviewRating
  reviewedAt: string
  source: "web-pwa-today"
  queued: true
}

const MOBILE_REVIEW_EVENT_STORAGE_KEY = "astra.web.mobile-review-events.v1"
const MOBILE_REVIEW_SESSION_SIZE = 5

const SAMPLE_MOBILE_REVIEW_CARDS: MobileReviewCard[] = [
  {
    id: "sample-resilient",
    type: "word",
    front: "resilient",
    translation: "能恢复的；有韧性的",
    explanation: "In this sentence, resilient describes a system that keeps working after failures.",
    context: "The system remained resilient after multiple node failures.",
    sourceTitle: "The Future of Distributed Systems",
    sourceKind: "Page",
    savedAt: Date.UTC(2026, 4, 27),
    sample: true,
  },
  {
    id: "sample-moving-target",
    type: "sentence",
    front: "The catch is that consistency becomes a moving target.",
    translation: "问题在于，一致性会变成一个不断变化的目标。",
    explanation: "“The catch is…” introduces the hidden problem; “a moving target” means the goal keeps changing.",
    context: "The catch is that consistency becomes a moving target.",
    sourceTitle: "Designing Data-Intensive Applications notes",
    sourceKind: "Doc",
    savedAt: Date.UTC(2026, 4, 27),
    sample: true,
  },
  {
    id: "sample-trade-off",
    type: "word",
    front: "trade-off",
    translation: "权衡；取舍",
    explanation: "A trade-off is a choice where gaining one thing means giving up part of another.",
    context: "Every distributed design makes a trade-off between latency and consistency.",
    sourceTitle: "Architecture review video",
    sourceKind: "Video",
    savedAt: Date.UTC(2026, 4, 27),
    sample: true,
  },
]

function readQueuedMobileReviewEvents(): MobileQueuedReviewEvent[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(MOBILE_REVIEW_EVENT_STORAGE_KEY) ?? "[]") as MobileQueuedReviewEvent[]
    return Array.isArray(parsed) ? parsed.filter((event) => event?.queued && event.cardId) : []
  } catch {
    return []
  }
}

function isMobileReviewEventFromToday(event: Pick<MobileQueuedReviewEvent, "reviewedAt">): boolean {
  const reviewedAt = new Date(event.reviewedAt)
  if (Number.isNaN(reviewedAt.getTime())) return false
  const today = new Date()
  return reviewedAt.getFullYear() === today.getFullYear()
    && reviewedAt.getMonth() === today.getMonth()
    && reviewedAt.getDate() === today.getDate()
}

function readTodayMobileReviewCardIds(): Set<string> {
  return new Set(readQueuedMobileReviewEvents()
    .filter(isMobileReviewEventFromToday)
    .map((event) => event.cardId))
}

function appendQueuedMobileReviewEvent(cardId: string, rating: MobileReviewRating): MobileQueuedReviewEvent[] {
  const next: MobileQueuedReviewEvent = {
    eventId: `mobile_review_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    cardId,
    rating,
    reviewedAt: new Date().toISOString(),
    source: "web-pwa-today",
    queued: true,
  }
  const events = [next, ...readQueuedMobileReviewEvents()].slice(0, 500)
  try {
    window.localStorage.setItem(MOBILE_REVIEW_EVENT_STORAGE_KEY, JSON.stringify(events))
  } catch {
    // Local review feedback must not block the session if storage is unavailable.
  }
  return events
}

function getMobileReviewSourceKind(entry: WebCloudAssetsWorkspace["vocabulary"]["entries"][number]): MobileReviewCard["sourceKind"] {
  const surface = entry.sourceContext?.surface
  const ownedType = entry.sourceContext?.ownedReadingSourceType
  if (surface === "subtitle_reader" || surface === "video_transcript") return "Video"
  if (ownedType === "pdf") return "PDF"
  if (ownedType === "epub" || ownedType === "subtitle-file") return "Doc"
  if (entry.sourceContext?.pageUrl || entry.url || entry.hostname || entry.sourceContext?.hostname) return "Page"
  return "Saved"
}

function getMobileReviewSourceTitle(entry: WebCloudAssetsWorkspace["vocabulary"]["entries"][number]): string {
  return entry.sourceContext?.ownedReadingTitle
    ?? entry.sourceContext?.pageTitle
    ?? entry.sourceContext?.hostname
    ?? entry.hostname
    ?? "your reading"
}

function buildMobileReviewCards(cloudAssets: WebCloudAssetsWorkspace | null): MobileReviewCard[] {
  const entries = cloudAssets?.vocabulary.entries ?? []
  if (entries.length === 0) return SAMPLE_MOBILE_REVIEW_CARDS

  // Order /today by what's DUE (SRS), not by what was most recently saved. The SRS
  // schedule rides in a separate sync collection alongside entries; an entry with no
  // schedule record is new and counts as due now. Mirrors srs/leitner isDue (due when
  // now >= nextReviewAt): due/overdue first (most overdue first), then soonest-upcoming,
  // with savedAt as the final tiebreak. Slices to the session size, never empty.
  const now = Date.now()
  const nextReviewByEntryId = new Map(
    (cloudAssets?.vocabulary.reviewSchedule ?? []).map((record) => [record.vocabularyEntryId, record.nextReviewAt]),
  )
  const nextReviewAtFor = (entryId: string): number => nextReviewByEntryId.get(entryId) ?? 0

  return entries
    .slice()
    .sort((a, b) => {
      const aNext = nextReviewAtFor(a.id)
      const bNext = nextReviewAtFor(b.id)
      const aDue = aNext <= now
      const bDue = bNext <= now
      if (aDue !== bDue) return aDue ? -1 : 1
      if (aNext !== bNext) return aNext - bNext
      return b.savedAt - a.savedAt
    })
    .slice(0, MOBILE_REVIEW_SESSION_SIZE)
    .map((entry): MobileReviewCard => {
      const sentence = entry.sourceContext?.sentenceText ?? entry.context ?? ""
      const looksLikeSentence = entry.text.trim().includes(" ") || entry.text.length > 48
      return {
        id: entry.id,
        type: looksLikeSentence ? "sentence" : "word",
        front: entry.text,
        translation: entry.translation?.trim() || "Saved for review.",
        explanation: entry.explanation?.trim() || (looksLikeSentence ? "Review the meaning, then rate how well you remember it." : "Review this expression in the context where you saved it."),
        context: sentence,
        sourceTitle: getMobileReviewSourceTitle(entry),
        sourceKind: getMobileReviewSourceKind(entry),
        savedAt: entry.savedAt,
        sample: false,
      }
    })
}

function summarizeMobileReviewSources(cards: MobileReviewCard[]): string {
  const realCards = cards.filter((card) => !card.sample)
  const sourceCards = realCards.length > 0 ? realCards : cards
  const sourceCount = new Set(sourceCards.map((card) => `${card.sourceKind}:${card.sourceTitle}`)).size
  const kinds = new Set(sourceCards.map((card) => card.sourceKind.toLowerCase()))
  const sourceLabel = sourceCount === 1 ? "1 source" : `${sourceCount} sources`
  return `${sourceLabel} · ${Array.from(kinds).join(", ") || "saved"}`
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
  const [trialLifecycle, setTrialLifecycle] = useState<WebTrialLifecycleContract | null>(null)
  const [trialIntentState, setTrialIntentState] = useState<"idle" | "recording">("idle")
  const [cloudLearningMemoryInventory, setCloudLearningMemoryInventory] = useState<WebCloudLearningMemoryInventory | null>(null)
  const [cloudLearningMemoryState, setCloudLearningMemoryState] = useState<"idle" | "loading" | "ready" | "error">("idle")
  const [cloudLearningMemoryError, setCloudLearningMemoryError] = useState("")
  const [cloudLearningMemoryDeleteState, setCloudLearningMemoryDeleteState] = useState<"idle" | "deleting">("idle")
  const [cloudLearningMemoryReceipt, setCloudLearningMemoryReceipt] = useState<WebCloudLearningMemoryDeletionReceipt | null>(null)
  const [weeklyDigest, setWeeklyDigest] = useState<WebWeeklyDigestSnapshot | null>(null)
  const [weeklyDigestState, setWeeklyDigestState] = useState<"idle" | "loading" | "ready" | "error">("idle")
  const [weeklyDigestError, setWeeklyDigestError] = useState("")
  const [weeklyDigestPreferenceState, setWeeklyDigestPreferenceState] = useState<"idle" | "saving">("idle")
  const [recentImports, setRecentImports] = useState<RecentWebImport[]>(() => readRecentImports())
  const [cloudAssets, setCloudAssets] = useState<WebCloudAssetsWorkspace | null>(null)
  const [cloudState, setCloudState] = useState<"idle" | "loading" | "ready" | "error">("idle")
  const [cloudError, setCloudError] = useState("")
  const [importOps, setImportOps] = useState<WebImportQueueObservability | null>(null)
  const [importOpsState, setImportOpsState] = useState<"idle" | "loading" | "ready" | "error">("idle")
  const [importOpsError, setImportOpsError] = useState("")
  const [costUsageSummary, setCostUsageSummary] = useState<WebCostUsageSummary | null>(null)
  const [costUsageLoadedForToken, setCostUsageLoadedForToken] = useState("")
  const [costUsageState, setCostUsageState] = useState<"idle" | "loading" | "ready" | "error">("idle")
  const [costUsageError, setCostUsageError] = useState("")
  const [opsCockpitSummary, setOpsCockpitSummary] = useState<WebOpsCockpitSummary | null>(null)
  const [opsCockpitLoadedForToken, setOpsCockpitLoadedForToken] = useState("")
  const [opsCockpitState, setOpsCockpitState] = useState<"idle" | "loading" | "ready" | "error">("idle")
  const [opsCockpitError, setOpsCockpitError] = useState("")
  const [providerHealthSummary, setProviderHealthSummary] = useState<WebProviderHealthSummary | null>(null)
  const [providerHealthLoadedForToken, setProviderHealthLoadedForToken] = useState("")
  const [providerHealthState, setProviderHealthState] = useState<"idle" | "loading" | "ready" | "error">("idle")
  const [providerHealthError, setProviderHealthError] = useState("")
  const [opsUserLookup, setOpsUserLookup] = useState<WebOpsUserLookupSummary | null>(null)
  const [opsUserLookupLoadedForToken, setOpsUserLookupLoadedForToken] = useState("")
  const [opsUserLookupLoadedForQuery, setOpsUserLookupLoadedForQuery] = useState("")
  const [opsUserLookupState, setOpsUserLookupState] = useState<"idle" | "loading" | "ready" | "error">("idle")
  const [opsUserLookupError, setOpsUserLookupError] = useState("")
  const [opsAuditSummary, setOpsAuditSummary] = useState<WebOpsAuditSummary | null>(null)
  const [opsAuditLoadedForToken, setOpsAuditLoadedForToken] = useState("")
  const [opsAuditState, setOpsAuditState] = useState<"idle" | "loading" | "ready" | "error">("idle")
  const [opsAuditError, setOpsAuditError] = useState("")
  const [cancellationReasonSummary, setCancellationReasonSummary] = useState<WebCancellationReasonSummary | null>(null)
  const [cancellationReasonLoadedForToken, setCancellationReasonLoadedForToken] = useState("")
  const [cancellationReasonState, setCancellationReasonState] = useState<"idle" | "loading" | "ready" | "error">("idle")
  const [cancellationReasonError, setCancellationReasonError] = useState("")
  const [supportReportSummary, setSupportReportSummary] = useState<WebSupportReportSummary | null>(null)
  const [supportReports, setSupportReports] = useState<WebSupportReportList | null>(null)
  const [supportReportsLoadedForToken, setSupportReportsLoadedForToken] = useState("")
  const [supportReportsState, setSupportReportsState] = useState<"idle" | "loading" | "ready" | "error">("idle")
  const [supportReportsError, setSupportReportsError] = useState("")
  const [featureFlagRuntime, setFeatureFlagRuntime] = useState<WebFeatureFlagRuntime | null>(null)
  const [featureFlagsState, setFeatureFlagsState] = useState<"idle" | "loading" | "ready" | "error">("idle")
  const [featureFlagsError, setFeatureFlagsError] = useState("")
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
  const operatorTokenRef = useRef("")
  const learningMemoryRequestIdRef = useRef(0)

  const installPrompt = useInstallPrompt()
  const growthLanding = useMemo(() => readGrowthLandingContext(), [])

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

    const routeLabel = route === "/sign-in"
      ? "Sign in"
      : isPublicIntentRoute(route)
        ? PUBLIC_INTENT_PAGES[route].title
        : NAV_ITEMS.find((item) => item.route === route)?.label ?? "Overview"
    document.title = `${routeLabel} · Astra Web`
  }, [route, session])

  useEffect(() => {
    if (!session && route === "/" && growthLanding.kind) {
      recordWebGrowthLandingEvent("landing_visited", growthLanding)
    }
  }, [growthLanding, route, session])

  useEffect(() => {
    if (!session && isPublicIntentRoute(route)) {
      const page = PUBLIC_INTENT_PAGES[route]
      recordWebGrowthLandingEvent("landing_visited", {
        kind: route === "/sample" ? "public_sample" : "seo_intent",
        campaign: null,
        intent: page.intent,
      })
    }
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

  const refreshCloudLearningMemoryControls = useCallback(async (activeSession: AstraSession | null) => {
    if (!activeSession || activeSession.identityMode !== "authenticated") {
      learningMemoryRequestIdRef.current += 1
      setCloudLearningMemoryInventory(null)
      setCloudLearningMemoryReceipt(null)
      setCloudLearningMemoryState("idle")
      setCloudLearningMemoryError("")
      setWeeklyDigest(null)
      setWeeklyDigestState("idle")
      setWeeklyDigestError("")
      return
    }

    const requestId = ++learningMemoryRequestIdRef.current
    setCloudLearningMemoryState("loading")
    setWeeklyDigestState("loading")
    setCloudLearningMemoryError("")
    setWeeklyDigestError("")

    const [inventoryResult, digestResult] = await Promise.allSettled([
      fetchWebCloudLearningMemoryInventory({ session: activeSession, device }),
      fetchWebWeeklyDigest({ session: activeSession, device }),
    ])
    if (learningMemoryRequestIdRef.current !== requestId) return

    if (inventoryResult.status === "fulfilled") {
      setCloudLearningMemoryInventory(inventoryResult.value)
      setCloudLearningMemoryState("ready")
    } else {
      setCloudLearningMemoryState("error")
      setCloudLearningMemoryError(inventoryResult.reason instanceof Error ? inventoryResult.reason.message : "Cloud learning-memory inventory failed.")
    }

    if (digestResult.status === "fulfilled") {
      setWeeklyDigest(sanitizeWeeklyDigestForAccount(digestResult.value))
      setWeeklyDigestState("ready")
    } else {
      setWeeklyDigestState("error")
      setWeeklyDigestError(digestResult.reason instanceof Error ? digestResult.reason.message : "Weekly digest status failed.")
    }
  }, [device])

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

  const refreshCostUsageSummary = useCallback(async (activeSession: AstraSession | null, nextOperatorToken?: string) => {
    if (!activeSession) {
      setCostUsageSummary(null)
      setCostUsageLoadedForToken("")
      setCostUsageState("idle")
      setCostUsageError("")
      return
    }

    const token = (nextOperatorToken ?? operatorToken).trim()
    if (!token) {
      setCostUsageSummary(null)
      setCostUsageLoadedForToken("")
      setCostUsageState("idle")
      setCostUsageError("")
      return
    }

    setCostUsageState("loading")
    setCostUsageError("")
    try {
      const summary = await fetchWebCostUsageSummary({
        baseURL: activeSession.relayBaseURL,
        operatorToken: token,
      })
      setCostUsageSummary(summary)
      setCostUsageLoadedForToken(token)
      setCostUsageState("ready")
    } catch (error) {
      setCostUsageState("error")
      setCostUsageError(error instanceof Error ? error.message : "Cost usage summary request failed.")
    }
  }, [operatorToken])

  const refreshOpsCockpitSummary = useCallback(async (activeSession: AstraSession | null, nextOperatorToken?: string) => {
    if (!activeSession) {
      setOpsCockpitSummary(null)
      setOpsCockpitLoadedForToken("")
      setOpsCockpitState("idle")
      setOpsCockpitError("")
      return
    }

    const token = (nextOperatorToken ?? operatorToken).trim()
    if (!token) {
      setOpsCockpitSummary(null)
      setOpsCockpitLoadedForToken("")
      setOpsCockpitState("idle")
      setOpsCockpitError("")
      return
    }

    setOpsCockpitState("loading")
    setOpsCockpitError("")
    try {
      const summary = await fetchWebOpsCockpitSummary({
        baseURL: activeSession.relayBaseURL,
        operatorToken: token,
      })
      setOpsCockpitSummary(summary)
      setOpsCockpitLoadedForToken(token)
      setOpsCockpitState("ready")
    } catch (error) {
      setOpsCockpitState("error")
      setOpsCockpitError(error instanceof Error ? error.message : "Ops cockpit summary request failed.")
    }
  }, [operatorToken])

  const refreshProviderHealthSummary = useCallback(async (activeSession: AstraSession | null, nextOperatorToken?: string) => {
    if (!activeSession) {
      setProviderHealthSummary(null)
      setProviderHealthLoadedForToken("")
      setProviderHealthState("idle")
      setProviderHealthError("")
      return
    }

    const token = (nextOperatorToken ?? operatorToken).trim()
    if (!token) {
      setProviderHealthSummary(null)
      setProviderHealthLoadedForToken("")
      setProviderHealthState("idle")
      setProviderHealthError("")
      return
    }

    setProviderHealthState("loading")
    setProviderHealthError("")
    try {
      const summary = await fetchWebProviderHealthSummary({
        baseURL: activeSession.relayBaseURL,
        operatorToken: token,
      })
      setProviderHealthSummary(summary)
      setProviderHealthLoadedForToken(token)
      setProviderHealthState("ready")
    } catch {
      setProviderHealthState("error")
      setProviderHealthError("Route-health summary request failed.")
    }
  }, [operatorToken])

  const refreshOpsAuditSummary = useCallback(async (activeSession: AstraSession | null, nextOperatorToken?: string) => {
    if (!activeSession) {
      setOpsAuditSummary(null)
      setOpsAuditLoadedForToken("")
      setOpsAuditState("idle")
      setOpsAuditError("")
      return
    }

    const token = (nextOperatorToken ?? operatorToken).trim()
    if (!token) {
      setOpsAuditSummary(null)
      setOpsAuditLoadedForToken("")
      setOpsAuditState("idle")
      setOpsAuditError("")
      return
    }

    setOpsAuditState("loading")
    setOpsAuditError("")
    try {
      const summary = await fetchWebOpsAuditSummary({
        baseURL: activeSession.relayBaseURL,
        operatorToken: token,
      })
      setOpsAuditSummary(summary)
      setOpsAuditLoadedForToken(token)
      setOpsAuditState("ready")
    } catch (error) {
      setOpsAuditState("error")
      setOpsAuditError(error instanceof Error ? error.message : "Operator audit summary request failed.")
    }
  }, [operatorToken])

  const refreshCancellationReasonSummary = useCallback(async (activeSession: AstraSession | null, nextOperatorToken?: string) => {
    if (!activeSession) {
      setCancellationReasonSummary(null)
      setCancellationReasonLoadedForToken("")
      setCancellationReasonState("idle")
      setCancellationReasonError("")
      return
    }

    const token = (nextOperatorToken ?? operatorToken).trim()
    if (!token) {
      setCancellationReasonSummary(null)
      setCancellationReasonLoadedForToken("")
      setCancellationReasonState("idle")
      setCancellationReasonError("")
      return
    }

    setCancellationReasonState("loading")
    setCancellationReasonError("")
    try {
      const summary = await fetchWebCancellationReasonSummary({
        baseURL: activeSession.relayBaseURL,
        operatorToken: token,
      })
      setCancellationReasonSummary(summary)
      setCancellationReasonLoadedForToken(token)
      setCancellationReasonState("ready")
    } catch (error) {
      setCancellationReasonState("error")
      setCancellationReasonError(error instanceof Error ? error.message : "Cancellation reason summary request failed.")
    }
  }, [operatorToken])

  const lookupOpsUser = useCallback(async (activeSession: AstraSession | null, query: string, nextOperatorToken?: string) => {
    if (!activeSession) {
      setOpsUserLookup(null)
      setOpsUserLookupLoadedForToken("")
      setOpsUserLookupLoadedForQuery("")
      setOpsUserLookupState("idle")
      setOpsUserLookupError("")
      return
    }

    const token = (nextOperatorToken ?? operatorToken).trim()
    const lookupQuery = query.trim()
    if (!token || !lookupQuery) {
      setOpsUserLookup(null)
      setOpsUserLookupLoadedForToken("")
      setOpsUserLookupLoadedForQuery("")
      setOpsUserLookupState("idle")
      setOpsUserLookupError("")
      return
    }

    setOpsUserLookupState("loading")
    setOpsUserLookupError("")
    try {
      const summary = await fetchWebOpsUserLookup({
        baseURL: activeSession.relayBaseURL,
        operatorToken: token,
        query: lookupQuery,
      })
      setOpsUserLookup(summary)
      setOpsUserLookupLoadedForToken(token)
      setOpsUserLookupLoadedForQuery(lookupQuery)
      setOpsUserLookupState("ready")
    } catch (error) {
      setOpsUserLookupState("error")
      setOpsUserLookupError(error instanceof Error ? error.message : "User lookup request failed.")
    }
  }, [operatorToken])

  const refreshSupportReports = useCallback(async (activeSession: AstraSession | null, nextOperatorToken?: string) => {
    if (!activeSession) {
      setSupportReportSummary(null)
      setSupportReports(null)
      setSupportReportsLoadedForToken("")
      setSupportReportsState("idle")
      setSupportReportsError("")
      return
    }

    const token = (nextOperatorToken ?? operatorToken).trim()
    if (!token) {
      setSupportReportSummary(null)
      setSupportReports(null)
      setSupportReportsLoadedForToken("")
      setSupportReportsState("idle")
      setSupportReportsError("")
      return
    }

    setSupportReportsState("loading")
    setSupportReportsError("")
    try {
      const baseURL = activeSession.relayBaseURL
      const [summary, list] = await Promise.all([
        fetchWebSupportReportSummary({ baseURL, operatorToken: token }),
        fetchWebSupportReports({ baseURL, operatorToken: token }),
      ])
      if (operatorTokenRef.current.trim() !== token) {
        setSupportReportsState("idle")
        return
      }
      setSupportReportSummary(summary)
      setSupportReports(list)
      setSupportReportsLoadedForToken(token)
      setSupportReportsState("ready")
    } catch (error) {
      setSupportReportsState("error")
      setSupportReportsError(error instanceof Error ? error.message : "Support report triage request failed.")
    }
  }, [operatorToken])

  useEffect(() => {
    operatorTokenRef.current = operatorToken
  }, [operatorToken])

  const refreshFeatureFlags = useCallback(async (activeSession: AstraSession | null) => {
    if (!activeSession) {
      setFeatureFlagRuntime(null)
      setFeatureFlagsState("idle")
      setFeatureFlagsError("")
      return
    }

    setFeatureFlagsState("loading")
    setFeatureFlagsError("")
    try {
      const runtime = await fetchWebFeatureFlagRuntime({ baseURL: activeSession.relayBaseURL })
      setFeatureFlagRuntime(runtime)
      setFeatureFlagsState("ready")
    } catch (error) {
      setFeatureFlagsState("error")
      setFeatureFlagsError(error instanceof Error ? error.message : "Feature-flag runtime request failed.")
    }
  }, [])

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
    learningMemoryRequestIdRef.current += 1
    setSession(null)
    clearWebSession()
    setAccount(null)
    setUsage(null)
    setDevices([])
    clearCloudAssets()
    setCloudLearningMemoryInventory(null)
    setCloudLearningMemoryState("idle")
    setCloudLearningMemoryError("")
    setCloudLearningMemoryDeleteState("idle")
    setCloudLearningMemoryReceipt(null)
    setWeeklyDigest(null)
    setWeeklyDigestState("idle")
    setWeeklyDigestError("")
    setWeeklyDigestPreferenceState("idle")
    setImportOps(null)
    setImportOpsState("idle")
    setImportOpsError("")
    setCostUsageSummary(null)
    setCostUsageLoadedForToken("")
    setCostUsageState("idle")
    setCostUsageError("")
    setOpsCockpitSummary(null)
    setOpsCockpitLoadedForToken("")
    setOpsCockpitState("idle")
    setOpsCockpitError("")
    setProviderHealthSummary(null)
    setProviderHealthLoadedForToken("")
    setProviderHealthState("idle")
    setProviderHealthError("")
    setOpsUserLookup(null)
    setOpsUserLookupLoadedForToken("")
    setOpsUserLookupLoadedForQuery("")
    setOpsUserLookupState("idle")
    setOpsUserLookupError("")
    setOpsAuditSummary(null)
    setOpsAuditLoadedForToken("")
    setOpsAuditState("idle")
    setOpsAuditError("")
    setCancellationReasonSummary(null)
    setCancellationReasonLoadedForToken("")
    setCancellationReasonState("idle")
    setCancellationReasonError("")
    setSupportReportSummary(null)
    setSupportReports(null)
    setSupportReportsLoadedForToken("")
    setSupportReportsState("idle")
    setSupportReportsError("")
    setFeatureFlagRuntime(null)
    setFeatureFlagsState("idle")
    setFeatureFlagsError("")
  }, [clearCloudAssets])

  const refreshSessionState = useCallback(async (existingSession?: AstraSession, options: { silent?: boolean } = {}) => {
    const activeDevice = device
    const storedSession = existingSession ?? readWebSession()
    if (!storedSession) {
      clearCloudAssets()
      void refreshCloudLearningMemoryControls(null)
      void refreshImportOps(null)
      void refreshCostUsageSummary(null)
      void refreshOpsCockpitSummary(null)
      void refreshProviderHealthSummary(null)
      void refreshOpsAuditSummary(null)
      void refreshCancellationReasonSummary(null)
      void refreshFeatureFlags(null)
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
      void refreshCloudLearningMemoryControls(saved)
      void refreshImportOps(saved)
        void refreshCostUsageSummary(saved)
        void refreshOpsCockpitSummary(saved)
        void refreshProviderHealthSummary(saved)
        void refreshOpsAuditSummary(saved)
        void refreshCancellationReasonSummary(saved)
        void refreshSupportReports(saved)
      void refreshFeatureFlags(saved)
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
  }, [clearAuthenticatedWorkspace, clearCloudAssets, device, refreshAuthenticatedWorkspace, refreshCancellationReasonSummary, refreshCloudAssets, refreshCloudLearningMemoryControls, refreshCostUsageSummary, refreshFeatureFlags, refreshImportOps, refreshOpsAuditSummary, refreshOpsCockpitSummary, refreshProviderHealthSummary, refreshSupportReports])

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

  const handleOperatorTokenChange = useCallback((value: string) => {
    operatorTokenRef.current = value
    setOperatorToken(value)
    setCostUsageSummary(null)
    setCostUsageLoadedForToken("")
    setCostUsageState("idle")
    setCostUsageError("")
    setOpsCockpitSummary(null)
    setOpsCockpitLoadedForToken("")
    setOpsCockpitState("idle")
    setOpsCockpitError("")
    setProviderHealthSummary(null)
    setProviderHealthLoadedForToken("")
    setProviderHealthState("idle")
    setProviderHealthError("")
    setOpsUserLookup(null)
    setOpsUserLookupLoadedForToken("")
    setOpsUserLookupLoadedForQuery("")
    setOpsUserLookupState("idle")
    setOpsUserLookupError("")
    setOpsAuditSummary(null)
    setOpsAuditLoadedForToken("")
    setOpsAuditState("idle")
    setOpsAuditError("")
    setCancellationReasonSummary(null)
    setCancellationReasonLoadedForToken("")
    setCancellationReasonState("idle")
    setCancellationReasonError("")
    setSupportReportSummary(null)
    setSupportReports(null)
    setSupportReportsLoadedForToken("")
    setSupportReportsState("idle")
    setSupportReportsError("")
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
      void refreshCloudLearningMemoryControls(saved)
      void refreshImportOps(saved)
      void refreshCostUsageSummary(saved)
      void refreshOpsCockpitSummary(saved)
      void refreshProviderHealthSummary(saved)
      void refreshOpsAuditSummary(saved)
      void refreshCancellationReasonSummary(saved)
      void refreshSupportReports(saved)
      void refreshFeatureFlags(saved)
      saveRoute("/today")
      setMessage("Signed in to Astra Web Companion.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sign-in failed.")
      throw error
    } finally {
      setAuthState("idle")
      setBootState("ready")
    }
  }, [apiBaseUrl, device, refreshAuthenticatedWorkspace, refreshCancellationReasonSummary, refreshCloudAssets, refreshCloudLearningMemoryControls, refreshCostUsageSummary, refreshFeatureFlags, refreshImportOps, refreshOpsAuditSummary, refreshOpsCockpitSummary, refreshProviderHealthSummary, refreshSupportReports, saveRoute]);

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
      void refreshCloudLearningMemoryControls(saved)
      void refreshImportOps(saved)
      void refreshCostUsageSummary(saved)
      void refreshOpsCockpitSummary(saved)
      void refreshSupportReports(saved)
      void refreshProviderHealthSummary(saved)
      void refreshOpsAuditSummary(saved)
      void refreshCancellationReasonSummary(saved)
      void refreshFeatureFlags(saved)
      saveRoute("/today")
      setMessage("Free Astra session is ready. Translation uses the managed Astra relay.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Free start failed.")
      throw error
    } finally {
      setAuthState("idle")
      setBootState("ready")
    }
  }, [apiBaseUrl, device, refreshAuthenticatedWorkspace, refreshCancellationReasonSummary, refreshCloudAssets, refreshCloudLearningMemoryControls, refreshCostUsageSummary, refreshFeatureFlags, refreshImportOps, refreshOpsAuditSummary, refreshOpsCockpitSummary, refreshProviderHealthSummary, refreshSupportReports, saveRoute]);

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
      await refreshCloudLearningMemoryControls(session)
      setMessage(enabled
        ? `Enabled ${collection.replace(/_/g, " ")} cloud sync.`
        : `Disabled ${collection.replace(/_/g, " ")} cloud sync.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Cloud collection preference update failed.")
    }
  }, [device, refreshCloudAssets, refreshCloudLearningMemoryControls, session])

  const handleUpdateWeeklyDigestPreference = useCallback(async (enabled: boolean) => {
    if (!session || session.identityMode !== "authenticated") return
    setWeeklyDigestPreferenceState("saving")
    setMessage("")
    try {
      await updateWebWeeklyDigestPreference({ session, device, enabled })
      await refreshCloudLearningMemoryControls(session)
      setMessage(enabled ? "Weekly digest is on." : "Weekly digest is off. You can turn it back on anytime.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Weekly digest preference update failed.")
    } finally {
      setWeeklyDigestPreferenceState("idle")
    }
  }, [device, refreshCloudLearningMemoryControls, session])

  const handleDeleteCloudLearningMemory = useCallback(async () => {
    if (!session || session.identityMode !== "authenticated") return
    const confirmed = typeof window !== "undefined" && typeof window.confirm === "function"
      ? window.confirm("Delete Astra cloud learning memory now? This clears cloud sync rows and digest archives for this account. It does not delete local browser data or create third-party service deletion receipts.")
      : true
    if (!confirmed) return

    setCloudLearningMemoryDeleteState("deleting")
    setCloudLearningMemoryError("")
    setMessage("")
    try {
      const receipt = await deleteWebCloudLearningMemory({ session, device })
      setCloudLearningMemoryReceipt(receipt)
      await refreshCloudLearningMemoryControls(session)
      await refreshCloudAssets(session)
      setMessage(`Cloud learning memory deleted: ${formatNumber(receipt.totals.clearedActiveCount)} active record${receipt.totals.clearedActiveCount === 1 ? "" : "s"} cleared. Local browser data was not changed.`)
    } catch (error) {
      setCloudLearningMemoryError(error instanceof Error ? error.message : "Cloud learning-memory deletion failed.")
    } finally {
      setCloudLearningMemoryDeleteState("idle")
    }
  }, [device, refreshCloudAssets, refreshCloudLearningMemoryControls, session])

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

  const handleUpdateSupportReportTriage = useCallback(async (reportId: string, patch: {
    status?: WebSupportReportTriageStatus
    priority?: WebSupportReportTriagePriority
    assignedTo?: string | null
    resolution?: string | null
    updatedBy?: string | null
    followUp?: {
      path?: WebSupportReportFollowUpPath
      status?: WebSupportReportFollowUpStatus
      macroId?: string | null
      reason?: WebSupportReportFollowUpReason | null
      updatedBy?: string | null
    }
  }) => {
    if (!session || !operatorToken.trim()) {
      setMessage("Enter an operator token before updating support report triage.")
      return
    }

    try {
      await updateWebSupportReportTriage({
        baseURL: session.relayBaseURL,
        operatorToken: operatorToken.trim(),
        reportId,
        patch,
      })
      await refreshSupportReports(session, operatorToken.trim())
      setMessage(`Updated support report ${reportId} triage.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Support report triage update failed.")
    }
  }, [operatorToken, refreshSupportReports, session])

  const handleUpdateFeatureFlagKillSwitch = useCallback(async (rule: {
    id: string
    category: WebKillSwitchCategory
    enabled: boolean
    reason: string
    fallbackMessage: string
    safeMode: boolean
    changedBy: string
  }) => {
    if (!session || !operatorToken.trim()) {
      setMessage("Enter an operator token before updating feature flags.")
      return
    }
    const id = rule.id.trim()
    const reason = rule.reason.trim()
    const fallbackMessage = rule.fallbackMessage.trim()
    if (!id || !reason || !fallbackMessage) {
      setMessage("Kill-switch id, reason, and fallback message are required.")
      return
    }

    const current = featureFlagRuntime ?? await fetchWebFeatureFlagRuntime({ baseURL: session.relayBaseURL })
    const generatedAt = new Date().toISOString()
    const nextRule = {
      id,
      category: rule.category,
      enabled: rule.enabled,
      reason,
      fallbackMessage,
      safeMode: rule.safeMode,
    }
    const replaced = current.killSwitches.some((candidate) => candidate.id === id)
    const nextKillSwitches = replaced
      ? current.killSwitches.map((candidate) => candidate.id === id ? nextRule : candidate)
      : [nextRule, ...current.killSwitches]
    const nextRuntime: WebFeatureFlagRuntime = {
      schema: "astra-feature-flag-runtime.v1",
      generatedAt,
      overrides: current.overrides,
      killSwitches: nextKillSwitches,
      changeLog: [{
        id: `ffdraft_${Date.now()}`,
        changedAt: generatedAt,
        changedBy: rule.changedBy.trim() || "operator",
        reason,
        overrideCount: current.overrides.length,
        killSwitchCount: nextKillSwitches.length,
        previousGeneratedAt: current.generatedAt,
      }, ...current.changeLog].slice(0, 50),
    }

    try {
      const updated = await updateWebFeatureFlagRuntime({
        baseURL: session.relayBaseURL,
        operatorToken: operatorToken.trim(),
        runtime: nextRuntime,
      })
      setFeatureFlagRuntime(updated)
      setFeatureFlagsState("ready")
      setFeatureFlagsError("")
      setMessage(`Updated kill switch ${id}${rule.changedBy.trim() ? ` by ${rule.changedBy.trim()}` : ""}.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Feature-flag runtime update failed.")
    }
  }, [featureFlagRuntime, operatorToken, session])

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

  const recordTrialIntent = useCallback(async () => {
    if (!session) return
    setTrialIntentState("recording")
    try {
      const lifecycle = await createWebTrialIntent({ session, device })
      setTrialLifecycle(lifecycle)
      setMessage("Trial interest recorded. Checkout and payment remain unavailable during beta.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Trial interest could not be recorded.")
    } finally {
      setTrialIntentState("idle")
    }
  }, [device, session])

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
        growthLanding={growthLanding}
        onDismissMessage={() => setMessage("")}
        onInstall={async () => {
          recordWebGrowthLandingEvent("landing_install_clicked", growthLanding)
          await installPrompt.promptInstall()
        }}
        onNavigate={saveRoute}
        onStartFree={startFreeSession}
      />
    )
  }

  if (isPublicIntentRoute(route)) {
    const page = PUBLIC_INTENT_PAGES[route]
    return (
      <PublicIntentPage
        page={page}
        route={route}
        authState={authState}
        bootState={bootState}
        message={message}
        canInstall={installPrompt.canInstall}
        onDismissMessage={() => setMessage("")}
        onInstall={async () => {
          recordWebGrowthLandingEvent("landing_install_clicked", {
            kind: route === "/sample" ? "public_sample" : "seo_intent",
            campaign: null,
            intent: page.intent,
          })
          await installPrompt.promptInstall()
        }}
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

            {route === "/today" && (
              <TodayReviewPage
                session={session}
                cloudAssets={cloudAssets}
                cloudState={cloudState}
                cloudError={cloudError}
                onNavigate={saveRoute}
                onRefreshCloudAssets={() => refreshCloudAssets(session)}
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
                cloudLearningMemoryInventory={cloudLearningMemoryInventory}
                cloudLearningMemoryState={cloudLearningMemoryState}
                cloudLearningMemoryError={cloudLearningMemoryError}
                cloudLearningMemoryDeleteState={cloudLearningMemoryDeleteState}
                cloudLearningMemoryReceipt={cloudLearningMemoryReceipt}
                weeklyDigest={weeklyDigest}
                weeklyDigestState={weeklyDigestState}
                weeklyDigestError={weeklyDigestError}
                weeklyDigestPreferenceState={weeklyDigestPreferenceState}
                costUsageSummary={costUsageLoadedForToken === operatorToken.trim() ? costUsageSummary : null}
                costUsageLoadedForToken={costUsageLoadedForToken}
                costUsageState={costUsageState}
                costUsageError={costUsageError}
                opsCockpitSummary={opsCockpitLoadedForToken === operatorToken.trim() ? opsCockpitSummary : null}
                opsCockpitLoadedForToken={opsCockpitLoadedForToken}
                opsCockpitState={opsCockpitState}
                opsCockpitError={opsCockpitError}
                providerHealthSummary={providerHealthLoadedForToken === operatorToken.trim() ? providerHealthSummary : null}
                providerHealthLoadedForToken={providerHealthLoadedForToken}
                providerHealthState={providerHealthState}
                providerHealthError={providerHealthError}
                opsAuditSummary={opsAuditLoadedForToken === operatorToken.trim() ? opsAuditSummary : null}
                opsAuditLoadedForToken={opsAuditLoadedForToken}
                opsAuditState={opsAuditState}
                opsAuditError={opsAuditError}
                cancellationReasonSummary={cancellationReasonLoadedForToken === operatorToken.trim() ? cancellationReasonSummary : null}
                cancellationReasonLoadedForToken={cancellationReasonLoadedForToken}
                cancellationReasonState={cancellationReasonState}
                cancellationReasonError={cancellationReasonError}
                opsUserLookup={opsUserLookupLoadedForToken === operatorToken.trim() ? opsUserLookup : null}
                opsUserLookupLoadedForToken={opsUserLookupLoadedForToken}
                opsUserLookupLoadedForQuery={opsUserLookupLoadedForQuery}
                opsUserLookupState={opsUserLookupState}
                opsUserLookupError={opsUserLookupError}
                supportReportSummary={supportReportsLoadedForToken === operatorToken.trim() ? supportReportSummary : null}
                supportReports={supportReportsLoadedForToken === operatorToken.trim() ? supportReports : null}
                supportReportsState={supportReportsState}
                supportReportsError={supportReportsError}
                featureFlagRuntime={featureFlagRuntime}
                featureFlagsState={featureFlagsState}
                featureFlagsError={featureFlagsError}
                operatorToken={operatorToken}
                onOperatorTokenChange={handleOperatorTokenChange}
                storageHealth={storageHealth}
                storageHealthState={storageHealthState}
                storageHealthError={storageHealthError}
                recoveryState={recoveryState}
                lastWorkspaceRefreshAt={lastWorkspaceRefreshAt}
                onRefresh={refreshAll}
                onRefreshCloudAssets={() => refreshCloudAssets(session)}
                onRefreshImportOps={() => refreshImportOps(session)}
                onRefreshCloudLearningMemory={() => refreshCloudLearningMemoryControls(session)}
                onDeleteCloudLearningMemory={handleDeleteCloudLearningMemory}
                onUpdateWeeklyDigestPreference={handleUpdateWeeklyDigestPreference}
                onRefreshCostUsage={() => refreshCostUsageSummary(session)}
                onRefreshOpsCockpit={() => refreshOpsCockpitSummary(session)}
                onRefreshProviderHealth={() => refreshProviderHealthSummary(session)}
                onRefreshOpsAudit={() => refreshOpsAuditSummary(session)}
                onRefreshCancellationReasons={() => refreshCancellationReasonSummary(session)}
                onLookupOpsUser={(query) => lookupOpsUser(session, query)}
                onRefreshSupportReports={() => refreshSupportReports(session)}
                onRefreshFeatureFlags={() => refreshFeatureFlags(session)}
                onImportLocalLibraryMetadata={handleImportLocalLibraryMetadata}
                onReplayImportFailures={handleReplayImportFailures}
                onUpdateSupportReportTriage={handleUpdateSupportReportTriage}
                onUpdateFeatureFlagKillSwitch={handleUpdateFeatureFlagKillSwitch}
                onToggleCloudCollection={handleToggleCloudCollection}
                onRefreshStorageHealth={refreshStorageHealth}
                onRepairStorage={handleRepairStorage}
                onResetStorage={handleResetStorage}
                onRevokeDevice={handleRevokeDevice}
                onSignIn={signIn}
                onBilling={launchBilling}
                trialLifecycle={trialLifecycle}
                trialIntentState={trialIntentState}
                onTrialIntent={recordTrialIntent}
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

function PublicIntentPage(props: {
  page: (typeof PUBLIC_INTENT_PAGES)[PublicIntentRoute]
  route: PublicIntentRoute
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
  const isBusy = props.bootState === "loading" || props.authState !== "idle"

  const startFree = useCallback(async () => {
    setError("")
    try {
      await props.onStartFree()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Free start failed.")
    }
  }, [props])

  return (
    <div className="public-site public-site--intent">
      <header className="public-nav">
        <button type="button" className="public-brand" onClick={() => props.onNavigate("/")}>
          <span className="brand-mark">A</span>
          <span>
            <strong>Astra</strong>
            <small>AI language companion</small>
          </span>
        </button>
        <nav className="public-nav-actions" aria-label="Astra public intent navigation">
          <button type="button" className="button ghost" onClick={() => props.onNavigate("/sample")}>Sample</button>
          <button type="button" className="button ghost" onClick={() => props.onNavigate("/learn/read-english-webpages")}>Read English</button>
          <button type="button" className="button secondary" onClick={() => props.onNavigate("/sign-in")}>Sign in</button>
        </nav>
      </header>

      {props.message && (
        <div className="public-message">
          <span>{props.message}</span>
          <button type="button" className="banner-dismiss" onClick={props.onDismissMessage}>Dismiss</button>
        </div>
      )}

      <main>
        <section className="public-hero">
          <div className="public-hero-copy">
            <div className="eyebrow">{props.page.eyebrow}</div>
            <h1>{props.page.title}</h1>
            <p>{props.page.copy}</p>
            <div className="hero-actions">
              <button type="button" className="button primary large-button" onClick={() => void startFree()} disabled={isBusy}>
                {props.authState === "signing-in" ? "Starting..." : "Start free sample"}
              </button>
              <button type="button" className="button secondary large-button" onClick={() => void props.onInstall()} disabled={isBusy}>
                Install / open Astra
              </button>
              <button type="button" className="button ghost large-button" onClick={() => props.onNavigate("/sign-in")} disabled={isBusy}>
                Sign in to sync
              </button>
            </div>
            {(error || props.bootState === "loading") && (
              <div className={error ? "error-note" : "helper-copy"} role={error ? "alert" : "status"} aria-live={error ? "assertive" : "polite"}>
                {error || "Checking for an existing Astra session..."}
              </div>
            )}
            <div className="public-proof-strip" aria-label="Safe public route proof">
              <span>{props.route}</span>
              <span>public without auth</span>
              <span>static demo copy only</span>
            </div>
          </div>

          <div className="public-marginalia-card" aria-label="Zero-config static Astra sample">
            <div className="sample-status-pill"><span /> Zero-config static sample</div>
            <div className="sample-meta">
              <span>Demo article</span>
              <span>No private content</span>
              <span>EN → 中文</span>
            </div>
            <h2>A safe sample reading card</h2>
            <div className="bilingual-paragraph">
              <p className="source-copy">
                A quiet learner can read a real paragraph, keep the original words visible, and save one useful expression for review.
              </p>
              <p className="translation-margin">
                学习者可以阅读一段真实感的示例文字，保留原文可见，并保存一个有用表达用于复习。
              </p>
            </div>
            <div className="saved-word-row" aria-label="Static saved expression sample">
              <span className="saved-word-chip">quiet learner · 安静的学习者</span>
              <span className="sample-footnote">Demo-only snippet · not user content · no query text</span>
            </div>
          </div>
        </section>

        <section className="public-section" aria-label="Intent route details">
          <div className="section-kicker">
            <div className="eyebrow">What this page proves</div>
            <h2>Public copy for high-intent learners, not public user pages.</h2>
            <p>These pages explain Astra use cases with static product copy. They do not collect, display, host, or index saved user sentences, reading history, private URLs, or query text.</p>
          </div>
          <div className="public-feature-grid">
            {props.page.bullets.map((item) => (
              <article key={item} className="public-feature">
                <h3>{item}</h3>
                <p>Start from this public page, then continue inside Astra with your own private workspace.</p>
              </article>
            ))}
          </div>
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
  growthLanding: GrowthLandingContext
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
  const isSentenceShareLanding = props.growthLanding.kind === "sentence_card"
  const isReferralLanding = props.growthLanding.kind === "referral"
  const heroEyebrow = isSentenceShareLanding
    ? "Shared sentence card · zero-config sample"
    : isReferralLanding
      ? "Friend invite · zero-config sample"
      : "Zero-config AI language learning"
  const heroTitle = isSentenceShareLanding
    ? "Someone shared an Astra sentence card. Try the learning loop behind it."
    : isReferralLanding
      ? "A friend invited you to try Astra on a sample page."
      : "Learn from the English you already read and watch."
  const heroCopy = isSentenceShareLanding
    ? "Astra turns a sentence into context you can understand, save, and review. This landing page does not host the shared text; it just lets you try the same private learning flow."
    : isReferralLanding
      ? "Start with a guided sample: understand one sentence, save it, and complete a one-card review without configuring AI. Referral rewards are not active in this MVP."
      : "Astra turns websites and supported videos into bilingual reading, saved expressions, and daily review — no API setup required."
  const landingTrustBullets = [
    "不需要 API",
    "不需要配置模型",
    "你可以删除学习数据",
    "默认不上传不必要内容",
    "只保存你主动保存的学习片段",
  ]

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
          <button type="button" className="button ghost" onClick={() => props.onNavigate("/sample")}>
            Sample
          </button>
          <button type="button" className="button ghost" onClick={() => props.onNavigate("/articles")}>
            Reader
          </button>
          <button type="button" className="button ghost" onClick={() => props.onNavigate("/today")}>
            Review
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
            <div className="eyebrow">{heroEyebrow}</div>
            <h1>{heroTitle}</h1>
            <p>{heroCopy}</p>
            <div className="hero-actions">
              <button type="button" className="button primary large-button" onClick={() => void startFree()} disabled={isBusy}>
                {props.authState === "signing-in" ? "Starting..." : "Start free sample"}
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
              <span>No API setup</span>
              <span>Saved expressions</span>
              <span>Daily review</span>
            </div>
            <div className="public-trust-row" aria-label="Astra trust promises">
              {landingTrustBullets.map((bullet) => (
                <span key={bullet}>{bullet}</span>
              ))}
            </div>
          </div>

          <div className="public-product-stage" aria-label="Astra product preview">
            <div className="public-browser-mock">
              <div className="browser-bar" aria-hidden="true">
                <span />
                <span />
                <span />
                <strong>astra://web-learning</strong>
              </div>
              <div className="public-marginalia-card" aria-label="Static Astra bilingual reading preview">
                <div className="sample-status-pill"><span /> Bilingual reading</div>
                <div className="sample-meta">
                  <span>Public article</span>
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
                <div className="saved-word-row" aria-label="Decorative saved word sample">
                  <span className="saved-word-chip">marginalia · 眉批</span>
                  <span className="sample-footnote">已加入今日复习 · Review 3 now</span>
                </div>
              </div>
            </div>
            <div className="public-product-stack" aria-label="Astra learning loop preview">
              <article className="product-mini-card video">
                <span className="mini-kicker">Supported video · best-effort</span>
                <strong>YouTube · 03:24</strong>
                <p>Save a subtitle line with timestamp context.</p>
              </article>
              <article className="product-mini-card review">
                <span className="mini-kicker">Today Review</span>
                <strong>3 cards ready</strong>
                <p>Again · Good · Easy</p>
              </article>
              <article className="product-mini-card ai">
                <span className="mini-kicker">Astra AI</span>
                <strong>Zero setup</strong>
                <p>Astra chooses the reading path. You just read.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="public-section">
          <div className="section-kicker">
            <div className="eyebrow">How Astra feels</div>
            <h2>Capture from the web. Review when you have a minute.</h2>
          </div>
          <div className="public-feature-grid">
            {[
              ["Read", "Translate supported webpages into a calm bilingual layout without asking users to pick models or API keys."],
              ["Save", "Keep the useful word, sentence, or video moment with its source context attached."],
              ["Review", "Turn real reading and supported video moments into lightweight cards for daily practice."],
            ].map(([title, copy]) => (
              <article key={title} className="public-feature">
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="public-section" aria-labelledby="permission-trust-title">
          <div className="section-kicker">
            <div className="eyebrow">{ASTRA_WEB_PERMISSION_TRUST.eyebrow}</div>
            <h2 id="permission-trust-title">{ASTRA_WEB_PERMISSION_TRUST.title}</h2>
            <p>{ASTRA_WEB_PERMISSION_TRUST.copy}</p>
          </div>
          <div className="public-feature-grid">
            {ASTRA_WEB_PERMISSION_TRUST.rows.map((row) => (
              <article key={row.permission} className="public-feature">
                <h3>{row.label}</h3>
                <p>{row.userFacingCopy}</p>
                <p className="helper-copy">{row.boundary}</p>
              </article>
            ))}
          </div>
          <div className="hero-actions" aria-label="Astra trust links">
            <a className="button secondary" href="https://github.com/nicepkg/astra/blob/main/store/privacy-policy.md" target="_blank" rel="noreferrer">
              {ASTRA_WEB_PERMISSION_TRUST.privacyLinkLabel}
            </a>
            <a className="button ghost" href="https://github.com/nicepkg/astra/issues" target="_blank" rel="noreferrer">
              {ASTRA_WEB_PERMISSION_TRUST.supportLinkLabel}
            </a>
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
              <button type="button" className="button primary full-width" onClick={() => props.onNavigate("/today")}>
                Open Today Review
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

function TodayReviewPage(props: {
  session: AstraSession | null
  cloudAssets: WebCloudAssetsWorkspace | null
  cloudState: "idle" | "loading" | "ready" | "error"
  cloudError: string
  onNavigate: (route: AppRoute) => void
  onRefreshCloudAssets: () => Promise<void>
}) {
  const cards = useMemo(() => (
    props.cloudState === "loading" && !props.cloudAssets ? [] : buildMobileReviewCards(props.cloudAssets)
  ), [props.cloudAssets, props.cloudState])
  const [answered, setAnswered] = useState(false)
  const [completedIds, setCompletedIds] = useState<Set<string>>(() => readTodayMobileReviewCardIds())
  const [queuedEvents, setQueuedEvents] = useState<MobileQueuedReviewEvent[]>(() => readQueuedMobileReviewEvents())
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    setAnswered(false)
    setCompletedIds(readTodayMobileReviewCardIds())
    setQueuedEvents(readQueuedMobileReviewEvents())
  }, [cards])

  const activeCards = cards.filter((card) => !completedIds.has(card.id))
  const currentCard = activeCards[0]
  const completedCount = Math.max(0, cards.length - activeCards.length)
  const isSampleDeck = cards.every((card) => card.sample)
  const isInitialCloudLoading = props.cloudState === "loading" && !props.cloudAssets
  const sourceSummary = summarizeMobileReviewSources(cards)

  // Review-mode parity with the extension: a word saved with its sentence becomes
  // a cloze (recall the word from context); a short phrase with a real meaning
  // becomes reverse recall (show the meaning, recall the phrase).
  const reviewClozePrompt = currentCard && currentCard.type === "word" && currentCard.context
    ? buildClozeFromSentence(currentCard.context, currentCard.front)
    : null
  const reverseFrontTokens = currentCard ? currentCard.front.trim().split(/\s+/).filter(Boolean).length : 0
  const showReverseRecall = Boolean(currentCard)
    && !reviewClozePrompt
    && reverseFrontTokens >= 2
    && reverseFrontTokens <= 4
    && currentCard!.translation.trim().length > 0
    && currentCard!.translation !== "Saved for review."

  // Dictation: hear the saved English sentence (or term) via the browser's
  // built-in TTS. The web PWA has no managed TTS, so we use the browser engine.
  const dictationText = currentCard ? (currentCard.context?.trim() || currentCard.front) : ""
  const canDictate = dictationText.length > 0 && isTtsSupported("browser")

  const reviewCard = useCallback((rating: MobileReviewRating) => {
    if (!currentCard) return
    if (!currentCard.sample) {
      const nextEvents = appendQueuedMobileReviewEvent(currentCard.id, rating)
      setQueuedEvents(nextEvents)
    }
    setCompletedIds((current) => {
      const next = new Set(current)
      next.add(currentCard.id)
      return next
    })
    setAnswered(false)
  }, [currentCard])

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await props.onRefreshCloudAssets()
    } finally {
      setRefreshing(false)
    }
  }, [props])

  if (!props.session) {
    return (
      <section className="card mobile-review-card mobile-review-gate">
        <div className="eyebrow">Astra Mobile Review Companion</div>
        <h2>Sign in to review the words and sentences you saved on the web.</h2>
        <p className="card-copy">Mobile is for habit: a short, source-backed review when you have a few quiet minutes.</p>
        <button type="button" className="button primary" onClick={() => props.onNavigate("/sign-in")}>
          Sign in
        </button>
      </section>
    )
  }

  return (
    <div className="mobile-review-shell">
      <section className="mobile-review-hero card" aria-labelledby="today-review-title">
        <div className="mobile-review-date">{new Intl.DateTimeFormat(undefined, { weekday: "long", month: "short", day: "numeric" }).format(new Date())}</div>
        <div className="eyebrow">Today Review</div>
        <h2 id="today-review-title">
          {isInitialCloudLoading
            ? "Bringing in your saved words."
            : currentCard
            ? isSampleDeck
              ? `${activeCards.length} sample ${activeCards.length === 1 ? "card is" : "cards are"} ready.`
              : `${activeCards.length} ${activeCards.length === 1 ? "card is" : "cards are"} ready from your web reading.`
            : "Done for today."}
        </h2>
        <p className="card-copy">
          {isInitialCloudLoading
            ? "Astra is syncing your source-backed review cards."
            : currentCard
            ? isSampleDeck
              ? "Try a short sample review while your saved web words are syncing."
              : "Review in about 3 minutes. No setup, no pressure — just keep useful expressions fresh. Saved cards are ready from your web reading."
            : "Come back tomorrow for a quick refresh, or browse your saved learning library."}
        </p>
        <div className="visually-hidden" aria-live="polite">
          {currentCard ? `${currentCard.type} card: ${currentCard.front}` : "Today Review complete"}
        </div>
        <div className="mobile-review-summary" aria-label="Review source summary">
          <span>{sourceSummary}</span>
          <span>{isSampleDeck ? "sample deck" : "synced from Astra"}</span>
          <span>{queuedEvents.length} offline-ready actions</span>
        </div>
        <div className="mobile-review-progress" aria-label={`${completedCount} of ${cards.length} cards completed`}>
          {cards.map((card, index) => (
            <span key={card.id} className={index < completedCount ? "is-complete" : ""} />
          ))}
        </div>
      </section>

      {props.cloudState === "loading" && !props.cloudAssets && (
        <section className="card subtle" role="status" aria-live="polite">
          Bringing in your saved words…
        </section>
      )}

      {props.cloudState === "error" && (
        <section className="card callout warning">
          <div className="card-title">Review is using what is available on this device.</div>
          <div className="card-copy">{props.cloudError || "Cloud cards could not refresh right now."}</div>
          <button type="button" className="button secondary" onClick={() => void refresh()} disabled={refreshing}>
            {refreshing ? "Refreshing…" : "Retry sync"}
          </button>
        </section>
      )}

      {currentCard ? (
        <section className={`mobile-review-card card${answered ? " is-answer-visible" : ""}`} aria-label={`${currentCard.type} review card`}>
          <div className="mobile-source-row">
            <span className="source-badge">{currentCard.sourceKind}</span>
            <span>From: {currentCard.sourceTitle}</span>
          </div>

          <div className="mobile-card-face">
            <div className="mobile-card-kind">{reviewClozePrompt ? "Fill in the blank" : showReverseRecall ? "Recall the phrase" : currentCard.type === "sentence" ? "Sentence Card" : "Word Card"}</div>
            <h3 data-testid="mobile-review-front">{reviewClozePrompt ? reviewClozePrompt.prompt : showReverseRecall ? currentCard.translation : currentCard.front}</h3>
            {!reviewClozePrompt && !showReverseRecall && currentCard.context && currentCard.context !== currentCard.front && (
              <p className="mobile-card-context">“{currentCard.context}”</p>
            )}
          </div>

          {canDictate && (
            <button
              type="button"
              className="button secondary mobile-listen"
              data-testid="mobile-review-listen"
              onClick={() => { speak(dictationText, { engine: "browser", lang: "en" }) }}
            >
              Listen
            </button>
          )}

          {answered ? (
            <div className="mobile-card-answer">
              {(reviewClozePrompt || showReverseRecall) && (
                <>
                  <div className="mobile-answer-label">Answer</div>
                  <p data-testid="mobile-review-answer">{currentCard.front}</p>
                </>
              )}
              <div className="mobile-answer-label">Meaning</div>
              <p>{currentCard.translation}</p>
              <div className="mobile-answer-label">Why it matters</div>
              <p>{currentCard.explanation}</p>
              <div className="mobile-rating-row" aria-label="Rate this review card">
                <button type="button" className="button secondary" onClick={() => reviewCard("again")}>Again</button>
                <button type="button" className="button primary" onClick={() => reviewCard("good")}>Good</button>
                <button type="button" className="button secondary" onClick={() => reviewCard("easy")}>Easy</button>
              </div>
            </div>
          ) : (
            <button type="button" className="button primary mobile-show-answer" onClick={() => setAnswered(true)}>
              Show answer
            </button>
          )}
        </section>
      ) : (
        <section className="mobile-review-complete card">
          <div className="completion-stamp" aria-hidden="true">Done</div>
          <h2>Done for today.</h2>
          <p className="card-copy">Your review choices are saved on this device and ready to sync when the review-event spine lands.</p>
          <div className="row gap wrap">
            <button type="button" className="button primary" onClick={() => props.onNavigate("/assets")}>
              View Library
            </button>
            <button type="button" className="button secondary" onClick={() => void refresh()} disabled={refreshing}>
              {refreshing ? "Refreshing…" : "Refresh cards"}
            </button>
          </div>
        </section>
      )}

      <section className="mobile-review-library card subtle">
        <div className="section-heading">
          <div>
            <div className="card-title">Learning Library preview</div>
            <div className="card-copy">Words and sentences stay source-backed, not random flashcards.</div>
          </div>
          <button type="button" className="button ghost compact-button" onClick={() => props.onNavigate("/assets")}>
            Open Library
          </button>
        </div>
        <div className="stack list">
          {cards.slice(0, 3).map((card) => (
            <div key={`library-${card.id}`} className="mobile-library-row">
              <strong>{card.front}</strong>
              <small>{card.translation}</small>
              <small>{card.sourceTitle} · {card.sourceKind}</small>
            </div>
          ))}
        </div>
      </section>
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
      detail: "Inspect session state, entitlements, usage, beta limits, devices, and cloud continuity surfaces.",
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
            <button type="button" className="button primary" onClick={() => props.onNavigate("/today")}>
              Open Today Review
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
  const assetTiles: AssetTile[] = certMode ? ASTRA_CERT_ASSET_TILES : [
    ...importLibrary.map((entry): AssetTile => ({
      id: `local-${entry.id}`,
      title: entry.title,
      meta: entry.summary,
      route: entry.route,
      tone: "local",
    })),
    ...cloudLibraryItems.slice(0, 6).map((entry): AssetTile => ({
      id: `cloud-library-${entry.id}`,
      title: entry.title,
      meta: `${entry.kind.replace(/-/g, " ")} · ${entry.summary}`,
      route: entry.route,
      tone: "history",
    })),
    ...readingHistoryEntries.slice(0, 4).map((entry): AssetTile => ({
      id: `history-${entry.id}`,
      title: entry.title,
      meta: `${entry.hostname} · ${formatNumber(entry.wordsTranslated)} words`,
      route: "/articles",
      tone: "history",
    })),
    ...vocabularyEntries.slice(0, 4).map((entry): AssetTile => ({
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

const SUPPORT_TRIAGE_STATUS_OPTIONS: WebSupportReportTriageStatus[] = [
  "new",
  "investigating",
  "waiting_for_user",
  "linked_known_issue",
  "resolved",
  "wont_fix",
]

const SUPPORT_TRIAGE_PRIORITY_OPTIONS: WebSupportReportTriagePriority[] = ["low", "normal", "high", "urgent"]
const KILL_SWITCH_CATEGORY_OPTIONS: WebKillSwitchCategory[] = ["feature", "site", "task", "tier", "provider", "privacy"]

function sanitizeNullableText(value: string): string | null {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function SupportReportTriageRow(props: {
  report: WebSupportReportListEntry
  operatorToken: string
  onUpdate: (reportId: string, patch: {
    status?: WebSupportReportTriageStatus
    priority?: WebSupportReportTriagePriority
    assignedTo?: string | null
    resolution?: string | null
    updatedBy?: string | null
    followUp?: {
      path?: WebSupportReportFollowUpPath
      status?: WebSupportReportFollowUpStatus
      macroId?: string | null
      reason?: WebSupportReportFollowUpReason | null
      updatedBy?: string | null
    }
  }) => Promise<void>
}) {
  const reportFollowUp = useMemo(() => props.report.triage.followUp ?? {
    path: "not_selected" as const,
    status: "not_started" as const,
    macroId: null,
    reason: null,
    updatedAt: null,
    updatedBy: null,
  }, [props.report.triage.followUp])
  const [status, setStatus] = useState<WebSupportReportTriageStatus>(props.report.triage.status)
  const [priority, setPriority] = useState<WebSupportReportTriagePriority>(props.report.triage.priority)
  const [assignedTo, setAssignedTo] = useState(props.report.triage.assignedTo ?? "")
  const [resolution, setResolution] = useState(props.report.triage.resolution ?? "")
  const [updatedBy, setUpdatedBy] = useState(props.report.triage.updatedBy ?? "")
  const [followUpPath, setFollowUpPath] = useState<WebSupportReportFollowUpPath>(reportFollowUp.path)
  const [followUpStatus, setFollowUpStatus] = useState<WebSupportReportFollowUpStatus>(reportFollowUp.status)
  const [followUpMacroId, setFollowUpMacroId] = useState(reportFollowUp.macroId ?? props.report.recommendedMacro?.id ?? "")
  const [followUpReason, setFollowUpReason] = useState<WebSupportReportFollowUpReason | "">(reportFollowUp.reason ?? "")

  useEffect(() => {
    setStatus(props.report.triage.status)
    setPriority(props.report.triage.priority)
    setAssignedTo(props.report.triage.assignedTo ?? "")
    setResolution(props.report.triage.resolution ?? "")
    setUpdatedBy(props.report.triage.updatedBy ?? "")
    const nextFollowUp = props.report.triage.followUp ?? reportFollowUp
    setFollowUpPath(nextFollowUp.path)
    setFollowUpStatus(nextFollowUp.status)
    setFollowUpMacroId(nextFollowUp.macroId ?? props.report.recommendedMacro?.id ?? "")
    setFollowUpReason(nextFollowUp.reason ?? "")
  }, [props.report, reportFollowUp])

  return (
    <div className="card subtle">
      <div className="section-heading compact-heading">
        <div>
          <div className="card-title">{props.report.reportId}</div>
          <div className="card-copy">
            {props.report.featureSurface} · {props.report.action} · {props.report.hostname ?? "hostname unavailable"}
          </div>
        </div>
        <span className="status-pill">{props.report.triage.status}</span>
      </div>
      <div className="helper-copy">
        Submitted {formatRelativeDate(props.report.submittedAt)} · {props.report.browser} · {props.report.os} · {props.report.locale} · privacy {props.report.privacyMode ? "on" : "off"}
      </div>
      <div className="helper-copy">
        Issue {props.report.issueCategory ?? "uncategorized"} · error {props.report.errorCategory ?? props.report.lastErrorCategory ?? "none"} · known issue {props.report.knownIssue?.issueId ?? "none"}
      </div>
      <div className="helper-copy">
        Follow-up {reportFollowUp.path} · {reportFollowUp.status} · macro {reportFollowUp.macroId ?? props.report.recommendedMacro?.id ?? "not selected"}
      </div>
      {props.report.recommendedMacro && (
        <div className="helper-copy">Recommended macro: {props.report.recommendedMacro.title}</div>
      )}

      <div className="grid cards-2 compact" style={{ marginTop: "1rem" }}>
        <label className="field">
          <span>Triage status</span>
          <select value={status} onChange={(event) => setStatus(event.target.value as WebSupportReportTriageStatus)}>
            {SUPPORT_TRIAGE_STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Triage priority</span>
          <select value={priority} onChange={(event) => setPriority(event.target.value as WebSupportReportTriagePriority)}>
            {SUPPORT_TRIAGE_PRIORITY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Assigned to</span>
          <input value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)} placeholder="support@astra.local" />
        </label>
        <label className="field">
          <span>Updated by</span>
          <input value={updatedBy} onChange={(event) => setUpdatedBy(event.target.value)} placeholder="ops name or email" />
        </label>
      </div>
      <label className="field" style={{ marginTop: "0.75rem" }}>
        <span>Resolution</span>
        <textarea value={resolution} onChange={(event) => setResolution(event.target.value)} placeholder="Short internal resolution note; do not paste page text or user content." rows={2} />
      </label>
      <div className="grid cards-2 compact" style={{ marginTop: "0.75rem" }}>
        <label className="field">
          <span>Follow-up path</span>
          <select value={followUpPath} onChange={(event) => setFollowUpPath(event.target.value as WebSupportReportFollowUpPath)}>
            {SUPPORT_FOLLOW_UP_PATH_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Follow-up status</span>
          <select value={followUpStatus} onChange={(event) => setFollowUpStatus(event.target.value as WebSupportReportFollowUpStatus)}>
            {SUPPORT_FOLLOW_UP_STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Selected macro</span>
          <input value={followUpMacroId} onChange={(event) => setFollowUpMacroId(event.target.value)} placeholder={props.report.recommendedMacro?.id ?? "macro id or blank"} />
        </label>
        <label className="field">
          <span>Follow-up reason</span>
          <select value={followUpReason} onChange={(event) => setFollowUpReason(event.target.value as WebSupportReportFollowUpReason | "")}>
            <option value="">none</option>
            {SUPPORT_FOLLOW_UP_REASON_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
      </div>
      <div className="row gap wrap">
        <button
          type="button"
          className="button primary"
          onClick={() => void props.onUpdate(props.report.reportId, {
            status,
            priority,
            assignedTo: sanitizeNullableText(assignedTo),
            resolution: sanitizeNullableText(resolution),
            updatedBy: sanitizeNullableText(updatedBy),
          })}
          disabled={!props.operatorToken.trim()}
        >
          Save triage
        </button>
        <button
          type="button"
          className="button secondary"
          onClick={() => void props.onUpdate(props.report.reportId, {
            updatedBy: sanitizeNullableText(updatedBy),
            followUp: {
              path: followUpPath,
              status: followUpStatus,
              macroId: sanitizeNullableText(followUpMacroId),
              reason: followUpReason || null,
              updatedBy: sanitizeNullableText(updatedBy),
            },
          })}
          disabled={!props.operatorToken.trim()}
        >
          Save handoff
        </button>
        <span className="helper-copy">Metadata only: no page text, transcript, screenshot, or user message content is shown here.</span>
      </div>
    </div>
  )
}

function FeatureFlagOpsCard(props: {
  runtime: WebFeatureFlagRuntime | null
  state: "idle" | "loading" | "ready" | "error"
  error: string
  operatorToken: string
  onRefresh: () => Promise<void>
  onUpdateKillSwitch: (rule: {
    id: string
    category: WebKillSwitchCategory
    enabled: boolean
    reason: string
    fallbackMessage: string
    safeMode: boolean
    changedBy: string
  }) => Promise<void>
}) {
  const [enabled, setEnabled] = useState(true)
  const [safeMode, setSafeMode] = useState(true)
  const [category, setCategory] = useState<WebKillSwitchCategory>("feature")
  const [id, setId] = useState("incident-fallback-copy")
  const [reason, setReason] = useState("")
  const [fallbackMessage, setFallbackMessage] = useState("Astra is temporarily using a simpler response for this feature. Please try again later.")
  const [changedBy, setChangedBy] = useState("")

  const recentChangeLog = props.runtime?.changeLog.slice(0, 3) ?? []

  return (
    <section className="card">
      <div className="section-heading">
        <div>
          <div className="card-title">Feature flags / kill switches</div>
          <div className="card-copy">Runtime manifest and compact incident update controls for safe fallback-copy kill switches.</div>
        </div>
        <button type="button" className="button ghost" onClick={() => void props.onRefresh()} disabled={props.state === "loading"}>
          {props.state === "loading" ? "Refreshing…" : "Refresh runtime"}
        </button>
      </div>

      {props.error && <div className="error-note">{props.error}</div>}
      {!props.runtime ? (
        <div className="helper-copy">No feature-flag runtime loaded yet. Refresh to fetch the public runtime manifest.</div>
      ) : (
        <>
          <div className="metrics-grid">
            <MetricCard label="Generated" value={formatRelativeDate(props.runtime.generatedAt)} hint="runtime revision" />
            <MetricCard label="Overrides" value={formatNumber(props.runtime.overrides.length)} hint="remote flag entries" />
            <MetricCard label="Kill switches" value={formatNumber(props.runtime.killSwitches.length)} hint="runtime rules" />
            <MetricCard label="Change log" value={formatNumber(props.runtime.changeLog.length)} hint="recent operator updates" />
          </div>

          <div className="stack list" style={{ marginTop: "1rem" }}>
            {recentChangeLog.length === 0 ? (
              <div className="helper-copy">No change-log entries yet.</div>
            ) : recentChangeLog.map((entry) => (
              <div key={entry.id} className="preview-block">
                <strong>{entry.reason}</strong>{"\n"}
                {entry.changedBy} · {formatRelativeDate(entry.changedAt)} · overrides {formatNumber(entry.overrideCount)} · kill switches {formatNumber(entry.killSwitchCount)}
              </div>
            ))}
          </div>
        </>
      )}

      <div className="grid cards-2 compact" style={{ marginTop: "1rem" }}>
        <label className="field">
          <span>Kill-switch id</span>
          <input value={id} onChange={(event) => setId(event.target.value)} placeholder="incident-fallback-copy" />
        </label>
        <label className="field">
          <span>Category</span>
          <select value={category} onChange={(event) => setCategory(event.target.value as WebKillSwitchCategory)}>
            {KILL_SWITCH_CATEGORY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Reason</span>
          <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Short incident reason" />
        </label>
        <label className="field">
          <span>Changed by</span>
          <input value={changedBy} onChange={(event) => setChangedBy(event.target.value)} placeholder="ops name or email" />
        </label>
      </div>

      <label className="field" style={{ marginTop: "0.75rem" }}>
        <span>Fallback message</span>
        <textarea value={fallbackMessage} onChange={(event) => setFallbackMessage(event.target.value)} rows={2} placeholder="Ordinary user-facing fallback copy." />
      </label>
      <div className="row gap wrap">
        <label className="checkbox-line">
          <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
          <span>Enabled</span>
        </label>
        <label className="checkbox-line">
          <input type="checkbox" checked={safeMode} onChange={(event) => setSafeMode(event.target.checked)} />
          <span>Safe mode</span>
        </label>
        <button
          type="button"
          className="button primary"
          disabled={!props.operatorToken.trim()}
          onClick={() => void props.onUpdateKillSwitch({ id, category, enabled, reason, fallbackMessage, safeMode, changedBy })}
        >
          Save kill switch
        </button>
      </div>
      <div className="helper-copy">Fallback text must be ordinary user-facing copy. Do not include source text, prompts, model output, page content, transcripts, screenshots, or user messages; this update only sends runtime metadata.</div>
    </section>
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
  cloudLearningMemoryInventory: WebCloudLearningMemoryInventory | null
  cloudLearningMemoryState: "idle" | "loading" | "ready" | "error"
  cloudLearningMemoryError: string
  cloudLearningMemoryDeleteState: "idle" | "deleting"
  cloudLearningMemoryReceipt: WebCloudLearningMemoryDeletionReceipt | null
  weeklyDigest: WebWeeklyDigestSnapshot | null
  weeklyDigestState: "idle" | "loading" | "ready" | "error"
  weeklyDigestError: string
  weeklyDigestPreferenceState: "idle" | "saving"
  costUsageSummary: WebCostUsageSummary | null
  costUsageLoadedForToken: string
  costUsageState: "idle" | "loading" | "ready" | "error"
  costUsageError: string
  opsCockpitSummary: WebOpsCockpitSummary | null
  opsCockpitLoadedForToken: string
  opsCockpitState: "idle" | "loading" | "ready" | "error"
  opsCockpitError: string
  providerHealthSummary: WebProviderHealthSummary | null
  providerHealthLoadedForToken: string
  providerHealthState: "idle" | "loading" | "ready" | "error"
  providerHealthError: string
  opsAuditSummary: WebOpsAuditSummary | null
  opsAuditLoadedForToken: string
  opsAuditState: "idle" | "loading" | "ready" | "error"
  opsAuditError: string
  cancellationReasonSummary: WebCancellationReasonSummary | null
  cancellationReasonLoadedForToken: string
  cancellationReasonState: "idle" | "loading" | "ready" | "error"
  cancellationReasonError: string
  opsUserLookup: WebOpsUserLookupSummary | null
  opsUserLookupLoadedForToken: string
  opsUserLookupLoadedForQuery: string
  opsUserLookupState: "idle" | "loading" | "ready" | "error"
  opsUserLookupError: string
  supportReportSummary: WebSupportReportSummary | null
  supportReports: WebSupportReportList | null
  supportReportsState: "idle" | "loading" | "ready" | "error"
  supportReportsError: string
  featureFlagRuntime: WebFeatureFlagRuntime | null
  featureFlagsState: "idle" | "loading" | "ready" | "error"
  featureFlagsError: string
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
  onRefreshCloudLearningMemory: () => Promise<void>
  onDeleteCloudLearningMemory: () => Promise<void>
  onUpdateWeeklyDigestPreference: (enabled: boolean) => Promise<void>
  onRefreshCostUsage: () => Promise<void>
  onRefreshOpsCockpit: () => Promise<void>
  onRefreshProviderHealth: () => Promise<void>
  onRefreshOpsAudit: () => Promise<void>
  onRefreshCancellationReasons: () => Promise<void>
  onLookupOpsUser: (query: string) => Promise<void>
  onRefreshSupportReports: () => Promise<void>
  onRefreshFeatureFlags: () => Promise<void>
  onImportLocalLibraryMetadata: () => Promise<void>
  onReplayImportFailures: (dryRun: boolean) => Promise<void>
  onUpdateSupportReportTriage: (reportId: string, patch: {
    status?: WebSupportReportTriageStatus
    priority?: WebSupportReportTriagePriority
    assignedTo?: string | null
    resolution?: string | null
    updatedBy?: string | null
    followUp?: {
      path?: WebSupportReportFollowUpPath
      status?: WebSupportReportFollowUpStatus
      macroId?: string | null
      reason?: WebSupportReportFollowUpReason | null
      updatedBy?: string | null
    }
  }) => Promise<void>
  onUpdateFeatureFlagKillSwitch: (rule: {
    id: string
    category: WebKillSwitchCategory
    enabled: boolean
    reason: string
    fallbackMessage: string
    safeMode: boolean
    changedBy: string
  }) => Promise<void>
  onToggleCloudCollection: (collection: "reading_history" | "study_progress", enabled: boolean) => Promise<void>
  onRefreshStorageHealth: () => Promise<void>
  onRepairStorage: () => Promise<void>
  onResetStorage: () => Promise<void>
  onRevokeDevice: (deviceId: string) => Promise<void>
  onSignIn: (credentials: { email: string; password: string }) => Promise<void>
  onBilling: (kind: "checkout" | "portal", plan?: AstraPlan) => Promise<void>
  trialLifecycle: WebTrialLifecycleContract | null
  trialIntentState: "idle" | "recording"
  onTrialIntent: () => Promise<void>
}) {
  const [apiBaseUrl, setApiBaseUrl] = useState(props.apiBaseUrl)
  const [email, setEmail] = useState(() => readLastAccountEmail())
  const [opsUserLookupQuery, setOpsUserLookupQuery] = useState("")
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
  const cloudLearningMemoryActiveCount = summarizeCloudMemoryActiveCount(props.cloudLearningMemoryInventory)
  const cloudLearningMemoryMutationCount = props.cloudLearningMemoryInventory?.collections.reduce((sum, collection) => sum + collection.mutationCount, 0) ?? 0
  const weeklyDigestEnabled = props.cloudLearningMemoryInventory?.preferences.weekly_digest ?? false
  const weeklyDigestArchive = props.cloudLearningMemoryInventory?.collections.find((collection) => collection.collection === "weekly_digest_archive") ?? null
  const repairCollectionCount = syncRepairResult ? Object.values(syncRepairResult.collections).length : 0
  const repairRecordCount = syncRepairResult
    ? Object.values(syncRepairResult.collections).reduce((sum, collection) => sum + collection.records.length, 0)
    : 0
  const repairFloorCount = syncRepairResult
    ? Object.values(syncRepairResult.collections).filter((collection) => collection.compactionFloorCursor).length
    : 0
  const visibleCostUsageSummary = props.costUsageLoadedForToken === props.operatorToken.trim()
    ? props.costUsageSummary
    : null
  const visibleOpsCockpitSummary = props.opsCockpitLoadedForToken === props.operatorToken.trim()
    ? props.opsCockpitSummary
    : null
  const visibleProviderHealthSummary = props.providerHealthLoadedForToken === props.operatorToken.trim()
    ? props.providerHealthSummary
    : null
  const visibleOpsAuditSummary = props.opsAuditLoadedForToken === props.operatorToken.trim()
    ? props.opsAuditSummary
    : null
  const visibleCancellationReasonSummary = props.cancellationReasonLoadedForToken === props.operatorToken.trim()
    ? props.cancellationReasonSummary
    : null
  const visibleOpsUserLookup = props.opsUserLookupLoadedForToken === props.operatorToken.trim() && props.opsUserLookupLoadedForQuery === opsUserLookupQuery.trim()
    ? props.opsUserLookup
    : null
  const supportMacroCoverage = props.supportReportSummary?.macroCoverage ?? null
  const supportMacroCoverageRate = supportMacroCoverage?.reportedCoverage.coverageRate ?? null
  const supportMacroTopBucket = supportMacroCoverage?.byIssueCategory.find((bucket) => bucket.count > 0 && bucket.covered) ?? null
  const supportWeeklyTopIssue = props.supportReportSummary?.weeklyTopIssues?.[0] ?? null
  const supportHandoffSummary = props.supportReportSummary?.handoffSummary ?? { byPath: [], byStatus: [] }
  const supportSlaRisk = props.supportReportSummary?.slaRisk ?? null
  const supportStaleTriageCount = supportSlaRisk
    ? supportSlaRisk.staleTriageByAgeBucket.from24hTo72h + supportSlaRisk.staleTriageByAgeBucket.from72hTo168h + supportSlaRisk.staleTriageByAgeBucket.over168h
    : 0
  const supportOldestUnresolvedAge = supportSlaRisk?.oldestUnresolvedAgeDays == null
    ? "—"
    : `${supportSlaRisk.oldestUnresolvedAgeDays}d`
  const supportHandedOffCount = supportHandoffSummary.byStatus.find((bucket) => bucket.status === "handed_off")?.count ?? 0
  const supportCompletedHandoffCount = supportHandoffSummary.byStatus.find((bucket) => bucket.status === "completed")?.count ?? 0
  const providerHealthIncidentCount = visibleProviderHealthSummary?.buckets.filter((bucket) => bucket.healthStatus === "incident").length ?? 0
  const providerHealthWatchCount = visibleProviderHealthSummary?.buckets.filter((bucket) => bucket.healthStatus === "watch").length ?? 0
  const opsCockpitPauseGrowthCount = visibleOpsCockpitSummary?.riskFlags.filter((flag) => flag.severity === "pause_growth").length ?? 0
  const opsCockpitWatchCount = visibleOpsCockpitSummary?.riskFlags.filter((flag) => flag.severity === "watch").length ?? 0
  const opsCockpitDailyReview = visibleOpsCockpitSummary?.reviewCadence.find((item) => item.cadence === "daily") ?? null
  const opsCockpitWeeklyReview = visibleOpsCockpitSummary?.reviewCadence.find((item) => item.cadence === "weekly") ?? null

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
              <div className="card-title">Beta trial interest</div>
              <div className="card-copy">
                Record that you want a trial when billing opens. This does not collect payment, start checkout, change your subscription, or grant Pro access during beta.
              </div>
              {props.trialLifecycle && (
                <div className="helper-copy">
                  Trial status: {props.trialLifecycle.trial.status.replace(/_/g, " ")} · Next step: {props.trialLifecycle.conversion.nextStep.replace(/_/g, " ")}.
                </div>
              )}
              <div className="row gap wrap">
                <button type="button" className="button primary" onClick={() => void props.onTrialIntent()} disabled={props.trialIntentState === "recording"}>
                  {props.trialIntentState === "recording" ? "Recording…" : "Record trial interest"}
                </button>
                <button type="button" className="button secondary" disabled>
                  Checkout unavailable in beta
                </button>
                <button type="button" className="button ghost" disabled>
                  Billing portal unavailable
                </button>
              </div>
              <div className="helper-copy">Beta boundary: no payment collected, no subscription mutation, no trial or Pro entitlement granted.</div>
              <div className="helper-copy">Session expires: {formatRelativeDate(props.session.expiresAt)}</div>
            </div>
          </section>

          <section className="grid cards-2">
            <div className="card" data-testid="cloud-learning-memory-card">
              <div className="section-heading">
                <div>
                  <div className="card-title">Cloud learning memory</div>
                  <div className="card-copy">Review what Astra keeps in your account cloud memory and delete it anytime. This inventory uses counts only — no page text, prompts, full URLs, emails, or device/session ids.</div>
                </div>
                <button type="button" className="button ghost" onClick={() => void props.onRefreshCloudLearningMemory()} disabled={props.cloudLearningMemoryState === "loading"}>
                  {props.cloudLearningMemoryState === "loading" ? "Refreshing…" : "Refresh memory"}
                </button>
              </div>

              {props.session.identityMode !== "authenticated" ? (
                <div className="helper-copy">Create or sign into an Astra account to manage cloud learning memory.</div>
              ) : props.cloudLearningMemoryState === "loading" && !props.cloudLearningMemoryInventory ? (
                <div className="helper-copy">Loading cloud memory inventory…</div>
              ) : props.cloudLearningMemoryError ? (
                <div className="error-note">{props.cloudLearningMemoryError}</div>
              ) : props.cloudLearningMemoryInventory ? (
                <>
                  <div className="metrics-grid">
                    <MetricCard label="Active cloud records" value={formatNumber(cloudLearningMemoryActiveCount)} hint="saved learning rows" />
                    <MetricCard label="Retained changes" value={formatNumber(cloudLearningMemoryMutationCount)} hint={`Generated ${formatRelativeDate(props.cloudLearningMemoryInventory.generatedAt)}`} />
                    <MetricCard label="Privacy boundary" value={props.cloudLearningMemoryInventory.privacy.metadataOnly ? "Metadata only" : "Review needed"} hint="no raw content" />
                    <MetricCard label="Digest archive" value={formatNumber(weeklyDigestArchive?.activeCount)} hint={weeklyDigestArchive?.enabled ? "enabled" : "off"} />
                  </div>

                  <div className="table-wrap" style={{ marginTop: "1rem" }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Memory area</th>
                          <th>Status</th>
                          <th>Active</th>
                          <th>Last updated</th>
                        </tr>
                      </thead>
                      <tbody>
                        {props.cloudLearningMemoryInventory.collections.map((collection) => (
                          <tr key={collection.collection}>
                            <td>{formatCloudMemoryCollectionLabel(collection.collection)}</td>
                            <td>{collection.enabled ? "On" : "Off"}{collection.defaultEnabled ? " · default on" : ""}</td>
                            <td>{formatNumber(collection.activeCount)}</td>
                            <td>{formatRelativeDate(collection.lastUpdatedAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="row gap wrap" style={{ marginTop: "1rem" }}>
                    <button type="button" className="button secondary" onClick={() => void props.onDeleteCloudLearningMemory()} disabled={props.cloudLearningMemoryDeleteState === "deleting"}>
                      {props.cloudLearningMemoryDeleteState === "deleting" ? "Deleting…" : "Delete cloud learning memory"}
                    </button>
                  </div>
                  <div className="helper-copy" style={{ marginTop: "0.75rem" }}>
                    Deletes Astra cloud learning rows and digest archives for this account only. It does not delete this browser’s local data and does not create third-party service deletion receipts.
                  </div>
                  {props.cloudLearningMemoryReceipt && (
                    <div className="helper-copy" data-testid="cloud-learning-memory-receipt" style={{ marginTop: "0.75rem" }}>
                      Deletion receipt: {formatNumber(props.cloudLearningMemoryReceipt.totals.clearedActiveCount)} active records cleared at {formatRelativeDate(props.cloudLearningMemoryReceipt.deletedAt)} · cloud-only · no third-party service deletion included.
                    </div>
                  )}
                </>
              ) : (
                <div className="helper-copy">No cloud learning-memory inventory loaded yet.</div>
              )}
            </div>

            <div className="card" data-testid="weekly-digest-account-card">
              <div className="section-heading">
                <div>
                  <div className="card-title">Weekly digest</div>
                  <div className="card-copy">A low-frequency learning summary you can turn off. This shows account status and aggregate counts, not delivery confirmation.</div>
                </div>
                <span className={`status-pill${weeklyDigestEnabled ? " success" : " muted"}`}>{weeklyDigestEnabled ? "on" : "off"}</span>
              </div>

              {props.session.identityMode !== "authenticated" ? (
                <div className="helper-copy">Weekly digest is available after you sign into an Astra account.</div>
              ) : (
                <>
                  <div className="metrics-grid">
                    <MetricCard label="Saved this week" value={formatNumber(props.weeklyDigest?.savedCount)} hint={props.weeklyDigestState === "loading" ? "loading…" : `Generated ${formatRelativeDate(props.weeklyDigest?.generatedAt)}`} />
                    <MetricCard label="Reviewed" value={formatNumber(props.weeklyDigest?.reviewedCount)} hint="this digest period" />
                    <MetricCard label="Next review" value={formatNumber(props.weeklyDigest?.nextReviewCount)} hint="coming week" />
                    <MetricCard label="Sources" value={formatNumber(props.weeklyDigest?.sourceBreakdown.reduce((sum, source) => sum + source.count, 0))} hint={props.weeklyDigest?.periodStart ? `${props.weeklyDigest.periodStart.slice(0, 10)} → ${props.weeklyDigest.periodEnd.slice(0, 10)}` : "no digest loaded"} />
                  </div>

                  {props.weeklyDigestError && <div className="error-note" style={{ marginTop: "0.75rem" }}>{props.weeklyDigestError}</div>}
                  {props.weeklyDigest?.sourceBreakdown.length ? (
                    <div className="helper-copy" style={{ marginTop: "0.75rem" }}>
                      Source mix: {props.weeklyDigest.sourceBreakdown.map((source) => `${source.type} ${formatNumber(source.count)}`).join(" · ")}
                    </div>
                  ) : null}

                  <div className="row gap wrap" style={{ marginTop: "1rem" }}>
                    <button type="button" className="button primary" onClick={() => void props.onUpdateWeeklyDigestPreference(!weeklyDigestEnabled)} disabled={props.weeklyDigestPreferenceState === "saving" || props.cloudLearningMemoryState === "loading"}>
                      {props.weeklyDigestPreferenceState === "saving" ? "Saving…" : weeklyDigestEnabled ? "Turn off weekly digest" : "Turn on weekly digest"}
                    </button>
                    <button type="button" className="button ghost" onClick={() => void props.onRefreshCloudLearningMemory()} disabled={props.weeklyDigestState === "loading"}>
                      {props.weeklyDigestState === "loading" ? "Refreshing…" : "Refresh digest status"}
                    </button>
                  </div>
                  <div className="helper-copy" style={{ marginTop: "0.75rem" }}>
                    Preference status comes from your Astra account. This card does not promise email scheduling, push delivery, or external delivery confirmation.
                  </div>
                </>
              )}
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
            <div className="helper-copy">
              Scoped operator tokens unlock only their permitted panels; permission-denied errors are expected for panels outside that role.
            </div>

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
                <div className="card-title">Staff account lookup</div>
                <div className="card-copy">Operator-only membership and usage-category snapshot for support triage. Results use user id and email hash only; no emails, device ids, session ids, hostnames, prompts, text, or provider/model rows.</div>
              </div>
              <button type="button" className="button ghost" onClick={() => void props.onLookupOpsUser(opsUserLookupQuery)} disabled={props.opsUserLookupState === "loading" || !props.operatorToken.trim() || !opsUserLookupQuery.trim()}>
                {props.opsUserLookupState === "loading" ? "Looking up…" : "Lookup account"}
              </button>
            </div>

            <label className="field">
              <span>Account lookup</span>
              <input
                value={opsUserLookupQuery}
                onChange={(event) => setOpsUserLookupQuery(event.target.value)}
                placeholder="email, email hash, or user id"
              />
            </label>

            {!props.operatorToken.trim() ? (
              <div className="helper-copy">Enter the operator token above to load staff account metadata.</div>
            ) : props.opsUserLookupState === "loading" && !props.opsUserLookup ? (
              <div className="helper-copy">Loading account metadata…</div>
            ) : props.opsUserLookupError ? (
              <div className="error-note">{props.opsUserLookupError}</div>
            ) : !visibleOpsUserLookup ? (
              <div className="helper-copy">No account lookup loaded yet. Search by email, email hash, or user id.</div>
            ) : (
              <>
                <div className="metrics-grid">
                  <MetricCard label="User" value={visibleOpsUserLookup.user.userId} hint={`email hash ${visibleOpsUserLookup.user.emailHash.slice(0, 12)}…`} />
                  <MetricCard label="Membership" value={formatAstraPlanLabel(visibleOpsUserLookup.user.plan as AstraPlan)} hint={visibleOpsUserLookup.user.subscriptionStatus} />
                  <MetricCard label="Usage category" value={visibleOpsUserLookup.user.usage.usageCategory} hint={`${formatNumber(visibleOpsUserLookup.user.usage.requestsToday)} requests today`} />
                  <MetricCard label="Result window" value={`${formatNumber(visibleOpsUserLookup.resultWindow.returnedCount)} of ${formatNumber(visibleOpsUserLookup.resultWindow.totalMatched)}`} hint={`Limit ${formatNumber(visibleOpsUserLookup.resultWindow.limit)} · ${visibleOpsUserLookup.resultWindow.hasMore ? "more available" : "no next page"}`} />
                  <MetricCard label="Devices" value={formatNumber(visibleOpsUserLookup.user.devices.activeCount)} hint={`${formatNumber(visibleOpsUserLookup.user.sessions.activeCount)} active sessions`} />
                  <MetricCard label="Snapshot boundary" value={visibleOpsUserLookup.snapshotBoundary.metadataOnly && !visibleOpsUserLookup.snapshotBoundary.contentIncluded ? "Metadata only" : "Review needed"} hint="no export/download" />
                </div>

                <div className="helper-copy" style={{ marginTop: "0.75rem" }}>
                  Bounded exact lookup only: no raw query, emails, device ids, session ids, provider/model rows, page text, email body, export, or download. Recent task rows are capped at {formatNumber(visibleOpsUserLookup.snapshotBoundary.recentTaskSummaryLimit)}.
                </div>

                {visibleOpsUserLookup.user.recentTaskSummary.length > 0 && (
                  <div className="table-wrap" style={{ marginTop: "1rem" }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Task</th>
                          <th>Events</th>
                          <th>Success</th>
                          <th>Failures</th>
                          <th>Fallbacks</th>
                          <th>P95</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleOpsUserLookup.user.recentTaskSummary.slice(0, 6).map((bucket) => (
                          <tr key={bucket.taskClass}>
                            <td>{bucket.taskClass}</td>
                            <td>{formatNumber(bucket.eventCount)}</td>
                            <td>{formatNumber(bucket.successCount)}</td>
                            <td>{formatNumber(bucket.failureCount)}</td>
                            <td>{formatNumber(bucket.fallbackCount)}</td>
                            <td>{bucket.latencyP95Ms == null ? "n/a" : `${formatNumber(bucket.latencyP95Ms)}ms`}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </section>

          <section className="card">
            <div className="section-heading">
              <div>
                <div className="card-title">Privacy / operator audit</div>
                <div className="card-copy">Operator-only audit trail for staff actions and consented support submissions. Rows show action, actor, outcome, privacy class, and subject ids only; no emails, operator tokens, device ids, session ids, hostnames, prompts, or text.</div>
              </div>
              <button type="button" className="button ghost" onClick={() => void props.onRefreshOpsAudit()} disabled={props.opsAuditState === "loading" || !props.operatorToken.trim()}>
                {props.opsAuditState === "loading" ? "Refreshing…" : "Refresh audit"}
              </button>
            </div>

            {!props.operatorToken.trim() ? (
              <div className="helper-copy">Enter the operator token above to load privacy-safe audit metadata.</div>
            ) : props.opsAuditState === "loading" && !props.opsAuditSummary ? (
              <div className="helper-copy">Loading privacy audit metadata…</div>
            ) : props.opsAuditError ? (
              <div className="error-note">{props.opsAuditError}</div>
            ) : !visibleOpsAuditSummary ? (
              <div className="helper-copy">No audit snapshot loaded yet. Refresh to fetch retained operator and privacy events.</div>
            ) : (
              <>
                <div className="metrics-grid">
                  <MetricCard label="Retained audit events" value={formatNumber(visibleOpsAuditSummary.totalEvents)} hint={`Limit ${formatNumber(visibleOpsAuditSummary.retainedEventLimit)}`} />
                  <MetricCard label="Metadata-only" value={formatNumber(visibleOpsAuditSummary.privacy.metadataOnlyCount)} hint="content not stored" />
                  <MetricCard label="Content included" value={formatNumber(visibleOpsAuditSummary.privacy.contentIncludedCount)} hint="should stay zero for remote support" />
                  <MetricCard label="User consent" value={formatNumber(visibleOpsAuditSummary.privacy.userConsentTrueCount)} hint={`Generated ${formatRelativeDate(visibleOpsAuditSummary.generatedAt)}`} />
                </div>

                {visibleOpsAuditSummary.recent.length > 0 && (
                  <div className="table-wrap" style={{ marginTop: "1rem" }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Action</th>
                          <th>Actor</th>
                          <th>Outcome</th>
                          <th>Privacy</th>
                          <th>Subject</th>
                          <th>When</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleOpsAuditSummary.recent.slice(0, 8).map((entry) => (
                          <tr key={entry.id}>
                            <td>{entry.action}</td>
                            <td>{entry.actor}</td>
                            <td>{entry.outcome}</td>
                            <td>{entry.privacy.contentAccess}</td>
                            <td>{entry.supportReportId ?? entry.subjectUserId ?? "—"}</td>
                            <td>{formatRelativeDate(entry.timestamp)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </section>

          <section className="card">
            <div className="section-heading">
              <div>
                <div className="card-title">Cancellation / refund reasons</div>
                <div className="card-copy">Operator-only aggregate feedback from settings, billing, support, and refund flows. Shows normalized reason, plan, source, and hashed subject metadata only; no emails, device ids, session ids, notes, URLs, prompts, or text.</div>
              </div>
              <button type="button" className="button ghost" onClick={() => void props.onRefreshCancellationReasons()} disabled={props.cancellationReasonState === "loading" || !props.operatorToken.trim()}>
                {props.cancellationReasonState === "loading" ? "Refreshing…" : "Refresh reasons"}
              </button>
            </div>

            {!props.operatorToken.trim() ? (
              <div className="helper-copy">Enter the operator token above to load cancellation/refund reason metadata.</div>
            ) : props.cancellationReasonState === "loading" && !props.cancellationReasonSummary ? (
              <div className="helper-copy">Loading cancellation/refund reason metadata…</div>
            ) : props.cancellationReasonError ? (
              <div className="error-note">{props.cancellationReasonError}</div>
            ) : !visibleCancellationReasonSummary ? (
              <div className="helper-copy">No cancellation reason snapshot loaded yet. Refresh to fetch retained metadata-only reason aggregates.</div>
            ) : (
              <>
                <div className="metrics-grid">
                  <MetricCard label="Reason submissions" value={formatNumber(visibleCancellationReasonSummary.totalSubmissions)} hint={`Limit ${formatNumber(visibleCancellationReasonSummary.retainedEventLimit)}`} />
                  <MetricCard label="Coverage" value={visibleCancellationReasonSummary.reasonCoverage.coverageRate == null ? "n/a" : `${Math.round(visibleCancellationReasonSummary.reasonCoverage.coverageRate * 100)}%`} hint="non-other reasons" />
                  <MetricCard label="Top reason" value={visibleCancellationReasonSummary.byReason.find((bucket) => bucket.count > 0)?.label ?? "—"} hint={visibleCancellationReasonSummary.byReason.find((bucket) => bucket.count > 0)?.productMeaning ?? "No submissions yet"} />
                  <MetricCard label="Sources" value={formatNumber(visibleCancellationReasonSummary.bySource.length)} hint={`Generated ${formatRelativeDate(visibleCancellationReasonSummary.generatedAt)}`} />
                </div>

                {visibleCancellationReasonSummary.byReason.length > 0 && (
                  <div className="table-wrap" style={{ marginTop: "1rem" }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Reason</th>
                          <th>Meaning</th>
                          <th>Count</th>
                          <th>Share</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleCancellationReasonSummary.byReason.filter((bucket) => bucket.count > 0).slice(0, 8).map((bucket) => (
                          <tr key={bucket.reason}>
                            <td>{bucket.label}</td>
                            <td>{bucket.productMeaning}</td>
                            <td>{formatNumber(bucket.count)}</td>
                            <td>{Math.round(bucket.share * 100)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="helper-copy" style={{ marginTop: "0.75rem" }}>
                  Plans: {visibleCancellationReasonSummary.byPlan.map((bucket) => `${bucket.plan} ${formatNumber(bucket.count)}`).join(" · ") || "none"} · Sources: {visibleCancellationReasonSummary.bySource.map((bucket) => `${bucket.source} ${formatNumber(bucket.count)}`).join(" · ") || "none"}
                </div>
              </>
            )}
          </section>

          <section className="card" data-testid="ops-cockpit-card">
            <div className="section-heading">
              <div>
                <div className="card-title">Ops cockpit / operating review</div>
                <div className="card-copy">Read-only operator review surface that consolidates cost, support, cancellation, digest, retention, analytics cohort, and route-health signals. It is metadata-only and excludes user rows, content, CRM replies, payment truth, and exact provider billing reconciliation.</div>
              </div>
              <button type="button" className="button ghost" onClick={() => void props.onRefreshOpsCockpit()} disabled={props.opsCockpitState === "loading" || !props.operatorToken.trim()}>
                {props.opsCockpitState === "loading" ? "Refreshing…" : "Refresh cockpit"}
              </button>
            </div>

            {!props.operatorToken.trim() ? (
              <div className="helper-copy">Enter the operator token above to load the read-only ops cockpit.</div>
            ) : props.opsCockpitState === "loading" && !props.opsCockpitSummary ? (
              <div className="helper-copy">Loading ops cockpit metadata…</div>
            ) : props.opsCockpitError ? (
              <div className="error-note">{props.opsCockpitError}</div>
            ) : !visibleOpsCockpitSummary ? (
              <div className="helper-copy">No ops cockpit snapshot loaded yet. Refresh to compose existing aggregate operating signals.</div>
            ) : (
              <>
                <div className="metrics-grid">
                  <MetricCard label="Risk flags" value={`${formatNumber(opsCockpitPauseGrowthCount)} pause / ${formatNumber(opsCockpitWatchCount)} watch`} hint={`Generated ${formatRelativeDate(visibleOpsCockpitSummary.generatedAt)}`} />
                  <MetricCard label="Cost signal" value={formatEstimatedUsd(visibleOpsCockpitSummary.metrics.cost.dailyEstimatedSpendUsd)} hint={`${visibleOpsCockpitSummary.metrics.cost.dailyRiskLevel} · ${visibleOpsCockpitSummary.metrics.cost.dailySpikeStatus}`} />
                  <MetricCard label="Support" value={formatNumber(visibleOpsCockpitSummary.metrics.support.unresolvedCount)} hint={`${formatNumber(visibleOpsCockpitSummary.metrics.support.urgentUnresolvedCount)} urgent · ${formatNumber(visibleOpsCockpitSummary.metrics.support.followUpOverdueCount)} overdue`} />
                  <MetricCard label="Cohort events" value={formatNumber(visibleOpsCockpitSummary.metrics.retentionGrowth.analyticsEvents)} hint={`${visibleOpsCockpitSummary.metrics.retentionGrowth.analyticsGrain} grain · ${formatNumber(visibleOpsCockpitSummary.metrics.retentionGrowth.mobileRetentionEvents)} mobile`} />
                  <MetricCard label="Cancellation feedback" value={formatNumber(visibleOpsCockpitSummary.metrics.retentionGrowth.cancellationSubmissions)} hint={visibleOpsCockpitSummary.metrics.retentionGrowth.topCancellationReason ?? "no top reason"} />
                  <MetricCard label="Route health" value={visibleOpsCockpitSummary.metrics.providerHealth.available ? `${formatNumber(visibleOpsCockpitSummary.metrics.providerHealth.incidentBucketCount)} incident` : "not included"} hint={visibleOpsCockpitSummary.sources.providerHealthSummary ? `${formatNumber(visibleOpsCockpitSummary.metrics.providerHealth.watchBucketCount)} watch buckets` : "ops engineer/admin only"} />
                </div>

                <div className="helper-copy" style={{ marginTop: "0.75rem" }}>
                  Privacy boundary: {visibleOpsCockpitSummary.privacy.metadataOnly && visibleOpsCockpitSummary.privacy.aggregateOnly && visibleOpsCockpitSummary.privacy.readOnly ? "metadata-only aggregate read-only" : "review needed"}; provider billing reconciliation {visibleOpsCockpitSummary.privacy.providerBillingIncluded ? "included" : "excluded"}; CRM replies {visibleOpsCockpitSummary.privacy.crmRepliesIncluded ? "included" : "excluded"}.
                </div>

                {visibleOpsCockpitSummary.riskFlags.length > 0 && (
                  <div className="table-wrap" style={{ marginTop: "1rem" }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Risk</th>
                          <th>Severity</th>
                          <th>Message</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleOpsCockpitSummary.riskFlags.slice(0, 6).map((flag) => (
                          <tr key={`${flag.code}:${flag.severity}`}>
                            <td>{flag.code.replace(/_/g, " ")}</td>
                            <td>{flag.severity.replace(/_/g, " ")}</td>
                            <td>{flag.message}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="helper-copy" style={{ marginTop: "0.75rem" }}>
                  Daily review: {opsCockpitDailyReview ? `${opsCockpitDailyReview.availableEvidence.length}/${opsCockpitDailyReview.requiredEvidence.length} evidence ready` : "n/a"}. Weekly review: {opsCockpitWeeklyReview ? `${opsCockpitWeeklyReview.availableEvidence.length}/${opsCockpitWeeklyReview.requiredEvidence.length} evidence ready` : "n/a"}. Guardrails loaded: {formatNumber(visibleOpsCockpitSummary.experimentGuardrails.length)}.
                </div>
              </>
            )}
          </section>

          <section className="card">
            <div className="section-heading">
              <div>
                <div className="card-title">Cost risk snapshot</div>
                <div className="card-copy">Read-only aggregate view of recent retained usage events. This is directional usage risk, not exact spend, and it intentionally omits users, emails, providers, models, hostnames, prompts, and text.</div>
              </div>
              <button type="button" className="button ghost" onClick={() => void props.onRefreshCostUsage()} disabled={props.costUsageState === "loading" || !props.operatorToken.trim()}>
                {props.costUsageState === "loading" ? "Refreshing…" : "Refresh cost snapshot"}
              </button>
            </div>

            {!props.operatorToken.trim() ? (
              <div className="helper-copy">Enter the operator token above to load aggregate cost-risk metadata.</div>
            ) : props.costUsageState === "loading" && !props.costUsageSummary ? (
              <div className="helper-copy">Loading aggregate cost-risk metadata…</div>
            ) : props.costUsageError ? (
              <div className="error-note">{props.costUsageError}</div>
            ) : !visibleCostUsageSummary ? (
              <div className="helper-copy">No cost snapshot loaded yet. Refresh to fetch retained aggregate usage events.</div>
            ) : (
              <>
                <div className="metrics-grid">
                  <MetricCard label="Retained events" value={formatNumber(visibleCostUsageSummary.totalEvents)} hint={visibleCostUsageSummary.source.replace(/_/g, " ")} />
                  <MetricCard label="Requests" value={formatNumber(visibleCostUsageSummary.totalRequests)} hint={`Recent events per user limit ${formatNumber(visibleCostUsageSummary.recentEventsPerUserLimit)}`} />
                  <MetricCard label="Characters" value={formatNumber(visibleCostUsageSummary.totalCharacters)} hint={`Generated ${formatRelativeDate(visibleCostUsageSummary.generatedAt)}`} />
                  <MetricCard label="Cache hit rate" value={visibleCostUsageSummary.cacheHitRate == null ? "n/a" : `${Math.round(visibleCostUsageSummary.cacheHitRate * 100)}%`} hint="hit / hit+partial+miss events" />
                  <MetricCard label="Estimated spend" value={formatEstimatedUsd(visibleCostUsageSummary.totalEstimatedSpendUsd)} hint={visibleCostUsageSummary.estimateRegistry.replace(/_/g, " ")} />
                  <MetricCard label="Daily estimate" value={formatEstimatedUsd(visibleCostUsageSummary.dailyEstimate.estimatedSpendUsd)} hint={`${visibleCostUsageSummary.dailyEstimate.riskLevel} risk · ${visibleCostUsageSummary.dailyEstimate.spikeStatus} signal`} />
                </div>

                {visibleCostUsageSummary.buckets.length > 0 && (
                  <div className="table-wrap" style={{ marginTop: "1rem" }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Tier</th>
                          <th>Task</th>
                          <th>Cost bucket</th>
                          <th>Events</th>
                          <th>Requests</th>
                            <th>Characters</th>
                            <th>Est. spend</th>
                            <th>Fallbacks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...visibleCostUsageSummary.buckets]
                          .sort((left, right) => right.eventCount - left.eventCount)
                          .slice(0, 6)
                          .map((bucket) => (
                            <tr key={`${bucket.tier}:${bucket.taskClass}:${bucket.costBucket}`}>
                              <td>{bucket.tier}</td>
                              <td>{bucket.taskClass}</td>
                              <td>{bucket.costBucket}</td>
                              <td>{formatNumber(bucket.eventCount)}</td>
                              <td>{formatNumber(bucket.requestCount)}</td>
                              <td>{formatNumber(bucket.characterCount)}</td>
                              <td>{formatEstimatedUsd(bucket.estimatedSpendUsd)}</td>
                              <td>{formatNumber(bucket.fallbackCount)}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="helper-copy" style={{ marginTop: "0.75rem" }}>
                  Daily spend signal is aggregate only: {visibleCostUsageSummary.dailyEstimate.date ?? "n/a"} {formatEstimatedUsd(visibleCostUsageSummary.dailyEstimate.estimatedSpendUsd)} · previous {visibleCostUsageSummary.dailyEstimate.previousDate ?? "n/a"} {formatEstimatedUsd(visibleCostUsageSummary.dailyEstimate.previousEstimatedSpendUsd)} · ratio {visibleCostUsageSummary.dailyEstimate.spikeRatio == null ? "new" : `${visibleCostUsageSummary.dailyEstimate.spikeRatio}×`}
                </div>

                {visibleCostUsageSummary.byCacheStatus.length > 0 && (
                  <div className="helper-copy" style={{ marginTop: "0.75rem" }}>
                    Cache status is aggregate only: {visibleCostUsageSummary.byCacheStatus.map((bucket) => `${bucket.cacheStatus} ${formatNumber(bucket.eventCount)} (${Math.round(bucket.share * 100)}%)`).join(" · ")}
                  </div>
                )}

                {visibleCostUsageSummary.byServiceMode.length > 0 && (
                  <div className="helper-copy" style={{ marginTop: "0.75rem" }}>
                    Service-mode health is aggregate only: {visibleCostUsageSummary.byServiceMode.map((bucket) => `${bucket.serviceMode} P95 ${bucket.latencyP95Ms == null ? "n/a" : `${formatNumber(bucket.latencyP95Ms)}ms`}`).join(" · ")}
                  </div>
                )}
              </>
            )}
          </section>


          <section className="card">
            <div className="section-heading">
              <div>
                <div className="card-title">{visibleProviderHealthSummary ? "Provider health snapshot" : "Staff route-health snapshot"}</div>
                <div className="card-copy">
                  {visibleProviderHealthSummary
                    ? "Staff-only route health for retained recent usage events. Shows provider/model/service-mode/task aggregates for outage mitigation; no users, emails, hostnames, prompts, text, or per-user rows."
                    : "Staff-only route health for retained recent usage events. Enter a staff token to load outage-mitigation metadata; ordinary account views do not expose internal routing details."}
                </div>
              </div>
              <button type="button" className="button ghost" onClick={() => void props.onRefreshProviderHealth()} disabled={props.providerHealthState === "loading" || !props.operatorToken.trim()}>
                {props.providerHealthState === "loading" ? "Refreshing…" : "Refresh route health"}
              </button>
            </div>

            {!props.operatorToken.trim() ? (
              <div className="helper-copy">Enter the staff token above to load route-health metadata.</div>
            ) : props.providerHealthState === "loading" && !props.providerHealthSummary ? (
              <div className="helper-copy">Loading route-health metadata…</div>
            ) : props.providerHealthError ? (
              <div className="error-note">{props.providerHealthError}</div>
            ) : !visibleProviderHealthSummary ? (
              <div className="helper-copy">No route-health snapshot loaded yet. Refresh to fetch retained route-health aggregates.</div>
            ) : (
              <>
                <div className="metrics-grid">
                  <MetricCard label="Retained events" value={formatNumber(visibleProviderHealthSummary.totalEvents)} hint={visibleProviderHealthSummary.source.replace(/_/g, " ")} />
                  <MetricCard label="Requests" value={formatNumber(visibleProviderHealthSummary.totalRequests)} hint={`Recent events per user limit ${formatNumber(visibleProviderHealthSummary.recentEventsPerUserLimit)}`} />
                  <MetricCard label="Incidents" value={formatNumber(providerHealthIncidentCount)} hint="failure/fallback threshold" />
                  <MetricCard label="Watch" value={formatNumber(providerHealthWatchCount)} hint={`${formatNumber(visibleProviderHealthSummary.buckets.length)} provider buckets`} />
                </div>

                {visibleProviderHealthSummary.buckets.length > 0 && (
                  <div className="table-wrap" style={{ marginTop: "1rem" }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Health</th>
                          <th>Provider</th>
                          <th>Model</th>
                          <th>Mode</th>
                          <th>Task</th>
                          <th>Events</th>
                          <th>Success</th>
                          <th>Fallback</th>
                          <th>P95</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleProviderHealthSummary.buckets.slice(0, 8).map((bucket) => (
                          <tr key={`${bucket.provider}:${bucket.model}:${bucket.serviceMode}:${bucket.taskClass}`}>
                            <td>{bucket.healthStatus}</td>
                            <td>{bucket.provider}</td>
                            <td>{bucket.model}</td>
                            <td>{bucket.serviceMode}</td>
                            <td>{bucket.taskClass}</td>
                            <td>{formatNumber(bucket.eventCount)}</td>
                            <td>{bucket.successRate == null ? "n/a" : `${Math.round(bucket.successRate * 100)}%`}</td>
                            <td>{bucket.fallbackRate == null ? "n/a" : `${Math.round(bucket.fallbackRate * 100)}%`}</td>
                            <td>{bucket.latencyP95Ms == null ? "n/a" : `${formatNumber(bucket.latencyP95Ms)}ms`}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </section>

          <FeatureFlagOpsCard
            runtime={props.featureFlagRuntime}
            state={props.featureFlagsState}
            error={props.featureFlagsError}
            operatorToken={props.operatorToken}
            onRefresh={props.onRefreshFeatureFlags}
            onUpdateKillSwitch={props.onUpdateFeatureFlagKillSwitch}
          />

          <section className="card">
            <div className="section-heading">
              <div>
                <div className="card-title">Support report triage</div>
                <div className="card-copy">Staff-only metadata triage for submitted support reports. This panel intentionally omits page text, saved content, transcripts, screenshots, and message bodies.</div>
              </div>
              <button type="button" className="button ghost" onClick={() => void props.onRefreshSupportReports()} disabled={props.supportReportsState === "loading" || !props.operatorToken.trim()}>
                {props.supportReportsState === "loading" ? "Refreshing…" : "Refresh reports"}
              </button>
            </div>

            {!props.operatorToken.trim() ? (
              <div className="helper-copy">Enter the operator token above to load staff support report metadata.</div>
            ) : props.supportReportsState === "loading" && !props.supportReports ? (
              <div className="helper-copy">Loading support report metadata…</div>
            ) : props.supportReportsError ? (
              <div className="error-note">{props.supportReportsError}</div>
            ) : !props.supportReports || !props.supportReportSummary ? (
              <div className="helper-copy">No support report snapshot loaded yet. Refresh reports to fetch the current metadata-only inbox.</div>
            ) : props.supportReports.reports.length === 0 ? (
              <>
                <div className="helper-copy">No support reports are currently in the metadata inbox.</div>
                {supportMacroCoverage && (
                  <div className="helper-copy" style={{ marginTop: "0.75rem" }}>
                    First-response macro coverage is metadata-only: n/a until support reports are submitted. Catalog coverage covers {formatNumber(supportMacroCoverage.catalogCoverage.coveredIssueCategories)} of {formatNumber(supportMacroCoverage.catalogCoverage.totalIssueCategories)} issue categories.
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="metrics-grid">
                  <MetricCard label="Total reports" value={formatNumber(props.supportReportSummary.totalReports)} hint={`Generated ${formatRelativeDate(props.supportReportSummary.generatedAt)}`} />
                  <MetricCard label="Buckets" value={formatNumber(props.supportReportSummary.buckets.length)} hint="privacy-safe clusters" />
                  <MetricCard label="Newest bucket" value={props.supportReportSummary.buckets[0]?.featureSurface ?? "—"} hint={props.supportReportSummary.buckets[0]?.triageStatus ?? "no reports"} />
                  <MetricCard label="Weekly top issue" value={supportWeeklyTopIssue?.issueCategory ?? "—"} hint={supportWeeklyTopIssue ? `${formatNumber(supportWeeklyTopIssue.reportCount)} reports · week ${supportWeeklyTopIssue.weekStart}` : "no weekly reports"} />
                  <MetricCard label="Macro coverage" value={supportMacroCoverageRate == null ? "n/a" : `${Math.round(supportMacroCoverageRate * 100)}%`} hint={supportMacroCoverage?.reportedCoverage.ready === false ? "below first-response target" : "first-response target"} />
                  <MetricCard label="Unresolved" value={formatNumber(supportSlaRisk?.unresolvedCount ?? 0)} hint={`${formatNumber(supportSlaRisk?.urgentUnresolvedCount ?? 0)} urgent`} />
                  <MetricCard label="Stale triage" value={formatNumber(supportStaleTriageCount)} hint={`oldest unresolved ${supportOldestUnresolvedAge}`} />
                  <MetricCard label="Follow-up overdue" value={formatNumber(supportSlaRisk?.followUpOverdueCount ?? 0)} hint="selected or handed off >48h" />
                  <MetricCard label="Follow-up handoff" value={formatNumber(supportHandedOffCount + supportCompletedHandoffCount)} hint="handed off or completed" />
                  <MetricCard label="Recent reports" value={formatNumber(props.supportReports.reports.length)} hint="metadata rows" />
                </div>

                {supportMacroCoverage && (
                  <div className="helper-copy" style={{ marginTop: "0.75rem" }}>
                    First-response macro coverage is metadata-only: {formatNumber(supportMacroCoverage.reportedCoverage.coveredReports)} of {formatNumber(supportMacroCoverage.reportedCoverage.totalReports)} reports have a matching ordinary-language macro{supportMacroTopBucket?.title ? ` · Top macro: ${supportMacroTopBucket.title}` : ""}.
                  </div>
                )}

                {supportWeeklyTopIssue && (
                  <div className="helper-copy" style={{ marginTop: "0.75rem" }}>
                    Weekly top issue is aggregate-only: {supportWeeklyTopIssue.issueCategory ?? "unknown issue"} on {supportWeeklyTopIssue.featureSurface}{supportWeeklyTopIssue.hostname ? ` · ${supportWeeklyTopIssue.hostname}` : ""}{supportWeeklyTopIssue.knownIssueId ? ` · known issue ${supportWeeklyTopIssue.knownIssueId}` : ""}.
                  </div>
                )}

                <div className="helper-copy" style={{ marginTop: "0.75rem" }}>
                  Follow-up handoff is metadata-only: {supportHandoffSummary.byPath.map((bucket) => `${bucket.path} ${formatNumber(bucket.count)}`).join(" · ") || "none"}.
                </div>

                {supportSlaRisk && (
                  <div className="helper-copy" style={{ marginTop: "0.75rem" }}>
                    SLA risk is metadata-only: unresolved {formatNumber(supportSlaRisk.unresolvedCount)} · urgent {formatNumber(supportSlaRisk.urgentUnresolvedCount)} · stale 24–72h {formatNumber(supportSlaRisk.staleTriageByAgeBucket.from24hTo72h)} · stale 72h–7d {formatNumber(supportSlaRisk.staleTriageByAgeBucket.from72hTo168h)} · stale 7d+ {formatNumber(supportSlaRisk.staleTriageByAgeBucket.over168h)} · generated {formatRelativeDate(supportSlaRisk.currentNow)}.
                  </div>
                )}

                {props.supportReportSummary.buckets.length > 0 && (
                  <div className="table-wrap" style={{ marginTop: "1rem" }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Count</th>
                          <th>Surface</th>
                          <th>Issue</th>
                          <th>Hostname</th>
                          <th>Triage</th>
                          <th>Known issue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {props.supportReportSummary.buckets.slice(0, 5).map((bucket) => (
                          <tr key={bucket.key}>
                            <td>{formatNumber(bucket.count)}</td>
                            <td>{bucket.featureSurface}</td>
                            <td>{bucket.issueCategory ?? "—"}</td>
                            <td>{bucket.hostname ?? "—"}</td>
                            <td>{bucket.triageStatus}</td>
                            <td>{bucket.knownIssueId ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="grid cards-2" style={{ marginTop: "1rem" }}>
                  {props.supportReports.reports.slice(0, 4).map((report) => (
                    <SupportReportTriageRow
                      key={report.reportId}
                      report={report}
                      operatorToken={props.operatorToken}
                      onUpdate={props.onUpdateSupportReportTriage}
                    />
                  ))}
                </div>
              </>
            )}
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
