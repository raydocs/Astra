;(function(){
const {
  AstraMark,
  AstraWordmark,
  IconLanguages,
  IconBook,
  IconBookmark,
  IconArrowRight,
  IconCheck,
  IconClose,
  IconSettings,
  IconGlobe,
  IconList,
  IconChevronRight,
  IconChevronDown,
  IconClock,
  IconHighlighter,
  IconDot,
  // shared primitives — same vocabulary as Onboarding & Deep Read
  Card,
  Btn,
  Pill,
  Toggle,
  Divider,
} = window;

/* ====================================================================
   POPUP — 380 × 620
   Built from the same primitives Onboarding and Deep Read use.
   No new button styles, no new card styles, no new toggle.
   What's "popup-specific" is layout density only.
   ==================================================================== */

/* Eyebrow caption — same class used everywhere else */
const Eyebrow = ({ children, style }) => (
  <span className="eyebrow" style={style}>{children}</span>
);

/* SettingRow — uses the same Card surface + Toggle as the rest of the system */
const SettingRow = ({ icon, title, subtitle, accessory, last }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "12px 14px",
      borderBottom: last ? "none" : "1px solid var(--line-1)",
      minHeight: 48,
      boxSizing: "border-box",
    }}
  >
    {icon ? (
      <span
        style={{
          width: 28, height: 28, borderRadius: "var(--r-md)",
          background: "var(--bg-sunken)",
          border: "1px solid var(--line-1)",
          color: "var(--ink-2)",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {icon}
      </span>
    ) : null}
    <div style={{ flex: 1, minWidth: 0 }}>
      <div
        style={{
          fontSize: 14,
          color: "var(--ink-1)",
          letterSpacing: "-0.005em",
          fontFamily: "var(--font-sans)",
          fontWeight: 500,
        }}
      >
        {title}
      </div>
      {subtitle ? (
        <div
          style={{
            fontSize: 12,
            color: "var(--ink-3)",
            marginTop: 1,
            fontFamily: "var(--font-sans)",
          }}
        >
          {subtitle}
        </div>
      ) : null}
    </div>
    {accessory}
  </div>
);

/* Segmented — built from <Pill>'s tone vocabulary so it matches */
const Segmented = ({ options, active }) => (
  <div
    style={{
      display: "inline-flex",
      padding: 2,
      background: "var(--bg-sunken)",
      borderRadius: "var(--r-md)",
      border: "1px solid var(--line-1)",
    }}
  >
    {options.map((o) => {
      const sel = o === active;
      return (
        <span
          key={o}
          style={{
            padding: "4px 10px",
            fontSize: 12,
            fontFamily: "var(--font-sans)",
            color: sel ? "var(--ink-1)" : "var(--ink-3)",
            fontWeight: sel ? 500 : 400,
            background: sel ? "var(--bg-elevated)" : "transparent",
            borderRadius: 5,
            letterSpacing: "-0.005em",
            border: sel ? "1px solid var(--line-1)" : "1px solid transparent",
          }}
        >
          {o}
        </span>
      );
    })}
  </div>
);

const Header = () => (
  <div
    style={{
      padding: "14px 18px",
      display: "flex",
      alignItems: "center",
      gap: 10,
      borderBottom: "1px solid var(--line-1)",
      background: "var(--bg-surface)",
    }}
  >
    <AstraWordmark size={18} />
    <span style={{ flex: 1 }} />
    <Btn variant="quiet" size="sm" style={{ padding: 6 }}><IconList size={14} /></Btn>
    <Btn variant="quiet" size="sm" style={{ padding: 6 }}><IconSettings size={14} /></Btn>
  </div>
);

const Hero = () => (
  <div style={{ padding: "20px 20px 4px" }}>
    <Eyebrow style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <IconGlobe size={10} />
      newyorker.com · 12 min read
    </Eyebrow>
    <h2
      className="serif"
      style={{
        fontSize: 26,
        lineHeight: 1.15,
        margin: "10px 0 0",
        letterSpacing: "-0.02em",
        color: "var(--ink-1)",
        textWrap: "balance",
        fontWeight: 400,
      }}
    >
      Why Solitude Is Important for Reading
    </h2>
    <div
      className="serif"
      style={{
        fontSize: 14,
        fontStyle: "italic",
        color: "var(--ink-3)",
        marginTop: 6,
      }}
    >
      为什么独处对阅读如此重要
    </div>
  </div>
);

const Primary = () => (
  <div style={{ padding: "16px 20px 0" }}>
    {/* Reuses <Btn variant="primary"> — same one Onboarding's Continue uses */}
    <Btn
      variant="primary"
      size="lg"
      icon={<IconLanguages size={14} stroke={2} />}
      iconRight={<IconArrowRight size={14} stroke={2} />}
      style={{ width: "100%", justifyContent: "space-between", padding: "13px 18px" }}
    >
      <span style={{ flex: 1, textAlign: "left", marginLeft: 8 }}>Translate this page</span>
    </Btn>

    <div
      style={{
        marginTop: 8,
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 8,
      }}
    >
      <Btn variant="ghost" size="md" icon={<IconBook size={13} />} style={{ width: "100%" }}>
        Deep Read
      </Btn>
      <Btn variant="ghost" size="md" icon={<IconBookmark size={13} />} style={{ width: "100%" }}>
        Save article
      </Btn>
    </div>
  </div>
);

const SettingsCard = () => (
  <div style={{ padding: "20px 20px 0" }}>
    <Eyebrow style={{ display: "block", marginBottom: 8 }}>This Site</Eyebrow>
    <Card padded={false} style={{ overflow: "hidden" }}>
      <SettingRow
        icon={<IconGlobe size={13} />}
        title="Auto-translate"
        subtitle="newyorker.com"
        accessory={<Toggle on />}
      />
      <SettingRow
        icon={<IconLanguages size={13} />}
        title="Display"
        accessory={<Segmented options={["Bilingual", "Translated"]} active="Bilingual" />}
      />
      <SettingRow
        icon={<IconHighlighter size={13} />}
        title="Style"
        accessory={<Segmented options={["Plain", "Underline", "Highlight"]} active="Underline" />}
        last
      />
    </Card>
  </div>
);

const ReadingCard = () => (
  <div style={{ padding: "16px 20px 0" }}>
    <Eyebrow style={{ display: "block", marginBottom: 8 }}>Reading</Eyebrow>
    <Card padded={false} style={{ overflow: "hidden" }}>
      <SettingRow
        icon={<IconBook size={13} />}
        title="Open in Deep Read"
        accessory={
          <span style={{ color: "var(--ink-3)", display: "inline-flex" }}>
            <IconChevronRight size={13} />
          </span>
        }
      />
      <SettingRow
        icon={<IconClock size={13} />}
        title="Hover to translate"
        accessory={<Toggle on={false} />}
        last
      />
    </Card>
  </div>
);

const Today = () => (
  <div style={{ padding: "16px 20px 20px" }}>
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        marginBottom: 10,
      }}
    >
      <span
        className="serif"
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: 18,
          fontWeight: 400,
          letterSpacing: "-0.02em",
          color: "var(--ink-1)",
        }}
      >
        Today
      </span>
      <a
        style={{
          fontSize: 12,
          color: "var(--ink-3)",
          textDecoration: "none",
          fontFamily: "var(--font-sans)",
          display: "inline-flex",
          alignItems: "center",
          gap: 2,
        }}
      >
        Library <IconArrowRight size={11} />
      </a>
    </div>

    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
      {[
        { v: "12", l: "saved", icon: <IconBookmark size={11} /> },
        { v: "9", l: "day streak", icon: <IconCheck size={11} /> },
      ].map((s) => (
        <Card key={s.l} padded={false} style={{ padding: "12px 14px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              color: "var(--ink-3)",
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.14em",
              fontWeight: 500,
              fontFamily: "var(--font-sans)",
            }}
          >
            {s.icon}
            {s.l}
          </div>
          <div
            className="serif"
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: 30,
              fontWeight: 400,
              letterSpacing: "-0.025em",
              color: "var(--ink-1)",
              lineHeight: 1.05,
              marginTop: 4,
            }}
          >
            {s.v}
          </div>
        </Card>
      ))}
    </div>

    {/* Review CTA — uses Card + accent Pill, no special component */}
    <Card
      padded={false}
      style={{
        padding: "12px 14px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        borderColor: "var(--accent-line)",
        background: "var(--accent-soft)",
        cursor: "pointer",
      }}
    >
      <span
        style={{
          width: 32, height: 32, borderRadius: "var(--r-md)",
          background: "var(--bg-elevated)",
          border: "1px solid var(--accent-line)",
          color: "var(--accent)",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <IconClock size={14} stroke={2} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          className="serif"
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 15,
            color: "var(--ink-1)",
            fontWeight: 400,
            letterSpacing: "-0.01em",
          }}
        >
          Review 4 words
        </div>
        <div
          style={{
            fontSize: 12,
            color: "var(--ink-3)",
            marginTop: 1,
            fontFamily: "var(--font-sans)",
            fontStyle: "italic",
          }}
        >
          About 2 minutes
        </div>
      </div>
      <Pill tone="accent">Start <IconArrowRight size={11} /></Pill>
    </Card>
  </div>
);

const PopupFrame = ({ direction = "quiet" }) => (
  <div
    data-astra={direction}
    className="astra-frame astra-root"
    style={{
      width: 380,
      height: 620,
      background: "var(--bg-page)",
      color: "var(--ink-1)",
      borderRadius: 16,
      overflow: "hidden",
      border: "1px solid var(--line-1)",
      boxShadow: "var(--shadow-lg)",
      display: "flex",
      flexDirection: "column",
      fontFamily: "var(--font-sans)",
      fontSize: 14,
      letterSpacing: "-0.005em",
    }}
  >
    <Header />
    <div style={{ flex: 1, overflow: "auto" }}>
      <Hero />
      <Primary />
      <SettingsCard />
      <ReadingCard />
      <Today />
    </div>
  </div>
);

Object.assign(window, { PopupFrame });

})();
