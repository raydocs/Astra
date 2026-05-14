import { z } from "zod"

import {
  AstraPlanSchema,
  AstraAccountExportJobSchema,
  AstraAccountExportRequestSchema,
  AstraAccountSchema,
  AstraAccountSummarySchema,
  AstraBillingLinkSchema,
  AstraCloudDataDeleteJobSchema,
  AstraCloudDataDeleteRequestSchema,
  AstraDevicesResponseSchema,
  AstraSyncBootstrapSchema,
  AstraSyncMutationInputSchema,
  AstraSyncPullResponseSchema,
  AstraSyncPushResponseSchema,
  AstraSyncRepairRequestSchema,
  AstraSyncRepairResponseSchema,
  AstraUsageSnapshotSchema,
  type AstraAccount,
  type AstraAccountExportJob,
  type AstraAccountExportRequest,
  type AstraAccountSummary,
  type AstraBillingLink,
  type AstraCloudDataDeleteJob,
  type AstraCloudDataDeleteRequest,
  type AstraDeviceListEntry,
  type AstraPlan,
  type AstraSyncBootstrap,
  type AstraSyncMutationInput,
  type AstraSyncPullResponse,
  type AstraSyncPushResponse,
  type AstraSyncRepairRequest,
  type AstraSyncRepairResponse,
  type AstraUsageSnapshot,
} from "@/types/auth"

function requireBaseURL(baseURL: string): string {
  const trimmed = baseURL.trim()
  if (!trimmed) {
    throw new Error("Astra API base URL is required.")
  }
  return trimmed.replace(/\/+$/, "")
}

function buildAccountUrl(baseURL: string): string {
  return `${requireBaseURL(baseURL)}/account`
}

function buildUsageUrl(baseURL: string): string {
  return `${requireBaseURL(baseURL)}/account/usage`
}

function buildAccountSummaryUrl(baseURL: string): string {
  return `${requireBaseURL(baseURL)}/account/summary`
}

function buildPlanUrl(baseURL: string): string {
  return `${requireBaseURL(baseURL)}/account/plan`
}

function buildAccountExportUrl(baseURL: string): string {
  return `${requireBaseURL(baseURL)}/account/export`
}

function buildAccountExportStatusUrl(baseURL: string, jobId: string): string {
  return `${buildAccountExportUrl(baseURL)}/${encodeURIComponent(jobId)}`
}

function buildAccountExportDownloadUrl(baseURL: string, jobId: string): string {
  return `${buildAccountExportStatusUrl(baseURL, jobId)}/download`
}

function buildCloudDataDeleteUrl(baseURL: string): string {
  return `${requireBaseURL(baseURL)}/account/cloud-data-delete`
}

function buildCloudDataDeleteStatusUrl(baseURL: string, jobId: string): string {
  return `${buildCloudDataDeleteUrl(baseURL)}/${encodeURIComponent(jobId)}`
}

function buildBillingCheckoutUrl(baseURL: string): string {
  return `${requireBaseURL(baseURL)}/billing/checkout`
}

function buildBillingPortalUrl(baseURL: string): string {
  return `${requireBaseURL(baseURL)}/billing/portal`
}

function buildDevicesUrl(baseURL: string): string {
  return `${requireBaseURL(baseURL)}/devices`
}

function buildDeviceRevokeUrl(baseURL: string, targetDeviceId: string): string {
  return `${buildDevicesUrl(baseURL)}/${encodeURIComponent(targetDeviceId)}/revoke`
}

function buildSyncBootstrapUrl(baseURL: string): string {
  return `${requireBaseURL(baseURL)}/sync/bootstrap`
}

function buildSyncPushUrl(baseURL: string): string {
  return `${requireBaseURL(baseURL)}/sync/push`
}

function buildSyncPullUrl(baseURL: string): string {
  return `${requireBaseURL(baseURL)}/sync/pull`
}

function buildSyncRepairUrl(baseURL: string): string {
  return `${requireBaseURL(baseURL)}/sync/repair`
}

function buildSyncCollectionUrl(baseURL: string, collection: "reading_history" | "study_progress"): string {
  return `${requireBaseURL(baseURL)}/sync/collections/${encodeURIComponent(collection)}`
}

export class AstraApiError extends Error {
  status: number
  code: string | null
  details: unknown

