# Trust and Privacy Experience Contract

Source plan: Section 9 from the macro product upgrade plan dated 2026-05-27.

Trust comes from accurate, ordinary-language boundaries rather than exaggerated claims. Astra should answer the questions ordinary learners actually have before asking them to save content, rely on AI, or pay.

## Executable source

See `src/utils/trust/privacy-experience.ts`.

## User concerns

Astra must be able to answer:

- Will my page content be uploaded?
- Can other people see my learning records?
- Can I delete what I saved?
- Can I avoid saving some pages?
- What happens to data after membership cancellation?

## Trust cards

Recommended surfaces: onboarding, settings, and Library.

English copy:

- `Astra only sends the text needed to help you understand content.`
- `You choose what gets saved.`
- `Privacy Mode reduces page context.`
- `You can delete your saved learning data anytime.`

Chinese direction:

- Astra 只处理帮你理解内容所需的文本。
- 你可以决定哪些内容保存。
- 隐私模式会减少上下文。
- 你可以随时删除学习数据。

## Required controls

P0 user controls:

- Privacy Mode;
- do not save current page;
- delete current page learning record;
- delete video note;
- delete all learning data;
- export my data;
- do not sync reading history;
- delete account data.

These controls may be distributed across settings, Library/source detail, account, or support/help surfaces, but the product must be able to point users to them clearly.

## Do not overclaim

Forbidden unless the actual architecture and legal review prove the claim:

- `fully local`
- `never uploads`
- `end-to-end encrypted`
- `absolutely no logs`
- `all pages are safe`

Approved Privacy Mode boundary:

> Privacy Mode reduces page context and automatic memory use. Translation text may still leave the device on direct provider or relay paths.

## Readiness blockers

`evaluateAstraTrustPrivacyReadiness()` blocks readiness when:

- ordinary user concerns are not answered;
- required privacy controls are not visible;
- trust copy overclaims privacy or safety;
- Privacy Mode copy is inaccurate;
- cancellation data handling is unclear.

It warns when trust cards are missing from core surfaces or trust copy is too technical for ordinary learners.

## Current implementation relationship

This contract complements existing lower-level safeguards:

- data-retention and copyright controls in `src/utils/data-retention-control.ts`;
- legal/store permission trust in `src/utils/trust/compliance.ts`;
- support-bundle metadata-only defaults;
- learning-memory Privacy Mode and personalization write policy.

The Section 9 layer is specifically about user-facing trust comprehension: what the learner sees, understands, and can control.
