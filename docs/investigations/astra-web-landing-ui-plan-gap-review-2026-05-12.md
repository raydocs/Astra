# Investigation: Astra Web Landing UI Plan Gap Review

## Summary

The UI plan is directionally correct, but not yet handoff-tight. It captures the standalone redesign’s core intent, yet still needs explicit source-evidence handling, `/sign-in` routing contract, PWA/metadata handoff, static-vs-wired sample labeling, component acceptance criteria, and current-copy cleanup before engineering should begin.

## Symptoms

- User wants to verify whether the new UI plan still has problems after looking at the newer standalone design artifact under `astra (ui)/`.
- The current plan is detailed, but may still miss design states, source-path specificity, routing assumptions, UI-system boundaries, or mismatches with the standalone redesign.

## Background / Prior Research

- No external/web research required. The investigation depends on workspace artifacts: the standalone HTML, the generated plan, current `web/`, and existing Astra UI/spec docs.
- Initial path check found `astra (ui)/Astra Web Landing Redesign - standalone.html` as the relevant standalone artifact.
- The current plan under review is `docs/plans/astra-web-landing-redesign-ui-system-2026-05-12.md`.

## Investigator Findings

<!-- Pair investigator appends structured findings here. -->

### 2026-05-12 - Remaining plan problems verified against standalone artifact and current web app

#### Scope and method

Read the plan under review (`docs/plans/astra-web-landing-redesign-ui-system-2026-05-12.md`), the current web implementation (`web/src/app.tsx`, `web/src/styles.css`, `web/src/main.tsx`, `web/index.html`, `web/public/manifest.webmanifest`), relevant Web/PWA positioning docs, and the standalone design artifact at `astra (ui)/Astra Web Landing Redesign - standalone.html`. Because the standalone artifact stores the actionable React template in one escaped bundle line, references to design-canvas internals are grounded at `astra (ui)/Astra Web Landing Redesign - standalone.html:179`; local extraction showed the embedded template sections and virtual line numbers but the committed file still records them on line 179.

#### Finding 1 — Plan points at the right artifact, but its path and line evidence are too imprecise

**Evidence:**

- The relevant source artifact is `astra (ui)/Astra Web Landing Redesign - standalone.html`; the existing investigation already identified that full path (`docs/investigations/astra-web-landing-ui-plan-gap-review-2026-05-12.md:16`).
- The plan repeatedly names only `Astra Web Landing Redesign - standalone.html`, omitting the `astra (ui)/` directory in goal/background/references (`docs/plans/astra-web-landing-redesign-ui-system-2026-05-12.md:7`, `docs/plans/astra-web-landing-redesign-ui-system-2026-05-12.md:13`, `docs/plans/astra-web-landing-redesign-ui-system-2026-05-12.md:248`).
- The standalone artifact is a bundler wrapper: it loads a JSON manifest and template (`astra (ui)/Astra Web Landing Redesign - standalone.html:170`, `astra (ui)/Astra Web Landing Redesign - standalone.html:178-179`). The plan's `:179` citations are technically valid but not granular because all actionable template content is escaped onto that one line.
- Extracting the embedded template from line 179 shows the design canvas title `Astra — Web landing redesign`, the sections `Diagnosis`, `A · Marginalia hero`, `B · The editorial sample`, and `C · Dedicated sign-in`, plus the artboards `Quiet Reader · 1440 viewport`, `Constellation · 1440 viewport`, `Quiet Reader · full hero + sample`, and `Quiet Reader · /sign-in` (all embedded in `astra (ui)/Astra Web Landing Redesign - standalone.html:179`).

**Eliminated hypotheses:**

- The plan is not referencing an obsolete artifact; the named standalone HTML exists and contains the expected redesign canvas.
- The `:179` reference is not wrong, but it is a weak handoff reference because it hides every design sub-section behind a single generated line.

**Conclusion:**

The plan should use the full path `astra (ui)/Astra Web Landing Redesign - standalone.html` everywhere and should acknowledge that `:179` is an embedded-template bundle line. If this plan is meant for design/engineering handoff, it should add either extracted template refs, screenshots/artboard IDs, or stable section labels so future readers do not have to reverse-engineer the bundled HTML.

#### Finding 2 — The plan captures the standalone design intent, with a few implementation/product extrapolations that should be labeled

