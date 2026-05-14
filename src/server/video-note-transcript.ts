import type {
  VideoNotePlatform,
  VideoNoteTranscriptSource,
  VideoTranscriptSegment,
} from "../types/video-notes"

interface YouTubeCaptionTrack {
  baseUrl?: string
  vssId?: string
  languageCode?: string
  kind?: string
  isTranslatable?: boolean
}

interface YouTubeStreamingFormat {
  mimeType?: string
  url?: string
  signatureCipher?: string
  cipher?: string
  bitrate?: number
}

interface TimedTextEvent {
  tStartMs?: number
  dDurationMs?: number
  segs?: Array<{ utf8?: string }>
}

interface TimedTextResponse {
  events?: TimedTextEvent[]
}

interface YouTubeTimedCue {
  startTime: number
  endTime: number
  text: string
}

interface YouTubePlayerResponse {
  videoDetails?: {
    title?: string
    lengthSeconds?: string
  }
  captions?: {
    playerCaptionsTracklistRenderer?: {
      captionTracks?: YouTubeCaptionTrack[]
    }
  }
  streamingData?: {
    adaptiveFormats?: YouTubeStreamingFormat[]
    formats?: YouTubeStreamingFormat[]
  }
}

interface OpenAiVerboseTranscriptionSegment {
  start?: number
  end?: number
  text?: string
}

interface OpenAiVerboseTranscriptionResponse {
  language?: string
  segments?: OpenAiVerboseTranscriptionSegment[]
}

interface ResolvedYouTubeAudioStream {
  url: string
  mimeType: string | null
}

interface ResolvedYouTubeVideoContext {
  videoId: string
  title: string | null
  durationSec: number | null
  deepLinkTemplate: string
  captionTrack: YouTubeCaptionTrack | null
  audioStream: ResolvedYouTubeAudioStream | null
}

export interface ResolvedVideoNoteTranscript {
  transcriptSegments: VideoTranscriptSegment[]
  transcriptSource: VideoNoteTranscriptSource
  transcriptLanguage: string | null
  deepLinkTemplate: string | null
  durationSec: number | null
  title: string | null
}

const YOUTUBE_PAGE_FETCH_TIMEOUT_MS = 15_000
const YOUTUBE_TIMEDTEXT_FETCH_TIMEOUT_MS = 15_000
const YOUTUBE_AUDIO_FETCH_TIMEOUT_MS = 20_000
const OPENAI_TRANSCRIPTION_FETCH_TIMEOUT_MS = 60_000
const MAX_YOUTUBE_WATCH_HTML_BYTES = 1_500_000
const MAX_YOUTUBE_TIMEDTEXT_BYTES = 4_000_000
const MAX_AUDIO_DOWNLOAD_BYTES = 25 * 1024 * 1024
const MAX_OPENAI_TRANSCRIPTION_BYTES = 10 * 1024 * 1024
const MAX_EXTERNAL_FETCH_REDIRECTS = 3
const MAX_TRANSCRIPT_SEGMENTS = 2_000
const MAX_TRANSCRIPT_TEXT_CHARS = 200_000

const YOUTUBE_WATCH_ALLOWED_HOSTS = [".youtube.com", "youtube.com"]
const YOUTUBE_TIMEDTEXT_ALLOWED_HOSTS = [
  ".youtube.com",
  "youtube.com",
  ".youtube-nocookie.com",
  "youtube-nocookie.com",
]
const YOUTUBE_MEDIA_ALLOWED_HOSTS = [
  ".googlevideo.com",
  "googlevideo.com",
  ".youtube.com",
  "youtube.com",
  ".youtube-nocookie.com",
  "youtube-nocookie.com",
]
const OPENAI_ALLOWED_HOSTS = ["api.openai.com"]

class SafeTranscriptError extends Error {}

