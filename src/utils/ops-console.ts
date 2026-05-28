export type AstraOpsConsoleModuleId =
  | "user_overview"
  | "membership"
  | "device_version"
  | "recent_errors"
  | "usage_summary"
  | "feature_flags"
  | "support_tickets"
  | "service_health"
  | "audit_log"

export type AstraOpsRoleId =
  | "support_agent"
  | "support_lead"
  | "ops_engineer"
  | "admin"
  | "privacy_reviewer"

export type AstraOpsActionId =
  | "reply_to_ticket"
  | "request_refund"
  | "issue_refund"
  | "escalate_ticket"
  | "toggle_feature_flag"
  | "activate_kill_switch"
  | "view_audit_log"
  | "manage_roles"
  | "handle_data_request"
  | "view_consented_content"

export type AstraOpsAuditEventType =
  | "support_triage_updated"
  | "refund_requested"
  | "refund_issued"
  | "feature_flag_updated"
  | "kill_switch_changed"
  | "support_content_viewed"
  | "data_request_handled"
  | "role_changed"

export type AstraOpsReadinessCode =
  | "metadata_only_default"
  | "actionable_support_fields"
  | "feature_flag_rollback"
  | "sensitive_action_audit"
  | "role_matrix"
  | "consented_content_marker"
  | "data_request_handling"
  | "service_health_visibility"
  | "support_ticket_triage"

export interface AstraOpsConsoleModuleDefinition {
  id: AstraOpsConsoleModuleId
  label: string
  purpose: string
  firstVersionFields: string[]
  prohibitedByDefaultFields: string[]
}

export interface AstraOpsRoleDefinition {
  id: AstraOpsRoleId
  label: string
  visibleModules: AstraOpsConsoleModuleId[]
  allowedActions: AstraOpsActionId[]
  contentAccess: "metadata_only" | "consented_content_only" | "audit_admin"
}

export interface AstraOpsAuditEventDefinition {
  type: AstraOpsAuditEventType
  requiredFields: string[]
  sensitive: boolean
  reasonRequired: boolean
}

export interface AstraOpsReadinessEvidence {
  metadataOnlyDefault: boolean
  actionableSupportFieldsAvailable: boolean
  featureFlagRollbackAvailable: boolean
  sensitiveActionsAudited: boolean
  leastPrivilegeRolesDefined: boolean
  consentedContentMarked: boolean
  dataRequestsCanBeHandled: boolean
  serviceHealthVisible: boolean
  supportTicketTriageAvailable: boolean
}

export interface AstraOpsReadinessFinding {
  code: AstraOpsReadinessCode
  severity: "block"
  message: string
  nextStep: string
}

export interface AstraOpsReadinessDecision {
  ready: boolean
  findings: AstraOpsReadinessFinding[]
}

export const ASTRA_OPS_PROHIBITED_CONTENT_FIELDS = [
  "pageText",
  "savedSentenceText",
  "videoTranscriptText",
  "pdfText",
  "userInputText",
  "promptText",
  "modelOutputText",
  "fullUrl",
] as const

