import { describe, expect, it } from "vitest"

import { collectTextBlocks, findContentRoot } from "./traversal"

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
})
