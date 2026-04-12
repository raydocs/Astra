import { describe, expect, it, vi, afterEach } from "vitest"

import {
  generateBilingualCard,
  generateBilingualPlainText,
  copyBilingualCard,
} from "./share-card"

describe("generateBilingualCard", () => {
  it("returns an HTML string containing original and translation", () => {
    const html = generateBilingualCard("Hello", "你好", "https://example.com")

    expect(html).toContain("Hello")
    expect(html).toContain("你好")
    expect(html).toContain("https://example.com")
    expect(html).toContain("Translated by Astra")
  })

  it("escapes HTML entities in the inputs", () => {
    const html = generateBilingualCard(
      "<script>alert(1)</script>",
      'a & "b"',
      "https://example.com?a=1&b=2",
    )

    expect(html).not.toContain("<script>")
    expect(html).toContain("&lt;script&gt;")
    expect(html).toContain("a &amp; &quot;b&quot;")
    expect(html).toContain("https://example.com?a=1&amp;b=2")
  })
})

describe("generateBilingualPlainText", () => {
  it("formats plain text with em-dash attribution", () => {
    const text = generateBilingualPlainText("Hello", "你好")

    expect(text).toBe("Hello\n---\n你好\n\n\u2014 Astra")
  })
})

describe("copyBilingualCard", () => {
  const originalClipboard = navigator.clipboard

  afterEach(() => {
    vi.restoreAllMocks()
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: originalClipboard,
    })
    // Restore ClipboardItem if overridden
    if ("__origClipboardItem" in globalThis) {
      Object.defineProperty(globalThis, "ClipboardItem", {
        configurable: true,
        value: (globalThis as Record<string, unknown>).__origClipboardItem,
      })
      delete (globalThis as Record<string, unknown>).__origClipboardItem
    }
  })

  it("uses ClipboardItem with text/html when available", async () => {
    const writeFn = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { write: writeFn, writeText: vi.fn() },
    })

    // Provide a minimal ClipboardItem polyfill
    ;(globalThis as Record<string, unknown>).__origClipboardItem =
      (globalThis as Record<string, unknown>).ClipboardItem
    Object.defineProperty(globalThis, "ClipboardItem", {
      configurable: true,
      value: class {
        constructor(public items: Record<string, Blob>) {}
      },
    })

    await copyBilingualCard("Hello", "你好", "https://example.com")

    expect(writeFn).toHaveBeenCalledTimes(1)
    const item = writeFn.mock.calls[0][0][0]
    expect(item.items["text/html"]).toBeInstanceOf(Blob)
    expect(item.items["text/plain"]).toBeInstanceOf(Blob)
  })

  it("falls back to writeText when ClipboardItem is unavailable", async () => {
    const writeTextFn = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: writeTextFn },
    })

    // Ensure ClipboardItem is absent
    ;(globalThis as Record<string, unknown>).__origClipboardItem =
      (globalThis as Record<string, unknown>).ClipboardItem
    Object.defineProperty(globalThis, "ClipboardItem", {
      configurable: true,
      value: undefined,
    })

    await copyBilingualCard("Hello", "你好", "https://example.com")

    expect(writeTextFn).toHaveBeenCalledTimes(1)
    expect(writeTextFn.mock.calls[0][0]).toContain("Hello")
    expect(writeTextFn.mock.calls[0][0]).toContain("你好")
    expect(writeTextFn.mock.calls[0][0]).toContain("\u2014 Astra")
  })
})
