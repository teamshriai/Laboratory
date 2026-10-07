import { zodResolver } from '@hookform/resolvers/zod'
import { Trash2Icon } from 'lucide-react'
import {
  Controller,
  useFieldArray,
  useForm,
  useWatch,
  type FieldErrors,
} from 'react-hook-form'
import { z } from '@/features/shared/zod'
import { isGstin } from '@/domain/billing'
import {
  ACCOUNT_KINDS,
  type CreditAccount,
  type PriceList,
  type TestPackage,
} from '@/domain/types'
import { useEnum, useT } from '@/i18n/context'
import { focusFirstInvalid } from '@/lib/focus'
import { countFieldErrors, focusInvalid } from '@/lib/form-errors'
import { isLabApiError, labApi } from '@/services/lab-api'
import { useLabMutation } from '@/services/mutations'
import { useOrderableTests } from '@/services/queries'
import { TestPicker } from '@/components/lab/test-picker'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import { Dialog } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { FormErrorSummary } from '@/components/ui/form-errors'
import { IconButton } from '@/components/ui/icon-button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/toggles'
import { parseAmount, useBillingMessage, useMoney } from './billing'

const amountText = z
  .string()
  .trim()
  .min(1, 'forms.required')
  .refine((v) => (parseAmount(v) ?? 0) > 0, 'forms.positive')

function ActiveSwitch({
  checked,
  onCheckedChange,
}: {
  checked: boolean
  onCheckedChange: (v: boolean) => void
}) {
  const t = useT('billing')
  return (
    <label className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-line px-4 py-2">
      <span>
        <span className="block text-sm font-medium text-fg">{t('active')}</span>
        <span className="block text-xs text-fg-muted">{t('activeHint')}</span>
      </span>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        label={t('active')}
      />
    </label>
  )
}

function Footer({
  onCancel,
  onSave,
  loading,
}: {
  onCancel: () => void
  onSave: () => void
  loading: boolean
}) {
  const tc = useT('common')
  return (
    <>
      <Button variant="ghost" onClick={onCancel}>
        {tc('cancel')}
      </Button>
      <Button variant="primary" loading={loading} onClick={onSave}>
        {tc('save')}
      </Button>
    </>
  )
}

const errorCount = (formState: { submitCount: number; errors: FieldErrors }) =>
  formState.submitCount ? countFieldErrors(formState.errors) : 0

// ---------- Packages ----------

const packageSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'forms.required')
    .max(16, 'forms.invalid')
    .regex(/^[A-Za-z0-9-]+$/, 'billing.codeFormat'),
  name: z.string().trim().min(2, 'forms.required').max(120, 'forms.invalid'),
  price: amountText,
  active: z.boolean(),
  testIds: z.array(z.string()).min(2, 'billing.atLeastTwoTests'),
})

