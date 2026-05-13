import { z } from "zod"

import {
  AstraConfigSyncRecordSchema,
  buildConfigCustomActionSyncRecordId,
  buildConfigSiteSyncRecordId,
  normalizeSiteKey,
} from "../../types/config"

export type SharedSyncCollection = "config" | "vocabulary" | "review_schedule" | "reading_history" | "study_progress"
export type SharedSyncOperation = "upsert" | "delete"

export interface SharedSyncPreferences {
  reading_history: boolean
  study_progress: boolean
}

export interface SharedSyncMutationInput {
  collection: SharedSyncCollection
  schemaVersion: number
  recordId: string
  operation: SharedSyncOperation
  clientMutationId: string
  deviceId: string
  clientUpdatedAt: string
  payload?: Record<string, unknown> | null
}

export interface SharedSyncMutationRejection {
  collection: SharedSyncCollection
  clientMutationId: string
  code: string
  message: string
}

const STUDY_STEPS_ORDER = ["read", "guided_read", "explain", "vocab_save", "vocab_review"] as const
const StudyStepSchema = z.enum(STUDY_STEPS_ORDER)
const SyncedVocabularyEntrySchema = z.object({
  id: z.string().trim().min(1),
  text: z.string().trim().min(1),
  translation: z.string().trim().min(1).optional(),
  explanation: z.string().trim().min(1).optional(),
  context: z.string().trim().min(1).optional(),
  url: z.string().trim().min(1).optional(),
  hostname: z.string().trim().min(1).optional(),
  savedAt: z.number().int().nonnegative(),
  note: z.string().max(1000).optional(),
  tags: z.array(z.string()).optional(),
  glossaryEnabled: z.boolean().optional(),
  glossaryScope: z.enum(["hostname", "global"]).optional(),
  glossaryTargetText: z.string().trim().min(1).optional(),
})
const SyncedVocabularyReviewScheduleRecordSchema = z.object({
  vocabularyEntryId: z.string().trim().min(1),
  srsBox: z.number().int().min(1).max(5),
  nextReviewAt: z.number().int().nonnegative(),
  reviewCount: z.number().int().nonnegative(),
  lastReviewedAt: z.number().int().nonnegative().nullable().default(null),
  lastReviewGrade: z.enum(["again", "hard", "good", "easy"]).nullable().default(null),
  lastReviewGradeAt: z.number().int().nonnegative().nullable().default(null),
  updatedAt: z.number().int().nonnegative(),
}).strict()
const SyncedReadingHistoryEntrySchema = z.object({
  id: z.string().trim().min(1),
  url: z.string().trim().min(1),
  hostname: z.string().trim().min(1),
  title: z.string().trim().min(1),
  wordsTranslated: z.number().int().nonnegative(),
  visitedAt: z.number().int().nonnegative(),
})
const SyncedStudyProgressEntrySchema = z.object({
  url: z.string().trim().min(1),
  hostname: z.string().trim().min(1),
  title: z.string(),
  completedSteps: z.array(StudyStepSchema).default([]),
  sentencesExplained: z.number().int().nonnegative(),
  vocabSaved: z.number().int().nonnegative(),
  vocabReviewed: z.number().int().nonnegative().default(0),
  startedAt: z.number().int().nonnegative(),
  lastActivityAt: z.number().int().nonnegative(),
}).strict()
const WebLibraryMetadataRecordSchema = z.object({
  id: z.string().trim().min(1),
  kind: z.enum(["article", "pdf", "epub", "subtitle", "video-note", "asset"]),
  title: z.string().trim().min(1).max(500),
  summary: z.string().trim().min(1).max(1000),
  detail: z.string().trim().min(1).max(1000),
  route: z.enum(["/articles", "/files/pdf", "/files/epub", "/files/subtitles", "/video-notes", "/assets"]),
  ownerMode: z.literal("account"),
  accountId: z.string().trim().min(1),
  sourceLegacyKey: z.string().trim().min(1).nullable().default(null),
  legacySignature: z.string().trim().min(1).nullable().default(null),
  createdAt: z.string().trim().min(1),
  updatedAt: z.string().trim().min(1),
  importedAt: z.string().trim().min(1),
  lastOpenedAt: z.string().trim().min(1).nullable().default(null),
  removedAt: z.string().trim().min(1).nullable().default(null),
  syncState: z.enum(["synced", "pending_import", "import_failed"]),
  metadata: z.record(z.string(), z.unknown()).default({}),
}).strict()

