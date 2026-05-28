import type { ResolvedSiteTranslationSettings, SiteConfig } from "@/types/config"
import {
  SITE_RULE_FILTER_STAGE_ORDER,
  type TranslationRuntimeDiagnostics,
  type TranslationSelectorDiagnostics,
  type TranslationSiteRuleDiagnostics,
  type TranslationSiteRuleFilterStageDiagnostics,
  type TranslationSiteRuleFilterStageId,
  type TranslationSnapshot,
} from "@/types/translation"
import { warningStyle } from "./styles"

export type SiteRulesQuickFixAction = "clear-include-selectors" | "clear-exclude-selectors"

export interface SiteRulesQuickFix {
  action: SiteRulesQuickFixAction
  label: string
  reason: string
}

interface SelectorSyntaxValidation {
  configured: string[]
  valid: string[]
  invalid: string[]
}

export interface SiteRulesExplainabilityModel {
  title: string
  why: string
  ruleSource: string
  ruleSummary: string[]
  selectorSummary: string[]
  runtimeSummary: string[]
  warnings: string[]
  quickFixes: SiteRulesQuickFix[]
}

export interface SiteRulesExplainabilityPanelProps {
  activeSiteKey: string | null
  rawSiteRule: SiteConfig | undefined
  resolvedSite: ResolvedSiteTranslationSettings
  translationState: TranslationSnapshot | null
  contentAvailable: boolean
  providerReady: boolean
  statusMessage?: string
  onQuickFix?: (action: SiteRulesQuickFixAction) => void
}

const rowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 8,
  fontSize: 12,
  marginTop: 6,
}

const labelStyle: React.CSSProperties = {
  color: "var(--astra-text-muted)",
  flex: "0 0 auto",
}

const valueStyle: React.CSSProperties = {
  color: "var(--astra-text-primary)",
  textAlign: "right",
  fontWeight: 600,
}

function validateSelectorSyntax(selectors?: string[]): SelectorSyntaxValidation {
  const configured = selectors?.filter((selector) => selector.trim().length > 0) ?? []
  const valid: string[] = []
  const invalid: string[] = []

  configured.forEach((selector) => {
    try {
      document.querySelector(selector)
      valid.push(selector)
    } catch {
      invalid.push(selector)
    }
  })

  return { configured, valid, invalid }
}

function formatList(values: string[]): string {
  if (values.length === 0) return "none"
  return values.join(", ")
}

const filterStageLabels: Record<TranslationSiteRuleFilterStageId, string> = {
  "collected-blocks": "Collected blocks",
  "after-include-filters": "After include filters",
  "after-exclude-filters": "After exclude filters",
  "after-paragraph-filter": "After paragraph filter",
}

function getCompleteOrderedFilterStages(
  siteRules: TranslationSiteRuleDiagnostics,
): TranslationSiteRuleFilterStageDiagnostics[] | null {
  const { filterStages } = siteRules
  if (!filterStages || filterStages.length !== SITE_RULE_FILTER_STAGE_ORDER.length) return null

  const expected = new Set<TranslationSiteRuleFilterStageId>(SITE_RULE_FILTER_STAGE_ORDER)
  const seen = new Set<TranslationSiteRuleFilterStageId>()

  for (const stage of filterStages) {
    if (!expected.has(stage.id) || seen.has(stage.id)) return null
    seen.add(stage.id)
  }

  return SITE_RULE_FILTER_STAGE_ORDER.every((id) => seen.has(id)) ? filterStages : null
}

function buildRuntimeFilterStageRows(siteRules: TranslationSiteRuleDiagnostics): string[] {
  const filterStages = getCompleteOrderedFilterStages(siteRules)
  if (filterStages) {
    return filterStages.map((stage) => `${filterStageLabels[stage.id]}: ${stage.count}`)
  }

  return [
    `${filterStageLabels["collected-blocks"]}: ${siteRules.inputBlockCount}`,
    `${filterStageLabels["after-include-filters"]}: ${siteRules.afterIncludeCount}`,
    `${filterStageLabels["after-exclude-filters"]}: ${siteRules.afterExcludeCount}`,
    `${filterStageLabels["after-paragraph-filter"]}: ${siteRules.afterParagraphCount}`,
  ]
}

