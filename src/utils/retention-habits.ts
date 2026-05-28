export type AstraRetentionLoopId =
  | "today_review"
  | "continue_reading"
  | "continue_watching"
  | "weekly_digest"
  | "forgotten_words"
  | "source_return"
  | "pro_value_summary"
  | "win_back"

export type AstraRetentionChannel =
  | "in_product"
  | "popup_badge"
  | "optional_notification"
  | "optional_email"
  | "account_digest"

export type AstraRetentionDecision = "show" | "suppress"
export type AstraRetentionSuppressReason =
  | "not_suppressed"
  | "user_opted_out"
  | "email_unsubscribed"
  | "no_reviewable_content"
  | "no_continue_target"
  | "no_digest_value"
  | "not_enough_inactivity"
  | "not_a_membership_value_moment"

export interface AstraRetentionLoopPolicy {
  loopId: AstraRetentionLoopId
  label: string
  objective: string
  trigger: string
  userFeeling: string
  defaultChannels: AstraRetentionChannel[]
  maxFrequency: string
  requiresUserValue: boolean
  respectsOptOut: boolean
  primaryCopy: string
  analyticsSignals: string[]
  guardrails: string[]
}

export interface AstraRetentionTouchpointInput {
  loopId: AstraRetentionLoopId
  reviewableCardCount?: number
  savedMomentCount?: number
  sourceCount?: number
  daysSinceLastActive?: number
  userOptedOutOfReminders?: boolean
  emailUnsubscribed?: boolean
  privacyMode?: boolean
  tier?: "free" | "trial" | "pro" | "canceled"
  hasActionableNextStep?: boolean
}

export interface AstraRetentionTouchpointEvaluation {
  decision: AstraRetentionDecision
  reason: AstraRetentionSuppressReason
  policy: AstraRetentionLoopPolicy
  channels: AstraRetentionChannel[]
  copy: string
  analyticsSignals: string[]
  privacyPolicy: string
  guardrails: string[]
}

