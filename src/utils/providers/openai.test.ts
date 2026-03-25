import { describe, expect, it } from "vitest"

import { AstraError } from "@/types/translation"
import { parseTranslationsResponse } from "./openai"

describe("parseTranslationsResponse", () => {
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
