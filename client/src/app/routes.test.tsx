import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { LabDb } from '@/mock/db/schema'
import { AppProviders } from '@/app/providers'
import { routes } from '@/app/routes'
import { legacyPath } from '@/app/legacy-paths'
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
  ['/dashboard', /^dashboard$/i],
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
      { level: 1, name: /^dashboard$/i },
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
        { level: 1, name: /^dashboard$/i },
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
})
