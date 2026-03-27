import { act } from "react"

import { mountHoverTranslate } from "@/entrypoints/content/components/HoverTranslate"
import { setInteractionSuppressionReason } from "@/entrypoints/content/interaction-coordination"

import { evaluateHover, type HoverExecution } from "../evaluators/hover"
import { installBenchBrowser } from "../runtime/browser"
import {
  cleanupDomEnvironment,
  flushMicrotasks,
  installDomEnvironment,
  installSelectionMock,
  setElementRect,
} from "../runtime/dom"
import { mountFixture } from "../runtime/fixtures"
import type { BenchmarkScenario, ScenarioCodeHint } from "../types"

const HOVER_CODE_HINT: ScenarioCodeHint = {
  suspectedFiles: [
    "src/entrypoints/content/components/HoverTranslate.tsx",
    "src/entrypoints/content/interaction-coordination.ts",
    "src/utils/dom/traversal.ts",
    "src/entrypoints/content/inline-actions.ts",
  ],
  suspectedSymbols: [
    "mountHoverTranslate",
    "getInteractionSuppressionState",
    "hasActiveTextSelection",
    "subscribeToInteractionSuppression",
    "findClosestTextBlock",
    "runInlineAction",
  ],
  suspectedKeywords: [
    "hover",
    "selection",
    "suppression",
    "overlay",
  ],
  fallbackSurfaceFiles: [
    "src/entrypoints/content/components/HoverTranslate.tsx",
    "src/entrypoints/content/interaction-coordination.ts",
  ],
  risk: "cross-module",
}

const HOST_ID = "astra-hover-translate-host"

async function mountHoverScenario(config: {
  hoverTrigger: "alt" | "always" | "disabled"
  withSelection?: boolean
}) {
  installDomEnvironment("https://example.com/fixtures/hover")
  try {
    const browser = installBenchBrowser({
      config: {
        hoverTrigger: config.hoverTrigger,
      },
    })

    mountFixture(
      {
        kind: "inline",
        name: "hover-basic",
        html: `<main><p id="target">Hello world</p></main>`,
      },
      { url: "/fixtures/hover-basic" },
    )

    const target = document.getElementById("target") as HTMLElement
    setElementRect(target, {
      top: 40,
      left: 16,
      width: 144,
      height: 20,
    })

    if (config.withSelection) {
      installSelectionMock("Hello world", target.firstChild ?? target)
    }

    await act(async () => {
      mountHoverTranslate()
      await flushMicrotasks()
    })

    const start = performance.now()
    await act(async () => {
      const hoverEvent = new window.MouseEvent("mousemove", {
        altKey: true,
        bubbles: true,
        cancelable: true,
      })
      target.dispatchEvent(hoverEvent)
      await new Promise((resolve) => window.setTimeout(resolve, 360))
      await flushMicrotasks(4)
    })

    const host = document.getElementById(HOST_ID)
    const panel = host?.shadowRoot?.querySelector("div > div") as HTMLDivElement | null
    const triggerLabel = panel?.children[0]?.textContent?.trim() ?? ""
    const translationText = panel?.children[1]?.textContent?.trim() ?? ""
    const translateCalls = browser.getTranslateCalls()
    const execution: HoverExecution = {
      requestCount: translateCalls.length,
      overlayVisible: !!host?.shadowRoot?.textContent?.trim(),
      overlayText: translationText,
      overlayError: host?.shadowRoot?.textContent?.includes("⚠") ? host.shadowRoot?.textContent?.trim() ?? "" : "",
      triggerLabel,
      translationLatencyMs: performance.now() - start,
      selectionSuppressed: config.withSelection === true,
      payloadSelectionContext: translateCalls[0]?.payload.context?.selectionContext ?? null,
      payloadTask: translateCalls[0]?.payload.task ?? "translate",
    }

    return execution
  } finally {
    cleanupDomEnvironment()
  }
}

export const hoverScenarios: BenchmarkScenario<HoverExecution>[] = [
  {
    id: "hover/alt-success",
    title: "Alt-hover translates the closest text block with context",
    surface: "hover",
    fixture: "inline:hover-basic",
    task: "Translate a hovered phrase only when Alt is held, preserving selection context.",
    codeHint: HOVER_CODE_HINT,
    run: () => mountHoverScenario({ hoverTrigger: "alt" }),
    evaluate: (execution) => evaluateHover(execution, {
      shouldRequest: true,
      shouldShowOverlay: true,
      expectedTriggerLabel: "Alt + Hover",
      expectedTask: "translate",
      maxLatencyMs: 450,
    }),
  },
  {
    id: "hover/disabled-suppressed",
    title: "Disabled hover mode suppresses requests and overlay rendering",
    surface: "hover",
    fixture: "inline:hover-basic",
    task: "Do not translate on hover when the feature is disabled in config.",
    codeHint: HOVER_CODE_HINT,
    run: () => mountHoverScenario({ hoverTrigger: "disabled" }),
    evaluate: (execution) => evaluateHover(execution, {
      shouldRequest: false,
      shouldShowOverlay: false,
    }),
  },
  {
    id: "hover/selection-suppression",
    title: "Active text selection suppresses hover translation",
    surface: "hover",
    fixture: "inline:hover-basic",
    task: "Avoid triggering hover translation while a selection is active.",
    codeHint: HOVER_CODE_HINT,
    run: async () => {
      const execution = await mountHoverScenario({ hoverTrigger: "alt", withSelection: true })
      setInteractionSuppressionReason("selection-toolbar", false)
      return execution
    },
    evaluate: (execution) => evaluateHover(execution, {
      shouldRequest: false,
      shouldShowOverlay: false,
      requireSelectionSuppression: true,
    }),
  },
]
