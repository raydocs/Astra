import { useEffect, useState } from "react"
import { browser } from "#imports"
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

const BRAND_COLOR = "#6366f1"
const TOTAL_STEPS = 4

const containerStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  background: "linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%)",
  margin: 0,
  padding: 24,
  boxSizing: "border-box",
}

const cardStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 500,
  background: "#ffffff",
  borderRadius: 16,
  boxShadow: "0 4px 24px rgba(0, 0, 0, 0.08), 0 1px 4px rgba(0, 0, 0, 0.04)",
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
  color: "#1e293b",
  textAlign: "center",
  margin: "0 0 8px 0",
  lineHeight: 1.3,
}

const taglineStyle: React.CSSProperties = {
  fontSize: 16,
  color: "#64748b",
  textAlign: "center",
  margin: "0 0 32px 0",
  lineHeight: 1.5,
}

const primaryButtonStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: "14px 24px",
  fontSize: 16,
  fontWeight: 600,
  color: "#ffffff",
  background: BRAND_COLOR,
  border: "none",
  borderRadius: 10,
  cursor: "pointer",
  transition: "background 0.15s ease, transform 0.1s ease",
  outline: "none",
}

const labelTextStyle: React.CSSProperties = {
  display: "block",
  fontSize: 14,
  fontWeight: 600,
  color: "#334155",
  marginBottom: 8,
}

const selectStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: "12px 14px",
  fontSize: 15,
  color: "#1e293b",
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  outline: "none",
  appearance: "none",
  cursor: "pointer",
  boxSizing: "border-box",
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M2 4l4 4 4-4' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 14px center",
}

