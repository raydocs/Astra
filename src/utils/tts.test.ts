import { beforeEach, describe, expect, it, vi } from "vitest"

import { EDGE_TTS_VOICES, getAvailableVoices, isSpeaking, isTtsSupported, listVoices, speak, speakWithHighlight, splitSentences, stopSpeaking } from "./tts"

type VoiceMock = {
  name: string
  lang: string
  default: boolean
  localService: boolean
}

const mockSpeak = vi.fn()
const mockCancel = vi.fn()
const voiceListeners = new Set<() => void>()
let voices: VoiceMock[] = []

function installSpeechSynthesis() {
  Object.defineProperty(globalThis, "speechSynthesis", {
    value: {
      speak: mockSpeak,
      cancel: mockCancel,
      speaking: false,
      pending: false,
      getVoices: () => voices,
      addEventListener: (_event: string, listener: () => void) => {
        voiceListeners.add(listener)
      },
      removeEventListener: (_event: string, listener: () => void) => {
        voiceListeners.delete(listener)
      },
    },
    writable: true,
    configurable: true,
  })

  Object.defineProperty(globalThis, "SpeechSynthesisUtterance", {
    value: class {
      text: string
      lang = ""
      rate = 1
      voice: VoiceMock | null = null
      onend?: () => void
      onerror?: () => void
      constructor(text: string) {
        this.text = text
      }
    },
    writable: true,
    configurable: true,
  })
}

