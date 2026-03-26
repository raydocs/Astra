import { readAstraSession } from "@/utils/storage/auth"

export interface QuotaInfo {
  used: number
  limit: number
  plan: "free" | "pro" | "custom"
  resetsAt: string
}

export async function getQuotaInfo(): Promise<QuotaInfo> {
  try {
    const session = await readAstraSession()
    if (!session?.sessionToken || !session?.relayBaseURL) {
      return { used: 0, limit: 200000, plan: "free", resetsAt: "" }
    }
    const res = await fetch(`${session.relayBaseURL.replace(/\/+$/, "")}/quota`, {
      headers: { Authorization: `Bearer ${session.sessionToken}` },
    })
    if (!res.ok) return { used: 0, limit: 200000, plan: "free", resetsAt: "" }
    return await res.json() as QuotaInfo
  } catch {
    return { used: 0, limit: 200000, plan: "free", resetsAt: "" }
  }
}