**Evidence:**

- The plan's core interpretation matches the artifact: product-led marginalia hero, restrained serif headline, real bilingual sample, and sign-in moved out of the hero (`docs/plans/astra-web-landing-redesign-ui-system-2026-05-12.md:13-14`, backed by the embedded `A · Marginalia hero` and `C · Dedicated sign-in` sections in `astra (ui)/Astra Web Landing Redesign - standalone.html:179`).
- The standalone template defines the two visual directions as `Direction A — Quiet Reader (paper)` and `Direction B — Constellation (twilight)` with theme tokens such as `[data-astra="quiet"]`, `[data-astra="twilight"]`, `--bg-page`, `--ink-*`, `--accent`, `--hl`, shadows, and focus ring equivalents (embedded in `astra (ui)/Astra Web Landing Redesign - standalone.html:179`). Current web CSS already bridges Style 1 tokens into web aliases (`web/src/styles.css:1-69`), so the plan's token-mapping emphasis is valid (`docs/plans/astra-web-landing-redesign-ui-system-2026-05-12.md:134-158`).
- The artifact's marginalia vocabulary includes a 2px accent rail and italic serif target/gloss styling through `.mg-target`, plus underline styling via `.ulink` (embedded in `astra (ui)/Astra Web Landing Redesign - standalone.html:179`). The plan accurately lists these requirements (`docs/plans/astra-web-landing-redesign-ui-system-2026-05-12.md:64-71`).
- The artifact says dedicated sign-in should be a small centered paper card; `Use instantly` should be first, email/password second, and relay endpoint hidden behind `Advanced` (embedded in `astra (ui)/Astra Web Landing Redesign - standalone.html:179`). The plan captures this hierarchy and the state matrix (`docs/plans/astra-web-landing-redesign-ui-system-2026-05-12.md:76-110`).

**Eliminated hypotheses:**

- The plan is not missing the major standalone sections; it includes Diagnosis, marginalia hero, editorial sample, dedicated sign-in, Quiet Reader, and Constellation.
- The plan is not trying to turn the artifact into a broad full-app redesign; it correctly limits the next design scope to landing/auth and a small kit (`docs/plans/astra-web-landing-redesign-ui-system-2026-05-12.md:21-31`).

**Remaining caveats:**

- `Quiet Reader = production` and `Constellation = exploration` are plan recommendations, not directly declared by the artifact, which presents both directions as artboards (`docs/plans/astra-web-landing-redesign-ui-system-2026-05-12.md:27-28`, `docs/plans/astra-web-landing-redesign-ui-system-2026-05-12.md:185-186`).
- `Use instantly` success target = `/text` is implementation-derived, not artifact-derived (`docs/plans/astra-web-landing-redesign-ui-system-2026-05-12.md:30`, `docs/plans/astra-web-landing-redesign-ui-system-2026-05-12.md:188`).
- The exact CTA matrix `Start free` / `Open workspace` / `Install PWA` is a current-app/product-state requirement, not an explicit standalone-artifact requirement (`docs/plans/astra-web-landing-redesign-ui-system-2026-05-12.md:51`).

**Conclusion:**

The plan is directionally accurate, but should label which decisions are artifact-derived versus current-implementation/product extrapolations.

#### Finding 3 — `/sign-in` does not exist today; `Use instantly` -> `/text` matches current auth flow

**Evidence:**

- `AppRoute` includes `/`, `/text`, `/articles`, `/files/pdf`, `/files/epub`, `/files/subtitles`, `/video-notes`, `/assets`, and `/account`; it does not include `/sign-in` (`web/src/app.tsx:120`).
- `NAV_ITEMS` likewise has no `/sign-in`; the auth-related entry is `/account` (`web/src/app.tsx:184-194`). Unknown hash routes are coerced back to `/` through `parseHashLocation()` / `isRoute()` (`web/src/app.tsx:212-231`).
- Public landing renders only for `!session && route === "/"` (`web/src/app.tsx:1082-1099`); signed-out users who navigate to other valid routes enter the app shell rather than a dedicated sign-in page (`web/src/app.tsx:1140-1299`).
- Current public nav `Sign in` navigates to `/account`, not `/sign-in` (`web/src/app.tsx:1377-1383`).
- Current landing still embeds a full auth panel with `Use instantly`, email/password, password show/hide, relay endpoint `<details>`, boot copy, and submit button (`web/src/app.tsx:1428-1479`).
- Email/password sign-in calls `createWebSession()`, saves the session, refreshes authenticated workspace/cloud/import state, then routes to `/text` (`web/src/app.tsx:844-866`).
- `Use instantly` / `Start free` calls `createWebAnonymousSession()`, saves the session, refreshes the same workspace/cloud/import state, then routes to `/text` (`web/src/app.tsx:876-895`).

