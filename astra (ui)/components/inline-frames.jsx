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
   1 · HOVER TOOLTIP / INLINE WORD LOOKUP
   What appears in-page when the reader hovers a word, or selects a phrase.
   Shown over a faux NYT paragraph so the relationship to the host page is
   clear. Three states: word hover, phrase selection toolbar, phrase-card.
   ==================================================================== */

const FauxParagraph = ({ children, hlIndex = -1, underlineIndex = -1, words }) => (
  <p
    className="serif"
    style={{
      fontFamily: "var(--font-serif)",
      fontSize: 17,
      lineHeight: 1.7,
      color: "var(--ink-1)",
      margin: 0,
      maxWidth: 640,
    }}
  >
    {words.map((w, i) => {
      const isHl = i === hlIndex;
      const isUl = i === underlineIndex;
      const space = w.endsWith(" ") ? "" : " ";
      return (
        <React.Fragment key={i}>
          <span
            style={{
              background: isHl ? "var(--hl-soft)" : "transparent",
              borderBottom: isUl ? "1px dotted var(--hl)" : "none",
              padding: isHl ? "1px 2px" : 0,
              borderRadius: isHl ? 2 : 0,
            }}
          >{w}</span>{space}
        </React.Fragment>
      );
    })}
  </p>
);

const PageBackdrop = ({ children, label = "newyorker.com" }) => (
  <div style={{
    position: "absolute", inset: 0,
    background: "var(--bg-page)",
    padding: "44px 56px",
    fontFamily: "var(--font-serif)",
  }}>
    <div className="eyebrow" style={{ marginBottom: 10 }}>
      <IconGlobe size={10} style={{ marginRight: 6, verticalAlign: "-1px" }} />
      {label}
    </div>
    <h1 className="serif" style={{
      fontFamily: "var(--font-serif)",
      fontSize: 40, lineHeight: 1.08, letterSpacing: "-0.022em",
      margin: "0 0 22px", color: "var(--ink-1)", maxWidth: 640, fontWeight: 500,
    }}>
      The Quiet Year of <span style={{ fontStyle: "italic" }}>Solitude</span>
    </h1>
    {children}
  </div>
);

/* The hover word card — small, anchored above the word with a tail */
const HoverPopover = ({ x = 240, y = 220, word, pinyin, pos, gloss, examples = [] }) => (
  <div style={{ position: "absolute", left: x, top: y }}>
    <div style={{
      width: 300,
      background: "var(--bg-elevated)",
      border: "1px solid var(--line-1)",
      borderRadius: "var(--r-lg)",
      boxShadow: "var(--shadow-lg)",
      overflow: "hidden",
      fontFamily: "var(--font-sans)",
    }}>
      <div style={{ padding: "12px 14px 10px", borderBottom: "1px solid var(--line-1)" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{
            fontFamily: "var(--font-serif)", fontSize: 22,
            color: "var(--ink-1)", letterSpacing: "-0.01em",
          }}>{word}</span>
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: 11,
            color: "var(--ink-3)",
          }}>{pinyin}</span>
          <span style={{ flex: 1 }} />
          <span className="eyebrow">{pos}</span>
        </div>
        <div style={{
          fontFamily: "var(--font-serif)", fontStyle: "italic",
          fontSize: 15, color: "var(--ink-1)", marginTop: 6, lineHeight: 1.4,
        }}>{gloss}</div>
      </div>
      {examples.length ? (
        <div style={{ padding: "10px 14px 4px" }}>
          <div className="eyebrow" style={{ marginBottom: 4 }}>From context</div>
          {examples.map((ex, i) => (
            <div key={i} style={{
              fontFamily: "var(--font-serif)", fontSize: 13, lineHeight: 1.5,
              color: "var(--ink-2)", marginBottom: 6,
            }}>{ex}</div>
          ))}
        </div>
      ) : null}
      <div style={{
        display: "flex", alignItems: "center", gap: 4,
        padding: "8px 10px", borderTop: "1px solid var(--line-1)",
        background: "var(--bg-surface)",
      }}>
        <Btn size="sm" variant="quiet" icon={<IconBookmark size={12} />}>Save</Btn>
        <Btn size="sm" variant="quiet" icon={<IconHighlighter size={12} />}>Mark</Btn>
        <span style={{ flex: 1 }} />
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: 10,
          color: "var(--ink-4)",
        }}>⌥+S</span>
      </div>
    </div>
    {/* tail */}
    <div style={{
      position: "absolute", left: 28, bottom: -6,
      width: 10, height: 10, transform: "rotate(45deg)",
      background: "var(--bg-surface)",
      borderRight: "1px solid var(--line-1)",
      borderBottom: "1px solid var(--line-1)",
    }} />
  </div>
);

