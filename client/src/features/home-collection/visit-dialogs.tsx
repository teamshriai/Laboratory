import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { z } from '@/features/shared/zod'
import type { Staff } from '@/domain/types'
import { useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import { labApi, type HomeVisitRow } from '@/services/lab-api'
import { useLabMutation } from '@/services/mutations'
import { ReasonDialog } from '@/components/lab/reason-dialog'
import { SigningAs } from '@/components/lab/signing-as'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Dialog } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input, Textarea } from '@/components/ui/input'
import { Checkbox, ChoiceCards } from '@/components/ui/toggles'
import { focusInvalid } from '@/lib/form-errors'

export type VisitAction = 'assign' | 'cancel' | 'missed' | 'collected'
export interface VisitTarget {
  action: VisitAction
  visit: HomeVisitRow
}

const CANCEL_REASONS = [
  'patient-request',
  'rebooked',
  'duplicate',
  'no-phlebotomist',
  'other',
] as const
const MISSED_REASONS = [
  'not-home',
  'no-answer',
  'address-not-found',
  'declined',
  'not-fasting',
  'other',
] as const

type UpdateInput = Parameters<typeof labApi.network.updateHomeVisit>[1]

/** The dialog for one action on one visit; unmounts when closed. */
export function VisitDialogs({
  target,
  onClose,
  phlebotomists,
  load,
}: {
  target: VisitTarget | null
  onClose: () => void
  phlebotomists: Staff[]
  /** Visits each phlebotomist already has on the day. */
  load: Map<string, number>
}) {
  if (!target) return null
  const { action, visit } = target
  if (action === 'assign')
    return (
      <AssignDialog
        key={visit.id}
        visit={visit}
        onClose={onClose}
        phlebotomists={phlebotomists}
        load={load}
      />
    )
  if (action === 'collected')
    return <CollectedDialog key={visit.id} visit={visit} onClose={onClose} />
  return (
    <ReasonStep
      key={`${action}-${visit.id}`}
      kind={action}
      visit={visit}
      onClose={onClose}
    />
  )
}

function AssignDialog({
  visit,
  onClose,
  phlebotomists,
  load,
}: {
  visit: HomeVisitRow
  onClose: () => void
  phlebotomists: Staff[]
  load: Map<string, number>
}) {
  const t = useT('homeCollection')
  const f = useFormat()
  const [staffId, setStaffId] = useState(visit.phlebotomistId)
  const assign = useLabMutation(
    (id: string) => labApi.network.assignHomeVisit(visit.id, id),
    {
      success: (_, id) =>
        t('assignedToast', {
          name: phlebotomists.find((p) => p.id === id)?.name ?? '',
        }),
      onSuccess: onClose,
    },
  )
  return (
    <ConfirmDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={visit.phlebotomistId ? t('reassign') : t('assignTitle')}
      description={t('assignDescription', {
        visitNo: visit.visitNo,
        time: f.time(visit.slotStart),
        pin: visit.pinCode,
      })}
      confirmLabel={t('assignConfirm')}
      loading={assign.isPending}
      disabled={!staffId || staffId === visit.phlebotomistId}
      onConfirm={() => staffId && assign.mutate(staffId)}
    >
      <div className="grid gap-4">
        <ChoiceCards
          aria-label={t('colPhlebotomist')}
          columns={2}
          value={staffId}
          onValueChange={setStaffId}
          options={phlebotomists.map((p) => ({
            value: p.id,
            label: p.name,
            description: t('load', { count: load.get(p.id) ?? 0 }),
          }))}
        />
        {phlebotomists.length === 0 ? (
          <p className="text-meta text-fg-muted">{t('noPhlebotomists')}</p>
        ) : null}
        <SigningAs permission="home.dispatch" compact />
      </div>
    </ConfirmDialog>
  )
}

