import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"

import { copyTextToClipboard } from "./clipboard"

describe("copyTextToClipboard", () => {
  const originalClipboard = navigator.clipboard

  beforeEach(() => {
    document.body.innerHTML = ""
  })

  afterEach(() => {
    vi.restoreAllMocks()
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: originalClipboard,
    })
  })

  it("uses navigator.clipboard when available", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    })

    await copyTextToClipboard("hello")

    expect(writeText).toHaveBeenCalledWith("hello")
  })

  it("falls back to execCommand when clipboard API is unavailable", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    })

    const execCommand = vi.fn(() => true)
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: execCommand,
    })

    await copyTextToClipboard("fallback")

    expect(execCommand).toHaveBeenCalledWith("copy")
    expect(document.querySelector("textarea")).toBeNull()
  })

  it("falls back to execCommand when clipboard.writeText rejects", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"))
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    })

    const execCommand = vi.fn(() => true)
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: execCommand,
    })

    await copyTextToClipboard("retry")

    expect(writeText).toHaveBeenCalledWith("retry")
    expect(execCommand).toHaveBeenCalledWith("copy")
    expect(document.querySelector("textarea")).toBeNull()
  })
})
