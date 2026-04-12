import "fake-indexeddb/auto"

import { beforeEach, describe, expect, it } from "vitest"

import {
  clearAllPersistedWorkspaces,
  inspectWorkspaceStorageHealth,
  readArticleWorkspace,
  readImportLibrary,
  repairWorkspaceStorageCorruption,
  resetWorkspaceStorageLifecycle,
  saveArticleWorkspace,
  savePdfWorkspace,
  type ArticleWorkspaceSnapshot,
} from "./workspace-store"

const ARTICLE_WORKSPACE_STORAGE_KEY = "astra.web.article-workspace.v1"

function createArticleSnapshot(): ArticleWorkspaceSnapshot {
  return {
    url: "https://example.com/readable",
    title: "Readable Import Title",
    hostname: "example.com",
    byline: "Astra Writer",
    scope: "article",
    summary: "Short readable summary",
    blocks: [
      "First readable paragraph.",
      "Second readable paragraph.",
    ],
    importedAt: "2026-04-09T00:00:00.000Z",
  }
}

describe("workspace-store IndexedDB persistence", () => {
  beforeEach(async () => {
    const storage = new Map<string, string>()
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value)
        },
        removeItem: (key: string) => {
          storage.delete(key)
        },
        clear: () => {
          storage.clear()
        },
      },
    })
    window.localStorage.clear()
    await clearAllPersistedWorkspaces()
  })

  it("persists large article workspaces in IndexedDB instead of localStorage", async () => {
    const snapshot = createArticleSnapshot()

    await saveArticleWorkspace(snapshot)

    expect(window.localStorage.getItem(ARTICLE_WORKSPACE_STORAGE_KEY)).toBeNull()
    await expect(readArticleWorkspace()).resolves.toEqual(snapshot)
  })

  it("migrates legacy localStorage article workspaces into IndexedDB on read", async () => {
    const snapshot = createArticleSnapshot()
    window.localStorage.setItem(ARTICLE_WORKSPACE_STORAGE_KEY, JSON.stringify(snapshot))

    await expect(readArticleWorkspace()).resolves.toEqual(snapshot)
    expect(window.localStorage.getItem(ARTICLE_WORKSPACE_STORAGE_KEY)).toBeNull()
    await expect(readArticleWorkspace()).resolves.toEqual(snapshot)
  })

  it("derives a sorted import library from saved workspaces", async () => {
    await saveArticleWorkspace(createArticleSnapshot())
    await savePdfWorkspace({
      fileName: "guide.pdf",
      sizeLabel: "120 KB",
      pageCount: 7,
      selectedPageNumber: 1,
      pages: [{ pageNumber: 1, excerpt: "Intro", blocks: ["Intro"], blockCount: 1, wordCount: 1 }],
      importedAt: "2026-04-09T02:00:00.000Z",
    })

    await expect(readImportLibrary()).resolves.toEqual([
      {
        source: "pdf",
        route: "/files/pdf",
        title: "guide.pdf",
        summary: "7 pages",
        detail: "Resume PDF workspace",
        importedAt: "2026-04-09T02:00:00.000Z",
      },
      {
        source: "article",
        route: "/articles",
        title: "Readable Import Title",
        summary: "example.com",
        detail: "Readable article import",
        importedAt: "2026-04-09T00:00:00.000Z",
      },
    ])
  })

  it("inspects IndexedDB and legacy health and flags corrupted records", async () => {
    await saveArticleWorkspace(createArticleSnapshot())
    window.localStorage.setItem("astra.web.pdf-workspace.v1", "{not-json")

    const health = await inspectWorkspaceStorageHealth()
    expect(health.indexedDbReachable).toBe(true)
    expect(health.corruptedKeys).toContain("pdf")
    expect(health.records.find((record) => record.key === "article")?.indexedDbState).toBe("healthy")
    expect(health.records.find((record) => record.key === "pdf")?.legacyState).toBe("corrupted")
  })

  it("repairs corrupted legacy workspace snapshots", async () => {
    window.localStorage.setItem("astra.web.article-workspace.v1", "{not-json")

    const report = await repairWorkspaceStorageCorruption()
    expect(report.clearedLegacyKeys).toContain("astra.web.article-workspace.v1")
    expect(window.localStorage.getItem("astra.web.article-workspace.v1")).toBeNull()
  })

  it("resets workspace lifecycle storage across IndexedDB and localStorage", async () => {
    await saveArticleWorkspace(createArticleSnapshot())
    window.localStorage.setItem("astra.web.recent-imports.v1", "[]")

    await resetWorkspaceStorageLifecycle()

    const health = await inspectWorkspaceStorageHealth()
    expect(health.indexedDbRecordCount).toBe(0)
    expect(window.localStorage.getItem("astra.web.recent-imports.v1")).toBeNull()
    await expect(readArticleWorkspace()).resolves.toBeNull()
  })
})
