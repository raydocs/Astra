import type { AstraRequestContext } from "../context"
import type { AstraPlatformEnv } from "../env"
import { toNodeRelayUrl } from "./proxy"

export class NodeMirrorConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "NodeMirrorConfigError"
  }
}

function readMirrorSecret(env: AstraPlatformEnv): string {
  const secret = env.ASTRA_PLATFORM_MIRROR_SECRET?.trim()
  if (!secret) {
    throw new NodeMirrorConfigError("ASTRA_PLATFORM_MIRROR_SECRET is required for Worker-native auth mirror-back.")
  }
  return secret
}

export async function postNodeMirrorJson(
  request: Request,
  env: AstraPlatformEnv,
  ctx: AstraRequestContext,
  params: {
    path: string
    body: unknown
  },
): Promise<Response> {
  const url = toNodeRelayUrl(request, ctx, { pathOverride: params.path })
  const secret = readMirrorSecret(env)

  return fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${secret}`,
      "content-type": "application/json",
      "x-astra-request-id": ctx.requestId,
    },
    body: JSON.stringify(params.body),
    redirect: "manual",
  })
}
