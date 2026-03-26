import { useState } from "react"
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

const BRAND_COLOR = "#6366f1"
const TOTAL_STEPS = 3

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
  onSourceChange,
  onTargetChange,
  onNext,
}: {
  sourceLang: string
  targetLang: string
  onSourceChange: (lang: string) => void
  onTargetChange: (lang: string) => void
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

      <div style={{ marginBottom: 28 }}>
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
  const [completing, setCompleting] = useState(false)

  const handleComplete = async () => {
    setCompleting(true)
    try {
      await saveConfig({ targetLang })
      await browser.storage.local.set({ "astra.onboarding.completed": true })

      // Close this tab
      const tabs = await browser.tabs.query({ active: true, currentWindow: true })
      if (tabs[0]?.id) {
        await browser.tabs.remove(tabs[0].id)
      }
    } catch {
      // If closing the tab fails, at least mark onboarding as done
      setCompleting(false)
    }
  }

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <StepDots current={step} />

        <div style={{ transition: "opacity 0.2s ease" }}>
          {step === 0 && <StepWelcome onNext={() => setStep(1)} />}
          {step === 1 && (
            <StepLanguage
              sourceLang={sourceLang}
              targetLang={targetLang}
              onSourceChange={setSourceLang}
              onTargetChange={setTargetLang}
              onNext={() => setStep(2)}
            />
          )}
          {step === 2 && (
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
