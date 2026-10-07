import {
  BadgePercentIcon,
  BanIcon,
  CheckIcon,
  HourglassIcon,
  PrinterIcon,
  ReceiptIndianRupeeIcon,
  ReceiptTextIcon,
  Undo2Icon,
  WalletIcon,
  XIcon,
} from 'lucide-react'
import { useState } from 'react'
import { useParams } from 'react-router'
import { useEnum, useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import { labApi, type InvoiceDetail } from '@/services/lab-api'
import { useLabMutation } from '@/services/mutations'
import { useInvoice } from '@/services/queries'
import { PageHeader } from '@/app/layout/page-header'
import { GuardedButton } from '@/components/lab/guarded-button'
import { PatientBanner } from '@/components/lab/patient-banner'
import { ReasonDialog } from '@/components/lab/reason-dialog'
import { RecordLink } from '@/components/lab/record-link'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { DataTable, type Column } from '@/components/ui/data-table'
import { IconButton } from '@/components/ui/icon-button'
import { usePrint, usePrintable } from '@/components/ui/print-context'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, ErrorState } from '@/components/ui/states'
import {
  CANCEL_INVOICE_REASONS,
  refundable,
  useMoney,
  type CancelInvoiceReason,
} from './billing'
import { InvoiceDocument } from './invoice-document'
import { DiscountDialog, PaymentDialog, RefundDialog } from './invoice-dialogs'
import { InvoiceStatusBadge } from './invoice-status'
import { RecordOnlyNotice } from './record-only-notice'

type Line = InvoiceDetail['lines'][number]
type Open = 'pay' | 'refund' | 'discount' | 'cancel' | 'decline' | null

function TotalsCard({ invoice }: { invoice: InvoiceDetail }) {
  const t = useT('billing')
  const money = useMoney()
  const x = invoice.totals
  const cancelled = invoice.status === 'cancelled'
  const row = (label: string, value: string, strong?: boolean) => (
    <div
      className={
        strong
          ? 'flex items-baseline justify-between gap-4 border-t border-line pt-2 text-base font-semibold text-fg'
          : 'flex items-baseline justify-between gap-4 text-sm text-fg-muted'
      }
    >
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  )
  return (
    <Card>
      <CardHeader title={t('totals')} titleAs="h2" />
      <CardBody>
        <dl className="grid gap-2">
          {row(t('gross'), money(x.gross))}
          {row(t('discount'), x.discount > 0 ? `-${money(x.discount)}` : '-')}
          {row(t('taxable'), money(x.taxable))}
          {row(t('gst'), money(x.tax))}
          {row(t('total'), money(x.total), true)}
          {row(t('paidToDate'), money(x.paid))}
          {x.refunded > 0 ? row(t('refunded'), money(x.refunded)) : null}
          {row(
            t('balance'),
            money(cancelled ? 0 : Math.max(0, x.balance)),
            true,
          )}
        </dl>
      </CardBody>
    </Card>
  )
}

