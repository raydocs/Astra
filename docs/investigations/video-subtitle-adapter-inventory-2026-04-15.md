# Video / subtitle adapter inventory (Month 4)

_Last updated: 2026-04-14 (`M4-D-02` YouTube + Bilibili hardening sync)_

_Source of truth:_ `src/entrypoints/content/video-platforms/`

This inventory is the authoritative Month 4 answer to three questions:

1. which in-page video/subtitle adapters exist in repo,
2. what we can safely claim for each one, and
3. how much proof depth each adapter actually has today.

## Legend

### Support label

| Label | Meaning |
|-------|---------|
| **supported** | Safe to mention externally as the primary in-page video path, with explicit best-effort caveats tied to caption availability and site churn. |
| **best-effort** | Real adapter path exists and has some proof, but production-site drift or proof depth is too uneven for broad support claims. |
| **code-only** | Adapter config exists in repo, but proof depth is too shallow for product claims beyond “there is code here.” |

### Proof level

| Level | Meaning |
|-------|---------|
| **L3** | Browser-backed live scenario or deterministic harness directly exercises the adapter path. |
| **L2** | Unit tests exercise the adapter path or shared runtime path, but there is no adapter-specific live proof. |
| **L1** | Config/selector code exists with no meaningful adapter-specific proof beyond presence in repo. |

## Adapter table

| Adapter | Hostnames | Runtime basis | Support label | Proof level | Current proof refs | Major failure modes |
|---|---|---|---|---|---|---|
| `youtube.ts` | `www.youtube.com`, `m.youtube.com` | Dedicated hybrid pipeline: timedtext fetch + DOM fallback + navigation reset | **supported** (primary video path) | **L3** | Unit tests in `video-platforms.test.ts`; live fixture smoke `bench-live/youtube-subtitle-basic`; replay doc `month-4-video-smoke-replay-2026-04-16.md` | `YT_CAPTION_TRACK_MISSING`, `YT_CAPTION_DOM_DELAY`, `YT_LANGUAGE_MISMATCH`, `YT_PLAYER_CHURN`, duplicated cue replay, stale fallback race / stale overlay after track loss |
| `bilibili.ts` | `www.bilibili.com` | Shared structured text-track pipeline with Bilibili selectors | **best-effort** (secondary Month 4 target) | **L3** for fixture-backed fallback / upgrade / drift proof; **best-effort** on production | Unit tests in `video-platforms.test.ts`; live fixture smoke `bench-live/bilibili-subtitle-basic`; replay doc `month-4-video-smoke-replay-2026-04-16.md` | `BILI_CAPTION_DOM_MISSING`, `BILI_CAPTION_TEXT_EMPTY`, `BILI_REGION_OR_LOGIN`, `BILI_LANGUAGE_MISMATCH`, player skin / fullscreen DOM drift, alternate subtitle-text nesting |
| `netflix.ts` | `www.netflix.com` | Shared structured text-track pipeline with Netflix selectors | **code-only** | **L2** | Unit tests in `video-platforms.test.ts` cover Netflix detect + structured-track behavior; no adapter-specific live smoke | DRM / protected player behavior, timedtext container drift, nested span churn, caption track access mismatch, policy / ToS sensitivity |
| `primevideo.ts` | `www.primevideo.com`, `www.amazon.com` video routes | Shared structured text-track pipeline with broad caption selectors | **code-only** | **L1** | No adapter-specific tests or live smoke | DRM / SDK overlays, broad selector collisions, Amazon route variance, login / entitlement walls |
| `disneyplus.ts` | `www.disneyplus.com` | Shared structured text-track pipeline with broad subtitle selectors | **code-only** | **L1** | No adapter-specific tests or live smoke | DRM / player internals, subtitle/timedtext selector drift, shadowed overlays, entitlement gating |
| `udemy.ts` | `www.udemy.com` | Shared structured text-track pipeline with course-player selectors | **code-only** | **L1** | No adapter-specific tests or live smoke | Course-player churn, lecture route variance, caption container renames, embedded player differences |
| `coursera.ts` | `www.coursera.org` | Shared structured text-track pipeline with transcript/subtitle selectors | **code-only** | **L1** | No adapter-specific tests or live smoke | Transcript-vs-overlay mismatch, embed differences, route variance, selector drift |

## Shared proof that is not adapter-specific

These proofs matter, but they do **not** upgrade unsupported adapters into supported ones by themselves:

- `bench-live/subtitle-basic` proves the generic HTML5 text-track translation contract on a controlled inline video element.
- `src/entrypoints/content/video-platforms/video-platforms.test.ts` proves shared runtime behaviors such as detection, cue batching, fallback handling, and cleanup.

Inference from code: adapters with `preferTextTracks: true` benefit from the shared structured-track pipeline, but without adapter-specific live proof we should still classify them conservatively.

## Failure-mode matrix (adapter by adapter)

### YouTube (`youtube.ts`)

Bench-live `bench-live/youtube-subtitle-basic` uses `inline:youtube-subtitle` in a real browser, not navigation to production YouTube watch pages.