function normalizeYouTubeCaptionText(text: string): string {
  return text
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function collapseAdjacentDuplicates(parts: string[]): string[] {
  const normalized: string[] = []

  for (const part of parts) {
    const text = normalizeYouTubeCaptionText(part)
    if (!text) continue
    if (normalized.at(-1) === text) continue
    normalized.push(text)
  }

  return normalized
}

function normalizeLanguageCode(languageCode?: string): string {
  return (languageCode ?? "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-")
}

function buildServerFetchHeaders(): HeadersInit {
  return {
    "User-Agent": "Mozilla/5.0 (compatible; AstraRelay/1.0; +https://astra.example)",
    "Accept-Language": "en-US,en;q=0.9",
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError"
}

function createTimedAbortSignal(timeoutMs: number, parentSignal?: AbortSignal): {
  signal: AbortSignal
  cleanup: () => void
} {
  const controller = new AbortController()
  const timer = setTimeout(() => {
    controller.abort(new DOMException("Request timed out.", "AbortError"))
  }, timeoutMs)

  const abortFromParent = () => {
    controller.abort(parentSignal?.reason ?? new DOMException("Request aborted.", "AbortError"))
  }

  if (parentSignal?.aborted) {
    abortFromParent()
  } else if (parentSignal) {
    parentSignal.addEventListener("abort", abortFromParent, { once: true })
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer)
      parentSignal?.removeEventListener("abort", abortFromParent)
    },
  }
}

function isHostAllowed(hostname: string, allowedHosts: readonly string[]): boolean {
  const normalizedHostname = hostname.trim().toLowerCase()
  if (!normalizedHostname) return false
  return allowedHosts.some((allowedHost) => (
    allowedHost.startsWith(".")
      ? normalizedHostname.endsWith(allowedHost)
      : normalizedHostname === allowedHost
  ))
}

function assertAllowedFetchTarget(
  rawUrl: string,
  allowedHosts: readonly string[],
  purpose: string,
): URL {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    throw new SafeTranscriptError(`${purpose} URL could not be validated.`)
  }

  if (parsed.protocol !== "https:") {
    throw new SafeTranscriptError(`${purpose} URL was rejected by backend safety checks.`)
  }

  if (!isHostAllowed(parsed.hostname, allowedHosts)) {
    throw new SafeTranscriptError(`${purpose} host was rejected by backend safety checks.`)
  }

  return parsed
}

async function readResponseBytesWithLimit(
  response: Response,
  maxBytes: number,
  sizeLimitMessage: string,
): Promise<Uint8Array> {
  const contentLengthHeader = response.headers.get("Content-Length")
  if (contentLengthHeader && /^\d+$/.test(contentLengthHeader)) {
    const contentLength = Number.parseInt(contentLengthHeader, 10)
    if (contentLength > maxBytes) {
      throw new SafeTranscriptError(sizeLimitMessage)
    }
  }

  if (!response.body) {
    const bytes = new Uint8Array(await response.arrayBuffer())
    if (bytes.byteLength > maxBytes) {
      throw new SafeTranscriptError(sizeLimitMessage)
    }
    return bytes
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let totalBytes = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (!value) continue

    totalBytes += value.byteLength
    if (totalBytes > maxBytes) {
      await reader.cancel().catch(() => undefined)
      throw new SafeTranscriptError(sizeLimitMessage)
    }
    chunks.push(value)
  }

  const bytes = new Uint8Array(totalBytes)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}

async function fetchBytesWithGuardrails(params: {
  url: string
  init?: Omit<RequestInit, "signal">
  timeoutMs: number
  maxBytes: number
  sizeLimitMessage: string
  requestFailureMessage: string
  timeoutMessage: string
  allowedHosts: readonly string[]
  targetDescription: string
  signal?: AbortSignal
}): Promise<{ response: Response; bytes: Uint8Array }> {
  const { signal, cleanup } = createTimedAbortSignal(params.timeoutMs, params.signal)
  let currentUrl = params.url

  try {
    for (let redirectCount = 0; redirectCount <= MAX_EXTERNAL_FETCH_REDIRECTS; redirectCount += 1) {
      const validatedUrl = assertAllowedFetchTarget(currentUrl, params.allowedHosts, params.targetDescription)
      const response = await fetch(validatedUrl, {
        ...params.init,
        redirect: "manual",
        signal,
      })

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("Location")?.trim()
        if (!location) {
          throw new SafeTranscriptError(`${params.targetDescription} redirect was rejected by backend safety checks.`)
        }
        if (redirectCount >= MAX_EXTERNAL_FETCH_REDIRECTS) {
          throw new SafeTranscriptError(`${params.targetDescription} redirect chain exceeded backend safety limits.`)
        }
        currentUrl = new URL(location, validatedUrl).toString()
        continue
      }

      const bytes = await readResponseBytesWithLimit(response, params.maxBytes, params.sizeLimitMessage)
      return { response, bytes }
    }

    throw new SafeTranscriptError(params.requestFailureMessage)
  } catch (error) {
    if (isAbortError(error) || signal.aborted) {
      throw new SafeTranscriptError(params.timeoutMessage)
    }
    if (error instanceof SafeTranscriptError) {
      throw error
    }
    throw new SafeTranscriptError(params.requestFailureMessage)
  } finally {
    cleanup()
  }
}

