// Shared configuration for the browser suites: paths, roles, viewports, the
// command line and the environment.
import { cpus } from 'node:os'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

export const E2E_DIR = fileURLToPath(new URL('..', import.meta.url))
export const CLIENT_DIR = resolve(E2E_DIR, '..')
export const RESULTS_DIR = resolve(E2E_DIR, 'results')
export const SHOTS_DIR = resolve(RESULTS_DIR, 'shots')

/** Staff ids of the demo seed, one per role the suites act as. */
export const ROLES = {
  manager: 'st_ganesh',
  technician: 'st_anjali',
  receptionist: 'st_shruthi',
  pathologist: 'st_kavitha',
  phlebotomist: 'st_kavya',
  doctor: 'st_dr_asha',
  owner: 'st_vasanth',
}

/** localStorage keys the app reads (src/lib/storage.ts adds the prefix). */
export const STORAGE = {
  prefix: 'shri-lims.',
  actor: 'shri-lims.acting-as',
  theme: 'shri-lims.theme',
}

/** Named viewports. `touch` emulates a phone (touch events, mobile UA). */
export const VIEWPORTS = {
  '320x568': { width: 320, height: 568, touch: true },
  '375x667': { width: 375, height: 667, touch: true },
  '390x844': { width: 390, height: 844, touch: true },
  '844x390': { width: 844, height: 390, touch: true },
  '768x1024': { width: 768, height: 1024, touch: false },
  '1024x768': { width: 1024, height: 768, touch: false },
  '1280x720': { width: 1280, height: 720, touch: false },
  '1440x900': { width: 1440, height: 900, touch: false },
  '1920x1080': { width: 1920, height: 1080, touch: false },
  '2560x1440': { width: 2560, height: 1440, touch: false },
}

/** Accessible names of actions the interaction sweep never clicks. */
export const DESTRUCTIVE =
  /\b(reset|delete|remove|withdraw|retire|dispose|reject|refund|release|authori[sz]e|merge|revoke|sign out|log ?out|end session)\b|cancel (the )?(order|visit|invoice|booking)|close (the )?day/i

export const AXE_TAGS = [
  'wcag2a',
  'wcag2aa',
  'wcag21a',
  'wcag21aa',
  'wcag22aa',
  'best-practice',
]

/** Text that means a component crashed (error boundaries, route errors). */
export const BOUNDARY_TEXT =
  /something went wrong|this record could not be shown/i
/** A query failed and the screen shows its error state. */
export const LOAD_ERROR_TEXT = /we could not load this/i
/** A record id that does not exist. */
export const NOT_FOUND_TEXT =
  /not found|could not (find|be found)|no longer (exists|available)|does not exist/i

function parseArgs(argv) {
  const out = { quick: false, suites: null, only: null, workers: null }
  for (const arg of argv) {
    if (arg === '--quick') out.quick = true
    else if (arg === '--headed') out.headed = true
    else if (arg.startsWith('--suite=')) out.suites = arg.slice(8).split(',')
    else if (arg.startsWith('--only=')) out.only = arg.slice(7).split(',')
    else if (arg.startsWith('--workers=')) out.workers = Number(arg.slice(10))
    else if (arg === '--help' || arg === '-h') out.help = true
    else throw new Error(`Unknown argument ${arg} (try --help)`)
  }
  return out
}

const args = parseArgs(process.argv.slice(2))

export const HELP = `Usage: node e2e/run.mjs [--quick] [--suite=routes,interactions,journeys,keyboard]
                        [--only=/patients,/orders] [--workers=N] [--headed]

Environment:
  E2E_BASE     URL of a running build, e.g. http://127.0.0.1:18080/dev/laboratory
               (default: vite preview of dist/ on a free port)
  E2E_CHROME   Chrome or Chromium executable (default /usr/bin/google-chrome)
  E2E_WORKERS  pages run in parallel (default: half the CPU cores, at most 6)
  BASE_PATH    base path of the build when previewing (default /dev/laboratory/)`

export const SUITES = ['routes', 'interactions', 'journeys', 'keyboard']

export const options = {
  help: Boolean(args.help),
  quick: args.quick,
  headed: Boolean(args.headed),
  suites: args.suites ?? SUITES,
  only: args.only,
  workers:
    args.workers ||
    Number(process.env.E2E_WORKERS) ||
    Math.max(2, Math.min(6, Math.floor(cpus().length / 2))),
  chrome: process.env.E2E_CHROME || '/usr/bin/google-chrome',
  base: process.env.E2E_BASE?.replace(/\/+$/, '') || null,
  basePath: process.env.BASE_PATH || '/dev/laboratory/',
}

for (const s of options.suites)
  if (!SUITES.includes(s)) throw new Error(`Unknown suite ${s}`)

/** The viewport and theme matrix of each suite, full or quick. */
export const MATRIX = options.quick
  ? {
      routes: [
        ['390x844', 'light'],
        ['1440x900', 'light'],
      ],
      axe: [['1440x900', 'light']],
      interactions: ['1440x900', '390x844'],
      interactionRoles: ['manager', 'technician', 'receptionist', 'doctor'],
      triggerCap: 6,
      interactionTabs: false,
      deepLinkViewports: ['390x844'],
      journeyViewports: ['1440x900'],
      keyboardStops: 30,
    }
  : {
      routes: [
        ...Object.keys(VIEWPORTS).map((v) => [v, 'light']),
        ['390x844', 'dark'],
        ['1440x900', 'dark'],
      ],
      axe: [
        ['1440x900', 'light'],
        ['1440x900', 'dark'],
        ['390x844', 'light'],
      ],
      interactions: ['1440x900', '390x844', '320x568'],
      interactionRoles: ['manager', 'technician', 'receptionist', 'doctor'],
      triggerCap: 30,
      interactionTabs: true,
      deepLinkViewports: ['1440x900', '390x844', '320x568'],
      journeyViewports: ['1440x900', '390x844'],
      keyboardStops: 60,
    }
