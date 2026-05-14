import {
  AstraSyncRepairRequestSchema,
  AstraSyncRepairResponseSchema,
} from "../../../../types/auth"
import type { AstraSyncCollection } from "../../../../types/config"
import type { AstraRequestContext } from "../context"
import type { AstraPlatformEnv } from "../env"
import { errorResponse, jsonResponse, withResponseHeaders } from "../lib/http"
import {
  ShadowSessionAuthError,
  ShadowSessionUnavailableError,
  touchValidatedShadowSessionLater,
  validateShadowSession,
} from "../lib/session-auth"
import { recordPlatformRouteEventLater } from "../lib/platform-ops"
import {
  ensureShadowSyncRecordStateForCollection,
  listShadowSyncCollectionsForUser,
} from "../repositories/sync"
import { SHADOW_SYNC_COLLECTIONS } from "../types/shadow-state"

function tagSyncRepairResponse(
  response: Response,
  ctx: AstraRequestContext,
  route: string,
): Response {
  return withResponseHeaders(response, {
    "x-astra-request-id": ctx.requestId,
    "x-astra-platform-route": route,
    "x-astra-platform-mode": "native",
    "x-astra-platform-default-mode": "native",
    "x-astra-platform-domain": "sync-repair",
  })
}

function logSyncRepairRouteEvent(params: {
  requestId: string
  route: string
  responseStatus: number
}) {
  console.log(JSON.stringify({
    message: "sync repair route handled",
    requestId: params.requestId,
    route: params.route,
    responseStatus: params.responseStatus,
  }))
}

async function readRepairRequest(request: Request): Promise<{ collections: AstraSyncCollection[] }> {
  const raw = (await request.text()).trim()
  return AstraSyncRepairRequestSchema.parse(raw ? JSON.parse(raw) : {})
}

function recordSyncRepairRoute(
  env: AstraPlatformEnv,
  ctx: AstraRequestContext,
  route: string,
  responseStatus: number,
  metadata?: Record<string, unknown>,
) {
  recordPlatformRouteEventLater({
    env,
    ctx,
    domain: "sync-repair",
    route,
    mode: "native",
    responseStatus,
    metadata,
  })
}

export async function handleSyncRepair(
  request: Request,
  env: AstraPlatformEnv,
  ctx: AstraRequestContext,
): Promise<Response> {
  let validated
  try {
    validated = await validateShadowSession(request.clone(), env, ctx, {
      requireDeviceHeader: true,
      requireAuthenticatedIdentity: true,
    })
  } catch (error) {
    if (error instanceof ShadowSessionAuthError) {
      const response = tagSyncRepairResponse(
        errorResponse(error.status, error.code, error.message, ctx.requestId),
        ctx,
        "native-auth-gate",
      )
      logSyncRepairRouteEvent({ requestId: ctx.requestId, route: "native-auth-gate", responseStatus: response.status })
      recordSyncRepairRoute(env, ctx, "native-auth-gate", response.status)
      return response
    }

    const response = tagSyncRepairResponse(
      errorResponse(503, "UPSTREAM_UNAVAILABLE", error instanceof ShadowSessionUnavailableError
        ? error.message
        : "Worker-native sync repair prerequisites are unavailable.", ctx.requestId),
      ctx,
      "native-shadow-gate",
    )
    logSyncRepairRouteEvent({ requestId: ctx.requestId, route: "native-shadow-gate", responseStatus: response.status })
    recordSyncRepairRoute(env, ctx, "native-shadow-gate", response.status)
    return response
  }

  const payload = await readRepairRequest(request.clone())
  const serverTime = new Date(ctx.nowEpochMs).toISOString()
  const collections = await listShadowSyncCollectionsForUser(env.ASTRA_PLATFORM_DB, validated.shadowUser.id)

  const requestedCollections = new Set(payload.collections)
  const repairedCollections = await Promise.all(SHADOW_SYNC_COLLECTIONS.map(async (collection) => {
    const recordState = requestedCollections.has(collection)
      ? await ensureShadowSyncRecordStateForCollection(env.ASTRA_PLATFORM_DB, {
          userId: validated.shadowUser.id,
          collection,
          tombstoneRetentionDays: ctx.config.syncTombstoneRetentionDays,
        })
      : []
    const activeRecords = recordState
      .filter((row) => !row.isDeleted)
      .map((row) => ({
        recordId: row.recordId,
        payload: row.payload,
        lastClientMutationId: row.lastClientMutationId,
        lastDeviceId: row.lastDeviceId,
        lastServerUpdatedAt: row.lastServerUpdatedAt,
        cursor: row.lastCursor,
      }))

    return [collection, {
      enabled: collections[collection].enabled,
      defaultEnabled: collections[collection].defaultEnabled,
      latestCursor: collections[collection].lastIssuedCursor,
      compactionFloorCursor: collections[collection].compactionFloorCursor,
      records: activeRecords,
    }] as const
  }))

  touchValidatedShadowSessionLater(env, ctx, validated)

  const response = tagSyncRepairResponse(
    jsonResponse(AstraSyncRepairResponseSchema.parse({
      serverTime,
      collections: Object.fromEntries(repairedCollections),
    })),
    ctx,
    "native",
  )
  logSyncRepairRouteEvent({ requestId: ctx.requestId, route: "native", responseStatus: response.status })
  recordSyncRepairRoute(env, ctx, "native", response.status, {
    collectionCount: payload.collections.length,
  })
  return response
}
