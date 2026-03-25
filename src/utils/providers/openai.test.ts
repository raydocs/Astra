import { describe, expect, it } from "vitest"

import { AstraError } from "@/types/translation"
import { buildTranslationPrompt, parseTranslationsResponse } from "./openai"

describe("openai provider helpers", () => {
  it("includes advisory context in the translation prompt", () => {
    const prompt = buildTranslationPrompt({
      texts: ["Hello world"],
      targetLang: "zh-CN",
      context: {
        pageTitle: "Astra",
        contentSummary: "A browser extension for contextual translation.",
      },
    })

    expect(prompt).toContain("Context JSON")
    expect(prompt).toContain("Astra")
    expect(prompt).toContain("Hello world")
    expect(prompt).toContain("Do not translate the context itself")
  })

  it("builds an explain prompt that preserves the strict JSON contract", () => {
    const prompt = buildTranslationPrompt({
      texts: ["Hello world"],
      targetLang: "zh-CN",
      task: "explain",
      context: {
        pageTitle: "Astra",
        selectionContext: "Hello world",
      },
    })

    expect(prompt).toContain("Explain each input text")
    expect(prompt).toContain("clarify meaning")
    expect(prompt).toContain('"translations"')
    expect(prompt).toContain("Context JSON")
  })

  it("parses valid JSON responses", () => {
    expect(
      parseTranslationsResponse("{\"translations\":[\"你好\",\"世界\"]}", 2),
    ).toEqual(["你好", "世界"])
  })

  it("parses fenced JSON responses", () => {
    expect(
      parseTranslationsResponse("```json\n{\"translations\":[\"Bonjour\"]}\n```", 1),
    ).toEqual(["Bonjour"])
  })

  it("rejects wrong-length arrays", () => {
    expect(() => {
      parseTranslationsResponse("{\"translations\":[\"こんにちは\"]}", 2)
    }).toThrow(AstraError)
  })

  it("rejects malformed JSON", () => {
    expect(() => {
      parseTranslationsResponse("not json", 1)
    }).toThrow(AstraError)
  })
})
