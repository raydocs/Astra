# iOS Safari Smoke Test

This checklist is intended for simulator or real-device passes against the in-repo `AstraShell` Safari host project.

## Goal

Verify that the generated Safari bundle, the Xcode shell, and the extension runtime behave correctly on iOS Safari without mixing product bugs with shell or packaging bugs.

## Preconditions

1. Run `pnpm install`
2. Run `pnpm ios:prepare`
3. Open `ios/AstraShell.xcodeproj`
4. Configure signing for `AstraShell` and `AstraShell Extension`
5. Enable the extension in iOS Settings after the host app installs

## Test matrix

### Host app and extension activation

- Host app launches without crashing
- Safari extension appears in Settings
- Extension can be enabled
- Extension shows up in Safari extension controls
- Install/open-in-app path is clear to tester (Settings enable path + popup action path)

### Popup and configuration

- Popup opens from Safari
- API key can be saved
- Base URL and model can be saved
- Site-level disable toggle persists after reopening popup
- Content scope change persists after reopening popup
- iOS bridge status is visible in popup (available/unavailable + last bootstrap + event history count)
- `Open in Astra App` works when bridge is available
- `Replay last handoff` works after at least one bridge event exists

### Translation lifecycle

- Start page translation on a normal article page
- Stop page translation cleanly
- Re-run translation after stop without reload
- Translation state survives popup reopen while page remains open

### Content interactions

- Selection toolbar appears after selecting text
- Inline translate works
- Inline explain works
- Hover translation works on supported trigger mode
- Overlay dismissal still works on scroll and blur

### Runtime/storage stability

- `browser.storage.local` survives Safari relaunch
- Background translation requests complete successfully
- No repeated permission prompts during normal use
- `runtime/ios-bootstrap-status` and `runtime/ios-bootstrap-history` return consistent data

### Host bridge handoff visibility

- Onboarding shows launch/open/handoff narrative and bridge state
- Completing onboarding can trigger iOS bootstrap consume without blocking completion
- Host app receives `astra-shell://bootstrap` and shows latest handoff session
- Host app shows short bridge history (not just single last event)

### Mobile web control-plane checkpoint

- Mobile Safari can open the Astra Web account workspace without desktop-only layout breakage
- Account summary remains readable at narrow viewport widths
- Continuity export / cloud delete controls remain operable at narrow viewport widths
- Manual sync repair control remains operable at narrow viewport widths
- Any account/control-plane success here is logged as **portable web coverage**, not as iOS native-shell parity

## Suggested test pages

- Long article page with sidebar
- Comment-heavy blog post
- Dynamic feed page
- Simple marketing page

Use the local fixture catalog as a behavioral reference when validating extractor expectations.

## Failure logging template

Capture each failure with:

- device or simulator model
- iOS version
- page URL
- action taken
- expected result
- actual result
- whether the failure reproduces on desktop Safari or Chrome

## Responsibility guardrails (triage)

- Host app (`ios/AstraShell`): deep link consume + local handoff state visibility
- Extension (`src` + Safari target): bridge trigger, replay/open action, user-visible bridge status
- Web app (`web/`): not owner of native launch/open/handoff state; only validates portable summary/export/delete/repair control-plane coverage on mobile Safari

## Triage hints

- Popup opens but actions fail:
  - inspect runtime messaging and background worker lifecycle
- Translation starts but no DOM injection appears:
  - inspect content script injection and site eligibility
- Settings save but disappear after relaunch:
  - inspect `browser.storage.local` behavior on iOS Safari
- Works on desktop Safari but not iOS:
  - treat as Safari-runtime compatibility first, not product logic first
