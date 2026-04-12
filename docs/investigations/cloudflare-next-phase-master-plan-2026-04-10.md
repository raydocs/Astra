# Astra 下一阶段 Cloudflare 迁移与跨设备平台总计划（2026-04-10）

## 文档目的

这是一份面向执行的总计划书，目标是把 Astra 从“已经具备跨设备能力与 Cloudflare 迁移缝”的状态，推进到“Cloudflare 路径可验证、可回滚、可逐段切流”的状态。

本文聚焦三类问题：

1. 我们已经完成了什么
2. 我们还缺什么
3. 下一阶段应该按什么顺序推进

---

## 一、当前已完成状态

### 1.1 产品能力层

当前仓库已经具备：

- 浏览器内翻译主链路
- PDF / EPUB / subtitle file / YouTube 等多 surface
- continuity foundations
- phase-1 sync：config / vocabulary / reading_history
- phase-2 sync：study_progress
- device management UI / revoke
- Web/PWA scaffold + usable MVP
- web URL import
- iOS thin host bridge + extension consume-loop

### 1.2 云端与平台层

当前仓库已经具备：

- Node relay / server 仍然可运行
- Cloudflare platform spec
- Cloudflare Worker scaffold
- article import Cloudflare seam
- Worker-native vs relay parity fixtures
- D1 shadow schema / repo 层
- R2 / Queues 已接到 article import seam

### 1.3 当前状态一句话

> Astra 已经从“浏览器扩展产品”演进到“跨设备产品骨架 + Cloudflare 迁移骨架”，现在进入的是平台化与可切流阶段。

---

## 二、当前核心缺口

## 2.1 Cloudflare 仍是 migration path，但已进入“可切流运行面”阶段

当前已经有：

- Worker scaffold
- article import seam
- D1 shadow tables
- R2 / Queues 接线
- device list / device revoke / sync bootstrap / sync pull / sync push 的可回滚 Worker seam
- unified observability / health / replay / rollback runbook
- consistency audit / verify / backfill 工具链

当前仍**没有**做的是：

- auth login / full session issuance migration
- 全量 auth/session/device/sync 全面接管
- non-gated 路由的全面 Cloudflare authoritative 化

### 结论

Cloudflare 仍是**渐进迁移路径**，但对当前已圈定的 route seam 来说，已经具备**可验证、可回滚、可逐段切流**的运行条件。

---

## 2.2 D1 仍不是全局 authoritative state，但已具备当前阶段所需的可运营能力

D1 当前已有：

- users / sessions / devices / sync tables
- typed repos
- migrations
- route/parity/operator event ledger
- consistency audit / verify / backfill:dry-run / backfill:apply
- device/sync 读切换与选定写路径所需的数据面

当前仍保留的边界：

- auth login / session issuance 仍不由 D1 authoritative 承担
- D1 仍不是全局 source of truth
- extra shadow-only rows 仍由 operator 可见，不自动 delete

### 结论

D1 还没有进入“全局权威状态源”的阶段，但对当前 Cloudflare 路径来说，已经从“空影子层”进入“可对账、可回填、可支撑 gated read/write seam”的阶段。

---

## 2.3 article import rollout safety 已基本补齐，不再只停在 seam

当前已经有：

- proxy / shadow / native 模式
- parity fixtures
- R2 artifact capture
- Queue async path
- import observability + unified observability
- retry / reprocess policy
- queue backlog monitoring
- artifact lifecycle / retention metadata
- import endpoint abuse / rate limiting
- byte-cap cost governance

当前仍可继续演进但**不再阻塞放量前准备**的事项：

- 更细的 failure taxonomy 文档
- 更长期的成本效果报表
- 更自动化的 lifecycle enforcement / delete orchestration

### 结论

article import 现在已经进入“有保护地放量”阶段，而不再只是一个 seam demo。

---

## 2.4 Web/PWA 已 usable，但还不是云资产控制台

当前 web 已有：

- text translation
- file workflows
- account
- URL import
- config / vocabulary cloud surfaces

但还缺：

- reading_history cloud surface
- study_progress cloud surface
- import library / asset library
- sync health surfaces
- IndexedDB 生命周期管理
- quota / corruption / recovery surfaces

