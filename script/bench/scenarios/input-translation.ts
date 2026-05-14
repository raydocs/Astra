import { act } from "react"

import { mountInputTranslate } from "@/entrypoints/content/components/InputTranslate"

import { evaluateInputTranslation, type InputTranslationExecution } from "../evaluators/input-translation"
import { installBenchBrowser, type BenchBrowserOptions } from "../runtime/browser"
import { cleanupDomEnvironment, flushMicrotasks, installDomEnvironment, setElementRect } from "../runtime/dom"
import { mountFixture } from "../runtime/fixtures"
import type { BenchmarkScenario, ScenarioCodeHint } from "../types"

const INPUT_TRANSLATION_CODE_HINT: ScenarioCodeHint = {
  suspectedFiles: [
    "src/entrypoints/content/components/InputTranslate.tsx",
    "src/entrypoints/content/inline-actions.ts",
    "src/utils/privacy.ts",
    "src/utils/storage/config.ts",
  ],
  suspectedSymbols: [
    "mountInputTranslate",
    "runInlineAction",
    "isSensitiveInput",
    "readConfig",
    "resolveSiteTranslationSettings",
  ],
  suspectedKeywords: [
    "password",
    "input",
    "overlay",
    "translation",
  ],
  fallbackSurfaceFiles: [
    "src/entrypoints/content/components/InputTranslate.tsx",
    "src/entrypoints/content/inline-actions.ts",
  ],
  risk: "cross-module",
}

const HOST_ID = "astra-input-translate-host"

interface SelectionRange {
  start: number
  end: number
}

const TEXT_NODE_FILTER = typeof NodeFilter !== "undefined" ? NodeFilter.SHOW_TEXT : 4

function getButton() {
  const host = document.getElementById(HOST_ID)
  const root = host?.shadowRoot
  if (!root) return null
  // Skip mode toggle (`data-testid="input-translate-mode"`); use the translate button.
  const buttons = Array.from(root.querySelectorAll("button"))
  return (buttons.find((b) => !b.hasAttribute("data-testid")) ?? null) as HTMLButtonElement | null
}

function isEditableElement(target: Element): target is HTMLInputElement | HTMLTextAreaElement | HTMLElement {
  return target instanceof HTMLInputElement
    || target instanceof HTMLTextAreaElement
    || (target instanceof HTMLElement && (target.isContentEditable || target.getAttribute("contenteditable") === "true"))
}

function getEditableKind(target: HTMLInputElement | HTMLTextAreaElement | HTMLElement): InputTranslationExecution["editableKind"] {
  if (target instanceof HTMLTextAreaElement) return "textarea"
  if (target instanceof HTMLInputElement) return "input"
  if (target.getAttribute("contenteditable") === "true" || target.isContentEditable) return "contenteditable"
  return "contenteditable"
}

function getEditableText(target: HTMLInputElement | HTMLTextAreaElement | HTMLElement): string {
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    return target.value
  }

  return target.textContent ?? ""
}

function setEditableText(target: HTMLInputElement | HTMLTextAreaElement | HTMLElement, text: string) {
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

function setEditableSelection(target: HTMLInputElement | HTMLTextAreaElement | HTMLElement, selection: SelectionRange) {
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    target.setSelectionRange(selection.start, selection.end)
    return
  }

  const currentSelection = window.getSelection()
  if (!currentSelection) return

  const startPosition = resolveContentEditablePosition(target, selection.start)
  const endPosition = resolveContentEditablePosition(target, selection.end)

  const range = document.createRange()
  range.setStart(startPosition.node, startPosition.offset)
  range.setEnd(endPosition.node, endPosition.offset)
  currentSelection.removeAllRanges()
  currentSelection.addRange(range)
}

function snapshotEditableSelection(target: HTMLInputElement | HTMLTextAreaElement | HTMLElement) {
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    return {
      start: target.selectionStart,
      end: target.selectionEnd,
    }
  }

  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) {
    return {
      start: null,
      end: null,
    }
  }

  const range = selection.getRangeAt(0)
  if (!target.contains(range.commonAncestorContainer)) {
    return {
      start: null,
      end: null,
    }
  }

  return {
    start: getContentEditableOffset(target, range.startContainer, range.startOffset),
    end: getContentEditableOffset(target, range.endContainer, range.endOffset),
  }
}

