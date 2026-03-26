import { describe, it, expect, vi, beforeEach } from "vitest"
import { speak, stopSpeaking, isSpeaking } from "./tts"

const mockSpeak = vi.fn()
const mockCancel = vi.fn()

beforeEach(() => {
  mockSpeak.mockClear()
  mockCancel.mockClear()

  Object.defineProperty(globalThis, "speechSynthesis", {
    value: {
      speak: mockSpeak,
      cancel: mockCancel,
      speaking: false,
    },
    writable: true,
    configurable: true,
  })

  Object.defineProperty(globalThis, "SpeechSynthesisUtterance", {
    value: class {
      text: string
      lang = ""
      rate = 1
      constructor(text: string) {
        this.text = text
      }
    },
    writable: true,
    configurable: true,
  })
})

describe("speak", () => {
  it("creates an utterance and calls speechSynthesis.speak", () => {
    speak("Hello world")

    expect(mockCancel).toHaveBeenCalled()
    expect(mockSpeak).toHaveBeenCalledTimes(1)

    const utterance = mockSpeak.mock.calls[0][0]
    expect(utterance.text).toBe("Hello world")
    expect(utterance.rate).toBe(0.9)
  })

  it("sets lang when provided", () => {
    speak("Bonjour", "fr")

    const utterance = mockSpeak.mock.calls[0][0]
    expect(utterance.lang).toBe("fr")
  })

  it("does not set lang when not provided", () => {
    speak("Hello")

    const utterance = mockSpeak.mock.calls[0][0]
    expect(utterance.lang).toBe("")
  })
})

describe("stopSpeaking", () => {
  it("calls speechSynthesis.cancel", () => {
    stopSpeaking()
    expect(mockCancel).toHaveBeenCalledTimes(1)
  })
})

describe("isSpeaking", () => {
  it("returns false when not speaking", () => {
    expect(isSpeaking()).toBe(false)
  })

  it("returns true when speaking", () => {
    Object.defineProperty(globalThis.speechSynthesis, "speaking", {
      value: true,
      configurable: true,
    })
    expect(isSpeaking()).toBe(true)
  })
})
