export type AstraGtmChannelId =
  | "chrome_web_store"
  | "landing_page"
  | "youtube_bilibili_short_demo"
  | "xiaohongshu"
  | "twitter_x"
  | "seo"
  | "share_card"
  | "referral"

export type AstraGtmReadinessCode =
  | "first_four_channels"
  | "demo_under_60_seconds"
  | "learning_loop_story"
  | "technical_terms"
  | "release_gate_alignment"
  | "store_screenshot_loop_coverage"
  | "share_card_branding"
  | "referral_reward_boundary"

export interface AstraGtmChannelDefinition {
  id: AstraGtmChannelId
  label: string
  firstVersion: boolean
  content: string
  target: string
  metric: string
  boundary: string
}

export interface AstraGtmCampaignDefinition {
  id: string
  coreMessage: string
  material: string
}

export interface AstraGtmDemoScript {
  id: string
  title: string
  channelFit: AstraGtmChannelId[]
  estimatedSeconds: number
  steps: string[]
  closingLine: string
  releaseGateRequired: string
}

export interface AstraGtmCopyDeck {
  landingHero: {
    headline: string
    subheadline: string
    primaryCta: string
    secondaryCta: string
  }
  storeListing: {
    title: string
    shortDescription: string
    longDescriptionLead: string
  }
  socialPosts: Array<{
    channel: AstraGtmChannelId
    copy: string
    metric: string
  }>
  shareCardTemplates: Array<{
    id: string
    front: string
    back: string
    watermark: string
  }>
}

export interface AstraGtmReadinessEvidence {
  firstFourChannelsReady: boolean
  demoScriptsUnder60Seconds: boolean
  demoScriptsShowLearningLoop: boolean
  growthCopyHasNoTechnicalTerms: boolean
  promotedCapabilitiesReleaseGated: boolean
  storeScreenshotsLearningLoopCount: number
  shareCardsHaveWatermark: boolean
  referralRewardsDisabledUntilAbuseControls: boolean
}

export interface AstraGtmReadinessFinding {
  code: AstraGtmReadinessCode
  severity: "block" | "warn"
  message: string
  nextStep: string
}

export interface AstraGtmReadinessDecision {
  ready: boolean
  findings: AstraGtmReadinessFinding[]
  blockers: AstraGtmReadinessFinding[]
  warnings: AstraGtmReadinessFinding[]
}

export const ASTRA_GTM_FIRST_VERSION_CHANNELS: AstraGtmChannelDefinition[] = [
  {
    id: "chrome_web_store",
    label: "Chrome Web Store",
    firstVersion: true,
    content: "Six screenshots plus scenario-led listing copy.",
    target: "Install conversion",
    metric: "listing_cvr",
    boundary: "Screenshots and copy must match release-gated capabilities and beta limits.",
  },
  {
    id: "landing_page",
    label: "Landing Page",
    firstVersion: true,
    content: "60-second demo path plus sample lesson CTA.",
    target: "Explain the product positioning quickly.",
    metric: "cta_click_rate",
    boundary: "Do not mention providers, models, API keys, or internal routing in first-screen copy.",
  },
  {
    id: "youtube_bilibili_short_demo",
    label: "YouTube/Bilibili short demo",
    firstVersion: true,
    content: "A real article or video becomes a saved review card.",
    target: "Education-market understanding.",
    metric: "completion_rate",
    boundary: "Use works-best-with copy for supported video surfaces.",
  },
  {
    id: "share_card",
    label: "Share Card",
    firstVersion: true,
    content: "Bilingual sentence card with Astra watermark and metadata-only landing tracking.",
    target: "User-led distribution.",
    metric: "share_count",
    boundary: "User-initiated only; short learning moments, not full third-party content.",
  },
  {
    id: "xiaohongshu",
    label: "Xiaohongshu",
    firstVersion: false,
    content: "不用背单词，用真实内容学英文.",
    target: "Chinese learner awareness.",
    metric: "save_comment_rate",
    boundary: "Avoid broad outcome guarantees.",
  },
  {
    id: "twitter_x",
    label: "Twitter/X",
    firstVersion: false,
    content: "Builder / AI / productivity short demo.",
    target: "Early-user traffic.",
    metric: "click_install_rate",
    boundary: "Do not drift into developer-console or model terminology on user-facing posts.",
  },
  {
    id: "seo",
    label: "SEO",
    firstVersion: false,
    content: "read English websites with AI.",
    target: "Long-tail discovery.",
    metric: "search_clicks",
    boundary: "SEO pages must keep capability boundaries aligned with release gates.",
  },
  {
    id: "referral",
    label: "Referral",
    firstVersion: false,
    content: "Invite link tracking without rewards until abuse controls exist.",
    target: "Future paid growth.",
    metric: "invited_signups",
    boundary: "No Pro-day reward promise until abuse-safe backend controls exist.",
  },
]

