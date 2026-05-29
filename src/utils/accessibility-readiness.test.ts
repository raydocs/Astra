import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import {
  ASTRA_ACCESSIBILITY_COMPONENT_LABELS,
  ASTRA_ACCESSIBILITY_MANUAL_EVIDENCE_ROWS,
  ASTRA_ACCESSIBILITY_PRINCIPLES,
  ASTRA_ACCESSIBILITY_REQUIREMENTS,
  ASTRA_ACCESSIBILITY_SHORTCUTS,
  ASTRA_ACCESSIBILITY_STATE_RULES,
  evaluateAstraAccessibilityManualEvidencePacket,
  evaluateAstraAccessibilityReadiness,
  validateAstraAccessibilityStateCopy,
  type AstraAccessibilityReadinessEvidence,
  type AstraAccessibilityStateCopyEvidence,
} from "./accessibility-readiness"

const readyEvidence: AstraAccessibilityReadinessEvidence = {
  popupTabOrderComplete: true,
  onboardingKeyboardWalkthrough: true,
  p0ButtonsHaveUnderstandableLabels: true,
  statesNotColorOnly: true,
  errorCardsHaveActions: true,
  toastAriaLiveNonBlocking: true,
  settingsFormsLabeled: true,
  supportReportAccessible: true,
  paywallPriceLimitCtaReadable: true,
  librarySearchFilterListKeyboard: true,
  reviewShortcutsLabeled: true,
  prefersReducedMotionSupported: true,
  scaledTextMainUiChecked: true,
}

const completeStateCopy: AstraAccessibilityStateCopyEvidence[] = [
  { state: "success", text: "Saved. Review is ready.", nonColorCue: "check icon" },
  { state: "warning", text: "Check this setting before continuing.", nonColorCue: "warning icon" },
  { state: "error", text: "Translation failed.", nonColorCue: "error icon", actionLabel: "Retry translation" },
  { state: "loading", text: "Loading review cards…", nonColorCue: "spinner" },
  { state: "pro_limit", text: "Pro limit reached.", nonColorCue: "limit badge", actionLabel: "View plan limits" },
  { state: "review_due", text: "12 cards due today.", nonColorCue: "due count badge" },
]

const completeManualEvidence = ASTRA_ACCESSIBILITY_MANUAL_EVIDENCE_ROWS.map((row) => ({
  id: row.id,
  verdict: "pass" as const,
  ownerDate: "qa-owner@astra.ai — 2026-05-28",
  environment: "Chrome MV3 build, macOS, keyboard-only walkthrough",
  evidenceLink: `docs/reviews/accessibility-manual/${row.id}.md`,
}))