export const ASTRA_OPS_CONSOLE_MODULES: AstraOpsConsoleModuleDefinition[] = [
  {
    id: "user_overview",
    label: "User Overview",
    purpose: "Find account/device state needed to support a user.",
    firstVersionFields: ["userId", "emailHash", "plan", "status"],
    prohibitedByDefaultFields: [...ASTRA_OPS_PROHIBITED_CONTENT_FIELDS],
  },
  {
    id: "membership",
    label: "Membership",
    purpose: "Handle plan, renewal, cancellation, and refund questions.",
    firstVersionFields: ["plan", "renewalState", "cancelState", "billingSupportStatus"],
    prohibitedByDefaultFields: [...ASTRA_OPS_PROHIBITED_CONTENT_FIELDS, "paymentCardNumber"],
  },
  {
    id: "device_version",
    label: "Device / Version",
    purpose: "Diagnose browser, extension version, OS, and device compatibility issues.",
    firstVersionFields: ["browser", "extensionVersion", "os", "deviceStatus", "lastSeenAt"],
    prohibitedByDefaultFields: [...ASTRA_OPS_PROHIBITED_CONTENT_FIELDS],
  },
  {
    id: "recent_errors",
    label: "Recent Errors",
    purpose: "Spot failure categories without reading user content.",
    firstVersionFields: ["errorCategory", "featureSurface", "runtimeSurface", "timestamp", "version"],
    prohibitedByDefaultFields: [...ASTRA_OPS_PROHIBITED_CONTENT_FIELDS],
  },
  {
    id: "usage_summary",
    label: "Usage Summary",
    purpose: "Understand quota, abuse, and cost-risk buckets.",
    firstVersionFields: ["tier", "taskClass", "costBucket", "requestCount", "characterBucket", "latencyBucket"],
    prohibitedByDefaultFields: [...ASTRA_OPS_PROHIBITED_CONTENT_FIELDS, "perUserPromptRows"],
  },
  {
    id: "feature_flags",
    label: "Feature Flags",
    purpose: "Roll back or degrade risky surfaces quickly.",
    firstVersionFields: ["flagKey", "status", "rolloutPercent", "killSwitchId", "fallbackMessage", "changedBy", "reason"],
    prohibitedByDefaultFields: [...ASTRA_OPS_PROHIBITED_CONTENT_FIELDS],
  },
  {
    id: "support_tickets",
    label: "Support Tickets",
    purpose: "Triage metadata-only support reports and known-issue links.",
    firstVersionFields: ["ticketId", "status", "priority", "featureSurface", "issueCategory", "hostname", "knownIssueId", "contentIncluded"],
    prohibitedByDefaultFields: ["pageText", "savedSentenceText", "videoTranscriptText", "pdfText", "promptText", "modelOutputText"],
  },
  {
    id: "service_health",
    label: "Service Health",
    purpose: "Monitor aggregate provider, relay, and route health.",
    firstVersionFields: ["route", "serviceMode", "taskClass", "successRate", "fallbackRate", "latencyP95", "status"],
    prohibitedByDefaultFields: [...ASTRA_OPS_PROHIBITED_CONTENT_FIELDS, "perUserRows"],
  },
  {
    id: "audit_log",
    label: "Audit Log",
    purpose: "Explain sensitive staff actions and rollback history.",
    firstVersionFields: ["eventType", "actor", "targetType", "targetId", "reason", "createdAt"],
    prohibitedByDefaultFields: [...ASTRA_OPS_PROHIBITED_CONTENT_FIELDS],
  },
]

export const ASTRA_OPS_ROLES: AstraOpsRoleDefinition[] = [
  {
    id: "support_agent",
    label: "Support Agent",
    visibleModules: ["user_overview", "device_version", "recent_errors", "support_tickets"],
    allowedActions: ["reply_to_ticket", "request_refund", "escalate_ticket"],
    contentAccess: "metadata_only",
  },
  {
    id: "support_lead",
    label: "Support Lead",
    visibleModules: ["user_overview", "membership", "device_version", "recent_errors", "usage_summary", "support_tickets"],
    allowedActions: ["reply_to_ticket", "request_refund", "issue_refund", "escalate_ticket"],
    contentAccess: "metadata_only",
  },
  {
    id: "ops_engineer",
    label: "Ops Engineer",
    visibleModules: ["recent_errors", "usage_summary", "feature_flags", "service_health", "audit_log"],
    allowedActions: ["toggle_feature_flag", "activate_kill_switch", "view_audit_log"],
    contentAccess: "metadata_only",
  },
  {
    id: "admin",
    label: "Admin",
    visibleModules: ["user_overview", "membership", "device_version", "recent_errors", "usage_summary", "feature_flags", "support_tickets", "service_health", "audit_log"],
    allowedActions: ["view_audit_log", "manage_roles", "handle_data_request"],
    contentAccess: "audit_admin",
  },
  {
    id: "privacy_reviewer",
    label: "Privacy Reviewer",
    visibleModules: ["support_tickets", "audit_log"],
    allowedActions: ["view_consented_content", "handle_data_request", "view_audit_log"],
    contentAccess: "consented_content_only",
  },
]

export const ASTRA_OPS_AUDIT_EVENTS: AstraOpsAuditEventDefinition[] = [
  {
    type: "support_triage_updated",
    requiredFields: ["actor", "reportId", "previousStatus", "nextStatus", "reason", "createdAt"],
    sensitive: false,
    reasonRequired: true,
  },
  {
    type: "refund_requested",
    requiredFields: ["actor", "accountId", "reason", "createdAt"],
    sensitive: true,
    reasonRequired: true,
  },
  {
    type: "refund_issued",
    requiredFields: ["actor", "accountId", "reason", "createdAt"],
    sensitive: true,
    reasonRequired: true,
  },
  {
    type: "feature_flag_updated",
    requiredFields: ["actor", "flagKey", "previousStatus", "nextStatus", "reason", "createdAt"],
    sensitive: true,
    reasonRequired: true,
  },
  {
    type: "kill_switch_changed",
    requiredFields: ["actor", "killSwitchId", "enabled", "reason", "createdAt"],
    sensitive: true,
    reasonRequired: true,
  },
  {
    type: "support_content_viewed",
    requiredFields: ["actor", "reportId", "contentType", "userConsent", "reason", "createdAt"],
    sensitive: true,
    reasonRequired: true,
  },
  {
    type: "data_request_handled",
    requiredFields: ["actor", "accountId", "requestType", "reason", "createdAt"],
    sensitive: true,
    reasonRequired: true,
  },
  {
    type: "role_changed",
    requiredFields: ["actor", "targetActor", "previousRole", "nextRole", "reason", "createdAt"],
    sensitive: true,
    reasonRequired: true,
  },
]

