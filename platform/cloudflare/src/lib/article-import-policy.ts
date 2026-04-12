import type { AstraRequestContext } from "../context"
import type { AstraPlatformEnv, ArticleImportMode, PlatformConfig } from "../env"
import {
  ARTICLE_IMPORT_DEFAULT_RATE_LIMIT_WINDOW_SECONDS,
} from "../types/article-import"
import { NativeArticleImportError } from "./article-import-native"

export const ARTICLE_IMPORT_SURFACE_HEADER = "x-astra-import-surface"

function normalizeSurface(value: string | null): string {
  const normalized = value?.trim().toLowerCase() ?? ""
  return normalized || "unspecified"
}

function normalizeHostnameRule(rule: string): string {
  return rule.trim().toLowerCase().replace(/^\*\./, "")
}

export function readArticleImportSurface(request: Request): string {
  return normalizeSurface(request.headers.get(ARTICLE_IMPORT_SURFACE_HEADER))
}

export function matchesHostnameRule(hostname: string, rules: string[]): boolean {
  const normalizedHostname = hostname.trim().toLowerCase()
  return rules.some((rule) => {
    const normalizedRule = normalizeHostnameRule(rule)
    if (!normalizedRule) return false
    return normalizedHostname === normalizedRule || normalizedHostname.endsWith(`.${normalizedRule}`)
  })
}

export function assertArticleImportTargetAllowed(config: PlatformConfig, articleUrl: URL) {
  const hostname = articleUrl.hostname.trim().toLowerCase()
  if (matchesHostnameRule(hostname, config.articleImportBlockedHosts)) {
    throw new NativeArticleImportError(
      403,
      "TARGET_HOST_BLOCKED",
      "This hostname is blocked by the current Cloudflare article-import policy.",
    )
  }
}

export interface ArticleImportRoutingDecision {
  surface: string
  effectiveMode: ArticleImportMode
  decisionReason: string
}

export function resolveArticleImportRoutingDecision(
  config: PlatformConfig,
  request: Request,
  articleUrl: URL,
): ArticleImportRoutingDecision {
  const surface = readArticleImportSurface(request)

  if (matchesHostnameRule(articleUrl.hostname, config.articleImportForceProxyHosts)) {
    return {
      surface,
      effectiveMode: "proxy",
      decisionReason: "forced_proxy_host",
    }
  }

  const surfaceMode = config.articleImportModeOverrides[surface]
  const effectiveMode = surfaceMode ?? config.articleImportMode
  const decisionReason = surfaceMode ? "surface_override" : "default_mode"

  if (
    effectiveMode !== "proxy"
    && config.articleImportAllowedHosts.length > 0
    && !matchesHostnameRule(articleUrl.hostname, config.articleImportAllowedHosts)
  ) {
    return {
      surface,
      effectiveMode: "proxy",
      decisionReason: "allowlist_proxy_fallback",
    }
  }

  return {
    surface,
    effectiveMode,
    decisionReason,
  }
}

function readClientIp(request: Request): string | null {
  const cfIp = request.headers.get("cf-connecting-ip")?.trim()
  if (cfIp) return cfIp

  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  return forwardedFor || null
}

function buildRateLimitKey(params: {
  environment: string
  surface: string
  ip: string
  bucketEpochSeconds: number
}) {
  return [
    "article-import-rate-limit",
    params.environment,
    params.surface,
    params.ip,
    String(params.bucketEpochSeconds),
  ].join(":")
}

function logArticleImportPolicyWarning(params: {
  message: string
  requestId: string
  error: unknown
}) {
  console.error(JSON.stringify({
    message: params.message,
    requestId: params.requestId,
    error: params.error instanceof Error ? params.error.message : String(params.error),
  }))
}

export async function enforceArticleImportRateLimit(params: {
  request: Request
  env: AstraPlatformEnv
  ctx: AstraRequestContext
  surface: string
}): Promise<void> {
  const maxRequests = params.ctx.config.articleImportRateLimitMax
  if (!maxRequests || maxRequests <= 0) return

  const clientIp = readClientIp(params.request)
  if (!clientIp) return

  const windowSeconds = params.ctx.config.articleImportRateLimitWindowSeconds || ARTICLE_IMPORT_DEFAULT_RATE_LIMIT_WINDOW_SECONDS
  const nowEpochSeconds = Math.floor(params.ctx.nowEpochMs / 1000)
  const bucketEpochSeconds = Math.floor(nowEpochSeconds / windowSeconds) * windowSeconds
  const rateLimitKey = buildRateLimitKey({
    environment: params.ctx.config.environment,
    surface: params.surface,
    ip: clientIp,
    bucketEpochSeconds,
  })

  let currentCount = 0
  try {
    const rawCount = await params.env.ASTRA_IDEMPOTENCY_KV.get(rateLimitKey)
    currentCount = rawCount ? Number.parseInt(rawCount, 10) : 0
    if (!Number.isFinite(currentCount) || currentCount < 0) {
      currentCount = 0
    }

    if (currentCount >= maxRequests) {
      throw new NativeArticleImportError(
        429,
        "RATE_LIMITED",
        "The Cloudflare article-import rate limit has been exceeded for this window. Try again shortly.",
      )
    }

    await params.env.ASTRA_IDEMPOTENCY_KV.put(
      rateLimitKey,
      String(currentCount + 1),
      { expirationTtl: Math.max(windowSeconds * 2, ARTICLE_IMPORT_DEFAULT_RATE_LIMIT_WINDOW_SECONDS) },
    )
  } catch (error) {
    if (error instanceof NativeArticleImportError) {
      throw error
    }

    logArticleImportPolicyWarning({
      message: "article import rate limit lookup failed",
      requestId: params.ctx.requestId,
      error,
    })
  }
}
