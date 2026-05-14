# Work item 4 — Reading and learning deferred capabilities

Implemented in this pass: visual/semantic parity for existing Deep Read, review, vocabulary, reading queue, and backed search/history data.

Deferred because backing product/data support is not currently implemented or was out of scope:

- True per-paragraph machine translation rail for every Deep Read sentence. The rail now truthfully shows explanations/translations only after existing explain actions generate them.
- Persistent Astra-authored sticky-note library/actions. Digest-backed sticky notes can be pinned/dismissed locally in-session only; no storage migration was added.
- Four distinct SRS outcomes. Review now exposes Again/Hard/Good/Easy UI and 1–4 keyboard grading, but maps them onto the existing binary SRS semantics: Again/Hard = current incorrect/demote path, Good/Easy = current correct/promote path.
- Retire/undo/review-history timeline for individual words. Existing SRS fields are shown/styled, but no new review-event history schema was introduced.
- Search groups beyond backed data. Saved-word, saved-sentence, and article-title groups render only when current vocabulary/owned-reading data can support them; unavailable groups are hidden.
- Web workspace/document-media reader redesign. Explicitly reserved for Work item 5.
- Localization pass for newly added parity copy. Work item 4 introduced some truthful visual-shell labels in English; a follow-up should add locale keys for those strings across Deep Read, Review, and Vocabulary.
