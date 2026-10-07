import {
  BookOpenIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  LockIcon,
  TriangleAlertIcon,
  Undo2Icon,
  WalletIcon,
} from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { DAY, istDay } from '@/domain/time'
import { useNow } from '@/hooks/use-now'
import { useSearchParam } from '@/hooks/use-search-param'
import { useEnum, useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import { cn } from '@/lib/cn'
import { fromDateInput } from '@/lib/date-input'
import { labApi, type DayBook } from '@/services/lab-api'
import { useLabMutation } from '@/services/mutations'
import { useDayBook } from '@/services/queries'
import { PageHeader } from '@/app/layout/page-header'
import { GuardedButton } from '@/components/lab/guarded-button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Field } from '@/components/ui/field'
import { IconButton } from '@/components/ui/icon-button'
import { Input, Textarea } from '@/components/ui/input'
import { MetricStrip } from '@/components/ui/metric-strip'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { paise, parseAmount, TILL_METHODS, useMoney } from './billing'
import { RecordOnlyNotice } from './record-only-notice'

type Entry = DayBook['entries'][number]

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/** A real calendar day (2026-00-10 or 2026-02-30 is not), not after today. */
const isBookDay = (value: string, today: string) => {
  if (!DAY_PATTERN.test(value) || value > today) return false
  const ms = fromDateInput(value)
  return Number.isFinite(ms) && istDay(ms) === value
}

function Difference({ value }: { value: number }) {
  const t = useT('billing')
  const money = useMoney()
  if (value === 0)
    return <span className="text-fg-muted tabular-nums">{money(0)}</span>
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-semibold tabular-nums',
        value < 0 ? 'text-danger-text' : 'text-warning-text',
      )}
    >
      <TriangleAlertIcon className="size-3.5" aria-hidden />
      {value > 0 ? `+${money(value)}` : money(value)}
      <span className="sr-only">{value < 0 ? t('short') : t('over')}</span>
    </span>
  )
}