### 结论

Web 已可用，但还没成为真正的跨设备云资产面。

---

## 2.5 同步功能已做出来，但运营级稳态还不够

当前同步已经覆盖：

- config
- vocabulary
- reading_history
- study_progress

但还缺：

- conflict telemetry
- sync health dashboard
- export/delete/retention 全链路
- mutation compaction
- replay / repair flows
- per-user coordination 压力评估

### 结论

同步功能可用，但还没到长期运营级。

---

## 2.6 iOS 目前仍是 bridge，不是完整移动产品

当前已有：

- host bootstrap ingest
- extension consume-loop
- popup/onboarding status

但还缺：

- shared session materialization
- native-facing UX
- host/app/extension coherence
- install/open/handoff narrative
- 更完整 distribution 路径

### 结论

iOS 适合继续做 bridge，不适合现在就当 full mobile product。

---

## 2.7 部署、观测、风控这一层已补齐当前阶段基线

当前已具备：

- Cloudflare local/staging/production deploy 模型
- route-level canary / rollback flags
- D1 migration apply order 文档
- R2 artifact governance / retention metadata
- Queue dead-letter / retry / replay policy
- import abuse + byte-cap cost controls
- `/__platform/health` + `/__platform/observability`
- rollback / operator runbook

后续仍可继续增强：

- 更细粒度 alerts / dashboards
- 自动化 migration apply/check 脚本
- 更强的 delete/retention enforcement 自动化

### 结论

这一层已经不再是当前 Cloudflare 切流的阻塞项。

---

## 三、Cloudflare 全家桶架构方向

## 3.1 Workers

角色：API runtime / ingress / migration control plane

用于：

- `/v1/import/article` native path
- auth/session/device/sync 的渐进接管
- proxy / shadow / native 模式切换
- trace headers / routing policy

## 3.2 D1

角色：结构化 authoritative state 的目标落点

用于：

- users
- auth sessions
- devices
- sync collection state
- sync mutations
- article import metadata / artifact pointers

## 3.3 R2

角色：大对象与导入产物层

用于：

- raw fetched html
- extracted import payloads
- response artifacts
- future export bundles / archives

## 3.4 KV

角色：best-effort cache / flags / idempotency hints

适合：

- feature flags
- rollout flags
- bootstrap cache
- read-heavy low-consistency summaries
- idempotency hints

不适合：

- authoritative sync/source-of-truth state

## 3.5 Queues

角色：异步工作流

适合：

- import shadow processing
- retry / reprocess
- compaction
- export jobs
- future asset transforms

## 3.6 Durable Objects

角色：仅在需要强协调时引入

当前策略：

- 默认不引入
- 只有在 per-user sync 并发冲突或 job coordination 明显需要串行时再引入

### 当前结论

> Durable Objects 现在不是前置条件，而是后备武器。

---

## 四、完整路线图

## Phase 0：稳定主线

### 目标

把当前主线变成“可继续迁移”的稳定底座。

### 已基本完成

- repo-wide type-check 清零
- iOS status UI
- article import parity fixtures
- D1 shadow scaffold
- R2 / Queues seam wiring

### 还建议补的

- repo-wide targeted smoke baseline 再收一轮
- parity fixture 扩面
- import failure taxonomy 文档
- Cloudflare rollout checklist 初稿

### Done when

- 当前主线功能和迁移 seam 没有明显悬空点
- authoritative / shadow / seam 边界在文档和实现里一致

---

## Phase 1：Cloudflare article import 放量前准备

### 目标

让 article import 成为第一条可控切流的 Cloudflare 线路。

### 需要做

#### A. parity 扩面

- 增加更多 fixture
- 输出 block delta / field mismatch / extraction failure classes

#### B. import observability

- Worker/native/proxy/fallback 路由统计
- queue backlog / failure count
- D1 metadata completeness
- R2 artifact completeness

#### C. import safety

- rate limiting
- abuse policy
- stricter URL allow/deny
- retry policy
- dead-letter / reprocess policy

#### D. rollout control

- env-based mode control
- per-env / per-surface routing
- quick rollback path