function summarizeSelector(
  label: string,
  configured: string[] | undefined,
  syntax: SelectorSyntaxValidation,
  runtime: TranslationSelectorDiagnostics | undefined,
): string[] {
  if (!configured?.length) return [`${label}: not configured`]

  const valid = runtime?.valid ?? syntax.valid
  const invalid = runtime?.invalid ?? syntax.invalid
  const lines = [`${label}: ${configured.length} configured · ${valid.length} valid · ${invalid.length} invalid`]

  if (invalid.length > 0) {
    lines.push(`${label} invalid: ${formatList(invalid)}`)
  }
  if (runtime) {
    lines.push(`${label} matched blocks: ${runtime.matchedBlocks}`)
  }

  return lines
}

function hasAdvancedRules(resolvedSite: ResolvedSiteTranslationSettings, rawSiteRule: SiteConfig | undefined): boolean {
  return !!resolvedSite.selectors?.length
    || !!resolvedSite.excludeSelectors?.length
    || !!rawSiteRule?.includePathPatterns?.length
    || !!rawSiteRule?.excludePathPatterns?.length
    || resolvedSite.paragraphMinLength != null
}

function buildWhy(params: SiteRulesExplainabilityPanelProps, diagnostics: TranslationRuntimeDiagnostics | undefined): string {
  const { activeSiteKey, contentAvailable, providerReady, resolvedSite, statusMessage, translationState } = params
  const phase = translationState?.phase ?? "idle"
  const siteRules = diagnostics?.siteRules

  if (!activeSiteKey) return "No active http(s) tab is available, so Astra cannot evaluate this page."
  if (!contentAvailable) return statusMessage || "Astra content diagnostics are unavailable for this page."
  if (!resolvedSite.enabled) {
    const hasPathPatterns = (params.rawSiteRule?.includePathPatterns?.length ?? 0) > 0
      || (params.rawSiteRule?.excludePathPatterns?.length ?? 0) > 0
    if ((params.rawSiteRule?.enabled ?? true) && hasPathPatterns) {
      return "Astra is disabled because the current URL path does not match this site rule."
    }
    return "Astra is disabled for this site by the current site rule/default setting."
  }
  if (!providerReady) return "Astra is enabled here, but translation is waiting for Astra AI sign-in."
  if (siteRules && siteRules.inputBlockCount > 0 && siteRules.afterParagraphCount === 0) {
    return "Astra found page text, but the current site filters matched no translatable blocks."
  }
  if (phase !== "idle") {
    return resolvedSite.alwaysTranslate
      ? `Translation is ${phase} because auto-translate is enabled for this site.`
      : `Translation is ${phase} for the current manual session.`
  }
  if (resolvedSite.alwaysTranslate) {
    return "Auto-translate is enabled, but the runtime has not reported an active translation session yet."
  }
  return "Astra is ready on this page, but auto-translate is off; use Translate This Page to start."
}

function hasConfiguredSelectors(selectors?: string[]): boolean {
  return selectors?.some((selector) => selector.trim().length > 0) ?? false
}

function getConfiguredSelectors(selectors?: string[]): string[] {
  return selectors?.map((selector) => selector.trim()).filter(Boolean) ?? []
}

function countCurrentInvalidSelectors(
  currentSelectors: string[],
  syntaxInvalid: string[],
  runtimeInvalid?: string[],
): number {
  const currentSet = new Set(currentSelectors)
  const runtimeInvalidCount = runtimeInvalid?.filter((selector) => currentSet.has(selector.trim())).length ?? 0
  const syntaxInvalidCount = syntaxInvalid.filter((selector) => currentSet.has(selector.trim())).length

  return Math.max(runtimeInvalidCount, syntaxInvalidCount)
}

function diagnosticsMatchCurrentSelectors(
  currentSelectors: string[],
  runtime: TranslationSelectorDiagnostics | undefined,
): boolean {
  const runtimeConfigured = runtime?.configured.map((selector) => selector.trim()).filter(Boolean) ?? []

  return runtimeConfigured.length === currentSelectors.length
    && runtimeConfigured.every((selector, index) => selector === currentSelectors[index])
}

