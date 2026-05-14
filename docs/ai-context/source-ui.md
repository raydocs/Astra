# AI Context: UI Source and Design References

Use this derived routing summary when the task is about extension UI, web UI, styling, design tokens, visual polish, onboarding, readers, popup/options, or in-page controls. The canonical repository classification boundary is [`../investigations/ai-readable-classification-boundary.md`](../investigations/ai-readable-classification-boundary.md).

Runtime UI source belongs to the conceptual `src/` bucket. Design references, screenshots, and generated release artifacts belong to conceptual `docs/` or `data/` context and are not runtime implementation.

## Runtime UI source — safe to give AI

### Extension UI

```text
src/entrypoints/popup/
src/entrypoints/options/
src/entrypoints/content/components/
src/entrypoints/onboarding/
src/entrypoints/deep-read/
src/entrypoints/document-intake/
src/entrypoints/pdf-reader/
src/entrypoints/epub-reader/
src/entrypoints/image-translate/
src/entrypoints/subtitle-reader/
src/entrypoints/vocabulary/
src/components/
src/utils/ui/
src/assets/astra-style1-tokens.css
src/assets/astra-extension.css
```

### Web companion UI

```text
src/web/src/
src/web/public/
src/web/index.html
src/web/vite.config.ts
src/assets/astra-style1-tokens.css
```

## Design references — use only for visual/design tasks

```text
astra (ui)/components/
astra (ui)/styles/tokens.css
astra (ui)/Astra UI Redesign.html
astra (ui)/design-canvas.jsx
astra (ui)/design-canvas-app.jsx
docs/design-comparison/README.md
```

These files are useful for understanding intended visuals, frames, and tokens. They are not the runtime implementation.

## Do not give AI by default for UI work

```text
astra (ui)/uploads/
docs/design-comparison/*.png
store/screenshots/
.output/
.wxt/
dist/
ios/AstraShell Extension/Resources/
data/bench-results/
data/bench-live-results/
data/bench-live-results-test/
data/bench-opt-results/
coverage/
```

Only include these when the task explicitly asks about screenshots, design comparison images, generated bundles, release verification, or artifact analysis. See [`reference-index.md`](./reference-index.md) for artifact routing details.
