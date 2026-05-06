const { chromium } = require('playwright')
const path = require('node:path')

;(async () => {
  const repo = process.cwd()
  const extensionPath = path.join(repo, '.output/chrome-mv3-dev')
  const userDataDir = '/tmp/astra-extension-preview-profile'
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--no-first-run',
      '--no-default-browser-check',
    ],
    viewport: { width: 1440, height: 980 },
  })
  let [sw] = context.serviceWorkers()
  if (!sw) sw = await context.waitForEvent('serviceworker', { timeout: 10000 })
  const extensionId = sw.url().split('/')[2]
  const page = await context.newPage()
  await page.goto(`chrome-extension://${extensionId}/options.html`, { waitUntil: 'domcontentloaded' })
  await page.bringToFront()
  console.log(`OPENED chrome-extension://${extensionId}/options.html`)
  console.log('Close this terminal process or browser window when done.')
  setInterval(() => {}, 1000)
})().catch((err) => { console.error(err); process.exit(1) })
