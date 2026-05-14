import type { ArticleExtractionExpectation } from "../../evaluators/article-extraction"

export interface ArticleExtractionCaseDefinition {
  id: string
  title: string
  fixtureName: string
  url: string
  task: string
  expected: ArticleExtractionExpectation
}

export const articleExtractionCaseDefinitions: ArticleExtractionCaseDefinition[] = [
  {
    id: "article-extraction/docs-sidebar-root",
    title: "Docs fixture resolves the article content root instead of the sidebar",
    fixtureName: "docs-sidebar-heavy",
    url: "/fixtures/docs-sidebar-heavy",
    task: "Choose the main article container on a documentation page with sidebar chrome.",
    expected: {
      scope: "article",
      rootId: "docs-article",
      minBlockCount: 5,
      maxBlockCount: 5,
      shouldExcludeTexts: ["Docs", "Guides", "API", "On this page", "Overview", "Routing", "Streaming", "Errors"],
      expectedRootNote:
        "Expected article#docs-article because docs layouts have a longform article container and sidebar chrome must stay out of article mode.",
    },
  },
  {
    id: "article-extraction/blog-comments-rejected",
    title: "Blog fixture excludes noisy comments from article-mode extraction",
    fixtureName: "blog-comments-mixed",
    url: "/fixtures/blog-comments-mixed",
    task: "Keep article text while excluding lower-value comment content from article mode.",
    expected: {
      scope: "article",
      rootId: "blog-article",
      minBlockCount: 5,
      maxBlockCount: 5,
      shouldExcludeTexts: ["@maya", "@leo"],
      expectedRootNote:
        "Expected article#blog-article because article mode should keep the post body and reject adjacent comment noise.",
    },
  },
  {
    id: "article-extraction/forum-thread-fallback",
    title: "Forum fixture falls back to page scope when no article root exists",
    fixtureName: "forum-thread",
    url: "/fixtures/forum-thread",
    task: "Stay on page scope instead of forcing an article root for forum-style layouts.",
    expected: {
      scope: "page",
      rootId: null,
      minBlockCount: 7,
      maxBlockCount: 7,
      expectedRootNote:
        "Expected page scope (BODY) because forum threads are multi-post layouts rather than one coherent article root.",
    },
  },
  {
    id: "article-extraction/landing-page-fallback",
    title: "Landing fixture stays on page scope instead of inventing a longform article",
    fixtureName: "marketing-landing",
    url: "/fixtures/marketing-landing",
    task: "Treat a marketing landing page as page scope and keep navigation chrome out of extracted blocks.",
    expected: {
      scope: "page",
      rootId: null,
      minBlockCount: 9,
      maxBlockCount: 9,
      shouldExcludeTexts: ["Pricing", "Customers", "Download", "Get started"],
      expectedRootNote:
        "Expected page scope (BODY) because the landing page has multiple promotional sections but no dedicated article container.",
    },
  },
]