const WEB_LIBRARY_CONFIG_RECORD_PREFIX = "__web_library_metadata_v1__:"
const WEB_LIBRARY_DOCUMENT_SNAPSHOT_RECORD_PREFIX = "__web_library_document_snapshot_v1__:"
const WEB_DOCUMENT_SNAPSHOT_CHUNK_SIZE_CHARS = 32_000
const WEB_DOCUMENT_SNAPSHOT_MAX_CHUNKS = 13

const WebLibraryDocumentSnapshotManifestSchema = z.object({
  kind: z.literal("web_library_document_snapshot_manifest_v1"),
  libraryItemId: z.string().trim().min(1),
  itemKind: z.enum(["article", "pdf", "epub", "subtitle", "video-note", "asset"]),
  version: z.literal(1),
  metadata: z.record(z.string(), z.unknown()).default({}),
  extractedTextStatus: z.enum(["available", "empty", "oversized"]),
  extractedTextCharCount: z.number().int().nonnegative(),
  chunkCount: z.number().int().nonnegative().max(WEB_DOCUMENT_SNAPSHOT_MAX_CHUNKS),
  budget: z.object({
    maxExtractedTextChars: z.literal(400_000),
    chunkThresholdChars: z.literal(48_000),
    chunkSizeChars: z.literal(WEB_DOCUMENT_SNAPSHOT_CHUNK_SIZE_CHARS),
    retentionPolicy: z.literal("latest_snapshot_per_library_item"),
  }),
  failureCode: z.enum(["EXTRACTED_TEXT_EMPTY", "EXTRACTED_TEXT_TOO_LARGE"]).nullable().default(null),
  failureMessage: z.string().trim().min(1).max(1000).nullable().default(null),
  byteAvailability: z.object({
    originalFileBytesSynced: z.literal(false),
    requiresReimportForBinaryView: z.literal(true),
    message: z.string().trim().min(1).max(1000),
  }),
  updatedAt: z.number().int().nonnegative(),
}).strict()

const WebLibraryDocumentSnapshotChunkSchema = z.object({
  kind: z.literal("web_library_document_snapshot_chunk_v1"),
  libraryItemId: z.string().trim().min(1),
  itemKind: z.enum(["article", "pdf", "epub", "subtitle", "video-note", "asset"]),
  version: z.literal(1),
  chunkIndex: z.number().int().nonnegative().max(WEB_DOCUMENT_SNAPSHOT_MAX_CHUNKS - 1),
  chunkCount: z.number().int().positive().max(WEB_DOCUMENT_SNAPSHOT_MAX_CHUNKS),
  text: z.string().max(WEB_DOCUMENT_SNAPSHOT_CHUNK_SIZE_CHARS),
  charCount: z.number().int().nonnegative().max(WEB_DOCUMENT_SNAPSHOT_CHUNK_SIZE_CHARS),
  updatedAt: z.number().int().nonnegative(),
}).strict()

export function sanitizeSyncUrl(url?: string | null): string | undefined {
  const trimmed = url?.trim()
  if (!trimmed) return undefined

  try {
    const parsed = new URL(trimmed)
    parsed.search = ""
    parsed.hash = ""
    return parsed.toString()
  } catch {
    return trimmed
  }
}

