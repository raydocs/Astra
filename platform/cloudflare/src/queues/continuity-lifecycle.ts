import type { MessageBatch } from "../bindings"
import { parsePlatformConfig, type AstraPlatformEnv } from "../env"
import {
  getContinuityDeleteJob,
  getContinuityExportJob,
  markContinuityDeleteJobCompleted,
  markContinuityDeleteJobFailed,
  markContinuityDeleteJobRunning,
  markContinuityExportJobCompleted,
  markContinuityExportJobExpired,
  markContinuityExportJobFailed,
  markContinuityExportJobRunning,
  parseContinuityDeleteScope,
  parseContinuityExportScope,
} from "../repositories/continuity-lifecycle"
import { getShadowUserById } from "../repositories/users"
import { listShadowDeviceRowsForUser } from "../repositories/devices"
import {
  appendShadowSyncMutation,
  ensureShadowSyncRecordStateForCollection,
  getShadowSyncMaxCursorOrder,
  listShadowSyncCollectionsForUser,
} from "../repositories/sync"
import type { ShadowSyncCollection, ShadowSyncRecordStateRow } from "../types/shadow-state"
import type { ContinuityDeleteCollection, ContinuityLifecycleQueueMessage } from "../types/continuity-lifecycle"

function isExpired(expiresAt: string | null, nowIso: string): boolean {
  return Boolean(expiresAt && expiresAt <= nowIso)
}

function groupRecordStateByCollection(rows: ShadowSyncRecordStateRow[]) {
  const grouped = new Map<ShadowSyncCollection, ShadowSyncRecordStateRow[]>()
  for (const row of rows) {
    const existing = grouped.get(row.collection) ?? []
    existing.push(row)
    grouped.set(row.collection, existing)
  }

  return {
    config: grouped.get("config") ?? [],
    vocabulary: grouped.get("vocabulary") ?? [],
    review_schedule: grouped.get("review_schedule") ?? [],
    reading_history: grouped.get("reading_history") ?? [],
    study_progress: grouped.get("study_progress") ?? [],
  }
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest("SHA-256", bytes)
  return [...new Uint8Array(digest)].map((chunk) => chunk.toString(16).padStart(2, "0")).join("")
}

async function maybeDeleteExportArtifact(env: AstraPlatformEnv, objectKey: string | null): Promise<void> {
  if (!objectKey || !env.ASTRA_IMPORT_PAYLOADS.delete) return
  await env.ASTRA_IMPORT_PAYLOADS.delete(objectKey)
}

