import { contextCandidates } from "./candidates/context"
import { promptCandidates } from "./candidates/prompt"
import type { OptimizerCandidate, OptimizerCandidateKind, OptimizerRegistry } from "./types"

export const phase1OptimizerCandidates = [
  ...promptCandidates,
  ...contextCandidates,
] satisfies readonly OptimizerCandidate[]

export function createOptimizerRegistry(
  candidates: readonly OptimizerCandidate[] = phase1OptimizerCandidates,
): OptimizerRegistry {
  return {
    phase: 1,
    candidates,
    byId: new Map(candidates.map((candidate) => [candidate.id, candidate] as const)),
  }
}

export const phase1OptimizerRegistry = createOptimizerRegistry()

export function listOptimizerCandidates(
  kind?: OptimizerCandidateKind,
  registry: OptimizerRegistry = phase1OptimizerRegistry,
): readonly OptimizerCandidate[] {
  return kind
    ? registry.candidates.filter((candidate) => candidate.kind === kind)
    : registry.candidates
}

export function getOptimizerCandidate(
  id: string,
  registry: OptimizerRegistry = phase1OptimizerRegistry,
): OptimizerCandidate | undefined {
  return registry.byId.get(id)
}
