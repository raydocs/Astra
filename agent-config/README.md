# Agent Configuration

This directory holds the declarative configuration files that the bench-opt
optimizer uses to drive agent behavior. The optimizer reads these files at
the start of each trial, applies candidate mutations, and writes the
mutated variants into the trial worktree so the bench harness can evaluate
them.

## Structure

```
agent-config/
  defaults.json          - Default agent configuration (model routing,
                           temperature, system prompts, retry policy)
  tool-registry.json     - Registry of available tools with metadata
  graph-templates/       - Execution graph templates that describe how
                           tools, prompts, and evaluators are wired together
    translation-flow.json - Example graph for the translation pipeline
```

## How it works

1. **defaults.json** contains the baseline agent settings. The optimizer
   never mutates this file directly; instead it generates a *candidate*
   JSON that overrides specific keys.

2. **tool-registry.json** enumerates every tool the agent can invoke.
   Each entry has an `enabled` flag, parameter metadata, and a
   `critical` marker that prevents the optimizer from disabling
   safety-critical tools.

3. **graph-templates/** hold execution graphs expressed as JSON. A graph
   is a DAG of typed nodes (tool, prompt, evaluator, router) connected
   by edges with optional conditions. The optimizer can add, remove, or
   rewire nodes to explore alternative execution strategies.

## Consumed by

- `bench-opt/mutate-tools.ts` reads and mutates `tool-registry.json`
- `bench-opt/mutate-graph.ts` reads and mutates graph templates
- `bench-opt/candidates/tool-config.ts` generates tool mutation candidates
- `bench-opt/candidates/agent-graph.ts` generates graph mutation candidates
