export {}

async function main() {
  const entry = await import("./reporters/history.ts")
  const result = await entry.runHistory(process.argv.slice(2))
  console.log(result.text)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
