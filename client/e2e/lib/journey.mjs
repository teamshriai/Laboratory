// A small step runner for the journeys: each step runs once, must end without
// an error toast or a crash, and a failure records the step, a screenshot and
// the accessibility tree of the page in e2e/results/. Later steps of a failed
// journey are skipped (they depend on it).
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ROLES, RESULTS_DIR, STORAGE } from './config.mjs'
import { appPath, closePage, errorsSince, go, openPage, screenshot } from './browser.mjs'
import { count, fail } from './report.mjs'

const SUITE = 'journeys'
const DEBUG = Boolean(process.env.E2E_DEBUG)

export class Journey {
  constructor(browser, id, title, viewport) {
    this.browser = browser
    this.id = id
    this.title = title
    this.viewport = viewport
    this.failed = false
    this.role = 'manager'
    this.data = {}
  }

  async open(role = 'manager') {
    this.role = role
    this.page = await openPage(this.browser, { role, viewport: this.viewport })
    return this.page
  }

  async close() {
    if (this.page) await closePage(this.page)
  }

  get touch() {
    return this.page.meta.touch
  }

  /** Acts as another member of staff (the "Acting as" preference) and opens a page. */
  async as(role, path) {
    this.role = role
    await this.page.evaluate(
      ({ key, id }) => localStorage.setItem(key, JSON.stringify(id)),
      { key: STORAGE.actor, id: ROLES[role] },
    )
    await go(this.page, path)
  }

  async go(path) {
    await go(this.page, path)
  }

  /** Clicks, or taps on a touch screen. */
  async press(locator, opts = {}) {
    await locator.scrollIntoViewIfNeeded({ timeout: 8000 }).catch(() => {})
    if (this.touch) await locator.tap({ timeout: 8000, ...opts })
    else await locator.click({ timeout: 8000, ...opts })
  }

  /** Opens a combobox or select and picks an option (the first one when `re` is null). */
  async pick(combobox, re = null) {
    const noListbox = () =>
      this.page.waitForFunction(
        () => ![...document.querySelectorAll('[role=listbox]')].some((l) => window.__e2e.visible(l)),
        null,
        { timeout: 5000 },
      )
    await noListbox()
    await this.press(combobox)
    const listbox = this.page.getByRole('listbox').last()
    await listbox.waitFor({ timeout: 8000 })
    const options = listbox.getByRole('option', re ? { name: re } : {})
    await this.press(options.first())
    await noListbox()
  }

  /** Waits for a toast whose text matches `re`; fails on an error toast. */
  async toast(re, timeout = 10000) {
    const page = this.page
    const end = Date.now() + timeout
    while (Date.now() < end) {
      const toasts = await page.evaluate(() => window.__e2e.toasts())
      const bad = toasts.find((t) => t.type === 'error')
      if (bad) throw new Error(`error toast: ${bad.text}`)
      const good = toasts.find((t) => re.test(t.text))
      if (good) {
        await page.evaluate(() => window.__e2e.markToasts())
        return good.text
      }
      await page.waitForTimeout(150)
    }
    throw new Error(`no toast matching ${re} within ${timeout} ms`)
  }

  /** A check that does not stop the journey (the next steps can go on). */
  async expect(label, ok, detail = '') {
    if (this.failed) return false
    if (ok) {
      count(SUITE, 'checks passed')
      return true
    }
    const shot = await screenshot(this.page, `journey-${this.id}-${this.viewport}-${label}`)
    fail({
      suite: SUITE,
      check: `journey ${this.id}`,
      route: appPath(this.page.url()),
      viewport: this.viewport,
      role: this.role,
      element: `${this.title}: check "${label}"`,
      symptom: 'expectation not met',
      detail,
      screenshot: shot,
    })
    return false
  }

  /**
   * Time fields have minute precision, so a record made in the same minute
   * as the event before it can be refused. Reports that, then retries once
   * the minute has turned. `attempt` must start from a fresh page.
   */
  async sameMinute(check, attempt, refusal) {
    try {
      return await attempt()
    } catch (e) {
      if (!refusal.test(e.message)) throw e
      await this.page.evaluate(() => window.__e2e.markToasts())
      await this.expect(check, false, `refused within the same minute: ${e.message}`)
      await this.page.waitForTimeout(61000 - (Date.now() % 60000))
      return attempt()
    }
  }

  /** Runs one step; returns its value, or undefined once the journey failed. */
  async step(label, fn) {
    if (this.failed) return undefined
    const page = this.page
    const from = page.errors.length
    const where = `[${this.id} ${this.viewport} as ${this.role}] ${label}`
    try {
      const value = await fn(page)
      const errors = errorsSince(page, from)
      if (errors.length) throw new Error(`errors during the step: ${errors.join(' || ')}`)
      const errorToast = (await page.evaluate(() => window.__e2e.toasts('error')))
        .map((t) => t.text)
        .join(' | ')
      if (errorToast) throw new Error(`error toast: ${errorToast}`)
      const boundary = await page.evaluate(() => window.__e2e?.pageState().boundary)
      if (boundary) throw new Error('error boundary shown ("Something went wrong")')
      count(SUITE, 'steps passed')
      if (DEBUG) console.log(`  ok ${where}`)
      return value
    } catch (e) {
      this.failed = true
      const shot = await screenshot(page, `journey-${this.id}-${this.viewport}-${label}`)
      const tree = await this.dumpTree(label)
      fail({
        suite: SUITE,
        check: `journey ${this.id}`,
        route: appPath(page.url()),
        viewport: this.viewport,
        role: this.role,
        element: `${this.title}: step "${label}"`,
        symptom: 'step failed',
        detail: `${e.message.split('\n')[0]}${tree ? ` (accessibility tree: ${tree})` : ''}`,
        screenshot: shot,
      })
      return undefined
    }
  }

  async dumpTree(label) {
    try {
      const yaml = await this.page.locator('body').ariaSnapshot({ timeout: 5000 })
      const dir = resolve(RESULTS_DIR, 'trees')
      mkdirSync(dir, { recursive: true })
      const file = resolve(dir, `${this.id}-${this.viewport}-${label.replace(/[^\w.-]+/g, '_').slice(0, 60)}.yaml`)
      writeFileSync(file, yaml)
      if (DEBUG) {
        const parts = []
        for (const sel of ['main', '[role=dialog]', '[role=alertdialog]'])
          for (const loc of await this.page.locator(sel).all())
            parts.push(await loc.ariaSnapshot({ timeout: 3000 }).catch(() => ''))
        console.log(parts.join('\n').slice(0, 9000))
      }
      return `e2e/results/trees/${file.split('/trees/')[1]}`
    } catch {
      return ''
    }
  }
}

/** Random capital letters (names may not contain digits). */
export function letters(n) {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  let out = a[Math.floor(Math.random() * a.length)]
  for (let i = 1; i < n; i += 1) out += a[Math.floor(Math.random() * a.length)].toLowerCase()
  return out
}
