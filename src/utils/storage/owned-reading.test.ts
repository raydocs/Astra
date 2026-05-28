import { beforeEach, describe, expect, it } from "vitest"

import { createMockBrowser, setMockBrowser } from "../../../test/utils/mockBrowser"
import { READING_HISTORY_STORAGE_KEY } from "./reading-history"
import { saveConfig } from "./config"
import { excludeHostnameFromPersonalization } from "./learning-profile"
import {
  OWNED_READING_STORAGE_KEY,
  applyOwnedReadingSyncMutations,
  buildOwnedReadingArticleIdentity,
  buildOwnedReadingLocalFileIdentity,
  buildOwnedReadingLocalUri,
  buildOwnedReadingSyncRecordMap,
  buildOwnedReadingRemotePdfIdentity,
  buildOwnedReadingResumeTarget,
  buildSignedOwnedReadingThemePackPackage,
  buildOwnedReadingThemePackExport,
  buildOwnedReadingThemePacks,
  buildOwnedReadingVocabularySourceLink,
  countOwnedReadingItemsByView,
  deriveOwnedReadingArticleUrl,
  deriveOwnedReadingIdentityFromItem,
  describeOwnedReadingProgress,
  describeOwnedReadingResumeBehavior,
  filterOwnedReadingItemsByView,
  importOwnedReadingThemePackPackage,
  previewOwnedReadingThemePackPackage,
  previewOwnedReadingThemePackPackagePayload,
  matchOwnedReadingItemForVocabularyEntry,
  listOwnedReadingItems,
  parseSignedOwnedReadingThemePackPackage,
  readSyncSafeOwnedReadingItems,
  replaceOwnedReadingItems,
  removeOwnedReadingItem,
  setOwnedReadingStatus,
  setOwnedReadingUserControl,
  syncRecentReadingHistoryToOwnedQueue,
  upsertOwnedArticleFromUrl,
  upsertOwnedEpubFromImport,
  upsertOwnedPdfFromFileName,
  upsertOwnedPdfFromRemoteUrl,
  upsertOwnedSubtitleFileFromImport,
} from "./owned-reading"

