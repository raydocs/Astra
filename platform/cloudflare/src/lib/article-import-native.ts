import { z } from "zod"

import type { ImportedReadableArticle } from "../types/article-import"
import {
  ARTICLE_IMPORT_DEFAULT_MAX_NATIVE_BYTES,
  ARTICLE_IMPORT_MAX_REDIRECTS,
} from "../types/article-import"

export interface NativeArticleImportResult {
  article: ImportedReadableArticle
  sourceHtml: string
}

const ArticleImportRequestSchema = z.object({
  url: z.string().trim().min(1),
})

const BLOCKED_URL_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "0.0.0.0",
])

const ARTICLE_ROOT_SELECTORS = [
  "article",
  "[role=\"article\"]",
  ".post-content",
  ".article-content",
  ".entry-content",
  ".post-body",
  ".article-body",
  ".content",
  ".main-content",
  ".page-content",
  "#content",
  "#main",
  ".story-body",
  ".post",
]

const NAV_SIDEBAR_SELECTOR =
  "nav, aside, [role=\"navigation\"], [role=\"complementary\"], .sidebar, .nav, .menu, .widget, .footer, .header"

const PRIMARY_BLOCK_SELECTORS = "p, li, blockquote, figcaption, caption, td, th, dd, dt, h1, h2, h3, h4, h5, h6"
const CONTAINER_TAGS = new Set(["DIV", "SECTION", "ARTICLE"])
const SKIP_TAGS = new Set([
  "SCRIPT", "STYLE", "NOSCRIPT", "IFRAME", "OBJECT", "EMBED",
  "SVG", "CANVAS", "TEMPLATE", "TEXTAREA", "INPUT", "SELECT",
  "VIDEO", "AUDIO", "IMG", "BR", "HR", "BUTTON", "SUMMARY",
  "DETAILS", "NAV", "FOOTER", "ASIDE", "HEADER",
])

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim()
}

export class NativeArticleImportError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly shouldProxyFallback: boolean = false,
  ) {
    super(message)
    this.name = "NativeArticleImportError"
  }
}

function normalizeImportedArticleUrl(value: string): URL {
  let parsed: URL
  try {
    parsed = new URL(value.trim())
  } catch {
    throw new NativeArticleImportError(400, "INVALID_REQUEST", "Enter a valid absolute URL, including https://.")
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new NativeArticleImportError(400, "INVALID_REQUEST", "Only http(s) article URLs are supported.")
  }

  const hostname = parsed.hostname.trim().toLowerCase()
  if (!hostname) {
    throw new NativeArticleImportError(400, "INVALID_REQUEST", "Imported article URL hostname is required.")
  }

  return parsed
}

function isBlockedIpv4Address(hostname: string): boolean {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(hostname)
  if (!match) return false

  const octets = match.slice(1).map((part) => Number.parseInt(part, 10))
  if (octets.some((octet) => Number.isNaN(octet) || octet < 0 || octet > 255)) {
    return true
  }

  const [first, second] = octets
  if (first === 10 || first === 127 || first === 0) return true
  if (first === 169 && second === 254) return true
  if (first === 172 && second >= 16 && second <= 31) return true
  if (first === 192 && second === 168) return true
  return false
}

function isBlockedIpv6Address(hostname: string): boolean {
  const normalized = hostname.replace(/^\[|\]$/g, "").toLowerCase()
  if (!normalized.includes(":")) return false

  const ipv4MappedMatch = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(normalized)
  if (ipv4MappedMatch) {
    return isBlockedIpv4Address(ipv4MappedMatch[1])
  }

  if (normalized === "::1" || normalized === "::") return true
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true
  if (normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb")) {
    return true
  }

  return false
}

