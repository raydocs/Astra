;(function(){
const {
  AstraMark,
  IconLanguages,
  IconBookmark,
  IconClose,
  IconSettings,
  IconHighlighter,
  IconChevronRight,
  IconArrowRight,
  IconBook,
  IconDot,
} = window;

/* ====================================================================
   FLOATING TAB — Astra's in-page handle (browser side-rail)
   The user's question: do we need a floating ball at all?
   We answer with three artboards, ordered from quietest → loudest:
     0) NO BALL (recommended) — keyboard + selection toolbar only
     1) EDGE TICK — a 2px vertical hairline at the page edge that
        becomes a tab on hover; collapses back when not in use
     2) READ-FROG STYLE — a persistent 32px circle with hover-revealed
        controls (the conventional pattern)
   Each is presented over a stylized fake article so the trade-off is
   visible.
   ==================================================================== */

/* Fake article surface — page underneath the tab */
const FakePage = ({ children, dark }) => (
  <div
    style={{
      width: "100%",
      height: "100%",
      position: "relative",
      background: dark ? "#1d1d1f" : "#ffffff",
      overflow: "hidden",
    }}
  >
    {/* Fake browser header bar */}
    <div
      style={{
        height: 44,
        borderBottom: dark ? "1px solid rgba(255,255,255,0.08)" : "1px solid #e5e5e7",
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "0 16px",
        background: dark ? "#161618" : "#f5f5f7",
      }}
    >
      <span style={{ width: 11, height: 11, borderRadius: 999, background: "#ff5f57" }} />
      <span style={{ width: 11, height: 11, borderRadius: 999, background: "#febc2e" }} />
      <span style={{ width: 11, height: 11, borderRadius: 999, background: "#28c840" }} />
      <div
        style={{
          marginLeft: 16,
          flex: 1,
          maxWidth: 360,
          height: 26,
          borderRadius: 6,
          background: dark ? "#2a2a2d" : "#fff",
          border: dark ? "1px solid rgba(255,255,255,0.08)" : "1px solid #d2d2d7",
          display: "flex",
          alignItems: "center",
          padding: "0 10px",
          fontSize: 11,
          color: dark ? "#a1a1a6" : "#86868b",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        newyorker.com/culture/cultural-comment/why-solitude-is-important
      </div>
    </div>

    {/* Fake article body */}
    <div
      style={{
        padding: "44px 80px 0",
        maxWidth: 720,
        margin: "0 auto",
        color: dark ? "#e8e8ed" : "#1d1d1f",
        fontFamily: 'Source Serif 4, Georgia, serif',
      }}
    >
      <div
        style={{
          fontSize: 11,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: dark ? "#86868b" : "#86868b",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          marginBottom: 16,
        }}
      >
        Cultural Comment
      </div>
      <h1 style={{ fontSize: 38, lineHeight: 1.1, letterSpacing: "-0.02em", margin: 0, fontWeight: 400 }}>
        Why Solitude Is Important for Reading
      </h1>
      <p style={{ fontSize: 14, color: dark ? "#a1a1a6" : "#6e6e73", marginTop: 14, fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
        By A. Brock · 12 min read
      </p>
      <p style={{ fontSize: 17, lineHeight: 1.7, marginTop: 28 }}>
        Reading well requires a kind of attention that the modern web has quietly eroded. To inhabit a difficult sentence, you have to be willing to sit with it — to let its rhythm and reservations work on you slowly.
      </p>
      <p style={{ fontSize: 17, lineHeight: 1.7, marginTop: 18 }}>
        The room must be quiet, the screen must be still, and — most importantly — the page must be allowed to look like itself. A reader cannot focus on prose that is constantly being repainted underneath them.
      </p>
    </div>
    {children}
  </div>
);

/* OPTION 0 — NO BALL.
   Show the selection toolbar that's already in the system, plus a
   tiny status corner that confirms Astra is connected. Argument:
   the popup + ⌥E shortcut + selection toolbar already cover the job. */
const OptionNone = ({ direction }) => (
  <FakePage dark={direction === "twilight"}>
    {/* selection demo — a fake selection highlight + the toolbar */}
    <div
      style={{
        position: "absolute",
        top: 320,
        left: "50%",
        transform: "translateX(-50%)",
        width: 320,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          background: direction === "twilight" ? "rgba(229,201,138,0.18)" : "rgba(31,78,122,0.13)",
          height: 22,
          width: 280,
          marginLeft: 6,
          borderRadius: 2,
        }}
      />
    </div>
    <div
      data-astra={direction}
      style={{
        position: "absolute",
        top: 282,
        left: "50%",
        transform: "translateX(-50%)",
        background: "var(--ink-1)",
        color: "var(--bg-page)",
        borderRadius: 10,
        boxShadow: "var(--shadow-md)",
        padding: 4,
        display: "inline-flex",
        gap: 2,
        fontFamily: "var(--font-sans)",
        fontSize: 12.5,
      }}
    >
      {[
        { l: "Translate", i: <IconLanguages size={13} /> },
        { l: "Explain", i: <IconBook size={13} /> },
        { l: "Save", i: <IconBookmark size={13} /> },
        { l: "Mark", i: <IconHighlighter size={13} /> },
      ].map((b, i) => (
        <span
          key={i}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "5px 9px",
            borderRadius: 6,
            background: i === 0 ? "rgba(255,255,255,0.10)" : "transparent",
          }}
        >
          {b.i}
          {b.l}
        </span>
      ))}
    </div>

    {/* corner status pill */}
    <div
      data-astra={direction}
      style={{
        position: "absolute",
        right: 18,
        bottom: 18,
        background: "var(--bg-elevated)",
        border: "1px solid var(--line-2)",
        borderRadius: 999,
        padding: "6px 12px 6px 8px",
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        fontFamily: "var(--font-sans)",
        fontSize: 12,
        color: "var(--ink-2)",
        boxShadow: "var(--shadow-md)",
      }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, color: "var(--ink-1)" }}>
        <AstraMark size={12} stroke={1.8} />
      </span>
      Astra <span style={{ color: "var(--ink-3)" }}>·</span> <kbd style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, padding: "1px 5px", background: "var(--bg-sunken)", border: "1px solid var(--line-1)", borderRadius: 4, color: "var(--ink-2)" }}>⌥E</kbd> <span style={{ color: "var(--ink-3)", fontStyle: "italic", fontFamily: "var(--font-serif)" }}>to translate</span>
    </div>
  </FakePage>
);

/* OPTION 1 — EDGE TICK
   A 2px vertical hairline pinned to the right edge. On hover the
   page nudges left by 36px and a slim tab slides out with two
   actions (translate, settings). Off-hover it disappears entirely.
   We render the hover state to make the design legible. */
const OptionTick = ({ direction }) => (
  <FakePage dark={direction === "twilight"}>
    {/* Idle state hairline (visible behind the open tab) */}
    <div
      data-astra={direction}
      style={{
        position: "absolute",
        right: 0,
        top: "24%",
        bottom: "24%",
        width: 3,
        background: "var(--ink-1)",
        opacity: 0.18,
        borderRadius: "2px 0 0 2px",
      }}
    />

    {/* Hover-expanded tab */}
    <div
      data-astra={direction}
      style={{
        position: "absolute",
        right: 0,
        top: "50%",
        transform: "translateY(-50%)",
        background: "var(--bg-elevated)",
        border: "1px solid var(--line-2)",
        borderRight: "none",
        borderRadius: "var(--r-lg) 0 0 var(--r-lg)",
        boxShadow: "var(--shadow-lg)",
        padding: "12px 14px 12px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        fontFamily: "var(--font-sans)",
        minWidth: 220,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, paddingBottom: 10, borderBottom: "1px solid var(--line-1)" }}>
        <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 20, height: 20, color: "var(--ink-1)" }}>
          <AstraMark size={14} stroke={1.7} />
        </span>
        <span
          className="serif"
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 14.5,
            color: "var(--ink-1)",
            letterSpacing: "-0.01em",
            flex: 1,
          }}
        >
          Astra
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--ink-3)", fontStyle: "italic", fontFamily: "var(--font-serif)" }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--ok)" }} />
          on
        </span>
      </div>

      {[
        { l: "Translate page", k: "⌥E", i: <IconLanguages size={12} stroke={2} />, primary: true },
        { l: "Save article", k: "⌥S", i: <IconBookmark size={12} stroke={2} /> },
        { l: "Settings", i: <IconSettings size={12} stroke={2} /> },
      ].map((a, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "7px 8px",
            borderRadius: "var(--r-md)",
            background: a.primary ? "var(--bg-sunken)" : "transparent",
            color: "var(--ink-1)",
            fontSize: 13,
            fontWeight: a.primary ? 500 : 400,
          }}
        >
          <span style={{ color: "var(--ink-2)" }}>{a.i}</span>
          <span style={{ flex: 1 }}>{a.l}</span>
          {a.k ? (
            <kbd style={{ fontFamily: "var(--font-mono)", fontSize: 10, padding: "1px 5px", background: "var(--bg-elevated)", border: "1px solid var(--line-1)", borderRadius: 4, color: "var(--ink-3)" }}>{a.k}</kbd>
          ) : null}
        </div>
      ))}
    </div>

    {/* Caption pinned to bottom-left explaining behavior */}
    <div
      style={{
        position: "absolute",
        left: 24,
        bottom: 22,
        maxWidth: 320,
        fontFamily: 'Source Serif 4, Georgia, serif',
        fontStyle: "italic",
        fontSize: 12,
        color: direction === "twilight" ? "rgba(255,255,255,0.42)" : "rgba(0,0,0,0.42)",
        lineHeight: 1.5,
        pointerEvents: "none",
      }}
    >
      Idle: a 2px hairline at the edge — barely there.<br />
      Hover (shown): tab slides out with three actions, then retreats.
    </div>
  </FakePage>
);

