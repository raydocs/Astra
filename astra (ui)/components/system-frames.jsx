;(function(){
const {
  AstraMark, AstraWordmark,
  IconClock, IconBook, IconBookmark, IconClose, IconCheck, IconArrowRight,
  IconChevronRight, IconSettings, IconLanguages,
  Card, Btn, Pill, Toggle, Divider,
} = window;

/* ====================================================================
   9. Notifications · 10. Shortcuts editor · 11. Export/Backup
   ==================================================================== */

const NotificationsFrame = ({ direction = "quiet" }) => (
  <div data-astra={direction} className="astra-frame astra-root" style={{
    width: "100%", height: "100%", background: "var(--bg-page)",
    padding: "32px 36px", boxSizing: "border-box", overflow: "hidden",
    display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20,
  }}>
    {/* Left — system notification */}
    <div>
      <div className="eyebrow" style={{ marginBottom: 8 }}>1 · System notification</div>
      <p style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", color: "var(--ink-3)", fontSize: 13, marginTop: 0, marginBottom: 16 }}>
        Native OS toast. Once per day at the user's chosen hour. Never sound. Never red.
      </p>
      <div style={{
        background: "var(--bg-elevated)", border: "1px solid var(--line-1)",
        borderRadius: 12, padding: "14px 16px", boxShadow: "var(--shadow-md)",
        display: "grid", gridTemplateColumns: "32px 1fr auto", gap: 12, alignItems: "center",
      }}>
        <span style={{
          width: 32, height: 32, borderRadius: 7,
          background: "var(--accent-soft)", color: "var(--accent)",
          border: "1px solid var(--accent-line)",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
        }}><AstraMark size={15} /></span>
        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 500, color: "var(--ink-1)" }}>Astra</span>
            <span style={{ fontSize: 11, color: "var(--ink-3)" }}>now</span>
          </div>
          <div style={{ fontFamily: "var(--font-serif)", fontSize: 14, color: "var(--ink-1)", marginTop: 2, lineHeight: 1.4 }}>
            Twelve words to revisit.
          </div>
          <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 13, color: "var(--ink-3)", marginTop: 2 }}>
            About four minutes — open when you have a moment.
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <Btn size="sm" variant="primary">Review</Btn>
          <Btn size="sm" variant="quiet">Later</Btn>
        </div>
      </div>

      {/* In-popup banner */}
      <div className="eyebrow" style={{ marginTop: 24, marginBottom: 8 }}>2 · Inside the popup</div>
      <p style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", color: "var(--ink-3)", fontSize: 13, marginTop: 0, marginBottom: 16 }}>
        Soft banner; never blocks the primary action.
      </p>
      <div style={{
        width: 320, background: "var(--bg-surface)",
        border: "1px solid var(--line-1)", borderRadius: 10, overflow: "hidden",
        boxShadow: "var(--shadow-md)",
      }}>
        <div style={{ padding: 16, borderBottom: "1px solid var(--line-1)" }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>This page</div>
          <div style={{ fontFamily: "var(--font-serif)", fontSize: 17, color: "var(--ink-1)", letterSpacing: "-0.01em", lineHeight: 1.3 }}>
            On Translation as Silence
          </div>
        </div>
        <div style={{
          padding: "12px 16px", background: "var(--accent-soft)",
          borderTop: "1px solid var(--accent-line)",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <IconClock size={14} style={{ color: "var(--accent)" }} />
          <div style={{ flex: 1, fontSize: 12.5, color: "var(--ink-2)", fontFamily: "var(--font-serif)", fontStyle: "italic" }}>
            12 words due since this morning.
          </div>
          <span style={{ fontSize: 11, color: "var(--accent)", fontFamily: "var(--font-sans)", fontWeight: 500 }}>Review →</span>
        </div>
      </div>
    </div>

    {/* Right — preference panel */}
    <div>
      <div className="eyebrow" style={{ marginBottom: 8 }}>3 · How they're triggered</div>
      <p style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", color: "var(--ink-3)", fontSize: 13, marginTop: 0, marginBottom: 16 }}>
        User-controlled, defaults to once per day, sleeps if you've already reviewed.
      </p>
      <Card padded={false} style={{ overflow: "hidden" }}>
        {[
          { t: "Daily reminder", s: "One notification per day", a: <Toggle on /> },
          { t: "Time", s: "Picks the hour you usually open browser", a: <Pill>9:00 am</Pill> },
          { t: "Cap", s: "Never more than", a: <Pill>1/day</Pill> },
          { t: "Skip if reviewed", s: "Don't ping if today's queue is clear", a: <Toggle on /> },
          { t: "Vacation mode", s: "Pause for a week at a time", a: <Btn size="sm" variant="ghost">Set…</Btn> },
        ].map((r, i, arr) => (
          <div key={r.t} style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "14px 16px",
            borderBottom: i < arr.length - 1 ? "1px solid var(--line-1)" : "none",
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, color: "var(--ink-1)", fontWeight: 500 }}>{r.t}</div>
              <div style={{ fontSize: 12, color: "var(--ink-3)", fontStyle: "italic", marginTop: 1, fontFamily: "var(--font-serif)" }}>{r.s}</div>
            </div>
            {r.a}
          </div>
        ))}
      </Card>

      <div style={{
        marginTop: 16, padding: 14,
        background: "var(--bg-surface)", border: "1px dashed var(--line-2)",
        borderRadius: 8, display: "flex", gap: 10, alignItems: "flex-start",
      }}>
        <AstraMark size={14} style={{ color: "var(--accent)", marginTop: 2 }} />
        <p style={{ margin: 0, fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 13, color: "var(--ink-2)", lineHeight: 1.55 }}>
          Astra never sends marketing pushes. Notifications are only ever about your own reading queue.
        </p>
      </div>
    </div>
  </div>
);

