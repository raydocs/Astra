import type { AstraPlan } from "../types/auth"
import type { AstraCostBucket, AstraTaskClass } from "../types/operating-model"
import { getCostBucketForTask } from "./operating-model"

export type EntitlementAccess = "included" | "limited" | "sample" | "unavailable"

export interface PlanEntitlement {
  access: EntitlementAccess
  userMessage: string
  monthlyAllowance: number | null
}

export const ENTITLEMENT_MATRIX: Record<AstraPlan, Record<AstraTaskClass, PlanEntitlement>> = {
  free: {
    instant_phrase: { access: "included", userMessage: "Short selections are included for everyday reading.", monthlyAllowance: null },
    paragraph_understanding: { access: "limited", userMessage: "A little page help is included each day.", monthlyAllowance: null },
    context_explanation: { access: "limited", userMessage: "Clear explanations are included for daily reading.", monthlyAllowance: null },
    deep_reading: { access: "sample", userMessage: "Try a short deep reading sample with Free.", monthlyAllowance: 1 },
    video_summary: { access: "sample", userMessage: "Try a short video lesson sample with Free.", monthlyAllowance: 1 },
    review_card: { access: "included", userMessage: "Review stays available for saved learning items.", monthlyAllowance: null },
    writing_assist: { access: "limited", userMessage: "Writing help is available for short passages.", monthlyAllowance: null },
    digest: { access: "sample", userMessage: "Preview your learning summary with Free.", monthlyAllowance: 1 },
  },
  trial: {
    instant_phrase: { access: "included", userMessage: "Short selections are included during your trial.", monthlyAllowance: null },
    paragraph_understanding: { access: "included", userMessage: "Page understanding is included during your trial.", monthlyAllowance: null },
    context_explanation: { access: "included", userMessage: "Detailed explanations are included during your trial.", monthlyAllowance: null },
    deep_reading: { access: "limited", userMessage: "Try complete deep reading on a few longer pieces.", monthlyAllowance: 5 },
    video_summary: { access: "limited", userMessage: "Try longer video lessons during your trial.", monthlyAllowance: 3 },
    review_card: { access: "included", userMessage: "Review stays available for saved learning items.", monthlyAllowance: null },
    writing_assist: { access: "included", userMessage: "Writing help is included during your trial.", monthlyAllowance: null },
    digest: { access: "included", userMessage: "Learning summaries are included during your trial.", monthlyAllowance: null },
  },
  pro: {
    instant_phrase: { access: "included", userMessage: "Short selections are included with Pro.", monthlyAllowance: null },
    paragraph_understanding: { access: "included", userMessage: "Page understanding is included with Pro.", monthlyAllowance: null },
    context_explanation: { access: "included", userMessage: "Detailed explanations are included with Pro.", monthlyAllowance: null },
    deep_reading: { access: "limited", userMessage: "Longer reading and deeper explanations are included with Pro.", monthlyAllowance: 100 },
    video_summary: { access: "limited", userMessage: "Longer video lessons are included with Pro.", monthlyAllowance: 50 },
    review_card: { access: "included", userMessage: "Review stays available for saved learning items.", monthlyAllowance: null },
    writing_assist: { access: "included", userMessage: "Writing help is included with Pro.", monthlyAllowance: null },
    digest: { access: "included", userMessage: "Learning summaries are included with Pro.", monthlyAllowance: null },
  },
}

export function getPlanEntitlement(plan: AstraPlan, taskClass: AstraTaskClass): PlanEntitlement {
  return ENTITLEMENT_MATRIX[plan][taskClass]
}

export function canUseTask(plan: AstraPlan, taskClass: AstraTaskClass): boolean {
  return getPlanEntitlement(plan, taskClass).access !== "unavailable"
}

export function shouldMeterTask(taskClass: AstraTaskClass): boolean {
  const bucket: AstraCostBucket = getCostBucketForTask(taskClass)
  return bucket === "high" || bucket === "long_running"
}
