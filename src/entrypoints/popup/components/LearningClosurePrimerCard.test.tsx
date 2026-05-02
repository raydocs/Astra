import { act } from "react"
import type React from "react"
import ReactDOM from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import LearningClosurePrimerCard from "./LearningClosurePrimerCard"

describe("LearningClosurePrimerCard", () => {
  let container: HTMLDivElement
  let root: ReactDOM.Root
  const onTranslatePage = vi.fn()
  const onReadArticle = vi.fn()
  const onExplainSentence = vi.fn()
  const onOpenReview = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    container = document.createElement("div")
    document.body.appendChild(container)
    root = ReactDOM.createRoot(container)
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
      await Promise.resolve()
    })
    container.remove()
  })

  async function renderCard(props: Partial<React.ComponentProps<typeof LearningClosurePrimerCard>> = {}) {
    await act(async () => {
      root.render(
        <LearningClosurePrimerCard
          canTranslatePage
          canReadArticle
          canExplainSentence
          dueCount={3}
          sentenceCount={2}
          onTranslatePage={onTranslatePage}
          onReadArticle={onReadArticle}
          onExplainSentence={onExplainSentence}
          onOpenReview={onOpenReview}
          {...props}
        />,
      )
      await Promise.resolve()
    })
  }

  it("renders the early closure loop primer copy", async () => {
    await renderCard()

    expect(container.querySelector('[data-testid="learning-closure-primer-card"]')).toBeTruthy()
    expect(container.textContent).toContain("Reading-to-review workflow")
    expect(container.textContent).toContain("not just translations")
    const commercialPackageCopy = container.querySelector('[data-testid="learning-closure-commercial-package-copy"]')
    expect(commercialPackageCopy?.textContent).toContain("Free start · connected practice")
    expect(commercialPackageCopy?.textContent).toContain("Translate, Deep Read, save, and review stay in one trail")
    expect(commercialPackageCopy?.textContent).toContain("Generic translators/readers stop after the answer")
    expect(commercialPackageCopy?.textContent).toContain("review path attached")
    const firstWinActivationCopy = container.querySelector('[data-testid="learning-closure-first-win-activation-copy"]')
    expect(firstWinActivationCopy?.textContent).toContain("First win activation")
    expect(firstWinActivationCopy?.textContent).toContain("Save one useful sentence from a real page")
    expect(firstWinActivationCopy?.textContent).toContain("Translate a page, open Deep Read, explain one sentence, save it")
    expect(firstWinActivationCopy?.textContent).toContain("same page context back")
    expect(commercialPackageCopy?.textContent).not.toContain("Start free: translate selected real-page moments")
    expect(commercialPackageCopy?.textContent).not.toContain("Local beta boundary")
    expect(container.querySelector('[data-testid="learning-closure-value-stack-copy"]')).toBeFalsy()
    expect(container.querySelector('[data-testid="learning-closure-value-ladder-copy"]')).toBeFalsy()
    expect(container.querySelector('[data-testid="learning-closure-commercial-boundary-copy"]')).toBeFalsy()
    expect(container.querySelector('[data-testid="learning-closure-differentiation-copy"]')).toBeFalsy()
    expect(container.textContent).toContain("Translate the current page to create bilingual study context")
    expect(container.textContent).toContain("Ask why the sentence works")
    expect(container.textContent).toContain("Review (3)")
  })

  it("renders the alternate outcome-first copy variant", async () => {
    await renderCard({ copyVariant: "outcome_first" })

    const card = container.querySelector('[data-testid="learning-closure-primer-card"]') as HTMLElement
    expect(card.dataset.copyVariant).toBe("outcome_first")
    expect(container.textContent).toContain("Build a review card fast")
    expect(container.textContent).toContain("Leave this page with one saved sentence")
    expect(container.textContent).toContain("Open Review to turn saved sentences into repeat practice")
  })

  it("marks exactly one recommended next action without changing action handlers", async () => {
    await renderCard({ recommendedAction: "open_deep_read" })

    const card = container.querySelector('[data-testid="learning-closure-primer-card"]') as HTMLElement
    const recommendedButtons = Array.from(container.querySelectorAll('[data-recommended="true"]'))
    const deepReadButton = container.querySelector('[data-testid="learning-closure-primer-deep-read"]') as HTMLButtonElement

    expect(card.dataset.recommendedAction).toBe("open_deep_read")
    expect(recommendedButtons).toEqual([deepReadButton])
    expect(deepReadButton.textContent).toContain("Recommended next")
    expect(container.querySelectorAll('[data-testid="learning-closure-primer-recommended-marker"]')).toHaveLength(1)

    deepReadButton.click()
    expect(onReadArticle).toHaveBeenCalledTimes(1)
    expect(onTranslatePage).not.toHaveBeenCalled()
  })

  it("calls only the supplied popup handlers", async () => {
    await renderCard()

    ;(container.querySelector('[data-testid="learning-closure-primer-translate"]') as HTMLButtonElement).click()
    ;(container.querySelector('[data-testid="learning-closure-primer-deep-read"]') as HTMLButtonElement).click()
    ;(container.querySelector('[data-testid="learning-closure-primer-explain"]') as HTMLButtonElement).click()
    ;(container.querySelector('[data-testid="learning-closure-primer-review"]') as HTMLButtonElement).click()

    expect(onTranslatePage).toHaveBeenCalledTimes(1)
    expect(onReadArticle).toHaveBeenCalledTimes(1)
    expect(onExplainSentence).toHaveBeenCalledTimes(1)
    expect(onOpenReview).toHaveBeenCalledTimes(1)
  })

  it("keeps unavailable learning actions disabled without hiding guidance", async () => {
    await renderCard({
      canTranslatePage: false,
      canReadArticle: false,
      canExplainSentence: false,
      dueCount: 0,
      sentenceCount: 0,
    })

    expect((container.querySelector('[data-testid="learning-closure-primer-translate"]') as HTMLButtonElement).disabled).toBe(true)
    expect((container.querySelector('[data-testid="learning-closure-primer-deep-read"]') as HTMLButtonElement).disabled).toBe(true)
    expect((container.querySelector('[data-testid="learning-closure-primer-explain"]') as HTMLButtonElement).disabled).toBe(true)
    expect((container.querySelector('[data-testid="learning-closure-primer-review"]') as HTMLButtonElement).disabled).toBe(false)
    expect(container.textContent).toContain("no due cards")
    expect(container.textContent).toContain("when article text is available")
  })
})
