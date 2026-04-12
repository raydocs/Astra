import type { BenchmarkScenario, ScenarioCodeHint } from "../types"
import { evaluateSubtitleFile, type SubtitleFileExecution } from "../evaluators/subtitle-file"
import { runSubtitleFileHarness } from "./helpers/subtitle-file"

const SUBTITLE_FILE_CODE_HINT: ScenarioCodeHint = {
  suspectedFiles: [
    "src/entrypoints/subtitle-reader/subtitle-parser.ts",
    "src/entrypoints/subtitle-reader/SubtitleReaderApp.tsx",
    "src/entrypoints/subtitle-reader/main.tsx",
    "src/entrypoints/subtitle-reader/index.html",
  ],
  suspectedSymbols: [
    "parseSubtitles",
    "exportBilingualSrt",
    "exportBilingualVtt",
    "SubtitleReaderApp",
  ],
  suspectedKeywords: [
    "subtitle",
    "SRT",
    "VTT",
    "bilingual",
    "preview",
    "export",
  ],
  fallbackSurfaceFiles: [
    "src/entrypoints/subtitle-reader/subtitle-parser.ts",
    "src/entrypoints/subtitle-reader/SubtitleReaderApp.tsx",
  ],
  risk: "cross-module",
}

const SRT_FIXTURE = `1
00:00:01,000 --> 00:00:04,000
Hello Astra

2
00:00:05,000 --> 00:00:08,000
Subtitle files are now first-class.`

const VTT_FIXTURE = `WEBVTT

00:00:01.000 --> 00:00:04.000
Hello Astra

00:00:05.000 --> 00:00:08.000
Subtitle files are now first-class.`

export const subtitleFileScenarios: BenchmarkScenario<SubtitleFileExecution>[] = [
  {
    id: "subtitle-file/roundtrip-ingest-preview",
    title: "Subtitle-file translation ingests SRT and VTT and exports bilingual previews",
    surface: "subtitle-file",
    fixture: "files:subtitle-file-roundtrip",
    task: "Ingest subtitle files, translate them in batches, render bilingual/translation-only previews, and export the translated files without breaking timing.",
    codeHint: SUBTITLE_FILE_CODE_HINT,
    run: () => runSubtitleFileHarness([
      { fileName: "demo.srt", content: SRT_FIXTURE, previewMode: "bilingual" },
      { fileName: "demo.vtt", content: VTT_FIXTURE, previewMode: "translation-only" },
    ]).then((result) => result.execution),
    evaluate: (execution) => evaluateSubtitleFile(execution, {
      expectedFileCount: 2,
      expectedCueCount: 4,
      expectedFormats: ["srt", "vtt"],
      expectedExportFormats: ["srt", "vtt"],
      expectedRequestCount: 2,
      expectedPreviewSections: 2,
      requireTimingPreserved: true,
      requirePrivacyIsolation: true,
    }),
  },
  {
    id: "subtitle-file/privacy-no-page-context",
    title: "Subtitle-file translation keeps local file requests free of page context",
    surface: "subtitle-file",
    fixture: "files:subtitle-file-privacy",
    task: "Translate a local subtitle file without leaking page, selection, or document metadata into runtime translate-batch requests.",
    codeHint: SUBTITLE_FILE_CODE_HINT,
    run: () => runSubtitleFileHarness([
      { fileName: "privacy-check.srt", content: SRT_FIXTURE, previewMode: "bilingual" },
    ]).then((result) => result.execution),
    evaluate: (execution) => evaluateSubtitleFile(execution, {
      expectedFileCount: 1,
      expectedCueCount: 2,
      expectedFormats: ["srt"],
      expectedExportFormats: ["srt", "vtt"],
      expectedRequestCount: 1,
      expectedPreviewSections: 1,
      requireTimingPreserved: true,
      requirePrivacyIsolation: true,
    }),
  },
]
