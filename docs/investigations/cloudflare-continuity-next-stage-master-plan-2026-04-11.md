## Final Prompt
<taskname="下一阶段规划"/>
<task>请基于当前已完成的 Cloudflare next-phase 基线，为 Astra 制定“下一阶段”执行计划。不要复盘已完成的 Cloudflare Phase 1-6；把 2026-04-11 已完成状态当作起点。重点判断并输出：1) 剩余的 Cloudflare auth/session 演进应不应该继续、做到哪一层、为什么；2) account-summary / control-plane 还有哪些真实缺口；3) export/delete/retention、sync mutation compaction、repair/replay/lifecycle maturity 是否应进入本阶段；4) iOS bridge 完成后，移动入口应继续以 Web/PWA + bridge 为主，还是把 Android/更重移动形态纳入同阶段。结果必须是面向本仓库的 concrete execution plan，包含 phases、排序、rationale、risks、done-when，并明确哪些事情现在不该做（尤其是无充分理由的 full auth login/session issuance migration 或 Durable Objects 引入）。</task>

<architecture>
- 已完成基线：`docs/investigations/cloudflare-next-phase-master-plan-2026-04-10.md` 明确截至 2026-04-11，scoped Cloudflare platform block、Web control-plane block、iOS bridge block 都已完成；下一阶段应从这个完成态继续，而不是重复 Phase 1-6。
- 平台边界：`docs/specs/cloudflare-platform.md` 说明 Node relay/server 仍是大多数 API 的 authoritative owner；Worker 只在选定 device/sync/import seams 上渐进接管；auth login / full session issuance 仍保持 Node-owned；Durable Objects 仅在真实 per-user coordination 压力出现时才考虑。
- 运营边界：`docs/cloudflare-platform-ops-runbook.md` 说明当前已有 canary/rollback/observability/backfill/governance 路径，并再次强调 auth login/session issuance 不在当前已完成块内。
- 产品/连续性边界：`docs/specs/cross-device-sync.md`、`docs/specs/device-management.md`、`docs/specs/web-pwa-companion.md` 定义了 sync/device/web 的正式 contract；其中 export/delete/account controls、tombstone compaction、retention policies、后续 hardening 仍被留到后续阶段。
- 移动/承诺边界：`docs/investigations/support-matrix-2026-q2.md` + `ios/README.md` 表明 iOS 仍是 Safari Web Extension host shell/bridge，Web/PWA 是可移植入口；不要把“可构建”误写成“完整移动产品”。
- 共享契约层：`server/types.ts`、`src/types/auth.ts`、`src/types/config.ts`、`src/utils/astra/account.ts`、`src/utils/astra/sync-push.ts` 是 server / Worker / web 共用的 device/session/sync contract。</architecture>

<selected_context>
Astra/docs/investigations/cloudflare-next-phase-master-plan-2026-04-10.md: 已完成基线与仍开放 gap 的主文档；明确后续候选项包括 account summary read、export/delete/retention、mutation compaction、sync lifecycle maturity、mobile entry strategy。
Astra/docs/specs/cloudflare-platform.md: Cloudflare route ownership、source-of-truth policy、D1 shadow schema 方向、Durable Objects decision rubric。
Astra/docs/cloudflare-platform-ops-runbook.md: 当前 rollout/rollback/backfill/replay/retention/governance/observability 已具备的运营面；auth login/session issuance 仍留在 Node。
Astra/docs/specs/cross-device-sync.md: sync collection contract、privacy/export/delete matrix、tombstone retention、后续 compaction/retention/account controls 的延后项。
Astra/docs/specs/device-management.md: durable session/device registry、remote revoke、device-aware auth 语义与后续 hardening 范围。
Astra/docs/specs/web-pwa-companion.md: Web/PWA 的 portable boundary；文本/文件/URL import/account/cloud assets 属于 Web，live page mutation 不属于 Web；文档还记录了 Phase 5 web cloud-console completion snapshot。
Astra/docs/investigations/support-matrix-2026-q2.md: Chromium primary、Firefox/Safari beta、iOS shell experimental；可宣称边界与 open validation gaps。
Astra/ios/README.md: iOS 仅是 Safari shell + host bridge；launch/open/handoff 已完成，但 shared session materialization / full native auth / full mobile UX 仍未实现。
Astra/src/utils/extension/ios-host-bridge.ts: extension 侧只做 native message bootstrap / status / history / open-in-app，不承担云控制面或完整移动会话管理。
Astra/server/index.ts: 当前 authoritative API routes 仍集中在 Node：`/auth/session`、`/account`、`/billing`、`/devices`、`/sync/*`、`/translate`、`/import/article`。
Astra/server/user-store.ts: 当前 authoritative persistence 仍是本地文件 DB；已持久化 users/devices/sessions/syncMutations 和 sync prefs，但没有 export/delete/retention/compaction job 系统。
Astra/server/types.ts + Astra/src/types/auth.ts: canonical session/device/sync payloads、quota/account shapes、device identity、sync bootstrap/push/pull contracts。
Astra/src/utils/astra/account.ts: web/shared continuity client；把 devices + sync bootstrap + sync pull 组合成 continuity snapshot。
Astra/src/utils/astra/sync-push.ts: shared sync validation；定义 optional collection enablement、sanitized URL、payload legality；为 compaction/retention discussion 提供当前 mutation contract 边界。
Astra/platform/cloudflare/sql/0100_auth_session_shadow.sql: `shadow_users` + `shadow_auth_sessions` 已落地，当前仍是 shadow schema，不是 full login issuance authority。
Astra/platform/cloudflare/sql/0200_device_shadow.sql: `shadow_devices` 表示 device registry shadow 已落地。
Astra/platform/cloudflare/sql/0300_sync_shadow.sql: `shadow_sync_collections` + `shadow_sync_mutations` 已落地，已具备 cursor/mutation append 基础，但未体现 compaction or retention workers。
Astra/platform/cloudflare/sql/0400_platform_ops.sql: `platform_route_events` 已落地，统一 route/parity/operator observability 已是基线。
Astra/platform/cloudflare/src/handlers/sync-bootstrap.ts: Worker native read 仍先走 Node auth gate + authoritative Node bootstrap fetch，再决定是否返回 D1-backed read；说明当前 Cloudflare read authority 仍是 guarded/native seam 而非完全脱离 Node。
Astra/platform/cloudflare/src/handlers/sync-push.ts: Worker native write 已是 D1-authoritative append + explicit Node mirror-back；mirror-back 结果不明确时返回 guarded 503，表明当前迁移仍以 rollback safety 优先。
Astra/platform/cloudflare/src/handlers/device-revoke.ts: 第一条低风险 Worker authoritative write seam 已落地，模式与 sync-push 类似：Node auth gate -> D1 write -> Node mirror-back。
Astra/platform/cloudflare/src/handlers/platform-observability.ts: unified observability 已能看 rollout/parity/backlog/governance；这类平台可见性不应再被当作未来主缺口。
Astra/web/src/lib/astra-web.ts: web 已有 account/quota/billing/devices/cloud assets/import backlog/replay/sync-health clients，说明 account-summary/control-plane 已做了一大块，不应重复规划已完成部分。
Astra/web/src/lib/workspace-store.ts: web 已有 IndexedDB lifecycle audit、corruption repair、reset；这也是已完成基线，而不是下一阶段新提案。
Astra/platform/cloudflare/src/handlers/sync-pull.ts (codemap): sync pull read seam 已存在；虽然未保留全文，但可与 `sync-bootstrap.ts`/`sync-push.ts` 一起判断当前 Cloudflare sync lifecycle 成熟度。
</selected_context>

