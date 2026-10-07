import { fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { LabDb } from '@/mock/db/schema'
import { AppProviders } from '@/app/providers'
import { routes } from '@/app/routes'
import { legacyPath } from '@/app/legacy-paths'
import { getDb, startMemoryDb } from '@/mock/db/store'
import { actingAs, STAFF } from '@/mock/api/testing'

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  )
}

const SCREENS: [string, RegExp][] = [
  ['/dashboard', /^good (morning|afternoon|evening)/i],
  ['/work-queue', /^work queue$/i],
  ['/patients', /^patients$/i],
  ['/test-catalog', /^test catalog$/i],
  ['/inventory', /^inventory$/i],
  ['/reagents', /^reagents$/i],
  ['/consumables', /^consumables$/i],
  ['/equipment', /^equipment$/i],
  ['/quality-control', /^quality control$/i],
  ['/tat', /^tat monitoring$/i],
  ['/analytics', /^analytics$/i],
  ['/settings', /^settings$/i],
  ['/users', /^users and roles$/i],
  ['/audit-log', /^audit log$/i],
  ['/imaging', /^diagnostic imaging$/i],
  ['/imaging/ct', /^ct$/i],
  ['/imaging/mri', /^mri$/i],
  ['/imaging/x-ray', /^x-ray$/i],
]

// Every other screen, detail pages included: each must render its page
// heading, never the error screen.
let db: LabDb
const firstId = (table: Record<string, { id: string }>) =>
  Object.values(table)[0]!.id
const DETAIL: [string, () => string][] = [
  ['patient', () => `/patients/${firstId(db.patients)}`],
  ['orders', () => '/orders'],
  ['new order', () => '/orders/new'],
  ['collection', () => '/collection'],
  ['samples', () => '/reception'],
  [
    'sample',
    () =>
      `/specimens/${Object.values(db.samples).find((x) => x.accessionNo)!.id}`,
  ],
  ['results', () => '/worklists'],
  [
    'result entry',
    () =>
      `/results/${Object.values(db.samples).find((x) => x.status === 'processing')!.id}`,
  ],
  ['validation', () => '/verification'],
  ['reports', () => '/reports'],
  ['report', () => `/reports/${firstId(db.reports)}`],
  ['critical values', () => '/critical-results'],
  ['departments', () => '/departments'],
  ['department', () => '/departments/hematology'],
  [
    'imaging report',
    () =>
      `/imaging/reports/${Object.values(db.imaging).find((s) => s.versions.length > 0)!.id}`,
  ],
  ['billing', () => '/billing'],
  ['invoice', () => `/billing/${firstId(db.invoices)}`],
  ['day book', () => '/billing/day-book'],
  ['billing masters', () => '/billing/masters'],
  ['home collection', () => '/home-collection'],
  ['messages', () => '/messages'],
  ['messages templates', () => '/messages?tab=templates'],
  ['referrers', () => '/referrers'],
  ['centres', () => '/referrers?tab=centres'],
  // A technician sees the "for referring doctors" notice, not a crash.
  ['doctor portal', () => '/my-patients'],
  ...[
    'overview',
    'eqa',
    'capa',
    'documents',
    'audits',
    'risks',
    'lis',
    'uncertainty',
    'autoverify',
  ].map((tab): [string, () => string] => [
    `quality ${tab}`,
    () => `/quality?tab=${tab}`,
  ]),
  ['cold storage', () => '/cold-storage'],
  ...['form-iii', 'daily', 'iqc', 'collection'].map(
    (tab): [string, () => string] => [
      `registers ${tab}`,
      () => `/registers?tab=${tab}`,
    ],
  ),
  ...['requests', 'incidents', 'holds', 'retention'].map(
    (tab): [string, () => string] => [
      `privacy ${tab}`,
      () => `/privacy?tab=${tab}`,
    ],
  ),
  ...['monitor', 'messages', 'mappings', 'coding'].map(
    (tab): [string, () => string] => [
      `interfaces ${tab}`,
      () => `/interfaces?tab=${tab}`,
    ],
  ),
  ...['profile', 'sites', 'modules', 'assistant'].map(
    (section): [string, () => string] => [
      `settings ${section}`,
      () => `/settings?section=${section}`,
    ],
  ),
]