/* Phrase-translation card (when user selects a phrase) — wider, with bilingual line */
const PhraseCard = ({ x = 200, y = 320, source, target }) => (
  <div style={{ position: "absolute", left: x, top: y }}>
    <div style={{
      width: 420,
      background: "var(--bg-elevated)",
      border: "1px solid var(--line-1)",
      borderRadius: "var(--r-lg)",
      boxShadow: "var(--shadow-lg)",
      overflow: "hidden",
      fontFamily: "var(--font-sans)",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "8px 12px", borderBottom: "1px solid var(--line-1)",
        background: "var(--bg-surface)",
      }}>
        <AstraMark size={11} stroke={1.6} />
        <span className="eyebrow">Translation</span>
        <span style={{ flex: 1 }} />
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: 10,
          color: "var(--ink-4)",
        }}>EN → ZH</span>
      </div>
      <div style={{ padding: "14px 16px" }}>
        <div style={{
          fontFamily: "var(--font-serif)", fontSize: 15,
          color: "var(--ink-2)", lineHeight: 1.55, marginBottom: 8,
        }}>{source}</div>
        <div style={{
          fontFamily: "var(--font-serif)", fontSize: 16, fontStyle: "italic",
          color: "var(--ink-1)", lineHeight: 1.55,
        }}>{target}</div>
      </div>
      <div style={{
        display: "flex", alignItems: "center", gap: 4,
        padding: "8px 10px", borderTop: "1px solid var(--line-1)",
      }}>
        <Btn size="sm" variant="quiet" icon={<IconBookmark size={12} />}>Save phrase</Btn>
        <Btn size="sm" variant="quiet" icon={<IconSparkle size={12} />}>Explain</Btn>
        <span style={{ flex: 1 }} />
        <Btn size="sm" variant="quiet" style={{ padding: 6 }}><IconClose size={12} /></Btn>
      </div>
    </div>
  </div>
);

/* In-page selection toolbar (compact) */
const InlineToolbar = ({ x = 280, y = 280 }) => (
  <div style={{
    position: "absolute", left: x, top: y,
    display: "inline-flex", alignItems: "center", gap: 0,
    background: "var(--ink-1)",
    color: "var(--bg-page)",
    borderRadius: "var(--r-md)",
    boxShadow: "var(--shadow-lg)",
    fontFamily: "var(--font-sans)",
    fontSize: 13, padding: 3,
  }}>
    {[
      { l: "Translate", i: <IconLanguages size={13} /> },
      { l: "Explain", i: <IconSparkle size={13} /> },
      { l: "Save", i: <IconBookmark size={13} /> },
    ].map((b, i) => (
      <button key={i} style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        padding: "5px 9px", background: "transparent", color: "inherit",
        border: 0, borderRadius: 5, cursor: "pointer",
        fontFamily: "inherit", fontSize: "inherit",
      }}>{b.i}{b.l}</button>
    ))}
    <span style={{ width: 1, alignSelf: "stretch", background: "rgba(255,255,255,0.14)", margin: "0 2px" }} />
    <button style={{
      display: "inline-flex", alignItems: "center",
      padding: "5px 7px", background: "transparent", color: "inherit",
      border: 0, borderRadius: 5, cursor: "pointer",
    }}><IconChevronDown size={12} /></button>
  </div>
);

