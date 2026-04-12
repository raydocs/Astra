import { z } from "zod"

import {
  AstraConfigSyncRecordSchema,
  buildConfigCustomActionSyncRecordId,
  buildConfigSiteSyncRecordId,
  normalizeSiteKey,
} from "../../types/config"

export type SharedSyncCollection = "config" | "vocabulary" | "reading_history" | "study_progress"
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
  startedAt: z.number().int().nonnegative(),
  lastActivityAt: z.number().int().nonnegative(),
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
  if (collection === "config" || collection === "vocabulary") {
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