function assertImportedArticleUrlIsEdgeSafe(url: URL) {
  const hostname = url.hostname.trim().toLowerCase()
  if (!hostname) {
    throw new NativeArticleImportError(400, "INVALID_REQUEST", "Imported article URL hostname is required.")
  }

  if (BLOCKED_URL_HOSTS.has(hostname) || hostname.endsWith(".local")) {
    throw new NativeArticleImportError(400, "INVALID_REQUEST", "Local or private network URLs are not allowed.")
  }

  if (isBlockedIpv4Address(hostname) || isBlockedIpv6Address(hostname)) {
    throw new NativeArticleImportError(400, "INVALID_REQUEST", "Local or private network URLs are not allowed.")
  }
}

export async function parseArticleImportRequest(request: Request): Promise<URL> {
  let payload: z.infer<typeof ArticleImportRequestSchema>
  try {
    payload = ArticleImportRequestSchema.parse(await request.json())
  } catch {
    throw new NativeArticleImportError(400, "INVALID_REQUEST", "Article import requires a JSON body with a url field.")
  }

  return normalizeImportedArticleUrl(payload.url)
}

export { normalizeImportedArticleUrl, assertImportedArticleUrlIsEdgeSafe }

async function fetchImportedArticleUpstreamAtEdge(articleUrl: URL): Promise<{ response: Response; finalUrl: URL }> {
  let currentUrl = articleUrl

  for (let redirectCount = 0; redirectCount <= ARTICLE_IMPORT_MAX_REDIRECTS; redirectCount += 1) {
    assertImportedArticleUrlIsEdgeSafe(currentUrl)

    let response: Response
    try {
      response = await fetch(currentUrl, {
        headers: {
          Accept: "text/html,application/xhtml+xml",
        },
        redirect: "manual",
        signal: AbortSignal.timeout(10_000),
      })
    } catch {
      throw new NativeArticleImportError(
        400,
        "CONTENT_UNAVAILABLE",
        "The edge import path could not fetch this URL. Falling back to the Astra relay may still succeed.",
        true,
      )
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location")
      if (!location) {
        throw new NativeArticleImportError(400, "CONTENT_UNAVAILABLE", "The imported URL redirected without a location header.")
      }

      currentUrl = normalizeImportedArticleUrl(new URL(location, currentUrl).toString())
      continue
    }

    return { response, finalUrl: currentUrl }
  }

  throw new NativeArticleImportError(400, "CONTENT_UNAVAILABLE", "The imported URL redirected too many times.")
}

async function readResponseTextUpToLimit(response: Response, maxBytes: number): Promise<string> {
  if (!response.body) {
    return response.text()
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let totalBytes = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (!value) continue

    totalBytes += value.byteLength
    if (totalBytes > maxBytes) {
      await reader.cancel().catch(() => {})
      throw new NativeArticleImportError(
        400,
        "CONTENT_UNAVAILABLE",
        "The imported page exceeded the Worker-native byte budget. Falling back to the Astra relay may still succeed.",
        true,
      )
    }

    chunks.push(value)
  }

  const combined = new Uint8Array(totalBytes)
  let offset = 0
  for (const chunk of chunks) {
    combined.set(chunk, offset)
    offset += chunk.byteLength
  }

  return new TextDecoder().decode(combined)
}

function getTextContent(node: ParentNode | Element | null): string {
  return normalizeWhitespace(node?.textContent ?? "")
}

function isHidden(element: Element): boolean {
  const htmlElement = element as HTMLElement
  if (htmlElement.hidden) return true
  if (element.getAttribute("aria-hidden") === "true") return true

  const inlineStyle = element.getAttribute("style")?.toLowerCase() ?? ""
  return inlineStyle.includes("display:none") || inlineStyle.includes("visibility:hidden")
}

function shouldSkipElement(element: Element): boolean {
  if (SKIP_TAGS.has(element.tagName)) return true
  if (element.getAttribute("translate") === "no" || element.classList.contains("notranslate")) return true
  if (element.hasAttribute("data-astra-translation") || element.hasAttribute("data-astra-source")) return true
  if (isHidden(element)) return true
  return false
}

