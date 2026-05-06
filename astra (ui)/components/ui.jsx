;(function(){
// React + icons loaded globally via window from earlier <script> tags
const {
  AstraMark,
  AstraWordmark,
  IconStar,
  IconBook,
  IconLanguages,
  IconBookmark,
  IconHighlighter,
  IconClock,
  IconArrowRight,
  IconCheck,
  IconClose,
  IconSettings,
  IconGlobe,
  IconSearch,
  IconChevronDown,
  IconDot,
} = window;

/* ====================================================================
   Reusable atomic components — both themes via data-astra
   ==================================================================== */

const Card = ({ children, style, padded = true, elevated = false, ...rest }) => (
  <div
    style={{
      background: elevated ? "var(--bg-elevated)" : "var(--bg-surface)",
      border: "1px solid var(--line-1)",
      borderRadius: "var(--r-lg)",
      padding: padded ? "var(--s-5)" : 0,
      boxShadow: elevated ? "var(--shadow-md)" : "var(--shadow-sm)",
      ...style,
    }}
    {...rest}
  >
    {children}
  </div>
);

const Btn = ({ variant = "primary", size = "md", children, icon, iconRight, style, ...rest }) => {
  const sizes = {
    sm: { padding: "6px 10px", fontSize: 13, gap: 6 },
    md: { padding: "9px 14px", fontSize: 14, gap: 8 },
    lg: { padding: "12px 18px", fontSize: 15, gap: 10 },
  };
  const variants = {
    primary: {
      background: "var(--ink-1)",
      color: "var(--bg-page)",
      border: "1px solid var(--ink-1)",
    },
    accent: {
      background: "var(--accent)",
      color: "var(--bg-surface)",
      border: "1px solid var(--accent)",
    },
    ghost: {
      background: "transparent",
      color: "var(--ink-1)",
      border: "1px solid var(--line-2)",
    },
    quiet: {
      background: "transparent",
      color: "var(--ink-2)",
      border: "1px solid transparent",
    },
  };
  return (
    <button
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        ...sizes[size],
        ...variants[variant],
        borderRadius: "var(--r-md)",
        fontFamily: "var(--font-sans)",
        fontWeight: 500,
        letterSpacing: "-0.005em",
        cursor: "pointer",
        transition: "all 120ms ease",
        ...style,
      }}
      {...rest}
    >
      {icon}
      {children}
      {iconRight}
    </button>
  );
};

const Pill = ({ children, tone = "default", style }) => {
  const tones = {
    default: { background: "var(--bg-sunken)", color: "var(--ink-2)", border: "var(--line-1)" },
    accent: { background: "var(--accent-soft)", color: "var(--accent)", border: "var(--accent-line)" },
    ok: { background: "color-mix(in srgb, var(--ok) 12%, transparent)", color: "var(--ok)", border: "color-mix(in srgb, var(--ok) 28%, transparent)" },
    warn: { background: "color-mix(in srgb, var(--warn) 12%, transparent)", color: "var(--warn)", border: "color-mix(in srgb, var(--warn) 28%, transparent)" },
  };
  const t = tones[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 9px",
        fontSize: 12,
        fontFamily: "var(--font-sans)",
        fontWeight: 500,
        background: t.background,
        color: t.color,
        border: `1px solid ${t.border}`,
        borderRadius: "var(--r-pill)",
        letterSpacing: "-0.005em",
        ...style,
      }}
    >
      {children}
    </span>
  );
};

const Toggle = ({ on = false, onClick }) => (
  <button
    onClick={onClick}
    aria-pressed={on}
    style={{
      width: 36,
      height: 20,
      padding: 2,
      borderRadius: 999,
      background: on ? "var(--ink-1)" : "var(--bg-sunken)",
      border: "1px solid var(--line-2)",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: on ? "flex-end" : "flex-start",
      cursor: "pointer",
      transition: "all 160ms ease",
    }}
  >
    <span
      style={{
        width: 14,
        height: 14,
        borderRadius: "50%",
        background: on ? "var(--bg-page)" : "var(--ink-3)",
        transition: "all 160ms ease",
      }}
    />
  </button>
);

