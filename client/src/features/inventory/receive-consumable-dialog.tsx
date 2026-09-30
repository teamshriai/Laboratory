import { PackageIcon } from 'lucide-react'
import { useState } from 'react'
import { DAY, istDay } from '@/domain/time'
import { useNow } from '@/hooks/use-now'
import { useEnum, useT } from '@/i18n/context'
import { labApi } from '@/services/lab-api'
import { useLabMutation } from '@/services/mutations'
import { useConsumables } from '@/services/queries'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import { Dialog } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input, Textarea } from '@/components/ui/input'
import { dateInputToMs } from './stock'

export function ReceiveConsumableDialog({
  defaultId,
  onClose,
}: {
  defaultId?: string | undefined
  onClose: () => void
}) {
  const t = useT('inventory')
  const tc = useT('common')
  const tf = useT('forms')
  const e = useEnum()
  const now = useNow()
  const { data: items } = useConsumables({})
  const [id, setId] = useState(defaultId ?? '')
  const [qty, setQty] = useState('')
  const [expiry, setExpiry] = useState('')
  const [note, setNote] = useState('')
  const [touched, setTouched] = useState(false)
  const item = items?.find((c) => c.id === id)
  const amount = Number(qty)
  const qtyError =
    !Number.isFinite(amount) || amount <= 0 ? tf('positive') : undefined
  const expiryError =
    expiry && expiry <= istDay(now) ? tf('pastDate') : undefined
  const receive = useLabMutation(
    () =>
      labApi.inventory.receiveConsumable(id, {
        quantity: amount,
        ...(expiry ? { expiresAt: dateInputToMs(expiry) } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      }),
    {
      success: () =>
        t('consumableReceivedToast', {
          quantity: `${amount} ${item?.unit ?? ''}`,
          name: item?.name ?? '',
        }),
      onSuccess: onClose,
    },
  )
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={t('receive')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {tc('cancel')}
          </Button>
          <Button
            variant="primary"
            loading={receive.isPending}
            onClick={() => {
              setTouched(true)
              if (!id || qtyError || expiryError) return
              receive.mutate()
            }}
          >
            <PackageIcon />
            {t('receiveConfirm')}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={t('colItem')}
          required
          error={touched && !id ? tf('selectOne') : undefined}
          className="sm:col-span-2"
        >
          <Combobox
            value={id || undefined}
            onValueChange={setId}
            placeholder={t('colItem')}
            searchPlaceholder={t('consumablesSearch')}
            emptyText={t('emptyItems')}
            options={(items ?? [])
              .toSorted((a, b) => a.name.localeCompare(b.name))
              .map((c) => ({
                value: c.id,
                label: c.name,
                description: `${c.sku ?? ''} · ${c.quantity} ${c.unit} · ${c.location}`,
                group: e('consumableCategory', c.category),
              }))}
          />
        </Field>
        <Field
          label={item ? t('quantityIn', { unit: item.unit }) : t('quantity')}
          required
          error={touched ? qtyError : undefined}
        >
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            value={qty}
            onChange={(ev) => setQty(ev.target.value)}
            className="tabular-nums"
          />
        </Field>
        <Field
          label={t('expiryDate')}
          optionalLabel={tc('optional')}
          error={expiryError}
        >
          <Input
            type="date"
            min={istDay(now + DAY)}
            value={expiry}
            onChange={(ev) => setExpiry(ev.target.value)}
          />
        </Field>
        <Field
          label={t('note')}
          optionalLabel={tc('optional')}
          className="sm:col-span-2"
        >
          <Textarea
            rows={2}
            value={note}
            onChange={(ev) => setNote(ev.target.value)}
            maxLength={300}
            placeholder={t('receiveNotePlaceholder')}
          />
        </Field>
      </div>
    </Dialog>
  )
}