/* =============== SHORTCUTS EDITOR ================ */

const Key = ({ children }) => (
  <span className="mono" style={{
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    minWidth: 22, height: 22, padding: "0 6px",
    background: "var(--bg-elevated)", border: "1px solid var(--line-2)",
    borderRadius: 4, fontSize: 12, color: "var(--ink-1)",
    boxShadow: "0 1px 0 var(--line-1)",
  }}>{children}</span>
);

const ShortcutRow = ({ label, desc, keys, conflict }) => (
  <div style={{
    display: "grid", gridTemplateColumns: "1fr auto",
    padding: "12px 16px", borderBottom: "1px solid var(--line-1)",
    alignItems: "center", gap: 16,
  }}>
    <div>
      <div style={{ fontSize: 14, color: "var(--ink-1)", fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 12, color: "var(--ink-3)", fontStyle: "italic", marginTop: 1, fontFamily: "var(--font-serif)" }}>{desc}</div>
      {conflict ? (
        <div style={{ marginTop: 5, display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--warn)", fontFamily: "var(--font-sans)" }}>
          <span style={{ width: 5, height: 5, borderRadius: 5, background: "var(--warn)" }} />
          Also used by Gmail · Astra wins
        </div>
      ) : null}
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ display: "flex", gap: 4 }}>
        {keys.map((k, i) => <Key key={i}>{k}</Key>)}
      </span>
      <Btn size="sm" variant="quiet" style={{ padding: "4px 8px" }}>Edit</Btn>
    </div>
  </div>
);

