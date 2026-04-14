# Month 6 — Privacy / routing / failure inventory (starter)

_Task **`M6-G-01`**_

## Surfaces to audit (code map)

| Concern | Starting paths |
|---------|----------------|
| Provider routing / fallback | `src/utils/providers/router.ts`, `src/utils/providers/relay.ts`, `openai.ts`, `gemini.ts` |
| Translation batch entry | `src/entrypoints/background/index.ts` (`handleTranslate`) |
| Relay privacy expectations | `server/` relay routes + extension `translate` client |

## Output of this inventory pass

This note **does not** close gaps — it names the subsystem map for Month 6 quality work. Prioritized fixes should be opened as scoped tasks once a specific guardrail is missing (for example: uncached explain path caching policy, error classification for user-visible copy).
