import {
  AstraAccountSummarySchema,
  type AstraAccountSummary,
  type AstraDeviceListEntry,
} from "../../../../src/types/auth"
import type { AstraSyncCollection } from "../../../../src/types/config"
import type { AstraRequestContext } from "../context"
import type { AccountSummaryReadMode, AstraPlatformEnv } from "../env"
import { errorResponse, jsonResponse, withResponseHeaders } from "../lib/http"
import {
  ShadowSessionAuthError,
  ShadowSessionUnavailableError,
  touchValidatedShadowSessionLater,
  type ValidatedShadowSession,
  validateShadowSession,
} from "../lib/session-auth"
import { recordPlatformParityEventLater, recordPlatformRouteEventLater } from "../lib/platform-ops"
import { fetchNodeRelay, proxyToNodeRelay } from "../lib/proxy"
import { listShadowDevicesForUser } from "../repositories/devices"
import { getShadowSessionById } from "../repositories/sessions"
import {
  ensureShadowSyncRecordStateForCollection,
  listShadowSyncCollectionRowsForUser,
  listShadowSyncMutationRowsForUser,
} from "../repositories/sync"
import {
  SHADOW_SYNC_COLLECTIONS,
  type ShadowSyncMutationRow,
  type ShadowSyncRecordStateRow,
} from "../types/shadow-state"

class ShadowAccountSummaryUnavailableError extends Error {
  constructor(readonly reason: string, message: string) {
    super(message)
    this.name = "ShadowAccountSummaryUnavailableError"
  }
}

function tagAccountSummaryResponse(
  response: Response,
  ctx: AstraRequestContext,
  params: {
    route: string
    mode: AccountSummaryReadMode
    fallbackReason?: string | null
  },
): Response {
  const headers: Record<string, string> = {
    "x-astra-request-id": ctx.requestId,
    "x-astra-platform-route": params.route,
    "x-astra-platform-mode": params.mode,
    "x-astra-platform-default-mode": ctx.config.accountSummaryReadMode,
    "x-astra-platform-domain": "account-summary",
  }

  if (params.fallbackReason) {
    headers["x-astra-platform-fallback-reason"] = params.fallbackReason
  }

  return withResponseHeaders(response, headers)
}

function logAccountSummaryRouteEvent(params: {
  requestId: string
  route: string
  mode: AccountSummaryReadMode
  responseStatus: number
  fallbackReason?: string | null
}) {
  console.log(JSON.stringify({
    message: "account summary route handled",
    requestId: params.requestId,
    route: params.route,
    mode: params.mode,
    responseStatus: params.responseStatus,
    fallbackReason: params.fallbackReason ?? null,
  }))
}

function normalizeDevices(entries: AstraDeviceListEntry[]) {
  return [...entries]
    .map((entry) => ({
      deviceId: entry.deviceId,
      label: entry.label,
      platform: entry.platform,
      browserFamily: entry.browserFamily,
      appKind: entry.appKind,
      appVersion: entry.appVersion,
      firstSeenAt: entry.firstSeenAt,
      lastSeenAt: entry.lastSeenAt,
      lastSyncAt: entry.lastSyncAt,
      status: entry.status,
      isCurrentDevice: entry.isCurrentDevice,
    }))
    .sort((a, b) => a.deviceId.localeCompare(b.deviceId))
}

function normalizeAccountSummary(summary: AstraAccountSummary) {
  return {
    account: {
      ...summary.account,
      providerEntitlements: [...summary.account.providerEntitlements].sort(),
    },
    usage: {
      quota: summary.usage.quota,
      usage: summary.usage.usage,
    },
    session: summary.session,
    devices: {
      activeCount: summary.devices.activeCount,
      revokedCount: summary.devices.revokedCount,
      current: summary.devices.current ? { ...summary.devices.current } : null,
      entries: normalizeDevices(summary.devices.entries),
    },
    sync: {
      maxMutationsPerRequest: summary.sync.maxMutationsPerRequest,
      collections: {
        config: summary.sync.collections.config,
        vocabulary: summary.sync.collections.vocabulary,
        reading_history: summary.sync.collections.reading_history,
        study_progress: summary.sync.collections.study_progress,
      },
    },
  }
}

