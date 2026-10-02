import { RouteIcon } from 'lucide-react'
import { useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import { cn } from '@/lib/cn'
import type { TatPhases, TatSegment, TatView } from '@/services/lab-api'
import {
  ChartCard,
  ChartLegend,
  ChartTable,
  TooltipBox,
} from '@/components/charts/chart-kit'

const SEGMENT_COLOR: Record<TatSegment, string> = {
  transport: 'var(--color-chart-1)',
  'bench-wait': 'var(--color-chart-2)',
  analysis: 'var(--color-chart-3)',
  release: 'var(--color-chart-4)',
}
const SEGMENT_KEY = {
  transport: 'phaseTransport',
  'bench-wait': 'phaseBenchWait',
  analysis: 'phaseAnalysis',
  release: 'phaseRelease',
} as const satisfies Record<TatSegment, string>

/**
 * Where the time goes: the median of each phase (collection to receipt,
 * receipt to bench, bench to authorisation, authorisation to release),
 * STAT work shown apart from routine and urgent work.
 */
export function TatPhasesCard({ phases }: { phases: TatView['phases'] }) {
  const t = useT('tat')
  const f = useFormat()
  const dur = (min: number | null) =>
    min === null ? '-' : f.duration(min * 60_000)
  const rows = [
    { id: 'stat', label: t('phaseStat'), data: phases.stat },
    { id: 'other', label: t('phaseOther'), data: phases.other },
  ] as const
  const sum = (p: TatPhases) =>
    p.segments.reduce((n, s) => n + (s.medianMin ?? 0), 0)
  const scale = Math.max(1, ...rows.map((r) => sum(r.data)))
  return (
    <ChartCard
      icon={<RouteIcon />}
      tone="sky"
      title={t('phasesTitle')}
      description={t('phasesBody')}
      legend={
        <ChartLegend
          items={phases.other.segments.map((s) => ({
            key: s.key,
            label: t(SEGMENT_KEY[s.key]),
            color: SEGMENT_COLOR[s.key],
            shape: 'rect',
          }))}
        />
      }
      chart={
        <ul className="grid gap-5">
          {rows.map((row) => (
            <li key={row.id} className="grid gap-1.5">
              <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-meta">
                <span className="font-medium text-fg">{row.label}</span>
                <span className="text-xs text-fg-subtle">
                  {row.data.count
                    ? t('phaseTotal', {
                        time: dur(row.data.totalMedianMin),
                        count: row.data.count,
                      })
                    : t('phaseNone')}
                </span>
              </p>
              <div className="flex h-5 gap-0.5" aria-hidden>
                {row.data.segments
                  .filter((s) => s.medianMin)
                  .map((s, i, all) => (
                    <span
                      key={s.key}
                      className={cn(
                        'group relative h-full min-w-1',
                        i === 0 && 'rounded-l-sm',
                        i === all.length - 1 && 'rounded-r-sm',
                      )}
                      style={{
                        width: `${((s.medianMin ?? 0) / scale) * 100}%`,
                        background: SEGMENT_COLOR[s.key],
                      }}
                    >
                      <span className="absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 group-hover:block">
                        <TooltipBox
                          title={row.label}
                          rows={[
                            {
                              key: s.key,
                              label: t(SEGMENT_KEY[s.key]),
                              value: dur(s.medianMin),
                              color: SEGMENT_COLOR[s.key],
                              shape: 'rect',
                            },
                          ]}
                        />
                      </span>
                    </span>
                  ))}
                {row.data.count === 0 ? (
                  <span className="h-full w-full rounded-sm bg-surface-3" />
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      }
      table={
        <ChartTable
          caption={t('phasesTitle')}
          height={220}
          columns={[
            { key: 'phase', header: t('phaseCol') },
            { key: 'stat', header: t('phaseStat'), align: 'right' },
            { key: 'other', header: t('phaseOther'), align: 'right' },
          ]}
          rows={[
            ...phases.other.segments.map((s, i) => ({
              id: s.key,
              cells: {
                phase: t(SEGMENT_KEY[s.key]),
                stat: dur(phases.stat.segments[i]?.medianMin ?? null),
                other: dur(s.medianMin),
              },
            })),
            {
              id: 'total',
              cells: {
                phase: t('phaseTotalCol'),
                stat: dur(phases.stat.totalMedianMin),
                other: dur(phases.other.totalMedianMin),
              },
            },
          ]}
        />
      }
    />
  )
}
