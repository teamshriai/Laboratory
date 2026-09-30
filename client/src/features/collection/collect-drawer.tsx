import { zodResolver } from '@hookform/resolvers/zod'
import {
  CheckIcon,
  DropletIcon,
  IdCardIcon,
  InfoIcon,
  PrinterIcon,
} from 'lucide-react'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { COLLECTION_SITES, type StaffRole } from '@/domain/types'
import { usePreferences } from '@/app/preferences/context'
import { useNow } from '@/hooks/use-now'
import { useEnum, useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import { labApi, type SampleRow } from '@/services/lab-api'
import { useLabMutation } from '@/services/mutations'
import { useReference, useSample } from '@/services/queries'
import { LabelPrintDialog } from '@/components/lab/labels'
import { PatientCell } from '@/components/lab/patient'
import { ContainerChip, TubeDot } from '@/components/lab/sample'
import { PriorityBadge } from '@/components/lab/status'
import { TestChips } from '@/components/lab/test-chips'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Drawer } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input, Textarea } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { SkeletonText } from '@/components/ui/skeleton'

const IST = 330 * 60_000
const toLocalInput = (ms: number) =>
  new Date(ms + IST).toISOString().slice(0, 16)
const fromLocalInput = (value: string) => Date.parse(`${value}:00Z`) - IST

const schema = z.object({
  site: z.enum(COLLECTION_SITES),
  collectedAt: z
    .string()
    .min(1, 'forms.required')
    .refine(
      (v) => fromLocalInput(v) <= Date.now() + 60_000,
      'forms.futureTime',
    ),
  collectedBy: z.string().min(1, 'forms.required'),
  remarks: z.string().max(300, 'forms.tooLong'),
})
type FormIn = z.input<typeof schema>
type FormOut = z.output<typeof schema>

function defaultSite(container: SampleRow['container']): FormIn['site'] {
  if (container === 'urine' || container === 'sterile') return 'midstream-urine'
  if (
    container === 'stool' ||
    container === 'formalin' ||
    container === 'slide'
  )
    return 'other'
  return 'left-antecubital'
}

function CollectForm({
  sample,
  collectors,
  defaultCollector,
  onCollected,
}: {
  sample: SampleRow
  collectors: { id: string; name: string; role: StaffRole }[]
  defaultCollector: string
  onCollected: () => void
}) {
  const t = useT('collection')
  const tc = useT('common')
  const e = useEnum()
  const now = useNow()
  const [openedAt] = useState(now)
  const { control, register, handleSubmit, formState } = useForm<
    FormIn,
    unknown,
    FormOut
  >({
    resolver: zodResolver(schema),
    defaultValues: {
      site: defaultSite(sample.container),
      collectedAt: toLocalInput(openedAt),
      collectedBy: defaultCollector,
      remarks: '',
    },
  })
  const collect = useLabMutation(
    (v: FormOut) =>
      labApi.samples.collect(sample.id, {
        site: v.site,
        collectedAt: fromLocalInput(v.collectedAt),
        collectedBy: v.collectedBy,
        ...(v.remarks.trim() ? { remarks: v.remarks.trim() } : {}),
      }),
    {
      success: () => null,
      onSuccess: (accession) => {
        toast.success(t('collected', { accession: accession ?? '' }), {
          description: t('collectedBody', {
            department: e('department', sample.department),
          }),
        })
        onCollected()
      },
    },
  )
  return (
    <form
      id="collect-form"
      className="grid gap-4 sm:grid-cols-2"
      noValidate
      onSubmit={(ev) => void handleSubmit((v) => collect.mutate(v))(ev)}
      aria-busy={collect.isPending}
    >
      <Field label={t('sampleId')} className="sm:col-span-2">
        <div className="flex h-9 items-center gap-2 rounded-lg border border-dashed border-line-strong bg-surface-2 px-3 text-meta">
          <ContainerChip container={sample.container} />
          <span
            className={
              sample.accessionNo
                ? 'font-mono font-semibold text-fg'
                : 'text-fg-muted'
            }
          >
            {sample.accessionNo ?? t('sampleIdPending')}
          </span>
        </div>
      </Field>
      <Field
        label={t('collectionSite')}
        required
        error={formState.errors.site?.message}
      >
        <Controller
          control={control}
          name="site"
          render={({ field }) => (
            <Select
              value={field.value}
              onValueChange={field.onChange}
              options={COLLECTION_SITES.map((x) => ({
                value: x,
                label: e('collectionSite', x),
              }))}
            />
          )}
        />
      </Field>
      <Field
        label={t('collectionTime')}
        required
        error={formState.errors.collectedAt?.message}
      >
        <Input
          type="datetime-local"
          {...register('collectedAt')}
          max={toLocalInput(now + 60_000)}
        />
      </Field>
      <Field
        label={t('collectedBy')}
        required
        error={formState.errors.collectedBy?.message}
        className="sm:col-span-2"
      >
        <Controller
          control={control}
          name="collectedBy"
          render={({ field }) => (
            <Select
              value={field.value || undefined}
              onValueChange={field.onChange}
              placeholder={tc('selectPlaceholder')}
              options={collectors.map((x) => ({
                value: x.id,
                label: x.name,
                description: e('staffRole', x.role),
              }))}
            />
          )}
        />
      </Field>
      <Field
        label={t('remarks')}
        optionalLabel={tc('optional')}
        error={formState.errors.remarks?.message}
        className="sm:col-span-2"
      >
        <Textarea
          {...register('remarks')}
          rows={2}
          placeholder={t('remarksPlaceholder')}
        />
      </Field>
    </form>
  )
}

