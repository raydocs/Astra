import { evaluatePdfTranslation, type PdfTranslationExecution } from "../evaluators/pdf"
import {
  PDF_READER_FIRST_CUT_FIXTURE,
  PDF_READER_LAYOUT_NOISE_FIXTURE,
  runPdfReaderHarness,
} from "./helpers/pdf-reader"
import type { BenchmarkScenario, ScenarioCodeHint } from "../types"

const PDF_HINT: ScenarioCodeHint = {
  suspectedFiles: [
    "src/entrypoints/pdf-reader/PdfReaderApp.tsx",
    "src/entrypoints/pdf-reader/pdf-extractor.ts",
    "src/entrypoints/pdf-reader/pdf-translator.ts",
    "src/entrypoints/content/pdf-detect.ts",
  ],
  suspectedSymbols: [
    "PdfReaderApp",
    "extractPdfPages",
    "translatePdfPage",
    "detectAndShowPdfBanner",
  ],
  suspectedKeywords: [
    "pdf",
    "bilingual",
    "translation-only",
    "pdfjs",
  ],
  fallbackSurfaceFiles: [
    "src/entrypoints/pdf-reader/PdfReaderApp.tsx",
    "src/entrypoints/pdf-reader/pdf-extractor.ts",
  ],
  risk: "cross-module",
}

function createPdfScenario(params: {
  id: string
  title: string
  fixtureName: string
  task: string
}) : BenchmarkScenario<PdfTranslationExecution> {
  return {
    id: params.id,
    title: params.title,
    surface: "pdf",
    fixture: `pdf:${params.fixtureName}`,
    task: params.task,
    codeHint: PDF_HINT,
    run: async () => {
      const { execution } = await runPdfReaderHarness({
        fixtureName: params.fixtureName,
      })
      return execution
    },
    evaluate: (execution) => evaluatePdfTranslation(execution, { requirePrivacyIsolation: true }),
  }
}

export const pdfTranslationScenarios: BenchmarkScenario<PdfTranslationExecution>[] = [
  createPdfScenario({
    id: "pdf-reader/bilingual-translation-only-first-cut",
    title: "PDF reader first cut renders bilingual and translation-only pages from extracted PDF blocks",
    fixtureName: PDF_READER_FIRST_CUT_FIXTURE,
    task: "Extract a small PDF fixture, translate its text blocks, and render a fixture-based PDF reader skeleton in bilingual and translation-only modes.",
  }),
  createPdfScenario({
    id: "pdf-reader/layout-noise-stability",
    title: "PDF reader preserves bilingual and translation-only rendering under layout noise",
    fixtureName: PDF_READER_LAYOUT_NOISE_FIXTURE,
    task: "Extract a noisier PDF fixture with side-note-like blocks and verify that bilingual and translation-only rendering preserve block parity and translation coverage.",
  }),
]
