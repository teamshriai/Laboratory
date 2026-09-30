import {
  ChevronsUpIcon,
  ChevronDownIcon,
  FileTextIcon,
  ZapIcon,
  PlusIcon,
  PrinterIcon,
  BanIcon,
  Trash2Icon,
  UserIcon,
} from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import {
  CANCEL_REASONS,
  type CancelReason,
  type Priority,
} from '@/domain/types'
import { useEnum, useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import { labApi, type OrderDetail } from '@/services/lab-api'
import { useLabMutation } from '@/services/mutations'
import { useOrder, useOrderableTests } from '@/services/queries'
import { HistoryTimeline } from '@/components/lab/history'
import { LabelPrintDialog } from '@/components/lab/labels'
import { PatientCell } from '@/components/lab/patient'
import { ReasonDialog } from '@/components/lab/reason-dialog'
import { ContainerChip, SamplePipeline } from '@/components/lab/sample'
import {
  OrderStatusBadge,
  PriorityBadge,
  ReportStatusBadge,
  ResultStatusBadge,
  SampleStatusBadge,
} from '@/components/lab/status'
import { TatIndicator } from '@/components/lab/tat'
import { TestPicker } from '@/components/lab/test-picker'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Dialog, Drawer } from '@/components/ui/dialog'
import { IconButton } from '@/components/ui/icon-button'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu'
import { SkeletonText } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/states'

function Section({
  title,
  children,
  action,
}: {
  title: string
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <section className="mb-6 last:mb-0">
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <h3 className="text-xs font-semibold tracking-wide text-fg-subtle uppercase">
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  )
}

