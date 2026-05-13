import { browser } from "#imports"

import {
  isPageAccessAllowedForUrl,
  PAGE_ACCESS_POLICY_STORAGE_KEY,
} from "@/utils/extension/page-permissions"
import {
  buildPageAnnotation,
  deletePageAnnotation,
  listPageAnnotations,
  markPageAnnotationUnresolved,
  PAGE_ANNOTATIONS_STORAGE_KEY,
  savePageAnnotation,
  type PageAnnotation,
  type PageAnnotationAnchor,
  type PageAnnotationType,
  type SavePageAnnotationResult,
} from "@/utils/storage/page-annotations"

const HIGHLIGHT_CLASS = "astra-page-annotation-highlight"
const HOST_ID = "astra-page-annotations-host"
const ASTRA_SELECTOR = `.${HIGHLIGHT_CLASS}, #${HOST_ID}, #astra-selection-toolbar-host, #astra-float-ball-host, #astra-hover-translate-host, #astra-input-translate-host`

interface TextNodeSpan {
  node: Text
  start: number
  end: number
}

interface ResolvedAnnotation {
  annotation: PageAnnotation
  range: Range
  start: number
  end: number
}

let mounted = false
let renderGeneration = 0

function cssEscape(value: string): string {
  const escape = globalThis.CSS?.escape
  if (escape) return escape(value)
  return value.replace(/[^a-zA-Z0-9_-]/g, (char) => `\\${char}`)
}

function isSkippableNode(node: Node): boolean {
  const element = node.nodeType === Node.ELEMENT_NODE
    ? node as Element
    : node.parentElement
  if (!element) return false
  return Boolean(element.closest(ASTRA_SELECTOR))
    || ["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "INPUT", "SELECT", "OPTION"].includes(element.tagName)
}

function collectTextNodeSpans(root: ParentNode = document.body): TextNodeSpan[] {
  const spans: TextNodeSpan[] = []
  let offset = 0
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.textContent || isSkippableNode(node)) return NodeFilter.FILTER_REJECT
      return NodeFilter.FILTER_ACCEPT
    },
  })

  while (walker.nextNode()) {
    const node = walker.currentNode as Text
    const length = node.data.length
    spans.push({ node, start: offset, end: offset + length })
    offset += length
  }

  return spans
}

function getPageText(spans = collectTextNodeSpans()): string {
  return spans.map((span) => span.node.data).join("")
}

function getBoundaryOffset(container: Node, offset: number, spans: TextNodeSpan[]): number | null {
  if (container.nodeType === Node.TEXT_NODE) {
    const span = spans.find((candidate) => candidate.node === container)
    if (!span) return null
    return Math.min(span.end, span.start + offset)
  }

  if (container.nodeType === Node.ELEMENT_NODE) {
    const element = container as Element
    const child = element.childNodes[offset]
    const descendants = new Set<Text>()
    for (let i = 0; i < offset; i += 1) {
      const current = element.childNodes[i]
      const walker = document.createTreeWalker(current, NodeFilter.SHOW_TEXT)
      if (current.nodeType === Node.TEXT_NODE) descendants.add(current as Text)
      while (walker.nextNode()) descendants.add(walker.currentNode as Text)
    }
    const lastBefore = spans.filter((span) => descendants.has(span.node)).at(-1)
    if (lastBefore) return lastBefore.end
    if (child) {
      const firstAfter = spans.find((span) => child === span.node || child.contains(span.node))
      if (firstAfter) return firstAfter.start
    }
  }

  return null
}

function getRangeTextOffsets(range: Range): { start: number; end: number } | null {
  const spans = collectTextNodeSpans()
  const start = getBoundaryOffset(range.startContainer, range.startOffset, spans)
  const end = getBoundaryOffset(range.endContainer, range.endOffset, spans)
  if (start === null || end === null || end <= start) return null
  return { start, end }
}

function getTextContext(pageText: string, start: number, end: number): { prefix?: string; suffix?: string } {
  const prefix = pageText.slice(Math.max(0, start - 40), start)
  const suffix = pageText.slice(end, Math.min(pageText.length, end + 40))
  return {
    ...(prefix ? { prefix } : {}),
    ...(suffix ? { suffix } : {}),
  }
}

