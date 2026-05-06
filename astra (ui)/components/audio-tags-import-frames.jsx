;(function(){
const {
  AstraMark, AstraWordmark,
  IconPlay, IconPause, IconArrowRight, IconCheck, IconClose,
  IconBookmark, IconHighlighter, IconChevronRight, IconClock,
  Card, Btn, Pill, Toggle, Divider,
} = window;

/* ====================================================================
   15. Pronunciation/Audio · 16. Tags & collections · 17. Inbound share import
   ==================================================================== */

const Waveform = ({ active = 0.4 }) => {
  const bars = Array.from({ length: 38 }, (_, i) => {
    const seed = Math.sin(i * 1.3) * 0.4 + Math.cos(i * 0.7) * 0.3 + 0.5;
    const h = Math.max(3, seed * 28);
    return h;
  });
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2, height: 32 }}>
      {bars.map((h, i) => (
        <span key={i} style={{
          width: 2, height: h,
          background: i / bars.length < active ? "var(--accent)" : "var(--line-2)",
          borderRadius: 1,
        }} />
      ))}
    </div>
  );
};

const AudioFrame = ({ direction = "quiet" }) => (
  <div data-astra={direction} className="astra-frame astra-root" style={{
    width: "100%", height: "100%", background: "var(--bg-page)",
    padding: "44px 60px", boxSizing: "border-box", overflow: "hidden",
  }}>
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <div className="eyebrow">Word detail · Pronunciation</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 36, marginTop: 14 }}>
        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
            <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 64, fontWeight: 400, letterSpacing: "-0.025em", margin: 0, lineHeight: 1 }}>
              effervescent
            </h1>
            <Pill>adj.</Pill>
          </div>
          <div className="mono" style={{ color: "var(--ink-3)", marginTop: 10, fontSize: 14 }}>
            /ˌɛf.ərˈvɛs.ənt/
          </div>

          {/* Audio players — UK / US / slow */}
          <div style={{ marginTop: 22, display: "grid", gap: 10 }}>
            {[
              { l: "UK · Received", on: true, dur: "0:01" },
              { l: "US · General American", on: false, dur: "0:01" },
              { l: "Slow · syllable by syllable", on: false, dur: "0:03" },
            ].map(p => (
              <div key={p.l} style={{
                padding: "12px 14px", background: "var(--bg-surface)",
                border: "1px solid var(--line-1)", borderRadius: 8,
                display: "flex", alignItems: "center", gap: 14,
              }}>
                <button style={{
                  width: 36, height: 36, borderRadius: "50%",
                  background: p.on ? "var(--accent)" : "var(--bg-elevated)",
                  color: p.on ? "var(--bg-page)" : "var(--ink-1)",
                  border: `1px solid ${p.on ? "var(--accent)" : "var(--line-2)"}`,
                  cursor: "pointer", display: "inline-flex",
                  alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  {p.on ? <IconPause size={13} /> : <IconPlay size={13} />}
                </button>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: "var(--ink-1)", fontWeight: 500 }}>{p.l}</div>
                  <div style={{ marginTop: 4 }}>
                    <Waveform active={p.on ? 0.45 : 0} />
                  </div>
                </div>
                <span className="mono" style={{ color: "var(--ink-3)" }}>{p.dur}</span>
              </div>
            ))}
          </div>

          {/* Yourself */}
          <div className="eyebrow" style={{ marginTop: 28, marginBottom: 8 }}>Your voice</div>
          <div style={{
            padding: 16, background: "var(--bg-surface)",
            border: "1px dashed var(--line-2)", borderRadius: 8,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <button style={{
                width: 44, height: 44, borderRadius: "50%",
                background: "var(--ink-1)", color: "var(--bg-page)",
                border: 0, cursor: "pointer",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
              }}>
                <span style={{ width: 12, height: 12, borderRadius: 2, background: "var(--danger)" }} />
              </button>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: "var(--ink-1)", fontWeight: 500 }}>Record yourself</div>
                <div style={{ fontSize: 12, color: "var(--ink-3)", fontStyle: "italic", marginTop: 1, fontFamily: "var(--font-serif)" }}>
                  Astra compares the curve to the reference.
                </div>
              </div>
              <Pill>hold ⌥ to record</Pill>
            </div>

            <div style={{
              marginTop: 12, padding: 12, background: "var(--bg-page)",
              borderRadius: 6, border: "1px solid var(--line-1)",
              display: "grid", gridTemplateColumns: "60px 1fr auto", gap: 10, alignItems: "center",
            }}>
              <span className="eyebrow" style={{ fontSize: 9 }}>You</span>
              <Waveform active={0.6} />
              <Pill tone="ok">94% match</Pill>
            </div>
            <div style={{
              marginTop: 8, padding: 12, background: "var(--bg-page)",
              borderRadius: 6, border: "1px solid var(--line-1)",
              display: "grid", gridTemplateColumns: "60px 1fr auto", gap: 10, alignItems: "center",
            }}>
              <span className="eyebrow" style={{ fontSize: 9 }}>UK</span>
              <Waveform active={0.6} />
              <span className="mono" style={{ color: "var(--ink-3)" }}>0:01</span>
            </div>
          </div>
        </div>

        {/* Right rail — IPA breakdown */}
        <div>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Syllables</div>
          <Card padded={false}>
            <div style={{ display: "flex", borderBottom: "1px solid var(--line-1)" }}>
              {["ef", "fer", "ves", "cent"].map((s, i) => (
                <div key={i} style={{
                  flex: 1, padding: "14px 8px", textAlign: "center",
                  borderRight: i < 3 ? "1px solid var(--line-1)" : 0,
                  background: i === 2 ? "var(--accent-soft)" : "transparent",
                }}>
                  <div style={{ fontFamily: "var(--font-serif)", fontSize: 18, color: "var(--ink-1)" }}>{s}</div>
                  <div className="mono" style={{ color: "var(--ink-3)", marginTop: 2, fontSize: 11 }}>
                    /{["ɛf", "ər", "ˈvɛs", "ənt"][i]}/
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: "12px 14px", fontSize: 12, color: "var(--ink-3)", fontStyle: "italic", fontFamily: "var(--font-serif)" }}>
              Stress on the third syllable. Tap any to hear it alone.
            </div>
          </Card>

          <div className="eyebrow" style={{ marginTop: 22, marginBottom: 8 }}>Listen in context</div>
          <div style={{ padding: 14, background: "var(--bg-surface)", border: "1px solid var(--line-1)", borderRadius: 8 }}>
            <div style={{ fontFamily: "var(--font-serif)", fontSize: 14, color: "var(--ink-1)", lineHeight: 1.55 }}>
              She gave an <span style={{ background: "var(--accent-soft)", padding: "0 2px", borderRadius: 2 }}>effervescent</span> welcome to the new arrivals.
            </div>
            <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10 }}>
              <Btn size="sm" variant="ghost" icon={<IconPlay size={11} />}>Play sentence</Btn>
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 11, color: "var(--ink-3)", fontStyle: "italic", fontFamily: "var(--font-serif)" }}>
                generated · ElevenLabs
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

