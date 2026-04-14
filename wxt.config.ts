import { defineConfig } from "wxt"

/**
 * Build profiles:
 * - chromium-full: Chrome/Edge full-feature build (default)
 * - chromium-compat: Conservative build for 360/QQ/Sogou/2345/mobile Chromium
 * - safari: Safari/iOS
 * - firefox: Firefox/AMO
 *
 * Set ASTRA_BROWSER_CHANNEL=compat to produce a conservative Chromium build.
 */
const isCompatChannel = process.env.ASTRA_BROWSER_CHANNEL === "compat"
const CHROMIUM_EXTENSION_PUBLIC_KEY = "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAxRUh12SsWFI/aepeIXfNLi7Co5E0xlfxgOcRRA2ehhX8TiM8OV3mgJT+BjBpNSHvtYpBVzBomOg9eCbb/Q3BxxNOThaJrByGK95ajL7KKLWTsMK4XMbQXjHyQZEeC+25tAEyWsbVsH/CmXSNGMoHABVwU05qBCzkudjsyGdJjVBE23GaZzkBRV91nZm61DB3ZR5wLicMQrrDNPApVsk0/ha2oFmqMHPTZYfNssNUzf6k/8AujOLpm1PZUNrS32W52AtKZVNVUUHqUoevrvyRP+yGgJnnhXPvINtslh2CCYb6BLWlzDNMtW3ii643q7r/CWCOboAn5+Wkz/66Yt0cVwIDAQAB"

// https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: "src",
  imports: false,
  modules: ["@wxt-dev/module-react"],
  manifestVersion: 3,
  manifest: ({ browser }) => {
    // Base permissions available in all builds
    const permissions: string[] = ["storage", "tabs", "activeTab"]

    // Full Chromium builds get additional API permissions
    if (!isCompatChannel) {
      permissions.push("webNavigation", "contextMenus", "alarms")
    }

    return {
      name: "__MSG_extName__",
      description: "__MSG_extDescription__",
      default_locale: "zh_CN",
      ...(browser !== "firefox" && browser !== "safari" && {
        key: CHROMIUM_EXTENSION_PUBLIC_KEY,
      }),
      // Use options_ui for broader Chromium-family compatibility
      options_ui: {
        page: "options.html",
        open_in_tab: true,
      },
      permissions,
      host_permissions: ["*://*/*"],
      // Omnibox integration only in full builds (compat builds may not support omnibox API)
      ...(!isCompatChannel && {
        omnibox: { keyword: "astra" },
      }),
      // Keyboard shortcuts only in full builds (compat builds may not support commands API)
      ...(!isCompatChannel && {
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
      }),
      ...(browser === "safari" && {
        browser_specific_settings: {
          safari: {
            strict_min_version: "16.4",
          },
        },
      }),
      ...(browser === "firefox" && {
        browser_specific_settings: {
          gecko: {
            id: "astra@nicepkg.cn",
            // Firefox requires data_collection_permissions for new submissions; addons-linter
            // requires a min version that actually supports this manifest key (FF 140+ desktop,
            // FF 142+ Android per mozilla/addons-linter).
            strict_min_version: "142.0",
            data_collection_permissions: {
              required: ["none"],
            },
          },
        },
      }),
    }
  },
})
