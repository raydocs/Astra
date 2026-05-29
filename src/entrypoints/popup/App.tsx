import { useEffect, useMemo, useRef, useState } from "react"
import { browser } from "#imports"
import { t } from "@/utils/i18n"
import { getSafeAiUnavailableCopy, localizedOrFallback } from "@/utils/copy-dictionary"
import {
  buildLearningLoopAccountContinuityProofMoment,
  buildLearningLoopProValueMoments,
  buildLearningLoopUpgradePrompt,
  DEFAULT_LEARNING_LOOP_COPY_VARIANT,
  DEFAULT_LEARNING_LOOP_UPGRADE_PROMPT_VARIANT,
  getLearningLoopCopyVariant,
  getLearningLoopUpgradePromptVariant,
  LEARNING_LOOP_COMMERCIAL_SURFACE_COPY,
  LEARNING_LOOP_UPGRADE_PROMPT_EXPERIMENT_ID,
  recordLearningLoopEvent,
  type LearningLoopCopyVariant,
  type LearningLoopProValueMoment,
  type LearningLoopProValueTrigger,
  type LearningLoopUpgradePrompt,
  type LearningLoopUpgradePromptVariant,
} from "@/utils/learning-loop-events"
import type {
  AstraConfig,
  ContentScope,
  LanguageLevel,
  ExplainMode,
  SiteConfig,
  SubtitleQualityControls,
  TranslationMode,
} from "@/types/config"
import type { AstraAccount, AstraDeviceIdentity, AstraSession, AstraUsageSnapshot } from "@/types/auth"
import { isRuntimeResponse, type LearningContinuitySyncStatus, type PageStudyContext, type TranslationCacheStats } from "@/types/messages"
import type { TranslationSnapshot } from "@/types/translation"
import {
  resolveActiveHttpTab,
  commitLearningContinuitySync,
  getActiveTabStudyContext,
  getActiveTabTranslationState,
  getLearningContinuitySyncStatus,
  getTranslationCacheStats,
  retryActiveTabFailedBlocks,
  saveConfigInBackground,
  startActiveTabTranslation,
  stopActiveTabTranslation,
} from "@/utils/extension/messages"
import { readConfig } from "@/utils/storage/config"
import {
  DEFAULT_ASTRA_CONFIG,
  DEFAULT_SUBTITLE_QUALITY_CONTROLS,
  hasResolvedProviderAccess,
  normalizeSiteKey,
  parseExplanationGlossaryText,
  resolveSiteTranslationSettings,
  resolveTranslationSurfaceMode,
  serializeExplanationGlossary,
} from "@/types/config"
import { getReadingHistory, type ReadingHistoryEntry } from "@/utils/storage/reading-history"
import { saveDeepReadSession } from "@/utils/storage/deep-read-session"
import {
  computeFingerprint,
  getPageDigest,
  isDigestStale,
  savePageDigest,
  type PageDigestRecord,
} from "@/utils/storage/page-digests"
import { generatePageDigest } from "@/utils/reading/assist"
import { isTtsSupported, speak, splitSentences, stopSpeaking } from "@/utils/tts"
import { translateExplanationWithQualityRetry, translateTexts } from "@/utils/translate/translate"
import { getMatchedExplanationGlossaryTerms, type MatchedExplanationGlossaryTerm } from "@/utils/translate/explanation-quality"
import {
  clearAstraSession,
  ensureAstraDeviceIdentity,
  readAstraSession,
  saveAstraSession,
} from "@/utils/storage/auth"
import {
  createAstraSession,
  refreshAstraSession,
  requestAstraMobileLink,
  revokeAstraSession,
  type AstraMobileLinkChallenge,
} from "@/utils/astra/auth"
import {
  fetchAstraAccountSummary,
  fetchAstraContinuitySnapshot,
} from "@/utils/astra/account"
import {
  getDueVocabularyCount,
  getVocabularyEntries,
  isVocabularyEntryFromStudyUrl,
  saveVocabularyEntry,
  deriveWeeklyVocabularyRoi,
} from "@/utils/storage/vocabulary"
import {
  buildLearningAssetProjection,
  deriveWeeklyReviewableLearningMoments,
} from "@/utils/storage/learning-assets"
import {
  buildOwnedReadingArticleIdentity,
  buildOwnedReadingVocabularySourceLink,
  deriveOwnedReadingIdentityFromItem,
  listOwnedReadingItems,
  upsertOwnedArticleFromUrl,
  type OwnedReadingItem,
} from "@/utils/storage/owned-reading"
import { buildSentenceAnchor } from "@/utils/sentence-anchor"
import { openFocusedReview, openPageReviewLoop } from "@/utils/review-link"
import { getTranslationUsageSummary, type TranslationUsageSummary } from "@/utils/storage/translation-usage"
import {
  DEFAULT_RETENTION_REMINDER_POLICY,
  deriveRetentionReminderStatus,
  disableRetentionReminders,
  enableRetentionReminders,
  pauseRetentionRemindersForDays,
  readRetentionReminderPolicy,
  type RetentionReminderPolicy,
  type RetentionReminderStatus,
} from "@/utils/storage/retention-reminders"
import { buildContinuityStatus, type AstraContinuityRemoteSnapshot, type AstraContinuityStatus } from "@/utils/storage/config-sync"
import {
  deriveStudyLoopPrimerRecommendation,
  deriveStudyLoopViewModel,
  getStudyProgress,
  recordStudyEvent,
  deriveWeeklyStudyProgressRoi,
  type PersonalizedTeachingStrategy,
  type StudyLoopPrimerAction,
  type StudyLoopViewModel,
} from "@/utils/storage/study-progress"
import {
  buildQuotaInfoFromAccountState,
  formatAstraPlanLabel,
  resolveAstraAccountSurfaceSource,
} from "@/utils/astra/account-surface"
import TranslationStatusCard, { type SubtitleQualityTrendPoint } from "./components/TranslationStatusCard"
import SimpleControls from "./components/SimpleControls"
import QuotaBar from "./components/QuotaBar"
import SiteSettingsSection from "./components/SiteSettingsSection"
import SiteRulesExplainabilityPanel, { type SiteRulesQuickFixAction } from "./components/SiteRulesExplainabilityPanel"
import LearningContinuityCommitCard from "./components/LearningContinuityCommitCard"
import LearningClosurePrimerCard from "./components/LearningClosurePrimerCard"
import {
  PopupArticleHero,
  PopupReadingQuickCard,
  PopupSiteQuickCard,
  PopupTodayLearning,
} from "./components/PopupQuietReaderSections"
import { PopupGroupCard, PopupHeader, PopupShell } from "./components/PopupDesignPrimitives"
import StudySection, {
  type PopupPageAssetSaveStatus,
  type PopupSentenceCardViewModel,
  type PopupSentenceExplainStatus,
  type PopupSentenceSaveStatus,
  type WeeklyLearningRoiViewModel,
} from "./components/StudySection"
import UsageInsightsCard from "./components/UsageInsightsCard"
import { warningStyle, labelStyle } from "./components/styles"
import { formatExplainProfileLabel, formatGlossaryEvidenceLabel } from "@/utils/storage/vocabulary-core"
import {
  getPageAccessState,
  requestPageAccess,
  revokePageAccess,
  type PageAccessState,
} from "@/utils/extension/page-permissions"
import { buildSupportBundle, describeKnownIssueForUser, describeSupportBundle } from "@/utils/support-bundle"
import { submitAstraSupportReport } from "@/utils/astra/support"

async function getActiveSiteKey(): Promise<string | null> {
  const tab = await resolveActiveHttpTab()
  if (!tab) return null
  return normalizeSiteKey(tab.url)
}

function formatContinuityTimestamp(value: string | null | undefined): string {
  if (!value) return "not yet"

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return parsed.toLocaleString()
}

function buildSubtitleDiagnosticsFileName(generatedAt: string): string {
  const stamp = generatedAt
    .replace(/[:.]/g, "-")
    .replace(/Z$/, "z")
  return `astra-subtitle-qc-diagnostics-${stamp}.json`
}

function buildPageReportBundleFileName(generatedAt: string): string {
  const stamp = generatedAt
    .replace(/[:.]/g, "-")
    .replace(/Z$/, "z")
  return `astra-page-report-${stamp}.json`
}

function downloadLocalJsonFile(fileName: string, payload: unknown): void {
  if (typeof URL.createObjectURL !== "function") {
    throw new Error("Local JSON export is unavailable in this browser.")
  }

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" })
  const url = URL.createObjectURL(blob)

  try {
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = fileName
    anchor.click()
  } finally {
    URL.revokeObjectURL?.(url)
  }
}

function isSupportedVideoUrl(url: string | null | undefined): boolean {
  if (!url) return false
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.toLowerCase()
    return host === "youtu.be"
      || host.endsWith("youtube.com")
      || host.endsWith("bilibili.com")
  } catch {
    return false
  }
}

function resolveWebViewerBaseUrl(relayBaseURL: string | null | undefined): string {
  const trimmed = relayBaseURL?.trim()
  if (!trimmed) {
    return "http://127.0.0.1:4173"
  }

  return trimmed
    .replace(/\/+$/, "")
    .replace(/\/v1$/, "")
}

function buildVideoNoteViewerUrl(jobId: string, relayBaseURL: string | null | undefined): string {
  return `${resolveWebViewerBaseUrl(relayBaseURL)}/#/video-notes?jobId=${encodeURIComponent(jobId)}`
}

function shouldFocusPopupSignInPanel(): boolean {
  if (typeof window === "undefined") return false
  try {
    return new URLSearchParams(window.location.search).get("focus") === "sign-in"
  } catch {
    return false
  }
}

function shouldUseAstraCertificationMode(): boolean {
  if (typeof window === "undefined") return false
  try {
    const searchParams = new URLSearchParams(window.location.search)
    const hashParams = window.location.hash.includes("?")
      ? new URLSearchParams(window.location.hash.split("?", 2)[1] ?? "")
      : new URLSearchParams()
    return searchParams.get("astraCert") === "1" || hashParams.get("astraCert") === "1"
  } catch {
    return false
  }
}

const POPUP_EMPTY_CERT_STUDY_CONTEXT: PageStudyContext = {
  pageTitle: "Why Solitude Is Important for Reading",
  pageUrl: "https://www.newyorker.com/culture/the-weekend-essay/why-solitude-is-important-for-reading",
  hostname: "newyorker.com",
}

interface PopupSentenceState {
  explanationText: string | null
  explanationLanguageLevel?: LanguageLevel
  explanationExplainMode?: ExplainMode
  explanationGlossaryTerms?: MatchedExplanationGlossaryTerm[]
  explainStatus: PopupSentenceExplainStatus
  saveStatus: PopupSentenceSaveStatus
  savedEntryId?: string
}

type PopupStudySentenceSource = "article_excerpt" | "content_summary" | "meta_description" | "empty"

interface PopupStudyDeckState {
  summaryText: string
  actionText: string
  sentenceSourceText: string
  sentenceSource: PopupStudySentenceSource
  sentences: string[]
  hasStudyText: boolean
}

interface CurrentPageSavedReviewSummary {
  studyUrl: string
  count: number
  entryId?: string
}

function hasSavedOwnedArticleForUrl(items: OwnedReadingItem[], url: string): boolean {
  try {
    const identity = buildOwnedReadingArticleIdentity(url)
    return items.some((item) => item.sourceType === "article"
      && item.status !== "archived"
      && deriveOwnedReadingIdentityFromItem(item)?.dedupeKey === identity.dedupeKey)
  } catch {
    return false
  }
}

type PopupSentenceActionLock =
  | { type: "idle"; sentenceId: null }
  | { type: "explaining" | "saving"; sentenceId: string }

function buildPopupSentenceCardId(index: number, sentence: string): string {
  return `${index}:${sentence}`
}

function buildLegacyPopupSentenceSaveKey(sentence: string): string {
  return `legacy:${sentence.trim()}`
}

function buildPersonalizedStrategyTelemetry(strategy: PersonalizedTeachingStrategy | null | undefined) {
  const eligible = !!strategy
  return {
    psarEligible: eligible,
    personalizedStrategyApplied: eligible,
    personalizedStrategyId: strategy?.id ?? null,
    personalizedStrategyLabel: strategy?.label ?? null,
    personalizedStrategyTrigger: strategy?.trigger ?? null,
    personalizedStrategyFocusStep: strategy?.focusStep ?? null,
    personalizedStrategyProgressSignature: strategy?.progressSignature ?? null,
  }
}

function createPopupSentenceState(
  patch: Partial<PopupSentenceState> = {},
): PopupSentenceState {
  return {
    explanationText: null,
    explainStatus: "idle",
    saveStatus: "idle",
    ...patch,
  }
}

function normalizeStudyText(value: string | null | undefined): string {
  return value?.trim() ?? ""
}

function derivePopupProValueTriggers(input: {
  isSupportedVideoTab: boolean
  studyReady: boolean
  isAuthenticatedSession: boolean
  hasDigestSignal: boolean
  quotaUsed: number | null
  quotaLimit: number | null
}): LearningLoopProValueTrigger[] {
  const triggers: LearningLoopProValueTrigger[] = []
  if (input.isSupportedVideoTab) triggers.push("long_video")
  if (input.studyReady) triggers.push("deep_read")
  if (!input.isAuthenticatedSession) triggers.push("sync")
  if (input.hasDigestSignal) triggers.push("digest")
  if (
    typeof input.quotaUsed === "number"
    && typeof input.quotaLimit === "number"
    && input.quotaLimit > 0
    && input.quotaUsed / input.quotaLimit >= 0.8
  ) {
    triggers.push("near_limit")
  }
  return triggers
}