<relationships>
- `server/index.ts` -> `server/user-store.ts`：Node 仍是 auth/account/device/sync 的 authoritative runtime + persistence。
- `src/utils/astra/account.ts` -> `/devices` + `/sync/bootstrap` + `/sync/pull`：web continuity/account surfaces 通过这些 API 组合 cloud assets 与 sync health。
- `web/src/lib/astra-web.ts` 建立在 `src/utils/astra/account.ts` 之上，已把 account/quota/billing/devices/cloud continuity/import observability 暴露为 web control-plane surface。
- Worker `native` read seams（至少 `sync-bootstrap`，以及 codemap 中的 `sync-pull`）仍依赖 Node auth/session gate 和 authoritative compare/fallback。
- Worker `native` write seams（`device-revoke`、`sync-push`）采用 D1-authoritative write + explicit Node mirror-back；这说明当前目标是 scoped route ownership，而不是一次性迁移 full auth/session system。
- `cross-device-sync.md` 与 `device-management.md` 把 export/delete/retention、tombstone compaction、hardening 留在后续阶段；这些正是“下一阶段”最自然的候选项。
- `ios/README.md` + `ios-host-bridge.ts` 说明 iOS 仍是 bridge-first；web 明确不是 iOS host handoff owner，而是 cloud/control-plane owner。
- `support-matrix-2026-q2.md` + `web-pwa-companion.md` 一起约束了移动策略：Web/PWA 是当前最可信的 portable entry，iOS shell 仍是 experimental，Android/full native 不能默认抢占 backend authority work 的优先级。
</relationships>

<ambiguities>
- “下一阶段”必须从 completed baseline 起算：不要再把 IndexedDB lifecycle、corruption recovery、queue observability、web assets/control-plane、iOS bridge completion 当成未来工作；这些在 docs/code 里已经完成。
- Cloudflare 已有 scoped authoritative writes 和 guarded native reads，但 auth login / full session issuance 仍被多份文档明确排除。只有在 repository evidence 证明 remaining gaps 无法通过 scoped authority、control-plane、data lifecycle work 解决时，才应把更深 auth migration 放入本阶段。
- `server/user-store.ts` 仍是 authoritative file DB，尚未看到 export/delete/retention orchestration、sync mutation compaction worker、server-side account export pipeline；这些像是当前最真实的 backend maturity gaps。
- iOS bridge 已完成 launch/open/handoff narrative，但 support matrix 仍把 iOS shell 标为 experimental；因此“更重移动策略”应基于 claim boundary 和 backend maturity 排序，而不是仅基于已有壳工程。
- 为节省预算，`server/cloudflare-shadow.ts` 未被选入全文；其作用可从 `server/user-store.ts` 对 shadow mirror 的调用、Cloudflare SQL schema、Worker seam 文档与 ops runbook 中推断。
</ambiguities>

## Selection
- Files: 28 total (25 full, 3 codemap)
- Total tokens: 101587 (Auto view)
- Token breakdown: full 93441, codemap 8146

### Files
### Selected Files
├── docs/
│   ├── investigations/
│   │   ├── cloudflare-next-phase-master-plan-2026-04-10.md — 4,240 tokens (full)
│   │   └── support-matrix-2026-q2.md — 1,316 tokens (full)
│   ├── specs/
│   │   ├── cloudflare-platform.md — 5,548 tokens (full)
│   │   ├── cross-device-sync.md — 4,391 tokens (full)
│   │   ├── device-management.md — 3,259 tokens (full)
│   │   └── web-pwa-companion.md — 4,547 tokens (full)
│   └── cloudflare-platform-ops-runbook.md — 2,561 tokens (full)
├── ios/
│   └── README.md — 1,756 tokens (full)
├── platform/
│   └── cloudflare/
│       ├── sql/
│       │   ├── 0100_auth_session_shadow.sql — 487 tokens (full)
│       │   ├── 0200_device_shadow.sql — 256 tokens (full)
│       │   ├── 0300_sync_shadow.sql — 522 tokens (full)
│       │   └── 0400_platform_ops.sql — 216 tokens (full)
│       └── src/
│           └── handlers/
│               ├── device-revoke.ts — 5,637 tokens (full)
│               ├── platform-observability.ts — 2,688 tokens (full)
│               ├── sync-bootstrap.ts — 5,902 tokens (full)
│               └── sync-push.ts — 6,522 tokens (full)
├── server/
│   ├── index.ts — 7,838 tokens (full)
│   ├── types.ts — 1,756 tokens (full)
│   └── user-store.ts — 10,348 tokens (full)
├── src/
│   ├── types/
│   │   └── auth.ts — 2,467 tokens (full)
│   └── utils/
│       ├── astra/
│       │   ├── account.ts — 2,227 tokens (full)
│       │   └── sync-push.ts — 2,661 tokens (full)
│       └── extension/
│           └── ios-host-bridge.ts — 1,225 tokens (full)
└── web/
    └── src/
        └── lib/
            ├── astra-web.ts — 9,780 tokens (full)
            └── workspace-store.ts — 5,291 tokens (full)

### Codemaps
├── platform/
│   └── cloudflare/
│       └── src/
│           ├── handlers/
│           │   └── sync-pull.ts — 797 tokens (manual)
│           └── types/
│               └── shadow-state.ts — 1,541 tokens (manual)
└── src/
    └── types/
        └── config.ts — 5,808 tokens (manual)


---

## Generated Plan

## Chat Send ✅
- **Chat**: `下一阶段规划-33E477` | **Mode**: plan

### Response
# 1. **Summary**

下一阶段应继续推进 Cloudflare，但只推进到**连续性域的“会话校验/会话撤销 + account-summary 读面 + sync 生命周期控制面”**，**不做** full auth login / session issuance migration，也**不引入** Durable Objects。原因是：当前真正阻塞 Astra 从“可切流”走向“可长期运营”的，不是再造一套登录系统，而是把已迁到 Worker/D1 的 device/sync 路径从 **Node auth gate 依赖** 中解开，并补齐 **account summary、export/delete/retention、sync compaction、repair/replay** 这些运营闭环。移动入口仍应坚持 **Web/PWA + iOS bridge** 主路径；Android/更重原生形态不应与本阶段并行。

# 2. **Current-state analysis**

## 2.1 当前职责与所有权

### Node 仍是当前 authoritative runtime / persistence
- `server/index.ts`
  - 当前 authoritative API owner：`/v1/auth/session`、`/v1/account`、`/v1/account/usage`、`/v1/billing/*`、`/v1/devices`、`/v1/sync/*`、`/v1/translate`、`/v1/import/article`
- `server/user-store.ts`
  - authoritative persistence：`users`、`devices`、`sessions`、`syncMutations`
  - 关键 mutation 点：
    - `issueBoundSession`
    - `touchSession`
    - `revokeSession`
    - `revokeDevice`
    - `recordTranslationUsage`
    - `updateSyncCollectionPreference`
    - `pushSyncMutations`
    - `pullSyncMutations`

