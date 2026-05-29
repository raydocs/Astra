// Single source of truth for video replay timestamps. Used by the YouTube
// transcript panel, the Review "return to this moment" link, and the
// VideoMomentCard derived view — so the replay URL + formatting stay identical.

/** Append a play-from-timestamp marker to a video URL (YouTube uses `?t=Ns`). */
export function buildVideoTimestampUrl(baseUrl: string, timestampMs: number): string {
  const seconds = Math.max(0, Math.floor(timestampMs / 1000))
  try {
    const url = new URL(baseUrl)
    if (url.hostname.includes("youtube.com") || url.hostname === "youtu.be") {
      url.searchParams.set("t", `${seconds}s`)
    } else {
      url.searchParams.set("t", String(seconds))
    }
    return url.toString()
  } catch {
    return baseUrl
  }
}

/**
 * Sanitize a video URL for storage / source-return: keep only the content
 * identity (the YouTube `?v=` id; youtu.be keeps it in the path) and drop all
 * tracking params + hash. Unlike the page sanitizer (which strips the whole
 * query), this preserves the one param that makes a video moment replayable.
 */
export function sanitizeVideoSourceUrl(url?: string | null): string | undefined {
  const trimmed = url?.trim()
  if (!trimmed) return undefined
  try {
    const parsed = new URL(trimmed)
    const videoId = parsed.hostname.includes("youtube.com") ? parsed.searchParams.get("v") : null
    parsed.search = ""
    parsed.hash = ""
    if (videoId) parsed.searchParams.set("v", videoId)
    return parsed.toString()
  } catch {
    return trimmed
  }
}

/** Human `m:ss` (or `h:mm:ss`) label for a video timestamp. */
export function formatVideoTimestamp(timestampMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(timestampMs / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const mm = hours > 0 ? String(minutes).padStart(2, "0") : String(minutes)
  const ss = String(seconds).padStart(2, "0")
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`
}
