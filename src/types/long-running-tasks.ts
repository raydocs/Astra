import { z } from "zod"

import {
  AstraCacheStatusSchema,
  AstraContentLengthBucketSchema,
  AstraFallbackReasonSchema,
  AstraFeatureSurfaceSchema,
  AstraTaskClassSchema,
} from "./operating-model"

export const AstraLongRunningTaskStatusSchema = z.enum([
  "queued",
  "running",
  "partial",
  "succeeded",
  "failed",
  "canceled",
])
export type AstraLongRunningTaskStatus = z.infer<typeof AstraLongRunningTaskStatusSchema>

export const AstraLongRunningTaskCategorySchema = z.enum([
  "deep_read",
  "long_video",
  "long_pdf",
  "long_document",
  "digest",
  "review_batch",
  "other",
])
export type AstraLongRunningTaskCategory = z.infer<typeof AstraLongRunningTaskCategorySchema>

export const AstraLongRunningTaskSourceTypeSchema = z.enum([
  "page",
  "video",
  "pdf",
  "doc",
  "book",
  "saved",
  "writing",
  "unknown",
])
export type AstraLongRunningTaskSourceType = z.infer<typeof AstraLongRunningTaskSourceTypeSchema>

export const AstraLongRunningTaskStageSchema = z.enum([
  "queued",
  "extracting",
  "chunking",
  "summarizing",
  "indexing",
  "finalizing",
  "waiting",
  "done",
])
export type AstraLongRunningTaskStage = z.infer<typeof AstraLongRunningTaskStageSchema>

export const AstraLongRunningPartialKindSchema = z.enum([
  "outline",
  "chapter_summary",
  "segment_summary",
  "key_points",
  "review_items",
  "metadata_only",
])
export type AstraLongRunningPartialKind = z.infer<typeof AstraLongRunningPartialKindSchema>

export const AstraLongRunningDegradePathSchema = z.enum([
  "none",
  "retry_same_route",
  "faster_mode",
  "reduced_context",
  "partial_result",
  "background_finish",
  "user_action",
])
export type AstraLongRunningDegradePath = z.infer<typeof AstraLongRunningDegradePathSchema>

const SafeReferenceSchema = z.string().trim().min(1).max(160).regex(/^[a-zA-Z0-9_.:-]+$/)
const SafeHashSchema = z.string().trim().min(8).max(160).regex(/^[a-zA-Z0-9_.:-]+$/)
const SafeHostnameSchema = z.string().trim().min(1).max(253).regex(/^[a-zA-Z0-9.-]+$/)
const SafeErrorCodeSchema = z.string().trim().min(1).max(80).regex(/^[A-Z0-9_]+$/)

export const AstraLongRunningTaskSourceRefSchema = z.object({
  type: AstraLongRunningTaskSourceTypeSchema.default("unknown"),
  sourceFingerprint: SafeHashSchema.nullable().default(null),
  hostname: SafeHostnameSchema.nullable().default(null),
  lengthBucket: AstraContentLengthBucketSchema.default("unknown"),
}).strict()
export type AstraLongRunningTaskSourceRef = z.infer<typeof AstraLongRunningTaskSourceRefSchema>

export const AstraLongRunningTaskProgressSchema = z.object({
  stage: AstraLongRunningTaskStageSchema.default("queued"),
  completedUnits: z.number().int().nonnegative().default(0),
  totalUnits: z.number().int().positive().nullable().default(null),
  percent: z.number().min(0).max(100).nullable().default(null),
}).strict().refine((value) => value.totalUnits == null || value.completedUnits <= value.totalUnits, {
  message: "completedUnits cannot exceed totalUnits.",
  path: ["completedUnits"],
})
export type AstraLongRunningTaskProgress = z.infer<typeof AstraLongRunningTaskProgressSchema>

export const AstraLongRunningPartialResultMetadataSchema = z.object({
  available: z.boolean().default(false),
  kind: AstraLongRunningPartialKindSchema.nullable().default(null),
  completedUnits: z.number().int().nonnegative().default(0),
  totalUnits: z.number().int().positive().nullable().default(null),
  itemCount: z.number().int().nonnegative().default(0),
  artifactRef: SafeReferenceSchema.nullable().default(null),
  cacheStatus: AstraCacheStatusSchema.default("unknown"),
  updatedAt: z.string().datetime().nullable().default(null),
}).strict().refine((value) => value.totalUnits == null || value.completedUnits <= value.totalUnits, {
  message: "completedUnits cannot exceed totalUnits.",
  path: ["completedUnits"],
})
export type AstraLongRunningPartialResultMetadata = z.infer<typeof AstraLongRunningPartialResultMetadataSchema>

export const AstraLongRunningRetryHintsSchema = z.object({
  retryable: z.boolean().default(true),
  attempt: z.number().int().nonnegative().default(0),
  maxAttempts: z.number().int().positive().default(3),
  retryAfterSeconds: z.number().int().positive().nullable().default(null),
  fallbackReason: AstraFallbackReasonSchema.default("none"),
  degradePath: AstraLongRunningDegradePathSchema.default("none"),
  fallbackAllowed: z.boolean().default(true),
}).strict().refine((value) => value.attempt <= value.maxAttempts, {
  message: "attempt cannot exceed maxAttempts.",
  path: ["attempt"],
})
export type AstraLongRunningRetryHints = z.infer<typeof AstraLongRunningRetryHintsSchema>

