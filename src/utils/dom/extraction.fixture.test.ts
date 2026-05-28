import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { beforeEach, describe, expect, it } from "vitest"

import { resolveExtractionPlan } from "./extraction"
import { buildContentSummary, collectTextBlocks } from "./traversal"

const FIXTURE_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../test/fixtures/pages",
)

function loadFixture(name: string): string {
  return readFileSync(path.join(FIXTURE_ROOT, `${name}.html`), "utf8")
}

describe("resolveExtractionPlan with fixtures", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
  })

  it("resolveExtractionPlan with article scope finds article root in sidebar-heavy page", () => {
    document.body.innerHTML = loadFixture("article-with-sidebar")

    const plan = resolveExtractionPlan(document, "article")

    expect(plan.scope).toBe("article")
    expect(plan.root.tagName).toBe("ARTICLE")
    expect(plan.blocks.length).toBeGreaterThanOrEqual(5)

    // The article blocks should contain the accessibility content, not sidebar links
    const allText = plan.blocks.map((b) => b.text).join(" ")
    expect(allText).toContain("Web accessibility")
    expect(allText).not.toContain("Popular Posts")
  })

  it("resolveExtractionPlan with article scope prefers article over comments section", () => {
    document.body.innerHTML = loadFixture("comment-heavy")

    const plan = resolveExtractionPlan(document, "article")

    expect(plan.scope).toBe("article")
    expect(plan.root.tagName).toBe("ARTICLE")

    // The article should contain the main paragraphs about browser extensions
    const allText = plan.blocks.map((b) => b.text).join(" ")
    expect(allText).toContain("Browser extensions")

    // Comments should not leak into the article extraction
    expect(allText).not.toContain("@alice")
    expect(allText).not.toContain("@tina")
  })

  it("resolveExtractionPlan falls back to immersive body extraction when no strong article root exists", () => {
    // Build a page with no article/role=article/.post-content elements
    document.body.innerHTML = `
      <div>
        <p>A short bit of text here.</p>
        <p>Another small paragraph below.</p>
      </div>
    `

    const plan = resolveExtractionPlan(document, "article")

    expect(plan.scope).toBe("immersive")
    expect(plan.root.tagName).toBe("BODY")
  })

  it("buildContentSummary produces a meaningful summary from article blocks", () => {
    document.body.innerHTML = loadFixture("article-with-sidebar")

    const article = document.querySelector("article") as HTMLElement
    expect(article).not.toBeNull()

    const blocks = collectTextBlocks(article)
    expect(blocks.length).toBeGreaterThanOrEqual(5)

    const summary = buildContentSummary(blocks)
    expect(summary).not.toBeNull()
    expect(summary!.length).toBeGreaterThan(50)

    // Summary should start with content from the article, not sidebar or nav
    expect(summary).toContain("Web accessibility")
  })
})
