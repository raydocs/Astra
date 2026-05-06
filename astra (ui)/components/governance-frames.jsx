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
   SITE RULES EDITOR — per-site advanced rules. Two-pane: site list on
   the left, rule editor on the right. Same paper + serif language.
   ==================================================================== */

const RuleRow = ({ label, sub, children, hint }) => (
  <div style={{
    display: "grid", gridTemplateColumns: "220px 1fr",
    gap: 24, padding: "16px 0",
    borderBottom: "1px solid var(--line-1)",
    alignItems: "start",
  }}>
    <div>
      <div className="serif" style={{
        fontFamily: "var(--font-serif)", fontSize: 16,
        color: "var(--ink-1)", letterSpacing: "-0.005em",
        fontWeight: 500,
      }}>{label}</div>
      {sub ? (
        <div className="serif" style={{
          fontFamily: "var(--font-serif)", fontStyle: "italic",
          fontSize: 13, color: "var(--ink-3)", marginTop: 3, lineHeight: 1.5,
        }}>{sub}</div>
      ) : null}
      {hint ? (
        <div style={{
          fontFamily: "var(--font-mono)", fontSize: 10,
          color: "var(--ink-4)", marginTop: 6, letterSpacing: "0.04em",
        }}>{hint}</div>
      ) : null}
    </div>
    <div>{children}</div>
  </div>
);

const Seg = ({ options, value }) => (
  <div style={{
    display: "inline-flex", padding: 3,
    background: "var(--bg-sunken)",
    border: "1px solid var(--line-1)", borderRadius: 8,
  }}>
    {options.map(o => (
      <span key={o} style={{
        padding: "5px 12px", borderRadius: 6,
        fontFamily: "var(--font-sans)", fontSize: 12,
        color: o === value ? "var(--ink-1)" : "var(--ink-3)",
        background: o === value ? "var(--bg-elevated)" : "transparent",
        boxShadow: o === value ? "var(--shadow-sm)" : "none",
        cursor: "pointer", fontWeight: o === value ? 500 : 400,
      }}>{o}</span>
    ))}
  </div>
);

const TextField = ({ value, mono, multi, rows = 3, hint }) => (
  <div>
    <div style={{
      padding: multi ? "10px 12px" : "8px 12px",
      background: "var(--bg-sunken)",
      border: "1px solid var(--line-1)", borderRadius: 8,
      fontFamily: mono ? "var(--font-mono)" : "var(--font-sans)",
      fontSize: mono ? 12 : 13,
      color: "var(--ink-1)", lineHeight: 1.6,
      minHeight: multi ? rows * 22 : "auto",
      whiteSpace: "pre-wrap",
    }}>{value}</div>
    {hint ? (
      <div className="serif" style={{
        fontFamily: "var(--font-serif)", fontStyle: "italic",
        fontSize: 12, color: "var(--ink-3)", marginTop: 6, lineHeight: 1.5,
      }}>{hint}</div>
    ) : null}
  </div>
);

const SiteListItem = ({ host, sub, status, sel, customized }) => (
  <div style={{
    display: "flex", alignItems: "center", gap: 10,
    padding: "10px 12px", borderRadius: 8,
    background: sel ? "var(--bg-elevated)" : "transparent",
    border: sel ? "1px solid var(--line-2)" : "1px solid transparent",
    cursor: "pointer", marginBottom: 2,
  }}>
    <span style={{
      width: 22, height: 22, borderRadius: 4,
      background: "var(--bg-sunken)", border: "1px solid var(--line-1)",
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      color: "var(--ink-3)", flexShrink: 0,
    }}><IconGlobe size={11} /></span>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{
        fontFamily: "var(--font-sans)", fontSize: 13,
        color: "var(--ink-1)", fontWeight: sel ? 500 : 400,
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      }}>{host}</div>
      <div style={{
        fontFamily: "var(--font-mono)", fontSize: 10,
        color: "var(--ink-4)", letterSpacing: "0.03em",
      }}>{sub}</div>
    </div>
    {customized ? (
      <span style={{
        width: 6, height: 6, borderRadius: 99,
        background: "var(--accent)", flexShrink: 0,
      }} />
    ) : null}
    {status === "off" ? (
      <span style={{
        fontFamily: "var(--font-mono)", fontSize: 10,
        color: "var(--ink-4)",
      }}>off</span>
    ) : null}
  </div>
);

