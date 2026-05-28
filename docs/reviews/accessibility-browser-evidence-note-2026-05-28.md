# Accessibility Browser Evidence Note — 2026-05-28

Purpose: attach the browser-backed evidence that exists after the local `pnpm bench:live:lane:release-proof` run to the Section 32 accessibility record.

This note is **not** a broad accessibility compliance signoff and is **not** a substitute for a human no-mouse walkthrough with screen reader / contrast / scaled-text checks. It records what the built extension/web surfaces proved in a real browser during the local release-proof lane.

## Source run

| Command | Result | Artifact root |
|---|---:|---|
| `pnpm bench:live:lane:release-proof` | Pass, exit 0 | `data/bench-live-results/` |

The run covered source-core, extension-core, learning-loop, document-proof, youtube-proof, and youtube-holdout lanes. Every listed scenario below produced `result.json` and `result.md` under its run directory.

## Accessibility-relevant browser evidence

| Section 32 flow | Browser-backed evidence | What it proves | Remaining manual gap |
|---|---|---|---|
| Popup first action / learning loop | `live-20260528T034300-t1bknt` — `bench-live/popup-deep-read-proof` | Popup renders, article excerpt/deck is visible, explain/save/review/deep-read return actions work, and console errors are 0. | Keyboard-only focus order, visible focus ring, and screen-reader labels still need human walkthrough. |
| Onboarding | `live-20260528T034254-v7p2ij` — `bench-live/onboarding-smoke` | Built onboarding page renders without crash, heading/step indicator/language choices are present, and console errors are 0. | Full Tab/Enter completion and validation/status text still need human walkthrough. |
| Library / Review | `live-20260528T034257-ppbt4l`, `live-20260528T034307-utmspm` — `bench-live/vocabulary-srs-smoke`; `live-20260528T034309-cqwblh` — `bench-live/selection-save-review-loop`; `live-20260528T034313-je0yb5` — `bench-live/learning-loop-revisit-smoke` | Vocabulary/Library surface renders, list/table and review button are present, selection save-to-review works, focused Review opens, reading queue resume/deep-read next-step controls work. | `/` search shortcut, no-mouse row/detail traversal, visible focus, and screen-reader review-card semantics still need human walkthrough. |
| Selection toolbar / content controls | `live-20260528T034309-cqwblh` — `bench-live/selection-save-review-loop`; `live-20260528T034216-7pow8p` — `bench-live/frame-coordination-basic`; `live-20260528T034218-thpyt9` — `bench-live/frame-coordination-cross-origin-fallback` | Content message/save path works, source context is retained, top-frame controls mount without child-frame chrome duplication, cross-origin boundary copy is visible, console errors are 0. | Keyboard opening/closing of every toolbar control and focus restoration still need human walkthrough. |
| Document intake / reader surfaces | `live-20260528T034330-o7rvnz`, `live-20260528T034333-8365f4`, `live-20260528T034335-vqummc`, `live-20260528T034339-r3uiaz`, `live-20260528T034341-n1g1b4` | Document Intake accepts supported file types, unsupported boundary works, local file handoff works, PDF/EPUB/subtitle-file reader snapshots render. | File-picker keyboard behavior, scaled-text, contrast, and reader focus traversal still need human walkthrough. |
| YouTube subtitle/transcript surfaces | `live-20260528T034343-290q9q` through `live-20260528T034408-l87620` | Player button, in-player settings, bilingual subtitle, seek/track recovery, transcript panel/search, save-to-review, video note, no-captions, ASR-only, long-video, fullscreen, and SPA navigation proof scenarios pass. | Keyboard-only player-button/settings/transcript traversal and screen-reader status copy still need human walkthrough. |
| Error / boundary copy | `live-20260528T034218-thpyt9`, `live-20260528T034401-ubq2k1`, `live-20260528T034403-uutfso`, `live-20260528T034405-d4hedp`, `live-20260528T034406-8bdy2x`, `live-20260528T034408-l87620` | Cross-origin iframe, no-captions, ASR-only, long-video, fullscreen, and SPA boundary messages render with text states. | Representative retry/settings/dismiss/contact-support error cards still need no-mouse/manual inspection. |

## Release interpretation

- Acceptable claim: local browser release-proof evidence exists for critical built surfaces and boundary states.
- Not acceptable claim: full accessibility compliance, screen-reader readiness, or manual no-mouse signoff.
- Required next evidence: fill `docs/accessibility/keyboard-test.md` manual rows with owner/date after a human keyboard, contrast, reduced-motion, scaled-text, and assistive-technology pass.