describe("Astra accessibility readiness contract", () => {
  it("codifies the section 32 principles and required launch surfaces", () => {
    expect(Object.keys(ASTRA_ACCESSIBILITY_PRINCIPLES)).toEqual([
      "keyboard_first",
      "screen_reader_readable",
      "contrast_sufficient",
      "motion_respectful",
      "text_scalable",
      "error_explicit",
      "touch_friendly",
    ])

    expect(ASTRA_ACCESSIBILITY_REQUIREMENTS.map((requirement) => requirement.id)).toEqual([
      "popup_tab_order",
      "p0_button_labels",
      "onboarding_keyboard",
      "settings_form_labels",
      "support_report_accessible",
      "paywall_readable",
      "library_search_filter_keyboard",
      "state_not_color_only",
      "error_card_text_action",
      "toast_aria_live_nonblocking",
      "review_shortcuts_labels",
      "prefers_reduced_motion",
      "text_scaling",
    ])

    expect(ASTRA_ACCESSIBILITY_REQUIREMENTS.filter((requirement) => requirement.priority === "P0").length).toBe(10)
    expect(ASTRA_ACCESSIBILITY_REQUIREMENTS.map((requirement) => requirement.surface)).toEqual(expect.arrayContaining([
      "popup",
      "onboarding",
      "settings",
      "selection_toolbar",
      "review",
      "library",
      "paywall",
      "support_report",
      "toast",
      "error_card",
    ]))
  })

  it("documents the keyboard shortcuts required for Review, Library, details, modal, and onboarding", () => {
    expect(ASTRA_ACCESSIBILITY_SHORTCUTS).toEqual(expect.arrayContaining([
      expect.objectContaining({ surface: "review", keys: ["1", "2", "3"], labelRequired: true }),
      expect.objectContaining({ surface: "review", keys: ["Space"], labelRequired: true }),
      expect.objectContaining({ surface: "review", keys: ["Esc"], labelRequired: true }),
      expect.objectContaining({ surface: "library", keys: ["/"], labelRequired: true }),
      expect.objectContaining({ surface: "card_detail", keys: ["Enter"], labelRequired: true }),
      expect.objectContaining({ surface: "modal", keys: ["Esc"], labelRequired: true }),
      expect.objectContaining({ surface: "onboarding", keys: ["Tab", "Enter"], labelRequired: true }),
    ]))
  })

  it("requires state copy to include text, a non-color cue, and actions for blocking states", () => {
    expect(ASTRA_ACCESSIBILITY_STATE_RULES.map((rule) => rule.state)).toEqual([
      "success",
      "warning",
      "error",
      "loading",
      "pro_limit",
      "review_due",
    ])
    expect(validateAstraAccessibilityStateCopy(completeStateCopy)).toEqual([])

    expect(validateAstraAccessibilityStateCopy([
      ...completeStateCopy.filter((item) => item.state !== "error" && item.state !== "pro_limit"),
      { state: "error", text: "Translation failed.", nonColorCue: "", actionLabel: "Retry" },
      { state: "pro_limit", text: "Pro limit reached.", nonColorCue: "limit badge" },
    ])).toEqual(["error", "pro_limit"])
  })

  it("defines the manual evidence packet rows required before broad accessibility claims", () => {
    expect(ASTRA_ACCESSIBILITY_MANUAL_EVIDENCE_ROWS.map((row) => row.id)).toEqual([
      "no_mouse_popup",
      "no_mouse_onboarding",
      "no_mouse_settings_options",
      "no_mouse_selection_toolbar",
      "no_mouse_library_review",
      "contrast_scaled_text",
      "reduced_motion",
      "screen_reader_spot_check",
    ])
    expect(ASTRA_ACCESSIBILITY_MANUAL_EVIDENCE_ROWS.every((row) => row.requiredForBroadClaim)).toBe(true)
  })

  it("keeps the macro manual QA checklist Section 32 aligned with the typed manual evidence rows", () => {
    const checklist = readFileSync("docs/reviews/macro-manual-qa-evidence-checklist-2026-05-28.md", "utf8")
    const section32 = checklist.split("## Section 32 — Accessibility manual QA")[1]?.split("## Release interpretation")[0] ?? ""

    expect(ASTRA_ACCESSIBILITY_MANUAL_EVIDENCE_ROWS.map((row) => row.label)).toEqual([
      "No-mouse popup",
      "No-mouse onboarding",
      "No-mouse settings/options",
      "No-mouse selection toolbar",
      "No-mouse Library/Review",
      "Contrast/scaled text",
      "Reduced motion",
      "Screen reader spot check",
    ])
    for (const row of ASTRA_ACCESSIBILITY_MANUAL_EVIDENCE_ROWS) {
      expect(section32).toContain(`| ${row.label} |`)
    }
  })

  it("accepts a manual evidence packet only when every row is run and evidence-backed", () => {
    expect(evaluateAstraAccessibilityManualEvidencePacket(completeManualEvidence)).toEqual({
      acceptable: true,
      findings: [],
    })
  })

  it("rejects duplicate, unknown, and placeholder manual accessibility evidence rows", () => {
    const decision = evaluateAstraAccessibilityManualEvidencePacket([
      ...completeManualEvidence.filter((row) => row.id !== "no_mouse_onboarding"),
      completeManualEvidence[0],
      {
        id: "untracked_accessibility_row" as never,
        verdict: "pass",
        ownerDate: "qa-owner@astra.ai — 2026-05-28",
        environment: "Chrome MV3 build, macOS, keyboard-only walkthrough",
        evidenceLink: "docs/reviews/accessibility-manual/untracked.md",
      },
      {
        ...completeManualEvidence[1],
        id: "no_mouse_onboarding",
        evidenceLink: "https://example.com/accessibility-placeholder.md",
      },
    ])

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.code)).toEqual([
      "duplicate_row",
      "unknown_row",
      "placeholder_evidence_link",
    ])
  })

  it("rejects reused manual accessibility evidence links across rows", () => {
    const sharedEvidenceLink = "docs/reviews/accessibility-manual/no_mouse_popup-no_mouse_onboarding.md"
    const decision = evaluateAstraAccessibilityManualEvidencePacket([
      {
        ...completeManualEvidence[0],
        evidenceLink: sharedEvidenceLink,
      },
      {
        ...completeManualEvidence[1],
        evidenceLink: sharedEvidenceLink,
      },
      ...completeManualEvidence.slice(2),
    ])

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.code)).toEqual(["duplicate_evidence_link"])
  })

  it("rejects manual accessibility evidence links that point at a different row", () => {
    const decision = evaluateAstraAccessibilityManualEvidencePacket([
      {
        ...completeManualEvidence[0],
        evidenceLink: "docs/reviews/accessibility-manual/screen-reader-spot-check.md",
      },
      ...completeManualEvidence.slice(1),
    ])

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => [finding.code, finding.rowId])).toEqual([
      ["invalid_evidence_link", "no_mouse_popup"],
    ])
  })

  it("rejects generic owners, weak environments, and unsafe manual evidence links", () => {
    const decision = evaluateAstraAccessibilityManualEvidencePacket([
      {
        ...completeManualEvidence[0],
        ownerDate: "QA owner — 2026-05-28",
        environment: "Chrome",
        evidenceLink: "docs/reviews/draft-accessibility.md",
      },
      ...completeManualEvidence.slice(1),
    ])

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.code)).toEqual([
      "invalid_owner",
      "invalid_environment",
      "invalid_evidence_link",
    ])
  })

  it("rejects not-run, failed, and unlinked manual evidence rows", () => {
    const decision = evaluateAstraAccessibilityManualEvidencePacket([
      ...completeManualEvidence.filter((row) => row.id !== "screen_reader_spot_check" && row.id !== "no_mouse_popup"),
      {
        id: "no_mouse_popup",
        verdict: "fail",
        ownerDate: "",
        environment: "",
        evidenceLink: "",
      },
      {
        id: "screen_reader_spot_check",
        verdict: "not_run",
        ownerDate: "",
        environment: "",
        evidenceLink: "",
      },
    ])

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.code)).toEqual([
      "failed_row",
      "missing_owner",
      "missing_environment",
      "missing_evidence_link",
      "not_run",
    ])
  })

  it("tracks component-label coverage for shared Toast, Review, Library, onboarding, and support/report flow", () => {
    expect(ASTRA_ACCESSIBILITY_COMPONENT_LABELS.map((item) => item.component)).toEqual(expect.arrayContaining([
      "Toast",
      "FloatBall",
      "SelectionToolbar",
      "HoverTranslate",
      "InputTranslate",
      "ReviewMode",
      "LibrarySearchAndFilters",
      "OnboardingApp",
      "SupportReportFlow",
    ]))
    expect(ASTRA_ACCESSIBILITY_COMPONENT_LABELS.find((item) => item.component === "Toast")?.stateAnnouncement)
      .toContain("aria-live")
  })

  it("passes readiness when P0 and P1 evidence are present", () => {
    const decision = evaluateAstraAccessibilityReadiness(readyEvidence)

    expect(decision.ready).toBe(true)
    expect(decision.blockers).toEqual([])
    expect(decision.warnings).toEqual([])
  })

  it("blocks readiness when P0 main-flow keyboard, labels, state, error, toast, paywall, and support evidence are missing", () => {
    const decision = evaluateAstraAccessibilityReadiness({
      ...readyEvidence,
      popupTabOrderComplete: false,
      onboardingKeyboardWalkthrough: false,
      p0ButtonsHaveUnderstandableLabels: false,
      statesNotColorOnly: false,
      errorCardsHaveActions: false,
      toastAriaLiveNonBlocking: false,
      settingsFormsLabeled: false,
      supportReportAccessible: false,
      paywallPriceLimitCtaReadable: false,
      librarySearchFilterListKeyboard: false,
    })

    expect(decision.ready).toBe(false)
    expect(decision.blockers.map((finding) => finding.code)).toEqual([
      "popup_tab_order",
      "p0_button_labels",
      "onboarding_keyboard",
      "settings_form_labels",
      "support_report_accessible",
      "paywall_readable",
      "library_search_filter_keyboard",
      "state_not_color_only",
      "error_card_text_action",
      "toast_aria_live_nonblocking",
    ])
  })

  it("keeps P1 review shortcuts, reduced motion, and scaled text as warnings instead of release blockers", () => {
    const decision = evaluateAstraAccessibilityReadiness({
      ...readyEvidence,
      reviewShortcutsLabeled: false,
      prefersReducedMotionSupported: false,
      scaledTextMainUiChecked: false,
    })

    expect(decision.ready).toBe(true)
    expect(decision.warnings.map((finding) => finding.code)).toEqual([
      "review_shortcuts_labels",
      "prefers_reduced_motion",
      "text_scaling",
    ])
  })
})
