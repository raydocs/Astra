# Oracle Plan

# 1. **Summary**

下一阶段应当把 Astra 推进到 **“Worker/D1 成为 auth/session/device 的完整运行时权威”**，但边界只到 **`POST /v1/auth/session`、`POST /v1/auth/anonymous`、现有 GET/DELETE refresh/revoke、device-bound session persistence 与 relayBaseURL/front-door 一致性**；**不**把 `account/billing/translate` 一并迁走，**不**做 auth 现代化（SSO/MFA/passkey/密码体系重写），**不**把 Android 或更重原生移动纳入同阶段。原因是：continuity 阶段已把 session validation/revoke、account summary、lifecycle、repair/compaction 与 Web/PWA control-plane 补齐，当前真正剩下的系统性缺口就是“**签发仍由 Node + file DB 拥有，导致 Cloudflare 前门并未闭环**”；而移动侧仍应坚持 **Web/PWA + iOS bridge-first**，等 auth authority 稳定后再评估更重形态。

# 2. **Current-state analysis**

## 2.1 当前与本次变更直接相关的职责边界

### Cloudflare/Worker 已完成的 auth continuity 基线
从当前代码看，Worker 已经能在 continuity 域内承担：

- `GET /v1/auth/session` native validation/read（已存在测试 `platform/cloudflare/src/handlers/auth-session.test.ts`）
- `DELETE /v1/auth/session` native current-session revoke
- continuity handlers 改为本地 `validateShadowSession(...)`
- `GET /v1/account/summary`
- `POST /v1/sync/repair`
- export/delete lifecycle
- sync materialized state + compaction

这意味着 **验证、撤销、control-plane、repair/lifecycle 已经不是下一阶段主缺口**。

### 仍由 Node authoritative 拥有的 auth issuance
从 `server/index.ts`、`server/user-store.ts` 可见：

- `POST /v1/auth/session`
  - `server/index.ts -> handleAuthSession(POST)`
  - `users.validateCredentials(...)`
  - `users.issueBoundSession(...)`
  - `server/auth.ts` 签 token
  - `server/user-store.ts` 落 file DB `users/devices/sessions`
  - `server/cloudflare-shadow.ts` 再 mirror 到 D1
- `POST /v1/auth/anonymous`
  - `handleAnonymousAuth(...)`
  - `findAnonymousUserByInstallId(...) / createAnonymousUser(...)`
  - `issueBoundSession(...)`
  - 同样是 Node file DB authoritative，再 mirror 到 D1

### Node-owned 邻接路径仍依赖 file DB session/device
`server/index.ts` 中以下路由都仍通过 `requireAuthenticatedSession(...)` 走本地 `FileUserStore.getSessionContext(...)`：

- `GET /v1/account`
- `GET /v1/account/usage`
- `PATCH /v1/account/plan`
- `POST /v1/billing/*`
- `POST /v1/translate`
- 以及 Node 版本的 `/devices`、`/sync/*`

所以只要 issuance 还停在 Node、或 Worker issuance 无法把 session/device 同步回 Node，**Cloudflare 前门就不是真正闭环**。

## 2.2 当前共享契约与可复用点

必须复用，不应重造：

- `src/utils/astra/session-token.ts`
  - 已是 Node+Worker 共用 session token helper 起点
- `src/types/auth.ts`
  - `AstraSessionSchema`、device/session/account contract source of truth
- `server/types.ts`
  - server-side `ValidatedSessionContext`、`ServerSessionRecord`、`ServerDeviceRecord`
- `platform/cloudflare/src/lib/session-auth.ts`
  - Worker 本地 session/device validation 已成立
- `server/cloudflare-shadow.ts` + `server/cloudflare-shadow-cli.ts`
  - 现有 Node→D1 mirror、audit、backfill 流程可扩展
- `platform/cloudflare/src/handlers/auth-session.ts`
  - 已有 GET/DELETE auth-session seam，可继续扩成完整 auth authority handler family
- `web/src/lib/astra-web.ts`
  - web 端 create/refresh/revoke session 已有明确入口
- `src/utils/astra/auth.ts`（未展开，需实现前验证）
  - 预计仍是 extension/shared auth client 主入口

## 2.3 当前阻塞“full auth/session authority”的真实问题

### 1) D1 还没有 credential authority
`platform/cloudflare/sql/0100_auth_session_shadow.sql` 只有：

- `shadow_users`
- `shadow_auth_sessions`

没有 password/credential row，因此 Worker 不能独立完成 `POST /v1/auth/session`。

### 2) anonymous issuance 仍依赖 Node 生成 identity
`server/user-store.ts#createAnonymousUser(...)` 目前在 Node 内部生成匿名 email/password hash/installId 绑定，Worker 无法独立创建且保证与 Node rollback 兼容。

### 3) issuance 没有可安全 rollback 的 mirror-back 机制
现有 `device-revoke` / `sync-push` 能用“D1 authoritative + Node mirror-back”，因为 public Node route 本身可复用。  
但 `POST /v1/auth/session` public route 的语义是“重新校验 credentials 并新签发一个 session”，**不能**拿来做 mirror-back 同步同一个 sessionId/token。

