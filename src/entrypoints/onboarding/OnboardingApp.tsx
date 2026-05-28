import { useEffect, useRef, useState, type KeyboardEvent } from "react"
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
import { buildLearningProfileFromConfig, updateLearningProfile } from "@/utils/storage/learning-profile"
import type { AstraConfig } from "@/types/config"
import { useAstraTheme } from "@/utils/ui/useAstraTheme"
import {
  getPageAccessState,
  requestPageAccess,
  revokePageAccess,
  type PageAccessState,
  type PageAccessScope,
} from "@/utils/extension/page-permissions"

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
] as const

const EXPLAIN_MODE_OPTIONS = [
  { value: "beginner", label: "Beginner coach", description: "Plain-language explanations and easier wording" },
  { value: "exam", label: "Exam coach", description: "Grammar, collocations, and test-oriented breakdowns" },
  { value: "deep", label: "Deep reading", description: "Nuance, tone, and why the sentence works this way" },
]

const PRIMARY_GOAL_OPTIONS = [
  { value: "read_articles_docs", label: "Read English articles and docs", description: "Understand webpages, technical docs, news, and reports faster." },
  { value: "watch_tutorials", label: "Watch English videos", description: "Turn tutorials, talks, and lessons into saved moments." },
  { value: "save_expressions", label: "Save useful expressions", description: "Build review cards from real pages instead of isolated word lists." },
] as const

type PrimaryGoal = typeof PRIMARY_GOAL_OPTIONS[number]["value"]

const BRAND_COLOR = "var(--astra-brand)"
const STEP_LABELS = ["Welcome", "Languages", "Loop", "Ready"] as const
const TOTAL_STEPS = STEP_LABELS.length

const labelTextStyle: React.CSSProperties = {
  display: "block",
  fontSize: 14,
  fontWeight: 600,
  color: "var(--astra-text-secondary)",
  marginBottom: 8,
}

// selectStyle removed — now using className="astra-input"

const summaryBoxStyle: React.CSSProperties = {
  background: "var(--astra-bg-elevated)",
  border: "1px solid var(--astra-border-strong)",
  borderRadius: 12,
  padding: "20px 24px",
  marginBottom: 24,
  textAlign: "center",
}

function OnboardingCtaIconArrow() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
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

function shouldShowDebugDiagnostics(): boolean {
  if (import.meta.env.DEV) return true
  try {
    return new URLSearchParams(window.location.search).get("debug") === "1"
  } catch {
    return false
  }
}

function shouldShowOnboardingCertificationFrame(): boolean {
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

function OnboardingPermissionSparkleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M12 3.5v4M12 16.5v4M3.5 12h4M16.5 12h4" strokeLinecap="round" />
      <path d="M7.75 7.75 6 6M16.25 7.75 18 6M7.75 16.25 6 18M16.25 16.25 18 18" strokeLinecap="round" />
      <circle cx="12" cy="12" r="2.25" />
    </svg>
  )
}

function buildPopupSignInDeepLinkUrl(): string {
  return buildLearningLoopAccountContinuityPopupSignInUrl((path) => browser.runtime.getURL(path as "/popup.html"))
}

function buildSampleLessonUrl(): string {
  return browser.runtime.getURL("/sample-lesson.html" as "/popup.html")
}

function focusRadioOption(event: KeyboardEvent<HTMLButtonElement>, nextValue: string): void {
  const group = event.currentTarget.closest('[role="radiogroup"]')
  const next = group?.querySelector(`[data-radio-value="${nextValue}"]`) as HTMLButtonElement | null
  next?.focus()
}