async function consumeExportMessage(message: ContinuityLifecycleQueueMessage & { kind: "export" }, env: AstraPlatformEnv) {
  const job = await getContinuityExportJob(env.ASTRA_PLATFORM_DB, message.jobId)
  if (!job) {
    return
  }

  const nowIso = new Date().toISOString()
  if (job.status === "expired" || job.status === "failed") {
    return
  }

  if (job.status === "completed" && !isExpired(job.expiresAt, nowIso) && job.artifactObjectKey) {
    const head = await env.ASTRA_IMPORT_PAYLOADS.head(job.artifactObjectKey)
    if (head) {
      return
    }
  }

  if (job.status === "completed" && isExpired(job.expiresAt, nowIso)) {
    await markContinuityExportJobExpired(env.ASTRA_PLATFORM_DB, {
      jobId: job.jobId,
      expiredAt: nowIso,
    })
    await maybeDeleteExportArtifact(env, job.artifactObjectKey)
    return
  }

  await markContinuityExportJobRunning(env.ASTRA_PLATFORM_DB, {
    jobId: job.jobId,
    startedAt: nowIso,
  })

  const shadowUser = await getShadowUserById(env.ASTRA_PLATFORM_DB, job.userId)
  if (!shadowUser) {
    await markContinuityExportJobFailed(env.ASTRA_PLATFORM_DB, {
      jobId: job.jobId,
      failedAt: nowIso,
      errorCode: "missing_shadow_user",
      errorMessage: `No D1 shadow user was found for ${job.userId}.`,
    })
    return
  }

  const config = parsePlatformConfig(env)
  const [devices, collections] = await Promise.all([
    listShadowDeviceRowsForUser(env.ASTRA_PLATFORM_DB, job.userId),
    listShadowSyncCollectionsForUser(env.ASTRA_PLATFORM_DB, job.userId),
  ])
  const scope = parseContinuityExportScope(job)
  const recordStateRows = (await Promise.all(scope.collections.map((collection) =>
    ensureShadowSyncRecordStateForCollection(env.ASTRA_PLATFORM_DB, {
      userId: job.userId,
      collection,
      tombstoneRetentionDays: config.syncTombstoneRetentionDays,
    })
  ))).flat()
  const materialized = groupRecordStateByCollection(recordStateRows)
  const exportPayload = {
    version: 1,
    kind: "astra-continuity-cloud-export",
    generatedAt: nowIso,
    user: {
      id: shadowUser.id,
      email: shadowUser.email,
      billingEmail: shadowUser.billingEmail,
      createdAt: shadowUser.createdAt,
      plan: shadowUser.plan,
      subscriptionStatus: shadowUser.subscriptionStatus,
      providerEntitlements: shadowUser.providerEntitlements,
    },
    devices: devices.map((device) => ({
      deviceId: device.deviceId,
      label: device.label,
      platform: device.platform,
      browserFamily: device.browserFamily,
      appKind: device.appKind,
      appVersion: device.appVersion,
      firstSeenAt: device.firstSeenAt,
      lastSeenAt: device.lastSeenAt,
      lastSyncAt: device.lastSyncAt,
      status: device.status,
      revokedAt: device.revokedAt,
    })),
    sync: {
      collections: scope.collections.reduce<Record<string, unknown>>((result, collection) => {
        result[collection] = collections[collection]
        return result
      }, {}),
      records: scope.collections.reduce<Record<string, unknown>>((result, collection) => {
        result[collection] = materialized[collection]
          .filter((record) => !record.isDeleted)
          .map((record) => ({
            recordId: record.recordId,
            payload: record.payload,
            serverUpdatedAt: record.lastServerUpdatedAt,
            cursor: record.lastCursor,
            deviceId: record.lastDeviceId,
          }))
        return result
      }, {}),
    },
    exclusions: [
      "sessionToken",
      "provider secrets",
      "translation cache",
      "page digests",
      "local-only daily aggregates",
      "raw import artifacts",
    ],
  }

  const serialized = JSON.stringify(exportPayload, null, 2)
  const artifactSha256 = await sha256Hex(serialized)
  const objectKey = `continuity-exports/${nowIso.slice(0, 10)}/${job.jobId}.json`
  await env.ASTRA_IMPORT_PAYLOADS.put(objectKey, serialized, {
    httpMetadata: {
      contentType: "application/json",
    },
    customMetadata: {
      jobId: job.jobId,
      userId: job.userId,
      sha256: artifactSha256,
      kind: "account-export",
    },
  })

  const retentionExpiresAt = new Date(
    Date.parse(nowIso) + (config.continuityExportArtifactRetentionDays * 24 * 60 * 60 * 1000),
  ).toISOString()
  await markContinuityExportJobCompleted(env.ASTRA_PLATFORM_DB, {
    jobId: job.jobId,
    completedAt: nowIso,
    expiresAt: retentionExpiresAt,
    artifactObjectKey: objectKey,
    artifactSha256,
    artifactBytes: new TextEncoder().encode(serialized).byteLength,
  })
}

function buildDeleteClientMutationId(jobId: string, collection: ContinuityDeleteCollection, recordId: string): string {
  return `cloud-delete:${jobId}:${collection}:${recordId}`
}

