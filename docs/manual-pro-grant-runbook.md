# Manual Pro-Grant Runbook (paid beta)

**Scope:** How an operator grants/revokes a Pro (or Trial) entitlement during the invite-only paid beta. No payment gateway, no IAP — the subscription truth source is a manual operator action (master execution plan §4.5/§11).

As of `astra-paid-beta-foundation` the grant path is **operator-gated and audit-logged** (`PATCH /v1/account/plan`, `handlePlanUpdate` in `src/server/index.ts`). A signed-in user can only downgrade *their own* plan to `free`; paid plans require an explicit operator principal and a named target account.

---

## Prerequisite: configure an operator principal

Paid grants require an **explicit** operator token in `ASTRA_OPERATOR_TOKENS` (JSON array). The legacy `ASTRA_PLATFORM_MIRROR_SECRET` is **rejected** for plan grants (it may still authorize other ops routes), so a deployment that only sets the mirror secret cannot mint paid entitlement.

```bash
export ASTRA_OPERATOR_TOKENS='[{"id":"ops-1","role":"ops_engineer","token":"<strong-random-secret>"}]'
# restart the relay so it inherits the variable (src/server/config.ts reads process.env only)
```

Allowed roles for grants: `ops_engineer` or `admin`.

---

## Grant Pro (or Trial) to an invited account

```bash
curl -s -X PATCH "$RELAY_BASE/v1/account/plan" \
  -H "Content-Type: application/json" \
  -H "X-Astra-Operator-Token: <ops token from ASTRA_OPERATOR_TOKENS>" \
  -d '{"plan":"pro","email":"invited.user@example.com"}'
```

- `email` is the **target account** (case-insensitive, format-validated, ≤254 chars). Required for `pro`/`trial`.
- Expected: **200** with the updated account JSON (`plan: "pro"`, entitlements/limits re-derived from the configured provider allowlist).
- The action is recorded in the ops audit log as `ops_account_plan_updated` with the operator id/role and a **hashed** target (`subjectEmailHash`) — no raw email in the log. Verify the grant landed by reading the account summary (as that user) or the audit entry.

**Expected failure responses (so you can confirm the gate works):**

| Request | Result |
|---|---|
| User session (no operator token) sets own plan to `pro` | **401** — self-upgrade refused |
| Operator token but **no `email`** for a paid grant | **400** — target account required |
| **Legacy mirror secret** used for a paid grant | **403** — explicit operator token required |
| Operator token + valid `email` | **200** — granted, audit-logged |

---

## Revoke / cancel (downgrade to free)

- **Operator revoke:** same call with `{"plan":"free","email":"<target>"}` and the operator token.
- **User self-cancel:** a signed-in user may downgrade their *own* plan with their session (no operator token, no `email`):

```bash
curl -s -X PATCH "$RELAY_BASE/v1/account/plan" \
  -H "Content-Type: application/json" -H "Authorization: Bearer <user session token>" \
  -d '{"plan":"free"}'
```

A self-serve request that targets another account (`email` present) is rejected **400**.

Record each grant/revoke date in the beta cohort spreadsheet so the weekly cost read (`GET /v1/ops/cost/usage-summary`) can be attributed per user.

---

## Weekly cost-review (operator)

Once per week read `GET /v1/ops/cost/usage-summary` (aggregate, metadata-only; `user-store.ts`), compare total spend to the cohort budget, and scan for any account whose high/long-running usage is an outlier. If trending over budget, flip `emergency.limit_free_high_cost` or `force_fast_mode` (runtime kill switches, `index.ts`) — no redeploy — rather than editing limits live. (Free tier limits are also enforced at config load: the relay refuses to start if Free is not strictly below Pro on every axis — see `findFreeTierLimitViolations`.)
