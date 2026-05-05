import { describe, expect, it } from "vitest"

import { createLiveRuntime } from "./runtime"
import { evaluateLiveScenario, type LiveScenarioDefinition } from "./evaluator"
import { placeholderScenario } from "./scenarios/placeholder"
import { buildLiveInteractionPriorityEvaluation } from "./scenarios/helpers/interaction-priority"
import { buildLiveYouTubeSubtitleEvaluation } from "./scenarios/helpers/youtube-subtitle"

function expectNotesInTextOrder(text: string, notes: string[]) {
  let previousIndex = -1
  for (const note of notes) {
    const currentIndex = text.indexOf(`- ${note}`)
    expect(currentIndex).toBeGreaterThan(previousIndex)
    previousIndex = currentIndex
  }
}

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

  it("preserves canonical LSIR interaction-stress diagnostics before benchmark notes", async () => {
    const runtime = createLiveRuntime()
    const diagnostics = [
      "LSIR[01] scenario=bench-live/holdout/interaction-stress",
      "LSIR[02] target=interaction-priority",
      "LSIR[03] interactions=buttons:12/12,inputs:5/5,submit:true,iframe:true",
      "LSIR[04] churn=domMutationSurvived:true,totalInteractiveElements:42",
      "LSIR[05] overlays=mounted:astra-float-ball-host|astra-hover-translate-host|astra-input-translate-host|astra-selection-toolbar-host,visible:astra-float-ball-host|astra-selection-toolbar-host",
      "LSIR[06] suppression=hoverSuppressed:true,hoverRequests:0,toggleCommands:0",
      "LSIR[07] artifacts=baselineScreenshotPath,stressScreenshotPath,snapshotHtmlPath",
      "LSIR[08] verdict-signals=allButtonsPassed:true,allInputsPassed:true,domMutationSurvived:true",
    ]
    const scenario: LiveScenarioDefinition = {
      id: "bench-live/holdout/interaction-stress",
      title: "Holdout: interaction-priority stress",
      surface: "interaction-priority",
      async run(runRuntime, context) {
        runRuntime.start(context.id, context.title)
        runRuntime.complete("synthetic interaction stress complete")
        return {
          status: runRuntime.snapshot().status,
          notes: ["execution-note"],
          interactionPriority: {
            hoverSuppressed: true,
            hoverRequestCount: 0,
            toggleCommandCount: 0,
            selectionToolbarVisible: true,
            hoverOverlayVisible: false,
            inputOverlayVisible: false,
            floatBallMounted: true,
            visibleHosts: ["astra-selection-toolbar-host", "astra-float-ball-host"],
            mountedHosts: [
              "astra-input-translate-host",
              "astra-selection-toolbar-host",
              "astra-hover-translate-host",
              "astra-float-ball-host",
            ],
            notes: ["benchmark-note"],
          },
          stressDiagnostics: {
            label: "LSIR deterministic interaction-stress diagnostics",
            orderedLines: diagnostics,
          },
        }
      },
      evaluate(execution, context) {
        return buildLiveInteractionPriorityEvaluation(execution, context.runId, context.scenario, context.runtime, {
          expectations: {
            shouldSuppressHover: true,
            requiredVisibleHosts: ["astra-selection-toolbar-host", "astra-float-ball-host"],
            forbiddenVisibleHosts: ["astra-hover-translate-host", "astra-input-translate-host"],
            requireFloatBallMounted: true,
          },
          successSummary: "synthetic interaction stress passed",
          failureSummary: "synthetic interaction stress failed",
        })
      },
    }
    const context = {
      id: scenario.id,
      title: scenario.title,
      surface: scenario.surface,
      fixture: scenario.fixture ?? null,
      description: scenario.description ?? null,
      tags: [...(scenario.tags ?? [])],
      runId: "lsir-interaction-test-run",
    }

    const execution = await scenario.run(runtime, context)
    const result = await evaluateLiveScenario(scenario, execution, {
      runId: context.runId,
      runtime: runtime.snapshot(),
    })

    const artifactEvaluationNotes = result.artifacts.evaluation.notes as string[]

    expect(result.notes.slice(0, diagnostics.length)).toEqual(diagnostics)
    expect(artifactEvaluationNotes.slice(0, diagnostics.length)).toEqual(diagnostics)
    expect(result.notes[diagnostics.length]).toBe("execution-note")
    expectNotesInTextOrder(result.text, diagnostics)
  })

  it("preserves canonical LSIR youtube-subtitle-race diagnostics and sorts snapshot notes", async () => {
    const runtime = createLiveRuntime()
    const diagnostics = [
      "LSIR[01] scenario=bench-live/holdout/youtube-subtitle-race",
      "LSIR[02] target=youtube-subtitle",
      "LSIR[03] requests=requestCount:2,uniqueCaptionTexts:2,translatedCaptionTexts:2",
      "LSIR[04] churn=duplicateCaptionUpdateCount:2,rapidUpdateCount:3",
      "LSIR[05] transitions=pauseEvents:1,seekEvents:1,seekPauseStable:true",
      "LSIR[06] captions=Holdout captions|race mode",
      "LSIR[07] snapshots=late-window-appear:nodes=1:state=buffering|pause-restored:nodes=1:state=paused|seeked-cache-hit:nodes=1:state=seeking",
      "LSIR[08] verdict-signals=dedupeAligned:true,allTranslated:true,captionNodesStable:true",
    ]
    const scenario: LiveScenarioDefinition = {
      id: "bench-live/holdout/youtube-subtitle-race",
      title: "Holdout: YouTube subtitle race-condition",
      surface: "subtitle",
      async run(runRuntime, context) {
        runRuntime.start(context.id, context.title)
        runRuntime.complete("synthetic youtube subtitle race complete")
        return {
          status: runRuntime.snapshot().status,
          notes: ["execution-note"],
          youtubeSubtitle: {
            requestCount: 2,
            uniqueCaptionTexts: ["race mode", "Holdout captions"],
            translatedCaptionTexts: ["ZH:Holdout captions", "ZH:race mode"],
            duplicateCaptionUpdateCount: 2,
            rapidUpdateCount: 3,
            pauseEvents: 1,
            seekEvents: 1,
            seekPauseStable: true,
            captionSnapshots: [
              {
                phase: "seeked-cache-hit",
                sourceText: "race mode",
                translationText: "ZH:race mode",
                translationNodeCount: 1,
                stateLabel: "seeking",
              },
              {
                phase: "late-window-appear",
                sourceText: "Holdout captions",
                translationText: "ZH:Holdout captions",
                translationNodeCount: 1,
                stateLabel: "buffering",
              },
              {
                phase: "pause-restored",
                sourceText: "Holdout captions",
                translationText: "ZH:Holdout captions",
                translationNodeCount: 1,
                stateLabel: "paused",
              },
            ],
            payloadContext: null,
          },
          stressDiagnostics: {
            label: "LSIR deterministic youtube-subtitle-race diagnostics",
            orderedLines: diagnostics,
          },
        }
      },
      evaluate(execution, context) {
        return buildLiveYouTubeSubtitleEvaluation(execution, context.runId, context.scenario, context.runtime, {
          successSummary: "synthetic youtube subtitle race passed",
          failureSummary: "synthetic youtube subtitle race failed",
        })
      },
    }
    const context = {
      id: scenario.id,
      title: scenario.title,
      surface: scenario.surface,
      fixture: scenario.fixture ?? null,
      description: scenario.description ?? null,
      tags: [...(scenario.tags ?? [])],
      runId: "lsir-youtube-test-run",
    }

    const execution = await scenario.run(runtime, context)
    const result = await evaluateLiveScenario(scenario, execution, {
      runId: context.runId,
      runtime: runtime.snapshot(),
    })

    expect(result.notes.slice(0, diagnostics.length)).toEqual(diagnostics)
    expect(result.notes.slice(diagnostics.length + 1)).toEqual([
      "late-window-appear: Holdout captions",
      "pause-restored: Holdout captions",
      "seeked-cache-hit: race mode",
    ])
    expectNotesInTextOrder(result.text, diagnostics)
  })
})
