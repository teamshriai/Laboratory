// Finds what to test: the routes in src/app/routes.tsx, the tab and section
// URLs from the screens' constants, detail pages behind the first link of
// each list page, and real record ids for the deep-link overlays.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { CLIENT_DIR, options } from './config.mjs'
import { appPath, closePage, go, openPage } from './browser.mjs'
import { runPool } from './pool.mjs'

const src = (p) => readFileSync(resolve(CLIENT_DIR, 'src', p), 'utf8')

/** Paths of every page route without parameters, from the route tree. */
export function staticRoutes() {
  const text = src('app/routes.tsx')
  const start = text.indexOf('export const routes')
  const frames = []
  const out = new Set()
  const token = /\{|\}|path:\s*'([^']*)'|index:\s*true|lazy:|element:/g
  let m
  token.lastIndex = start
  while ((m = token.exec(text))) {
    const t = m[0]
    if (t === '{') frames.push({ path: null, page: false })
    else if (t === '}') {
      const frame = frames.pop()
      if (!frame?.page) continue
      const parts = [...frames, frame]
        .map((f) => f.path)
        .filter((p) => p != null)
      const path =
        '/' + parts.join('/').replace(/\/+/g, '/').replace(/^\/+/, '')
      out.add(path === '/' ? '/' : path.replace(/\/$/, ''))
    } else if (m[1] !== undefined) {
      if (frames.length) frames.at(-1).path = m[1]
    } else if (frames.length) frames.at(-1).page = true
  }
  return [...out]
    .filter((p) => !p.includes(':') && !p.includes('*') && p !== '/')
    .sort()
}

/** The values of `const NAME = [ 'a', 'b' ]` in a source file. */
function constArray(file, name) {
  const text = src(file)
  const m = text.match(new RegExp(`const ${name}\\b[^=]*=\\s*\\[([^\\]]*)\\]`))
  if (!m) return []
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1])
}

const TAB_SOURCES = [
  ['/quality', 'tab', 'features/quality/quality.ts', 'QUALITY_TABS'],
  ['/registers', 'tab', 'features/registers/registers.ts', 'REGISTER_TABS'],
  ['/privacy', 'tab', 'features/privacy/privacy.ts', 'PRIVACY_TABS'],
  ['/interfaces', 'tab', 'features/interfaces/interfaces.ts', 'INTERFACE_TABS'],
  ['/settings', 'section', 'features/settings/settings-page.tsx', 'SECTIONS'],
  ['/messages', 'tab', 'features/messaging/messaging-page.tsx', 'TABS'],
  ['/referrers', 'tab', 'features/network/referrers-page.tsx', 'TABS'],
  ['/billing/masters', 'tab', 'features/billing/billing.ts', 'MASTER_TABS'],
]

/** ?tab= and ?section= URLs (the default tab is the plain route). */
export function tabRoutes() {
  const out = []
  for (const [path, param, file, name] of TAB_SOURCES) {
    let values = []
    try {
      values = constArray(file, name)
    } catch {
      // The file moved: the route sweep still covers the plain route.
    }
    for (const v of values.slice(1)) out.push(`${path}?${param}=${v}`)
  }
  return out
}

/** Pages worth a look beyond the route table. */
export const EXTRA_ROUTES = [
  '/dashboard?cal=month',
  '/verification?stage=authorise',
  '/collection?tab=collected',
  '/report/RPT-OLD-0001',
  '/no-such-page',
]

/** List page -> link to its first detail page (and the role to view it as). */
const DETAIL_SOURCES = [
  ['/patients', 'a[href*="/patients/"]', 'manager'],
  ['/reports', 'main a[href*="/reports/"]:not([href*="/imaging/"])', 'manager'],
  ['/reception?status=all', 'a[href*="/specimens/"]', 'manager'],
  ['/worklists', 'a[href*="/results/"]', 'manager'],
  [
    '/billing',
    'main a[href*="/billing/"]:not([href$="/day-book"]):not([href*="/masters"])',
    'manager',
  ],
  ['/imaging', 'a[href*="/imaging/reports/"]', 'manager'],
  ['/departments', 'main a[href*="/departments/"]', 'manager'],
  ['/my-patients', 'main a[href*="/my-patients/"]', 'doctor'],
]

/**
 * Overlays that open from the URL: [page, param, how to find a real id].
 * `null` means the param takes `1` (?new=1).
 */
