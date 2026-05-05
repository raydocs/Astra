import { useEffect, useRef, useState } from "react"
import { browser } from "#imports"
import {
  buildLearningLoopAccountContinuityPopupSignInUrl,
  DEFAULT_LEARNING_LOOP_COPY_VARIANT,
  getLearningLoopCopyVariant,
  LEARNING_LOOP_COMMERCIAL_SURFACE_COPY,
  LEARNING_LOOP_COPY,
  LEARNING_LOOP_DIFFERENTIATION_COPY,
  recordLearningLoopEvent,
  type LearningLoopCopyVariant,
} from "@/utils/learning-loop-events"
import { saveConfig } from "@/utils/storage/config"

const SOURCE_LANGUAGES = [
  { value: "en", label: "English" },
  { value: "ja", label: "Japanese" },
  { value: "ko", label: "Korean" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "es", label: "Spanish" },
]

const TARGET_LANGUAGES = [
  { value: "zh-CN", label: "简体中文" },
  { value: "zh-TW", label: "繁體中文" },
  { value: "en", label: "English" },
  { value: "ja", label: "日本語" },
  { value: "ko", label: "한국어" },
  { value: "fr", label: "Français" },
  { value: "de", label: "Deutsch" },
  { value: "es", label: "Español" },
]

const LEVEL_OPTIONS = [
  { value: "beginner", label: "Beginner", description: "Simple explanations, basic vocabulary" },
  { value: "intermediate", label: "Intermediate", description: "Balanced explanations with grammar context" },
  { value: "advanced", label: "Advanced", description: "Detailed analysis with nuanced explanations" },
]

const EXPLAIN_MODE_OPTIONS = [
  { value: "beginner", label: "Beginner coach", description: "Plain-language explanations and easier wording" },
  { value: "exam", label: "Exam coach", description: "Grammar, collocations, and test-oriented breakdowns" },
  { value: "deep", label: "Deep reading", description: "Nuance, tone, and why the sentence works this way" },
]

const BRAND_COLOR = "var(--astra-brand)"
const TOTAL_STEPS = 4

const containerStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "var(--astra-font)",
  background: "linear-gradient(135deg, var(--astra-bg-primary) 0%, var(--astra-brand-muted) 100%)",
  margin: 0,
  padding: 24,
  boxSizing: "border-box",
}

const cardStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 500,
  background: "var(--astra-bg-card)",
  borderRadius: 16,
  boxShadow: "var(--astra-shadow-lg)",
  padding: "48px 40px",
  boxSizing: "border-box",
}

const dotContainerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "center",
  gap: 8,
  marginBottom: 40,
}

const titleStyle: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 700,
  color: "var(--astra-text-primary)",
  textAlign: "center",
  margin: "0 0 8px 0",
  lineHeight: 1.3,
}

const taglineStyle: React.CSSProperties = {
  fontSize: 16,
  color: "var(--astra-text-muted)",
  textAlign: "center",
  margin: "0 0 32px 0",
  lineHeight: 1.5,
}

// primaryButtonStyle — now using className="astra-btn-primary"

const labelTextStyle: React.CSSProperties = {
  display: "block",
  fontSize: 14,
  fontWeight: 600,
  color: "var(--astra-text-secondary)",
  marginBottom: 8,
}

// selectStyle removed — now using className="astra-input"

