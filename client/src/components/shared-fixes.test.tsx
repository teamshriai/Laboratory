// Shared building blocks that many screens rely on: reason dialogs start
// empty, focus returns to the overlay that opened a nested one, overlays
// opened from the URL close with Back, disabled actions explain themselves
// on touch, and a failed label print keeps its error message.

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { AppProviders } from '@/app/providers'
import { startMemoryDb } from '@/mock/db/store'
import { useOverlayParam } from '@/hooks/use-search-param'
import { Button } from './ui/button'
import { Dialog, Drawer } from './ui/dialog'
import { GuardedButton } from './lab/guarded-button'
import { LabelPrintDialog } from './lab/labels'
import { ReasonDialog } from './lab/reason-dialog'

function inApp(ui: React.ReactNode, path = '/') {
  const router = createMemoryRouter([{ path: '*', element: ui }], {
    initialEntries: [path],
  })
  return render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  )
}

beforeAll(() => {
  startMemoryDb()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ReasonDialog', () => {
  function Harness() {
    const [open, setOpen] = useState(true)
    return (
      <>
        <Button onClick={() => setOpen(true)}>reopen</Button>
        <ReasonDialog
          open={open}
          onOpenChange={setOpen}
          title="Hold"
          reasonLabel="Reason"
          reasons={[{ value: 'other', label: 'Other' }]}
          confirmLabel="Confirm"
          onConfirm={() => setOpen(false)}
        />
        {/* The parent closes it itself, as after a successful save. */}
        <Button onClick={() => setOpen(false)}>parent-close</Button>
      </>
    )
  }

  it('starts empty on every opening, even after the parent closed it', async () => {
    inApp(<Harness />)
    const remarks = await screen.findByRole('textbox')
    fireEvent.change(remarks, { target: { value: 'Haemolysed, patient A' } })
    expect(remarks).toHaveValue('Haemolysed, patient A')
    fireEvent.click(screen.getByText('parent-close'))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    fireEvent.click(screen.getByText('reopen'))
    expect(await screen.findByRole('textbox')).toHaveValue('')
  })
})

describe('focus return', () => {
  it('returns focus to the drawer that opened a nested dialog', async () => {
    // jsdom has no layout: treat every element as shown.
    vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue([
      {},
    ] as unknown as DOMRectList)
    function Harness() {
      const [inner, setInner] = useState(false)
      return (
        <Drawer open onOpenChange={() => undefined} title="Order">
          <Button onClick={() => setInner(true)}>Add tests</Button>
          <Dialog open={inner} onOpenChange={setInner} title="Add tests">
            <p>Pick tests</p>
          </Dialog>
        </Drawer>
      )
    }
    inApp(<Harness />)
    const opener = await screen.findByRole('button', { name: 'Add tests' })
    act(() => opener.focus())
    fireEvent.click(opener)
    const dialog = await screen.findByRole('dialog', { name: 'Add tests' })
    fireEvent.keyDown(dialog, { key: 'Escape' })
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Add tests' })).toBeNull(),
    )
    await waitFor(() => expect(opener).toHaveFocus())
  })
})

describe('useOverlayParam', () => {
  function Harness() {
    const [value, open, close] = useOverlayParam('order')
    const location = useLocation()
    return (
      <>
        <p data-testid="where">{location.pathname + location.search}</p>
        <p data-testid="value">{value ?? 'none'}</p>
        <Button onClick={() => open('ord_1')}>open</Button>
        <Button onClick={close}>close</Button>
      </>
    )
  }

  it('goes back when this session opened it', async () => {
    inApp(<Harness />, '/orders?status=all')
    fireEvent.click(await screen.findByText('open'))
    await waitFor(() =>
      expect(screen.getByTestId('value')).toHaveTextContent('ord_1'),
    )
    fireEvent.click(screen.getByText('close'))
    await waitFor(() =>
      expect(screen.getByTestId('where')).toHaveTextContent(
        '/orders?status=all',
      ),
    )
    expect(screen.getByTestId('value')).toHaveTextContent('none')
  })

  it('removes the parameter in place for a pasted link', async () => {
    inApp(<Harness />, '/orders?order=ord_9&status=all')
    expect(await screen.findByTestId('value')).toHaveTextContent('ord_9')
    fireEvent.click(screen.getByText('close'))
    await waitFor(() =>
      expect(screen.getByTestId('where')).toHaveTextContent(
        '/orders?status=all',
      ),
    )
  })
})

describe('GuardedButton on touch', () => {
  it('says why on a tap instead of doing nothing', async () => {
    const real = window.matchMedia.bind(window)
    vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
      ...real(query),
      matches: query.includes('pointer: coarse'),
    }))
    const onClick = vi.fn()
    // The default acting user is a technician, who may not refund.
    inApp(
      <GuardedButton permission="billing.refund" onClick={onClick}>
        Refund
      </GuardedButton>,
    )
    const button = await screen.findByRole('button', { name: 'Refund' })
    expect(button).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
    expect(await screen.findByRole('dialog', { name: '' })).toHaveTextContent(
      /refund/i,
    )
  })
})

describe('LabelPrintDialog', () => {
  it('keeps the error message when printing fails', async () => {
    inApp(
      <LabelPrintDialog
        open
        onOpenChange={() => undefined}
        samples={[
          {
            id: 'smp_missing',
            accessionNo: null,
            container: 'edta',
            specimen: 'blood',
            department: 'hematology',
            tests: [],
            patient: {
              name: 'Test Patient',
              uhid: 'UHID-0',
              dob: '1990-01-01',
              sex: 'F',
            },
            orderNo: null,
            priority: 'routine',
          } as unknown as Parameters<
            typeof LabelPrintDialog
          >[0]['samples'][number],
        ]}
      />,
    )
    const print = await screen.findByRole('button', { name: /print/i })
    fireEvent.click(print)
    expect(
      await screen.findByText(
        'The record could not be found.',
        {},
        { timeout: 4000 },
      ),
    ).toBeInTheDocument()
  })
})
