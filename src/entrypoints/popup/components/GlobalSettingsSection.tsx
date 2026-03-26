import type {
  AstraConfig,
  ContentScope,
  HoverTrigger,
  ProviderId,
  TranslationMode,
  TranslationTheme,
} from "@/types/config"
import { getDefaultProviderModel } from "@/types/config"
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
  { value: "alt", label: "Alt + 悬停" },
  { value: "always", label: "始终悬停" },
  { value: "disabled", label: "关闭" },
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
}

export default function GlobalSettingsSection({
  config,
  onProviderChange,
  onPresentationChange,
  onTargetLangChange,
  onHoverTriggerChange,
  onContentScopeChange,
}: GlobalSettingsSectionProps) {
  return (
    <details open style={{ marginBottom: 12 }}>
      <summary style={{ cursor: "pointer", fontSize: 13, color: "#6366f1" }}>
        ⚙ 全局设置
      </summary>
      <div style={{ marginTop: 8 }}>
        <label style={labelStyle}>模型提供方</label>
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

        <label style={labelStyle}>API Key（直连模式，选填）</label>
        <input
          type="password"
          value={config.provider.apiKey ?? ""}
          onChange={(e) => onProviderChange({ apiKey: e.target.value })}
          placeholder={config.provider.id === "gemini" ? "AIzaSy..." : "sk-..."}
          style={inputStyle}
        />
        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
          填写后直连 {config.provider.id === "gemini" ? "Google" : "OpenAI"} API，无需 Astra 账号
        </div>

        <label style={labelStyle}>Astra Relay URL（托管模式，选填）</label>
        <input
          value={config.provider.relayBaseURL ?? ""}
          onChange={(e) => onProviderChange({ relayBaseURL: e.target.value })}
          placeholder="https://api.astra.example/v1"
          style={inputStyle}
        />

        <label style={labelStyle}>模型</label>
        <input
          value={config.provider.model}
          onChange={(e) => onProviderChange({ model: e.target.value })}
          placeholder={getDefaultProviderModel(config.provider.id)}
          style={inputStyle}
        />

        <label style={labelStyle}>目标语言</label>
        <select
          value={config.targetLang}
          onChange={(e) => onTargetLangChange(e.target.value)}
          style={inputStyle}
        >
          {LANGUAGE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>

        <label style={labelStyle}>悬停翻译触发</label>
        <select
          value={config.hoverTrigger}
          onChange={(e) => onHoverTriggerChange(e.target.value as HoverTrigger)}
          style={inputStyle}
        >
          {HOVER_TRIGGER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>

        <label style={labelStyle}>翻译模式</label>
        <select
          value={config.presentation.mode}
          onChange={(e) => onPresentationChange({ mode: e.target.value as TranslationMode })}
          style={inputStyle}
        >
          <option value="bilingual">双语对照</option>
          <option value="translation-only">仅译文</option>
        </select>

        <label style={labelStyle}>翻译主题</label>
        <select
          value={config.presentation.theme}
          onChange={(e) => onPresentationChange({ theme: e.target.value as TranslationTheme })}
          style={inputStyle}
        >
          <option value="default">默认</option>
          <option value="underline">下划线</option>
          <option value="highlight">高亮</option>
        </select>

        <label style={labelStyle}>翻译范围</label>
        <select
          value={config.contentScope}
          onChange={(e) => onContentScopeChange(e.target.value as ContentScope)}
          style={inputStyle}
        >
          <option value="page">整页翻译</option>
          <option value="article">文章区域</option>
        </select>
      </div>
    </details>
  )
}
