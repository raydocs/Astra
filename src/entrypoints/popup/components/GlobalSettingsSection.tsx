import type {
  AstraConfig,
  ContentScope,
  HoverTrigger,
  LanguageLevel,
  ProviderId,
  TranslationMode,
  TranslationTheme,
} from "@/types/config"
import { getDefaultProviderModel } from "@/types/config"
import { browser } from "#imports"
import { useState } from "react"
import { labelStyle, inputStyle } from "./styles"
import { t } from "@/utils/i18n"

const LANGUAGE_OPTIONS = [
  { value: "zh-CN", label: "简体中文" },
  { value: "zh-TW", label: "繁體中文" },
  { value: "en", label: "English" },
  { value: "ja", label: "日本語" },
  { value: "ko", label: "한국어" },
  { value: "fr", label: "Français" },
  { value: "de", label: "Deutsch" },
  { value: "es", label: "Español" },
] as const

const HOVER_TRIGGER_OPTIONS = [
  { value: "alt", labelKey: "hoverTriggerAlt" },
  { value: "always", labelKey: "hoverTriggerAlways" },
  { value: "disabled", labelKey: "hoverTriggerDisabled" },
] as const

const LANGUAGE_LEVEL_OPTIONS = [
  { value: "beginner", labelKey: "label_beginner" },
  { value: "intermediate", labelKey: "label_intermediate" },
  { value: "advanced", labelKey: "label_advanced" },
] as const

const PROVIDER_OPTIONS = [
  { value: "openai", label: "OpenAI" },
  { value: "gemini", label: "Gemini" },
] as const

export interface GlobalSettingsSectionProps {
  config: AstraConfig
  onProviderChange: (patch: Partial<AstraConfig["provider"]>) => void
  onPresentationChange: (patch: Partial<AstraConfig["presentation"]>) => void
  onTargetLangChange: (lang: string) => void
  onHoverTriggerChange: (trigger: HoverTrigger) => void
  onContentScopeChange: (scope: ContentScope) => void
  onLanguageLevelChange: (level: LanguageLevel) => void
}