| Class | Symptom | Likely cause |
|-------|---------|--------------|
| `YT_CAPTION_TRACK_MISSING` | No active timedtext track found | Video has no captions; auto-captions disabled; restricted player mode |
| `YT_CAPTION_DOM_DELAY` | Timedtext track exists but cues lag behind playback | Slow network, delayed metadata, live DVR lag |
| `YT_LANGUAGE_MISMATCH` | Captions render in an unexpected source language | Wrong track picked, multi-track ambiguity, auto-translate confusion |
| `YT_PLAYER_CHURN` | Caption selectors or player subtree stop matching | YouTube experiments, shorts/embed/kids layout changes |
| `YT_DUPLICATED_CUE` | Same cue repeats rapidly | Replayed cue window, duplicate segment DOM churn |
| `YT_STALE_FALLBACK_RACE` | Late DOM fallback overwrites newer cue state | Async fallback translate resolves after timedtext catches up |

### Bilibili (`bilibili.ts`)

Fixture smoke `bench-live/bilibili-subtitle-basic` proves DOM fallback, structured upgrade, alternate selector drift handling, and empty subtitle-state cleanup against a Bilibili-shaped fixture, not production `www.bilibili.com` behavior.

| Class | Symptom | Likely cause |
|-------|---------|--------------|
| `BILI_CAPTION_DOM_MISSING` | Subtitle panel selector never appears | Player skin update, fullscreen/theater DOM changes, non-video route |
| `BILI_CAPTION_TEXT_EMPTY` | Panel exists but extracted text is empty | Nested text node changes, panel structure drift |
| `BILI_REGION_OR_LOGIN` | Video plays but captions never surface | Geo restriction, login wall, caption availability differences |
| `BILI_LANGUAGE_MISMATCH` | Wrong text track is translated | Multiple tracks, target/source mismatch, text-track scoring drift |
| `BILI_PLAYER_CHURN` | Behavior differs between fixture and live site | Bilibili player updates, class-name churn |

### Netflix (`netflix.ts`)

Classification here is an inference from code + unit tests, not live-site proof.

| Class | Symptom | Likely cause |
|-------|---------|--------------|
| `NETFLIX_TIMEDTEXT_SELECTOR_DRIFT` | Timedtext container never matches | Player DOM churn across app versions |
| `NETFLIX_SPAN_STRUCTURE_DRIFT` | Extracted caption text is partial/empty | Nested span/div structure changed |
| `NETFLIX_TRACK_ACCESS_GAP` | Text tracks exist but cues are inaccessible or late | Protected player behavior, browser/media pipeline differences |
| `NETFLIX_POLICY_RISK` | Adapter exists but cannot be claimed safely | DRM / ToS-sensitive runtime conditions |

### Prime Video (`primevideo.ts`)

Inference from code only.

| Class | Symptom | Likely cause |
|-------|---------|--------------|
| `PRIME_CAPTION_SELECTOR_DRIFT` | Caption container not found | SDK/player overlay churn |
| `PRIME_ROUTE_VARIANCE` | Works on one route but not another | `primevideo.com` vs Amazon video path differences |
| `PRIME_OVERMATCH` | Wrong text gets translated | Broad `[class*='caption']` selectors catch unrelated UI |
| `PRIME_ENTITLEMENT_GAP` | No subtitle surface to hook | Login/subscription/title restrictions |

### Disney+ (`disneyplus.ts`)

Inference from code only.

| Class | Symptom | Likely cause |
|-------|---------|--------------|
| `DISNEY_TIMEDTEXT_DRIFT` | Subtitle container mismatch | Player DOM updates |
| `DISNEY_OVERMATCH` | Wrong node is extracted | Broad subtitle/timedtext selectors |
| `DISNEY_TRACK_GAP` | No usable cues despite captions being visible | Player/media pipeline differences |
| `DISNEY_ENTITLEMENT_GAP` | No testable subtitle state | Login/region/content restrictions |

### Udemy (`udemy.ts`)

Inference from code only.

| Class | Symptom | Likely cause |
|-------|---------|--------------|
| `UDEMY_PLAYER_CHURN` | Caption container changes between courses | Course player version churn |
| `UDEMY_ROUTE_VARIANCE` | Works on some lessons only | Lecture/learn route differences |
| `UDEMY_EMBED_GAP` | Embedded player lacks expected subtitle DOM | Alternate course player integrations |
| `UDEMY_OVERMATCH` | Non-caption text gets picked up | Broad class-based selectors |

### Coursera (`coursera.ts`)

Inference from code only.

| Class | Symptom | Likely cause |
|-------|---------|--------------|
| `COURSERA_TRANSCRIPT_MISMATCH` | Transcript selector matches a transcript panel, not active subtitles | Transcript UI differs from playback overlay |
| `COURSERA_ROUTE_VARIANCE` | Subtitle extraction varies by course page | Course/lecture layout differences |
| `COURSERA_EMBED_GAP` | Embedded player differs from expected DOM | Third-party player variation |
| `COURSERA_SELECTOR_DRIFT` | No subtitle text extracted | Class-name churn |

## Month 4 scope lock

- **Harden now:** YouTube + **Bilibili** only.
- **Do not** broaden support claims to Netflix / Prime Video / Disney+ / Udemy / Coursera in Month 4.
- **Secondary adapter choice for next task:** **Bilibili** is the correct `M4-D-02` target because it already has a fixture smoke, explicit failure classes, and narrower drift than the code-only adapters.

## Subtitle-file path (not an in-page adapter)

`subtitle-file` remains a separate controlled surface, not part of this in-page adapter inventory:

- file reader proof: `bench-live/subtitle-file-basic`
- continuity / revisit docs: `subtitle-reader-learning-chain-2026-04-14.md`
- Month 3 owned-reading evidence: `month-3-evidence-registry-2026-04-14.md`