function handleRadioArrowKey<T extends string>(
  event: KeyboardEvent<HTMLButtonElement>,
  values: readonly T[],
  currentValue: T,
  onChange: (next: T) => void,
): void {
  const currentIndex = values.indexOf(currentValue)
  if (currentIndex < 0) return

  const key = event.key
  const nextIndex = key === "ArrowRight" || key === "ArrowDown"
    ? (currentIndex + 1) % values.length
    : key === "ArrowLeft" || key === "ArrowUp"
      ? (currentIndex - 1 + values.length) % values.length
      : key === "Home"
        ? 0
        : key === "End"
          ? values.length - 1
          : -1

  if (nextIndex < 0) return

  event.preventDefault()
  const nextValue = values[nextIndex]
  onChange(nextValue)
  focusRadioOption(event, nextValue)
}

function StepDots({ current }: { current: number }) {
  return (
    <>
      <div className="astra-onboarding-stepper" aria-label={`Onboarding step ${current + 1} of ${TOTAL_STEPS}`} role="list">
        {STEP_LABELS.map((label, i) => {
          const state = i < current ? "complete" : i === current ? "active" : "pending"
          return (
            <span key={label} style={{ display: "inline-flex", alignItems: "center", gap: 10 }} role="listitem">
              {i > 0 && <span className="astra-onboarding-stepper__line" aria-hidden="true" />}
              <span className="astra-onboarding-step" data-state={state} aria-current={i === current ? "step" : undefined}>
                <span className="astra-onboarding-step__badge" aria-hidden="true">{i < current ? "✓" : i + 1}</span>
                <span className="astra-onboarding-step__label">{label}</span>
              </span>
            </span>
          )
        })}
      </div>
      <div className="astra-onboarding-step-dots" aria-hidden="true">
        {STEP_LABELS.map((label, i) => (
          <div key={label} className="astra-onboarding-step-dot" data-state={i < current ? "complete" : i === current ? "active" : "pending"} />
        ))}
      </div>
    </>
  )
}

type PreviewStyle = "plain" | "underline" | "highlight"

function OnboardingPreview({
  targetLang,
  languageLevel,
  explainMode,
  previewStyle = "underline",
}: {
  targetLang: string
  languageLevel: string
  explainMode: string
  previewStyle?: PreviewStyle
}) {
  const targetLabel = TARGET_LANGUAGES.find((lang) => lang.value === targetLang)?.label ?? targetLang
  const levelLabel = LEVEL_OPTIONS.find((level) => level.value === languageLevel)?.label ?? languageLevel
  const explainModeLabel = EXPLAIN_MODE_OPTIONS.find((mode) => mode.value === explainMode)?.label ?? explainMode

  return (
    <aside className="astra-onboarding-panel astra-onboarding-preview-pane" aria-label="Astra live preview">
      <div className="astra-onboarding-preview-toolbar">
        <span className="astra-quiet-eyebrow">Live preview</span>
        <span className="astra-onboarding-preview-host">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" strokeLinecap="round" />
          </svg>
          newyorker.com
        </span>
      </div>

      <div className="astra-onboarding-preview-card">
        <div className="astra-quiet-eyebrow" style={{ marginBottom: 8 }}>Preview · article</div>
        <h2 className="astra-onboarding-preview-title">Why Solitude Is Important for Reading</h2>
        <div className="astra-onboarding-preview-subtitle">为什么独处对阅读如此重要</div>

        <div className="astra-onboarding-preview-body" data-preview-style={previewStyle}>
          <p>
            Reading well requires a kind of <span className="astra-onboarding-preview-mark">attention</span> that the modern web has quietly <span className="astra-onboarding-preview-mark">eroded</span>. To <span className="astra-onboarding-preview-mark">inhabit</span> a difficult sentence, you have to be willing to sit with it.
          </p>
          <p className="astra-onboarding-preview-translation">
            阅读得当需要一种现代网络已悄然侵蚀的专注力。要真正进入一句难懂的话，你必须愿意在它面前停留。
          </p>
          <p>
            Astra runs <span className="astra-onboarding-preview-mark">underneath</span> the page, adding only what you ask for, never repainting what was already <span className="astra-onboarding-preview-mark">legible</span>.
          </p>
          <p className="astra-onboarding-preview-translation">
            Astra 运行在页面之下，只补充你需要的部分，绝不重绘原本已可读的内容。
          </p>
        </div>

        <div className="astra-onboarding-preview-footer">
          <div className="astra-onboarding-preview-footer__hint">
            <span className="astra-onboarding-preview-footer__dot" aria-hidden="true" />
            <span>Marked words are saved to your library when you click them.</span>
          </div>
          <div className="astra-onboarding-preview-footer__meta">
            Translation: {targetLabel} · Level: {levelLabel} · Explanation: {explainModeLabel}
          </div>
        </div>
      </div>
    </aside>
  )
}

