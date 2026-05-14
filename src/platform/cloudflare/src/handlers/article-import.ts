import type { AstraRequestContext } from "../context"
import type { AstraPlatformEnv } from "../env"
import { errorResponse, jsonResponse, withResponseHeaders } from "../lib/http"
import {
  assertImportedArticleUrlIsEdgeSafe,
  importArticleNatively,
  NativeArticleImportError,
  parseArticleImportRequest,
} from "../lib/article-import-native"
import { recordPlatformRouteEventLater } from "../lib/platform-ops"
import { proxyToNodeRelay } from "../lib/proxy"
import {
  captureArticleImportArtifacts,
  mirrorArticleImportShadow,
  recordArticleImportOutcome,
} from "../lib/article-import-shadow"
import {
  assertArticleImportTargetAllowed,
  enforceArticleImportRateLimit,
  readArticleImportSurface,
  resolveArticleImportRoutingDecision,
} from "../lib/article-import-policy"

function tagArticleImportResponse(
  response: Response,
  ctx: AstraRequestContext,
  params: {
    route: string
    mode: string
    surface: string
    decisionReason: string
    fallbackReason?: string | null
  },
): Response {
  const headers: Record<string, string> = {
    "x-astra-request-id": ctx.requestId,
    "x-astra-platform-route": params.route,
    "x-astra-platform-mode": params.mode,
    "x-astra-platform-default-mode": ctx.config.articleImportMode,
    "x-astra-platform-surface": params.surface,
    "x-astra-platform-decision-reason": params.decisionReason,
  }

  if (params.fallbackReason) {
    headers["x-astra-platform-fallback-reason"] = params.fallbackReason
  }

  return withResponseHeaders(response, headers)
}

function logArticleImportRouteEvent(params: {
  requestId: string
  route: string
  mode: string
  surface: string
  decisionReason: string
  fallbackReason?: string | null
  targetUrl?: URL | null
  responseStatus: number
}) {
  console.log(JSON.stringify({
    message: "article import route handled",
    requestId: params.requestId,
    route: params.route,
    mode: params.mode,
    surface: params.surface,
    decisionReason: params.decisionReason,
    fallbackReason: params.fallbackReason ?? null,
    targetHostname: params.targetUrl?.hostname ?? null,
    responseStatus: params.responseStatus,
  }))
}