function DiscountCard({
  invoice,
  onRequest,
  onDecline,
}: {
  invoice: InvoiceDetail
  onRequest: () => void
  onDecline: () => void
}) {
  const t = useT('billing')
  const f = useFormat()
  const money = useMoney()
  const d = invoice.discount
  const authorise = useLabMutation(
    () => labApi.billing.approveDiscount(invoice.id, true),
    {
      success: () => t('discountAuthorised', { amount: money(d?.amount ?? 0) }),
    },
  )
  const canRequest =
    !d && invoice.status !== 'cancelled' && invoice.payments.length === 0
  return (
    <Card>
      <CardHeader
        title={t('discount')}
        titleAs="h2"
        action={
          canRequest ? (
            <GuardedButton
              permission="billing.invoice"
              size="sm"
              onClick={onRequest}
            >
              <BadgePercentIcon />
              {t('requestDiscount')}
            </GuardedButton>
          ) : null
        }
      />
      <CardBody>
        {!d ? (
          <p className="text-sm text-fg-muted">
            {invoice.payments.length > 0 && invoice.status !== 'cancelled'
              ? t('discountLocked')
              : t('noDiscount')}
          </p>
        ) : (
          <div className="grid gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-lg font-semibold text-fg tabular-nums">
                {money(d.amount)}
              </span>
              {d.approvedBy ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-success-text">
                  <CheckIcon className="size-3.5" aria-hidden />
                  {t('discountStateApplied')}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-warning-text">
                  <HourglassIcon className="size-3.5" aria-hidden />
                  {t('discountAwaiting')}
                </span>
              )}
            </div>
            <p className="text-sm text-fg">{d.reason}</p>
            <p className="text-xs text-fg-muted">
              {t('discountRequestedBy', {
                name: d.requestedByName,
                time: f.dateTime(d.requestedAt),
              })}
            </p>
            {d.approvedByName && d.approvedAt ? (
              <p className="text-xs text-fg-muted">
                {t('discountAuthorisedBy', {
                  name: d.approvedByName,
                  time: f.dateTime(d.approvedAt),
                })}
              </p>
            ) : null}
            {!d.approvedBy ? (
              <>
                <p className="rounded-lg bg-warning-soft px-3 py-2 text-meta text-warning-text">
                  {t('discountPendingNote')}
                </p>
                <div className="flex flex-wrap gap-2">
                  <GuardedButton
                    permission="billing.discount.approve"
                    variant="primary"
                    size="sm"
                    loading={authorise.isPending}
                    onClick={() => authorise.mutate()}
                  >
                    <CheckIcon />
                    {t('authoriseDiscount')}
                  </GuardedButton>
                  <GuardedButton
                    permission="billing.discount.approve"
                    size="sm"
                    onClick={onDecline}
                  >
                    <XIcon />
                    {t('declineDiscount')}
                  </GuardedButton>
                </div>
              </>
            ) : null}
          </div>
        )}
      </CardBody>
    </Card>
  )
}

