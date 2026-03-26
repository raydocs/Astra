import { z } from "zod"

import {
  AstraPlanSchema,
  AstraAccountSchema,
  AstraBillingLinkSchema,
  AstraUsageSnapshotSchema,
  type AstraBillingLink,
  type AstraPlan,
  type AstraAccount,
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

function buildPlanUrl(baseURL: string): string {
  return `${requireBaseURL(baseURL)}/account/plan`
}

function buildBillingCheckoutUrl(baseURL: string): string {
  return `${requireBaseURL(baseURL)}/billing/checkout`
}

function buildBillingPortalUrl(baseURL: string): string {
  return `${requireBaseURL(baseURL)}/billing/portal`
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const payload = await response.json() as { error?: { message?: string }; message?: string }
    return payload.error?.message || payload.message || `Astra account request failed with status ${response.status}.`
  } catch {
    return `Astra account request failed with status ${response.status}.`
  }
}

async function fetchAstraPayload<T>(url: string, sessionToken: string, schema: z.ZodType<T>): Promise<T> {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${sessionToken}`,
    },
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response))
  }

  return schema.parse(await response.json())
}

async function sendAstraPayload<T>(
  url: string,
  method: "PATCH" | "POST",
  sessionToken: string,
  body: unknown,
  schema: z.ZodType<T>,
): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response))
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
