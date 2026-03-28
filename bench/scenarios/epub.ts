import type { BenchmarkScenario, ScenarioCodeHint } from "../types"
import { evaluateEpubTranslation, type EpubTranslationExecution } from "../evaluators/epub"
import {
  EPUB_READER_FIRST_CUT_FIXTURE,
  EPUB_READER_LONG_CHAPTER_FIXTURE,
  runEpubReaderHarness,
} from "./helpers/epub-reader"

const EPUB_CODE_HINT: ScenarioCodeHint = {
  suspectedFiles: [
    "src/entrypoints/epub-reader/EpubReaderApp.tsx",
    "src/entrypoints/epub-reader/main.tsx",
  ],
  suspectedSymbols: [
    "EpubReaderApp",
    "loadBook",
    "openChapter",
    "chapterGenRef",
  ],
  suspectedKeywords: [
    "epub",
    "chapter",
    "bilingual",
    "translation-only",
    "resume",
  ],
  fallbackSurfaceFiles: [
    "src/entrypoints/epub-reader/EpubReaderApp.tsx",
    "src/entrypoints/epub-reader/main.tsx",
  ],
  risk: "cross-module",
}

export const epubTranslationScenarios: BenchmarkScenario<EpubTranslationExecution>[] = [
  {
    id: "epub-reader/bilingual-translation-only-first-cut",
    title: "EPUB reader first cut renders bilingual and translation-only chapter views",
    surface: "epub",
    fixture: `epub:${EPUB_READER_FIRST_CUT_FIXTURE}`,
    task: "Load a small EPUB-style chapter fixture, translate the active chapter in batches, and render bilingual plus translation-only reader views with preserved chapter navigation.",
    codeHint: EPUB_CODE_HINT,
    run: () => runEpubReaderHarness({ fixtureName: EPUB_READER_FIRST_CUT_FIXTURE }).then((result) => result.execution),
    evaluate: (execution) => evaluateEpubTranslation(execution, {
      expectedChapterCount: 3,
      expectedActiveChapterTitle: "Chapter 2 — Signals",
      expectedTranslationRequestCount: 2,
      requireReadingStateRestored: true,
    }),
  },
  {
    id: "epub-reader/long-chapter-resume-stability",
    title: "EPUB reader preserves chapter resume state under a longer chapter workload",
    surface: "epub",
    fixture: `epub:${EPUB_READER_LONG_CHAPTER_FIXTURE}`,
    task: "Translate a longer active chapter, preserve chapter ordering, and verify that the restored reading state still points at the expected chapter.",
    codeHint: EPUB_CODE_HINT,
    run: () => runEpubReaderHarness({ fixtureName: EPUB_READER_LONG_CHAPTER_FIXTURE }).then((result) => result.execution),
    evaluate: (execution) => evaluateEpubTranslation(execution, {
      expectedChapterCount: 3,
      expectedActiveChapterTitle: "Chapter 3 — Resume",
      expectedTranslationRequestCount: 4,
      requireReadingStateRestored: true,
    }),
  },
]