export const AstraLongRunningTaskErrorSchema = z.object({
  code: SafeErrorCodeSchema,
  category: z.enum(["timeout", "provider", "content", "quota", "canceled", "unknown"]),
  retryable: z.boolean().default(true),
}).strict()
export type AstraLongRunningTaskError = z.infer<typeof AstraLongRunningTaskErrorSchema>

export const AstraLongRunningPrivacyBoundarySchema = z.object({
  metadataOnly: z.literal(true).default(true),
  contentIncluded: z.literal(false).default(false),
  promptIncluded: z.literal(false).default(false),
  modelOutputIncluded: z.literal(false).default(false),
  rawSourceIncluded: z.literal(false).default(false),
  excludedFields: z.array(z.string()).default([
    "pageText",
    "transcriptText",
    "pdfText",
    "fileBody",
    "promptText",
    "modelOutputText",
    "rawSourceUrl",
    "privateUrl",
  ]),
}).strict()
export type AstraLongRunningPrivacyBoundary = z.infer<typeof AstraLongRunningPrivacyBoundarySchema>

export const AstraLongRunningTaskCreateRequestSchema = z.object({
  clientRequestId: SafeReferenceSchema.optional(),
  taskClass: AstraTaskClassSchema,
  category: AstraLongRunningTaskCategorySchema,
  surface: AstraFeatureSurfaceSchema,
  source: AstraLongRunningTaskSourceRefSchema.default({ type: "unknown", sourceFingerprint: null, hostname: null, lengthBucket: "unknown" }),
  retryHints: AstraLongRunningRetryHintsSchema.optional(),
}).strict()
export type AstraLongRunningTaskCreateRequest = z.infer<typeof AstraLongRunningTaskCreateRequestSchema>

export const AstraLongRunningTaskUpdateSchema = z.object({
  status: AstraLongRunningTaskStatusSchema.optional(),
  progress: AstraLongRunningTaskProgressSchema.optional(),
  partialResult: AstraLongRunningPartialResultMetadataSchema.optional(),
  retryHints: AstraLongRunningRetryHintsSchema.optional(),
  error: AstraLongRunningTaskErrorSchema.nullable().optional(),
}).strict().refine((value) => Object.values(value).some((field) => field !== undefined), {
  message: "At least one long-running task field is required.",
})
export type AstraLongRunningTaskUpdate = z.infer<typeof AstraLongRunningTaskUpdateSchema>

export const AstraLongRunningTaskSchema = z.object({
  schema: z.literal("astra-long-running-task.v1").default("astra-long-running-task.v1"),
  taskId: z.string().trim().min(1),
  clientRequestId: SafeReferenceSchema.nullable().default(null),
  taskClass: AstraTaskClassSchema,
  category: AstraLongRunningTaskCategorySchema,
  surface: AstraFeatureSurfaceSchema,
  source: AstraLongRunningTaskSourceRefSchema,
  status: AstraLongRunningTaskStatusSchema,
  progress: AstraLongRunningTaskProgressSchema,
  partialResult: AstraLongRunningPartialResultMetadataSchema,
  retryHints: AstraLongRunningRetryHintsSchema,
  privacy: AstraLongRunningPrivacyBoundarySchema.default({
    metadataOnly: true,
    contentIncluded: false,
    promptIncluded: false,
    modelOutputIncluded: false,
    rawSourceIncluded: false,
    excludedFields: [
      "pageText",
      "transcriptText",
      "pdfText",
      "fileBody",
      "promptText",
      "modelOutputText",
      "rawSourceUrl",
      "privateUrl",
    ],
  }),
  error: AstraLongRunningTaskErrorSchema.nullable().default(null),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  startedAt: z.string().datetime().nullable().default(null),
  partialAt: z.string().datetime().nullable().default(null),
  completedAt: z.string().datetime().nullable().default(null),
  failedAt: z.string().datetime().nullable().default(null),
  canceledAt: z.string().datetime().nullable().default(null),
}).strict()
export type AstraLongRunningTask = z.infer<typeof AstraLongRunningTaskSchema>

export const AstraLongRunningTaskCreateResponseSchema = z.object({
  task: AstraLongRunningTaskSchema,
}).strict()
export type AstraLongRunningTaskCreateResponse = z.infer<typeof AstraLongRunningTaskCreateResponseSchema>

export const AstraLongRunningTaskStatusResponseSchema = z.object({
  task: AstraLongRunningTaskSchema,
}).strict()
export type AstraLongRunningTaskStatusResponse = z.infer<typeof AstraLongRunningTaskStatusResponseSchema>

export const AstraLongRunningTaskListResponseSchema = z.object({
  schema: z.literal("astra-long-running-task-list.v1"),
  tasks: z.array(AstraLongRunningTaskSchema),
}).strict()
export type AstraLongRunningTaskListResponse = z.infer<typeof AstraLongRunningTaskListResponseSchema>
