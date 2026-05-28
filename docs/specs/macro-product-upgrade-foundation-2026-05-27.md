# Macro Product Upgrade Foundation — 2026-05-27

Source plan: [`docs/plans/astra-macro-product-upgrade-plan-2026-05-27.md`](../plans/astra-macro-product-upgrade-plan-2026-05-27.md).

This implementation slice turns the macro plan into several low-coupling foundations that can be adopted incrementally without rewriting current extension flows:

0. **Core product model contract** — `src/utils/product-model.ts` and `docs/specs/core-product-model.md`
   - Converts sections 0–3 into an executable macro boundary and product-model helper.
   - Keeps Astra positioned as a managed AI language-learning assistant rather than a generic translation plugin or provider/API/model console.
   - Defines the learning-asset moat, English/Chinese slogan directions, the seven macro product questions, and the Capture Layer → Understanding Layer → Learning Memory model.
   - Blocks readiness when the macro boundary is violated, default copy reverts to translation-plugin positioning, setup is required in the default path, any product layer is missing, or payment value is framed as paying per translation.

0.1. **Error experience and recovery contract** — `src/utils/error-recovery.ts` and `docs/specs/error-recovery.md`
   - Converts section 10 into an executable error-recovery helper covering the required three user answers: what happened, what can I do now, and whether progress was saved/kept.
   - Encodes short actionable copy examples, the situation-to-action matrix for slow content, slow AI, protected pages, no captions, sign-in, membership limits, partial failures, large content, and offline states.
   - Adds `buildErrorRecoveryCardViewModel()` and migrates the Hover Translate error card to show what happened, next step, support fallback, and kept-progress copy without exposing relay/provider technical blame.
   - Blocks readiness when visible errors lack explanation, next action, progress-state copy, required recovery mapping, support fallbacks, or completed-progress preservation.

0.2. **First Success path contract** — `src/utils/first-success.ts` and `docs/specs/first-success.md`
   - Converts section 4 into an executable first-success helper covering the install → language → optional account → first understanding → save word/sentence → first Review path.
   - Keeps onboarding limited to target language, approximate level, and primary goal while forbidding model/provider/prompt/technical setup/advanced site rule/sync-detail questions before first success.
   - Blocks readiness when the sample-page entry, sample understanding, recommended sentence save, one-card Review, activation events, or content-free activation telemetry evidence is missing.

0.3. **Learning loop experience contract** — `src/utils/learning-loop-experience.ts` and `docs/specs/learning-loop-experience.md`
   - Converts section 5 into an executable learning-loop helper covering productized save feedback, lightweight daily/weekly goals, Review source context, source return, and visible progress.
   - Defines and now shares the anti-black-hole save-feedback copy set (`Saved for review tonight`, `Added to your learning queue`, source-linkage copy, queue progress, and one-minute review prompt) across save-success surfaces through the locale keys used by hover/toolbar/deep-read save callouts.
   - Blocks readiness when saving does not explain destination/next review/source linkage, daily Review is not lightweight, Review cards lack source context, source return is missing, or Review feels like isolated flashcards rather than real content.

0.4. **Learning Library experience contract** — `src/utils/learning-library-experience.ts` and `docs/specs/learning-library-experience.md`
   - Converts section 6 into an executable Library helper covering the macro asset set, automatic organization dimensions, the three-question Library home, return-to-source, privacy-safe summaries, and the “learning trail, not database” boundary.
   - Defines the first-version Library asset types: Saved Pages, Saved Videos, Saved Files, Saved Sentences, Saved Words, Video Notes, Reading Queue, Review Queue, Personal Glossary, and Learning Digest.
   - Blocks readiness when the Library misses asset coverage, relies on manual folder management, does not answer recently learned / review today / continue learning, loses source return paths, or includes full third-party content in summaries by default.

0.5. **Personalization experience contract** — `src/utils/personalization-experience.ts` and `docs/specs/personalization-experience.md`
   - Converts section 7 into an executable personalization helper covering lightweight profile fields, learning purposes, behavior influence, Personal Glossary signals, reversible controls, and memory-write boundaries.
   - Keeps personalization positioned as automatic adaptation that reduces setup, not a visible rules engine or manually maintained glossary database.
   - Adds a profile-shaped Review plan: the learner's primary goal orders the due-card queue, daily learning time sizes the session, level/explanation preference are surfaced in ordinary copy, and Options remains the reversible control path.
   - Attaches `docs/reviews/personalization-qa-evidence-note-2026-05-28.md` for current repo-side QA on visible Review adaptation, disabled fallback, Options reversibility, remembered-term controls, excluded sites, and memory-write boundaries.
   - Blocks readiness when default profile collection is not lightweight, preferences do not affect required behaviors, glossary signals are unbounded, users cannot view/delete/disable/exclude personalization, or writes ignore Privacy Mode / personalization-off / excluded-site policy.

0.6. **Membership value expression contract** — `src/utils/membership-value.ts` and `docs/specs/membership-value.md`
   - Converts section 8 into an executable membership-value helper covering why users pay, feature-proximate value moments, preferred/forbidden copy, Free/Pro/later tier boundaries, and cancellation asset-access protection.
   - Keeps paid value framed as a managed learning system — zero setup, capability choice, stability, quality, unified surfaces, saving, Review, continuity, support, and maintenance — not just more usage.
   - Blocks readiness when membership is hard-sold before value, prompts are detached from value moments, technical provider/model/token/relay copy leaks, tier boundaries are unclear, or existing saved learning assets are not protected after cancellation.

