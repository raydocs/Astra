import { act } from "react"

import { mountSelectionToolbar } from "@/entrypoints/content/components/SelectionToolbar"
import { t } from "@/utils/i18n"

import { evaluateSelectionExplain, type SelectionExplainExecution } from "../evaluators/selection-explain"
import { installBenchBrowser } from "../runtime/browser"
import {
  cleanupDomEnvironment,
  flushMicrotasks,
  getClipboardWrites,
  installDomEnvironment,
  installSelectionMock,
  setElementRect,
} from "../runtime/dom"
import { mountFixture } from "../runtime/fixtures"
import type { BenchmarkScenario, ScenarioCodeHint } from "../types"

const SELECTION_EXPLAIN_CODE_HINT: ScenarioCodeHint = {
  suspectedFiles: [
    "src/entrypoints/content/components/SelectionToolbar.tsx",
    "src/entrypoints/content/interaction-coordination.ts",
    "src/entrypoints/content/inline-actions.ts",
    "src/utils/dom/clipboard.ts",
  ],
  suspectedSymbols: [
    "mountSelectionToolbar",
    "getSelectionContext",
    "setInteractionSuppressionReason",
    "clearInteractionSuppression",
    "runActionById",
    "copyTextToClipboard",
  ],
  suspectedKeywords: [
    "解释",
    "复制",
    "selection",
    "toolbar",
  ],
  fallbackSurfaceFiles: [
    "src/entrypoints/content/components/SelectionToolbar.tsx",
    "src/entrypoints/content/interaction-coordination.ts",
  ],
  risk: "cross-module",
}

const HOST_ID = "astra-selection-toolbar-host"

function findToolbarButton(buttons: HTMLButtonElement[], labels: string[]): HTMLButtonElement | undefined {
  const normalized = labels.map((label) => label.trim())
  return buttons.find((button) => {
    const text = button.textContent?.trim()
    return !!text && normalized.includes(text)
  })
}

async function runSelectionScenario(options: {
  clickCopy?: boolean
}) {
  installDomEnvironment("https://example.com/fixtures/selection")
  try {
    const browser = installBenchBrowser()
    mountFixture(
      {
        kind: "inline",
        name: "selection-basic",
        html: `<main><article><p id="target">Hello world</p><p>More context around the selected sentence.</p></article></main>`,
      },
      { url: "/fixtures/selection-basic" },
    )

    const target = document.getElementById("target") as HTMLElement
    setElementRect(target, {
      top: 24,
      left: 12,
      width: 144,
      height: 20,
    })
    installSelectionMock("Hello world", target.firstChild ?? target)

    await act(async () => {
      mountSelectionToolbar()
      await flushMicrotasks()
    })

    target.dispatchEvent(new window.MouseEvent("mousedown", { bubbles: true }))
    target.dispatchEvent(new window.MouseEvent("mouseup", { bubbles: true }))

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 40))
      await flushMicrotasks(3)
    })

    const host = document.getElementById(HOST_ID)
    const buttons = Array.from(host?.shadowRoot?.querySelectorAll("button") ?? []) as HTMLButtonElement[]
    const explainButton = findToolbarButton(buttons, [t("actionExplain"), "解释"])

    if (!explainButton) {
      return {
        requestCount: 0,
        requestTask: null,
        requestSelectionContext: null,
        resultText: "",
        clipboardWrites: [],
        buttonLabels: buttons.map((button) => button.textContent?.trim() ?? ""),
      } satisfies SelectionExplainExecution
    }

    await act(async () => {
      explainButton.click()
      await flushMicrotasks(4)
    })

    if (options.clickCopy) {
      const copyButton = findToolbarButton(buttons, [t("actionCopy"), "复制"])
      if (copyButton) {
        await act(async () => {
          copyButton.click()
          await flushMicrotasks(2)
        })
      }
    }

    const translateCalls = browser.getTranslateCalls()
    return {
      requestCount: translateCalls.length,
      requestTask: translateCalls[0]?.payload.task ?? null,
      requestSelectionContext: translateCalls[0]?.payload.context?.selectionContext ?? null,
      resultText: host?.shadowRoot?.textContent?.replace(/\s+/g, " ").trim() ?? "",
      clipboardWrites: getClipboardWrites(),
      buttonLabels: buttons.map((button) => button.textContent?.trim() ?? ""),
    } satisfies SelectionExplainExecution
  } finally {
    cleanupDomEnvironment()
  }
}

export const selectionExplainScenarios: BenchmarkScenario<SelectionExplainExecution>[] = [
  {
    id: "selection-explain/contextful-result",
    title: "Selection explain action sends contextual text and renders a result panel",
    surface: "selection-explain",
    fixture: "inline:selection-basic",
    task: "Explain a selected sentence with context-aware inline output.",
    codeHint: SELECTION_EXPLAIN_CODE_HINT,
    run: () => runSelectionScenario({ clickCopy: false }),
    evaluate: (execution) => evaluateSelectionExplain(execution, {
      expectedTask: "explain",
      requireContext: true,
    }),
  },
  {
    id: "selection-explain/copy-result",
    title: "Selection toolbar copy action writes the generated result to clipboard",
    surface: "selection-explain",
    fixture: "inline:selection-basic",
    task: "Copy the generated explain output after the action completes.",
    codeHint: SELECTION_EXPLAIN_CODE_HINT,
    run: () => runSelectionScenario({ clickCopy: true }),
    evaluate: (execution) => evaluateSelectionExplain(execution, {
      expectedTask: "explain",
      requireContext: true,
      shouldCopy: true,
    }),
  },
]
