import { useState, type ReactNode } from 'react'
import { useT } from '@/i18n/context'
import { ConfirmDialog } from '../ui/confirm-dialog'
import { Field } from '../ui/field'
import { Textarea } from '../ui/input'
import { Select, type SelectOption } from '../ui/select'

/** Confirmation that requires a reason (and remarks when the reason is "other"). */
export function ReasonDialog<R extends string>({
  open,
  onOpenChange,
  title,
  description,
  reasonLabel,
  reasons,
  confirmLabel,
  tone = 'danger',
  loading,
  onConfirm,
  remarksLabel,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  reasonLabel: string
  reasons: SelectOption<R>[]
  confirmLabel: string
  tone?: 'danger' | 'primary'
  loading?: boolean
  onConfirm: (value: { reason: R; remarks: string }) => void
  remarksLabel?: string
  children?: ReactNode
}) {
  const tc = useT('common')
  const tf = useT('forms')
  const [reason, setReason] = useState<R | undefined>()
  const [remarks, setRemarks] = useState('')
  const [touched, setTouched] = useState(false)
  // Every opening starts empty: a reason never carries over to the next
  // patient or specimen, even when the parent closed the dialog itself.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setReason(undefined)
      setRemarks('')
      setTouched(false)
    }
  }
  const needsRemarks = reason === ('other' as R) && !remarks.trim()
  const error = touched && !reason ? tf('reasonRequired') : undefined
  const remarksError =
    touched && needsRemarks ? tf('remarksRequired') : undefined
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      dirty={Boolean(reason || remarks.trim())}
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      tone={tone}
      loading={loading}
      onConfirm={() => {
        setTouched(true)
        if (!reason || needsRemarks) return
        onConfirm({ reason, remarks: remarks.trim() })
      }}
    >
      <div className="grid gap-4">
        {children}
        <Field label={reasonLabel} required error={error}>
          <Select
            value={reason}
            onValueChange={setReason}
            options={reasons}
            placeholder={tc('selectPlaceholder')}
          />
        </Field>
        <Field
          label={remarksLabel ?? tc('remarks')}
          optionalLabel={reason === ('other' as R) ? undefined : tc('optional')}
          required={reason === ('other' as R)}
          error={remarksError}
        >
          <Textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            rows={3}
            maxLength={500}
          />
        </Field>
      </div>
    </ConfirmDialog>
  )
}
