import { resolveExtractionPlan } from "@/utils/dom/extraction"

import type { ArticleExtractionExecution } from "../../evaluators/article-extraction"

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

export function buildArticleExtractionExecutionFromDocument(params: {
  doc: Document
  contentScope?: "page" | "article"
  shouldExcludeTexts?: string[]
  notes?: string[]
}): ArticleExtractionExecution {
  return withDocumentGlobals(params.doc, () => {
    const plan = resolveExtractionPlan(params.doc, params.contentScope ?? "article")
    const blockTexts = plan.blocks.map((block) => block.text)

    return {
      scope: plan.scope,
      rootId: plan.root.id || null,
      blockCount: plan.blocks.length,
      blockTexts,
      leakedTexts: (params.shouldExcludeTexts ?? []).filter((needle) =>
        blockTexts.some((text) => text.includes(needle)),
      ),
      notes: params.notes ?? [],
    } satisfies ArticleExtractionExecution
  })
}
