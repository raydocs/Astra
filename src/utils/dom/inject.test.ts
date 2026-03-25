import { describe, expect, it } from "vitest"

import {
  injectTranslation,
  removeTranslationFor,
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
})
