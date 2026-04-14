/**
 * Run after `pnpm build:safari` so CI and local machines produce byte-identical JS bundles.
 * Vite/Rollup can emit equivalent code with different whitespace ordering; esbuild minify is stable.
 */
import fs from "node:fs"
import path from "node:path"

import * as esbuild from "esbuild"

const ROOT = path.resolve(".output/safari-mv3")

function listJsFiles(dir: string): string[] {
  const out: string[] = []
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, name.name)
    if (name.isDirectory()) {
      out.push(...listJsFiles(full))
    } else if (name.isFile() && full.endsWith(".js")) {
      out.push(full)
    }
  }
  return out
}

async function canonicalize(file: string) {
  const code = fs.readFileSync(file, "utf8")
  const result = await esbuild.transform(code, {
    minify: true,
    legalComments: "none",
    target: "es2022",
  })
  fs.writeFileSync(file, result.code, "utf8")
}

const files = listJsFiles(ROOT)
if (files.length === 0) {
  console.error(`[canonicalize-safari-js] No .js files under ${ROOT}; run pnpm build:safari first.`)
  process.exit(1)
}

await Promise.all(files.map((f) => canonicalize(f)))
console.log(`[canonicalize-safari-js] Minified ${files.length} file(s) under ${ROOT}`)
