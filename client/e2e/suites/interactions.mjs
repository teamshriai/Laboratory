// Suite 2, interaction sweep: on every route, as several roles and on a
// desktop and phones, click each visible enabled button, tab and menu trigger
// (never destructive ones), one at a time. After each click: errors, error
// boundaries, error toasts and sideways overflow; for an overlay that opens:
// it fits the viewport, its last control can be reached and is not covered,
// Escape closes it, focus returns sensibly, and axe finds nothing serious in
// it. Then the deep-link overlays (?new=1, ?order=..., an unknown id) and, on
// touch screens, the reason a disabled action gives when tapped.
import {
  DESTRUCTIVE,
  MATRIX,
  NOT_FOUND_TEXT,
  options,
  VIEWPORTS,
} from '../lib/config.mjs'
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

const SUITE = 'interactions'
/** Never clicked in the sweep: destructive actions, demo failure switches, other languages. */
const SKIP = new RegExp(
  `${DESTRUCTIVE.source}|simulate|[\\u0900-\\u097F\\u0B80-\\u0BFF\\u0C80-\\u0CFF\\u0D00-\\u0D7F]`,
  'i',
).source
const SHELL_SCOPES = ['header', 'nav.bottom-nav']

const errorToast = async (page) => {
  const list = await page.evaluate(() => window.__e2e.toasts('error'))
  await page.evaluate(() => window.__e2e.markToasts())
  return list.map((t) => t.text).join(' | ')
}

/** The app stays in English, whatever a click on a settings page did. */
async function ensureEnglish(page, path) {
  const lang = await page.evaluate(() => document.documentElement.lang || 'en')
  if (lang.startsWith('en')) return
  await page.evaluate(() =>
    localStorage.setItem('shri-lims.language', JSON.stringify('en')),
  )
  await go(page, path)
}

/** Waits for an overlay to finish opening, or for nothing to happen. */
async function settle(page, url) {
  await page
    .waitForFunction(
      (url) =>
        window.__e2e.newOverlays().length > 0 ||
        location.pathname + location.search !== url,
      url,
      { timeout: 400, polling: 50 },
    )
    .catch(() => {})
  await page.waitForTimeout(120)
}

/**
 * Checks an open overlay (marked data-e2e-ov), presses Escape and checks it
 * closed and where focus went. Returns true when the page needs a reload.
 */
async function exerciseOverlay(
  page,
  where,
  { focusCheck = true, axeDone = null } = {},
) {
  const res = await page.evaluate(async () => {
    const el = document.querySelector('[data-e2e-ov]')
    await window.__e2e.settleAnimations(el)
    const overflow = document.scrollingElement.scrollWidth - window.innerWidth
    return { ...window.__e2e.checkOverlay(el), overflow }
  })
  count(SUITE, 'overlays checked')
  const found = res.issues.map((symptom) => ({
    check: 'overlay-layout',
    symptom,
  }))
  if (res.overflow > 1)
    found.push({
      check: 'overflow',
      symptom: `${res.label} open: page scrolls sideways by ${res.overflow}px`,
    })
  let violations = []
  // The same dialog is scanned once per route and viewport, whoever opens it.
  const axeKey = `${where.viewport} ${where.route} ${res.label}`
  try {
    if (!axeDone?.has(axeKey)) {
      axeDone?.add(axeKey)
      violations = await axe(page, '[data-e2e-ov]')
      count(SUITE, 'overlay axe scans')
    }
  } catch (e) {
    found.push({
      check: 'axe',
      symptom: 'axe could not run in the overlay',
      detail: e.message.split('\n')[0],
    })
  }
  for (const v of violations)
    found.push({
      check: 'overlay-axe',
      symptom: `${res.label}: axe ${v.impact} ${v.id} (${v.count})`,
      detail: `${v.target} :: ${v.summary}`,
    })
  let reload = false
  await page.keyboard.press('Escape')
  const closed = await page
    .waitForFunction(
      () => {
        const el = document.querySelector('[data-e2e-ov]')
        return (
          !el ||
          !window.__e2e.visible(el) ||
          el.getAttribute('data-state') === 'closed'
        )
      },
      null,
      { timeout: 900, polling: 50 },
    )
    .then(() => true)
    .catch(() => false)
  if (!closed) {
    found.push({
      check: 'escape',
      symptom: `${res.label}: one Escape does not close it`,
    })
    reload = true
  } else if (focusCheck) {
    await page.waitForTimeout(80)
    const focus = await page.evaluate(() => window.__e2e.focusReport())
    if (!focus.ok)
      found.push({
        check: 'focus-return',
        symptom: `${res.label}: ${focus.symptom}`,
      })
  }
  if (found.length) {
    const shot = closed
      ? null
      : await screenshot(page, `overlay-${where.route}-${where.viewport}`)
    for (const f of found) fail({ ...where, ...f, screenshot: shot })
  }
  return reload
}

