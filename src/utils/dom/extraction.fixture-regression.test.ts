import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { beforeEach, describe, expect, it } from "vitest"

import { resolveExtractionPlan } from "./extraction"

const FIXTURE_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../test/fixtures/pages",
)

function loadFixture(name: string): string {
  return readFileSync(path.join(FIXTURE_ROOT, `${name}.html`), "utf8")
}

describe("readability regression fixtures", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
  })

  it.each([
    ["docs-sidebar-heavy", "docs-article", "Contextual translation pipeline"],
    ["knowledge-base-longform", "guide-body", "Troubleshooting provider failures"],
    ["blog-comments-mixed", "blog-article", "Shipping inline explanations without UI clutter"],
  ])("keeps %s classified as article content", (fixtureName, expectedRootId, expectedHeading) => {
    document.body.innerHTML = loadFixture(fixtureName)

    const plan = resolveExtractionPlan(document, "article")

    expect(plan.scope).toBe("article")
    expect(plan.root.id).toBe(expectedRootId)
    expect(plan.root.textContent).toContain(expectedHeading)
  })

  it("does not let comments leak into the blog article fixture", () => {
    document.body.innerHTML = loadFixture("blog-comments-mixed")

    const plan = resolveExtractionPlan(document, "article")
    const allText = plan.blocks.map(block => block.text).join(" ")

    expect(plan.scope).toBe("article")
    expect(allText).toContain("Inline explanation cards need to appear fast enough")
    expect(allText).not.toContain("@maya")
    expect(allText).not.toContain("@leo")
  })

  it.each([
    "forum-thread",
    "auth-form-layout",
    "feed-card-list",
    "marketing-landing",
  ])("keeps %s on page scope instead of forcing an article root", (fixtureName) => {
    document.body.innerHTML = loadFixture(fixtureName)

    const plan = resolveExtractionPlan(document, "article")

    expect(plan.scope).toBe("page")
    expect(plan.root.tagName).toBe("BODY")
    expect(plan.blocks.length).toBeGreaterThan(0)
  })
})
