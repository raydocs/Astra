import { beforeEach, describe, expect, it } from "vitest"

import { createMockBrowser, setMockBrowser } from "../../../test/utils/mockBrowser"
import {
  clearPageAnnotations,
  listPageAnnotations,
  savePageAnnotation,
  type PageAnnotation,
} from "@/utils/storage/page-annotations"
import {
  __resetPageAnnotationsForTests,
  buildAnnotationAnchorFromRange,
  createAnnotationFromCurrentSelection,
  renderPageAnnotations,
} from "./page-annotations"

function setUrl(url: string) {
  window.history.replaceState(null, "", url)
}

function createSavedAnnotation(patch: Partial<PageAnnotation> = {}): PageAnnotation {
  const pageUrl = `${window.location.origin}/article`
  return {
    id: "saved-highlight",
    pageUrl,
    pageOrigin: window.location.origin,
    pageTitle: "Article",
    quoteText: "persistent highlight",
    type: "highlight",
    state: "active",
    anchor: {
      textPosition: { start: "Intro ".length, end: "Intro persistent highlight".length },
      textQuote: { exact: "persistent highlight", prefix: "Intro ", suffix: " survives reload." },
      selector: { selector: "#target", textNodeIndex: 0 },
    },
    createdAt: 1000,
    updatedAt: 1000,
    ...patch,
  }
}

describe("page annotation rendering", () => {
  beforeEach(async () => {
    setMockBrowser(createMockBrowser())
    document.body.innerHTML = `<main><p id="target">Intro persistent highlight survives reload.</p></main>`
    document.title = "Article"
    setUrl("/article")
    __resetPageAnnotationsForTests()
    await clearPageAnnotations()
  })

  it("builds text-position, quote, and selector anchors from the current range", () => {
    const text = document.getElementById("target")!.firstChild as Text
    const range = document.createRange()
    range.setStart(text, "Intro ".length)
    range.setEnd(text, "Intro persistent highlight".length)

    const anchor = buildAnnotationAnchorFromRange(range)

    expect(anchor).toMatchObject({
      textPosition: { start: 6, end: 26 },
      textQuote: {
        exact: "persistent highlight",
        prefix: "Intro ",
        suffix: " survives reload.",
      },
      selector: { selector: "#target", textNodeIndex: 0 },
    })
  })

  it("renders saved highlights after reload and deletes persisted state plus UI", async () => {
    await savePageAnnotation(createSavedAnnotation())

    await renderPageAnnotations()

    const highlight = document.querySelector(".astra-page-annotation-highlight") as HTMLElement | null
    expect(highlight?.textContent).toBe("persistent highlight")
    expect(highlight?.dataset.annotationType).toBe("highlight")

    const panelHost = document.getElementById("astra-page-annotations-host")
    const deleteButton = panelHost?.shadowRoot?.querySelector("[data-testid='page-annotation-delete-saved-highlight']") as HTMLButtonElement | null
    expect(deleteButton).toBeTruthy()

    deleteButton!.click()
    await Promise.resolve()
    await Promise.resolve()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(await listPageAnnotations(window.location.href)).toEqual([])
  })

  it("creates a highlight from selection without creating vocabulary entries", async () => {
    const text = document.getElementById("target")!.firstChild as Text
    const range = document.createRange()
    range.setStart(text, "Intro ".length)
    range.setEnd(text, "Intro persistent highlight".length)
    const selection = window.getSelection()!
    selection.removeAllRanges()
    selection.addRange(range)

    const result = await createAnnotationFromCurrentSelection("highlight")

    expect(result?.annotation).toMatchObject({
      pageUrl: `${window.location.origin}/article`,
      pageOrigin: window.location.origin,
      quoteText: "persistent highlight",
      type: "highlight",
      state: "active",
    })
    expect(await listPageAnnotations(window.location.href)).toHaveLength(1)
    expect(document.querySelector(".astra-page-annotation-highlight")?.textContent).toBe("persistent highlight")
  })

  it("shows unresolved anchors without deleting the saved annotation", async () => {
    await savePageAnnotation(createSavedAnnotation({
      id: "missing-highlight",
      quoteText: "missing text",
      anchor: {
        textPosition: { start: 200, end: 212 },
        textQuote: { exact: "missing text", prefix: "not ", suffix: " here" },
      },
    }))

    await renderPageAnnotations()
    await Promise.resolve()
    await Promise.resolve()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(document.querySelector(".astra-page-annotation-highlight")).toBeNull()
    const saved = await listPageAnnotations(window.location.href)
    expect(saved).toHaveLength(1)
    expect(saved[0]).toMatchObject({ state: "unresolved" })

    const panelText = document.getElementById("astra-page-annotations-host")?.shadowRoot?.textContent ?? ""
    expect(panelText).toContain("unresolved")
    expect(panelText).toContain("Anchor unresolved")
  })
})