async function consumeDeleteMessage(message: ContinuityLifecycleQueueMessage & { kind: "cloud-data-delete" }, env: AstraPlatformEnv) {
  const job = await getContinuityDeleteJob(env.ASTRA_PLATFORM_DB, message.jobId)
  if (!job) {
    return
  }

  const nowIso = new Date().toISOString()
  if (job.status === "completed" || job.status === "failed" || job.status === "canceled") {
    return
  }

  if (Date.parse(job.scheduledForAt) > Date.parse(nowIso)) {
    return
  }

  await markContinuityDeleteJobRunning(env.ASTRA_PLATFORM_DB, {
    jobId: job.jobId,
    startedAt: nowIso,
  })

  const config = parsePlatformConfig(env)
  const collections = await listShadowSyncCollectionsForUser(env.ASTRA_PLATFORM_DB, job.userId)
  const scope = parseContinuityDeleteScope(job)
  const materializedEntries = (await Promise.all(scope.collections.map((collection) =>
    ensureShadowSyncRecordStateForCollection(env.ASTRA_PLATFORM_DB, {
      userId: job.userId,
      collection,
      tombstoneRetentionDays: config.syncTombstoneRetentionDays,
    })
  ))).flat()
  const materialized = groupRecordStateByCollection(materializedEntries)
  const deletedRecords: Partial<Record<ContinuityDeleteCollection, number>> = {}
  let nextCursorOrder = await getShadowSyncMaxCursorOrder(env.ASTRA_PLATFORM_DB)

  for (const collection of scope.collections) {
    const activeRecords = materialized[collection].filter((record) => !record.isDeleted)
    deletedRecords[collection] = 0
    for (const record of activeRecords) {
      nextCursorOrder += 1
      const result = await appendShadowSyncMutation(env.ASTRA_PLATFORM_DB, {
        userId: job.userId,
        collection,
        collectionEnabled: collections[collection].enabled,
        collectionDefaultEnabled: collections[collection].defaultEnabled,
        schemaVersion: 1,
        recordId: record.recordId,
        operation: "delete",
        clientMutationId: buildDeleteClientMutationId(job.jobId, collection, record.recordId),
        deviceId: job.requestedByDeviceId,
        clientUpdatedAt: nowIso,
        serverUpdatedAt: nowIso,
        cursor: String(nextCursorOrder),
        payload: null,
        tombstoneRetainedUntil: new Date(
          Date.parse(nowIso) + (config.syncTombstoneRetentionDays * 24 * 60 * 60 * 1000),
        ).toISOString(),
        shadowUpdatedAt: nowIso,
      })
      if (!result.deduped) {
        deletedRecords[collection] = (deletedRecords[collection] ?? 0) + 1
      }
    }
  }

  await markContinuityDeleteJobCompleted(env.ASTRA_PLATFORM_DB, {
    jobId: job.jobId,
    completedAt: nowIso,
    deletedRecords,
  })
}

export async function consumeContinuityLifecycleQueue(
  batch: MessageBatch<ContinuityLifecycleQueueMessage>,
  env: AstraPlatformEnv,
): Promise<void> {
  await Promise.all(batch.messages.map(async (message) => {
    try {
      if (message.body.kind === "export") {
        await consumeExportMessage(message.body, env)
      } else {
        await consumeDeleteMessage(message.body, env)
      }
      message.ack()
    } catch (error) {
      const nowIso = new Date().toISOString()
      if (message.body.kind === "export") {
        await markContinuityExportJobFailed(env.ASTRA_PLATFORM_DB, {
          jobId: message.body.jobId,
          failedAt: nowIso,
          errorCode: "queue_consume_failed",
          errorMessage: error instanceof Error ? error.message : String(error),
        }).catch(() => {})
      } else {
        await markContinuityDeleteJobFailed(env.ASTRA_PLATFORM_DB, {
          jobId: message.body.jobId,
          failedAt: nowIso,
          errorCode: "queue_consume_failed",
          errorMessage: error instanceof Error ? error.message : String(error),
        }).catch(() => {})
      }
      console.error(JSON.stringify({
        message: "continuity lifecycle queue consume failed",
        queue: batch.queue,
        kind: message.body.kind,
        jobId: message.body.jobId,
        error: error instanceof Error ? error.message : String(error),
      }))
      message.ack()
    }
  }))
}
