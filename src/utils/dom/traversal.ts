import {
  ASTRA_SOURCE_ATTR,
  ASTRA_TRANSLATION_ATTR,
  ASTRA_TRANSLATION_SELECTOR,
} from "./inject"

export interface TextBlock {
  element: HTMLElement
  text: string
}

export interface CollectOptions {
  minTextLength?: number
  /**
   * Include page landmarks such as nav/header/footer/aside. The default keeps
   * the existing immersive-reader behavior; full-page translation opts in.
   */
  includeLandmarkContent?: boolean
}

export interface BuildContentSummaryOptions {
  maxBlocks?: number
  maxChars?: number
}

const UNSAFE_SKIP_TAGS = new Set([
  "SCRIPT", "STYLE", "NOSCRIPT", "IFRAME", "OBJECT", "EMBED",
  "SVG", "CANVAS", "TEMPLATE", "TEXTAREA", "INPUT", "SELECT",
  "VIDEO", "AUDIO", "IMG", "BR", "HR", "BUTTON", "SUMMARY",
  "DETAILS",
  "PRE", "CODE", "MATH",
])

const LANDMARK_SKIP_TAGS = new Set(["NAV", "FOOTER", "ASIDE", "HEADER"])

const INTERACTIVE_ROLES = new Set([
  "button", "menuitem", "tab", "option", "switch", "textbox",
  "searchbox", "combobox", "link",
])

const LANDMARK_ROLES = new Set(["navigation", "banner", "contentinfo", "complementary"])

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
  "VAR", "WBR", "LABEL",
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

function hasAdMarker(el: HTMLElement): boolean {
  const markerText = [
    el.id,
    el.getAttribute("aria-label"),
    el.getAttribute("data-testid"),
    el.getAttribute("data-ad"),
    el.getAttribute("data-ad-slot"),
  ].filter(Boolean).join(" ").toLowerCase()

  if (/\b(ad|ads|advert|advertisement|sponsored)\b/.test(markerText)) return true
  if (/^(ad|ads)[-_]/.test(el.id.toLowerCase())) return true

  return Array.from(el.classList).some((className) => {
    const normalized = className.toLowerCase()
    return normalized === "ad"
      || normalized === "ads"
      || normalized === "advertisement"
      || normalized === "sponsored"
      || normalized.startsWith("ad-")
      || normalized.startsWith("ads-")
      || normalized.includes("ad-slot")
  })
}

function isInsideAdRegion(el: HTMLElement): boolean {
  let current: HTMLElement | null = el
  while (current && current !== document.documentElement) {
    if (hasAdMarker(current)) return true
    current = getComposedParentElement(current)
  }
  return false
}

function getOpenShadowChildren(el: HTMLElement): HTMLElement[] {
  const shadowRoot = el.shadowRoot
  if (!shadowRoot) return []
  return Array.from(shadowRoot.children).filter((child): child is HTMLElement => child instanceof HTMLElement)
}

function getWalkableChildren(el: HTMLElement): HTMLElement[] {
  return [
    ...Array.from(el.children).filter((child): child is HTMLElement => child instanceof HTMLElement),
    ...getOpenShadowChildren(el),
  ]
}

function getComposedParentElement(el: HTMLElement): HTMLElement | null {
  if (el.parentElement) return el.parentElement
  const root = el.getRootNode()
  return root instanceof ShadowRoot ? root.host as HTMLElement : null
}

function isWithinRoot(root: HTMLElement, el: HTMLElement): boolean {
  if (root.contains(el)) return true
  const nodeRoot = el.getRootNode()
  return nodeRoot instanceof ShadowRoot && root.contains(nodeRoot.host)
}

function shouldSkip(el: HTMLElement, options: CollectOptions = {}): boolean {
  if (UNSAFE_SKIP_TAGS.has(el.tagName)) return true
  if (!options.includeLandmarkContent && LANDMARK_SKIP_TAGS.has(el.tagName)) return true
  if (isInsideAdRegion(el)) return true
  if (el.matches(ASTRA_TRANSLATION_SELECTOR) || el.closest(ASTRA_TRANSLATION_SELECTOR)) return true
  if (el.getAttribute("translate") === "no" || el.classList.contains("notranslate")) return true
  if (el.isContentEditable || el.getAttribute("contenteditable") === "true") return true

  const role = el.getAttribute("role")
  if (role && INTERACTIVE_ROLES.has(role)) return true
  if (!options.includeLandmarkContent && role && LANDMARK_ROLES.has(role)) return true

  return false
}

function collectInlineText(node: Node, options: CollectOptions = {}): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? ""
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return ""

  const el = node as HTMLElement
  if (el.hasAttribute(ASTRA_TRANSLATION_ATTR)) return ""

  if (el.hasAttribute(ASTRA_SOURCE_ATTR)) {
    return Array.from(el.childNodes).map((child) => collectInlineText(child, options)).join(" ")
  }

  if (!isVisible(el)) return ""

  if (shouldSkip(el, options) || !isInline(el)) return ""

  return Array.from(el.childNodes).map((child) => collectInlineText(child, options)).join(" ")
}

export function extractTextBlockText(el: HTMLElement, options: CollectOptions = {}): string {
  return normalizeWhitespace(Array.from(el.childNodes).map((child) => collectInlineText(child, options)).join(" "))
}

function hasDirectBlockChild(el: HTMLElement, options: CollectOptions = {}): boolean {
  return getWalkableChildren(el).some(
    (child) => !shouldSkip(child, options) && !isInline(child),
  )
}

function isCandidateElement(el: HTMLElement, options: CollectOptions = {}): boolean {
  if (PRIMARY_BLOCK_TAGS.has(el.tagName)) return true
  return FALLBACK_CONTAINER_TAGS.has(el.tagName) && !hasDirectBlockChild(el, options)
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

  if (!startElement || !isWithinRoot(root, startElement)) {
    return null
  }

  let current: HTMLElement | null = startElement
  while (current && current !== root.parentElement) {
    if (current !== root && !isWithinRoot(root, current)) {
      return null
    }

    if (!shouldSkip(current, options) && isVisible(current) && isCandidateElement(current, options)) {
      const text = extractTextBlockText(current, options)
      if (text.length >= minTextLength) {
        return { element: current, text }
      }
    }

    if (current === root) break
    current = getComposedParentElement(current)
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
    if (shouldSkip(node, options)) return
    if (node !== root && !isVisible(node)) return

    if (isCandidateElement(node, options)) {
      const text = extractTextBlockText(node, options)
      if (text.length >= minTextLength) {
        blocks.push({ element: node, text })
      }
    }

    for (const child of getWalkableChildren(node)) {
      walk(child)
    }
  }

  walk(root)
  return blocks
}

export function collectTextBlocksFromRoot(
  root: Document | ShadowRoot | HTMLElement,
  options: CollectOptions = {},
): TextBlock[] {
  if (root instanceof Document) {
    return collectTextBlocks(root.body ?? findContentRoot(root), options)
  }

  if (root instanceof ShadowRoot) {
    return Array.from(root.children)
      .filter((child): child is HTMLElement => child instanceof HTMLElement)
      .flatMap((child) => collectTextBlocks(child, options))
  }

  return collectTextBlocks(root, options)
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
