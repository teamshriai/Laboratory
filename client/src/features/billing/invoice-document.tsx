import type { ReactNode } from 'react'
import { useEnum, useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import { INDOSTATES } from '@/lib/brand'
import type { InvoiceDetail } from '@/services/lab-api'
import { IndostatesLogo, Logo } from '@/components/ui/logo'
import { useMoney } from './billing'

function Meta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[8pt] font-semibold tracking-[0.08em] text-fg-subtle uppercase">
        {label}
      </dt>
      <dd className="mt-0.5 text-[10pt] break-words text-fg">{children}</dd>
    </div>
  )
}

function TotalRow({
  label,
  value,
  strong,
}: {
  label: string
  value: string
  strong?: boolean
}) {
  return (
    <div
      className={
        strong
          ? 'flex justify-between gap-6 border-t border-line-strong pt-1.5 text-[11pt] font-bold text-fg'
          : 'flex justify-between gap-6 text-[9.5pt] text-fg-muted'
      }
    >
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  )
}

/**
 * The invoice, or the receipt for one payment, as a printable A4 page. Print
 * forces the light tokens, so a dark-theme session prints white paper.
 */
export function InvoiceDocument({
  invoice,
  paymentId,
}: {
  invoice: InvoiceDetail
  /** Print the receipt for this payment instead of the invoice. */
  paymentId?: string
}) {
  const t = useT('billing')
  const tc = useT('common')
  const e = useEnum()
  const f = useFormat()
  const money = useMoney()
  const payment = paymentId
    ? invoice.payments.find((p) => p.id === paymentId)
    : undefined
  const totals = invoice.totals

  return (
    <article className="relative mx-auto w-full max-w-[210mm] bg-surface px-5 py-6 text-fg sm:px-[14mm] sm:py-[12mm]">
      {invoice.cancelled ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 grid place-items-center overflow-hidden"
        >
          <span className="-rotate-30 text-[40pt] font-bold tracking-widest text-fg/[0.06] uppercase">
            {e('invoiceStatus', 'cancelled')}
          </span>
        </span>
      ) : null}
      <header className="flex flex-col gap-4 border-b-2 border-accent pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Logo className="size-11" />
          <div>
            <p className="text-[14pt] leading-tight font-bold text-accent-text">
              {invoice.lab.labName}
            </p>
            {invoice.lab.labAddress ? (
              <p className="text-[8pt] text-fg-muted">
                {invoice.lab.labAddress}
              </p>
            ) : null}
            {invoice.lab.labRegistration ? (
              <p className="text-[8pt] text-fg-muted">
                {invoice.lab.labRegistration}
              </p>
            ) : null}
            {invoice.sellerGstin ? (
              <p className="text-[8pt] text-fg-muted">
                {t('gstin')} {invoice.sellerGstin}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-col gap-0.5 sm:items-end sm:text-right">
          <IndostatesLogo alt={INDOSTATES.name} className="mb-2 h-[28px]" />
          <p className="text-[8pt] font-bold tracking-[0.12em] text-accent-text uppercase">
            {payment ? t('docReceipt') : t('docInvoice')}
          </p>
          <p className="font-mono text-[10pt] font-bold">{invoice.invoiceNo}</p>
          <p className="text-[8.5pt] text-fg-muted">
            {f.dateTime(payment ? payment.at : invoice.issuedAt)}
          </p>
        </div>
      </header>

      <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
        <Meta label={tc('patient')}>{invoice.patient.name}</Meta>
        <Meta label={tc('uhid')}>
          <span className="font-mono">{invoice.patient.uhid}</span>
        </Meta>
        <Meta label={tc('orderNo')}>
          <span className="font-mono">{invoice.orderNo ?? '-'}</span>
        </Meta>
        <Meta label={t('billTo')}>
          {invoice.accountName ?? t('selfPay')}
          {invoice.buyerGstin ? (
            <span className="block text-[8pt] text-fg-muted">
              {t('gstin')} {invoice.buyerGstin}
            </span>
          ) : null}
        </Meta>
      </dl>

      {payment ? (
        <section className="mt-6 rounded-md border border-line p-4">
          <p className="text-[10pt] text-fg">
            {t('receiptLine', {
              amount: money(payment.amount),
              method: e('paymentMethod', payment.method),
              invoice: invoice.invoiceNo,
            })}
          </p>
          {payment.reference ? (
            <p className="mt-1 text-[9pt] text-fg-muted">
              {t('reference')}: {payment.reference}
            </p>
          ) : null}
          <dl className="mt-4 ml-auto grid max-w-72 gap-1">
            <TotalRow label={t('total')} value={money(totals.total)} />
            <TotalRow label={t('paidToDate')} value={money(totals.paid)} />
            <TotalRow
              label={t('balance')}
              value={money(Math.max(0, totals.balance))}
              strong
            />
          </dl>
        </section>
      ) : (
        <>
          <table className="mt-6 w-full border-collapse text-[9pt]">
            <caption className="sr-only">{t('lines')}</caption>
            <thead>
              <tr className="border-b border-line-strong text-left text-[8pt] tracking-[0.06em] text-fg-subtle uppercase">
                <th scope="col" className="py-1.5 pr-2">
                  {t('colDescription')}
                </th>
                <th scope="col" className="px-2 py-1.5">
                  {t('colSac')}
                </th>
                <th scope="col" className="px-2 py-1.5 text-right">
                  {t('colQty')}
                </th>
                <th scope="col" className="px-2 py-1.5 text-right">
                  {t('colRate')}
                </th>
                <th scope="col" className="px-2 py-1.5 text-right">
                  {t('colGst')}
                </th>
                <th scope="col" className="py-1.5 pl-2 text-right">
                  {t('colAmount')}
                </th>
              </tr>
            </thead>
            <tbody>
              {invoice.lines.map((l) => (
                <tr key={l.id} className="border-b border-line align-top">
                  <td className="py-1.5 pr-2">
                    {l.description}
                    <span className="block text-[7.5pt] text-fg-subtle">
                      {t(`lineKind.${l.kind}`)}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 font-mono">{l.sac}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {l.quantity}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {money(l.unitPrice)}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {t('percent', { value: l.taxRate })}
                  </td>
                  <td className="py-1.5 pl-2 text-right tabular-nums">
                    {money(l.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <dl className="print-avoid-break mt-4 ml-auto grid max-w-72 gap-1">
            <TotalRow label={t('gross')} value={money(totals.gross)} />
            {totals.discount > 0 ? (
              <TotalRow
                label={t('discount')}
                value={`-${money(totals.discount)}`}
              />
            ) : null}
            <TotalRow label={t('taxable')} value={money(totals.taxable)} />
            <TotalRow label={t('gst')} value={money(totals.tax)} />
            <TotalRow label={t('total')} value={money(totals.total)} strong />
            <TotalRow label={t('paidToDate')} value={money(totals.paid)} />
            {totals.refunded > 0 ? (
              <TotalRow label={t('refunded')} value={money(totals.refunded)} />
            ) : null}
            <TotalRow
              label={t('balance')}
              value={money(Math.max(0, totals.balance))}
              strong
            />
          </dl>
          {invoice.payments.length ? (
            <section className="print-avoid-break mt-6">
              <h3 className="border-b border-line pb-1 text-[8.5pt] font-bold tracking-[0.12em] text-accent-text uppercase">
                {t('payments')}
              </h3>
              <ul className="mt-2 grid gap-1 text-[9pt]">
                {invoice.payments.map((p) => (
                  <li key={p.id} className="flex justify-between gap-4">
                    <span>
                      {f.dateTime(p.at)} · {e('paymentMethod', p.method)}
                      {p.reference ? ` · ${p.reference}` : ''}
                    </span>
                    <span className="tabular-nums">{money(p.amount)}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}

      <footer className="mt-8 border-t border-line pt-3 text-[8pt] text-fg-muted">
        <p>
          {t('docIssuedBy', {
            name: payment ? payment.byName : invoice.issuedByName,
          })}
        </p>
        <p className="mt-1">{t('docFooter')}</p>
      </footer>
    </article>
  )
}
