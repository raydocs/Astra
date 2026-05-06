;(function(){
const {
  AstraMark, AstraWordmark,
  IconLanguages, IconBook, IconBookmark, IconArrowRight, IconCheck, IconClose,
  IconSettings, IconGlobe, IconList, IconChevronRight, IconChevronDown,
  IconClock, IconHighlighter, IconDot, IconSearch, IconSparkle, IconArrowUpRight,
  IconStar, IconFlame, IconPlay, IconPause,
  Card, Btn, Pill, Toggle, Divider,
} = window;

/* ====================================================================
   2 · WORD DETAIL — full page after tapping a saved word
   Header with the word + actions; 2-col body; right column for review
   history + related words; bottom is a sentence bank from where the user
   actually encountered the word.
   ==================================================================== */

const Tab = ({ label, sel, hint }) => (
  <div style={{
    padding: "8px 14px",
    borderBottom: sel ? "2px solid var(--ink-1)" : "2px solid transparent",
    color: sel ? "var(--ink-1)" : "var(--ink-3)",
    fontFamily: "var(--font-sans)", fontSize: 13,
    fontWeight: sel ? 500 : 400,
    cursor: "pointer", display: "inline-flex", gap: 6, alignItems: "baseline",
  }}>
    {label}
    {hint != null ? (
      <span style={{
        fontFamily: "var(--font-mono)", fontSize: 11,
        color: "var(--ink-4)",
      }}>{hint}</span>
    ) : null}
  </div>
);

const Strength = ({ level = 3 }) => (
  <div style={{ display: "inline-flex", gap: 3 }}>
    {[1,2,3,4,5].map(i => (
      <span key={i} style={{
        width: 14, height: 4, borderRadius: 1,
        background: i <= level ? "var(--accent)" : "var(--line-2)",
      }} />
    ))}
  </div>
);

const HistoryDot = ({ outcome = "good", day }) => {
  const c = outcome === "good" ? "var(--ok)" : outcome === "skip" ? "var(--ink-4)" : "var(--danger)";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <span style={{
        width: 10, height: 10, borderRadius: 99,
        background: c, opacity: 0.85,
      }} />
      <span style={{
        fontFamily: "var(--font-mono)", fontSize: 9,
        color: "var(--ink-4)", letterSpacing: "0.03em",
      }}>{day}</span>
    </div>
  );
};

const WordDetailFrame = ({ direction = "quiet" }) => (
  <div data-astra={direction} className="astra-frame astra-root" style={{
    width: 1280, height: 900, background: "var(--bg-page)",
    color: "var(--ink-1)", display: "flex", flexDirection: "column",
  }}>
    {/* top bar */}
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "16px 32px", borderBottom: "1px solid var(--line-1)",
      background: "var(--bg-surface)",
    }}>
      <Btn variant="quiet" size="sm" icon={<IconChevronRight size={13} style={{ transform: "rotate(180deg)" }} />}>
        Library
      </Btn>
      <span style={{ flex: 1 }} />
      <Btn variant="quiet" size="sm" icon={<IconBookmark size={13} />}>Saved</Btn>
      <Btn variant="ghost" size="sm" icon={<IconArrowUpRight size={13} />}>Open source</Btn>
      <Btn variant="primary" size="sm" icon={<IconClock size={13} />}>Review now</Btn>
    </div>

    {/* hero */}
    <div style={{ padding: "36px 48px 18px" }}>
      <div className="eyebrow" style={{ marginBottom: 8 }}>
        <IconBookmark size={10} style={{ marginRight: 6, verticalAlign: "-1px" }} />
        Saved March 14 · from The New Yorker
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 18, flexWrap: "wrap" }}>
        <h1 className="serif" style={{
          fontFamily: "var(--font-serif)", fontSize: 72,
          lineHeight: 1, letterSpacing: "-0.025em",
          margin: 0, color: "var(--ink-1)", fontWeight: 500,
        }}>solitude</h1>
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: 14,
          color: "var(--ink-3)",
        }}>ˈsɒl.ɪ.tjuːd</span>
        <Pill>noun</Pill>
        <Pill tone="accent"><IconStar size={10} /> Recurring</Pill>
        <span style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="eyebrow">Mastery</span>
          <Strength level={3} />
        </div>
      </div>
      <div className="serif" style={{
        fontFamily: "var(--font-serif)", fontSize: 24,
        fontStyle: "italic", color: "var(--ink-2)",
        marginTop: 12, letterSpacing: "-0.005em",
      }}>独处；离群索居的状态</div>
    </div>

    {/* tabs */}
    <div style={{
      padding: "0 48px",
      borderBottom: "1px solid var(--line-1)",
      display: "flex", gap: 4,
    }}>
      <Tab label="Definition" sel />
      <Tab label="In context" hint="6" />
      <Tab label="Related" hint="11" />
      <Tab label="History" />
    </div>

    {/* body — 2 cols */}
    <div style={{
      flex: 1, display: "grid", gridTemplateColumns: "1fr 360px", gap: 32,
      padding: "28px 48px 32px", overflow: "hidden",
    }}>
      {/* left: definitions + sentences */}
      <div style={{ overflow: "auto", paddingRight: 12 }}>
        <div className="eyebrow" style={{ marginBottom: 10 }}>Sense 1 · core</div>
        <div className="serif" style={{
          fontFamily: "var(--font-serif)", fontSize: 22,
          lineHeight: 1.45, color: "var(--ink-1)",
          letterSpacing: "-0.01em", marginBottom: 6,
        }}>
          The state or situation of being alone — chosen, not imposed.
        </div>
        <div className="serif" style={{
          fontFamily: "var(--font-serif)", fontStyle: "italic",
          fontSize: 18, color: "var(--ink-2)", lineHeight: 1.55,
        }}>
          一个人独处的状态——是自己选择的，而非被迫的。
        </div>

        <div style={{
          marginTop: 18, padding: "14px 16px",
          background: "var(--bg-surface)", border: "1px solid var(--line-1)",
          borderRadius: 10,
        }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>
            <AstraMark size={10} stroke={1.6} style={{ verticalAlign: "-1px", marginRight: 6 }} />
            How it differs from <em>isolation</em>
          </div>
          <div className="serif" style={{
            fontFamily: "var(--font-serif)", fontStyle: "italic",
            fontSize: 15, color: "var(--ink-2)", lineHeight: 1.55,
          }}>
            <em style={{ fontStyle: "normal", color: "var(--ink-1)" }}>Solitude</em> is voluntary stillness; <em style={{ fontStyle: "normal", color: "var(--ink-1)" }}>isolation</em> is involuntary cutoff. The same room, two different inner weathers.
          </div>
        </div>

        <div className="eyebrow" style={{ marginTop: 28, marginBottom: 12 }}>Where you met it</div>
        {[
          {
            src: "The New Yorker · The Quiet Year of Solitude",
            day: "Mar 14",
            en: "Solitude is not the same as isolation. To read deeply requires a kind of inward weather.",
            zh: "独处与孤立不同。深度阅读需要一种内在的气候。",
          },
          {
            src: "The Atlantic · On Walking",
            day: "Feb 28",
            en: "She kept her solitude the way other people kept dogs — for the company of it.",
            zh: "她守着自己的独处，就像别人养狗——为了那份相伴。",
          },
          {
            src: "Personal note",
            day: "Feb 12",
            en: "What I want, I think, is enforced solitude.",
            zh: "我想要的，大概是某种被强加的独处。",
          },
        ].map((s, i) => (
          <div key={i} style={{
            padding: "14px 0",
            borderBottom: i === 2 ? "none" : "1px solid var(--line-1)",
            display: "grid", gridTemplateColumns: "60px 1fr",
            gap: 18,
          }}>
            <div style={{
              fontFamily: "var(--font-mono)", fontSize: 11,
              color: "var(--ink-4)", paddingTop: 4,
              letterSpacing: "0.04em",
            }}>{s.day.toUpperCase()}</div>
            <div>
              <div className="eyebrow" style={{ marginBottom: 6 }}>{s.src}</div>
              <div className="serif" style={{
                fontFamily: "var(--font-serif)", fontSize: 17,
                lineHeight: 1.6, color: "var(--ink-1)", marginBottom: 4,
              }}>
                {s.en.split(/(solitude)/i).map((part, j) =>
                  /solitude/i.test(part) ? (
                    <span key={j} style={{
                      borderBottom: "1.5px solid var(--hl)",
                      paddingBottom: 1,
                    }}>{part}</span>
                  ) : <React.Fragment key={j}>{part}</React.Fragment>
                )}
              </div>
              <div className="serif" style={{
                fontFamily: "var(--font-serif)", fontSize: 14,
                fontStyle: "italic", color: "var(--ink-3)", lineHeight: 1.55,
              }}>{s.zh}</div>
            </div>
          </div>
        ))}
      </div>

      {/* right: SRS sidebar */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16, overflow: "auto" }}>
        <Card>
          <div className="eyebrow" style={{ marginBottom: 12 }}>Spaced review</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
            <span className="serif" style={{
              fontFamily: "var(--font-serif)", fontSize: 36,
              letterSpacing: "-0.025em", color: "var(--ink-1)",
              lineHeight: 1.05,
            }}>3</span>
            <span style={{
              fontFamily: "var(--font-sans)", fontSize: 13,
              color: "var(--ink-3)",
            }}>days until next review</span>
          </div>
          <div className="serif" style={{
            fontFamily: "var(--font-serif)", fontStyle: "italic",
            fontSize: 13, color: "var(--ink-3)",
          }}>Recalled correctly 6 of 8 times.</div>

          <div style={{ marginTop: 14, marginBottom: 6 }} className="eyebrow">Recent sessions</div>
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            {["Mar 2","Mar 5","Mar 9","Mar 13","Mar 14","Mar 17","Mar 21"].map((d, i) => (
              <HistoryDot key={d} day={d.split(" ")[1]} outcome={
                i === 1 || i === 3 ? "miss" : i === 5 ? "skip" : "good"
              } />
            ))}
          </div>
        </Card>

        <Card>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Related</div>
          {[
            { w: "isolation", g: "被动的孤立", saved: true },
            { w: "stillness", g: "静止；安宁", saved: false },
            { w: "hush", g: "屏息般的安静", saved: true },
            { w: "reverie", g: "出神；遐想", saved: false },
          ].map((r, i) => (
            <div key={r.w} style={{
              display: "flex", alignItems: "baseline", gap: 10,
              padding: "8px 0",
              borderBottom: i === 3 ? "none" : "1px solid var(--line-1)",
              cursor: "pointer",
            }}>
              <span className="serif" style={{
                fontFamily: "var(--font-serif)", fontSize: 16,
                color: "var(--ink-1)", minWidth: 84,
              }}>{r.w}</span>
              <span className="serif" style={{
                fontFamily: "var(--font-serif)", fontStyle: "italic",
                fontSize: 13, color: "var(--ink-3)", flex: 1,
              }}>{r.g}</span>
              {r.saved ? <IconBookmark size={11} style={{ color: "var(--ink-3)" }} /> : (
                <span style={{
                  fontFamily: "var(--font-mono)", fontSize: 10,
                  color: "var(--ink-4)",
                }}>+ Save</span>
              )}
            </div>
          ))}
        </Card>

        <Card>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Etymology</div>
          <div className="serif" style={{
            fontFamily: "var(--font-serif)", fontSize: 14,
            color: "var(--ink-2)", lineHeight: 1.55,
          }}>
            From Latin <em>solitudo</em>, “loneliness,” from <em>solus</em>, “alone.” In English from c.1300; in modern usage shifted from sad to chosen.
          </div>
        </Card>
      </div>
    </div>
  </div>
);

