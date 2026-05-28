import type { AstraContentLengthBucket } from "@/types/operating-model"
import { buildAstraReferralInviteMetadata, sanitizeAstraReferralCampaign } from "@/utils/referral-readiness"

export interface AstraGrowthSharePayload {
  title: string
  text: string
  url: string
}

export interface AstraGrowthTelemetryMetadata extends Record<string, unknown> {
  source: string
  surface: "sample_lesson" | "review" | "library" | "web_landing"
  shareType?: "sentence_card"
  referralType?: "non_rewarding"
  landingSource: "sentence_card" | "referral"
  contentOrigin?: "sample_lesson" | "user_selected"
  contentLengthBucket?: AstraContentLengthBucket
  hasSourceTitle?: boolean
  rewardAvailable?: boolean
  sampleContentOnly?: boolean
  trigger?: string
  schema?: string
  campaign?: string
}

export interface SentenceShareCardInput {
  sentence: string
  translation: string
  sourceTitle?: string | null
  landingBaseUrl?: string
  campaign?: string
  contentOrigin?: "sample_lesson" | "user_selected"
}

export interface ReferralInviteInput {
  landingBaseUrl?: string
  campaign?: string
  trigger?: string
}

function compactWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim()
}

function clampDisplayText(value: string, maxLength: number): string {
  const compacted = compactWhitespace(value)
  if (compacted.length <= maxLength) return compacted
  return `${compacted.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`
}

export function getAstraShareContentLengthBucket(value: string): AstraContentLengthBucket {
  const length = compactWhitespace(value).length
  if (length === 0) return "unknown"
  if (length <= 80) return "short"
  if (length <= 180) return "medium"
  if (length <= 500) return "long"
  return "very_long"
}

export function buildAstraGrowthLandingUrl(input: {
  landingBaseUrl?: string
  source: "sentence_card" | "referral"
  medium: "share" | "invite"
  campaign?: string
  share?: "sentence"
  referral?: "non_rewarding"
}): string {
  const base = input.landingBaseUrl?.trim() || "https://astra.so/"
  const url = new URL(base)
  url.searchParams.set("utm_source", input.source)
  url.searchParams.set("utm_medium", input.medium)
  url.searchParams.set("utm_campaign", sanitizeAstraReferralCampaign(input.campaign) || "first_90_growth_mvp")
  if (input.share) url.searchParams.set("share", input.share)
  if (input.referral) url.searchParams.set("referral", input.referral)
  return url.toString()
}

export function buildSentenceShareCard(input: SentenceShareCardInput): {
  payload: AstraGrowthSharePayload
  telemetry: AstraGrowthTelemetryMetadata
} {
  const sentence = clampDisplayText(input.sentence, 180)
  const translation = clampDisplayText(input.translation, 180)
  const sourceTitle = input.sourceTitle ? clampDisplayText(input.sourceTitle, 90) : null
  const url = buildAstraGrowthLandingUrl({
    landingBaseUrl: input.landingBaseUrl,
    source: "sentence_card",
    medium: "share",
    campaign: input.campaign,
    share: "sentence",
  })

  return {
    payload: {
      title: "Astra sentence card",
      text: [
        "Astra sentence card",
        `“${sentence}”`,
        translation,
        sourceTitle ? `From: ${sourceTitle}` : null,
        "Shared from Astra — turn real content into reviewable language practice.",
      ].filter(Boolean).join("\n"),
      url,
    },
    telemetry: {
      source: "sample_lesson",
      surface: "sample_lesson",
      shareType: "sentence_card",
      landingSource: "sentence_card",
      contentOrigin: input.contentOrigin ?? "sample_lesson",
      contentLengthBucket: getAstraShareContentLengthBucket(input.sentence),
      hasSourceTitle: Boolean(sourceTitle),
    },
  }
}

export function buildReferralInvite(input: ReferralInviteInput = {}): {
  payload: AstraGrowthSharePayload
  telemetry: AstraGrowthTelemetryMetadata
} {
  const url = buildAstraGrowthLandingUrl({
    landingBaseUrl: input.landingBaseUrl,
    source: "referral",
    medium: "invite",
    campaign: input.campaign,
    referral: "non_rewarding",
  })
  return {
    payload: {
      title: "Try Astra",
      text: "Try Astra on a sample page: understand one sentence, save it, and review it without configuring AI.",
      url,
    },
    telemetry: buildAstraReferralInviteMetadata({
      trigger: input.trigger,
      campaign: input.campaign,
    }),
  }
}
