import type { DepartmentId } from '@/domain/types'
import { useEnum, useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import { cn } from '@/lib/cn'
import { Tooltip } from '@/components/ui/tooltip'
import { WORK_SERIES, workTotal, type WorkCounts } from './workload'

/** Stacked strip of today's tests by workflow stage for one department. */
export function WorkStrip({
  department,
  counts,
  className,
}: {
  department: DepartmentId
  counts: WorkCounts
  className?: string
}) {
  const t = useT('departments')
  const e = useEnum()
  const f = useFormat()
  const total = workTotal(counts)
  const label = t('stripLabel', {
    department: e('department', department),
    pending: f.number(counts.pending),
    inLab: f.number(counts.processing),
    awaiting: f.number(counts.awaitingValidation),
    completed: f.number(counts.completed),
  })
  return (
    <div
      className={cn('flex h-2 items-center gap-0.5', className)}
      role="img"
      aria-label={label}
    >
      {total === 0 ? (
        <span className="block h-full w-full rounded-sm bg-surface-3" />
      ) : (
        WORK_SERIES.map((s) =>
          counts[s.key] > 0 ? (
            <Tooltip
              key={s.key}
              content={`${t(s.label)}: ${f.number(counts[s.key])}`}
            >
              <span
                className={cn(
                  'block h-full min-w-1.5 rounded-sm transition-[flex-grow] duration-700',
                  s.swatch,
                )}
                style={{ flexGrow: counts[s.key], flexBasis: 0 }}
              />
            </Tooltip>
          ) : null,
        )
      )}
    </div>
  )
}

/** Page-level legend for the workflow strips. */
export function WorkLegend({ className }: { className?: string }) {
  const t = useT('departments')
  return (
    <ul
      aria-label={t('legendLabel')}
      className={cn(
        'flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-fg-muted',
        className,
      )}
    >
      {WORK_SERIES.map((s) => (
        <li key={s.key} className="inline-flex items-center gap-1.5">
          <span className={cn('size-2.5 rounded-sm', s.swatch)} aria-hidden />
          {t(s.label)}
        </li>
      ))}
    </ul>
  )
}
