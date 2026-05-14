import { JSDOM } from "jsdom"

let activeDom: JSDOM | null = null
let cleanupFns: Array<() => void> = []

const GLOBAL_KEYS = [
  "window",
  "document",
  "Node",
  "Element",
  "HTMLElement",
  "HTMLInputElement",
  "HTMLTextAreaElement",
  "HTMLVideoElement",
  "HTMLTrackElement",
  "Text",
  "Range",
  "ShadowRoot",
  "Document",
  "DocumentFragment",
  "MutationObserver",
  "CustomEvent",
  "Event",
  "MouseEvent",
  "KeyboardEvent",
  "FocusEvent",
  "InputEvent",
  "DOMRect",
  "navigator",
  "location",
  "history",
  "getComputedStyle",
  "requestAnimationFrame",
  "cancelAnimationFrame",
  "IntersectionObserver",
  "speechSynthesis",
  "SpeechSynthesisUtterance",
] as const

const previousGlobals = new Map<string, unknown>()

export class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = []

  readonly observed = new Set<Element>()
  private readonly callback: IntersectionObserverCallback

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback
    MockIntersectionObserver.instances.push(this)
  }

  disconnect() {
    this.observed.clear()
  }

  observe(element: Element) {
    this.observed.add(element)
  }

  unobserve(element: Element) {
    this.observed.delete(element)
  }

  takeRecords(): IntersectionObserverEntry[] {
    return []
  }

  trigger(element: Element, isIntersecting = true) {
    this.callback([{
      target: element,
      isIntersecting,
      intersectionRatio: isIntersecting ? 1 : 0,
      boundingClientRect: element.getBoundingClientRect(),
      intersectionRect: element.getBoundingClientRect(),
      rootBounds: null,
      time: 0,
    } as IntersectionObserverEntry], this as unknown as IntersectionObserver)
  }
}

function assignGlobal(key: string, value: unknown) {
  if (!previousGlobals.has(key)) {
    previousGlobals.set(key, (globalThis as Record<string, unknown>)[key])
  }

  Object.defineProperty(globalThis, key, {
    configurable: true,
    writable: true,
    value,
  })
}

export function installDomEnvironment(url = "https://example.com/fixtures") {
  cleanupDomEnvironment()

  activeDom = new JSDOM(
    "<!DOCTYPE html><html><head></head><body></body></html>",
    {
      url,
      pretendToBeVisual: true,
    },
  )

  const { window } = activeDom

  Object.defineProperty(window.navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: async (text: string) => {
        ;(globalThis as { __ASTRA_BENCH_CLIPBOARD__?: string[] }).__ASTRA_BENCH_CLIPBOARD__ ??= []
        ;(globalThis as { __ASTRA_BENCH_CLIPBOARD__?: string[] }).__ASTRA_BENCH_CLIPBOARD__?.push(text)
      },
    },
  })

  Object.defineProperty(window.document, "execCommand", {
    configurable: true,
    value: (command: string) => command === "copy",
  })

  Object.defineProperty(window, "speechSynthesis", {
    configurable: true,
    value: {
      speaking: false,
      cancel() {
        this.speaking = false
      },
      speak() {
        this.speaking = true
      },
    },
  })

  class BenchSpeechSynthesisUtterance {
    text: string
    lang = ""
    rate = 1

    constructor(text: string) {
      this.text = text
    }
  }

  Object.defineProperty(window, "SpeechSynthesisUtterance", {
    configurable: true,
    value: BenchSpeechSynthesisUtterance,
  })

  GLOBAL_KEYS.forEach((key) => {
    switch (key) {
      case "requestAnimationFrame":
        assignGlobal(key, (callback: FrameRequestCallback) => window.setTimeout(() => callback(Date.now()), 16))
        break
      case "cancelAnimationFrame":
        assignGlobal(key, (id: number) => window.clearTimeout(id))
        break
      case "IntersectionObserver":
        MockIntersectionObserver.instances = []
        assignGlobal(key, MockIntersectionObserver)
        break
      default:
        assignGlobal(key, (window as Record<string, unknown>)[key])
        break
    }
  })

  assignGlobal("self", window)
  assignGlobal("globalThis", globalThis)
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

  return window
}

export function cleanupDomEnvironment() {
  while (cleanupFns.length > 0) {
    cleanupFns.pop()?.()
  }

  activeDom?.window.close()
  activeDom = null
  MockIntersectionObserver.instances = []
  ;(globalThis as { __ASTRA_BENCH_CLIPBOARD__?: string[] }).__ASTRA_BENCH_CLIPBOARD__ = []
}

export function registerDomCleanup(cleanup: () => void) {
  cleanupFns.push(cleanup)
}

export function setViewport(width = 1280, height = 800) {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width })
  Object.defineProperty(window, "innerHeight", { configurable: true, value: height })
}

export function setElementRect(
  element: Element,
  { top, left = 0, width = 640, height = 24 }: {
    top: number
    left?: number
    width?: number
    height?: number
  },
) {
  Object.defineProperty(element, "getBoundingClientRect", {
    configurable: true,
    value: () => ({
      top,
      left,
      width,
      height,
      right: left + width,
      bottom: top + height,
      x: left,
      y: top,
      toJSON: () => ({}),
    } satisfies DOMRect),
  })
}

export function stackElements(
  elements: Element[],
  { startTop = 40, gap = 32, left = 24, width = 640, height = 24 } = {},
) {
  elements.forEach((element, index) => {
    setElementRect(element, {
      top: startTop + index * gap,
      left,
      width,
      height,
    })
  })
}

export async function flushMicrotasks(times = 2) {
  for (let index = 0; index < times; index += 1) {
    await Promise.resolve()
  }
}

export function installSelectionMock(
  text: string,
  rangeNode: Node,
  rect: Partial<DOMRect> = {},
) {
  const rangeRect = {
    top: 10,
    left: 10,
    right: 120,
    bottom: 30,
    width: 110,
    height: 20,
    x: 10,
    y: 10,
    toJSON: () => ({}),
    ...rect,
  } as DOMRect

  const range = {
    commonAncestorContainer: rangeNode,
    getBoundingClientRect: () => rangeRect,
  }

  const selectionValue = {
    rangeCount: text ? 1 : 0,
    isCollapsed: text.length === 0,
    toString: () => text,
    getRangeAt: () => range,
  }

  Object.defineProperty(window, "getSelection", {
    configurable: true,
    value: () => selectionValue,
  })

  Object.defineProperty(document, "getSelection", {
    configurable: true,
    value: () => selectionValue,
  })
}

export function getClipboardWrites(): string[] {
  return [...((globalThis as { __ASTRA_BENCH_CLIPBOARD__?: string[] }).__ASTRA_BENCH_CLIPBOARD__ ?? [])]
}
