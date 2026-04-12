import { z } from "zod"
import { SiteConfigSchema, isDefaultSiteConfig } from "@/types/config"
import type { AstraConfig, SiteConfig } from "@/types/config"

export const SharedSiteRuleSchema = z.object({
  hostname: z.string().min(1),
  version: z.literal(1),
  rule: SiteConfigSchema,
  author: z.string().optional(),
  description: z.string().optional(),
})

export type SharedSiteRule = z.infer<typeof SharedSiteRuleSchema>

const SharedSiteRulesArraySchema = z.array(SharedSiteRuleSchema)

/**
 * Export all non-default site configs from an AstraConfig as a shareable JSON string.
 */
export function exportSiteRules(config: AstraConfig): string {
  const rules: SharedSiteRule[] = Object.entries(config.sites)
    .filter(([, siteConfig]) => !isDefaultSiteConfig(siteConfig))
    .map(([hostname, rule]) => ({
      hostname,
      version: 1 as const,
      rule,
    }))

  return JSON.stringify(rules, null, 2)
}

/**
 * Export a single site's config as a shareable JSON string.
 */
export function exportSingleSiteRule(hostname: string, config: SiteConfig): string {
  const rule: SharedSiteRule = {
    hostname,
    version: 1 as const,
    rule: config,
  }

  return JSON.stringify(rule, null, 2)
}

/**
 * Parse and validate a JSON string containing one or more shared site rules,
 * then merge them into the existing config. Imported rules override matching hostnames.
 *
 * Returns the updated AstraConfig on success, or throws on invalid input.
 */
export function importSiteRules(json: string, existingConfig: AstraConfig): AstraConfig {
  const parsed: unknown = JSON.parse(json)

  // Accept either a single rule object or an array of rules.
  let rules: SharedSiteRule[]
  if (Array.isArray(parsed)) {
    rules = SharedSiteRulesArraySchema.parse(parsed)
  } else {
    const single = SharedSiteRuleSchema.parse(parsed)
    rules = [single]
  }

  const nextSites = { ...existingConfig.sites }

  for (const { hostname, rule } of rules) {
    if (isDefaultSiteConfig(rule)) {
      delete nextSites[hostname]
    } else {
      nextSites[hostname] = rule
    }
  }

  return {
    ...existingConfig,
    sites: nextSites,
  }
}
