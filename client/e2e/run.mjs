// SHRI HEALTH browser test runner. `npm run e2e` (full) or `npm run e2e:quick`.
// Starts `vite preview` of dist/ unless E2E_BASE points at a running build,
// runs the selected suites, writes e2e/results/report.json and summary.txt,
// and exits non-zero when anything failed.
import { HELP, options } from './lib/config.mjs'
import { launch, makeSnapshot, setBase } from './lib/browser.mjs'
import { allRoutes, discover } from './lib/discover.mjs'
import {
  fail,
  failureCount,
  note,
  resetResults,
  writeReport,
} from './lib/report.mjs'
import { startServer } from './lib/server.mjs'
import * as routesSuite from './suites/routes.mjs'
import * as interactionsSuite from './suites/interactions.mjs'
import * as journeysSuite from './suites/journeys.mjs'
import * as keyboardSuite from './suites/keyboard.mjs'

const SUITES = {
  routes: routesSuite,
  interactions: interactionsSuite,
  journeys: journeysSuite,
  keyboard: keyboardSuite,
}

if (options.help) {
  console.log(HELP)
  process.exit(0)
}

const startedAt = Date.now()
const mode = options.quick ? 'quick' : 'full'
resetResults()
const server = await startServer()
setBase(server.base)
console.log(
  `SHRI HEALTH e2e (${mode}) against ${server.base}, ${options.workers} workers`,
)

const browser = await launch()
let exitCode = 0
try {
  const seeded = await makeSnapshot(browser)
  for (const e of seeded.errors)
    fail({
      suite: 'routes',
      check: 'errors',
      route: '/dashboard',
      viewport: '1440x900',
      symptom: 'error on first load (seeding)',
      detail: e,
    })
  const { details, deepLinks } = await discover(browser, { onNote: note })
  const routes = allRoutes(details)
  console.log(
    `Discovered ${routes.length} routes (${details.length} detail pages), ${deepLinks.length} deep links`,
  )
  const ctx = { routes, deepLinks }
  for (const name of options.suites) {
    const t = Date.now()
    console.log(`\n== ${name} ==`)
    try {
      await SUITES[name].run(browser, ctx)
    } catch (e) {
      fail({
        suite: name,
        check: 'harness',
        symptom: 'suite crashed',
        detail: e.stack ?? String(e),
      })
    }
    console.log(`== ${name} done in ${Math.round((Date.now() - t) / 1000)}s ==`)
  }
} catch (e) {
  fail({
    suite: 'runner',
    check: 'harness',
    symptom: 'run crashed',
    detail: e.stack ?? String(e),
  })
} finally {
  await browser.close().catch(() => {})
  await server.stop()
  const { text } = writeReport({
    base: server.base,
    mode,
    startedAt,
    suites: options.suites,
  })
  console.log('\n' + text)
  console.log(
    'Full report: e2e/results/report.json, summary: e2e/results/summary.txt',
  )
  exitCode = failureCount() > 0 ? 1 : 0
}
process.exit(exitCode)
