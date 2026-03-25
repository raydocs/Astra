import { ASTRA_TRANSLATION_SELECTOR } from "./inject"

export interface TextBlock {
  element: HTMLElement
  text: string
}

export interface CollectOptions {
  minTextLength?: number
}

export interface BuildContentSummaryOptions {
  maxBlocks?: number
  maxChars?: number
}

const SKIP_TAGS = new Set([
  "SCRIPT", "STYLE", "NOSCRIPT", "IFRAME", "OBJECT", "EMBED",
  "SVG", "CANVAS", "TEMPLATE", "TEXTAREA", "INPUT", "SELECT",
  "VIDEO", "AUDIO", "IMG", "BR", "HR", "BUTTON", "SUMMARY",
  "DETAILS", "NAV", "FOOTER", "ASIDE", "HEADER",
])

const INTERACTIVE_ROLES = new Set([
  "button", "menuitem", "tab", "option", "switch", "textbox",
  "searchbox", "combobox", "link", "navigation", "banner",
  "contentinfo", "complementary",
])

const MAIN_CONTENT_SELECTORS = [
  "article",
  "main",
  "[role=\"main\"]",
  ".post-content",
  ".article-content",
  ".entry-content",
  ".content",
  "#content",
]

const PRIMARY_BLOCK_TAGS = new Set([
  "P", "LI", "BLOCKQUOTE", "FIGCAPTION", "CAPTION",
  "TD", "TH", "DD", "DT", "H1", "H2", "H3", "H4", "H5", "H6",
])

const FALLBACK_CONTAINER_TAGS = new Set(["DIV", "SECTION", "ARTICLE"])

const INLINE_TAGS = new Set([
  "A", "ABBR", "B", "BDI", "BDO", "CITE", "DATA", "DEL", "DFN",
  "EM", "I", "INS", "KBD", "MARK", "Q", "RP", "RT", "RUBY", "S",
  "SAMP", "SMALL", "SPAN", "STRONG", "SUB", "SUP", "TIME", "U",
  "VAR", "WBR", "LABEL", "CODE",
])

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim()
}

function isVisible(el: HTMLElement): boolean {
  if (!el.isConnected) return false
  const style = getComputedStyle(el)
  return style.display !== "none" && style.visibility !== "hidden"
}

function isInline(el: HTMLElement): boolean {
  if (INLINE_TAGS.has(el.tagName)) return true
  return getComputedStyle(el).display.startsWith("inline")
}

function shouldSkip(el: HTMLElement): boolean {
  if (SKIP_TAGS.has(el.tagName)) return true
  if (el.matches(ASTRA_TRANSLATION_SELECTOR) || el.closest(ASTRA_TRANSLATION_SELECTOR)) return true
  if (el.getAttribute("translate") === "no" || el.classList.contains("notranslate")) return true
  if (el.isContentEditable || el.getAttribute("contenteditable") === "true") return true

  const role = el.getAttribute("role")
  if (role && INTERACTIVE_ROLES.has(role)) return true

  return false
}

function collectInlineText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? ""
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return ""

  const el = node as HTMLElement
  if (shouldSkip(el) || !isInline(el) || !isVisible(el)) return ""

  return Array.from(el.childNodes).map(collectInlineText).join(" ")
}

function extractDirectText(el: HTMLElement): string {
  return normalizeWhitespace(Array.from(el.childNodes).map(collectInlineText).join(" "))
}

function hasDirectBlockChild(el: HTMLElement): boolean {
  return Array.from(el.children).some(
    (child) => child instanceof HTMLElement && !shouldSkip(child) && !isInline(child),
  )
}

function isCandidateElement(el: HTMLElement): boolean {
  if (PRIMARY_BLOCK_TAGS.has(el.tagName)) return true
  return FALLBACK_CONTAINER_TAGS.has(el.tagName) && !hasDirectBlockChild(el)
}

export function findContentRoot(doc: Document = document): HTMLElement {
  for (const selector of MAIN_CONTENT_SELECTORS) {
    const el = doc.querySelector<HTMLElement>(selector)
    if (el) return el
  }

  return doc.body
}

export function findClosestTextBlock(
  startNode: Node | null,
  root: HTMLElement = findContentRoot(document),
  options: CollectOptions = {},
): TextBlock | null {
  const { minTextLength = 2 } = options
  const startElement = startNode instanceof HTMLElement
    ? startNode
    : startNode?.parentElement ?? null

  if (!startElement || !root.contains(startElement)) {
    return null
  }

  let current: HTMLElement | null = startElement
  while (current && current !== root.parentElement) {
    if (current !== root && !root.contains(current)) {
      return null
    }

    if (!shouldSkip(current) && isVisible(current) && isCandidateElement(current)) {
      const text = extractDirectText(current)
      if (text.length >= minTextLength) {
        return { element: current, text }
      }
    }

    if (current === root) break
    current = current.parentElement
  }

  return null
}

export function collectTextBlocks(
  root: HTMLElement,
  options: CollectOptions = {},
): TextBlock[] {
  const { minTextLength = 2 } = options
  const blocks: TextBlock[] = []

  function walk(node: HTMLElement) {
    if (shouldSkip(node)) return
    if (node !== root && !isVisible(node)) return

    if (isCandidateElement(node)) {
      const text = extractDirectText(node)
      if (text.length >= minTextLength) {
        blocks.push({ element: node, text })
      }
    }

    for (const child of node.children) {
      if (child instanceof HTMLElement) {
        walk(child)
      }
    }
  }

  walk(root)
  return blocks
}

export function buildContentSummary(
  blocks: TextBlock[],
  options: BuildContentSummaryOptions = {},
): string | null {
  const { maxBlocks = 6, maxChars = 800 } = options
  const seen = new Set<string>()
  const parts: string[] = []
  let charCount = 0

  for (const block of blocks) {
    const text = normalizeWhitespace(block.text)
    if (!text || seen.has(text)) continue

    const remaining = maxChars - charCount
    if (remaining <= 0) break

    const next = text.length > remaining ? `${text.slice(0, remaining).trim()}…` : text
    parts.push(next)
    seen.add(text)
    charCount += next.length + 1

    if (parts.length >= maxBlocks || charCount >= maxChars) {
      break
    }
  }

  return parts.length > 0 ? parts.join(" ") : null
}
