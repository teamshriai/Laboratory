import { zodResolver } from '@hookform/resolvers/zod'
import { ArchiveIcon, InfoIcon, SaveIcon, Undo2Icon } from 'lucide-react'
import { useForm, useWatch } from 'react-hook-form'
import { z } from '@/features/shared/zod'
import { RECORD_CLASSES, type RetentionRule } from '@/domain/types'
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes'
import { useT } from '@/i18n/context'
import { labApi } from '@/services/lab-api'
import { useLabMutation } from '@/services/mutations'
import { GuardedButton } from '@/components/lab/guarded-button'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { FormErrorSummary } from '@/components/ui/form-errors'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { UnsavedChangesDialog } from '@/components/ui/unsaved-dialog'
import { focusFirstInvalid } from '@/lib/focus'
import { countFieldErrors, focusInvalid } from '@/lib/form-errors'

const schema = z.object({
  rules: z.array(
    z.object({
      recordClass: z.enum(RECORD_CLASSES),
      months: z
        .string()
        .trim()
        .regex(/^\d{1,3}$/, 'forms.invalidNumber')
        .transform(Number)
        .refine((n) => n >= 1 && n <= 600, 'forms.invalid'),
      basis: z.string().trim().min(1, 'forms.required').max(200),
    }),
  ),
})
type FormIn = z.input<typeof schema>
type FormOut = z.output<typeof schema>

export function RetentionPanel({
  retention,
  isPending,
  isError,
  onRetry,
}: {
  retention: RetentionRule[] | undefined
  isPending: boolean
  isError: boolean
  onRetry: () => void
}) {
  const t = useT('privacy')
  return (
    <Card>
      <CardHeader
        title={t('retentionTitle')}
        description={t('retentionDescription')}
        icon={<ArchiveIcon />}
        tone="sky"
      />
      <CardBody className="grid gap-4">
        <p className="flex items-start gap-2 rounded-lg bg-info-soft px-3.5 py-3 text-meta text-info-text">
          <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{t('retentionFloor')}</span>
        </p>
        {isPending && !retention ? (
          <div className="grid gap-2" role="status" aria-busy>
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-14 rounded-xl" />
            ))}
          </div>
        ) : isError && !retention ? (
          <ErrorState compact onRetry={onRetry} />
        ) : !retention?.length ? (
          <EmptyState
            compact
            icon={<ArchiveIcon />}
            tone="sky"
            title={t('retentionEmpty')}
          />
        ) : (
          <RetentionForm
            key={JSON.stringify(retention)}
            retention={retention}
          />
        )}
      </CardBody>
    </Card>
  )
}

function RetentionForm({ retention }: { retention: RetentionRule[] }) {
  const t = useT('privacy')
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty, submitCount },
  } = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(schema),
    defaultValues: {
      rules: retention.map((r) => ({
        recordClass: r.recordClass,
        months: String(r.months),
        basis: r.basis,
      })),
    },
  })
  const values = useWatch({ control, name: 'rules' })
  const blocker = useUnsavedChanges(isDirty)
  const save = useLabMutation(
    (v: FormOut) => labApi.privacy.saveRetention(v.rules),
    { success: () => t('retentionSaved') },
  )
  const submit = () => void handleSubmit((v) => save.mutate(v), focusInvalid)()
  const period = (raw: string | undefined) => {
    const n = Number(raw)
    if (!/^\d{1,3}$/.test(raw?.trim() ?? '') || n < 1) return ''
    return n % 12 === 0
      ? t('years', { count: n / 12 })
      : t('months', { count: n })
  }

  return (
    <form
      noValidate
      aria-busy={save.isPending}
      className="grid gap-4"
      onSubmit={(ev) => {
        ev.preventDefault()
        submit()
      }}
    >
      {submitCount ? (
        <FormErrorSummary
          count={countFieldErrors(errors)}
          onFocusFirst={() => focusFirstInvalid()}
        />
      ) : null}
      <div className="grid gap-2">
        <div className="hidden grid-cols-[minmax(0,14rem)_10rem_minmax(0,1fr)] gap-3 px-3 text-xs font-medium text-fg-subtle md:grid">
          <span>{t('colRecordClass')}</span>
          <span>{t('colMonths')}</span>
          <span>{t('colBasis')}</span>
        </div>
        {retention.map((rule, i) => {
          const label = t(`recordClass.${rule.recordClass}`)
          return (
            <div
              key={rule.recordClass}
              className="grid gap-3 rounded-xl border border-line p-3 md:grid-cols-[minmax(0,14rem)_10rem_minmax(0,1fr)] md:items-start"
            >
              <p className="text-sm font-medium text-fg md:pt-3">{label}</p>
              <Field
                label={
                  <span className="md:sr-only">
                    {t('monthsFor', { name: label })}
                  </span>
                }
                hint={period(values?.[i]?.months)}
                error={errors.rules?.[i]?.months?.message}
              >
                <Input
                  inputMode="numeric"
                  maxLength={3}
                  autoComplete="off"
                  className="tabular-nums"
                  {...register(`rules.${i}.months`)}
                />
              </Field>
              <Field
                label={
                  <span className="md:sr-only">
                    {t('basisFor', { name: label })}
                  </span>
                }
                error={errors.rules?.[i]?.basis?.message}
              >
                <Input
                  maxLength={200}
                  autoComplete="off"
                  {...register(`rules.${i}.basis`)}
                />
              </Field>
            </div>
          )
        })}
      </div>
      <p className="text-xs text-fg-subtle">{t('monthsHint')}</p>
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          variant="ghost"
          disabled={!isDirty || save.isPending}
          onClick={() => reset()}
        >
          <Undo2Icon />
          {t('discardChanges')}
        </Button>
        <GuardedButton
          permission="settings.edit"
          variant="primary"
          loading={save.isPending}
          disabled={!isDirty}
          onClick={submit}
        >
          <SaveIcon />
          {t('saveRetention')}
        </GuardedButton>
      </div>
      <UnsavedChangesDialog blocker={blocker} />
    </form>
  )
}
