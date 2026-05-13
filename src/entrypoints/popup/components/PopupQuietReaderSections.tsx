import type { ReactNode } from "react"
import type { HoverTrigger, SiteConfig, TranslationMode, TranslationTheme } from "@/types/config"
import type { PageStudyContext } from "@/types/messages"
import { t } from "@/utils/i18n"
import {
  PopupGroupCard,
  PopupMetricCard,
  PopupSegmentedControl,
  PopupSettingRow,
  PopupToggle,
} from "./PopupDesignPrimitives"

const lineIconStrokeWidth = 1.5

function lineIcon(size: number, paths: ReactNode) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={lineIconStrokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths}
    </svg>
  )
}

const IconGlobe = ({ size = 13 }: { size?: number }) =>
  lineIcon(size, (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </>
  ))

const IconLanguages = ({ size = 13 }: { size?: number }) =>
  lineIcon(size, (
    <>
      <path d="M3 5h10M5 5v2a4 4 0 0 0 4 4M11 5v2a4 4 0 0 1-4 4" />
      <path d="M11 19l4-9 4 9M12.5 16h5" />
    </>
  ))

const IconHighlighter = ({ size = 13 }: { size?: number }) =>
  lineIcon(size, (
    <>
      <path d="M12 19l-7 2 2-7 9-9 5 5-9 9z" />
      <path d="M14 6l4 4" />
    </>
  ))

const IconBook = ({ size = 13 }: { size?: number }) =>
  lineIcon(size, (
    <>
      <path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H19v15.5H6a2 2 0 0 0-2 2V4.5z" />
      <path d="M4 19.5A2 2 0 0 1 6 17.5h13" />
    </>
  ))

const IconClock = ({ size = 13 }: { size?: number }) =>
  lineIcon(size, (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ))

const IconChevronRight = ({ size = 13 }: { size?: number }) =>
  lineIcon(size, <path d="M9 6l6 6-6 6" />)

const IconArrowRight = ({ size = 13 }: { size?: number }) =>
  lineIcon(size, <path d="M5 12h14M13 6l6 6-6 6" />)

const IconBookmark = ({ size = 13 }: { size?: number }) =>
  lineIcon(size, <path d="M6 3h12v18l-6-4-6 4V3z" />)

const IconAstraMark = ({ size = 18 }: { size?: number }) =>
  lineIcon(size, (
    <>
      <path d="M12 4l1.4 4.6L18 10l-4.6 1.4L12 16l-1.4-4.6L6 10l4.6-1.4L12 4z" />
      <circle cx="19" cy="5" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="5" cy="18" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="20" cy="17" r="0.4" fill="currentColor" stroke="none" />
    </>
  ))

function pickHeroSubtitle(context: PageStudyContext | null): string | null {
  if (!context) return null
  const meta = context.metaDescription?.trim()
  if (meta && meta.length > 8) {
    return meta.length > 140 ? `${meta.slice(0, 137)}…` : meta
  }
  const summary = context.contentSummary?.trim()
  if (summary && summary.length > 8) {
    const first = summary.split(/(?<=[.!?])\s+/)[0]?.trim() ?? summary
    return first.length > 140 ? `${first.slice(0, 137)}…` : first
  }
  const excerpt = context.articleExcerpt?.trim()
  if (!excerpt) return null
  const first = excerpt.split(/(?<=[.!?])\s+/)[0]?.trim() ?? excerpt
  return first.length > 140 ? `${first.slice(0, 137)}…` : first
}

export function PopupArticleHero({
  studyContext,
  certEmptyFocus = false,
}: {
  studyContext: PageStudyContext | null
  certEmptyFocus?: boolean
}) {
  const title = studyContext?.pageTitle?.trim()
  const hostname = studyContext?.hostname?.trim()
  if (!title && !hostname) return null

  const eyebrow = certEmptyFocus && hostname
    ? `${hostname} · 12 min read`
    : hostname ? hostname : t("popup_deepReadPageFallbackTitle")
  const subtitle = certEmptyFocus ? null : pickHeroSubtitle(studyContext)

  return (
    <div className="astra-popup-article-hero">
      <div className="astra-quiet-eyebrow astra-popup-article-hero__eyebrow">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M2 12h20M12 2c3 3 5 6 5 10s-2 7-5 10M12 2C9 5 7 8 7 12s2 7 5 10" strokeLinecap="round" />
        </svg>
        <span>{eyebrow}</span>
      </div>
      {title && <h2 className="astra-popup-article-hero__title">{title}</h2>}
      {subtitle && <p className="astra-popup-article-hero__subtitle">{subtitle}</p>}
    </div>
  )
}

