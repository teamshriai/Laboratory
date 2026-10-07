import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, XIcon } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { z } from '@/features/shared/zod'
import {
  CONTAINERS,
  DEPARTMENTS,
  SPECIAL_INSTRUCTIONS,
  SPECIMENS,
  STORAGE_CONDITIONS,
} from '@/domain/types'
import { useEnum, useT } from '@/i18n/context'
import { cn } from '@/lib/cn'
import {
  labApi,
  type CatalogTest,
  type NewAnalyteInput,
} from '@/services/lab-api'
import { useLabMutation } from '@/services/mutations'
import { useAnalytes, useReference } from '@/services/queries'
import { Button } from '@/components/ui/button'
import { GuardedButton } from '@/components/lab/guarded-button'
import { Combobox } from '@/components/ui/combobox'
import { Dialog } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { IconButton } from '@/components/ui/icon-button'
import { Input, Textarea } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Checkbox, Switch } from '@/components/ui/toggles'
import { useFormMessage } from './catalog-helpers'
import { RangeRows } from './range-editor'
import { rangesFromRows, type RangeRow } from './range-rows'
import { FormErrorSummary } from '@/components/ui/form-errors'
import { focusFirstInvalid } from '@/lib/focus'
import { countFieldErrors, focusInvalid } from '@/lib/form-errors'

const numberText = (
  msg: string,
  opts: { min?: number; optional?: boolean } = {},
) =>
  z
    .string()
    .trim()
    .refine(
      (v) =>
        (opts.optional && v === '') ||
        (Number.isFinite(Number(v)) && Number(v) >= (opts.min ?? 0)),
      msg,
    )

const schema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'catalog.nameTooShort')
      .max(120, 'catalog.nameTooLong'),
    code: z
      .string()
      .trim()
      .min(1, 'forms.required')
      .max(16, 'catalog.codeTooLong')
      .regex(/^[A-Z0-9-]+$/, 'catalog.codeFormat'),
    shortName: z
      .string()
      .trim()
      .min(1, 'forms.required')
      .max(24, 'catalog.shortNameTooLong'),
    department: z.enum(DEPARTMENTS, { message: 'forms.selectOne' }),
    category: z.string().trim().max(60, 'forms.tooLong'),
    method: z.string().trim().max(80, 'catalog.methodTooLong'),
    loinc: z
      .string()
      .trim()
      .regex(/^(\d{1,7}-\d)?$/, 'catalog.loincFormat'),
    changeReason: z.string().trim().max(200, 'forms.tooLong'),
    description: z.string().trim().max(400, 'forms.tooLong'),
    specimen: z.enum(SPECIMENS, { message: 'forms.selectOne' }),
    container: z.enum(CONTAINERS, { message: 'forms.selectOne' }),
    volumeMl: numberText('forms.positive', { optional: true }),
    minVolumeMl: numberText('forms.positive', { optional: true }),
    stabilityHours: numberText('forms.positive', { optional: true }),
    storage: z.enum(STORAGE_CONDITIONS),
    fasting: z.boolean(),
    instructions: z.array(z.enum(SPECIAL_INSTRUCTIONS)),
    tatHours: numberText('forms.positive', { min: 0.25 }),
    statTatHours: numberText('forms.positive', { min: 0.25 }),
    keywords: z.string().max(200, 'catalog.keywordsTooLong'),
    price: numberText('catalog.priceInvalid'),
    priceInsurance: numberText('catalog.priceInvalid', { optional: true }),
    analyteIds: z.array(z.string()),
    consentRequired: z.boolean(),
    accredited: z.boolean(),
    sendOutLabId: z.string(),
    commentTemplates: z.string().max(4000, 'forms.tooLong'),
  })
  .refine((v) => Number(v.statTatHours) <= Number(v.tatHours), {
    path: ['statTatHours'],
    message: 'catalog.statTatTooLong',
  })

type FormIn = z.input<typeof schema>
type FormOut = z.output<typeof schema>

/** Select value for "done in this lab" (Radix Select has no empty value). */
const IN_HOUSE = 'in-house'

const templateLines = (text: string) =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

const SECTIONS = [
  'general',
  'specimen',
  'processing',
  'policy',
  'result',
  'range',
  'billing',
] as const
type Section = (typeof SECTIONS)[number]

function Group({
  id,
  title,
  children,
}: {
  id: string
  title: string
  children: ReactNode
}) {
  return (
    <section
      id={id}
      className="scroll-mt-4 border-b border-line pb-6 last:border-0"
    >
      <h3 className="mb-4 text-sm font-semibold text-fg">{title}</h3>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  )
}

