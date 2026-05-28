import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { findFreeTierLimitViolations, loadRelayEnv } from "./config"

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

  it("bounds the Free tier below Pro by default (AC8 cost guardrail)", () => {
    const relayEnv = loadRelayEnv(env())

    // Unconfigured deployments must never leave Free == Pro (uncapped-cost path).
    expect(relayEnv.freeDailyRequests).toBeLessThan(relayEnv.proDailyRequests)
    expect(relayEnv.freeDailyCharacters).toBeLessThan(relayEnv.proDailyCharacters)
    expect(relayEnv.freeRpm).toBeLessThan(relayEnv.proRpm)
    expect(findFreeTierLimitViolations(relayEnv)).toEqual([])
  })

  it("keeps Free below Pro when limits are tuned via env", () => {
    const relayEnv = loadRelayEnv(env({
      ASTRA_FREE_DAILY_REQUESTS: "120",
      ASTRA_FREE_DAILY_CHARACTERS: "60000",
      ASTRA_FREE_RPM: "30",
      ASTRA_PRO_DAILY_REQUESTS: "5000",
      ASTRA_PRO_DAILY_CHARACTERS: "1000000",
      ASTRA_PRO_RPM: "240",
    }))

    expect(relayEnv.freeDailyRequests).toBe(120)
    expect(relayEnv.proDailyRequests).toBe(5000)
    expect(findFreeTierLimitViolations(relayEnv)).toEqual([])
  })

  it("aborts startup when Free is not strictly below Pro on any axis", () => {
    expect(() => loadRelayEnv(env({
      ASTRA_FREE_DAILY_REQUESTS: "2000",
      ASTRA_FREE_DAILY_CHARACTERS: "500000",
      ASTRA_FREE_RPM: "120",
      ASTRA_PRO_DAILY_REQUESTS: "2000",
      ASTRA_PRO_DAILY_CHARACTERS: "500000",
      ASTRA_PRO_RPM: "120",
    }))).toThrow(/Free must be strictly below Pro/)
  })

  it("rejects non-positive / non-numeric tier limit env values", () => {
    expect(() => loadRelayEnv(env({ ASTRA_FREE_DAILY_REQUESTS: "not-a-number" }))).toThrow(/Invalid positive integer/)
    expect(() => loadRelayEnv(env({ ASTRA_FREE_RPM: "0" }))).toThrow(/Invalid positive integer/)
    expect(() => loadRelayEnv(env({ ASTRA_FREE_DAILY_CHARACTERS: "-5" }))).toThrow(/Invalid positive integer/)
  })

  it("flags every axis via findFreeTierLimitViolations on an unbounded env", () => {
    const violations = findFreeTierLimitViolations({
      freeDailyRequests: 2000,
      freeDailyCharacters: 500000,
      freeRpm: 120,
      proDailyRequests: 2000,
      proDailyCharacters: 500000,
      proRpm: 120,
    } as unknown as Parameters<typeof findFreeTierLimitViolations>[0])

    expect(violations).toHaveLength(3)
    expect(violations.some((v) => v.includes("freeDailyRequests"))).toBe(true)
    expect(violations.some((v) => v.includes("freeDailyCharacters"))).toBe(true)
    expect(violations.some((v) => v.includes("freeRpm"))).toBe(true)
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
