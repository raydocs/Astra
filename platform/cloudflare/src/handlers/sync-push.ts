import { z } from "zod"

import {
  AstraSyncMutationInputSchema,
  AstraSyncPushResponseSchema,
  type AstraSyncPushResponse,
} from "../../../../src/types/auth"
import type { AstraRequestContext } from "../context"
import type { AstraPlatformEnv, SyncPushWriteMode } from "../env"
import { errorResponse, withResponseHeaders } from "../lib/http"
import {
  ShadowSessionAuthError,
  ShadowSessionUnavailableError,
  type ValidatedShadowSession,
  validateShadowSession,
} from "../lib/session-auth"
import { recordPlatformParityEventLater, recordPlatformRouteEventLater } from "../lib/platform-ops"
import {
  buildNodeRelayDownstreamHeaders,
  fetchNodeRelay,
  proxyToNodeRelay,
} from "../lib/proxy"
import { getShadowDevice, touchShadowDevice, upsertShadowDevice } from "../repositories/devices"
import { getShadowSessionById, touchShadowSession, upsertShadowSession } from "../repositories/sessions"
import {
  appendShadowSyncMutation,
  deleteShadowSyncMutationByServerMutationId,
  deleteShadowSyncRecordState,
  getShadowSyncMaxCursorOrder,
  getShadowSyncMutationByClientMutationId,
  listShadowSyncCollectionRowsForUser,
  listShadowSyncCollectionsForUser,
  restoreShadowSyncRecordState,
  upsertShadowSyncCollection,
} from "../repositories/sync"
import {
  SHADOW_SYNC_COLLECTIONS,
  type ShadowDeviceRow,
  type ShadowSessionRow,
  type ShadowSyncCollectionRow,
  type ShadowSyncRecordStateRow,
  type ShadowUserRow,
} from "../types/shadow-state"
import { isSyncCollectionEnabled, validateSyncMutationPayload, type SharedSyncMutationInput } from "../../../../src/utils/astra/sync-push"

const SyncPushRequestSchema = z.object({
  mutations: z.array(AstraSyncMutationInputSchema).default([]),
}).default({ mutations: [] })

interface AuthoritativeSyncPushState {
  shadowUser: ShadowUserRow
  shadowSession: ShadowSessionRow
  currentDevice: ShadowDeviceRow
  collections: Record<(typeof SHADOW_SYNC_COLLECTIONS)[number], ShadowSyncCollectionRow>
}

interface SyncPushRollbackState {
  insertedServerMutationIds: string[]
  previousRecordStates: Array<{
    collection: (typeof SHADOW_SYNC_COLLECTIONS)[number]
    recordId: string
    previous: ShadowSyncRecordStateRow | null
  }>
}

class ShadowSyncPushUnavailableError extends Error {
  constructor(readonly reason: string, message: string) {
    super(message)
    this.name = "ShadowSyncPushUnavailableError"
  }
}

function tagSyncPushResponse(
  response: Response,
  ctx: AstraRequestContext,
  params: {
    route: string
    mode: SyncPushWriteMode
    fallbackReason?: string | null
  },
): Response {
  const headers: Record<string, string> = {
    "x-astra-request-id": ctx.requestId,
    "x-astra-platform-route": params.route,
    "x-astra-platform-mode": params.mode,
    "x-astra-platform-default-mode": ctx.config.syncPushWriteMode,
    "x-astra-platform-domain": "sync-push",
  }

  if (params.fallbackReason) {
    headers["x-astra-platform-fallback-reason"] = params.fallbackReason
  }

  return withResponseHeaders(response, headers)
}

function logSyncPushRouteEvent(params: {
  requestId: string
  route: string
  mode: SyncPushWriteMode
  responseStatus: number
  fallbackReason?: string | null
}) {
  console.log(JSON.stringify({
    message: "sync push route handled",
    requestId: params.requestId,
    route: params.route,
    mode: params.mode,
    responseStatus: params.responseStatus,
    fallbackReason: params.fallbackReason ?? null,
  }))
}

function taggedPlatformError(
  ctx: AstraRequestContext,
  params: {
    status: number
    code: string
    message: string
    route: string
    mode: SyncPushWriteMode
    fallbackReason?: string | null
  },
): Response {
  return tagSyncPushResponse(
    errorResponse(params.status, params.code, params.message, ctx.requestId),
    ctx,
    {
      route: params.route,
      mode: params.mode,
      fallbackReason: params.fallbackReason,
    },
  )
}

