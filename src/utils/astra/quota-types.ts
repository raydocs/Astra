import type { AstraPlan } from "@/types/auth"

export interface QuotaInfo {
  used: number
  limit: number
  plan: AstraPlan | "custom"
  resetsAt: string
}