function OrderBody({ order }: { order: OrderDetail }) {
  const t = useT('orders')
  const tc = useT('common')
  const e = useEnum()
  const f = useFormat()
  const [removing, setRemoving] = useState<OrderDetail['items'][number] | null>(
    null,
  )
  const remove = useLabMutation(
    (v: { itemId: string; reason: CancelReason }) =>
      labApi.orders.removeTest(v.itemId, v.reason),
    {
      success: () => t('testRemoved', { test: removing?.name ?? '' }),
      onSuccess: () => setRemoving(null),
    },
  )
  const editable = order.status !== 'cancelled'
  return (
    <>
      <Section
        title={t('sectionPatient')}
        action={
          <Link
            to={`/laboratory/patients/${order.patient.id}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-accent-text hover:underline"
          >
            <UserIcon className="size-3.5" />
            {t('openPatient')}
          </Link>
        }
      >
        <div className="rounded-xl border border-line bg-surface-2/50 p-4">
          <div className="flex items-start justify-between gap-3">
            <PatientCell patient={order.patient} />
            <span className="text-right">
              <span className="block text-xs text-fg-muted">
                {t('totalAmount')}
              </span>
              <span className="text-sm font-semibold text-fg tabular-nums">
                {f.currency(order.total)}
              </span>
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Badge tone="neutral">{e('encounter', order.encounter)}</Badge>
            <Badge tone="neutral">
              {e('clinicalDepartment', order.clinicalDepartment)}
            </Badge>
            {order.ward ? (
              <Badge tone="neutral">
                {order.bed
                  ? tc('wardBed', { ward: order.ward, bed: order.bed })
                  : order.ward}
              </Badge>
            ) : null}
            {order.patient.allergies.map((a) => (
              <Badge key={a} tone="danger">
                {tc('allergies')}: {a}
              </Badge>
            ))}
          </div>
        </div>
      </Section>

      <Section title={t('sectionClinical')}>
        <p className="rounded-xl border border-line px-4 py-3 text-sm leading-relaxed text-fg">
          {order.clinicalNotes || (
            <span className="text-fg-muted">{t('noClinicalNotes')}</span>
          )}
        </p>
      </Section>

      <Section title={t('sectionTests')}>
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
          {order.items.map((item) => (
            <li
              key={item.itemId}
              className={
                item.active ? 'bg-surface' : 'bg-surface-2/60 opacity-70'
              }
            >
              <div className="flex items-start gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p
                    className={
                      item.active
                        ? 'text-sm font-medium text-fg'
                        : 'text-sm font-medium text-fg-muted line-through'
                    }
                  >
                    {item.name}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-muted">
                    <span className="font-mono">{item.code}</span>
                    <span>{e('department', item.department)}</span>
                    <ContainerChip
                      container={item.container}
                      className="text-xs text-fg-muted"
                    />
                    {item.sampleId && item.accessionNo ? (
                      <Link
                        to={`/laboratory/samples/${item.sampleId}`}
                        className="font-mono text-accent-text hover:underline"
                      >
                        {item.accessionNo}
                      </Link>
                    ) : item.sampleId ? (
                      <span className="text-fg-subtle">
                        {t('notCollected')}
                      </span>
                    ) : null}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  {item.active ? (
                    <ResultStatusBadge status={item.status} />
                  ) : (
                    <Badge tone="outline">
                      {item.cancelReason
                        ? e('cancelReason', item.cancelReason)
                        : e('resultStatus', 'void')}
                    </Badge>
                  )}
                  {item.active && item.status !== 'validated' ? (
                    <TatIndicator tat={item.tat} compact />
                  ) : null}
                </div>
                {editable && item.active && item.status !== 'validated' ? (
                  <IconButton
                    label={t('removeTest')}
                    icon={<Trash2Icon />}
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => setRemoving(item)}
                    className="-mr-1 text-fg-subtle hover:text-danger-text"
                  />
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section title={t('sectionSamples')}>
        <ul className="grid gap-2">
          {order.samples.map((s) => (
            <li key={s.id}>
              <Link
                to={`/laboratory/samples/${s.id}`}
                className="block rounded-xl border border-line p-3.5 transition-colors hover:border-line-strong hover:bg-surface-2/50"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-3">
                    <ContainerChip container={s.container} />
                    {s.accessionNo ? (
                      <span className="font-mono text-meta font-semibold text-fg">
                        {s.accessionNo}
                      </span>
                    ) : (
                      <span className="text-meta text-fg-subtle">
                        {t('notCollected')}
                      </span>
                    )}
                    <span className="text-xs text-fg-muted">
                      {e('department', s.department)}
                    </span>
                  </span>
                  <SampleStatusBadge status={s.status} size="sm" />
                </div>
                <SamplePipeline
                  stage={s.stage}
                  rejected={s.status === 'rejected'}
                  compact
                  className="mt-2.5"
                />
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      {order.reports.length > 0 ? (
        <Section title={t('sectionReports')}>
          <ul className="flex flex-wrap gap-2">
            {order.reports.map((r) => (
              <li key={r.id}>
                <Link
                  to={`/laboratory/reports/${r.id}`}
                  className="inline-flex items-center gap-2.5 rounded-xl border border-line px-3 py-2 text-meta hover:border-line-strong hover:bg-surface-2/50"
                >
                  <FileTextIcon className="size-4 text-fg-subtle" />
                  <span className="font-mono font-medium text-fg">
                    {r.reportNo}
                  </span>
                  <span className="text-fg-muted">
                    {e('department', r.department)}
                  </span>
                  <ReportStatusBadge status={r.status} size="sm" />
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section title={t('sectionTimeline')}>
        <HistoryTimeline entries={order.history} />
      </Section>

      <ReasonDialog
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={t('removeTestTitle', { test: removing?.name ?? '' })}
        description={t('removeTestBody')}
        reasonLabel={t('cancelReason')}
        reasons={CANCEL_REASONS.map((r) => ({
          value: r,
          label: e('cancelReason', r),
        }))}
        confirmLabel={t('removeTest')}
        loading={remove.isPending}
        onConfirm={({ reason }) =>
          removing && remove.mutate({ itemId: removing.itemId, reason })
        }
      />
    </>
  )
}

export default function OrderDrawer({
  orderId,
  onClose,
}: {
  orderId: string
  onClose: () => void
}) {
  const t = useT('orders')
  const e = useEnum()
  const f = useFormat()
  const { data: order, isPending, isError, refetch } = useOrder(orderId)
  const { data: tests } = useOrderableTests()
  const [adding, setAdding] = useState(false)
  const [picked, setPicked] = useState<string[]>([])
  const [cancelling, setCancelling] = useState(false)
  const [printing, setPrinting] = useState(false)

  const add = useLabMutation(
    (ids: string[]) => labApi.orders.addTests(orderId, ids),
    {
      success: (_, ids) =>
        t('testsAdded', { count: ids.length, orderNo: order?.orderNo ?? '' }),
      onSuccess: () => {
        setAdding(false)
        setPicked([])
      },
    },
  )
  const priority = useLabMutation(
    (p: Priority) => labApi.orders.setPriority(orderId, p),
    {
      success: (_, p) => t('priorityChanged', { priority: e('priority', p) }),
    },
  )
  const cancel = useLabMutation(
    (v: { reason: CancelReason; remarks: string }) =>
      labApi.orders.cancel(orderId, v.remarks ? v : { reason: v.reason }),
    {
      success: () => t('orderCancelled', { orderNo: order?.orderNo ?? '' }),
      onSuccess: () => setCancelling(false),
    },
  )

  const [discarding, setDiscarding] = useState(false)
  const discard = useLabMutation(() => labApi.orders.discardDraft(orderId), {
    success: () => t('draftDiscarded'),
    onSuccess: () => {
      setDiscarding(false)
      onClose()
    },
  })
  const active =
    order &&
    order.status !== 'cancelled' &&
    order.status !== 'draft' &&
    order.status !== 'rejected'
  const labelSamples =
    order?.samples.filter(
      (s) => s.status !== 'rejected' && s.status !== 'discarded',
    ) ?? []

  return (
    <Drawer
      open
      onOpenChange={(o) => !o && onClose()}
      size="lg"
      title={
        order ? <span className="font-mono">{order.orderNo}</span> : t('title')
      }
      headerExtra={
        order ? (
          <>
            <OrderStatusBadge status={order.status} />
            <PriorityBadge priority={order.priority} hideRoutine />
          </>
        ) : null
      }
      description={
        order && order.orderedAt
          ? t('drawerDescription', {
              time: f.dateTime(order.orderedAt),
              doctor: order.doctor.name,
            })
          : undefined
      }
      footer={
        order ? (
          <>
            {active ? (
              <>
                <Button
                  variant="ghost"
                  className="mr-auto text-danger-text hover:bg-danger-soft hover:text-danger-text"
                  onClick={() => setCancelling(true)}
                >
                  <BanIcon />
                  {t('cancelOrder')}
                </Button>
                <Button
                  onClick={() => setPrinting(true)}
                  disabled={labelSamples.length === 0}
                >
                  <PrinterIcon />
                  {t('printLabels')}
                </Button>
                <Menu>
                  <MenuTrigger asChild>
                    <Button loading={priority.isPending}>
                      {t('setPriority')}
                      <ChevronDownIcon />
                    </Button>
                  </MenuTrigger>
                  <MenuContent>
                    <MenuItem
                      icon={<ZapIcon />}
                      onSelect={() => priority.mutate('stat')}
                      disabled={order.priority === 'stat'}
                    >
                      {t('markStat')}
                    </MenuItem>
                    <MenuItem
                      icon={<ChevronsUpIcon />}
                      onSelect={() => priority.mutate('urgent')}
                      disabled={order.priority === 'urgent'}
                    >
                      {t('markUrgent')}
                    </MenuItem>
                    <MenuItem
                      onSelect={() => priority.mutate('routine')}
                      disabled={order.priority === 'routine'}
                    >
                      {t('markRoutine')}
                    </MenuItem>
                  </MenuContent>
                </Menu>
                <Button variant="primary" onClick={() => setAdding(true)}>
                  <PlusIcon strokeWidth={2.5} />
                  {t('addTests')}
                </Button>
              </>
            ) : order.status === 'draft' ? (
              <>
                <Button
                  variant="ghost"
                  className="mr-auto text-danger-text hover:bg-danger-soft hover:text-danger-text"
                  onClick={() => setDiscarding(true)}
                >
                  <Trash2Icon />
                  {t('discardDraft')}
                </Button>
                <Button asChild variant="primary">
                  <Link to={`/laboratory/orders/new?draft=${order.id}`}>
                    {t('continueDraft')}
                  </Link>
                </Button>
              </>
            ) : null}
          </>
        ) : null
      }
    >
      {isPending ? (
        <div className="grid gap-6">
          <SkeletonText lines={4} />
          <SkeletonText lines={6} />
          <SkeletonText lines={4} />
        </div>
      ) : isError || !order ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : (
        <OrderBody order={order} />
      )}

      <ConfirmDialog
        open={discarding}
        onOpenChange={setDiscarding}
        title={t('discardDraftTitle')}
        description={t('discardDraftBody')}
        confirmLabel={t('discardDraft')}
        tone="danger"
        loading={discard.isPending}
        onConfirm={() => discard.mutate()}
      />
      {order ? (
        <>
          <Dialog
            open={adding}
            onOpenChange={setAdding}
            size="lg"
            title={t('addTestsTitle', { orderNo: order.orderNo ?? '' })}
            description={t('addTestsDescription')}
            footer={
              <>
                <Button variant="ghost" onClick={() => setAdding(false)}>
                  {t('back')}
                </Button>
                <Button
                  variant="primary"
                  disabled={picked.length === 0}
                  loading={add.isPending}
                  onClick={() => add.mutate(picked)}
                >
                  {t('addSelected', { count: picked.length })}
                </Button>
              </>
            }
          >
            <TestPicker
              tests={tests ?? []}
              selected={picked}
              disabledIds={order.items
                .filter((i) => i.active && i.status !== 'void')
                .map((i) => i.testId)}
              onToggle={(id) =>
                setPicked((prev) =>
                  prev.includes(id)
                    ? prev.filter((x) => x !== id)
                    : [...prev, id],
                )
              }
              maxHeight="50dvh"
            />
          </Dialog>
          <ReasonDialog
            open={cancelling}
            onOpenChange={setCancelling}
            title={t('cancelTitle', { orderNo: order.orderNo ?? '' })}
            description={t('cancelBody')}
            reasonLabel={t('cancelReason')}
            reasons={CANCEL_REASONS.map((r) => ({
              value: r,
              label: e('cancelReason', r),
            }))}
            confirmLabel={t('cancelOrder')}
            loading={cancel.isPending}
            onConfirm={(v) => cancel.mutate(v)}
          />
          <LabelPrintDialog
            open={printing}
            onOpenChange={setPrinting}
            samples={labelSamples}
          />
        </>
      ) : null}
    </Drawer>
  )
}
