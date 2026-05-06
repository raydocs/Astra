;(function(){
const {
  AstraMark, AstraWordmark,
  IconCheck, IconClose, IconArrowRight, IconChevronRight, IconClock,
  IconBook, IconSettings, IconSparkle,
  Card, Btn, Pill, Toggle, Divider,
} = window;

/* ====================================================================
   12. Sync status & conflict · 13. Theme switcher · 14. Focus mode
   ==================================================================== */

const Device = ({ name, kind, status, last, conflicts }) => (
  <div style={{
    padding: "14px 16px", background: "var(--bg-surface)",
    border: "1px solid var(--line-1)", borderRadius: 8,
    display: "grid", gridTemplateColumns: "32px 1fr auto", gap: 12, alignItems: "center",
  }}>
    <span style={{
      width: 32, height: 32, borderRadius: 6,
      background: "var(--bg-sunken)", border: "1px solid var(--line-1)",
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      fontFamily: "var(--font-serif)", fontSize: 14, color: "var(--ink-2)",
    }}>{kind}</span>
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: 14, color: "var(--ink-1)", fontWeight: 500 }}>{name}</span>
        {conflicts ? <Pill tone="warn">{conflicts} conflicts</Pill> : null}
      </div>
      <div style={{ fontSize: 12, color: "var(--ink-3)", fontStyle: "italic", marginTop: 1, fontFamily: "var(--font-serif)" }}>
        {status} · {last}
      </div>
    </div>
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: conflicts ? "var(--warn)" : "var(--ok)", fontFamily: "var(--font-sans)" }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: conflicts ? "var(--warn)" : "var(--ok)" }} />
      {conflicts ? "review" : "in sync"}
    </span>
  </div>
);

const SyncFrame = ({ direction = "quiet" }) => (
  <div data-astra={direction} className="astra-frame astra-root" style={{
    width: "100%", height: "100%", background: "var(--bg-page)",
    padding: "44px 60px", boxSizing: "border-box", overflow: "hidden",
    display: "grid", gridTemplateColumns: "1fr 1fr", gap: 36,
  }}>
    <div>
      <div className="eyebrow">Sync</div>
      <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 36, fontWeight: 400, letterSpacing: "-0.025em", lineHeight: 1.1, margin: "8px 0 4px" }}>
        Three devices, one library.
      </h1>
      <p style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 15, color: "var(--ink-3)", margin: "4px 0 24px" }}>
        Astra reconciles every 30 seconds. You'll only see this page when something needs your eye.
      </p>

      <div style={{ display: "grid", gap: 8 }}>
        <Device name="MacBook Pro · Chrome" kind="MB" status="Last write 2 min ago" last="34 words synced today" />
        <Device name="iPhone · Safari" kind="iP" status="Last write 18 min ago" last="3 words saved on the train" conflicts={2} />
        <Device name="iPad · Safari" kind="iP" status="Idle since Apr 28" last="library 6 days behind" />
      </div>

      <div style={{ marginTop: 20, display: "flex", gap: 10, alignItems: "center" }}>
        <Btn variant="ghost" size="md">Force resync</Btn>
        <Btn variant="quiet" size="md">Sign out everywhere</Btn>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: "var(--ink-3)", fontStyle: "italic", fontFamily: "var(--font-serif)" }}>
          End-to-end encrypted · keys never leave your devices
        </span>
      </div>
    </div>

    {/* Conflict resolver */}
    <div>
      <div className="eyebrow">Resolve · 2 conflicts</div>
      <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 400, letterSpacing: "-0.015em", margin: "8px 0 16px" }}>
        Same word, different glosses.
      </h2>

      {[
        {
          word: "taciturn",
          left: { src: "MacBook · 2 days ago", gloss: "沉默寡言的", note: "from a profile of a chess player" },
          right: { src: "iPhone · 18 min ago", gloss: "不爱说话的；寡言的", note: "" },
        },
        {
          word: "marginalia",
          left: { src: "MacBook · 4 hours ago", gloss: "页边注释", note: "" },
          right: { src: "iPhone · 18 min ago", gloss: "页边的笔记 / 边注", note: "edited on the train" },
        },
      ].map((c, i) => (
        <div key={c.word} style={{
          marginBottom: 12, padding: 14,
          background: "var(--bg-surface)", border: "1px solid var(--line-1)",
          borderRadius: 8,
        }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
            <span style={{ fontFamily: "var(--font-serif)", fontSize: 22, color: "var(--ink-1)" }}>{c.word}</span>
            <span style={{ flex: 1 }} />
            <Pill tone="warn">conflict</Pill>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[c.left, c.right].map((side, j) => (
              <button key={j} style={{
                textAlign: "left", padding: 12, borderRadius: 6, cursor: "pointer",
                background: j === 1 ? "var(--accent-soft)" : "var(--bg-elevated)",
                border: `1px solid ${j === 1 ? "var(--accent-line)" : "var(--line-1)"}`,
              }}>
                <div className="eyebrow" style={{ marginBottom: 4 }}>{side.src}</div>
                <div style={{ fontFamily: "var(--font-serif)", fontSize: 15, color: "var(--ink-1)" }}>{side.gloss}</div>
                {side.note ? (
                  <div style={{ fontSize: 11, color: "var(--ink-3)", fontStyle: "italic", marginTop: 4, fontFamily: "var(--font-serif)" }}>{side.note}</div>
                ) : null}
              </button>
            ))}
          </div>
          <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
            <Btn size="sm" variant="primary">Keep iPhone</Btn>
            <Btn size="sm" variant="ghost">Keep MacBook</Btn>
            <Btn size="sm" variant="quiet">Merge both</Btn>
          </div>
        </div>
      ))}
    </div>
  </div>
);

