import { z } from "zod"

import type { AstraSyncCollection } from "../../../../src/types/config"
import type { AstraRequestContext } from "../context"
import type { AstraPlatformEnv } from "../env"
import { isArticleImportOperatorAuthorized } from "../lib/article-import-operator"
import { errorResponse, jsonResponse } from "../lib/http"
import { recordPlatformRouteEventLater } from "../lib/platform-ops"
import {
  completeShadowSyncCompactionRun,
  createShadowSyncCompactionRun,
  deleteShadowSyncMutationByServerMutationId,
  ensureShadowSyncRecordStateForCollection,
  failShadowSyncCompactionRun,
  listShadowSyncCollectionsForUser,
  listShadowSyncMutationsUpToCursorOrder,
  pruneExpiredShadowSyncRecordStateTombstones,
  setShadowSyncCollectionCompactionFloor,
} from "../repositories/sync"

const SyncCompactionRequestSchema = z.object({
  userId: z.string().trim().min(1),
  collection: z.enum(["config", "vocabulary", "reading_history", "study_progress"]),
  cutoffCursorOrder: z.number().int().positive(),
  dryRun: z.boolean().optional(),
})

function logSyncCompactionRouteEvent(params: {
  requestId: string
  route: string
  responseStatus: number
}) {
  console.log(JSON.stringify({
    message: "sync compaction route handled",
    requestId: params.requestId,
    route: params.route,
    responseStatus: params.responseStatus,
  }))
}

function recordSyncCompactionRoute(
  env: AstraPlatformEnv,
  ctx: AstraRequestContext,
  route: string,
  responseStatus: number,
  metadata?: Record<string, unknown>,
) {
  recordPlatformRouteEventLater({
    env,
    ctx,
    domain: "sync-compaction",
    route,
    mode: "native",
    responseStatus,
    metadata,
  })
}

async function readCompactionRequest(request: Request): Promise<{
  userId: string
  collection: AstraSyncCollection
  cutoffCursorOrder: number
  dryRun?: boolean
}> {
  const raw = (await request.text()).trim()
  return SyncCompactionRequestSchema.parse(raw ? JSON.parse(raw) : {})
}

export async function handleSyncCompaction(
  request: Request,
  env: AstraPlatformEnv,
  ctx: AstraRequestContext,
): Promise<Response> {
  const operatorConfigured = Boolean(env.ARTICLE_IMPORT_OPERATOR_TOKEN?.trim())
  if (operatorConfigured && !isArticleImportOperatorAuthorized(request, env)) {
    const response = errorResponse(401, "OPERATOR_UNAUTHORIZED", "A valid operator token is required.", ctx.requestId)
    logSyncCompactionRouteEvent({ requestId: ctx.requestId, route: "operator-auth-gate", responseStatus: response.status })
    recordSyncCompactionRoute(env, ctx, "operator-auth-gate", response.status)
    return response
  }

  const payload = await readCompactionRequest(request)
  const nowIso = new Date(ctx.nowEpochMs).toISOString()
  const effectiveDryRun = ctx.config.syncCompactionDryRun || Boolean(payload.dryRun)
  const runId = crypto.randomUUID()

  await createShadowSyncCompactionRun(env.ASTRA_PLATFORM_DB, {
    runId,
    userId: payload.userId,
    collection: payload.collection,
    status: effectiveDryRun ? "dry_run_running" : "running",
    cutoffCursorOrder: payload.cutoffCursorOrder,
    floorCursor: null,
    floorCursorOrder: null,
    mutationsScanned: 0,
    mutationsDeleted: 0,
    recordsMaterialized: 0,
    startedAt: nowIso,
    completedAt: null,
    errorCode: null,
    errorMessage: null,
  })

  try {
    const [collections, recordState, candidateMutations] = await Promise.all([
      listShadowSyncCollectionsForUser(env.ASTRA_PLATFORM_DB, payload.userId),
      ensureShadowSyncRecordStateForCollection(env.ASTRA_PLATFORM_DB, {
        userId: payload.userId,
        collection: payload.collection,
        tombstoneRetentionDays: ctx.config.syncTombstoneRetentionDays,
      }),
      listShadowSyncMutationsUpToCursorOrder(env.ASTRA_PLATFORM_DB, {
        userId: payload.userId,
        collection: payload.collection,
        cutoffCursorOrder: payload.cutoffCursorOrder,
        limit: ctx.config.syncCompactionBatchSize,
      }),
    ])

    const floorCursor = candidateMutations.at(-1)?.cursor ?? collections[payload.collection].compactionFloorCursor ?? null
    const floorCursorOrder = candidateMutations.length > 0
      ? Number(candidateMutations.at(-1)?.cursor ?? 0)
      : collections[payload.collection].compactionFloorCursorOrder

    let mutationsDeleted = 0
    if (!effectiveDryRun && candidateMutations.length > 0) {
      for (const mutation of candidateMutations) {
        await deleteShadowSyncMutationByServerMutationId(env.ASTRA_PLATFORM_DB, mutation.serverMutationId)
        mutationsDeleted += 1
      }
      await setShadowSyncCollectionCompactionFloor(env.ASTRA_PLATFORM_DB, {
        userId: payload.userId,
        collection: payload.collection,
        floorCursor,
        floorCursorOrder,
        lastCompactedAt: nowIso,
      })
      await pruneExpiredShadowSyncRecordStateTombstones(env.ASTRA_PLATFORM_DB, {
        userId: payload.userId,
        collection: payload.collection,
        cutoffCursorOrder: payload.cutoffCursorOrder,
        nowIso,
      })
    }

    const status = effectiveDryRun ? "dry_run_completed" : "completed"
    await completeShadowSyncCompactionRun(env.ASTRA_PLATFORM_DB, {
      runId,
      status,
      floorCursor,
      floorCursorOrder,
      mutationsScanned: candidateMutations.length,
      mutationsDeleted,
      recordsMaterialized: recordState.length,
      completedAt: nowIso,
    })

    const response = jsonResponse({
      runId,
      status,
      dryRun: effectiveDryRun,
      enforcedDryRun: ctx.config.syncCompactionDryRun,
      userId: payload.userId,
      collection: payload.collection,
      cutoffCursorOrder: payload.cutoffCursorOrder,
      floorCursor,
      floorCursorOrder,
      mutationsScanned: candidateMutations.length,
      mutationsDeleted,
      recordsMaterialized: recordState.length,
      truncated: candidateMutations.length >= ctx.config.syncCompactionBatchSize,
      batchSize: ctx.config.syncCompactionBatchSize,
    })
    logSyncCompactionRouteEvent({ requestId: ctx.requestId, route: "native", responseStatus: response.status })
    recordSyncCompactionRoute(env, ctx, "native", response.status, {
      dryRun: effectiveDryRun,
      collection: payload.collection,
      cutoffCursorOrder: payload.cutoffCursorOrder,
      mutationsDeleted,
    })
    return response
  } catch (error) {
    await failShadowSyncCompactionRun(env.ASTRA_PLATFORM_DB, {
      runId,
      errorCode: "sync_compaction_failed",
      errorMessage: error instanceof Error ? error.message : String(error),
      completedAt: nowIso,
    }).catch(() => {})

    const response = errorResponse(500, "SYNC_COMPACTION_FAILED", error instanceof Error ? error.message : "Sync compaction failed.", ctx.requestId)
    logSyncCompactionRouteEvent({ requestId: ctx.requestId, route: "native", responseStatus: response.status })
    recordSyncCompactionRoute(env, ctx, "native", response.status)
    return response
  }
}