0.7. **Trust and privacy experience contract** — `src/utils/trust/privacy-experience.ts` and `docs/specs/trust-privacy-experience.md`
   - Converts section 9 into an executable user-facing trust helper covering ordinary learner concerns, onboarding/settings/Library trust-card copy, required privacy controls, overclaim detection, accurate Privacy Mode copy, and cancellation data boundaries.
   - Keeps trust copy accurate and ordinary-language: Astra only sends needed text, users choose what gets saved, Privacy Mode reduces page context, and saved learning data can be deleted.
   - Options General now exposes a visible Privacy & data controls card linking to learning-data export, saved-learning-data management, and the metadata-only account-deletion help path while explicitly avoiding a local-only Privacy Mode claim.
   - Blocks readiness when user concerns are unanswered, required controls are not visible, copy overclaims local-only/no-upload/encryption/no-log/all-pages-safe promises, Privacy Mode copy is inaccurate, or cancellation data handling is unclear.

0.8. **Macro alignment and final conclusion contract** — `src/utils/macro-alignment.ts` and `docs/specs/macro-alignment.md`
   - Converts sections 17–18 into an executable alignment helper covering competitive-remediation responsibilities, macro-upgrade responsibilities, and final conclusion pillars.
   - Keeps competitor parity work connected to the product upgrade while preventing default positioning from collapsing back into “more translation buttons.”
   - Blocks readiness when competitive remediation and macro responsibilities are unclear, final pillars are incomplete, default positioning misses the learning-memory/asset-accumulation promise, or Astra does not turn current content into long-term language ability.

1. **Learning Asset Object Model adapter** — `src/utils/storage/learning-assets.ts` and `docs/specs/learning-asset-object-model.md`
   - Projects current `VocabularyEntry` and `OwnedReadingItem` records into the section-23 first-version shapes: `SourceContent`, `SavedSnippet`, `VocabularyItem`, `ReviewCard`, and `ReviewSession`.
   - Adds the dedicated object-model spec requested by section 23, covering field contracts, current-schema mapping, delete/orphan behavior, export policy, acceptance evidence, and release boundaries.
   - Adds `vocabularyItemFromVocabularyEntry()` so legacy saved vocabulary has explicit surface text, normalized text, target language, source snippet linkage, example sentence, mastery state, and created/updated timestamps in the learning-asset projection.
   - Adds `deriveWeeklyReviewableLearningMoments()` as the first North Star proxy.
   - Keeps source text out of the metric summary.

2. **Web AI Safety baseline** — provider, reading-assist, relay server, and relay-lite prompts now explicitly label page/selection/context data as untrusted content.
   - Fixture set: `test/fixtures/quality/prompt-injection.json`.
   - OpenAI and Gemini direct-provider system prompts include the shared untrusted-content rule, while custom reading-assist schemas stay in trusted `customSystemPrompt` instructions.
   - `src/platform/relay-lite/src/index.test.ts` verifies relay-lite sends context/text as `untrusted_content` before OpenRouter.
   - `src/utils/ai-safety.ts` now defines the Section 25 first-implementation controls, suspicious-content detector, fixed-fixture safety-run summary, and `evaluateWebAiSafetyReleaseReadiness()` release blocker helper.
   - `src/utils/storage/learning-memory.ts` suppresses automatic remembered-term/glossary writes unless the user explicitly initiated the write.
   - `docs/specs/web-ai-safety-threat-model.md` records the current prompt/source audit checklist, release-blocker fixture criteria, suspicious-content behavior, and decision rules.
   - The fixture set and readiness helper are release-blocker foundations, not a claim that every future AI surface can skip safety review.

3. **Library home summary and source organization entrypoint** — `src/entrypoints/vocabulary/VocabularyApp.tsx`
   - Adds a top-of-library panel that answers: recently learned, review today, continue learning.
   - Adds a source map with source-type filters (articles, videos, PDFs, EPUBs, subtitle files, sample lessons, selections) so saved items can be browsed by origin.
   - Adds a Learning asset coverage card that renders all macro asset types as ready, not-yet-added, or planned rows, including Saved Pages, Saved Videos, Saved Files, Saved Sentences, Saved Words, Video Notes, Reading Queue, Review Queue, Personal Glossary, and Learning Digest.
   - Attaches `docs/reviews/library-qa-evidence-note-2026-05-28.md` for current repo-side QA on source return, explicit delete choices, export controls, source filtering, and the remaining manual/browser QA boundary.
   - Adds per-source Reading queue controls for sync inclusion, weekly-digest exclusion, and delete-source metadata removal while preserving saved cards by default.
   - Adds per-source detail panels showing source type and linked saved cards, plus explicit delete choices: source-only or source + linked saved cards.
   - Saved-item search now has a keyboard `/` shortcut, polite result-status announcements, source/tag filter state labels, and list/listitem semantics for keyboard and screen-reader walkthroughs.
   - Reuses current vocabulary/review/owned-reading data rather than introducing a new database migration.

4. **Metadata-only support/report flow baseline** — `src/utils/support-bundle.ts`, Options Diagnostics, and relay inbox
   - Defines the privacy-safe support metadata shape from the macro plan.
   - Defaults to no page text, saved content, transcripts, screenshots, or user input.
   - Adds issue category, feature surface, runtime surface, and explicit user-message/contact inclusion flags.
   - Options now exposes a `Report a problem` card with bundle preview, authenticated metadata-only submission, and local JSON download fallback.
   - Popup now exposes `Report this page` for day-to-day page/video troubleshooting, exporting the same metadata-only bundle with hostname-only context and current error code when available.
   - Content scripts expose failure-card reporting from the FloatBall page/video quick action and HoverTranslate error card; both submit authenticated metadata-only bundles when possible and otherwise download local JSON without selected text, page text, transcript, or URL path.
   - Relay adds `POST /v1/support/reports`, backed by `src/server/support-report-store.ts` and `ASTRA_SUPPORT_REPORT_INBOX_PATH`, requiring an authenticated device session and rejecting content-included bundles.
   - Adds operator-only support report aggregation at `GET /v1/ops/support/reports/summary` so support can spot repeated metadata-only failures without reading page content.
   - Adds operator-only metadata report listing at `GET /v1/ops/support/reports` and triage updates at `PATCH /v1/ops/support/reports/:reportId/triage`, covering status, priority, assignee, resolution, and updater metadata without adding content payloads.
   - Astra Web Account now includes a compact operator-token support report triage foundation that shows summary buckets and recent metadata-only reports, then patches status, priority, assignee, resolution, and updater metadata without exposing page text, saved content, transcripts, screenshots, or message bodies.
   - Adds a privacy-safe known-issue catalog at `GET /v1/support/known-issues` / operator `PUT /v1/ops/support/known-issues`, backed by `ASTRA_SUPPORT_KNOWN_ISSUE_STORE_PATH`, and links matching reports by feature surface, issue category, hostname, and version.

