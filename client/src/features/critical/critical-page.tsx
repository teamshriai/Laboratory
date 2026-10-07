import {
  BadgeCheckIcon,
  BanIcon,
  ChevronsUpIcon,
  CircleCheckIcon,
  EllipsisIcon,
  HistoryIcon,
  PhoneCallIcon,
} from 'lucide-react'
import { useDeferredValue, useState } from 'react'
import { Link } from 'react-router'
import {
  NOTIFY_METHODS,
  NOTIFY_OUTCOMES,
  NOTIFY_ROLES,
  type NotifyMethod,
  type NotifyOutcome,
  type NotifyRole,
} from '@/domain/types'
import { useOverlayParam, useSearchParam } from '@/hooks/use-search-param'
import { ExportButton } from '@/components/lab/export-button'
import { RecordLink } from '@/components/lab/record-link'
import { isFullName } from '@/domain/critical'
import { useNow } from '@/hooks/use-now'
import { useEnum, useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import { cn } from '@/lib/cn'
import { labApi, type CriticalRow } from '@/services/lab-api'
import { useLabMutation } from '@/services/mutations'
import { useCriticals } from '@/services/queries'
import { formatCriticalRangeParts } from '@/features/shared/format-range'
import { PatientCell } from '@/components/lab/patient'
import { ResultFlag } from '@/components/lab/result'
import { CriticalStateBadge } from '@/components/lab/status'
import { MetricStrip } from '@/components/ui/metric-strip'
import { PageHeader } from '@/app/layout/page-header'
import { Button } from '@/components/ui/button'
import { GuardedButton } from '@/components/lab/guarded-button'
import { Card } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { IconButton } from '@/components/ui/icon-button'
import { Input, SearchInput, Textarea } from '@/components/ui/input'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { Checkbox, FilterTabs } from '@/components/ui/toggles'

const IST = 330 * 60_000
const toLocal = (ms: number) => new Date(ms + IST).toISOString().slice(0, 16)
const fromLocal = (v: string) => Date.parse(`${v}:00Z`) - IST
const TABS = [
  'pending',
  'escalated',
  'notified',
  'acknowledged',
  'all',
] as const
type Tab = (typeof TABS)[number]
type Action = 'document' | 'escalate' | 'void'
/** What the escalate dialog starts with when opened from a due escalation. */
interface EscalatePrefill {
  to: string
  reason: string
}

/**
 * The escalation the lab's policy calls for now, unless someone already
 * escalated after that tier was reached.
 */
function dueEscalation(row: CriticalRow) {
  const due = row.escalationDue
  if (!due) return undefined
  if (
    row.escalatedAt &&
    row.escalatedAt >= row.detectedAt + due.afterMin * 60_000
  )
    return undefined
  return due
}

function Lifecycle({ row }: { row: CriticalRow }) {
  const t = useT('critical')
  const f = useFormat()
  const steps = [
    { label: t('stepDetected'), at: row.detectedAt },
    { label: t('stepStaff'), at: row.detectedAt },
    { label: t('stepContacted'), at: row.notifiedAt },
    { label: t('stepAcknowledged'), at: row.acknowledgedAt },
    { label: t('stepDocumented'), at: row.acknowledgedAt },
  ]
  // Five steps across when the card has room; a vertical list on narrow
  // cards, where the labels would collide.
  return (
    <div className="@container">
      <ol className="grid gap-1.5 @md:flex @md:items-start @md:gap-0">
        {steps.map((s, i) => (
          <li
            key={i}
            className="flex min-w-0 items-center gap-2 @md:flex-1 @md:flex-col @md:gap-0 @md:text-center"
          >
            <div className="flex shrink-0 items-center @md:w-full">
              <span
                className={cn(
                  'hidden h-0.5 flex-1 @md:block',
                  i === 0 ? 'opacity-0' : s.at ? 'bg-success' : 'bg-line',
                )}
              />
              <span
                className={cn(
                  'grid size-5 shrink-0 place-items-center rounded-full',
                  s.at
                    ? 'bg-success text-on-success'
                    : 'bg-surface-3 text-fg-subtle',
                )}
              >
                {s.at ? (
                  <CircleCheckIcon strokeWidth={2.2} className="size-3.5" />
                ) : (
                  <span className="size-1.5 rounded-full bg-current" />
                )}
              </span>
              <span
                className={cn(
                  'hidden h-0.5 flex-1 @md:block',
                  i === steps.length - 1
                    ? 'opacity-0'
                    : steps[i + 1]?.at
                      ? 'bg-success'
                      : 'bg-line',
                )}
              />
            </div>
            <span
              className={cn(
                'text-2xs leading-tight hyphens-auto @md:mt-1 @md:w-full @md:px-0.5',
                s.at ? 'text-fg' : 'text-fg-subtle',
              )}
            >
              {s.label}
            </span>
            <span className="text-2xs text-fg-subtle tabular-nums @md:mt-0.5 @md:w-full">
              {s.at ? f.time(s.at) : ''}
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}

/**
 * Records one communication attempt. Only a reached clinician can
 * acknowledge, and acknowledgement needs the value read back.
 */
function DocumentDialog({
  row,
  onClose,
}: {
  row: CriticalRow
  onClose: () => void
}) {
  const t = useT('critical')
  const tc = useT('common')
  const e = useEnum()
  const now = useNow()
  const ackOnly = row.status === 'notified'
  const [name, setName] = useState(row.escalatedTo ?? row.doctor.name)
  const [role, setRole] = useState<NotifyRole>('consultant')
  const [method, setMethod] = useState<NotifyMethod>('phone')
  const [outcome, setOutcome] = useState<NotifyOutcome>('reached')
  const [time, setTime] = useState(() => toLocal(now))
  const [ack, setAck] = useState(true)
  const [readBack, setReadBack] = useState(false)
  const [remarks, setRemarks] = useState('')
  const [tried, setTried] = useState(false)
  const reached = ackOnly || outcome === 'reached'
  const acknowledging = ackOnly || (reached && ack)
  const readBackMissing = acknowledging && !readBack
  // CAP COM.30000: the person reached is recorded by full name.
  const nameError = !name.trim()
    ? 'forms.required'
    : reached && !isFullName(name)
      ? 'critical.fullNameRequired'
      : undefined
  const save = useLabMutation(
    () =>
      ackOnly
        ? labApi.critical.acknowledge(row.id, {
            acknowledgedAt: fromLocal(time),
            readBack,
            ...(remarks.trim() ? { remarks } : {}),
          })
        : labApi.critical.document(row.id, {
            notifiedTo: name,
            role,
            method,
            outcome,
            notifiedAt: fromLocal(time),
            acknowledged: acknowledging,
            readBack: acknowledging && readBack,
            ...(remarks.trim() ? { remarks } : {}),
          }),
    {
      success: () =>
        acknowledging
          ? t('acknowledged')
          : reached
            ? t('saved')
            : t('attemptSaved'),
      onSuccess: onClose,
    },
  )
  const submit = () => {
    setTried(true)
    if ((!ackOnly && nameError) || readBackMissing) return
    save.mutate()
  }
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={ackOnly ? t('dialogAckTitle') : t('dialogTitle')}
      description={t('dialogCritical', {
        patient: `${row.patient.name} (${row.patient.uhid})`,
        analyte: row.analyteName,
        value: `${row.value} ${row.unit}`,
      })}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {tc('cancel')}
          </Button>
          <Button variant="primary" loading={save.isPending} onClick={submit}>
            <BadgeCheckIcon />
            {acknowledging
              ? t('saveAck')
              : reached
                ? t('save')
                : t('saveAttempt')}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <p className="flex items-center gap-2 rounded-lg bg-surface-2 p-3 text-meta text-fg">
          <PhoneCallIcon className="size-4 text-accent-text" aria-hidden />
          {t('doctorPhone', { name: row.doctor.name, phone: row.doctor.phone })}
        </p>
        {row.attempts.length > 0 ? (
          <p className="text-xs text-fg-muted">
            {t('previousAttempts', { count: row.attempts.length })}
          </p>
        ) : null}
        {!ackOnly ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t('notifiedName')}
              required
              className="sm:col-span-2"
              error={tried ? nameError : undefined}
            >
              <Input
                value={name}
                onChange={(ev) => setName(ev.target.value)}
                placeholder={t('notifiedNamePlaceholder')}
              />
            </Field>
            <Field label={t('role')}>
              <Select
                value={role}
                onValueChange={setRole}
                options={NOTIFY_ROLES.map((r) => ({
                  value: r,
                  label: e('notifyRole', r),
                }))}
              />
            </Field>
            <Field label={t('method')}>
              <Select
                value={method}
                onValueChange={setMethod}
                options={NOTIFY_METHODS.map((m) => ({
                  value: m,
                  label: e('notifyMethod', m),
                }))}
              />
            </Field>
            <Field label={t('outcome')} className="sm:col-span-2">
              <Select
                value={outcome}
                onValueChange={setOutcome}
                options={NOTIFY_OUTCOMES.map((o) => ({
                  value: o,
                  label: e('notifyOutcome', o),
                }))}
              />
            </Field>
          </div>
        ) : null}
        <Field label={t('time')} required>
          <Input
            type="datetime-local"
            value={time}
            max={toLocal(now + 60_000)}
            onChange={(ev) => setTime(ev.target.value)}
          />
        </Field>
        {!ackOnly && reached ? (
          <CheckLine checked={ack} onChange={setAck} label={t('ackNow')} />
        ) : null}
        {acknowledging ? (
          <div className="grid gap-1">
            <CheckLine
              checked={readBack}
              onChange={setReadBack}
              label={t('readBackConfirm')}
            />
            {tried && readBackMissing ? (
              <p role="alert" className="text-xs font-medium text-danger-text">
                {t('readBackRequired')}
              </p>
            ) : (
              <p className="text-xs text-fg-subtle">{t('readBackHint')}</p>
            )}
          </div>
        ) : null}
        <Field label={t('remarks')} optionalLabel={tc('optional')}>
          <Textarea
            value={remarks}
            onChange={(ev) => setRemarks(ev.target.value)}
            rows={2}
          />
        </Field>
      </div>
    </Dialog>
  )
}

/** A checkbox with its label shown beside it. */
function CheckLine({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm text-fg">
      <Checkbox checked={checked} onCheckedChange={onChange} label={label} />
      <span>{label}</span>
    </label>
  )
}

/** Escalation to a senior clinician, or closing the alert, both with a reason. */
function ReasonActionDialog({
  row,
  action,
  prefill,
  onClose,
}: {
  row: CriticalRow
  action: 'escalate' | 'void'
  /** Escalation due under the lab's policy: its target and why. */
  prefill?: EscalatePrefill | null
  onClose: () => void
}) {
  const t = useT('critical')
  const tc = useT('common')
  const [to, setTo] = useState(prefill?.to ?? '')
  const [reason, setReason] = useState(prefill?.reason ?? '')
  const [tried, setTried] = useState(false)
  const save = useLabMutation(
    () =>
      action === 'escalate'
        ? labApi.critical.escalate(row.id, { to, reason })
        : labApi.critical.void(row.id, reason),
    {
      success: () =>
        action === 'escalate' ? t('escalatedToast') : t('voidedToast'),
      onSuccess: onClose,
    },
  )
  const invalid = !reason.trim() || (action === 'escalate' && !to.trim())
  return (
    <Dialog
      open
      size="sm"
      onOpenChange={(o) => !o && onClose()}
      title={action === 'escalate' ? t('escalateTitle') : t('voidTitle')}
      description={action === 'escalate' ? t('escalateBody') : t('voidBody')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {tc('cancel')}
          </Button>
          <Button
            variant={action === 'void' ? 'danger' : 'primary'}
            loading={save.isPending}
            onClick={() => {
              setTried(true)
              if (!invalid) save.mutate()
            }}
          >
            {action === 'escalate' ? t('escalate') : t('closeAlert')}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        {action === 'escalate' ? (
          <Field
            label={t('escalateTo')}
            required
            error={tried && !to.trim() ? 'forms.required' : undefined}
          >
            <Input
              value={to}
              onChange={(ev) => setTo(ev.target.value)}
              placeholder={t('escalateToPlaceholder')}
              autoFocus
            />
          </Field>
        ) : null}
        <Field
          label={t('reasonLabel')}
          required
          error={tried && !reason.trim() ? 'forms.required' : undefined}
        >
          <Textarea
            value={reason}
            onChange={(ev) => setReason(ev.target.value)}
            rows={3}
            placeholder={
              action === 'escalate'
                ? t('escalateReasonPlaceholder')
                : t('voidReasonPlaceholder')
            }
          />
        </Field>
      </div>
    </Dialog>
  )
}

/** Attempts and history of one alert, most recent first. */
function AlertAudit({ row }: { row: CriticalRow }) {
  const t = useT('critical')
  const th = useT('history')
  const e = useEnum()
  const f = useFormat()
  if (row.history.length === 0) return null
  return (
    <details className="group/audit mt-2">
      <summary className="tap-reach inline-flex min-h-8 cursor-pointer list-none items-center gap-1.5 rounded-md text-xs font-medium text-accent-text hover:underline">
        <HistoryIcon className="size-3.5" aria-hidden />
        {t('auditTrail', { count: row.history.length })}
      </summary>
      <ol className="mt-2 grid gap-1.5 border-l border-line pl-3">
        {row.history.map((h) => (
          <li key={h.id} className="text-xs">
            <span className="text-fg">
              {th(h.type as Parameters<typeof th>[0], {
                ...h.params,
                ...(h.params?.outcome
                  ? {
                      outcome: e(
                        'notifyOutcome',
                        h.params.outcome as NotifyOutcome,
                      ),
                    }
                  : {}),
                ...(h.params?.method
                  ? {
                      method: e(
                        'notifyMethod',
                        h.params.method as NotifyMethod,
                      ),
                    }
                  : {}),
              })}
            </span>
            <span className="block text-fg-subtle">
              {h.byName} · {f.dateTime(h.at)}
            </span>
          </li>
        ))}
      </ol>
    </details>
  )
}

export function Component() {
  const t = useT('critical')
  const tc = useT('common')
  const e = useEnum()
  const f = useFormat()
  const now = useNow()
  const [tab, setTab] = useSearchParam<Tab>('status', 'pending', TABS)
  const [alertId, openAlert, closeAlert] = useOverlayParam('alert')
  const [action, setAction] = useState<Action>('document')
  const [prefill, setPrefill] = useState<EscalatePrefill | null>(null)
  const [query, setQuery] = useSearchParam<string>('q', '')
  const q = useDeferredValue(query)
  const { data, isPending, isError, refetch } = useCriticals({ status: tab, q })
  const { data: all } = useCriticals({ status: 'all' })
  const dialogRow = alertId
    ? all?.rows.find(
        (r) =>
          r.id === alertId && (r.status === 'open' || r.status === 'notified'),
      )
    : undefined
  const open = (
    id: string,
    next: Action = 'document',
    fill: EscalatePrefill | null = null,
  ) => {
    setAction(next)
    setPrefill(fill)
    openAlert(id)
  }
  // Escalations the policy calls for now come first (the sort is stable).
  const rows = (data?.rows ?? []).toSorted(
    (a, b) =>
      Number(Boolean(dueEscalation(b))) - Number(Boolean(dueEscalation(a))),
  )
  const limit = all?.rows[0]?.limitMin ?? 30
  const today =
    all?.rows.filter(
      (r) => r.detectedAt > now - 24 * 3_600_000 && r.status !== 'voided',
    ).length ?? 0
  const notifyTimes = (all?.rows ?? [])
    .filter((r) => r.notifiedAt)
    .map((r) => (r.notifiedAt! - r.detectedAt) / 60_000)
    .toSorted((a, b) => a - b)
  const median = notifyTimes.length
    ? notifyTimes[Math.floor(notifyTimes.length / 2)]!
    : null

  return (
    <>
      <PageHeader
        title={t('title')}
        meta={<span>{t('policy', { minutes: limit })}</span>}
        actions={
          <ExportButton
            filename={t('exportFile')}
            entity="critical"
            disabled={!data?.rows.length}
            rows={() => [
              [
                t('exportDetected'),
                tc('patient'),
                tc('uhid'),
                tc('sampleId'),
                t('exportAnalyte'),
                t('exportValue'),
                tc('status'),
                t('exportNotifiedTo'),
                t('exportNotifiedAt'),
                t('exportMinutes'),
                t('exportReadBack'),
              ],
              ...(data?.rows ?? []).map((r) => [
                f.dateTime(r.detectedAt),
                r.patient.name,
                r.patient.uhid,
                r.accessionNo,
                r.analyteName,
                `${r.value} ${r.unit}`.trim(),
                e('criticalState', r.state),
                r.notifiedTo,
                r.notifiedAt ? f.dateTime(r.notifiedAt) : '',
                r.notifiedAt
                  ? Math.round((r.notifiedAt - r.detectedAt) / 60_000)
                  : '',
                r.readBack ? tc('yes') : tc('no'),
              ]),
            ]}
          />
        }
      />
      <MetricStrip
        className="mb-5"
        items={[
          {
            key: 'pending',
            label: t('kpiPending'),
            value: all?.counts.pending ?? 0,
            alert: (all?.counts.pending ?? 0) > 0,
            href: '/critical-results?status=pending',
          },
          {
            key: 'overdue',
            label: t('kpiOverdue', { minutes: limit }),
            value: all?.counts.overdue ?? 0,
            alert: (all?.counts.overdue ?? 0) > 0,
            href: '/critical-results?status=pending',
          },
          {
            key: 'escalated',
            label: t('kpiEscalated'),
            value: all?.counts.escalated ?? 0,
            alert: (all?.counts.escalated ?? 0) > 0,
            href: '/critical-results?status=escalated',
          },
          {
            key: 'today',
            label: t('kpiToday'),
            value: today,
            href: '/critical-results?status=all',
          },
          {
            key: 'median',
            label: t('kpiMedian'),
            value: median === null ? '-' : f.duration(median * 60_000),
            href: '/critical-results?status=acknowledged',
          },
        ]}
      />
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-3 pt-1">
          <FilterTabs
            value={tab}
            onValueChange={(v) => setTab(v)}
            aria-label={t('title')}
            items={[
              {
                value: 'pending',
                label: t('tabPending'),
                count: all?.counts.pending,
                tone: 'danger',
              },
              {
                value: 'escalated',
                label: t('tabEscalated'),
                count: all?.counts.escalated,
                tone: 'danger',
              },
              {
                value: 'notified',
                label: t('tabNotified'),
                count: all?.counts.notified,
              },
              {
                value: 'acknowledged',
                label: t('tabAcknowledged'),
                count: all?.counts.acknowledged,
              },
              { value: 'all', label: t('tabAll'), count: all?.counts.all },
            ]}
          />
          <SearchInput
            value={query}
            onValueChange={setQuery}
            placeholder={t('search')}
            aria-label={tc('search')}
            className="mb-1 w-full sm:w-80"
          />
        </div>
        {isError && !data ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : isPending ? (
          <div className="grid gap-3 p-5">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<CircleCheckIcon />}
            title={q ? t('emptySearchTitle') : t('emptyTitle')}
            description={q ? t('emptySearchBody') : t('emptyBody')}
          />
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((r) => {
              const minutes = Math.round(
                ((r.notifiedAt ?? now) - r.detectedAt) / 60_000,
              )
              const live = r.status === 'open' || r.status === 'notified'
              const due = live ? dueEscalation(r) : undefined
              const lastAttempt = r.attempts.at(-1)
              return (
                <li
                  key={r.id}
                  className={cn(
                    // Two columns on tablets (patient and value, then lifecycle and
                    // actions); four from 1280px.
                    'grid gap-4 px-4 py-4 sm:px-5 md:grid-cols-2 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.6fr)_auto] xl:items-start',
                    live && 'shadow-[inset_3px_0_0_var(--danger)]',
                    due &&
                      'bg-danger-soft/35 shadow-[inset_5px_0_0_var(--danger)]',
                  )}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={cn(
                        'w-14 shrink-0 text-center text-xs tabular-nums',
                        r.overdue
                          ? 'font-semibold text-danger-text'
                          : 'text-fg-muted',
                      )}
                    >
                      <span className="block text-figure-sm font-semibold">
                        {minutes}
                      </span>
                      {t('minutesShort')}
                    </span>
                    <div className="min-w-0">
                      <PatientCell
                        patient={r.patient}
                        showLocal={false}
                        size="sm"
                      />
                      <p className="mt-1 truncate text-xs text-fg-muted">
                        {e('encounter', r.encounter)}
                        {r.ward
                          ? ` · ${r.ward}${r.bed ? ` / ${r.bed}` : ''}`
                          : ''}{' '}
                        · {r.doctor.name}
                      </p>
                    </div>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-fg-muted">{r.analyteName}</p>
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-lg font-semibold text-danger-text tabular-nums">
                      {r.value}{' '}
                      <span className="text-xs font-normal text-fg-muted">
                        {r.unit}
                      </span>
                      <ResultFlag flag={r.flag} critical variant="short" />
                    </p>
                    <p className="truncate text-2xs text-fg-subtle">
                      {formatCriticalRangeParts(r.range, tc('or'))
                        ? t('critRange', {
                            range: formatCriticalRangeParts(r.range, tc('or')),
                          })
                        : r.testName}
                    </p>
                    <p className="mt-1 text-2xs text-fg-subtle">
                      {t('detectedAt', {
                        time: f.dateTime(r.detectedAt),
                        name: r.detectedByName,
                      })}
                    </p>
                    <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-fg-muted">
                      {r.accessionNo ? (
                        <RecordLink kind="specimen" id={r.sampleId}>
                          {r.accessionNo}
                        </RecordLink>
                      ) : null}
                      {r.orderNo ? (
                        <RecordLink kind="order" id={r.orderId}>
                          {r.orderNo}
                        </RecordLink>
                      ) : null}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <Lifecycle row={r} />
                    {r.notifiedTo ? (
                      <p className="mt-2 truncate text-xs text-fg-muted">
                        {t('notifiedTo', {
                          name: r.notifiedTo,
                          role: r.notifiedRole
                            ? e('notifyRole', r.notifiedRole)
                            : '',
                          method: r.method ? e('notifyMethod', r.method) : '',
                        })}
                        {r.readBack ? ` · ${t('readBack')}` : ''}
                      </p>
                    ) : lastAttempt ? (
                      <p className="mt-2 truncate text-xs text-danger-text">
                        {t('lastAttempt', {
                          count: r.attempts.length,
                          outcome: e('notifyOutcome', lastAttempt.outcome),
                          time: f.time(lastAttempt.at),
                        })}
                      </p>
                    ) : null}
                    {r.escalatedTo ? (
                      <p className="mt-1 flex items-center gap-1 text-xs font-medium text-danger-text">
                        <ChevronsUpIcon className="size-3.5" aria-hidden />
                        {t('escalatedTo', {
                          name: r.escalatedTo,
                          time: r.escalatedAt ? f.time(r.escalatedAt) : '',
                        })}
                      </p>
                    ) : null}
                    <AlertAudit row={r} />
                  </div>
                  <div className="flex flex-wrap items-center gap-2 md:justify-end md:self-start xl:flex-col xl:items-end">
                    <CriticalStateBadge state={r.state} />
                    {due ? (
                      <GuardedButton
                        permission="critical.communicate"
                        size="sm"
                        variant="danger-soft"
                        className="h-auto max-w-full py-1.5 text-left whitespace-normal"
                        onClick={() =>
                          open(r.id, 'escalate', {
                            to: e('escalationTarget', due.to),
                            reason: t('escalationDueReason', {
                              minutes: due.afterMin,
                              step: due.step,
                            }),
                          })
                        }
                      >
                        <ChevronsUpIcon />
                        <span className="grid min-w-0">
                          <span>
                            {t('escalationDue', {
                              target: e('escalationTarget', due.to),
                            })}
                          </span>
                          <span className="text-2xs font-medium tabular-nums">
                            {t('escalationDueSince', {
                              minutes: Math.round(
                                (now - r.detectedAt) / 60_000,
                              ),
                            })}
                          </span>
                        </span>
                      </GuardedButton>
                    ) : null}
                    {live ? (
                      <div className="flex min-w-0 items-center gap-1.5">
                        <GuardedButton
                          permission="critical.communicate"
                          size="sm"
                          variant={r.status === 'open' ? 'danger' : 'primary'}
                          onClick={() => open(r.id)}
                        >
                          {r.status === 'open' ? (
                            <PhoneCallIcon />
                          ) : (
                            <BadgeCheckIcon />
                          )}
                          {r.status === 'open' ? t('record') : t('acknowledge')}
                        </GuardedButton>
                        <Menu>
                          <MenuTrigger asChild>
                            <IconButton
                              label={t('moreActions')}
                              icon={<EllipsisIcon />}
                            />
                          </MenuTrigger>
                          <MenuContent align="end">
                            {!r.escalatedAt ? (
                              <MenuItem
                                icon={<ChevronsUpIcon />}
                                onSelect={() => open(r.id, 'escalate')}
                              >
                                {t('escalate')}
                              </MenuItem>
                            ) : null}
                            <MenuItem
                              icon={<BanIcon />}
                              onSelect={() => open(r.id, 'void')}
                            >
                              {t('closeAlert')}
                            </MenuItem>
                          </MenuContent>
                        </Menu>
                      </div>
                    ) : (
                      <Link
                        to={`/specimens/${r.sampleId}`}
                        className="text-xs font-medium text-accent-text hover:underline"
                      >
                        {t('openSample')}
                      </Link>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Card>
      {dialogRow && action === 'document' ? (
        <DocumentDialog
          key={dialogRow.id + dialogRow.status}
          row={dialogRow}
          onClose={closeAlert}
        />
      ) : null}
      {dialogRow && action !== 'document' ? (
        <ReasonActionDialog
          key={dialogRow.id + action + (prefill?.to ?? '')}
          row={dialogRow}
          action={action}
          prefill={action === 'escalate' ? prefill : null}
          onClose={closeAlert}
        />
      ) : null}
    </>
  )
}
