import { describe, expect, it } from "vitest"

import {
  buildContentSummary,
  collectTextBlocks,
  findClosestTextBlock,
  findContentRoot,
} from "./traversal"

describe("collectTextBlocks", () => {
  it("avoids parent-child duplicate capture", () => {
    document.body.innerHTML = `
      <main>
        <div>
          <p>First paragraph</p>
          <p>Second paragraph</p>
        </div>
      </main>
    `

    const blocks = collectTextBlocks(findContentRoot(document))

    expect(blocks.map((block) => block.text)).toEqual([
      "First paragraph",
      "Second paragraph",
    ])
  })

  it("extracts direct text plus inline descendants", () => {
    document.body.innerHTML = `
      <main>
        <div>Hello <span>world</span></div>
      </main>
    `

    const blocks = collectTextBlocks(findContentRoot(document))
    expect(blocks.map((block) => block.text)).toEqual(["Hello world"])
  })

  it("skips interactive and editable nodes", () => {
    document.body.innerHTML = `
      <main>
        <button>Skip me</button>
        <div contenteditable="true">Editable</div>
        <p>Translate me</p>
      </main>
    `

    const blocks = collectTextBlocks(findContentRoot(document))
    expect(blocks.map((block) => block.text)).toEqual(["Translate me"])
  })

  it("ignores Astra translation wrappers when extracting text", () => {
    document.body.innerHTML = `
      <main>
        <p>Hello<span data-astra-translation="1" class="notranslate">你好</span></p>
      </main>
    `

    const blocks = collectTextBlocks(findContentRoot(document))
    expect(blocks.map((block) => block.text)).toEqual(["Hello"])
  })

  it("builds a deduplicated content summary", () => {
    const blocks = [
      { element: document.createElement("p"), text: "First paragraph" },
      { element: document.createElement("p"), text: "First paragraph" },
      { element: document.createElement("p"), text: "Second paragraph" },
    ]

    expect(buildContentSummary(blocks, { maxBlocks: 2, maxChars: 80 })).toBe(
      "First paragraph Second paragraph",
    )
  })

  it("finds the closest candidate text block from a hovered inline node", () => {
    document.body.innerHTML = `
      <main>
        <article>
          <p id="target">Hello <span id="inline">hover me</span></p>
        </article>
      </main>
    `

    const inline = document.getElementById("inline")
    const block = findClosestTextBlock(inline, findContentRoot(document))

    expect(block?.element.id).toBe("target")
    expect(block?.text).toBe("Hello hover me")
  })

  it("returns null when the hovered node is inside skipped content", () => {
    document.body.innerHTML = `
      <main>
        <button><span id="inside-button">Do not translate</span></button>
        <p>Translate me</p>
      </main>
    `

    const target = document.getElementById("inside-button")
    const block = findClosestTextBlock(target, findContentRoot(document))

    expect(block).toBeNull()
  })
})
