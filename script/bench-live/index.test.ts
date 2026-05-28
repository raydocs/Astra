import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import { formatLiveBenchScenarioList, holdoutScenarios, resolveLiveScenario } from "./index"
import {
  liveScenarios,
  popupDeepReadProofScenario,
  documentIntakeBasicScenario,
  documentIntakeLocalFileHandoffScenario,
  pdfReaderBasicScenario,
  epubReaderBasicScenario,
  subtitleFileBasicScenario,
  pageTranslationArticleBasicSourceScenario,
  pageTranslationFullPageTitleShadowSourceScenario,
  frameCoordinationBasicScenario,
  frameCoordinationCrossOriginFallbackScenario,
  selectionSaveReviewLoopScenario,
  vocabularySrsSmokeScenario,
  learningLoopRevisitSmokeScenario,
  youtubeSubtitlePlayerButtonScenario,
  youtubeSubtitleInPlayerSettingsScenario,
  youtubeSubtitleBasicBilingualScenario,
  youtubeSubtitleSeekRecoveryScenario,
  youtubeSubtitleTrackSwitchScenario,
  youtubeTranscriptPanelScenario,
  youtubeTranscriptSearchJumpScenario,
  youtubeSaveSentenceReviewLoopScenario,
  youtubeVideoNoteCreateScenario,
} from "./scenarios"

const sourceCoreScenarioIds = [
  pageTranslationArticleBasicSourceScenario.id,
  pageTranslationFullPageTitleShadowSourceScenario.id,
  "bench-live/article-extraction-proof",
  "bench-live/dynamic-content-append",
  frameCoordinationBasicScenario.id,
  frameCoordinationCrossOriginFallbackScenario.id,
]

const documentProofScenarioIds = [
  documentIntakeBasicScenario.id,
  documentIntakeLocalFileHandoffScenario.id,
  pdfReaderBasicScenario.id,
  epubReaderBasicScenario.id,
  subtitleFileBasicScenario.id,
]

const learningLoopScenarioIds = [
  vocabularySrsSmokeScenario.id,
  selectionSaveReviewLoopScenario.id,
  learningLoopRevisitSmokeScenario.id,
]

const youtubeProofScenarioIds = [
  youtubeSubtitlePlayerButtonScenario.id,
  youtubeSubtitleInPlayerSettingsScenario.id,
  youtubeSubtitleBasicBilingualScenario.id,
  youtubeSubtitleSeekRecoveryScenario.id,
  youtubeSubtitleTrackSwitchScenario.id,
  youtubeTranscriptPanelScenario.id,
  youtubeTranscriptSearchJumpScenario.id,
  youtubeSaveSentenceReviewLoopScenario.id,
  youtubeVideoNoteCreateScenario.id,
]

const youtubeHoldoutScenarioIds = [
  "bench-live/holdout/youtube-subtitle-race",
  "bench-live/holdout/youtube-no-captions",
  "bench-live/holdout/youtube-asr-only",
  "bench-live/holdout/youtube-long-video",
  "bench-live/holdout/youtube-fullscreen",
  "bench-live/holdout/youtube-spa-navigation",
]

describe("bench-live scenario registry", () => {
  it("surfaces the P2.7 YouTube proof scenarios", () => {
    const expected = youtubeProofScenarioIds

    const list = formatLiveBenchScenarioList(liveScenarios)
    for (const id of expected) {
      expect(liveScenarios.some((scenario) => scenario.id === id)).toBe(true)
      expect(resolveLiveScenario(id).id).toBe(id)
      expect(list).toContain(id)
    }
  })

  it("surfaces popup deep-read under the canonical proof id", () => {
    expect(liveScenarios.some((scenario) => scenario.id === popupDeepReadProofScenario.id)).toBe(true)

    const list = formatLiveBenchScenarioList(liveScenarios)
    expect(list).toContain(popupDeepReadProofScenario.id)
    expect(list).not.toContain("bench-live/popup-deep-read-smoke")
  })

  it("resolves explicit YouTube P2.7 holdout scenarios", () => {
    const expected = youtubeHoldoutScenarioIds
    const list = formatLiveBenchScenarioList(holdoutScenarios)

    for (const id of expected) {
      expect(holdoutScenarios.some((scenario) => scenario.id === id)).toBe(true)
      expect(resolveLiveScenario(id).id).toBe(id)
      expect(list).toContain(id)
    }
  })

  it("wires package-level source-core, document proof, learning-loop, YouTube proof, and holdout lanes to the canonical scenario IDs", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
      scripts?: Record<string, string>
    }
    const scripts = packageJson.scripts ?? {}

    expect(scripts["bench:live:lane:source-core"]).toBeTypeOf("string")
    expect(scripts["bench:live:lane:document-proof"]).toBeTypeOf("string")
    expect(scripts["bench:live:lane:learning-loop"]).toBeTypeOf("string")
    expect(scripts["bench:live:lane:popup-proof"]).toBeTypeOf("string")
    expect(scripts["bench:live:lane:youtube-proof"]).toBeTypeOf("string")
    expect(scripts["bench:live:lane:youtube-holdout"]).toBeTypeOf("string")
    expect(scripts["bench:live:lane:release-proof"]).toBeTypeOf("string")
    expect(scripts["bench:live:lane:release-proof"]).toContain("pnpm bench:live:lane:source-core")
    expect(scripts["bench:live:lane:release-proof"]).toContain("pnpm bench:live:lane:extension-core")
    expect(scripts["bench:live:lane:release-proof"]).toContain("pnpm bench:live:lane:learning-loop")
    expect(scripts["bench:live:lane:release-proof"]).toContain("pnpm bench:live:lane:document-proof")
    expect(scripts["bench:live:lane:release-proof"]).toContain("pnpm bench:live:lane:youtube-proof")
    expect(scripts["bench:live:lane:release-proof"]).toContain("pnpm bench:live:lane:youtube-holdout")

    for (const id of sourceCoreScenarioIds) {
      expect(scripts["bench:live:lane:source-core"]).toContain(`--scenario ${id}`)
    }

    for (const id of documentProofScenarioIds) {
      expect(scripts["bench:live:lane:document-proof"]).toContain(`--scenario ${id}`)
    }

    expect(scripts["bench:live:lane:learning-loop"]).toContain("pnpm bench:live:lane:popup-proof")
    expect(scripts["bench:live:lane:popup-proof"]).toContain(`--scenario ${popupDeepReadProofScenario.id}`)

    for (const id of learningLoopScenarioIds) {
      expect(scripts["bench:live:lane:learning-loop"]).toContain(`--scenario ${id}`)
    }

    for (const id of youtubeProofScenarioIds) {
      expect(scripts["bench:live:lane:youtube-proof"]).toContain(`--scenario ${id}`)
    }

    for (const id of youtubeHoldoutScenarioIds) {
      expect(scripts["bench:live:lane:youtube-holdout"]).toContain(`--scenario ${id}`)
    }
  })

  it("resolves the legacy popup smoke id to the canonical proof scenario", () => {
    expect(resolveLiveScenario("bench-live/popup-deep-read-proof").id).toBe(popupDeepReadProofScenario.id)
    expect(resolveLiveScenario("bench-live/popup-deep-read-smoke").id).toBe(popupDeepReadProofScenario.id)
  })
})
