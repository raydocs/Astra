import { pathToFileURL } from "node:url"

import { resolveCloudflareShadowDatabase } from "./cloudflare-shadow"
import {
  applyCloudflareShadowBackfill,
  SHADOW_AUDIT_SCOPES,
  inspectCloudflareShadowConsistency,
  type ShadowAuditScope,
  type ShadowBackfillApplyResult,
  type ShadowBackfillPlan,
  type ShadowConsistencyInspection,
} from "./cloudflare-shadow-audit"
import { loadRelayEnv } from "./config"

type Command = "audit" | "verify" | "backfill:dry-run" | "backfill:apply"
type OutputFormat = "text" | "json"

type ParsedArgs = {
  help: boolean
  format: OutputFormat
  email?: string
  userId?: string
  scopes?: ShadowAuditScope[]
  maxDiffs: number
  maxActions: number
  failOnDiff: boolean
}

function parsePositiveInteger(value: string, flag: string): number {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${flag} must be a positive integer. Received: ${value}`)
  }
  return parsed
}

function parseScopes(raw: string): ShadowAuditScope[] {
  const scopes = raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)

  const invalid = scopes.filter((scope) => !SHADOW_AUDIT_SCOPES.includes(scope as ShadowAuditScope))
  if (invalid.length > 0) {
    throw new Error(`Unsupported scope value(s): ${invalid.join(", ")}`)
  }

  return scopes as ShadowAuditScope[]
}

function parseArgs(argv: string[]): ParsedArgs {
  let help = false
  let format: OutputFormat = "text"
  let email: string | undefined
  let userId: string | undefined
  let scopes: ShadowAuditScope[] | undefined
  let maxDiffs = 200
  let maxActions = 200
  let failOnDiff = false

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index]

    if (current === "--help" || current === "-h") {
      help = true
      continue
    }

    if (current === "--fail-on-diff") {
      failOnDiff = true
      continue
    }

    const next = argv[index + 1]
    if (!next) {
      throw new Error(`Missing value for ${current}`)
    }

    if (current === "--format") {
      if (next !== "text" && next !== "json") {
        throw new Error(`--format must be text or json. Received: ${next}`)
      }
      format = next
      index += 1
      continue
    }

    if (current === "--email") {
      email = next.trim()
      index += 1
      continue
    }

    if (current === "--user-id") {
      userId = next.trim()
      index += 1
      continue
    }

    if (current === "--scope") {
      scopes = parseScopes(next)
      index += 1
      continue
    }

    if (current === "--max-diffs") {
      maxDiffs = parsePositiveInteger(next, "--max-diffs")
      index += 1
      continue
    }

    if (current === "--max-actions") {
      maxActions = parsePositiveInteger(next, "--max-actions")
      index += 1
      continue
    }

    throw new Error(`Unknown argument: ${current}`)
  }

  if (email && userId) {
    throw new Error("Use either --email or --user-id, not both.")
  }

  return {
    help,
    format,
    email,
    userId,
    scopes,
    maxDiffs,
    maxActions,
    failOnDiff,
  }
}

function printHelp(command: Command): string {
  return [
    "Astra Cloudflare shadow consistency CLI",
    "",
    `Usage: tsx server/cloudflare-shadow-cli.ts ${command} [options]`,
    "",
    "Options:",
    "  --email <value>         Limit to one authoritative/shadow user email",
    "  --user-id <value>       Limit to one authoritative/shadow user id",
    `  --scope <csv>           Comma-separated scopes: ${SHADOW_AUDIT_SCOPES.join(", ")}`,
    "  --format <text|json>    Output format (default: text)",
    "  --max-diffs <count>     Maximum diffs to print/emit (default: 200)",
    "  --max-actions <count>   Maximum dry-run actions to emit or backfill actions to apply before aborting (default: 200)",
    "  --fail-on-diff          For audit only, exit 1 when diffs exist",
    "  -h, --help              Show this help",
    "",
    "Examples:",
    "  pnpm relay:shadow:audit -- --format text",
    "  pnpm relay:shadow:verify -- --email demo@astra.local --format json",
    "  pnpm relay:shadow:backfill:dry-run -- --user-id usr_demo --scope users,devices,sessions",
    "  pnpm relay:shadow:backfill:apply -- --email demo@astra.local",
  ].join("\n")
}

function renderDiff(diff: ShadowConsistencyInspection["audit"]["diffs"][number]): string {
  const mismatch = diff.mismatchedFields?.length ? ` mismatchedFields=${diff.mismatchedFields.join(",")}` : ""
  return `- [${diff.scope}] ${diff.outcome} ${diff.key} user=${diff.userId}${diff.email ? ` email=${diff.email}` : ""}${mismatch}`
}

function renderBackfillPlan(plan: ShadowBackfillPlan): string[] {
  const lines = [
    "",
    `Dry-run backfill actions: ${plan.summary.actionCount}`,
    `Would reach full parity: ${plan.summary.wouldReachFullParity ? "yes" : "no"}`,
  ]

  for (const action of plan.actions) {
    lines.push(`- [${action.kind}] ${action.key} user=${action.userId}${action.email ? ` email=${action.email}` : ""}`)
  }

  if (plan.truncated) {
    lines.push(`- … truncated after ${plan.actions.length} actions`)
  }

  if (plan.unresolvedDiffs.length > 0) {
    lines.push("", `Unresolved diffs after dry-run plan: ${plan.unresolvedDiffs.length}`)
    for (const diff of plan.unresolvedDiffs) {
      lines.push(renderDiff(diff))
    }
  }

  return lines
}

function renderText(command: Command, inspection: ShadowConsistencyInspection): string {
  const { audit, backfill } = inspection
  const lines = [
    `Command: ${command}`,
    `Generated at: ${audit.generatedAt}`,
    `Result: ${audit.ok ? "clean" : "drift-detected"}`,
    `Users: authoritative=${audit.summary.authoritativeUsers} shadow=${audit.summary.shadowUsers}`,
    `Rows: users=${audit.summary.countsByScope.users.authoritative}/${audit.summary.countsByScope.users.shadow}`
      + ` credentials=${audit.summary.countsByScope.credentials.authoritative}/${audit.summary.countsByScope.credentials.shadow}`
      + ` devices=${audit.summary.countsByScope.devices.authoritative}/${audit.summary.countsByScope.devices.shadow}`
      + ` sessions=${audit.summary.countsByScope.sessions.authoritative}/${audit.summary.countsByScope.sessions.shadow}`
      + ` sync_collections=${audit.summary.countsByScope.sync_collections.authoritative}/${audit.summary.countsByScope.sync_collections.shadow}`
      + ` sync_mutations=${audit.summary.countsByScope.sync_mutations.authoritative}/${audit.summary.countsByScope.sync_mutations.shadow}`,
    `Diffs: total=${audit.summary.diffCount} missing=${audit.summary.diffCountByOutcome.missing_in_shadow} extra=${audit.summary.diffCountByOutcome.extra_in_shadow} mismatch=${audit.summary.diffCountByOutcome.field_mismatch}`,
  ]

  if (
    audit.issuancePrerequisites.duplicateAnonymousInstallIds.length > 0
    || audit.issuancePrerequisites.authenticatedUsersMissingCredentials.length > 0
  ) {
    lines.push("", "Issuance prerequisites:")
    if (audit.issuancePrerequisites.duplicateAnonymousInstallIds.length > 0) {
      lines.push("- duplicate anonymous installIds:")
      for (const duplicate of audit.issuancePrerequisites.duplicateAnonymousInstallIds) {
        lines.push(`  - ${duplicate.installId}: ${duplicate.userIds.join(", ")}`)
      }
    }
    if (audit.issuancePrerequisites.authenticatedUsersMissingCredentials.length > 0) {
      lines.push("- authenticated users missing credentials:")
      for (const missing of audit.issuancePrerequisites.authenticatedUsersMissingCredentials) {
        lines.push(`  - ${missing.userId}${missing.email ? ` (${missing.email})` : ""}`)
      }
    }
  }

  if (audit.diffs.length > 0) {
    lines.push("", "Diffs:")
    for (const diff of audit.diffs) {
      lines.push(renderDiff(diff))
    }
    if (audit.truncated) {
      lines.push(`- … truncated after ${audit.diffs.length} diffs`)
    }
  }

  if (backfill) {
    lines.push(...renderBackfillPlan(backfill))
  }

  return lines.join("\n")
}

function renderApplyText(result: ShadowBackfillApplyResult): string {
  const lines = [
    "Command: backfill:apply",
    `Applied at: ${result.appliedAt}`,
    `Applied actions: ${result.actionCount}`,
    `Before diff count: ${result.inspectionBefore.audit.summary.diffCount}`,
    `After diff count: ${result.inspectionAfter.audit.summary.diffCount}`,
    `After result: ${result.inspectionAfter.audit.ok ? "clean" : "drift-detected"}`,
    "",
    "Applied actions by kind:",
  ]

  for (const [kind, count] of Object.entries(result.actionCountByKind)) {
    lines.push(`- ${kind}: ${count}`)
  }

  if (result.inspectionAfter.backfill) {
    lines.push(...renderBackfillPlan(result.inspectionAfter.backfill))
  }

  return lines.join("\n")
}

export async function runCloudflareShadowCli(
  command: Command,
  argv: string[] = process.argv.slice(2),
): Promise<{ exitCode: number; output: string }> {
  try {
    const parsed = parseArgs(argv)
    if (parsed.help) {
      return {
        exitCode: 0,
        output: printHelp(command),
      }
    }

    const env = loadRelayEnv()
    const db = resolveCloudflareShadowDatabase(env.cloudflareShadow)
    if (command === "backfill:apply") {
      const result = await applyCloudflareShadowBackfill({
        env,
        db,
        filters: {
          email: parsed.email,
          userId: parsed.userId,
          scopes: parsed.scopes,
          maxDiffs: parsed.maxDiffs,
        },
        maxActions: parsed.maxActions,
      })

      return {
        exitCode: result.inspectionAfter.audit.summary.diffCount > 0 ? 1 : 0,
        output: parsed.format === "json"
          ? JSON.stringify({ command, ...result }, null, 2)
          : renderApplyText(result),
      }
    }

    const inspection = await inspectCloudflareShadowConsistency({
      env,
      db,
      filters: {
        email: parsed.email,
        userId: parsed.userId,
        scopes: parsed.scopes,
        maxDiffs: parsed.maxDiffs,
      },
      includeBackfillPlan: command === "backfill:dry-run",
      maxActions: parsed.maxActions,
    })

    const output = parsed.format === "json"
      ? JSON.stringify({ command, ...inspection }, null, 2)
      : renderText(command, inspection)

    const hasDiffs = inspection.audit.summary.diffCount > 0
    const exitCode = command === "verify"
      ? (hasDiffs ? 1 : 0)
      : command === "audit" && parsed.failOnDiff && hasDiffs
        ? 1
        : 0

    return {
      exitCode,
      output,
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    return {
      exitCode: 2,
      output: `Cloudflare shadow CLI failed: ${detail}`,
    }
  }
}

async function main() {
  const [command, ...argv] = process.argv.slice(2)
  if (command !== "audit" && command !== "verify" && command !== "backfill:dry-run" && command !== "backfill:apply") {
    console.error(printHelp("audit"))
    process.exitCode = 2
    return
  }

  const result = await runCloudflareShadowCli(command, argv)
  if (result.exitCode === 2) {
    console.error(result.output)
  } else {
    console.log(result.output)
  }
  process.exitCode = result.exitCode
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error)
    process.exitCode = 2
  })
}
