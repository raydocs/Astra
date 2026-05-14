import type {
  VideoNotePlatform,
  VideoNoteTranscriptSource,
  VideoTranscriptSegment,
} from "../types/video-notes"

const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "been",
  "but",
  "by",
  "for",
  "from",
  "had",
  "has",
  "have",
  "hello",
  "how",
  "i",
  "if",
  "in",
  "into",
  "is",
  "it",
  "its",
  "let",
  "lets",
  "more",
  "of",
  "on",
  "or",
  "our",
  "so",
  "test",
  "testing",
  "that",
  "the",
  "their",
  "them",
  "there",
  "these",
  "they",
  "this",
  "to",
  "up",
  "us",
  "video",
  "was",
  "we",
  "welcome",
  "with",
  "you",
  "your",
])

interface VideoNoteMarkdownInput {
  sourceUrl: string
  platform: VideoNotePlatform
  title: string | null
  transcriptSource: VideoNoteTranscriptSource | null
  transcriptLanguage: string | null
  transcriptSegments: VideoTranscriptSegment[]
  deepLinkTemplate: string | null
  durationSec: number | null
}

interface TranscriptSection {
  startMs: number
  endMs: number
  segments: VideoTranscriptSegment[]
  heading: string
  summary: string
  takeaways: string[]
  representative: VideoTranscriptSegment
}

export function renderTranscriptBackedVideoNote(input: VideoNoteMarkdownInput): string {
  const headline = input.title ?? "Untitled video"
  const sections = buildTranscriptSections(input.transcriptSegments)
  const keyMoments = selectKeyMoments(sections)
  const coverageEndMs = Math.max(
    input.durationSec != null ? Math.round(input.durationSec * 1000) : 0,
    input.transcriptSegments.at(-1)?.endMs ?? 0,
  )

  return [
    `# ${headline}`,
    "",
    "> Relay-generated note grounded in the provided transcript capture.",
    "",
    "## At a glance",
    `- Source URL: ${input.sourceUrl}`,
    `- Platform: ${input.platform}`,
    `- Transcript source: ${input.transcriptSource ?? "unknown"}`,
    `- Transcript language: ${input.transcriptLanguage ?? "unknown"}`,
    `- Coverage: ${formatTimestamp(input.transcriptSegments[0]?.startMs ?? 0)}–${formatTimestamp(coverageEndMs)}`,
    `- Segment count: ${input.transcriptSegments.length}`,
    input.durationSec != null ? `- Duration (sec): ${input.durationSec}` : null,
    input.deepLinkTemplate ? `- Deep-link template: ${input.deepLinkTemplate}` : null,
    "",
    "## Summary",
    buildSummaryParagraph(headline, sections),
    "",
    "## Key takeaways",
    ...sections.map((section) => `- **${stripSectionPrefix(section.heading)}** — ${truncateText(section.representative.text, 18)}`),
    "",
    "## Section notes",
    ...sections.flatMap((section) => renderSection(section, input.deepLinkTemplate)),
    "",
    "## Key moments",
    ...keyMoments.map((segment) => `- ${renderTimestampLink(segment.startMs, input.deepLinkTemplate)} — ${truncateText(segment.text, 20)}`),
  ].filter((line): line is string => line !== null).join("\n")
}

function buildTranscriptSections(segments: VideoTranscriptSegment[]): TranscriptSection[] {
  if (segments.length === 0) {
    return []
  }

  const chunkCount = Math.max(1, Math.min(4, Math.ceil(segments.length / 4)))
  const targetChunkSize = Math.max(1, Math.ceil(segments.length / chunkCount))
  const rawSections: VideoTranscriptSegment[][] = []
  let current: VideoTranscriptSegment[] = []

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index]!
    const next = segments[index + 1]
    current.push(segment)

    const enoughForChunk = current.length >= targetChunkSize
    const gapAfterMs = next ? next.startMs - segment.endMs : 0
    const shouldSplitOnGap = current.length >= 2 && gapAfterMs >= 45_000
    const shouldClose = !next || shouldSplitOnGap || (enoughForChunk && rawSections.length + 1 < chunkCount)

    if (shouldClose) {
      rawSections.push(current)
      current = []
    }
  }

  if (current.length > 0) {
    rawSections.push(current)
  }

  return rawSections.map((sectionSegments, index) => {
    const representative = pickRepresentativeSegment(sectionSegments)
    const keywords = extractKeywords(sectionSegments.flatMap((segment) => tokenize(segment.text)), 2)
    const heading = keywords.length > 0
      ? `Section ${index + 1} — ${keywords.map(toTitleCase).join(" & ")}`
      : `Section ${index + 1} — ${formatTimestamp(sectionSegments[0]!.startMs)} to ${formatTimestamp(sectionSegments.at(-1)!.endMs)}`

    return {
      startMs: sectionSegments[0]!.startMs,
      endMs: sectionSegments.at(-1)!.endMs,
      segments: sectionSegments,
      heading,
      summary: buildSectionSummary(sectionSegments, keywords),
      takeaways: pickSectionTakeaways(sectionSegments),
      representative,
    }
  })
}