### Worker/D1 已接管的是 scoped seam，不是全 auth/account
- `platform/cloudflare/src/handlers/device-revoke.ts`
  - 已有 first authoritative write seam：D1 revoke → Node mirror-back
- `platform/cloudflare/src/handlers/sync-push.ts`
  - 已有 second authoritative write seam：D1 append → Node mirror-back
- `platform/cloudflare/src/handlers/sync-bootstrap.ts`
  - 已有 guarded native read
  - 但仍先走 Node `/v1/auth/session` gate，且 native compare 仍依赖 Node authoritative read
- `platform/cloudflare/src/handlers/platform-observability.ts`
  - rollout / parity / backlog / governance 已成基线
- `platform/cloudflare/sql/0100_auth_session_shadow.sql`
  - `shadow_users`、`shadow_auth_sessions`
- `platform/cloudflare/sql/0200_device_shadow.sql`
  - `shadow_devices`
- `platform/cloudflare/sql/0300_sync_shadow.sql`
  - `shadow_sync_collections`、`shadow_sync_mutations`
- `platform/cloudflare/sql/0400_platform_ops.sql`
  - `platform_route_events`

### Web control-plane 已做了很多，但不是全闭环
- `web/src/lib/astra-web.ts`
  - 已能拉 account / usage / devices / sync bootstrap / sync pull / import backlog
- `src/utils/astra/account.ts`
  - 已封装 continuity client
- `web/src/lib/workspace-store.ts`
  - 本地 IndexedDB 审计 / repair / reset 已完成
- 但 web 仍缺：
  - 单一 `account summary` 读模型
  - cloud export/delete/retention controls
  - sync compaction / repair 状态与动作

### iOS 仍是 bridge，不是 mobile product
- `ios/README.md`
- `src/utils/extension/ios-host-bridge.ts`
  - 只负责 bootstrap / history / open-in-app
  - 不负责 cloud control-plane、shared session materialization、full native auth

## 2.2 端到端数据流现状

### 连续性读面
`web/src/lib/astra-web.ts`  
→ `src/utils/astra/account.ts`  
→ `/v1/devices` + `/v1/sync/bootstrap` + `/v1/sync/pull`  
→ Worker（若 fronted）  
→ Worker native route 仍先调用 Node `/v1/auth/session`  
→ Node `requireAuthenticatedSession()`  
→ `FileUserStore.getSessionContext()`  
→ JSON DB authoritative state

### sync 写面
client  
→ `POST /v1/sync/push`  
→ Worker `handleSyncPush()`  
→ Node `/v1/auth/session` gate  
→ D1 authoritative append  
→ Node mirror-back  
→ route/parity events 写入 `platform_route_events`

### device revoke 写面
client  
→ `POST /v1/devices/:deviceId/revoke`  
→ Worker `handleDeviceRevoke()`  
→ Node `/v1/auth/session` gate  
→ D1 authoritative revoke  
→ Node mirror-back  
→ route/parity events 写入 D1

## 2.3 已有可复用点

必须复用，不能重造：
- shared contracts：
  - `src/types/auth.ts`
  - `server/types.ts`
- shared sync validation：
  - `src/utils/astra/sync-push.ts`
- web continuity client：
  - `src/utils/astra/account.ts`
- Worker seam pattern：
  - `device-revoke.ts`
  - `sync-bootstrap.ts`
  - `sync-push.ts`
- D1 repo layer与平台事件：
  - `platform/cloudflare/src/repositories/*`
  - `platform/cloudflare/src/lib/platform-ops`
- Node→D1 shadow mirror：
  - `server/user-store.ts` 里对 `cloudflareShadow` 的调用链

## 2.4 当前真正阻塞下一阶段的点

1. **Worker native continuity routes 仍依赖 Node auth gate**
   - `sync-bootstrap.ts` / `sync-push.ts` / `device-revoke.ts` 都还没脱离 Node `/v1/auth/session`
2. **没有 account-summary 聚合读模型**
   - web 现在靠 fanout；控制面没有单一 authoritative summary
3. **没有 cloud data lifecycle**
   - 无 export
   - 无 cloud delete
   - 无 retention state
4. **没有 sync materialized state / compaction / repair**
   - 只有 append log：`shadow_sync_mutations`
   - 没有可直接用于 repair/export 的 record-state
5. **iOS 仍是 experimental bridge**
   - `docs/investigations/support-matrix-2026-q2.md` 已明确不能据此扩 Android/full native

# 3. **Design**

## 3.1 设计决策：这是“连续性域扩展”，不是 repo-wide refactor

**推荐方案：有边界扩展现有 Node-authoritative + Worker seam 架构。**

### 为什么不是更大的重构
- 现有代码已经有清晰 extension point：
  - shared Zod contracts
  - Worker proxy/shadow/native handler pattern
  - Node→D1 shadow mirror
  - web control-plane adapter
- 真正缺口是**连续性域成熟度**，不是全仓库架构错误

### 为什么也不是只做一个小补丁
- 仅补一个 `/v1/auth/session` Worker 读路由不够
- export/delete/retention/compaction/repair 需要一组相互依赖的数据面：
  - usage shadow
  - sync record-state
  - lifecycle jobs
  - repair protocol

---

## Phase A — Cloudflare auth/session 继续推进，但止步于 **validation/revoke**，不做 issuance

### 目标
把 Cloudflare 连续性域从“已迁的 device/sync route 仍依赖 Node auth gate”，推进到“Worker 可以独立校验当前 session，并为已迁 continuity route 提供本地 auth boundary”。

### 明确结论
**应该继续做，但只做到：**
1. `GET /v1/auth/session` 的 Worker-native validation/read
2. `DELETE /v1/auth/session` 的 Worker-native current-session revoke
3. 为此补齐 D1 侧 usage/account shadow，供 summary/control-plane 使用

**不做：**
- `POST /v1/auth/session` 登录/签发迁移
- `POST /v1/auth/anonymous` 迁移
- token issuance / password verification / login throttling 迁移

### 原因
- 这样可以去掉当前 continuity routes 对 Node gate 的硬依赖
- 但不会引入 full login migration 的高 blast radius
- `docs/specs/cloudflare-platform.md`、`docs/cloudflare-platform-ops-runbook.md` 都明确 full issuance 不是当前合理边界

### 新/修改组件

#### 1) 新共享 token helper
- **文件**：新增 `src/utils/astra/session-token.ts`
- **种类**：module
- **职责**：
  - bearer token parse
  - claims schema
  - token verify helper
- **被谁使用**：
  - `server/auth.ts`
  - Worker auth helper
- **原因**：
  - 当前 Worker 某些 compare path 用 request token heuristic decode；这不能升级为 authoritative auth gate

#### 2) Worker 侧 auth helper
- **文件**：新增 `platform/cloudflare/src/lib/session-auth.ts`
- **种类**：module
- **状态所有权**：无持久状态；单 request 内只读 D1
- **接口形状**：
  - `validateShadowSession(request, env, ctx): Promise<ValidatedShadowSession>`
  - `touchShadowSessionLater(...)`
