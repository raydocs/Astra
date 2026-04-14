# Month 5 — Three-surface copy alignment checklist (backlog execution)

**Status:** backlog execution — run screen-by-screen diff against live UI; do **not** treat this file as evidence of alignment until an owner attaches screenshots or notes per row.

**North star:** `docs/investigations/control-plane-surface-inventory-2026-04-15.md` — **Extension / web visible strings** and **Wording rule** (relay fields → `fetchAstraAccount` / summary; no “unlimited” unless API sentinel; `past_due` / `canceled` same copy tree).

---

## 0. Preconditions

- [ ] Same relay environment for extension + web (or document which env each capture used).
- [ ] Same signed-in account (or document guest vs signed-in for each capture).
- [ ] Inventory doc open side-by-side for wording rules and route families.

---

## 1. Extension popup — `src/entrypoints/popup/App.tsx`

| # | Area | What to compare | Inventory cross-ref |
|---|------|-----------------|----------------------|
| 1.1 | Plan / quota presentation | Plan label, quota strings, any “unlimited” or billing-adjacent copy | § Extension / web visible strings; triage “Quota” row |
| 1.2 | Auth / session | Sign-in / sign-out, session errors (`Sign in failed`, etc.), guest / anonymous messaging | Auth triage row |
| 1.3 | Usage / insights | `UsageInsightsCard` and any relay-backed summaries shown in popup | `GET /v1/account/usage` semantics |
| 1.4 | i18n vs hard-coded | Keys passed to `t(...)` vs raw English in JSX (note gaps for later i18n pass) | — |

**Files to keep in view:** `src/entrypoints/popup/App.tsx`, `src/entrypoints/popup/components/UsageInsightsCard.tsx` (and related popup components touched by account/session UI).

---

## 2. Extension options — `src/entrypoints/options/OptionsApp.tsx`

| # | Area | What to compare | Inventory cross-ref |
|---|------|-----------------|----------------------|
| 2.1 | Account / continuity / devices | Remote status, device list, revoke confirmation copy | Devices revoke; continuity |
| 2.2 | API key vs relay | Copy that distinguishes BYO key vs Astra-managed session | Single source of truth paragraph |
| 2.3 | Sync / repair / export-adjacent hints | Any strings that imply billing, quota, or session refresh | Lifecycle runbook + triage table |

---

## 3. Web companion — `web/src/app.tsx` (hash route `#/account`)

| # | Area | What to compare | Inventory cross-ref |
|---|------|-----------------|----------------------|
| 3.1 | Nav / `#/account` | Sidebar label “Account”, route copy (`session / usage / billing`), deep links into account panel | `/v1/account/*` family |
| 3.2 | Account workspace body | Plan, usage, email, entitlements hints, empty/error states | Wording rule; quota / billing triage |
| 3.3 | Cross-links from other routes | “Open account …” buttons and helper copy (`account console` / `workspace` / `controls`) — flag inconsistent naming for a single preferred term in a follow-up PR | Operator / user-facing consistency |
| 3.4 | Session / sign-in CTAs | `Sign in from the account workspace first` and related gates | Auth triage |

**Related implementation (not a second route file):** `web/src/lib/astra-web.ts` — ensure displayed fields match what extension reads from the same summary/fanout contracts (inventory already names this).

---

## 4. Documentation surfaces (read-only diff vs product)

| # | Doc | Check |
|---|-----|-------|
| 4.1 | `docs/investigations/control-plane-surface-inventory-2026-04-15.md` | No phrase contradicts popup/options/web for the same state (e.g. “unlimited”, canceled semantics). |
| 4.2 | `ios/README.md` (web PWA paragraph) | Web’s role vs extension vs host bridge matches what web UI claims about session ownership. |

---

## 5. Evidence column (owner fills after diff)

| Surface | Owner | Date | Result (aligned / gap list) | Link / attachment |
|---------|-------|------|-----------------------------|-------------------|
| Popup | | | | |
| Options | | | | |
| Web `#/account` | | | | |
| Docs | | | | |

---

## Definition of done (for checking the plan line)

The Month 5 plan checkbox for full three-surface alignment stays **unchecked** until: inventory rules are satisfied on **real screens** (this checklist completed with evidence), not merely listed here.
