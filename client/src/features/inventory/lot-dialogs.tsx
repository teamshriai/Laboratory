import { useState } from 'react'
import { useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import { labApi, type LotRow } from '@/services/lab-api'
import { useLabMutation } from '@/services/mutations'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Field } from '@/components/ui/field'
import { Textarea } from '@/components/ui/input'
import { AdjustStockDialog } from './adjust-dialog'
import { TransferDialog } from './transfer-dialog'
import { roundQty, type LotAction } from './stock'

function LotNoteDialog({
  lot,
  mode,
  onClose,
}: {
  lot: LotRow
  mode: 'quarantine' | 'release' | 'dispose'
  onClose: () => void
}) {
  const t = useT('inventory')
  const tc = useT('common')
  const tf = useT('forms')
  const [note, setNote] = useState('')
  const [touched, setTouched] = useState(false)
  const required = mode !== 'release'
  const error = touched && required && !note.trim() ? tf('required') : undefined
  const mutation = useLabMutation(
    (text: string) =>
      mode === 'quarantine'
        ? labApi.inventory.quarantineLot(lot.id, text)
        : mode === 'dispose'
          ? labApi.inventory.disposeLot(lot.id, text)
          : labApi.inventory.releaseLot(lot.id, text),
    {
      success: () =>
        mode === 'quarantine'
          ? t('lotQuarantinedToast', { lot: lot.lotNumber })
          : mode === 'dispose'
            ? t('disposedToast', { lot: lot.lotNumber })
            : t('lotReleasedToast', { lot: lot.lotNumber }),
      onSuccess: onClose,
    },
  )
  return (
    <ConfirmDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={t(`${mode}Title`, { lot: lot.lotNumber })}
      description={t(`${mode}Body`, {
        reagent: lot.reagent.name,
        quantity: `${roundQty(lot.quantity)} ${lot.reagent.unit}`,
      })}
      confirmLabel={t(mode)}
      loading={mutation.isPending}
      onConfirm={() => {
        setTouched(true)
        if (required && !note.trim()) return
        mutation.mutate(note.trim())
      }}
    >
      <Field
        label={t(`${mode}Note`)}
        required={required}
        optionalLabel={required ? undefined : tc('optional')}
        error={error}
      >
        <Textarea
          value={note}
          onChange={(ev) => setNote(ev.target.value)}
          rows={3}
          maxLength={300}
          autoFocus
          placeholder={t(`${mode}Placeholder`)}
        />
      </Field>
    </ConfirmDialog>
  )
}

function ExpireLotDialog({
  lot,
  onClose,
}: {
  lot: LotRow
  onClose: () => void
}) {
  const t = useT('inventory')
  const f = useFormat()
  const mutation = useLabMutation(
    () => labApi.inventory.markLotExpired(lot.id),
    {
      success: () => t('lotExpiredToast', { lot: lot.lotNumber }),
      onSuccess: onClose,
    },
  )
  return (
    <ConfirmDialog
      open
      onOpenChange={(o) => !o && onClose()}
      tone="danger"
      title={t('expireTitle', { lot: lot.lotNumber })}
      description={
        lot.quantity > 0
          ? t('expireBody', {
              quantity: `${f.decimal(roundQty(lot.quantity))} ${lot.reagent.unit}`,
              reagent: lot.reagent.name,
            })
          : t('expireBodyEmpty', { reagent: lot.reagent.name })
      }
      confirmLabel={t('markExpired')}
      loading={mutation.isPending}
      onConfirm={() => mutation.mutate(undefined)}
    />
  )
}

/** Renders the dialog for the lot action in progress, if any. */
export function LotActionDialogs({
  action,
  onClose,
}: {
  action: LotAction | null
  onClose: () => void
}) {
  const t = useT('inventory')
  if (!action) return null
  const { lot } = action
  switch (action.kind) {
    case 'adjust':
      return (
        <AdjustStockDialog
          target={{
            kind: 'lot',
            id: lot.id,
            name: t('lotName', {
              reagent: lot.reagent.name,
              lot: lot.lotNumber,
            }),
            quantity: lot.quantity,
            unit: lot.reagent.unit,
          }}
          onClose={onClose}
        />
      )
    case 'transfer':
      return (
        <TransferDialog
          target={{
            kind: 'lot',
            id: lot.id,
            name: t('lotName', {
              reagent: lot.reagent.name,
              lot: lot.lotNumber,
            }),
            quantity: lot.quantity,
            unit: lot.reagent.unit,
            ...(lot.locationId ? { locationId: lot.locationId } : {}),
          }}
          onClose={onClose}
        />
      )
    case 'quarantine':
    case 'release':
    case 'dispose':
      return (
        <LotNoteDialog
          key={`${action.kind}-${lot.id}`}
          lot={lot}
          mode={action.kind}
          onClose={onClose}
        />
      )
    case 'expire':
      return <ExpireLotDialog lot={lot} onClose={onClose} />
  }
}
