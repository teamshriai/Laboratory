import {
  RotateCwIcon,
  CircleCheckIcon,
  FlagIcon,
  SearchIcon,
  WrenchIcon,
  CircleXIcon,
} from 'lucide-react'
import { LucideProvider } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import type { QcEventStatus } from '@/domain/types'
import { useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import { cn } from '@/lib/cn'
import { labApi, type QcEventRow } from '@/services/lab-api'
import { useLabMutation } from '@/services/mutations'
import { QcBadge } from '@/components/lab/status'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Drawer } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Textarea } from '@/components/ui/input'
import { formatFixed, formatZ, qcDigits } from './qc-utils'

const PATH: { key: QcEventStatus | 'flagged'; icon: ReactNode }[] = [
  { key: 'open', icon: <CircleXIcon /> },
  { key: 'flagged', icon: <FlagIcon /> },
  { key: 'investigating', icon: <SearchIcon /> },
  { key: 'corrective', icon: <WrenchIcon /> },
  { key: 'repeat-pending', icon: <RotateCwIcon /> },
  { key: 'resolved', icon: <CircleCheckIcon /> },
]
const ORDER: QcEventStatus[] = [
  'open',
  'investigating',
  'corrective',
  'repeat-pending',
  'resolved',
]

export function QcEventDrawer({
  event,
  onClose,
  onRepeat,
}: {
  event: QcEventRow
  onClose: () => void
  onRepeat: () => void
}) {
  const t = useT('qc')
  const f = useFormat()
  const [note, setNote] = useState('')
  const advance = useLabMutation(
    (text: string) => labApi.qc.advanceEvent(event.id, text),
    {
      success: () => t('advanced'),
      onSuccess: () => setNote(''),
    },
  )
  const reached = ORDER.indexOf(event.status)
  const stepAt = (key: QcEventStatus | 'flagged') => {
    const k = key === 'flagged' ? 'open' : key
    return event.steps.findLast((s) => s.status === k)
  }
  const done = (key: QcEventStatus | 'flagged') =>
    key === 'flagged' ? true : ORDER.indexOf(key) <= reached
  const run = event.run
  const digits = run ? qcDigits(run.mean, run.sd) : 2

  const form =
    event.status === 'open'
      ? {
          label: t('issue'),
          placeholder: t('issuePlaceholder'),
          button: t('saveInvestigation'),
        }
      : event.status === 'investigating'
        ? {
            label: t('action'),
            placeholder: t('actionPlaceholder'),
            button: t('saveAction'),
          }
        : event.status === 'corrective'
          ? {
              label: t('repeatNote'),
              placeholder: t('repeatPlaceholder'),
              button: t('requestRepeat'),
            }
          : null

  return (
    <Drawer
      open
      onOpenChange={(o) => !o && onClose()}
      size="md"
      title={t('eventTitle')}
      description={t('eventSubtitle', {
        analyzer: event.equipmentName,
        analyte: event.analyteName,
        level: t('level', { n: event.level.slice(1) }),
      })}
      headerExtra={
        <Badge
          tone={event.status === 'resolved' ? 'success' : 'danger'}
          size="sm"
        >
          {t(`status.${event.status}`)}
        </Badge>
      }
    >
      <div className="grid gap-6 p-5">
        {run ? (
          <dl className="grid grid-cols-3 gap-3 rounded-xl border border-line p-4 text-meta">
            <div>
              <dt className="text-xs text-fg-muted">{t('failedValue')}</dt>
              <dd className="mt-0.5 text-lg font-semibold text-danger-text tabular-nums">
                {formatFixed(f.locale, run.value, digits)}{' '}
                <span className="text-xs font-normal text-fg-muted">
                  {run.unit}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-fg-muted">{t('targetMean')}</dt>
              <dd className="mt-0.5 font-medium text-fg tabular-nums">
                {formatFixed(f.locale, run.mean, digits)} ±{' '}
                {formatFixed(f.locale, run.sd, digits)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-fg-muted">{t('zScore')}</dt>
              <dd className="mt-0.5 font-medium text-fg tabular-nums">
                {formatZ(run.z)}{' '}
                {run.rule ? (
                  <span className="text-xs text-fg-muted">({run.rule})</span>
                ) : null}
              </dd>
            </div>
            <div className="col-span-3 flex items-center justify-between border-t border-line pt-3 text-xs text-fg-muted">
              <span>
                {f.dateTime(run.at)} · {run.byName} · {run.controlLot}
              </span>
              <QcBadge result={run.result} size="sm" />
            </div>
          </dl>
        ) : null}

        {event.status !== 'resolved' ? (
          <p className="rounded-lg bg-danger-soft/50 px-3 py-2 text-meta text-danger-text">
            {t('patientHold')}
          </p>
        ) : null}

        <section>
          <h3 className="mb-3 text-xs font-semibold tracking-wide text-fg-subtle uppercase">
            {t('history')}
          </h3>
          <ol>
            {PATH.map((p, i) => {
              const isDone = done(p.key)
              const entry = p.key === 'flagged' ? undefined : stepAt(p.key)
              const isNext =
                !isDone && ORDER.indexOf(p.key as QcEventStatus) === reached + 1
              return (
                <li key={p.key} className="relative flex gap-3 pb-4 last:pb-0">
                  {i < PATH.length - 1 ? (
                    <span
                      aria-hidden
                      className={cn(
                        'absolute top-7 bottom-0 left-[13px] w-px',
                        isDone ? 'bg-line-strong' : 'bg-line',
                      )}
                    />
                  ) : null}
                  <span
                    className={cn(
                      'relative grid size-7 shrink-0 place-items-center rounded-full bg-surface',
                      !isDone
                        ? isNext
                          ? 'text-accent-text ring-2 ring-accent/40'
                          : 'text-fg-subtle'
                        : p.key === 'open' || p.key === 'flagged'
                          ? 'text-ic-rose'
                          : p.key === 'resolved'
                            ? 'text-ic-green'
                            : 'text-ic-amber',
                    )}
                  >
                    <LucideProvider size={18} strokeWidth={isDone ? 2.2 : 1.8}>
                      {p.icon}
                    </LucideProvider>
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <p
                      className={cn(
                        'text-sm',
                        isDone || isNext
                          ? 'font-medium text-fg'
                          : 'text-fg-subtle',
                      )}
                    >
                      {t(`step.${p.key}`)}
                    </p>
                    {entry && isDone ? (
                      <>
                        {entry.note && p.key !== 'open' ? (
                          <p className="mt-0.5 text-meta text-fg">
                            {entry.note}
                          </p>
                        ) : null}
                        <p className="mt-0.5 text-xs text-fg-muted">
                          {f.dateTime(entry.at)} · {entry.byName}
                        </p>
                      </>
                    ) : null}
                    {p.key === 'flagged' ? (
                      <p className="mt-0.5 text-xs text-fg-muted">
                        {event.equipmentName} · {event.analyteName}
                      </p>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ol>
        </section>

        {form ? (
          <form
            className="grid gap-3 rounded-xl border border-line p-4"
            onSubmit={(ev) => {
              ev.preventDefault()
              if (note.trim()) advance.mutate(note.trim())
            }}
          >
            <Field label={form.label} required>
              <Textarea
                rows={3}
                value={note}
                onChange={(ev) => setNote(ev.target.value)}
                placeholder={form.placeholder}
                maxLength={500}
              />
            </Field>
            <div className="flex justify-end">
              <Button
                type="submit"
                variant="primary"
                disabled={!note.trim()}
                loading={advance.isPending}
              >
                {form.button}
              </Button>
            </div>
          </form>
        ) : event.status === 'repeat-pending' ? (
          <div className="flex justify-end">
            <Button variant="primary" onClick={onRepeat}>
              <RotateCwIcon />
              {t('runRepeat')}
            </Button>
          </div>
        ) : event.resolvedAt ? (
          <p className="rounded-lg bg-success-soft/60 px-3 py-2 text-meta text-success-text">
            {t('resolvedBy', { time: f.dateTime(event.resolvedAt) })}
          </p>
        ) : null}
      </div>
    </Drawer>
  )
}
