import { describe, expect, it } from "vitest"

import { mountPageFixture } from "./contentHarness"

describe("contentHarness", () => {
  it("loads fixture markup and stacks article blocks with stable geometry", () => {
    const fixture = mountPageFixture("article-basic", {
      title: "Article fixture",
      url: "/fixtures/article-basic",
    })

    const heading = fixture.get("article h1")
    const firstParagraph = fixture.get("article p")

    expect(document.title).toBe("Article fixture")
    expect(window.location.pathname).toBe("/fixtures/article-basic")
    expect(heading.getBoundingClientRect().top).toBe(40)
    expect(firstParagraph.getBoundingClientRect().top).toBeGreaterThan(40)
  })

  it("restacks newly appended blocks so follow-up tests can observe them deterministically", () => {
    const fixture = mountPageFixture("dynamic-feed", {
      url: "/fixtures/dynamic-feed",
    })

    const feed = fixture.get(".feed")
    const article = document.createElement("article")
    const paragraph = document.createElement("p")
    paragraph.textContent = "A newly appended story for later translation tests."
    article.appendChild(paragraph)
    feed.appendChild(article)

    fixture.restack("main p, article p")

    expect(fixture.queryAll("article p")).toHaveLength(3)
    expect(paragraph.getBoundingClientRect().top).toBeGreaterThan(40)
  })
})