function PopupProValueMomentsCard({
  moments,
  upgradePrompt,
  onUpgradeIntent,
}: {
  moments: LearningLoopProValueMoment[]
  upgradePrompt: LearningLoopUpgradePrompt | null
  onUpgradeIntent: () => void
}) {
  if (moments.length === 0 && !upgradePrompt) return null

  return (
    <div className="astra-card" data-testid="popup-pro-value-moments-card" style={{ marginTop: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: "var(--astra-text-primary)", marginBottom: 4 }}>
        {localizedOrFallback("proMomentsCardTitle", "Pro value moments")}
      </div>
      <div style={{ fontSize: 11, color: "var(--astra-text-secondary)", lineHeight: 1.45 }}>
        {localizedOrFallback(
          "proMomentsCardSummary",
          "Astra explains upgrade value by the current learning moment—long content, deeper reading, continuity, digest, or approaching today’s included reading—without technical setup language.",
        )}
      </div>
      {upgradePrompt && (
        <div data-testid="popup-upgrade-prompt" style={{ border: "1px solid var(--astra-border)", borderRadius: 10, padding: "8px 10px", background: "var(--astra-bg-elevated)", marginTop: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--astra-text-muted)" }}>
            {upgradePrompt.eyebrow}
          </div>
          <div style={{ fontSize: 12, fontWeight: 800, color: "var(--astra-text-primary)", marginTop: 3 }}>
            {upgradePrompt.title}
          </div>
          <div style={{ fontSize: 11, color: "var(--astra-text-secondary)", lineHeight: 1.45, marginTop: 4 }}>
            {upgradePrompt.summary}
          </div>
          <div style={{ fontSize: 11, color: "var(--astra-text-muted)", lineHeight: 1.45, marginTop: 6 }}>
            {upgradePrompt.boundary}
          </div>
          <button
            type="button"
            data-testid="popup-upgrade-interest-cta"
            className="astra-btn-secondary"
            style={{ width: "100%", marginTop: 8, padding: "7px 10px", fontSize: 12 }}
            onClick={onUpgradeIntent}
          >
            {upgradePrompt.cta}
          </button>
        </div>
      )}
      <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
        {moments.map((moment) => (
          <div key={moment.trigger} data-testid={`popup-pro-value-${moment.trigger}`} style={{ border: "1px solid var(--astra-border)", borderRadius: 10, padding: "8px 10px", background: "var(--astra-bg-elevated)" }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--astra-text-muted)" }}>
              {moment.eyebrow}
            </div>
            <div style={{ fontSize: 12, fontWeight: 800, color: "var(--astra-text-primary)", marginTop: 3 }}>
              {moment.title}
            </div>
            <div style={{ fontSize: 11, color: "var(--astra-text-secondary)", lineHeight: 1.45, marginTop: 4 }}>
              {moment.summary}
            </div>
            <div style={{ fontSize: 11, color: "var(--astra-brand)", fontWeight: 800, marginTop: 6 }}>
              {moment.cta}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function derivePopupStudyDeck(studyContext: PageStudyContext | null): PopupStudyDeckState {
  const articleExcerpt = normalizeStudyText(studyContext?.articleExcerpt)
  const contentSummary = normalizeStudyText(studyContext?.contentSummary)
  const metaDescription = normalizeStudyText(studyContext?.metaDescription)
  const summaryText = contentSummary || metaDescription
  const sentenceSourceText = articleExcerpt || contentSummary || metaDescription
  const sentenceSource: PopupStudySentenceSource = articleExcerpt
    ? "article_excerpt"
    : contentSummary
      ? "content_summary"
      : metaDescription
        ? "meta_description"
        : "empty"

  return {
    summaryText,
    actionText: sentenceSourceText,
    sentenceSourceText,
    sentenceSource,
    sentences: sentenceSourceText.length > 0
      ? splitSentences(sentenceSourceText)
        .map((sentence) => sentence.trim())
        .filter((sentence) => sentence.length > 0)
        .slice(0, 3)
      : [],
    hasStudyText: sentenceSourceText.length > 0,
  }
}

function derivePopupSentenceActionLock(
  sentenceStateById: Record<string, PopupSentenceState>,
): PopupSentenceActionLock {
  for (const [sentenceId, sentenceState] of Object.entries(sentenceStateById)) {
    if (sentenceState.explainStatus === "explaining") {
      return { type: "explaining", sentenceId }
    }
  }

  for (const [sentenceId, sentenceState] of Object.entries(sentenceStateById)) {
    if (sentenceState.saveStatus === "saving") {
      return { type: "saving", sentenceId }
    }
  }

  return { type: "idle", sentenceId: null }
}

function patchPopupSentenceState(
  current: Record<string, PopupSentenceState>,
  sentenceId: string,
  patch: Partial<PopupSentenceState>,
): Record<string, PopupSentenceState> {
  return {
    ...current,
    [sentenceId]: {
      ...(current[sentenceId] ?? createPopupSentenceState()),
      ...patch,
    },
  }
}

function buildStudyDigestContentSummary(studyContext: PageStudyContext | null): string {
  if (!studyContext) return ""

  return [
    studyContext.contentSummary ?? studyContext.metaDescription ?? "",
    studyContext.articleExcerpt ? `Article excerpt:\n${studyContext.articleExcerpt}` : "",
  ].filter(Boolean).join("\n\n")
}

interface IosBootstrapRuntimeStatus {
  lastSessionId: string | null
  lastBootstrapAt: string | null
}

interface IosBootstrapHistoryEvent {
  sessionId: string
  source: string
  issuedAt: string | null
  launchURL: string | null
}

interface IosBootstrapRuntimeResponse {
  ok?: boolean
  bridgeAvailable?: boolean
  opened?: boolean
  status?: IosBootstrapRuntimeStatus | null
  history?: IosBootstrapHistoryEvent[]
}

async function fetchIosBootstrapRuntimeStatus(): Promise<{
  bridgeAvailable: boolean
  status: IosBootstrapRuntimeStatus | null
  history: IosBootstrapHistoryEvent[]
}> {
  try {
    const response = await browser.runtime.sendMessage({
      type: "runtime/ios-bootstrap-status",
    }) as IosBootstrapRuntimeResponse

    return {
      bridgeAvailable: response.bridgeAvailable === true,
      status: response.status ?? null,
      history: Array.isArray(response.history) ? response.history : [],
    }
  } catch {
    return {
      bridgeAvailable: false,
      status: null,
      history: [],
    }
  }
}

async function consumeIosBootstrapFromPopup(source: string): Promise<IosBootstrapRuntimeResponse> {
  try {
    const response = await browser.runtime.sendMessage({
      type: "runtime/ios-bootstrap-consume",
      source,
    }) as IosBootstrapRuntimeResponse

    return response
  } catch {
    return { ok: false, bridgeAvailable: false, opened: false, status: null, history: [] }
  }
}

async function replayIosBootstrapFromPopup(sessionId?: string): Promise<IosBootstrapRuntimeResponse> {
  try {
    const response = await browser.runtime.sendMessage({
      type: "runtime/ios-bootstrap-replay",
      sessionId,
    }) as IosBootstrapRuntimeResponse

    return response
  } catch {
    return { ok: false, bridgeAvailable: false, opened: false, status: null, history: [] }
  }
}

export default function App() {
  const [configDraft, setConfigDraft] = useState<AstraConfig>(DEFAULT_ASTRA_CONFIG)
  const [persistedConfig, setPersistedConfig] = useState<AstraConfig>(DEFAULT_ASTRA_CONFIG)
  const [statusMessage, setStatusMessage] = useState("")
  const [translationState, setTranslationState] = useState<TranslationSnapshot | null>(null)
  const [contentAvailable, setContentAvailable] = useState(true)
  const [activeSiteKey, setActiveSiteKey] = useState<string | null>(null)
  const [pageAccessState, setPageAccessState] = useState<PageAccessState | null>(null)
  const [pageAccessMessage, setPageAccessMessage] = useState("")
  const [authSession, setAuthSession] = useState<AstraSession | null>(null)
  const [authAccount, setAuthAccount] = useState<AstraAccount | null>(null)
  const [authUsage, setAuthUsage] = useState<AstraUsageSnapshot | null>(null)
  const [deviceIdentity, setDeviceIdentity] = useState<AstraDeviceIdentity | null>(null)
  const [continuityRemote, setContinuityRemote] = useState<AstraContinuityRemoteSnapshot | null>(null)
  const [continuityStatus, setContinuityStatus] = useState<AstraContinuityStatus | null>(null)
  const [learningContinuitySyncStatus, setLearningContinuitySyncStatus] = useState<LearningContinuitySyncStatus | null>(null)
  const [learningContinuityCommitBusy, setLearningContinuityCommitBusy] = useState(false)
  const [authEmail, setAuthEmail] = useState("")
  const [authPassword, setAuthPassword] = useState("")
  const [authBusy, setAuthBusy] = useState(false)
  const [mobileLinkBusy, setMobileLinkBusy] = useState(false)
  const [mobileLinkChallenge, setMobileLinkChallenge] = useState<AstraMobileLinkChallenge | null>(null)
  const [mobileLinkMessage, setMobileLinkMessage] = useState("")
  const [signInPanelOpen, setSignInPanelOpen] = useState(() => shouldFocusPopupSignInPanel())
  const [signInFocusRequestTick, setSignInFocusRequestTick] = useState(() => shouldFocusPopupSignInPanel() ? 1 : 0)
  const [recentHistory, setRecentHistory] = useState<ReadingHistoryEntry[]>([])
  const [studyContext, setStudyContext] = useState<PageStudyContext | null>(null)
  const [dueCount, setDueCount] = useState(0)
  const [vocabularyTotalCount, setVocabularyTotalCount] = useState(0)
  const [learningLoopCopyVariant, setLearningLoopCopyVariantState] = useState<LearningLoopCopyVariant>(DEFAULT_LEARNING_LOOP_COPY_VARIANT)
  const [upgradePromptVariant, setUpgradePromptVariant] = useState<LearningLoopUpgradePromptVariant>(DEFAULT_LEARNING_LOOP_UPGRADE_PROMPT_VARIANT)
  const [usageSummary, setUsageSummary] = useState<TranslationUsageSummary | null>(null)
  const [translationCacheStats, setTranslationCacheStats] = useState<TranslationCacheStats | null>(null)
  const [studyLoop, setStudyLoop] = useState<StudyLoopViewModel | null>(null)
  const [weeklyRoi, setWeeklyRoi] = useState<WeeklyLearningRoiViewModel | null>(null)
  const [retentionReminderPolicy, setRetentionReminderPolicy] = useState<RetentionReminderPolicy>(DEFAULT_RETENTION_REMINDER_POLICY)
  const [continueReadingCount, setContinueReadingCount] = useState(0)
  const [pageDigest, setPageDigest] = useState<PageDigestRecord | null>(null)
  const [activePageUrl, setActivePageUrl] = useState<string | null>(null)
  const [digestLoading, setDigestLoading] = useState(false)
  const [studyActionResult, setStudyActionResult] = useState<{ actionId: string; text: string } | null>(null)
  const [studyActionRunningId, setStudyActionRunningId] = useState<string | null>(null)
  const [sentenceStateById, setSentenceStateById] = useState<Record<string, PopupSentenceState>>({})
  const [speakingSentenceId, setSpeakingSentenceId] = useState<string | null>(null)
  const [selectedSentenceIndex, setSelectedSentenceIndex] = useState(0)
  const [currentPageSavedSentenceKeys, setCurrentPageSavedSentenceKeys] = useState<string[]>([])
  const [currentPageSavedReviewSummary, setCurrentPageSavedReviewSummary] = useState<CurrentPageSavedReviewSummary | null>(null)
  const [pageAssetSaveStatus, setPageAssetSaveStatus] = useState<PopupPageAssetSaveStatus>("idle")
  const [pageAssetSaveMessage, setPageAssetSaveMessage] = useState<string | null>(null)
  const [studySpeaking, setStudySpeaking] = useState(false)
  const [iosBootstrapStatus, setIosBootstrapStatus] = useState<{
    bridgeAvailable: boolean
    status: IosBootstrapRuntimeStatus | null
    history: IosBootstrapHistoryEvent[]
  }>({ bridgeAvailable: false, status: null, history: [] })
  const [iosBridgeActionMessage, setIosBridgeActionMessage] = useState("")
  const [videoNoteBusy, setVideoNoteBusy] = useState(false)
  const [videoNoteStatusMessage, setVideoNoteStatusMessage] = useState("")
  const [lastVideoNoteJobId, setLastVideoNoteJobId] = useState<string | null>(null)
  const [subtitleDiagnosticsExportStatus, setSubtitleDiagnosticsExportStatus] = useState<string | null>(null)
  const [supportReportStatus, setSupportReportStatus] = useState<string | null>(null)
  const [subtitleQualityTrend, setSubtitleQualityTrend] = useState<SubtitleQualityTrendPoint[]>([])
  const hasUnsavedChangesRef = useRef(false)
  const isMountedRef = useRef(true)
  const signInPanelRef = useRef<HTMLDetailsElement | null>(null)
  const signInEmailInputRef = useRef<HTMLInputElement | null>(null)
  const saveSequenceRef = useRef<Promise<void>>(Promise.resolve())
  const saveRevisionRef = useRef(0)
  const siteRuleSaveTimerRef = useRef<number | null>(null)
  const pendingSiteRuleDraftRef = useRef<AstraConfig | null>(null)
  const sentenceDeckRevisionRef = useRef(0)
  const primerViewEventKeyRef = useRef<string | null>(null)
  const proValueSeenEventKeyRef = useRef<string | null>(null)
  const proValueMomentSeenKeysRef = useRef<Set<string>>(new Set())
  const upgradePromptViewedKeysRef = useRef<Set<string>>(new Set())
  const subtitleQualityTrendKeyRef = useRef<string | null>(null)

  const effectiveSiteContext = activePageUrl ?? activeSiteKey

  const persistedResolvedSite = useMemo(
    () => resolveSiteTranslationSettings(persistedConfig, effectiveSiteContext),
    [persistedConfig, effectiveSiteContext],
  )

  const draftResolvedSite = useMemo(
    () => resolveSiteTranslationSettings(configDraft, effectiveSiteContext),
    [configDraft, effectiveSiteContext],
  )

  const subtitleQualityControls = configDraft.subtitleQualityControls ?? DEFAULT_SUBTITLE_QUALITY_CONTROLS
  const subtitleQualityPollIntervalMs = subtitleQualityControls.popupPollIntervalMs

  useEffect(() => {
    const subtitleQuality = translationState?.subtitleQuality
    if (!subtitleQuality?.active) {
      subtitleQualityTrendKeyRef.current = null
      setSubtitleQualityTrend([])
      return
    }

    const trendKey = [
      subtitleQuality.capturedAt,
      subtitleQuality.pendingRequestCount,
      subtitleQuality.cacheSize,
      subtitleQuality.status,
    ].join(":")
    if (subtitleQualityTrendKeyRef.current === trendKey) return
    subtitleQualityTrendKeyRef.current = trendKey

    const point: SubtitleQualityTrendPoint = {
      capturedAt: subtitleQuality.capturedAt,
      freshnessMs: Math.max(0, Date.now() - subtitleQuality.capturedAt),
      pendingRequestCount: subtitleQuality.pendingRequestCount,
      cacheSize: subtitleQuality.cacheSize,
    }
    setSubtitleQualityTrend((current) => [...current, point].slice(-8))
  }, [translationState?.subtitleQuality])

  const currentDigestFingerprint = useMemo(() => {
    const url = activePageUrl ?? studyContext?.pageUrl
    if (!url || !studyContext) return null

    return computeFingerprint({
      url,
      title: studyContext.pageTitle ?? "",
      contentSummary: buildStudyDigestContentSummary(studyContext),
      targetLang: configDraft.targetLang,
      languageLevel: configDraft.languageLevel,
    })
  }, [
    activePageUrl,
    configDraft.languageLevel,
    configDraft.targetLang,
    studyContext,
  ])

  const digestStale = pageDigest !== null
    && currentDigestFingerprint !== null
    && isDigestStale(pageDigest, currentDigestFingerprint)

  const popupStudyDeck = useMemo(
    () => derivePopupStudyDeck(studyContext),
    [studyContext],
  )

  const studyActionText = useMemo(() => {
    if (pageDigest) {
      const digestPoints = pageDigest.keyPoints.slice(0, 3).join(" ")
      return [
        pageDigest.headline,
        pageDigest.summary,
        digestPoints,
      ].filter(Boolean).join("\n\n")
    }

    return popupStudyDeck.actionText
  }, [pageDigest, popupStudyDeck.actionText])

  const studyQuickActions = useMemo(
    () => (configDraft.customActions ?? []).filter((action) => action.enabled).slice(0, 3),
    [configDraft.customActions],
  )

  const studySentences = popupStudyDeck.sentences

  const canSpeakStudy = studyActionText.trim().length > 0
    && persistedConfig.tts.enabled
    && isTtsSupported(persistedConfig.tts.engine)

  const studySentenceDeckFallbackMessage = useMemo(
    () => popupStudyDeck.sentenceSource === "content_summary" || popupStudyDeck.sentenceSource === "meta_description"
      ? t("popup_studySentenceDeckFallback")
      : null,
    [popupStudyDeck.sentenceSource],
  )

  const savedSentenceKeySet = useMemo(
    () => new Set(currentPageSavedSentenceKeys),
    [currentPageSavedSentenceKeys],
  )

  const sentenceCards = useMemo<PopupSentenceCardViewModel[]>(
    () => studySentences.map((sentence, index) => {
      const id = buildPopupSentenceCardId(index, sentence)
      const state = sentenceStateById[id] ?? createPopupSentenceState()
      const persistedSaved = savedSentenceKeySet.has(id)
        || savedSentenceKeySet.has(buildLegacyPopupSentenceSaveKey(sentence))
      const saveStatus: PopupSentenceSaveStatus = state.saveStatus === "saving"
        ? "saving"
        : (state.saveStatus === "saved" || persistedSaved ? "saved" : "idle")

      return {
        id,
        text: sentence,
        index,
        selected: index === selectedSentenceIndex,
        explainStatus: state.explainStatus,
        explanationText: state.explanationText,
        explanationLanguageLevel: state.explanationLanguageLevel,
        explanationExplainMode: state.explanationExplainMode,
        explanationGlossaryTerms: state.explanationGlossaryTerms,
        explainProfileLabel: formatExplainProfileLabel({
          languageLevel: state.explanationLanguageLevel ?? configDraft.languageLevel,
          explainMode: state.explanationExplainMode ?? configDraft.explainMode,
        }),
        glossaryEvidenceLabel: formatGlossaryEvidenceLabel(state.explanationGlossaryTerms),
        saveStatus,
        savedEntryId: state.savedEntryId,
        speaking: speakingSentenceId === id,
      }
    }),
    [savedSentenceKeySet, selectedSentenceIndex, sentenceStateById, speakingSentenceId, studySentences],
  )

  const sentenceCardById = useMemo(
    () => new Map(sentenceCards.map((card) => [card.id, card])),
    [sentenceCards],
  )

  const sentenceActionLock = useMemo(
    () => derivePopupSentenceActionLock(sentenceStateById),
    [sentenceStateById],
  )

  useEffect(() => {
    sentenceDeckRevisionRef.current += 1
    stopSpeaking()
    setSentenceStateById({})
    setSpeakingSentenceId(null)
    setStudySpeaking(false)
    setSelectedSentenceIndex(0)
  }, [studyContext?.pageUrl, popupStudyDeck.sentenceSource, popupStudyDeck.sentenceSourceText])

  useEffect(() => {
    setSelectedSentenceIndex((current) => {
      if (studySentences.length === 0) return 0
      return Math.min(current, studySentences.length - 1)
    })
  }, [studySentences])

  const refreshTranslationState = async () => {
    const stateResponse = await getActiveTabTranslationState()
    if (stateResponse.ok) {
      setTranslationState(stateResponse.state)
      setContentAvailable(true)
      setStatusMessage("")
    } else {
      setTranslationState(stateResponse.state ?? null)
      setContentAvailable(stateResponse.error.code !== "CONTENT_UNAVAILABLE")
      setStatusMessage(getSafeAiUnavailableCopy(stateResponse.error))
    }
  }

  const refreshAll = async () => {
    const [config, siteKey, device, storedSession, history, currentDueCount, studyContextResponse, usage, cacheStatsResult, studyStore, vocabularyEntries, iosStatus, continuitySync, ownedReadingItems, reminderPolicy] = await Promise.all([
      readConfig(),
      getActiveSiteKey(),
      ensureAstraDeviceIdentity(),
      readAstraSession(),
      getReadingHistory(),
      getDueVocabularyCount(),
      getActiveTabStudyContext(),
      getTranslationUsageSummary(),
      getTranslationCacheStats(),
      getStudyProgress(),
      getVocabularyEntries(),
      fetchIosBootstrapRuntimeStatus(),
      getLearningContinuitySyncStatus(),
      listOwnedReadingItems(),
      readRetentionReminderPolicy(),
    ])
    setRecentHistory(history.slice(0, 3))
    setDueCount(currentDueCount)
    setVocabularyTotalCount(vocabularyEntries.length)
    setRetentionReminderPolicy(reminderPolicy)
    setContinueReadingCount(ownedReadingItems.filter((item) => item.status === "in_progress" || item.status === "saved").length)
    setStudyContext(studyContextResponse.ok ? studyContextResponse.context : null)
    setUsageSummary(usage)
    setTranslationCacheStats(cacheStatsResult.ok ? cacheStatsResult.stats : null)
    setIosBootstrapStatus(iosStatus)
    const phaseOneStatus = continuitySync.ok ? continuitySync.status : null
    setLearningContinuitySyncStatus(phaseOneStatus)

    // Derive study loop from the http(s) tab we treat as "current reading" (popup-as-tab safe).
    const activeHttp = await resolveActiveHttpTab()
    const currentUrl = activeHttp?.url
    setActivePageUrl(currentUrl ?? null)
    setStudyLoop(deriveStudyLoopViewModel(studyStore, currentUrl))
    const weeklyStudyRoi = deriveWeeklyStudyProgressRoi(studyStore)
    const learningAssetProjection = buildLearningAssetProjection({ vocabularyEntries, ownedReadingItems })
    setWeeklyRoi({
      study: weeklyStudyRoi,
      vocabulary: deriveWeeklyVocabularyRoi(vocabularyEntries, {
        windowStartAt: weeklyStudyRoi.window.startAt,
        windowEndAt: weeklyStudyRoi.window.endAt,
      }),
      reviewableLearningMoments: deriveWeeklyReviewableLearningMoments(learningAssetProjection, {
        weekStartAt: weeklyStudyRoi.window.startAt,
        weekEndAt: weeklyStudyRoi.window.endAt,
        excludeSampleSources: true,
      }),
      generatedAt: Date.now(),
    })
    const currentStudyUrl = currentUrl ?? (studyContextResponse.ok ? studyContextResponse.context.pageUrl : undefined)
    const pageAlreadyAssetized = currentStudyUrl ? hasSavedOwnedArticleForUrl(ownedReadingItems, currentStudyUrl) : false
    setPageAssetSaveStatus(pageAlreadyAssetized ? "saved" : "idle")
    setPageAssetSaveMessage(pageAlreadyAssetized ? t("popup_contentAssetizationAlreadySaved") : null)
    const currentPageSavedEntries = currentStudyUrl
      ? vocabularyEntries.filter((entry) => isVocabularyEntryFromStudyUrl(entry, currentStudyUrl))
      : []
    setCurrentPageSavedReviewSummary(
      currentStudyUrl && currentPageSavedEntries.length > 0
        ? {
            studyUrl: currentStudyUrl,
            count: currentPageSavedEntries.length,
            entryId: currentPageSavedEntries[0]?.id,
          }
        : null,
    )
    setCurrentPageSavedSentenceKeys(
      currentStudyUrl
        ? Array.from(new Set(currentPageSavedEntries
          .flatMap((entry) => {
            const popupSentenceIndex = entry.sourceContext?.surface === "popup_deep_read"
              ? entry.sourceContext.sentenceIndex
              : undefined
            const popupSentenceText = (entry.sourceContext?.sentenceText ?? entry.text).trim()
            if (typeof popupSentenceIndex === "number") {
              return [buildPopupSentenceCardId(popupSentenceIndex, popupSentenceText)]
            }

            return [buildLegacyPopupSentenceSaveKey(entry.text.trim())]
          })))
        : [],
    )

    // Load cached page digest for the current URL
    if (currentUrl) {
      try {
        const digest = await getPageDigest(currentUrl)
        setPageDigest(digest)
      } catch {
        setPageDigest(null)
      }
    } else {
      setPageDigest(null)
    }

    let session = storedSession
    let account: AstraAccount | null = null
    let accountUsage: AstraUsageSnapshot | null = null
    let remote: AstraContinuityRemoteSnapshot | null = null
    let continuityMessage: string | null = null
    if (storedSession?.identityMode === "authenticated") {
      try {
        session = await refreshAstraSession({
          baseURL: storedSession.relayBaseURL,
          sessionToken: storedSession.sessionToken,
        })
        await saveAstraSession(session)
      } catch (error) {
        continuityMessage = error instanceof Error ? error.message : "Failed to refresh Astra session"
        await clearAstraSession()
        session = null
        account = null
        remote = {
          error: continuityMessage,
        }
      }

      if (session) {
        const [summaryResult, continuityResult] = await Promise.allSettled([
          fetchAstraAccountSummary({
            baseURL: session.relayBaseURL,
            sessionToken: session.sessionToken,
            deviceId: device.deviceId,
          }),
          fetchAstraContinuitySnapshot({
            baseURL: session.relayBaseURL,
            sessionToken: session.sessionToken,
            deviceId: device.deviceId,
            includePull: false,
          }),
        ])
        account = summaryResult.status === "fulfilled" ? summaryResult.value.account : null
        accountUsage = summaryResult.status === "fulfilled" ? summaryResult.value.usage : null
        remote = continuityResult.status === "fulfilled"
          ? continuityResult.value
          : {
              error: continuityResult.reason instanceof Error
                ? continuityResult.reason.message
                : "Failed to load continuity status.",
            }
      }
    }
    if (!hasUnsavedChangesRef.current) {
      setConfigDraft(config)
    }
    setPersistedConfig(config)
    setActiveSiteKey(siteKey)
    setPageAccessState(await getPageAccessState(activeHttp ? { id: activeHttp.id, url: activeHttp.url } : null))
    setAuthSession(session)
    setAuthAccount(account)
    setAuthUsage(accountUsage)
    setDeviceIdentity(device)
    setContinuityRemote(remote)
    setContinuityStatus(buildContinuityStatus({
      config,
      session,
      device,
      remote,
      phaseOne: phaseOneStatus,
    }))

    await refreshTranslationState()
    if (continuityMessage) {
      setStatusMessage(continuityMessage)
    }
  }

  useEffect(() => {
    void refreshAll()
  }, [])

  useEffect(() => {
    void getLearningLoopCopyVariant().then((variant) => {
      if (isMountedRef.current) {
        setLearningLoopCopyVariantState(variant)
      }
    })
    void getLearningLoopUpgradePromptVariant().then((variant) => {
      if (isMountedRef.current) {
        setUpgradePromptVariant(variant)
      }
    })
  }, [])

  useEffect(() => {
    if (!deviceIdentity) return
    setContinuityStatus(buildContinuityStatus({
      config: persistedConfig,
      session: authSession,
      device: deviceIdentity,
      remote: continuityRemote,
      phaseOne: learningContinuitySyncStatus,
    }))
  }, [authSession, continuityRemote, deviceIdentity, learningContinuitySyncStatus, persistedConfig])

  useEffect(() => () => {
    stopSpeaking()
  }, [])

  useEffect(() => {
    if (!signInPanelOpen) return undefined

    const timer = window.setTimeout(() => {
      signInPanelRef.current?.scrollIntoView?.({ block: "center", behavior: "smooth" })
      signInEmailInputRef.current?.focus()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [signInFocusRequestTick, signInPanelOpen])

  const handleGenerateDigest = async () => {
    if (!studyContext) return
    setDigestLoading(true)
    try {
      const contentSummary = buildStudyDigestContentSummary(studyContext)
      const digest = await generatePageDigest({
        pageTitle: studyContext.pageTitle ?? "",
        contentSummary,
        targetLang: configDraft.targetLang,
        languageLevel: configDraft.languageLevel,
      })
      const activeHttp = await resolveActiveHttpTab()
      const url = activeHttp?.url ?? studyContext.pageUrl ?? ""
      const hostname = studyContext.hostname ?? ""
      const record = await savePageDigest(
        {
          url,
          hostname,
          title: studyContext.pageTitle ?? "",
          targetLang: configDraft.targetLang,
          languageLevel: configDraft.languageLevel,
          contentSummary,
        },
        digest,
      )
      setPageDigest(record)
      setStudyActionResult(null)
    } catch {
      // Digest generation failed — silently ignore
    } finally {
      setDigestLoading(false)
    }
  }

  const refreshStudyLoopForUrl = async (url: string) => {
    const studyStore = await getStudyProgress()
    setStudyLoop(deriveStudyLoopViewModel(studyStore, url))
  }

  const triggerLearningContinuitySync = async (reason: string, options: { surfaceError?: boolean } = {}) => {
    setLearningContinuityCommitBusy(true)
    try {
      const result = await commitLearningContinuitySync(reason)
      if (result.status && isMountedRef.current) {
        setLearningContinuitySyncStatus(result.status)
      }
      if (!result.ok && options.surfaceError && isMountedRef.current) {
        setStatusMessage(getSafeAiUnavailableCopy(result.error))
      }
    } finally {
      if (isMountedRef.current) {
        setLearningContinuityCommitBusy(false)
      }
    }
  }

  const buildStudyRecordMeta = () => {
    const url = activePageUrl ?? studyContext?.pageUrl
    if (!url) return null

    let fallbackHostname = ""
    try {
      fallbackHostname = new URL(url).hostname
    } catch {
      fallbackHostname = ""
    }

    return {
      url,
      hostname: studyContext?.hostname ?? currentPageHistory?.hostname ?? currentSite.hostname ?? fallbackHostname,
      title: studyContext?.pageTitle ?? currentPageHistory?.title ?? url,
    }
  }

  const recordStudySteps = async (
    steps: Array<"read" | "guided_read" | "explain" | "vocab_save">,
    meta: ReturnType<typeof buildStudyRecordMeta> = buildStudyRecordMeta(),
  ) => {
    if (!meta) return

    for (const step of steps) {
      await recordStudyEvent({
        url: meta?.url,
        hostname: meta.hostname,
        title: meta.title,
        step,
      })
    }

    await refreshStudyLoopForUrl(meta.url)
  }

  const renderStudyPrompt = (template: string): string => {
    const selectionContext = studyContext?.contentSummary ?? studyContext?.metaDescription ?? ""
    return template
      .replaceAll("{{text}}", studyActionText)
      .replaceAll("{{targetLang}}", configDraft.targetLang)
      .replaceAll("{{selectionContext}}", selectionContext)
  }

  const handleRunStudyAction = async (actionId: string) => {
    const action = studyQuickActions.find((item) => item.id === actionId)
    if (!action || !studyActionText || studyActionRunningId) return

    setStudyActionRunningId(actionId)
    setStudyActionResult(null)

    try {
      const result = await translateTexts({
        texts: [studyActionText],
        targetLang: configDraft.targetLang,
        serviceMode: configDraft.serviceMode,
        context: studyContext ?? undefined,
        task: "custom",
        customSystemPrompt: renderStudyPrompt(action.systemPrompt),
      })

      setStudyActionResult({
        actionId,
        text: result.ok ? (result.translations[0] ?? "") : `⚠ ${getSafeAiUnavailableCopy(result.error)}`,
      })
    } catch (error) {
      setStudyActionResult({
        actionId,
        text: `⚠ ${getSafeAiUnavailableCopy({ code: "UNKNOWN", message: error instanceof Error ? error.message : "Request failed." })}`,
      })
    } finally {
      setStudyActionRunningId(null)
    }
  }

  const resolveSentenceTarget = (sentenceIndex?: number) => {
    const fallbackIndex = sentenceIndex ?? selectedSentenceIndex
    const targetIndex = fallbackIndex >= 0 && fallbackIndex < studySentences.length
      ? fallbackIndex
      : 0
    const targetSentence = studySentences[targetIndex]?.trim() ?? ""
    if (!targetSentence) return null

    return {
      targetIndex,
      targetSentence,
      targetSentenceId: buildPopupSentenceCardId(targetIndex, targetSentence),
    }
  }

  const handleExplainSentence = async (sentenceIndex?: number) => {
    const target = resolveSentenceTarget(sentenceIndex)
    if (!target || studyActionRunningId) return

    const { targetIndex, targetSentence, targetSentenceId } = target
    const currentCard = sentenceCardById.get(targetSentenceId) ?? null
    if (sentenceActionLock.type !== "idle") return

    setSelectedSentenceIndex(targetIndex)

    if (currentCard?.explainStatus === "explained" && currentCard.explanationText) {
      return
    }

    const meta = buildStudyRecordMeta()
    const deckRevision = sentenceDeckRevisionRef.current
    setSentenceStateById((current) => patchPopupSentenceState(current, targetSentenceId, {
      explainStatus: "explaining",
      explanationText: null,
    }))

    try {
      const matchedGlossaryTerms = getMatchedExplanationGlossaryTerms({
        source: targetSentence,
        glossaryTerms: configDraft.explanationGlossary,
      })
      const serializedExplanationGlossary = serializeExplanationGlossary(configDraft.explanationGlossary)
      const result = await translateExplanationWithQualityRetry({
        source: targetSentence,
        targetLang: configDraft.targetLang,
        serviceMode: configDraft.serviceMode,
        context: {
          ...(studyContext
            ? { ...studyContext, selectionContext: targetSentence }
            : { selectionContext: targetSentence }),
          ...(serializedExplanationGlossary
            ? { explanationGlossary: serializedExplanationGlossary }
            : {}),
        },
        languageLevel: configDraft.languageLevel,
        explainMode: configDraft.explainMode,
        requiredGlossaryTerms: matchedGlossaryTerms,
      })

      const explanationAccepted = result.ok
      const text = result.ok
        ? result.text
        : `Warning: ${getSafeAiUnavailableCopy({ code: "UNKNOWN", message: result.message }, { fallbackCopy: result.message })}`

      if (sentenceDeckRevisionRef.current === deckRevision) {
        setSentenceStateById((current) => patchPopupSentenceState(current, targetSentenceId, {
          explainStatus: explanationAccepted ? "explained" : "idle",
          explanationText: text,
          ...(explanationAccepted
            ? {
                explanationLanguageLevel: configDraft.languageLevel,
                explanationExplainMode: configDraft.explainMode,
                explanationGlossaryTerms: matchedGlossaryTerms,
              }
            : {}),
        }))
      }

      if (explanationAccepted) {
        recordLearningLoopEvent("sentence_explained", {
          pageUrl: meta?.url,
          sentenceIndex: targetIndex,
          sentenceHash: buildSentenceAnchor(targetSentence, targetIndex)?.sentenceHash,
          source: "popup_deep_read",
          variant: learningLoopCopyVariant,
          ...buildPersonalizedStrategyTelemetry(studyLoop?.personalizedStrategy),
        })
        await recordStudySteps(["explain"], meta)
      }
    } catch (error) {
      if (sentenceDeckRevisionRef.current === deckRevision) {
        setSentenceStateById((current) => patchPopupSentenceState(current, targetSentenceId, {
          explainStatus: "idle",
          explanationText: `Warning: ${getSafeAiUnavailableCopy({ code: "UNKNOWN", message: error instanceof Error ? error.message : "Request failed." })}`,
        }))
      }
    }
  }

  const handleSaveSentence = async (sentenceIndex: number) => {
    const target = resolveSentenceTarget(sentenceIndex)
    if (!target) return

    const { targetIndex, targetSentence, targetSentenceId } = target
    const currentCard = sentenceCardById.get(targetSentenceId) ?? null
    if (sentenceActionLock.type !== "idle" || currentCard?.saveStatus === "saved") return

    const meta = buildStudyRecordMeta()
    if (!meta) return

    setSelectedSentenceIndex(targetIndex)

    const deckRevision = sentenceDeckRevisionRef.current
    setSentenceStateById((current) => patchPopupSentenceState(current, targetSentenceId, {
      saveStatus: "saving",
    }))

    try {
      const ownedReadingItem = await upsertOwnedArticleFromUrl({
        url: meta.url,
        title: studyContext?.pageTitle ?? meta.hostname ?? targetSentence,
        status: "saved",
      })
      setPageAssetSaveStatus("saved")
      setPageAssetSaveMessage(t("popup_contentAssetizationSavedHint"))

      const savedEntry = await saveVocabularyEntry({
        text: targetSentence,
        explanation: currentCard?.explainStatus === "explained" ? currentCard.explanationText ?? undefined : undefined,
        context: popupStudyDeck.sentenceSourceText || undefined,
        sourceContext: {
          surface: "popup_deep_read",
          pageTitle: studyContext?.pageTitle,
          pageUrl: meta.url,
          hostname: meta.hostname,
          contentSummary: studyContext?.contentSummary,
          articleExcerpt: studyContext?.articleExcerpt,
          sentenceText: targetSentence,
          sentenceHash: buildSentenceAnchor(targetSentence, targetIndex)?.sentenceHash,
          sentenceIndex: targetIndex,
          languageLevel: currentCard?.explanationLanguageLevel ?? configDraft.languageLevel,
          explainMode: currentCard?.explanationExplainMode ?? configDraft.explainMode,
          ...(currentCard?.explanationGlossaryTerms && currentCard.explanationGlossaryTerms.length > 0
            ? { matchedGlossaryTerms: currentCard.explanationGlossaryTerms }
            : {}),
          ...buildOwnedReadingVocabularySourceLink(ownedReadingItem),
        },
        url: meta.url,
        hostname: meta.hostname,
      })
      recordLearningLoopEvent("sentence_saved", {
        pageUrl: meta.url,
        sentenceIndex: targetIndex,
        sentenceHash: buildSentenceAnchor(targetSentence, targetIndex)?.sentenceHash,
        source: "popup_deep_read",
        sourceType: "article",
        hasReviewCard: true,
        variant: learningLoopCopyVariant,
        ...buildPersonalizedStrategyTelemetry(studyLoop?.personalizedStrategy),
      })
      await recordStudySteps(["vocab_save"], meta)
      const nextDueCount = await getDueVocabularyCount()

      if (sentenceDeckRevisionRef.current === deckRevision) {
        setSentenceStateById((current) => patchPopupSentenceState(current, targetSentenceId, {
          saveStatus: "saved",
          savedEntryId: savedEntry.id,
        }))
        setCurrentPageSavedSentenceKeys((current) => {
          const nextKeys = new Set(current)
          nextKeys.add(targetSentenceId)
          return Array.from(nextKeys)
        })
        setCurrentPageSavedReviewSummary((current) => ({
          studyUrl: current?.studyUrl ?? meta.url,
          count: (current?.count ?? 0) + 1,
          entryId: current?.entryId ?? savedEntry.id,
        }))
      }
      setDueCount(nextDueCount)
      void triggerLearningContinuitySync("popup-save")
    } catch {
      if (sentenceDeckRevisionRef.current === deckRevision) {
        setSentenceStateById((current) => patchPopupSentenceState(current, targetSentenceId, {
          saveStatus: "idle",
        }))
      }
    }
  }

  const handleReviewSavedSentence = (sentenceIndex: number) => {
    const target = resolveSentenceTarget(sentenceIndex)
    const savedEntryId = target
      ? sentenceCardById.get(target.targetSentenceId)?.savedEntryId
      : undefined

    if (savedEntryId) {
      const meta = buildStudyRecordMeta()
      if (meta?.url) {
        void openPageReviewLoop(meta.url, savedEntryId)
        return
      }

      void openFocusedReview(savedEntryId)
      return
    }

    openReviewPage()
  }

  const handleReviewCurrentPageSavedSentences = () => {
    if (!currentPageSavedReviewSummary?.studyUrl) {
      openReviewPage()
      return
    }

    void openPageReviewLoop(currentPageSavedReviewSummary.studyUrl, currentPageSavedReviewSummary.entryId)
  }

  const handleSaveCurrentPageAsset = async () => {
    const meta = buildStudyRecordMeta()
    if (!meta || pageAssetSaveStatus === "saving" || pageAssetSaveStatus === "saved") return

    setPageAssetSaveStatus("saving")
    setPageAssetSaveMessage(null)

    try {
      await upsertOwnedArticleFromUrl({
        url: meta.url,
        title: meta.title,
        status: "saved",
      })
      setPageAssetSaveStatus("saved")
      setPageAssetSaveMessage(t("popup_contentAssetizationSavedHint"))
      void triggerLearningContinuitySync("popup-content-assetization")
    } catch (error) {
      setPageAssetSaveStatus("error")
      setPageAssetSaveMessage(error instanceof Error ? error.message : t("popup_contentAssetizationSaveError"))
    }
  }

  const handleSelectSentence = (index: number) => {
    if (sentenceActionLock.type !== "idle") return
    if (index < 0 || index >= studySentences.length) return
    setSelectedSentenceIndex(index)
  }

  const handleToggleSentenceSpeech = async (sentenceIndex?: number) => {
    if (sentenceActionLock.type !== "idle") return
    const target = resolveSentenceTarget(sentenceIndex)
    if (!target) return

    const { targetIndex, targetSentence, targetSentenceId } = target
    setSelectedSentenceIndex(targetIndex)

    if (speakingSentenceId === targetSentenceId) {
      stopSpeaking()
      setSpeakingSentenceId(null)
      return
    }

    const config = await readConfig()
    const enabled = config.tts.enabled && isTtsSupported(config.tts.engine)
    if (!enabled) return

    stopSpeaking()
    const started = speak(targetSentence, {
      engine: config.tts.engine,
      voiceName: config.tts.voiceName,
      rate: config.tts.rate,
      pitch: config.tts.pitch,
      lang: configDraft.targetLang,
      onEnd: () => setSpeakingSentenceId(null),
      onError: () => setSpeakingSentenceId(null),
    })

    setStudySpeaking(false)
    setSpeakingSentenceId(started ? targetSentenceId : null)
  }

  const handleToggleStudySpeech = async () => {
    if (studySpeaking) {
      stopSpeaking()
      setStudySpeaking(false)
      return
    }

    if (!studyActionText.trim()) return

    const config = await readConfig()
    const enabled = config.tts.enabled && isTtsSupported(config.tts.engine)
    if (!enabled) return

    stopSpeaking()
    const started = speak(studyActionText, {
      engine: config.tts.engine,
      voiceName: config.tts.voiceName,
      rate: config.tts.rate,
      pitch: config.tts.pitch,
      lang: configDraft.targetLang,
      onEnd: () => setStudySpeaking(false),
      onError: () => setStudySpeaking(false),
    })

    setSpeakingSentenceId(null)
    setStudySpeaking(started)
  }

  useEffect(() => {
    if (!translationState?.subtitleQuality?.active) return undefined

    let stopped = false
    let timer: number | null = null

    const schedule = () => {
      if (!stopped) {
        timer = window.setTimeout(poll, subtitleQualityPollIntervalMs)
      }
    }

    const poll = () => {
      if (document.visibilityState === "hidden") {
        schedule()
        return
      }

      void refreshTranslationState().finally(schedule)
    }

    schedule()

    return () => {
      stopped = true
      if (timer !== null) {
        window.clearTimeout(timer)
      }
    }
  }, [translationState?.subtitleQuality?.active, subtitleQualityPollIntervalMs])

  useEffect(() => {
    const handleWindowFocus = () => {
      void refreshAll()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshAll()
      }
    }

    const handleTabActivated = () => {
      void refreshAll()
    }

    window.addEventListener("focus", handleWindowFocus)
    document.addEventListener("visibilitychange", handleVisibilityChange)
    browser.tabs.onActivated?.addListener(handleTabActivated)

    return () => {
      window.removeEventListener("focus", handleWindowFocus)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      browser.tabs.onActivated?.removeListener(handleTabActivated)
    }
  }, [])

  const takePendingSiteRuleDraft = () => {
    if (siteRuleSaveTimerRef.current !== null) {
      window.clearTimeout(siteRuleSaveTimerRef.current)
      siteRuleSaveTimerRef.current = null
    }

    const pendingDraft = pendingSiteRuleDraftRef.current
    pendingSiteRuleDraftRef.current = null
    return pendingDraft
  }

  const clearScheduledSiteRulePersist = () => {
    takePendingSiteRuleDraft()
  }

  const flushPendingSiteRulePersist = async () => {
    const pendingDraft = takePendingSiteRuleDraft()
    if (!pendingDraft) {
      return
    }

    await persistDraftConfig(pendingDraft, { retranslateActivePage: true })
  }

  useEffect(() => {
    const flushPendingSiteRules = () => {
      void flushPendingSiteRulePersist()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushPendingSiteRules()
      }
    }

    window.addEventListener("pagehide", flushPendingSiteRules)
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      window.removeEventListener("pagehide", flushPendingSiteRules)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      isMountedRef.current = false
      flushPendingSiteRules()
    }
  }, [])

  const persistDraftConfig = async (
    nextDraft: AstraConfig,
    options: { retranslateActivePage?: boolean } = {},
  ) => {
    const revision = ++saveRevisionRef.current

    const runPersist = async () => {
      try {
        const saveResult = await saveConfigInBackground({
          targetLang: nextDraft.targetLang,
          connectionMode: nextDraft.connectionMode,
          hoverTrigger: nextDraft.hoverTrigger,
          contentScope: nextDraft.contentScope,
          inputTranslation: nextDraft.inputTranslation,
          languageLevel: nextDraft.languageLevel,
          explainMode: nextDraft.explainMode,
          serviceMode: nextDraft.serviceMode,
          explanationGlossary: nextDraft.explanationGlossary,
          privacyMode: nextDraft.privacyMode,
          provider: {
            id: nextDraft.provider.id,
            accessToken: nextDraft.provider.accessToken,
            apiKey: nextDraft.provider.apiKey,
            relayBaseURL: nextDraft.provider.relayBaseURL ?? "",
            model: nextDraft.provider.model,
          },
          presentation: nextDraft.presentation,
          subtitleQualityControls: nextDraft.subtitleQualityControls ?? DEFAULT_SUBTITLE_QUALITY_CONTROLS,
          sites: nextDraft.sites,
          customActions: nextDraft.customActions,
        })
        if (!saveResult.ok) {
          throw new Error(saveResult.error.message)
        }

        const nextConfig = saveResult.config

        if (revision !== saveRevisionRef.current) {
          return
        }

        if (isMountedRef.current) {
          setConfigDraft(nextConfig)
          setPersistedConfig(nextConfig)
        }
        hasUnsavedChangesRef.current = false

        if (activeSiteKey) {
          const resolvedSite = resolveSiteTranslationSettings(nextConfig, activePageUrl ?? activeSiteKey)
          if (!resolvedSite.enabled) {
            await stopActiveTabTranslation()
          } else if (options.retranslateActivePage && translationState?.phase !== "idle" && contentAvailable) {
            await startActiveTabTranslation({
              targetLang: resolvedSite.targetLang,
              translationMode: resolvedSite.presentation.mode,
              translationTheme: resolvedSite.presentation.theme,
              contentScope: resolvedSite.contentScope,
            })
          }
        }

        if (isMountedRef.current) {
          await refreshTranslationState()
        }
      } catch (error) {
        if (revision !== saveRevisionRef.current) {
          return
        }
        if (isMountedRef.current) {
          setStatusMessage(error instanceof Error ? error.message : "Failed to save settings")
        }
      }
    }

    const pending = saveSequenceRef.current.catch(() => undefined).then(runPersist)
    saveSequenceRef.current = pending.then(() => undefined, () => undefined)
    await pending
  }

  const scheduleSiteRulePersist = (nextDraft: AstraConfig) => {
    hasUnsavedChangesRef.current = true
    pendingSiteRuleDraftRef.current = nextDraft
    if (siteRuleSaveTimerRef.current !== null) {
      window.clearTimeout(siteRuleSaveTimerRef.current)
    }

    siteRuleSaveTimerRef.current = window.setTimeout(() => {
      siteRuleSaveTimerRef.current = null
      const pendingDraft = pendingSiteRuleDraftRef.current
      pendingSiteRuleDraftRef.current = null
      if (!pendingDraft) {
        return
      }

      void persistDraftConfig(pendingDraft, { retranslateActivePage: true })
    }, 250)
  }

  const handleSaveConfig = async (patch: Partial<AstraConfig>) => {
    clearScheduledSiteRulePersist()

    const nextDraft: AstraConfig = {
      ...configDraft,
      ...patch,
      provider: {
        ...configDraft.provider,
        ...patch.provider,
      },
      presentation: {
        ...configDraft.presentation,
        ...patch.presentation,
      },
      subtitleQualityControls: {
        ...DEFAULT_SUBTITLE_QUALITY_CONTROLS,
        ...(configDraft.subtitleQualityControls ?? {}),
        ...(patch.subtitleQualityControls ?? {}),
      },
      sites: patch.sites ?? configDraft.sites,
      customActions: patch.customActions ?? configDraft.customActions,
    }

    setConfigDraft(nextDraft)
    await persistDraftConfig(nextDraft)
  }

  const handleSiteRuleChange = (mutate: (current: SiteConfig) => SiteConfig) => {
    if (!activeSiteKey) return

    setConfigDraft((current) => {
      const currentRule = current.sites[activeSiteKey] ?? {
        enabled: true,
        alwaysTranslate: false,
      }
      const nextRule = mutate(currentRule)
      const nextDraft = {
        ...current,
        sites: {
          ...current.sites,
          [activeSiteKey]: nextRule,
        },
      }

      scheduleSiteRulePersist(nextDraft)
      return nextDraft
    })
  }

  const refreshPageAccessState = async () => {
    const activeHttp = await resolveActiveHttpTab()
    setPageAccessState(await getPageAccessState(activeHttp ? { id: activeHttp.id, url: activeHttp.url } : null))
  }

  const handlePageAccessAction = async (action: "page" | "site" | "revoke-site" | "all-sites") => {
    setPageAccessMessage("")
    const activeHttp = await resolveActiveHttpTab()
    const tab = activeHttp ? { id: activeHttp.id, url: activeHttp.url } : null
    const result = action === "revoke-site"
      ? await revokePageAccess("site", tab)
      : await requestPageAccess(action === "all-sites" ? "all-sites" : action, tab)
    setPageAccessState(result.state)
    setPageAccessMessage(result.message)

    if (action === "revoke-site" && activeSiteKey) {
      const nextDraft: AstraConfig = {
        ...configDraft,
        sites: {
          ...configDraft.sites,
          [activeSiteKey]: {
            ...(configDraft.sites[activeSiteKey] ?? { enabled: true, alwaysTranslate: false }),
            enabled: false,
            alwaysTranslate: false,
          },
        },
      }
      setConfigDraft(nextDraft)
      await persistDraftConfig(nextDraft)
      await stopActiveTabTranslation()
    } else {
      await refreshTranslationState()
    }

    await refreshPageAccessState()
  }

  const handleSiteRulesQuickFix = (action: SiteRulesQuickFixAction) => {
    handleSiteRuleChange((siteRule) => {
      const nextRule: SiteConfig = { ...siteRule }

      if (action === "clear-include-selectors") {
        delete nextRule.selectors
      }
      if (action === "clear-exclude-selectors") {
        delete nextRule.excludeSelectors
      }

      return nextRule
    })
  }

  const handleTargetLangChange = (lang: string) => {
    setConfigDraft((current) => ({ ...current, targetLang: lang }))
    void handleSaveConfig({ targetLang: lang })
  }

  const handleModeChange = (mode: "bilingual" | "translation-only") => {
    setConfigDraft((current) => ({
      ...current,
      presentation: { ...current.presentation, mode },
    }))
    void handleSaveConfig({ presentation: { ...configDraft.presentation, mode } })
  }

  const handleConfigChange = (patch: Partial<AstraConfig>) => {
    setConfigDraft((current) => ({ ...current, ...patch }))
    void handleSaveConfig(patch)
  }

  const persistSubtitleQualityControlsPatch = async (
    patch: Partial<SubtitleQualityControls>,
    nextControls: SubtitleQualityControls,
  ) => {
    const revision = ++saveRevisionRef.current

    const runPersist = async () => {
      try {
        const saveResult = await saveConfigInBackground({ subtitleQualityControls: patch })
        if (!saveResult.ok) {
          throw new Error(saveResult.error.message)
        }

        if (revision !== saveRevisionRef.current) return
        const savedControls = saveResult.config.subtitleQualityControls ?? nextControls
        const normalizedControls = {
          ...savedControls,
          ...nextControls,
        }
        if (isMountedRef.current) {
          setConfigDraft((current) => ({ ...current, subtitleQualityControls: normalizedControls }))
          setPersistedConfig((current) => ({ ...current, subtitleQualityControls: normalizedControls }))
        }
        hasUnsavedChangesRef.current = false
      } catch (error) {
        if (revision !== saveRevisionRef.current) return
        if (isMountedRef.current) {
          setStatusMessage(error instanceof Error ? error.message : "Failed to save Subtitle QC settings")
        }
      }
    }

    const pending = saveSequenceRef.current.catch(() => undefined).then(runPersist)
    saveSequenceRef.current = pending.then(() => undefined, () => undefined)
    await pending
  }

  const handleSubtitleQualityControlsChange = (patch: Partial<SubtitleQualityControls>) => {
    const nextControls = {
      ...DEFAULT_SUBTITLE_QUALITY_CONTROLS,
      ...subtitleQualityControls,
      ...patch,
    }
    setConfigDraft((current) => ({
      ...current,
      subtitleQualityControls: nextControls,
    }))
    void persistSubtitleQualityControlsPatch(patch, nextControls)
  }

  const handleExportPageReport = async () => {
    const generatedAt = new Date().toISOString()
    const featureSurface = isSupportedVideoTab ? "video" : "page"
    const issueCategory = isSupportedVideoTab ? "video_subtitles" : "page_not_working"
    const bundle = buildSupportBundle({
      extensionVersion: browser.runtime.getManifest?.()?.version ?? "0.1.0",
      browser: deviceIdentity?.browserFamily ?? "unknown",
      os: deviceIdentity?.platform ?? "unknown",
      locale: typeof navigator === "undefined" ? "unknown" : navigator.language,
      featureSurface,
      action: "report_this_page",
      issueCategory,
      errorCategory: translationState?.lastError?.code ?? undefined,
      lastErrorCategory: translationState?.lastError?.code ?? undefined,
      runtimeSurface: "popup",
      timestamp: generatedAt,
      hostname: activePageUrl ?? currentSite.hostname,
      privacyMode: persistedConfig.privacyMode,
      membershipState: authAccount?.plan ?? authSession?.plan ?? "unknown",
      userConsent: true,
      userMessageIncluded: false,
      contactIncluded: false,
    })

    const deviceId = authSession?.deviceId ?? deviceIdentity?.deviceId ?? ""
    const remoteSession = authSession?.identityMode === "authenticated"
      && authSession.sessionToken
      && authSession.relayBaseURL
      && deviceId
      ? authSession
      : null

    if (remoteSession) {
      try {
        const result = await submitAstraSupportReport({
          baseURL: remoteSession.relayBaseURL,
          sessionToken: remoteSession.sessionToken,
          deviceId,
          bundle,
        })
        recordLearningLoopEvent("support_report_submitted", {
          source: "popup",
          reportId: result.report.reportId,
          issueCategory,
          featureSurface,
          knownIssueMatched: Boolean(result.report.knownIssue),
        })
        if (result.report.knownIssue) {
          recordLearningLoopEvent("known_issue_viewed", {
            source: "popup",
            issueId: result.report.knownIssue.issueId,
            status: result.report.knownIssue.status,
            surface: result.report.knownIssue.featureSurface,
          })
        }
        setSupportReportStatus([
          `Submitted metadata report ${result.report.reportId}.`,
          result.report.knownIssue ? describeKnownIssueForUser(result.report.knownIssue) : null,
          describeSupportBundle(bundle),
        ].filter(Boolean).join("\n"))
        return
      } catch {
        try {
          downloadLocalJsonFile(buildPageReportBundleFileName(generatedAt), bundle)
          setSupportReportStatus(`Support report submission failed; downloaded metadata-only JSON instead.\n${describeSupportBundle(bundle)}`)
          return
        } catch (error) {
          setSupportReportStatus(error instanceof Error ? error.message : "Report export failed.")
          return
        }
      }
    }

    try {
      downloadLocalJsonFile(buildPageReportBundleFileName(generatedAt), bundle)
      setSupportReportStatus(describeSupportBundle(bundle))
    } catch (error) {
      setSupportReportStatus(error instanceof Error ? error.message : "Report export failed.")
    }
  }

  const handleExportSubtitleDiagnostics = () => {
    const generatedAt = new Date().toISOString()
    const payload = {
      schema: "astra.subtitle-qc.local-diagnostics.v1",
      generatedAt,
      localOnly: true,
      popup: {
        phase: currentPhase,
        targetLang: translationState?.targetLang ?? persistedResolvedSite.targetLang,
        presentation: currentPresentation,
        hostname: currentSite.hostname,
        siteEnabled: statusSiteEnabled,
        contentAvailable,
        progress: currentProgress ?? null,
        lastError: translationState?.lastError ?? null,
      },
      subtitleQuality: translationState?.subtitleQuality ?? null,
      subtitleQualityControls: subtitleQualityControls satisfies SubtitleQualityControls,
      runtimeDiagnostics: translationState?.diagnostics ?? null,
    }

    try {
      downloadLocalJsonFile(buildSubtitleDiagnosticsFileName(generatedAt), payload)
      setSubtitleDiagnosticsExportStatus("Diagnostics JSON exported locally.")
    } catch (error) {
      setSubtitleDiagnosticsExportStatus(error instanceof Error ? error.message : "Diagnostics export failed.")
    }
  }

  const startTranslation = async (contentScope: ContentScope) => {
    try {
      const response = await startActiveTabTranslation({
        targetLang: persistedResolvedSite.targetLang,
        translationMode: persistedResolvedSite.presentation.mode,
        translationTheme: persistedResolvedSite.presentation.theme,
        contentScope,
      })
      if (response.ok) {
        setTranslationState(response.state)
        setContentAvailable(true)
        setStatusMessage("")
        return true
      } else {
        setTranslationState(response.state ?? null)
        setContentAvailable(response.error.code !== "CONTENT_UNAVAILABLE")
        setStatusMessage(getSafeAiUnavailableCopy(response.error))
        return false
      }
    } catch (error) {
      setStatusMessage(getSafeAiUnavailableCopy({ code: "UNKNOWN", message: error instanceof Error ? error.message : "Translation request failed" }))
      return false
    }
  }

  const translate = async () => {
    const started = await startTranslation(resolveTranslationSurfaceMode(persistedResolvedSite.contentScope))
    if (started) {
      await recordStudySteps(["read"])
    }
  }

  const openDeepReadPage = () => {
    if (studyContext) {
      void saveDeepReadSession({
        context: studyContext,
        selectedSentenceIndex,
      })
      recordLearningLoopEvent("deep_read_opened", {
        source: "popup",
        pageUrl: studyContext.pageUrl,
        sentenceIndex: selectedSentenceIndex,
        sentenceHash: buildSentenceAnchor(studySentences[selectedSentenceIndex] ?? "", selectedSentenceIndex)?.sentenceHash,
        variant: learningLoopCopyVariant,
        ...buildPersonalizedStrategyTelemetry(studyLoop?.personalizedStrategy),
      })
    }
    void browser.tabs.create({ url: browser.runtime.getURL("/deep-read.html" as "/popup.html") })
  }

  const removeTranslation = async () => {
    try {
      const response = await stopActiveTabTranslation()
      if (response.ok) {
        setTranslationState(response.state)
        setContentAvailable(true)
        setStatusMessage("")
      } else {
        setTranslationState(response.state ?? null)
        setContentAvailable(response.error.code !== "CONTENT_UNAVAILABLE")
        setStatusMessage(getSafeAiUnavailableCopy(response.error))
      }
    } catch (error) {
      setStatusMessage(getSafeAiUnavailableCopy({ code: "UNKNOWN", message: error instanceof Error ? error.message : "Translation request failed" }))
    }
  }

  const isIdle = translationState?.phase === "idle" || translationState === null
  const contentUnavailable = !contentAvailable
  const providerReady = hasResolvedProviderAccess(persistedConfig.provider, authSession)
  const translateDisabled = !isIdle || contentUnavailable || !persistedResolvedSite.enabled || !providerReady
  const removeDisabled = isIdle || contentUnavailable

  const currentPhase = translationState?.phase ?? "idle"
  const currentProgress = translationState?.progress
  const currentPresentation = translationState?.presentation ?? persistedResolvedSite.presentation
  const currentSite = translationState?.site ?? {
    hostname: activeSiteKey,
    enabled: persistedResolvedSite.enabled,
    alwaysTranslate: persistedResolvedSite.alwaysTranslate,
  }
  const statusSiteEnabled = currentPhase === "idle"
    ? persistedResolvedSite.enabled
    : currentSite.enabled

  const quotaInfo = useMemo(
    () => buildQuotaInfoFromAccountState({
      account: authAccount,
      usage: authUsage,
      session: authSession,
    }),
    [authAccount, authUsage, authSession],
  )

  // Compute daily words translated from quota/session
  const wordsTranslated = quotaInfo ? Math.round(quotaInfo.used / 5) : 0

  const isAuthenticatedSession = authSession?.identityMode === "authenticated"
  const sessionStatusLabel = !authSession
    ? t("popup_notConnected")
    : isAuthenticatedSession
      ? t("popup_connected")
      : "Local guest"

  const planLabel = formatAstraPlanLabel(
    isAuthenticatedSession
      ? (authAccount?.plan ?? authSession?.plan ?? null)
      : null,
  )
  const headerStatusTone = isAuthenticatedSession
    ? "ready"
    : continuityStatus?.device.ready
      ? "warning"
      : "muted"
  const accountSurfaceSource = resolveAstraAccountSurfaceSource({
    account: authAccount,
    usage: authUsage,
    session: authSession,
  })
  const accountSourceNote = accountSurfaceSource === "account_summary"
    ? "Plan and daily quota mirror Astra account summary."
    : accountSurfaceSource === "session_snapshot"
      ? "Showing the last session snapshot until Astra account summary refresh succeeds."
      : "Sign in to load Astra account plan and daily quota."

  const isSupportedVideoTab = isSupportedVideoUrl(activePageUrl)
  const videoNoteViewerBaseUrl = authSession?.relayBaseURL ?? configDraft.provider.relayBaseURL ?? ""
  const canCreateVideoNote = isAuthenticatedSession && isSupportedVideoTab && !videoNoteBusy

  const localOnlyLabel = continuityStatus?.sync.localOnly.localOnlyFields.join(", ")
  const remoteConfigCollection = continuityStatus?.remote.configCollection ?? null
  const remoteReadingHistoryCollection = continuityStatus?.remote.readingHistoryCollection ?? null
  const remoteStudyProgressCollection = continuityStatus?.remote.studyProgressCollection ?? null
  const remoteCurrentDevice = continuityStatus?.remote.currentDevice ?? null
  const phaseOneSyncStatus = learningContinuitySyncStatus ?? continuityStatus?.sync.phaseOne ?? null
  const phaseOneSyncInFlight = !!phaseOneSyncStatus && "inFlight" in phaseOneSyncStatus && phaseOneSyncStatus.inFlight
  const phaseOneSyncQueued = !!phaseOneSyncStatus && "queued" in phaseOneSyncStatus && phaseOneSyncStatus.queued
  const phaseOneSyncLastError = phaseOneSyncStatus && "lastError" in phaseOneSyncStatus ? phaseOneSyncStatus.lastError : null

  const hydrateAccountState = async (
    session: AstraSession,
    device: AstraDeviceIdentity,
  ): Promise<{ account: AstraAccount | null; usage: AstraUsageSnapshot | null; remote: AstraContinuityRemoteSnapshot | null }> => {
    const [summaryResult, continuityResult] = await Promise.allSettled([
      fetchAstraAccountSummary({
        baseURL: session.relayBaseURL,
        sessionToken: session.sessionToken,
        deviceId: device.deviceId,
      }),
      fetchAstraContinuitySnapshot({
        baseURL: session.relayBaseURL,
        sessionToken: session.sessionToken,
        deviceId: device.deviceId,
        includePull: false,
      }),
    ])

    return {
      account: summaryResult.status === "fulfilled" ? summaryResult.value.account : null,
      usage: summaryResult.status === "fulfilled" ? summaryResult.value.usage : null,
      remote: continuityResult.status === "fulfilled"
        ? continuityResult.value
        : {
            error: continuityResult.reason instanceof Error
              ? continuityResult.reason.message
              : "Failed to load continuity status.",
          },
    }
  }

  const handleSignIn = async () => {
    try {
      setAuthBusy(true)
      setStatusMessage("")
      const session = await createAstraSession({
        baseURL: configDraft.provider.relayBaseURL ?? "",
        email: authEmail,
        password: authPassword,
      })
      const persistedSession = await saveAstraSession(session)
      const activeDevice = deviceIdentity ?? await ensureAstraDeviceIdentity()
      const { account, usage, remote } = await hydrateAccountState(persistedSession, activeDevice)
      setAuthSession(persistedSession)
      setAuthAccount(account)
      setAuthUsage(usage)
      setDeviceIdentity(activeDevice)
      setContinuityRemote(remote)
      setContinuityStatus(buildContinuityStatus({
        config: persistedConfig,
        session: persistedSession,
        device: activeDevice,
        remote,
        phaseOne: learningContinuitySyncStatus,
      }))
      setAuthPassword("")
      setStatusMessage("")
      await refreshTranslationState()
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Sign in failed")
    } finally {
      setAuthBusy(false)
    }
  }

  const handleSignOut = async () => {
    try {
      setAuthBusy(true)
      setStatusMessage("")
      if (authSession?.identityMode === "authenticated") {
        await revokeAstraSession({
          baseURL: authSession.relayBaseURL,
          sessionToken: authSession.sessionToken,
        })
      }
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Sign out failed")
    } finally {
      await clearAstraSession()
      setAuthSession(null)
      setAuthAccount(null)
      setAuthUsage(null)
      setContinuityRemote(null)
      setLearningContinuitySyncStatus(null)
      setMobileLinkChallenge(null)
      setMobileLinkMessage("")
      setAuthPassword("")
      if (deviceIdentity) {
        setContinuityStatus(buildContinuityStatus({
          config: persistedConfig,
          session: null,
          device: deviceIdentity,
          remote: null,
          phaseOne: null,
        }))
      }
      setAuthBusy(false)
      await refreshTranslationState()
    }
  }

  const handleCreateMobileLink = async () => {
    if (!authSession || authSession.identityMode !== "authenticated") return
    try {
      setMobileLinkBusy(true)
      setMobileLinkMessage("")
      const challenge = await requestAstraMobileLink({
        baseURL: authSession.relayBaseURL,
        sessionToken: authSession.sessionToken,
      })
      setMobileLinkChallenge(challenge)
      setMobileLinkMessage("Mobile link code ready. Enter it in Astra Review on your phone.")
    } catch (error) {
      setMobileLinkChallenge(null)
      setMobileLinkMessage(error instanceof Error ? error.message : "Could not create mobile link code.")
    } finally {
      setMobileLinkBusy(false)
    }
  }

  const handleCopyMobileLink = async () => {
    if (!mobileLinkChallenge) return
    const value = mobileLinkChallenge.link ?? mobileLinkChallenge.code
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable")
      await navigator.clipboard.writeText(value)
      setMobileLinkMessage("Copied phone link.")
    } catch {
      setMobileLinkMessage("Copy unavailable. Enter the code manually.")
    }
  }

  const focusSignInPanel = () => {
    setSignInPanelOpen(true)
    setSignInFocusRequestTick((current) => current + 1)
  }
  const openAdvancedAiSettings = () => {
    void browser.tabs.create({ url: `${browser.runtime.getURL("/options.html" as "/popup.html")}?section=providers` })
  }

  const openReviewPage = () => {
    void browser.tabs.create({
      url: `${browser.runtime.getURL("/vocabulary.html" as "/popup.html")}?tab=review`,
    })
  }

  const openVocabularyPage = () => {
    void browser.tabs.create({ url: browser.runtime.getURL("/vocabulary.html" as "/popup.html") })
  }

  const openReadingQueuePage = () => {
    void browser.tabs.create({
      url: `${browser.runtime.getURL("/vocabulary.html" as "/popup.html")}?tab=reading`,
    })
  }

  const handleDisableRetentionReminders = async () => {
    setRetentionReminderPolicy(await disableRetentionReminders())
  }

  const handlePauseRetentionReminders = async () => {
    setRetentionReminderPolicy(await pauseRetentionRemindersForDays(7))
  }

  const handleEnableRetentionReminders = async () => {
    setRetentionReminderPolicy(await enableRetentionReminders())
  }

  const openImageTranslatePage = () => {
    void browser.tabs.create({ url: browser.runtime.getURL("/image-translate.html" as "/popup.html") })
  }

  const openDocumentIntakePage = () => {
    void browser.tabs.create({ url: browser.runtime.getURL("/document-intake.html" as "/popup.html") })
  }

  const openUrlInTab = (url: string) => {
    void browser.tabs.create({ url })
  }

  const handleCreateVideoNoteFromCurrentTab = async () => {
    if (!isAuthenticatedSession) {
      setVideoNoteStatusMessage("Sign in to Astra before creating video notes.")
      return
    }

    if (!isSupportedVideoTab) {
      setVideoNoteStatusMessage("Open a supported YouTube or Bilibili tab before creating a note.")
      return
    }

    setVideoNoteBusy(true)
    setVideoNoteStatusMessage("")

    try {
      const response = await browser.runtime.sendMessage({
        type: "runtime/video-note:create-from-current-tab",
      }) as unknown

      if (!isRuntimeResponse(response)) {
        setVideoNoteStatusMessage("Received an unexpected response from video-note creation.")
        return
      }

      if (response.type === "runtime/video-note:create-from-current-tab:error") {
        setVideoNoteStatusMessage(getSafeAiUnavailableCopy(response.error))
        return
      }

      if (response.type !== "runtime/video-note:create-from-current-tab:success") {
        setVideoNoteStatusMessage("Received an unexpected response from video-note creation.")
        return
      }

      const jobId = response.payload.job.jobId
      setLastVideoNoteJobId(jobId)
      openUrlInTab(buildVideoNoteViewerUrl(jobId, videoNoteViewerBaseUrl))
      setVideoNoteStatusMessage(response.payload.deduped
        ? "Opened your existing video-note job in Astra Web."
        : "Video note created. Opened Astra Web viewer.")
    } catch (error) {
      setVideoNoteStatusMessage(getSafeAiUnavailableCopy({ code: "UNKNOWN", message: error instanceof Error ? error.message : "Failed to create video note" }))
    } finally {
      setVideoNoteBusy(false)
    }
  }

  const handleOpenLastVideoNote = () => {
    if (!lastVideoNoteJobId) return
    openUrlInTab(buildVideoNoteViewerUrl(lastVideoNoteJobId, videoNoteViewerBaseUrl))
  }

  const handleOpenInAstraApp = async () => {
    setIosBridgeActionMessage("")
    const response = await consumeIosBootstrapFromPopup("popup-open-in-app")
    setIosBootstrapStatus({
      bridgeAvailable: response.bridgeAvailable === true,
      status: response.status ?? null,
      history: Array.isArray(response.history) ? response.history : iosBootstrapStatus.history,
    })

    if (response.bridgeAvailable !== true) {
      setIosBridgeActionMessage("iOS bridge unavailable in this runtime.")
      return
    }

    setIosBridgeActionMessage(response.opened
      ? "Sent handoff to Astra app."
      : "Bridge available, but launch was not opened.")
  }

  const handleReplayLatestBridgeEvent = async () => {
    setIosBridgeActionMessage("")
    const latestEvent = iosBootstrapStatus.history[0]
    const response = await replayIosBootstrapFromPopup(latestEvent?.sessionId)
    setIosBootstrapStatus({
      bridgeAvailable: response.bridgeAvailable === true,
      status: response.status ?? iosBootstrapStatus.status,
      history: Array.isArray(response.history) ? response.history : iosBootstrapStatus.history,
    })

    if (response.bridgeAvailable !== true) {
      setIosBridgeActionMessage("iOS bridge unavailable in this runtime.")
      return
    }

    setIosBridgeActionMessage(response.opened
      ? "Replayed latest bridge event to Astra app."
      : "No replayable bridge event yet.")
  }

  const currentPageHistory = studyContext?.pageUrl
    ? recentHistory.find((entry) => entry.url === studyContext.pageUrl) ?? null
    : null
  const studyReady = popupStudyDeck.hasStudyText || !!currentPageHistory
  const canExplainPrimerSentence = studySentences.length > 0
    && sentenceActionLock.type === "idle"
    && !studyActionRunningId
  const shouldShowSignIn = !isAuthenticatedSession
  const accountContinuityCopy = LEARNING_LOOP_COMMERCIAL_SURFACE_COPY.accountContinuity
  const accountContinuityAuthHydrated = continuityStatus !== null
  const accountContinuityAuthState = isAuthenticatedSession ? "signed_in" : "signed_out"
  const isAccountContinuitySignedIn = accountContinuityAuthState === "signed_in"
  const accountContinuityProofMoment = buildLearningLoopAccountContinuityProofMoment("popup", {
    dueReviewCount: dueCount,
    savedSentenceCount: currentPageSavedReviewSummary?.count ?? studyLoop?.currentCounts.vocabSaved,
    pagesStudiedToday: studyLoop?.dailyStats.pagesStudied,
    sentencesExplainedToday: studyLoop?.dailyStats.sentencesExplained,
    vocabSavedToday: studyLoop?.dailyStats.vocabSaved,
    vocabReviewedToday: studyLoop?.dailyStats.vocabReviewed,
  }, { authState: accountContinuityAuthState })
  const primerPageUrl = activePageUrl ?? studyContext?.pageUrl ?? null
  const primerRecommendation = useMemo(() => deriveStudyLoopPrimerRecommendation({
    nextStep: studyLoop?.nextStep ?? "read",
    dueCount,
    canTranslatePage: !translateDisabled,
    canReadArticle: studyReady && !translateDisabled,
    canExplainSentence: canExplainPrimerSentence,
    canOpenReview: true,
  }), [
    canExplainPrimerSentence,
    dueCount,
    studyLoop?.nextStep,
    studyReady,
    translateDisabled,
  ])
  const weeklyDigestReady = !!weeklyRoi && (
    weeklyRoi.study.activePageCount > 0
    || weeklyRoi.vocabulary.savedCount > 0
    || weeklyRoi.vocabulary.reviewedCount > 0
    || (weeklyRoi.reviewableLearningMoments?.reviewableLearningMoments ?? 0) > 0
  )
  const retentionReminderStatus = useMemo<RetentionReminderStatus>(() => deriveRetentionReminderStatus(retentionReminderPolicy, {
    dueReviewCount: dueCount,
    continueReadingCount,
    weeklyDigestReady,
  }), [continueReadingCount, dueCount, retentionReminderPolicy, weeklyDigestReady])
  const primerViewEventKey = `${learningLoopCopyVariant}:${primerPageUrl ?? "unknown"}:${primerRecommendation.recommendedAction ?? "none"}`
  const proValueSeenEventKey = `popup_account_continuity:${accountContinuityAuthState}:${primerPageUrl ?? "unknown"}`
  const proValueTriggers = derivePopupProValueTriggers({
    isSupportedVideoTab,
    studyReady,
    isAuthenticatedSession,
    hasDigestSignal: Boolean(pageDigest) || digestStale || studyReady,
    quotaUsed: quotaInfo?.used ?? null,
    quotaLimit: quotaInfo?.limit ?? null,
  })
  const proValueMoments = buildLearningLoopProValueMoments({
    surface: "popup_pro_value",
    triggers: proValueTriggers,
    maxMoments: 5,
  })
  const proValueMomentEventKey = proValueMoments
    .map((moment) => `${moment.surface}:${moment.trigger}:${accountContinuityAuthState}:${primerPageUrl ?? "unknown"}`)
    .join("|")
  const upgradePrompt = buildLearningLoopUpgradePrompt({
    variant: upgradePromptVariant,
    triggers: proValueTriggers,
  })
  const upgradePromptTriggerKey = upgradePrompt?.triggers.join("|") ?? "none"

  useEffect(() => {
    if (!accountContinuityAuthHydrated) return
    if (proValueSeenEventKeyRef.current === proValueSeenEventKey) return
    proValueSeenEventKeyRef.current = proValueSeenEventKey
    recordLearningLoopEvent("pro_value_seen", {
      source: "popup",
      surface: "popup_account_continuity",
      trigger: "continuity_value",
      authState: accountContinuityAuthState,
      billingAvailable: false,
    })
  }, [accountContinuityAuthHydrated, accountContinuityAuthState, primerPageUrl, proValueSeenEventKey])

  useEffect(() => {
    if (!accountContinuityAuthHydrated || proValueMoments.length === 0) return
    for (const moment of proValueMoments) {
      const key = `${moment.surface}:${moment.trigger}:${accountContinuityAuthState}:${primerPageUrl ?? "unknown"}`
      if (proValueMomentSeenKeysRef.current.has(key)) continue
      proValueMomentSeenKeysRef.current.add(key)
      recordLearningLoopEvent("pro_value_seen", {
        source: "popup",
        surface: moment.surface,
        trigger: moment.trigger,
        authState: accountContinuityAuthState,
        billingAvailable: false,
      })
    }
  }, [accountContinuityAuthHydrated, accountContinuityAuthState, primerPageUrl, proValueMomentEventKey, proValueMoments])

  useEffect(() => {
    if (!accountContinuityAuthHydrated || !upgradePrompt) return
    const key = `${upgradePrompt.variant}:${upgradePromptTriggerKey}:${accountContinuityAuthState}`
    if (upgradePromptViewedKeysRef.current.has(key)) return
    upgradePromptViewedKeysRef.current.add(key)
    recordLearningLoopEvent("paywall_viewed", {
      source: "popup",
      surface: "popup_upgrade_prompt",
      experimentId: LEARNING_LOOP_UPGRADE_PROMPT_EXPERIMENT_ID,
      variant: upgradePrompt.variant,
      triggers: upgradePrompt.triggers,
      primaryTrigger: upgradePrompt.triggers[0] ?? "unknown",
      authState: accountContinuityAuthState,
      billingAvailable: false,
      hardBlock: false,
    })
  }, [accountContinuityAuthHydrated, accountContinuityAuthState, upgradePrompt, upgradePromptTriggerKey])

  useEffect(() => {
    if (primerViewEventKeyRef.current === primerViewEventKey) return
    primerViewEventKeyRef.current = primerViewEventKey
    recordLearningLoopEvent("popup_primer_viewed", {
      source: "popup",
      variant: learningLoopCopyVariant,
      pageUrl: primerPageUrl,
      dueCount,
      sentenceCount: studySentences.length,
      canTranslatePage: !translateDisabled,
      canReadArticle: studyReady && !translateDisabled,
      canExplainSentence: canExplainPrimerSentence,
      nextStep: primerRecommendation.nextStep,
      recommendedAction: primerRecommendation.recommendedAction,
      recommendationReason: primerRecommendation.reason,
      actionableActionCount: primerRecommendation.actionableActionCount,
      actionableActions: primerRecommendation.actionableActions,
      hasActionableRecommendation: primerRecommendation.recommendedAction !== null,
      ...buildPersonalizedStrategyTelemetry(studyLoop?.personalizedStrategy),
    })
  }, [
    canExplainPrimerSentence,
    dueCount,
    learningLoopCopyVariant,
    primerPageUrl,
    primerRecommendation,
    primerViewEventKey,
    studyReady,
    studySentences.length,
    translateDisabled,
  ])

  const recordUpgradePromptIntent = () => {
    if (!upgradePrompt) return
    recordLearningLoopEvent("conversion_event", {
      source: "popup",
      surface: "popup_upgrade_prompt",
      experimentId: LEARNING_LOOP_UPGRADE_PROMPT_EXPERIMENT_ID,
      conversion: "upgrade_intent_clicked",
      variant: upgradePrompt.variant,
      triggers: upgradePrompt.triggers,
      primaryTrigger: upgradePrompt.triggers[0] ?? "unknown",
      authState: accountContinuityAuthState,
      billingAvailable: false,
      hardBlock: false,
    })
    setStatusMessage("Thanks — Astra recorded local upgrade interest only. No checkout, trial, email capture, subscription change, or Pro activation was started.")
  }

  const recordPopupPrimerCtaClick = (action: StudyLoopPrimerAction) => {
    recordLearningLoopEvent("popup_primer_cta_clicked", {
      source: "popup",
      action,
      variant: learningLoopCopyVariant,
      pageUrl: primerPageUrl,
      dueCount,
      sentenceCount: studySentences.length,
      nextStep: primerRecommendation.nextStep,
      recommendedAction: primerRecommendation.recommendedAction,
      recommendationReason: primerRecommendation.reason,
      actionableActionCount: primerRecommendation.actionableActionCount,
      actionableActions: primerRecommendation.actionableActions,
      clickedRecommendedAction: action === primerRecommendation.recommendedAction,
      hasActionableRecommendation: primerRecommendation.recommendedAction !== null,
      ...buildPersonalizedStrategyTelemetry(studyLoop?.personalizedStrategy),
    })
  }

  const showCompactEmptyLibrarySurface = vocabularyTotalCount === 0 && dueCount === 0
  const showCertificationEmptyLibrarySurface = showCompactEmptyLibrarySurface && shouldUseAstraCertificationMode()
  const popupShellClassName = showCertificationEmptyLibrarySurface
    ? "astra-popup-shell--empty-library astra-popup-shell--cert-empty"
    : undefined
  const popupHeroStudyContext = showCertificationEmptyLibrarySurface
    ? POPUP_EMPTY_CERT_STUDY_CONTEXT
    : studyContext
  const needsManagedSignIn = !providerReady && !isAuthenticatedSession && configDraft.connectionMode === "astra"
  const needsAdvancedAiConfig = !providerReady && !needsManagedSignIn
  const primaryTranslateDisabled = showCertificationEmptyLibrarySurface
    ? false
    : !isIdle || contentUnavailable || !persistedResolvedSite.enabled
  const primaryTranslateLabel = showCertificationEmptyLibrarySurface
    ? "Translate this page"
    : needsManagedSignIn
      ? "Sign in to start"
      : needsAdvancedAiConfig
        ? "Astra AI unavailable"
      : t("popup_translateThisPage")

  return (
    <PopupShell className={popupShellClassName}>
      <PopupHeader
        title="Astra"
        statusLabel={showCertificationEmptyLibrarySurface ? undefined : `${sessionStatusLabel} · ${planLabel}`}
        statusTone={headerStatusTone}
        onOpenSettings={() => void browser.tabs.create({ url: browser.runtime.getURL("/options.html" as "/popup.html") })}
        onOpenLibrary={showCertificationEmptyLibrarySurface ? undefined : openVocabularyPage}
        libraryAriaLabel={t("popup_toolbarLibraryAria")}
        settingsAriaLabel={t("popup_toolbarSettingsAria")}
      />

      <PopupArticleHero studyContext={popupHeroStudyContext} certEmptyFocus={showCertificationEmptyLibrarySurface} />

      {showCompactEmptyLibrarySurface && !showCertificationEmptyLibrarySurface && (
        <section className="astra-popup-group">
          <button
            type="button"
            data-testid="popup-try-sample-article"
            onClick={() => void browser.tabs.create({ url: browser.runtime.getURL("/sample-lesson.html" as "/popup.html") })}
            className="astra-btn-outline-quiet"
            style={{ width: "100%", padding: "10px 12px", fontSize: 13, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 3h9l5 5v13H6z" />
              <path d="M14 3v6h6" />
              <path d="M9 13h6M9 17h6" />
            </svg>
            {t("popup_trySampleArticle")}
          </button>
        </section>
      )}

      <section className="astra-popup-group astra-popup-primary-group">
        <div className="astra-group-card astra-group-card--padded">
          {isIdle ? (
            <button
              onClick={() => {
                if (showCertificationEmptyLibrarySurface) return
                if (needsManagedSignIn) {
                  focusSignInPanel()
                  return
                }
                if (needsAdvancedAiConfig) {
                  openAdvancedAiSettings()
                  return
                }
                void translate()
              }}
              className="astra-btn-primary astra-btn-ink-primary"
              style={{ width: "100%", padding: "13px 18px", fontSize: 15, justifyContent: "space-between" }}
              aria-disabled={showCertificationEmptyLibrarySurface ? "true" : undefined}
              disabled={primaryTranslateDisabled}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 5h10M5 5v2a4 4 0 0 0 4 4M11 5v2a4 4 0 0 1-4 4" />
                <path d="M11 19l4-9 4 9M12.5 16h5" />
              </svg>
              <span style={{ flex: 1, textAlign: "left", marginLeft: 8 }}>{primaryTranslateLabel}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ) : (
            <button
              onClick={() => {
                void removeTranslation()
              }}
              className="astra-btn-secondary"
              style={{ width: "100%", padding: "12px 14px", fontSize: 15, fontWeight: 600 }}
              disabled={removeDisabled}
            >
              {t("popup_stopTranslation")}
            </button>
          )}

          {!showCertificationEmptyLibrarySurface && (
            <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <button
                type="button"
                onClick={openDeepReadPage}
                className="astra-btn-outline-quiet"
                style={{ padding: "9px 10px", fontSize: 13 }}
                disabled={!studyReady}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H19v15.5H6a2 2 0 0 0-2 2V4.5z" />
                  <path d="M4 19.5A2 2 0 0 1 6 17.5h13" />
                </svg>
                {t("popup_deepReadAction")}
              </button>
              <button
                type="button"
                onClick={() => { void handleSaveCurrentPageAsset() }}
                className="astra-btn-outline-quiet"
                style={{ padding: "9px 10px", fontSize: 13 }}
                disabled={pageAssetSaveStatus === "saving" || pageAssetSaveStatus === "saved" || !studyContext}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M6 3h12v18l-6-4-6 4V3z" />
                </svg>
                {pageAssetSaveStatus === "saved" ? t("popup_contentAssetizationSavedAction") : pageAssetSaveStatus === "saving" ? t("popup_contentAssetizationSavingAction") : t("popup_contentAssetizationSaveAction")}
              </button>
            </div>
          )}
        </div>
      </section>

      {!showCertificationEmptyLibrarySurface && (
        <section className="astra-popup-group" data-testid="popup-managed-engine-card">
          <div className="astra-group-card astra-group-card--padded" style={{ display: "grid", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <div>
                <div className="astra-quiet-eyebrow">Astra Managed AI</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: "var(--astra-text-primary)", marginTop: 2 }}>
                  {providerReady
                    ? "Ready — nothing to configure"
                    : needsManagedSignIn
                      ? "Sign in once. Astra handles the rest."
                      : "Astra AI needs sign-in."}
                </div>
              </div>
              <span
                style={{
                  border: "1px solid var(--astra-border)",
                  borderRadius: 999,
                  padding: "3px 8px",
                  fontSize: 11,
                  fontWeight: 800,
                  color: providerReady ? "var(--astra-success)" : "var(--astra-warning)",
                  background: "var(--astra-bg-card)",
                  whiteSpace: "nowrap",
                }}
              >
                {providerReady ? "Automatic" : needsManagedSignIn ? "Sign in" : "Settings"}
              </span>
            </div>
            <div style={{ fontSize: 12, lineHeight: 1.45, color: "var(--astra-text-secondary)" }}>
              {providerReady
                ? `Astra chooses the best way to help in the background. Plan: ${planLabel}. ${accountSourceNote}`
                  : needsManagedSignIn
                    ? "Free beta managed AI does not require technical setup. Sign in only if you want to keep learning continuity across sessions."
                    : "Astra AI is unavailable for the current mode. Check Astra AI settings or switch back to managed service."}
              </div>
              {!providerReady && (
                <button
                  type="button"
                  className="astra-btn-outline-quiet"
                  style={{ width: "100%", padding: "8px 10px", fontSize: 12 }}
                  onClick={needsManagedSignIn ? focusSignInPanel : openAdvancedAiSettings}
                >
                  {needsManagedSignIn ? "Sign in for continuity" : "Open Astra AI settings"}
                </button>
              )}
          </div>
        </section>
      )}

      <PopupSiteQuickCard
        activeSiteKey={activeSiteKey}
        hostname={currentSite.hostname || studyContext?.hostname || activeSiteKey || ""}
        rawSiteRule={activeSiteKey ? configDraft.sites[activeSiteKey] : undefined}
        sitePresentationMode={draftResolvedSite.presentation.mode}
        sitePresentationTheme={draftResolvedSite.presentation.theme}
        onAlwaysTranslateChange={(value) => {
          handleSiteRuleChange((rule) => ({ ...rule, alwaysTranslate: value }))
        }}
        onSiteModeChange={(mode) => {
          handleSiteRuleChange((rule) => ({
            ...rule,
            presentation: { ...configDraft.presentation, ...rule.presentation, mode },
          }))
        }}
        onSiteThemeChange={(theme) => {
          handleSiteRuleChange((rule) => ({
            ...rule,
            presentation: { ...configDraft.presentation, ...rule.presentation, theme },
          }))
        }}
        permissionState={pageAccessState}
        permissionStatusMessage={pageAccessMessage}
        onGrantPageAccess={() => { void handlePageAccessAction("page") }}
        onGrantSiteAccess={() => { void handlePageAccessAction("site") }}
        onRevokeSiteAccess={() => { void handlePageAccessAction("revoke-site") }}
        onGrantAllSitesAccess={() => { void handlePageAccessAction("all-sites") }}
      />

      <PopupReadingQuickCard
        hoverTrigger={configDraft.hoverTrigger}
        onHoverTriggerChange={(trigger) => handleConfigChange({ hoverTrigger: trigger })}
        onOpenDeepRead={openDeepReadPage}
        onOpenDocumentIntake={openDocumentIntakePage}
        deepReadDisabled={!studyReady}
      />

      <PopupTodayLearning
        savedWordsTotal={vocabularyTotalCount}
        dueReviews={dueCount}
        weeklyVocabSaved={weeklyRoi?.vocabulary.savedCount ?? 0}
        certEmptyFocus={showCertificationEmptyLibrarySurface}
        onOpenLibrary={openVocabularyPage}
        onOpenReview={openReviewPage}
      />

      {isAuthenticatedSession && (
        <LearningContinuityCommitCard
          status={learningContinuitySyncStatus}
          syncInFlight={learningContinuityCommitBusy}
          onSyncNow={() => {
            void triggerLearningContinuitySync("popup-continuity-card", { surfaceError: true })
          }}
        />
      )}

      {/* Translation Status Card (shown when active) */}
      {(currentPhase !== "idle" || translationState?.subtitleQuality?.active) && (
        <div style={{ marginTop: 12 }}>
          <TranslationStatusCard
            phase={currentPhase}
            targetLang={translationState?.targetLang ?? persistedResolvedSite.targetLang}
            presentation={currentPresentation}
            hostname={currentSite.hostname}
            progress={currentProgress ?? null}
            lastError={translationState?.lastError ?? null}
            siteEnabled={statusSiteEnabled}
            subtitleQuality={translationState?.subtitleQuality ?? null}
            subtitleQualityControls={subtitleQualityControls}
            subtitleQualityTrend={subtitleQualityTrend}
            onSubtitleQualityControlsChange={handleSubtitleQualityControlsChange}
            onSubtitleDiagnosticsExport={handleExportSubtitleDiagnostics}
            subtitleDiagnosticsExportStatus={subtitleDiagnosticsExportStatus}
            onRetryFailed={() => {
              void retryActiveTabFailedBlocks().then((response) => {
                if (response.ok) {
                  setTranslationState(response.state)
                }
              })
            }}
          />
        </div>
      )}

      <div className="astra-card" data-testid="popup-report-page-card" style={{ marginTop: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: "var(--astra-text-primary)", marginBottom: 4 }}>
          Report this page
        </div>
        <div style={{ fontSize: 11, color: "var(--astra-text-secondary)", lineHeight: 1.45, marginBottom: 8 }}>
          Submit a metadata-only report to Astra support when signed in, or download a local bundle as fallback. It includes browser, version, Privacy Mode, issue category, hostname only, and current error code when available — no page text, saved snippets, screenshots, transcripts, or user input.
        </div>
        <button
          type="button"
          className="astra-btn-outline-quiet"
          data-testid="popup-export-page-report-btn"
          style={{ width: "100%", padding: "8px 10px", fontSize: 12 }}
          onClick={() => { void handleExportPageReport() }}
        >
          {authSession?.identityMode === "authenticated" && (authSession.deviceId ?? deviceIdentity?.deviceId) ? "Submit report to Astra" : "Download report bundle"}
        </button>
        {supportReportStatus && (
          <pre
            role="status"
            data-testid="popup-report-page-status"
            style={{
              whiteSpace: "pre-wrap",
              margin: "8px 0 0",
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid var(--astra-border)",
              background: "var(--astra-bg-elevated)",
              color: "var(--astra-text-secondary)",
              fontSize: 11,
              lineHeight: 1.45,
            }}
          >
            {supportReportStatus}
          </pre>
        )}
      </div>

      <PopupProValueMomentsCard
        moments={proValueMoments}
        upgradePrompt={upgradePrompt}
        onUpgradeIntent={recordUpgradePromptIntent}
      />

      {accountContinuityAuthHydrated && (
        <div data-testid="popup-account-continuity-card" className="astra-account-continuity-card">
          <div className="astra-account-continuity-card__eyebrow">
            {accountContinuityCopy.eyebrow}
          </div>
          <div className="astra-account-continuity-card__title">
            {isAccountContinuitySignedIn ? accountContinuityCopy.connectedTitle : accountContinuityCopy.title}
          </div>
          <div className="astra-account-continuity-card__copy">
            {isAccountContinuitySignedIn ? accountContinuityCopy.connectedSummary : accountContinuityCopy.summary}
          </div>
          <div data-testid="popup-account-continuity-proof-moment" className="astra-account-continuity-card__proof">
            {accountContinuityProofMoment}
          </div>
          <div className="astra-account-continuity-card__boundary">
            {accountContinuityCopy.boundary}
          </div>
          {!isAccountContinuitySignedIn && (
            <>
              <button
                type="button"
                data-testid="popup-account-continuity-sign-in-cta"
                className="astra-btn-primary"
                style={{ width: "100%", marginTop: 8, padding: "8px 10px", fontSize: 12 }}
                onClick={focusSignInPanel}
              >
                {accountContinuityCopy.cta}
              </button>
              <div className="astra-account-continuity-card__boundary">
                {accountContinuityCopy.ctaHelper}
              </div>
            </>
          )}
        </div>
      )}

      <LearningClosurePrimerCard
        canTranslatePage={!translateDisabled}
        canReadArticle={studyReady && !translateDisabled}
        canExplainSentence={canExplainPrimerSentence}
        dueCount={dueCount}
        sentenceCount={studySentences.length}
        copyVariant={learningLoopCopyVariant}
        recommendedAction={primerRecommendation.recommendedAction}
        onTranslatePage={() => {
          recordPopupPrimerCtaClick("translate_page")
          void translate()
        }}
        onReadArticle={() => {
          recordPopupPrimerCtaClick("open_deep_read")
          openDeepReadPage()
        }}
        onExplainSentence={() => {
          recordPopupPrimerCtaClick("explain_sentence")
          void handleExplainSentence(selectedSentenceIndex)
        }}
        onOpenReview={() => {
          recordPopupPrimerCtaClick("open_review")
          openReviewPage()
        }}
      />

      <details className="astra-popup-language-coach-details" data-testid="popup-language-coach-details">
        <summary className="astra-popup-language-coach-summary">Learning preferences</summary>
        <div style={{ marginTop: 8 }}>
          <SimpleControls
            targetLang={configDraft.targetLang}
            translationMode={configDraft.presentation.mode}
            serviceMode={configDraft.serviceMode}
            languageLevel={configDraft.languageLevel}
            explainMode={configDraft.explainMode}
            explanationGlossaryText={serializeExplanationGlossary(configDraft.explanationGlossary)}
            onTargetLangChange={handleTargetLangChange}
            onModeChange={handleModeChange}
            onServiceModeChange={(mode) => {
              handleConfigChange({ serviceMode: mode })
            }}
            onLanguageLevelChange={(level) => {
              handleConfigChange({ languageLevel: level })
            }}
            onExplainModeChange={(mode) => {
              handleConfigChange({ explainMode: mode })
            }}
            onExplanationGlossaryChange={(value) => {
              handleConfigChange({ explanationGlossary: parseExplanationGlossaryText(value) })
            }}
          />
          <label htmlFor="popup-global-font-size" style={{ ...labelStyle, marginTop: 8 }}>{t("label_translationFontSize")}</label>
          <input
            id="popup-global-font-size"
            data-testid="popup-global-font-size-input"
            type="range"
            min={0.5}
            max={2}
            step={0.05}
            value={configDraft.presentation.fontSize}
            onChange={(event) => {
              const value = Number.parseFloat(event.target.value)
              if (!Number.isFinite(value)) return
              handleConfigChange({
                presentation: {
                  ...configDraft.presentation,
                  fontSize: Math.min(2, Math.max(0.5, value)),
                },
              })
            }}
            className="astra-input"
            style={{ padding: 0 }}
          />
          <div style={{ fontSize: 11, color: "var(--astra-text-muted)", marginTop: 2 }}>
            {t("label_translationFontSizeValue", configDraft.presentation.fontSize.toFixed(2))}
          </div>
        </div>
      </details>

      <StudySection
        currentPageActivity={currentPageHistory}
        dueCount={dueCount}
        recentHistory={recentHistory}
        studyContext={studyContext}
        canReadArticle={studyReady && !translateDisabled}
        showAccountContinuityNudge={accountContinuityAuthHydrated}
        accountContinuityAuthState={accountContinuityAuthState}
        onOpenAccountContinuitySignIn={focusSignInPanel}
        studyLoop={studyLoop}
        weeklyRoi={weeklyRoi}
        retentionReminderStatus={retentionReminderStatus}
        pageSavedReviewSummary={currentPageSavedReviewSummary}
        pageAssetSaveStatus={pageAssetSaveStatus}
        pageAssetSaveMessage={pageAssetSaveMessage}
        pageDigest={pageDigest}
        digestStale={digestStale}
        digestLoading={digestLoading}
        onGenerateDigest={() => { void handleGenerateDigest() }}
        onRegenerateDigest={() => { void handleGenerateDigest() }}
        canSpeakStudy={canSpeakStudy}
        speakingStudy={studySpeaking}
        studyQuickActions={studyQuickActions}
        studyActionRunningId={studyActionRunningId}
        studyActionResult={studyActionResult}
        sentenceCards={sentenceCards}
        sentenceActionLocked={sentenceActionLock.type !== "idle"}
        sentenceDeckFallbackMessage={studySentenceDeckFallbackMessage}
        selectedSentenceIndex={selectedSentenceIndex}
        onToggleStudySpeech={() => { void handleToggleStudySpeech() }}
        onToggleSentenceSpeech={(sentenceIndex) => { void handleToggleSentenceSpeech(sentenceIndex) }}
        onSelectSentence={(index) => { handleSelectSentence(index) }}
        onRunStudyAction={(actionId) => { void handleRunStudyAction(actionId) }}
        onSaveSentence={(sentenceIndex) => { void handleSaveSentence(sentenceIndex) }}
        onReviewSavedSentence={(sentenceIndex) => { handleReviewSavedSentence(sentenceIndex) }}
        onReviewPageSavedSentences={handleReviewCurrentPageSavedSentences}
        onSavePageAsset={() => { void handleSaveCurrentPageAsset() }}
        onOpenHistoryEntry={openUrlInTab}
        onOpenReview={openReviewPage}
        onOpenVocabulary={openVocabularyPage}
        onOpenReadingQueue={openReadingQueuePage}
        onDisableRetentionReminders={() => { void handleDisableRetentionReminders() }}
        onPauseRetentionReminders={() => { void handlePauseRetentionReminders() }}
        onEnableRetentionReminders={() => { void handleEnableRetentionReminders() }}
        onReadArticle={() => {
          openDeepReadPage()
        }}
        onExplainSentence={(sentenceIndex) => {
          void handleExplainSentence(sentenceIndex)
        }}
      />

      <details style={{ marginTop: 12 }}>
        <summary className="astra-cursor-pointer" style={{ fontSize: 13, color: "var(--astra-brand-hover)" }}>
          More details
        </summary>

        <div style={{ marginTop: 8 }}>
          <button
            type="button"
            onClick={openImageTranslatePage}
            className="astra-btn-secondary"
            style={{ width: "100%", padding: "8px 10px", fontSize: 13, fontWeight: 600, marginBottom: 8 }}
          >
            Open Image/OCR Translation Beta
          </button>
          <div style={{ fontSize: 11, color: "var(--astra-text-muted)", marginBottom: 8, lineHeight: 1.45 }}>
            Upload or paste an image for extracted-text translation. Overlay preview is approximate; compare rows remain available.
          </div>
          <button
            type="button"
            onClick={openDocumentIntakePage}
            className="astra-btn-secondary"
            style={{ width: "100%", padding: "8px 10px", fontSize: 13, fontWeight: 600, marginBottom: 8 }}
          >
            Open Document Intake Hub
          </button>
          <div style={{ fontSize: 11, color: "var(--astra-text-muted)", marginBottom: 8, lineHeight: 1.45 }}>
            Route PDF, EPUB, SRT, or VTT files to existing readers and keep a Reading queue row. A short-lived local handoff can open the reader automatically; expired or oversized files fall back to manual reselect. File bytes stay local and are never synced.
          </div>
          {isSupportedVideoTab && (
            <div data-testid="popup-video-note-tools">
              <button
                type="button"
                onClick={() => { void handleCreateVideoNoteFromCurrentTab() }}
                className="astra-btn-secondary"
                style={{ width: "100%", padding: "8px 10px", fontSize: 13, fontWeight: 600 }}
                disabled={!canCreateVideoNote}
              >
                {videoNoteBusy ? "Creating video note…" : "Create video note"}
              </button>
              {lastVideoNoteJobId && (
                <button
                  type="button"
                  onClick={handleOpenLastVideoNote}
                  className="astra-btn-secondary"
                  style={{ width: "100%", marginTop: 6, padding: "8px 10px", fontSize: 12 }}
                >
                  Open last video note
                </button>
              )}
              <div style={{ fontSize: 11, color: "var(--astra-text-muted)", marginTop: 4 }}>
                Supported video tab detected.
              </div>
              {videoNoteStatusMessage && (
                <div role="status" aria-live="polite" style={{ ...warningStyle, marginTop: 6 }}>
                  {videoNoteStatusMessage}
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{
          marginTop: 10,
          background: "var(--astra-bg-sunken)",
          border: "1px solid var(--astra-border)",
          borderRadius: 8,
          padding: 10,
        }}>
          <QuotaBar quota={quotaInfo} />
          {wordsTranslated > 0 && (
            <div style={{ fontSize: 11, color: "var(--astra-text-hint)", marginTop: 4 }}>
              {t("popup_wordsTranslatedToday", wordsTranslated.toLocaleString())}
            </div>
          )}
          <div style={{ fontSize: 11, color: "var(--astra-text-muted)", marginTop: 4, lineHeight: 1.45 }}>
            {accountSourceNote}
          </div>
          <div style={{ fontSize: 11, color: "var(--astra-text-muted)", marginTop: 6, lineHeight: 1.45 }}>
            <div>
              iOS bridge: {iosBootstrapStatus.bridgeAvailable ? "available" : "unavailable"}
              {iosBootstrapStatus.status?.lastBootstrapAt
                ? ` · Last bootstrap ${formatContinuityTimestamp(iosBootstrapStatus.status.lastBootstrapAt)}`
                : " · No bootstrap yet"}
            </div>
            <div>
              Launch path: popup/onboarding → extension bridge → astra-shell://bootstrap → host app handoff
            </div>
            {iosBootstrapStatus.status?.lastSessionId && (
              <div>
                Last iOS session: {iosBootstrapStatus.status.lastSessionId}
              </div>
            )}
            {iosBootstrapStatus.history.length > 0 && (
              <div>
                Recent bridge events: {iosBootstrapStatus.history.length}
              </div>
            )}
            <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
              <button
                type="button"
                onClick={() => { void handleOpenInAstraApp() }}
                className="astra-btn-secondary"
                style={{ fontSize: 11, padding: "4px 8px" }}
                disabled={!iosBootstrapStatus.bridgeAvailable}
              >
                Open in Astra App
              </button>
              <button
                type="button"
                onClick={() => { void handleReplayLatestBridgeEvent() }}
                className="astra-btn-secondary"
                style={{ fontSize: 11, padding: "4px 8px" }}
                disabled={!iosBootstrapStatus.bridgeAvailable || iosBootstrapStatus.history.length === 0}
              >
                Replay last handoff
              </button>
            </div>
            {iosBridgeActionMessage && (
              <div role="status" aria-live="polite">
                {iosBridgeActionMessage}
              </div>
            )}
            {iosBootstrapStatus.history.slice(0, 3).map((event) => (
              <div key={event.sessionId}>
                · {event.sessionId} ({event.source}) {formatContinuityTimestamp(event.issuedAt)}
              </div>
            ))}
          </div>
          {continuityStatus && (
            <div style={{ fontSize: 11, color: "var(--astra-text-muted)", marginTop: 6, lineHeight: 1.45 }}>
              <div>
                Device: {deviceIdentity?.label ?? "Preparing device identity"}
              </div>
              {isAuthenticatedSession && (
                continuityStatus.remote.available
                  ? (
                      <>
                        <div>
                          Astra continuity · {continuityStatus.remote.deviceCount} device{continuityStatus.remote.deviceCount === 1 ? "" : "s"} · {continuityStatus.remote.activeDeviceCount} active
                        </div>
                        {remoteCurrentDevice && (
                          <div>
                            Current device: {remoteCurrentDevice.status} · Last seen {formatContinuityTimestamp(remoteCurrentDevice.lastSeenAt)} · Last sync {formatContinuityTimestamp(remoteCurrentDevice.lastSyncAt)}
                          </div>
                        )}
                        {remoteConfigCollection && (
                          <div>
                            Config bootstrap: {remoteConfigCollection.enabled ? "enabled" : "disabled"} · Cursor {remoteConfigCollection.bootstrapCursor ?? "none"}
                            {remoteConfigCollection.hasPull ? ` · Latest pull ${remoteConfigCollection.deltaCount} delta${remoteConfigCollection.deltaCount === 1 ? "" : "s"}` : ""}
                          </div>
                        )}
                      </>
                    )
                  : continuityStatus.remote.error
                    ? (
                        <div>
                          Continuity check: {continuityStatus.remote.error}
                        </div>
                      )
                    : null
              )}
              {remoteReadingHistoryCollection && (
                <div>
                  Reading history sync: {remoteReadingHistoryCollection.enabled ? "enabled" : "off"} · {remoteReadingHistoryCollection.enabled ? `Cursor ${remoteReadingHistoryCollection.bootstrapCursor ?? "none"}` : "Optional"}
                </div>
              )}
              {remoteStudyProgressCollection && (
                <div>
                  Study progress sync: {remoteStudyProgressCollection.enabled ? "enabled" : "off"} · {remoteStudyProgressCollection.enabled ? `Cursor ${remoteStudyProgressCollection.bootstrapCursor ?? "none"}` : "Optional"} · Daily stats stay local
                </div>
              )}
              {phaseOneSyncStatus && (
                <div data-testid="learning-continuity-sync-status">
                  Learning continuity commit: {phaseOneSyncInFlight ? "syncing" : phaseOneSyncLastError || phaseOneSyncStatus.stateLastError ? "needs retry" : phaseOneSyncStatus.stateLastSuccessAt ? "synced" : "not yet"}
                  {phaseOneSyncStatus.stateLastSuccessAt ? ` · Last success ${formatContinuityTimestamp(phaseOneSyncStatus.stateLastSuccessAt)}` : ""}
                  {phaseOneSyncQueued ? " · queued" : ""}
                </div>
              )}
              <div>
                Config, vocabulary, review schedules, reading history, and study progress continuity ready · Daily study stats stay local
              </div>
              {localOnlyLabel && (
                <div>
                  Local only: {localOnlyLabel}
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ marginTop: 12 }}>
          <UsageInsightsCard summary={usageSummary} cacheStats={translationCacheStats} />
        </div>

        {activeSiteKey && (
          <div style={{ marginTop: 12 }}>
            <SiteRulesExplainabilityPanel
              activeSiteKey={activeSiteKey}
              rawSiteRule={configDraft.sites[activeSiteKey]}
              resolvedSite={draftResolvedSite}
              translationState={translationState}
              contentAvailable={contentAvailable}
              providerReady={providerReady}
              statusMessage={statusMessage}
              onQuickFix={handleSiteRulesQuickFix}
            />
            <div style={{ marginTop: 10 }}>
              <SiteSettingsSection
                activeSiteKey={activeSiteKey}
                rawSiteRule={configDraft.sites[activeSiteKey]}
                globalConfig={{
                  targetLang: configDraft.targetLang,
                  hoverTrigger: configDraft.hoverTrigger,
                  presentation: configDraft.presentation,
                  contentScope: configDraft.contentScope,
                }}
                onSiteRuleChange={handleSiteRuleChange}
              />
            </div>
          </div>
        )}
      </details>

      {/* Auth section (simplified) */}
      {shouldShowSignIn && (
        <>
          <details
            ref={signInPanelRef}
            data-testid="popup-sign-in-panel"
            open={signInPanelOpen}
            onToggle={(event) => setSignInPanelOpen(event.currentTarget.open)}
            style={{ marginTop: 4, marginBottom: 8 }}
          >
            <summary className="astra-cursor-pointer" style={{ fontSize: 13, color: "var(--astra-brand-hover)" }}>
              {t("popup_signInToAstra")}
            </summary>
            <div style={{ marginTop: 8 }}>
              <label htmlFor="popup-sign-in-email" style={labelStyle}>{t("label_email")}</label>
              <input
                id="popup-sign-in-email"
                ref={signInEmailInputRef}
                type="email"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                placeholder="you@example.com"
                className="astra-input"
              />
              <label htmlFor="popup-sign-in-password" style={labelStyle}>{t("label_password")}</label>
              <input
                id="popup-sign-in-password"
                type="password"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                placeholder="••••••••"
                className="astra-input"
              />
              <button
                onClick={() => {
                  void handleSignIn()
                }}
                className="astra-btn-primary"
                style={{ width: "100%", marginTop: 8 }}
                disabled={authBusy || authEmail.trim().length === 0 || authPassword.length === 0}
              >
                {t("popup_signIn")}
              </button>
            </div>
          </details>
        </>
      )}

      {isAuthenticatedSession && authSession && (
        <>
          <div style={{ fontSize: 12, color: "var(--astra-text-muted)", marginTop: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>{authAccount?.email ?? authSession.email}</span>
            <button
              onClick={() => {
                void handleSignOut()
              }}
              className="astra-btn-link"
              style={{ color: "var(--astra-brand-hover)" }}
              disabled={authBusy}
            >
              {t("popup_signOut")}
            </button>
          </div>
          <div className="astra-site-sheet__card" data-testid="popup-mobile-link-card" style={{ fontSize: 12, color: "var(--astra-text-secondary)", marginTop: 8, lineHeight: 1.45 }}>
            <div style={{ color: "var(--astra-text-primary)", fontWeight: 800 }}>Review on your phone</div>
            <div style={{ marginTop: 4 }}>
              Create a short desktop code, then enter it in Astra Review on iOS or Android to bring your saved cards to that phone.
            </div>
            <button
              type="button"
              className="astra-btn-secondary"
              data-testid="popup-mobile-link-create-button"
              style={{ width: "100%", marginTop: 8, padding: "7px 10px", fontSize: 12 }}
              disabled={mobileLinkBusy}
              onClick={() => { void handleCreateMobileLink() }}
            >
              {mobileLinkBusy ? "Creating phone code…" : "Create phone code"}
            </button>
            {mobileLinkChallenge && (
              <div style={{ marginTop: 8 }}>
                <div data-testid="popup-mobile-link-code" style={{ color: "var(--astra-text-primary)", fontSize: 24, fontWeight: 900, letterSpacing: "0.16em" }}>
                  {mobileLinkChallenge.code}
                </div>
                <div style={{ color: "var(--astra-text-muted)", marginTop: 2 }}>
                  Expires {formatContinuityTimestamp(mobileLinkChallenge.expiresAt)} · Single use
                </div>
                <button
                  type="button"
                  className="astra-btn-link"
                  data-testid="popup-mobile-link-copy-button"
                  style={{ color: "var(--astra-brand-hover)", marginTop: 4, padding: 0 }}
                  onClick={() => { void handleCopyMobileLink() }}
                >
                  Copy phone link
                </button>
              </div>
            )}
            {mobileLinkMessage && (
              <div data-testid="popup-mobile-link-message" role="status" aria-live="polite" style={{ color: "var(--astra-text-muted)", marginTop: 6 }}>
                {mobileLinkMessage}
              </div>
            )}
          </div>
        </>
      )}

      {!isAuthenticatedSession && authSession?.identityMode === "anonymous" && (
        <div style={{ fontSize: 11, color: "var(--astra-text-muted)", marginTop: 4 }}>
          This device is using a local Astra guest session. Sign in later to attach plan, quota, and continuity state.
        </div>
      )}

      {statusMessage && (
        <div className="astra-popup-status-message" role="status" aria-live="polite" style={warningStyle}>
          {statusMessage}
        </div>
      )}

      {/* Footer links */}
      <div className="astra-popup-footer-links" style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 10 }}>
        <button
          type="button"
          onClick={() => void browser.tabs.create({ url: browser.runtime.getURL("/options.html" as "/popup.html") })}
          className="astra-btn-link"
          style={{ color: "var(--astra-brand-hover)" }}
        >
          {t("popup_settings")}
        </button>
        <button
          type="button"
          onClick={openVocabularyPage}
          className="astra-btn-link"
          style={{ color: "var(--astra-brand-hover)" }}
        >
          {t("popup_vocabulary")}
        </button>
        <button
          type="button"
          onClick={openReviewPage}
          className="astra-btn-link"
          style={{ color: "var(--astra-brand-hover)" }}
        >
          {t("popup_review")}
        </button>
      </div>
      <div className="astra-popup-version-footer" style={{ fontSize: 11, color: "var(--astra-text-muted)", textAlign: "center", marginTop: 4 }}>
        Astra v0.1.0
      </div>
    </PopupShell>
  )
}
