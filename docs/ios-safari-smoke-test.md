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

### Popup and configuration

- Popup opens from Safari
- API key can be saved
- Base URL and model can be saved
- Site-level disable toggle persists after reopening popup
- Content scope change persists after reopening popup

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

## Triage hints

- Popup opens but actions fail:
  - inspect runtime messaging and background worker lifecycle
- Translation starts but no DOM injection appears:
  - inspect content script injection and site eligibility
- Settings save but disappear after relaunch:
  - inspect `browser.storage.local` behavior on iOS Safari
- Works on desktop Safari but not iOS:
  - treat as Safari-runtime compatibility first, not product logic first
