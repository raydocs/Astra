import { beforeEach, describe, expect, it } from "vitest"
import {
  applyStudyProgressSyncMutation,
  applyStudyProgressSyncMutations,
  buildStudyProgressRecordId,
  buildSyncSafeStudyPageProgress,
  buildVocabularyReviewStudyEvent,
  clearStudyProgress,
  derivePersonalizedTeachingStrategy,
  deriveStudyLoopPageSummary,
  deriveStudyLoopPrimerRecommendation,
  deriveStudyLoopViewModel,
  deriveWeeklyStudyProgressRoi,
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

  it("derives deterministic progress-aware personalized teaching strategies without persisting schema fields", () => {
    const page = {
      url: "https://example.com/article",
      hostname: "example.com",
      title: "Example",
      completedSteps: ["read", "guided_read", "explain"],
      sentencesExplained: 2,
      vocabSaved: 0,
      vocabReviewed: 0,
      startedAt: 10,
      lastActivityAt: 20,
    } satisfies StudyProgressStore["pages"][number]
    const dailyStats = {
      date: "2026-04-03",
      pagesStudied: 1,
      sentencesExplained: 2,
      vocabSaved: 0,
      vocabReviewed: 0,
    }
    const summary = deriveStudyLoopPageSummary(page)

    expect(derivePersonalizedTeachingStrategy(page, summary, dailyStats)).toEqual({
      id: "save_explained_sentence",
      label: "Save the explained sentence",
      hint: "You have explanation momentum on this page; save one useful sentence so review can reinforce it later.",
      focusStep: "vocab_save",
      trigger: "explained_more_than_saved",
      progressSignature: "read>guided_read>explain|next:vocab_save|e:2|s:0|r:0|pct:60",
      evidence: "2 explained · 0 saved",
    })

    expect(deriveStudyLoopViewModel({ pages: [page], dailyStats }, "https://example.com/article?utm=1").personalizedStrategy).toMatchObject({
      id: "save_explained_sentence",
      trigger: "explained_more_than_saved",
      focusStep: "vocab_save",
    })
  })

  it("derives weekly study ROI from active page progress without persisting new fields", () => {
    const now = new Date("2026-04-09T12:00:00.000Z").getTime()
    const store: StudyProgressStore = {
      pages: [
        {
          url: "https://example.com/complete",
          hostname: "example.com",
          title: "Complete",
          completedSteps: [...STUDY_STEPS_ORDER],
          sentencesExplained: 4,
          vocabSaved: 3,
          vocabReviewed: 2,
          startedAt: now - 30 * 60_000,
          lastActivityAt: now - 10 * 60_000,
        },
        {
          url: "https://example.com/old",
          hostname: "example.com",
          title: "Old",
          completedSteps: ["read"],
          sentencesExplained: 10,
          vocabSaved: 10,
          vocabReviewed: 10,
          startedAt: now - 10 * 24 * 60 * 60_000,
          lastActivityAt: now - 9 * 24 * 60 * 60_000,
        },
      ],
      dailyStats: {
        date: "2026-04-09",
        pagesStudied: 1,
        sentencesExplained: 4,
        vocabSaved: 3,
        vocabReviewed: 2,
      },
    }

    expect(deriveWeeklyStudyProgressRoi(store, { now })).toEqual({
      window: {
        startAt: now - 7 * 24 * 60 * 60_000,
        endAt: now,
        days: 7,
      },
      activePageCount: 1,
      completedLoopCount: 1,
      inputMinutes: 20,
      sentencesExplained: 4,
      vocabSaved: 3,
      vocabReviewed: 2,
    })
  })

  it("derives a deterministic unique popup primer recommendation from next step and availability", () => {
    expect(deriveStudyLoopPrimerRecommendation({
      nextStep: "read",
      dueCount: 3,
      canTranslatePage: true,
      canReadArticle: true,
      canExplainSentence: true,
    })).toEqual({
      recommendedAction: "translate_page",
      reason: "next_step_read",
      actionableActions: ["translate_page", "open_deep_read", "explain_sentence", "open_review"],
      actionableActionCount: 4,
      nextStep: "read",
    })

    expect(deriveStudyLoopPrimerRecommendation({
      nextStep: "explain",
      dueCount: 0,
      canTranslatePage: true,
      canReadArticle: true,
      canExplainSentence: true,
    }).recommendedAction).toBe("explain_sentence")

    expect(deriveStudyLoopPrimerRecommendation({
      nextStep: "vocab_review",
      dueCount: 1,
      canTranslatePage: true,
      canReadArticle: true,
      canExplainSentence: false,
    }).recommendedAction).toBe("open_review")
  })

  it("falls back deterministically when the next-step action is unavailable", () => {
    expect(deriveStudyLoopPrimerRecommendation({
      nextStep: "explain",
      dueCount: 2,
      canTranslatePage: false,
      canReadArticle: false,
      canExplainSentence: false,
    })).toEqual({
      recommendedAction: "open_review",
      reason: "due_review",
      actionableActions: ["open_review"],
      actionableActionCount: 1,
      nextStep: "explain",
    })

    expect(deriveStudyLoopPrimerRecommendation({
      nextStep: null,
      dueCount: 0,
      canTranslatePage: false,
      canReadArticle: true,
      canExplainSentence: true,
      canOpenReview: false,
    })).toEqual({
      recommendedAction: "open_deep_read",
      reason: "fallback_first_available",
      actionableActions: ["open_deep_read", "explain_sentence"],
      actionableActionCount: 2,
      nextStep: null,
    })

    expect(deriveStudyLoopPrimerRecommendation({
      nextStep: "read",
      dueCount: 0,
      canTranslatePage: false,
      canReadArticle: false,
      canExplainSentence: false,
      canOpenReview: false,
    })).toEqual({
      recommendedAction: null,
      reason: "no_actionable_action",
      actionableActions: [],
      actionableActionCount: 0,
      nextStep: "read",
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
