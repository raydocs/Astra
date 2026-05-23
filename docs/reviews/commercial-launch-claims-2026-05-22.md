# Commercial Launch Claims Freeze — 2026-05-22

## Verdict

**Status: Work Item 1 complete for repo copy.** Public-facing repo/store copy is frozen for a **Chrome-first free public beta** with conservative claims. This is not legal approval, store submission approval, or paid commercial launch approval.

Primary edited files:

- `store/listing-copy.md`
- `store/amo-listing.md`
- `store/description.md`
- `store/privacy-policy.md`
- `store/screenshots/README.md`
- `docs/china-browser-compat.md`
- `README.md`

## Evidence sources used

| Source | Role in claim freeze |
|---|---|
| `docs/plans/commercial-public-launch-2026-05-22.md` | Defines free-public-beta launch strategy and Work Item 1 done criteria. |
| `docs/reviews/release-gates-2026-05-18.md` | RC quality baseline; explicitly not commercial launch approval. |
| `docs/investigations/support-matrix-2026-q2.md` | Canonical browser/platform support matrix and privacy/routing claim boundaries. |
| `docs/investigations/support-matrix-video-addendum-2026-04-15.md` | Canonical video/subtitle claim boundary. |
| `docs/investigations/month-6-privacy-routing-failure-inventory-2026-04-14.md` | Privacy Mode, direct/relay routing, fallback, and local-only overclaim boundaries. |
| `src/platform/relay-lite/src/index.ts` | Confirms free beta relay-lite semantics: anonymous sessions, quota-shaped account summary, OpenRouter-backed managed translation path where deployed. |
| `src/utils/providers/router.ts` | Confirms direct provider, relay, and fallback routing behavior. |
| `src/utils/privacy.ts` | Confirms Privacy Mode request-context sanitization boundary. |

## Claim ledger

| Topic | Allowed public wording | Disallowed wording | Evidence / reason | Launch status |
|---|---|---|---|---|
| Launch state | “Free public beta.” “Chrome/Chromium is the primary validated desktop path.” | “Commercial launch approved.” “Paid launch ready.” | Launch plan allows free public beta only; release gates are RC quality baseline, not commercial approval. | Allowed |
| Paid plans / billing | “Paid subscriptions and durable entitlement behavior are not launched.” | “Pro,” “paid upgrade,” “subscription available,” “billing supported,” unless explicitly disabled/unavailable in approved copy. | Work Items 2–5 block paid launch until billing, webhook, entitlement, support/legal operations exist. | Disallowed for public launch |
| Accounts | “Managed translation uses an anonymous Astra session or optional account.” | “No account required” as an absolute claim for managed service. | Relay/relay-lite managed paths authenticate sessions; direct BYOK can be configured separately. | Qualified only |
| Local privacy | “Translation text can leave the device through direct provider or relay paths.” | “All translation stays local/on-device.” “Astra never receives text” without direct-provider qualification. | Direct provider and relay paths both send text off-device; direct-provider path bypasses Astra managed service but still sends data to provider. | Qualified only |
| Privacy Mode | “Privacy Mode sanitizes request context such as URL parameters and richer page metadata before covered translation requests.” | “Privacy Mode guarantees complete secrecy” or “end-to-end private/local-only AI.” | Sanitization exists but is request-context minimization, not an authoritative local-only transport boundary. | Allowed with limits |
| Analytics/tracking | “No third-party advertising tracking or product analytics SDKs in the extension.” | “No operational metadata is ever processed.” | Infrastructure/providers may process IP, user agent, timestamps, request IDs, or errors for operation/security/rate limits. | Qualified only |
| Provider routing | “Use direct provider keys where configured, or Astra managed beta relay where available.” “Fallback can occur only when both paths are configured and a fallback-eligible failure happens.” | “Automatic fallback ensures translations always work.” | Router only falls back for specific network/provider failure classes and only if relay access exists. | Qualified only |
| Managed relay architecture | “Astra relay / relay-lite forwards requests to the configured upstream provider; free beta may use OpenRouter-backed model routing where deployed.” | “Node relay is production paid infrastructure.” “Relay-lite provides durable paid account state.” | Launch plan makes relay-lite the free public path; paid infrastructure is blocked. | Allowed with limits |
| Chrome / Chromium | “Primary supported desktop path.” | “Full parity across every Chromium fork/device.” | Canonical support matrix. | Allowed |
| Firefox | “Beta desktop path.” | “Same maturity or parity as Chrome.” | Canonical support matrix. | Qualified only |
| Desktop Safari | “Beta packaging/build path.” | “Full Chrome parity.” “iOS proof from desktop Safari build.” | Canonical support matrix. | Qualified only |
| iOS Safari shell | “Experimental shell path for testing and iterative validation.” | “iOS/mobile fully supported.” | Canonical support matrix. | Experimental only |
| China mobile browsers | “Not a supported public-launch target; niche extension-capable browsers are experimental testing only.” | “China mobile browser support.” “Safari iOS is fully supported.” | Canonical support matrix and updated China compatibility doc. | Disallowed / experimental only |
| YouTube subtitles | “Best-effort YouTube subtitle path.” | “All YouTube states are production-proven.” | Video addendum: fixture-backed live smoke; not universal production-watch-page proof. | Allowed with limits |
| Bilibili subtitles | “Narrower beta/best-effort Bilibili adapter.” | “Parity with YouTube.” | Video addendum. | Qualified only |
| Netflix / commercial video services | “Not claimed as supported.” | “Netflix, Prime Video, Disney+, Udemy, Coursera supported.” | Video addendum marks Netflix code-only and others code/config-only. | Disallowed |
| Subtitle-file reader | “Experimental controlled surface” if mentioned. | “Evidence of broad in-page video support.” | Video addendum separates subtitle-file reader from in-page adapters. | Experimental only |
| PDF / EPUB readers | “Reader surfaces / beta reading workflows.” | “Universal document/layout support.” | Capability/release docs support reader surfaces but claim must stay scoped. | Qualified only |
| Image/comic translation | Do not mention for public launch. | “Image translation,” “comic translation,” unless explicitly marked unavailable/future. | Capability matrix marks image/comic beta rows as gaps/missing proof. | Disallowed |
| Cross-device sync / continuity | “Optional sync/account surfaces may exist; cross-device continuity is not a launch claim.” | “Full cross-device continuity/sync is done.” | Canonical support matrix and launch plan block full continuity claims. | Disallowed for launch |
| Screenshots | Use 1–5 launch-safe screenshots: page translation, selection toolbar, popup/study/routing, options/privacy/provider, PDF reader. | Screenshots implying Netflix, paid plans, broad video, image/comic translation, full continuity, or private user data. | Chrome practical 1–5 screenshot limit and launch plan. | Allowed set frozen |

