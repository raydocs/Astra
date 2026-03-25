import { describe, expect, it } from "vitest"

import {
  injectTranslation,
  removeTranslationFor,
  replaceLoading,
  showLoading,
} from "./inject"

describe("inject helpers", () => {
  it("allows nested blocks to own separate translation wrappers", () => {
    document.body.innerHTML = `
      <div id="parent">
        <p id="child">Hello</p>
      </div>
    `

    const parent = document.getElementById("parent") as HTMLElement
    const child = document.getElementById("child") as HTMLElement

    injectTranslation(child, "你好")
    injectTranslation(parent, "父级翻译")

    expect(child.querySelector("[data-astra-translation]")).not.toBeNull()
    expect(parent.querySelector(":scope > [data-astra-translation]")).not.toBeNull()
  })

  it("removes only wrappers owned by the current element", () => {
    document.body.innerHTML = `
      <div id="parent">
        <p id="child">Hello</p>
      </div>
    `

    const parent = document.getElementById("parent") as HTMLElement
    const child = document.getElementById("child") as HTMLElement

    injectTranslation(child, "你好")
    injectTranslation(parent, "父级翻译")
    removeTranslationFor(parent)

    expect(parent.querySelector(":scope > [data-astra-translation]")).toBeNull()
    expect(child.querySelector("[data-astra-translation]")).not.toBeNull()
  })

  it("hides the original content in translation-only mode and restores it on cleanup", () => {
    document.body.innerHTML = `<p id="target">Hello world</p>`
    const target = document.getElementById("target") as HTMLElement

    showLoading(target, { mode: "translation-only" })
    expect(target.querySelector("[data-astra-source]"))?.not.toBeNull()
    expect(target.textContent).toContain("Hello world")

    replaceLoading(target, "你好世界", { mode: "translation-only" })
    const source = target.querySelector("[data-astra-source]") as HTMLElement
    expect(source.getAttribute("data-astra-source-hidden")).toBe("1")
    expect(target.querySelector("[data-astra-translation='1']")).not.toBeNull()

    removeTranslationFor(target)
    expect(target.querySelector("[data-astra-source]")).toBeNull()
    expect(target.textContent).toContain("Hello world")
  })
})
