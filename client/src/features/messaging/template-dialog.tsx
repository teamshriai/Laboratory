import { zodResolver } from '@hookform/resolvers/zod'
import { EyeIcon, TriangleAlertIcon } from 'lucide-react'
import { useRef } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { z } from '@/features/shared/zod'
import {
  LANGUAGES,
  MESSAGE_CHANNELS,
  MESSAGE_EVENTS,
  type MessageEvent,
  type MessageTemplate,
} from '@/domain/types'
import { useNow } from '@/hooks/use-now'
import { useEnum, useT } from '@/i18n/context'
import { LANGUAGE_NAMES, type TKey } from '@/i18n/core'
import { useFormat } from '@/i18n/format'
import { focusFirstInvalid } from '@/lib/focus'
import { countFieldErrors, focusInvalid } from '@/lib/form-errors'
import { labApi } from '@/services/lab-api'
import { useLabMutation } from '@/services/mutations'
import { useLabSettings } from '@/services/queries'
import { useNetworkFormText } from '@/features/network/form-text'
import { SwitchRow } from '@/features/network/switch-row'
import { GuardedButton } from '@/components/lab/guarded-button'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { FormErrorSummary } from '@/components/ui/form-errors'
import { Input, Textarea } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { ChannelIcon } from './channel'
import {
  BODY_MAX,
  PLACEHOLDERS,
  renderTemplate,
  unknownPlaceholders,
  type Placeholder,
} from './template-text'

const schema = z
  .object({
    event: z.enum(MESSAGE_EVENTS, { message: 'forms.selectOne' }),
    channel: z.enum(MESSAGE_CHANNELS, { message: 'forms.selectOne' }),
    language: z.enum(LANGUAGES, { message: 'forms.selectOne' }),
    body: z
      .string()
      .trim()
      .min(1, 'forms.required')
      .max(BODY_MAX, 'network.bodyTooLong'),
    dltTemplateId: z
      .string()
      .trim()
      .regex(/^(\d{10,25})?$/, 'network.dltFormat'),
    active: z.boolean(),
  })
  .superRefine((v, ctx) => {
    // SMS to Indian numbers needs a template registered on the DLT platform.
    if (v.channel === 'sms' && v.active && !v.dltTemplateId)
      ctx.addIssue({
        code: 'custom',
        path: ['dltTemplateId'],
        message: 'network.dltRequired',
      })
  })

type FormIn = z.input<typeof schema>
type FormOut = z.output<typeof schema>

const PLACEHOLDER_HINT: Record<Placeholder, TKey<'network'>> = {
  name: 'phName',
  report: 'phReport',
  lab: 'phLab',
  slot: 'phSlot',
  visit: 'phVisit',
  amount: 'phAmount',
  invoice: 'phInvoice',
}

