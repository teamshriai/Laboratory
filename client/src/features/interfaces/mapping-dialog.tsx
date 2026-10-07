import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { z } from '@/features/shared/zod'
import { useT } from '@/i18n/context'
import { focusFirstInvalid } from '@/lib/focus'
import { countFieldErrors, focusInvalid } from '@/lib/form-errors'
import { isLabApiError, labApi } from '@/services/lab-api'
import type { InterfaceOverview } from '@/services/lab-api'
import { useLabMutation } from '@/services/mutations'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import { Dialog } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { FormErrorSummary } from '@/components/ui/form-errors'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import type { MappingDraft } from './interfaces'

const CODE = /^[A-Z0-9_.^-]{1,20}$/

const schema = z.object({
  equipmentId: z.string().min(1, 'forms.selectOne'),
  instrumentCode: z
    .string()
    .trim()
    .min(1, 'forms.required')
    .transform((v) => v.toUpperCase())
    .refine((v) => CODE.test(v), 'interfaces.codeFormat'),
  analyteId: z.string().min(1, 'forms.selectOne'),
})

/** Maps an analyser's test code to an analyte; each change is a version. */
export function MappingDialog({
  draft,
  data,
  onClose,
}: {
  draft: MappingDraft
  data: InterfaceOverview
  onClose: () => void
}) {
  const t = useT('interfaces')
  const tc = useT('common')
  const existing = draft.existing
  const form = useForm<
    z.input<typeof schema>,
    unknown,
    z.output<typeof schema>
  >({
    resolver: zodResolver(schema),
    defaultValues: {
      equipmentId: existing?.equipmentId ?? draft.equipmentId ?? '',
      instrumentCode: existing?.instrumentCode ?? draft.instrumentCode ?? '',
      analyteId: existing?.analyteId ?? draft.analyteId ?? '',
    },
  })
  const { register, control, handleSubmit, formState, setError } = form
  const equipmentId = useWatch({ control, name: 'equipmentId' })
  const code = useWatch({ control, name: 'instrumentCode' })
    .trim()
    .toUpperCase()
  const current = data.mappings.find(
    (m) => m.equipmentId === equipmentId && m.instrumentCode === code,
  )
  const analyser = data.interfaces.find((i) => i.equipmentId === equipmentId)
  // The analyser's own unmapped analytes come first.
  const unmapped = new Set(analyser?.unmapped ?? [])
  const analytes = data.coding
    .map((a) => ({
      value: a.analyteId,
      label: a.name,
      description: [a.unit, a.testNames.join(', ')].filter(Boolean).join(' · '),
      keywords: [a.analyteId, ...a.testNames],
      group: unmapped.has(a.name) ? t('groupUnmapped') : t('groupAll'),
    }))
    .toSorted(
      (a, b) =>
        Number(b.group === t('groupUnmapped')) -
        Number(a.group === t('groupUnmapped')),
    )
  const msg = (message: string | undefined) =>
    message?.startsWith('interfaces.') ? t('codeFormat') : message

  const save = useLabMutation(
    (input: z.output<typeof schema>) => labApi.interfaces.saveMapping(input),
    {
      success: (_, v) => t('mappingSaved', { code: v.instrumentCode }),
      onSuccess: onClose,
      onError: (error) => {
        if (
          isLabApiError(error) &&
          error.code === 'validation-failed' &&
          error.params.field === 'instrumentCode'
        )
          setError('instrumentCode', { message: 'interfaces.codeFormat' })
      },
    },
  )
  const submit = (v: z.output<typeof schema>) => save.mutate(v)
  const errorCount = formState.submitCount
    ? countFieldErrors(formState.errors)
    : 0

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      dirty={formState.isDirty}
      title={existing ? t('changeMapping') : t('addMapping')}
      description={t('mappingDescription')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {tc('cancel')}
          </Button>
          <Button
            variant="primary"
            loading={save.isPending}
            onClick={() => void handleSubmit(submit, focusInvalid)()}
          >
            {tc('save')}
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
          count={errorCount}
          onFocusFirst={() => focusFirstInvalid()}
        />
        <Field
          label={t('analyser')}
          required
          error={formState.errors.equipmentId?.message}
          hint={existing ? t('keepAnalyserHint') : undefined}
        >
          <Controller
            control={control}
            name="equipmentId"
            render={({ field }) => (
              <Select
                ref={field.ref}
                value={field.value || undefined}
                onValueChange={field.onChange}
                disabled={Boolean(existing)}
                placeholder={t('chooseAnalyser')}
                options={data.interfaces.map((i) => ({
                  value: i.equipmentId,
                  label: i.name,
                }))}
              />
            )}
          />
        </Field>
        <Field
          label={t('instrumentCode')}
          required
          hint={t('instrumentCodeHint')}
          error={msg(formState.errors.instrumentCode?.message)}
        >
          <Input
            {...register('instrumentCode')}
            readOnly={Boolean(existing)}
            maxLength={20}
            autoComplete="off"
            spellCheck={false}
            className="font-mono uppercase"
          />
        </Field>
        <Field
          label={t('analyte')}
          required
          error={formState.errors.analyteId?.message}
        >
          <Controller
            control={control}
            name="analyteId"
            render={({ field }) => (
              <Combobox
                value={field.value || undefined}
                onValueChange={field.onChange}
                options={analytes}
                placeholder={t('chooseAnalyte')}
                searchPlaceholder={t('searchAnalyte')}
                emptyText={t('noAnalyteMatch')}
              />
            )}
          />
        </Field>
        <p className="rounded-lg bg-surface-2 px-3.5 py-2.5 text-meta text-fg-muted">
          {current
            ? t('versionNext', {
                version: current.version + 1,
                analyte: current.analyteName,
              })
            : t('versionFirst')}
        </p>
      </form>
    </Dialog>
  )
}
