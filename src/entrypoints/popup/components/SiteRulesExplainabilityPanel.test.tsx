import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ResolvedSiteTranslationSettings } from "@/types/config"
import type { TranslationSnapshot } from "@/types/translation"
import SiteRulesExplainabilityPanel, { buildSiteRulesExplainabilityModel } from "./SiteRulesExplainabilityPanel"

function createResolvedSite(patch: Partial<ResolvedSiteTranslationSettings> = {}): ResolvedSiteTranslationSettings {
  return {
    hostname: "example.com",
    enabled: true,
    alwaysTranslate: false,
    targetLang: "zh-CN",
    hoverTrigger: "alt",
    contentScope: "page",
    presentation: {
      mode: "bilingual",
      theme: "default",
      fontSize: 0.92,
      translationColor: "#64748b",
    },
    ...patch,
  }
}

function createTranslationState(patch: Partial<TranslationSnapshot> = {}): TranslationSnapshot {
  return {
    phase: "idle",
    sessionId: 1,
    targetLang: "zh-CN",
    lastError: null,
    progress: {
      totalBlocks: 0,
      queuedBlocks: 0,
      inFlightBlocks: 0,
      translatedBlocks: 0,
      failedBlocks: 0,
    },
    presentation: {
      mode: "bilingual",
      theme: "default",
      fontSize: 0.92,
      translationColor: "#64748b",
    },
    site: {
      hostname: "example.com",
      enabled: true,
      alwaysTranslate: false,
    },
    ...patch,
  }
}