## Copy changes made

- Store listing copy now says **free public beta**, not general paid/commercial launch.
- Netflix and broad video-platform claims were removed or explicitly denied.
- “No account required” was replaced with anonymous-session/optional-account language for managed translation.
- “All data stays on device” and local-only privacy implications were replaced with direct-provider/relay/Privacy Mode boundary language.
- “Automatic fallback ensures translations always go through” was replaced with conditional fallback wording.
- China/browser compatibility now follows the canonical matrix: Chrome primary, Firefox/Safari beta, iOS shell experimental, China mobile not supported for launch.
- Screenshot guidance now caps the primary launch packet at 1–5 screenshots and excludes paid, Netflix, broad-video, image/comic, continuity, and sensitive-data screenshots.

## External blockers before store submission / public launch

These are outside repo copy and remain required:

1. **Legal/privacy review** of `store/privacy-policy.md`, store descriptions, and support/contact commitments.
2. **Chrome Web Store privacy questionnaire** answers aligned to the policy and final production deployment.
3. **AMO data/privacy questionnaire** answers aligned to Firefox beta scope.
4. **Final support/contact details** in store consoles, including a monitored support channel.
5. **Final production URLs/domains** for privacy policy, support URL, web companion, and relay endpoint.
6. **Final screenshot capture and store-console upload** using the launch-safe 1–5 screenshot set.
7. **External provider and hosting review** for OpenRouter/upstream AI provider terms, data processing, retention, and budget/rate-limit controls.
8. **Paid-launch legal/support/billing package** remains blocked until billing, webhooks, entitlement enforcement, refund/cancel policy, account export/delete, and support operations are implemented and reviewed.

## Freeze rule

Any future public copy or screenshot change that strengthens claims about privacy, platforms, video services, paid plans, accounts, sync, image/comic translation, or mobile support must update this ledger or cite a newer review that supersedes it.
