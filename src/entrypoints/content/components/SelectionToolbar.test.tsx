import { act } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const {
  readConfigMock,
  translateTextsMock,
} = vi.hoisted(() => ({
  readConfigMock: vi.fn(),
  translateTextsMock: vi.fn(),
}))

vi.mock("@/utils/storage/config", () => ({
  readConfig: readConfigMock,
}))

vi.mock("@/utils/translate/translate", () => ({
  translateTexts: translateTextsMock,
}))

import { DEFAULT_ASTRA_CONFIG } from "@/types/config"
import {
  getInteractionSuppressionState,
} from "../interaction-coordination"
import { mountSelectionToolbar } from "./SelectionToolbar"

const HOST_ID = "astra-selection-toolbar-host"

describe("SelectionToolbar interaction suppression", () => {
  const documentListeners: Partial<Record<string, EventListenerOrEventListenerObject>> = {}
  const windowListeners: Partial<Record<string, EventListenerOrEventListenerObject>> = {}

  beforeEach(async () => {
    vi.useFakeTimers()
    document.getElementById(HOST_ID)?.remove()
    document.body.innerHTML = `<main><p id="target">Hello world</p></main>`

    vi.spyOn(document, "addEventListener").mockImplementation(((type: string | symbol, listener: EventListenerOrEventListenerObject) => {
      documentListeners[String(type)] = listener
    }) as typeof document.addEventListener)
    vi.spyOn(document, "removeEventListener").mockImplementation((() => {}) as typeof document.removeEventListener)
    vi.spyOn(window, "addEventListener").mockImplementation(((type: string | symbol, listener: EventListenerOrEventListenerObject) => {
      windowListeners[String(type)] = listener
    }) as typeof window.addEventListener)
    vi.spyOn(window, "removeEventListener").mockImplementation((() => {}) as typeof window.removeEventListener)

    readConfigMock.mockResolvedValue(DEFAULT_ASTRA_CONFIG)
    translateTextsMock.mockResolvedValue({ ok: true, translations: ["你好"] })

    await act(async () => {
      mountSelectionToolbar()
      await Promise.resolve()
    })
  })

  afterEach(() => {
    document.getElementById(HOST_ID)?.remove()
    Object.keys(documentListeners).forEach((key) => delete documentListeners[key])
    Object.keys(windowListeners).forEach((key) => delete windowListeners[key])
    vi.useRealTimers()
  })

  function setSelection(text: string, collapsed = false) {
    const target = document.getElementById("target") as HTMLElement
    const range = {
      commonAncestorContainer: target.firstChild ?? target,
      getBoundingClientRect: () => ({
        top: 10,
        left: 10,
        right: 120,
        bottom: 30,
        width: 110,
        height: 20,
        x: 10,
        y: 10,
        toJSON: () => ({}),
      } as DOMRect),
    }

    vi.spyOn(window, "getSelection").mockReturnValue({
      rangeCount: text ? 1 : 0,
      isCollapsed: collapsed,
      toString: () => text,
      getRangeAt: () => range,
    } as unknown as Selection)
  }

  it("suppresses hover immediately on pointer down and keeps suppression for a valid selection", async () => {
    const target = document.getElementById("target") as HTMLElement
    const onMouseDown = documentListeners.mousedown as ((event: MouseEvent) => void) | undefined
    const onMouseUp = documentListeners.mouseup as ((event: MouseEvent) => void) | undefined

    expect(onMouseDown).toBeTypeOf("function")
    expect(onMouseUp).toBeTypeOf("function")

    const downEvent = new MouseEvent("mousedown", { button: 0 })
    Object.defineProperty(downEvent, "target", { value: target })
    onMouseDown?.(downEvent)

    expect(getInteractionSuppressionState().hoverSuppressed).toBe(true)

    setSelection("Hello world")
    const upEvent = new MouseEvent("mouseup")
    Object.defineProperty(upEvent, "target", { value: target })

    await act(async () => {
      onMouseUp?.(upEvent)
      await vi.advanceTimersByTimeAsync(20)
      await Promise.resolve()
    })

    expect(getInteractionSuppressionState().hoverSuppressed).toBe(true)
  })

  it("keeps pointer suppression when a new selection starts while the toolbar is already visible", async () => {
    const target = document.getElementById("target") as HTMLElement
    const onMouseDown = documentListeners.mousedown as ((event: MouseEvent) => void) | undefined
    const onMouseUp = documentListeners.mouseup as ((event: MouseEvent) => void) | undefined

    const downEvent = new MouseEvent("mousedown", { button: 0 })
    Object.defineProperty(downEvent, "target", { value: target })
    onMouseDown?.(downEvent)

    setSelection("Hello world")
    const upEvent = new MouseEvent("mouseup")
    Object.defineProperty(upEvent, "target", { value: target })

    await act(async () => {
      onMouseUp?.(upEvent)
      await vi.advanceTimersByTimeAsync(20)
      await Promise.resolve()
    })

    expect(getInteractionSuppressionState().hoverSuppressed).toBe(true)

    const restartEvent = new MouseEvent("mousedown", { button: 0 })
    Object.defineProperty(restartEvent, "target", { value: target })
    onMouseDown?.(restartEvent)

    expect(getInteractionSuppressionState().hoverSuppressed).toBe(true)
  })

  it("releases pointer suppression on blur even if a new selection starts while the toolbar is visible", async () => {
    const target = document.getElementById("target") as HTMLElement
    const onMouseDown = documentListeners.mousedown as ((event: MouseEvent) => void) | undefined
    const onMouseUp = documentListeners.mouseup as ((event: MouseEvent) => void) | undefined
    const onBlur = windowListeners.blur as (() => void) | undefined

    const downEvent = new MouseEvent("mousedown", { button: 0 })
    Object.defineProperty(downEvent, "target", { value: target })
    onMouseDown?.(downEvent)

    setSelection("Hello world")
    const upEvent = new MouseEvent("mouseup")
    Object.defineProperty(upEvent, "target", { value: target })

    await act(async () => {
      onMouseUp?.(upEvent)
      await vi.advanceTimersByTimeAsync(20)
      await Promise.resolve()
    })

    const restartEvent = new MouseEvent("mousedown", { button: 0 })
    Object.defineProperty(restartEvent, "target", { value: target })
    onMouseDown?.(restartEvent)

    expect(getInteractionSuppressionState().hoverSuppressed).toBe(true)
    expect(onBlur).toBeTypeOf("function")

    await act(async () => {
      onBlur?.()
      await Promise.resolve()
    })

    expect(getInteractionSuppressionState().hoverSuppressed).toBe(false)
  })

  it("releases suppression when the toolbar dismisses on scroll", async () => {
    const target = document.getElementById("target") as HTMLElement
    const onMouseDown = documentListeners.mousedown as ((event: MouseEvent) => void) | undefined
    const onMouseUp = documentListeners.mouseup as ((event: MouseEvent) => void) | undefined

    const downEvent = new MouseEvent("mousedown", { button: 0 })
    Object.defineProperty(downEvent, "target", { value: target })
    onMouseDown?.(downEvent)

    setSelection("Hello world")
    const upEvent = new MouseEvent("mouseup")
    Object.defineProperty(upEvent, "target", { value: target })

    await act(async () => {
      onMouseUp?.(upEvent)
      await vi.advanceTimersByTimeAsync(20)
      await Promise.resolve()
    })

    expect(getInteractionSuppressionState().hoverSuppressed).toBe(true)

    const onScroll = windowListeners.scroll as (() => void) | undefined
    expect(onScroll).toBeTypeOf("function")

    await act(async () => {
      onScroll?.()
      await Promise.resolve()
    })

    expect(getInteractionSuppressionState().hoverSuppressed).toBe(false)
  })

  it("clears transient pointer suppression when selection is empty", async () => {
    const target = document.getElementById("target") as HTMLElement
    const onMouseDown = documentListeners.mousedown as ((event: MouseEvent) => void) | undefined
    const onMouseUp = documentListeners.mouseup as ((event: MouseEvent) => void) | undefined

    const downEvent = new MouseEvent("mousedown", { button: 0 })
    Object.defineProperty(downEvent, "target", { value: target })
    onMouseDown?.(downEvent)

    expect(getInteractionSuppressionState().hoverSuppressed).toBe(true)

    setSelection("", true)
    const upEvent = new MouseEvent("mouseup")
    Object.defineProperty(upEvent, "target", { value: target })

    await act(async () => {
      onMouseUp?.(upEvent)
      await vi.advanceTimersByTimeAsync(20)
      await Promise.resolve()
    })

    expect(getInteractionSuppressionState().hoverSuppressed).toBe(false)
  })

  it("releases pointer suppression on window blur when no toolbar is active", async () => {
    const target = document.getElementById("target") as HTMLElement
    const onMouseDown = documentListeners.mousedown as ((event: MouseEvent) => void) | undefined
    const onBlur = windowListeners.blur as (() => void) | undefined

    const downEvent = new MouseEvent("mousedown", { button: 0 })
    Object.defineProperty(downEvent, "target", { value: target })
    onMouseDown?.(downEvent)

    expect(getInteractionSuppressionState().hoverSuppressed).toBe(true)
    expect(onBlur).toBeTypeOf("function")

    await act(async () => {
      onBlur?.()
      await Promise.resolve()
    })

    expect(getInteractionSuppressionState().hoverSuppressed).toBe(false)
  })

  it("calls explain task when explain button is clicked", async () => {
    const target = document.getElementById("target") as HTMLElement
    const onMouseDown = documentListeners.mousedown as ((event: MouseEvent) => void) | undefined
    const onMouseUp = documentListeners.mouseup as ((event: MouseEvent) => void) | undefined

    // Show toolbar via selection
    const downEvent = new MouseEvent("mousedown", { button: 0 })
    Object.defineProperty(downEvent, "target", { value: target })
    onMouseDown?.(downEvent)

    setSelection("Hello world")
    const upEvent = new MouseEvent("mouseup")
    Object.defineProperty(upEvent, "target", { value: target })

    await act(async () => {
      onMouseUp?.(upEvent)
      await vi.advanceTimersByTimeAsync(20)
      await Promise.resolve()
    })

    // The toolbar should be rendered in the shadow root
    const host = document.getElementById(HOST_ID)!
    const shadow = host.shadowRoot!
    const buttons = shadow.querySelectorAll("button")
    const explainBtn = Array.from(buttons).find((btn) => btn.textContent === "解释")

    expect(explainBtn).toBeDefined()

    translateTextsMock.mockResolvedValueOnce({
      ok: true,
      translations: ["This is a greeting in English."],
    })

    await act(async () => {
      explainBtn!.click()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(translateTextsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        task: "explain",
        texts: ["Hello world"],
      }),
    )
  })

  it("calls translate task via runInlineAction when translate button is clicked", async () => {
    const target = document.getElementById("target") as HTMLElement
    const onMouseDown = documentListeners.mousedown as ((event: MouseEvent) => void) | undefined
    const onMouseUp = documentListeners.mouseup as ((event: MouseEvent) => void) | undefined

    const downEvent = new MouseEvent("mousedown", { button: 0 })
    Object.defineProperty(downEvent, "target", { value: target })
    onMouseDown?.(downEvent)

    setSelection("Hello world")
    const upEvent = new MouseEvent("mouseup")
    Object.defineProperty(upEvent, "target", { value: target })

    await act(async () => {
      onMouseUp?.(upEvent)
      await vi.advanceTimersByTimeAsync(20)
      await Promise.resolve()
    })

    const host = document.getElementById(HOST_ID)!
    const shadow = host.shadowRoot!
    const buttons = shadow.querySelectorAll("button")
    const translateBtn = Array.from(buttons).find((btn) => btn.textContent === "翻译")

    expect(translateBtn).toBeDefined()

    translateTextsMock.mockResolvedValueOnce({
      ok: true,
      translations: ["你好世界"],
    })

    await act(async () => {
      translateBtn!.click()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(translateTextsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        texts: ["Hello world"],
      }),
    )
  })
})
