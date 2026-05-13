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

const DEFAULT_MAX_NODE_RELAY_BODY_BYTES = 10 * 1024 * 1024

export async function fetchNodeRelay(
  request: Request,
  ctx: AstraRequestContext,
  options: {
    pathOverride?: string
    maxBodyBytes?: number
  } = {},
): Promise<Response> {
  const upstreamUrl = toNodeRelayUrl(request, ctx, options)
  // Materialize the body so the Worker does not forward a live stream to Node.
  // Callers that need to read the request later must pass a clone here.
  const hasBody = request.method !== "GET" && request.method !== "HEAD"
  if (hasBody && request.bodyUsed) {
    throw new TypeError(`Cannot proxy ${request.method} ${upstreamUrl.pathname} after its body has already been consumed; pass request.clone() before reading the body.`)
  }

  const maxBodyBytes = options.maxBodyBytes ?? DEFAULT_MAX_NODE_RELAY_BODY_BYTES

  if (hasBody && maxBodyBytes > 0) {
    const contentLengthHeader = request.headers.get("content-length")
    if (contentLengthHeader) {
      const contentLength = Number(contentLengthHeader)
      if (Number.isFinite(contentLength) && contentLength > maxBodyBytes) {
        throw new RangeError(
          `Cannot proxy ${request.method} ${upstreamUrl.pathname} because its request body is ${contentLength} bytes, which exceeds the ${maxBodyBytes} byte limit for Worker→Node relay requests.`,
        )
      }
    }
  }

  let body: ArrayBuffer | undefined
  if (hasBody) {
    try {
      body = await request.arrayBuffer()
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      throw new TypeError(`Cannot proxy ${request.method} ${upstreamUrl.pathname} because its request body could not be materialized: ${detail}`, { cause: error })
    }

    if (maxBodyBytes > 0 && body.byteLength > maxBodyBytes) {
      throw new RangeError(
        `Cannot proxy ${request.method} ${upstreamUrl.pathname} because its request body is ${body.byteLength} bytes, which exceeds the ${maxBodyBytes} byte limit for Worker→Node relay requests.`,
      )
    }
  }

  return fetch(upstreamUrl, {
    method: request.method,
    headers: buildNodeRelayHeaders(request, ctx.requestId),
    body,
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
