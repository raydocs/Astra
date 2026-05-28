import { z } from "zod"

export const VideoNotePlatformSchema = z.enum(["youtube", "bilibili", "unknown"])

export const VideoNoteJobStatusSchema = z.enum([
  "queued",
  "acquiring_transcript",
  "transcribing",
  "generating_markdown",
  "indexing",
  "completed",
  "failed",
])

export const VideoNoteTranscriptSourceSchema = z.enum([
  "client_subtitles",
  "platform_subtitles",
  "transcription",
])

export const VideoTranscriptSegmentSchema = z.object({
  startMs: z.number().int().nonnegative(),
  endMs: z.number().int().positive(),
  text: z.string().trim().min(1),
}).refine((value) => value.endMs > value.startMs, {
  message: "endMs must be greater than startMs",
  path: ["endMs"],
})

export const VideoNoteBilingualTranscriptSegmentSchema = VideoTranscriptSegmentSchema.extend({
  translation: z.string().trim().min(1).nullable().optional().default(null),
})

export const VideoNoteLearningItemSchema = z.object({
  text: z.string().trim().min(1),
  translation: z.string().trim().min(1).nullable().optional().default(null),
  explanation: z.string().trim().min(1).nullable().optional().default(null),
  timestampMs: z.number().int().nonnegative().nullable().optional().default(null),
  sourceSentence: z.string().trim().min(1).nullable().optional().default(null),
})

export const VideoNoteLearningContextSchema = z.object({
  videoMetadata: z.object({
    title: z.string().trim().min(1).nullable().optional().default(null),
    sourceUrl: z.string().trim().url().nullable().optional().default(null),
    platform: VideoNotePlatformSchema.default("unknown"),
    durationSec: z.number().nonnegative().nullable().optional().default(null),
  }).optional(),
  bilingualTranscriptSegments: z.array(VideoNoteBilingualTranscriptSegmentSchema).default([]),
  summary: z.string().trim().min(1).nullable().optional().default(null),
  savedSentences: z.array(VideoNoteLearningItemSchema).default([]),
  savedWords: z.array(VideoNoteLearningItemSchema).default([]),
  watchProgress: z.object({
    currentTimeSec: z.number().nonnegative().default(0),
    durationSec: z.number().nonnegative().nullable().optional().default(null),
    percent: z.number().min(0).max(100).nullable().optional().default(null),
  }).optional(),
  reviewStatus: z.object({
    savedSentenceCount: z.number().int().nonnegative().default(0),
    savedWordCount: z.number().int().nonnegative().default(0),
    reviewReady: z.boolean().default(false),
  }).optional(),
})

export const VideoNoteTranscriptCaptureSchema = z.object({
  transcriptSegments: z.array(VideoTranscriptSegmentSchema).default([]),
  language: z.string().trim().min(1).nullable().optional().default(null),
  deepLinkTemplate: z.string().trim().min(1).nullable().optional().default(null),
  durationSec: z.number().nonnegative().nullable().optional().default(null),
  learningContext: VideoNoteLearningContextSchema.optional(),
})

export const VideoNoteCreateRequestSchema = z.object({
  sourceUrl: z.string().trim().url(),
  platformHint: VideoNotePlatformSchema.optional(),
  sourceTitle: z.string().trim().min(1).nullable().optional().default(null),
  forceRegenerate: z.boolean().optional().default(false),
  capture: VideoNoteTranscriptCaptureSchema.nullable().optional().default(null),
})

export const VideoNoteJobErrorSchema = z.object({
  code: z.string().trim().min(1),
  message: z.string().trim().min(1),
})

