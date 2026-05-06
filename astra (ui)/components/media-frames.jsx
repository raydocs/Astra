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
   POPUP · SITE SHEET — what you see when you tap the site row in the
   popup. Same 380×620 chrome; same paper / ink language; condensed
   per-site rules: enabled · auto-translate · scope · hover · style.
   ==================================================================== */

const SheetRow = ({ label, sub, children, last }) => (
  <div style={{
    padding: "12px 0",
    borderBottom: last ? "none" : "1px solid var(--line-1)",
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: "var(--font-sans)", fontSize: 13,
          color: "var(--ink-1)", fontWeight: 500, letterSpacing: "-0.005em",
        }}>{label}</div>
        {sub ? (
          <div className="serif" style={{
            fontFamily: "var(--font-serif)", fontStyle: "italic",
            fontSize: 12, color: "var(--ink-3)", marginTop: 2,
            lineHeight: 1.45,
          }}>{sub}</div>
        ) : null}
      </div>
      {children}
    </div>
  </div>
);

const PopSeg = ({ options, value }) => (
  <div style={{
    display: "inline-flex", padding: 2,
    background: "var(--bg-sunken)",
    border: "1px solid var(--line-1)", borderRadius: 7,
  }}>
    {options.map(o => (
      <span key={o} style={{
        padding: "4px 10px", borderRadius: 5,
        fontFamily: "var(--font-sans)", fontSize: 11,
        color: o === value ? "var(--ink-1)" : "var(--ink-3)",
        background: o === value ? "var(--bg-elevated)" : "transparent",
        boxShadow: o === value ? "var(--shadow-sm)" : "none",
        fontWeight: o === value ? 500 : 400,
        cursor: "pointer", whiteSpace: "nowrap",
      }}>{o}</span>
    ))}
  </div>
);