/* =============== TAGS & COLLECTIONS ================ */

const Tag = ({ name, count, color }) => (
  <button style={{
    display: "flex", alignItems: "center", gap: 8,
    padding: "8px 12px", textAlign: "left", width: "100%",
    background: "transparent", border: "1px solid var(--line-1)",
    borderRadius: 6, cursor: "pointer", fontFamily: "var(--font-sans)",
  }}>
    <span style={{ width: 8, height: 8, borderRadius: 2, background: color || "var(--accent)" }} />
    <span style={{ flex: 1, fontSize: 13, color: "var(--ink-1)" }}>{name}</span>
    <span style={{ fontSize: 12, color: "var(--ink-3)", fontFamily: "var(--font-serif)", fontStyle: "italic" }}>{count}</span>
  </button>
);

const TagsFrame = ({ direction = "quiet" }) => (
  <div data-astra={direction} className="astra-frame astra-root" style={{
    width: "100%", height: "100%", background: "var(--bg-page)",
    padding: "44px 60px", boxSizing: "border-box", overflow: "hidden",
    display: "grid", gridTemplateColumns: "260px 1fr", gap: 32,
  }}>
    <div>
      <div className="eyebrow">Library · Tags</div>
      <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 24, fontWeight: 400, margin: "8px 0 16px", letterSpacing: "-0.015em" }}>
        Collections
      </h2>
      <div style={{ display: "grid", gap: 6 }}>
        <Tag name="All words" count={142} color="var(--ink-2)" />
        <Tag name="GRE" count={48} color="#7a4f2c" />
        <Tag name="Business English" count={31} color="var(--accent)" />
        <Tag name="Longform" count={26} color="#3f6b4a" />
        <Tag name="Adjectives" count={37} color="var(--hl)" />
        <Tag name="From newyorker.com" count={22} color="#92302a" />
      </div>
      <div style={{ marginTop: 14 }}>
        <Btn size="sm" variant="ghost" style={{ width: "100%" }}>+ New tag</Btn>
      </div>

      <div className="eyebrow" style={{ marginTop: 24, marginBottom: 10 }}>Smart</div>
      <div style={{ display: "grid", gap: 6 }}>
        <Tag name="Due today" count={12} color="var(--accent)" />
        <Tag name="Mastered" count={28} color="var(--ok)" />
        <Tag name="Saved this week" count={18} color="var(--ink-2)" />
      </div>
    </div>

    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 36, fontWeight: 400, letterSpacing: "-0.025em", margin: 0, lineHeight: 1.1 }}>
          GRE
        </h1>
        <Pill>48 words</Pill>
        <span style={{ flex: 1 }} />
        <Btn size="sm" variant="ghost">Edit tag</Btn>
        <Btn size="sm" variant="primary" iconRight={<IconArrowRight size={11} />}>Review collection</Btn>
      </div>
      <p style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", color: "var(--ink-3)", fontSize: 15, margin: "6px 0 24px" }}>
        Started Apr 12 · 11 due today · review averages 6 minutes
      </p>

      {/* word grid */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8,
      }}>
        {[
          ["effervescent", "活泼的", "due today"],
          ["taciturn", "寡言的", "due today"],
          ["palimpsest", "重写本", "in 2 days"],
          ["pedantic", "学究的", "in 4 days"],
          ["ostensible", "表面的", "mastered"],
          ["recalcitrant", "顽固的", "in 1 day"],
          ["lugubrious", "悲哀的", "due today"],
          ["sanguine", "乐观的", "in 6 days"],
          ["obfuscate", "混淆", "due today"],
        ].map(([w, g, when]) => (
          <div key={w} style={{
            padding: "12px 14px", background: "var(--bg-surface)",
            border: "1px solid var(--line-1)", borderRadius: 8,
          }}>
            <div style={{ fontFamily: "var(--font-serif)", fontSize: 18, color: "var(--ink-1)", lineHeight: 1.2 }}>{w}</div>
            <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", color: "var(--ink-2)", fontSize: 13, marginTop: 2 }}>{g}</div>
            <div style={{
              marginTop: 8, fontSize: 11, color: when === "due today" ? "var(--accent)" : "var(--ink-3)",
              fontFamily: "var(--font-sans)", fontWeight: when === "due today" ? 500 : 400,
            }}>
              <IconClock size={10} style={{ verticalAlign: -1, marginRight: 4 }} />
              {when}
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12, fontSize: 12, color: "var(--ink-3)", fontStyle: "italic", fontFamily: "var(--font-serif)", textAlign: "center" }}>
        + 39 more in this collection
      </div>
    </div>
  </div>
);

