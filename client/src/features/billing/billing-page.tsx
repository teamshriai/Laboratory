import {
  BookOpenIcon,
  HourglassIcon,
  PackageIcon,
  ReceiptIndianRupeeIcon,
} from 'lucide-react'
import { useDeferredValue, useMemo } from 'react'
import { Link, useNavigate } from 'react-router'
import { useUrlFilters } from '@/hooks/use-search-param'
import { useTablePaging } from '@/hooks/use-table-paging'
import { useNow } from '@/hooks/use-now'
import { useEnum, useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import {
  labApi,
  type InvoiceFilters,
  type InvoiceRow,
} from '@/services/lab-api'
import { useBillingMasters, useDayBook, useInvoices } from '@/services/queries'
import { PageHeader } from '@/app/layout/page-header'
import { ExportButton } from '@/components/lab/export-button'
import { FilterBar } from '@/components/lab/filter-bar'
import { PatientCell } from '@/components/lab/patient'
import { RecordLink } from '@/components/lab/record-link'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Combobox } from '@/components/ui/combobox'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Field } from '@/components/ui/field'
import { SearchInput } from '@/components/ui/input'
import { MetricStrip } from '@/components/ui/metric-strip'
import { Select } from '@/components/ui/select'
import { EmptyState } from '@/components/ui/states'
import { FilterTabs } from '@/components/ui/toggles'
import { BILLING_DATES, STATUS_TABS, useMoney } from './billing'
import { InvoiceStatusBadge } from './invoice-status'
import { RecordOnlyNotice } from './record-only-notice'

const DEFAULTS = {
  status: 'all',
  date: 'today',
  accountId: '',
  q: '',
}

