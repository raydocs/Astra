import { act } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const {
  readConfigMock,
  translateTextsMock,
  saveVocabularyEntryMock,
  getDueVocabularyCountMock,
  hasVocabularyEntryByTextMock,
  markSessionSaveMock,
  createAnnotationFromCurrentSelectionMock,
  recordLearningLoopEventMock,
} = vi.hoisted(() => ({
  readConfigMock: vi.fn(),
  translateTextsMock: vi.fn(),
  saveVocabularyEntryMock: vi.fn(),
  getDueVocabularyCountMock: vi.fn(),
  hasVocabularyEntryByTextMock: vi.fn(),
  markSessionSaveMock: vi.fn(),
  createAnnotationFromCurrentSelectionMock: vi.fn(),
  recordLearningLoopEventMock: vi.fn(),
}))

vi.mock("@/utils/learning-loop-events", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/learning-loop-events")>()
  return { ...actual, recordLearningLoopEvent: recordLearningLoopEventMock }
})

vi.mock("@/utils/storage/config", () => ({
  readConfig: readConfigMock,
}))

vi.mock("@/utils/translate/translate", () => ({
  translateTexts: translateTextsMock,
  translateExplanationWithQualityRetry: async (request: {
    source: string
    requiredGlossaryTerms?: Array<{ sourceTerm: string; preferredTerm: string; enabled?: boolean }>
    [key: string]: unknown
  }) => {
    const {
      buildExplanationRepairInstruction,
      validateExplanationQuality,
    } = await import("@/utils/translate/explanation-quality")
    const { source, requiredGlossaryTerms = [], ...translateRequest } = request
    const baseRequest = { ...translateRequest, texts: [source], task: "explain" }
    const firstResult = await translateTextsMock(baseRequest)
    if (!firstResult.ok) return { ok: false, message: firstResult.error.message, retried: false }
    const firstText = firstResult.translations[0] ?? ""
    const firstQuality = validateExplanationQuality({ source, explanation: firstText, requiredGlossaryTerms })
    if (firstQuality.ok) return { ok: true, text: firstText, retried: false }
    const retryResult = await translateTextsMock({
      ...baseRequest,
      explanationRepairInstruction: buildExplanationRepairInstruction(firstQuality),
    })
    if (!retryResult.ok) return { ok: false, message: retryResult.error.message, retried: true, quality: firstQuality }
    const retryText = retryResult.translations[0] ?? ""
    const retryQuality = validateExplanationQuality({ source, explanation: retryText, requiredGlossaryTerms })
    if (!retryQuality.ok) return { ok: false, message: retryQuality.message, retried: true, quality: retryQuality }
    return { ok: true, text: retryText, retried: true }
  },
}))

vi.mock("@/utils/storage/vocabulary", () => ({
  saveVocabularyEntry: saveVocabularyEntryMock,
  getDueVocabularyCount: getDueVocabularyCountMock,
  hasVocabularyEntryByText: hasVocabularyEntryByTextMock,
}))

vi.mock("../learning-state", () => ({
  markSessionSave: markSessionSaveMock,
}))

vi.mock("../page-annotations", () => ({
  createAnnotationFromCurrentSelection: createAnnotationFromCurrentSelectionMock,
}))

vi.mock("@/utils/reading/assist", () => ({
  generateGrammarGuide: vi.fn().mockResolvedValue({
    overview: "mock overview",
    structure: [],
    keyPatterns: [],
    vocabularyNotes: [],
  }),
  generateWordAnnotation: vi.fn().mockResolvedValue({
    word: "mock",
    partOfSpeech: "noun",
    meaning: "mock meaning",
    shortExplanation: "mock explanation",
  }),
  isLexicalCandidate: vi.fn().mockReturnValue(false),
}))

import { browser } from "#imports"
import { DEFAULT_ASTRA_CONFIG } from "@/types/config"
import { t } from "@/utils/i18n"
import * as tts from "@/utils/tts"
import {
  getInteractionSuppressionState,
} from "../interaction-coordination"
import { mountSelectionToolbar } from "./SelectionToolbar"

const HOST_ID = "astra-selection-toolbar-host"

