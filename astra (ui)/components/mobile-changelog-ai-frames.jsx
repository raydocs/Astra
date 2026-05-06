;(function(){
const {
  AstraMark, AstraWordmark,
  IconClose, IconCheck, IconArrowRight, IconChevronRight, IconClock,
  IconBook, IconBookmark, IconSparkle, IconLanguages,
  Card, Btn, Pill, Toggle, Divider,
} = window;

/* ====================================================================
   18. Mobile companion · 19. Changelog/What's new · 20. AI edge cases
   ==================================================================== */

const PhoneFrame = ({ children }) => (
  <div style={{
    width: 320, height: 640,
    background: "var(--bg-page)", border: "10px solid var(--ink-1)",
    borderRadius: 38, overflow: "hidden",
    boxShadow: "var(--shadow-lg)",
    display: "flex", flexDirection: "column",
    fontFamily: "var(--font-sans)",
  }}>
    {/* status bar */}
    <div style={{
      height: 28, padding: "0 22px", display: "flex", alignItems: "center",
      justifyContent: "space-between", fontSize: 11, color: "var(--ink-1)",
      fontWeight: 600, fontFamily: "var(--font-mono)",
    }}>
      <span>9:41</span>
      <span style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <span style={{ width: 14, height: 8, border: "1px solid var(--ink-2)", borderRadius: 2 }} />
      </span>
    </div>
    <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>{children}</div>
  </div>
);

const MobileFrame = ({ direction = "quiet" }) => (
  <div data-astra={direction} className="astra-frame astra-root" style={{
    width: "100%", height: "100%", background: "var(--bg-page)",
    padding: 36, boxSizing: "border-box", overflow: "hidden",
    display: "flex", justifyContent: "center", alignItems: "center", gap: 32,
  }}>
    {/* Left phone — Today */}
    <PhoneFrame>
      <div style={{ padding: "16px 20px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <AstraMark size={16} style={{ color: "var(--accent)" }} />
          <span style={{ fontFamily: "var(--font-serif)", fontSize: 17, color: "var(--ink-1)" }}>Astra</span>
          <span style={{ flex: 1 }} />
          <span className="eyebrow">today</span>
        </div>
        <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 30, fontWeight: 400, letterSpacing: "-0.025em", lineHeight: 1.05, margin: "16px 0 4px" }}>
          Twelve words<br />to revisit.
        </h2>
        <p style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 13, color: "var(--ink-3)", margin: "6px 0 18px" }}>
          About four minutes
        </p>

        <button style={{
          width: "100%", padding: "14px 16px", display: "flex", alignItems: "center",
          background: "var(--ink-1)", color: "var(--bg-page)",
          border: 0, borderRadius: 10, fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 500, cursor: "pointer",
        }}>
          <span style={{ flex: 1, textAlign: "left" }}>Review now</span>
          <IconArrowRight size={14} stroke={2} />
        </button>

        <div className="eyebrow" style={{ marginTop: 22, marginBottom: 8 }}>Up next</div>
        <div style={{ display: "grid", gap: 6 }}>
          {[
            ["effervescent", "adj. · 活泼的"],
            ["taciturn", "adj. · 寡言的"],
            ["palimpsest", "n. · 重写本"],
          ].map(([w, g]) => (
            <div key={w} style={{
              padding: "10px 12px", background: "var(--bg-surface)",
              border: "1px solid var(--line-1)", borderRadius: 8,
              display: "flex", alignItems: "baseline", gap: 8,
            }}>
              <span style={{ fontFamily: "var(--font-serif)", fontSize: 16, color: "var(--ink-1)" }}>{w}</span>
              <span style={{ flex: 1 }} />
              <span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", color: "var(--ink-3)", fontSize: 12 }}>{g}</span>
            </div>
          ))}
        </div>
      </div>

      {/* tab bar */}
      <div style={{
        position: "absolute", left: 0, right: 0, bottom: 0,
        height: 54, background: "var(--bg-surface)",
        borderTop: "1px solid var(--line-1)",
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
      }}>
        {[
          { l: "Today", on: true, i: <IconClock size={14} /> },
          { l: "Library", on: false, i: <IconBook size={14} /> },
          { l: "Review", on: false, i: <IconSparkle size={14} /> },
          { l: "You", on: false, i: <span style={{ width: 14, height: 14, borderRadius: 7, border: "1.5px solid currentColor" }} /> },
        ].map(t => (
          <div key={t.l} style={{
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
            color: t.on ? "var(--ink-1)" : "var(--ink-3)",
          }}>
            {t.i}
            <span style={{ fontSize: 10, fontWeight: t.on ? 500 : 400 }}>{t.l}</span>
          </div>
        ))}
      </div>
    </PhoneFrame>

    {/* Right phone — Review card */}
    <PhoneFrame>
      <div style={{ padding: "12px 18px 0", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ display: "inline-flex", padding: 6, borderRadius: "50%", color: "var(--ink-2)" }}>
          <IconClose size={14} />
        </span>
        <div style={{ flex: 1, height: 4, background: "var(--bg-sunken)", borderRadius: 2, overflow: "hidden" }}>
          <span style={{ display: "block", height: "100%", width: "33%", background: "var(--accent)" }} />
        </div>
        <span className="mono" style={{ color: "var(--ink-3)" }}>4/12</span>
      </div>

      <div style={{ padding: "32px 22px 0" }}>
        <div className="eyebrow" style={{ marginBottom: 10 }}>Sentence</div>
        <p style={{ fontFamily: "var(--font-serif)", fontSize: 20, lineHeight: 1.5, color: "var(--ink-1)", margin: 0, fontWeight: 400 }}>
          She gave an{" "}
          <span style={{ borderBottom: "2px solid var(--accent)", paddingBottom: 1 }}>
            ______
          </span>
          {" "}welcome to the new arrivals.
        </p>
        <div style={{ marginTop: 14, fontFamily: "var(--font-serif)", fontStyle: "italic", color: "var(--ink-3)", fontSize: 14, lineHeight: 1.45 }}>
          她对新来的人发出了______欢迎。
        </div>

        <div style={{ marginTop: 22, padding: "14px 16px", background: "var(--bg-surface)", border: "1px solid var(--line-1)", borderRadius: 8, fontFamily: "var(--font-serif)", fontSize: 13, color: "var(--ink-2)", fontStyle: "italic" }}>
          adj. · /ˌɛf.ərˈvɛs.ənt/
        </div>
      </div>

      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "14px 18px 22px" }}>
        <button style={{
          width: "100%", padding: "16px", borderRadius: 10,
          background: "var(--accent)", color: "var(--bg-page)",
          border: 0, fontFamily: "var(--font-sans)", fontSize: 15, fontWeight: 500,
          letterSpacing: "-0.005em", cursor: "pointer",
        }}>
          Tap to reveal
        </button>
        <div style={{ marginTop: 8, textAlign: "center", fontSize: 11, color: "var(--ink-3)", fontStyle: "italic", fontFamily: "var(--font-serif)" }}>
          Swipe right if you knew it · left if not
        </div>
      </div>
    </PhoneFrame>

    {/* Side note */}
    <div style={{ maxWidth: 240 }}>
      <div className="eyebrow">Mobile companion</div>
      <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 26, fontWeight: 400, letterSpacing: "-0.02em", lineHeight: 1.15, margin: "8px 0 12px" }}>
        Read on desktop, review anywhere.
      </h2>
      <p style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", color: "var(--ink-2)", fontSize: 14, lineHeight: 1.55, margin: 0 }}>
        A small PWA — no account required. Sign in with the same email and your library, due queue, and history follow you to the train.
      </p>
      <p style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", color: "var(--ink-3)", fontSize: 13, lineHeight: 1.55, marginTop: 12 }}>
        Just two surfaces: Today (the queue) and Review (one card at a time). Saving new words happens on the desktop, in the act of reading.
      </p>
    </div>
  </div>
);

