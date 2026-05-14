# Astra UI redesign parity matrix — Work Item 1 foundation

Source of truth: the loaded design reference root `astra (1)/Astra UI Redesign.html` as read on 2026-05-12. That design folder is a local reference workspace, not runtime code imported by production surfaces.

Work Item 1 delivers the inventory, production token bridge, shared typed primitives, icon/mark primitives, and global accessibility/focus foundation only. It intentionally avoids certifying popup/options/overlay/deep-read/vocabulary/web-workspace redesigns or public web route behavior in this pass.

Screenshot certification status: **pending**. Do not claim full visual identity or “100% identical” parity from this matrix alone. Use `docs/reviews/ui-redesign-parity-screenshot-certification-2026-05-13.md` for the browser-screenshot checklist and evidence paths; rows remain pending until reference and production screenshots exist.

Scope quarantine: unrelated platform/server/deploy/package changes in the working tree are outside this UI parity matrix and must not be certified, staged, or reviewed as part of the UI screenshot pass.

Current must-fix decisions: permission copy must match the shipped extension manifest (`activeTab` plus broad `host_permissions`, no optional host-permission picker); selection Mark/Highlight remains deferred unless real highlight storage/UI ships; review grading must disclose the current binary SRS semantics; PWA manifest start/scope should match the web app deployment base.

## Status legend

- **Implemented — Work Item 1 foundation**: covered by the token bridge, shared primitives, icon primitives, or accessibility foundation added in this pass.
- **Preserved/completed already**: previously completed production behavior that this pass must not regress.
- **Planned — Work Item 2**: extension chrome: popup, options/settings, onboarding, permissions.
- **Planned — Work Item 3**: content-script overlays: selection/hover/in-context/progress/errors/input assist/no persistent ball.
- **Planned — Work Item 4**: reading and learning: Deep Read, vocabulary, review, library/history/search.
- **Planned — Work Item 5**: web workspace plus document/media readers.
- **Deferred — net-new capability**: design requires product/storage/API/background work beyond visual parity.

## Master design section matrix

