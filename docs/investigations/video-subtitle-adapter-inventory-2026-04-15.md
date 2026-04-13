# Video / subtitle adapter inventory (Month 4)

_Generated: 2026-04-15 · Source: `src/entrypoints/content/video-platforms/`_

## Legend (proof level)

| Level | Meaning |
|-------|---------|
| **L3** | CI / bench-live or deterministic harness touches adapter path |
| **L2** | Unit tests / code structure present, limited runtime proof |
| **L1** | Code-only / best-effort DOM selectors |

## Adapter table

| Adapter file | Primary site | Support tag (Month 4 plan) | Proof level (2026-04-15) | Main failure modes |
|--------------|--------------|----------------------------|--------------------------|---------------------|
| `youtube.ts` | YouTube | **supported** (primary video) | **L3** (bench + live scenarios exist) | No captions; delayed captions; language mismatch |
| `bilibili.ts` | Bilibili | **best-effort** (secondary for Month 4) | **L2** (code + tests if present) | Region/geo; dynamic DOM; caption format drift |
| `netflix.ts` | Netflix | **code-only** | **L1** | DRM; shadow DOM; ToS-sensitive |
| `primevideo.ts` | Prime Video | **code-only** | **L1** | Same class as Netflix |
| `disneyplus.ts` | Disney+ | **code-only** | **L1** | Same |
| `coursera.ts` | Coursera | **code-only** | **L1** | Embedded players vary |
| `udemy.ts` | Udemy | **code-only** | **L1** | Course player churn |

## Month 4 scope lock

- **Harden**: YouTube + **Bilibili** as secondary adapter (smoke + failure notes).
- **Do not** expand new platforms until both pass Month 4 acceptance.

## Subtitle file path

- **Subtitle reader** extension entry + import flow: treat as **separate surface** from in-page video adapters; revisit via `OwnedReadingItem.sourceType === "subtitle-file"` (Month 3 schema).