export function Component() {
  const t = useT('billing')
  const tc = useT('common')
  const e = useEnum()
  const f = useFormat()
  const money = useMoney()
  const now = useNow()
  const navigate = useNavigate()
  const url = useUrlFilters(DEFAULTS, {
    status: ['all', ...STATUS_TABS],
    date: BILLING_DATES,
  })
  const filters = url.values as {
    status: InvoiceFilters['status'] & string
    date: (typeof BILLING_DATES)[number]
    accountId: string
    q: string
  }
  const q = useDeferredValue(filters.q)
  const paging = useTablePaging(25, ['invoice', 'patient', 'total', 'balance'])
  const listFilters: InvoiceFilters = {
    status: filters.status,
    date: filters.date,
    q,
    ...(filters.accountId ? { accountId: filters.accountId } : {}),
  }
  const { data, isPending, isError, refetch } = useInvoices({
    ...listFilters,
    ...paging.query,
  })
  const { data: masters } = useBillingMasters()
  const { data: dayBook } = useDayBook()

  const accountName = (id: string) =>
    masters?.accounts.find((a) => a.id === id)?.name ?? id

  const columns = useMemo<Column<InvoiceRow>[]>(
    () => [
      {
        id: 'invoice',
        header: t('colInvoice'),
        sortable: true,
        cell: (r) => (
          <div className="min-w-0">
            <Link
              to={`/billing/${r.id}`}
              onClick={(ev) => ev.stopPropagation()}
              className="inline-flex min-h-6 items-center py-0.5 font-mono text-meta font-semibold whitespace-nowrap text-fg hover:text-accent-text hover:underline"
            >
              {r.invoiceNo}
            </Link>
            <p
              className="text-xs whitespace-nowrap text-fg-muted"
              title={f.relative(r.issuedAt, now)}
            >
              {filters.date === 'today'
                ? f.time(r.issuedAt)
                : f.dateTime(r.issuedAt)}
            </p>
          </div>
        ),
      },
      {
        id: 'patient',
        header: tc('patient'),
        sortable: true,
        cell: (r) => <PatientCell patient={r.patient} showLocal={false} />,
      },
      {
        id: 'order',
        header: tc('orderNo'),
        cell: (r) =>
          r.orderId && r.orderNo ? (
            <RecordLink kind="order" id={r.orderId} className="text-meta">
              {r.orderNo}
            </RecordLink>
          ) : (
            <span className="text-meta text-fg-subtle">{t('noOrder')}</span>
          ),
      },
      {
        id: 'account',
        header: t('colAccount'),
        tabletHidden: true,
        cell: (r) => (
          <span className="block max-w-48 truncate text-meta text-fg-muted">
            {r.accountName ?? t('selfPay')}
          </span>
        ),
      },
      {
        id: 'total',
        header: t('colTotal'),
        sortable: true,
        align: 'right',
        cell: (r) => (
          <span className="text-meta font-medium whitespace-nowrap text-fg tabular-nums">
            {money(r.total)}
          </span>
        ),
      },
      {
        id: 'paid',
        header: t('colPaid'),
        align: 'right',
        tabletHidden: true,
        cell: (r) => (
          <span className="text-meta whitespace-nowrap text-fg-muted tabular-nums">
            {money(r.paid)}
          </span>
        ),
      },
      {
        id: 'balance',
        header: t('colBalance'),
        sortable: true,
        align: 'right',
        cell: (r) => (
          <span
            className={
              r.balance > 0 && r.status !== 'cancelled'
                ? 'text-meta font-semibold whitespace-nowrap text-fg tabular-nums'
                : 'text-meta whitespace-nowrap text-fg-subtle tabular-nums'
            }
          >
            {money(r.status === 'cancelled' ? 0 : r.balance)}
          </span>
        ),
      },
      {
        id: 'status',
        header: tc('status'),
        cell: (r) => (
          <div className="flex flex-col items-start gap-1">
            <InvoiceStatusBadge status={r.status} size="sm" />
            {r.discountPending ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap text-warning-text">
                <HourglassIcon className="size-3" aria-hidden />
                {t('discountAwaiting')}
              </span>
            ) : null}
          </div>
        ),
      },
    ],
    [t, tc, f, now, money, filters.date],
  )

  const counts = data?.counts
  const tabs = [
    { value: 'all', label: t('tabAll'), count: counts?.all },
    ...STATUS_TABS.map((s) => ({
      value: s,
      label: e('invoiceStatus', s),
      count: counts?.[s],
    })),
  ]
  const takings = dayBook
    ? dayBook.expected.cash + dayBook.expected.card + dayBook.expected.upi
    : undefined
  const awaiting = counts ? counts.unpaid + counts['partially-paid'] : undefined
  const dirty = url.activeCount(['date', 'accountId', 'q']) > 0
  const clear = () => url.set({ date: 'today', accountId: '', q: '' })

  return (
    <>
      <PageHeader
        title={t('title')}
        meta={<span>{t('pageMeta')}</span>}
        actions={
          <>
            <ExportButton
              filename={t('exportFile')}
              entity="invoice"
              disabled={!data?.rows.length}
              rows={async () => [
                [
                  t('colInvoice'),
                  t('colIssued'),
                  tc('patient'),
                  tc('uhid'),
                  tc('orderNo'),
                  t('colAccount'),
                  t('colTotal'),
                  t('colPaid'),
                  t('colBalance'),
                  tc('status'),
                ],
                ...(await labApi.billing.list(listFilters)).rows.map((r) => [
                  r.invoiceNo,
                  f.dateTime(r.issuedAt),
                  r.patient.name,
                  r.patient.uhid,
                  r.orderNo ?? '',
                  r.accountName ?? t('selfPay'),
                  r.total,
                  r.paid,
                  r.balance,
                  e('invoiceStatus', r.status),
                ]),
              ]}
            />
            <Link
              to="/billing/masters"
              className={buttonVariants({ variant: 'secondary' })}
            >
              <PackageIcon />
              {t('mastersLink')}
            </Link>
            <Link
              to="/billing/day-book"
              className={buttonVariants({ variant: 'primary' })}
            >
              <BookOpenIcon />
              {t('dayBookLink')}
            </Link>
          </>
        }
      />
      <RecordOnlyNotice className="mb-4" />
      <MetricStrip
        className="mb-5"
        items={[
          {
            key: 'invoices',
            label: t('kpiInvoices'),
            value: counts ? f.number(counts.all) : '-',
            detail: data?.totals.discountsPending
              ? t('kpiDiscountsPending', {
                  count: data.totals.discountsPending,
                })
              : e('datePreset', filters.date),
            alert: Boolean(data?.totals.discountsPending),
          },
          {
            key: 'awaiting',
            label: t('kpiAwaiting'),
            value: awaiting !== undefined ? f.number(awaiting) : '-',
            detail: data
              ? t('kpiOutstanding', { amount: money(data.totals.outstanding) })
              : t('kpiAwaitingDetail'),
            alert: Boolean(awaiting),
          },
          {
            key: 'account',
            label: e('invoiceStatus', 'on-account'),
            value: counts ? f.number(counts['on-account']) : '-',
            detail: t('kpiOnAccountDetail'),
          },
          {
            key: 'takings',
            label: t('kpiTakings'),
            value: takings !== undefined ? money(takings) : '-',
            detail: dayBook?.close ? t('dayClosed') : t('kpiTakingsDetail'),
            href: '/billing/day-book',
          },
        ]}
      />
      <Card className="overflow-hidden">
        <div className="border-b border-line px-3 pt-1">
          <FilterTabs
            value={filters.status}
            onValueChange={(v) => url.set({ status: v })}
            items={tabs}
            aria-label={tc('status')}
          />
        </div>
        <FilterBar
          canClear={dirty}
          onClear={clear}
          moreCount={filters.accountId ? 1 : 0}
          more={
            <Field label={t('filterAccount')}>
              <Combobox
                value={filters.accountId || undefined}
                onValueChange={(v) =>
                  url.set({ accountId: v === filters.accountId ? '' : v })
                }
                placeholder={t('anyAccount')}
                searchPlaceholder={t('searchAccounts')}
                emptyText={t('noAccounts')}
                options={(masters?.accounts ?? []).map((a) => ({
                  value: a.id,
                  label: a.name,
                  description: e('accountKind', a.kind),
                }))}
              />
            </Field>
          }
          chips={
            filters.accountId
              ? [
                  {
                    key: 'account',
                    label: `${t('filterAccount')}: ${accountName(filters.accountId)}`,
                    onRemove: () => url.set({ accountId: '' }),
                  },
                ]
              : []
          }
        >
          <SearchInput
            value={filters.q}
            onValueChange={(v) => url.set({ q: v })}
            placeholder={t('searchPlaceholder')}
            aria-label={tc('search')}
            className="w-full sm:w-96"
          />
          <Select
            size="sm"
            aria-label={t('filterDate')}
            value={filters.date}
            onValueChange={(v) => url.set({ date: v })}
            options={BILLING_DATES.map((d) => ({
              value: d,
              label: e('datePreset', d),
            }))}
            className="w-40"
          />
        </FilterBar>
        <div className="border-t border-line">
          <DataTable
            caption={t('title')}
            columns={columns}
            rows={data?.rows}
            server={paging.table(data?.page)}
            getRowId={(r) => r.id}
            rowLabel={(r) => r.invoiceNo}
            onRowClick={(r) => void navigate(`/billing/${r.id}`)}
            rowClassName={(r) => (r.discountPending ? 'row-alert' : undefined)}
            isLoading={isPending}
            isError={isError}
            onRetry={() => void refetch()}
            mobile={{
              primary: 'patient',
              fields: ['invoice', 'balance', 'status'],
            }}
            empty={
              <EmptyState
                icon={<ReceiptIndianRupeeIcon />}
                tone="green"
                title={t('emptyTitle')}
                description={t('emptyBody')}
                action={
                  dirty ? (
                    <button
                      type="button"
                      className={buttonVariants({ variant: 'secondary' })}
                      onClick={clear}
                    >
                      {tc('clearFilters')}
                    </button>
                  ) : (
                    <Link
                      to="/orders"
                      className={buttonVariants({ variant: 'secondary' })}
                    >
                      {t('goToOrders')}
                    </Link>
                  )
                }
              />
            }
          />
        </div>
      </Card>
    </>
  )
}
