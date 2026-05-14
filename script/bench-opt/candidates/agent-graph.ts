import type {
  BenchArtifactScenarioLike,
  BenchOptBaselineSnapshot,
  BenchOptScoreBreakdown,
} from "../types.ts"
import type { BenchmarkSurface } from "../../bench/types.ts"
import type {
  ExecutionGraph,
  GraphMutation,
  GraphNode,
} from "../mutate-graph.ts"
import {
  applyGraphMutations,
  validateGraph,
} from "../mutate-graph.ts"

// ---------------------------------------------------------------------------
// Candidate types
// ---------------------------------------------------------------------------

/** Policy governing how graph candidates are generated and validated. */
export interface AgentGraphPolicy {
  /** Whether to validate the resulting graph before emitting the candidate. */
  validateAfterMutation: boolean
  /** Maximum number of graph mutations per candidate. */
  maxMutations: number
  /** Whether removing nodes is allowed. */
  allowRemoveNodes: boolean
  /** Whether adding new nodes is allowed. */
  allowAddNodes: boolean
  /** Whether modifying routing logic is allowed. */
  allowModifyRouting: boolean
}

/**
 * A graph configuration candidate following the OptimizerCandidateBase shape.
 *
 * Uses its own `kind` discriminator (`"agent-graph"`) rather than extending
 * OptimizerCandidateBase, because the base type constrains `kind` to
 * `"prompt" | "context"`. This keeps the types compatible without modifying
 * the shared type file.
 */
export interface AgentGraphCandidate {
  id: string
  kind: "agent-graph"
  label: string
  description: string
  surfaces?: readonly BenchmarkSurface[]
  tags?: readonly string[]
  /** The graph mutations this candidate proposes. */
  mutations: readonly GraphMutation[]
  /** Human-readable rationale for the proposed changes. */
  rationale: string
  /** The policy governing this candidate. */
  policy: AgentGraphPolicy
}

// ---------------------------------------------------------------------------
// Input signals
// ---------------------------------------------------------------------------

/** Evaluation signals used to generate graph candidates. */
export interface AgentGraphEvaluationInput {
  /** The current execution graph. */
  currentGraph: ExecutionGraph
  /** Baseline snapshot from the most recent optimization run. */
  baseline: BenchOptBaselineSnapshot | null
  /** Score breakdown from the most recent candidate evaluation. */
  breakdown: BenchOptScoreBreakdown | null
  /** Scenarios that failed in the most recent evaluation. */
  failedScenarios: readonly BenchArtifactScenarioLike[]
  /** Scenarios that passed in the most recent evaluation. */
  passedScenarios: readonly BenchArtifactScenarioLike[]
}

// ---------------------------------------------------------------------------
// Default policy
// ---------------------------------------------------------------------------

/**
 * Create a default agent graph policy, optionally overriding fields.
 */
