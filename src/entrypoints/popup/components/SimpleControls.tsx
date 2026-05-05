import type { ExplainMode, LanguageLevel, TranslationMode } from "@/types/config"
import { t } from "@/utils/i18n"
import { labelStyle } from "./styles"

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
  explanationGlossaryText: string
  onTargetLangChange: (lang: string) => void
  onModeChange: (mode: "bilingual" | "translation-only") => void
  onLanguageLevelChange: (level: LanguageLevel) => void
  onExplainModeChange: (mode: ExplainMode) => void
  onExplanationGlossaryChange: (value: string) => void
}

export default function SimpleControls({
  targetLang,
  translationMode,
  languageLevel,
  explainMode,
  explanationGlossaryText,
  onTargetLangChange,
  onModeChange,
  onLanguageLevelChange,
  onExplainModeChange,
  onExplanationGlossaryChange,
}: SimpleControlsProps) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label htmlFor="popup-simple-target-language" style={labelStyle}>{t("label_targetLanguage")}</label>
      <select
        id="popup-simple-target-language"
        value={targetLang}
        onChange={(e) => onTargetLangChange(e.target.value)}
      className="astra-input"
      >
        {LANGUAGE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>

      <label htmlFor="popup-simple-translation-mode" style={{ ...labelStyle, marginTop: 8 }}>{t("label_translationMode")}</label>
      <select
        id="popup-simple-translation-mode"
        value={translationMode}
        onChange={(e) => onModeChange(e.target.value as TranslationMode)}
      className="astra-input"
      >
        <option value="bilingual">{t("modeBilingual")}</option>
        <option value="translation-only">{t("modeTranslationOnly")}</option>
      </select>

      <label htmlFor="popup-simple-language-level" style={{ ...labelStyle, marginTop: 8 }}>{t("label_languageLevel")}</label>
      <select
        id="popup-simple-language-level"
        data-testid="popup-language-level-select"
        value={languageLevel}
        onChange={(e) => onLanguageLevelChange(e.target.value as LanguageLevel)}
      className="astra-input"
      >
        <option value="beginner">{t("label_beginner")}</option>
        <option value="intermediate">{t("label_intermediate")}</option>
        <option value="advanced">{t("label_advanced")}</option>
      </select>

      <label htmlFor="popup-simple-explain-mode" style={{ ...labelStyle, marginTop: 8 }}>{t("label_explainMode")}</label>
      <select
        id="popup-simple-explain-mode"
        data-testid="popup-explain-mode-select"
        value={explainMode}
        onChange={(e) => onExplainModeChange(e.target.value as ExplainMode)}
      className="astra-input"
      >
        <option value="beginner">{t("label_explainModeBeginner")}</option>
        <option value="exam">{t("label_explainModeExam")}</option>
        <option value="deep">{t("label_explainModeDeep")}</option>
      </select>

      <label htmlFor="popup-simple-explanation-glossary" style={{ ...labelStyle, marginTop: 8 }}>Explanation glossary</label>
      <textarea
        id="popup-simple-explanation-glossary"
        data-testid="popup-explanation-glossary-input"
        value={explanationGlossaryText}
        onChange={(e) => onExplanationGlossaryChange(e.target.value)}
        className="astra-input"
        rows={3}
        placeholder="source term => preferred explanation term"
        style={{ resize: "vertical", minHeight: 66 }}
      />
      <div style={{ fontSize: 11, color: "var(--astra-text-hint)", marginTop: 2 }}>
        One term per line. If the source term appears, explanations must include the preferred term.
      </div>
    </div>
  )
}