5. **Learning data export baseline** — `src/utils/storage/learning-data-export.ts`
   - Gives users a JSON export path for current learning data and projected learning assets.
   - Documents export content policy and avoids full page/transcript capture.

6. **Remote-capable feature flag / kill-switch foundation** — `src/utils/feature-flags.ts`, `src/server/feature-flag-runtime-store.ts`, and relay ops endpoints
   - Registers macro-plan feature gates and emergency switches with local overrides and audit events.
   - Adds a relay-backed remote runtime manifest at `GET /v1/ops/feature-flags`, with operator-protected `PUT /v1/ops/feature-flags` for incident updates.
   - Appends a remote runtime `changeLog` on every operator update so feature-flag/kill-switch incidents carry changed-by, reason, counts, timestamp, and previous revision metadata for later ops-console review.
   - Astra Web Account now includes a compact operator ops panel that fetches the public runtime/changeLog and submits operator-token kill-switch fallback-copy updates as a full runtime draft while preserving existing overrides.
   - Stores the remote runtime at `ASTRA_FEATURE_FLAG_RUNTIME_PATH`, caches it in extension local storage, and makes `decideFeatureFlag()` / `decideKillSwitch()` prefer remote ops overrides before local defaults.
   - Options account-continuity refresh pulls the remote runtime opportunistically after an authenticated session refresh.

7. **Sample Lesson / first-success loop** — `src/entrypoints/sample-lesson/SampleLessonApp.tsx`
   - Onboarding now links to `sample-lesson.html` with `Try Astra on a sample page`.
   - The sample page demonstrates: understood content → save recommended sentence → 1-card review → first review complete.
   - Saves a real `VocabularyEntry` with `sample_lesson` source context and records activation/review telemetry events without raw content.
   - Upserts the sample article into the owned-reading/source Library, links the saved card to that source ID, triggers learning-continuity sync, and shows Library handoff copy after save/complete.

8. **Free beta billing boundary** — onboarding, Options managed-AI copy, popup account labels, account-surface helpers, and relay quota config
   - Replaces premature `membership` / `Buy Astra` copy with free-public-beta and optional sign-in continuity language.
   - Keeps Pro/trial labels explicitly marked `not launched` and removes popup checkout/portal/plan-switch controls from the public account panel.
   - Keeps relay `trial` quota fields typed and defaulted for future billing readiness without exposing trial/pro checkout publicly.
   - Aligns public surfaces with `docs/runbooks/billing-free-policy.md`: no paid upgrade, checkout, billing portal, or pricing claim is active during beta.

9. **Lightweight learning profile / reversible personalization foundation** — `src/utils/storage/learning-profile.ts`, onboarding, and Options General
   - Stores target language, language level, explanation mode, primary learning goal, daily goal minutes, personalization enabled/disabled, excluded hostnames, and remembered terms locally.
   - Onboarding now writes the learning profile from the first-run language/level/goal choices while preserving the legacy goal key for compatibility.
   - Options General exposes a `Personalization memory` card so users can review the lightweight profile, change goal/daily target, disable personalization, see excluded sites, and forget remembered terms.
   - Patch updates use an explicit no-default schema so changing one personalization field does not reset the rest of the profile.

10. **Learning UI accessibility critical-path baseline** — `src/entrypoints/vocabulary/ReviewMode.tsx` and `src/entrypoints/onboarding/OnboardingApp.tsx`
   - Review progress is now announced as a polite status region.
   - Review cards reference the visible keyboard hint through `aria-describedby` in both front and revealed states.
   - Four-grade answer controls are exposed as an ARIA group with schedule disclosure context and per-button labels including feedback meaning plus shortcut number.
   - Onboarding now exposes the active step as a polite, focusable region, marks the current step with `aria-current="step"`, and moves focus after step changes so keyboard/screen-reader users keep their place.
   - Onboarding keeps the first-run setup to the three macro activation questions (target language, level, primary goal); those radio groups use Arrow/Home/End keyboard selection, and display/style controls stay deferred to Settings so the no-mouse first-success path remains short.
   - Library saved-item search supports `/` focus, announces filtered result counts through a polite status node, and exposes saved cards as a list with source/tag filter state.
   - The shared Toast primitive now defaults to live/atomic announcements, exposes labeled action/dismiss controls, and includes a bounded non-blocking `ToastViewport` for stacked notifications; Options save/error feedback adopts it with `Saved`/`Done` success copy and actionable error next steps.
   - The YouTube transcript panel now exposes itself as a labeled complementary region, gives transcript search an explicit label, announces transcript/search/status changes through live/atomic status regions, and normalizes video-panel loading/success/warning/error copy toward the macro status rules.

