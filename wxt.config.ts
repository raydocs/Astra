import { defineConfig } from "wxt"

// https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: "src",
  imports: false,
  modules: ["@wxt-dev/module-react"],
  manifestVersion: 3,
  manifest: ({ browser }) => ({
    name: "Astra",
    description: "AI-powered bilingual web translation",
    permissions: [
      "storage",
      "tabs",
      "activeTab",
    ],
    host_permissions: ["*://*/*"],
    commands: {
      toggleTranslate: {
        suggested_key: { default: "Alt+A", mac: "Alt+A" },
        description: "Toggle page translation",
      },
    },
    ...(browser === "safari" && {
      browser_specific_settings: {
        safari: {
          strict_min_version: "16.4",
        },
      },
    }),
  }),
})