function buildCursorMap(
  rows: Record<(typeof SHADOW_SYNC_COLLECTIONS)[number], ShadowSyncCollectionRow>,
) {
  return {
    config: rows.config.lastIssuedCursor,
    vocabulary: rows.vocabulary.lastIssuedCursor,
    review_schedule: rows.review_schedule.lastIssuedCursor,
    reading_history: rows.reading_history.lastIssuedCursor,
    study_progress: rows.study_progress.lastIssuedCursor,
  }
}

function normalizeSyncPush(push: AstraSyncPushResponse) {
  return {
    accepted: push.accepted.map((entry) => ({
      collection: entry.collection,
      clientMutationId: entry.clientMutationId,
      recordId: entry.recordId,
      operation: entry.operation,
      cursor: entry.cursor,
      deduped: entry.deduped,
    })),
    rejected: push.rejected.map((entry) => ({
      collection: entry.collection,
      clientMutationId: entry.clientMutationId,
      code: entry.code,
      message: entry.message,
    })),
    nextCursors: push.nextCursors,
  }
}

async function readSyncPushRequest(request: Request): Promise<{ mutations: SharedSyncMutationInput[] }> {
  const raw = (await request.text()).trim()
  const parsed = SyncPushRequestSchema.parse(raw ? JSON.parse(raw) : {})
  return {
    mutations: parsed.mutations as SharedSyncMutationInput[],
  }
}

async function readAuthoritativeSyncPushState(
  env: AstraPlatformEnv,
  ctx: AstraRequestContext,
  validated: ValidatedShadowSession,
): Promise<AuthoritativeSyncPushState> {
  const [shadowSession, currentDevice, collectionRows] = await Promise.all([
    getShadowSessionById(env.ASTRA_PLATFORM_DB, validated.shadowSession.sessionId),
    getShadowDevice(env.ASTRA_PLATFORM_DB, validated.shadowUser.id, validated.currentDevice.deviceId),
    listShadowSyncCollectionRowsForUser(env.ASTRA_PLATFORM_DB, validated.shadowUser.id),
  ])

  if (!shadowSession) {
    throw new ShadowSyncPushUnavailableError(
      "missing_shadow_session",
      `No D1 shadow session was found for ${validated.shadowSession.sessionId}.`,
    )
  }
  if (shadowSession.userId !== validated.shadowUser.id || shadowSession.deviceId !== validated.currentDevice.deviceId) {
    throw new ShadowSyncPushUnavailableError("shadow_session_mismatch", "The D1 shadow session does not match the validated Astra session.")
  }
  if (shadowSession.status !== "active" || shadowSession.revokedAt) {
    throw new ShadowSyncPushUnavailableError("shadow_session_inactive", "The D1 shadow session is not active.")
  }
  if (shadowSession.expiresAt && shadowSession.expiresAt <= new Date(ctx.nowEpochMs).toISOString()) {
    throw new ShadowSyncPushUnavailableError("shadow_session_expired", "The D1 shadow session has expired.")
  }
  if (!currentDevice) {
    throw new ShadowSyncPushUnavailableError(
      "missing_shadow_device",
      `No D1 shadow device was found for ${validated.currentDevice.deviceId}.`,
    )
  }
  if (currentDevice.status !== "active" || currentDevice.revokedAt) {
    throw new ShadowSyncPushUnavailableError("shadow_device_inactive", "The D1 shadow device is not active.")
  }

  const collectionMap = Object.fromEntries(
    collectionRows.map((row) => [row.collection, row]),
  ) as Partial<Record<(typeof SHADOW_SYNC_COLLECTIONS)[number], ShadowSyncCollectionRow>>

  if (!SHADOW_SYNC_COLLECTIONS.every((collection) => collectionMap[collection])) {
    throw new ShadowSyncPushUnavailableError("missing_shadow_sync_collections", "The D1 sync push shadow state is incomplete.")
  }

  const readingHistoryCollection = collectionMap.reading_history
  const studyProgressCollection = collectionMap.study_progress
  if (!readingHistoryCollection || !studyProgressCollection) {
    throw new ShadowSyncPushUnavailableError("missing_shadow_sync_collections", "The D1 sync push shadow state is incomplete.")
  }

  if (readingHistoryCollection.enabled !== validated.shadowUser.syncPreferences.reading_history
    || studyProgressCollection.enabled !== validated.shadowUser.syncPreferences.study_progress) {
    throw new ShadowSyncPushUnavailableError("shadow_sync_preferences_mismatch", "The D1 sync push shadow state does not match the user sync preferences.")
  }

  return {
    shadowUser: validated.shadowUser,
    shadowSession,
    currentDevice,
    collections: collectionMap as Record<(typeof SHADOW_SYNC_COLLECTIONS)[number], ShadowSyncCollectionRow>,
  }
}

