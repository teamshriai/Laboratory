import { OctagonAlertIcon, PhoneCallIcon } from 'lucide-react'
import { AlertDialog as A } from 'radix-ui'
import { useState } from 'react'
import type { Flag } from '@/domain/types'
import { useT } from '@/i18n/context'
import { ResultFlag } from '@/components/lab/result'
import { Button } from '@/components/ui/button'
import { useReturnFocus } from '@/components/ui/return-focus'
import { Checkbox } from '@/components/ui/toggles'

/** One critical value raised by a submit. */
export interface EntryCritical {
  /** The critical alert, when the queue could be read back. */
  alertId?: string
  analyte: string
  testName?: string
  value: string
  unit: string
  flag: Flag | null
}

/**
 * Shown right after a submit raises critical values. It cannot be dismissed
 * with Esc or a click outside: the analyst either goes to communicate the
 * value, or confirms they understand they must call now.
 */
export function CriticalAtEntryDialog({
  criticals,
  patient,
  minutes,
  onCommunicate,
  onCallNow,
}: {
  criticals: EntryCritical[]
  patient: string
  /** The lab's limit for communicating a critical value. */
  minutes: number
  onCommunicate: () => void
  onCallNow: () => void
}) {
  const open = criticals.length > 0
  return (
    <A.Root open={open}>
      <A.Portal>
        <A.Overlay className="fixed inset-0 z-50 animate-overlay bg-overlay backdrop-blur-sm" />
        {open ? (
          <Body
            criticals={criticals}
            patient={patient}
            minutes={minutes}
            onCommunicate={onCommunicate}
            onCallNow={onCallNow}
          />
        ) : null}
      </A.Portal>
    </A.Root>
  )
}

function Body({
  criticals,
  patient,
  minutes,
  onCommunicate,
  onCallNow,
}: {
  criticals: EntryCritical[]
  patient: string
  minutes: number
  onCommunicate: () => void
  onCallNow: () => void
}) {
  const t = useT('results')
  const focus = useReturnFocus(true)
  const [understood, setUnderstood] = useState(false)
  const [tried, setTried] = useState(false)
  return (
    <A.Content
      {...focus}
      onEscapeKeyDown={(ev) => ev.preventDefault()}
      className="fixed top-1/2 left-1/2 z-50 flex max-h-[min(88dvh,52rem)] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 animate-dialog flex-col rounded-xl border border-danger-text/30 bg-surface shadow-modal outline-none"
    >
      <div className="flex items-start gap-3 border-b border-danger-text/20 bg-danger-soft px-6 pt-5 pb-4">
        <OctagonAlertIcon
          strokeWidth={2.2}
          className="mt-0.5 size-5 shrink-0 text-danger-text"
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <A.Title className="text-base font-semibold text-danger-text">
            {t('criticalDialogTitle', { count: criticals.length })}
          </A.Title>
          <A.Description className="mt-1 text-meta text-fg">
            {t('criticalDialogBody', { minutes, patient })}
          </A.Description>
        </div>
      </div>
      <div className="min-h-0 flex-1 scrollbar-thin overflow-y-auto px-6 py-4">
        <ul className="grid gap-2">
          {criticals.map((c, i) => (
            <li
              key={c.alertId ?? i}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-danger-text/25 bg-danger-soft/50 px-3 py-2"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-fg">
                  {c.analyte}
                </span>
                {c.testName ? (
                  <span className="block text-xs text-fg-muted">
                    {c.testName}
                  </span>
                ) : null}
              </span>
              <span className="text-base font-semibold text-danger-text tabular-nums">
                {c.value}{' '}
                <span className="text-xs font-normal text-fg-muted">
                  {c.unit}
                </span>
              </span>
              <ResultFlag flag={c.flag} critical variant="short" />
            </li>
          ))}
        </ul>
        <label className="mt-4 flex min-h-11 cursor-pointer items-start gap-2.5 py-2 text-sm text-fg">
          <Checkbox
            checked={understood}
            onCheckedChange={(c) => {
              setUnderstood(c)
              if (c) setTried(false)
            }}
            label={t('criticalUnderstand')}
            className="mt-0.5"
          />
          <span>{t('criticalUnderstand')}</span>
        </label>
        {tried && !understood ? (
          <p role="alert" className="text-xs font-medium text-danger-text">
            {t('criticalUnderstandRequired')}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-surface-2/60 px-6 py-3.5">
        <Button
          onClick={() => {
            if (understood) onCallNow()
            else setTried(true)
          }}
        >
          {t('criticalCallNow')}
        </Button>
        <Button variant="danger" autoFocus onClick={onCommunicate}>
          <PhoneCallIcon />
          {t('criticalCommunicate')}
        </Button>
      </div>
    </A.Content>
  )
}