const HoverFrame = ({ direction = "quiet" }) => {
  const words = "Solitude is not the same as isolation. To read deeply requires a kind of inward weather — what the writer once called the unalterable hush before a real thought arrives.".split(/(\s+)/).filter(s => s.trim().length).map(w => w);
  return (
    <div data-astra={direction} className="astra-frame" style={{
      width: 1100, height: 720, position: "relative", background: "var(--bg-page)",
    }}>
      <PageBackdrop>
        <FauxParagraph words={words} underlineIndex={11} />
        <p className="serif" style={{
          fontFamily: "var(--font-serif)", fontSize: 17, lineHeight: 1.7,
          color: "var(--ink-1)", margin: "16px 0 0", maxWidth: 640,
        }}>
          We have, almost without noticing, traded the slow pleasure of a paragraph for the quick relief of a notification.
        </p>
        <p className="serif" style={{
          fontFamily: "var(--font-serif)", fontSize: 17, lineHeight: 1.7,
          color: "var(--ink-1)", margin: "16px 0 0", maxWidth: 640,
        }}>
          The result is a generation that has read more sentences than any before it, and finished fewer of them.
        </p>
      </PageBackdrop>
      <HoverPopover
        x={520} y={158}
        word="hush"
        pinyin="hʌʃ · n."
        pos="noun"
        gloss="一种安静、近乎屏息的状态"
        examples={[
          "the unalterable hush before a real thought arrives",
        ]}
      />
    </div>
  );
};

const SelectionFrame = ({ direction = "quiet" }) => {
  const words = "We have, almost without noticing, traded the slow pleasure of a paragraph for the quick relief of a notification.".split(/(\s+)/).filter(s => s.trim().length);
  return (
    <div data-astra={direction} className="astra-frame" style={{
      width: 1100, height: 720, position: "relative", background: "var(--bg-page)",
    }}>
      <PageBackdrop>
        <p className="serif" style={{
          fontFamily: "var(--font-serif)", fontSize: 17, lineHeight: 1.7,
          color: "var(--ink-1)", margin: 0, maxWidth: 640,
        }}>
          Solitude is not the same as isolation. To read deeply requires a kind of inward weather.
        </p>
        <p className="serif" style={{
          fontFamily: "var(--font-serif)", fontSize: 17, lineHeight: 1.7,
          color: "var(--ink-1)", margin: "16px 0 0", maxWidth: 640,
        }}>
          We have, almost without noticing,{" "}
          <span style={{
            background: "var(--accent-soft)",
            borderBottom: "1.5px solid var(--accent-line)",
            padding: "1px 1px",
          }}>traded the slow pleasure of a paragraph for the quick relief of a notification</span>.
        </p>
      </PageBackdrop>
      <InlineToolbar x={170} y={310} />
      <PhraseCard
        x={170} y={368}
        source="traded the slow pleasure of a paragraph for the quick relief of a notification"
        target="把一整段文字带来的缓慢愉悦，换成了一条通知带来的短暂解脱。"
      />
    </div>
  );
};

/* ====================================================================
   8 · KEYBOARD SHORTCUTS / COMMAND MENU
   Centered overlay invoked with ⌘K. Two columns: left is search-driven
   command list; right pane shows shortcut sheet grouped by surface.
   ==================================================================== */

const CmdRow = ({ icon, label, hint, kbd, sel }) => (
  <div style={{
    display: "flex", alignItems: "center", gap: 10,
    padding: "9px 12px", borderRadius: 6,
    background: sel ? "var(--bg-sunken)" : "transparent",
    cursor: "pointer",
  }}>
    <span style={{
      width: 22, height: 22, borderRadius: 5,
      background: sel ? "var(--bg-elevated)" : "transparent",
      border: sel ? "1px solid var(--line-1)" : "none",
      color: "var(--ink-2)",
      display: "inline-flex", alignItems: "center", justifyContent: "center",
    }}>{icon}</span>
    <span style={{
      fontFamily: "var(--font-sans)", fontSize: 13,
      color: "var(--ink-1)", letterSpacing: "-0.005em",
    }}>{label}</span>
    {hint ? (
      <span style={{
        fontFamily: "var(--font-serif)", fontStyle: "italic",
        fontSize: 12, color: "var(--ink-3)", marginLeft: 4,
      }}>{hint}</span>
    ) : null}
    <span style={{ flex: 1 }} />
    {kbd ? (
      <span style={{
        fontFamily: "var(--font-mono)", fontSize: 10,
        color: "var(--ink-3)", letterSpacing: "0.04em",
      }}>{kbd}</span>
    ) : null}
  </div>
);

const Kbd = ({ children }) => (
  <span style={{
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    minWidth: 22, height: 22, padding: "0 6px",
    background: "var(--bg-elevated)", border: "1px solid var(--line-2)",
    borderRadius: 5,
    fontFamily: "var(--font-mono)", fontSize: 11,
    color: "var(--ink-2)",
    boxShadow: "0 1px 0 var(--line-1)",
  }}>{children}</span>
);