const ShortcutsFrame = ({ direction = "quiet" }) => (
  <div data-astra={direction} className="astra-frame astra-root" style={{
    width: "100%", height: "100%", background: "var(--bg-page)",
    padding: "44px 60px", boxSizing: "border-box", overflow: "hidden",
  }}>
    <div style={{ maxWidth: 880, margin: "0 auto" }}>
      <div className="eyebrow">Settings · Keyboard</div>
      <h1 style={{
        fontFamily: "var(--font-serif)", fontSize: 36, fontWeight: 400,
        letterSpacing: "-0.025em", lineHeight: 1.1, margin: "8px 0 4px",
        color: "var(--ink-1)",
      }}>
        Shortcuts
      </h1>
      <p style={{
        fontFamily: "var(--font-serif)", fontStyle: "italic",
        fontSize: 16, color: "var(--ink-3)", margin: "4px 0 24px",
      }}>
        Astra binds nothing on first run. Turn on what you'll use.
      </p>

      <Card padded={false} style={{ overflow: "hidden" }}>
        <div style={{ padding: "10px 16px", background: "var(--bg-sunken)", borderBottom: "1px solid var(--line-1)" }}>
          <span className="eyebrow">In-page</span>
        </div>
        <ShortcutRow label="Translate page" desc="Toggle bilingual on the current tab" keys={["⌥", "E"]} />
        <ShortcutRow label="Save selection" desc="Add the highlighted phrase to the library" keys={["⌥", "S"]} conflict />
        <ShortcutRow label="Hover lookup" desc="Show the word card under the cursor" keys={["⇧", "·"]} />
        <ShortcutRow label="Open Deep Read" desc="Lift the article into the reader" keys={["⌥", "⇧", "R"]} />

        <div style={{ padding: "10px 16px", background: "var(--bg-sunken)", borderBottom: "1px solid var(--line-1)", borderTop: "1px solid var(--line-1)" }}>
          <span className="eyebrow">Anywhere</span>
        </div>
        <ShortcutRow label="Command menu" desc="The universal entry — anywhere on the web" keys={["⌘", "K"]} />
        <ShortcutRow label="Open library" desc="Jump to your saved words" keys={["⌥", "L"]} />
        <ShortcutRow label="Start review" desc="Begin the day's spaced session" keys={["⌥", "R"]} />

        <div style={{ padding: "10px 16px", background: "var(--bg-sunken)", borderBottom: "1px solid var(--line-1)", borderTop: "1px solid var(--line-1)" }}>
          <span className="eyebrow">Capture</span>
        </div>
        <ShortcutRow label="Quote a passage" desc="Open the share-card composer" keys={["⌥", "⇧", "Q"]} />
      </Card>

      <div style={{ marginTop: 20, display: "flex", gap: 10, alignItems: "center" }}>
        <Btn variant="ghost" size="md">Reset to defaults</Btn>
        <Btn variant="ghost" size="md">Clear all bindings</Btn>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: "var(--ink-3)", fontStyle: "italic", fontFamily: "var(--font-serif)" }}>
          When two extensions claim a key, Astra silently steps aside.
        </span>
      </div>
    </div>
  </div>
);

/* =============== EXPORT / BACKUP ================ */

const ExportFormatTile = ({ name, desc, ext, sel }) => (
  <button style={{
    textAlign: "left", padding: 14,
    background: sel ? "var(--accent-soft)" : "var(--bg-surface)",
    border: `1px solid ${sel ? "var(--accent-line)" : "var(--line-1)"}`,
    borderRadius: 8, cursor: "pointer", fontFamily: "var(--font-sans)",
    display: "block", width: "100%",
  }}>
    <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
      <span style={{ fontFamily: "var(--font-serif)", fontSize: 17, color: "var(--ink-1)", fontWeight: 400 }}>{name}</span>
      <span className="mono" style={{ color: "var(--ink-3)" }}>{ext}</span>
    </div>
    <div style={{ fontSize: 12, color: "var(--ink-3)", fontStyle: "italic", marginTop: 4, fontFamily: "var(--font-serif)", lineHeight: 1.45 }}>
      {desc}
    </div>
  </button>
);