/* =============== INBOUND SHARE — IMPORT ================ */

const ImportFrame = ({ direction = "quiet" }) => (
  <div data-astra={direction} className="astra-frame astra-root" style={{
    width: "100%", height: "100%", background: "var(--bg-page)",
    padding: "44px 60px", boxSizing: "border-box", overflow: "hidden",
    display: "flex", alignItems: "center", justifyContent: "center",
  }}>
    <div style={{ width: 720 }}>
      <div className="eyebrow">Shared with you</div>
      <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 32, fontWeight: 400, letterSpacing: "-0.02em", lineHeight: 1.15, margin: "8px 0 4px" }}>
        Mei sent you a word list.
      </h1>
      <p style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 16, color: "var(--ink-3)", margin: "4px 0 22px" }}>
        21 words from <span style={{ borderBottom: "1px dotted var(--line-2)" }}>"The Quiet Architecture of Reading"</span>. Add to your library?
      </p>

      <div style={{
        background: "var(--bg-surface)", border: "1px solid var(--line-1)",
        borderRadius: 12, overflow: "hidden",
      }}>
        <div style={{
          padding: "14px 18px", borderBottom: "1px solid var(--line-1)",
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <span style={{
            width: 36, height: 36, borderRadius: "50%",
            background: "var(--bg-sunken)", border: "1px solid var(--line-1)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            fontFamily: "var(--font-serif)", fontSize: 16, color: "var(--ink-1)",
          }}>M</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, color: "var(--ink-1)", fontWeight: 500 }}>Mei Lin · @meilin</div>
            <div style={{ fontSize: 12, color: "var(--ink-3)", fontStyle: "italic", marginTop: 1, fontFamily: "var(--font-serif)" }}>
              From newyorker.com · curated for you · 4 words you already have
            </div>
          </div>
          <Pill tone="accent">21 words</Pill>
        </div>

        <div style={{ padding: "12px 18px", maxHeight: 280, overflow: "auto" }}>
          {[
            ["solitude", "独处", "you have it", true],
            ["marginalia", "页边注释", "new", false],
            ["palimpsest", "重写本", "you have it", true],
            ["interleaved", "交织的", "new", false],
            ["effervescent", "活泼的", "you have it", true],
            ["overpaint", "覆盖", "new", false],
            ["companion", "伴侣", "you have it", true],
            ["taciturn", "寡言的", "new", false],
          ].map(([w, g, st, dup]) => (
            <div key={w} style={{
              display: "grid", gridTemplateColumns: "20px 160px 1fr auto", gap: 12,
              padding: "8px 0", borderBottom: "1px solid var(--line-1)",
              alignItems: "center",
              opacity: dup ? 0.5 : 1,
            }}>
              <span style={{
                width: 14, height: 14, borderRadius: 3,
                border: "1.5px solid " + (dup ? "var(--line-2)" : "var(--accent)"),
                background: dup ? "transparent" : "var(--accent)",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                color: "var(--bg-page)",
              }}>
                {!dup && <IconCheck size={9} stroke={3} />}
              </span>
              <span style={{ fontFamily: "var(--font-serif)", fontSize: 16, color: "var(--ink-1)" }}>{w}</span>
              <span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", color: "var(--ink-2)", fontSize: 14 }}>{g}</span>
              <span style={{ fontSize: 11, color: dup ? "var(--ink-4)" : "var(--ok)", fontFamily: "var(--font-sans)" }}>{st}</span>
            </div>
          ))}
          <div style={{ fontSize: 12, color: "var(--ink-3)", fontStyle: "italic", textAlign: "center", padding: "8px 0", fontFamily: "var(--font-serif)" }}>
            + 13 more
          </div>
        </div>

        <div style={{
          padding: "14px 18px", borderTop: "1px solid var(--line-1)",
          background: "var(--bg-sunken)",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <span className="eyebrow" style={{ marginRight: 4 }}>Add as</span>
          <Pill tone="accent">tag · "Mei's list"</Pill>
          <Pill>schedule for review</Pill>
          <span style={{ flex: 1 }} />
          <Btn variant="ghost" size="md">Decline</Btn>
          <Btn variant="primary" size="md" iconRight={<IconArrowRight size={12} stroke={2} />}>Add 17 new words</Btn>
        </div>
      </div>
    </div>
  </div>
);

Object.assign(window, { AudioFrame, TagsFrame, ImportFrame });
})();