function countActiveRecordStateRows(rows: ShadowSyncRecordStateRow[]): number {
  return rows.filter((row) => !row.isDeleted).length
}

function buildCollectionSummary(
  validated: ValidatedShadowSession,
  collectionRows: Awaited<ReturnType<typeof listShadowSyncCollectionRowsForUser>>,
  mutationRows: ShadowSyncMutationRow[],
  recordStateRows: ShadowSyncRecordStateRow[],
  collection: AstraSyncCollection,
) {
  const collectionRow = collectionRows.find((row) => row.collection === collection)
  if (!collectionRow) {
    throw new ShadowAccountSummaryUnavailableError(
      "missing_shadow_sync_collections",
      `No D1 sync collection row was found for ${collection}.`,
    )
  }

  const collectionMutations = mutationRows
    .filter((row) => row.collection === collection)
    .sort((a, b) => Number(a.cursor) - Number(b.cursor))

  if (
    (collection === "reading_history" && collectionRow.enabled !== validated.shadowUser.syncPreferences.reading_history)
    || (collection === "study_progress" && collectionRow.enabled !== validated.shadowUser.syncPreferences.study_progress)
  ) {
    throw new ShadowAccountSummaryUnavailableError(
      "shadow_sync_preferences_mismatch",
      `The D1 sync summary state does not match sync preferences for ${collection}.`,
    )
  }

  return {
    enabled: collectionRow.enabled,
    defaultEnabled: collectionRow.defaultEnabled,
    cursor: collectionRow.lastIssuedCursor,
    mutationCount: collectionMutations.length,
    activeCount: countActiveRecordStateRows(recordStateRows.filter((row) => row.collection === collection)),
    lastSyncAt: collectionRow.lastServerUpdatedAt,
    compactionFloorCursor: collectionRow.compactionFloorCursor,
  }
}