/** The count against what the payments say, and the close. */
function CashCount({ book }: { book: DayBook }) {
  const t = useT('billing')
  const tc = useT('common')
  const e = useEnum()
  const money = useMoney()
  // Nothing is pre-filled: every method is counted, not copied.
  const [counted, setCounted] = useState<Record<string, string>>({
    cash: '',
    card: '',
    upi: '',
  })
  const [note, setNote] = useState('')
  const [tried, setTried] = useState(false)
  const close = useLabMutation(
    (input: {
      counted: Record<'cash' | 'card' | 'upi', number>
      note?: string
    }) => labApi.billing.closeDay(input),
    { success: () => t('dayClosedToast') },
  )

  const values = Object.fromEntries(
    TILL_METHODS.map((m) => [m, parseAmount(counted[m] ?? '')]),
  ) as Record<(typeof TILL_METHODS)[number], number | null>
  const errors = Object.fromEntries(
    TILL_METHODS.map((m) => {
      const v = values[m]
      return [
        m,
        !tried
          ? undefined
          : v === null
            ? 'forms.required'
            : v < 0
              ? 'forms.invalid'
              : undefined,
      ]
    }),
  ) as Record<(typeof TILL_METHODS)[number], string | undefined>
  const expectedTotal = paise(
    TILL_METHODS.reduce((n, m) => n + book.expected[m], 0),
  )
  const countedTotal = paise(
    TILL_METHODS.reduce((n, m) => n + (values[m] ?? 0), 0),
  )
  const complete = TILL_METHODS.every((m) => values[m] !== null)
  const difference = paise(countedTotal - expectedTotal)
  const noteNeeded = complete && difference !== 0
  const noteError =
    tried && noteNeeded && !note.trim() ? t('noteRequired') : undefined

  const submit = () => {
    setTried(true)
    if (
      !complete ||
      TILL_METHODS.some((m) => (values[m] ?? 0) < 0) ||
      (noteNeeded && !note.trim())
    )
      return
    close.mutate({
      counted: {
        cash: values.cash ?? 0,
        card: values.card ?? 0,
        upi: values.upi ?? 0,
      },
      ...(note.trim() ? { note: note.trim() } : {}),
    })
  }

  return (
    <Card>
      <CardHeader
        title={t('countTitle')}
        description={t('countHint')}
        icon={<WalletIcon />}
        tone="green"
      />
      <CardBody className="grid gap-4">
        <div className="grid gap-3">
          <div className="hidden grid-cols-[minmax(0,1fr)_9rem_11rem_9rem] gap-3 px-1 text-xs font-medium text-fg-subtle sm:grid">
            <span>{t('method')}</span>
            <span className="text-right">{t('expected')}</span>
            <span>{t('counted')}</span>
            <span className="text-right">{t('difference')}</span>
          </div>
          {TILL_METHODS.map((m) => {
            const v = values[m]
            return (
              <div
                key={m}
                className="grid grid-cols-2 items-center gap-x-3 gap-y-2 rounded-xl border border-line p-3 sm:grid-cols-[minmax(0,1fr)_9rem_11rem_9rem] sm:border-0 sm:p-1"
              >
                <span className="text-sm font-medium text-fg max-sm:col-span-2">
                  {e('paymentMethod', m)}
                </span>
                <span className="min-w-0 text-right text-sm break-words text-fg-muted tabular-nums max-sm:col-span-2 max-sm:text-left">
                  <span className="mr-1 text-xs sm:sr-only">
                    {t('expected')}
                  </span>
                  {money(book.expected[m])}
                </span>
                <Field
                  label={
                    <span className="sm:sr-only">
                      {t('countedFor', { method: e('paymentMethod', m) })}
                    </span>
                  }
                  error={errors[m]}
                  className="col-span-2 sm:col-span-1"
                >
                  <Input
                    value={counted[m] ?? ''}
                    onChange={(ev) =>
                      setCounted((prev) => ({ ...prev, [m]: ev.target.value }))
                    }
                    inputMode="decimal"
                    autoComplete="off"
                    className="tabular-nums"
                  />
                </Field>
                <span className="col-span-2 text-right text-sm sm:col-span-1">
                  <span className="mr-1 text-xs text-fg-muted sm:sr-only">
                    {t('difference')}
                  </span>
                  {v === null ? (
                    <span className="text-fg-subtle">-</span>
                  ) : (
                    <Difference value={paise(v - book.expected[m])} />
                  )}
                </span>
              </div>
            )
          })}
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-line px-1 pt-3 text-sm">
            <span className="font-semibold text-fg">{t('total')}</span>
            <span className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <span className="text-fg-muted tabular-nums">
                {t('expected')} {money(expectedTotal)}
              </span>
              <span className="text-fg tabular-nums">
                {t('counted')} {money(countedTotal)}
              </span>
              {complete ? <Difference value={difference} /> : null}
            </span>
          </div>
        </div>
        <Field
          label={t('closeNote')}
          required={noteNeeded}
          optionalLabel={noteNeeded ? undefined : tc('optional')}
          hint={t('closeNoteHint')}
          error={noteError}
        >
          <Textarea
            value={note}
            onChange={(ev) => setNote(ev.target.value)}
            rows={2}
            maxLength={300}
          />
        </Field>
        <p className="text-meta text-fg-muted">{t('closeWarning')}</p>
        <div className="flex justify-end">
          <GuardedButton
            permission="billing.close"
            variant="primary"
            loading={close.isPending}
            onClick={submit}
          >
            <LockIcon />
            {t('closeDay')}
          </GuardedButton>
        </div>
      </CardBody>
    </Card>
  )
}