- **返回数据**
  - `shadowUser`
  - `shadowSession`
  - `currentDevice`
  - `usageShadow`
- **线程/执行**
  - request path 同步校验
  - `touch` 用 `ctx.execution.waitUntil(...)` 异步落库

#### 3) 新 Worker auth handler
- **文件**：新增 `platform/cloudflare/src/handlers/auth-session.ts`
- **接口**
  - `GET /v1/auth/session`
    - `proxy | shadow | native`
  - `DELETE /v1/auth/session`
    - `proxy | native`
- **行为**
  - GET native：本地 token verify + D1 session/device/user 校验，返回 `AstraSession`
  - DELETE native：D1 revoke current session → Node mirror-back DELETE → guarded 503 on ambiguous mirror-back

#### 4) usage shadow
- **文件**：
  - 新增 `platform/cloudflare/sql/0500_account_usage_shadow.sql`
  - 新增 `platform/cloudflare/src/repositories/user-usage.ts`
  - 修改 `server/cloudflare-shadow.ts`
  - 修改 `server/user-store.ts`
- **表结构**
  - `shadow_user_usage`
    - `user_id TEXT PRIMARY KEY`
    - `usage_day TEXT`
    - `daily_requests_limit INTEGER`
    - `daily_characters_limit INTEGER`
    - `requests_per_minute_limit INTEGER`
    - `requests_today INTEGER`
    - `characters_today INTEGER`
    - `total_requests INTEGER`
    - `total_characters INTEGER`
    - `last_request_at TEXT NULL`
    - `recent_events_json TEXT`
    - `shadow_updated_at TEXT`
- **为什么单独建表**
  - usage 更新频繁，不应每次重写 `shadow_users`

### 现有调用链改造
以下 handlers 都从“Node auth gate”改为“Worker local auth helper”：
- `platform/cloudflare/src/handlers/device-revoke.ts`
- `platform/cloudflare/src/handlers/sync-bootstrap.ts`
- `platform/cloudflare/src/handlers/sync-pull.ts`
- `platform/cloudflare/src/handlers/sync-push.ts`

### API 变化
#### 变更前
- `GET /v1/auth/session`：Node-only
- `DELETE /v1/auth/session`：Node-only
- continuity handlers 内部都 `fetchNodeRelay(..., pathOverride: "/v1/auth/session")`

#### 变更后
- public contract 不变
- route owner 增加 Worker mode flag：
  - `AUTH_SESSION_READ_MODE=proxy|shadow|native`
  - `AUTH_SESSION_REVOKE_WRITE_MODE=proxy|native`
- internal call sites 改为本地 `validateShadowSession(...)`

### 错误与边界
- 复用现有 auth code：
  - `SESSION_REQUIRED`
  - `DEVICE_REQUIRED`
  - `DEVICE_MISMATCH`
  - `DEVICE_REVOKED`
  - `SESSION_REVOKED`
  - `SESSION_EXPIRED`
  - `REAUTH_REQUIRED`
- `touch` 丢失或乱序：
  - 只影响 `lastSeenAt` / `lastVerifiedAt`
  - 不影响 auth 决策
- D1 shadow 缺口：
  - native 直接 fallback 到 `proxy`
  - route event 记录 `fallbackReason`

### Done when
- continuity native routes 不再调用 Node `/v1/auth/session`
- `GET /v1/auth/session` 可在 Worker native 稳定返回
- `DELETE /v1/auth/session` 可走 D1 revoke + Node mirror-back
- 生产仍只保留 `POST /v1/auth/session` 在 Node

---

## Phase B — account-summary / control-plane 读面补齐

### 目标
补齐真实缺口：不是重复 devices/assets/import UI，而是提供**单一连续性 summary**，让 web/control-plane 能看见当前 session、device、sync health、usage。

### 真实 gap
已完成、**不再规划**：
- account / billing link
- device list
- cloud assets detail
- import backlog / replay
- local IndexedDB audit / repair / reset

仍缺：
1. 当前 session summary（sessionId/deviceId/expiry/status）
2. usage + continuity 合并视图
3. per-collection active count / mutation count / cursor / last sync
4. 后续 lifecycle state 的挂接位置

### 新类型
- **文件**：修改 `src/types/auth.ts`、`server/types.ts`
- **新增类型**
  - `AstraAccountSummary`
  - `AstraSyncCollectionSummary`
- **建议形状**
```ts
interface AstraAccountSummary {
  serverTime: string
  account: AstraAccount
  usage: AstraUsageSnapshot
  session: {
    sessionId: string | null
    deviceId: string | null
    issuedAt: string | null
    expiresAt: string | null
    identityMode: "anonymous" | "authenticated"
    status: "active" | "revoked" | "expired"
  }
  devices: {
    activeCount: number
    revokedCount: number
    current: AstraDeviceListEntry | null
  }
  sync: {
    maxMutationsPerRequest: number
    collections: Record<SyncCollection, {
      enabled: boolean
      defaultEnabled: boolean
      cursor: string | null
      mutationCount: number
      activeCount: number
      lastSyncAt: string | null
      compactionFloorCursor: string | null
    }>
  }
}
```

### 路由设计
#### Node baseline
- **文件**：修改 `server/index.ts`
- **新增**：`GET /v1/account/summary`
- **实现来源**：`FileUserStore.getAccountSummary(email, deviceId)`

#### Worker seam
- **文件**：
  - 新增 `platform/cloudflare/src/handlers/account-summary.ts`
  - 修改 `platform/cloudflare/src/routes.ts`
  - 修改 `platform/cloudflare/src/env.ts`
- **模式**
  - `ACCOUNT_SUMMARY_READ_MODE=proxy|shadow|native`
- **数据流**
  - proxy：直接返回 Node summary
  - shadow：返回 Node summary，同时 compare D1 summary
  - native：Worker local auth → D1 summary read → compare Node summary → fallback if incomplete

### D1 侧依赖
- `shadow_user_usage`
- `shadow_users`
- `shadow_auth_sessions`
- `shadow_devices`
- `shadow_sync_collections`
- `shadow_sync_mutations`
- Phase C 后再追加 lifecycle 摘要，不在这个 phase 强绑定

### Web 侧变化
- **文件**：
  - 修改 `src/utils/astra/account.ts`
  - 修改 `web/src/lib/astra-web.ts`
  - 修改 `web/src/app.tsx`
- **行为**
  - `astra-web.ts` 先尝试 `fetchAstraAccountSummary()`
  - 若 summary route 未启用或返回 fallback failure，继续使用现有 fanout：
    - `/account`
    - `/account/usage`
    - `/devices`
    - `/sync/bootstrap`
    - `/sync/pull`
- **理由**
  - 新 route 可渐进上线，不打断已完成 web surface

### Done when
- web account/control-plane 不再必须 fanout 才能拿到 continuity summary
- summary route 在 Worker native 模式下可稳定返回
- 现有 web 页面使用 summary 作为主读面，旧 fanout 仅保留回退

---

## Phase C — export / delete / retention 进入本阶段，但只做 **cloud continuity data lifecycle**

### 目标
把“有云数据”补齐为“有生命周期”。

### 结论
**应该进入本阶段。**

### 但边界必须明确
**做：**
- export synced continuity data
- collection-level cloud delete
- retention policy / artifact expiry / tombstone retention
- web control-plane surfaces

