# Optional page/site permission controls

_Last updated: 2026-05-13_

Astra now has runtime helpers for three access scopes:

| Scope | Runtime behavior | Persistence | Compatibility copy boundary |
|---|---|---|---|
| Page only | Uses the extension invocation/`activeTab` path where the browser grants temporary access. Astra broadcasts the page-scoped grant to the active tab. | No host permission is persisted. | Do not claim this injects Astra into pages where the content script is unavailable; in the current broad-access build it reconciles already-running content scripts. |
| This site | Requests only the current origin pattern, for example `https://example.com/*`, through `browser.permissions.request({ origins })` where available. | Browser optional host grant when supported; Astra also records an origin runtime policy. | Chrome/Firefox support optional host permission APIs; Safari/iOS behavior is build/runtime dependent and may not show a prompt. |
| All sites | Requests `http://*/*` and `https://*/*` through `browser.permissions.request({ origins })` where available. | Browser optional host grant when supported; Astra records all-sites intent. | Must not be described as narrower than current broad host access while `host_permissions: ["*://*/*"]` remains in the manifest. |

## Current manifest truthfulness

`wxt.config.ts` still declares broad `host_permissions: ["*://*/*"]` for this build. It also declares `optional_host_permissions` so runtime request/remove calls are legal where browsers support them. UI copy must continue to disclose the broad host permission until a later manifest/content-script architecture removes it.

Because broad access is still declared, `browser.permissions.remove()` may report that no browser-level permission changed. Astra therefore stores a runtime revoke policy in `astra.page_access_policy.v1`; content scripts read that policy and stop/reconcile page translation, subtitle translation, meeting captions, custom CSS, and future always-translate automation for the revoked origin.

## Broadcast contract

Grant/revoke helpers send `astra/page-access-changed` to extension pages and matching active content scripts:

- page scope targets only the selected tab;
- site scope targets tabs whose URL origin matches the current origin;
- all-sites scope targets all http(s) tabs.

The background also listens to `browser.permissions.onAdded` and `browser.permissions.onRemoved` so browser-managed changes update Astra's runtime policy and broadcast immediately.

## Deferred gaps

- Programmatic content-script injection for pages where no Astra content script is present is not part of this work item.
- Removing broad install-time host access is deferred to a future manifest/content-script architecture pass.
- Safari/iOS permission prompt behavior still needs device-backed validation before copy can claim parity with Chromium.