export const ASTRA_RETENTION_LOOP_POLICIES: AstraRetentionLoopPolicy[] = [
  {
    loopId: "today_review",
    label: "Today Review",
    objective: "Make review feel light and finishable.",
    trigger: "Saved content or due cards are available.",
    userFeeling: "3 cards are ready. Finish in about 2 minutes.",
    defaultChannels: ["in_product", "popup_badge", "optional_notification"],
    maxFrequency: "At most once per day outside explicit user action.",
    requiresUserValue: true,
    respectsOptOut: true,
    primaryCopy: "3 cards are ready. Finish in about 2 minutes.",
    analyticsSignals: ["review_opened", "review_session_completed", "reminder_dismissed", "reminder_disabled"],
    guardrails: [
      "Do not use shame, streak pressure, or fear-of-falling-behind copy.",
      "Do not show if no reviewable cards exist.",
      "Reminder controls must be visible or one step away.",
    ],
  },
  {
    loopId: "continue_reading",
    label: "Continue Reading",
    objective: "Help the learner resume unfinished source content.",
    trigger: "A recent page/source has saved progress.",
    userFeeling: "Continue where you left off.",
    defaultChannels: ["in_product", "popup_badge"],
    maxFrequency: "Product surfaces only; no unsolicited email.",
    requiresUserValue: true,
    respectsOptOut: false,
    primaryCopy: "Continue where you left off.",
    analyticsSignals: ["continue_clicked", "resumed_reading", "return_to_source_clicked"],
    guardrails: [
      "Use source type and hostname metadata only for telemetry.",
      "Do not imply Astra stores full page text.",
    ],
  },
  {
    loopId: "continue_watching",
    label: "Continue Watching",
    objective: "Resume a learning video without losing context.",
    trigger: "A recent video has a timestamp or saved moment.",
    userFeeling: "Continue from your last learning moment.",
    defaultChannels: ["in_product", "popup_badge"],
    maxFrequency: "Product surfaces only; no unsolicited email.",
    requiresUserValue: true,
    respectsOptOut: false,
    primaryCopy: "Continue from your last learning moment.",
    analyticsSignals: ["continue_clicked", "resumed_reading", "return_to_source_clicked"],
    guardrails: [
      "Do not store or expose transcript text in retention telemetry.",
      "Use coarse source type and action outcome only.",
    ],
  },
  {
    loopId: "weekly_digest",
    label: "Weekly Digest",
    objective: "Show long-term learning value without becoming a marketing email.",
    trigger: "A week contains saved or reviewed learning moments.",
    userFeeling: "You learned from real content this week.",
    defaultChannels: ["in_product", "account_digest", "optional_email"],
    maxFrequency: "At most weekly and always unsubscribeable when emailed.",
    requiresUserValue: true,
    respectsOptOut: true,
    primaryCopy: "You learned from real content this week.",
    analyticsSignals: ["digest_viewed", "digest_opened", "reminder_disabled"],
    guardrails: [
      "Counts, source titles, and source types are allowed; page text and transcripts are not.",
      "Email delivery must be optional and unsubscribeable.",
      "Privacy Mode should prefer in-product summary over optional email.",
    ],
  },
  {
    loopId: "forgotten_words",
    label: "Forgotten Words",
    objective: "Bring weak cards back gently when review is due.",
    trigger: "Due cards include recent lapses or weak mastery states.",
    userFeeling: "A few words are ready for review.",
    defaultChannels: ["in_product", "popup_badge", "optional_notification"],
    maxFrequency: "At most once per day outside explicit review sessions.",
    requiresUserValue: true,
    respectsOptOut: true,
    primaryCopy: "A few words are ready for review.",
    analyticsSignals: ["review_opened", "review_answered", "reminder_dismissed"],
    guardrails: [
      "Never frame lapses as failure.",
      "Keep default review volume small.",
    ],
  },
  {
    loopId: "source_return",
    label: "Source Return",
    objective: "Let review cards reconnect to their original learning context.",
    trigger: "A reviewed card has a source reference.",
    userFeeling: "Open the source again for context.",
    defaultChannels: ["in_product"],
    maxFrequency: "Only user-initiated from review/library surfaces.",
    requiresUserValue: true,
    respectsOptOut: false,
    primaryCopy: "Open the source again for context.",
    analyticsSignals: ["return_to_source_clicked", "returned_to_source"],
    guardrails: [
      "Do not expose full URL paths in telemetry.",
      "Do not send saved snippet text as event metadata.",
    ],
  },
  {
    loopId: "pro_value_summary",
    label: "Pro Value Summary",
    objective: "Explain renewal value through learning outcomes, not tokens.",
    trigger: "Monthly or billing-period account surface.",
    userFeeling: "Your saved items stay organized for review.",
    defaultChannels: ["account_digest", "in_product"],
    maxFrequency: "At most monthly or billing-period aligned.",
    requiresUserValue: true,
    respectsOptOut: false,
    primaryCopy: "Your saved items stay organized for review.",
    analyticsSignals: ["pro_value_seen", "membership_activated"],
    guardrails: [
      "Do not sell tokens, provider names, or model names as the value.",
      "Do not overstate renewal value when there is no recent learning activity.",
    ],
  },
  {
    loopId: "win_back",
    label: "Win-back",
    objective: "Offer a low-pressure return path after inactivity.",
    trigger: "7/14/30 days inactive with saved learning value.",
    userFeeling: "Your saved items are waiting when you’re ready.",
    defaultChannels: ["optional_email", "in_product"],
    maxFrequency: "Low frequency only; never more than one message per inactivity milestone.",
    requiresUserValue: true,
    respectsOptOut: true,
    primaryCopy: "Your saved items are waiting when you’re ready.",
    analyticsSignals: ["winback_sent", "reminder_disabled"],
    guardrails: [
      "No guilt, urgency, or streak-loss copy.",
      "Email must be optional and unsubscribeable.",
      "Do not include page text, saved snippets, or private topic inference.",
    ],
  },
]

const POLICY_BY_LOOP = new Map(ASTRA_RETENTION_LOOP_POLICIES.map((policy) => [policy.loopId, policy]))

function getPolicy(loopId: AstraRetentionLoopId): AstraRetentionLoopPolicy {
  const policy = POLICY_BY_LOOP.get(loopId)
  if (!policy) {
    throw new Error(`Unknown Astra retention loop: ${loopId}`)
  }
  return policy
}

function hasReviewableContent(input: AstraRetentionTouchpointInput): boolean {
  return (input.reviewableCardCount ?? 0) > 0
}

function hasDigestValue(input: AstraRetentionTouchpointInput): boolean {
  return (input.savedMomentCount ?? 0) > 0
    || (input.reviewableCardCount ?? 0) > 0
    || (input.sourceCount ?? 0) > 0
}

