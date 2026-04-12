# Store Listing Screenshots

Capture guidelines for Chrome Web Store and Firefox AMO screenshots.

## Resolution requirements

| Store | Dimensions | Format | Count |
|---|---|---|---|
| Chrome Web Store | 1280x800 or 640x400 px | PNG or JPEG | 1--5 (at least 1 required) |
| Firefox AMO | Any reasonable size; 1280x800 recommended for consistency | PNG or JPEG | up to 5 |

Use 1280x800 for all screenshots so the same set works for both stores.

## Required screenshots

### 1. `01-page-translation.png` -- Full-page bilingual translation

Show a real English news article or Wikipedia page with Astra's bilingual (side-by-side) translation active. The original text and the translated text should both be clearly visible in the default theme. Include the floating translate button in the corner.

**Key elements visible:** bilingual paragraphs, Astra float ball, page content clearly readable.

### 2. `02-selection-toolbar.png` -- Selection toolbar

Select a sentence on a webpage so the Astra selection toolbar appears. The toolbar should show the action buttons: Translate, Explain, Grammar, Save, Speak, and Share. Ideally capture a state where a translation or explanation result is visible below the toolbar.

**Key elements visible:** highlighted selection, toolbar button row, inline result panel.

### 3. `03-popup-control-center.png` -- Popup with Study Hub and Usage

Open the extension popup while on a translated page. The popup should show:
- The "Translate This Page" button area
- The Study Hub section with study-loop progress steps (Read, Guided Read, Explain, Save Words, Review)
- The Usage & Routing card showing request counts and token estimates

**Key elements visible:** popup header, study progress bar, usage metrics, recent translation history.

### 4. `04-options-settings.png` -- Options / Settings page (Diagnostics)

Open the Options page and scroll to the Diagnostics section. Show the Provider Status panel, Transport Routes, Provider Capabilities table (model names, costs, context window), and Workflow Configuration. This demonstrates the extension's transparency and configurability.

**Key elements visible:** diagnostics section, provider capabilities table, connection mode indicator.

### 5. `05-pdf-reader.png` -- PDF reader with translation

Open a PDF document in the Astra PDF Reader (right-click a PDF link and choose "Open PDF in Astra Reader"). Show bilingual translation active on a research paper or technical document.

**Key elements visible:** PDF content, bilingual translation overlays, Astra reader chrome.

### 6. `06-vocabulary-flashcard.png` -- Vocabulary review flashcard

Open the Vocabulary section and show the flashcard review interface with spaced repetition. If possible, capture a card mid-review showing the word, context sentence, and the answer/translation side.

**Key elements visible:** flashcard UI, word and context, review action buttons, due-count badge.

## Capture checklist

- [ ] Use a clean browser profile with no other extensions visible in the toolbar.
- [ ] Set the browser window to exactly **1280x800** before capturing (use a window-resizer extension or DevTools device toolbar).
- [ ] Use real, representative content -- a Wikipedia article, BBC News, or arXiv paper works well.
- [ ] Make sure Astra UI elements (toolbar, popup, overlays) are fully rendered and not clipped.
- [ ] Avoid any personal or sensitive information (email addresses, API keys, browsing history with private URLs).
- [ ] Use the default Astra theme (indigo accent, light background) for visual consistency.
- [ ] For the Chinese store listing, capture the same screens with Astra's UI set to Chinese (zh-CN locale) if separate localized screenshots are needed.

## File naming

Place all final screenshots in this directory with the filenames listed above. For localized variants, use the pattern `01-page-translation-zh.png`.