**不做：**
- full account closure
- billing identity deletion
- auth credential deletion
- provider secret export
- raw import artifact export 默认开放
- 全账号法律意义上的 erase flow

### 原因
- 当前 specs 已把 export/delete/retention 定义为后续 hardening 内容
- 这些是当前“真实缺口”
- 但 full account closure 会把 billing/auth/legal 绑定进来，超出本阶段合理范围

### 新持久化组件

#### 1) lifecycle jobs
- **文件**：新增 `platform/cloudflare/sql/0600_account_data_lifecycle.sql`
- **表**
  - `account_export_jobs`
  - `account_data_delete_jobs`

#### `account_export_jobs`
- `job_id TEXT PRIMARY KEY`
- `user_id TEXT NOT NULL`
- `requested_by_device_id TEXT NOT NULL`
- `scope_json TEXT NOT NULL`
- `status TEXT NOT NULL`  
  `queued | running | completed | failed | expired`
- `requested_at TEXT NOT NULL`
- `started_at TEXT NULL`
- `completed_at TEXT NULL`
- `failed_at TEXT NULL`
- `expires_at TEXT NULL`
- `artifact_object_key TEXT NULL`
- `artifact_sha256 TEXT NULL`
- `artifact_bytes INTEGER NULL`
- `error_code TEXT NULL`
- `error_message TEXT NULL`
- `shadow_updated_at TEXT NOT NULL`

#### `account_data_delete_jobs`
- `job_id TEXT PRIMARY KEY`
- `user_id TEXT NOT NULL`
- `requested_by_device_id TEXT NOT NULL`
- `scope_json TEXT NOT NULL`
- `status TEXT NOT NULL`  
  `queued | scheduled | running | completed | failed | canceled`
- `requested_at TEXT NOT NULL`
- `scheduled_for_at TEXT NOT NULL`
- `started_at TEXT NULL`
- `completed_at TEXT NULL`
- `failed_at TEXT NULL`
- `canceled_at TEXT NULL`
- `grace_period_seconds INTEGER NOT NULL`
- `error_code TEXT NULL`
- `error_message TEXT NULL`
- `shadow_updated_at TEXT NOT NULL`

### 新 API
- **文件**：
  - 修改 `src/types/auth.ts`
  - 修改 `src/utils/astra/account.ts`
  - 新增 Worker handlers
- **路由**
  - `POST /v1/account/export`
  - `GET /v1/account/export/:jobId`
  - `POST /v1/account/cloud-data-delete`
  - `GET /v1/account/cloud-data-delete/:jobId`

### export scope
- 包含：
  - `AstraAccount`
  - device registry
  - current sync collection states
  - materialized sync records（见 Phase D）
- 不包含：
  - `sessionToken`
  - provider secrets
  - translation cache
  - page digests
  - local-only daily aggregates
  - import raw artifacts

### delete scope
首阶段只支持：
- `vocabulary`
- `reading_history`
- `study_progress`

不支持：
- 完整 `config` 删除
- 账户关闭
- device registry 删除

### 作业数据流
#### export
UI  
→ `web/src/lib/astra-web.ts`  
→ `src/utils/astra/account.ts`  
→ Worker route  
→ D1 写 `account_export_jobs`  
→ Queue message  
→ Queue consumer 读取 materialized continuity state  
→ R2 生成 bundle  
→ job status completed  
→ web 轮询 job status / download link

#### delete
UI  
→ Worker route  
→ D1 写 `account_data_delete_jobs`（`scheduled`）  
→ grace period 到期  
→ Queue consumer 对所选 collection 逐 record 生成 `delete` mutation + 更新 materialized state  
→ normal sync pull 将删除传播给各客户端

### retention 策略
- export artifact retention：默认 7 天，可配
- delete grace period：默认 7 天，可配
- sync tombstone retention：至少 30 天，遵循 `docs/specs/cross-device-sync.md`
- lifecycle job history retention：90 天可配，供 web/ops 查看

### 并发与幂等
- export/delete create 必须支持 idempotency key
- Queue job duplicate delivery：
  - export：若 artifact 已生成且未过期，直接完成
  - delete：按 `(user_id, collection, record_id, delete_job_id)` 去重
- 取消 delete：
  - 仅 `scheduled` 状态可取消
  - `running/completed` 不可取消

### Done when
- 用户能导出云连续性数据
- 用户能对指定 cloud collection 发起 delete
- retention / expiry / grace policy 可见且可运营
- 删除通过 sync delta 正常传播，不依赖手工修复

---

## Phase D — sync mutation compaction / repair / replay / lifecycle maturity

### 目标
把当前 append-only sync log 提升到可长期运行，不再无限增长，也不再只有“拉全量 delta”的单一路径。

### 结论
**应该进入本阶段，而且必须在 export/delete 后紧接着做。**
不做这层，上一 phase 的 delete/export 只能算一次性功能，不能算稳定平台。

### 新持久化组件

#### 1) materialized sync state
- **文件**：新增 `platform/cloudflare/sql/0700_sync_lifecycle.sql`
- **表**：`shadow_sync_record_state`
- **字段**
  - `user_id TEXT`
  - `collection TEXT`
  - `record_id TEXT`
  - `is_deleted INTEGER`
  - `payload_json TEXT NULL`
  - `last_client_mutation_id TEXT`
  - `last_device_id TEXT`
  - `last_server_updated_at TEXT`
  - `last_cursor TEXT`
  - `last_cursor_order INTEGER`
  - `tombstone_retained_until TEXT NULL`
  - `shadow_updated_at TEXT`
  - `PRIMARY KEY (user_id, collection, record_id)`

#### 2) compaction metadata
- **修改表**：`shadow_sync_collections`
- **新增列**
  - `compaction_floor_cursor TEXT NULL`
  - `compaction_floor_cursor_order INTEGER NULL`
  - `last_compacted_at TEXT NULL`

#### 3) compaction runs
- **表**：`sync_compaction_runs`
- `run_id TEXT PRIMARY KEY`
- `user_id TEXT NOT NULL`
- `collection TEXT NOT NULL`
- `status TEXT NOT NULL`
- `cutoff_cursor_order INTEGER NOT NULL`
- `floor_cursor TEXT NULL`
- `floor_cursor_order INTEGER NULL`
- `mutations_scanned INTEGER NOT NULL`
- `mutations_deleted INTEGER NOT NULL`
- `records_materialized INTEGER NOT NULL`
- `started_at TEXT NULL`
- `completed_at TEXT NULL`
- `error_code TEXT NULL`
- `error_message TEXT NULL`

### 写路径变化
- **文件**：修改 `platform/cloudflare/src/handlers/sync-push.ts`
- 每个 accepted mutation 除了 append `shadow_sync_mutations` 外，还要同步 upsert `shadow_sync_record_state`
- 不能分叉 validation；继续复用 `src/utils/astra/sync-push.ts`

### 新 repair API
- **文件**：
  - 修改 `src/types/auth.ts`
  - 修改 `src/utils/astra/account.ts`
  - 新增 `platform/cloudflare/src/handlers/sync-repair.ts`
- **路由**：`POST /v1/sync/repair`
- **请求**
  - 指定要 repair 的 collections