const Divider = ({ vertical = false, label, style }) => {
  if (label) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          color: "var(--ink-3)",
          ...style,
        }}
      >
        <span style={{ flex: 1, height: 1, background: "var(--line-1)" }} />
        <span className="eyebrow">{label}</span>
        <span style={{ flex: 1, height: 1, background: "var(--line-1)" }} />
      </div>
    );
  }
  return (
    <div
      style={{
        background: "var(--line-1)",
        ...(vertical ? { width: 1, alignSelf: "stretch" } : { height: 1, width: "100%" }),
        ...style,
      }}
    />
  );
};

/* ====================================================================
   Translation atoms — the visual signature of Astra in the page
   ==================================================================== */

/* Bilingual line, classic style: source above, translation below in muted serif */
const BilingualLine = ({ source, target, style }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 4, ...style }}>
    <span
      style={{
        fontFamily: "var(--font-serif)",
        fontSize: 17,
        lineHeight: 1.5,
        color: "var(--ink-1)",
      }}
    >
      {source}
    </span>
    <span
      style={{
        fontFamily: "var(--font-serif)",
        fontSize: 16,
        lineHeight: 1.55,
        color: "var(--ink-2)",
        fontStyle: "italic",
      }}
    >
      {target}
    </span>
  </div>
);

/* Hover card — what appears in-page on hover translation */
const HoverCard = ({ word, pos, pinyin, translation, examples = [] }) => (
  <div
    style={{
      width: 320,
      background: "var(--bg-elevated)",
      border: "1px solid var(--line-1)",
      borderRadius: "var(--r-lg)",
      boxShadow: "var(--shadow-lg)",
      overflow: "hidden",
      fontFamily: "var(--font-sans)",
    }}
  >
    <div style={{ padding: "14px 16px 12px", borderBottom: "1px solid var(--line-1)" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontFamily: "var(--font-serif)", fontSize: 22, color: "var(--ink-1)" }}>{word}</span>
        <span className="eyebrow">{pos}</span>
      </div>
      {pinyin ? (
        <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2, fontFamily: "var(--font-mono)" }}>{pinyin}</div>
      ) : null}
      <div style={{ fontFamily: "var(--font-serif)", fontSize: 16, color: "var(--ink-1)", marginTop: 8 }}>
        {translation}
      </div>
    </div>
    {examples.length > 0 ? (
      <div style={{ padding: "10px 16px 14px" }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>Example</div>
        {examples.map((ex, i) => (
          <div key={i} style={{ fontFamily: "var(--font-serif)", fontSize: 13, lineHeight: 1.5, color: "var(--ink-2)" }}>
            {ex}
          </div>
        ))}
      </div>
    ) : null}
    <div
      style={{
        display: "flex",
        gap: 8,
        padding: "10px 16px",
        borderTop: "1px solid var(--line-1)",
        background: "var(--bg-surface)",
      }}
    >
      <Btn size="sm" variant="ghost" icon={<IconBookmark size={13} />}>Save</Btn>
      <Btn size="sm" variant="quiet" icon={<IconHighlighter size={13} />}>Highlight</Btn>
      <span style={{ flex: 1 }} />
      <Btn size="sm" variant="quiet" iconRight={<IconArrowRight size={13} />}>Explain</Btn>
    </div>
  </div>
);

/* In-page selection toolbar */
const SelectionToolbar = () => (
  <div
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 2,
      padding: 4,
      background: "var(--ink-1)",
      color: "var(--bg-page)",
      borderRadius: "var(--r-md)",
      boxShadow: "var(--shadow-md)",
      fontFamily: "var(--font-sans)",
      fontSize: 13,
    }}
  >
    {[
      { label: "Translate", icon: <IconLanguages size={14} /> },
      { label: "Explain", icon: <IconSearch size={14} /> },
      { label: "Save", icon: <IconBookmark size={14} /> },
      { label: "Mark", icon: <IconHighlighter size={14} /> },
    ].map((b, i) => (
      <button
        key={i}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 10px",
          background: "transparent",
          color: "inherit",
          border: 0,
          borderRadius: 6,
          cursor: "pointer",
          fontFamily: "inherit",
          fontSize: "inherit",
        }}
      >
        {b.icon}
        {b.label}
      </button>
    ))}
  </div>
);

Object.assign(window, {
  Card,
  Btn,
  Pill,
  Toggle,
  Divider,
  BilingualLine,
  HoverCard,
  SelectionToolbar,
});

})();