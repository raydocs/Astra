# Mobile Signed-Build QA Evidence Template

Use this template after a TestFlight, closed-testing, EAS, or local signed build is available. Do not mark rows passed until the owner, environment, evidence link/path, date, and verdict are filled from the actual signed build.

## Build evidence header

| Field | Value |
|---|---|
| Build channel |  |
| Platform |  |
| Build number / version |  |
| Commit or artifact ID |  |
| Public API origin |  |
| Tester / owner |  |
| Device and OS |  |
| Date |  |
| Evidence folder or console link |  |

## Functional smoke rows

| Area | Required check | Owner | Environment | Evidence | Verdict |
|---|---|---|---|---|---|
| Sign-in | Sign in with the reviewer account and confirm Today, Library, and Me load without exposing email-code secrets. |  |  |  |  |
| Today review | Review a card with Again, Good, Easy, and Skip paths where available. |  |  |  |  |
| Not useful | Mark a reviewed card Not useful and confirm it leaves Today on this phone without exposing card text in diagnostics. |  |  |  |  |
| Privacy-safe sharing | Verify privacy-safe sharing from a Today card and confirm the share text excludes raw source URLs, screenshots, and page content. |  |  |  |  |
| Front-only Play/Speak | Verify front-only Play/Speak and confirm only the card front/expression is spoken. |  |  |  |  |
| Library saved-item Speak | Verify Library saved-item Speak from a saved word or sentence and confirm only the saved expression is spoken, not translation, context, source title, or URL. |  |  |  |  |
| Library source detail | Open a source detail, start source-focused review, and verify source-title hiding / Private source masking. |  |  |  |  |
| Weekly learning note | Trigger the weekly note email action or unavailable state from Me without exposing service/provider configuration. |  |  |  |  |
| Reminders | Enable or change reminder settings and confirm notification permission is requested only after user action. |  |  |  |  |
| Account export | Request account data export and confirm the user action path works without showing secrets. |  |  |  |  |
| Metadata-only help note | Send a metadata-only help note and confirm copy states no card text, saved sentences, or page content is included. |  |  |  |  |
| Synced learning-data deletion | Request synced learning-data deletion only with explicit confirmation and record the job/status evidence. |  |  |  |  |
| Delete account | Confirm Delete account affordance and warning copy; do not delete a shared reviewer account unless the release owner authorizes it. |  |  |  |  |

## Accessibility smoke rows

| Area | Required check | Owner | Environment | Evidence | Verdict |
|---|---|---|---|---|---|
| VoiceOver Today | VoiceOver reads review card, progress, Again/Good/Easy/Skip, Not useful, share, Play/Speak, and View source labels/hints. |  |  |  |  |
| VoiceOver Library | VoiceOver reads Library search, Library saved-item Speak labels/hints, source cards, source detail, source-title hiding, and source-focused review controls. |  |  |  |  |
| VoiceOver Me | VoiceOver reads sign-in/account state, learning guidance, reminders, privacy/export/help-note/delete controls, and local activity summary. |  |  |  |  |
| TalkBack Today | TalkBack covers review card, progress, Again/Good/Easy/Skip, Not useful, share, Play/Speak, and View source labels/hints. |  |  |  |  |
| TalkBack Library | TalkBack covers Library search, Library saved-item Speak labels/hints, source cards, source detail, source-title hiding, and source-focused review controls. |  |  |  |  |
| TalkBack Me | TalkBack covers sign-in/account state, learning guidance, reminders, privacy/export/help-note/delete controls, and local activity summary. |  |  |  |  |
| Large text | Large accessibility text keeps Today, Library, Me, and Sign In usable without clipping critical actions. |  |  |  |  |
| Non-color-only labels | Review rating controls remain understandable without relying on color alone. |  |  |  |  |

## Store evidence rows

| Area | Required check | Owner | Environment | Evidence | Verdict |
|---|---|---|---|---|---|
| Screenshots | Final screenshots are captured from a signed build with test content only and no private email, secret, debug menu, or local endpoint visible. |  |  |  |  |
| Reviewer notes | Reviewer notes are copied from `store/reviewer-notes.md` and private credentials/API origin are entered only in the store console or release evidence packet. |  |  |  |  |
| Privacy forms | App Store privacy nutrition and Play Data safety answers match `store/privacy.md` and the production backend configuration. |  |  |  |  |
| URLs | Support, marketing, and privacy URLs are owner-confirmed and reachable. |  |  |  |  |
| Production endpoint | `EXPO_PUBLIC_ASTRA_API_BASE_URL` is a deployed HTTPS endpoint and no provider/API secrets are committed in public Expo config. |  |  |  |  |
