const ASTRA_TRANSLATION_ATTR = "data-astra-translation"
const ASTRA_SOURCE_ATTR = "data-astra-source"

const INLINE_TAGS = new Set([
  "A", "ABBR", "B", "BDI", "BDO", "CITE", "CODE", "DATA", "DEL", "DFN",
  "EM", "I", "INS", "KBD", "LABEL", "MARK", "Q", "RP", "RT", "RUBY", "S",
  "SAMP", "SMALL", "SPAN", "STRONG", "SUB", "SUP", "TIME", "U", "VAR", "WBR",
])

const PRESERVED_INLINE_TAGS = new Set([
  "strong",
  "em",
  "code",
  "b",
  "i",
  "mark",
  "small",
  "sub",
  "sup",
  "u",
  "s",
])

const PLACEHOLDER_RE = /__ASTRA_RT_(\d+)_(OPEN_([A-Z]+)|CLOSE)__/g

export interface RichTextPlaceholderDefinition {
  id: number
  tagName: string
}

export interface RichTextSerialization {
  plainText: string
  requestText: string
  hasPlaceholders: boolean
}

export interface RichTextDecodeResult {
  fragment: DocumentFragment | null
  fallbackText: string | null
  usedFallback: boolean
  leakedTokenCount: number
  restoredTagCount: number
}

function normalizeWhitespace(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/\s+([.,!?;:。，！？；：])/g, "$1")
    .replace(/([\u4E00-\u9FFF])\s+([\u4E00-\u9FFF])/g, "$1$2")
    .trim()
}

function isVisible(el: HTMLElement): boolean {
  if (!el.isConnected) return false
  const style = getComputedStyle(el)
  return style.display !== "none" && style.visibility !== "hidden"
}

function isInlineElement(el: HTMLElement): boolean {
  if (INLINE_TAGS.has(el.tagName)) return true
  return getComputedStyle(el).display.startsWith("inline")
}

function shouldSkip(el: HTMLElement): boolean {
  if (el.hasAttribute(ASTRA_TRANSLATION_ATTR)) return true
  if (el.getAttribute("translate") === "no" || el.classList.contains("notranslate")) return true
  if (el.isContentEditable || el.getAttribute("contenteditable") === "true") return true
  return false
}

function normalizePreservedTag(tagName: string): string | null {
  const normalized = tagName.toLowerCase()
  return PRESERVED_INLINE_TAGS.has(normalized) ? normalized : null
}

function buildOpenToken(id: number, tagName: string): string {
  return `__ASTRA_RT_${id}_OPEN_${tagName.toUpperCase()}__`
}

function buildCloseToken(id: number): string {
  return `__ASTRA_RT_${id}_CLOSE__`
}

function extractPlainText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? ""
  }

  if (!(node instanceof HTMLElement)) return ""
  if (!isVisible(node)) return ""
  if (node.hasAttribute(ASTRA_SOURCE_ATTR)) {
    return Array.from(node.childNodes).map(extractPlainText).join(" ")
  }
  if (shouldSkip(node) || !isInlineElement(node)) return ""
  return Array.from(node.childNodes).map(extractPlainText).join(" ")
}

export function serializeRichTextForTranslation(element: HTMLElement): RichTextSerialization {
  const placeholders: RichTextPlaceholderDefinition[] = []

  function serializeNode(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent ?? ""
    }

    if (!(node instanceof HTMLElement)) return ""
    if (!isVisible(node)) return ""

    if (node.hasAttribute(ASTRA_SOURCE_ATTR)) {
      return Array.from(node.childNodes).map(serializeNode).join("")
    }

    if (shouldSkip(node) || !isInlineElement(node)) return ""

    const childText = Array.from(node.childNodes).map(serializeNode).join("")
    if (!childText.trim()) return childText

    const preservedTag = normalizePreservedTag(node.tagName)
    if (!preservedTag) return childText

    const id = placeholders.length
    placeholders.push({ id, tagName: preservedTag })
    return `${buildOpenToken(id, preservedTag)}${childText}${buildCloseToken(id)}`
  }

  const plainText = normalizeWhitespace(Array.from(element.childNodes).map(extractPlainText).join(" "))
  const requestText = normalizeWhitespace(Array.from(element.childNodes).map(serializeNode).join(" "))

  return {
    plainText,
    requestText,
    hasPlaceholders: placeholders.length > 0,
  }
}

