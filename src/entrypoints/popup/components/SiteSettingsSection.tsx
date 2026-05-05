import { useEffect, useState } from "react"
import type {
  AstraConfig,
  ContentScope,
  HoverTrigger,
  SiteConfig,
  TranslationMode,
  TranslationTheme,
} from "@/types/config"
import { t } from "@/utils/i18n"
import { exportSingleSiteRule, importSiteRules } from "@/utils/storage/site-rules"
import { labelStyle, checkboxRowStyle, warningStyle } from "./styles"
import { browser } from "#imports"
import type { ContentDetectArticleResponse } from "@/types/messages"

const INHERIT_VALUE = "__inherit__"

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

const textareaStyle: React.CSSProperties = {
  minHeight: 72,
  resize: "vertical",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: 12,
}

const cssEditorStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  boxSizing: "border-box" as const,
  minHeight: 80,
  resize: "vertical",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: 12,
  background: "var(--astra-code-bg)",
  color: "var(--astra-code-text)",
  border: "1px solid var(--astra-code-border)",
  borderRadius: 6,
  padding: "8px 10px",
  lineHeight: 1.5,
}

const PARAGRAPH_SLIDER_MAX = 60
const PARAGRAPH_SLIDER_LABELS: Array<{ value: number; label: string }> = [
  { value: 0, label: "0" },
  { value: 10, label: "10" },
  { value: 30, label: "30" },
  { value: 50, label: "50" },
]

