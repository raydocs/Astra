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

function getButton() {
  const host = document.getElementById(HOST_ID)
  return host?.shadowRoot?.querySelector("button") as HTMLButtonElement | null
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

    const input = document.getElementById(options.inputId) as HTMLInputElement | HTMLTextAreaElement | null
    if (!input) {
      throw new Error(`Missing input fixture node: ${options.inputId}`)
    }

    setElementRect(input, {
      top: 60,
      left: 24,
      width: 220,
      height: input instanceof HTMLTextAreaElement ? 56 : 24,
    })

    const initialValue = input.value

    await act(async () => {
      mountInputTranslate()
      await flushMicrotasks(2)
    })

    await act(async () => {
      input.dispatchEvent(new window.FocusEvent("focusin", { bubbles: true }))
      await flushMicrotasks(3)
    })

    const overlayVisibleAfterFocus = !!getButton()

    if (typeof options.typeAfterFocus === "string") {
      input.value = options.typeAfterFocus
      await act(async () => {
        input.dispatchEvent(new window.Event("input", { bubbles: true }))
        await flushMicrotasks(3)
      })
    }

    const overlayVisibleAfterTyping = !!getButton()
    const buttonLabel = getButton()?.textContent?.trim() ?? ""
    let writebackInputEventCount = 0
    input.addEventListener("input", () => {
      writebackInputEventCount += 1
    })

    let translationLatencyMs = 0
    if (options.clickTranslate) {
      const beforeRequestCount = browser.getTranslateCalls().length
      const beforeValue = input.value
      const startedAt = performance.now()

      await act(async () => {
        getButton()?.click()
        await flushMicrotasks(4)
      })

      await waitForCondition(() => (
        browser.getTranslateCalls().length > beforeRequestCount
        || input.value !== beforeValue
        || writebackInputEventCount > 0
      ))

      const latestCall = browser.getTranslateCalls().at(-1)
      translationLatencyMs = latestCall?.durationMs ?? (performance.now() - startedAt)
      await flushMicrotasks(4)
    }

    const translateCalls = browser.getTranslateCalls()
    const firstCall = translateCalls[0]

    const execution: InputTranslationExecution = {
      requestCount: translateCalls.length,
      requestTask: firstCall ? (firstCall.payload.task ?? "translate") : null,
      translatedValue: input.value,
      initialValue,
      overlayVisibleAfterFocus,
      overlayVisibleAfterTyping,
      buttonLabel,
      writebackInputEventCount,
      translationLatencyMs,
      payloadHostname: translateCalls[0]?.payload.context?.hostname ?? null,
      payloadPageUrl: translateCalls[0]?.payload.context?.pageUrl ?? null,
      inputType: input instanceof HTMLInputElement ? input.type : "textarea",
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
]