function buildSelector(element: Element | null): string | undefined {
  if (!element || element === document.documentElement) return undefined
  if (element.id) return `#${cssEscape(element.id)}`

  const parts: string[] = []
  let current: Element | null = element
  while (current && current !== document.documentElement && parts.length < 5) {
    const tag = current.tagName.toLowerCase()
    const currentTag = current.tagName
    const parent: Element | null = current.parentElement
    if (!parent) break
    const sameTagSiblings = (Array.from(parent.children) as Element[]).filter((child) => child.tagName === currentTag)
    const index = sameTagSiblings.indexOf(current) + 1
    parts.unshift(sameTagSiblings.length > 1 ? `${tag}:nth-of-type(${index})` : tag)
    current = parent
  }

  return parts.length ? parts.join(" > ") : undefined
}

function getTextNodeIndexWithin(element: Element, textNode: Text): number | undefined {
  const nodes: Text[] = []
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
  while (walker.nextNode()) nodes.push(walker.currentNode as Text)
  const index = nodes.indexOf(textNode)
  return index >= 0 ? index : undefined
}

export function buildAnnotationAnchorFromRange(range: Range): PageAnnotationAnchor | null {
  const rawText = range.toString()
  const leadingWhitespace = rawText.length - rawText.trimStart().length
  const trailingWhitespace = rawText.length - rawText.trimEnd().length
  const exact = rawText.trim()
  const offsets = getRangeTextOffsets(range)
  if (!offsets || !exact) return null

  const adjustedOffsets = {
    start: offsets.start + leadingWhitespace,
    end: offsets.end - trailingWhitespace,
  }
  if (adjustedOffsets.end <= adjustedOffsets.start) return null

  const spans = collectTextNodeSpans()
  const pageText = getPageText(spans)
  const context = getTextContext(pageText, adjustedOffsets.start, adjustedOffsets.end)
  const containerElement = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
    ? range.commonAncestorContainer as Element
    : range.commonAncestorContainer.parentElement
  const selector = buildSelector(containerElement?.closest("p, li, blockquote, td, th, article, section, main, div") ?? containerElement)
  const startTextNode = range.startContainer.nodeType === Node.TEXT_NODE ? range.startContainer as Text : null

  return {
    textPosition: adjustedOffsets,
    textQuote: {
      exact,
      ...context,
    },
    ...(selector
      ? {
          selector: {
            selector,
            ...(containerElement && startTextNode
              ? { textNodeIndex: getTextNodeIndexWithin(containerElement, startTextNode) }
              : {}),
          },
        }
      : {}),
  }
}

export async function createAnnotationFromCurrentSelection(type: PageAnnotationType): Promise<SavePageAnnotationResult | null> {
  const selection = window.getSelection()
  const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0).cloneRange() : null
  const quoteText = selection?.toString().trim() ?? ""
  if (!range || !quoteText) return null

  const anchor = buildAnnotationAnchorFromRange(range)
  if (!anchor) return null

  const annotation = buildPageAnnotation({
    type,
    pageUrl: window.location.href,
    pageTitle: document.title,
    quoteText,
    anchor,
  })
  if (!annotation) return null

  const result = await savePageAnnotation(annotation)
  await renderPageAnnotations()
  return result
}

function findOffsetsByQuote(annotation: PageAnnotation, pageText: string): { start: number; end: number } | null {
  const exact = annotation.anchor.textQuote.exact
  const prefix = annotation.anchor.textQuote.prefix
  const suffix = annotation.anchor.textQuote.suffix
  let searchFrom = 0

  while (searchFrom <= pageText.length) {
    const start = pageText.indexOf(exact, searchFrom)
    if (start === -1) return null
    const end = start + exact.length
    const prefixMatches = !prefix || pageText.slice(Math.max(0, start - prefix.length), start) === prefix
    const suffixMatches = !suffix || pageText.slice(end, end + suffix.length) === suffix
    if (prefixMatches && suffixMatches) return { start, end }
    searchFrom = start + 1
  }

  return null
}

function findOffsets(annotation: PageAnnotation, pageText: string): { start: number; end: number } | null {
  const position = annotation.anchor.textPosition
  if (position && pageText.slice(position.start, position.end) === annotation.anchor.textQuote.exact) {
    return position
  }

  return findOffsetsByQuote(annotation, pageText)
}