export const ASTRA_GTM_CAMPAIGNS: AstraGtmCampaignDefinition[] = [
  {
    id: "read_one_article_keep_five_expressions",
    coreMessage: "Read one article, keep five useful expressions.",
    material: "Article demo",
  },
  {
    id: "watch_youtube_as_language_lesson",
    coreMessage: "Watch a supported video as a language lesson.",
    material: "Video demo",
  },
  {
    id: "no_api_keys_no_setup",
    coreMessage: "No API keys, no setup — just read.",
    material: "Onboarding demo",
  },
  {
    id: "three_minutes_review_real_content",
    coreMessage: "Three minutes of review from real content.",
    material: "Review demo",
  },
  {
    id: "your_learning_trail",
    coreMessage: "Your learning trail keeps pages, saves, and review connected.",
    material: "Library and digest screenshot",
  },
]

export const ASTRA_GTM_DEMO_SCRIPTS: AstraGtmDemoScript[] = [
  {
    id: "article_to_five_expressions",
    title: "Read one article, keep five expressions",
    channelFit: ["landing_page", "youtube_bilibili_short_demo", "chrome_web_store"],
    estimatedSeconds: 55,
    steps: [
      "Open a real English article.",
      "Use Astra to make the page understandable without setup.",
      "Select a useful expression in context.",
      "Save it as a reviewable card.",
      "Open Review and show the original source context.",
    ],
    closingLine: "Read anything. Learn what matters.",
    releaseGateRequired: "Public Beta core reading/save/review path.",
  },
  {
    id: "video_to_lesson",
    title: "Watch a supported video as a language lesson",
    channelFit: ["youtube_bilibili_short_demo", "chrome_web_store"],
    estimatedSeconds: 58,
    steps: [
      "Open a supported captioned video.",
      "Show Astra's video learning panel or subtitle help.",
      "Pick one useful expression from the transcript moment.",
      "Save it with time/source context.",
      "Review the saved expression later.",
    ],
    closingLine: "Turn videos you already watch into language practice.",
    releaseGateRequired: "Video learning beta gate with works-best-with boundary.",
  },
  {
    id: "zero_setup_onboarding",
    title: "No API keys, no setup",
    channelFit: ["landing_page", "chrome_web_store", "twitter_x"],
    estimatedSeconds: 40,
    steps: [
      "Start Astra from the landing/sample path.",
      "Choose a target language and goal in ordinary language.",
      "Open the sample lesson.",
      "Understand, save, and review one authored sentence.",
    ],
    closingLine: "Just read. Astra handles the AI.",
    releaseGateRequired: "Managed AI beta/free boundary and sample lesson first-success path.",
  },
  {
    id: "three_minute_review",
    title: "Three minutes of review from real content",
    channelFit: ["landing_page", "xiaohongshu", "chrome_web_store"],
    estimatedSeconds: 45,
    steps: [
      "Open Today Review.",
      "Show a card made from real content the learner saved.",
      "Answer one card and show lightweight progress.",
      "Return to the source for context.",
    ],
    closingLine: "Review what you chose, not a generic word list.",
    releaseGateRequired: "Review daily-goal and source-context gate.",
  },
  {
    id: "learning_trail_library",
    title: "Your learning trail",
    channelFit: ["landing_page", "chrome_web_store", "seo"],
    estimatedSeconds: 50,
    steps: [
      "Open Library after a few saves.",
      "Show sources grouped by article/video/file/sample.",
      "Show saved cards linked to a source.",
      "Open a weekly digest-style summary without showing full page text.",
      "Continue the source from the learning trail.",
    ],
    closingLine: "Your everyday reading becomes a learning trail.",
    releaseGateRequired: "Library/source controls and data-retention boundary.",
  },
]

export const ASTRA_GTM_COPY_DECK: AstraGtmCopyDeck = {
  landingHero: {
    headline: "Read anything. Learn what matters.",
    subheadline: "Astra turns real English webpages and supported videos into understanding, saved expressions, and lightweight review — without setup.",
    primaryCta: "Try the sample lesson",
    secondaryCta: "See how Astra saves and reviews",
  },
  storeListing: {
    title: "Astra — learn English from real webpages and videos",
    shortDescription: "Read English webpages and supported videos with AI, save useful expressions, and review later — no API setup.",
    longDescriptionLead: "Open a real article, page, PDF, or supported video; Astra helps you understand it, save useful expressions, and review them later with source context.",
  },
  socialPosts: [
    {
      channel: "youtube_bilibili_short_demo",
      copy: "Demo: one English article → five saved expressions → a three-minute review from the page you actually read.",
      metric: "completion_rate",
    },
    {
      channel: "xiaohongshu",
      copy: "不用先背单词。打开真实英文内容，读懂一句，保存一句，明天复习一句。",
      metric: "save_comment_rate",
    },
    {
      channel: "twitter_x",
      copy: "Astra turns everyday reading into language memory: understand a page, save the phrase, review it with source context.",
      metric: "click_install_rate",
    },
    {
      channel: "seo",
      copy: "Read English websites with AI and keep useful expressions for review.",
      metric: "search_clicks",
    },
    {
      channel: "share_card",
      copy: "Shared from Astra: a real sentence, a useful translation, and a path back to lightweight review.",
      metric: "share_count",
    },
    {
      channel: "landing_page",
      copy: "Try a zero-config sample: understand one sentence, save it, and review it in under a minute.",
      metric: "cta_click_rate",
    },
    {
      channel: "chrome_web_store",
      copy: "Screenshots show the loop: read → explain → save → review → continue your learning trail.",
      metric: "listing_cvr",
    },
    {
      channel: "youtube_bilibili_short_demo",
      copy: "Watch a supported captioned video as a language lesson. Save one moment; review it later.",
      metric: "completion_rate",
    },
    {
      channel: "xiaohongshu",
      copy: "每天 3 分钟复习，不是随机词表，而是你昨天真正读过的表达。",
      metric: "save_comment_rate",
    },
    {
      channel: "twitter_x",
      copy: "No setup-first workflow: just read, save what matters, and review from real context.",
      metric: "click_install_rate",
    },
  ],
  shareCardTemplates: [
    {
      id: "sentence_translation",
      front: "{sourceSentence}",
      back: "{translation}\nFrom: {sourceTitle}",
      watermark: "Shared from Astra — Read anything. Learn what matters.",
    },
    {
      id: "review_moment",
      front: "Today I saved: {sourceSentence}",
      back: "Review it later with Astra.",
      watermark: "Astra sentence card",
    },
  ],
}

