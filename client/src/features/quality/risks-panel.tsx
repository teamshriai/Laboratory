import {
  Grid3x3Icon,
  PencilIcon,
  PlusIcon,
  ShieldAlertIcon,
} from 'lucide-react'
import { useState } from 'react'
import { RISK_LEVELS, riskLevel, type RiskLevel } from '@/domain/quality'
import { useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import { cn } from '@/lib/cn'
import type { RiskRow } from '@/services/lab-api'
import { useRisks } from '@/services/queries'
import { GuardedButton } from '@/components/lab/guarded-button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { RISK_CELL } from './quality'
import { OverdueText, RiskLevelBadge, RiskStateText } from './quality-badges'
import { RiskDialog } from './risk-dialog'

const SCALE = [1, 2, 3, 4, 5] as const
const LEVEL_RANGE: Record<RiskLevel, string> = {
  low: '1 - 4',
  medium: '5 - 9',
  high: '10 - 15',
  extreme: '16 - 25',
}

/** Residual risk counts on a 5 x 5 grid, likelihood up, severity across. */
function HeatMap({ risks }: { risks: RiskRow[] }) {
  const t = useT('quality')
  const f = useFormat()
  const open = risks.filter((r) => r.state !== 'closed')
  const countAt = (l: number, s: number) =>
    open.filter((r) => r.residualLikelihood === l && r.residualSeverity === s)
      .length
  return (
    <div className="grid items-center gap-6 md:grid-cols-[auto_minmax(0,1fr)] md:gap-10">
      <figure className="grid justify-items-center gap-2">
        <figcaption className="text-xs text-fg-subtle">
          {t('heatAxes')}
        </figcaption>
        <table className="border-separate border-spacing-1 text-center">
          <caption className="sr-only">{t('heatCaption')}</caption>
          <thead>
            <tr>
              <td />
              {SCALE.map((s) => (
                <th
                  key={s}
                  scope="col"
                  className="p-0.5 text-xs font-semibold text-fg-muted tabular-nums"
                  title={t(`severityScale.${s}`)}
                >
                  <span className="sr-only">{t('heatSeverity')} </span>
                  {s}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SCALE.toReversed().map((l) => (
              <tr key={l}>
                <th
                  scope="row"
                  className="p-0.5 pr-1.5 text-right text-xs font-semibold text-fg-muted tabular-nums"
                  title={t(`likelihoodScale.${l}`)}
                >
                  <span className="sr-only">{t('heatLikelihood')} </span>
                  {l}
                </th>
                {SCALE.map((s) => {
                  const n = countAt(l, s)
                  const level = riskLevel(l * s)
                  return (
                    <td
                      key={s}
                      className={cn(
                        'size-9 rounded-md text-sm tabular-nums sm:size-11',
                        RISK_CELL[level],
                        n > 0 ? 'font-semibold' : 'font-normal',
                      )}
                    >
                      {n > 0 ? (
                        <span aria-hidden>{f.number(n)}</span>
                      ) : (
                        <span aria-hidden className="opacity-40">
                          0
                        </span>
                      )}
                      <span className="sr-only">
                        {t('heatCell', {
                          count: n,
                          level: t(`riskLevel.${level}`),
                          l,
                          s,
                        })}
                      </span>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </figure>
      <div className="grid gap-2">
        <h3 className="text-xs font-semibold text-fg-subtle">
          {t('heatSummaryTitle')}
        </h3>
        <ul className="grid gap-1.5">
          {RISK_LEVELS.toReversed().map((level) => {
            const residual = open.filter(
              (r) => r.residualLevel === level,
            ).length
            const inherent = open.filter((r) => r.level === level).length
            return (
              <li
                key={level}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-line px-3 py-2"
              >
                <span
                  aria-hidden
                  className={cn(
                    'size-3.5 shrink-0 rounded-sm',
                    RISK_CELL[level],
                  )}
                />
                <span className="min-w-20 text-meta font-medium text-fg">
                  {t(`riskLevel.${level}`)}
                </span>
                <span className="text-xs text-fg-subtle tabular-nums">
                  {LEVEL_RANGE[level]}
                </span>
                <span className="ml-auto text-xs text-fg-muted tabular-nums">
                  {t('heatLevelCounts', {
                    residual: f.number(residual),
                    inherent: f.number(inherent),
                  })}
                </span>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

function Score({
  l,
  s,
  score,
  level,
}: {
  l: number
  s: number
  score: number
  level: RiskLevel
}) {
  const t = useT('quality')
  return (
    <div className="grid justify-items-start gap-1">
      <RiskLevelBadge level={level} />
      <span className="text-xs whitespace-nowrap text-fg-muted tabular-nums">
        {t('riskScoreShort', { l, s, score })}
      </span>
    </div>
  )
}

export function RisksPanel() {
  const t = useT('quality')
  const f = useFormat()
  const { data, isPending, isError, refetch } = useRisks()
  const [editing, setEditing] = useState<{ risk?: RiskRow } | null>(null)

  const columns: Column<RiskRow>[] = [
    {
      id: 'risk',
      header: t('riskCol'),
      sortValue: (r) => r.riskNo,
      cell: (r) => (
        <div className="max-w-80 min-w-0">
          <p className="font-mono text-xs font-medium whitespace-nowrap text-fg">
            {r.riskNo}
          </p>
          <p className="truncate text-meta text-fg">{r.title}</p>
          <p className="truncate text-xs text-fg-muted">{r.process}</p>
        </div>
      ),
    },
    {
      id: 'inherent',
      header: t('riskInherent'),
      sortValue: (r) => r.score,
      cell: (r) => (
        <Score
          l={r.likelihood}
          s={r.severity}
          score={r.score}
          level={r.level}
        />
      ),
    },
    {
      id: 'residual',
      header: t('riskResidual'),
      sortValue: (r) => r.residualScore,
      cell: (r) => (
        <Score
          l={r.residualLikelihood}
          s={r.residualSeverity}
          score={r.residualScore}
          level={r.residualLevel}
        />
      ),
    },
    {
      id: 'owner',
      header: t('riskOwner'),
      tabletHidden: true,
      sortValue: (r) => r.ownerName,
      cell: (r) => (
        <span className="text-meta whitespace-nowrap text-fg">
          {r.ownerName}
        </span>
      ),
    },
    {
      id: 'review',
      header: t('riskReviewDue'),
      sortValue: (r) => r.reviewDueAt,
      cell: (r) => (
        <div className="grid gap-0.5">
          <span className="text-meta whitespace-nowrap text-fg">
            {f.date(r.reviewDueAt)}
          </span>
          {r.reviewOverdue ? <OverdueText label={t('reviewOverdue')} /> : null}
        </div>
      ),
    },
    {
      id: 'state',
      header: t('stateCol'),
      sortValue: (r) => r.state,
      cell: (r) => <RiskStateText state={r.state} />,
    },
    {
      id: 'actions',
      header: <span className="sr-only">{t('actions')}</span>,
      cell: (r) => (
        <GuardedButton
          permission="quality.manage"
          size="xs"
          aria-label={t('riskEditNamed', { no: r.riskNo })}
          onClick={() => setEditing({ risk: r })}
        >
          <PencilIcon />
          {t('riskReview')}
        </GuardedButton>
      ),
    },
  ]

  return (
    <div className="grid gap-4">
      <Card className="overflow-hidden">
        <CardHeader
          icon={<Grid3x3Icon />}
          tone="amber"
          title={t('heatTitle')}
          description={t('heatDescription')}
        />
        <CardBody>
          {isPending ? (
            <div role="status" aria-busy className="grid justify-center">
              <Skeleton className="size-64 rounded-xl" />
            </div>
          ) : isError ? (
            <ErrorState compact onRetry={() => void refetch()} />
          ) : (
            <HeatMap risks={data} />
          )}
        </CardBody>
      </Card>
      <Card className="overflow-hidden">
        <CardHeader
          icon={<ShieldAlertIcon />}
          tone="amber"
          title={t('risksTitle')}
          description={t('risksDescription')}
          action={
            <GuardedButton
              permission="quality.manage"
              variant="primary"
              onClick={() => setEditing({})}
            >
              <PlusIcon strokeWidth={2.5} />
              {t('riskAdd')}
            </GuardedButton>
          }
        />
        <DataTable
          caption={t('risksTitle')}
          columns={columns}
          rows={data}
          getRowId={(r) => r.id}
          isLoading={isPending}
          isError={isError}
          onRetry={() => void refetch()}
          pageSize={50}
          rowClassName={(r) =>
            r.reviewOverdue || r.residualLevel === 'extreme'
              ? 'row-alert'
              : undefined
          }
          mobile={{
            primary: 'risk',
            fields: ['residual', 'inherent', 'review', 'state'],
            actions: 'actions',
          }}
          empty={
            <EmptyState
              icon={<ShieldAlertIcon />}
              tone="amber"
              title={t('risksEmpty')}
              description={t('risksEmptyBody')}
            />
          }
        />
      </Card>
      {editing ? (
        <RiskDialog risk={editing.risk} onClose={() => setEditing(null)} />
      ) : null}
    </div>
  )
}
