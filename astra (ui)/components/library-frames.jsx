;(function(){
const {
  AstraMark, AstraWordmark,
  IconBookmark, IconClose, IconCheck, IconArrowRight, IconSearch,
  IconChevronRight, IconBook, IconClock, IconHighlighter,
  Card, Btn, Pill, Toggle, Divider,
} = window;

/* ====================================================================
   6. Word add/edit · 7. Reading history timeline · 8. Library search
   ==================================================================== */

const WordEditFrame = ({ direction = "quiet" }) => (
  <div data-astra={direction} className="astra-frame astra-root" style={{
    width: "100%", height: "100%", background: "var(--bg-page)",
    padding: "40px 60px", boxSizing: "border-box", overflow: "hidden",
    display: "flex", alignItems: "center", justifyContent: "center",
  }}>
    <div style={{
      width: 720, background: "var(--bg-surface)",
      border: "1px solid var(--line-1)", borderRadius: 12,
      boxShadow: "var(--shadow-lg)", overflow: "hidden",
    }}>
      <div style={{
        padding: "16px 22px", display: "flex", alignItems: "center", gap: 10,
        borderBottom: "1px solid var(--line-1)",
      }}>
        <div className="eyebrow">Edit word</div>
        <span style={{ flex: 1 }} />
        <button style={{ background: "transparent", border: 0, color: "var(--ink-3)", cursor: "pointer", padding: 4, display: "flex" }}>
          <IconClose size={14} />
        </button>
      </div>

      <div style={{ padding: "22px 28px 28px" }}>
        {/* Hero word + pos */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 8 }}>
          <input defaultValue="effervescent" style={{
            fontFamily: "var(--font-serif)", fontSize: 44, fontWeight: 400,
            letterSpacing: "-0.02em", color: "var(--ink-1)", lineHeight: 1.05,
            background: "transparent", border: 0, padding: 0,
            borderBottom: "1px dashed var(--line-2)", outline: "none",
            flex: 1, minWidth: 0,
          }} />
          <Pill>adj.</Pill>
        </div>
        <div className="mono" style={{ color: "var(--ink-3)", marginBottom: 20 }}>
          /ˌɛf.ərˈvɛs.ənt/
        </div>

        {/* Field rows */}
        {[
          ["Translation", "活泼的；冒泡的", false],
          ["Note", "用于人时偏褒义；用于饮料时是字面义", true],
        ].map(([label, val, area]) => (
          <div key={label} style={{ marginBottom: 18 }}>
            <div className="eyebrow" style={{ marginBottom: 6 }}>{label}</div>
            {area ? (
              <textarea defaultValue={val} rows={2} style={{
                width: "100%", padding: "10px 12px",
                background: "var(--bg-elevated)", border: "1px solid var(--line-1)",
                borderRadius: 6, fontFamily: "var(--font-serif)", fontSize: 14,
                color: "var(--ink-1)", lineHeight: 1.5, resize: "vertical",
                outline: "none", boxSizing: "border-box",
                fontStyle: "italic",
              }} />
            ) : (
              <input defaultValue={val} style={{
                width: "100%", padding: "10px 12px", boxSizing: "border-box",
                background: "var(--bg-elevated)", border: "1px solid var(--line-1)",
                borderRadius: 6, fontFamily: "var(--font-serif)", fontSize: 16,
                color: "var(--ink-1)", outline: "none",
              }} />
            )}
          </div>
        ))}

        {/* Sentence bank */}
        <div className="eyebrow" style={{ marginBottom: 8 }}>Sentences from your reading</div>
        <div style={{ display: "grid", gap: 6, marginBottom: 18 }}>
          {[
            ["She gave an effervescent welcome to the new arrivals.", "newyorker.com · Apr 18"],
            ["The lecture was effervescent — almost too much so.", "lrb.co.uk · Apr 11"],
          ].map(([s, src]) => (
            <div key={s} style={{
              padding: "10px 12px", background: "var(--bg-elevated)",
              border: "1px solid var(--line-1)", borderRadius: 6,
              display: "flex", gap: 12, alignItems: "flex-start",
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "var(--font-serif)", fontSize: 14, color: "var(--ink-1)", lineHeight: 1.5 }}>
                  {s.split("effervescent").map((p, i, arr) => (
                    <React.Fragment key={i}>
                      {p}
                      {i < arr.length - 1 ? (
                        <span style={{
                          borderBottom: "2px solid var(--accent)",
                          paddingBottom: 1, color: "var(--ink-1)",
                        }}>effervescent</span>
                      ) : null}
                    </React.Fragment>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: "var(--ink-3)", fontStyle: "italic", marginTop: 3, fontFamily: "var(--font-serif)" }}>
                  {src}
                </div>
              </div>
              <button style={{ background: "transparent", border: 0, color: "var(--ink-4)", cursor: "pointer", padding: 2, display: "flex" }}>
                <IconClose size={12} />
              </button>
            </div>
          ))}
        </div>

        {/* Tags */}
        <div className="eyebrow" style={{ marginBottom: 8 }}>Tags</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 22 }}>
          {["adjectives", "GRE", "longform"].map(t => (
            <Pill key={t} tone="default">
              {t}
              <span style={{ marginLeft: 4, color: "var(--ink-4)", display: "inline-flex" }}>
                <IconClose size={10} />
              </span>
            </Pill>
          ))}
          <Pill tone="default" style={{ borderStyle: "dashed", color: "var(--ink-3)", cursor: "pointer" }}>+ Add tag</Pill>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Btn variant="primary" size="md" icon={<IconCheck size={13} stroke={2} />}>Save changes</Btn>
          <Btn variant="ghost" size="md">Mark as mastered</Btn>
          <span style={{ flex: 1 }} />
          <button style={{
            background: "transparent", border: 0,
            color: "var(--danger)", fontSize: 13, cursor: "pointer",
            fontFamily: "var(--font-sans)", fontWeight: 500, letterSpacing: "-0.005em",
          }}>Delete word</button>
        </div>
      </div>
    </div>
  </div>
);

