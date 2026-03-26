import { act } from "react"

import { mountFloatBall } from "@/entrypoints/content/components/FloatBall"
import { mountHoverTranslate } from "@/entrypoints/content/components/HoverTranslate"
import { mountInputTranslate } from "@/entrypoints/content/components/InputTranslate"
import { mountSelectionToolbar } from "@/entrypoints/content/components/SelectionToolbar"
import {
  __resetInteractionCoordinationForTests,
  clearInteractionSuppression,
  getInteractionSuppressionState,
} from "@/entrypoints/content/interaction-coordination"

import {
  evaluateInteractionPriority,
  type InteractionPriorityExecution,
} from "../evaluators/interaction-priority"
import { installBenchBrowser } from "../runtime/browser"
import {
  cleanupDomEnvironment,
  flushMicrotasks,
  installDomEnvironment,
  installSelectionMock,
  setElementRect,
} from "../runtime/dom"
import { mountFixture } from "../runtime/fixtures"
import type { BenchmarkScenario } from "../types"

type ScenarioCodeHint = {
  suspectedFiles?: string[]
  suspectedSymbols?: string[]
  suspectedKeywords?: string[]
  fallbackSurfaceFiles?: string[]
  risk?: "local" | "cross-module"
}

type BenchmarkScenarioWithHint = BenchmarkScenario<InteractionPriorityExecution> & {
  codeHint: ScenarioCodeHint
}

const HOST_IDS = {
  selection: "astra-selection-toolbar-host",
  hover: "astra-hover-translate-host",
  input: "astra-input-translate-host",
  floatBall: "astra-float-ball-host",
} as const

function getHost(id: string): HTMLDivElement | null {
  return document.getElementById(id) as HTMLDivElement | null
}

function isSelectionToolbarVisible() {
  return (getHost(HOST_IDS.selection)?.shadowRoot?.querySelectorAll("button").length ?? 0) > 0
}

function isHoverOverlayVisible() {
  const shadowRoot = getHost(HOST_IDS.hover)?.shadowRoot
  return Boolean(shadowRoot?.querySelector("button"))
}

function isInputOverlayVisible() {
  return Boolean(getHost(HOST_IDS.input)?.shadowRoot?.querySelector("button"))
}

function isFloatBallMounted() {
  return Boolean(getHost(HOST_IDS.floatBall)?.shadowRoot?.querySelector("div[title]"))
}

function collectMountedHosts() {
  return Object.values(HOST_IDS).filter((id) => getHost(id))
}

function collectVisibleHosts() {
  const visible: string[] = []
  if (isSelectionToolbarVisible()) visible.push(HOST_IDS.selection)
  if (isHoverOverlayVisible()) visible.push(HOST_IDS.hover)
  if (isInputOverlayVisible()) visible.push(HOST_IDS.input)
  if (isFloatBallMounted()) visible.push(HOST_IDS.floatBall)
  return visible
}

async function dispatchPointerSelection(target: HTMLElement, selectionText: string) {
  const downEvent = new window.MouseEvent("mousedown", {
    bubbles: true,
    cancelable: true,
    button: 0,
  })
  const upEvent = new window.MouseEvent("mouseup", {
    bubbles: true,
    cancelable: true,
  })

  await act(async () => {
    target.dispatchEvent(downEvent)
    await flushMicrotasks(2)
  })

  installSelectionMock(selectionText, target.firstChild ?? target, {
    top: 12,
    left: 16,
    right: 132,
    bottom: 32,
    width: 116,
    height: 20,
    x: 16,
    y: 12,
  })

  await act(async () => {
    target.dispatchEvent(upEvent)
    await new Promise((resolve) => window.setTimeout(resolve, 40))
    await flushMicrotasks(6)
  })
}

async function dispatchHover(target: HTMLElement) {
  const hoverEvent = new window.MouseEvent("mousemove", {
    bubbles: true,
    cancelable: true,
    altKey: true,
  })

  await act(async () => {
    target.dispatchEvent(hoverEvent)
    await new Promise((resolve) => window.setTimeout(resolve, 360))
    await flushMicrotasks(6)
  })
}

async function focusInput(input: HTMLInputElement) {
  input.focus()
  const focusEvent = new window.FocusEvent("focusin", {
    bubbles: true,
    cancelable: true,
  })

  await act(async () => {
    input.dispatchEvent(focusEvent)
    await flushMicrotasks(6)
  })
}

