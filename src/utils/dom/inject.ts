/**
 * Translation injection helpers.
 */

import type { TranslationMode, TranslationTheme } from "@/types/config"

export const ASTRA_TRANSLATION_ATTR = "data-astra-translation"
export const ASTRA_TRANSLATION_SELECTOR = `[${ASTRA_TRANSLATION_ATTR}]`
export const ASTRA_SOURCE_ATTR = "data-astra-source"
export const ASTRA_SOURCE_SELECTOR = `[${ASTRA_SOURCE_ATTR}]`
export const ASTRA_SOURCE_HIDDEN_ATTR = "data-astra-source-hidden"

export interface InjectOptions {
  mode?: TranslationMode
  theme?: TranslationTheme
  targetLang?: string
}

export type InjectedTranslationContent = string | DocumentFragment

function getDirectTranslationWrappers(element: HTMLElement): HTMLElement[] {
  return Array.from(element.children).filter(
    (child): child is HTMLElement =>
      child instanceof HTMLElement && child.hasAttribute(ASTRA_TRANSLATION_ATTR),
  )
}

export function hasInjectedTranslation(element: HTMLElement): boolean {
  return getDirectTranslationWrappers(element).length > 0
}

function getDirectLoadingWrapper(element: HTMLElement): HTMLElement | null {
  return getDirectTranslationWrappers(element).find(
    (child) => child.getAttribute(ASTRA_TRANSLATION_ATTR) === "loading",
  ) ?? null
}

function getDirectSourceWrapper(element: HTMLElement): HTMLElement | null {
  return Array.from(element.children).find(
    (child): child is HTMLElement =>
      child instanceof HTMLElement && child.hasAttribute(ASTRA_SOURCE_ATTR),
  ) ?? null
}

function createWrapper(
  state: "loading" | "1",
  content: InjectedTranslationContent,
  { theme = "default", targetLang = "zh-CN", mode = "bilingual" }: InjectOptions = {},
) {
  const wrapper = document.createElement("span")
  wrapper.className = `notranslate astra-translation astra-theme-${theme} astra-mode-${mode}`
  wrapper.setAttribute("translate", "no")
  wrapper.setAttribute(ASTRA_TRANSLATION_ATTR, state)
  wrapper.setAttribute("lang", targetLang)

  const inner = document.createElement("span")
  inner.className = "notranslate astra-translation-inner"
  if (typeof content === "string") {
    inner.textContent = content
  } else {
    inner.replaceChildren()
    inner.appendChild(content)
  }

  wrapper.appendChild(inner)
  return wrapper
}

function shouldUseBlockWrapper(element: HTMLElement): boolean {
  return Array.from(element.children).some((child) => {
    if (!(child instanceof HTMLElement)) return false
    const display = getComputedStyle(child).display
    return !display.startsWith("inline")
  })
}

function ensureSourceWrapper(element: HTMLElement): HTMLElement {
  const existing = getDirectSourceWrapper(element)
  if (existing) return existing

  const sourceWrapper = document.createElement(shouldUseBlockWrapper(element) ? "div" : "span")
  sourceWrapper.className = "astra-source"
  sourceWrapper.setAttribute(ASTRA_SOURCE_ATTR, "1")

  const nodesToMove = Array.from(element.childNodes).filter((child) => {
    if (!(child instanceof HTMLElement)) return true
    return !child.hasAttribute(ASTRA_TRANSLATION_ATTR) && !child.hasAttribute(ASTRA_SOURCE_ATTR)
  })

  nodesToMove.forEach((node) => {
    sourceWrapper.appendChild(node)
  })

  element.insertBefore(sourceWrapper, element.firstChild)
  return sourceWrapper
}

function setSourceHidden(element: HTMLElement, hidden: boolean) {
  const sourceWrapper = getDirectSourceWrapper(element)
  if (!sourceWrapper) return

  if (hidden) {
    sourceWrapper.setAttribute(ASTRA_SOURCE_HIDDEN_ATTR, "1")
    sourceWrapper.setAttribute("aria-hidden", "true")
  } else {
    sourceWrapper.removeAttribute(ASTRA_SOURCE_HIDDEN_ATTR)
    sourceWrapper.removeAttribute("aria-hidden")
  }
}

function unwrapSourceWrapper(element: HTMLElement) {
  const sourceWrapper = getDirectSourceWrapper(element)
  if (!sourceWrapper) return

  sourceWrapper.removeAttribute(ASTRA_SOURCE_HIDDEN_ATTR)
  while (sourceWrapper.firstChild) {
    element.insertBefore(sourceWrapper.firstChild, sourceWrapper)
  }
  sourceWrapper.remove()
}

export function injectTranslation(
  originalElement: HTMLElement,
  translatedContent: InjectedTranslationContent,
  options: InjectOptions = {},
) {
  if (getDirectTranslationWrappers(originalElement).length > 0) return

  const wrapper = createWrapper("1", translatedContent, options)
  if (options.mode === "translation-only") {
    ensureSourceWrapper(originalElement)
    setSourceHidden(originalElement, true)
  }

  originalElement.appendChild(wrapper)
}

export function showLoading(element: HTMLElement, options: InjectOptions = {}) {
  if (getDirectTranslationWrappers(element).length > 0) return

  if (options.mode === "translation-only") {
    ensureSourceWrapper(element)
    setSourceHidden(element, false)
  }

  const wrapper = createWrapper("loading", "⋯", options)
  wrapper.classList.add("astra-loading")
  wrapper.querySelector(".astra-translation-inner")?.classList.add("astra-loading-dots")

  element.appendChild(wrapper)
}

export function replaceLoading(
  element: HTMLElement,
  translatedContent: InjectedTranslationContent,
  options: InjectOptions = {},
) {
  const existing = getDirectLoadingWrapper(element)

  if (options.mode === "translation-only") {
    ensureSourceWrapper(element)
    setSourceHidden(element, true)
  }

  if (existing) {
    const { theme = "default", targetLang = "zh-CN", mode = "bilingual" } = options
    existing.className = `notranslate astra-translation astra-theme-${theme} astra-mode-${mode}`
    existing.setAttribute(ASTRA_TRANSLATION_ATTR, "1")
    existing.setAttribute("lang", targetLang)
    const inner = existing.querySelector(".astra-translation-inner")
    if (inner) {
      if (typeof translatedContent === "string") {
        inner.textContent = translatedContent
      } else {
        inner.replaceChildren()
        inner.appendChild(translatedContent)
      }
      inner.classList.remove("astra-loading-dots")
    }
  } else {
    injectTranslation(element, translatedContent, options)
  }
}

export function clearLoading(element: HTMLElement) {
  getDirectLoadingWrapper(element)?.remove()
  setSourceHidden(element, false)
}

export function removeTranslationFor(element: HTMLElement) {
  getDirectTranslationWrappers(element).forEach((node) => node.remove())
  unwrapSourceWrapper(element)
}

export function removeAndReload(element: HTMLElement, options: InjectOptions = {}) {
  removeTranslationFor(element)
  showLoading(element, options)
}

export function removeAllTranslations() {
  document.querySelectorAll(ASTRA_TRANSLATION_SELECTOR).forEach((el) => el.remove())
  document.querySelectorAll(ASTRA_SOURCE_SELECTOR).forEach((el) => {
    if (!(el instanceof HTMLElement)) return
    const parent = el.parentElement
    if (!parent) return
    while (el.firstChild) {
      parent.insertBefore(el.firstChild, el)
    }
    el.remove()
  })
}
