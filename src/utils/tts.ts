import type { TTSEngine } from "@/types/config"

export interface TTSVoiceOption {
  name: string
  lang: string
  default: boolean
  localService: boolean
  engine: TTSEngine
}

export interface SpeakOptions {
  engine?: TTSEngine
  lang?: string
  voiceName?: string
  rate?: number
  pitch?: number
  onEnd?: () => void
  onError?: () => void
  onSentence?: (sentenceIndex: number, text: string) => void
}

// ---------------------------------------------------------------------------
// Edge TTS constants
// ---------------------------------------------------------------------------

/** Well-known Edge TTS voices — curated high-quality subset. */
export const EDGE_TTS_VOICES: TTSVoiceOption[] = [
  { name: "zh-CN-XiaoxiaoNeural", lang: "zh-CN", default: true, localService: false, engine: "edge" },
  { name: "zh-CN-YunxiNeural", lang: "zh-CN", default: false, localService: false, engine: "edge" },
  { name: "zh-CN-YunyangNeural", lang: "zh-CN", default: false, localService: false, engine: "edge" },
  { name: "zh-TW-HsiaoChenNeural", lang: "zh-TW", default: true, localService: false, engine: "edge" },
  { name: "en-US-JennyNeural", lang: "en-US", default: true, localService: false, engine: "edge" },
  { name: "en-US-GuyNeural", lang: "en-US", default: false, localService: false, engine: "edge" },
  { name: "en-US-AriaNeural", lang: "en-US", default: false, localService: false, engine: "edge" },
  { name: "en-GB-SoniaNeural", lang: "en-GB", default: true, localService: false, engine: "edge" },
  { name: "ja-JP-NanamiNeural", lang: "ja-JP", default: true, localService: false, engine: "edge" },
  { name: "ko-KR-SunHiNeural", lang: "ko-KR", default: true, localService: false, engine: "edge" },
  { name: "fr-FR-DeniseNeural", lang: "fr-FR", default: true, localService: false, engine: "edge" },
  { name: "de-DE-KatjaNeural", lang: "de-DE", default: true, localService: false, engine: "edge" },
  { name: "es-ES-ElviraNeural", lang: "es-ES", default: true, localService: false, engine: "edge" },
]

// ---------------------------------------------------------------------------
// Edge TTS via Azure Cognitive Services endpoint (free tier, same voices)
// ---------------------------------------------------------------------------

const EDGE_TTS_ENDPOINT = "https://speech.platform.bing.com/consumer/speech/synthesize/readaloud"
const EDGE_TTS_TOKEN_ENDPOINT = "https://edge.microsoft.com/translate/auth"

let edgeTtsToken: { value: string; expiresAt: number } | null = null

async function getEdgeTtsToken(): Promise<string> {
  if (edgeTtsToken && Date.now() < edgeTtsToken.expiresAt) {
    return edgeTtsToken.value
  }
  const res = await fetch(EDGE_TTS_TOKEN_ENDPOINT, {
    method: "GET",
    headers: { Accept: "application/json" },
  })
  if (!res.ok) throw new Error(`Edge TTS token fetch failed: ${res.status}`)
  const token = await res.text()
  edgeTtsToken = { value: token, expiresAt: Date.now() + 8 * 60 * 1000 }
  return token
}

function buildEdgeTtsSsml(text: string, voiceName: string, rate: number, pitch: number): string {
  const ratePercent = `${Math.round((rate - 1) * 100)}%`
  const pitchPercent = `${Math.round((pitch - 1) * 50)}%`
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">`
    + `<voice name="${voiceName}">`
    + `<prosody rate="${ratePercent}" pitch="${pitchPercent}">`
    + escapeXml(text)
    + `</prosody></voice></speak>`
}

function escapeXml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

let edgeAudioContext: AudioContext | null = null
let edgeCurrentSource: AudioBufferSourceNode | null = null

