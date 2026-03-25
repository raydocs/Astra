import { useEffect, useMemo, useRef, useState } from "react"
import { browser } from "#imports"
import type {
  AstraConfig,
  SiteConfig,
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
import TranslationStatusCard from "./components/TranslationStatusCard"
import GlobalSettingsSection from "./components/GlobalSettingsSection"
import SiteSettingsSection from "./components/SiteSettingsSection"
import { btnPrimary, btnSecondary, btnDisabled, warningStyle } from "./components/styles"

async function getActiveSiteKey(): Promise<string | null> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
  if (!tab?.url) return null
  if (!/^https?:/i.test(tab.url)) return null
  return normalizeSiteKey(tab.url)
}

export default function App() {
  const [configDraft, setConfigDraft] = useState<AstraConfig>(DEFAULT_ASTRA_CONFIG)
  const [persistedConfig, setPersistedConfig] = useState<AstraConfig>(DEFAULT_ASTRA_CONFIG)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [saved, setSaved] = useState(false)
  const [statusMessage, setStatusMessage] = useState("")
  const [translationState, setTranslationState] = useState<TranslationSnapshot | null>(null)
  const [contentAvailable, setContentAvailable] = useState(true)
  const [activeSiteKey, setActiveSiteKey] = useState<string | null>(null)
  const hasUnsavedChangesRef = useRef(false)

  hasUnsavedChangesRef.current = hasUnsavedChanges

  const resolvedSite = useMemo(
    () => resolveSiteTranslationSettings(configDraft, activeSiteKey),
    [configDraft, activeSiteKey],
  )

  const persistedResolvedSite = useMemo(
    () => resolveSiteTranslationSettings(persistedConfig, activeSiteKey),
    [persistedConfig, activeSiteKey],
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
    if (!hasUnsavedChangesRef.current) {
      setConfigDraft(config)
    }
    setPersistedConfig(config)
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

  const updateDraft = (mutate: (current: AstraConfig) => AstraConfig) => {
    hasUnsavedChangesRef.current = true
    setHasUnsavedChanges(true)
    setConfigDraft((current) => mutate(current))
  }

  const updateProvider = (patch: Partial<AstraConfig["provider"]>) => {
    updateDraft((current) => ({
      ...current,
      provider: { ...current.provider, ...patch },
    }))
  }

  const updatePresentation = (patch: Partial<AstraConfig["presentation"]>) => {
    updateDraft((current) => ({
      ...current,
      presentation: { ...current.presentation, ...patch },
    }))
  }

  const editActiveSiteRule = (mutate: (current: SiteConfig) => SiteConfig) => {
    if (!activeSiteKey) return

    updateDraft((current) => {
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
        contentScope: configDraft.contentScope,
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
      setPersistedConfig(nextConfig)
      hasUnsavedChangesRef.current = false
      setHasUnsavedChanges(false)
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
      targetLang: persistedResolvedSite.targetLang,
      translationMode: persistedResolvedSite.presentation.mode,
      translationTheme: persistedResolvedSite.presentation.theme,
      contentScope: persistedResolvedSite.contentScope,
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
  const translateDisabled = !isIdle || contentUnavailable || !persistedResolvedSite.enabled
  const removeDisabled = isIdle || contentUnavailable

  const currentPhase = translationState?.phase ?? "idle"
  const currentProgress = translationState?.progress
  const currentPresentation = translationState?.presentation ?? persistedResolvedSite.presentation
  const currentSite = translationState?.site ?? {
    hostname: activeSiteKey,
    enabled: persistedResolvedSite.enabled,
    alwaysTranslate: persistedResolvedSite.alwaysTranslate,
  }
  const statusSiteEnabled = currentPhase === "idle"
    ? persistedResolvedSite.enabled
    : currentSite.enabled

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

      <TranslationStatusCard
        phase={currentPhase}
        targetLang={translationState?.targetLang ?? persistedResolvedSite.targetLang}
        presentation={currentPresentation}
        hostname={currentSite.hostname}
        progress={currentProgress ?? null}
        lastError={translationState?.lastError ?? null}
        siteEnabled={statusSiteEnabled}
      />

      <GlobalSettingsSection
        config={configDraft}
        onProviderChange={updateProvider}
        onPresentationChange={updatePresentation}
        onTargetLangChange={(lang) => updateDraft((current) => ({ ...current, targetLang: lang }))}
        onHoverTriggerChange={(trigger) => updateDraft((current) => ({ ...current, hoverTrigger: trigger }))}
        onContentScopeChange={(scope) => updateDraft((current) => ({ ...current, contentScope: scope }))}
      />

      {activeSiteKey && (
        <SiteSettingsSection
          activeSiteKey={activeSiteKey}
          rawSiteRule={rawSiteRule}
          globalConfig={configDraft}
          onSiteRuleChange={editActiveSiteRule}
        />
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