### 4) `relayBaseURL` / front-door 一致性仍可能悬空
`server/user-store.ts -> buildRelaySession(..., env.publicBaseURL)` 表明 session 返回的 `relayBaseURL` 仍由 Node env 决定。  
如果这个值不是 Worker front door，那么即使 Worker auth authority 做完，客户端也可能仍绕回 Node。

## 2.4 结论：这是有边界的 auth/session 子系统重构，不是小补丁

**不适合**只在 Worker 增加两个 POST handler 就结束。  
要让“full auth/session authority”成立，必须一并解决：

- credential 数据面
- anonymous identity creation
- issuance mirror-back / rollback safety
- relayBaseURL/front-door source
- first-party client issue/retry semantics

但这仍然是 **限定在 auth/session/device 边界内的子系统重构**，不是 repo-wide 重写。

# 3. **Design**

## 3.1 决策：本阶段要继续做 full auth/session authority，但只做到 auth/session/device 边界

### 明确决策
**应当在本阶段推进 full auth/session issuance migration。**

### 但只做到以下范围
纳入本阶段：

- `POST /v1/auth/anonymous`
- `POST /v1/auth/session`
- 已完成的 `GET /v1/auth/session` / `DELETE /v1/auth/session`
- session/device D1 authoritative persistence
- Node mirror compatibility for remaining Node-owned routes
- relayBaseURL/front-door 一致性
- first-party web/extension auth client 的 issuance/retry/cutover

**不纳入本阶段：**

- `account` / `billing` / `translate` authority migration
- auth product modernization（SSO/passkey/MFA/password reset/self-serve password change）
- token format 大改或 opaque-token 重做
- Node file DB 全面退场
- Android/native mobile expansion

### 原因
继续停留在“GET/DELETE 已迁、POST issuance 仍 Node-owned”的状态，会长期保留最关键的双权威裂缝；而 continuity 其他成熟度问题已经在当前完成态里补过了，auth issuance 才是下一阶段最值得投入的主线。

---

## 3.2 Auth authority foundation

### 目标
让 Worker 具备独立完成 issuance 的全部前置条件，同时保证 rollback 仍是“按 route 配置切回”。

### 新/修改持久化组件

#### 1) D1 credential table
- **文件**：新增 `platform/cloudflare/sql/0800_auth_issuance_authority.sql`
- **新增表**：`shadow_user_credentials`
- **字段**
  - `user_id TEXT PRIMARY KEY`
  - `credential_kind TEXT NOT NULL CHECK (credential_kind IN ('password'))`
  - `password_hash TEXT NOT NULL`
  - `password_hash_alg TEXT NOT NULL CHECK (password_hash_alg IN ('sha256_v1'))`
  - `updated_at TEXT NOT NULL`
  - `shadow_updated_at TEXT NOT NULL`
- **依赖**
  - `FOREIGN KEY (user_id) REFERENCES shadow_users(id)`

**为什么单独成表：**  
当前 `shadow_users` 已被 account/session read 用作低敏 profile row；credential material 不应混进 profile table。

#### 2) install lookup index
- **同一 migration**
- **新增索引**：`idx_shadow_users_install_id_unique`
- **列**：`shadow_users.install_id`

**为什么需要：**  
anonymous issuance 的 lookup key 是 `installId/deviceId` 兼容路径，没有 install lookup 就无法安全原生接管 `POST /v1/auth/anonymous`。

#### 3) issuance idempotency ledger
- **同一 migration**
- **新增表**：`auth_issue_requests`
- **字段**
  - `request_key TEXT PRIMARY KEY`
  - `route_kind TEXT NOT NULL CHECK (route_kind IN ('anonymous', 'session'))`
  - `user_id TEXT NULL`
  - `install_id TEXT NULL`
  - `device_id TEXT NOT NULL`
  - `session_id TEXT NOT NULL`
  - `node_mirror_status TEXT NOT NULL CHECK (node_mirror_status IN ('pending', 'completed', 'failed'))`
  - `created_at TEXT NOT NULL`
  - `last_attempt_at TEXT NOT NULL`
  - `completed_at TEXT NULL`
  - `failed_at TEXT NULL`
  - `error_code TEXT NULL`
  - `error_message TEXT NULL`
  - `shadow_updated_at TEXT NOT NULL`

**为什么必须有这张表：**  
`POST /auth/session` 不是天然幂等写；沿用当前 write seam 的“ambiguous mirror-back -> 503 retry”模式，必须有 issuance ledger 才能让 first-party client 用同一个 key 安全重试，而不创建重复 session。

### 共享纯逻辑模块

#### 1) 扩展 `src/utils/astra/session-token.ts`
- **保留**已有 parse/verify helper
- **新增**：
  - claims builder
  - deterministic sign/verify test vectors
  - token format version constants
- **要求**
  - Node 签发与 Worker 签发必须生成完全兼容的 token
  - `AstraSessionClaims` 保持与现有验证逻辑兼容

#### 2) 新增 shared credential hash helper
- **文件**：新增 `src/utils/astra/credential-hash.ts`
- **职责**
  - 复用当前 `server/user-store.ts` 的 sha256 password hash 语义
- **原因**
  - Worker-native login 不能复制一份独立 hash 逻辑
- **边界**
  - 本阶段只复刻现有 `sha256_v1`
  - 不做 hash 升级/轮换