### Done when

- article import 能在灰度环境稳定跑
- native/import fallback 行为可观测、可解释、可回退

---

## Phase 2：D1 shadow write / shadow read

### 目标

让 Cloudflare 开始镜像真实产品状态。

### 需要做

#### A. shadow write

从当前 Node authoritative flows 同步写入 D1：

- auth session create / refresh / revoke
- device register / touch / revoke
- sync collection preference changes
- sync mutations append

#### B. shadow read parity

比较：

- session lookup
- device list
- sync bootstrap
- sync pull

#### C. consistency checks

- Node vs D1 row count
- per-user device parity
- per-collection cursor parity

#### D. backfill

- 从当前 user-store / sync state 填到 D1
- backfill 前后做 count/checksum 校验

### Done when

- 能回答“D1 和 Node 是否一致”
- D1 成为活的 mirror，而不是空表

---

## Phase 3：Cloudflare 接管 read path

### 目标

先切读，不切写。

### 适合优先切的读路径

1. article import metadata read
2. device list read
3. sync bootstrap read
4. sync pull read
5. later: account summary read

### 原则

- 先切可回滚的 read path
- 先切容易与 Node 对账的 path
- 写入仍保持 Node authoritative

### Done when

- 某些 API 已由 Worker + D1 提供读结果
- rollback 只需路由切回

---

## Phase 4：Cloudflare 接管部分 write path

### 目标

从低耦合写路径开始，逐步让 Cloudflare authoritative。

### 优先写路径

1. article import metadata / artifact write
2. device revoke write
3. sync mutation append
4. later: session touch / session revoke

### 注意

- 不要先切 auth login / full session issue
- 先切低耦合、可对账、可回滚路径

### Done when

- 至少一组生产有价值写路径由 Cloudflare authoritative 承担
- Node 退为兼容层或 fallback

### 2026-04-11 进展：第一条低风险 authoritative write 已落地

- `POST /v1/devices/:deviceId/revoke` 新增 `DEVICE_REVOKE_WRITE_MODE`
- `proxy` 保持原 Node 行为
- `native` 采用：
  1. Node `/v1/auth/session` 做 authenticated gate
  2. Worker / D1 先执行 authoritative remote revoke
  3. 再显式 mirror-back 到 Node，保持 Node-served reads / adjacent writes 兼容
  4. prerequisite 缺失或 Node 明确拒绝时 fallback
  5. mirror-back 传输结果不确定时返回 guarded `503`，避免误判 rollback / retry

这让 Phase 4 有了第一条“可切流、可回滚、可兼容 Node 邻接路径”的 write seam。

### 2026-04-11 进展：sync mutation append 也已进入可切流阶段

- `POST /v1/sync/push` 新增 `SYNC_PUSH_WRITE_MODE`
- `proxy` 保持原 Node 行为
- `native` 采用：
  1. Node `/v1/auth/session` 做 authenticated gate
  2. Worker / D1 先执行 authoritative mutation append，并复用 Node 同一套 payload / collection 校验规则
  3. 再显式 mirror-back 到 Node，保证 Node-served read/write 邻接路径继续兼容
  4. prerequisite 缺失或 Node 明确拒绝时 fallback
  5. mirror-back 传输结果不确定时返回 guarded `503`
- rollout 期间 Worker 侧 `ASTRA_SYNC_MAX_MUTATIONS_PER_REQUEST` 必须与 relay 保持一致，才能维持完全一致的 request-cap 语义

### 2026-04-11 进展：Phase 4 邻接 platform/ops block 已补齐

- 新增 `relay:shadow:backfill:apply`，可对 auth/session/device/sync shadow state 做 additive repair 后立即 re-verify
- 新增 `/__platform/observability`，统一暴露 rollout、governance、route stats、fallback、parity drift、recent operator/platform events、article import backlog
- `device-list` / `device-revoke` / `sync-bootstrap` / `sync-pull` / `sync-push` 现在会把 route/parity/operator 事件持久化到 D1 `platform_route_events`
- import 增加 operator-configurable byte caps：`ARTICLE_IMPORT_MAX_SHADOW_BYTES`、`ARTICLE_IMPORT_MAX_NATIVE_BYTES`
- 新增 Cloudflare deployment / rollback / governance / observability runbook，local/staging/prod 模型明确化

