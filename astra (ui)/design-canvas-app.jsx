;(function(){
/* Auto-built canvas document — keep in sync with Astra UI Redesign.html narrative. */
const { DesignCanvas, DCSection, DCArtboard, DCPostIt } = window;
const { DesignSystemFrame, PopupFrame, OnboardingFrame, DeepReadFrame, SettingsFrame, FloatingTabFrame } = window;
const { HoverFrame, SelectionFrame, CommandMenuFrame, ShareFrame } = window;
const { WordDetailFrame, ReviewFrame } = window;
const { EmptyPopupFrame, LibraryFrame, InContextFrame, ErrorsFrame } = window;
const { SiteRulesFrame, SignInFrame, AccountFrame, PlansFrame, InlineInputFrame } = window;
const { PopupSiteSheetFrame, SubtitleReaderFrame } = window;
const {
  ProgressFrame, OnboardingMultiFrame, PermissionFrame,
  DeepReadEntryFrame, ReviewSummaryFrame,
  WordEditFrame, HistoryFrame, LibrarySearchFrame,
  NotificationsFrame, ShortcutsFrame, ExportFrame,
  SyncFrame, ThemeFrame, FocusFrame,
  AudioFrame, TagsFrame, ImportFrame,
  MobileFrame, ChangelogFrame, AIEdgeFrame,
} = window;

function RedesignCanvasApp() {
  return (
    <DesignCanvas
      title="Astra — UI Redesign"
      subtitle="Two parallel directions for the language-learning extension. Quiet Reader (paper, ink) vs Constellation (twilight, starlight)."
    >
      {/* INTRO */}
      <DCSection
        id="intro"
        title="The brief"
        subtitle="Modern, restrained, reading-first. Astra translates the web for Chinese readers learning English — without ever overpainting the host page."
      >
        <DCArtboard id="brief" label="The two directions" width={1280} height={420}>
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              background: "#fbf8f1",
              fontFamily: 'Source Serif 4, Georgia, serif',
            }}
          >
            <div data-astra="quiet" style={{ background: "var(--bg-page)", color: "var(--ink-1)", padding: "56px 64px", borderRight: "1px solid var(--line-1)" }}>
              <div style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 12 }}>Direction A</div>
              <h1 style={{ fontSize: 56, lineHeight: 1.05, letterSpacing: '-0.025em', margin: 0 }}>Quiet Reader</h1>
              <p style={{ fontStyle: 'italic', fontSize: 19, lineHeight: 1.55, color: 'var(--ink-2)', marginTop: 18, maxWidth: 460 }}>
                Warm paper, ink-on-page hierarchy. Translation rendered as marginalia. Astra dissolves into the act of reading.
              </p>
              <div style={{ marginTop: 28, display: 'flex', gap: 8 }}>
                {['#f4efe6','#fbf8f1','#1a1612','#1f4e7a','#c4633a'].map(c => (
                  <span key={c} style={{ width: 36, height: 36, borderRadius: 8, background: c, border: '1px solid rgba(0,0,0,0.1)' }} />
                ))}
              </div>
            </div>
            <div data-astra="twilight" style={{ background: "var(--bg-page)", color: "var(--ink-1)", padding: "56px 64px" }}>
              <div style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 12 }}>Direction B</div>
              <h1 style={{ fontSize: 56, lineHeight: 1.05, letterSpacing: '-0.025em', margin: 0 }}>Constellation</h1>
              <p style={{ fontStyle: 'italic', fontSize: 19, lineHeight: 1.55, color: 'var(--ink-2)', marginTop: 18, maxWidth: 460 }}>
                Twilight surfaces, soft star-gold accents. The product feels like a quiet observatory — present at night, never demanding.
              </p>
              <div style={{ marginTop: 28, display: 'flex', gap: 8 }}>
                {['#0d1220','#141a2c','#f2efe6','#e5c98a','#8aa4d6'].map(c => (
                  <span key={c} style={{ width: 36, height: 36, borderRadius: 8, background: c, border: '1px solid rgba(255,255,255,0.1)' }} />
                ))}
              </div>
            </div>
          </div>
        </DCArtboard>
      </DCSection>

      {/* DESIGN SYSTEM */}
      <DCSection
        id="ds"
        title="Design system"
        subtitle="Type, color, components, principles — once per direction."
      >
        <DCArtboard id="ds-quiet" label="A · Quiet Reader" width={1280} height={1900}>
          <DesignSystemFrame direction="quiet" />
        </DCArtboard>
        <DCArtboard id="ds-twilight" label="B · Constellation" width={1280} height={1900}>
          <DesignSystemFrame direction="twilight" />
        </DCArtboard>
      </DCSection>

      {/* POPUP */}
      <DCSection
        id="popup"
        title="Popup — daily entry point"
        subtitle="Browser action popup, 380 × 620. The first surface a user touches every day. Translate-this-page first, then site settings, then the gentle learning footer."
      >
        <DCArtboard id="popup-quiet" label="A · Quiet Reader" width={380} height={620}>
          <PopupFrame direction="quiet" />
        </DCArtboard>
        <DCArtboard id="popup-twilight" label="B · Constellation" width={380} height={620}>
          <PopupFrame direction="twilight" />
        </DCArtboard>
        <DCPostIt>
          The single primary action is "Translate this page." Everything else (site rules, mode, style)
          lives one layer down. The footer turns translation into accumulation — saved · due · streak —
          but in serif numerals, never as gamified badges.
        </DCPostIt>
      </DCSection>

      {/* ONBOARDING */}
      <DCSection
        id="onboarding"
        title="Onboarding — first impression"
        subtitle="A single full-page screen. The headline is set in display serif. The right pane is a live preview of what Astra will do to a real article — choosing a style updates the preview in place."
      >
        <DCArtboard id="onb-quiet" label="A · Quiet Reader" width={1280} height={800}>
          <OnboardingFrame direction="quiet" />
        </DCArtboard>
        <DCArtboard id="onb-twilight" label="B · Constellation" width={1280} height={800}>
          <OnboardingFrame direction="twilight" />
        </DCArtboard>
      </DCSection>

      {/* SETTINGS */}
      <DCSection
        id="settings"
        title="Settings — the full surface"
        subtitle="Sidebar + content. Built from the same Card / Btn / Toggle / Pill primitives as Popup, Onboarding, and Deep Read. The sidebar groups capabilities (Reading · Learning · Engine · Account); the content area uses sectioned cards with paired description / control layout."
      >
        <DCArtboard id="set-quiet" label="A · Quiet Reader" width={1280} height={900}>
          <SettingsFrame direction="quiet" />
        </DCArtboard>
        <DCArtboard id="set-twilight" label="B · Constellation" width={1280} height={900}>
          <SettingsFrame direction="twilight" />
        </DCArtboard>
        <DCPostIt>
          Section heads are serif and italicized; row titles are sans + 500. Each row is one
          behavior — no hidden defaults. Description copy is allowed to be a sentence; control
          copy stays terse. When a control has a preview (display style), the preview lives
          under the control, not in a modal.
        </DCPostIt>
      </DCSection>

      {/* FLOATING TAB */}
      <DCSection
        id="floating"
        title="In-page handle — do we even need a floating ball?"
        subtitle="My take: probably not, but the question is real. Three options below, ordered quietest → loudest. Astra's whole brand is 'never repaints what was already legible' — a persistent ball directly contradicts that. The popup + ⌥E shortcut + selection toolbar already cover the job, and a corner status pill confirms Astra is connected."
      >
        <DCArtboard id="ft-none-quiet" label="0 · No ball — selection toolbar + corner status (recommended)" width={1100} height={620}>
          <FloatingTabFrame direction="quiet" variant="none" />
        </DCArtboard>
        <DCArtboard id="ft-tick-quiet" label="1 · Edge tick — 2px hairline that expands on hover" width={1100} height={620}>
          <FloatingTabFrame direction="quiet" variant="tick" />
        </DCArtboard>
        <DCArtboard id="ft-ball-quiet" label="2 · Conventional ball — Read-Frog / Immersive style" width={1100} height={620}>
          <FloatingTabFrame direction="quiet" variant="ball" />
        </DCArtboard>
        <DCArtboard id="ft-tick-twilight" label="1 · Edge tick — Twilight" width={1100} height={620}>
          <FloatingTabFrame direction="twilight" variant="tick" />
        </DCArtboard>
        <DCPostIt>
          Recommendation: ship Option 0. The selection toolbar is the in-page handle. If user
          research shows people miss the popup, fall back to Option 1 (edge tick) — it preserves
          the brand promise. Avoid Option 2: the persistent monogram on every page is exactly
          the kind of "loudness" Astra is supposed to be the antidote to.
        </DCPostIt>
      </DCSection>

      {/* IN-CONTEXT TRANSLATION */}
      <DCSection
        id="incontext"
        title="In-context translation — overlay on the host page"
        subtitle="When the user hits Translate, the host page's HTML is preserved. Each paragraph gets a quiet bilingual companion below it: a left color rail + tiny Astra mark + italic serif. A floating status pill at the top shows progress and lets the user flip back to the original."
      >
        <DCArtboard id="incontext-quiet" label="A · Quiet Reader" width={1280} height={900}>
          <InContextFrame direction="quiet" />
        </DCArtboard>
        <DCArtboard id="incontext-twilight" label="B · Constellation" width={1280} height={900}>
          <InContextFrame direction="twilight" />
        </DCArtboard>
        <DCPostIt>
          The 2px accent rail is the single signal that says "this is Astra speaking." It scales:
          one rail per paragraph in this view; one rail per page in Deep Read marginalia; same
          vocabulary across the product.
        </DCPostIt>
      </DCSection>

      {/* HOVER + SELECTION */}
      <DCSection
        id="hover"
        title="In-page lookup — the most-used surface"
        subtitle="The interactions that fire dozens of times per article. Hover a single word to get a small popover; select a phrase to get the dark inline toolbar; activate Translate to get the bilingual phrase card. None of these overpaints the page."
      >
        <DCArtboard id="hover-quiet" label="Hover a word — Quiet" width={1100} height={720}>
          <HoverFrame direction="quiet" />
        </DCArtboard>
        <DCArtboard id="hover-twilight" label="Hover a word — Twilight" width={1100} height={720}>
          <HoverFrame direction="twilight" />
        </DCArtboard>
        <DCArtboard id="select-quiet" label="Select a phrase — Quiet" width={1100} height={720}>
          <SelectionFrame direction="quiet" />
        </DCArtboard>
      </DCSection>

      {/* WORD DETAIL */}
      <DCSection
        id="word"
        title="Word detail — the saved-word's home"
        subtitle="Tap a saved word and you land here. Hero word in display serif; right rail holds the SRS data (next review, recall history, related words, etymology); the body is a sentence bank — the actual passages you encountered the word in, with the word underlined."
      >
        <DCArtboard id="word-quiet" label="A · Quiet Reader" width={1280} height={900}>
          <WordDetailFrame direction="quiet" />
        </DCArtboard>
        <DCArtboard id="word-twilight" label="B · Constellation" width={1280} height={900}>
          <WordDetailFrame direction="twilight" />
        </DCArtboard>
        <DCPostIt>
          SRS history shown as a row of dots, not a chart. Mastery is five short bars, not a
          percentage. The whole page leans on real sentences from the user's own reading —
          that's the differentiator vs Anki: vocabulary, in context, from your life.
        </DCPostIt>
      </DCSection>

      {/* REVIEW */}
      <DCSection
        id="review"
        title="Review session — focused, almost empty"
        subtitle="One card at a time. The sentence comes first (context > word). Reveal shows the word and gloss; four difficulty buttons mirror Anki's grade scale but use plain English and a left color rail instead of red/yellow/green pill chrome."
      >
        <DCArtboard id="review-quiet" label="A · Quiet Reader" width={1280} height={900}>
          <ReviewFrame direction="quiet" revealed={true} />
        </DCArtboard>
        <DCArtboard id="review-twilight" label="B · Constellation — front of card (not yet revealed)" width={1280} height={900}>
          <ReviewFrame direction="twilight" revealed={false} />
        </DCArtboard>
      </DCSection>

      {/* LIBRARY */}
      <DCSection
        id="library"
        title="Library — every word you've kept"
        subtitle="Sidebar groups by status and source. Main list: word, gloss, the sentence you met it in, a sparkline of recent reviews, and SRS status. Right rail is reading history — the articles, not just the words."
      >
        <DCArtboard id="library-quiet" label="A · Quiet Reader" width={1280} height={900}>
          <LibraryFrame direction="quiet" />
        </DCArtboard>
        <DCArtboard id="library-twilight" label="B · Constellation" width={1280} height={900}>
          <LibraryFrame direction="twilight" />
        </DCArtboard>
      </DCSection>

      {/* EMPTY / FIRST-RUN */}
      <DCSection
        id="empty"
        title="First-run state — empty popup"
        subtitle="What the user sees on day one, before they've saved a single word. Translate-this-page is still primary; the library card is replaced by a quiet onboarding hint that names the actual gesture (⌥S to save)."
      >
        <DCArtboard id="empty-quiet" label="A · Quiet Reader" width={380} height={620}>
          <EmptyPopupFrame direction="quiet" />
        </DCArtboard>
        <DCArtboard id="empty-twilight" label="B · Constellation" width={380} height={620}>
          <EmptyPopupFrame direction="twilight" />
        </DCArtboard>
      </DCSection>

      {/* COMMAND MENU / SHORTCUTS */}
      <DCSection
        id="cmd"
        title="Command menu — ⌘K"
        subtitle="Universal entry to every Astra action, from anywhere on the web. Left pane is search-driven; right pane is a printable shortcut sheet — kept visible so power users learn the keys."
      >
        <DCArtboard id="cmd-quiet" label="A · Quiet Reader" width={1100} height={720}>
          <CommandMenuFrame direction="quiet" />
        </DCArtboard>
        <DCArtboard id="cmd-twilight" label="B · Constellation" width={1100} height={720}>
          <CommandMenuFrame direction="twilight" />
        </DCArtboard>
      </DCSection>

      {/* SHARE */}
      <DCSection
        id="share"
        title="Share a passage — the quiet quote card"
        subtitle="Export a saved highlight as a 4:5 image card, markdown blockquote, or a sharable Astra link. Preview reflects the chosen surface; bilingual text is preserved; the Astra mark sits as a small wordmark, never a watermark."
      >
        <DCArtboard id="share-quiet" label="A · Quiet Reader" width={1100} height={720}>
          <ShareFrame direction="quiet" />
        </DCArtboard>
        <DCArtboard id="share-twilight" label="B · Constellation" width={1100} height={720}>
          <ShareFrame direction="twilight" />
        </DCArtboard>
      </DCSection>

      {/* ERROR STATES */}
      <DCSection
        id="errors"
        title="Failure modes — never alarming"
        subtitle="Three failure cases shown together: offline, daily quota reached, and a single paragraph that failed mid-page. Errors are always told as sentences. The host page is never overpainted with red. Per-paragraph failures stay quiet — a muted rail, a small inline retry, no banner."
      >
        <DCArtboard id="errors-quiet" label="A · Quiet Reader" width={1280} height={720}>
          <ErrorsFrame direction="quiet" />
        </DCArtboard>
        <DCArtboard id="errors-twilight" label="B · Constellation" width={1280} height={720}>
          <ErrorsFrame direction="twilight" />
        </DCArtboard>
      </DCSection>

      {/* AUTH — SIGN IN */}
      <DCSection
        id="signin"
        title="Sign in — small, paper-like modal"
        subtitle="Astra works without an account. Sign-in is for people who want library + history sync across devices. The escape hatch ('Astra works without one') is on the page, not buried."
      >
        <DCArtboard id="signin-quiet" label="A · Quiet Reader" width={480} height={640}>
          <SignInFrame direction="quiet" />
        </DCArtboard>
        <DCArtboard id="signin-twilight" label="B · Constellation" width={480} height={640}>
          <SignInFrame direction="twilight" />
        </DCArtboard>
      </DCSection>

      {/* AUTH — ACCOUNT */}
      <DCSection
        id="account"
        title="Account home — the reader's record"
        subtitle="Profile, current plan, sync status across devices, data export, and a 'quiet zone' for pausing or deleting. Stat row uses display serif numerals — never gauge dials, never streak flames."
      >
        <DCArtboard id="account-quiet" label="A · Quiet Reader" width={1280} height={900}>
          <AccountFrame direction="quiet" />
        </DCArtboard>
        <DCArtboard id="account-twilight" label="B · Constellation" width={1280} height={900}>
          <AccountFrame direction="twilight" />
        </DCArtboard>
      </DCSection>

      {/* AUTH — PLANS */}
      <DCSection
        id="plans"
        title="Plans &amp; billing — three tiers"
        subtitle="Free stays useful forever (no nag). Pro adds the Astra relay engine, sync, and Deep Read marginalia AI. Studio is for teams. Pricing is named in serif numerals; the featured plan gets ink-on-paper inversion, not a gradient halo."
      >
        <DCArtboard id="plans-quiet" label="A · Quiet Reader" width={1280} height={900}>
          <PlansFrame direction="quiet" />
        </DCArtboard>
        <DCArtboard id="plans-twilight" label="B · Constellation" width={1280} height={900}>
          <PlansFrame direction="twilight" />
        </DCArtboard>
        <DCPostIt>
          Pro at $6.40/mo (yearly) covers the relay model bill — that's the explicit promise:
          "Pro pays the bill so we don't have to sell your reading." This is the single most
          important brand-trust line in the product; it lives in the price page, not in a footer.
        </DCPostIt>
      </DCSection>

      {/* POPUP SITE SHEET */}
      <DCSection
        id="sitesheet"
        title="Popup · site sheet — the per-site control inside the popup"
        subtitle="Tap the site row in the popup and it slides into this detail sheet — same 380px chrome, but every per-site rule is here: enabled, auto-translate, display style, hover trigger, target lang, scope summary, and a link to advanced CSS. The full Site Rules page (above) is still where power users live; this is the daily-driver surface."
      >
        <DCArtboard id="sitesheet-quiet" label="A · Quiet Reader" width={380} height={620}>
          <PopupSiteSheetFrame direction="quiet" />
        </DCArtboard>
        <DCArtboard id="sitesheet-twilight" label="B · Constellation" width={380} height={620}>
          <PopupSiteSheetFrame direction="twilight" />
        </DCArtboard>
        <DCPostIt>
          The Scope row collapses four advanced fields into a sentence and a row of mono pill
          chips ("min ¶ 40 chars · in: article · skip: pre,code · /magazine/**"). It tells the
          casual user what's currently in effect without making them edit CSS selectors —
          if they want to, the Edit button takes them to the full Site Rules page.
        </DCPostIt>
      </DCSection>

      {/* SUBTITLE READER */}
      <DCSection
        id="subtitle"
        title="Subtitle reader — bilingual captions for video"
        subtitle="Astra on YouTube. Burned-in bilingual captions on the video itself, plus a full bilingual transcript on the right that scrolls with the playhead. Tap any line to jump there; ⌥S saves the line; auto-pause-on-lookup means hovering a word stops the video so you can read in peace."
      >
        <DCArtboard id="subtitle-quiet" label="A · Quiet Reader" width={1280} height={900}>
          <SubtitleReaderFrame direction="quiet" />
        </DCArtboard>
        <DCArtboard id="subtitle-twilight" label="B · Constellation" width={1280} height={900}>
          <SubtitleReaderFrame direction="twilight" />
        </DCArtboard>
        <DCPostIt>
          Two design decisions worth flagging: (1) Past lines fade to 55% opacity — you read
          forward, not backward. The current line gets the 2px accent rail Astra uses
          everywhere; (2) Saved-this-session strip at the bottom shows words as serif chips
          with a timestamp, so reviewing later you can jump back to the exact moment you met
          the word. This is the Deep-Read marginalia idea, applied to time instead of margin.
        </DCPostIt>
      </DCSection>

      {/* SITE RULES */}
      <DCSection
        id="siterules"
        title="Site rules — per-site advanced config"
        subtitle="Power-user surface. Per-domain switches, paragraph-length thresholds, include/exclude CSS selectors, URL glob patterns, and custom CSS to restyle Astra's translation on a specific site. Same paper card vocabulary; mono font signals 'this is config, not prose'."
      >
        <DCArtboard id="siterules-quiet" label="A · Quiet Reader" width={1280} height={900}>
          <SiteRulesFrame direction="quiet" />
        </DCArtboard>
        <DCArtboard id="siterules-twilight" label="B · Constellation" width={1280} height={900}>
          <SiteRulesFrame direction="twilight" />
        </DCArtboard>
        <DCPostIt>
          The customized-dot in the sidebar (a single accent pixel) is the only color signal on
          this page. Everything else is paper, ink, mono. Advanced fields are labeled
          ADVANCED · CSS / GLOB so casual users know what to skip.
        </DCPostIt>
      </DCSection>

      {/* INLINE INPUT */}
      <DCSection
        id="inline"
        title="Inline composer assist — Grammarly, but quieter"
        subtitle="Astra helps users write English. Inside any composer (Gmail, Twitter, Notion), it shows a paper-card panel below the field with grammar / tone / fluency / vocabulary suggestions. Suggestions live in the panel, not on top of your text — underlines are dotted, dim, only visible on hover."
      >
        <DCArtboard id="inline-quiet" label="A · Quiet Reader" width={1280} height={900}>
          <InlineInputFrame direction="quiet" />
        </DCArtboard>
        <DCArtboard id="inline-twilight" label="B · Constellation" width={1280} height={900}>
          <InlineInputFrame direction="twilight" />
        </DCArtboard>
        <DCPostIt>
          The bilingual ghost ("What you meant — 中文") is unique to Astra: most composer-assist
          tools assume the user is a native speaker making typos. Astra assumes the user is
          translating their thought from 中文 to English in real time, and treats the original
          intent as a first-class artifact.
        </DCPostIt>
      </DCSection>

      {/* ============== PHASE II — GAP-FILL FRAMES (1–20) ============== */}

      {/* 1. Translation progress / loading */}
      <DCSection
        id="progress"
        title="1 · Translation in flight"
        subtitle="The 1–3 seconds between pressing Translate and reading the bilingual page. Streamed paragraph-by-paragraph, paused mid-page, cancellable. A floating status pill, not a modal."
      >
        <DCArtboard id="progress-quiet" label="A · Quiet Reader" width={1280} height={900}>
          <ProgressFrame direction="quiet" />
        </DCArtboard>
        <DCArtboard id="progress-twilight" label="B · Constellation" width={1280} height={900}>
          <ProgressFrame direction="twilight" />
        </DCArtboard>
      </DCSection>

      {/* 2. Multi-step onboarding */}
      <DCSection
        id="onboarding-multi"
        title="2 · Onboarding — a slower first hour"
        subtitle="Four steps, each on a paper card, no progress nag. Welcome → language pair → reading style → first translation. The user's first successful translation happens inside step 3, not after onboarding."
      >
        <DCArtboard id="onbm-quiet" label="A · Quiet Reader · 4 steps" width={1280} height={900}>
          <OnboardingMultiFrame direction="quiet" />
        </DCArtboard>
        <DCArtboard id="onbm-twilight" label="B · Constellation · 4 steps" width={1280} height={900}>
          <OnboardingMultiFrame direction="twilight" />
        </DCArtboard>
      </DCSection>

      {/* 3. Permission requests */}
      <DCSection
        id="permission"
        title="3 · Site access — the permission dialog"
        subtitle="Astra defaults to activeTab (per-page consent) instead of all-sites. The dialog explains in a sentence what reading the page means and offers a one-tap upgrade to 'always on this site' for daily-driver domains."
      >
        <DCArtboard id="perm-quiet" label="A · Quiet Reader" width={1280} height={720}>
          <PermissionFrame direction="quiet" />
        </DCArtboard>
        <DCArtboard id="perm-twilight" label="B · Constellation" width={1280} height={720}>
          <PermissionFrame direction="twilight" />
        </DCArtboard>
      </DCSection>

      {/* 4. Deep Read entry / exit */}
      <DCSection
        id="deepread-entry"
        title="4 · Deep Read — entering and leaving"
        subtitle="A small invitation card on long articles ('15 min · this reads better in Deep Read'); a finishing card with the day's harvest; a return-to-page transition that respects the host site."
      >
        <DCArtboard id="dre-quiet" label="A · Quiet Reader · invitation + finish" width={1280} height={900}>
          <DeepReadEntryFrame direction="quiet" />
        </DCArtboard>
        <DCArtboard id="dre-twilight" label="B · Constellation · invitation + finish" width={1280} height={900}>
          <DeepReadEntryFrame direction="twilight" />
        </DCArtboard>
      </DCSection>

      {/* 5. Review summary */}
      <DCSection
        id="review-summary"
        title="5 · After the review — quiet summary"
        subtitle="No fireworks, no levels. Plain serif numerals: how many you saw, how many you kept, when the next batch is due. A small reading suggestion to close the loop — 'a 7-min article uses 4 of these words.'"
      >
        <DCArtboard id="rs-quiet" label="A · Quiet Reader" width={1280} height={900}>
          <ReviewSummaryFrame direction="quiet" />
        </DCArtboard>
        <DCArtboard id="rs-twilight" label="B · Constellation" width={1280} height={900}>
          <ReviewSummaryFrame direction="twilight" />
        </DCArtboard>
      </DCSection>

      {/* 6. Word edit */}
      <DCSection
        id="word-edit"
        title="6 · Word — add, edit, retire"
        subtitle="The other side of Word Detail. Edit a gloss, attach your own example sentence, mark mastered (and let it gracefully leave the queue), or delete with undo. Pencil-and-paper feel; no destructive modals."
      >
        <DCArtboard id="we-quiet" label="A · Quiet Reader" width={1280} height={900}>
          <WordEditFrame direction="quiet" />
        </DCArtboard>
        <DCArtboard id="we-twilight" label="B · Constellation" width={1280} height={900}>
          <WordEditFrame direction="twilight" />
        </DCArtboard>
      </DCSection>

      {/* 7. Reading history */}
      <DCSection
        id="history"
        title="7 · Reading history — the timeline"
        subtitle="The articles, not the words. Grouped by day, with the words you saved beneath each entry. Lets you remember 'where did I learn this?' — the same question Deep Read marginalia answers, scaled to a year of reading."
      >
        <DCArtboard id="hist-quiet" label="A · Quiet Reader" width={1280} height={900}>
          <HistoryFrame direction="quiet" />
        </DCArtboard>
        <DCArtboard id="hist-twilight" label="B · Constellation" width={1280} height={900}>
          <HistoryFrame direction="twilight" />
        </DCArtboard>
      </DCSection>

      {/* 8. Library search */}
      <DCSection
        id="search"
        title="8 · Search the library"
        subtitle="One field, four kinds of result: words, sentence-bank matches, articles, and tags. Mono input on paper. Results live below in a single list, ordered by what you're most likely to mean."
      >
        <DCArtboard id="search-quiet" label="A · Quiet Reader" width={1280} height={900}>
          <LibrarySearchFrame direction="quiet" />
        </DCArtboard>
        <DCArtboard id="search-twilight" label="B · Constellation" width={1280} height={900}>
          <LibrarySearchFrame direction="twilight" />
        </DCArtboard>
      </DCSection>

      {/* 9. Notifications / daily reminder */}
      <DCSection
        id="notifications"
        title="9 · Daily reminder — three quiet surfaces"
        subtitle="A new-tab override (paper page with today's queue), a popup banner, and an OS notification. The reminder is offered, never insisted; 'review later today' moves the bell, not the queue."
      >
        <DCArtboard id="notif-quiet" label="A · Quiet Reader · three surfaces" width={1280} height={900}>
          <NotificationsFrame direction="quiet" />
        </DCArtboard>
        <DCArtboard id="notif-twilight" label="B · Constellation · three surfaces" width={1280} height={900}>
          <NotificationsFrame direction="twilight" />
        </DCArtboard>
      </DCSection>

      {/* 10. Shortcut customization */}
      <DCSection
        id="shortcuts-custom"
        title="10 · Keyboard — your map, not ours"
        subtitle="Every Astra command is rebindable. A press-the-key inline editor. Conflicts with Gmail / Notion / Linear are detected and surfaced as a quiet warning, not a blocker."
      >
        <DCArtboard id="kbd-quiet" label="A · Quiet Reader" width={1280} height={900}>
          <ShortcutsFrame direction="quiet" />
        </DCArtboard>
        <DCArtboard id="kbd-twilight" label="B · Constellation" width={1280} height={900}>
          <ShortcutsFrame direction="twilight" />
        </DCArtboard>
      </DCSection>

      {/* 11. Export / Backup */}
      <DCSection
        id="export"
        title="11 · Export — your library, your file"
        subtitle="Anki .apkg, Markdown vault, CSV, JSON. A preview of the first three rows of the chosen format. The Markdown vault is the standout: one .md per word, wikilink-ready for Obsidian."
      >
        <DCArtboard id="exp-quiet" label="A · Quiet Reader" width={1280} height={900}>
          <ExportFrame direction="quiet" />
        </DCArtboard>
        <DCArtboard id="exp-twilight" label="B · Constellation" width={1280} height={900}>
          <ExportFrame direction="twilight" />
        </DCArtboard>
      </DCSection>

      {/* 12. Cross-device sync */}
      <DCSection
        id="sync"
        title="12 · Sync — devices, conflicts, lineage"
        subtitle="Three connected devices, a quiet status row, and the conflict resolver: when the same word has different glosses on two devices, both are shown side by side and a third 'merged' option is offered."
      >
        <DCArtboard id="sync-quiet" label="A · Quiet Reader" width={1280} height={900}>
          <SyncFrame direction="quiet" />
        </DCArtboard>
        <DCArtboard id="sync-twilight" label="B · Constellation" width={1280} height={900}>
          <SyncFrame direction="twilight" />
        </DCArtboard>
      </DCSection>

      {/* 13. Theme switching */}
      <DCSection
        id="theme"
        title="13 · Direction switcher — Quiet ↔ Constellation"
        subtitle="Theme isn't a checkbox; it's a small choice with a live preview. Auto follows the system; Site-aware lets the host page hint (light news sites pull Quiet, dark dashboards pull Constellation)."
      >
        <DCArtboard id="theme-quiet" label="A · Quiet Reader" width={1280} height={760}>
          <ThemeFrame direction="quiet" />
        </DCArtboard>
        <DCArtboard id="theme-twilight" label="B · Constellation" width={1280} height={760}>
          <ThemeFrame direction="twilight" />
        </DCArtboard>
      </DCSection>

      {/* 14. Focus mode */}
      <DCSection
        id="focus"
        title="14 · Reading focus — host-page dimming"
        subtitle="Press F. Sidebars, ads, headers, related-stories rails dim to 18% opacity; the article column stays full strength. Astra never deletes the chrome — it just steps out of its way."
      >
        <DCArtboard id="focus-quiet" label="A · Quiet Reader · before & after" width={1280} height={900}>
          <FocusFrame direction="quiet" />
        </DCArtboard>
        <DCArtboard id="focus-twilight" label="B · Constellation · before & after" width={1280} height={900}>
          <FocusFrame direction="twilight" />
        </DCArtboard>
      </DCSection>

      {/* 15. Pronunciation / Audio */}
      <DCSection
        id="audio"
        title="15 · Pronunciation — UK, US, and your own voice"
        subtitle="Three reference recordings, a syllable map, and a hold-⌥ recorder that compares your waveform to the reference. Audio data stays on device."
      >
        <DCArtboard id="audio-quiet" label="A · Quiet Reader" width={1280} height={900}>
          <AudioFrame direction="quiet" />
        </DCArtboard>
        <DCArtboard id="audio-twilight" label="B · Constellation" width={1280} height={900}>
          <AudioFrame direction="twilight" />
        </DCArtboard>
      </DCSection>

      {/* 16. Tags & collections */}
      <DCSection
        id="tags"
        title="16 · Tags & collections — the user's own shelves"
        subtitle="Tags double as decks. 'GRE', 'Business English', 'From newyorker.com' — each collection ships with a one-tap review button so a tag becomes a study session."
      >
        <DCArtboard id="tags-quiet" label="A · Quiet Reader" width={1280} height={900}>
          <TagsFrame direction="quiet" />
        </DCArtboard>
        <DCArtboard id="tags-twilight" label="B · Constellation" width={1280} height={900}>
          <TagsFrame direction="twilight" />
        </DCArtboard>
      </DCSection>

      {/* 17. Inbound share */}
      <DCSection
        id="import"
        title="17 · Imported share — words from a friend"
        subtitle="A friend's curated list arrives as an Astra link. Each row shows the word, the gloss, and whether you already have it. Imported words can be tagged automatically and queued for review on a chosen date."
      >
        <DCArtboard id="imp-quiet" label="A · Quiet Reader" width={1280} height={900}>
          <ImportFrame direction="quiet" />
        </DCArtboard>
        <DCArtboard id="imp-twilight" label="B · Constellation" width={1280} height={900}>
          <ImportFrame direction="twilight" />
        </DCArtboard>
      </DCSection>

      {/* 18. Mobile companion */}
      <DCSection
        id="mobile"
        title="18 · Mobile companion — review on the train"
        subtitle="A small PWA, two surfaces only: Today (the queue) and Review (one card at a time). Saving new words still happens on the desktop, in the act of reading."
      >
        <DCArtboard id="mob-quiet" label="A · Quiet Reader" width={1280} height={760}>
          <MobileFrame direction="quiet" />
        </DCArtboard>
        <DCArtboard id="mob-twilight" label="B · Constellation" width={1280} height={760}>
          <MobileFrame direction="twilight" />
        </DCArtboard>
      </DCSection>

      {/* 19. What's new / changelog */}
      <DCSection
        id="changelog"
        title="19 · What's new — a letter, not a banner"
        subtitle="Release notes that read like a publisher's note. NEW / BETTER / FIXED / QUIET — that fourth category is for the small dignifying changes (we removed the streak flame this release)."
      >
        <DCArtboard id="cl-quiet" label="A · Quiet Reader" width={1280} height={900}>
          <ChangelogFrame direction="quiet" />
        </DCArtboard>
        <DCArtboard id="cl-twilight" label="B · Constellation" width={1280} height={900}>
          <ChangelogFrame direction="twilight" />
        </DCArtboard>
      </DCSection>

      {/* 20. AI edge cases */}
      <DCSection
        id="ai-edge"
        title="20 · AI edge cases — disambiguate, feedback, override"
        subtitle="Three edges that most translators paper over. (a) Polysemy: pick the right sense and Astra remembers. (b) Quality feedback: tell us when a paragraph is off. (c) Term overrides: your in-house glossary trumps the model."
      >
        <DCArtboard id="ai-quiet" label="A · Quiet Reader · all three" width={1280} height={900}>
          <AIEdgeFrame direction="quiet" />
        </DCArtboard>
        <DCArtboard id="ai-twilight" label="B · Constellation · all three" width={1280} height={900}>
          <AIEdgeFrame direction="twilight" />
        </DCArtboard>
        <DCPostIt>
          These are the three places the model itself shows through the chrome. The brand
          promise — quiet, accurate, your reading — depends on giving the user a polite way
          to correct, override, or pick from the model's options. We made them paper cards,
          not modals; the failure mode is editorial, not technical.
        </DCPostIt>
      </DCSection>

      {/* DEEP READ */}
      <DCSection
        id="deepread"
        title="Deep Read — the long-form reader"
        subtitle="The signature surface. Translation lives in the margin as marginalia — the way a reader's penciled note used to. The right rail collects words from the page; finishing the page commits them to spaced review."
      >
        <DCArtboard id="dr-quiet" label="A · Quiet Reader" width={1280} height={900}>
          <DeepReadFrame direction="quiet" />
        </DCArtboard>
        <DCArtboard id="dr-twilight" label="B · Constellation" width={1280} height={900}>
          <DeepReadFrame direction="twilight" />
        </DCArtboard>
        <DCPostIt>
          Marginalia is the strongest design move here: it visually separates "the writer's words"
          from "your understanding of them," and it gives Astra a surface that doesn't fight the
          host page. Compare to Immersive Translate's interleaved-paragraph approach — denser,
          but louder.
        </DCPostIt>
      </DCSection>
    </DesignCanvas>
  );
}

Object.assign(window, { RedesignCanvasApp });
})();
