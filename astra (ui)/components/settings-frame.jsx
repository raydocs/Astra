;(function(){
const {
  AstraMark,
  AstraWordmark,
  IconLanguages,
  IconBook,
  IconBookmark,
  IconArrowRight,
  IconCheck,
  IconClose,
  IconSettings,
  IconGlobe,
  IconList,
  IconChevronRight,
  IconChevronDown,
  IconClock,
  IconHighlighter,
  IconSearch,
  IconStar,
  IconDot,
  IconFlame,
  IconPause,
  Card,
  Btn,
  Pill,
  Toggle,
  Divider,
} = window;

/* ====================================================================
   SETTINGS — full page (1280 × 900)
   Sidebar nav + content. Same primitives as Popup / Onboarding /
   Deep Read. The sidebar lists capabilities; the content area uses
   the same Card + SettingRow + Toggle vocabulary the popup uses,
   but with full-width rows and section headings in serif.
   ==================================================================== */

const NavItem = ({ icon, label, active, badge, indent }) => (
  <button
    style={{
      display: "flex",
      alignItems: "center",
      gap: 10,
      width: "100%",
      padding: indent ? "7px 10px 7px 32px" : "7px 10px",
      background: active ? "var(--bg-elevated)" : "transparent",
      border: active ? "1px solid var(--line-1)" : "1px solid transparent",
      borderRadius: "var(--r-md)",
      color: active ? "var(--ink-1)" : "var(--ink-2)",
      fontSize: 13.5,
      fontFamily: "var(--font-sans)",
      fontWeight: active ? 500 : 400,
      letterSpacing: "-0.005em",
      cursor: "pointer",
      textAlign: "left",
      boxShadow: active ? "var(--shadow-sm)" : "none",
    }}
  >
    <span
      style={{
        width: 16, height: 16,
        color: active ? "var(--ink-1)" : "var(--ink-3)",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {icon}
    </span>
    <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
      {label}
    </span>
    {badge ? (
      <span
        style={{
          fontFamily: "var(--font-serif)",
          fontStyle: "italic",
          fontSize: 12,
          color: "var(--ink-3)",
        }}
      >
        {badge}
      </span>
    ) : null}
  </button>
);

const NavGroup = ({ title, children }) => (
  <div style={{ marginBottom: 18 }}>
    <div className="eyebrow" style={{ padding: "0 10px 6px" }}>{title}</div>
    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
      {children}
    </div>
  </div>
);

/* The reusable settings row.
   Two patterns:
     - inline accessory (toggle / segmented / chevron)
     - stacked content (longer description + control below)
*/
const Row = ({ title, description, accessory, children, last, dense }) => (
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "minmax(0, 1fr) minmax(0, 360px)",
      gap: 32,
      alignItems: "start",
      padding: dense ? "16px 24px" : "22px 28px",
      borderBottom: last ? "none" : "1px solid var(--line-1)",
    }}
  >
    <div>
      <div
        style={{
          fontSize: 14.5,
          color: "var(--ink-1)",
          fontWeight: 500,
          fontFamily: "var(--font-sans)",
          letterSpacing: "-0.005em",
        }}
      >
        {title}
      </div>
      {description ? (
        <div
          style={{
            fontSize: 13,
            color: "var(--ink-3)",
            marginTop: 4,
            lineHeight: 1.5,
            fontFamily: "var(--font-sans)",
            maxWidth: 460,
          }}
        >
          {description}
        </div>
      ) : null}
    </div>
    <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "stretch", justifySelf: "stretch" }}>
      {accessory}
      {children}
    </div>
  </div>
);

/* Form atoms — all share Card / Btn surfaces */
const Select = ({ value, hint }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "9px 12px",
      background: "var(--bg-elevated)",
      border: "1px solid var(--line-1)",
      borderRadius: "var(--r-md)",
      fontSize: 13.5,
      fontFamily: "var(--font-sans)",
      color: "var(--ink-1)",
      cursor: "pointer",
      width: "100%",
      boxSizing: "border-box",
    }}
  >
    <span style={{ flex: 1 }}>{value}</span>
    {hint ? <span style={{ color: "var(--ink-3)", fontSize: 12 }}>{hint}</span> : null}
    <IconChevronDown size={13} stroke={2} />
  </div>
);

