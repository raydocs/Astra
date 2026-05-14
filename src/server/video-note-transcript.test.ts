import { afterEach, describe, expect, it, vi } from "vitest"

import {
  fetchYouTubeTranscriptFromUrl,
  transcribeYouTubeAudioFromUrl,
} from "./video-note-transcript"

function toFetchUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input
  if (input instanceof URL) return input.toString()
  return input.url
}

function buildYouTubeWatchHtml(options: {
  title?: string
  lengthSeconds?: number
  captionTracks?: Array<Record<string, unknown>>
  streamingFormats?: Array<Record<string, unknown>>
}) {
  return `<!doctype html><html><body><script>var ytInitialPlayerResponse = ${JSON.stringify({
    videoDetails: {
      title: options.title ?? "Demo video",
      lengthSeconds: String(options.lengthSeconds ?? 120),
    },
    captions: {
      playerCaptionsTracklistRenderer: {
        captionTracks: options.captionTracks ?? [],
      },
    },
    streamingData: {
      adaptiveFormats: options.streamingFormats ?? [],
    },
  })};</script></body></html>`
}

describe("video-note transcript guardrails", () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it("times out hanging YouTube timedtext fetches", async () => {
    vi.useFakeTimers()

    vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const url = toFetchUrl(input)
      if (url === "https://www.youtube.com/watch?v=timeoutsubs123") {
        return Promise.resolve(new Response(buildYouTubeWatchHtml({
          title: "Timedtext timeout demo",
          lengthSeconds: 90,
          captionTracks: [{
            baseUrl: "https://www.youtube.com/api/timedtext?v=timeoutsubs123&lang=en",
            languageCode: "en",
            kind: "standard",
            isTranslatable: true,
          }],
        }), { status: 200, headers: { "Content-Type": "text/html" } }))
      }
      if (url.startsWith("https://www.youtube.com/api/timedtext?v=timeoutsubs123")) {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"))
          }, { once: true })
        })
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`))
    })

    const promise = fetchYouTubeTranscriptFromUrl("https://www.youtube.com/watch?v=timeoutsubs123")
    const expectation = expect(promise).rejects.toThrow("YouTube subtitle acquisition timed out.")
    await vi.advanceTimersByTimeAsync(70_000)

    await expectation
  })

  it("times out hanging YouTube audio downloads before OpenAI transcription", async () => {
    vi.useFakeTimers()

    vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const url = toFetchUrl(input)
      if (url === "https://www.youtube.com/watch?v=timeoutaudio123") {
        return Promise.resolve(new Response(buildYouTubeWatchHtml({
          title: "Audio timeout demo",
          lengthSeconds: 84,
          captionTracks: [],
          streamingFormats: [{
            url: "https://rr-timeout---sn-demo.googlevideo.com/videoplayback?id=timeoutaudio123",
            mimeType: 'audio/mp4; codecs="mp4a.40.2"',
            bitrate: 128000,
          }],
        }), { status: 200, headers: { "Content-Type": "text/html" } }))
      }
      if (url === "https://rr-timeout---sn-demo.googlevideo.com/videoplayback?id=timeoutaudio123") {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"))
          }, { once: true })
        })
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`))
    })

    const promise = transcribeYouTubeAudioFromUrl(
      "https://www.youtube.com/watch?v=timeoutaudio123",
      "openai-key",
    )
    const expectation = expect(promise).rejects.toThrow("YouTube audio download timed out.")
    await vi.advanceTimersByTimeAsync(70_000)

    await expectation
  })
})
