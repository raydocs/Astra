import type { LiveScenarioDefinition } from "../evaluator"

export const placeholderScenario: LiveScenarioDefinition = {
  id: "bench-live/placeholder",
  title: "Placeholder live bench scenario",
  surface: "placeholder",
  fixture: "pre-playwright-contract",
  description: "A dependency-free bootstrap scenario that proves the live bench result shape before browser automation lands.",
  tags: ["placeholder", "bootstrap", "pre-playwright"],
  run(runtime, context) {
    runtime.start(context.id, context.title)
    runtime.log("Starting the live bench bootstrap scenario.", {
      integrationPhase: "pre-playwright",
      browserAdapter: "pending",
    })
    runtime.checkpoint("Prepared the live-result contract.", {
      expectedArtifactKeys: ["scenario", "execution", "runtime", "evaluation", "rubrics", "manifest"],
    })
    runtime.attachArtifact("contract", {
      schema: "astra.bench-live.placeholder",
      version: 1,
      runId: context.runId,
      scenario: {
        id: context.id,
        title: context.title,
        surface: context.surface,
      },
      browser: {
        adapter: "pending",
        nextStep: "swap in a Playwright-backed driver",
      },
      outcome: "structured-skipped",
    })
    runtime.attachArtifact("resultShape", {
      textSections: ["summary", "artifacts", "issues", "nextActions"],
      artifactBundle: ["scenario", "execution", "runtime", "evaluation", "rubrics", "manifest"],
    })
    runtime.skip("Playwright is intentionally not wired yet; emitting a structured live bench result.")

    const snapshot = runtime.snapshot()
    return {
      status: snapshot.status,
      summary: "Bootstrap step for the live bench harness. The scenario is intentionally skipped until a browser adapter is available.",
      notes: [
        "No external browser dependency is required for this step.",
        "The next integration step is to replace the placeholder scenario with a real Playwright-backed scenario.",
      ],
      artifacts: {
        contract: snapshot.artifacts.contract,
        resultShape: snapshot.artifacts.resultShape,
        browserAdapter: "pending",
      },
      runtime: snapshot,
      startedAt: snapshot.startedAt,
      finishedAt: snapshot.finishedAt,
    }
  },
}

export const liveScenarios = [placeholderScenario]
