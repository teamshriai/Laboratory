import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { z } from '@/features/shared/zod'
import { hasPermission } from '@/domain/permissions'
import { DAY, istDay } from '@/domain/time'
import { DEPARTMENTS, FINDING_KINDS, type FindingKind } from '@/domain/types'
import { useNow } from '@/hooks/use-now'
import { useEnum, useT } from '@/i18n/context'
import { focusFirstInvalid } from '@/lib/focus'
import { countFieldErrors, focusInvalid } from '@/lib/form-errors'
import {
  isLabApiError,
  labApi,
  type AuditPlanInput,
  type InternalAuditRow,
} from '@/services/lab-api'
import { useLabMutation } from '@/services/mutations'
import { useReference } from '@/services/queries'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import { Dialog } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { FormErrorSummary } from '@/components/ui/form-errors'
import { Input, Textarea } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import {
  dateInputToMs,
  useDepartmentLabel,
  useRecordsMessage,
} from './records-shared'

const DEPARTMENT_CHOICES = ['all', ...DEPARTMENTS] as const

const planSchema = z.object({
  area: z.string().trim().min(3, 'forms.required').max(200, 'forms.invalid'),
  clauses: z.string().trim().min(1, 'forms.required').max(200, 'forms.invalid'),
  department: z.enum(DEPARTMENT_CHOICES, { error: 'forms.selectOne' }),
  plannedFor: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'forms.invalidDate')
    .refine((v) => !Number.isNaN(dateInputToMs(v)), 'forms.invalidDate'),
  auditorId: z.string().min(1, 'forms.selectOne'),
})
type PlanValues = z.output<typeof planSchema>

/** Plans an internal audit (ISO 15189 clause 8.8). */
export function PlanAuditDialog({
  onClose,
  onPlanned,
}: {
  onClose: () => void
  onPlanned: (id: string) => void
}) {
  const t = useT('qualityRecords')
  const tc = useT('common')
  const e = useEnum()
  const dept = useDepartmentLabel()
  const msg = useRecordsMessage()
  const now = useNow()
  const { data: reference } = useReference()
  const form = useForm<z.input<typeof planSchema>, unknown, PlanValues>({
    resolver: zodResolver(planSchema),
    defaultValues: {
      area: '',
      clauses: '',
      department: 'all',
      plannedFor: istDay(now + 7 * DAY),
      auditorId: '',
    },
  })
  const { register, control, handleSubmit, formState, setError } = form
  const department = useWatch({ control, name: 'department' })
  const plan = useLabMutation(
    (input: AuditPlanInput) => labApi.quality.planAudit(input),
    {
      success: (_, v) => t('auditPlanned', { area: v.area }),
      onSuccess: (id) => onPlanned(id),
      onError: (error) => {
        if (isLabApiError(error) && error.code === 'auditor-not-independent')
          setError('auditorId', { message: 'qualityRecords.auditorOwnDept' })
      },
    },
  )
  const auditors = (reference?.staff ?? [])
    .filter((s) => hasPermission(s, 'quality.record'))
    .toSorted((a, b) => a.name.localeCompare(b.name))
  const submit = (v: PlanValues) =>
    plan.mutate({
      area: v.area,
      clauses: v.clauses,
      department: v.department,
      plannedFor: dateInputToMs(v.plannedFor),
      auditorId: v.auditorId,
    })
  const errors = formState.submitCount ? countFieldErrors(formState.errors) : 0
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      dirty={formState.isDirty}
      size="lg"
      title={t('planAudit')}
      description={t('planAuditBody')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {tc('cancel')}
          </Button>
          <Button
            variant="primary"
            loading={plan.isPending}
            onClick={() => void handleSubmit(submit, focusInvalid)()}
          >
            {t('planAudit')}
          </Button>
        </>
      }
    >
      <form
        className="grid gap-4"
        noValidate
        onSubmit={(ev) => void handleSubmit(submit, focusInvalid)(ev)}
      >
        <FormErrorSummary
          count={errors}
          onFocusFirst={() => focusFirstInvalid()}
        />
        <Field
          label={t('area')}
          required
          hint={t('areaHint')}
          error={msg(formState.errors.area?.message)}
        >
          <Input {...register('area')} maxLength={200} autoComplete="off" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t('clauses')}
            required
            hint={t('clausesHint')}
            error={msg(formState.errors.clauses?.message)}
          >
            <Input
              {...register('clauses')}
              maxLength={200}
              autoComplete="off"
            />
          </Field>
          <Controller
            control={control}
            name="department"
            render={({ field, fieldState }) => (
              <Field
                label={tc('department')}
                required
                error={msg(fieldState.error?.message)}
              >
                <Select
                  ref={field.ref}
                  value={field.value}
                  onValueChange={field.onChange}
                  options={DEPARTMENT_CHOICES.map((d) => ({
                    value: d,
                    label: dept(d),
                  }))}
                />
              </Field>
            )}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t('plannedFor')}
            required
            error={msg(formState.errors.plannedFor?.message)}
          >
            <Input {...register('plannedFor')} type="date" />
          </Field>
          <Controller
            control={control}
            name="auditorId"
            render={({ field, fieldState }) => (
              <Field
                label={t('auditor')}
                required
                hint={t('auditorHint')}
                error={msg(fieldState.error?.message)}
              >
                <Combobox
                  value={field.value || undefined}
                  onValueChange={field.onChange}
                  placeholder={t('chooseAuditor')}
                  searchPlaceholder={t('searchStaff')}
                  emptyText={t('noStaffFound')}
                  options={auditors.map((s) => ({
                    value: s.id,
                    label: s.name,
                    description: [
                      e('staffRole', s.role),
                      s.department ? e('department', s.department) : '',
                    ]
                      .filter(Boolean)
                      .join(' · '),
                  }))}
                />
              </Field>
            )}
          />
        </div>
        {department !== 'all' ? (
          <p className="text-meta text-fg-muted">
            {t('independenceNote', { department: dept(department) })}
          </p>
        ) : null}
      </form>
    </Dialog>
  )
}

