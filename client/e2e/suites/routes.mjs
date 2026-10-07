// Suite 1, route sweep: every route at every viewport (light, plus dark on a
// phone and a desktop): page and console errors, error boundaries, failed
// queries, a missing h1, horizontal overflow, the end of the page hidden by
// the bottom navigation or the AI launcher; then axe (serious and critical).
import { MATRIX, options } from '../lib/config.mjs'
import {
  axe,
  closePage,
  errorsSince,
  go,
  openPage,
  screenshot,
} from '../lib/browser.mjs'
import { count, fail } from '../lib/report.mjs'
import { runPool } from '../lib/pool.mjs'

const SUITE = 'routes'

function chunks(routes, size) {
  const byRole = new Map()
  for (const r of routes) {
    if (!byRole.has(r.role)) byRole.set(r.role, [])
    byRole.get(r.role).push(r)
  }
  const out = []
  for (const list of byRole.values())
    for (let i = 0; i < list.length; i += size)
      out.push(list.slice(i, i + size))
  return out
}

async function checkRoute(page, route) {
  const { viewport, theme, role } = page.meta
  const where = { suite: SUITE, route: route.path, viewport, theme, role }
  const from = page.errors.length
  try {
    await go(page, route.path)
  } catch (e) {
    fail({
      ...where,
      check: 'load',
      symptom: 'page did not load',
      detail: e.message.split('\n')[0],
    })
    return
  }
  count(SUITE, 'page loads')
  const st = await page.evaluate(() => window.__e2e.pageState())
  const covered = await page.evaluate(() => window.__e2e.coveredAtEnd())
  const errors = errorsSince(page, from)
  const found = []
  if (errors.length)
    found.push({
      check: 'errors',
      symptom: 'errors while loading',
      detail: errors.join(' || '),
    })
  if (st.boundary)
    found.push({
      check: 'boundary',
      symptom: 'error boundary shown ("Something went wrong")',
    })
  if (st.loadError)
    found.push({
      check: 'load-error',
      symptom: 'a query failed ("We could not load this")',
    })
  if (!st.h1) found.push({ check: 'h1', symptom: 'no h1 on the page' })
  if (route.path === '/no-such-page') {
    if (!st.notFoundPage)
      found.push({
        check: 'not-found',
        symptom: 'an unknown path does not say "Page not found"',
      })
  } else if (st.notFoundPage)
    found.push({ check: 'not-found', symptom: 'route shows "Page not found"' })
  if (st.skeletons)
    found.push({
      check: 'loading',
      symptom: `still loading: ${st.skeletons} skeleton(s) after 15 s`,
    })
  if (st.overflow > 1)
    found.push({
      check: 'overflow',
      symptom: `page scrolls sideways by ${st.overflow}px`,
      detail: st.culprit ? `widest element: ${st.culprit}` : '',
    })
  if (covered) found.push({ check: 'covered', symptom: covered })
  if (found.length) {
    const shot = await screenshot(
      page,
      `routes-${route.path}-${viewport}-${theme}`,
    )
    for (const f of found) fail({ ...where, ...f, screenshot: shot })
  }
}

async function axeRoute(page, route) {
  const { viewport, theme, role } = page.meta
  try {
    await go(page, route.path)
    const violations = await axe(page)
    count(SUITE, 'axe scans')
    for (const v of violations)
      fail({
        suite: SUITE,
        check: 'axe',
        route: route.path,
        viewport,
        theme,
        role,
        element: v.target,
        symptom: `axe ${v.impact}: ${v.id} (${v.count} node${v.count > 1 ? 's' : ''})`,
        detail: v.summary,
      })
  } catch (e) {
    fail({
      suite: SUITE,
      check: 'axe',
      route: route.path,
      viewport,
      theme,
      role,
      symptom: 'axe could not run',
      detail: e.message.split('\n')[0],
    })
  }
}

export async function run(browser, { routes }) {
  const units = []
  for (const [viewport, theme] of MATRIX.routes)
    for (const chunk of chunks(routes, 12))
      units.push({ viewport, theme, chunk, job: checkRoute })
  for (const [viewport, theme] of MATRIX.axe)
    for (const chunk of chunks(routes, 12))
      units.push({ viewport, theme, chunk, job: axeRoute })
  console.log(`[routes] ${routes.length} routes, ${units.length} units of work`)
  await runPool(
    units,
    options.workers,
    async (u) => {
      const page = await openPage(browser, {
        role: u.chunk[0].role,
        viewport: u.viewport,
        theme: u.theme,
      })
      try {
        for (const r of u.chunk) await u.job(page, r)
      } finally {
        await closePage(page)
      }
    },
    (u, e) =>
      fail({
        suite: SUITE,
        check: 'harness',
        viewport: u.viewport,
        theme: u.theme,
        symptom: 'unit crashed',
        detail: e.message,
      }),
  )
}
