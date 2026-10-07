// Browser plumbing: one Chrome, a fresh context per unit of work (seeded from
// a snapshot of the demo data, acting as a role, in a theme and viewport),
// error capture, navigation with one retry and an app-ready wait.
import { mkdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { chromium } from 'playwright-core'
import {
  AXE_TAGS,
  options,
  ROLES,
  SHOTS_DIR,
  STORAGE,
  VIEWPORTS,
} from './config.mjs'
import { installHelpers } from './inpage.mjs'

const require = createRequire(import.meta.url)
const AXE_SOURCE = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8')

export async function launch() {
  return chromium.launch({
    executablePath: options.chrome,
    headless: !options.headed,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  })
}

let base = ''
let snapshot = null
export function setBase(url) {
  base = url
}
export function url(path) {
  return base + path
}
export function appPath(href) {
  if (!href) return null
  const u = new URL(href, base + '/')
  const prefix = new URL(base + '/').pathname.replace(/\/$/, '')
  return u.pathname.replace(prefix, '') + u.search
}

/**
 * Opens a context and page.
 * role: key of ROLES (default manager); viewport: key of VIEWPORTS;
 * theme: light | dark; fresh: true skips the seeded snapshot.
 */
export async function openPage(
  browser,
  {
    role = 'manager',
    viewport = '1440x900',
    theme = 'light',
    fresh = false,
  } = {},
) {
  const vp = VIEWPORTS[viewport]
  const origin = new URL(base).origin
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    isMobile: vp.touch,
    hasTouch: vp.touch,
    deviceScaleFactor: 1,
    colorScheme: theme,
    reducedMotion: 'reduce',
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
    acceptDownloads: true,
    storageState:
      snapshot && !fresh
        ? { cookies: [], origins: [{ origin, localStorage: snapshot }] }
        : undefined,
  })
  await context
    .grantPermissions(['clipboard-read', 'clipboard-write'], { origin })
    .catch(() => {})
  await context.addInitScript(installHelpers)
  await context.addInitScript(
    ({ keys, actor, theme }) => {
      try {
        if (localStorage.getItem(keys.actor) === null)
          localStorage.setItem(keys.actor, JSON.stringify(actor))
        if (localStorage.getItem(keys.theme) === null)
          localStorage.setItem(keys.theme, JSON.stringify(theme))
      } catch {
        // Storage can be unavailable; the app copes.
      }
    },
    { keys: STORAGE, actor: ROLES[role] ?? role, theme },
  )
  const page = await context.newPage()
  instrument(page)
  page.meta = { role, viewport, theme, touch: vp.touch }
  // Links that open a new tab: close those tabs, keep the page under test.
  context.on('page', (p) => {
    if (p !== page) p.close().catch(() => {})
  })
  return page
}

export async function closePage(page) {
  await page
    .context()
    .close()
    .catch(() => {})
}

/** Collects page errors, console errors and native dialogs on page.errors. */
function instrument(page) {
  page.errors = []
  page.on('pageerror', (e) =>
    page.errors.push(`pageerror: ${String(e.message || e).slice(0, 300)}`),
  )
  page.on('console', (m) => {
    if (m.type() !== 'error') return
    const text = m.text()
    page.errors.push(`console: ${text.slice(0, 300)}`)
  })
  page.on('dialog', (d) => {
    page.errors.push(`native ${d.type()} dialog: ${d.message().slice(0, 120)}`)
    d.dismiss().catch(() => {})
  })
  page.on('requestfailed', (r) => {
    const failure = r.failure()?.errorText ?? ''
    if (/ERR_ABORTED/.test(failure)) return
    page.errors.push(`request failed: ${r.url().replace(base, '')} ${failure}`)
  })
}

/** Takes errors collected since `from` (an index into page.errors). */
export function errorsSince(page, from) {
  return page.errors.slice(from)
}

/** Waits until the app shows a page: an h1 and no visible skeletons. */
export async function waitReady(page, { timeout = 15000 } = {}) {
  const end = Date.now() + timeout
  await page.waitForLoadState('domcontentloaded', { timeout }).catch(() => {})
  await page
    .waitForFunction(() => window.__e2e && document.querySelector('h1'), null, {
      timeout: Math.max(1000, end - Date.now()),
      polling: 100,
    })
    .catch(() => {})
  await page
    .waitForFunction(
      () =>
        ![...document.querySelectorAll('.skeleton')].some((el) =>
          window.__e2e.visible(el),
        ),
      null,
      {
        timeout: Math.max(500, Math.min(6000, end - Date.now())),
        polling: 100,
      },
    )
    .catch(() => {})
  // Lazy chunks have loaded once the h1 shows; give effects a moment.
  await page.waitForTimeout(200)
}

/** Navigates to an app path, retrying once on a navigation timeout. */
export async function go(page, path, { ready = true } = {}) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await page.goto(url(path), {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      })
      if (ready) await waitReady(page)
      return
    } catch (e) {
      if (attempt === 1) throw e
      await page.waitForTimeout(1000)
    }
  }
}

/** Seeds the demo once and keeps its localStorage for the other contexts. */
export async function makeSnapshot(browser) {
  const page = await openPage(browser, { fresh: true })
  await go(page, '/dashboard')
  await page.waitForTimeout(1500)
  const entries = await page.evaluate((keys) => {
    const out = []
    for (let i = 0; i < localStorage.length; i += 1) {
      const name = localStorage.key(i)
      if (name === keys.actor || name === keys.theme) continue
      out.push({ name, value: localStorage.getItem(name) })
    }
    return out
  }, STORAGE)
  const errors = [...page.errors]
  await closePage(page)
  snapshot = entries
  return { entries: entries.length, errors }
}

let shotCount = 0
export async function screenshot(page, label) {
  mkdirSync(SHOTS_DIR, { recursive: true })
  shotCount += 1
  const file = resolve(
    SHOTS_DIR,
    `${String(shotCount).padStart(4, '0')}-${label.replace(/[^\w.-]+/g, '_').slice(0, 80)}.png`,
  )
  try {
    await page.screenshot({ path: file, timeout: 5000 })
    return file
  } catch {
    return null
  }
}

/** axe-core serious and critical violations, for the page or one element. */
export async function axe(page, selector = null) {
  if (!(await page.evaluate(() => Boolean(window.axe))))
    await page.evaluate(AXE_SOURCE)
  return page.evaluate(
    async ({ selector, tags }) => {
      const ctx = selector ? document.querySelector(selector) : document
      if (!ctx) return []
      const res = await window.axe.run(ctx, {
        resultTypes: ['violations'],
        runOnly: { type: 'tag', values: tags },
      })
      return res.violations
        .filter((v) => v.impact === 'serious' || v.impact === 'critical')
        .map((v) => ({
          id: v.id,
          impact: v.impact,
          count: v.nodes.length,
          target: v.nodes[0]?.target?.join(' ').slice(0, 120) ?? '',
          summary: (v.nodes[0]?.failureSummary ?? v.help)
            .replace(/\s+/g, ' ')
            .slice(0, 220),
        }))
    },
    { selector, tags: AXE_TAGS },
  )
}