export const DEEP_LINKS = [
  ['/patients', 'new', null],
  ['/quality-control', 'new', null],
  ['/reagents', 'new', null],
  ['/cold-storage', 'new', null],
  ['/home-collection', 'new', null],
  ['/orders', 'order', 'row'],
  ['/reception?status=all', 'sample', 'row'],
  ['/collection', 'collect', 'row'],
  ['/quality?tab=capa', 'nc', 'row'],
  ['/cold-storage', 'unit', 'row'],
  ['/home-collection', 'visit', 'row'],
  ['/privacy?tab=requests', 'request', 'row'],
  ['/privacy?tab=incidents', 'incident', 'row'],
  ['/messages', 'message', 'row'],
  ['/interfaces?tab=messages', 'message', 'row'],
  ['/quality?tab=documents', 'doc', 'row'],
  ['/quality?tab=audits', 'audit', 'row'],
  ['/quality?tab=lis', 'lis', 'row'],
  ['/inventory', 'item', 'row'],
]

/** Clicks the first row of the page's first list and reads the new URL param. */
async function idFromRow(page, param) {
  const before = new URL(page.url()).searchParams.get(param)
  const clicked = await page.evaluate(() => {
    const main = document.querySelector('main')
    if (!main) return false
    const hidden = [
      ...main.querySelectorAll(
        'td button.sr-only, td .sr-only button, tbody tr td button',
      ),
    ]
    const target =
      hidden[0] ??
      main.querySelector('tbody tr, [data-row], ul[role=list] > li button')
    if (!target) return false
    target.click()
    return true
  })
  if (!clicked) return null
  await page.waitForTimeout(600)
  const value = new URL(page.url()).searchParams.get(param)
  return value && value !== before ? value : null
}

/** Detail routes and deep-link ids, found in parallel pages. */
export async function discover(browser, { onNote }) {
  const details = []
  const deepLinks = []
  const jobs = [
    ...DETAIL_SOURCES.map(([list, selector, role], order) => ({
      kind: 'detail',
      order,
      list,
      selector,
      role,
    })),
    ...DEEP_LINKS.map(([list, param, how], order) => ({
      kind: 'deep',
      order,
      list,
      param,
      how,
      role: 'manager',
    })),
  ]
  await runPool(jobs, options.workers, async (job) => {
    if (job.kind === 'deep' && !job.how) {
      deepLinks.push({
        order: job.order,
        page: job.list,
        param: job.param,
        id: '1',
      })
      return
    }
    const page = await openPage(browser, {
      role: job.role,
      viewport: '1440x900',
    })
    try {
      await go(page, job.list)
      if (job.kind === 'detail') {
        const href = await page
          .locator(job.selector)
          .first()
          .getAttribute('href', { timeout: 4000 })
        const path = appPath(href)
        if (path)
          details.push({
            order: job.order,
            path: path.split('?')[0],
            role: job.role,
            from: job.list,
          })
      } else {
        const id = await idFromRow(page, job.param)
        if (id)
          deepLinks.push({
            order: job.order,
            page: job.list,
            param: job.param,
            id,
          })
        else
          onNote(
            `Could not discover a real id for ?${job.param}= on ${job.list} (clicking the first row did not set it)`,
          )
      }
    } catch (e) {
      onNote(
        `Discovery failed on ${job.list}: ${String(e.message).split('\n')[0]}`,
      )
    } finally {
      await closePage(page)
    }
  })
  const byOrder = (a, b) => a.order - b.order
  return { details: details.sort(byOrder), deepLinks: deepLinks.sort(byOrder) }
}

/** Every route the sweeps visit: [{ path, role }]. */
export function allRoutes(details) {
  const list = [
    ...staticRoutes().map((path) => ({
      path,
      role: path.startsWith('/my-patients') ? 'doctor' : 'manager',
    })),
    ...tabRoutes().map((path) => ({ path, role: 'manager' })),
    ...EXTRA_ROUTES.map((path) => ({ path, role: 'manager' })),
    ...details.map((d) => ({ path: d.path, role: d.role })),
  ]
  const seen = new Set()
  const unique = list.filter((r) =>
    seen.has(r.path) ? false : seen.add(r.path),
  )
  return options.only
    ? unique.filter((r) => options.only.some((o) => r.path.startsWith(o)))
    : unique
}
