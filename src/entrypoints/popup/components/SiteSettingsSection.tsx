import type {
  AstraConfig,
  ContentScope,
  HoverTrigger,
  SiteConfig,
  TranslationMode,
  TranslationTheme,
} from "@/types/config"
import { t } from "@/utils/i18n"
import { labelStyle, inputStyle, checkboxRowStyle } from "./styles"

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

function getHoverTriggerLabel(trigger: HoverTrigger): string {
  const option = HOVER_TRIGGER_OPTIONS.find((o) => o.value === trigger)
  return option ? t(option.labelKey) : trigger
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

  return (
    <details open style={{ marginBottom: 12 }}>
      <summary style={{ cursor: "pointer", fontSize: 13, color: "#6366f1" }}>
        {t("popup_currentSite")}
      </summary>
      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>{activeSiteKey}</div>
        <label style={checkboxRowStyle}>
          <input
            type="checkbox"
            checked={rawSiteRule?.enabled ?? true}
            onChange={(e) => onSiteRuleChange((siteRule) => ({
              ...siteRule,
              enabled: e.target.checked,
            }))}
          />
          <span>{t("label_enableAstra")}</span>
        </label>
        <label style={checkboxRowStyle}>
          <input
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

        <label style={labelStyle}>{t("label_siteTargetLang")}</label>
        <select
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
          style={inputStyle}
        >
          <option value={INHERIT_VALUE}>{t("label_inheritGlobal", globalConfig.targetLang)}</option>
          {LANGUAGE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>

        <label style={labelStyle}>{t("label_siteHoverTrigger")}</label>
        <select
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
          style={inputStyle}
        >
          <option value={INHERIT_VALUE}>{t("label_inheritGlobal", getHoverTriggerLabel(globalConfig.hoverTrigger))}</option>
          {HOVER_TRIGGER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{t(option.labelKey)}</option>
          ))}
        </select>

        <label style={labelStyle}>{t("label_siteTranslationMode")}</label>
        <select
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
          style={inputStyle}
        >
          <option value={INHERIT_VALUE}>{t("label_inheritGlobal", globalConfig.presentation.mode)}</option>
          <option value="bilingual">{t("modeBilingual")}</option>
          <option value="translation-only">{t("modeTranslationOnly")}</option>
        </select>

        <label style={labelStyle}>{t("label_siteTranslationTheme")}</label>
        <select
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
          style={inputStyle}
        >
          <option value={INHERIT_VALUE}>{t("label_inheritGlobal", globalConfig.presentation.theme)}</option>
          <option value="default">{t("themeDefault")}</option>
          <option value="underline">{t("themeUnderline")}</option>
          <option value="highlight">{t("themeHighlight")}</option>
        </select>

        <label style={labelStyle}>{t("label_siteTranslationScope")}</label>
        <select
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
          style={inputStyle}
        >
          <option value={INHERIT_VALUE}>{t("label_inheritGlobal", globalConfig.contentScope === "article" ? t("scopeArticle") : t("scopePage"))}</option>
          <option value="page">{t("scopePage")}</option>
          <option value="article">{t("scopeArticle")}</option>
        </select>
      </div>
    </details>
  )
}
