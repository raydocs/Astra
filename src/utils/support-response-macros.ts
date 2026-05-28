import {
  SupportBundleIssueCategorySchema,
  type SupportBundleFeatureSurface,
  type SupportBundleIssueCategory,
} from "./support-bundle"

export const ASTRA_SUPPORT_FIRST_RESPONSE_MACRO_COVERAGE_THRESHOLD = 0.8

export type AstraSupportFirstResponseMacroId =
  | "macro_translation_quality"
  | "macro_page_not_working"
  | "macro_video_subtitles"
  | "macro_file_reader"
  | "macro_review_library"
  | "macro_account_access"
  | "macro_privacy_question"
  | "macro_other"

export interface AstraSupportFirstResponseMacro {
  id: AstraSupportFirstResponseMacroId
  issueCategory: SupportBundleIssueCategory
  title: string
  firstResponse: string
  nextStep: string
  privacyNote: string
  surfaces: SupportBundleFeatureSurface[]
}

export interface AstraSupportFirstResponseMacroCoverageBucket {
  issueCategory: SupportBundleIssueCategory | "unknown"
  count: number
  macroId: AstraSupportFirstResponseMacroId | null
  title: string | null
  covered: boolean
}

export interface AstraSupportFirstResponseMacroSummary {
  schema: "astra-support-first-response-macros.v1"
  generatedAt: string
  threshold: number
  catalogCoverage: {
    coveredIssueCategories: number
    totalIssueCategories: number
    coverageRate: number
    ready: boolean
  }
  reportedCoverage: {
    coveredReports: number
    totalReports: number
    unknownIssueReports: number
    coverageRate: number | null
    ready: boolean | null
  }
  byIssueCategory: AstraSupportFirstResponseMacroCoverageBucket[]
  macros: AstraSupportFirstResponseMacro[]
}

export interface SupportFirstResponseMacroReportBucketInput {
  issueCategory: string | null | undefined
  count: number
}

const REQUIRED_ISSUE_CATEGORIES = SupportBundleIssueCategorySchema.options

export const ASTRA_SUPPORT_FIRST_RESPONSE_MACROS: AstraSupportFirstResponseMacro[] = [
  {
    id: "macro_translation_quality",
    issueCategory: "translation_quality",
    title: "Translation quality concern",
    firstResponse: "Thanks for reporting this translation. We’ll compare the language pair and page context so we can improve the result.",
    nextStep: "Ask the user for the language pair and whether the issue changes the meaning, tone, or formatting.",
    privacyNote: "Use the support bundle metadata first; ask before collecting any example sentence.",
    surfaces: ["page", "selection", "writing"],
  },
  {
    id: "macro_page_not_working",
    issueCategory: "page_not_working",
    title: "Page translation did not work",
    firstResponse: "Thanks for the report. Some pages block or change content in ways that can stop Astra from reading them correctly.",
    nextStep: "Suggest refreshing the page, trying a smaller selection, or sharing the site hostname if it is not already in the report.",
    privacyNote: "Do not ask for the full page address or page text unless the user chooses to share it.",
    surfaces: ["page", "selection", "onboarding"],
  },
  {
    id: "macro_video_subtitles",
    issueCategory: "video_subtitles",
    title: "Video subtitles unavailable",
    firstResponse: "Thanks for letting us know. Astra can only work with video captions when the video or page makes captions available.",
    nextStep: "Suggest checking whether captions are available on the video, then trying the transcript panel or another video.",
    privacyNote: "Use video/page metadata only; do not request a transcript by default.",
    surfaces: ["video"],
  },
  {
    id: "macro_file_reader",
    issueCategory: "file_reader",
    title: "File reader trouble",
    firstResponse: "Thanks for reporting this file issue. Some files have layout, scan, or format limits that can prevent clean reading.",
    nextStep: "Ask for the file type and whether another file opens, without requesting the file itself at first response.",
    privacyNote: "Do not ask the user to upload the file unless they clearly choose that path.",
    surfaces: ["file"],
  },
  {
    id: "macro_review_library",
    issueCategory: "review_library",
    title: "Saved item or review issue",
    firstResponse: "Thanks for flagging this. We’ll check whether the saved item, review queue, or library state is out of sync.",
    nextStep: "Ask whether the item is missing, duplicated, or not updating, and suggest refreshing the library view.",
    privacyNote: "Do not include saved text, notes, or review answers in the first response.",
    surfaces: ["review", "library", "digest"],
  },
  {
    id: "macro_account_access",
    issueCategory: "account_access",
    title: "Account or membership help",
    firstResponse: "Thanks for reaching out. We’ll check the account and membership state shown by Astra and help you get back in.",
    nextStep: "Ask whether the user is signing in, starting a trial, managing membership, or restoring access.",
    privacyNote: "Use account status metadata; do not ask for passwords or payment details.",
    surfaces: ["account", "settings", "onboarding"],
  },
  {
    id: "macro_privacy_question",
    issueCategory: "privacy_question",
    title: "Privacy or data question",
    firstResponse: "Thanks for asking. Astra is designed to keep support reports metadata-only unless you choose to add more.",
    nextStep: "Point the user to Privacy Mode, export, deletion, or support bundle preview based on their question.",
    privacyNote: "Answer from published policy and metadata fields; do not request content examples by default.",
    surfaces: ["settings", "account", "page", "library"],
  },
  {
    id: "macro_other",
    issueCategory: "other",
    title: "General support request",
    firstResponse: "Thanks for the report. We’ll review the metadata you chose to send and route it to the right support path.",
    nextStep: "Ask one plain-language follow-up question about what the user expected and what happened instead.",
    privacyNote: "Keep the first response metadata-only and ask before collecting any examples.",
    surfaces: ["page", "selection", "video", "file", "review", "library", "account", "onboarding", "settings", "writing", "digest"],
  },
]

