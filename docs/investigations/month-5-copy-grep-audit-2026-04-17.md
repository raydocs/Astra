# Month 5 — Control-plane term grep audit (automated)

**Date:** 2026-04-17  
**Scope:** Case-insensitive grep for `relay`, `API`, `session`, `workspace`, `account` in:

- `src/entrypoints/popup/App.tsx`
- `src/entrypoints/options/OptionsApp.tsx`
- `web/src` (entire tree)

**Method:** `rg -i 'relay|API|session|workspace|account' <paths>`. This is a **string-level scan**, not a claim that every hit is user-visible (many hits are identifiers, props, storage keys, and tests).

**Scale (approx.):** ~**1536** total substring matches (`rg --count-matches` summed across files); ~**1064** lines with ≥1 match (`rg --count` across the same paths). Largest buckets: `web/src/app.tsx`, `web/src/lib/astra-web.ts`, `web/src/lib/workspace-store.ts`, extension popup/options entrypoints.

---

## Pattern summary (product copy risk)

| Surface | Pattern | Example file:line | Risk |
|---------|---------|-------------------|------|
| Extension popup | Session state shown as plain English (`Guest session`, signed-in path) | `src/entrypoints/popup/App.tsx` (~1168–1172, 1416) | **med** — user-facing auth framing; must stay aligned with options/web |
| Extension popup | Guest continuity copy uses “session” + “account” | `src/entrypoints/popup/App.tsx` (~1694–1696) | **med** — overlaps Month 5 “account / continuity” wording rules |
| Extension popup | Dev-oriented continuity / iOS labels expose raw `sessionId` | `src/entrypoints/popup/App.tsx` (~1437–1439, 1481–1482) | **low** for general users if gated; **med** if shown in default builds |
| Extension options | Provider form: “API key”, “Relay URL”, “relay server”, “no Astra account required” | `src/entrypoints/options/OptionsApp.tsx` (~532–553) | **med** — canonical place users learn BYO key vs relay; must match inventory “single source of truth” |
| Extension options | About / diagnostics: relay vs direct API (i18n keys `options_diagRelay`, `options_diagAstraRelay`, etc.) | `src/entrypoints/options/OptionsApp.tsx` (~1470–1505) | **med** — operator-facing health copy |
| Extension options | Continuity panel: “Device/session registry”, bold **Session:** | `src/entrypoints/options/OptionsApp.tsx` (~1678, ~1692) | **med** — “session” as control-plane noun |
| Web companion | Nav + route copy: “Account”, “session / usage / billing”, “workspace” in hero/subtitle | `web/src/app.tsx` (~180–188, ~953–987) | **med** — primary three-surface alignment surface |
| Web companion | Dashboard: “Session”, “Open account console”, “relay translation”, “account controls” | `web/src/app.tsx` (~1255–1290, ~1374–1384) | **med** — mixed metaphors (console / controls / workspace) flagged in checklist §3.3 |
| Web companion | Gated tasks: “relay sessions”, “account workspace” | `web/src/app.tsx` (~1554–1556) | **med** — direct overlap with control-plane inventory language |
| Web companion | Product “workspace” (text/article/PDF…) vs `#/account` “Account & quota” card | `web/src/app.tsx` (~1193–1227, 1342+) | **low** for “saved workspace library” (learner metaphor); **med** where “workspace” sits next to session/billing strings |
| Web + shared libs | Implementation noise: `relayBaseURL`, `apiKey`, `readWebSession`, IndexedDB `workspace` — not all visible | `web/src/lib/astra-web.ts`, `web/src/lib/workspace-store.ts`, tests | **low** for copy alignment (still useful to find accidental UI leakage) |

---

## Follow-ups (not done here)

- Screen-by-screen diff and evidence remain on `docs/investigations/month-5-copy-alignment-checklist-2026-04-16.md`.
- Prefer tightening **user-visible** strings only after inventory cross-check (`docs/investigations/control-plane-surface-inventory-2026-04-15.md`).
