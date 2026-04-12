import { readAstraSession } from "@/utils/storage/auth"

export interface QuotaInfo {
  used: number
  limit: number
  plan: "free" | "pro" | "custom"
  resetsAt: string
}

function defaultQuota(): QuotaInfo {
  return { used: 0, limit: 200_000, plan: "free", resetsAt: "" }
}

export async function getQuotaInfo(): Promise<QuotaInfo> {
  try {
    const session = await readAstraSession()
    if (!session?.sessionToken || !session?.relayBaseURL) {
      return defaultQuota()
    }
    const res = await fetch(`${session.relayBaseURL.replace(/\/+$/, "")}/account/usage`, {
      headers: { Authorization: `Bearer ${session.sessionToken}` },
    })
    if (!res.ok) return defaultQuota()
    const snapshot = await res.json() as {
      quota?: { dailyCharactersLimit?: number; remainingDailyCharacters?: number }
      usage?: { dailyCharactersUsed?: number }
      generatedAt?: string
    }
    const limit = snapshot.quota?.dailyCharactersLimit ?? 200_000
    const used = snapshot.usage?.dailyCharactersUsed ?? 0
    return {
      used,
      limit,
      plan: session.plan === "pro" ? "pro" : "free",
      resetsAt: snapshot.generatedAt ?? "",
    }
  } catch {
    return defaultQuota()
  }
}
