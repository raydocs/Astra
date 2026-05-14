import { z } from "zod"

import type { AstraRequestContext } from "../context"
import type { AstraPlatformEnv } from "../env"
import { errorResponse, jsonResponse } from "../lib/http"
import {
  isArticleImportOperatorAuthorized,
  isArticleImportReplayEnabled,
  readArticleImportOperatorId,
  replayArticleImportJobs,
} from "../lib/article-import-operator"
import {
  ARTICLE_IMPORT_DEFAULT_REPLAY_BATCH_LIMIT,
  ARTICLE_IMPORT_MAX_REPLAY_BATCH_LIMIT,
} from "../types/article-import"

const ReplayRequestSchema = z.object({
  jobId: z.string().trim().min(1).optional(),
  jobIds: z.array(z.string().trim().min(1)).max(ARTICLE_IMPORT_MAX_REPLAY_BATCH_LIMIT).optional(),
  status: z.enum(["failed", "dead_lettered"]).optional(),
  limit: z.number().int().min(1).max(ARTICLE_IMPORT_MAX_REPLAY_BATCH_LIMIT).default(ARTICLE_IMPORT_DEFAULT_REPLAY_BATCH_LIMIT),
  reason: z.string().trim().max(200).optional().nullable(),
  dryRun: z.boolean().default(false),
}).superRefine((value, refinementContext) => {
  const jobIds = value.jobIds?.filter(Boolean) ?? []
  if (!value.jobId && jobIds.length === 0 && !value.status) {
    refinementContext.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Provide jobId, jobIds, or status to replay article-import jobs.",
      path: ["jobId"],
    })
  }

  if ((value.jobId || jobIds.length > 0) && value.status) {
    refinementContext.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Replay selection must use jobId/jobIds or status, not both.",
      path: ["status"],
    })
  }

  const explicitSelectionCount = (value.jobId ? 1 : 0) + jobIds.length
  if (explicitSelectionCount > ARTICLE_IMPORT_MAX_REPLAY_BATCH_LIMIT) {
    refinementContext.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Replay selection cannot exceed ${ARTICLE_IMPORT_MAX_REPLAY_BATCH_LIMIT} explicit job ids.`,
      path: ["jobIds"],
    })
  }
})

export async function handleArticleImportReplay(
  request: Request,
  env: AstraPlatformEnv,
  ctx: AstraRequestContext,
): Promise<Response> {
  if (!isArticleImportReplayEnabled(env)) {
    return errorResponse(
      503,
      "OPERATOR_REPLAY_DISABLED",
      "Article-import operator replay is disabled for this environment.",
      ctx.requestId,
    )
  }

  if (!isArticleImportOperatorAuthorized(request, env)) {
    return errorResponse(
      403,
      "FORBIDDEN",
      "Article-import operator replay requires a valid operator token.",
      ctx.requestId,
    )
  }

  let payload: z.infer<typeof ReplayRequestSchema>
  try {
    payload = ReplayRequestSchema.parse(await request.json())
  } catch (error) {
    const message = error instanceof z.ZodError
      ? error.issues.map((issue) => issue.message).join(" ")
      : "Replay requests must provide a valid JSON body."
    return errorResponse(400, "INVALID_REQUEST", message, ctx.requestId)
  }

  const normalizedJobIds = [payload.jobId, ...(payload.jobIds ?? [])].filter(Boolean) as string[]
  const operatorId = readArticleImportOperatorId(request)
  const result = await replayArticleImportJobs({
    env,
    ctx,
    operatorId,
    replayReason: payload.reason?.trim() || null,
    dryRun: payload.dryRun,
    selection: {
      jobIds: normalizedJobIds.length > 0 ? normalizedJobIds : undefined,
      status: payload.status,
      limit: payload.limit,
    },
  })

  return jsonResponse({
    ok: true,
    requestId: ctx.requestId,
    operatorId,
    dryRun: payload.dryRun,
    ...result,
  })
}