function getHoverTriggerLabel(trigger: HoverTrigger): string {
  const option = HOVER_TRIGGER_OPTIONS.find((o) => o.value === trigger)
  return option ? t(option.labelKey) : trigger
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

function hasAdvancedRules(siteRule?: SiteConfig): boolean {
  return !!siteRule?.selectors?.length
    || !!siteRule?.excludeSelectors?.length
    || siteRule?.paragraphMinLength != null
    || !!siteRule?.customCss
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

function getParagraphLengthLabel(value: number | undefined): string {
  if (value == null || value === 0) return t("label_paragraphFilterNone")
  if (value <= 10) return t("label_paragraphFilterShort")
  if (value <= 30) return t("label_paragraphFilterMedium")
  return t("label_paragraphFilterLong")
}

export interface SiteSettingsSectionProps {
  activeSiteKey: string
  rawSiteRule: SiteConfig | undefined
  globalConfig: Pick<AstraConfig, "targetLang" | "hoverTrigger" | "presentation" | "contentScope">
  onSiteRuleChange: (mutate: (current: SiteConfig) => SiteConfig) => void
}

export default function SiteSettingsSection({
  activeSiteKey,
  rawSiteRule,
  globalConfig,
  onSiteRuleChange,
}: SiteSettingsSectionProps) {
  const siteTargetLangValue = rawSiteRule?.targetLang ?? INHERIT_VALUE
  const siteHoverTriggerValue = rawSiteRule?.hoverTrigger ?? INHERIT_VALUE
  const siteModeValue = rawSiteRule?.presentation?.mode ?? INHERIT_VALUE
  const siteThemeValue = rawSiteRule?.presentation?.theme ?? INHERIT_VALUE
  const siteFontSizeValue = rawSiteRule?.presentation?.fontSize != null
    ? String(rawSiteRule.presentation.fontSize)
    : ""
  const advancedConfigured = hasAdvancedRules(rawSiteRule)
  const [selectorsValue, setSelectorsValue] = useState(() => toMultilineValue(rawSiteRule?.selectors))
  const [excludeSelectorsValue, setExcludeSelectorsValue] = useState(() => toMultilineValue(rawSiteRule?.excludeSelectors))
  const [selectorsError, setSelectorsError] = useState<string | null>(null)
  const [excludeSelectorsError, setExcludeSelectorsError] = useState<string | null>(null)
  const [customCssValue, setCustomCssValue] = useState(() => rawSiteRule?.customCss ?? "")
  const [detectingArticle, setDetectingArticle] = useState(false)
  const [ruleStatus, setRuleStatus] = useState<string | null>(null)

  const paragraphSliderValue = rawSiteRule?.paragraphMinLength ?? 0

  useEffect(() => {
    setSelectorsValue(toMultilineValue(rawSiteRule?.selectors))
    setExcludeSelectorsValue(toMultilineValue(rawSiteRule?.excludeSelectors))
    setSelectorsError(null)
    setExcludeSelectorsError(null)
    setCustomCssValue(rawSiteRule?.customCss ?? "")
  }, [activeSiteKey, rawSiteRule?.selectors, rawSiteRule?.excludeSelectors, rawSiteRule?.customCss])

  async function handleDetectArticle() {
    setDetectingArticle(true)
    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
      if (!tab?.id) return

      const response = await browser.tabs.sendMessage(tab.id, {
        type: "content/detect-article",
      }) as ContentDetectArticleResponse

      if (response?.ok && response.selector) {
        const current = fromMultilineValue(selectorsValue) ?? []
        if (!current.includes(response.selector)) {
          const next = [...current, response.selector]
          setSelectorsValue(next.join("\n"))
          onSiteRuleChange((siteRule) => ({
            ...siteRule,
            selectors: next,
          }))
        }
      }
    } catch {
      // Content script may not be available
    } finally {
      setDetectingArticle(false)
    }
  }

  return (
    <details open style={{ marginBottom: 12 }}>
      <summary className="astra-cursor-pointer" style={{ fontSize: 13, color: "var(--astra-accent-warm-hover)" }}>
        {t("popup_currentSite")}
      </summary>
      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: 12, color: "var(--astra-text-muted)", marginBottom: 8 }}>{activeSiteKey}</div>
        <label htmlFor="site-enable-astra-checkbox" style={checkboxRowStyle}>
          <input
            id="site-enable-astra-checkbox"
            type="checkbox"
            checked={rawSiteRule?.enabled ?? true}
            onChange={(e) => onSiteRuleChange((siteRule) => ({
              ...siteRule,
              enabled: e.target.checked,
            }))}
          />
          <span>{t("label_enableAstra")}</span>
        </label>
        <label htmlFor="site-auto-translate-checkbox" style={checkboxRowStyle}>
          <input
            id="site-auto-translate-checkbox"
            type="checkbox"
            checked={rawSiteRule?.alwaysTranslate ?? false}
            onChange={(e) => onSiteRuleChange((siteRule) => ({
              ...siteRule,
              alwaysTranslate: e.target.checked,
            }))}
            disabled={!(rawSiteRule?.enabled ?? true)}
          />
          <span>{t("label_autoTranslate")}</span>
        </label>

        <label htmlFor="site-target-language" style={labelStyle}>{t("label_siteTargetLang")}</label>
        <select
          id="site-target-language"
          value={siteTargetLangValue}
          onChange={(e) => onSiteRuleChange((siteRule) => {
            const nextSiteRule: SiteConfig = {
              ...siteRule,
              ...(siteRule.presentation ? { presentation: { ...siteRule.presentation } } : {}),
            }

            if (e.target.value === INHERIT_VALUE) {
              delete nextSiteRule.targetLang
            } else {
              nextSiteRule.targetLang = e.target.value
            }

            return nextSiteRule
          })}
          className="astra-input"
        >
          <option value={INHERIT_VALUE}>{t("label_inheritGlobal", globalConfig.targetLang)}</option>
          {LANGUAGE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>

        <label htmlFor="site-hover-trigger" style={labelStyle}>{t("label_siteHoverTrigger")}</label>
        <select
          id="site-hover-trigger"
          value={siteHoverTriggerValue}
          onChange={(e) => onSiteRuleChange((siteRule) => {
            const nextSiteRule: SiteConfig = {
              ...siteRule,
              ...(siteRule.presentation ? { presentation: { ...siteRule.presentation } } : {}),
            }

            if (e.target.value === INHERIT_VALUE) {
              delete nextSiteRule.hoverTrigger
            } else {
              nextSiteRule.hoverTrigger = e.target.value as HoverTrigger
            }

            return nextSiteRule
          })}
          className="astra-input"
        >
          <option value={INHERIT_VALUE}>{t("label_inheritGlobal", getHoverTriggerLabel(globalConfig.hoverTrigger))}</option>
          {HOVER_TRIGGER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{t(option.labelKey)}</option>
          ))}
        </select>

        <label htmlFor="site-translation-mode" style={labelStyle}>{t("label_siteTranslationMode")}</label>
        <select
          id="site-translation-mode"
          value={siteModeValue}
          onChange={(e) => onSiteRuleChange((siteRule) => {
            const nextPresentation = { ...(siteRule.presentation ?? {}) }
            if (e.target.value === INHERIT_VALUE) {
              delete nextPresentation.mode
            } else {
              nextPresentation.mode = e.target.value as TranslationMode
            }

            return {
              ...siteRule,
              ...(Object.keys(nextPresentation).length > 0
                ? { presentation: nextPresentation }
                : { presentation: undefined }),
            }
          })}
          className="astra-input"
        >
          <option value={INHERIT_VALUE}>{t("label_inheritGlobal", globalConfig.presentation.mode)}</option>
          <option value="bilingual">{t("modeBilingual")}</option>
          <option value="translation-only">{t("modeTranslationOnly")}</option>
        </select>

        <label htmlFor="site-translation-theme" style={labelStyle}>{t("label_siteTranslationTheme")}</label>
        <select
          id="site-translation-theme"
          value={siteThemeValue}
          onChange={(e) => onSiteRuleChange((siteRule) => {
            const nextPresentation = { ...(siteRule.presentation ?? {}) }
            if (e.target.value === INHERIT_VALUE) {
              delete nextPresentation.theme
            } else {
              nextPresentation.theme = e.target.value as TranslationTheme
            }

            return {
              ...siteRule,
              ...(Object.keys(nextPresentation).length > 0
                ? { presentation: nextPresentation }
                : { presentation: undefined }),
            }
          })}
          className="astra-input"
        >
          <option value={INHERIT_VALUE}>{t("label_inheritGlobal", globalConfig.presentation.theme)}</option>
          <option value="default">{t("themeDefault")}</option>
          <option value="underline">{t("themeUnderline")}</option>
          <option value="highlight">{t("themeHighlight")}</option>
          <option value="mask">{t("themeMask")}</option>
        </select>

        <label htmlFor="site-translation-font-size" style={labelStyle}>{t("label_siteTranslationFontSize")}</label>
        <input
          id="site-translation-font-size"
          data-testid="site-font-size-input"
          type="number"
          min={0.5}
          max={2}
          step={0.05}
          value={siteFontSizeValue}
          onChange={(e) => onSiteRuleChange((siteRule) => {
            const nextPresentation = { ...(siteRule.presentation ?? {}) }
            const raw = e.target.value.trim()

            if (!raw) {
              delete nextPresentation.fontSize
            } else {
              const parsed = Number.parseFloat(raw)
              if (Number.isFinite(parsed)) {
                nextPresentation.fontSize = Math.min(2, Math.max(0.5, parsed))
              }
            }

            return {
              ...siteRule,
              ...(Object.keys(nextPresentation).length > 0
                ? { presentation: nextPresentation }
                : { presentation: undefined }),
            }
          })}
          placeholder={String(globalConfig.presentation.fontSize)}
          className="astra-input"
        />
        <div style={{ fontSize: 11, color: "var(--astra-text-muted)", marginTop: 4 }}>
          {t("label_inheritGlobal", String(globalConfig.presentation.fontSize))}
        </div>

        <label htmlFor="site-translation-scope" style={labelStyle}>{t("label_siteTranslationScope")}</label>
        <select
          id="site-translation-scope"
          value={rawSiteRule?.contentScope ?? INHERIT_VALUE}
          onChange={(e) => onSiteRuleChange((siteRule) => {
            const nextSiteRule: SiteConfig = {
              ...siteRule,
              ...(siteRule.presentation ? { presentation: { ...siteRule.presentation } } : {}),
            }

            if (e.target.value === INHERIT_VALUE) {
              delete nextSiteRule.contentScope
            } else {
              nextSiteRule.contentScope = e.target.value as ContentScope
            }

            return nextSiteRule
          })}
          className="astra-input"
        >
          <option value={INHERIT_VALUE}>{t("label_inheritGlobal", globalConfig.contentScope === "article" ? t("scopeArticle") : t("scopePage"))}</option>
          <option value="page">{t("scopePage")}</option>
          <option value="article">{t("scopeArticle")}</option>
        </select>

        <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
          <button
            data-testid="site-export-rule-btn"
            type="button"
            className="astra-btn-secondary"
            style={{ flex: "none", padding: "4px 10px", fontSize: 11 }}
            onClick={() => {
              const siteConfig: SiteConfig = rawSiteRule ?? { enabled: true, alwaysTranslate: false }
              const json = exportSingleSiteRule(activeSiteKey, siteConfig)
              void navigator.clipboard.writeText(json).then(() => {
                setRuleStatus(t("siteRules_ruleExported"))
                setTimeout(() => setRuleStatus(null), 2000)
              })
            }}
          >
            {t("siteRules_exportRule")}
          </button>
          <button
            data-testid="site-import-rule-btn"
            type="button"
            className="astra-btn-secondary"
            style={{ flex: "none", padding: "4px 10px", fontSize: 11 }}
            onClick={async () => {
              try {
                const text = await navigator.clipboard.readText()
                const dummyConfig = {
                  ...globalConfig,
                  version: 1 as const,
                  connectionMode: "astra" as const,
                  inputTranslation: "enabled" as const,
                  inputTranslationMode: "replace" as const,
                  languageLevel: "intermediate" as const,
                  explainMode: "deep" as const,
                  explanationGlossary: [],
                  privacyMode: false,
                  provider: { id: "openai" as const, accessToken: "", apiKey: "", model: "gpt-5.4-nano" },
                  tts: { enabled: true, engine: "browser" as const, rate: 0.9, pitch: 1.0, highlightSentences: true },
                  sites: {},
                  customActions: [],
                }
                const result = importSiteRules(text, dummyConfig)
                const importedRule = result.sites[activeSiteKey]
                if (importedRule) {
                  onSiteRuleChange(() => importedRule)
                  setRuleStatus(t("siteRules_ruleImported"))
                } else {
                  // If the imported JSON has a different hostname, apply the first rule found
                  const firstHostname = Object.keys(result.sites)[0]
                  if (firstHostname && result.sites[firstHostname]) {
                    onSiteRuleChange(() => result.sites[firstHostname])
                    setRuleStatus(t("siteRules_ruleImported"))
                  } else {
                    setRuleStatus(t("siteRules_invalidRuleFormat"))
                  }
                }
              } catch {
                setRuleStatus(t("siteRules_invalidRuleFormat"))
              }
              setTimeout(() => setRuleStatus(null), 2000)
            }}
          >
            {t("siteRules_importRule")}
          </button>
        </div>
        {ruleStatus && (
          <div data-testid="site-rule-status" style={{ fontSize: 11, color: "var(--astra-success)", marginTop: 4 }}>{ruleStatus}</div>
        )}

        <details data-testid="site-advanced-rules" style={{ marginTop: 12 }}>
          <summary className="astra-cursor-pointer" style={{ fontSize: 12, color: "var(--astra-text-secondary)", display: "flex", alignItems: "center", gap: 6 }}>
            {t("label_siteAdvancedRules")}
            {advancedConfigured && (
              <span style={{ fontSize: 11, color: "var(--astra-success)", background: "var(--astra-success-bg)", padding: "2px 6px", borderRadius: 999 }}>
                {t("label_advanced")}
              </span>
            )}
          </summary>
          <div style={{ marginTop: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <label htmlFor="site-selectors-input" style={{ ...labelStyle, marginBottom: 0, marginTop: 0, flex: 1 }}>{t("label_siteIncludeSelectors")}</label>
              <button
                data-testid="site-detect-article-btn"
                type="button"
                onClick={() => void handleDetectArticle()}
                disabled={detectingArticle || !(rawSiteRule?.enabled ?? true)}
                className="astra-btn-secondary"
                style={{
                  flex: "none",
                  padding: "3px 8px",
                  fontSize: 11,
                  opacity: detectingArticle ? 0.6 : 1,
                }}
              >
                {detectingArticle ? "..." : t("label_detectArticle")}
              </button>
            </div>
            <textarea
              id="site-selectors-input"
              data-testid="site-selectors-input"
              value={selectorsValue}
              onChange={(e) => {
                const nextValue = e.target.value
                setSelectorsValue(nextValue)
                const selectors = fromMultilineValue(nextValue)
                const invalidSelectors = getInvalidSelectors(selectors)
                if (invalidSelectors.length > 0) {
                  setSelectorsError(t("error_invalidCssSelector", invalidSelectors.join(", ")))
                  return
                }

                setSelectorsError(null)
                onSiteRuleChange((siteRule) => {
                  const nextSiteRule: SiteConfig = { ...siteRule }
                  if (selectors) {
                    nextSiteRule.selectors = selectors
                  } else {
                    delete nextSiteRule.selectors
                  }
                  return nextSiteRule
                })
              }}
              placeholder={`article\n.content`}
              className="astra-input"
              style={textareaStyle}
              disabled={!(rawSiteRule?.enabled ?? true)}
            />
            <div style={{ fontSize: 11, color: "var(--astra-text-muted)", marginTop: 4 }}>{t("hint_siteSelectorsPerLine")}</div>
            {selectorsError && (
              <div data-testid="site-selectors-error" style={warningStyle}>{selectorsError}</div>
            )}

            <label htmlFor="site-exclude-selectors-input" style={labelStyle}>{t("label_siteExcludeSelectors")}</label>
            <textarea
              id="site-exclude-selectors-input"
              data-testid="site-exclude-selectors-input"
              value={excludeSelectorsValue}
              onChange={(e) => {
                const nextValue = e.target.value
                setExcludeSelectorsValue(nextValue)
                const excludeSelectors = fromMultilineValue(nextValue)
                const invalidSelectors = getInvalidSelectors(excludeSelectors)
                if (invalidSelectors.length > 0) {
                  setExcludeSelectorsError(t("error_invalidCssSelector", invalidSelectors.join(", ")))
                  return
                }

                setExcludeSelectorsError(null)
                onSiteRuleChange((siteRule) => {
                  const nextSiteRule: SiteConfig = { ...siteRule }
                  if (excludeSelectors) {
                    nextSiteRule.excludeSelectors = excludeSelectors
                  } else {
                    delete nextSiteRule.excludeSelectors
                  }
                  return nextSiteRule
                })
              }}
              placeholder={`.comments\naside`}
              className="astra-input"
              style={textareaStyle}
              disabled={!(rawSiteRule?.enabled ?? true)}
            />
            <div style={{ fontSize: 11, color: "var(--astra-text-muted)", marginTop: 4 }}>{t("hint_siteSelectorsPerLine")}</div>
            {excludeSelectorsError && (
              <div data-testid="site-exclude-selectors-error" style={warningStyle}>{excludeSelectorsError}</div>
            )}

            <label htmlFor="site-paragraph-min-length-input" style={labelStyle}>
              {t("label_siteParagraphMinLength")}
              <span style={{ marginLeft: 8, fontSize: 11, color: "var(--astra-text-hint)" }}>
                {getParagraphLengthLabel(rawSiteRule?.paragraphMinLength)}
              </span>
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                data-testid="site-paragraph-min-length-input"
                type="range"
                min="0"
                max={PARAGRAPH_SLIDER_MAX}
                step="1"
                value={paragraphSliderValue}
                onChange={(e) => onSiteRuleChange((siteRule) => {
                  const nextSiteRule: SiteConfig = { ...siteRule }
                  const parsed = Number.parseInt(e.target.value, 10)
                  if (parsed === 0) {
                    delete nextSiteRule.paragraphMinLength
                  } else {
                    nextSiteRule.paragraphMinLength = parsed
                  }
                  return nextSiteRule
                })}
                className="astra-cursor-pointer"
                style={{ flex: 1 }}
                disabled={!(rawSiteRule?.enabled ?? true)}
              />
              <span style={{ fontSize: 12, color: "var(--astra-text-muted)", minWidth: 24, textAlign: "right" }}>
                {paragraphSliderValue}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--astra-text-hint)", marginTop: 2 }}>
              {PARAGRAPH_SLIDER_LABELS.map((mark) => (
                <span key={mark.value}>{mark.label}</span>
              ))}
            </div>
            <div style={{ fontSize: 11, color: "var(--astra-text-hint)", marginTop: 4 }}>{t("hint_siteParagraphMinLength")}</div>

            <label htmlFor="site-custom-css-input" style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 6, marginTop: 12 }}>
              {t("label_siteCustomCss")}
              <span style={{ fontSize: 10, color: "var(--astra-text-hint)", fontWeight: 400 }}>{t("label_preview")}</span>
            </label>
            <textarea
              id="site-custom-css-input"
              data-testid="site-custom-css-input"
              value={customCssValue}
              onChange={(e) => {
                const nextValue = e.target.value
                setCustomCssValue(nextValue)
                onSiteRuleChange((siteRule) => {
                  const nextSiteRule: SiteConfig = { ...siteRule }
                  if (nextValue.trim()) {
                    nextSiteRule.customCss = nextValue
                  } else {
                    delete nextSiteRule.customCss
                  }
                  return nextSiteRule
                })
              }}
              placeholder={`.sidebar { display: none; }\n.content { max-width: 100%; }`}
              className="astra-input"
              style={cssEditorStyle}
              disabled={!(rawSiteRule?.enabled ?? true)}
              maxLength={5000}
            />
            <div style={{ fontSize: 11, color: "var(--astra-text-muted)", marginTop: 4 }}>{t("hint_siteCustomCss")}</div>
          </div>
        </details>
      </div>
    </details>
  )
}