export const VideoNoteJobSummarySchema = z.object({
  jobId: z.string().trim().min(1),
  sourceUrl: z.string().trim().url(),
  platform: VideoNotePlatformSchema.default("unknown"),
  title: z.string().trim().min(1).nullable().default(null),
  status: VideoNoteJobStatusSchema,
  transcriptSource: VideoNoteTranscriptSourceSchema.nullable().default(null),
  createdAt: z.string().trim().min(1),
  updatedAt: z.string().trim().min(1),
  startedAt: z.string().trim().min(1).nullable().default(null),
  completedAt: z.string().trim().min(1).nullable().default(null),
  artifactId: z.string().trim().min(1).nullable().default(null),
  error: VideoNoteJobErrorSchema.nullable().default(null),
})

export const VideoNoteArtifactSchema = z.object({
  id: z.string().trim().min(1),
  jobId: z.string().trim().min(1),
  sourceUrl: z.string().trim().url(),
  platform: VideoNotePlatformSchema.default("unknown"),
  title: z.string().trim().min(1).nullable().default(null),
  markdown: z.string(),
  transcriptSource: VideoNoteTranscriptSourceSchema.nullable().default(null),
  transcriptLanguage: z.string().trim().min(1).nullable().default(null),
  transcriptSegments: z.array(VideoTranscriptSegmentSchema).default([]),
  deepLinkTemplate: z.string().trim().min(1).nullable().default(null),
  durationSec: z.number().nonnegative().nullable().default(null),
  learningContext: VideoNoteLearningContextSchema.optional(),
  generatedAt: z.string().trim().min(1),
  updatedAt: z.string().trim().min(1),
})

export const VideoNoteCreateResponseSchema = z.object({
  job: VideoNoteJobSummarySchema,
  deduped: z.boolean().default(false),
})

export const VideoNoteStatusResponseSchema = z.object({
  job: VideoNoteJobSummarySchema,
})

export const VideoNoteArtifactResponseSchema = z.object({
  job: VideoNoteJobSummarySchema,
  artifact: VideoNoteArtifactSchema,
})

export const VideoNoteChatRequestSchema = z.object({
  message: z.string().trim().min(1),
})

export const VideoNoteChatResponseSchema = z.object({
  answer: z.string().trim().min(1),
  citations: z.array(z.object({
    startMs: z.number().int().nonnegative(),
    endMs: z.number().int().positive().nullable().default(null),
    label: z.string().trim().min(1).nullable().default(null),
  })).default([]),
})

export type VideoNotePlatform = z.infer<typeof VideoNotePlatformSchema>
export type VideoNoteJobStatus = z.infer<typeof VideoNoteJobStatusSchema>
export type VideoNoteTranscriptSource = z.infer<typeof VideoNoteTranscriptSourceSchema>
export type VideoTranscriptSegment = z.infer<typeof VideoTranscriptSegmentSchema>
export type VideoNoteBilingualTranscriptSegment = z.infer<typeof VideoNoteBilingualTranscriptSegmentSchema>
export type VideoNoteLearningItem = z.infer<typeof VideoNoteLearningItemSchema>
export type VideoNoteLearningContext = z.infer<typeof VideoNoteLearningContextSchema>
export type VideoNoteTranscriptCapture = z.infer<typeof VideoNoteTranscriptCaptureSchema>
export type VideoNoteCreateRequest = z.infer<typeof VideoNoteCreateRequestSchema>
export type VideoNoteJobError = z.infer<typeof VideoNoteJobErrorSchema>
export type VideoNoteJobSummary = z.infer<typeof VideoNoteJobSummarySchema>
export type VideoNoteArtifact = z.infer<typeof VideoNoteArtifactSchema>
export type VideoNoteCreateResponse = z.infer<typeof VideoNoteCreateResponseSchema>
export type VideoNoteStatusResponse = z.infer<typeof VideoNoteStatusResponseSchema>
export type VideoNoteArtifactResponse = z.infer<typeof VideoNoteArtifactResponseSchema>
export type VideoNoteChatRequest = z.infer<typeof VideoNoteChatRequestSchema>
export type VideoNoteChatResponse = z.infer<typeof VideoNoteChatResponseSchema>
