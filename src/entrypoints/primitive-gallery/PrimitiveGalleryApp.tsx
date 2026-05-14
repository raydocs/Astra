import {
  AstraButton,
  AstraCard,
  AstraPill,
  AstraProgress,
  AstraSegmentedControl,
  AstraTextField,
  AstraToggle,
} from "@/components/ui"
import { IconBookmark, IconCheck, IconLanguages, IconSearch, IconSettings, IconStar } from "@/components/icons"

const CERTIFICATION_TRIGGER = "ui-primitives"

const quietSwatches = ["#f4efe6", "#fbf8f1", "#1a1612", "#1f4e7a", "#c4633a"] as const
const twilightSwatches = ["#0d1220", "#141a2c", "#f2efe6", "#e5c98a", "#8aa4d6"] as const

function hasCertificationTrigger() {
  if (typeof window === "undefined") return false
  return new URLSearchParams(window.location.search).get("astraCertification") === CERTIFICATION_TRIGGER
}

function GripDots() {
  return (
    <svg className="astra-primitive-gallery__grip" width="9" height="13" viewBox="0 0 9 13" fill="currentColor" aria-hidden="true">
      <circle cx="2" cy="2" r="1.1" />
      <circle cx="7" cy="2" r="1.1" />
      <circle cx="2" cy="6.5" r="1.1" />
      <circle cx="7" cy="6.5" r="1.1" />
      <circle cx="2" cy="11" r="1.1" />
      <circle cx="7" cy="11" r="1.1" />
    </svg>
  )
}

function SectionLabel({ children }: { children: string }) {
  return (
    <div className="astra-primitive-gallery__artboard-label">
      <GripDots />
      <span>{children}</span>
    </div>
  )
}

function DirectionPanel({
  direction,
  title,
  copy,
  swatches,
}: {
  direction: "A" | "B"
  title: string
  copy: string
  swatches: readonly string[]
}) {
  return (
    <article className={`astra-primitive-gallery__direction astra-primitive-gallery__direction--${direction === "A" ? "quiet" : "twilight"}`}>
      <p className="astra-primitive-gallery__direction-kicker">Direction {direction}</p>
      <h2>{title}</h2>
      <p className="astra-primitive-gallery__direction-copy">{copy}</p>
      <div className="astra-primitive-gallery__palette" aria-label={`${title} palette`}>
        {swatches.map((color) => (
          <span key={color} style={{ background: color }} />
        ))}
      </div>
    </article>
  )
}

function PrimitiveProofStrip() {
  return (
    <section className="astra-primitive-gallery__primitive-proof" aria-label="Shared primitive proof strip">
      <AstraCard elevated>
        <AstraButton icon={<IconStar size={14} />}>Translate page</AstraButton>
        <AstraButton variant="secondary" icon={<IconLanguages size={14} />}>Open Deep Read</AstraButton>
        <AstraButton variant="ghost" icon={<IconSearch size={14} />}>Explain</AstraButton>
        <AstraButton variant="quiet" icon={<IconSettings size={14} />}>Settings</AstraButton>
        <AstraPill tone="accent">Auto-translate on</AstraPill>
        <AstraPill tone="success"><IconCheck size={11} />Saved</AstraPill>
        <AstraToggle pressed label="Bilingual mode" />
        <AstraSegmentedControl
          ariaLabel="Primitive density"
          value="comfortable"
          options={[
            { value: "compact", label: "Compact" },
            { value: "comfortable", label: "Comfort" },
            { value: "spacious", label: "Spacious", disabled: true },
          ]}
          onChange={() => {}}
        />
        <AstraTextField label="Search vocabulary" defaultValue="marginalia" />
        <AstraProgress value={62} label="Quota: 62%" />
        <AstraPill><IconBookmark size={11} />components/ui</AstraPill>
      </AstraCard>
    </section>
  )
}

function PrimitiveGallery() {
  return (
    <main className="astra-primitive-gallery" data-testid="astra-primitive-gallery">
      <section className="astra-primitive-gallery__section astra-primitive-gallery__section--brief" aria-labelledby="primitive-gallery-brief-title">
        <div className="astra-primitive-gallery__section-heading">
          <h1 id="primitive-gallery-brief-title">The brief</h1>
          <p>Modern, restrained, reading-first. Astra translates the web for Chinese readers learning English — without ever overpainting the host page.</p>
        </div>

        <SectionLabel>The two directions</SectionLabel>

        <div className="astra-primitive-gallery__direction-board" aria-label="Astra visual directions">
          <DirectionPanel
            direction="A"
            title="Quiet Reader"
            copy="Warm paper, ink-on-page hierarchy. Translation rendered as marginalia. Astra dissolves into the act of reading."
            swatches={quietSwatches}
          />
          <DirectionPanel
            direction="B"
            title="Constellation"
            copy="Twilight surfaces, soft star-gold accents. The product feels like a quiet observatory — present at night, never demanding."
            swatches={twilightSwatches}
          />
        </div>
      </section>

      <section className="astra-primitive-gallery__section astra-primitive-gallery__section--logo" aria-labelledby="primitive-gallery-logo-title">
        <div className="astra-primitive-gallery__section-heading">
          <h1 id="primitive-gallery-logo-title">Extension logo — six candidates, scored at every size</h1>
          <p>The mark lives in five places: the toolbar (16px), the popup header (18–22px), the install tile (128px), the browser tab favicon (16–32px), and the wordmark lockup.</p>
        </div>

        <SectionLabel>A · Quiet Reader · six marks</SectionLabel>

        <div className="astra-primitive-gallery__logo-artboard" aria-hidden="true">
          <div>Logo · Quiet Reader</div>
          <em>Six marks, scored at the four Chrome sizes</em>
        </div>
      </section>

      <PrimitiveProofStrip />
    </main>
  )
}

export default function PrimitiveGalleryApp() {
  if (!hasCertificationTrigger()) {
    return (
      <main className="astra-primitive-gallery__locked" data-testid="astra-primitive-gallery-locked">
        <AstraCard className="astra-primitive-gallery__locked-card" elevated>
          <h1>Astra primitive gallery is hidden</h1>
          <p>Append <code>?astraCertification=ui-primitives</code> to open this unlinked screenshot harness.</p>
        </AstraCard>
      </main>
    )
  }

  return <PrimitiveGallery />
}
