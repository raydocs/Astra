import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { describe, expect, it } from "vitest"

import { COPY_DICTIONARY, findForbiddenUserCopyTerms } from "./copy-dictionary"
import { LEARNING_LOOP_PRO_VALUE_MOMENTS } from "./learning-loop-events"

// Astra's manifest sets default_locale: zh_CN, so a key missing from a catalog
// falls back to Chinese — an English-locale user would then see Chinese text.
// These guards keep en/zh at parity and keep the English catalog in lockstep
// with the TypeScript fallbacks that localizedOrFallback() resolves against.
const readCatalog = (locale: string) =>
  JSON.parse(readFileSync(resolve(process.cwd(), `public/_locales/${locale}/messages.json`), "utf8")) as Record<string, { message: string }>
const en = readCatalog("en")
const zh = readCatalog("zh_CN")

const MEMBERSHIP_COPY_KEYS: Record<string, keyof typeof COPY_DICTIONARY> = {
  copyProValue: "proValue",
  copyDailyFreeReached: "dailyFreeReached",
  copyFreeLimit: "freeLimit",
  copyProLongContent: "proLongContent",
  copyContinueTomorrow: "continueTomorrow",
}

const PRO_MOMENT_TRIGGERS = ["long_video", "deep_read", "sync", "digest", "near_limit"] as const
const PRO_MOMENT_FIELDS = ["eyebrow", "title", "summary", "cta"] as const

const UPGRADE_PROMPT_KEYS = [
  "upgradePrompt_cta",
  "upgradePrompt_boundary",
  "upgradePrompt_momentum_eyebrow",
  "upgradePrompt_momentum_title",
  "upgradePrompt_momentum_summary",
  "upgradePrompt_continuity_eyebrow",
  "upgradePrompt_continuity_title",
  "upgradePrompt_continuity_summary",
]

const MEMBERSHIP_KEYS = [
  ...Object.keys(MEMBERSHIP_COPY_KEYS),
  ...PRO_MOMENT_TRIGGERS.flatMap((t) => PRO_MOMENT_FIELDS.map((f) => `proMoment_${t}_${f}`)),
  ...UPGRADE_PROMPT_KEYS,
  "proMomentsCardTitle",
  "proMomentsCardSummary",
]

describe("membership copy i18n", () => {
  it("keeps en and zh_CN catalogs at full key parity (default_locale is zh_CN)", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort())
  })

  it("defines every membership key in both catalogs", () => {
    for (const key of MEMBERSHIP_KEYS) {
      expect(en[key]?.message, `en missing ${key}`).toBeTruthy()
      expect(zh[key]?.message, `zh_CN missing ${key}`).toBeTruthy()
    }
  })

  it("keeps the English catalog in lockstep with the TypeScript fallbacks", () => {
    for (const [messageKey, dictKey] of Object.entries(MEMBERSHIP_COPY_KEYS)) {
      expect(en[messageKey]!.message, `drift on ${messageKey}`).toBe(COPY_DICTIONARY[dictKey])
    }
    for (const trigger of PRO_MOMENT_TRIGGERS) {
      const moment = LEARNING_LOOP_PRO_VALUE_MOMENTS[trigger]
      for (const field of PRO_MOMENT_FIELDS) {
        expect(en[`proMoment_${trigger}_${field}`]!.message, `drift on proMoment_${trigger}_${field}`).toBe(moment[field])
      }
    }
  })

  it("preserves the {moment} placeholder in both languages so interpolation works", () => {
    for (const key of ["upgradePrompt_momentum_summary", "upgradePrompt_continuity_summary"]) {
      expect(en[key]!.message).toContain("{moment}")
      expect(zh[key]!.message).toContain("{moment}")
    }
  })

  it("keeps new English membership copy free of restricted technical language", () => {
    for (const key of MEMBERSHIP_KEYS) {
      expect(findForbiddenUserCopyTerms(en[key]!.message), `forbidden term in ${key}`).toEqual([])
    }
  })
})
