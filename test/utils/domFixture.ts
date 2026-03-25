import { vi } from "vitest"

const ORIGINAL_INNER_WIDTH = window.innerWidth
const ORIGINAL_INNER_HEIGHT = window.innerHeight
const ORIGINAL_INTERSECTION_OBSERVER = globalThis.IntersectionObserver

export interface ElementRectOptions {
  top: number
  left?: number
  width?: number
  height?: number
}

export function setViewport(width = 1280, height = 800) {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width })
  Object.defineProperty(window, "innerHeight", { configurable: true, value: height })
}

export function setElementRect(
  element: Element,
  { top, left = 0, width = 640, height = 24 }: ElementRectOptions,
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

export class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = []

  private readonly callback: IntersectionObserverCallback
  readonly observed = new Set<Element>()

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

export function installMockIntersectionObserver() {
  MockIntersectionObserver.instances = []
  Object.defineProperty(globalThis, "IntersectionObserver", {
    configurable: true,
    value: MockIntersectionObserver,
  })
}

export function resetDomFixtureGlobals() {
  MockIntersectionObserver.instances = []
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: ORIGINAL_INNER_WIDTH,
  })
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    value: ORIGINAL_INNER_HEIGHT,
  })

  if (ORIGINAL_INTERSECTION_OBSERVER) {
    Object.defineProperty(globalThis, "IntersectionObserver", {
      configurable: true,
      value: ORIGINAL_INTERSECTION_OBSERVER,
    })
    return
  }

  Reflect.deleteProperty(globalThis, "IntersectionObserver")
}

export function mockSelectionText(
  text: string,
  anchor: Node,
  rect?: Partial<DOMRect>,
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
    commonAncestorContainer: anchor,
    getBoundingClientRect: () => rangeRect,
  }

  return vi.spyOn(window, "getSelection").mockReturnValue({
    rangeCount: text ? 1 : 0,
    isCollapsed: text.length === 0,
    toString: () => text,
    getRangeAt: () => range,
  } as unknown as Selection)
}
