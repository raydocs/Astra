# ADR 0001: Frame-aware page translation orchestration

## Status

Accepted

## Context

Astra currently behaves like a single-document translator. That model breaks on pages that render meaningful content inside same-origin or cross-origin child frames. The product requirement for phase 4 is to support frame-aware translation without duplicating UI chrome, without leaking provider secrets into frame-local state, and without making popup status ambiguous.

This ADR defines the runtime contract before implementation. The goal is to make frame support decision-complete so the implementation work only needs to follow the contract.

## Decision

### Topology

- Every frame gets the content script entrypoint through `all_frames`.
- Each frame creates a local translation controller responsible for discovery, extraction planning, block registry, translation progress, and DOM injection inside that frame only.
- The top frame is the only frame allowed to mount shared page-level UI:
  - float ball
  - translation status surface that is visible to the user
  - future page-global overlays
- Child frames never mount the float ball and never expose duplicate page-global controls.

### Identity and session model

- The background worker owns a monotonically increasing `sessionId` for each tab-level translation session.
- A tab-level translation session fans out to all registered frames in the tab.
- Each frame tracks:
  - `tabId`
  - `frameId`
  - `parentFrameId`
  - `sessionId`
  - `phase`
  - `targetLang`
  - `presentation`
  - `contentScope`
  - local progress snapshot
  - last error
- The top frame keeps an in-memory aggregate view for its tab, keyed by `sessionId`.

### Message flow

#### Start translation

1. Popup sends `content/start-translation` to the active tab as it does today.
2. The top frame acts as coordinator for the tab session.
3. The top frame asks background for the frame inventory of the active tab.
4. The top frame broadcasts a `frame/start-translation` command to each reachable frame with:
   - `sessionId`
   - resolved translation settings
   - coordinator metadata indicating whether the target is top or child
5. Each frame begins local extraction and translation work independently.

#### Progress reporting

- Each frame publishes `frame/translation-progress` updates to the top frame.
- Progress updates are delta-friendly snapshots, not DOM events.
- Updates are emitted when:
  - session starts
  - extraction plan changes block counts
  - queue/in-flight/translated/failed counts change
  - session stops
  - frame hits an error

#### Stop translation

1. Popup sends `content/stop-translation` to the active tab.
2. The top frame broadcasts `frame/stop-translation` to all active frames for the current `sessionId`.
3. Each frame removes only its own injected translations and returns a terminal progress snapshot.
4. The top frame clears aggregate state after all reachable frames acknowledge or timeout.

### Aggregate popup state contract

The popup continues reading one tab-level snapshot, but that snapshot becomes aggregate rather than single-frame.

#### Aggregate snapshot additions

- `framesTotal: number`
- `framesReporting: number`
- `framesRunning: number`
- `framesErrored: number`
- `frames: Array<{ frameId: number; parentFrameId: number; phase: TranslationPhase; progress: TranslationProgressSnapshot; lastError: TranslationError | null; isTopFrame: boolean }>`

#### Aggregate progress rules

- `totalBlocks` is the sum of all frame `totalBlocks`.
- `queuedBlocks` is the sum of all frame `queuedBlocks`.
- `inFlightBlocks` is the sum of all frame `inFlightBlocks`.
- `translatedBlocks` is the sum of all frame `translatedBlocks`.
- `failedBlocks` is the sum of all frame `failedBlocks`.
- Aggregate `phase` is:
  - `idle` when no frame is active for the tab session
  - `starting` when at least one frame is starting and no frame is running yet
  - `running` when any frame is running
  - `stopping` when a stop command is in progress for any frame
- Aggregate `lastError` is the first top-level error to surface in priority order:
  - top frame fatal error
  - first child frame fatal error
  - `null` when no frame has a fatal error

### Frame registration and lifecycle

- On content script boot, every frame sends `frame/register` to background with `tabId`, `frameId`, `parentFrameId`, and URL metadata.
- Background stores a live frame registry per tab.
- On frame unload or navigation, the frame sends `frame/unregister`.
- If a frame disappears without unregistering, background removes it when message delivery fails.
- The top frame requests the current registry before starting a session so newly loaded frames are included.

### Late frames

- If a new frame registers while a tab session is already running, background notifies the top frame.
- The top frame immediately sends `frame/start-translation` to the new frame using the current session settings.
- New frames join the active session with the existing `sessionId`.

### Error handling

- A child-frame failure does not stop the whole tab session.
- Each frame reports typed errors with its own `frameId`.
- Aggregate status remains `running` as long as any frame still has active work.
- Popup should surface that some frames failed, not that the whole session failed, unless the top frame itself cannot coordinate.

### Same-origin and cross-origin assumptions

- The design must not require direct DOM access from top frame to child frame.
- All cross-frame coordination happens through extension messaging, not DOM traversal.
- Each frame translates only its own DOM subtree.

### UI rules

- Top frame only:
  - float ball mount
  - page-global keyboard toggle affordances
  - aggregate status source for popup
- Any frame may still mount frame-local interaction tools if they are inherently local:
  - selection toolbar
  - hover translate
- Child-frame interaction tools must stay frame-bounded and must not try to coordinate page-global layout.

## Implementation notes

### New message families

- `frame/register`
- `frame/unregister`
- `frame/start-translation`
- `frame/stop-translation`
- `frame/translation-progress`
- `frame/session-sync`

### Files expected to change during implementation

- `wxt.config.ts`
- `src/entrypoints/background/index.ts`
- `src/entrypoints/content/index.tsx`
- `src/types/messages.ts`
- `src/types/translation.ts`
- a new frame dispatcher module under `src/entrypoints/background/` or `src/utils/extension/`

### Non-goals for the first frame-aware release

- PDF frame handling
- visual merging of hover overlays across frames
- cross-frame text selection
- per-frame settings overrides

## Consequences

### Positive

- Pages with embedded app shells, docs, editors, and media players can participate in translation.
- Popup progress becomes truthful for multi-frame pages.
- UI duplication is avoided because only the top frame owns page-global controls.

### Tradeoffs

- Message volume increases with frame count.
- Aggregate state shape becomes more complex.
- Tests need frame inventory and multi-frame coordination fixtures in background and content layers.

## Test plan for the implementation phase

- Background tests for frame registry lifecycle, start fan-out, late frame join, and timeout cleanup.
- Content tests for top-frame-only float ball mounting.
- Aggregate snapshot tests covering sums, phase resolution, and child-frame failures.
- Integration tests with at least one same-origin multi-frame fixture and one simulated cross-origin child frame.
