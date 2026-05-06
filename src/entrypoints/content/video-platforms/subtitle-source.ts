export type PlatformSubtitlePlatform = "youtube" | "bilibili" | "generic"

export type PlatformSubtitleSourceKind = "youtube-timedtext" | "bilibili-api" | "html-text-track"

export interface PlatformSubtitleCue {
  startTime: number
  endTime: number
  text: string
}

export interface PlatformSubtitleTrack {
  id: string
  language: string | null
  label: string | null
  kind: "subtitles" | "captions"
  platform: PlatformSubtitlePlatform
  source: PlatformSubtitleSourceKind
  cues: PlatformSubtitleCue[]
}

export interface PlatformSubtitleLoadOptions {
  targetLang: string
  astraTrackLabelPrefix: string
}

export interface PlatformSubtitleSource {
  platform: PlatformSubtitlePlatform
  canLoad(url: URL, document: Document): boolean
  loadTracks(video: HTMLVideoElement, options: PlatformSubtitleLoadOptions): Promise<PlatformSubtitleTrack[]>
}

export function normalizeSubtitleLanguage(language?: string | null): string {
  return (language ?? "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-")
}

export function stripSubtitleMarkup(text: string): string {
  return text
    .replace(/<\/?[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

export function dedupeAdjacentSubtitleCues(cues: PlatformSubtitleCue[]): PlatformSubtitleCue[] {
  const deduped: PlatformSubtitleCue[] = []

  for (const cue of [...cues].sort((left, right) => left.startTime - right.startTime)) {
    const previous = deduped.at(-1)
    if (
      previous
      && previous.text === cue.text
      && Math.abs(previous.startTime - cue.startTime) < 0.05
      && Math.abs(previous.endTime - cue.endTime) < 0.05
    ) {
      continue
    }
    deduped.push(cue)
  }

  return deduped
}