export async function handleArticleImport(
  request: Request,
  env: AstraPlatformEnv,
  ctx: AstraRequestContext,
): Promise<Response> {
  const initialSurface = readArticleImportSurface(request)
  let surface = initialSurface
  let effectiveMode = ctx.config.articleImportModeOverrides[initialSurface] ?? ctx.config.articleImportMode
  let decisionReason = ctx.config.articleImportModeOverrides[initialSurface] ? "surface_override" : "default_mode"
  let targetUrl: URL | null = null

  try {
    targetUrl = await parseArticleImportRequest(request.clone())
    assertImportedArticleUrlIsEdgeSafe(targetUrl)

    const routingDecision = resolveArticleImportRoutingDecision(ctx.config, request, targetUrl)
    surface = routingDecision.surface
    effectiveMode = routingDecision.effectiveMode
    decisionReason = routingDecision.decisionReason

    assertArticleImportTargetAllowed(ctx.config, targetUrl)

    await enforceArticleImportRateLimit({
      request,
      env,
      ctx,
      surface,
    })
  } catch (error) {
    if (error instanceof NativeArticleImportError) {
      const route = error.code === "RATE_LIMITED" ? "rate-limited" : "preflight-error"
      const response = tagArticleImportResponse(
        errorResponse(error.status, error.code, error.message, ctx.requestId),
        ctx,
        {
          route,
          mode: effectiveMode,
          surface,
          decisionReason,
        },
      )
      ctx.execution.waitUntil(recordArticleImportOutcome({
        request,
        proxyStatus: null,
        mode: effectiveMode,
        route,
        surface,
        targetUrl,
        decisionReason,
        status: "failed",
        errorCode: error.code,
        env,
        ctx,
      }))
      logArticleImportRouteEvent({
        requestId: ctx.requestId,
        route,
        mode: effectiveMode,
        surface,
        decisionReason,
        targetUrl,
        responseStatus: response.status,
      })
      recordPlatformRouteEventLater({
        env,
        ctx,
        domain: "article-import",
        route,
        mode: effectiveMode,
        responseStatus: response.status,
        metadata: {
          surface,
          decisionReason,
          targetHostname: targetUrl?.hostname ?? null,
        },
      })
      return response
    }
    throw error
  }

  try {
    if (effectiveMode === "native" && targetUrl) {
      const nativeRequest = request.clone()
      const nativeCaptureRequest = request.clone()
      const proxyFallbackRequest = request.clone()
      const proxyFallbackCaptureRequest = request.clone()

      try {
        const imported = await importArticleNatively(nativeRequest, {
          maxBytes: ctx.config.articleImportMaxNativeBytes,
        })
        const response = jsonResponse(imported.article)
        const captureResponse = response.clone()
        ctx.execution.waitUntil(
          captureArticleImportArtifacts({
            request: nativeCaptureRequest,
            response: captureResponse,
            proxyStatus: null,
            sourceHtml: imported.sourceHtml,
            mode: effectiveMode,
            route: "native",
            surface,
            targetUrl,
            decisionReason,
            env,
            ctx,
          }),
        )
        const taggedResponse = tagArticleImportResponse(response, ctx, {
          route: "native",
          mode: effectiveMode,
          surface,
          decisionReason,
        })
        logArticleImportRouteEvent({
          requestId: ctx.requestId,
          route: "native",
          mode: effectiveMode,
          surface,
          decisionReason,
          targetUrl,
          responseStatus: taggedResponse.status,
        })
        recordPlatformRouteEventLater({
          env,
          ctx,
          domain: "article-import",
          route: "native",
          mode: effectiveMode,
          responseStatus: taggedResponse.status,
          metadata: {
            surface,
            decisionReason,
            targetHostname: targetUrl?.hostname ?? null,
          },
        })
        return taggedResponse
      } catch (error) {
        if (error instanceof NativeArticleImportError && error.shouldProxyFallback) {
          const fallbackResponse = await proxyToNodeRelay(proxyFallbackRequest, env, ctx)
          const fallbackCaptureResponse = fallbackResponse.clone()
          ctx.execution.waitUntil(
            captureArticleImportArtifacts({
              request: proxyFallbackCaptureRequest,
              response: fallbackCaptureResponse,
              proxyStatus: fallbackResponse.status,
              mode: effectiveMode,
              route: "native-fallback-proxy",
              surface,
              targetUrl,
              decisionReason,
              fallbackReason: error.code,
              env,
              ctx,
            }),
          )
          const taggedResponse = tagArticleImportResponse(fallbackResponse, ctx, {
            route: "native-fallback-proxy",
            mode: effectiveMode,
            surface,
            decisionReason,
            fallbackReason: error.code,
          })
          logArticleImportRouteEvent({
            requestId: ctx.requestId,
            route: "native-fallback-proxy",
            mode: effectiveMode,
            surface,
            decisionReason,
            fallbackReason: error.code,
            targetUrl,
            responseStatus: taggedResponse.status,
          })
          recordPlatformRouteEventLater({
            env,
            ctx,
            domain: "article-import",
            route: "native-fallback-proxy",
            mode: effectiveMode,
            responseStatus: taggedResponse.status,
            fallbackReason: error.code,
            metadata: {
              surface,
              decisionReason,
              targetHostname: targetUrl?.hostname ?? null,
            },
          })
          return taggedResponse
        }

        if (error instanceof NativeArticleImportError) {
          ctx.execution.waitUntil(recordArticleImportOutcome({
            request,
            proxyStatus: null,
            mode: effectiveMode,
            route: "native-error",
            surface,
            targetUrl,
            decisionReason,
            status: "failed",
            errorCode: error.code,
            env,
            ctx,
          }))
          const response = tagArticleImportResponse(
            errorResponse(error.status, error.code, error.message, ctx.requestId),
            ctx,
            {
              route: "native-error",
              mode: effectiveMode,
              surface,
              decisionReason,
            },
          )
          logArticleImportRouteEvent({
            requestId: ctx.requestId,
            route: "native-error",
            mode: effectiveMode,
            surface,
            decisionReason,
            targetUrl,
            responseStatus: response.status,
          })
          recordPlatformRouteEventLater({
            env,
            ctx,
            domain: "article-import",
            route: "native-error",
            mode: effectiveMode,
            responseStatus: response.status,
            metadata: {
              surface,
              decisionReason,
              targetHostname: targetUrl?.hostname ?? null,
            },
          })
          return response
        }

        throw error
      }
    }

    if (effectiveMode === "shadow" && targetUrl) {
      const proxyRequest = request.clone()
      const shadowRequest = request.clone()
      const response = await proxyToNodeRelay(proxyRequest, env, ctx)
      const shadowResponse = response.clone()
      ctx.execution.waitUntil(
        mirrorArticleImportShadow({
          request: shadowRequest,
          response: shadowResponse,
          proxyStatus: response.status,
          mode: effectiveMode,
          route: "shadow-proxy",
          surface,
          targetUrl,
          decisionReason,
          env,
          ctx,
        }),
      )
      const taggedResponse = tagArticleImportResponse(response, ctx, {
        route: "shadow-proxy",
        mode: effectiveMode,
        surface,
        decisionReason,
      })
      logArticleImportRouteEvent({
        requestId: ctx.requestId,
        route: "shadow-proxy",
        mode: effectiveMode,
        surface,
        decisionReason,
        targetUrl,
        responseStatus: taggedResponse.status,
      })
      recordPlatformRouteEventLater({
        env,
        ctx,
        domain: "article-import",
        route: "shadow-proxy",
        mode: effectiveMode,
        responseStatus: taggedResponse.status,
        metadata: {
          surface,
          decisionReason,
          targetHostname: targetUrl?.hostname ?? null,
        },
      })
      return taggedResponse
    }

    const proxyRequest = request.clone()
    const outcomeRequest = request.clone()
    const response = await proxyToNodeRelay(proxyRequest, env, ctx)
    ctx.execution.waitUntil(recordArticleImportOutcome({
      request: outcomeRequest,
      proxyStatus: response.status,
      mode: effectiveMode,
      route: "proxy",
      surface,
      targetUrl,
      decisionReason,
      status: "completed",
      env,
      ctx,
    }))
    const taggedResponse = tagArticleImportResponse(response, ctx, {
      route: "proxy",
      mode: effectiveMode,
      surface,
      decisionReason,
    })
    logArticleImportRouteEvent({
      requestId: ctx.requestId,
      route: "proxy",
      mode: effectiveMode,
      surface,
      decisionReason,
      targetUrl,
      responseStatus: taggedResponse.status,
    })
    recordPlatformRouteEventLater({
      env,
      ctx,
      domain: "article-import",
      route: "proxy",
      mode: effectiveMode,
      responseStatus: taggedResponse.status,
      metadata: {
        surface,
        decisionReason,
        targetHostname: targetUrl?.hostname ?? null,
      },
    })
    return taggedResponse
  } catch (error) {
    ctx.execution.waitUntil(recordArticleImportOutcome({
      request,
      proxyStatus: null,
      mode: effectiveMode,
      route: "upstream-error",
      surface,
      targetUrl,
      decisionReason,
      status: "failed",
      errorCode: "UPSTREAM_UNAVAILABLE",
      env,
      ctx,
    }))
    const response = tagArticleImportResponse(errorResponse(
      502,
      "UPSTREAM_UNAVAILABLE",
      error instanceof Error ? error.message : "The upstream Astra relay is unavailable.",
      ctx.requestId,
    ), ctx, {
      route: "upstream-error",
      mode: effectiveMode,
      surface,
      decisionReason,
    })
    logArticleImportRouteEvent({
      requestId: ctx.requestId,
      route: "upstream-error",
      mode: effectiveMode,
      surface,
      decisionReason,
      targetUrl,
      responseStatus: response.status,
    })
    recordPlatformRouteEventLater({
      env,
      ctx,
      domain: "article-import",
      route: "upstream-error",
      mode: effectiveMode,
      responseStatus: response.status,
      metadata: {
        surface,
        decisionReason,
        targetHostname: targetUrl?.hostname ?? null,
      },
    })
    return response
  }
}
