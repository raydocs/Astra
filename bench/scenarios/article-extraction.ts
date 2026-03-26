import { resolveExtractionPlan } from "@/utils/dom/extraction"

import { evaluateArticleExtraction, type ArticleExtractionExecution } from "../evaluators/article-extraction"
import { cleanupDomEnvironment, installDomEnvironment } from "../runtime/dom"
import { mountFixture, type FixtureSource } from "../runtime/fixtures"
import type { BenchmarkScenario } from "../types"

function runExtractionScenario(source: FixtureSource, url: string) {
  installDomEnvironment(`https://example.com${url}`)
  try {
    mountFixture(source, { url })
    const plan = resolveExtractionPlan(document, "article")

    const execution: ArticleExtractionExecution = {
      scope: plan.scope,
      rootId: plan.root.id || null,
      blockCount: plan.blocks.length,
      blockTexts: plan.blocks.map((block) => block.text),
      leakedTexts: [],
    }

    return execution
  } finally {
    cleanupDomEnvironment()
  }
}

export const articleExtractionScenarios: BenchmarkScenario<ArticleExtractionExecution>[] = [
  {
    id: "article-extraction/docs-sidebar-root",
    title: "Docs fixture resolves the article content root instead of the sidebar",
    surface: "article-extraction",
    fixture: "docs-sidebar-heavy",
    task: "Choose the main article container on a documentation page with sidebar chrome.",
    run: async () => runExtractionScenario({ kind: "page", name: "docs-sidebar-heavy" }, "/fixtures/docs-sidebar-heavy"),
    evaluate: (execution) => evaluateArticleExtraction(execution, {
      scope: "article",
      rootId: "docs-article",
    }),
  },
  {
    id: "article-extraction/blog-comments-rejected",
    title: "Blog fixture excludes noisy comments from article-mode extraction",
    surface: "article-extraction",
    fixture: "blog-comments-mixed",
    task: "Keep article text while excluding lower-value comment content from article mode.",
    run: async () => {
      const execution = runExtractionScenario({ kind: "page", name: "blog-comments-mixed" }, "/fixtures/blog-comments-mixed")
      execution.leakedTexts = ["@maya", "@leo"].filter((needle) =>
        execution.blockTexts.some((text) => text.includes(needle)),
      )
      return execution
    },
    evaluate: (execution) => evaluateArticleExtraction(execution, {
      scope: "article",
      rootId: "blog-article",
      shouldExcludeTexts: ["@maya", "@leo"],
    }),
  },
  {
    id: "article-extraction/forum-thread-fallback",
    title: "Forum fixture falls back to page scope when no article root exists",
    surface: "article-extraction",
    fixture: "forum-thread",
    task: "Stay on page scope instead of forcing an article root for forum-style layouts.",
    run: async () => runExtractionScenario({ kind: "page", name: "forum-thread" }, "/fixtures/forum-thread"),
    evaluate: (execution) => evaluateArticleExtraction(execution, {
      scope: "page",
      rootId: null,
    }),
  },
]
