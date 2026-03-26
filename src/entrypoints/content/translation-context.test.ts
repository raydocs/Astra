import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { DEFAULT_ASTRA_CONFIG } from "@/types/config"
import {
  buildInlineTranslationContext,
  disconnectInlineSummaryObserver,
  getDocumentTranslationContext,
} from "./translation-context"

const readConfigMock = vi.hoisted(() => vi.fn())

vi.mock("@/utils/storage/config", () => ({
  readConfig: readConfigMock,
}))

describe("translation-context", () => {
  beforeEach(() => {
    document.title = ""
    document.head.innerHTML = ""
    document.body.innerHTML = ""
    window.history.replaceState({}, "", "/article?query=1#hash")
    readConfigMock.mockResolvedValue(DEFAULT_ASTRA_CONFIG)
  })

  afterEach(() => {
    disconnectInlineSummaryObserver()
    vi.restoreAllMocks()
  })

  it("captures document-level metadata", () => {
    document.head.innerHTML = '<meta name="description" content="A helpful article summary." />'
    document.title = "Astra article"

    expect(getDocumentTranslationContext()).toEqual({
      pageTitle: "Astra article",
      pageUrl: `${window.location.origin}/article`,
      hostname: window.location.hostname,
      metaDescription: "A helpful article summary.",
    })
  })

  it("includes page content summary and selection context for inline actions", async () => {
    document.title = "Inline explain page"
    document.body.innerHTML = `
      <main>
        <p>First paragraph with enough text to represent the first important idea in the page summary.</p>
        <p>Second paragraph with more detail so the inline context can provide broader article understanding.</p>
        <p>Third paragraph finishes the content set for summary generation in inline actions.</p>
      </main>
    `

    const context = await buildInlineTranslationContext({
      selectionContext: "Selected sentence",
    })

    expect(context).toMatchObject({
      pageTitle: "Inline explain page",
      pageUrl: `${window.location.origin}/article`,
      hostname: window.location.hostname,
      selectionContext: "Selected sentence",
    })
    expect(context.contentSummary).toContain("First paragraph")
    expect(context.contentSummary).toContain("Second paragraph")
  })

  it("omits contentSummary when the page has no extractable text blocks", async () => {
    document.body.innerHTML = '<div><button>Click me</button><nav><a href="#">Link</a></nav></div>'

    const context = await buildInlineTranslationContext()

    expect(context.contentSummary).toBeUndefined()
  })

  it("omits page summary when the inline action target is outside the main content root", async () => {
    document.body.innerHTML = `
      <aside id="sidebar">
        <p>Sidebar helper text.</p>
      </aside>
      <main>
        <p>Main article paragraph one with enough text to create a summary.</p>
        <p>Main article paragraph two adds more relevant article detail.</p>
        <p>Main article paragraph three completes the content summary source.</p>
      </main>
    `

    const sidebar = document.getElementById("sidebar")
    const context = await buildInlineTranslationContext({
      selectionContext: "Sidebar helper text.",
      contextElement: sidebar,
    })

    expect(context.selectionContext).toBe("Sidebar helper text.")
    expect(context.contentSummary).toBeUndefined()
  })

  it("strips context fields when privacy mode is enabled", async () => {
    readConfigMock.mockResolvedValue({ ...DEFAULT_ASTRA_CONFIG, privacyMode: true })
    document.title = "Secret page"
    document.head.innerHTML = '<meta name="description" content="Private description." />'
    document.body.innerHTML = `
      <main>
        <p>First paragraph with enough text to represent the first important idea in the page summary.</p>
        <p>Second paragraph with more detail so the inline context can provide broader article understanding.</p>
      </main>
    `

    const context = await buildInlineTranslationContext({
      selectionContext: "Selected sentence",
    })

    expect(context.pageTitle).toBeUndefined()
    expect(context.metaDescription).toBeUndefined()
    expect(context.contentSummary).toBeUndefined()
    expect(context.selectionContext).toBeUndefined()
    expect(context.hostname).toBe(window.location.hostname)
  })

  it("removes the popstate listener when the inline summary observer disconnects", async () => {
    const addEventListenerSpy = vi.spyOn(window, "addEventListener")
    const removeEventListenerSpy = vi.spyOn(window, "removeEventListener")

    await buildInlineTranslationContext()

    const popstateRegistration = addEventListenerSpy.mock.calls.find(([eventName]) => eventName === "popstate")
    expect(popstateRegistration?.[1]).toBeTypeOf("function")

    disconnectInlineSummaryObserver()

    expect(removeEventListenerSpy).toHaveBeenCalledWith("popstate", popstateRegistration?.[1])
  })
})
