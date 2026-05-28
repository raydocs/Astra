# Owner release approval evidence note — 2026-05-28

Source: macro final-completion blocker `ownerReleaseApprovalRecorded`.

This note records repo-side owner approval guardrails. It is **not** an owner approval, signed release decision, or final RC signoff.

## Current repo-backed evidence

| Area | Repo evidence | Current proof | Remaining boundary |
| --- | --- | --- | --- |
| Gate 4 claim review | `docs/reviews/macro-gate-4-claim-review-2026-05-28.md` | Records pass-with-downgrades claim alignment and explicitly blocks final launch/signoff claims. | Needs owner approval for the target commit/SHA. |
| RC evidence packet | `docs/reviews/macro-rc-evidence-packet-2026-05-28.md` | Records current repo-side validation evidence and remaining blocker boundaries. | Needs owner review/approval of this exact packet. |
| Final completion gate | `docs/reviews/macro-final-completion-gate-2026-05-28.md` | Currently renders `Complete: no` with eight blockers. | Owner approval must acknowledge remaining final blockers and downgrade copy; it cannot be final completion approval while blockers remain. |
| Approval packet intake | `evaluateAstraMacroReleaseApprovalPacket()` | Requires approver/date with `YYYY-MM-DD`, approval record link as a URL or repo artifact path, 7–40 character non-zero hex target commit/SHA, reviewed artifact list, remaining-blocker acknowledgement, and downgrade-copy acknowledgement. Placeholder approval links or SHAs are rejected. | This validates supplied approval evidence; it does not create owner approval. |

## Required approval packet

`ownerReleaseApprovalRecorded` may only be marked true when the approval packet includes:

- approver and approval date containing a real calendar `YYYY-MM-DD`;
- approval record link, such as a signed issue comment, release note, approval document, or internal approval artifact, recorded as a URL or repo artifact path;
- target commit/SHA as a 7–40 character non-zero hex git SHA;
- reviewed artifacts:
  - `docs/reviews/macro-gate-4-claim-review-2026-05-28.md`;
  - `docs/reviews/macro-rc-evidence-packet-2026-05-28.md`;
  - `docs/reviews/macro-final-completion-gate-2026-05-28.md`;
  - `docs/reviews/macro-final-evidence-intake-2026-05-28.md`;
- explicit acknowledgement that remaining final blockers still keep the macro plan at `Complete: no`;
- explicit acknowledgement that public/release copy must keep the required downgrade boundaries until stronger evidence is attached.

## Downgrade copy

Gate 4 claim review, RC evidence packet, final gate, and owner-approval packet intake guard exist in repo. Final completion still requires an actual URL/repo-path owner approval record for the same target commit/SHA, with reviewed artifacts and remaining-blocker/downgrade acknowledgements, before `ownerReleaseApprovalRecorded` can be marked true.