async function waitForCondition(
  predicate: () => boolean,
  timeoutMs = 600,
) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    if (predicate()) {
      await flushMicrotasks(4)
      return true
    }
    await new Promise((resolve) => window.setTimeout(resolve, 10))
    await flushMicrotasks(2)
  }

  return predicate()
}

async function runInputScenario(options: {
  fixtureName: string
  html: string
  inputId: string
  browser?: BenchBrowserOptions
  typeAfterFocus?: string
  clickTranslate?: boolean
  url?: string
  selectionBefore?: SelectionRange
  editableKind?: InputTranslationExecution["editableKind"]
}) {
  installDomEnvironment(`https://example.com${options.url ?? "/fixtures/input-translation"}`)
  try {
    const browser = installBenchBrowser(options.browser)
    mountFixture(
      {
        kind: "inline",
        name: options.fixtureName,
        html: options.html,
      },
      {
        title: "Astra Bench Input Translation",
        metaDescription: "Fixture for input translation benchmark.",
        url: options.url ?? "/fixtures/input-translation",
      },
    )

    const target = document.getElementById(options.inputId) as HTMLInputElement | HTMLTextAreaElement | HTMLElement | null
    if (!target || !isEditableElement(target)) {
      throw new Error(`Missing input fixture node: ${options.inputId}`)
    }

    setElementRect(target, {
      top: 60,
      left: 24,
      width: 260,
      height: target instanceof HTMLTextAreaElement ? 64 : target.isContentEditable ? 72 : 24,
    })

    const initialValue = getEditableText(target)

    await act(async () => {
      mountInputTranslate()
      await flushMicrotasks(2)
    })

    await act(async () => {
      target.dispatchEvent(new window.FocusEvent("focusin", { bubbles: true }))
      await flushMicrotasks(3)
    })

    const overlayVisibleAfterFocus = !!getButton()

    if (typeof options.typeAfterFocus === "string") {
      setEditableText(target, options.typeAfterFocus)
      await act(async () => {
        target.dispatchEvent(new window.Event("input", { bubbles: true }))
        await flushMicrotasks(3)
      })
    }

    if (options.selectionBefore) {
      setEditableSelection(target, options.selectionBefore)
      await flushMicrotasks(1)
    }

    const selectionBefore = snapshotEditableSelection(target)
    const selectionStartBefore = selectionBefore.start
    const selectionEndBefore = selectionBefore.end

    const overlayVisibleAfterTyping = !!getButton()
    const buttonLabel = getButton()?.textContent?.trim() ?? ""
    let writebackInputEventCount = 0
    target.addEventListener("input", () => {
      writebackInputEventCount += 1
    })

    let translationLatencyMs = 0
    if (options.clickTranslate) {
      const beforeRequestCount = browser.getTranslateCalls().length
      const beforeValue = getEditableText(target)
      const startedAt = performance.now()

      await act(async () => {
        getButton()?.click()
        await flushMicrotasks(4)
      })

      await waitForCondition(() => (
        browser.getTranslateCalls().length > beforeRequestCount
        || getEditableText(target) !== beforeValue
        || writebackInputEventCount > 0
      ))

      const latestCall = browser.getTranslateCalls().at(-1)
      translationLatencyMs = latestCall?.durationMs ?? (performance.now() - startedAt)
      await flushMicrotasks(4)
    }

    const selectionAfter = snapshotEditableSelection(target)
    const translateCalls = browser.getTranslateCalls()
    const firstCall = translateCalls[0]

    const execution: InputTranslationExecution = {
      requestCount: translateCalls.length,
      requestTask: firstCall ? (firstCall.payload.task ?? "translate") : null,
      translatedValue: getEditableText(target),
      initialValue,
      overlayVisibleAfterFocus,
      overlayVisibleAfterTyping,
      buttonLabel,
      writebackInputEventCount,
      translationLatencyMs,
      payloadHostname: firstCall?.payload.context?.hostname ?? null,
      payloadPageUrl: firstCall?.payload.context?.pageUrl ?? null,
      inputType: target instanceof HTMLInputElement ? target.type : target instanceof HTMLTextAreaElement ? "textarea" : "contenteditable",
      editableKind: options.editableKind ?? getEditableKind(target),
      selectionStartBefore,
      selectionEndBefore,
      selectionStartAfter: selectionAfter.start,
      selectionEndAfter: selectionAfter.end,
    }

    return execution
  } finally {
    cleanupDomEnvironment()
  }
}

