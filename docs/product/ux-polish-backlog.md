# Astra UX Polish Backlog

This backlog is for small, high-leverage UX upgrades that can run after or alongside the main product-completeness work. It avoids large architecture changes and focuses on moments where ordinary users feel friction.

## Prioritization rule

Prioritize a polish item when it helps a non-technical user complete this loop:

```text
understand → save → review → return to source
```

Avoid polish that mostly helps power users configure Astra.

## P0 polish — visible progress and confidence

| Item | User problem | Desired behavior | Surface |
|---|---|---|---|
| Save confirmation consistency | User is unsure whether a word/sentence was saved | Every save says “Saved to today’s review” or equivalent | Selection, transcript, popup, review |
| Review count after save | User does not know the next step | Show “Review N now” after creating cards | Selection, sample lesson, video |
| Empty Review next action | User sees no cards and leaves | Explain how to create first cards from a page/video | Review |
| Page limitation fallback | User thinks Astra is broken | Explain limitation and offer selection explain | Content overlay |
| No-caption fallback | User thinks video support failed | Offer paste/explain path and supported-video language | Video |
| Loading state timeout copy | User sees spinner too long | After delay, say Astra is still working and user can keep reading | Page translate, AI explain |

## P1 polish — reduce cognitive load

| Item | User problem | Desired behavior | Surface |
|---|---|---|---|
| One primary action per state | Too many buttons compete | Primary CTA changes by state: start, save, review, continue | Popup/onboarding |
| Remember last reading display | User repeatedly switches bilingual/translation-only | Preserve simple display preference | Content overlay |
| Undo after save/delete | User fears mistakes | Show short-lived Undo | Selection, Review, Library |
| Source chip consistency | Cards feel detached | Show page/video/source chip consistently | Review, Library |
| Review completion next step | User finishes and exits | Offer continue reading/watch supported video | Review |
| Gentle streak copy | Streak feels punitive | Use encouragement, not shame | Mobile, Review |

## P2 polish — delight without scope creep

| Item | User problem | Desired behavior | Surface |
|---|---|---|---|
| “Best expression to save” hint | User does not know what is worth saving | Suggest 1–3 expressions after reading | Page/Deep Read |
| Lightweight weekly recap | User does not feel progress | Summarize saved/reviewed moments | Web/Mobile |
| Source return memory | User forgets where they stopped | Return to last page/video context | Library/Review |
| Soft personalization | User sees repeated awkward terms | “Remember this translation” without glossary management | Web |

## Anti-polish list

Do not prioritize these until the core loop is stable:

- complex theme customization;
- folder/tag management;
- prompt template editors;
- provider/model chooser UI;
- social badges/community;
- full course builder;
- universal video platform support claims.

## Acceptance test

For each shipped polish item, answer:

1. Did it remove a moment of uncertainty?
2. Did it avoid adding a setting?
3. Did it keep implementation details hidden?
4. Did it move users toward save/review/source return?