export function CollectDrawer({
  sampleId,
  onClose,
}: {
  sampleId: string
  onClose: () => void
}) {
  const t = useT('collection')
  const tc = useT('common')
  const e = useEnum()
  const f = useFormat()
  const { actorId } = usePreferences()
  const { data: sample, isPending } = useSample(sampleId)
  const { data: reference } = useReference()
  const [printing, setPrinting] = useState(false)
  const collectors = (reference?.staff ?? []).filter(
    (s) => s.role === 'phlebotomist' || s.role === 'technician',
  )
  const defaultCollector = collectors.some((s) => s.id === actorId)
    ? actorId
    : (collectors[0]?.id ?? '')
  const ready = Boolean(sample && reference)

  return (
    <Drawer
      open
      onOpenChange={(o) => !o && onClose()}
      size="md"
      title={t('drawerTitle')}
      headerExtra={
        sample ? <PriorityBadge priority={sample.priority} hideRoutine /> : null
      }
      description={
        sample
          ? t('drawerDescription', {
              container: e('container', sample.container),
              patient: sample.patient.name,
            })
          : undefined
      }
      footer={
        sample ? (
          <>
            <Button variant="ghost" onClick={onClose} className="mr-auto">
              {tc('cancel')}
            </Button>
            <Button onClick={() => setPrinting(true)}>
              <PrinterIcon />
              {t('printLabel')}
            </Button>
            <Button
              variant="primary"
              type="submit"
              form="collect-form"
              disabled={!ready}
            >
              <CheckIcon strokeWidth={2.5} />
              {t('markCollected')}
            </Button>
          </>
        ) : null
      }
    >
      {isPending || !sample ? (
        <div className="grid gap-6">
          <SkeletonText lines={3} />
          <SkeletonText lines={5} />
        </div>
      ) : (
        <div className="grid gap-6">
          <div className="flex items-start gap-3 rounded-xl border border-info/25 bg-info-soft/50 p-3 text-meta text-info-text">
            <IdCardIcon className="mt-0.5 size-4 shrink-0" />
            {t('checkIdentity')}
          </div>
          <section>
            <h3 className="mb-2.5 text-xs font-semibold tracking-wide text-fg-subtle uppercase">
              {t('sectionPatient')}
            </h3>
            <div className="rounded-xl border border-line p-4">
              <PatientCell patient={sample.patient} link={false} />
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Badge tone="neutral">{e('encounter', sample.encounter)}</Badge>
                {sample.ward ? (
                  <Badge tone="neutral">
                    {sample.bed
                      ? tc('wardBed', { ward: sample.ward, bed: sample.bed })
                      : sample.ward}
                  </Badge>
                ) : null}
                {sample.patient.allergies.map((a) => (
                  <Badge key={a} tone="danger">
                    {tc('allergies')}: {a}
                  </Badge>
                ))}
              </div>
            </div>
          </section>
          <section>
            <h3 className="mb-2.5 text-xs font-semibold tracking-wide text-fg-subtle uppercase">
              {t('sectionSpecimen')}
            </h3>
            <div className="rounded-xl border border-line bg-surface-2/50 p-4">
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-xl bg-surface ring-1 ring-line">
                  <TubeDot container={sample.container} className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-fg">
                    {e('container', sample.container)}
                  </p>
                  <p className="text-meta text-fg-muted">
                    {e('specimen', sample.specimen)}
                    {sample.volumeMl
                      ? ` · ${t('volume', { value: f.decimal(sample.volumeMl) })}`
                      : ''}
                  </p>
                </div>
              </div>
              <div className="mt-3">
                <TestChips tests={sample.tests} max={8} className="flex-wrap" />
              </div>
              {sample.fasting || sample.instructions.length ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {sample.fasting ? (
                    <Badge tone="warning">
                      <DropletIcon />
                      {t('fasting')}
                    </Badge>
                  ) : null}
                  {sample.instructions
                    .filter((x) => !x.startsWith('fasting'))
                    .map((x) => (
                      <Badge key={x} tone="info">
                        <InfoIcon />
                        {e('instruction', x)}
                      </Badge>
                    ))}
                </div>
              ) : null}
              <p className="mt-3 text-xs text-fg-muted">
                {t('orderedBy', { doctor: sample.doctorName })} ·{' '}
                <span className="font-mono">{sample.orderNo}</span>
              </p>
              {sample.clinicalNotes ? (
                <p className="mt-2 rounded-lg bg-surface p-2.5 text-meta text-fg">
                  {sample.clinicalNotes}
                </p>
              ) : null}
            </div>
          </section>
          <section>
            <h3 className="mb-2.5 text-xs font-semibold tracking-wide text-fg-subtle uppercase">
              {t('sectionCollection')}
            </h3>
            {ready ? (
              <CollectForm
                sample={sample}
                collectors={collectors}
                defaultCollector={defaultCollector}
                onCollected={onClose}
              />
            ) : (
              <SkeletonText lines={4} />
            )}
          </section>
        </div>
      )}
      {sample ? (
        <LabelPrintDialog
          open={printing}
          onOpenChange={setPrinting}
          samples={[sample]}
        />
      ) : null}
    </Drawer>
  )
}
