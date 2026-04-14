import type {
  AstraAccount,
  AstraPlan,
  AstraSession,
  AstraSubscriptionStatus,
  AstraUsageSnapshot,
} from "@/types/auth"
import type { QuotaInfo } from "@/utils/astra/quota"

export type AstraAccountSurfaceSource = "account_summary" | "session_snapshot" | "none"

export function formatAstraPlanLabel(plan: AstraPlan | "custom" | null | undefined): string {
  switch (plan) {
    case "pro":
      return "Pro plan"
    case "custom":
      return "Custom plan"
    case "free":
      return "Free plan"
    default:
      return "Local only"
  }
}

export function formatAstraSubscriptionStatusLabel(status: AstraSubscriptionStatus | null | undefined): string {
  switch (status) {
    case "active":
      return "Active"
    case "past_due":
      return "Past due"
    case "canceled":
      return "Canceled"
    default:
      return "Unknown"
  }
}

export function resolveAstraAccountSurfaceSource(params: {
  account: AstraAccount | null
  usage: AstraUsageSnapshot | null
  session: AstraSession | null
}): AstraAccountSurfaceSource {
  if (params.account && params.usage) {
    return "account_summary"
  }

  if (params.session?.identityMode === "authenticated") {
    return "session_snapshot"
  }

  return "none"
}

export function buildQuotaInfoFromAccountState(params: {
  account: AstraAccount | null
  usage: AstraUsageSnapshot | null
  session: AstraSession | null
}): QuotaInfo | null {
  if (params.usage) {
    return {
      used: params.usage.usage.dailyCharactersUsed,
      limit: params.usage.quota.dailyCharactersLimit,
      plan: params.account?.plan ?? params.session?.plan ?? "free",
      resetsAt: params.usage.generatedAt,
    }
  }

  if (params.session?.identityMode === "authenticated") {
    return {
      used: params.session.usage.dailyCharactersUsed,
      limit: params.session.quota.dailyCharactersLimit,
      plan: params.session.plan,
      resetsAt: params.session.issuedAt ?? params.session.expiresAt ?? "",
    }
  }

  return null
}
