import path from "node:path"

import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  root: path.resolve(__dirname),
  base: "./",
  publicDir: path.resolve(__dirname, "public"),
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, ".."),
    },
  },
  server: {
    host: "127.0.0.1",
    port: 4173,
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
  },
  build: {
    outDir: path.resolve(__dirname, "../../dist/web"),
    emptyOutDir: true,
  },
})
