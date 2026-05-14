import "fake-indexeddb/auto"

import { beforeEach, describe, expect, it } from "vitest"

import {
  buildLibraryDocumentSnapshotSyncPayloads,
  clearAllPersistedWorkspaces,
  DOCUMENT_SNAPSHOT_PAYLOAD_BUDGET,
  inspectWorkspaceStorageHealth,
  listLibraryDocumentSnapshots,
  listLibraryItems,
  openLibraryItem,
  readArticleWorkspace,
  readImportLibrary,
  readLibraryDocumentSnapshot,
  readPdfWorkspace,
  removeLibraryItem,
  renameLibraryItem,
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
    expect(window.localStorage.getItem(ARTICLE_WORKSPACE_STORAGE_KEY)).toEqual(JSON.stringify(snapshot))
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

    const library = await readImportLibrary()
    expect(library).toHaveLength(2)
    expect(library[0]).toMatchObject({
      source: "pdf",
      route: "/files/pdf",
      title: "guide.pdf",
      summary: "7 pages",
      detail: "Resume PDF workspace",
      importedAt: "2026-04-09T02:00:00.000Z",
      ownerMode: "local",
      syncState: "local_only",
    })
    expect(library[1]).toMatchObject({
      source: "article",
      route: "/articles",
      title: "Readable Import Title",
      summary: "example.com",
      detail: "Readable article import",
      importedAt: "2026-04-09T00:00:00.000Z",
      ownerMode: "local",
      syncState: "local_only",
    })
    expect(library[0]?.id).toBeTruthy()
    expect(library[1]?.id).toBeTruthy()
  })

  it("represents multiple local documents and can open, rename, and remove through library items", async () => {
    await savePdfWorkspace({
      fileName: "first.pdf",
      sizeLabel: "100 KB",
      pageCount: 1,
      selectedPageNumber: 1,
      pages: [{ pageNumber: 1, excerpt: "First", blocks: ["First"], blockCount: 1, wordCount: 1 }],
      importedAt: "2026-04-09T01:00:00.000Z",
    })
    await savePdfWorkspace({
      fileName: "second.pdf",
      sizeLabel: "200 KB",
      pageCount: 2,
      selectedPageNumber: 1,
      pages: [{ pageNumber: 1, excerpt: "Second", blocks: ["Second"], blockCount: 1, wordCount: 1 }],
      importedAt: "2026-04-09T03:00:00.000Z",
    })

    const pdfItems = await listLibraryItems("pdf")
    expect(pdfItems.map((item) => item.title)).toEqual(["second.pdf", "first.pdf"])

    const documentSnapshots = await listLibraryDocumentSnapshots(pdfItems.map((item) => item.id))
    expect(documentSnapshots.map((snapshot) => snapshot.libraryItemId).sort()).toEqual(pdfItems.map((item) => item.id).sort())
    expect(documentSnapshots.every((snapshot) => snapshot.extractedText.status === "available")).toBe(true)

    await renameLibraryItem(pdfItems[1].id, "Renamed first.pdf")
    await openLibraryItem(pdfItems[1].id)
    await expect(readPdfWorkspace()).resolves.toMatchObject({ fileName: "first.pdf" })

    await removeLibraryItem(pdfItems[0].id)
    const remaining = await listLibraryItems("pdf")
    expect(remaining.map((item) => item.title)).toEqual(["Renamed first.pdf"])
  })

  it("chunks sync payloads and records oversized extracted-text failures without storing bytes", async () => {
    const repeatedBlock = "A".repeat(DOCUMENT_SNAPSHOT_PAYLOAD_BUDGET.chunkThresholdChars + 128)
    await savePdfWorkspace({
      fileName: "chunked.pdf",
      sizeLabel: "1 MB",
      pageCount: 1,
      selectedPageNumber: 1,
      pages: [{ pageNumber: 1, excerpt: "Chunk", blocks: [repeatedBlock], blockCount: 1, wordCount: 1 }],
      importedAt: "2026-04-09T04:00:00.000Z",
    })
    const chunkedItem = (await listLibraryItems("pdf"))[0]
    const chunkedSnapshot = await readLibraryDocumentSnapshot(chunkedItem.id)
    expect(chunkedSnapshot?.extractedText.status).toBe("available")
    expect(chunkedSnapshot?.extractedText.chunkCount).toBeGreaterThan(1)
    expect(chunkedSnapshot?.byteAvailability.originalFileBytesSynced).toBe(false)
    const syncPayloads = buildLibraryDocumentSnapshotSyncPayloads(chunkedSnapshot!)
    expect(syncPayloads.manifest.chunkCount).toBeGreaterThan(1)
    expect(syncPayloads.chunks.every((chunk) => chunk.text.length <= DOCUMENT_SNAPSHOT_PAYLOAD_BUDGET.chunkSizeChars)).toBe(true)

    await savePdfWorkspace({
      fileName: "too-large.pdf",
      sizeLabel: "8 MB",
      pageCount: 1,
      selectedPageNumber: 1,
      pages: [{ pageNumber: 1, excerpt: "Too large", blocks: ["B".repeat(DOCUMENT_SNAPSHOT_PAYLOAD_BUDGET.maxExtractedTextChars + 1)], blockCount: 1, wordCount: 1 }],
      importedAt: "2026-04-09T05:00:00.000Z",
    })
    const oversizedItem = (await listLibraryItems("pdf"))[0]
    const oversizedSnapshot = await readLibraryDocumentSnapshot(oversizedItem.id)
    expect(oversizedSnapshot?.extractedText.status).toBe("oversized")
    expect(oversizedSnapshot?.snapshot).toBeNull()
    expect(oversizedSnapshot?.extractedText.failureCode).toBe("EXTRACTED_TEXT_TOO_LARGE")
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