export function PackageDialog({
  pkg,
  onClose,
}: {
  pkg?: TestPackage | undefined
  onClose: () => void
}) {
  const t = useT('billing')
  const money = useMoney()
  const msg = useBillingMessage()
  const { data: tests } = useOrderableTests()
  const form = useForm<
    z.input<typeof packageSchema>,
    unknown,
    z.output<typeof packageSchema>
  >({
    resolver: zodResolver(packageSchema),
    defaultValues: {
      code: pkg?.code ?? '',
      name: pkg?.name ?? '',
      price: pkg ? String(pkg.price) : '',
      active: pkg?.active ?? true,
      testIds: pkg?.testIds ?? [],
    },
  })
  const { register, control, handleSubmit, formState, setError } = form
  const testIds = useWatch({ control, name: 'testIds' })
  const separate = (tests ?? [])
    .filter((x) => testIds.includes(x.id))
    .reduce((n, x) => n + x.price, 0)
  const save = useLabMutation(
    (input: Omit<TestPackage, 'id'> & { id?: string }) =>
      labApi.billing.savePackage(input),
    {
      success: (_, v) => t('packageSaved', { name: v.name }),
      onSuccess: onClose,
      onError: (error) => {
        if (isLabApiError(error) && error.code === 'duplicate-code')
          setError('code', { message: 'billing.codeTaken' })
      },
    },
  )
  const submit = (v: z.output<typeof packageSchema>) =>
    save.mutate({
      ...(pkg ? { id: pkg.id } : {}),
      code: v.code.toUpperCase(),
      name: v.name,
      price: parseAmount(v.price) ?? 0,
      active: v.active,
      testIds: v.testIds,
    })
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      dirty={formState.isDirty}
      size="lg"
      title={pkg ? t('editPackage') : t('newPackage')}
      description={t('packageDescription')}
      footer={
        <Footer
          onCancel={onClose}
          loading={save.isPending}
          onSave={() => void handleSubmit(submit, focusInvalid)()}
        />
      }
    >
      <form
        className="grid gap-4"
        noValidate
        onSubmit={(ev) => void handleSubmit(submit, focusInvalid)(ev)}
      >
        <FormErrorSummary
          count={errorCount(formState)}
          onFocusFirst={() => focusFirstInvalid()}
        />
        <div className="grid gap-4 sm:grid-cols-[10rem_minmax(0,1fr)]">
          <Field
            label={t('code')}
            required
            error={msg(formState.errors.code?.message)}
          >
            <Input
              {...register('code')}
              maxLength={16}
              autoComplete="off"
              className="font-mono uppercase"
            />
          </Field>
          <Field
            label={t('name')}
            required
            error={msg(formState.errors.name?.message)}
          >
            <Input {...register('name')} maxLength={120} autoComplete="off" />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t('packagePrice')}
            required
            hint={
              testIds.length
                ? t('separatePrice', { amount: money(separate) })
                : undefined
            }
            error={msg(formState.errors.price?.message)}
          >
            <Input
              {...register('price')}
              inputMode="decimal"
              autoComplete="off"
              className="tabular-nums"
            />
          </Field>
          <Controller
            control={control}
            name="active"
            render={({ field }) => (
              <ActiveSwitch
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            )}
          />
        </div>
        <Field
          label={t('packageTests', { count: testIds.length })}
          required
          error={msg(formState.errors.testIds?.message)}
        >
          <div>
            <Controller
              control={control}
              name="testIds"
              render={({ field }) => (
                <TestPicker
                  tests={tests ?? []}
                  selected={field.value}
                  onToggle={(id) =>
                    field.onChange(
                      field.value.includes(id)
                        ? field.value.filter((x) => x !== id)
                        : [...field.value, id],
                    )
                  }
                  maxHeight="40dvh"
                />
              )}
            />
          </div>
        </Field>
      </form>
    </Dialog>
  )
}

// ---------- Credit accounts ----------

const accountSchema = z.object({
  name: z.string().trim().min(2, 'forms.required').max(120, 'forms.invalid'),
  kind: z.enum(ACCOUNT_KINDS, { error: 'forms.selectOne' }),
  gstin: z
    .string()
    .trim()
    .refine((v) => v === '' || isGstin(v), 'billing.gstinFormat'),
  creditLimit: z
    .string()
    .trim()
    .min(1, 'forms.required')
    .refine((v) => {
      const n = parseAmount(v)
      return n !== null && n >= 0
    }, 'forms.invalidNumber'),
  contact: z.string().trim().max(120, 'forms.invalid'),
  priceListId: z.string(),
  active: z.boolean(),
})

