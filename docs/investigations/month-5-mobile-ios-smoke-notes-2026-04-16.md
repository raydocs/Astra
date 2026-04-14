# Month 5 — Mobile web + iOS bridge smoke notes (2026-04-16)

**Purpose:** Repeatable steps + evidence placeholders. Execution is **manual** (device/simulator + browser). Do not check plan acceptance until artifacts are attached.

**Primary references:** `ios/README.md`, `docs/investigations/control-plane-surface-inventory-2026-04-15.md` (§ Mobile web / iOS).

---

## A. iOS shell + Safari extension (from `ios/README.md`)

### A.1 Environment

- [ ] macOS + Xcode available
- [ ] iOS 16.4+ simulator or device
- [ ] Node + pnpm per repo (`AGENTS.md`)

### A.2 Build / sync (host + extension resources)

```bash
pnpm install
pnpm ios:prepare
open ios/AstraShell.xcodeproj
```

Then in Xcode (see README for detail):

- [ ] `AstraShell` scheme selected
- [ ] Signing Team set for **AstraShell** and **AstraShell Extension**
- [ ] Run on simulator or device
- [ ] Enable extension: **Settings → Apps → Safari → Extensions → AstraShell**
- [ ] Safari: verify popup + page translation flow

### A.3 Daily update path (when `src/` changes)

```bash
pnpm build:safari
pnpm ios:sync-extension
```

(or `pnpm ios:prepare` one-shot)

### A.4 README smoke checklist (copy for tick-off)

From **Smoke Test Checklist** in `ios/README.md`:

- [ ] Host app launches successfully
- [ ] Safari extension can be enabled from iOS Settings
- [ ] Popup opens inside Safari
- [ ] Astra Web / PWA sign-in succeeds (`POST /v1/auth/session` on mobile Safari)
- [ ] `GET /v1/auth/session` and `DELETE /v1/auth/session` behave correctly after sign-in
- [ ] API key can be saved
- [ ] `browser.storage.local` persists config after reload
- [ ] Page translation can start and stop
- [ ] Content scripts inject correctly on normal pages
- [ ] Background translation requests complete successfully

### A.5 Host bridge (optional but recommended for Month 5 claim)

Follow **Launch / Open / Handoff narrative** and **Install + Open-in-app path** in `ios/README.md`:

- [ ] `sessionBootstrap` → `sessionBootstrapAck` with `launchURL`
- [ ] Deep link opens host; bridge status/history visible as documented
- [ ] Replay / open flows exercised if UI exposes them

---

## B. Mobile web — narrow viewport (Astra Web / PWA)

**Baseline:** inventory points at `web/src/app.tsx` + `web/src/styles.css` for responsive behavior.

### B.1 Desktop browser narrow mode (fast feedback)

- [ ] Open web app build or dev server; set viewport ~**390×844** (iPhone-class) or **360×800** (Android-class).
- [ ] Rotate portrait ↔ landscape once; no horizontal scroll trap on `#/` and `#/account`.
- [ ] Primary nav / hash navigation still reachable (hamburger / drawer / bottom bar — whatever the current layout uses).
- [ ] Account route `#/account`: sign-in gate, usage/plan blocks, export/delete/repair entry points visible without clipping.
- [ ] Long error/helper text wraps; buttons stay tappable (min touch target sanity).

### B.2 Mobile Safari (evidence-bearing)

- [ ] Repeat B.1 on **real mobile Safari** (or simulator Safari) against the same relay you use for extension smoke.
- [ ] Capture **one** screenshot set: home + account + one modal/error state if encountered.

### B.3 PWA / “Add to Home Screen” (if applicable to your test matrix)

- [ ] Document whether test used tab vs installed PWA; session persistence matches expectation after kill/relaunch.

---

## C. Evidence placeholders (fill on run)

| Run ID | Date | Device / OS | Browser | Relay URL | Tester | Notes link / folder |
|--------|------|-------------|---------|-----------|--------|---------------------|
| E1 | | | | | | |
| E2 | | | | | | |

**Attachments (suggested):**

- Screenshots or short screen recording (mobile web + iOS popup path).
- HAR or redacted console log only if needed to explain a failure (no secrets).

---

## D. Definition of done (for checking the plan line)

Check **mobile web / iOS bridge smoke** only after:

1. At least **one** completed evidence row (C) tied to README checklist items, and  
2. Any failure is either fixed or filed with owner + carry-over to Month 6 per plan rules.
