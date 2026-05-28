# Google Play Console Draft — Astra Review

## App identity

- App name: Astra Review
- Package name: `so.astra.review`
- Default language: English (United States)
- App or game: App
- Category: Education
- Tags: language learning, vocabulary, flashcards, reading, study
- Contains ads: No

## Short description

Review saved words and sentences from Astra on your phone.

## Full description

Astra Review is the mobile companion for Astra learners. Save useful words and sentences while reading or watching on desktop/web, then review them later in short phone sessions.

Astra Review helps you:

- Review Today cards with simple choices: Again, Good, Easy, or Skip.
- Browse a Library of saved learning sources.
- Start a review from one source when context matters.
- Use privacy-safe sharing, front-only Play/Speak, and Not useful feedback on review cards, plus Library saved-item Speak for saved words and sentences.
- Hide source titles on this phone when a saved source should stay private.
- Keep review choices available offline until the app can sync.
- Set gentle review reminders, a weekly learning note, and an email action for the weekly note.
- Link this phone from a signed-in desktop session using a code, link, or QR scan.
- Export account data, send a metadata-only help note, clear local data, request deletion of synced learning data, or delete the account.

This app is focused on review. Creating saved cards still happens through Astra on desktop/web.

Learning guidance: Astra is a study aid. Card meanings and notes may not be perfect; use the original source context when a meaning matters. Astra Review does not provide medical, legal, financial, or other professional advice.

## Release notes — internal / closed testing

First Android review companion build for Astra learners.

Included in this build:

- Today review queue.
- Library source browsing, source-title privacy masking, and source-scoped review.
- Privacy-safe sharing, front-only Play/Speak, Library saved-item Speak, and Not useful card feedback.
- Offline review choice queue with sync.
- Reminder preferences, local notifications, and weekly learning note email action.
- Desktop-to-phone link by code, link, or QR scan.
- Account data export, metadata-only help note, and local/synced/account deletion controls.

Known limitation: mobile capture is intentionally out of scope for this build.

## Data safety draft

Use `../privacy.md` as the source of truth for Data safety answers. Current build uses local device storage for session/device/review state and communicates with the Astra account service only when the user signs in, links a phone, syncs, changes Weekly Digest/reminder settings, registers or clears a push token, sends a metadata-only help note, exports account data, or requests data deletion.

## Review notes

Use `store/reviewer-notes.md` as the canonical reviewer-note template. Add private reviewer credentials and the public production API origin only inside Play Console or the release evidence packet; do not commit those values.

Production build requirement: `EXPO_PUBLIC_ASTRA_API_BASE_URL` must point to the deployed HTTPS Astra account service.

## Store listing checklist

- Feature graphic prepared.
- Phone screenshots captured from production or closed-testing build.
- Privacy Policy URL confirmed.
- Data safety form matches `store/privacy.md`.
- Content rating questionnaire completed.
- Learning guidance / study-aid disclaimer matches the in-app Me screen copy.
- Listing privacy controls match the current app: source-title hiding, privacy-safe sharing, account data export, metadata-only help note, synced learning-data deletion, and account deletion.
- Closed testing track configured before production rollout.