#### 3) 新增 shared anonymous identity helper
- **文件**：新增 `src/utils/astra/anonymous-identity.ts`
- **职责**
  - 定义匿名 user id / email / placeholder password material 的生成规则
- **原因**
  - Worker 创建新 anonymous user 后，Node mirror-back 需要落同一身份，不应依赖 Node 再随机生成一次

### Node shadow/backfill 扩展

#### 修改 `server/cloudflare-shadow.ts`
新增 mirror 能力：

- `mirrorUserCredential(...)`
- `backfillUserCredentials(...)`

触发点：

- `FileUserStore.validateCredentials(...)` 成功时懒镜像/修复
- seed user load/backfill
- anonymous user creation 不写 credential table；authenticated user 写

#### 修改 `server/cloudflare-shadow-cli.ts`
audit/backfill 范围增加：

- `shadow_user_credentials`
- installId 唯一性检查
- auth issuance prerequisite completeness

### Node internal mirror-back API

#### 设计原则
Worker-native issuance **不**调用 public `POST /v1/auth/session` 作为 mirror-back；改为新增内部镜像端点，专门 upsert “已经由 Worker 签发好的” user/device/session。

#### 新内部路由
- **文件**：修改 `server/index.ts`
- **新增 internal 路由**
  - `POST /_internal/cloudflare/auth/issue/authenticated`
  - `POST /_internal/cloudflare/auth/issue/anonymous`

#### 鉴权
- 新共享 secret：
  - `ASTRA_PLATFORM_MIRROR_SECRET`
- Worker 调用时带固定 header，例如：
  - `Authorization: Bearer <mirror-secret>`

#### Node 侧新增方法
- **文件**：修改 `server/user-store.ts`
- **新增**
  - `upsertMirroredAuthenticatedIssue(...)`
  - `upsertMirroredAnonymousIssue(...)`

这些方法负责：

- 对 authenticated user：
  - 确认 user 已存在
  - upsert device
  - upsert session by `sessionId`
- 对 anonymous user：
  - 若 user 不存在，先插入完全由 Worker 生成的匿名 user record
  - 再 upsert device/session
- 必须是幂等的：
  - 同一 `sessionId` 重放不重复生成第二个 session
  - 同一 `deviceId` 只更新 lastSeen/metadata

### rollback 语义
本阶段的 rollback 目标不是“撤销所有已发出去的 token”，而是：

- `AUTH_ANONYMOUS_ISSUE_MODE` / `AUTH_SESSION_ISSUE_MODE` 切回 `proxy`
- 已成功 mirror-back 的 Worker-issued session 继续可被 Node 验证
- 已失败且未 mirror-back 完成的 issuance 不返回成功，因此不会产生“客户端拿到 session 但 Node 不认”的长期悬空态

---

## 3.3 Worker-native `POST /v1/auth/anonymous`

### 为什么先做 anonymous
这是最小风险的 issuance seam：

- 不涉及 password credential lookup
- 只验证 install reuse / user creation / session issuance / Node mirror-back 链路
- 能先把 issuance idempotency 与 mirror-back 模式跑通

### 路由 ownership
- **配置项**
  - `AUTH_ANONYMOUS_ISSUE_MODE=proxy|shadow|native`

### 模式定义
#### `proxy`
- 直接代理 Node 现有 `POST /v1/auth/anonymous`

#### `shadow`
- live response 仍来自 Node
- Worker 只做：
  - request body shape validation
  - installId/deviceId lookup preflight
  - D1 prerequisite completeness检查
  - 记录 parity/operator event
- **不创建第二个匿名 session**

#### `native`
- Worker 读取请求体：
  - `deviceId` / `installId`
  - coarse device metadata
- 数据流：
  1. 查 `shadow_users.install_id`
  2. 若存在 anonymous user，复用
  3. 若不存在，Worker 生成新 anonymous user row
  4. upsert `shadow_devices`
  5. 生成新 `shadow_auth_sessions`
  6. 写 `auth_issue_requests(node_mirror_status='pending')`
  7. 调 Node internal mirror-back
  8. 成功则标记 `completed`
  9. 返回 `AstraSession`

### 并发与重试
#### 触发
- extension install/bootstrap
- 可能的 web guest bootstrap（需先确认当前是否真实使用）

#### 幂等
- first-party clients 必须发送 `Idempotency-Key`
- request key scope：
  - `anonymous:<installId or deviceId>:<deviceId>:<idempotencyKey>`

#### out-of-order / duplicate
- 相同 key 重试：
  - 若 ledger `completed`，返回同一 session
  - 若 `pending`，重新尝试 Node mirror-back
  - 若 `failed`，返回上次失败并要求新 key
- 不同 key 的重复请求：
  - 允许创建多个 active anonymous session，行为与当前 Node issuance 一致

### 错误契约
保持与现有匿名 route 外部语义兼容：

- 缺 device/install id -> `400 DEVICE_REQUIRED`（若当前 Node contract 不是此 code，实施前需验证）
- rate limit -> 继续沿用 Node `QUOTA_EXCEEDED`
- mirror-back definitive reject -> 返回 Node error body/status
- mirror-back ambiguous -> `503 UPSTREAM_UNAVAILABLE`，并要求 first-party client 用同一 `Idempotency-Key` 重试

