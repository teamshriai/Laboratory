import {
  CircleCheckIcon,
  ListChecksIcon,
  TriangleAlertIcon,
} from 'lucide-react'
import { useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import { cn } from '@/lib/cn'
import { QcBadge } from '@/components/lab/status'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader } from '@/components/ui/card'
import {
  formatFixed,
  groupByAnalyzer,
  qcDigits,
  seriesKey,
  type QcSeries,
} from './qc-utils'

/** Every control series with its latest result; choosing one drives the chart. */
export function SeriesList({
  series,
  activeKey,
  onSelect,
}: {
  series: QcSeries[]
  activeKey: string | null
  onSelect: (key: string) => void
}) {
  const t = useT('qc')
  const f = useFormat()
  const flagged = series.filter((s) => s.last !== 'pass').length
  const failing = series.some((s) => s.last === 'fail')
  return (
    <Card className="flex max-h-[28rem] min-w-0 flex-col xl:max-h-[39rem]">
      <CardHeader
        icon={<ListChecksIcon />}
        title={t('seriesTitle')}
        action={
          flagged > 0 ? (
            <Badge tone={failing ? 'danger' : 'warning'} size="sm">
              <TriangleAlertIcon />
              {t('seriesFlagged', { count: flagged })}
            </Badge>
          ) : (
            <Badge tone="success" size="sm">
              <CircleCheckIcon />
              {t('allInControl')}
            </Badge>
          )
        }
      />
      <div className="min-h-0 flex-1 scrollbar-thin overflow-y-auto border-t border-line px-2 pt-1 pb-2">
        {groupByAnalyzer(series).map((group) => (
          <section
            key={group.equipmentId}
            aria-label={group.equipmentName}
            className="pt-2"
          >
            <h3 className="px-3 pb-1 text-2xs font-semibold tracking-wide text-fg-subtle uppercase">
              {group.equipmentName}
            </h3>
            <ul className="grid gap-0.5">
              {group.series.map((s) => {
                const key = seriesKey(s)
                const active = key === activeKey
                const digits = qcDigits(s.mean, s.sd)
                return (
                  <li key={key}>
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() => onSelect(key)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors',
                        active
                          ? 'bg-accent-soft/60 ring-1 ring-accent/30 ring-inset'
                          : 'hover:bg-surface-2',
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-meta font-medium text-fg">
                            {s.analyteName}
                          </span>
                          <span className="shrink-0 rounded-md bg-surface-3 px-1.5 text-2xs font-semibold text-fg-muted">
                            {s.level}
                          </span>
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-fg-muted tabular-nums">
                          {t('seriesStats', {
                            mean: formatFixed(f.locale, s.mean, digits),
                            sd: formatFixed(f.locale, s.sd, digits),
                            cv: s.cv === null ? '-' : f.percent(s.cv / 100),
                          })}
                        </span>
                      </span>
                      <QcBadge result={s.last} size="sm" />
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>
    </Card>
  )
}
