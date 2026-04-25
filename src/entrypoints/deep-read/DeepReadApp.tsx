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
import { deriveStudyLoopViewModel, getStudyProgress, recordStudyEvent, type StudyLoopViewModel, type StudyStep } from "@/utils/storage/study-progress"
import { splitSentences, isTtsSupported, speak, speakWithHighlight, stopSpeaking } from "@/utils/tts"
import { translateTexts } from "@/utils/translate/translate"
import { getDueVocabularyCount, saveVocabularyEntry } from "@/utils/storage/vocabulary"
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
  const [savingIndex, setSavingIndex] = useState<number | null>(null)
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null)
  const [autoPlayEnabled, setAutoPlayEnabled] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      const searchParams = new URLSearchParams(window.location.search)
      const requestedPageUrl = searchParams.get("pageUrl")?.trim() || ""
      const requestedSentenceAnchor = readSentenceAnchorFromSearchParams(searchParams)
      const [nextConfig, history, savedSession] = await Promise.all([
        readConfig(),
        getReadingHistory(),
        requestedPageUrl ? getDeepReadSession(requestedPageUrl) : getLatestDeepReadSession(),
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
          setStudyLoop(deriveStudyLoopViewModel(storedProgress, savedSession.pageUrl))
        }
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

      await saveDeepReadSession({
        context: contextResponse.context,
        selectedSentenceIndex: nextSelectedSentenceIndex,
      })

      if (nextStudyContext.pageUrl) {
        recordLearningLoopEvent("deep_read_opened", {
          source: "live_context",
          restoredFromSession: !!savedSession,
          pageUrl: nextStudyContext.pageUrl,
        })
        await recordStudyEvent({
          url: nextStudyContext.pageUrl,
          hostname: nextStudyContext.hostname ?? "",
          title: nextStudyContext.pageTitle ?? nextStudyContext.pageUrl,
          step: "guided_read",
        }).catch(() => undefined)
        const store = await getStudyProgress().catch(() => null)
        setStudyLoop(store ? deriveStudyLoopViewModel(store, nextStudyContext.pageUrl) : null)
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
      await saveVocabularyEntry({
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
      setDueCount(await getDueVocabularyCount())
      recordLearningLoopEvent("sentence_saved", {
        pageUrl,
        sentenceIndex: index,
        sentenceHash: buildSentenceAnchor(sentences[index], index)?.sentenceHash,
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

  const openSourcePage = () => {
    const pageUrl = studyContext?.pageUrl?.trim()
    if (!pageUrl) return

    recordLearningLoopEvent("returned_to_source", {
      pageUrl,
      source: "deep_read",
    })
    void browser.tabs.create({ url: pageUrl })
  }

  const openLastReadingPage = () => {
    if (!lastReadingPage?.url) return
    void browser.tabs.create({ url: lastReadingPage.url })
  }

  return (
    <div style={pageShellStyle}>
      <div style={pageGlowStyle} />
      <div style={pageGlowSecondaryStyle} />

      <div style={pageContainerStyle}>
        <section style={heroCardStyle}>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 20, alignItems: "flex-start" }}>
            <div style={{ flex: "1 1 460px", minWidth: 0 }}>
              <div style={eyebrowStyle}>{t("popup_deepReadTitle")}</div>
              <h1 style={{ fontSize: 34, lineHeight: 1.1, margin: "0 0 10px", color: "#f8fafc" }}>
                {studyContext?.pageTitle || t("popup_deepReadPageFallbackTitle")}
              </h1>
              <p style={{ fontSize: 15, lineHeight: 1.7, color: "rgba(226,232,240,0.86)", margin: 0, maxWidth: 700 }}>
                {studyContext?.hostname || t("popup_deepReadHint")}
              </p>
              {studyContext?.pageUrl && /^https?:\/\//i.test(studyContext.pageUrl) && (
                <button type="button" style={{ ...secondaryButtonStyle, marginTop: 14 }} onClick={openSourcePage}>
                  {t("review_openSourcePage")}
                </button>
              )}
            </div>

            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", flex: "1 1 320px", width: "100%" }}>
              <div style={heroStatCardStyle}>
                <div style={heroStatLabelStyle}>{t("popup_studySentenceDeck")}</div>
                <div style={heroStatValueStyle}>{sentences.length || 0}</div>
              </div>
              <div style={heroStatCardStyle}>
                <div style={heroStatLabelStyle}>{t("popup_review")}</div>
                <div style={heroStatValueStyle}>{dueCount}</div>
              </div>
              <div style={heroStatCardStyle}>
                <div style={heroStatLabelStyle}>{t("label_explainMode")}</div>
                <div style={{ ...heroStatValueStyle, fontSize: 16 }}>{explainModeLabel || "-"}</div>
              </div>
            </div>
          </div>
        </section>

        {errorMessage && (
          <div style={{ marginBottom: 16, padding: "12px 14px", background: "#fff7ed", border: "1px solid #fdba74", borderRadius: 14, color: "#9a3412", position: "relative", zIndex: 1 }}>
            {errorMessage}
          </div>
        )}

        <div style={contentGridStyle}>
          <section style={primaryPanelStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: 0.4, textTransform: "uppercase", color: "#c2410c", marginBottom: 6 }}>
                  {t("popup_studySentenceDeck")}
                </div>
                <div style={{ fontSize: 15, color: "#475569" }}>
                  {selectedSentence
                    ? formatMessage(t("popup_deepReadSentenceProgress"), selectedSentenceIndex + 1, sentences.length)
                    : t("popup_studySummaryEmpty")}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => setReadingMode("focus")}
                  style={readingMode === "focus" ? primaryButtonStyle : secondaryButtonStyle}
                >
                  Focus
                </button>
                <button
                  type="button"
                  onClick={() => setReadingMode("reading")}
                  style={readingMode === "reading" ? primaryButtonStyle : secondaryButtonStyle}
                >
                  Reading view
                </button>
                <button
                  type="button"
                  onClick={() => handleGoToAdjacentSentence(-1)}
                  style={{ ...secondaryButtonStyle, opacity: selectedSentenceIndex > 0 ? 1 : 0.5, cursor: selectedSentenceIndex > 0 ? "pointer" : "not-allowed" }}
                  disabled={selectedSentenceIndex <= 0}
                >
                  {t("actionPrevious")}
                </button>
                <button
                  type="button"
                  onClick={() => void handleSpeakSentence(selectedSentenceIndex)}
                  style={{ ...secondaryButtonStyle, opacity: canSpeakSelectedSentence ? 1 : 0.5, cursor: canSpeakSelectedSentence ? "pointer" : "not-allowed" }}
                  disabled={!canSpeakSelectedSentence}
                >
                  {speakingIndex === selectedSentenceIndex ? t("actionStop") : t("actionSpeak")}
                </button>
                <button
                  type="button"
                  onClick={() => void handleAutoPlaySelectedSentence()}
                  style={{ ...secondaryButtonStyle, opacity: canSpeakSelectedSentence ? 1 : 0.5, cursor: canSpeakSelectedSentence ? "pointer" : "not-allowed" }}
                  disabled={!canSpeakSelectedSentence}
                >
                  {autoPlayEnabled ? t("popup_deepReadStopAutoplay") : t("popup_deepReadAutoplay")}
                </button>
                <button
                  type="button"
                  onClick={() => void handleExplainSentence(selectedSentenceIndex)}
                  style={{ ...secondaryButtonStyle, opacity: selectedSentence ? 1 : 0.5, cursor: selectedSentence ? "pointer" : "not-allowed" }}
                  disabled={!selectedSentence}
                >
                  {explainingIndex === selectedSentenceIndex ? `${t("actionExplain")}...` : t("actionExplain")}
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveSentence(selectedSentenceIndex)}
                  style={{ ...primaryButtonStyle, opacity: selectedSentence ? 1 : 0.5, cursor: selectedSentence ? "pointer" : "not-allowed" }}
                  disabled={!selectedSentence}
                >
                  {savedSentenceIndices.has(selectedSentenceIndex) ? t("actionSaved") : savingIndex === selectedSentenceIndex ? t("actionSaving") : t("actionSave")}
                </button>
                <button
                  type="button"
                  onClick={() => handleGoToAdjacentSentence(1)}
                  style={{ ...secondaryButtonStyle, opacity: selectedSentenceIndex < sentences.length - 1 ? 1 : 0.5, cursor: selectedSentenceIndex < sentences.length - 1 ? "pointer" : "not-allowed" }}
                  disabled={selectedSentenceIndex >= sentences.length - 1}
                >
                  {t("actionNext")}
                </button>
              </div>
            </div>

            <div style={focusSentenceCardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.3, textTransform: "uppercase", color: "#9a3412" }}>
                  {studyContext?.hostname || t("popup_studyTitle")}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <span style={chipStyle}>{formatMessage(t("popup_deepReadSavedCount"), savedCount)}</span>
                  <span style={chipStyle}>{explainModeLabel || t("label_explainMode")}</span>
                </div>
              </div>

              <div style={{ fontSize: 26, lineHeight: 1.45, fontWeight: 700, color: "#0f172a" }}>
                {selectedSentence || (studyContext?.contentSummary || studyContext?.metaDescription || t("popup_studySummaryEmpty"))}
              </div>

              <p style={{ margin: "16px 0 0", fontSize: 14, lineHeight: 1.7, color: "#475569" }}>
                {studyContext?.articleExcerpt
                  ? t("popup_studyArticleExcerpt")
                  : t("popup_studySentenceDeckFallback")}
              </p>
            </div>

            {readingMode === "reading" && sentences.length > 0 && (
              <div style={readingWorkspaceStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.3, textTransform: "uppercase", color: "#475569", marginBottom: 4 }}>
                      Reading workspace
                    </div>
                    <div style={{ fontSize: 13, color: "#64748b" }}>
                      Select any visible sentence to sync the focus card and keep studying from there.
                    </div>
                  </div>
                  {selectedSentenceAnchor?.sentenceHash && (
                    <span style={chipStyle}>{selectedSentenceAnchor.sentenceHash}</span>
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
                        style={{
                          ...readingSentenceButtonStyle,
                          ...(isSelected ? readingSentenceButtonSelectedStyle : null),
                        }}
                      >
                        <span style={{ ...readingSentenceLabelStyle, color: isSelected ? "#c2410c" : "#64748b" }}>
                          {formatMessage(t("popup_deepReadSentenceNumber"), index + 1)}
                        </span>
                        <span style={{ fontSize: 15, lineHeight: 1.8, color: "#1e293b" }}>{sentence}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {selectedExplanation && (
              <div style={explanationCardStyle}>
                <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.3, textTransform: "uppercase", color: "#1d4ed8", marginBottom: 8 }}>
                  {explainModeLabel || t("actionExplain")}
                </div>
                <div style={{ whiteSpace: "pre-wrap", color: "#1e3a8a", lineHeight: 1.7 }}>
                  {selectedExplanation}
                </div>
              </div>
            )}

            {savedSentenceIndices.has(selectedSentenceIndex) && (
              <div style={savedBannerStyle}>
                <div style={{ fontWeight: 700, color: "#166534", marginBottom: 4 }}>{t("learningSavedTitle")}</div>
                <div style={{ fontSize: 13, color: "#166534" }}>{t("learningSavedHint")}</div>
              </div>
            )}

            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: 0.3, textTransform: "uppercase", color: "#64748b", marginBottom: 10 }}>
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
                      style={{
                        textAlign: "left",
                        padding: "14px 16px",
                        borderRadius: 14,
                        border: isSelected ? "1px solid #fb923c" : "1px solid rgba(148,163,184,0.22)",
                        background: isSelected ? "linear-gradient(135deg, #fff7ed 0%, #ffffff 100%)" : "rgba(255,255,255,0.74)",
                        boxShadow: isSelected ? "0 14px 30px rgba(249,115,22,0.12)" : "none",
                        cursor: "pointer",
                        color: "#0f172a",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 6 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.3, textTransform: "uppercase", color: isSelected ? "#c2410c" : "#64748b" }}>
                          {formatMessage(t("popup_deepReadSentenceNumber"), index + 1)}
                        </div>
                        {isSaved && <span style={{ ...chipStyle, background: "#dcfce7", color: "#166534", borderColor: "#86efac" }}>{t("actionSaved")}</span>}
                      </div>
                      <div style={{ fontSize: 14, lineHeight: 1.65 }}>{sentence}</div>
                    </button>
                  )
                })}

                {!sentences.length && (
                  <div style={{ padding: "18px 16px", borderRadius: 14, background: "rgba(255,255,255,0.74)", border: "1px solid rgba(148,163,184,0.22)", color: "#475569" }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", marginBottom: 6 }}>
                      {lastReadingPage ? t("popup_deepReadEmptyHistoryTitle") : t("popup_studyEmptyTitle")}
                    </div>
                    <div style={{ fontSize: 13, lineHeight: 1.65 }}>
                      {lastReadingPage ? t("popup_deepReadEmptyHistoryHint") : t("popup_studySummaryEmpty")}
                    </div>
                    {lastReadingPage && (
                      <div style={{ marginTop: 12 }}>
                        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>
                          {lastReadingPage.title || lastReadingPage.hostname || lastReadingPage.url}
                        </div>
                        <button
                          type="button"
                          style={primaryButtonStyle}
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
            <section style={sidebarCardStyle}>
              <div style={sidebarTitleStyle}>{t("popup_studyTitle")}</div>
              <div style={{ fontSize: 14, lineHeight: 1.75, color: "#334155", whiteSpace: "pre-wrap" }}>
                {studyContext?.contentSummary || studyContext?.metaDescription || t("popup_studySummaryEmpty")}
              </div>
              {studyContext?.articleExcerpt && (
                <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0", color: "#475569", fontSize: 13, lineHeight: 1.7 }}>
                  {studyContext.articleExcerpt}
                </div>
              )}
            </section>

            <section style={sidebarCardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
                <div style={sidebarTitleStyle}>{pageDigest ? pageDigest.headline : t("popup_generateDigest")}</div>
                <button type="button" style={secondaryButtonStyle} onClick={() => void handleGenerateDigest()}>
                  {digestLoading ? "..." : pageDigest ? t("popup_regenerateDigest") : t("popup_generateDigest")}
                </button>
              </div>

              {pageDigest ? (
                <>
                  <div style={{ fontSize: 14, color: "#334155", lineHeight: 1.75, marginBottom: 12 }}>{pageDigest.summary}</div>
                  {pageDigest.suggestedAction && (
                    <div style={{ padding: "12px 14px", background: "#fefce8", border: "1px solid #fde68a", borderRadius: 12, fontSize: 13, color: "#854d0e", lineHeight: 1.65 }}>
                      {pageDigest.suggestedAction}
                    </div>
                  )}
                  {digestStale && (
                    <div style={{ marginTop: 10, fontSize: 12, color: "#9a3412" }}>{t("popup_digestStaleHint")}</div>
                  )}
                </>
              ) : (
                <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.7 }}>
                  {t("popup_deepReadHint")}
                </div>
              )}
            </section>

            <section style={ctaCardStyle}>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.3, textTransform: "uppercase", color: "#fed7aa", marginBottom: 8 }}>
                {t("popup_deepReadNextStepTitle")}
              </div>
              <div style={{ fontSize: 24, lineHeight: 1.2, fontWeight: 800, color: "#fff7ed", marginBottom: 10 }}>
                {studyLoopHeadline}
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.7, color: "rgba(255,237,213,0.86)", marginBottom: 16 }}>
                {studyLoopHint}
              </div>
              {studyLoop && (
                <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 14, background: "rgba(255,247,237,0.12)", border: "1px solid rgba(255,255,255,0.16)" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#fff7ed", marginBottom: 6 }}>
                    {studyLoop.completionPercent}% complete
                  </div>
                  <div style={{ fontSize: 12, lineHeight: 1.6, color: "rgba(255,237,213,0.84)" }}>
                    {studyLoop.completedSteps.length > 0
                      ? studyLoop.completedSteps.map((step) => getStudyStepLabel(step)).join(" → ")
                      : t("popup_studyNoStepsYet")}
                  </div>
                </div>
              )}
              <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
                <button type="button" style={ctaPrimaryButtonStyle} onClick={openReadingQueue}>{t("vocabulary_tabReading")}</button>
                <button type="button" style={ctaSecondaryButtonStyle} onClick={openReview}>
                  {dueCount > 0 ? `${t("popup_review")} (${dueCount})` : t("popup_review")}
                </button>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  )
}

