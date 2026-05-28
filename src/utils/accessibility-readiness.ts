export type AstraAccessibilitySurfaceId =
  | "popup"
  | "onboarding"
  | "settings"
  | "selection_toolbar"
  | "review"
  | "library"
  | "paywall"
  | "support_report"
  | "toast"
  | "error_card"

export type AstraAccessibilityPrincipleId =
  | "keyboard_first"
  | "screen_reader_readable"
  | "contrast_sufficient"
  | "motion_respectful"
  | "text_scalable"
  | "error_explicit"
  | "touch_friendly"

export type AstraAccessibilityRequirementId =
  | "popup_tab_order"
  | "p0_button_labels"
  | "onboarding_keyboard"
  | "review_shortcuts_labels"
  | "library_search_filter_keyboard"
  | "paywall_readable"
  | "error_card_text_action"
  | "toast_aria_live_nonblocking"
  | "settings_form_labels"
  | "prefers_reduced_motion"
  | "text_scaling"
  | "state_not_color_only"
  | "support_report_accessible"

export type AstraAccessibilityShortcutSurface = "review" | "library" | "card_detail" | "modal" | "onboarding"

export type AstraAccessibilityStateKind =
  | "success"
  | "warning"
  | "error"
  | "loading"
  | "pro_limit"
  | "review_due"

export type AstraAccessibilityReadinessCode = AstraAccessibilityRequirementId

export type AstraAccessibilityManualEvidenceRowId =
  | "no_mouse_popup"
  | "no_mouse_onboarding"
  | "no_mouse_settings_options"
  | "no_mouse_selection_toolbar"
  | "no_mouse_library_review"
  | "contrast_scaled_text"
  | "reduced_motion"
  | "screen_reader_spot_check"

export type AstraAccessibilityManualEvidenceVerdict = "pass" | "pass_with_downgrade" | "fail" | "not_run"

export type AstraAccessibilityManualEvidenceFindingCode =
  | "unknown_row"
  | "duplicate_row"
  | "missing_row"
  | "not_run"
  | "missing_owner"
  | "missing_environment"
  | "missing_evidence_link"
  | "placeholder_evidence_link"
  | "failed_row"

export interface AstraAccessibilityRequirementDefinition {
  id: AstraAccessibilityRequirementId
  surface: AstraAccessibilitySurfaceId
  priority: "P0" | "P1"
  label: string
  acceptance: string
  evidence: string
}

export interface AstraAccessibilityShortcutDefinition {
  surface: AstraAccessibilityShortcutSurface
  keys: string[]
  behavior: string
  labelRequired: boolean
}

export interface AstraAccessibilityStateRuleDefinition {
  state: AstraAccessibilityStateKind
  requiresText: boolean
  requiresNonColorCue: boolean
  exampleCopy: string
}

export interface AstraAccessibilityComponentLabelDefinition {
  component: string
  surface: AstraAccessibilitySurfaceId
  requiredAccessibleName: string
  stateAnnouncement?: string
}

export interface AstraAccessibilityReadinessEvidence {
  popupTabOrderComplete: boolean
  onboardingKeyboardWalkthrough: boolean
  p0ButtonsHaveUnderstandableLabels: boolean
  statesNotColorOnly: boolean
  errorCardsHaveActions: boolean
  toastAriaLiveNonBlocking: boolean
  settingsFormsLabeled: boolean
  supportReportAccessible: boolean
  paywallPriceLimitCtaReadable: boolean
  librarySearchFilterListKeyboard: boolean
  reviewShortcutsLabeled: boolean
  prefersReducedMotionSupported: boolean
  scaledTextMainUiChecked: boolean
}

export interface AstraAccessibilityStateCopyEvidence {
  state: AstraAccessibilityStateKind
  text: string
  nonColorCue: string
  actionLabel?: string
}

export interface AstraAccessibilityManualEvidenceRowDefinition {
  id: AstraAccessibilityManualEvidenceRowId
  label: string
  acceptance: string
  requiredForBroadClaim: boolean
}

export interface AstraAccessibilityManualEvidenceRowResult {
  id: AstraAccessibilityManualEvidenceRowId
  verdict: AstraAccessibilityManualEvidenceVerdict
  ownerDate: string
  environment: string
  evidenceLink: string
}

