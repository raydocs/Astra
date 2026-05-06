;(function(){
const {
  AstraMark,
  AstraWordmark,
  IconStar,
  IconBook,
  IconBookmark,
  IconHighlighter,
  IconLanguages,
  IconArrowRight,
  IconArrowUpRight,
  IconCheck,
  IconClose,
  IconSettings,
  IconList,
  IconClock,
  IconChevronDown,
  IconChevronRight,
  IconDot,
  IconSearch,
  IconPlay,
} = window;

/* ====================================================================
   DEEP READ — full-page reader (1280 × 900)
   Three-column: nav (collapsed) · article (centered serif) · margin
   The signature view: translation lives in the right margin as
   marginalia, not interleaved.
   ==================================================================== */

const TopChrome = () => (
  <div
    style={{
      height: 52,
      flexShrink: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 28px",
      borderBottom: "1px solid var(--line-1)",
      background: "var(--bg-surface)",
    }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <AstraMark size={18} stroke={1.4} />
      <span style={{ width: 1, height: 16, background: "var(--line-2)" }} />
      <button
        style={{
          padding: "5px 10px",
          fontSize: 12,
          background: "transparent",
          border: "1px solid var(--line-2)",
          borderRadius: 6,
          color: "var(--ink-2)",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
        }}
      >
        <IconList size={12} />
        Library
      </button>
      <span
        className="mono"
        style={{
          color: "var(--ink-3)",
          fontSize: 11,
        }}
      >
        newyorker.com / culture
      </span>
    </div>

    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--ink-3)", fontSize: 12 }}>
        <IconClock size={12} /> 12 min
      </div>
      <div
        style={{
          display: "inline-flex",
          padding: 2,
          background: "var(--bg-sunken)",
          border: "1px solid var(--line-1)",
          borderRadius: 7,
        }}
      >
        {["Bilingual", "Source", "Translated"].map((o, i) => (
          <button
            key={o}
            style={{
              padding: "4px 10px",
              fontSize: 12,
              background: i === 0 ? "var(--bg-elevated)" : "transparent",
              color: i === 0 ? "var(--ink-1)" : "var(--ink-3)",
              border: 0,
              borderRadius: 5,
              cursor: "pointer",
              fontWeight: i === 0 ? 500 : 400,
              boxShadow: i === 0 ? "var(--shadow-sm)" : "none",
              fontFamily: "var(--font-sans)",
            }}
          >
            {o}
          </button>
        ))}
      </div>
      <button
        style={{
          padding: "6px 12px",
          fontSize: 12,
          background: "var(--ink-1)",
          color: "var(--bg-page)",
          border: 0,
          borderRadius: 6,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          fontFamily: "var(--font-sans)",
          fontWeight: 500,
        }}
      >
        <IconBookmark size={12} />
        Save
      </button>
    </div>
  </div>
);

/* Astra-authored sticky note — appears in the margin alongside translations.
   Kinds: "summary" (so far), "key" (key idea), "context" (background you might
   be missing), "ask" (a quiet prompt). Yellow Post-it paper with a soft
   offset shadow + tiny tape strip — feels stuck on top of the page. */
const StickyNote = ({ kind = "summary", title, body, tilt = -0.6 }) => {
  const labels = {
    summary: "So far",
    key: "Key idea",
    context: "Context",
    ask: "Ask Astra",
  };
  return (
    <div
      style={{
        background: "var(--sticky-bg)",
        color: "var(--sticky-ink)",
        border: "1px solid var(--sticky-line)",
        borderRadius: 4,
        boxShadow:
          "1px 2px 0 0 var(--sticky-shadow-1), 6px 10px 18px -4px var(--sticky-shadow-2), 1px 1px 0 0 var(--sticky-shadow-3) inset",
        padding: "12px 14px 10px",
        transform: `rotate(${tilt}deg)`,
        position: "relative",
      }}
    >
      {/* tape strip — tiny translucent rectangle at the top center */}
      <span
        style={{
          position: "absolute",
          top: -6,
          left: "50%",
          transform: `translateX(-50%) rotate(${-tilt * 1.5}deg)`,
          width: 44,
          height: 12,
          background: "var(--sticky-tape)",
          borderRadius: 1,
          boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
        }}
      />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 10.5,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--sticky-muted)",
          fontWeight: 500,
          fontFamily: "var(--font-sans)",
          marginBottom: 6,
        }}
      >
        <AstraMark size={10} stroke={1.8} />
        <span>{labels[kind]}</span>
        <span style={{ flex: 1 }} />
        <span style={{ color: "var(--sticky-muted)", fontFamily: "var(--font-mono)", fontSize: 9, opacity: 0.7 }}>AI</span>
      </div>
      {title ? (
        <div
          className="serif"
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 14,
            fontWeight: 500,
            color: "var(--sticky-ink)",
            lineHeight: 1.35,
            marginBottom: 4,
            letterSpacing: "-0.005em",
          }}
        >
          {title}
        </div>
      ) : null}
      <div
        className="serif"
        style={{
          fontFamily: "var(--font-serif)",
          fontStyle: "italic",
          fontSize: 13,
          color: "var(--sticky-ink-2)",
          lineHeight: 1.55,
        }}
      >
        {body}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          marginTop: 10,
          paddingTop: 8,
          borderTop: "1px dashed var(--sticky-line)",
        }}
      >
        <button
          style={{
            padding: "3px 7px",
            background: "transparent",
            border: 0,
            color: "var(--sticky-muted)",
            fontSize: 11,
            cursor: "pointer",
            fontFamily: "var(--font-sans)",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <IconBookmark size={10} /> Keep
        </button>
        <button
          style={{
            padding: "3px 7px",
            background: "transparent",
            border: 0,
            color: "var(--sticky-muted)",
            fontSize: 11,
            cursor: "pointer",
            fontFamily: "var(--font-sans)",
          }}
        >
          Dismiss
        </button>
        <span style={{ flex: 1 }} />
        <span
          style={{
            fontFamily: "var(--font-serif)",
            fontStyle: "italic",
            fontSize: 11,
            color: "var(--sticky-muted)",
            opacity: 0.7,
          }}
        >
          ¶ 1–3
        </span>
      </div>
    </div>
  );
};

