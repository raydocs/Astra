import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

import type {
  BenchOptChampionRecord,
  BenchOptExperimentRun,
  BenchOptStoreIndex,
  BenchOptSessionArtifactsResult,
} from "./types.ts"

function createEmptyStoreIndex(): BenchOptStoreIndex {
  return {
    schemaVersion: 2,
    latestExperimentId: null,
    latestChampionId: null,
    latestSessionId: null,
    latestCheckpointId: null,
    latestCompactionId: null,
    latestHandoffId: null,
    latestSessionArtifacts: null,
    experiments: [],
    champions: [],
    sessions: [],
    checkpoints: [],
    compactions: [],
    handoffs: [],
  }
}

function getStorePaths(rootDir: string) {
  const storeRoot = path.join(rootDir, "store")
  return {
    storeRoot,
    indexPath: path.join(storeRoot, "index.json"),
    experimentsRoot: path.join(storeRoot, "experiments"),
    championsRoot: path.join(storeRoot, "champions"),
    sessionsRoot: path.join(storeRoot, "sessions"),
    checkpointsRoot: path.join(storeRoot, "checkpoints"),
    compactionsRoot: path.join(storeRoot, "compactions"),
    handoffsRoot: path.join(storeRoot, "handoffs"),
  }
}

const UNSAFE_ARTIFACT_PATH_CHARS = /["*:<>?|\r\n]/g

export function safeBenchOptArtifactFileStem(id: string): string {
  const normalized = id.trim().replace(UNSAFE_ARTIFACT_PATH_CHARS, "-")
  return normalized.length > 0 ? normalized : "unnamed"
}

export async function loadBenchOptStore(rootDir: string): Promise<BenchOptStoreIndex> {
  const { indexPath } = getStorePaths(rootDir)

  try {
    const raw = await readFile(indexPath, "utf8")
    const parsed = JSON.parse(raw) as Partial<BenchOptStoreIndex>
    return {
      schemaVersion: parsed.schemaVersion === 2 ? 2 : 1,
      latestExperimentId: parsed.latestExperimentId ?? null,
      latestChampionId: parsed.latestChampionId ?? null,
      latestSessionId: parsed.latestSessionId ?? null,
      latestCheckpointId: parsed.latestCheckpointId ?? null,
      latestCompactionId: parsed.latestCompactionId ?? null,
      latestHandoffId: parsed.latestHandoffId ?? null,
      latestSessionArtifacts: parsed.latestSessionArtifacts ?? null,
      experiments: parsed.experiments ?? [],
      champions: parsed.champions ?? [],
      sessions: parsed.sessions ?? [],
      checkpoints: parsed.checkpoints ?? [],
      compactions: parsed.compactions ?? [],
      handoffs: parsed.handoffs ?? [],
    }
  } catch {
    return createEmptyStoreIndex()
  }
}

async function saveBenchOptStoreIndex(rootDir: string, store: BenchOptStoreIndex) {
  const { storeRoot, indexPath } = getStorePaths(rootDir)
  await mkdir(storeRoot, { recursive: true })
  await writeFile(indexPath, JSON.stringify(store, null, 2))
  return indexPath
}

export async function saveBenchOptExperiment(run: BenchOptExperimentRun, rootDir: string) {
  const { experimentsRoot } = getStorePaths(rootDir)
  await mkdir(experimentsRoot, { recursive: true })
  const experimentPath = path.join(experimentsRoot, `${safeBenchOptArtifactFileStem(run.experimentId)}.json`)
  await writeFile(experimentPath, JSON.stringify(run, null, 2))

  const store = await loadBenchOptStore(rootDir)
  store.latestExperimentId = run.experimentId
  store.experiments = [
    { experimentId: run.experimentId, path: experimentPath, generatedAt: run.generatedAt },
    ...store.experiments.filter((entry) => entry.experimentId !== run.experimentId),
  ]
  const indexPath = await saveBenchOptStoreIndex(rootDir, store)

  return {
    experimentPath,
    indexPath,
  }
}

export async function saveBenchOptChampion(record: BenchOptChampionRecord, rootDir: string) {
  const { championsRoot } = getStorePaths(rootDir)
  await mkdir(championsRoot, { recursive: true })
  const championPath = path.join(championsRoot, `${safeBenchOptArtifactFileStem(record.championTrialId)}.json`)
  await writeFile(championPath, JSON.stringify(record, null, 2))

  const store = await loadBenchOptStore(rootDir)
  store.latestChampionId = record.championTrialId
  store.champions = [
    { championId: record.championTrialId, path: championPath, generatedAt: record.selectedAt },
    ...store.champions.filter((entry) => entry.championId !== record.championTrialId),
  ]
  const indexPath = await saveBenchOptStoreIndex(rootDir, store)

  return {
    championPath,
    indexPath,
  }
}

export async function saveBenchOptSessionArtifacts(session: BenchOptSessionArtifactsResult, rootDir: string) {
  const { sessionsRoot, checkpointsRoot, compactionsRoot, handoffsRoot } = getStorePaths(rootDir)
  await mkdir(sessionsRoot, { recursive: true })
  await mkdir(checkpointsRoot, { recursive: true })
  await mkdir(compactionsRoot, { recursive: true })
  await mkdir(handoffsRoot, { recursive: true })

  const sessionPath = path.join(sessionsRoot, `${safeBenchOptArtifactFileStem(session.state.sessionId)}.json`)
  const checkpointPath = path.join(checkpointsRoot, `${safeBenchOptArtifactFileStem(session.checkpoint.checkpointId)}.json`)
  await writeFile(sessionPath, JSON.stringify(session.state, null, 2))
  await writeFile(checkpointPath, JSON.stringify(session.checkpoint, null, 2))

  const compactionPath = session.compaction
    ? path.join(compactionsRoot, `${safeBenchOptArtifactFileStem(session.compaction.compactionId)}.json`)
    : null
  if (session.compaction && compactionPath) {
    await writeFile(compactionPath, JSON.stringify(session.compaction, null, 2))
  }

  const handoffPath = session.handoff
    ? path.join(handoffsRoot, `${safeBenchOptArtifactFileStem(session.handoff.handoffId)}.json`)
    : null
  if (session.handoff && handoffPath) {
    await writeFile(handoffPath, JSON.stringify(session.handoff, null, 2))
  }

  const store = await loadBenchOptStore(rootDir)
  store.latestSessionId = session.state.sessionId
  store.latestCheckpointId = session.checkpoint.checkpointId
  store.latestCompactionId = session.compaction?.compactionId ?? store.latestCompactionId
  store.latestHandoffId = session.handoff?.handoffId ?? store.latestHandoffId
  store.latestSessionArtifacts = {
    sessionId: session.state.sessionId,
    sessionPath,
    checkpointId: session.checkpoint.checkpointId,
    checkpointPath,
    compactionId: session.compaction?.compactionId ?? null,
    compactionPath,
    handoffId: session.handoff?.handoffId ?? null,
    handoffPath,
    runId: session.state.runId,
    generatedAt: session.state.updatedAt,
  }
  store.sessions = [
    { sessionId: session.state.sessionId, path: sessionPath, generatedAt: session.state.updatedAt },
    ...store.sessions.filter((entry) => entry.sessionId !== session.state.sessionId),
  ]
  store.checkpoints = [
    { checkpointId: session.checkpoint.checkpointId, path: checkpointPath, generatedAt: session.checkpoint.createdAt },
    ...store.checkpoints.filter((entry) => entry.checkpointId !== session.checkpoint.checkpointId),
  ]
  if (session.compaction && compactionPath) {
    store.compactions = [
      { compactionId: session.compaction.compactionId, path: compactionPath, generatedAt: session.compaction.createdAt },
      ...store.compactions.filter((entry) => entry.compactionId !== session.compaction!.compactionId),
    ]
  }
  if (session.handoff && handoffPath) {
    store.handoffs = [
      { handoffId: session.handoff.handoffId, path: handoffPath, generatedAt: session.handoff.createdAt },
      ...store.handoffs.filter((entry) => entry.handoffId !== session.handoff!.handoffId),
    ]
  }

  const indexPath = await saveBenchOptStoreIndex(rootDir, store)
  return {
    sessionPath,
    checkpointPath,
    compactionPath,
    handoffPath,
    indexPath,
  }
}
