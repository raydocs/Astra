import { defineConfig } from "wxt"

// https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: "src",
  imports: false,
  modules: ["@wxt-dev/module-react"],
  manifestVersion: 3,
  manifest: ({ browser }) => ({
    name: "__MSG_extName__",
    description: "__MSG_extDescription__",
    default_locale: "zh_CN",
    permissions: [
      "storage",
      "tabs",
      "activeTab",
      "webNavigation",
      "contextMenus",
    ],
    host_permissions: ["*://*/*"],
    commands: {
      toggleTranslate: {
        suggested_key: { default: "Alt+A", mac: "Alt+A" },
        description: "Toggle page translation",
      },
      translatePage: {
        suggested_key: { default: "Alt+W", mac: "Alt+W" },
        description: "Translate entire page",
      },
      toggleHover: {
        suggested_key: { default: "Alt+H", mac: "Alt+H" },
        description: "Cycle hover translation mode",
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
