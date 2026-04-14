# Translation routing observability contract

_Task `NW-G-03`_

**Status:** narrow closure for the next window. This is **not** a broad telemetry project and does **not** redesign routing policy.

## Canonical answer path

The canonical support/operator path for answering **"direct, relay, or fallback?"** is:

- **Popup → `Usage & routing` card → `Last` row**
- backed by local `translation-usage` storage on the current device

This is the one supported non-log path for the most recent uncached translation dispatch on that device.

## Authority and ownership

- **Router authority for raw facts:** `attemptedTransports`, `finalTransport`, `fallbackUsed`
- **Canonical disclosure classifier:** `summarizeProviderRoute(...)`
- **Background ownership of recording:** `src/entrypoints/background/index.ts` records the canonical route into local translation-usage events
- **Support/operator presentation path:** popup usage summary reads the recorded route and renders `direct`, `relay`, or `direct → relay`

There is no separate fallback policy in the popup or docs. The support signal is derived from the router metadata already emitted by runtime code.

## Canonical route meanings

| Route | Meaning |
|---|---|
| `direct` | The request stayed on the direct provider path. No relay fallback was attempted. |
| `relay` | The request used relay without first attempting direct transport. |
| `fallback` | Direct transport was attempted first, then relay was attempted as fallback. This includes terminal relay failure after the fallback attempt starts. |
| `no route` | No transport was attempted, so there is no direct / relay / fallback answer for that event. |

## Support/operator usage

When support needs the answer for a current issue:

1. Ask the user to reproduce the uncached translation request on the affected device.
2. Ask them to open the popup.
3. Read the **`Usage & routing` → `Last`** line.
4. Capture:
   - provider / model
   - route (`direct`, `relay`, or `direct → relay`)
   - error code if present

## Limits

Be explicit about these limits:

- **Local device only.** This is not an account-wide or server-side routing ledger.
- **Uncached dispatch only.** Cache-only hits do not create a new route event.
- **Most recent event only in the popup.** The popup is the canonical supported answer path today; deeper local history exists in storage but is not the primary support surface.
- **Not a universal end-user disclosure promise.** This work closes one canonical support/operator path only.
- **Not a broader telemetry program.** No new cross-device dashboard, server observability feed, or policy redesign lands here.

## Code anchors

- `src/utils/providers/routing-metadata.ts`
- `src/utils/providers/router.ts`
- `src/entrypoints/background/index.ts`
- `src/utils/storage/translation-usage.ts`
- `src/entrypoints/popup/components/UsageInsightsCard.tsx`

## Validation anchors

- `src/utils/providers/routing-metadata.test.ts`
- `src/utils/storage/translation-usage.test.ts`
- `src/entrypoints/background/index.test.ts`
- `src/entrypoints/popup/App.test.tsx`
