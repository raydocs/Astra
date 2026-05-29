import { mkdtemp, readFile, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { describe, expect, it } from "vitest"

import { safeBenchOptArtifactFileStem, saveBenchOptChampion } from "./store.ts"
import type { BenchOptChampionRecord, BenchOptStoreIndex } from "./types.ts"

describe("bench-opt store artifact paths", () => {
  it("sanitizes artifact file stems for GitHub upload-artifact compatibility", () => {
    expect(safeBenchOptArtifactFileStem("exp-2026-05-28T07-56-59-161Z:trial-001")).toBe(
      "exp-2026-05-28T07-56-59-161Z-trial-001",
    )
    expect(safeBenchOptArtifactFileStem(" bad<name>|with?chars* ")).toBe("bad-name--with-chars-")
    expect(safeBenchOptArtifactFileStem("   ")).toBe("unnamed")
  })

  it("writes champion records to sanitized paths while preserving original ids in the index", async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "astra-bench-opt-store-"))
    try {
      const champion: BenchOptChampionRecord = {
        schemaVersion: 1,
        championTrialId: "exp-2026-05-28T07-56-59-161Z:trial-001",
        candidateId: "candidate-001",
        promptCandidateId: null,
        contextCandidateId: null,
        validationTrialId: null,
        holdoutTrialId: null,
        promotionSplit: "validation",
        status: "retained",
        decisionReason: ["test champion"],
        selectedAt: "2026-05-28T07:56:59.161Z",
        resolvedConfigPath: null,
      }

      const result = await saveBenchOptChampion(champion, rootDir)

      expect(result.championPath).toMatch(/exp-2026-05-28T07-56-59-161Z-trial-001\.json$/)
      expect(result.championPath).not.toContain(":")

      const storedChampion = JSON.parse(await readFile(result.championPath, "utf8")) as BenchOptChampionRecord
      expect(storedChampion.championTrialId).toBe(champion.championTrialId)

      const store = JSON.parse(await readFile(result.indexPath, "utf8")) as BenchOptStoreIndex
      expect(store.latestChampionId).toBe(champion.championTrialId)
      expect(store.champions[0]).toEqual({
        championId: champion.championTrialId,
        path: result.championPath,
        generatedAt: champion.selectedAt,
      })
    } finally {
      await rm(rootDir, { force: true, recursive: true })
    }
  })
})
