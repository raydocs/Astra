import { resolveExtractionPlan } from "@/utils/dom/extraction"
import {
  ASTRA_SOURCE_HIDDEN_ATTR,
  ASTRA_TRANSLATION_ATTR,
} from "@/utils/dom/inject"
import { countRichTextPlaceholders } from "@/utils/dom/rich-text-placeholders"

import type { PageTranslationExecution } from "../../evaluators/page-translation"

const TRANSLATED_SELECTOR = `[${ASTRA_TRANSLATION_ATTR}='1']`
const TRANSLATED_TEXT_SELECTOR = `${TRANSLATED_SELECTOR} .astra-translation-inner`
const INTERACTIVE_TRANSLATION_SELECTOR = [
  `form ${TRANSLATED_SELECTOR}`,
  `nav ${TRANSLATED_SELECTOR}`,
  `button ${TRANSLATED_SELECTOR}`,
  `input + ${TRANSLATED_SELECTOR}`,
].join(", ")

const RICH_TEXT_TAG_SELECTOR = [
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
].map((tag) => `${TRANSLATED_SELECTOR} .astra-translation-inner ${tag}`).join(", ")

function withDocumentGlobals<T>(doc: Document, callback: () => T): T {
  const view = doc.defaultView
  if (!view) {
    return callback()
  }

  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    HTMLElement: globalThis.HTMLElement,
    Node: globalThis.Node,
    getComputedStyle: globalThis.getComputedStyle,
  }

  Object.assign(globalThis, {
    window: view,
    document: doc,
    HTMLElement: view.HTMLElement,
    Node: view.Node,
    getComputedStyle: view.getComputedStyle.bind(view),
  })

  try {
    return callback()
  } finally {
    Object.assign(globalThis, previous)
  }
}

function collectElementsIncludingOpenShadowRoots(root: ParentNode, selector: string): Element[] {
  const matches = Array.from(root.querySelectorAll(selector))
  for (const element of Array.from(root.querySelectorAll("*"))) {
    if (element.shadowRoot) {
      matches.push(...collectElementsIncludingOpenShadowRoots(element.shadowRoot, selector))
    }
  }
  return matches
}

export function collectTranslatedTextsFromDocument(root: ParentNode): string[] {
  return collectElementsIncludingOpenShadowRoots(root, TRANSLATED_TEXT_SELECTOR)
    .map((element) => element.textContent?.trim() ?? "")
    .filter(Boolean)
}

export function buildExpectedPageTranslationTexts(
  doc: Document,
  contentScope: "page" | "immersive" | "full_page" | "article" = "page",
) {
  return withDocumentGlobals(doc, () => {
    const plan = resolveExtractionPlan(doc, contentScope)
    return {
      expectedTexts: plan.blocks.map((block) => block.text),
      effectiveScope: plan.scope,
    }
  })
}

export function buildPageTranslationExecutionFromDocument(params: {
  doc: Document
  expectedTexts: string[]
  requestCount: number
  snapshotPhase: string
  failedBlocks: number
  payloadContext?: Record<string, unknown> | null
  requestTexts?: string[]
  notes?: string[]
}): PageTranslationExecution {
  const translatedElements = collectElementsIncludingOpenShadowRoots(params.doc, TRANSLATED_SELECTOR)
  const translatedHtmlSnippets = collectElementsIncludingOpenShadowRoots(params.doc, `${TRANSLATED_SELECTOR} .astra-translation-inner`)
    .map((element) => (element instanceof HTMLElement ? element.innerHTML : ""))

  return {
    translatedNodeCount: translatedElements.length,
    expectedNodeCount: params.expectedTexts.length,
    translationMarkerCount: translatedElements.length,
    hiddenSourceCount: collectElementsIncludingOpenShadowRoots(params.doc, `[${ASTRA_SOURCE_HIDDEN_ATTR}]`).length,
    requestCount: params.requestCount,
    skippedInteractiveTranslations: params.doc.querySelectorAll(INTERACTIVE_TRANSLATION_SELECTOR).length,
    translatedTexts: collectTranslatedTextsFromDocument(params.doc),
    expectedTexts: params.expectedTexts,
    snapshotPhase: params.snapshotPhase,
    failedBlocks: params.failedBlocks,
    payloadContext: params.payloadContext ?? null,
    requestTexts: params.requestTexts ?? [],
    requestPlaceholderCount: (params.requestTexts ?? []).reduce((sum, text) => sum + countRichTextPlaceholders(text), 0),
    translatedHtmlSnippets,
    placeholderLeakCount: translatedHtmlSnippets.reduce((sum, html) => sum + countRichTextPlaceholders(html), 0),
    restoredRichTextTagCount: collectElementsIncludingOpenShadowRoots(params.doc, RICH_TEXT_TAG_SELECTOR).length,
    notes: params.notes ?? [],
  } satisfies PageTranslationExecution
}
