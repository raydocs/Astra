import { useState, useEffect, useRef, useCallback } from "react"
import { createRoot } from "react-dom/client"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { t } from "@/utils/i18n"
import { readConfig, saveConfig } from "@/utils/storage/config"
import { resolveSiteTranslationSettings } from "@/types/config"
import { isSensitiveInput } from "@/utils/privacy"
import { runInlineAction } from "../inline-actions"
import { OVERLAY_STYLE_TOKENS, createOverlayStyle1TokenStyleElement } from "./overlayScale"

const HOST_ID = "astra-input-translate-host"
const BRAND_COLOR = OVERLAY_STYLE_TOKENS.brand
const TEXT_NODE_FILTER = typeof NodeFilter !== "undefined" ? NodeFilter.SHOW_TEXT : 4

type EditableKind = "input" | "textarea" | "contenteditable"
type EditableElement = HTMLInputElement | HTMLTextAreaElement | HTMLElement

interface InputOverlayState {
  visible: boolean
  top: number
  left: number
  translating: boolean
  error: string | null
}

interface EditableSelectionSnapshot {
  kind: EditableKind
  start: number | null
  end: number | null
  direction: SelectionDirection | null
}

function isSupportedTextInput(element: HTMLInputElement) {
  return ["text", "search", "url", "email", ""].includes(element.type)
}

function isEditableElement(target: EventTarget | null): target is EditableElement {
  return target instanceof HTMLInputElement
    || target instanceof HTMLTextAreaElement
    || (target instanceof HTMLElement && (target.isContentEditable || target.getAttribute("contenteditable") === "true"))
}

function getEditableKind(target: EditableElement): EditableKind {
  if (target instanceof HTMLInputElement) return "input"
  if (target instanceof HTMLTextAreaElement) return "textarea"
  return "contenteditable"
}

function getEditableText(target: EditableElement): string {
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    return target.value
  }

  return target.innerText ?? target.textContent ?? ""
}

function setEditableText(target: EditableElement, text: string) {
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    const nativeSetter = Object.getOwnPropertyDescriptor(
      target instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
      "value",
    )?.set
    nativeSetter?.call(target, text)
    if (!nativeSetter) {
      target.value = text
    }
    return
  }

  target.textContent = text
}

function getContentEditableOffset(root: HTMLElement, node: Node | null, offset: number) {
  if (!node || !root.contains(node)) return null

  const range = document.createRange()
  range.selectNodeContents(root)

  try {
    range.setEnd(node, offset)
  } catch {
    return null
  }

  return range.toString().length
}

function resolveContentEditablePosition(root: HTMLElement, offset: number) {
  const walker = document.createTreeWalker(root, TEXT_NODE_FILTER)
  let remaining = Math.max(0, offset)
  let current = walker.nextNode() as Text | null

  while (current) {
    const textLength = current.textContent?.length ?? 0
    if (remaining <= textLength) {
      return { node: current, offset: remaining }
    }
    remaining -= textLength
    current = walker.nextNode() as Text | null
  }

  const fallback = root.lastChild
  if (fallback instanceof Text) {
    return { node: fallback, offset: fallback.textContent?.length ?? 0 }
  }

  return { node: root, offset: root.childNodes.length }
}

function getEditableSelectionSnapshot(target: EditableElement): EditableSelectionSnapshot {
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    return {
      kind: getEditableKind(target),
      start: target.selectionStart ?? null,
      end: target.selectionEnd ?? null,
      direction: target.selectionDirection ?? null,
    }
  }

  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) {
    return { kind: "contenteditable", start: null, end: null, direction: null }
  }

  const range = selection.getRangeAt(0)
  if (!target.contains(range.commonAncestorContainer)) {
    return { kind: "contenteditable", start: null, end: null, direction: null }
  }

  return {
    kind: "contenteditable",
    start: getContentEditableOffset(target, range.startContainer, range.startOffset),
    end: getContentEditableOffset(target, range.endContainer, range.endOffset),
    direction: null,
  }
}

function restoreEditableSelection(target: EditableElement, snapshot: EditableSelectionSnapshot, nextText: string) {
  if (snapshot.start === null || snapshot.end === null) return

  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    const max = target.value.length
    const start = Math.min(snapshot.start, max)
    const end = Math.min(snapshot.end, max)
    try {
      target.setSelectionRange(start, end, snapshot.direction ?? undefined)
    } catch {
      target.setSelectionRange(start, end)
    }
    return
  }

  const selection = window.getSelection()
  if (!selection) return

  const max = nextText.length
  const startPosition = resolveContentEditablePosition(target, Math.min(snapshot.start, max))
  const endPosition = resolveContentEditablePosition(target, Math.min(snapshot.end, max))
  if (!startPosition || !endPosition) return

  const range = document.createRange()
  range.setStart(startPosition.node, startPosition.offset)
  range.setEnd(endPosition.node, endPosition.offset)
  selection.removeAllRanges()
  selection.addRange(range)
}