const ShortcutRow = ({ label, keys }) => (
  <div style={{
    display: "flex", alignItems: "center",
    padding: "8px 0",
    borderBottom: "1px solid var(--line-1)",
  }}>
    <span style={{
      fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--ink-1)",
      flex: 1,
    }}>{label}</span>
    <span style={{ display: "inline-flex", gap: 4 }}>
      {keys.map((k, i) => <Kbd key={i}>{k}</Kbd>)}
    </span>
  </div>
);

const CommandMenuFrame = ({ direction = "quiet" }) => (
  <div data-astra={direction} className="astra-frame" style={{
    width: 1100, height: 720, position: "relative",
    background: "var(--bg-page)",
  }}>
    {/* faux page behind */}
    <div style={{
      position: "absolute", inset: 0,
      padding: "44px 56px", opacity: 0.35, pointerEvents: "none",
    }}>
      <div className="eyebrow"><IconGlobe size={10} style={{ marginRight: 6, verticalAlign: "-1px" }} />newyorker.com</div>
      <h1 className="serif" style={{
        fontFamily: "var(--font-serif)", fontSize: 40,
        lineHeight: 1.08, letterSpacing: "-0.022em",
        margin: "12px 0 22px", color: "var(--ink-1)", fontWeight: 500,
      }}>The Quiet Year of <span style={{ fontStyle: "italic" }}>Solitude</span></h1>
      <p className="serif" style={{
        fontFamily: "var(--font-serif)", fontSize: 17, lineHeight: 1.7,
        color: "var(--ink-1)", maxWidth: 640,
      }}>Solitude is not the same as isolation. To read deeply requires a kind of inward weather.</p>
    </div>

    {/* dim layer */}
    <div style={{
      position: "absolute", inset: 0,
      background: "color-mix(in srgb, var(--bg-page) 60%, transparent)",
      backdropFilter: "blur(2px)",
    }} />

    {/* command palette */}
    <div style={{
      position: "absolute", left: "50%", top: 90,
      transform: "translateX(-50%)",
      width: 720, background: "var(--bg-elevated)",
      border: "1px solid var(--line-2)", borderRadius: 14,
      boxShadow: "var(--shadow-lg)", overflow: "hidden",
      display: "grid", gridTemplateColumns: "1fr 280px",
    }}>
      {/* left: search + commands */}
      <div style={{ borderRight: "1px solid var(--line-1)" }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "14px 16px", borderBottom: "1px solid var(--line-1)",
        }}>
          <IconSearch size={15} style={{ color: "var(--ink-3)" }} />
          <span style={{
            fontFamily: "var(--font-serif)", fontSize: 17, fontStyle: "italic",
            color: "var(--ink-1)", flex: 1,
          }}>translate</span>
          <Kbd>esc</Kbd>
        </div>
        <div style={{ padding: "8px 8px 12px" }}>
          <div className="eyebrow" style={{ padding: "6px 10px 4px" }}>Suggested</div>
          <CmdRow sel icon={<IconLanguages size={12} />} label="Translate this page"
            hint="newyorker.com" kbd="⌥E" />
          <CmdRow icon={<IconBook size={12} />} label="Open in Deep Read" kbd="⌥D" />
          <CmdRow icon={<IconSparkle size={12} />} label="Translate selection"
            hint="needs a selection" kbd="⌥T" />
          <div className="eyebrow" style={{ padding: "10px 10px 4px" }}>Library</div>
          <CmdRow icon={<IconBookmark size={12} />} label="Saved words"
            hint="248" kbd="⌥W" />
          <CmdRow icon={<IconClock size={12} />} label="Start review"
            hint="4 due today" kbd="⌥R" />
          <CmdRow icon={<IconList size={12} />} label="Reading history" />
        </div>
      </div>
      {/* right: shortcut sheet */}
      <div style={{ padding: "14px 18px 18px", background: "var(--bg-surface)" }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>Shortcuts</div>
        <div style={{
          fontFamily: "var(--font-serif)", fontSize: 13, fontStyle: "italic",
          color: "var(--ink-3)", marginBottom: 12, lineHeight: 1.45,
        }}>Hold ⌥ to see shortcuts overlaid on every Astra control.</div>
        <ShortcutRow label="Open Astra" keys={["⌘", "K"]} />
        <ShortcutRow label="Translate page" keys={["⌥", "E"]} />
        <ShortcutRow label="Translate selection" keys={["⌥", "T"]} />
        <ShortcutRow label="Save word" keys={["⌥", "S"]} />
        <ShortcutRow label="Deep Read" keys={["⌥", "D"]} />
        <ShortcutRow label="Review" keys={["⌥", "R"]} />
        <ShortcutRow label="Toggle hover-translate" keys={["⌥", "H"]} />
      </div>
    </div>
  </div>
);