const findingSchema = z.object({
  kind: z.enum(FINDING_KINDS, { error: 'forms.selectOne' }),
  clause: z.string().trim().min(1, 'forms.required').max(40, 'forms.invalid'),
  text: z.string().trim().min(3, 'forms.required').max(2000, 'forms.invalid'),
})
type FindingValues = z.output<typeof findingSchema>

/** Records a finding; a nonconformity raises a non-conformance. */
export function FindingDialog({
  audit,
  onClose,
}: {
  audit: InternalAuditRow
  onClose: () => void
}) {
  const t = useT('qualityRecords')
  const tc = useT('common')
  const msg = useRecordsMessage()
  const form = useForm<z.input<typeof findingSchema>, unknown, FindingValues>({
    resolver: zodResolver(findingSchema),
    defaultValues: { kind: 'observation', clause: '', text: '' },
  })
  const { register, control, handleSubmit, formState } = form
  const kind = useWatch({ control, name: 'kind' })
  const add = useLabMutation(
    (input: { kind: FindingKind; clause: string; text: string }) =>
      labApi.quality.addFinding(audit.id, input),
    {
      success: (_, v) =>
        v.kind === 'nonconformity'
          ? t('findingAddedNc', { clause: v.clause })
          : t('findingAdded', { clause: v.clause }),
      onSuccess: onClose,
    },
  )
  const submit = (v: FindingValues) => add.mutate(v)
  const errors = formState.submitCount ? countFieldErrors(formState.errors) : 0
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      dirty={formState.isDirty}
      size="md"
      title={t('addFindingTitle', { audit: audit.auditNo })}
      description={audit.area}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {tc('cancel')}
          </Button>
          <Button
            variant="primary"
            loading={add.isPending}
            onClick={() => void handleSubmit(submit, focusInvalid)()}
          >
            {t('addFinding')}
          </Button>
        </>
      }
    >
      <form
        className="grid gap-4"
        noValidate
        onSubmit={(ev) => void handleSubmit(submit, focusInvalid)(ev)}
      >
        <FormErrorSummary
          count={errors}
          onFocusFirst={() => focusFirstInvalid()}
        />
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_9rem]">
          <Controller
            control={control}
            name="kind"
            render={({ field, fieldState }) => (
              <Field
                label={t('findingKindLabel')}
                required
                error={msg(fieldState.error?.message)}
              >
                <Select
                  ref={field.ref}
                  value={field.value}
                  onValueChange={field.onChange}
                  options={FINDING_KINDS.map((k) => ({
                    value: k,
                    label: t(`findingKind.${k}`),
                  }))}
                />
              </Field>
            )}
          />
          <Field
            label={t('clause')}
            required
            error={msg(formState.errors.clause?.message)}
          >
            <Input
              {...register('clause')}
              maxLength={40}
              autoComplete="off"
              placeholder="7.3.4"
              className="tabular-nums"
            />
          </Field>
        </div>
        <Field
          label={t('findingText')}
          required
          error={msg(formState.errors.text?.message)}
        >
          <Textarea {...register('text')} rows={4} maxLength={2000} />
        </Field>
        <p className="text-meta text-fg-muted">
          {kind === 'nonconformity' ? t('ncRaisedNote') : t('findingNote')}
        </p>
      </form>
    </Dialog>
  )
}
