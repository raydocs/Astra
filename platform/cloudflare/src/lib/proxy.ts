import type { AstraRequestContext } from "../context"
import type { AstraPlatformEnv } from "../env"

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "host",
])

export function toNodeRelayUrl(
  request: Request,
  ctx: AstraRequestContext,
  options: {
    pathOverride?: string
  } = {},
): URL {
  const incoming = new URL(request.url)
  const pathname = options.pathOverride ?? incoming.pathname
  return new URL(`${pathname}${incoming.search}`, ctx.config.nodeRelayOrigin)
}

export function buildNodeRelayHeaders(request: Request, requestId: string): Headers {
  const headers = new Headers()
  request.headers.forEach((value, key) => {
    if (HOP_BY_HOP_HEADERS.has(key.toLowerCase())) return
    headers.set(key, value)
  })
  headers.set("x-astra-request-id", requestId)
  return headers
}

export function buildNodeRelayDownstreamHeaders(response: Response, requestId: string): Headers {
  const headers = new Headers()
  response.headers.forEach((value, key) => {
    if (HOP_BY_HOP_HEADERS.has(key.toLowerCase())) return
    headers.set(key, value)
  })
  headers.set("x-astra-request-id", requestId)
  return headers
}

export async function fetchNodeRelay(
  request: Request,
  ctx: AstraRequestContext,
  options: {
    pathOverride?: string
  } = {},
): Promise<Response> {
  const upstreamUrl = toNodeRelayUrl(request, ctx, options)
  return fetch(upstreamUrl, {
    method: request.method,
    headers: buildNodeRelayHeaders(request, ctx.requestId),
    body: request.body,
    redirect: "manual",
  })
}

export async function proxyToNodeRelay(
  request: Request,
  _env: AstraPlatformEnv,
  ctx: AstraRequestContext,
): Promise<Response> {
  const upstreamResponse = await fetchNodeRelay(request, ctx)

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: buildNodeRelayDownstreamHeaders(upstreamResponse, ctx.requestId),
  })
}