async function clickOne(page, cand, scopes, where, shared) {
  const marked = await page.evaluate(
    ({ scopes, skip, key }) => {
      for (const el of document.querySelectorAll('[data-e2e-trigger]'))
        el.removeAttribute('data-e2e-trigger')
      const list = window.__e2e.collect(scopes, skip)
      const hit = list.find((c) => c.key === key)
      if (!hit) return false
      const el = document.querySelector(`[data-e2e-c="${hit.i}"]`)
      el.setAttribute('data-e2e-trigger', '')
      window.__e2e.markOverlays()
      return true
    },
    { scopes, skip: SKIP, key: cand.key },
  )
  if (!marked) return { skipped: true }
  const before = await page.evaluate(() => ({
    url: location.pathname + location.search,
    overflow: document.scrollingElement.scrollWidth - window.innerWidth,
  }))
  const from = page.errors.length
  const trigger = page.locator('[data-e2e-trigger]')
  try {
    // A visually hidden row button is reached by keyboard: focus, Enter.
    if (cand.hidden) {
      await trigger.focus()
      await page.keyboard.press('Enter')
    } else if (page.meta.touch) await trigger.tap({ timeout: 3000 })
    else await trigger.click({ timeout: 3000 })
  } catch (e) {
    const msg = e.message
      .split('\n')
      .find((l) =>
        /intercepts pointer events|not visible|outside of the viewport/.test(l),
      )
    fail({
      ...where,
      check: 'click',
      element: `${cand.role} "${cand.name}"`,
      symptom: msg
        ? 'cannot be clicked: something covers it or it is off-screen'
        : 'click failed',
      detail: (msg ?? e.message.split('\n')[0]).trim().slice(0, 240),
      screenshot: await screenshot(
        page,
        `click-${where.route}-${where.viewport}`,
      ),
    })
    return { reload: true }
  }
  count(SUITE, 'clicks')
  await settle(page, before.url)
  const element = `${cand.role} "${cand.name}"`
  const at = { ...where, element }
  const after = await page.evaluate(() => ({
    url: location.pathname + location.search,
    state: window.__e2e.pageState(),
    overlays: window.__e2e.newOverlays().length,
  }))
  let reload = after.url !== before.url
  if (after.url.split('?')[0] !== before.url.split('?')[0]) {
    // A link-like button: check the page it opened.
    await page.waitForTimeout(400)
    after.state = await page.evaluate(() => window.__e2e.pageState())
  }
  const errors = errorsSince(page, from)
  if (errors.length)
    fail({
      ...at,
      check: 'errors',
      symptom: 'errors after the click',
      detail: errors.join(' || '),
    })
  if (after.state.boundary) {
    fail({
      ...at,
      check: 'boundary',
      symptom: 'error boundary after the click',
      detail: after.url,
      screenshot: await screenshot(
        page,
        `boundary-${where.route}-${where.viewport}`,
      ),
    })
    return { reload: true }
  }
  const toast = await errorToast(page)
  if (toast) {
    fail({
      ...at,
      check: 'error-toast',
      symptom: 'error toast after the click',
      detail: toast,
    })
  }
  if (after.overlays) {
    await page.evaluate(() => {
      for (const el of document.querySelectorAll('[data-e2e-ov]'))
        el.removeAttribute('data-e2e-ov')
      window.__e2e.newOverlays().at(-1).setAttribute('data-e2e-ov', '')
    })
    if (await exerciseOverlay(page, at, { axeDone: shared.axeDone }))
      reload = true
    const still = await page.evaluate(() => window.__e2e.newOverlays().length)
    if (still) reload = true
  } else if (
    after.state.overflow > 1 &&
    before.overflow <= 1 &&
    after.url === before.url
  ) {
    fail({
      ...at,
      check: 'overflow',
      symptom: `page scrolls sideways by ${after.state.overflow}px after the click`,
      detail: after.state.culprit,
    })
  }
  return { reload, url: after.url }
}