11. **Local Weekly Digest retention surface** — `src/utils/storage/learning-assets.ts` and `src/entrypoints/vocabulary/VocabularyApp.tsx`
   - Adds `buildLocalWeeklyDigestViewModel()` on top of the learning-asset projection and WRLM summary.
   - Library home now renders a local weekly digest card with saved/reviewed/source counts and top source titles.
   - The digest remains privacy-safe by excluding page text, transcripts, and saved snippet content; it uses counts, source titles, and source types only.
   - Existing per-source digest exclusion controls are respected through `OwnedReading.userControl.excludedFromDigest`.

11.1. **Learning Digest experience contract** — `src/utils/learning-digest-experience.ts` and `docs/specs/learning-digest-experience.md`
   - Converts section 12 into an executable digest helper covering weekly content coverage, low-interruption surfaces, optional email/notification controls, macro copy examples, privacy-safe summaries, and Privacy Mode channel boundaries.
   - Defines digest content items for pages read, videos watched, new saved words/sentences, reviewed cards, common topics, repeated vocabulary, recommended review, and recommended continue targets.
   - Blocks readiness when the digest does not show long-term learning value, lacks Review/continue actions, defaults to interruptive delivery, lacks outbound delivery controls, includes raw content by default, or ignores Privacy Mode external-delivery constraints.

12. **Strategic Non-Goals decision boundary** — `docs/specs/strategic-non-goals.md`, product roadmap, release checklist, and AI planning context
   - Captures the macro-plan non-goals table, issue triage decision tree, release-planning checks, agent planning checklist, public FAQ boundary, and support response macros.
   - Links the boundary from `docs/product-roadmap.md`, `docs/release-readiness-checklist.md`, `docs/ai-context/planning-index.md`, and `docs/README.md` so product expansion, public claims, support promises, and agent plans route through the same core-loop filter.

13. **First 90 growth sharing/referral MVP** — `src/utils/share/sentence-card.ts`, sample lesson, and Astra Web landing
   - Adds canonical growth events for share-card creation, referral sent/converted, landing visited, and landing install click.
   - Sample lesson now offers a post-first-review sentence-card share CTA using authored sample content only.
   - Sample lesson also offers a non-rewarding invite CTA; rewards remain deferred until abuse-safe backend controls exist.
   - Astra Web landing recognizes sentence-card/referral UTM or hash params, renders source-specific copy, and stores metadata-only local landing events without hosting shared text.

14. **North Star / Stage OKR metric coverage** — `src/utils/learning-loop-events.ts` and `docs/specs/metrics-dictionary.md`
   - Adds `LEARNING_LOOP_STAGE_OKR_METRICS` so each section-34 M1–M5 OKR has at least one canonical event, runtime query, or manual-review signal.
   - Keeps the existing WRLM runtime helper as the North Star query and documents the stage dashboard support matrix without requiring page text, saved snippet text, transcript text, prompt text, model output, or full URL paths.

14.1. **Product metrics contract** — `src/utils/product-metrics.ts` and `docs/specs/product-metrics.md`
   - Converts section 11 into an executable metric-category helper covering the six product decision questions, Activation, Understanding, Learning, Membership metrics, and telemetry ethics.
   - Keeps telemetry metadata-first: no sensitive raw text by default, events/counts/categories over content, Privacy Mode reduces detail, and user data controls remain clear.
   - Blocks readiness when metric categories are incomplete, product questions are not answerable, telemetry records raw content by default, metrics depend on content instead of categories, or Privacy Mode does not reduce telemetry detail.

15. **First 90 experiment cadence and unit-economics contract** — `src/utils/operating-review.ts`
   - Defines daily/weekly/monthly/release/quarterly operating review cadence evidence requirements.
   - Defines no-content experiment guardrails for onboarding, paywall, review, save moment, digest, free limits, share card, and support experiments.
   - Adds generic experiment event names: `variant_assigned`, `conversion_event`, and `guardrail_metric`.
   - Adds an aggregate monthly unit-economics review helper that computes gross-margin, heavy-user, abuse, and trial-cost risk flags without user/content fields.

16. **Legal, trust, and store-risk contract** — `src/utils/trust/compliance.ts`
   - Defines launch-blocking evidence requirements for privacy policy, terms/refund/AI notice, store permission copy, export boundary, deletion visibility, support consent, and legal review.
   - Provides ordinary-language store permission copy and export/copyright boundary rules for saved snippets, source context, full page bodies, transcripts, share cards, exports, and public sharing.
   - Adds tone-of-voice rules that keep trust copy quiet, non-technical, learning-first, and respectful.
   - Adds `evaluateAstraComplianceReadiness()` so paid-launch readiness cannot be true while legal/trust evidence is missing.

17. **Learning Science daily-goal Review sizing** — `src/entrypoints/vocabulary/ReviewMode.tsx`
   - Applies the local `dailyGoalMinutes` learning-profile setting to the default due-card Review queue so the daily session size matches the learner's declared time budget.
   - Keeps explicitly focused single-card reviews and source/page review loops uncapped so deep links and contextual study flows remain deterministic.

17.1. **Learning Science Review contract** — `src/utils/learning-science.ts` and `docs/specs/learning-science-review.md`
   - Converts section 22 into an executable Review learning-science helper covering simple card types, macro feedback, mastery states, scheduling defaults, prioritization, context-first/reversible principles, quality fallbacks, and no-pseudoscience copy boundaries.
   - Keeps Review lightweight for ordinary learners while preserving credible internal scheduling: default 5-card daily limit, 3 new cards/day, 3-minute goal copy, and source-backed card explanations.
   - Blocks readiness when Review becomes course/deck-like, daily Review is not light, saves do not create reviewable cards or fallbacks, P0 cards lack source context, users cannot delete/pause/mark mastered, low-quality cards lack fallback, or copy guarantees mastery/outcomes.