function ReasonStep({
  kind,
  visit,
  onClose,
}: {
  kind: 'cancel' | 'missed'
  visit: HomeVisitRow
  onClose: () => void
}) {
  const t = useT('homeCollection')
  const update = useLabMutation(
    (input: UpdateInput) => labApi.network.updateHomeVisit(visit.id, input),
    {
      success: () =>
        kind === 'cancel' ? t('cancelledToast') : t('missedToast'),
      onSuccess: onClose,
    },
  )
  const params = { visitNo: visit.visitNo, name: visit.patient.name }
  const reasons =
    kind === 'cancel'
      ? CANCEL_REASONS.map((r) => ({
          value: r,
          label: t(`cancelReason.${r}`),
        }))
      : MISSED_REASONS.map((r) => ({
          value: r,
          label: t(`missedReason.${r}`),
        }))
  return (
    <ReasonDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={kind === 'cancel' ? t('cancelTitle') : t('missedTitle')}
      description={
        kind === 'cancel'
          ? t('cancelDescription', params)
          : t('missedDescription', params)
      }
      reasonLabel={
        kind === 'cancel' ? t('cancelReasonLabel') : t('missedReasonLabel')
      }
      reasons={reasons}
      confirmLabel={kind === 'cancel' ? t('cancelVisit') : t('missedConfirm')}
      tone={kind === 'cancel' ? 'danger' : 'primary'}
      loading={update.isPending}
      onConfirm={({ reason, remarks }) => {
        // The visit keeps the reason as written, in the user's words.
        const label = reasons.find((r) => r.value === reason)?.label ?? reason
        update.mutate({
          state: kind === 'cancel' ? 'cancelled' : 'missed',
          reason: remarks ? `${label}: ${remarks}` : label,
        })
      }}
    />
  )
}

const collectedSchema = z.object({
  coldChain: z.boolean(),
  receivedBy: z
    .string()
    .trim()
    .min(1, 'forms.required')
    .max(80, 'forms.tooLong'),
  note: z.string().max(300, 'forms.tooLong'),
})
type CollectedIn = z.input<typeof collectedSchema>
type CollectedOut = z.output<typeof collectedSchema>

function CollectedDialog({
  visit,
  onClose,
}: {
  visit: HomeVisitRow
  onClose: () => void
}) {
  const t = useT('homeCollection')
  const tc = useT('common')
  const { control, register, handleSubmit, formState } = useForm<
    CollectedIn,
    unknown,
    CollectedOut
  >({
    resolver: zodResolver(collectedSchema),
    defaultValues: { coldChain: false, receivedBy: '', note: '' },
  })
  const update = useLabMutation(
    (v: CollectedOut) =>
      labApi.network.updateHomeVisit(visit.id, {
        state: 'collected',
        proof: {
          coldChain: v.coldChain,
          receivedBy: v.receivedBy,
          ...(v.note.trim() ? { note: v.note.trim() } : {}),
        },
      }),
    { success: () => t('collectedToast'), onSuccess: onClose },
  )
  const submit = () =>
    void handleSubmit((v) => update.mutate(v), focusInvalid)()
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      dirty={formState.isDirty}
      title={t('collectedTitle')}
      description={t('collectedDescription', {
        visitNo: visit.visitNo,
        name: visit.patient.name,
      })}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {tc('cancel')}
          </Button>
          <Button variant="primary" loading={update.isPending} onClick={submit}>
            {t('collectedConfirm')}
          </Button>
        </>
      }
    >
      <form
        noValidate
        className="grid gap-4"
        onSubmit={(ev) => {
          ev.preventDefault()
          submit()
        }}
      >
        <Controller
          control={control}
          name="coldChain"
          render={({ field }) => (
            <div className="flex items-start gap-3 rounded-lg border border-line bg-surface-2 p-3.5">
              <Checkbox
                id="hv-cold-chain"
                checked={field.value}
                onCheckedChange={field.onChange}
                className="mt-0.5"
              />
              <label htmlFor="hv-cold-chain" className="min-w-0 cursor-pointer">
                <span className="block text-sm font-medium text-fg">
                  {t('coldChainLabel')}
                </span>
                <span className="mt-0.5 block text-xs text-fg-muted">
                  {t('coldChainHint')}
                </span>
              </label>
            </div>
          )}
        />
        <Field
          label={t('receivedByLabel')}
          hint={t('receivedByHint')}
          required
          error={formState.errors.receivedBy?.message}
        >
          <Input
            autoComplete="off"
            maxLength={80}
            {...register('receivedBy')}
          />
        </Field>
        <Field
          label={t('noteLabel')}
          optionalLabel={tc('optional')}
          error={formState.errors.note?.message}
        >
          <Textarea rows={2} maxLength={300} {...register('note')} />
        </Field>
        <SigningAs permission="specimen.collect" compact />
      </form>
    </Dialog>
  )
}
