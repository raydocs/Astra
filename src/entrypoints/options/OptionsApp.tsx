import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { browser } from "#imports"
import { Toast, ToastViewport } from "@/components/Toast"
import type {
  AstraConfig,
  ContentScope,
  CustomAction,
  HoverTrigger,
  InputTranslation,
  SiteConfig,
  TTSSettings,
  TranslationMode,
  TranslationTheme,
} from "@/types/config"
import type { AstraDeviceIdentity, AstraSession } from "@/types/auth"
import {
  DEFAULT_ASTRA_CONFIG,
  isDefaultSiteConfig,
  normalizeSiteKey,
  resolveTranslationSurfaceMode,
} from "@/types/config"
import { readConfig, saveConfig } from "@/utils/storage/config"
import { forgetRememberedTerm, readLearningProfile, updateLearningProfile, type LearningProfile, type LearningProfileGoal } from "@/utils/storage/learning-profile"
import { clearAstraSession, ensureAstraDeviceIdentity, readAstraSession, saveAstraSession } from "@/utils/storage/auth"
import { refreshAstraSession } from "@/utils/astra/auth"
import { fetchAstraContinuitySnapshot, revokeAstraDevice, updateAstraSyncCollectionPreference } from "@/utils/astra/account"
import { submitAstraCancellationReason, submitAstraSupportReport } from "@/utils/astra/support"
import { ASTRA_CANCELLATION_REASON_OPTIONS, buildAstraCancellationReasonSubmission, type AstraCancellationReason } from "@/utils/cancellation-reasons"
import { buildContinuityStatus, exportConfig, importConfig, downloadConfigFile, readConfigFile, runPhaseOneCollectionSync, type AstraContinuityRemoteSnapshot, type AstraContinuityStatus } from "@/utils/storage/config-sync"
import { exportSiteRules, importSiteRules } from "@/utils/storage/site-rules"
import { clearTranslationCache, getCacheStats } from "@/utils/cache/translation-cache"
import { buildLearningDataExport, stringifyLearningDataExport } from "@/utils/storage/learning-data-export"
import { buildLearningMemoryInventory, type LearningMemoryInventory } from "@/utils/storage/learning-memory"
import { buildSupportBundle, describeKnownIssueForUser, describeSupportBundle, type SupportBundleFeatureSurface, type SupportBundleIssueCategory } from "@/utils/support-bundle"
import { refreshRemoteFeatureFlagRuntime } from "@/utils/feature-flags"
import {
  aggregateLearningLoopActivationDashboard,
  aggregateLearningLoopFunnel,
  aggregateLearningLoopLearningDashboard,
  aggregateLearningLoopRetentionDashboard,
  aggregateLearningLoopUpgradePromptDashboard,
  getLearningLoopCopyVariantAutoSelectionStatus,
  LEARNING_LOOP_EVENT_NAMES,
  recordLearningLoopEvent,
  type LearningLoopActivationDashboard,
  type LearningLoopCopyVariantAutoSelectionStatus,
  type LearningLoopEventName,
  type LearningLoopFunnelAggregation,
  type LearningLoopLearningDashboard,
  type LearningLoopRetentionDashboard,
  type LearningLoopUpgradePromptDashboard,
} from "@/utils/learning-loop-events"
import { getRecentEvents, type TelemetryEvent } from "@/utils/telemetry"
import { isTtsSupported, listVoices, type TTSVoiceOption } from "@/utils/tts"
import { useViewportProfile } from "@/utils/ui/useViewportProfile"
import { useAstraTheme } from "@/utils/ui/useAstraTheme"
import { t } from "@/utils/i18n"
import { getSafeAiUnavailableCopy, getServiceModeLabel } from "@/utils/copy-dictionary"
import {
  isOptionsAdvancedEnabled,
  sanitizeRequestedSection,
  SECTION_META,
  visibleNavGroups,
  visibleNavItems,
  type Section,
} from "./option-sections"

// Section model + the zero-config advanced gate live in ./option-sections
// (pure + unit-testable). Imported at the top of this file.

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
  { value: "immersive", label: "Immersive page" },
  { value: "full_page", label: "Full page" },
  { value: "article", label: "Article only" },
] as const

function getContentScopeSelectValue(scope: ContentScope): Exclude<ContentScope, "page"> {
  return scope === "page" ? "immersive" : scope
}

function formatContentScopeLabel(scope: ContentScope): string {
  switch (resolveTranslationSurfaceMode(scope)) {
    case "article":
      return "Article area only"
    case "full_page":
      return "Full page including navigation and footer"
    case "immersive":
      return "Immersive page"
  }
}

function getSafeSettingsSaveError(error: unknown): string {
  const fallbackCopy = error instanceof Error
    ? error.message.trim()
    : typeof error === "string"
      ? error.trim()
      : ""

  return getSafeAiUnavailableCopy(
    { code: "UNKNOWN", message: fallbackCopy || "Settings update failed" },
    { fallbackCopy: fallbackCopy || "Astra could not update settings right now." },
  )
}

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

const LEARNING_GOAL_OPTIONS: Array<{ value: LearningProfileGoal; label: string }> = [
  { value: "read_articles_docs", label: "Read articles and docs" },
  { value: "watch_tutorials", label: "Watch videos" },
  { value: "save_expressions", label: "Save useful expressions" },
  { value: "work_study", label: "Work or study" },
  { value: "exam_prep", label: "Exam prep" },
  { value: "interest_reading", label: "Interest reading" },
  { value: "build_vocabulary", label: "Build vocabulary" },
]

const SERVICE_MODE_OPTIONS: Array<{
  value: AstraConfig["serviceMode"]
  label: string
  hint: string
}> = [
  { value: "automatic", label: getServiceModeLabel("automatic"), hint: "Recommended. Astra decides whether speed or precision matters more for each task." },
  { value: "fast", label: getServiceModeLabel("fast"), hint: "Prioritizes quick page reading and everyday browsing." },
  { value: "balanced", label: getServiceModeLabel("balanced"), hint: "Keeps normal reading quick while staying careful for explanations." },
  { value: "best_quality", label: getServiceModeLabel("best_quality"), hint: "Uses the most careful service path for harder content and study work." },
]

const BRAND_COLOR = "var(--astra-brand)"

function detectBrowserLabel(): string {
  if (typeof navigator === "undefined") return "Unknown browser"
  const ua = navigator.userAgent
  if (ua.includes("Firefox/")) return `Firefox ${ua.split("Firefox/")[1]?.split(" ")[0] ?? ""}`.trim()
  if (ua.includes("Edg/")) return `Edge ${ua.split("Edg/")[1]?.split(" ")[0] ?? ""}`.trim()
  if (ua.includes("Chrome/")) return `Chrome ${ua.split("Chrome/")[1]?.split(" ")[0] ?? ""}`.trim()
  if (ua.includes("Safari/")) return "Safari"
  return "Unknown browser"
}

function detectOsLabel(): string {
  if (typeof navigator === "undefined") return "Unknown OS"
  const platform = navigator.platform || navigator.userAgent
  if (/Mac/i.test(platform)) return "macOS"
  if (/Win/i.test(platform)) return "Windows"
  if (/Linux/i.test(platform)) return "Linux"
  if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) return "iOS"
  if (/Android/i.test(navigator.userAgent)) return "Android"
  return "Unknown OS"
}

function getInitialOptionsSection(): Section {
  if (typeof window === "undefined") return "translation"
  try {
    const advanced = isOptionsAdvancedEnabled(window.location.search)
    const candidate = new URLSearchParams(window.location.search).get("section")
    // Advanced-only sections (provider/model controls) are never opened from a
    // deep link unless the explicit advanced flag is also present.
    return sanitizeRequestedSection(candidate, advanced)
  } catch {
    return "translation"
  }
}

