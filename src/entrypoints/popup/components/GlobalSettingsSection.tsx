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
import { labelStyle } from "./styles"
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
  { value: "google_translate", label: "Google Translate" },
  { value: "openai", label: "OpenAI" },
  { value: "gemini", label: "Gemini" },
] as const

function getProviderApiKeyPlaceholder(providerId: ProviderId): string {
  switch (providerId) {
    case "google_translate":
    case "gemini":
      return "AIzaSy..."
    case "openai":
      return "sk-..."
  }
}

function getProviderDirectServiceName(providerId: ProviderId): string {
  switch (providerId) {
    case "google_translate":
      return "Google Cloud Translation"
    case "gemini":
      return "Google Gemini"
    case "openai":
      return "OpenAI"
  }
}

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
      <summary className="astra-cursor-pointer" style={{ fontSize: 13, color: "var(--astra-brand-hover)" }}>
        ⚙ {t("settingsTitle")}
      </summary>
      <div style={{ marginTop: 8 }}>
        <label htmlFor="popup-provider-select" style={labelStyle}>{t("providerLabel")}</label>
        <select
          id="popup-provider-select"
          value={config.provider.id}
          onChange={(e) => {
            const providerId = e.target.value as ProviderId
            onProviderChange({
              id: providerId,
              model: getDefaultProviderModel(providerId),
            })
          }}
          className="astra-input"
        >
          {PROVIDER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>

        <label htmlFor="popup-provider-api-key" style={labelStyle}>{t("apiKeyLabel")}</label>
        <input
          id="popup-provider-api-key"
          type="password"
          value={config.provider.apiKey ?? ""}
          onChange={(e) => onProviderChange({ apiKey: e.target.value })}
          placeholder={getProviderApiKeyPlaceholder(config.provider.id)}
          className="astra-input"
        />
        <div style={{ fontSize: 11, color: "var(--astra-text-muted)", marginTop: 2 }}>
          {t("label_apiKeyDirectConnect", getProviderDirectServiceName(config.provider.id))}
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
            border: "1px solid var(--astra-border)",
            borderRadius: 4,
            cursor: testStatus === "testing" ? "wait" : "pointer",
            background: testStatus === "success" ? "var(--astra-success)" : testStatus === "error" ? "var(--astra-warning)" : "var(--astra-bg-card)",
            color: testStatus === "success" || testStatus === "error" ? "var(--astra-bg-card)" : "var(--astra-text-secondary)",
          }}
        >
          {testStatus === "testing" ? "Testing..." : testStatus === "success" ? "Connected!" : testStatus === "error" ? "Failed" : "Test Connection"}
        </button>
        {testStatus === "error" && testError && (
          <div style={{ fontSize: 11, color: "var(--astra-warning)", marginBottom: 6 }}>{testError}</div>
        )}

        <label htmlFor="popup-provider-relay-url" style={labelStyle}>{t("relayUrlLabel")}</label>
        <input
          id="popup-provider-relay-url"
          value={config.provider.relayBaseURL ?? ""}
          onChange={(e) => onProviderChange({ relayBaseURL: e.target.value })}
          placeholder="https://api.astra.example/v1"
          className="astra-input"
        />

        <label htmlFor="popup-provider-model" style={labelStyle}>{t("modelLabel")}</label>
        <input
          id="popup-provider-model"
          value={config.provider.model}
          onChange={(e) => onProviderChange({ model: e.target.value })}
          placeholder={getDefaultProviderModel(config.provider.id)}
          className="astra-input"
        />

        <label htmlFor="popup-target-language" style={labelStyle}>{t("targetLangLabel")}</label>
        <select
          id="popup-target-language"
          value={config.targetLang}
          onChange={(e) => onTargetLangChange(e.target.value)}
          className="astra-input"
        >
          {LANGUAGE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>

        <label htmlFor="popup-hover-trigger" style={labelStyle}>{t("hoverTriggerLabel")}</label>
        <select
          id="popup-hover-trigger"
          value={config.hoverTrigger}
          onChange={(e) => onHoverTriggerChange(e.target.value as HoverTrigger)}
          className="astra-input"
        >
          {HOVER_TRIGGER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{t(option.labelKey)}</option>
          ))}
        </select>

        <label htmlFor="popup-language-level" style={labelStyle}>{t("label_languageLevel")}</label>
        <select
          id="popup-language-level"
          value={config.languageLevel}
          onChange={(e) => onLanguageLevelChange(e.target.value as LanguageLevel)}
          className="astra-input"
        >
          {LANGUAGE_LEVEL_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{t(option.labelKey)}</option>
          ))}
        </select>

        <label htmlFor="popup-translation-mode" style={labelStyle}>{t("translationModeLabel")}</label>
        <select
          id="popup-translation-mode"
          value={config.presentation.mode}
          onChange={(e) => onPresentationChange({ mode: e.target.value as TranslationMode })}
          className="astra-input"
        >
          <option value="bilingual">{t("modeBilingual")}</option>
          <option value="translation-only">{t("modeTranslationOnly")}</option>
        </select>

        <label htmlFor="popup-translation-theme" style={labelStyle}>{t("translationThemeLabel")}</label>
        <select
          id="popup-translation-theme"
          value={config.presentation.theme}
          onChange={(e) => onPresentationChange({ theme: e.target.value as TranslationTheme })}
          className="astra-input"
        >
          <option value="default">{t("themeDefault")}</option>
          <option value="underline">{t("themeUnderline")}</option>
          <option value="highlight">{t("themeHighlight")}</option>
          <option value="mask">{t("themeMask")}</option>
        </select>

        <label htmlFor="popup-translation-font-size" style={labelStyle}>{t("label_translationFontSize")}</label>
        <input
          id="popup-translation-font-size"
          data-testid="global-font-size-input"
          type="range"
          min={0.5}
          max={2}
          step={0.05}
          value={config.presentation.fontSize}
          onChange={(e) => {
            const value = Number.parseFloat(e.target.value)
            if (!Number.isFinite(value)) return
            onPresentationChange({ fontSize: Math.max(0.5, Math.min(2, value)) })
          }}
          className="astra-input"
          style={{ padding: 0 }}
        />
        <div style={{ fontSize: 11, color: "var(--astra-text-decorative)", marginTop: 2 }}>
          {t("label_translationFontSizeValue", config.presentation.fontSize.toFixed(2))}
        </div>

        <label htmlFor="popup-content-scope" style={labelStyle}>{t("scopeLabel")}</label>
        <select
          id="popup-content-scope"
          value={config.contentScope}
          onChange={(e) => onContentScopeChange(e.target.value as ContentScope)}
          className="astra-input"
        >
          <option value="page">{t("scopePage")}</option>
          <option value="article">{t("scopeArticle")}</option>
        </select>
      </div>
    </details>
  )
}