function buildQuickFixes(params: {
  includeSyntax: SelectorSyntaxValidation
  excludeSyntax: SelectorSyntaxValidation
  resolvedSite: ResolvedSiteTranslationSettings
  siteRules: TranslationRuntimeDiagnostics["siteRules"] | undefined
}): SiteRulesQuickFix[] {
  const currentIncludeSelectors = getConfiguredSelectors(params.resolvedSite.selectors)
  const currentExcludeSelectors = getConfiguredSelectors(params.resolvedSite.excludeSelectors)
  const includeInvalid = countCurrentInvalidSelectors(
    currentIncludeSelectors,
    params.includeSyntax.invalid,
    params.siteRules?.selectors?.invalid,
  ) > 0
  const excludeInvalid = countCurrentInvalidSelectors(
    currentExcludeSelectors,
    params.excludeSyntax.invalid,
    params.siteRules?.excludeSelectors?.invalid,
  ) > 0
  const includeMatchedZero = !includeInvalid
    && hasConfiguredSelectors(params.resolvedSite.selectors)
    && diagnosticsMatchCurrentSelectors(currentIncludeSelectors, params.siteRules?.selectors)
    && (params.siteRules?.inputBlockCount ?? 0) > 0
    && params.siteRules?.afterIncludeCount === 0

  const quickFixes: SiteRulesQuickFix[] = []

  if (includeInvalid) {
    quickFixes.push({
      action: "clear-include-selectors",
      label: "Clear include selectors",
      reason: "Invalid include selector detected.",
    })
  } else if (includeMatchedZero) {
    quickFixes.push({
      action: "clear-include-selectors",
      label: "Clear include selectors",
      reason: "Include selector matched zero blocks.",
    })
  }

  if (excludeInvalid) {
    quickFixes.push({
      action: "clear-exclude-selectors",
      label: "Clear exclude selectors",
      reason: "Invalid exclude selector detected.",
    })
  }

  return quickFixes
}

export function buildSiteRulesExplainabilityModel(params: SiteRulesExplainabilityPanelProps): SiteRulesExplainabilityModel {
  const { activeSiteKey, rawSiteRule, resolvedSite, translationState } = params
  const diagnostics = translationState?.diagnostics
  const siteRules = diagnostics?.siteRules
  const includeSyntax = validateSelectorSyntax(resolvedSite.selectors)
  const excludeSyntax = validateSelectorSyntax(resolvedSite.excludeSelectors)
  const warnings: string[] = []
  const quickFixes = buildQuickFixes({ includeSyntax, excludeSyntax, resolvedSite, siteRules })

  if (includeSyntax.invalid.length > 0 || excludeSyntax.invalid.length > 0) {
    warnings.push("Invalid selectors are ignored instead of blocking all translation.")
  }
  if (siteRules?.inputBlockCount && siteRules.afterIncludeCount === 0 && (resolvedSite.selectors?.length ?? 0) > 0) {
    warnings.push("Include selectors currently match no collected text blocks.")
  }
  if (siteRules && siteRules.afterExcludeCount === 0 && siteRules.afterIncludeCount > 0 && (resolvedSite.excludeSelectors?.length ?? 0) > 0) {
    warnings.push("Exclude selectors removed every included block.")
  }
  if (siteRules && siteRules.afterParagraphCount === 0 && siteRules.afterExcludeCount > 0 && (resolvedSite.paragraphMinLength ?? 0) > 0) {
    warnings.push("Paragraph length filtering removed every remaining block.")
  }

  const selectorSummary = hasAdvancedRules(resolvedSite, rawSiteRule)
    ? [
        ...summarizeSelector("Include selectors", resolvedSite.selectors, includeSyntax, siteRules?.selectors),
        ...summarizeSelector("Exclude selectors", resolvedSite.excludeSelectors, excludeSyntax, siteRules?.excludeSelectors),
        `Include path patterns: ${rawSiteRule?.includePathPatterns?.length ?? 0}`,
        `Exclude path patterns: ${rawSiteRule?.excludePathPatterns?.length ?? 0}`,
        `Paragraph min length: ${resolvedSite.paragraphMinLength ?? "not configured"}`,
      ]
    : ["No advanced include/exclude/path/paragraph filters are configured for this site."]

  const runtimeSummary = siteRules
    ? [
        "Runtime diagnostics: available",
        ...buildRuntimeFilterStageRows(siteRules),
        `Scope: ${diagnostics?.effectiveContentScope ?? diagnostics?.contentScope ?? resolvedSite.contentScope}`,
      ]
    : [
        "Runtime diagnostics: unavailable",
        "Page match counts appear after content runtime starts or reports translation state.",
      ]

  return {
    title: "Why this page?",
    why: buildWhy(params, diagnostics),
    ruleSource: rawSiteRule
      ? `Saved site rule for ${activeSiteKey ?? resolvedSite.hostname ?? "this site"}`
      : "Global defaults (no saved site rule for this site)",
    ruleSummary: [
      `Astra: ${resolvedSite.enabled ? "enabled" : "disabled"}`,
      `Auto-translate: ${resolvedSite.alwaysTranslate ? "on" : "off"}`,
      `Target: ${resolvedSite.targetLang}`,
      `Content scope: ${resolvedSite.contentScope}`,
    ],
    selectorSummary,
    runtimeSummary,
    warnings,
    quickFixes,
  }
}