function InvoiceView({ invoice }: { invoice: InvoiceDetail }) {
  const t = useT('billing')
  const tc = useT('common')
  const e = useEnum()
  const f = useFormat()
  const money = useMoney()
  const { print } = usePrint()
  const [open, setOpen] = useState<Open>(null)
  const close = () => setOpen(null)

  usePrintable(<InvoiceDocument invoice={invoice} />)

  const decline = useLabMutation(
    () => labApi.billing.approveDiscount(invoice.id, false),
    { success: () => t('discountDeclined'), onSuccess: close },
  )
  const cancel = useLabMutation(
    (reason: string) => labApi.billing.cancel(invoice.id, reason),
    {
      success: () => t('invoiceCancelled', { invoice: invoice.invoiceNo }),
      onSuccess: close,
    },
  )

  const cancelled = invoice.status === 'cancelled'
  const discountPending = Boolean(
    invoice.discount && !invoice.discount.approvedBy,
  )
  const canPay = !cancelled && invoice.totals.balance > 0
  const maxRefund = refundable(invoice)
  const canCancel = !cancelled && invoice.payments.length === 0

  const columns: Column<Line>[] = [
    {
      id: 'description',
      header: t('colDescription'),
      cell: (l) => (
        <div className="min-w-0">
          <p className="text-meta font-medium text-fg">{l.description}</p>
          <p className="text-xs text-fg-muted">{t(`lineKind.${l.kind}`)}</p>
        </div>
      ),
    },
    {
      id: 'sac',
      header: t('colSac'),
      cell: (l) => (
        <span className="font-mono text-meta text-fg-muted">{l.sac}</span>
      ),
    },
    {
      id: 'qty',
      header: t('colQty'),
      align: 'right',
      mobileHidden: true,
      cell: (l) => (
        <span className="text-meta text-fg-muted tabular-nums">
          {f.number(l.quantity)}
        </span>
      ),
    },
    {
      id: 'rate',
      header: t('colRate'),
      align: 'right',
      cell: (l) => (
        <span className="text-meta whitespace-nowrap text-fg-muted tabular-nums">
          {money(l.unitPrice)}
        </span>
      ),
    },
    {
      id: 'gst',
      header: t('colGst'),
      align: 'right',
      cell: (l) => (
        <span className="text-meta text-fg-muted tabular-nums">
          {t('percent', { value: l.taxRate })}
        </span>
      ),
    },
    {
      id: 'amount',
      header: t('colAmount'),
      align: 'right',
      cell: (l) => (
        <span className="text-meta font-medium whitespace-nowrap text-fg tabular-nums">
          {money(l.amount)}
        </span>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title={<span className="font-mono">{invoice.invoiceNo}</span>}
        documentTitle={`${t('invoice')} ${invoice.invoiceNo}`}
        titleExtra={<InvoiceStatusBadge status={invoice.status} />}
        back={{ to: '/billing', label: t('backToBilling') }}
        meta={
          <span>
            {t('issuedBy', {
              name: invoice.issuedByName,
              time: f.dateTime(invoice.issuedAt),
            })}
          </span>
        }
        actions={
          <>
            {canCancel ? (
              <GuardedButton
                permission="billing.invoice"
                variant="ghost"
                className="text-danger-text hover:bg-danger-soft hover:text-danger-text"
                onClick={() => setOpen('cancel')}
              >
                <BanIcon />
                {t('cancelInvoice')}
              </GuardedButton>
            ) : null}
            <Button
              onClick={() => print(<InvoiceDocument invoice={invoice} />)}
            >
              <PrinterIcon />
              {t('printInvoice')}
            </Button>
            {canPay ? (
              <GuardedButton
                permission="billing.payment"
                variant="primary"
                disabled={discountPending}
                title={discountPending ? t('payBlockedByDiscount') : undefined}
                onClick={() => setOpen('pay')}
              >
                <WalletIcon />
                {t('recordPayment')}
              </GuardedButton>
            ) : null}
          </>
        }
      />

      <RecordOnlyNotice className="mb-4" />

      {invoice.cancelled ? (
        <p
          role="status"
          className="mb-4 flex items-start gap-2 rounded-lg border border-line-strong bg-surface-2 px-3.5 py-3 text-meta text-fg"
        >
          <BanIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            {t('cancelledBy', {
              name: invoice.cancelled.byName,
              time: f.dateTime(invoice.cancelled.at),
              reason: invoice.cancelled.reason,
            })}
          </span>
        </p>
      ) : null}
      {canPay && discountPending ? (
        <p
          role="status"
          className="mb-4 flex items-start gap-2 rounded-lg bg-warning-soft px-3.5 py-3 text-meta text-warning-text"
        >
          <HourglassIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t('payBlockedByDiscount')}
        </p>
      ) : null}

      <PatientBanner
        patient={invoice.patient}
        extra={
          <span className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            {invoice.orderId && invoice.orderNo ? (
              <span className="flex items-baseline gap-1.5">
                <span className="text-fg-muted">{tc('orderNo')}</span>
                <RecordLink kind="order" id={invoice.orderId}>
                  {invoice.orderNo}
                </RecordLink>
              </span>
            ) : null}
            <span className="flex items-baseline gap-1.5">
              <span className="text-fg-muted">{t('billTo')}</span>
              <span className="font-medium text-fg">
                {invoice.accountName ?? t('selfPay')}
              </span>
            </span>
          </span>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid min-w-0 content-start gap-5">
          <Card className="overflow-hidden">
            <CardHeader
              title={t('lines')}
              description={
                invoice.sellerGstin
                  ? `${t('gstin')} ${invoice.sellerGstin}${invoice.buyerGstin ? ` · ${t('buyerGstin')} ${invoice.buyerGstin}` : ''}`
                  : undefined
              }
            />
            <DataTable
              caption={t('lines')}
              columns={columns}
              rows={invoice.lines}
              getRowId={(l) => l.id}
              pageSize={100}
              mobile={{
                primary: 'description',
                fields: ['amount', 'gst', 'sac'],
              }}
              empty={
                <EmptyState
                  compact
                  icon={<ReceiptTextIcon />}
                  title={t('noLines')}
                />
              }
            />
          </Card>

          <Card>
            <CardHeader title={t('payments')} description={t('paymentsHint')} />
            <CardBody>
              {invoice.payments.length === 0 ? (
                <p className="text-sm text-fg-muted">{t('noPayments')}</p>
              ) : (
                <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
                  {invoice.payments.map((p) => (
                    <li
                      key={p.id}
                      className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-fg">
                          {e('paymentMethod', p.method)}
                          {p.reference ? (
                            <span className="ml-2 font-mono text-xs font-normal text-fg-muted">
                              {p.reference}
                            </span>
                          ) : null}
                        </p>
                        <p className="text-xs text-fg-muted">
                          {t('recordedBy', {
                            name: p.byName,
                            time: f.dateTime(p.at),
                          })}
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-fg tabular-nums">
                        {money(p.amount)}
                      </span>
                      <IconButton
                        label={t('printReceipt')}
                        icon={<PrinterIcon />}
                        onClick={() =>
                          print(
                            <InvoiceDocument
                              invoice={invoice}
                              paymentId={p.id}
                            />,
                          )
                        }
                      />
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title={t('refunds')}
              action={
                maxRefund > 0 ? (
                  <GuardedButton
                    permission="billing.refund"
                    size="sm"
                    onClick={() => setOpen('refund')}
                  >
                    <Undo2Icon />
                    {t('recordRefund')}
                  </GuardedButton>
                ) : null
              }
            />
            <CardBody>
              {invoice.refunds.length === 0 ? (
                <p className="text-sm text-fg-muted">{t('noRefunds')}</p>
              ) : (
                <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
                  {invoice.refunds.map((r) => (
                    <li
                      key={r.id}
                      className="flex flex-wrap items-start gap-x-4 gap-y-1 px-4 py-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-fg">
                          {e('paymentMethod', r.method)}
                        </p>
                        <p className="text-meta text-fg">{r.reason}</p>
                        <p className="text-xs text-fg-muted">
                          {t('recordedBy', {
                            name: r.byName,
                            time: f.dateTime(r.at),
                          })}
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-fg tabular-nums">
                        -{money(r.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="grid min-w-0 content-start gap-5">
          <TotalsCard invoice={invoice} />
          <DiscountCard
            invoice={invoice}
            onRequest={() => setOpen('discount')}
            onDecline={() => setOpen('decline')}
          />
        </div>
      </div>

      {open === 'pay' ? (
        <PaymentDialog invoice={invoice} onClose={close} />
      ) : null}
      {open === 'refund' ? (
        <RefundDialog invoice={invoice} onClose={close} />
      ) : null}
      {open === 'discount' ? (
        <DiscountDialog invoice={invoice} onClose={close} />
      ) : null}
      <ConfirmDialog
        open={open === 'decline'}
        onOpenChange={(o) => !o && close()}
        title={t('declineTitle')}
        description={t('declineBody', {
          amount: money(invoice.discount?.amount ?? 0),
        })}
        confirmLabel={t('declineDiscount')}
        tone="danger"
        loading={decline.isPending}
        onConfirm={() => decline.mutate()}
      />
      <ReasonDialog<CancelInvoiceReason>
        open={open === 'cancel'}
        onOpenChange={(o) => !o && close()}
        title={t('cancelTitle', { invoice: invoice.invoiceNo })}
        description={t('cancelBody')}
        reasonLabel={t('reason')}
        reasons={CANCEL_INVOICE_REASONS.map((r) => ({
          value: r,
          label: t(`cancelReason.${r}`),
        }))}
        confirmLabel={t('cancelInvoice')}
        loading={cancel.isPending}
        onConfirm={({ reason, remarks }) => {
          const label = t(`cancelReason.${reason}`)
          cancel.mutate(remarks ? `${label}: ${remarks}` : label)
        }}
      />
    </>
  )
}

export function Component() {
  const t = useT('billing')
  const { invoiceId } = useParams()
  const { data, isPending, isError, error, refetch } = useInvoice(invoiceId)

  if (isPending)
    return (
      <div className="grid gap-5" role="status" aria-busy>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-12 rounded-lg" />
        <Skeleton className="h-16 rounded-xl" />
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    )
  if (isError || !data)
    return (
      <>
        <PageHeader
          title={t('invoice')}
          back={{ to: '/billing', label: t('backToBilling') }}
        />
        <Card>
          {(error as { code?: string } | null)?.code === 'not-found' ? (
            <EmptyState
              icon={<ReceiptIndianRupeeIcon />}
              tone="green"
              title={t('notFound')}
              description={t('notFoundBody')}
            />
          ) : (
            <ErrorState onRetry={() => void refetch()} />
          )}
        </Card>
      </>
    )
  return <InvoiceView invoice={data} />
}
