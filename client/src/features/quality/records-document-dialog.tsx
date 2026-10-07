import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { z } from '@/features/shared/zod'
import { DEPARTMENTS, DOCUMENT_KINDS } from '@/domain/types'
import { useT } from '@/i18n/context'
import { focusFirstInvalid } from '@/lib/focus'
import { countFieldErrors, focusInvalid } from '@/lib/form-errors'
import { isLabApiError, labApi, type DocumentInput } from '@/services/lab-api'
import { useLabMutation } from '@/services/mutations'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { FormErrorSummary } from '@/components/ui/form-errors'
import { Input, Textarea } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { useDepartmentLabel, useRecordsMessage } from './records-shared'

const DEPARTMENT_CHOICES = ['all', ...DEPARTMENTS] as const

const schema = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'forms.required')
    .max(40, 'forms.invalid')
    .regex(/^[A-Za-z0-9-]+$/, 'qualityRecords.codeFormat'),
  title: z.string().trim().min(3, 'forms.required').max(200, 'forms.invalid'),
  kind: z.enum(DOCUMENT_KINDS, { error: 'forms.selectOne' }),
  department: z.enum(DEPARTMENT_CHOICES, { error: 'forms.selectOne' }),
  reviewMonths: z
    .string()
    .trim()
    .regex(/^\d+$/, 'qualityRecords.reviewMonthsRange')
    .refine((v) => {
      const n = Number(v)
      return n >= 1 && n <= 60
    }, 'qualityRecords.reviewMonthsRange'),
  summary: z
    .string()
    .trim()
    .min(1, 'forms.required')
    .max(2000, 'forms.invalid'),
})

type Values = z.output<typeof schema>

/** A new controlled document, created as draft version 1.0. */
export function NewDocumentDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const t = useT('qualityRecords')
  const tc = useT('common')
  const dept = useDepartmentLabel()
  const msg = useRecordsMessage()
  const form = useForm<z.input<typeof schema>, unknown, Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: '',
      title: '',
      kind: 'sop',
      department: 'all',
      reviewMonths: '12',
      summary: '',
    },
  })
  const { register, control, handleSubmit, formState, setError } = form
  const create = useLabMutation(
    (input: DocumentInput) => labApi.quality.createDocument(input),
    {
      success: (_, v) => t('documentCreated', { code: v.code }),
      onSuccess: (id) => onCreated(id),
      onError: (error) => {
        if (isLabApiError(error) && error.code === 'duplicate-code')
          setError('code', { message: 'qualityRecords.codeTaken' })
      },
    },
  )
  const submit = (v: Values) =>
    create.mutate({
      code: v.code.toUpperCase(),
      title: v.title,
      kind: v.kind,
      department: v.department,
      reviewMonths: Number(v.reviewMonths),
      summary: v.summary,
    })
  const errors = formState.submitCount ? countFieldErrors(formState.errors) : 0
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      dirty={formState.isDirty}
      size="lg"
      title={t('newDocument')}
      description={t('newDocumentBody')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {tc('cancel')}
          </Button>
          <Button
            variant="primary"
            loading={create.isPending}
            onClick={() => void handleSubmit(submit, focusInvalid)()}
          >
            {t('createDraft')}
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
        <div className="grid gap-4 sm:grid-cols-[10rem_minmax(0,1fr)]">
          <Field
            label={t('code')}
            required
            hint={t('codeHint')}
            error={msg(formState.errors.code?.message)}
          >
            <Input
              {...register('code')}
              maxLength={40}
              autoComplete="off"
              className="font-mono uppercase"
            />
          </Field>
          <Field
            label={t('docTitle')}
            required
            error={msg(formState.errors.title?.message)}
          >
            <Input {...register('title')} maxLength={200} autoComplete="off" />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Controller
            control={control}
            name="kind"
            render={({ field, fieldState }) => (
              <Field
                label={t('kind')}
                required
                error={msg(fieldState.error?.message)}
              >
                <Select
                  ref={field.ref}
                  value={field.value}
                  onValueChange={field.onChange}
                  options={DOCUMENT_KINDS.map((k) => ({
                    value: k,
                    label: t(`docKind.${k}`),
                  }))}
                />
              </Field>
            )}
          />
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
          <Field
            label={t('reviewEvery')}
            required
            hint={t('reviewEveryHint')}
            error={msg(formState.errors.reviewMonths?.message)}
          >
            <Input
              {...register('reviewMonths')}
              inputMode="numeric"
              autoComplete="off"
              className="tabular-nums"
            />
          </Field>
        </div>
        <Field
          label={t('versionSummary')}
          required
          hint={t('versionSummaryHint')}
          error={msg(formState.errors.summary?.message)}
        >
          <Textarea {...register('summary')} rows={3} maxLength={2000} />
        </Field>
        <p className="text-meta text-fg-muted">{t('draftNote')}</p>
      </form>
    </Dialog>
  )
}