export function createAgentGraphPolicy(
  overrides: Partial<AgentGraphPolicy> = {},
): AgentGraphPolicy {
  return {
    validateAfterMutation: overrides.validateAfterMutation ?? true,
    maxMutations: overrides.maxMutations ?? 4,
    allowRemoveNodes: overrides.allowRemoveNodes ?? true,
    allowAddNodes: overrides.allowAddNodes ?? true,
    allowModifyRouting: overrides.allowModifyRouting ?? true,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Candidate generation
// ---------------------------------------------------------------------------

let candidateCounter = 0

function nextCandidateId(): string {
  candidateCounter += 1
  return `agent-graph/${candidateCounter}`
}

/**
 * Reset the internal candidate counter.
 * Useful in tests to get deterministic ids.
 */
export function resetAgentGraphCandidateCounter(): void {
  candidateCounter = 0
}

/**
 * Generate agent graph candidates from evaluation signals.
 *
 * Heuristics:
 * 1. If many scenarios fail and the graph has evaluator nodes, try bypassing
 *    the evaluator to see if it is too strict.
 * 2. If artifact alignment is low, try adding an extra prompt node to inject
 *    more context before the main tool.
 * 3. If the graph has multiple tool nodes and coverage is high but clarity
 *    is low, try simplifying by removing non-essential tool nodes.
 * 4. If routing exists and scores are mediocre, try modifying routing
 *    conditions to change the execution path.
 *
 * @returns An array of candidates, each proposing a different graph mutation strategy.
 */
export function generateAgentGraphCandidates(
  input: AgentGraphEvaluationInput,
  policy: AgentGraphPolicy = createAgentGraphPolicy(),
): AgentGraphCandidate[] {
  const candidates: AgentGraphCandidate[] = []
  const graph = input.currentGraph
  const breakdown = input.breakdown

  const toolNodes = graph.nodes.filter((n) => n.type === "tool")
  const evaluatorNodes = graph.nodes.filter((n) => n.type === "evaluator")
  const routerNodes = graph.nodes.filter((n) => n.type === "router")
  const promptNodes = graph.nodes.filter((n) => n.type === "prompt")

  // --- Heuristic 1: Bypass evaluator if many failures ---
  if (evaluatorNodes.length > 0 && input.failedScenarios.length > input.passedScenarios.length) {
    if (policy.allowRemoveNodes) {
      const mutations: GraphMutation[] = evaluatorNodes.map((node) => ({
        action: "remove-node" as const,
        target: node.id,
        params: {},
      }))

      const trimmed = mutations.slice(0, policy.maxMutations)
      const candidate = tryBuildCandidate(graph, trimmed, policy, {
        label: "Bypass evaluator nodes",
        rationale: `${input.failedScenarios.length} scenarios failed vs ${input.passedScenarios.length} passed; remove evaluator nodes to test if the evaluator is too strict.`,
        extraTags: ["evaluator-bypass"],
      })
      if (candidate) candidates.push(candidate)
    }
  }

  // --- Heuristic 2: Add prompt node for low alignment ---
  if (breakdown && breakdown.artifactAlignment < 10 && policy.allowAddNodes) {
    const contextPromptId = "injected-context-prompt"
    const mutations: GraphMutation[] = [
      {
        action: "add-node",
        target: contextPromptId,
        params: {
          type: "prompt",
          config: {
            promptKey: "extraction",
            inject: "before-tool",
            note: "Auto-injected to improve artifact alignment",
          },
        },
      },
    ]

    // Wire the new prompt node before the first tool node
    if (toolNodes.length > 0) {
      const firstTool = toolNodes[0]
      // Find edges going to the first tool and reroute through the prompt
      const inboundEdges = graph.edges.filter((e) => e.to === firstTool.id)
      for (const edge of inboundEdges.slice(0, 1)) {
        mutations.push({
          action: "remove-edge",
          target: `${edge.from}->${edge.to}`,
          params: { from: edge.from, to: edge.to },
        })
        mutations.push({
          action: "add-edge",
          target: `${edge.from}->${contextPromptId}`,
          params: { from: edge.from, to: contextPromptId },
        })
        mutations.push({
          action: "add-edge",
          target: `${contextPromptId}->${firstTool.id}`,
          params: { from: contextPromptId, to: firstTool.id },
        })
      }
    }

    const trimmed = mutations.slice(0, policy.maxMutations)
    const candidate = tryBuildCandidate(graph, trimmed, policy, {
      label: "Inject context prompt for alignment",
      rationale: `Artifact alignment is weak (${breakdown.artifactAlignment}); add a context-enrichment prompt node before the first tool to improve alignment.`,
      extraTags: ["prompt-injection", "alignment"],
    })
    if (candidate) candidates.push(candidate)
  }

  // --- Heuristic 3: Simplify by removing non-essential tool nodes ---
  if (breakdown && toolNodes.length > 2 && breakdown.contextCoverage > 20 && breakdown.promptClarity < 12) {
    if (policy.allowRemoveNodes) {
      // Keep the first tool node and the entrypoint-connected ones; remove others
      const entryConnected = new Set<string>()
      for (const edge of graph.edges) {
        if (edge.from === graph.entrypoint) entryConnected.add(edge.to)
      }

      const removable = toolNodes.filter(
        (n) => n.id !== graph.entrypoint && !entryConnected.has(n.id),
      )

      const mutations: GraphMutation[] = removable
        .slice(0, 2)
        .map((n) => ({
          action: "remove-node" as const,
          target: n.id,
          params: {},
        }))

      if (mutations.length > 0) {
        const trimmed = mutations.slice(0, policy.maxMutations)
        const candidate = tryBuildCandidate(graph, trimmed, policy, {
          label: "Simplify tool pipeline",
          rationale: `Context coverage (${breakdown.contextCoverage}) is high but prompt clarity (${breakdown.promptClarity}) is low; simplify by removing ${mutations.length} non-essential tool node(s).`,
          extraTags: ["simplify", "tool-reduction"],
        })
        if (candidate) candidates.push(candidate)
      }
    }
  }

  // --- Heuristic 4: Modify routing conditions ---
  if (routerNodes.length > 0 && breakdown && policy.allowModifyRouting) {
    const total = breakdown.total
    const mediocre = total >= 30 && total <= 65

    if (mediocre) {
      const mutations: GraphMutation[] = routerNodes.slice(0, 1).map((node) => ({
        action: "modify-node" as const,
        target: node.id,
        params: {
          config: {
            ...node.config,
            strategy: "fallthrough",
            note: "Optimizer switched from condition-based to fallthrough to test if routing is limiting scores",
          },
        },
      }))

      const trimmed = mutations.slice(0, policy.maxMutations)
      const candidate = tryBuildCandidate(graph, trimmed, policy, {
        label: "Simplify routing to fallthrough",
        rationale: `Score is mediocre (${total}); switch router to fallthrough strategy to test if condition-based routing is limiting performance.`,
        extraTags: ["routing", "simplify"],
      })
      if (candidate) candidates.push(candidate)
    }
  }

  // --- Heuristic 5: Add a second evaluator node for quality gating ---
  if (evaluatorNodes.length === 0 && breakdown && breakdown.total < 50 && policy.allowAddNodes) {
    const qualityGateId = "quality-gate"
    const mutations: GraphMutation[] = [
      {
        action: "add-node",
        target: qualityGateId,
        params: {
          type: "evaluator",
          config: {
            metric: "output-quality",
            threshold: 0.5,
            action: "retry-or-pass",
            note: "Auto-added quality gate to improve low scores",
          },
        },
      },
    ]

    // Wire after the last tool node
    if (toolNodes.length > 0) {
      const lastTool = toolNodes[toolNodes.length - 1]
      mutations.push({
        action: "add-edge",
        target: `${lastTool.id}->${qualityGateId}`,
        params: { from: lastTool.id, to: qualityGateId },
      })
    }

    const trimmed = mutations.slice(0, policy.maxMutations)
    const candidate = tryBuildCandidate(graph, trimmed, policy, {
      label: "Add quality gate evaluator",
      rationale: `Total score is low (${breakdown.total}) and no evaluator nodes exist; add a quality gate after the tool pipeline to catch low-quality output.`,
      extraTags: ["quality-gate", "evaluator"],
    })
    if (candidate) candidates.push(candidate)
  }

  // --- Fallback: no-op candidate ---
  if (candidates.length === 0) {
    candidates.push({
      id: nextCandidateId(),
      kind: "agent-graph",
      label: "No graph changes",
      description: "No actionable graph mutations identified from current evaluation signals.",
      tags: ["phase-1", "agent-graph", "noop"],
      mutations: [],
      rationale: "No actionable graph mutations identified from current evaluation signals.",
      policy,
    })
  }

  return candidates
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface CandidateMeta {
  label: string
  rationale: string
  extraTags: string[]
}

function tryBuildCandidate(
  graph: ExecutionGraph,
  mutations: readonly GraphMutation[],
  policy: AgentGraphPolicy,
  meta: CandidateMeta,
): AgentGraphCandidate | null {
  if (policy.validateAfterMutation) {
    const mutated = applyGraphMutations(graph, mutations)
    const validation = validateGraph(mutated)
    if (!validation.valid) {
      return null
    }
  }

  const tags = new Set<string>(["phase-1", "agent-graph", ...meta.extraTags])
  for (const m of mutations) {
    tags.add(m.action)
  }

  return {
    id: nextCandidateId(),
    kind: "agent-graph",
    label: meta.label,
    description: meta.rationale,
    tags: [...tags],
    mutations,
    rationale: meta.rationale,
    policy,
  }
}

// ---------------------------------------------------------------------------
// Static candidates
// ---------------------------------------------------------------------------

/**
 * Create a candidate that strips the graph to a minimal linear pipeline:
 * one prompt -> one tool -> one evaluator.
 *
 * Useful as a simplicity baseline.
 */
export function createMinimalGraphCandidate(
  graph: ExecutionGraph,
): AgentGraphCandidate {
  const toolNodes = graph.nodes.filter((n) => n.type === "tool")
  const firstTool = toolNodes[0] ?? graph.nodes[0]

  if (!firstTool) {
    return {
      id: "agent-graph/minimal",
      kind: "agent-graph",
      label: "Minimal linear pipeline (empty graph)",
      description: "Graph has no nodes; no simplification possible.",
      tags: ["phase-1", "agent-graph", "minimal", "noop"],
      mutations: [],
      rationale: "Graph is empty; nothing to simplify.",
      policy: createAgentGraphPolicy(),
    }
  }

  // Remove every node except the first tool
  const mutations: GraphMutation[] = graph.nodes
    .filter((n) => n.id !== firstTool.id)
    .map((n) => ({
      action: "remove-node" as const,
      target: n.id,
      params: {},
    }))

  // Add a minimal prompt and evaluator
  mutations.push(
    {
      action: "add-node",
      target: "minimal-prompt",
      params: {
        type: "prompt",
        config: { promptKey: "translation", inject: "before-tool" },
      },
    },
    {
      action: "add-node",
      target: "minimal-evaluator",
      params: {
        type: "evaluator",
        config: { metric: "basic-quality", threshold: 0.5, action: "log" },
      },
    },
    {
      action: "add-edge",
      target: `minimal-prompt->${firstTool.id}`,
      params: { from: "minimal-prompt", to: firstTool.id },
    },
    {
      action: "add-edge",
      target: `${firstTool.id}->minimal-evaluator`,
      params: { from: firstTool.id, to: "minimal-evaluator" },
    },
  )

  return {
    id: "agent-graph/minimal",
    kind: "agent-graph",
    label: "Minimal linear pipeline",
    description: "Strip the graph to prompt -> tool -> evaluator to establish a simplicity baseline.",
    tags: ["phase-1", "agent-graph", "minimal", "baseline"],
    mutations,
    rationale: "Reduce the graph to the simplest possible pipeline to measure the baseline with minimal structural complexity.",
    policy: createAgentGraphPolicy({ allowRemoveNodes: true, allowAddNodes: true }),
  }
}

/**
 * Create a candidate that adds parallel tool execution branches.
 * Useful for testing whether concurrent tool invocation improves throughput.
 */
export function createParallelBranchCandidate(
  graph: ExecutionGraph,
): AgentGraphCandidate {
  const toolNodes = graph.nodes.filter((n) => n.type === "tool")

  if (toolNodes.length < 2) {
    return {
      id: "agent-graph/parallel",
      kind: "agent-graph",
      label: "Parallel branch (insufficient tools)",
      description: "Graph has fewer than 2 tool nodes; parallel branching not applicable.",
      tags: ["phase-1", "agent-graph", "parallel", "noop"],
      mutations: [],
      rationale: "Fewer than 2 tool nodes; cannot create parallel branches.",
      policy: createAgentGraphPolicy(),
    }
  }

  // Add a fork router and a join evaluator
  const mutations: GraphMutation[] = [
    {
      action: "add-node",
      target: "parallel-fork",
      params: {
        type: "router",
        config: {
          strategy: "parallel-all",
          note: "Fork execution to run tool nodes in parallel",
        },
      },
    },
    {
      action: "add-node",
      target: "parallel-join",
      params: {
        type: "evaluator",
        config: {
          metric: "merge-results",
          strategy: "best-of",
          note: "Merge parallel results and pick the best",
        },
      },
    },
  ]

  // Wire fork -> each tool -> join
  for (const tool of toolNodes.slice(0, 3)) {
    mutations.push({
      action: "add-edge",
      target: `parallel-fork->${tool.id}`,
      params: { from: "parallel-fork", to: tool.id },
    })
    mutations.push({
      action: "add-edge",
      target: `${tool.id}->parallel-join`,
      params: { from: tool.id, to: "parallel-join" },
    })
  }

  return {
    id: "agent-graph/parallel",
    kind: "agent-graph",
    label: "Parallel tool branches",
    description: "Fork execution across tool nodes and merge with best-of strategy.",
    tags: ["phase-1", "agent-graph", "parallel", "experimental"],
    mutations,
    rationale: "Test whether running tools in parallel and merging results produces better scores than serial execution.",
    policy: createAgentGraphPolicy({ allowAddNodes: true, allowModifyRouting: true }),
  }
}
