import type { ExplainMode, LanguageLevel, TranslationMode } from "@/types/config"
import { t } from "@/utils/i18n"
import { PopupGroupCard, PopupSegmentedControl, PopupSettingRow } from "./PopupDesignPrimitives"

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
    <PopupGroupCard eyebrow={t("popup_settings")}>
      <PopupSettingRow
        icon="A"
        title={t("label_targetLanguage")}
        accessory={
          <select
            id="popup-simple-target-language"
            aria-label={t("label_targetLanguage")}
            value={targetLang}
            onChange={(e) => onTargetLangChange(e.target.value)}
            className="astra-input"
          >
            {LANGUAGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        }
      />

      <PopupSettingRow
        icon="M"
        title={t("label_translationMode")}
        accessory={
          <PopupSegmentedControl<TranslationMode>
            ariaLabel={t("label_translationMode")}
            value={translationMode}
            onChange={onModeChange}
            options={[
              { value: "bilingual", label: t("modeBilingual") },
              { value: "translation-only", label: t("modeTranslationOnly") },
            ]}
          />
        }
      />

      <PopupSettingRow
        icon="L"
        title={t("label_languageLevel")}
        accessory={
          <select
            id="popup-simple-language-level"
            data-testid="popup-language-level-select"
            aria-label={t("label_languageLevel")}
            value={languageLevel}
            onChange={(e) => onLanguageLevelChange(e.target.value as LanguageLevel)}
            className="astra-input"
          >
            <option value="beginner">{t("label_beginner")}</option>
            <option value="intermediate">{t("label_intermediate")}</option>
            <option value="advanced">{t("label_advanced")}</option>
          </select>
        }
      />

      <PopupSettingRow
        icon="?"
        title={t("label_explainMode")}
        accessory={
          <select
            id="popup-simple-explain-mode"
            data-testid="popup-explain-mode-select"
            aria-label={t("label_explainMode")}
            value={explainMode}
            onChange={(e) => onExplainModeChange(e.target.value as ExplainMode)}
            className="astra-input"
          >
            <option value="beginner">{t("label_explainModeBeginner")}</option>
            <option value="exam">{t("label_explainModeExam")}</option>
            <option value="deep">{t("label_explainModeDeep")}</option>
          </select>
        }
      />

      <div className="astra-setting-row" data-last="true">
        <span className="astra-setting-row__icon" aria-hidden="true">G</span>
        <span className="astra-setting-row__body">
          <span className="astra-setting-row__title">Explanation glossary</span>
          <details style={{ marginTop: 8 }}>
            <summary className="astra-cursor-pointer" style={{ color: "var(--astra-accent-warm-hover)", fontSize: 12, fontWeight: 700 }}>
              Explanation glossary
            </summary>
            <textarea
              id="popup-simple-explanation-glossary"
              data-testid="popup-explanation-glossary-input"
              value={explanationGlossaryText}
              onChange={(e) => onExplanationGlossaryChange(e.target.value)}
              className="astra-input"
              rows={3}
              placeholder="source term => preferred explanation term"
              style={{ resize: "vertical", minHeight: 66, marginTop: 8 }}
            />
            <div style={{ fontSize: 11, color: "var(--astra-text-hint)", marginTop: 2, lineHeight: 1.4 }}>
              One term per line. If the source term appears, explanations must include the preferred term.
            </div>
          </details>
        </span>
      </div>
    </PopupGroupCard>
  )
}