const PopupSiteSheetFrame = ({ direction = "quiet" }) => (
  <div data-astra={direction} className="astra-frame astra-root" style={{
    width: 380, height: 620, background: "var(--bg-page)",
    borderRadius: 16, overflow: "hidden",
    border: "1px solid var(--line-1)", boxShadow: "var(--shadow-lg)",
    display: "flex", flexDirection: "column",
    boxSizing: "border-box",
  }}>
    {/* breadcrumb header — replaces normal popup header */}
    <div style={{
      padding: "12px 16px",
      display: "flex", alignItems: "center", gap: 8,
      borderBottom: "1px solid var(--line-1)", background: "var(--bg-surface)",
    }}>
      <Btn variant="quiet" size="sm" style={{ padding: "4px 8px" }}
        icon={<IconChevronRight size={11} style={{ transform: "rotate(180deg)" }} />}>
        <span style={{ fontFamily: "var(--font-sans)", fontSize: 12 }}>Popup</span>
      </Btn>
      <span style={{ flex: 1 }} />
      <span className="eyebrow">Site rules</span>
    </div>

    <div style={{ overflow: "auto", flex: 1, padding: "18px 18px 0" }}>
      {/* hero — site identity */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 8,
          background: "var(--bg-sunken)", border: "1px solid var(--line-2)",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          color: "var(--ink-2)",
        }}><IconGlobe size={15} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="serif" style={{
            fontFamily: "var(--font-serif)", fontSize: 22,
            letterSpacing: "-0.018em", color: "var(--ink-1)",
            fontWeight: 500, lineHeight: 1.1,
          }}>newyorker.com</div>
          <div style={{
            fontFamily: "var(--font-mono)", fontSize: 10,
            color: "var(--ink-4)", letterSpacing: "0.04em", marginTop: 2,
          }}>48 ARTICLES TRANSLATED</div>
        </div>
        <Pill tone="accent">Custom</Pill>
      </div>

      {/* card · master switches */}
      <Card padded={false} style={{ padding: "4px 16px", marginBottom: 14 }}>
        <SheetRow label="Astra on this site" sub="Master switch. Off here means everything below is ignored.">
          <Toggle on />
        </SheetRow>
        <SheetRow label="Auto-translate on load" sub="Skip the popup; translate as soon as the page is ready." last>
          <Toggle on={false} />
        </SheetRow>
      </Card>

      {/* card · how astra appears */}
      <Card padded={false} style={{ padding: "4px 16px", marginBottom: 14 }}>
        <SheetRow label="Display style">
          <PopSeg options={["Bilingual", "Replace", "Underline"]} value="Bilingual" />
        </SheetRow>
        <SheetRow label="Hover trigger">
          <PopSeg options={["Hover", "+ ⌥", "Off"]} value="+ ⌥" />
        </SheetRow>
        <SheetRow label="Target language" last>
          <PopSeg options={["中文", "繁體", "EN"]} value="中文" />
        </SheetRow>
      </Card>

      {/* card · scope (collapsed advanced) */}
      <Card padded={false} style={{ padding: "0 16px", marginBottom: 14 }}>
        <SheetRow label="Scope" sub="Translate paragraphs over 40 chars, in <article>, skipping nav and code blocks.">
          <Btn variant="quiet" size="sm" style={{ padding: "4px 10px" }}>Edit</Btn>
        </SheetRow>
        <div style={{
          padding: "8px 0 12px", display: "flex", flexWrap: "wrap", gap: 4,
          borderTop: "1px solid var(--line-1)",
        }}>
          {[
            { l: "min ¶ 40 chars", k: "len" },
            { l: "in: article", k: "inc" },
            { l: "skip: pre, code", k: "exc" },
            { l: "/magazine/**", k: "url" },
          ].map(t => (
            <span key={t.k} style={{
              padding: "3px 8px",
              background: "var(--bg-sunken)", border: "1px solid var(--line-1)",
              borderRadius: 99,
              fontFamily: "var(--font-mono)", fontSize: 10,
              color: "var(--ink-3)", letterSpacing: "0.02em",
            }}>{t.l}</span>
          ))}
        </div>
      </Card>

      {/* card · brand-fit theme (link to advanced) */}
      <Card padded={false} style={{ padding: "0 16px", marginBottom: 14 }}>
        <SheetRow label="Custom theme" sub="Override Astra's translation styling on this site." last>
          <Btn variant="ghost" size="sm" icon={<IconArrowUpRight size={11} />}>Edit CSS</Btn>
        </SheetRow>
      </Card>
    </div>

    {/* footer — destructive + save */}
    <div style={{
      padding: "10px 16px", borderTop: "1px solid var(--line-1)",
      background: "var(--bg-surface)",
      display: "flex", alignItems: "center", gap: 8,
    }}>
      <Btn variant="ghost" size="sm" style={{ color: "var(--danger)" }}>Reset</Btn>
      <span style={{ flex: 1 }} />
      <Btn variant="quiet" size="sm">Cancel</Btn>
      <Btn variant="primary" size="sm" icon={<IconCheck size={12} />}>Save</Btn>
    </div>
  </div>
);

/* ====================================================================
   SUBTITLE READER — YouTube-style. Player on the left, bilingual
   subtitle stream on the right. Current line glows; past lines fade;
   each line has Save / Look up affordances on hover.
   ==================================================================== */