/* A paragraph with marginalia notes (translations) and optionally a sticky.
   notes: [{ zh, gloss }]
   sticky: { kind, title, body, tilt }  — Astra-authored helper note
*/
const Paragraph = ({ children, notes = [], sticky }) => (
  <div style={{ position: "relative", marginBottom: 28 }}>
    <p
      className="serif"
      style={{
        margin: 0,
        fontSize: 19,
        lineHeight: 1.75,
        color: "var(--ink-1)",
        letterSpacing: "-0.005em",
      }}
    >
      {children}
    </p>
    {notes.length > 0 || sticky ? (
      <div
        style={{
          position: "absolute",
          left: "calc(100% + 56px)",
          top: 4,
          width: 248,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {notes.map((n, i) => (
          <div
            key={i}
            style={{
              borderLeft: "2px solid var(--accent)",
              paddingLeft: 14,
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-serif)",
                fontStyle: "italic",
                fontSize: 14,
                color: "var(--ink-1)",
                lineHeight: 1.5,
              }}
            >
              {n.zh}
            </div>
            {n.gloss ? (
              <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 6, lineHeight: 1.5 }}>
                {n.gloss}
              </div>
            ) : null}
          </div>
        ))}
        {sticky ? <StickyNote {...sticky} /> : null}
      </div>
    ) : null}
  </div>
);

const Mark = ({ children, kind = "underline", saved }) => {
  const style =
    kind === "highlight"
      ? { background: "var(--hl-soft)", padding: "0 2px", borderRadius: 2 }
      : { borderBottom: `1.5px solid ${saved ? "var(--accent)" : "var(--hl)"}`, paddingBottom: 1 };
  return (
    <span style={{ ...style, cursor: "pointer" }}>
      {children}
      {saved ? (
        <span
          style={{
            display: "inline-block",
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: "var(--accent)",
            marginLeft: 3,
            verticalAlign: "super",
          }}
        />
      ) : null}
    </span>
  );
};