/* OPTION 2 — Conventional ball (Read-Frog / Immersive Translate style)
   Persistent 32px circle. We stay restrained: monogram, not a mascot;
   the secondary actions reveal on hover. */
const OptionBall = ({ direction }) => (
  <FakePage dark={direction === "twilight"}>
    {/* the ball + its hover reveal */}
    <div
      data-astra={direction}
      style={{
        position: "absolute",
        right: 16,
        top: "50%",
        transform: "translateY(-50%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
      }}
    >
      {[
        { l: "Translate page", i: <IconLanguages size={14} stroke={2} /> },
        { l: "Save", i: <IconBookmark size={14} stroke={2} /> },
      ].map((a, i) => (
        <div
          key={i}
          style={{
            position: "relative",
            width: 36,
            height: 36,
            borderRadius: 999,
            background: "var(--bg-elevated)",
            border: "1px solid var(--line-1)",
            color: "var(--ink-2)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          {a.i}
          <span
            style={{
              position: "absolute",
              right: 44,
              top: "50%",
              transform: "translateY(-50%)",
              background: "var(--ink-1)",
              color: "var(--bg-page)",
              padding: "4px 8px",
              borderRadius: 6,
              fontSize: 11,
              whiteSpace: "nowrap",
              fontFamily: "var(--font-sans)",
              opacity: i === 0 ? 1 : 0,
            }}
          >
            {a.l}
          </span>
        </div>
      ))}

      {/* main ball — paper chip with ink monogram */}
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 999,
          background: "var(--bg-elevated)",
          color: "var(--ink-1)",
          border: "1px solid var(--line-2)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "var(--shadow-md)",
          position: "relative",
        }}
      >
        <AstraMark size={20} stroke={1.7} />
        {/* tiny status dot — replaces the close X cross */}
        <span
          style={{
            position: "absolute",
            bottom: 2,
            right: 2,
            width: 8,
            height: 8,
            borderRadius: 999,
            background: "var(--ok)",
            border: "1.5px solid var(--bg-elevated)",
          }}
        />
      </div>

      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 999,
          background: "var(--bg-elevated)",
          border: "1px solid var(--line-1)",
          color: "var(--ink-2)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <IconSettings size={14} stroke={2} />
      </div>
    </div>

    <div
      style={{
        position: "absolute",
        left: 24,
        bottom: 22,
        maxWidth: 360,
        fontFamily: 'Source Serif 4, Georgia, serif',
        fontStyle: "italic",
        fontSize: 12,
        color: direction === "twilight" ? "rgba(255,255,255,0.42)" : "rgba(0,0,0,0.42)",
        lineHeight: 1.5,
        pointerEvents: "none",
      }}
    >
      Always visible. A 44px monogrammed circle plus two secondary
      actions on hover. Most familiar; also the loudest.
    </div>
  </FakePage>
);

const FloatingTabFrame = ({ direction = "quiet", variant = "tick" }) => {
  if (variant === "none") return <OptionNone direction={direction} />;
  if (variant === "ball") return <OptionBall direction={direction} />;
  return <OptionTick direction={direction} />;
};

Object.assign(window, { FloatingTabFrame });

})();
