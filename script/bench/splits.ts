import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import type { BenchmarkScenario, BenchmarkSplit } from "./types"

interface SplitManifest {
  [scenarioId: string]: BenchmarkSplit
}

const moduleDir = path.dirname(fileURLToPath(import.meta.url))
const manifestPath = path.join(moduleDir, "splits.json")
const splitManifest = JSON.parse(readFileSync(manifestPath, "utf8")) as SplitManifest

export const benchmarkSplits = ["train", "validation", "holdout"] as const satisfies readonly BenchmarkSplit[]

export function isBenchmarkSplit(value: string | null | undefined): value is BenchmarkSplit {
  return value === "train" || value === "validation" || value === "holdout"
}

export function getScenarioSplit(scenarioId: string): BenchmarkSplit {
  return splitManifest[scenarioId] ?? "train"
}

export function filterScenariosBySplit<TScenario extends Pick<BenchmarkScenario, "id">>(
  scenarios: readonly TScenario[],
  split: BenchmarkSplit | null,
): TScenario[] {
  if (!split) {
    return [...scenarios]
  }

  return scenarios.filter((scenario) => getScenarioSplit(scenario.id) === split)
}

export function countScenariosBySplit<TScenario extends Pick<BenchmarkScenario, "id">>(scenarios: readonly TScenario[]) {
  const counts: Record<BenchmarkSplit, number> = {
    train: 0,
    validation: 0,
    holdout: 0,
  }

  scenarios.forEach((scenario) => {
    counts[getScenarioSplit(scenario.id)] += 1
  })

  return counts
}