function rangeFromOffsets(start: number, end: number, spans: TextNodeSpan[]): Range | null {
  const startSpan = spans.find((span) => start >= span.start && start <= span.end)
  const endSpan = spans.find((span) => end >= span.start && end <= span.end)
  if (!startSpan || !endSpan) return null

  const range = document.createRange()
  range.setStart(startSpan.node, Math.max(0, start - startSpan.start))
  range.setEnd(endSpan.node, Math.max(0, end - endSpan.start))
  return range.collapsed ? null : range
}

function unwrapRenderedAnnotations() {
  document.querySelectorAll(`.${HIGHLIGHT_CLASS}`).forEach((element) => {
    const parent = element.parentNode
    if (!parent) return
    while (element.firstChild) {
      parent.insertBefore(element.firstChild, element)
    }
    parent.removeChild(element)
    parent.normalize()
  })
}

function applyAnnotationSpan(resolved: ResolvedAnnotation): boolean {
  const span = document.createElement("span")
  span.className = HIGHLIGHT_CLASS
  span.dataset.annotationId = resolved.annotation.id
  span.dataset.annotationType = resolved.annotation.type
  span.title = `Astra ${resolved.annotation.type === "mark" ? "mark" : "highlight"}: ${resolved.annotation.quoteText}`
  span.style.borderRadius = "0.22em"
  span.style.boxDecorationBreak = "clone"
  span.style.setProperty("-webkit-box-decoration-break", "clone")
  span.style.cursor = "pointer"

  if (resolved.annotation.type === "mark") {
    span.style.textDecoration = "underline"
    span.style.textDecorationColor = "#d09b2c"
    span.style.textDecorationThickness = "0.16em"
    span.style.textUnderlineOffset = "0.16em"
    span.style.background = "rgba(208, 155, 44, 0.10)"
  } else if (resolved.annotation.type === "sticky_note") {
    span.style.background = "rgba(255, 224, 130, 0.28)"
    span.style.borderBottom = "2px dotted #d09b2c"
  } else {
    span.style.background = "rgba(255, 214, 102, 0.42)"
  }

  try {
    const contents = resolved.range.extractContents()
    span.appendChild(contents)
    resolved.range.insertNode(span)
    return true
  } catch {
    return false
  }
}

function getHost(): ShadowRoot {
  let host = document.getElementById(HOST_ID)
  if (!host) {
    host = document.createElement("div")
    host.id = HOST_ID
    host.style.position = "fixed"
    host.style.inset = "auto 16px 16px auto"
    host.style.zIndex = "2147483645"
    host.style.pointerEvents = "auto"
    document.documentElement.appendChild(host)
    const shadow = host.attachShadow({ mode: "open" })
    const style = document.createElement("style")
    style.textContent = `
      :host { all: initial; }
      .panel {
        width: min(320px, calc(100vw - 32px));
        max-height: min(360px, calc(100vh - 32px));
        overflow: auto;
        border: 1px solid rgba(30, 41, 59, 0.16);
        border-radius: 14px;
        background: rgba(255, 255, 255, 0.96);
        box-shadow: 0 18px 50px rgba(15, 23, 42, 0.18);
        color: #1f2937;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 12px;
      }
      details { padding: 8px 10px; }
      summary { cursor: pointer; font-weight: 700; color: #5b4636; }
      .item { display: grid; gap: 5px; padding: 9px 0; border-top: 1px solid rgba(30, 41, 59, 0.10); }
      .quote { font-family: Georgia, serif; font-size: 13px; line-height: 1.35; color: #334155; }
      .meta { display: flex; align-items: center; gap: 8px; color: #64748b; }
      .status-unresolved { color: #b45309; font-weight: 700; }
      button { margin-left: auto; border: 0; border-radius: 999px; padding: 3px 8px; background: #f1f5f9; color: #475569; cursor: pointer; font: inherit; }
      button:hover { background: #fee2e2; color: #991b1b; }
    `
    shadow.appendChild(style)
  }
  return host.shadowRoot!
}

