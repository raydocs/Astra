# Mobile Store Privacy and Data-Use Draft

This document is the shared source for App Store privacy nutrition and Google Play Data safety answers for Astra Review.

## Product boundary

Astra Review is a companion app for reviewing learning cards saved through Astra desktop/web. It does not perform mobile page capture in this build.

Astra Review is a study aid. Card meanings and notes may be imperfect, and users should use source context when a meaning matters. The mobile app does not provide medical, legal, financial, or other professional advice.

## Data stored on device

- Device identifier generated for this mobile install.
- Signed-in session secret stored through Expo SecureStore.
- Non-secret session/account summary fields stored in app state.
- Saved cards, review schedule snapshots, source visibility preferences, local removal choices, reminder preferences, and offline review queue.
- Local retention analytics events with bounded count/action metadata only; signed-in non-sample sessions may upload sanitized mobile retention events for product-health review.

## Data sent to Astra services

Only when the user signs in, links the phone, syncs review progress, refreshes saved cards, changes Weekly Digest preferences, requests a Weekly Digest email, registers or clears reminders, sends a support help note, requests account data export, revokes a session, requests deletion of synced learning data, or requests account deletion:

- Account sign-in fields submitted by the user, including email/password, email sign-in code requests, email-code redemption, and Apple/Google sign-in identity payloads when used.
- Mobile device metadata such as generated device ID, platform, app kind, label, and app version.
- Review schedule mutations for saved card progress.
- Sync cursors and mutation IDs needed for account continuity.
- Weekly Digest fetch, email-delivery request, and preference values.
- Current-device push token registration or clearing for optional reminders and weekly notes.
- Sanitized mobile retention events for signed-in non-sample sessions, using bounded count/action metadata only.
- Metadata-only support help note payloads; card text, saved sentences, screenshots, full URLs, and free-form message text are excluded.
- Account data export request metadata; the export response is shown through the app after an explicit user action.
- Deletion request scope and job ID for synced learning-data deletion.
- Account deletion request sent from the signed-in account; the relay clears the account, devices, sessions, and synced learning records after accepting the request.

## Data intentionally excluded from mobile analytics

Mobile-local retention analytics must not store:

- Card text.
- Saved snippets or sentence bodies.
- Full source URLs.
- Email addresses.
- Account secrets, session secrets, passwords, or authorization strings.
- Free-form user input.

The implementation uses event-specific metadata allowlists in `apps/mobile/src/domain/retentionAnalytics.ts`.

## Permissions

### Camera

Purpose: user-initiated desktop QR code linking. The camera is requested only when the user taps the QR scan action on the sign-in screen.

### Notifications

Purpose: optional review reminders and a weekly learning note. Notification permission is requested only after a user-initiated reminder or weekly learning-note action in Me.

### Not requested in this build

No microphone permission is used. No external storage permission is used. Android build configuration blocks microphone, external storage, and overlay permissions that are not part of the review companion scope.

## App Store privacy nutrition draft

The bundled iOS `PrivacyInfo.xcprivacy` declares the same signed-in collection categories at a conservative level: email address, user ID, device ID, product interaction, user content, customer support, and other usage data; tracking remains disabled.

Current implementation answers for this companion build:

- Data linked to the user: account identifiers and user content already stored in Astra account when signed in.
- Data not used for tracking: yes.
- Third-party advertising: none.
- Diagnostics/analytics: bounded, sanitized mobile retention events may be uploaded for signed-in non-sample sessions; not used for tracking or advertising.
- Contact info: email is used for sign-in/account display, not local analytics.
- User content: saved words/sentences are synced only for account continuity and review.

## Google Play Data safety draft

Current implementation answers for this companion build:

- Data collected: account info, app activity for sync/review progress, app info and performance metadata needed for device continuity, optional push token for reminders/weekly notes, support help note metadata, and account data export request metadata.
- Data shared: no third-party sale or advertising sharing in this build.
- Data encrypted in transit: required for production HTTPS endpoint.
- Users can request data deletion: yes, from Me for synced learning data and account deletion.

## Production submission blockers

- Confirm public Privacy Policy URL.
- Confirm production HTTPS endpoint and data processor list.
- Confirm final legal wording for learning-data deletion, account deletion, and any external retention side effects.
- Verify final App Store / Play Console form answers against the exact production backend configuration.
- Confirm final learning-guidance / study-aid disclaimer wording with legal review.