### Done when
- `POST /v1/auth/anonymous` 可在 Worker `native` 稳定签发
- retry with same key 不产生重复 session
- rollback 切回 `proxy` 后，native-issued anonymous session 仍能通过 Node-owned routes

---

## 3.4 Worker-native `POST /v1/auth/session`

### 路由 ownership
- **配置项**
  - `AUTH_SESSION_ISSUE_MODE=proxy|shadow|native`

### 模式定义
#### `proxy`
- 完全沿用当前 `server/index.ts -> handleAuthSession(POST)`

#### `shadow`
- live response 仍由 Node 返回
- Worker 异步做：
  - credential row lookup
  - password hash verify preflight
  - device upsert preflight
  - relayBaseURL/front-door consistency compare
- **不并行签第二个 session**

#### `native`
数据流：

1. Worker 解析 body（email/password/device metadata）
2. 查询 `shadow_users` by normalized email
3. 查询 `shadow_user_credentials`
4. 用 shared `credential-hash.ts` 验证 password
5. upsert `shadow_devices`
6. 生成新的 `sessionId`
7. 用 shared `session-token.ts` 签 token
8. 插入 `shadow_auth_sessions`
9. 写 `auth_issue_requests(node_mirror_status='pending')`
10. 调 Node internal mirror-back upsert 同一 user/device/session
11. 成功后返回 `AstraSession`

### 为什么不改 public contract
保持以下对外接口不变：

- path 仍是 `/v1/auth/session`
- 返回仍是 `AstraSession`
- `AstraSessionClaims` shape 不变
- `sessionToken` 仍是 bearer token
- `GET /v1/auth/session` / `DELETE /v1/auth/session` 行为不变

### relayBaseURL/front-door 处理
这是本阶段必须一并解决的设计点。

#### 新配置
- **文件**：修改 `server/types.ts`、`server/config.ts`
- **新增 env**
  - `sessionPublicBaseURL`（命名可调整，但语义必须固定）
- 规则：
  - 签发到 session/token claims 的 `relayBaseURL` 使用 `sessionPublicBaseURL`
  - 若未设置，fallback 到现有 `publicBaseURL`

#### Worker 侧
- Worker-native issuance 返回的 `relayBaseURL` 必须与 Node proxy issuance 完全一致
- staging/prod 开启 native 前，`sessionPublicBaseURL` 必须已指向 Worker front door

### first-party client 变更
#### Web
- **文件**：`web/src/lib/astra-web.ts`
- `createWebSession(...)` 增加 `Idempotency-Key`
- 在收到 `503 mirror_back_commit_unknown` 时保留相同 key 重试

#### Extension/shared auth
- **文件**：`src/utils/astra/auth.ts`（需先验证现有实现）
- `POST /auth/session`
- `POST /auth/anonymous`
- 都要加 `Idempotency-Key`

#### Anonymous bootstrap caller
- **文件**：`src/entrypoints/background/index.ts`（需先验证 call site）
- install/bootstrap 使用稳定 request key 直到成功/清理

### 错误契约
**保持当前 contract，避免迁移期再改 taxonomy。**

特别是：

- invalid credentials 若当前返回 `401 CONFIG_MISSING`，本阶段先保持原样  
  （理由：虽然不理想，但 auth authority 迁移期不混入 client-visible error normalization）
- 继续保留：
  - `SESSION_REQUIRED`
  - `DEVICE_REQUIRED`
  - `DEVICE_MISMATCH`
  - `SESSION_REVOKED`
  - `DEVICE_REVOKED`
  - `SESSION_EXPIRED`
  - `REAUTH_REQUIRED`

### Done when
- `POST /v1/auth/session` 在 Worker native 可稳定签发
- Worker-issued session 能立即访问仍由 Node-owned 的 `/account`、`/billing`、`/translate`
- Node 与 Worker 对同一 token 的 parse/verify 完全一致
- rollback 切回 `proxy` 不会让已签发 session 失效

---

## 3.5 Node compatibility layer：本阶段保留，不做 Node auth 全面退场

### 决策
本阶段 **不**把 Node 剩余路由的 auth validation 改成 D1-first，也 **不**退掉 file DB session/device mirror。

### 原因
当前 Node 仍是：

- `/account`
- `/billing`
- `/translate`

的 authoritative runtime；让这些路由继续依赖本地 file DB auth context，能最大程度保留稳定性。  
因此本阶段采用：

- **D1 authoritative issuance**
- **Node mirror-back compatibility**
- **Node file DB 作为剩余 Node 路由的兼容 auth cache**

而不是在同阶段再做 Node request-path D1 auth lookup。

### 结果
auth/session/device 域内的“权威签发/验证/撤销”完成后，Node 仍作为相邻域兼容层存在；这就是本阶段的合理止点。

---

## 3.6 Mobile strategy：继续 Web/PWA + iOS bridge-first，不纳入 Android/native 扩张

### 明确决策
**Android 或更重 native mobile 不应进入同一阶段。**

### 原因
当前仓库与文档边界仍然是：

- `docs/investigations/support-matrix-2026-q2.md`
  - Chrome/Chromium supported
  - Firefox beta
  - desktop Safari beta
  - iOS shell experimental
  - Android not supported