/* =============== READING HISTORY TIMELINE ================ */

const HistoryRow = ({ when, title, host, savedCount, mins, words }) => (
  <div style={{
    padding: "14px 0", borderBottom: "1px solid var(--line-1)",
    display: "grid", gridTemplateColumns: "100px 1fr 240px", gap: 24, alignItems: "flex-start",
  }}>
    <div style={{ fontSize: 12, color: "var(--ink-3)", fontStyle: "italic", fontFamily: "var(--font-serif)", paddingTop: 4 }}>
      {when}
    </div>
    <div>
      <div style={{ fontFamily: "var(--font-serif)", fontSize: 18, color: "var(--ink-1)", lineHeight: 1.3, fontWeight: 400 }}>
        {title}
      </div>
      <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 4, fontFamily: "var(--font-mono)" }}>
        {host} · {mins} min · {savedCount} saved
      </div>
    </div>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
      {words.map(w => (
        <span key={w} style={{
          padding: "2px 8px", fontSize: 12,
          fontFamily: "var(--font-serif)",
          color: "var(--ink-2)",
          background: "var(--bg-surface)",
          border: "1px solid var(--line-1)",
          borderRadius: 999,
        }}>{w}</span>
      ))}
    </div>
  </div>
);

const HistoryFrame = ({ direction = "quiet" }) => (
  <div data-astra={direction} className="astra-frame astra-root" style={{
    width: "100%", height: "100%", background: "var(--bg-page)",
    padding: "44px 60px", boxSizing: "border-box", overflow: "hidden",
  }}>
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <div className="eyebrow">Reading log</div>
      <h1 style={{
        fontFamily: "var(--font-serif)", fontSize: 40, fontWeight: 400,
        letterSpacing: "-0.025em", lineHeight: 1.1, margin: "10px 0 4px",
        color: "var(--ink-1)",
      }}>
        What you read this month.
      </h1>
      <p style={{
        fontFamily: "var(--font-serif)", fontStyle: "italic",
        fontSize: 16, color: "var(--ink-3)", margin: "6px 0 28px",
      }}>
        24 articles · 142 words saved · 4h 18m of reading
      </p>

      <div className="eyebrow" style={{ marginBottom: 8 }}>This week</div>
      <HistoryRow
        when="Today"
        title="The Quiet Architecture of Reading"
        host="newyorker.com" savedCount={5} mins={12}
        words={["solitude", "marginalia", "suspended", "companion", "overpaint"]}
      />
      <HistoryRow
        when="Yesterday"
        title="On Translation as Silence"
        host="lrb.co.uk" savedCount={3} mins={9}
        words={["effervescent", "taciturn", "interleaved"]}
      />
      <HistoryRow
        when="Apr 30"
        title="Why we underline"
        host="paris-review.org" savedCount={7} mins={18}
        words={["palimpsest", "marginal", "deciphering", "annotate", "+3"]}
      />

      <div className="eyebrow" style={{ marginTop: 28, marginBottom: 8 }}>Last week</div>
      <HistoryRow
        when="Apr 28"
        title="A Brief History of the Footnote"
        host="aeon.co" savedCount={4} mins={14}
        words={["citation", "scholar", "pedantic", "reference"]}
      />
      <HistoryRow
        when="Apr 26"
        title="The lost art of slow reading"
        host="theguardian.com" savedCount={2} mins={7}
        words={["dwindle", "linger"]}
      />
      <HistoryRow
        when="Apr 24"
        title="Notes on attention"
        host="craigmod.com" savedCount={6} mins={11}
        words={["attentive", "fugue", "wander", "notice", "distill", "+1"]}
      />

      <div style={{
        marginTop: 28, display: "flex", justifyContent: "center",
      }}>
        <Btn variant="ghost" size="md">View earlier reading</Btn>
      </div>
    </div>
  </div>
);

