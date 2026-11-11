// Regenerates the README screenshots in docs/screenshots/ from live IGDB data.
//
// Builds the app, starts the built server on 127.0.0.1, photographs a fixed view
// with Playwright's Chromium and stops the server again, also when it fails.
// The Twitch credentials are passed to the server's environment only: the build
// runs without them, so they are never baked into .output, and they are never
// written or logged.
//
// Usage: TWITCH_CLIENT_ID=... TWITCH_CLIENT_SECRET=... npm run screenshots
//        (SCREENSHOTS_PORT picks the port, 3124 by default)
// Needs Chromium once: npx playwright install chromium

import { spawn, spawnSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

// Always the same view, so the shots stay comparable over time. A past month's
// IGDB data changes far less than an upcoming one's.
const VIEW = '/?from=2026-10-01&to=2026-10-31&platform=ps5&junk=adult,cover'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const OUT_DIR = new URL('../docs/screenshots/', import.meta.url)
const PORT = Number(process.env.SCREENSHOTS_PORT || 3124)
const BASE = `http://127.0.0.1:${PORT}`
const DESKTOP = { width: 1440, height: 900 }
const PHONE = { width: 390, height: 844 }

function fail(message) {
  console.error(`screenshots: ${message}`)
  process.exit(1)
}

const CREDENTIALS = ['TWITCH_CLIENT_ID', 'TWITCH_CLIENT_SECRET']

for (const name of CREDENTIALS) {
  if (!process.env[name]) {
    fail(`credentials missing: set ${CREDENTIALS.join(' and ')} (${name} is not set)`)
  }
}

// Imported after the credential check, so that refusal works without Playwright.
const { chromium } = await import('playwright')

// Like scripts/package-release.sh: build without the credentials, and point
// --dotenv at a file that doesn't exist so a local .env isn't loaded either.
const buildEnv = { ...process.env }
for (const name of CREDENTIALS) delete buildEnv[name]
console.log('screenshots: building')
const build = spawnSync('npm', ['run', 'build', '--', '--dotenv', '.env.screenshots-build-none'], {
  cwd: ROOT,
  env: buildEnv,
  stdio: 'inherit',
})
if (build.status !== 0) fail('npm run build failed')

let server
let browser
let serverLog = ''

const isRunning = () => server && server.exitCode === null && server.signalCode === null

function stopServer() {
  if (isRunning()) server.kill()
}

// Stops the server and waits until it has exited, so its port is free again.
async function stopServerAndWait() {
  if (!isRunning()) return
  const exited = new Promise((resolve) => server.once('exit', resolve))
  server.kill()
  await exited
}

// Stop the server however the script ends: success, an error, or Ctrl-C.
process.on('exit', stopServer)
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => {
    stopServer()
    process.exit(1)
  })
}

