# Agent Configuration

This directory is the canonical home for declarative bench-opt agent
configuration. It was moved from the legacy top-level `agent-config/` root.
Current mutation code models these files as typed config shapes; any runtime
reader added later should default to this directory and expose
`ASTRA_BENCH_OPT_CONFIG_DIR` as an override.

## Structure

```
script/bench-opt/config/
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

- `script/bench-opt/mutate-tools.ts` defines and mutates `tool-registry.json`-shaped configs
- `script/bench-opt/mutate-graph.ts` defines and mutates graph template-shaped configs
- `script/bench-opt/candidates/tool-config.ts` generates tool mutation candidates
- `script/bench-opt/candidates/agent-graph.ts` generates graph mutation candidates
