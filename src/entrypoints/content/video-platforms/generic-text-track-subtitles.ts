import {
  normalizeSubtitleLanguage,
  stripSubtitleMarkup,
  type PlatformSubtitleCue,
  type PlatformSubtitleSource,
  type PlatformSubtitleTrack,
} from "./subtitle-source"

const TEXT_TRACK_LOAD_WAIT_MS = 100

function isSubtitleOrCaptionTrack(track: TextTrack): boolean {
  return track.kind === "subtitles" || track.kind === "captions"
}

function isAstraTrack(track: TextTrack, labelPrefix: string): boolean {
  return (track.label ?? "").startsWith(labelPrefix)
}

function readCueText(cue: TextTrackCue): string | null {
  const VttCue = globalThis.VTTCue
  if (typeof VttCue === "function" && !(cue instanceof VttCue)) {
    return null
  }

  const rawText = "text" in cue && typeof cue.text === "string" ? cue.text : ""
  const text = stripSubtitleMarkup(rawText)
  return text || null
}

export function collectTextTrackSubtitleCues(track: TextTrack): PlatformSubtitleCue[] {
  if (!track.cues) return []

  const cues: PlatformSubtitleCue[] = []
  for (let index = 0; index < track.cues.length; index += 1) {
    const cue = track.cues[index]
    if (!cue) continue
    const text = readCueText(cue)
    if (!text) continue
    cues.push({
      startTime: cue.startTime,
      endTime: cue.endTime,
      text,
    })
  }
  return cues
}

function scoreTextTrack(track: TextTrack, targetLang: string, labelPrefix: string): number {
  if (isAstraTrack(track, labelPrefix) || !isSubtitleOrCaptionTrack(track)) {
    return Number.NEGATIVE_INFINITY
  }

  let score = 0
  if (track.mode === "showing") score += 10
  if (track.kind === "captions") score += 3
  if (normalizeSubtitleLanguage(track.language) !== normalizeSubtitleLanguage(targetLang)) score += 8
  if ((track.label ?? "").trim().length > 0) score += 2
  return score
}

function trackId(track: TextTrack, index: number): string {
  const id = typeof track.id === "string" && track.id.trim() ? track.id.trim() : String(index)
  return ["text-track", id, track.kind, track.label, track.language].join(":")
}

export const genericTextTrackSubtitleSource: PlatformSubtitleSource = {
  platform: "generic",
  canLoad: () => true,
  async loadTracks(video, options): Promise<PlatformSubtitleTrack[]> {
    const rankedTracks = Array.from(video.textTracks)
      .map((track, index) => ({
        track,
        index,
        score: scoreTextTrack(track, options.targetLang, options.astraTrackLabelPrefix),
      }))
      .filter((entry) => Number.isFinite(entry.score))
      .sort((left, right) => right.score - left.score)

    const loaded: PlatformSubtitleTrack[] = []

    for (const { track, index } of rankedTracks) {
      const previousMode = track.mode
      if (track.mode === "disabled") {
        track.mode = "hidden"
        await new Promise((resolve) => setTimeout(resolve, TEXT_TRACK_LOAD_WAIT_MS))
      }

      const cues = collectTextTrackSubtitleCues(track)

      if (previousMode === "disabled") {
        track.mode = previousMode
      }

      if (cues.length === 0) continue
      loaded.push({
        id: trackId(track, index),
        language: normalizeSubtitleLanguage(track.language) || null,
        label: track.label || null,
        kind: track.kind === "captions" ? "captions" : "subtitles",
        platform: "generic",
        source: "html-text-track",
        cues,
      })
    }

    return loaded
  },
}
