import { useEffect, useMemo, useRef, useState } from "react"
import { browser } from "#imports"
import { t } from "@/utils/i18n"
import type {
  AstraConfig,
  SiteConfig,
  TranslationMode,
} from "@/types/config"
import type { AstraAccount, AstraDeviceIdentity, AstraSession } from "@/types/auth"
import type { PageStudyContext } from "@/types/messages"
import type { TranslationSnapshot } from "@/types/translation"
import type { QuotaInfo } from "@/utils/astra/quota"
import {
  resolveActiveHttpTab,
  getActiveTabStudyContext,
  getActiveTabTranslationState,
  retryActiveTabFailedBlocks,
  saveConfigInBackground,
  startActiveTabTranslation,
  stopActiveTabTranslation,
} from "@/utils/extension/messages"
import { readConfig } from "@/utils/storage/config"
import {
  DEFAULT_ASTRA_CONFIG,
  hasResolvedProviderAccess,
  normalizeSiteKey,
  resolveSiteTranslationSettings,
} from "@/types/config"
import { getReadingHistory, type ReadingHistoryEntry } from "@/utils/storage/reading-history"
import {
  computeFingerprint,
  getPageDigest,
  isDigestStale,
  savePageDigest,
  type PageDigestRecord,
} from "@/utils/storage/page-digests"
import { generatePageDigest } from "@/utils/reading/assist"
import { isTtsSupported, speak, splitSentences, stopSpeaking } from "@/utils/tts"
import { translateTexts } from "@/utils/translate/translate"
import {
  clearAstraSession,
  ensureAstraDeviceIdentity,
  readAstraSession,
  saveAstraSession,
} from "@/utils/storage/auth"
import {
  createAstraSession,
  refreshAstraSession,
  revokeAstraSession,
} from "@/utils/astra/auth"
import {
  fetchAstraAccount,
  fetchAstraContinuitySnapshot,
} from "@/utils/astra/account"
import { getQuotaInfo } from "@/utils/astra/quota"
import {
  getDueVocabularyCount,
  getVocabularyEntries,
  sanitizeVocabularyUrl,
  saveVocabularyEntry,
} from "@/utils/storage/vocabulary"
import { getTranslationUsageSummary, type TranslationUsageSummary } from "@/utils/storage/translation-usage"
import { buildContinuityStatus, type AstraContinuityRemoteSnapshot, type AstraContinuityStatus } from "@/utils/storage/config-sync"
import { deriveStudyLoopViewModel, getStudyProgress, recordStudyEvent, type StudyLoopViewModel } from "@/utils/storage/study-progress"
import TranslationStatusCard from "./components/TranslationStatusCard"
import SimpleControls from "./components/SimpleControls"
import QuotaBar from "./components/QuotaBar"
import SiteSettingsSection from "./components/SiteSettingsSection"
import StudySection, {
  type PopupSentenceCardViewModel,
  type PopupSentenceExplainStatus,
  type PopupSentenceSaveStatus,
} from "./components/StudySection"
import UsageInsightsCard from "./components/UsageInsightsCard"
import { btnPrimary, btnSecondary, btnDisabled, warningStyle, inputStyle, labelStyle } from "./components/styles"

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

interface PopupSentenceState {
  explanationText: string | null
  explainStatus: PopupSentenceExplainStatus
  saveStatus: PopupSentenceSaveStatus
}

function buildPopupSentenceCardId(index: number, sentence: string): string {
  return `${index}:${sentence}`
}