**Eliminated hypotheses:**

- There is no hidden or partial `/sign-in` route in the current route union or navigation list.
- The plan's `/text` success-target assumption is not speculative relative to current implementation; both anonymous and email sign-in paths route there.
- The current app is not strictly auth-gated at the route level; some signed-out routes render the app shell and rely on page-level gates/controls.

**Conclusion:**

The plan correctly identifies a real route gap: `/sign-in` must be added as an SPA route if the redesign moves auth out of the hero. The plan also correctly states that `Use instantly` should land in `/text`, but should mention this is based on current `signIn`/`startFreeSession` behavior rather than the standalone artifact.

#### Finding 4 — The plan still under-specifies metadata, PWA manifest/install states, and public copy cleanup surfaces

**Evidence:**

- `web/index.html` has public metadata and launch-surface copy: description/OG description, title, theme color, icon, canonical, and manifest link (`web/index.html:6-21`). The canonical is still the placeholder `https://astra.example/` (`web/index.html:19`).
- `web/public/manifest.webmanifest` has name, short name, description, start URL, display mode, colors, and icons, but no explicit `scope`, screenshot entries, maskable icon purpose, or launch copy notes (`web/public/manifest.webmanifest:2-29`).
- The app registers a service worker only in production (`web/src/main.tsx:12-16`).
- PWA install UI is event-gated by `beforeinstallprompt` and `appinstalled`, with `installState` values `idle`, `installing`, `accepted`, and `dismissed` (`web/src/app.tsx:583-622`). Landing and app shell only show `Install PWA` when `canInstall` is true (`web/src/app.tsx:1415-1419`, `web/src/app.tsx:1151-1155`).
- Current landing copy still includes broad/competitive phrasing such as “Read the web like a language tutor is already built in,” “Built to replace your daily reading translator,” and “Read Frog parity” (`web/src/app.tsx:1402-1408`, `web/src/app.tsx:1510-1514`).
- Web/PWA positioning says the web companion is for text, imported content, account access, and synced assets, while the extension remains required for live webpage mutation and browser-integrated workflows (`docs/specs/web-pwa-companion.md:3-35`). URL import is explicitly not live page injection (`docs/specs/web-pwa-companion.md:78-88`).

**Eliminated hypotheses:**

- PWA install is not completely absent; a current install-prompt hook and conditional CTA exist.
- Metadata is not generated elsewhere in the React app; `web/index.html` and `web/public/manifest.webmanifest` are handoff surfaces that the plan should name explicitly.

**Conclusion:**

The plan's copy deck and PWA state sections are directionally right (`docs/plans/astra-web-landing-redesign-ui-system-2026-05-12.md:106-107`, `docs/plans/astra-web-landing-redesign-ui-system-2026-05-12.md:160-168`), but they should explicitly add acceptance for `web/index.html` metadata, canonical URL, manifest fields/icons, install fallback/unavailable copy, and cleanup of current public/competitive copy in `web/src/app.tsx`.

#### Finding 5 — Product sample handoff needs decorative-vs-wired labels for every control/state

**Evidence:**

- Current public product shot is hardcoded static UI: a browser frame with `astra://article/workspace`, static reader-nav buttons, and fixed bilingual lines (`web/src/app.tsx:1485-1512`). CSS reinforces this as a local `.browser-frame` / `.browser-content` construct (`web/src/styles.css:289-373`).
- The standalone redesign explicitly says the hero sample is not a screenshot; it is one paragraph of real article copy rendered in Astra's product vocabulary, with accent rails, italic serif glosses, and saved-word chips (embedded in `astra (ui)/Astra Web Landing Redesign - standalone.html:179`).
- Existing design comparison docs warn that marginalia/sticky/Keep patterns are large UX changes, not trivial visuals: marginalia column layout, inline sticky notes, and sticky note `Keep` require new behavior/handlers (`docs/design-comparison/README.md:48-61`).
- The plan asks whether Keep/Save is static or real (`docs/plans/astra-web-landing-redesign-ui-system-2026-05-12.md:70`, `docs/plans/astra-web-landing-redesign-ui-system-2026-05-12.md:242`), but does not require a per-affordance label for all sample controls, chips, rails, progress pills, saved-word actions, and nav-like elements.