export interface AstraAccessibilityManualEvidenceFinding {
  code: AstraAccessibilityManualEvidenceFindingCode
  rowId: AstraAccessibilityManualEvidenceRowId
  message: string
  nextStep: string
}

export interface AstraAccessibilityManualEvidenceDecision {
  acceptable: boolean
  findings: AstraAccessibilityManualEvidenceFinding[]
}

export interface AstraAccessibilityReadinessFinding {
  code: AstraAccessibilityReadinessCode
  severity: "block" | "warn"
  message: string
  nextStep: string
}

export interface AstraAccessibilityReadinessDecision {
  ready: boolean
  blockers: AstraAccessibilityReadinessFinding[]
  warnings: AstraAccessibilityReadinessFinding[]
  findings: AstraAccessibilityReadinessFinding[]
}

export const ASTRA_ACCESSIBILITY_PRINCIPLES: Record<AstraAccessibilityPrincipleId, string> = {
  keyboard_first: "Every launch-critical task can be completed without a mouse.",
  screen_reader_readable: "Controls, status updates, errors, and shortcuts expose meaningful names and announcements.",
  contrast_sufficient: "Text and meaningful states remain legible in the default light theme and dark/system contexts.",
  motion_respectful: "Non-essential animation is disabled or shortened when prefers-reduced-motion is enabled.",
  text_scalable: "Primary flows tolerate larger text without hiding required controls.",
  error_explicit: "Failures include text, cause, and a next action instead of relying on color or icons.",
  touch_friendly: "Interactive targets remain usable on extension popups, panels, and mobile-sized web surfaces.",
}

export const ASTRA_ACCESSIBILITY_REQUIREMENTS: AstraAccessibilityRequirementDefinition[] = [
  {
    id: "popup_tab_order",
    surface: "popup",
    priority: "P0",
    label: "Popup tab order and primary action label",
    acceptance: "Popup can be traversed in a logical order and the main button describes the resulting action.",
    evidence: "Manual keyboard walkthrough plus component label inspection.",
  },
  {
    id: "p0_button_labels",
    surface: "popup",
    priority: "P0",
    label: "P0 buttons have understandable labels",
    acceptance: "Every launch-critical button/control uses visible or programmatic text that describes the user outcome.",
    evidence: "Component-label checklist plus focused component tests for icon-only controls.",
  },
  {
    id: "onboarding_keyboard",
    surface: "onboarding",
    priority: "P0",
    label: "Onboarding keyboard walkthrough",
    acceptance: "A new user can complete the first-run walkthrough with Tab and Enter.",
    evidence: "OnboardingApp keyboard test or manual keyboard-test.md row.",
  },
  {
    id: "settings_form_labels",
    surface: "settings",
    priority: "P0",
    label: "Settings form labels",
    acceptance: "Inputs, segmented controls, and toggles expose stable visible labels or aria labels.",
    evidence: "Options/settings label checklist.",
  },
  {
    id: "support_report_accessible",
    surface: "support_report",
    priority: "P0",
    label: "Support/report flow labels and status",
    acceptance: "Report controls are labeled and submission, error, and privacy-copy states are announced in text.",
    evidence: "Support/report component label checklist and status audit.",
  },
  {
    id: "paywall_readable",
    surface: "paywall",
    priority: "P0",
    label: "Paywall price, limits, and CTA readability",
    acceptance: "Plan price, quota/limit copy, cancellation boundary, and CTA labels are explicit without color-only meaning.",
    evidence: "Paywall copy/label audit.",
  },
  {
    id: "library_search_filter_keyboard",
    surface: "library",
    priority: "P0",
    label: "Library search/filter/list keyboard access",
    acceptance: "Search, filter controls, source rows, and detail entry are keyboard reachable with visible focus.",
    evidence: "Library keyboard test and component label checklist.",
  },
  {
    id: "state_not_color_only",
    surface: "error_card",
    priority: "P0",
    label: "State is not color-only",
    acceptance: "Success, warning, error, loading, Pro limit, and review-due states include text plus a non-color cue.",
    evidence: "State-copy inventory checked by validateAstraAccessibilityStateCopy().",
  },
  {
    id: "error_card_text_action",
    surface: "error_card",
    priority: "P0",
    label: "Error cards include text and action",
    acceptance: "Every launch-critical error card explains what happened and exposes a retry, settings, learn-more, or dismiss action.",
    evidence: "Error-card inventory and tests for actionable copy.",
  },
  {
    id: "toast_aria_live_nonblocking",
    surface: "toast",
    priority: "P0",
    label: "Toast aria-live and non-blocking behavior",
    acceptance: "Toast messages use polite/assertive live regions, include accessible action/dismiss labels, and do not trap focus.",
    evidence: "Toast component tests and shared Toast adoption checklist.",
  },
  {
    id: "review_shortcuts_labels",
    surface: "review",
    priority: "P1",
    label: "Review shortcuts and labels",
    acceptance: "Review supports documented 1/2/3, Space, and Esc shortcuts with visible or discoverable labels.",
    evidence: "ReviewMode shortcut tests and keyboard-test.md row.",
  },
  {
    id: "prefers_reduced_motion",
    surface: "selection_toolbar",
    priority: "P1",
    label: "Reduced-motion CSS rules",
    acceptance: "Global UI and progress/overlay animation respect prefers-reduced-motion.",
    evidence: "CSS audit for @media (prefers-reduced-motion: reduce).",
  },
  {
    id: "text_scaling",
    surface: "popup",
    priority: "P1",
    label: "Scaled text main UI check",
    acceptance: "Popup, onboarding, Review, Library, paywall, and support/report critical controls remain visible at increased text size.",
    evidence: "Manual scaled-text pass recorded in accessibility-audit.md.",
  },
]