function hasContinueTarget(input: AstraRetentionTouchpointInput): boolean {
  return input.hasActionableNextStep === true || (input.sourceCount ?? 0) > 0
}

function hasMembershipValue(input: AstraRetentionTouchpointInput): boolean {
  return (input.tier === "trial" || input.tier === "pro") && hasDigestValue(input)
}

function suppressReasonForValue(input: AstraRetentionTouchpointInput): AstraRetentionSuppressReason {
  switch (input.loopId) {
    case "today_review":
    case "forgotten_words":
      return hasReviewableContent(input) ? "not_suppressed" : "no_reviewable_content"
    case "continue_reading":
    case "continue_watching":
    case "source_return":
      return hasContinueTarget(input) ? "not_suppressed" : "no_continue_target"
    case "weekly_digest":
      return hasDigestValue(input) ? "not_suppressed" : "no_digest_value"
    case "pro_value_summary":
      return hasMembershipValue(input) ? "not_suppressed" : "not_a_membership_value_moment"
    case "win_back":
      if ((input.daysSinceLastActive ?? 0) < 7) return "not_enough_inactivity"
      return hasDigestValue(input) ? "not_suppressed" : "no_digest_value"
  }
}

function filterChannels(input: AstraRetentionTouchpointInput, policy: AstraRetentionLoopPolicy): AstraRetentionChannel[] {
  let channels = [...policy.defaultChannels]

  if (input.privacyMode) {
    channels = channels.filter((channel) => channel !== "optional_email")
  }

  if (input.emailUnsubscribed) {
    channels = channels.filter((channel) => channel !== "optional_email")
  }

  return channels
}

function buildCopy(input: AstraRetentionTouchpointInput, policy: AstraRetentionLoopPolicy): string {
  if (input.loopId === "today_review" && (input.reviewableCardCount ?? 0) > 0) {
    const count = Math.min(input.reviewableCardCount ?? 0, 5)
    return `${count} card${count === 1 ? " is" : "s are"} ready. Finish in about ${count <= 3 ? "2" : "3"} minutes.`
  }

  if (input.privacyMode && input.loopId === "weekly_digest") {
    return "Your weekly learning summary is ready. Astra records product events, not the text you read."
  }

  return policy.primaryCopy
}

export function evaluateAstraRetentionTouchpoint(
  input: AstraRetentionTouchpointInput,
): AstraRetentionTouchpointEvaluation {
  const policy = getPolicy(input.loopId)

  if (policy.respectsOptOut && input.userOptedOutOfReminders) {
    return {
      decision: "suppress",
      reason: "user_opted_out",
      policy,
      channels: [],
      copy: policy.primaryCopy,
      analyticsSignals: policy.analyticsSignals,
      privacyPolicy: "Suppressed before display; no content telemetry is required.",
      guardrails: policy.guardrails,
    }
  }

  const valueReason = suppressReasonForValue(input)
  if (valueReason !== "not_suppressed") {
    return {
      decision: "suppress",
      reason: valueReason,
      policy,
      channels: [],
      copy: policy.primaryCopy,
      analyticsSignals: policy.analyticsSignals,
      privacyPolicy: "Suppressed because there is no user-visible learning value; no content telemetry is required.",
      guardrails: policy.guardrails,
    }
  }

  const channels = filterChannels(input, policy)
  if (channels.length === 0) {
    return {
      decision: "suppress",
      reason: "email_unsubscribed",
      policy,
      channels: [],
      copy: policy.primaryCopy,
      analyticsSignals: policy.analyticsSignals,
      privacyPolicy: "Suppressed because the only eligible delivery channel was disabled.",
      guardrails: policy.guardrails,
    }
  }

  return {
    decision: "show",
    reason: "not_suppressed",
    policy,
    channels,
    copy: buildCopy(input, policy),
    analyticsSignals: policy.analyticsSignals,
    privacyPolicy: input.privacyMode
      ? "Privacy Mode keeps retention telemetry to coarse event, source type, count, and status metadata; optional email is removed."
      : "Retention telemetry uses product events, counts, source type, hostname, and action outcome metadata only; no page text, saved snippet text, transcript text, prompt text, model output, or full URL path.",
    guardrails: policy.guardrails,
  }
}