const pageShellStyle: React.CSSProperties = {
  minHeight: "100vh",
  padding: "24px 16px 40px",
  background: "linear-gradient(180deg, #fff7ed 0%, #fffaf3 42%, #f8fafc 100%)",
  fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  color: "#0f172a",
  lineHeight: 1.5,
  position: "relative",
  overflow: "hidden",
}

const pageGlowStyle: React.CSSProperties = {
  position: "absolute",
  top: -120,
  right: -40,
  width: 320,
  height: 320,
  borderRadius: "50%",
  background: "radial-gradient(circle, rgba(251,146,60,0.30) 0%, rgba(251,146,60,0) 72%)",
}

const pageGlowSecondaryStyle: React.CSSProperties = {
  position: "absolute",
  left: -120,
  top: 220,
  width: 260,
  height: 260,
  borderRadius: "50%",
  background: "radial-gradient(circle, rgba(59,130,246,0.18) 0%, rgba(59,130,246,0) 72%)",
}

const pageContainerStyle: React.CSSProperties = {
  maxWidth: 1180,
  margin: "0 auto",
  position: "relative",
  zIndex: 1,
}

const heroCardStyle: React.CSSProperties = {
  marginBottom: 18,
  padding: "24px 24px 22px",
  borderRadius: 24,
  background: "linear-gradient(135deg, #0f172a 0%, #1e293b 52%, #7c2d12 100%)",
  boxShadow: "0 24px 80px rgba(15,23,42,0.22)",
}

const eyebrowStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "6px 10px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.10)",
  border: "1px solid rgba(255,255,255,0.14)",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  color: "#fdba74",
  marginBottom: 14,
}

const heroStatCardStyle: React.CSSProperties = {
  padding: "14px 16px",
  borderRadius: 18,
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.12)",
  backdropFilter: "blur(10px)",
}

const heroStatLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: 0.4,
  textTransform: "uppercase",
  color: "rgba(226,232,240,0.75)",
  marginBottom: 6,
}

const heroStatValueStyle: React.CSSProperties = {
  fontSize: 26,
  fontWeight: 800,
  color: "#f8fafc",
}

const contentGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 18,
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  alignItems: "start",
}

const primaryPanelStyle: React.CSSProperties = {
  padding: 22,
  background: "rgba(255,255,255,0.76)",
  border: "1px solid rgba(255,255,255,0.65)",
  borderRadius: 24,
  boxShadow: "0 20px 50px rgba(15,23,42,0.08)",
  backdropFilter: "blur(12px)",
}

const focusSentenceCardStyle: React.CSSProperties = {
  padding: "22px 20px",
  borderRadius: 22,
  background: "linear-gradient(180deg, #ffffff 0%, #fff7ed 100%)",
  border: "1px solid rgba(251,146,60,0.28)",
  boxShadow: "0 18px 36px rgba(251,146,60,0.10)",
}

