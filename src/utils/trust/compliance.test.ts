import { describe, expect, it } from "vitest"

import {
  ASTRA_EXPORT_BOUNDARY_RULES,
  ASTRA_LEGAL_COMPLIANCE_CHECKLIST,
  ASTRA_STORE_PERMISSION_COPY,
  ASTRA_TONE_OF_VOICE_RULES,
  buildAstraStorePermissionTrustViewModel,
  evaluateAstraComplianceReadiness,
} from "./compliance"

describe("Astra legal/trust compliance contract", () => {
  it("covers first implementation legal and store-risk launch blockers", () => {
    expect(ASTRA_LEGAL_COMPLIANCE_CHECKLIST.map((item) => item.area)).toEqual([
      "privacy_policy",
      "terms_refund_ai_notice",
      "store_permissions",
      "copyright_export_boundary",
      "data_deletion",
      "support_consent",
      "legal_review",
    ])
    expect(ASTRA_LEGAL_COMPLIANCE_CHECKLIST.every((item) => item.launchBlocker)).toBe(true)
    expect(ASTRA_LEGAL_COMPLIANCE_CHECKLIST.find((item) => item.area === "support_consent")?.requirement)
      .toContain("metadata-only by default")
  })

  it("keeps store permission copy ordinary and non-technical", () => {
    expect(ASTRA_STORE_PERMISSION_COPY.map((item) => item.permission)).toEqual([
      "page_access",
      "storage",
      "tabs",
      "notifications",
      "identity_account",
      "clipboard_export",
      "downloads_export",
    ])
    const userFacing = ASTRA_STORE_PERMISSION_COPY.map((item) => item.userFacingCopy).join(" ").toLowerCase()
    expect(userFacing).toContain("page you choose")
    expect(userFacing).toContain("only when you choose to copy")
    expect(userFacing).toContain("export a report")
    expect(userFacing).not.toContain("provider")
    expect(userFacing).not.toContain("model")
    expect(userFacing).not.toContain("api key")
    expect(userFacing).not.toContain("token")
    expect(userFacing).not.toContain("prompt")
  })

  it("builds a public permission trust view model from the store copy", () => {
    const viewModel = buildAstraStorePermissionTrustViewModel()

    expect(viewModel.title).toBe("Why Astra asks for browser access")
    expect(viewModel.rows.map((row) => row.permission)).toEqual(ASTRA_STORE_PERMISSION_COPY.map((item) => item.permission))
    expect(viewModel.rows.map((row) => row.label)).toEqual([
      "Page access",
      "Storage",
      "Current tab",
      "Optional reminders",
      "Account continuity",
      "Copy actions",
      "Downloads and exports",
    ])
    expect(viewModel.rows.every((row) => row.userFacingCopy && row.boundary)).toBe(true)
    expect(JSON.stringify(viewModel).toLowerCase()).not.toContain("api key")
  })

  it("makes export and public-share boundaries explicit", () => {
    expect(ASTRA_EXPORT_BOUNDARY_RULES).toContainEqual(expect.objectContaining({
      contentType: "full_page_body",
      defaultPolicy: "blocked",
    }))
    expect(ASTRA_EXPORT_BOUNDARY_RULES).toContainEqual(expect.objectContaining({
      contentType: "public_share",
      defaultPolicy: "user_initiated_only",
    }))
    const serialized = JSON.stringify(ASTRA_EXPORT_BOUNDARY_RULES).toLowerCase()
    expect(serialized).toContain("does not save complete page text by default")
    expect(serialized).toContain("never makes your learning history public by default")
  })

  it("documents brand trust voice without turning limits into technical UI", () => {
    const doSay = ASTRA_TONE_OF_VOICE_RULES.map((item) => item.doSay).join(" ").toLowerCase()
    expect(doSay).toContain("astra ai is ready")
    expect(doSay).toContain("saved for review")
    expect(doSay).not.toContain("provider")
    expect(doSay).not.toContain("model")
    expect(doSay).not.toContain("token")
  })

  it("blocks paid launch until all compliance evidence is present", () => {
    const missing = evaluateAstraComplianceReadiness({
      privacyPolicyChecklist: true,
      termsRefundAiChecklist: false,
      storePermissionCopy: true,
      exportBoundary: true,
      dataDeletionVisible: false,
      supportConsentExplicit: true,
      legalReviewBeforePaidLaunch: false,
    })

    expect(missing.readyForPaidLaunch).toBe(false)
    expect(missing.missingLaunchBlockers.map((item) => item.area)).toEqual([
      "terms_refund_ai_notice",
      "data_deletion",
      "legal_review",
    ])

    expect(evaluateAstraComplianceReadiness({
      privacyPolicyChecklist: true,
      termsRefundAiChecklist: true,
      storePermissionCopy: true,
      exportBoundary: true,
      dataDeletionVisible: true,
      supportConsentExplicit: true,
      legalReviewBeforePaidLaunch: true,
    }).readyForPaidLaunch).toBe(true)
  })
})
