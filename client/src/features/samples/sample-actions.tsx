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
import type { Permission } from '@/domain/permissions'
import { usePermissions } from '@/hooks/use-permission'
import { GuardedButton } from '@/components/lab/guarded-button'
import { StartDialog } from './start-dialog'

type Dialogs = 'start' | 'hold' | 'reject' | 'label' | null

export interface SecondaryAction {
  key: string
  label: string
  icon: ReactNode
  onSelect: () => void
  danger?: boolean
  disabled?: boolean
  hint?: string
}

/** Contextual actions for a sample and the dialogs they open. */
export function useSampleActions(
  sample: SampleRow | undefined,
  options: { compact?: boolean } = {},
) {
  const t = useT('processing')
  const e = useEnum()
  const navigate = useNavigate()
  const { can, why } = usePermissions()
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
      secondary: [] as SecondaryAction[],
      dialogs: null as ReactNode,
    }

  let lead: {
    label: string
    icon: ReactNode
    onClick: () => void
    permission: Permission
    loading?: boolean
    variant?: 'primary' | 'secondary'
  } | null = null
  switch (sample.status) {
    case 'collected':
      lead = {
        label: t('receive'),
        icon: <PackageIcon />,
        onClick: () => receive.mutate(sample.id),
        permission: 'specimen.receive',
        loading: receive.isPending,
      }
      break
    case 'received':
      lead = {
        label: t('startShort'),
        icon: <CirclePlayIcon />,
        onClick: () => setOpen('start'),
        permission: 'specimen.process',
      }
      break
    case 'processing':
      if (!sample.allEntered)
        lead = {
          label: t('enterResults'),
          icon: <PencilLineIcon />,
          onClick: () => void navigate(`/results/${sample.id}`),
          permission: 'result.enter',
        }
      break
    case 'on_hold':
      lead = {
        label: t('resume'),
        icon: <CirclePlayIcon />,
        onClick: () => resume.mutate(sample.id),
        permission: 'specimen.process',
        loading: resume.isPending,
        variant: 'secondary',
      }
      break
  }
  // The primary action names the next step in words (audit §11).
  const primary: ReactNode = !lead ? null : (
    <GuardedButton
      permission={lead.permission}
      variant={lead.variant ?? 'primary'}
      size={options.compact ? 'xs' : 'sm'}
      loading={lead.loading ?? false}
      onClick={lead.onClick}
    >
      {lead.icon}
      {lead.label}
    </GuardedButton>
  )
  const allowed = (permission: Permission) =>
    can(permission) ? {} : { disabled: true, hint: why(permission) }

  const inLab = ['received', 'processing'].includes(sample.status)
  const rejectable = [
    'collected',
    'received',
    'processing',
    'on_hold',
  ].includes(sample.status)
  const secondary: SecondaryAction[] = [
    ...(inLab
      ? [
          {
            key: 'hold',
            label: t('hold'),
            icon: <CirclePauseIcon />,
            onSelect: () => setOpen('hold'),
            ...allowed('specimen.process'),
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
            ...allowed('label.print'),
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
            ...allowed('specimen.reject'),
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
