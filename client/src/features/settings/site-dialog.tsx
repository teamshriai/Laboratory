import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { z } from '@/features/shared/zod'
import { SITE_KINDS, type SiteKind } from '@/domain/types'
import { useT } from '@/i18n/context'
import { focusFirstInvalid } from '@/lib/focus'
import { countFieldErrors, focusInvalid } from '@/lib/form-errors'
import { isLabApiError, labApi, type SiteRow } from '@/services/lab-api'
import { useLabMutation } from '@/services/mutations'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { FormErrorSummary } from '@/components/ui/form-errors'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/toggles'
import { useSettingsMessage } from './settings-forms'

const schema = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'forms.required')
    .transform((v) => v.toUpperCase())
    .refine((v) => /^[A-Z0-9-]{2,10}$/.test(v), 'settings.siteCodeFormat'),
  name: z.string().trim().min(1, 'forms.required').max(80, 'forms.invalid'),
  kind: z.enum(SITE_KINDS),
  city: z.string().trim().max(60, 'forms.invalid'),
  active: z.boolean(),
})

/** Adds or edits a collection site; there is always one main laboratory. */
export function SiteDialog({
  site,
  onClose,
}: {
  site?: SiteRow | undefined
  onClose: () => void
}) {
  const t = useT('settings')
  const tc = useT('common')
  const msg = useSettingsMessage()
  const isMain = site?.kind === 'main'
  const form = useForm<
    z.input<typeof schema>,
    unknown,
    z.output<typeof schema>
  >({
    resolver: zodResolver(schema),
    defaultValues: {
      code: site?.code ?? '',
      name: site?.name ?? '',
      kind: site?.kind ?? 'branch',
      city: site?.city ?? '',
      active: site?.active ?? true,
    },
  })
  const { register, control, handleSubmit, formState, setError } = form
  const save = useLabMutation(
    (input: z.output<typeof schema>) =>
      labApi.sites.save({ ...(site ? { id: site.id } : {}), ...input }),
    {
      success: (_, v) => t('siteSaved', { name: v.name }),
      onSuccess: onClose,
      onError: (error) => {
        if (isLabApiError(error) && error.code === 'duplicate-code')
          setError('code', { message: 'settings.siteCodeTaken' })
      },
    },
  )
  const submit = (v: z.output<typeof schema>) => save.mutate(v)
  // Only the existing main laboratory is "main"; a new site cannot be.
  const kinds: SiteKind[] = isMain ? ['main'] : ['branch', 'satellite']
  const errorCount = formState.submitCount
    ? countFieldErrors(formState.errors)
    : 0

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      dirty={formState.isDirty}
      title={site ? t('editSite') : t('addSite')}
      description={t('siteDescription')}
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
        className="grid gap-4 sm:grid-cols-[10rem_minmax(0,1fr)]"
        noValidate
        onSubmit={(ev) => void handleSubmit(submit, focusInvalid)(ev)}
      >
        <div className="sm:col-span-2">
          <FormErrorSummary
            count={errorCount}
            onFocusFirst={() => focusFirstInvalid()}
          />
        </div>
        <Field
          label={t('siteCode')}
          hint={t('siteCodeHint')}
          required
          error={msg(formState.errors.code?.message)}
        >
          <Input
            {...register('code')}
            maxLength={10}
            autoComplete="off"
            spellCheck={false}
            className="font-mono uppercase"
          />
        </Field>
        <Field
          label={t('siteName')}
          required
          error={msg(formState.errors.name?.message)}
        >
          <Input {...register('name')} maxLength={80} autoComplete="off" />
        </Field>
        <Field
          label={t('siteKind')}
          hint={isMain ? t('siteMainHint') : undefined}
        >
          <Controller
            control={control}
            name="kind"
            render={({ field }) => (
              <Select
                ref={field.ref}
                value={field.value}
                onValueChange={field.onChange}
                disabled={isMain}
                options={kinds.map((k) => ({
                  value: k,
                  label: t(`siteKind.${k}`),
                }))}
              />
            )}
          />
        </Field>
        <Field
          label={t('siteCity')}
          error={msg(formState.errors.city?.message)}
        >
          <Input {...register('city')} maxLength={60} />
        </Field>
        <Controller
          control={control}
          name="active"
          render={({ field }) => (
            <div className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-line px-4 py-2 sm:col-span-2">
              <span>
                <span className="block text-sm font-medium text-fg">
                  {t('siteActive')}
                </span>
                <span className="block text-xs text-fg-muted">
                  {isMain ? t('siteMainActiveHint') : t('siteActiveHint')}
                </span>
              </span>
              <Switch
                checked={field.value}
                onCheckedChange={field.onChange}
                label={t('siteActive')}
                disabled={isMain}
              />
            </div>
          )}
        />
      </form>
    </Dialog>
  )
}