const SubtitleLine = ({ time, en, zh, state, saved, words = [] }) => {
  const isCurrent = state === "current";
  const isPast = state === "past";
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "48px 1fr",
      gap: 14, padding: "12px 16px",
      background: isCurrent ? "var(--bg-elevated)" : "transparent",
      borderLeft: isCurrent ? "2px solid var(--accent)" : "2px solid transparent",
      borderBottom: "1px solid var(--line-1)",
      opacity: isPast ? 0.55 : 1,
      cursor: "pointer", position: "relative",
    }}>
      <div style={{
        fontFamily: "var(--font-mono)", fontSize: 10,
        color: isCurrent ? "var(--ink-2)" : "var(--ink-4)",
        paddingTop: 4, letterSpacing: "0.04em",
      }}>{time}</div>
      <div>
        <div className="serif" style={{
          fontFamily: "var(--font-serif)", fontSize: 16,
          lineHeight: 1.5, color: "var(--ink-1)",
          fontWeight: isCurrent ? 500 : 400,
          letterSpacing: "-0.006em",
        }}>
          {/* highlight saved/lookup-able words */}
          {(() => {
            if (words.length === 0) return en;
            const parts = [];
            let rest = en;
            words.forEach((w, i) => {
              const idx = rest.toLowerCase().indexOf(w.toLowerCase());
              if (idx === -1) return;
              parts.push(rest.slice(0, idx));
              parts.push(<span key={i} style={{
                borderBottom: "1.5px solid var(--hl)",
                paddingBottom: 1,
              }}>{rest.slice(idx, idx + w.length)}</span>);
              rest = rest.slice(idx + w.length);
            });
            parts.push(rest);
            return parts;
          })()}
        </div>
        <div className="serif" style={{
          fontFamily: "var(--font-serif)", fontStyle: "italic",
          fontSize: 14, color: "var(--ink-2)", lineHeight: 1.55,
          marginTop: 3,
        }}>{zh}</div>

        {isCurrent ? (
          <div style={{
            display: "flex", alignItems: "center", gap: 6, marginTop: 8,
          }}>
            <Btn variant="quiet" size="sm" style={{ padding: "3px 8px" }} icon={<IconBookmark size={10} />}>
              {saved ? "Saved" : "Save line"}
            </Btn>
            <Btn variant="quiet" size="sm" style={{ padding: "3px 8px" }} icon={<IconPause size={10} />}>
              Pause &amp; look up
            </Btn>
            <span style={{ flex: 1 }} />
            <span style={{
              fontFamily: "var(--font-mono)", fontSize: 9,
              color: "var(--ink-4)", letterSpacing: "0.04em",
            }}>2 NEW WORDS</span>
          </div>
        ) : null}
      </div>
    </div>
  );
};