function renderPanel(annotations: PageAnnotation[], unresolvedIds: Set<string>) {
  const host = getHost()
  const existing = host.querySelector(".panel")
  existing?.remove()

  if (annotations.length === 0) {
    const element = document.getElementById(HOST_ID)
    element?.remove()
    return
  }

  const panel = document.createElement("div")
  panel.className = "panel"
  panel.dataset.testid = "page-annotations-panel"
  const details = document.createElement("details")
  details.open = unresolvedIds.size > 0
  const summary = document.createElement("summary")
  summary.textContent = unresolvedIds.size > 0
    ? `Astra annotations — ${unresolvedIds.size} unresolved`
    : `Astra annotations — ${annotations.length}`
  details.appendChild(summary)

  for (const annotation of annotations) {
    const item = document.createElement("div")
    item.className = "item"
    item.dataset.annotationId = annotation.id

    const quote = document.createElement("div")
    quote.className = "quote"
    quote.textContent = annotation.quoteText
    item.appendChild(quote)

    const meta = document.createElement("div")
    meta.className = "meta"
    const status = document.createElement("span")
    const unresolved = unresolvedIds.has(annotation.id) || annotation.state === "unresolved"
    status.textContent = unresolved ? "Anchor unresolved" : annotation.type.replace("_", " ")
    if (unresolved) status.className = "status-unresolved"
    meta.appendChild(status)

    const button = document.createElement("button")
    button.type = "button"
    button.textContent = "Delete"
    button.dataset.testid = `page-annotation-delete-${annotation.id}`
    button.addEventListener("click", () => {
      void deletePageAnnotation(annotation.id).then(() => renderPageAnnotations())
    })
    meta.appendChild(button)
    item.appendChild(meta)
    details.appendChild(item)
  }

  panel.appendChild(details)
  host.appendChild(panel)
}

export function clearRenderedPageAnnotations() {
  unwrapRenderedAnnotations()
  document.getElementById(HOST_ID)?.remove()
}

function shouldWriteUnresolvedState(annotation: PageAnnotation, reason: string): boolean {
  return annotation.state !== "unresolved"
    || annotation.unresolvedAnchor?.unresolved !== true
    || annotation.unresolvedAnchor.reason !== reason
}

export async function renderPageAnnotations(): Promise<void> {
  const generation = ++renderGeneration
  unwrapRenderedAnnotations()

  if (!await isPageAccessAllowedForUrl(window.location.href)) {
    clearRenderedPageAnnotations()
    return
  }

  const annotations = await listPageAnnotations(window.location.href)
  if (generation !== renderGeneration) return

  const spans = collectTextNodeSpans()
  const pageText = getPageText(spans)
  const resolved: ResolvedAnnotation[] = []
  const unresolvedIds = new Set<string>()

  for (const annotation of annotations) {
    const offsets = findOffsets(annotation, pageText)
    const range = offsets ? rangeFromOffsets(offsets.start, offsets.end, spans) : null
    if (!offsets || !range) {
      const reason = "Saved text anchor no longer resolves on this page."
      unresolvedIds.add(annotation.id)
      if (shouldWriteUnresolvedState(annotation, reason)) {
        await markPageAnnotationUnresolved(annotation.id, {
          unresolved: true,
          reason,
          lastTriedAt: Date.now(),
        })
      }
      continue
    }
    resolved.push({ annotation, range, start: offsets.start, end: offsets.end })
    if (annotation.state === "unresolved" || annotation.unresolvedAnchor?.unresolved) {
      await markPageAnnotationUnresolved(annotation.id, {
        unresolved: false,
        lastTriedAt: Date.now(),
      })
    }
  }

  for (const item of resolved.sort((left, right) => right.start - left.start)) {
    const applied = applyAnnotationSpan(item)
    if (!applied) {
      const reason = "Saved text anchor overlaps page markup and could not be rendered."
      unresolvedIds.add(item.annotation.id)
      if (shouldWriteUnresolvedState(item.annotation, reason)) {
        await markPageAnnotationUnresolved(item.annotation.id, {
          unresolved: true,
          reason,
          lastTriedAt: Date.now(),
        })
      }
    }
  }

  renderPanel(annotations, unresolvedIds)
}

export function mountPageAnnotations() {
  if (mounted) return
  mounted = true
  void renderPageAnnotations()

  browser.storage.onChanged?.addListener((changes, areaName) => {
    if (areaName !== "local" || (!(PAGE_ANNOTATIONS_STORAGE_KEY in changes) && !(PAGE_ACCESS_POLICY_STORAGE_KEY in changes))) return
    void renderPageAnnotations()
  })
}

export function __resetPageAnnotationsForTests() {
  mounted = false
  renderGeneration = 0
  clearRenderedPageAnnotations()
}
