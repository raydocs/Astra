;(function(){
const {
  AstraMark, AstraWordmark,
  IconLanguages, IconGlobe, IconCheck, IconClose, IconArrowRight, IconChevronDown,
  Card, Btn, Pill, Toggle, Divider,
} = window;

/* ====================================================================
   3. Permissions / site access prompt
   ==================================================================== */

const BrowserChrome = ({ children, host = "newyorker.com" }) => (
  <div style={{
    width: "100%", height: "100%",
    background: "var(--bg-sunken)",
    display: "flex", flexDirection: "column",
    boxSizing: "border-box",
  }}>
    {/* fake browser top */}
    <div style={{
      height: 38, background: "var(--bg-surface)",
      borderBottom: "1px solid var(--line-1)",
      display: "flex", alignItems: "center", gap: 10, padding: "0 16px",
    }}>
      <span style={{ display: "flex", gap: 6 }}>
        {["#e4b9b9", "#e4d3a4", "#bcd6b1"].map(c => (
          <span key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c, opacity: 0.6 }} />
        ))}
      </span>
      <div style={{
        flex: 1, height: 22, padding: "0 12px", borderRadius: 11,
        background: "var(--bg-page)", border: "1px solid var(--line-1)",
        display: "flex", alignItems: "center", fontFamily: "var(--font-mono)",
        fontSize: 11, color: "var(--ink-3)",
      }}>
        <IconGlobe size={11} style={{ marginRight: 6 }} />
        {host}/2026/04/the-quiet-architecture-of-reading
      </div>
      <span style={{
        width: 22, height: 22, borderRadius: 5,
        background: "var(--accent-soft)", border: "1px solid var(--accent-line)",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        color: "var(--accent)",
      }}><AstraMark size={11} /></span>
    </div>
    <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
      {children}
    </div>
  </div>
);

const PermissionFrame = ({ direction = "quiet" }) => (
  <div data-astra={direction} className="astra-frame astra-root" style={{
    width: "100%", height: "100%",
  }}>
    <BrowserChrome>
      {/* dimmed page behind */}
      <div style={{
        position: "absolute", inset: 0,
        background: "var(--bg-page)",
        padding: "60px 100px", opacity: 0.35,
      }}>
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <div style={{ height: 32, width: "70%", background: "var(--ink-1)", opacity: 0.7, borderRadius: 4, marginBottom: 24 }} />
          {[1,1,1,0.6].map((w, i) => (
            <div key={i} style={{ height: 11, width: `${w * 100}%`, background: "var(--ink-2)", opacity: 0.5, borderRadius: 3, marginBottom: 8 }} />
          ))}
        </div>
      </div>

      {/* Permission prompt anchored to the toolbar icon */}
      <div style={{
        position: "absolute", top: 4, right: 16,
        width: 360,
        background: "var(--bg-elevated)",
        border: "1px solid var(--line-1)",
        borderRadius: 12,
        boxShadow: "var(--shadow-lg)",
        overflow: "hidden",
        fontFamily: "var(--font-sans)",
      }}>
        {/* tail */}
        <div style={{
          position: "absolute", top: -7, right: 16,
          width: 12, height: 12,
          background: "var(--bg-elevated)",
          border: "1px solid var(--line-1)",
          borderRight: 0, borderBottom: 0,
          transform: "rotate(45deg)",
        }} />

        <div style={{ padding: "18px 18px 12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <span style={{
              width: 32, height: 32, borderRadius: 7,
              background: "var(--accent-soft)", color: "var(--accent)",
              border: "1px solid var(--accent-line)",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}><AstraMark size={16} /></span>
            <div>
              <div style={{ fontFamily: "var(--font-serif)", fontSize: 17, color: "var(--ink-1)" }}>
                Let Astra read this page?
              </div>
              <div style={{ fontSize: 12, color: "var(--ink-3)", fontFamily: "var(--font-mono)", marginTop: 1 }}>
                newyorker.com
              </div>
            </div>
          </div>
          <p style={{
            fontFamily: "var(--font-serif)", fontSize: 13.5,
            color: "var(--ink-2)", lineHeight: 1.55,
            margin: 0,
          }}>
            Astra reads the article text in your browser, sends it to the
            translation engine, and writes the result alongside it. Nothing
            is stored unless you save a word.
          </p>
        </div>

        <div style={{ padding: "0 18px 12px" }}>
          {[
            ["Just this page", "Once · revoke after the tab closes", true],
            ["This site forever", "newyorker.com", false],
            ["All sites you visit", "Set once, forget", false],
          ].map(([t, s, sel]) => (
            <div key={t} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 12px", marginBottom: 6,
              background: sel ? "var(--accent-soft)" : "transparent",
              border: `1px solid ${sel ? "var(--accent-line)" : "var(--line-1)"}`,
              borderRadius: 8, cursor: "pointer",
            }}>
              <span style={{
                width: 14, height: 14, borderRadius: "50%",
                border: "1.5px solid " + (sel ? "var(--accent)" : "var(--line-2)"),
                background: sel ? "var(--accent)" : "transparent",
                flexShrink: 0,
              }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: "var(--ink-1)", fontWeight: 500 }}>{t}</div>
                <div style={{ fontSize: 11, color: "var(--ink-3)", fontStyle: "italic", marginTop: 1 }}>{s}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{
          padding: "12px 18px", borderTop: "1px solid var(--line-1)",
          background: "var(--bg-surface)",
          display: "flex", gap: 8,
        }}>
          <Btn variant="ghost" size="sm">Not now</Btn>
          <span style={{ flex: 1 }} />
          <Btn variant="primary" size="sm" iconRight={<IconArrowRight size={12} stroke={2} />}>
            Allow
          </Btn>
        </div>

        <div style={{
          padding: "8px 18px", fontSize: 11, color: "var(--ink-3)",
          fontStyle: "italic", borderTop: "1px solid var(--line-1)",
          background: "var(--bg-sunken)",
        }}>
          You can change site access at chrome://extensions or in Astra's Settings.
        </div>
      </div>
    </BrowserChrome>
  </div>
);

Object.assign(window, { PermissionFrame });
})();
