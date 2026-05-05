import { useEffect, useMemo, useState } from "react"
import { browser } from "#imports"
import { t } from "@/utils/i18n"
import { recordLearningLoopEvent } from "@/utils/learning-loop-events"
import { readConfig } from "@/utils/storage/config"
import { getActiveTabStudyContext, resolveActiveHttpTab } from "@/utils/extension/messages"
import { getDeepReadSession, getLatestDeepReadSession, saveDeepReadSession } from "@/utils/storage/deep-read-session"
import { computeFingerprint, getPageDigest, isDigestStale, savePageDigest, type PageDigestRecord } from "@/utils/storage/page-digests"
import { generatePageDigest } from "@/utils/reading/assist"
import { getReadingHistory } from "@/utils/storage/reading-history"
import { buildSentenceAnchor, readSentenceAnchorFromSearchParams, resolveSentenceAnchorIndex } from "@/utils/sentence-anchor"
import { deriveStudyLoopViewModel, getStudyProgress, recordStudyEvent, type PersonalizedTeachingStrategy, type StudyLoopViewModel, type StudyStep } from "@/utils/storage/study-progress"
import { splitSentences, isTtsSupported, speak, speakWithHighlight, stopSpeaking } from "@/utils/tts"
import { translateTexts } from "@/utils/translate/translate"
import { getDueVocabularyCount, getVocabularyEntries, isVocabularyEntryFromStudyUrl, saveVocabularyEntry, type VocabularyEntry } from "@/utils/storage/vocabulary"
import { openFocusedReview, openPageReviewLoop } from "@/utils/review-link"
import { buildOwnedReadingVocabularySourceLink, upsertOwnedArticleFromUrl } from "@/utils/storage/owned-reading"
import type { AstraConfig, ExplainMode } from "@/types/config"
import type { PageStudyContext } from "@/types/messages"

function buildExplainModeSystemPrompt(explainMode: ExplainMode): string | undefined {
  switch (explainMode) {
    case "beginner":
      return "Explain the sentence like a patient beginner tutor. Prefer plain words, shorter sentences, and concrete meaning over abstract analysis."
    case "exam":
      return "Explain the sentence like an exam-prep coach. Focus on grammar structure, collocations, likely learner mistakes, and why the phrasing matters."
    case "deep":
      return "Explain the sentence like a deep reading coach. Focus on nuance, tone, intention, and how the wording works in context."
  }
}

function buildStudyDigestContentSummary(studyContext: PageStudyContext | null): string {
  if (!studyContext) return ""
  return [
    studyContext.contentSummary ?? studyContext.metaDescription ?? "",
    studyContext.articleExcerpt ? `Article excerpt:\n${studyContext.articleExcerpt}` : "",
  ].filter(Boolean).join("\n\n")
}

function formatMessage(template: string, ...values: Array<string | number>): string {
  return values.reduce<string>(
    (message, value, index) => message.replace(`$${index + 1}`, String(value)),
    template,
  )
}

function normalizeStudyContext(context: PageStudyContext): PageStudyContext {
  return {
    ...context,
    pageUrl: context.pageUrl?.trim() || undefined,
    pageTitle: context.pageTitle?.trim() || undefined,
    hostname: context.hostname?.trim() || undefined,
    metaDescription: context.metaDescription?.trim() || undefined,
    contentSummary: context.contentSummary?.trim() || undefined,
    articleExcerpt: context.articleExcerpt?.trim() || undefined,
  }
}

function deriveDeepReadSentences(
  studyContext: PageStudyContext | null,
  fallbackSentences: string[] = [],
): string[] {
  const source = studyContext?.articleExcerpt?.trim()
    || studyContext?.contentSummary?.trim()
    || studyContext?.metaDescription?.trim()
    || ""
  const derived = splitSentences(source)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .slice(0, 10)

  return derived.length > 0 ? derived : fallbackSentences
}

function getStudyStepLabel(step: StudyStep): string {
  return {
    read: t("popup_studyStepRead"),
    guided_read: t("popup_studyStepGuidedRead"),
    explain: t("popup_studyStepExplain"),
    vocab_save: t("popup_studyStepSaveWords"),
    vocab_review: t("popup_studyStepReview"),
  }[step]
}

