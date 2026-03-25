import { useEffect, useMemo, useState } from "react"
import { browser } from "#imports"
import type {
  AstraConfig,
  HoverTrigger,
  SiteConfig,
  TranslationMode,
  TranslationTheme,
} from "@/types/config"
import type { TranslationSnapshot } from "@/types/translation"
import {
  getActiveTabTranslationState,
  startActiveTabTranslation,
  stopActiveTabTranslation,
} from "@/utils/extension/messages"
import { readConfig, saveConfig as persistConfig } from "@/utils/storage/config"
import {
  DEFAULT_ASTRA_CONFIG,
  isDefaultSiteConfig,
  normalizeSiteKey,
  resolveSiteTranslationSettings,
} from "@/types/config"

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

async function getActiveSiteKey(): Promise<string | null> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
  if (!tab?.url) return null
  if (!/^https?:/i.test(tab.url)) return null
  return normalizeSiteKey(tab.url)
}

export default function App() {
  const [configDraft, setConfigDraft] = useState<AstraConfig>(DEFAULT_ASTRA_CONFIG)
  const [saved, setSaved] = useState(false)
  const [statusMessage, setStatusMessage] = useState("")
  const [translationState, setTranslationState] = useState<TranslationSnapshot | null>(null)
  const [contentAvailable, setContentAvailable] = useState(true)
  const [activeSiteKey, setActiveSiteKey] = useState<string | null>(null)

  const resolvedSite = useMemo(
    () => resolveSiteTranslationSettings(configDraft, activeSiteKey),
    [configDraft, activeSiteKey],
  )

  const rawSiteRule = useMemo(
    () => (activeSiteKey ? configDraft.sites[activeSiteKey] : undefined),
    [configDraft.sites, activeSiteKey],
  )

  const refreshTranslationState = async () => {
    const stateResponse = await getActiveTabTranslationState()
    if (stateResponse.ok) {
      setTranslationState(stateResponse.state)
      setContentAvailable(true)
      setStatusMessage("")
    } else {
      setTranslationState(stateResponse.state ?? null)
      setContentAvailable(stateResponse.error.code !== "CONTENT_UNAVAILABLE")
      setStatusMessage(stateResponse.error.message)
    }
  }

  const refreshAll = async () => {
    const [config, siteKey] = await Promise.all([
      readConfig(),
      getActiveSiteKey(),
    ])
    setConfigDraft(config)
    setActiveSiteKey(siteKey)
    await refreshTranslationState()
  }

  useEffect(() => {
    void refreshAll()
  }, [])

  useEffect(() => {
    const handleWindowFocus = () => {
      void refreshAll()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshAll()
      }
    }

    const handleTabActivated = () => {
      void refreshAll()
    }

    window.addEventListener("focus", handleWindowFocus)
    document.addEventListener("visibilitychange", handleVisibilityChange)
    browser.tabs.onActivated?.addListener(handleTabActivated)

    return () => {
      window.removeEventListener("focus", handleWindowFocus)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      browser.tabs.onActivated?.removeListener(handleTabActivated)
    }
  }, [])

  const updateProvider = (patch: Partial<AstraConfig["provider"]>) => {
    setConfigDraft((current) => ({
      ...current,
      provider: { ...current.provider, ...patch },
    }))
  }

  const updatePresentation = (patch: Partial<AstraConfig["presentation"]>) => {
    setConfigDraft((current) => ({
      ...current,
      presentation: { ...current.presentation, ...patch },
    }))
  }

  const editActiveSiteRule = (mutate: (current: SiteConfig) => SiteConfig) => {
    if (!activeSiteKey) return

    setConfigDraft((current) => {
      const baseSiteRule: SiteConfig = current.sites[activeSiteKey]
        ? {
            ...current.sites[activeSiteKey],
            ...(current.sites[activeSiteKey].presentation
              ? { presentation: { ...current.sites[activeSiteKey].presentation } }
              : {}),
          }
        : {
            enabled: true,
            alwaysTranslate: false,
          }

      const nextSiteRule = mutate(baseSiteRule)
      const nextSites = { ...current.sites }

      if (isDefaultSiteConfig(nextSiteRule)) {
        delete nextSites[activeSiteKey]
      } else {
        nextSites[activeSiteKey] = nextSiteRule
      }

      return {
        ...current,
        sites: nextSites,
      }
    })
  }

  const handleSaveConfig = async () => {
    try {
      const nextConfig = await persistConfig({
        targetLang: configDraft.targetLang,
        provider: {
          apiKey: configDraft.provider.apiKey,
          baseURL: configDraft.provider.baseURL ?? "",
          model: configDraft.provider.model,
        },
        presentation: configDraft.presentation,
        hoverTrigger: configDraft.hoverTrigger,
        ...(activeSiteKey
          ? {
              sites: {
                [activeSiteKey]: configDraft.sites[activeSiteKey] ?? {},
              },
            }
          : {}),
      })
      setConfigDraft(nextConfig)
      setSaved(true)
      setStatusMessage("")
      setTimeout(() => setSaved(false), 2000)

      if (activeSiteKey && !resolveSiteTranslationSettings(nextConfig, activeSiteKey).enabled) {
        await stopActiveTabTranslation()
      }

      await refreshTranslationState()
    } catch (error) {
      setSaved(false)
      setStatusMessage(error instanceof Error ? error.message : "保存设置失败")
    }
  }

  const translate = async () => {
    const response = await startActiveTabTranslation({
      targetLang: resolvedSite.targetLang,
      translationMode: resolvedSite.presentation.mode,
      translationTheme: resolvedSite.presentation.theme,
    })
    if (response.ok) {
      setTranslationState(response.state)
      setContentAvailable(true)
      setStatusMessage("")
    } else {
      setTranslationState(response.state ?? null)
      setContentAvailable(response.error.code !== "CONTENT_UNAVAILABLE")
      setStatusMessage(response.error.message)
    }
  }

  const removeTranslation = async () => {
    const response = await stopActiveTabTranslation()
    if (response.ok) {
      setTranslationState(response.state)
      setContentAvailable(true)
      setStatusMessage("")
    } else {
      setTranslationState(response.state ?? null)
      setContentAvailable(response.error.code !== "CONTENT_UNAVAILABLE")
      setStatusMessage(response.error.message)
    }
  }

  const isIdle = translationState?.phase === "idle" || translationState === null
  const contentUnavailable = !contentAvailable
  const translateDisabled = !isIdle || contentUnavailable || !resolvedSite.enabled
  const removeDisabled = isIdle || contentUnavailable

  const currentPhase = translationState?.phase ?? "idle"
  const currentProgress = translationState?.progress
  const currentPresentation = translationState?.presentation ?? resolvedSite.presentation
  const currentSite = translationState?.site ?? {
    hostname: activeSiteKey,
    enabled: resolvedSite.enabled,
    alwaysTranslate: resolvedSite.alwaysTranslate,
  }

  const siteTargetLangValue = rawSiteRule?.targetLang ?? INHERIT_VALUE
  const siteHoverTriggerValue = rawSiteRule?.hoverTrigger ?? INHERIT_VALUE
  const siteModeValue = rawSiteRule?.presentation?.mode ?? INHERIT_VALUE
  const siteThemeValue = rawSiteRule?.presentation?.theme ?? INHERIT_VALUE

  return (
    <div style={{ width: 340, padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <h2 style={{ margin: "0 0 12px", fontSize: 18, display: "flex", alignItems: "center", gap: 8 }}>
        ✦ Astra
      </h2>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button
          onClick={() => {
            void translate()
          }}
          style={{ ...btnPrimary, ...(translateDisabled ? btnDisabled : {}) }}
          disabled={translateDisabled}
        >
          翻译此页
        </button>
        <button
          onClick={() => {
            void removeTranslation()
          }}
          style={{ ...btnSecondary, ...(removeDisabled ? btnDisabled : {}) }}
          disabled={removeDisabled}
        >
          移除翻译
        </button>
      </div>

      <div style={statusCardStyle}>
        <div style={statusRowStyle}>
          <span>状态</span>
          <strong>{currentPhase}</strong>
        </div>
        <div style={statusRowStyle}>
          <span>目标语言</span>
          <strong>{translationState?.targetLang ?? resolvedSite.targetLang}</strong>
        </div>
        <div style={statusRowStyle}>
          <span>模式 / 主题</span>
          <strong>{currentPresentation.mode} / {currentPresentation.theme}</strong>
        </div>
        <div style={statusRowStyle}>
          <span>站点</span>
          <strong>{currentSite.hostname ?? "当前页面"}</strong>
        </div>
        <div style={statusRowStyle}>
          <span>进度</span>
          <strong>
            {currentProgress
              ? `${currentProgress.translatedBlocks}/${currentProgress.totalBlocks}`
              : "0/0"}
          </strong>
        </div>
        {currentProgress && currentPhase !== "idle" && (
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>
            queued {currentProgress.queuedBlocks} · in-flight {currentProgress.inFlightBlocks} · failed {currentProgress.failedBlocks}
          </div>
        )}
        {translationState?.lastError && (
          <div style={warningStyle}>{translationState.lastError.message}</div>
        )}
        {!resolvedSite.enabled && (
          <div style={warningStyle}>Astra 已在此站点禁用。</div>
        )}
      </div>

      <details open style={{ marginBottom: 12 }}>
        <summary style={{ cursor: "pointer", fontSize: 13, color: "#6366f1" }}>
          ⚙ 全局设置
        </summary>
        <div style={{ marginTop: 8 }}>
          <label style={labelStyle}>API Key</label>
          <input
            type="password"
            value={configDraft.provider.apiKey}
            onChange={(e) => updateProvider({ apiKey: e.target.value })}
            placeholder="sk-..."
            style={inputStyle}
          />

          <label style={labelStyle}>Base URL (可选)</label>
          <input
            value={configDraft.provider.baseURL ?? ""}
            onChange={(e) => updateProvider({ baseURL: e.target.value })}
            placeholder="https://api.openai.com/v1"
            style={inputStyle}
          />

          <label style={labelStyle}>模型</label>
          <input
            value={configDraft.provider.model}
            onChange={(e) => updateProvider({ model: e.target.value })}
            placeholder="gpt-4o-mini"
            style={inputStyle}
          />

          <label style={labelStyle}>目标语言</label>
          <select
            value={configDraft.targetLang}
            onChange={(e) => setConfigDraft((current) => ({ ...current, targetLang: e.target.value }))}
            style={inputStyle}
          >
            {LANGUAGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>

          <label style={labelStyle}>悬停翻译触发</label>
          <select
            value={configDraft.hoverTrigger}
            onChange={(e) => setConfigDraft((current) => ({
              ...current,
              hoverTrigger: e.target.value as HoverTrigger,
            }))}
            style={inputStyle}
          >
            {HOVER_TRIGGER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>

          <label style={labelStyle}>翻译模式</label>
          <select
            value={configDraft.presentation.mode}
            onChange={(e) => updatePresentation({ mode: e.target.value as TranslationMode })}
            style={inputStyle}
          >
            <option value="bilingual">双语对照</option>
            <option value="translation-only">仅译文</option>
          </select>

          <label style={labelStyle}>翻译主题</label>
          <select
            value={configDraft.presentation.theme}
            onChange={(e) => updatePresentation({ theme: e.target.value as TranslationTheme })}
            style={inputStyle}
          >
            <option value="default">默认</option>
            <option value="underline">下划线</option>
            <option value="highlight">高亮</option>
          </select>
        </div>
      </details>

      {activeSiteKey && (
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
                onChange={(e) => editActiveSiteRule((siteRule) => ({
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
                onChange={(e) => editActiveSiteRule((siteRule) => ({
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
              onChange={(e) => editActiveSiteRule((siteRule) => {
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
              <option value={INHERIT_VALUE}>跟随全局（{configDraft.targetLang}）</option>
              {LANGUAGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>

            <label style={labelStyle}>站点悬停触发</label>
            <select
              value={siteHoverTriggerValue}
              onChange={(e) => editActiveSiteRule((siteRule) => {
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
              <option value={INHERIT_VALUE}>跟随全局（{getHoverTriggerLabel(configDraft.hoverTrigger)}）</option>
              {HOVER_TRIGGER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>

            <label style={labelStyle}>站点翻译模式</label>
            <select
              value={siteModeValue}
              onChange={(e) => editActiveSiteRule((siteRule) => {
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
              <option value={INHERIT_VALUE}>跟随全局（{configDraft.presentation.mode}）</option>
              <option value="bilingual">双语对照</option>
              <option value="translation-only">仅译文</option>
            </select>

            <label style={labelStyle}>站点翻译主题</label>
            <select
              value={siteThemeValue}
              onChange={(e) => editActiveSiteRule((siteRule) => {
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
              <option value={INHERIT_VALUE}>跟随全局（{configDraft.presentation.theme}）</option>
              <option value="default">默认</option>
              <option value="underline">下划线</option>
              <option value="highlight">高亮</option>
            </select>
          </div>
        </details>
      )}

      <button
        onClick={() => {
          void handleSaveConfig()
        }}
        style={{ ...btnPrimary, width: "100%", marginTop: 4 }}
      >
        {saved ? "✓ 已保存" : "保存设置"}
      </button>

      {statusMessage && (
        <div style={warningStyle}>
          {statusMessage}
        </div>
      )}

      <div style={{ fontSize: 11, color: "#94a3b8", textAlign: "center", marginTop: 10 }}>
        Astra v0.1.0 · {currentPhase} · AI 双语翻译
      </div>
    </div>
  )
}

const btnPrimary: React.CSSProperties = {
  flex: 1,
  padding: "8px 12px",
  background: "#6366f1",
  color: "#fff",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 14,
  fontWeight: 500,
}

const btnSecondary: React.CSSProperties = {
  flex: 1,
  padding: "8px 12px",
  background: "#f1f5f9",
  color: "#334155",
  border: "1px solid #e2e8f0",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 14,
}

const btnDisabled: React.CSSProperties = {
  opacity: 0.55,
  cursor: "not-allowed",
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  color: "#64748b",
  marginBottom: 4,
  marginTop: 8,
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "6px 8px",
  border: "1px solid #e2e8f0",
  borderRadius: 4,
  fontSize: 13,
  boxSizing: "border-box",
}

const statusCardStyle: React.CSSProperties = {
  marginBottom: 12,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  padding: 10,
}

const statusRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 8,
  fontSize: 12,
  color: "#334155",
  marginBottom: 4,
}

const checkboxRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontSize: 13,
  color: "#334155",
  marginBottom: 8,
}

const warningStyle: React.CSSProperties = {
  marginTop: 10,
  fontSize: 12,
  color: "#b45309",
  background: "#fff7ed",
  border: "1px solid #fdba74",
  borderRadius: 6,
  padding: "8px 10px",
}