- `ios/README.md`
  - iOS 仍是 shell + bridge，不是 full native product
- `docs/specs/web-pwa-companion.md`
  - portable cloud/control-plane 是 web 边界，不是 native parity

而本阶段主风险与主价值都在 auth authority。并行拉 Android/native 只会把 backend cutover、session materialization、support claim 三件事绑死。

### 本阶段移动只做什么
1. Web/PWA 登录、刷新、登出、account/control-plane 在 mobile viewport 下继续可用
2. iOS shell + bridge 验证“auth authority cutover 后不回退到 Node direct baseURL”
3. 如有精力，仅做 Android Chrome/PWA smoke validation：
   - 只验证 mobile web auth/control-plane
   - **不**更新 support level
   - **不**引入 Android app/module

### Done when
- mobile Safari / mobile Chromium 上，Web/PWA auth + account control-plane 仍通
- iOS bridge 文档与 smoke checklist 覆盖新 front-door auth 行为
- support matrix 仍不宣称 Android/native parity

---

## 3.7 现在明确不该做的事

1. **不做 auth 产品现代化**
   - 不做 passkey / MFA / SSO / password reset 流程
2. **不改 token 模型**
   - 不做 opaque token、refresh token 双 token、token rotation 重写
3. **不把 account/billing/translate 一并迁成 Worker authority**
4. **不退掉 Node file DB compatibility mirror**
   - 这是下一阶段之后再评估的事
5. **不引入 Durable Objects**
   - 当前 auth issuance 不需要 per-user strong coordination actor
6. **不把 Android/native mobile 作为交付面**
7. **不顺手改登录错误码 taxonomy**
   - 若要改，单开 auth UX/API cleanup

# 4. **File-by-file impact**

## 4.1 新增/修改文档

### `docs/investigations/cloudflare-auth-authority-master-plan-2026-04-12.md`（新文件）
- **变化**：记录本阶段 master plan
- **原因**：这是 completed continuity 之后的新总计划，不应继续堆在上一阶段文档里
- **依赖**：本计划边界定稿后先落文档

### `docs/specs/cloudflare-platform.md`
- **变化**
  - route ownership 增加：
    - `POST /v1/auth/anonymous`
    - `POST /v1/auth/session`
  - 明确本阶段止点是 auth/session/device authority，不含 account/billing/translate authority
  - 写死 no DOs / no mobile expansion
- **依赖**：Phase A/B/C 设计定稿

### `docs/specs/device-management.md`
- **变化**
  - 更新 `POST /v1/auth/session`、`POST /v1/auth/anonymous` 的 Worker cutover note
  - 增加 Node mirror-back compatibility 语义
- **依赖**：auth issuance route 设计定稿

### `docs/specs/web-pwa-companion.md`
- **变化**
  - 更新 Web/PWA session rules：
    - issuance 仍走 `/v1/auth/*`
    - front-door `relayBaseURL` 必须指向 Worker
    - first-party auth create 需支持 retry with same idempotency key
  - 保持 mobile web 仅为 portable control-plane
- **依赖**：client cutover 设计定稿

### `docs/cloudflare-platform-ops-runbook.md`
- **变化**
  - migration order 增加 `0800_auth_issuance_authority.sql`
  - rollout flags 增加：
    - `AUTH_ANONYMOUS_ISSUE_MODE`
    - `AUTH_SESSION_ISSUE_MODE`
  - 记录 Node mirror-back secret、canary order、rollback order
- **依赖**：env/config 与 internal mirror endpoints 定稿

### `docs/investigations/support-matrix-2026-q2.md`
- **默认不改**
- **条件修改**
  - 仅在额外 mobile-web validation 证据足够时补一条验证说明
- **原因**：本阶段不改变 support claim

### `ios/README.md`
- **变化**
  - 仅更新 smoke/validation 项，强调 auth authority cutover 后仍是 bridge-first
- **依赖**：Phase D 完成

---

## 4.2 共享纯逻辑与 contracts

### `src/utils/astra/session-token.ts`
- **变化**
  - 扩到“Node+Worker 对称签/验”的 canonical helper
  - 增加固定 test vectors 入口
- **原因**：Worker issuance 必须与 Node token 完全兼容
- **依赖**：先验证 `server/auth.ts` 当前 token format

### `src/utils/astra/credential-hash.ts`（新文件）
- **变化**
  - 抽出现有 password hash/verify 纯逻辑
- **原因**：Worker login 不应复制 hash 实现
- **依赖**：实现前确认 `server/user-store.ts#hashPassword` 是否仍是唯一来源

### `src/utils/astra/anonymous-identity.ts`（新文件）
- **变化**
  - 定义 anonymous user identity 生成规则
- **原因**：Worker 创建 + Node mirror-back 要落同一 identity
- **依赖**：先确认 anonymous user 在 file DB 的最小必需字段

### `src/types/auth.ts`
- **变化**
  - 预计 public `AstraSession` contract 不变
  - 若引入 first-party auth issue retry code，需要补充 error code 文档化常量
- **原因**：尽量保持 public contract 稳定
- **依赖**：route contract 定稿
- **说明**：若不需要新增 schema，尽量不动此文件

---