const SiteRulesFrame = ({ direction = "quiet" }) => (
  <div data-astra={direction} className="astra-frame astra-root" style={{
    width: 1280, height: 900, background: "var(--bg-page)",
    color: "var(--ink-1)", display: "grid",
    gridTemplateColumns: "300px 1fr",
    boxSizing: "border-box",
  }}>
    {/* sidebar */}
    <aside style={{
      borderRight: "1px solid var(--line-1)",
      padding: "20px 16px", background: "var(--bg-surface)",
      display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 6px 12px" }}>
        <AstraWordmark size={17} />
        <span style={{ flex: 1 }} />
        <Btn variant="quiet" size="sm" style={{ padding: 6 }}><IconSettings size={13} /></Btn>
      </div>

      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "8px 10px", background: "var(--bg-sunken)",
        border: "1px solid var(--line-1)", borderRadius: 8,
        marginBottom: 12,
      }}>
        <IconSearch size={12} style={{ color: "var(--ink-3)" }} />
        <span style={{
          fontFamily: "var(--font-serif)", fontStyle: "italic",
          fontSize: 13, color: "var(--ink-3)",
        }}>Search 24 sites</span>
      </div>

      <div className="eyebrow" style={{ padding: "6px 8px 4px" }}>Customized · 5</div>
      <div style={{ overflow: "auto", flex: 1 }}>
        <SiteListItem host="newyorker.com" sub="article mode · serif" customized sel />
        <SiteListItem host="github.com" sub="off — code is code" status="off" customized />
        <SiteListItem host="x.com" sub="hover only · no auto" customized />
        <SiteListItem host="reddit.com" sub="exclude /r/cscareerquestions" customized />
        <SiteListItem host="news.ycombinator.com" sub="auto translate" customized />

        <div className="eyebrow" style={{ padding: "16px 8px 4px" }}>Default behavior · 19</div>
        <SiteListItem host="theatlantic.com" sub="inherit" />
        <SiteListItem host="paulgraham.com" sub="inherit" />
        <SiteListItem host="overcast.fm" sub="inherit" />
        <SiteListItem host="wikipedia.org" sub="inherit" />
        <SiteListItem host="substack.com" sub="inherit" />
      </div>

      <div style={{
        marginTop: 10, paddingTop: 10,
        borderTop: "1px solid var(--line-1)",
        display: "flex", gap: 6,
      }}>
        <Btn variant="quiet" size="sm" style={{ flex: 1 }}>Import</Btn>
        <Btn variant="quiet" size="sm" style={{ flex: 1 }}>Export all</Btn>
      </div>
    </aside>

    {/* editor */}
    <section style={{ overflow: "auto", padding: "32px 44px 44px" }}>
      <div className="eyebrow" style={{ marginBottom: 6 }}>
        <IconGlobe size={10} style={{ marginRight: 6, verticalAlign: "-1px" }} />
        Site rule
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap" }}>
        <h1 className="serif" style={{
          fontFamily: "var(--font-serif)", fontSize: 38,
          letterSpacing: "-0.022em", margin: 0, fontWeight: 500,
        }}>newyorker.com</h1>
        <Pill tone="accent">Customized</Pill>
        <span style={{ flex: 1 }} />
        <Btn variant="quiet" size="sm">Reset to default</Btn>
        <Btn variant="ghost" size="sm" icon={<IconArrowUpRight size={12} />}>Export rule</Btn>
      </div>
      <div className="serif" style={{
        fontFamily: "var(--font-serif)", fontStyle: "italic",
        fontSize: 16, color: "var(--ink-2)", marginTop: 8, lineHeight: 1.55,
      }}>Astra has translated 48 articles here. The first rule below decides whether anything else runs.</div>

      <div style={{ marginTop: 24 }}>
        <RuleRow label="Enable on this site" sub="Master switch. Off here means everything below is ignored.">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Toggle on />
            <span style={{
              fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--ink-2)",
            }}>On — translation gestures available</span>
          </div>
        </RuleRow>

        <RuleRow label="Auto-translate on load" sub="Skip the popup; translate as soon as the page is readable.">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Toggle on={false} />
            <span style={{
              fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--ink-3)",
            }}>Off — wait for me to ask</span>
          </div>
        </RuleRow>

        <RuleRow label="Target language" sub="Override your global preference for this site only.">
          <Seg options={["Inherit (中文)", "中文", "繁體", "English", "日本語"]} value="Inherit (中文)" />
        </RuleRow>

        <RuleRow label="Display style" sub="How translated paragraphs sit next to the original.">
          <Seg options={["Inherit", "Bilingual", "Replace", "Underline"]} value="Bilingual" />
        </RuleRow>

        <RuleRow label="Hover trigger" sub="What gesture pops the inline lookup over a single word.">
          <Seg options={["Inherit", "Hover", "Hover + ⌥", "Off"]} value="Hover + ⌥" />
        </RuleRow>

        <RuleRow label="Theme" sub="The page is already styled — match the brand or stand back.">
          <Seg options={["Inherit", "Default", "Underline", "Highlight", "Margin"]} value="Margin" />
        </RuleRow>

        <RuleRow label="Translate paragraphs longer than" sub="Anything shorter is left alone — captions, bylines, ad copy.">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{
              flex: 1, height: 4, background: "var(--bg-sunken)",
              borderRadius: 2, position: "relative", maxWidth: 280,
            }}>
              <span style={{
                position: "absolute", left: 0, top: 0, height: "100%",
                width: "32%", background: "var(--ink-1)", borderRadius: 2,
              }} />
              <span style={{
                position: "absolute", left: "32%", top: -4, width: 12, height: 12,
                background: "var(--bg-elevated)", border: "1px solid var(--ink-2)",
                borderRadius: 99, transform: "translateX(-50%)",
              }} />
            </span>
            <span style={{
              fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-2)",
              minWidth: 64,
            }}>40 chars</span>
          </div>
        </RuleRow>

        <RuleRow
          label="Include selectors"
          sub="Only translate text inside these elements. CSS selectors, one per line."
          hint="ADVANCED · CSS"
        >
          <TextField mono multi rows={3} value={"article main\n.article-body\n[data-component='ArticleBody']"} />
        </RuleRow>

        <RuleRow
          label="Exclude selectors"
          sub="Never touch these. Useful for code blocks, captions, ads, navigation."
          hint="ADVANCED · CSS"
        >
          <TextField mono multi rows={3} value={"pre, code, kbd\n.byline, .related-posts\n.advertisement"} />
        </RuleRow>

        <RuleRow
          label="Path patterns"
          sub="Restrict to certain URLs on this domain. Glob syntax."
          hint="ADVANCED · GLOB"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <div className="eyebrow" style={{ marginBottom: 4, fontSize: 9 }}>Include</div>
              <TextField mono multi rows={2} value={"/magazine/**\n/culture/**"} />
            </div>
            <div>
              <div className="eyebrow" style={{ marginBottom: 4, fontSize: 9 }}>Exclude</div>
              <TextField mono multi rows={2} value={"/podcasts/**\n/newsletters/**"} />
            </div>
          </div>
        </RuleRow>

        <RuleRow
          label="Custom CSS"
          sub="Override Astra's translation styles for this site only — colors, weights, spacing."
          hint="ADVANCED · CSS"
        >
          <TextField mono multi rows={4} value={".astra-translated{\n  font-family: 'Source Serif 4', Georgia, serif;\n  color: #2a261d;\n  line-height: 1.7;\n}"} />
        </RuleRow>

        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "20px 0 0",
        }}>
          <span className="serif" style={{
            fontFamily: "var(--font-serif)", fontStyle: "italic",
            fontSize: 13, color: "var(--ink-3)", flex: 1,
          }}>Changes apply on the next page reload.</span>
          <Btn variant="quiet" size="md">Discard</Btn>
          <Btn variant="primary" size="md" icon={<IconCheck size={13} />}>Save rule</Btn>
        </div>
      </div>
    </section>
  </div>
);

