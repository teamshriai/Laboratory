import { useState } from 'react'
import {
  COLLECTION_FAILURE_REASONS,
  REJECTION_REASONS,
  type CollectionFailureReason,
  type RejectionReason,
} from '@/domain/types'
import { useEnum, useT } from '@/i18n/context'
import { labApi, type SampleRow } from '@/services/lab-api'
import { useLabMutation } from '@/services/mutations'
import { Field } from '../ui/field'
import { Switch } from '../ui/toggles'
import { ReasonDialog } from './reason-dialog'

type Reason = RejectionReason | CollectionFailureReason

/** Rejects a sample (or records that it could not be collected) with a reason. */
export function RejectSampleDialog({
  sample,
  open,
  onOpenChange,
  onDone,
}: {
  sample: Pick<SampleRow, 'id' | 'accessionNo' | 'status' | 'patient'> | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onDone?: (recollectionId: string | null) => void
}) {
  const t = useT('collection')
  const e = useEnum()
  const [recollect, setRecollect] = useState(true)
  // Each opening starts from the default (recollection requested).
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setRecollect(true)
  }
  const pending = sample?.status === 'pending_collection'
  const reasons: Reason[] = pending
    ? [...COLLECTION_FAILURE_REASONS]
    : [...REJECTION_REASONS]
  const mutation = useLabMutation(
    (v: { reason: Reason; remarks: string }) =>
      labApi.samples.reject(sample!.id, {
        reason: v.reason,
        recollect,
        ...(v.remarks ? { remarks: v.remarks } : {}),
      }),
    {
      success: () =>
        pending
          ? recollect
            ? t('notCollectedRecollect')
            : t('notCollected')
          : recollect
            ? t('rejectedRecollect')
            : t('rejected'),
      onSuccess: (res) => {
        onOpenChange(false)
        onDone?.(res.recollectionId)
      },
    },
  )
  return (
    <ReasonDialog
      open={open}
      onOpenChange={onOpenChange}
      title={
        pending
          ? t('rejectPendingTitle', { patient: sample?.patient.name ?? '' })
          : t('rejectTitle', { accession: sample?.accessionNo ?? '' })
      }
      description={t('rejectDescription')}
      reasonLabel={t('rejectReason')}
      reasons={reasons.map((r) => ({
        value: r,
        label: e('rejectionReason', r),
      }))}
      confirmLabel={pending ? t('unableToCollect') : t('reject')}
      loading={mutation.isPending}
      onConfirm={(v) => mutation.mutate(v)}
    >
      <Field
        label={t('requestRecollection')}
        hint={t('requestRecollectionHint')}
      >
        <div>
          <Switch
            checked={recollect}
            onCheckedChange={setRecollect}
            label={t('requestRecollection')}
          />
        </div>
      </Field>
    </ReasonDialog>
  )
}