async function fetchTextWithGuardrails(params: {
  url: string
  init?: Omit<RequestInit, "signal">
  timeoutMs: number
  maxBytes: number
  sizeLimitMessage: string
  requestFailureMessage: string
  timeoutMessage: string
  allowedHosts: readonly string[]
  targetDescription: string
  signal?: AbortSignal
}): Promise<{ response: Response; text: string }> {
  const responseWithBytes = await fetchBytesWithGuardrails(params)
  return {
    response: responseWithBytes.response,
    text: new TextDecoder().decode(responseWithBytes.bytes),
  }
}

function enforceTranscriptSegmentSafetyLimits(
  transcriptSegments: VideoTranscriptSegment[],
  sourceDescription: string,
): VideoTranscriptSegment[] {
  if (transcriptSegments.length > MAX_TRANSCRIPT_SEGMENTS) {
    throw new SafeTranscriptError(`${sourceDescription} exceeded backend transcript safety limits.`)
  }

  let totalTextChars = 0
  for (const segment of transcriptSegments) {
    totalTextChars += segment.text.length
    if (totalTextChars > MAX_TRANSCRIPT_TEXT_CHARS) {
      throw new SafeTranscriptError(`${sourceDescription} exceeded backend transcript safety limits.`)
    }
  }

  return transcriptSegments
}

function normalizeMimeType(mimeType: string | null | undefined): string | null {
  const trimmed = mimeType?.trim()
  if (!trimmed) return null
  return trimmed.split(";", 1)[0]?.trim().toLowerCase() ?? null
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([\da-fA-F]+);/g, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
}

function extractBalancedJsonObject(source: string, startIndex: number): string | null {
  if (source[startIndex] !== "{") return null

  let depth = 0
  let inString = false
  let escaped = false

  for (let index = startIndex; index < source.length; index += 1) {
    const char = source[index]!

    if (escaped) {
      escaped = false
      continue
    }

    if (char === "\\") {
      escaped = true
      continue
    }

    if (char === '"') {
      inString = !inString
      continue
    }

    if (inString) {
      continue
    }

    if (char === "{") {
      depth += 1
    } else if (char === "}") {
      depth -= 1
      if (depth === 0) {
        return source.slice(startIndex, index + 1)
      }
    }
  }

  return null
}

function extractPlayerResponseFromWatchHtml(html: string): YouTubePlayerResponse | null {
  const markers = [
    "var ytInitialPlayerResponse = ",
    "ytInitialPlayerResponse = ",
    '"ytInitialPlayerResponse":',
  ]

  for (const marker of markers) {
    const markerIndex = html.indexOf(marker)
    if (markerIndex < 0) continue

    const jsonStart = html.indexOf("{", markerIndex + marker.length)
    if (jsonStart < 0) continue

    const jsonPayload = extractBalancedJsonObject(html, jsonStart)
    if (!jsonPayload) continue

    try {
      return JSON.parse(jsonPayload) as YouTubePlayerResponse
    } catch {
      continue
    }
  }

  return null
}

function selectPreferredTrackForServerAcquisition(tracks: YouTubeCaptionTrack[]): YouTubeCaptionTrack | null {
  return [...tracks]
    .filter((track) => typeof track.baseUrl === "string" && track.baseUrl.trim().length > 0)
    .sort((left, right) => {
      const leftScore
        = (left.kind !== "asr" ? 60 : 10)
          + (left.isTranslatable ? 8 : 0)
          + ((left.languageCode ?? "").trim() ? 4 : 0)
      const rightScore
        = (right.kind !== "asr" ? 60 : 10)
          + (right.isTranslatable ? 8 : 0)
          + ((right.languageCode ?? "").trim() ? 4 : 0)
      return rightScore - leftScore
    })[0] ?? null
}

