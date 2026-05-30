/**
 * Append a play-from-timestamp marker to a video URL — mobile mirror of
 * `buildVideoTimestampUrl` in `src/utils/video-timestamp-url.ts`. The native app
 * is a standalone Expo/Metro package and cannot import the repo's root `src/`, so
 * this is a faithful copy; keep it identical so a saved video moment opens at the
 * same spot on mobile, web, and desktop. `videoTimestamp.test.ts` pins the contract.
 */
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
