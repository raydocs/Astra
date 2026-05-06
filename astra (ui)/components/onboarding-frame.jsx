;(function(){
const {
  AstraMark,
  AstraWordmark,
  IconLanguages,
  IconBook,
  IconBookmark,
  IconArrowRight,
  IconCheck,
  IconGlobe,
  IconChevronDown,
  IconDot,
} = window;

/* ====================================================================
   ONBOARDING — full-page (1280 × 800)
   A single-screen onboarding: serif headline, three quiet steps,
   and a live preview of what Astra will do to a real article.
   ==================================================================== */

const StepDot = ({ n, label, active, done }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
    <div
      style={{
        width: 22,
        height: 22,
        borderRadius: "50%",
        border: `1.5px solid ${active || done ? "var(--ink-1)" : "var(--line-2)"}`,
        background: done ? "var(--ink-1)" : "transparent",
        color: done ? "var(--bg-page)" : active ? "var(--ink-1)" : "var(--ink-3)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-serif)",
        fontSize: 12,
        fontWeight: 500,
      }}
    >
      {done ? <IconCheck size={12} stroke={2} /> : n}
    </div>
    <span
      style={{
        fontSize: 13,
        color: active ? "var(--ink-1)" : "var(--ink-3)",
        fontWeight: active ? 500 : 400,
      }}
    >
      {label}
    </span>
  </div>
);

const Stepper = () => (
  <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
    <StepDot n="1" label="Connect" done />
    <span style={{ width: 24, height: 1, background: "var(--line-2)" }} />
    <StepDot n="2" label="Style" active />
    <span style={{ width: 24, height: 1, background: "var(--line-1)" }} />
    <StepDot n="3" label="First read" />
  </div>
);

const StyleOption = ({ name, sample, selected }) => (
  <button
    style={{
      textAlign: "left",
      padding: "16px 18px",
      background: selected ? "var(--bg-elevated)" : "var(--bg-surface)",
      border: `1px solid ${selected ? "var(--ink-1)" : "var(--line-1)"}`,
      borderRadius: 10,
      cursor: "pointer",
      fontFamily: "var(--font-sans)",
      boxShadow: selected ? "var(--shadow-md)" : "none",
      transition: "all 120ms ease",
      display: "flex",
      flexDirection: "column",
      gap: 12,
    }}
  >
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <span style={{ fontSize: 14, fontWeight: 500, color: "var(--ink-1)" }}>{name}</span>
      {selected ? (
        <span
          style={{
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: "var(--ink-1)",
            color: "var(--bg-page)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <IconCheck size={11} stroke={2.5} />
        </span>
      ) : (
        <span
          style={{
            width: 18,
            height: 18,
            borderRadius: "50%",
            border: "1.5px solid var(--line-2)",
          }}
        />
      )}
    </div>
    <div
      style={{
        fontFamily: "var(--font-serif)",
        fontSize: 14,
        lineHeight: 1.55,
        color: "var(--ink-2)",
      }}
    >
      {sample}
    </div>
  </button>
);

const PreviewArticle = ({ style: styleMode = "underline" }) => {
  const renderEnglish = (text, marks = []) => {
    // marks: array of words to highlight in source
    let result = text;
    marks.forEach((w) => {
      const re = new RegExp(`(${w})`, "g");
      result = result.replace(re, `__MARK__$1__/MARK__`);
    });
    const parts = result.split(/(__MARK__.*?__\/MARK__)/g);
    return parts.map((p, i) => {
      const m = p.match(/^__MARK__(.*?)__\/MARK__$/);
      if (!m) return <span key={i}>{p}</span>;
      const w = m[1];
      const decoration =
        styleMode === "underline"
          ? { borderBottom: "1.5px solid var(--hl)", paddingBottom: 1 }
          : styleMode === "highlight"
          ? { background: "var(--hl-soft)", padding: "0 2px", borderRadius: 2 }
          : {};
      return (
        <span key={i} style={decoration}>
          {w}
        </span>
      );
    });
  };

  return (
    <div
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--line-1)",
        borderRadius: 12,
        padding: "28px 32px 30px",
        boxShadow: "var(--shadow-md)",
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div className="eyebrow" style={{ marginBottom: 8 }}>
        Preview · newyorker.com
      </div>
      <h3
        className="serif"
        style={{
          fontSize: 26,
          lineHeight: 1.2,
          margin: 0,
          letterSpacing: "-0.015em",
          color: "var(--ink-1)",
        }}
      >
        Why Solitude Is Important for Reading
      </h3>
      <div
        className="serif"
        style={{
          fontSize: 14,
          color: "var(--ink-3)",
          fontStyle: "italic",
          marginTop: 6,
          marginBottom: 18,
        }}
      >
        为什么独处对阅读如此重要
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14, flex: 1 }}>
        <p
          className="serif"
          style={{ margin: 0, fontSize: 15.5, lineHeight: 1.7, color: "var(--ink-1)" }}
        >
          {renderEnglish(
            "Reading well requires a kind of attention that the modern web has quietly eroded. To inhabit a difficult sentence, you have to be willing to sit with it.",
            ["attention", "eroded", "inhabit"]
          )}
        </p>
        <p
          className="serif"
          style={{
            margin: 0,
            fontSize: 14.5,
            lineHeight: 1.7,
            color: "var(--ink-2)",
            fontStyle: "italic",
          }}
        >
          阅读得当需要一种现代网络已悄然侵蚀的专注力。要真正进入一句难懂的话，你必须愿意在它面前停留。
        </p>

        <p
          className="serif"
          style={{ margin: 0, fontSize: 15.5, lineHeight: 1.7, color: "var(--ink-1)" }}
        >
          {renderEnglish(
            "Astra runs underneath the page, adding only what you ask for, never repainting what was already legible.",
            ["underneath", "legible"]
          )}
        </p>
        <p
          className="serif"
          style={{
            margin: 0,
            fontSize: 14.5,
            lineHeight: 1.7,
            color: "var(--ink-2)",
            fontStyle: "italic",
          }}
        >
          Astra 运行在页面之下，只补充你需要的部分，绝不重绘原本已可读的内容。
        </p>
      </div>

      <div
        style={{
          marginTop: 22,
          paddingTop: 14,
          borderTop: "1px dashed var(--line-1)",
          display: "flex",
          alignItems: "center",
          gap: 10,
          color: "var(--ink-3)",
          fontSize: 12,
        }}
      >
        <IconDot size={6} color="var(--accent)" />
        Marked words are saved to your library when you click them.
      </div>
    </div>
  );
};

const OnboardingFrame = ({ direction = "quiet" }) => (
  <div
    data-astra={direction}
    className="astra-frame"
    style={{
      width: 1280,
      height: 800,
      background: "var(--bg-page)",
      color: "var(--ink-1)",
      fontFamily: "var(--font-sans)",
      display: "grid",
      gridTemplateColumns: "minmax(0, 540px) 1fr",
      boxSizing: "border-box",
    }}
  >
    {/* LEFT — copy + steps */}
    <div
      style={{
        padding: "44px 56px 44px 64px",
        display: "flex",
        flexDirection: "column",
        gap: 28,
      }}
    >
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <AstraWordmark size={24} />
        <span style={{ fontSize: 12, color: "var(--ink-3)" }}>Step 2 of 3</span>
      </header>

      <Stepper />

      <div style={{ marginTop: 8 }}>
        <h1
          className="serif"
          style={{
            fontSize: 56,
            lineHeight: 1.05,
            margin: 0,
            letterSpacing: "-0.025em",
            color: "var(--ink-1)",
            textWrap: "balance",
          }}
        >
          How would you like the
          <br />
          translation to feel?
        </h1>
        <p
          className="serif"
          style={{
            fontSize: 18,
            lineHeight: 1.55,
            color: "var(--ink-2)",
            marginTop: 18,
            marginBottom: 0,
            maxWidth: 440,
            fontStyle: "italic",
          }}
        >
          Astra sits beside the source, not on top of it. You can change this anytime.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
        <StyleOption
          name="Bilingual — paragraphs alternate"
          sample="Reading well requires a kind of attention. ／ 阅读得当需要一种专注。"
          selected
        />
        <StyleOption
          name="Translated only — replace inline"
          sample="阅读得当需要一种现代网络已悄然侵蚀的专注力。"
        />
        <StyleOption
          name="Underline — keep source, mark new words"
          sample="Reading well requires a kind of attention（专注）the modern web has eroded（侵蚀）."
        />
      </div>

      <div style={{ flex: 1 }} />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button
          style={{
            padding: "10px 14px",
            background: "transparent",
            color: "var(--ink-3)",
            border: 0,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          Back
        </button>
        <button
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "12px 22px",
            background: "var(--ink-1)",
            color: "var(--bg-page)",
            border: 0,
            borderRadius: 8,
            fontSize: 15,
            fontWeight: 500,
            cursor: "pointer",
            letterSpacing: "-0.005em",
          }}
        >
          Continue
          <IconArrowRight size={14} stroke={2} />
        </button>
      </div>
    </div>

    {/* RIGHT — live preview pane (sunken) */}
    <div
      style={{
        background: "var(--bg-sunken)",
        padding: "44px 64px 44px 44px",
        borderLeft: "1px solid var(--line-1)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20,
        }}
      >
        <span className="eyebrow">Live preview</span>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "5px 10px",
            background: "var(--bg-surface)",
            border: "1px solid var(--line-1)",
            borderRadius: 999,
            fontSize: 11,
            color: "var(--ink-3)",
          }}
        >
          <IconGlobe size={11} />
          newyorker.com
          <IconChevronDown size={11} />
        </div>
      </div>
      <PreviewArticle styleMode="underline" />
    </div>
  </div>
);

Object.assign(window, { OnboardingFrame });

})();