const SubtitleReaderFrame = ({ direction = "quiet" }) => (
  <div data-astra={direction} className="astra-frame astra-root" style={{
    width: 1280, height: 900, background: "var(--bg-page)",
    color: "var(--ink-1)", display: "grid",
    gridTemplateColumns: "1fr 460px",
    boxSizing: "border-box", overflow: "hidden",
  }}>
    {/* LEFT — video pane (faux YouTube) */}
    <section style={{
      display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      {/* youtube top chrome */}
      <div style={{
        padding: "10px 18px", display: "flex", alignItems: "center", gap: 10,
        borderBottom: "1px solid var(--line-1)",
        background: "var(--bg-surface)",
      }}>
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-4)",
          letterSpacing: "0.04em",
        }}>youtube.com / watch</span>
        <span style={{ flex: 1 }} />
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "4px 10px", borderRadius: 99,
          background: "var(--bg-elevated)", border: "1px solid var(--line-2)",
        }}>
          <AstraMark size={10} stroke={1.6} />
          <span style={{
            fontFamily: "var(--font-sans)", fontSize: 11, color: "var(--ink-2)",
          }}>Astra · captions on</span>
        </span>
      </div>

      {/* video */}
      <div style={{
        flex: 1, padding: "20px 24px",
        display: "flex", flexDirection: "column", gap: 14,
        background: "var(--bg-page)",
      }}>
        <div style={{
          aspectRatio: "16 / 9",
          background: "linear-gradient(160deg, #1a1410 0%, #0d0a08 100%)",
          borderRadius: 12, position: "relative", overflow: "hidden",
          border: "1px solid var(--line-2)",
        }}>
          {/* faux frame content */}
          <div style={{
            position: "absolute", inset: 0,
            background:
              "radial-gradient(ellipse at 28% 40%, rgba(212,150,75,0.18) 0%, transparent 55%), " +
              "radial-gradient(ellipse at 72% 65%, rgba(120,160,210,0.12) 0%, transparent 50%)",
          }} />
          {/* speaker silhouette */}
          <div style={{
            position: "absolute", left: "32%", bottom: 0, top: "30%",
            width: 200,
            background: "radial-gradient(ellipse at 50% 30%, rgba(255,235,200,0.18) 0%, transparent 60%)",
            borderRadius: "50% 50% 0 0 / 60% 60% 0 0",
          }} />

          {/* burned-in caption */}
          <div style={{
            position: "absolute", left: "50%", bottom: 56,
            transform: "translateX(-50%)",
            padding: "8px 16px", borderRadius: 6,
            background: "rgba(0,0,0,0.55)",
            backdropFilter: "blur(2px)",
            color: "rgba(255,250,240,0.95)",
            fontFamily: "var(--font-serif)", fontSize: 18,
            letterSpacing: "-0.005em", textAlign: "center",
            maxWidth: "70%",
          }}>
            <div>so the question isn't whether you'll be misunderstood</div>
            <div className="serif" style={{
              fontStyle: "italic", fontSize: 15, color: "rgba(229,201,138,0.95)",
              marginTop: 3, fontFamily: "var(--font-serif)",
            }}>所以问题不是你会不会被误解</div>
          </div>

          {/* bottom controls */}
          <div style={{
            position: "absolute", left: 0, right: 0, bottom: 0,
            padding: "10px 14px",
            background: "linear-gradient(to top, rgba(0,0,0,0.55), transparent)",
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <span style={{
              width: 30, height: 30, borderRadius: 99,
              background: "rgba(255,255,255,0.15)",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              color: "white",
            }}><IconPause size={12} /></span>
            <span style={{
              fontFamily: "var(--font-mono)", fontSize: 11, color: "rgba(255,255,255,0.85)",
              letterSpacing: "0.03em",
            }}>4:12 / 11:38</span>
            <span style={{
              flex: 1, height: 3, background: "rgba(255,255,255,0.2)", borderRadius: 99,
              position: "relative",
            }}>
              <span style={{
                position: "absolute", left: 0, top: 0, height: "100%",
                width: "36%", background: "var(--accent)", borderRadius: 99,
              }} />
              <span style={{
                position: "absolute", left: "36%", top: -3, width: 9, height: 9,
                background: "var(--accent)", borderRadius: 99, transform: "translateX(-50%)",
              }} />
            </span>
            <span style={{
              fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(255,255,255,0.7)",
            }}>1× CC</span>
          </div>
        </div>

        {/* video meta */}
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>
            <IconGlobe size={10} style={{ marginRight: 6, verticalAlign: "-1px" }} />
            On Being · with Krista Tippett · 11:38
          </div>
          <h2 className="serif" style={{
            fontFamily: "var(--font-serif)", fontSize: 24,
            letterSpacing: "-0.018em", margin: "2px 0 6px",
            fontWeight: 500, lineHeight: 1.2,
          }}>The Quiet Permission of Being Misunderstood</h2>
          <div className="serif" style={{
            fontFamily: "var(--font-serif)", fontStyle: "italic",
            fontSize: 14, color: "var(--ink-3)", lineHeight: 1.5,
          }}>A short conversation about translation, attention, and what it costs to be heard correctly.</div>
        </div>

        {/* astra session card */}
        <Card padded={false} style={{ padding: "14px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <AstraMark size={12} stroke={1.6} />
            <span className="eyebrow">This session</span>
            <span style={{ flex: 1 }} />
            <span style={{
              fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-4)",
              letterSpacing: "0.04em",
            }}>4:12 ELAPSED</span>
          </div>
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16,
            marginTop: 10,
          }}>
            {[
              { n: 47, l: "lines transcribed" },
              { n: 6, l: "saved" },
              { n: 12, l: "looked up" },
              { n: 3, l: "added to review" },
            ].map((s, i) => (
              <div key={i}>
                <div className="serif" style={{
                  fontFamily: "var(--font-serif)", fontSize: 22,
                  letterSpacing: "-0.018em", color: "var(--ink-1)", lineHeight: 1,
                  fontWeight: 500,
                }}>{s.n}</div>
                <div style={{
                  fontFamily: "var(--font-sans)", fontSize: 11,
                  color: "var(--ink-3)", marginTop: 3,
                }}>{s.l}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </section>

    {/* RIGHT — subtitle stream */}
    <aside style={{
      borderLeft: "1px solid var(--line-1)",
      background: "var(--bg-surface)",
      display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      <div style={{
        padding: "16px 20px", borderBottom: "1px solid var(--line-1)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="eyebrow">Bilingual transcript</span>
          <span style={{ flex: 1 }} />
          <Btn variant="quiet" size="sm" style={{ padding: "3px 9px" }}>EN · 中文</Btn>
        </div>
        <div style={{
          marginTop: 10, display: "flex", alignItems: "center", gap: 8,
          padding: "7px 12px", background: "var(--bg-sunken)",
          border: "1px solid var(--line-1)", borderRadius: 8,
        }}>
          <IconSearch size={11} style={{ color: "var(--ink-3)" }} />
          <span className="serif" style={{
            fontFamily: "var(--font-serif)", fontStyle: "italic",
            fontSize: 13, color: "var(--ink-3)", flex: 1,
          }}>Search this transcript</span>
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: 9,
            color: "var(--ink-4)", letterSpacing: "0.04em",
          }}>⌘F</span>
        </div>
        <div style={{
          marginTop: 10, display: "flex", alignItems: "center", gap: 8,
        }}>
          <Pill>Auto-pause on lookup</Pill>
          <Pill tone="accent">Save · ⌥S</Pill>
        </div>
      </div>

      <div style={{ overflow: "auto", flex: 1 }}>
        <SubtitleLine
          time="3:54"
          en="There are languages in which there is no future tense at all."
          zh="有些语言根本没有未来时态。"
          state="past"
        />
        <SubtitleLine
          time="3:58"
          en="and the speakers, by every measure we know how to take, save more, plan more, suffer less."
          zh="而那些母语没有未来时态的人，按我们所有可测量的标准，反而存得更多、计划得更远、痛苦得更少。"
          state="past"
        />
        <SubtitleLine
          time="4:05"
          en="So the question isn't whether you'll be misunderstood."
          zh="所以问题不是你会不会被误解。"
          state="current"
          words={["misunderstood"]}
        />
        <SubtitleLine
          time="4:09"
          en="The question is what kind of solitude you keep around the misunderstanding."
          zh="问题是你在那次误解周围守住怎样的独处。"
          state="future"
          words={["solitude"]}
        />
        <SubtitleLine
          time="4:14"
          en="Because some forms of being misread are unalterable."
          zh="因为有些被误读，是无法改变的。"
          state="future"
          words={["unalterable"]}
        />
        <SubtitleLine
          time="4:19"
          en="They're the price of having said anything precise at all."
          zh="它们是你说出任何精确话语的代价。"
          state="future"
        />
        <SubtitleLine
          time="4:24"
          en="What you do with that price is, more or less, your interior life."
          zh="你怎么对待那份代价——多多少少——就是你的内心生活。"
          state="future"
        />
      </div>

      {/* footer · saved-this-session strip */}
      <div style={{
        padding: "12px 18px", borderTop: "1px solid var(--line-1)",
        background: "var(--bg-elevated)",
      }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>Just saved from this video</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {[
            { w: "misunderstood", t: "4:05" },
            { w: "solitude", t: "4:09" },
            { w: "unalterable", t: "4:14" },
          ].map(s => (
            <span key={s.w} style={{
              display: "inline-flex", alignItems: "baseline", gap: 6,
              padding: "4px 9px",
              background: "var(--bg-surface)", border: "1px solid var(--line-2)",
              borderRadius: 99,
            }}>
              <span className="serif" style={{
                fontFamily: "var(--font-serif)", fontSize: 13,
                color: "var(--ink-1)", letterSpacing: "-0.005em",
              }}>{s.w}</span>
              <span style={{
                fontFamily: "var(--font-mono)", fontSize: 9,
                color: "var(--ink-4)", letterSpacing: "0.04em",
              }}>{s.t}</span>
            </span>
          ))}
        </div>
      </div>
    </aside>
  </div>
);

Object.assign(window, { PopupSiteSheetFrame, SubtitleReaderFrame });
})();
