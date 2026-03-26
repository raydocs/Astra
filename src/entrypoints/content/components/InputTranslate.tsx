import { useState, useEffect, useRef, useCallback } from "react"
import { createRoot } from "react-dom/client"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { readConfig } from "@/utils/storage/config"
import { resolveSiteTranslationSettings } from "@/types/config"
import { isSensitiveInput } from "@/utils/privacy"
import { runInlineAction } from "../inline-actions"

const HOST_ID = "astra-input-translate-host"
const BRAND_COLOR = "#6366f1"

interface InputOverlayState {
  visible: boolean
  top: number
  left: number
  translating: boolean
  error: string | null
}

function InputTranslateApp() {
  const [overlay, setOverlay] = useState<InputOverlayState>({
    visible: false,
    top: 0,
    left: 0,
    translating: false,
    error: null,
  })
  const activeInput = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)
  const translatingRef = useRef(false)

  useEffect(() => {
    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target
      if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return
      // Skip password, hidden, and non-text inputs
      if (target instanceof HTMLInputElement && !["text", "search", "url", "email", ""].includes(target.type)) return
      if (isSensitiveInput(target)) return

      activeInput.current = target

      const value = target.value.trim()
      if (!value) {
        setOverlay(prev => ({ ...prev, visible: false }))
        return
      }
      const rect = target.getBoundingClientRect()
      setOverlay({
        visible: true,
        top: rect.top - 30,
        left: rect.right - 60,
        translating: false,
        error: null,
      })
    }

    const handleFocusOut = (_event: FocusEvent) => {
      // Delay to allow button click to fire
      setTimeout(() => {
        const host = document.getElementById(HOST_ID)
        if (host?.contains(document.activeElement)) return
        setOverlay(prev => ({ ...prev, visible: false }))
        activeInput.current = null
      }, 150)
    }

    const handleInput = (event: Event) => {
      const target = event.target
      if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return
      if (target !== activeInput.current) return

      const value = target.value.trim()
      if (!value) {
        setOverlay(prev => ({ ...prev, visible: false }))
        return
      }

      const rect = target.getBoundingClientRect()
      setOverlay(prev => ({
        ...prev,
        visible: true,
        top: rect.top - 30,
        left: rect.right - 60,
      }))
    }

    document.addEventListener("focusin", handleFocusIn, true)
    document.addEventListener("focusout", handleFocusOut, true)
    document.addEventListener("input", handleInput, true)

    return () => {
      document.removeEventListener("focusin", handleFocusIn, true)
      document.removeEventListener("focusout", handleFocusOut, true)
      document.removeEventListener("input", handleInput, true)
    }
  }, [])

  const handleTranslate = useCallback(async () => {
    const input = activeInput.current
    if (!input || translatingRef.current) return

    const text = input.value.trim()
    if (!text) return

    translatingRef.current = true
    setOverlay(prev => ({ ...prev, translating: true, error: null }))

    try {
      const config = await readConfig()
      if (config.inputTranslation === "disabled") {
        setOverlay(prev => ({ ...prev, error: "Input translation disabled" }))
        setTimeout(() => setOverlay(prev => ({ ...prev, error: null })), 2000)
        return
      }

      const resolved = resolveSiteTranslationSettings(config, window.location.hostname)
      if (!resolved.enabled) {
        setOverlay(prev => ({ ...prev, error: "Astra disabled on this site" }))
        setTimeout(() => setOverlay(prev => ({ ...prev, error: null })), 2000)
        return
      }

      const result = await runInlineAction({
        text,
        targetLang: resolved.targetLang,
        task: "translate",
      })

      if (result.ok) {
        // Replace input value with translation
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
          "value",
        )?.set
        nativeInputValueSetter?.call(input, result.text)
        input.dispatchEvent(new Event("input", { bubbles: true }))
      } else {
        const msg = result.message || "Translation failed"
        setOverlay(prev => ({ ...prev, error: msg }))
        setTimeout(() => setOverlay(prev => ({ ...prev, error: null })), 3000)
      }
    } finally {
      translatingRef.current = false
      setOverlay(prev => ({ ...prev, translating: false }))
    }
  }, [])

  if (!overlay.visible) return null

  return (
    <button
      type="button"
      style={{
        position: "fixed",
        top: overlay.top,
        left: overlay.left,
        zIndex: 2147483644,
        background: overlay.error ? "#f59e0b" : BRAND_COLOR,
        color: "#fff",
        border: "none",
        borderRadius: 4,
        padding: "2px 8px",
        fontSize: 11,
        fontWeight: 600,
        cursor: "pointer",
        opacity: overlay.translating ? 0.6 : 1,
        pointerEvents: overlay.translating ? "none" : "auto",
      }}
      onClick={() => void handleTranslate()}
    >
      {overlay.error ? "\u26A0" : overlay.translating ? "\u22EF" : "\u8BD1"}
    </button>
  )
}

export function mountInputTranslate() {
  if (document.getElementById(HOST_ID)) return

  const host = document.createElement("div")
  host.id = HOST_ID
  host.style.position = "fixed"
  host.style.top = "0"
  host.style.left = "0"
  host.style.width = "0"
  host.style.height = "0"
  host.style.overflow = "visible"
  host.style.zIndex = "2147483644"
  document.documentElement.appendChild(host)

  const shadow = host.attachShadow({ mode: "open" })
  const container = document.createElement("div")
  shadow.appendChild(container)
  createRoot(container).render(<ErrorBoundary><InputTranslateApp /></ErrorBoundary>)
}