- **响应**
  - collection full snapshot
  - latest cursor
  - compaction floor
- **客户端语义**
  - 这是“replace local from cloud”，不是 merge
  - 用于：
    - `CURSOR_EXPIRED`
    - manual repair
    - local reset 后重建

### sync-pull 语义变化
- **文件**：修改 `platform/cloudflare/src/handlers/sync-pull.ts`
- 当请求 cursor 落在 `compaction_floor_cursor` 之前：
  - 返回新错误：`CURSOR_EXPIRED`
  - 不再静默丢 delta
- **兼容策略**
  - 只有在 extension/web repair client 已上线后，才允许在生产发出 `CURSOR_EXPIRED`

### compaction 算法
1. 仅对 `shadow_sync_record_state` 已完整维护的 collection 启用
2. 以 `(user_id, collection)` 为粒度排队
3. 选取 retention 窗口之前的 mutation
4. 更新 `shadow_sync_collections.compaction_floor_*`
5. 删除 floor 之前、且已被 materialized state 覆盖的 mutation rows
6. 保留 tombstone 到 `tombstone_retained_until`
7. 记录 `sync_compaction_runs`

### 为什么不引入 Durable Objects
- compaction / repair 是离线生命周期任务，不是 request-path 强协调
- 当前问题是“长期存储与恢复”，不是“多端实时串行化”
- D1 + Queue + per-user collection idempotency 足够

### replay / repair / lifecycle maturity 还要补的内容
- operator dry-run/apply compaction
- repair success/failure metrics
- `CURSOR_EXPIRED` count、repair request count
- lifecycle backlog / failure surfacing 进 `platform-observability.ts`

### Done when
- materialized state 是每次 sync push 后的稳定读模型
- repair route 可重建任一 collection
- compaction 可 dry-run、可 apply、可观测
- sync pull 不再需要无限保留全部 mutation 历史

---

## Phase E — 移动入口继续以 Web/PWA + iOS bridge 为主，不纳入 Android/更重移动形态

### 结论
**本阶段不要纳入 Android 或 full native mobile。**

### 原因
- `docs/investigations/support-matrix-2026-q2.md` 仍将 iOS shell 标为 experimental
- `ios/README.md` 明确当前是 host shell + bridge，不是完整移动产品
- 若现在并行 Android/full native，会新增：
  - 第二套 session owner
  - 第二套 storage lifecycle
  - 第二套 sync repair UX
- 这会直接和本阶段要补的 lifecycle maturity 冲突

### 本阶段移动只做什么
1. 保持 Web/PWA 为 portable entry
2. 对现有 iOS bridge 做真实设备验证与 smoke hardening
3. 若验证结果改善，再更新 support matrix / claim language
4. 必要时只修 bridge bug，不扩 native product scope

### 不做
- Android app
- native session materialization
- shared keychain sync
- native cloud asset console
- full mobile onboarding rewrite

### Done when
- Web/PWA 在 mobile viewport 下可完成 summary/export/delete/repair
- iOS bridge 验证结果被文档化
- 对外 claim 仍不越过 current support matrix

---

## 3.6 现在明确不该做的事

1. **不做 full auth login / session issuance migration**
   - 不迁 `POST /v1/auth/session`
   - 不迁 `POST /v1/auth/anonymous`

2. **不引入 Durable Objects**
   - 除非后续证据证明 D1 + Queue 无法承载真实 per-user coordination

3. **不在 Node 与 Worker 各造一套 lifecycle 系统**
   - export/delete/compaction/repair 的 authoritative 实现只放在 continuity Cloudflare data plane

4. **不重复做已完成 web control-plane**
   - 不再把 import backlog、assets、IndexedDB lifecycle 当主 gap

5. **不把 Android/full native 和本阶段并行**
   - 先补 continuity lifecycle，再谈更重移动形态

# 4. **File-by-file impact**

## 文档

### `docs/investigations/cloudflare-next-phase-master-plan-2026-04-10.md`
- **修改**
  - 增加 2026-04-11 之后的新阶段章节
  - 明确本阶段只继续到 auth/session validation/revoke，不到 issuance
  - 把 export/delete/retention、compaction、repair、mobile strategy 写成下一阶段主轴
- **原因**
  - 该文档是当前 master plan 起点
- **依赖**
  - 先完成本计划里的边界决策

### `docs/specs/cloudflare-platform.md`
- **修改**
  - route ownership 增补：
    - `GET /v1/auth/session`
    - `DELETE /v1/auth/session`
    - `GET /v1/account/summary`
    - lifecycle routes
    - `POST /v1/sync/repair`
  - 明确 continuity domain 的下一步 authoritative 边界
  - 再次写死 non-goal：no login/session issuance migration, no DOs
- **依赖**
  - Phase A/B/C 路由设计定稿后

### `docs/specs/cross-device-sync.md`
- **修改**
  - 增补：
    - repair contract
    - `CURSOR_EXPIRED`
    - export/delete/retention policy
    - compaction floor / tombstone retention
- **依赖**
  - Phase C/D contract 定稿后

### `docs/specs/device-management.md`
- **修改**
  - 标记 `GET /v1/auth/session`、`DELETE /v1/auth/session` 的 Worker cutover strategy
  - 保持 `POST /v1/auth/session` 仍 Node-owned
- **依赖**
  - Phase A 设计定稿后

### `docs/specs/web-pwa-companion.md`
- **修改**
  - 增加 account summary / data lifecycle / repair surfaces
  - 明确这些仍是 web control-plane，不是 native handoff owner
- **依赖**
  - Phase B/C/D UI contract 定稿后

### `docs/cloudflare-platform-ops-runbook.md`
- **修改**
  - 新 migration apply order：
    - `0500_account_usage_shadow.sql`
    - `0600_account_data_lifecycle.sql`
    - `0700_sync_lifecycle.sql`
  - 增加 auth-session native rollout
  - 增加 export/delete/compaction/repair operator runbook
- **依赖**
  - SQL schema 与 env flags 定稿后

### `ios/README.md`
- **修改**
  - 仅更新 validation checklist / status wording
- **原因**
  - 本阶段 mobile 只做 validation，不扩产品面
- **依赖**
  - Phase E 验证结果

### `docs/investigations/support-matrix-2026-q2.md`
- **条件修改**
  - 仅在 iOS 验证证据足够时调整描述
- **默认**
  - 若无新证据，不改 support level

---

## 共享 contracts / clients

### `src/types/auth.ts`
- **修改**
  - 新增：
    - `AstraAccountSummarySchema`
    - `AstraDataExportJobSchema`
    - `AstraDataDeleteJobSchema`
    - `AstraSyncRepairResponseSchema`
    - 新 status enums
  - 若启用 compaction：
    - 新 error code support（至少文档化 `CURSOR_EXPIRED` 对应 payload）
- **原因**
  - server / Worker / web 的共享 contract source of truth
- **依赖**
  - 所有新 route contract 定稿后

### `server/types.ts`
- **修改**
  - 对齐 auth/account/lifecycle/repair 的 server-side types
- **原因**
  - Node 与 shared type 对齐
- **依赖**
  - `src/types/auth.ts`

### 新增 `src/utils/astra/session-token.ts`
- **新增**
  - shared parse/verify claims helper
