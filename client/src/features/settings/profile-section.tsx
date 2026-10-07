import { zodResolver } from '@hookform/resolvers/zod'
import {
  CircleCheckIcon,
  CircleHelpIcon,
  OctagonAlertIcon,
  TriangleAlertIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { z } from '@/features/shared/zod'
import { renewalState, RENEWAL_WINDOW_DAYS } from '@/domain/quality'
import { DAY } from '@/domain/time'
import type { LabSettings, QualityTargets } from '@/domain/types'
import { useNow } from '@/hooks/use-now'
import { useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import { cn } from '@/lib/cn'
import { fromDateInput, toDateInput } from '@/lib/date-input'
import { focusFirstInvalid } from '@/lib/focus'
import { countFieldErrors, focusInvalid } from '@/lib/form-errors'
import { useLabSettings } from '@/services/queries'
import { Field } from '@/components/ui/field'
import { FormErrorSummary } from '@/components/ui/form-errors'
import { Input, Textarea } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/states'
import { ReadOnlyNote, SaveBar } from './section-parts'
import { useReportDirty } from './settings-dirty'
import {
  decimalNumber,
  useCanEditSettings,
  useSaveSettings,
  useSettingsMessage,
  wholeNumber,
} from './settings-forms'

const TARGETS = [
  'rejectionPct',
  'tatWithinPct',
  'criticalOnTimePct',
  'amendedPct',
  'eqaAcceptablePct',
] as const satisfies readonly (keyof QualityTargets)[]

const DATE = /^\d{4}-\d{2}-\d{2}$/
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const PHONE = /^\+?[\d][\d\s-]{6,19}$/

const date = z.string().regex(DATE, 'forms.invalidDate')
const percent = z
  .string()
  .trim()
  .min(1, 'forms.required')
  .refine((v) => {
    const n = decimalNumber(v)
    return n >= 0 && n <= 100
  }, 'settings.percentRange')
const text = (max: number) =>
  z.string().trim().min(1, 'forms.required').max(max, 'forms.invalid')

const schema = z
  .object({
    registrationNo: text(60),
    registrationAuthority: text(120),
    registrationValidFrom: date,
    registrationValidTo: date,
    nablCertificateNo: z.string().trim().max(40, 'forms.invalid'),
    nablScope: z.string().trim().max(400, 'forms.invalid'),
    nablValidTo: z.union([z.literal(''), date]),
    officerName: text(80),
    officerEmail: z
      .string()
      .trim()
      .min(1, 'forms.required')
      .regex(EMAIL, 'forms.invalidEmail'),
    officerPhone: z
      .string()
      .trim()
      .min(1, 'forms.required')
      .regex(PHONE, 'settings.phoneFormat'),
    dataRequestDays: z.string().refine((v) => {
      const n = wholeNumber(v)
      return n >= 1 && n <= 90
    }, 'settings.dataRequestDaysRange'),
    rejectionPct: percent,
    tatWithinPct: percent,
    criticalOnTimePct: percent,
    amendedPct: percent,
    eqaAcceptablePct: percent,
  })
  .refine((v) => v.registrationValidTo > v.registrationValidFrom, {
    path: ['registrationValidTo'],
    message: 'settings.validToOrder',
  })

type FormIn = z.input<typeof schema>
type FormOut = z.output<typeof schema>

const dateValue = (ms: number | undefined) => (ms ? toDateInput(ms) : '')

function defaults(s: LabSettings): FormIn {
  const p = s.profile
  return {
    registrationNo: p.registrationNo,
    registrationAuthority: p.registrationAuthority,
    registrationValidFrom: dateValue(p.registrationValidFrom),
    registrationValidTo: dateValue(p.registrationValidTo),
    nablCertificateNo: p.nablCertificateNo ?? '',
    nablScope: p.nablScope ?? '',
    nablValidTo: dateValue(p.nablValidTo),
    officerName: p.grievanceOfficer.name,
    officerEmail: p.grievanceOfficer.email,
    officerPhone: p.grievanceOfficer.phone,
    dataRequestDays: String(s.dataRequestDays),
    rejectionPct: String(s.qualityTargets.rejectionPct),
    tatWithinPct: String(s.qualityTargets.tatWithinPct),
    criticalOnTimePct: String(s.qualityTargets.criticalOnTimePct),
    amendedPct: String(s.qualityTargets.amendedPct),
    eqaAcceptablePct: String(s.qualityTargets.eqaAcceptablePct),
  }
}

function toPatch(v: FormOut): Partial<LabSettings> {
  return {
    profile: {
      registrationNo: v.registrationNo,
      registrationAuthority: v.registrationAuthority,
      registrationValidFrom: fromDateInput(v.registrationValidFrom),
      registrationValidTo: fromDateInput(v.registrationValidTo),
      ...(v.nablCertificateNo
        ? { nablCertificateNo: v.nablCertificateNo }
        : {}),
      ...(v.nablScope ? { nablScope: v.nablScope } : {}),
      ...(v.nablValidTo ? { nablValidTo: fromDateInput(v.nablValidTo) } : {}),
      grievanceOfficer: {
        name: v.officerName,
        email: v.officerEmail,
        phone: v.officerPhone,
      },
    },
    dataRequestDays: wholeNumber(v.dataRequestDays),
    qualityTargets: Object.fromEntries(
      TARGETS.map((k) => [k, decimalNumber(v[k])]),
    ) as unknown as QualityTargets,
  }
}

const RENEWAL_STYLE = {
  valid: {
    icon: CircleCheckIcon,
    className: 'border-success-text/25 bg-success-soft text-success-text',
  },
  'renew-now': {
    icon: TriangleAlertIcon,
    className: 'border-warning-text/25 bg-warning-soft text-warning-text',
  },
  expired: {
    icon: OctagonAlertIcon,
    className: 'border-danger-text/25 bg-danger-soft text-danger-text',
  },
  unknown: {
    icon: CircleHelpIcon,
    className: 'border-line bg-surface-2 text-fg-muted',
  },
} as const

/** Valid, renew now (90 days before expiry) or expired, in words. */
function RenewalBanner({
  validTo,
  what,
}: {
  validTo: string
  what: 'registration' | 'nabl'
}) {
  const t = useT('settings')
  const f = useFormat()
  const now = useNow()
  const ms = DATE.test(validTo) ? fromDateInput(validTo) : 0
  const state = renewalState(ms, now)
  const style = RENEWAL_STYLE[state]
  const Icon = style.icon
  const days = Math.ceil(Math.abs(ms - now) / DAY)
  const params = {
    date: ms ? f.date(ms) : '',
    days,
    window: RENEWAL_WINDOW_DAYS,
  }
  return (
    <div
      role="status"
      className={cn(
        'flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-meta',
        style.className,
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <p>
        <span className="block font-semibold">
          {t(`renewal.${state}`)}
          {' - '}
          {t(`renewal.${what}`)}
        </span>
        {t(`renewal.${state}.body`, params)}
      </p>
    </div>
  )
}

function Group({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: ReactNode
}) {
  return (
    <fieldset className="grid min-w-0 gap-4 sm:grid-cols-2">
      <legend className="mb-1 text-sm font-semibold text-fg sm:col-span-2">
        {title}
        {hint ? (
          <span className="mt-0.5 block text-xs font-normal text-fg-muted">
            {hint}
          </span>
        ) : null}
      </legend>
      {children}
    </fieldset>
  )
}

function ProfileForm({ initial }: { initial: LabSettings }) {
  const t = useT('settings')
  const tc = useT('common')
  const msg = useSettingsMessage()
  const canEdit = useCanEditSettings()
  const form = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(schema),
    defaultValues: defaults(initial),
  })
  const { register, control, handleSubmit, formState } = form
  const dirty = formState.isDirty && !formState.isSubmitSuccessful
  useReportDirty('profile', dirty)
  const registrationValidTo = useWatch({ control, name: 'registrationValidTo' })
  const nablValidTo = useWatch({ control, name: 'nablValidTo' })
  const save = useSaveSettings(() => t('profileSaved'))
  const submit = (v: FormOut) => save.mutate(toPatch(v))
  const err = (name: keyof FormIn) => msg(formState.errors[name]?.message)
  const errorCount = formState.submitCount
    ? countFieldErrors(formState.errors)
    : 0

  return (
    <form
      noValidate
      onSubmit={(ev) => void handleSubmit(submit, focusInvalid)(ev)}
    >
      <ReadOnlyNote />
      <FormErrorSummary
        count={errorCount}
        onFocusFirst={() => focusFirstInvalid()}
      />
      <fieldset disabled={!canEdit} className="mt-1 grid min-w-0 gap-8">
        <Group title={t('profile.registration')}>
          <div className="sm:col-span-2">
            <RenewalBanner validTo={registrationValidTo} what="registration" />
          </div>
          <Field
            label={t('profile.registrationNo')}
            required
            error={err('registrationNo')}
          >
            <Input
              {...register('registrationNo')}
              maxLength={60}
              autoComplete="off"
            />
          </Field>
          <Field
            label={t('profile.authority')}
            hint={t('profile.authorityHint')}
            required
            error={err('registrationAuthority')}
          >
            <Input {...register('registrationAuthority')} maxLength={120} />
          </Field>
          <Field
            label={t('profile.validFrom')}
            required
            error={err('registrationValidFrom')}
          >
            <Input type="date" {...register('registrationValidFrom')} />
          </Field>
          <Field
            label={t('profile.validTo')}
            hint={t('profile.validToHint', { days: RENEWAL_WINDOW_DAYS })}
            required
            error={err('registrationValidTo')}
          >
            <Input type="date" {...register('registrationValidTo')} />
          </Field>
        </Group>

        <Group title={t('profile.nabl')} hint={t('profile.nablHint')}>
          {nablValidTo ? (
            <div className="sm:col-span-2">
              <RenewalBanner validTo={nablValidTo} what="nabl" />
            </div>
          ) : null}
          <Field
            label={t('profile.nablCertificate')}
            optionalLabel={tc('optional')}
            error={err('nablCertificateNo')}
          >
            <Input
              {...register('nablCertificateNo')}
              maxLength={40}
              autoComplete="off"
            />
          </Field>
          <Field
            label={t('profile.nablValidTo')}
            optionalLabel={tc('optional')}
            error={err('nablValidTo')}
          >
            <Input type="date" {...register('nablValidTo')} />
          </Field>
          <Field
            label={t('profile.nablScope')}
            hint={t('profile.nablScopeHint')}
            optionalLabel={tc('optional')}
            error={err('nablScope')}
            className="sm:col-span-2"
          >
            <Textarea rows={2} maxLength={400} {...register('nablScope')} />
          </Field>
        </Group>

        <Group title={t('profile.privacy')} hint={t('profile.privacyHint')}>
          <Field
            label={t('profile.officerName')}
            required
            error={err('officerName')}
          >
            <Input
              {...register('officerName')}
              maxLength={80}
              autoComplete="off"
            />
          </Field>
          <Field
            label={t('profile.officerEmail')}
            required
            error={err('officerEmail')}
          >
            <Input
              type="email"
              inputMode="email"
              autoComplete="off"
              {...register('officerEmail')}
            />
          </Field>
          <Field
            label={t('profile.officerPhone')}
            required
            error={err('officerPhone')}
          >
            <Input
              type="tel"
              inputMode="tel"
              autoComplete="off"
              maxLength={20}
              {...register('officerPhone')}
            />
          </Field>
          <Field
            label={t('profile.dataRequestDays')}
            hint={t('profile.dataRequestDaysHint')}
            required
            error={err('dataRequestDays')}
          >
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              max={90}
              step={1}
              {...register('dataRequestDays')}
            />
          </Field>
        </Group>

        <Group title={t('profile.targets')} hint={t('profile.targetsHint')}>
          {TARGETS.map((k) => (
            <Field
              key={k}
              label={t(`target.${k}`)}
              hint={t(`target.${k}.hint`)}
              required
              error={err(k)}
            >
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                max={100}
                step={0.1}
                {...register(k)}
              />
            </Field>
          ))}
        </Group>
      </fieldset>
      <SaveBar
        label={t('saveProfile')}
        dirty={dirty}
        loading={save.isPending}
        onSave={() => void handleSubmit(submit, focusInvalid)()}
      />
    </form>
  )
}

/** Registration, NABL accreditation, grievance officer and targets. */
export function ProfileSection() {
  const settings = useLabSettings()
  if (settings.isError && !settings.data)
    return <ErrorState compact onRetry={() => void settings.refetch()} />
  if (!settings.data) return <Skeleton className="h-96 rounded-lg" />
  const s = settings.data
  return (
    <ProfileForm
      key={JSON.stringify([s.profile, s.dataRequestDays, s.qualityTargets])}
      initial={s}
    />
  )
}