18. **Strategic Non-Goals proposal gate** — `src/utils/strategic-non-goals.ts`
   - Converts the section-19 six-question gate into `ASTRA_PROPOSAL_GATE_QUESTIONS` and `evaluateAstraProposalGate()`.
   - Blocks default-surface proposals that violate hard non-goals such as unlimited high-cost use, default content upload, default provider console, default social community, or universal support claims.
   - Allows risky areas only as advanced/beta/experimental candidates when explicit boundary, proof, support copy, and rollback next steps exist.
   - Adds minimal deterministic repo-side enforcement through `docs/analysis/strategic-non-goals-proposals.json`, `pnpm check:strategic-non-goals`, and CI quality-job coverage for represented fixtures.

19. **V2 retention habit policy contract** — `src/utils/retention-habits.ts`
   - Converts the operating-model retention loops into `ASTRA_RETENTION_LOOP_POLICIES` and `evaluateAstraRetentionTouchpoint()`.
   - Requires review/digest/continue/win-back prompts to have real learning value before display, with opt-out, unsubscribe, and Privacy Mode channel boundaries.
   - Adds canonical retention events for review open, continue click, digest open, reminder dismiss/disable, and win-back delivery while keeping telemetry content-free.

20. **Personal Learning Graph memory inventory** — `src/utils/storage/learning-memory.ts` and Options General
   - Adds `buildLearningMemoryInventoryFromState()` / `buildLearningMemoryInventory()` so Astra can explain profile preferences, remembered terms, saved snippets, source history, review state, and privacy controls as visible memory categories.
   - Adds `evaluateLearningMemoryWritePolicy()` to make Privacy Mode, personalization-off, and excluded-host behavior explicit for graph-writing surfaces.
   - Adds an Options `What Astra remembers` summary with counts/categories and no page text, transcript, prompt, model-output, or full-URL-path inventory.

21. **Minimal ops cost-risk snapshot** — `src/web/src/app.tsx` and `src/web/src/lib/astra-web.ts`
   - Adds `fetchWebCostUsageSummary()` for the operator-only `GET /v1/ops/cost/usage-summary` endpoint.
   - Adds a token-gated Astra Web account `Cost risk snapshot` card showing retained aggregate event/request/character totals and tier/task/cost buckets.
   - Labels the card as directional recent retained usage, not exact spend, and omits users, emails, providers, models, hostnames, prompts, text, and per-user rows.

22. **Minimal provider/model health snapshot** — `src/server/user-store.ts`, `src/web/src/lib/astra-web.ts`, and Astra Web Account
   - Adds an operator-only `GET /v1/ops/provider-health/summary` endpoint that groups retained recent usage events by provider, model, service mode, and task class.
   - Computes event/request/character counts, success/failure/fallback counts, success/fallback rates, latency P50/P95, and incident/watch/healthy status for outage mitigation.
   - Adds a token-gated Astra Web account `Provider health snapshot` card that keeps this provider/model visibility staff-only and explicitly omits users, emails, hostnames, prompts, text, and per-user rows.

23. **Store permission trust public surface** — `src/utils/trust/compliance.ts`, Astra Web landing, and `store/listing-copy.md`
   - Extends store permission/capability copy to cover page access, storage, current-tab context, optional reminders, account continuity, copy actions, and user-initiated downloads/exports.
   - Adds `buildAstraStorePermissionTrustViewModel()` so public surfaces render the same ordinary-language permission labels, benefits, and boundaries as the store listing packet.
   - Astra Web landing now includes a public Permission Trust section with privacy/support links and no technical provider/model/API-key framing.

24. **Release stage gate contract** — `src/utils/release-stage-gate.ts`, release checklist, and billing-free runbook
   - Encodes Internal Alpha, Private Beta, Public Beta, and Paid Launch gate requirements from section 29 as `evaluateAstraReleaseStageGate()`.
   - Composes legal/trust compliance, feature-flag/kill-switch rollback inventory, paid-launch billing blockers, known-limitations/public-copy checks, beta feedback readiness, and Strategic Non-Goals claim boundaries.
   - `src/utils/release-stage-gate.test.ts` also guards the six required release-proof lanes across `package.json`, CI, lane conventions, live coverage matrix, release checklist, and Gate 4 public-beta claim wording so release scripts and docs cannot silently drift apart.
   - Links the helper from `docs/release-readiness-checklist.md` and `docs/runbooks/billing-free-policy.md` so stage decisions are inspectable instead of plan-only prose.

25. **AI Quality System release contract** — `src/utils/ai-quality-system.ts`, `test/fixtures/quality/ai-quality-samples.json`, and `docs/quality/rubrics.md`
   - Converts section 24 into a deterministic quality-readiness helper that evaluates learning usefulness, not provider success alone.
   - Defines ability categories, the 1–5 technical/content/learning rubric layers, error taxonomy, P0 coverage threshold, translation/explanation score thresholds, review-card reusable threshold, safety pass threshold, blocker taxonomy, and weekly trend summary.
   - Adds a fixed P0 eval-sample manifest with more than 100 rows across translation, explanation, summary, review cards, personalized terms, and writing correction.
   - Documents the release checklist, low-score backlog labeling, weekly quality report/trend format, and safety fixture relationship.

27. **Minimal ops user lookup snapshot** — `src/server/user-store.ts`, `src/web/src/lib/astra-web.ts`, and Astra Web Account
   - Adds an operator-only `GET /v1/ops/users/lookup?query=...` endpoint for email, email hash, or user id lookup.
   - Returns membership status, usage category, limits, active device/session counts, and recent task-class health buckets without raw email, billing email, device ids, session ids, hostnames, prompts, text, provider names, or model names.
   - Adds a token-gated Astra Web account `Staff account lookup` card for support triage and heavy-user routing.