/* ====================================================================
   3 · REVIEW / SRS SESSION
   A focused, almost-empty surface. Question front, answer reveal, then
   four difficulty buttons. Subtle progress meter at top, no streak math.
   ==================================================================== */

const ReviewFrame = ({ direction = "quiet", revealed = true }) => (
  <div data-astra={direction} className="astra-frame astra-root" style={{
    width: 1280, height: 900, background: "var(--bg-page)",
    color: "var(--ink-1)", display: "flex", flexDirection: "column",
  }}>
    {/* progress bar */}
    <div style={{
      display: "flex", alignItems: "center", gap: 16,
      padding: "20px 36px", borderBottom: "1px solid var(--line-1)",
    }}>
      <AstraMark size={14} stroke={1.5} />
      <span className="eyebrow">Review · Mar 21</span>
      <span style={{
        flex: 1, height: 2, background: "var(--bg-sunken)",
        position: "relative", borderRadius: 2,
      }}>
        <span style={{
          position: "absolute", top: 0, left: 0, height: "100%",
          width: "60%", background: "var(--ink-1)", borderRadius: 2,
        }} />
      </span>
      <span style={{
        fontFamily: "var(--font-mono)", fontSize: 12,
        color: "var(--ink-3)",
      }}>3 / 5</span>
      <Btn variant="quiet" size="sm" icon={<IconClose size={13} />}>End session</Btn>
    </div>

    {/* card stack */}
    <div style={{
      flex: 1, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "40px",
    }}>
      <div style={{
        width: 720, position: "relative",
      }}>
        {/* sentence card — context first */}
        <div style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--line-1)",
          borderRadius: 16,
          padding: "44px 48px 36px",
          boxShadow: "var(--shadow-sm)",
        }}>
          <div className="eyebrow" style={{ marginBottom: 16 }}>
            <IconGlobe size={10} style={{ marginRight: 6, verticalAlign: "-1px" }} />
            From The New Yorker · 7 days ago
          </div>
          <div className="serif" style={{
            fontFamily: "var(--font-serif)", fontSize: 28,
            lineHeight: 1.45, color: "var(--ink-1)",
            letterSpacing: "-0.012em", fontWeight: 400,
          }}>
            To read deeply requires a kind of inward weather — an{" "}
            <span style={{
              borderBottom: "2px solid var(--hl)",
              paddingBottom: 2,
              fontWeight: 500,
            }}>unalterable</span>{" "}
            hush before a real thought arrives.
          </div>

          {revealed ? (
            <>
              <div style={{ height: 1, background: "var(--line-1)", margin: "28px 0 22px" }} />
              <div className="eyebrow" style={{ marginBottom: 10 }}>Meaning</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 12 }}>
                <span className="serif" style={{
                  fontFamily: "var(--font-serif)", fontSize: 38,
                  letterSpacing: "-0.022em", color: "var(--ink-1)",
                }}>unalterable</span>
                <span style={{
                  fontFamily: "var(--font-mono)", fontSize: 13,
                  color: "var(--ink-3)",
                }}>ʌnˈɔːltərəbl</span>
                <Pill>adj.</Pill>
              </div>
              <div className="serif" style={{
                fontFamily: "var(--font-serif)", fontStyle: "italic",
                fontSize: 19, color: "var(--ink-2)", lineHeight: 1.55,
              }}>无法改变的；不可动摇的</div>
            </>
          ) : (
            <div style={{
              display: "flex", justifyContent: "center", marginTop: 32,
            }}>
              <Btn variant="ghost" size="lg">Show meaning</Btn>
            </div>
          )}
        </div>

        {/* difficulty buttons */}
        {revealed ? (
          <div style={{
            marginTop: 20, display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10,
          }}>
            {[
              { l: "Again", h: "<1 min", k: "1", c: "var(--danger)" },
              { l: "Hard", h: "2 days", k: "2", c: "var(--warn)" },
              { l: "Good", h: "5 days", k: "3", c: "var(--ok)" },
              { l: "Easy", h: "12 days", k: "4", c: "var(--accent)" },
            ].map(b => (
              <div key={b.l} style={{
                padding: "14px 16px",
                background: "var(--bg-surface)",
                border: "1px solid var(--line-1)",
                borderRadius: 10,
                cursor: "pointer", textAlign: "left",
                position: "relative", overflow: "hidden",
              }}>
                <span style={{
                  position: "absolute", left: 0, top: 0, bottom: 0,
                  width: 3, background: b.c,
                }} />
                <div style={{
                  display: "flex", alignItems: "baseline", gap: 8,
                  paddingLeft: 4,
                }}>
                  <span className="serif" style={{
                    fontFamily: "var(--font-serif)", fontSize: 18,
                    color: "var(--ink-1)", letterSpacing: "-0.01em",
                  }}>{b.l}</span>
                  <span style={{ flex: 1 }} />
                  <span style={{
                    fontFamily: "var(--font-mono)", fontSize: 11,
                    color: "var(--ink-3)",
                  }}>{b.k}</span>
                </div>
                <div className="serif" style={{
                  fontFamily: "var(--font-serif)", fontStyle: "italic",
                  fontSize: 13, color: "var(--ink-3)", marginTop: 2,
                  paddingLeft: 4,
                }}>next in {b.h}</div>
              </div>
            ))}
          </div>
        ) : null}

        {/* footer hint */}
        <div style={{
          marginTop: 24, textAlign: "center",
          fontFamily: "var(--font-serif)", fontStyle: "italic",
          fontSize: 13, color: "var(--ink-3)",
        }}>
          Press <span style={{ fontFamily: "var(--font-mono)", color: "var(--ink-2)" }}>space</span> to reveal · <span style={{ fontFamily: "var(--font-mono)", color: "var(--ink-2)" }}>1–4</span> to grade
        </div>
      </div>
    </div>
  </div>
);

Object.assign(window, { WordDetailFrame, ReviewFrame });
})();
