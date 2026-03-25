import type {
  AstraConfig,
  HoverTrigger,
  SiteConfig,
  TranslationMode,
  TranslationTheme,
} from "@/types/config"
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
  { value: "alt", label: "Alt + 悬停" },
  { value: "disabled", label: "关闭" },
] as const

function getHoverTriggerLabel(trigger: HoverTrigger): string {
  return HOVER_TRIGGER_OPTIONS.find((option) => option.value === trigger)?.label ?? trigger
}

export interface SiteSettingsSectionProps {
  activeSiteKey: string
  rawSiteRule: SiteConfig | undefined
  globalConfig: Pick<AstraConfig, "targetLang" | "hoverTrigger" | "presentation">
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
        🌐 当前站点
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
          <span>在此站点启用 Astra</span>
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
          <span>打开页面时自动翻译</span>
        </label>

        <label style={labelStyle}>站点目标语言</label>
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
          <option value={INHERIT_VALUE}>跟随全局（{globalConfig.targetLang}）</option>
          {LANGUAGE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>

        <label style={labelStyle}>站点悬停触发</label>
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
          <option value={INHERIT_VALUE}>跟随全局（{getHoverTriggerLabel(globalConfig.hoverTrigger)}）</option>
          {HOVER_TRIGGER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>

        <label style={labelStyle}>站点翻译模式</label>
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
          <option value={INHERIT_VALUE}>跟随全局（{globalConfig.presentation.mode}）</option>
          <option value="bilingual">双语对照</option>
          <option value="translation-only">仅译文</option>
        </select>

        <label style={labelStyle}>站点翻译主题</label>
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
          <option value={INHERIT_VALUE}>跟随全局（{globalConfig.presentation.theme}）</option>
          <option value="default">默认</option>
          <option value="underline">下划线</option>
          <option value="highlight">高亮</option>
        </select>
      </div>
    </details>
  )
}