/* ====================================================================
   AUTH — three artboards: Sign in, Account home, Plans/billing.
   Sign-in is small (480×640) like a modal; Account & Plans are full
   page (1280×900). All match the paper/twilight system.
   ==================================================================== */

const SignInFrame = ({ direction = "quiet" }) => (
  <div data-astra={direction} className="astra-frame astra-root" style={{
    width: 480, height: 640, background: "var(--bg-page)",
    color: "var(--ink-1)", padding: "44px 40px",
    boxSizing: "border-box", display: "flex", flexDirection: "column",
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <AstraMark size={20} stroke={1.6} />
      <AstraWordmark size={16} />
    </div>

    <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", marginTop: -28 }}>
      <h1 className="serif" style={{
        fontFamily: "var(--font-serif)", fontSize: 36,
        letterSpacing: "-0.025em", lineHeight: 1.1, margin: 0, fontWeight: 500,
      }}>Welcome back.</h1>
      <p className="serif" style={{
        fontFamily: "var(--font-serif)", fontStyle: "italic",
        fontSize: 16, color: "var(--ink-2)", lineHeight: 1.55,
        margin: "10px 0 32px", maxWidth: 360,
      }}>Sign in to keep your library and reading history on every device you read on.</p>

      <div className="eyebrow" style={{ marginBottom: 6 }}>Email</div>
      <div style={{
        padding: "12px 14px", background: "var(--bg-elevated)",
        border: "1px solid var(--line-2)", borderRadius: 10,
        fontFamily: "var(--font-sans)", fontSize: 14, color: "var(--ink-1)",
        marginBottom: 12,
      }}>rui@thequietreader.com</div>

      <Btn variant="primary" size="lg" iconRight={<IconArrowRight size={14} />}
        style={{ width: "100%", justifyContent: "space-between", padding: "13px 18px" }}>
        <span style={{ flex: 1, textAlign: "left" }}>Continue with email</span>
      </Btn>

      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        margin: "20px 0",
      }}>
        <span style={{ flex: 1, height: 1, background: "var(--line-1)" }} />
        <span className="eyebrow">or</span>
        <span style={{ flex: 1, height: 1, background: "var(--line-1)" }} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Btn variant="quiet" size="md" style={{ width: "100%", justifyContent: "center" }}>Continue with Google</Btn>
        <Btn variant="quiet" size="md" style={{ width: "100%", justifyContent: "center" }}>Continue with Apple</Btn>
      </div>
    </div>

    <div className="serif" style={{
      fontFamily: "var(--font-serif)", fontStyle: "italic",
      fontSize: 13, color: "var(--ink-3)", textAlign: "center", lineHeight: 1.55,
    }}>
      No account?{" "}
      <span style={{
        color: "var(--ink-1)", borderBottom: "1px solid var(--line-2)",
        paddingBottom: 1, cursor: "pointer", fontStyle: "normal",
      }}>Astra works without one.</span> Your library will live on this device only.
    </div>
  </div>
);

