/**
 * Frame coordinator — discovers frames in a tab and fans out
 * content commands to all translatable frames, aggregating responses.
 */

import { browser } from "#imports"
import type {
  ContentCommand,
  ContentCommandResponse,
} from "@/types/messages"
import { isContentCommandResponse } from "@/types/messages"
import {
  createTranslationError,
  DEFAULT_TRANSLATION_PRESENTATION,
  EMPTY_TRANSLATION_PROGRESS,
  IDLE_TRANSLATION_SNAPSHOT,
  type TranslationPhase,
  type TranslationProgressSnapshot,
  type TranslationSnapshot,
} from "@/types/translation"

interface FrameEntry {
  frameId: number
  parentFrameId: number
  url: string
}

interface FrameSnapshot {
  frameId: number
  snapshot: TranslationSnapshot
}

async function getTabFrames(tabId: number): Promise<FrameEntry[]> {
  try {
    const frames = await browser.webNavigation.getAllFrames({ tabId })
    return (frames ?? []).map((f) => ({
      frameId: f.frameId,
      parentFrameId: f.parentFrameId,
      url: f.url,
    }))
  } catch {
    return []
  }
}

function isTranslatableFrame(frame: FrameEntry): boolean {
  return /^https?:/.test(frame.url)
}

async function sendToFrame(
  tabId: number,
  frameId: number,
  command: ContentCommand,
): Promise<ContentCommandResponse | null> {
  try {
    const response = await browser.tabs.sendMessage(tabId, command, { frameId }) as unknown
    if (!isContentCommandResponse(response)) return null
    return response
  } catch {
    return null
  }
}

function aggregateProgress(snapshots: TranslationSnapshot[]): TranslationProgressSnapshot {
  if (snapshots.length === 0) return { ...EMPTY_TRANSLATION_PROGRESS }

  return {
    totalBlocks: snapshots.reduce((sum, s) => sum + s.progress.totalBlocks, 0),
    queuedBlocks: snapshots.reduce((sum, s) => sum + s.progress.queuedBlocks, 0),
    inFlightBlocks: snapshots.reduce((sum, s) => sum + s.progress.inFlightBlocks, 0),
    translatedBlocks: snapshots.reduce((sum, s) => sum + s.progress.translatedBlocks, 0),
    failedBlocks: snapshots.reduce((sum, s) => sum + s.progress.failedBlocks, 0),
  }
}

function aggregatePhase(snapshots: TranslationSnapshot[]): TranslationPhase {
  if (snapshots.some((s) => s.phase === "running")) return "running"
  if (snapshots.some((s) => s.phase === "starting")) return "starting"
  if (snapshots.some((s) => s.phase === "stopping")) return "stopping"
  return "idle"
}

function buildFallbackTopFrameSnapshot(topFrame: FrameEntry | undefined): TranslationSnapshot {
  const hostname = topFrame
    ? (() => {
        try {
          return new URL(topFrame.url).hostname || null
        } catch {
          return null
        }
      })()
    : null

  return {
    ...IDLE_TRANSLATION_SNAPSHOT,
    presentation: { ...DEFAULT_TRANSLATION_PRESENTATION },
    site: {
      hostname,
      enabled: true,
      alwaysTranslate: false,
    },
  }
}

function buildAggregateSnapshot(
  frameSnapshots: FrameSnapshot[],
  framesTotal: number,
  topFrame?: FrameEntry,
): TranslationSnapshot {
  if (frameSnapshots.length === 0) {
    return { ...buildFallbackTopFrameSnapshot(topFrame), framesTotal, framesTranslating: 0 }
  }

  const snapshots = frameSnapshots.map(({ snapshot }) => snapshot)
  const topFrameSnapshot = frameSnapshots.find(({ frameId }) => frameId === 0)?.snapshot
  const base = topFrameSnapshot ?? buildFallbackTopFrameSnapshot(topFrame)
  const phase = aggregatePhase(snapshots)
  const framesTranslating = snapshots.filter((s) => s.phase !== "idle").length

  return {
    phase,
    sessionId: topFrameSnapshot?.sessionId ?? base.sessionId,
    targetLang: topFrameSnapshot?.targetLang ?? base.targetLang,
    lastError: topFrameSnapshot?.lastError ?? snapshots.find((s) => s.lastError)?.lastError ?? null,
    progress: aggregateProgress(snapshots),
    presentation: topFrameSnapshot?.presentation ?? base.presentation,
    site: topFrameSnapshot?.site ?? base.site,
    framesTotal,
    framesTranslating,
  }
}

/**
 * Execute a content command across all translatable frames in a tab.
 * Returns an aggregate ContentCommandResponse.
 */
export async function executeTabCommand(
  tabId: number,
  command: ContentCommand,
): Promise<ContentCommandResponse> {
  const frames = await getTabFrames(tabId)
  const translatableFrames = frames.filter(isTranslatableFrame)
  const topFrame = translatableFrames.find((frame) => frame.frameId === 0)

  if (translatableFrames.length === 0) {
    return {
      ok: false,
      error: createTranslationError(
        "CONTENT_UNAVAILABLE",
        "No translatable frames found.",
      ),
    }
  }

  if (translatableFrames.length === 1) {
    const response = await sendToFrame(tabId, translatableFrames[0].frameId, command)
    if (!response) {
      return {
        ok: false,
        error: createTranslationError(
          "CONTENT_UNAVAILABLE",
          "Astra cannot run on this page.",
        ),
      }
    }

    if (response.ok) {
      return {
        ok: true,
        state: {
          ...response.state,
          framesTotal: 1,
          framesTranslating: response.state.phase !== "idle" ? 1 : 0,
        },
      }
    }
    return response
  }

  const responses = await Promise.all(
    translatableFrames.map(async (frame) => ({
      frameId: frame.frameId,
      response: await sendToFrame(tabId, frame.frameId, command),
    })),
  )

  const validResponses = responses.filter(
    (
      result,
    ): result is { frameId: number; response: ContentCommandResponse } => result.response !== null,
  )

  if (validResponses.length === 0) {
    return {
      ok: false,
      error: createTranslationError(
        "CONTENT_UNAVAILABLE",
        "Astra cannot run on this page.",
      ),
    }
  }

  const snapshots = validResponses
    .map(({ frameId, response }) => ({
      frameId,
      snapshot: response.ok ? response.state : response.state ?? null,
    }))
    .filter((entry): entry is FrameSnapshot => entry.snapshot !== null)

  if (snapshots.length === 0) {
    const firstError = validResponses.find(({ response }) => !response.ok)
    return firstError?.response ?? {
      ok: false,
      error: createTranslationError("UNKNOWN", "All frames failed to respond."),
    }
  }

  const aggregated = buildAggregateSnapshot(snapshots, translatableFrames.length, topFrame)

  const firstError = validResponses.find(({ response }) => !response.ok)
  if (firstError && !firstError.response.ok && aggregated.phase === "idle") {
    return {
      ok: false,
      error: firstError.response.error,
      state: aggregated,
    }
  }

  return {
    ok: true,
    state: aggregated,
  }
}
