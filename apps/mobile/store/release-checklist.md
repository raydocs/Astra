# Astra Review Mobile Release Checklist

Use this checklist before TestFlight, closed testing, or production submission.

## Code and configuration

- `pnpm --dir apps/mobile type-check` passes.
- `pnpm verify:mobile` passes.
- `pnpm type-check` passes at repo root.
- `pnpm check:repo-knowledge` passes.
- `app.json` version is correct.
- iOS bundle identifier is `so.astra.review`.
- Android package is `so.astra.review`.
- Production builds set `EXPO_PUBLIC_ASTRA_API_BASE_URL` to a deployed HTTPS endpoint.
- EAS preview/production profiles set `EXPO_PUBLIC_ASTRA_BUILD_PROFILE`, and `pnpm mobile:verify` confirms those profile markers.
- No production API/provider secrets are committed in `eas.json`, `app.json`, or public Expo env vars; `EXPO_PUBLIC_*` values are treated as bundled non-secret metadata only.
- Record the non-secret deployed relay origin used for the signed build in the release evidence packet.
- Camera usage copy matches QR linking behavior.
- Notification behavior stays opt-in from user-initiated reminder or weekly learning-note actions in Me settings.
- No microphone/storage/overlay permissions are present in the release Android permission surface; unused native-package permissions stay blocked in app config and manifest merge rules.
- Accessibility V0 baseline is present for Today Review, Library, and Me: screen-reader labels/hints, non-color-only review rating labels, and 44pt touch-target helpers.

## Native build gates

- `pnpm --dir apps/mobile exec expo prebuild --platform ios --no-install` passes.
- `pnpm --dir apps/mobile exec expo prebuild --platform android --no-install` passes.
- `pnpm mobile:ios:pods` passes.
- `pnpm mobile:xcode:list` shows `AstraReview`.
- `pnpm mobile:android:assemble` passes.
- `pnpm mobile:ios:build:generic` passes on a Mac/Xcode image with the required iOS platform installed.

## Store materials

- App Store listing draft reviewed: `store/ios/app-store-connect.md`.
- Play listing draft reviewed: `store/android/play-listing.md`.
- Privacy/Data safety draft reviewed: `store/privacy.md`.
- Local privacy draft matches mobile API endpoints in `apps/mobile/src/api/astraClient.ts` before release.
- Screenshot plan complete: `store/screenshots/README.md`.
- Final screenshots captured from signed build.
- Signed-build QA evidence is recorded in `store/signed-build-qa.md` or the release evidence packet with owner, environment, evidence, and verdict for each row.
- Support, marketing, and privacy URLs confirmed.
- Reviewer test account created with saved cards.
- Reviewer notes are prepared from `store/reviewer-notes.md` and include mobile companion scope, sign-in path, learning-guidance / study-aid disclaimer, notification/camera permission timing, no mobile subscription sales, known mobile-capture limitation, Library saved-item Speak, and privacy controls: source-title hiding, privacy-safe sharing, account data export, metadata-only help note, synced learning-data deletion, and Delete account.

## Submission

- TestFlight build uploaded and processed.
- Internal or closed Play testing build uploaded and processed.
- App Store privacy nutrition completed from `store/privacy.md`.
- Play Data safety form completed from `store/privacy.md`.
- Release notes match current build scope.
- Learning-guidance / study-aid disclaimer is present in app, listing drafts, and privacy/data-use draft.
- VoiceOver/TalkBack smoke pass covers Today review, Not useful, privacy-safe sharing, front-only Play/Speak, Library saved-item Speak, Library source detail and source-title hiding, Me reminders/privacy/export/help note, and sign-in path on a signed build.

## Known external blockers

- Apple Developer Program access.
- Google Play Console access.
- Production HTTPS Astra account endpoint.
- Distribution signing credentials.
- Local/CI Xcode image with the matching iOS platform component installed.
