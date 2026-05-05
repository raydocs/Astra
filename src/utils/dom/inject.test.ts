import { describe, expect, it } from "vitest"

import {
  injectTranslation,
  removeAndReload,
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

  it("removeAndReload clears existing translation and shows new loading", () => {
    const el = document.createElement("p")
    el.textContent = "Original text"
    document.body.appendChild(el)

    // First: inject a completed translation
    injectTranslation(el, "Translated text", { mode: "bilingual", theme: "default" })
    expect(el.querySelector("[data-astra-translation='1']")).not.toBeNull()

    // Now: remove and reload for re-translation
    removeAndReload(el, { mode: "bilingual", theme: "default" })

    // Old translation should be gone
    expect(el.querySelector("[data-astra-translation='1']")).toBeNull()
    // New loading should be present
    expect(el.querySelector("[data-astra-translation='loading']")).not.toBeNull()
    // Source text should be accessible
    expect(el.textContent).toContain("Original text")
  })

  it("removeAndReload works on element with loading wrapper", () => {
    const el = document.createElement("p")
    el.textContent = "Original text"
    document.body.appendChild(el)

    showLoading(el, { mode: "bilingual" })
    removeAndReload(el, { mode: "bilingual" })

    // Should have exactly one loading wrapper
    const loadings = el.querySelectorAll("[data-astra-translation='loading']")
    expect(loadings.length).toBe(1)
  })

  it("removeAndReload works on element with no previous translation", () => {
    const el = document.createElement("p")
    el.textContent = "Fresh text"
    document.body.appendChild(el)

    removeAndReload(el, { mode: "bilingual" })

    expect(el.querySelector("[data-astra-translation='loading']")).not.toBeNull()
    expect(el.textContent).toContain("Fresh text")
  })

  it("applies the mask theme class while preserving translation wrapper classes", () => {
    const el = document.createElement("p")
    el.textContent = "Original text"
    document.body.appendChild(el)

    injectTranslation(el, "Masked text", { mode: "bilingual", theme: "mask" })

    const wrapper = el.querySelector("[data-astra-translation='1']") as HTMLElement
    expect(wrapper).not.toBeNull()
    expect(wrapper.classList.contains("notranslate")).toBe(true)
    expect(wrapper.classList.contains("astra-translation")).toBe(true)
    expect(wrapper.classList.contains("astra-mode-bilingual")).toBe(true)
    expect(wrapper.classList.contains("astra-theme-mask")).toBe(true)
  })

  it("accepts DocumentFragment translation content", () => {
    document.body.innerHTML = `<p id="target">Hello world</p>`
    const target = document.getElementById("target") as HTMLElement
    const fragment = document.createDocumentFragment()
    const strong = document.createElement("strong")
    strong.textContent = "你好"
    fragment.append("请", strong, "阅读")

    injectTranslation(target, fragment)

    const inner = target.querySelector(".astra-translation-inner")
    expect(inner?.textContent).toBe("请你好阅读")
    expect(inner?.querySelector("strong")?.textContent).toBe("你好")
  })

  it("removeTranslationFor restores source wrapper in translation-only mode", () => {
    const el = document.createElement("p")
    el.textContent = "Source text"
    document.body.appendChild(el)

    replaceLoading(el, "Translated", { mode: "translation-only", theme: "default" })

    // Source should be hidden
    const sourceWrapper = el.querySelector("[data-astra-source]")
    expect(sourceWrapper).not.toBeNull()
    expect(sourceWrapper?.getAttribute("data-astra-source-hidden")).toBe("1")

    // Remove translation
    removeTranslationFor(el)

    // Source wrapper should be gone, text restored
    expect(el.querySelector("[data-astra-source]")).toBeNull()
    expect(el.querySelector("[data-astra-translation]")).toBeNull()
    expect(el.textContent).toContain("Source text")
  })
})
