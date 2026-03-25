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
import { mountInputTranslate } from "./InputTranslate"

const HOST_ID = "astra-input-translate-host"

function getHost(): HTMLDivElement | null {
  return document.getElementById(HOST_ID) as HTMLDivElement | null
}

function getButton(): HTMLButtonElement | null {
  const host = getHost()
  if (!host?.shadowRoot) return null
  return host.shadowRoot.querySelector("button")
}

describe("InputTranslate", () => {
  const documentListeners: Partial<Record<string, EventListenerOrEventListenerObject>> = {}

  beforeEach(async () => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    document.getElementById(HOST_ID)?.remove()
    document.body.innerHTML = `<main>
      <input id="text-input" type="text" value="Hello" />
      <input id="password-input" type="password" value="secret" />
      <textarea id="textarea">Some text</textarea>
    </main>`

    const textInput = document.getElementById("text-input") as HTMLInputElement
    textInput.getBoundingClientRect = () => ({
      top: 40,
      left: 16,
      right: 200,
      bottom: 60,
      width: 184,
      height: 20,
      x: 16,
      y: 40,
      toJSON: () => ({}),
    } as DOMRect)

    const textarea = document.getElementById("textarea") as HTMLTextAreaElement
    textarea.getBoundingClientRect = () => ({
      top: 80,
      left: 16,
      right: 200,
      bottom: 120,
      width: 184,
      height: 40,
      x: 16,
      y: 80,
      toJSON: () => ({}),
    } as DOMRect)

    const passwordInput = document.getElementById("password-input") as HTMLInputElement
    passwordInput.getBoundingClientRect = () => ({
      top: 140,
      left: 16,
      right: 200,
      bottom: 160,
      width: 184,
      height: 20,
      x: 16,
      y: 140,
      toJSON: () => ({}),
    } as DOMRect)

    vi.spyOn(document, "addEventListener").mockImplementation(((type: string | symbol, listener: EventListenerOrEventListenerObject) => {
      documentListeners[String(type)] = listener
    }) as typeof document.addEventListener)
    vi.spyOn(document, "removeEventListener").mockImplementation((() => {}) as typeof document.removeEventListener)

    readConfigMock.mockResolvedValue(DEFAULT_ASTRA_CONFIG)
    translateTextsMock.mockResolvedValue({ ok: true, translations: ["\u4F60\u597D"] })

    await act(async () => {
      mountInputTranslate()
      await Promise.resolve()
    })
  })

  afterEach(() => {
    document.getElementById(HOST_ID)?.remove()
    Object.keys(documentListeners).forEach((key) => delete documentListeners[key])
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it("shows translate button when a text input with content is focused", async () => {
    const textInput = document.getElementById("text-input") as HTMLInputElement
    const handleFocusIn = documentListeners.focusin as ((event: FocusEvent) => void) | undefined
    expect(handleFocusIn).toBeTypeOf("function")

    const event = new FocusEvent("focusin")
    Object.defineProperty(event, "target", { value: textInput })

    await act(async () => {
      handleFocusIn?.(event)
      await Promise.resolve()
    })

    const button = getButton()
    expect(button).not.toBeNull()
    expect(button?.textContent).toBe("\u8BD1")
  })

  it("hides translate button when input loses focus", async () => {
    const textInput = document.getElementById("text-input") as HTMLInputElement
    const handleFocusIn = documentListeners.focusin as ((event: FocusEvent) => void) | undefined
    const handleFocusOut = documentListeners.focusout as ((event: FocusEvent) => void) | undefined

    expect(handleFocusIn).toBeTypeOf("function")
    expect(handleFocusOut).toBeTypeOf("function")

    // First focus to show button
    const focusEvent = new FocusEvent("focusin")
    Object.defineProperty(focusEvent, "target", { value: textInput })

    await act(async () => {
      handleFocusIn?.(focusEvent)
      await Promise.resolve()
    })

    expect(getButton()).not.toBeNull()

    // Then blur to hide
    const blurEvent = new FocusEvent("focusout")
    Object.defineProperty(blurEvent, "target", { value: textInput })

    await act(async () => {
      handleFocusOut?.(blurEvent)
      await vi.advanceTimersByTimeAsync(200)
      await Promise.resolve()
    })

    expect(getButton()).toBeNull()
  })

  it("does not show for password inputs", async () => {
    const passwordInput = document.getElementById("password-input") as HTMLInputElement
    const handleFocusIn = documentListeners.focusin as ((event: FocusEvent) => void) | undefined
    expect(handleFocusIn).toBeTypeOf("function")

    const event = new FocusEvent("focusin")
    Object.defineProperty(event, "target", { value: passwordInput })

    await act(async () => {
      handleFocusIn?.(event)
      await Promise.resolve()
    })

    expect(getButton()).toBeNull()
  })
})
