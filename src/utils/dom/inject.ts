/**
 * Bilingual injection — insert translations below original paragraphs.
 */

export const ASTRA_TRANSLATION_ATTR = "data-astra-translation"
export const ASTRA_TRANSLATION_SELECTOR = `[${ASTRA_TRANSLATION_ATTR}]`

export type TranslationTheme = "default" | "underline" | "highlight"

export interface InjectOptions {
  theme?: TranslationTheme
  targetLang?: string
}

function getDirectTranslationWrappers(element: HTMLElement): HTMLElement[] {
  return Array.from(element.children).filter(
    (child): child is HTMLElement =>
      child instanceof HTMLElement && child.hasAttribute(ASTRA_TRANSLATION_ATTR),
  )
}

function getDirectLoadingWrapper(element: HTMLElement): HTMLElement | null {
  return getDirectTranslationWrappers(element).find(
    (child) => child.getAttribute(ASTRA_TRANSLATION_ATTR) === "loading",
  ) ?? null
}

function createWrapper(
  state: "loading" | "1",
  text: string,
  { theme = "default", targetLang = "zh-CN" }: InjectOptions = {},
) {
  const wrapper = document.createElement("span")
  wrapper.className = `notranslate astra-translation astra-theme-${theme}`
  wrapper.setAttribute("translate", "no")
  wrapper.setAttribute(ASTRA_TRANSLATION_ATTR, state)
  wrapper.setAttribute("lang", targetLang)

  const inner = document.createElement("span")
  inner.className = "notranslate astra-translation-inner"
  inner.textContent = text

  wrapper.appendChild(inner)
  return wrapper
}

/**
 * Inject translated text below the original element (bilingual display).
 */
export function injectTranslation(
  originalElement: HTMLElement,
  translatedText: string,
  options: InjectOptions = {},
) {
  // Skip if already has translation
  if (getDirectTranslationWrappers(originalElement).length > 0) return

  const wrapper = createWrapper("1", translatedText, options)

  originalElement.appendChild(wrapper)
}

/**
 * Show loading state on an element.
 */
export function showLoading(element: HTMLElement) {
  if (getDirectTranslationWrappers(element).length > 0) return

  const wrapper = createWrapper("loading", "⋯")
  wrapper.classList.add("astra-loading")
  wrapper.querySelector(".astra-translation-inner")?.classList.add("astra-loading-dots")

  element.appendChild(wrapper)
}

/**
 * Replace loading state with actual translation.
 */
export function replaceLoading(
  element: HTMLElement,
  translatedText: string,
  options: InjectOptions = {},
) {
  const existing = getDirectLoadingWrapper(element)

  if (existing) {
    const { theme = "default", targetLang = "zh-CN" } = options
    existing.className = `notranslate astra-translation astra-theme-${theme}`
    existing.setAttribute(ASTRA_TRANSLATION_ATTR, "1")
    existing.setAttribute("lang", targetLang)
    const inner = existing.querySelector(".astra-translation-inner")
    if (inner) {
      inner.textContent = translatedText
      inner.classList.remove("astra-loading-dots")
    }
  } else {
    injectTranslation(element, translatedText, options)
  }
}

export function clearLoading(element: HTMLElement) {
  getDirectLoadingWrapper(element)?.remove()
}

export function removeTranslationFor(element: HTMLElement) {
  getDirectTranslationWrappers(element).forEach((node) => node.remove())
}

/**
 * Remove all Astra translations from the page.
 */
export function removeAllTranslations() {
  document.querySelectorAll(ASTRA_TRANSLATION_SELECTOR).forEach((el) => el.remove())
}