describe("tts", () => {
  beforeEach(() => {
    mockSpeak.mockClear()
    mockCancel.mockClear()
    voiceListeners.clear()
    voices = []
    installSpeechSynthesis()
  })

  it("reports support when browser TTS APIs exist", () => {
    expect(isTtsSupported()).toBe(true)
  })

  it("creates an utterance and calls speechSynthesis.speak", () => {
    speak(" Hello world ")

    expect(mockCancel).toHaveBeenCalled()
    expect(mockSpeak).toHaveBeenCalledTimes(1)

    const utterance = mockSpeak.mock.calls[0][0]
    expect(utterance.text).toBe("Hello world")
    expect(utterance.rate).toBe(0.9)
  })

  it("sets lang and selected voice when provided", () => {
    voices = [
      { name: "Microsoft Aria Online", lang: "en-US", default: true, localService: false },
      { name: "Microsoft Xiaoxiao Online", lang: "zh-CN", default: false, localService: false },
    ]

    speak("Bonjour", { lang: "fr-FR", voiceName: "Microsoft Aria Online", rate: 1.1 })

    const utterance = mockSpeak.mock.calls[0][0]
    expect(utterance.lang).toBe("fr-FR")
    expect(utterance.rate).toBe(1.1)
    expect(utterance.voice).toEqual(voices[0])
  })

  it("falls back to a matching language voice when voice name is unavailable", () => {
    voices = [
      { name: "English Default", lang: "en-US", default: true, localService: true },
      { name: "Français", lang: "fr-FR", default: false, localService: true },
    ]

    speak("Salut", { lang: "fr-CA", voiceName: "Missing voice" })

    const utterance = mockSpeak.mock.calls[0][0]
    expect(utterance.voice).toEqual(voices[1])
    expect(utterance.lang).toBe("fr-CA")
  })

  it("clamps rate into the supported range", () => {
    speak("Too fast", { rate: 9 })
    expect(mockSpeak.mock.calls[0][0].rate).toBe(2)

    mockSpeak.mockClear()
    speak("Too slow", { rate: 0.1 })
    expect(mockSpeak.mock.calls[0][0].rate).toBe(0.5)
  })

  it("returns available voices as serializable options with engine field", () => {
    voices = [
      { name: "English Default", lang: "en-US", default: true, localService: true },
    ]

    expect(getAvailableVoices()).toEqual([
      { name: "English Default", lang: "en-US", default: true, localService: true, engine: "browser" },
    ])
  })

  it("returns edge TTS voices when engine is edge", () => {
    const edgeVoices = getAvailableVoices("edge")
    expect(edgeVoices.length).toBeGreaterThan(0)
    expect(edgeVoices.every((v) => v.engine === "edge")).toBe(true)
    expect(edgeVoices).toEqual(EDGE_TTS_VOICES)
  })

  it("reports edge TTS as always supported", () => {
    expect(isTtsSupported("edge")).toBe(true)
  })

  it("waits for voiceschanged when voices are not immediately available", async () => {
    const pending = listVoices()

    voices = [
      { name: "Loaded Later", lang: "en-US", default: true, localService: true },
    ]
    voiceListeners.forEach((listener) => listener())

    await expect(pending).resolves.toEqual([
      { name: "Loaded Later", lang: "en-US", default: true, localService: true, engine: "browser" },
    ])
  })

  it("falls back to speechSynthesis.onvoiceschanged when addEventListener is unavailable", async () => {
    Object.defineProperty(globalThis, "speechSynthesis", {
      value: {
        speak: mockSpeak,
        cancel: mockCancel,
        speaking: false,
        pending: false,
        getVoices: () => voices,
        onvoiceschanged: undefined,
      },
      writable: true,
      configurable: true,
    })

    const pending = listVoices()

    voices = [
      { name: "Loaded Via Property", lang: "en-US", default: true, localService: true },
    ]
    globalThis.speechSynthesis.onvoiceschanged?.(new Event("voiceschanged") as never)

    await expect(pending).resolves.toEqual([
      { name: "Loaded Via Property", lang: "en-US", default: true, localService: true, engine: "browser" },
    ])
  })

  it("detects voices via polling when no voiceschanged event fires", async () => {
    vi.useFakeTimers()

    const pending = listVoices(undefined, 600)

    await vi.advanceTimersByTimeAsync(150)
    voices = [
      { name: "Loaded By Polling", lang: "en-US", default: true, localService: true },
    ]
    await vi.advanceTimersByTimeAsync(150)

    await expect(pending).resolves.toEqual([
      { name: "Loaded By Polling", lang: "en-US", default: true, localService: true, engine: "browser" },
    ])
    vi.useRealTimers()
  })

  it("resolves to an empty list when voices never load before timeout", async () => {
    vi.useFakeTimers()

    const pending = listVoices(undefined, 300)

    await vi.advanceTimersByTimeAsync(300)

    await expect(pending).resolves.toEqual([])
    vi.useRealTimers()
  })

  it("calls speechSynthesis.cancel when stopping playback", () => {
    stopSpeaking()
    expect(mockCancel).toHaveBeenCalledTimes(1)
  })

  it("returns true when speaking or pending", () => {
    Object.defineProperty(globalThis, "speechSynthesis", {
      value: {
        ...globalThis.speechSynthesis,
        speaking: false,
        pending: true,
      },
      writable: true,
      configurable: true,
    })

    expect(isSpeaking()).toBe(true)
  })

  describe("splitSentences", () => {
    it("splits on sentence-ending punctuation", () => {
      expect(splitSentences("Hello. World! OK?")).toEqual(["Hello.", "World!", "OK?"])
    })

    it("splits on Chinese punctuation", () => {
      expect(splitSentences("你好。世界！再见？")).toEqual(["你好。", "世界！", "再见？"])
    })

    it("returns full text when no sentence boundaries", () => {
      expect(splitSentences("just a phrase")).toEqual(["just a phrase"])
    })

    it("filters empty segments", () => {
      expect(splitSentences("")).toEqual([])
    })
  })

  describe("speakWithHighlight", () => {
    it("calls onSentence for each segment and onEnd when done", () => {
      const sentenceCalls: Array<[number, string]> = []
      const onEnd = vi.fn()

      speakWithHighlight("Hello. World.", {
        onSentence: (idx, text) => sentenceCalls.push([idx, text]),
        onEnd,
      })

      // First sentence triggers speak
      expect(mockSpeak).toHaveBeenCalledTimes(1)
      expect(sentenceCalls).toEqual([[0, "Hello."]])

      // Simulate first utterance ending
      const utterance1 = mockSpeak.mock.calls[0][0]
      utterance1.onend?.()

      expect(mockSpeak).toHaveBeenCalledTimes(2)
      expect(sentenceCalls).toEqual([[0, "Hello."], [1, "World."]])

      // Simulate second utterance ending
      const utterance2 = mockSpeak.mock.calls[1][0]
      utterance2.onend?.()

      expect(onEnd).toHaveBeenCalledTimes(1)
    })

    it("stop function cancels playback", () => {
      const onEnd = vi.fn()
      const stop = speakWithHighlight("Hello. World.", { onEnd })

      expect(mockSpeak).toHaveBeenCalledTimes(1)
      stop()

      // Simulate utterance ending — should not advance
      const utterance = mockSpeak.mock.calls[0][0]
      utterance.onend?.()

      expect(mockSpeak).toHaveBeenCalledTimes(1)
      expect(onEnd).not.toHaveBeenCalled()
    })
  })
})