28. **Data retention, copyright, and user-control contract** — `src/utils/data-retention-control.ts` and `docs/specs/data-retention-user-control.md`
   - Converts section 26's data categories, retention defaults, copyright boundaries, and user-control checklist into an executable readiness helper.
   - Defines conservative policies for account data, settings, source metadata, saved snippets, review cards, vocabulary, full page text, full transcripts, telemetry, and support bundles.
   - Encodes P0/P1 user controls for Privacy Mode, saved-item deletion, related-card cascade handling, learning-data export, per-source sync/digest controls, delete-account-data help, and support bundle preview.
   - Blocks readiness when metadata-only support, export copyright boundary, cancellation asset access, explicit source-delete cascade choice, or accurate Privacy Mode copy evidence is missing.

27. **GTM growth/distribution contract** — `src/utils/gtm-campaign.ts` and `docs/gtm/demos.md`
   - Converts section 27 into first-version channel definitions, campaign definitions, five sub-60-second demo scripts, landing/store/social/share-card copy, technical-term detection, and `evaluateAstraGtmReadiness()`.
   - Keeps the first-version channel set focused on Chrome Web Store, Landing Page, YouTube/Bilibili short demo, and branded Share Card.
   - Blocks readiness when GTM copy uses provider/model/API/relay/token language, promoted capabilities are not release-gated, demos do not show the real-content learning loop, share cards lack Astra watermarking, or referral rewards are promised before abuse controls exist.
   - Stores the human demo/copy artifact under `docs/gtm/demos.md` instead of the plan's legacy `scripts/` path to respect the repo-knowledge guardrail.

28. **Operations Console contract** — `src/utils/ops-console.ts` and `docs/specs/operations-console.md`
   - Converts section 30 into an executable first-version ops information architecture, least-privilege role matrix, prohibited-content defaults, audit taxonomy, and `evaluateAstraOpsConsoleReadiness()`.
   - Keeps ops modules metadata-first across user overview, membership, device/version, recent errors, usage summary, feature flags, support tickets, service health, and audit log.
   - Defines Support Agent, Support Lead, Ops Engineer, Admin, and Privacy Reviewer roles with scoped actions and consented-content boundaries.
   - Blocks readiness when metadata-only defaults, actionable support fields, flag rollback, sensitive-action audit, role matrix, consented-content markers, data-request handling, service health, or support ticket triage evidence is missing.

29. **Accessibility and inclusive design contract** — `src/utils/accessibility-readiness.ts` and `docs/accessibility/`
   - Converts section 32 into an executable accessibility-readiness helper, component-label inventory, state-copy rule, shortcut inventory, and manual QA packet.
   - Covers the first implementation surfaces: popup, onboarding, settings, selection toolbar/content overlays, Review, Library, paywall, support/report, Toast/status, and error-card patterns.
   - Blocks readiness when P0 main-flow keyboard evidence, understandable button labels, non-color state copy, actionable error cards, Toast live-region/non-blocking behavior, settings labels, support/report accessibility, paywall readability, or Library keyboard evidence is missing.
   - Tracks P1 warnings for Review shortcuts, reduced-motion coverage, and scaled-text walkthrough evidence.

30. **Beachhead persona, JTBD, and paywall strategy contract** — `src/utils/product-strategy.ts` and `docs/specs/product-strategy-persona-jtbd-paywall.md`
   - Converts sections 19–21 into an executable product-strategy helper covering the first-stage beachhead persona, persona priority tiers, default-entry-to-JTBD mapping, Free/Trial/Pro paywall boundaries, trial aha moments, and non-technical paywall copy screening.
   - Keeps the default product centered on Chinese-native real-content learners who want understanding, saved learning assets, and review without provider/API/model setup.
   - Blocks readiness when persona copy is not unified across onboarding/landing/store/paywall, onboarding asks too many pre-success questions, sample content misses article/doc/video coverage, default entries lack JTBD mapping, P0 assets cannot return to source, failures lack fallback, hard paywalls appear before first value, technical terms appear in paywall copy, trial aha moments are not instrumented, cancellation asset access is not promised, or beta billing boundaries are violated.

31. **Brand and aesthetic experience contract** — `src/utils/brand-experience.ts` and `docs/specs/brand-experience.md`
   - Converts section 13 into an executable brand-experience helper covering Astra's intended quiet/automatic/reliable/refined/lightweight/clear/next-step/not-back-office feel.
   - Encodes discouraged infrastructure copy (`Configure`, `Provider`, `Route`, `Relay`, `Token`, `Debug`, `Advanced`, `Error code`), preferred learning copy, emotional-value examples, and default UI principles.
   - Blocks readiness when default surfaces use back-office terms, lack quiet learning tone, show competing primary actions, expose low-frequency or diagnostics controls by default, group by technical modules, surface advanced settings as default UX, or show error cards without action.

32. **Minimal operator/privacy audit snapshot** — `src/server/ops-audit-log-store.ts`, relay ops routes, and Astra Web Account
   - Adds a file-backed retained audit log at `ASTRA_OPS_AUDIT_LOG_PATH` for support submissions and operator ops reads/updates, with invalid-log preservation, atomic writes, and serialized record writes.
   - Adds operator-only `GET /v1/ops/audit/summary` returning counts by action/actor, privacy counters, and recent audit rows with hashed operator tokens and subject ids only.
   - Records metadata-only audit-summary views, support submission, support triage, user lookup, cost, provider-health, known-issue, and feature-flag actions without raw emails, operator tokens, device ids, session ids, hostnames, prompts, or text.
   - Adds a token-gated Astra Web account `Privacy / operator audit` card for retained audit metadata.

