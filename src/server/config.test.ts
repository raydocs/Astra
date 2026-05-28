import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { loadRelayEnv } from "./config"

function env(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return overrides
}

describe("loadRelayEnv relay data paths", () => {
  it("preserves no-env data file defaults", () => {
    const relayEnv = loadRelayEnv(env())

    expect(relayEnv.userDbPath).toBe("data/server/users.json")
    expect(relayEnv.videoNoteStorePath).toBe("data/server/video-notes.json")
    expect(relayEnv.supportReportInboxPath).toBe("data/server/support-reports.json")
    expect(relayEnv.supportKnownIssueStorePath).toBe("data/server/support-known-issues.json")
    expect(relayEnv.featureFlagRuntimePath).toBe("data/server/feature-flags.json")
    expect(relayEnv.opsAuditLogPath).toBe("data/server/ops-audit-log.json")
    expect(relayEnv.cancellationReasonStorePath).toBe("data/server/cancellation-reasons.json")
    expect(relayEnv.operatorPrincipals).toEqual([])
  })

  it("parses env-backed operator principals", () => {
    const relayEnv = loadRelayEnv(env({
      ASTRA_OPERATOR_TOKENS: JSON.stringify([
        { id: " support-local ", role: "support_agent", token: " support-secret " },
        { id: "ops-local", role: "ops_engineer", token: "ops-secret" },
      ]),
    }))

    expect(relayEnv.operatorPrincipals).toEqual([
      { id: "support-local", role: "support_agent", token: "support-secret" },
      { id: "ops-local", role: "ops_engineer", token: "ops-secret" },
    ])
  })

  it("rejects invalid operator principal configuration", () => {
    expect(() => loadRelayEnv(env({ ASTRA_OPERATOR_TOKENS: "not-json" }))).toThrow(/valid JSON/)
    expect(() => loadRelayEnv(env({ ASTRA_OPERATOR_TOKENS: JSON.stringify({}) }))).toThrow(/JSON array/)
    expect(() => loadRelayEnv(env({
      ASTRA_OPERATOR_TOKENS: JSON.stringify([{ id: "support", role: "owner", token: "secret" }]),
    }))).toThrow(/valid Astra ops role/)
    expect(() => loadRelayEnv(env({
      ASTRA_OPERATOR_TOKENS: JSON.stringify([
        { id: "support", role: "support_agent", token: "secret-a" },
        { id: "support", role: "support_lead", token: "secret-b" },
      ]),
    }))).toThrow(/duplicate operator id/)
    expect(() => loadRelayEnv(env({
      ASTRA_OPERATOR_TOKENS: JSON.stringify([
        { id: "support", role: "support_agent", token: "secret" },
        { id: "lead", role: "support_lead", token: "secret" },
      ]),
    }))).toThrow(/duplicate operator tokens/)
  })

  it("derives both data file paths from ASTRA_RELAY_DATA_DIR", () => {
    const relayEnv = loadRelayEnv(env({
      ASTRA_RELAY_DATA_DIR: "/tmp/astra-relay-data",
    }))

    expect(relayEnv.userDbPath).toBe(join("/tmp/astra-relay-data", "users.json"))
    expect(relayEnv.videoNoteStorePath).toBe(join("/tmp/astra-relay-data", "video-notes.json"))
    expect(relayEnv.supportReportInboxPath).toBe(join("/tmp/astra-relay-data", "support-reports.json"))
    expect(relayEnv.supportKnownIssueStorePath).toBe(join("/tmp/astra-relay-data", "support-known-issues.json"))
    expect(relayEnv.featureFlagRuntimePath).toBe(join("/tmp/astra-relay-data", "feature-flags.json"))
    expect(relayEnv.opsAuditLogPath).toBe(join("/tmp/astra-relay-data", "ops-audit-log.json"))
    expect(relayEnv.cancellationReasonStorePath).toBe(join("/tmp/astra-relay-data", "cancellation-reasons.json"))
  })

  it("derives both data file paths from ASTRA_DATA_DIR when relay data dir is absent", () => {
    const relayEnv = loadRelayEnv(env({
      ASTRA_DATA_DIR: "/tmp/astra-data",
    }))

    expect(relayEnv.userDbPath).toBe(join("/tmp/astra-data", "users.json"))
    expect(relayEnv.videoNoteStorePath).toBe(join("/tmp/astra-data", "video-notes.json"))
    expect(relayEnv.supportReportInboxPath).toBe(join("/tmp/astra-data", "support-reports.json"))
    expect(relayEnv.supportKnownIssueStorePath).toBe(join("/tmp/astra-data", "support-known-issues.json"))
    expect(relayEnv.featureFlagRuntimePath).toBe(join("/tmp/astra-data", "feature-flags.json"))
    expect(relayEnv.opsAuditLogPath).toBe(join("/tmp/astra-data", "ops-audit-log.json"))
    expect(relayEnv.cancellationReasonStorePath).toBe(join("/tmp/astra-data", "cancellation-reasons.json"))
  })

  it("prefers ASTRA_RELAY_DATA_DIR over ASTRA_DATA_DIR", () => {
    const relayEnv = loadRelayEnv(env({
      ASTRA_RELAY_DATA_DIR: "/tmp/astra-relay-data",
      ASTRA_DATA_DIR: "/tmp/astra-data",
    }))

    expect(relayEnv.userDbPath).toBe(join("/tmp/astra-relay-data", "users.json"))
    expect(relayEnv.videoNoteStorePath).toBe(join("/tmp/astra-relay-data", "video-notes.json"))
    expect(relayEnv.supportReportInboxPath).toBe(join("/tmp/astra-relay-data", "support-reports.json"))
    expect(relayEnv.supportKnownIssueStorePath).toBe(join("/tmp/astra-relay-data", "support-known-issues.json"))
    expect(relayEnv.featureFlagRuntimePath).toBe(join("/tmp/astra-relay-data", "feature-flags.json"))
    expect(relayEnv.opsAuditLogPath).toBe(join("/tmp/astra-relay-data", "ops-audit-log.json"))
    expect(relayEnv.cancellationReasonStorePath).toBe(join("/tmp/astra-relay-data", "cancellation-reasons.json"))
  })

  it("prefers ASTRA_USER_DB_PATH while deriving video notes from the selected data dir", () => {
    const relayEnv = loadRelayEnv(env({
      ASTRA_RELAY_DATA_DIR: "/tmp/astra-relay-data",
      ASTRA_USER_DB_PATH: "/tmp/custom-users.json",
    }))

    expect(relayEnv.userDbPath).toBe("/tmp/custom-users.json")
    expect(relayEnv.videoNoteStorePath).toBe(join("/tmp/astra-relay-data", "video-notes.json"))
    expect(relayEnv.supportReportInboxPath).toBe(join("/tmp/astra-relay-data", "support-reports.json"))
    expect(relayEnv.supportKnownIssueStorePath).toBe(join("/tmp/astra-relay-data", "support-known-issues.json"))
    expect(relayEnv.featureFlagRuntimePath).toBe(join("/tmp/astra-relay-data", "feature-flags.json"))
    expect(relayEnv.opsAuditLogPath).toBe(join("/tmp/astra-relay-data", "ops-audit-log.json"))
    expect(relayEnv.cancellationReasonStorePath).toBe(join("/tmp/astra-relay-data", "cancellation-reasons.json"))
  })

  it("prefers ASTRA_VIDEO_NOTE_STORE_PATH while deriving users from the selected data dir", () => {
    const relayEnv = loadRelayEnv(env({
      ASTRA_RELAY_DATA_DIR: "/tmp/astra-relay-data",
      ASTRA_VIDEO_NOTE_STORE_PATH: "/tmp/custom-video-notes.json",
    }))

    expect(relayEnv.userDbPath).toBe(join("/tmp/astra-relay-data", "users.json"))
    expect(relayEnv.videoNoteStorePath).toBe("/tmp/custom-video-notes.json")
    expect(relayEnv.supportReportInboxPath).toBe(join("/tmp/astra-relay-data", "support-reports.json"))
    expect(relayEnv.supportKnownIssueStorePath).toBe(join("/tmp/astra-relay-data", "support-known-issues.json"))
    expect(relayEnv.featureFlagRuntimePath).toBe(join("/tmp/astra-relay-data", "feature-flags.json"))
    expect(relayEnv.opsAuditLogPath).toBe(join("/tmp/astra-relay-data", "ops-audit-log.json"))
    expect(relayEnv.cancellationReasonStorePath).toBe(join("/tmp/astra-relay-data", "cancellation-reasons.json"))
  })

  it("prefers ASTRA_SUPPORT_REPORT_INBOX_PATH while deriving users and video notes from the selected data dir", () => {
    const relayEnv = loadRelayEnv(env({
      ASTRA_RELAY_DATA_DIR: "/tmp/astra-relay-data",
      ASTRA_SUPPORT_REPORT_INBOX_PATH: "/tmp/custom-support-reports.json",
    }))

    expect(relayEnv.userDbPath).toBe(join("/tmp/astra-relay-data", "users.json"))
    expect(relayEnv.videoNoteStorePath).toBe(join("/tmp/astra-relay-data", "video-notes.json"))
    expect(relayEnv.supportReportInboxPath).toBe("/tmp/custom-support-reports.json")
  })

  it("prefers ASTRA_SUPPORT_KNOWN_ISSUE_STORE_PATH while deriving other data files from the selected data dir", () => {
    const relayEnv = loadRelayEnv(env({
      ASTRA_RELAY_DATA_DIR: "/tmp/astra-relay-data",
      ASTRA_SUPPORT_KNOWN_ISSUE_STORE_PATH: "/tmp/custom-known-issues.json",
    }))

    expect(relayEnv.userDbPath).toBe(join("/tmp/astra-relay-data", "users.json"))
    expect(relayEnv.videoNoteStorePath).toBe(join("/tmp/astra-relay-data", "video-notes.json"))
    expect(relayEnv.supportReportInboxPath).toBe(join("/tmp/astra-relay-data", "support-reports.json"))
    expect(relayEnv.supportKnownIssueStorePath).toBe("/tmp/custom-known-issues.json")
    expect(relayEnv.featureFlagRuntimePath).toBe(join("/tmp/astra-relay-data", "feature-flags.json"))
    expect(relayEnv.opsAuditLogPath).toBe(join("/tmp/astra-relay-data", "ops-audit-log.json"))
    expect(relayEnv.cancellationReasonStorePath).toBe(join("/tmp/astra-relay-data", "cancellation-reasons.json"))
  })

  it("prefers ASTRA_FEATURE_FLAG_RUNTIME_PATH while deriving other data files from the selected data dir", () => {
    const relayEnv = loadRelayEnv(env({
      ASTRA_RELAY_DATA_DIR: "/tmp/astra-relay-data",
      ASTRA_FEATURE_FLAG_RUNTIME_PATH: "/tmp/custom-feature-flags.json",
    }))

    expect(relayEnv.userDbPath).toBe(join("/tmp/astra-relay-data", "users.json"))
    expect(relayEnv.videoNoteStorePath).toBe(join("/tmp/astra-relay-data", "video-notes.json"))
    expect(relayEnv.supportReportInboxPath).toBe(join("/tmp/astra-relay-data", "support-reports.json"))
    expect(relayEnv.featureFlagRuntimePath).toBe("/tmp/custom-feature-flags.json")
    expect(relayEnv.opsAuditLogPath).toBe(join("/tmp/astra-relay-data", "ops-audit-log.json"))
    expect(relayEnv.cancellationReasonStorePath).toBe(join("/tmp/astra-relay-data", "cancellation-reasons.json"))
  })

  it("prefers ASTRA_OPS_AUDIT_LOG_PATH while deriving other data files from the selected data dir", () => {
    const relayEnv = loadRelayEnv(env({
      ASTRA_RELAY_DATA_DIR: "/tmp/astra-relay-data",
      ASTRA_OPS_AUDIT_LOG_PATH: "/tmp/custom-ops-audit-log.json",
    }))

    expect(relayEnv.userDbPath).toBe(join("/tmp/astra-relay-data", "users.json"))
    expect(relayEnv.videoNoteStorePath).toBe(join("/tmp/astra-relay-data", "video-notes.json"))
    expect(relayEnv.supportReportInboxPath).toBe(join("/tmp/astra-relay-data", "support-reports.json"))
    expect(relayEnv.featureFlagRuntimePath).toBe(join("/tmp/astra-relay-data", "feature-flags.json"))
    expect(relayEnv.opsAuditLogPath).toBe("/tmp/custom-ops-audit-log.json")
    expect(relayEnv.cancellationReasonStorePath).toBe(join("/tmp/astra-relay-data", "cancellation-reasons.json"))
  })

  it("preserves empty explicit file env values", () => {
    const relayEnv = loadRelayEnv(env({
      ASTRA_RELAY_DATA_DIR: "/tmp/astra-relay-data",
      ASTRA_USER_DB_PATH: "",
      ASTRA_VIDEO_NOTE_STORE_PATH: "",
      ASTRA_SUPPORT_REPORT_INBOX_PATH: "",
      ASTRA_SUPPORT_KNOWN_ISSUE_STORE_PATH: "",
      ASTRA_FEATURE_FLAG_RUNTIME_PATH: "",
      ASTRA_OPS_AUDIT_LOG_PATH: "",
      ASTRA_CANCELLATION_REASON_STORE_PATH: "",
    }))

    expect(relayEnv.userDbPath).toBe("")
    expect(relayEnv.videoNoteStorePath).toBe("")
    expect(relayEnv.supportReportInboxPath).toBe("")
    expect(relayEnv.supportKnownIssueStorePath).toBe("")
    expect(relayEnv.featureFlagRuntimePath).toBe("")
    expect(relayEnv.opsAuditLogPath).toBe("")
    expect(relayEnv.cancellationReasonStorePath).toBe("")
  })
})
