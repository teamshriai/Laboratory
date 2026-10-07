import { lazy, Suspense, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router'
import { useOverlayParam } from '@/hooks/use-search-param'
import { useT } from '@/i18n/context'
import { Drawer } from '@/components/ui/dialog'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { ErrorState } from '@/components/ui/states'

const OrderDrawer = lazy(() => import('@/features/orders/order-drawer'))
const SampleDrawer = lazy(() => import('@/features/samples/sample-drawer'))

/** Opens detail drawers from the URL (?order=… / ?sample=…) on any page. */
export function DrawerHost() {
  const [, setParams] = useSearchParams()
  const [orderId, , closeOrder] = useOverlayParam('order')
  const [sampleId, , closeSample] = useOverlayParam('sample')
  const open = Boolean(orderId || sampleId)
  const opener = useRef<HTMLElement | null>(null)
  // Drawers load lazily, so remember what opened them and return focus there on close.
  useEffect(() => {
    if (open) {
      opener.current ??= document.activeElement as HTMLElement | null
      return
    }
    const el = opener.current
    opener.current = null
    if (el && el.isConnected) window.setTimeout(() => el.focus(), 0)
  }, [open])
  return (
    <ErrorBoundary
      resetKey={`${orderId ?? ''}|${sampleId ?? ''}`}
      fallback={(reset) => (
        <DrawerError
          onRetry={reset}
          onClose={() =>
            setParams(
              (prev) => {
                const next = new URLSearchParams(prev)
                next.delete('order')
                next.delete('sample')
                return next
              },
              { replace: true },
            )
          }
        />
      )}
    >
      <Suspense fallback={null}>
        {orderId ? (
          <OrderDrawer orderId={orderId} onClose={closeOrder} />
        ) : null}
        {sampleId ? (
          <SampleDrawer sampleId={sampleId} onClose={closeSample} />
        ) : null}
      </Suspense>
    </ErrorBoundary>
  )
}

/** A drawer that failed to render: the page behind it keeps working. */
function DrawerError({
  onRetry,
  onClose,
}: {
  onRetry: () => void
  onClose: () => void
}) {
  const t = useT('errors')
  return (
    <Drawer
      open
      onOpenChange={(o) => (o ? undefined : onClose())}
      title={t('drawerFailedTitle')}
      size="md"
    >
      <ErrorState
        title={t('drawerFailedTitle')}
        description={t('drawerFailedBody')}
        onRetry={onRetry}
      />
    </Drawer>
  )
}
