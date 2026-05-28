import { describe, expect, it } from "vitest"

import {
  ASTRA_OPS_AUDIT_EVENTS,
  ASTRA_OPS_CONSOLE_MODULES,
  ASTRA_OPS_PROHIBITED_CONTENT_FIELDS,
  ASTRA_OPS_ROLES,
  evaluateAstraOpsConsoleReadiness,
  moduleAllowsDefaultField,
  roleCanPerform,
  roleCanViewModule,
  type AstraOpsReadinessEvidence,
} from "./ops-console"

const readyEvidence: AstraOpsReadinessEvidence = {
  metadataOnlyDefault: true,
  actionableSupportFieldsAvailable: true,
  featureFlagRollbackAvailable: true,
  sensitiveActionsAudited: true,
  leastPrivilegeRolesDefined: true,
  consentedContentMarked: true,
  dataRequestsCanBeHandled: true,
  serviceHealthVisible: true,
  supportTicketTriageAvailable: true,
}

describe("Astra operations console contract", () => {
  it("defines the first-version module information architecture without default content fields", () => {
    expect(ASTRA_OPS_CONSOLE_MODULES.map((module) => module.id)).toEqual([
      "user_overview",
      "membership",
      "device_version",
      "recent_errors",
      "usage_summary",
      "feature_flags",
      "support_tickets",
      "service_health",
      "audit_log",
    ])

    for (const module of ASTRA_OPS_CONSOLE_MODULES) {
      expect(module.firstVersionFields.length).toBeGreaterThan(0)
      expect(module.prohibitedByDefaultFields).toEqual(expect.arrayContaining(["pageText", "promptText", "modelOutputText"]))
    }
    expect(moduleAllowsDefaultField("support_tickets", "featureSurface")).toBe(true)
    expect(moduleAllowsDefaultField("support_tickets", "pageText")).toBe(false)
    expect(ASTRA_OPS_PROHIBITED_CONTENT_FIELDS).toContain("videoTranscriptText")
  })

  it("defines least-privilege roles and keeps content access consent-scoped", () => {
    expect(ASTRA_OPS_ROLES.map((role) => role.id)).toEqual([
      "support_agent",
      "support_lead",
      "ops_engineer",
      "admin",
      "privacy_reviewer",
    ])

    expect(roleCanPerform("support_agent", "reply_to_ticket")).toBe(true)
    expect(roleCanPerform("support_agent", "toggle_feature_flag")).toBe(false)
    expect(roleCanPerform("ops_engineer", "activate_kill_switch")).toBe(true)
    expect(roleCanPerform("ops_engineer", "issue_refund")).toBe(false)
    expect(roleCanPerform("privacy_reviewer", "view_consented_content")).toBe(true)
    expect(roleCanViewModule("support_agent", "support_tickets")).toBe(true)
    expect(roleCanViewModule("support_agent", "audit_log")).toBe(false)
    expect(roleCanViewModule("privacy_reviewer", "audit_log")).toBe(true)
    expect(ASTRA_OPS_ROLES.find((role) => role.id === "privacy_reviewer")?.contentAccess).toBe("consented_content_only")
  })

  it("requires audit events for sensitive staff operations", () => {
    const sensitiveEvents = ASTRA_OPS_AUDIT_EVENTS.filter((event) => event.sensitive)
    expect(sensitiveEvents.map((event) => event.type)).toEqual([
      "refund_requested",
      "refund_issued",
      "feature_flag_updated",
      "kill_switch_changed",
      "support_content_viewed",
      "data_request_handled",
      "role_changed",
    ])
    for (const event of sensitiveEvents) {
      expect(event.reasonRequired).toBe(true)
      expect(event.requiredFields).toEqual(expect.arrayContaining(["actor", "reason", "createdAt"]))
    }
    expect(ASTRA_OPS_AUDIT_EVENTS.find((event) => event.type === "support_content_viewed")?.requiredFields)
      .toEqual(expect.arrayContaining(["userConsent", "contentType"]))
  })

  it("passes readiness when metadata-only, roles, audit, support, flags, and health evidence exist", () => {
    const decision = evaluateAstraOpsConsoleReadiness(readyEvidence)

    expect(decision.ready).toBe(true)
    expect(decision.findings).toEqual([])
  })

  it("blocks readiness when required ops-console guarantees are missing", () => {
    const decision = evaluateAstraOpsConsoleReadiness({
      metadataOnlyDefault: false,
      actionableSupportFieldsAvailable: false,
      featureFlagRollbackAvailable: false,
      sensitiveActionsAudited: false,
      leastPrivilegeRolesDefined: false,
      consentedContentMarked: false,
      dataRequestsCanBeHandled: false,
      serviceHealthVisible: false,
      supportTicketTriageAvailable: false,
    })

    expect(decision.ready).toBe(false)
    expect(decision.findings.map((finding) => finding.code)).toEqual([
      "metadata_only_default",
      "actionable_support_fields",
      "feature_flag_rollback",
      "sensitive_action_audit",
      "role_matrix",
      "consented_content_marker",
      "data_request_handling",
      "service_health_visibility",
      "support_ticket_triage",
    ])
  })
})
