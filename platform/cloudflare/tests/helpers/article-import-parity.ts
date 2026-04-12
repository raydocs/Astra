import { JSDOM } from "jsdom"

import { extractReadableDocumentMetadata, resolveExtractionPlan } from "../../../../src/utils/dom/extraction"
import type { ImportedReadableArticle } from "../../src/types/article-import"

export interface ArticleImportParityDelta {
  fixtureId: string
  fixtureDescription: string
  sourcePath: string
  nativeRoute: string | null
  native: ArticleImportParityView
  relay: ArticleImportParityView
  diff: {
    titleMatch: boolean
    bylineMatch: boolean
    scopeMatch: boolean
    summaryMatch: boolean
    blockCountDelta: number
    overlapRatio: number
    nativeOnlySample: string[]
    relayOnlySample: string[]
  }
}

interface ArticleImportParityView {
  title: string
  byline: string | null
  scope: "article" | "page"
  summary: string | null
  blockCount: number
  sampleBlocks: string[]
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim()
}

function sampleBlocks(blocks: string[], count = 2): string[] {
  return blocks.slice(0, count).map((block) => normalizeWhitespace(block))
}

function normalizeBlock(block: string): string {
  return normalizeWhitespace(block).toLowerCase()
}

function toView(article: ImportedReadableArticle): ArticleImportParityView {
  return {
    title: article.title,
    byline: article.byline,
    scope: article.scope,
    summary: article.summary,
    blockCount: article.blocks.length,
    sampleBlocks: sampleBlocks(article.blocks),
  }
}

export function extractRelayArticleFromHtml(url: string, html: string): ImportedReadableArticle {
  const dom = new JSDOM(html, { url })
  const doc = dom.window.document

  const globalScope = globalThis as typeof globalThis & {
    HTMLElement?: typeof dom.window.HTMLElement
    Node?: typeof dom.window.Node
    getComputedStyle?: typeof dom.window.getComputedStyle
  }

  const previousGlobals = {
    HTMLElement: globalScope.HTMLElement,
    Node: globalScope.Node,
    getComputedStyle: globalScope.getComputedStyle,
  }

  try {
    globalScope.HTMLElement = dom.window.HTMLElement
    globalScope.Node = dom.window.Node
    globalScope.getComputedStyle = dom.window.getComputedStyle.bind(dom.window)

    const plan = resolveExtractionPlan(doc, "article")
    const blocks = plan.blocks
      .map((block) => block.text.trim())
      .filter(Boolean)

    if (blocks.length === 0) {
      throw new Error("Relay extraction returned no readable blocks")
    }

    const finalUrl = new URL(url)
    const metadata = extractReadableDocumentMetadata(doc, finalUrl.toString())
    return {
      url: finalUrl.toString(),
      title: metadata.title,
      hostname: finalUrl.hostname,
      byline: metadata.byline,
      scope: plan.scope,
      summary: plan.summary,
      blocks,
    }
  } finally {
    globalScope.HTMLElement = previousGlobals.HTMLElement
    globalScope.Node = previousGlobals.Node
    globalScope.getComputedStyle = previousGlobals.getComputedStyle
  }
}

export function buildParityDelta(params: {
  fixtureId: string
  fixtureDescription: string
  sourcePath: string
  nativeRoute: string | null
  native: ImportedReadableArticle
  relay: ImportedReadableArticle
}): ArticleImportParityDelta {
  const nativeBlocks = params.native.blocks.map(normalizeBlock)
  const relayBlocks = params.relay.blocks.map(normalizeBlock)
  const nativeSet = new Set(nativeBlocks)
  const relaySet = new Set(relayBlocks)

  const overlapCount = relayBlocks.reduce((count, block) => count + (nativeSet.has(block) ? 1 : 0), 0)
  const nativeOnly = params.native.blocks.filter((block) => !relaySet.has(normalizeBlock(block)))
  const relayOnly = params.relay.blocks.filter((block) => !nativeSet.has(normalizeBlock(block)))

  return {
    fixtureId: params.fixtureId,
    fixtureDescription: params.fixtureDescription,
    sourcePath: params.sourcePath,
    nativeRoute: params.nativeRoute,
    native: toView(params.native),
    relay: toView(params.relay),
    diff: {
      titleMatch: params.native.title === params.relay.title,
      bylineMatch: params.native.byline === params.relay.byline,
      scopeMatch: params.native.scope === params.relay.scope,
      summaryMatch: normalizeWhitespace(params.native.summary ?? "") === normalizeWhitespace(params.relay.summary ?? ""),
      blockCountDelta: params.native.blocks.length - params.relay.blocks.length,
      overlapRatio: params.relay.blocks.length === 0
        ? 1
        : Number((overlapCount / params.relay.blocks.length).toFixed(3)),
      nativeOnlySample: sampleBlocks(nativeOnly),
      relayOnlySample: sampleBlocks(relayOnly),
    },
  }
}