- **原因**
  - 避免 Worker 与 Node 分叉 token logic
- **依赖**
  - 先验证 `server/auth.ts` 当前 token format

### `src/utils/astra/account.ts`
- **修改**
  - 新增 client methods：
    - `fetchAstraAccountSummary`
    - `createAstraDataExportJob`
    - `fetchAstraDataExportJob`
    - `createAstraDataDeleteJob`
    - `fetchAstraDataDeleteJob`
    - `repairAstraSyncState`
- **原因**
  - web/control-plane 复用同一 HTTP adapter
- **依赖**
  - 新 shared schemas 与 route contracts

---

## Node relay / mirror

### `server/auth.ts`
- **修改**
  - 改为复用 `src/utils/astra/session-token.ts`
- **原因**
  - Node/Worker 一致 token verification
- **依赖**
  - shared token helper 先落地

### `server/user-store.ts`
- **修改**
  - 新增 usage shadow mirror hook
  - 新增 `getAccountSummary(...)`
  - 继续作为 summary 的 authoritative baseline
- **原因**
  - Phase B 需要 Node summary baseline
- **依赖**
  - `server/types.ts`、`src/types/auth.ts`

### `server/index.ts`
- **修改**
  - 新增 `GET /v1/account/summary`
  - 现有 `/v1/auth/session` GET/DELETE 保持 contract 不变
- **原因**
  - 给 Worker summary route 提供 proxy/shadow/native baseline
- **依赖**
  - `server/user-store.ts#getAccountSummary`

### `server/cloudflare-shadow.ts`
- **修改**
  - mirror `shadow_user_usage`
  - mirror summary-related metadata if needed
  - backfill `shadow_sync_record_state` initial population hook
- **原因**
  - D1 native summary 与 lifecycle read 依赖 shadow completeness
- **依赖**
  - `0500/0700` schema

### `server/cloudflare-shadow-cli.ts`
- **修改**
  - audit/verify/backfill 增补：
    - `shadow_user_usage`
    - `shadow_sync_record_state`
- **原因**
  - 新的 D1 native surfaces必须可对账
- **依赖**
  - SQL migration 与 repo helper

---

## Cloudflare schema / repos / handlers

### 新增 `platform/cloudflare/sql/0500_account_usage_shadow.sql`
- **新增**
  - `shadow_user_usage`
- **原因**
  - account summary native read 依赖 usage shadow

### 新增 `platform/cloudflare/sql/0600_account_data_lifecycle.sql`
- **新增**
  - `account_export_jobs`
  - `account_data_delete_jobs`
- **原因**
  - export/delete lifecycle job persistence

### 新增 `platform/cloudflare/sql/0700_sync_lifecycle.sql`
- **新增**
  - `shadow_sync_record_state`
  - `sync_compaction_runs`
  - `ALTER shadow_sync_collections ... compaction_floor_*`
- **原因**
  - repair/export/compaction 的核心数据面

### `platform/cloudflare/src/types/shadow-state.ts`
- **修改**
  - 新增 row types：
    - `ShadowUserUsageRow`
    - `ShadowSyncRecordStateRow`
    - `AccountExportJobRow`
    - `AccountDataDeleteJobRow`
- **原因**
  - D1 repo/type alignment

### 新增 `platform/cloudflare/src/repositories/user-usage.ts`
- **新增**
  - usage upsert/read helpers
- **原因**
  - summary native read

### 新增 `platform/cloudflare/src/repositories/account-lifecycle.ts`
- **新增**
  - export/delete job CRUD
  - status transition helpers
- **原因**
  - lifecycle queue / handler 复用

### `platform/cloudflare/src/repositories/sync.ts`
- **修改**
  - 每次 mutation upsert `shadow_sync_record_state`
  - compaction floor read/write
  - repair snapshot reads
  - compaction candidate scans
- **原因**
  - lifecycle maturity 核心仓储逻辑
- **依赖**
  - `0700_sync_lifecycle.sql`

### 新增 `platform/cloudflare/src/lib/session-auth.ts`
- **新增**
  - authoritative Worker auth/session validation helper
- **原因**
  - 替换各 handler 内部的 Node auth gate fetch

### 新增 `platform/cloudflare/src/handlers/auth-session.ts`
- **新增**
  - `GET /v1/auth/session`
  - `DELETE /v1/auth/session`
- **原因**
  - Phase A 主交付

### 新增 `platform/cloudflare/src/handlers/account-summary.ts`
- **新增**
  - `GET /v1/account/summary`
- **原因**
  - summary proxy/shadow/native route

### 新增 `platform/cloudflare/src/handlers/account-export.ts`
- **新增**
  - `POST /v1/account/export`
  - `GET /v1/account/export/:jobId`
- **原因**
  - export lifecycle API

### 新增 `platform/cloudflare/src/handlers/account-delete.ts`
- **新增**
  - `POST /v1/account/cloud-data-delete`
  - `GET /v1/account/cloud-data-delete/:jobId`
- **原因**
  - collection-level cloud delete

### 新增 `platform/cloudflare/src/handlers/sync-repair.ts`
- **新增**
  - `POST /v1/sync/repair`
- **原因**
  - `CURSOR_EXPIRED` 后的恢复路径

### `platform/cloudflare/src/handlers/device-revoke.ts`
- **修改**
  - 改用 local Worker auth helper
- **原因**
  - 去掉 Node auth gate 依赖
- **依赖**
  - `lib/session-auth.ts`

### `platform/cloudflare/src/handlers/sync-bootstrap.ts`
- **修改**
  - 改用 local Worker auth helper
  - compare path 不再用 request token heuristic 作为 authoritative basis
- **原因**
  - Phase A auth consolidation
- **依赖**
  - `lib/session-auth.ts`

### `platform/cloudflare/src/handlers/sync-push.ts`
- **修改**
  - 改用 local Worker auth helper
  - accepted mutation 同步 upsert materialized record-state
- **原因**
  - Phase A + D
- **依赖**
  - `lib/session-auth.ts`、`repositories/sync.ts`

### `platform/cloudflare/src/handlers/sync-pull.ts`
- **修改**
  - 改用 local Worker auth helper
  - 增加 compaction floor / `CURSOR_EXPIRED`
- **原因**
  - Phase A + D
- **依赖**
  - `repositories/sync.ts`

### `platform/cloudflare/src/handlers/platform-observability.ts`
- **修改**
  - 增加 lifecycle job backlog/failure
  - 增加 compaction/repair metrics
  - 增加 retention governance snapshot
- **原因**
  - 新 lifecycle 不能只靠日志
- **依赖**
  - lifecycle tables

### `platform/cloudflare/src/env.ts`
- **修改**
  - 新增 env flags：
    - `AUTH_SESSION_READ_MODE`
    - `AUTH_SESSION_REVOKE_WRITE_MODE`
    - `ACCOUNT_SUMMARY_READ_MODE`
    - `ACCOUNT_EXPORT_RETENTION_DAYS`
    - `ACCOUNT_DATA_DELETE_GRACE_SECONDS`
    - `SYNC_TOMBSTONE_RETENTION_DAYS`
    - `SYNC_COMPACTION_BATCH_SIZE`
    - `SYNC_COMPACTION_DRY_RUN`
- **原因**
  - rollout / ops / governance

