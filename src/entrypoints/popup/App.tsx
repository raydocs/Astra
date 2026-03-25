import { useState, useEffect } from "react"
import { browser } from "#imports"
import type { TranslationSnapshot } from "@/types/translation"
import {
  getActiveTabTranslationState,
  startActiveTabTranslation,
  stopActiveTabTranslation,
} from "@/utils/extension/messages"
import { readConfig, saveConfig as persistConfig } from "@/utils/storage/config"

export default function App() {
  const [apiKey, setApiKey] = useState("")
  const [baseURL, setBaseURL] = useState("")
  const [model, setModel] = useState("gpt-4o-mini")
  const [targetLang, setTargetLang] = useState("zh-CN")
  const [saved, setSaved] = useState(false)
  const [statusMessage, setStatusMessage] = useState("")
  const [translationState, setTranslationState] = useState<TranslationSnapshot | null>(null)
  const [contentAvailable, setContentAvailable] = useState(true)

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

  useEffect(() => {
    void (async () => {
      const config = await readConfig()
      setApiKey(config.provider.apiKey)
      setBaseURL(config.provider.baseURL ?? "")
      setModel(config.provider.model)
      setTargetLang(config.targetLang)
      await refreshTranslationState()
    })()
  }, [])

  useEffect(() => {
    const handleWindowFocus = () => {
      void refreshTranslationState()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshTranslationState()
      }
    }

    const handleTabActivated = () => {
      void refreshTranslationState()
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

  const handleSaveConfig = async () => {
    try {
      await persistConfig({
        targetLang,
        provider: {
          apiKey,
          baseURL,
          model,
        },
      })
      setSaved(true)
      setStatusMessage("")
      setTimeout(() => setSaved(false), 2000)
    } catch (error) {
      setSaved(false)
      setStatusMessage(error instanceof Error ? error.message : "保存设置失败")
    }
  }

  const translate = async () => {
    const response = await startActiveTabTranslation(targetLang)
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

  return (
    <div style={{ width: 320, padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <h2 style={{ margin: "0 0 12px", fontSize: 18, display: "flex", alignItems: "center", gap: 8 }}>
        ✦ Astra
      </h2>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button
          onClick={() => {
            void translate()
          }}
          style={btnPrimary}
          disabled={!isIdle || contentUnavailable}
        >
          翻译此页
        </button>
        <button
          onClick={() => {
            void removeTranslation()
          }}
          style={btnSecondary}
          disabled={isIdle || contentUnavailable}
        >
          移除翻译
        </button>
      </div>

      <details style={{ marginBottom: 12 }}>
        <summary style={{ cursor: "pointer", fontSize: 13, color: "#6366f1" }}>
          ⚙ 设置
        </summary>
        <div style={{ marginTop: 8 }}>
          <label style={labelStyle}>API Key</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
            style={inputStyle}
          />

          <label style={labelStyle}>Base URL (可选)</label>
          <input
            value={baseURL}
            onChange={(e) => setBaseURL(e.target.value)}
            placeholder="https://api.openai.com/v1"
            style={inputStyle}
          />

          <label style={labelStyle}>模型</label>
          <input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="gpt-4o-mini"
            style={inputStyle}
          />

          <label style={labelStyle}>目标语言</label>
          <select value={targetLang} onChange={(e) => setTargetLang(e.target.value)} style={inputStyle}>
            <option value="zh-CN">简体中文</option>
            <option value="zh-TW">繁體中文</option>
            <option value="en">English</option>
            <option value="ja">日本語</option>
            <option value="ko">한국어</option>
            <option value="fr">Français</option>
            <option value="de">Deutsch</option>
            <option value="es">Español</option>
          </select>

          <button
            onClick={() => {
              void handleSaveConfig()
            }}
            style={{ ...btnPrimary, width: "100%", marginTop: 8 }}
          >
            {saved ? "✓ 已保存" : "保存设置"}
          </button>
        </div>
      </details>

      {statusMessage && (
        <div style={{
          marginBottom: 12,
          fontSize: 12,
          color: "#b45309",
          background: "#fff7ed",
          border: "1px solid #fdba74",
          borderRadius: 6,
          padding: "8px 10px",
        }}>
          {statusMessage}
        </div>
      )}

      <div style={{ fontSize: 11, color: "#94a3b8", textAlign: "center" }}>
        Astra v0.1.0 · {translationState?.phase ?? "idle"} · AI 双语翻译
      </div>
    </div>
  )
}

const btnPrimary: React.CSSProperties = {
  flex: 1, padding: "8px 12px", background: "#6366f1", color: "#fff",
  border: "none", borderRadius: 6, cursor: "pointer", fontSize: 14, fontWeight: 500,
  opacity: 1,
}

const btnSecondary: React.CSSProperties = {
  flex: 1, padding: "8px 12px", background: "#f1f5f9", color: "#334155",
  border: "1px solid #e2e8f0", borderRadius: 6, cursor: "pointer", fontSize: 14,
}
const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 12, color: "#64748b", marginBottom: 4, marginTop: 8,
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "6px 8px", border: "1px solid #e2e8f0",
  borderRadius: 4, fontSize: 13, boxSizing: "border-box",
}
