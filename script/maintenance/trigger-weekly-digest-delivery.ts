export {}

type DeliveryChannel = "email" | "push"

interface CliOptions {
  url: string | null
  token: string | null
  channel: DeliveryChannel
  dryRun: boolean
  limit: number
  now: string | null
  validateConfigOnly: boolean
}

function readBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value == null || value.trim() === "") return fallback
  const normalized = value.trim().toLowerCase()
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on"
}

function readPositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function readDeliveryChannel(value: string | undefined, fallback: DeliveryChannel): DeliveryChannel {
  const normalized = value?.trim().toLowerCase()
  if (!normalized) return fallback
  if (normalized === "email" || normalized === "push") return normalized
  throw new Error("Weekly Digest delivery channel must be email or push.")
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    url: process.env.ASTRA_WEEKLY_DIGEST_DELIVERY_URL ?? process.env.ASTRA_RELAY_WEEKLY_DIGEST_DELIVERY_URL ?? null,
    token: process.env.ASTRA_WEEKLY_DIGEST_OPERATOR_TOKEN ?? process.env.ASTRA_OPERATOR_TOKEN ?? null,
    channel: readDeliveryChannel(process.env.ASTRA_WEEKLY_DIGEST_DELIVERY_CHANNEL, "email"),
    dryRun: readBoolean(process.env.ASTRA_WEEKLY_DIGEST_DELIVERY_DRY_RUN, false),
    limit: readPositiveInteger(process.env.ASTRA_WEEKLY_DIGEST_DELIVERY_LIMIT, 50),
    now: process.env.ASTRA_WEEKLY_DIGEST_DELIVERY_NOW ?? null,
    validateConfigOnly: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === "--") continue
    if (arg === "--url") options.url = argv[++index] ?? null
    else if (arg === "--token") options.token = argv[++index] ?? null
    else if (arg === "--channel") options.channel = readDeliveryChannel(argv[++index], options.channel)
    else if (arg === "--dry-run") options.dryRun = true
    else if (arg === "--no-dry-run") options.dryRun = false
    else if (arg === "--limit") options.limit = readPositiveInteger(argv[++index], options.limit)
    else if (arg === "--now") options.now = argv[++index] ?? null
    else if (arg === "--validate-config-only") options.validateConfigOnly = true
    else throw new Error(`Unknown argument: ${arg}`)
  }

  return options
}

function normalizeDeliveryUrl(raw: string | null): URL {
  const value = raw?.trim()
  if (!value) throw new Error("ASTRA_WEEKLY_DIGEST_DELIVERY_URL is required.")
  const parsed = new URL(value)
  if (parsed.protocol !== "https:" && parsed.hostname !== "127.0.0.1" && parsed.hostname !== "localhost") {
    throw new Error("Weekly Digest delivery URL must use HTTPS outside localhost.")
  }
  return parsed
}

function deliveryUrlForChannel(raw: string | null, channel: DeliveryChannel): string {
  const parsed = normalizeDeliveryUrl(raw)
  if (channel === "email") return parsed.toString()

  const normalizedPath = parsed.pathname.replace(/\/+$/, "")
  if (normalizedPath === "/v1/ops/weekly-digest/push") {
    parsed.pathname = "/v1/ops/weekly-digest/push"
    return parsed.toString()
  }
  if (normalizedPath !== "/v1/ops/weekly-digest/deliver") {
    throw new Error("Weekly Digest push delivery requires ASTRA_WEEKLY_DIGEST_DELIVERY_URL to point at /v1/ops/weekly-digest/deliver or /v1/ops/weekly-digest/push.")
  }
  parsed.pathname = "/v1/ops/weekly-digest/push"
  return parsed.toString()
}

function normalizeOperatorToken(raw: string | null): string {
  const value = raw?.trim()
  if (!value) throw new Error("ASTRA_WEEKLY_DIGEST_OPERATOR_TOKEN or ASTRA_OPERATOR_TOKEN is required.")
  return value
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const url = deliveryUrlForChannel(options.url, options.channel)
  const token = normalizeOperatorToken(options.token)
  const body = {
    dryRun: options.dryRun,
    limit: Math.max(1, Math.min(options.limit, 200)),
    ...(options.now ? { now: options.now } : {}),
  }

  if (options.validateConfigOnly) {
    console.log(JSON.stringify({ ok: true, url, channel: options.channel, dryRun: body.dryRun, limit: body.limit, hasToken: token.length > 0 }))
    return
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Astra-Operator-Token": token,
    },
    body: JSON.stringify(body),
  })
  const text = await response.text()
  if (!response.ok) {
    throw new Error(`Weekly Digest ${options.channel} delivery failed with ${response.status}: ${text.slice(0, 500)}`)
  }
  console.log(text)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
