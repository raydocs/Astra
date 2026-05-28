import { z } from "zod"

import {
  AstraCacheStatusSchema,
  AstraCostBucketSchema,
  AstraFallbackReasonSchema,
  AstraFeatureSurfaceSchema,
  AstraLatencyBucketSchema,
  AstraOperatingTierSchema,
  AstraTaskClassSchema,
} from "../types/operating-model"

export const SupportBundleFeatureSurfaceSchema = z.enum([
  "page",
  "selection",
  "video",
  "file",
  "review",
  "library",
  "account",
  "onboarding",
  "settings",
  "writing",
  "digest",
])
export type SupportBundleFeatureSurface = z.infer<typeof SupportBundleFeatureSurfaceSchema>

export const SupportBundleMembershipStateSchema = z.enum(["free", "trial", "pro", "expired", "unknown"])
export type SupportBundleMembershipState = z.infer<typeof SupportBundleMembershipStateSchema>

export const SupportBundleIssueCategorySchema = z.enum([
  "translation_quality",
  "page_not_working",
  "video_subtitles",
  "file_reader",
  "review_library",
  "account_access",
  "privacy_question",
  "other",
])
export type SupportBundleIssueCategory = z.infer<typeof SupportBundleIssueCategorySchema>

export const SupportReportIdSchema = z.string().trim().regex(/^rpt_[a-z0-9_-]{8,}$/)
export type SupportReportId = z.infer<typeof SupportReportIdSchema>

export const SupportBundleOperatingMetadataSchema = z.object({
  taskClass: AstraTaskClassSchema.optional(),
  costBucket: AstraCostBucketSchema.optional(),
  latencyBucket: AstraLatencyBucketSchema.optional(),
  cacheStatus: AstraCacheStatusSchema.optional(),
  fallbackReason: AstraFallbackReasonSchema.optional(),
  tier: AstraOperatingTierSchema.optional(),
  surface: AstraFeatureSurfaceSchema.optional(),
}).strict()
export type SupportBundleOperatingMetadata = z.infer<typeof SupportBundleOperatingMetadataSchema>

export const SupportReportStatusSchema = z.enum(["draft", "ready", "submitted", "canceled"])
export type SupportReportStatus = z.infer<typeof SupportReportStatusSchema>

export const KnownIssueStatusSchema = z.enum(["investigating", "workaround", "fixed", "monitoring"])
export type KnownIssueStatus = z.infer<typeof KnownIssueStatusSchema>

export const KnownIssueMetadataSchema = z.object({
  issueId: z.string().trim().min(1),
  status: KnownIssueStatusSchema,
  featureSurface: SupportBundleFeatureSurfaceSchema,
  issueCategory: SupportBundleIssueCategorySchema,
  hostname: z.string().trim().min(1).optional(),
  affectedVersions: z.array(z.string().trim().min(1)).default([]),
  firstSeenAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  workaroundKey: z.string().trim().min(1).optional(),
}).strict()
export type KnownIssueMetadata = z.infer<typeof KnownIssueMetadataSchema>

export const SupportBundleSchema = z.object({
  schema: z.literal("astra-support-bundle.v1"),
  reportId: SupportReportIdSchema,
  userConsent: z.boolean(),
  extensionVersion: z.string().trim().min(1),
  browser: z.string().trim().min(1),
  os: z.string().trim().min(1),
  locale: z.string().trim().min(1),
  featureSurface: SupportBundleFeatureSurfaceSchema,
  action: z.string().trim().min(1),
  issueCategory: SupportBundleIssueCategorySchema.optional(),
  errorCategory: z.string().trim().min(1).optional(),
  lastErrorCategory: z.string().trim().min(1).optional(),
  runtimeSurface: z.string().trim().min(1).optional(),
  timestamp: z.string().datetime(),
  hostname: z.string().trim().min(1).optional(),
  privacyMode: z.boolean(),
  membershipState: SupportBundleMembershipStateSchema,
  userMessageIncluded: z.boolean(),
  contactIncluded: z.boolean(),
  operatingMetadata: SupportBundleOperatingMetadataSchema.optional(),
  contentIncluded: z.object({
    enabled: z.boolean(),
    type: z.enum(["none", "selected_text", "screenshot", "user_note"]),
  }),
}).strict()
export type SupportBundle = z.infer<typeof SupportBundleSchema>

export const SupportReportDraftSchema = z.object({
  schema: z.literal("astra-support-report-draft.v1"),
  reportId: SupportReportIdSchema,
  status: SupportReportStatusSchema.default("draft"),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  issueCategory: SupportBundleIssueCategorySchema.optional(),
  bundle: SupportBundleSchema,
  knownIssue: KnownIssueMetadataSchema.nullable().default(null),
  defaultContentIncluded: z.literal(false).default(false),
}).strict()
export type SupportReportDraft = z.infer<typeof SupportReportDraftSchema>

