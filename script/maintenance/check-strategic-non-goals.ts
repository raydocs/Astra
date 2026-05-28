import { readFile } from "node:fs/promises"

import {
  evaluateAstraProposalGate,
  type AstraProposalGateDecision,
  type AstraProposalGateInput,
} from "../../src/utils/strategic-non-goals"

const DEFAULT_FIXTURE = "docs/analysis/strategic-non-goals-proposals.json"

const SURFACE_BOUNDARIES = new Set(["default", "advanced", "beta", "experimental", "internal_only"])
const TOP_LEVEL_FIELDS = new Set(["version", "proposals"])
const PROPOSAL_FIELDS = new Set(["id", "title", "source", "allowedDecision", "input"])
const ALLOWED_DECISIONS = new Set(["accept_candidate", "advanced_or_beta_only"])
const INPUT_REQUIRED_FIELDS = new Set([
  "supportsZeroConfig",
  "controlsCost",
  "ordinaryLanguage",
  "protectsPrivacyByDefault",
  "advancesLearningLoopOrPaidValue",
  "observableBySupportAndAnalytics",
  "surfaceBoundary",
])
const INPUT_OPTIONAL_FIELDS = new Set([
  "introducesHighCostUnlimitedUse",
  "introducesDefaultContentUpload",
  "introducesProviderConsoleDefault",
  "introducesSocialCommunityDefault",
  "claimsUniversalSupport",
])
const DECISION_RANK: Record<AstraProposalGateDecision["decision"], number> = {
  accept_candidate: 0,
  advanced_or_beta_only: 1,
  defer: 2,
}

type AllowedDecision = "accept_candidate" | "advanced_or_beta_only"

type ProposalFixture = {
  id: string
  title: string
  source: string
  allowedDecision: AllowedDecision
  input: AstraProposalGateInput
}

type Fixture = {
  version: 1
  proposals: ProposalFixture[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function validateString(value: unknown, path: string, findings: string[]): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    findings.push(`${path}: expected a non-empty string.`)
    return ""
  }
  return value
}

function validateBoolean(value: unknown, path: string, findings: string[]): boolean {
  if (typeof value !== "boolean") {
    findings.push(`${path}: expected a boolean.`)
    return false
  }
  return value
}

function validateInput(value: unknown, path: string, findings: string[]): AstraProposalGateInput {
  const input: Partial<AstraProposalGateInput> = {}

  if (!isRecord(value)) {
    findings.push(`${path}: expected an object.`)
    return {
      supportsZeroConfig: false,
      controlsCost: false,
      ordinaryLanguage: false,
      protectsPrivacyByDefault: false,
      advancesLearningLoopOrPaidValue: false,
      observableBySupportAndAnalytics: false,
      surfaceBoundary: "default",
    }
  }

  for (const field of Object.keys(value)) {
    if (!INPUT_REQUIRED_FIELDS.has(field) && !INPUT_OPTIONAL_FIELDS.has(field)) {
      findings.push(`${path}.${field}: unknown input field.`)
    }
  }

  for (const field of INPUT_REQUIRED_FIELDS) {
    if (!(field in value)) {
      findings.push(`${path}.${field}: missing required field.`)
    }
  }

  input.supportsZeroConfig = validateBoolean(value.supportsZeroConfig, `${path}.supportsZeroConfig`, findings)
  input.controlsCost = validateBoolean(value.controlsCost, `${path}.controlsCost`, findings)
  input.ordinaryLanguage = validateBoolean(value.ordinaryLanguage, `${path}.ordinaryLanguage`, findings)
  input.protectsPrivacyByDefault = validateBoolean(
    value.protectsPrivacyByDefault,
    `${path}.protectsPrivacyByDefault`,
    findings,
  )
  input.advancesLearningLoopOrPaidValue = validateBoolean(
    value.advancesLearningLoopOrPaidValue,
    `${path}.advancesLearningLoopOrPaidValue`,
    findings,
  )
  input.observableBySupportAndAnalytics = validateBoolean(
    value.observableBySupportAndAnalytics,
    `${path}.observableBySupportAndAnalytics`,
    findings,
  )

  if (typeof value.surfaceBoundary !== "string" || !SURFACE_BOUNDARIES.has(value.surfaceBoundary)) {
    findings.push(`${path}.surfaceBoundary: expected default, advanced, beta, experimental, or internal_only.`)
    input.surfaceBoundary = "default"
  } else {
    input.surfaceBoundary = value.surfaceBoundary as AstraProposalGateInput["surfaceBoundary"]
  }

  for (const field of INPUT_OPTIONAL_FIELDS) {
    if (!(field in value)) continue
    input[field as keyof Pick<
      AstraProposalGateInput,
      | "introducesHighCostUnlimitedUse"
      | "introducesDefaultContentUpload"
      | "introducesProviderConsoleDefault"
      | "introducesSocialCommunityDefault"
      | "claimsUniversalSupport"
    >] = validateBoolean(value[field], `${path}.${field}`, findings)
  }

  return input as AstraProposalGateInput
}

