import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { useRecordHref, type RecordKind } from '@/hooks/use-record-href'
import { cn } from '@/lib/cn'

/**
 * An identifier (UHID, order number, accession number, report number) that
 * opens its record: no ID in the app is a dead end (audit §3). Clicks don't
 * reach a clickable row underneath.
 */
export function RecordLink({
  kind,
  id,
  children,
  className,
  mono = true,
}: {
  kind: RecordKind
  id: string
  children: ReactNode
  className?: string
  /** Identifiers are monospaced; set false for a name. */
  mono?: boolean
}) {
  const href = useRecordHref()
  return (
    <Link
      to={href(kind, id)}
      onClick={(ev) => ev.stopPropagation()}
      className={cn(
        'inline-flex min-h-[24px] items-center rounded-sm underline-offset-2 hover:text-accent-text hover:underline',
        mono && 'font-mono tabular-nums',
        className,
      )}
    >
      {children}
    </Link>
  )
}
