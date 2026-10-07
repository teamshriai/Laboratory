import { zodResolver } from '@hookform/resolvers/zod'
import { MapPinIcon, PencilIcon, UserSearchIcon } from 'lucide-react'
import { useDeferredValue, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { z } from '@/features/shared/zod'
import { DAY, MINUTE, istDay } from '@/domain/time'
import { useNow } from '@/hooks/use-now'
import { useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import { labApi, type BookVisitInput } from '@/services/lab-api'
import { useLabMutation } from '@/services/mutations'
import { usePatient, usePatients } from '@/services/queries'
import { PatientCell } from '@/components/lab/patient'
import { SigningAs } from '@/components/lab/signing-as'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { FormErrorSummary } from '@/components/ui/form-errors'
import { Input, SearchInput, Textarea } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/states'
import { focusFirstInvalid } from '@/lib/focus'
import { countFieldErrors, focusInvalid } from '@/lib/form-errors'
import { slotAt } from './day'

/** Half-hour slots from 06:00 to 20:00 (IST). */
const TIMES = Array.from({ length: 29 }, (_, i) => {
  const minutes = 6 * 60 + i * 30
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
})
const DURATIONS = ['30', '45', '60', '90', '120'] as const
const NO_ORDER = 'none'

/** Matches the engine: not in the past, at most 30 days ahead. */
const slotAllowed = (at: number) => {
  const now = Date.now()
  return at >= now - 5 * MINUTE && at <= now + 30 * DAY
}

const schema = z
  .object({
    patientId: z.string().min(1, 'forms.required'),
    orderId: z.string(),
    address: z
      .string()
      .trim()
      .min(1, 'forms.required')
      .max(300, 'forms.tooLong'),
    pinCode: z
      .string()
      .trim()
      .regex(/^[1-9]\d{5}$/, 'errors.invalid-pin'),
    landmark: z.string().trim().max(120, 'forms.tooLong'),
    date: z.string().min(1, 'forms.required'),
    time: z.string().min(1, 'forms.required'),
    duration: z.enum(DURATIONS),
    notes: z.string().trim().max(300, 'forms.tooLong'),
  })
  .refine((v) => !v.date || !v.time || slotAllowed(slotAt(v.date, v.time)), {
    path: ['time'],
    message: 'errors.slot-invalid',
  })
type FormIn = z.input<typeof schema>
type FormOut = z.output<typeof schema>

export function BookVisitDialog({
  open,
  onOpenChange,
  defaultDay,
  onBooked,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The day on screen, if it can still be booked. */
  defaultDay: string
  /** Called after booking; closes the dialog. */
  onBooked: (day: string) => void
}) {
  if (!open) return null
  return (
    <BookForm
      defaultDay={defaultDay}
      onClose={() => onOpenChange(false)}
      onBooked={onBooked}
    />
  )
}

function BookForm({
  defaultDay,
  onClose,
  onBooked,
}: {
  defaultDay: string
  onClose: () => void
  onBooked: (day: string) => void
}) {
  const t = useT('homeCollection')
  const tc = useT('common')
  const f = useFormat()
  const now = useNow()
  const [opened] = useState(now)
  const minDay = istDay(opened)
  const maxDay = istDay(opened + 30 * DAY)
  const {
    control,
    register,
    handleSubmit,
    setValue,
    formState: { errors, isDirty, submitCount },
  } = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(schema),
    defaultValues: {
      patientId: '',
      orderId: NO_ORDER,
      address: '',
      pinCode: '',
      landmark: '',
      date: defaultDay < minDay ? minDay : defaultDay,
      time: '',
      duration: '60',
      notes: '',
    },
  })
  const [patientId, pinCode, date] = useWatch({
    control,
    name: ['patientId', 'pinCode', 'date'],
  })
  const { data: patient } = usePatient(patientId || undefined)
  const registeredPin = patient?.patient.pinCode
  const orders = (patient?.orders ?? []).filter(
    (o) =>
      o.orderNo &&
      o.status !== 'completed' &&
      o.status !== 'cancelled' &&
      o.status !== 'draft',
  )

  const book = useLabMutation(
    (v: FormOut) => {
      const input: BookVisitInput = {
        patientId: v.patientId,
        ...(v.orderId !== NO_ORDER ? { orderId: v.orderId } : {}),
        address: v.address,
        pinCode: v.pinCode,
        ...(v.landmark ? { landmark: v.landmark } : {}),
        slotStart: slotAt(v.date, v.time),
        slotMinutes: Number(v.duration),
        ...(v.notes ? { notes: v.notes } : {}),
      }
      return labApi.network.bookHomeVisit(input)
    },
    {
      success: (_, v) => ({
        title: t('booked'),
        description: t('bookedBody', {
          date: f.date(slotAt(v.date, v.time)),
          time: f.time(slotAt(v.date, v.time)),
        }),
      }),
      // The page closes the dialog and shows the booked day in one URL change.
      onSuccess: (_, v) => onBooked(v.date),
    },
  )
  const submit = () => void handleSubmit((v) => book.mutate(v), focusInvalid)()

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      dirty={isDirty}
      size="lg"
      title={t('bookTitle')}
      description={t('bookDescription')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {tc('cancel')}
          </Button>
          <Button variant="primary" loading={book.isPending} onClick={submit}>
            {t('bookConfirm')}
          </Button>
        </>
      }
    >
      <form
        noValidate
        aria-busy={book.isPending}
        // Fields in a row keep their controls level when one shows an error.
        className="grid gap-4 sm:grid-cols-2 [&>*]:content-start"
        onSubmit={(ev) => {
          ev.preventDefault()
          submit()
        }}
      >
        {submitCount ? (
          <div className="sm:col-span-2">
            <FormErrorSummary
              count={countFieldErrors(errors)}
              onFocusFirst={() => focusFirstInvalid()}
            />
          </div>
        ) : null}
        <Field
          label={t('fieldPatient')}
          required
          error={errors.patientId?.message}
          className="sm:col-span-2"
        >
          <div>
            <PatientPicker
              value={patientId}
              invalid={Boolean(errors.patientId)}
              onChange={(id) => {
                setValue('patientId', id, {
                  shouldDirty: true,
                  shouldValidate: submitCount > 0,
                })
                setValue('orderId', NO_ORDER, { shouldDirty: true })
              }}
            />
          </div>
        </Field>
        <Field
          label={t('fieldOrder')}
          optionalLabel={tc('optional')}
          hint={t('orderHint')}
          className="sm:col-span-2"
        >
          <Controller
            control={control}
            name="orderId"
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={field.onChange}
                disabled={!patientId}
                options={[
                  { value: NO_ORDER, label: t('noOrder') },
                  ...orders.map((o) => ({
                    value: o.id,
                    label: o.orderNo ?? '',
                    description: f.dateTime(o.orderedAt ?? o.createdAt),
                  })),
                ]}
              />
            )}
          />
        </Field>
        <Field
          label={t('fieldAddress')}
          hint={t('addressHint')}
          required
          error={errors.address?.message}
          className="sm:col-span-2"
        >
          <Textarea
            rows={2}
            maxLength={300}
            autoComplete="street-address"
            {...register('address')}
          />
        </Field>
        <Field
          label={t('fieldPin')}
          hint={t('pinHint')}
          required
          error={errors.pinCode?.message}
        >
          <Input
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={6}
            {...register('pinCode')}
          />
        </Field>
        <Field
          label={t('fieldLandmark')}
          optionalLabel={tc('optional')}
          error={errors.landmark?.message}
        >
          <Input maxLength={120} {...register('landmark')} />
        </Field>
        {registeredPin && registeredPin !== pinCode.trim() ? (
          <div className="-mt-2 sm:col-span-2">
            <Button
              variant="link"
              size="sm"
              className="min-h-11"
              onClick={() =>
                setValue('pinCode', registeredPin, {
                  shouldDirty: true,
                  shouldValidate: submitCount > 0,
                })
              }
            >
              <MapPinIcon />
              {t('usePatientPin', { pin: registeredPin })}
            </Button>
          </div>
        ) : null}
        <Field label={t('fieldDate')} required error={errors.date?.message}>
          <Input type="date" min={minDay} max={maxDay} {...register('date')} />
        </Field>
        <Field label={t('fieldTime')} required error={errors.time?.message}>
          <Controller
            control={control}
            name="time"
            render={({ field }) => (
              <Select
                value={field.value || undefined}
                onValueChange={field.onChange}
                placeholder={tc('selectPlaceholder')}
                options={TIMES.map((hhmm) => ({
                  value: hhmm,
                  label: f.time(slotAt(date || minDay, hhmm)),
                }))}
              />
            )}
          />
        </Field>
        <Field label={t('fieldDuration')} required>
          <Controller
            control={control}
            name="duration"
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={field.onChange}
                options={DURATIONS.map((d) => ({
                  value: d,
                  label: f.duration(Number(d) * MINUTE),
                }))}
              />
            )}
          />
        </Field>
        <Field
          label={t('fieldNotes')}
          optionalLabel={tc('optional')}
          error={errors.notes?.message}
          className="sm:col-span-2"
        >
          <Textarea rows={2} maxLength={300} {...register('notes')} />
        </Field>
        <div className="sm:col-span-2">
          <SigningAs permission="home.book" compact />
        </div>
      </form>
    </Dialog>
  )
}