async function applyAuthoritativeSyncPush(
  env: AstraPlatformEnv,
  ctx: AstraRequestContext,
  state: AuthoritativeSyncPushState,
  payload: { mutations: SharedSyncMutationInput[] },
  serverTime: string,
  rollbackState: SyncPushRollbackState,
): Promise<AstraSyncPushResponse> {
  const accepted: AstraSyncPushResponse["accepted"] = []
  const rejected: AstraSyncPushResponse["rejected"] = []
  let nextCursorOrder = await getShadowSyncMaxCursorOrder(env.ASTRA_PLATFORM_DB)

  for (const mutation of payload.mutations) {
    if (mutation.deviceId !== state.currentDevice.deviceId) {
      rejected.push({
        collection: mutation.collection,
        clientMutationId: mutation.clientMutationId,
        code: "DEVICE_MISMATCH",
        message: "Sync mutation deviceId must match the authenticated device.",
      })
      continue
    }

    if (mutation.schemaVersion !== 1) {
      rejected.push({
        collection: mutation.collection,
        clientMutationId: mutation.clientMutationId,
        code: "SCHEMA_VERSION_UNSUPPORTED",
        message: `Unsupported sync schemaVersion: ${mutation.schemaVersion}.`,
      })
      continue
    }

    const existing = await getShadowSyncMutationByClientMutationId(
      env.ASTRA_PLATFORM_DB,
      state.shadowUser.id,
      mutation.clientMutationId,
    )
    if (existing) {
      accepted.push({
        collection: existing.collection,
        clientMutationId: existing.clientMutationId,
        recordId: existing.recordId,
        operation: existing.operation,
        serverUpdatedAt: existing.serverUpdatedAt,
        cursor: existing.cursor,
        deduped: true,
      })
      continue
    }

    const validated = validateSyncMutationPayload(state.shadowUser.syncPreferences, mutation)
    if ("code" in validated) {
      rejected.push(validated)
      continue
    }

    nextCursorOrder += 1
    const stored = await appendShadowSyncMutation(env.ASTRA_PLATFORM_DB, {
      userId: state.shadowUser.id,
      collection: validated.collection,
      collectionEnabled: isSyncCollectionEnabled(state.shadowUser.syncPreferences, validated.collection),
      collectionDefaultEnabled: validated.collection === "config" || validated.collection === "vocabulary" || validated.collection === "review_schedule",
      schemaVersion: validated.schemaVersion,
      recordId: validated.recordId,
      operation: validated.operation,
      clientMutationId: validated.clientMutationId,
      deviceId: validated.deviceId,
      clientUpdatedAt: validated.clientUpdatedAt,
      serverUpdatedAt: serverTime,
      cursor: String(nextCursorOrder),
      payload: validated.payload ?? null,
      tombstoneRetainedUntil: validated.operation === "delete"
        ? new Date(Date.parse(serverTime) + (ctx.config.syncTombstoneRetentionDays * 24 * 60 * 60 * 1000)).toISOString()
        : null,
      shadowUpdatedAt: serverTime,
    })

    if (!stored.deduped) {
      rollbackState.insertedServerMutationIds.push(stored.row.serverMutationId)
      rollbackState.previousRecordStates.push({
        collection: stored.row.collection,
        recordId: stored.row.recordId,
        previous: stored.previousRecordState,
      })
    }

    accepted.push({
      collection: stored.row.collection,
      clientMutationId: stored.row.clientMutationId,
      recordId: stored.row.recordId,
      operation: stored.row.operation,
      serverUpdatedAt: stored.row.serverUpdatedAt,
      cursor: stored.row.cursor,
      deduped: stored.deduped,
    })
  }

  await touchShadowSession(env.ASTRA_PLATFORM_DB, {
    sessionId: state.shadowSession.sessionId,
    lastSeenAt: serverTime,
    lastVerifiedAt: serverTime,
    shadowUpdatedAt: serverTime,
  })
  await touchShadowDevice(env.ASTRA_PLATFORM_DB, {
    userId: state.shadowUser.id,
    deviceId: state.currentDevice.deviceId,
    lastSeenAt: serverTime,
    lastSyncAt: serverTime,
    shadowUpdatedAt: serverTime,
  })

  const collections = await listShadowSyncCollectionsForUser(env.ASTRA_PLATFORM_DB, state.shadowUser.id)
  return AstraSyncPushResponseSchema.parse({
    serverTime,
    accepted,
    rejected,
    nextCursors: buildCursorMap(collections),
  })
}

