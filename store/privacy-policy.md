# Astra Privacy Policy

_Last updated: 2026-05-22_

## Overview

Astra is an open-source browser extension and web companion for AI-powered language learning. This policy explains what data Astra handles during the current **free public beta**.

Astra is not a local-only translator. When you use AI translation or explanation features, the text you ask Astra to process can leave your device through one of the outbound paths described below.

## Translation and AI request paths

When you use translation, explanation, grammar, subtitle, PDF/EPUB, or related AI features, Astra may send the following request data to an AI provider or relay:

- the text segments you ask Astra to translate or explain;
- target language, task type, provider/model settings, and request options;
- optional request context such as hostname, page URL, page title, nearby selection context, content summary, or glossary/terminology data, depending on feature and Privacy Mode settings;
- session or authorization data needed for Astra-managed relay requests.

Astra supports two main outbound paths:

1. **Direct provider / bring-your-own-key mode.** Your browser sends the request directly to the configured provider, such as Google Translate, OpenAI, or Google Gemini, using credentials you provide. Astra's managed service does not receive your direct-provider text or API key, but the selected provider receives and processes the request according to that provider's terms and privacy policy.
2. **Astra managed relay / relay-lite mode.** Your browser or the web companion sends the request to an Astra relay endpoint, which forwards the request to an upstream provider configured for the beta service. The free public beta may use relay-lite and OpenRouter-backed model routing where deployed. Astra relay requests require an anonymous Astra session or optional account session so the service can authenticate requests and apply beta quotas.

If you configure both direct provider credentials and an Astra relay/session, a direct-provider request can fall back to the relay after certain provider or network failures. The popup may show routing/usage information when available.

## Privacy Mode

Privacy Mode changes **what context is sent** with translation requests; it does not keep AI processing fully on-device.

For covered page-translation and subtitle-translation request surfaces, Privacy Mode sanitizes request context before transport by:

- stripping URL query strings and fragments;
- reducing page URL context to origin/path-style information;
- omitting richer page metadata such as page title, meta description, content summary, and selection context where the covered caller applies the sanitizer.

Privacy Mode is a request-context minimization feature. Translation text still leaves the device when you use provider-backed AI translation, and new or experimental surfaces may have narrower proof until they are explicitly audited.

## Local browser storage

Astra stores product data in browser extension storage and IndexedDB so the extension can work across browsing sessions. This may include:

- **Configuration:** provider, model, target language, UI preferences, site rules, and feature settings;
- **Vocabulary and review data:** saved words/phrases, review state, and study progress;
- **Reading history / owned-reading state:** records needed to reopen or continue reading workflows;
- **Translation cache and local usage records:** cached segments, request counts, token estimates, routing metadata, and recent local usage details.

By default, this local product data stays in your browser profile. It is not sent to Astra unless you use a feature that explicitly requires relay/account/sync behavior.

## Anonymous sessions, optional accounts, and sync

The free public beta supports managed translation with an anonymous Astra session and may also expose optional account/sign-in surfaces. Depending on the path you use, Astra-managed services may process or store:

- session token metadata, session ID, device/install ID, identity mode, and expiry;
- optional account identifiers such as email address when you sign in;
- quota and usage counters used to operate the free beta;
- device/session summary data for account management;
- optional sync data for enabled collections such as configuration, vocabulary, review schedule, reading history, and study progress.

Cross-device continuity and durable paid-account behavior are not launch claims for this free public beta. Paid subscriptions, billing webhooks, entitlement enforcement, refunds, and cancellation workflows are blocked until separately implemented and reviewed.

## Analytics, advertising, and tracking

Astra does not include third-party advertising tracking or product analytics SDKs in the extension. The extension does not sell personal data.

Operational infrastructure, browser stores, hosting providers, and upstream AI providers may process request metadata such as IP address, timestamps, user agent, request IDs, or error information as needed to provide, secure, debug, or rate-limit the service. Upstream providers process translation requests according to their own terms.

## Third-party sharing

Astra shares data only as needed to provide requested functionality or operate the beta service:

- with the configured AI provider on direct-provider requests;
- with Astra relay infrastructure and its configured upstream provider on managed relay requests;
- with browser/extension platforms and hosting providers as necessary to distribute and run the extension/web companion.

Astra does not sell your data.

## Deleting your data

You can delete locally stored extension data at any time by using Astra's options/vocabulary controls where available or by clearing extension data in your browser.

For Astra-managed beta sessions or optional accounts, account deletion/export workflows require production legal/support review before paid or durable-account launch. Until those workflows are finalized, use the support contact below for managed-service data questions.

## Permissions

Astra requests browser permissions to provide translation and learning features:

| Permission | Purpose |
|---|---|
| `storage` | Save settings, vocabulary, review state, local usage records, and translation cache |
| `tabs` | Detect the active tab for translation context and commands |
| `activeTab` | Access the current page content when you ask Astra to translate or explain it |
| `webNavigation` | Coordinate frame-aware content script injection where supported |
| `contextMenus` | Add right-click menu actions for translation where supported |
| `alarms` | Schedule background refresh/review reminders where supported |
| `host_permissions (*://*/*)` | Access page content on websites where you use Astra translation features |

Some compatibility builds omit optional permissions; feature behavior may be narrower in those builds.

## Open source

Astra is open source. You can review the source code at:

https://github.com/raydocs/Astra

## Contact

If you have questions about this privacy policy, please open an issue on the GitHub repository or use the support/contact channel listed in the browser-store console for the submitted extension.
