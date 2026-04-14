import { beforeEach, describe, expect, it } from "vitest"
import {
  applyStudyProgressSyncMutation,
  applyStudyProgressSyncMutations,
  buildStudyProgressRecordId,
  buildSyncSafeStudyPageProgress,
  buildVocabularyReviewStudyEvent,
  clearStudyProgress,
  deriveStudyLoopPageSummary,
  deriveStudyLoopViewModel,
  getPageStudyProgress,
  getStudyProgress,
  orderStudySteps,
  recordStudyEvent,
  replaceStudyProgressPages,
  STUDY_STEPS_ORDER,
  type StudyProgressStore,
} from "./study-progress"

describe("study-progress", () => {
  beforeEach(async () => {
    await clearStudyProgress()
  })

  it("records a read step for a new page", async () => {
    const page = await recordStudyEvent({
      url: "https://example.com/article",
      hostname: "example.com",
      title: "Test Article",
      step: "read",
    })

    expect(page.completedSteps).toEqual(["read"])
    expect(page.url).toBe("https://example.com/article")
    expect(page.title).toBe("Test Article")
  })

  it("accumulates multiple steps for the same page", async () => {
    const input = {
      url: "https://example.com/article",
      hostname: "example.com",
      title: "Test Article",
    }

    await recordStudyEvent({ ...input, step: "read" })
    await recordStudyEvent({ ...input, step: "guided_read" })
    const page = await recordStudyEvent({ ...input, step: "explain", count: 3 })

    expect(page.completedSteps).toEqual(["read", "guided_read", "explain"])
    expect(page.sentencesExplained).toBe(3)
  })

  it("tracks page-level review count without inflating pages studied", async () => {
    const input = {
      url: "https://example.com/article",
      hostname: "example.com",
      title: "Test Article",
    }

    await recordStudyEvent({ ...input, step: "read" })
    const page = await recordStudyEvent({ ...input, step: "vocab_review", count: 2 })
    const store = await getStudyProgress()

    expect(page.completedSteps).toEqual(["read", "vocab_review"])
    expect(page.vocabReviewed).toBe(2)
    expect(store.dailyStats.pagesStudied).toBe(1)
    expect(store.dailyStats.vocabReviewed).toBe(2)
  })

  it("orders completed steps in canonical pipeline order", () => {
    expect(orderStudySteps(["explain", "read"])).toEqual(["read", "explain"])
    expect(orderStudySteps(["vocab_review", "read", "explain"])).toEqual(["read", "explain", "vocab_review"])
  })

  it("derives a page summary with ordered steps and next-step hint", () => {
    expect(deriveStudyLoopPageSummary({
      url: "https://example.com/article",
      hostname: "example.com",
      title: "Example",
      completedSteps: ["vocab_save", "read", "explain"],
      sentencesExplained: 2,
      vocabSaved: 1,
      vocabReviewed: 0,
      startedAt: 10,
      lastActivityAt: 20,
    })).toEqual({
      completedSteps: ["read", "explain", "vocab_save"],
      currentCounts: { sentencesExplained: 2, vocabSaved: 1, vocabReviewed: 0 },
      nextStep: "vocab_review",
      completionPercent: 60,
    })
  })

  it("does not duplicate steps", async () => {
    const input = {
      url: "https://example.com/article",
      hostname: "example.com",
      title: "Test Article",
    }

    await recordStudyEvent({ ...input, step: "read" })
    const page = await recordStudyEvent({ ...input, step: "read" })

    expect(page.completedSteps).toEqual(["read"])
  })

  it("tracks daily stats across pages", async () => {
    await recordStudyEvent({
      url: "https://a.com/1",
      hostname: "a.com",
      title: "A",
      step: "vocab_save",
      count: 2,
    })
    await recordStudyEvent({
      url: "https://b.com/2",
      hostname: "b.com",
      title: "B",
      step: "vocab_save",
      count: 3,
    })

    const store = await getStudyProgress()
    expect(store.dailyStats.vocabSaved).toBe(5)
    expect(store.dailyStats.pagesStudied).toBe(2)
  })

  it("does not count pagesStudied when vocab_review is the first event for a URL", async () => {
    await recordStudyEvent({
      url: "https://example.com/page",
      hostname: "example.com",
      title: "Example",
      step: "vocab_review",
    })
    const store = await getStudyProgress()
    expect(store.dailyStats.vocabReviewed).toBe(1)
    expect(store.dailyStats.pagesStudied).toBe(0)
  })

  it("retrieves page-specific progress", async () => {
    await recordStudyEvent({
      url: "https://example.com/article?q=1",
      hostname: "example.com",
      title: "Test",
      step: "read",
    })

    // URL is normalized — query string stripped
    const progress = await getPageStudyProgress("https://example.com/article")
    expect(progress).not.toBeNull()
    expect(progress!.completedSteps).toContain("read")
  })

  it("builds a sanitized record id", () => {
    expect(buildStudyProgressRecordId("https://example.com/article?utm=1#section")).toBe(
      "https://example.com/article",
    )
  })

  it("builds vocabulary review events from linked study-progress ids", () => {
    expect(buildVocabularyReviewStudyEvent({
      id: "entry-1",
      text: "ephemeral",
      url: "chrome-extension://abc/subtitle-reader.html",
      hostname: "extension",
      savedAt: 1,
      sourceContext: {
        surface: "popup_deep_read",
        pageTitle: "Example article",
        hostname: "example.com",
        studyProgressRecordId: "https://example.com/article?from=popup",
        ownedReadingTitle: "Example article",
      },
    })).toEqual({
      url: "https://example.com/article",
      hostname: "example.com",
      title: "Example article",
      step: "vocab_review",
    })
  })

  it("skips vocabulary review study events for extension-only source urls without linked study progress", () => {
    expect(buildVocabularyReviewStudyEvent({
      id: "entry-2",
      text: "subtitle word",
      url: "chrome-extension://abc/subtitle-reader.html",
      hostname: "extension",
      savedAt: 1,
      sourceContext: {
        surface: "subtitle_reader",
        pageTitle: "clip.srt",
        ownedReadingItemId: "or_subtitle_clip",
        ownedReadingSourceType: "subtitle-file",
        ownedReadingTitle: "clip.srt · SRT · 12 items",
      },
    })).toBeNull()
  })

  it("canonicalizes sync-safe page progress step order", () => {
    const page = buildSyncSafeStudyPageProgress({
      url: "https://example.com/article?utm=1",
      hostname: "example.com",
      title: "Example",
      completedSteps: ["vocab_save", "read", "guided_read", "read"],
      sentencesExplained: 1,
      vocabSaved: 2,
      vocabReviewed: 0,
      startedAt: 100,
      lastActivityAt: 200,
    })

    expect(page.url).toBe("https://example.com/article")
    expect(page.completedSteps).toEqual(["read", "guided_read", "vocab_save"])
  })

  it("merges study progress sync updates without losing durable progress", () => {
    const merged = applyStudyProgressSyncMutation([{
      url: "https://example.com/article",
      hostname: "example.com",
      title: "Local title",
        completedSteps: ["read", "guided_read"],
        sentencesExplained: 1,
        vocabSaved: 1,
        vocabReviewed: 0,
        startedAt: 100,
      lastActivityAt: 200,
    }], {
      recordId: "https://example.com/article",
      operation: "upsert",
      payload: {
        url: "https://example.com/article?utm=1",
        hostname: "example.com",
        title: "Remote title",
          completedSteps: ["read", "explain", "vocab_review"],
          sentencesExplained: 3,
          vocabSaved: 2,
          vocabReviewed: 1,
          startedAt: 50,
        lastActivityAt: 300,
      },
    })

    expect(merged).toEqual([expect.objectContaining({
      url: "https://example.com/article",
      title: "Remote title",
      completedSteps: ["read", "guided_read", "explain", "vocab_review"],
      sentencesExplained: 3,
      vocabSaved: 2,
      vocabReviewed: 1,
      startedAt: 50,
      lastActivityAt: 300,
    })])
  })

  it("deletes synced study progress pages by record id", () => {
    const nextPages = applyStudyProgressSyncMutations([{
      url: "https://example.com/article",
      hostname: "example.com",
      title: "Example",
        completedSteps: ["read"],
        sentencesExplained: 0,
        vocabSaved: 0,
        vocabReviewed: 0,
        startedAt: 100,
      lastActivityAt: 100,
    }], [{
      recordId: "https://example.com/article",
      operation: "delete",
      payload: null,
    }])

    expect(nextPages).toEqual([])
  })

  it("replaces synced pages while preserving local-only daily stats", async () => {
    await recordStudyEvent({
      url: "https://example.com/article",
      hostname: "example.com",
      title: "Local",
      step: "vocab_save",
      count: 2,
    })

    await replaceStudyProgressPages([{
      url: "https://remote.example/article",
      hostname: "remote.example",
      title: "Remote",
      completedSteps: ["read", "guided_read"],
      sentencesExplained: 4,
      vocabSaved: 1,
      vocabReviewed: 0,
      startedAt: 10,
      lastActivityAt: 20,
    }])

    const store = await getStudyProgress()
    expect(store.pages).toEqual([expect.objectContaining({
      url: "https://remote.example/article",
      title: "Remote",
    })])
    expect(store.dailyStats).toMatchObject({
      vocabSaved: 2,
      pagesStudied: 1,
    })
  })

  describe("deriveStudyLoopViewModel", () => {
    it("computes next step and completion percent", () => {
      const store: StudyProgressStore = {
        pages: [{
          url: "https://example.com/article",
          hostname: "example.com",
          title: "Test",
          completedSteps: ["read", "guided_read"],
          sentencesExplained: 0,
          vocabSaved: 0,
          vocabReviewed: 0,
          startedAt: Date.now(),
          lastActivityAt: Date.now(),
        }],
        dailyStats: {
          date: "2026-04-03",
          pagesStudied: 1,
          sentencesExplained: 0,
          vocabSaved: 0,
          vocabReviewed: 0,
        },
      }

      const vm = deriveStudyLoopViewModel(store, "https://example.com/article")
      expect(vm.currentPage).not.toBeNull()
      expect(vm.completedSteps).toEqual(["read", "guided_read"])
      expect(vm.currentCounts).toEqual({ sentencesExplained: 0, vocabSaved: 0, vocabReviewed: 0 })
      expect(vm.nextStep).toBe("explain")
      expect(vm.completionPercent).toBe(40) // 2/5 steps
    })

    it("returns null nextStep when all steps complete", () => {
      const store: StudyProgressStore = {
        pages: [{
          url: "https://example.com/article",
          hostname: "example.com",
          title: "Test",
          completedSteps: [...STUDY_STEPS_ORDER],
          sentencesExplained: 5,
          vocabSaved: 3,
          vocabReviewed: 2,
          startedAt: Date.now(),
          lastActivityAt: Date.now(),
        }],
        dailyStats: {
          date: "2026-04-03",
          pagesStudied: 1,
          sentencesExplained: 5,
          vocabSaved: 3,
          vocabReviewed: 3,
        },
      }

      const vm = deriveStudyLoopViewModel(store, "https://example.com/article")
      expect(vm.nextStep).toBeNull()
      expect(vm.currentCounts).toEqual({ sentencesExplained: 5, vocabSaved: 3, vocabReviewed: 2 })
      expect(vm.completionPercent).toBe(100)
    })

    it("handles no current page gracefully", () => {
      const store: StudyProgressStore = {
        pages: [],
        dailyStats: {
          date: "2026-04-03",
          pagesStudied: 0,
          sentencesExplained: 0,
          vocabSaved: 0,
          vocabReviewed: 0,
        },
      }

      const vm = deriveStudyLoopViewModel(store, "https://unknown.com")
      expect(vm.currentPage).toBeNull()
      expect(vm.completedSteps).toEqual([])
      expect(vm.currentCounts).toEqual({ sentencesExplained: 0, vocabSaved: 0, vocabReviewed: 0 })
      expect(vm.nextStep).toBe("read")
      expect(vm.completionPercent).toBe(0)
    })
  })
})
