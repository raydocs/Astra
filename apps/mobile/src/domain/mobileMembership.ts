import type { MobileAppState } from "../state/mobileAppState"

export interface MobileMembershipDisplay {
  label: "Pro active" | "Trial" | "Free" | "Sync paused" | "Signed in" | "Sample review" | "Sign in needed"
  copy: string
  benefits: string[]
}

const SIGNED_IN_BENEFITS = [
  "Cross-device sync",
  "Weekly learning note",
  "Offline review",
  "Continue from saved pages and videos",
]

const SAMPLE_BENEFITS = ["Offline review", "Try a few cards before signing in"]

function accountName(): string {
  return "your Astra account"
}

function normalized(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim().toLowerCase() : ""
}

function isPausedSubscriptionStatus(status: string): boolean {
  return status === "canceled"
    || status === "cancelled"
    || status === "expired"
    || status === "incomplete_expired"
    || status === "past_due"
    || status === "paused"
    || status === "unpaid"
}

function isActiveSubscriptionStatus(status: string): boolean {
  return status === "active" || status === "trialing"
}

export function deriveMobileMembershipDisplay(state: MobileAppState): MobileMembershipDisplay {
  if (!state.session) {
    return state.sampleDeck
      ? {
        label: "Sample review",
        copy: "Try the sample deck first. Sign in when you want your saved cards here.",
        benefits: SAMPLE_BENEFITS,
      }
      : {
        label: "Sign in needed",
        copy: "Sign in to bring your saved cards to this phone.",
        benefits: ["Cross-device sync", "Continue from saved pages and videos"],
      }
  }

  const plan = normalized(state.session.plan)
  const status = normalized(state.session.subscriptionStatus)
  const name = accountName()
  const syncPaused = state.syncStatus === "offline" || state.syncStatus === "error"
  const subscriptionPaused = isPausedSubscriptionStatus(status)

  if (syncPaused || subscriptionPaused) {
    return {
      label: "Sync paused",
      copy: `Learning as ${name}. Your saved cards are safe. Review on this phone can catch up when sync is ready again.`,
      benefits: SIGNED_IN_BENEFITS,
    }
  }

  if ((plan === "trial" || status === "trialing") && isActiveSubscriptionStatus(status)) {
    return {
      label: "Trial",
      copy: `Learning as ${name}. Trial access is active for your saved cards and review habits.`,
      benefits: SIGNED_IN_BENEFITS,
    }
  }

  if (plan === "pro" && isActiveSubscriptionStatus(status)) {
    return {
      label: "Pro active",
      copy: `Learning as ${name}. Pro is active for your saved cards and review habits.`,
      benefits: SIGNED_IN_BENEFITS,
    }
  }

  if (plan === "free") {
    return {
      label: "Free",
      copy: `Learning as ${name} on the free plan. Your saved cards stay available for review.`,
      benefits: SIGNED_IN_BENEFITS,
    }
  }

  return {
    label: "Signed in",
    copy: `Learning as ${name}. Your saved cards stay available for review.`,
    benefits: SIGNED_IN_BENEFITS,
  }
}
