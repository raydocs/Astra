import { epubReaderLongChapterHoldoutScenario } from "./epub-reader-long-chapter"
import { hoverTranslationMovingTargetsHoldoutScenario } from "./hover-translation-moving-targets"
import { imageOcrOverlayRobustnessHoldoutScenario } from "./image-ocr-overlay-robustness-holdout"
import { interactionStressHoldoutScenario } from "./interaction-stress"
import { pageTranslationDenseInlineRichTextSourceHoldoutScenario } from "./page-translation-dense-inline-rich-text-source"
import { pageTranslationFeedCardChurnHoldoutScenario } from "./page-translation-feed-card-churn"
import { privacyModeShouldNotLeakHoldoutScenario } from "./privacy-mode-should-not-leak"
import { pageTranslationLayoutNoiseSourceHoldoutScenario } from "./page-translation-layout-noise-source"
import { pdfReaderLayoutNoiseHoldoutScenario } from "./pdf-reader-layout-noise"
import { subtitleFileMalformedHoldoutScenario } from "./subtitle-file-malformed"
import { youtubeSubtitleRaceHoldoutScenario } from "./youtube-subtitle-race"
import { translationRaceHoldoutScenario } from "./translation-race"
import { siteRuleUpdateRestartsActiveSessionSourceHoldoutScenario } from "./site-rule-update-restarts-active-session-source"
import { pageTranslationInvalidSelectorsSourceHoldoutScenario } from "./page-translation-invalid-selectors-source"
import { spaNavigationRestartsActiveSessionSourceHoldoutScenario } from "./spa-navigation-restarts-active-session-source"
import { rapidSpaNavigationSingleRestartSourceHoldoutScenario } from "./rapid-spa-navigation-single-restart-source"
import { pageTranslationMalformedRichTextPlaceholderFallbackSourceHoldoutScenario } from "./page-translation-malformed-rich-text-placeholder-fallback-source"
import { providerSwitchRestartsActiveSessionSourceHoldoutScenario } from "./provider-switch-restarts-active-session-source"
import { providerAndSiteRuleUpdateSingleRestartSourceHoldoutScenario } from "./provider-and-site-rule-update-single-restart-source"
import { backgroundRoutedRelayOnlyPageTranslationSourceHoldoutScenario } from "./background-routed-relay-only-page-translation-source"
import { backgroundRoutedDirectSuccessPageTranslationSourceHoldoutScenario } from "./background-routed-direct-success-page-translation-source"
import { backgroundRoutedDirectRelayFallbackPageTranslationSourceHoldoutScenario } from "./background-routed-direct-relay-fallback-page-translation-source"

export { epubReaderLongChapterHoldoutScenario } from "./epub-reader-long-chapter"
export { hoverTranslationMovingTargetsHoldoutScenario } from "./hover-translation-moving-targets"
export { imageOcrOverlayRobustnessHoldoutScenario } from "./image-ocr-overlay-robustness-holdout"
export { interactionStressHoldoutScenario } from "./interaction-stress"
export { pageTranslationDenseInlineRichTextSourceHoldoutScenario } from "./page-translation-dense-inline-rich-text-source"
export { pageTranslationFeedCardChurnHoldoutScenario } from "./page-translation-feed-card-churn"
export { privacyModeShouldNotLeakHoldoutScenario } from "./privacy-mode-should-not-leak"
export { pageTranslationLayoutNoiseSourceHoldoutScenario } from "./page-translation-layout-noise-source"
export { pdfReaderLayoutNoiseHoldoutScenario } from "./pdf-reader-layout-noise"
export { subtitleFileMalformedHoldoutScenario } from "./subtitle-file-malformed"
export { youtubeSubtitleRaceHoldoutScenario } from "./youtube-subtitle-race"
export { translationRaceHoldoutScenario } from "./translation-race"
export { siteRuleUpdateRestartsActiveSessionSourceHoldoutScenario } from "./site-rule-update-restarts-active-session-source"
export { pageTranslationInvalidSelectorsSourceHoldoutScenario } from "./page-translation-invalid-selectors-source"
export { spaNavigationRestartsActiveSessionSourceHoldoutScenario } from "./spa-navigation-restarts-active-session-source"
export { rapidSpaNavigationSingleRestartSourceHoldoutScenario } from "./rapid-spa-navigation-single-restart-source"
export { pageTranslationMalformedRichTextPlaceholderFallbackSourceHoldoutScenario } from "./page-translation-malformed-rich-text-placeholder-fallback-source"
export { providerSwitchRestartsActiveSessionSourceHoldoutScenario } from "./provider-switch-restarts-active-session-source"
export { providerAndSiteRuleUpdateSingleRestartSourceHoldoutScenario } from "./provider-and-site-rule-update-single-restart-source"
export { backgroundRoutedRelayOnlyPageTranslationSourceHoldoutScenario } from "./background-routed-relay-only-page-translation-source"
export { backgroundRoutedDirectSuccessPageTranslationSourceHoldoutScenario } from "./background-routed-direct-success-page-translation-source"
export { backgroundRoutedDirectRelayFallbackPageTranslationSourceHoldoutScenario } from "./background-routed-direct-relay-fallback-page-translation-source"

/**
 * Holdout scenarios that are intentionally NOT registered in the main
 * `bench-live/scenarios/index.ts`. They are only accessible via explicit
 * import from this module.
 *
 * These test harder conditions and are meant to be run explicitly by ID
 * to detect regressions or validate robustness beyond the basic suite.
 */
export const holdoutScenarios = [
  epubReaderLongChapterHoldoutScenario,
  hoverTranslationMovingTargetsHoldoutScenario,
  imageOcrOverlayRobustnessHoldoutScenario,
  interactionStressHoldoutScenario,
  pageTranslationDenseInlineRichTextSourceHoldoutScenario,
  pageTranslationFeedCardChurnHoldoutScenario,
  privacyModeShouldNotLeakHoldoutScenario,
  pageTranslationLayoutNoiseSourceHoldoutScenario,
  pdfReaderLayoutNoiseHoldoutScenario,
  subtitleFileMalformedHoldoutScenario,
  youtubeSubtitleRaceHoldoutScenario,
  translationRaceHoldoutScenario,
  siteRuleUpdateRestartsActiveSessionSourceHoldoutScenario,
  pageTranslationInvalidSelectorsSourceHoldoutScenario,
  spaNavigationRestartsActiveSessionSourceHoldoutScenario,
  rapidSpaNavigationSingleRestartSourceHoldoutScenario,
  pageTranslationMalformedRichTextPlaceholderFallbackSourceHoldoutScenario,
  providerSwitchRestartsActiveSessionSourceHoldoutScenario,
  providerAndSiteRuleUpdateSingleRestartSourceHoldoutScenario,
  backgroundRoutedRelayOnlyPageTranslationSourceHoldoutScenario,
  backgroundRoutedDirectSuccessPageTranslationSourceHoldoutScenario,
  backgroundRoutedDirectRelayFallbackPageTranslationSourceHoldoutScenario,
]
