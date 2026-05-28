import { describe, expect, it } from "vitest"

import { resolveManagedProviderModel, resolveManagedTranslationRequest } from "./providers"

describe("managed provider scheduling", () => {
  it("maps service style to managed OpenAI models", () => {
    expect(resolveManagedProviderModel({
      provider: "openai",
      requestedModel: "gpt-5.4-nano",
      serviceMode: "fast",
    })).toBe("gpt-4.1-nano")
    expect(resolveManagedProviderModel({
      provider: "openai",
      requestedModel: "gpt-5.4-nano",
      serviceMode: "balanced",
    })).toBe("gpt-4.1-mini")
    expect(resolveManagedProviderModel({
      provider: "openai",
      requestedModel: "gpt-5.4-nano",
      serviceMode: "best_quality",
    })).toBe("gpt-5.4-nano")
  })

  it("maps service style to managed Gemini models", () => {
    expect(resolveManagedProviderModel({
      provider: "gemini",
      requestedModel: "gemini-3.1-pro",
      serviceMode: "fast",
    })).toBe("gemini-3.1-flash-lite-preview")
    expect(resolveManagedProviderModel({
      provider: "gemini",
      requestedModel: "gemini-3.1-pro",
      serviceMode: "balanced",
    })).toBe("gemini-3.0-flash")
    expect(resolveManagedProviderModel({
      provider: "gemini",
      requestedModel: "gemini-3.1-pro",
      serviceMode: "best_quality",
    })).toBe("gemini-3.1-pro")
  })

  it("resolves automatic short requests before provider execution", () => {
    const request = resolveManagedTranslationRequest({
      provider: "openai",
      model: "gpt-5.4-nano",
      texts: ["Short headline"],
      targetLang: "zh-CN",
      task: "translate",
      serviceMode: "automatic",
    })

    expect(request.serviceMode).toBe("fast")
    expect(request.model).toBe("gpt-4.1-nano")
  })

  it("resolves automatic learning requests to quality models", () => {
    const request = resolveManagedTranslationRequest({
      provider: "openai",
      model: "gpt-5.4-nano",
      texts: ["Explain this sentence."],
      targetLang: "zh-CN",
      task: "explain",
      serviceMode: "automatic",
    })

    expect(request.serviceMode).toBe("best_quality")
    expect(request.model).toBe("gpt-5.4-nano")
  })
})
