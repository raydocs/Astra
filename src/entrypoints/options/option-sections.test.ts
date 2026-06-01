import { describe, expect, it } from "vitest"

import {
  ADVANCED_OPTION_SECTIONS,
  isOptionsAdvancedEnabled,
  isSectionVisible,
  OPTION_SECTIONS,
  sanitizeRequestedSection,
  visibleNavGroups,
  visibleNavItems,
  visibleOptionSections,
} from "./option-sections"

describe("options zero-config advanced gate", () => {
  it("keeps provider/model controls in the section catalogue but advanced-gated", () => {
    // The section still exists in code (advanced/BYOK retained)...
    expect(OPTION_SECTIONS).toContain("providers")
    // ...but is classified as advanced-only.
    expect(ADVANCED_OPTION_SECTIONS).toContain("providers")
  })

  it("hides the provider/model section from the default (zero-config) path", () => {
    const visible = visibleOptionSections(false)
    expect(visible).not.toContain("providers")
    // Everything else an ordinary user needs stays reachable.
    for (const section of ["general", "translation", "actions", "sites", "vocabulary", "about"] as const) {
      expect(visible).toContain(section)
    }
  })

  it("reveals the provider/model section only when the advanced flag is on", () => {
    expect(visibleOptionSections(true)).toContain("providers")
    expect(isSectionVisible("providers", false)).toBe(false)
    expect(isSectionVisible("providers", true)).toBe(true)
  })

  it("removes the 'Astra AI' provider nav entry from the default desktop and mobile nav", () => {
    const groupKeys = visibleNavGroups(false).flatMap((group) => group.items.map((item) => item.key))
    expect(groupKeys).not.toContain("providers")
    // The plan's reachability rule: a nav entry labelled "Astra AI" must not be
    // navigable to provider controls on the default path.
    const groupLabels = visibleNavGroups(false).flatMap((group) => group.items.map((item) => item.label))
    expect(groupLabels).not.toContain("Astra AI")

    const itemKeys = visibleNavItems(false).map((item) => item.key)
    expect(itemKeys).not.toContain("providers")
    expect(visibleNavItems(false).map((item) => item.label)).not.toContain("Astra AI")
  })

  it("restores the provider nav entry under the advanced flag", () => {
    const groupKeys = visibleNavGroups(true).flatMap((group) => group.items.map((item) => item.key))
    expect(groupKeys).toContain("providers")
    expect(visibleNavItems(true).map((item) => item.key)).toContain("providers")
  })

  it("never drops a whole nav group to empty by hiding advanced sections", () => {
    // The "Service" group also holds diagnostics, so it survives provider hiding.
    for (const group of visibleNavGroups(false)) {
      expect(group.items.length).toBeGreaterThan(0)
    }
  })

  it("refuses to open a hidden provider surface from a crafted deep link", () => {
    expect(sanitizeRequestedSection("providers", false)).toBe("translation")
    expect(sanitizeRequestedSection("providers", true)).toBe("providers")
    expect(sanitizeRequestedSection("translation", false)).toBe("translation")
    expect(sanitizeRequestedSection("vocabulary", false)).toBe("vocabulary")
    expect(sanitizeRequestedSection("bogus-section", false)).toBe("translation")
    expect(sanitizeRequestedSection(null, false)).toBe("translation")
  })

  it("treats the advanced flag as off unless explicitly enabled", () => {
    expect(isOptionsAdvancedEnabled("")).toBe(false)
    expect(isOptionsAdvancedEnabled("?section=translation")).toBe(false)
    expect(isOptionsAdvancedEnabled("?advanced=0")).toBe(false)
    expect(isOptionsAdvancedEnabled("?advanced=false")).toBe(false)
    expect(isOptionsAdvancedEnabled("?advanced=1")).toBe(true)
    expect(isOptionsAdvancedEnabled("?advanced=true")).toBe(true)
    expect(isOptionsAdvancedEnabled("?advanced=on")).toBe(true)
    expect(isOptionsAdvancedEnabled("?advanced=ON&section=providers")).toBe(true)
  })

  it("honors a persisted opt-in even without the URL flag, but stays off by default", () => {
    expect(isOptionsAdvancedEnabled("", false)).toBe(false)
    expect(isOptionsAdvancedEnabled("", undefined)).toBe(false)
    expect(isOptionsAdvancedEnabled("", true)).toBe(true)
    // URL flag still works independently of the persisted preference.
    expect(isOptionsAdvancedEnabled("?advanced=1", false)).toBe(true)
  })
})
