import { beforeEach, describe, expect, it, vi } from "vitest"

const speech = vi.hoisted(() => ({
  speak: vi.fn(),
  stop: vi.fn(),
}))

vi.mock("expo-speech", () => speech)

import { normalizeMobileSpeechText, speakMobileText } from "./mobileSpeech"

describe("mobile speech helper", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    speech.stop.mockResolvedValue(undefined)
  })

  it("normalizes whitespace and truncates card speech text", () => {
    const longText = `  hello\n\tworld  ${"x".repeat(300)}`

    const normalized = normalizeMobileSpeechText(longText)

    expect(normalized.startsWith("hello world ")).toBe(true)
    expect(normalized).toHaveLength(280)
  })

  it("speaks only after receiving non-empty user-provided text", async () => {
    const result = await speakMobileText("  resilient  ")

    expect(result).toEqual({ status: "speaking", message: "Playing card audio." })
    expect(speech.stop).toHaveBeenCalledTimes(1)
    expect(speech.speak).toHaveBeenCalledWith("resilient")
  })

  it("does not call platform speech for empty text", async () => {
    const result = await speakMobileText("   ")

    expect(result).toEqual({ status: "empty", message: "Nothing to speak on this card." })
    expect(speech.stop).not.toHaveBeenCalled()
    expect(speech.speak).not.toHaveBeenCalled()
  })
})