async function clickFloatBall() {
  const button = getHost(HOST_IDS.floatBall)?.shadowRoot?.querySelector("div[title]") as HTMLDivElement | null
  if (!button) {
    throw new Error("Float ball button not mounted")
  }

  if (!("setPointerCapture" in HTMLElement.prototype)) {
    Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
      configurable: true,
      value: () => undefined,
    })
  }

  const downEvent = new window.Event("pointerdown", { bubbles: true, cancelable: true })
  Object.defineProperties(downEvent, {
    clientY: { value: 320 },
    pointerId: { value: 1 },
  })
  const upEvent = new window.Event("pointerup", { bubbles: true, cancelable: true })
  Object.defineProperties(upEvent, {
    clientY: { value: 320 },
    pointerId: { value: 1 },
  })

  await act(async () => {
    button.dispatchEvent(downEvent)
    await flushMicrotasks(2)
  })

  await act(async () => {
    button.dispatchEvent(upEvent)
    await flushMicrotasks(6)
  })
}

async function mountInteractionScenario() {
  const browser = installBenchBrowser()
  mountFixture(
    {
      kind: "inline",
      name: "interaction-priority",
      html: `
        <main>
          <p id="target">Hello world</p>
          <input id="text-input" type="text" value="Hello from Astra" />
        </main>
      `,
    },
    { url: "/fixtures/interaction-priority" },
  )

  const target = document.getElementById("target") as HTMLElement
  const input = document.getElementById("text-input") as HTMLInputElement

  setElementRect(target, {
    top: 40,
    left: 16,
    width: 160,
    height: 20,
  })
  setElementRect(input, {
    top: 96,
    left: 16,
    width: 240,
    height: 24,
  })

  await act(async () => {
    mountSelectionToolbar()
    mountHoverTranslate()
    mountInputTranslate()
    mountFloatBall()
    await flushMicrotasks(8)
  })

  return { browser, target, input }
}

async function executeInteractionPriorityScenario(
  run: () => Promise<InteractionPriorityExecution>,
) {
  installDomEnvironment("https://example.com/fixtures/interaction-priority")
  try {
    return await run()
  } finally {
    clearInteractionSuppression()
    __resetInteractionCoordinationForTests()
    cleanupDomEnvironment()
  }
}

