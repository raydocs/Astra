import path from "node:path"

import type { SubtitleFileFixture, SubtitleFileHarnessResult } from "../bench/scenarios/helpers/subtitle-file"

interface SubtitleFileHarnessModule {
  runSubtitleFileHarness: (fixtures: SubtitleFileFixture[]) => Promise<SubtitleFileHarnessResult>
}

async function withViteModule<T>(callback: (module: SubtitleFileHarnessModule) => Promise<T>) {
  const { createViteServer } = await import("vitest/node")
  const root = process.cwd()
  const server = await createViteServer({
    root,
    mode: "test",
    appType: "custom",
    server: { middlewareMode: true },
    optimizeDeps: {
      noDiscovery: true,
      entries: [],
    },
    resolve: {
      alias: {
        "@": path.resolve(root, "src"),
        "#imports": path.resolve(root, "test/mocks/imports.ts"),
      },
    },
  })

  try {
    const subtitleFileHarnessModule = await server.ssrLoadModule("/script/bench/scenarios/helpers/subtitle-file.ts")
    return await callback(subtitleFileHarnessModule as SubtitleFileHarnessModule)
  } finally {
    await server.close()
  }
}

export async function runSourceBackedSubtitleFileHarness(fixtures: SubtitleFileFixture[]): Promise<SubtitleFileHarnessResult> {
  return await withViteModule(async (subtitleFileHarnessModule) => {
    return await subtitleFileHarnessModule.runSubtitleFileHarness(fixtures)
  })
}
