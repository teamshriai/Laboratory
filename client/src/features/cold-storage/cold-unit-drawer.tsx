import { PencilIcon, SearchXIcon, ThermometerIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useNow } from '@/hooks/use-now'
import { useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import { cn } from '@/lib/cn'
import type { ColdUnitRow } from '@/services/lab-api'
import { GuardedButton } from '@/components/lab/guarded-button'
import { Drawer } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { OverdueBadge, RangeBadge } from './cold-status'
import { useTemperature } from './cold-utils'
import { TemperatureChart } from './temperature-chart'

function Fact({
  label,
  children,
  className,
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <dt className="text-xs text-fg-muted">{label}</dt>
      <dd className="mt-0.5 text-meta font-medium text-fg">{children}</dd>
    </div>
  )
}

function Body({ unit }: { unit: ColdUnitRow }) {
  const t = useT('coldStorage')
  const f = useFormat()
  const now = useNow()
  const temp = useTemperature()
  const newestFirst = unit.readings.toReversed()
  return (
    <div className="grid gap-5">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-xl border border-line p-4">
        <Fact label={t('colRange')}>
          <span className="tabular-nums">{temp.range(unit.min, unit.max)}</span>
        </Fact>
        <Fact label={t('colDepartment')}>
          {temp.department(unit.department)}
        </Fact>
        <Fact label={t('colLatest')}>
          {unit.latest ? (
            <span className="flex flex-wrap items-center gap-2">
              <span className="tabular-nums">
                {temp.temp(unit.latest.value)}
              </span>
              <RangeBadge outOfRange={unit.latest.outOfRange} />
            </span>
          ) : (
            <RangeBadge outOfRange={undefined} />
          )}
        </Fact>
        <Fact label={t('colLastRead')}>
          <span className="grid justify-items-start gap-1">
            {unit.latest ? (
              <span className="font-normal text-fg-muted">
                {t('readAtBy', {
                  time: f.relative(unit.latest.at, now),
                  name: unit.latest.byName,
                })}
              </span>
            ) : (
              '-'
            )}
            {unit.readingOverdue ? <OverdueBadge /> : null}
          </span>
        </Fact>
        <Fact label={t('colExcursions')}>
          <span
            className={cn(
              'tabular-nums',
              unit.excursions7d > 0 && 'text-danger-text',
            )}
          >
            {unit.excursions7d > 0
              ? t('excursions', { count: unit.excursions7d })
              : t('noExcursions')}
          </span>
        </Fact>
        <Fact label={t('fieldKind')}>{t(`kind.${unit.kind}`)}</Fact>
      </dl>

      {unit.readings.length === 0 ? (
        <EmptyState
          compact
          icon={<ThermometerIcon />}
          tone="sky"
          title={t('noReadingsTitle')}
          description={t('noReadingsBody')}
        />
      ) : (
        <>
          <TemperatureChart unit={unit} />
          <section aria-labelledby="cold-readings">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <h3
                id="cold-readings"
                className="text-xs font-semibold tracking-wide text-fg-subtle uppercase"
              >
                {t('readingsTitle')}
              </h3>
              <span className="text-xs text-fg-muted">
                {t('readingsCount', { count: unit.readings.length })}
              </span>
            </div>
            <ul className="divide-y divide-line rounded-xl border border-line">
              {newestFirst.map((r) => (
                <li
                  key={r.id}
                  className={cn('px-4 py-2.5', r.outOfRange && 'row-alert')}
                >
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="min-w-24 text-meta font-semibold text-fg tabular-nums">
                      {temp.temp(r.value)}
                    </span>
                    <RangeBadge outOfRange={r.outOfRange} />
                    <span className="ml-auto text-xs text-fg-muted">
                      {t('readAtBy', {
                        time: f.dateTime(r.at),
                        name: r.byName,
                      })}
                    </span>
                  </div>
                  {r.action ? (
                    <p className="mt-1 text-xs text-fg-muted">
                      <span className="font-medium text-fg">
                        {t('colAction')}:
                      </span>{' '}
                      {r.action}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  )
}

/** One unit: its facts, the 14-day chart and the readings (`?unit=`). */
export function ColdUnitDrawer({
  unit,
  isPending,
  isError,
  onRetry,
  onClose,
  onEdit,
  onLog,
  children,
}: {
  unit: ColdUnitRow | undefined
  isPending: boolean
  isError: boolean
  onRetry: () => void
  onClose: () => void
  onEdit: (unit: ColdUnitRow) => void
  onLog: (unit: ColdUnitRow) => void
  /** Dialogs opened from the drawer, nested so it stays open beneath them. */
  children?: ReactNode
}) {
  const t = useT('coldStorage')
  return (
    <Drawer
      open
      size="lg"
      onOpenChange={(o) => !o && onClose()}
      title={unit?.name ?? t('title')}
      description={
        unit ? `${t(`kind.${unit.kind}`)} · ${unit.location}` : undefined
      }
      headerExtra={
        unit ? (
          <>
            <RangeBadge outOfRange={unit.latest?.outOfRange} />
            {unit.readingOverdue ? <OverdueBadge /> : null}
          </>
        ) : null
      }
      footer={
        unit ? (
          <div className="flex w-full flex-wrap justify-end gap-2">
            <GuardedButton
              permission="equipment.manage"
              variant="secondary"
              onClick={() => onEdit(unit)}
            >
              <PencilIcon />
              {t('editUnit')}
            </GuardedButton>
            <GuardedButton
              permission="quality.record"
              variant="primary"
              onClick={() => onLog(unit)}
            >
              <ThermometerIcon />
              {t('logReading')}
            </GuardedButton>
          </div>
        ) : null
      }
    >
      {isError ? (
        <ErrorState compact onRetry={onRetry} />
      ) : isPending ? (
        <div className="grid gap-4">
          <Skeleton className="h-36 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      ) : !unit ? (
        <EmptyState
          compact
          icon={<SearchXIcon />}
          tone="sky"
          title={t('unitNotFoundTitle')}
          description={t('unitNotFoundBody')}
        />
      ) : (
        <Body unit={unit} />
      )}
      {children}
    </Drawer>
  )
}