function PatientPicker({
  value,
  onChange,
  invalid,
}: {
  value: string
  onChange: (id: string) => void
  invalid: boolean
}) {
  const t = useT('homeCollection')
  const [query, setQuery] = useState('')
  const q = useDeferredValue(query.trim())
  const enabled = q.length >= 2
  const { data, isFetching, isError, refetch } = usePatients(
    enabled ? { q, pageSize: 8 } : { q: '__none__', pageSize: 1 },
  )
  const [changing, setChanging] = useState(!value)
  if (value && !changing)
    return <SelectedPatient id={value} onChange={() => setChanging(true)} />
  const rows = enabled ? (data?.rows ?? []) : []
  return (
    <div className="grid gap-2">
      <SearchInput
        value={query}
        onValueChange={setQuery}
        placeholder={t('patientSearchPlaceholder')}
        aria-label={t('patientSearch')}
        aria-invalid={invalid || undefined}
      />
      {!enabled ? (
        // The field's error replaces the hint.
        invalid ? null : (
          <p className="text-xs text-fg-subtle">{t('patientSearchHint')}</p>
        )
      ) : isError ? (
        <ErrorState compact onRetry={() => void refetch()} />
      ) : rows.length === 0 && isFetching ? (
        <Skeleton className="h-14 rounded-xl" />
      ) : rows.length === 0 ? (
        <p className="flex items-center gap-2 text-meta text-fg-muted">
          <UserSearchIcon className="size-4 shrink-0" aria-hidden />
          {t('noPatientsFound')}
        </p>
      ) : (
        <ul className="grid max-h-64 gap-1.5 overflow-y-auto">
          {rows.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => {
                  onChange(p.id)
                  setChanging(false)
                }}
                className="focus-ring flex min-h-11 w-full items-center gap-3 rounded-lg border border-line p-2.5 text-left transition-colors hover:border-accent/40 hover:bg-accent-soft/30"
              >
                <PatientCell
                  patient={p}
                  link={false}
                  size="sm"
                  className="flex-1"
                />
                <span className="shrink-0 font-mono text-xs text-fg-muted tabular-nums">
                  {p.mobile}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function SelectedPatient({
  id,
  onChange,
}: {
  id: string
  onChange: () => void
}) {
  const t = useT('homeCollection')
  const { data, isError, refetch } = usePatient(id)
  if (isError && !data)
    return <ErrorState compact onRetry={() => void refetch()} />
  if (!data) return <Skeleton className="h-16 rounded-xl" />
  const p = data.patient
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-accent/40 bg-accent-soft/40 p-3">
      <PatientCell patient={p} link={false} className="min-w-48 flex-1" />
      <span className="text-xs text-fg-muted">
        <span className="font-mono tabular-nums">{p.mobile}</span>
        {p.city ? ` · ${p.city}` : ''}
        {p.pinCode ? ` · ${t('pin', { pin: p.pinCode })}` : ''}
      </span>
      <Button size="sm" variant="secondary" onClick={onChange}>
        <PencilIcon />
        {t('changePatient')}
      </Button>
    </div>
  )
}