  constructor(params: { message: string; status: number; code?: string | null; details?: unknown }) {
    super(params.message)
    this.name = "AstraApiError"
    this.status = params.status
    this.code = params.code ?? null
    this.details = params.details ?? null
  }
}

async function readErrorPayload(response: Response): Promise<{ message: string; code: string | null; details: unknown }> {
  try {
    const payload = await response.json() as {
      error?: { message?: string; code?: string; details?: unknown }
      message?: string
    }
    return {
      message: payload.error?.message || payload.message || `Astra account request failed with status ${response.status}.`,
      code: payload.error?.code ?? null,
      details: payload.error?.details ?? null,
    }
  } catch {
    return {
      message: `Astra account request failed with status ${response.status}.`,
      code: null,
      details: null,
    }
  }
}

async function readErrorMessage(response: Response): Promise<string> {
  const payload = await readErrorPayload(response)
  return payload.message
}

function buildAuthHeaders(
  sessionToken: string,
  options: {
    deviceId?: string
    contentType?: string
  } = {},
): Record<string, string> {
  return {
    Authorization: `Bearer ${sessionToken}`,
    ...(options.deviceId ? { "X-Astra-Device-Id": options.deviceId } : {}),
    ...(options.contentType ? { "Content-Type": options.contentType } : {}),
  }
}

async function fetchAstraPayload<T>(
  url: string,
  sessionToken: string,
  schema: z.ZodType<T>,
  options: {
    deviceId?: string
  } = {},
): Promise<T> {
  const response = await fetch(url, {
    method: "GET",
    headers: buildAuthHeaders(sessionToken, options),
  })

  if (!response.ok) {
    const payload = await readErrorPayload(response)
    throw new AstraApiError({
      message: payload.message,
      status: response.status,
      code: payload.code,
      details: payload.details,
    })
  }

  return schema.parse(await response.json())
}

async function sendAstraPayload<T>(
  url: string,
  method: "PATCH" | "POST",
  sessionToken: string,
  body: unknown,
  schema: z.ZodType<T>,
  options: {
    deviceId?: string
    idempotencyKey?: string
  } = {},
): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: {
      ...buildAuthHeaders(sessionToken, {
        ...options,
        contentType: "application/json",
      }),
      ...(options.idempotencyKey ? { "Idempotency-Key": options.idempotencyKey } : {}),
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const payload = await readErrorPayload(response)
    throw new AstraApiError({
      message: payload.message,
      status: response.status,
      code: payload.code,
      details: payload.details,
    })
  }

  return schema.parse(await response.json())
}

export async function fetchAstraAccount(params: {
  baseURL: string
  sessionToken: string
}): Promise<AstraAccount> {
  return fetchAstraPayload(buildAccountUrl(params.baseURL), params.sessionToken, AstraAccountSchema)
}

export async function fetchAstraUsageSnapshot(params: {
  baseURL: string
  sessionToken: string
}): Promise<AstraUsageSnapshot> {
  return fetchAstraPayload(buildUsageUrl(params.baseURL), params.sessionToken, AstraUsageSnapshotSchema)
}

export async function fetchAstraAccountSummary(params: {
  baseURL: string
  sessionToken: string
  deviceId: string
}): Promise<AstraAccountSummary> {
  return fetchAstraPayload(
    buildAccountSummaryUrl(params.baseURL),
    params.sessionToken,
    AstraAccountSummarySchema,
    { deviceId: params.deviceId },
  )
}

export async function createAstraAccountExportJob(params: {
  baseURL: string
  sessionToken: string
  deviceId: string
  request?: AstraAccountExportRequest
  idempotencyKey?: string
}): Promise<AstraAccountExportJob> {
  return sendAstraPayload(
    buildAccountExportUrl(params.baseURL),
    "POST",
    params.sessionToken,
    AstraAccountExportRequestSchema.parse(params.request ?? {}),
    AstraAccountExportJobSchema,
    {
      deviceId: params.deviceId,
      idempotencyKey: params.idempotencyKey,
    },
  )
}

export async function fetchAstraAccountExportJob(params: {
  baseURL: string
  sessionToken: string
  deviceId: string
  jobId: string
}): Promise<AstraAccountExportJob> {
  return fetchAstraPayload(
    buildAccountExportStatusUrl(params.baseURL, params.jobId),
    params.sessionToken,
    AstraAccountExportJobSchema,
    { deviceId: params.deviceId },
  )
}

