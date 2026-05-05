export interface QuotaInfo {
  used: number
  limit: number
  plan: "free" | "pro" | "custom"
  resetsAt: string
}