function computeLinkDensity(element: Element): number {
  const totalText = getTextContent(element)
  if (!totalText) return 0

  const links = Array.from(element.querySelectorAll("a"))
  const linkTextLength = links.reduce((sum, link) => sum + getTextContent(link).length, 0)
  return linkTextLength / totalText.length
}

function hasDirectBlockChild(element: Element): boolean {
  return Array.from(element.children).some((child) => {
    if (shouldSkipElement(child)) return false
    return child.matches(PRIMARY_BLOCK_SELECTORS) || CONTAINER_TAGS.has(child.tagName)
  })
}

function extractBlockText(element: Element): string {
  return getTextContent(element)
}

function collectTextBlocks(root: Element): string[] {
  const selectors = `${PRIMARY_BLOCK_SELECTORS}, div, section, article`
  const blocks: string[] = []

  if (root.matches(PRIMARY_BLOCK_SELECTORS) || (CONTAINER_TAGS.has(root.tagName) && !hasDirectBlockChild(root))) {
    const rootText = extractBlockText(root)
    if (rootText.length >= 2) blocks.push(rootText)
  }

  for (const element of Array.from(root.querySelectorAll(selectors))) {
    if (shouldSkipElement(element)) continue

    const isPrimaryBlock = element.matches(PRIMARY_BLOCK_SELECTORS)
    const isContainerLeaf = CONTAINER_TAGS.has(element.tagName) && !hasDirectBlockChild(element)
    if (!isPrimaryBlock && !isContainerLeaf) continue

    const text = extractBlockText(element)
    if (text.length >= 2) {
      blocks.push(text)
    }
  }

  const deduped: string[] = []
  const seen = new Set<string>()
  for (const block of blocks) {
    if (seen.has(block)) continue
    seen.add(block)
    deduped.push(block)
  }
  return deduped
}

function buildContentSummary(blocks: string[], maxBlocks = 6, maxChars = 800): string | null {
  const parts: string[] = []
  let charCount = 0

  for (const block of blocks) {
    const remaining = maxChars - charCount
    if (remaining <= 0) break

    const next = block.length > remaining ? `${block.slice(0, remaining).trim()}…` : block
    parts.push(next)
    charCount += next.length + 1
    if (parts.length >= maxBlocks || charCount >= maxChars) break
  }

  return parts.length > 0 ? parts.join(" ") : null
}

function resolveArticleRoot(doc: Document): Element | null {
  const candidates: Element[] = []

  for (const selector of ARTICLE_ROOT_SELECTORS) {
    for (const element of Array.from(doc.querySelectorAll(selector))) {
      if (!candidates.includes(element)) candidates.push(element)
    }
  }

  let bestScore = -1
  let bestCandidate: Element | null = null

  for (const candidate of candidates) {
    if (candidate.matches(NAV_SIDEBAR_SELECTOR) || shouldSkipElement(candidate)) continue

    const blocks = collectTextBlocks(candidate)
    const blockCount = blocks.length
    const textLength = blocks.reduce((sum, block) => sum + block.length, 0)
    if (blockCount < 3 || textLength < 100) continue

    const linkDensity = computeLinkDensity(candidate)
    const hasHeading = candidate.querySelector("h1, h2") !== null
    const paragraphCount = candidate.querySelectorAll("p").length
    const totalElements = candidate.querySelectorAll("*").length
    const paragraphDensity = totalElements > 0 ? paragraphCount / totalElements : 0
    const navElements = candidate.querySelectorAll(NAV_SIDEBAR_SELECTOR).length
    const navRatio = totalElements > 0 ? navElements / totalElements : 0
    const navPenalty = navRatio > 0.1 ? 0.5 : 1

    let score = textLength * (1 - linkDensity) * (hasHeading ? 1.2 : 1)
    score *= (1 + paragraphDensity * 2)
    score *= navPenalty

    if (score > bestScore) {
      bestScore = score
      bestCandidate = candidate
    }
  }

  return bestCandidate
}

