# Store Listing Screenshots

Capture guidelines for Chrome Web Store and Firefox AMO screenshots for the free public beta.

## Resolution requirements

| Store | Dimensions | Format | Count |
|---|---|---|---|
| Chrome Web Store | 1280x800 or 640x400 px | PNG or JPEG | 1--5 (at least 1 required) |
| Firefox AMO | Any reasonable size; 1280x800 recommended for consistency | PNG or JPEG | up to 5 |

Use 1280x800 for all screenshots so the same set works for both stores. Because Chrome's practical listing limit is 1--5, the launch packet should contain **no more than five primary screenshots**.

## Launch-safe primary screenshot set (1--5)

### 1. `01-page-translation.png` -- Full-page bilingual translation

Show a representative public article or documentation page with Astra's bilingual translation active. The original text and translated text should both be clearly visible in the default light theme. Include the floating translate button if it is visible without covering important content.

**Key elements visible:** bilingual paragraphs, Astra float ball or page action, readable non-sensitive page content.

### 2. `02-selection-toolbar.png` -- Selection toolbar

Select a sentence on a webpage so the Astra selection toolbar appears. The toolbar may show Translate, Explain, Grammar, Save, Speak, and Share actions. Prefer a state where a translation or explanation result is visible below the toolbar.

**Key elements visible:** highlighted selection, toolbar button row, inline result panel.

### 3. `03-popup-control-center.png` -- Popup with Study Hub and routing transparency

Open the extension popup while on a translated page. The popup should show launch-safe beta surfaces:
- the page translation control area;
- the Study Hub / learning-loop section;
- local usage or routing information when available.

**Key elements visible:** popup header, study progress or learning steps, local usage/routing card. Do not show real account emails, API keys, private URLs, or paid/Pro upsell states.

### 4. `04-options-settings.png` -- Options / Settings page (privacy and provider boundary)

Open the Options page and capture settings that explain provider configuration, Privacy Mode, or diagnostics without exposing secrets. This screenshot should support the truthful claim that Astra exposes provider/routing controls and request-context privacy settings.

**Key elements visible:** provider status without keys, Privacy Mode or diagnostics controls, connection/route indication if available.

### 5. `05-pdf-reader.png` -- PDF reader with translation

Open a non-sensitive public PDF document in the Astra PDF Reader and show bilingual translation active. Treat this as a beta reader surface, not proof of universal document/layout support.

**Key elements visible:** PDF content, bilingual translation, Astra reader chrome.

## Optional backlog screenshots (do not include in Chrome launch packet unless replacing one above)

- `06-vocabulary-flashcard.png` -- Vocabulary review flashcard / spaced repetition. Useful if the final store packet wants to emphasize the learning loop over diagnostics or PDF.
- YouTube subtitle screenshot -- allowed only if it clearly presents YouTube as best-effort and does not imply broad video-platform support.
- Bilibili subtitle screenshot -- beta/best-effort only; avoid if space is limited.

Do **not** include screenshots that imply Netflix, Prime Video, Disney+, Udemy, Coursera, image/comic translation, paid subscriptions, production billing, or full cross-device continuity for this launch.

## Capture checklist

- [ ] Use a clean browser profile with no unrelated extensions visible in the toolbar.
- [ ] Set the browser window to exactly **1280x800** before capturing (use a window-resizer extension or DevTools device toolbar).
- [ ] Use public, representative content -- Wikipedia, public docs, public-domain text, or a non-sensitive public PDF.
- [ ] Make sure Astra UI elements (toolbar, popup, overlays) are fully rendered and not clipped.
- [ ] Avoid personal or sensitive information: email addresses, API keys, tokens, browsing history, private URLs, account IDs, or unreleased domains.
- [ ] Use the default Astra theme (light theme with the current accent token) for visual consistency.
- [ ] Avoid showing paid, Pro, subscription, billing, or upgrade UI unless it is explicitly disabled/unavailable and approved for store review.
- [ ] For localized screenshots, capture the same screens with Astra's UI set to Chinese (zh-CN locale) if the store console supports separate localized assets.

## File naming

Place final screenshots in this directory with the filenames listed above. For localized variants, use the pattern `01-page-translation-zh.png`.
