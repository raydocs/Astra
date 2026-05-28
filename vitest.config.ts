import path from "node:path"

import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "#imports": path.resolve(__dirname, "./test/mocks/imports.ts"),
      "expo-application": path.resolve(__dirname, "./test/mocks/expo-application.ts"),
      "expo-constants": path.resolve(__dirname, "./test/mocks/expo-constants.ts"),
      "expo-crypto": path.resolve(__dirname, "./test/mocks/expo-crypto.ts"),
      "expo-notifications": path.resolve(__dirname, "./test/mocks/expo-notifications.ts"),
      "expo-speech": path.resolve(__dirname, "./test/mocks/expo-speech.ts"),
      "react-native": path.resolve(__dirname, "./test/mocks/react-native.ts"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "./coverage",
      include: [
        "src/**/*.{ts,tsx}",
        "src/web/src/**/*.{ts,tsx}",
        "src/server/**/*.{ts,tsx}",
        "src/platform/cloudflare/src/**/*.{ts,tsx}",
      ],
      exclude: [
        "**/*.d.ts",
        "**/*.test.{ts,tsx}",
      ],
    },
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.output/**",
      "**/.wxt/**",
      "**/.claude/**",
      "**/.specify/**",
    ],
  },
})
