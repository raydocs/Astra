import type { AstraWorkerExecutionContext } from "./bindings"
import type { AstraPlatformEnv } from "./env"
import { parsePlatformConfig, type PlatformConfig } from "./env"

export interface AstraRequestContext {
  requestId: string
  nowEpochMs: number
  config: PlatformConfig
  execution: AstraWorkerExecutionContext
}

function readRequestId(request: Request): string {
  const existing = request.headers.get("x-astra-request-id")?.trim()
  if (existing) return existing
  return crypto.randomUUID()
}

export function createRequestContext(
  request: Request,
  env: AstraPlatformEnv,
  execution: AstraWorkerExecutionContext,
): AstraRequestContext {
  return {
    requestId: readRequestId(request),
    nowEpochMs: Date.now(),
    config: parsePlatformConfig(env),
    execution,
  }
}
