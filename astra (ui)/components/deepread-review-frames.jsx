;(function(){
const {
  AstraMark, AstraWordmark,
  IconLanguages, IconBook, IconArrowRight, IconCheck, IconClose,
  IconBookmark, IconClock, IconSparkle,
  Card, Btn, Pill, Toggle, Divider,
} = window;

/* ====================================================================
   4. Deep Read entry transition + 5. Review summary
   ==================================================================== */

const DeepReadEntryFrame = ({ direction = "quiet" }) => (
  <div data-astra={direction} className="astra-frame astra-root" style={{
    width: "100%", height: "100%", background: "var(--bg-page)",
    position: "relative", overflow: "hidden",
  }}>
    {/* Two stacked panels: "from page" on left, Deep Read on right with arrow */}
    <div style={{
      display: "grid", gridTemplateColumns: "1fr 60px 1fr",
      width: "100%", height: "100%",
    }}>
      {/* Left: source page being lifted */}
      <div style={{
        background: "var(--bg-sunken)", padding: 28,
        display: "flex", flexDirection: "column",
        position: "relative",
      }}>
        <div className="eyebrow" style={{ marginBottom: 12 }}>From the article</div>
        <div style={{
          flex: 1, background: "var(--bg-page)",
          border: "1px solid var(--line-1)", borderRadius: 8,
          padding: 22, position: "relative",
          fontFamily: "var(--font-serif)",
          opacity: 0.7,
        }}>
          <div style={{ fontSize: 18, color: "var(--ink-1)", lineHeight: 1.3, marginBottom: 8 }}>
            The Quiet Architecture of Reading
          </div>
          {[1,1,0.9,1,0.6,1,0.8,1,0.5].map((w, i) => (
            <div key={i} style={{
              height: 8, width: `${w * 100}%`,
              background: "var(--ink-2)", opacity: 0.4, borderRadius: 2,
              marginBottom: 7,
            }} />
          ))}
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(135deg, transparent 60%, var(--bg-page) 100%)",
            pointerEvents: "none",
          }} />
        </div>
      </div>

      {/* Center arrow */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "var(--bg-page)", borderLeft: "1px solid var(--line-1)",
        borderRight: "1px solid var(--line-1)",
      }}>
        <span style={{
          width: 36, height: 36, borderRadius: "50%",
          background: "var(--accent)", color: "var(--bg-page)",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
        }}><IconArrowRight size={16} stroke={2} /></span>
      </div>

      {/* Right: Deep Read appearing */}
      <div style={{
        background: "var(--bg-page)", padding: 28,
        display: "flex", flexDirection: "column",
        position: "relative",
      }}>
        <div className="eyebrow" style={{ marginBottom: 12, color: "var(--accent)" }}>
          → Opening in Deep Read
        </div>
        <div style={{
          flex: 1, background: "var(--bg-surface)",
          border: "1px solid var(--line-1)", borderRadius: 8,
          padding: 22, boxShadow: "var(--shadow-md)",
          fontFamily: "var(--font-serif)",
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16,
        }}>
          <div>
            <div style={{ fontSize: 16, color: "var(--ink-1)", lineHeight: 1.3, marginBottom: 8 }}>
              The Quiet Architecture of Reading
            </div>
            <div style={{ fontSize: 11, fontStyle: "italic", color: "var(--ink-3)", marginBottom: 12 }}>
              by Hannah Park · 12 min
            </div>
            {[1,0.95,1,0.6,1,0.85].map((w, i) => (
              <div key={i} style={{ height: 7, width: `${w * 100}%`, background: "var(--ink-2)", opacity: 0.6, borderRadius: 2, marginBottom: 6 }} />
            ))}
          </div>
          <div style={{ borderLeft: "1px solid var(--line-1)", paddingLeft: 14 }}>
            <div className="eyebrow" style={{ marginBottom: 8, color: "var(--accent)", fontSize: 9 }}>MARGINALIA</div>
            {[0.8,0.6,0.9,0.5,0.7].map((w, i) => (
              <div key={i} style={{ height: 6, width: `${w * 100}%`, background: "var(--accent)", opacity: 0.5, borderRadius: 2, marginBottom: 5 }} />
            ))}
          </div>
        </div>

        <div style={{
          marginTop: 16, padding: "12px 14px",
          background: "var(--bg-surface)", border: "1px solid var(--line-1)",
          borderRadius: 8, display: "flex", alignItems: "center", gap: 10,
        }}>
          <span style={{
            width: 24, height: 24, borderRadius: 5,
            background: "var(--accent-soft)", color: "var(--accent)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            border: "1px solid var(--accent-line)",
          }}><IconBook size={13} /></span>
          <div style={{ flex: 1, fontSize: 12, color: "var(--ink-2)", fontFamily: "var(--font-serif)", fontStyle: "italic" }}>
            Reading session begins. Words you save here review tomorrow.
          </div>
          <Pill tone="accent">⌘ ⇧ ↩ to begin</Pill>
        </div>
      </div>
    </div>
  </div>
);

/* ============= REVIEW SUMMARY ============== */

