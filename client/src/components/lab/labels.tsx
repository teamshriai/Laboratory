import { PrinterIcon } from 'lucide-react'
import { toast } from 'sonner'
import { useNow } from '@/hooks/use-now'
import { useEnum, useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import type { SampleRow } from '@/services/lab-api'
import { labApi } from '@/services/lab-api'
import { useLabMutation } from '@/services/mutations'
import { Button } from '../ui/button'
import { Dialog } from '../ui/dialog'
import { Barcode } from '../ui/misc'
import { usePrint } from '../ui/print-context'
import { AgeSex } from './patient'
import { ContainerChip } from './sample'
import { cn } from '@/lib/cn'
import { TUBE_CLASS } from '@/lib/tube-colors'

type LabelSample = Pick<
  SampleRow,
  | 'id'
  | 'accessionNo'
  | 'patient'
  | 'container'
  | 'tests'
  | 'priority'
  | 'department'
  | 'labelPrintCount'
  | 'collectedAt'
>

/**
 * One 50 x 25 mm tube label: patient name, UHID, age/sex and DOB (two
 * identifiers), the Code 128 accession with its number in readable type,
 * the container's cap colour as a bar, and the collection time (written by
 * hand when the label is printed before the draw).
 */
export function SampleLabel({
  sample,
  accessionNo,
  printedAt,
}: {
  sample: LabelSample
  accessionNo: string
  printedAt: number
}) {
  const t = useT('orders')
  const e = useEnum()
  const f = useFormat()
  return (
    <div className="print-label flex h-[25mm] w-[50mm] overflow-hidden bg-[#ffffff] text-[6.5pt] leading-tight text-[#000000]">
      <span
        aria-hidden
        className={cn(
          'w-[2mm] shrink-0 border-r border-[#000000]/30',
          TUBE_CLASS[sample.container],
        )}
      />
      <div className="flex min-w-0 flex-1 flex-col justify-between px-[1.5mm] py-[1.2mm]">
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-0">
            <p className="truncate text-[8pt] font-bold">
              {sample.patient.name}
            </p>
            <p className="truncate">
              {sample.patient.uhid} ·{' '}
              <AgeSex dob={sample.patient.dob} sex={sample.patient.sex} /> ·{' '}
              {t('labelDob', { date: f.date(Date.parse(sample.patient.dob)) })}
            </p>
          </div>
          {sample.priority !== 'routine' ? (
            <span className="rounded-sm border border-[#000000] px-1 text-[6.5pt] font-bold">
              {e('priority', sample.priority)}
            </span>
          ) : null}
        </div>
        <Barcode value={accessionNo} height={24} className="h-[7mm] w-full" />
        <div className="flex items-end justify-between gap-1">
          <p className="font-mono text-[8pt] font-bold tracking-wide">
            {accessionNo}
          </p>
          <p className="truncate text-right">
            {e('containerShort', sample.container)} ·{' '}
            {sample.tests
              .filter((x) => x.active)
              .map((x) => x.shortName)
              .join(', ')}
          </p>
        </div>
        <p className="truncate">
          {sample.collectedAt
            ? t('labelCollected', { time: f.dateTime(sample.collectedAt) })
            : t('labelCollectedBlank')}
        </p>
        <p className="sr-only">{f.dateTime(printedAt)}</p>
      </div>
    </div>
  )
}

/** Preview and print barcode labels; assigns sample IDs on first print. */
export function LabelPrintDialog({
  open,
  onOpenChange,
  samples,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  samples: LabelSample[]
}) {
  const t = useT('orders')
  const tc = useT('common')
  const e = useEnum()
  const now = useNow()
  const { print } = usePrint()
  const mutation = useLabMutation(
    (ids: string[]) => labApi.samples.printLabels(ids),
    {
      success: (_, ids) => t('labelsPrinted', { count: ids.length }),
      onSuccess: (printed) => {
        const now = Date.now()
        onOpenChange(false)
        print(
          <div className="grid gap-0">
            {printed.map((p) => {
              const sample = samples.find((s) => s.id === p.id)
              return sample && p.accessionNo ? (
                <SampleLabel
                  key={p.id}
                  sample={sample}
                  accessionNo={p.accessionNo}
                  printedAt={now}
                />
              ) : null
            })}
          </div>,
        )
      },
      onError: () => toast.dismiss(),
    },
  )
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('labelsTitle')}
      description={t('labelsDescription')}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {tc('cancel')}
          </Button>
          <Button
            variant="primary"
            loading={mutation.isPending}
            onClick={() => mutation.mutate(samples.map((s) => s.id))}
            disabled={samples.length === 0}
          >
            <PrinterIcon />
            {t('labelsPrint', { count: samples.length })}
          </Button>
        </>
      }
    >
      <ul className="grid gap-3 sm:grid-cols-2">
        {samples.map((s) => (
          <li
            key={s.id}
            className="rounded-xl border border-line bg-surface-2/60 p-3"
          >
            <div className="mb-2 flex items-center justify-between gap-2 text-xs text-fg-muted">
              <ContainerChip container={s.container} full className="text-xs" />
              <span>{e('department', s.department)}</span>
            </div>
            <div className="overflow-hidden rounded-md shadow-raised ring-1 ring-line">
              <div
                className="[width:calc(100%/1.35)] origin-top-left scale-[1.35]"
                style={{ height: 'calc(25mm * 1.35)' }}
              >
                <SampleLabel
                  sample={s}
                  accessionNo={s.accessionNo ?? t('labelPreviewId')}
                  printedAt={now}
                />
              </div>
            </div>
            {s.labelPrintCount > 0 ? (
              <p className="mt-2 text-xs text-fg-subtle">
                {t('printedTimes', { count: s.labelPrintCount })}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </Dialog>
  )
}
