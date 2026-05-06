;(function(){
const {
  AstraMark,
  AstraWordmark,
  IconStar,
  IconBook,
  IconLanguages,
  IconBookmark,
  IconHighlighter,
  IconArrowRight,
  IconCheck,
  IconClose,
  IconSettings,
  IconGlobe,
  IconList,
  IconDot,
  Card,
  Btn,
  Pill,
  Toggle,
  BilingualLine,
  HoverCard,
  SelectionToolbar,
} = window;

/* ====================================================================
   Design System frame — shows tokens, type, color, components
   per direction. The whole frame is wrapped with [data-astra=...]
   so the tokens swap underneath everything.
   ==================================================================== */

const Section = ({ title, eyebrow, children, style }) => (
  <section style={{ marginBottom: 56, ...style }}>
    <div style={{ marginBottom: 20 }}>
      <div className="eyebrow" style={{ marginBottom: 6 }}>{eyebrow}</div>
      <h2
        className="serif"
        style={{
          fontSize: 32,
          lineHeight: 1.15,
          margin: 0,
          color: "var(--ink-1)",
        }}
      >
        {title}
      </h2>
    </div>
    {children}
  </section>
);

const Swatch = ({ name, value, dark }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
    <div
      style={{
        height: 88,
        borderRadius: "var(--r-md)",
        background: value,
        border: "1px solid var(--line-1)",
      }}
    />
    <div>
      <div style={{ fontSize: 13, color: "var(--ink-1)", fontWeight: 500 }}>{name}</div>
      <div className="mono" style={{ color: "var(--ink-3)" }}>{value}</div>
    </div>
  </div>
);

const TypeRow = ({ label, sample, style }) => (
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "180px 1fr",
      alignItems: "baseline",
      gap: 24,
      padding: "18px 0",
      borderBottom: "1px solid var(--line-1)",
    }}
  >
    <div>
      <div style={{ fontSize: 12, color: "var(--ink-3)", fontFamily: "var(--font-mono)" }}>{label}</div>
    </div>
    <div style={style}>{sample}</div>
  </div>
);

