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