const Stat = ({ label, value, sub }) => (
  <div style={{ flex: 1, padding: "0 16px" }}>
    <div className="eyebrow" style={{ marginBottom: 6 }}>{label}</div>
    <div style={{
      fontFamily: "var(--font-serif)", fontSize: 56, lineHeight: 1,
      letterSpacing: "-0.03em", color: "var(--ink-1)", fontWeight: 400,
    }}>{value}</div>
    {sub ? (
      <div style={{ fontSize: 12, color: "var(--ink-3)", fontStyle: "italic", marginTop: 6, fontFamily: "var(--font-serif)" }}>
        {sub}
      </div>
    ) : null}
  </div>
);

const ReviewSummaryFrame = ({ direction = "quiet" }) => (
  <div data-astra={direction} className="astra-frame astra-root" style={{
    width: "100%", height: "100%", background: "var(--bg-page)",
    padding: "60px 80px", boxSizing: "border-box", overflow: "hidden",
  }}>
    <div style={{ maxWidth: 880, margin: "0 auto" }}>
      <div className="eyebrow">Session complete · 8:42pm</div>
      <h1 style={{
        fontFamily: "var(--font-serif)", fontSize: 56, fontWeight: 400,
        letterSpacing: "-0.025em", lineHeight: 1.05, margin: "12px 0 4px",
        color: "var(--ink-1)",
      }}>
        Twelve quiet minutes.
      </h1>
      <p style={{
        fontFamily: "var(--font-serif)", fontStyle: "italic",
        fontSize: 19, color: "var(--ink-2)", lineHeight: 1.5,
        marginTop: 6, marginBottom: 36, maxWidth: 600,
      }}>
        You reviewed 18 words. Sixteen are settling deeper. Two need another look — Astra will bring them back tomorrow.
      </p>

      <div style={{
        display: "flex", borderTop: "1px solid var(--line-1)",
        borderBottom: "1px solid var(--line-1)",
        padding: "28px 0", margin: "0 -16px",
      }}>
        <Stat label="Reviewed" value="18" sub="of 18 due" />
        <Stat label="Recall" value="89%" sub="↑ from 82%" />
        <Stat label="Streak" value="9" sub="days in a row" />
        <Stat label="Next" value="Tmrw" sub="14 words due" />
      </div>

      {/* Word breakdown */}
      <div style={{ marginTop: 36, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Settling</div>
          <div style={{ display: "grid", gap: 6 }}>
            {[
              ["solitude", "again in 4 days"],
              ["marginalia", "again in 6 days"],
              ["companion", "again in 2 weeks"],
              ["suspended", "again in 3 days"],
              ["overpaint", "again in 5 days"],
            ].map(([w, when]) => (
              <div key={w} style={{
                display: "flex", alignItems: "baseline",
                padding: "8px 12px",
                background: "var(--bg-surface)", border: "1px solid var(--line-1)",
                borderRadius: 6, gap: 12,
              }}>
                <span style={{ fontFamily: "var(--font-serif)", fontSize: 16, color: "var(--ink-1)" }}>{w}</span>
                <span style={{ flex: 1 }} />
                <span style={{ fontSize: 12, color: "var(--ink-3)", fontFamily: "var(--font-serif)", fontStyle: "italic" }}>
                  {when}
                </span>
              </div>
            ))}
            <div style={{ fontSize: 12, color: "var(--ink-3)", fontStyle: "italic", marginTop: 4, fontFamily: "var(--font-serif)" }}>
              + 11 more
            </div>
          </div>
        </div>
        <div>
          <div className="eyebrow" style={{ marginBottom: 10, color: "var(--hl)" }}>Coming back tomorrow</div>
          <div style={{ display: "grid", gap: 6 }}>
            {[
              ["effervescent", "missed twice"],
              ["taciturn", "blanked"],
            ].map(([w, why]) => (
              <div key={w} style={{
                display: "flex", alignItems: "baseline",
                padding: "8px 12px",
                background: "var(--bg-surface)",
                border: "1px solid var(--line-1)",
                borderLeft: "2px solid var(--hl)",
                borderRadius: 6, gap: 12,
              }}>
                <span style={{ fontFamily: "var(--font-serif)", fontSize: 16, color: "var(--ink-1)" }}>{w}</span>
                <span style={{ flex: 1 }} />
                <span style={{ fontSize: 12, color: "var(--ink-3)", fontFamily: "var(--font-serif)", fontStyle: "italic" }}>
                  {why}
                </span>
              </div>
            ))}
          </div>
          <div style={{
            marginTop: 12, padding: 12,
            background: "var(--accent-soft)", border: "1px solid var(--accent-line)",
            borderRadius: 8, fontSize: 12.5, color: "var(--ink-2)",
            fontFamily: "var(--font-serif)", fontStyle: "italic", lineHeight: 1.5,
          }}>
            <AstraMark size={12} style={{ color: "var(--accent)", marginRight: 6, verticalAlign: -1 }} />
            Both came from the same article. Reading it once more might help.
          </div>
        </div>
      </div>

      <div style={{ marginTop: 36, display: "flex", gap: 10 }}>
        <Btn variant="primary" size="lg" iconRight={<IconArrowRight size={13} stroke={2} />}>
          Back to reading
        </Btn>
        <Btn variant="ghost" size="lg">View library</Btn>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: "var(--ink-3)", fontStyle: "italic", alignSelf: "center", fontFamily: "var(--font-serif)" }}>
          Notifications quiet until tomorrow 9am.
        </span>
      </div>
    </div>
  </div>
);

Object.assign(window, { DeepReadEntryFrame, ReviewSummaryFrame });
})();
