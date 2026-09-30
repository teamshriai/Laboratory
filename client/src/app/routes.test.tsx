import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeAll, describe, expect, it } from 'vitest'
import type { LabDb } from '@/mock/db/schema'
import { AppProviders } from '@/app/providers'
import { routes } from '@/app/routes'
import { startMemoryDb } from '@/mock/db/store'

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  )
}

const SCREENS: [string, RegExp][] = [
  ['/laboratory', /^overview$/i],
  ['/laboratory/work-queue', /^work queue$/i],
  ['/laboratory/patients', /^patients$/i],
  ['/laboratory/test-catalog', /^test catalog$/i],
  ['/laboratory/inventory', /^inventory$/i],
  ['/laboratory/reagents', /^reagents$/i],
  ['/laboratory/consumables', /^consumables$/i],
  ['/laboratory/equipment', /^equipment$/i],
  ['/laboratory/quality-control', /^quality control$/i],
  ['/laboratory/tat', /^tat monitoring$/i],
  ['/laboratory/analytics', /^analytics$/i],
  ['/laboratory/settings', /^settings$/i],
]

// Every other screen, detail pages included: each must render its page
// heading, never the error screen.
let db: LabDb
const firstId = (table: Record<string, { id: string }>) =>
  Object.values(table)[0]!.id
const DETAIL: [string, () => string][] = [
  ['patient', () => `/laboratory/patients/${firstId(db.patients)}`],
  ['orders', () => '/laboratory/orders'],
  ['new order', () => '/laboratory/orders/new'],
  ['collection', () => '/laboratory/collection'],
  ['samples', () => '/laboratory/samples'],
  [
    'sample',
    () =>
      `/laboratory/samples/${Object.values(db.samples).find((x) => x.accessionNo)!.id}`,
  ],
  ['results', () => '/laboratory/results'],
  [
    'result entry',
    () =>
      `/laboratory/results/${Object.values(db.samples).find((x) => x.status === 'processing')!.id}`,
  ],
  ['validation', () => '/laboratory/validation'],
  ['reports', () => '/laboratory/reports'],
  ['report', () => `/laboratory/reports/${firstId(db.reports)}`],
  ['critical values', () => '/laboratory/critical-values'],
  ['departments', () => '/laboratory/departments'],
  ['department', () => '/laboratory/departments/hematology'],
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

  it('redirects / to the overview', async () => {
    renderAt('/')
    expect(
      await screen.findByRole(
        'heading',
        { level: 1, name: /^overview$/i },
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
})
