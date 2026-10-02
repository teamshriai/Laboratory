import { CheckIcon, CopyIcon, ExternalLinkIcon, LinkIcon } from 'lucide-react'
import { useState } from 'react'
import { useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import { reportShareUrl } from '@/lib/share-url'
import type { ShareLinkInfo } from '@/services/lab-api'
import { useLabMutation } from '@/services/mutations'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { GuardedButton } from './guarded-button'

/**
 * Makes the demo share link for a released report and shows it, with copy
 * and open. The link opens the patient-facing report page (/report/<no>),
 * which works in this browser until the backend serves it with access
 * control and expiry.
 */
export function ShareLinkPanel({
  reportNo,
  link,
  create,
  disabled,
}: {
  reportNo: string
  link: ShareLinkInfo | undefined
  create: () => Promise<unknown>
  /** Not released (or withdrawn): nothing may be shared yet. */
  disabled?: boolean
}) {
  const t = useT('portal')
  const f = useFormat()
  const [copied, setCopied] = useState(false)
  const url = reportShareUrl(reportNo)
  const make = useLabMutation(create, { success: () => t('linkReady') })
  const copy = () => {
    void navigator.clipboard
      ?.writeText(url)
      .then(() => {
        setCopied(true)
        window.setTimeout(() => setCopied(false), 2000)
      })
      .catch(() => undefined)
  }
  return (
    <section className="grid gap-2.5 rounded-lg border border-line bg-surface-2 p-3.5">
      <p className="flex items-center gap-2 text-sm font-semibold text-fg">
        <LinkIcon className="size-4 text-fg-subtle" aria-hidden />
        {t('share')}
      </p>
      <p className="text-xs text-fg-muted">{t('shareBody')}</p>
      {link ? (
        <>
          <div className="flex gap-2">
            <Input
              readOnly
              value={url}
              aria-label={t('share')}
              onFocus={(ev) => ev.currentTarget.select()}
              className="min-w-0 flex-1 font-mono text-xs"
            />
            <Button onClick={copy} aria-live="polite">
              {copied ? <CheckIcon /> : <CopyIcon />}
              {copied ? t('copied') : t('copy')}
            </Button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-fg-subtle">
              {t('linkCreatedAt', {
                time: f.dateTime(link.createdAt),
                name: link.createdByName,
              })}
            </p>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-1.5 text-meta font-semibold text-accent-text hover:underline"
            >
              <ExternalLinkIcon className="size-4" aria-hidden />
              {t('openPortal')}
            </a>
          </div>
        </>
      ) : (
        <GuardedButton
          permission="report.share"
          disabled={disabled}
          loading={make.isPending}
          onClick={() => make.mutate(undefined)}
          className="justify-self-start"
        >
          <LinkIcon />
          {t('createLink')}
        </GuardedButton>
      )}
    </section>
  )
}
