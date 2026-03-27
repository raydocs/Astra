// ---------------------------------------------------------------------------
// Graph types
// ---------------------------------------------------------------------------

/** A node in the execution graph. */
export interface GraphNode {
  /** Unique identifier within the graph. */
  id: string
  /** The role this node plays in the pipeline. */
  type: "tool" | "prompt" | "evaluator" | "router"
  /** Arbitrary configuration payload interpreted by the runtime. */
  config: Record<string, unknown>
}

/** A directed edge connecting two nodes, optionally gated by a condition. */
export interface GraphEdge {
  /** Source node id. */
  from: string
  /** Target node id. */
  to: string
  /** Optional condition expression evaluated at runtime. */
  condition?: string
}

/** A complete execution graph: a DAG of nodes with a designated entrypoint. */
export interface ExecutionGraph {
  /** Unique identifier for this graph template. */
  id: string
  /** Human-readable description. */
  description: string
  /** The id of the node where execution begins. */
  entrypoint: string
  /** All nodes in the graph. */
  nodes: GraphNode[]
  /** All edges in the graph. */
  edges: GraphEdge[]
}

// ---------------------------------------------------------------------------
// Mutation types
// ---------------------------------------------------------------------------

/** Describes a single atomic mutation to the execution graph. */
export interface GraphMutation {
  /** What kind of structural change to apply. */
  action: "add-node" | "remove-node" | "add-edge" | "remove-edge" | "modify-node"
  /** The id of the node or edge being targeted. For edges, use `"from->to"`. */
  target: string
  /** Action-specific parameters. */
  params: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/** Result of validating a graph. */
export interface GraphValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * Validate that an execution graph is structurally sound.
 *
 * Checks performed:
 * 1. No duplicate node ids.
 * 2. Entrypoint exists in the node set.
 * 3. Every edge references existing nodes.
 * 4. No orphan nodes (every non-entry node is reachable from the entrypoint).
 * 5. No cycles in the graph.
 */
export function validateGraph(graph: ExecutionGraph): GraphValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const nodeIds = new Set<string>()

  // 1. Duplicate node check
  for (const node of graph.nodes) {
    if (nodeIds.has(node.id)) {
      errors.push(`Duplicate node id "${node.id}".`)
    }
    nodeIds.add(node.id)
  }

  // 2. Entrypoint must exist
  if (!nodeIds.has(graph.entrypoint)) {
    errors.push(`Entrypoint "${graph.entrypoint}" does not exist in nodes.`)
  }

  // 3. Edge references
  for (const edge of graph.edges) {
    if (!nodeIds.has(edge.from)) {
      errors.push(`Edge references unknown source node "${edge.from}".`)
    }
    if (!nodeIds.has(edge.to)) {
      errors.push(`Edge references unknown target node "${edge.to}".`)
    }
  }

  // Build adjacency list for reachability and cycle checks
  const adjacency = new Map<string, string[]>()
  for (const id of nodeIds) {
    adjacency.set(id, [])
  }
  for (const edge of graph.edges) {
    if (adjacency.has(edge.from)) {
      adjacency.get(edge.from)!.push(edge.to)
    }
  }

  // 4. Reachability from entrypoint (BFS)
  const reachable = new Set<string>()
  if (nodeIds.has(graph.entrypoint)) {
    const queue = [graph.entrypoint]
    reachable.add(graph.entrypoint)
    while (queue.length > 0) {
      const current = queue.shift()!
      for (const neighbor of adjacency.get(current) ?? []) {
        if (!reachable.has(neighbor)) {
          reachable.add(neighbor)
          queue.push(neighbor)
        }
      }
    }

    for (const id of nodeIds) {
      if (!reachable.has(id)) {
        warnings.push(`Node "${id}" is not reachable from entrypoint "${graph.entrypoint}".`)
      }
    }
  }

  // 5. Cycle detection (DFS with coloring)
  const WHITE = 0
  const GRAY = 1
  const BLACK = 2
  const color = new Map<string, number>()
  for (const id of nodeIds) {
    color.set(id, WHITE)
  }