async function readShadowAccountSummary(
  env: AstraPlatformEnv,
  ctx: AstraRequestContext,
  validated: ValidatedShadowSession,
  params: {
    serverTime: string
    maxMutationsPerRequest: number
  },
): Promise<AstraAccountSummary> {
  const [shadowSession, deviceEntries, collectionRows, mutationRows, recordStateRows] = await Promise.all([
    getShadowSessionById(env.ASTRA_PLATFORM_DB, validated.shadowSession.sessionId),
    listShadowDevicesForUser(
      env.ASTRA_PLATFORM_DB,
      validated.shadowUser.id,
      validated.currentDevice.deviceId,
      validated.shadowSession.identityMode,
    ),
    listShadowSyncCollectionRowsForUser(env.ASTRA_PLATFORM_DB, validated.shadowUser.id),
    listShadowSyncMutationRowsForUser(env.ASTRA_PLATFORM_DB, validated.shadowUser.id),
    Promise.all(SHADOW_SYNC_COLLECTIONS.map((collection) => ensureShadowSyncRecordStateForCollection(
      env.ASTRA_PLATFORM_DB,
      {
        userId: validated.shadowUser.id,
        collection,
        tombstoneRetentionDays: ctx.config.syncTombstoneRetentionDays,
      },
    ))).then((rows) => rows.flat()),
  ])

  if (!validated.shadowUserUsage) {
    throw new ShadowAccountSummaryUnavailableError(
      "missing_shadow_user_usage",
      `No D1 shadow usage snapshot was found for ${validated.shadowUser.id}.`,
    )
  }
  if (!shadowSession) {
    throw new ShadowAccountSummaryUnavailableError(
      "missing_shadow_session",
      `No D1 shadow session was found for ${validated.shadowSession.sessionId}.`,
    )
  }
  if (shadowSession.userId !== validated.shadowUser.id || shadowSession.deviceId !== validated.currentDevice.deviceId) {
    throw new ShadowAccountSummaryUnavailableError(
      "shadow_session_mismatch",
      "The D1 shadow session does not match the validated Astra session.",
    )
  }
  if (shadowSession.status !== "active" || shadowSession.revokedAt) {
    throw new ShadowAccountSummaryUnavailableError("shadow_session_inactive", "The D1 shadow session is not active.")
  }
  if (shadowSession.expiresAt && shadowSession.expiresAt <= new Date(ctx.nowEpochMs).toISOString()) {
    throw new ShadowAccountSummaryUnavailableError("shadow_session_expired", "The D1 shadow session has expired.")
  }

  const collectionSet = new Set(collectionRows.map((row) => row.collection))
  if (!SHADOW_SYNC_COLLECTIONS.every((collection) => collectionSet.has(collection))) {
    throw new ShadowAccountSummaryUnavailableError(
      "missing_shadow_sync_collections",
      "The D1 account summary shadow state is incomplete.",
    )
  }

  const currentDevice = deviceEntries.find((entry) => entry.isCurrentDevice)
  if (!currentDevice) {
    throw new ShadowAccountSummaryUnavailableError(
      "missing_current_device_in_list",
      "The D1 account summary device state did not include the current device.",
    )
  }

  return AstraAccountSummarySchema.parse({
    serverTime: params.serverTime,
    account: {
      id: validated.shadowUser.id,
      relayBaseURL: validated.claims.relayBaseURL,
      email: validated.shadowUser.email,
      billingEmail: validated.shadowUser.billingEmail,
      createdAt: validated.shadowUser.createdAt,
      plan: validated.shadowUser.plan,
      subscriptionStatus: validated.shadowUser.subscriptionStatus,
      providerEntitlements: validated.shadowUser.providerEntitlements,
    },
    usage: {
      generatedAt: params.serverTime,
      quota: {
        dailyRequestsLimit: validated.shadowUserUsage.dailyRequestsLimit,
        dailyCharactersLimit: validated.shadowUserUsage.dailyCharactersLimit,
        requestsPerMinuteLimit: validated.shadowUserUsage.requestsPerMinuteLimit,
        remainingDailyRequests: Math.max(0, validated.shadowUserUsage.dailyRequestsLimit - validated.shadowUserUsage.requestsToday),
        remainingDailyCharacters: Math.max(0, validated.shadowUserUsage.dailyCharactersLimit - validated.shadowUserUsage.charactersToday),
      },
      usage: {
        totalRequests: validated.shadowUserUsage.totalRequests,
        totalCharacters: validated.shadowUserUsage.totalCharacters,
        dailyRequestsUsed: validated.shadowUserUsage.requestsToday,
        dailyCharactersUsed: validated.shadowUserUsage.charactersToday,
        lastRequestAt: validated.shadowUserUsage.lastRequestAt,
        recentEvents: validated.shadowUserUsage.recentEvents,
      },
    },
    session: {
      sessionId: shadowSession.sessionId,
      deviceId: shadowSession.deviceId,
      issuedAt: shadowSession.issuedAt,
      expiresAt: shadowSession.expiresAt,
      identityMode: shadowSession.identityMode,
      status: "active",
    },
    devices: {
      activeCount: deviceEntries.filter((entry) => entry.status === "active").length,
      revokedCount: deviceEntries.filter((entry) => entry.status === "revoked").length,
      current: currentDevice,
      entries: deviceEntries,
    },
    sync: {
      maxMutationsPerRequest: params.maxMutationsPerRequest,
      collections: {
        config: buildCollectionSummary(validated, collectionRows, mutationRows, recordStateRows, "config"),
        vocabulary: buildCollectionSummary(validated, collectionRows, mutationRows, recordStateRows, "vocabulary"),
        reading_history: buildCollectionSummary(validated, collectionRows, mutationRows, recordStateRows, "reading_history"),
        study_progress: buildCollectionSummary(validated, collectionRows, mutationRows, recordStateRows, "study_progress"),
      },
    },
  })
}