function buildSummaryParagraph(headline: string, sections: TranscriptSection[]): string {
  if (sections.length === 0) {
    return `${headline} does not yet have usable transcript-backed notes.`
  }

  const topics = sections
    .slice(0, 3)
    .map((section) => stripSectionPrefix(section.heading).toLowerCase())
    .join(", ")
  const opening = quoteText(sections[0]!.segments[0]!.text, 14)
  const closing = quoteText(sections.at(-1)!.representative.text, 14)

  return [
    `${headline} opens with ${opening}.`,
    topics ? `The transcript then moves through ${topics}.` : null,
    `It closes on ${closing}.`,
  ].filter((line): line is string => line !== null).join(" ")
}

function buildSectionSummary(sectionSegments: VideoTranscriptSegment[], keywords: string[]): string {
  const start = formatTimestamp(sectionSegments[0]!.startMs)
  const end = formatTimestamp(sectionSegments.at(-1)!.endMs)
  const topicText = keywords.length > 0
    ? `focused on ${keywords.join(" and ")}`
    : "covering the next part of the discussion"
  return `This stretch runs ${start}–${end}, ${topicText}, and is anchored by ${quoteText(pickRepresentativeSegment(sectionSegments).text, 16)}.`
}

function pickSectionTakeaways(sectionSegments: VideoTranscriptSegment[]): string[] {
  const candidates = [
    sectionSegments[0],
    sectionSegments[Math.floor(sectionSegments.length / 2)],
    sectionSegments.at(-1),
  ].filter((segment): segment is VideoTranscriptSegment => Boolean(segment))

  const takeaways: string[] = []
  const seen = new Set<string>()
  for (const segment of candidates) {
    const normalized = segment.text.trim().toLowerCase()
    if (seen.has(normalized)) continue
    seen.add(normalized)
    takeaways.push(`${renderTimestampLabel(segment.startMs)} ${truncateText(segment.text, 18)}`)
    if (takeaways.length >= 3) break
  }
  return takeaways
}

function selectKeyMoments(sections: TranscriptSection[]): VideoTranscriptSegment[] {
  const selected: VideoTranscriptSegment[] = []
  const seen = new Set<string>()

  for (const section of sections) {
    const choice = section.representative
    const signature = `${choice.startMs}:${choice.text.trim().toLowerCase()}`
    if (seen.has(signature)) continue
    seen.add(signature)
    selected.push(choice)
  }

  return selected.slice(0, 5)
}

function renderSection(section: TranscriptSection, deepLinkTemplate: string | null): string[] {
  return [
    `### ${section.heading} (${formatTimestamp(section.startMs)}–${formatTimestamp(section.endMs)})`,
    section.summary,
    "",
    ...section.takeaways.map((takeaway) => {
      const match = takeaway.match(/^\[(.+?)\] (.+)$/)
      if (!match) return `- ${takeaway}`
      return `- ${renderTimestampLink(section.segments.find((segment) => formatTimestamp(segment.startMs) === match[1])?.startMs ?? section.startMs, deepLinkTemplate)} — ${match[2]}`
    }),
    "",
  ]
}

function pickRepresentativeSegment(segments: VideoTranscriptSegment[]): VideoTranscriptSegment {
  return [...segments].sort((left, right) => scoreSegment(right) - scoreSegment(left))[0] ?? segments[0]!
}

function scoreSegment(segment: VideoTranscriptSegment): number {
  const tokens = tokenize(segment.text).filter((token) => !STOPWORDS.has(token))
  const uniqueTokens = new Set(tokens)
  return Math.min(segment.text.length, 180) + uniqueTokens.size * 12
}

function tokenize(text: string): string[] {
  return Array.from(text.toLowerCase().matchAll(/[a-z0-9][a-z0-9'-]*/g), (match) => match[0])
}

function extractKeywords(tokens: string[], limit: number): string[] {
  const counts = new Map<string, number>()
  for (const token of tokens) {
    if (token.length < 3 || STOPWORDS.has(token)) continue
    counts.set(token, (counts.get(token) ?? 0) + 1)
  }

  return [...counts.entries()]
    .sort((left, right) => {
      if (right[1] !== left[1]) return right[1] - left[1]
      if (right[0].length !== left[0].length) return right[0].length - left[0].length
      return left[0].localeCompare(right[0])
    })
    .slice(0, limit)
    .map(([token]) => token)
}

function buildDeepLink(template: string | null, startMs: number): string | null {
  if (!template) return null
  const startSeconds = Math.max(0, Math.floor(startMs / 1000))
  return template
    .replaceAll("{startSeconds}", String(startSeconds))
    .replaceAll("{startMs}", String(startMs))
}

function renderTimestampLink(startMs: number, deepLinkTemplate: string | null): string {
  const label = formatTimestamp(startMs)
  const href = buildDeepLink(deepLinkTemplate, startMs)
  return href ? `[${label}](${href})` : label
}

function renderTimestampLabel(startMs: number): string {
  return `[${formatTimestamp(startMs)}]`
}

function formatTimestamp(startMs: number): string {
  const totalSeconds = Math.floor(startMs / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
}

function truncateText(text: string, maxWords: number): string {
  const normalized = text.replace(/\s+/g, " ").trim()
  const words = normalized.split(" ")
  if (words.length <= maxWords) return normalized
  return `${words.slice(0, maxWords).join(" ")}…`
}

function quoteText(text: string, maxWords: number): string {
  return `“${truncateText(text, maxWords)}”`
}

function stripSectionPrefix(value: string): string {
  return value.replace(/^Section \d+ — /, "")
}

function toTitleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
