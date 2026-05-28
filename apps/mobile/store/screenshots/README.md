# Mobile Store Screenshot Plan

Final screenshots must be captured from an approved iOS/Android build with sample or test-account content only.

## Required iOS captures

Capture at least these App Store sizes before submission:

- 6.7-inch iPhone display.
- 6.5-inch iPhone display if App Store Connect requires it for the selected target.
- 12.9-inch iPad if tablet screenshots are required because `supportsTablet` is true.

## Required Android captures

Capture for Google Play:

- Phone screenshots, portrait.
- Optional 7-inch tablet / 10-inch tablet screenshots if tablet listing is enabled.

## Shot list

1. Today review card with Again / Good / Easy / Skip controls plus Not useful feedback.
2. Today review card action state showing privacy-safe sharing and front-only Play/Speak.
3. Today weekly learning note preview, including the weekly note email action when signed in.
4. Library list with source cards, due counts, and Library saved-item Speak visible for a word or sentence row.
5. Library source detail with source-focused review action and source-title hiding / Private source masking.
6. Me screen showing membership status, learning guidance, sync, reminders, privacy, account data export, metadata-only help note, and local data controls.
7. Sign-in screen showing account sign-in and desktop link code entry without displaying email-code secrets.
8. QR scanner flow only if camera permission copy is needed for review evidence.

## Content rules

- Use demo/test learning content only.
- Do not show private email addresses unless they are reviewer/test accounts.
- Do not show production secrets or internal endpoints.
- Do not show browser extension control-plane screens; this mobile listing is for Review Companion.

## Capture checklist

- Build uses production display name `Astra Review`.
- Status bar is clean.
- No debug menu, Metro overlay, or local development endpoint visible.
- Screens are light-theme acceptable and legible at store sizes.
- Key screenshots remain understandable with large accessibility text enabled; do not rely on color alone for review controls.
- Screenshots match the App Store and Play listing copy in this folder, including privacy-safe sharing, Play/Speak, Library saved-item Speak, Not useful, source-title hiding, account data export, metadata-only help note, synced learning-data deletion, and Delete account coverage.