const StatCol = ({ n, label, sub }) => (
  <div>
    <div className="serif" style={{
      fontFamily: "var(--font-serif)", fontSize: 44,
      letterSpacing: "-0.025em", lineHeight: 1, color: "var(--ink-1)",
    }}>{n}</div>
    <div style={{
      fontFamily: "var(--font-sans)", fontSize: 13,
      color: "var(--ink-2)", marginTop: 6,
    }}>{label}</div>
    {sub ? (
      <div className="serif" style={{
        fontFamily: "var(--font-serif)", fontStyle: "italic",
        fontSize: 12, color: "var(--ink-3)", marginTop: 2,
      }}>{sub}</div>
    ) : null}
  </div>
);

const AccountFrame = ({ direction = "quiet" }) => (
  <div data-astra={direction} className="astra-frame astra-root" style={{
    width: 1280, height: 900, background: "var(--bg-page)",
    color: "var(--ink-1)", display: "flex", flexDirection: "column",
    boxSizing: "border-box",
  }}>
    {/* top bar */}
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "16px 36px", borderBottom: "1px solid var(--line-1)",
      background: "var(--bg-surface)",
    }}>
      <AstraWordmark size={17} />
      <span style={{ flex: 1 }} />
      <Btn variant="quiet" size="sm" icon={<IconSettings size={13} />}>Settings</Btn>
      <Btn variant="ghost" size="sm">Sign out</Btn>
    </div>

    <div style={{ overflow: "auto", padding: "36px 48px 44px" }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 22, marginBottom: 32 }}>
        <div style={{
          width: 88, height: 88, borderRadius: 16,
          background: "var(--bg-sunken)", border: "1px solid var(--line-2)",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
        }}>
          <span className="serif" style={{
            fontFamily: "var(--font-serif)", fontSize: 40,
            letterSpacing: "-0.02em", color: "var(--ink-1)", fontWeight: 500,
          }}>R</span>
        </div>
        <div style={{ flex: 1 }}>
          <div className="eyebrow" style={{ marginBottom: 4 }}>Account</div>
          <h1 className="serif" style={{
            fontFamily: "var(--font-serif)", fontSize: 36,
            letterSpacing: "-0.022em", margin: 0, fontWeight: 500, lineHeight: 1.1,
          }}>Rui Chen</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
            <span style={{
              fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-3)",
            }}>rui@thequietreader.com</span>
            <Pill tone="accent"><IconStar size={10} /> Pro</Pill>
            <span style={{
              fontFamily: "var(--font-serif)", fontStyle: "italic",
              fontSize: 13, color: "var(--ink-3)",
            }}>since Jan 2026</span>
          </div>
        </div>
        <Btn variant="quiet" size="md">Edit profile</Btn>
      </div>

      {/* stats row */}
      <Card padded={false} style={{ padding: "24px 28px", marginBottom: 24 }}>
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 32,
        }}>
          <StatCol n="248" label="words saved" sub="62 mastered" />
          <StatCol n="91" label="articles read" sub="this year" />
          <StatCol n="14d" label="streak" sub="longest 41 days" />
          <StatCol n="2,341" label="translations" sub="this month" />
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 24 }}>
        {/* left: subscription + sync */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card padded={false} style={{ padding: "22px 26px" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 12 }}>
              <span className="eyebrow">Plan</span>
              <span style={{ flex: 1 }} />
              <Btn variant="ghost" size="sm" icon={<IconArrowUpRight size={11} />}>Manage billing</Btn>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
              <span className="serif" style={{
                fontFamily: "var(--font-serif)", fontSize: 26,
                letterSpacing: "-0.018em", color: "var(--ink-1)", fontWeight: 500,
              }}>Astra Pro</span>
              <span style={{
                fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-3)",
              }}>$8/mo · renews May 14</span>
            </div>
            <div className="serif" style={{
              fontFamily: "var(--font-serif)", fontStyle: "italic",
              fontSize: 14, color: "var(--ink-2)", marginTop: 6, lineHeight: 1.55,
            }}>Unlimited page translations · Astra relay engine · cross-device sync · EPUB &amp; PDF reader.</div>
          </Card>

          <Card padded={false} style={{ padding: "22px 26px" }}>
            <div className="eyebrow" style={{ marginBottom: 12 }}>Sync</div>
            {[
              { d: "MacBook Air", l: "this device · Chrome 124", t: "now" },
              { d: "iPhone 15", l: "Safari iOS 18", t: "2h ago" },
              { d: "Studio Display", l: "Chrome 123", t: "yesterday" },
            ].map((d, i, arr) => (
              <div key={d.d} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "10px 0",
                borderBottom: i === arr.length - 1 ? "none" : "1px solid var(--line-1)",
              }}>
                <span style={{
                  width: 8, height: 8, borderRadius: 99, background: "var(--ok)",
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontFamily: "var(--font-sans)", fontSize: 13,
                    color: "var(--ink-1)", fontWeight: 500,
                  }}>{d.d}</div>
                  <div style={{
                    fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-4)",
                    letterSpacing: "0.04em",
                  }}>{d.l.toUpperCase()}</div>
                </div>
                <span style={{
                  fontFamily: "var(--font-serif)", fontStyle: "italic",
                  fontSize: 12, color: "var(--ink-3)",
                }}>last seen {d.t}</span>
              </div>
            ))}
          </Card>
        </div>

        {/* right: data + danger */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card padded={false} style={{ padding: "22px 26px" }}>
            <div className="eyebrow" style={{ marginBottom: 10 }}>Your data</div>
            <div className="serif" style={{
              fontFamily: "var(--font-serif)", fontSize: 15,
              color: "var(--ink-2)", lineHeight: 1.55, marginBottom: 14,
            }}>Everything Astra knows about your reading is yours to take with you. No lock-in, no waiting.</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <Btn variant="quiet" size="sm" icon={<IconArrowUpRight size={11} />}>Export library (JSON)</Btn>
              <Btn variant="quiet" size="sm" icon={<IconArrowUpRight size={11} />}>Export reading history</Btn>
              <Btn variant="quiet" size="sm" icon={<IconArrowUpRight size={11} />}>Export site rules</Btn>
            </div>
          </Card>

          <Card padded={false} style={{ padding: "22px 26px" }}>
            <div className="eyebrow" style={{ marginBottom: 10 }}>Quiet zone</div>
            <div className="serif" style={{
              fontFamily: "var(--font-serif)", fontSize: 15,
              color: "var(--ink-2)", lineHeight: 1.55, marginBottom: 14,
            }}>If you'd rather Astra stop watching for a while, or forget you entirely.</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <Btn variant="quiet" size="sm">Pause sync for 7 days</Btn>
              <Btn variant="quiet" size="sm">Sign out everywhere</Btn>
              <Btn variant="ghost" size="sm" style={{ color: "var(--danger)" }}>Delete account &amp; data</Btn>
            </div>
          </Card>
        </div>
      </div>
    </div>
  </div>
);