function resolveExtraction(doc: Document): { scope: "article" | "page"; blocks: string[]; summary: string | null } {
  const articleRoot = resolveArticleRoot(doc)
  if (articleRoot) {
    const blocks = collectTextBlocks(articleRoot)
    if (blocks.length > 0) {
      return {
        scope: "article",
        blocks,
        summary: buildContentSummary(blocks),
      }
    }
  }

  const root = doc.body ?? doc.documentElement
  const blocks = collectTextBlocks(root)
  return {
    scope: "page",
    blocks,
    summary: buildContentSummary(blocks),
  }
}

function extractDocumentTitle(doc: Document, fallbackUrl: string): string {
  const heading = getTextContent(doc.querySelector("h1"))
  if (heading) return heading

  const title = normalizeWhitespace(doc.title ?? "")
  if (title) return title

  try {
    return new URL(fallbackUrl).hostname
  } catch {
    return fallbackUrl
  }
}

function extractDocumentByline(doc: Document): string | null {
  const candidates = [
    "[rel=\"author\"]",
    "[itemprop=\"author\"]",
    ".byline",
    ".article-byline",
    ".post-author",
    ".author",
    "meta[name=\"author\"]",
  ]

  for (const selector of candidates) {
    const node = doc.querySelector(selector)
    if (!node) continue

    const content = node.getAttribute("content")?.trim()
    if (content) return content

    const text = getTextContent(node)
    if (text) return text
  }

  return null
}

function parseHtmlDocument(html: string): Document {
  if (typeof DOMParser !== "function") {
    throw new NativeArticleImportError(
      501,
      "PLATFORM_UNAVAILABLE",
      "The Worker runtime does not expose DOMParser for native article import.",
      true,
    )
  }

  return new DOMParser().parseFromString(html, "text/html")
}

export async function importArticleNatively(
  request: Request,
  options: { maxBytes?: number } = {},
): Promise<NativeArticleImportResult> {
  const maxBytes = options.maxBytes ?? ARTICLE_IMPORT_DEFAULT_MAX_NATIVE_BYTES
  const articleUrl = await parseArticleImportRequest(request)
  const { response: upstream, finalUrl } = await fetchImportedArticleUpstreamAtEdge(articleUrl)

  if (!upstream.ok) {
    throw new NativeArticleImportError(
      400,
      "CONTENT_UNAVAILABLE",
      `Article import failed with status ${upstream.status}.`,
      true,
    )
  }

  const contentType = upstream.headers.get("content-type") ?? ""
  if (contentType && !/html|xhtml/i.test(contentType)) {
    throw new NativeArticleImportError(400, "CONTENT_UNAVAILABLE", "The imported URL did not return an HTML document.")
  }

  const contentLength = Number.parseInt(upstream.headers.get("content-length") ?? "", 10)
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new NativeArticleImportError(
      400,
      "CONTENT_UNAVAILABLE",
      "The imported page exceeded the Worker-native byte budget. Falling back to the Astra relay may still succeed.",
      true,
    )
  }

  const html = await readResponseTextUpToLimit(upstream, maxBytes)

  const doc = parseHtmlDocument(html)
  const extracted = resolveExtraction(doc)
  if (extracted.blocks.length === 0) {
    throw new NativeArticleImportError(
      400,
      "CONTENT_UNAVAILABLE",
      "The imported URL did not expose readable article text after edge extraction.",
      true,
    )
  }

  return {
    article: {
      url: finalUrl.toString(),
      title: extractDocumentTitle(doc, finalUrl.toString()),
      hostname: finalUrl.hostname,
      byline: extractDocumentByline(doc),
      scope: extracted.scope,
      summary: extracted.summary,
      blocks: extracted.blocks,
    },
    sourceHtml: html,
  }
}
