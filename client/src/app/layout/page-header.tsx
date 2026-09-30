import { ArrowLeftIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { cn } from '@/lib/cn'

/**
 * The one page header: title, a quiet metadata line and the page actions.
 * Also names the browser tab so history and screen readers match the page.
 */
export function PageHeader({
  title,
  documentTitle,
  titleExtra,
  meta,
  actions,
  back,
  className,
}: {
  title: ReactNode
  /** Plain-text title for the browser tab when `title` is not a string. */
  documentTitle?: string
  /** Inline status next to the title (e.g. a status badge). */
  titleExtra?: ReactNode
  meta?: ReactNode
  actions?: ReactNode
  back?: { to: string; label: string }
  className?: string
}) {
  useDocumentTitle(documentTitle ?? (typeof title === 'string' ? title : null))
  return (
    <div
      className={cn(
        'mb-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-x-6',
        className,
      )}
    >
      <div className="min-w-0">
        {back ? (
          <Link
            to={back.to}
            className="focus-ring -mt-2 mb-1 inline-flex min-h-11 items-center gap-1.5 rounded-lg text-sm text-fg-muted hover:text-fg"
          >
            <ArrowLeftIcon className="size-3.5" aria-hidden />
            {back.label}
          </Link>
        ) : null}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="text-xl font-semibold tracking-tight text-fg sm:text-2xl">
            {title}
          </h1>
          {titleExtra}
        </div>
        {meta ? (
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-muted">
            {meta}
          </div>
        ) : null}
      </div>
      {actions ? (
        <div className="flex max-w-full min-w-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      ) : null}
    </div>
  )
}
