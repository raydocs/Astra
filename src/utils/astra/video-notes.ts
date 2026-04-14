import { z } from "zod"

import {
  VideoNoteCreateRequestSchema,
  VideoNoteCreateResponseSchema,
  VideoNoteStatusResponseSchema,
  type VideoNoteCreateRequest,
  type VideoNoteCreateResponse,
  type VideoNoteStatusResponse,
} from "@/types/video-notes"

function requireBaseURL(baseURL: string): string {
  const trimmed = baseURL.trim()
  if (!trimmed) {
    throw new Error("Astra API base URL is required.")
  }
  return trimmed.replace(/\/+$/, "")
}

function buildVideoNoteJobsUrl(baseURL: string): string {
  return `${requireBaseURL(baseURL)}/video-notes/jobs`
}

function buildVideoNoteJobUrl(baseURL: string, jobId: string): string {
  return `${buildVideoNoteJobsUrl(baseURL)}/${encodeURIComponent(jobId)}`
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

export class AstraVideoNoteApiError extends Error {
  status: number
  code: string | null
  details: unknown

  constructor(params: { message: string; status: number; code?: string | null; details?: unknown }) {
    super(params.message)
    this.name = "AstraVideoNoteApiError"
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
      message: payload.error?.message || payload.message || `Astra video-note request failed with status ${response.status}.`,
      code: payload.error?.code ?? null,
      details: payload.error?.details ?? null,
    }
  } catch {
    return {
      message: `Astra video-note request failed with status ${response.status}.`,
      code: null,
      details: null,
    }
  }
}

async function parseJsonWithSchema<T>(response: Response, schema: z.ZodType<T>): Promise<T> {
  return schema.parse(await response.json())
}

export async function createAstraVideoNoteJob(params: {
  baseURL: string
  sessionToken: string
  request: VideoNoteCreateRequest
  deviceId?: string
}): Promise<VideoNoteCreateResponse> {
  const response = await fetch(buildVideoNoteJobsUrl(params.baseURL), {
    method: "POST",
    headers: buildAuthHeaders(params.sessionToken, {
      deviceId: params.deviceId,
      contentType: "application/json",
    }),
    body: JSON.stringify(VideoNoteCreateRequestSchema.parse(params.request)),
  })

  if (!response.ok) {
    const payload = await readErrorPayload(response)
    throw new AstraVideoNoteApiError({
      message: payload.message,
      status: response.status,
      code: payload.code,
      details: payload.details,
    })
  }

  return parseJsonWithSchema(response, VideoNoteCreateResponseSchema)
}

export async function fetchAstraVideoNoteJob(params: {
  baseURL: string
  sessionToken: string
  jobId: string
  deviceId?: string
}): Promise<VideoNoteStatusResponse> {
  const response = await fetch(buildVideoNoteJobUrl(params.baseURL, params.jobId), {
    method: "GET",
    headers: buildAuthHeaders(params.sessionToken, { deviceId: params.deviceId }),
  })

  if (!response.ok) {
    const payload = await readErrorPayload(response)
    throw new AstraVideoNoteApiError({
      message: payload.message,
      status: response.status,
      code: payload.code,
      details: payload.details,
    })
  }

  return parseJsonWithSchema(response, VideoNoteStatusResponseSchema)
}
