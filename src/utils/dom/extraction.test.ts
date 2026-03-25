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

    expect(plan.root.tagName).toBe("BODY")
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

    expect(plan.scope).toBe("page")
    expect(plan.root.tagName).toBe("BODY")
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

  it("does not treat a generic main feed as an article root", () => {
    document.body.innerHTML = `
      <main id="feed">
        <section>
          <h2>Story one</h2>
          <p>Paragraph one with enough text to look substantial on its own.</p>
          <a href="#">Read more</a>
        </section>
        <section>
          <h2>Story two</h2>
          <p>Another paragraph with enough length to resemble a feed card summary.</p>
          <a href="#">Read more</a>
        </section>
        <section>
          <h2>Story three</h2>
          <p>A third summary block that should not make the entire main element look like one article.</p>
          <a href="#">Read more</a>
        </section>
      </main>
    `

    const root = resolveArticleRoot(document)

    expect(root).toBeNull()
  })

  it("prefers article element over sidebar nav", () => {
    document.body.innerHTML = `
      <aside class="sidebar" role="complementary">
        <h2>Sidebar</h2>
        <p>Some sidebar content that is long enough to look like real text content in a sidebar.</p>
        <p>Another sidebar paragraph with additional filler text to meet length requirements.</p>
        <p>Third sidebar paragraph with even more text to ensure it would otherwise qualify.</p>
      </aside>
      <article id="main-article">
        <h1>Main Article Title</h1>
        <p>This is the first paragraph of the main article with enough text to qualify as substantial content.</p>
        <p>This is the second paragraph providing more content for the article scoring algorithm to evaluate.</p>
        <p>This is the third paragraph rounding out the minimum block count requirement for article detection.</p>
      </article>
    `

    const root = resolveArticleRoot(document)

    expect(root).not.toBeNull()
    expect(root!.id).toBe("main-article")
  })

  it("scores paragraph-dense containers higher", () => {
    document.body.innerHTML = `
      <div class="content" id="sparse-content">
        <h2>Sparse Content</h2>
        <div><div><div><span>Deeply nested text that is long enough to cross the threshold.</span></div></div></div>
        <div><div><span>More nested content with filler text for the scoring system to evaluate.</span></div></div>
        <div><span>Extra nested content for block count with additional length for qualification.</span></div>
      </div>
      <div class="post" id="dense-paragraphs">
        <h1>Dense Article</h1>
        <p>First paragraph of the dense article with sufficient text for the scoring algorithm to work.</p>
        <p>Second paragraph providing additional paragraph density for the article root detection.</p>
        <p>Third paragraph ensuring this container has a high ratio of p elements to total elements.</p>
        <p>Fourth paragraph adding even more paragraph density to clearly win the scoring contest.</p>
      </div>
    `

    const root = resolveArticleRoot(document)

    expect(root).not.toBeNull()
    expect(root!.id).toBe("dense-paragraphs")
  })

  it("falls back to page scope when article root has too few blocks", () => {
    document.body.innerHTML = `
      <article id="thin-article">
        <p>Short</p>
      </article>
      <p>Body paragraph one with enough text to be collected by the page scope traversal.</p>
      <p>Body paragraph two with additional text content for the page scope fallback.</p>
      <p>Body paragraph three providing more content for the page scope extraction plan.</p>
    `

    const root = resolveArticleRoot(document)

    // The article root should be null since the only article candidate
    // has too few blocks / too little text to qualify
    expect(root).toBeNull()
  })
})
