export function jsonResponse(payload: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers)
  headers.set("content-type", "application/json; charset=utf-8")
  return new Response(JSON.stringify(payload, null, 2), {
    ...init,
    headers,
  })
}

export function withResponseHeaders(response: Response, extraHeaders: HeadersInit): Response {
  const headers = new Headers(response.headers)
  new Headers(extraHeaders).forEach((value, key) => {
    headers.set(key, value)
  })

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

export function errorResponse(
  status: number,
  code: string,
  message: string,
  requestId?: string,
): Response {
  return jsonResponse({
    error: {
      code,
      message,
      ...(requestId ? { requestId } : {}),
    },
  }, { status })
}
