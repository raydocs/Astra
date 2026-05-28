import { z } from "zod"

import {
  buildAstraCancellationReasonSubmission,
  type AstraCancellationReason,
  type AstraCancellationReasonSource,
} from "../cancellation-reasons"
import {
  KnownIssueMetadataSchema,
  SupportBundleIssueCategorySchema,
  SupportBundleSchema,
  SupportReportIdSchema,
  SupportReportStatusSchema,
  type KnownIssueMetadata,
  type SupportBundle,
} from "../support-bundle"

import { AstraApiError } from "./account"

const SupportReportSubmissionResponseSchema = z.object({
  report: z.object({
    reportId: SupportReportIdSchema,
    status: SupportReportStatusSchema,
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    submittedAt: z.string().datetime(),
    issueCategory: SupportBundleIssueCategorySchema.nullable(),
    defaultContentIncluded: z.literal(false),
    knownIssue: KnownIssueMetadataSchema.nullable().optional(),
  }).strict(),
}).strict()

const KnownIssuesResponseSchema = z.object({
  schema: z.literal("astra-known-issues.v1"),
  issues: z.array(KnownIssueMetadataSchema),
}).strict()

const CancellationReasonSubmissionResponseSchema = z.object({
  schema: z.literal("astra-cancellation-reason-submission.v1"),
  submission: z.object({
    id: z.string().trim().min(1),
    submittedAt: z.string().datetime(),
    reason: z.string().trim().min(1),
    plan: z.enum(["free", "trial", "pro", "unknown"]),
    source: z.enum(["billing_portal", "refund_request", "settings", "support", "unknown"]),
    subscriptionStatus: z.enum(["active", "past_due", "canceled", "unknown"]),
  }).strict(),
}).strict()

export type SupportReportSubmissionResponse = z.infer<typeof SupportReportSubmissionResponseSchema>
export type CancellationReasonSubmissionResponse = z.infer<typeof CancellationReasonSubmissionResponseSchema>

function requireBaseURL(baseURL: string): string {
  const trimmed = baseURL.trim()
  if (!trimmed) {
    throw new Error("Astra API base URL is required.")
  }
  return trimmed.replace(/\/+$/, "")
}

async function readErrorPayload(response: Response): Promise<{ message: string; code: string | null; details: unknown }> {
  try {
    const payload = await response.json() as {
      error?: { message?: string; code?: string; details?: unknown }
      message?: string
    }
    return {
      message: payload.error?.message || payload.message || `Astra support request failed with status ${response.status}.`,
      code: payload.error?.code ?? null,
      details: payload.error?.details ?? null,
    }
  } catch {
    return {
      message: `Astra support request failed with status ${response.status}.`,
      code: null,
      details: null,
    }
  }
}

export async function listAstraKnownIssues(params: {
  baseURL: string
}): Promise<KnownIssueMetadata[]> {
  const response = await fetch(`${requireBaseURL(params.baseURL)}/support/known-issues`)

  if (!response.ok) {
    const payload = await readErrorPayload(response)
    throw new AstraApiError({
      message: payload.message,
      status: response.status,
      code: payload.code,
      details: payload.details,
    })
  }

  return KnownIssuesResponseSchema.parse(await response.json()).issues
}

export async function submitAstraCancellationReason(params: {
  baseURL: string
  sessionToken: string
  deviceId: string
  reason: AstraCancellationReason
  source?: AstraCancellationReasonSource
}): Promise<CancellationReasonSubmissionResponse> {
  const submission = buildAstraCancellationReasonSubmission({
    reason: params.reason,
    source: params.source ?? "settings",
  })
  const response = await fetch(`${requireBaseURL(params.baseURL)}/account/cancellation-reasons`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.sessionToken}`,
      "X-Astra-Device-Id": params.deviceId,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ reason: submission.reason, source: submission.source }),
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

  return CancellationReasonSubmissionResponseSchema.parse(await response.json())
}

export async function submitAstraSupportReport(params: {
  baseURL: string
  sessionToken: string
  deviceId: string
  bundle: SupportBundle
}): Promise<SupportReportSubmissionResponse> {
  const bundle = SupportBundleSchema.parse(params.bundle)
  const response = await fetch(`${requireBaseURL(params.baseURL)}/support/reports`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.sessionToken}`,
      "X-Astra-Device-Id": params.deviceId,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ bundle }),
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

  return SupportReportSubmissionResponseSchema.parse(await response.json())
}