function CloseRecord({ close }: { close: NonNullable<DayBook['close']> }) {
  const t = useT('billing')
  const e = useEnum()
  const f = useFormat()
  const money = useMoney()
  const sum = (r: Record<'cash' | 'card' | 'upi', number>) =>
    paise(r.cash + r.card + r.upi)
  return (
    <Card>
      <CardHeader
        title={t('closedTitle')}
        description={t('closedBy', {
          name: close.byName,
          time: f.dateTime(close.at),
        })}
        icon={<LockIcon />}
        tone="green"
      />
      <CardBody className="grid gap-3">
        <dl className="grid gap-2">
          {TILL_METHODS.map((m) => (
            <div
              key={m}
              className="grid grid-cols-2 gap-x-3 gap-y-0.5 rounded-lg bg-surface-2/60 px-3 py-2 text-sm sm:grid-cols-4"
            >
              <dt className="font-medium text-fg">{e('paymentMethod', m)}</dt>
              <dd className="text-right text-fg-muted tabular-nums sm:text-left">
                {t('expected')} {money(close.expected[m])}
              </dd>
              <dd className="text-fg tabular-nums">
                {t('counted')} {money(close.counted[m])}
              </dd>
              <dd className="text-right">
                <Difference
                  value={paise(close.counted[m] - close.expected[m])}
                />
              </dd>
            </div>
          ))}
        </dl>
        <p className="flex flex-wrap items-baseline justify-between gap-2 border-t border-line pt-3 text-sm">
          <span className="font-semibold text-fg">{t('difference')}</span>
          <Difference value={paise(sum(close.counted) - sum(close.expected))} />
        </p>
        {close.note ? (
          <p className="rounded-lg bg-surface-2 px-3 py-2 text-meta text-fg">
            <span className="font-medium">{t('closeNote')}:</span> {close.note}
          </p>
        ) : null}
      </CardBody>
    </Card>
  )
}