## 4.3 Node relay / file DB / mirror

### `server/config.ts`
- **变化**
  - 新增 `sessionPublicBaseURL`
  - 新增 `platformMirrorSecret`
- **原因**：解耦 Node 自身 origin 与客户端 session front-door base
- **依赖**：先定 env naming

### `server/types.ts`
- **变化**
  - `RelayEnv` 增加：
    - `sessionPublicBaseURL`
    - `platformMirrorSecret`
- **原因**：server/config 与 route handlers 需要 typed env
- **依赖**：`server/config.ts`

### `server/auth.ts`
- **变化**
  - 改为复用增强后的 `src/utils/astra/session-token.ts`
  - 构建 session claims 时使用 `sessionPublicBaseURL`
- **原因**：Node-issued 与 Worker-issued token 必须一致
- **依赖**：shared token helper

### `server/user-store.ts`
- **变化**
  - 新增 mirror-back upsert 方法：
    - `upsertMirroredAuthenticatedIssue(...)`
    - `upsertMirroredAnonymousIssue(...)`
  - 现有 `issueBoundSession(...)` 继续保留给 Node proxy mode
  - 可能增加 helper：
    - `findUserByInstallId(...)`
    - `upsertMirroredDevice(...)`
    - `upsertMirroredSession(...)`
- **原因**：Worker native issuance 需要把 exact session/user/device 写回 file DB，保证 Node-owned routes 兼容
- **依赖**：anonymous identity helper、internal route payload shape

### `server/index.ts`
- **变化**
  - 新增 internal mirror-back handlers：
    - authenticated issue mirror
    - anonymous issue mirror
  - 用 `platformMirrorSecret` 保护
  - 现有 public `/v1/auth/session` 与 `/v1/auth/anonymous` 保持 proxy fallback baseline
- **原因**：public login route 不能承担 mirror-back 语义
- **依赖**：`server/user-store.ts` 新方法、secret config

### `server/cloudflare-shadow.ts`
- **变化**
  - mirror/backfill `shadow_user_credentials`
  - anonymous install uniqueness 校验
- **原因**：Worker issuance prerequisite 数据面
- **依赖**：`0800_auth_issuance_authority.sql`

### `server/cloudflare-shadow-cli.ts`
- **变化**
  - audit/backfill 增加 credential rows 与 install lookup
- **原因**：native issuance 前必须可审计
- **依赖**：shadow bridge 扩展

### `server/auth.test.ts`
- **变化**
  - 新增 Node vs Worker token compatibility vectors
- **原因**：签/验一致性是 auth authority 最核心风险之一

### `server/index.test.ts`
- **变化**
  - internal mirror-back endpoint 授权、幂等、anonymous create/upsert、session upsert
- **原因**：rollback 依赖 Node mirror compatibility

---

## 4.4 Cloudflare schema / repos / handlers

### `platform/cloudflare/sql/0800_auth_issuance_authority.sql`（新文件）
- **变化**
  - `shadow_user_credentials`
  - `idx_shadow_users_install_id_unique`
  - `auth_issue_requests`
- **原因**：credential authority + issuance retry safety
- **依赖**：文档与 repo layer 定稿

### `platform/cloudflare/src/repositories/users.ts`
- **变化**
  - 新增：
    - `getShadowUserByEmail(...)`
    - `getShadowUserByInstallId(...)`
    - `createShadowAnonymousUser(...)`
    - `upsertShadowUserCredential(...)`
    - `getShadowUserCredential(...)`
- **原因**：Worker issuance 需要 credential/install/user lookup
- **依赖**：`0800` schema

### `platform/cloudflare/src/repositories/sessions.ts`
- **变化**
  - 新增 issuance path 所需 insert/read helpers
  - 支持按 `sessionId` 幂等读取
- **原因**：POST issuance 不只是 GET/DELETE
- **依赖**：issuance ledger 与 auth-session handler

### `platform/cloudflare/src/repositories/devices.ts`
- **变化**
  - issuance 路径复用/扩展 device upsert
- **原因**：login/anonymous issue 都会触发 current device upsert

### `platform/cloudflare/src/repositories/auth-issue-requests.ts`（新文件）
- **变化**
  - `getAuthIssueRequest(...)`
  - `createPendingAuthIssueRequest(...)`
  - `markAuthIssueRequestCompleted(...)`
  - `markAuthIssueRequestFailed(...)`
- **原因**：idempotent retry safety
- **依赖**：`0800` schema

### `platform/cloudflare/src/lib/session-auth.ts`
- **变化**
  - 保持 validate/read helper
  - 补 issuance shared helpers：
    - build current session payload from shadow rows
- **原因**：GET/POST issuance 应共享 session response building，而不是分叉

### `platform/cloudflare/src/lib/node-mirror.ts`（新文件）
- **变化**
  - 封装 Worker->Node internal mirror-back 请求
- **原因**：auth issuance 与未来其他 internal mirrors 共用 secret/header/error handling
- **依赖**：Node internal endpoints

### `platform/cloudflare/src/handlers/auth-session.ts`
- **变化**
  - 在现有 GET/DELETE 基础上纳入 `POST /v1/auth/session`
  - 支持 `proxy|shadow|native`
  - 引入 issuance ledger 与 mirror-back