export const interactionPriorityScenarios: BenchmarkScenario<InteractionPriorityExecution>[] = [
  {
    id: "interaction-priority/selection-blocks-hover",
    title: "Selection toolbar takes priority and suppresses hover translation while active",
    surface: "interaction-priority",
    fixture: "inline:interaction-priority",
    task: "Prevent hover translation from firing while the selection toolbar is active.",
    codeHint: {
      suspectedFiles: [
        "src/entrypoints/content/interaction-coordination.ts",
        "src/entrypoints/content/components/HoverTranslate.tsx",
        "src/entrypoints/content/components/SelectionToolbar.tsx",
      ],
      suspectedSymbols: [
        "getInteractionSuppressionState",
        "clearInteractionSuppression",
        "mountHoverTranslate",
        "mountSelectionToolbar",
      ],
      suspectedKeywords: ["hoverSuppressed", "selection"],
      risk: "cross-module",
    },
    run: () => executeInteractionPriorityScenario(async () => {
      const { browser, target } = await mountInteractionScenario()
      await dispatchPointerSelection(target, "Hello world")
      await dispatchHover(target)

      return {
        hoverSuppressed: getInteractionSuppressionState().hoverSuppressed,
        hoverRequestCount: browser.getTranslateCalls().length,
        toggleCommandCount: browser.getCommandCalls().length,
        selectionToolbarVisible: isSelectionToolbarVisible(),
        hoverOverlayVisible: isHoverOverlayVisible(),
        inputOverlayVisible: isInputOverlayVisible(),
        floatBallMounted: isFloatBallMounted(),
        visibleHosts: collectVisibleHosts(),
        mountedHosts: collectMountedHosts(),
        notes: ["selection-blocks-hover"],
      }
    }),
    evaluate: (execution) => evaluateInteractionPriority(execution, {
      shouldSuppressHover: true,
      shouldRequestHover: false,
      requiredVisibleHosts: [HOST_IDS.selection, HOST_IDS.floatBall],
      forbiddenVisibleHosts: [HOST_IDS.hover, HOST_IDS.input],
      requireFloatBallMounted: true,
    }),
  },
  {
    id: "interaction-priority/dismissed-selection-restores-hover",
    title: "Dismissing the selection toolbar restores hover translation",
    surface: "interaction-priority",
    fixture: "inline:interaction-priority",
    task: "Allow hover translation to resume after the blocking selection toolbar is dismissed.",
    codeHint: {
      suspectedFiles: [
        "src/entrypoints/content/interaction-coordination.ts",
        "src/entrypoints/content/components/HoverTranslate.tsx",
      ],
      suspectedSymbols: ["getInteractionSuppressionState", "clearInteractionSuppression"],
      suspectedKeywords: ["hoverSuppressed", "scroll", "selection"],
      risk: "cross-module",
    },
    run: () => executeInteractionPriorityScenario(async () => {
      const { browser, target } = await mountInteractionScenario()
      await dispatchPointerSelection(target, "Hello world")

      await act(async () => {
        window.dispatchEvent(new window.Event("scroll"))
        await flushMicrotasks(6)
      })
      installSelectionMock("", target.firstChild ?? target)

      await dispatchHover(target)

      return {
        hoverSuppressed: getInteractionSuppressionState().hoverSuppressed,
        hoverRequestCount: browser.getTranslateCalls().length,
        toggleCommandCount: browser.getCommandCalls().length,
        selectionToolbarVisible: isSelectionToolbarVisible(),
        hoverOverlayVisible: isHoverOverlayVisible(),
        inputOverlayVisible: isInputOverlayVisible(),
        floatBallMounted: isFloatBallMounted(),
        visibleHosts: collectVisibleHosts(),
        mountedHosts: collectMountedHosts(),
        notes: ["dismissed-selection-restores-hover"],
      }
    }),
    evaluate: (execution) => evaluateInteractionPriority(execution, {
      shouldSuppressHover: false,
      shouldRequestHover: true,
      requiredVisibleHosts: [HOST_IDS.hover, HOST_IDS.floatBall],
      forbiddenVisibleHosts: [HOST_IDS.selection, HOST_IDS.input],
      requireFloatBallMounted: true,
    }),
  },
  {
    id: "interaction-priority/input-focus-stays-isolated",
    title: "Input translation focus stays isolated from hover and selection overlays",
    surface: "interaction-priority",
    fixture: "inline:interaction-priority",
    task: "Show only the input translation affordance when a text field is focused.",
    codeHint: {
      suspectedFiles: [
        "src/entrypoints/content/components/InputTranslate.tsx",
        "src/entrypoints/content/interaction-coordination.ts",
      ],
      suspectedSymbols: ["mountInputTranslate", "getInteractionSuppressionState"],
      suspectedKeywords: ["focusin", "inputOverlayVisible", "hoverSuppressed"],
      risk: "cross-module",
    },
    run: () => executeInteractionPriorityScenario(async () => {
      const { browser, input } = await mountInteractionScenario()
      await focusInput(input)

      return {
        hoverSuppressed: getInteractionSuppressionState().hoverSuppressed,
        hoverRequestCount: browser.getTranslateCalls().length,
        toggleCommandCount: browser.getCommandCalls().length,
        selectionToolbarVisible: isSelectionToolbarVisible(),
        hoverOverlayVisible: isHoverOverlayVisible(),
        inputOverlayVisible: isInputOverlayVisible(),
        floatBallMounted: isFloatBallMounted(),
        visibleHosts: collectVisibleHosts(),
        mountedHosts: collectMountedHosts(),
        notes: ["input-focus-isolated"],
      }
    }),
    evaluate: (execution) => evaluateInteractionPriority(execution, {
      shouldSuppressHover: false,
      shouldRequestHover: false,
      requiredVisibleHosts: [HOST_IDS.input, HOST_IDS.floatBall],
      forbiddenVisibleHosts: [HOST_IDS.selection, HOST_IDS.hover],
      requireFloatBallMounted: true,
    }),
  },
  {
    id: "interaction-priority/float-ball-toggle-stays-independent",
    title: "Float ball toggles the page without surfacing other inline overlays",
    surface: "interaction-priority",
    fixture: "inline:interaction-priority",
    task: "Keep the float ball action independent from hover, selection, and input overlays.",
    codeHint: {
      suspectedFiles: [
        "src/entrypoints/content/components/FloatBall.tsx",
        "src/entrypoints/content/interaction-coordination.ts",
        "src/entrypoints/content/components/SelectionToolbar.tsx",
      ],
      suspectedSymbols: ["mountFloatBall", "getInteractionSuppressionState"],
      suspectedKeywords: ["pointerdown", "toggleCommandCount", "floatBallMounted"],
      risk: "cross-module",
    },
    run: () => executeInteractionPriorityScenario(async () => {
      const { browser } = await mountInteractionScenario()
      await clickFloatBall()

      return {
        hoverSuppressed: getInteractionSuppressionState().hoverSuppressed,
        hoverRequestCount: browser.getTranslateCalls().length,
        toggleCommandCount: browser.getCommandCalls().length,
        selectionToolbarVisible: isSelectionToolbarVisible(),
        hoverOverlayVisible: isHoverOverlayVisible(),
        inputOverlayVisible: isInputOverlayVisible(),
        floatBallMounted: isFloatBallMounted(),
        visibleHosts: collectVisibleHosts(),
        mountedHosts: collectMountedHosts(),
        notes: ["float-ball-toggle-isolated"],
      }
    }),
    evaluate: (execution) => evaluateInteractionPriority(execution, {
      shouldSuppressHover: false,
      shouldRequestHover: false,
      shouldToggleFloatBall: true,
      requiredVisibleHosts: [HOST_IDS.floatBall],
      forbiddenVisibleHosts: [HOST_IDS.selection, HOST_IDS.hover, HOST_IDS.input],
      requireFloatBallMounted: true,
    }),
  },
] as BenchmarkScenario<InteractionPriorityExecution>[]
