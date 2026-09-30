import { CompassIcon, CircleAlertIcon } from 'lucide-react'
import {
  Link,
  isRouteErrorResponse,
  useLocation,
  useNavigate,
  useRouteError,
} from 'react-router'
import { useT } from '@/i18n/context'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { IconTile } from '@/components/ui/icon-tile'

export function RouteError() {
  const error = useRouteError()
  const t = useT('errors')
  const tc = useT('common')
  const navigate = useNavigate()
  const location = useLocation()
  const notFound = isRouteErrorResponse(error) && error.status === 404
  // A failed code download needs a fresh page; a rendering error only needs
  // the screen rendered again, which keeps unsaved work elsewhere intact.
  const chunkFailed =
    error instanceof Error &&
    /dynamically imported module|Importing a module/i.test(error.message)
  const retry = () => {
    if (chunkFailed) window.location.reload()
    else
      void navigate(location.pathname + location.search + location.hash, {
        replace: true,
        state: { retry: Date.now() },
      })
  }
  if (import.meta.env.DEV && !notFound) console.error(error)
  return (
    <div className="grid min-h-[60dvh] place-items-center">
      <Card className="max-w-md p-8 text-center">
        <IconTile
          icon={<CircleAlertIcon />}
          tone="rose"
          size="xl"
          className="mx-auto mb-3"
        />
        <h1 className="text-base font-semibold text-fg">
          {notFound ? t('pageNotFound') : t('genericTitle')}
        </h1>
        <p className="mt-1 text-meta text-fg-muted">
          {notFound ? t('pageNotFoundBody') : t('genericBody')}
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <button
            type="button"
            className={buttonVariants({ variant: 'secondary' })}
            onClick={retry}
          >
            {tc('retry')}
          </button>
          <Link
            to="/laboratory"
            className={buttonVariants({ variant: 'primary' })}
          >
            {t('backToOverview')}
          </Link>
        </div>
      </Card>
    </div>
  )
}

export function NotFoundPage() {
  const t = useT('errors')
  return (
    <div className="grid min-h-[60dvh] place-items-center p-6">
      <Card className="max-w-md p-8 text-center">
        <IconTile
          icon={<CompassIcon />}
          tone="teal"
          size="xl"
          className="mx-auto mb-3"
        />
        <h1 className="text-base font-semibold text-fg">{t('pageNotFound')}</h1>
        <p className="mt-1 text-meta text-fg-muted">{t('pageNotFoundBody')}</p>
        <Link
          to="/laboratory"
          className={buttonVariants({ variant: 'primary', className: 'mt-5' })}
        >
          {t('backToOverview')}
        </Link>
      </Card>
    </div>
  )
}

export function AppLoading() {
  return (
    <div className="min-h-dvh lg:pl-64">
      <div className="h-15 border-b border-line bg-surface" />
      <div className="mx-auto grid max-w-[1600px] gap-4 p-8">
        <Skeleton className="h-7 w-64" />
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    </div>
  )
}