### `platform/cloudflare/src/context.ts`
- **修改**
  - 暴露新增 config fields
- **原因**
  - handlers / observability 读取

### `platform/cloudflare/src/routes.ts`
- **修改**
  - route dispatch 增补 auth-session/account-summary/export/delete/repair
- **原因**
  - public API wiring

### `platform/cloudflare/src/index.ts`
- **修改**
  - 绑定新 handlers / queue consumers
- **原因**
  - runtime entry wiring

### `platform/cloudflare/src/bindings.ts`
- **修改**
  - 若新增 lifecycle queue binding，则补类型
- **原因**
  - typed env

### 新增 `platform/cloudflare/src/queues/continuity-lifecycle.ts`
- **新增**
  - export/delete/compaction async worker
- **原因**
  - lifecycle jobs 不应阻塞 request path

---

## Web

### `web/src/lib/astra-web.ts`
- **修改**
  - 新增 summary/export/delete/repair wrappers
  - account workspace 优先读 summary，失败再 fallback 现有 fanout
  - 将本地 workspace reset 与 cloud repair 串联
- **原因**
  - 现有 web control-plane 是最佳承载面
- **依赖**
  - `src/utils/astra/account.ts`

### `web/src/app.tsx`
- **修改**
  - Account 页面：
    - session summary
    - continuity summary
    - export controls
    - delete controls
    - retention notes
  - Assets 页面：
    - per-collection repair action
    - compaction/repair status
- **原因**
  - 真正补齐 control-plane gap
- **依赖**
  - `astra-web.ts` 新 client methods

### `web/src/app.test.tsx`
- **修改**
  - 覆盖 summary fallback
  - lifecycle CTA / polling / repair flow
- **原因**
  - 新控制面主入口测试

---

## iOS / support matrix

### `ios/README.md`
- **条件修改**
  - 新 smoke checklist 只验证 bridge + web control-plane mobile rendering
- **原因**
  - 保持 bridge-first framing

### `src/utils/extension/ios-host-bridge.ts`
- **默认不改**
  - 仅在真实设备验证复现 bridge bug 时再动
- **原因**
  - 本阶段不是 native product 扩张

# 5. **Risks and migration**

## 5.1 D1 schema migration / rollout 风险
- 新 migration 顺序必须固定：
  1. `0500_account_usage_shadow.sql`
  2. `0600_account_data_lifecycle.sql`
  3. `0700_sync_lifecycle.sql`
- `0700` 只有在 `shadow_sync_record_state` 写路径已落地后，才允许启用 compaction apply

## 5.2 auth/session native 风险
- 若 Worker token verify 与 Node `server/auth.ts` 不一致，会产生误判
- **缓解**
  - 先抽共享 token helper
  - 用同一组 test vectors 覆盖 Node/Worker

## 5.3 relayBaseURL front-door 风险
- 若生产 session 的 `relayBaseURL` 仍指向 Node 而非 Worker front door，新 Worker auth/session 与 lifecycle routes 无法真正承接客户端
- **实施前必须验证**
  - 当前签发 session 的 `relayBaseURL` 指向哪里
- **验证方式**
  - staging 登录一次，检查 `AstraSession.relayBaseURL`

## 5.4 compaction 风险
- 一旦删除旧 mutation，没有 repair client 的旧客户端会失效
- **缓解**
  - 先落地：
    - record-state
    - repair route
    - client repair support
    - dry-run metrics
  - 最后才打开 destructive compaction

## 5.5 delete 风险
- cloud delete 必须通过 sync delta 正确传播；不能只删 materialized state
- **缓解**
  - delete job 必须生成 delete mutations
  - tombstone retention 不可短于 spec

## 5.6 rollback 风险
- auth/session GET/DELETE、account summary 都应保留 mode flag rollback
- export/delete/repair 是 additive route，无 legacy rollback；因此必须：
  - 先 staging
  - 再 limited user canary
  - 再 widen

# 6. **Implementation order**

1. **先更新 specs / runbook / master plan**
   - 把 auth/session 边界、summary contract、lifecycle scope、compaction/repair contract 写死  
   - **必须原子落地**

2. **抽 shared token helper**
   - 新增 `src/utils/astra/session-token.ts`
   - `server/auth.ts` 改为复用
   - 加 Node/Worker 共用测试向量

3. **落 `0500_account_usage_shadow.sql` + usage repo**
   - 补 `shadow_user_usage`
   - 扩 `server/cloudflare-shadow.ts` / CLI audit/backfill

4. **实现 Worker local auth helper，但先不切 public route**
   - 让 `device-revoke.ts` / `sync-bootstrap.ts` / `sync-push.ts` / `sync-pull.ts` 在 compare mode 中可并行验证
   - 先收 parity 数据

5. **实现 `GET /v1/auth/session` Worker route**
   - 先 `shadow`
   - 再 `native`
   - 通过后把 continuity handlers 切到 local auth helper

6. **实现 `DELETE /v1/auth/session` Worker route**
   - D1 revoke + Node mirror-back
   - 保持 guarded 503 语义与现有 write seam 一致

7. **实现 Node baseline `GET /v1/account/summary`**
   - `server/user-store.ts#getAccountSummary`
   - `server/index.ts` 新 route
   - 共享 schema/client 一起落地

8. **实现 Worker `GET /v1/account/summary`**
   - `proxy -> shadow -> native`
   - web 侧先 summary-first / fanout-fallback

9. **落 `0600_account_data_lifecycle.sql` + lifecycle queue + export routes**
   - 先 export
   - 再 web download/status UI
   - 此步可独立测试

10. **实现 collection-level cloud delete**
    - 先 job model
    - 再 queue consumer 生成 delete mutations
    - 再 web UI
    - **这一步与 export 不是原子依赖，但 delete 必须在 record-state 之前只做小规模 canary**

11. **落 `0700_sync_lifecycle.sql` + record-state 写路径**
    - `sync-push.ts` accepted path 同步维护 `shadow_sync_record_state`
    - 先不开 compaction

12. **实现 `POST /v1/sync/repair`**
    - web/extension client support 必须先于 `CURSOR_EXPIRED`
    - 若 extension sync client 尚未接入，先只让 web 使用 manual repair

13. **实现 compaction dry-run**
    - 只记录 candidate / floor / deletion counts
    - 打通 observability 与 runbook

14. **在 client support 完成后，启用 destructive compaction**
    - 先 staging
    - 再 limited canary
    - 最后 wider rollout

15. **完成 web control-plane 收尾**
    - Account / Assets 接 summary/export/delete/repair
    - mobile viewport 验证

16. **只做 iOS bridge validation / docs update**
    - 不启动 Android / full native workstream

## 实施中必须先验证的未知项
- `server/auth.ts` 的 token format/verify 是否可无改动迁到 Worker crypto
- 生产 `relayBaseURL` 是否已指向 Worker front door
- extension 现有 sync client 的 call sites 在哪些文件；必须在发出 `CURSOR_EXPIRED` 前全部接入 repair handling

--- 

如果你愿意，我也可以把这份计划进一步压成一版 **“可直接落 issue/epic 的 phase-by-phase backlog”**。


> 💡 Continue this plan conversation with ask_oracle(chat_id: "下一阶段规划-33E477", new_chat: false)