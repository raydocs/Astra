import { evaluateArticleExtraction, type ArticleExtractionExecution } from "../evaluators/article-extraction"
import { cleanupDomEnvironment, installDomEnvironment } from "../runtime/dom"
import { mountFixture } from "../runtime/fixtures"
import { buildArticleExtractionExecutionFromDocument } from "./helpers/article-extraction"
import { articleExtractionCaseDefinitions, type ArticleExtractionCaseDefinition } from "./helpers/article-extraction-fixtures"
import type { BenchmarkScenario, ScenarioCodeHint } from "../types"

const ARTICLE_EXTRACTION_CODE_HINT: ScenarioCodeHint = {
  suspectedFiles: [
    "src/utils/dom/extraction.ts",
    "src/utils/dom/traversal.ts",
  ],
  suspectedSymbols: [
    "resolveArticleRoot",
    "resolveExtractionPlan",
    "collectTextBlocks",
    "buildContentSummary",
  ],
  suspectedKeywords: [
    "ARTICLE_ROOT_SELECTORS",
    "NAV_SIDEBAR_SELECTOR",
    "article",
    "main content",
    "empty",
    "under-extracted",
    "over-extracted",
    "wrong-root",
  ],
  fallbackSurfaceFiles: [
    "src/utils/dom/extraction.ts",
    "src/utils/dom/traversal.ts",
  ],
  risk: "local",
}

function runExtractionScenario(definition: ArticleExtractionCaseDefinition): ArticleExtractionExecution {
  installDomEnvironment(`https://example.com${definition.url}`)

  try {
    mountFixture({ kind: "page", name: definition.fixtureName }, { url: definition.url })

    return buildArticleExtractionExecutionFromDocument({
      doc: document,
      contentScope: "article",
      shouldExcludeTexts: definition.expected.shouldExcludeTexts,
      notes: [
        `fixture=${definition.fixtureName}`,
        `expected-root=${definition.expected.scope}:${definition.expected.rootId ?? "BODY"}`,
        `expected-block-range=${definition.expected.minBlockCount ?? 0}-${definition.expected.maxBlockCount ?? "∞"}`,
        ...(definition.expected.expectedRootNote ? [definition.expected.expectedRootNote] : []),
      ],
    })
  } finally {
    cleanupDomEnvironment()
  }
}

export const articleExtractionScenarios: BenchmarkScenario<ArticleExtractionExecution>[] = articleExtractionCaseDefinitions.map(
  (definition) => ({
    id: definition.id,
    title: definition.title,
    surface: "article-extraction",
    fixture: definition.fixtureName,
    task: definition.task,
    codeHint: ARTICLE_EXTRACTION_CODE_HINT,
    run: async () => runExtractionScenario(definition),
    evaluate: (execution) => evaluateArticleExtraction(execution, definition.expected),
  }),
)
