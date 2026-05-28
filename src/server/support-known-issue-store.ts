import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname } from "node:path"

import { z } from "zod"

import {
  KnownIssueMetadataSchema,
  SupportBundleSchema,
  type KnownIssueMetadata,
  type SupportBundle,
} from "../utils/support-bundle"

import type { RelayEnv } from "./types"

const SupportKnownIssueDatabaseSchema = z.object({
  version: z.literal(1),
  issues: z.array(KnownIssueMetadataSchema).max(200).default([]),
}).strict()

type SupportKnownIssueDatabase = z.infer<typeof SupportKnownIssueDatabaseSchema>

function normalizeHostname(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  if (!trimmed) return null
  try {
    return new URL(trimmed).hostname.toLowerCase().replace(/^www\./, "")
  } catch {
    return trimmed.toLowerCase().replace(/^https?:\/\//, "").split(/[/?#]/, 1)[0].replace(/^www\./, "") || null
  }
}

function hostnameMatches(issueHostname: string | undefined, bundleHostname: string | undefined): boolean {
  if (!issueHostname) return true
  const issueHost = normalizeHostname(issueHostname)
  const bundleHost = normalizeHostname(bundleHostname)
  if (!issueHost || !bundleHost) return false
  return bundleHost === issueHost || bundleHost.endsWith(`.${issueHost}`)
}

function versionMatches(affectedVersions: string[], extensionVersion: string): boolean {
  return affectedVersions.length === 0 || affectedVersions.includes(extensionVersion)
}

export function findMatchingKnownIssue(
  bundle: SupportBundle,
  issues: readonly KnownIssueMetadata[],
): KnownIssueMetadata | null {
  const parsedBundle = SupportBundleSchema.parse(bundle)
  return issues.find((issue) => {
    if (issue.status === "fixed") return false
    if (issue.featureSurface !== parsedBundle.featureSurface) return false
    if (parsedBundle.issueCategory && issue.issueCategory !== parsedBundle.issueCategory) return false
    if (!hostnameMatches(issue.hostname, parsedBundle.hostname)) return false
    if (!versionMatches(issue.affectedVersions, parsedBundle.extensionVersion)) return false
    return true
  }) ?? null
}

async function createEmptyKnownIssueDatabase(): Promise<SupportKnownIssueDatabase> {
  return { version: 1, issues: [] }
}

async function loadAuthoritativeKnownIssueDatabase(env: RelayEnv): Promise<SupportKnownIssueDatabase> {
  try {
    const raw = await readFile(env.supportKnownIssueStorePath, "utf8")
    const parsed = SupportKnownIssueDatabaseSchema.safeParse(JSON.parse(raw))
    if (parsed.success) {
      return parsed.data
    }
    const empty = await createEmptyKnownIssueDatabase()
    await saveAuthoritativeKnownIssueDatabase(env, empty)
    return empty
  } catch {
    const empty = await createEmptyKnownIssueDatabase()
    await saveAuthoritativeKnownIssueDatabase(env, empty)
    return empty
  }
}

async function saveAuthoritativeKnownIssueDatabase(env: RelayEnv, db: SupportKnownIssueDatabase): Promise<void> {
  await mkdir(dirname(env.supportKnownIssueStorePath), { recursive: true })
  await writeFile(env.supportKnownIssueStorePath, JSON.stringify(db, null, 2))
}

export class FileSupportKnownIssueStore {
  private cache: SupportKnownIssueDatabase | null = null

  constructor(private readonly env: RelayEnv) {}

  private async load(): Promise<SupportKnownIssueDatabase> {
    if (this.cache) return this.cache
    const db = await loadAuthoritativeKnownIssueDatabase(this.env)
    this.cache = db
    return db
  }

  async listIssues(): Promise<KnownIssueMetadata[]> {
    const db = await this.load()
    return [...db.issues].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  async replaceIssues(input: unknown): Promise<KnownIssueMetadata[]> {
    const inputRecord: Record<string, unknown> = typeof input === "object" && input !== null && !Array.isArray(input)
      ? input as Record<string, unknown>
      : {}
    const parsed = SupportKnownIssueDatabaseSchema.parse({
      version: 1,
      ...(Array.isArray(input) ? { issues: input } : inputRecord),
    })
    this.cache = parsed
    await saveAuthoritativeKnownIssueDatabase(this.env, parsed)
    return this.listIssues()
  }

  async findMatch(bundle: SupportBundle): Promise<KnownIssueMetadata | null> {
    return findMatchingKnownIssue(bundle, await this.listIssues())
  }
}