describe("SelectionToolbar interaction suppression", () => {
  const documentListeners: Partial<Record<string, EventListenerOrEventListenerObject>> = {}
  const windowListeners: Partial<Record<string, EventListenerOrEventListenerObject>> = {}

  beforeEach(async () => {
    vi.useFakeTimers()
    readConfigMock.mockReset()
    translateTextsMock.mockReset()
    saveVocabularyEntryMock.mockReset()
    getDueVocabularyCountMock.mockReset()
    hasVocabularyEntryByTextMock.mockReset()
    recordLearningLoopEventMock.mockReset()
    markSessionSaveMock.mockReset()
    createAnnotationFromCurrentSelectionMock.mockReset()
    document.getElementById(HOST_ID)?.remove()
    document.body.innerHTML = `<main><p id="target">Hello world</p></main>`

    Object.defineProperty(globalThis, "speechSynthesis", {
      value: { speak: vi.fn(), cancel: vi.fn(), speaking: false },
      writable: true,
      configurable: true,
    })
    Object.defineProperty(globalThis, "SpeechSynthesisUtterance", {
      value: vi.fn(),
      writable: true,
      configurable: true,
    })

    vi.spyOn(document, "addEventListener").mockImplementation(((type: string | symbol, listener: EventListenerOrEventListenerObject) => {
      documentListeners[String(type)] = listener
    }) as typeof document.addEventListener)
    vi.spyOn(document, "removeEventListener").mockImplementation((() => {}) as typeof document.removeEventListener)
    vi.spyOn(window, "addEventListener").mockImplementation(((type: string | symbol, listener: EventListenerOrEventListenerObject) => {
      windowListeners[String(type)] = listener
    }) as typeof window.addEventListener)
    vi.spyOn(window, "removeEventListener").mockImplementation((() => {}) as typeof window.removeEventListener)

    readConfigMock.mockResolvedValue(DEFAULT_ASTRA_CONFIG)
    translateTextsMock.mockResolvedValue({ ok: true, translations: ["你好"] })
    saveVocabularyEntryMock.mockResolvedValue(undefined)
    getDueVocabularyCountMock.mockResolvedValue(0)
    hasVocabularyEntryByTextMock.mockResolvedValue(false)
    createAnnotationFromCurrentSelectionMock.mockResolvedValue({
      annotation: { id: "annotation-1" },
      evictedCount: 0,
      maxAnnotations: 500,
    })

    await act(async () => {
      mountSelectionToolbar()
      await Promise.resolve()
    })
  })

  afterEach(() => {
    document.getElementById(HOST_ID)?.remove()
    document.title = ""
    window.history.replaceState(null, "", "/")
    Object.keys(documentListeners).forEach((key) => delete documentListeners[key])
    Object.keys(windowListeners).forEach((key) => delete windowListeners[key])
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  function setSelection(text: string, collapsed = false) {
    const target = document.getElementById("target") as HTMLElement
    const range = {
      commonAncestorContainer: target.firstChild ?? target,
      getBoundingClientRect: () => ({
        top: 10,
        left: 10,
        right: 120,
        bottom: 30,
        width: 110,
        height: 20,
        x: 10,
        y: 10,
        toJSON: () => ({}),
      } as DOMRect),
    }

    vi.spyOn(window, "getSelection").mockReturnValue({
      rangeCount: text ? 1 : 0,
      isCollapsed: collapsed,
      toString: () => text,
      getRangeAt: () => range,
    } as unknown as Selection)
  }

  async function triggerDocumentMouseDown(target: EventTarget) {
    const onMouseDown = documentListeners.mousedown as ((event: MouseEvent) => void) | undefined
    const event = new MouseEvent("mousedown", { button: 0 })
    Object.defineProperty(event, "target", { value: target })

    await act(async () => {
      onMouseDown?.(event)
      await Promise.resolve()
    })
  }

  async function triggerDocumentMouseUp(target: EventTarget) {
    const onMouseUp = documentListeners.mouseup as ((event: MouseEvent) => void) | undefined
    const event = new MouseEvent("mouseup")
    Object.defineProperty(event, "target", { value: target })

    await act(async () => {
      onMouseUp?.(event)
      await vi.advanceTimersByTimeAsync(20)
      await Promise.resolve()
    })
  }

  it("suppresses hover immediately on pointer down and keeps suppression for a valid selection", async () => {
    const target = document.getElementById("target") as HTMLElement
    const onMouseDown = documentListeners.mousedown as ((event: MouseEvent) => void) | undefined
    const onMouseUp = documentListeners.mouseup as ((event: MouseEvent) => void) | undefined

    expect(onMouseDown).toBeTypeOf("function")
    expect(onMouseUp).toBeTypeOf("function")

    await triggerDocumentMouseDown(target)

    expect(getInteractionSuppressionState().hoverSuppressed).toBe(true)

    setSelection("Hello world")
    await triggerDocumentMouseUp(target)

    expect(getInteractionSuppressionState().hoverSuppressed).toBe(true)
  })

  it("keeps pointer suppression when a new selection starts while the toolbar is already visible", async () => {
    const target = document.getElementById("target") as HTMLElement

    await triggerDocumentMouseDown(target)

    setSelection("Hello world")
    await triggerDocumentMouseUp(target)

    expect(getInteractionSuppressionState().hoverSuppressed).toBe(true)

    await triggerDocumentMouseDown(target)

    expect(getInteractionSuppressionState().hoverSuppressed).toBe(true)
  })

  it("releases pointer suppression on blur even if a new selection starts while the toolbar is visible", async () => {
    const target = document.getElementById("target") as HTMLElement
    const onBlur = windowListeners.blur as (() => void) | undefined

    await triggerDocumentMouseDown(target)

    setSelection("Hello world")
    await triggerDocumentMouseUp(target)

    await triggerDocumentMouseDown(target)

    expect(getInteractionSuppressionState().hoverSuppressed).toBe(true)
    expect(onBlur).toBeTypeOf("function")

    await act(async () => {
      onBlur?.()
      await Promise.resolve()
    })

    expect(getInteractionSuppressionState().hoverSuppressed).toBe(false)
  })

  it("releases suppression when the toolbar dismisses on scroll", async () => {
    const target = document.getElementById("target") as HTMLElement

    await triggerDocumentMouseDown(target)

    setSelection("Hello world")
    await triggerDocumentMouseUp(target)

    expect(getInteractionSuppressionState().hoverSuppressed).toBe(true)

    const onScroll = windowListeners.scroll as (() => void) | undefined
    expect(onScroll).toBeTypeOf("function")

    await act(async () => {
      onScroll?.()
      await Promise.resolve()
    })

    expect(getInteractionSuppressionState().hoverSuppressed).toBe(false)
  })

  it("does not open over editable selections", async () => {
    document.body.innerHTML = `<main><div id="editable" contenteditable="true">Editable draft text</div></main>`
    const editable = document.getElementById("editable") as HTMLElement
    const textNode = editable.firstChild as Text
    const range = {
      commonAncestorContainer: textNode,
      startContainer: textNode,
      endContainer: textNode,
      getBoundingClientRect: () => ({
        top: 10,
        left: 10,
        right: 120,
        bottom: 30,
        width: 110,
        height: 20,
        x: 10,
        y: 10,
        toJSON: () => ({}),
      } as DOMRect),
    }
    vi.spyOn(window, "getSelection").mockReturnValue({
      rangeCount: 1,
      isCollapsed: false,
      toString: () => "Editable draft text",
      getRangeAt: () => range,
    } as unknown as Selection)

    await triggerDocumentMouseDown(editable)
    await triggerDocumentMouseUp(editable)

    expect(getInteractionSuppressionState().hoverSuppressed).toBe(false)
    const host = document.getElementById(HOST_ID)
    expect(host?.shadowRoot?.querySelector("button")).toBeNull()
  })

  it("clears transient pointer suppression when selection is empty", async () => {
    const target = document.getElementById("target") as HTMLElement

    await triggerDocumentMouseDown(target)

    expect(getInteractionSuppressionState().hoverSuppressed).toBe(true)

    setSelection("", true)
    await triggerDocumentMouseUp(target)

    expect(getInteractionSuppressionState().hoverSuppressed).toBe(false)
  })

  it("releases pointer suppression on window blur when no toolbar is active", async () => {
    const target = document.getElementById("target") as HTMLElement
    const onBlur = windowListeners.blur as (() => void) | undefined

    await triggerDocumentMouseDown(target)

    expect(getInteractionSuppressionState().hoverSuppressed).toBe(true)
    expect(onBlur).toBeTypeOf("function")

    await act(async () => {
      onBlur?.()
      await Promise.resolve()
    })

    expect(getInteractionSuppressionState().hoverSuppressed).toBe(false)
  })

  it("calls explain task when explain button is clicked", async () => {
    readConfigMock.mockResolvedValue({
      ...DEFAULT_ASTRA_CONFIG,
      languageLevel: "beginner",
      explainMode: "exam",
    })
    const target = document.getElementById("target") as HTMLElement

    // Show toolbar via selection
    await triggerDocumentMouseDown(target)

    setSelection("Hello world")
    await triggerDocumentMouseUp(target)

    // The toolbar should be rendered in the shadow root
    const host = document.getElementById(HOST_ID)!
    const shadow = host.shadowRoot!
    const buttons = shadow.querySelectorAll("button")
    const explainBtn = Array.from(buttons).find((btn) => btn.textContent === "解释")

    expect(explainBtn).toBeDefined()

    translateTextsMock.mockResolvedValueOnce({
      ok: true,
      translations: ["This is a greeting in English."],
    })

    await act(async () => {
      explainBtn!.click()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(translateTextsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        task: "explain",
        texts: ["Hello world"],
        languageLevel: "beginner",
        explainMode: "exam",
      }),
    )
    expect(shadow.querySelector('[data-testid="selection-explain-profile"]')?.textContent).toBe("Explain profile: Exam · Beginner")

    const saveCta = shadow.querySelector('[data-testid="selection-result-save-cta"]') as HTMLButtonElement | null
    await act(async () => {
      saveCta!.click()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(saveVocabularyEntryMock).toHaveBeenCalledWith(expect.objectContaining({
      sourceContext: expect.objectContaining({
        surface: "selection_toolbar",
        sentenceText: "Hello world",
        languageLevel: "beginner",
        explainMode: "exam",
      }),
    }))
  })

  it("passes configured explanation glossary through selection explain requests", async () => {
    readConfigMock.mockResolvedValue({
      ...DEFAULT_ASTRA_CONFIG,
      explanationGlossary: [{ sourceTerm: "Astra", preferredTerm: "阿斯特拉", enabled: true }],
    })
    const target = document.getElementById("target") as HTMLElement

    await triggerDocumentMouseDown(target)
    setSelection("Astra improves reading")
    await triggerDocumentMouseUp(target)

    const host = document.getElementById(HOST_ID)!
    const shadow = host.shadowRoot!
    const explainBtn = shadow.querySelector("[data-testid='selection-action-explain']") as HTMLButtonElement | null

    translateTextsMock.mockResolvedValueOnce({
      ok: true,
      translations: ["阿斯特拉 is the product name; this explains that it improves reading."],
    })

    await act(async () => {
      explainBtn?.click()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(translateTextsMock).toHaveBeenCalledWith(expect.objectContaining({
      task: "explain",
      texts: ["Astra improves reading"],
      context: expect.objectContaining({
        explanationGlossary: "Astra => 阿斯特拉",
      }),
    }))
    expect(shadow.textContent).toContain("阿斯特拉 is the product name")
    expect(shadow.querySelector('[data-testid="selection-glossary-evidence"]')?.textContent).toBe("Glossary applied: Astra → 阿斯特拉")

    const saveCta = shadow.querySelector('[data-testid="selection-result-save-cta"]') as HTMLButtonElement | null
    await act(async () => {
      saveCta?.click()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(saveVocabularyEntryMock).toHaveBeenCalledWith(expect.objectContaining({
      sourceContext: expect.objectContaining({
        matchedGlossaryTerms: [{ sourceTerm: "Astra", preferredTerm: "阿斯特拉" }],
      }),
    }))
  })

  it("retries selection explanations missing required glossary terms before rendering success", async () => {
    readConfigMock.mockResolvedValue({
      ...DEFAULT_ASTRA_CONFIG,
      languageLevel: "beginner",
      explainMode: "exam",
      explanationGlossary: [{ sourceTerm: "Astra", preferredTerm: "阿斯特拉", enabled: true }],
    })
    const target = document.getElementById("target") as HTMLElement

    await triggerDocumentMouseDown(target)
    setSelection("Astra improves reading")
    await triggerDocumentMouseUp(target)

    const host = document.getElementById(HOST_ID)!
    const shadow = host.shadowRoot!
    const explainBtn = shadow.querySelector("[data-testid='selection-action-explain']") as HTMLButtonElement | null

    translateTextsMock
      .mockResolvedValueOnce({ ok: true, translations: ["This explains that the product improves reading."] })
      .mockResolvedValueOnce({ ok: true, translations: ["阿斯特拉 is the product name; this explains that it improves reading."] })

    await act(async () => {
      explainBtn?.click()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(translateTextsMock).toHaveBeenCalledTimes(2)
    expect(translateTextsMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
      task: "explain",
      texts: ["Astra improves reading"],
      languageLevel: "beginner",
      explainMode: "exam",
      context: expect.objectContaining({
        explanationGlossary: "Astra => 阿斯特拉",
      }),
      explanationRepairInstruction: expect.stringContaining("include every matched preferred term exactly"),
    }))
    expect(shadow.textContent).toContain("阿斯特拉 is the product name")
    expect(shadow.querySelector('[data-testid="selection-result-save-cta"]')).toBeTruthy()
  })

  it("rejects selection explanations missing required glossary terms after the recovery retry", async () => {
    readConfigMock.mockResolvedValue({
      ...DEFAULT_ASTRA_CONFIG,
      explanationGlossary: [{ sourceTerm: "Astra", preferredTerm: "阿斯特拉", enabled: true }],
    })
    const target = document.getElementById("target") as HTMLElement

    await triggerDocumentMouseDown(target)
    setSelection("Astra improves reading")
    await triggerDocumentMouseUp(target)

    const host = document.getElementById(HOST_ID)!
    const shadow = host.shadowRoot!
    const explainBtn = shadow.querySelector("[data-testid='selection-action-explain']") as HTMLButtonElement | null

    translateTextsMock
      .mockResolvedValueOnce({
        ok: true,
        translations: ["This explains that the product improves reading."],
      })
      .mockResolvedValueOnce({
        ok: true,
        translations: ["Still missing the required term."],
      })

    await act(async () => {
      explainBtn?.click()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(shadow.textContent).toContain("⚠ Explanation output omitted required glossary term \"阿斯特拉\" for source term \"Astra\". Please retry.")
    expect(shadow.querySelector('[data-testid="selection-result-save-cta"]')).toBeNull()
  })

  it("rejects source-echo selection explanations before they become saveable explanations", async () => {
    const target = document.getElementById("target") as HTMLElement

    await triggerDocumentMouseDown(target)
    setSelection("Hello world")
    await triggerDocumentMouseUp(target)

    const host = document.getElementById(HOST_ID)!
    const shadow = host.shadowRoot!
    const explainBtn = shadow.querySelector("[data-testid='selection-action-explain']") as HTMLButtonElement | null

    translateTextsMock
      .mockResolvedValueOnce({
        ok: true,
        translations: ["Hello world"],
      })
      .mockResolvedValueOnce({
        ok: true,
        translations: ["Hello world"],
      })

    await act(async () => {
      explainBtn?.click()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(shadow.textContent).toContain("⚠ Explanation output echoed the source text. Please retry.")
    expect(shadow.querySelector('[data-testid="selection-explain-profile"]')).toBeNull()
    expect(shadow.querySelector('[data-testid="selection-result-save-cta"]')).toBeNull()

    saveVocabularyEntryMock.mockClear()
    const saveBtn = Array.from(shadow.querySelectorAll("button")).find((btn) => btn.textContent === t("actionSave"))
    await act(async () => {
      saveBtn?.click()
      await Promise.resolve()
      await Promise.resolve()
    })

    const [savedEntry] = saveVocabularyEntryMock.mock.calls.at(-1) ?? []
    expect(savedEntry).toBeDefined()
    expect(savedEntry.explanation).toBeUndefined()
    expect(savedEntry.note).toBeUndefined()
    expect(savedEntry.sourceContext).not.toHaveProperty("languageLevel")
    expect(savedEntry.sourceContext).not.toHaveProperty("explainMode")
  })

  it("rejects repetitive selection explanations before they become saveable explanations", async () => {
    const target = document.getElementById("target") as HTMLElement

    await triggerDocumentMouseDown(target)
    setSelection("Although the tone is calm, the announcement matters.")
    await triggerDocumentMouseUp(target)

    const host = document.getElementById(HOST_ID)!
    const shadow = host.shadowRoot!
    const explainBtn = shadow.querySelector("[data-testid='selection-action-explain']") as HTMLButtonElement | null

    translateTextsMock
      .mockResolvedValueOnce({
        ok: true,
        translations: ["It explains that the announcement matters. It explains that the announcement matters. It explains that the announcement matters."],
      })
      .mockResolvedValueOnce({
        ok: true,
        translations: ["It explains that the announcement matters. It explains that the announcement matters. It explains that the announcement matters."],
      })

    await act(async () => {
      explainBtn?.click()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(shadow.textContent).toContain("⚠ Explanation output repeated itself in a loop. Please retry.")
    expect(shadow.querySelector('[data-testid="selection-explain-profile"]')).toBeNull()
    expect(shadow.querySelector('[data-testid="selection-result-save-cta"]')).toBeNull()

    saveVocabularyEntryMock.mockClear()
    const saveBtn = Array.from(shadow.querySelectorAll("button")).find((btn) => btn.textContent === t("actionSave"))
    await act(async () => {
      saveBtn?.click()
      await Promise.resolve()
      await Promise.resolve()
    })

    const [savedEntry] = saveVocabularyEntryMock.mock.calls.at(-1) ?? []
    expect(savedEntry).toBeDefined()
    expect(savedEntry.explanation).toBeUndefined()
    expect(savedEntry.note).toBeUndefined()
    expect(savedEntry.sourceContext).not.toHaveProperty("languageLevel")
    expect(savedEntry.sourceContext).not.toHaveProperty("explainMode")
  })

  it("shows primary action variants and active/selected state transitions", async () => {
    const target = document.getElementById("target") as HTMLElement

    await triggerDocumentMouseDown(target)
    setSelection("Hello world")
    await triggerDocumentMouseUp(target)

    const host = document.getElementById(HOST_ID)!
    const shadow = host.shadowRoot!
    const translateBtn = shadow.querySelector("[data-testid='selection-action-translate']") as HTMLButtonElement | null
    const explainBtn = shadow.querySelector("[data-testid='selection-action-explain']") as HTMLButtonElement | null
    const moreBtn = shadow.querySelector("[data-testid='selection-action-more']") as HTMLButtonElement | null
    await act(async () => {
      moreBtn?.click()
      await Promise.resolve()
    })
    const copyBtn = Array.from(shadow.querySelectorAll("button")).find((btn) => btn.textContent === "复制") as HTMLButtonElement | undefined

    expect(translateBtn?.dataset.actionVariant).toBe("primary")
    expect(explainBtn?.dataset.actionVariant).toBe("primary")
    expect(copyBtn).toBeDefined()

    let resolveExplain!: (value: { ok: true; translations: string[] }) => void
    translateTextsMock.mockImplementationOnce(() => new Promise((resolve) => {
      resolveExplain = resolve
    }))

    await act(async () => {
      explainBtn?.click()
      await Promise.resolve()
    })

    expect(explainBtn?.dataset.actionState).toBe("active")

    await act(async () => {
      resolveExplain({ ok: true, translations: ["This is a greeting in English."] })
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(explainBtn?.dataset.actionState).toBe("selected")
    expect(translateBtn?.dataset.actionState).toBe("idle")
  })

  it("calls translate task via runInlineAction when translate button is clicked", async () => {
    const target = document.getElementById("target") as HTMLElement

    await triggerDocumentMouseDown(target)

    setSelection("Hello world")
    await triggerDocumentMouseUp(target)

    const host = document.getElementById(HOST_ID)!
    const shadow = host.shadowRoot!
    const buttons = shadow.querySelectorAll("button")
    const translateBtn = Array.from(buttons).find((btn) => btn.textContent === "翻译")

    expect(translateBtn).toBeDefined()

    translateTextsMock.mockResolvedValueOnce({
      ok: true,
      translations: ["你好世界"],
    })

    await act(async () => {
      translateBtn!.click()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(translateTextsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        texts: ["Hello world"],
      }),
    )
  })

  it("shows inline save CTA after translation and hides the top-bar save button", async () => {
    const target = document.getElementById("target") as HTMLElement

    await triggerDocumentMouseDown(target)
    setSelection("Hello world")
    await triggerDocumentMouseUp(target)

    const host = document.getElementById(HOST_ID)!
    const shadow = host.shadowRoot!
    const translateBtn = Array.from(shadow.querySelectorAll("button")).find((btn) => btn.textContent === "翻译")

    expect(translateBtn).toBeDefined()

    translateTextsMock.mockResolvedValueOnce({
      ok: true,
      translations: ["你好世界"],
    })

    await act(async () => {
      translateBtn!.click()
      await Promise.resolve()
      await Promise.resolve()
    })

    const inlineSaveCta = shadow.querySelector("[data-testid='selection-result-save-cta']") as HTMLButtonElement | null
    expect(inlineSaveCta).toBeTruthy()
    expect(inlineSaveCta?.textContent).toContain(t("actionSave"))

    const topBarSaveButtons = Array.from(shadow.querySelectorAll("button"))
      .filter((btn) => btn.textContent === t("actionSave") && btn.dataset.testid !== "selection-result-save-cta")
    expect(topBarSaveButtons).toHaveLength(0)
  })

  it("offers content-free helpful/inaccurate feedback on a translation result", async () => {
    const target = document.getElementById("target") as HTMLElement

    await triggerDocumentMouseDown(target)
    setSelection("Hello world")
    await triggerDocumentMouseUp(target)

    const host = document.getElementById(HOST_ID)!
    const shadow = host.shadowRoot!
    const translateBtn = Array.from(shadow.querySelectorAll("button")).find((btn) => btn.textContent === "翻译")

    translateTextsMock.mockResolvedValueOnce({ ok: true, translations: ["你好世界"] })
    await act(async () => {
      translateBtn!.click()
      await Promise.resolve()
      await Promise.resolve()
    })

    const helpful = shadow.querySelector('[data-testid="selection-result-feedback-helpful"]') as HTMLButtonElement | null
    expect(helpful).toBeTruthy()
    expect(shadow.querySelector('[data-testid="selection-result-feedback-inaccurate"]')).toBeTruthy()

    await act(async () => {
      helpful!.click()
      await Promise.resolve()
    })

    expect(recordLearningLoopEventMock).toHaveBeenCalledTimes(1)
    const [eventName, payload] = recordLearningLoopEventMock.mock.calls[0]
    expect(eventName).toBe("result_feedback_submitted")
    expect(payload).toEqual({ surface: "selection_toolbar", action: "translate", signal: "helpful" })
    // Content-free: the selected text and the translation never enter the payload.
    expect(JSON.stringify(payload)).not.toContain("Hello world")
    expect(JSON.stringify(payload)).not.toContain("你好世界")

    // Row collapses to a thank-you; the choice buttons are gone.
    expect(shadow.querySelector('[data-testid="selection-result-feedback-helpful"]')).toBeNull()
    expect(shadow.querySelector('[data-testid="selection-result-feedback"]')?.textContent).toContain(t("resultFeedbackThanks"))
  })

  it("does not offer result feedback on a failed translation", async () => {
    const target = document.getElementById("target") as HTMLElement

    await triggerDocumentMouseDown(target)
    setSelection("Hello world")
    await triggerDocumentMouseUp(target)

    const host = document.getElementById(HOST_ID)!
    const shadow = host.shadowRoot!
    const translateBtn = Array.from(shadow.querySelectorAll("button")).find((btn) => btn.textContent === "翻译")

    translateTextsMock.mockResolvedValueOnce({ ok: false, error: { message: "Relay unavailable" } })
    await act(async () => {
      translateBtn!.click()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(shadow.querySelector('[data-testid="selection-result-feedback"]')).toBeNull()
    expect(recordLearningLoopEventMock).not.toHaveBeenCalled()
  })

  it("reflects an already-saved selection as saved instead of re-offering Save", async () => {
    hasVocabularyEntryByTextMock.mockResolvedValue(true)
    getDueVocabularyCountMock.mockResolvedValue(3)
    const target = document.getElementById("target") as HTMLElement

    await triggerDocumentMouseDown(target)
    setSelection("Hello world")
    await triggerDocumentMouseUp(target)

    // Let the async already-saved lookup (hasVocabularyEntryByText -> getDueVocabularyCount) resolve.
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    const host = document.getElementById(HOST_ID)!
    const shadow = host.shadowRoot!

    expect(hasVocabularyEntryByTextMock).toHaveBeenCalledWith("Hello world")
    // The top-bar Save button shows the saved state rather than a fresh "Save".
    const saveButton = shadow.querySelector('[data-testid="selection-action-save"]') as HTMLButtonElement
    expect(saveButton).toBeTruthy()
    expect(saveButton.textContent).toContain(t("actionSaved"))
  })

  it("publishes learning session save state when inline CTA save succeeds", async () => {
    const target = document.getElementById("target") as HTMLElement

    await triggerDocumentMouseDown(target)
    setSelection("Hello world")
    await triggerDocumentMouseUp(target)

    const host = document.getElementById(HOST_ID)!
    const shadow = host.shadowRoot!
    const translateBtn = Array.from(shadow.querySelectorAll("button")).find((btn) => btn.textContent === "翻译")

    await act(async () => {
      translateBtn!.click()
      await Promise.resolve()
      await Promise.resolve()
    })

    const inlineSaveCta = shadow.querySelector("[data-testid='selection-result-save-cta']") as HTMLButtonElement | null
    expect(inlineSaveCta).toBeTruthy()

    await act(async () => {
      inlineSaveCta!.click()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(saveVocabularyEntryMock).toHaveBeenCalledTimes(1)
    expect(markSessionSaveMock).toHaveBeenCalledWith("selection_toolbar", 0)
  })

  it("offers a Vocabulary affordance in the saved footer that opens the library", async () => {
    const target = document.getElementById("target") as HTMLElement

    await triggerDocumentMouseDown(target)
    setSelection("Hello world")
    await triggerDocumentMouseUp(target)

    const host = document.getElementById(HOST_ID)!
    const shadow = host.shadowRoot!
    const translateBtn = Array.from(shadow.querySelectorAll("button")).find((btn) => btn.textContent === "翻译")

    await act(async () => {
      translateBtn!.click()
      await Promise.resolve()
      await Promise.resolve()
    })

    const inlineSaveCta = shadow.querySelector("[data-testid='selection-result-save-cta']") as HTMLButtonElement | null
    expect(inlineSaveCta).toBeTruthy()

    await act(async () => {
      inlineSaveCta!.click()
      await Promise.resolve()
      await Promise.resolve()
    })

    // Parity with HoverTranslate/DeepRead: the saved footer must surface a discoverable
    // Vocabulary ("find it later") affordance, not just a "Saved" status chip.
    const vocabularyBtn = Array.from(shadow.querySelectorAll("button")).find(
      (btn) => btn.textContent === t("popup_vocabulary"),
    )
    expect(vocabularyBtn).toBeTruthy()

    await act(async () => {
      vocabularyBtn!.click()
      await Promise.resolve()
    })

    expect(browser.tabs.create).toHaveBeenCalledWith({ url: "/vocabulary.html" })
  })

  it("ignores stale explain results after the user makes a new selection", async () => {
    const target = document.getElementById("target") as HTMLElement

    await triggerDocumentMouseDown(target)

    setSelection("Hello world")
    await triggerDocumentMouseUp(target)

    const host = document.getElementById(HOST_ID)!
    const shadow = host.shadowRoot!
    const buttons = shadow.querySelectorAll("button")
    const explainBtn = Array.from(buttons).find((btn) => btn.textContent === "解释")

    let resolveExplain!: (value: { ok: true; translations: string[] }) => void
    translateTextsMock.mockImplementationOnce(() => new Promise((resolve) => {
      resolveExplain = resolve
    }))

    await act(async () => {
      explainBtn!.click()
      await Promise.resolve()
    })

    await triggerDocumentMouseDown(target)

    setSelection("New selection")
    await triggerDocumentMouseUp(target)

    await act(async () => {
      resolveExplain({ ok: true, translations: ["Old explanation"] })
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(shadow.textContent).not.toContain("Old explanation")
  })

  it("renders enabled Mark and Highlight annotation actions in normal mode", async () => {
    readConfigMock.mockResolvedValue({
      ...DEFAULT_ASTRA_CONFIG,
      customActions: [
        {
          id: "mark",
          label: "Mark",
          labelZh: "Mark",
          enabled: true,
          systemPrompt: "Mark {{text}}",
        },
        {
          id: "highlight",
          label: "Highlight",
          labelZh: "Highlight",
          enabled: true,
          systemPrompt: "Highlight {{text}}",
        },
      ],
    })
    const target = document.getElementById("target") as HTMLElement

    await triggerDocumentMouseDown(target)

    setSelection("Hello world")
    await triggerDocumentMouseUp(target)

    const host = document.getElementById(HOST_ID)!
    const shadow = host.shadowRoot!

    const shell = shadow.querySelector("[data-testid='selection-toolbar-shell']")
    expect(shell).toBeTruthy()

    const buttonBar = shell?.querySelector("div[aria-label]") as HTMLDivElement | null
    expect(buttonBar?.getAttribute("aria-label")).toContain("Astra")

    const buttons = shadow.querySelectorAll("button")
    const buttonTexts = Array.from(buttons).map((btn) => btn.textContent)

    expect(buttonTexts).toContain("翻译")
    expect(buttonTexts).toContain("解释")
    expect(buttonTexts).toContain(t("actionSave"))
    expect(buttonTexts).toContain("Mark")
    expect(buttonTexts).toContain("Highlight")
    expect(shadow.querySelector("[data-testid='selection-action-mark']")).toBeTruthy()
    expect(shadow.querySelector("[data-testid='selection-action-highlight']")).toBeTruthy()
    const moreButton = shadow.querySelector("[data-testid='selection-action-more']") as HTMLButtonElement | null
    expect(moreButton).toBeTruthy()
    expect(moreButton?.getAttribute("aria-label")).toBe(t("actionMore"))

    await act(async () => {
      moreButton?.click()
      await Promise.resolve()
    })

    expect(shadow.querySelector("[data-testid='selection-toolbar-more-menu']")).toBeTruthy()
    expect(shadow.querySelector("[data-testid='selection-action-mark']")).toBeTruthy()
    expect(shadow.querySelector("[data-testid='selection-action-highlight']")).toBeTruthy()
  })

  it("keeps Highlight distinct from vocabulary Save", async () => {
    readConfigMock.mockResolvedValue({
      ...DEFAULT_ASTRA_CONFIG,
      customActions: [
        {
          id: "highlight",
          label: "Highlight",
          labelZh: "Highlight",
          enabled: true,
          systemPrompt: "Highlight {{text}}",
        },
      ],
    })
    const target = document.getElementById("target") as HTMLElement

    await triggerDocumentMouseDown(target)
    setSelection("Hello world")
    await triggerDocumentMouseUp(target)

    const host = document.getElementById(HOST_ID)!
    const shadow = host.shadowRoot!
    const highlightButton = shadow.querySelector("[data-testid='selection-action-highlight']") as HTMLButtonElement | null

    await act(async () => {
      highlightButton?.click()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(createAnnotationFromCurrentSelectionMock).toHaveBeenCalledWith("highlight")
    expect(saveVocabularyEntryMock).not.toHaveBeenCalled()
    expect(markSessionSaveMock).not.toHaveBeenCalled()
    expect(shadow.querySelector("[data-testid='selection-result-card']")?.textContent).toContain("Highlight saved locally")
  })

  it("does not apply certification layout without the exact local fixture title", async () => {
    document.title = "Regular article"
    window.history.pushState(null, "", "/fixture?astraCert=1")

    const target = document.getElementById("target") as HTMLElement

    await triggerDocumentMouseDown(target)
    setSelection("Hello world")
    await triggerDocumentMouseUp(target)

    const host = document.getElementById(HOST_ID)!
    const shadow = host.shadowRoot!
    const toolbarRoot = shadow.querySelector("[data-testid='selection-toolbar-shell']")?.parentElement as HTMLDivElement | null

    expect(toolbarRoot?.style.top).toBe("36px")
  })

  it("keeps certification fixture layout truthful without exposing Mark", async () => {
    document.title = "Selection toolbar parity fixture"
    window.history.pushState(null, "", "/fixture?astraCert=1")
    readConfigMock.mockResolvedValue({
      ...DEFAULT_ASTRA_CONFIG,
      customActions: [
        {
          id: "mark",
          label: "Mark",
          labelZh: "Mark",
          enabled: true,
          systemPrompt: "Mark {{text}}",
        },
        {
          id: "highlight",
          label: "Highlight",
          labelZh: "Highlight",
          enabled: true,
          systemPrompt: "Highlight {{text}}",
        },
      ],
      presentation: {
        ...DEFAULT_ASTRA_CONFIG.presentation,
        fontSize: 1,
      },
    })

    const target = document.getElementById("target") as HTMLElement

    await triggerDocumentMouseDown(target)
    setSelection("Hello world")
    await triggerDocumentMouseUp(target)

    const host = document.getElementById(HOST_ID)!
    const shadow = host.shadowRoot!
    const toolbarRoot = shadow.querySelector("[data-testid='selection-toolbar-shell']")?.parentElement as HTMLDivElement | null

    expect(toolbarRoot?.style.top).toBe("72px")

    const translateBtn = shadow.querySelector("[data-testid='selection-action-translate']") as HTMLButtonElement | null
    await act(async () => {
      translateBtn?.click()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(shadow.querySelector("[data-testid='selection-result-card']")?.textContent).toContain("你好")
    expect(shadow.querySelector("[data-testid='selection-action-save']")?.textContent).toContain(t("actionSave"))
    expect(shadow.querySelector("[data-testid='selection-action-mark']")).toBeNull()
    expect(shadow.querySelector("[data-testid='selection-action-highlight']")).toBeNull()
    expect(shadow.textContent).not.toContain("Mark")
  })

  it("applies resolved font scaling to toolbar typography and controls", async () => {
    readConfigMock.mockResolvedValue({
      ...DEFAULT_ASTRA_CONFIG,
      presentation: {
        ...DEFAULT_ASTRA_CONFIG.presentation,
        fontSize: 1.2,
      },
    })

    const target = document.getElementById("target") as HTMLElement

    await triggerDocumentMouseDown(target)
    setSelection("Hello world")
    await triggerDocumentMouseUp(target)

    const host = document.getElementById(HOST_ID)!
    const shadow = host.shadowRoot!

    const shell = shadow.querySelector("[data-testid='selection-toolbar-shell']") as HTMLDivElement | null
    const toolbarRoot = shell?.parentElement as HTMLDivElement | null
    const translateButton = shadow.querySelector("[data-testid='selection-action-translate']") as HTMLButtonElement | null

    expect(toolbarRoot?.style.fontSize).toBe("1.05rem")
    expect(translateButton?.style.fontSize).toBe("15px")
  })

  it("hides the speak button when TTS is disabled in config", async () => {
    document.getElementById(HOST_ID)?.remove()
    readConfigMock.mockResolvedValue({
      ...DEFAULT_ASTRA_CONFIG,
      tts: {
        ...DEFAULT_ASTRA_CONFIG.tts,
        enabled: false,
      },
    })

    await act(async () => {
      mountSelectionToolbar()
      await Promise.resolve()
    })

    const target = document.getElementById("target") as HTMLElement

    await triggerDocumentMouseDown(target)
    setSelection("Hello world")
    await triggerDocumentMouseUp(target)

    const host = document.getElementById(HOST_ID)!
    const shadow = host.shadowRoot!
    const buttons = shadow.querySelectorAll("button")
    const buttonTexts = Array.from(buttons).map((btn) => btn.textContent)

    expect(buttonTexts).not.toContain("朗读")
  })

  it("refreshes TTS visibility before showing the toolbar", async () => {
    document.getElementById(HOST_ID)?.remove()
    readConfigMock
      .mockResolvedValueOnce(DEFAULT_ASTRA_CONFIG)
      .mockResolvedValueOnce({
        ...DEFAULT_ASTRA_CONFIG,
        tts: {
          ...DEFAULT_ASTRA_CONFIG.tts,
          enabled: false,
        },
      })

    await act(async () => {
      mountSelectionToolbar()
      await Promise.resolve()
    })

    const target = document.getElementById("target") as HTMLElement

    await triggerDocumentMouseDown(target)
    setSelection("Hello world")
    await triggerDocumentMouseUp(target)

    const host = document.getElementById(HOST_ID)!
    const shadow = host.shadowRoot!
    const buttonTexts = Array.from(shadow.querySelectorAll("button")).map((btn) => btn.textContent)

    expect(buttonTexts).not.toContain("朗读")
  })

  it("passes saved voice and rate into speak", async () => {
    const speakHighlightSpy = vi.spyOn(tts, "speakWithHighlight").mockReturnValue(() => {})
    readConfigMock.mockResolvedValue({
      ...DEFAULT_ASTRA_CONFIG,
      tts: {
        ...DEFAULT_ASTRA_CONFIG.tts,
        voiceName: "Microsoft Xiaoxiao Online",
        rate: 1.2,
      },
    })

    const target = document.getElementById("target") as HTMLElement

    await triggerDocumentMouseDown(target)
    setSelection("Hello world")
    await triggerDocumentMouseUp(target)

    const host = document.getElementById(HOST_ID)!
    const shadow = host.shadowRoot!
    const moreBtn = shadow.querySelector("[data-testid='selection-action-more']") as HTMLButtonElement | null
    await act(async () => {
      moreBtn?.click()
      await Promise.resolve()
    })

    const buttons = shadow.querySelectorAll("button")
    const speakBtn = Array.from(buttons).find((btn) => btn.textContent === "朗读")

    expect(speakBtn).toBeDefined()

    await act(async () => {
      speakBtn!.click()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(speakHighlightSpy).toHaveBeenCalledWith("Hello world", expect.objectContaining({
      voiceName: "Microsoft Xiaoxiao Online",
      rate: 1.2,
      pitch: 1.0,
      engine: "browser",
      onEnd: expect.any(Function),
      onError: expect.any(Function),
    }))
  })
})