/* =============== THEME SWITCHER ================ */

const ThemeFrame = ({ direction = "quiet" }) => (
  <div data-astra={direction} className="astra-frame astra-root" style={{
    width: "100%", height: "100%", background: "var(--bg-page)",
    padding: "44px 60px", boxSizing: "border-box", overflow: "hidden",
  }}>
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <div className="eyebrow">Settings · Appearance</div>
      <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 36, fontWeight: 400, letterSpacing: "-0.025em", lineHeight: 1.1, margin: "8px 0 4px" }}>
        Two skies.
      </h1>
      <p style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 16, color: "var(--ink-3)", margin: "4px 0 28px" }}>
        Quiet Reader by day, Constellation at night. Or pick one and stay.
      </p>

      <div className="eyebrow" style={{ marginBottom: 10 }}>Theme</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        {[
          { n: "Quiet Reader", s: "Warm paper · ink", swatch: ["#f4efe6","#fbf8f1","#1a1612","#1f4e7a"], sel: false },
          { n: "Constellation", s: "Twilight · star-gold", swatch: ["#0d1220","#141a2c","#f2efe6","#e5c98a"], sel: false },
          { n: "Auto", s: "Follow time of day", swatch: ["#f4efe6","#0d1220","#1a1612","#e5c98a"], sel: true },
        ].map(t => (
          <div key={t.n} style={{
            padding: 0,
            background: t.sel ? "var(--accent-soft)" : "var(--bg-surface)",
            border: `1px solid ${t.sel ? "var(--accent-line)" : "var(--line-1)"}`,
            borderRadius: 10, overflow: "hidden", cursor: "pointer",
          }}>
            <div style={{ display: "flex", height: 90 }}>
              {t.swatch.map((c, i) => (
                <span key={i} style={{ flex: 1, background: c }} />
              ))}
            </div>
            <div style={{ padding: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{
                  width: 14, height: 14, borderRadius: "50%",
                  border: "1.5px solid " + (t.sel ? "var(--accent)" : "var(--line-2)"),
                  background: t.sel ? "var(--accent)" : "transparent",
                }} />
                <span style={{ fontFamily: "var(--font-serif)", fontSize: 17, color: "var(--ink-1)" }}>{t.n}</span>
              </div>
              <div style={{ fontSize: 12, color: "var(--ink-3)", fontStyle: "italic", marginTop: 4, fontFamily: "var(--font-serif)" }}>{t.s}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 28, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card padded={false} style={{ overflow: "hidden" }}>
          {[
            ["Switch at sunset", "Geo-aware · uses your timezone", <Toggle on />],
            ["Adapt to host page", "Match site's dark/light mode automatically", <Toggle on={false} />],
            ["Reduce motion", "Skip the cross-fade between states", <Toggle on={false} />],
          ].map(([t, s, ctrl], i, arr) => (
            <div key={t} style={{
              display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
              borderBottom: i < arr.length - 1 ? "1px solid var(--line-1)" : "none",
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, color: "var(--ink-1)", fontWeight: 500 }}>{t}</div>
                <div style={{ fontSize: 12, color: "var(--ink-3)", fontStyle: "italic", marginTop: 1, fontFamily: "var(--font-serif)" }}>{s}</div>
              </div>
              {ctrl}
            </div>
          ))}
        </Card>

        <div style={{
          padding: 18, background: "var(--bg-surface)", border: "1px solid var(--line-1)", borderRadius: 10,
        }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Right now</div>
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <span style={{
              width: 64, height: 64, borderRadius: 10,
              background: "linear-gradient(135deg, #f4efe6 49%, #0d1220 51%)",
              border: "1px solid var(--line-1)",
            }} />
            <div>
              <div style={{ fontFamily: "var(--font-serif)", fontSize: 22, color: "var(--ink-1)" }}>
                Quiet Reader
              </div>
              <div style={{ fontSize: 13, color: "var(--ink-3)", fontStyle: "italic", marginTop: 2, fontFamily: "var(--font-serif)" }}>
                Switching to Constellation in 4 hr 12 min
              </div>
            </div>
          </div>
          <div style={{ marginTop: 12, height: 6, borderRadius: 3, background: "var(--bg-sunken)", overflow: "hidden", border: "1px solid var(--line-1)" }}>
            <span style={{ display: "block", width: "62%", height: "100%", background: "var(--accent)" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11, color: "var(--ink-3)", fontFamily: "var(--font-mono)" }}>
            <span>06:00 sunrise</span><span>now 14:48</span><span>19:00 sunset</span>
          </div>
        </div>
      </div>
    </div>
  </div>
);

/* =============== FOCUS MODE ================ */

const FocusFrame = ({ direction = "quiet" }) => (
  <div data-astra={direction} className="astra-frame astra-root" style={{
    width: "100%", height: "100%", background: "var(--bg-page)",
    position: "relative", overflow: "hidden",
  }}>
    {/* page chrome dimmed out */}
    <div style={{
      position: "absolute", inset: 0,
      display: "grid", gridTemplateColumns: "240px 1fr 240px", gap: 0,
    }}>
      <div style={{ background: "var(--bg-sunken)", padding: 20, opacity: 0.25 }}>
        {[1,1,0.9,0.7,1,0.8].map((w, i) => (
          <div key={i} style={{ height: 8, width: `${w * 100}%`, background: "var(--ink-2)", opacity: 0.5, borderRadius: 2, marginBottom: 12 }} />
        ))}
      </div>
      <div style={{ padding: "60px 80px", background: "var(--bg-page)", overflow: "hidden" }}>
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 38, fontWeight: 400, letterSpacing: "-0.02em", margin: 0, lineHeight: 1.15 }}>
          The Quiet Architecture of Reading
        </h1>
        <div style={{ marginTop: 6, fontFamily: "var(--font-serif)", fontStyle: "italic", color: "var(--ink-3)", fontSize: 15 }}>
          阅读的安静建筑
        </div>
        <div style={{ marginTop: 20, fontFamily: "var(--font-serif)", fontSize: 17, lineHeight: 1.7, color: "var(--ink-1)" }}>
          For most of human history, reading was a private architecture — a quiet
          room a person built between the lines on a page. The room held only the
          reader and the writer's voice, suspended for the duration of a sentence.
        </div>
        <div style={{ marginTop: 8, paddingLeft: 12, borderLeft: "2px solid var(--accent)", fontFamily: "var(--font-serif)", fontStyle: "italic", color: "var(--ink-2)", fontSize: 16, lineHeight: 1.55 }}>
          在人类历史的大部分时间里，阅读是一种私人的建筑——一个人在页面字里行间之中建起的安静房间。
        </div>
        <div style={{ marginTop: 18, fontFamily: "var(--font-serif)", fontSize: 17, lineHeight: 1.7, color: "var(--ink-1)" }}>
          Today, that quiet has competition. Sidebars buzz, pop-ups insist, headers
          shrink the column to a thin ribbon of text.
        </div>
      </div>
      <div style={{ background: "var(--bg-sunken)", padding: 20, opacity: 0.18 }}>
        {[1,0.8,1,0.6].map((w, i) => (
          <div key={i} style={{
            height: 80, width: "100%", background: "var(--ink-2)", opacity: 0.4,
            borderRadius: 4, marginBottom: 12,
          }} />
        ))}
      </div>
    </div>

    {/* Vignette to make focus literal */}
    <div style={{
      position: "absolute", inset: 0,
      background: "radial-gradient(ellipse at center, transparent 30%, var(--bg-page) 78%)",
      pointerEvents: "none",
    }} />

    {/* Focus pill */}
    <div style={{
      position: "absolute", bottom: 26, left: "50%", transform: "translateX(-50%)",
      display: "inline-flex", alignItems: "center", gap: 12,
      padding: "10px 14px",
      background: "var(--bg-elevated)", border: "1px solid var(--line-1)",
      borderRadius: 999, boxShadow: "var(--shadow-md)",
      fontFamily: "var(--font-sans)", fontSize: 13,
    }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--ink-2)" }}>
        <AstraMark size={13} /> Focus on the article
      </span>
      <span style={{ width: 1, height: 14, background: "var(--line-1)" }} />
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--ink-3)", fontFamily: "var(--font-serif)", fontStyle: "italic" }}>
        <IconClock size={12} /> 11:42 left in this read
      </span>
      <span style={{ width: 1, height: 14, background: "var(--line-1)" }} />
      <Btn size="sm" variant="quiet">Show full page</Btn>
      <Btn size="sm" variant="ghost">Done</Btn>
    </div>
  </div>
);

Object.assign(window, { SyncFrame, ThemeFrame, FocusFrame });
})();
