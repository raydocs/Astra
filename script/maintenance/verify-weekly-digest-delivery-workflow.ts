import { readFile } from "node:fs/promises"

const WORKFLOW_PATH = ".github/workflows/weekly-digest-delivery.yml"
const SCRIPT_PATH = "script/maintenance/trigger-weekly-digest-delivery.ts"

async function assertContains(path: string, needles: string[]) {
  const content = await readFile(path, "utf8")
  const missing = needles.filter((needle) => !content.includes(needle))
  if (missing.length > 0) {
    throw new Error(`${path} is missing required Weekly Digest delivery wiring: ${missing.join(", ")}`)
  }
}

await assertContains(WORKFLOW_PATH, [
  "name: Weekly Digest Delivery",
  "workflow_dispatch:",
  "schedule:",
  "cron: \"0 15 * * 1\"",
  "ASTRA_WEEKLY_DIGEST_DELIVERY_URL",
  "ASTRA_WEEKLY_DIGEST_OPERATOR_TOKEN",
  "Validate email delivery configuration",
  "Validate push delivery configuration",
  "pnpm weekly-digest:deliver -- --channel email --validate-config-only",
  "pnpm weekly-digest:deliver -- --channel push --validate-config-only",
  "pnpm weekly-digest:deliver -- --channel email",
  "pnpm weekly-digest:deliver -- --channel push",
])

await assertContains(SCRIPT_PATH, [
  "ASTRA_WEEKLY_DIGEST_DELIVERY_URL",
  "ASTRA_WEEKLY_DIGEST_OPERATOR_TOKEN",
  "ASTRA_WEEKLY_DIGEST_DELIVERY_CHANNEL",
  "--channel",
  "--validate-config-only",
  "X-Astra-Operator-Token",
  "Weekly Digest delivery URL must use HTTPS outside localhost.",
  "/v1/ops/weekly-digest/push",
])

console.log("Weekly Digest delivery workflow verified.")
