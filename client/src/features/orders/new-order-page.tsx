import { zodResolver } from '@hookform/resolvers/zod'
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  HistoryIcon,
  DropletIcon,
  SaveIcon,
  InfoIcon,
  ZapIcon,
  PencilIcon,
  PrinterIcon,
  UserPlusIcon,
  XIcon,
  ChevronsUpIcon,
  ClockIcon,
} from 'lucide-react'
import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useNavigate, useSearchParams } from 'react-router'
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes'
import { UnsavedChangesDialog } from '@/components/ui/unsaved-dialog'
import { toast } from 'sonner'
import { z } from '@/features/shared/zod'
import { groupTestsIntoSamples } from '@/domain/grouping'
import { tatHoursFor } from '@/domain/tat'
import {
  CLINICAL_DEPARTMENTS,
  ENCOUNTER_TYPES,
  PRIORITIES,
  type LabTest,
} from '@/domain/types'
import { useRecentPatients } from '@/hooks/use-recent-patients'
import { useEnum, useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import { cn } from '@/lib/cn'
import {
  labApi,
  type OrderableTest,
  type PatientRow,
  type SampleRow,
} from '@/services/lab-api'
import { useLabMutation } from '@/services/mutations'
import {
  useOrder,
  useOrderableTests,
  usePatient,
  usePatients,
  useReference,
} from '@/services/queries'
import { PageHeader } from '@/app/layout/page-header'
import { LabelPrintDialog } from '@/components/lab/labels'
import { AgeSex, PatientCell } from '@/components/lab/patient'
import { ContainerChip, TubeDot } from '@/components/lab/sample'
import { OrderStatusBadge, PriorityBadge } from '@/components/lab/status'
import { TestPicker } from '@/components/lab/test-picker'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Combobox } from '@/components/ui/combobox'
import { Field } from '@/components/ui/field'
import { Input, SearchInput, Textarea } from '@/components/ui/input'
import { Avatar, Stepper } from '@/components/ui/misc'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/states'
import { EmptyState } from '@/components/ui/states'
import { ChoiceCards } from '@/components/ui/toggles'
import { RegisterPatientDialog } from '../patients/register-patient-dialog'
import { COMMON_PANELS } from './panels'
import { focusInvalid } from '@/lib/form-errors'

const schema = z.object({
  patientId: z.string().min(1, 'forms.required'),
  doctorId: z.string().min(1, 'forms.required'),
  department: z.enum(CLINICAL_DEPARTMENTS),
  encounter: z.enum(ENCOUNTER_TYPES),
  ward: z.string().max(40, 'forms.tooLong'),
  bed: z.string().max(12, 'forms.tooLong'),
  priority: z.enum(PRIORITIES),
  clinicalNotes: z.string().max(1000, 'forms.tooLong'),
  testIds: z.array(z.string()).min(1, 'forms.atLeastOneTest'),
})
type FormIn = z.input<typeof schema>
type FormOut = z.output<typeof schema>

const STEP_FIELDS: (keyof FormIn)[][] = [
  ['patientId'],
  [
    'doctorId',
    'department',
    'encounter',
    'priority',
    'ward',
    'bed',
    'clinicalNotes',
  ],
  ['testIds'],
  [],
  [],
]