export const ASTRA_ACCESSIBILITY_SHORTCUTS: AstraAccessibilityShortcutDefinition[] = [
  { surface: "review", keys: ["1", "2", "3"], behavior: "Grade the current card response.", labelRequired: true },
  { surface: "review", keys: ["Space"], behavior: "Reveal, continue, or advance the current review card.", labelRequired: true },
  { surface: "review", keys: ["Esc"], behavior: "Exit the active review interaction or close a nested panel.", labelRequired: true },
  { surface: "library", keys: ["/"], behavior: "Focus Library search.", labelRequired: true },
  { surface: "card_detail", keys: ["Enter"], behavior: "Open the focused card or source detail.", labelRequired: true },
  { surface: "modal", keys: ["Esc"], behavior: "Close the modal without losing the parent task context.", labelRequired: true },
  { surface: "onboarding", keys: ["Tab", "Enter"], behavior: "Move through and confirm onboarding choices.", labelRequired: true },
]

export const ASTRA_ACCESSIBILITY_STATE_RULES: AstraAccessibilityStateRuleDefinition[] = [
  { state: "success", requiresText: true, requiresNonColorCue: true, exampleCopy: "Saved. Review is ready." },
  { state: "warning", requiresText: true, requiresNonColorCue: true, exampleCopy: "Check this setting before continuing." },
  { state: "error", requiresText: true, requiresNonColorCue: true, exampleCopy: "Translation failed. Retry or change provider." },
  { state: "loading", requiresText: true, requiresNonColorCue: true, exampleCopy: "Loading review cards…" },
  { state: "pro_limit", requiresText: true, requiresNonColorCue: true, exampleCopy: "Pro limit reached. Upgrade or wait for reset." },
  { state: "review_due", requiresText: true, requiresNonColorCue: true, exampleCopy: "12 cards due today." },
]

