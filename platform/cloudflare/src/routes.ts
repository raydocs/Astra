import type { AstraRequestContext } from "./context"
import type { AstraPlatformEnv } from "./env"
import { handleAccountSummary } from "./handlers/account-summary"
import {
  handleAccountExportCreate,
  handleAccountExportDownload,
  handleAccountExportStatus,
  handleCloudDataDeleteCreate,
  handleCloudDataDeleteStatus,
} from "./handlers/account-lifecycle"
import { handleAuthAnonymous } from "./handlers/auth-anonymous"
import { handleAuthSession } from "./handlers/auth-session"
import { handleArticleImportObservability } from "./handlers/article-import-observability"
import { handleArticleImportReplay } from "./handlers/article-import-replay"
import { handleArticleImport } from "./handlers/article-import"
import { handleDeviceList } from "./handlers/device-list"
import { handleDeviceRevoke } from "./handlers/device-revoke"
import { handlePlatformHealth } from "./handlers/health"
import { handlePlatformObservability } from "./handlers/platform-observability"
import { handleSyncBootstrap } from "./handlers/sync-bootstrap"
import { handleSyncCompaction } from "./handlers/sync-compaction"
import { handleSyncPull } from "./handlers/sync-pull"
import { handleSyncPush } from "./handlers/sync-push"
import { handleSyncRepair } from "./handlers/sync-repair"
import { errorResponse } from "./lib/http"
import { proxyToNodeRelay } from "./lib/proxy"

export async function routeRequest(
  request: Request,
  env: AstraPlatformEnv,
  ctx: AstraRequestContext,
): Promise<Response> {
  const url = new URL(request.url)

  if (request.method === "GET" && url.pathname === "/__platform/health") {
    return handlePlatformHealth(request, env, ctx)
  }

  if (request.method === "GET" && url.pathname === "/__platform/observability") {
    return handlePlatformObservability(request, env, ctx)
  }

  if (request.method === "GET" && url.pathname === "/__platform/article-import/observability") {
    return handleArticleImportObservability(request, env, ctx)
  }

  if (request.method === "POST" && url.pathname === "/__platform/article-import/replay") {
    return handleArticleImportReplay(request, env, ctx)
  }

  if (request.method === "POST" && url.pathname === "/v1/import/article") {
    return handleArticleImport(request, env, ctx)
  }

  if ((request.method === "GET" || request.method === "POST" || request.method === "DELETE") && url.pathname === "/v1/auth/session") {
    return handleAuthSession(request, env, ctx)
  }

  if (request.method === "POST" && url.pathname === "/v1/auth/anonymous") {
    return handleAuthAnonymous(request, env, ctx)
  }

  if (request.method === "GET" && url.pathname === "/v1/account/summary") {
    return handleAccountSummary(request, env, ctx)
  }

  if (request.method === "POST" && url.pathname === "/v1/account/export") {
    return handleAccountExportCreate(request, env, ctx)
  }

  const accountExportDownloadMatch = /^\/v1\/account\/export\/([^/]+)\/download$/.exec(url.pathname)
  if (request.method === "GET" && accountExportDownloadMatch) {
    return handleAccountExportDownload(request, env, ctx, decodeURIComponent(accountExportDownloadMatch[1]!))
  }

  const accountExportStatusMatch = /^\/v1\/account\/export\/([^/]+)$/.exec(url.pathname)
  if (request.method === "GET" && accountExportStatusMatch) {
    return handleAccountExportStatus(request, env, ctx, decodeURIComponent(accountExportStatusMatch[1]!))
  }

  if (request.method === "POST" && url.pathname === "/v1/account/cloud-data-delete") {
    return handleCloudDataDeleteCreate(request, env, ctx)
  }

  const cloudDataDeleteStatusMatch = /^\/v1\/account\/cloud-data-delete\/([^/]+)$/.exec(url.pathname)
  if (request.method === "GET" && cloudDataDeleteStatusMatch) {
    return handleCloudDataDeleteStatus(request, env, ctx, decodeURIComponent(cloudDataDeleteStatusMatch[1]!))
  }

  if (request.method === "GET" && url.pathname === "/v1/devices") {
    return handleDeviceList(request, env, ctx)
  }

  const deviceRevokeMatch = /^\/v1\/devices\/([^/]+)\/revoke$/.exec(url.pathname)
  if (request.method === "POST" && deviceRevokeMatch) {
    return handleDeviceRevoke(request, env, ctx, decodeURIComponent(deviceRevokeMatch[1]!))
  }

  if (request.method === "GET" && url.pathname === "/v1/sync/bootstrap") {
    return handleSyncBootstrap(request, env, ctx)
  }

  if (request.method === "POST" && url.pathname === "/v1/sync/push") {
    return handleSyncPush(request, env, ctx)
  }

  if (request.method === "POST" && url.pathname === "/v1/sync/pull") {
    return handleSyncPull(request, env, ctx)
  }

  if (request.method === "POST" && url.pathname === "/v1/sync/repair") {
    return handleSyncRepair(request, env, ctx)
  }

  if (request.method === "POST" && url.pathname === "/__platform/sync/compaction") {
    return handleSyncCompaction(request, env, ctx)
  }

  if (url.pathname.startsWith("/v1/")) {
    try {
      return await proxyToNodeRelay(request, env, ctx)
    } catch (error) {
      return errorResponse(
        502,
        "UPSTREAM_UNAVAILABLE",
        error instanceof Error ? error.message : "The upstream Astra relay is unavailable.",
        ctx.requestId,
      )
    }
  }

  return errorResponse(404, "NOT_FOUND", "Route not found.", ctx.requestId)
}
