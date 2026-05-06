;(function(){
const {
  AstraMark, AstraWordmark,
  IconLanguages, IconBook, IconBookmark, IconArrowRight, IconCheck, IconClose,
  IconSettings, IconGlobe, IconList, IconChevronRight, IconChevronDown,
  IconClock, IconHighlighter, IconDot, IconSearch, IconSparkle, IconArrowUpRight,
  IconStar, IconFlame,
  Card, Btn, Pill, Toggle, Divider,
} = window;

/* ====================================================================
   4 · EMPTY / FIRST-RUN STATES — popup view immediately after onboarding,
       with no saved words. Uses the same 380×620 popup chrome but the
       library/today area is replaced by a quiet welcome.
   ==================================================================== */

const EmptyPopupFrame = ({ direction = "quiet" }) => (
  <div data-astra={direction} className="astra-frame astra-root" style={{
    width: 380, height: 620, background: "var(--bg-page)",
    borderRadius: 16, overflow: "hidden",
    border: "1px solid var(--line-1)", boxShadow: "var(--shadow-lg)",
    display: "flex", flexDirection: "column",
  }}>
    <div style={{
      padding: "14px 18px", display: "flex", alignItems: "center", gap: 10,
      borderBottom: "1px solid var(--line-1)", background: "var(--bg-surface)",
    }}>
      <AstraWordmark size={18} />
      <span style={{ flex: 1 }} />
      <Btn variant="quiet" size="sm" style={{ padding: 6 }}><IconSettings size={14} /></Btn>
    </div>

    <div style={{ padding: "20px 20px 4px" }}>
      <span className="eyebrow" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <IconGlobe size={10} />
        newyorker.com · 12 min read
      </span>
      <h2 className="serif" style={{
        fontSize: 26, lineHeight: 1.15, margin: "10px 0 0",
        letterSpacing: "-0.02em", color: "var(--ink-1)", fontWeight: 400,
      }}>Why Solitude Is Important for Reading</h2>
    </div>

    <div style={{ padding: "16px 20px 0" }}>
      <Btn variant="primary" size="lg"
        icon={<IconLanguages size={14} stroke={2} />}
        iconRight={<IconArrowRight size={14} stroke={2} />}
        style={{ width: "100%", justifyContent: "space-between", padding: "13px 18px" }}>
        <span style={{ flex: 1, textAlign: "left", marginLeft: 8 }}>Translate this page</span>
      </Btn>
    </div>

    <div style={{ flex: 1, padding: "28px 24px 20px",
      display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div style={{
        background: "var(--bg-surface)",
        border: "1px dashed var(--line-2)",
        borderRadius: 12, padding: "20px 18px",
        textAlign: "left", position: "relative",
      }}>
        <AstraMark size={18} stroke={1.4} style={{ color: "var(--ink-3)" }} />
        <div className="serif" style={{
          fontFamily: "var(--font-serif)", fontSize: 18,
          lineHeight: 1.4, color: "var(--ink-1)", marginTop: 10,
          letterSpacing: "-0.01em",
        }}>Your library starts empty.</div>
        <div className="serif" style={{
          fontFamily: "var(--font-serif)", fontStyle: "italic",
          fontSize: 14, color: "var(--ink-2)", lineHeight: 1.55,
          marginTop: 6,
        }}>
          Hover any word in a translated page and press <span style={{
            fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-1)",
          }}>⌥S</span> to keep it. Astra will quietly bring it back later.
        </div>
        <div style={{
          marginTop: 14, display: "flex", alignItems: "center", gap: 8,
          paddingTop: 12, borderTop: "1px solid var(--line-1)",
        }}>
          <Btn variant="ghost" size="sm" icon={<IconBook size={12} />}>How it works</Btn>
          <span style={{ flex: 1 }} />
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: 10,
            color: "var(--ink-4)",
          }}>0 saved · 0 due</span>
        </div>
      </div>
    </div>
  </div>
);

/* ====================================================================
   5 · LIBRARY / HISTORY VIEW
   Sidebar by source · main list of saved words with sparkline + sentence
   preview · right-side reading history timeline.
   ==================================================================== */

const LibFilter = ({ icon, label, count, sel }) => (
  <div style={{
    display: "flex", alignItems: "center", gap: 10,
    padding: "8px 12px", borderRadius: 6,
    background: sel ? "var(--bg-sunken)" : "transparent",
    border: sel ? "1px solid var(--line-1)" : "1px solid transparent",
    cursor: "pointer",
  }}>
    <span style={{ color: "var(--ink-2)" }}>{icon}</span>
    <span style={{
      fontFamily: "var(--font-sans)", fontSize: 13,
      color: "var(--ink-1)", flex: 1, fontWeight: sel ? 500 : 400,
    }}>{label}</span>
    {count != null ? (
      <span style={{
        fontFamily: "var(--font-mono)", fontSize: 11,
        color: "var(--ink-3)",
      }}>{count}</span>
    ) : null}
  </div>
);

const Sparkline = ({ values, w = 64, h = 18 }) => {
  const max = Math.max(...values, 1);
  const min = 0;
  const path = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / (max - min)) * h;
    return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <path d={path} fill="none" stroke="var(--accent)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

const LibraryFrame = ({ direction = "quiet" }) => (
  <div data-astra={direction} className="astra-frame astra-root" style={{
    width: 1280, height: 900, background: "var(--bg-page)",
    color: "var(--ink-1)", display: "grid",
    gridTemplateColumns: "240px 1fr 320px",
  }}>
    {/* sidebar */}
    <aside style={{
      borderRight: "1px solid var(--line-1)",
      padding: "20px 14px", background: "var(--bg-surface)",
      display: "flex", flexDirection: "column", gap: 4,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 6px 14px" }}>
        <AstraWordmark size={17} />
      </div>

      <div className="eyebrow" style={{ padding: "8px 10px 4px" }}>Words</div>
      <LibFilter icon={<IconBookmark size={13} />} label="All saved" count="248" sel />
      <LibFilter icon={<IconClock size={13} />} label="Due today" count="4" />
      <LibFilter icon={<IconStar size={13} />} label="Recurring" count="32" />
      <LibFilter icon={<IconCheck size={13} />} label="Mastered" count="61" />

      <div className="eyebrow" style={{ padding: "16px 10px 4px" }}>By source</div>
      <LibFilter icon={<IconGlobe size={13} />} label="The New Yorker" count="48" />
      <LibFilter icon={<IconGlobe size={13} />} label="The Atlantic" count="29" />
      <LibFilter icon={<IconGlobe size={13} />} label="Substack" count="18" />
      <LibFilter icon={<IconGlobe size={13} />} label="Other" count="153" />

      <div className="eyebrow" style={{ padding: "16px 10px 4px" }}>Pages</div>
      <LibFilter icon={<IconBook size={13} />} label="Reading history" count="62" />
      <LibFilter icon={<IconHighlighter size={13} />} label="Highlights" count="91" />
    </aside>

    {/* main list */}
    <section style={{
      display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "20px 28px 14px",
        borderBottom: "1px solid var(--line-1)",
      }}>
        <h1 className="serif" style={{
          fontFamily: "var(--font-serif)", fontSize: 28,
          letterSpacing: "-0.02em", margin: 0, fontWeight: 500,
          color: "var(--ink-1)", flex: 1,
        }}>All saved <span style={{ color: "var(--ink-3)", fontStyle: "italic" }}>· 248</span></h1>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "8px 12px", background: "var(--bg-surface)",
          border: "1px solid var(--line-1)", borderRadius: 8, minWidth: 240,
        }}>
          <IconSearch size={13} style={{ color: "var(--ink-3)" }} />
          <span style={{
            fontFamily: "var(--font-serif)", fontStyle: "italic",
            fontSize: 14, color: "var(--ink-3)",
          }}>Search words & sentences</span>
        </div>
        <Btn variant="ghost" size="md" icon={<IconChevronDown size={13} />}>Recent</Btn>
      </div>

      <div style={{ overflow: "auto", flex: 1 }}>
        {[
          { w: "solitude", g: "独处；离群索居", src: "The New Yorker · The Quiet Year of Solitude", days: 7, due: "in 3d", spark: [1,3,2,4,3,5,4], pos: "n.", strength: 3 },
          { w: "unalterable", g: "无法改变的", src: "The New Yorker · The Quiet Year of Solitude", days: 7, due: "due today", spark: [1,2,1,2,3,2,3], pos: "adj.", strength: 2, dueNow: true },
          { w: "marginalia", g: "页边批注；旁注", src: "The Atlantic · On the Pleasure of Notes", days: 14, due: "in 9d", spark: [1,1,2,2,3,3,4], pos: "n.", strength: 4 },
          { w: "reverie", g: "出神；遐想", src: "Personal note", days: 21, due: "in 12d", spark: [2,3,3,4,3,4,4], pos: "n.", strength: 4 },
          { w: "hush", g: "近乎屏息的安静", src: "The New Yorker · The Quiet Year of Solitude", days: 7, due: "due today", spark: [1,1,2,1,2,2,2], pos: "n.", strength: 1, dueNow: true },
          { w: "obstinate", g: "固执的；顽固的", src: "The Paris Review", days: 32, due: "mastered", spark: [3,4,4,5,5,5,5], pos: "adj.", strength: 5, mastered: true },
        ].map((row, i, arr) => (
          <div key={row.w} style={{
            display: "grid",
            gridTemplateColumns: "180px 1fr 110px 80px 60px",
            alignItems: "center", gap: 18,
            padding: "16px 28px",
            borderBottom: i === arr.length - 1 ? "none" : "1px solid var(--line-1)",
            cursor: "pointer",
          }}>
            <div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <span className="serif" style={{
                  fontFamily: "var(--font-serif)", fontSize: 22,
                  color: "var(--ink-1)", letterSpacing: "-0.012em",
                }}>{row.w}</span>
                <span style={{
                  fontFamily: "var(--font-mono)", fontSize: 10,
                  color: "var(--ink-4)",
                }}>{row.pos}</span>
              </div>
              <div className="serif" style={{
                fontFamily: "var(--font-serif)", fontStyle: "italic",
                fontSize: 14, color: "var(--ink-2)", marginTop: 2,
              }}>{row.g}</div>
            </div>
            <div>
              <div className="eyebrow" style={{ marginBottom: 4 }}>{row.src}</div>
              <div className="serif" style={{
                fontFamily: "var(--font-serif)", fontSize: 14,
                color: "var(--ink-2)", lineHeight: 1.5,
                display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden",
              }}>
                {row.w === "solitude" && "Solitude is not the same as isolation. To read deeply requires…"}
                {row.w === "unalterable" && "an unalterable hush before a real thought arrives."}
                {row.w === "marginalia" && "her marginalia, written sideways in the slimmest pencil…"}
                {row.w === "reverie" && "He fell into a reverie of small, exact things."}
                {row.w === "hush" && "the unalterable hush before a real thought arrives."}
                {row.w === "obstinate" && "an obstinate refusal of the modern, soft-edged world."}
              </div>
            </div>
            <div>
              <Sparkline values={row.spark} />
              <div style={{
                fontFamily: "var(--font-mono)", fontSize: 10,
                color: "var(--ink-4)", marginTop: 2,
              }}>last 7 reviews</div>
            </div>
            <div>
              {row.mastered ? (
                <Pill tone="ok"><IconCheck size={10} /> Mastered</Pill>
              ) : row.dueNow ? (
                <Pill tone="accent"><IconClock size={10} /> Due</Pill>
              ) : (
                <span style={{
                  fontFamily: "var(--font-serif)", fontStyle: "italic",
                  fontSize: 13, color: "var(--ink-3)",
                }}>{row.due}</span>
              )}
            </div>
            <div style={{
              fontFamily: "var(--font-mono)", fontSize: 11,
              color: "var(--ink-4)", textAlign: "right",
            }}>{row.days}d ago</div>
          </div>
        ))}
      </div>
    </section>

    {/* right rail — reading timeline */}
    <aside style={{
      borderLeft: "1px solid var(--line-1)",
      padding: "20px 22px", background: "var(--bg-surface)",
      overflow: "auto",
    }}>
      <div className="eyebrow" style={{ marginBottom: 12 }}>This month</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
        <span className="serif" style={{
          fontFamily: "var(--font-serif)", fontSize: 44,
          letterSpacing: "-0.025em", lineHeight: 1, color: "var(--ink-1)",
        }}>23</span>
        <span style={{
          fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--ink-3)",
        }}>articles read</span>
      </div>
      <div className="serif" style={{
        fontFamily: "var(--font-serif)", fontStyle: "italic",
        fontSize: 13, color: "var(--ink-3)", marginBottom: 18,
      }}>62 saved words · 14 mastered</div>

      <div className="eyebrow" style={{ marginBottom: 8 }}>Recent reading</div>
      {[
        { t: "The Quiet Year of Solitude", s: "The New Yorker", d: "Today", w: 6 },
        { t: "Why I Still Carry a Notebook", s: "The Atlantic", d: "Yesterday", w: 3 },
        { t: "On Walking, Slowly", s: "The Paris Review", d: "Mar 18", w: 8 },
        { t: "The Last Bookshop on the Hill", s: "Substack", d: "Mar 14", w: 4 },
        { t: "Marginalia, Defended", s: "The New Yorker", d: "Mar 9", w: 5 },
      ].map((a, i, arr) => (
        <div key={i} style={{
          display: "grid", gridTemplateColumns: "auto 1fr",
          gap: 12, padding: "10px 0",
          borderBottom: i === arr.length - 1 ? "none" : "1px solid var(--line-1)",
        }}>
          <div style={{
            fontFamily: "var(--font-mono)", fontSize: 10,
            color: "var(--ink-4)", paddingTop: 3, letterSpacing: "0.04em",
          }}>{a.d.toUpperCase()}</div>
          <div>
            <div className="serif" style={{
              fontFamily: "var(--font-serif)", fontSize: 14,
              color: "var(--ink-1)", lineHeight: 1.35, fontWeight: 500,
              letterSpacing: "-0.005em",
            }}>{a.t}</div>
            <div style={{ display: "flex", gap: 8, marginTop: 3 }}>
              <span className="eyebrow">{a.s}</span>
              <span style={{
                fontFamily: "var(--font-mono)", fontSize: 10,
                color: "var(--ink-4)",
              }}>+{a.w}</span>
            </div>
          </div>
        </div>
      ))}
    </aside>
  </div>
);