const explanationCardStyle: React.CSSProperties = {
  marginTop: 14,
  padding: "16px 18px",
  background: "#eff6ff",
  border: "1px solid #bfdbfe",
  borderRadius: 16,
}

const savedBannerStyle: React.CSSProperties = {
  marginTop: 14,
  padding: "14px 16px",
  background: "#f0fdf4",
  border: "1px solid #86efac",
  borderRadius: 16,
}

const chipStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  borderRadius: 999,
  border: "1px solid #fed7aa",
  background: "rgba(255,255,255,0.82)",
  color: "#9a3412",
  fontSize: 11,
  fontWeight: 800,
  padding: "5px 9px",
}

const readingWorkspaceStyle: React.CSSProperties = {
  marginTop: 18,
  padding: "18px 18px 16px",
  borderRadius: 20,
  background: "rgba(248,250,252,0.82)",
  border: "1px solid rgba(226,232,240,0.95)",
}

const readingSentenceButtonStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
  textAlign: "left",
  borderRadius: 14,
  border: "1px solid rgba(203,213,225,0.9)",
  background: "rgba(255,255,255,0.8)",
  padding: "14px 16px",
  cursor: "pointer",
}

const readingSentenceButtonSelectedStyle: React.CSSProperties = {
  border: "1px solid #fb923c",
  background: "linear-gradient(135deg, #fff7ed 0%, #ffffff 100%)",
  boxShadow: "0 14px 30px rgba(249,115,22,0.12)",
}

const readingSentenceLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: 0.3,
  textTransform: "uppercase",
}

const sidebarCardStyle: React.CSSProperties = {
  padding: 18,
  background: "rgba(255,255,255,0.82)",
  border: "1px solid rgba(226,232,240,0.95)",
  borderRadius: 20,
  boxShadow: "0 14px 30px rgba(15,23,42,0.05)",
}

const sidebarTitleStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 800,
  color: "#0f172a",
  marginBottom: 10,
}

const ctaCardStyle: React.CSSProperties = {
  padding: 20,
  borderRadius: 22,
  background: "linear-gradient(135deg, #9a3412 0%, #ea580c 52%, #fb923c 100%)",
  boxShadow: "0 18px 42px rgba(194,65,12,0.24)",
}

const primaryButtonStyle: React.CSSProperties = {
  border: "1px solid #ea580c",
  background: "#ea580c",
  color: "#fff7ed",
  borderRadius: 10,
  padding: "9px 14px",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
}

const secondaryButtonStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f172a",
  borderRadius: 10,
  padding: "9px 14px",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
}

const ctaPrimaryButtonStyle: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.3)",
  background: "#fff7ed",
  color: "#9a3412",
  borderRadius: 12,
  padding: "11px 14px",
  fontSize: 13,
  fontWeight: 800,
  cursor: "pointer",
}

const ctaSecondaryButtonStyle: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.32)",
  background: "rgba(255,247,237,0.12)",
  color: "#fff7ed",
  borderRadius: 12,
  padding: "11px 14px",
  fontSize: 13,
  fontWeight: 800,
  cursor: "pointer",
}