const PlanCard = ({ tier, price, sub, features, cta, current, featured }) => (
  <div style={{
    padding: "26px 26px 22px",
    background: featured ? "var(--bg-elevated)" : "var(--bg-surface)",
    border: featured ? "1.5px solid var(--ink-1)" : "1px solid var(--line-1)",
    borderRadius: 14,
    boxShadow: featured ? "var(--shadow-md)" : "none",
    display: "flex", flexDirection: "column",
    position: "relative",
  }}>
    {featured ? (
      <div style={{
        position: "absolute", top: -10, left: 22,
        padding: "3px 9px", background: "var(--ink-1)", color: "var(--bg-page)",
        fontFamily: "var(--font-sans)", fontSize: 10, letterSpacing: "0.06em",
        textTransform: "uppercase", borderRadius: 99, fontWeight: 500,
      }}>Most readers</div>
    ) : null}
    <div className="eyebrow" style={{ marginBottom: 8 }}>{tier}</div>
    <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
      <span className="serif" style={{
        fontFamily: "var(--font-serif)", fontSize: 44,
        letterSpacing: "-0.025em", color: "var(--ink-1)", fontWeight: 500, lineHeight: 1,
      }}>{price}</span>
      <span style={{
        fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--ink-3)",
      }}>{sub}</span>
    </div>
    <div className="serif" style={{
      fontFamily: "var(--font-serif)", fontStyle: "italic",
      fontSize: 14, color: "var(--ink-2)", lineHeight: 1.55,
      marginBottom: 18, minHeight: 44,
    }}>{features.tagline}</div>

    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 22 }}>
      {features.list.map((f, i) => (
        <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <IconCheck size={12} style={{ color: f.muted ? "var(--ink-4)" : "var(--ink-1)", marginTop: 4, flexShrink: 0 }} />
          <span className="serif" style={{
            fontFamily: "var(--font-serif)", fontSize: 14,
            color: f.muted ? "var(--ink-3)" : "var(--ink-2)", lineHeight: 1.5,
          }}>{f.t}</span>
        </div>
      ))}
    </div>

    {current ? (
      <Btn variant="quiet" size="md" style={{ width: "100%", justifyContent: "center" }}>Current plan</Btn>
    ) : featured ? (
      <Btn variant="primary" size="md" style={{ width: "100%", justifyContent: "center" }}>{cta}</Btn>
    ) : (
      <Btn variant="ghost" size="md" style={{ width: "100%", justifyContent: "center" }}>{cta}</Btn>
    )}
  </div>
);

