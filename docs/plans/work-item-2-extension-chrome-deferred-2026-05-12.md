# Work item 2 deferred design frames — extension chrome

Implemented in this targeted pass: truthful onboarding site-access disclosure. Popup chrome parity, options/settings grouping, and provider status row parity are not certified by this note unless covered by separate implementation evidence and screenshots.

Deferred permission/design variants:

- Permission frame variants for “This site forever” and “All sites you visit” as an in-extension picker remain deferred. The current Chromium manifest declares `host_permissions: ["*://*/*"]` plus `activeTab`, and the codebase does not yet have optional host-permission request/revoke helpers.
- A custom permission popover anchored to the browser toolbar is deferred because browser permission prompts are controlled by Chrome/Firefox/Safari. Shipping a fake picker would imply product behavior that is not currently supported.
- Per-site optional permission revoke UI is deferred until settings can call browser optional-permission APIs and persist truthful per-origin grant state.
- Onboarding keeps the existing multi-step flow and now documents the current access boundary. It does not request broader permissions silently.

Out of scope for this work item and still deferred to later work items: content-script overlay redesign, Deep Read/vocabulary redesign, document/media reader redesign, and web workspace redesign.