function SwitchRow({
  id,
  label,
  hint,
  checked,
  onCheckedChange,
}: {
  id: string
  label: string
  hint: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-line p-3.5">
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm font-medium text-fg">
          {label}
        </label>
        <p className="mt-0.5 text-xs text-fg-muted">{hint}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}

export function TestFormDialog({
  test,
  onClose,
  onSaved,
}: {
  test?: CatalogTest | undefined
  onClose: () => void
  onSaved?: (id: string) => void
}) {
  const t = useT('catalog')
  const tc = useT('common')
  const e = useEnum()
  const msg = useFormMessage()
  const { data: analytes } = useAnalytes()
  const { data: reference } = useReference()
  const [section, setSection] = useState<Section>('general')
  const [newParam, setNewParam] = useState<{
    name: string
    unit: string
    resultType: NewAnalyteInput['resultType']
    decimals: string
  } | null>(null)
  const [newRows, setNewRows] = useState<RangeRow[]>([])
  const [paramError, setParamError] = useState<string | null>(null)
  const form = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: test?.name ?? '',
      code: test?.code ?? '',
      shortName: test?.shortName ?? '',
      department: test?.department ?? 'biochemistry',
      category: test?.category ?? '',
      method: test?.method ?? '',
      loinc: test?.loinc ?? '',
      changeReason: '',
      description: test?.description ?? '',
      specimen: test?.specimen ?? 'serum',
      container: test?.container ?? 'sst',
      volumeMl: test?.volumeMl?.toString() ?? '',
      minVolumeMl: test?.minVolumeMl?.toString() ?? '',
      stabilityHours: test?.stabilityHours?.toString() ?? '',
      storage: test?.storage ?? 'refrigerated',
      fasting: test?.fasting ?? false,
      instructions: test?.instructions ?? [],
      tatHours: test?.tatHours.toString() ?? '4',
      statTatHours: test?.statTatHours.toString() ?? '1',
      keywords: (test?.keywords ?? []).join(', '),
      price: test?.price.toString() ?? '',
      priceInsurance: test?.priceInsurance?.toString() ?? '',
      analyteIds: test?.analyteIds ?? [],
      consentRequired: test?.consentRequired ?? false,
      accredited: test?.accredited ?? true,
      sendOutLabId: test?.sendOutLabId || IN_HOUSE,
      commentTemplates: (test?.commentTemplates ?? []).join('\n'),
    },
  })
  const { register, control, handleSubmit, formState, setValue } = form
  const err = (k: keyof FormIn) => msg(formState.errors[k]?.message)
  const [selected, specimen] = useWatch({
    control,
    name: ['analyteIds', 'specimen'],
  })

  const save = useLabMutation(
    (v: FormOut) => {
      const num = (s: string) => (s.trim() === '' ? undefined : Number(s))
      const lab = v.sendOutLabId === IN_HOUSE ? '' : v.sendOutLabId
      const templates = templateLines(v.commentTemplates)
      const input = {
        name: v.name,
        code: v.code,
        shortName: v.shortName,
        department: v.department,
        specimen: v.specimen,
        container: v.container,
        volumeMl: num(v.volumeMl) ?? null,
        fasting: v.fasting,
        instructions: v.instructions,
        tatHours: Number(v.tatHours),
        statTatHours: Number(v.statTatHours),
        price: Number(v.price),
        analyteIds: v.analyteIds,
        storage: v.storage,
        ...(v.method ? { method: v.method } : {}),
        ...(v.loinc ? { loinc: v.loinc } : {}),
        ...(v.category ? { category: v.category } : {}),
        ...(v.description ? { description: v.description } : {}),
        ...(num(v.minVolumeMl) !== undefined
          ? { minVolumeMl: num(v.minVolumeMl)! }
          : {}),
        ...(num(v.stabilityHours) !== undefined
          ? { stabilityHours: num(v.stabilityHours)! }
          : {}),
        ...(num(v.priceInsurance) !== undefined
          ? { priceInsurance: num(v.priceInsurance)! }
          : {}),
        keywords: v.keywords
          .split(',')
          .map((k) => k.trim())
          .filter(Boolean),
        // Only send what is set or changed, so an untouched default does not
        // count as an edit (and a new version) of an existing test.
        ...(v.consentRequired || test?.consentRequired !== undefined
          ? { consentRequired: v.consentRequired }
          : {}),
        ...(!v.accredited || test?.accredited !== undefined
          ? { accredited: v.accredited }
          : {}),
        ...(lab || test?.sendOutLabId ? { sendOutLabId: lab } : {}),
        ...(templates.length || test?.commentTemplates
          ? { commentTemplates: templates }
          : {}),
      }
      const extra: NewAnalyteInput | undefined = newParam
        ? {
            name: newParam.name,
            unit: newParam.unit,
            resultType: newParam.resultType,
            decimals: Number(newParam.decimals || 1),
            ranges: rangesFromRows(newRows) ?? [],
          }
        : undefined
      return test
        ? labApi.catalog
            .update(test.id, input, v.changeReason, extra)
            .then(() => test.id)
        : labApi.catalog.create(input, extra)
    },
    {
      success: (_, v) =>
        test
          ? {
              title: t('testUpdated', { test: v.name }),
              description: t('testUpdatedBody'),
            }
          : {
              title: t('testCreated', { test: v.name }),
              description: t('testCreatedBody', { code: v.code }),
            },
      onSuccess: (id) => {
        onSaved?.(id)
        onClose()
      },
    },
  )

  const submit = (v: FormOut) => {
    // Every change to an existing test is audited with its reason.
    if (test && !v.changeReason) {
      form.setError('changeReason', {
        message: 'catalog.changeReasonRequired',
      })
      document.getElementById('tf-change-reason')?.focus()
      return
    }
    if (newParam) {
      if (newParam.name.trim().length < 2)
        return setParamError(t('nameTooShort'))
      if (
        newParam.resultType === 'numeric' &&
        newRows.length &&
        !rangesFromRows(newRows)
      )
        return setParamError(t('rangeNeedsValue'))
    } else if (v.analyteIds.length === 0)
      return setParamError(t('analytesRequired'))
    setParamError(null)
    save.mutate(v)
  }
  const onInvalid = () => {
    const first = Object.keys(formState.errors)[0]
    const map: Record<string, Section> = {
      specimen: 'specimen',
      container: 'specimen',
      volumeMl: 'specimen',
      tatHours: 'processing',
      statTatHours: 'processing',
      commentTemplates: 'policy',
      price: 'billing',
    }
    const target = map[first ?? ''] ?? 'general'
    setSection(target)
    document
      .getElementById(`tf-${target}`)
      ?.scrollIntoView({ behavior: 'smooth' })
    focusInvalid()
  }

  const byId = new Map((analytes ?? []).map((a) => [a.id, a]))
  const move = (i: number, d: -1 | 1) => {
    const next = [...selected]
    const [item] = next.splice(i, 1)
    next.splice(i + d, 0, item!)
    setValue('analyteIds', next, { shouldDirty: true })
  }
  const sectionLabel: Record<Section, string> = {
    general: t('formSectionGeneral'),
    specimen: t('sectionSpecimen'),
    processing: t('sectionProcessing'),
    policy: t('formSectionPolicy'),
    result: t('formSectionResult'),
    range: t('formSectionRange'),
    billing: t('formSectionBilling'),
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      dirty={formState.isDirty}
      size="xl"
      title={test ? t('formEditTitle', { test: test.name }) : t('formNewTitle')}
      description={test ? t('formEditDescription') : undefined}
      footer={
        <>
          {test ? (
            <Field
              label={t('changeReason')}
              required
              error={err('changeReason')}
              className="mr-auto w-full sm:max-w-sm"
            >
              <Input
                id="tf-change-reason"
                {...register('changeReason')}
                placeholder={t('changeReasonPlaceholder')}
              />
            </Field>
          ) : null}
          <Button variant="ghost" onClick={onClose}>
            {tc('cancel')}
          </Button>
          <GuardedButton
            permission="catalog.edit"
            variant="primary"
            loading={save.isPending}
            onClick={() => void handleSubmit(submit, onInvalid)()}
          >
            {test ? t('saveTest') : t('createTest')}
          </GuardedButton>
        </>
      }
    >
      <div className="grid gap-6 md:grid-cols-[10rem_minmax(0,1fr)]">
        <nav aria-label={t('formNewTitle')} className="hidden md:block">
          <ul className="sticky top-0 grid gap-0.5">
            {SECTIONS.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  onClick={() => {
                    setSection(s)
                    document
                      .getElementById(`tf-${s}`)
                      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }}
                  className={cn(
                    'w-full rounded-lg px-3 py-1.5 text-left text-meta',
                    section === s
                      ? 'bg-accent-soft font-medium text-accent-text'
                      : 'text-fg-muted hover:bg-surface-2 hover:text-fg',
                  )}
                >
                  {sectionLabel[s]}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <form
          className="grid gap-6"
          noValidate
          onSubmit={(ev) => void handleSubmit(submit, onInvalid)(ev)}
        >
          <FormErrorSummary
            count={
              formState.submitCount ? countFieldErrors(formState.errors) : 0
            }
            onFocusFirst={() => focusFirstInvalid()}
          />
          <Group id="tf-general" title={sectionLabel.general}>
            <Field
              label={t('nameLabel')}
              required
              error={err('name')}
              className="sm:col-span-2"
            >
              <Input {...register('name')} />
            </Field>
            <Field
              label={t('codeLabel')}
              required
              error={err('code')}
              hint={t('codeHint')}
            >
              <Input
                {...register('code', {
                  setValueAs: (v: string) => v.toUpperCase(),
                })}
                className="font-mono uppercase"
                placeholder="LAB-BIO-060"
              />
            </Field>
            <Field
              label={t('shortNameLabel')}
              required
              error={err('shortName')}
              hint={t('shortNameHint')}
            >
              <Input {...register('shortName')} />
            </Field>
            <Field
              label={t('departmentLabel')}
              required
              error={err('department')}
            >
              <Controller
                control={control}
                name="department"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    options={DEPARTMENTS.map((d) => ({
                      value: d,
                      label: e('department', d),
                    }))}
                  />
                )}
              />
            </Field>
            <Field
              label={t('categoryLabel')}
              optionalLabel={tc('optional')}
              error={err('category')}
            >
              <Input
                {...register('category')}
                placeholder={t('categoryPlaceholder')}
              />
            </Field>
            <Field
              label={t('methodLabel')}
              optionalLabel={tc('optional')}
              error={err('method')}
              className="sm:col-span-2"
            >
              <Input
                {...register('method')}
                placeholder={t('methodPlaceholder')}
              />
            </Field>
            <Field
              label={t('loincLabel')}
              optionalLabel={tc('optional')}
              hint={t('loincHint')}
              error={err('loinc')}
            >
              <Input
                {...register('loinc')}
                inputMode="numeric"
                placeholder="718-7"
              />
            </Field>
            <Field
              label={t('descriptionLabel')}
              optionalLabel={tc('optional')}
              error={err('description')}
              className="sm:col-span-2"
            >
              <Textarea
                {...register('description')}
                rows={2}
                placeholder={t('descriptionPlaceholder')}
              />
            </Field>
          </Group>

          <Group id="tf-specimen" title={sectionLabel.specimen}>
            <Field label={t('specimenLabel')} required error={err('specimen')}>
              <Controller
                control={control}
                name="specimen"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    options={SPECIMENS.map((s) => ({
                      value: s,
                      label: e('specimen', s),
                    }))}
                  />
                )}
              />
            </Field>
            <Field
              label={t('containerLabel')}
              required
              error={err('container')}
            >
              <Controller
                control={control}
                name="container"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    options={CONTAINERS.map((c) => ({
                      value: c,
                      label: e('container', c),
                    }))}
                  />
                )}
              />
            </Field>
            <Field label={t('volumeLabel')} error={err('volumeMl')}>
              <Input
                {...register('volumeMl')}
                inputMode="decimal"
                className="tabular-nums"
              />
            </Field>
            <Field
              label={t('minVolumeLabel')}
              optionalLabel={tc('optional')}
              error={err('minVolumeMl')}
            >
              <Input
                {...register('minVolumeMl')}
                inputMode="decimal"
                className="tabular-nums"
              />
            </Field>
            <Field
              label={t('stabilityLabel')}
              optionalLabel={tc('optional')}
              error={err('stabilityHours')}
            >
              <Input
                {...register('stabilityHours')}
                inputMode="decimal"
                className="tabular-nums"
              />
            </Field>
            <Field label={t('storageLabel')}>
              <Controller
                control={control}
                name="storage"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    options={STORAGE_CONDITIONS.map((s) => ({
                      value: s,
                      label: e('storage', s),
                    }))}
                  />
                )}
              />
            </Field>
            <div className="sm:col-span-2">
              <Controller
                control={control}
                name="fasting"
                render={({ field }) => (
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    label={t('fastingLabel')}
                  />
                )}
              />
            </div>
            <Field
              label={t('instructionsLabel')}
              hint={t('instructionsHint')}
              className="sm:col-span-2"
            >
              <Controller
                control={control}
                name="instructions"
                render={({ field }) => (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {SPECIAL_INSTRUCTIONS.map((i) => (
                      <Checkbox
                        key={i}
                        checked={field.value.includes(i)}
                        onCheckedChange={(on) =>
                          field.onChange(
                            on
                              ? [...field.value, i]
                              : field.value.filter((x) => x !== i),
                          )
                        }
                        label={e('instruction', i)}
                      />
                    ))}
                  </div>
                )}
              />
            </Field>
          </Group>

          <Group id="tf-processing" title={sectionLabel.processing}>
            <Field
              label={t('tatRoutineLabel')}
              required
              error={err('tatHours')}
            >
              <Input
                {...register('tatHours')}
                inputMode="decimal"
                className="tabular-nums"
              />
            </Field>
            <Field
              label={t('tatStatLabel')}
              required
              error={err('statTatHours')}
            >
              <Input
                {...register('statTatHours')}
                inputMode="decimal"
                className="tabular-nums"
              />
            </Field>
            <Field
              label={t('keywordsLabel')}
              hint={t('keywordsHint')}
              error={err('keywords')}
              className="sm:col-span-2"
            >
              <Input {...register('keywords')} />
            </Field>
          </Group>

          <Group id="tf-policy" title={sectionLabel.policy}>
            <Controller
              control={control}
              name="consentRequired"
              render={({ field }) => (
                <SwitchRow
                  id="tf-consent-required"
                  label={t('consentRequiredLabel')}
                  hint={t('consentRequiredHint')}
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
            <Controller
              control={control}
              name="accredited"
              render={({ field }) => (
                <SwitchRow
                  id="tf-accredited"
                  label={t('accreditedLabel')}
                  hint={t('accreditedHint')}
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
            <Field
              label={t('sendOutLabLabel')}
              hint={t('sendOutLabHint')}
              className="sm:col-span-2"
            >
              <Controller
                control={control}
                name="sendOutLabId"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    options={[
                      { value: IN_HOUSE, label: t('sendOutInHouse') },
                      ...(reference?.referralLabs ?? [])
                        .filter((l) => l.active || l.id === field.value)
                        .map((l) => ({
                          value: l.id,
                          label: l.nablAccredited
                            ? t('referralLabOption', {
                                name: l.name,
                                city: l.city,
                              })
                            : t('referralLabOptionNotNabl', {
                                name: l.name,
                                city: l.city,
                              }),
                        })),
                    ]}
                  />
                )}
              />
            </Field>
            <Field
              label={t('commentTemplatesLabel')}
              hint={t('commentTemplatesHint')}
              optionalLabel={tc('optional')}
              error={err('commentTemplates')}
              className="sm:col-span-2"
            >
              <Textarea {...register('commentTemplates')} rows={4} />
            </Field>
          </Group>

          <section
            id="tf-result"
            className="scroll-mt-4 border-b border-line pb-6"
          >
            <h3 className="mb-1 text-sm font-semibold text-fg">
              {sectionLabel.result}
            </h3>
            <p className="mb-3 text-xs text-fg-muted">{t('analytesHint')}</p>
            <Combobox
              value={undefined}
              onValueChange={(id) => {
                if (!selected.includes(id))
                  setValue('analyteIds', [...selected, id], {
                    shouldDirty: true,
                  })
              }}
              placeholder={t('analyteSearch')}
              searchPlaceholder={t('analyteSearchPlaceholder')}
              emptyText={t('noAnalytesFound')}
              options={(analytes ?? [])
                .filter((a) => !selected.includes(a.id))
                .map((a) => ({
                  value: a.id,
                  label: a.name,
                  description: `${a.unit || t('noUnit')} · ${t(`resultType${a.resultType[0]!.toUpperCase()}${a.resultType.slice(1)}` as 'resultTypeNumeric')}`,
                }))}
            />
            <ol className="mt-3 divide-y divide-line rounded-xl border border-line">
              {selected.length === 0 && !newParam ? (
                <li className="px-4 py-3 text-meta text-fg-muted">
                  {t('analyteNone')}
                </li>
              ) : null}
              {selected.map((id, i) => {
                const a = byId.get(id)
                return (
                  <li key={id} className="flex items-center gap-2 px-3 py-2">
                    <span className="w-6 text-xs text-fg-subtle tabular-nums">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-meta text-fg">
                      {a?.name ?? id}{' '}
                      <span className="text-xs text-fg-muted">{a?.unit}</span>
                    </span>
                    <IconButton
                      label={t('moveUp', { analyte: a?.name ?? id })}
                      icon={<ArrowUpIcon />}
                      size="icon-xs"
                      disabled={i === 0}
                      onClick={() => move(i, -1)}
                    />
                    <IconButton
                      label={t('moveDown', { analyte: a?.name ?? id })}
                      icon={<ArrowDownIcon />}
                      size="icon-xs"
                      disabled={i === selected.length - 1}
                      onClick={() => move(i, 1)}
                    />
                    <IconButton
                      label={t('removeAnalyte', { analyte: a?.name ?? id })}
                      icon={<XIcon />}
                      size="icon-xs"
                      onClick={() =>
                        setValue(
                          'analyteIds',
                          selected.filter((x) => x !== id),
                          { shouldDirty: true },
                        )
                      }
                    />
                  </li>
                )
              })}
            </ol>
            {newParam ? (
              <div className="mt-3 grid gap-3 rounded-xl border border-accent/30 bg-accent-soft/30 p-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.3fr)_5rem_auto]">
                <Field label={t('newParameterName')} required>
                  <Input
                    value={newParam.name}
                    onChange={(ev) =>
                      setNewParam({ ...newParam, name: ev.target.value })
                    }
                  />
                </Field>
                <Field label={t('newParameterUnit')}>
                  <Input
                    value={newParam.unit}
                    onChange={(ev) =>
                      setNewParam({ ...newParam, unit: ev.target.value })
                    }
                    placeholder="mg/dL"
                  />
                </Field>
                <Field label={t('newParameterType')}>
                  <Select
                    value={newParam.resultType}
                    onValueChange={(v) =>
                      setNewParam({ ...newParam, resultType: v })
                    }
                    options={[
                      {
                        value: 'numeric' as const,
                        label: t('resultTypeNumeric'),
                      },
                      {
                        value: 'posneg' as const,
                        label: t('resultTypePosneg'),
                      },
                      { value: 'text' as const, label: t('resultTypeText') },
                    ]}
                  />
                </Field>
                <Field label={t('newParameterDecimals')}>
                  <Input
                    value={newParam.decimals}
                    inputMode="numeric"
                    disabled={newParam.resultType !== 'numeric'}
                    onChange={(ev) =>
                      setNewParam({ ...newParam, decimals: ev.target.value })
                    }
                  />
                </Field>
                <div className="flex items-end">
                  <IconButton
                    label={t('newParameterRemove')}
                    icon={<XIcon />}
                    onClick={() => setNewParam(null)}
                  />
                </div>
              </div>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                className="mt-2"
                onClick={() =>
                  setNewParam({
                    name: '',
                    unit: '',
                    resultType: 'numeric',
                    decimals: '1',
                  })
                }
              >
                <PlusIcon />
                {t('newParameter')}
              </Button>
            )}
            {paramError ? (
              <p className="mt-2 text-meta text-danger-text">{paramError}</p>
            ) : null}
          </section>

          <section
            id="tf-range"
            className="scroll-mt-4 border-b border-line pb-6"
          >
            <h3 className="mb-3 text-sm font-semibold text-fg">
              {sectionLabel.range}
            </h3>
            {newParam && newParam.resultType === 'numeric' ? (
              <>
                <p className="mb-2 text-meta font-medium text-fg">
                  {t('rangeForNew', {
                    analyte: newParam.name || t('newParameter'),
                  })}
                </p>
                <RangeRows
                  rows={newRows}
                  onChange={setNewRows}
                  specimens={[specimen]}
                />
              </>
            ) : null}
            <p className="mt-2 text-xs text-fg-muted">
              {t('rangeExistingNote')}
            </p>
          </section>

          <Group id="tf-billing" title={sectionLabel.billing}>
            <Field label={t('priceLabel')} required error={err('price')}>
              <Input
                {...register('price')}
                inputMode="numeric"
                className="tabular-nums"
              />
            </Field>
            <Field
              label={t('priceInsuranceLabel')}
              optionalLabel={tc('optional')}
              error={err('priceInsurance')}
            >
              <Input
                {...register('priceInsurance')}
                inputMode="numeric"
                className="tabular-nums"
              />
            </Field>
          </Group>
        </form>
      </div>
    </Dialog>
  )
}