async function rollbackAuthoritativeSyncPush(
  env: AstraPlatformEnv,
  state: AuthoritativeSyncPushState,
  rollbackState: SyncPushRollbackState,
): Promise<void> {
  for (const serverMutationId of [...rollbackState.insertedServerMutationIds].reverse()) {
    await deleteShadowSyncMutationByServerMutationId(env.ASTRA_PLATFORM_DB, serverMutationId)
  }

  for (const recordState of [...rollbackState.previousRecordStates].reverse()) {
    if (recordState.previous) {
      await restoreShadowSyncRecordState(env.ASTRA_PLATFORM_DB, recordState.previous)
    } else {
      await deleteShadowSyncRecordState(env.ASTRA_PLATFORM_DB, {
        userId: state.shadowUser.id,
        collection: recordState.collection,
        recordId: recordState.recordId,
      })
    }
  }

  for (const collection of SHADOW_SYNC_COLLECTIONS) {
    await upsertShadowSyncCollection(env.ASTRA_PLATFORM_DB, state.collections[collection])
  }

  await upsertShadowSession(env.ASTRA_PLATFORM_DB, state.shadowSession)
  await upsertShadowDevice(env.ASTRA_PLATFORM_DB, state.currentDevice)
}

async function compareNativeResultToNode(params: {
  env: AstraPlatformEnv
  ctx: AstraRequestContext
  nativePush: AstraSyncPushResponse
  nodeResponse: Response
}) {
  try {
    const nodePush = AstraSyncPushResponseSchema.parse(await params.nodeResponse.json())
    const nativeValue = normalizeSyncPush(params.nativePush)
    const nodeValue = normalizeSyncPush(nodePush)

    if (JSON.stringify(nativeValue) !== JSON.stringify(nodeValue)) {
      console.log(JSON.stringify({
        message: "sync push native compare mismatch",
        requestId: params.ctx.requestId,
        nativeValue,
        nodeValue,
      }))
      recordPlatformParityEventLater({
        env: params.env,
        ctx: params.ctx,
        domain: "sync-push",
        outcome: "parity_mismatch",
        scope: "native_compare",
        metadata: {
          nativeAcceptedCount: params.nativePush.accepted.length,
          nodeAcceptedCount: nodePush.accepted.length,
          nativeRejectedCount: params.nativePush.rejected.length,
          nodeRejectedCount: nodePush.rejected.length,
        },
      })
    }
  } catch (error) {
    console.log(JSON.stringify({
      message: "sync push native compare failed",
      requestId: params.ctx.requestId,
      error: error instanceof Error ? error.message : String(error),
    }))
    recordPlatformParityEventLater({
      env: params.env,
      ctx: params.ctx,
      domain: "sync-push",
      outcome: "compare_failed",
      scope: "native_compare",
      metadata: {
        error: error instanceof Error ? error.message : String(error),
      },
    })
  }
}

async function proxySyncPush(
  request: Request,
  env: AstraPlatformEnv,
  ctx: AstraRequestContext,
  params: {
    route: string
    mode: SyncPushWriteMode
    fallbackReason?: string | null
  },
): Promise<Response> {
  const response = tagSyncPushResponse(
    await proxyToNodeRelay(request, env, ctx),
    ctx,
    params,
  )
  logSyncPushRouteEvent({
    requestId: ctx.requestId,
    route: params.route,
    mode: params.mode,
    responseStatus: response.status,
    fallbackReason: params.fallbackReason,
  })
  recordPlatformRouteEventLater({
    env,
    ctx,
    domain: "sync-push",
    route: params.route,
    mode: params.mode,
    responseStatus: response.status,
    fallbackReason: params.fallbackReason,
  })
  return response
}