export const inputTranslationScenarios: BenchmarkScenario<InputTranslationExecution>[] = [
  {
    id: "input-translation/writeback",
    title: "Focused text input translates in place and dispatches a writeback input event",
    surface: "input-translation",
    fixture: "inline:input-text",
    task: "Translate the active text input value without leaving the field or dropping page context.",
    codeHint: INPUT_TRANSLATION_CODE_HINT,
    run: () => runInputScenario({
      fixtureName: "input-text",
      html: `<main><input id="text-input" type="text" value="Hello world" /></main>`,
      inputId: "text-input",
      clickTranslate: true,
    }),
    evaluate: (execution) => evaluateInputTranslation(execution, {
      shouldRequest: true,
      shouldShowAfterFocus: true,
      shouldWriteBack: true,
      expectedTask: "translate",
      requireContext: true,
      maxLatencyMs: 350,
    }),
  },
  {
    id: "input-translation/empty-then-type",
    title: "Empty inputs stay quiet until typing reveals the overlay and enables translation",
    surface: "input-translation",
    fixture: "inline:input-empty",
    task: "Keep the input overlay hidden for empty fields, then reveal and translate once the user types.",
    codeHint: INPUT_TRANSLATION_CODE_HINT,
    run: () => runInputScenario({
      fixtureName: "input-empty",
      html: `<main><input id="empty-input" type="text" value="" /></main>`,
      inputId: "empty-input",
      typeAfterFocus: "Need help",
      clickTranslate: true,
    }),
    evaluate: (execution) => evaluateInputTranslation(execution, {
      shouldRequest: true,
      shouldShowAfterFocus: false,
      shouldShowAfterTyping: true,
      shouldWriteBack: true,
      expectedTask: "translate",
      requireContext: true,
      maxLatencyMs: 350,
    }),
  },
  {
    id: "input-translation/password-suppressed",
    title: "Sensitive password fields never expose an overlay or send translation requests",
    surface: "input-translation",
    fixture: "inline:input-password",
    task: "Suppress input translation for sensitive form fields such as passwords.",
    codeHint: INPUT_TRANSLATION_CODE_HINT,
    run: () => runInputScenario({
      fixtureName: "input-password",
      html: `<main><input id="password-input" type="password" value="hunter2" autocomplete="current-password" /></main>`,
      inputId: "password-input",
      clickTranslate: false,
    }),
    evaluate: (execution) => evaluateInputTranslation(execution, {
      shouldRequest: false,
      shouldShowAfterFocus: false,
      shouldWriteBack: false,
    }),
  },
  {
    id: "input-translation/textarea-cursor-preserved",
    title: "Textarea translations preserve the cursor or selection range after writeback",
    surface: "input-translation",
    fixture: "inline:textarea-cursor",
    task: "Preserve the active textarea selection when translating and writing the text back in place.",
    codeHint: INPUT_TRANSLATION_CODE_HINT,
    run: () => runInputScenario({
      fixtureName: "textarea-cursor",
      html: `<main><textarea id="textarea-input">Some text to translate</textarea></main>`,
      inputId: "textarea-input",
      selectionBefore: { start: 5, end: 9 },
      clickTranslate: true,
      editableKind: "textarea",
    }),
    evaluate: (execution) => evaluateInputTranslation(execution, {
      shouldRequest: true,
      shouldShowAfterFocus: true,
      shouldWriteBack: true,
      shouldPreserveCursor: true,
      expectedTask: "translate",
      requireContext: true,
      maxLatencyMs: 350,
    }),
  },
  {
    id: "input-translation/contenteditable-writeback",
    title: "Contenteditable translations write back and keep the caret inside the editor",
    surface: "input-translation",
    fixture: "inline:contenteditable-writeback",
    task: "Translate a contenteditable editor in place without dropping the caret or selection.",
    codeHint: INPUT_TRANSLATION_CODE_HINT,
    run: () => runInputScenario({
      fixtureName: "contenteditable-writeback",
      html: `<main><div id="editor" contenteditable="true">Editable text</div></main>`,
      inputId: "editor",
      selectionBefore: { start: 3, end: 3 },
      clickTranslate: true,
      editableKind: "contenteditable",
    }),
    evaluate: (execution) => evaluateInputTranslation(execution, {
      shouldRequest: true,
      shouldShowAfterFocus: true,
      shouldWriteBack: true,
      shouldPreserveCursor: true,
      expectedTask: "translate",
      requireContext: true,
      maxLatencyMs: 350,
    }),
  },
]
