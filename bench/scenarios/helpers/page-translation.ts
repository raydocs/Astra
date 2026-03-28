import { resolveExtractionPlan } from "@/utils/dom/extraction"
import {
  ASTRA_SOURCE_HIDDEN_ATTR,
  ASTRA_TRANSLATION_ATTR,
} from "@/utils/dom/inject"

import type { PageTranslationExecution } from "../../evaluators/page-translation"

const TRANSLATED_SELECTOR = `[${ASTRA_TRANSLATION_ATTR}='1']`
const TRANSLATED_TEXT_SELECTOR = `${TRANSLATED_SELECTOR} .astra-translation-inner`
const INTERACTIVE_TRANSLATION_SELECTOR = [
  `form ${TRANSLATED_SELECTOR}`,
  `nav ${TRANSLATED_SELECTOR}`,
  `button ${TRANSLATED_SELECTOR}`,
  `input + ${TRANSLATED_SELECTOR}`,
].join(", ")

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

export function collectTranslatedTextsFromDocument(root: ParentNode): string[] {
  return Array.from(root.querySelectorAll(TRANSLATED_TEXT_SELECTOR))
    .map((element) => element.textContent?.trim() ?? "")
    .filter(Boolean)
}

export function buildExpectedPageTranslationTexts(
  doc: Document,
  contentScope: "page" | "article" = "page",
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
  notes?: string[]
}) {
  return {
    translatedNodeCount: params.doc.querySelectorAll(TRANSLATED_SELECTOR).length,
    expectedNodeCount: params.expectedTexts.length,
    translationMarkerCount: params.doc.querySelectorAll(TRANSLATED_SELECTOR).length,
    hiddenSourceCount: params.doc.querySelectorAll(`[${ASTRA_SOURCE_HIDDEN_ATTR}]`).length,
    requestCount: params.requestCount,
    skippedInteractiveTranslations: params.doc.querySelectorAll(INTERACTIVE_TRANSLATION_SELECTOR).length,
    translatedTexts: collectTranslatedTextsFromDocument(params.doc),
    expectedTexts: params.expectedTexts,
    snapshotPhase: params.snapshotPhase,
    failedBlocks: params.failedBlocks,
    payloadContext: params.payloadContext ?? null,
    notes: params.notes ?? [],
  } satisfies PageTranslationExecution
}