  function dfs(nodeId: string): boolean {
    color.set(nodeId, GRAY)
    for (const neighbor of adjacency.get(nodeId) ?? []) {
      const neighborColor = color.get(neighbor)
      if (neighborColor === GRAY) {
        errors.push(`Cycle detected involving node "${neighbor}".`)
        return true
      }
      if (neighborColor === WHITE) {
        if (dfs(neighbor)) return true
      }
    }
    color.set(nodeId, BLACK)
    return false
  }

  for (const id of nodeIds) {
    if (color.get(id) === WHITE) {
      if (dfs(id)) break // stop after first cycle found
    }
  }

  return { valid: errors.length === 0, errors, warnings }
}

// ---------------------------------------------------------------------------
// Apply mutations
// ---------------------------------------------------------------------------

/**
 * Apply an ordered list of graph mutations, returning a new graph.
 *
 * The original graph is never mutated.
 */
export function applyGraphMutations(
  graph: ExecutionGraph,
  mutations: readonly GraphMutation[],
): ExecutionGraph {
  let nodes = graph.nodes.map((n) => ({ ...n, config: { ...n.config } }))
  let edges = graph.edges.map((e) => ({ ...e }))
  let entrypoint = graph.entrypoint

  for (const mutation of mutations) {
    switch (mutation.action) {
      case "add-node": {
        const newNode: GraphNode = {
          id: mutation.target,
          type: (mutation.params.type as GraphNode["type"]) ?? "tool",
          config: (mutation.params.config as Record<string, unknown>) ?? {},
        }
        const existingIdx = nodes.findIndex((n) => n.id === mutation.target)
        if (existingIdx >= 0) {
          nodes[existingIdx] = newNode
        } else {
          nodes.push(newNode)
        }
        // If this is the first node, make it the entrypoint
        if (nodes.length === 1) {
          entrypoint = mutation.target
        }
        break
      }

      case "remove-node": {
        nodes = nodes.filter((n) => n.id !== mutation.target)
        edges = edges.filter((e) => e.from !== mutation.target && e.to !== mutation.target)
        // If we removed the entrypoint, clear it (validation will catch this)
        if (entrypoint === mutation.target && nodes.length > 0) {
          entrypoint = nodes[0].id
        }
        break
      }

      case "add-edge": {
        const from = mutation.params.from as string
        const to = mutation.params.to as string
        const condition = mutation.params.condition as string | undefined
        if (from && to) {
          // Avoid duplicate edges
          const exists = edges.some(
            (e) => e.from === from && e.to === to && e.condition === condition,
          )
          if (!exists) {
            edges.push({ from, to, ...(condition ? { condition } : {}) })
          }
        }
        break
      }

      case "remove-edge": {
        // Target format: "from->to" or use params
        const parts = mutation.target.split("->")
        const from = parts[0] ?? (mutation.params.from as string)
        const to = parts[1] ?? (mutation.params.to as string)
        if (from && to) {
          edges = edges.filter((e) => !(e.from === from && e.to === to))
        }
        break
      }

      case "modify-node": {
        nodes = nodes.map((n) => {
          if (n.id !== mutation.target) return n
          const newType = mutation.params.type as GraphNode["type"] | undefined
          const configOverrides = mutation.params.config as Record<string, unknown> | undefined
          return {
            ...n,
            ...(newType ? { type: newType } : {}),
            config: configOverrides ? { ...n.config, ...configOverrides } : n.config,
          }
        })
        break
      }
    }
  }

  return {
    id: graph.id,
    description: graph.description,
    entrypoint,
    nodes,
    edges,
  }
}

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

/** JSON-serializable representation of an execution graph. */
export interface SerializedGraph {
  schemaVersion: 1
  id: string
  description: string
  entrypoint: string
  nodes: Array<{
    id: string
    type: string
    config: Record<string, unknown>
  }>
  edges: Array<{
    from: string
    to: string
    condition?: string
  }>
}

/**
 * Serialize an execution graph to a JSON-safe object.
 */
export function serializeGraph(graph: ExecutionGraph): SerializedGraph {
  return {
    schemaVersion: 1,
    id: graph.id,
    description: graph.description,
    entrypoint: graph.entrypoint,
    nodes: graph.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      config: { ...n.config },
    })),
    edges: graph.edges.map((e) => {
      const edge: { from: string; to: string; condition?: string } = {
        from: e.from,
        to: e.to,
      }
      if (e.condition) edge.condition = e.condition
      return edge
    }),
  }
}

