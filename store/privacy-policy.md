# Astra Privacy Policy

_Last updated: 2026-03-25_

## Overview

Astra is an open-source browser extension for AI-powered language learning. We are committed to protecting your privacy. This policy explains what data Astra handles and how.

## Data sent to external services

When you use translation features, the text you translate is sent to an AI provider (OpenAI or Google Gemini) to generate the translation. This happens either:

- **Via Astra Relay** (managed mode): your text is forwarded through the Astra relay server to the AI provider. The relay server does not log or store your translation text.
- **Directly** (bring-your-own-key mode): your text is sent directly from your browser to the AI provider using your own API key. Astra never sees your text or your key.

No data other than the translation text and necessary API parameters is included in these requests.

When **Privacy Mode** is enabled, Astra strips URL query parameters and page metadata before sending any contextual information, so no personally identifiable browsing data reaches the AI provider.

## Data stored locally

All of the following data is stored entirely on your device using the browser's local storage and IndexedDB APIs:

- **Configuration**: your settings (provider, model, target language, UI preferences)
- **Vocabulary**: saved words and phrases from your browsing
- **Reading history**: records of pages you have translated
- **Translation cache**: previously translated segments, used to avoid redundant API calls

None of this local data is transmitted to Astra or any third party.

## Analytics and tracking

Astra does **not** include any analytics, telemetry, or tracking code. No usage data is collected or transmitted.

## Third-party data sharing

Astra does **not** sell, share, or transfer your data to any third party, aside from the AI provider requests described above that are strictly necessary to deliver translation functionality.

## Deleting your data

You can delete all locally stored data at any time:

- Open the extension's **Options** page
- Navigate to **Vocabulary > Clear** to remove saved words
- Use your browser's built-in "Clear extension data" feature to remove all Astra data

## Permissions

Astra requests the following browser permissions:

| Permission | Purpose |
|---|---|
| `storage` | Save your settings, vocabulary, and translation cache locally |
| `tabs` | Detect the active tab for translation context |
| `activeTab` | Access the current page content for translation |
| `webNavigation` | Coordinate frame-aware content script injection |
| `contextMenus` | Add right-click menu actions for translation |
| `alarms` | Schedule spaced repetition review reminders |
| `host_permissions (*://*/*)` | Access page content on any website for translation |

## Open source

Astra is open source. You can review the complete source code at:

https://github.com/nicepkg/astra

## Contact

If you have questions about this privacy policy, please open an issue on the GitHub repository.