| Master id | Master section | Current parity status | Production owner / notes |
|---|---|---:|---|
| `intro` | The brief | Implemented — Work Item 1 foundation | Quiet Reader is the production baseline; Twilight/Constellation tokens remain valid via `data-astra-theme="dark"` / `data-astra="twilight"`. |
| `logo` | Extension logo — six candidates, scored at every size | Implemented — Work Item 1 foundation | `src/components/icons/AstraMark` and `AstraWordmark` provide reusable production mark primitives. Actual toolbar/favicon asset replacement is deferred to a later asset pass. |
| `ds` | Design system | Implemented — Work Item 1 foundation | Production tokens bridge type, spacing, radius, focus, status, highlight, sticky-note, and accent aliases. Typed primitives live in `src/components/ui/*`. Screenshot certification remains pending. |
| `popup` | Popup — daily entry point | Planned — Work Item 2 | Map to `src/entrypoints/popup/*`; preserve existing behavior until popup redesign item. |
| `onboarding` | Onboarding — first impression | Planned — Work Item 2 | Map to `src/entrypoints/onboarding/*`; this pass only supplies primitives/focus foundation. |
| `settings` | Settings — the full surface | Planned — Work Item 2 | Map to `src/entrypoints/options/OptionsApp.tsx`; sidebar/row parity later. |
| `floating` | In-page handle — do we even need a floating ball? | Planned — Work Item 3 | Design recommendation is recorded: default should be selection toolbar + quiet status, not a persistent ball. |
| `incontext` | In-context translation — overlay on the host page | Planned — Work Item 3 | Map to content-script paragraph translation and progress/status overlays. |
| `hover` | In-page lookup — the most-used surface | Planned — Work Item 3 | Map to `HoverTranslate.tsx` and `SelectionToolbar.tsx`. |
| `word` | Word detail — the saved-word's home | Planned — Work Item 4 | Requires vocabulary detail/read-history surface work. |
| `review` | Review session — focused, almost empty | Planned — Work Item 4 | Must preserve SRS semantics while improving semantics/keyboard access. |
| `library` | Library — every word you've kept | Planned — Work Item 4 | Map to `src/entrypoints/vocabulary/VocabularyApp.tsx` and reading-history utilities. |
| `empty` | First-run state — empty popup | Planned — Work Item 2 | Empty popup/library state in popup redesign. |
| `cmd` | Command menu — ⌘K | Deferred — net-new capability | Requires command registry, shortcut routing, and global invocation model beyond current visual foundation. |
| `share` | Share a passage — the quiet quote card | Deferred — net-new capability | Requires export/share flows and generated card/link behavior. |
| `errors` | Failure modes — never alarming | Planned — Work Item 3 | Quiet inline/page error copy for overlays; shared status/focus tokens available now. |
| `signin` | Sign in — small, paper-like modal | Preserved outside this pass | Public web sign-in behavior is not certified by this matrix or screenshot plan. Extension auth surfaces may still be refined in Work Item 2 if backed by implementation evidence and screenshots. |
| `account` | Account home — the reader's record | Planned — Work Item 5 | Existing web account/continuity behavior is preserved; visual parity grouped with web workspace/account route work. |
| `plans` | Plans & billing — three tiers | Deferred — net-new capability | Existing billing handoff is preserved. Full pricing/lifecycle parity requires product and billing state decisions. |
| `sitesheet` | Popup · site sheet — the per-site control inside the popup | Planned — Work Item 2 | Popup per-site sheet and advanced settings handoff. |
| `subtitle` | Subtitle reader — bilingual captions for video | Planned — Work Item 5 | Map to `src/entrypoints/subtitle-reader/*` plus media/document reader parity. |
| `siterules` | Site rules — per-site advanced config | Planned — Work Item 2 | Map to options/settings site-rule controls where existing capability exists. |
| `inline` | Inline composer assist — Grammarly, but quieter | Planned — Work Item 3 | Existing input translation shell can be styled; grammar/tone suggestions are deferred unless backed by capability. |
| `progress` | 1 · Translation in flight | Planned — Work Item 3 | Shared `AstraProgress` and status-pill foundation added; overlay implementation later. |
| `onboarding-multi` | 2 · Onboarding — a slower first hour | Planned — Work Item 2 | Implement only if current onboarding state supports it; otherwise document remaining multi-step gap. |
| `permission` | 3 · Site access — the permission dialog | Planned — Work Item 2 | Must align with browser permission model and avoid silent broad permission requests. Current build uses broad host permissions plus `activeTab`; optional page-only/per-site picker remains deferred until runtime request/revoke UI exists. |
| `deepread-entry` | 4 · Deep Read — entering and leaving | Planned — Work Item 4 | Invitation/finish/return flow grouped with Deep Read parity. |
| `review-summary` | 5 · After the review — quiet summary | Planned — Work Item 4 | Review completion summary after SRS-safe review redesign. |
| `word-edit` | 6 · Word — add, edit, retire | Planned — Work Item 4 | Implement only against existing vocabulary mutation model; undo/retire may require extra product work. |
| `history` | 7 · Reading history — the timeline | Planned — Work Item 4 | Map to reading-history storage and vocabulary/library rails. |
| `search` | 8 · Search the library | Planned — Work Item 4 | Grouped word/sentence/article/tag search; hide unavailable groups until backed. |
| `notifications` | 9 · Daily reminder — three quiet surfaces | Deferred — net-new capability | Requires reminder scheduling, notification permissions, and possibly new-tab surface decisions. |
| `shortcuts-custom` | 10 · Keyboard — your map, not ours | Deferred — net-new capability | Requires command/shortcut persistence, conflict detection, and browser shortcut constraints. |
| `export` | 11 · Export — your library, your file | Deferred — net-new capability | Full Anki/Markdown/CSV/JSON export requires storage export pipeline and file-format decisions. |
| `sync` | 12 · Sync — devices, conflicts, lineage | Deferred — net-new capability | Existing account/sync health is preserved; conflict resolver/lineage needs sync product work. |
| `theme` | 13 · Direction switcher — Quiet ↔ Constellation | Planned — Work Item 2 | Tokens support both directions now; full preference UI belongs in settings/options. |
| `focus` | 14 · Reading focus — host-page dimming | Deferred — net-new capability | Requires robust page-structure detection and host-page dimming controls; not part of this visual foundation. |
| `audio` | 15 · Pronunciation — UK, US, and your own voice | Deferred — net-new capability | Reference audio/recording/comparison requires media capture and storage decisions. |
| `tags` | 16 · Tags & collections — the user's own shelves | Deferred — net-new capability | Requires vocabulary schema/storage and review filtering work beyond current visual pass. |
| `import` | 17 · Imported share — words from a friend | Deferred — net-new capability | Requires inbound link/import queue, duplicate handling, and scheduling. |
| `mobile` | 18 · Mobile companion — review on the train | Deferred — net-new capability | Separate PWA/mobile product surface, not extension foundation. |
| `changelog` | 19 · What's new — a letter, not a banner | Deferred — net-new capability | Requires release-note content surface and display rules. |
| `ai-edge` | 20 · AI edge cases — disambiguate, feedback, override | Deferred — net-new capability | Requires feedback/override persistence and provider prompt behavior. |
| `deepread` | Deep Read — the long-form reader | Planned — Work Item 4 | Map to `src/entrypoints/deep-read/*`; no Deep Read redesign in Work Item 1. |

## Adjacent design inventory not in the master HTML sequence

The Oracle plan also identified `web-workspace.jsx` and `web-workspace-surfaces.jsx` as design references for `/text`, `/articles`, `/files/pdf`, `/files/epub`, `/files/subtitles`, `/video-notes`, and `/assets`. These are tracked as **Planned — Work Item 5** even though they are not rendered by the master `DCSection` sequence above.

## Work Item 1 completion notes

- Shared production token aliases are additive; existing `--astra-style-*`, web `--accent-primary`, and extension `--astra-*` aliases remain valid.
- Shared React primitives are intentionally small and typed; they do not import design-folder files or change current surface markup.
- Global focus/hover/disabled/reduced-motion CSS remains additive and should not restyle public landing/sign-in beyond compatible token availability.