const PlansFrame = ({ direction = "quiet" }) => (
  <div data-astra={direction} className="astra-frame astra-root" style={{
    width: 1280, height: 900, background: "var(--bg-page)",
    color: "var(--ink-1)", padding: "44px 56px",
    boxSizing: "border-box", overflow: "auto",
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
      <AstraMark size={14} stroke={1.6} />
      <span className="eyebrow">Plans · billed yearly saves 20%</span>
    </div>
    <h1 className="serif" style={{
      fontFamily: "var(--font-serif)", fontSize: 44,
      letterSpacing: "-0.025em", margin: "4px 0 6px", fontWeight: 500, lineHeight: 1.05,
    }}>Astra grows with how you read.</h1>
    <p className="serif" style={{
      fontFamily: "var(--font-serif)", fontStyle: "italic",
      fontSize: 18, color: "var(--ink-2)", lineHeight: 1.55,
      maxWidth: 600, margin: "0 0 28px",
    }}>The free plan stays useful forever. Pro is for people who read a lot, in a lot of languages, on a lot of devices.</p>

    {/* segment */}
    <div style={{
      display: "inline-flex", padding: 3, marginBottom: 24,
      background: "var(--bg-sunken)", border: "1px solid var(--line-1)",
      borderRadius: 10,
    }}>
      <span style={{
        padding: "7px 18px", borderRadius: 7,
        fontFamily: "var(--font-sans)", fontSize: 13,
        color: "var(--ink-3)", cursor: "pointer",
      }}>Monthly</span>
      <span style={{
        padding: "7px 18px", borderRadius: 7,
        fontFamily: "var(--font-sans)", fontSize: 13,
        color: "var(--ink-1)", fontWeight: 500,
        background: "var(--bg-elevated)", boxShadow: "var(--shadow-sm)",
        cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
      }}>Yearly <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--accent)" }}>−20%</span></span>
    </div>

    <div style={{
      display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20,
    }}>
      <PlanCard
        tier="Free"
        price="$0"
        sub="forever"
        cta="Stay on Free"
        current
        features={{
          tagline: "Daily-use translation. Everything you need to understand the web.",
          list: [
            { t: "30 page translations / day" },
            { t: "Hover & selection lookup, unlimited" },
            { t: "1 device · local library only" },
            { t: "OpenAI / Gemini direct (your API key)" },
            { t: "Astra relay (10 calls / day)", muted: true },
            { t: "EPUB & PDF reader", muted: true },
          ],
        }}
      />
      <PlanCard
        tier="Pro"
        price="$6.40"
        sub="/ month, billed yearly"
        cta="Upgrade to Pro"
        featured
        features={{
          tagline: "For readers, students, and people who live in two languages.",
          list: [
            { t: "Unlimited page translations" },
            { t: "Astra relay engine — no API key needed" },
            { t: "Library, history & SRS sync across devices" },
            { t: "EPUB · PDF · subtitle reader" },
            { t: "Marginalia AI summaries in Deep Read" },
            { t: "Priority translation routing" },
          ],
        }}
      />
      <PlanCard
        tier="Studio"
        price="$24"
        sub="/ month, billed yearly"
        cta="Talk to us"
        features={{
          tagline: "For teams, classrooms, and serious learners with a lot to translate.",
          list: [
            { t: "Everything in Pro" },
            { t: "5 seats · shared site rules & glossary" },
            { t: "Bring your own model (Claude, GPT-5, custom)" },
            { t: "Per-domain spend caps & analytics" },
            { t: "SSO · audit log" },
            { t: "Priority human support", muted: true },
          ],
        }}
      />
    </div>

    <div style={{
      marginTop: 28, display: "flex", alignItems: "center", gap: 16,
      padding: "16px 20px", background: "var(--bg-surface)",
      border: "1px solid var(--line-1)", borderRadius: 10,
    }}>
      <AstraMark size={14} stroke={1.6} style={{ color: "var(--ink-3)" }} />
      <div className="serif" style={{
        fontFamily: "var(--font-serif)", fontStyle: "italic",
        fontSize: 14, color: "var(--ink-2)", flex: 1, lineHeight: 1.55,
      }}>Astra is built by a small team in Shanghai &amp; SF. Pro pays the model bill so we don't have to sell your reading.</div>
      <Btn variant="ghost" size="sm" icon={<IconArrowUpRight size={11} />}>Read our promise</Btn>
    </div>
  </div>
);

/* ====================================================================
   INLINE INPUT — Grammarly-style composer assist. Shows a textarea
   inside a faux Twitter / Gmail-ish composer with an Astra inline panel
   underneath: native-translation, fluency suggestions, tone checks.
   The whole panel is the same paper card vocabulary, never red squiggles.
   ==================================================================== */

const Suggestion = ({ kind, before, after, why }) => {
  const tone = kind === "fluency" ? "var(--accent)"
    : kind === "tone" ? "var(--hl)"
    : kind === "grammar" ? "var(--warn)"
    : "var(--ink-3)";
  const label = kind === "fluency" ? "More natural"
    : kind === "tone" ? "Tone"
    : kind === "grammar" ? "Grammar"
    : "Vocabulary";
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "auto 1fr auto",
      gap: 14, padding: "14px 16px",
      borderBottom: "1px solid var(--line-1)",
      alignItems: "start",
    }}>
      <span style={{
        width: 3, alignSelf: "stretch", background: tone, borderRadius: 1,
      }} />
      <div>
        <div className="eyebrow" style={{ marginBottom: 4, color: tone }}>{label}</div>
        <div className="serif" style={{
          fontFamily: "var(--font-serif)", fontSize: 15,
          lineHeight: 1.5, color: "var(--ink-1)", marginBottom: 4,
        }}>
          <span style={{
            textDecoration: "line-through", color: "var(--ink-3)",
            textDecorationThickness: 1,
          }}>{before}</span>
          {" → "}
          <span style={{
            background: "var(--accent-tint)", padding: "1px 4px", borderRadius: 3,
            color: "var(--ink-1)",
          }}>{after}</span>
        </div>
        <div className="serif" style={{
          fontFamily: "var(--font-serif)", fontStyle: "italic",
          fontSize: 13, color: "var(--ink-2)", lineHeight: 1.55,
        }}>{why}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
        <Btn variant="quiet" size="sm" style={{ padding: "4px 10px" }}>Accept</Btn>
        <Btn variant="ghost" size="sm" style={{ padding: "4px 10px" }}>Skip</Btn>
      </div>
    </div>
  );
};