const MACROS_BY_ISSUE_CATEGORY = new Map<SupportBundleIssueCategory, AstraSupportFirstResponseMacro>(
  ASTRA_SUPPORT_FIRST_RESPONSE_MACROS.map((macro) => [macro.issueCategory, macro]),
)

const MACROS_BY_ID = new Map<AstraSupportFirstResponseMacroId, AstraSupportFirstResponseMacro>(
  ASTRA_SUPPORT_FIRST_RESPONSE_MACROS.map((macro) => [macro.id, macro]),
)

function normalizeIssueCategory(value: string | null | undefined): SupportBundleIssueCategory | "unknown" {
  const parsed = SupportBundleIssueCategorySchema.safeParse(value)
  return parsed.success ? parsed.data : "unknown"
}

export function findSupportFirstResponseMacro(
  issueCategory: string | null | undefined,
): AstraSupportFirstResponseMacro | null {
  const normalized = normalizeIssueCategory(issueCategory)
  if (normalized === "unknown") return null
  return MACROS_BY_ISSUE_CATEGORY.get(normalized) ?? null
}

export function findSupportFirstResponseMacroById(
  macroId: string | null | undefined,
): AstraSupportFirstResponseMacro | null {
  if (!macroId) return null
  return MACROS_BY_ID.get(macroId as AstraSupportFirstResponseMacroId) ?? null
}

export function summarizeSupportFirstResponseMacroCoverage(params: {
  reportBuckets?: SupportFirstResponseMacroReportBucketInput[]
  totalReports?: number
  generatedAt?: string
} = {}): AstraSupportFirstResponseMacroSummary {
  const generatedAt = params.generatedAt ?? new Date().toISOString()
  const catalogCovered = REQUIRED_ISSUE_CATEGORIES.filter((category) => MACROS_BY_ISSUE_CATEGORY.has(category)).length
  const catalogCoverageRate = catalogCovered / REQUIRED_ISSUE_CATEGORIES.length
  const issueCounts = new Map<SupportBundleIssueCategory | "unknown", number>()
  let coveredReports = 0
  let unknownIssueReports = 0

  for (const bucket of params.reportBuckets ?? []) {
    const count = Math.max(0, Number(bucket.count) || 0)
    const issueCategory = normalizeIssueCategory(bucket.issueCategory)
    issueCounts.set(issueCategory, (issueCounts.get(issueCategory) ?? 0) + count)
    if (issueCategory === "unknown") {
      unknownIssueReports += count
    } else if (MACROS_BY_ISSUE_CATEGORY.has(issueCategory)) {
      coveredReports += count
    } else {
      unknownIssueReports += count
    }
  }

  const totalReports = params.totalReports ?? [...issueCounts.values()].reduce((sum, count) => sum + count, 0)
  const reportedCoverageRate = totalReports > 0 ? coveredReports / totalReports : null
  const byIssueCategory: AstraSupportFirstResponseMacroCoverageBucket[] = [
    ...REQUIRED_ISSUE_CATEGORIES.map<AstraSupportFirstResponseMacroCoverageBucket>((issueCategory) => {
      const macro = MACROS_BY_ISSUE_CATEGORY.get(issueCategory) ?? null
      return {
        issueCategory,
        count: issueCounts.get(issueCategory) ?? 0,
        macroId: macro?.id ?? null,
        title: macro?.title ?? null,
        covered: Boolean(macro),
      }
    }),
    ...(issueCounts.has("unknown")
      ? [{
        issueCategory: "unknown" as const,
        count: issueCounts.get("unknown") ?? 0,
        macroId: null,
        title: null,
        covered: false,
      }]
      : []),
  ].sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count
    return a.issueCategory.localeCompare(b.issueCategory)
  })

  return {
    schema: "astra-support-first-response-macros.v1",
    generatedAt,
    threshold: ASTRA_SUPPORT_FIRST_RESPONSE_MACRO_COVERAGE_THRESHOLD,
    catalogCoverage: {
      coveredIssueCategories: catalogCovered,
      totalIssueCategories: REQUIRED_ISSUE_CATEGORIES.length,
      coverageRate: catalogCoverageRate,
      ready: catalogCoverageRate >= ASTRA_SUPPORT_FIRST_RESPONSE_MACRO_COVERAGE_THRESHOLD,
    },
    reportedCoverage: {
      coveredReports,
      totalReports,
      unknownIssueReports,
      coverageRate: reportedCoverageRate,
      ready: reportedCoverageRate == null
        ? null
        : reportedCoverageRate >= ASTRA_SUPPORT_FIRST_RESPONSE_MACRO_COVERAGE_THRESHOLD,
    },
    byIssueCategory,
    macros: ASTRA_SUPPORT_FIRST_RESPONSE_MACROS,
  }
}
