import { mkdtemp, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"

import { describe, expect, it } from "vitest"

import { buildSupportBundle } from "../utils/support-bundle"

import { FileSupportReportStore, SupportReportTriageSchema } from "./support-report-store"
import type { RelayEnv } from "./types"

async function createEnv(): Promise<RelayEnv> {
  const dir = await mkdtemp(join(tmpdir(), "astra-support-report-store-"))
  return {
    port: 0,
    host: "127.0.0.1",
    publicBaseURL: "http://127.0.0.1:8787/v1",
    sessionPublicBaseURL: "http://127.0.0.1:8787/v1",
    sessionSecret: "test-secret",
    platformMirrorSecret: "operator-secret",
    operatorPrincipals: [],
    userDbPath: join(dir, "users.json"),
    videoNoteStorePath: join(dir, "video-notes.json"),
    supportReportInboxPath: join(dir, "support-reports.json"),
    supportKnownIssueStorePath: join(dir, "support-known-issues.json"),
    featureFlagRuntimePath: join(dir, "feature-flags.json"),
    opsAuditLogPath: join(dir, "ops-audit-log.json"),
    cancellationReasonStorePath: join(dir, "cancellation-reasons.json"),
    loginEmail: "demo@astra.local",
    loginPassword: "astra-demo-pass",
    plan: "free",
    subscriptionStatus: "active",
    providerEntitlements: ["openai"],
    billingCheckoutBaseURL: "https://billing.example/checkout",
    billingPortalBaseURL: "https://billing.example/portal",
    openaiApiKey: "",
    googleApiKey: "",
    googleTranslateApiKey: "",
    openrouterApiKey: "",
    useOpenRouter: false,
    openrouterModelMap: {},
    freeDailyRequests: 100,
    freeDailyCharacters: 1000,
    freeRpm: 10,
    trialDailyRequests: 200,
    trialDailyCharacters: 2000,
    trialRpm: 20,
    proDailyRequests: 1000,
    proDailyCharacters: 10000,
    proRpm: 60,
    sessionTtlMs: 60_000,
    syncMaxMutationsPerRequest: 100,
    videoNoteMaxConcurrentJobs: 1,
    emailSignInCodeDevelopmentEcho: false,
    oauthIdentityDevelopmentRedeem: false,
  }
}

function createBundle(reportId: string, timestamp: string) {
  return buildSupportBundle({
    reportId,
    extensionVersion: "1.0.0",
    browser: "Chrome",
    os: "macOS",
    locale: "en-US",
    featureSurface: "page",
    action: "report_this_page",
    issueCategory: "page_not_working",
    hostname: "https://news.example/article",
    timestamp,
    privacyMode: true,
    membershipState: "trial",
    userConsent: true,
  })
}

describe("FileSupportReportStore durability", () => {
  it("serializes concurrent cold report writes so reports are not dropped", async () => {
    const env = await createEnv()
    const store = new FileSupportReportStore(env)

    await Promise.all([
      store.createReport({
        bundle: createBundle("rpt_concurrent_0001", "2026-05-27T00:00:00.000Z"),
        ownerEmail: "user1@example.com",
        deviceId: "device-1",
        sessionId: "session-1",
      }),
      store.createReport({
        bundle: createBundle("rpt_concurrent_0002", "2026-05-27T00:01:00.000Z"),
        ownerEmail: "user2@example.com",
        deviceId: "device-2",
        sessionId: "session-2",
      }),
    ])

    const reports = await store.listReports()
    expect(reports.map((report) => report.reportId).sort()).toEqual([
      "rpt_concurrent_0001",
      "rpt_concurrent_0002",
    ])

    const persisted = JSON.parse(await readFile(env.supportReportInboxPath, "utf8")) as { reports: Array<{ reportId: string }> }
    expect(persisted.reports.map((report) => report.reportId).sort()).toEqual([
      "rpt_concurrent_0001",
      "rpt_concurrent_0002",
    ])
  })

  it("merges follow-up patches without resetting unrelated triage fields", async () => {
    const env = await createEnv()
    const store = new FileSupportReportStore(env)
    await store.createReport({
      bundle: createBundle("rpt_followup_0001", "2026-05-27T00:00:00.000Z"),
      ownerEmail: "user@example.com",
      deviceId: "device-1",
      sessionId: "session-1",
    })

    await store.updateReportTriage("rpt_followup_0001", {
      status: "investigating",
      priority: "high",
      assignedTo: "support@astra.local",
      updatedBy: "triage-ops",
    }, "2026-05-27T01:00:00.000Z")
    const updated = await store.updateReportTriage("rpt_followup_0001", {
      followUp: {
        path: "email_follow_up",
        status: "selected",
        macroId: "macro_page_not_working",
        reason: "needs_manual_email",
        updatedBy: "handoff-ops",
      },
    }, "2026-05-27T02:00:00.000Z")

    expect(updated?.triage).toMatchObject({
      status: "investigating",
      priority: "high",
      assignedTo: "support@astra.local",
      updatedBy: "triage-ops",
      followUp: {
        path: "email_follow_up",
        status: "selected",
        macroId: "macro_page_not_working",
        reason: "needs_manual_email",
        updatedAt: "2026-05-27T02:00:00.000Z",
        updatedBy: "handoff-ops",
      },
    })

    const summary = await store.summarizeReports("2026-05-27T03:00:00.000Z")
    expect(summary.handoffSummary.byPath).toContainEqual({ path: "email_follow_up", count: 1 })
    expect(summary.handoffSummary.byStatus).toContainEqual({ status: "selected", count: 1 })
  })

  it("summarizes metadata-only SLA risk without exposing report identities", async () => {
    const env = await createEnv()
    const store = new FileSupportReportStore(env)

    await store.createReport({
      bundle: createBundle("rpt_sla_under_24h", "2026-05-27T02:00:00.000Z"),
      ownerEmail: "under24@example.com",
      deviceId: "device-under-24",
      sessionId: "session-under-24",
      submittedAt: "2026-05-27T02:00:00.000Z",
    })
    await store.createReport({
      bundle: createBundle("rpt_sla_24_72h", "2026-05-26T06:00:00.000Z"),
      ownerEmail: "urgent@example.com",
      deviceId: "device-urgent",
      sessionId: "session-urgent",
      submittedAt: "2026-05-26T06:00:00.000Z",
    })
    await store.updateReportTriage("rpt_sla_24_72h", {
      priority: "urgent",
      followUp: {
        path: "email_follow_up",
        status: "selected",
        reason: "needs_manual_email",
      },
    }, "2026-05-25T10:00:00.000Z")
    await store.createReport({
      bundle: createBundle("rpt_sla_72_168h", "2026-05-22T08:00:00.000Z"),
      ownerEmail: "stale@example.com",
      deviceId: "device-stale",
      sessionId: "session-stale",
      submittedAt: "2026-05-22T08:00:00.000Z",
    })
    await store.createReport({
      bundle: createBundle("rpt_sla_over_168h", "2026-05-18T00:00:00.000Z"),
      ownerEmail: "oldest@example.com",
      deviceId: "device-oldest",
      sessionId: "session-oldest",
      submittedAt: "2026-05-18T00:00:00.000Z",
    })
    await store.createReport({
      bundle: createBundle("rpt_sla_resolved", "2026-05-10T00:00:00.000Z"),
      ownerEmail: "resolved@example.com",
      deviceId: "device-resolved",
      sessionId: "session-resolved",
      submittedAt: "2026-05-10T00:00:00.000Z",
    })
    await store.updateReportTriage("rpt_sla_resolved", { status: "resolved" }, "2026-05-10T01:00:00.000Z")

    const summary = await store.summarizeReports("2026-05-27T12:00:00.000Z")

    expect(summary.slaRisk).toEqual({
      generatedAt: "2026-05-27T12:00:00.000Z",
      currentNow: "2026-05-27T12:00:00.000Z",
      unresolvedCount: 4,
      urgentUnresolvedCount: 1,
      staleTriageByAgeBucket: {
        under24h: 1,
        from24hTo72h: 1,
        from72hTo168h: 1,
        over168h: 1,
      },
      followUpOverdueCount: 1,
      oldestUnresolvedAgeHours: 228,
      oldestUnresolvedAgeDays: 9.5,
    })
    expect(JSON.stringify(summary.slaRisk)).not.toMatch(/@|device-|session-|rpt_sla_|news\.example/i)
  })

  it("defaults legacy triage records to an unselected follow-up handoff", () => {
    const triage = SupportReportTriageSchema.parse({ status: "new", priority: "normal" })

    expect(triage.followUp).toEqual({
      path: "not_selected",
      status: "not_started",
      macroId: null,
      reason: null,
      updatedAt: null,
      updatedBy: null,
    })
  })

  it("rejects invalid follow-up updates without corrupting retained data", async () => {
    const env = await createEnv()
    const store = new FileSupportReportStore(env)
    await store.createReport({
      bundle: createBundle("rpt_followup_invalid_0001", "2026-05-27T00:00:00.000Z"),
      ownerEmail: "user@example.com",
      deviceId: "device-1",
      sessionId: "session-1",
    })

    await expect(store.updateReportTriage("rpt_followup_invalid_0001", {
      followUp: { macroId: "macro_not_real" },
    })).rejects.toThrow()

    const [record] = await store.listReports()
    expect(record?.triage.followUp).toMatchObject({ path: "not_selected", status: "not_started", macroId: null })
  })

  it("refuses to overwrite invalid retained support inbox files", async () => {
    const env = await createEnv()
    await writeFile(env.supportReportInboxPath, "not-json")
    const store = new FileSupportReportStore(env)

    await expect(store.createReport({
      bundle: createBundle("rpt_invalid_0001", "2026-05-27T00:00:00.000Z"),
      ownerEmail: "user@example.com",
      deviceId: "device-1",
      sessionId: "session-1",
    })).rejects.toThrow(/invalid JSON; refusing to overwrite retained support reports/)

    await expect(readFile(env.supportReportInboxPath, "utf8")).resolves.toBe("not-json")
  })
})