export function AccountDialog({
  account,
  priceLists,
  onClose,
}: {
  account?: CreditAccount | undefined
  priceLists: PriceList[]
  onClose: () => void
}) {
  const t = useT('billing')
  const e = useEnum()
  const tc = useT('common')
  const msg = useBillingMessage()
  const form = useForm<
    z.input<typeof accountSchema>,
    unknown,
    z.output<typeof accountSchema>
  >({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      name: account?.name ?? '',
      ...(account ? { kind: account.kind } : {}),
      gstin: account?.gstin ?? '',
      creditLimit: account ? String(account.creditLimit) : '',
      contact: account?.contact ?? '',
      priceListId: account?.priceListId ?? 'none',
      active: account?.active ?? true,
    },
  })
  const { register, control, handleSubmit, formState } = form
  const save = useLabMutation(
    (input: Omit<CreditAccount, 'id'> & { id?: string }) =>
      labApi.billing.saveAccount(input),
    {
      success: (_, v) => t('accountSaved', { name: v.name }),
      onSuccess: onClose,
    },
  )
  const submit = (v: z.output<typeof accountSchema>) =>
    save.mutate({
      ...(account ? { id: account.id } : {}),
      name: v.name,
      kind: v.kind,
      creditLimit: parseAmount(v.creditLimit) ?? 0,
      contact: v.contact,
      active: v.active,
      ...(v.gstin ? { gstin: v.gstin.toUpperCase() } : {}),
      ...(v.priceListId !== 'none' ? { priceListId: v.priceListId } : {}),
    })
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      dirty={formState.isDirty}
      size="lg"
      title={account ? t('editAccount') : t('newAccount')}
      description={t('accountDescription')}
      footer={
        <Footer
          onCancel={onClose}
          loading={save.isPending}
          onSave={() => void handleSubmit(submit, focusInvalid)()}
        />
      }
    >
      <form
        className="grid gap-4"
        noValidate
        onSubmit={(ev) => void handleSubmit(submit, focusInvalid)(ev)}
      >
        <FormErrorSummary
          count={errorCount(formState)}
          onFocusFirst={() => focusFirstInvalid()}
        />
        <Field
          label={t('name')}
          required
          error={msg(formState.errors.name?.message)}
        >
          <Input {...register('name')} maxLength={120} autoComplete="off" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t('accountKind')}
            required
            error={msg(formState.errors.kind?.message)}
          >
            <Controller
              control={control}
              name="kind"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  placeholder={tc('selectPlaceholder')}
                  options={ACCOUNT_KINDS.map((k) => ({
                    value: k,
                    label: e('accountKind', k),
                  }))}
                />
              )}
            />
          </Field>
          <Field
            label={t('gstin')}
            optionalLabel={tc('optional')}
            hint={t('gstinHint')}
            error={msg(formState.errors.gstin?.message)}
          >
            <Input
              {...register('gstin')}
              maxLength={15}
              autoComplete="off"
              className="font-mono uppercase"
            />
          </Field>
          <Field
            label={t('creditLimit')}
            required
            error={msg(formState.errors.creditLimit?.message)}
          >
            <Input
              {...register('creditLimit')}
              inputMode="decimal"
              autoComplete="off"
              className="tabular-nums"
            />
          </Field>
          <Field
            label={t('priceList')}
            optionalLabel={tc('optional')}
            hint={t('priceListHint')}
          >
            <Controller
              control={control}
              name="priceListId"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  options={[
                    { value: 'none', label: t('catalogPrices') },
                    ...priceLists.map((p) => ({
                      value: p.id,
                      label: p.active ? p.name : `${p.name} (${t('inactive')})`,
                    })),
                  ]}
                />
              )}
            />
          </Field>
        </div>
        <Field
          label={t('contact')}
          optionalLabel={tc('optional')}
          error={msg(formState.errors.contact?.message)}
        >
          <Input {...register('contact')} maxLength={120} autoComplete="off" />
        </Field>
        <Controller
          control={control}
          name="active"
          render={({ field }) => (
            <ActiveSwitch
              checked={field.value}
              onCheckedChange={field.onChange}
            />
          )}
        />
      </form>
    </Dialog>
  )
}

// ---------- Price lists ----------

const priceListSchema = z.object({
  name: z.string().trim().min(2, 'forms.required').max(120, 'forms.invalid'),
  active: z.boolean(),
  prices: z.array(z.object({ testId: z.string(), price: amountText })),
})