async function compareShadowReadToNode(params: {
  request: Request
  env: AstraPlatformEnv
  ctx: AstraRequestContext
  nodeSummary: AstraAccountSummary
}) {
  try {
    const validated = await validateShadowSession(params.request, params.env, params.ctx, {
      requireDeviceHeader: true,
      requireUsage: true,
    })
    const shadowSummary = await readShadowAccountSummary(params.env, params.ctx, validated, {
      serverTime: params.nodeSummary.serverTime,
      maxMutationsPerRequest: params.nodeSummary.sync.maxMutationsPerRequest,
    })
    const nodeValue = normalizeAccountSummary(params.nodeSummary)
    const shadowValue = normalizeAccountSummary(shadowSummary)

    if (JSON.stringify(nodeValue) !== JSON.stringify(shadowValue)) {
      console.log(JSON.stringify({
        message: "account summary shadow compare mismatch",
        requestId: params.ctx.requestId,
        nodeValue,
        shadowValue,
      }))
      recordPlatformParityEventLater({
        env: params.env,
        ctx: params.ctx,
        domain: "account-summary",
        outcome: "parity_mismatch",
        scope: "shadow_compare",
        metadata: {
          nodeDeviceCount: params.nodeSummary.devices.entries.length,
          shadowDeviceCount: shadowSummary.devices.entries.length,
        },
      })
    }
  } catch (error) {
    console.log(JSON.stringify({
      message: "account summary shadow compare failed",
      requestId: params.ctx.requestId,
      error: error instanceof Error ? error.message : String(error),
    }))
    recordPlatformParityEventLater({
      env: params.env,
      ctx: params.ctx,
      domain: "account-summary",
      outcome: "compare_failed",
      scope: "shadow_compare",
      metadata: {
        error: error instanceof Error ? error.message : String(error),
      },
    })
  }
}

async function compareNativeReadToNode(params: {
  request: Request
  env: AstraPlatformEnv
  ctx: AstraRequestContext
  nativeSummary: AstraAccountSummary
}) {
  try {
    const upstreamResponse = await fetchNodeRelay(params.request, params.ctx)
    if (!upstreamResponse.ok) {
      console.log(JSON.stringify({
        message: "account summary native compare skipped",
        requestId: params.ctx.requestId,
        reason: "authoritative_request_failed",
        responseStatus: upstreamResponse.status,
      }))
      return
    }

    const nodeSummary = AstraAccountSummarySchema.parse(await upstreamResponse.json())
    const nativeValue = normalizeAccountSummary(params.nativeSummary)
    const nodeValue = normalizeAccountSummary(nodeSummary)

    if (JSON.stringify(nativeValue) !== JSON.stringify(nodeValue)) {
      console.log(JSON.stringify({
        message: "account summary native compare mismatch",
        requestId: params.ctx.requestId,
        nativeValue,
        nodeValue,
      }))
      recordPlatformParityEventLater({
        env: params.env,
        ctx: params.ctx,
        domain: "account-summary",
        outcome: "parity_mismatch",
        scope: "native_compare",
        metadata: {
          nativeDeviceCount: params.nativeSummary.devices.entries.length,
          nodeDeviceCount: nodeSummary.devices.entries.length,
        },
      })
    }
  } catch (error) {
    console.log(JSON.stringify({
      message: "account summary native compare failed",
      requestId: params.ctx.requestId,
      error: error instanceof Error ? error.message : String(error),
    }))
    recordPlatformParityEventLater({
      env: params.env,
      ctx: params.ctx,
      domain: "account-summary",
      outcome: "compare_failed",
      scope: "native_compare",
      metadata: {
        error: error instanceof Error ? error.message : String(error),
      },
    })
  }
}

async function proxyAccountSummary(
  request: Request,
  env: AstraPlatformEnv,
  ctx: AstraRequestContext,
  params: {
    route: string
    mode: AccountSummaryReadMode
    fallbackReason?: string | null
  },
): Promise<Response> {
  const response = tagAccountSummaryResponse(
    await proxyToNodeRelay(request, env, ctx),
    ctx,
    params,
  )
  logAccountSummaryRouteEvent({
    requestId: ctx.requestId,
    route: params.route,
    mode: params.mode,
    responseStatus: response.status,
    fallbackReason: params.fallbackReason,
  })
  recordPlatformRouteEventLater({
    env,
    ctx,
    domain: "account-summary",
    route: params.route,
    mode: params.mode,
    responseStatus: response.status,
    fallbackReason: params.fallbackReason,
  })
  return response
}

