import { describe, expect, it } from "vitest"

import { diagnoseProvider, estimateCost, getModelInfo, getProviderCapability } from "./capabilities"

describe("getProviderCapability", () => {
  it("returns OpenAI capability with expected fields", () => {
    const cap = getProviderCapability("openai")
    expect(cap.id).toBe("openai")
    expect(cap.name).toBe("OpenAI")
    expect(cap.supportsDirectAccess).toBe(true)
    expect(cap.supportsRelay).toBe(true)
    expect(cap.models.length).toBeGreaterThan(0)
    expect(cap.maxBatchSize).toBeGreaterThan(0)
    expect(cap.maxInputCharsPerRequest).toBeGreaterThan(0)
  })

  it("returns Gemini capability with expected fields", () => {
    const cap = getProviderCapability("gemini")
    expect(cap.id).toBe("gemini")
    expect(cap.name).toBe("Gemini")
    expect(cap.supportsDirectAccess).toBe(true)
    expect(cap.supportsRelay).toBe(true)
    expect(cap.models.length).toBeGreaterThan(0)
  })
})

describe("getModelInfo", () => {
  it("returns model info for a valid model id", () => {
    const model = getModelInfo("openai", "gpt-5.4-nano")
    expect(model).not.toBeNull()
    expect(model!.id).toBe("gpt-5.4-nano")
    expect(model!.label).toBe("GPT-5.4 Nano")
    expect(model!.recommended).toBe(true)
    expect(model!.maxContextTokens).toBe(1000000)
  })

  it("returns null for a missing model id", () => {
    const model = getModelInfo("openai", "nonexistent-model")
    expect(model).toBeNull()
  })
})

describe("estimateCost", () => {
  it("calculates cost for a normal model", () => {
    // gpt-5.4-nano: input 0.0001/1k, output 0.0004/1k
    const cost = estimateCost("openai", "gpt-5.4-nano", 1000, 1000)
    expect(cost).toBeCloseTo(0.0001 + 0.0004, 10)
  })

  it("returns 0 for a free model (Gemini Flash Lite)", () => {
    const cost = estimateCost("gemini", "gemini-3.1-flash-lite-preview", 5000, 5000)
    expect(cost).toBe(0)
  })

  it("returns 0 for an unknown model", () => {
    const cost = estimateCost("openai", "nonexistent", 1000, 1000)
    expect(cost).toBe(0)
  })

  it("returns 0 when tokens are zero", () => {
    const cost = estimateCost("openai", "gpt-5.4-nano", 0, 0)
    expect(cost).toBe(0)
  })
})

describe("diagnoseProvider", () => {
  it("returns 'connected' when both apiKey and relay are present", () => {
    const diag = diagnoseProvider({
      providerId: "openai",
      model: "gpt-5.4-nano",
      apiKey: "sk-test",
      accessToken: "astra-token",
      relayBaseURL: "https://relay.example.com",
    })
    expect(diag.status).toBe("connected")
    expect(diag.directAccess).toBe(true)
    expect(diag.relayAccess).toBe(true)
    expect(diag.providerName).toBe("OpenAI")
    expect(diag.modelLabel).toBe("GPT-5.4 Nano")
  })

  it("returns 'partial' when only apiKey is present", () => {
    const diag = diagnoseProvider({
      providerId: "openai",
      model: "gpt-5.4-nano",
      apiKey: "sk-test",
      accessToken: "",
      relayBaseURL: "",
    })
    expect(diag.status).toBe("partial")
    expect(diag.directAccess).toBe(true)
    expect(diag.relayAccess).toBe(false)
  })

  it("returns 'disconnected' when neither apiKey nor relay are present", () => {
    const diag = diagnoseProvider({
      providerId: "openai",
      model: "gpt-5.4-nano",
      apiKey: "",
      accessToken: "",
      relayBaseURL: "",
    })
    expect(diag.status).toBe("disconnected")
    expect(diag.directAccess).toBe(false)
    expect(diag.relayAccess).toBe(false)
  })

  it("shows 'Free' for estimatedCostPerPage with Gemini free model", () => {
    const diag = diagnoseProvider({
      providerId: "gemini",
      model: "gemini-3.1-flash-lite-preview",
      apiKey: "key",
      accessToken: "",
    })
    expect(diag.estimatedCostPerPage).toBe("Free")
  })

  it("shows a dollar cost for estimatedCostPerPage with a paid model", () => {
    const diag = diagnoseProvider({
      providerId: "openai",
      model: "gpt-5.4-nano",
      apiKey: "key",
      accessToken: "",
    })
    expect(diag.estimatedCostPerPage).toMatch(/^~\$\d/)
  })
})
