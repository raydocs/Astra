import type { AstraRequestContext } from "../context"
import type { AstraPlatformEnv } from "../env"
import {
  recordPlatformEvent,
  type PlatformEventDomain,
} from "../repositories/platform-ops"

function logPlatformOpsWarning(params: {
  message: string
  requestId?: string | null
  domain: PlatformEventDomain
  error: unknown
}) {
  console.error(JSON.stringify({
    message: params.message,
    requestId: params.requestId ?? null,
    domain: params.domain,
    error: params.error instanceof Error ? params.error.message : String(params.error),
  }))
}

export function recordPlatformRouteEventLater(params: {
  env: AstraPlatformEnv
  ctx: AstraRequestContext
  domain: PlatformEventDomain
  route: string
  mode: string
  responseStatus: number
  fallbackReason?: string | null
  metadata?: Record<string, unknown> | null
}) {
  params.ctx.execution.waitUntil(
    recordPlatformEvent(params.env.ASTRA_PLATFORM_DB, {
      occurredAtEpochMs: params.ctx.nowEpochMs,
      environment: params.ctx.config.environment,
      domain: params.domain,
      eventKind: "route",
      route: params.route,
      mode: params.mode,
      fallbackReason: params.fallbackReason ?? null,
      responseStatus: params.responseStatus,
      requestId: params.ctx.requestId,
      scope: null,
      outcome: null,
      metadata: params.metadata ?? null,
    }).catch((error) => {
      logPlatformOpsWarning({
        message: "platform route event record failed",
        requestId: params.ctx.requestId,
        domain: params.domain,
        error,
      })
    }),
  )
}

export function recordPlatformParityEventLater(params: {
  env: AstraPlatformEnv
  ctx: AstraRequestContext
  domain: PlatformEventDomain
  outcome: "parity_mismatch" | "compare_failed"
  scope: string
  metadata?: Record<string, unknown> | null
}) {
  params.ctx.execution.waitUntil(
    recordPlatformEvent(params.env.ASTRA_PLATFORM_DB, {
      occurredAtEpochMs: params.ctx.nowEpochMs,
      environment: params.ctx.config.environment,
      domain: params.domain,
      eventKind: params.outcome,
      route: null,
      mode: null,
      fallbackReason: null,
      responseStatus: null,
      requestId: params.ctx.requestId,
      scope: params.scope,
      outcome: params.outcome,
      metadata: params.metadata ?? null,
    }).catch((error) => {
      logPlatformOpsWarning({
        message: "platform parity event record failed",
        requestId: params.ctx.requestId,
        domain: params.domain,
        error,
      })
    }),
  )
}
