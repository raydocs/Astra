import { describe, expect, it } from "vitest"

import { validateSyncMutationPayload, type SharedSyncMutationInput } from "./sync-push"

const syncPreferences = {
  reading_history: true,
  study_progress: true,
}

function baseMutation(overrides: Partial<SharedSyncMutationInput>): SharedSyncMutationInput {
  return {
    collection: "config",
    schemaVersion: 1,
    recordId: "__web_library_document_snapshot_v1__:lib_pdf_1:manifest",
    operation: "upsert",
    clientMutationId: "test-mutation",
    deviceId: "device-web",
    clientUpdatedAt: "2026-05-13T00:00:00.000Z",
    payload: {},
    ...overrides,
  }
}

describe("validateSyncMutationPayload review schedules", () => {
  it("accepts sync-safe review schedule records with distinct four-grade metadata", () => {
    const result = validateSyncMutationPayload(syncPreferences, baseMutation({
      collection: "review_schedule",
      recordId: "word-1",
      clientMutationId: "test-review-schedule",
      payload: {
        vocabularyEntryId: "word-1",
        srsBox: 3,
        nextReviewAt: 1778707200000,
        reviewCount: 4,
        lastReviewedAt: 1778620800000,
        lastReviewGrade: "hard",
        lastReviewGradeAt: 1778620800000,
        updatedAt: 1778620800000,
      },
    }))

    expect("code" in result).toBe(false)
  })

  it("rejects review schedule payloads whose record id does not match the vocabulary entry id", () => {
    const result = validateSyncMutationPayload(syncPreferences, baseMutation({
      collection: "review_schedule",
      recordId: "word-1",
      clientMutationId: "test-review-schedule-mismatch",
      payload: {
        vocabularyEntryId: "word-2",
        srsBox: 3,
        nextReviewAt: 1778707200000,
        reviewCount: 4,
        lastReviewedAt: 1778620800000,
        lastReviewGrade: "easy",
        lastReviewGradeAt: 1778620800000,
        updatedAt: 1778620800000,
      },
    }))

    expect(result).toMatchObject({ code: "INVALID_SYNC_PAYLOAD" })
  })
})

describe("validateSyncMutationPayload vocabulary", () => {
  it("preserves sync-safe source context while stripping review schedule fields from vocabulary payloads", () => {
    const result = validateSyncMutationPayload(syncPreferences, baseMutation({
      collection: "vocabulary",
      recordId: "word-1",
      clientMutationId: "test-vocabulary-source-context",
      payload: {
        id: "word-1",
        text: "hello",
        translation: "你好",
        savedAt: 1778620800000,
        url: "https://example.com/article?utm=1#section",
        sourceContext: {
          surface: "popup_deep_read",
          pageTitle: "Learning article",
          pageUrl: "https://example.com/article",
          hostname: "example.com",
          sentenceText: "Hello world.",
          languageLevel: "intermediate",
          explainMode: "deep",
        },
        srsBox: 4,
        nextReviewAt: 1778707200000,
        reviewCount: 3,
        lastReviewedAt: 1778620800000,
      },
    }))

    expect("code" in result).toBe(false)
    if ("code" in result) throw new Error(result.message)
    expect(result).toMatchObject({
      payload: expect.objectContaining({
        id: "word-1",
        url: "https://example.com/article",
        sourceContext: expect.objectContaining({
          languageLevel: "intermediate",
          explainMode: "deep",
        }),
      }),
    })
    expect(result.payload).not.toMatchObject({
      srsBox: expect.anything(),
      nextReviewAt: expect.anything(),
      reviewCount: expect.anything(),
      lastReviewedAt: expect.anything(),
    })
  })
})

describe("validateSyncMutationPayload web document snapshots", () => {
  it("accepts manifest and bounded chunk records without original file bytes", () => {
    const manifest = validateSyncMutationPayload(syncPreferences, baseMutation({
      payload: {
        kind: "web_library_document_snapshot_manifest_v1",
        libraryItemId: "lib_pdf_1",
        itemKind: "pdf",
        version: 1,
        metadata: { fileName: "guide.pdf" },
        extractedTextStatus: "available",
        extractedTextCharCount: 120,
        chunkCount: 1,
        budget: {
          maxExtractedTextChars: 400_000,
          chunkThresholdChars: 48_000,
          chunkSizeChars: 32_000,
          retentionPolicy: "latest_snapshot_per_library_item",
        },
        failureCode: null,
        failureMessage: null,
        byteAvailability: {
          originalFileBytesSynced: false,
          requiresReimportForBinaryView: true,
          message: "Re-import required for binary viewer access.",
        },
        updatedAt: 1778620800000,
      },
    }))
    expect("code" in manifest).toBe(false)

    const chunk = validateSyncMutationPayload(syncPreferences, baseMutation({
      recordId: "__web_library_document_snapshot_v1__:lib_pdf_1:chunk:0",
      clientMutationId: "test-mutation-chunk",
      payload: {
        kind: "web_library_document_snapshot_chunk_v1",
        libraryItemId: "lib_pdf_1",
        itemKind: "pdf",
        version: 1,
        chunkIndex: 0,
        chunkCount: 1,
        text: "{\"fileName\":\"guide.pdf\"}",
        charCount: 24,
        updatedAt: 1778620800000,
      },
    }))
    expect("code" in chunk).toBe(false)
  })

  it("rejects available manifests without chunks", () => {
    const result = validateSyncMutationPayload(syncPreferences, baseMutation({
      clientMutationId: "test-mutation-empty-available",
      payload: {
        kind: "web_library_document_snapshot_manifest_v1",
        libraryItemId: "lib_pdf_1",
        itemKind: "pdf",
        version: 1,
        metadata: {},
        extractedTextStatus: "available",
        extractedTextCharCount: 10,
        chunkCount: 0,
        budget: {
          maxExtractedTextChars: 400_000,
          chunkThresholdChars: 48_000,
          chunkSizeChars: 32_000,
          retentionPolicy: "latest_snapshot_per_library_item",
        },
        failureCode: null,
        failureMessage: null,
        byteAvailability: {
          originalFileBytesSynced: false,
          requiresReimportForBinaryView: true,
          message: "Re-import required for binary viewer access.",
        },
        updatedAt: 1778620800000,
      },
    }))

    expect(result).toMatchObject({ code: "INVALID_SYNC_PAYLOAD" })
  })

  it("rejects snapshot chunks whose declared character count does not match payload text", () => {
    const result = validateSyncMutationPayload(syncPreferences, baseMutation({
      recordId: "__web_library_document_snapshot_v1__:lib_pdf_1:chunk:0",
      clientMutationId: "test-mutation-bad-chunk",
      payload: {
        kind: "web_library_document_snapshot_chunk_v1",
        libraryItemId: "lib_pdf_1",
        itemKind: "pdf",
        version: 1,
        chunkIndex: 0,
        chunkCount: 1,
        text: "abc",
        charCount: 99,
        updatedAt: 1778620800000,
      },
    }))

    expect(result).toMatchObject({
      code: "INVALID_SYNC_PAYLOAD",
    })
  })
})