const FINDING_COPY: Record<AstraOpsReadinessCode, { message: string; nextStep: string }> = {
  metadata_only_default: {
    message: "Operations console is not evidenced as metadata-only by default.",
    nextStep: "Remove default access to page text, saved sentences, transcripts, PDFs, user input, prompts, model output, and full URLs.",
  },
  actionable_support_fields: {
    message: "Support fields are not actionable enough for common issue triage.",
    nextStep: "Expose account/device/version/error-category/surface/hostname/status metadata without content payloads.",
  },
  feature_flag_rollback: {
    message: "Feature flag or kill-switch rollback controls are missing.",
    nextStep: "Expose audited flag/kill-switch state and user-friendly fallback copy for high-risk features.",
  },
  sensitive_action_audit: {
    message: "Sensitive operations are not audited.",
    nextStep: "Record actor, target, reason, and timestamp for refunds, flag changes, consented-content views, data requests, and role changes.",
  },
  role_matrix: {
    message: "Least-privilege ops roles are not defined.",
    nextStep: "Use role-scoped modules/actions for support, ops, admin, and privacy reviewer responsibilities.",
  },
  consented_content_marker: {
    message: "User-authorized content attachments are not clearly marked.",
    nextStep: "Require contentIncluded/userConsent metadata and audit every content view.",
  },
  data_request_handling: {
    message: "Deletion/data-request handling is missing from ops readiness.",
    nextStep: "Define data request handling action and audit event before paid launch.",
  },
  service_health_visibility: {
    message: "Service health visibility is missing.",
    nextStep: "Expose aggregate provider/relay/route health without user content or per-user rows.",
  },
  support_ticket_triage: {
    message: "Support ticket triage is missing.",
    nextStep: "Provide metadata-only support report listing, summary, known-issue link, and triage update path.",
  },
}

function makeFinding(code: AstraOpsReadinessCode): AstraOpsReadinessFinding {
  const copy = FINDING_COPY[code]
  return {
    code,
    severity: "block",
    message: copy.message,
    nextStep: copy.nextStep,
  }
}

export function getOpsRole(roleId: AstraOpsRoleId): AstraOpsRoleDefinition {
  const role = ASTRA_OPS_ROLES.find((item) => item.id === roleId)
  if (!role) throw new Error(`Unknown Astra ops role: ${roleId}`)
  return role
}

export function roleCanPerform(roleId: AstraOpsRoleId, action: AstraOpsActionId): boolean {
  return getOpsRole(roleId).allowedActions.includes(action)
}

export function roleCanViewModule(roleId: AstraOpsRoleId, moduleId: AstraOpsConsoleModuleId): boolean {
  return getOpsRole(roleId).visibleModules.includes(moduleId)
}

export function moduleAllowsDefaultField(moduleId: AstraOpsConsoleModuleId, fieldName: string): boolean {
  const module = ASTRA_OPS_CONSOLE_MODULES.find((item) => item.id === moduleId)
  if (!module) throw new Error(`Unknown Astra ops module: ${moduleId}`)
  return !module.prohibitedByDefaultFields.includes(fieldName)
}

export function evaluateAstraOpsConsoleReadiness(evidence: AstraOpsReadinessEvidence): AstraOpsReadinessDecision {
  const findings: AstraOpsReadinessFinding[] = []
  if (!evidence.metadataOnlyDefault) findings.push(makeFinding("metadata_only_default"))
  if (!evidence.actionableSupportFieldsAvailable) findings.push(makeFinding("actionable_support_fields"))
  if (!evidence.featureFlagRollbackAvailable) findings.push(makeFinding("feature_flag_rollback"))
  if (!evidence.sensitiveActionsAudited) findings.push(makeFinding("sensitive_action_audit"))
  if (!evidence.leastPrivilegeRolesDefined) findings.push(makeFinding("role_matrix"))
  if (!evidence.consentedContentMarked) findings.push(makeFinding("consented_content_marker"))
  if (!evidence.dataRequestsCanBeHandled) findings.push(makeFinding("data_request_handling"))
  if (!evidence.serviceHealthVisible) findings.push(makeFinding("service_health_visibility"))
  if (!evidence.supportTicketTriageAvailable) findings.push(makeFinding("support_ticket_triage"))

  return {
    ready: findings.length === 0,
    findings,
  }
}
