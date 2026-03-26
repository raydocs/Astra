import { useEffect, useMemo, useRef, useState } from "react"
import { browser } from "#imports"
import { t } from "@/utils/i18n"
import type {
  AstraConfig,
  TranslationMode,
} from "@/types/config"
import type { AstraAccount, AstraSession, AstraUsageSnapshot } from "@/types/auth"
import type { TranslationSnapshot } from "@/types/translation"
import type { QuotaInfo } from "@/utils/astra/quota"
import {
  getActiveTabTranslationState,
  startActiveTabTranslation,
  stopActiveTabTranslation,
} from "@/utils/extension/messages"
import { readConfig, saveConfig as persistConfig } from "@/utils/storage/config"
import {
  DEFAULT_ASTRA_CONFIG,
  hasResolvedProviderAccess,
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
  fetchAstraAccount,
  fetchAstraUsageSnapshot,
} from "@/utils/astra/account"
import { getQuotaInfo } from "@/utils/astra/quota"
import TranslationStatusCard from "./components/TranslationStatusCard"
import SimpleControls from "./components/SimpleControls"
import QuotaBar from "./components/QuotaBar"
import { btnPrimary, btnSecondary, btnDisabled, warningStyle, inputStyle, labelStyle } from "./components/styles"

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
  const [statusMessage, setStatusMessage] = useState("")
  const [translationState, setTranslationState] = useState<TranslationSnapshot | null>(null)
  const [contentAvailable, setContentAvailable] = useState(true)
  const [activeSiteKey, setActiveSiteKey] = useState<string | null>(null)
  const [authSession, setAuthSession] = useState<AstraSession | null>(null)
  const [authAccount, setAuthAccount] = useState<AstraAccount | null>(null)
  const [authEmail, setAuthEmail] = useState("")
  const [authPassword, setAuthPassword] = useState("")
  const [authBusy, setAuthBusy] = useState(false)
  const [recentHistory, setRecentHistory] = useState<ReadingHistoryEntry[]>([])
  const [quotaInfo, setQuotaInfo] = useState<QuotaInfo | null>(null)
  const hasUnsavedChangesRef = useRef(false)

  const persistedResolvedSite = useMemo(
    () => resolveSiteTranslationSettings(persistedConfig, activeSiteKey),
    [persistedConfig, activeSiteKey],
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
    setRecentHistory(history.slice(0, 3))
    let session = storedSession
    let account: AstraAccount | null = null
    if (storedSession) {
      try {
        session = await refreshAstraSession({
          baseURL: storedSession.relayBaseURL,
          sessionToken: storedSession.sessionToken,
        })
        await saveAstraSession(session)
        try {
          account = await fetchAstraAccount({
            baseURL: session.relayBaseURL,
            sessionToken: session.sessionToken,
          })
        } catch {
          account = null
        }
      } catch {
        await clearAstraSession()
        session = null
        account = null
      }
    }
    if (!hasUnsavedChangesRef.current) {
      setConfigDraft(config)
    }
    setPersistedConfig(config)
    setActiveSiteKey(siteKey)
    setAuthSession(session)
    setAuthAccount(account)

    // Fetch quota info (best-effort)
    try {
      const quota = await getQuotaInfo()
      setQuotaInfo(quota)
    } catch {
      setQuotaInfo(null)
    }

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

  const handleSaveConfig = async (patch: Partial<AstraConfig>) => {
    try {
      const nextConfig = await persistConfig({
        ...patch,
        provider: {
          id: configDraft.provider.id,
          apiKey: configDraft.provider.apiKey,
          relayBaseURL: configDraft.provider.relayBaseURL ?? "",
          model: configDraft.provider.model,
        },
        sites: configDraft.sites,
      })
      setConfigDraft(nextConfig)
      setPersistedConfig(nextConfig)
      hasUnsavedChangesRef.current = false

      if (activeSiteKey && !resolveSiteTranslationSettings(nextConfig, activeSiteKey).enabled) {
        await stopActiveTabTranslation()
      }

      await refreshTranslationState()
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Failed to save settings")
    }
  }

  const handleTargetLangChange = (lang: string) => {
    setConfigDraft((current) => ({ ...current, targetLang: lang }))
    void handleSaveConfig({ targetLang: lang })
  }

  const handleModeChange = (mode: "bilingual" | "translation-only") => {
    setConfigDraft((current) => ({
      ...current,
      presentation: { ...current.presentation, mode },
    }))
    void handleSaveConfig({ presentation: { ...configDraft.presentation, mode } })
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
      setStatusMessage(error instanceof Error ? error.message : "Translation request failed")
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
      setStatusMessage(error instanceof Error ? error.message : "Translation request failed")
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

  // Compute daily words translated from quota/session
  const wordsTranslated = quotaInfo ? Math.round(quotaInfo.used / 5) : 0

  // Determine plan label
  const planLabel = authAccount?.plan === "pro"
    ? "Pro Plan"
    : quotaInfo?.plan === "custom"
      ? "Custom"
      : "Free Plan"

  const hydrateAccountState = async (session: AstraSession) => {
    try {
      const account = await fetchAstraAccount({
        baseURL: session.relayBaseURL,
        sessionToken: session.sessionToken,
      })
      return { account }
    } catch {
      return { account: null }
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
      const { account } = await hydrateAccountState(session)
      await saveAstraSession(session)
      setAuthSession(session)
      setAuthAccount(account)
      setAuthPassword("")
      setStatusMessage("")
      await refreshTranslationState()
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Sign in failed")
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
      setStatusMessage(error instanceof Error ? error.message : "Sign out failed")
    } finally {
      await clearAstraSession()
      setAuthSession(null)
      setAuthAccount(null)
      setAuthPassword("")
      setAuthBusy(false)
      await refreshTranslationState()
    }
  }

  return (
    <div style={{ width: 340, padding: 16, fontFamily: "system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18, display: "flex", alignItems: "center", gap: 8 }}>
          Astra
        </h2>
        <button
          type="button"
          onClick={() => void browser.tabs.create({ url: browser.runtime.getURL("/options.html" as "/popup.html") })}
          style={{
            background: "none",
            border: "none",
            fontSize: 18,
            cursor: "pointer",
            color: "#64748b",
            padding: 4,
          }}
          title="Settings"
        >
          &#9881;
        </button>
      </div>

      {/* Translate This Page button */}
      {isIdle ? (
        <button
          onClick={() => {
            void translate()
          }}
          style={{
            ...btnPrimary,
            width: "100%",
            padding: "10px 12px",
            fontSize: 15,
            fontWeight: 600,
            ...(translateDisabled ? btnDisabled : {}),
          }}
          disabled={translateDisabled}
        >
          {t("popup_translateThisPage")}
        </button>
      ) : (
        <button
          onClick={() => {
            void removeTranslation()
          }}
          style={{
            ...btnSecondary,
            width: "100%",
            padding: "10px 12px",
            fontSize: 15,
            fontWeight: 600,
            ...(removeDisabled ? btnDisabled : {}),
          }}
          disabled={removeDisabled}
        >
          {t("popup_stopTranslation")}
        </button>
      )}

      {/* Status + Quota section */}
      <div style={{
        marginTop: 12,
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
        borderRadius: 8,
        padding: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#334155" }}>
          <span style={{
            display: "inline-block",
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: authSession ? "#22c55e" : "#94a3b8",
          }} />
          <span>
            {authSession ? t("popup_connected") : t("popup_notConnected")}
            {" \u00b7 "}
            {planLabel}
          </span>
        </div>
        <QuotaBar quota={quotaInfo} />
        {wordsTranslated > 0 && (
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
            {t("popup_wordsTranslatedToday", wordsTranslated.toLocaleString())}
          </div>
        )}
      </div>

      {/* Translation Status Card (shown when active) */}
      {currentPhase !== "idle" && (
        <div style={{ marginTop: 12 }}>
          <TranslationStatusCard
            phase={currentPhase}
            targetLang={translationState?.targetLang ?? persistedResolvedSite.targetLang}
            presentation={currentPresentation}
            hostname={currentSite.hostname}
            progress={currentProgress ?? null}
            lastError={translationState?.lastError ?? null}
            siteEnabled={statusSiteEnabled}
          />
        </div>
      )}

      {/* Target Language + Translation Mode */}
      <div style={{ marginTop: 12 }}>
        <SimpleControls
          targetLang={configDraft.targetLang}
          translationMode={configDraft.presentation.mode}
          onTargetLangChange={handleTargetLangChange}
          onModeChange={handleModeChange}
        />
      </div>

      {/* Auth section (simplified) */}
      {!authSession && (
        <details style={{ marginTop: 4, marginBottom: 8 }}>
          <summary style={{ cursor: "pointer", fontSize: 13, color: "#6366f1" }}>
            {t("popup_signInToAstra")}
          </summary>
          <div style={{ marginTop: 8 }}>
            <label style={labelStyle}>{t("label_email")}</label>
            <input
              type="email"
              value={authEmail}
              onChange={(e) => setAuthEmail(e.target.value)}
              placeholder="you@example.com"
              style={inputStyle}
            />
            <label style={labelStyle}>{t("label_password")}</label>
            <input
              type="password"
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
              placeholder="••••••••"
              style={inputStyle}
            />
            <button
              onClick={() => {
                void handleSignIn()
              }}
              style={{
                ...btnPrimary,
                width: "100%",
                marginTop: 8,
                ...(authBusy || authEmail.trim().length === 0 || authPassword.length === 0 ? btnDisabled : {}),
              }}
              disabled={authBusy || authEmail.trim().length === 0 || authPassword.length === 0}
            >
              {t("popup_signIn")}
            </button>
          </div>
        </details>
      )}

      {authSession && (
        <div style={{ fontSize: 12, color: "#64748b", marginTop: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>{authAccount?.email ?? authSession.email}</span>
          <button
            onClick={() => {
              void handleSignOut()
            }}
            style={{
              background: "none",
              border: "none",
              color: "#6366f1",
              fontSize: 11,
              cursor: "pointer",
              textDecoration: "underline",
              ...(authBusy ? btnDisabled : {}),
            }}
            disabled={authBusy}
          >
            {t("popup_signOut")}
          </button>
        </div>
      )}

      {/* Recent translations */}
      {recentHistory.length > 0 && (
        <details style={{ marginTop: 12, marginBottom: 4 }}>
          <summary style={{ cursor: "pointer", fontSize: 13, color: "#6366f1" }}>
            {t("popup_recentTranslations")}
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
                    {entry.hostname} · {entry.wordsTranslated} {t("popup_words")}
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

      {/* Footer links */}
      <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 10 }}>
        <button
          type="button"
          onClick={() => void browser.tabs.create({ url: browser.runtime.getURL("/options.html" as "/popup.html") })}
          style={{ background: "none", border: "none", color: "#6366f1", fontSize: 11, cursor: "pointer", textDecoration: "underline" }}
        >
          {t("popup_settings")}
        </button>
        <button
          type="button"
          onClick={() => void browser.tabs.create({ url: browser.runtime.getURL("/vocabulary.html" as "/popup.html") })}
          style={{ background: "none", border: "none", color: "#6366f1", fontSize: 11, cursor: "pointer", textDecoration: "underline" }}
        >
          {t("popup_vocabulary")}
        </button>
        <button
          type="button"
          onClick={() => void browser.tabs.create({ url: browser.runtime.getURL("/review.html" as "/popup.html") })}
          style={{ background: "none", border: "none", color: "#6366f1", fontSize: 11, cursor: "pointer", textDecoration: "underline" }}
        >
          {t("popup_review")}
        </button>
      </div>
      <div style={{ fontSize: 11, color: "#94a3b8", textAlign: "center", marginTop: 4 }}>
        Astra v0.1.0
      </div>
    </div>
  )
}