function SelectedPatient({
  patientId,
  onChange,
}: {
  patientId: string
  onChange: () => void
}) {
  const t = useT('orders')
  const tc = useT('common')
  const e = useEnum()
  const { data, isError, refetch } = usePatient(patientId)
  if (isError && !data)
    return <ErrorState compact onRetry={() => void refetch()} />
  if (!data) return <Skeleton className="h-24 rounded-xl" />
  const p = data.patient
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-xl border border-accent/40 bg-accent-soft/40 p-4">
      <Avatar name={p.name} size="lg" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-accent-text">
          {t('selectedPatient')}
        </p>
        <p className="text-base font-semibold text-fg">
          {p.name}
          {p.nameLocal ? (
            <span
              lang={p.nameLocal.lang}
              className="ml-2 text-sm font-normal text-fg-muted"
            >
              {p.nameLocal.text}
            </span>
          ) : null}
        </p>
        <p className="mt-0.5 flex flex-wrap gap-x-3 text-meta text-fg-muted">
          <span className="font-mono">{p.uhid}</span>
          <AgeSex dob={p.dob} sex={p.sex} />
          <span>{p.mobile}</span>
          <span>
            {e('encounter', p.encounter.type)} ·{' '}
            {e('clinicalDepartment', p.encounter.department)}
          </span>
        </p>
        {p.allergies.length ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {p.allergies.map((a) => (
              <Badge key={a} tone="danger" size="sm">
                {tc('allergies')}: {a}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>
      <Button variant="secondary" size="sm" onClick={onChange}>
        <PencilIcon />
        {t('changePatient')}
      </Button>
    </div>
  )
}

function PatientStep({
  value,
  onSelect,
  onRegister,
}: {
  value: string
  onSelect: (id: string) => void
  onRegister: (name: string) => void
}) {
  const t = useT('orders')
  const f = useFormat()
  const { recent } = useRecentPatients()
  const [query, setQuery] = useState('')
  const q = useDeferredValue(query)
  const enabled = q.trim().length >= 2
  const { data, isFetching } = usePatients(enabled ? { q } : { q: '__none__' })
  const [changing, setChanging] = useState(!value)
  if (value && !changing)
    return (
      <SelectedPatient patientId={value} onChange={() => setChanging(true)} />
    )
  const results: PatientRow[] = enabled ? (data ?? []) : []
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          value={query}
          onValueChange={setQuery}
          placeholder={t('patientSearchPlaceholder')}
          aria-label={t('patientSearch')}
          className="min-w-64 flex-1"
          autoFocus
        />
        <Button onClick={() => onRegister(query)}>
          <UserPlusIcon />
          {t('registerPatient')}
        </Button>
      </div>
      {!enabled ? (
        recent.length ? (
          <div>
            <p className="mb-2 text-xs font-semibold tracking-wide text-fg-subtle uppercase">
              {t('recentPatients')}
            </p>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {recent.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    onSelect(p.id)
                    setChanging(false)
                  }}
                  className="flex items-center gap-3 rounded-xl border border-line p-3 text-left hover:border-accent/40 hover:bg-accent-soft/30"
                >
                  <HistoryIcon className="size-4 text-fg-subtle" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-fg">
                      {p.name}
                    </span>
                    <span className="block font-mono text-xs text-fg-muted">
                      {p.uhid}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-meta text-fg-muted">{t('patientSearchHint')}</p>
        )
      ) : results.length === 0 && !isFetching ? (
        <EmptyState
          compact
          icon={<UserPlusIcon />}
          title={t('noPatientsFound')}
          action={
            <Button variant="primary" onClick={() => onRegister(query)}>
              <UserPlusIcon />
              {t('registerPatient')}
            </Button>
          }
        />
      ) : (
        <div>
          <p className="mb-2 text-xs font-semibold tracking-wide text-fg-subtle uppercase">
            {t('searchResults')}
          </p>
          <ul className="grid gap-2 lg:grid-cols-2">
            {results.slice(0, 10).map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(p.id)
                    setChanging(false)
                  }}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors',
                    value === p.id
                      ? 'border-accent bg-accent-soft/50'
                      : 'border-line hover:border-accent/40 hover:bg-accent-soft/30',
                  )}
                >
                  <PatientCell patient={p} link={false} className="flex-1" />
                  <span className="shrink-0 text-right text-xs text-fg-muted">
                    {p.latestOrder
                      ? t('lastVisit', { date: f.date(p.lastVisitAt) })
                      : t('noVisit')}
                    {p.latestOrder ? (
                      <span className="mt-1 block">
                        <OrderStatusBadge
                          status={p.latestOrder.status}
                          size="sm"
                        />
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function SampleRequirements({
  tests,
  priority,
}: {
  tests: OrderableTest[]
  priority: FormIn['priority']
}) {
  const t = useT('orders')
  const tc = useT('common')
  const e = useEnum()
  const f = useFormat()
  const groups = groupTestsIntoSamples(tests as unknown as LabTest[])
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {groups.map((g, i) => {
        const groupTests = tests.filter((x) => g.testIds.includes(x.id))
        const instructions = [
          ...new Set(groupTests.flatMap((x) => x.instructions)),
        ]
        const tat = Math.max(
          ...groupTests.map((x) => tatHoursFor(x, priority ?? 'routine')),
        )
        return (
          <div
            key={g.key}
            className="rounded-xl border border-line bg-surface p-4 shadow-card"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-surface-2 ring-1 ring-line">
                  <TubeDot container={g.container} className="size-4" />
                </span>
                <div>
                  <p className="text-xs text-fg-muted">
                    {t('sampleN', { n: i + 1 })} ·{' '}
                    {e('department', g.department)}
                  </p>
                  <p className="text-sm font-semibold text-fg">
                    {e('container', g.container)}
                  </p>
                </div>
              </div>
              {g.volumeMl ? (
                <Badge tone="neutral">
                  {t('volumeMl', { value: f.decimal(g.volumeMl) })}
                </Badge>
              ) : null}
            </div>
            <dl className="mt-4 grid gap-2.5 text-meta">
              <div className="flex justify-between gap-3">
                <dt className="text-fg-muted">{t('forTests')}</dt>
                <dd className="text-right font-medium text-fg">
                  {groupTests.map((x) => x.shortName).join(', ')}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-fg-muted">{tc('specimen')}</dt>
                <dd className="font-medium text-fg">
                  {e('specimen', g.specimen)}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-fg-muted">{t('estimatedTat')}</dt>
                <dd className="font-medium text-fg">{f.hours(tat)}</dd>
              </div>
            </dl>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {g.fasting ? (
                <Badge tone="warning">
                  <DropletIcon />
                  {t('fastingRequired')}
                </Badge>
              ) : (
                <Badge tone="outline">{t('noFasting')}</Badge>
              )}
              {instructions
                .filter((x) => !x.startsWith('fasting'))
                .map((x) => (
                  <Badge key={x} tone="info">
                    <InfoIcon />
                    {e('instruction', x)}
                  </Badge>
                ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function SummaryBlock({
  title,
  onEdit,
  children,
}: {
  title: string
  onEdit: () => void
  children: ReactNode
}) {
  const t = useT('orders')
  return (
    <div className="rounded-xl border border-line p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold tracking-wide text-fg-subtle uppercase">
          {title}
        </h3>
        <Button variant="ghost" size="xs" onClick={onEdit}>
          <PencilIcon />
          {t('edit')}
        </Button>
      </div>
      {children}
    </div>
  )
}

export function Component() {
  const t = useT('orders')
  const tc = useT('common')
  const e = useEnum()
  const f = useFormat()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const draftId = params.get('draft') ?? undefined
  const { data: reference } = useReference()
  const { data: catalog } = useOrderableTests()
  const { data: draft } = useOrder(draftId)
  const [step, setStep] = useState(0)
  const [registering, setRegistering] = useState<string | null>(null)
  const [printSamples, setPrintSamples] = useState<{
    orderId: string
    samples: SampleRow[]
  } | null>(null)
  const submitted = useRef(false)

  const form = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(schema),
    defaultValues: {
      patientId: params.get('patient') ?? '',
      doctorId: '',
      department: 'general-medicine',
      encounter: 'OPD',
      ward: '',
      bed: '',
      priority: 'routine',
      clinicalNotes: '',
      testIds: [],
    },
  })
  const {
    control,
    setValue,
    trigger,
    getValues,
    formState,
    handleSubmit,
    reset,
  } = form
  const values = useWatch({ control })
  const testIds = useMemo(() => values.testIds ?? [], [values.testIds])

  // Load a saved draft into the form once.
  const loadedDraft = useRef<string | null>(null)
  useEffect(() => {
    if (!draft || loadedDraft.current === draft.id) return
    loadedDraft.current = draft.id
    reset({
      patientId: draft.patient.id,
      doctorId: draft.doctor.id,
      department: draft.clinicalDepartment,
      encounter: draft.encounter,
      ward: draft.ward ?? '',
      bed: draft.bed ?? '',
      priority: draft.priority,
      clinicalNotes: draft.clinicalNotes,
      testIds: draft.draftTestIds ?? [],
    })
  }, [draft, reset])

  const selectedTests = useMemo(
    () => (catalog ?? []).filter((x) => testIds.includes(x.id)),
    [catalog, testIds],
  )
  const total = selectedTests.reduce((n, x) => n + x.price, 0)
  const groups = groupTestsIntoSamples(selectedTests as unknown as LabTest[])
  const doctor = reference?.doctors.find((d) => d.id === values.doctorId)

  const blocker = useUnsavedChanges(formState.isDirty, () => submitted.current)

  const toggleTest = (id: string) => {
    const current = getValues('testIds') ?? []
    setValue(
      'testIds',
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
      { shouldDirty: true, shouldValidate: formState.isSubmitted },
    )
  }

  const next = async () => {
    const ok = await trigger(STEP_FIELDS[step])
    if (ok) setStep((s) => Math.min(4, s + 1))
    else focusInvalid()
  }

  const input = (v: FormOut) => ({
    patientId: v.patientId,
    doctorId: v.doctorId,
    department: v.department,
    encounter: v.encounter,
    priority: v.priority,
    clinicalNotes: v.clinicalNotes,
    testIds: v.testIds,
    ...(v.ward ? { ward: v.ward } : {}),
    ...(v.bed ? { bed: v.bed } : {}),
  })

  const create = useLabMutation(
    (v: { form: FormOut; print: boolean }) =>
      draftId
        ? labApi.orders.submitDraft(draftId, input(v.form))
        : labApi.orders.create(input(v.form)),
    {
      success: () => null,
      onSuccess: (res, v) => {
        submitted.current = true
        toast.success(t('orderCreated', { orderNo: res.orderNo ?? '' }), {
          description: t('orderCreatedBody', { count: res.sampleIds.length }),
          action: {
            label: t('viewInCollection'),
            onClick: () => void navigate('/collection'),
          },
        })
        if (v.print) {
          void labApi.orders
            .get(res.id)
            .then((order) =>
              setPrintSamples({ orderId: res.id, samples: order.samples }),
            )
        } else {
          void navigate(`/orders?order=${res.id}`)
        }
      },
    },
  )
  const saveDraft = useLabMutation(
    (v: FormOut) => labApi.orders.saveDraft(input(v), draftId),
    {
      success: () => t('draftSaved'),
      onSuccess: () => {
        submitted.current = true
        void navigate('/orders')
      },
    },
  )

  const steps = [
    { id: 'patient', label: t('stepShortPatient'), title: t('stepPatient') },
    { id: 'ordering', label: t('stepShortOrdering'), title: t('stepOrdering') },
    { id: 'tests', label: t('stepShortTests'), title: t('stepTests') },
    { id: 'samples', label: t('stepShortSamples'), title: t('stepSamples') },
    { id: 'review', label: t('stepShortReview'), title: t('stepReview') },
  ]
  const err = (k: keyof FormIn) => formState.errors[k]?.message
  const needsWard =
    values.encounter === 'IPD' ||
    values.encounter === 'ICU' ||
    values.encounter === 'EMERGENCY'

  return (
    <>
      <PageHeader
        back={{ to: '/orders', label: t('title') }}
        title={draftId ? `${t('continueDraft')}` : t('wizardTitle')}
      />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Card className="min-w-0">
          <div className="border-b border-line px-5 py-4">
            <Stepper steps={steps} current={step} onStepClick={setStep} />
          </div>
          <CardBody className="pt-5">
            <p className="mb-1 text-xs font-medium text-fg-subtle">
              {t('stepOf', { current: step + 1, total: 5 })}
            </p>
            <h2 className="mb-5 text-lg font-semibold text-fg">
              {steps[step]!.title}
            </h2>

            {step === 0 ? (
              <>
                <PatientStep
                  value={values.patientId ?? ''}
                  onSelect={(id) =>
                    setValue('patientId', id, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                  onRegister={(name) => setRegistering(name)}
                />
                {err('patientId') ? (
                  <p className="mt-3 text-xs font-medium text-danger-text">
                    {t('stepRequired')}
                  </p>
                ) : null}
              </>
            ) : null}

            {step === 1 ? (
              <div className="grid gap-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label={t('doctor')} required error={err('doctorId')}>
                    <Controller
                      control={control}
                      name="doctorId"
                      render={({ field }) => (
                        <Combobox
                          value={field.value || undefined}
                          onValueChange={(v) => {
                            field.onChange(v)
                            const d = reference?.doctors.find((x) => x.id === v)
                            if (d)
                              setValue('department', d.department, {
                                shouldDirty: true,
                              })
                          }}
                          placeholder={t('doctorPlaceholder')}
                          searchPlaceholder={t('searchDoctors')}
                          emptyText={t('noDoctors')}
                          options={(reference?.doctors ?? []).map((d) => ({
                            value: d.id,
                            label: d.name,
                            description: e('clinicalDepartment', d.department),
                            group: e('clinicalDepartment', d.department),
                          }))}
                        />
                      )}
                    />
                  </Field>
                  <Field label={t('clinicalDepartment')} required>
                    <Controller
                      control={control}
                      name="department"
                      render={({ field }) => (
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                          options={CLINICAL_DEPARTMENTS.map((d) => ({
                            value: d,
                            label: e('clinicalDepartment', d),
                          }))}
                        />
                      )}
                    />
                  </Field>
                </div>
                <Field label={t('encounter')} required>
                  <Controller
                    control={control}
                    name="encounter"
                    render={({ field }) => (
                      <ChoiceCards
                        value={field.value}
                        onValueChange={field.onChange}
                        columns={4}
                        aria-label={t('encounter')}
                        options={ENCOUNTER_TYPES.map((x) => ({
                          value: x,
                          label: e('encounter', x),
                        }))}
                        className="lg:grid-cols-5"
                      />
                    )}
                  />
                </Field>
                {needsWard ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      label={t('ward')}
                      hint={t('wardHint')}
                      error={err('ward')}
                    >
                      <Controller
                        control={control}
                        name="ward"
                        render={({ field }) => (
                          <Input {...field} placeholder="Ward 3A" />
                        )}
                      />
                    </Field>
                    <Field label={t('bed')} error={err('bed')}>
                      <Controller
                        control={control}
                        name="bed"
                        render={({ field }) => (
                          <Input {...field} placeholder="12" />
                        )}
                      />
                    </Field>
                  </div>
                ) : null}
                <Field label={t('priority')} required>
                  <Controller
                    control={control}
                    name="priority"
                    render={({ field }) => (
                      <ChoiceCards
                        value={field.value}
                        onValueChange={field.onChange}
                        aria-label={t('priority')}
                        options={[
                          {
                            value: 'routine',
                            label: e('priority', 'routine'),
                            description: t('priorityRoutineHint'),
                            icon: <ClockIcon />,
                          },
                          {
                            value: 'urgent',
                            label: e('priority', 'urgent'),
                            description: t('priorityUrgentHint'),
                            icon: (
                              <ChevronsUpIcon className="text-warning-text" />
                            ),
                          },
                          {
                            value: 'stat',
                            label: e('priority', 'stat'),
                            description: t('priorityStatHint'),
                            icon: <ZapIcon className="text-danger-text" />,
                          },
                        ]}
                      />
                    )}
                  />
                </Field>
                <Field
                  label={t('clinicalNotes')}
                  optionalLabel={tc('optional')}
                  error={err('clinicalNotes')}
                >
                  <Controller
                    control={control}
                    name="clinicalNotes"
                    render={({ field }) => (
                      <Textarea
                        {...field}
                        rows={3}
                        placeholder={t('clinicalNotesPlaceholder')}
                      />
                    )}
                  />
                </Field>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="grid gap-4">
                <div>
                  <p className="mb-2 text-xs font-semibold tracking-wide text-fg-subtle uppercase">
                    {t('popularPanels')}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {COMMON_PANELS.map((p) => {
                      const on = p.testIds.every((id) => testIds.includes(id))
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            const current = getValues('testIds') ?? []
                            setValue(
                              'testIds',
                              on
                                ? current.filter((x) => !p.testIds.includes(x))
                                : [...new Set([...current, ...p.testIds])],
                              { shouldDirty: true },
                            )
                          }}
                          className={cn(
                            'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-meta font-medium transition-colors',
                            on
                              ? 'border-accent bg-accent-soft text-accent-text'
                              : 'border-line bg-surface text-fg-muted hover:border-line-strong hover:text-fg',
                          )}
                        >
                          {on ? (
                            <CheckIcon strokeWidth={2.5} className="size-3.5" />
                          ) : null}
                          {t(`panel.${p.id}` as Parameters<typeof t>[0])}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <TestPicker
                  tests={catalog ?? []}
                  selected={testIds}
                  onToggle={toggleTest}
                  maxHeight="calc(100dvh - 30rem)"
                />
                {err('testIds') ? (
                  <p className="text-xs font-medium text-danger-text">
                    {tc('required')}: {t('noTestsSelected')}
                  </p>
                ) : null}
              </div>
            ) : null}

            {step === 3 ? (
              <SampleRequirements
                tests={selectedTests}
                priority={values.priority ?? 'routine'}
              />
            ) : null}

            {step === 4 ? (
              <div className="grid gap-4 lg:grid-cols-2">
                <SummaryBlock
                  title={t('summaryPatient')}
                  onEdit={() => setStep(0)}
                >
                  {values.patientId ? (
                    <SelectedPatientMini id={values.patientId} />
                  ) : null}
                </SummaryBlock>
                <SummaryBlock
                  title={t('summaryOrdering')}
                  onEdit={() => setStep(1)}
                >
                  <dl className="grid gap-2 text-meta">
                    <div className="flex justify-between gap-3">
                      <dt className="text-fg-muted">{t('doctor')}</dt>
                      <dd className="font-medium text-fg">{doctor?.name}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-fg-muted">
                        {t('clinicalDepartment')}
                      </dt>
                      <dd className="font-medium text-fg">
                        {values.department
                          ? e('clinicalDepartment', values.department)
                          : ''}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-fg-muted">{t('encounter')}</dt>
                      <dd className="font-medium text-fg">
                        {values.encounter
                          ? e('encounter', values.encounter)
                          : ''}
                        {values.ward
                          ? ` · ${values.ward}${values.bed ? ` / ${values.bed}` : ''}`
                          : ''}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-fg-muted">{t('priority')}</dt>
                      <dd>
                        <PriorityBadge
                          priority={values.priority ?? 'routine'}
                        />
                      </dd>
                    </div>
                    {values.clinicalNotes ? (
                      <div className="mt-1 rounded-lg bg-surface-2 p-2.5 text-fg">
                        {values.clinicalNotes}
                      </div>
                    ) : null}
                  </dl>
                </SummaryBlock>
                <SummaryBlock
                  title={t('summaryTests')}
                  onEdit={() => setStep(2)}
                >
                  <ul className="grid gap-1.5 text-meta">
                    {selectedTests.map((x) => (
                      <li key={x.id} className="flex justify-between gap-3">
                        <span className="text-fg">
                          {x.name}{' '}
                          <span className="font-mono text-xs text-fg-subtle">
                            {x.code}
                          </span>
                        </span>
                        <span className="font-medium text-fg tabular-nums">
                          {f.currency(x.price)}
                        </span>
                      </li>
                    ))}
                    <li className="mt-1 flex justify-between gap-3 border-t border-line pt-2 font-semibold">
                      <span>{t('subtotal')}</span>
                      <span className="tabular-nums">{f.currency(total)}</span>
                    </li>
                  </ul>
                </SummaryBlock>
                <SummaryBlock
                  title={t('summarySamples')}
                  onEdit={() => setStep(3)}
                >
                  <ul className="grid gap-2 text-meta">
                    {groups.map((g) => (
                      <li
                        key={g.key}
                        className="flex items-center justify-between gap-3"
                      >
                        <ContainerChip container={g.container} full />
                        <span className="text-fg-muted">
                          {e('department', g.department)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </SummaryBlock>
              </div>
            ) : null}
          </CardBody>
          <div className="flex flex-wrap items-center gap-2 border-t border-line bg-surface-2/50 px-5 py-4">
            {step > 0 ? (
              <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>
                <ArrowLeftIcon />
                {t('back')}
              </Button>
            ) : null}
            <span className="ml-auto" />
            <Button
              onClick={() =>
                void handleSubmit((v) => saveDraft.mutate(v), focusInvalid)()
              }
              loading={saveDraft.isPending}
              disabled={
                !values.patientId || testIds.length === 0 || !values.doctorId
              }
            >
              <SaveIcon />
              {t('saveDraft')}
            </Button>
            {step < 4 ? (
              <Button variant="primary" onClick={() => void next()}>
                {t('continue')}
                <ArrowRightIcon />
              </Button>
            ) : (
              <>
                <Button
                  onClick={() =>
                    void handleSubmit(
                      (v) => create.mutate({ form: v, print: true }),
                      focusInvalid,
                    )()
                  }
                  loading={create.isPending && create.variables?.print === true}
                >
                  <PrinterIcon />
                  {t('createAndPrint')}
                </Button>
                <Button
                  variant="primary"
                  onClick={() =>
                    void handleSubmit(
                      (v) => create.mutate({ form: v, print: false }),
                      focusInvalid,
                    )()
                  }
                  loading={
                    create.isPending && create.variables?.print === false
                  }
                >
                  <CheckIcon strokeWidth={2.5} />
                  {t('createOrder')}
                </Button>
              </>
            )}
          </div>
        </Card>

        <aside className="xl:sticky xl:top-24 xl:self-start">
          <Card>
            <CardHeader
              title={t('selectedTests')}
              description={
                testIds.length
                  ? t('samplesToCollect', { count: groups.length })
                  : undefined
              }
            />
            <CardBody className="pt-0">
              {selectedTests.length === 0 ? (
                <EmptyState
                  compact
                  icon={<DropletIcon />}
                  title={t('noTestsSelected')}
                  description={t('noTestsSelectedBody')}
                />
              ) : (
                <ul className="grid gap-1.5">
                  {selectedTests.map((x) => (
                    <li
                      key={x.id}
                      className="group flex items-center gap-2.5 rounded-lg bg-surface-2/60 px-3 py-2"
                    >
                      <TubeDot container={x.container} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-meta font-medium text-fg">
                          {x.shortName}
                        </span>
                        <span className="block truncate text-2xs text-fg-muted">
                          {e('department', x.department)}
                        </span>
                      </span>
                      <span className="text-meta font-medium tabular-nums">
                        {f.currency(x.price)}
                      </span>
                      <button
                        type="button"
                        aria-label={`${tc('remove')} ${x.shortName}`}
                        onClick={() => toggleTest(x.id)}
                        className="grid size-6 place-items-center rounded-md text-fg-subtle hover:bg-surface-3 hover:text-fg"
                      >
                        <XIcon className="size-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-4 flex items-baseline justify-between border-t border-line pt-3">
                <span className="text-meta text-fg-muted">{t('subtotal')}</span>
                <span className="text-xl font-semibold text-fg tabular-nums">
                  {f.currency(total)}
                </span>
              </div>
            </CardBody>
          </Card>
        </aside>
      </div>

      <RegisterPatientDialog
        open={registering !== null}
        onOpenChange={(o) => !o && setRegistering(null)}
        initialName={registering ?? ''}
        onRegistered={(p) =>
          setValue('patientId', p.id, {
            shouldDirty: true,
            shouldValidate: true,
          })
        }
      />
      {printSamples ? (
        <LabelPrintDialog
          open
          samples={printSamples.samples}
          onOpenChange={(o) => {
            if (!o) {
              const id = printSamples.orderId
              setPrintSamples(null)
              void navigate(`/orders?order=${id}`)
            }
          }}
        />
      ) : null}
      <UnsavedChangesDialog blocker={blocker} />
    </>
  )
}

function SelectedPatientMini({ id }: { id: string }) {
  const { data, isError, refetch } = usePatient(id)
  if (isError && !data)
    return <ErrorState compact onRetry={() => void refetch()} />
  if (!data) return <Skeleton className="h-10" />
  return <PatientCell patient={data.patient} link={false} />
}