- **原因**：同一路由族统一维护 auth-session ownership
- **依赖**：credential repo、mirror helper、env flags

### `platform/cloudflare/src/handlers/auth-anonymous.ts`（新文件）
- **变化**
  - `POST /v1/auth/anonymous`
  - `proxy|shadow|native`
- **原因**：anonymous issuance 与 authenticated issuance 逻辑差异足够大，单独文件更清晰
- **依赖**：anonymous identity helper、user repo、mirror helper

### `platform/cloudflare/src/routes.ts`
- **变化**
  - 路由分发加入 `POST /v1/auth/anonymous`
  - `POST /v1/auth/session` 指向扩展后的 auth-session handler
- **原因**：public API wiring

### `platform/cloudflare/src/env.ts`
- **变化**
  - 新增：
    - `AUTH_ANONYMOUS_ISSUE_MODE`
    - `AUTH_SESSION_ISSUE_MODE`
    - `ASTRA_PLATFORM_MIRROR_SECRET`
    - 可选 `SESSION_PUBLIC_BASE_URL`（若 Worker 也需显式知道）
- **原因**：route rollout + mirror auth
- **依赖**：runbook 定稿

### `platform/cloudflare/src/context.ts`
- **变化**
  - 暴露新增 config fields
- **原因**：handlers 读取 rollout/config

### `platform/cloudflare/src/index.ts`
- **变化**
  - 注册新增 handler
- **原因**：runtime wiring

### `platform/cloudflare/src/handlers/platform-observability.ts`
- **变化**
  - observability 增加：
    - anonymous/session issuance route stats
    - mirror-back pending/failed counts
    - auth issue request backlog
- **原因**：issuance cutover 必须可运营，不靠日志猜

### `platform/cloudflare/src/handlers/auth-session.test.ts`
- **变化**
  - 补 `POST /v1/auth/session`:
    - proxy
    - shadow preflight
    - native success
    - invalid credentials
    - missing credential row fallback
    - mirror-back reject rollback
    - ambiguous mirror-back + same-key retry
- **原因**：这是阶段核心路由

### `platform/cloudflare/src/handlers/auth-anonymous.test.ts`（新文件）
- **变化**
  - 覆盖 install reuse/new anonymous create/idempotency/mirror-back rollback
- **原因**：anonymous 先行 canary 的主保障

---

## 4.5 First-party clients

### `src/utils/astra/auth.ts`
- **变化**
  - `POST /auth/session`、`POST /auth/anonymous` 增加 `Idempotency-Key`
  - 对 503 ambiguous mirror-back 保持同 key retry
- **原因**：Worker-native issuance correctness 依赖 client retry discipline
- **依赖**：auth issue request ledger 语义定稿
- **未知项**
  - 需先确认此文件是否仍是 extension/shared auth 主入口

### `src/entrypoints/background/index.ts`
- **变化**
  - anonymous bootstrap 调用加稳定 issuance key
- **原因**：extension install/bootstrap 是 anonymous issuance 的主要第一方调用方
- **依赖**：`src/utils/astra/auth.ts`
- **未知项**
  - 需先确认当前 bootstrap key 生命周期最合适的存储位置

### `src/utils/storage/auth.ts`
- **变化**
  - 若需要暂存 pending issuance retry key，则在此落地
- **原因**：浏览器/扩展 reload 后仍可完成同 key retry
- **依赖**：先确认 auth client 重试策略
- **说明**
  - 若 auth client 内部已能自管，不强制改此文件

### `web/src/lib/astra-web.ts`
- **变化**
  - `createWebSession(...)` 增加 `Idempotency-Key`
  - sign-in retry 保持同 key
  - `refresh/revoke` 无 contract 改动
- **原因**：Web/PWA 是当前 portable mobile entry
- **依赖**：Worker-native session issue contract

### `web/src/lib/astra-web.test.ts`
- **变化**
  - 覆盖 login request headers、503 retry 行为、front-door relayBaseURL continuity
- **原因**：mobile/web control-plane 不能因 auth cutover 回退

### `ios/README.md`
- **变化**
  - 只更新 auth/front-door validation checklist
- **原因**：iOS 仍非 auth owner

### `src/utils/extension/ios-host-bridge.ts`
- **默认不改**
- **原因**：本阶段不做 native auth/session materialization

---

## 4.6 Config / env / deployment files

### `platform/cloudflare/.dev.vars.example`
- **变化**
  - 新增 auth issue flags 与 mirror secret
- **原因**：local/staging rollout

### `platform/cloudflare/wrangler.jsonc`
- **变化**
  - 绑定新增 env vars
- **原因**：deploy wiring

### `server/.env.example`
- **变化**
  - 新增 `ASTRA_PLATFORM_MIRROR_SECRET`
  - 新增 `ASTRA_SESSION_PUBLIC_BASE_URL`（命名可调整）
- **原因**：Node external base 与 mirror auth

# 5. **Risks and migration**

## 5.1 最大风险：Worker-issued session 与 Node-owned routes 失配
### 风险来源
如果 Worker issuance 成功，但 Node mirror-back 未完成，而客户端又拿到了 session，`/account`、`/billing`、`/translate` 仍可能拒绝。

