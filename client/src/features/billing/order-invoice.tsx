import {
  ChevronRightIcon,
  HourglassIcon,
  ReceiptIndianRupeeIcon,
} from 'lucide-react'
import { useId, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useEnum, useT } from '@/i18n/context'
import { labApi, type InvoiceInput, type OrderDetail } from '@/services/lab-api'
import { useLabMutation } from '@/services/mutations'
import { useBillingMasters, useOrderInvoice } from '@/services/queries'
import { GuardedButton } from '@/components/lab/guarded-button'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Select } from '@/components/ui/select'
import { SkeletonText } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/states'
import { Checkbox } from '@/components/ui/toggles'
import { paise, useMoney } from './billing'
import { InvoiceStatusBadge } from './invoice-status'

/** Invoices the order, with optional packages and a credit account. */
function CreateInvoiceDialog({
  order,
  onClose,
}: {
  order: OrderDetail
  onClose: () => void
}) {
  const t = useT('billing')
  const tc = useT('common')
  const e = useEnum()
  const money = useMoney()
  const navigate = useNavigate()
  const ids = useId()
  const { data: masters, isPending, isError, refetch } = useBillingMasters()
  const [packageIds, setPackageIds] = useState<string[]>([])
  const [accountId, setAccountId] = useState('none')

  const live = order.items.filter((i) => i.active && i.status !== 'void')
  const liveTests = new Set(live.map((i) => i.testId))
  const packages = (masters?.packages ?? []).filter(
    (p) => p.active && p.testIds.every((x) => liveTests.has(x)),
  )
  const accounts = (masters?.accounts ?? []).filter((a) => a.active)
  const chosen = packages.filter((p) => packageIds.includes(p.id))
  const covered = new Set(chosen.flatMap((p) => p.testIds))
  const account = accounts.find((a) => a.id === accountId)
  const prices = account?.priceListId
    ? masters?.priceLists.find((l) => l.id === account.priceListId && l.active)
    : undefined
  const estimate = paise(
    chosen.reduce((n, p) => n + p.price, 0) +
      live
        .filter((i) => !covered.has(i.testId))
        .reduce((n, i) => n + (prices?.prices[i.testId] ?? i.price), 0),
  )

  const create = useLabMutation(
    (input: InvoiceInput) => labApi.billing.create(input),
    {
      success: () => t('invoiceCreated', { order: order.orderNo ?? '' }),
      onSuccess: (id) => {
        onClose()
        void navigate(`/billing/${id}`)
      },
    },
  )
  const toggle = (id: string) =>
    setPackageIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      size="lg"
      title={t('createTitle', { order: order.orderNo ?? '' })}
      description={t('createDescription')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {tc('cancel')}
          </Button>
          <Button
            variant="primary"
            loading={create.isPending}
            disabled={isPending || isError || live.length === 0}
            onClick={() =>
              create.mutate({
                orderId: order.id,
                ...(packageIds.length ? { packageIds } : {}),
                ...(account ? { accountId: account.id } : {}),
              })
            }
          >
            {t('createInvoice')}
          </Button>
        </>
      }
    >
      {isPending ? (
        <SkeletonText lines={5} />
      ) : isError ? (
        <ErrorState compact onRetry={() => void refetch()} />
      ) : (
        <div className="grid gap-5">
          <Field label={t('billTo')} hint={t('billToHint')}>
            <Select
              value={accountId}
              onValueChange={setAccountId}
              options={[
                { value: 'none', label: t('selfPay') },
                ...accounts.map((a) => ({
                  value: a.id,
                  label: a.name,
                  description: e('accountKind', a.kind),
                })),
              ]}
            />
          </Field>
          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-medium text-fg-muted">
              {t('packagesOptional')}
            </legend>
            {packages.length === 0 ? (
              <p className="rounded-xl border border-dashed border-line px-4 py-4 text-sm text-fg-muted">
                {t('noMatchingPackages')}
              </p>
            ) : (
              packages.map((p) => {
                const checked = packageIds.includes(p.id)
                const clash =
                  !checked &&
                  chosen.some((c) =>
                    c.testIds.some((x) => p.testIds.includes(x)),
                  )
                const id = `${ids}-${p.id}`
                return (
                  <label
                    key={p.id}
                    htmlFor={id}
                    className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-line px-4 py-3 has-[[data-state=checked]]:border-accent has-[[data-state=checked]]:bg-accent-soft has-[button:disabled]:cursor-not-allowed has-[button:disabled]:opacity-60"
                  >
                    <Checkbox
                      id={id}
                      checked={checked}
                      disabled={clash}
                      onCheckedChange={() => toggle(p.id)}
                      className="mt-0.5"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-fg">
                        {p.name}
                      </span>
                      <span className="block text-xs text-fg-muted">
                        {clash
                          ? t('packageOverlaps')
                          : t('packageReplaces', { count: p.testIds.length })}
                      </span>
                    </span>
                    <span className="text-sm font-semibold text-fg tabular-nums">
                      {money(p.price)}
                    </span>
                  </label>
                )
              })
            )}
          </fieldset>
          <p className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl bg-surface-2 px-4 py-3 text-sm">
            <span className="text-fg-muted">{t('estimate')}</span>
            <span className="text-base font-semibold text-fg tabular-nums">
              {money(estimate)}
            </span>
          </p>
        </div>
      )}
    </Dialog>
  )
}

/** The order's invoice in the order drawer, or a way to create one. */
export function OrderInvoiceSection({ order }: { order: OrderDetail }) {
  const t = useT('billing')
  const money = useMoney()
  const { data, isPending, isError, refetch } = useOrderInvoice(order.id)
  const [creating, setCreating] = useState(false)
  const billable =
    order.status !== 'cancelled' &&
    order.status !== 'draft' &&
    order.status !== 'rejected'

  if (isPending) return <SkeletonText lines={2} />
  if (isError) return <ErrorState compact onRetry={() => void refetch()} />
  if (!data)
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-line px-4 py-3">
        <p className="text-sm text-fg-muted">
          {billable ? t('notInvoiced') : t('notBillable')}
        </p>
        {billable ? (
          <GuardedButton
            permission="billing.invoice"
            size="sm"
            onClick={() => setCreating(true)}
          >
            <ReceiptIndianRupeeIcon />
            {t('createInvoice')}
          </GuardedButton>
        ) : null}
        {creating ? (
          <CreateInvoiceDialog
            order={order}
            onClose={() => setCreating(false)}
          />
        ) : null}
      </div>
    )
  return (
    <Link
      to={`/billing/${data.id}`}
      className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-line px-4 py-3 transition-colors hover:border-line-strong hover:bg-surface-2/50"
    >
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-meta font-semibold text-fg">
            {data.invoiceNo}
          </span>
          <InvoiceStatusBadge status={data.status} size="sm" />
        </span>
        {data.discountPending ? (
          <span className="mt-1 flex items-center gap-1 text-xs font-medium text-warning-text">
            <HourglassIcon className="size-3" aria-hidden />
            {t('discountAwaiting')}
          </span>
        ) : null}
      </span>
      <span className="grid text-right text-xs text-fg-muted">
        <span>
          {t('total')}{' '}
          <span className="font-semibold text-fg tabular-nums">
            {money(data.total)}
          </span>
        </span>
        <span>
          {t('balance')}{' '}
          <span className="font-semibold text-fg tabular-nums">
            {money(Math.max(0, data.balance))}
          </span>
        </span>
      </span>
      <ChevronRightIcon className="size-4 text-fg-subtle" aria-hidden />
    </Link>
  )
}