function SectionHeader({
  eyebrow,
  headline,
  intro,
}: {
  eyebrow: string
  headline: string
  intro?: React.ReactNode
}) {
  return (
    <header className="astra-settings-section-header">
      <div className="astra-settings-eyebrow">{eyebrow}</div>
      <h1 className="astra-settings-headline">{headline}</h1>
      {intro && <p className="astra-settings-intro">{intro}</p>}
    </header>
  )
}

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
    case "extension_installed":
      return "Extension installed"
    case "onboarding_started":
      return "Onboarding started"
    case "sample_started":
      return "Sample lesson started"
    case "first_value_seen":
      return "First value seen"
    case "popup_primer_viewed":
      return "Popup primer viewed"
    case "popup_primer_cta_clicked":
      return "Popup primer CTA clicked"
    case "first_content_understood":
      return "First content understood"
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
    case "result_feedback_submitted":
      return "Result feedback submitted"
    case "saved_snippet_created":
      return "Saved snippet created"
    case "review_opened":
      return "Review opened"
    case "review_answered":
      return t("options_learningLoopEventReviewAnswered")
    case "review_session_completed":
      return "Review session completed"
    case "library_opened":
      return "Library opened"
    case "returned_to_source":
      return t("options_learningLoopEventReturnedToSource")
    case "return_to_source_clicked":
      return "Return to source clicked"
    case "continue_clicked":
      return "Continue clicked"
    case "resumed_reading":
      return t("options_learningLoopEventResumedReading")
    case "digest_viewed":
      return "Digest viewed"
    case "digest_opened":
      return "Digest opened"
    case "reminder_dismissed":
      return "Reminder dismissed"
    case "reminder_disabled":
      return "Reminder disabled"
    case "winback_sent":
      return "Win-back sent"
    case "paywall_viewed":
      return "Upgrade prompt viewed"
    case "trial_started":
      return "Trial started"
    case "pro_value_seen":
      return "Pro value seen"
    case "membership_activated":
      return "Membership activated"
    case "support_report_submitted":
      return "Support report submitted"
    case "known_issue_viewed":
      return "Known issue viewed"
    case "cancellation_reason_submitted":
      return "Cancellation reason submitted"
    case "share_card_created":
      return "Share card created"
    case "referral_sent":
      return "Referral invite sent"
    case "referral_converted":
      return "Referral converted"
    case "landing_visited":
      return "Growth landing visited"
    case "landing_install_clicked":
      return "Landing install clicked"
    case "variant_assigned":
      return "Experiment variant assigned"
    case "conversion_event":
      return "Experiment conversion event"
    case "guardrail_metric":
      return "Experiment guardrail metric"
  }
}

function formatLearningLoopFunnelRate(value: number | null): string {
  return value == null ? "n/a" : `${Math.round(value * 100)}%`
}

function formatLearningLoopDurationSeconds(value: number | null): string {
  if (value == null) return "n/a"
  if (value < 60) return `${Math.round(value)}s`
  const minutes = Math.floor(value / 60)
  const seconds = Math.round(value % 60)
  return `${minutes}m ${seconds}s`
}

function formatLearningLoopDashboardStatus(value: number | null, target: number, direction: "at_least" | "below"): string {
  if (value == null) return "needs data"
  const passes = direction === "at_least" ? value >= target : value < target
  return passes ? "on target" : "watch"
}