### 结论

在**不迁移 auth login / full session issuance** 的前提下，本次 scoped Cloudflare 平台块已经可以视为“基本完成”。

---

## Phase 5：Web 成为云资产控制台

### 目标

让 Web 从 companion 升级为控制台和云资产入口。

### 需要做

- reading_history cloud surface
- study_progress cloud surface
- import library
- asset detail pages
- sync health surfaces
- IndexedDB lifecycle management
- corruption recovery
- queue-driven status surfaces

### Done when

- Web 可以管理主要云资产
- Web 不再只是额外入口

### 2026-04-11 进展：Web control-plane block 已补齐

- 新增 `/assets` 资产详情页：本地 import library + cloud reading_history / study_progress / vocabulary 明细视图
- Account + Assets 新增 queue-driven import status：backlog（queued/failed/dead-lettered）、recent failures、oldest queued age
- 新增 optional sync collection controls：可直接在 Web 控制台切换 `reading_history` 与 `study_progress`
- 新增 IndexedDB lifecycle 管理：完整性审计、损坏记录修复、生命周期 reset
- 新增 corruption recovery UX：针对 IndexedDB/localStorage fallback 的修复与重建入口

---

## Phase 6：iOS bridge 强化

### 目标

继续强化 bridge，不急于做 full native product。

### 需要做

- popup / onboarding / web 对 iOS bootstrap 状态的可见性
- bridge event replay / history
- launch/open/handoff narrative
- install/open-in-app path
- host / extension / web 职责厘清

### Done when

- iOS bridge 不只是存在，而且对用户可感知

---

## 五、当前 scoped platform gaps 的完成情况

## 5.1 Cloudflare consistency tooling（本阶段已补齐）

- D1 consistency audit CLI
- shadow diff report
- verify command
- backfill:dry-run
- backfill:apply
- per-collection parity visibility

## 5.2 Queue failure / replay tools（本阶段已补齐）

- failed job inspection
- replay command
- poison message handling（dead-letter + ack）
- batch retry controls

## 5.3 Artifact governance（本阶段基线已补齐）

- retention policy metadata
- object naming
- lineage/version metadata
- replay/governance linkage
- cleanup policy 文档基线

## 5.4 Import abuse / cost governance（本阶段已补齐）

- scraping abuse controls
- giant page abuse byte caps
- hot domain retry-storm controls
- queue flood boundaries
- cost predictability controls

## 5.5 Cloudflare deployment model（本阶段已补齐）

- dev/staging/prod bindings
- canary routes
- rollout flags
- rollback runbook
- operator deploy/migration order

## 5.6 Observability（本阶段已补齐）

- worker route stats
- queue lag / backlog age
- D1-backed platform event visibility
- artifact completeness
- parity drift
- sync/device route mismatch visibility

## 5.7 Native/mobile narrative

- iOS “Open in Astra” narrative
- install flow
- host bridge status surfaces
- mobile entry strategy文档

---

## 六、推荐执行顺序

### 优先级 1

Cloudflare auth/session/device/sync shadow write + parity

### 优先级 2

article import rollout safety

### 优先级 3

Web 云资产控制台补全

### 优先级 4

iOS bridge 可见性 + handoff narrative

---

## 七、不该做的事情

当前最不该做的是：

- 立即把所有 auth/session/device/sync 全切到 Cloudflare
- 同时大规模扩 Android / full native product
- 在缺 observability / consistency tooling 的情况下快速切流

当前最该做的是：

> 把 Cloudflare 从“有 seam”推进到“有 shadow parity、可验证、可回滚”的状态。

---

## 八、结论

Astra 现在的下一阶段，不是继续横向加很多 feature，而是：

> 把跨设备产品能力，和 Cloudflare 平台迁移能力，合成一套可以逐步切流、逐步运营的平台系统。

后续 orchestrator 应优先围绕：

1. auth/session/device/sync shadow write + parity
2. article import rollout safety
3. Web 云资产控制台补全

来持续推进。