describe("SiteRulesExplainabilityPanel", () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    container.remove()
  })

  it("renders honest fallback when runtime diagnostics are unavailable", () => {
    act(() => {
      root.render(
        <SiteRulesExplainabilityPanel
          activeSiteKey="example.com"
          rawSiteRule={undefined}
          resolvedSite={createResolvedSite()}
          translationState={createTranslationState()}
          contentAvailable={true}
          providerReady={true}
        />,
      )
    })

    expect(container.textContent).toContain("Why this page?")
    expect(container.textContent).toContain("Global defaults")
    expect(container.textContent).toContain("Runtime diagnostics")
    expect(container.textContent).toContain("unavailable")
    expect(container.textContent).toContain("Astra is ready on this page")
  })

  it("explains invalid selectors and runtime no-match diagnostics", () => {
    const resolvedSite = createResolvedSite({
      selectors: [".article-body", "article["],
      excludeSelectors: [".ad"],
      paragraphMinLength: 30,
    })
    const model = buildSiteRulesExplainabilityModel({
      activeSiteKey: "example.com",
      rawSiteRule: {
        enabled: true,
        alwaysTranslate: true,
        selectors: resolvedSite.selectors,
        excludeSelectors: resolvedSite.excludeSelectors,
        paragraphMinLength: resolvedSite.paragraphMinLength,
      },
      resolvedSite,
      translationState: createTranslationState({
        phase: "running",
        diagnostics: {
          contentScope: "page",
          effectiveContentScope: "page",
          siteRules: {
            inputBlockCount: 4,
            afterIncludeCount: 0,
            afterExcludeCount: 0,
            afterParagraphCount: 0,
            filterStages: [
              { id: "collected-blocks", count: 4 },
              { id: "after-include-filters", count: 0 },
              { id: "after-exclude-filters", count: 0 },
              { id: "after-paragraph-filter", count: 0 },
            ],
            selectors: {
              configured: [".article-body", "article["],
              valid: [".article-body"],
              invalid: ["article["],
              matchedBlocks: 0,
            },
            excludeSelectors: {
              configured: [".ad"],
              valid: [".ad"],
              invalid: [],
              matchedBlocks: 0,
            },
            paragraphMinLength: 30,
          },
        },
      }),
      contentAvailable: true,
      providerReady: true,
    })

    expect(model.why).toContain("filters matched no translatable blocks")
    expect(model.ruleSource).toContain("Saved site rule")
    expect(model.selectorSummary).toContain("Include selectors invalid: article[")
    expect(model.runtimeSummary).toEqual([
      "Runtime diagnostics: available",
      "Collected blocks: 4",
      "After include filters: 0",
      "After exclude filters: 0",
      "After paragraph filter: 0",
      "Scope: page",
    ])
    expect(model.warnings).toContain("Invalid selectors are ignored instead of blocking all translation.")
    expect(model.warnings).toContain("Include selectors currently match no collected text blocks.")
    expect(model.quickFixes).toEqual([
      expect.objectContaining({ action: "clear-include-selectors", reason: "Invalid include selector detected." }),
    ])
  })

  it("falls back to scalar runtime counts when ordered filter-stage diagnostics are absent", () => {
    const model = buildSiteRulesExplainabilityModel({
      activeSiteKey: "example.com",
      rawSiteRule: undefined,
      resolvedSite: createResolvedSite(),
      translationState: createTranslationState({
        phase: "running",
        diagnostics: {
          contentScope: "page",
          effectiveContentScope: "article",
          siteRules: {
            inputBlockCount: 5,
            afterIncludeCount: 4,
            afterExcludeCount: 3,
            afterParagraphCount: 2,
            selectors: {
              configured: [],
              valid: [],
              invalid: [],
              matchedBlocks: 0,
            },
            excludeSelectors: {
              configured: [],
              valid: [],
              invalid: [],
              matchedBlocks: 0,
            },
          },
        },
      }),
      contentAvailable: true,
      providerReady: true,
    })

    expect(model.runtimeSummary).toEqual([
      "Runtime diagnostics: available",
      "Collected blocks: 5",
      "After include filters: 4",
      "After exclude filters: 3",
      "After paragraph filter: 2",
      "Scope: article",
    ])
  })

  it("renders quick-fix CTAs for invalid include and exclude selectors and invokes the selected action", () => {
    const onQuickFix = vi.fn()

    act(() => {
      root.render(
        <SiteRulesExplainabilityPanel
          activeSiteKey="example.com"
          rawSiteRule={{
            enabled: true,
            alwaysTranslate: true,
            selectors: ["article["],
            excludeSelectors: ["aside["],
          }}
          resolvedSite={createResolvedSite({
            selectors: ["article["],
            excludeSelectors: ["aside["],
          })}
          translationState={createTranslationState()}
          contentAvailable={true}
          providerReady={true}
          onQuickFix={onQuickFix}
        />,
      )
    })

    const includeButton = container.querySelector('[data-testid="site-rules-quick-fix-clear-include-selectors"]') as HTMLButtonElement
    const excludeButton = container.querySelector('[data-testid="site-rules-quick-fix-clear-exclude-selectors"]') as HTMLButtonElement

    expect(container.textContent).toContain("Invalid include selector detected.")
    expect(container.textContent).toContain("Invalid exclude selector detected.")
    expect(includeButton?.textContent).toBe("Clear include selectors")
    expect(excludeButton?.textContent).toBe("Clear exclude selectors")

    act(() => {
      includeButton.click()
      excludeButton.click()
    })

    expect(onQuickFix).toHaveBeenNthCalledWith(1, "clear-include-selectors")
    expect(onQuickFix).toHaveBeenNthCalledWith(2, "clear-exclude-selectors")
  })

  it("renders a clear-include CTA when a valid include selector matches zero collected blocks", () => {
    const onQuickFix = vi.fn()

    act(() => {
      root.render(
        <SiteRulesExplainabilityPanel
          activeSiteKey="example.com"
          rawSiteRule={{
            enabled: true,
            alwaysTranslate: true,
            selectors: [".missing-article"],
          }}
          resolvedSite={createResolvedSite({ selectors: [".missing-article"] })}
          translationState={createTranslationState({
            phase: "running",
            diagnostics: {
              contentScope: "page",
              effectiveContentScope: "page",
              siteRules: {
                inputBlockCount: 3,
                afterIncludeCount: 0,
                afterExcludeCount: 0,
                afterParagraphCount: 0,
                selectors: {
                  configured: [".missing-article"],
                  valid: [".missing-article"],
                  invalid: [],
                  matchedBlocks: 0,
                },
                excludeSelectors: {
                  configured: [],
                  valid: [],
                  invalid: [],
                  matchedBlocks: 0,
                },
              },
            },
          })}
          contentAvailable={true}
          providerReady={true}
          onQuickFix={onQuickFix}
        />,
      )
    })

    const includeButton = container.querySelector('[data-testid="site-rules-quick-fix-clear-include-selectors"]') as HTMLButtonElement

    expect(container.textContent).toContain("Include selector matched zero blocks.")
    expect(includeButton?.textContent).toBe("Clear include selectors")

    act(() => {
      includeButton.click()
    })

    expect(onQuickFix).toHaveBeenCalledWith("clear-include-selectors")
  })

  it("does not keep stale runtime quick-fix CTAs after the draft selectors are cleared", () => {
    const staleRuntimeState = createTranslationState({
      phase: "running",
      diagnostics: {
        contentScope: "page",
        effectiveContentScope: "page",
        siteRules: {
          inputBlockCount: 3,
          afterIncludeCount: 0,
          afterExcludeCount: 0,
          afterParagraphCount: 0,
          selectors: {
            configured: ["article["],
            valid: [],
            invalid: ["article["],
            matchedBlocks: 0,
          },
          excludeSelectors: {
            configured: [],
            valid: [],
            invalid: [],
            matchedBlocks: 0,
          },
        },
      },
    })
    const onQuickFix = vi.fn()

    act(() => {
      root.render(
        <SiteRulesExplainabilityPanel
          activeSiteKey="example.com"
          rawSiteRule={{ enabled: true, alwaysTranslate: true, selectors: ["article["] }}
          resolvedSite={createResolvedSite({ selectors: ["article["] })}
          translationState={staleRuntimeState}
          contentAvailable={true}
          providerReady={true}
          onQuickFix={onQuickFix}
        />,
      )
    })

    expect(container.querySelector('[data-testid="site-rules-quick-fix-clear-include-selectors"]')).toBeTruthy()

    act(() => {
      root.render(
        <SiteRulesExplainabilityPanel
          activeSiteKey="example.com"
          rawSiteRule={{ enabled: true, alwaysTranslate: true }}
          resolvedSite={createResolvedSite()}
          translationState={staleRuntimeState}
          contentAvailable={true}
          providerReady={true}
          onQuickFix={onQuickFix}
        />,
      )
    })

    expect(container.querySelector('[data-testid="site-rules-quick-fix-clear-include-selectors"]')).toBeNull()
  })
})