async function speakEdgeTts(
  text: string,
  voiceName: string,
  rate: number,
  pitch: number,
  onEnd?: () => void,
  onError?: () => void,
): Promise<void> {
  try {
    stopEdgeTts()
    const token = await getEdgeTtsToken()
    const ssml = buildEdgeTtsSsml(text, voiceName, rate, pitch)

    const res = await fetch(`${EDGE_TTS_ENDPOINT}?TrustedClientToken=${token}&ConnectionId=${crypto.randomUUID()}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
      },
      body: ssml,
    })

    if (!res.ok) throw new Error(`Edge TTS synthesis failed: ${res.status}`)
    const arrayBuffer = await res.arrayBuffer()

    if (!edgeAudioContext) {
      edgeAudioContext = new AudioContext()
    }
    const audioBuffer = await edgeAudioContext.decodeAudioData(arrayBuffer)
    const source = edgeAudioContext.createBufferSource()
    source.buffer = audioBuffer
    source.connect(edgeAudioContext.destination)
    source.onended = () => {
      edgeCurrentSource = null
      onEnd?.()
    }
    edgeCurrentSource = source
    source.start()
  } catch {
    onError?.()
  }
}

function stopEdgeTts(): void {
  if (edgeCurrentSource) {
    try { edgeCurrentSource.stop() } catch { /* already stopped */ }
    edgeCurrentSource = null
  }
}

function isEdgeTtsPlaying(): boolean {
  return edgeCurrentSource !== null
}

// ---------------------------------------------------------------------------
// Sentence segmentation for highlight-during-playback
// ---------------------------------------------------------------------------

const SENTENCE_SPLIT_RE = /(?<=[.!?。！？\n])\s*/

export function splitSentences(text: string): string[] {
  return text.split(SENTENCE_SPLIT_RE).filter((s) => s.trim().length > 0)
}

// ---------------------------------------------------------------------------
// Browser Web Speech API (original engine)
// ---------------------------------------------------------------------------

const DEFAULT_RATE = 0.9
const VOICE_LOAD_TIMEOUT_MS = 1000
const VOICE_POLL_INTERVAL_MS = 150

function getSpeechSynthesis(): SpeechSynthesis | null {
  if (typeof globalThis === "undefined" || !("speechSynthesis" in globalThis)) {
    return null
  }
  return globalThis.speechSynthesis ?? null
}

function mapVoice(voice: SpeechSynthesisVoice): TTSVoiceOption {
  return {
    name: voice.name,
    lang: voice.lang,
    default: voice.default,
    localService: voice.localService,
    engine: "browser",
  }
}

function getVoicesInternal(): SpeechSynthesisVoice[] {
  const synth = getSpeechSynthesis()
  if (!synth || typeof synth.getVoices !== "function") return []
  return synth.getVoices()
}

function clampRate(rate?: number): number {
  if (rate == null || Number.isNaN(rate)) return DEFAULT_RATE
  return Math.min(2, Math.max(0.5, rate))
}

function clampPitch(pitch?: number): number {
  if (pitch == null || Number.isNaN(pitch)) return 1.0
  return Math.min(2, Math.max(0.5, pitch))
}

function matchesLang(candidate: string, target: string): boolean {
  const normalizedCandidate = candidate.trim().toLowerCase()
  const normalizedTarget = target.trim().toLowerCase()
  if (!normalizedCandidate || !normalizedTarget) return false
  if (normalizedCandidate === normalizedTarget) return true

  const candidateBase = normalizedCandidate.split("-")[0]
  const targetBase = normalizedTarget.split("-")[0]
  return candidateBase.length > 0 && candidateBase === targetBase
}

function resolveVoice(voiceName?: string, lang?: string): SpeechSynthesisVoice | undefined {
  const voices = getVoicesInternal()
  if (voices.length === 0) return undefined

  const normalizedVoiceName = voiceName?.trim()
  if (normalizedVoiceName) {
    const exactMatch = voices.find((voice) => voice.name === normalizedVoiceName)
    if (exactMatch) return exactMatch
  }

  const normalizedLang = lang?.trim()
  if (normalizedLang) {
    const langMatch = voices.find((voice) => matchesLang(voice.lang, normalizedLang))
    if (langMatch) return langMatch
  }

  return voices.find((voice) => voice.default) ?? voices[0]
}

function resolveEdgeVoice(voiceName?: string, lang?: string): TTSVoiceOption {
  if (voiceName) {
    const exact = EDGE_TTS_VOICES.find((v) => v.name === voiceName)
    if (exact) return exact
  }
  if (lang) {
    const langMatch = EDGE_TTS_VOICES.find((v) => matchesLang(v.lang, lang))
    if (langMatch) return langMatch
  }
  return EDGE_TTS_VOICES.find((v) => v.default) ?? EDGE_TTS_VOICES[0]
}

export function isTtsSupported(engine?: TTSEngine): boolean {
  if (engine === "edge") return true
  return typeof globalThis !== "undefined"
    && typeof globalThis.SpeechSynthesisUtterance !== "undefined"
    && getSpeechSynthesis() !== null
}

export function getAvailableVoices(engine?: TTSEngine): TTSVoiceOption[] {
  if (engine === "edge") return [...EDGE_TTS_VOICES]
  return getVoicesInternal().map(mapVoice)
}

export async function listVoices(engine?: TTSEngine, timeoutMs = VOICE_LOAD_TIMEOUT_MS): Promise<TTSVoiceOption[]> {
  if (engine === "edge") return [...EDGE_TTS_VOICES]

  if (!isTtsSupported()) return []

  const initialVoices = getAvailableVoices()
  if (initialVoices.length > 0) return initialVoices

  const synth = getSpeechSynthesis()
  if (!synth) return []

  return new Promise((resolve) => {
    let settled = false
    let assignedOnVoicesChanged = false
    const previousOnVoicesChanged = synth.onvoiceschanged

    const finish = (voicesToReturn = getAvailableVoices()) => {
      if (settled) return
      settled = true
      cleanup()
      resolve(voicesToReturn)
    }

    const tryResolve = () => {
      const currentVoices = getAvailableVoices()
      if (currentVoices.length > 0) {
        finish(currentVoices)
      }
    }

    const onVoicesChanged = () => {
      tryResolve()
    }

    const cleanup = () => {
      clearTimeout(timer)
      clearInterval(interval)
      if (typeof synth.removeEventListener === "function") {
        synth.removeEventListener("voiceschanged", onVoicesChanged)
      }
      if (assignedOnVoicesChanged) {
        synth.onvoiceschanged = previousOnVoicesChanged
      }
    }

    const timer = globalThis.setTimeout(() => finish(), timeoutMs)
    const interval = globalThis.setInterval(tryResolve, VOICE_POLL_INTERVAL_MS)

    if (typeof synth.addEventListener === "function") {
      synth.addEventListener("voiceschanged", onVoicesChanged)
    } else {
      assignedOnVoicesChanged = true
      synth.onvoiceschanged = (event) => {
        previousOnVoicesChanged?.call(synth, event)
        onVoicesChanged()
      }
    }

    tryResolve()
  })
}

export function speak(text: string, options: SpeakOptions = {}): boolean {
  const trimmedText = text.trim()
  if (!trimmedText) return false

  if (options.engine === "edge") {
    const voice = resolveEdgeVoice(options.voiceName, options.lang)
    void speakEdgeTts(
      trimmedText,
      voice.name,
      clampRate(options.rate),
      clampPitch(options.pitch),
      options.onEnd,
      options.onError,
    )
    return true
  }

  if (!isTtsSupported()) return false

  const synth = getSpeechSynthesis()
  if (!synth) return false

  stopSpeaking()

  const utterance = new SpeechSynthesisUtterance(trimmedText)
  utterance.rate = clampRate(options.rate)
  utterance.pitch = clampPitch(options.pitch)

  if (options.lang) {
    utterance.lang = options.lang
  }

  const voice = resolveVoice(options.voiceName, options.lang)
  if (voice) {
    utterance.voice = voice
    if (!utterance.lang && voice.lang) {
      utterance.lang = voice.lang
    }
  }

  if (options.onEnd) {
    utterance.onend = () => options.onEnd?.()
  }

  if (options.onError) {
    utterance.onerror = () => options.onError?.()
  }

  synth.speak(utterance)
  return true
}

/**
 * Speak text sentence-by-sentence with highlight callbacks.
 * Returns a stop function to abort the sequence.
 */
export function speakWithHighlight(
  text: string,
  options: SpeakOptions = {},
): () => void {
  const sentences = splitSentences(text)
  let cancelled = false
  let currentIdx = 0

  function next() {
    if (cancelled || currentIdx >= sentences.length) {
      if (!cancelled) options.onEnd?.()
      return
    }
    const idx = currentIdx
    const sentence = sentences[idx]
    currentIdx++
    options.onSentence?.(idx, sentence)
    speak(sentence, {
      ...options,
      onEnd: () => next(),
      onError: () => {
        options.onError?.()
      },
    })
  }

  next()

  return () => {
    cancelled = true
    stopSpeaking()
  }
}

export function stopSpeaking(): void {
  stopEdgeTts()
  const synth = getSpeechSynthesis()
  synth?.cancel()
}

export function isSpeaking(): boolean {
  if (isEdgeTtsPlaying()) return true
  const synth = getSpeechSynthesis()
  if (!synth) return false
  return synth.speaking || synth.pending
}
