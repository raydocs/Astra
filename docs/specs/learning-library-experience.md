# Learning Library Experience Contract

Source plan: Section 6 from the macro product upgrade plan dated 2026-05-27.

Astra Library is the user's learning-asset space, not a complex database or file manager. It turns real-content understanding into a durable trail: saved moments, source context, review state, and next continuation.

## Executable source

See `src/utils/learning-library-experience.ts`.

## Asset types

The first-version contract recognizes the macro-plan Library set:

- Saved Pages
- Saved Videos
- Saved Files
- Saved Sentences
- Saved Words
- Video Notes
- Reading Queue
- Review Queue
- Personal Glossary
- Learning Digest

Full third-party pages, full video transcripts, and full files are not default Library assets. The default boundary is source metadata, user-saved snippets/cards, queue/review state, and explicit user-created notes.

## Automatic organization

The default Library should organize for the learner automatically by:

- source type;
- website;
- video channel;
- topic;
- difficulty;
- recently learned;
- due for review;
- mastered;
- common terms.

Manual folders, bulk filing, and database-style management are not the default UX. They may exist later as advanced management surfaces, but the first impression should be a learning trail.

## Home IA

Library home must answer only three primary questions:

| User question | Recommended surface | Primary action |
|---|---|---|
| What did I recently learn? | Recent saved words, sentences, sources, and reviewed cards. | Open recent item |
| What should I review today? | Lightweight due-card card with count, time estimate, and source mix. | Start review |
| What can I continue reading or watching? | Reading queue and source cards sorted by last studied position. | Continue source |

Preferred copy:

- `Your learning trail`
- `Recently learned`
- `Review today`
- `Continue learning`
- `Saved from this source`

## Readiness blockers

`evaluateAstraLibraryReadiness()` blocks release readiness when:

- the macro asset set is not represented;
- automatic organization dimensions are incomplete;
- the default UX asks ordinary users to manage folders;
- Library home does not answer recently learned / review today / continue learning;
- saved items cannot return to source context;
- digest or summaries include full third-party content by default.

It warns when the Library technically works but feels like a database instead of a learning trail.

## Local memory surface

The Library includes a focused local-only `memory` / `What Astra remembers` tab for the V2 Personal Learning Graph trust boundary. The surface must remain user-owned and explicit:

- reuse the learning-memory inventory sections for profile, remembered terms, saved snippets, source history, review state, and privacy controls;
- show remembered terms with local forget/clear actions;
- show per-source timelines using only title, source type, hostname, counts, coarse progress/control state, and coarse timeline events;
- provide bulk local actions for excluding selected sources from digest, disabling sync for selected sources, removing source history, and deleting source history plus linked saved cards;
- gate destructive source actions behind confirmation;
- provide explicit local learning-data export;
- never render full page text, transcripts, prompts, model output, URL query strings, URL hashes, or sensitive URL parameters in the memory timeline.

This is not a cross-device/server-side memory inventory and does not provide cloud deletion receipts/proof.

## Current implementation relationship

The existing Library baseline already has a home summary, source-type filters, source controls, source detail panels, explicit delete cascade choices, local weekly digest, source-backed Review/asset projection, and the local-only `What Astra remembers` memory tab. This contract makes Section 6's product rules executable while keeping server/cloud deletion proof, automated suggestions, notifications/email, and full Privacy Mode enforcement audit outside this slice.
