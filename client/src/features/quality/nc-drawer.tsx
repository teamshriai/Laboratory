import { zodResolver } from '@hookform/resolvers/zod'
import {
  ArrowRightIcon,
  CircleCheckIcon,
  CircleDotIcon,
  CircleXIcon,
  InfoIcon,
  SearchIcon,
  SearchXIcon,
  ShieldCheckIcon,
  Undo2Icon,
  WrenchIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { Link } from 'react-router'
import { z } from '@/features/shared/zod'
import { NC_STATES } from '@/domain/types'
import { useActor } from '@/hooks/use-permission'
import { useNow } from '@/hooks/use-now'
import { useEnum, useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import { cn } from '@/lib/cn'
import { focusFirstInvalid } from '@/lib/focus'
import { countFieldErrors, focusInvalid } from '@/lib/form-errors'
import { labApi, type NcRow, type NcStepInput } from '@/services/lab-api'
import { useLabMutation } from '@/services/mutations'
import { useNcs } from '@/services/queries'
import { GuardedButton } from '@/components/lab/guarded-button'
import { Detail } from '@/components/ui/card'
import { Combobox } from '@/components/ui/combobox'
import { Drawer } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { FormErrorSummary } from '@/components/ui/form-errors'
import { Input, Textarea } from '@/components/ui/input'
import { Stepper, Timeline, type TimelineEntry } from '@/components/ui/misc'
import { SkeletonText } from '@/components/ui/skeleton'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { ChoiceCards } from '@/components/ui/toggles'
import {
  endOfIstDate,
  toDateInput,
  useQualityMessage,
  useStaffOptions,
} from './quality'
import { NcStateBadge, OverdueText, SeverityText } from './quality-badges'

const required = (max = 2000) =>
  z.string().trim().min(3, 'forms.required').max(max, 'forms.invalid')
const optional = z.string().trim().max(2000, 'forms.invalid')

function useAdvance(nc: NcRow, success: string) {
  return useLabMutation(
    (input: NcStepInput) => labApi.quality.advanceNc(nc.id, input),
    { success: () => success },
  )
}

function StepShell({
  title,
  hint,
  errorCount,
  children,
}: {
  title: ReactNode
  hint: ReactNode
  errorCount: number
  children: ReactNode
}) {
  return (
    <section
      aria-labelledby="nc-next-step"
      className="grid gap-4 rounded-xl border border-accent-text/20 bg-accent-soft/40 p-4"
    >
      <div>
        <h3 id="nc-next-step" className="text-sm font-semibold text-fg">
          {title}
        </h3>
        <p className="mt-0.5 text-xs text-fg-muted">{hint}</p>
      </div>
      <FormErrorSummary
        count={errorCount}
        onFocusFirst={() => focusFirstInvalid()}
      />
      {children}
    </section>
  )
}

// ---------- open -> investigating ----------

const investigateSchema = z.object({
  ownerId: z.string().min(1, 'forms.selectOne'),
  due: z
    .string()
    .refine((v) => endOfIstDate(v) !== null, 'forms.invalidDate')
    .refine((v) => (endOfIstDate(v) ?? 0) >= Date.now(), 'quality.duePast'),
  correction: optional,
})

function InvestigateForm({ nc }: { nc: NcRow }) {
  const t = useT('quality')
  const tc = useT('common')
  const msg = useQualityMessage()
  const owners = useStaffOptions()
  const now = useNow()
  const { register, control, handleSubmit, formState } = useForm<
    z.input<typeof investigateSchema>,
    unknown,
    z.output<typeof investigateSchema>
  >({
    resolver: zodResolver(investigateSchema),
    defaultValues: { ownerId: '', due: '', correction: '' },
  })
  const advance = useAdvance(nc, t('ncStepped.investigating'))
  const submit = (v: z.output<typeof investigateSchema>) =>
    advance.mutate({
      to: 'investigating',
      ownerId: v.ownerId,
      dueAt: endOfIstDate(v.due) ?? 0,
      ...(v.correction ? { correction: v.correction } : {}),
    })
  const errors = formState.errors
  return (
    <StepShell
      title={t('stepInvestigate')}
      hint={t('stepInvestigateHint')}
      errorCount={formState.submitCount ? countFieldErrors(errors) : 0}
    >
      <form
        noValidate
        className="grid gap-4"
        onSubmit={(ev) => void handleSubmit(submit, focusInvalid)(ev)}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t('ncOwner')}
            required
            error={msg(errors.ownerId?.message)}
          >
            <Controller
              control={control}
              name="ownerId"
              render={({ field }) => (
                <Combobox
                  value={field.value || undefined}
                  onValueChange={field.onChange}
                  options={owners}
                  placeholder={tc('selectPlaceholder')}
                  searchPlaceholder={t('searchStaff')}
                  emptyText={t('noStaff')}
                />
              )}
            />
          </Field>
          <Field label={t('ncDue')} required error={msg(errors.due?.message)}>
            <Input
              {...register('due')}
              type="date"
              min={toDateInput(now)}
              className="tabular-nums"
            />
          </Field>
        </div>
        <Field
          label={t('ncCorrection')}
          hint={t('ncCorrectionHint')}
          optionalLabel={tc('optional')}
          error={msg(errors.correction?.message)}
        >
          <Textarea {...register('correction')} rows={2} maxLength={2000} />
        </Field>
        <div className="flex justify-end">
          <GuardedButton
            permission="quality.manage"
            type="submit"
            variant="primary"
            loading={advance.isPending}
          >
            <SearchIcon />
            {t('stepInvestigateAction')}
          </GuardedButton>
        </div>
      </form>
    </StepShell>
  )
}

// ---------- investigating -> action ----------

const rootCauseSchema = z.object({ rootCause: required() })

function RootCauseForm({ nc }: { nc: NcRow }) {
  const t = useT('quality')
  const msg = useQualityMessage()
  const { register, handleSubmit, formState } = useForm<
    z.input<typeof rootCauseSchema>,
    unknown,
    z.output<typeof rootCauseSchema>
  >({
    resolver: zodResolver(rootCauseSchema),
    defaultValues: { rootCause: '' },
  })
  const advance = useAdvance(nc, t('ncStepped.action'))
  const submit = (v: z.output<typeof rootCauseSchema>) =>
    advance.mutate({ to: 'action', rootCause: v.rootCause })
  return (
    <StepShell
      title={t('stepRootCause')}
      hint={t('stepRootCauseHint')}
      errorCount={
        formState.submitCount ? countFieldErrors(formState.errors) : 0
      }
    >
      <form
        noValidate
        className="grid gap-4"
        onSubmit={(ev) => void handleSubmit(submit, focusInvalid)(ev)}
      >
        <Field
          label={t('ncRootCause')}
          hint={t('ncRootCauseHint')}
          required
          error={msg(formState.errors.rootCause?.message)}
        >
          <Textarea {...register('rootCause')} rows={3} maxLength={2000} />
        </Field>
        <div className="flex justify-end">
          <GuardedButton
            permission="quality.manage"
            type="submit"
            variant="primary"
            loading={advance.isPending}
          >
            <ArrowRightIcon />
            {t('stepRootCauseAction')}
          </GuardedButton>
        </div>
      </form>
    </StepShell>
  )
}

// ---------- action -> verifying ----------

const actionSchema = z.object({
  correctiveAction: required(),
  preventiveAction: optional,
})

function ActionForm({ nc }: { nc: NcRow }) {
  const t = useT('quality')
  const tc = useT('common')
  const msg = useQualityMessage()
  const { register, handleSubmit, formState } = useForm<
    z.input<typeof actionSchema>,
    unknown,
    z.output<typeof actionSchema>
  >({
    resolver: zodResolver(actionSchema),
    defaultValues: {
      correctiveAction: nc.correctiveAction ?? '',
      preventiveAction: nc.preventiveAction ?? '',
    },
  })
  const advance = useAdvance(nc, t('ncStepped.verifying'))
  const submit = (v: z.output<typeof actionSchema>) =>
    advance.mutate({
      to: 'verifying',
      correctiveAction: v.correctiveAction,
      ...(v.preventiveAction ? { preventiveAction: v.preventiveAction } : {}),
    })
  const errors = formState.errors
  return (
    <StepShell
      title={t('stepAction')}
      hint={t('stepActionHint')}
      errorCount={formState.submitCount ? countFieldErrors(errors) : 0}
    >
      <form
        noValidate
        className="grid gap-4"
        onSubmit={(ev) => void handleSubmit(submit, focusInvalid)(ev)}
      >
        <Field
          label={t('ncCorrective')}
          hint={t('ncCorrectiveHint')}
          required
          error={msg(errors.correctiveAction?.message)}
        >
          <Textarea
            {...register('correctiveAction')}
            rows={3}
            maxLength={2000}
          />
        </Field>
        <Field
          label={t('ncPreventive')}
          hint={t('ncPreventiveHint')}
          optionalLabel={tc('optional')}
          error={msg(errors.preventiveAction?.message)}
        >
          <Textarea
            {...register('preventiveAction')}
            rows={2}
            maxLength={2000}
          />
        </Field>
        <div className="flex justify-end">
          <GuardedButton
            permission="quality.manage"
            type="submit"
            variant="primary"
            loading={advance.isPending}
          >
            <ShieldCheckIcon />
            {t('stepActionAction')}
          </GuardedButton>
        </div>
      </form>
    </StepShell>
  )
}

// ---------- verifying -> closed / action ----------

const verifySchema = z.object({
  effective: z.enum(['yes', 'no'], { error: 'forms.selectOne' }),
  note: required(),
})

function VerifyForm({ nc }: { nc: NcRow }) {
  const t = useT('quality')
  const msg = useQualityMessage()
  const actor = useActor()
  const { register, control, handleSubmit, formState } = useForm<
    z.input<typeof verifySchema>,
    unknown,
    z.output<typeof verifySchema>
  >({
    resolver: zodResolver(verifySchema),
    defaultValues: { note: '' },
  })
  const effective = useWatch({ control, name: 'effective' })
  const advance = useLabMutation(
    (input: NcStepInput) => labApi.quality.advanceNc(nc.id, input),
    {
      success: (_, v) =>
        v.to === 'closed' ? t('ncStepped.closed') : t('ncStepped.reopened'),
    },
  )
  const submit = (v: z.output<typeof verifySchema>) =>
    advance.mutate({
      to: v.effective === 'yes' ? 'closed' : 'action',
      effective: v.effective === 'yes',
      note: v.note,
    })
  const errors = formState.errors
  const isOwner = actor !== undefined && actor.id === nc.ownerId
  return (
    <StepShell
      title={t('stepVerify')}
      hint={t('stepVerifyHint', { owner: nc.ownerName ?? '-' })}
      errorCount={formState.submitCount ? countFieldErrors(errors) : 0}
    >
      {isOwner ? (
        <p
          role="status"
          className="flex gap-2 rounded-lg border border-warning-text/25 bg-warning-soft p-3 text-meta text-warning-text"
        >
          <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t('verifyOwnerWarning')}
        </p>
      ) : null}
      <form
        noValidate
        className="grid gap-4"
        onSubmit={(ev) => void handleSubmit(submit, focusInvalid)(ev)}
      >
        <fieldset className="grid gap-1.5">
          <legend className="mb-1.5 text-sm font-medium text-fg-muted">
            {t('ncEffectiveQuestion')}
            <span className="ml-1 text-danger-text" aria-hidden>
              *
            </span>
          </legend>
          <Controller
            control={control}
            name="effective"
            render={({ field }) => (
              <ChoiceCards
                columns={2}
                value={field.value}
                onValueChange={field.onChange}
                aria-label={t('ncEffectiveQuestion')}
                options={[
                  {
                    value: 'yes',
                    label: t('ncEffectiveYes'),
                    description: t('ncEffectiveYesHint'),
                    icon: <CircleCheckIcon className="text-success-text" />,
                  },
                  {
                    value: 'no',
                    label: t('ncEffectiveNo'),
                    description: t('ncEffectiveNoHint'),
                    icon: <CircleXIcon className="text-danger-text" />,
                  },
                ]}
              />
            )}
          />
          {errors.effective ? (
            <p className="text-xs font-medium text-danger-text">
              {t('ncEffectiveRequired')}
            </p>
          ) : null}
        </fieldset>
        <Field
          label={t('ncEffectiveNote')}
          hint={t('ncEffectiveNoteHint')}
          required
          error={msg(errors.note?.message)}
        >
          <Textarea {...register('note')} rows={3} maxLength={2000} />
        </Field>
        <div className="flex justify-end">
          <GuardedButton
            permission="quality.manage"
            type="submit"
            variant={effective === 'no' ? 'secondary' : 'primary'}
            loading={advance.isPending}
          >
            {effective === 'no' ? <Undo2Icon /> : <CircleCheckIcon />}
            {effective === 'no' ? t('stepVerifyBack') : t('stepVerifyClose')}
          </GuardedButton>
        </div>
      </form>
    </StepShell>
  )
}