33. **Platform and macro roadmap contract** — `src/utils/platform-roadmap.ts` and `docs/specs/platform-roadmap.md`
   - Converts sections 15–16 into an executable platform/roadmap helper covering short-term Chrome/Chromium extension and Web companion focus, Safari/iOS experimental boundary, future mobile/email/API roles, multi-device learning-continuity value, and M1–M5 roadmap phases.
   - Keeps multi-device sync framed as learning continuity (desktop save → mobile review, web organize → browser continue, weekly summary → return path), not just settings/config sync.
   - Blocks readiness when extension/web core focus is not proven, Safari/iOS claims exceed experimental evidence, full multi-platform marketing appears before core proof, sync value is reduced to config sync, roadmap phase order is not preserved, or M1 First Success + Trust evidence is missing.

34. **Support and after-sales experience contract** — `src/utils/support-experience.ts` and `docs/specs/support-experience.md`
   - Converts section 14 into an executable support-experience helper covering user-facing entries, metadata-only support-bundle fields, required help-center topics, status-page boundaries, and known-limitations expectations.
   - Keeps support flows ordinary-language and no-devtools: Report this page, Send feedback, Contact support, Copy support bundle, Help center, Status page, and Known limitations.
   - Blocks readiness when P0 support entries are missing, bundle metadata fields are incomplete, sensitive content is included by default, users cannot preview bundle metadata, required help topics/known limitations are unpublished, support copy requires technical internals, or reporting lacks authenticated submit/local download fallback.

35. **Minimal cancellation/refund reason ops summary** — `src/server/cancellation-reason-store.ts`, relay ops routes, Options Diagnostics, and Astra Web Account
   - Adds authenticated, device-bound metadata intake for normalized cancellation/refund reasons via `POST /v1/account/cancellation-reasons`.
   - Persists retained reason metadata with invalid-file preservation, atomic writes, and serialized concurrent writes.
   - Adds operator-only `GET /v1/ops/cancellations/reasons/summary` with aggregate reason, plan, source, and coverage counts only; no raw emails, device ids, session ids, tokens, hostnames, free-form notes, prompts, text, or per-user recent rows.
   - Audits user submissions and operator summary views as metadata-only events, and adds a token-gated Astra Web `Cancellation / refund reasons` card.

36. **Minimal cache-status cost visibility** — `src/server/user-store.ts`, `GET /v1/ops/cost/usage-summary`, and Astra Web Account
   - Extends the operator-only cost usage summary with aggregate `cacheHitRate` and `byCacheStatus[]` counts for cache hit, partial, miss, disabled, and unknown states.
   - Keeps cache visibility privacy-safe by aggregating retained server usage events only, with no user ids, emails, device ids, session ids, provider/model names, hostnames, prompts, text, or per-user rows.
   - Updates the Astra Web `Cost risk snapshot` card to show cache hit rate and aggregate cache-state counts alongside tier/task/cost and service-mode latency metadata.

37. **Minimal support first-response macro coverage** — `src/utils/support-response-macros.ts`, support report summary, and Astra Web Account
   - Adds a static first-response macro catalog for every support report issue category with ordinary-language copy, next steps, and metadata-only privacy notes.
   - Extends `GET /v1/ops/support/reports/summary` with aggregate `macroCoverage` so operators can track first-response macro coverage against the 80% target without reading message bodies, page text, transcripts, screenshots, prompts, model output, emails, device ids, or session ids.
   - Updates the Astra Web `Support report triage` card with a compact `Macro coverage` metric and top matching macro label for submitted metadata-only reports.

38. **Minimal known-issue weekly visibility** — `src/server/support-report-store.ts`, support report summary, and Astra Web Account
   - Extends `GET /v1/ops/support/reports/summary` with `weeklyTopIssues[]`, the top aggregate issue per UTC week grouped by hostname, feature surface, issue category, and linked known issue metadata.
   - Keeps weekly support visibility privacy-safe by exposing counts and metadata only, with no message bodies, page text, transcripts, screenshots, prompts, model output, emails, device ids, session ids, or per-user rows.
   - Updates the Astra Web `Support report triage` card with a compact `Weekly top issue` metric so repeated support patterns can enter the backlog without a full support desk.

39. **Macro operational evidence contract** — `src/utils/macro-operational-evidence.ts` and `docs/specs/macro-operational-evidence.md`
   - Adds an executable downgrade/blocker registry for the remaining operational-evidence weak areas across sections 4, 6–8, 11–14, 21–22, 24, 26–28, 30, and 32.
   - Separates public-beta-acceptable boundaries from paid/store/GTM/compliance claims that must stay blocked until external production evidence is attached.
   - Updates release readiness so RC notes must either attach the required evidence or use explicit downgrade copy when `evaluateAstraMacroOperationalEvidence()` reports stronger claims blocked.
   - Records the current section-by-section completion audit in `docs/reviews/macro-plan-completion-audit-2026-05-27.md`, including the explicit non-completion verdict for stronger launch and production-quality claims while external/manual evidence is missing.

40. **Minimal activation dashboard visibility** — `src/utils/learning-loop-events.ts`, Options Diagnostics, and `docs/specs/metrics-dictionary.md`
   - Adds local activation start/value events for extension install, onboarding start, sample start, and first value seen alongside existing first-content/save/review/trial/Pro-value events.
   - Adds `aggregateLearningLoopActivationDashboard()` so onboarding completion, first-value P50 seconds, first-save rate, first-review completion, trial starts, and Pro-value visibility are visible from local metadata-only telemetry.
   - Updates Options Diagnostics with a compact `Activation dashboard` card and documents the privacy boundary in `docs/analysis/minimal-activation-dashboard-checklist-2026-05-27.md`.

