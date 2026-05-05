import { describe, expect, it } from "vitest"

import { buildExplanationRepairInstruction, getMatchedExplanationGlossaryTerms, validateExplanationQuality } from "./explanation-quality"

describe("getMatchedExplanationGlossaryTerms", () => {
  it("returns enabled glossary terms that match the source text only", () => {
    expect(getMatchedExplanationGlossaryTerms({
      source: "Astra improves reading, not routing.",
      glossaryTerms: [
        { sourceTerm: "Astra", preferredTerm: "阿斯特拉", enabled: true },
        { sourceTerm: "router", preferredTerm: "路由器", enabled: true },
        { sourceTerm: "reading", preferredTerm: "阅读", enabled: false },
      ],
    })).toEqual([
      { sourceTerm: "Astra", preferredTerm: "阿斯特拉" },
    ])
  })

  it("does not match short Latin glossary terms inside unrelated words", () => {
    expect(getMatchedExplanationGlossaryTerms({
      source: "The speaker said the article was clear.",
      glossaryTerms: [
        { sourceTerm: "AI", preferredTerm: "人工智能", enabled: true },
        { sourceTerm: "art", preferredTerm: "艺术", enabled: true },
      ],
    })).toEqual([])
  })

  it("preserves substring matching for CJK glossary terms", () => {
    expect(getMatchedExplanationGlossaryTerms({
      source: "这篇文章介绍阿斯特拉阅读助手。",
      glossaryTerms: [{ sourceTerm: "阿斯特拉", preferredTerm: "Astra", enabled: true }],
    })).toEqual([{ sourceTerm: "阿斯特拉", preferredTerm: "Astra" }])
  })
})

describe("buildExplanationRepairInstruction", () => {
  it("maps source echo failures to a source-specific repair instruction", () => {
    const failure = validateExplanationQuality({
      source: "Hello, world!",
      explanation: "hello world",
    })
    expect(failure.ok).toBe(false)
    if (!failure.ok) {
      expect(buildExplanationRepairInstruction(failure)).toContain("do not echo the source text")
      expect(buildExplanationRepairInstruction(failure)).toContain("preserve the original target language, learner level, explain mode")
    }
  })

  it("maps glossary failures to a glossary-preserving repair instruction", () => {
    const failure = validateExplanationQuality({
      source: "Astra helps readers understand idioms.",
      explanation: "This says the app helps readers understand idioms in context.",
      requiredGlossaryTerms: [{ sourceTerm: "Astra", preferredTerm: "阿斯特拉", enabled: true }],
    })
    expect(failure.ok).toBe(false)
    if (!failure.ok) {
      const instruction = buildExplanationRepairInstruction(failure)
      expect(instruction).toContain("include every matched preferred term exactly")
      expect(instruction).toContain("阿斯特拉")
    }
  })
})

describe("validateExplanationQuality", () => {
  it("rejects empty explanation output", () => {
    expect(validateExplanationQuality({ source: "Hello world", explanation: "   " })).toMatchObject({
      ok: false,
      issue: "empty",
    })
  })

  it("rejects exact source echo", () => {
    expect(validateExplanationQuality({
      source: "Hello, world!",
      explanation: "hello world",
    })).toMatchObject({
      ok: false,
      issue: "source_echo",
    })
  })

  it("rejects source-dominant echo", () => {
    expect(validateExplanationQuality({
      source: "The quick brown fox jumps over the lazy dog near the river.",
      explanation: "The quick brown fox jumps over the lazy dog near the river. In short.",
    })).toMatchObject({
      ok: false,
      issue: "source_dominant_echo",
    })
  })

  it("rejects suspiciously short output for long source", () => {
    const source = "Although the committee initially rejected the proposal, the final report argues that the revised plan could improve public transit access for low-income neighborhoods."

    expect(validateExplanationQuality({
      source,
      explanation: "It means a plan changed.",
    })).toMatchObject({
      ok: false,
      issue: "too_short_for_source",
    })
  })

  it("rejects warning-like provider output", () => {
    expect(validateExplanationQuality({
      source: "Hello world",
      explanation: "Warning: OPENAI_API_KEY is not configured on the Astra relay",
    })).toMatchObject({
      ok: false,
      issue: "warning_like",
    })
  })

  it("rejects repeated sentence loops", () => {
    expect(validateExplanationQuality({
      source: "Although the speaker sounded calm, the audience could tell the announcement was important.",
      explanation: "It explains that the announcement is important. It explains that the announcement is important. It explains that the announcement is important.",
    })).toMatchObject({
      ok: false,
      issue: "repetitive_output",
    })
  })

  it("rejects repeated phrase loops", () => {
    expect(validateExplanationQuality({
      source: "The sentence says the reader should notice the contrast before choosing an answer.",
      explanation: "The key contrast the key contrast the key contrast shows why the answer changes.",
    })).toMatchObject({
      ok: false,
      issue: "repetitive_output",
    })
  })

  it("allows normal explanations that reuse topic words without looping", () => {
    expect(validateExplanationQuality({
      source: "The team adjusted the plan after the weather changed.",
      explanation: "This explains cause and result: the weather changed first, so the team adjusted the plan. The repeated topic words keep the explanation tied to the sentence, not a loop.",
    })).toEqual({ ok: true })
  })

  it("rejects explanations that omit a required preferred glossary term", () => {
    expect(validateExplanationQuality({
      source: "Astra helps readers understand idioms.",
      explanation: "This says the app helps readers understand idioms in context.",
      requiredGlossaryTerms: [{ sourceTerm: "Astra", preferredTerm: "阿斯特拉", enabled: true }],
    })).toMatchObject({
      ok: false,
      issue: "missing_glossary_term",
    })
  })

  it("allows explanations that include required preferred glossary terms", () => {
    expect(validateExplanationQuality({
      source: "Astra helps readers understand idioms.",
      explanation: "阿斯特拉 is the product name here; the sentence says it helps readers understand idioms in context.",
      requiredGlossaryTerms: [{ sourceTerm: "Astra", preferredTerm: "阿斯特拉", enabled: true }],
    })).toEqual({ ok: true })
  })

  it("does not require glossary terms when the source term is absent", () => {
    expect(validateExplanationQuality({
      source: "This sentence discusses idioms.",
      explanation: "This explains that the sentence is about idioms.",
      requiredGlossaryTerms: [{ sourceTerm: "Astra", preferredTerm: "阿斯特拉", enabled: true }],
    })).toEqual({ ok: true })
  })

  it("allows a substantive learner-facing explanation", () => {
    expect(validateExplanationQuality({
      source: "Although it was raining, the team continued the match.",
      explanation: "This explains a contrast: the rain created a problem, but the team still kept playing. ‘Although’ introduces the obstacle.",
    })).toEqual({ ok: true })
  })
})
