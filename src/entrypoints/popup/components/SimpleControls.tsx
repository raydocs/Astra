import type { ExplainMode, LanguageLevel, TranslationMode } from "@/types/config"
import { t } from "@/utils/i18n"
import { labelStyle, inputStyle } from "./styles"

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

export interface SimpleControlsProps {
  targetLang: string
  translationMode: "bilingual" | "translation-only"
  languageLevel: LanguageLevel
  explainMode: ExplainMode
  onTargetLangChange: (lang: string) => void
  onModeChange: (mode: "bilingual" | "translation-only") => void
  onLanguageLevelChange: (level: LanguageLevel) => void
  onExplainModeChange: (mode: ExplainMode) => void
}

export default function SimpleControls({
  targetLang,
  translationMode,
  languageLevel,
  explainMode,
  onTargetLangChange,
  onModeChange,
  onLanguageLevelChange,
  onExplainModeChange,
}: SimpleControlsProps) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={labelStyle}>{t("label_targetLanguage")}</label>
      <select
        value={targetLang}
        onChange={(e) => onTargetLangChange(e.target.value)}
        style={inputStyle}
      >
        {LANGUAGE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>

      <label style={{ ...labelStyle, marginTop: 8 }}>{t("label_translationMode")}</label>
      <select
        value={translationMode}
        onChange={(e) => onModeChange(e.target.value as TranslationMode)}
        style={inputStyle}
      >
        <option value="bilingual">{t("modeBilingual")}</option>
        <option value="translation-only">{t("modeTranslationOnly")}</option>
      </select>

      <label style={{ ...labelStyle, marginTop: 8 }}>{t("label_languageLevel")}</label>
      <select
        value={languageLevel}
        onChange={(e) => onLanguageLevelChange(e.target.value as LanguageLevel)}
        style={inputStyle}
      >
        <option value="beginner">{t("label_beginner")}</option>
        <option value="intermediate">{t("label_intermediate")}</option>
        <option value="advanced">{t("label_advanced")}</option>
      </select>

      <label style={{ ...labelStyle, marginTop: 8 }}>{t("label_explainMode")}</label>
      <select
        value={explainMode}
        onChange={(e) => onExplainModeChange(e.target.value as ExplainMode)}
        style={inputStyle}
      >
        <option value="beginner">{t("label_explainModeBeginner")}</option>
        <option value="exam">{t("label_explainModeExam")}</option>
        <option value="deep">{t("label_explainModeDeep")}</option>
      </select>
    </div>
  )
}