**Eliminated hypotheses:**

- The current product sample is not backed by live article/import state.
- The standalone design's “real” language does not automatically mean every visual affordance should become interactive in the landing implementation.

**Conclusion:**

The plan should require explicit labels for each product-sample element: decorative/static, navigational, or wired to real saved/imported/session data. This avoids accidentally promising real Keep/Save/progress behavior from a landing-page illustration.

#### Finding 6 — Component acceptance criteria should be testable, not just inventoried

**Evidence:**

- Current public UI styles are ad hoc landing classes for nav, message, hero, login panel, advanced settings, browser frame, and feature cards (`web/src/styles.css:144-443`).
- Buttons have variants and disabled styling, but acceptance is implicit rather than expressed as component contracts (`web/src/styles.css:600-669`).
- Responsive behavior exists through broad breakpoints, but does not specify required screenshots/acceptance at 1440, 834/768, 390, and 360 widths (`web/src/styles.css:1088-1243`).
- Current auth form puts empty-field validation into one card-level error string (`web/src/app.tsx:1330-1347`, `web/src/app.tsx:1466-1470`), while the plan asks for field-level error design (`docs/plans/astra-web-landing-redesign-ui-system-2026-05-12.md:100`).
- The plan identifies a Web Landing Kit and states/variants (`docs/plans/astra-web-landing-redesign-ui-system-2026-05-12.md:112-126`), plus accessibility requirements (`docs/plans/astra-web-landing-redesign-ui-system-2026-05-12.md:170-180`), but does not turn them into concrete acceptance checks.

**Eliminated hypotheses:**

- The plan did not forget the component inventory; it lists the right component families.
- The current implementation does not yet have a reusable kit; the CSS remains page-local and state coverage is uneven.

**Conclusion:**

Add component acceptance criteria to the plan: keyboard tab order, focus-visible proof, disabled/loading semantics, aria-live expectation for auth/banner messages, password toggle accessible name, advanced disclosure expanded/error associations, mobile screenshots at required widths, reduced-motion handling, and field-level validation placement. This would make the handoff verifiable rather than just descriptive.

## Investigation Log

### Phase 1 - Initial Assessment
**Hypothesis:** The current plan may still be too broad or may make assumptions not fully supported by the standalone redesign/current web app.
**Findings:** Initial read shows the plan already addresses landing, `/sign-in`, responsive variants, Web Landing Kit, token mapping, copy boundaries, accessibility, and open questions. Need deeper comparison against the actual `astra (ui)/` standalone artifact and current web routes/styles.
**Evidence:** `docs/plans/astra-web-landing-redesign-ui-system-2026-05-12.md`; `astra (ui)/Astra Web Landing Redesign - standalone.html` path match.
**Conclusion:** Needs context-builder selection and pair investigation.

## Root Cause

The plan’s main weakness is not strategic direction; it is **contract precision**. It correctly identifies the desired landing/sign-in redesign, but several decisions remain expressed as broad design guidance rather than handoff-ready contracts:

1. **Source evidence is too loose.** The plan cites `Astra Web Landing Redesign - standalone.html:179`, but the actual artifact is `astra (ui)/Astra Web Landing Redesign - standalone.html`, and line 179 is a bundled/escaped template line rather than a normal readable source section. The plan should record extracted section/artboard labels so future reviewers know what evidence was used.
2. **Routing is underspecified.** `/sign-in` does not exist today (`web/src/app.tsx:120`), and route recognition currently depends on `NAV_ITEMS` through `isRoute()`; unknown hashes fall back to `/` (`web/src/app.tsx:212-231`). A dedicated sign-in page therefore needs a route-recognition contract, not just an artboard.
3. **Launch-surface handoff is incomplete.** Landing copy changes can affect `web/index.html` metadata/canonical/theme color (`web/index.html:6-21`) and the PWA manifest (`web/public/manifest.webmanifest:2-29`), but the plan does not explicitly list these handoff surfaces.
4. **Interaction truthfulness is unresolved.** The standalone sample uses real product vocabulary, while current product shot is static (`web/src/app.tsx:1485-1512`). Marginalia, saved chips, progress cues, and Keep/Save affordances must be labeled static/decorative, navigational, or real/wired so engineering does not accidentally inherit unplanned behavior.
5. **The UI kit is inventoried, not acceptance-tested.** The plan names the right component families, but should turn them into verifiable criteria: anatomy, tokens, min target sizes, focus/loading/disabled/error states, ARIA expectations, mobile behavior, and responsive screenshots.

