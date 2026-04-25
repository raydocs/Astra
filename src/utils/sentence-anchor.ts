export interface SentenceAnchor {
  sentenceText?: string
  sentenceHash?: string
  sentenceIndex?: number
}

function normalizeSentenceText(value?: string | null): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function normalizeSentenceForHash(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
}

export function buildSentenceHash(value?: string | null): string | undefined {
  const text = normalizeSentenceText(value)
  if (!text) return undefined

  const normalized = normalizeSentenceForHash(text)
  let hash = 2166136261
  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return `fnv1a:${(hash >>> 0).toString(16)}`
}

export function normalizeSentenceAnchor(anchor?: SentenceAnchor | null): SentenceAnchor | undefined {
  if (!anchor) return undefined

  const sentenceText = normalizeSentenceText(anchor.sentenceText)
  const sentenceHash = sentenceText
    ? buildSentenceHash(sentenceText)
    : normalizeSentenceText(anchor.sentenceHash)
  const sentenceIndex = typeof anchor.sentenceIndex === "number" && anchor.sentenceIndex >= 0
    ? anchor.sentenceIndex
    : undefined

  if (!sentenceText && !sentenceHash && sentenceIndex === undefined) {
    return undefined
  }

  return {
    ...(sentenceText ? { sentenceText } : {}),
    ...(sentenceHash ? { sentenceHash } : {}),
    ...(sentenceIndex !== undefined ? { sentenceIndex } : {}),
  }
}

export function buildSentenceAnchor(sentenceText?: string | null, sentenceIndex?: number): SentenceAnchor | undefined {
  return normalizeSentenceAnchor({
    sentenceText: sentenceText ?? undefined,
    sentenceIndex,
  })
}

export function readSentenceAnchorFromSearchParams(searchParams: URLSearchParams): SentenceAnchor | undefined {
  const sentenceIndex = Number.parseInt(searchParams.get("sentenceIndex") ?? "", 10)
  return normalizeSentenceAnchor({
    sentenceText: searchParams.get("sentenceText") ?? undefined,
    sentenceHash: searchParams.get("sentenceHash") ?? undefined,
    sentenceIndex: Number.isInteger(sentenceIndex) && sentenceIndex >= 0 ? sentenceIndex : undefined,
  })
}

export function writeSentenceAnchorToSearchParams(searchParams: URLSearchParams, anchor?: SentenceAnchor | null): void {
  const normalized = normalizeSentenceAnchor(anchor)
  if (!normalized) return

  if (normalized.sentenceText) {
    searchParams.set("sentenceText", normalized.sentenceText)
  }
  if (normalized.sentenceHash) {
    searchParams.set("sentenceHash", normalized.sentenceHash)
  }
  if (typeof normalized.sentenceIndex === "number") {
    searchParams.set("sentenceIndex", `${normalized.sentenceIndex}`)
  }
}

export function resolveSentenceAnchorIndex(params: {
  sentences: string[]
  anchor?: SentenceAnchor | null
  fallbackIndex?: number
}): number {
  const { sentences, fallbackIndex } = params
  if (!sentences.length) return 0

  const anchor = normalizeSentenceAnchor(params.anchor)
  if (anchor?.sentenceText) {
    const exactMatchIndex = sentences.findIndex((sentence) => sentence.trim() === anchor.sentenceText)
    if (exactMatchIndex >= 0) {
      return exactMatchIndex
    }
  }

  if (anchor?.sentenceHash) {
    const hashMatchIndex = sentences.findIndex((sentence) => buildSentenceHash(sentence) === anchor.sentenceHash)
    if (hashMatchIndex >= 0) {
      return hashMatchIndex
    }
  }

  const candidateIndex = anchor?.sentenceIndex ?? fallbackIndex
  if (typeof candidateIndex === "number" && candidateIndex >= 0) {
    return Math.min(candidateIndex, sentences.length - 1)
  }

  return 0
}