export function PriceListDialog({
  list,
  onClose,
}: {
  list?: PriceList | undefined
  onClose: () => void
}) {
  const t = useT('billing')
  const money = useMoney()
  const msg = useBillingMessage()
  const { data: tests } = useOrderableTests()
  const form = useForm<
    z.input<typeof priceListSchema>,
    unknown,
    z.output<typeof priceListSchema>
  >({
    resolver: zodResolver(priceListSchema),
    defaultValues: {
      name: list?.name ?? '',
      active: list?.active ?? true,
      prices: Object.entries(list?.prices ?? {}).map(([testId, price]) => ({
        testId,
        price: String(price),
      })),
    },
  })
  const { register, control, handleSubmit, formState } = form
  const { fields, append, remove } = useFieldArray({ control, name: 'prices' })
  const listed = new Set(fields.map((x) => x.testId))
  const testById = new Map((tests ?? []).map((x) => [x.id, x]))
  const save = useLabMutation(
    (input: Omit<PriceList, 'id'> & { id?: string }) =>
      labApi.billing.savePriceList(input),
    {
      success: (_, v) => t('priceListSaved', { name: v.name }),
      onSuccess: onClose,
    },
  )
  const submit = (v: z.output<typeof priceListSchema>) =>
    save.mutate({
      ...(list ? { id: list.id } : {}),
      name: v.name,
      active: v.active,
      prices: Object.fromEntries(
        v.prices.map((p) => [p.testId, parseAmount(p.price) ?? 0]),
      ),
    })
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      dirty={formState.isDirty}
      size="lg"
      title={list ? t('editPriceList') : t('newPriceList')}
      description={t('priceListDescription')}
      footer={
        <Footer
          onCancel={onClose}
          loading={save.isPending}
          onSave={() => void handleSubmit(submit, focusInvalid)()}
        />
      }
    >
      <form
        className="grid gap-4"
        noValidate
        onSubmit={(ev) => void handleSubmit(submit, focusInvalid)(ev)}
      >
        <FormErrorSummary
          count={errorCount(formState)}
          onFocusFirst={() => focusFirstInvalid()}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t('name')}
            required
            error={msg(formState.errors.name?.message)}
          >
            <Input {...register('name')} maxLength={120} autoComplete="off" />
          </Field>
          <Controller
            control={control}
            name="active"
            render={({ field }) => (
              <ActiveSwitch
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            )}
          />
        </div>
        <Field label={t('addTestPrice')} hint={t('addTestPriceHint')}>
          <Combobox
            value={undefined}
            onValueChange={(id) => {
              const test = testById.get(id)
              if (test && !listed.has(id))
                append({ testId: id, price: String(test.price) })
            }}
            placeholder={t('chooseTest')}
            searchPlaceholder={t('searchTests')}
            emptyText={t('noTests')}
            options={(tests ?? [])
              .filter((x) => !listed.has(x.id))
              .map((x) => ({
                value: x.id,
                label: x.name,
                description: `${x.code} · ${money(x.price)}`,
                keywords: [x.code, x.shortName],
              }))}
          />
        </Field>
        {fields.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-fg-muted">
            {t('noPrices')}
          </p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
            {fields.map((row, i) => {
              const test = testById.get(row.testId)
              return (
                <li
                  key={row.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_10rem_auto]"
                >
                  <div className="min-w-0 sm:pt-2.5">
                    <p className="truncate text-sm font-medium text-fg">
                      {test?.name ?? row.testId}
                    </p>
                    <p className="text-xs text-fg-muted">
                      {t('catalogPrice', {
                        amount: test ? money(test.price) : '-',
                      })}
                    </p>
                  </div>
                  <Field
                    label={
                      <span className="sr-only">
                        {t('priceFor', { test: test?.name ?? row.testId })}
                      </span>
                    }
                    error={msg(formState.errors.prices?.[i]?.price?.message)}
                    className="col-start-1 row-start-2 sm:col-start-2 sm:row-start-1"
                  >
                    <Input
                      {...register(`prices.${i}.price`)}
                      inputMode="decimal"
                      autoComplete="off"
                      className="tabular-nums"
                    />
                  </Field>
                  <IconButton
                    label={t('removePrice', {
                      test: test?.name ?? row.testId,
                    })}
                    icon={<Trash2Icon />}
                    onClick={() => remove(i)}
                    className="col-start-2 row-start-1 sm:col-start-3"
                  />
                </li>
              )
            })}
          </ul>
        )}
      </form>
    </Dialog>
  )
}