// Wait for this server to say it is listening, rather than for the port to
// answer: if something else already holds the port, node exits and we must not
// photograph that instead.
async function startServer() {
  server = spawn(process.execPath, ['.output/server/index.mjs'], {
    cwd: ROOT,
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let listening = () => {}
  const onOutput = (chunk) => {
    serverLog += chunk
    if (serverLog.includes('Listening on')) listening()
  }
  server.stdout.on('data', onOutput)
  server.stderr.on('data', onOutput)

  let onExit, onError, timer
  try {
    await new Promise((resolve, reject) => {
      listening = resolve
      timer = setTimeout(() => reject(new Error('the server did not start listening within 30 seconds')), 30_000)
      onExit = () => reject(new Error(`the server exited during startup (is port ${PORT} in use? set SCREENSHOTS_PORT)`))
      onError = (error) => reject(new Error(`the server could not be started: ${error.message}`))
      server.once('exit', onExit)
      server.once('error', onError)
    })
  }
  finally {
    clearTimeout(timer)
    server.off('exit', onExit)
    server.off('error', onError)
  }
}

// Opens the fixed view in a fresh browser context, waits until it is fully
// drawn (see openView), runs fn with the page and closes the context again.
async function withView(viewport, options, fn) {
  const { context, page } = await openView(viewport, options)
  try {
    return await fn(page)
  }
  finally {
    await context.close()
  }
}

// Opens the fixed view and waits until it is fully drawn: the network is idle,
// every cover in view has loaded, and the web fonts are in.
async function openView(viewport, options) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 2,
    locale: 'en-GB',
    timezoneId: 'UTC',
    ...options,
  })
  const page = await context.newPage()
  await page.goto(BASE + VIEW, { waitUntil: 'networkidle' })

  const grid = page.locator('div.grid')
  if (!(await grid.count())) {
    const heading = await page.locator('main h2, section h2').first().textContent().catch(() => null)
    throw new Error(`the page shows no poster wall${heading ? ` but "${heading.trim()}"` : ''}`)
  }

  // Covers load lazily, so only the ones in view are ever requested. Wait for
  // those; a cover that fails to load is an error, not something to photograph.
  await page.waitForFunction(() => {
    const inView = [...document.querySelectorAll('div.grid img')].filter((img) => {
      const box = img.getBoundingClientRect()
      return box.bottom > 0 && box.top < window.innerHeight
    })
    return inView.length > 0 && inView.every((img) => img.complete)
  }, null, { timeout: 30_000 })
  const broken = await page.evaluate(() =>
    [...document.querySelectorAll('div.grid img')]
      .filter((img) => img.complete && img.naturalWidth === 0)
      .map((img) => img.alt))
  if (broken.length) throw new Error(`covers failed to load: ${broken.join(', ')}`)

  await page.evaluate(() => document.fonts.ready)
  const fontsLoaded = await page.evaluate(() =>
    document.fonts.check('1em "Bebas Neue"') && document.fonts.check('1em Inter'))
  if (!fontsLoaded) throw new Error('the web fonts did not load')

  return { context, page }
}

// Waits for CSS transitions (the hover zoom, the drawer's slide-in) to finish.
// Vue's <Transition> starts the CSS transition a frame after the element is
// inserted, and keeps its *-enter-* classes on it until the transition ends.
async function settle(page) {
  await page.waitForFunction(() =>
    !document.querySelector('[class*="-enter-"]')
    && document.getAnimations()
      .filter((a) => a instanceof CSSTransition)
      .every((a) => a.playState !== 'running'))
}

async function shoot() {
  browser = await chromium.launch()
  const shots = {}
  // PNGs of these photo-heavy views run to several MB, so they are JPEGs.
  const capture = (page) => page.screenshot({ type: 'jpeg', quality: 85 })

  await withView(DESKTOP, {}, async (page) => {
    shots['wall.jpg'] = await capture(page)

    // The first game tile in the first row (each row starts with a date tile).
    await page.locator('div.grid > .group').first().hover()
    await settle(page)
    shots['hover.jpg'] = await capture(page)
  })

  await withView(DESKTOP, {}, async (page) => {
    await page.getByRole('button', { name: /Filters/ }).click()
    await page.getByRole('dialog', { name: 'Filters' }).waitFor()
    await settle(page)
    shots['filters.jpg'] = await capture(page)
  })

  // isMobile applies the page's meta viewport as a phone browser would.
  await withView(PHONE, { isMobile: true, hasTouch: true }, async (page) => {
    shots['mobile.jpg'] = await capture(page)
  })

  // Write the set only once every shot succeeded, so a failed run never leaves
  // a mix of old and new images behind.
  await mkdir(OUT_DIR, { recursive: true })
  for (const [name, image] of Object.entries(shots)) {
    await writeFile(new URL(name, OUT_DIR), image)
    console.log(`screenshots: wrote docs/screenshots/${name}`)
  }
}

try {
  await startServer()
  console.log(`screenshots: server listening on ${BASE}, photographing ${VIEW}`)
  await shoot()
}
catch (error) {
  if (serverLog) console.error(serverLog)
  console.error(`screenshots: ${error.message}`)
  process.exitCode = 1
}
finally {
  await browser?.close()
  await stopServerAndWait()
}