/* =============== LIBRARY SEARCH ================ */

const LibrarySearchFrame = ({ direction = "quiet" }) => (
  <div data-astra={direction} className="astra-frame astra-root" style={{
    width: "100%", height: "100%", background: "var(--bg-page)",
    padding: "44px 60px", boxSizing: "border-box", overflow: "hidden",
  }}>
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <div className="eyebrow">Search · 142 words in your library</div>

      {/* Search box */}
      <div style={{
        marginTop: 12, padding: "14px 18px",
        background: "var(--bg-surface)", border: "1px solid var(--line-2)",
        borderRadius: 10, display: "flex", alignItems: "center", gap: 12,
        boxShadow: "var(--ring)",
      }}>
        <IconSearch size={18} style={{ color: "var(--ink-2)" }} />
        <input defaultValue="quiet" style={{
          flex: 1, background: "transparent", border: 0,
          fontFamily: "var(--font-serif)", fontSize: 22, color: "var(--ink-1)",
          outline: "none", letterSpacing: "-0.01em",
        }} />
        <span style={{ display: "flex", gap: 6 }}>
          <Pill tone="accent">word</Pill>
          <Pill>sentence</Pill>
          <Pill>article</Pill>
        </span>
        <Pill>↵ search</Pill>
      </div>

      {/* Filter row */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 14, alignItems: "center" }}>
        <span className="eyebrow" style={{ marginRight: 6 }}>Filter</span>
        <Pill tone="default">All time</Pill>
        <Pill tone="default">Any source</Pill>
        <Pill tone="default">Any status</Pill>
        <Pill tone="default">Any tag</Pill>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: "var(--ink-3)", fontStyle: "italic", fontFamily: "var(--font-serif)" }}>
          7 matches
        </span>
      </div>

      {/* Results — grouped by kind */}
      <div className="eyebrow" style={{ marginTop: 28, marginBottom: 10 }}>In words (3)</div>
      <div style={{ display: "grid", gap: 6 }}>
        {[
          ["quiet", "adj.", "安静的；不张扬的", "due in 2 days"],
          ["disquiet", "n./v.", "不安；使不安", "mastered"],
          ["quietude", "n.", "宁静", "due tomorrow"],
        ].map(([w, p, g, st]) => (
          <div key={w} style={{
            padding: "12px 16px", background: "var(--bg-surface)",
            border: "1px solid var(--line-1)", borderRadius: 8,
            display: "flex", alignItems: "baseline", gap: 14,
          }}>
            <span style={{ fontFamily: "var(--font-serif)", fontSize: 20, color: "var(--ink-1)", minWidth: 140 }}>
              {w.split(/(quiet)/i).map((seg, i) => (
                /quiet/i.test(seg) ? (
                  <span key={i} style={{ background: "var(--accent-soft)", padding: "0 2px", borderRadius: 2 }}>{seg}</span>
                ) : <React.Fragment key={i}>{seg}</React.Fragment>
              ))}
            </span>
            <span className="mono" style={{ color: "var(--ink-3)", minWidth: 50 }}>{p}</span>
            <span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", color: "var(--ink-2)", flex: 1 }}>{g}</span>
            <span style={{ fontSize: 12, color: "var(--ink-3)", fontFamily: "var(--font-serif)", fontStyle: "italic" }}>{st}</span>
          </div>
        ))}
      </div>

      <div className="eyebrow" style={{ marginTop: 22, marginBottom: 10 }}>In saved sentences (3)</div>
      <div style={{ display: "grid", gap: 6 }}>
        {[
          ["The quiet room held only the reader and the writer's voice.", "solitude · newyorker.com · today"],
          ["A quiet companion in the margins.", "marginalia · lrb.co.uk · yesterday"],
          ["She approached the room with quiet attention.", "attentive · craigmod.com · Apr 24"],
        ].map(([s, src]) => (
          <div key={s} style={{
            padding: "12px 16px", background: "var(--bg-surface)",
            border: "1px solid var(--line-1)", borderRadius: 8,
          }}>
            <div style={{ fontFamily: "var(--font-serif)", fontSize: 14, color: "var(--ink-1)", lineHeight: 1.55 }}>
              {s.split(/(quiet)/i).map((seg, i) => (
                /quiet/i.test(seg) ? <span key={i} style={{ background: "var(--accent-soft)" }}>{seg}</span> : <React.Fragment key={i}>{seg}</React.Fragment>
              ))}
            </div>
            <div style={{ fontSize: 11, color: "var(--ink-3)", fontFamily: "var(--font-serif)", fontStyle: "italic", marginTop: 4 }}>
              {src}
            </div>
          </div>
        ))}
      </div>

      <div className="eyebrow" style={{ marginTop: 22, marginBottom: 10 }}>In article titles (1)</div>
      <div style={{
        padding: "12px 16px", background: "var(--bg-surface)",
        border: "1px solid var(--line-1)", borderRadius: 8,
        display: "flex", alignItems: "baseline", gap: 12,
      }}>
        <span style={{ fontFamily: "var(--font-serif)", fontSize: 16, color: "var(--ink-1)" }}>
          The <span style={{ background: "var(--accent-soft)" }}>Quiet</span> Architecture of Reading
        </span>
        <span className="mono" style={{ color: "var(--ink-3)" }}>newyorker.com</span>
        <span style={{ flex: 1 }} />
        <Btn size="sm" variant="ghost" iconRight={<IconArrowRight size={11} />}>Open</Btn>
      </div>
    </div>
  </div>
);

Object.assign(window, { WordEditFrame, HistoryFrame, LibrarySearchFrame });
})();
