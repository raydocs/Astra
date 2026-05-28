# Store Submission Evidence Note — 2026-05-28

## Scope

This note covers repo-side Section 28 store listing, permission trust, and Store/TestFlight/Play submission-packet evidence. It does not claim Chrome Web Store, App Store Connect, TestFlight, or Google Play submission; signed-build approval; final public URL approval; console privacy-form completion; reviewer-note entry in store consoles; or approval/rejection outcome evidence.

## Current repo evidence

| Claim area | Current evidence | Verdict |
|---|---|---|
| Browser store listing copy | `store/listing-copy.md` contains English and zh-CN Chrome Web Store copy, permission explanations, screenshot storyboard, category suggestions, and launch-safe language for the free public beta. | Repo-covered for draft listing copy; not console entry or approval. |
| Browser store submission workflow | `docs/runbooks/browser-store-submission.md` records Chrome-first packaging, screenshot, permission rationale, data-use answers, reviewer-note template, Chrome checklist, and Firefox/Safari beta boundaries. | Repo-covered for runbook/checklist; not upload proof. |
| Permission trust copy | `src/utils/trust/compliance.ts` defines ordinary-language permission trust rows for page access, storage, current tab, optional reminders, account continuity, copy actions, and user-initiated downloads/exports. | Repo-covered for permission-copy source of truth. |
| Mobile release-pack inventory | `apps/mobile/store/README.md` lists the App Store Connect draft, Play listing draft, privacy/data-use draft, screenshot plan, reviewer notes, signed-build QA template, and release checklist, while requiring final upload/signing/URL/signed-build evidence externally. | Repo-covered for release-pack structure. |
| App Store / TestFlight draft | `apps/mobile/store/ios/app-store-connect.md` defines App Store identity, copy, keywords, candidate public URLs, no in-app purchase statement, reviewer sign-in notes, TestFlight beta notes, and App Review checklist. | Repo-covered for draft ASC copy; owner URL confirmation and console entry remain external. |
| Google Play draft | `apps/mobile/store/android/play-listing.md` defines package/category/tags, short/full descriptions, release notes, Data safety source-of-truth pointer, reviewer-note pointer, and Play checklist. | Repo-covered for draft Play copy; Play Console entry remains external. |
| Shared mobile privacy/data-use answers | `apps/mobile/store/privacy.md` documents the review-companion product boundary, device/account data paths, excluded analytics fields, camera/notification permission purpose, privacy nutrition draft, Play Data safety draft, and production-submission blockers. | Repo-covered for privacy/data-use draft; legal/privacy and production backend confirmation remain external. |
| Screenshot and QA packet | `apps/mobile/store/screenshots/README.md` defines required capture sizes, shot list, and content rules; `apps/mobile/store/signed-build-qa.md` defines functional, accessibility, and store evidence rows requiring owner/environment/evidence/verdict from a real signed build. | Repo-covered for capture/QA template; not final screenshots or smoke proof. |
| Reviewer notes | `apps/mobile/store/reviewer-notes.md` gives App Review/TestFlight/Play reviewer-note copy and keeps private credentials/API origin out of git. | Repo-covered for template; actual console notes and credentials remain external. |
| Local release-pack verifier | `apps/mobile/scripts/verify-mobile-scaffold.mjs` requires the mobile store files and guards current-feature, privacy, permission, endpoint-safety, no-secret, no-microphone, reviewer-note, signed-build QA, and checklist terms. | Repo-covered for regression guard. |

## Explicit non-claims

This note does not prove:

- Chrome Web Store, Firefox AMO, App Store Connect, TestFlight, or Google Play upload/submission occurred;
- any store package/build hash, Xcode/EAS artifact ID, or signed-build binary exists for the target release;
- final store screenshots were captured from a signed build;
- final privacy/support/marketing URLs are hosted, owner-approved, reachable, and entered in consoles;
- App Store privacy nutrition, Play Data safety, or Chrome privacy fields were completed in production consoles;
- reviewer notes, private test credentials, or production API origins were entered in any store console;
- Apple/Google/Chrome review processing, approval, rejection, or remediation outcomes;
- legal/privacy approval for production store answers.

## Required before stronger claim

Before claiming store submission complete, attach:

1. final hosted privacy, support, and marketing URLs with owner/legal confirmation;
2. target package/build identifiers, hashes, version/build numbers, and commit SHA;
3. final signed-build screenshots from App Store / Play / Chrome-required sizes using approved test content;
4. signed-build functional and VoiceOver/TalkBack QA rows with owner, environment, evidence link/path, date, and verdict;
5. App Store privacy nutrition, Play Data safety, and Chrome privacy/permission forms as entered in the consoles;
6. reviewer notes entered in App Store Connect, TestFlight, Play Console, and/or Chrome Web Store console, with private credentials kept out of git;
7. TestFlight/App Store/Play/Chrome upload, processing, submission, approval, rejection, or remediation evidence.

## Suggested focused verification

```bash
pnpm --dir apps/mobile verify
pnpm vitest run src/utils/macro-operational-evidence.test.ts -t "external launch artifacts|RC evidence note|repo evidence entry"
```
