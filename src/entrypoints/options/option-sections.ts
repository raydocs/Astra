import type { AstraConfig } from "@/types/config"

/**
 * Options surface section model + the zero-config "advanced" gate.
 *
 * Paid-beta product decision #1/#2: ordinary users must never see
 * provider/model/API-key/token controls, and any advanced/provider controls
 * that remain in the code must be unreachable from the default path. This
 * module is the single source of truth for which sections exist and which are
 * hidden behind the explicit advanced flag, so the gating logic is pure and
 * unit-testable without mounting the full OptionsApp component.
 */
export type Section =
  | "general"
  | "providers"
  | "translation"
  | "actions"
  | "sites"
  | "vocabulary"
  | "diagnostics"
  | "about"

export const OPTION_SECTIONS: Section[] = [
  "general",
  "providers",
  "translation",
  "actions",
  "sites",
  "vocabulary",
  "diagnostics",
  "about",
]

/**
 * Sections hidden from the default zero-config path. They remain in the code
 * but are only constructed/reachable when the explicit advanced flag is on,
 * which ordinary beta users never enable.
 *
 * `providers` (the "Astra AI" provider/model/key controls) is the clear leak
 * and is gated here. `diagnostics` is intentionally NOT listed yet: it also
 * hosts the metadata-only support report + cancellation/account-deletion
 * request, which the paid-beta plan keeps as a reachable P0 privacy surface.
 * Gating diagnostics requires first relocating that flow to a non-advanced
 * surface; until then, hiding it would regress a required privacy path.
 */
export const ADVANCED_OPTION_SECTIONS: readonly Section[] = ["providers"]

export const DEFAULT_OPTION_SECTION: Section = "translation"

export type NavItem = { key: Section; label: string }

export const NAV_ITEMS: NavItem[] = [
  { key: "translation", label: "Translation" },
  { key: "actions", label: "Actions" },
  { key: "sites", label: "Sites" },
  { key: "vocabulary", label: "Vocabulary" },
  { key: "providers", label: "Astra AI" },
  { key: "diagnostics", label: "Help & privacy" },
  { key: "general", label: "General" },
  { key: "about", label: "About" },
]

export type NavGroupItem = {
  key: Section
  label: string
  getCount?: (config: AstraConfig) => number | null
}

export const NAV_GROUPS: { label: string; items: NavGroupItem[] }[] = [
  {
    label: "Reading",
    items: [
      { key: "translation", label: "Translation" },
      { key: "actions", label: "Actions" },
      {
        key: "sites",
        label: "Sites",
        getCount: (cfg) => {
          const count = Object.keys(cfg.sites).length
          return count > 0 ? count : null
        },
      },
    ],
  },
  {
    label: "Learning",
    items: [
      { key: "vocabulary", label: "Vocabulary" },
    ],
  },
  {
    label: "Service",
    items: [
      { key: "providers", label: "Astra AI" },
      { key: "diagnostics", label: "Help & privacy" },
    ],
  },
  {
    label: "Account",
    items: [
      { key: "general", label: "General" },
      { key: "about", label: "About" },
    ],
  },
]

export const SECTION_META: Record<Section, { breadcrumb: string }> = {
  translation: { breadcrumb: "Translation" },
  actions: { breadcrumb: "Actions" },
  sites: { breadcrumb: "Sites" },
  vocabulary: { breadcrumb: "Vocabulary" },
  providers: { breadcrumb: "Astra AI" },
  diagnostics: { breadcrumb: "Help & privacy" },
  general: { breadcrumb: "General" },
  about: { breadcrumb: "About" },
}

export function isAdvancedOptionSection(section: Section): boolean {
  return ADVANCED_OPTION_SECTIONS.includes(section)
}

/**
 * The advanced flag is OFF by default and enabled only by an explicit
 * `?advanced=1|true|on` query flag on the options URL. Ordinary beta users
 * never add it, so provider/model surfaces stay off the default path. Accepts
 * an explicit search string for deterministic testing; falls back to the live
 * location when omitted.
 */
export function isOptionsAdvancedEnabled(search?: string): boolean {
  let raw = search
  if (raw === undefined) {
    raw = typeof window !== "undefined" ? window.location.search : ""
  }
  try {
    const value = new URLSearchParams(raw).get("advanced")?.trim().toLowerCase() ?? ""
    return value === "1" || value === "true" || value === "on"
  } catch {
    return false
  }
}

export function isSectionVisible(section: Section, advanced: boolean): boolean {
  return advanced || !isAdvancedOptionSection(section)
}

export function visibleOptionSections(advanced: boolean): Section[] {
  return OPTION_SECTIONS.filter((section) => isSectionVisible(section, advanced))
}

/**
 * Resolve a requested section (e.g. from a `?section=` deep link) down to one
 * that is actually visible on the current path. An advanced-only section
 * requested without the advanced flag falls back to the default section, so a
 * crafted URL cannot open a hidden provider surface.
 */
export function sanitizeRequestedSection(
  candidate: string | null | undefined,
  advanced: boolean,
): Section {
  if (
    candidate
    && OPTION_SECTIONS.includes(candidate as Section)
    && isSectionVisible(candidate as Section, advanced)
  ) {
    return candidate as Section
  }
  return DEFAULT_OPTION_SECTION
}

export function visibleNavGroups(
  advanced: boolean,
): { label: string; items: NavGroupItem[] }[] {
  return NAV_GROUPS
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => isSectionVisible(item.key, advanced)),
    }))
    .filter((group) => group.items.length > 0)
}

export function visibleNavItems(advanced: boolean): NavItem[] {
  return NAV_ITEMS.filter((item) => isSectionVisible(item.key, advanced))
}