function orderStudySteps(steps: readonly z.infer<typeof StudyStepSchema>[]): z.infer<typeof StudyStepSchema>[] {
  const present = new Set(steps)
  return STUDY_STEPS_ORDER.filter((step) => present.has(step))
}

export function isSyncCollectionEnabled(
  syncPreferences: SharedSyncPreferences,
  collection: SharedSyncCollection,
): boolean {
  if (collection === "config" || collection === "vocabulary" || collection === "review_schedule") {
    return true
  }

  if (collection === "reading_history") {
    return syncPreferences.reading_history
  }

  return syncPreferences.study_progress
}

function createSyncRejection(
  mutation: SharedSyncMutationInput,
  code: string,
  message: string,
): SharedSyncMutationRejection {
  return {
    collection: mutation.collection,
    clientMutationId: mutation.clientMutationId,
    code,
    message,
  }
}

export function validateSyncMutationPayload(
  syncPreferences: SharedSyncPreferences,
  mutation: SharedSyncMutationInput,
): SharedSyncMutationInput | SharedSyncMutationRejection {
  if (!isSyncCollectionEnabled(syncPreferences, mutation.collection)) {
    return createSyncRejection(
      mutation,
      "SYNC_DISABLED",
      `Sync is not enabled for collection: ${mutation.collection}.`,
    )
  }

  if (mutation.collection === "config") {
    if (mutation.recordId.startsWith(WEB_LIBRARY_DOCUMENT_SNAPSHOT_RECORD_PREFIX)) {
      if (mutation.operation === "delete") {
        return { ...mutation, payload: null }
      }

      const manifestMatch = /^__web_library_document_snapshot_v1__:(.+):manifest$/.exec(mutation.recordId)
      const chunkMatch = /^__web_library_document_snapshot_v1__:(.+):chunk:(\d+)$/.exec(mutation.recordId)
      const libraryItemId = manifestMatch?.[1] ?? chunkMatch?.[1] ?? null
      if (!libraryItemId) {
        return createSyncRejection(
          mutation,
          "INVALID_SYNC_PAYLOAD",
          "Web library document snapshot recordId must target a manifest or chunk.",
        )
      }

      try {
        if (manifestMatch) {
          const payload = WebLibraryDocumentSnapshotManifestSchema.parse(mutation.payload)
          if (payload.libraryItemId !== libraryItemId) {
            return createSyncRejection(
              mutation,
              "INVALID_SYNC_PAYLOAD",
              "Web library document snapshot manifest recordId must match the payload libraryItemId.",
            )
          }
          if (payload.extractedTextStatus === "available" && payload.chunkCount <= 0) {
            return createSyncRejection(
              mutation,
              "INVALID_SYNC_PAYLOAD",
              "Available web library document snapshots must include at least one chunk.",
            )
          }
          if (payload.extractedTextStatus !== "available" && payload.chunkCount !== 0) {
            return createSyncRejection(
              mutation,
              "INVALID_SYNC_PAYLOAD",
              "Unavailable or oversized web library snapshots must not include chunk records.",
            )
          }
          return { ...mutation, payload }
        }

        const payload = WebLibraryDocumentSnapshotChunkSchema.parse(mutation.payload)
        const chunkIndex = Number(chunkMatch?.[2])
        if (payload.libraryItemId !== libraryItemId || payload.chunkIndex !== chunkIndex || payload.charCount !== payload.text.length) {
          return createSyncRejection(
            mutation,
            "INVALID_SYNC_PAYLOAD",
            "Web library document snapshot chunk recordId must match payload libraryItemId/chunkIndex/charCount.",
          )
        }
        return { ...mutation, payload }
      } catch (error) {
        return createSyncRejection(
          mutation,
          "INVALID_SYNC_PAYLOAD",
          error instanceof Error ? error.message : "Invalid web library document snapshot sync payload.",
        )
      }
    }

    if (mutation.recordId.startsWith(WEB_LIBRARY_CONFIG_RECORD_PREFIX)) {
      if (mutation.operation === "delete") {
        return { ...mutation, payload: null }
      }

      try {
        const payload = WebLibraryMetadataRecordSchema.parse(mutation.payload)
        if (`${WEB_LIBRARY_CONFIG_RECORD_PREFIX}${payload.id}` !== mutation.recordId) {
          return createSyncRejection(
            mutation,
            "INVALID_SYNC_PAYLOAD",
            "Web library metadata recordId must match the payload id.",
          )
        }
        return { ...mutation, payload }
      } catch (error) {
        return createSyncRejection(
          mutation,
          "INVALID_SYNC_PAYLOAD",
          error instanceof Error ? error.message : "Invalid web library metadata sync payload.",
        )
      }
    }

    if (mutation.operation === "delete" && mutation.recordId === "global") {
      return createSyncRejection(
        mutation,
        "INVALID_SYNC_PAYLOAD",
        "Config global record does not support delete operations.",
      )
    }

    if (mutation.operation === "delete") {
      return { ...mutation, payload: null }
    }

    try {
      const payload = AstraConfigSyncRecordSchema.parse(mutation.payload)
      if (payload.kind === "global") {
        if (mutation.recordId !== "global") {
          return createSyncRejection(
            mutation,
            "INVALID_SYNC_PAYLOAD",
            "Config global recordId must be 'global'.",
          )
        }
        if (payload.config.connectionMode !== "astra" && payload.config.provider.relayBaseURL !== undefined) {
          return createSyncRejection(
            mutation,
            "INVALID_SYNC_PAYLOAD",
            "Custom relay base URLs remain device-local in phase 1.",
          )
        }
      }

      if (payload.kind === "site") {
        const hostname = normalizeSiteKey(payload.hostname)
        if (!hostname || mutation.recordId !== buildConfigSiteSyncRecordId(hostname)) {
          return createSyncRejection(
            mutation,
            "INVALID_SYNC_PAYLOAD",
            "Config site recordId must match the normalized hostname.",
          )
        }
        return {
          ...mutation,
          payload: {
            ...payload,
            hostname,
          },
        }
      }

      if (payload.kind === "custom_action" && mutation.recordId !== buildConfigCustomActionSyncRecordId(payload.action.id)) {
        return createSyncRejection(
          mutation,
          "INVALID_SYNC_PAYLOAD",
          "Config custom action recordId must match the action id.",
        )
      }

      return {
        ...mutation,
        payload,
      }
    } catch (error) {
      return createSyncRejection(
        mutation,
        "INVALID_SYNC_PAYLOAD",
        error instanceof Error ? error.message : "Invalid config sync payload.",
      )
    }
  }

  if (mutation.collection === "review_schedule") {
    if (mutation.operation === "delete") {
      return { ...mutation, payload: null }
    }

    try {
      const payload = SyncedVocabularyReviewScheduleRecordSchema.parse(mutation.payload)
      if (payload.vocabularyEntryId !== mutation.recordId) {
        return createSyncRejection(
          mutation,
          "INVALID_SYNC_PAYLOAD",
          "Review schedule recordId must match payload.vocabularyEntryId.",
        )
      }

      return {
        ...mutation,
        payload,
      }
    } catch (error) {
      return createSyncRejection(
        mutation,
        "INVALID_SYNC_PAYLOAD",
        error instanceof Error ? error.message : "Invalid review schedule sync payload.",
      )
    }
  }

  if (mutation.collection === "reading_history") {
    if (mutation.operation === "delete") {
      return { ...mutation, payload: null }
    }

    try {
      const sanitizedRecordId = sanitizeSyncUrl(mutation.recordId)
      const payload = SyncedReadingHistoryEntrySchema.parse({
        ...mutation.payload,
        ...(sanitizeSyncUrl((mutation.payload as { id?: string | null } | null | undefined)?.id)
          ? { id: sanitizeSyncUrl((mutation.payload as { id?: string | null } | null | undefined)?.id) }
          : {}),
        ...(sanitizeSyncUrl((mutation.payload as { url?: string | null } | null | undefined)?.url)
          ? { url: sanitizeSyncUrl((mutation.payload as { url?: string | null } | null | undefined)?.url) }
          : {}),
      })

      if (!sanitizedRecordId || sanitizedRecordId !== mutation.recordId) {
        return createSyncRejection(
          mutation,
          "INVALID_SYNC_PAYLOAD",
          "Reading history recordId must be the sanitized URL.",
        )
      }

      if (payload.id !== mutation.recordId || payload.url !== mutation.recordId) {
        return createSyncRejection(
          mutation,
          "INVALID_SYNC_PAYLOAD",
          "Reading history payload id/url must match the sanitized recordId.",
        )
      }

      return {
        ...mutation,
        payload,
      }
    } catch (error) {
      return createSyncRejection(
        mutation,
        "INVALID_SYNC_PAYLOAD",
        error instanceof Error ? error.message : "Invalid reading history sync payload.",
      )
    }
  }

  if (mutation.collection === "study_progress") {
    if (mutation.operation === "delete") {
      const sanitizedRecordId = sanitizeSyncUrl(mutation.recordId)
      if (!sanitizedRecordId || sanitizedRecordId !== mutation.recordId) {
        return createSyncRejection(
          mutation,
          "INVALID_SYNC_PAYLOAD",
          "Study progress recordId must be the sanitized URL.",
        )
      }
      return { ...mutation, payload: null }
    }

    try {
      const sanitizedRecordId = sanitizeSyncUrl(mutation.recordId)
      const parsedPayload = SyncedStudyProgressEntrySchema.parse({
        ...mutation.payload,
        ...(sanitizeSyncUrl((mutation.payload as { url?: string | null } | null | undefined)?.url)
          ? { url: sanitizeSyncUrl((mutation.payload as { url?: string | null } | null | undefined)?.url) }
          : {}),
      })
      const payload = {
        ...parsedPayload,
        completedSteps: orderStudySteps(parsedPayload.completedSteps),
      }

      if (!sanitizedRecordId || sanitizedRecordId !== mutation.recordId) {
        return createSyncRejection(
          mutation,
          "INVALID_SYNC_PAYLOAD",
          "Study progress recordId must be the sanitized URL.",
        )
      }

      if (payload.url !== mutation.recordId) {
        return createSyncRejection(
          mutation,
          "INVALID_SYNC_PAYLOAD",
          "Study progress payload url must match the sanitized recordId.",
        )
      }

      return {
        ...mutation,
        payload,
      }
    } catch (error) {
      return createSyncRejection(
        mutation,
        "INVALID_SYNC_PAYLOAD",
        error instanceof Error ? error.message : "Invalid study progress sync payload.",
      )
    }
  }

  if (mutation.operation === "delete") {
    return { ...mutation, payload: null }
  }

  try {
    const payload = SyncedVocabularyEntrySchema.parse({
      ...mutation.payload,
      ...(sanitizeSyncUrl((mutation.payload as { url?: string | null } | null | undefined)?.url)
        ? { url: sanitizeSyncUrl((mutation.payload as { url?: string | null } | null | undefined)?.url) }
        : {}),
    })

    if (payload.id !== mutation.recordId) {
      return createSyncRejection(
        mutation,
        "INVALID_SYNC_PAYLOAD",
        "Vocabulary recordId must match payload.id.",
      )
    }

    return {
      ...mutation,
      payload,
    }
  } catch (error) {
    return createSyncRejection(
      mutation,
      "INVALID_SYNC_PAYLOAD",
      error instanceof Error ? error.message : "Invalid vocabulary sync payload.",
    )
  }
}
