import { describe, expect, it } from "vitest"

import {
  buildContentSummary,
  collectTextBlocks,
  collectTextBlocksFromRoot,
  extractTextBlockText,
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

  it("skips code, math, canvas, and ad-like regions by default", () => {
    document.body.innerHTML = `
      <main>
        <p>Use <code>const secret = 1</code> carefully.</p>
        <pre>console.log('do not translate')</pre>
        <math><mi>x</mi><mo>=</mo><mn>1</mn></math>
        <canvas>Canvas fallback</canvas>
        <div class="ad-slot"><p>Sponsored paragraph</p></div>
        <section aria-label="Advertisement"><p>Promoted paragraph</p></section>
        <p>Translate me</p>
      </main>
    `

    const blocks = collectTextBlocks(findContentRoot(document))
    expect(blocks.map((block) => block.text)).toEqual([
      "Use carefully.",
      "Translate me",
    ])
  })

  it("keeps immersive landmark skips by default but includes landmarks for full-page collection", () => {
    document.body.innerHTML = `
      <header><h1>Header title</h1></header>
      <nav><ul><li><a href="/">Navigation item</a></li></ul></nav>
      <main><p>Main readable paragraph</p></main>
      <aside role="complementary"><p>Aside readable paragraph</p></aside>
      <footer role="contentinfo"><p>Footer readable paragraph</p></footer>
    `

    expect(collectTextBlocks(document.body).map((block) => block.text)).toEqual([
      "Main readable paragraph",
    ])
    expect(collectTextBlocks(document.body, { includeLandmarkContent: true }).map((block) => block.text)).toEqual([
      "Header title",
      "Navigation item",
      "Main readable paragraph",
      "Aside readable paragraph",
      "Footer readable paragraph",
    ])
  })

  it("collects text blocks from open shadow roots", () => {
    document.body.innerHTML = `
      <main>
        <article>
          <p>Light DOM paragraph</p>
          <astra-card id="shadow-host"></astra-card>
        </article>
      </main>
    `
    const host = document.getElementById("shadow-host") as HTMLElement
    const shadow = host.attachShadow({ mode: "open" })
    shadow.innerHTML = `
      <section>
        <p id="shadow-paragraph">Shadow paragraph text</p>
      </section>
    `

    const blocks = collectTextBlocks(findContentRoot(document))
    expect(blocks.map((block) => block.text)).toEqual([
      "Light DOM paragraph",
      "Shadow paragraph text",
    ])
  })

  it("collects text blocks through the named root-based API", () => {
    document.body.innerHTML = `<main><astra-card id="shadow-host"></astra-card></main>`
    const host = document.getElementById("shadow-host") as HTMLElement
    const shadow = host.attachShadow({ mode: "open" })
    shadow.innerHTML = `<section><p>Named root shadow text</p></section>`

    expect(collectTextBlocksFromRoot(document).map((block) => block.text)).toEqual(["Named root shadow text"])
    expect(collectTextBlocksFromRoot(shadow).map((block) => block.text)).toEqual(["Named root shadow text"])
  })

  it("finds the closest text block across an open shadow boundary", () => {
    document.body.innerHTML = `
      <main>
        <article>
          <astra-card id="shadow-host"></astra-card>
        </article>
      </main>
    `
    const host = document.getElementById("shadow-host") as HTMLElement
    const shadow = host.attachShadow({ mode: "open" })
    shadow.innerHTML = `<p id="shadow-target">Shadow <span id="shadow-inline">inline</span> text</p>`

    const inline = shadow.getElementById("shadow-inline")
    const block = findClosestTextBlock(inline, findContentRoot(document))

    expect(block?.element.id).toBe("shadow-target")
    expect(block?.text).toBe("Shadow inline text")
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

  it("reads preserved source wrapper text even when the wrapper is hidden", () => {
    document.body.innerHTML = `
      <main>
        <p id="target"><span data-astra-source="1" style="display:none">Hello hidden source</span><span data-astra-translation="1">你好</span></p>
      </main>
    `

    const target = document.getElementById("target") as HTMLElement
    expect(extractTextBlockText(target)).toBe("Hello hidden source")
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