describe("owned reading storage", () => {
  beforeEach(() => {
    setMockBrowser(createMockBrowser())
  })

  it("builds stable identities for each supported source family", () => {
    expect(buildOwnedReadingArticleIdentity("https://example.com/a?q=1#frag")).toEqual({
      sourceType: "article",
      dedupeKey: "https://example.com/a",
      id: "or_article_https%3A%2F%2Fexample.com%2Fa",
      sourceUrl: "https://example.com/a",
      localUri: null,
      readingHistoryRecordId: "https://example.com/a",
      studyProgressRecordId: "https://example.com/a",
    })

    expect(buildOwnedReadingRemotePdfIdentity("https://cdn.example/doc.pdf?download=1")).toEqual({
      sourceType: "pdf",
      dedupeKey: "https://cdn.example/doc.pdf",
      id: "or_pdf_https%3A%2F%2Fcdn.example%2Fdoc.pdf",
      sourceUrl: "https://cdn.example/doc.pdf",
      localUri: null,
      readingHistoryRecordId: null,
      studyProgressRecordId: "https://cdn.example/doc.pdf",
    })

    expect(buildOwnedReadingLocalUri("subtitle-file", "a.srt")).toBe("astra-local://subtitle/a.srt")
    expect(buildOwnedReadingLocalFileIdentity("epub", "book.epub")).toEqual({
      sourceType: "epub",
      dedupeKey: "astra-local://epub/book.epub",
      id: "or_epub_astra-local%3A%2F%2Fepub%2Fbook.epub",
      sourceUrl: null,
      localUri: "astra-local://epub/book.epub",
      readingHistoryRecordId: null,
      studyProgressRecordId: null,
    })
  })

  it("persists article by sanitized URL and preserves deterministic id on upsert", async () => {
    const first = await upsertOwnedArticleFromUrl({
      url: "https://example.com/a?q=1#h",
      title: "Article A",
      status: "saved",
    })
    const second = await upsertOwnedArticleFromUrl({
      url: "https://example.com/a#other",
      title: "Article A updated",
      status: "saved",
    })
    expect(first.id).toBe("or_article_https%3A%2F%2Fexample.com%2Fa")
    expect(second.id).toBe(first.id)
    expect(second.title).toBe("Article A updated")
    expect(second.sourceUrl).toBe("https://example.com/a")
    const list = await listOwnedReadingItems()
    expect(list).toHaveLength(1)
  })

  it("reduces automatic article capture metadata under Privacy Mode", async () => {
    await saveConfig({ privacyMode: true })

    const item = await upsertOwnedArticleFromUrl({
      url: "https://private.example/sensitive/path?token=secret#section",
      title: "Sensitive Full Title",
      status: "saved",
    })

    expect(item).toMatchObject({
      id: "or_article_https%3A%2F%2Fprivate.example%2F",
      title: "Private page",
      sourceUrl: "https://private.example/",
      readingHistoryRecordId: "https://private.example/",
      studyProgressRecordId: "https://private.example/",
      userControl: { syncEnabled: false, excludedFromDigest: true, privacyModeAtCapture: true },
    })
    const list = await listOwnedReadingItems()
    expect(list).toHaveLength(1)
    expect(JSON.stringify(list[0])).not.toContain("Sensitive Full Title")
    expect(JSON.stringify(list[0])).not.toContain("sensitive/path")
  })

  it("suppresses automatic article capture for excluded hosts", async () => {
    await excludeHostnameFromPersonalization("private.example")

    const item = await upsertOwnedArticleFromUrl({
      url: "https://private.example/sensitive/path",
      title: "Sensitive Full Title",
      status: "saved",
    })

    expect(item).toMatchObject({
      title: "Sensitive Full Title",
      sourceUrl: "https://private.example/sensitive/path",
    })
    expect(await listOwnedReadingItems()).toEqual([])
  })

  it("stores source-level user controls and omits disabled sources from sync-safe records", async () => {
    const item = await upsertOwnedArticleFromUrl({
      url: "https://example.com/source-controls",
      title: "Source controls",
      status: "saved",
    })

    expect((await listOwnedReadingItems())[0]?.userControl).toMatchObject({
      syncEnabled: true,
      excludedFromDigest: false,
      privacyModeAtCapture: false,
    })

    await setOwnedReadingUserControl(item.id, {
      syncEnabled: false,
      excludedFromDigest: true,
    })

    const [updated] = await listOwnedReadingItems()
    expect(updated?.userControl).toMatchObject({
      syncEnabled: false,
      excludedFromDigest: true,
    })
    expect(await readSyncSafeOwnedReadingItems()).toEqual([])
  })

  it("keeps in_progress when re-upserting as saved", async () => {
    const item = await upsertOwnedArticleFromUrl({
      url: "https://example.com/p",
      title: "P",
      status: "saved",
    })
    await setOwnedReadingStatus(item.id, "in_progress")
    await upsertOwnedArticleFromUrl({
      url: "https://example.com/p",
      title: "P",
      status: "saved",
    })
    const list = await listOwnedReadingItems()
    expect(list[0]?.status).toBe("in_progress")
  })

  it("preserves an existing legacy article row id when the canonical identity matches", async () => {
    setMockBrowser(createMockBrowser({
      [OWNED_READING_STORAGE_KEY]: {
        version: 1,
        items: [{
          id: "legacy-article-1",
          sourceType: "article",
          title: "Legacy article",
          sourceUrl: "https://example.com/legacy",
          openedAt: 10,
          status: "saved",
          readingHistoryRecordId: "https://example.com/legacy",
          studyProgressRecordId: "https://example.com/legacy",
        }],
      },
    }))

    const item = await upsertOwnedArticleFromUrl({
      url: "https://example.com/legacy?utm=1#frag",
      title: "Legacy article updated",
      status: "saved",
    })

    expect(item.id).toBe("legacy-article-1")
    expect(item.sourceUrl).toBe("https://example.com/legacy")
    const list = await listOwnedReadingItems()
    expect(list).toHaveLength(1)
    expect(list[0]?.title).toBe("Legacy article updated")
  })

  it("derives identities from stored rows", () => {
    expect(deriveOwnedReadingIdentityFromItem({
      sourceType: "article",
      sourceUrl: null,
      localUri: null,
      readingHistoryRecordId: "https://example.com/story",
      studyProgressRecordId: null,
    })?.id).toBe("or_article_https%3A%2F%2Fexample.com%2Fstory")

    expect(deriveOwnedReadingIdentityFromItem({
      sourceType: "pdf",
      sourceUrl: "https://cdn.example/doc.pdf?download=1",
      localUri: null,
      readingHistoryRecordId: null,
      studyProgressRecordId: "https://cdn.example/doc.pdf",
    })?.id).toBe("or_pdf_https%3A%2F%2Fcdn.example%2Fdoc.pdf")

    expect(deriveOwnedReadingIdentityFromItem({
      sourceType: "subtitle-file",
      sourceUrl: null,
      localUri: "astra-local://subtitle/a.srt",
      readingHistoryRecordId: null,
      studyProgressRecordId: null,
    })?.id).toBe("or_subtitle-file_astra-local%3A%2F%2Fsubtitle%2Fa.srt")
  })

  it("derives the canonical reopen URL for article rows", () => {
    expect(deriveOwnedReadingArticleUrl({
      sourceType: "article",
      readingHistoryRecordId: "https://example.com/story",
      sourceUrl: null,
      studyProgressRecordId: null,
    })).toBe("https://example.com/story")

    expect(deriveOwnedReadingArticleUrl({
      sourceType: "article",
      readingHistoryRecordId: null,
      sourceUrl: "https://example.com/story?utm=1#frag",
      studyProgressRecordId: null,
    })).toBe("https://example.com/story")

    expect(deriveOwnedReadingArticleUrl({
      sourceType: "pdf",
      readingHistoryRecordId: "https://example.com/story",
      sourceUrl: "https://example.com/story",
      studyProgressRecordId: "https://example.com/story",
    })).toBeNull()
  })

  it("filters queue views so Recent hides archived rows while Saved and In progress match explicit status", () => {
    const items = [
      {
        id: "recent-article",
        sourceType: "article",
        title: "Recent article",
        sourceUrl: "https://example.com/recent",
        openedAt: 50,
        status: "saved",
        readingHistoryRecordId: "https://example.com/recent",
        studyProgressRecordId: "https://example.com/recent",
      },
      {
        id: "in-progress-pdf",
        sourceType: "pdf",
        title: "Working PDF",
        sourceUrl: "https://cdn.example/paper.pdf",
        openedAt: 40,
        status: "in_progress",
        readingHistoryRecordId: null,
        studyProgressRecordId: "https://cdn.example/paper.pdf",
      },
      {
        id: "archived-epub",
        sourceType: "epub",
        title: "Archived EPUB",
        sourceUrl: null,
        localUri: "astra-local://epub/book.epub",
        openedAt: 30,
        status: "archived",
        readingHistoryRecordId: null,
        studyProgressRecordId: null,
      },
    ] as const

    expect(filterOwnedReadingItemsByView(items, "recent").map((item) => item.id)).toEqual([
      "recent-article",
      "in-progress-pdf",
    ])
    expect(filterOwnedReadingItemsByView(items, "saved").map((item) => item.id)).toEqual(["recent-article"])
    expect(filterOwnedReadingItemsByView(items, "in_progress").map((item) => item.id)).toEqual(["in-progress-pdf"])
    expect(countOwnedReadingItemsByView(items, "recent")).toBe(2)
    expect(countOwnedReadingItemsByView(items, "saved")).toBe(1)
    expect(countOwnedReadingItemsByView(items, "in_progress")).toBe(1)
  })

  it("builds deterministic local theme-pack exports from non-archived queue assets", () => {
    const items = [
      {
        id: "or_article_beta",
        sourceType: "article",
        title: "Beta story",
        sourceUrl: "https://news.example/beta?utm=1",
        openedAt: 300,
        status: "saved",
        readingHistoryRecordId: "https://news.example/beta",
        studyProgressRecordId: "https://news.example/beta",
      },
      {
        id: "or_pdf_manual",
        sourceType: "pdf",
        title: "Manual PDF",
        sourceUrl: "https://docs.example/manual.pdf?download=1",
        openedAt: 200,
        updatedAt: 250,
        status: "in_progress",
        progress: { fraction: 0.5 },
        readingHistoryRecordId: null,
        studyProgressRecordId: "https://docs.example/manual.pdf",
      },
      {
        id: "or_article_alpha",
        sourceType: "article",
        title: "Alpha story",
        sourceUrl: "https://news.example/alpha",
        openedAt: 100,
        status: "saved",
        readingHistoryRecordId: "https://news.example/alpha",
        studyProgressRecordId: "https://news.example/alpha",
      },
      {
        id: "or_epub_archived",
        sourceType: "epub",
        title: "Archived book",
        sourceUrl: null,
        localUri: "astra-local://epub/archived.epub",
        openedAt: 400,
        status: "archived",
        readingHistoryRecordId: null,
        studyProgressRecordId: null,
      },
    ] as const

    const packs = buildOwnedReadingThemePacks(items)
    expect(packs.map((pack) => [pack.id, pack.assetCount])).toEqual([
      ["theme_article-news-example", 2],
      ["theme_pdf-docs-example", 1],
    ])
    expect(packs[0]?.assets.map((asset) => asset.id)).toEqual([
      "or_article_alpha",
      "or_article_beta",
    ])

    const generatedAt = "2026-04-29T00:00:00.000Z"
    const first = buildOwnedReadingThemePackExport(items, { generatedAt })
    const second = buildOwnedReadingThemePackExport([...items].reverse(), { generatedAt })

    expect(first).toEqual(second)
    expect(first).toEqual(expect.objectContaining({
      schema: "astra-owned-reading-theme-packs.v1",
      generatedAt,
      assetCount: 3,
      themePackCount: 2,
    }))
    expect(first.themePacks[1]?.assets[0]).toEqual(expect.objectContaining({
      id: "or_pdf_manual",
      sourceType: "pdf",
      sourceTypeLabel: "PDF",
      updatedAt: 250,
      progress: { fraction: 0.5 },
      sourceUrl: "https://docs.example/manual.pdf?download=1",
    }))
    expect(JSON.stringify(first)).not.toMatch(/bytes|blob|handle|objectURL|arrayBuffer/i)
  })

  it("previews signed package reading conflicts without mutating local storage", async () => {
    await upsertOwnedArticleFromUrl({
      url: "https://example.com/article",
      title: "Local older article",
      status: "saved",
    })
    await upsertOwnedPdfFromRemoteUrl({
      url: "https://docs.example/guide.pdf",
      title: "Local newer PDF",
      status: "saved",
    })

    const current = await listOwnedReadingItems()
    const article = current.find((item) => item.sourceType === "article")!
    const pdf = current.find((item) => item.sourceType === "pdf")!
    await replaceOwnedReadingItems([
      { ...article, openedAt: 100, updatedAt: 100, title: "Local older article" },
      { ...pdf, openedAt: 400, updatedAt: 400, title: "Local newer PDF" },
    ])

    const signed = await buildSignedOwnedReadingThemePackPackage([
      { ...article, openedAt: 200, updatedAt: 200, title: "Incoming article" },
      { ...pdf, openedAt: 300, updatedAt: 300, title: "Incoming older PDF" },
      {
        id: "or_article_new",
        sourceType: "article",
        title: "Incoming new article",
        sourceUrl: "https://example.com/new",
        openedAt: 500,
        updatedAt: 500,
        status: "saved",
        readingHistoryRecordId: "https://example.com/new",
        studyProgressRecordId: "https://example.com/new",
      },
    ], [], { generatedAt: "2026-04-29T00:00:00.000Z" })

    const preview = await previewOwnedReadingThemePackPackagePayload(signed.payload)
    expect(preview).toEqual(expect.objectContaining({
      totalCount: 3,
      importedCount: 2,
      skippedCount: 1,
      newCount: 1,
      updatedCount: 1,
      rollback: { restoreCount: 1, removeCount: 1 },
      verified: true,
    }))
    expect(preview.conflicts.map((conflict) => [conflict.id, conflict.action]).sort()).toEqual([
      [article.id, "update"],
      [pdf.id, "skip"],
    ].sort())
    expect((await listOwnedReadingItems()).map((item) => item.title).sort()).toEqual([
      "Local newer PDF",
      "Local older article",
    ])

    await expect(previewOwnedReadingThemePackPackage(JSON.stringify(signed))).resolves.toEqual(preview)
  })

  it("builds signed v3 theme-pack packages and rejects tampered imports", async () => {
    const items = [
      {
        id: "or_article_example",
        sourceType: "article",
        title: "Example article",
        sourceUrl: "https://example.com/article",
        openedAt: 100,
        updatedAt: 110,
        status: "saved",
        readingHistoryRecordId: "https://example.com/article",
        studyProgressRecordId: "https://example.com/article",
      },
    ] as const
    const vocabularyEntries = [
      {
        id: "entry-linked",
        text: "ephemeral",
        translation: "短暂的",
        url: "https://example.com/article",
        hostname: "example.com",
        savedAt: 120,
        sourceContext: {
          surface: "popup_deep_read",
          pageTitle: "Example article",
          pageUrl: "https://example.com/article",
          hostname: "example.com",
          ownedReadingItemId: "or_article_example",
          ownedReadingSourceType: "article",
          ownedReadingTitle: "Example article",
        },
      },
      {
        id: "entry-unlinked",
        text: "outside",
        savedAt: 130,
      },
    ] as const

    const signed = await buildSignedOwnedReadingThemePackPackage(items, vocabularyEntries, {
      generatedAt: "2026-04-29T00:00:00.000Z",
    })

    expect(signed).toEqual(expect.objectContaining({
      schema: "astra-owned-reading-theme-pack-package.v3",
      generatedAt: "2026-04-29T00:00:00.000Z",
      signature: {
        algorithm: "SHA-256",
        value: expect.stringMatching(/^[a-f0-9]{64}$/),
      },
    }))
    expect(signed.payload.vocabularyEntries.map((entry) => entry.id)).toEqual(["entry-linked"])

    const result = await importOwnedReadingThemePackPackage(JSON.stringify(signed))
    expect(result).toEqual({ importedCount: 1, skippedCount: 0, verified: true })
    expect((await listOwnedReadingItems()).map((item) => item.id)).toEqual(["or_article_example"])

    const tampered = parseSignedOwnedReadingThemePackPackage(JSON.stringify(signed))
    tampered.payload.ownedReading.themePacks[0]!.assets[0]!.title = "Tampered"
    await expect(importOwnedReadingThemePackPackage(tampered)).rejects.toThrow(/signature verification failed/i)
  })

  it("builds resume targets for direct and reader-handoff queue reopen paths", () => {
    expect(buildOwnedReadingResumeTarget({
      id: "article-1",
      sourceType: "article",
      title: "Story",
      sourceUrl: null,
      openedAt: 1,
      status: "saved",
      readingHistoryRecordId: "https://example.com/story?utm=1",
      studyProgressRecordId: "https://example.com/story",
    })?.url).toBe("https://example.com/story")

    expect(buildOwnedReadingResumeTarget({
      id: "pdf-1",
      sourceType: "pdf",
      title: "Paper",
      sourceUrl: "https://cdn.example/paper.pdf",
      openedAt: 1,
      status: "saved",
      readingHistoryRecordId: null,
      studyProgressRecordId: "https://cdn.example/paper.pdf",
    })).toEqual({
      url: "/pdf-reader.html?url=https%3A%2F%2Fcdn.example%2Fpaper.pdf",
      sourceType: "pdf",
      mode: "direct",
      requiresFileSelection: false,
    })

    expect(buildOwnedReadingResumeTarget({
      id: "epub-1",
      sourceType: "epub",
      title: "Book",
      sourceUrl: null,
      localUri: "astra-local://epub/book.epub",
      reopenHint: "Choose the same file in the ePub reader: book.epub",
      openedAt: 1,
      status: "saved",
      readingHistoryRecordId: null,
      studyProgressRecordId: null,
    })).toEqual({
      url: "/epub-reader.html?reopenHint=Choose+the+same+file+in+the+ePub+reader%3A+book.epub",
      sourceType: "epub",
      mode: "reader_handoff",
      requiresFileSelection: true,
    })

    expect(describeOwnedReadingResumeBehavior({
      id: "subtitle-1",
      sourceType: "subtitle-file",
      title: "Clip",
      sourceUrl: null,
      localUri: "astra-local://subtitle/clip.srt",
      reopenHint: "Open the subtitle reader and choose the same file: clip.srt",
      openedAt: 1,
      status: "saved",
      readingHistoryRecordId: null,
      studyProgressRecordId: null,
    })).toBe("Opens the subtitle reader and prompts for the same file again.")

    const unavailableLocalPdf = {
      id: "pdf-missing-context",
      sourceType: "pdf" as const,
      title: "Missing local PDF",
      sourceUrl: null,
      openedAt: 1,
      status: "saved" as const,
      readingHistoryRecordId: null,
      studyProgressRecordId: null,
    }
    expect(buildOwnedReadingResumeTarget(unavailableLocalPdf)).toBeNull()
    expect(describeOwnedReadingResumeBehavior(unavailableLocalPdf)).toBe("Resume unavailable for this item.")
  })

  it("builds vocabulary source links and matches vocabulary entries back to owned reading rows", () => {
    const items = [
      {
        id: "or_article_story",
        sourceType: "article",
        title: "Story",
        sourceUrl: "https://example.com/story",
        openedAt: 10,
        status: "saved",
        readingHistoryRecordId: "https://example.com/story",
        studyProgressRecordId: "https://example.com/story",
      },
      {
        id: "or_subtitle_clip",
        sourceType: "subtitle-file",
        title: "clip.srt · SRT · 12 items",
        sourceUrl: null,
        localUri: "astra-local://subtitle/clip.srt",
        openedAt: 9,
        status: "saved",
        readingHistoryRecordId: null,
        studyProgressRecordId: null,
      },
    ] as const

    expect(buildOwnedReadingVocabularySourceLink(items[0])).toEqual({
      ownedReadingItemId: "or_article_story",
      ownedReadingSourceType: "article",
      ownedReadingTitle: "Story",
      studyProgressRecordId: "https://example.com/story",
    })

    expect(matchOwnedReadingItemForVocabularyEntry(items, {
      url: "https://example.com/story?from=popup",
      sourceContext: {
        surface: "popup_deep_read",
        pageUrl: "https://example.com/story?utm=1",
      },
    })?.id).toBe("or_article_story")

    expect(matchOwnedReadingItemForVocabularyEntry(items, {
      url: "chrome-extension://abc/subtitle-reader.html",
      sourceContext: {
        surface: "subtitle_reader",
        ownedReadingItemId: "or_subtitle_clip",
        ownedReadingSourceType: "subtitle-file",
        ownedReadingTitle: "clip.srt · SRT · 12 items",
      },
    })?.id).toBe("or_subtitle_clip")

    expect(matchOwnedReadingItemForVocabularyEntry(items, {
      url: "astra-local://subtitle/clip.srt",
      sourceContext: {
        surface: "subtitle_reader",
        pageUrl: "astra-local://subtitle/clip.srt",
        ownedReadingSourceType: "subtitle-file",
      },
    })?.id).toBe("or_subtitle_clip")
  })

  it("describes retained local reader progress for queue continuity", () => {
    expect(describeOwnedReadingProgress({
      id: "or_pdf1",
      sourceType: "pdf",
      title: "Paper",
      sourceUrl: "https://cdn.example/paper.pdf",
      openedAt: 1,
      status: "saved",
      progress: { fraction: 1 },
      readingHistoryRecordId: null,
      studyProgressRecordId: "https://cdn.example/paper.pdf",
    })).toBe("Progress: 100%")

    expect(describeOwnedReadingProgress({
      id: "or_epub1",
      sourceType: "epub",
      title: "Book",
      sourceUrl: null,
      localUri: "astra-local://epub/book.epub",
      openedAt: 1,
      status: "saved",
      progress: { chapterId: "chapter-2" },
      readingHistoryRecordId: null,
      studyProgressRecordId: null,
    })).toBe("Last chapter: chapter-2")
  })

  it("syncRecentReadingHistoryToOwnedQueue merges history without dropping other types", async () => {
    setMockBrowser(createMockBrowser({
      [READING_HISTORY_STORAGE_KEY]: [
        {
          id: "https://news.example/x",
          url: "https://news.example/x",
          hostname: "news.example",
          title: "News X",
          wordsTranslated: 2,
          visitedAt: 5000,
        },
      ],
    }))

    await upsertOwnedArticleFromUrl({
      url: "https://other.example/o",
      title: "Other",
      status: "saved",
    })

    await syncRecentReadingHistoryToOwnedQueue(10)

    const list = await listOwnedReadingItems()
    const titles = new Set(list.map((r) => r.title))
    expect(titles.has("News X")).toBe(true)
    expect(titles.has("Other")).toBe(true)
  })

  it("syncRecentReadingHistoryToOwnedQueue reduces privacy-mode history rows before owned capture", async () => {
    await saveConfig({ privacyMode: true })
    setMockBrowser(createMockBrowser({
      [READING_HISTORY_STORAGE_KEY]: [{
        id: "https://private.example/sensitive/path",
        url: "https://private.example/sensitive/path",
        hostname: "private.example",
        title: "Sensitive Full Title",
        wordsTranslated: 10,
        visitedAt: 100,
      }],
    }))
    await saveConfig({ privacyMode: true })

    await syncRecentReadingHistoryToOwnedQueue(10)

    const list = await listOwnedReadingItems()
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({
      title: "Private page",
      sourceUrl: "https://private.example/",
      userControl: { syncEnabled: false, excludedFromDigest: true, privacyModeAtCapture: true },
    })
    expect(JSON.stringify(list[0])).not.toContain("sensitive/path")
    expect(JSON.stringify(list[0])).not.toContain("Sensitive Full Title")
  })

  it("removeOwnedReadingItem deletes row", async () => {
    const item = await upsertOwnedArticleFromUrl({
      url: "https://example.com/z",
      title: "Z",
      status: "saved",
    })
    await removeOwnedReadingItem(item.id)
    expect(await listOwnedReadingItems()).toHaveLength(0)
  })

  it("upsertOwnedPdfFromRemoteUrl uses canonical URL identity for remote pdfs", async () => {
    const item = await upsertOwnedPdfFromRemoteUrl({
      url: "https://x.test/doc.pdf?q=1",
      title: "doc.pdf",
      pageCount: 3,
    })
    expect(item.sourceType).toBe("pdf")
    expect(item.id).toBe("or_pdf_https%3A%2F%2Fx.test%2Fdoc.pdf")
    expect(item.sourceUrl).toBe("https://x.test/doc.pdf")
    expect(item.studyProgressRecordId).toBe("https://x.test/doc.pdf")
    expect(item.reopenHint).toBeUndefined()
  })

  it("upsertOwnedPdfFromFileName maps local pdfs to the shared local-file identity model", async () => {
    const item = await upsertOwnedPdfFromFileName({ fileName: "a.pdf" })
    expect(item.id).toBe("or_pdf_astra-local%3A%2F%2Fpdf%2Fa.pdf")
    expect(item.localUri).toBe("astra-local://pdf/a.pdf")
    expect(item.reopenHint).toContain("a.pdf")
  })

  it("preserves an existing legacy local-file row id when the local identity matches", async () => {
    setMockBrowser(createMockBrowser({
      [OWNED_READING_STORAGE_KEY]: {
        version: 1,
        items: [{
          id: "legacy-pdf-1",
          sourceType: "pdf",
          title: "legacy.pdf",
          sourceUrl: null,
          localUri: "astra-local://pdf/legacy.pdf",
          reopenHint: "Choose the same file in the PDF reader: legacy.pdf",
          openedAt: 5,
          status: "saved",
          studyProgressRecordId: null,
        }],
      },
    }))

    const item = await upsertOwnedPdfFromFileName({ fileName: "legacy.pdf" })
    expect(item.id).toBe("legacy-pdf-1")
    expect(item.localUri).toBe("astra-local://pdf/legacy.pdf")
    const list = await listOwnedReadingItems()
    expect(list).toHaveLength(1)
  })

  it("upsertOwnedEpubFromImport merges by stable local-file identity and preserves chapter progress", async () => {
    const first = await upsertOwnedEpubFromImport({
      fileName: "b.epub",
      bookTitle: "Book",
      chapterHref: "c1",
    })
    const second = await upsertOwnedEpubFromImport({
      fileName: "b.epub",
      bookTitle: "Book 2",
      chapterHref: "c2",
    })
    expect(first.id).toBe("or_epub_astra-local%3A%2F%2Fepub%2Fb.epub")
    expect(second.id).toBe(first.id)
    expect(second.title).toContain("Book 2")
    expect(second.progress).toEqual({ chapterId: "c2" })
  })

  it("upsertOwnedSubtitleFileFromImport stores subtitle-file rows with stable file identity", async () => {
    const item = await upsertOwnedSubtitleFileFromImport({
      fileName: "x.srt",
      formatLabel: "SRT",
      cueOrEntryCount: 12,
    })
    expect(item.sourceType).toBe("subtitle-file")
    expect(item.id).toBe("or_subtitle-file_astra-local%3A%2F%2Fsubtitle%2Fx.srt")
    expect(item.localUri).toBe("astra-local://subtitle/x.srt")
    expect(item.title).toContain("12 items")
  })

  it("upsertOwnedSubtitleFileFromImport upgrades saved state and retains last learned row continuity", async () => {
    const first = await upsertOwnedSubtitleFileFromImport({
      fileName: "clip.srt",
      formatLabel: "SRT",
      cueOrEntryCount: 12,
      status: "in_progress",
      sentenceIndex: 1,
    })
    const second = await upsertOwnedSubtitleFileFromImport({
      fileName: "clip.srt",
      formatLabel: "SRT",
      cueOrEntryCount: 12,
      status: "saved",
      sentenceIndex: 4,
    })

    expect(second.id).toBe(first.id)
    expect(second.status).toBe("saved")
    expect(second.progress).toEqual({ sentenceIndex: 4 })
    expect(second.reopenHint).toContain("continue from row 5")
    expect(describeOwnedReadingProgress(second)).toBe("Last row: 5")
  })

  it("normalizes legacy rows with updatedAt for sync conflict resolution", async () => {
    setMockBrowser(createMockBrowser({
      [OWNED_READING_STORAGE_KEY]: {
        version: 1,
        items: [{
          id: "legacy-article",
          sourceType: "article",
          title: "Legacy",
          sourceUrl: "https://example.com/legacy",
          openedAt: 1234,
          status: "saved",
          readingHistoryRecordId: "https://example.com/legacy",
          studyProgressRecordId: "https://example.com/legacy",
        }],
      },
    }))

    expect((await listOwnedReadingItems())[0]?.updatedAt).toBe(1234)
    expect((await readSyncSafeOwnedReadingItems())[0]).toEqual(expect.objectContaining({
      id: "legacy-article",
      updatedAt: 1234,
    }))
  })

  it("builds sync-safe local-file metadata without file bytes or handles", async () => {
    await upsertOwnedPdfFromFileName({ fileName: "local-proof.pdf", pageCount: 2 })

    const [payload] = await readSyncSafeOwnedReadingItems()
    expect(payload).toEqual(expect.objectContaining({
      sourceType: "pdf",
      localUri: "astra-local://pdf/local-proof.pdf",
      reopenHint: expect.stringContaining("local-proof.pdf"),
      updatedAt: expect.any(Number),
    }))
    expect(JSON.stringify(payload)).not.toMatch(/bytes|blob|handle|objectURL|arrayBuffer/i)
    expect(Object.keys(buildOwnedReadingSyncRecordMap([payload!]))).toEqual([payload!.id])
  })

  it("merges owned-reading sync mutations by updatedAt and keeps local rows on ties", () => {
    const local = [{
      id: "or_article_conflict",
      sourceType: "article" as const,
      title: "Local title",
      sourceUrl: "https://example.com/conflict",
      openedAt: 1000,
      updatedAt: 2000,
      status: "saved" as const,
      readingHistoryRecordId: "https://example.com/conflict",
      studyProgressRecordId: "https://example.com/conflict",
    }]

    const older = applyOwnedReadingSyncMutations(local, [{
      recordId: "or_article_conflict",
      operation: "upsert",
      payload: {
        ...local[0],
        title: "Older remote",
        openedAt: 3000,
        updatedAt: 1999,
      },
    }])
    expect(older[0]?.title).toBe("Local title")

    const tied = applyOwnedReadingSyncMutations(local, [{
      recordId: "or_article_conflict",
      operation: "upsert",
      payload: {
        ...local[0],
        title: "Tie remote",
        updatedAt: 2000,
      },
    }])
    expect(tied[0]?.title).toBe("Local title")

    const newer = applyOwnedReadingSyncMutations(local, [{
      recordId: "or_article_conflict",
      operation: "upsert",
      payload: {
        ...local[0],
        title: "Newer remote",
        updatedAt: 2001,
      },
    }])
    expect(newer[0]?.title).toBe("Newer remote")
  })

  it("applies owned-reading sync delete mutations", () => {
    const next = applyOwnedReadingSyncMutations([{
      id: "or_article_delete",
      sourceType: "article",
      title: "Delete me",
      sourceUrl: "https://example.com/delete",
      openedAt: 1000,
      updatedAt: 1000,
      status: "saved",
      readingHistoryRecordId: "https://example.com/delete",
      studyProgressRecordId: "https://example.com/delete",
    }], [{
      recordId: "or_article_delete",
      operation: "delete",
      payload: null,
    }])

    expect(next).toEqual([])
  })
})
