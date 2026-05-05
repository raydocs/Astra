import { useCallback, useEffect, useRef, useState } from "react"
import { browser } from "#imports"
import { Toast } from "@/components/Toast"
import type {
  AstraConfig,
  ContentScope,
  CustomAction,
  HoverTrigger,
  InputTranslation,
  ProviderId,
  SiteConfig,
  TTSSettings,
  TranslationMode,
  TranslationTheme,
} from "@/types/config"
import type { AstraDeviceIdentity, AstraSession } from "@/types/auth"
import {
  DEFAULT_ASTRA_CONFIG,
  getDefaultProviderModel,
  isDefaultSiteConfig,
  normalizeSiteKey,
} from "@/types/config"
import { readConfig, saveConfig } from "@/utils/storage/config"
import { clearAstraSession, ensureAstraDeviceIdentity, readAstraSession, saveAstraSession } from "@/utils/storage/auth"
import { refreshAstraSession } from "@/utils/astra/auth"
import { fetchAstraContinuitySnapshot, revokeAstraDevice, updateAstraSyncCollectionPreference } from "@/utils/astra/account"
import { buildContinuityStatus, exportConfig, importConfig, downloadConfigFile, readConfigFile, runPhaseOneCollectionSync, type AstraContinuityRemoteSnapshot, type AstraContinuityStatus } from "@/utils/storage/config-sync"
import { exportSiteRules, importSiteRules } from "@/utils/storage/site-rules"
import { clearTranslationCache, getCacheStats } from "@/utils/cache/translation-cache"
import {
  aggregateLearningLoopFunnel,
  getLearningLoopCopyVariantAutoSelectionStatus,
  LEARNING_LOOP_EVENT_NAMES,
  type LearningLoopCopyVariantAutoSelectionStatus,
  type LearningLoopEventName,
  type LearningLoopFunnelAggregation,
} from "@/utils/learning-loop-events"
import { getRecentEvents, type TelemetryEvent } from "@/utils/telemetry"
import { isTtsSupported, listVoices, type TTSVoiceOption } from "@/utils/tts"
import { diagnoseProvider, PROVIDER_CAPABILITIES, type ProviderDiagnostics } from "@/utils/providers/capabilities"
import { useViewportProfile } from "@/utils/ui/useViewportProfile"
import { t } from "@/utils/i18n"

type Section = "general" | "providers" | "translation" | "actions" | "sites" | "vocabulary" | "diagnostics" | "about"

type PendingRevokeDevice = {
  deviceId: string
  label: string
}

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
  { value: "alt", label: "Alt + Hover" },
  { value: "always", label: "Always" },
  { value: "disabled", label: "Disabled" },
] as const

const CONTENT_SCOPE_OPTIONS = [
  { value: "page", label: "Full page" },
  { value: "article", label: "Article only" },
] as const

const PROVIDER_OPTIONS = [
  { value: "openai", label: "OpenAI" },
  { value: "gemini", label: "Gemini" },
] as const

const MODE_OPTIONS = [
  { value: "bilingual", label: "Bilingual" },
  { value: "translation-only", label: "Translation only" },
] as const

const THEME_OPTIONS = [
  { value: "default", label: "Default (border)" },
  { value: "underline", label: "Underline" },
  { value: "highlight", label: "Highlight" },
] as const

const LANGUAGE_LEVEL_OPTIONS = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
] as const

const NAV_ITEMS: { key: Section; label: string }[] = [
  { key: "general", label: "General" },
  { key: "providers", label: "Providers" },
  { key: "translation", label: "Translation" },
  { key: "actions", label: "Actions" },
  { key: "sites", label: "Sites" },
  { key: "vocabulary", label: "Vocabulary" },
  { key: "diagnostics", label: "Diagnostics" },
  { key: "about", label: "About" },
]

const BRAND_COLOR = "var(--astra-brand)"

function formatContinuityTimestamp(value: string | null | undefined): string {
  if (!value) return "not yet"

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return parsed.toLocaleString()
}

function formatDeviceHostLabel(device: {
  browserFamily: string | null
  platform: string | null
  appKind: string
  appVersion: string | null
}): string {
  const segments = [device.browserFamily, device.platform, device.appKind, device.appVersion].filter(Boolean)
  return segments.length > 0 ? segments.join(" · ") : "Unknown client"
}

function formatRelativeTimestamp(timestamp: number): string {
  const deltaMs = Date.now() - timestamp
  if (!Number.isFinite(deltaMs) || deltaMs < 0) return t("options_learningLoopJustNow")

  const minutes = Math.floor(deltaMs / 60000)
  if (minutes <= 0) return t("options_learningLoopJustNow")
  if (minutes === 1) return t("options_learningLoopRelativeMinute")
  if (minutes < 60) return t("options_learningLoopRelativeMinutes", `${minutes}`)

  const hours = Math.floor(minutes / 60)
  if (hours === 1) return t("options_learningLoopRelativeHour")
  if (hours < 24) return t("options_learningLoopRelativeHours", `${hours}`)

  const days = Math.floor(hours / 24)
  if (days === 1) return t("options_learningLoopRelativeDay")
  return t("options_learningLoopRelativeDays", `${days}`)
}

function getLearningLoopEventLabel(event: LearningLoopEventName): string {
  switch (event) {
    case "copy_variant_assigned":
      return "Learning-loop copy variant assigned"
    case "popup_primer_viewed":
      return "Popup primer viewed"
    case "popup_primer_cta_clicked":
      return "Popup primer CTA clicked"
    case "onboarding_closure_viewed":
      return "Onboarding closure copy viewed"
    case "onboarding_closure_cta_clicked":
      return "Onboarding closure CTA clicked"
    case "onboarding_completed":
      return "Onboarding completed"
    case "deep_read_opened":
      return t("options_learningLoopEventDeepReadOpened")
    case "sentence_explained":
      return t("options_learningLoopEventSentenceExplained")
    case "sentence_saved":
      return t("options_learningLoopEventSentenceSaved")
    case "review_answered":
      return t("options_learningLoopEventReviewAnswered")
    case "returned_to_source":
      return t("options_learningLoopEventReturnedToSource")
    case "resumed_reading":
      return t("options_learningLoopEventResumedReading")
  }
}

function formatLearningLoopFunnelRate(value: number | null): string {
  return value == null ? "n/a" : `${Math.round(value * 100)}%`
}

function formatLearningLoopAutoSelectionPhase(status: LearningLoopCopyVariantAutoSelectionStatus): string {
  switch (status.phase) {
    case "collecting":
      return "Collecting samples"
    case "guarded":
      return "Guardrails holding"
    case "cooldown":
      return "Cooldown active"
    case "selected":
      return status.recommendedVariant ? "Auto-selecting winner" : "Winner selected"
    case "unavailable":
      return "Unavailable"
  }
}

function formatLearningLoopAutoSelectionTime(value: number | null): string {
  if (value == null) return "n/a"
  return new Date(value).toLocaleString()
}

function getLearningLoopEventSummary(event: TelemetryEvent): string | null {
  if (event.type !== "feature_usage" || event.data.feature !== "learning_loop") {
    return null
  }

  const name = typeof event.data.event === "string"
    ? event.data.event as LearningLoopEventName
    : null
  if (!name || !LEARNING_LOOP_EVENT_NAMES.includes(name)) {
    return null
  }

  const location = [event.data.hostname, event.data.pageTitle, event.data.pageUrl]
    .find((value): value is string => typeof value === "string" && value.trim().length > 0)
  const source = typeof event.data.source === "string" && event.data.source.trim().length > 0
    ? event.data.source.trim()
    : null

  const parts = [getLearningLoopEventLabel(name)]
  if (location) parts.push(location)
  if (source) parts.push(source)
  return parts.join(" · ")
}

// --- Styles ---

const pageStyle: React.CSSProperties = {
  display: "flex",
  minHeight: "100vh",
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  fontSize: 14,
  color: "var(--astra-text-primary)",
  background: "var(--astra-bg-primary)",
  margin: 0,
}

const sidebarStyle: React.CSSProperties = {
  width: 200,
  minWidth: 200,
  background: "var(--astra-bg-card)",
  borderRight: "1px solid var(--astra-border)",
  padding: "24px 0",
  display: "flex",
  flexDirection: "column",
}

const logoStyle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 700,
  color: BRAND_COLOR,
  padding: "0 20px 20px",
  borderBottom: "1px solid var(--astra-border)",
  marginBottom: 8,
}

// navBtnBase / navBtnActive removed — now using className="astra-nav-item" / "astra-nav-item-mobile"

const contentStyle: React.CSSProperties = {
  flex: 1,
  padding: "32px 40px",
}

// sectionTitle removed — now using className="astra-section-heading"

const fieldGroup: React.CSSProperties = {
  marginBottom: "var(--astra-space-5)",
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "var(--astra-text-sm)",
  fontWeight: 500,
  color: "var(--astra-text-secondary)",
  marginBottom: 6,
}

const hintStyle: React.CSSProperties = {
  fontSize: "var(--astra-text-xs)",
  color: "var(--astra-text-muted)",
  marginTop: 4,
}

// inputStyle / selectStyle / btnPrimary / btnSecondary / btnDanger / cardStyle removed — all migrated to class names

const successBanner: React.CSSProperties = {
  padding: "10px 16px",
  background: "var(--astra-success-bg)",
  color: "var(--astra-success)",
  border: "1px solid var(--astra-border)",
  borderRadius: "var(--astra-radius-sm)",
  marginBottom: "var(--astra-space-5)",
  fontSize: "var(--astra-text-sm)",
}

const checkboxRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--astra-space-2)",
  marginBottom: "var(--astra-space-3)",
}

// --- Sections ---