const InlineInputFrame = ({ direction = "quiet" }) => (
  <div data-astra={direction} className="astra-frame astra-root" style={{
    width: 1280, height: 900, background: "var(--bg-page)",
    color: "var(--ink-1)", padding: "44px 56px",
    boxSizing: "border-box",
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
      <AstraMark size={12} stroke={1.6} />
      <span className="eyebrow">Inline composer assist</span>
    </div>
    <h1 className="serif" style={{
      fontFamily: "var(--font-serif)", fontSize: 30,
      letterSpacing: "-0.022em", margin: "2px 0 6px", fontWeight: 500,
    }}>Help me say it in English</h1>
    <p className="serif" style={{
      fontFamily: "var(--font-serif)", fontStyle: "italic",
      fontSize: 15, color: "var(--ink-2)", lineHeight: 1.55,
      margin: "0 0 24px", maxWidth: 640,
    }}>Type in 中文 or English. Astra shows a quiet panel below the field — no underlines on top of your text, no surprise corrections.</p>

    <div style={{
      display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 22,
    }}>
      {/* left: composer */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* gmail-ish composer */}
        <Card padded={false} style={{ padding: 0, overflow: "hidden" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "10px 16px", borderBottom: "1px solid var(--line-1)",
            background: "var(--bg-sunken)",
          }}>
            <span style={{
              fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-4)",
              letterSpacing: "0.04em",
            }}>NEW MESSAGE · gmail.com</span>
            <span style={{ flex: 1 }} />
            <span style={{ width: 10, height: 10, borderRadius: 99, background: "var(--line-2)" }} />
            <span style={{ width: 10, height: 10, borderRadius: 99, background: "var(--line-2)" }} />
            <span style={{ width: 10, height: 10, borderRadius: 99, background: "var(--line-2)" }} />
          </div>

          <div style={{
            padding: "12px 18px", borderBottom: "1px solid var(--line-1)",
            display: "flex", alignItems: "baseline", gap: 14,
          }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-4)", width: 36, letterSpacing: "0.04em" }}>TO</span>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--ink-1)" }}>katherine@thegoodessay.co</span>
          </div>
          <div style={{
            padding: "10px 18px", borderBottom: "1px solid var(--line-1)",
            display: "flex", alignItems: "baseline", gap: 14,
          }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-4)", width: 36, letterSpacing: "0.04em" }}>SUBJ</span>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--ink-1)" }}>Following up on the manuscript</span>
          </div>

          {/* body — bilingual hint */}
          <div style={{ padding: "20px 22px", minHeight: 240, background: "var(--bg-elevated)" }}>
            <p className="serif" style={{
              fontFamily: "var(--font-serif)", fontSize: 16,
              lineHeight: 1.65, color: "var(--ink-1)", margin: 0,
            }}>
              Hi Katherine,
            </p>
            <p className="serif" style={{
              fontFamily: "var(--font-serif)", fontSize: 16,
              lineHeight: 1.65, color: "var(--ink-1)", margin: "12px 0 0",
            }}>
              I want to <span style={{
                background: "var(--accent-tint)", padding: "1px 3px", borderRadius: 3,
                borderBottom: "1.5px dotted var(--accent)",
              }}>following up</span> the article we discussed last week. I have <span style={{
                background: "rgba(212,150,75,0.18)", padding: "1px 3px", borderRadius: 3,
                borderBottom: "1.5px dotted var(--hl)",
              }}>finished a revision draft</span> and would like to know your <span style={{
                background: "rgba(212,150,75,0.18)", padding: "1px 3px", borderRadius: 3,
                borderBottom: "1.5px dotted var(--hl)",
              }}>opinion</span>. Could we have a meeting next week?
            </p>

            {/* native-language ghost */}
            <div style={{
              marginTop: 16, paddingTop: 14,
              borderTop: "1px dashed var(--line-2)",
              display: "flex", alignItems: "flex-start", gap: 10,
            }}>
              <AstraMark size={11} stroke={1.6} style={{ color: "var(--ink-4)", marginTop: 4 }} />
              <div>
                <div className="eyebrow" style={{ marginBottom: 4, fontSize: 9, opacity: 0.7 }}>What you meant (中文)</div>
                <p className="serif" style={{
                  fontFamily: "var(--font-serif)", fontStyle: "italic",
                  fontSize: 14, color: "var(--ink-3)", margin: 0, lineHeight: 1.6,
                }}>
                  我想跟进一下我们上周讨论的那篇文章。我已经完成了修订稿，希望听听你的意见。下周方便见个面吗？
                </p>
              </div>
            </div>
          </div>

          <div style={{
            padding: "10px 16px", display: "flex", alignItems: "center", gap: 10,
            borderTop: "1px solid var(--line-1)", background: "var(--bg-sunken)",
          }}>
            <Btn variant="primary" size="sm">Send</Btn>
            <Btn variant="quiet" size="sm">Save draft</Btn>
            <span style={{ flex: 1 }} />
            <span style={{
              fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-4)",
              letterSpacing: "0.04em",
            }}>4 SUGGESTIONS · ⌥A TO ACCEPT ALL</span>
          </div>
        </Card>

        <div className="serif" style={{
          fontFamily: "var(--font-serif)", fontStyle: "italic",
          fontSize: 13, color: "var(--ink-3)", lineHeight: 1.55, marginTop: 4,
        }}>
          Astra never overpaints what you typed. Underlines are dotted, dim, and only visible on hover. Suggestions live in the panel on the right.
        </div>
      </div>

      {/* right: suggestion panel */}
      <Card padded={false} style={{ padding: 0, alignSelf: "start", overflow: "hidden" }}>
        <div style={{
          padding: "16px 20px", borderBottom: "1px solid var(--line-1)",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <AstraMark size={13} stroke={1.6} />
          <div style={{ flex: 1 }}>
            <div className="eyebrow" style={{ marginBottom: 2 }}>Astra suggests</div>
            <div className="serif" style={{
              fontFamily: "var(--font-serif)", fontSize: 18,
              letterSpacing: "-0.012em", color: "var(--ink-1)", fontWeight: 500,
            }}>4 changes · 1 grammar · 2 tone · 1 word</div>
          </div>
          <Btn variant="quiet" size="sm">Accept all</Btn>
        </div>

        <Suggestion
          kind="grammar"
          before="following up"
          after="follow up on"
          why="“Want to” takes the bare infinitive, and “follow up” needs the preposition “on” when followed by an object."
        />
        <Suggestion
          kind="tone"
          before="finished a revision draft"
          after="put together a revised draft"
          why="“Finished a revision draft” is grammatically fine but feels stiff to a native ear. The replacement keeps the meaning and reads more like an email between colleagues."
        />
        <Suggestion
          kind="fluency"
          before="know your opinion"
          after="hear what you think"
          why="“Hear what you think” is the phrase a native speaker would actually use. “Know your opinion” is technically correct but reads as translated."
        />
        <Suggestion
          kind="vocab"
          before="have a meeting"
          after="catch up"
          why="For two people who already know each other, “catch up” is warmer than the more formal “have a meeting.” Use “have a meeting” for groups or external partners."
        />

        <div style={{
          padding: "12px 18px",
          background: "var(--bg-sunken)",
          borderTop: "1px solid var(--line-1)",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-4)",
            letterSpacing: "0.04em",
          }}>SOUNDS LIKE · NATIVE EMAIL · WARM</span>
          <span style={{ flex: 1 }} />
          <Btn variant="ghost" size="sm">Change tone</Btn>
        </div>
      </Card>
    </div>
  </div>
);

Object.assign(window, { SiteRulesFrame, SignInFrame, AccountFrame, PlansFrame, InlineInputFrame });
})();
