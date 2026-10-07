import {
  CheckIcon,
  CopyIcon,
  ExternalLinkIcon,
  LinkIcon,
  ShieldCheckIcon,
} from 'lucide-react'
import { useState } from 'react'
import { useEnum, useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import { cn } from '@/lib/cn'
import { shareUrl } from '@/lib/share-url'
import type { CreatedShareLink, ShareLinkRow } from '@/services/lab-api'
import { useLabMutation } from '@/services/mutations'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Select } from '../ui/select'
import { GuardedButton } from './guarded-button'

const DAY_CHOICES = [1, 3, 7, 14, 30] as const

const STATE_TONE = {
  active: 'success',
  expired: 'neutral',
  revoked: 'danger',
  locked: 'warning',
} as const

/**
 * Share links of a released report. A new link is shown once (only its
 * fingerprint is kept); each link expires, can be revoked, asks for the
 * patient's date of birth and keeps an access log shown here.
 */
export function ShareLinkPanel({
  links,
  defaultDays,
  create,
  revoke,
  disabled,
}: {
  links: ShareLinkRow[]
  defaultDays: number
  create: (days: number) => Promise<CreatedShareLink>
  revoke: (linkId: string) => Promise<void>
  /** Not released (or withdrawn): nothing may be shared. */
  disabled?: boolean
}) {
  const t = useT('portal')
  const e = useEnum()
  const f = useFormat()
  const [days, setDays] = useState(String(defaultDays))
  const [fresh, setFresh] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const make = useLabMutation((n: number) => create(n), {
    success: () => t('linkReady'),
    onSuccess: (created) => setFresh(shareUrl(created.token)),
  })
  const drop = useLabMutation((id: string) => revoke(id), {
    success: () => t('linkRevoked'),
  })
  const copy = (url: string) => {
    void navigator.clipboard
      ?.writeText(url)
      .then(() => {
        setCopied(true)
        window.setTimeout(() => setCopied(false), 2000)
      })
      .catch(() => undefined)
  }
  const choices = [...new Set([...DAY_CHOICES, defaultDays])].toSorted(
    (a, b) => a - b,
  )

  return (
    <section className="grid gap-3 rounded-lg border border-line bg-surface-2 p-3.5">
      <p className="flex items-center gap-2 text-sm font-semibold text-fg">
        <LinkIcon className="size-4 text-fg-subtle" aria-hidden />
        {t('share')}
      </p>
      <p className="text-xs text-fg-muted">{t('shareBodyLinks')}</p>

      <div className="flex flex-wrap items-end gap-2">
        <label className="grid gap-1 text-xs font-medium text-fg-muted">
          {t('linkDays')}
          <Select
            size="sm"
            className="w-36"
            aria-label={t('linkDays')}
            value={days}
            onValueChange={setDays}
            options={choices.map((n) => ({
              value: String(n),
              label: t('daysOption', { count: n }),
            }))}
          />
        </label>
        <GuardedButton
          permission="report.share"
          disabled={disabled}
          loading={make.isPending}
          onClick={() => make.mutate(Number(days))}
        >
          <LinkIcon />
          {t('createLink')}
        </GuardedButton>
      </div>

      {fresh ? (
        <div className="grid gap-2 rounded-lg border border-success-text/30 bg-success-soft p-3">
          <p className="flex items-start gap-2 text-xs text-success-text">
            <ShieldCheckIcon className="mt-px size-4 shrink-0" aria-hidden />
            {t('linkOnce')}
          </p>
          <div className="flex flex-wrap gap-2">
            <Input
              readOnly
              value={fresh}
              aria-label={t('share')}
              onFocus={(ev) => ev.currentTarget.select()}
              className="min-w-0 flex-1 basis-60 font-mono text-xs"
            />
            <Button onClick={() => copy(fresh)} aria-live="polite">
              {copied ? <CheckIcon /> : <CopyIcon />}
              {copied ? t('copied') : t('copy')}
            </Button>
            <Button asChild variant="ghost">
              <a href={fresh} target="_blank" rel="noopener noreferrer">
                <ExternalLinkIcon />
                {t('openPortal')}
              </a>
            </Button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-1.5">
        <p className="text-xs font-semibold tracking-wide text-fg-muted uppercase">
          {t('linksTitle')}
        </p>
        {links.length === 0 ? (
          <p className="text-xs text-fg-subtle">{t('noLinks')}</p>
        ) : (
          <ul className="grid gap-1.5">
            {links.map((link) => (
              <li
                key={link.id}
                className="rounded-lg border border-line bg-surface px-3 py-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    <Badge tone={STATE_TONE[link.state]}>
                      {t(`state.${link.state}`)}
                    </Badge>
                    <span className="text-xs text-fg-muted">
                      {t('linkCreatedAt', {
                        time: f.dateTime(link.createdAt),
                        name: link.createdByName,
                      })}
                    </span>
                  </div>
                  {link.state === 'active' || link.state === 'locked' ? (
                    <GuardedButton
                      permission="report.share"
                      size="xs"
                      variant="ghost"
                      loading={drop.isPending && drop.variables === link.id}
                      onClick={() => drop.mutate(link.id)}
                    >
                      {t('revoke')}
                    </GuardedButton>
                  ) : null}
                </div>
                <p className="mt-1 text-2xs text-fg-subtle">
                  {link.revokeReason
                    ? e('shareRevokeReason', link.revokeReason)
                    : t('expiresAt', { time: f.dateTime(link.expiresAt) })}
                  {' · '}
                  {t('openedCount', { count: link.opened })}
                  {' · '}
                  {t('version', { version: link.version })}
                </p>
                <details className="mt-1 text-2xs">
                  <summary className="tap-reach inline-flex min-h-[24px] cursor-pointer items-center font-medium text-accent-text">
                    {t('accessLog')}
                  </summary>
                  {link.access.length === 0 ? (
                    <p className="mt-1 text-fg-subtle">{t('noAccess')}</p>
                  ) : (
                    <ul className="mt-1 grid gap-0.5">
                      {link.access.map((a) => (
                        <li
                          key={`${a.at}-${a.outcome}`}
                          className={cn(
                            'flex justify-between gap-3 tabular-nums',
                            a.outcome === 'opened'
                              ? 'text-fg-muted'
                              : 'text-warning-text',
                          )}
                        >
                          <span>{f.dateTime(a.at)}</span>
                          <span>{e('shareLinkOutcome', a.outcome)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </details>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