export function buildAstraAccountExportDownloadUrl(params: {
  baseURL: string
  jobId: string
}): string {
  return buildAccountExportDownloadUrl(params.baseURL, params.jobId)
}

export async function createAstraCloudDataDeleteJob(params: {
  baseURL: string
  sessionToken: string
  deviceId: string
  request: AstraCloudDataDeleteRequest
  idempotencyKey?: string
}): Promise<AstraCloudDataDeleteJob> {
  return sendAstraPayload(
    buildCloudDataDeleteUrl(params.baseURL),
    "POST",
    params.sessionToken,
    AstraCloudDataDeleteRequestSchema.parse(params.request),
    AstraCloudDataDeleteJobSchema,
    {
      deviceId: params.deviceId,
      idempotencyKey: params.idempotencyKey,
    },
  )
}

export async function fetchAstraCloudDataDeleteJob(params: {
  baseURL: string
  sessionToken: string
  deviceId: string
  jobId: string
}): Promise<AstraCloudDataDeleteJob> {
  return fetchAstraPayload(
    buildCloudDataDeleteStatusUrl(params.baseURL, params.jobId),
    params.sessionToken,
    AstraCloudDataDeleteJobSchema,
    { deviceId: params.deviceId },
  )
}

export async function updateAstraPlan(params: {
  baseURL: string
  sessionToken: string
  plan: AstraPlan
}): Promise<AstraAccount> {
  return sendAstraPayload(
    buildPlanUrl(params.baseURL),
    "PATCH",
    params.sessionToken,
    { plan: AstraPlanSchema.parse(params.plan) },
    AstraAccountSchema,
  )
}

export async function createAstraCheckoutLink(params: {
  baseURL: string
  sessionToken: string
  plan: AstraPlan
}): Promise<AstraBillingLink> {
  return sendAstraPayload(
    buildBillingCheckoutUrl(params.baseURL),
    "POST",
    params.sessionToken,
    { plan: AstraPlanSchema.parse(params.plan) },
    AstraBillingLinkSchema,
  )
}

export async function createAstraPortalLink(params: {
  baseURL: string
  sessionToken: string
}): Promise<AstraBillingLink> {
  return sendAstraPayload(
    buildBillingPortalUrl(params.baseURL),
    "POST",
    params.sessionToken,
    {},
    AstraBillingLinkSchema,
  )
}

export async function fetchAstraDevices(params: {
  baseURL: string
  sessionToken: string
  deviceId: string
}): Promise<AstraDeviceListEntry[]> {
  const payload = await fetchAstraPayload(
    buildDevicesUrl(params.baseURL),
    params.sessionToken,
    AstraDevicesResponseSchema,
    { deviceId: params.deviceId },
  )

  return payload.devices
}

export async function revokeAstraDevice(params: {
  baseURL: string
  sessionToken: string
  deviceId: string
  targetDeviceId: string
}): Promise<AstraDeviceListEntry[]> {
  const payload = await sendAstraPayload(
    buildDeviceRevokeUrl(params.baseURL, params.targetDeviceId),
    "POST",
    params.sessionToken,
    {},
    AstraDevicesResponseSchema,
    { deviceId: params.deviceId },
  )

  return payload.devices
}

export async function fetchAstraSyncBootstrap(params: {
  baseURL: string
  sessionToken: string
  deviceId: string
}): Promise<AstraSyncBootstrap> {
  return fetchAstraPayload(
    buildSyncBootstrapUrl(params.baseURL),
    params.sessionToken,
    AstraSyncBootstrapSchema,
    { deviceId: params.deviceId },
  )
}

export async function pushAstraSyncMutations(params: {
  baseURL: string
  sessionToken: string
  deviceId: string
  mutations: AstraSyncMutationInput[]
}): Promise<AstraSyncPushResponse> {
  return sendAstraPayload(
    buildSyncPushUrl(params.baseURL),
    "POST",
    params.sessionToken,
    { mutations: params.mutations.map((mutation) => AstraSyncMutationInputSchema.parse(mutation)) },
    AstraSyncPushResponseSchema,
    { deviceId: params.deviceId },
  )
}