const DesignSystemFrame = ({ direction = "quiet" }) => {
  const isQuiet = direction === "quiet";
  const palette = isQuiet
    ? [
        { n: "page", v: "#f4efe6" },
        { n: "surface", v: "#fbf8f1" },
        { n: "elevated", v: "#ffffff" },
        { n: "sunken", v: "#ece5d8" },
        { n: "ink-1", v: "#1a1612" },
        { n: "ink-2", v: "#4a423a" },
        { n: "ink-3", v: "#7a7068" },
        { n: "ink-4", v: "#a89e93" },
        { n: "accent", v: "#1f4e7a" },
        { n: "highlight", v: "#c4633a" },
      ]
    : [
        { n: "page", v: "#0d1220" },
        { n: "surface", v: "#141a2c" },
        { n: "elevated", v: "#1a2138" },
        { n: "sunken", v: "#0a0f1c" },
        { n: "ink-1", v: "#f2efe6" },
        { n: "ink-2", v: "rgba(242,239,230,0.74)" },
        { n: "ink-3", v: "rgba(242,239,230,0.54)" },
        { n: "ink-4", v: "rgba(242,239,230,0.36)" },
        { n: "accent", v: "#e5c98a" },
        { n: "highlight", v: "#8aa4d6" },
      ];

  return (
    <div
      data-astra={direction}
      className="astra-root"
      style={{
        width: 1280,
        background: "var(--bg-page)",
        padding: "72px 88px 96px",
        fontFamily: "var(--font-sans)",
        color: "var(--ink-1)",
        boxSizing: "border-box",
      }}
    >
      {/* Masthead */}
      <header
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          paddingBottom: 28,
          borderBottom: "1px solid var(--line-2)",
          marginBottom: 56,
        }}
      >
        <div>
          <div className="eyebrow" style={{ marginBottom: 12 }}>
            Astra · Design System · Direction {isQuiet ? "A" : "B"}
          </div>
          <h1
            className="serif"
            style={{
              fontSize: 64,
              lineHeight: 1.05,
              margin: 0,
              letterSpacing: "-0.025em",
              color: "var(--ink-1)",
            }}
          >
            {isQuiet ? "Quiet Reader" : "Constellation"}
          </h1>
          <p
            className="serif"
            style={{
              fontSize: 19,
              lineHeight: 1.55,
              color: "var(--ink-2)",
              margin: "16px 0 0",
              maxWidth: 620,
              fontStyle: "italic",
            }}
          >
            {isQuiet
              ? "Warm paper, ink-on-page hierarchy, translation rendered as marginalia. Astra disappears into the act of reading."
              : "Twilight surfaces, soft star-gold accents. The product feels like a quiet observatory — present at night, never demanding."}
          </p>
        </div>
        <AstraWordmark size={32} />
      </header>

      {/* TYPE */}
      <Section eyebrow="01 — Typography" title="Reading-first hierarchy">
        <Card padded={false} style={{ padding: "8px 28px" }}>
          <TypeRow
            label="display / 56"
            sample={
              <span className="serif" style={{ fontSize: 56, lineHeight: 1.05, letterSpacing: "-0.025em" }}>
                Read the web in another tongue.
              </span>
            }
          />
          <TypeRow
            label="title / 32"
            sample={
              <span className="serif" style={{ fontSize: 32, lineHeight: 1.15, letterSpacing: "-0.02em" }}>
                Astra learns alongside you
              </span>
            }
          />
          <TypeRow
            label="heading / 20"
            sample={
              <span className="serif" style={{ fontSize: 20, lineHeight: 1.3 }}>
                每个生词都被悄悄记住
              </span>
            }
          />
          <TypeRow
            label="body / 16"
            sample={
              <span className="serif" style={{ fontSize: 16, lineHeight: 1.65 }}>
                Astra runs underneath the page you are already reading. Translations sit beside the
                source, never on top of it. 阅读体验完整保留——Astra 只是一层安静的注释。
              </span>
            }
          />
          <TypeRow
            label="ui / 14"
            sample={
              <span style={{ fontSize: 14, lineHeight: 1.5 }}>
                Auto-translate on this site · Bilingual · Underline source
              </span>
            }
          />
          <TypeRow
            label="caption / 12"
            sample={<span className="eyebrow">SAVED · 4 MIN AGO · ARTICLE.NYTIMES.COM</span>}
          />
          <TypeRow
            label="mono / 12"
            sample={<span className="mono">astra.config.v1 · provider=relay</span>}
          />
        </Card>
        <p style={{ marginTop: 18, color: "var(--ink-3)", fontSize: 13 }}>
          Source Serif 4 (display + body) · Inter Tight (UI) · JetBrains Mono (numbers, identifiers)
        </p>
      </Section>

      {/* COLOR */}
      <Section eyebrow="02 — Color" title={isQuiet ? "Paper, ink, a single accent" : "Twilight, starlight, ink"}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 20 }}>
          {palette.map((s) => (
            <Swatch key={s.n} name={s.n} value={s.v} />
          ))}
        </div>
        <div
          style={{
            marginTop: 28,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
          }}
        >
          <Card>
            <div className="eyebrow" style={{ marginBottom: 8 }}>USED FOR</div>
            <div className="serif" style={{ fontSize: 18, color: "var(--ink-1)", marginBottom: 12 }}>
              Accent <span style={{ color: "var(--accent)" }}>—</span>
            </div>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", color: "var(--ink-2)", fontSize: 14, lineHeight: 1.7 }}>
              <li>· Primary CTAs and the active site toggle</li>
              <li>· Selected sentence in Deep Read</li>
              <li>· Onboarding progress thread</li>
            </ul>
          </Card>
          <Card>
            <div className="eyebrow" style={{ marginBottom: 8 }}>USED FOR</div>
            <div className="serif" style={{ fontSize: 18, color: "var(--ink-1)", marginBottom: 12 }}>
              Highlight <span style={{ color: "var(--hl)" }}>—</span>
            </div>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", color: "var(--ink-2)", fontSize: 14, lineHeight: 1.7 }}>
              <li>· Translated word underline (in-page)</li>
              <li>· Saved-to-vocabulary mark</li>
              <li>· Streak / progress beats — never decorative</li>
            </ul>
          </Card>
        </div>
      </Section>

      {/* COMPONENTS */}
      <Section eyebrow="03 — Components" title="A small kit, used over and over">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          {/* Buttons */}
          <Card>
            <div className="eyebrow" style={{ marginBottom: 14 }}>BUTTONS</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
              <Btn variant="primary">Translate page</Btn>
              <Btn variant="accent" icon={<IconLanguages size={14} />}>Open Deep Read</Btn>
              <Btn variant="ghost">Pause on this site</Btn>
              <Btn variant="quiet" icon={<IconSettings size={14} />}>Settings</Btn>
            </div>
            <div style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Pill tone="default">Bilingual</Pill>
              <Pill tone="accent"><IconDot size={6} color="var(--accent)" />Auto-translate on</Pill>
              <Pill tone="ok"><IconCheck size={11} />Saved</Pill>
              <Pill tone="warn">Quota: 62%</Pill>
            </div>
          </Card>

          {/* Toggle row */}
          <Card>
            <div className="eyebrow" style={{ marginBottom: 14 }}>SETTING ROWS</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {[
                { l: "Auto-translate on this site", on: true },
                { l: "Bilingual mode", on: true },
                { l: "Hover to translate", on: false },
              ].map((r, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ fontSize: 14, color: "var(--ink-1)" }}>{r.l}</div>
                  <Toggle on={r.on} onClick={() => {}} />
                </div>
              ))}
            </div>
          </Card>

          {/* Bilingual */}
          <Card style={{ gridColumn: "span 2" }}>
            <div className="eyebrow" style={{ marginBottom: 14 }}>BILINGUAL TYPOGRAPHY — THE TRANSLATION SIGNATURE</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
              <BilingualLine
                source="In a moment of quiet attention, the page becomes legible — not because it has changed, but because you have."
                target="在某个安静凝视的瞬间，那一页变得可读——不是因为它变了，而是因为你变了。"
              />
              <div>
                <span
                  style={{
                    fontFamily: "var(--font-serif)",
                    fontSize: 17,
                    lineHeight: 1.65,
                    color: "var(--ink-1)",
                  }}
                >
                  In a moment of quiet{" "}
                  <span
                    style={{
                      borderBottom: "1.5px solid var(--hl)",
                      paddingBottom: 1,
                      cursor: "pointer",
                    }}
                  >
                    attention
                    <span
                      style={{
                        fontFamily: "var(--font-serif)",
                        fontStyle: "italic",
                        color: "var(--ink-3)",
                        marginLeft: 4,
                        fontSize: 14,
                      }}
                    >
                      （凝视）
                    </span>
                  </span>
                  , the page becomes{" "}
                  <span style={{ borderBottom: "1.5px solid var(--hl)", paddingBottom: 1 }}>
                    legible
                    <span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", color: "var(--ink-3)", marginLeft: 4, fontSize: 14 }}>
                      （可读）
                    </span>
                  </span>
                  .
                </span>
              </div>
            </div>
          </Card>

          {/* In-page hover card */}
          <Card>
            <div className="eyebrow" style={{ marginBottom: 14 }}>HOVER TRANSLATION CARD</div>
            <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 8px" }}>
              <HoverCard
                word="legible"
                pos="adj."
                pinyin="/ˈledʒəbl/"
                translation="可读的；清晰的；易于辨认的"
                examples={["His handwriting was barely legible. 他的字迹勉强可辨。"]}
              />
            </div>
          </Card>

          {/* Selection toolbar */}
          <Card>
            <div className="eyebrow" style={{ marginBottom: 14 }}>SELECTION TOOLBAR</div>
            <div style={{ padding: "20px 0", display: "flex", flexDirection: "column", gap: 16, alignItems: "center" }}>
              <SelectionToolbar />
              <p
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: 14,
                  lineHeight: 1.55,
                  color: "var(--ink-3)",
                  margin: 0,
                  textAlign: "center",
                  maxWidth: 320,
                  fontStyle: "italic",
                }}
              >
                Appears anchored to the user's selection. Disappears the instant they continue reading.
              </p>
            </div>
          </Card>
        </div>
      </Section>

      {/* PRINCIPLES */}
      <Section eyebrow="04 — Principles" title="What the design protects">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
          {[
            {
              t: "Respect the host page",
              b: "We add a layer; we never repaint someone else's room. Translation lives beside the source line, not on top of it.",
            },
            {
              t: "Text is the interface",
              b: "Astra is a reading product. Iconography stays minimal, line-only. The serif body is the actual hero.",
            },
            {
              t: "Accumulate quietly",
              b: "Saving a word, finishing a page, a tiny streak — these accumulate without ever flashing or interrupting.",
            },
          ].map((p, i) => (
            <Card key={i}>
              <div className="eyebrow" style={{ marginBottom: 8 }}>0{i + 1}</div>
              <div className="serif" style={{ fontSize: 22, lineHeight: 1.25, marginBottom: 10 }}>
                {p.t}
              </div>
              <div style={{ color: "var(--ink-2)", fontSize: 14, lineHeight: 1.6 }}>{p.b}</div>
            </Card>
          ))}
        </div>
      </Section>

      <footer
        style={{
          marginTop: 24,
          paddingTop: 24,
          borderTop: "1px solid var(--line-1)",
          display: "flex",
          justifyContent: "space-between",
          color: "var(--ink-3)",
          fontSize: 12,
        }}
      >
        <span className="mono">astra-{direction}-v1</span>
        <span>Direction {isQuiet ? "A · Quiet Reader" : "B · Constellation"}</span>
      </footer>
    </div>
  );
};

Object.assign(window, { DesignSystemFrame });

})();