const ExportFrame = ({ direction = "quiet" }) => (
  <div data-astra={direction} className="astra-frame astra-root" style={{
    width: "100%", height: "100%", background: "var(--bg-page)",
    padding: "44px 60px", boxSizing: "border-box", overflow: "hidden",
  }}>
    <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40 }}>
      <div>
        <div className="eyebrow">Account · Data</div>
        <h1 style={{
          fontFamily: "var(--font-serif)", fontSize: 36, fontWeight: 400,
          letterSpacing: "-0.025em", lineHeight: 1.1, margin: "8px 0 4px",
        }}>
          Export your library
        </h1>
        <p style={{
          fontFamily: "var(--font-serif)", fontStyle: "italic",
          fontSize: 16, color: "var(--ink-3)", margin: "4px 0 24px",
        }}>
          Your reading is yours. Take it anywhere.
        </p>

        <div className="eyebrow" style={{ marginBottom: 8 }}>Format</div>
        <div style={{ display: "grid", gap: 8 }}>
          <ExportFormatTile name="Anki deck" ext=".apkg" sel desc="142 cards · sentence on front, gloss on back. Tags preserved." />
          <ExportFormatTile name="Spreadsheet" ext=".csv" desc="Word, gloss, sentence, source URL, date saved, status, tags." />
          <ExportFormatTile name="Markdown vault" ext=".zip" desc="One .md per word, with backlinks to articles. Drops into Obsidian." />
          <ExportFormatTile name="Astra archive" ext=".astra.json" desc="Lossless. Re-import to any Astra account, on any device." />
        </div>
      </div>

      <div>
        <div className="eyebrow" style={{ marginBottom: 8 }}>What's included</div>
        <Card padded={false} style={{ overflow: "hidden" }}>
          {[
            ["Saved words", "142 entries", true],
            ["Sentence bank", "Up to 5 per word", true],
            ["Reading history", "24 articles · 4h 18m", true],
            ["Site rules", "8 customized domains", false],
            ["Highlights without saved word", "37 standalone quotes", false],
          ].map(([t, s, on], i, arr) => (
            <div key={t} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "12px 16px",
              borderBottom: i < arr.length - 1 ? "1px solid var(--line-1)" : "none",
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, color: "var(--ink-1)", fontWeight: 500 }}>{t}</div>
                <div style={{ fontSize: 12, color: "var(--ink-3)", fontStyle: "italic", marginTop: 1, fontFamily: "var(--font-serif)" }}>{s}</div>
              </div>
              <Toggle on={on} />
            </div>
          ))}
        </Card>

        <div style={{ marginTop: 18, padding: 14, background: "var(--bg-surface)", border: "1px solid var(--line-1)", borderRadius: 8, display: "flex", gap: 12, alignItems: "center" }}>
          <span style={{ width: 28, height: 28, borderRadius: 5, background: "var(--bg-sunken)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--ink-2)", border: "1px solid var(--line-1)" }}>
            <IconClock size={13} />
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: "var(--ink-1)", fontWeight: 500 }}>Automatic weekly backup</div>
            <div style={{ fontSize: 12, color: "var(--ink-3)", fontStyle: "italic", marginTop: 1, fontFamily: "var(--font-serif)" }}>
              Last: Sunday, 9:00 am · to ~/Astra Backups
            </div>
          </div>
          <Toggle on />
        </div>

        <div style={{ marginTop: 24, display: "flex", gap: 10 }}>
          <Btn variant="primary" size="lg" iconRight={<IconArrowRight size={13} stroke={2} />}>
            Export now
          </Btn>
          <Btn variant="ghost" size="lg">Import…</Btn>
        </div>
        <div style={{ marginTop: 12, fontSize: 12, color: "var(--ink-3)", fontStyle: "italic", fontFamily: "var(--font-serif)" }}>
          Files are generated on this device. Astra never uploads your library to export.
        </div>
      </div>
    </div>
  </div>
);

Object.assign(window, { NotificationsFrame, ShortcutsFrame, ExportFrame });
})();