function SummaryRows({ title, rows }: { title: string; rows: string[] }) {
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--astra-text-primary)", textTransform: "uppercase", letterSpacing: 0.3 }}>{title}</div>
      {rows.map((row) => {
        const [label, ...rest] = row.split(": ")
        return (
          <div key={row} style={rowStyle}>
            <span style={labelStyle}>{rest.length > 0 ? label : row}</span>
            {rest.length > 0 && <span style={valueStyle}>{rest.join(": ")}</span>}
          </div>
        )
      })}
    </div>
  )
}

function QuickFixActions({
  quickFixes,
  onQuickFix,
}: {
  quickFixes: SiteRulesQuickFix[]
  onQuickFix?: (action: SiteRulesQuickFixAction) => void
}) {
  if (!onQuickFix || quickFixes.length === 0) return null

  return (
    <div data-testid="site-rules-quick-fixes" style={{ marginTop: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--astra-text-primary)", textTransform: "uppercase", letterSpacing: 0.3 }}>Quick fixes</div>
      <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
        {quickFixes.map((quickFix) => (
          <div key={quickFix.action} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <span style={{ fontSize: 12, color: "var(--astra-text-secondary)", lineHeight: 1.35 }}>{quickFix.reason}</span>
            <button
              type="button"
              className="astra-btn-secondary"
              data-testid={`site-rules-quick-fix-${quickFix.action}`}
              onClick={() => onQuickFix(quickFix.action)}
              style={{ flex: "0 0 auto", fontSize: 11, padding: "4px 8px" }}
            >
              {quickFix.label}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function SiteRulesExplainabilityPanel(props: SiteRulesExplainabilityPanelProps) {
  const model = buildSiteRulesExplainabilityModel(props)

  return (
    <section data-testid="site-rules-explainability-panel" className="astra-site-sheet__card">
      <div className="astra-sheet-row__title" style={{ fontSize: 13 }}>{model.title}</div>
      <div data-testid="site-rules-explainability-why" className="astra-sheet-row__sub" style={{ marginTop: 6, lineHeight: 1.45 }}>
        {model.why}
      </div>
      <SummaryRows title="Rule source" rows={[model.ruleSource, ...model.ruleSummary]} />
      <SummaryRows title="Selector checks" rows={model.selectorSummary} />
      <SummaryRows title="Runtime" rows={model.runtimeSummary} />
      {model.warnings.map((warning) => (
        <div key={warning} style={{ ...warningStyle, marginTop: 8 }}>{warning}</div>
      ))}
      <QuickFixActions quickFixes={model.quickFixes} onQuickFix={props.onQuickFix} />
    </section>
  )
}