function resolveYouTubeStreamUrl(format: YouTubeStreamingFormat): string | null {
  const directUrl = format.url?.trim()
  if (directUrl) {
    return directUrl
  }

  const cipherPayload = format.signatureCipher ?? format.cipher
  if (!cipherPayload?.trim()) {
    return null
  }

  try {
    const params = new URLSearchParams(cipherPayload)
    const baseUrl = params.get("url")?.trim()
    if (!baseUrl) {
      return null
    }
    if (params.get("s")) {
      return null
    }

    const signature = params.get("sig")?.trim() ?? params.get("signature")?.trim()
    if (!signature) {
      return baseUrl
    }

    const signedUrl = new URL(baseUrl)
    signedUrl.searchParams.set(params.get("sp")?.trim() || "signature", signature)
    return signedUrl.toString()
  } catch {
    return null
  }
}

function selectPreferredAudioStream(formats: YouTubeStreamingFormat[]): ResolvedYouTubeAudioStream | null {
  return [...formats]
    .map((format) => ({
      url: resolveYouTubeStreamUrl(format),
      mimeType: normalizeMimeType(format.mimeType),
      bitrate: typeof format.bitrate === "number" && Number.isFinite(format.bitrate) ? format.bitrate : 0,
    }))
    .filter((format) => Boolean(format.url) && (format.mimeType?.startsWith("audio/") ?? false))
    .sort((left, right) => {
      const leftMimeScore = left.mimeType === "audio/mp4"
        ? 30
        : left.mimeType === "audio/webm"
          ? 20
          : 10
      const rightMimeScore = right.mimeType === "audio/mp4"
        ? 30
        : right.mimeType === "audio/webm"
          ? 20
          : 10
      return (rightMimeScore + right.bitrate) - (leftMimeScore + left.bitrate)
    })
    .map((format) => ({
      url: format.url!,
      mimeType: format.mimeType,
    }))[0] ?? null
}

function buildTimedTextUrls(baseUrl: string): string[] {
  const urls = new Set<string>()

  try {
    const json3Url = new URL(baseUrl)
    json3Url.searchParams.set("fmt", "json3")
    urls.add(json3Url.toString())
  } catch {
    // fall through to raw URL only
  }

  urls.add(baseUrl)
  return Array.from(urls)
}

function parseJson3TimedText(payload: string): YouTubeTimedCue[] {
  const parsed = JSON.parse(payload) as TimedTextResponse
  if (!Array.isArray(parsed.events)) return []

  return parsed.events
    .map((event) => {
      const text = collapseAdjacentDuplicates(
        (event.segs ?? []).map((segment) => normalizeYouTubeCaptionText(segment.utf8 ?? "")),
      ).join(" ")
      const startMs = typeof event.tStartMs === "number" ? event.tStartMs : Number.NaN
      const durationMs = typeof event.dDurationMs === "number" ? event.dDurationMs : Number.NaN

      return {
        startTime: startMs / 1000,
        endTime: (startMs + durationMs) / 1000,
        text,
      } satisfies YouTubeTimedCue
    })
    .filter((cue) => Number.isFinite(cue.startTime) && Number.isFinite(cue.endTime) && cue.endTime > cue.startTime && cue.text.length > 0)
}

function parseXmlTimedText(payload: string): YouTubeTimedCue[] {
  return Array.from(payload.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g))
    .map((match) => {
      const attributes = match[1] ?? ""
      const start = Number.parseFloat(attributes.match(/\bstart="([^"]+)"/)?.[1] ?? "")
      const duration = Number.parseFloat(attributes.match(/\bdur="([^"]+)"/)?.[1] ?? "")
      return {
        startTime: start,
        endTime: start + duration,
        text: normalizeYouTubeCaptionText(decodeHtmlEntities(match[2] ?? "")),
      } satisfies YouTubeTimedCue
    })
    .filter((cue) => Number.isFinite(cue.startTime) && Number.isFinite(cue.endTime) && cue.endTime > cue.startTime && cue.text.length > 0)
}

