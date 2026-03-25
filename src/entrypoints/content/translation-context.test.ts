import { beforeEach, describe, expect, it } from "vitest"

import {
  buildInlineTranslationContext,
  getDocumentTranslationContext,
} from "./translation-context"

describe("translation-context", () => {
  beforeEach(() => {
    document.title = ""
    document.head.innerHTML = ""
    document.body.innerHTML = ""
    window.history.replaceState({}, "", "/article?query=1#hash")
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

  it("includes page content summary and selection context for inline actions", () => {
    document.title = "Inline explain page"
    document.body.innerHTML = `
      <main>
        <p>First paragraph with enough text to represent the first important idea in the page summary.</p>
        <p>Second paragraph with more detail so the inline context can provide broader article understanding.</p>
        <p>Third paragraph finishes the content set for summary generation in inline actions.</p>
      </main>
    `

    const context = buildInlineTranslationContext({
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

  it("omits contentSummary when the page has no extractable text blocks", () => {
    document.body.innerHTML = '<div><button>Click me</button><nav><a href="#">Link</a></nav></div>'

    const context = buildInlineTranslationContext()

    expect(context.contentSummary).toBeUndefined()
  })

  it("omits page summary when the inline action target is outside the main content root", () => {
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
    const context = buildInlineTranslationContext({
      selectionContext: "Sidebar helper text.",
      contextElement: sidebar,
    })

    expect(context.selectionContext).toBe("Sidebar helper text.")
    expect(context.contentSummary).toBeUndefined()
  })
})