function GeneralSection({
  config,
  onChange,
  onTtsChange,
  availableVoices,
  loadingVoices,
  ttsSupported,
  onRefreshVoices,
}: {
  config: AstraConfig
  onChange: (patch: Partial<AstraConfig>) => void
  onTtsChange: (patch: Partial<TTSSettings>) => void
  availableVoices: TTSVoiceOption[]
  loadingVoices: boolean
  ttsSupported: boolean
  onRefreshVoices: () => void
}) {
  const savedVoiceMissing = !!config.tts.voiceName
    && !availableVoices.some((voice) => voice.name === config.tts.voiceName)

  return (
    <div>
      <h2 className="astra-section-heading">General</h2>

      <div style={fieldGroup}>
        <label htmlFor="options-general-target-language" style={labelStyle}>Target language</label>
        <select
          id="options-general-target-language"
          className="astra-input"
          value={config.targetLang}
          onChange={(e) => onChange({ targetLang: e.target.value })}
        >
          {LANGUAGE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div style={fieldGroup}>
        <label htmlFor="options-general-language-level" style={labelStyle}>Language level</label>
        <select
          id="options-general-language-level"
          className="astra-input"
          value={config.languageLevel}
          onChange={(e) => onChange({ languageLevel: e.target.value as AstraConfig["languageLevel"] })}
        >
          {LANGUAGE_LEVEL_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <div style={hintStyle}>Adjusts explanation detail based on your proficiency.</div>
      </div>

      <div style={fieldGroup}>
        <label htmlFor="options-general-hover-trigger" style={labelStyle}>Hover trigger</label>
        <select
          id="options-general-hover-trigger"
          className="astra-input"
          value={config.hoverTrigger}
          onChange={(e) => onChange({ hoverTrigger: e.target.value as HoverTrigger })}
        >
          {HOVER_TRIGGER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div style={fieldGroup}>
        <label htmlFor="options-general-content-scope" style={labelStyle}>Content scope</label>
        <select
          id="options-general-content-scope"
          className="astra-input"
          value={config.contentScope}
          onChange={(e) => onChange({ contentScope: e.target.value as ContentScope })}
        >
          {CONTENT_SCOPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <div style={hintStyle}>"Article only" skips navigation, sidebars, and footers.</div>
      </div>

      <div style={fieldGroup}>
        <label htmlFor="options-general-input-translation" style={labelStyle}>Input translation</label>
        <select
          id="options-general-input-translation"
          className="astra-input"
          value={config.inputTranslation}
          onChange={(e) => onChange({ inputTranslation: e.target.value as InputTranslation })}
        >
          <option value="enabled">Enabled</option>
          <option value="disabled">Disabled</option>
        </select>
        <div style={hintStyle}>Show a translate button near focused text inputs.</div>
      </div>

      <div style={checkboxRow}>
        <input
          type="checkbox"
          id="privacy-mode"
          checked={config.privacyMode}
          onChange={(e) => onChange({ privacyMode: e.target.checked })}
        />
        <label htmlFor="privacy-mode" style={{ fontSize: 14, color: "var(--astra-text-secondary)" }}>
          Privacy mode
        </label>
      </div>
      <div style={{ ...hintStyle, marginTop: -4, marginBottom: 8 }}>
        When enabled, sensitive form fields are excluded from translation.
      </div>

      <div style={{ ...fieldGroup, marginTop: 28 }}>
        <h3 className="astra-section-subheading">Text to speech</h3>

        <div style={checkboxRow}>
          <input
            type="checkbox"
            id="tts-enabled"
            checked={config.tts.enabled}
            onChange={(e) => onTtsChange({ enabled: e.target.checked })}
          />
          <label htmlFor="tts-enabled" style={{ fontSize: 14, color: "var(--astra-text-secondary)" }}>
            Enable TTS in the selection toolbar
          </label>
        </div>
        <div style={{ ...hintStyle, marginTop: -4, marginBottom: 12 }}>
          Adds a speak button when you select text on the page.
        </div>

        <div style={fieldGroup}>
          <label htmlFor="options-general-tts-engine" style={labelStyle}>{t("options_ttsEngine")}</label>
          <select
            id="options-general-tts-engine"
            className="astra-input"
            value={config.tts.engine}
            disabled={!config.tts.enabled}
            onChange={(e) => onTtsChange({ engine: e.target.value as "browser" | "edge", voiceName: undefined })}
          >
            <option value="browser">Browser (Web Speech API)</option>
            <option value="edge">Edge TTS (Neural voices)</option>
          </select>
          <div style={hintStyle}>
            {config.tts.engine === "edge"
              ? "Microsoft Edge neural voices — high quality, requires network."
              : "Uses voices installed on your device via the browser."}
          </div>
        </div>

        <div style={fieldGroup}>
          <label htmlFor="options-general-tts-voice" style={labelStyle}>{t("options_ttsVoice")}</label>
          <div style={{ display: "flex", gap: 8, alignItems: "center", maxWidth: 520 }}>
            <select
              id="options-general-tts-voice"
              className="astra-input"
              style={{ flex: 1, maxWidth: "none" }}
              value={config.tts.voiceName ?? ""}
              disabled={config.tts.engine === "browser" && (!ttsSupported || !config.tts.enabled || loadingVoices)}
              onChange={(e) => onTtsChange({ voiceName: e.target.value })}
            >
              <option value="">{config.tts.engine === "edge" ? "Auto (match target lang)" : "Browser default"}</option>
              {savedVoiceMissing && config.tts.voiceName && (
                <option value={config.tts.voiceName}>{config.tts.voiceName} (saved)</option>
              )}
              {availableVoices.map((voice) => (
                <option key={`${voice.name}:${voice.lang}`} value={voice.name}>
                  {voice.name} ({voice.lang}){voice.default ? " — Default" : ""}
                </option>
              ))}
            </select>
            {config.tts.engine === "browser" && (
              <button
                type="button"
                className="astra-btn-secondary"
                disabled={!ttsSupported || loadingVoices}
                onClick={onRefreshVoices}
              >
                {loadingVoices ? "Loading..." : "Refresh"}
              </button>
            )}
          </div>
          <div style={hintStyle}>
            {config.tts.engine === "edge"
              ? "Neural voices from Microsoft Edge — consistent across all platforms."
              : !ttsSupported
                ? "This browser does not expose Web Speech voices here."
                : loadingVoices
                  ? "Loading voices from your browser..."
                  : availableVoices.length > 0
                    ? "Voices come from the browser and operating system on this device."
                    : "No voices detected yet. Try Refresh after the browser finishes loading them."}
          </div>
        </div>

        <div style={fieldGroup}>
          <label htmlFor="options-general-tts-rate" style={labelStyle}>{t("options_ttsSpeechRate", config.tts.rate.toFixed(1))}</label>
          <input
            id="options-general-tts-rate"
            type="range"
            min="0.5"
            max="1.5"
            step="0.1"
            value={config.tts.rate}
            disabled={!config.tts.enabled}
            onChange={(e) => onTtsChange({ rate: Number(e.target.value) })}
            style={{ width: "100%", maxWidth: 400 }}
          />
          <div style={hintStyle}>Lower values sound steadier for language learners; 0.9x is the default.</div>
        </div>

        <div style={fieldGroup}>
          <label htmlFor="options-general-tts-pitch" style={labelStyle}>{t("options_ttsPitch", config.tts.pitch.toFixed(1))}</label>
          <input
            id="options-general-tts-pitch"
            type="range"
            min="0.5"
            max="2.0"
            step="0.1"
            value={config.tts.pitch}
            disabled={!config.tts.enabled}
            onChange={(e) => onTtsChange({ pitch: Number(e.target.value) })}
            style={{ width: "100%", maxWidth: 400 }}
          />
        </div>

        <div style={checkboxRow}>
          <input
            type="checkbox"
            id="tts-highlight"
            checked={config.tts.highlightSentences}
            disabled={!config.tts.enabled}
            onChange={(e) => onTtsChange({ highlightSentences: e.target.checked })}
          />
          <label htmlFor="tts-highlight" style={{ fontSize: 14, color: "var(--astra-text-secondary)" }}>
            Highlight sentences during playback
          </label>
        </div>
        <div style={{ ...hintStyle, marginTop: -4 }}>
          Reads text sentence by sentence and highlights the current one.
        </div>
      </div>
    </div>
  )
}

function ProvidersSection({
  config,
  onProviderChange,
}: {
  config: AstraConfig
  onProviderChange: (patch: Partial<AstraConfig["provider"]>) => void
}) {
  return (
    <div>
      <h2 className="astra-section-heading">Providers</h2>

      <div style={fieldGroup}>
        <label htmlFor="options-provider-id" style={labelStyle}>Provider</label>
        <select
          id="options-provider-id"
          className="astra-input"
          value={config.provider.id}
          onChange={(e) => {
            const id = e.target.value as ProviderId
            onProviderChange({ id, model: getDefaultProviderModel(id) })
          }}
        >
          {PROVIDER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div style={fieldGroup}>
        <label htmlFor="options-provider-api-key" style={labelStyle}>API key</label>
        <input
          id="options-provider-api-key"
          type="password"
          className="astra-input"
          value={config.provider.apiKey ?? ""}
          onChange={(e) => onProviderChange({ apiKey: e.target.value })}
          placeholder={config.provider.id === "gemini" ? "AIzaSy..." : "sk-..."}
        />
        <div style={hintStyle}>
          With an API key, requests go directly to {config.provider.id === "gemini" ? "Google" : "OpenAI"} -- no Astra account required.
        </div>
      </div>

      <div style={fieldGroup}>
        <label htmlFor="options-provider-relay-url" style={labelStyle}>Relay URL</label>
        <input
          id="options-provider-relay-url"
          className="astra-input"
          value={config.provider.relayBaseURL ?? ""}
          onChange={(e) => onProviderChange({ relayBaseURL: e.target.value })}
          placeholder="https://api.astra.example/v1"
        />
        <div style={hintStyle}>Optional. Route requests through an Astra relay server.</div>
      </div>

      <div style={fieldGroup}>
        <label htmlFor="options-provider-model" style={labelStyle}>Model</label>
        <input
          id="options-provider-model"
          className="astra-input"
          value={config.provider.model}
          onChange={(e) => onProviderChange({ model: e.target.value })}
          placeholder={getDefaultProviderModel(config.provider.id)}
        />
      </div>
    </div>
  )
}

function TranslationSection({
  config,
  onPresentationChange,
}: {
  config: AstraConfig
  onPresentationChange: (patch: Partial<AstraConfig["presentation"]>) => void
}) {
  return (
    <div>
      <h2 className="astra-section-heading">Translation</h2>

      <div style={fieldGroup}>
        <label htmlFor="options-translation-mode" style={labelStyle}>Presentation mode</label>
        <select
          id="options-translation-mode"
          className="astra-input"
          value={config.presentation.mode}
          onChange={(e) => onPresentationChange({ mode: e.target.value as TranslationMode })}
        >
          {MODE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div style={fieldGroup}>
        <label htmlFor="options-translation-theme" style={labelStyle}>Theme</label>
        <select
          id="options-translation-theme"
          className="astra-input"
          value={config.presentation.theme}
          onChange={(e) => onPresentationChange({ theme: e.target.value as TranslationTheme })}
        >
          {THEME_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div style={fieldGroup}>
        <label htmlFor="options-translation-font-size" style={labelStyle}>Font size (em)</label>
        <input
          id="options-translation-font-size"
          type="number"
          step="0.01"
          min="0.5"
          max="2.0"
          className="astra-input"
          style={{ maxWidth: 120 }}
          value={config.presentation.fontSize}
          onChange={(e) => {
            const value = parseFloat(e.target.value)
            if (!Number.isNaN(value)) {
              onPresentationChange({ fontSize: Math.max(0.5, Math.min(2.0, value)) })
            }
          }}
        />
      </div>

      <div style={fieldGroup}>
        <label htmlFor="options-translation-color-picker" style={labelStyle}>Translation color</label>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <input
            id="options-translation-color-picker"
            type="color"
            className="astra-color-picker"
            value={config.presentation.translationColor}
            onChange={(e) => onPresentationChange({ translationColor: e.target.value })}
            style={{ width: 40, height: 32, border: "1px solid var(--astra-border)", borderRadius: 4, padding: 2 }}
          />
          <input
            id="options-translation-color-input"
            className="astra-input"
            style={{ maxWidth: 160 }}
            value={config.presentation.translationColor}
            onChange={(e) => onPresentationChange({ translationColor: e.target.value })}
            placeholder="#64748b"
          />
        </div>
      </div>
    </div>
  )
}

function toMultilineValue(values?: string[]): string {
  return values?.join("\n") ?? ""
}

function fromMultilineValue(value: string): string[] | undefined {
  const entries = value
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean)

  return entries.length > 0 ? entries : undefined
}

function getInvalidSelectors(selectors?: string[]): string[] {
  if (!selectors) return []

  return selectors.filter((selector) => {
    try {
      document.querySelector(selector)
      return false
    } catch {
      return true
    }
  })
}

function hasAdvancedRules(siteConfig: SiteConfig): boolean {
  return !!siteConfig.selectors?.length
    || !!siteConfig.excludeSelectors?.length
    || siteConfig.paragraphMinLength != null
}

function hasProviderOverride(siteConfig: SiteConfig): boolean {
  return !!siteConfig.provider?.id || !!siteConfig.provider?.model
}

function siteControlId(hostname: string, field: string): string {
  return `options-site-${encodeURIComponent(hostname)}-${field}`
}

function actionControlId(actionId: string, field: string): string {
  return `options-action-${encodeURIComponent(actionId)}-${field}`
}

function SitesSection({
  config,
  onChange,
}: {
  config: AstraConfig
  onChange: (patch: Partial<AstraConfig>) => void
}) {
  const siteEntries = Object.entries(config.sites)
  const [editingSite, setEditingSite] = useState<string | null>(null)
  const [newSiteKey, setNewSiteKey] = useState("")
  const [selectorDrafts, setSelectorDrafts] = useState<Record<string, string>>({})
  const [excludeSelectorDrafts, setExcludeSelectorDrafts] = useState<Record<string, string>>({})
  const [selectorErrors, setSelectorErrors] = useState<Record<string, string | null>>({})
  const [excludeSelectorErrors, setExcludeSelectorErrors] = useState<Record<string, string | null>>({})
  const [rulesStatus, setRulesStatus] = useState<string | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [importText, setImportText] = useState("")

  type SitePresentationOverride = NonNullable<SiteConfig["presentation"]>
  type SiteProviderOverride = NonNullable<SiteConfig["provider"]>

  useEffect(() => {
    const entries = Object.entries(config.sites)
    setSelectorDrafts(Object.fromEntries(entries.map(([hostname, siteConfig]) => [hostname, toMultilineValue(siteConfig.selectors)])))
    setExcludeSelectorDrafts(Object.fromEntries(entries.map(([hostname, siteConfig]) => [hostname, toMultilineValue(siteConfig.excludeSelectors)])))
    setSelectorErrors((current) => Object.fromEntries(entries.map(([hostname]) => [hostname, current[hostname] ?? null])))
    setExcludeSelectorErrors((current) => Object.fromEntries(entries.map(([hostname]) => [hostname, current[hostname] ?? null])))
  }, [config.sites])

  const deleteSite = (hostname: string) => {
    const nextSites = { ...config.sites }
    delete nextSites[hostname]
    onChange({ sites: nextSites })
  }

  const mutateSite = (hostname: string, mutate: (current: SiteConfig) => SiteConfig) => {
    const nextSites = { ...config.sites }
    const current = nextSites[hostname] ?? { enabled: true, alwaysTranslate: false }
    const updated = mutate(current)
    if (isDefaultSiteConfig(updated)) {
      delete nextSites[hostname]
    } else {
      nextSites[hostname] = updated
    }
    onChange({ sites: nextSites })
  }

  const mutateSitePresentation = <K extends keyof SitePresentationOverride>(
    hostname: string,
    key: K,
    value: SitePresentationOverride[K] | undefined,
  ) => {
    mutateSite(hostname, (current) => {
      const nextPresentation = { ...(current.presentation ?? {}) }
      if (value === undefined || value === "") {
        delete nextPresentation[key]
      } else {
        nextPresentation[key] = value
      }

      const { presentation: _presentation, ...siteWithoutPresentation } = current
      return Object.keys(nextPresentation).length > 0
        ? { ...siteWithoutPresentation, presentation: nextPresentation }
        : siteWithoutPresentation
    })
  }

  const mutateSiteProvider = <K extends keyof SiteProviderOverride>(
    hostname: string,
    key: K,
    value: SiteProviderOverride[K] | undefined,
  ) => {
    mutateSite(hostname, (current) => {
      const nextProvider = { ...(current.provider ?? {}) }
      if (value === undefined || value === "") {
        delete nextProvider[key]
      } else {
        nextProvider[key] = value
      }

      const { provider: _provider, ...siteWithoutProvider } = current
      return Object.keys(nextProvider).length > 0
        ? { ...siteWithoutProvider, provider: nextProvider }
        : siteWithoutProvider
    })
  }

  const addSite = () => {
    const key = normalizeSiteKey(newSiteKey)
    if (!key) return
    const nextSites = { ...config.sites }
    if (!nextSites[key]) {
      nextSites[key] = { enabled: true, alwaysTranslate: false }
    }
    onChange({ sites: nextSites })
    setNewSiteKey("")
    setEditingSite(key)
  }

  return (
    <div>
      <h2 className="astra-section-heading">Sites</h2>
      <div style={hintStyle}>Per-site rules override global settings.</div>

      <div style={{ display: "flex", gap: 8, margin: "16px 0" }}>
        <input
          className="astra-input"
          value={newSiteKey}
          onChange={(e) => setNewSiteKey(e.target.value)}
          placeholder="example.com"
          onKeyDown={(e) => { if (e.key === "Enter") addSite() }}
        />
        <button type="button" className="astra-btn-secondary" onClick={addSite}>Add site</button>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button
          type="button"
          className="astra-btn-secondary"
          onClick={() => {
            const json = exportSiteRules(config)
            void navigator.clipboard.writeText(json).then(() => {
              setRulesStatus(t("siteRules_allRulesExported"))
              setTimeout(() => setRulesStatus(null), 2000)
            })
          }}
        >
          {t("siteRules_exportAllRules")}
        </button>
        <button
          type="button"
          className="astra-btn-secondary"
          onClick={() => setShowImport(!showImport)}
        >
          {t("siteRules_importRules")}
        </button>
      </div>

      {showImport && (
        <div className="astra-card" style={{ marginBottom: 16 }}>
          <textarea
            data-testid="import-rules-textarea"
              className="astra-input"
              style={{ maxWidth: "100%", minHeight: 100, resize: "vertical", fontFamily: "monospace", fontSize: 13 }}
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder='Paste exported site rules JSON here...'
          />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button
              type="button"
              className="astra-btn-primary"
              onClick={() => {
                try {
                  const result = importSiteRules(importText, config)
                  onChange({ sites: result.sites })
                  setRulesStatus(t("siteRules_rulesImported"))
                  setImportText("")
                  setShowImport(false)
                } catch {
                  setRulesStatus(t("siteRules_invalidRuleFormat"))
                }
                setTimeout(() => setRulesStatus(null), 2000)
              }}
            >
              {t("siteRules_importRules")}
            </button>
            <button
              type="button"
              className="astra-btn-secondary"
              onClick={() => { setShowImport(false); setImportText("") }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {rulesStatus && (
        <div role="status" aria-live="polite" style={{ ...successBanner, marginBottom: 16 }}>{rulesStatus}</div>
      )}

      {siteEntries.length === 0 && (
        <div className="astra-card" style={{ color: "var(--astra-text-muted)", textAlign: "center" }}>
          No per-site rules configured.
        </div>
      )}

      {siteEntries.map(([hostname, siteConfig]) => (
        <div key={hostname} className="astra-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: editingSite === hostname ? 12 : 0 }}>
            <div>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{hostname}</span>
              {!siteConfig.enabled && (
                <span style={{ marginLeft: 8, fontSize: 11, color: "#dc2626", background: "#fef2f2", padding: "2px 6px", borderRadius: 4 }}>
                  disabled
                </span>
              )}
              {siteConfig.alwaysTranslate && (
                <span style={{ marginLeft: 8, fontSize: 11, color: "#059669", background: "#ecfdf5", padding: "2px 6px", borderRadius: 4 }}>
                  auto-translate
                </span>
              )}
              {hasAdvancedRules(siteConfig) && (
                <span style={{ marginLeft: 8, fontSize: 11, color: "#0369a1", background: "#e0f2fe", padding: "2px 6px", borderRadius: 4 }}>
                  advanced
                </span>
              )}
              {hasProviderOverride(siteConfig) && (
                <span style={{ marginLeft: 8, fontSize: 11, color: "#7c3aed", background: "#f3e8ff", padding: "2px 6px", borderRadius: 4 }}>
                  provider
                </span>
              )}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                type="button"
                className="astra-btn-secondary"
                style={{ padding: "4px 12px", fontSize: 12 }}
                onClick={() => setEditingSite(editingSite === hostname ? null : hostname)}
              >
                {editingSite === hostname ? "Close" : "Edit"}
              </button>
              <button
                type="button"
                className="astra-btn-danger"
                style={{ padding: "4px 12px", fontSize: 12 }}
                onClick={() => deleteSite(hostname)}
              >
                Delete
              </button>
            </div>
          </div>

          {editingSite === hostname && (
            <div style={{ borderTop: "1px solid var(--astra-border)", paddingTop: 12 }}>
              <div style={checkboxRow}>
                <input
                  type="checkbox"
                  id={`site-enabled-${hostname}`}
                  checked={siteConfig.enabled}
                  onChange={(e) => mutateSite(hostname, (current) => ({
                    ...current,
                    enabled: e.target.checked,
                  }))}
                />
                <label htmlFor={`site-enabled-${hostname}`}>Enabled</label>
              </div>
              <div style={checkboxRow}>
                <input
                  type="checkbox"
                  id={`site-auto-${hostname}`}
                  checked={siteConfig.alwaysTranslate}
                  onChange={(e) => mutateSite(hostname, (current) => ({
                    ...current,
                    alwaysTranslate: e.target.checked,
                  }))}
                />
                <label htmlFor={`site-auto-${hostname}`}>Auto-translate on load</label>
              </div>
              <div style={fieldGroup}>
                <label htmlFor={siteControlId(hostname, "target-lang")} style={labelStyle}>Target language override</label>
                <select
                  id={siteControlId(hostname, "target-lang")}
                  className="astra-input"
                  style={{ maxWidth: 220 }}
                  value={siteConfig.targetLang ?? ""}
                  onChange={(e) => mutateSite(hostname, (current) => {
                    const nextSite = { ...current }
                    if (e.target.value) {
                      nextSite.targetLang = e.target.value
                    } else {
                      delete nextSite.targetLang
                    }
                    return nextSite
                  })}
                >
                  <option value="">Use global default</option>
                  {LANGUAGE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div style={fieldGroup}>
                <label htmlFor={siteControlId(hostname, "hover-trigger")} style={labelStyle}>Hover trigger override</label>
                <select
                  id={siteControlId(hostname, "hover-trigger")}
                  className="astra-input"
                  style={{ maxWidth: 220 }}
                  value={siteConfig.hoverTrigger ?? ""}
                  onChange={(e) => mutateSite(hostname, (current) => {
                    const nextSite = { ...current }
                    if (e.target.value) {
                      nextSite.hoverTrigger = e.target.value as HoverTrigger
                    } else {
                      delete nextSite.hoverTrigger
                    }
                    return nextSite
                  })}
                >
                  <option value="">Use global default</option>
                  {HOVER_TRIGGER_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div style={fieldGroup}>
                <label htmlFor={siteControlId(hostname, "content-scope")} style={labelStyle}>Content scope override</label>
                <select
                  id={siteControlId(hostname, "content-scope")}
                  className="astra-input"
                  style={{ maxWidth: 220 }}
                  value={siteConfig.contentScope ?? ""}
                  onChange={(e) => mutateSite(hostname, (current) => {
                    const nextSite = { ...current }
                    if (e.target.value) {
                      nextSite.contentScope = e.target.value as ContentScope
                    } else {
                      delete nextSite.contentScope
                    }
                    return nextSite
                  })}
                >
                  <option value="">Use global default</option>
                  {CONTENT_SCOPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div style={fieldGroup}>
                <label htmlFor={siteControlId(hostname, "provider-id")} style={labelStyle}>Provider override</label>
                <select
                  id={siteControlId(hostname, "provider-id")}
                  className="astra-input"
                  style={{ maxWidth: 220 }}
                  value={siteConfig.provider?.id ?? ""}
                  onChange={(e) => mutateSiteProvider(
                    hostname,
                    "id",
                    e.target.value ? e.target.value as ProviderId : undefined,
                  )}
                >
                  <option value="">Use global provider ({config.provider.id})</option>
                  {PROVIDER_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <div style={hintStyle}>Provider changes use relay routing unless the global direct key belongs to the same provider.</div>
              </div>
              <div style={fieldGroup}>
                <label htmlFor={siteControlId(hostname, "provider-model")} style={labelStyle}>Model override</label>
                <input
                  id={siteControlId(hostname, "provider-model")}
                  className="astra-input"
                  style={{ maxWidth: 320 }}
                  value={siteConfig.provider?.model ?? ""}
                  onChange={(e) => mutateSiteProvider(
                    hostname,
                    "model",
                    e.target.value.trim() || undefined,
                  )}
                  placeholder={siteConfig.provider?.id ? getDefaultProviderModel(siteConfig.provider.id) : config.provider.model}
                />
                <div style={hintStyle}>Blank inherits the global model, or the selected provider default when provider is overridden.</div>
              </div>
              <div style={fieldGroup}>
                <label htmlFor={siteControlId(hostname, "presentation-mode")} style={labelStyle}>Presentation mode override</label>
                <select
                  id={siteControlId(hostname, "presentation-mode")}
                  className="astra-input"
                  style={{ maxWidth: 220 }}
                  value={siteConfig.presentation?.mode ?? ""}
                  onChange={(e) => mutateSitePresentation(
                    hostname,
                    "mode",
                    e.target.value ? e.target.value as TranslationMode : undefined,
                  )}
                >
                  <option value="">Use global default</option>
                  {MODE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div style={fieldGroup}>
                <label htmlFor={siteControlId(hostname, "presentation-theme")} style={labelStyle}>Theme override</label>
                <select
                  id={siteControlId(hostname, "presentation-theme")}
                  className="astra-input"
                  style={{ maxWidth: 220 }}
                  value={siteConfig.presentation?.theme ?? ""}
                  onChange={(e) => mutateSitePresentation(
                    hostname,
                    "theme",
                    e.target.value ? e.target.value as TranslationTheme : undefined,
                  )}
                >
                  <option value="">Use global default</option>
                  {THEME_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div style={fieldGroup}>
                <label htmlFor={siteControlId(hostname, "presentation-font-size")} style={labelStyle}>Font size override</label>
                <input
                  id={siteControlId(hostname, "presentation-font-size")}
                  type="number"
                  min="0.5"
                  max="2.0"
                  step="0.05"
                  className="astra-input"
                  style={{ maxWidth: 120 }}
                  value={siteConfig.presentation?.fontSize ?? ""}
                  onChange={(e) => {
                    if (e.target.value === "") {
                      mutateSitePresentation(hostname, "fontSize", undefined)
                      return
                    }
                    const value = parseFloat(e.target.value)
                    if (!Number.isNaN(value)) {
                      mutateSitePresentation(hostname, "fontSize", Math.max(0.5, Math.min(2.0, value)))
                    }
                  }}
                  placeholder={`${config.presentation.fontSize}`}
                />
                <div style={hintStyle}>Blank uses the global font size.</div>
              </div>
              <div style={fieldGroup}>
                <label htmlFor={siteControlId(hostname, "translation-color")} style={labelStyle}>Translation color override</label>
                <input
                  id={siteControlId(hostname, "translation-color")}
                  className="astra-input"
                  style={{ maxWidth: 160 }}
                  value={siteConfig.presentation?.translationColor ?? ""}
                  onChange={(e) => mutateSitePresentation(
                    hostname,
                    "translationColor",
                    e.target.value.trim() || undefined,
                  )}
                  placeholder={config.presentation.translationColor}
                />
                <div style={hintStyle}>Blank uses the global translation color.</div>
              </div>

              <details data-testid={`advanced-rules-${hostname}`} style={{ marginTop: 12 }}>
                <summary className="astra-details-summary" style={{ fontSize: 13, color: "var(--astra-text-secondary)" }}>Advanced rules</summary>
                <div style={{ marginTop: 12 }}>
                  <div style={fieldGroup}>
                    <label htmlFor={siteControlId(hostname, "include-selectors")} style={labelStyle}>Include selectors</label>
                    <textarea
                      id={siteControlId(hostname, "include-selectors")}
                      className="astra-input"
                      style={{ maxWidth: "100%", minHeight: 80, resize: "vertical", fontFamily: "monospace" }}
                      value={selectorDrafts[hostname] ?? ""}
                      onChange={(e) => {
                        const nextValue = e.target.value
                        setSelectorDrafts((current) => ({ ...current, [hostname]: nextValue }))
                        const selectors = fromMultilineValue(nextValue)
                        const invalidSelectors = getInvalidSelectors(selectors)
                        if (invalidSelectors.length > 0) {
                          setSelectorErrors((current) => ({ ...current, [hostname]: `Invalid CSS selector: ${invalidSelectors.join(", ")}` }))
                          return
                        }

                        setSelectorErrors((current) => ({ ...current, [hostname]: null }))
                        mutateSite(hostname, (current) => {
                          const nextSite = { ...current }
                          if (selectors) {
                            nextSite.selectors = selectors
                          } else {
                            delete nextSite.selectors
                          }
                          return nextSite
                        })
                      }}
                      placeholder={"article\n.content"}
                    />
                    <div style={hintStyle}>One CSS selector per line.</div>
                    {selectorErrors[hostname] && (
                      <div style={{ ...successBanner, marginBottom: 0, marginTop: 8, background: "#fef2f2", color: "#dc2626", borderColor: "#fecaca" }}>
                        {selectorErrors[hostname]}
                      </div>
                    )}
                  </div>

                  <div style={fieldGroup}>
                    <label htmlFor={siteControlId(hostname, "exclude-selectors")} style={labelStyle}>Exclude selectors</label>
                    <textarea
                      id={siteControlId(hostname, "exclude-selectors")}
                      className="astra-input"
                      style={{ maxWidth: "100%", minHeight: 80, resize: "vertical", fontFamily: "monospace" }}
                      value={excludeSelectorDrafts[hostname] ?? ""}
                      onChange={(e) => {
                        const nextValue = e.target.value
                        setExcludeSelectorDrafts((current) => ({ ...current, [hostname]: nextValue }))
                        const excludeSelectors = fromMultilineValue(nextValue)
                        const invalidSelectors = getInvalidSelectors(excludeSelectors)
                        if (invalidSelectors.length > 0) {
                          setExcludeSelectorErrors((current) => ({ ...current, [hostname]: `Invalid CSS selector: ${invalidSelectors.join(", ")}` }))
                          return
                        }

                        setExcludeSelectorErrors((current) => ({ ...current, [hostname]: null }))
                        mutateSite(hostname, (current) => {
                          const nextSite = { ...current }
                          if (excludeSelectors) {
                            nextSite.excludeSelectors = excludeSelectors
                          } else {
                            delete nextSite.excludeSelectors
                          }
                          return nextSite
                        })
                      }}
                      placeholder={".comments\naside"}
                    />
                    <div style={hintStyle}>One CSS selector per line.</div>
                    {excludeSelectorErrors[hostname] && (
                      <div style={{ ...successBanner, marginBottom: 0, marginTop: 8, background: "#fef2f2", color: "#dc2626", borderColor: "#fecaca" }}>
                        {excludeSelectorErrors[hostname]}
                      </div>
                    )}
                  </div>

                  <div style={fieldGroup}>
                    <label htmlFor={siteControlId(hostname, "paragraph-min-length")} style={labelStyle}>Minimum paragraph length</label>
                    <input
                      id={siteControlId(hostname, "paragraph-min-length")}
                      type="number"
                      min="0"
                      step="1"
                      className="astra-input"
                      style={{ maxWidth: 220 }}
                      value={siteConfig.paragraphMinLength?.toString() ?? ""}
                      onChange={(e) => mutateSite(hostname, (current) => {
                        const nextSite = { ...current }
                        const trimmed = e.target.value.trim()
                        if (!trimmed) {
                          delete nextSite.paragraphMinLength
                          return nextSite
                        }

                        const parsed = Number.parseInt(trimmed, 10)
                        if (Number.isFinite(parsed)) {
                          nextSite.paragraphMinLength = Math.max(0, parsed)
                        }
                        return nextSite
                      })}
                      placeholder="Use global default"
                    />
                    <div style={hintStyle}>Leave blank to disable length filtering.</div>
                  </div>
                </div>
              </details>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function ActionsSection({
  config,
  onChange,
}: {
  config: AstraConfig
  onChange: (patch: Partial<AstraConfig>) => void
}) {
  const customActions = config.customActions ?? []
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showNewForm, setShowNewForm] = useState(false)
  const [newLabel, setNewLabel] = useState("")
  const [newLabelZh, setNewLabelZh] = useState("")
  const [newPrompt, setNewPrompt] = useState("")
  const [editLabel, setEditLabel] = useState("")
  const [editLabelZh, setEditLabelZh] = useState("")
  const [editPrompt, setEditPrompt] = useState("")

  const generateId = (label: string): string => {
    const base = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
    const id = base || "custom"
    const existingIds = new Set([
      ...BUILTIN_IDS,
      ...customActions.map(a => a.id),
    ])
    if (!existingIds.has(id)) return id
    let counter = 2
    while (existingIds.has(`${id}-${counter}`)) counter++
    return `${id}-${counter}`
  }

  const handleAdd = () => {
    if (!newLabel.trim() || !newLabelZh.trim() || !newPrompt.trim()) return
    const action: CustomAction = {
      id: generateId(newLabel),
      label: newLabel.trim(),
      labelZh: newLabelZh.trim(),
      systemPrompt: newPrompt.trim(),
      enabled: true,
    }
    onChange({ customActions: [...customActions, action] })
    setNewLabel("")
    setNewLabelZh("")
    setNewPrompt("")
    setShowNewForm(false)
  }

  const handleDelete = (id: string) => {
    onChange({ customActions: customActions.filter(a => a.id !== id) })
    if (editingId === id) setEditingId(null)
  }

  const handleToggle = (id: string) => {
    onChange({
      customActions: customActions.map(a =>
        a.id === id ? { ...a, enabled: !a.enabled } : a,
      ),
    })
  }

  const startEditing = (action: CustomAction) => {
    setEditingId(action.id)
    setEditLabel(action.label)
    setEditLabelZh(action.labelZh)
    setEditPrompt(action.systemPrompt)
  }

  const handleSaveEdit = (id: string) => {
    if (!editLabel.trim() || !editLabelZh.trim() || !editPrompt.trim()) return
    onChange({
      customActions: customActions.map(a =>
        a.id === id
          ? { ...a, label: editLabel.trim(), labelZh: editLabelZh.trim(), systemPrompt: editPrompt.trim() }
          : a,
      ),
    })
    setEditingId(null)
  }

  return (
    <div>
      <h2 className="astra-section-heading">Custom Actions</h2>
      <div style={hintStyle}>
        Custom actions appear in the selection toolbar alongside built-in actions.
        Use {"{{text}}"} and {"{{targetLang}}"} as placeholders in your prompt template.
      </div>

      {customActions.length === 0 && !showNewForm && (
        <div className="astra-card" style={{ color: "var(--astra-text-muted)", textAlign: "center", marginTop: 16 }}>
          No custom actions configured.
        </div>
      )}

      {customActions.map((action) => (
        <div key={action.id} className="astra-card" style={{ marginTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: editingId === action.id ? 12 : 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={action.enabled}
                onChange={() => handleToggle(action.id)}
              />
              <span style={{ fontWeight: 600, fontSize: 14 }}>{action.label}</span>
              <span style={{ fontSize: 13, color: "var(--astra-text-muted)" }}>({action.labelZh})</span>
              {!action.enabled && (
                <span style={{ fontSize: 11, color: "#dc2626", background: "#fef2f2", padding: "2px 6px", borderRadius: 4 }}>
                  disabled
                </span>
              )}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                type="button"
                className="astra-btn-secondary"
                style={{ padding: "4px 12px", fontSize: 12 }}
                onClick={() => editingId === action.id ? setEditingId(null) : startEditing(action)}
              >
                {editingId === action.id ? "Cancel" : "Edit"}
              </button>
              <button
                type="button"
                className="astra-btn-danger"
                style={{ padding: "4px 12px", fontSize: 12 }}
                onClick={() => handleDelete(action.id)}
              >
                Delete
              </button>
            </div>
          </div>

          {editingId !== action.id && (
            <div style={{ marginTop: 4, fontSize: 12, color: "var(--astra-text-hint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {action.systemPrompt.length > 80 ? `${action.systemPrompt.slice(0, 80)}...` : action.systemPrompt}
            </div>
          )}

          {editingId === action.id && (
            <div style={{ borderTop: "1px solid var(--astra-border)", paddingTop: 12 }}>
              <div style={fieldGroup}>
                <label htmlFor={actionControlId(action.id, "edit-label-en")} style={labelStyle}>Label (English)</label>
                <input
                  id={actionControlId(action.id, "edit-label-en")}
                  className="astra-input"
                    value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                />
              </div>
              <div style={fieldGroup}>
                <label htmlFor={actionControlId(action.id, "edit-label-zh")} style={labelStyle}>Label (Chinese)</label>
                <input
                  id={actionControlId(action.id, "edit-label-zh")}
                  className="astra-input"
                    value={editLabelZh}
                  onChange={(e) => setEditLabelZh(e.target.value)}
                />
              </div>
              <div style={fieldGroup}>
                <label htmlFor={actionControlId(action.id, "edit-prompt")} style={labelStyle}>System prompt template</label>
                <textarea
                  id={actionControlId(action.id, "edit-prompt")}
                  className="astra-input"
                  style={{ maxWidth: "100%", minHeight: 80, resize: "vertical", fontFamily: "monospace" }}
                  value={editPrompt}
                  onChange={(e) => setEditPrompt(e.target.value)}
                />
                <div style={hintStyle}>
                  Use {"{{text}}"} for selected text, {"{{targetLang}}"} for target language.
                </div>
              </div>
              <button
                type="button"
                className="astra-btn-primary"
                onClick={() => handleSaveEdit(action.id)}
              >
                Save changes
              </button>
            </div>
          )}
        </div>
      ))}

      {showNewForm ? (
        <div className="astra-card" style={{ marginTop: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, marginTop: 0 }}>New custom action</h3>
          <div style={fieldGroup}>
            <label htmlFor="options-action-new-label-en" style={labelStyle}>Label (English)</label>
            <input
              id="options-action-new-label-en"
              className="astra-input"
                value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="e.g. Simplify"
            />
          </div>
          <div style={fieldGroup}>
            <label htmlFor="options-action-new-label-zh" style={labelStyle}>Label (Chinese)</label>
            <input
              id="options-action-new-label-zh"
              className="astra-input"
                value={newLabelZh}
              onChange={(e) => setNewLabelZh(e.target.value)}
              placeholder="e.g. 简化"
            />
          </div>
          <div style={fieldGroup}>
            <label htmlFor="options-action-new-prompt" style={labelStyle}>System prompt template</label>
            <textarea
              id="options-action-new-prompt"
              className="astra-input"
              value={newPrompt}
              onChange={(e) => setNewPrompt(e.target.value)}
              placeholder={"Simplify the following text in {{targetLang}}. Output only the simplified text.\n\nText: {{text}}"}
            />
            <div style={hintStyle}>
              Use {"{{text}}"} for selected text, {"{{targetLang}}"} for target language.
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="astra-btn-primary" onClick={handleAdd}>
              Add action
             </button>
          <button type="button" className="astra-btn-secondary" onClick={() => { setShowNewForm(false); setNewLabel(""); setNewLabelZh(""); setNewPrompt("") }}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 16 }}>
          <button type="button" className="astra-btn-secondary" onClick={() => setShowNewForm(true)}>
            + Add custom action
          </button>
        </div>
      )}
    </div>
  )
}

const BUILTIN_IDS = new Set(["translate", "explain", "summarize", "rewrite", "grammar"])

function VocabularySection() {
  const openVocabulary = () => {
    void browser.tabs.create({ url: browser.runtime.getURL("/vocabulary.html") })
  }

  const [cacheInfo, setCacheInfo] = useState<string>("Loading...")
  const [learningLoopSummary, setLearningLoopSummary] = useState<string>(t("options_learningLoopLoading"))
  const [learningLoopEvents, setLearningLoopEvents] = useState<Array<{ id: string, summary: string, relativeTime: string }>>([])

  const refreshCacheInfo = async () => {
    try {
      const [bytes, stats] = await Promise.all([
        browser.storage.local.getBytesInUse?.(),
        getCacheStats(),
      ])
      const localStorageUsage = typeof bytes === "number"
        ? `${(bytes / 1024).toFixed(1)} KB local storage usage`
        : "local storage usage unavailable"
      const hitRate = stats.lookups > 0 ? `${(stats.hitRate * 100).toFixed(0)}%` : "n/a"
      const hottestBucket = stats.buckets[0]
      const hottestLabel = hottestBucket
        ? `${hottestBucket.providerId}/${hottestBucket.model}`
        : "no buckets yet"
      setCacheInfo(`${localStorageUsage} · ${stats.count} cached items · ${stats.lookups} lookups · ${hitRate} hit rate · top bucket ${hottestLabel}`)
    } catch {
      setCacheInfo("Cache telemetry unavailable")
    }
  }

  const refreshLearningLoopInfo = async () => {
    try {
      const events = await getRecentEvents(50)
      const learningLoopEvents = events
        .filter((event) => event.type === "feature_usage" && event.data.feature === "learning_loop")

      if (learningLoopEvents.length === 0) {
        setLearningLoopSummary(t("options_learningLoopEmpty"))
        setLearningLoopEvents([])
        return
      }

      const counts = new Map<LearningLoopEventName, number>()
      for (const name of LEARNING_LOOP_EVENT_NAMES) {
        counts.set(name, 0)
      }

      for (const event of learningLoopEvents) {
        const name = typeof event.data.event === "string"
          ? event.data.event as LearningLoopEventName
          : null
        if (name && counts.has(name)) {
          counts.set(name, (counts.get(name) ?? 0) + 1)
        }
      }

      const activeCounts = LEARNING_LOOP_EVENT_NAMES
        .map((name) => {
          const count = counts.get(name) ?? 0
          return count > 0 ? `${getLearningLoopEventLabel(name)} ${count}` : null
        })
        .filter((value): value is string => Boolean(value))

      setLearningLoopSummary(activeCounts.join(" · ") || t("options_learningLoopEmpty"))
      setLearningLoopEvents(learningLoopEvents
        .slice(0, 5)
        .map((event) => ({
          id: event.id,
          summary: getLearningLoopEventSummary(event) ?? t("options_learningLoopUnknownEvent"),
          relativeTime: formatRelativeTimestamp(event.timestamp),
        })))
    } catch {
      setLearningLoopSummary(t("options_learningLoopUnavailable"))
      setLearningLoopEvents([])
    }
  }

  useEffect(() => {
    void refreshCacheInfo()
    void refreshLearningLoopInfo()
  }, [])

  const clearCache = async () => {
    try {
      await Promise.all([
        browser.storage.local.remove("astra.vocab.cache"),
        clearTranslationCache(),
      ])
      await refreshCacheInfo()
    } catch {
      setCacheInfo("Failed to clear cache")
    }
  }

  return (
    <div>
      <h2 className="astra-section-heading">Vocabulary</h2>

      <div className="astra-card">
        <div style={{ marginBottom: 12 }}>
          <strong>Saved words</strong>
          <div style={hintStyle}>Open the vocabulary page to review and manage saved words.</div>
        </div>
        <button type="button" className="astra-btn-primary" onClick={openVocabulary}>
          Open vocabulary
        </button>
      </div>

      <div className="astra-card">
        <div style={{ marginBottom: 12 }}>
          <strong>Cache</strong>
          <div style={{ ...hintStyle, marginTop: 4 }}>{cacheInfo}</div>
        </div>
        <button type="button" className="astra-btn-danger" onClick={() => void clearCache()}>
            Clear cache
        </button>
      </div>

      <div className="astra-card">
        <div style={{ marginBottom: 12 }}>
          <strong>{t("options_learningLoopTitle")}</strong>
          <div style={hintStyle}>{t("options_learningLoopHint")}</div>
          <div style={{ ...hintStyle, marginTop: 4 }}>{learningLoopSummary}</div>
        </div>

        {learningLoopEvents.length > 0 ? (
          <div style={{ display: "grid", gap: 8 }}>
            {learningLoopEvents.map((event) => (
              <div
                key={event.id}
                style={{
                  border: "1px solid var(--astra-border)",
                  borderRadius: 8,
                  padding: "10px 12px",
                  background: "var(--astra-bg-primary)",
                }}
              >
                <div style={{ fontSize: 13, color: "var(--astra-text-primary)", fontWeight: 500 }}>{event.summary}</div>
                <div style={{ ...hintStyle, marginTop: 4 }}>{event.relativeTime}</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ ...hintStyle, marginTop: 4 }}>{learningLoopSummary}</div>
        )}
      </div>
    </div>
  )
}

function DiagnosticsSection({ config }: { config: AstraConfig }) {
  const [learningLoopFunnel, setLearningLoopFunnel] = useState<LearningLoopFunnelAggregation>(() => aggregateLearningLoopFunnel([]))
  const [learningLoopFunnelStatus, setLearningLoopFunnelStatus] = useState("Loading local funnel telemetry...")
  const [learningLoopAutoSelection, setLearningLoopAutoSelection] = useState<LearningLoopCopyVariantAutoSelectionStatus | null>(null)

  useEffect(() => {
    let mounted = true

    void getRecentEvents(200)
      .then(async (events) => {
        if (!mounted) return
        const aggregation = aggregateLearningLoopFunnel(events)
        const autoSelection = await getLearningLoopCopyVariantAutoSelectionStatus(events)
        if (!mounted) return
        setLearningLoopFunnel(aggregation)
        setLearningLoopAutoSelection(autoSelection)
        setLearningLoopFunnelStatus(
          aggregation.totals.totalEvents > 0
            ? `${aggregation.totals.totalEvents} local funnel event${aggregation.totals.totalEvents === 1 ? "" : "s"}`
            : "No local funnel events yet.",
        )
      })
      .catch(() => {
        if (!mounted) return
        setLearningLoopFunnel(aggregateLearningLoopFunnel([]))
        setLearningLoopAutoSelection(null)
        setLearningLoopFunnelStatus("Learning-loop funnel telemetry unavailable.")
      })

    return () => {
      mounted = false
    }
  }, [])

  const diag = diagnoseProvider({
    providerId: config.provider.id,
    model: config.provider.model,
    apiKey: config.provider.apiKey ?? "",
    accessToken: config.provider.accessToken ?? "",
    relayBaseURL: config.provider.relayBaseURL,
  })

  const capability = PROVIDER_CAPABILITIES[config.provider.id]

  const statusColors: Record<ProviderDiagnostics["status"], string> = {
    connected: "#16a34a",
    partial: "#d97706",
    disconnected: "#dc2626",
  }

  const autoSelectionCurrent = learningLoopAutoSelection?.candidates.find((candidate) => candidate.variant === learningLoopAutoSelection.currentVariant)
  const autoSelectionWinner = learningLoopAutoSelection?.candidates.find((candidate) => candidate.variant === learningLoopAutoSelection.winnerVariant)

  return (
    <div>
      <h2 className="astra-section-heading">Diagnostics</h2>

      <div className="astra-card">
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: "var(--astra-text-primary)" }}>{t("options_diagProviderStatus")}</h3>

        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 14px",
          background: "var(--astra-bg-primary)",
          borderRadius: 8,
          border: "1px solid var(--astra-border)",
        }}
        >
          <span style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: statusColors[diag.status],
            flexShrink: 0,
          }}
          />
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--astra-text-primary)" }}>
              {diag.providerName} — {diag.modelLabel ?? diag.model}
            </div>
            <div style={{ fontSize: 12, color: "var(--astra-text-muted)", marginTop: 2 }}>
              {t("options_diagDirect")} {diag.directAccess ? t("options_diagYes") : t("options_diagNo")} · {t("options_diagRelay")} {diag.relayAccess ? t("options_diagYes") : t("options_diagNo")} · {t("options_diagCostPerPage")} {diag.estimatedCostPerPage}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <h4 style={{ fontSize: 13, fontWeight: 600, color: "var(--astra-text-secondary)", marginBottom: 8 }}>{t("options_diagTransportRoutes")}</h4>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{
              flex: 1,
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid var(--astra-border)",
              background: diag.directAccess ? "#f0fdf4" : "#fef2f2",
            }}
            >
              <div style={{ fontSize: 12, fontWeight: 600, color: diag.directAccess ? "#166534" : "#991b1b" }}>
                {t("options_diagDirectApi")}
              </div>
              <div style={{ fontSize: 11, color: "var(--astra-text-muted)", marginTop: 2 }}>
                {diag.directAccess ? t("options_diagApiKeyConfigured", diag.providerName) : t("options_diagNoApiKey")}
              </div>
            </div>
            <div style={{
              flex: 1,
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid var(--astra-border)",
              background: diag.relayAccess ? "#f0fdf4" : "#fef2f2",
            }}
            >
              <div style={{ fontSize: 12, fontWeight: 600, color: diag.relayAccess ? "#166534" : "#991b1b" }}>
                {t("options_diagAstraRelay")}
              </div>
              <div style={{ fontSize: 11, color: "var(--astra-text-muted)", marginTop: 2 }}>
                {diag.relayAccess ? t("options_diagRelayActive") : t("options_diagNoRelay")}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="astra-card" style={{ marginTop: 16 }} data-testid="learning-loop-funnel-card">
        <h3 className="astra-section-subheading">Local A/B learning funnel</h3>
        <div style={hintStyle}>
          Uses only this device's local telemetry from the popup primer through Deep Read, explanation, save, and review events. No backend or schema migration is required.
        </div>
        <div style={{ ...hintStyle, marginTop: 4 }} data-testid="learning-loop-funnel-status">
          {learningLoopFunnelStatus}
        </div>
        {learningLoopAutoSelection && (
          <div
            data-testid="learning-loop-auto-selection-status"
            style={{
              marginTop: 12,
              border: "1px solid #bfdbfe",
              borderRadius: 8,
              padding: "10px 12px",
              background: "#eff6ff",
            }}
          >
            <div style={{ fontSize: 13, color: "var(--astra-text-primary)", fontWeight: 700 }}>
              Auto-selection: {formatLearningLoopAutoSelectionPhase(learningLoopAutoSelection)}
            </div>
            <div style={{ fontSize: 12, color: "#334155", marginTop: 4, lineHeight: 1.55 }}>
              Current {autoSelectionCurrent?.label ?? learningLoopAutoSelection.currentVariant} · Local winner {autoSelectionWinner?.label ?? "none yet"} · {learningLoopAutoSelection.reason}
            </div>
            <div style={{ ...hintStyle, marginTop: 6 }}>
              Guardrails: {learningLoopAutoSelection.guardrails.minViewsPerVariant} views/variant · score ≥ {formatLearningLoopFunnelRate(learningLoopAutoSelection.guardrails.minWinnerScore)} · hysteresis {formatLearningLoopFunnelRate(learningLoopAutoSelection.guardrails.hysteresis)} · cooldown {Math.round(learningLoopAutoSelection.guardrails.cooldownMs / 3600000)}h
            </div>
            <div style={{ ...hintStyle, marginTop: 4 }}>
              Last evaluated {formatLearningLoopAutoSelectionTime(learningLoopAutoSelection.lastEvaluatedAt)} · Cooldown until {formatLearningLoopAutoSelectionTime(learningLoopAutoSelection.cooldownUntil)}
            </div>
            <div style={{ display: "grid", gap: 4, marginTop: 8 }}>
              {learningLoopAutoSelection.candidates.map((candidate) => (
                <div key={candidate.variant} style={{ fontSize: 12, color: "#334155" }}>
                  {candidate.label}: {candidate.views}/{learningLoopAutoSelection.guardrails.minViewsPerVariant} views · score {formatLearningLoopFunnelRate(candidate.score)} · {candidate.ready ? "ready" : "collecting"}
                </div>
              ))}
            </div>
          </div>
        )}
        <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
          {learningLoopFunnel.variants.map((variant) => (
            <div
              key={variant.variant}
              data-testid={`learning-loop-funnel-${variant.variant}`}
              style={{
                border: "1px solid var(--astra-border)",
                borderRadius: 8,
                padding: "10px 12px",
                background: variant.variant === "unknown" ? "var(--astra-bg-primary)" : "#fff7ed",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                <strong style={{ fontSize: 13, color: "var(--astra-text-primary)" }}>{variant.label}</strong>
                <span style={{ fontSize: 11, color: "var(--astra-text-muted)" }}>
                  Save/explain {formatLearningLoopFunnelRate(variant.saveRate)}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "#334155", marginTop: 6, lineHeight: 1.55 }}>
                Views {variant.counts.popup_primer_viewed} · CTA {variant.counts.popup_primer_cta_clicked} · Deep Read {variant.counts.deep_read_opened} · Explained {variant.counts.sentence_explained} · Saved {variant.counts.sentence_saved} · Reviewed {variant.counts.review_answered}
              </div>
              <div style={{ ...hintStyle, marginTop: 4 }}>
                CTA/view {formatLearningLoopFunnelRate(variant.ctaRate)} · Deep Read/view {formatLearningLoopFunnelRate(variant.deepReadRate)} · Explain/Deep Read {formatLearningLoopFunnelRate(variant.explainRate)}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="astra-card" style={{ marginTop: 16 }}>
        <h3 className="astra-section-subheading">{t("options_diagProviderCapabilities")}</h3>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: "2px solid var(--astra-border)" }}>
              <th style={{ textAlign: "left", padding: "6px 8px", color: "var(--astra-text-secondary)" }}>{t("options_diagColModel")}</th>
              <th style={{ textAlign: "right", padding: "6px 8px", color: "var(--astra-text-secondary)" }}>{t("options_diagColInputCost")}</th>
              <th style={{ textAlign: "right", padding: "6px 8px", color: "var(--astra-text-secondary)" }}>{t("options_diagColOutputCost")}</th>
              <th style={{ textAlign: "right", padding: "6px 8px", color: "var(--astra-text-secondary)" }}>{t("options_diagColContext")}</th>
            </tr>
          </thead>
          <tbody>
            {capability.models.map((model) => (
              <tr
                key={model.id}
                style={{
                  borderBottom: "1px solid #f1f5f9",
                  background: model.id === config.provider.model ? "#eff6ff" : "transparent",
                }}
              >
                <td style={{ padding: "6px 8px", color: "var(--astra-text-primary)" }}>
                  {model.label}
                  {model.recommended && (
                    <span style={{ marginLeft: 6, fontSize: 10, color: "#6366f1", fontWeight: 600 }}>{t("options_diagRecommended")}</span>
                  )}
                  {model.id === config.provider.model && (
                    <span style={{ marginLeft: 6, fontSize: 10, color: "#2563eb", fontWeight: 600 }}>{t("options_diagActive")}</span>
                  )}
                </td>
                <td style={{ textAlign: "right", padding: "6px 8px", color: "var(--astra-text-muted)" }}>
                  {model.inputCostPer1kTokens > 0 ? `$${model.inputCostPer1kTokens}` : t("options_diagFree")}
                </td>
                <td style={{ textAlign: "right", padding: "6px 8px", color: "var(--astra-text-muted)" }}>
                  {model.outputCostPer1kTokens > 0 ? `$${model.outputCostPer1kTokens}` : t("options_diagFree")}
                </td>
                <td style={{ textAlign: "right", padding: "6px 8px", color: "var(--astra-text-muted)" }}>
                  {(model.maxContextTokens / 1000).toFixed(0)}k
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ marginTop: 12, fontSize: 11, color: "var(--astra-text-hint)" }}>
          {t("options_diagMaxBatch", [String(capability.maxBatchSize), capability.maxInputCharsPerRequest.toLocaleString()])}
        </div>
      </div>

      <div className="astra-card" style={{ marginTop: 16 }}>
        <h3 className="astra-section-subheading">{t("options_diagWorkflowConfig")}</h3>
        <div style={{ fontSize: 12, color: "#334155", lineHeight: 1.6 }}>
          <div style={{ marginBottom: 8 }}>
            <strong>{t("options_diagConnectionMode")}</strong> {config.connectionMode === "astra" ? t("options_diagAstraManaged") : t("options_diagCustomKey")}
          </div>
          <div style={{ marginBottom: 8 }}>
            <strong>Translation scope:</strong> {config.contentScope === "article" ? "Article area only" : "Full page"}
          </div>
          <div style={{ marginBottom: 8 }}>
            <strong>Hover trigger:</strong> {config.hoverTrigger === "alt" ? "Alt + Hover" : config.hoverTrigger === "always" ? "Always" : "Disabled"}
          </div>
          <div style={{ marginBottom: 8 }}>
            <strong>Input translation:</strong> {config.inputTranslation === "enabled" ? "Enabled" : "Disabled"}
          </div>
          <div style={{ marginBottom: 8 }}>
            <strong>Language level:</strong> {config.languageLevel.charAt(0).toUpperCase() + config.languageLevel.slice(1)}
          </div>
          <div style={{ marginBottom: 8 }}>
            <strong>Privacy mode:</strong> {config.privacyMode ? "On" : "Off"}
          </div>
          <div>
            <strong>TTS engine:</strong> {config.tts.engine === "edge" ? "Edge TTS (Neural)" : "Browser (Web Speech)"} · Rate: {config.tts.rate}x
          </div>
        </div>
      </div>
    </div>
  )
}

function RevokeDeviceConfirmDialog({
  deviceLabel,
  busy,
  onCancel,
  onConfirm,
}: {
  deviceLabel: string
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    cancelButtonRef.current?.focus()
  }, [])

  useEffect(() => {
    if (busy) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        onCancel()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [busy, onCancel])

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: "var(--astra-z-modal)",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "rgba(15, 23, 42, 0.42)",
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="revoke-device-dialog-title"
        aria-describedby="revoke-device-dialog-description"
        className="astra-card"
        style={{
          width: "min(100%, 420px)",
          boxShadow: "var(--astra-shadow-lg)",
        }}
      >
        <h2 id="revoke-device-dialog-title" style={{ fontSize: 18, fontWeight: 700, color: "var(--astra-text-primary)", margin: "0 0 8px" }}>
          Revoke device access?
        </h2>
        <p id="revoke-device-dialog-description" style={{ margin: 0, color: "var(--astra-text-secondary)", lineHeight: 1.6 }}>
          Revoke Astra access for <strong>{deviceLabel}</strong>? This device will need to sign in again.
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 20 }}>
          <button
            ref={cancelButtonRef}
            type="button"
            className="astra-btn-secondary"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="astra-btn-danger"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Revoking..." : "Revoke access"}
          </button>
        </div>
      </section>
    </div>
  )
}

function AboutSection({
  continuityStatus,
  continuityBusy,
  continuityActionBusyDeviceId,
  onRefreshContinuity,
  onRequestRevokeDevice,
  onToggleReadingHistorySync,
  onToggleStudyProgressSync,
}: {
  continuityStatus: AstraContinuityStatus | null
  continuityBusy: boolean
  continuityActionBusyDeviceId: string | null
  onRefreshContinuity: () => void
  onRequestRevokeDevice: (device: PendingRevokeDevice) => void
  onToggleReadingHistorySync: (enabled: boolean) => void
  onToggleStudyProgressSync: (enabled: boolean) => void
}) {
  const version = browser.runtime.getManifest?.()?.version ?? "0.1.0"
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [backupStatus, setBackupStatus] = useState<{ type: "success" | "error"; message: string } | null>(null)
  const remoteConfigCollection = continuityStatus?.remote.configCollection ?? null
  const remoteReadingHistoryCollection = continuityStatus?.remote.readingHistoryCollection ?? null
  const remoteStudyProgressCollection = continuityStatus?.remote.studyProgressCollection ?? null

  const handleExport = async () => {
    try {
      setBackupStatus(null)
      const json = await exportConfig()
      downloadConfigFile(json)
      setBackupStatus({ type: "success", message: t("options_settingsExported") })
    } catch {
      setBackupStatus({ type: "error", message: t("options_invalidConfigFile") })
    }
  }

  const handleImport = async (file: File) => {
    try {
      setBackupStatus(null)
      const json = await readConfigFile(file)
      await importConfig(json)
      setBackupStatus({ type: "success", message: t("options_settingsImported") })
      setTimeout(() => window.location.reload(), 1500)
    } catch (err) {
      setBackupStatus({ type: "error", message: err instanceof Error ? err.message : t("options_invalidConfigFile") })
    }
  }

  return (
    <div>
      <h2 className="astra-section-heading">About</h2>

      <div className="astra-card">
        <div style={{ fontSize: 18, fontWeight: 700, color: BRAND_COLOR, marginBottom: 8 }}>
          Astra
        </div>
        <div style={{ marginBottom: 12, color: "var(--astra-text-secondary)" }}>
          AI-powered language learning software, extension-first.
        </div>
        <div style={{ fontSize: 13, color: "var(--astra-text-muted)", marginBottom: 4 }}>
          Version: {version}
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
          <a
            href="https://github.com/nicepkg/astra"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: BRAND_COLOR, fontSize: 13 }}
          >
            GitHub
          </a>
          <a
            href="https://astra-docs.example.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: BRAND_COLOR, fontSize: 13 }}
          >
            Documentation
          </a>
        </div>
      </div>

      <div className="astra-card" style={{ marginTop: 16 }} data-testid="continuity-status">
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: "var(--astra-text-primary)" }}>
          Continuity status
        </h3>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 12 }}>
          <div style={{ ...hintStyle, marginTop: 0 }}>
            Device/session registry and config bootstrap status from Astra. Plan, quota, and billing labels live in the popup and web account surfaces.
          </div>
          <button
            type="button"
            className="astra-btn-secondary"
            style={{ padding: "6px 12px", fontSize: 12, whiteSpace: "nowrap" }}
            data-testid="refresh-continuity-btn"
            onClick={onRefreshContinuity}
            disabled={continuityBusy || continuityActionBusyDeviceId !== null}
          >
            {continuityBusy ? "Refreshing..." : "Refresh status"}
          </button>
        </div>
        <div style={{ fontSize: 13, color: "var(--astra-text-secondary)", lineHeight: 1.6 }}>
          <div><strong>Device:</strong> {continuityStatus?.device.label ?? "Preparing device identity"}</div>
          <div><strong>Session:</strong> {continuityStatus?.session.state ?? "signed-out"}</div>
          <div><strong>Config sync-safe:</strong> ready</div>
          <div><strong>Optional collections:</strong> reading history, study progress</div>
          {continuityStatus?.sync.localOnly.localOnlyFields.length ? (
            <div><strong>Local only:</strong> {continuityStatus.sync.localOnly.localOnlyFields.join(", ")}</div>
          ) : (
            <div><strong>Local only:</strong> none</div>
          )}
          {continuityStatus?.session.state === "authenticated" && continuityStatus.remote.available && (
            <>
              <div><strong>Server time:</strong> {formatContinuityTimestamp(continuityStatus.remote.serverTime)}</div>
              <div><strong>Registered devices:</strong> {continuityStatus.remote.deviceCount} total · {continuityStatus.remote.activeDeviceCount} active</div>
              {remoteConfigCollection && (
                <div>
                  <strong>Config bootstrap:</strong> {remoteConfigCollection.enabled ? "enabled" : "disabled"} · cursor {remoteConfigCollection.bootstrapCursor ?? "none"}
                  {remoteConfigCollection.hasPull ? ` · latest pull ${remoteConfigCollection.deltaCount} delta${remoteConfigCollection.deltaCount === 1 ? "" : "s"}` : ""}
                </div>
              )}
              <div style={{ marginTop: 8, border: "1px solid var(--astra-border)", borderRadius: 6, padding: "10px 12px", background: "var(--astra-bg-primary)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                  <div>
                    <div>
                      <strong>Reading history sync:</strong> {remoteReadingHistoryCollection?.enabled ? "enabled" : "disabled"} · optional · sanitized URLs only
                      {remoteReadingHistoryCollection
                        ? ` · cursor ${remoteReadingHistoryCollection.bootstrapCursor ?? "none"}`
                        : ""}
                    </div>
                    <div style={{ ...hintStyle, marginTop: 4 }}>
                      Uploads page history by sanitized URL only.
                    </div>
                  </div>
                  {remoteReadingHistoryCollection && (
                    <label htmlFor="options-continuity-reading-history-sync" style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, color: "#334155", whiteSpace: "nowrap" }}>
                      <input
                        id="options-continuity-reading-history-sync"
                        data-testid="reading-history-sync-toggle"
                        type="checkbox"
                        checked={remoteReadingHistoryCollection.enabled}
                        onChange={(event) => onToggleReadingHistorySync(event.currentTarget.checked)}
                        disabled={continuityBusy || continuityActionBusyDeviceId !== null}
                      />
                      <span>{remoteReadingHistoryCollection.enabled ? "On" : "Off"}</span>
                    </label>
                  )}
                </div>
              </div>
              <div style={{ marginTop: 8, border: "1px solid var(--astra-border)", borderRadius: 6, padding: "10px 12px", background: "var(--astra-bg-primary)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                  <div>
                    <div>
                      <strong>Study progress sync:</strong> {remoteStudyProgressCollection?.enabled ? "enabled" : "disabled"} · optional · per-page durable progress only
                      {remoteStudyProgressCollection
                        ? ` · cursor ${remoteStudyProgressCollection.bootstrapCursor ?? "none"}`
                        : ""}
                    </div>
                    <div style={{ ...hintStyle, marginTop: 4 }}>
                      Uploads durable page progress only. Daily study stats stay local on this device.
                    </div>
                  </div>
                  {remoteStudyProgressCollection && (
                    <label htmlFor="options-continuity-study-progress-sync" style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, color: "#334155", whiteSpace: "nowrap" }}>
                      <input
                        id="options-continuity-study-progress-sync"
                        data-testid="study-progress-sync-toggle"
                        type="checkbox"
                        checked={remoteStudyProgressCollection.enabled}
                        onChange={(event) => onToggleStudyProgressSync(event.currentTarget.checked)}
                        disabled={continuityBusy || continuityActionBusyDeviceId !== null}
                      />
                      <span>{remoteStudyProgressCollection.enabled ? "On" : "Off"}</span>
                    </label>
                  )}
                </div>
              </div>
              <div style={{ marginTop: 8 }}>
                <strong>Devices</strong>
                <div style={{ ...hintStyle, marginTop: 6 }}>
                  Use popup Sign out for this device. Revoke is only available for other active devices.
                </div>
                <div data-testid="continuity-device-list" style={{ marginTop: 6, display: "grid", gap: 8 }}>
                  {continuityStatus.remote.devices.map((device) => {
                    const revokeDisabled = continuityBusy || continuityActionBusyDeviceId !== null
                    const isRevoking = continuityActionBusyDeviceId === device.deviceId
                    return (
                      <div key={device.deviceId} style={{ border: "1px solid var(--astra-border)", borderRadius: 6, padding: "8px 10px", background: device.isCurrentDevice ? "#eef2ff" : "var(--astra-bg-primary)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                          <div>
                            <div style={{ fontWeight: 600, color: "#334155" }}>
                              {device.label}
                              {device.isCurrentDevice ? " · Current device" : ""}
                            </div>
                            <div style={{ fontSize: 12, color: "var(--astra-text-muted)", marginTop: 4 }}>
                              {formatDeviceHostLabel(device)}
                            </div>
                            <div style={{ fontSize: 12, color: "var(--astra-text-muted)", marginTop: 4 }}>
                              {device.status} · Last seen {formatContinuityTimestamp(device.lastSeenAt)} · Last sync {formatContinuityTimestamp(device.lastSyncAt)}
                            </div>
                          </div>
                          {device.isCurrentDevice ? (
                            <span style={{ ...hintStyle, marginTop: 0 }}>Use popup Sign out</span>
                          ) : device.status === "revoked" ? (
                            <span style={{ ...hintStyle, marginTop: 0 }}>Already revoked</span>
                          ) : (
                            <button
                              type="button"
                              className="astra-btn-danger"
                              style={{ whiteSpace: "nowrap" }}
                              onClick={() => onRequestRevokeDevice({ deviceId: device.deviceId, label: device.label })}
                              disabled={revokeDisabled}
                            >
                              {isRevoking ? "Revoking..." : "Revoke access"}
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}
          {continuityStatus?.session.state === "authenticated" && !continuityStatus.remote.available && continuityStatus.remote.error && (
            <div><strong>Remote status:</strong> {continuityStatus.remote.error}</div>
          )}
          {continuityStatus?.session.state === "authenticated" && !continuityStatus.remote.available && !continuityStatus.remote.error && (
            <div><strong>Optional sync:</strong> Refresh continuity status to manage the reading history and study progress toggles.</div>
          )}
          {continuityStatus?.session.state !== "authenticated" && (
            <div><strong>Remote status:</strong> Sign in to inspect registered devices and continuity bootstrap.</div>
          )}
        </div>
      </div>

      <div className="astra-card" style={{ marginTop: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: "var(--astra-text-primary)" }}>
          {t("options_backupTitle")}
        </h3>
        <div style={{ ...hintStyle, marginBottom: 16 }}>
          {t("options_backupHint")}
        </div>

        {backupStatus && (
          <div
            role="status"
            aria-live={backupStatus.type === "error" ? "assertive" : "polite"}
            data-testid="backup-status"
            style={{
              ...successBanner,
              marginBottom: 12,
              ...(backupStatus.type === "error"
                ? { background: "#fef2f2", color: "#dc2626", borderColor: "#fecaca" }
                : {}),
            }}
          >
            {backupStatus.message}
          </div>
        )}

        <div style={{ display: "flex", gap: 12 }}>
          <button
            type="button"
            className="astra-btn-primary"
            data-testid="export-settings-btn"
            onClick={() => void handleExport()}
          >
            {t("options_exportSettings")}
          </button>
          <button
            type="button"
            className="astra-btn-secondary"
            data-testid="import-settings-btn"
            onClick={() => fileInputRef.current?.click()}
          >
            {t("options_importSettings")}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            style={{ display: "none" }}
            data-testid="import-file-input"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleImport(file)
              e.target.value = ""
            }}
          />
        </div>
      </div>
    </div>
  )
}

// --- Main component ---

export default function OptionsApp() {
  const [section, setSection] = useState<Section>("general")
  const [config, setConfig] = useState<AstraConfig>(DEFAULT_ASTRA_CONFIG)
  const [availableVoices, setAvailableVoices] = useState<TTSVoiceOption[]>([])
  const [ttsSupported, setTtsSupported] = useState(false)
  const [loadingVoices, setLoadingVoices] = useState(false)
  const [continuityRemote, setContinuityRemote] = useState<AstraContinuityRemoteSnapshot | null>(null)
  const [continuityStatus, setContinuityStatus] = useState<AstraContinuityStatus | null>(null)
  const [continuitySession, setContinuitySession] = useState<AstraSession | null>(null)
  const [continuityDevice, setContinuityDevice] = useState<AstraDeviceIdentity | null>(null)
  const [continuityBusy, setContinuityBusy] = useState(false)
  const [continuityActionBusyDeviceId, setContinuityActionBusyDeviceId] = useState<string | null>(null)
  const [pendingRevokeDevice, setPendingRevokeDevice] = useState<PendingRevokeDevice | null>(null)
  const [saved, setSaved] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const continuityConfigRef = useRef(config)

  const refreshVoices = useCallback(async (engine?: "browser" | "edge") => {
    const activeEngine = engine ?? config.tts.engine
    const supported = isTtsSupported(activeEngine)
    setTtsSupported(supported)

    if (!supported) {
      setAvailableVoices([])
      return
    }

    setLoadingVoices(true)
    try {
      setAvailableVoices(await listVoices(activeEngine))
    } finally {
      setLoadingVoices(false)
    }
  }, [config.tts.engine])

  useEffect(() => {
    continuityConfigRef.current = config
  }, [config])

  const refreshContinuityState = useCallback(async (
    nextConfig?: AstraConfig,
    options: { forceRemote?: boolean } = {},
  ) => {
    const configForStatus = nextConfig ?? continuityConfigRef.current
    setContinuityBusy(true)
    try {
      const [device, storedSession] = await Promise.all([
        ensureAstraDeviceIdentity(),
        readAstraSession(),
      ])

      let session = storedSession
      let remote: AstraContinuityRemoteSnapshot | null = null

      if (storedSession?.identityMode === "authenticated") {
        try {
          session = await refreshAstraSession({
            baseURL: storedSession.relayBaseURL,
            sessionToken: storedSession.sessionToken,
          })
          session = await saveAstraSession(session)
        } catch (refreshError) {
          const message = refreshError instanceof Error ? refreshError.message : "Failed to refresh continuity status."
          await clearAstraSession()
          session = null
          remote = options.forceRemote ? { error: message } : null
        }

        if (session) {
          try {
            remote = await fetchAstraContinuitySnapshot({
              baseURL: session.relayBaseURL,
              sessionToken: session.sessionToken,
              deviceId: device.deviceId,
              includePull: options.forceRemote,
            })
          } catch (remoteError) {
            remote = {
              error: remoteError instanceof Error ? remoteError.message : "Failed to refresh continuity status.",
            }
          }
        }
      }

      setContinuitySession(session)
      setContinuityDevice(device)
      setContinuityRemote(remote)
      setContinuityStatus(buildContinuityStatus({
        config: configForStatus,
        session,
        device,
        remote,
      }))
    } finally {
      setContinuityBusy(false)
    }
  }, [])

  useEffect(() => {
    void (async () => {
      const loadedConfig = await readConfig()
      setConfig(loadedConfig)
      await refreshContinuityState(loadedConfig)
    })()
    void refreshVoices()
  }, [refreshContinuityState, refreshVoices])

  useEffect(() => {
    if (!continuityDevice) return
    setContinuityStatus(buildContinuityStatus({
      config,
      session: continuitySession,
      device: continuityDevice,
      remote: continuityRemote,
    }))
  }, [config, continuityDevice, continuityRemote, continuitySession])

  const updateConfig = (patch: Partial<AstraConfig>) => {
    setDirty(true)
    setSaved(false)
    setConfig((current) => ({ ...current, ...patch }))
  }

  const handleToggleOptionalCollectionSync = useCallback(async (
    collection: "reading_history" | "study_progress",
    enabled: boolean,
  ) => {
    if (!continuitySession || !continuityDevice) return

    setError(null)
    setContinuityBusy(true)
    try {
      await updateAstraSyncCollectionPreference({
        baseURL: continuitySession.relayBaseURL,
        sessionToken: continuitySession.sessionToken,
        deviceId: continuityDevice.deviceId,
        collection,
        enabled,
      })

      if (enabled) {
        await runPhaseOneCollectionSync()
      }

      await refreshContinuityState(undefined, { forceRemote: true })
    } catch (err) {
      const fallbackMessage = collection === "study_progress"
        ? "Failed to update study progress continuity."
        : "Failed to update reading history continuity."
      setError(err instanceof Error ? err.message : fallbackMessage)
    } finally {
      setContinuityBusy(false)
    }
  }, [continuityDevice, continuitySession, refreshContinuityState])

  const handleToggleReadingHistorySync = useCallback(async (enabled: boolean) => {
    await handleToggleOptionalCollectionSync("reading_history", enabled)
  }, [handleToggleOptionalCollectionSync])

  const handleToggleStudyProgressSync = useCallback(async (enabled: boolean) => {
    await handleToggleOptionalCollectionSync("study_progress", enabled)
  }, [handleToggleOptionalCollectionSync])

  const requestRevokeContinuityDevice = useCallback((device: PendingRevokeDevice) => {
    if (continuityBusy || continuityActionBusyDeviceId !== null) return
    setPendingRevokeDevice(device)
  }, [continuityActionBusyDeviceId, continuityBusy])

  const executeRevokeContinuityDevice = useCallback(async (targetDeviceId: string) => {
    if (!continuitySession || !continuityDevice) {
      setPendingRevokeDevice(null)
      return
    }
    if (targetDeviceId === continuityDevice.deviceId) {
      setError("Use popup Sign out for the current device instead of remote revoke.")
      setPendingRevokeDevice(null)
      return
    }

    setError(null)
    setContinuityActionBusyDeviceId(targetDeviceId)
    try {
      const devices = await revokeAstraDevice({
        baseURL: continuitySession.relayBaseURL,
        sessionToken: continuitySession.sessionToken,
        deviceId: continuityDevice.deviceId,
        targetDeviceId,
      })
      setContinuityRemote((current) => current ? { ...current, devices } : { devices })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke device access.")
    } finally {
      setContinuityActionBusyDeviceId(null)
      setPendingRevokeDevice(null)
    }
  }, [continuityDevice, continuitySession])

  const handleCancelRevokeContinuityDevice = useCallback(() => {
    if (continuityActionBusyDeviceId !== null) return
    setPendingRevokeDevice(null)
  }, [continuityActionBusyDeviceId])

  const handleConfirmRevokeContinuityDevice = useCallback(() => {
    if (!pendingRevokeDevice || continuityBusy || continuityActionBusyDeviceId !== null) return
    void executeRevokeContinuityDevice(pendingRevokeDevice.deviceId)
  }, [continuityActionBusyDeviceId, continuityBusy, executeRevokeContinuityDevice, pendingRevokeDevice])

  const updateProvider = (patch: Partial<AstraConfig["provider"]>) => {
    setDirty(true)
    setSaved(false)
    setConfig((current) => ({
      ...current,
      provider: { ...current.provider, ...patch },
    }))
  }

  const updatePresentation = (patch: Partial<AstraConfig["presentation"]>) => {
    setDirty(true)
    setSaved(false)
    setConfig((current) => ({
      ...current,
      presentation: { ...current.presentation, ...patch },
    }))
  }

  const updateTts = (patch: Partial<AstraConfig["tts"]>) => {
    setDirty(true)
    setSaved(false)
    setConfig((current) => ({
      ...current,
      tts: {
        ...current.tts,
        ...patch,
        ...(patch.voiceName !== undefined
          ? { voiceName: patch.voiceName.trim() || undefined }
          : {}),
      },
    }))
    if (patch.engine) {
      void refreshVoices(patch.engine)
    }
  }

  const handleSave = async () => {
    try {
      setError(null)
      const nextConfig = await saveConfig({
        targetLang: config.targetLang,
        hoverTrigger: config.hoverTrigger,
        contentScope: config.contentScope,
        inputTranslation: config.inputTranslation,
        languageLevel: config.languageLevel,
        privacyMode: config.privacyMode,
        provider: {
          id: config.provider.id,
          relayBaseURL: config.provider.relayBaseURL ?? "",
          model: config.provider.model,
          apiKey: config.provider.apiKey,
        },
        tts: config.tts,
        presentation: config.presentation,
        sites: config.sites,
        customActions: config.customActions,
      })
      setConfig(nextConfig)
      setDirty(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings")
    }
  }

  const renderSection = () => {
    switch (section) {
      case "general":
        return (
          <GeneralSection
            config={config}
            onChange={updateConfig}
            onTtsChange={updateTts}
            availableVoices={availableVoices}
            loadingVoices={loadingVoices}
            ttsSupported={ttsSupported}
            onRefreshVoices={() => void refreshVoices()}
          />
        )
      case "providers":
        return <ProvidersSection config={config} onProviderChange={updateProvider} />
      case "translation":
        return <TranslationSection config={config} onPresentationChange={updatePresentation} />
      case "actions":
        return <ActionsSection config={config} onChange={updateConfig} />
      case "sites":
        return <SitesSection config={config} onChange={updateConfig} />
      case "vocabulary":
        return <VocabularySection />
      case "diagnostics":
        return <DiagnosticsSection config={config} />
      case "about":
        return (
          <AboutSection
            continuityStatus={continuityStatus}
            continuityBusy={continuityBusy}
            continuityActionBusyDeviceId={continuityActionBusyDeviceId}
            onRefreshContinuity={() => {
              void refreshContinuityState(undefined, { forceRemote: true })
            }}
            onRequestRevokeDevice={requestRevokeContinuityDevice}
            onToggleReadingHistorySync={(enabled) => {
              void handleToggleReadingHistorySync(enabled)
            }}
            onToggleStudyProgressSync={(enabled) => {
              void handleToggleStudyProgressSync(enabled)
            }}
          />
        )
    }
  }

  const viewport = useViewportProfile()
  const isMobile = viewport.isCompact

  return (
    <div style={{
      ...pageStyle,
      flexDirection: isMobile ? "column" : "row",
    }}
    >
      <nav style={isMobile
        ? {
            display: "flex",
            overflowX: "auto",
            background: "var(--astra-bg-card)",
            borderBottom: "1px solid var(--astra-border)",
            padding: "8px 12px",
            gap: 4,
            position: "sticky",
            top: 0,
            zIndex: 10,
          }
        : sidebarStyle}
      >
        {!isMobile && <div style={logoStyle}>Astra</div>}
        {NAV_ITEMS.map((item) => (
          <button
            type="button"
            key={item.key}
            className={isMobile ? "astra-nav-item-mobile" : "astra-nav-item"}
            aria-current={section === item.key ? "page" : undefined}
            onClick={() => setSection(item.key)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <main
        className="astra-container astra-container--medium"
        style={{
          ...contentStyle,
          padding: isMobile ? "16px 12px" : contentStyle.padding,
        }}
      >
        {saved && <Toast variant="success">Settings saved.</Toast>}
        {error && <Toast variant="error">{error}</Toast>}

        {renderSection()}

        {section !== "vocabulary" && section !== "about" && section !== "diagnostics" && (
          <div style={{ marginTop: 24, display: "flex", gap: 12, alignItems: "center" }}>
            <button
              type="button"
              className="astra-btn-primary"
              style={{ opacity: dirty ? 1 : 0.6 }}
              onClick={() => void handleSave()}
            >
              Save settings
            </button>
            {dirty && <span style={{ fontSize: 12, color: "var(--astra-text-hint)" }}>Unsaved changes</span>}
          </div>
        )}
      </main>

      {pendingRevokeDevice && (
        <RevokeDeviceConfirmDialog
          deviceLabel={pendingRevokeDevice.label}
          busy={continuityBusy || continuityActionBusyDeviceId !== null}
          onCancel={handleCancelRevokeContinuityDevice}
          onConfirm={handleConfirmRevokeContinuityDevice}
        />
      )}
    </div>
  )
}