function dedupeTimedCues(cues: YouTubeTimedCue[]): YouTubeTimedCue[] {
  const deduped: YouTubeTimedCue[] = []

  for (const cue of cues.sort((left, right) => left.startTime - right.startTime)) {
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

function toVideoTranscriptSegments(cues: YouTubeTimedCue[]): VideoTranscriptSegment[] {
  return cues
    .map((cue) => ({
      startMs: Math.max(0, Math.floor(cue.startTime * 1000)),
      endMs: Math.max(0, Math.floor(cue.endTime * 1000)),
      text: cue.text.trim(),
    }))
    .filter((segment) => segment.text.length > 0 && segment.endMs > segment.startMs)
}

function normalizeYouTubeVideoTitle(rawTitle: string | undefined): string | null {
  const trimmed = rawTitle?.trim() ?? ""
  if (!trimmed) return null
  return trimmed.replace(/\s*-\s*YouTube$/i, "").trim() || null
}

function buildYouTubeDeepLinkTemplate(videoId: string): string {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&t={startSeconds}s`
}

function parseDurationSeconds(rawDuration: string | undefined): number | null {
  return rawDuration && /^\d+$/.test(rawDuration) ? Number.parseInt(rawDuration, 10) : null
}

async function fetchYouTubeVideoContextFromUrl(sourceUrl: string): Promise<ResolvedYouTubeVideoContext | null> {
  const videoId = extractYouTubeVideoId(sourceUrl)
  if (!videoId) {
    return null
  }

  const watchUrl = canonicalizeVideoNoteSourceUrl(sourceUrl, "youtube")
  const { response, text: html } = await fetchTextWithGuardrails({
    url: watchUrl,
    init: {
      headers: buildServerFetchHeaders(),
    },
    timeoutMs: YOUTUBE_PAGE_FETCH_TIMEOUT_MS,
    maxBytes: MAX_YOUTUBE_WATCH_HTML_BYTES,
    sizeLimitMessage: "YouTube watch page response exceeded backend safety limits.",
    requestFailureMessage: "YouTube watch page request failed.",
    timeoutMessage: "YouTube watch page request timed out.",
    allowedHosts: YOUTUBE_WATCH_ALLOWED_HOSTS,
    targetDescription: "YouTube watch page",
  })

  if (!response.ok) {
    return null
  }

  const playerResponse = extractPlayerResponseFromWatchHtml(html)
  if (!playerResponse) {
    return null
  }

  const tracks = playerResponse.captions?.playerCaptionsTracklistRenderer?.captionTracks
  const streamingFormats = [
    ...(playerResponse.streamingData?.adaptiveFormats ?? []),
    ...(playerResponse.streamingData?.formats ?? []),
  ]

  return {
    videoId,
    title: normalizeYouTubeVideoTitle(playerResponse.videoDetails?.title),
    durationSec: parseDurationSeconds(playerResponse.videoDetails?.lengthSeconds),
    deepLinkTemplate: buildYouTubeDeepLinkTemplate(videoId),
    captionTrack: Array.isArray(tracks) ? selectPreferredTrackForServerAcquisition(tracks) : null,
    audioStream: selectPreferredAudioStream(streamingFormats),
  }
}

function extractAudioFileExtension(mimeType: string | null): string {
  switch (mimeType) {
    case "audio/mp4":
      return "m4a"
    case "audio/mpeg":
      return "mp3"
    case "audio/webm":
      return "webm"
    case "audio/wav":
    case "audio/x-wav":
      return "wav"
    default:
      return "bin"
  }
}

function toTranscriptSegmentsFromVerboseTranscription(
  segments: OpenAiVerboseTranscriptionSegment[] | undefined,
): VideoTranscriptSegment[] {
  return (segments ?? [])
    .map((segment) => ({
      startMs: Math.max(0, Math.floor((segment.start ?? Number.NaN) * 1000)),
      endMs: Math.max(0, Math.floor((segment.end ?? Number.NaN) * 1000)),
      text: (segment.text ?? "").trim(),
    }))
    .filter((segment) => segment.text.length > 0 && Number.isFinite(segment.startMs) && Number.isFinite(segment.endMs) && segment.endMs > segment.startMs)
}

function buildOpenAiErrorMessage(status: number): string {
  if (status === 401 || status === 403) {
    return "OpenAI transcription request was rejected by the configured API credentials."
  }
  if (status === 413) {
    return "OpenAI transcription rejected the uploaded audio because it exceeded accepted size limits."
  }
  if (status === 429) {
    return "OpenAI transcription is temporarily rate limited."
  }
  if (status >= 500) {
    return "OpenAI transcription is temporarily unavailable."
  }
  return `OpenAI transcription request failed with status ${status}.`
}

async function transcribeAudioWithOpenAi(params: {
  audioUrl: string
  audioMimeType: string | null
  apiKey: string
}): Promise<{ transcriptSegments: VideoTranscriptSegment[]; transcriptLanguage: string | null }> {
  const { response: audioResponse, bytes: audioBytes } = await fetchBytesWithGuardrails({
    url: params.audioUrl,
    init: {
      headers: buildServerFetchHeaders(),
    },
    timeoutMs: YOUTUBE_AUDIO_FETCH_TIMEOUT_MS,
    maxBytes: MAX_AUDIO_DOWNLOAD_BYTES,
    sizeLimitMessage: "YouTube audio download exceeded backend size limits.",
    requestFailureMessage: "YouTube audio download failed.",
    timeoutMessage: "YouTube audio download timed out.",
    allowedHosts: YOUTUBE_MEDIA_ALLOWED_HOSTS,
    targetDescription: "YouTube audio download",
  })
  if (!audioResponse.ok) {
    throw new Error(`YouTube audio download failed with status ${audioResponse.status}.`)
  }

  if (audioBytes.byteLength === 0) {
    throw new Error("YouTube audio download returned an empty body.")
  }

  const mimeType = params.audioMimeType
    ?? normalizeMimeType(audioResponse.headers.get("Content-Type"))
    ?? "application/octet-stream"
  const filename = `video-note.${extractAudioFileExtension(mimeType)}`
  const formData = new FormData()
  formData.set("model", "whisper-1")
  formData.set("response_format", "verbose_json")
  formData.append("timestamp_granularities[]", "segment")
  const audioBlobBytes = new Uint8Array(audioBytes.byteLength)
  audioBlobBytes.set(audioBytes)
  formData.set("file", new Blob([audioBlobBytes], { type: mimeType }), filename)

  const { response, text: rawPayload } = await fetchTextWithGuardrails({
    url: "https://api.openai.com/v1/audio/transcriptions",
    init: {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
      },
      body: formData,
    },
    timeoutMs: OPENAI_TRANSCRIPTION_FETCH_TIMEOUT_MS,
    maxBytes: MAX_OPENAI_TRANSCRIPTION_BYTES,
    sizeLimitMessage: "OpenAI transcription response exceeded backend safety limits.",
    requestFailureMessage: "OpenAI transcription request failed.",
    timeoutMessage: "OpenAI transcription request timed out.",
    allowedHosts: OPENAI_ALLOWED_HOSTS,
    targetDescription: "OpenAI transcription request",
  })
  if (!response.ok) {
    throw new Error(buildOpenAiErrorMessage(response.status))
  }

  let parsed: OpenAiVerboseTranscriptionResponse
  try {
    parsed = JSON.parse(rawPayload) as OpenAiVerboseTranscriptionResponse
  } catch {
    throw new Error("OpenAI transcription returned a non-JSON response.")
  }

  return {
    transcriptSegments: enforceTranscriptSegmentSafetyLimits(
      toTranscriptSegmentsFromVerboseTranscription(parsed.segments),
      "OpenAI transcription output",
    ),
    transcriptLanguage: normalizeLanguageCode(parsed.language) || null,
  }
}

export function extractYouTubeVideoId(sourceUrl: string): string | null {
  try {
    const parsed = new URL(sourceUrl)
    const hostname = parsed.hostname.toLowerCase()

    if (hostname === "youtu.be") {
      const shortId = parsed.pathname.split("/").filter(Boolean)[0]
      return shortId ? decodeURIComponent(shortId) : null
    }

    if (hostname === "youtube.com" || hostname.endsWith(".youtube.com")) {
      if (parsed.pathname === "/watch") {
        const watchId = parsed.searchParams.get("v")?.trim()
        return watchId || null
      }
      if (parsed.pathname.startsWith("/shorts/")) {
        const shortsId = parsed.pathname.split("/").filter(Boolean)[1]
        return shortsId ? decodeURIComponent(shortsId) : null
      }
      if (parsed.pathname.startsWith("/embed/")) {
        const embedId = parsed.pathname.split("/").filter(Boolean)[1]
        return embedId ? decodeURIComponent(embedId) : null
      }
    }
  } catch {
    return null
  }

  return null
}

export function canonicalizeVideoNoteSourceUrl(sourceUrl: string, platformHint?: VideoNotePlatform): string {
  const inferredPlatform = inferVideoNotePlatform(sourceUrl)
  const platform = inferredPlatform !== "unknown" ? inferredPlatform : (platformHint ?? "unknown")

  if (platform === "youtube") {
    const videoId = extractYouTubeVideoId(sourceUrl)
    if (videoId) {
      return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`
    }
  }

  const parsed = new URL(sourceUrl)
  parsed.hash = ""
  return parsed.toString()
}

