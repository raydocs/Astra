# Mobile Reviewer Notes Template

Use this template for App Review, TestFlight, and Google Play closed-testing reviewer notes. Fill the private values only in the store console or release evidence packet; do not commit credentials, tokens, or internal endpoints.

## Private console fields

- Reviewer account email: provide in the store console only.
- Reviewer account password or one-time sign-in code path: provide in the store console only.
- Public production API origin: provide the deployed HTTPS Astra account service origin used by the signed build.
- Support contact: provide the approved support channel for reviewers.

## Reviewer note copy

Astra Review is a companion app for reviewing saved language-learning cards. Saved words and sentences are created on Astra desktop/web and reviewed on mobile. Use the supplied reviewer account to sign in, then open Today, Library, and Me.

Suggested review path:

1. Sign in with the supplied reviewer account.
2. Open Today and review a card with Again, Good, Easy, or Skip.
3. Try privacy-safe sharing, front-only Play/Speak, and Not useful feedback on a review card.
4. Open Library, use Library saved-item Speak on a saved word or sentence and confirm only the saved expression is read aloud, then view a source detail, hide/show a source title, and start a source-focused review.
5. Open Me to review reminder settings, the Learning guidance note, account data export, metadata-only help note, synced learning-data deletion, and Delete account availability.

QR linking is available from an authenticated desktop session, but email/password sign-in is the simplest review path. Camera access is requested only when the reviewer chooses QR scanning. Notification permission is requested only after the reviewer chooses reminder or weekly learning-note settings.

Astra Review is a study aid. Card meanings and notes may not be perfect, and reviewers should use source context when meaning matters. The app does not provide medical, legal, financial, or other professional advice.

The mobile app does not sell or manage subscriptions. Account plan state is read-only and shown from the Astra account when available.

Privacy controls available in this build include source-title hiding, privacy-safe sharing, account data export, metadata-only help note, synced learning-data deletion, local data clearing, and Delete account. The reviewer should not delete the shared test account unless instructed in the private console notes.

Known limitation: mobile capture is intentionally out of scope for this build. Capture happens on Astra desktop/web; the mobile app is focused on review.