export function countRichTextPlaceholders(text: string): number {
  if (!text) return 0
  return Array.from(text.matchAll(PLACEHOLDER_RE)).length
}

export function containsRichTextPlaceholders(text: string): boolean {
  return countRichTextPlaceholders(text) > 0
}

export function stripRichTextPlaceholders(text: string): string {
  return normalizeWhitespace(text.replace(PLACEHOLDER_RE, " "))
}

function parsePlaceholderDefinitions(text: string): Map<number, RichTextPlaceholderDefinition> {
  const definitions = new Map<number, RichTextPlaceholderDefinition>()

  for (const match of text.matchAll(PLACEHOLDER_RE)) {
    const id = Number(match[1])
    const openTag = match[3]?.toLowerCase()
    if (!openTag) continue

    if (!definitions.has(id)) {
      definitions.set(id, { id, tagName: openTag })
    }
  }

  return definitions
}

export function decodeRichTextTranslation(
  translatedText: string,
  requestText: string,
): RichTextDecodeResult {
  const definitions = parsePlaceholderDefinitions(requestText)
  if (definitions.size === 0) {
    return {
      fragment: null,
      fallbackText: null,
      usedFallback: false,
      leakedTokenCount: 0,
      restoredTagCount: 0,
    }
  }

  const root = document.createDocumentFragment()
  const stack: Array<DocumentFragment | HTMLElement> = [root]
  const usedIds = new Set<number>()
  let restoredTagCount = 0
  let lastIndex = 0

  const fallback = (): RichTextDecodeResult => ({
    fragment: null,
    fallbackText: stripRichTextPlaceholders(translatedText),
    usedFallback: true,
    leakedTokenCount: countRichTextPlaceholders(translatedText),
    restoredTagCount: 0,
  })

  for (const match of translatedText.matchAll(PLACEHOLDER_RE)) {
    const index = match.index ?? 0
    const textChunk = translatedText.slice(lastIndex, index)
    if (textChunk) {
      stack.at(-1)?.appendChild(document.createTextNode(textChunk))
    }

    const id = Number(match[1])
    const openTag = match[3]?.toLowerCase()
    const definition = definitions.get(id)
    if (!definition) return fallback()

    if (openTag) {
      if (definition.tagName !== openTag || usedIds.has(id)) return fallback()
      usedIds.add(id)
      const el = document.createElement(definition.tagName)
      stack.at(-1)?.appendChild(el)
      stack.push(el)
      restoredTagCount += 1
    } else {
      const current = stack.at(-1)
      if (!(current instanceof HTMLElement)) return fallback()
      if (current.tagName.toLowerCase() !== definition.tagName) return fallback()
      stack.pop()
    }

    lastIndex = index + match[0].length
  }

  const trailingText = translatedText.slice(lastIndex)
  if (trailingText) {
    stack.at(-1)?.appendChild(document.createTextNode(trailingText))
  }

  if (stack.length !== 1) return fallback()
  if (usedIds.size !== definitions.size) return fallback()

  return {
    fragment: root,
    fallbackText: null,
    usedFallback: false,
    leakedTokenCount: 0,
    restoredTagCount,
  }
}

export function getRichTextPlaceholderPromptFragment(): string {
  return [
    "Some input texts may contain Astra rich-text placeholders such as __ASTRA_RT_0_OPEN_STRONG__ ... __ASTRA_RT_0_CLOSE__.",
    "These placeholders are structural markers, not user-visible text.",
    "Preserve every placeholder token exactly as written and in a valid nested order.",
    "Do not translate, rename, remove, duplicate, or invent placeholder tokens.",
  ].join(" ")
}
