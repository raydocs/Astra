import type { ProviderId, ServiceMode } from "../types/config"
import type { AstraTaskClass } from "../types/operating-model"
import { resolveManagedProviderForServiceMode, resolveManagedProviderModel } from "./providers"
import type { ProviderHealthStatus, ProviderHealthSummary, ResolvedRelayTranslateRequest } from "./types"

export type ProviderHealthMitigationAction = "none" | "force_fast_mode" | "reroute_healthy_provider"

export interface ProviderHealthMitigationRecommendation {
  action: ProviderHealthMitigationAction
  fallbackReason: "none" | "outage"
  healthStatus: ProviderHealthStatus | "unknown"
  provider: ProviderId
  model: string
  serviceMode: ServiceMode
  avoidProviders: ProviderId[]
}

function rankProviderHealth(status: ProviderHealthStatus | "unknown"): number {
  if (status === "incident") return 0
  if (status === "watch") return 1
  if (status === "healthy") return 2
  return 3
}

function getMatchingHealthStatus(params: {
  summary: ProviderHealthSummary
  provider: ProviderId
  model: string
  serviceMode: ServiceMode
  taskClass?: AstraTaskClass
}): ProviderHealthStatus | "unknown" {
  const exact = params.summary.buckets.find((bucket) =>
    bucket.provider === params.provider
    && bucket.model === params.model
    && bucket.serviceMode === params.serviceMode
    && (!params.taskClass || bucket.taskClass === params.taskClass),
  )
  if (exact) return exact.healthStatus

  const providerMatches = params.summary.buckets.filter((bucket) =>
    bucket.provider === params.provider
    && bucket.serviceMode === params.serviceMode
    && (!params.taskClass || bucket.taskClass === params.taskClass),
  )
  if (providerMatches.length === 0) return "unknown"

  return providerMatches
    .map((bucket) => bucket.healthStatus)
    .sort((left, right) => rankProviderHealth(left) - rankProviderHealth(right))[0] ?? "unknown"
}

function getUnhealthyProviders(params: {
  summary: ProviderHealthSummary
  taskClass?: AstraTaskClass
}): ProviderId[] {
  const providers = new Set<ProviderId>()
  for (const bucket of params.summary.buckets) {
    if (bucket.healthStatus === "healthy") continue
    if (params.taskClass && bucket.taskClass !== params.taskClass) continue
    providers.add(bucket.provider)
  }
  return [...providers].sort()
}

export function recommendProviderHealthMitigation(params: {
  summary: ProviderHealthSummary
  scheduledPayload: ResolvedRelayTranslateRequest
  entitlements: ProviderId[]
  taskClass?: AstraTaskClass
  requestedProvider?: ProviderId
}): ProviderHealthMitigationRecommendation {
  const healthStatus = getMatchingHealthStatus({
    summary: params.summary,
    provider: params.scheduledPayload.provider,
    model: params.scheduledPayload.model,
    serviceMode: params.scheduledPayload.serviceMode ?? "automatic",
    taskClass: params.taskClass,
  })

  if (healthStatus !== "watch" && healthStatus !== "incident") {
    return {
      action: "none",
      fallbackReason: "none",
      healthStatus,
      provider: params.scheduledPayload.provider,
      model: params.scheduledPayload.model,
      serviceMode: params.scheduledPayload.serviceMode ?? "automatic",
      avoidProviders: [],
    }
  }

  const targetServiceMode: ServiceMode = "fast"
  const unhealthyProviders = getUnhealthyProviders({ summary: params.summary, taskClass: params.taskClass })
  const avoidProviders = healthStatus === "incident" ? unhealthyProviders : []
  const canRerouteProvider = !params.requestedProvider && healthStatus === "incident"
  const provider = canRerouteProvider
    ? resolveManagedProviderForServiceMode({
        serviceMode: targetServiceMode,
        task: params.scheduledPayload.task,
        entitlements: params.entitlements,
        avoidProviders,
      })
    : params.scheduledPayload.provider
  const action: ProviderHealthMitigationAction = provider !== params.scheduledPayload.provider
    ? "reroute_healthy_provider"
    : "force_fast_mode"

  return {
    action,
    fallbackReason: "outage",
    healthStatus,
    provider,
    model: resolveManagedProviderModel({
      provider,
      requestedModel: provider === params.scheduledPayload.provider ? params.scheduledPayload.model : undefined,
      serviceMode: targetServiceMode,
    }),
    serviceMode: targetServiceMode,
    avoidProviders,
  }
}