/**
 * Deserialize a JSON object into an ExecutionGraph.
 *
 * Performs basic structural validation and coerces the `type` field.
 */
export function deserializeGraph(json: SerializedGraph | Record<string, unknown>): ExecutionGraph {
  const raw = json as Record<string, unknown>

  const id = typeof raw.id === "string" ? raw.id : "unknown"
  const description = typeof raw.description === "string" ? raw.description : ""
  const entrypoint = typeof raw.entrypoint === "string" ? raw.entrypoint : ""

  const validTypes = new Set<string>(["tool", "prompt", "evaluator", "router"])

  const rawNodes = Array.isArray(raw.nodes) ? raw.nodes : []
  const nodes: GraphNode[] = rawNodes.map((n: Record<string, unknown>) => ({
    id: typeof n.id === "string" ? n.id : "",
    type: validTypes.has(n.type as string)
      ? (n.type as GraphNode["type"])
      : "tool",
    config: typeof n.config === "object" && n.config !== null
      ? (n.config as Record<string, unknown>)
      : {},
  }))

  const rawEdges = Array.isArray(raw.edges) ? raw.edges : []
  const edges: GraphEdge[] = rawEdges.map((e: Record<string, unknown>) => {
    const edge: GraphEdge = {
      from: typeof e.from === "string" ? e.from : "",
      to: typeof e.to === "string" ? e.to : "",
    }
    if (typeof e.condition === "string") edge.condition = e.condition
    return edge
  })

  return { id, description, entrypoint, nodes, edges }
}

// ---------------------------------------------------------------------------
// Diff
// ---------------------------------------------------------------------------

/** A single entry in a human-readable graph diff. */
export interface GraphDiffEntry {
  kind: "node-added" | "node-removed" | "node-modified" | "edge-added" | "edge-removed" | "entrypoint-changed"
  target: string
  details: string
}

/**
 * Produce a human-readable diff between two execution graphs.
 */
export function diffGraphs(before: ExecutionGraph, after: ExecutionGraph): GraphDiffEntry[] {
  const entries: GraphDiffEntry[] = []

  // Entrypoint change
  if (before.entrypoint !== after.entrypoint) {
    entries.push({
      kind: "entrypoint-changed",
      target: after.entrypoint,
      details: `Entrypoint changed from "${before.entrypoint}" to "${after.entrypoint}".`,
    })
  }

  // Node diffs
  const beforeNodes = new Map(before.nodes.map((n) => [n.id, n]))
  const afterNodes = new Map(after.nodes.map((n) => [n.id, n]))

  for (const [id] of beforeNodes) {
    if (!afterNodes.has(id)) {
      entries.push({
        kind: "node-removed",
        target: id,
        details: `Node "${id}" removed.`,
      })
    }
  }

  for (const [id, afterNode] of afterNodes) {
    const beforeNode = beforeNodes.get(id)
    if (!beforeNode) {
      entries.push({
        kind: "node-added",
        target: id,
        details: `Node "${id}" added (type: ${afterNode.type}).`,
      })
    } else {
      const typeChanged = beforeNode.type !== afterNode.type
      const configChanged = JSON.stringify(beforeNode.config) !== JSON.stringify(afterNode.config)
      if (typeChanged || configChanged) {
        const parts: string[] = []
        if (typeChanged) parts.push(`type: ${beforeNode.type} -> ${afterNode.type}`)
        if (configChanged) parts.push("config changed")
        entries.push({
          kind: "node-modified",
          target: id,
          details: `Node "${id}" modified (${parts.join(", ")}).`,
        })
      }
    }
  }

  // Edge diffs
  function edgeKey(e: GraphEdge) {
    return `${e.from}->${e.to}${e.condition ? `[${e.condition}]` : ""}`
  }

  const beforeEdges = new Set(before.edges.map(edgeKey))
  const afterEdges = new Set(after.edges.map(edgeKey))

  for (const key of beforeEdges) {
    if (!afterEdges.has(key)) {
      entries.push({
        kind: "edge-removed",
        target: key,
        details: `Edge ${key} removed.`,
      })
    }
  }

  for (const key of afterEdges) {
    if (!beforeEdges.has(key)) {
      entries.push({
        kind: "edge-added",
        target: key,
        details: `Edge ${key} added.`,
      })
    }
  }

  return entries
}