/* ====================================================================
   6 · IN-CONTEXT PAGE TRANSLATION — overlay on the actual host page.
   The native HTML stays put. Translation appears as a slim inline block
   under each paragraph (bilingual mode), with the Astra signal: a left
   color rail + a tiny inline mark. Top of viewport: a quiet status bar.
   ==================================================================== */

const InContextFrame = ({ direction = "quiet" }) => (
  <div data-astra={direction} className="astra-frame" style={{
    width: 1280, height: 900, background: "var(--bg-page)",
    overflow: "hidden", position: "relative",
  }}>
    {/* status bar */}
    <div style={{
      position: "absolute", top: 16, left: "50%",
      transform: "translateX(-50%)",
      display: "inline-flex", alignItems: "center", gap: 10,
      padding: "7px 6px 7px 14px",
      background: "var(--bg-elevated)",
      border: "1px solid var(--line-1)",
      borderRadius: 999,
      boxShadow: "var(--shadow-md)",
      zIndex: 5, fontFamily: "var(--font-sans)",
    }}>
      <AstraMark size={12} stroke={1.6} />
      <span style={{
        fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--ink-2)",
      }}>Translated · <span style={{ color: "var(--ink-1)", fontWeight: 500 }}>Bilingual</span></span>
      <span style={{ width: 1, height: 14, background: "var(--line-2)" }} />
      <span style={{
        fontFamily: "var(--font-mono)", fontSize: 11,
        color: "var(--ink-3)",
      }}>347 / 412 ¶</span>
      <span style={{ width: 1, height: 14, background: "var(--line-2)" }} />
      <Btn variant="quiet" size="sm" style={{ padding: "3px 10px" }}>Original</Btn>
      <Btn variant="quiet" size="sm" style={{ padding: "3px 10px" }}>Settings</Btn>
      <Btn variant="quiet" size="sm" style={{ padding: 6 }}><IconClose size={12} /></Btn>
    </div>

    {/* page content */}
    <div style={{
      padding: "84px 0 0 0",
      maxWidth: 760, margin: "0 auto",
      fontFamily: "var(--font-serif)",
    }}>
      <div className="eyebrow" style={{ marginBottom: 8 }}>
        <IconGlobe size={10} style={{ marginRight: 6, verticalAlign: "-1px" }} />
        newyorker.com / culture
      </div>
      <h1 className="serif" style={{
        fontFamily: "var(--font-serif)", fontSize: 44,
        lineHeight: 1.05, letterSpacing: "-0.025em",
        margin: "8px 0 8px", color: "var(--ink-1)", fontWeight: 500,
      }}>The Quiet Year of <span style={{ fontStyle: "italic" }}>Solitude</span></h1>
      {/* translated H1 */}
      <div style={{
        display: "flex", gap: 12, marginBottom: 24,
      }}>
        <span style={{ width: 2, background: "var(--accent)", borderRadius: 1 }} />
        <div className="serif" style={{
          fontFamily: "var(--font-serif)", fontStyle: "italic",
          fontSize: 24, color: "var(--ink-2)", letterSpacing: "-0.012em",
          lineHeight: 1.25,
        }}>《独处之年》—— 一种安静的回归</div>
      </div>

      {[
        {
          en: "Solitude is not the same as isolation. To read deeply requires a kind of inward weather — an unalterable hush before a real thought arrives.",
          zh: "独处与孤立不同。深度阅读需要一种内在的气候——在真正的思考来临之前，那种无法被打扰的安静。",
        },
        {
          en: "We have, almost without noticing, traded the slow pleasure of a paragraph for the quick relief of a notification. The result is a generation that has read more sentences than any before it, and finished fewer of them.",
          zh: "我们几乎在不知不觉中，把一整段文字带来的缓慢愉悦，换成了一条通知带来的短暂解脱。结果是：这一代人读过的句子比任何一代都多，而读完的句子比任何一代都少。",
        },
        {
          en: "What is needed is not more attention but a different kind — porous, unhurried, willing to misread once and try again.",
          zh: "我们需要的不是更多的专注，而是另一种专注——可以容纳走神、不慌不忙、允许第一次读错然后重读。",
        },
      ].map((p, i) => (
        <div key={i} style={{ marginBottom: 22 }}>
          <p className="serif" style={{
            fontFamily: "var(--font-serif)", fontSize: 18,
            lineHeight: 1.65, color: "var(--ink-1)", margin: 0,
          }}>{p.en}</p>
          <div style={{
            display: "flex", gap: 12, marginTop: 8,
            paddingTop: 4,
          }}>
            <span style={{
              width: 2, background: "var(--accent)", borderRadius: 1, flexShrink: 0,
            }} />
            <div>
              <div style={{
                display: "flex", alignItems: "center", gap: 6,
                marginBottom: 2,
              }}>
                <AstraMark size={9} stroke={1.6} style={{ color: "var(--ink-4)" }} />
                <span className="eyebrow" style={{ fontSize: 9, opacity: 0.7 }}>translation</span>
              </div>
              <p className="serif" style={{
                fontFamily: "var(--font-serif)", fontStyle: "italic",
                fontSize: 16, lineHeight: 1.65, color: "var(--ink-2)", margin: 0,
              }}>{p.zh}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

/* ====================================================================
   7 · ERROR STATES — three side-by-side cards in one frame:
   offline · quota reached · translation failed (per-paragraph). All use
   the existing Card primitive; no red banners or alarming UI.
   ==================================================================== */

const ErrorCard = ({ label, title, body, primary, secondary, icon }) => (
  <Card padded={false} style={{
    padding: "20px 22px", display: "flex", flexDirection: "column", gap: 10,
    minHeight: 280,
  }}>
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
    }}>
      <span style={{
        width: 28, height: 28, borderRadius: 6,
        background: "var(--bg-sunken)", border: "1px solid var(--line-1)",
        color: "var(--ink-2)",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
      }}>{icon}</span>
      <span className="eyebrow">{label}</span>
    </div>
    <div className="serif" style={{
      fontFamily: "var(--font-serif)", fontSize: 22,
      letterSpacing: "-0.012em", color: "var(--ink-1)", lineHeight: 1.3,
      fontWeight: 500,
    }}>{title}</div>
    <div className="serif" style={{
      fontFamily: "var(--font-serif)", fontStyle: "italic",
      fontSize: 14, color: "var(--ink-2)", lineHeight: 1.55, flex: 1,
    }}>{body}</div>
    <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
      <Btn variant="primary" size="sm">{primary}</Btn>
      <Btn variant="quiet" size="sm">{secondary}</Btn>
    </div>
  </Card>
);

const ErrorsFrame = ({ direction = "quiet" }) => (
  <div data-astra={direction} className="astra-frame astra-root" style={{
    width: 1280, height: 720, background: "var(--bg-page)",
    color: "var(--ink-1)", padding: "44px 48px",
    boxSizing: "border-box",
  }}>
    <div className="eyebrow" style={{ marginBottom: 8 }}>
      <AstraMark size={11} stroke={1.6} style={{ verticalAlign: "-1px", marginRight: 6 }} />
      Failure modes — quiet, never alarming
    </div>
    <h1 className="serif" style={{
      fontFamily: "var(--font-serif)", fontSize: 32,
      letterSpacing: "-0.022em", margin: "4px 0 6px", fontWeight: 500,
    }}>When something doesn't work</h1>
    <p className="serif" style={{
      fontFamily: "var(--font-serif)", fontStyle: "italic",
      fontSize: 16, color: "var(--ink-2)", lineHeight: 1.55,
      maxWidth: 620, margin: "0 0 28px",
    }}>
      Every error is told as a sentence, not a code. The original page is never overpainted with red.
    </p>

    <div style={{
      display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 18,
    }}>
      <ErrorCard
        icon={<IconGlobe size={13} />}
        label="Connection"
        title="You're offline."
        body="Astra needs the network to translate. Saved words and your library still work — they're stored on this device."
        primary="Retry"
        secondary="Open library"
      />
      <ErrorCard
        icon={<IconClock size={13} />}
        label="Daily limit"
        title="You've reached today's quota."
        body="Free accounts get 30 page translations a day. Hover-translate and saved words keep working. Your quota refills at midnight local time."
        primary="See plans"
        secondary="Maybe later"
      />
      <ErrorCard
        icon={<IconClose size={13} />}
        label="One paragraph failed"
        title="Astra couldn't translate ¶ 4."
        body="The rest of the page came through. You can retry just that paragraph, or read the original for now."
        primary="Retry paragraph"
        secondary="Skip"
      />
    </div>

    {/* inline failure preview */}
    <div className="eyebrow" style={{ marginTop: 36, marginBottom: 8 }}>How a single-paragraph failure looks in the page</div>
    <Card padded={false} style={{ padding: "20px 24px" }}>
      <p className="serif" style={{
        fontFamily: "var(--font-serif)", fontSize: 16,
        lineHeight: 1.65, color: "var(--ink-1)", margin: 0,
      }}>What is needed is not more attention but a different kind — porous, unhurried, willing to misread once and try again.</p>
      <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
        <span style={{ width: 2, background: "var(--ink-4)", borderRadius: 1, flexShrink: 0 }} />
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <span className="serif" style={{
            fontFamily: "var(--font-serif)", fontStyle: "italic",
            fontSize: 14, color: "var(--ink-3)",
          }}>Couldn't translate this paragraph.</span>
          <Btn variant="quiet" size="sm" style={{ padding: "2px 8px" }}>Retry</Btn>
        </div>
      </div>
    </Card>
  </div>
);

Object.assign(window, {
  EmptyPopupFrame, LibraryFrame, InContextFrame, ErrorsFrame,
});
})();
