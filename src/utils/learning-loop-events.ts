import { trackEvent } from "@/utils/telemetry"

export type LearningLoopEventName =
  | "deep_read_opened"
  | "sentence_explained"
  | "sentence_saved"
  | "review_answered"
  | "returned_to_source"
  | "resumed_reading"

export const LEARNING_LOOP_EVENT_NAMES: LearningLoopEventName[] = [
  "deep_read_opened",
  "sentence_explained",
  "sentence_saved",
  "review_answered",
  "returned_to_source",
  "resumed_reading",
]

export function recordLearningLoopEvent(
  event: LearningLoopEventName,
  data: Record<string, unknown> = {},
): void {
  trackEvent({
    type: "feature_usage",
    data: {
      feature: "learning_loop",
      event,
      ...data,
    },
  })
}
