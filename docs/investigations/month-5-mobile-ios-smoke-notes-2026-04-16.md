# Month 5 — Mobile web + iOS bridge smoke notes (2026-04-16)

**Purpose:** Repeatable steps + evidence placeholders for the bridge-first mobile story. Execution is **manual** (device/simulator + browser). Keep these as **two separate evidence buckets**:

1. **iOS shell / bridge / Safari-runtime evidence**
2. **Mobile web portable control-plane evidence**

Portable web success does **not** upgrade the iOS shell support tier by itself.

**Primary references:** `ios/README.md`, `docs/ios-safari-smoke-test.md`, `docs/investigations/control-plane-surface-inventory-2026-04-15.md`, `docs/investigations/support-matrix-2026-q2.md`.

---

## A. iOS shell + Safari extension + host bridge

Use this section only for host-shell, extension-runtime, and launch/open/handoff validation.

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
- [ ] Safari: verify popup opens and bridge/open path is reachable
- [ ] If page translation runtime is checked, record it explicitly as **Safari-runtime evidence**, not as mobile web evidence

### A.3 Daily update path (when `src/` changes)

```bash
pnpm build:safari
pnpm ios:sync-extension
```

(or `pnpm ios:prepare` one-shot)

### A.4 Shell / bridge runtime checklist

From `ios/README.md` and `docs/ios-safari-smoke-test.md`:

- [ ] Host app launches successfully
- [ ] Safari extension can be enabled from iOS Settings
- [ ] Popup opens inside Safari
- [ ] API key can be saved
- [ ] `browser.storage.local` persists config after reload
- [ ] Page translation can start and stop
- [ ] Content scripts inject correctly on normal pages
- [ ] Background translation requests complete successfully
- [ ] `sessionBootstrap` → `sessionBootstrapAck` with `launchURL`
- [ ] Deep link opens host; bridge status/history visible as documented
- [ ] Replay / open flows exercised if UI exposes them

### A.5 Claim boundary for this bucket

- This bucket is the only one that can improve confidence in the **iOS Safari shell** itself.
- Bridge/open evidence is useful for Month 5 closeout, but by itself it still does **not** promote iOS beyond **Experimental**.
- Any shell/runtime failure should be logged as a Safari-runtime gap, not hidden inside broader “mobile works” language.

---

## B. Mobile web — narrow viewport (Astra Web / PWA)

**Baseline:** inventory points at `web/src/app.tsx` + `web/src/styles.css` for responsive behavior.

This section covers **portable sign-in/session/account/control-plane** behavior only. It does **not** prove extension runtime, native host bridge, or page-mutation parity.

### B.1 Desktop browser narrow mode (fast feedback)

- [ ] Open web app build or dev server; set viewport ~**390×844** (iPhone-class) or **360×800** (Android-class).
- [ ] Rotate portrait ↔ landscape once; no horizontal scroll trap on `#/` and `#/account`.
- [ ] Primary nav / hash navigation still reachable.
- [ ] Account route `#/account`: sign-in gate, usage/plan blocks, export/delete/repair entry points visible without clipping.
- [ ] Long error/helper text wraps; buttons stay tappable.

### B.2 Mobile Safari (evidence-bearing)

- [ ] Repeat B.1 on **real mobile Safari** (or simulator Safari) against the same relay you use for extension smoke.
- [ ] Confirm portable web sign-in/session flow still works: `POST /v1/auth/session`, then `GET` / `DELETE /v1/auth/session`.
- [ ] Capture **one** screenshot set: home + account + one modal/error state if encountered.

### B.3 PWA / “Add to Home Screen” (if applicable to your test matrix)

- [ ] Document whether test used tab vs installed PWA.
- [ ] Session persistence after kill/relaunch matches expectation for the portable web surface.

### B.4 Claim boundary for this bucket

- Count success here as **portable mobile web evidence** only.
- Do **not** reinterpret this as iOS native-shell parity, extension-runtime proof, or Android support-level change.
- This bucket can support a Month 5 **carry-but-acceptable** note when wording is aligned and the evidence row is attached.

---

## C. Evidence placeholders (fill on run)

| Run ID | Date | Evidence bucket | Device / OS | Browser | Relay URL | Tester | Notes link / folder |
|--------|------|-----------------|-------------|---------|-----------|--------|---------------------|
| E1 | | Shell / bridge / Safari-runtime | | | | | |
| E2 | | Mobile web portable control-plane | | | | | |

**Attachments (suggested):**

- Screenshots or short screen recording
- HAR or redacted console log only if needed to explain a failure (no secrets)
- Explicit note if a capture is being used only for portable web and not for shell/runtime support

---

## D. Definition of done (for checking the plan line)

Check **mobile web / iOS bridge smoke** only after:

1. At least **one** completed evidence row (C) is attached,
2. The row is labeled with the correct evidence bucket,
3. Any failure is either fixed or filed with owner + carry-over to Month 6 per plan rules, and
4. No doc upgrades the iOS shell support level unless the **shell / bridge / Safari-runtime** bucket has device-backed attachments.