41. **Minimal retention dashboard visibility** — `src/utils/learning-loop-events.ts`, Options Diagnostics, and `docs/specs/metrics-dictionary.md`
   - Adds `aggregateLearningLoopRetentionDashboard()` so local active learning days/weeks, review completion, source return, Digest follow-through, reminder controls, Pro repeat-value, and cancellation value-risk signals are visible without content telemetry.
   - Updates Options Diagnostics with a compact `Retention dashboard` card below Activation.
   - Documents the local-only dashboard boundary in `docs/analysis/minimal-retention-dashboard-checklist-2026-05-27.md`; production cohort retention, notification/email delivery, and win-back automation remain deferred.

42. **Minimal learning dashboard visibility** — `src/utils/learning-loop-events.ts`, Options Diagnostics, and `docs/specs/metrics-dictionary.md`
   - Adds `aggregateLearningLoopLearningDashboard()` so saves, explicit review-card proxy rate, review completion, Library opens, source return, continue actions, active learning days, and saved source mix are visible from local metadata-only telemetry.
   - Updates Options Diagnostics with a compact `Learning dashboard` card between Activation and Retention.
   - Documents the local-only dashboard boundary in `docs/analysis/minimal-learning-dashboard-checklist-2026-05-27.md`; production reviewable-card rate, WAU, cohort analysis, and cross-device learning analytics remain deferred.

## Completion boundary

This slice does **not** claim that the full macro roadmap is complete. It establishes shared contracts for later UI wiring:

- production polish for the sample lesson beyond the current minimal first-success loop, Sections 0–4 core product-model/first-success contracts, Section 10 error-recovery contract, and Section 13 brand-experience contract, such as final visual QA, refined motion, screenshot-approved copy, numeric activation target proof, and token-only styling across every public/extension surface;
- deeper Library source-management UX beyond the current Section 6 learning-library experience contract, summary panel, source-type filters, source-level controls, detail panels, and explicit cascade-delete choice, such as full per-source pages, richer source history timelines, and bulk source operations;
- production Free/Trial/Pro paywall surfaces after billing/legal readiness beyond the current Section 8 membership value contract and Section 19–21 persona/JTBD/paywall strategy contract, such as final checkout lifecycle, hosted pricing page, billing-provider integration, and signed legal copy;
- production Learning Digest and platform expansion beyond the current local Library card, Section 12 learning-digest experience contract, retention policy contract, and Section 15–16 platform/roadmap contract, such as email/push delivery, trend comparisons, cross-device digest sync, reminder scheduling, unsubscribe backend wiring, mobile companion runtime proof, API/integration product plans, and win-back automation;
- monitored support inbox operations beyond the current file-backed metadata-only submission, aggregation, known-issue linkage, operator triage metadata foundation, compact Astra Web staff triage UI foundation, and Section 14 support-experience contract, such as customer reply handling, notifications, SLA views, hosted help center/status page, or a full support desk;
- deeper personalization automation beyond the current local, user-reversible learning profile foundation, memory inventory contract, Options memory summary, Section 5 learning-loop experience contract, Section 7 personalization experience contract, Section 22 learning-science Review contract, and default Review queue daily-goal cap, such as AI-suggested term memories, per-site learning behavior, cross-device memory inventory, bulk graph deletion workflows, richer save-feedback UI adoption, and richer daily-goal tuning across non-default review queues/surfaces;
- broader accessibility hardening beyond the current Review, Onboarding, Library search/filter/list, shared Toast, YouTube transcript-panel ARIA/status baselines, and Section 32 readiness contract/docs, especially document readers, subtitle reader, remaining Library details/bulk flows, remaining content-script overlays, final no-mouse/manual QA evidence, and full Toast/status adoption across every surface;
- richer remote ops console UX beyond the current operator-token file-backed feature-flag runtime, append-only change log, and compact Astra Web runtime/changeLog plus kill-switch fallback-copy update panel, such as staged approvals, notifications, release dashboards, bulk editing, and approval workflows;
- production store-listing readiness beyond the current store copy packet, ordinary-language permission trust model, and Astra Web public trust section, such as final hosted privacy/support URLs, approved screenshots, developer-account submission evidence, and store-review approval;
- release operations beyond the current executable stage-gate and product-metrics contracts, such as CI enforcement of `evaluateAstraReleaseStageGate()` / `evaluateAstraProductMetricsReadiness()`, launch-note generation, approval workflows, and externally signed legal/store/billing evidence;
- AI quality operations beyond the current release-readiness contract, fixed P0 manifest, manual rubric, and trend helper, such as live provider grading pipelines, reviewer assignment workflow, automated weekly report publishing, final human-scored sample results, and CI enforcement that blocks a release on `evaluateAiQualityReleaseReadiness()`;
- Web AI safety operations beyond the current threat-model doc, prompt/source audit checklist, fixed-fixture readiness helper, and remembered-term confirmation policy, such as automated prompt-template inventory generation, CI enforcement of `evaluateWebAiSafetyReleaseReadiness()`, and safety review workflow for every newly added AI surface;
- data-retention/user-control operations beyond the current Section 9 trust/privacy experience contract, policy contract, and readiness helper, such as CI enforcement of `evaluateAstraTrustPrivacyReadiness()` / `evaluateAstraDataControlReadiness()`, account-level cloud deletion orchestration, signed legal copy, cancellation asset-access proof, and production retention jobs;
- GTM operations beyond the current channel/copy/demo/readiness contract, such as final screenshots, actual 60-second videos, user comprehension testing, live listing conversion measurement, creator assets, and CI/release enforcement of `evaluateAstraGtmReadiness()`;
- production operations-console work beyond the current schema/role/audit/readiness contract, compact operator cards, and minimal file-backed operator/privacy audit snapshot, such as role-auth enforcement, support reply workflows, data-request orchestration, production refund integration, paging/alerts, and richer dashboards;
- hosted workflow automation for Strategic Non-Goals beyond the current JSON/CI fixture guardrail, such as issue-label bots, PR templates, support-desk macro imports, external integrations, or natural-language inference.