export async function pullAstraSyncDeltas(params: {
  baseURL: string
  sessionToken: string
  deviceId: string
  cursors: Partial<Record<"config" | "vocabulary" | "review_schedule" | "reading_history" | "study_progress", string | null>>
}): Promise<AstraSyncPullResponse> {
  return sendAstraPayload(
    buildSyncPullUrl(params.baseURL),
    "POST",
    params.sessionToken,
    { cursors: params.cursors },
    AstraSyncPullResponseSchema,
    { deviceId: params.deviceId },
  )
}

export async function repairAstraSyncState(params: {
  baseURL: string
  sessionToken: string
  deviceId: string
  request?: AstraSyncRepairRequest
}): Promise<AstraSyncRepairResponse> {
  return sendAstraPayload(
    buildSyncRepairUrl(params.baseURL),
    "POST",
    params.sessionToken,
    AstraSyncRepairRequestSchema.parse(params.request ?? {}),
    AstraSyncRepairResponseSchema,
    { deviceId: params.deviceId },
  )
}

export async function updateAstraSyncCollectionPreference(params: {
  baseURL: string
  sessionToken: string
  deviceId: string
  collection: "reading_history" | "study_progress"
  enabled: boolean
}): Promise<AstraSyncBootstrap> {
  return sendAstraPayload(
    buildSyncCollectionUrl(params.baseURL, params.collection),
    "PATCH",
    params.sessionToken,
    { enabled: params.enabled },
    AstraSyncBootstrapSchema,
    { deviceId: params.deviceId },
  )
}

function buildSyntheticPullFromRepair(repair: AstraSyncRepairResponse): AstraSyncPullResponse {
  const collections = repair.collections
  const buildRecords = (collection: keyof AstraSyncRepairResponse["collections"]) => (
    collections[collection].records.map((record) => ({
      ownerId: "repair",
      email: "repair@astra.invalid",
      serverMutationId: `repair:${collection}:${record.recordId}:${record.cursor}`,
      serverUpdatedAt: record.lastServerUpdatedAt,
      cursor: record.cursor,
      collection,
      schemaVersion: 1,
      recordId: record.recordId,
      operation: "upsert" as const,
      clientMutationId: record.lastClientMutationId,
      deviceId: record.lastDeviceId,
      clientUpdatedAt: record.lastServerUpdatedAt,
      payload: record.payload,
    }))
  )

  return AstraSyncPullResponseSchema.parse({
    serverTime: repair.serverTime,
    deltas: {
      config: buildRecords("config"),
      vocabulary: buildRecords("vocabulary"),
      review_schedule: buildRecords("review_schedule"),
      reading_history: buildRecords("reading_history"),
      study_progress: buildRecords("study_progress"),
    },
    nextCursors: {
      config: collections.config.latestCursor,
      vocabulary: collections.vocabulary.latestCursor,
      review_schedule: collections.review_schedule.latestCursor,
      reading_history: collections.reading_history.latestCursor,
      study_progress: collections.study_progress.latestCursor,
    },
  })
}

export async function fetchAstraContinuitySnapshot(params: {
  baseURL: string
  sessionToken: string
  deviceId: string
  includePull?: boolean
}): Promise<{
  devices: AstraDeviceListEntry[]
  bootstrap: AstraSyncBootstrap
  pull: AstraSyncPullResponse | null
}> {
  const [devices, bootstrap] = await Promise.all([
    fetchAstraDevices(params),
    fetchAstraSyncBootstrap(params),
  ])

  let pull: AstraSyncPullResponse | null = null
  if (params.includePull) {
    try {
      pull = await pullAstraSyncDeltas({
        ...params,
        cursors: {
          config: null,
          vocabulary: null,
          review_schedule: null,
          ...(bootstrap.collections.reading_history.enabled ? { reading_history: null } : {}),
          ...(bootstrap.collections.study_progress.enabled ? { study_progress: null } : {}),
        },
      })
    } catch (error) {
      if (!(error instanceof AstraApiError) || error.code !== "CURSOR_EXPIRED") {
        throw error
      }

      const repair = await repairAstraSyncState({
        ...params,
        request: {
          collections: [
            "config",
            "vocabulary",
            "review_schedule",
            ...(bootstrap.collections.reading_history.enabled ? ["reading_history" as const] : []),
            ...(bootstrap.collections.study_progress.enabled ? ["study_progress" as const] : []),
          ],
        },
      })
      pull = buildSyntheticPullFromRepair(repair)
    }
  }

  return {
    devices,
    bootstrap,
    pull,
  }
}