export const ASTRA_ACCESSIBILITY_MANUAL_EVIDENCE_ROWS: AstraAccessibilityManualEvidenceRowDefinition[] = [
  {
    id: "no_mouse_popup",
    label: "No-mouse popup",
    acceptance: "Complete popup first action using keyboard only with logical focus order and visible focus.",
    requiredForBroadClaim: true,
  },
  {
    id: "no_mouse_onboarding",
    label: "No-mouse onboarding",
    acceptance: "Complete first-run onboarding with Tab/Enter only and textual validation/error states.",
    requiredForBroadClaim: true,
  },
  {
    id: "no_mouse_settings_options",
    label: "No-mouse settings/options",
    acceptance: "Change and restore a representative setting by keyboard with labeled controls and status text.",
    requiredForBroadClaim: true,
  },
  {
    id: "no_mouse_selection_toolbar",
    label: "No-mouse selection toolbar",
    acceptance: "Open Astra controls from selected text and operate translate/save/report/close by keyboard.",
    requiredForBroadClaim: true,
  },
  {
    id: "no_mouse_library_review",
    label: "No-mouse Library/Review",
    acceptance: "Use Library search/filter/detail and Review controls by keyboard with visible/discoverable shortcuts.",
    requiredForBroadClaim: true,
  },
  {
    id: "contrast_scaled_text",
    label: "Contrast/scaled text",
    acceptance: "Verify text, state badges, focus rings, and required controls remain readable at increased text size.",
    requiredForBroadClaim: true,
  },
  {
    id: "reduced_motion",
    label: "Reduced motion",
    acceptance: "Verify non-essential motion is removed or shortened and loading/progress remains text-visible.",
    requiredForBroadClaim: true,
  },
  {
    id: "screen_reader_spot_check",
    label: "Screen reader spot check",
    acceptance: "Spot-check headings, labels, live/status copy, shortcuts, and error cards on launch-critical surfaces.",
    requiredForBroadClaim: true,
  },
]

export const ASTRA_ACCESSIBILITY_COMPONENT_LABELS: AstraAccessibilityComponentLabelDefinition[] = [
  {
    component: "Toast",
    surface: "toast",
    requiredAccessibleName: "Toast region plus message, optional action, and dismiss labels",
    stateAnnouncement: "polite or assertive aria-live",
  },
  {
    component: "FloatBall",
    surface: "selection_toolbar",
    requiredAccessibleName: "Open Astra menu, menu item, progress, and cancel labels",
    stateAnnouncement: "translation/report status live region",
  },
  {
    component: "SelectionToolbar",
    surface: "selection_toolbar",
    requiredAccessibleName: "Translate, save, report, and close controls",
    stateAnnouncement: "selection/translation status live region",
  },
  {
    component: "HoverTranslate",
    surface: "selection_toolbar",
    requiredAccessibleName: "Translation card controls and status",
    stateAnnouncement: "translation loading/error/result status",
  },
  {
    component: "InputTranslate",
    surface: "selection_toolbar",
    requiredAccessibleName: "Input translation controls and provider/status copy",
    stateAnnouncement: "translation loading/error/result status",
  },
  {
    component: "ReviewMode",
    surface: "review",
    requiredAccessibleName: "Review answer buttons, reveal/continue control, and shortcut hints",
    stateAnnouncement: "review due/result status text",
  },
  {
    component: "LibrarySearchAndFilters",
    surface: "library",
    requiredAccessibleName: "Search field, source-type filters, source list rows, and detail entry labels",
  },
  {
    component: "OnboardingApp",
    surface: "onboarding",
    requiredAccessibleName: "Goal, language, and provider choices plus next/finish controls",
  },
  {
    component: "SupportReportFlow",
    surface: "support_report",
    requiredAccessibleName: "Problem category, description, privacy preview, submit, and status labels",
    stateAnnouncement: "submission success/error live region",
  },
]