function getStudyStepHint(step: StudyStep | null): string {
  switch (step) {
    case "read":
      return t("popup_studyNextHintRead")
    case "guided_read":
      return t("popup_studyNextHintGuidedRead")
    case "explain":
      return t("popup_studyNextHintExplain")
    case "vocab_save":
      return t("popup_studyNextHintSaveWords")
    case "vocab_review":
      return t("popup_studyNextHintReview")
    default:
      return t("popup_deepReadNextStepHint")
  }
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

interface PageSavedReviewSummary {
  studyUrl: string
  count: number
  entryId?: string
}

function derivePageSavedReviewState(
  entries: VocabularyEntry[],
  studyUrl?: string | null,
): {
  summary: PageSavedReviewSummary | null
  savedSentenceIndices: Set<number>
  savedSentenceEntryIds: Record<number, string>
} {
  const matchedEntries = studyUrl
    ? entries.filter((entry) => isVocabularyEntryFromStudyUrl(entry, studyUrl))
    : []
  const savedSentenceIndices = new Set<number>()
  const savedSentenceEntryIds: Record<number, string> = {}

  for (const entry of matchedEntries) {
    const sentenceIndex = entry.sourceContext?.surface === "popup_deep_read"
      ? entry.sourceContext.sentenceIndex
      : undefined
    if (typeof sentenceIndex === "number") {
      savedSentenceIndices.add(sentenceIndex)
      savedSentenceEntryIds[sentenceIndex] = entry.id
    }
  }

  return {
    summary: studyUrl && matchedEntries.length > 0
      ? { studyUrl, count: matchedEntries.length, entryId: matchedEntries[0]?.id }
      : null,
    savedSentenceIndices,
    savedSentenceEntryIds,
  }
}

export default function DeepReadApp() {
  const [config, setConfig] = useState<AstraConfig | null>(null)
  const [studyContext, setStudyContext] = useState<PageStudyContext | null>(null)
  const [snapshotSentences, setSnapshotSentences] = useState<string[]>([])
  const [readingMode, setReadingMode] = useState<"focus" | "reading">("focus")
  const [studyLoop, setStudyLoop] = useState<StudyLoopViewModel | null>(null)
  const [pageDigest, setPageDigest] = useState<PageDigestRecord | null>(null)
  const [lastReadingPage, setLastReadingPage] = useState<{ url: string, title: string, hostname: string } | null>(null)
  const [digestLoading, setDigestLoading] = useState(false)
  const [dueCount, setDueCount] = useState(0)
  const [selectedSentenceIndex, setSelectedSentenceIndex] = useState(0)
  const [explanations, setExplanations] = useState<Record<number, string>>({})
  const [explainingIndex, setExplainingIndex] = useState<number | null>(null)
  const [savedSentenceIndices, setSavedSentenceIndices] = useState<Set<number>>(() => new Set())
  const [savedSentenceEntryIds, setSavedSentenceEntryIds] = useState<Record<number, string>>({})
  const [pageSavedReviewSummary, setPageSavedReviewSummary] = useState<PageSavedReviewSummary | null>(null)
  const [savingIndex, setSavingIndex] = useState<number | null>(null)
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null)
  const [autoPlayEnabled, setAutoPlayEnabled] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      const searchParams = new URLSearchParams(window.location.search)
      const requestedPageUrl = searchParams.get("pageUrl")?.trim() || ""
      const requestedSentenceAnchor = readSentenceAnchorFromSearchParams(searchParams)
      const [nextConfig, history, savedSession, vocabularyEntries] = await Promise.all([
        readConfig(),
        getReadingHistory(),
        requestedPageUrl ? getDeepReadSession(requestedPageUrl) : getLatestDeepReadSession(),
        getVocabularyEntries(),
      ])
      setConfig(nextConfig)
      setLastReadingPage(history[0]
        ? {
          url: history[0].url,
          title: history[0].title,
          hostname: history[0].hostname,
        }
        : null)
      const nextDueCount = await getDueVocabularyCount()
      setDueCount(nextDueCount)
      let savedSessionStudyLoop: StudyLoopViewModel | null = null

      if (savedSession) {
        setSnapshotSentences(savedSession.sentences)
        setStudyContext(normalizeStudyContext({
          pageUrl: savedSession.pageUrl,
          pageTitle: savedSession.pageTitle,
          hostname: savedSession.hostname,
          metaDescription: savedSession.metaDescription,
          contentSummary: savedSession.contentSummary,
          articleExcerpt: savedSession.articleExcerpt,
        }))
        setSelectedSentenceIndex(
          resolveSentenceAnchorIndex({
            sentences: savedSession.sentences,
            anchor: requestedSentenceAnchor ?? savedSession.selectedSentenceAnchor,
            fallbackIndex: savedSession.selectedSentenceIndex,
          }),
        )
        const digest = await getPageDigest(savedSession.pageUrl)
        setPageDigest(digest)
        const storedProgress = await getStudyProgress().catch(() => null)
        if (storedProgress) {
          savedSessionStudyLoop = deriveStudyLoopViewModel(storedProgress, savedSession.pageUrl)
          setStudyLoop(savedSessionStudyLoop)
        }
        const savedState = derivePageSavedReviewState(vocabularyEntries, savedSession.pageUrl)
        setPageSavedReviewSummary(savedState.summary)
        setSavedSentenceIndices(savedState.savedSentenceIndices)
        setSavedSentenceEntryIds(savedState.savedSentenceEntryIds)
      }

      let contextResponse = await getActiveTabStudyContext()
      if (!contextResponse.ok && requestedPageUrl) {
        await new Promise((resolve) => window.setTimeout(resolve, 350))
        contextResponse = await getActiveTabStudyContext()
      }
      if (!contextResponse.ok) {
        if (!savedSession) {
          setErrorMessage(contextResponse.error.message)
        } else {
          recordLearningLoopEvent("deep_read_opened", {
            source: "saved_session",
            restoredFromSession: true,
            pageUrl: savedSession.pageUrl,
            ...buildPersonalizedStrategyTelemetry(savedSessionStudyLoop?.personalizedStrategy),
          })
        }
        return
      }

      if (requestedPageUrl && contextResponse.context.pageUrl && contextResponse.context.pageUrl !== requestedPageUrl) {
        await new Promise((resolve) => window.setTimeout(resolve, 350))
        const retried = await getActiveTabStudyContext()
        if (retried.ok) {
          contextResponse = retried
        }
      }

      const nextStudyContext = normalizeStudyContext(contextResponse.context)
      const nextSentences = deriveDeepReadSentences(nextStudyContext)
      const nextSelectedSentenceIndex = resolveSentenceAnchorIndex({
        sentences: nextSentences,
        anchor: requestedSentenceAnchor ?? savedSession?.selectedSentenceAnchor,
        fallbackIndex: savedSession?.selectedSentenceIndex,
      })

      setStudyContext(nextStudyContext)
      setSnapshotSentences(nextSentences)
      setSelectedSentenceIndex(nextSelectedSentenceIndex)
      const savedState = derivePageSavedReviewState(vocabularyEntries, nextStudyContext.pageUrl)
      setPageSavedReviewSummary(savedState.summary)
      setSavedSentenceIndices(savedState.savedSentenceIndices)
      setSavedSentenceEntryIds(savedState.savedSentenceEntryIds)

      await saveDeepReadSession({
        context: contextResponse.context,
        selectedSentenceIndex: nextSelectedSentenceIndex,
      })

      if (nextStudyContext.pageUrl) {
        await recordStudyEvent({
          url: nextStudyContext.pageUrl,
          hostname: nextStudyContext.hostname ?? "",
          title: nextStudyContext.pageTitle ?? nextStudyContext.pageUrl,
          step: "guided_read",
        }).catch(() => undefined)
        const store = await getStudyProgress().catch(() => null)
        const nextStudyLoop = store ? deriveStudyLoopViewModel(store, nextStudyContext.pageUrl) : null
        setStudyLoop(nextStudyLoop)
        recordLearningLoopEvent("deep_read_opened", {
          source: "live_context",
          restoredFromSession: !!savedSession,
          pageUrl: nextStudyContext.pageUrl,
          ...buildPersonalizedStrategyTelemetry(nextStudyLoop?.personalizedStrategy),
        })
      }

      const pageUrl = contextResponse.context.pageUrl
      if (pageUrl) {
        const digest = await getPageDigest(pageUrl)
        setPageDigest(digest)
      }
    })()

    return () => {
      stopSpeaking()
    }
  }, [])

  const digestFingerprint = useMemo(() => {
    if (!studyContext || !config) return ""
    return computeFingerprint({
      url: studyContext.pageUrl ?? "",
      title: studyContext.pageTitle ?? "",
      contentSummary: buildStudyDigestContentSummary(studyContext),
      targetLang: config.targetLang,
      languageLevel: config.languageLevel,
    })
  }, [studyContext, config])

  const sentences = useMemo(() => {
    return deriveDeepReadSentences(studyContext, snapshotSentences)
  }, [snapshotSentences, studyContext])

  const selectedSentence = sentences[selectedSentenceIndex] ?? ""
  const digestStale = !!pageDigest && !!digestFingerprint && isDigestStale(pageDigest, digestFingerprint)
  const savedCount = savedSentenceIndices.size
  const canSpeakSelectedSentence = !!config && !!selectedSentence && config.tts.enabled && isTtsSupported(config.tts.engine)
  const selectedExplanation = explanations[selectedSentenceIndex]
  const selectedSentenceAnchor = buildSentenceAnchor(selectedSentence, selectedSentenceIndex)
  const explainModeLabel = config
    ? {
      beginner: t("label_explainModeBeginner"),
      exam: t("label_explainModeExam"),
      deep: t("label_explainModeDeep"),
    }[config.explainMode]
    : ""
  const studyLoopHeadline = studyLoop?.nextStep
    ? `${t("popup_studyNext")} ${getStudyStepLabel(studyLoop.nextStep)}`
    : t("popup_deepReadNextStepHeadline")
  const studyLoopHint = getStudyStepHint(studyLoop?.nextStep ?? null)
  const savedPageReviewActionLabel = pageSavedReviewSummary
    ? t("popup_studyPageSavedReviewAction")
    : dueCount > 0 ? `${t("popup_review")} (${dueCount})` : t("popup_review")

  useEffect(() => {
    if (!sentences.length) return
    setSelectedSentenceIndex((current) => Math.min(current, sentences.length - 1))
  }, [sentences])

  useEffect(() => {
    if (!studyContext?.pageUrl) return
    void saveDeepReadSession({
      context: studyContext,
      selectedSentenceIndex,
    })
  }, [studyContext, selectedSentenceIndex])

  const refreshStudyLoop = async () => {
    if (!studyContext?.pageUrl) return
    const store = await getStudyProgress().catch(() => null)
    setStudyLoop(store ? deriveStudyLoopViewModel(store, studyContext.pageUrl) : null)
  }

  const recordDeepReadStudyStep = async (step: Extract<StudyStep, "explain" | "vocab_save">) => {
    if (!studyContext?.pageUrl) return

    await recordStudyEvent({
      url: studyContext.pageUrl,
      hostname: studyContext.hostname ?? "",
      title: studyContext.pageTitle ?? studyContext.pageUrl,
      step,
    }).catch(() => undefined)

    await refreshStudyLoop()
  }

  const handleGenerateDigest = async () => {
    if (!studyContext || !config) return
    setDigestLoading(true)
    try {
      const digest = await generatePageDigest({
        pageTitle: studyContext.pageTitle ?? "",
        contentSummary: buildStudyDigestContentSummary(studyContext),
        targetLang: config.targetLang,
        languageLevel: config.languageLevel,
      })
      const activeHttp = await resolveActiveHttpTab()
      const url = activeHttp?.url ?? studyContext.pageUrl ?? ""
      const hostname = studyContext.hostname ?? ""
      const record = await savePageDigest({
        url,
        hostname,
        title: studyContext.pageTitle ?? "",
        targetLang: config.targetLang,
        languageLevel: config.languageLevel,
        contentSummary: buildStudyDigestContentSummary(studyContext),
      }, digest)
      setPageDigest(record)
    } finally {
      setDigestLoading(false)
    }
  }

  const handleExplainSentence = async (index: number) => {
    if (!config || !sentences[index] || explainingIndex !== null) return
    setExplainingIndex(index)
    try {
      const result = await translateTexts({
        texts: [sentences[index]],
        targetLang: config.targetLang,
        context: studyContext ? { ...studyContext, selectionContext: sentences[index] } : { selectionContext: sentences[index] },
        task: "explain",
        customSystemPrompt: buildExplainModeSystemPrompt(config.explainMode),
      })
      setExplanations((current) => ({
        ...current,
        [index]: result.ok ? (result.translations[0] ?? "") : `Warning: ${result.error.message}`,
      }))
      if (result.ok) {
        recordLearningLoopEvent("sentence_explained", {
          pageUrl: studyContext?.pageUrl,
          sentenceIndex: index,
          sentenceHash: buildSentenceAnchor(sentences[index], index)?.sentenceHash,
          ...buildPersonalizedStrategyTelemetry(studyLoop?.personalizedStrategy),
        })
        await recordDeepReadStudyStep("explain")
      }
    } finally {
      setExplainingIndex(null)
    }
  }

  const handleSaveSentence = async (index: number) => {
    if (!config || !studyContext || !sentences[index] || savingIndex !== null || savedSentenceIndices.has(index)) return
    setSavingIndex(index)
    try {
      const pageUrl = studyContext.pageUrl ?? window.location.href
      const ownedReadingItem = await upsertOwnedArticleFromUrl({
        url: pageUrl,
        title: studyContext.pageTitle ?? studyContext.hostname ?? sentences[index],
        status: "saved",
      })
      const savedEntry = await saveVocabularyEntry({
        text: sentences[index],
        explanation: explanations[index],
        context: studyContext.articleExcerpt ?? studyContext.contentSummary ?? studyContext.metaDescription,
        sourceContext: {
          surface: "popup_deep_read",
          pageTitle: studyContext.pageTitle,
          pageUrl,
          hostname: studyContext.hostname,
          contentSummary: studyContext.contentSummary,
          articleExcerpt: studyContext.articleExcerpt,
          sentenceText: sentences[index],
          sentenceHash: buildSentenceAnchor(sentences[index], index)?.sentenceHash,
          sentenceIndex: index,
          ...buildOwnedReadingVocabularySourceLink(ownedReadingItem),
        },
        url: pageUrl,
        hostname: studyContext.hostname,
      })
      setSavedSentenceIndices((current) => new Set(current).add(index))
      setSavedSentenceEntryIds((current) => ({ ...current, [index]: savedEntry.id }))
      setPageSavedReviewSummary((current) => ({
        studyUrl: current?.studyUrl ?? pageUrl,
        count: (current?.count ?? 0) + 1,
        entryId: current?.entryId ?? savedEntry.id,
      }))
      setDueCount(await getDueVocabularyCount())
      recordLearningLoopEvent("sentence_saved", {
        pageUrl,
        sentenceIndex: index,
        sentenceHash: buildSentenceAnchor(sentences[index], index)?.sentenceHash,
        ...buildPersonalizedStrategyTelemetry(studyLoop?.personalizedStrategy),
      })
      await recordDeepReadStudyStep("vocab_save")
    } finally {
      setSavingIndex(null)
    }
  }

  const handleSpeakSentence = async (index: number) => {
    if (!config || !sentences[index]) return
    if (speakingIndex === index) {
      setAutoPlayEnabled(false)
      stopSpeaking()
      setSpeakingIndex(null)
      return
    }
    const enabled = config.tts.enabled && isTtsSupported(config.tts.engine)
    if (!enabled) return
    stopSpeaking()
    const started = speak(sentences[index], {
      engine: config.tts.engine,
      voiceName: config.tts.voiceName,
      rate: config.tts.rate,
      pitch: config.tts.pitch,
      lang: config.targetLang,
      onEnd: () => setSpeakingIndex(null),
      onError: () => setSpeakingIndex(null),
    })
    setSpeakingIndex(started ? index : null)
  }

  const handleAutoPlaySelectedSentence = async () => {
    if (!config || !selectedSentence) return

    if (autoPlayEnabled) {
      setAutoPlayEnabled(false)
      stopSpeaking()
      setSpeakingIndex(null)
      return
    }

    const enabled = config.tts.enabled && isTtsSupported(config.tts.engine)
    if (!enabled) return

    stopSpeaking()
    setAutoPlayEnabled(true)

    const stopSequence = speakWithHighlight(sentences.slice(selectedSentenceIndex).join(" "), {
      engine: config.tts.engine,
      voiceName: config.tts.voiceName,
      rate: config.tts.rate,
      pitch: config.tts.pitch,
      lang: config.targetLang,
      onSentence: (relativeIndex) => {
        const nextIndex = selectedSentenceIndex + relativeIndex
        setSelectedSentenceIndex(nextIndex)
        setSpeakingIndex(nextIndex)
      },
      onEnd: () => {
        setAutoPlayEnabled(false)
        setSpeakingIndex(null)
      },
      onError: () => {
        setAutoPlayEnabled(false)
        setSpeakingIndex(null)
      },
    })

    if (!stopSequence) {
      setAutoPlayEnabled(false)
    }
  }

  const handleGoToAdjacentSentence = (direction: -1 | 1) => {
    setSelectedSentenceIndex((current) => {
      const nextIndex = current + direction
      if (nextIndex < 0 || nextIndex >= sentences.length) {
        return current
      }
      return nextIndex
    })
  }

  const openVocabulary = () => {
    void browser.tabs.create({ url: browser.runtime.getURL("/vocabulary.html") })
  }

  const openReadingQueue = () => {
    void browser.tabs.create({
      url: `${browser.runtime.getURL("/vocabulary.html" as "/popup.html")}?tab=reading`,
    })
  }

  const openReview = () => {
    void browser.tabs.create({ url: browser.runtime.getURL("/vocabulary.html?tab=review") })
  }

  const openFocusedReviewForSentence = (index: number) => {
    const savedEntryId = savedSentenceEntryIds[index]
    if (savedEntryId) {
      const pageUrl = studyContext?.pageUrl?.trim()
      if (pageUrl) {
        void openPageReviewLoop(pageUrl, savedEntryId)
        return
      }

      void openFocusedReview(savedEntryId)
      return
    }

    openReview()
  }

  const openSavedPageReview = () => {
    if (!pageSavedReviewSummary?.studyUrl) {
      openReview()
      return
    }

    void openPageReviewLoop(pageSavedReviewSummary.studyUrl, pageSavedReviewSummary.entryId)
  }

  const openSourcePage = () => {
    const pageUrl = studyContext?.pageUrl?.trim()
    if (!pageUrl) return

    recordLearningLoopEvent("returned_to_source", {
      pageUrl,
      source: "deep_read",
      ...buildPersonalizedStrategyTelemetry(studyLoop?.personalizedStrategy),
    })
    void browser.tabs.create({ url: pageUrl })
  }

  const openLastReadingPage = () => {
    if (!lastReadingPage?.url) return
    void browser.tabs.create({ url: lastReadingPage.url })
  }

  return (
    <div className="astra-deep-read-shell">
      <div className="astra-deep-read-glow" />
      <div className="astra-deep-read-glow-secondary" />

      <div className="astra-deep-read-container">
        <section className="astra-deep-read-hero-card">
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 20, alignItems: "flex-start" }}>
            <div style={{ flex: "1 1 460px", minWidth: 0 }}>
              <div className="astra-eyebrow">{t("popup_deepReadTitle")}</div>
              <h1 className="astra-deep-read-hero-title">
                {studyContext?.pageTitle || t("popup_deepReadPageFallbackTitle")}
              </h1>
              <p className="astra-deep-read-hero-subtitle">
                {studyContext?.hostname || t("popup_deepReadHint")}
              </p>
              {studyContext?.pageUrl && /^https?:\/\//i.test(studyContext.pageUrl) && (
                <button type="button" className="astra-btn-secondary" style={{ marginTop: 14 }} onClick={openSourcePage}>
                  {t("review_openSourcePage")}
                </button>
              )}
            </div>

            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", flex: "1 1 320px", width: "100%" }}>
              <div className="astra-deep-read-hero-stat-card">
                <div className="astra-micro-label astra-deep-read-hero-stat-label">{t("popup_studySentenceDeck")}</div>
                <div className="astra-deep-read-hero-stat-value">{sentences.length || 0}</div>
              </div>
              <div className="astra-deep-read-hero-stat-card">
                <div className="astra-micro-label astra-deep-read-hero-stat-label">{t("popup_review")}</div>
                <div className="astra-deep-read-hero-stat-value">{dueCount}</div>
              </div>
              <div className="astra-deep-read-hero-stat-card">
                <div className="astra-micro-label astra-deep-read-hero-stat-label">{t("label_explainMode")}</div>
                <div className="astra-deep-read-hero-stat-value astra-deep-read-hero-stat-value--compact">{explainModeLabel || "-"}</div>
              </div>
            </div>
          </div>
        </section>

        {errorMessage && (
          <div className="astra-deep-read-alert">
            {errorMessage}
          </div>
        )}

        <div className="astra-deep-read-content-grid">
          <section className="astra-card astra-deep-read-primary-panel">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
              <div>
                <div className="astra-micro-label astra-deep-read-warm-label">
                  {t("popup_studySentenceDeck")}
                </div>
                <div className="astra-deep-read-progress-copy">
                  {selectedSentence
                    ? formatMessage(t("popup_deepReadSentenceProgress"), selectedSentenceIndex + 1, sentences.length)
                    : t("popup_studySummaryEmpty")}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => setReadingMode("focus")}
                  className={readingMode === "focus" ? "astra-btn-primary" : "astra-btn-secondary"}
                >
                  Focus
                </button>
                <button
                  type="button"
                  onClick={() => setReadingMode("reading")}
                  className={readingMode === "reading" ? "astra-btn-primary" : "astra-btn-secondary"}
                >
                  Reading view
                </button>
                <button
                  type="button"
                  onClick={() => handleGoToAdjacentSentence(-1)}
                  className="astra-btn-secondary"
                  disabled={selectedSentenceIndex <= 0}
                >
                  {t("actionPrevious")}
                </button>
                <button
                  type="button"
                  onClick={() => void handleSpeakSentence(selectedSentenceIndex)}
                  className="astra-btn-secondary"
                  disabled={!canSpeakSelectedSentence}
                >
                  {speakingIndex === selectedSentenceIndex ? t("actionStop") : t("actionSpeak")}
                </button>
                <button
                  type="button"
                  onClick={() => void handleAutoPlaySelectedSentence()}
                  className="astra-btn-secondary"
                  disabled={!canSpeakSelectedSentence}
                >
                  {autoPlayEnabled ? t("popup_deepReadStopAutoplay") : t("popup_deepReadAutoplay")}
                </button>
                <button
                  type="button"
                  onClick={() => void handleExplainSentence(selectedSentenceIndex)}
                  className="astra-btn-secondary"
                  disabled={!selectedSentence}
                >
                  {explainingIndex === selectedSentenceIndex ? `${t("actionExplain")}...` : t("actionExplain")}
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveSentence(selectedSentenceIndex)}
                  className="astra-btn-primary"
                  disabled={!selectedSentence}
                >
                  {savedSentenceIndices.has(selectedSentenceIndex) ? t("actionSaved") : savingIndex === selectedSentenceIndex ? t("actionSaving") : t("actionSave")}
                </button>
                <button
                  type="button"
                  onClick={() => handleGoToAdjacentSentence(1)}
                  className="astra-btn-secondary"
                  disabled={selectedSentenceIndex >= sentences.length - 1}
                >
                  {t("actionNext")}
                </button>
              </div>
            </div>

            <div className="astra-deep-read-focus-card">
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
                <div className="astra-micro-label astra-deep-read-warm-label">
                  {studyContext?.hostname || t("popup_studyTitle")}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <span className="astra-chip-warm">{formatMessage(t("popup_deepReadSavedCount"), savedCount)}</span>
                  <span className="astra-chip-warm">{explainModeLabel || t("label_explainMode")}</span>
                </div>
              </div>

              <div className="astra-deep-read-focus-text">
                {selectedSentence || (studyContext?.contentSummary || studyContext?.metaDescription || t("popup_studySummaryEmpty"))}
              </div>

              <p className="astra-deep-read-helper-copy">
                {studyContext?.articleExcerpt
                  ? t("popup_studyArticleExcerpt")
                  : t("popup_studySentenceDeckFallback")}
              </p>
            </div>

            {pageSavedReviewSummary && (
              <div data-testid="deep-read-page-saved-review-cta" className="astra-deep-read-success-callout">
                <div className="astra-deep-read-success-title">
                  {t("popup_studyPageSavedReviewTitle")}
                </div>
                <div className="astra-deep-read-success-text">
                  {t("popup_studyPageSavedReviewHint", String(pageSavedReviewSummary.count))}
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
                  <button
                    type="button"
                    data-testid="deep-read-page-saved-review-button"
                    className="astra-cta-secondary"
                    onClick={openSavedPageReview}
                  >
                    {t("popup_studyPageSavedReviewAction")}
                  </button>
                  <button type="button" className="astra-btn-secondary" onClick={openVocabulary}>
                    {t("popup_vocabulary")}
                  </button>
                </div>
              </div>
            )}

            {readingMode === "reading" && sentences.length > 0 && (
              <div className="astra-deep-read-reading-workspace">
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
                  <div>
                    <div className="astra-micro-label astra-deep-read-muted-label">
                      Reading workspace
                    </div>
                    <div className="astra-deep-read-muted-copy">
                      Select any visible sentence to sync the focus card and keep studying from there.
                    </div>
                  </div>
                  {selectedSentenceAnchor?.sentenceHash && (
                    <span className="astra-chip-warm">{selectedSentenceAnchor.sentenceHash}</span>
                  )}
                </div>
                <div style={{ display: "grid", gap: 10 }}>
                  {sentences.map((sentence, index) => {
                    const isSelected = index === selectedSentenceIndex
                    return (
                      <button
                        key={`reading:${index}:${sentence}`}
                        type="button"
                        onClick={() => setSelectedSentenceIndex(index)}
                        className="astra-sentence-btn"
                        aria-pressed={isSelected}
                      >
                        <div className="astra-micro-label" style={{ color: isSelected ? "var(--astra-accent-warm-hover)" : "var(--astra-text-muted)", marginBottom: 4 }}>
                          {formatMessage(t("popup_deepReadSentenceNumber"), index + 1)}
                        </div>
                        <div className="astra-deep-read-reading-sentence-text">{sentence}</div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {selectedExplanation && (
              <div className="astra-deep-read-explanation-card">
                <div className="astra-micro-label astra-deep-read-info-label">
                  {explainModeLabel || t("actionExplain")}
                </div>
                <div className="astra-deep-read-info-copy">
                  {selectedExplanation}
                </div>
              </div>
            )}

            {savedSentenceIndices.has(selectedSentenceIndex) && (
              <div className="astra-deep-read-success-callout">
                <div className="astra-deep-read-success-title astra-deep-read-success-title--regular">{t("learningSavedTitle")}</div>
                <div className="astra-deep-read-success-text">{t("learningSavedHint")}</div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
                  <button
                    type="button"
                    className="astra-btn-primary"
                    onClick={() => openFocusedReviewForSentence(selectedSentenceIndex)}
                  >
                    {savedSentenceEntryIds[selectedSentenceIndex] ? t("review_actionReviewThisSentenceNow") : t("popup_review")}
                  </button>
                  <button type="button" className="astra-btn-secondary" onClick={openVocabulary}>
                    {t("popup_vocabulary")}
                  </button>
                </div>
              </div>
            )}

            <div style={{ marginTop: 20 }}>
              <div className="astra-micro-label astra-deep-read-section-label">
                {t("popup_deepReadQueueTitle")}
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                {sentences.map((sentence, index) => {
                  const isSelected = index === selectedSentenceIndex
                  const isSaved = savedSentenceIndices.has(index)

                  return (
                    <button
                      key={`${index}:${sentence}`}
                      type="button"
                      onClick={() => setSelectedSentenceIndex(index)}
                      className="astra-sentence-btn"
                      aria-pressed={isSelected}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 6 }}>
                        <div className="astra-micro-label" style={{ color: isSelected ? "var(--astra-accent-warm-hover)" : "var(--astra-text-muted)" }}>
                          {formatMessage(t("popup_deepReadSentenceNumber"), index + 1)}
                        </div>
                        {isSaved && <span className="astra-chip-success">{t("actionSaved")}</span>}
                      </div>
                      <div style={{ fontSize: 14, lineHeight: 1.65 }}>{sentence}</div>
                    </button>
                  )
                })}

                {!sentences.length && (
                  <div className="astra-deep-read-empty-state">
                    <div className="astra-deep-read-empty-title">
                      {lastReadingPage ? t("popup_deepReadEmptyHistoryTitle") : t("popup_studyEmptyTitle")}
                    </div>
                    <div className="astra-deep-read-empty-copy">
                      {lastReadingPage ? t("popup_deepReadEmptyHistoryHint") : t("popup_studySummaryEmpty")}
                    </div>
                    {lastReadingPage && (
                      <div style={{ marginTop: 12 }}>
                        <div className="astra-deep-read-empty-meta">
                          {lastReadingPage.title || lastReadingPage.hostname || lastReadingPage.url}
                        </div>
                        <button
                          type="button"
                          className="astra-btn-primary"
                          onClick={openLastReadingPage}
                        >
                          {t("popup_deepReadOpenLastPage")}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>

          <aside style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <section className="astra-deep-read-sidebar-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
                <div className="astra-sidebar-title">{t("popup_studyTitle")}</div>
                <button type="button" className="astra-btn-secondary" onClick={() => void handleGenerateDigest()}>
                  {digestLoading ? "..." : pageDigest ? t("popup_regenerateDigest") : t("popup_generateDigest")}
                </button>
              </div>

              {pageDigest ? (
                <>
                  <div className="astra-deep-read-digest-summary">{pageDigest.summary}</div>
                  {pageDigest.suggestedAction && (
                    <div className="astra-deep-read-warm-callout">
                      {pageDigest.suggestedAction}
                    </div>
                  )}
                  {digestStale && (
                    <div className="astra-deep-read-stale-copy">{t("popup_digestStaleHint")}</div>
                  )}
                </>
              ) : (
                <div className="astra-deep-read-digest-empty">
                  {t("popup_deepReadHint")}
                </div>
              )}
            </section>

            <section className="astra-deep-read-cta-card">
              <div className="astra-micro-label astra-deep-read-cta-eyebrow">
                {t("popup_deepReadNextStepTitle")}
              </div>
              <div className="astra-deep-read-cta-title">
                {studyLoopHeadline}
              </div>
              <div className="astra-deep-read-cta-text">
                {studyLoopHint}
              </div>
              {studyLoop && (
                <div className="astra-deep-read-cta-progress">
                  <div className="astra-deep-read-cta-progress-title">
                    {studyLoop.completionPercent}% complete
                  </div>
                  <div className="astra-deep-read-cta-progress-copy">
                    {studyLoop.completedSteps.length > 0
                      ? studyLoop.completedSteps.map((step) => getStudyStepLabel(step)).join(" → ")
                      : t("popup_studyNoStepsYet")}
                  </div>
                </div>
              )}
              {studyLoop?.personalizedStrategy && (
                <div
                  data-testid="deep-read-personalized-strategy-card"
                  className="astra-deep-read-strategy-card"
                >
                  <div className="astra-deep-read-strategy-kicker">
                    Personalized strategy
                  </div>
                  <div className="astra-deep-read-strategy-title">
                    {studyLoop.personalizedStrategy.label}
                  </div>
                  <div className="astra-deep-read-strategy-copy">
                    {studyLoop.personalizedStrategy.hint}
                  </div>
                  <div className="astra-deep-read-strategy-evidence">
                    {studyLoop.personalizedStrategy.evidence}
                  </div>
                </div>
              )}
              <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
                <button type="button" className="astra-cta-primary" onClick={openReadingQueue}>{t("vocabulary_tabReading")}</button>
                <button
                  type="button"
                  data-testid="deep-read-next-step-review-button"
                  className="astra-cta-secondary"
                  onClick={openSavedPageReview}
                >
                  {savedPageReviewActionLabel}
                </button>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  )
}