const summaryBoxStyle: React.CSSProperties = {
  background: "#f0f0ff",
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
            background: i === current ? BRAND_COLOR : "#e2e8f0",
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
          background: `linear-gradient(135deg, ${BRAND_COLOR}, #818cf8)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 24px auto",
          fontSize: 28,
          color: "#ffffff",
          fontWeight: 800,
          letterSpacing: -1,
        }}
      >
        A
      </div>
      <h1 style={titleStyle}>Astra — AI Language Learning</h1>
      <p style={taglineStyle}>Translate any webpage. Learn as you browse.</p>
      <button
        type="button"
        onClick={onNext}
        style={primaryButtonStyle}
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
  onSourceChange,
  onTargetChange,
  onLevelChange,
  onNext,
}: {
  sourceLang: string
  targetLang: string
  languageLevel: string
  onSourceChange: (lang: string) => void
  onTargetChange: (lang: string) => void
  onLevelChange: (level: string) => void
  onNext: () => void
}) {
  return (
    <div>
      <h1 style={{ ...titleStyle, fontSize: 24, marginBottom: 4 }}>Choose Your Languages</h1>
      <p style={{ ...taglineStyle, marginBottom: 28 }}>
        Tell us what you're learning and we'll set things up.
      </p>

      <div style={{ marginBottom: 20 }}>
        <label style={labelTextStyle}>What language are you learning?</label>
        <select
          value={sourceLang}
          onChange={(e) => onSourceChange(e.target.value)}
          style={selectStyle}
        >
          {SOURCE_LANGUAGES.map((lang) => (
            <option key={lang.value} value={lang.value}>
              {lang.label}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={labelTextStyle}>I want translations in:</label>
        <select
          value={targetLang}
          onChange={(e) => onTargetChange(e.target.value)}
          style={selectStyle}
        >
          {TARGET_LANGUAGES.map((lang) => (
            <option key={lang.value} value={lang.value}>
              {lang.label}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: 28 }}>
        <label style={labelTextStyle}>Your language level:</label>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {LEVEL_OPTIONS.map((level) => (
            <button
              key={level.value}
              type="button"
              onClick={() => onLevelChange(level.value)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                padding: "12px 16px",
                border: languageLevel === level.value ? `2px solid ${BRAND_COLOR}` : "1px solid #e2e8f0",
                borderRadius: 10,
                background: languageLevel === level.value ? "#eff6ff" : "#fff",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 600, color: "#1e293b" }}>{level.label}</span>
              <span style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{level.description}</span>
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={onNext}
        style={primaryButtonStyle}
      >
        Continue
      </button>
    </div>
  )
}

function StepFeatures({ onNext }: { onNext: () => void }) {
  const features = [
    { icon: "Tr", title: "Translate any page", desc: "Click the Astra icon or press Alt+A to translate" },
    { icon: "Ex", title: "Explain sentences", desc: "Select text and click Explain for grammar breakdowns" },
    { icon: "Sv", title: "Save vocabulary", desc: "Build your personal glossary as you read" },
    { icon: "Rv", title: "Review & learn", desc: "Spaced repetition flashcards for saved words" },
  ]

  return (
    <div>
      <h1 style={{ ...titleStyle, fontSize: 24, marginBottom: 4 }}>How Astra Works</h1>
      <p style={{ ...taglineStyle, marginBottom: 24 }}>
        Your AI-powered reading companion.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 28 }}>
        {features.map((f) => (
          <div
            key={f.title}
            style={{
              display: "flex",
              gap: 14,
              alignItems: "center",
              padding: "12px 16px",
              background: "#f8fafc",
              borderRadius: 10,
              border: "1px solid #e2e8f0",
            }}
          >
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: `${BRAND_COLOR}14`,
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
              <div style={{ fontSize: 14, fontWeight: 600, color: "#1e293b" }}>{f.title}</div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{f.desc}</div>
            </div>
          </div>
        ))}
      </div>

      <button type="button" onClick={onNext} style={primaryButtonStyle}>
        Continue
      </button>
    </div>
  )
}

function StepReady({
  targetLang,
  onComplete,
  completing,
}: {
  targetLang: string
  onComplete: () => void
  completing: boolean
}) {
  const targetLabel =
    TARGET_LANGUAGES.find((l) => l.value === targetLang)?.label ?? targetLang

  return (
    <div>
      <h1 style={{ ...titleStyle, fontSize: 24, marginBottom: 4 }}>You're All Set!</h1>
      <p style={{ ...taglineStyle, marginBottom: 24 }}>
        Everything is configured and ready to go.
      </p>

      <div style={summaryBoxStyle}>
        <div style={{ fontSize: 15, color: "#334155", lineHeight: 1.6 }}>
          Astra will translate web pages to <strong style={{ color: BRAND_COLOR }}>{targetLabel}</strong>.
        </div>
        <div style={{ fontSize: 13, color: "#64748b", marginTop: 8, lineHeight: 1.5 }}>
          You get free daily translations. No API key needed.
        </div>
        <div style={{ fontSize: 12, color: "#64748b", marginTop: 8, lineHeight: 1.5 }}>
          On iOS Safari, use Open in Astra App for bridge handoff when you want to verify host launch/open flow.
        </div>
      </div>

      <button
        type="button"
        onClick={onComplete}
        disabled={completing}
        style={{
          ...primaryButtonStyle,
          ...(completing
            ? { opacity: 0.6, cursor: "not-allowed" }
            : {}),
        }}
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
  const [completing, setCompleting] = useState(false)
  const [iosBootstrapStatus, setIosBootstrapStatus] = useState<{
    bridgeAvailable: boolean
    status: IosBootstrapRuntimeStatus | null
    history: IosBootstrapHistoryEvent[]
  }>({ bridgeAvailable: false, status: null, history: [] })
  const [iosBridgeActionMessage, setIosBridgeActionMessage] = useState("")

  useEffect(() => {
    void fetchIosBootstrapRuntimeStatus().then(setIosBootstrapStatus)
  }, [])

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

  const handleComplete = async () => {
    setCompleting(true)
    try {
      await saveConfig({
        targetLang,
        languageLevel: languageLevel as "beginner" | "intermediate" | "advanced",
      })
      await browser.storage.local.set({ "astra.onboarding.completed": true })

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

        <div
          style={{
            fontSize: 12,
            color: "#64748b",
            textAlign: "left",
            marginBottom: 20,
            lineHeight: 1.45,
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: 10,
            padding: "10px 12px",
          }}
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
              style={{
                ...primaryButtonStyle,
                width: "auto",
                padding: "8px 12px",
                fontSize: 12,
                ...(iosBootstrapStatus.bridgeAvailable ? {} : { opacity: 0.5, cursor: "not-allowed" }),
              }}
              disabled={!iosBootstrapStatus.bridgeAvailable}
            >
              Open in Astra App
            </button>
            <button
              type="button"
              onClick={() => { void handleReplayLatestBridgeEvent() }}
              style={{
                ...primaryButtonStyle,
                width: "auto",
                padding: "8px 12px",
                fontSize: 12,
                background: "#0f172a",
                ...((!iosBootstrapStatus.bridgeAvailable || iosBootstrapStatus.history.length === 0) ? { opacity: 0.5, cursor: "not-allowed" } : {}),
              }}
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

        <div style={{ transition: "opacity 0.2s ease" }}>
          {step === 0 && <StepWelcome onNext={() => setStep(1)} />}
          {step === 1 && (
            <StepLanguage
              sourceLang={sourceLang}
              targetLang={targetLang}
              languageLevel={languageLevel}
              onSourceChange={setSourceLang}
              onTargetChange={setTargetLang}
              onLevelChange={setLanguageLevel}
              onNext={() => setStep(2)}
            />
          )}
          {step === 2 && <StepFeatures onNext={() => setStep(3)} />}
          {step === 3 && (
            <StepReady
              targetLang={targetLang}
              onComplete={() => void handleComplete()}
              completing={completing}
            />
          )}
        </div>
      </div>
    </div>
  )
}
