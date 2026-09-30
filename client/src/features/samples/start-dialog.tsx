import { CirclePlayIcon, TriangleAlertIcon } from 'lucide-react'
import { useState } from 'react'
import { useEnum, useT } from '@/i18n/context'
import { labApi, type SampleRow } from '@/services/lab-api'
import { useLabMutation } from '@/services/mutations'
import { useSample } from '@/services/queries'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { ChoiceCards } from '@/components/ui/toggles'

export function StartDialog({
  sample,
  onClose,
}: {
  sample: SampleRow
  onClose: () => void
}) {
  const t = useT('processing')
  const tc = useT('common')
  const e = useEnum()
  const { data } = useSample(sample.id)
  const options = data?.equipmentOptions ?? []
  const usable = options.filter(
    (o) => o.status === 'operational' || o.status === 'calibration-due',
  )
  const [choice, setChoice] = useState<string | undefined>(undefined)
  const selected = choice ?? usable[0]?.id ?? 'manual'
  const chosen = options.find((o) => o.id === selected)
  const start = useLabMutation(
    (equipmentId: string | undefined) =>
      labApi.samples.start(sample.id, equipmentId),
    {
      success: () => t('started', { accession: sample.accessionNo ?? '' }),
      onSuccess: onClose,
    },
  )
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={t('startTitle', { accession: sample.accessionNo ?? '' })}
      description={t('startDescription')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {tc('cancel')}
          </Button>
          <Button
            variant="primary"
            disabled={!selected}
            loading={start.isPending}
            onClick={() =>
              start.mutate(selected === 'manual' ? undefined : selected)
            }
          >
            <CirclePlayIcon />
            {t('start')}
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        <ChoiceCards
          value={selected}
          onValueChange={setChoice}
          columns={2}
          aria-label={t('analyzer')}
          options={[
            ...usable.map((o) => ({
              value: o.id,
              label: o.name,
              description: `${o.model}${o.status === 'calibration-due' ? ` · ${e('equipmentStatus', o.status)}` : ''}${o.qcFailedToday ? ` · ${e('qcResult', 'fail')}` : ''}`,
            })),
            ...(usable.length === 0
              ? [{ value: 'manual', label: t('manualBench') }]
              : []),
          ]}
        />
        {options
          .filter((o) => !usable.includes(o))
          .map((o) => (
            <p
              key={o.id}
              className="flex items-center gap-2 rounded-lg border border-dashed border-line px-3 py-2 text-meta text-fg-muted"
            >
              <TriangleAlertIcon className="size-4 shrink-0 text-warning-text" />
              <span className="font-medium text-fg">{o.name}</span>
              {t('analyzerUnavailable', {
                status: e('equipmentStatus', o.status),
              })}
            </p>
          ))}
        {chosen?.qcFailedToday ? (
          <p className="flex items-start gap-2 rounded-lg bg-danger-soft p-3 text-meta text-danger-text">
            <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
            {t('qcFailedWarning')}
          </p>
        ) : chosen?.status === 'calibration-due' ? (
          <p className="flex items-start gap-2 rounded-lg bg-warning-soft p-3 text-meta text-warning-text">
            <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
            {t('calibrationWarning')}
          </p>
        ) : null}
      </div>
    </Dialog>
  )
}
