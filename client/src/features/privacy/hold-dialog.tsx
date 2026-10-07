import { useState } from 'react'
import type { LegalHold } from '@/domain/types'
import { useT } from '@/i18n/context'
import { labApi } from '@/services/lab-api'
import { useLabMutation } from '@/services/mutations'
import { SigningAs } from '@/components/lab/signing-as'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { FormErrorSummary } from '@/components/ui/form-errors'
import { Textarea } from '@/components/ui/input'
import { Segmented } from '@/components/ui/toggles'
import { focusFirstInvalid } from '@/lib/focus'
import { PatientPicker, ReportPicker, type Picked } from './pickers'

type Entity = LegalHold['entity']
const ENTITIES = ['patient', 'report'] as const satisfies readonly Entity[]

/** Keeps a patient's or a report's records from deletion. */
export function PlaceHoldDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  if (!open) return null
  return <HoldForm onClose={() => onOpenChange(false)} />
}

function HoldForm({ onClose }: { onClose: () => void }) {
  const t = useT('privacy')
  const tc = useT('common')
  const tf = useT('forms')
  const [entity, setEntity] = useState<Entity>('patient')
  const [record, setRecord] = useState<Picked | null>(null)
  const [reason, setReason] = useState('')
  const [tried, setTried] = useState(false)
  const place = useLabMutation(
    (v: { entity: Entity; entityId: string; reason: string }) =>
      labApi.privacy.placeHold(v),
    { success: () => t('holdPlaced'), onSuccess: onClose },
  )
  const recordError = tried && !record ? tf('required') : undefined
  const reasonError = tried && !reason.trim() ? tf('required') : undefined
  const errorCount = Number(Boolean(recordError)) + Number(Boolean(reasonError))
  const submit = () => {
    setTried(true)
    if (!record || !reason.trim()) {
      window.setTimeout(() => focusFirstInvalid(), 0)
      return
    }
    place.mutate({ entity, entityId: record.id, reason: reason.trim() })
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      dirty={record !== null || reason.trim() !== ''}
      size="lg"
      title={t('placeHoldTitle')}
      description={t('placeHoldDescription')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {tc('cancel')}
          </Button>
          <Button variant="primary" loading={place.isPending} onClick={submit}>
            {t('placeHold')}
          </Button>
        </>
      }
    >
      <form
        noValidate
        aria-busy={place.isPending}
        className="grid gap-4"
        onSubmit={(ev) => {
          ev.preventDefault()
          submit()
        }}
      >
        {tried ? (
          <FormErrorSummary
            count={errorCount}
            onFocusFirst={() => focusFirstInvalid()}
          />
        ) : null}
        <div className="grid gap-1.5">
          <span className="text-sm font-medium text-fg-muted">
            {t('holdOn')}
          </span>
          <Segmented
            aria-label={t('holdOn')}
            value={entity}
            onValueChange={(v) => {
              setEntity(v)
              setRecord(null)
            }}
            options={ENTITIES.map((v) => ({
              value: v,
              label: t(`entity.${v}`),
            }))}
          />
        </div>
        <Field
          label={entity === 'patient' ? t('fieldPatient') : t('fieldReport')}
          required
          error={recordError}
        >
          <div>
            {entity === 'patient' ? (
              <PatientPicker
                value={record}
                onChange={setRecord}
                invalid={Boolean(recordError)}
              />
            ) : (
              <ReportPicker
                value={record}
                onChange={setRecord}
                invalid={Boolean(recordError)}
              />
            )}
          </div>
        </Field>
        <Field
          label={t('fieldHoldReason')}
          hint={t('holdReasonHint')}
          required
          error={reasonError}
        >
          <Textarea
            rows={3}
            maxLength={2000}
            value={reason}
            onChange={(ev) => setReason(ev.target.value)}
          />
        </Field>
        <SigningAs permission="privacy.manage" compact />
      </form>
    </Dialog>
  )
}