const KeyCap = ({ children }) => (
  <kbd
    style={{
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      minWidth: 22,
      height: 22,
      padding: "0 6px",
      background: "var(--bg-elevated)",
      border: "1px solid var(--line-2)",
      borderBottomWidth: 2,
      borderRadius: 5,
      fontFamily: "var(--font-mono)",
      fontSize: 11,
      color: "var(--ink-1)",
      letterSpacing: 0,
    }}
  >
    {children}
  </kbd>
);

const Shortcut = ({ keys }) => (
  <div
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: "8px 12px",
      background: "var(--bg-elevated)",
      border: "1px solid var(--line-1)",
      borderRadius: "var(--r-md)",
      width: "100%",
      boxSizing: "border-box",
    }}
  >
    <span style={{ flex: 1 }} />
    {keys.map((k, i) => (
      <KeyCap key={i}>{k}</KeyCap>
    ))}
  </div>
);

const Segmented = ({ options, active }) => (
  <div
    style={{
      display: "inline-flex",
      padding: 2,
      background: "var(--bg-sunken)",
      borderRadius: "var(--r-md)",
      border: "1px solid var(--line-1)",
      width: "fit-content",
      alignSelf: "flex-end",
    }}
  >
    {options.map((o) => {
      const sel = o === active;
      return (
        <span
          key={o}
          style={{
            padding: "5px 12px",
            fontSize: 12.5,
            fontFamily: "var(--font-sans)",
            color: sel ? "var(--ink-1)" : "var(--ink-3)",
            fontWeight: sel ? 500 : 400,
            background: sel ? "var(--bg-elevated)" : "transparent",
            borderRadius: 5,
            letterSpacing: "-0.005em",
            border: sel ? "1px solid var(--line-1)" : "1px solid transparent",
          }}
        >
          {o}
        </span>
      );
    })}
  </div>
);

const SectionHeading = ({ eyebrow, title, description }) => (
  <div style={{ padding: "32px 28px 18px" }}>
    {eyebrow ? <div className="eyebrow" style={{ marginBottom: 6 }}>{eyebrow}</div> : null}
    <h2
      className="serif"
      style={{
        fontFamily: "var(--font-serif)",
        fontSize: 28,
        fontWeight: 400,
        letterSpacing: "-0.02em",
        margin: 0,
        color: "var(--ink-1)",
        lineHeight: 1.15,
      }}
    >
      {title}
    </h2>
    {description ? (
      <p
        className="serif"
        style={{
          fontFamily: "var(--font-serif)",
          fontStyle: "italic",
          fontSize: 15,
          lineHeight: 1.55,
          color: "var(--ink-2)",
          margin: "8px 0 0",
          maxWidth: 600,
        }}
      >
        {description}
      </p>
    ) : null}
  </div>
);

/* Provider line — a small visual element used in API Providers */
const ProviderLine = ({ name, model, status, last }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 14,
      padding: "14px 16px",
      borderBottom: last ? "none" : "1px solid var(--line-1)",
    }}
  >
    <span
      style={{
        width: 32, height: 32, borderRadius: "var(--r-md)",
        background: "var(--bg-sunken)",
        border: "1px solid var(--line-1)",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        fontFamily: "var(--font-serif)",
        fontStyle: "italic",
        fontSize: 14,
        color: "var(--ink-2)",
      }}
    >
      {name[0]}
    </span>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 14, color: "var(--ink-1)", fontWeight: 500 }}>{name}</div>
      <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 1, fontFamily: "var(--font-mono)" }}>{model}</div>
    </div>
    {status === "active" ? <Pill tone="ok"><IconDot size={6} color="currentColor" /> Active</Pill> : null}
    {status === "configured" ? <Pill tone="default">Configured</Pill> : null}
    {status === "off" ? <Pill tone="default" style={{ color: "var(--ink-3)" }}>Not configured</Pill> : null}
    <Btn variant="ghost" size="sm" iconRight={<IconChevronRight size={12} />}>Edit</Btn>
  </div>
);