/* ====================================================================
   9 · SHARE / EXPORT A HIGHLIGHT
   What the user sees after they choose to share a saved highlight.
   Tabs across export targets; preview card on the right reflects format.
   ==================================================================== */

const ExportTab = ({ icon, label, sel }) => (
  <div style={{
    display: "flex", alignItems: "center", gap: 10,
    padding: "10px 12px", borderRadius: 8,
    background: sel ? "var(--bg-sunken)" : "transparent",
    border: sel ? "1px solid var(--line-1)" : "1px solid transparent",
    cursor: "pointer",
  }}>
    <span style={{
      width: 24, height: 24, borderRadius: 5,
      background: sel ? "var(--bg-elevated)" : "var(--bg-sunken)",
      border: "1px solid var(--line-1)",
      color: "var(--ink-2)",
      display: "inline-flex", alignItems: "center", justifyContent: "center",
    }}>{icon}</span>
    <span style={{
      fontFamily: "var(--font-sans)", fontSize: 13,
      color: "var(--ink-1)", fontWeight: sel ? 500 : 400,
    }}>{label}</span>
  </div>
);

const ShareFrame = ({ direction = "quiet" }) => (
  <div data-astra={direction} className="astra-frame" style={{
    width: 1100, height: 720, position: "relative",
    background: "var(--bg-page)", padding: "40px 48px",
    boxSizing: "border-box",
  }}>
    <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 4 }}>
      <AstraMark size={14} stroke={1.6} />
      <span className="eyebrow">Share a passage</span>
    </div>
    <h1 className="serif" style={{
      fontFamily: "var(--font-serif)", fontSize: 32,
      letterSpacing: "-0.02em", margin: "6px 0 6px",
      color: "var(--ink-1)", fontWeight: 500,
    }}>Make it travel.</h1>
    <p className="serif" style={{
      fontFamily: "var(--font-serif)", fontStyle: "italic",
      fontSize: 16, color: "var(--ink-2)", lineHeight: 1.55,
      maxWidth: 540, margin: "0 0 24px",
    }}>
      Export the highlight as a quiet card, a markdown blockquote, or a link your friends can open in Astra.
    </p>

    <div style={{
      display: "grid", gridTemplateColumns: "260px 1fr 320px", gap: 24,
      alignItems: "start",
    }}>
      {/* left: format list */}
      <div>
        <div className="eyebrow" style={{ marginBottom: 8 }}>Format</div>
        <ExportTab icon={<IconHighlighter size={12} />} label="Image card" sel />
        <ExportTab icon={<IconBook size={12} />} label="Markdown" />
        <ExportTab icon={<IconArrowUpRight size={12} />} label="Astra link" />
        <ExportTab icon={<IconBookmark size={12} />} label="Plain quote" />

        <div className="eyebrow" style={{ marginBottom: 8, marginTop: 22 }}>Include</div>
        <Card padded={false} style={{ overflow: "hidden" }}>
          {[
            ["Original English", true],
            ["Chinese translation", true],
            ["Source citation", true],
            ["Your annotation", false],
          ].map(([label, on], i, arr) => (
            <div key={label} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 12px",
              borderBottom: i === arr.length - 1 ? "none" : "1px solid var(--line-1)",
            }}>
              <span style={{
                fontFamily: "var(--font-sans)", fontSize: 13,
                color: "var(--ink-1)", flex: 1,
              }}>{label}</span>
              <Toggle on={on} />
            </div>
          ))}
        </Card>
      </div>

      {/* center: preview canvas */}
      <div>
        <div className="eyebrow" style={{ marginBottom: 8 }}>Preview</div>
        <div style={{
          aspectRatio: "4 / 5",
          background: "linear-gradient(180deg, var(--bg-elevated), var(--bg-surface))",
          border: "1px solid var(--line-1)",
          borderRadius: 14, padding: "44px 40px 36px",
          boxShadow: "var(--shadow-md)",
          position: "relative", overflow: "hidden",
        }}>
          <AstraMark size={16} stroke={1.4} style={{ color: "var(--ink-3)" }} />
          <div style={{
            fontFamily: "var(--font-serif)", fontSize: 22,
            lineHeight: 1.4, color: "var(--ink-1)",
            letterSpacing: "-0.012em", marginTop: 24, fontWeight: 500,
          }}>
            We have, almost without noticing, traded the slow pleasure of a paragraph for the quick relief of a notification.
          </div>
          <div style={{
            fontFamily: "var(--font-serif)", fontStyle: "italic",
            fontSize: 18, lineHeight: 1.5, color: "var(--ink-2)",
            marginTop: 16,
          }}>
            我们几乎在不知不觉中，把一整段文字的缓慢愉悦，换成了一条通知带来的短暂解脱。
          </div>
          <div style={{
            position: "absolute", left: 40, right: 40, bottom: 28,
            display: "flex", alignItems: "baseline", justifyContent: "space-between",
            paddingTop: 16, borderTop: "1px solid var(--line-1)",
          }}>
            <div>
              <div style={{
                fontFamily: "var(--font-sans)", fontSize: 11,
                textTransform: "uppercase", letterSpacing: "0.14em",
                color: "var(--ink-3)",
              }}>The New Yorker</div>
              <div style={{
                fontFamily: "var(--font-serif)", fontStyle: "italic",
                fontSize: 13, color: "var(--ink-2)", marginTop: 2,
              }}>The Quiet Year of Solitude · Mar 2025</div>
            </div>
            <div style={{
              fontFamily: "var(--font-mono)", fontSize: 10,
              color: "var(--ink-4)", letterSpacing: "0.04em",
            }}>astra.read/q/3f7a</div>
          </div>
        </div>

        <div style={{
          display: "flex", gap: 8, marginTop: 14,
        }}>
          <Btn variant="primary" size="md" icon={<IconArrowUpRight size={13} />}>
            Copy as PNG
          </Btn>
          <Btn variant="ghost" size="md">Download</Btn>
          <span style={{ flex: 1 }} />
          <Btn variant="quiet" size="md" icon={<IconClose size={13} />}>Cancel</Btn>
        </div>
      </div>

      {/* right: card options */}
      <div>
        <div className="eyebrow" style={{ marginBottom: 8 }}>Card options</div>
        <Card>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Surface</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
            {[
              { v: "Paper", bg: "#f4efe6", line: "#ddd3c2", sel: true },
              { v: "Ivory", bg: "#fbf8f1", line: "#e8e0cf" },
              { v: "Twilight", bg: "#0d1220", line: "#2a3050" },
            ].map(s => (
              <div key={s.v} style={{
                padding: 10, borderRadius: 8,
                background: s.bg, border: `1px solid ${s.sel ? "var(--accent)" : s.line}`,
                outline: s.sel ? "2px solid var(--accent-soft)" : "none",
                cursor: "pointer", textAlign: "center",
              }}>
                <span style={{
                  fontFamily: "var(--font-serif)", fontSize: 11,
                  color: s.v === "Twilight" ? "#f2efe6" : "#1a1612",
                }}>{s.v}</span>
              </div>
            ))}
          </div>

          <div className="eyebrow" style={{ marginBottom: 6, marginTop: 14 }}>Aspect</div>
          <div style={{ display: "flex", gap: 6 }}>
            {["1:1", "4:5", "9:16"].map((r, i) => (
              <div key={r} style={{
                flex: 1, padding: "8px 0", borderRadius: 6,
                background: i === 1 ? "var(--bg-sunken)" : "var(--bg-surface)",
                border: i === 1 ? "1px solid var(--ink-1)" : "1px solid var(--line-1)",
                fontFamily: "var(--font-mono)", fontSize: 11,
                color: "var(--ink-1)", textAlign: "center", cursor: "pointer",
              }}>{r}</div>
            ))}
          </div>

          <div className="eyebrow" style={{ marginBottom: 6, marginTop: 14 }}>Mark</div>
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "8px 0",
          }}>
            <span style={{
              fontFamily: "var(--font-sans)", fontSize: 13, flex: 1,
              color: "var(--ink-1)",
            }}>Show Astra mark</span>
            <Toggle on />
          </div>
        </Card>
      </div>
    </div>
  </div>
);

Object.assign(window, {
  HoverFrame, SelectionFrame, CommandMenuFrame, ShareFrame,
});
})();
