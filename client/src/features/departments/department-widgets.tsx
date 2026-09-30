import {
  ArrowRightIcon,
  LibraryIcon,
  CircleCheckIcon,
  GaugeIcon,
  TestTubeIcon,
  TimerIcon,
  UsersRoundIcon,
  TriangleAlertIcon,
  WrenchIcon,
  CircleXIcon,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { PRIORITIES, SAMPLE_STATUSES, STAFF_ROLES } from '@/domain/types'
import { useEnum, useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import { cn } from '@/lib/cn'
import type {
  DepartmentDetail,
  EquipmentRow,
  QcRow,
  SampleRow,
  StaffRef,
  TatTestRow,
} from '@/services/lab-api'
import { PatientCell } from '@/components/lab/patient'
import { ContainerChip } from '@/components/lab/sample'
import {
  EquipmentBadge,
  QcBadge,
  SampleStatusBadge,
  PriorityMark,
} from '@/components/lab/status'
import { TatIndicator } from '@/components/lab/tat'
import { TestChips } from '@/components/lab/test-chips'
import { Badge, Count } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Avatar, Meter } from '@/components/ui/misc'
import { EmptyState } from '@/components/ui/states'
import { FilterTabs } from '@/components/ui/toggles'
import { TAT_TARGET_PCT } from './workload'

const QUEUE_STATUSES = [
  'collected',
  'received',
  'processing',
  'on_hold',
] as const
type QueueStatus = (typeof QUEUE_STATUSES)[number]

function ViewLink({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className={buttonVariants({ variant: 'ghost', size: 'xs' })}>
      {label}
      <ArrowRightIcon />
    </Link>
  )
}

// ---------- Active sample queue ----------

export function QueueCard({
  rows,
  activeId,
  onOpen,
}: {
  rows: SampleRow[]
  activeId: string | null
  onOpen: (row: SampleRow) => void
}) {
  const t = useT('departments')
  const e = useEnum()
  const f = useFormat()
  const [status, setStatus] = useState<QueueStatus | 'all'>('all')
  const visible =
    status === 'all' ? rows : rows.filter((r) => r.status === status)

  const columns = useMemo<Column<SampleRow>[]>(
    () => [
      {
        id: 'sample',
        header: t('colSample'),
        sortValue: (r) => r.accessionNo ?? '',
        cell: (r) => {
          const at = r.receivedAt ?? r.collectedAt
          return (
            <div className="min-w-0">
              <p
                className={cn(
                  'text-meta font-semibold whitespace-nowrap',
                  r.accessionNo ? 'font-mono text-fg' : 'text-fg-subtle',
                )}
              >
                {r.accessionNo ?? t('notLabelled')}
              </p>
              <p className="mt-0.5 flex items-center gap-2 text-xs whitespace-nowrap text-fg-muted">
                <ContainerChip
                  container={r.container}
                  className="text-xs text-fg-muted"
                />
                {at ? (
                  <span title={f.dateTime(at)}>
                    {r.receivedAt
                      ? t('receivedAt', { time: f.time(at) })
                      : t('collectedAt', { time: f.time(at) })}
                  </span>
                ) : null}
              </p>
            </div>
          )
        },
      },
      {
        id: 'patient',
        header: t('colPatient'),
        sortValue: (r) => r.patient.name,
        cell: (r) => <PatientCell patient={r.patient} showLocal={false} />,
      },
      {
        id: 'tests',
        header: t('colTests'),
        cell: (r) => <TestChips tests={r.tests} max={2} className="max-w-56" />,
      },
      {
        id: 'status',
        header: t('colStatus'),
        sortValue: (r) => SAMPLE_STATUSES.indexOf(r.status),
        cell: (r) => (
          <div className="flex max-w-48 flex-col items-start gap-1">
            <SampleStatusBadge status={r.status} />
            {r.status === 'on_hold' && r.holdReason ? (
              <span className="truncate text-xs text-warning-text">
                {e('holdReason', r.holdReason)}
              </span>
            ) : null}
            {r.status !== 'on_hold' && r.equipment ? (
              <span className="max-w-full truncate text-xs text-fg-muted">
                {r.equipment.name}
              </span>
            ) : null}
          </div>
        ),
      },
      {
        id: 'priority',
        header: t('colPriority'),
        sortValue: (r) => -PRIORITIES.indexOf(r.priority),
        cell: (r) => <PriorityMark priority={r.priority} />,
      },
      {
        id: 'tat',
        header: t('colTat'),
        sortValue: (r) => r.tat?.ratio ?? -1,
        cell: (r) => <TatIndicator tat={r.tat} />,
      },
    ],
    [t, e, f],
  )

  const tabs = [
    { value: 'all' as const, label: t('queueAll'), count: rows.length },
    ...QUEUE_STATUSES.map((s) => ({
      value: s,
      label: e('sampleStatus', s),
      count: rows.filter((r) => r.status === s).length,
    })),
  ]

  return (
    <Card className="overflow-hidden">
      <CardHeader
        icon={<TestTubeIcon />}
        title={t('queueTitle')}
        action={
          <Count
            value={rows.length}
            tone={rows.length ? 'accent' : 'neutral'}
          />
        }
      />
      <div className="border-b border-line px-3">
        <FilterTabs
          value={status}
          onValueChange={setStatus}
          items={tabs}
          aria-label={t('colStatus')}
        />
      </div>
      <DataTable
        caption={t('queueTitle')}
        columns={columns}
        rows={visible}
        getRowId={(r) => r.id}
        rowLabel={(r) => r.accessionNo ?? r.patient.name}
        onRowClick={onOpen}
        activeRowId={activeId}
        pageSize={10}
        minWidth={920}
        empty={
          rows.length === 0 ? (
            <EmptyState
              icon={<TestTubeIcon />}
              title={t('queueEmptyTitle')}
              description={t('queueEmptyBody')}
            />
          ) : (
            <EmptyState
              compact
              icon={<TestTubeIcon />}
              title={t('queueFilteredTitle')}
              description={t('queueFilteredBody')}
              action={
                <button
                  type="button"
                  className={buttonVariants({
                    variant: 'secondary',
                    size: 'sm',
                  })}
                  onClick={() => setStatus('all')}
                >
                  {t('showAll')}
                </button>
              }
            />
          )
        }
      />
    </Card>
  )
}

// ---------- Equipment ----------

function EquipmentTile({ eq }: { eq: EquipmentRow }) {
  const t = useT('departments')
  const f = useFormat()
  const down =
    eq.effectiveStatus === 'out-of-service' ||
    eq.effectiveStatus === 'maintenance'
  return (
    <li
      className={cn(
        'flex flex-col rounded-xl border bg-surface-2/40 p-4',
        eq.effectiveStatus === 'out-of-service'
          ? 'border-danger/30'
          : 'border-line',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-fg">{eq.name}</p>
          <p className="truncate text-xs text-fg-muted">
            {eq.manufacturer} {eq.model} · {eq.location}
          </p>
        </div>
        <EquipmentBadge status={eq.effectiveStatus} size="sm" />
      </div>
      <div className="mt-4">
        <div className="mb-1.5 flex items-baseline justify-between gap-2 text-xs">
          <span className="text-fg-muted">{t('utilisation')}</span>
          <span
            className={cn(
              'font-semibold tabular-nums',
              down ? 'text-fg-subtle' : 'text-fg',
            )}
          >
            {f.percent(eq.utilizationPct / 100)}
          </span>
        </div>
        <Meter
          value={eq.utilizationPct}
          max={100}
          tone={eq.utilizationPct >= 90 ? 'warning' : 'accent'}
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-fg-muted tabular-nums">
          {t('testsRunToday', { count: eq.testsToday })}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="text-fg-muted">{t('qcToday')}</span>
          {eq.qcToday === 'none' ? (
            <Badge tone="outline" size="sm">
              {t('qcNone')}
            </Badge>
          ) : (
            <QcBadge result={eq.qcToday} size="sm" />
          )}
        </span>
      </div>
      {eq.maintenanceOverdue || eq.calibrationOverdue ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {eq.maintenanceOverdue ? (
            <Badge tone="warning" size="sm">
              <WrenchIcon />
              {t('maintenanceOverdue')}
            </Badge>
          ) : null}
          {eq.calibrationOverdue ? (
            <Badge tone="warning" size="sm">
              <TriangleAlertIcon />
              {t('calibrationOverdue')}
            </Badge>
          ) : null}
        </div>
      ) : null}
    </li>
  )
}

export function EquipmentCard({ rows }: { rows: EquipmentRow[] }) {
  const { departmentId: department } = useParams()
  const t = useT('departments')
  return (
    <Card className="h-full">
      <CardHeader
        icon={<WrenchIcon />}
        title={t('equipmentTitle')}
        action={
          <ViewLink
            to={`/laboratory/equipment?department=${department}`}
            label={t('viewEquipment')}
          />
        }
      />
      <CardBody className="pt-1">
        {rows.length === 0 ? (
          <EmptyState
            compact
            icon={<WrenchIcon />}
            title={t('equipmentEmptyTitle')}
            description={t('equipmentEmptyBody')}
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {rows.map((eq) => (
              <EquipmentTile key={eq.id} eq={eq} />
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  )
}

// ---------- Quality control ----------

export function QcTodayCard({ runs }: { runs: QcRow[] }) {
  const { departmentId: department } = useParams()
  const t = useT('departments')
  const f = useFormat()
  const sorted = runs.toSorted((a, b) => b.at - a.at)
  const counts = {
    pass: runs.filter((r) => r.result === 'pass').length,
    warning: runs.filter((r) => r.result === 'warning').length,
    fail: runs.filter((r) => r.result === 'fail').length,
  }
  const tiles = [
    {
      key: 'pass',
      label: t('qcPassed'),
      value: counts.pass,
      icon: <CircleCheckIcon />,
      tone: 'bg-success-soft/70 text-success-text',
    },
    {
      key: 'warning',
      label: t('qcWarnings'),
      value: counts.warning,
      icon: <TriangleAlertIcon />,
      tone: 'bg-warning-soft/70 text-warning-text',
    },
    {
      key: 'fail',
      label: t('qcFailed'),
      value: counts.fail,
      icon: <CircleXIcon />,
      tone: 'bg-danger-soft/60 text-danger-text',
    },
  ]
  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        icon={<GaugeIcon />}
        title={t('qcTitle')}
        action={
          <ViewLink
            to={`/laboratory/quality-control?department=${department}`}
            label={t('viewQc')}
          />
        }
      />
      <CardBody className="flex flex-1 flex-col pt-1">
        {runs.length === 0 ? (
          <EmptyState
            compact
            icon={<GaugeIcon />}
            title={t('qcEmptyTitle')}
            description={t('qcEmptyBody')}
          />
        ) : (
          <>
            <dl className="grid grid-cols-3 gap-2">
              {tiles.map((x) => (
                <div
                  key={x.key}
                  className={cn(
                    'rounded-xl p-3',
                    x.value > 0 ? x.tone : 'bg-surface-2 text-fg-muted',
                  )}
                >
                  <dt className="flex items-center gap-1 text-xs [&_svg]:size-3.5">
                    {x.icon}
                    {x.label}
                  </dt>
                  <dd className="mt-1 text-lg leading-none font-semibold text-fg tabular-nums">
                    {f.number(x.value)}
                  </dd>
                </div>
              ))}
            </dl>
            <ul className="mt-3 max-h-80 scrollbar-thin divide-y divide-line/70 overflow-y-auto">
              {sorted.map((r) => (
                <li key={r.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-meta font-medium text-fg">
                      {r.analyteName}{' '}
                      <span className="font-normal text-fg-subtle">
                        {r.level}
                      </span>
                    </p>
                    <p className="truncate text-xs text-fg-muted">
                      {r.equipmentName} · {f.time(r.at)}
                      {r.rule ? ` · ${r.rule}` : ''}
                    </p>
                  </div>
                  <p className="shrink-0 text-right text-meta text-fg tabular-nums">
                    {r.value}{' '}
                    <span className="text-xs text-fg-muted">{r.unit}</span>
                    <span className="block text-2xs text-fg-subtle">
                      {t('qcZ', { value: f.decimal(r.z) })}
                    </span>
                  </p>
                  <QcBadge result={r.result} size="sm" />
                </li>
              ))}
            </ul>
          </>
        )}
      </CardBody>
    </Card>
  )
}

// ---------- Turnaround ----------

export function TatByTestCard({
  rows,
  onTimePct,
}: {
  rows: TatTestRow[]
  onTimePct: number | null
}) {
  const { departmentId: department } = useParams()
  const t = useT('departments')
  const f = useFormat()
  const shown = rows
    .toSorted(
      (a, b) => b.completed + b.inProgress - (a.completed + a.inProgress),
    )
    .slice(0, 8)
  const below = onTimePct !== null && onTimePct < TAT_TARGET_PCT
  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        icon={<TimerIcon />}
        title={t('tatTitle')}
        action={
          <ViewLink
            to={`/laboratory/tat?department=${department}`}
            label={t('viewTat')}
          />
        }
      />
      <CardBody className="flex flex-1 flex-col pt-1">
        <div className="mb-4 flex items-end justify-between gap-3 rounded-xl bg-surface-2/60 px-4 py-3">
          <div>
            <p className="text-xs text-fg-muted">{t('tatOnTimeToday')}</p>
            <p
              className={cn(
                'mt-1 inline-flex items-center gap-1.5 text-2xl leading-none font-semibold tracking-tight tabular-nums',
                below ? 'text-warning-text' : 'text-fg',
              )}
            >
              {below ? (
                <TriangleAlertIcon aria-hidden className="size-5" />
              ) : null}
              {onTimePct === null ? '-' : f.percent(onTimePct / 100)}
            </p>
            {below ? (
              <p className="mt-1 text-2xs text-warning-text">
                {t('tatBelowTarget')}
              </p>
            ) : null}
          </div>
          <Meter
            value={onTimePct ?? 0}
            max={100}
            tone={below ? 'warning' : 'success'}
            className="mb-1 w-28"
          />
        </div>
        {shown.length === 0 ? (
          <EmptyState
            compact
            icon={<TimerIcon />}
            title={t('tatEmptyTitle')}
            description={t('tatEmptyBody')}
          />
        ) : (
          <ul className="grid gap-3">
            {shown.map((r) => {
              const low = r.onTimePct !== null && r.onTimePct < TAT_TARGET_PCT
              return (
                <li key={r.testId}>
                  <div className="flex items-baseline justify-between gap-3">
                    <p
                      className="min-w-0 truncate text-meta font-medium text-fg"
                      title={r.testName}
                    >
                      {r.testName}
                    </p>
                    <p
                      className={cn(
                        'shrink-0 text-meta font-semibold tabular-nums',
                        low ? 'text-warning-text' : 'text-fg',
                      )}
                    >
                      {r.onTimePct === null
                        ? '-'
                        : f.percent(r.onTimePct / 100)}
                    </p>
                  </div>
                  <Meter
                    value={r.onTimePct ?? 0}
                    max={100}
                    tone={low ? 'warning' : 'success'}
                    className="mt-1.5"
                  />
                  <p className="mt-1 flex flex-wrap gap-x-3 text-2xs text-fg-muted tabular-nums">
                    <span>
                      {t('tatTarget', { value: f.hours(r.targetHours) })}
                    </span>
                    {r.avgMin !== null ? (
                      <span>
                        {t('tatAverage', {
                          value: f.duration(r.avgMin * 60_000),
                        })}
                      </span>
                    ) : null}
                    {r.inProgress > 0 ? (
                      <span>{t('tatInProgress', { count: r.inProgress })}</span>
                    ) : null}
                    {r.delayed > 0 ? (
                      <span className="font-medium text-danger-text">
                        {t('tatDelayedCount', { count: r.delayed })}
                      </span>
                    ) : null}
                  </p>
                </li>
              )
            })}
          </ul>
        )}
      </CardBody>
    </Card>
  )
}

// ---------- Tests ----------

type DepartmentTest = DepartmentDetail['tests'][number]

export function TestsCard({ tests }: { tests: DepartmentTest[] }) {
  const { departmentId: department } = useParams()
  const t = useT('departments')
  const f = useFormat()
  const navigate = useNavigate()
  const max = Math.max(1, ...tests.map((x) => x.orderedToday))
  const columns = useMemo<Column<DepartmentTest>[]>(
    () => [
      {
        id: 'test',
        header: t('colTest'),
        sortValue: (r) => r.name,
        cell: (r) => (
          <div className="max-w-64 min-w-0">
            <p className="truncate text-meta font-medium text-fg">{r.name}</p>
            <p className="font-mono text-xs text-fg-subtle">{r.code}</p>
          </div>
        ),
      },
      {
        id: 'container',
        header: t('colContainer'),
        cell: (r) => <ContainerChip container={r.container} />,
      },
      {
        id: 'tat',
        header: t('colTatTarget'),
        sortValue: (r) => r.tatHours,
        cell: (r) => (
          <div className="text-meta whitespace-nowrap tabular-nums">
            <span className="text-fg">{f.hours(r.tatHours)}</span>
            <span className="block text-xs text-fg-muted">
              {t('statTarget', { value: f.hours(r.statTatHours) })}
            </span>
          </div>
        ),
      },
      {
        id: 'price',
        tabletHidden: true,
        header: t('colPrice'),
        align: 'right',
        sortValue: (r) => r.price,
        cell: (r) => (
          <span className="text-meta text-fg tabular-nums">
            {f.currency(r.price)}
          </span>
        ),
      },
      {
        id: 'ordered',
        header: t('colOrderedToday'),
        sortValue: (r) => r.orderedToday,
        cell: (r) => (
          <div className="flex w-36 items-center gap-2.5">
            <span className="w-7 text-right text-meta font-semibold text-fg tabular-nums">
              {f.number(r.orderedToday)}
            </span>
            <span className="flex h-1.5 flex-1 items-center">
              {r.orderedToday > 0 ? (
                <span
                  className="block h-full rounded-sm bg-chart-1"
                  style={{
                    width: `${Math.max(6, (r.orderedToday / max) * 100)}%`,
                  }}
                />
              ) : (
                <span className="block h-full w-full rounded-sm bg-surface-3" />
              )}
            </span>
          </div>
        ),
      },
    ],
    [t, f, max],
  )
  return (
    <Card className="h-full overflow-hidden">
      <CardHeader
        icon={<LibraryIcon />}
        title={t('testsTitle')}
        action={
          <ViewLink
            to={`/laboratory/test-catalog?department=${department}`}
            label={t('openCatalog')}
          />
        }
      />
      <div className="border-t border-line">
        <DataTable
          caption={t('testsTitle')}
          columns={columns}
          rows={tests}
          getRowId={(r) => r.id}
          rowLabel={(r) => r.name}
          onRowClick={(r) =>
            void navigate(`/laboratory/test-catalog?test=${r.id}`)
          }
          pageSize={8}
          minWidth={620}
          empty={
            <EmptyState
              compact
              icon={<LibraryIcon />}
              title={t('testsEmptyTitle')}
              description={t('testsEmptyBody')}
            />
          }
        />
      </div>
    </Card>
  )
}

// ---------- Staff ----------

export function StaffCard({
  staff,
  actorId,
}: {
  staff: StaffRef[]
  actorId: string
}) {
  const t = useT('departments')
  const e = useEnum()
  const sorted = staff.toSorted(
    (a, b) =>
      STAFF_ROLES.indexOf(a.role) - STAFF_ROLES.indexOf(b.role) ||
      a.name.localeCompare(b.name),
  )
  return (
    <Card>
      <CardHeader
        icon={<UsersRoundIcon />}
        title={t('staffTitle')}
        action={<Count value={staff.length} />}
      />
      <CardBody className="pt-1">
        {sorted.length === 0 ? (
          <EmptyState
            compact
            icon={<UsersRoundIcon />}
            title={t('staffEmptyTitle')}
            description={t('staffEmptyBody')}
          />
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {sorted.map((s) => (
              <li
                key={s.id}
                className={cn(
                  'flex items-center gap-3 rounded-xl border p-3',
                  s.id === actorId
                    ? 'border-accent/40 bg-accent-soft/40'
                    : 'border-line',
                )}
              >
                <Avatar name={s.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-meta font-medium text-fg">
                    {s.name}
                  </p>
                  <p className="truncate text-xs text-fg-muted">
                    {e('staffRole', s.role)}
                  </p>
                </div>
                {s.id === actorId ? (
                  <Badge tone="accent" size="sm">
                    {t('actingAs')}
                  </Badge>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  )
}
