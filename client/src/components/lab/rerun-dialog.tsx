import { useState } from 'react'
import { useT } from '@/i18n/context'
import { labApi } from '@/services/lab-api'
import { useLabMutation } from '@/services/mutations'
import { ConfirmDialog } from '../ui/confirm-dialog'
import { Field } from '../ui/field'
import { Textarea } from '../ui/input'
import { Select } from '../ui/select'
import { SigningAs } from './signing-as'

const DILUTIONS = ['none', '2', '5', '10', '20', '50', '100'] as const
type Dilution = (typeof DILUTIONS)[number]

/**
 * Repeat analysis of a test on the same specimen. The first value stays on
 * record and is shown beside the repeat at verification.
 */
export function RerunDialog({
  item,
  open,
  onOpenChange,
  onDone,
}: {
  item: { itemId: string; name: string } | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onDone?: (itemId: string) => void
}) {
  const t = useT('results')
  const tf = useT('forms')
  const [reason, setReason] = useState('')
  const [dilution, setDilution] = useState<Dilution>('none')
  const [touched, setTouched] = useState(false)
  const reset = () => {
    setReason('')
    setDilution('none')
    setTouched(false)
  }
  const rerun = useLabMutation(
    () =>
      labApi.results.rerun(item!.itemId, {
        reason: reason.trim(),
        ...(dilution !== 'none' ? { dilution: Number(dilution) } : {}),
      }),
    {
      success: () => t('rerunRequested', { test: item?.name ?? '' }),
      onSuccess: () => {
        if (item) onDone?.(item.itemId)
        onOpenChange(false)
        reset()
      },
    },
  )
  const error = touched && !reason.trim() ? tf('reasonRequired') : undefined
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o)
        if (!o) reset()
      }}
      title={t('rerunTitle', { test: item?.name ?? '' })}
      description={t('rerunBody')}
      confirmLabel={t('rerunConfirm')}
      loading={rerun.isPending}
      onConfirm={() => {
        setTouched(true)
        if (reason.trim()) rerun.mutate()
      }}
    >
      <div className="grid gap-4">
        <Field label={t('rerunReason')} required error={error}>
          <Textarea
            value={reason}
            onChange={(ev) => setReason(ev.target.value)}
            placeholder={t('rerunReasonPlaceholder')}
            rows={3}
          />
        </Field>
        <Field label={t('rerunDilution')} hint={t('rerunDilutionHint')}>
          <Select
            value={dilution}
            onValueChange={setDilution}
            options={DILUTIONS.map((d) => ({
              value: d,
              label:
                d === 'none' ? t('rerunNoDilution') : t('dilutionOf', { n: d }),
            }))}
          />
        </Field>
        <SigningAs permission="result.rerun" />
      </div>
    </ConfirmDialog>
  )
}