function validateFixture(value: unknown, file: string): { fixture?: Fixture; findings: string[] } {
  const findings: string[] = []

  if (!isRecord(value)) {
    return { findings: [`${file}: expected top-level JSON object.`] }
  }

  for (const field of Object.keys(value)) {
    if (!TOP_LEVEL_FIELDS.has(field)) {
      findings.push(`${file}.${field}: unknown top-level field.`)
    }
  }

  if (value.version !== 1) {
    findings.push(`${file}.version: expected 1.`)
  }

  if (!Array.isArray(value.proposals)) {
    findings.push(`${file}.proposals: expected an array.`)
    return { findings }
  }

  const proposals = value.proposals.map((proposal, index): ProposalFixture => {
    const proposalPath = `${file}.proposals[${index}]`

    if (!isRecord(proposal)) {
      findings.push(`${proposalPath}: expected an object.`)
      return {
        id: "",
        title: "",
        source: "",
        allowedDecision: "accept_candidate",
        input: validateInput(undefined, `${proposalPath}.input`, findings),
      }
    }

    for (const field of Object.keys(proposal)) {
      if (!PROPOSAL_FIELDS.has(field)) {
        findings.push(`${proposalPath}.${field}: unknown proposal field.`)
      }
    }

    const allowedDecisionValue = proposal.allowedDecision ?? "accept_candidate"
    let allowedDecision: AllowedDecision = "accept_candidate"
    if (typeof allowedDecisionValue !== "string" || !ALLOWED_DECISIONS.has(allowedDecisionValue)) {
      findings.push(`${proposalPath}.allowedDecision: expected accept_candidate or advanced_or_beta_only; defer is not allowed.`)
    } else {
      allowedDecision = allowedDecisionValue as AllowedDecision
    }

    return {
      id: validateString(proposal.id, `${proposalPath}.id`, findings),
      title: validateString(proposal.title, `${proposalPath}.title`, findings),
      source: validateString(proposal.source, `${proposalPath}.source`, findings),
      allowedDecision,
      input: validateInput(proposal.input, `${proposalPath}.input`, findings),
    }
  })

  if (proposals.length === 0) {
    findings.push(`${file}.proposals: expected at least one proposal.`)
  }

  return {
    fixture: { version: 1, proposals },
    findings,
  }
}

async function loadFixture(file: string): Promise<{ fixture?: Fixture; findings: string[] }> {
  let parsed: unknown

  try {
    parsed = JSON.parse(await readFile(file, "utf8"))
  } catch (error) {
    return {
      findings: [`${file}: could not read or parse JSON (${error instanceof Error ? error.message : String(error)}).`],
    }
  }

  return validateFixture(parsed, file)
}

async function main(): Promise<void> {
  const files = [...new Set([DEFAULT_FIXTURE, ...process.argv.slice(2)])]
  const failures: string[] = []
  const advancedDowngrades: string[] = []
  let checkedCount = 0

  for (const file of files) {
    const { fixture, findings } = await loadFixture(file)
    if (findings.length > 0) {
      failures.push(`Malformed strategic non-goals fixture: ${file}`)
      failures.push(...findings.map((finding) => `  - ${finding}`))
      continue
    }

    if (!fixture) continue

    for (const proposal of fixture.proposals) {
      checkedCount += 1
      const decision = evaluateAstraProposalGate(proposal.input)

      if (decision.decision === "advanced_or_beta_only") {
        advancedDowngrades.push(`${proposal.id}: ${proposal.title}`)
      }

      if (decision.decision === "defer" || DECISION_RANK[decision.decision] > DECISION_RANK[proposal.allowedDecision]) {
        failures.push(
          `${file}: ${proposal.id} (${proposal.title}) resolved to ${decision.decision}, allowed ${proposal.allowedDecision}.`,
        )
        failures.push(`  Source: ${proposal.source}`)
        if (decision.findings.length > 0) {
          failures.push("  Findings:")
          failures.push(
            ...decision.findings.map((finding) => `    - [${finding.severity}] ${finding.code}: ${finding.message}`),
          )
        }
        if (decision.requiredNextSteps.length > 0) {
          failures.push("  Required next steps:")
          failures.push(...decision.requiredNextSteps.map((step) => `    - ${step}`))
        }
      }
    }
  }

  if (failures.length > 0) {
    console.error("❌ Strategic Non-Goals proposal check failed.")
    for (const failure of failures) {
      console.error(failure)
    }
    console.error("")
    console.error("Next steps: update the proposal fixture, add an explicit advanced/beta boundary, or revise the proposal before implementation.")
    process.exitCode = 1
    return
  }

  console.log(`✅ Strategic Non-Goals proposal check passed for ${checkedCount} proposal(s) across ${files.length} file(s).`)
  if (advancedDowngrades.length > 0) {
    console.log("Explicit advanced/beta downgrades allowed:")
    for (const downgrade of advancedDowngrades) {
      console.log(`  - ${downgrade}`)
    }
  }
}

await main()
