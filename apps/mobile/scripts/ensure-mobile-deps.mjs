import { existsSync } from "node:fs"
import { join } from "node:path"

const root = new URL("..", import.meta.url).pathname
const expoPackage = join(root, "node_modules", "expo", "package.json")

if (!existsSync(expoPackage)) {
  console.error([
    "Astra mobile dependencies are not installed yet.",
    "Run `pnpm install` from `apps/mobile/` or wire this package into the workspace before launching Expo.",
    "Pre-install checks that do not require Expo are available from the repo root:",
    "  pnpm verify:mobile",
  ].join("\n"))
  process.exit(1)
}