/** Tapping a disabled GuardedButton on a phone must show who may do it. */
async function guardedOnTouch(page, where, route, tapped) {
  const list = await page.evaluate(() => window.__e2e.guarded())
  let n = 0
  for (const g of list) {
    const key = `${where.viewport} ${g.name.replace(/\d+/g, '#')}`
    if (tapped.has(key) || n >= 2) continue
    tapped.add(key)
    n += 1
    await go(page, route)
    const again = await page.evaluate(() => window.__e2e.guarded())
    const hit = again.find((x) => x.name === g.name)
    if (!hit) continue
    try {
      await page.locator(`[data-e2e-g="${hit.i}"]`).tap({ timeout: 3000 })
    } catch {
      continue
    }
    await page.waitForTimeout(500)
    const text = await page.evaluate(() => window.__e2e.tooltipText())
    count(SUITE, 'disabled actions tapped')
    if (!text)
      fail({
        ...where,
        check: 'guarded-touch',
        element: `button "${g.name}" (disabled)`,
        symptom: 'tapping a disabled action shows no reason on a touch screen',
      })
  }
}

async function sweepRoute(page, unit, shared) {
  const { route, role, viewport, shell } = unit
  const where = { suite: SUITE, route: route.path, viewport, role }
  await go(page, route.path)
  await ensureEnglish(page, route.path)
  const scopes = shell ? ['main', ...SHELL_SCOPES] : ['main']
  const all = await page.evaluate(
    ({ scopes, skip }) => window.__e2e.collect(scopes, skip),
    { scopes, skip: SKIP },
  )
  const doneKey = `${viewport} ${route.path}`
  const done = shared.tested.get(doneKey) ?? new Set()
  // Other roles only click what the first role did not already cover here.
  const cands = all.filter((c) => !done.has(c.key)).slice(0, MATRIX.triggerCap)
  count(SUITE, 'route visits')
  let reload = false
  for (const cand of cands) {
    if (reload) {
      await go(page, route.path)
      await ensureEnglish(page, route.path)
      reload = false
    }
    const res = await clickOne(page, cand, scopes, where, shared)
    if (!res.skipped) done.add(cand.key)
    reload = Boolean(res.reload)
  }
  // Everything the first role could click here, not only what it did:
  // the other roles then click only what is new for them.
  if (unit.first) shared.tested.set(doneKey, new Set([...done, ...all.map((c) => c.key)]))
  if (VIEWPORTS[viewport].touch)
    await guardedOnTouch(page, where, route.path, shared.tapped)
}

/** Several routes in one context (one role, one viewport), a route at a time. */
async function sweepChunk(browser, chunk, shared) {
  const { role, viewport } = chunk[0]
  let page = await openPage(browser, { role, viewport })
  try {
    for (const unit of chunk) {
      try {
        await sweepRoute(page, unit, shared)
      } catch (e) {
        fail({
          suite: SUITE,
          check: 'harness',
          route: unit.route.path,
          viewport,
          role,
          symptom: 'route sweep crashed',
          detail: e.message.split('\n')[0],
        })
        await closePage(page)
        page = await openPage(browser, { role, viewport })
      }
    }
  } finally {
    await closePage(page)
  }
}

