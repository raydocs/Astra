import { beforeEach, describe, expect, it } from "vitest"

import { createMockBrowser, setMockBrowser } from "../../../test/utils/mockBrowser"
import { READING_HISTORY_STORAGE_KEY } from "./reading-history"
import {
  OWNED_READING_STORAGE_KEY,
  buildOwnedReadingArticleIdentity,
  buildOwnedReadingLocalFileIdentity,
  buildOwnedReadingLocalUri,
  buildOwnedReadingRemotePdfIdentity,
  buildOwnedReadingResumeTarget,
  buildOwnedReadingVocabularySourceLink,
  countOwnedReadingItemsByView,
  deriveOwnedReadingArticleUrl,
  deriveOwnedReadingIdentityFromItem,
  describeOwnedReadingProgress,
  describeOwnedReadingResumeBehavior,
  filterOwnedReadingItemsByView,
  matchOwnedReadingItemForVocabularyEntry,
  listOwnedReadingItems,
  removeOwnedReadingItem,
  setOwnedReadingStatus,
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
})