describe('routes', () => {
  beforeAll(() => {
    db = startMemoryDb()
  })

  it.each(SCREENS)('renders %s', async (path, heading) => {
    renderAt(path)
    expect(
      await screen.findByRole(
        'heading',
        { level: 1, name: heading },
        { timeout: 8000 },
      ),
    ).toBeInTheDocument()
  })

  it.each(DETAIL)('renders the %s screen', async (_, path) => {
    renderAt(path())
    const heading = await screen.findByRole(
      'heading',
      { level: 1 },
      { timeout: 8000 },
    )
    expect(heading.textContent?.trim()).not.toBe('')
    expect(screen.queryByText(/something went wrong/i)).toBeNull()
  })

  it('links the brand logos to their sites in a new tab', async () => {
    // A desktop-width window, where the full sidebar shows both logos.
    const desktop = vi.spyOn(window, 'matchMedia').mockImplementation(
      (query) =>
        ({
          matches: true,
          media: query,
          onchange: null,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
          addListener: () => undefined,
          removeListener: () => undefined,
          dispatchEvent: () => false,
        }) as MediaQueryList,
    )
    renderAt('/dashboard')
    await screen.findByRole(
      'heading',
      { level: 1, name: /^good (morning|afternoon|evening)/i },
      { timeout: 8000 },
    )
    for (const [name, href] of [
      [/shri ai/i, 'https://shri-ai.org/dev/'],
      [/indo states health/i, 'https://indostates.com'],
    ] as const) {
      const link = screen.getAllByRole('link', { name })[0]!
      expect(link).toHaveAttribute('href', href)
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    }
    desktop.mockRestore()
  })

  it('redirects / to the dashboard', async () => {
    renderAt('/')
    expect(
      await screen.findByRole(
        'heading',
        { level: 1, name: /^good (morning|afternoon|evening)/i },
        { timeout: 8000 },
      ),
    ).toBeInTheDocument()
  })

  it('sends old /laboratory links to the same page', async () => {
    expect(legacyPath('/laboratory')).toBe('/dashboard')
    expect(legacyPath('/laboratory/samples')).toBe('/reception')
    expect(legacyPath('/laboratory/samples/smp_1')).toBe('/specimens/smp_1')
    expect(legacyPath('/laboratory/results')).toBe('/worklists')
    expect(legacyPath('/laboratory/results/smp_1')).toBe('/results/smp_1')
    expect(legacyPath('/laboratory/validation')).toBe('/verification')
    expect(legacyPath('/laboratory/critical-values')).toBe('/critical-results')
    expect(legacyPath('/laboratory/orders/new')).toBe('/orders/new')
    renderAt('/laboratory/work-queue?bucket=critical')
    expect(
      await screen.findByRole(
        'heading',
        { level: 1, name: /^work queue$/i },
        { timeout: 8000 },
      ),
    ).toBeInTheDocument()
  })

  it('renders the not-found page for unknown paths', async () => {
    renderAt('/does-not-exist')
    expect(
      await screen.findByRole('heading', { name: /page not found/i }),
    ).toBeInTheDocument()
  })

  it('explains that an old report-number link no longer works', async () => {
    const report = Object.values(db.reports).find(
      (r) => r.versions.length > 0 && !r.withdrawn,
    )!
    renderAt(`/report/${report.reportNo}`)
    expect(
      await screen.findByRole(
        'heading',
        { name: /this link no longer works/i },
        { timeout: 8000 },
      ),
    ).toBeInTheDocument()
    // The public pages have no staff shell.
    expect(screen.queryByRole('navigation', { name: /main/i })).toBeNull()
  })

  it('opens a shared report after the date of birth', async () => {
    const current = getDb()
    const report = Object.values(current.reports).find(
      (r) => r.versions.length > 0 && !r.withdrawn && !r.pendingAmendment,
    )!
    const dob = current.patients[report.patientId]!.dob
    const { token } = await actingAs(STAFF.reception).reports.createShareLink(
      report.id,
    )
    renderAt(`/r/${token}`)
    const input = await screen.findByLabelText(/date of birth/i, undefined, {
      timeout: 8000,
    })
    fireEvent.change(input, { target: { value: dob } })
    fireEvent.click(screen.getByRole('button', { name: /open report/i }))
    expect(
      await screen.findByRole(
        'button',
        { name: /download pdf/i },
        { timeout: 8000 },
      ),
    ).toBeInTheDocument()
    expect(screen.getAllByText(report.reportNo).length).toBeGreaterThan(0)
  })

  it('verifies a report from its QR code', async () => {
    const report = Object.values(getDb().reports).find(
      (r) => r.versions.at(-1)?.verifyToken && !r.withdrawn,
    )!
    renderAt(`/v/${report.versions.at(-1)!.verifyToken}`)
    expect(
      await screen.findByText(/genuine report issued by/i, undefined, {
        timeout: 8000,
      }),
    ).toBeInTheDocument()
    expect(screen.getByText(report.reportNo)).toBeInTheDocument()
  })
})