const VocabPanel = () => (
  <aside
    style={{
      width: 280,
      flexShrink: 0,
      background: "var(--bg-surface)",
      borderLeft: "1px solid var(--line-1)",
      padding: "26px 22px",
      display: "flex",
      flexDirection: "column",
      gap: 18,
      overflow: "auto",
    }}
  >
    <div>
      <div className="eyebrow" style={{ marginBottom: 6 }}>From this page</div>
      <div className="serif" style={{ fontSize: 22, lineHeight: 1.2, color: "var(--ink-1)" }}>
        4 new words
      </div>
      <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 4 }}>
        Saved automatically as you read
      </div>
    </div>

    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
      {[
        { w: "erode", p: "v.", t: "侵蚀；逐渐损害", s: "the modern web has quietly eroded…", saved: true },
        { w: "inhabit", p: "v.", t: "栖居；进入（某种状态）", s: "to inhabit a difficult sentence…" },
        { w: "marginalia", p: "n.", t: "页边批注", s: "translation as marginalia." },
        { w: "legible", p: "adj.", t: "可读的；清晰的", s: "what was already legible." },
      ].map((v) => (
        <div
          key={v.w}
          style={{
            padding: "12px 0",
            borderBottom: "1px solid var(--line-1)",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
            <span
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: 17,
                color: "var(--ink-1)",
              }}
            >
              {v.w}
            </span>
            <span style={{ fontSize: 11, color: "var(--ink-3)" }}>{v.p}</span>
          </div>
          <div style={{ fontFamily: "var(--font-serif)", fontSize: 14, color: "var(--ink-2)" }}>
            {v.t}
          </div>
          <div
            style={{
              fontFamily: "var(--font-serif)",
              fontStyle: "italic",
              fontSize: 12,
              color: "var(--ink-3)",
              lineHeight: 1.45,
              marginTop: 2,
            }}
          >
            “{v.s}”
          </div>
          {v.saved ? (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 11,
                color: "var(--accent)",
                marginTop: 4,
              }}
            >
              <IconCheck size={11} stroke={2} />
              Saved · review in 1 day
            </div>
          ) : null}
        </div>
      ))}
    </div>

    <div style={{ flex: 1 }} />

    <div
      style={{
        padding: "14px 16px",
        background: "var(--bg-sunken)",
        border: "1px solid var(--line-1)",
        borderRadius: 10,
      }}
    >
      <div className="eyebrow" style={{ marginBottom: 6 }}>When you finish</div>
      <div
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: 15,
          lineHeight: 1.45,
          color: "var(--ink-1)",
          marginBottom: 10,
        }}
      >
        Astra will quiz these four words tomorrow morning, gently.
      </div>
      <button
        style={{
          width: "100%",
          padding: "9px 12px",
          background: "var(--ink-1)",
          color: "var(--bg-page)",
          border: 0,
          borderRadius: 7,
          fontSize: 13,
          fontWeight: 500,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
        }}
      >
        Mark page complete
        <IconArrowRight size={12} stroke={2} />
      </button>
    </div>
  </aside>
);