function NextStep({ nc }: { nc: NcRow }) {
  switch (nc.state) {
    case 'open':
      return <InvestigateForm key={nc.id} nc={nc} />
    case 'investigating':
      return <RootCauseForm key={nc.id} nc={nc} />
    case 'action':
      return <ActionForm key={`${nc.id}-${nc.history.length}`} nc={nc} />
    case 'verifying':
      return <VerifyForm key={nc.id} nc={nc} />
    case 'closed':
      return null
  }
}

// ---------- record ----------

function RecordBlock({
  label,
  children,
}: {
  label: ReactNode
  children: ReactNode
}) {
  return (
    <div className="grid gap-1">
      <h3 className="text-xs font-semibold text-fg-subtle">{label}</h3>
      <p className="text-sm whitespace-pre-line text-fg">{children}</p>
    </div>
  )
}

const HISTORY: Record<
  string,
  { icon: ReactNode; tone: TimelineEntry['tone'] }
> = {
  'nc-raised': { icon: <CircleDotIcon />, tone: 'warning' },
  'nc-investigating': { icon: <SearchIcon />, tone: 'accent' },
  'nc-action': { icon: <WrenchIcon />, tone: 'accent' },
  'nc-verifying': { icon: <ShieldCheckIcon />, tone: 'accent' },
  'nc-closed': { icon: <CircleCheckIcon />, tone: 'success' },
}

