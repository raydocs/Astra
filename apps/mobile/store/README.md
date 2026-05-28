# Astra Review Store Release Pack

This folder contains the store-facing draft artifacts for the native Astra Review companion.

Scope:

- iOS App Store / TestFlight listing draft: `ios/app-store-connect.md`
- Google Play listing draft: `android/play-listing.md`
- Shared privacy and data-use answers: `privacy.md`
- Screenshot and preview capture plan: `screenshots/README.md`
- Reviewer notes template: `reviewer-notes.md`
- Signed-build QA evidence template: `signed-build-qa.md`
- Manual release checklist: `release-checklist.md`

These files are intentionally account-agnostic. They should stay aligned with the current mobile release surface: privacy-safe sharing, front-only Play/Speak on review cards, Library saved-item Speak, Not useful feedback, source-title hiding / Private source masking, Weekly Digest email action, account data export, metadata-only help note, synced learning-data deletion, and Delete account.

`pnpm --dir apps/mobile verify` guards the release pack for required store/privacy/screenshot/checklist terms. Treat that verifier as the local regression check before editing these files.

Final upload still requires Apple Developer Program and Google Play Console access, signing credentials, production HTTPS API configuration, approved support/marketing/privacy URLs, final screenshots captured from an approved build, and signed-build VoiceOver/TalkBack smoke evidence.
