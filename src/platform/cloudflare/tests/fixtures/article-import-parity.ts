import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

export interface ArticleImportParityFixture {
  id: string
  description: string
  sourcePath: string
  url: string
  html: string
}

interface FixtureSource {
  id: string
  description: string
  fileName: string
}

const FIXTURE_SOURCES: FixtureSource[] = [
  {
    id: "article-basic",
    description: "clean article root with minimal chrome",
    fileName: "article-basic.html",
  },
  {
    id: "article-with-sidebar",
    description: "article with nav + sidebar noise",
    fileName: "article-with-sidebar.html",
  },
  {
    id: "blog-comments-mixed",
    description: "article body mixed with lower-value comments",
    fileName: "blog-comments-mixed.html",
  },
  {
    id: "knowledge-base-longform",
    description: "knowledge-base longform with side navigation",
    fileName: "knowledge-base-longform.html",
  },
  {
    id: "docs-sidebar-heavy",
    description: "documentation page with dense sidebar chrome",
    fileName: "docs-sidebar-heavy.html",
  },
  {
    id: "forum-thread",
    description: "forum thread with lower-signal replies and metadata clutter",
    fileName: "forum-thread.html",
  },
  {
    id: "nested-blocks",
    description: "article-like content with nested layout containers",
    fileName: "nested-blocks.html",
  },
]

const SHARED_FIXTURE_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../../test/fixtures/pages",
)

export async function loadArticleImportParityFixtures(): Promise<ArticleImportParityFixture[]> {
  return Promise.all(FIXTURE_SOURCES.map(async (fixture) => {
    const sourcePath = `test/fixtures/pages/${fixture.fileName}`
    const absolutePath = path.resolve(SHARED_FIXTURE_ROOT, fixture.fileName)
    const html = await readFile(absolutePath, "utf8")

    return {
      id: fixture.id,
      description: fixture.description,
      sourcePath,
      url: `https://fixtures.astra.test/${fixture.id}`,
      html,
    }
  }))
}