export function buildVideoNoteSourceKey(sourceUrl: string, platformHint?: VideoNotePlatform): string {
  const platform = inferVideoNotePlatform(sourceUrl)

  if (platform === "youtube") {
    const videoId = extractYouTubeVideoId(sourceUrl)
    if (videoId) {
      return `youtube:${videoId}`
    }
  }

  return canonicalizeVideoNoteSourceUrl(sourceUrl, platformHint)
}

export function inferVideoNotePlatform(sourceUrl: string): VideoNotePlatform {
  const hostname = new URL(sourceUrl).hostname.toLowerCase()
  if (hostname === "youtu.be" || hostname.endsWith(".youtube.com") || hostname === "youtube.com") {
    return "youtube"
  }
  if (hostname === "bilibili.com" || hostname.endsWith(".bilibili.com") || hostname === "b23.tv") {
    return "bilibili"
  }
  return "unknown"
}

async function fetchTimedTextTrack(baseUrl: string): Promise<VideoTranscriptSegment[]> {
  for (const url of buildTimedTextUrls(baseUrl)) {
    const { response, text: payload } = await fetchTextWithGuardrails({
      url,
      init: {
        headers: buildServerFetchHeaders(),
      },
      timeoutMs: YOUTUBE_TIMEDTEXT_FETCH_TIMEOUT_MS,
      maxBytes: MAX_YOUTUBE_TIMEDTEXT_BYTES,
      sizeLimitMessage: "YouTube subtitle track exceeded backend safety limits.",
      requestFailureMessage: "YouTube subtitle acquisition failed.",
      timeoutMessage: "YouTube subtitle acquisition timed out.",
      allowedHosts: YOUTUBE_TIMEDTEXT_ALLOWED_HOSTS,
      targetDescription: "YouTube subtitle acquisition",
    })

    if (!response.ok) continue

    if (!payload.trim()) continue

    try {
      const cues = payload.trim().startsWith("{")
        ? parseJson3TimedText(payload)
        : parseXmlTimedText(payload)
      const transcriptSegments = enforceTranscriptSegmentSafetyLimits(
        toVideoTranscriptSegments(dedupeTimedCues(cues)),
        "YouTube subtitle track",
      )
      if (transcriptSegments.length > 0) {
        return transcriptSegments
      }
    } catch (error) {
      if (error instanceof SafeTranscriptError) {
        throw error
      }
      continue
    }
  }

  return []
}

