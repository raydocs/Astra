;(function(){
const {
  AstraMark, AstraWordmark,
  IconLanguages, IconCheck, IconArrowRight, IconGlobe, IconBook,
  IconClose, IconChevronRight,
  Card, Btn, Pill, Toggle, Divider,
} = window;

/* ====================================================================
   2. Multi-step Onboarding — 4 panels in a row
   Welcome → Language → Style → First translation
   ==================================================================== */

const StepDot = ({ active, done }) => (
  <span style={{
    width: active ? 18 : 6, height: 6, borderRadius: 3,
    background: active ? "var(--accent)" : (done ? "var(--ink-2)" : "var(--line-2)"),
    transition: "all 200ms ease",
    display: "inline-block",
  }} />
);

const StepHeader = ({ step, total, title, subtitle }) => (
  <>
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
      {Array.from({ length: total }).map((_, i) => (
        <StepDot key={i} active={i === step} done={i < step} />
      ))}
      <span className="eyebrow" style={{ marginLeft: 8 }}>
        Step {step + 1} of {total}
      </span>
    </div>
    <h2 style={{
      fontFamily: "var(--font-serif)", fontWeight: 400,
      fontSize: 32, letterSpacing: "-0.02em", lineHeight: 1.15,
      color: "var(--ink-1)", margin: 0,
    }}>{title}</h2>
    {subtitle ? (
      <p style={{
        fontFamily: "var(--font-serif)", fontStyle: "italic",
        color: "var(--ink-3)", fontSize: 16, lineHeight: 1.5,
        marginTop: 8, marginBottom: 0,
      }}>{subtitle}</p>
    ) : null}
  </>
);

const Panel = ({ children }) => (
  <div style={{
    width: 360, height: 540,
    background: "var(--bg-surface)",
    border: "1px solid var(--line-1)",
    borderRadius: 14,
    padding: "32px 28px",
    boxSizing: "border-box",
    display: "flex", flexDirection: "column",
    boxShadow: "var(--shadow-sm)",
  }}>
    {children}
  </div>
);

const PanelWelcome = () => (
  <Panel>
    <div style={{ flex: 1 }}>
      <StepHeader step={0} total={4} title="Welcome to Astra"
        subtitle="A quieter way to read English on the web." />
      <div style={{ marginTop: 28, display: "grid", gap: 14 }}>
        {[
          ["Translate any page", "without overpainting it"],
          ["Save words in context", "as you read"],
          ["Review what you saved", "with spaced repetition"],
        ].map(([t, s]) => (
          <div key={t} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <span style={{
              width: 22, height: 22, borderRadius: 5,
              background: "var(--accent-soft)", color: "var(--accent)",
              border: "1px solid var(--accent-line)",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0, marginTop: 2,
            }}><IconCheck size={12} stroke={2} /></span>
            <div>
              <div style={{ fontSize: 14, color: "var(--ink-1)", fontWeight: 500 }}>{t}</div>
              <div style={{ fontSize: 12, color: "var(--ink-3)", fontStyle: "italic", marginTop: 1 }}>{s}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
    <Btn variant="primary" size="lg" iconRight={<IconArrowRight size={13} stroke={2} />}
      style={{ width: "100%", justifyContent: "space-between" }}>
      <span>Begin</span>
    </Btn>
  </Panel>
);

const PanelLanguage = () => (
  <Panel>
    <div style={{ flex: 1 }}>
      <StepHeader step={1} total={4} title="What pair?"
        subtitle="You can change this anytime in Settings." />
      <div style={{ marginTop: 24 }}>
        <div className="eyebrow" style={{ marginBottom: 8 }}>Read in</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {[
            ["English", "en", true],
            ["日本語", "ja", false],
            ["Français", "fr", false],
            ["Deutsch", "de", false],
          ].map(([n, code, sel]) => (
            <button key={code} style={{
              padding: "10px 12px", textAlign: "left",
              background: sel ? "var(--accent-soft)" : "var(--bg-elevated)",
              border: `1px solid ${sel ? "var(--accent-line)" : "var(--line-1)"}`,
              borderRadius: 8, cursor: "pointer",
              fontFamily: "var(--font-sans)",
            }}>
              <div style={{ fontFamily: "var(--font-serif)", fontSize: 16, color: "var(--ink-1)" }}>{n}</div>
              <div className="mono" style={{ color: "var(--ink-3)", marginTop: 1 }}>{code}</div>
            </button>
          ))}
        </div>

        <div className="eyebrow" style={{ marginTop: 22, marginBottom: 8 }}>Translate to</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {[["简体中文", "zh-CN", true], ["繁體中文", "zh-TW", false]].map(([n, code, sel]) => (
            <button key={code} style={{
              padding: "10px 12px", textAlign: "left",
              background: sel ? "var(--accent-soft)" : "var(--bg-elevated)",
              border: `1px solid ${sel ? "var(--accent-line)" : "var(--line-1)"}`,
              borderRadius: 8, cursor: "pointer",
              fontFamily: "var(--font-sans)",
            }}>
              <div style={{ fontFamily: "var(--font-serif)", fontSize: 16, color: "var(--ink-1)" }}>{n}</div>
              <div className="mono" style={{ color: "var(--ink-3)", marginTop: 1 }}>{code}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
    <div style={{ display: "flex", gap: 8 }}>
      <Btn variant="ghost" size="md">Back</Btn>
      <Btn variant="primary" size="md" iconRight={<IconArrowRight size={13} stroke={2} />}
        style={{ flex: 1, justifyContent: "space-between" }}>
        <span>Continue</span>
      </Btn>
    </div>
  </Panel>
);

const PanelStyle = () => (
  <Panel>
    <div style={{ flex: 1 }}>
      <StepHeader step={2} total={4} title="Pick a reading style"
        subtitle="How translation appears on every page." />
      <div style={{ marginTop: 22, display: "grid", gap: 10 }}>
        {[
          {
            n: "Marginalia", s: "Translation in the margin · paper-like",
            sel: true,
            preview: <div style={{ display: "flex", gap: 6, fontFamily: "var(--font-serif)" }}>
              <span style={{ flex: 1, fontSize: 11, color: "var(--ink-1)" }}>The quiet room…</span>
              <span style={{ width: 1, background: "var(--accent)" }} />
              <span style={{ flex: 1, fontSize: 11, fontStyle: "italic", color: "var(--ink-3)" }}>安静的房间…</span>
            </div>,
          },
          {
            n: "Bilingual inline", s: "Translation under each paragraph",
            sel: false,
            preview: <div style={{ fontFamily: "var(--font-serif)" }}>
              <div style={{ fontSize: 11, color: "var(--ink-1)" }}>The quiet room held only…</div>
              <div style={{ fontSize: 10, fontStyle: "italic", color: "var(--ink-3)", paddingLeft: 6, borderLeft: "1px solid var(--accent)", marginTop: 2 }}>安静的房间…</div>
            </div>,
          },
          {
            n: "Replace", s: "Show only translation",
            sel: false,
            preview: <div style={{ fontFamily: "var(--font-serif)", fontSize: 11, color: "var(--ink-1)" }}>
              安静的房间只容纳了…
            </div>,
          },
        ].map(({ n, s, sel, preview }) => (
          <div key={n} style={{
            padding: 12,
            background: sel ? "var(--accent-soft)" : "var(--bg-elevated)",
            border: `1px solid ${sel ? "var(--accent-line)" : "var(--line-1)"}`,
            borderRadius: 8,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{
                width: 14, height: 14, borderRadius: "50%",
                border: "1.5px solid " + (sel ? "var(--accent)" : "var(--line-2)"),
                background: sel ? "var(--accent)" : "transparent",
                flexShrink: 0,
              }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: "var(--ink-1)", fontWeight: 500 }}>{n}</div>
                <div style={{ fontSize: 11, color: "var(--ink-3)", fontStyle: "italic", marginTop: 1 }}>{s}</div>
              </div>
            </div>
            <div style={{ marginTop: 8, padding: 8, background: "var(--bg-sunken)", borderRadius: 5 }}>
              {preview}
            </div>
          </div>
        ))}
      </div>
    </div>
    <div style={{ display: "flex", gap: 8 }}>
      <Btn variant="ghost" size="md">Back</Btn>
      <Btn variant="primary" size="md" iconRight={<IconArrowRight size={13} stroke={2} />}
        style={{ flex: 1, justifyContent: "space-between" }}>
        <span>Continue</span>
      </Btn>
    </div>
  </Panel>
);

const PanelFirstRun = () => (
  <Panel>
    <div style={{ flex: 1 }}>
      <StepHeader step={3} total={4} title="Try it once"
        subtitle="One short paragraph, translated live." />
      <div style={{
        marginTop: 22, padding: 16,
        background: "var(--bg-page)",
        border: "1px solid var(--line-1)", borderRadius: 8,
      }}>
        <div style={{ fontFamily: "var(--font-serif)", fontSize: 14, color: "var(--ink-1)", lineHeight: 1.55 }}>
          For most of history, reading was a private architecture — a quiet
          room a person built between the lines on a page.
        </div>
        <div style={{
          marginTop: 10, paddingLeft: 10, borderLeft: "2px solid var(--accent)",
          fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 13.5,
          color: "var(--ink-2)", lineHeight: 1.5,
        }}>
          在人类历史的大部分时间里，阅读是一种私人的建筑——一个人在页面字里行间之中建起的安静房间。
        </div>
        <div style={{
          marginTop: 12, display: "flex", alignItems: "center", gap: 8,
          fontSize: 11, color: "var(--ink-3)", fontStyle: "italic",
        }}>
          <IconCheck size={12} /> Translated in 0.4s · 38 tokens
        </div>
      </div>
      <div style={{
        marginTop: 16, padding: 12,
        background: "var(--accent-soft)", border: "1px solid var(--accent-line)",
        borderRadius: 8,
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
          <AstraMark size={14} style={{ color: "var(--accent)", marginTop: 2 }} />
          <div style={{ fontSize: 12, color: "var(--ink-2)", lineHeight: 1.5 }}>
            <strong style={{ fontWeight: 500, color: "var(--ink-1)" }}>You're set.</strong>
            {" "}Astra is now in your toolbar. Press{" "}
            <span className="mono" style={{ background: "var(--bg-elevated)", padding: "1px 5px", borderRadius: 3, border: "1px solid var(--line-1)" }}>⌥E</span>{" "}
            to translate any page.
          </div>
        </div>
      </div>
    </div>
    <Btn variant="primary" size="lg" iconRight={<IconArrowRight size={13} stroke={2} />}
      style={{ width: "100%", justifyContent: "space-between" }}>
      <span>Open my first article</span>
    </Btn>
  </Panel>
);

const OnboardingMultiFrame = ({ direction = "quiet" }) => (
  <div data-astra={direction} className="astra-frame astra-root" style={{
    width: "100%", height: "100%", background: "var(--bg-page)",
    padding: "24px 28px", boxSizing: "border-box", overflow: "hidden",
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
      <AstraWordmark size={18} />
      <span style={{ flex: 1 }} />
      <span style={{ fontSize: 12, color: "var(--ink-3)", fontStyle: "italic", fontFamily: "var(--font-serif)" }}>
        Skip setup
      </span>
    </div>
    <div style={{ display: "flex", gap: 16, justifyContent: "center", alignItems: "flex-start" }}>
      <PanelWelcome />
      <PanelLanguage />
      <PanelStyle />
      <PanelFirstRun />
    </div>
  </div>
);

Object.assign(window, { OnboardingMultiFrame });
})();
