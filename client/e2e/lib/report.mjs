// Collects failures from every suite and writes results/report.json and a
// readable results/summary.txt.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import { CLIENT_DIR, RESULTS_DIR } from './config.mjs'

const failures = []
const notes = []
const stats = {}

export function resetResults() {
  rmSync(RESULTS_DIR, { recursive: true, force: true })
  mkdirSync(RESULTS_DIR, { recursive: true })
}

/**
 * Records one failure.
 * { suite, check, route, viewport, theme, role, element, symptom, detail, screenshot }
 */
export function fail(entry) {
  const f = {
    theme: 'light',
    ...entry,
    screenshot: entry.screenshot
      ? relative(CLIENT_DIR, entry.screenshot)
      : undefined,
  }
  failures.push(f)
  const where = [f.route, f.viewport, f.theme === 'dark' ? 'dark' : '', f.role]
    .filter(Boolean)
    .join(' ')
  console.log(
    `  FAIL [${f.suite}/${f.check}] ${where}${f.element ? ` | ${f.element}` : ''} | ${f.symptom}${
      f.detail ? ` | ${String(f.detail).slice(0, 200)}` : ''
    }`,
  )
}

/** Something worth knowing that is not a failure (e.g. nothing to test). */
export function note(text) {
  notes.push(text)
}

export function count(suite, key, n = 1) {
  stats[suite] ??= {}
  stats[suite][key] = (stats[suite][key] ?? 0) + n
}

export function failureCount() {
  return failures.length
}

/** Same symptom on many routes/viewports collapses into one group. */
function groupKey(f) {
  const symptom = String(f.symptom)
    .replace(/\d+px/g, 'Npx')
    .replace(/\(box [^)]*\)/g, '')
    .replace(/\d+x\d+ viewport/g, 'viewport')
  return `${f.suite} | ${f.check} | ${f.element ?? ''} | ${symptom}`
}

export function writeReport({ base, mode, startedAt, suites }) {
  const seconds = Math.round((Date.now() - startedAt) / 1000)
  const report = {
    base,
    mode,
    suites,
    startedAt: new Date(startedAt).toISOString(),
    seconds,
    stats,
    failureCount: failures.length,
    failures,
    notes,
  }
  writeFileSync(
    resolve(RESULTS_DIR, 'report.json'),
    JSON.stringify(report, null, 2),
  )

  const groups = new Map()
  for (const f of failures) {
    const k = groupKey(f)
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k).push(f)
  }
  const lines = [
    `SHRI HEALTH browser tests (${mode}) against ${base}`,
    `Started ${report.startedAt}, ${Math.floor(seconds / 60)}m ${seconds % 60}s, suites: ${suites.join(', ')}`,
    '',
    'Checks run:',
    ...Object.entries(stats).map(
      ([suite, s]) =>
        `  ${suite}: ${Object.entries(s)
          .map(([k, v]) => `${k} ${v}`)
          .join(', ')}`,
    ),
    '',
    `${failures.length} failure(s) in ${groups.size} group(s).`,
    '',
  ]
  const sorted = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  for (const [k, list] of sorted) {
    lines.push(`* ${k}  (${list.length}x)`)
    for (const f of list.slice(0, 12)) {
      const where = [
        f.route,
        f.viewport,
        f.theme === 'dark' ? 'dark' : '',
        f.role,
      ]
        .filter(Boolean)
        .join(' ')
      lines.push(
        `    - ${where}${f.detail ? `: ${String(f.detail).replace(/\s+/g, ' ').slice(0, 260)}` : ''}${
          f.screenshot ? ` [${f.screenshot}]` : ''
        }`,
      )
    }
    if (list.length > 12)
      lines.push(`    ... and ${list.length - 12} more (see report.json)`)
  }
  if (notes.length) lines.push('', 'Notes:', ...notes.map((n) => `  - ${n}`))
  const text = lines.join('\n') + '\n'
  writeFileSync(resolve(RESULTS_DIR, 'summary.txt'), text)
  return { text, seconds }
}