const READINESS_CHECKS: Array<{
  code: AstraAccessibilityReadinessCode
  evidenceKey: keyof AstraAccessibilityReadinessEvidence
  severity: "block" | "warn"
  message: string
  nextStep: string
}> = [
  {
    code: "popup_tab_order",
    evidenceKey: "popupTabOrderComplete",
    severity: "block",
    message: "Popup keyboard order or primary action labeling is not proven.",
    nextStep: "Complete the popup no-mouse walkthrough and record the primary button label.",
  },
  {
    code: "p0_button_labels",
    evidenceKey: "p0ButtonsHaveUnderstandableLabels",
    severity: "block",
    message: "Some P0 controls do not have understandable accessible labels.",
    nextStep: "Audit launch-critical buttons and icon-only controls against component-labels.md.",
  },
  {
    code: "onboarding_keyboard",
    evidenceKey: "onboardingKeyboardWalkthrough",
    severity: "block",
    message: "Onboarding cannot yet be released as a keyboard-first first-run flow.",
    nextStep: "Verify Tab/Enter can complete onboarding and add/refresh tests where possible.",
  },
  {
    code: "settings_form_labels",
    evidenceKey: "settingsFormsLabeled",
    severity: "block",
    message: "Settings form labels are not fully accounted for.",
    nextStep: "Audit every settings input/toggle/segmented control for visible or accessible labels.",
  },
  {
    code: "support_report_accessible",
    evidenceKey: "supportReportAccessible",
    severity: "block",
    message: "Support/report controls or status copy are not fully accessible.",
    nextStep: "Confirm report controls, privacy copy, and submit/error/success states expose text labels.",
  },
  {
    code: "paywall_readable",
    evidenceKey: "paywallPriceLimitCtaReadable",
    severity: "block",
    message: "Paywall price, limit, or CTA copy is not proven readable.",
    nextStep: "Audit plan price, quota, cancellation, and CTA copy without relying on color or icon-only cues.",
  },
  {
    code: "library_search_filter_keyboard",
    evidenceKey: "librarySearchFilterListKeyboard",
    severity: "block",
    message: "Library search/filter/list keyboard access is not proven.",
    nextStep: "Verify / focus, filter traversal, row focus, and Enter detail behavior.",
  },
  {
    code: "state_not_color_only",
    evidenceKey: "statesNotColorOnly",
    severity: "block",
    message: "Some launch-critical states may rely on color alone.",
    nextStep: "Inventory success, warning, error, loading, Pro-limit, and review-due states for text plus non-color cues.",
  },
  {
    code: "error_card_text_action",
    evidenceKey: "errorCardsHaveActions",
    severity: "block",
    message: "Error cards do not all have an explicit recovery action.",
    nextStep: "Add retry, settings, learn-more, dismiss, or contact-support action labels to every P0 error card.",
  },
  {
    code: "toast_aria_live_nonblocking",
    evidenceKey: "toastAriaLiveNonBlocking",
    severity: "block",
    message: "Toast live-region and non-blocking behavior is not proven.",
    nextStep: "Keep shared Toast tests green and migrate remaining blocking/toast-like status messages to the shared primitive.",
  },
  {
    code: "review_shortcuts_labels",
    evidenceKey: "reviewShortcutsLabeled",
    severity: "warn",
    message: "Review shortcuts are not fully documented and labeled.",
    nextStep: "Expose/discover labels for 1/2/3, Space, and Esc and cover them in Review keyboard tests.",
  },
  {
    code: "prefers_reduced_motion",
    evidenceKey: "prefersReducedMotionSupported",
    severity: "warn",
    message: "Reduced-motion support is not proven for the main UI stack.",
    nextStep: "Keep global @media (prefers-reduced-motion: reduce) rules and audit overlay/progress animation.",
  },
  {
    code: "text_scaling",
    evidenceKey: "scaledTextMainUiChecked",
    severity: "warn",
    message: "Scaled-text behavior is not fully checked for the main UI.",
    nextStep: "Record popup, onboarding, Review, Library, paywall, and support/report increased-text walkthroughs.",
  },
]

function makeManualEvidenceFinding(
  code: AstraAccessibilityManualEvidenceFindingCode,
  rowId: AstraAccessibilityManualEvidenceRowId,
  message: string,
  nextStep: string,
): AstraAccessibilityManualEvidenceFinding {
  return { code, rowId, message, nextStep }
}

function blank(value: string): boolean {
  return value.trim().length === 0
}

function isPlaceholderEvidenceReference(value: string): boolean {
  const normalizedValue = value.toLowerCase()
  return normalizedValue.includes("example") || normalizedValue.includes("placeholder") || normalizedValue.includes("todo")
}