/* =============== CHANGELOG ================ */

const ChangeRow = ({ kind, title, body, kindColor }) => (
  <div style={{
    display: "grid", gridTemplateColumns: "100px 1fr", gap: 24,
    padding: "18px 0", borderBottom: "1px solid var(--line-1)",
  }}>
    <div>
      <span style={{
        display: "inline-flex", alignItems: "center", padding: "2px 8px",
        background: "var(--bg-surface)", border: `1px solid ${kindColor}`,
        color: kindColor,
        borderRadius: 999, fontSize: 11, fontFamily: "var(--font-sans)",
        fontWeight: 500, letterSpacing: "0.02em",
      }}>{kind}</span>
    </div>
    <div>
      <div style={{ fontFamily: "var(--font-serif)", fontSize: 18, color: "var(--ink-1)", fontWeight: 400, lineHeight: 1.3 }}>
        {title}
      </div>
      <p style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", color: "var(--ink-2)", fontSize: 14, lineHeight: 1.55, margin: "6px 0 0", fontWeight: 400 }}>
        {body}
      </p>
    </div>
  </div>
);

const ChangelogFrame = ({ direction = "quiet" }) => (
  <div data-astra={direction} className="astra-frame astra-root" style={{
    width: "100%", height: "100%", background: "var(--bg-page)",
    padding: "40px 60px", boxSizing: "border-box", overflow: "hidden",
  }}>
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      <div className="eyebrow">Astra · v1.4 · May 2026</div>
      <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 44, fontWeight: 400, letterSpacing: "-0.025em", lineHeight: 1.05, margin: "10px 0 4px" }}>
        Quieter than ever.
      </h1>
      <p style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 17, color: "var(--ink-3)", margin: "6px 0 28px", maxWidth: 560 }}>
        A small release. Three things you'll notice, four you won't.
      </p>

      <ChangeRow kind="NEW" kindColor="var(--accent)" title="Marginalia, on more sites"
        body="Deep Read now lifts articles from Substack, the LRB, and Aeon — bringing the count to 84 long-form publications served as marginalia by default." />
      <ChangeRow kind="NEW" kindColor="var(--accent)" title="Voice recording in word detail"
        body="Hold ⌥ to record yourself; Astra compares the curve to the reference pronunciation. Audio stays on your device." />
      <ChangeRow kind="BETTER" kindColor="var(--ok)" title="Translation latency cut by 40%"
        body="A new streaming pipeline. Long pages start showing translation under three seconds instead of seven." />
      <ChangeRow kind="FIXED" kindColor="var(--ink-2)" title="Selection toolbar no longer flickers on Notion"
        body="Fixed an interaction with Notion's caret tracking. Sorry it took us so long." />
      <ChangeRow kind="FIXED" kindColor="var(--ink-2)" title="Library search returns sentence matches"
        body="Searching for a word now also searches the sentence bank, ranked separately." />
      <ChangeRow kind="QUIET" kindColor="var(--hl)" title="Removed the streak flame"
        body="A small one. The streak count now lives in serif numerals, in line with the rest of the product. We never wanted Astra to feel like Duolingo." />

      <div style={{
        marginTop: 32, padding: 20, borderRadius: 10,
        background: "var(--bg-surface)", border: "1px solid var(--line-1)",
        display: "flex", gap: 16, alignItems: "flex-start",
      }}>
        <AstraMark size={22} style={{ color: "var(--accent)", marginTop: 2 }} />
        <div>
          <div style={{ fontFamily: "var(--font-serif)", fontSize: 17, color: "var(--ink-1)" }}>
            One letter, this month.
          </div>
          <p style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", color: "var(--ink-2)", fontSize: 14, lineHeight: 1.55, margin: "6px 0 12px" }}>
            We're writing one short note per release explaining why we made the call. <a style={{ color: "var(--accent)", textDecoration: "underline", textDecorationStyle: "dotted", textUnderlineOffset: 3 }}>Read May's letter →</a>
          </p>
        </div>
      </div>

      <div style={{ marginTop: 28, display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
        <Btn variant="primary" size="md">Continue reading</Btn>
        <span style={{ fontSize: 12, color: "var(--ink-3)", fontStyle: "italic", fontFamily: "var(--font-serif)" }}>
          Don't show again — I'll find this in Settings → About
        </span>
      </div>
    </div>
  </div>
);

/* =============== AI EDGE CASES ================ */

const AIEdgeFrame = ({ direction = "quiet" }) => (
  <div data-astra={direction} className="astra-frame astra-root" style={{
    width: "100%", height: "100%", background: "var(--bg-page)",
    padding: "32px 36px", boxSizing: "border-box", overflow: "hidden",
    display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20,
  }}>
    {/* (a) Polysemy disambiguation */}
    <div>
      <div className="eyebrow">A · Polysemy — let me pick the sense</div>
      <p style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", color: "var(--ink-3)", fontSize: 13, marginTop: 4, marginBottom: 14 }}>
        On hover, Astra shows the contextual gloss; below, the alternatives.
      </p>
      <div style={{
        background: "var(--bg-elevated)", border: "1px solid var(--line-1)",
        borderRadius: 12, boxShadow: "var(--shadow-md)", overflow: "hidden",
        width: 360,
      }}>
        <div style={{ padding: "14px 16px 12px", borderBottom: "1px solid var(--line-1)" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontFamily: "var(--font-serif)", fontSize: 22, color: "var(--ink-1)" }}>bank</span>
            <span className="eyebrow">noun</span>
            <span style={{ flex: 1 }} />
            <Pill tone="accent">contextual</Pill>
          </div>
          <div style={{ marginTop: 8, padding: "10px 12px", background: "var(--accent-soft)", borderRadius: 6, border: "1px solid var(--accent-line)" }}>
            <div style={{ fontFamily: "var(--font-serif)", fontSize: 15, color: "var(--ink-1)" }}>河岸；堤岸</div>
            <div style={{ fontSize: 11, fontStyle: "italic", color: "var(--ink-3)", marginTop: 2, fontFamily: "var(--font-serif)" }}>
              "…walked along the bank of the Seine…"
            </div>
          </div>
        </div>
        <div style={{ padding: "10px 16px 14px" }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Other senses</div>
          {[
            ["金融机构 · the bank lent them…", "financial"],
            ["一排；一组 · a bank of monitors", "row"],
            ["靠；倾斜 · the plane banked left", "verb"],
          ].map(([s, t]) => (
            <div key={s} style={{ display: "flex", alignItems: "baseline", padding: "6px 0", borderBottom: "1px solid var(--line-1)" }}>
              <span style={{ fontFamily: "var(--font-serif)", fontSize: 13.5, color: "var(--ink-2)" }}>{s}</span>
              <span style={{ flex: 1 }} />
              <span className="eyebrow" style={{ fontSize: 9 }}>{t}</span>
            </div>
          ))}
          <div style={{ marginTop: 10, fontSize: 11, color: "var(--ink-3)", fontStyle: "italic", fontFamily: "var(--font-serif)" }}>
            Click a sense to save it instead — Astra will remember for this domain.
          </div>
        </div>
      </div>

      {/* (c) custom term dictionary */}
      <div className="eyebrow" style={{ marginTop: 26 }}>C · Term overrides</div>
      <p style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", color: "var(--ink-3)", fontSize: 13, marginTop: 4, marginBottom: 14 }}>
        Your in-house glossary trumps the model.
      </p>
      <Card padded={false}>
        {[
          ["transformer", "→", "变换器（电气）", "*.ieee.org"],
          ["transformer", "→", "Transformer（模型）", "ml-papers/*"],
          ["sprint", "→", "迭代 (S2)", "linear.app/*"],
          ["scope", "→", "作用域", "*.dev"],
        ].map(([s, ar, t, scope], i, arr) => (
          <div key={i} style={{
            display: "grid", gridTemplateColumns: "1fr 12px 1fr 110px",
            gap: 10, padding: "10px 14px", alignItems: "center",
            borderBottom: i < arr.length - 1 ? "1px solid var(--line-1)" : "none",
            fontFamily: "var(--font-serif)", fontSize: 13.5,
          }}>
            <span style={{ color: "var(--ink-1)" }}>{s}</span>
            <span style={{ color: "var(--ink-4)" }}>{ar}</span>
            <span style={{ color: "var(--ink-2)", fontStyle: "italic" }}>{t}</span>
            <span className="mono" style={{ color: "var(--ink-3)", fontSize: 11 }}>{scope}</span>
          </div>
        ))}
        <div style={{ padding: "10px 14px", borderTop: "1px solid var(--line-1)" }}>
          <Btn size="sm" variant="ghost">+ New term</Btn>
        </div>
      </Card>
    </div>

    {/* (b) Quality feedback */}
    <div>
      <div className="eyebrow">B · "This translation is off"</div>
      <p style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", color: "var(--ink-3)", fontSize: 13, marginTop: 4, marginBottom: 14 }}>
        Inline feedback on a single paragraph.
      </p>

      <div style={{
        padding: 18, background: "var(--bg-page)",
        border: "1px solid var(--line-1)", borderRadius: 10,
        fontFamily: "var(--font-serif)",
      }}>
        <p style={{ margin: 0, fontSize: 16, color: "var(--ink-1)", lineHeight: 1.6 }}>
          The room held only the reader and the writer's voice, suspended for the duration of a sentence.
        </p>
        <div style={{ marginTop: 10, paddingLeft: 12, borderLeft: "2px solid var(--hl)", fontStyle: "italic", color: "var(--ink-2)", fontSize: 14, lineHeight: 1.5 }}>
          房间只装着读者和作家的声音，悬挂在一个句子的持续时间内。
        </div>
        <div style={{
          marginTop: 14, padding: 14, background: "var(--bg-surface)",
          border: "1px solid var(--line-1)", borderRadius: 8,
        }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>What's wrong?</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {[
              ["Awkward phrasing", true],
              ["Wrong sense", false],
              ["Tone mismatch", false],
              ["Names / proper nouns", false],
              ["Other", false],
            ].map(([t, sel]) => (
              <span key={t} style={{
                padding: "4px 10px", fontSize: 12,
                background: sel ? "var(--accent-soft)" : "var(--bg-elevated)",
                color: sel ? "var(--accent)" : "var(--ink-2)",
                border: `1px solid ${sel ? "var(--accent-line)" : "var(--line-1)"}`,
                borderRadius: 999, cursor: "pointer", fontFamily: "var(--font-sans)",
                fontWeight: sel ? 500 : 400,
              }}>{t}</span>
            ))}
          </div>
          <textarea placeholder="Suggest a better rendering (optional)…" rows={2} style={{
            marginTop: 10, width: "100%", boxSizing: "border-box",
            background: "var(--bg-elevated)", border: "1px solid var(--line-1)",
            borderRadius: 6, padding: "8px 10px",
            fontFamily: "var(--font-serif)", fontStyle: "italic",
            fontSize: 13, color: "var(--ink-1)", outline: "none",
            resize: "vertical",
          }} />
          <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
            <Btn size="sm" variant="primary">Send feedback</Btn>
            <Btn size="sm" variant="ghost">Try a different model</Btn>
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 11, color: "var(--ink-3)", fontStyle: "italic", alignSelf: "center", fontFamily: "var(--font-serif)" }}>
              Anonymized · helps every reader
            </span>
          </div>
        </div>
      </div>

      {/* model picker */}
      <div className="eyebrow" style={{ marginTop: 26 }}>Engine for this paragraph</div>
      <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
        {[
          { n: "Astra Relay (default)", s: "balanced · paid by Pro", sel: true },
          { n: "Astra · Literary", s: "slower, more careful with prose", sel: false },
          { n: "Bring your own key", s: "OpenAI / Anthropic / Mistral", sel: false },
        ].map(m => (
          <div key={m.n} style={{
            padding: "10px 12px",
            background: m.sel ? "var(--accent-soft)" : "var(--bg-surface)",
            border: `1px solid ${m.sel ? "var(--accent-line)" : "var(--line-1)"}`,
            borderRadius: 8, display: "flex", alignItems: "center", gap: 10,
          }}>
            <span style={{
              width: 14, height: 14, borderRadius: "50%",
              border: "1.5px solid " + (m.sel ? "var(--accent)" : "var(--line-2)"),
              background: m.sel ? "var(--accent)" : "transparent",
            }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, color: "var(--ink-1)", fontWeight: 500 }}>{m.n}</div>
              <div style={{ fontSize: 11, color: "var(--ink-3)", fontStyle: "italic", marginTop: 1, fontFamily: "var(--font-serif)" }}>{m.s}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

Object.assign(window, { MobileFrame, ChangelogFrame, AIEdgeFrame });
})();