const DeepReadFrame = ({ direction = "quiet" }) => (
  <div
    data-astra={direction}
    className="astra-frame"
    style={{
      width: 1280,
      height: 900,
      background: "var(--bg-page)",
      color: "var(--ink-1)",
      fontFamily: "var(--font-sans)",
      display: "flex",
      flexDirection: "column",
      boxSizing: "border-box",
    }}
  >
    <TopChrome />

    <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
      {/* main reading column */}
      <main
        style={{
          flex: 1,
          overflow: "auto",
          padding: "56px 80px 80px",
          background: "var(--bg-page)",
          position: "relative",
        }}
      >
        <div style={{ maxWidth: 620, margin: "0 auto", position: "relative" }}>
          {/* dateline */}
          <div className="eyebrow" style={{ marginBottom: 14 }}>
            CULTURE · APRIL 21, 2026 · BY MARGARET WEN
          </div>

          <h1
            className="serif"
            style={{
              fontSize: 44,
              lineHeight: 1.1,
              margin: 0,
              letterSpacing: "-0.025em",
              color: "var(--ink-1)",
              textWrap: "balance",
            }}
          >
            Why Solitude Is Important for Reading
          </h1>
          <div
            className="serif"
            style={{
              fontSize: 19,
              lineHeight: 1.4,
              fontStyle: "italic",
              color: "var(--ink-3)",
              marginTop: 10,
              marginBottom: 36,
            }}
          >
            为什么独处对阅读如此重要
          </div>

          <Paragraph
            notes={[
              {
                zh: "阅读得当需要一种现代网络已悄然侵蚀的专注力。",
                gloss: "erode (v.) — 侵蚀；逐渐损害",
              },
            ]}
          >
            Reading well requires a kind of <Mark saved>attention</Mark> that the modern web
            has quietly <Mark saved>eroded</Mark>. To inhabit a difficult sentence, you have
            to be willing to sit with it long enough to feel it close around you.
          </Paragraph>

          <Paragraph>
            The trouble is that almost nothing online is built for that posture. Pages flicker,
            beg, suggest. They want your gaze to keep moving — and your gaze, dutiful, obliges.
          </Paragraph>

          <Paragraph
            notes={[
              {
                zh: "Astra 运行在页面之下，只补充你需要的部分，绝不重绘原本已可读的内容。",
              },
            ]}
            sticky={{
              kind: "summary",
              title: "You’ve read the setup.",
              body: "作者认为现代网络让人难以专注阅读，设计不鼓励‌“静静坐下”这种姿态。下一节会提出他的解法：把补充内容放在页边，不重绘正文。",
              tilt: -0.6,
            }}
          >
            Astra sits <Mark>underneath</Mark> the page, adding only what you ask for, never
            repainting what was already <Mark>legible</Mark>. The translation arrives in the
            margin, the way a reader's penciled note used to.
          </Paragraph>

          <h2
            className="serif"
            style={{
              fontSize: 26,
              lineHeight: 1.2,
              letterSpacing: "-0.015em",
              margin: "12px 0 16px",
              color: "var(--ink-1)",
            }}
          >
            Translation as marginalia
          </h2>

          <Paragraph>
            For four hundred years, careful readers wrote in the margins of their books. The
            margin was where understanding was negotiated — half the writer's, half the
            reader's, in conversation.
          </Paragraph>

          <Paragraph>
            A book without margins is a book that does not expect to be answered. A page that
            translates itself in place is a page that does not expect to be read closely.
          </Paragraph>

          <Paragraph
            sticky={{
              kind: "context",
              title: "Why “marginalia”?",
              body: "边注（marginalia）是 16–18 世纪读者的习惯——在书页边缘写下质疑、共鸣、反驳。作者调用这个传统，是在说：理解从来不是被动接收。",
              tilt: 0.7,
            }}
          >
            Astra is built around that older posture. The page stays the page. Your understanding
            of it accumulates next to it, in your hand — not the writer's.
          </Paragraph>
        </div>

        {/* floating selection toolbar over the page (showcasing the in-page UI) */}
        <div
          style={{
            position: "absolute",
            top: 220,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 5,
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 2,
              padding: 4,
              background: "var(--ink-1)",
              color: "var(--bg-page)",
              borderRadius: 8,
              boxShadow: "var(--shadow-lg)",
              fontSize: 13,
              fontFamily: "var(--font-sans)",
            }}
          >
            {[
              { l: "Translate", i: <IconLanguages size={13} /> },
              { l: "Explain", i: <IconSearch size={13} /> },
              { l: "Save word", i: <IconBookmark size={13} /> },
              { l: "Mark", i: <IconHighlighter size={13} /> },
            ].map((b, i) => (
              <button
                key={i}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "5px 9px",
                  background: i === 0 ? "rgba(255,255,255,0.08)" : "transparent",
                  color: "inherit",
                  border: 0,
                  borderRadius: 5,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: "inherit",
                }}
              >
                {b.i}
                {b.l}
              </button>
            ))}
          </div>
        </div>
      </main>

      <VocabPanel />
    </div>
  </div>
);

Object.assign(window, { DeepReadFrame });

})();