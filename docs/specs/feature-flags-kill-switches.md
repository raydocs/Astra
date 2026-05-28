# Feature Flags and Kill Switches

Source plan: [`docs/plans/astra-macro-product-upgrade-plan-2026-05-27.md`](../plans/astra-macro-product-upgrade-plan-2026-05-27.md), section 31.

Runtime foundation:

- Registry: `src/utils/feature-flags.ts`
- Tests: `src/utils/feature-flags.test.ts`

## First registry

| Flag | Owner | Default | Purpose |
|---|---|---:|---|
| `ui.onboarding_goal_question` | product | on | P0 persona/JTBD onboarding question |
| `ui.library_home` | product | gradual | Learning Library dashboard rollout |
| `ai.deep_explanation` | engineering | on | Deeper sentence explanations |
| `ai.card_generation` | engineering | on | Saved snippet → review card generation |
| `source.video_learning` | engineering | gradual | Supported video learning beta |
| `source.file_learning` | engineering | gradual | PDF/EPUB/subtitle-file learning beta |
| `safety.memory_writes` | ops | off | Long-term glossary/preference writes after confirmation |
| `sync.learning_assets` | engineering | gradual | Cloud sync for learning assets |
| `emergency.disable_managed_ai` | ops | off | Emergency managed AI kill switch |
| `emergency.disable_long_content` | ops | off | Emergency long-content cost/risk switch |
| `emergency.disable_feature_for_site` | ops | off | Emergency site-specific feature shutdown |
| `emergency.disable_task_class` | ops | off | Emergency task-class shutdown |
| `emergency.force_fast_mode` | ops | off | Emergency faster processing mode |
| `emergency.disable_provider_route` | ops | off | Emergency internal route shutdown |
| `emergency.limit_free_high_cost` | ops | off | Emergency Free-tier long-content limiter |
| `emergency.disable_digest` | ops | off | Emergency learning-summary shutdown |
| `emergency.disable_share` | ops | off | Emergency sharing shutdown |
| `emergency.privacy_lockdown` | ops | off | Emergency privacy lockdown for non-essential processing |

## V0 kill-switch evaluator

Runtime evaluator: `evaluateKillSwitch(context, rules)` in `src/utils/feature-flags.ts`.

| Category | Match fields | Purpose |
|---|---|---|
| `feature` | `featureKey`, optional `surface` | Disable one capability globally or by surface |
| `site` | `hostname`, optional `featureKey` / `surface` | Disable a capability for a hostname without storing full URL paths or query strings |
| `task` | `taskClass` | Pause a task class such as long content or video summary |
| `tier` | `tier` | Apply emergency Free / Trial / Pro boundaries |
| `provider` | `providerId` | Pause an internal route during instability; not shown in ordinary UI |
| `privacy` | `privacyMode` | Force safest behavior during privacy incidents |

The static V0 list is `V0_KILL_SWITCHES`. Rules default to disabled and safe mode. Evaluator inputs are metadata-only and must not include raw page text, selected text, transcripts, file text, prompts, user notes, or full URL path/query.

## Default safety rules

- Every flag has a safe fallback message.
- `kill` always disables the capability and returns `safeMode: true`.
- Gradual rollout uses deterministic local bucketing.
- Local overrides are stored in `astra.feature_flags.overrides.v1`.
- Audit events are stored in `astra.feature_flags.audit.v1`.

## Current boundary

This is a local/runtime foundation. It does not yet claim a production remote ops console, remote signed flag delivery, or server-side entitlement enforcement. Those remain later work under the Operations Console and Paid Launch gates.