/** Adds or edits a message template, with a live preview. */
export function TemplateDialog({
  template,
  event,
  onClose,
}: {
  template?: MessageTemplate | undefined
  /** The event a new template is for. */
  event?: MessageEvent | undefined
  onClose: () => void
}) {
  const t = useT('network')
  const tc = useT('common')
  const e = useEnum()
  const f = useFormat()
  const now = useNow()
  const text = useNetworkFormText()
  const { data: settings } = useLabSettings()
  const bodyRef = useRef<HTMLTextAreaElement | null>(null)
  const { register, control, handleSubmit, formState, getValues, setValue } =
    useForm<FormIn, unknown, FormOut>({
      resolver: zodResolver(schema),
      defaultValues: {
        event: template?.event ?? event ?? 'report-ready',
        channel: template?.channel ?? 'sms',
        language: template?.language ?? 'en',
        body: template?.body ?? '',
        dltTemplateId: template?.dltTemplateId ?? '',
        active: template?.active ?? true,
      },
    })
  const [channel, active, body] = useWatch({
    control,
    name: ['channel', 'active', 'body'],
  })
  const err = (k: keyof FormIn) => text(formState.errors[k]?.message)
  const bodyField = register('body')

  // Sample values for the preview; the lab's own name where it is known.
  const sample: Record<Placeholder, string> = {
    name: 'Priya Raman',
    report: 'RPT-24-001042',
    lab: settings?.labName ?? t('sampleLab'),
    slot: f.dateTime(now),
    visit: 'HV-20261006-004',
    amount: f.number(1250),
    invoice: 'INV-24-000318',
  }
  const preview = renderTemplate(body.trim(), sample)
  const unknown = unknownPlaceholders(body)

  const insert = (key: Placeholder) => {
    const token = `{${key}}`
    const el = bodyRef.current
    const current = getValues('body')
    const start = el?.selectionStart ?? current.length
    const end = el?.selectionEnd ?? start
    setValue('body', current.slice(0, start) + token + current.slice(end), {
      shouldDirty: true,
      shouldValidate: formState.submitCount > 0,
    })
    window.requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(start + token.length, start + token.length)
    })
  }

  const save = useLabMutation(
    (v: FormOut) =>
      labApi.network.saveTemplate({
        ...(template ? { id: template.id } : {}),
        event: v.event,
        channel: v.channel,
        language: v.language,
        body: v.body,
        active: v.active,
        ...(v.dltTemplateId ? { dltTemplateId: v.dltTemplateId } : {}),
      }),
    {
      success: () =>
        template ? t('templateUpdatedToast') : t('templateAddedToast'),
      onSuccess: onClose,
    },
  )
  const submit = (ev?: React.BaseSyntheticEvent) =>
    void handleSubmit((v) => save.mutate(v), focusInvalid)(ev)

  return (
    <Dialog
      open
      size="xl"
      onOpenChange={(o) => !o && onClose()}
      dirty={formState.isDirty}
      title={template ? t('editTemplateTitle') : t('addTemplateTitle')}
      description={t('templateDialogBody')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {tc('cancel')}
          </Button>
          <GuardedButton
            permission="messaging.manage"
            variant="primary"
            loading={save.isPending}
            onClick={() => submit()}
          >
            {template ? tc('save') : t('addTemplate')}
          </GuardedButton>
        </>
      }
    >
      <form
        className="grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]"
        noValidate
        onSubmit={submit}
      >
        <div className="empty:hidden lg:col-span-2">
          <FormErrorSummary
            count={
              formState.submitCount ? countFieldErrors(formState.errors) : 0
            }
            onFocusFirst={() => focusFirstInvalid()}
          />
        </div>
        <div className="grid content-start gap-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t('fieldEvent')} required error={err('event')}>
              <Controller
                control={control}
                name="event"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    options={MESSAGE_EVENTS.map((ev) => ({
                      value: ev,
                      label: e('messageEvent', ev),
                    }))}
                  />
                )}
              />
            </Field>
            <Field label={t('fieldChannel')} required error={err('channel')}>
              <Controller
                control={control}
                name="channel"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    options={MESSAGE_CHANNELS.map((c) => ({
                      value: c,
                      label: e('messageChannel', c),
                      icon: <ChannelIcon channel={c} />,
                    }))}
                  />
                )}
              />
            </Field>
            <Field label={t('fieldLanguage')} required error={err('language')}>
              <Controller
                control={control}
                name="language"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    options={LANGUAGES.map((l) => ({
                      value: l,
                      label: LANGUAGE_NAMES[l],
                    }))}
                  />
                )}
              />
            </Field>
          </div>
          <Field
            label={t('fieldBody')}
            required
            hint={t('bodyCount', { count: body.length, max: BODY_MAX })}
            error={err('body')}
          >
            <Textarea
              {...bodyField}
              ref={(el) => {
                bodyField.ref(el)
                bodyRef.current = el
              }}
              rows={6}
              maxLength={BODY_MAX}
            />
          </Field>
          <div>
            <p className="text-sm font-medium text-fg-muted">
              {t('placeholdersTitle')}
            </p>
            <p className="mt-0.5 text-xs text-fg-subtle">
              {t('placeholdersHint')}
            </p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {PLACEHOLDERS.map((key) => (
                <li key={key}>
                  <button
                    type="button"
                    onClick={() => insert(key)}
                    aria-label={t('insertPlaceholder', {
                      label: t(PLACEHOLDER_HINT[key]),
                    })}
                    className="focus-ring tap-reach inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-2.5 text-xs text-fg transition-colors hover:bg-surface-3"
                  >
                    <span className="font-mono font-semibold text-accent-text">
                      {`{${key}}`}
                    </span>
                    <span className="text-fg-muted">
                      {t(PLACEHOLDER_HINT[key])}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <Field
            label={t('fieldDlt')}
            required={channel === 'sms' && active}
            optionalLabel={tc('optional')}
            hint={t('fieldDltHint')}
            error={err('dltTemplateId')}
          >
            <Input
              {...register('dltTemplateId')}
              inputMode="numeric"
              maxLength={25}
              autoComplete="off"
              className="font-mono tabular-nums"
            />
          </Field>
          <Controller
            control={control}
            name="active"
            render={({ field }) => (
              <SwitchRow
                id="template-active"
                label={t('fieldTemplateActive')}
                hint={t('fieldTemplateActiveHint')}
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            )}
          />
        </div>

        <section
          aria-labelledby="template-preview-title"
          className="grid content-start gap-3 self-start rounded-xl border border-line bg-surface-2 p-4 lg:sticky lg:top-0"
        >
          <div className="flex items-center gap-2">
            <EyeIcon className="size-4 text-fg-muted" aria-hidden />
            <h3
              id="template-preview-title"
              className="text-sm font-semibold text-fg"
            >
              {t('previewTitle')}
            </h3>
          </div>
          <p className="text-xs text-fg-subtle">{t('previewHint')}</p>
          <div className="flex items-center gap-1.5 text-xs text-fg-muted">
            <ChannelIcon channel={channel} />
            {e('messageChannel', channel)}
          </div>
          <div aria-live="polite">
            {preview ? (
              <p className="rounded-xl rounded-tl-sm border border-border bg-surface px-3.5 py-3 text-sm leading-relaxed break-words whitespace-pre-line text-fg shadow-card">
                {preview}
              </p>
            ) : (
              <p className="rounded-xl border border-dashed border-line px-3.5 py-3 text-meta text-fg-muted">
                {t('previewEmpty')}
              </p>
            )}
          </div>
          {unknown.length ? (
            <p className="flex items-start gap-2 text-xs text-warning-text">
              <TriangleAlertIcon
                className="mt-0.5 size-3.5 shrink-0"
                aria-hidden
              />
              {t('unknownPlaceholders', {
                names: unknown.map((k) => `{${k}}`).join(', '),
              })}
            </p>
          ) : null}
          <p className="text-xs text-fg-subtle">{t('previewNotSent')}</p>
        </section>
      </form>
    </Dialog>
  )
}