/* The page */
const SettingsFrame = ({ direction = "quiet" }) => (
  <div
    data-astra={direction}
    className="astra-frame astra-root"
    style={{
      width: 1280,
      height: 900,
      background: "var(--bg-page)",
      color: "var(--ink-1)",
      fontFamily: "var(--font-sans)",
      display: "grid",
      gridTemplateColumns: "260px 1fr",
      boxSizing: "border-box",
    }}
  >
    {/* SIDEBAR */}
    <aside
      style={{
        background: "var(--bg-surface)",
        borderRight: "1px solid var(--line-1)",
        padding: "24px 14px 24px 18px",
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 6px 18px" }}>
        <AstraMark size={20} stroke={1.6} />
        <span
          className="serif"
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 19,
            letterSpacing: "-0.02em",
            color: "var(--ink-1)",
          }}
        >
          Astra
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--ink-3)",
            marginLeft: 2,
            paddingTop: 4,
          }}
        >
          v2.0
        </span>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 10px",
          background: "var(--bg-elevated)",
          border: "1px solid var(--line-1)",
          borderRadius: "var(--r-md)",
          marginBottom: 18,
          color: "var(--ink-3)",
          fontSize: 13,
        }}
      >
        <IconSearch size={13} />
        <span style={{ flex: 1 }}>Search settings</span>
        <KeyCap>⌘K</KeyCap>
      </div>

      <NavGroup title="Reading">
        <NavItem icon={<IconLanguages size={14} stroke={1.8} />} label="Translation" active />
        <NavItem icon={<IconBook size={14} stroke={1.8} />} label="Deep Read" />
        <NavItem icon={<IconHighlighter size={14} stroke={1.8} />} label="Hover &amp; selection" />
        <NavItem icon={<IconGlobe size={14} stroke={1.8} />} label="Sites &amp; rules" badge="12" />
      </NavGroup>

      <NavGroup title="Learning">
        <NavItem icon={<IconBookmark size={14} stroke={1.8} />} label="Library" badge="248" />
        <NavItem icon={<IconClock size={14} stroke={1.8} />} label="Review schedule" />
        <NavItem icon={<IconFlame size={14} stroke={1.8} />} label="Goals &amp; streaks" />
      </NavGroup>

      <NavGroup title="Engine">
        <NavItem icon={<IconStar size={14} stroke={1.8} />} label="AI providers" />
        <NavItem icon={<IconList size={14} stroke={1.8} />} label="Prompts" />
        <NavItem icon={<IconSettings size={14} stroke={1.8} />} label="Shortcuts" />
      </NavGroup>

      <NavGroup title="Account">
        <NavItem icon={<IconDot size={14} />} label="Profile" />
        <NavItem icon={<IconDot size={14} />} label="Sync &amp; backup" />
        <NavItem icon={<IconDot size={14} />} label="About Astra" />
      </NavGroup>

      <div style={{ flex: 1 }} />

      <div
        style={{
          padding: "10px 10px",
          fontSize: 12,
          color: "var(--ink-3)",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span
          style={{
            width: 6, height: 6, borderRadius: 999, background: "var(--ok)",
          }}
        />
        Synced 2 minutes ago
      </div>
    </aside>

    {/* CONTENT */}
    <main style={{ overflow: "auto", display: "flex", flexDirection: "column" }}>
      {/* top bar */}
      <div
        style={{
          padding: "18px 28px",
          borderBottom: "1px solid var(--line-1)",
          display: "flex",
          alignItems: "center",
          gap: 12,
          background: "var(--bg-page)",
        }}
      >
        <span style={{ fontSize: 12, color: "var(--ink-3)" }}>Settings</span>
        <IconChevronRight size={11} color="var(--ink-3)" />
        <span style={{ fontSize: 13, color: "var(--ink-1)", fontWeight: 500 }}>Translation</span>
        <span style={{ flex: 1 }} />
        <Btn variant="quiet" size="sm" icon={<IconClose size={13} />}>Close</Btn>
      </div>

      <SectionHeading
        eyebrow="Reading · Translation"
        title="How Astra translates the page"
        description="Astra reads under the page and adds only what you ask for. Each option below changes a single, visible behavior — no hidden defaults."
      />

      <Card padded={false} style={{ margin: "0 28px", borderRadius: "var(--r-lg)" }}>
        <Row
          title="Translation mode"
          description="Show the source and the translation side by side, or replace the source inline. Bilingual is the default for learners; translated-only is faster."
          accessory={<Select value="Bilingual — paragraphs alternate" />}
        />
        <Row
          title="Translate range"
          description="Translate only the article body, or every visible string on the page (including nav and footers)."
          accessory={<Select value="Main content only" />}
        />
        <Row
          title="Display style"
          description="How translated text is visually distinguished from the source."
        >
          <Segmented options={["Plain", "Underline", "Highlight", "Marginalia"]} active="Marginalia" />
          <div
            className="serif"
            style={{
              padding: "14px 16px",
              background: "var(--bg-elevated)",
              border: "1px solid var(--line-1)",
              borderLeft: "3px solid var(--hl)",
              borderRadius: "var(--r-md)",
              fontFamily: "var(--font-serif)",
              fontStyle: "italic",
              fontSize: 14,
              color: "var(--ink-2)",
              lineHeight: 1.5,
            }}
          >
            阅读得当需要一种现代网络已悄然侵蚀的专注力。
          </div>
        </Row>
        <Row
          title="Page translation shortcut"
          description="Trigger a full-page translation without opening the popup."
          accessory={<Shortcut keys={["⌥", "E"]} />}
        />
        <Row
          title="Hover to translate"
          description="Hold a modifier key and hover any paragraph to translate it in place. Long-press also works on touchscreens."
          accessory={
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <Toggle on />
            </div>
          }
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 12, color: "var(--ink-3)", flex: 1 }}>Modifier</span>
            <Shortcut keys={["⌃", "Ctrl"]} />
          </div>
        </Row>
        <Row
          title="AI smart context"
          description="Send the surrounding paragraph to the AI so translations of pronouns and ambiguous terms reflect what's actually being talked about."
          accessory={
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <Toggle on />
            </div>
          }
          last
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 12px",
              background: "var(--accent-soft)",
              border: "1px solid var(--accent-line)",
              borderRadius: "var(--r-md)",
              fontSize: 12,
              color: "var(--accent)",
              alignSelf: "flex-start",
            }}
          >
            <IconDot size={6} color="currentColor" />
            Using Claude Haiku 4.5 · ~$0.002 / page
          </div>
        </Row>
      </Card>

      <SectionHeading title="Personalized prompts" description="Teach Astra your voice. These are appended to every translation request." />

      <Card padded style={{ margin: "0 28px 28px" }}>
        <div
          className="serif"
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 14.5,
            lineHeight: 1.6,
            color: "var(--ink-2)",
            padding: "8px 4px",
            minHeight: 100,
            fontStyle: "italic",
          }}
        >
          Translate as if speaking to a graduate student of literature — keep
          register elevated, preserve metaphors, never explain idioms. Use
          traditional Chinese punctuation. <span style={{ color: "var(--ink-4)" }}>|</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, paddingTop: 14, borderTop: "1px dashed var(--line-1)" }}>
          <span style={{ fontSize: 12, color: "var(--ink-3)" }}>312 / 600 characters</span>
          <span style={{ flex: 1 }} />
          <Btn variant="ghost" size="sm">Reset</Btn>
          <Btn variant="primary" size="sm">Save</Btn>
        </div>
      </Card>

      <SectionHeading
        eyebrow="Engine"
        title="AI providers"
        description="One provider drives the page; specialized models can be assigned to subtitles or selection."
      />

      <Card padded={false} style={{ margin: "0 28px 40px", borderRadius: "var(--r-lg)" }}>
        <ProviderLine name="Anthropic" model="claude-haiku-4-5" status="active" />
        <ProviderLine name="OpenAI" model="gpt-4.1-mini" status="configured" />
        <ProviderLine name="DeepSeek" model="deepseek-chat" status="configured" />
        <ProviderLine name="Google" model="gemini-2.5-flash" status="off" last />
      </Card>
    </main>
  </div>
);

Object.assign(window, { SettingsFrame });

})();
