import { collectTextBlocks, findContentRoot, buildContentSummary, type TextBlock } from "./traversal"

type ContentScope = "page" | "article"

export interface ExtractionPlan {
  root: HTMLElement
  blocks: TextBlock[]
  scope: ContentScope
  summary: string | null
}

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
  'nav, aside, [role="navigation"], [role="complementary"], .sidebar, .nav, .menu, .widget, .footer, .header'

const computeLinkDensity = (element: HTMLElement): number => {
  const totalText = element.textContent?.trim() ?? ""
  if (totalText.length === 0) return 0

  const links = element.querySelectorAll("a")
  let linkTextLength = 0
  links.forEach(link => {
    linkTextLength += (link.textContent?.trim() ?? "").length
  })

  return linkTextLength / totalText.length
}

export const resolveArticleRoot = (doc: Document): HTMLElement | null => {
  const candidates: HTMLElement[] = []

  for (const selector of ARTICLE_ROOT_SELECTORS) {
    doc.querySelectorAll<HTMLElement>(selector).forEach(el => {
      if (!candidates.includes(el)) candidates.push(el)
    })
  }

  let bestScore = -1
  let bestCandidate: HTMLElement | null = null

  for (const candidate of candidates) {
    // Skip elements that are themselves nav/sidebar elements
    if (candidate.matches(NAV_SIDEBAR_SELECTOR)) continue

    const blocks = collectTextBlocks(candidate)
    const blockCount = blocks.length
    const textLength = blocks.reduce((sum, b) => sum + b.text.length, 0)

    if (blockCount < 3 || textLength < 100) continue

    const linkDensity = computeLinkDensity(candidate)
    const hasHeading = candidate.querySelector("h1, h2") !== null

    // Paragraph density: ratio of <p> elements to all descendant elements
    const paragraphCount = candidate.querySelectorAll("p").length
    const totalElements = candidate.querySelectorAll("*").length
    const pDensity = totalElements > 0 ? paragraphCount / totalElements : 0

    // Nav/sidebar containment penalty: if candidate contains many nav/aside
    // elements relative to its size, penalise the score
    const navElements = candidate.querySelectorAll(NAV_SIDEBAR_SELECTOR).length
    const navRatio = totalElements > 0 ? navElements / totalElements : 0
    const navPenalty = navRatio > 0.1 ? 0.5 : 1.0

    let score = textLength * (1 - linkDensity) * (hasHeading ? 1.2 : 1.0)
    score *= (1 + pDensity * 2)
    score *= navPenalty

    if (score > bestScore) {
      bestScore = score
      bestCandidate = candidate
    }
  }

  return bestCandidate
}

export const resolveExtractionPlan = (doc: Document, scope: ContentScope): ExtractionPlan => {
  if (scope === "page") {
    const root = doc.body ?? findContentRoot(doc)
    const blocks = collectTextBlocks(root)
    return { root, blocks, scope: "page", summary: buildContentSummary(blocks) }
  }

  const articleRoot = resolveArticleRoot(doc)
  if (articleRoot) {
    const blocks = collectTextBlocks(articleRoot)
    if (blocks.length > 0) {
      return { root: articleRoot, blocks, scope: "article", summary: buildContentSummary(blocks) }
    }
  }

  const root = doc.body ?? findContentRoot(doc)
  const blocks = collectTextBlocks(root)
  return { root, blocks, scope: "page", summary: buildContentSummary(blocks) }
}
