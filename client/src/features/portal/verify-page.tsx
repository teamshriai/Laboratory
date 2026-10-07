import { BadgeCheckIcon, FileSearchIcon, TriangleAlertIcon } from 'lucide-react'
import { useParams } from 'react-router'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import { cn } from '@/lib/cn'
import { groupDigest } from '@/lib/digest'
import { useVerification } from '@/services/queries'
import { Skeleton } from '@/components/ui/skeleton'
import { PortalFrame } from './portal-frame'

/**
 * The page behind a report's QR code (/v/<token>): whether the report is
 * genuine, which version and when it was issued, and its content code to
 * compare with the paper. Nothing about the patient.
 */
export function Component() {
  const t = useT('portal')
  const f = useFormat()
  const { token } = useParams()
  const { data, isPending, isError } = useVerification(token)
  useDocumentTitle(t('verifyTitle'))

  return (
    <PortalFrame lab={data ? { labName: data.labName } : undefined}>
      <section className="mx-auto grid w-full max-w-xl gap-4 rounded-xl border border-line bg-surface p-5 sm:p-6">
        <h1 className="text-lg font-semibold text-fg">{t('verifyTitle')}</h1>
        {isPending ? (
          <Skeleton className="h-40 rounded-lg" />
        ) : isError || !data ? (
          <p className="flex items-start gap-2.5 rounded-lg bg-danger-soft p-3 text-meta text-danger-text">
            <FileSearchIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
            {t('verifyNotFound')}
          </p>
        ) : (
          <>
            <p
              className={cn(
                'flex items-start gap-2.5 rounded-lg p-3 text-meta font-medium',
                data.status === 'current'
                  ? 'bg-success-soft text-success-text'
                  : 'bg-warning-soft text-warning-text',
              )}
            >
              {data.status === 'current' ? (
                <BadgeCheckIcon
                  className="mt-0.5 size-4 shrink-0"
                  aria-hidden
                />
              ) : (
                <TriangleAlertIcon
                  className="mt-0.5 size-4 shrink-0"
                  aria-hidden
                />
              )}
              <span>
                {t('verifyGenuine', { lab: data.labName })}
                {data.status === 'superseded'
                  ? ` ${t('verifySuperseded')}`
                  : data.status === 'withdrawn'
                    ? ` ${t('verifyWithdrawn')}`
                    : ''}
              </span>
            </p>
            <dl className="grid gap-3 text-meta sm:grid-cols-2">
              <div>
                <dt className="text-xs text-fg-subtle">{t('reportNumber')}</dt>
                <dd className="font-mono font-medium text-fg">
                  {data.reportNo}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-fg-subtle">
                  {t('version', { version: data.version })}
                </dt>
                <dd className="font-medium text-fg">
                  {t('issued')} {f.dateTime(data.issuedAt)}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs text-fg-subtle">{t('digest')}</dt>
                <dd className="font-mono text-xs break-all text-fg">
                  {groupDigest(data.digest)}
                </dd>
                <dd className="mt-1 text-xs text-fg-muted">
                  {t('verifyDigestHelp')}
                </dd>
              </div>
              {data.labAccreditation ? (
                <div className="sm:col-span-2">
                  <dt className="text-xs text-fg-subtle">{t('laboratory')}</dt>
                  <dd className="text-fg">
                    {data.labName} · {data.labAccreditation}
                  </dd>
                </div>
              ) : null}
            </dl>
          </>
        )}
      </section>
    </PortalFrame>
  )
}
