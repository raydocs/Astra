import { beforeEach, describe, expect, it } from "vitest"

import { resolveArticleRoot, resolveExtractionPlan } from "./extraction"

describe("resolveExtractionPlan", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
  })

  it("page scope returns findContentRoot result", () => {
    document.body.innerHTML = `
      <main><p>Hello</p></main>
    `

    const plan = resolveExtractionPlan(document, "page")

    expect(plan.root.tagName).toBe("MAIN")
    expect(plan.scope).toBe("page")
    expect(plan.blocks.length).toBeGreaterThan(0)
  })

  it("article scope finds article element", () => {
    document.body.innerHTML = `
      <nav><a href="#">Nav</a><a href="#">Link</a></nav>
      <article>
        <h1>Title</h1>
        <p>Paragraph one with enough text to pass the threshold easily here.</p>
        <p>Paragraph two with more content to ensure we have sufficient text length.</p>
        <p>Paragraph three rounds out the minimum block count requirement nicely.</p>
      </article>
    `

    const plan = resolveExtractionPlan(document, "article")

    expect(plan.root.tagName).toBe("ARTICLE")
    expect(plan.scope).toBe("article")
    expect(plan.blocks.length).toBeGreaterThanOrEqual(3)
  })

  it("article scope falls back to page when no article found", () => {
    document.body.innerHTML = `
      <p>Just some text</p>
      <p>More text</p>
      <p>Even more</p>
    `

    const plan = resolveExtractionPlan(document, "article")

    expect(plan.scope).toBe("page")
  })

  it("article scope rejects thin candidates", () => {
    document.body.innerHTML = `
      <article><p>Hi</p></article>
      <main>
        <p>Long text one that is sufficiently padded to cross the character threshold easily.</p>
        <p>Long text two with additional filler content to ensure block and text minimums.</p>
        <p>Long text three providing even more substantial content for a valid candidate.</p>
      </main>
    `

    const plan = resolveExtractionPlan(document, "article")

    // The thin article (1 block, few chars) should be rejected.
    // main qualifies and should be selected, or it falls back to page via findContentRoot.
    expect(plan.root.tagName).not.toBe("ARTICLE")
  })
})

describe("resolveArticleRoot", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
  })

  it("returns null for nav-heavy pages", () => {
    document.body.innerHTML = `
      <div>
        <a href="#">Link 1</a>
        <a href="#">Link 2</a>
        <a href="#">Link 3</a>
        <a href="#">Link 4</a>
        <a href="#">Link 5</a>
      </div>
    `

    const root = resolveArticleRoot(document)

    expect(root).toBeNull()
  })

  it("prefers candidate with heading over one without", () => {
    document.body.innerHTML = `
      <div role="article" id="no-heading">
        <p>Some content paragraph one that is long enough to qualify easily here.</p>
        <p>Some content paragraph two with additional text for the scoring system.</p>
        <p>Some content paragraph three rounding out the minimum block count here.</p>
      </div>
      <article id="with-heading">
        <h1>Article Title</h1>
        <p>Some content paragraph one that is long enough to qualify easily here.</p>
        <p>Some content paragraph two with additional text for the scoring system.</p>
        <p>Some content paragraph three rounding out the minimum block count here.</p>
      </article>
    `

    const root = resolveArticleRoot(document)

    expect(root).not.toBeNull()
    expect(root!.id).toBe("with-heading")
  })
})
