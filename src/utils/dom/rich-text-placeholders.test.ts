import { describe, expect, it } from "vitest"

import {
  containsRichTextPlaceholders,
  countRichTextPlaceholders,
  decodeRichTextTranslation,
  serializeRichTextForTranslation,
  stripRichTextPlaceholders,
} from "./rich-text-placeholders"

describe("rich-text placeholders", () => {
  it("serializes preserved inline tags into request placeholders", () => {
    document.body.innerHTML = `
      <p id="target">
        This includes <strong>bold text</strong> and <em>emphasis</em>.
      </p>
    `

    const target = document.getElementById("target") as HTMLElement
    const result = serializeRichTextForTranslation(target)

    expect(result.plainText).toContain("This includes bold text and emphasis.")
    expect(result.requestText).toContain("__ASTRA_RT_0_OPEN_STRONG__")
    expect(result.requestText).toContain("__ASTRA_RT_1_OPEN_EM__")
    expect(result.hasPlaceholders).toBe(true)
  })

  it("flattens unsupported inline tags to plain text", () => {
    document.body.innerHTML = `<p id="target">Visit <a href="/docs">the docs</a> now.</p>`

    const target = document.getElementById("target") as HTMLElement
    const result = serializeRichTextForTranslation(target)

    expect(result.requestText).toBe("Visit the docs now.")
    expect(result.hasPlaceholders).toBe(false)
  })

  it("decodes balanced placeholders into a safe fragment", () => {
    const requestText = "Read __ASTRA_RT_0_OPEN_STRONG__carefully__ASTRA_RT_0_CLOSE__ now."
    const translated = "请__ASTRA_RT_0_OPEN_STRONG__仔细__ASTRA_RT_0_CLOSE__阅读。"

    const result = decodeRichTextTranslation(translated, requestText)
    const container = document.createElement("div")
    if (result.fragment) {
      container.appendChild(result.fragment)
    }

    expect(result.usedFallback).toBe(false)
    expect(result.restoredTagCount).toBe(1)
    expect(container.querySelector("strong")?.textContent).toBe("仔细")
    expect(container.textContent).toBe("请仔细阅读。")
  })

  it("falls back to plain text when placeholders are malformed", () => {
    const requestText = "Read __ASTRA_RT_0_OPEN_STRONG__carefully__ASTRA_RT_0_CLOSE__ now."
    const translated = "请__ASTRA_RT_0_OPEN_STRONG__仔细阅读。"

    const result = decodeRichTextTranslation(translated, requestText)

    expect(result.usedFallback).toBe(true)
    expect(result.fragment).toBeNull()
    expect(result.fallbackText).toBe("请仔细阅读。")
  })

  it("falls back when translated output drops expected placeholders entirely", () => {
    const requestText = "Read __ASTRA_RT_0_OPEN_STRONG__carefully__ASTRA_RT_0_CLOSE__ now."
    const translated = "请仔细阅读。"

    const result = decodeRichTextTranslation(translated, requestText)

    expect(result.usedFallback).toBe(true)
    expect(result.fragment).toBeNull()
    expect(result.fallbackText).toBe("请仔细阅读。")
  })

  it("falls back when translated output drops part of expected placeholders", () => {
    const requestText = [
      "__ASTRA_RT_0_OPEN_STRONG__alpha__ASTRA_RT_0_CLOSE__",
      "__ASTRA_RT_1_OPEN_EM__beta__ASTRA_RT_1_CLOSE__",
    ].join(" and ")
    const translated = "这里有__ASTRA_RT_0_OPEN_STRONG__甲__ASTRA_RT_0_CLOSE__和乙。"

    const result = decodeRichTextTranslation(translated, requestText)

    expect(result.usedFallback).toBe(true)
    expect(result.fragment).toBeNull()
    expect(result.fallbackText).toBe("这里有甲 和乙。")
  })

  it("counts and strips placeholder tokens", () => {
    const text = "__ASTRA_RT_0_OPEN_STRONG__hello__ASTRA_RT_0_CLOSE__ world"

    expect(containsRichTextPlaceholders(text)).toBe(true)
    expect(countRichTextPlaceholders(text)).toBe(2)
    expect(stripRichTextPlaceholders(text)).toBe("hello world")
  })
})