export async function handleAccountSummary(
  request: Request,
  env: AstraPlatformEnv,
  ctx: AstraRequestContext,
): Promise<Response> {
  const mode = ctx.config.accountSummaryReadMode

  if (mode === "proxy") {
    return proxyAccountSummary(request, env, ctx, { route: "proxy", mode })
  }

  if (mode === "shadow") {
    const proxyResponse = await proxyToNodeRelay(request, env, ctx)
    const tagged = tagAccountSummaryResponse(proxyResponse, ctx, {
      route: "shadow-proxy",
      mode,
    })

    if (tagged.ok) {
      ctx.execution.waitUntil((async () => {
        try {
          const nodeSummary = AstraAccountSummarySchema.parse(await tagged.clone().json())
          await compareShadowReadToNode({
            request: request.clone(),
            env,
            ctx,
            nodeSummary,
          })
        } catch (error) {
          console.log(JSON.stringify({
            message: "account summary shadow response compare failed",
            requestId: ctx.requestId,
            error: error instanceof Error ? error.message : String(error),
          }))
        }
      })())
    }

    logAccountSummaryRouteEvent({
      requestId: ctx.requestId,
      route: "shadow-proxy",
      mode,
      responseStatus: tagged.status,
    })
    recordPlatformRouteEventLater({
      env,
      ctx,
      domain: "account-summary",
      route: "shadow-proxy",
      mode,
      responseStatus: tagged.status,
    })
    return tagged
  }

  let validatedSession: ValidatedShadowSession
  try {
    validatedSession = await validateShadowSession(request.clone(), env, ctx, {
      requireDeviceHeader: true,
      requireUsage: true,
    })
  } catch (error) {
    if (error instanceof ShadowSessionAuthError) {
      const response = tagAccountSummaryResponse(
        errorResponse(error.status, error.code, error.message, ctx.requestId),
        ctx,
        {
          route: "native-auth-gate",
          mode,
        },
      )
      logAccountSummaryRouteEvent({
        requestId: ctx.requestId,
        route: "native-auth-gate",
        mode,
        responseStatus: response.status,
      })
      recordPlatformRouteEventLater({
        env,
        ctx,
        domain: "account-summary",
        route: "native-auth-gate",
        mode,
        responseStatus: response.status,
      })
      return response
    }

    if (error instanceof ShadowSessionUnavailableError) {
      return proxyAccountSummary(request, env, ctx, {
        route: "native-fallback-proxy",
        mode,
        fallbackReason: error.reason,
      })
    }

    return proxyAccountSummary(request, env, ctx, {
      route: "native-fallback-proxy",
      mode,
      fallbackReason: "shadow_auth_failed",
    })
  }

  try {
    const summary = await readShadowAccountSummary(env, ctx, validatedSession, {
      serverTime: new Date(ctx.nowEpochMs).toISOString(),
      maxMutationsPerRequest: ctx.config.syncMaxMutationsPerRequest,
    })
    touchValidatedShadowSessionLater(env, ctx, validatedSession)

    const response = tagAccountSummaryResponse(jsonResponse(summary), ctx, {
      route: "native",
      mode,
    })

    ctx.execution.waitUntil(compareNativeReadToNode({
      request: request.clone(),
      env,
      ctx,
      nativeSummary: summary,
    }))

    logAccountSummaryRouteEvent({
      requestId: ctx.requestId,
      route: "native",
      mode,
      responseStatus: response.status,
    })
    recordPlatformRouteEventLater({
      env,
      ctx,
      domain: "account-summary",
      route: "native",
      mode,
      responseStatus: response.status,
    })
    return response
  } catch (error) {
    if (error instanceof ShadowAccountSummaryUnavailableError) {
      return proxyAccountSummary(request, env, ctx, {
        route: "native-fallback-proxy",
        mode,
        fallbackReason: error.reason,
      })
    }

    console.log(JSON.stringify({
      message: "account summary native read failed",
      requestId: ctx.requestId,
      error: error instanceof Error ? error.message : String(error),
    }))
    return proxyAccountSummary(request, env, ctx, {
      route: "native-fallback-proxy",
      mode,
      fallbackReason: "shadow_read_failed",
    })
  }
}