## Eliminated Hypotheses

- **The plan is based on the wrong artifact — eliminated.** The relevant artifact exists at `astra (ui)/Astra Web Landing Redesign - standalone.html`, and extraction from its bundled line 179 confirms the expected Diagnosis, Marginalia hero, Editorial sample, and Dedicated sign-in sections.
- **The plan misses the standalone redesign’s core idea — eliminated.** It correctly captures the product-led marginalia hero, one editorial sample, dedicated sign-in page, Quiet/Constellation directions, 2px accent rail, italic target/gloss, and Advanced relay disclosure.
- **`Use instantly → /text` is unsupported by current implementation — eliminated.** Both email/password sign-in and anonymous start save route `/text` after session creation (`web/src/app.tsx:844-895`). It should still be labeled current-implementation-derived, not artifact-derived.
- **A full authenticated workspace redesign is required — eliminated.** The evidence supports keeping scope to landing, `/sign-in`, and a small landing/auth kit; broader workspace redesign can remain out of scope.

## Recommendations

1. **Add a Source Evidence section to the plan.** Use the full path `astra (ui)/Astra Web Landing Redesign - standalone.html`; explain that `:179` is a bundled template line; list extracted labels: Diagnosis, A · Marginalia hero, B · Editorial sample, C · Dedicated sign-in, Quiet Reader, Constellation, `/sign-in`.
2. **Add a `/sign-in` Routing Contract.** Specify that `/sign-in` is a public SPA route; whether it is in `NAV_ITEMS` or a separate route registry; public nav target; signed-in behavior; document title; invalid hash fallback; and direct `#/sign-in` QA.
3. **Keep `Use instantly → /text`, but mark it as implementation-backed.** Cite current auth flows and require product confirmation for whether anonymous success should always land on `/text`, `/`, or last intended workspace.
4. **Add metadata/PWA handoff surfaces.** Include `web/index.html` and `web/public/manifest.webmanifest` in the design/engineering handoff for title, description, OG copy, canonical URL, theme/background color, manifest description/name, icon/screenshot needs, and install copy.
5. **Expand PWA install states.** Current install logic has `idle`, `installing`, `accepted`, and `dismissed`; the plan should cover accepted, dismissed, unavailable, fallback copy, and how those states appear on landing and `/sign-in`.
6. **Require static-vs-wired labels for product sample affordances.** Every rail, chip, note, progress pill, Keep/Save button, and nav-like control in the hero/editorial sample should be labeled decorative/static, navigational, or real/wired.
7. **Convert the Web Landing Kit into acceptance criteria.** For Button, Card, Input/Field, Password field, Disclosure, Message/Banner, Product sample frame, Marginalia rail, and Focus ring, require anatomy, token mapping, min touch target, hover/focus-visible/disabled/loading/error states, ARIA notes, and mobile behavior.
8. **Add a current-copy cleanup checklist.** Explicitly replace competitor/internal/implementation-oriented copy such as “Read Frog parity,” “Cloudflare-ready launch,” “Owner-managed API keys,” and unqualified “read the web” claims with Web/PWA-safe user-benefit copy.
9. **Clarify Constellation acceptance.** Keep the recommendation that Quiet Reader is production and Constellation is exploratory; add that missing dark responsive states are not launch blockers unless product expands scope.

## Latest Coverage Check — external Downloads artifact

Checked `/Users/ruirui/Downloads/astra/Astra Web Landing Redesign - standalone.html` against the current `web/` route surface and billing/control-plane code.

### Conclusion

