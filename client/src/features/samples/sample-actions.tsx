import {
  PackageIcon,
  CirclePauseIcon,
  PencilLineIcon,
  CirclePlayIcon,
  PrinterIcon,
  CircleXIcon,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { HOLD_REASONS, type HoldReason } from '@/domain/types'
import { useEnum, useT } from '@/i18n/context'
import { labApi, type SampleRow } from '@/services/lab-api'
import { useLabMutation } from '@/services/mutations'
import { LabelPrintDialog } from '@/components/lab/labels'
import { ReasonDialog } from '@/components/lab/reason-dialog'
import { RejectSampleDialog } from '@/components/lab/reject-sample-dialog'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { StartDialog } from './start-dialog'

type Dialogs = 'start' | 'hold' | 'reject' | 'label' | null

/** Contextual actions for a sample and the dialogs they open. */
export function useSampleActions(
  sample: SampleRow | undefined,
  options: { compact?: boolean } = {},
) {
  const t = useT('processing')
  const e = useEnum()
  const navigate = useNavigate()
  const [open, setOpen] = useState<Dialogs>(null)
  const receive = useLabMutation((id: string) => labApi.samples.receive(id), {
    success: (r) => t('receivedToast', { accession: r.accessionNo ?? '' }),
  })
  const resume = useLabMutation((id: string) => labApi.samples.resume(id), {
    success: () => t('resumed', { accession: sample?.accessionNo ?? '' }),
  })
  const hold = useLabMutation(
    (v: { reason: HoldReason; remarks: string }) =>
      labApi.samples.hold(sample!.id, v.remarks ? v : { reason: v.reason }),
    {
      success: () => t('held', { accession: sample?.accessionNo ?? '' }),
      onSuccess: () => setOpen(null),
    },
  )

  if (!sample)
    return {
      primary: null as ReactNode,
      secondary: [] as {
        key: string
        label: string
        icon: ReactNode
        onSelect: () => void
        danger?: boolean
      }[],
      dialogs: null as ReactNode,
    }

  let lead: {
    label: string
    icon: ReactNode
    onClick: () => void
    loading?: boolean
    variant?: 'primary' | 'secondary'
  } | null = null
  switch (sample.status) {
    case 'collected':
      lead = {
        label: t('receive'),
        icon: <PackageIcon />,
        onClick: () => receive.mutate(sample.id),
        loading: receive.isPending,
      }
      break
    case 'received':
      lead = {
        label: t('startShort'),
        icon: <CirclePlayIcon />,
        onClick: () => setOpen('start'),
      }
      break
    case 'processing':
      if (!sample.allEntered)
        lead = {
          label: t('enterResults'),
          icon: <PencilLineIcon />,
          onClick: () => void navigate(`/laboratory/results/${sample.id}`),
        }
      break
    case 'on_hold':
      lead = {
        label: t('resume'),
        icon: <CirclePlayIcon />,
        onClick: () => resume.mutate(sample.id),
        loading: resume.isPending,
        variant: 'secondary',
      }
      break
  }
  const primary: ReactNode = !lead ? null : options.compact ? (
    <IconButton
      label={lead.label}
      icon={lead.icon}
      variant={lead.variant ?? 'primary'}
      loading={lead.loading ?? false}
      onClick={lead.onClick}
    />
  ) : (
    <Button
      variant={lead.variant ?? 'primary'}
      size="sm"
      loading={lead.loading ?? false}
      onClick={lead.onClick}
    >
      {lead.icon}
      {lead.label}
    </Button>
  )

  const inLab = ['received', 'processing'].includes(sample.status)
  const rejectable = [
    'collected',
    'received',
    'processing',
    'on_hold',
  ].includes(sample.status)
  const secondary = [
    ...(inLab
      ? [
          {
            key: 'hold',
            label: t('hold'),
            icon: <CirclePauseIcon />,
            onSelect: () => setOpen('hold'),
          },
        ]
      : []),
    ...(sample.accessionNo && sample.status !== 'discarded'
      ? [
          {
            key: 'label',
            label: t('printLabel'),
            icon: <PrinterIcon />,
            onSelect: () => setOpen('label'),
          },
        ]
      : []),
    ...(rejectable
      ? [
          {
            key: 'reject',
            label: t('reject'),
            icon: <CircleXIcon />,
            onSelect: () => setOpen('reject'),
            danger: true,
          },
        ]
      : []),
  ]

  const dialogs = (
    <>
      {open === 'start' ? (
        <StartDialog sample={sample} onClose={() => setOpen(null)} />
      ) : null}
      <ReasonDialog
        open={open === 'hold'}
        onOpenChange={(o) => !o && setOpen(null)}
        title={t('holdTitle', { accession: sample.accessionNo ?? '' })}
        description={t('holdDescription')}
        reasonLabel={t('holdReason')}
        reasons={HOLD_REASONS.map((r) => ({
          value: r,
          label: e('holdReason', r),
        }))}
        confirmLabel={t('hold')}
        tone="primary"
        loading={hold.isPending}
        onConfirm={(v) => hold.mutate(v)}
      />
      <RejectSampleDialog
        sample={sample}
        open={open === 'reject'}
        onOpenChange={(o) => !o && setOpen(null)}
      />
      {open === 'label' ? (
        <LabelPrintDialog
          open
          onOpenChange={(o) => !o && setOpen(null)}
          samples={[sample]}
        />
      ) : null}
    </>
  )
  return { primary, secondary, dialogs }
}