### 设计缓解
- Worker issuance 必须通过 internal mirror-back 完成后才返回成功
- ambiguous mirror-back 只返回 503，不返回 session
- first-party client 用相同 `Idempotency-Key` retry

## 5.2 credential material 进入 D1 的安全边界
### 风险来源
`password_hash` 进入 D1 是权限面扩大。

### 设计缓解
- 单独 `shadow_user_credentials` 表
- 不和 `shadow_users` 混存
- 本阶段只存现有 hash，不新增更高敏 secrets
- 实施前确认 D1 访问权限与备份策略满足当前运营要求  
  **验证方式**：对 Cloudflare bindings / operator access 做一次最小权限审查

## 5.3 relayBaseURL/front-door misconfiguration
### 风险来源
若 session claim 仍指向 Node origin，则 cutover 形同未做。

### 缓解
- 在 native canary 前，先落 `sessionPublicBaseURL`
- staging 登录后检查 `AstraSession.relayBaseURL`
- Web/PWA 与 extension 都要验证 sign-in 后后续请求是否落 Worker

## 5.4 anonymous install reuse race
### 风险来源
没有 installId 唯一约束时，并发 bootstrap 可能造多个匿名 user。

### 缓解
- `shadow_users.install_id` 唯一索引
- application path 先 lookup 后 insert
- 若 backfill 发现历史重复 installId，native cutover 前先人工/脚本修复

## 5.5 rollback 不是“删除已发 token”
### 风险来源
native issuance 一旦开始，系统中会存在 Worker-issued session。

### rollback 策略
- rollback 的定义是 route ownership 切回 `proxy`
- 只要 mirror-back 成功，这些 session 仍被 Node file DB 接受
- 因此 rollback 前提是 native path 不返回任何未完成 mirror-back 的 session

## 5.6 Unknowns that must be validated
1. `src/utils/astra/auth.ts` 与 `src/entrypoints/background/index.ts` 的实际 auth call sites  
   - **验证方式**：实现前 grep `/auth/session`、`/auth/anonymous`
2. `src/utils/astra/session-token.ts` 当前是否已覆盖 signing，还是只有 parse/verify  
   - **验证方式**：对 Node-issued token 加 golden tests
3. Node internal mirror endpoint payload 的最小必要字段  
   - **验证方式**：先用 authenticated issue path 建最小 payload，再扩 anonymous user create

# 6. **Implementation order**

1. **先落文档与边界**
   - 新 master plan
   - 更新 `cloudflare-platform.md`、`device-management.md`、`web-pwa-companion.md`、runbook  
   - **必须原子落地**

2. **抽 shared pure helpers**
   - 扩 `src/utils/astra/session-token.ts`
   - 新增 `credential-hash.ts`
   - 新增 `anonymous-identity.ts`
   - 先补 Node/Worker compatibility tests

3. **加 `0800_auth_issuance_authority.sql`**
   - `shadow_user_credentials`
   - `auth_issue_requests`
   - installId unique index  
   - D1 schema先到位，代码仍不切流

4. **扩 `server/cloudflare-shadow.ts` / CLI**
   - credential mirror/backfill
   - installId audit
   - 确保 staging D1 prerequisite 完整

5. **增加 Node internal mirror-back endpoints**
   - `server/index.ts`
   - `server/user-store.ts`
   - `server/config.ts` / `server/types.ts`
   - 先做 authenticated mirror-back，再扩 anonymous create/upsert  
   - **这一步要有完整测试后再进入 Worker native**

6. **引入 `sessionPublicBaseURL`**
   - Node issue path 改用新 front-door base
   - staging 验证 session claim/response 已指向 Worker

7. **实现 Worker auth issuance repos / mirror helper**
   - users/credentials/install lookup
   - auth issue ledger
   - Node mirror helper
   - 先不切 public route

8. **实现 `POST /v1/auth/anonymous` Worker handler**
   - 先 `shadow`
   - 再 `native`
   - 先在 extension/bootstrap canary 验证

9. **更新 first-party clients 的 anonymous issue retry**
   - `src/utils/astra/auth.ts`
   - `src/entrypoints/background/index.ts`
   - 若需要则 `src/utils/storage/auth.ts`

10. **实现 `POST /v1/auth/session` Worker handler**
    - 先 `shadow`
    - parity/preflight 通过后再 `native`

11. **更新 Web/extension login clients**
    - `src/utils/astra/auth.ts`
    - `web/src/lib/astra-web.ts`
    - 同 key retry 逻辑与 tests 一起落

12. **扩 observability / ops**
    - `platform-observability.ts`
    - runbook canary/rollback/playbook
    - health/observability 里能看 issuance route/mirror state

13. **production canary 顺序**
    1. `AUTH_ANONYMOUS_ISSUE_MODE=shadow`
    2. `AUTH_ANONYMOUS_ISSUE_MODE=native`
    3. `AUTH_SESSION_ISSUE_MODE=shadow`
    4. `AUTH_SESSION_ISSUE_MODE=native`

14. **阶段收尾**
    - mobile web + iOS bridge smoke
    - support matrix 仅在有新证据时微调 wording
    - 不启动 Android/native workstream

如果你愿意，我可以下一步把这份总计划再压成一版 **按 epic / issue 粒度的可执行 backlog**。