export function evaluateAstraAccessibilityManualEvidencePacket(
  rows: readonly AstraAccessibilityManualEvidenceRowResult[],
): AstraAccessibilityManualEvidenceDecision {
  const findings: AstraAccessibilityManualEvidenceFinding[] = []
  const expectedRowIds = new Set<AstraAccessibilityManualEvidenceRowId>(ASTRA_ACCESSIBILITY_MANUAL_EVIDENCE_ROWS.map((row) => row.id))
  const rowsById = new Map<AstraAccessibilityManualEvidenceRowId, AstraAccessibilityManualEvidenceRowResult>()

  for (const row of rows) {
    if (!expectedRowIds.has(row.id)) {
      findings.push(makeManualEvidenceFinding(
        "unknown_row",
        row.id,
        `${row.id} is not a tracked manual accessibility evidence row.`,
        "Use a row id from ASTRA_ACCESSIBILITY_MANUAL_EVIDENCE_ROWS.",
      ))
      continue
    }
    if (rowsById.has(row.id)) {
      findings.push(makeManualEvidenceFinding(
        "duplicate_row",
        row.id,
        `${row.id} has duplicate manual accessibility evidence rows.`,
        "Keep one manual accessibility evidence row per required row id.",
      ))
      continue
    }
    rowsById.set(row.id, row)
  }

  for (const requiredRow of ASTRA_ACCESSIBILITY_MANUAL_EVIDENCE_ROWS) {
    const row = rowsById.get(requiredRow.id)
    if (!row) {
      findings.push(makeManualEvidenceFinding(
        "missing_row",
        requiredRow.id,
        `${requiredRow.label} evidence row is missing.`,
        "Add the row to the Section 32 manual accessibility evidence packet.",
      ))
      continue
    }

    if (row.verdict === "not_run") {
      findings.push(makeManualEvidenceFinding(
        "not_run",
        row.id,
        `${requiredRow.label} has not been run manually.`,
        "Run the built-surface walkthrough and record owner/date/environment/evidence/verdict.",
      ))
    }

    if (row.verdict === "fail") {
      findings.push(makeManualEvidenceFinding(
        "failed_row",
        row.id,
        `${requiredRow.label} failed manual accessibility evidence.`,
        "Fix or downgrade the affected surface before broad accessibility claims.",
      ))
    }

    if (row.verdict !== "not_run") {
      if (blank(row.ownerDate)) {
        findings.push(makeManualEvidenceFinding("missing_owner", row.id, `${requiredRow.label} is missing owner/date.`, "Record owner and date for the manual run."))
      }
      if (blank(row.environment)) {
        findings.push(makeManualEvidenceFinding("missing_environment", row.id, `${requiredRow.label} is missing environment.`, "Record browser, OS, build, and assistive-technology context where relevant."))
      }
      if (blank(row.evidenceLink)) {
        findings.push(makeManualEvidenceFinding("missing_evidence_link", row.id, `${requiredRow.label} is missing evidence link.`, "Attach screenshots, notes, logs, video, or checklist evidence for the run."))
      } else if (isPlaceholderEvidenceReference(row.evidenceLink)) {
        findings.push(makeManualEvidenceFinding("placeholder_evidence_link", row.id, `${requiredRow.label} evidence link is placeholder evidence.`, "Attach the real screenshots, notes, logs, video, or checklist evidence for the run."))
      }
    }
  }

  return { acceptable: findings.length === 0, findings }
}

export function validateAstraAccessibilityStateCopy(
  evidence: AstraAccessibilityStateCopyEvidence[],
): AstraAccessibilityStateKind[] {
  const invalid = new Set<AstraAccessibilityStateKind>()
  const evidenceByState = new Map(evidence.map((item) => [item.state, item]))

  for (const rule of ASTRA_ACCESSIBILITY_STATE_RULES) {
    const item = evidenceByState.get(rule.state)
    if (!item) {
      invalid.add(rule.state)
      continue
    }

    const hasText = item.text.trim().length > 0
    const hasCue = item.nonColorCue.trim().length > 0
    const actionRequired = item.state === "error" || item.state === "pro_limit"
    const hasAction = !actionRequired || (item.actionLabel?.trim().length ?? 0) > 0

    if (!hasText || !hasCue || !hasAction) {
      invalid.add(rule.state)
    }
  }

  return [...invalid]
}

export function evaluateAstraAccessibilityReadiness(
  evidence: AstraAccessibilityReadinessEvidence,
): AstraAccessibilityReadinessDecision {
  const findings = READINESS_CHECKS
    .filter((check) => !evidence[check.evidenceKey])
    .map<AstraAccessibilityReadinessFinding>((check) => ({
      code: check.code,
      severity: check.severity,
      message: check.message,
      nextStep: check.nextStep,
    }))

  const blockers = findings.filter((finding) => finding.severity === "block")
  const warnings = findings.filter((finding) => finding.severity === "warn")

  return {
    ready: blockers.length === 0,
    blockers,
    warnings,
    findings,
  }
}
