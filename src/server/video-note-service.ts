import { randomUUID } from "node:crypto"

import type {
  VideoNoteArtifact,
  VideoNoteCreateRequest,
  VideoNoteJobSummary,
  VideoNotePlatform,
  VideoNoteTranscriptSource,
  VideoTranscriptSegment,
} from "../types/video-notes"

import type { RelayEnv, VideoNoteArtifactRecord, VideoNoteJobRecord } from "./types"
import { renderTranscriptBackedVideoNote } from "./video-note-prompts"
import {
  buildVideoNoteSourceKey,
  canonicalizeVideoNoteSourceUrl,
  fetchYouTubeTranscriptFromUrl,
  inferVideoNotePlatform,
  transcribeYouTubeAudioFromUrl,
} from "./video-note-transcript"
import { FileVideoNoteStore } from "./video-note-store"

const REUSABLE_JOB_STATUSES: VideoNoteJobRecord["status"][] = [
  "queued",
  "acquiring_transcript",
  "transcribing",
  "generating_markdown",
  "indexing",
  "completed",
]

const NON_TERMINAL_JOB_STATUSES: VideoNoteJobRecord["status"][] = [
  "queued",
  "acquiring_transcript",
  "transcribing",
  "generating_markdown",
  "indexing",
]

function normalizeOptionalText(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function normalizeTranscriptSegments(segments: VideoTranscriptSegment[]): VideoTranscriptSegment[] {
  const cleaned = segments
    .map((segment) => ({
      startMs: Math.max(0, Math.floor(segment.startMs)),
      endMs: Math.max(0, Math.floor(segment.endMs)),
      text: segment.text.trim(),
    }))
    .filter((segment) => segment.text.length > 0 && segment.endMs > segment.startMs)
    .sort((a, b) => a.startMs - b.startMs)

  const merged: VideoTranscriptSegment[] = []
  for (const segment of cleaned) {
    const previous = merged.at(-1)
    if (previous && previous.text === segment.text && segment.startMs <= previous.endMs + 500) {
      previous.endMs = Math.max(previous.endMs, segment.endMs)
      continue
    }
    merged.push({ ...segment })
  }

  return merged
}

function buildTranscriptUnavailableMessage(params: {
  platform: VideoNotePlatform
  transcriptionAttempted: boolean
  details: string[]
}): string {
  if (params.platform !== "youtube" && !params.transcriptionAttempted) {
    return "Transcript acquisition is not implemented yet for URL-only video-note jobs. Submit capture.transcriptSegments to exercise the artifact flow."
  }

  const intro = params.platform === "youtube"
    ? params.transcriptionAttempted
      ? "No usable YouTube subtitles were available and backend transcription fallback could not produce transcript segments."
      : "No YouTube subtitles were available for this video URL."
    : "Backend transcription fallback could not produce transcript segments."

  const details = params.details
    .map((detail) => detail.trim())
    .filter(Boolean)

  return details.length > 0 ? `${intro} ${details.join(" ")}` : intro
}

export class VideoNoteService {
  private readonly store: FileVideoNoteStore
  private readonly ready: Promise<void>
  private readonly queuedJobIds = new Set<string>()
  private readonly activeJobIds = new Set<string>()
  private readonly queue: string[] = []
  private draining = false

  constructor(
    private readonly env: RelayEnv,
    store?: FileVideoNoteStore,
  ) {
    this.store = store ?? new FileVideoNoteStore(env)
    this.ready = this.store.markNonTerminalJobsFailed({
      statuses: NON_TERMINAL_JOB_STATUSES,
      errorCode: "RELAY_RESTARTED",
      errorMessage: "Video-note job was interrupted by a relay restart and must be re-created.",
    }).then(() => undefined)
  }

  async createJob(
    ownerEmail: string,
    request: VideoNoteCreateRequest,
  ): Promise<{ job: VideoNoteJobSummary; deduped: boolean }> {
    await this.ready

    const normalizedSourceUrl = canonicalizeVideoNoteSourceUrl(request.sourceUrl, request.platformHint)
    const sourceKey = buildVideoNoteSourceKey(normalizedSourceUrl, request.platformHint)
    const inferredPlatform = inferVideoNotePlatform(normalizedSourceUrl)
    if (!request.forceRegenerate) {
      const reusable = await this.store.findReusableJob(ownerEmail, sourceKey, REUSABLE_JOB_STATUSES)
      if (reusable) {
        return { job: this.toJobSummary(reusable), deduped: true }
      }
    }

    const now = new Date().toISOString()
    const job: VideoNoteJobRecord = {
      id: randomUUID(),
      ownerEmail: ownerEmail.trim(),
      sourceUrl: normalizedSourceUrl,
      sourceKey,
      platform: inferredPlatform !== "unknown"
        ? inferredPlatform
        : (request.platformHint ?? "unknown"),
      title: normalizeOptionalText(request.sourceTitle),
      status: "queued",
      transcriptSource: null,
      errorCode: null,
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
      startedAt: null,
      completedAt: null,
      artifactId: null,
      request: {
        ...request,
        sourceUrl: normalizedSourceUrl,
        sourceTitle: normalizeOptionalText(request.sourceTitle),
      },
    }

    await this.store.createJob(job)
    this.enqueue(job.id)
    return { job: this.toJobSummary(job), deduped: false }
  }

  async getJob(ownerEmail: string, jobId: string): Promise<VideoNoteJobSummary | null> {
    await this.ready
    const job = await this.store.getJobForOwner(ownerEmail, jobId)
    return job ? this.toJobSummary(job) : null
  }

  async getArtifact(ownerEmail: string, jobId: string): Promise<VideoNoteArtifact | null> {
    await this.ready
    const artifact = await this.store.getArtifactForOwner(ownerEmail, jobId)
    if (!artifact) return null
    const { ownerEmail: _ownerEmail, ...publicArtifact } = artifact
    return publicArtifact
  }

  async runJob(jobId: string): Promise<void> {
    await this.ready
    const existing = await this.store.getJob(jobId)
    if (!existing || existing.status !== "queued") {
      return
    }

    const startedAt = new Date().toISOString()
    let job = await this.store.updateJob(jobId, (current) => ({
      ...current,
      status: "acquiring_transcript",
      startedAt: current.startedAt ?? startedAt,
      updatedAt: startedAt,
      errorCode: null,
      errorMessage: null,
    }))
    if (!job) return

    try {
      const capture = job.request.capture
      let normalizedSegments = normalizeTranscriptSegments(capture?.transcriptSegments ?? [])
      let transcriptSource: VideoNoteTranscriptSource = "client_subtitles"
      let transcriptLanguage = normalizeOptionalText(capture?.language)
      let deepLinkTemplate = normalizeOptionalText(capture?.deepLinkTemplate)
      let durationSec = capture?.durationSec ?? null
      let resolvedTitle = job.title
      const transcriptFailureDetails: string[] = []
      let transcriptionAttempted = false

      if (normalizedSegments.length === 0) {
        if (job.platform === "youtube") {
          try {
            const resolved = await fetchYouTubeTranscriptFromUrl(job.sourceUrl)
            normalizedSegments = normalizeTranscriptSegments(resolved?.transcriptSegments ?? [])
            if (normalizedSegments.length > 0 && resolved) {
              transcriptSource = resolved.transcriptSource
              transcriptLanguage = normalizeOptionalText(resolved.transcriptLanguage)
              deepLinkTemplate = normalizeOptionalText(resolved.deepLinkTemplate)
              durationSec = resolved.durationSec ?? null
              resolvedTitle = normalizeOptionalText(resolved.title) ?? job.title
            }
          } catch (error) {
            transcriptFailureDetails.push(error instanceof Error
              ? `YouTube subtitle acquisition failed: ${error.message}`
              : "YouTube subtitle acquisition failed.")
          }
        }
      }

      if (normalizedSegments.length === 0 && job.platform === "youtube") {
        const transcriptionApiKey = this.env.openaiApiKey.trim()
        if (!transcriptionApiKey) {
          transcriptFailureDetails.push(
            "Backend transcription fallback is unavailable because OPENAI_API_KEY is not configured on the Astra relay.",
          )
        } else {
          const transcribingAt = new Date().toISOString()
          job = await this.store.updateJob(jobId, (current) => ({
            ...current,
            status: "transcribing",
            transcriptSource: "transcription",
            updatedAt: transcribingAt,
          }))
          if (!job) return

          transcriptionAttempted = true
          try {
            const resolved = await transcribeYouTubeAudioFromUrl(job.sourceUrl, transcriptionApiKey)
            normalizedSegments = normalizeTranscriptSegments(resolved?.transcriptSegments ?? [])
            if (resolved) {
              transcriptSource = resolved.transcriptSource
              transcriptLanguage = normalizeOptionalText(resolved.transcriptLanguage)
              deepLinkTemplate = normalizeOptionalText(resolved.deepLinkTemplate)
              durationSec = resolved.durationSec ?? null
              resolvedTitle = normalizeOptionalText(resolved.title) ?? resolvedTitle
            }
            if (normalizedSegments.length === 0) {
              transcriptFailureDetails.push(
                resolved
                  ? "Backend transcription did not return any usable transcript segments."
                  : "Backend transcription fallback could not access a usable YouTube audio stream.",
              )
            }
          } catch (error) {
            transcriptFailureDetails.push(error instanceof Error
              ? `Backend transcription failed: ${error.message}`
              : "Backend transcription failed.")
          }
        }
      }

      if (normalizedSegments.length === 0) {
        await this.failJob(
          jobId,
          "SUBTITLE_UNAVAILABLE",
          buildTranscriptUnavailableMessage({
            platform: job.platform,
            transcriptionAttempted,
            details: transcriptFailureDetails,
          }),
        )
        return
      }

      const generatingAt = new Date().toISOString()
      job = await this.store.updateJob(jobId, (current) => ({
        ...current,
        status: "generating_markdown",
        transcriptSource,
        title: resolvedTitle,
        updatedAt: generatingAt,
      }))
      if (!job) return

      const artifactTimestamp = new Date().toISOString()
      const learningContext = job.request.capture?.learningContext
      const artifact: VideoNoteArtifactRecord = {
        ownerEmail: job.ownerEmail,
        id: randomUUID(),
        jobId: job.id,
        sourceUrl: job.sourceUrl,
        platform: job.platform,
        title: resolvedTitle,
        markdown: renderTranscriptBackedVideoNote({
          sourceUrl: job.sourceUrl,
          platform: job.platform,
          title: resolvedTitle,
          transcriptSegments: normalizedSegments,
          transcriptSource,
          transcriptLanguage,
          deepLinkTemplate,
          durationSec,
          learningContext,
        }),
        transcriptSource,
        transcriptLanguage,
        transcriptSegments: normalizedSegments,
        deepLinkTemplate,
        durationSec,
        ...(learningContext ? { learningContext } : {}),
        generatedAt: artifactTimestamp,
        updatedAt: artifactTimestamp,
      }

      await this.store.upsertArtifact(artifact)
      await this.store.updateJob(jobId, (current) => ({
        ...current,
        status: "completed",
        transcriptSource,
        artifactId: artifact.id,
        completedAt: artifactTimestamp,
        updatedAt: artifactTimestamp,
        errorCode: null,
        errorMessage: null,
      }))
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected video-note pipeline failure."
      await this.failJob(jobId, "NOTE_GENERATION_FAILED", message)
    }
  }

  private toJobSummary(job: VideoNoteJobRecord): VideoNoteJobSummary {
    return {
      jobId: job.id,
      sourceUrl: job.sourceUrl,
      platform: job.platform,
      title: job.title,
      status: job.status,
      transcriptSource: job.transcriptSource,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      artifactId: job.artifactId,
      error: job.errorCode && job.errorMessage
        ? { code: job.errorCode, message: job.errorMessage }
        : null,
    }
  }

  private enqueue(jobId: string): void {
    if (this.queuedJobIds.has(jobId) || this.activeJobIds.has(jobId)) {
      return
    }
    this.queue.push(jobId)
    this.queuedJobIds.add(jobId)
    queueMicrotask(() => {
      void this.drainQueue()
    })
  }

  private async drainQueue(): Promise<void> {
    await this.ready
    if (this.draining) return
    this.draining = true

    try {
      while (this.activeJobIds.size < this.env.videoNoteMaxConcurrentJobs && this.queue.length > 0) {
        const jobId = this.queue.shift()
        if (!jobId) continue
        this.queuedJobIds.delete(jobId)
        this.activeJobIds.add(jobId)
        void this.runJob(jobId).finally(() => {
          this.activeJobIds.delete(jobId)
          queueMicrotask(() => {
            void this.drainQueue()
          })
        })
      }
    } finally {
      this.draining = false
    }
  }

  private async failJob(jobId: string, errorCode: string, errorMessage: string): Promise<void> {
    const timestamp = new Date().toISOString()
    await this.store.updateJob(jobId, (current) => ({
      ...current,
      status: "failed",
      updatedAt: timestamp,
      completedAt: current.completedAt ?? timestamp,
      errorCode,
      errorMessage,
    }))
  }
}