const TECHNICAL_TERMS = [
  "provider",
  "model",
  "api key",
  "api keys",
  "openai",
  "gemini",
  "openrouter",
  "relay",
  "token",
]

const FINDING_COPY: Record<AstraGtmReadinessCode, { message: string; nextStep: string }> = {
  first_four_channels: {
    message: "The first-version GTM channels are not all ready.",
    nextStep: "Prepare Chrome Web Store, Landing Page, short-demo, and Share Card materials before treating GTM as launch-ready.",
  },
  demo_under_60_seconds: {
    message: "One or more demo scripts exceed the 60-second aha requirement.",
    nextStep: "Trim each demo to a single real task: understand, save, review, and close with the Astra line.",
  },
  learning_loop_story: {
    message: "Demo materials do not clearly show the learning loop.",
    nextStep: "Show the sequence: real content → understand → save → review → return/continue.",
  },
  technical_terms: {
    message: "Growth copy still contains internal technical terms.",
    nextStep: "Remove provider/model/API/relay/token language from user-facing growth copy.",
  },
  release_gate_alignment: {
    message: "Promoted capabilities are not evidenced as release-gated.",
    nextStep: "Only promote capabilities with matching release-stage evidence and beta/works-best-with boundaries.",
  },
  store_screenshot_loop_coverage: {
    message: "Store screenshots do not sufficiently cover the learning loop.",
    nextStep: "Ensure at least five of six screenshots serve read/explain/save/review/library/zero-setup learning-loop storytelling.",
  },
  share_card_branding: {
    message: "Share cards do not have consistent Astra branding/watermark.",
    nextStep: "Keep share cards watermarked and user-initiated so sharing carries brand memory without overexposing content.",
  },
  referral_reward_boundary: {
    message: "Referral copy or implementation promises rewards before abuse controls exist.",
    nextStep: "Keep referral MVP non-rewarding until backend abuse checks and paid-plan reward policy are ready.",
  },
}

function makeFinding(code: AstraGtmReadinessCode, severity: "block" | "warn" = "block"): AstraGtmReadinessFinding {
  const copy = FINDING_COPY[code]
  return {
    code,
    severity,
    message: copy.message,
    nextStep: copy.nextStep,
  }
}

export function detectGrowthCopyTechnicalTerms(copy: string): string[] {
  const normalized = copy.toLowerCase()
  return TECHNICAL_TERMS.filter((term) => normalized.includes(term))
}

export function evaluateAstraGtmReadiness(evidence: AstraGtmReadinessEvidence): AstraGtmReadinessDecision {
  const findings: AstraGtmReadinessFinding[] = []

  if (!evidence.firstFourChannelsReady) findings.push(makeFinding("first_four_channels"))
  if (!evidence.demoScriptsUnder60Seconds) findings.push(makeFinding("demo_under_60_seconds"))
  if (!evidence.demoScriptsShowLearningLoop) findings.push(makeFinding("learning_loop_story"))
  if (!evidence.growthCopyHasNoTechnicalTerms) findings.push(makeFinding("technical_terms"))
  if (!evidence.promotedCapabilitiesReleaseGated) findings.push(makeFinding("release_gate_alignment"))
  if (evidence.storeScreenshotsLearningLoopCount < 5) findings.push(makeFinding("store_screenshot_loop_coverage", "warn"))
  if (!evidence.shareCardsHaveWatermark) findings.push(makeFinding("share_card_branding"))
  if (!evidence.referralRewardsDisabledUntilAbuseControls) findings.push(makeFinding("referral_reward_boundary"))

  const blockers = findings.filter((finding) => finding.severity === "block")
  const warnings = findings.filter((finding) => finding.severity === "warn")
  return {
    ready: blockers.length === 0,
    findings,
    blockers,
    warnings,
  }
}
