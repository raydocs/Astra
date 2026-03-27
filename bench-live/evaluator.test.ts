import { describe, expect, it } from "vitest"

import { createLiveRuntime } from "./runtime"
import { evaluateLiveScenario } from "./evaluator"
import { placeholderScenario } from "./scenarios/placeholder"

describe("bench-live evaluator", () => {
  it("preserves the placeholder live-result contract", async () => {
    const runtime = createLiveRuntime()
    const context = {
      id: placeholderScenario.id,
      title: placeholderScenario.title,
      surface: placeholderScenario.surface,
      fixture: placeholderScenario.fixture ?? null,
      description: placeholderScenario.description ?? null,
      tags: [...(placeholderScenario.tags ?? [])],
      runId: "live-test-run",
    }

    const execution = await placeholderScenario.run(runtime, context)
    const result = await evaluateLiveScenario(placeholderScenario, execution, {
      runId: context.runId,
      runtime: runtime.snapshot(),
    })

    expect(result.status).toBe("skipped")
    expect(result.pass).toBe(false)
    expect(result.manifest.schema).toBe("astra.bench-live.result")
    expect(result.manifest.execution.status).toBe("skipped")
    expect(result.manifest.evaluation.status).toBe("skipped")
    expect(result.manifest.evaluation.pass).toBe(false)
    expect(result.runtime.events.length).toBeGreaterThan(0)
    expect(result.artifacts.runtime.events.length).toBe(result.runtime.events.length)
    expect(result.nextActions.some((action) => action.includes("Playwright") || action.includes("browser adapter"))).toBe(true)
  })
})