function StepWelcome({ onNext }: { onNext: () => void }) {
  return (
    <div style={{ textAlign: "left" }}>
      <h1 className="astra-onboarding-title">Astra — just read. We handle the AI.</h1>
      <p className="astra-onboarding-copy">
        No setup. Astra's free public beta turns real webpages into translation, sentence explanations, saved vocabulary, and spaced review. Optional sign-in keeps continuity; paid upgrades are not available during beta.
      </p>
      <div className="astra-card" style={{ marginBottom: 18, padding: "12px 14px", display: "grid", gap: 6 }}>
        <div className="astra-quiet-eyebrow">Managed by Astra</div>
        <div style={{ color: "var(--astra-text-secondary)", fontSize: 13, lineHeight: 1.5 }}>
          We tune speed, accuracy, and quality in the background so customers only choose their language and reading style.
        </div>
      </div>
      <button
        type="button"
        onClick={onNext}
        className="astra-btn-onboarding-primary"
      >
        Get started
        <OnboardingCtaIconArrow />
      </button>
    </div>
  )
}

function StepLanguage({
  targetLang,
  languageLevel,
  primaryGoal,
  onTargetChange,
  onLevelChange,
  onPrimaryGoalChange,
  onNext,
}: {
  targetLang: string
  languageLevel: AstraConfig["languageLevel"]
  primaryGoal: PrimaryGoal
  onTargetChange: (lang: string) => void
  onLevelChange: (level: AstraConfig["languageLevel"]) => void
  onPrimaryGoalChange: (goal: PrimaryGoal) => void
  onNext: () => void
}) {
  return (
    <div>
      <h1 className="astra-onboarding-title" style={{ fontSize: 34, marginBottom: 8 }}>Set up your first learning path</h1>
      <p className="astra-onboarding-copy" style={{ marginBottom: 28 }}>
        Three essentials are enough: translation language, current level, and what you mainly want Astra to help with.
      </p>

      <div
        className="astra-card"
        style={{ marginBottom: 20, fontSize: 13, color: "var(--astra-text-secondary)", lineHeight: 1.55 }}
      >
        Astra uses these three answers to choose learner-friendly defaults. Source language and explanation style stay adjustable later in Settings.
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
        <div role="radiogroup" aria-labelledby="onboarding-language-level-label" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {LEVEL_OPTIONS.map((level) => (
            <button
              key={level.value}
              type="button"
              role="radio"
              onClick={() => onLevelChange(level.value)}
              onKeyDown={(event) => handleRadioArrowKey(event, LEVEL_OPTIONS.map((option) => option.value), languageLevel, onLevelChange)}
              className="astra-option-card"
              aria-checked={languageLevel === level.value}
              data-radio-value={level.value}
              aria-label={`${level.label}: ${level.description}`}
            >
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--astra-text-primary)" }}>{level.label}</span>
              <span style={{ fontSize: 12, color: "var(--astra-text-muted)", marginTop: 2 }}>{level.description}</span>
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 28 }}>
        <div id="onboarding-primary-goal-label" style={labelTextStyle}>I mainly want to use Astra to:</div>
        <div role="radiogroup" aria-labelledby="onboarding-primary-goal-label" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {PRIMARY_GOAL_OPTIONS.map((goal) => (
            <button
              key={goal.value}
              type="button"
              role="radio"
              onClick={() => onPrimaryGoalChange(goal.value)}
              onKeyDown={(event) => handleRadioArrowKey(event, PRIMARY_GOAL_OPTIONS.map((option) => option.value), primaryGoal, onPrimaryGoalChange)}
              className="astra-option-card"
              aria-checked={primaryGoal === goal.value}
              data-radio-value={goal.value}
              aria-label={`${goal.label}: ${goal.description}`}
            >
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--astra-text-primary)" }}>{goal.label}</span>
              <span style={{ fontSize: 12, color: "var(--astra-text-muted)", marginTop: 2 }}>{goal.description}</span>
            </button>
          ))}
        </div>
      </div>


      <button
        type="button"
        onClick={onNext}
        className="astra-btn-onboarding-primary"
      >
        Continue
        <OnboardingCtaIconArrow />
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
      <h1 className="astra-onboarding-title" style={{ fontSize: 34, marginBottom: 8 }}>How Astra Works</h1>
      <p className="astra-onboarding-copy" style={{ marginBottom: 24 }}>
        A reading-to-review workflow for learners who want progress, not one-off lookup.
      </p>

      <div
        data-testid="onboarding-closure-loop-copy"
        data-copy-variant={copyVariant}
        style={{
          background: "var(--astra-bg-card)",
          border: "1px solid var(--astra-border-strong)",
          borderRadius: 12,
          padding: "14px 16px",
          marginBottom: 16,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 800, color: "var(--astra-text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
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

      <button type="button" onClick={onContinue} className="astra-btn-onboarding-primary">
        Continue
        <OnboardingCtaIconArrow />
      </button>
    </div>
  )
}

function PermissionDisclosureCard() {
  const rows = [
    {
      title: "Ready when you ask",
      subtitle: "Astra helps on pages where you choose to translate, explain, or save.",
      current: true,
    },
    {
      title: "Page once",
      subtitle: "Use Astra for the page you are viewing without remembering the choice for later.",
      current: false,
    },
    {
      title: "Remember this site",
      subtitle: "Let Astra help on the current site until you pause it again.",
      current: false,
    },
  ]

  return (
    <div className="astra-onboarding-permission-card" data-testid="onboarding-permission-disclosure">
      <div className="astra-onboarding-permission-card__title">How Astra helps on pages</div>
      <div className="astra-onboarding-permission-card__copy">
        Astra reads article text when you ask it to translate or explain, then writes results alongside the page. You choose whether to use Astra once, remember this site, or pause this site.
      </div>
      <div className="astra-onboarding-permission-card__choices" aria-label="Site access options">
        {rows.map((row) => (
          <div key={row.title} className="astra-onboarding-permission-card__choice" data-current={row.current ? "true" : undefined}>
            <span className="astra-onboarding-permission-card__dot" aria-hidden="true" />
            <span>
              <span className="astra-onboarding-permission-card__choice-title">{row.title}</span>
              <span className="astra-onboarding-permission-card__choice-subtitle">{row.subtitle}</span>
            </span>
          </div>
        ))}
      </div>
      <div className="astra-onboarding-permission-card__footnote">
        Chrome, Firefox, or Safari may show their own confirmation. If a confirmation is not available, Astra still respects the choice you make here.
      </div>
    </div>
  )
}

function PermissionControlPanel() {
  const [state, setState] = useState<PageAccessState | null>(null)
  const [message, setMessage] = useState("Checking page access…")

  const refresh = async () => {
    const nextState = await getPageAccessState()
    setState(nextState)
    setMessage(nextState.origin
      ? `Current page context: ${nextState.origin}`
      : "Open onboarding alongside a webpage to choose page or site access.")
  }

  useEffect(() => {
    void refresh()
  }, [])

  const runAction = async (scope: PageAccessScope | "revoke-site") => {
    const result = scope === "revoke-site"
      ? await revokePageAccess("site")
      : await requestPageAccess(scope)
    setState(result.state)
    setMessage(result.message)
  }

  return (
    <div data-testid="onboarding-permission-controls" style={{ display: "grid", gap: 8 }}>
      <div role="status" style={{ fontSize: 11, color: "var(--astra-text-muted)", lineHeight: 1.45 }}>
        {message}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        <button type="button" className="astra-btn-outline-quiet" disabled={!state?.activeTabAvailable} onClick={() => { void runAction("page") }}>
          Page once
        </button>
        <button type="button" className="astra-btn-outline-quiet" disabled={!state?.sitePattern || (!state?.permissionsApiAvailable && state?.runtimeSiteState !== "revoked")} onClick={() => { void runAction("site") }}>
          Remember this site
        </button>
        <button type="button" className="astra-btn-outline-quiet" disabled={!state?.sitePattern} onClick={() => { void runAction("revoke-site") }}>
          Pause this site
        </button>
      </div>
      <div style={{ fontSize: 10, color: "var(--astra-text-hint)", lineHeight: 1.4 }}>
        Your browser may ask you to confirm. You can pause this site any time.
      </div>
    </div>
  )
}

function OnboardingPermissionCertificationFrame({
  astraTheme,
  astraDirection,
}: {
  astraTheme: string
  astraDirection: string
}) {
  const rows = [
    {
      title: "Ask first",
      subtitle: "Astra helps when you choose to translate or explain.",
      current: true,
    },
    {
      title: "Page once",
      subtitle: "Use Astra on the page in front of you.",
      current: false,
    },
    {
      title: "Remember or pause",
      subtitle: "Keep Astra available on a site, or stop it there later.",
      current: false,
    },
  ]

  return (
    <div
      className="astra-onboarding-cert-permission-frame"
      data-testid="onboarding-permission-certification-frame"
      data-astra-theme={astraTheme}
      data-astra={astraDirection}
    >
      <div className="astra-onboarding-cert-browser">
        <div className="astra-onboarding-cert-browser__chrome" aria-hidden="true">
          <span className="astra-onboarding-cert-browser__dots">
            <span />
            <span />
            <span />
          </span>
          <div className="astra-onboarding-cert-browser__address">
            <span className="astra-onboarding-cert-browser__globe" aria-hidden="true">⊕</span>
            newyorker.com/2026/04/the-quiet-architecture-of-reading
          </div>
          <span className="astra-onboarding-cert-browser__extension" aria-hidden="true">
            <OnboardingPermissionSparkleIcon />
          </span>
        </div>

        <div className="astra-onboarding-cert-page" aria-hidden="true">
          <span className="astra-onboarding-cert-page__headline" />
          <span />
          <span />
          <span />
          <span className="astra-onboarding-cert-page__short" />
        </div>

        <section className="astra-onboarding-cert-permission-card" aria-label="Astra page access permission preview">
          <span className="astra-onboarding-cert-permission-card__tail" aria-hidden="true" />
          <div className="astra-onboarding-cert-permission-card__intro">
            <span className="astra-onboarding-cert-permission-card__icon" aria-hidden="true">
              <OnboardingPermissionSparkleIcon />
            </span>
            <div>
              <div className="astra-onboarding-cert-permission-card__title">Let Astra help on this page?</div>
              <div className="astra-onboarding-cert-permission-card__host">newyorker.com</div>
            </div>
          </div>
          <p className="astra-onboarding-cert-permission-card__copy">
            Astra reads article text when you ask it to translate or explain, and writes results alongside the page. Nothing is stored unless you save a word.
          </p>

          <div className="astra-onboarding-cert-permission-card__choices" aria-label="Current access disclosure">
            {rows.map((row) => (
              <div key={row.title} className="astra-onboarding-cert-permission-card__choice" data-current={row.current ? "true" : undefined}>
                <span className="astra-onboarding-cert-permission-card__dot" aria-hidden="true" />
                <span>
                  <span className="astra-onboarding-cert-permission-card__choice-title">{row.title}</span>
                  <span className="astra-onboarding-cert-permission-card__choice-subtitle">{row.subtitle}</span>
                </span>
              </div>
            ))}
          </div>

          <div className="astra-onboarding-cert-permission-card__actions">
            <button type="button" className="astra-onboarding-cert-permission-card__button astra-onboarding-cert-permission-card__button--ghost">Not now</button>
            <button type="button" className="astra-onboarding-cert-permission-card__button astra-onboarding-cert-permission-card__button--primary">
              Allow
              <OnboardingCtaIconArrow />
            </button>
          </div>
          <div className="astra-onboarding-cert-permission-card__footnote">
            You can choose page once, remember this site, or pause this site later.
          </div>
        </section>
      </div>
    </div>
  )
}

function StepReady({
  targetLang,
  copyVariant,
  onComplete,
  onTrySampleLesson,
  completing,
}: {
  targetLang: string
  copyVariant: LearningLoopCopyVariant
  onComplete: () => void
  onTrySampleLesson: () => void
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
    <div className="astra-onboarding-ready-step">
      <div className="astra-onboarding-permission-scene" aria-label="Astra page access permission preview">
        <div className="astra-onboarding-permission-browser" aria-hidden="true">
          <div className="astra-onboarding-permission-browser__chrome">
            <span />
            <span />
            <span />
            <div>newyorker.com/2026/04/the-quiet-architecture-of-reading</div>
          </div>
          <div className="astra-onboarding-permission-browser__page">
            <span className="astra-onboarding-permission-browser__headline" />
            <span />
            <span />
            <span />
          </div>
        </div>
        <div className="astra-onboarding-permission-float">
          <div className="astra-card" style={{ marginBottom: 10, padding: "12px 14px", textAlign: "left" }}>
            <div className="astra-quiet-eyebrow">Account first, configuration never</div>
            <div style={{ fontSize: 14, color: "var(--astra-text-primary)", fontWeight: 800, marginTop: 3 }}>
              Free beta first. Translation just works.
            </div>
            <div style={{ fontSize: 12, color: "var(--astra-text-secondary)", lineHeight: 1.45, marginTop: 5 }}>
              Your popup may ask for optional sign-in to keep learning continuity. Paid upgrades are not launched, and the free beta includes a daily use limit.
            </div>
          </div>
          <PermissionDisclosureCard />
          <PermissionControlPanel />
          <div className="astra-onboarding-permission-float__actions">
            <button type="button" className="astra-btn-outline-quiet" disabled={completing}>Not now</button>
            <button
              type="button"
              onClick={onTrySampleLesson}
              disabled={completing}
              className="astra-btn-outline-quiet"
              data-testid="onboarding-try-sample-lesson-cta"
            >
              Try Astra on a sample page
            </button>
            <button
              type="button"
              onClick={onComplete}
              disabled={completing}
              className="astra-btn-onboarding-primary"
            >
              {completing ? "Setting up…" : "Start using Astra"}
              {!completing && <OnboardingCtaIconArrow />}
            </button>
          </div>
          <div className="astra-onboarding-permission-float__note">
            You choose when Astra helps: page once, remember this site, or pause this site.
          </div>
        </div>
      </div>

      <div className="astra-onboarding-ready-legacy" aria-hidden="true">
        <h1 className="astra-onboarding-title" style={{ fontSize: 34, marginBottom: 8 }}>You're All Set!</h1>
        <p className="astra-onboarding-copy" style={{ marginBottom: 24 }}>
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
            <div style={{ fontSize: 11, fontWeight: 800, color: "var(--astra-text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
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
              className="astra-btn-onboarding-primary"
              style={{ width: "100%", marginTop: 8, padding: "8px 12px", fontSize: 12 }}
            >
              {accountContinuityCopy.cta}
            </button>
            <div style={{ fontSize: 10, color: "var(--astra-text-hint)", marginTop: 6 }}>
              {accountContinuityCopy.ctaHelper}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={onTrySampleLesson}
            disabled={completing}
            className="astra-btn-outline-quiet"
            data-testid="onboarding-try-sample-lesson-legacy-cta"
          >
            Try Astra on a sample page
          </button>
          <button
            type="button"
            onClick={onComplete}
            disabled={completing}
            className="astra-btn-onboarding-primary"
          >
            {completing ? "Setting up…" : "Start using Astra"}
            {!completing && <OnboardingCtaIconArrow />}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function OnboardingApp() {
  const { astraTheme, astraDirection } = useAstraTheme()
  const showCertificationPermissionFrame = shouldShowOnboardingCertificationFrame()
  const [step, setStep] = useState(0)
  const [targetLang, setTargetLang] = useState("zh-CN")
  const [languageLevel, setLanguageLevel] = useState<AstraConfig["languageLevel"]>("intermediate")
  const explainMode: AstraConfig["explainMode"] = "deep"
  const primaryOnboardingReadingStyle: PreviewStyle = "underline"
  const [primaryGoal, setPrimaryGoal] = useState<PrimaryGoal>("read_articles_docs")
  const [learningLoopCopyVariant, setLearningLoopCopyVariantState] = useState<LearningLoopCopyVariant>(DEFAULT_LEARNING_LOOP_COPY_VARIANT)
  const [learningLoopCopyVariantLoaded, setLearningLoopCopyVariantLoaded] = useState(false)
  const [completing, setCompleting] = useState(false)
  const stepRegionRef = useRef<HTMLDivElement | null>(null)
  const previousStepRef = useRef(step)
  const onboardingStartTrackedRef = useRef(false)
  const closureViewTrackedRef = useRef(false)
  const proValueSeenTrackedRef = useRef(false)
  const [iosBootstrapStatus, setIosBootstrapStatus] = useState<{
    bridgeAvailable: boolean
    status: IosBootstrapRuntimeStatus | null
    history: IosBootstrapHistoryEvent[]
  }>({ bridgeAvailable: false, status: null, history: [] })
  const [iosBridgeActionMessage, setIosBridgeActionMessage] = useState("")
  const showIosBootstrapDiagnostics = shouldShowDebugDiagnostics() && (
    iosBootstrapStatus.bridgeAvailable
      || iosBootstrapStatus.history.length > 0
      || Boolean(iosBootstrapStatus.status?.lastBootstrapAt)
      || Boolean(iosBootstrapStatus.status?.lastSessionId)
      || Boolean(iosBridgeActionMessage)
  )

  useEffect(() => {
    void fetchIosBootstrapRuntimeStatus().then(setIosBootstrapStatus)
  }, [])

  useEffect(() => {
    void getLearningLoopCopyVariant()
      .then((variant) => {
        setLearningLoopCopyVariantState(variant)
        setLearningLoopCopyVariantLoaded(true)
      })
      .catch(() => {
        setLearningLoopCopyVariantLoaded(true)
      })
  }, [])

  useEffect(() => {
    if (!learningLoopCopyVariantLoaded || onboardingStartTrackedRef.current) return
    onboardingStartTrackedRef.current = true
    recordLearningLoopEvent("onboarding_started", {
      source: "onboarding",
      variant: learningLoopCopyVariant,
      step: "welcome",
    })
  }, [learningLoopCopyVariant, learningLoopCopyVariantLoaded])

  useEffect(() => {
    if (showCertificationPermissionFrame) return
    if (previousStepRef.current === step) return
    previousStepRef.current = step
    stepRegionRef.current?.focus()
  }, [showCertificationPermissionFrame, step])

  useEffect(() => {
    if (step !== 2 || closureViewTrackedRef.current) return
    closureViewTrackedRef.current = true
    recordLearningLoopEvent("onboarding_closure_viewed", {
      source: "onboarding",
      variant: learningLoopCopyVariant,
      step: "loop",
    })
  }, [learningLoopCopyVariant, step])

  useEffect(() => {
    if (step !== 3 || proValueSeenTrackedRef.current) return
    proValueSeenTrackedRef.current = true
    recordLearningLoopEvent("pro_value_seen", {
      source: "onboarding",
      surface: "onboarding_account_continuity",
      trigger: "continuity_value",
      variant: learningLoopCopyVariant,
      billingAvailable: false,
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
      step: "loop",
    })
    setStep(3)
  }

  const handleTrySampleLesson = () => {
    void browser.tabs.create({ url: buildSampleLessonUrl() })
  }

  const handleComplete = async () => {
    setCompleting(true)
    try {
      const presentationTheme = primaryOnboardingReadingStyle
      const profileConfig: Pick<AstraConfig, "targetLang" | "languageLevel" | "explainMode"> = {
        targetLang,
        languageLevel,
        explainMode,
      }
      await saveConfig({
        ...profileConfig,
        presentation: { theme: presentationTheme },
      })
      await updateLearningProfile(buildLearningProfileFromConfig(profileConfig, primaryGoal))
      await browser.storage.local.set({ "astra.onboarding.completed": true })
      await browser.storage.local.set({ "astra.onboarding.primaryGoal.v1": primaryGoal })
      recordLearningLoopEvent("onboarding_completed", {
        source: "onboarding",
        variant: learningLoopCopyVariant,
        targetLang,
        languageLevel,
        explainMode,
        primaryGoal,
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

  if (showCertificationPermissionFrame) {
    return <OnboardingPermissionCertificationFrame astraTheme={astraTheme} astraDirection={astraDirection} />
  }

  return (
    <div className="astra-onboarding-shell" data-astra-theme={astraTheme} data-astra={astraDirection}>
      <main className="astra-onboarding-frame" data-step={step === 3 ? "ready" : undefined}>
        <section className="astra-onboarding-panel astra-onboarding-panel--copy">
          <div className="astra-onboarding-brand-row">
            <div className="astra-quiet-wordmark">Astra</div>
            <span className="astra-onboarding-step-label">Step {step + 1} of {TOTAL_STEPS}</span>
          </div>

          <StepDots current={step} />

          {showIosBootstrapDiagnostics && (
            <div
              data-testid="onboarding-ios-bridge-diagnostics"
              style={{
                fontSize: 12,
                color: "var(--astra-text-muted)",
                textAlign: "left",
                marginBottom: 0,
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

            <div
              ref={stepRegionRef}
              className="astra-onboarding-content"
              style={{ transition: "opacity 0.2s ease" }}
              role="region"
              aria-label={`Step ${step + 1} of ${TOTAL_STEPS}: ${STEP_LABELS[step]}`}
              aria-live="polite"
              tabIndex={-1}
              data-testid="onboarding-step-region"
            >
            {step === 0 && <StepWelcome onNext={() => setStep(1)} />}
            {step === 1 && (
              <StepLanguage
                targetLang={targetLang}
                languageLevel={languageLevel}
                primaryGoal={primaryGoal}
                onTargetChange={setTargetLang}
                onLevelChange={setLanguageLevel}
                onPrimaryGoalChange={setPrimaryGoal}
                onNext={() => setStep(2)}
              />
            )}
            {step === 2 && <StepFeatures copyVariant={learningLoopCopyVariant} onContinue={handleFeaturesContinue} />}
            {step === 3 && (
              <StepReady
                targetLang={targetLang}
                copyVariant={learningLoopCopyVariant}
                onComplete={() => void handleComplete()}
                onTrySampleLesson={handleTrySampleLesson}
                completing={completing}
              />
            )}
          </div>
        </section>

        {step !== 3 && (
          <OnboardingPreview
            targetLang={targetLang}
            languageLevel={languageLevel}
            explainMode={explainMode}
            previewStyle={primaryOnboardingReadingStyle}
          />
        )}
      </main>
    </div>
  )
}
