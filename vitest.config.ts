import path from "node:path"

import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "#imports": path.resolve(__dirname, "./test/mocks/imports.ts"),
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
        "web/src/**/*.{ts,tsx}",
        "server/**/*.{ts,tsx}",
        "platform/cloudflare/src/**/*.{ts,tsx}",
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