function formatLearningLoopSourceMix(dashboard: LearningLoopLearningDashboard): string {
  if (dashboard.savedBySourceType.length === 0) return "none yet"
  return dashboard.savedBySourceType
    .slice(0, 3)
    .map((entry) => `${entry.sourceType} ${entry.count}`)
    .join(" · ")
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

function formatServiceModeLabel(serviceMode: AstraConfig["serviceMode"]): string {
  return `Managed · ${getServiceModeLabel(serviceMode)}`
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
// pageStyle / sidebarStyle / logoStyle / contentStyle / navBtnBase / sectionTitle
// were removed when the Options surface migrated to the Quiet Reader shell
// (.astra-settings-* in src/assets/astra-extension.css). Inline styles below
// are kept only for narrow per-field tweaks that don't yet have a token class.

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
  learningProfile,
  learningMemoryInventory,
  onLearningProfileChange,
  onForgetRememberedTerm,
  onNavigate,
}: {
  config: AstraConfig
  onChange: (patch: Partial<AstraConfig>) => void
  onTtsChange: (patch: Partial<TTSSettings>) => void
  availableVoices: TTSVoiceOption[]
  loadingVoices: boolean
  ttsSupported: boolean
  onRefreshVoices: () => void
  learningProfile: LearningProfile | null
  learningMemoryInventory: LearningMemoryInventory | null
  onLearningProfileChange: (patch: Partial<LearningProfile>) => void
  onForgetRememberedTerm: (termId: string) => void
  onNavigate: (section: Section) => void
}) {
  const savedVoiceMissing = !!config.tts.voiceName
    && !availableVoices.some((voice) => voice.name === config.tts.voiceName)

  return (
    <div className="astra-settings-section">
      <SectionHeader
        eyebrow="Account · General"
        headline="The everyday voice of Astra"
        intro="Pick the language Astra translates into, how chatty its explanations are, and how it speaks aloud when you ask."
      />

      <h2 className="astra-section-heading astra-sr-only">General</h2>

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

      <div className="astra-card" data-testid="learning-profile-controls" style={{ marginBottom: 20 }}>
        <h3 className="astra-section-subheading">Personalization memory</h3>
        <div style={{ ...hintStyle, marginBottom: 12 }}>
          Astra uses only lightweight preferences you can review or undo: your goal, daily target, excluded sites, and remembered terms.
        </div>

        <div style={fieldGroup}>
          <label htmlFor="options-learning-profile-goal" style={labelStyle}>Learning goal</label>
          <select
            id="options-learning-profile-goal"
            className="astra-input"
            value={learningProfile?.primaryGoal ?? "read_articles_docs"}
            onChange={(e) => onLearningProfileChange({ primaryGoal: e.target.value as LearningProfileGoal })}
          >
            {LEARNING_GOAL_OPTIONS.map((goal) => (
              <option key={goal.value} value={goal.value}>{goal.label}</option>
            ))}
          </select>
        </div>

        <div style={fieldGroup}>
          <label htmlFor="options-learning-profile-daily-goal" style={labelStyle}>Daily study target</label>
          <input
            id="options-learning-profile-daily-goal"
            className="astra-input"
            type="number"
            min={1}
            max={60}
            value={learningProfile?.dailyGoalMinutes ?? 5}
            onChange={(e) => onLearningProfileChange({ dailyGoalMinutes: Number(e.target.value) })}
          />
          <div style={hintStyle}>Minutes per day. Astra keeps this lightweight by default.</div>
        </div>

        <div style={checkboxRow}>
          <input
            type="checkbox"
            id="options-learning-profile-enabled"
            checked={learningProfile?.personalizationEnabled ?? true}
            onChange={(e) => onLearningProfileChange({ personalizationEnabled: e.target.checked })}
          />
          <label htmlFor="options-learning-profile-enabled" style={{ fontSize: 14, color: "var(--astra-text-secondary)" }}>
            Let Astra adapt explanations and review suggestions from my learning profile
          </label>
        </div>

        <div data-testid="learning-profile-remembered-terms" style={{ ...hintStyle, marginTop: 10 }}>
          Remembered terms: {learningProfile?.rememberedTerms.length ?? 0}
        </div>

        <div data-testid="learning-memory-inventory" style={{ border: "1px solid var(--astra-border)", borderRadius: 12, padding: 12, marginTop: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--astra-text-primary)", marginBottom: 6 }}>What Astra remembers</div>
          <div style={{ ...hintStyle, marginBottom: 8 }}>
            Astra keeps learning memory visible and reversible. This summary uses counts and categories, not page text, transcripts, prompts, model output, or full URL paths.
          </div>
          {learningMemoryInventory ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
              {learningMemoryInventory.sections.map((section) => (
                <div key={section.id} style={{ border: "1px solid var(--astra-border)", borderRadius: 10, padding: "8px 10px" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--astra-text-primary)" }}>{section.label}</div>
                  <div style={{ fontSize: 12, color: "var(--astra-text-secondary)" }}>{section.count} item{section.count === 1 ? "" : "s"}</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={hintStyle}>Memory summary will appear after Astra reads your local learning data.</div>
          )}
          <div style={{ ...hintStyle, marginTop: 8 }}>
            {learningMemoryInventory?.privacyModeEffect ?? "Privacy Mode reduces automatic memory updates when enabled."}
          </div>
        </div>

        {(learningProfile?.rememberedTerms ?? []).slice(0, 5).map((term) => (
          <div key={term.id} style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between", border: "1px solid var(--astra-border)", borderRadius: 10, padding: "8px 10px", marginTop: 8 }}>
            <span style={{ fontSize: 12, color: "var(--astra-text-secondary)" }}>
              {term.sourceTerm} → {term.preferredTerm}{term.hostname ? ` · ${term.hostname}` : ""}
            </span>
            <button
              type="button"
              className="astra-btn-secondary"
              data-testid={`forget-remembered-term-${term.id}`}
              onClick={() => onForgetRememberedTerm(term.id)}
            >
              Forget
            </button>
          </div>
        ))}
        {(learningProfile?.excludedHostnames.length ?? 0) > 0 && (
          <div data-testid="learning-profile-excluded-sites" style={{ ...hintStyle, marginTop: 10 }}>
            Not learning preferences on: {learningProfile?.excludedHostnames.join(", ")}
          </div>
        )}
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
          value={getContentScopeSelectValue(config.contentScope)}
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
        When enabled, Astra reduces page context and automatic learning-memory updates for sensitive moments. It is not a local-only guarantee: requested translation text may still be sent to managed AI services.
      </div>

      <div className="astra-card" data-testid="privacy-data-controls-card" style={{ marginBottom: 20 }}>
        <h3 className="astra-section-subheading">Privacy & data controls</h3>
        <div style={{ ...hintStyle, marginBottom: 12 }}>
          Astra keeps saved learning data user-controlled: export it, delete saved items and source records, disable sync for sources, or follow the account-deletion help path. Support reports stay metadata-only by default.
        </div>
        <ul style={{ ...hintStyle, margin: "0 0 12px 18px", padding: 0 }}>
          <li>Export learning data from Vocabulary as JSON; full webpages and full transcripts are not intentionally included.</li>
          <li>Delete saved words, sentences, source records, and related review cards from the Library controls.</li>
          <li>For account data deletion, open Help &amp; privacy to send a metadata-only account request until self-serve deletion ships.</li>
        </ul>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="astra-btn-secondary" data-testid="privacy-export-learning-data-link" onClick={() => onNavigate("vocabulary")}>
            Export learning data
          </button>
          <button type="button" className="astra-btn-secondary" data-testid="privacy-delete-learning-data-link" onClick={() => onNavigate("vocabulary")}>
            Manage saved learning data
          </button>
          <button type="button" className="astra-btn-secondary" data-testid="privacy-account-delete-help-link" onClick={() => onNavigate("diagnostics")}>
            Account deletion help
          </button>
        </div>
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
            <option value="browser">Browser speech</option>
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
  onConfigChange,
}: {
  config: AstraConfig
  onConfigChange: (patch: Partial<AstraConfig>) => void
}) {
  const selectedMode = SERVICE_MODE_OPTIONS.find((option) => option.value === config.serviceMode)
    ?? SERVICE_MODE_OPTIONS[0]

  return (
    <div className="astra-settings-section">
      <SectionHeader
        eyebrow="Astra AI · managed service"
        headline="Astra chooses the best path automatically"
        intro="Customers do not need to understand AI settings. Astra balances speed, accuracy, reliability, and cost behind the scenes."
      />

      <h2 className="astra-section-heading astra-sr-only">Astra AI</h2>

      <div className="astra-group-card astra-group-card--padded" style={{ marginBottom: "var(--astra-space-5)", display: "grid", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
          <div>
            <div className="astra-quiet-eyebrow">Default experience</div>
            <div style={{ fontSize: 18, lineHeight: 1.25, fontWeight: 800, color: "var(--astra-text-primary)", marginTop: 3 }}>
              Zero setup. Just sign in and read.
            </div>
          </div>
          <span className="astra-settings-pill">Astra Managed</span>
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.55, color: "var(--astra-text-secondary)" }}>
          During the free public beta, Astra includes translation, explanation, and learning assistance without technical setup. Astra automatically switches between faster and more accurate service paths depending on the page and task.
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          <div className="astra-settings-row" style={{ margin: 0 }}>
            <div className="astra-settings-row__body">
              <p className="astra-settings-row__title">{selectedMode.label} service</p>
              <p className="astra-settings-row__hint">{selectedMode.hint}</p>
            </div>
            <span className="astra-settings-pill">No setup</span>
          </div>
          <div className="astra-settings-row" style={{ margin: 0 }}>
            <div className="astra-settings-row__body">
              <p className="astra-settings-row__title">Quality upgrades happen in the background</p>
              <p className="astra-settings-row__hint">Long articles, hard sentences, and learning cards can use a more precise path without asking the user to choose.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="astra-group-card astra-group-card--padded" style={{ display: "grid", gap: 12 }}>
        <div>
          <div className="astra-quiet-eyebrow">Service preference</div>
          <div style={{ fontSize: 16, lineHeight: 1.3, fontWeight: 800, color: "var(--astra-text-primary)", marginTop: 3 }}>
            Choose a simple reading style — not technical setup.
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.55, color: "var(--astra-text-secondary)", marginTop: 6 }}>
            Astra still handles the technical choices, retries, and upgrades for you. This only tells Astra what kind of experience you prefer.
          </div>
        </div>
        <div className="astra-settings-rows" style={{ gap: 8 }}>
          {SERVICE_MODE_OPTIONS.map((option) => {
            const checked = config.serviceMode === option.value
            return (
              <button
                key={option.value}
                type="button"
                className="astra-settings-row"
                aria-pressed={checked}
                onClick={() => onConfigChange({ serviceMode: option.value })}
                style={{
                  margin: 0,
                  textAlign: "left",
                  borderColor: checked ? "var(--astra-accent-primary)" : undefined,
                  background: checked ? "color-mix(in srgb, var(--astra-accent-primary) 8%, var(--astra-surface))" : undefined,
                  cursor: "pointer",
                }}
              >
                <div className="astra-settings-row__body">
                  <p className="astra-settings-row__title">{option.label}</p>
                  <p className="astra-settings-row__hint">{option.hint}</p>
                </div>
                {checked && <span className="astra-settings-pill">Selected</span>}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function TranslationSection({
  config,
  onPresentationChange,
  onConfigChange,
}: {
  config: AstraConfig
  onPresentationChange: (patch: Partial<AstraConfig["presentation"]>) => void
  onConfigChange: (patch: Partial<AstraConfig>) => void
}) {
  const previewSource = "The afternoon light slipped between the columns and rested on the open page."
  const previewTarget = "下午的光线从立柱之间穿过，停在翻开的书页上。"

  return (
    <div className="astra-settings-section">
      <SectionHeader
        eyebrow="Reading · Translation"
        headline="How Astra translates the page"
        intro="Quiet reading controls that keep the source visible while Astra adds an alternate reading. There is no model or API key to set up — Astra automatically picks the right speed and quality for each page. Every control here also accepts per-site overrides under Sites."
      />

      <div className="astra-settings-rows">
        <div className="astra-settings-row">
          <div className="astra-settings-row__body">
            <p className="astra-settings-row__title">Translation mode</p>
            <p className="astra-settings-row__hint">Bilingual keeps source paragraphs visible. Translation only quietly replaces them.</p>
          </div>
          <div className="astra-settings-row__control">
            <label htmlFor="options-translation-mode" className="astra-sr-only">Translation mode</label>
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
        </div>

        <div className="astra-settings-row">
          <div className="astra-settings-row__body">
            <p className="astra-settings-row__title">Translate range</p>
            <p className="astra-settings-row__hint">"Article only" skips navigation, sidebars, and footers so the page chrome stays untouched.</p>
          </div>
          <div className="astra-settings-row__control">
            <label htmlFor="options-translation-range" className="astra-sr-only">Translate range</label>
            <select
              id="options-translation-range"
              className="astra-input"
                value={getContentScopeSelectValue(config.contentScope)}
              onChange={(e) => onConfigChange({ contentScope: e.target.value as ContentScope })}
            >
              {CONTENT_SCOPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="astra-settings-row astra-settings-row--stack">
          <div className="astra-settings-row__body">
            <p className="astra-settings-row__title">Display style</p>
            <p className="astra-settings-row__hint">Pick how the translated paragraph anchors itself to the source. Live preview updates below.</p>
          </div>
          <div className="astra-settings-row__control astra-settings-row__control--wide">
            <div className="astra-settings-segmented" role="group" aria-label="Display style">
              {THEME_OPTIONS.map((o) => (
                <button
                  type="button"
                  key={o.value}
                  className="astra-settings-segmented__option"
                  aria-pressed={config.presentation.theme === o.value}
                  onClick={() => onPresentationChange({ theme: o.value as TranslationTheme })}
                >
                  {o.label.replace(" (border)", "")}
                </button>
              ))}
            </div>
          </div>
          <div
            className="astra-settings-preview"
            data-theme={config.presentation.theme}
            aria-hidden="true"
          >
            <p className="astra-settings-preview__source">{previewSource}</p>
            <p
              className="astra-settings-preview__target"
              style={{
                color: config.presentation.translationColor || undefined,
                fontSize: `${(config.presentation.fontSize ?? 1) * 14.5}px`,
              }}
            >
              {previewTarget}
            </p>
          </div>
        </div>

        <div className="astra-settings-row">
          <div className="astra-settings-row__body">
            <p className="astra-settings-row__title">Font size</p>
            <p className="astra-settings-row__hint">Multiplier on the source paragraph's own type size. 1.0 keeps Astra in line with the page.</p>
          </div>
          <div className="astra-settings-row__control">
            <label htmlFor="options-translation-font-size" className="astra-sr-only">Font size (em)</label>
            <input
              id="options-translation-font-size"
              type="number"
              step="0.05"
              min="0.5"
              max="2.0"
              className="astra-input"
              style={{ minWidth: 0, width: 120 }}
              value={config.presentation.fontSize}
              onChange={(e) => {
                const value = parseFloat(e.target.value)
                if (!Number.isNaN(value)) {
                  onPresentationChange({ fontSize: Math.max(0.5, Math.min(2.0, value)) })
                }
              }}
            />
          </div>
        </div>

        <div className="astra-settings-row">
          <div className="astra-settings-row__body">
            <p className="astra-settings-row__title">Translation color</p>
            <p className="astra-settings-row__hint">The ink Astra uses for the translated line. Tap the swatch to pick or paste any hex.</p>
          </div>
          <div className="astra-settings-row__control">
            <label htmlFor="options-translation-color-picker" className="astra-sr-only">Translation color</label>
            <input
              id="options-translation-color-picker"
              type="color"
              className="astra-color-picker"
              value={config.presentation.translationColor}
              onChange={(e) => onPresentationChange({ translationColor: e.target.value })}
              style={{ width: 36, height: 30, border: "1px solid var(--astra-border)", borderRadius: 4, padding: 2 }}
            />
            <input
              id="options-translation-color-input"
              className="astra-input"
              style={{ width: 130, minWidth: 0 }}
              value={config.presentation.translationColor}
              onChange={(e) => onPresentationChange({ translationColor: e.target.value })}
              placeholder="#1f4e7a"
              aria-label="Translation color hex value"
            />
          </div>
        </div>

        <div className="astra-settings-row">
          <div className="astra-settings-row__body">
            <p className="astra-settings-row__title">Page translation shortcut</p>
            <p className="astra-settings-row__hint">Toggles the whole-page translation overlay. Customise the binding in your browser's keyboard shortcut settings.</p>
          </div>
          <div className="astra-settings-row__control">
            <kbd className="astra-settings-kbd">⌘</kbd>
            <kbd className="astra-settings-kbd">⇧</kbd>
            <kbd className="astra-settings-kbd">T</kbd>
          </div>
        </div>

        <div className="astra-settings-row">
          <div className="astra-settings-row__body">
            <p className="astra-settings-row__title">Hover to translate</p>
            <p className="astra-settings-row__hint">Hold Alt and hover any paragraph to translate it in place — or always-on for slower reads.</p>
          </div>
          <div className="astra-settings-row__control">
            <label htmlFor="options-translation-hover-trigger" className="astra-sr-only">Hover trigger</label>
            <select
              id="options-translation-hover-trigger"
              className="astra-input"
              value={config.hoverTrigger}
              onChange={(e) => onConfigChange({ hoverTrigger: e.target.value as HoverTrigger })}
            >
              {HOVER_TRIGGER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="astra-settings-row">
          <div className="astra-settings-row__body">
            <p className="astra-settings-row__title">AI smart context</p>
            <p className="astra-settings-row__hint">Let Astra include nearby paragraphs so ambiguous pronouns, terms, and tone are handled more accurately.</p>
          </div>
          <div className="astra-settings-row__control">
            <span className="astra-settings-toggle">
              <input
                id="options-translation-input"
                type="checkbox"
                checked={config.inputTranslation === "enabled"}
                onChange={(e) => onConfigChange({ inputTranslation: e.target.checked ? "enabled" : "disabled" })}
                aria-label="AI smart context"
              />
              <span className="astra-settings-toggle__track" aria-hidden="true" />
            </span>
          </div>
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
    <div className="astra-settings-section">
      <SectionHeader
        eyebrow="Reading · Sites & rules"
        headline="Tune Astra per site"
        intro="Per-site rules override global settings — pick which sites get auto-translation, choose a reading style, or keep specific selectors out of the reading flow."
      />

      <h2 className="astra-section-heading astra-sr-only">Sites</h2>
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
                  value={siteConfig.contentScope ? getContentScopeSelectValue(siteConfig.contentScope) : ""}
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
    <div className="astra-settings-section">
      <SectionHeader
        eyebrow="Reading · Custom actions"
        headline="Your own gestures on the page"
        intro="Custom actions appear in the selection toolbar alongside built-in ones. Use {{text}} and {{targetLang}} as placeholders in your prompt template."
      />

      <h2 className="astra-section-heading astra-sr-only">Custom Actions</h2>
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
  const [learningExportStatus, setLearningExportStatus] = useState<{ type: "success" | "error"; message: string } | null>(null)

  const refreshCacheInfo = async () => {
    try {
      const [bytes, stats] = await Promise.all([
        browser.storage.local.getBytesInUse?.(),
        getCacheStats(),
      ])
      const localStorageUsage = typeof bytes === "number"
        ? `${(bytes / 1024).toFixed(1)} KB saved locally`
        : "local save estimate unavailable"
      const reuseRate = stats.lookups > 0 ? `${(stats.hitRate * 100).toFixed(0)}%` : "n/a"
      setCacheInfo(`${localStorageUsage} · ${stats.count} saved translations · ${stats.lookups} checks · ${reuseRate} reuse rate`)
    } catch {
      setCacheInfo("Saved translation stats unavailable")
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

  const exportLearningData = async () => {
    try {
      setLearningExportStatus(null)
      const payload = await buildLearningDataExport()
      downloadConfigFile(
        stringifyLearningDataExport(payload),
        `astra-learning-data-${new Date(payload.generatedAt).toISOString().slice(0, 10)}.json`,
      )
      setLearningExportStatus({
        type: "success",
        message: `Exported ${payload.summary.savedSnippetCount} saved snippet${payload.summary.savedSnippetCount === 1 ? "" : "s"} and ${payload.summary.reviewCardCount} review card${payload.summary.reviewCardCount === 1 ? "" : "s"}.`,
      })
    } catch {
      setLearningExportStatus({ type: "error", message: "Learning data export failed." })
    }
  }

  return (
    <div className="astra-settings-section">
      <SectionHeader
        eyebrow="Learning · Library"
        headline="Where every saved sentence comes home"
        intro="Saved vocabulary, translation cache stats, and the local A/B funnel for the popup → Deep Read → review loop."
      />

      <h2 className="astra-section-heading astra-sr-only">Vocabulary</h2>

      <div className="astra-card">
        <div style={{ marginBottom: 12 }}>
          <strong>Saved words</strong>
          <div style={hintStyle}>Open the vocabulary page to review and manage saved words.</div>
        </div>
        <button type="button" className="astra-btn-primary" onClick={openVocabulary}>
          Open vocabulary
        </button>
      </div>

      <div className="astra-card" data-testid="learning-data-export-card">
        <div style={{ marginBottom: 12 }}>
          <strong>Export learning data</strong>
          <div style={hintStyle}>
            Download your saved snippets, review cards, reading queue, reading history, and local study progress as JSON. This export is user-initiated and does not intentionally include full webpages or full transcripts.
          </div>
        </div>
        {learningExportStatus && (
          <div
            role="status"
            aria-live={learningExportStatus.type === "error" ? "assertive" : "polite"}
            data-testid="learning-data-export-status"
            style={{
              ...successBanner,
              marginBottom: 12,
              ...(learningExportStatus.type === "error"
                ? { background: "#fef2f2", color: "#dc2626", borderColor: "#fecaca" }
                : {}),
            }}
          >
            {learningExportStatus.message}
          </div>
        )}
        <button
          type="button"
          className="astra-btn-primary"
          data-testid="export-learning-data-btn"
          onClick={() => void exportLearningData()}
        >
          Export learning data
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

function DiagnosticsSection({ config, advanced }: { config: AstraConfig; advanced: boolean }) {
  const [activationDashboard, setActivationDashboard] = useState<LearningLoopActivationDashboard>(() => aggregateLearningLoopActivationDashboard([]))
  const [learningDashboard, setLearningDashboard] = useState<LearningLoopLearningDashboard>(() => aggregateLearningLoopLearningDashboard([]))
  const [retentionDashboard, setRetentionDashboard] = useState<LearningLoopRetentionDashboard>(() => aggregateLearningLoopRetentionDashboard([]))
  const [upgradePromptDashboard, setUpgradePromptDashboard] = useState<LearningLoopUpgradePromptDashboard>(() => aggregateLearningLoopUpgradePromptDashboard([]))
  const [learningLoopFunnel, setLearningLoopFunnel] = useState<LearningLoopFunnelAggregation>(() => aggregateLearningLoopFunnel([]))
  const [learningLoopFunnelStatus, setLearningLoopFunnelStatus] = useState("Loading local funnel telemetry...")
  const [learningLoopAutoSelection, setLearningLoopAutoSelection] = useState<LearningLoopCopyVariantAutoSelectionStatus | null>(null)
  const [supportBundleStatus, setSupportBundleStatus] = useState<{ type: "success" | "error"; message: string } | null>(null)
  const [supportIssueCategory, setSupportIssueCategory] = useState<SupportBundleIssueCategory>("translation_quality")
  const [supportFeatureSurface, setSupportFeatureSurface] = useState<SupportBundleFeatureSurface>("page")
  const [cancellationReason, setCancellationReason] = useState<AstraCancellationReason>("did_not_use_it")
  const [cancellationReasonStatus, setCancellationReasonStatus] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    void getRecentEvents(200)
      .then(async (events) => {
        if (!mounted) return
        const activation = aggregateLearningLoopActivationDashboard(events)
        const learning = aggregateLearningLoopLearningDashboard(events)
        const retention = aggregateLearningLoopRetentionDashboard(events)
        const upgradePrompt = aggregateLearningLoopUpgradePromptDashboard(events)
        const aggregation = aggregateLearningLoopFunnel(events)
        const autoSelection = await getLearningLoopCopyVariantAutoSelectionStatus(events)
        if (!mounted) return
        setActivationDashboard(activation)
        setLearningDashboard(learning)
        setRetentionDashboard(retention)
        setUpgradePromptDashboard(upgradePrompt)
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
        setActivationDashboard(aggregateLearningLoopActivationDashboard([]))
        setLearningDashboard(aggregateLearningLoopLearningDashboard([]))
        setRetentionDashboard(aggregateLearningLoopRetentionDashboard([]))
        setUpgradePromptDashboard(aggregateLearningLoopUpgradePromptDashboard([]))
        setLearningLoopFunnel(aggregateLearningLoopFunnel([]))
        setLearningLoopAutoSelection(null)
        setLearningLoopFunnelStatus("Learning-loop funnel telemetry unavailable.")
      })

    return () => {
      mounted = false
    }
  }, [])

  const autoSelectionCurrent = learningLoopAutoSelection?.candidates.find((candidate) => candidate.variant === learningLoopAutoSelection.currentVariant)
  const autoSelectionWinner = learningLoopAutoSelection?.candidates.find((candidate) => candidate.variant === learningLoopAutoSelection.winnerVariant)
  const buildCurrentSupportBundle = (timestamp: Date | string = new Date()) => buildSupportBundle({
    extensionVersion: browser.runtime.getManifest?.()?.version ?? "0.1.0",
    browser: detectBrowserLabel(),
    os: detectOsLabel(),
    locale: typeof navigator === "undefined" ? "unknown" : navigator.language,
    featureSurface: supportFeatureSurface,
    action: "report_issue",
    issueCategory: supportIssueCategory,
    runtimeSurface: "options_diagnostics",
    timestamp,
    privacyMode: config.privacyMode,
    membershipState: "unknown",
    userMessageIncluded: false,
    contactIncluded: false,
  })

  const supportPreviewBundle = buildCurrentSupportBundle("2026-05-27T00:00:00.000Z")

  const exportSupportBundle = () => {
    try {
      setSupportBundleStatus(null)
      const bundle = buildCurrentSupportBundle()
      downloadConfigFile(
        JSON.stringify(bundle, null, 2),
        `astra-support-bundle-${new Date(bundle.timestamp).toISOString().slice(0, 10)}.json`,
      )
      setSupportBundleStatus({ type: "success", message: describeSupportBundle(bundle) })
    } catch {
      setSupportBundleStatus({ type: "error", message: "Support bundle export failed." })
    }
  }

  const submitCancellationReason = async () => {
    const storedSession = await readAstraSession().catch(() => null)
    const submission = buildAstraCancellationReasonSubmission({
      reason: cancellationReason,
      plan: storedSession?.plan ?? "unknown",
      source: "settings",
    })

    recordLearningLoopEvent("cancellation_reason_submitted", {
      source: submission.source,
      reason: submission.reason,
      plan: submission.plan,
    })

    if (storedSession?.sessionToken && storedSession.deviceId && storedSession.relayBaseURL) {
      try {
        await submitAstraCancellationReason({
          baseURL: storedSession.relayBaseURL,
          sessionToken: storedSession.sessionToken,
          deviceId: storedSession.deviceId,
          reason: submission.reason,
          source: submission.source,
        })
        setCancellationReasonStatus("Thanks — saved to Astra support metadata. No page text, learning content, or personal note was included.")
        return
      } catch {
        // Keep local metadata feedback even if the relay is unavailable.
      }
    }

    setCancellationReasonStatus("Thanks — saved locally as metadata-only feedback. No page text, learning content, or personal note was included.")
  }

  const submitSupportBundle = async () => {
    try {
      setSupportBundleStatus(null)
      const storedSession = await readAstraSession()
      if (!storedSession?.sessionToken || !storedSession.deviceId) {
        setSupportBundleStatus({
          type: "error",
          message: "Sign in to submit a metadata report to Astra support, or use Download support info to keep a local copy.",
        })
        return
      }

      const bundle = buildCurrentSupportBundle()
      const result = await submitAstraSupportReport({
        baseURL: storedSession.relayBaseURL,
        sessionToken: storedSession.sessionToken,
        deviceId: storedSession.deviceId,
        bundle,
      })
      if (result.report.knownIssue) {
        recordLearningLoopEvent("known_issue_viewed", {
          source: "options_diagnostics",
          issueId: result.report.knownIssue.issueId,
          status: result.report.knownIssue.status,
          surface: result.report.knownIssue.featureSurface,
        })
      }
      setSupportBundleStatus({
        type: "success",
        message: [
          `Submitted metadata report ${result.report.reportId}.`,
          result.report.knownIssue ? describeKnownIssueForUser(result.report.knownIssue) : null,
          describeSupportBundle(bundle),
        ].filter(Boolean).join("\n"),
      })
    } catch {
      setSupportBundleStatus({ type: "error", message: "Support report submission failed. You can still download the metadata-only JSON and send it manually." })
    }
  }

  return (
    <div className="astra-settings-section">
      <SectionHeader
        eyebrow="Astra · Help & privacy"
        headline="Help, support & privacy"
        intro="Report a problem, manage your saved data, or send cancellation feedback — all metadata-only, on this device."
      />

      <h2 className="astra-section-heading astra-sr-only">Help and privacy</h2>

      <div className="astra-card" data-testid="support-bundle-card">
        <h3 className="astra-section-subheading">Report a problem</h3>
        <div style={hintStyle}>
          Submit or download a metadata-only report bundle for support. It contains version, browser, OS, locale, feature surface, issue category, Privacy Mode state, and timestamp — no page text, saved snippets, transcripts, screenshots, or user input.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginTop: 12 }}>
          <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 700, color: "var(--astra-text-secondary)" }}>
            What happened?
            <select
              className="astra-input"
              data-testid="support-issue-category-select"
              value={supportIssueCategory}
              onChange={(event) => setSupportIssueCategory(event.target.value as SupportBundleIssueCategory)}
            >
              <option value="translation_quality">Translation quality</option>
              <option value="page_not_working">Page not working</option>
              <option value="video_subtitles">Video subtitles</option>
              <option value="file_reader">File reader</option>
              <option value="review_library">Review or Library</option>
              <option value="account_access">Account access</option>
              <option value="privacy_question">Privacy question</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 700, color: "var(--astra-text-secondary)" }}>
            Where did it happen?
            <select
              className="astra-input"
              data-testid="support-feature-surface-select"
              value={supportFeatureSurface}
              onChange={(event) => setSupportFeatureSurface(event.target.value as SupportBundleFeatureSurface)}
            >
              <option value="page">Page translation</option>
              <option value="video">Video</option>
              <option value="file">File reader</option>
              <option value="review">Review</option>
              <option value="library">Library</option>
              <option value="account">Account</option>
              <option value="onboarding">Onboarding</option>
              <option value="settings">Settings</option>
            </select>
          </label>
        </div>
        <pre data-testid="support-bundle-preview" style={{ whiteSpace: "pre-wrap", margin: "12px 0", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--astra-border)", background: "var(--astra-bg-elevated)", color: "var(--astra-text-secondary)", fontSize: 12, lineHeight: 1.5 }}>
          {describeSupportBundle(supportPreviewBundle)}
        </pre>
        {supportBundleStatus && (
          <pre
            role="status"
            aria-live={supportBundleStatus.type === "error" ? "assertive" : "polite"}
            data-testid="support-bundle-status"
            style={{
              whiteSpace: "pre-wrap",
              margin: "12px 0",
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid var(--astra-border)",
              background: supportBundleStatus.type === "error" ? "#fef2f2" : "var(--astra-bg-primary)",
              color: supportBundleStatus.type === "error" ? "#dc2626" : "var(--astra-text-secondary)",
              fontSize: 12,
              lineHeight: 1.5,
            }}
          >
            {supportBundleStatus.message}
          </pre>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button
            type="button"
            className="astra-btn-primary"
            data-testid="submit-support-bundle-btn"
            onClick={() => {
              void submitSupportBundle()
            }}
          >
            Submit metadata report
          </button>
          <button
            type="button"
            className="astra-btn-secondary"
            data-testid="export-support-bundle-btn"
            onClick={exportSupportBundle}
          >
            Download support info
          </button>
        </div>
      </div>

      <div className="astra-card" data-testid="cancellation-reason-card" style={{ marginTop: 16 }}>
        <h3 className="astra-section-subheading">Leaving or taking a break?</h3>
        <div style={hintStyle}>
          If you cancel, pause, or ask for a refund later, Astra records only this normalized reason plus your current plan/source. No page text, saved snippets, transcripts, URL paths, or free-form note is collected here.
        </div>
        <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 700, color: "var(--astra-text-secondary)", marginTop: 12 }}>
          Main reason
          <select
            className="astra-input"
            data-testid="cancellation-reason-select"
            value={cancellationReason}
            onChange={(event) => setCancellationReason(event.target.value as AstraCancellationReason)}
          >
            {ASTRA_CANCELLATION_REASON_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <div style={{ ...hintStyle, marginTop: 8 }}>
          Product meaning: {ASTRA_CANCELLATION_REASON_OPTIONS.find((option) => option.value === cancellationReason)?.productMeaning ?? "Needs manual review."}
        </div>
        {cancellationReasonStatus && (
          <div
            role="status"
            aria-live="polite"
            data-testid="cancellation-reason-status"
            style={{ ...successBanner, marginTop: 12 }}
          >
            {cancellationReasonStatus}
          </div>
        )}
        <button
          type="button"
          className="astra-btn-secondary"
          data-testid="submit-cancellation-reason-btn"
          style={{ marginTop: 12 }}
          onClick={() => {
            void submitCancellationReason()
          }}
        >
          Save feedback
        </button>
      </div>

      {/* Developer telemetry dashboards stay off the default zero-config path;
          they render only under the explicit advanced flag (?advanced=1). The
          support report, cancellation feedback, and account-deletion request
          above remain reachable for every user. */}
      {advanced && (
      <>
      <div className="astra-card" data-testid="activation-dashboard-card" style={{ marginTop: 16 }}>
        <h3 className="astra-section-subheading">Activation dashboard</h3>
        <div style={hintStyle}>
          V0 local dashboard for the first 10 minutes: setup completion, first value timing, first save, first review, trial starts, and Pro-value visibility. It uses local event metadata only.
        </div>
        <div style={{ ...hintStyle, marginTop: 4 }} data-testid="activation-dashboard-summary">
          Starts {activationDashboard.activationStartCount} · First value {activationDashboard.firstValueCount} · First saves {activationDashboard.firstSaveCount} · Trial starts {activationDashboard.trialStartedCount} · Pro value seen {activationDashboard.proValueSeenCount}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginTop: 12 }}>
          <div data-testid="activation-dashboard-onboarding" style={{ border: "1px solid var(--astra-border)", borderRadius: 8, padding: "10px 12px", background: "var(--astra-bg-primary)" }}>
            <strong style={{ fontSize: 13, color: "var(--astra-text-primary)" }}>Onboarding completion</strong>
            <div style={{ fontSize: 18, fontWeight: 800, color: "var(--astra-text-primary)", marginTop: 4 }}>
              {formatLearningLoopFunnelRate(activationDashboard.onboardingCompletionRate)}
            </div>
            <div style={hintStyle}>
              Target ≥80% · {formatLearningLoopDashboardStatus(activationDashboard.onboardingCompletionRate, 0.8, "at_least")}
            </div>
          </div>
          <div data-testid="activation-dashboard-first-value" style={{ border: "1px solid var(--astra-border)", borderRadius: 8, padding: "10px 12px", background: "var(--astra-bg-primary)" }}>
            <strong style={{ fontSize: 13, color: "var(--astra-text-primary)" }}>First value P50</strong>
            <div style={{ fontSize: 18, fontWeight: 800, color: "var(--astra-text-primary)", marginTop: 4 }}>
              {formatLearningLoopDurationSeconds(activationDashboard.firstValueP50Seconds)}
            </div>
            <div style={hintStyle}>
              Target &lt;60s · {formatLearningLoopDashboardStatus(activationDashboard.firstValueP50Seconds, 60, "below")}
            </div>
          </div>
          <div data-testid="activation-dashboard-first-save" style={{ border: "1px solid var(--astra-border)", borderRadius: 8, padding: "10px 12px", background: "var(--astra-bg-primary)" }}>
            <strong style={{ fontSize: 13, color: "var(--astra-text-primary)" }}>First save rate</strong>
            <div style={{ fontSize: 18, fontWeight: 800, color: "var(--astra-text-primary)", marginTop: 4 }}>
              {formatLearningLoopFunnelRate(activationDashboard.firstSaveRate)}
            </div>
            <div style={hintStyle}>
              Target ≥25% · {formatLearningLoopDashboardStatus(activationDashboard.firstSaveRate, 0.25, "at_least")}
            </div>
          </div>
          <div data-testid="activation-dashboard-first-review" style={{ border: "1px solid var(--astra-border)", borderRadius: 8, padding: "10px 12px", background: "var(--astra-bg-primary)" }}>
            <strong style={{ fontSize: 13, color: "var(--astra-text-primary)" }}>First review completion</strong>
            <div style={{ fontSize: 18, fontWeight: 800, color: "var(--astra-text-primary)", marginTop: 4 }}>
              {formatLearningLoopFunnelRate(activationDashboard.firstReviewCompletionRate)}
            </div>
            <div style={hintStyle}>
              Target ≥15% · {formatLearningLoopDashboardStatus(activationDashboard.firstReviewCompletionRate, 0.15, "at_least")}
            </div>
          </div>
        </div>
        <div style={{ ...hintStyle, marginTop: 10 }} data-testid="activation-dashboard-privacy">
          {activationDashboard.privacyPolicy}
        </div>
      </div>

      <div className="astra-card" data-testid="learning-dashboard-card" style={{ marginTop: 16 }}>
        <h3 className="astra-section-subheading">Learning dashboard</h3>
        <div style={hintStyle}>
          V0 local dashboard for M2/M3 learning-loop health: saves, review completion, reviewable-card proxy, Library opens, source return, continue actions, and saved source mix. It uses local event metadata only.
        </div>
        <div style={{ ...hintStyle, marginTop: 4 }} data-testid="learning-dashboard-summary">
          Saves {learningDashboard.savedItemCount} · Review completed {learningDashboard.reviewCompletedCount} · Source returns {learningDashboard.sourceReturnCount} · Continue actions {learningDashboard.continueLearningCount} · Active days {learningDashboard.activeLearningDaysLast28}/28
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginTop: 12 }}>
          <div data-testid="learning-dashboard-saves" style={{ border: "1px solid var(--astra-border)", borderRadius: 8, padding: "10px 12px", background: "var(--astra-bg-primary)" }}>
            <strong style={{ fontSize: 13, color: "var(--astra-text-primary)" }}>Saved learning assets</strong>
            <div style={{ fontSize: 18, fontWeight: 800, color: "var(--astra-text-primary)", marginTop: 4 }}>
              {learningDashboard.savedItemCount}
            </div>
            <div style={hintStyle}>
              Source mix: {formatLearningLoopSourceMix(learningDashboard)}
            </div>
          </div>
          <div data-testid="learning-dashboard-reviewable" style={{ border: "1px solid var(--astra-border)", borderRadius: 8, padding: "10px 12px", background: "var(--astra-bg-primary)" }}>
            <strong style={{ fontSize: 13, color: "var(--astra-text-primary)" }}>Reviewable-card proxy</strong>
            <div style={{ fontSize: 18, fontWeight: 800, color: "var(--astra-text-primary)", marginTop: 4 }}>
              {formatLearningLoopFunnelRate(learningDashboard.reviewableCardProxyRate)}
            </div>
            <div style={hintStyle}>
              Explicit review-card saves {learningDashboard.reviewableCardProxyCount}/{learningDashboard.savedItemCount}
            </div>
          </div>
          <div data-testid="learning-dashboard-review" style={{ border: "1px solid var(--astra-border)", borderRadius: 8, padding: "10px 12px", background: "var(--astra-bg-primary)" }}>
            <strong style={{ fontSize: 13, color: "var(--astra-text-primary)" }}>Review completion</strong>
            <div style={{ fontSize: 18, fontWeight: 800, color: "var(--astra-text-primary)", marginTop: 4 }}>
              {formatLearningLoopFunnelRate(learningDashboard.reviewCompletionRate)}
            </div>
            <div style={hintStyle}>
              Opened {learningDashboard.reviewOpenedCount} · Completed {learningDashboard.reviewCompletedCount} · Answered {learningDashboard.reviewAnsweredCount}
            </div>
          </div>
          <div data-testid="learning-dashboard-library" style={{ border: "1px solid var(--astra-border)", borderRadius: 8, padding: "10px 12px", background: "var(--astra-bg-primary)" }}>
            <strong style={{ fontSize: 13, color: "var(--astra-text-primary)" }}>Library/source continuity</strong>
            <div style={{ fontSize: 18, fontWeight: 800, color: "var(--astra-text-primary)", marginTop: 4 }}>
              {learningDashboard.libraryOpenedCount}
            </div>
            <div style={hintStyle}>
              Library opens · Source returns {learningDashboard.sourceReturnCount} · Continue {learningDashboard.continueLearningCount}
            </div>
          </div>
        </div>
        <div style={{ ...hintStyle, marginTop: 10 }} data-testid="learning-dashboard-privacy">
          {learningDashboard.privacyPolicy}
        </div>
      </div>

      <div className="astra-card" data-testid="retention-dashboard-card" style={{ marginTop: 16 }}>
        <h3 className="astra-section-subheading">Retention dashboard</h3>
        <div style={hintStyle}>
          V0 local dashboard for review return, Digest follow-through, source return, reminders, Pro repeat value, and cancellation value-risk signals. It uses local event metadata only.
        </div>
        <div style={{ ...hintStyle, marginTop: 4 }} data-testid="retention-dashboard-summary">
          Active days {retentionDashboard.activeLearningDaysLast28}/28 · Active weeks {retentionDashboard.activeLearningWeeksLast4}/4 · Digest views {retentionDashboard.digestViewedCount} · Source returns {retentionDashboard.sourceReturnCount} · Value-risk cancels {retentionDashboard.cancellationValueRiskCount}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginTop: 12 }}>
          <div data-testid="retention-dashboard-review" style={{ border: "1px solid var(--astra-border)", borderRadius: 8, padding: "10px 12px", background: "var(--astra-bg-primary)" }}>
            <strong style={{ fontSize: 13, color: "var(--astra-text-primary)" }}>Review completion</strong>
            <div style={{ fontSize: 18, fontWeight: 800, color: "var(--astra-text-primary)", marginTop: 4 }}>
              {formatLearningLoopFunnelRate(retentionDashboard.reviewCompletionRate)}
            </div>
            <div style={hintStyle}>
              Opened {retentionDashboard.reviewOpenedCount} · Completed {retentionDashboard.reviewCompletedCount} · Answered {retentionDashboard.reviewAnsweredCount}
            </div>
          </div>
          <div data-testid="retention-dashboard-digest" style={{ border: "1px solid var(--astra-border)", borderRadius: 8, padding: "10px 12px", background: "var(--astra-bg-primary)" }}>
            <strong style={{ fontSize: 13, color: "var(--astra-text-primary)" }}>Digest follow-through</strong>
            <div style={{ fontSize: 18, fontWeight: 800, color: "var(--astra-text-primary)", marginTop: 4 }}>
              {formatLearningLoopFunnelRate(retentionDashboard.digestReviewFollowThroughRate)}
            </div>
            <div style={hintStyle}>
              Views {retentionDashboard.digestViewedCount} · Opens {retentionDashboard.digestOpenedCount} · Review/continue {retentionDashboard.digestReviewFollowThroughCount}
            </div>
          </div>
          <div data-testid="retention-dashboard-source-return" style={{ border: "1px solid var(--astra-border)", borderRadius: 8, padding: "10px 12px", background: "var(--astra-bg-primary)" }}>
            <strong style={{ fontSize: 13, color: "var(--astra-text-primary)" }}>Return to source</strong>
            <div style={{ fontSize: 18, fontWeight: 800, color: "var(--astra-text-primary)", marginTop: 4 }}>
              {retentionDashboard.sourceReturnCount}
            </div>
            <div style={hintStyle}>
              Continue actions {retentionDashboard.continueCount} · last 28-day local source-value signal
            </div>
          </div>
          <div data-testid="retention-dashboard-controls" style={{ border: "1px solid var(--astra-border)", borderRadius: 8, padding: "10px 12px", background: "var(--astra-bg-primary)" }}>
            <strong style={{ fontSize: 13, color: "var(--astra-text-primary)" }}>Retention controls</strong>
            <div style={{ fontSize: 18, fontWeight: 800, color: "var(--astra-text-primary)", marginTop: 4 }}>
              {retentionDashboard.reminderControlledCount}
            </div>
            <div style={hintStyle}>
              Reminder dismiss/disable · Win-back sent {retentionDashboard.winbackSentCount} · Pro repeat value {retentionDashboard.proRepeatValueCount}
            </div>
          </div>
        </div>
        <div style={{ ...hintStyle, marginTop: 10 }} data-testid="retention-dashboard-privacy">
          {retentionDashboard.privacyPolicy}
        </div>
      </div>

      <div className="astra-card" data-testid="upgrade-prompt-observability-card" style={{ marginTop: 16 }}>
        <h3 className="astra-section-subheading">Upgrade prompt observability</h3>
        <div style={hintStyle}>
          Local beta-safe visibility for the popup upgrade-interest prompt. Paid upgrades are not launched; intent clicks only record local interest and do not start checkout, a trial, email capture, or a subscription change.
        </div>
        <div style={{ ...hintStyle, marginTop: 4 }} data-testid="upgrade-prompt-observability-summary">
          Assignments {upgradePromptDashboard.assignments} · Views {upgradePromptDashboard.views} · Intents {upgradePromptDashboard.intents} · Intent rate {formatLearningLoopFunnelRate(upgradePromptDashboard.intentRate)}
        </div>
        <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
          {upgradePromptDashboard.rows.length === 0 ? (
            <div style={hintStyle}>No local upgrade prompt events yet.</div>
          ) : upgradePromptDashboard.rows.map((row) => (
            <div
              key={`${row.variant}:${row.trigger}`}
              data-testid={`upgrade-prompt-row-${row.variant}-${row.trigger}`}
              style={{ border: "1px solid var(--astra-border)", borderRadius: 8, padding: "10px 12px", background: "var(--astra-bg-primary)" }}
            >
              <strong style={{ fontSize: 13, color: "var(--astra-text-primary)" }}>{row.variant} · {row.trigger}</strong>
              <div style={{ fontSize: 12, color: "#334155", marginTop: 6, lineHeight: 1.55 }}>
                Assignments {row.assignments} · Views {row.views} · Intents {row.intents} · Intent/view {formatLearningLoopFunnelRate(row.intentRate)}
              </div>
            </div>
          ))}
        </div>
        <div style={{ ...hintStyle, marginTop: 10 }} data-testid="upgrade-prompt-observability-privacy">
          {upgradePromptDashboard.privacyPolicy}
        </div>
      </div>

      <div className="astra-card" data-testid="learning-loop-funnel-card" style={{ marginTop: 16 }}>
        <h3 className="astra-section-subheading">Local A/B learning funnel</h3>
        <div style={hintStyle}>
          Uses only this device's local telemetry from the popup primer through Deep Read, explanation, save, and review events.
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
        <h3 className="astra-section-subheading">{t("options_diagWorkflowConfig")}</h3>
        <div style={{ fontSize: 12, color: "#334155", lineHeight: 1.6 }}>
          <div style={{ marginBottom: 8 }}>
            <strong>Astra AI:</strong> {formatServiceModeLabel(config.serviceMode)}
          </div>
          <div style={{ marginBottom: 8 }}>
            <strong>Translation scope:</strong> {formatContentScopeLabel(config.contentScope)}
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
            <strong>Voice:</strong> {config.tts.engine === "edge" ? "Neural voice" : "Browser voice"} · Rate: {config.tts.rate}x
          </div>
        </div>
      </div>
      </>
      )}
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
    <div className="astra-settings-section">
      <SectionHeader
        eyebrow="Account · Sync & backup"
        headline="Astra across your devices"
        intro="Continuity status, registered devices, optional collection toggles, and JSON export — your bridge between this browser and the rest of your reading life."
      />

      <h2 className="astra-section-heading astra-sr-only">About</h2>

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
  const { astraTheme, astraDirection } = useAstraTheme()
  const [section, setSection] = useState<Section>(() => getInitialOptionsSection())
  // Zero-config default path: provider/model controls ("Astra AI") are hidden
  // unless the explicit advanced flag is on, which ordinary beta users never set.
  const optionsAdvancedEnabled = useMemo(() => isOptionsAdvancedEnabled(), [])
  const [searchQuery, setSearchQuery] = useState("")
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
  const [learningProfile, setLearningProfile] = useState<LearningProfile | null>(null)
  const [learningMemoryInventory, setLearningMemoryInventory] = useState<LearningMemoryInventory | null>(null)
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
          await refreshRemoteFeatureFlagRuntime(session.relayBaseURL).catch(() => undefined)
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

  const refreshLearningMemoryInventory = useCallback(async () => {
    try {
      setLearningMemoryInventory(await buildLearningMemoryInventory())
    } catch {
      setLearningMemoryInventory(null)
    }
  }, [])

  useEffect(() => {
    void (async () => {
      const loadedConfig = await readConfig()
      const loadedProfile = await readLearningProfile()
      setConfig(loadedConfig)
      setLearningProfile(loadedProfile)
      await Promise.all([
        refreshContinuityState(loadedConfig),
        refreshLearningMemoryInventory(),
      ])
    })()
    void refreshVoices()
  }, [refreshContinuityState, refreshLearningMemoryInventory, refreshVoices])

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

  const updateLearningProfilePatch = useCallback((patch: Partial<LearningProfile>) => {
    void (async () => {
      setError(null)
      try {
        const next = await updateLearningProfile(patch)
        setLearningProfile(next)
        await refreshLearningMemoryInventory()
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update learning profile.")
      }
    })()
  }, [refreshLearningMemoryInventory])

  const handleForgetRememberedTerm = useCallback((termId: string) => {
    void (async () => {
      setError(null)
      try {
        const next = await forgetRememberedTerm(termId)
        setLearningProfile(next)
        await refreshLearningMemoryInventory()
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to forget remembered term.")
      }
    })()
  }, [refreshLearningMemoryInventory])

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
        serviceMode: config.serviceMode,
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
      const nextProfile = await updateLearningProfile({
        targetLang: nextConfig.targetLang,
        languageLevel: nextConfig.languageLevel,
        explainMode: nextConfig.explainMode,
      })
      setConfig(nextConfig)
      setLearningProfile(nextProfile)
      await refreshLearningMemoryInventory()
      setDirty(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(getSafeSettingsSaveError(err))
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
            learningProfile={learningProfile}
            learningMemoryInventory={learningMemoryInventory}
            onLearningProfileChange={updateLearningProfilePatch}
            onForgetRememberedTerm={handleForgetRememberedTerm}
            onNavigate={setSection}
          />
        )
      case "providers":
        // Defensive: provider/model controls only render on the advanced path.
        // Nav and deep-link resolution already exclude this section by default,
        // so an ordinary user can never land here.
        if (!optionsAdvancedEnabled) {
          return (
            <TranslationSection
              config={config}
              onPresentationChange={updatePresentation}
              onConfigChange={updateConfig}
            />
          )
        }
        return <ProvidersSection config={config} onConfigChange={updateConfig} />
      case "translation":
        return (
          <TranslationSection
            config={config}
            onPresentationChange={updatePresentation}
            onConfigChange={updateConfig}
          />
        )
      case "actions":
        return <ActionsSection config={config} onChange={updateConfig} />
      case "sites":
        return <SitesSection config={config} onChange={updateConfig} />
      case "vocabulary":
        return <VocabularySection />
      case "diagnostics":
        return <DiagnosticsSection config={config} advanced={optionsAdvancedEnabled} />
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

  const breadcrumbLabel = SECTION_META[section].breadcrumb
  const sessionState = continuityStatus?.session.state ?? "signed-out"
  const isSynced = sessionState === "authenticated"
  const syncStatusLabel = isSynced
    ? "Synced just now"
    : sessionState === "signed-out"
      ? "Local only on this device"
      : "Continuity preparing…"

  const trimmedQuery = searchQuery.trim().toLowerCase()
  const filteredGroups = visibleNavGroups(optionsAdvancedEnabled).map((group) => ({
    ...group,
    items: trimmedQuery.length > 0
      ? group.items.filter((item) =>
          item.label.toLowerCase().includes(trimmedQuery)
          || group.label.toLowerCase().includes(trimmedQuery)
          || item.key.toLowerCase().includes(trimmedQuery)
        )
      : group.items,
  })).filter((group) => group.items.length > 0)

  return (
    <div className="astra-settings-page" data-astra-theme={astraTheme} data-astra={astraDirection}>
      <div className={`astra-settings-shell${isMobile ? " astra-settings-shell--compact" : ""}`}>
        {!isMobile && (
          <aside className="astra-settings-sidebar" aria-label="Settings sections">
            <div className="astra-settings-brand">
              <span className="astra-settings-brand__mark">Astra</span>
              <span className="astra-settings-brand__version">v2.0</span>
            </div>

            <div className="astra-settings-search">
              <input
                type="search"
                className="astra-settings-search__input"
                placeholder="Search settings"
                aria-label="Search settings"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <kbd className="astra-settings-search__kbd" aria-hidden="true">⌘K</kbd>
            </div>

            <nav className="astra-settings-nav" aria-label="Settings groups">
              {filteredGroups.map((group) => (
                <div className="astra-settings-nav-group" key={group.label}>
                  <div className="astra-settings-nav-group__eyebrow">{group.label}</div>
                  <ul className="astra-settings-nav-list">
                    {group.items.map((item) => {
                      const count = item.getCount?.(config) ?? null
                      return (
                        <li className="astra-settings-nav-row" key={item.key}>
                          <button
                            type="button"
                            className="astra-settings-nav-item"
                            data-section={item.key}
                            aria-current={section === item.key ? "page" : undefined}
                            onClick={() => setSection(item.key)}
                          >
                            {item.label}
                          </button>
                          {count != null && (
                            <span className="astra-settings-nav-row__count" aria-hidden="true">{count}</span>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
              {filteredGroups.length === 0 && (
                <div style={{ padding: "10px 12px", fontSize: 12, color: "var(--astra-text-muted)" }}>
                  No matching settings.
                </div>
              )}
            </nav>

            <footer
              className="astra-settings-sidebar-status"
              data-state={isSynced ? "synced" : "local"}
            >
              <span className="astra-settings-sidebar-status__dot" aria-hidden="true" />
              <span>{syncStatusLabel}</span>
            </footer>
          </aside>
        )}

        <main className="astra-settings-main">
          <header className="astra-settings-topbar">
            <nav className="astra-settings-breadcrumb" aria-label="Breadcrumb">
              <span>Settings</span>
              <span className="astra-settings-breadcrumb__separator" aria-hidden="true">/</span>
              <span className="astra-settings-breadcrumb__current">{breadcrumbLabel}</span>
            </nav>
            <button
              type="button"
              className="astra-settings-close"
              onClick={() => window.close()}
              aria-label="Close settings"
            >
              Close
            </button>
          </header>

          {isMobile && (
            <nav className="astra-settings-mobile-nav" aria-label="Settings sections">
              {visibleNavItems(optionsAdvancedEnabled).map((item) => (
                <button
                  type="button"
                  key={item.key}
                  className="astra-settings-nav-item"
                  data-section={item.key}
                  aria-current={section === item.key ? "page" : undefined}
                  onClick={() => setSection(item.key)}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          )}

          <div className="astra-settings-body">
            {(saved || error) && (
              <ToastViewport placement="top" aria-label="Settings notifications" className="astra-settings-toast-viewport">
                {saved && (
                  <Toast variant="success" title="Saved">
                    Done — settings saved.
                  </Toast>
                )}
                {error && (
                  <Toast variant="error" title="Settings update failed">
                    {error} Next step: try again in a moment.
                  </Toast>
                )}
              </ToastViewport>
            )}

            {renderSection()}

            {section !== "vocabulary" && section !== "about" && section !== "diagnostics" && (
              <div className="astra-settings-actions">
                <button
                  type="button"
                  className="astra-btn-primary"
                  style={{ opacity: dirty ? 1 : 0.6 }}
                  onClick={() => void handleSave()}
                >
                  Save settings
                </button>
                {dirty && <span className="astra-settings-actions__hint">Unsaved changes</span>}
              </div>
            )}
          </div>
        </main>
      </div>

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
