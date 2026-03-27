import type { LiveRuntimeSnapshot } from "./runtime"

export interface LiveRubricInput {
  scenarioId: string
  runtime: LiveRuntimeSnapshot
  execution: Record<string, unknown>
}

export interface LiveRubricResult {
  id: string
  title: string
  pass: boolean
  score: number
  message?: string
  details?: Record<string, unknown>
}

export interface LiveRubric {
  id: string
  title: string
  description?: string
  weight?: number
  evaluate: (input: LiveRubricInput) => LiveRubricResult | Promise<LiveRubricResult>
}

export function createLiveRubric(
  rubric: LiveRubric,
) {
  return rubric
}

export const noopLiveRubrics: LiveRubric[] = []
