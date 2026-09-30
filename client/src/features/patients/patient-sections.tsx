import {
  ClipboardListIcon,
  FileTextIcon,
  NotebookPenIcon,
  ActivityIcon,
  TestTubeIcon,
} from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { useNow } from '@/hooks/use-now'
import { useEnum, useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import { cn } from '@/lib/cn'
import type {} from '@/lib/icon-tones'
import {
  labApi,
  type OrderRow,
  type PatientDetail,
  type PatientResultRow,
  type ReportRow,
  type SampleRow,
} from '@/services/lab-api'
import { useLabMutation } from '@/services/mutations'
import { RangeText, ResultFlag, valueTone } from '@/components/lab/result'
import { ContainerChip } from '@/components/lab/sample'
import {
  OrderStatusBadge,
  ReportStatusBadge,
  SampleStatusBadge,
  PriorityMark,
} from '@/components/lab/status'
import { TatIndicator } from '@/components/lab/tat'
import { TestChips } from '@/components/lab/test-chips'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { Textarea } from '@/components/ui/input'
import { Avatar, Timeline, type TimelineEntry } from '@/components/ui/misc'
import { EmptyState } from '@/components/ui/states'
import { FilterTabs } from '@/components/ui/toggles'

export function OrderList({
  orders,
  empty,
}: {
  orders: OrderRow[]
  empty: string
}) {
  const f = useFormat()
  const e = useEnum()
  if (!orders.length)
    return <EmptyState compact icon={<ClipboardListIcon />} title={empty} />
  return (
    <ul className="divide-y divide-line">
      {orders.map((o) => (
        <li key={o.id}>
          <Link
            to={`/laboratory/orders?order=${o.id}`}
            className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 hover:bg-surface-2"
          >
            <div className="min-w-44 flex-1">
              <p className="font-mono text-meta font-semibold text-fg">
                {o.orderNo ?? '-'}
              </p>
              <p className="text-xs text-fg-muted">
                {o.orderedAt
                  ? f.dateTime(o.orderedAt)
                  : f.dateTime(o.createdAt)}{' '}
                · {o.doctor.name} · {e('encounter', o.encounter)}
              </p>
            </div>
            <TestChips tests={o.tests} max={3} className="min-w-0 flex-[2]" />
            {o.priority !== 'routine' ? (
              <PriorityMark priority={o.priority} />
            ) : null}
            <TatIndicator tat={o.tat} compact />
            <OrderStatusBadge status={o.status} size="sm" />
          </Link>
        </li>
      ))}
    </ul>
  )
}

export function SampleList({
  samples,
  empty,
}: {
  samples: SampleRow[]
  empty: string
}) {
  const f = useFormat()
  const e = useEnum()
  if (!samples.length)
    return <EmptyState compact icon={<TestTubeIcon />} title={empty} />
  return (
    <ul className="divide-y divide-line">
      {samples.map((s) => (
        <li key={s.id}>
          <Link
            to={`/laboratory/samples/${s.id}`}
            className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 hover:bg-surface-2"
          >
            <div className="min-w-48 flex-1">
              <p className="font-mono text-meta font-semibold text-fg">
                {s.accessionNo ?? '-'}
              </p>
              <p className="text-xs text-fg-muted">
                {e('department', s.department)} ·{' '}
                {s.collectedAt
                  ? f.dateTime(s.collectedAt)
                  : f.dateTime(s.createdAt)}
              </p>
            </div>
            <ContainerChip container={s.container} />
            <TestChips tests={s.tests} max={3} className="min-w-0 flex-[2]" />
            <SampleStatusBadge status={s.status} size="sm" />
          </Link>
        </li>
      ))}
    </ul>
  )
}

export function ReportList({
  reports,
  empty,
}: {
  reports: ReportRow[]
  empty: string
}) {
  const f = useFormat()
  const e = useEnum()
  const t = useT('patients')
  if (!reports.length)
    return <EmptyState compact icon={<FileTextIcon />} title={empty} />
  return (
    <ul className="divide-y divide-line">
      {reports.map((r) => (
        <li key={r.id}>
          <Link
            to={`/laboratory/reports/${r.id}`}
            className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 hover:bg-surface-2"
          >
            <div className="min-w-48 flex-1">
              <p className="font-mono text-meta font-semibold text-fg">
                {r.reportNo}
                {r.version > 1 ? (
                  <span className="ml-1.5 text-xs text-warning-text">
                    v{r.version}
                  </span>
                ) : null}
              </p>
              <p className="truncate text-xs text-fg-muted">
                {e('department', r.department)} · {r.tests.join(', ')}
              </p>
            </div>
            <div className="flex gap-1">
              {r.criticalCount ? (
                <span className="text-xs font-semibold text-danger-text">
                  {t('critical', { count: r.criticalCount })}
                </span>
              ) : null}
              {r.abnormalCount ? (
                <span className="text-xs font-semibold text-warning-text">
                  {t('abnormal', { count: r.abnormalCount })}
                </span>
              ) : null}
            </div>
            <span className="text-xs text-fg-muted">
              {r.releasedAt
                ? f.dateTime(r.releasedAt)
                : f.dateTime(r.createdAt)}
            </span>
            <ReportStatusBadge status={r.status} size="sm" />
          </Link>
        </li>
      ))}
    </ul>
  )
}

type ResultFilter = 'all' | 'abnormal' | 'critical'
const isAbnormal = (r: PatientResultRow) =>
  Boolean(r.flag && r.flag !== 'NORMAL' && r.flag !== 'NEGATIVE')

export function ResultsTable({
  results,
  filterable = true,
  limit,
}: {
  results: PatientResultRow[]
  filterable?: boolean
  limit?: number
}) {
  const t = useT('patients')
  const f = useFormat()
  const e = useEnum()
  const [filter, setFilter] = useState<ResultFilter>('all')
  const rows = results
    .filter((r) =>
      filter === 'critical'
        ? r.critical
        : filter === 'abnormal'
          ? isAbnormal(r)
          : true,
    )
    .slice(0, limit)
  const display = (r: PatientResultRow) =>
    r.value === 'positive' || r.value === 'negative'
      ? e('posneg', r.value)
      : r.value
  return (
    <div>
      {filterable ? (
        <div className="px-5 pb-3">
          <FilterTabs
            value={filter}
            onValueChange={setFilter}
            items={[
              {
                value: 'all',
                label: t('resultsFilterAll'),
                count: results.length,
              },
              {
                value: 'abnormal',
                label: t('resultsFilterAbnormal'),
                count: results.filter(isAbnormal).length,
              },
              {
                value: 'critical',
                label: t('resultsFilterCritical'),
                count: results.filter((r) => r.critical).length,
              },
            ]}
          />
        </div>
      ) : null}
      {rows.length === 0 ? (
        <EmptyState compact icon={<ActivityIcon />} title={t('noFlagged')} />
      ) : (
        <div className="relative scrollbar-thin overflow-x-auto">
          <table className="w-full min-w-[720px] text-meta">
            <thead>
              <tr className="border-y border-line bg-surface-2/60 text-left text-xs text-fg-muted">
                <th className="px-5 py-2 font-medium">{t('colParameter')}</th>
                <th className="px-3 py-2 text-right font-medium">
                  {t('colResult')}
                </th>
                <th className="px-3 py-2 font-medium">{t('colRange')}</th>
                <th className="px-3 py-2 font-medium">{t('colFlag')}</th>
                <th className="px-5 py-2 font-medium">{t('colDate')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.resultId}
                  className={cn(
                    'border-b border-line/70 last:border-0',
                    r.critical && 'bg-danger-soft/30',
                  )}
                >
                  <td className="px-5 py-2.5">
                    <p className="font-medium text-fg">{r.name}</p>
                    <p className="text-xs text-fg-subtle">{r.testName}</p>
                  </td>
                  <td
                    className={cn(
                      'px-3 py-2.5 text-right whitespace-nowrap tabular-nums',
                      valueTone(r.flag, r.critical),
                    )}
                  >
                    {display(r)}{' '}
                    <span className="text-xs font-normal text-fg-muted">
                      {r.unit}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-fg-muted">
                    <RangeText range={r.range} />
                  </td>
                  <td className="px-3 py-2.5">
                    <ResultFlag
                      flag={r.flag}
                      critical={r.critical}
                      variant="short"
                    />
                  </td>
                  <td className="px-5 py-2.5 whitespace-nowrap text-fg-muted">
                    {f.dateTime(r.at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export function NotesCard({
  patientId,
  notes,
  staffName,
}: {
  patientId: string
  notes: PatientDetail['patient']['notes']
  staffName: (id: string) => string
}) {
  const t = useT('patients')
  const f = useFormat()
  const now = useNow()
  const [text, setText] = useState('')
  const add = useLabMutation(
    (value: string) => labApi.patients.addNote(patientId, value),
    {
      success: () => t('noteAdded'),
      onSuccess: () => setText(''),
    },
  )
  const sorted = notes.toSorted((a, b) => b.at - a.at)
  return (
    <Card className="flex flex-col">
      <CardHeader icon={<NotebookPenIcon />} tone="orange" title={t('notes')} />
      <form
        className="px-5"
        onSubmit={(ev) => {
          ev.preventDefault()
          if (text.trim()) add.mutate(text.trim())
        }}
      >
        <Textarea
          rows={2}
          value={text}
          onChange={(ev) => setText(ev.target.value)}
          placeholder={t('notePlaceholder')}
          aria-label={t('addNote')}
          maxLength={1000}
        />
        <div className="mt-2 flex justify-end">
          <Button
            type="submit"
            size="sm"
            variant="secondary"
            disabled={!text.trim()}
            loading={add.isPending}
          >
            {t('addNote')}
          </Button>
        </div>
      </form>
      <ul className="mt-2 grid gap-3 px-5 pb-4">
        {sorted.length === 0 ? (
          <li className="text-xs text-fg-subtle">{t('noNotes')}</li>
        ) : null}
        {sorted.slice(0, 5).map((n) => {
          const by = staffName(n.by)
          return (
            <li key={n.id} className="flex gap-2.5">
              <Avatar name={by} size="sm" />
              <div className="min-w-0">
                <p className="text-meta text-fg">{n.text}</p>
                <p className="text-2xs text-fg-subtle">
                  {by} · {f.relative(n.at, now)}
                </p>
              </div>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

const TIMELINE_TONE: Record<string, TimelineEntry['tone']> = {
  'order-ordered': 'accent',
  'order-cancelled': 'danger',
  'sample-collected': 'accent',
  'sample-received': 'accent',
  'sample-rejected': 'danger',
  'sample-results-entered': 'neutral',
  'sample-completed': 'success',
  'report-released': 'success',
  'report-corrected': 'warning',
}

const TIMELINE_ICON: Record<string, React.ReactNode> = {
  order: <ClipboardListIcon />,
  sample: <TestTubeIcon />,
  report: <FileTextIcon />,
}

export function PatientTimeline({
  timeline,
}: {
  timeline: PatientDetail['timeline']
}) {
  const th = useT('history')
  const f = useFormat()
  const items: TimelineEntry[] = timeline.slice(0, 40).map((x) => ({
    id: x.id,
    title: x.link ? (
      <Link to={x.link} className="hover:text-accent-text hover:underline">
        {th(x.type as Parameters<typeof th>[0], x.params)}
      </Link>
    ) : (
      th(x.type as Parameters<typeof th>[0], x.params)
    ),
    meta: `${f.dateTime(x.at)}${x.byName ? ` · ${x.byName}` : ''}`,
    icon: TIMELINE_ICON[x.type.split('-')[0] ?? ''],
    tone: TIMELINE_TONE[x.type] ?? 'neutral',
  }))
  return <Timeline items={items} className="px-5 pb-5" />
}