async function mirrorSyncPushToNode(
  request: Request,
  ctx: AstraRequestContext,
): Promise<Response> {
  const upstreamResponse = await fetchNodeRelay(request, ctx)
  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: buildNodeRelayDownstreamHeaders(upstreamResponse, ctx.requestId),
  })
}

export async function handleSyncPush(
  request: Request,
  env: AstraPlatformEnv,
  ctx: AstraRequestContext,
): Promise<Response> {
  const mode = ctx.config.syncPushWriteMode

  if (mode === "proxy") {
    return proxySyncPush(request, env, ctx, {
      route: "proxy",
      mode,
    })
  }

  let validatedSession: ValidatedShadowSession
  try {
    validatedSession = await validateShadowSession(request.clone(), env, ctx, {
      requireDeviceHeader: true,
      requireAuthenticatedIdentity: true,
    })
  } catch (error) {
    if (error instanceof ShadowSessionAuthError) {
      const response = tagSyncPushResponse(
        errorResponse(error.status, error.code, error.message, ctx.requestId),
        ctx,
        {
          route: "native-auth-gate",
          mode,
        },
      )
      logSyncPushRouteEvent({
        requestId: ctx.requestId,
        route: "native-auth-gate",
        mode,
        responseStatus: response.status,
      })
      recordPlatformRouteEventLater({
        env,
        ctx,
        domain: "sync-push",
        route: "native-auth-gate",
        mode,
        responseStatus: response.status,
      })
      return response
    }

    if (error instanceof ShadowSessionUnavailableError) {
      return proxySyncPush(request, env, ctx, {
        route: "native-fallback-proxy",
        mode,
        fallbackReason: error.reason,
      })
    }

    return proxySyncPush(request, env, ctx, {
      route: "native-fallback-proxy",
      mode,
      fallbackReason: "shadow_read_failed",
    })
  }

  const payload = await readSyncPushRequest(request.clone())
  if (payload.mutations.length > ctx.config.syncMaxMutationsPerRequest) {
    const response = taggedPlatformError(ctx, {
      status: 400,
      code: "INVALID_SYNC_PAYLOAD",
      message: `Sync push exceeds maxMutationsPerRequest (${ctx.config.syncMaxMutationsPerRequest}).`,
      route: "native",
      mode,
    })
    logSyncPushRouteEvent({
      requestId: ctx.requestId,
      route: "native",
      mode,
      responseStatus: response.status,
    })
    recordPlatformRouteEventLater({
      env,
      ctx,
      domain: "sync-push",
      route: "native",
      mode,
      responseStatus: response.status,
    })
    return response
  }

  let state: AuthoritativeSyncPushState
  try {
    state = await readAuthoritativeSyncPushState(env, ctx, validatedSession)
  } catch (error) {
    if (error instanceof ShadowSyncPushUnavailableError) {
      return proxySyncPush(request, env, ctx, {
        route: "native-fallback-proxy",
        mode,
        fallbackReason: error.reason,
      })
    }

    console.log(JSON.stringify({
      message: "sync push native shadow state load failed",
      requestId: ctx.requestId,
      error: error instanceof Error ? error.message : String(error),
    }))

    return proxySyncPush(request, env, ctx, {
      route: "native-fallback-proxy",
      mode,
      fallbackReason: "shadow_read_failed",
    })
  }

  const serverTime = new Date(ctx.nowEpochMs).toISOString()
  const rollbackState: SyncPushRollbackState = {
    insertedServerMutationIds: [],
    previousRecordStates: [],
  }

  let nativePush: AstraSyncPushResponse
  try {
    nativePush = await applyAuthoritativeSyncPush(env, ctx, state, payload, serverTime, rollbackState)
  } catch (error) {
    try {
      await rollbackAuthoritativeSyncPush(env, state, rollbackState)
    } catch (rollbackError) {
      console.log(JSON.stringify({
        message: "sync push authoritative rollback failed",
        requestId: ctx.requestId,
        error: rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
      }))

      const response = taggedPlatformError(ctx, {
        status: 503,
        code: "UPSTREAM_UNAVAILABLE",
        message: "Authoritative sync push failed and could not be rolled back safely.",
        route: "native",
        mode,
        fallbackReason: "authoritative_rollback_failed",
      })
      logSyncPushRouteEvent({
        requestId: ctx.requestId,
        route: "native",
        mode,
        responseStatus: response.status,
        fallbackReason: "authoritative_rollback_failed",
      })
      recordPlatformRouteEventLater({
        env,
        ctx,
        domain: "sync-push",
        route: "native",
        mode,
        responseStatus: response.status,
        fallbackReason: "authoritative_rollback_failed",
      })
      return response
    }

    console.log(JSON.stringify({
      message: "sync push authoritative write failed",
      requestId: ctx.requestId,
      error: error instanceof Error ? error.message : String(error),
    }))

    return proxySyncPush(request, env, ctx, {
      route: "native-fallback-proxy",
      mode,
      fallbackReason: "authoritative_write_failed",
    })
  }

  let mirrorBackResponse: Response
  try {
    mirrorBackResponse = await mirrorSyncPushToNode(request.clone(), ctx)
  } catch (error) {
    console.log(JSON.stringify({
      message: "sync push mirror-back request failed",
      requestId: ctx.requestId,
      error: error instanceof Error ? error.message : String(error),
    }))

    const response = taggedPlatformError(ctx, {
      status: 503,
      code: "UPSTREAM_UNAVAILABLE",
      message: "The relay mirror-back did not complete after the authoritative sync push write. Retry or reconcile before rollback.",
      route: "native",
      mode,
      fallbackReason: "mirror_back_commit_unknown",
    })
    logSyncPushRouteEvent({
      requestId: ctx.requestId,
      route: "native",
      mode,
      responseStatus: response.status,
      fallbackReason: "mirror_back_commit_unknown",
    })
    recordPlatformRouteEventLater({
      env,
      ctx,
      domain: "sync-push",
      route: "native",
      mode,
      responseStatus: response.status,
      fallbackReason: "mirror_back_commit_unknown",
    })
    return response
  }

  if (!mirrorBackResponse.ok) {
    try {
      await rollbackAuthoritativeSyncPush(env, state, rollbackState)
    } catch (rollbackError) {
      console.log(JSON.stringify({
        message: "sync push mirror-back response rollback failed",
        requestId: ctx.requestId,
        error: rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
      }))

      const response = taggedPlatformError(ctx, {
        status: 503,
        code: "UPSTREAM_UNAVAILABLE",
        message: "The relay mirror-back rejected the authoritative sync push write.",
        route: "native",
        mode,
        fallbackReason: "mirror_back_rollback_failed",
      })
      logSyncPushRouteEvent({
        requestId: ctx.requestId,
        route: "native",
        mode,
        responseStatus: response.status,
        fallbackReason: "mirror_back_rollback_failed",
      })
      recordPlatformRouteEventLater({
        env,
        ctx,
        domain: "sync-push",
        route: "native",
        mode,
        responseStatus: response.status,
        fallbackReason: "mirror_back_rollback_failed",
      })
      return response
    }

    const taggedFallback = tagSyncPushResponse(mirrorBackResponse, ctx, {
      route: "native-fallback-proxy",
      mode,
      fallbackReason: "mirror_back_rejected",
    })
    logSyncPushRouteEvent({
      requestId: ctx.requestId,
      route: "native-fallback-proxy",
      mode,
      responseStatus: taggedFallback.status,
      fallbackReason: "mirror_back_rejected",
    })
    recordPlatformRouteEventLater({
      env,
      ctx,
      domain: "sync-push",
      route: "native-fallback-proxy",
      mode,
      responseStatus: taggedFallback.status,
      fallbackReason: "mirror_back_rejected",
    })
    return taggedFallback
  }

  ctx.execution.waitUntil(compareNativeResultToNode({
    env,
    ctx,
    nativePush,
    nodeResponse: mirrorBackResponse.clone(),
  }))

  const response = tagSyncPushResponse(mirrorBackResponse, ctx, {
    route: "native",
    mode,
  })
  logSyncPushRouteEvent({
    requestId: ctx.requestId,
    route: "native",
    mode,
    responseStatus: response.status,
  })
  recordPlatformRouteEventLater({
    env,
    ctx,
    domain: "sync-push",
    route: "native",
    mode,
    responseStatus: response.status,
  })
  return response
}
