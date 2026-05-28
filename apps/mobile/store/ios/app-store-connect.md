# App Store Connect Draft — Astra Review

## App identity

- App name: Astra Review
- Subtitle: Review saved words on your phone
- Bundle ID: `so.astra.review`
- SKU: `astra-review-ios-001`
- Primary category: Education
- Secondary category: Productivity
- Age rating target: 4+

## Promotional text

Review the words and sentences you saved while reading or watching on the web. Astra Review keeps the phone experience focused on short, calm study sessions.

## Description

Astra Review is the mobile companion for Astra learners who save useful words and sentences from the web, then review them later on their phone.

Use Astra on desktop or web to collect learning moments. Open Astra Review on iPhone to see Today cards, browse your Library, keep a gentle review habit, and sync progress when connected.

What you can do:

- Review saved words and sentences in short sessions.
- Continue from source-focused Library sections.
- Use privacy-safe sharing, front-only Play/Speak, and Not useful feedback on review cards, plus Library saved-item Speak for saved words and sentences.
- Hide source titles on this phone when a saved source should stay private.
- Use gentle reminders, a weekly learning note, and an email action for the weekly note.
- Keep recent review choices available even when offline.
- Link your phone from a signed-in desktop session by code, link, or QR scan.
- Export account data, send a metadata-only help note, clear local data, request deletion of synced learning data, or use Delete account from the Me screen.

Astra Review is intentionally not a full browser extension on mobile. Capture happens on desktop and web; the phone app stays focused on review.

Learning guidance: Astra is a study aid. Card meanings and notes may not be perfect; users should use the original source context when a meaning matters. Astra Review does not provide medical, legal, financial, or other professional advice.

## Keywords

language learning, vocabulary, flashcards, review, reading, study, spaced repetition, words, sentences, habit

## Support and marketing URLs

- Support URL: `https://astra.so/support`
- Marketing URL: `https://astra.so`
- Privacy Policy URL: `https://astra.so/privacy`

These are candidate public URLs for the release packet; owner confirmation remains required in `store/release-checklist.md` before App Store submission.

## In-app purchases

None in this mobile build. Account plan state is read-only and shown from the Astra account when available; the mobile app does not sell or manage subscriptions.

## Sign-in notes for review

The app supports Astra email/password sign-in and desktop-to-phone linking. For review, provide a test account with preloaded saved cards and a reachable production HTTPS API base URL.

Suggested reviewer note: use `store/reviewer-notes.md` as the canonical reviewer-note template, then add private reviewer credentials and the public production API origin only inside App Store Connect.

## TestFlight beta notes

Astra Review lets existing Astra learners review saved words and sentences on iPhone. Please test:

1. Sign in with the provided Astra account.
2. Review a Today card with Again, Good, Easy, or Skip.
3. Browse Library, use Library saved-item Speak on a saved word or sentence, hide/show a source title, and start a source-focused review.
4. Try privacy-safe sharing, front-only Play/Speak, and Not useful feedback on a review card.
5. Change reminder preferences from Me.
6. Review Me privacy controls, including account data export, metadata-only help note, local data clearing, synced learning-data deletion, and Delete account availability, without deleting the review account unless instructed.

Known limitation: capture still happens on desktop/web. This mobile build is focused on review.

## App Review checklist

- Production `EXPO_PUBLIC_ASTRA_API_BASE_URL` points to an HTTPS endpoint.
- Test account credentials are active and included only in App Review notes.
- Camera usage is explained for user-initiated QR linking.
- Notification prompt appears only after a user chooses reminder settings.
- iOS Privacy Nutrition answers match `store/privacy.md`.
- Screenshots use real app surfaces without private user content.
- Learning guidance / study-aid disclaimer remains visible in Me and consistent with listing copy.
- Privacy controls in listing copy match the current app: source-title hiding, privacy-safe sharing, account data export, metadata-only help note, synced learning-data deletion, and Delete account.
