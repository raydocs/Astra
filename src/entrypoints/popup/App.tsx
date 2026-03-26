import { useEffect, useMemo, useRef, useState } from "react"
import { browser } from "#imports"
import type {
  AstraConfig,
  LanguageLevel,
  SiteConfig,
} from "@/types/config"
import type { AstraAccount, AstraSession, AstraUsageSnapshot } from "@/types/auth"
import type { TranslationSnapshot } from "@/types/translation"
import {
  getActiveTabTranslationState,
  startActiveTabTranslation,
  stopActiveTabTranslation,
} from "@/utils/extension/messages"
import { readConfig, saveConfig as persistConfig } from "@/utils/storage/config"
import {
  DEFAULT_ASTRA_CONFIG,
  hasResolvedProviderAccess,
  isDefaultSiteConfig,
  normalizeSiteKey,
  resolveSiteTranslationSettings,
} from "@/types/config"
import { getReadingHistory, type ReadingHistoryEntry } from "@/utils/storage/reading-history"
import {
  clearAstraSession,
  readAstraSession,
  saveAstraSession,
} from "@/utils/storage/auth"
import {
  createAstraSession,
  refreshAstraSession,
  revokeAstraSession,
} from "@/utils/astra/auth"
import {
  createAstraCheckoutLink,
  createAstraPortalLink,
  fetchAstraAccount,
  fetchAstraUsageSnapshot,
  updateAstraPlan,
} from "@/utils/astra/account"
import TranslationStatusCard from "./components/TranslationStatusCard"
import GlobalSettingsSection from "./components/GlobalSettingsSection"
import SiteSettingsSection from "./components/SiteSettingsSection"
import AuthSection from "./components/AuthSection"
import { btnPrimary, btnSecondary, btnDisabled, warningStyle } from "./components/styles"

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

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
  const [authSession, setAuthSession] = useState<AstraSession | null>(null)
  const [authAccount, setAuthAccount] = useState<AstraAccount | null>(null)
  const [authUsage, setAuthUsage] = useState<AstraUsageSnapshot | null>(null)
  const [authEmail, setAuthEmail] = useState("")
  const [authPassword, setAuthPassword] = useState("")
  const [authBusy, setAuthBusy] = useState(false)
  const [recentHistory, setRecentHistory] = useState<ReadingHistoryEntry[]>([])
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
    const [config, siteKey, storedSession, history] = await Promise.all([
      readConfig(),
      getActiveSiteKey(),
      readAstraSession(),
      getReadingHistory(),
    ])
    setRecentHistory(history.slice(0, 5))
    let session = storedSession
    let account: AstraAccount | null = null
    let usage: AstraUsageSnapshot | null = null
    if (storedSession) {
      try {
        session = await refreshAstraSession({
          baseURL: storedSession.relayBaseURL,
          sessionToken: storedSession.sessionToken,
        })
        await saveAstraSession(session)
        try {
          ;[account, usage] = await Promise.all([
            fetchAstraAccount({
              baseURL: session.relayBaseURL,
              sessionToken: session.sessionToken,
            }),
            fetchAstraUsageSnapshot({
              baseURL: session.relayBaseURL,
              sessionToken: session.sessionToken,
            }),
          ])
        } catch {
          account = null
          usage = null
        }
      } catch {
        await clearAstraSession()
        session = null
        account = null
        usage = null
      }
    }
    if (!hasUnsavedChangesRef.current) {
      setConfigDraft(config)
    }
    setPersistedConfig(config)
    setActiveSiteKey(siteKey)
    setAuthSession(session)
    setAuthAccount(account)
    setAuthUsage(usage)
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
          id: configDraft.provider.id,
          apiKey: configDraft.provider.apiKey,
          relayBaseURL: configDraft.provider.relayBaseURL ?? "",
          model: configDraft.provider.model,
        },
        presentation: configDraft.presentation,
        hoverTrigger: configDraft.hoverTrigger,
        inputTranslation: configDraft.inputTranslation,
        languageLevel: configDraft.languageLevel,
        privacyMode: configDraft.privacyMode,
        sites: configDraft.sites,
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
    try {
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
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "翻译请求失败")
    }
  }

  const removeTranslation = async () => {
    try {
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
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "翻译请求失败")
    }
  }

  const isIdle = translationState?.phase === "idle" || translationState === null
  const contentUnavailable = !contentAvailable
  const providerReady = hasResolvedProviderAccess(persistedConfig.provider, authSession)
  const translateDisabled = !isIdle || contentUnavailable || !persistedResolvedSite.enabled || !providerReady
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

  const hydrateAccountState = async (session: AstraSession) => {
    try {
      const [account, usage] = await Promise.all([
        fetchAstraAccount({
          baseURL: session.relayBaseURL,
          sessionToken: session.sessionToken,
        }),
        fetchAstraUsageSnapshot({
          baseURL: session.relayBaseURL,
          sessionToken: session.sessionToken,
        }),
      ])
      return { account, usage }
    } catch {
      return { account: null, usage: null }
    }
  }

  const handleSignIn = async () => {
    try {
      setAuthBusy(true)
      setStatusMessage("")
      const session = await createAstraSession({
        baseURL: configDraft.provider.relayBaseURL ?? "",
        email: authEmail,
        password: authPassword,
      })
      const { account, usage } = await hydrateAccountState(session)
      await saveAstraSession(session)
      setAuthSession(session)
      setAuthAccount(account)
      setAuthUsage(usage)
      setAuthPassword("")
      setStatusMessage("")
      await refreshTranslationState()
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Astra 登录失败")
    } finally {
      setAuthBusy(false)
    }
  }

  const handlePlanChange = async (plan: "free" | "pro") => {
    if (!authSession) return

    try {
      setAuthBusy(true)
      setStatusMessage("")
      await updateAstraPlan({
        baseURL: authSession.relayBaseURL,
        sessionToken: authSession.sessionToken,
        plan,
      })
      await refreshAll()
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "切换套餐失败")
    } finally {
      setAuthBusy(false)
    }
  }

  const openBillingUrl = async (url: string) => {
    await browser.tabs.create({ url })
  }

  const handleOpenCheckout = async (plan: "free" | "pro") => {
    if (!authSession) return

    try {
      setAuthBusy(true)
      setStatusMessage("")
      const link = await createAstraCheckoutLink({
        baseURL: authSession.relayBaseURL,
        sessionToken: authSession.sessionToken,
        plan,
      })
      await openBillingUrl(link.url)
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "创建升级链接失败")
    } finally {
      setAuthBusy(false)
    }
  }

  const handleOpenPortal = async () => {
    if (!authSession) return

    try {
      setAuthBusy(true)
      setStatusMessage("")
      const link = await createAstraPortalLink({
        baseURL: authSession.relayBaseURL,
        sessionToken: authSession.sessionToken,
      })
      await openBillingUrl(link.url)
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "打开订阅管理失败")
    } finally {
      setAuthBusy(false)
    }
  }

  const handleSignOut = async () => {
    try {
      setAuthBusy(true)
      setStatusMessage("")
      if (authSession) {
        await revokeAstraSession({
          baseURL: authSession.relayBaseURL,
          sessionToken: authSession.sessionToken,
        })
      }
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Astra 退出登录失败")
    } finally {
      await clearAstraSession()
      setAuthSession(null)
      setAuthAccount(null)
      setAuthUsage(null)
      setAuthPassword("")
      setAuthBusy(false)
      await refreshTranslationState()
    }
  }

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

      <AuthSection
        session={authSession}
        account={authAccount}
        usage={authUsage}
        email={authEmail}
        password={authPassword}
        busy={authBusy}
        onEmailChange={setAuthEmail}
        onPasswordChange={setAuthPassword}
        onSignIn={() => {
          void handleSignIn()
        }}
        onChangePlan={(plan) => {
          void handlePlanChange(plan)
        }}
        onOpenCheckout={(plan) => {
          void handleOpenCheckout(plan)
        }}
        onOpenPortal={() => {
          void handleOpenPortal()
        }}
        onSignOut={() => {
          void handleSignOut()
        }}
      />

      <GlobalSettingsSection
        config={configDraft}
        onProviderChange={updateProvider}
        onPresentationChange={updatePresentation}
        onTargetLangChange={(lang) => updateDraft((current) => ({ ...current, targetLang: lang }))}
        onHoverTriggerChange={(trigger) => updateDraft((current) => ({ ...current, hoverTrigger: trigger }))}
        onContentScopeChange={(scope) => updateDraft((current) => ({ ...current, contentScope: scope }))}
        onLanguageLevelChange={(level: LanguageLevel) => updateDraft((current) => ({ ...current, languageLevel: level }))}
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

      {recentHistory.length > 0 && (
        <details style={{ marginTop: 12, marginBottom: 4 }}>
          <summary style={{ cursor: "pointer", fontSize: 13, color: "#6366f1" }}>
            Recent Translations
          </summary>
          <div style={{ marginTop: 6 }}>
            {recentHistory.map((entry) => (
              <div
                key={entry.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  fontSize: 12,
                  color: "#334155",
                  padding: "4px 0",
                  borderBottom: "1px solid #f1f5f9",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {entry.title.length > 40 ? `${entry.title.slice(0, 40)}...` : entry.title}
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>
                    {entry.hostname} · {entry.wordsTranslated} words
                  </div>
                </div>
                <div style={{ fontSize: 11, color: "#94a3b8", whiteSpace: "nowrap", marginLeft: 8 }}>
                  {formatRelativeTime(entry.visitedAt)}
                </div>
              </div>
            ))}
          </div>
        </details>
      )}

      {statusMessage && (
        <div style={warningStyle}>
          {statusMessage}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 10 }}>
        <button
          type="button"
          onClick={() => void browser.tabs.create({ url: browser.runtime.getURL("/options.html" as "/popup.html") })}
          style={{ background: "none", border: "none", color: "#6366f1", fontSize: 11, cursor: "pointer", textDecoration: "underline" }}
        >
          Settings
        </button>
        <button
          type="button"
          onClick={() => void browser.tabs.create({ url: browser.runtime.getURL("/vocabulary.html" as "/popup.html") })}
          style={{ background: "none", border: "none", color: "#6366f1", fontSize: 11, cursor: "pointer", textDecoration: "underline" }}
        >
          Vocabulary
        </button>
      </div>
      <div style={{ fontSize: 11, color: "#94a3b8", textAlign: "center", marginTop: 4 }}>
        Astra v0.1.0
      </div>
    </div>
  )
}