export interface BuildSupportBundleInput {
  reportId?: SupportReportId
  userConsent?: boolean
  extensionVersion: string
  browser: string
  os: string
  locale: string
  featureSurface: SupportBundleFeatureSurface
  action: string
  issueCategory?: SupportBundleIssueCategory | null
  errorCategory?: string | null
  lastErrorCategory?: string | null
  runtimeSurface?: string | null
  timestamp?: Date | string
  hostname?: string | null
  privacyMode: boolean
  membershipState?: SupportBundleMembershipState
  userMessageIncluded?: boolean
  contactIncluded?: boolean
  operatingMetadata?: SupportBundleOperatingMetadata | null
  contentIncluded?: {
    enabled: boolean
    type: "none" | "selected_text" | "screenshot" | "user_note"
  }
}

function createSupportReportId(timestamp = Date.now()): SupportReportId {
  return SupportReportIdSchema.parse(`rpt_${timestamp.toString(36)}_${Math.random().toString(36).slice(2, 10)}`)
}

function normalizeTimestamp(value: Date | string | undefined): string {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === "string" && value.trim()) return new Date(value).toISOString()
  return new Date().toISOString()
}

function normalizeHostname(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim()
  if (!trimmed) return undefined
  try {
    return new URL(trimmed).hostname || trimmed
  } catch {
    return trimmed.replace(/^https?:\/\//i, "").split(/[/?#]/, 1)[0] || trimmed
  }
}

export function buildSupportBundle(input: BuildSupportBundleInput): SupportBundle {
  return SupportBundleSchema.parse({
    schema: "astra-support-bundle.v1",
    reportId: input.reportId ?? createSupportReportId(),
    userConsent: input.userConsent ?? false,
    extensionVersion: input.extensionVersion,
    browser: input.browser,
    os: input.os,
    locale: input.locale,
    featureSurface: input.featureSurface,
    action: input.action,
    ...(input.issueCategory ? { issueCategory: input.issueCategory } : {}),
    ...(input.errorCategory ? { errorCategory: input.errorCategory } : {}),
    ...(input.lastErrorCategory ? { lastErrorCategory: input.lastErrorCategory } : {}),
    ...(input.runtimeSurface ? { runtimeSurface: input.runtimeSurface } : {}),
    timestamp: normalizeTimestamp(input.timestamp),
    ...(normalizeHostname(input.hostname) ? { hostname: normalizeHostname(input.hostname) } : {}),
    privacyMode: input.privacyMode,
    membershipState: input.membershipState ?? "unknown",
    userMessageIncluded: input.userMessageIncluded ?? false,
    contactIncluded: input.contactIncluded ?? false,
    ...(input.operatingMetadata ? { operatingMetadata: input.operatingMetadata } : {}),
    contentIncluded: input.contentIncluded ?? { enabled: false, type: "none" },
  })
}

export function buildSupportReportDraft(input: BuildSupportBundleInput & {
  knownIssue?: KnownIssueMetadata | null
  status?: SupportReportStatus
}): SupportReportDraft {
  const bundle = buildSupportBundle(input)
  return SupportReportDraftSchema.parse({
    schema: "astra-support-report-draft.v1",
    reportId: bundle.reportId,
    status: input.status ?? "draft",
    createdAt: bundle.timestamp,
    updatedAt: bundle.timestamp,
    ...(bundle.issueCategory ? { issueCategory: bundle.issueCategory } : {}),
    bundle,
    knownIssue: input.knownIssue ?? null,
    defaultContentIncluded: false,
  })
}

export function isMetadataOnlySupportBundle(bundle: SupportBundle): boolean {
  return bundle.contentIncluded.enabled === false && bundle.contentIncluded.type === "none"
}

export function describeKnownIssueForUser(issue: KnownIssueMetadata): string {
  const status = issue.status === "workaround"
    ? "Workaround available"
    : issue.status === "investigating"
      ? "Astra is investigating"
      : issue.status === "monitoring"
        ? "Astra is monitoring this"
        : "Recently fixed"
  const workaround = issue.workaroundKey === "try_transcript_panel"
    ? "Try the transcript panel or retry later."
    : issue.workaroundKey === "try_selection_instead"
      ? "Try selecting a smaller passage instead."
      : issue.workaroundKey === "use_simpler_mode"
        ? "Try a faster/simpler mode and retry."
        : issue.workaroundKey
          ? "A workaround is available in Astra support."
          : "We’ll use your metadata report to track this pattern."

  return `Known issue: ${status}. ${workaround}`
}

export function describeSupportBundle(bundle: SupportBundle): string {
  const privacy = bundle.privacyMode ? "Privacy Mode on" : "Privacy Mode off"
  const content = isMetadataOnlySupportBundle(bundle)
    ? "No page text, saved content, transcript, or user input is included."
    : `User chose to include ${bundle.contentIncluded.type}.`
  return [
    `${bundle.featureSurface} · ${bundle.action}`,
    `${bundle.browser} · ${bundle.os} · ${bundle.extensionVersion}`,
    `${bundle.membershipState} · ${privacy}`,
    bundle.issueCategory ? `Issue: ${bundle.issueCategory}` : "Issue: not specified",
    bundle.userMessageIncluded ? "User-entered message included by choice." : "No user-entered message included.",
    bundle.contactIncluded ? "Contact info included by choice." : "No contact info included.",
    content,
  ].join("\n")
}