function NcHistory({ nc }: { nc: NcRow }) {
  const t = useT('quality')
  const f = useFormat()
  const label = (type: string, previous: string | undefined) => {
    switch (type) {
      case 'nc-raised':
        return t('ncHistory.raised')
      case 'nc-investigating':
        return t('ncHistory.investigating')
      case 'nc-action':
        return previous === 'nc-verifying'
          ? t('ncHistory.reopened')
          : t('ncHistory.action')
      case 'nc-verifying':
        return t('ncHistory.verifying')
      case 'nc-closed':
        return t('ncHistory.closed')
      default:
        return type
    }
  }
  const items: TimelineEntry[] = nc.history
    .map((h, i) => ({
      id: h.id,
      title: label(h.type, nc.history[i - 1]?.type),
      meta: `${f.dateTime(h.at)} · ${h.byName}`,
      icon: HISTORY[h.type]?.icon,
      tone:
        h.type === 'nc-action' && nc.history[i - 1]?.type === 'nc-verifying'
          ? ('danger' as const)
          : (HISTORY[h.type]?.tone ?? 'neutral'),
    }))
    .toReversed()
  return <Timeline items={items} />
}

function NcRecord({ nc }: { nc: NcRow }) {
  const t = useT('quality')
  const e = useEnum()
  const f = useFormat()
  const related =
    nc.source === 'eqa'
      ? '/quality?tab=eqa'
      : nc.source === 'internal-audit'
        ? '/quality?tab=audits'
        : null
  return (
    <div className="grid gap-6">
      <Stepper
        steps={NC_STATES.map((s) => ({ id: s, label: t(`ncState.${s}`) }))}
        current={NC_STATES.indexOf(nc.state)}
      />
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Detail label={t('ncSeverityField')}>
          <SeverityText severity={nc.severity} />
        </Detail>
        <Detail label={t('ncSourceField')}>{t(`ncSource.${nc.source}`)}</Detail>
        <Detail label={t('department')}>
          {nc.department === 'all'
            ? t('allDepartments')
            : e('department', nc.department)}
        </Detail>
        <Detail label={t('ncRaisedBy')}>
          <span className="block truncate">{nc.raisedByName}</span>
          <span className="block text-xs font-normal text-fg-muted">
            {f.dateTime(nc.raisedAt)}
          </span>
        </Detail>
        <Detail label={t('ncOwner')}>
          {nc.ownerName ?? (
            <span className="text-fg-subtle">{t('notAssigned')}</span>
          )}
        </Detail>
        <Detail label={t('ncDue')}>
          {nc.dueAt ? (
            <span className="inline-flex flex-wrap items-center gap-2">
              {f.date(nc.dueAt)}
              {nc.overdue ? <OverdueText /> : null}
            </span>
          ) : (
            '-'
          )}
        </Detail>
      </dl>
      <RecordBlock label={t('ncDescriptionField')}>
        {nc.description}
      </RecordBlock>
      {related ? (
        <Link
          to={related}
          className="focus-ring -mt-3 inline-flex min-h-11 items-center gap-1.5 self-start rounded-lg text-meta font-medium text-accent-text hover:underline"
        >
          {t(nc.source === 'eqa' ? 'openEqa' : 'openAudits')}
          <ArrowRightIcon className="size-3.5" aria-hidden />
        </Link>
      ) : null}
      {nc.correction ? (
        <RecordBlock label={t('ncCorrection')}>{nc.correction}</RecordBlock>
      ) : null}
      {nc.rootCause ? (
        <RecordBlock label={t('ncRootCause')}>{nc.rootCause}</RecordBlock>
      ) : null}
      {nc.correctiveAction ? (
        <RecordBlock label={t('ncCorrective')}>
          {nc.correctiveAction}
        </RecordBlock>
      ) : null}
      {nc.preventiveAction ? (
        <RecordBlock label={t('ncPreventive')}>
          {nc.preventiveAction}
        </RecordBlock>
      ) : null}
      {nc.effectiveness ? (
        <div
          className={cn(
            'grid gap-1 rounded-xl border p-3.5',
            nc.effectiveness.effective
              ? 'border-success-text/25 bg-success-soft'
              : 'border-danger-text/25 bg-danger-soft',
          )}
        >
          <h3
            className={cn(
              'inline-flex items-center gap-1.5 text-xs font-semibold',
              nc.effectiveness.effective
                ? 'text-success-text'
                : 'text-danger-text',
            )}
          >
            {nc.effectiveness.effective ? (
              <CircleCheckIcon className="size-3.5" aria-hidden />
            ) : (
              <CircleXIcon className="size-3.5" aria-hidden />
            )}
            {nc.effectiveness.effective
              ? t('ncEffectiveRecorded')
              : t('ncIneffectiveRecorded')}
          </h3>
          <p className="text-sm whitespace-pre-line text-fg">
            {nc.effectiveness.note}
          </p>
          <p className="text-xs text-fg-muted">
            {f.dateTime(nc.effectiveness.at)} · {nc.effectivenessByName ?? ''}
          </p>
        </div>
      ) : null}
      <NextStep nc={nc} />
      <section aria-labelledby="nc-history" className="grid gap-3">
        <h3 id="nc-history" className="text-sm font-semibold text-fg">
          {t('ncHistoryTitle')}
        </h3>
        <NcHistory nc={nc} />
      </section>
    </div>
  )
}

export function NcDrawer({
  ncId,
  onClose,
}: {
  ncId: string
  onClose: () => void
}) {
  const t = useT('quality')
  const { data, isPending, isError, refetch } = useNcs()
  const nc = data?.find((n) => n.id === ncId)
  return (
    <Drawer
      open
      onOpenChange={(o) => !o && onClose()}
      size="lg"
      title={nc ? nc.ncNo : t('ncDrawerTitle')}
      description={nc?.title}
      headerExtra={nc ? <NcStateBadge state={nc.state} /> : null}
    >
      {isPending ? (
        <div role="status" aria-busy className="grid gap-6">
          <span className="sr-only">{t('loading')}</span>
          <SkeletonText lines={2} />
          <SkeletonText lines={6} />
          <SkeletonText lines={4} />
        </div>
      ) : isError ? (
        <ErrorState compact onRetry={() => void refetch()} />
      ) : nc ? (
        <NcRecord nc={nc} />
      ) : (
        <EmptyState
          compact
          icon={<SearchXIcon />}
          tone="amber"
          title={t('ncNotFound')}
          description={t('ncNotFoundBody')}
        />
      )}
    </Drawer>
  )
}