export function Component() {
  const t = useT('billing')
  const e = useEnum()
  const f = useFormat()
  const money = useMoney()
  const now = useNow()
  const today = istDay(now)
  const [raw, setDay] = useSearchParam<string>('day', '')
  const day = isBookDay(raw, today) ? raw : today
  const isToday = day === today
  const { data, isPending, isError, refetch } = useDayBook(
    isToday ? undefined : day,
  )
  const shift = (days: number) => {
    const next = istDay(fromDateInput(day) + days * DAY)
    if (!isBookDay(next, today) || next === today) setDay(null)
    else setDay(next)
  }

  const columns: Column<Entry>[] = [
    {
      id: 'time',
      header: t('colTime'),
      cell: (r) => (
        <span className="text-meta whitespace-nowrap text-fg-muted">
          {f.time(r.at)}
        </span>
      ),
    },
    {
      id: 'invoice',
      header: t('colInvoice'),
      cell: (r) => (
        <div className="min-w-0">
          <Link
            to={`/billing/${r.invoiceId}`}
            className="inline-flex min-h-6 items-center py-0.5 font-mono text-meta font-semibold text-fg hover:text-accent-text hover:underline"
          >
            {r.invoiceNo}
          </Link>
          <p className="truncate text-xs text-fg-muted">{r.patientName}</p>
        </div>
      ),
    },
    {
      id: 'kind',
      header: t('colEntry'),
      cell: (r) =>
        r.kind === 'refund' ? (
          <span className="inline-flex items-center gap-1 text-meta font-medium text-warning-text">
            <Undo2Icon className="size-3.5" aria-hidden />
            {t('entryRefund')}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-meta text-fg">
            <WalletIcon className="size-3.5" aria-hidden />
            {t('entryPayment')}
          </span>
        ),
    },
    {
      id: 'method',
      header: t('method'),
      cell: (r) => (
        <span className="text-meta text-fg-muted">
          {e('paymentMethod', r.method)}
        </span>
      ),
    },
    {
      id: 'amount',
      header: t('amount'),
      align: 'right',
      cell: (r) => (
        <span className="text-meta font-medium whitespace-nowrap text-fg tabular-nums">
          {r.kind === 'refund' ? `-${money(r.amount)}` : money(r.amount)}
        </span>
      ),
    },
    {
      id: 'by',
      header: t('colBy'),
      tabletHidden: true,
      cell: (r) => <span className="text-meta text-fg-muted">{r.byName}</span>,
    },
  ]

  const payments = data?.entries.filter((x) => x.kind === 'payment') ?? []
  const refunds = data?.entries.filter((x) => x.kind === 'refund') ?? []
  const credit = paise(
    payments
      .filter((p) => p.method === 'credit')
      .reduce((n, p) => n + p.amount, 0),
  )
  const expectedTotal = data
    ? paise(data.expected.cash + data.expected.card + data.expected.upi)
    : undefined

  return (
    <>
      <PageHeader
        title={t('dayBookTitle')}
        back={{ to: '/billing', label: t('backToBilling') }}
        meta={<span>{f.weekday(fromDateInput(day))}</span>}
        actions={
          <div className="flex items-center gap-1">
            <IconButton
              label={t('previousDay')}
              icon={<ChevronLeftIcon />}
              size="icon"
              onClick={() => shift(-1)}
            />
            <Input
              type="date"
              aria-label={t('chooseDay')}
              value={day}
              max={today}
              onChange={(ev) => {
                const v = ev.target.value
                if (isBookDay(v, today)) setDay(v === today ? null : v)
              }}
              className="w-44"
            />
            <IconButton
              label={t('nextDay')}
              icon={<ChevronRightIcon />}
              size="icon"
              disabled={isToday}
              onClick={() => shift(1)}
            />
          </div>
        }
      />
      <RecordOnlyNotice className="mb-4" />
      {isPending ? (
        <div className="grid gap-5" role="status" aria-busy>
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : isError || !data ? (
        <Card>
          <ErrorState onRetry={() => void refetch()} />
        </Card>
      ) : (
        <div className="grid gap-5">
          <MetricStrip
            items={[
              {
                key: 'expected',
                label: t('kpiExpected'),
                value: money(expectedTotal ?? 0),
                detail: t('kpiExpectedDetail'),
              },
              {
                key: 'payments',
                label: t('kpiPayments'),
                value: f.number(payments.length),
              },
              {
                key: 'refunds',
                label: t('kpiRefunds'),
                value: money(paise(refunds.reduce((n, r) => n + r.amount, 0))),
                detail: t('refundCount', { count: refunds.length }),
              },
              {
                key: 'credit',
                label: t('kpiCredit'),
                value: money(credit),
                detail: t('kpiCreditDetail'),
              },
            ]}
          />
          {data.close ? (
            <CloseRecord close={data.close} />
          ) : isToday ? (
            <CashCount key={day} book={data} />
          ) : (
            <p
              role="status"
              className="flex items-start gap-2 rounded-lg bg-warning-soft px-3.5 py-3 text-meta text-warning-text"
            >
              <TriangleAlertIcon
                className="mt-0.5 size-4 shrink-0"
                aria-hidden
              />
              {t('notClosedPast')}
            </p>
          )}
          <Card className="overflow-hidden">
            <CardHeader
              title={t('entriesTitle')}
              description={t('entriesHint')}
            />
            <DataTable
              caption={t('entriesTitle')}
              columns={columns}
              rows={data.entries}
              getRowId={(r) => `${r.invoiceId}-${r.kind}-${r.at}-${r.amount}`}
              pageSize={50}
              mobile={{
                primary: 'invoice',
                fields: ['kind', 'method', 'amount'],
              }}
              empty={
                <EmptyState
                  compact
                  icon={<BookOpenIcon />}
                  tone="green"
                  title={t('entriesEmpty')}
                  description={t('entriesEmptyBody')}
                />
              }
            />
          </Card>
        </div>
      )}
    </>
  )
}