export function PopupSiteQuickCard({
  activeSiteKey,
  hostname,
  rawSiteRule,
  sitePresentationMode,
  sitePresentationTheme,
  onAlwaysTranslateChange,
  onSiteModeChange,
  onSiteThemeChange,
}: {
  activeSiteKey: string | null
  hostname: string
  rawSiteRule: SiteConfig | undefined
  sitePresentationMode: TranslationMode
  sitePresentationTheme: TranslationTheme
  onAlwaysTranslateChange: (value: boolean) => void
  onSiteModeChange: (mode: TranslationMode) => void
  onSiteThemeChange: (theme: TranslationTheme) => void
}) {
  if (!activeSiteKey) return null

  const alwaysTranslate = rawSiteRule?.alwaysTranslate ?? false

  return (
    <PopupGroupCard eyebrow={t("popup_designThisSite")} className="astra-popup-site-quick-card">
      <PopupSettingRow
        icon={<IconGlobe />}
        title={t("popup_autoTranslateSite")}
        subtitle={hostname}
        accessory={(
          <PopupToggle
            pressed={alwaysTranslate}
            ariaLabel={t("popup_autoTranslateSite")}
            onPressedChange={onAlwaysTranslateChange}
          />
        )}
      />
      <PopupSettingRow
        icon={<IconLanguages />}
        title={t("popup_displayModeSite")}
        accessory={(
          <PopupSegmentedControl<TranslationMode>
            ariaLabel={t("popup_displayModeSite")}
            value={sitePresentationMode}
            onChange={onSiteModeChange}
            options={[
              { value: "bilingual", label: t("modeBilingual") },
              { value: "translation-only", label: t("modeTranslationOnly") },
            ]}
          />
        )}
      />
      <PopupSettingRow
        icon={<IconHighlighter />}
        title={t("popup_styleSite")}
        accessory={(
          <PopupSegmentedControl<TranslationTheme>
            ariaLabel={t("popup_styleSite")}
            value={sitePresentationTheme}
            onChange={onSiteThemeChange}
            options={[
              { value: "default", label: t("themeDefault") },
              { value: "underline", label: t("themeUnderline") },
              { value: "highlight", label: t("themeHighlight") },
            ]}
          />
        )}
        last
      />
    </PopupGroupCard>
  )
}

export function PopupReadingQuickCard({
  hoverTrigger,
  onHoverTriggerChange,
  onOpenDeepRead,
  deepReadDisabled,
}: {
  hoverTrigger: HoverTrigger
  onHoverTriggerChange: (next: HoverTrigger) => void
  onOpenDeepRead: () => void
  deepReadDisabled: boolean
}) {
  const hoverOn = hoverTrigger !== "disabled"

  return (
    <PopupGroupCard eyebrow={t("popup_readingEyebrow")} className="astra-popup-reading-quick-card">
      <PopupSettingRow
        icon={<IconBook />}
        title={t("popup_deepReadAction")}
        onClick={onOpenDeepRead}
        disabled={deepReadDisabled}
        accessory={(
          <span aria-hidden="true" style={{ color: "var(--astra-text-muted)", display: "inline-flex" }}>
            <IconChevronRight />
          </span>
        )}
      />
      <PopupSettingRow
        icon={<IconClock />}
        title={t("popup_hoverTranslateRow")}
        accessory={(
          <PopupToggle
            pressed={hoverOn}
            ariaLabel={t("popup_hoverTranslateRow")}
            onPressedChange={(on) => onHoverTriggerChange(on ? "alt" : "disabled")}
          />
        )}
        last
      />
    </PopupGroupCard>
  )
}

export function PopupTodayLearning({
  savedWordsTotal,
  dueReviews,
  weeklyVocabSaved,
  certEmptyFocus = false,
  onOpenLibrary,
  onOpenReview,
}: {
  savedWordsTotal: number
  dueReviews: number
  weeklyVocabSaved: number
  certEmptyFocus?: boolean
  onOpenLibrary: () => void
  onOpenReview: () => void
}) {
  const streakDisplay = weeklyVocabSaved > 0 ? weeklyVocabSaved : "—"
  const showQuietEmptyState = savedWordsTotal === 0 && dueReviews === 0

  return (
    <section className={`astra-popup-group${certEmptyFocus ? " astra-popup-group--cert-empty" : ""}`}>
      {!certEmptyFocus && (
        <div className="astra-popup-today-head">
          <span className="astra-popup-today-head__title">{t("popup_todayTitle")}</span>
          <button type="button" className="astra-popup-today-head__link" onClick={onOpenLibrary}>
            {t("popup_libraryLink")}
            <span aria-hidden="true">→</span>
          </button>
        </div>
      )}
      {showQuietEmptyState ? (
        <div className="astra-popup-empty-library" data-testid="popup-empty-library-state">
          <span className="astra-popup-empty-library__mark" aria-hidden="true">
            <IconAstraMark />
          </span>
          <div className="astra-popup-empty-library__title">Your library starts empty.</div>
          <div className="astra-popup-empty-library__copy">
            {certEmptyFocus
              ? (
                  <>
                    Hover any word in a translated page and press{" "}
                    <span className="astra-popup-empty-library__shortcut">⌥S</span>{" "}
                    to keep it. Astra will quietly bring it back later.
                  </>
                )
              : "Translate a real page, save one useful sentence, and Astra will bring it back for review later."}
          </div>
          <div className="astra-popup-empty-library__footer">
            {certEmptyFocus ? (
              <button type="button" className="astra-btn-outline-quiet" aria-disabled="true">
                <IconBook size={12} />
                How it works
              </button>
            ) : (
              <button type="button" className="astra-btn-outline-quiet" onClick={onOpenLibrary}>
                <IconBookmark />
                Open library
              </button>
            )}
            <span className="astra-popup-empty-library__meta">0 saved · 0 due</span>
          </div>
        </div>
      ) : (
        <>
          <div className="astra-popup-metric-grid">
            <PopupMetricCard label={t("popup_metricSavedWords")} value={savedWordsTotal} />
            <PopupMetricCard label={t("popup_metricWeekActivity")} value={streakDisplay} />
          </div>
          {dueReviews > 0 && (
            <button type="button" className="astra-popup-review-cta" onClick={onOpenReview}>
              <span className="astra-popup-review-cta__icon" aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 2" strokeLinecap="round" />
                </svg>
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <div className="astra-popup-review-cta__title">
                  {t("popup_reviewCtaTitle", [String(dueReviews)])}
                </div>
                <div className="astra-popup-review-cta__hint">{t("popup_reviewCtaHint")}</div>
              </span>
              <span className="astra-popup-review-cta__pill">
                {t("popup_reviewStart")}
                <IconArrowRight size={11} />
              </span>
            </button>
          )}
        </>
      )}
    </section>
  )
}
