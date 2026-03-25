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
  "main",
  "[role=\"main\"]",
  ".post-content",
  ".article-content",
  ".entry-content",
  ".post-body",
  ".article-body",
]

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
    const blocks = collectTextBlocks(candidate)
    const blockCount = blocks.length
    const textLength = blocks.reduce((sum, b) => sum + b.text.length, 0)

    if (blockCount < 3 || textLength < 100) continue

    const linkDensity = computeLinkDensity(candidate)
    const hasHeading = candidate.querySelector("h1, h2") !== null
    const score = textLength * (1 - linkDensity) * (hasHeading ? 1.2 : 1.0)

    if (score > bestScore) {
      bestScore = score
      bestCandidate = candidate
    }
  }

  return bestCandidate
}

export const resolveExtractionPlan = (doc: Document, scope: ContentScope): ExtractionPlan => {
  if (scope === "page") {
    const root = findContentRoot(doc)
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

  const root = findContentRoot(doc)
  const blocks = collectTextBlocks(root)
  return { root, blocks, scope: "page", summary: buildContentSummary(blocks) }
}