const summaryBoxStyle: React.CSSProperties = {
  background: "var(--astra-brand-muted)",
  borderRadius: 10,
  padding: "20px 24px",
  marginBottom: 24,
  textAlign: "center",
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

async function consumeIosBootstrapForOnboarding(source: string): Promise<IosBootstrapRuntimeResponse> {
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

async function replayIosBootstrapForOnboarding(sessionId?: string): Promise<IosBootstrapRuntimeResponse> {
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

function formatStatusTime(value: string | null): string {
  if (!value) {
    return "not yet"
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return parsed.toLocaleString()
}

function buildPopupSignInDeepLinkUrl(): string {
  return buildLearningLoopAccountContinuityPopupSignInUrl((path) => browser.runtime.getURL(path as "/popup.html"))
}

function StepDots({ current }: { current: number }) {
  return (
    <div style={dotContainerStyle}>
      {Array.from({ length: TOTAL_STEPS }, (_, i) => (
        <div
          key={i}
          style={{
            width: i === current ? 24 : 8,
            height: 8,
            borderRadius: 4,
            background: i === current ? BRAND_COLOR : "var(--astra-border)",
            transition: "all 0.25s ease",
          }}
        />
      ))}
    </div>
  )
}

function StepWelcome({ onNext }: { onNext: () => void }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 16,
          background: `linear-gradient(135deg, ${BRAND_COLOR}, var(--astra-brand-hover))`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 24px auto",
          fontSize: 28,
          color: "var(--astra-text-on-brand)",
          fontWeight: 800,
          letterSpacing: -1,
        }}
      >
        A
      </div>
      <h1 style={titleStyle}>Astra — AI Language Learning</h1>
      <p style={taglineStyle}>Not just a translator: turn real webpages into sentence explanations, saved vocabulary, and spaced review.</p>
      <button
        type="button"
        onClick={onNext}
        className="astra-btn-primary"
        style={{ display: "block", width: "100%", padding: "14px 24px", fontSize: 16 }}
      >
        Get Started
      </button>
    </div>
  )
}

function StepLanguage({
  sourceLang,
  targetLang,
  languageLevel,
  explainMode,
  onSourceChange,
  onTargetChange,
  onLevelChange,
  onExplainModeChange,
  onNext,
}: {
  sourceLang: string
  targetLang: string
  languageLevel: string
  explainMode: string
  onSourceChange: (lang: string) => void
  onTargetChange: (lang: string) => void
  onLevelChange: (level: string) => void
  onExplainModeChange: (mode: string) => void
  onNext: () => void
}) {
  return (
    <div>
      <h1 style={{ ...titleStyle, fontSize: 24, marginBottom: 4 }}>Choose Your Languages</h1>
      <p style={{ ...taglineStyle, marginBottom: 28 }}>
        Tell us what you're learning so Astra can package each page into the right practice loop.
      </p>

      <div style={{ marginBottom: 20 }}>
        <label htmlFor="onboarding-source-language" style={labelTextStyle}>What language are you learning?</label>
        <select
          id="onboarding-source-language"
          value={sourceLang}
          onChange={(e) => onSourceChange(e.target.value)}
          className="astra-input"
          >
          {SOURCE_LANGUAGES.map((lang) => (
            <option key={lang.value} value={lang.value}>
              {lang.label}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: 20 }}>
        <label htmlFor="onboarding-target-language" style={labelTextStyle}>I want translations in:</label>
        <select
          id="onboarding-target-language"
          value={targetLang}
          onChange={(e) => onTargetChange(e.target.value)}
          className="astra-input"
        >
          {TARGET_LANGUAGES.map((lang) => (
            <option key={lang.value} value={lang.value}>
              {lang.label}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: 28 }}>
        <div id="onboarding-language-level-label" style={labelTextStyle}>Your language level:</div>
        <div role="group" aria-labelledby="onboarding-language-level-label" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {LEVEL_OPTIONS.map((level) => (
            <button
              key={level.value}
              type="button"
              onClick={() => onLevelChange(level.value)}
              className="astra-option-card"
              aria-pressed={languageLevel === level.value}
            >
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--astra-text-primary)" }}>{level.label}</span>
              <span style={{ fontSize: 12, color: "var(--astra-text-muted)", marginTop: 2 }}>{level.description}</span>
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 28 }}>
        <div id="onboarding-explain-mode-label" style={labelTextStyle}>How should Astra explain sentences?</div>
        <div role="group" aria-labelledby="onboarding-explain-mode-label" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {EXPLAIN_MODE_OPTIONS.map((mode) => (
            <button
              key={mode.value}
              type="button"
              onClick={() => onExplainModeChange(mode.value)}
              className="astra-option-card"
              aria-pressed={explainMode === mode.value}
            >
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--astra-text-primary)" }}>{mode.label}</span>
              <span style={{ fontSize: 12, color: "var(--astra-text-muted)", marginTop: 2 }}>{mode.description}</span>
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={onNext}
        className="astra-btn-primary"
        style={{ display: "block", width: "100%", padding: "14px 24px", fontSize: 16 }}
      >
        Continue
      </button>
    </div>
  )
}

function StepFeatures({
  copyVariant,
  onContinue,
}: {
  copyVariant: LearningLoopCopyVariant
  onContinue: () => void
}) {
  const copy = LEARNING_LOOP_COPY[copyVariant].onboarding
  const features = [
    { icon: "Tr", title: "Translate with study context", desc: "Create bilingual context without losing the original page" },
    { icon: "Ex", title: "Explain why sentences work", desc: "Get learner-focused grammar, nuance, and usage breakdowns" },
    { icon: "Sv", title: "Save real-page vocabulary", desc: "Keep useful words attached to the sentence where you found them" },
    { icon: "Rv", title: "Return through review", desc: "Spaced repetition brings saved sentences back when they matter" },
  ]

  return (
    <div>
      <h1 style={{ ...titleStyle, fontSize: 24, marginBottom: 4 }}>How Astra Works</h1>
      <p style={{ ...taglineStyle, marginBottom: 24 }}>
        A reading-to-review workflow for learners who want progress, not one-off lookup.
      </p>

      <div
        data-testid="onboarding-closure-loop-copy"
        data-copy-variant={copyVariant}
        style={{
          background: "var(--astra-popup-bg-soft)",
          border: "1px solid var(--astra-popup-border-warm)",
          borderRadius: 12,
          padding: "14px 16px",
          marginBottom: 16,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 800, color: "var(--astra-popup-text-warm-strong)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          {copy.eyebrow}
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--astra-text-primary)", marginTop: 4 }}>
          {copy.title}
        </div>
        <div style={{ fontSize: 12, color: "var(--astra-text-muted)", marginTop: 6, lineHeight: 1.5 }}>
          {copy.description}
        </div>
      </div>

      <div
        data-testid="onboarding-differentiation-comparison-copy"
        style={{
          background: "var(--astra-bg-elevated)",
          border: "1px solid var(--astra-border)",
          borderRadius: 12,
          padding: "12px 14px",
          marginBottom: 16,
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 800, color: BRAND_COLOR, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          {LEARNING_LOOP_DIFFERENTIATION_COPY.eyebrow}
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--astra-text-primary)", marginTop: 4 }}>
          {LEARNING_LOOP_DIFFERENTIATION_COPY.title}
        </div>
        <div style={{ fontSize: 12, color: "var(--astra-text-muted)", marginTop: 6, lineHeight: 1.5 }}>
          {LEARNING_LOOP_DIFFERENTIATION_COPY.genericTranslator} {LEARNING_LOOP_DIFFERENTIATION_COPY.genericReader} {LEARNING_LOOP_DIFFERENTIATION_COPY.astra}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 28 }}>
        {features.map((f) => (
          <div
            key={f.title}
            style={{
              display: "flex",
              gap: 14,
              alignItems: "center",
              padding: "12px 16px",
              background: "var(--astra-bg-primary)",
              borderRadius: 10,
              border: "1px solid var(--astra-border)",
            }}
          >
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: "var(--astra-brand-muted)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
              fontWeight: 700,
              color: BRAND_COLOR,
              flexShrink: 0,
            }}
            >
              {f.icon}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--astra-text-primary)" }}>{f.title}</div>
              <div style={{ fontSize: 12, color: "var(--astra-text-muted)", marginTop: 2 }}>{f.desc}</div>
            </div>
          </div>
        ))}
      </div>

      <button type="button" onClick={onContinue} className="astra-btn-primary" style={{ display: "block", width: "100%", padding: "14px 24px", fontSize: 16 }}>
        Continue
      </button>
    </div>
  )
}

function StepReady({
  targetLang,
  copyVariant,
  onComplete,
  completing,
}: {
  targetLang: string
  copyVariant: LearningLoopCopyVariant
  onComplete: () => void
  completing: boolean
}) {
  const targetLabel =
    TARGET_LANGUAGES.find((l) => l.value === targetLang)?.label ?? targetLang
  const copy = LEARNING_LOOP_COPY[copyVariant].onboarding
  const packageCopy = LEARNING_LOOP_COMMERCIAL_SURFACE_COPY.onboardingPackageCard
  const firstWinCopy = LEARNING_LOOP_COMMERCIAL_SURFACE_COPY.firstWinActivation
  const accountContinuityCopy = LEARNING_LOOP_COMMERCIAL_SURFACE_COPY.accountContinuity

  const openAccountContinuitySignIn = () => {
    void browser.tabs.create({ url: buildPopupSignInDeepLinkUrl() })
  }

  return (
    <div>
      <h1 style={{ ...titleStyle, fontSize: 24, marginBottom: 4 }}>You're All Set!</h1>
      <p style={{ ...taglineStyle, marginBottom: 24 }}>
        Your first real-page learning loop is ready.
      </p>

      <div style={summaryBoxStyle}>
        <div style={{ fontSize: 15, color: "var(--astra-text-secondary)", lineHeight: 1.6 }}>
          Astra will turn web pages into bilingual study context and reviewable cards in <strong style={{ color: BRAND_COLOR }}>{targetLabel}</strong>.
        </div>
        <div style={{ fontSize: 12, color: "var(--astra-text-muted)", marginTop: 8, lineHeight: 1.5 }}>
          {copy.readyNote}
        </div>
        <div
          data-testid="onboarding-commercial-package-copy"
          style={{
            marginTop: 12,
            padding: "10px 12px",
            background: "var(--astra-bg-primary)",
            border: "1px solid var(--astra-border)",
            borderRadius: 10,
            textAlign: "left",
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 800, color: "var(--astra-popup-text-warm-strong)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            {packageCopy.eyebrow}
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--astra-text-primary)", marginTop: 4 }}>
            {packageCopy.title}
          </div>
          <div style={{ fontSize: 12, color: "var(--astra-text-muted)", marginTop: 6, lineHeight: 1.5 }}>
            {packageCopy.description}
          </div>
          <ul style={{ margin: "8px 0 0", paddingLeft: 16, color: "var(--astra-text-muted)", fontSize: 11, lineHeight: 1.45 }}>
            {packageCopy.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
          <div style={{ fontSize: 11, color: "var(--astra-text-muted)", marginTop: 8, lineHeight: 1.45 }}>
            {packageCopy.control}
          </div>
          <div style={{ fontSize: 10, color: "var(--astra-text-muted)", marginTop: 6, lineHeight: 1.45 }}>
            {packageCopy.boundary}
          </div>
        </div>
        <div
          data-testid="onboarding-first-win-activation-copy"
          style={{
            marginTop: 12,
            padding: "10px 12px",
            borderRadius: 10,
            background: "var(--astra-info-bg)",
            border: "1px solid var(--astra-info-border)",
            color: "var(--astra-info)",
            lineHeight: 1.45,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            {firstWinCopy.eyebrow}
          </div>
          <div style={{ fontSize: 13, fontWeight: 800, marginTop: 4 }}>
            {firstWinCopy.title}
          </div>
          <div style={{ fontSize: 12, marginTop: 4 }}>
            {firstWinCopy.summary}
          </div>
        </div>
        <div
          data-testid="onboarding-account-continuity-copy"
          style={{
            marginTop: 12,
            padding: "10px 12px",
            borderRadius: 10,
            background: "var(--astra-bg-elevated)",
            border: "1px solid var(--astra-border-strong)",
            color: "var(--astra-text-secondary)",
            lineHeight: 1.45,
            textAlign: "left",
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--astra-text-muted)" }}>
            {accountContinuityCopy.eyebrow}
          </div>
          <div style={{ fontSize: 13, fontWeight: 800, marginTop: 4, color: "var(--astra-text-primary)" }}>
            {accountContinuityCopy.title}
          </div>
          <div style={{ fontSize: 12, marginTop: 4 }}>
            {accountContinuityCopy.summary}
          </div>
          <div style={{ fontSize: 11, color: "var(--astra-text-muted)", marginTop: 6 }}>
            {accountContinuityCopy.bullets[2]}
          </div>
          <div style={{ fontSize: 10, color: "var(--astra-text-hint)", marginTop: 6 }}>
            {accountContinuityCopy.boundary}
          </div>
          <div
            data-testid="onboarding-account-continuity-next-action-copy"
            style={{ fontSize: 11, color: "var(--astra-text-secondary)", marginTop: 8, fontWeight: 700 }}
          >
            {accountContinuityCopy.nextAction}
          </div>
          <button
            type="button"
            data-testid="onboarding-account-continuity-sign-in-cta"
            onClick={openAccountContinuitySignIn}
            className="astra-btn-primary"
            style={{ display: "block", width: "100%", marginTop: 8, padding: "8px 12px", fontSize: 12 }}
          >
            {accountContinuityCopy.cta}
          </button>
          <div style={{ fontSize: 10, color: "var(--astra-text-hint)", marginTop: 6 }}>
            {accountContinuityCopy.ctaHelper}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onComplete}
        disabled={completing}
        className="astra-btn-primary"
        style={{ display: "block", width: "100%", padding: "14px 24px", fontSize: 16 }}
      >
        {completing ? "Setting up..." : "Start Using Astra"}
      </button>
    </div>
  )
}

export default function OnboardingApp() {
  const [step, setStep] = useState(0)
  const [sourceLang, setSourceLang] = useState("en")
  const [targetLang, setTargetLang] = useState("zh-CN")
  const [languageLevel, setLanguageLevel] = useState("intermediate")
  const [explainMode, setExplainMode] = useState("deep")
  const [learningLoopCopyVariant, setLearningLoopCopyVariantState] = useState<LearningLoopCopyVariant>(DEFAULT_LEARNING_LOOP_COPY_VARIANT)
  const [completing, setCompleting] = useState(false)
  const closureViewTrackedRef = useRef(false)
  const [iosBootstrapStatus, setIosBootstrapStatus] = useState<{
    bridgeAvailable: boolean
    status: IosBootstrapRuntimeStatus | null
    history: IosBootstrapHistoryEvent[]
  }>({ bridgeAvailable: false, status: null, history: [] })
  const [iosBridgeActionMessage, setIosBridgeActionMessage] = useState("")
  const showIosBootstrapDiagnostics = iosBootstrapStatus.bridgeAvailable
    || iosBootstrapStatus.history.length > 0
    || Boolean(iosBootstrapStatus.status?.lastBootstrapAt)
    || Boolean(iosBootstrapStatus.status?.lastSessionId)
    || Boolean(iosBridgeActionMessage)

  useEffect(() => {
    void fetchIosBootstrapRuntimeStatus().then(setIosBootstrapStatus)
  }, [])

  useEffect(() => {
    void getLearningLoopCopyVariant().then(setLearningLoopCopyVariantState)
  }, [])

  useEffect(() => {
    if (step !== 2 || closureViewTrackedRef.current) return
    closureViewTrackedRef.current = true
    recordLearningLoopEvent("onboarding_closure_viewed", {
      source: "onboarding",
      variant: learningLoopCopyVariant,
      step: "features",
    })
  }, [learningLoopCopyVariant, step])

  const handleOpenInAstraApp = async () => {
    setIosBridgeActionMessage("")
    const response = await consumeIosBootstrapForOnboarding("onboarding-open-in-app")
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
      ? "Opened Astra app via bridge handoff."
      : "Bridge available, but launch was not opened.")
  }

  const handleReplayLatestBridgeEvent = async () => {
    setIosBridgeActionMessage("")
    const latest = iosBootstrapStatus.history[0]
    const response = await replayIosBootstrapForOnboarding(latest?.sessionId)
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
      ? "Replayed latest bridge event."
      : "No replayable bridge event yet.")
  }

  const handleFeaturesContinue = () => {
    recordLearningLoopEvent("onboarding_closure_cta_clicked", {
      source: "onboarding",
      variant: learningLoopCopyVariant,
      action: "continue",
      step: "features",
    })
    setStep(3)
  }

  const handleComplete = async () => {
    setCompleting(true)
    try {
      await saveConfig({
        targetLang,
        languageLevel: languageLevel as "beginner" | "intermediate" | "advanced",
        explainMode: explainMode as "beginner" | "exam" | "deep",
      })
      await browser.storage.local.set({ "astra.onboarding.completed": true })
      recordLearningLoopEvent("onboarding_completed", {
        source: "onboarding",
        variant: learningLoopCopyVariant,
        targetLang,
        languageLevel,
        explainMode,
      })

      // Bootstrap Astra managed session so the popup doesn't show "Not connected".
      // If the background isn't ready yet, that's OK — the popup will retry on next open.
      try {
        await browser.runtime.sendMessage({ type: "runtime/ensure-astra-session" })
      } catch {
        // Best-effort: background may not be ready yet
      }

      // Best-effort iOS thin-host bootstrap handoff.
      const iosBootstrap = await consumeIosBootstrapForOnboarding("onboarding-complete")
      setIosBootstrapStatus({
        bridgeAvailable: iosBootstrap.bridgeAvailable === true,
        status: iosBootstrap.status ?? null,
        history: Array.isArray(iosBootstrap.history) ? iosBootstrap.history : iosBootstrapStatus.history,
      })

      // Close this tab
      const tabs = await browser.tabs.query({ active: true, currentWindow: true })
      if (tabs[0]?.id) {
        await browser.tabs.remove(tabs[0].id)
      }
    } catch {
      setCompleting(false)
    }
  }

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <StepDots current={step} />

        {showIosBootstrapDiagnostics && (
          <div
            data-testid="onboarding-ios-bridge-diagnostics"
            style={{
              fontSize: 12,
              color: "var(--astra-text-muted)",
              textAlign: "left",
              marginBottom: 20,
              lineHeight: 1.45,
            }}
            className="astra-card"
          >
            <div>
              iOS bridge: {iosBootstrapStatus.bridgeAvailable ? "available" : "unavailable"}
              {" · "}
              Last bootstrap: {formatStatusTime(iosBootstrapStatus.status?.lastBootstrapAt ?? null)}
            </div>
            <div>
              Launch path: popup/onboarding → extension bridge → astra-shell://bootstrap → host app
            </div>
            {iosBootstrapStatus.history.length > 0 && (
              <div>
                Recent bridge events: {iosBootstrapStatus.history.length}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => { void handleOpenInAstraApp() }}
                className="astra-btn-primary"
                style={{ width: "auto", padding: "8px 12px", fontSize: 12 }}
                disabled={!iosBootstrapStatus.bridgeAvailable}
              >
                Open in Astra App
              </button>
              <button
                type="button"
                onClick={() => { void handleReplayLatestBridgeEvent() }}
                className="astra-btn-primary"
                style={{ width: "auto", padding: "8px 12px", fontSize: 12, background: "var(--astra-text-primary)" }}
                disabled={!iosBootstrapStatus.bridgeAvailable || iosBootstrapStatus.history.length === 0}
              >
                Replay last handoff
              </button>
            </div>
            {iosBridgeActionMessage && (
              <div style={{ marginTop: 8 }}>
                {iosBridgeActionMessage}
              </div>
            )}
            {iosBootstrapStatus.history.slice(0, 2).map((event) => (
              <div key={event.sessionId}>
                · {event.sessionId} ({event.source}) {formatStatusTime(event.issuedAt)}
              </div>
            ))}
          </div>
        )}

        <div style={{ transition: "opacity 0.2s ease" }}>
          {step === 0 && <StepWelcome onNext={() => setStep(1)} />}
          {step === 1 && (
            <StepLanguage
              sourceLang={sourceLang}
              targetLang={targetLang}
              languageLevel={languageLevel}
              explainMode={explainMode}
              onSourceChange={setSourceLang}
              onTargetChange={setTargetLang}
              onLevelChange={setLanguageLevel}
              onExplainModeChange={setExplainMode}
              onNext={() => setStep(2)}
            />
          )}
          {step === 2 && <StepFeatures copyVariant={learningLoopCopyVariant} onContinue={handleFeaturesContinue} />}
          {step === 3 && (
            <StepReady
              targetLang={targetLang}
              copyVariant={learningLoopCopyVariant}
              onComplete={() => void handleComplete()}
              completing={completing}
            />
          )}
        </div>
      </div>
    </div>
  )
}