function dispatchEditableInputEvent(target: EditableElement, text: string) {
  try {
    const inputEvent = new InputEvent("input", {
      bubbles: true,
      cancelable: true,
      inputType: "insertText",
      data: text,
    })
    target.dispatchEvent(inputEvent)
    return
  } catch {
    target.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }))
  }
}

type InputTranslationMode = "replace" | "bilingual"

function formatBilingualOutput(original: string, translation: string, kind: EditableKind): string {
  if (kind === "input") {
    return `${original} | ${translation}`
  }
  return `${original}\n${translation}`
}

function InputTranslateApp() {
  const [overlay, setOverlay] = useState<InputOverlayState>({
    visible: false,
    top: 0,
    left: 0,
    translating: false,
    error: null,
  })
  const [mode, setMode] = useState<InputTranslationMode>("replace")
  const activeInput = useRef<EditableElement | null>(null)
  const translatingRef = useRef(false)

  useEffect(() => {
    readConfig().then((config) => {
      setMode(config.inputTranslationMode ?? "replace")
    }).catch(() => {})
  }, [])

  useEffect(() => {
    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target
      if (!isEditableElement(target)) return
      if (target instanceof HTMLInputElement && !isSupportedTextInput(target)) return
      if ((target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) && isSensitiveInput(target)) return

      activeInput.current = target

      const value = getEditableText(target).trim()
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
      setTimeout(() => {
        const host = document.getElementById(HOST_ID)
        if (host?.contains(document.activeElement)) return
        setOverlay(prev => ({ ...prev, visible: false }))
        activeInput.current = null
      }, 150)
    }

    const handleInput = (event: Event) => {
      const target = event.target
      if (!isEditableElement(target)) return
      if (target !== activeInput.current) return
      if (target instanceof HTMLInputElement && !isSupportedTextInput(target)) return

      const value = getEditableText(target).trim()
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

    const text = getEditableText(input).trim()
    if (!text) return

    const selectionSnapshot = getEditableSelectionSnapshot(input)

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
        const kind = getEditableKind(input)
        const outputText = mode === "bilingual"
          ? formatBilingualOutput(text, result.text, kind)
          : result.text
        setEditableText(input, outputText)
        restoreEditableSelection(input, selectionSnapshot, outputText)
        dispatchEditableInputEvent(input, outputText)
      } else {
        const msg = result.message || "Translation failed"
        setOverlay(prev => ({ ...prev, error: msg }))
        setTimeout(() => setOverlay(prev => ({ ...prev, error: null })), 3000)
      }
    } finally {
      translatingRef.current = false
      setOverlay(prev => ({ ...prev, translating: false }))
    }
  }, [mode])

  const handleToggleMode = useCallback(() => {
    setMode(prev => {
      const next = prev === "replace" ? "bilingual" : "replace"
      void saveConfig({ inputTranslationMode: next }).catch(() => {})
      return next
    })
  }, [])

  if (!overlay.visible) return null

  return (
    <div
      style={{
        position: "fixed",
        top: overlay.top,
        left: overlay.left,
        zIndex: 2147483644,
        display: "flex",
        gap: 2,
      }}
    >
      <button
        type="button"
        data-testid="input-translate-mode"
        className="astra-cursor-pointer"
        style={{
          background: "transparent",
          color: mode === "bilingual" ? BRAND_COLOR : OVERLAY_STYLE_TOKENS.textHint,
          border: `1px solid ${mode === "bilingual" ? BRAND_COLOR : OVERLAY_STYLE_TOKENS.borderStrong}`,
          borderRadius: 4,
          padding: "2px 6px",
          fontSize: 10,
          fontWeight: 500,
          lineHeight: "normal",
        }}
        title={mode === "bilingual" ? t("inputTranslateModeBilingual") : t("inputTranslateModeReplace")}
        onClick={handleToggleMode}
      >
        {mode === "bilingual" ? "AB" : "A\u2192B"}
      </button>
      <button
        type="button"
        className="astra-cursor-pointer"
        style={{
          background: overlay.error ? OVERLAY_STYLE_TOKENS.warning : BRAND_COLOR,
          color: OVERLAY_STYLE_TOKENS.textInverse,
          border: "none",
          borderRadius: 4,
          padding: "2px 8px",
          fontSize: 11,
          fontWeight: 600,
          opacity: overlay.translating ? 0.6 : 1,
          pointerEvents: overlay.translating ? "none" : "auto",
        }}
        onClick={() => void handleTranslate()}
      >
        {overlay.error ? "\u26A0" : overlay.translating ? "\u22EF" : t("inputTranslateButton")}
      </button>
    </div>
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
  shadow.appendChild(createOverlayStyle1TokenStyleElement())
  const style = document.createElement("style")
  style.textContent = ".astra-cursor-pointer { cursor: pointer; }"
  shadow.appendChild(style)
  const container = document.createElement("div")
  shadow.appendChild(container)
  createRoot(container).render(<ErrorBoundary><InputTranslateApp /></ErrorBoundary>)
}