export async function fetchYouTubeTranscriptFromUrl(sourceUrl: string): Promise<ResolvedVideoNoteTranscript | null> {
  const context = await fetchYouTubeVideoContextFromUrl(sourceUrl)
  if (!context?.captionTrack?.baseUrl) {
    return null
  }

  const transcriptSegments = await fetchTimedTextTrack(context.captionTrack.baseUrl)
  if (transcriptSegments.length === 0) {
    return null
  }

  return {
    transcriptSegments,
    transcriptSource: "platform_subtitles",
    transcriptLanguage: normalizeLanguageCode(context.captionTrack.languageCode) || null,
    deepLinkTemplate: context.deepLinkTemplate,
    durationSec: context.durationSec,
    title: context.title,
  }
}

export async function transcribeYouTubeAudioFromUrl(
  sourceUrl: string,
  openaiApiKey: string,
): Promise<ResolvedVideoNoteTranscript | null> {
  const apiKey = openaiApiKey.trim()
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured on the Astra relay for backend transcription fallback.")
  }

  const context = await fetchYouTubeVideoContextFromUrl(sourceUrl)
  if (!context?.audioStream) {
    return null
  }

  const resolved = await transcribeAudioWithOpenAi({
    audioUrl: context.audioStream.url,
    audioMimeType: context.audioStream.mimeType,
    apiKey,
  })

  return {
    transcriptSegments: resolved.transcriptSegments,
    transcriptSource: "transcription",
    transcriptLanguage: resolved.transcriptLanguage,
    deepLinkTemplate: context.deepLinkTemplate,
    durationSec: context.durationSec,
    title: context.title,
  }
}