The external standalone artifact is **not a complete all-pages/all-systems UI design**. It covers a public landing redesign and a dedicated sign-in concept, but it does not cover the full authenticated web companion, pricing, billing/payment, checkout lifecycle, account/billing management, legal/help pages, or production state matrices across all system surfaces.

### Evidence

- The external artifact's design canvas is titled `Astra — Web landing redesign` and its top-level artboard groups are `Diagnosis`, `A · Marginalia hero — show the product in the hero`, `B · The editorial sample — keep one product shot, drop the rest`, and `C · Dedicated sign-in — a paper-card modal, not a sidebar`.
- The external artifact contains landing variants and sign-in variants for `Quiet Reader` and `Constellation`, but term inspection found no meaningful billing/payment/checkout/invoice/subscription UI artboards. `Pricing` appears only as a nav/footer concept, not as a completed pricing page.
- Current `web` routes are `/`, `/text`, `/articles`, `/files/pdf`, `/files/epub`, `/files/subtitles`, `/video-notes`, `/assets`, and `/account`; there is no `/sign-in`, `/pricing`, or `/changelog` route (`web/src/app.tsx:120`, `web/src/app.tsx:184-194`).
- Current account UI has quota/usage cards and a `Billing handoff` card with `Upgrade to Pro` and `Open billing portal` buttons (`web/src/app.tsx:3847-3883`), but it does not design the checkout, success/cancel return, invoices, failed-payment recovery, downgrade/cancel, or subscription-status lifecycle.
- Billing backend/client link generation exists through `/v1/billing/checkout` and `/v1/billing/portal` (`server/index.ts:1096-1103`, `src/utils/astra/account.ts:349-371`, `web/src/lib/astra-web.ts:1249-1271`). That confirms billing is a real product surface, but the design artifact only covers the handoff button level.

### Missing UI coverage to add before claiming “complete UI system”

1. **Pricing page** — plan comparison, free/pro limits, usage/quota copy, managed relay caveats, CTA states, FAQ, mobile layout.
2. **Billing/payment lifecycle** — checkout entry, provider handoff, success return, cancel return, pending state, failed payment/past_due, retry payment, payment method update, invoice/receipt access, tax/VAT/legal copy if applicable.
3. **Subscription management** — current plan, renewal date, cancel/downgrade/upgrade, paused/expired/trial/anonymous states, portal unavailable/error fallback.
4. **Account settings** — profile/billing email, session/device management, data export/delete, privacy/legal links, quota/usage detail, sync/continuity status in user-facing language.
5. **Authenticated workspace redesign** — `/text`, `/articles`, `/files/pdf`, `/files/epub`, `/files/subtitles`, `/video-notes`, `/assets`, `/account` currently remain outside the standalone redesign scope.
6. **Public secondary pages** — `/pricing`, `/changelog`, privacy, terms, help/docs/support/contact, status/error pages. The artifact mentions Pricing/Changelog/Privacy/Terms concepts, but does not design them as pages.
7. **System states** — loading, empty, error, unauthorized, quota exceeded, relay unavailable, offline, PWA install unavailable/dismissed/accepted, mobile keyboard-safe auth, reduced-motion, focus and accessibility states.
8. **Full UI system primitives** — shared buttons, cards, fields, banners, modals/dialogs, tables, tabs, toasts, empty states, destructive confirmation, data tables, and form validation across landing/auth/account/workspace surfaces.

### Recommendation update

Treat the external artifact as **Phase 1: public landing + sign-in direction**, not as the final full UI system. The next design brief should explicitly split work into:

1. Landing + `/sign-in` production handoff.
2. Pricing + billing/payment lifecycle.
3. Account/control-plane UI.
4. Authenticated workspace UI system.
5. Legal/help/status/support pages and system states.

## Preventive Measures

- For bundled design artifacts, always record the exact path plus extracted section/artboard names instead of relying on a single generated line reference.
- Separate plan assertions into **artifact-derived**, **current-implementation-derived**, and **product-decision-needed** categories.
- Add route contracts whenever a design plan introduces a new public route, especially in hash-routed apps where route recognition is not automatic.
- Treat metadata, manifest, install states, and public copy as launch surfaces for landing-page redesigns.
- Require static-vs-wired labels for every product mockup affordance before engineering begins.