function buildLegacyPopupSentenceSaveKey(sentence: string): string {
  return `text:${sentence}`
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
  const [authSession, setAuthSession] = useState<AstraSession | null>(null)
  const [authAccount, setAuthAccount] = useState<AstraAccount | null>(null)
  const [deviceIdentity, setDeviceIdentity] = useState<AstraDeviceIdentity | null>(null)
  const [continuityRemote, setContinuityRemote] = useState<AstraContinuityRemoteSnapshot | null>(null)
  const [continuityStatus, setContinuityStatus] = useState<AstraContinuityStatus | null>(null)
  const [authEmail, setAuthEmail] = useState("")
  const [authPassword, setAuthPassword] = useState("")
  const [authBusy, setAuthBusy] = useState(false)
  const [recentHistory, setRecentHistory] = useState<ReadingHistoryEntry[]>([])
  const [studyContext, setStudyContext] = useState<PageStudyContext | null>(null)
  const [dueCount, setDueCount] = useState(0)
  const [quotaInfo, setQuotaInfo] = useState<QuotaInfo | null>(null)
  const [usageSummary, setUsageSummary] = useState<TranslationUsageSummary | null>(null)
  const [studyLoop, setStudyLoop] = useState<StudyLoopViewModel | null>(null)
  const [pageDigest, setPageDigest] = useState<PageDigestRecord | null>(null)
  const [activePageUrl, setActivePageUrl] = useState<string | null>(null)
  const [digestLoading, setDigestLoading] = useState(false)
  const [studyActionResult, setStudyActionResult] = useState<{ actionId: string; text: string } | null>(null)
  const [studyActionRunningId, setStudyActionRunningId] = useState<string | null>(null)
  const [sentenceStateById, setSentenceStateById] = useState<Record<string, PopupSentenceState>>({})
  const [speakingSentenceId, setSpeakingSentenceId] = useState<string | null>(null)
  const [selectedSentenceIndex, setSelectedSentenceIndex] = useState(0)
  const [currentPageSavedSentenceKeys, setCurrentPageSavedSentenceKeys] = useState<string[]>([])
  const [studySpeaking, setStudySpeaking] = useState(false)
  const [iosBootstrapStatus, setIosBootstrapStatus] = useState<{
    bridgeAvailable: boolean
    status: IosBootstrapRuntimeStatus | null
    history: IosBootstrapHistoryEvent[]
  }>({ bridgeAvailable: false, status: null, history: [] })
  const [iosBridgeActionMessage, setIosBridgeActionMessage] = useState("")
  const hasUnsavedChangesRef = useRef(false)
  const isMountedRef = useRef(true)
  const saveSequenceRef = useRef<Promise<void>>(Promise.resolve())
  const saveRevisionRef = useRef(0)
  const siteRuleSaveTimerRef = useRef<number | null>(null)
  const pendingSiteRuleDraftRef = useRef<AstraConfig | null>(null)
  const sentenceDeckRevisionRef = useRef(0)

  const persistedResolvedSite = useMemo(
    () => resolveSiteTranslationSettings(persistedConfig, activeSiteKey),
    [persistedConfig, activeSiteKey],
  )

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

  const studyActionText = useMemo(() => {
    if (pageDigest) {
      const digestPoints = pageDigest.keyPoints.slice(0, 3).join(" ")
      return [
        pageDigest.headline,
        pageDigest.summary,
        digestPoints,
      ].filter(Boolean).join("\n\n")
    }

    return studyContext?.articleExcerpt
      ?? studyContext?.contentSummary
      ?? studyContext?.metaDescription
      ?? ""
  }, [pageDigest, studyContext])

  const studyQuickActions = useMemo(
    () => (configDraft.customActions ?? []).filter((action) => action.enabled).slice(0, 3),
    [configDraft.customActions],
  )

  const studySentences = useMemo(
    () => splitSentences(studyContext?.articleExcerpt ?? "")
      .map((sentence) => sentence.trim())
      .filter((sentence) => sentence.length > 0)
      .slice(0, 3),
    [studyContext?.articleExcerpt],
  )

  const canSpeakStudy = studyActionText.trim().length > 0
    && persistedConfig.tts.enabled
    && isTtsSupported(persistedConfig.tts.engine)

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
        saveStatus,
        speaking: speakingSentenceId === id,
      }
    }),
    [savedSentenceKeySet, selectedSentenceIndex, sentenceStateById, speakingSentenceId, studySentences],
  )

  useEffect(() => {
    sentenceDeckRevisionRef.current += 1
    stopSpeaking()
    setSentenceStateById({})
    setSpeakingSentenceId(null)
    setStudySpeaking(false)
    setSelectedSentenceIndex(0)
  }, [studyContext?.pageUrl, studyContext?.articleExcerpt])

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
      setStatusMessage(stateResponse.error.message)
    }
  }

  const refreshAll = async () => {
    const [config, siteKey, device, storedSession, history, currentDueCount, studyContextResponse, usage, studyStore, vocabularyEntries, iosStatus] = await Promise.all([
      readConfig(),
      getActiveSiteKey(),
      ensureAstraDeviceIdentity(),
      readAstraSession(),
      getReadingHistory(),
      getDueVocabularyCount(),
      getActiveTabStudyContext(),
      getTranslationUsageSummary(),
      getStudyProgress(),
      getVocabularyEntries(),
      fetchIosBootstrapRuntimeStatus(),
    ])
    setRecentHistory(history.slice(0, 3))
    setDueCount(currentDueCount)
    setStudyContext(studyContextResponse.ok ? studyContextResponse.context : null)
    setUsageSummary(usage)
    setIosBootstrapStatus(iosStatus)

    // Derive study loop from the http(s) tab we treat as "current reading" (popup-as-tab safe).
    const activeHttp = await resolveActiveHttpTab()
    const currentUrl = activeHttp?.url
    setActivePageUrl(currentUrl ?? null)
    setStudyLoop(deriveStudyLoopViewModel(studyStore, currentUrl))
    const currentStudyUrl = sanitizeVocabularyUrl(currentUrl ?? (studyContextResponse.ok ? studyContextResponse.context.pageUrl : undefined))
    setCurrentPageSavedSentenceKeys(
      currentStudyUrl
        ? Array.from(new Set(vocabularyEntries
          .filter((entry) => sanitizeVocabularyUrl(entry.url) === currentStudyUrl)
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
        const [accountResult, continuityResult] = await Promise.allSettled([
          fetchAstraAccount({
            baseURL: session.relayBaseURL,
            sessionToken: session.sessionToken,
          }),
          fetchAstraContinuitySnapshot({
            baseURL: session.relayBaseURL,
            sessionToken: session.sessionToken,
            deviceId: device.deviceId,
            includePull: false,
          }),
        ])
        account = accountResult.status === "fulfilled" ? accountResult.value : null
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
    setAuthSession(session)
    setAuthAccount(account)
    setDeviceIdentity(device)
    setContinuityRemote(remote)
    setContinuityStatus(buildContinuityStatus({
      config,
      session,
      device,
      remote,
    }))

    // Fetch quota info (best-effort)
    try {
      const quota = await getQuotaInfo()
      setQuotaInfo(quota)
    } catch {
      setQuotaInfo(null)
    }

    await refreshTranslationState()
    if (continuityMessage) {
      setStatusMessage(continuityMessage)
    }
  }

  useEffect(() => {
    void refreshAll()
  }, [])

  useEffect(() => {
    if (!deviceIdentity) return
    setContinuityStatus(buildContinuityStatus({
      config: persistedConfig,
      session: authSession,
      device: deviceIdentity,
      remote: continuityRemote,
    }))
  }, [authSession, continuityRemote, deviceIdentity, persistedConfig])

  useEffect(() => () => {
    stopSpeaking()
  }, [])

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
        url: meta.url,
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
        context: studyContext ?? undefined,
        task: "custom",
        customSystemPrompt: renderStudyPrompt(action.systemPrompt),
      })

      setStudyActionResult({
        actionId,
        text: result.ok ? (result.translations[0] ?? "") : `⚠ ${result.error.message}`,
      })
    } catch (error) {
      setStudyActionResult({
        actionId,
        text: `⚠ ${error instanceof Error ? error.message : "Request failed."}`,
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
    const currentState = sentenceStateById[targetSentenceId] ?? createPopupSentenceState()
    const anySentenceExplaining = Object.values(sentenceStateById).some((state) => state.explainStatus === "explaining")
    const anySentenceSaving = Object.values(sentenceStateById).some((state) => state.saveStatus === "saving")
    if (anySentenceExplaining || anySentenceSaving) return

    setSelectedSentenceIndex(targetIndex)

    if (currentState.explainStatus === "explained" && currentState.explanationText) {
      return
    }

    const meta = buildStudyRecordMeta()
    const deckRevision = sentenceDeckRevisionRef.current
    setSentenceStateById((current) => ({
      ...current,
      [targetSentenceId]: {
        ...(current[targetSentenceId] ?? createPopupSentenceState()),
        explainStatus: "explaining",
        explanationText: null,
      },
    }))

    try {
      const result = await translateTexts({
        texts: [targetSentence],
        targetLang: configDraft.targetLang,
        context: studyContext
          ? { ...studyContext, selectionContext: targetSentence }
          : { selectionContext: targetSentence },
        task: "explain",
      })

      const text = result.ok
        ? (result.translations[0] ?? "")
        : `Warning: ${result.error.message}`

      if (sentenceDeckRevisionRef.current === deckRevision) {
        setSentenceStateById((current) => ({
          ...current,
          [targetSentenceId]: {
            ...(current[targetSentenceId] ?? createPopupSentenceState()),
            explainStatus: result.ok ? "explained" : "idle",
            explanationText: text,
          },
        }))
      }

      if (result.ok) {
        await recordStudySteps(["explain"], meta)
      }
    } catch (error) {
      if (sentenceDeckRevisionRef.current === deckRevision) {
        setSentenceStateById((current) => ({
          ...current,
          [targetSentenceId]: {
            ...(current[targetSentenceId] ?? createPopupSentenceState()),
            explainStatus: "idle",
            explanationText: `Warning: ${error instanceof Error ? error.message : "Request failed."}`,
          },
        }))
      }
    }
  }

  const handleSaveSentence = async (sentenceIndex: number) => {
    const target = resolveSentenceTarget(sentenceIndex)
    if (!target) return

    const { targetIndex, targetSentence, targetSentenceId } = target
    const currentState = sentenceStateById[targetSentenceId] ?? createPopupSentenceState()
    const legacyTargetSentenceSaveKey = buildLegacyPopupSentenceSaveKey(targetSentence)
    const anySentenceExplaining = Object.values(sentenceStateById).some((state) => state.explainStatus === "explaining")
    const anySentenceSaving = Object.values(sentenceStateById).some((state) => state.saveStatus === "saving")
    if (
      anySentenceExplaining
      || anySentenceSaving
      || currentState.saveStatus === "saved"
      || savedSentenceKeySet.has(targetSentenceId)
      || savedSentenceKeySet.has(legacyTargetSentenceSaveKey)
    ) return

    const meta = buildStudyRecordMeta()
    if (!meta) return

    const deckRevision = sentenceDeckRevisionRef.current
    setSentenceStateById((current) => ({
      ...current,
      [targetSentenceId]: {
        ...(current[targetSentenceId] ?? createPopupSentenceState()),
        saveStatus: "saving",
      },
    }))

    try {
      await saveVocabularyEntry({
        text: targetSentence,
        explanation: currentState.explanationText ?? undefined,
        context: studyContext?.articleExcerpt ?? studyContext?.contentSummary ?? studyContext?.metaDescription,
        sourceContext: {
          surface: "popup_deep_read",
          pageTitle: studyContext?.pageTitle,
          contentSummary: studyContext?.contentSummary,
          articleExcerpt: studyContext?.articleExcerpt,
          sentenceText: targetSentence,
          sentenceIndex: targetIndex,
        },
        url: meta.url,
        hostname: meta.hostname,
      })
      await recordStudySteps(["vocab_save"], meta)
      const nextDueCount = await getDueVocabularyCount()

      if (sentenceDeckRevisionRef.current === deckRevision) {
        setSentenceStateById((current) => ({
          ...current,
          [targetSentenceId]: {
            ...(current[targetSentenceId] ?? createPopupSentenceState()),
            saveStatus: "saved",
          },
        }))
        setCurrentPageSavedSentenceKeys((current) => {
          const nextKeys = new Set(current)
          nextKeys.add(targetSentenceId)
          return Array.from(nextKeys)
        })
      }
      setDueCount(nextDueCount)
    } catch {
      if (sentenceDeckRevisionRef.current === deckRevision) {
        setSentenceStateById((current) => ({
          ...current,
          [targetSentenceId]: {
            ...(current[targetSentenceId] ?? createPopupSentenceState()),
            saveStatus: "idle",
          },
        }))
      }
    }
  }

  const handleSelectSentence = (index: number) => {
    if (index < 0 || index >= studySentences.length) return
    setSelectedSentenceIndex(index)
  }

  const handleToggleSentenceSpeech = async (sentenceIndex?: number) => {
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
          privacyMode: nextDraft.privacyMode,
          provider: {
            id: nextDraft.provider.id,
            accessToken: nextDraft.provider.accessToken,
            apiKey: nextDraft.provider.apiKey,
            relayBaseURL: nextDraft.provider.relayBaseURL ?? "",
            model: nextDraft.provider.model,
          },
          presentation: nextDraft.presentation,
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
          const resolvedSite = resolveSiteTranslationSettings(nextConfig, activeSiteKey)
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

  const startTranslation = async (contentScope: "page" | "article") => {
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
        setStatusMessage(response.error.message)
        return false
      }
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Translation request failed")
      return false
    }
  }

  const translate = async () => {
    const started = await startTranslation("page")
    if (started) {
      await recordStudySteps(["read"])
    }
  }

  const translateArticle = async () => {
    const started = await startTranslation("article")
    if (started) {
      await recordStudySteps(["read", "guided_read"])
    }
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
        setStatusMessage(response.error.message)
      }
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Translation request failed")
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

  // Compute daily words translated from quota/session
  const wordsTranslated = quotaInfo ? Math.round(quotaInfo.used / 5) : 0

  const isAuthenticatedSession = authSession?.identityMode === "authenticated"
  const sessionStatusLabel = !authSession
    ? t("popup_notConnected")
    : isAuthenticatedSession
      ? t("popup_connected")
      : "Guest session"

  // Determine plan label
  const planLabel = isAuthenticatedSession && authAccount?.plan === "pro"
    ? "Pro Plan"
    : quotaInfo?.plan === "custom"
      ? "Custom"
      : "Free Plan"

  const localOnlyLabel = continuityStatus?.sync.localOnly.localOnlyFields.join(", ")
  const remoteConfigCollection = continuityStatus?.remote.configCollection ?? null
  const remoteReadingHistoryCollection = continuityStatus?.remote.readingHistoryCollection ?? null
  const remoteStudyProgressCollection = continuityStatus?.remote.studyProgressCollection ?? null
  const remoteCurrentDevice = continuityStatus?.remote.currentDevice ?? null

  const hydrateAccountState = async (
    session: AstraSession,
    device: AstraDeviceIdentity,
  ): Promise<{ account: AstraAccount | null; remote: AstraContinuityRemoteSnapshot | null }> => {
    const [accountResult, continuityResult] = await Promise.allSettled([
      fetchAstraAccount({
        baseURL: session.relayBaseURL,
        sessionToken: session.sessionToken,
      }),
      fetchAstraContinuitySnapshot({
        baseURL: session.relayBaseURL,
        sessionToken: session.sessionToken,
        deviceId: device.deviceId,
        includePull: false,
      }),
    ])

    return {
      account: accountResult.status === "fulfilled" ? accountResult.value : null,
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
      const { account, remote } = await hydrateAccountState(persistedSession, activeDevice)
      setAuthSession(persistedSession)
      setAuthAccount(account)
      setDeviceIdentity(activeDevice)
      setContinuityRemote(remote)
      setContinuityStatus(buildContinuityStatus({
        config: persistedConfig,
        session: persistedSession,
        device: activeDevice,
        remote,
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
      setContinuityRemote(null)
      setAuthPassword("")
      if (deviceIdentity) {
        setContinuityStatus(buildContinuityStatus({
          config: persistedConfig,
          session: null,
          device: deviceIdentity,
          remote: null,
        }))
      }
      setAuthBusy(false)
      await refreshTranslationState()
    }
  }

  const openReviewPage = () => {
    void browser.tabs.create({
      url: `${browser.runtime.getURL("/vocabulary.html" as "/popup.html")}?tab=review`,
    })
  }

  const openVocabularyPage = () => {
    void browser.tabs.create({ url: browser.runtime.getURL("/vocabulary.html" as "/popup.html") })
  }

  const openUrlInTab = (url: string) => {
    void browser.tabs.create({ url })
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
  const studyReady = !!(studyContext?.contentSummary || studyContext?.metaDescription || currentPageHistory)
  const shouldShowSignIn = !isAuthenticatedSession

  return (
    <div style={{ width: "100%", maxWidth: 400, minWidth: 280, padding: 16, fontFamily: "system-ui, sans-serif", boxSizing: "border-box" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18, display: "flex", alignItems: "center", gap: 8 }}>
          Astra
        </h2>
        <button
          type="button"
          onClick={() => void browser.tabs.create({ url: browser.runtime.getURL("/options.html" as "/popup.html") })}
          style={{
            background: "none",
            border: "none",
            fontSize: 18,
            cursor: "pointer",
            color: "#64748b",
            padding: 4,
          }}
          title="Settings"
        >
          &#9881;
        </button>
      </div>

      {/* Translate This Page button */}
      {isIdle ? (
        <button
          onClick={() => {
            void translate()
          }}
          style={{
            ...btnPrimary,
            width: "100%",
            padding: "10px 12px",
            fontSize: 15,
            fontWeight: 600,
            ...(translateDisabled ? btnDisabled : {}),
          }}
          disabled={translateDisabled}
        >
          {t("popup_translateThisPage")}
        </button>
      ) : (
        <button
          onClick={() => {
            void removeTranslation()
          }}
          style={{
            ...btnSecondary,
            width: "100%",
            padding: "10px 12px",
            fontSize: 15,
            fontWeight: 600,
            ...(removeDisabled ? btnDisabled : {}),
          }}
          disabled={removeDisabled}
        >
          {t("popup_stopTranslation")}
        </button>
      )}

      {/* Status + Quota section */}
      <div style={{
        marginTop: 12,
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
        borderRadius: 8,
        padding: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#334155" }}>
          <span style={{
            display: "inline-block",
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: isAuthenticatedSession ? "#22c55e" : continuityStatus?.device.ready ? "#6366f1" : "#94a3b8",
          }} />
          <span>
            {sessionStatusLabel}
            {" · "}
            {planLabel}
          </span>
        </div>
        <QuotaBar quota={quotaInfo} />
        {wordsTranslated > 0 && (
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
            {t("popup_wordsTranslatedToday", wordsTranslated.toLocaleString())}
          </div>
        )}
        <div style={{ fontSize: 11, color: "#64748b", marginTop: 6, lineHeight: 1.45 }}>
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
              style={{
                ...btnSecondary,
                fontSize: 11,
                padding: "4px 8px",
                ...(iosBootstrapStatus.bridgeAvailable ? {} : btnDisabled),
              }}
              disabled={!iosBootstrapStatus.bridgeAvailable}
            >
              Open in Astra App
            </button>
            <button
              type="button"
              onClick={() => { void handleReplayLatestBridgeEvent() }}
              style={{
                ...btnSecondary,
                fontSize: 11,
                padding: "4px 8px",
                ...((!iosBootstrapStatus.bridgeAvailable || iosBootstrapStatus.history.length === 0) ? btnDisabled : {}),
              }}
              disabled={!iosBootstrapStatus.bridgeAvailable || iosBootstrapStatus.history.length === 0}
            >
              Replay last handoff
            </button>
          </div>
          {iosBridgeActionMessage && (
            <div>
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
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 6, lineHeight: 1.45 }}>
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
            <div>
              Config continuity ready · Optional collections available in Settings
            </div>
            {localOnlyLabel && (
              <div>
                Local only: {localOnlyLabel}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Translation Status Card (shown when active) */}
      {currentPhase !== "idle" && (
        <div style={{ marginTop: 12 }}>
          <TranslationStatusCard
            phase={currentPhase}
            targetLang={translationState?.targetLang ?? persistedResolvedSite.targetLang}
            presentation={currentPresentation}
            hostname={currentSite.hostname}
            progress={currentProgress ?? null}
            lastError={translationState?.lastError ?? null}
            siteEnabled={statusSiteEnabled}
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

      {/* Target Language + Translation Mode */}
      <div style={{ marginTop: 12 }}>
        <SimpleControls
          targetLang={configDraft.targetLang}
          translationMode={configDraft.presentation.mode}
          languageLevel={configDraft.languageLevel}
          onTargetLangChange={handleTargetLangChange}
          onModeChange={handleModeChange}
          onLanguageLevelChange={(level) => {
            handleConfigChange({ languageLevel: level })
          }}
        />
      </div>

      <StudySection
        currentPageActivity={currentPageHistory}
        dueCount={dueCount}
        recentHistory={recentHistory}
        studyContext={studyContext}
        canReadArticle={studyReady && !translateDisabled}
        studyLoop={studyLoop}
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
        selectedSentenceIndex={selectedSentenceIndex}
        onToggleStudySpeech={() => { void handleToggleStudySpeech() }}
        onToggleSentenceSpeech={(sentenceIndex) => { void handleToggleSentenceSpeech(sentenceIndex) }}
        onSelectSentence={(index) => { handleSelectSentence(index) }}
        onRunStudyAction={(actionId) => { void handleRunStudyAction(actionId) }}
        onSaveSentence={(sentenceIndex) => { void handleSaveSentence(sentenceIndex) }}
        onOpenHistoryEntry={openUrlInTab}
        onOpenReview={openReviewPage}
        onOpenVocabulary={openVocabularyPage}
        onReadArticle={() => {
          void translateArticle()
        }}
        onExplainSentence={(sentenceIndex) => {
          void handleExplainSentence(sentenceIndex)
        }}
      />

      <UsageInsightsCard summary={usageSummary} />

      {activeSiteKey && (
        <div style={{ marginTop: 12 }}>
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
      )}

      {/* Auth section (simplified) */}
      {shouldShowSignIn && (
        <details style={{ marginTop: 4, marginBottom: 8 }}>
          <summary style={{ cursor: "pointer", fontSize: 13, color: "#6366f1" }}>
            {t("popup_signInToAstra")}
          </summary>
          <div style={{ marginTop: 8 }}>
            <label style={labelStyle}>{t("label_email")}</label>
            <input
              type="email"
              value={authEmail}
              onChange={(e) => setAuthEmail(e.target.value)}
              placeholder="you@example.com"
              style={inputStyle}
            />
            <label style={labelStyle}>{t("label_password")}</label>
            <input
              type="password"
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
              placeholder="••••••••"
              style={inputStyle}
            />
            <button
              onClick={() => {
                void handleSignIn()
              }}
              style={{
                ...btnPrimary,
                width: "100%",
                marginTop: 8,
                ...(authBusy || authEmail.trim().length === 0 || authPassword.length === 0 ? btnDisabled : {}),
              }}
              disabled={authBusy || authEmail.trim().length === 0 || authPassword.length === 0}
            >
              {t("popup_signIn")}
            </button>
          </div>
        </details>
      )}

      {isAuthenticatedSession && authSession && (
        <div style={{ fontSize: 12, color: "#64748b", marginTop: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>{authAccount?.email ?? authSession.email}</span>
          <button
            onClick={() => {
              void handleSignOut()
            }}
            style={{
              background: "none",
              border: "none",
              color: "#6366f1",
              fontSize: 11,
              cursor: "pointer",
              textDecoration: "underline",
              ...(authBusy ? btnDisabled : {}),
            }}
            disabled={authBusy}
          >
            {t("popup_signOut")}
          </button>
        </div>
      )}

      {!isAuthenticatedSession && authSession?.identityMode === "anonymous" && (
        <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
          This device has a local Astra guest session. Sign in to enable account continuity later.
        </div>
      )}

      {statusMessage && (
        <div style={warningStyle}>
          {statusMessage}
        </div>
      )}

      {/* Footer links */}
      <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 10 }}>
        <button
          type="button"
          onClick={() => void browser.tabs.create({ url: browser.runtime.getURL("/options.html" as "/popup.html") })}
          style={{ background: "none", border: "none", color: "#6366f1", fontSize: 11, cursor: "pointer", textDecoration: "underline" }}
        >
          {t("popup_settings")}
        </button>
        <button
          type="button"
          onClick={openVocabularyPage}
          style={{ background: "none", border: "none", color: "#6366f1", fontSize: 11, cursor: "pointer", textDecoration: "underline" }}
        >
          {t("popup_vocabulary")}
        </button>
        <button
          type="button"
          onClick={openReviewPage}
          style={{ background: "none", border: "none", color: "#6366f1", fontSize: 11, cursor: "pointer", textDecoration: "underline" }}
        >
          {t("popup_review")}
        </button>
      </div>
      <div style={{ fontSize: 11, color: "#94a3b8", textAlign: "center", marginTop: 4 }}>
        Astra v0.1.0
      </div>
    </div>
  )
}
