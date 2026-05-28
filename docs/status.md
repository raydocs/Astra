# Astra status boundary

This document is the repository-side substitute status boundary for release evidence. It is not a hosted production status page and does not prove monitored incident operations.

## User-facing degraded modes

A release note, help center, or support reply may describe degraded behavior in ordinary language:

- Translation or explanation is temporarily unavailable.
- A page cannot be read by the extension.
- Video captions are unavailable.
- File or document reading is limited for the current file type.
- Sync or relay-backed features are unavailable.
- Support report submission failed, but local download/copy is available.

Avoid exposing provider internals, operator tokens, raw stack traces, prompt text, or model/provider routing details in user-facing status copy.

## Support path

When a feature is degraded, users should have one of these paths:

1. retry or refresh;
2. use a local fallback, such as selection translation or local support-bundle download;
3. read the relevant help article or known limitation;
4. contact support or attach a metadata-only support bundle.

## Release boundary

This file proves only that user-safe status language and degraded-mode categories are documented in repo. A production status-page claim still requires hosted URL evidence, owner/inbox coverage, incident response rules, and release/rollback ownership for the target launch.