export default function GlobalSettingsSection({
  config,
  onProviderChange,
  onPresentationChange,
  onTargetLangChange,
  onHoverTriggerChange,
  onContentScopeChange,
  onLanguageLevelChange,
}: GlobalSettingsSectionProps) {
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle")
  const [testError, setTestError] = useState("")

  const handleTestConnection = async () => {
    setTestStatus("testing")
    setTestError("")
    try {
      const response = await browser.runtime.sendMessage({
        type: "runtime/translate-batch",
        payload: {
          texts: ["hello"],
          targetLang: config.targetLang,
          task: "translate",
        },
      })
      if (response?.type === "runtime/translate-batch:success") {
        setTestStatus("success")
        setTimeout(() => setTestStatus("idle"), 3000)
      } else {
        setTestStatus("error")
        setTestError(response?.error?.message ?? "Unknown error")
      }
    } catch (err) {
      setTestStatus("error")
      setTestError(err instanceof Error ? err.message : "Connection failed")
    }
  }

  return (
    <details open style={{ marginBottom: 12 }}>
      <summary style={{ cursor: "pointer", fontSize: 13, color: "#c2410c" }}>
        ⚙ {t("settingsTitle")}
      </summary>
      <div style={{ marginTop: 8 }}>
        <label style={labelStyle}>{t("providerLabel")}</label>
        <select
          value={config.provider.id}
          onChange={(e) => {
            const providerId = e.target.value as ProviderId
            onProviderChange({
              id: providerId,
              model: getDefaultProviderModel(providerId),
            })
          }}
          style={inputStyle}
        >
          {PROVIDER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>

        <label style={labelStyle}>{t("apiKeyLabel")}</label>
        <input
          type="password"
          value={config.provider.apiKey ?? ""}
          onChange={(e) => onProviderChange({ apiKey: e.target.value })}
          placeholder={config.provider.id === "gemini" ? "AIzaSy..." : "sk-..."}
          style={inputStyle}
        />
        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
          {t("label_apiKeyDirectConnect", config.provider.id === "gemini" ? "Google" : "OpenAI")}
        </div>

        <button
          type="button"
          onClick={() => void handleTestConnection()}
          disabled={testStatus === "testing"}
          style={{
            marginTop: 4,
            marginBottom: 8,
            padding: "4px 12px",
            fontSize: 11,
            fontWeight: 600,
            border: "1px solid #e2e8f0",
            borderRadius: 4,
            cursor: testStatus === "testing" ? "wait" : "pointer",
            background: testStatus === "success" ? "#10b981" : testStatus === "error" ? "#f59e0b" : "#fff",
            color: testStatus === "success" || testStatus === "error" ? "#fff" : "#334155",
          }}
        >
          {testStatus === "testing" ? "Testing..." : testStatus === "success" ? "Connected!" : testStatus === "error" ? "Failed" : "Test Connection"}
        </button>
        {testStatus === "error" && testError && (
          <div style={{ fontSize: 11, color: "#b45309", marginBottom: 6 }}>{testError}</div>
        )}

        <label style={labelStyle}>{t("relayUrlLabel")}</label>
        <input
          value={config.provider.relayBaseURL ?? ""}
          onChange={(e) => onProviderChange({ relayBaseURL: e.target.value })}
          placeholder="https://api.astra.example/v1"
          style={inputStyle}
        />

        <label style={labelStyle}>{t("modelLabel")}</label>
        <input
          value={config.provider.model}
          onChange={(e) => onProviderChange({ model: e.target.value })}
          placeholder={getDefaultProviderModel(config.provider.id)}
          style={inputStyle}
        />

        <label style={labelStyle}>{t("targetLangLabel")}</label>
        <select
          value={config.targetLang}
          onChange={(e) => onTargetLangChange(e.target.value)}
          style={inputStyle}
        >
          {LANGUAGE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>

        <label style={labelStyle}>{t("hoverTriggerLabel")}</label>
        <select
          value={config.hoverTrigger}
          onChange={(e) => onHoverTriggerChange(e.target.value as HoverTrigger)}
          style={inputStyle}
        >
          {HOVER_TRIGGER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{t(option.labelKey)}</option>
          ))}
        </select>

        <label style={labelStyle}>{t("label_languageLevel")}</label>
        <select
          value={config.languageLevel}
          onChange={(e) => onLanguageLevelChange(e.target.value as LanguageLevel)}
          style={inputStyle}
        >
          {LANGUAGE_LEVEL_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{t(option.labelKey)}</option>
          ))}
        </select>

        <label style={labelStyle}>{t("translationModeLabel")}</label>
        <select
          value={config.presentation.mode}
          onChange={(e) => onPresentationChange({ mode: e.target.value as TranslationMode })}
          style={inputStyle}
        >
          <option value="bilingual">{t("modeBilingual")}</option>
          <option value="translation-only">{t("modeTranslationOnly")}</option>
        </select>

        <label style={labelStyle}>{t("translationThemeLabel")}</label>
        <select
          value={config.presentation.theme}
          onChange={(e) => onPresentationChange({ theme: e.target.value as TranslationTheme })}
          style={inputStyle}
        >
          <option value="default">{t("themeDefault")}</option>
          <option value="underline">{t("themeUnderline")}</option>
          <option value="highlight">{t("themeHighlight")}</option>
        </select>

        <label style={labelStyle}>{t("scopeLabel")}</label>
        <select
          value={config.contentScope}
          onChange={(e) => onContentScopeChange(e.target.value as ContentScope)}
          style={inputStyle}
        >
          <option value="page">{t("scopePage")}</option>
          <option value="article">{t("scopeArticle")}</option>
        </select>
      </div>
    </details>
  )
}