async function deepLink(browser, viewport, link) {
  const page = await openPage(browser, { role: 'manager', viewport })
  try {
    const sep = link.page.includes('?') ? '&' : '?'
    const path = `${link.page}${sep}${link.param}=${encodeURIComponent(link.id)}`
    const where = { suite: SUITE, route: path, viewport, role: 'manager' }
    const from = page.errors.length
    await go(page, path)
    await page.waitForTimeout(300)
    count(SUITE, 'deep links')
    const st = await page.evaluate(() => {
      const list = window.__e2e.overlays()
      for (const el of document.querySelectorAll('[data-e2e-ov]'))
        el.removeAttribute('data-e2e-ov')
      list.at(-1)?.setAttribute('data-e2e-ov', '')
      return { overlays: list.length, state: window.__e2e.pageState() }
    })
    const errors = errorsSince(page, from)
    if (errors.length)
      fail({
        ...where,
        check: 'errors',
        symptom: 'errors opening the deep link',
        detail: errors.join(' || '),
      })
    if (st.state.boundary)
      fail({
        ...where,
        check: 'boundary',
        symptom: 'error boundary on the deep link',
        screenshot: await screenshot(
          page,
          `deeplink-${link.param}-${viewport}`,
        ),
      })
    else if (!st.overlays)
      fail({
        ...where,
        check: 'deep-link',
        symptom: `?${link.param}= opened no dialog or drawer`,
        screenshot: await screenshot(
          page,
          `deeplink-${link.param}-${viewport}`,
        ),
      })
    else {
      await exerciseOverlay(page, where, { focusCheck: false })
      const left = new URL(page.url()).searchParams.get(link.param)
      if (left)
        fail({
          ...where,
          check: 'deep-link',
          symptom: `closing the overlay leaves ?${link.param}= in the URL`,
        })
    }
    if (link.param === 'new') return
    // An id that does not exist: a message, not a crash or a blank.
    const bad = `${link.page}${sep}${link.param}=e2e-unknown-404`
    const whereBad = { ...where, route: bad }
    const from2 = page.errors.length
    await go(page, bad)
    await page.waitForTimeout(300)
    const res = await page.evaluate(() => {
      const ov = window.__e2e.overlays()
      const text = ov.length
        ? ov.map((o) => o.innerText).join(' ')
        : (document.querySelector('main')?.innerText ?? '')
      return { overlays: ov.length, text, state: window.__e2e.pageState() }
    })
    const errors2 = errorsSince(page, from2)
    if (errors2.length)
      fail({
        ...whereBad,
        check: 'errors',
        symptom: 'errors on a deep link with an unknown id',
        detail: errors2.join(' || '),
      })
    if (res.state.boundary)
      fail({
        ...whereBad,
        check: 'boundary',
        symptom: 'error boundary on a deep link with an unknown id',
        screenshot: await screenshot(page, `unknown-${link.param}-${viewport}`),
      })
    else if (!NOT_FOUND_TEXT.test(res.text))
      fail({
        ...whereBad,
        check: 'deep-link-unknown',
        symptom: `unknown ?${link.param}= id shows no not-found message`,
        detail: res.overlays
          ? `an overlay opened, saying: ${res.text.replace(/\s+/g, ' ').trim().slice(0, 140)}`
          : 'nothing tells the user the record does not exist',
        screenshot: await screenshot(page, `unknown-${link.param}-${viewport}`),
      })
  } finally {
    await closePage(page)
  }
}

export async function run(browser, { routes, deepLinks: links }) {
  const shared = { tested: new Map(), tapped: new Set(), axeDone: new Set() }
  const home = (role) => (role === 'doctor' ? '/my-patients' : '/dashboard')
  const chunks = (roles, first) => {
    const out = []
    for (const viewport of MATRIX.interactions)
      for (const role of roles) {
        const list = routes
          .filter(
            (r) => r.path !== '/no-such-page' && !r.path.startsWith('/report/'),
          )
          // Quick runs leave the ?tab= and ?section= variants to the route sweep.
          .filter((r) => MATRIX.interactionTabs || !r.path.includes('?'))
          .filter((r) => role === 'doctor' || r.role !== 'doctor')
          .map((route) => ({
            route,
            role,
            viewport,
            first,
            shell: route.path === home(role),
          }))
        for (let i = 0; i < list.length; i += 4) out.push(list.slice(i, i + 4))
      }
    return out
  }
  const onError = (chunk, e) =>
    fail({
      suite: SUITE,
      check: 'harness',
      route: chunk[0].route.path,
      viewport: chunk[0].viewport,
      role: chunk[0].role,
      symptom: 'unit crashed',
      detail: e.message.split('\n')[0],
    })
  const roles = MATRIX.interactionRoles
  const first = chunks(roles.slice(0, 1), true)
  const rest = chunks(roles.slice(1), false)
  console.log(
    `[interactions] ${first.length} chunks as ${roles[0]}, then ${rest.length} as ${roles.slice(1).join(', ')}`,
  )
  await runPool(
    first,
    options.workers,
    (c) => sweepChunk(browser, c, shared),
    onError,
  )
  await runPool(
    rest,
    options.workers,
    (c) => sweepChunk(browser, c, shared),
    onError,
  )
  const deep = options.only
    ? links.filter((l) => options.only.some((o) => l.page.startsWith(o)))
    : links
  console.log(
    `[interactions] ${deep.length} deep links at ${MATRIX.deepLinkViewports.join(', ')}`,
  )
  const jobs = MATRIX.deepLinkViewports.flatMap((viewport) =>
    deep.map((link) => ({ viewport, link })),
  )
  await runPool(
    jobs,
    options.workers,
    (j) => deepLink(browser, j.viewport, j.link),
    (j, e) =>
      fail({
        suite: SUITE,
        check: 'harness',
        route: j.link.page,
        viewport: j.viewport,
        symptom: 'deep-link unit crashed',
        detail: e.message.split('\n')[0],
      }),
  )
}
