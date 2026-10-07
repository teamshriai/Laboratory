import {
  BarcodeIcon,
  CircleCheckIcon,
  EllipsisIcon,
  EyeIcon,
  TestTubeIcon,
  CircleAlertIcon,
  ThermometerIcon,
  TriangleAlertIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { useDeferredValue, useEffect, useRef, useState } from 'react'
import {
  PRIORITIES,
  RECEIPT_TEMPERATURES,
  SAMPLE_STATUSES,
  type Priority,
  type ReceiptTemperature,
  type SampleStatus,
} from '@/domain/types'
import { usePreferences } from '@/app/preferences/context'
import { useNow } from '@/hooks/use-now'
import { usePersistentState } from '@/hooks/use-persistent-state'
import { useOverlayParam, useSearchParam } from '@/hooks/use-search-param'
import { useEnum, useLanguage, useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import { cn } from '@/lib/cn'
import { oneOf } from '@/lib/storage'
import { labApi, type SampleRow } from '@/services/lab-api'
import { errorMessage, useLabMutation } from '@/services/mutations'
import { useProcessing } from '@/services/queries'
import { PageHeader } from '@/app/layout/page-header'
import { FilterBar } from '@/components/lab/filter-bar'
import { RecordLink } from '@/components/lab/record-link'
import { PatientCell } from '@/components/lab/patient'
import { ContainerChip } from '@/components/lab/sample'
import { SampleStatusBadge, PriorityMark } from '@/components/lab/status'
import { TatIndicator } from '@/components/lab/tat'
import { TestChips } from '@/components/lab/test-chips'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Input, SearchInput } from '@/components/ui/input'
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
} from '@/components/ui/menu'
import { Select } from '@/components/ui/select'
import { EmptyState } from '@/components/ui/states'
import { FilterTabs, Segmented } from '@/components/ui/toggles'
import { useSampleActions } from './sample-actions'

type Tab = SampleStatus | 'all'
const TABS: readonly Tab[] = ['all', ...SAMPLE_STATUSES]
const PRIORITY_FILTERS: readonly (Priority | 'all')[] = ['all', ...PRIORITIES]
const isTemperature = oneOf(RECEIPT_TEMPERATURES)

type ScanLog = {
  id: string
  tone: 'ok' | 'warn' | 'error'
  text: string
  at: number
}

function RowActions({
  sample,
  onView,
}: {
  sample: SampleRow
  onView: () => void
}) {
  const t = useT('processing')
  const tc = useT('common')
  const { primary, secondary, dialogs } = useSampleActions(sample)
  return (
    <div
      className="flex items-center justify-end gap-1"
      onClick={(ev) => ev.stopPropagation()}
    >
      {primary}
      <Menu>
        <MenuTrigger asChild>
          <Button size="icon-sm" variant="ghost" aria-label={tc('moreActions')}>
            <EllipsisIcon strokeWidth={2.5} />
          </Button>
        </MenuTrigger>
        <MenuContent>
          <MenuItem icon={<EyeIcon />} onSelect={onView}>
            {t('viewDetails')}
          </MenuItem>
          {secondary.length ? <MenuSeparator /> : null}
          {secondary.map((a) => (
            <MenuItem
              key={a.key}
              icon={a.icon}
              onSelect={a.onSelect}
              danger={a.danger}
              disabled={a.disabled}
              hint={a.hint}
            >
              {a.label}
            </MenuItem>
          ))}
        </MenuContent>
      </Menu>
      {dialogs}
    </div>
  )
}

function ReceiveCard() {
  const t = useT('processing')
  const e = useEnum()
  const f = useFormat()
  const now = useNow()
  const { language } = useLanguage()
  const [value, setValue] = useState('')
  // Kept between scans (and visits), so a box of chilled tubes is received
  // with one choice.
  const [temperature, setTemperature] = usePersistentState<ReceiptTemperature>(
    'reception-temperature',
    'ambient',
    isTemperature,
  )
  const [log, setLog] = useState<ScanLog[]>([])
  const input = useRef<HTMLInputElement>(null)
  // Ready for the barcode scanner on arrival (not on touch screens, where
  // focusing would open the on-screen keyboard).
  useEffect(() => {
    if (window.matchMedia('(pointer: fine)').matches)
      input.current?.focus({ preventScroll: true })
  }, [])
  const addLog = (entry: Omit<ScanLog, 'id' | 'at'>) =>
    setLog((prev) =>
      [
        { ...entry, id: `${entry.text}-${Date.now()}`, at: Date.now() },
        ...prev,
      ].slice(0, 4),
    )
  const receive = useLabMutation(
    (ref: string) => labApi.samples.receive(ref, { temperature }),
    {
      success: (r) =>
        r.temperatureDeviation
          ? null
          : t('receivedToast', { accession: r.accessionNo ?? '' }),
      onSuccess: (r) => {
        if (r.temperatureDeviation)
          toast.warning(
            t('temperatureWarnTitle', { accession: r.accessionNo ?? '' }),
            { description: t('temperatureWarnBody'), duration: 12_000 },
          )
        addLog({
          tone: r.temperatureDeviation ? 'warn' : 'ok',
          text: r.accessionNo ?? '',
        })
        setValue('')
        input.current?.focus()
      },
      onError: (error) =>
        addLog({ tone: 'error', text: errorMessage(error, language) }),
    },
  )
  return (
    <Card className="mb-5 px-5 py-4">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-fg">
          <BarcodeIcon className="size-[18px] text-fg-subtle" aria-hidden />
          {t('scanTitle')}
        </h2>
        <form
          className="flex w-full max-w-md gap-2"
          onSubmit={(ev) => {
            ev.preventDefault()
            if (value.trim()) receive.mutate(value.trim())
          }}
        >
          <Input
            ref={input}
            value={value}
            onChange={(ev) => setValue(ev.target.value.toUpperCase())}
            placeholder={t('scanPlaceholder')}
            aria-label={t('scanLabel')}
            className="h-10 font-mono tracking-wide"
            autoComplete="off"
          />
          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={receive.isPending}
            disabled={!value.trim()}
          >
            {t('scanButton')}
          </Button>
        </form>
        <div
          role="group"
          aria-labelledby="receipt-temperature-label"
          className="flex max-w-full min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5"
        >
          <span
            id="receipt-temperature-label"
            className="inline-flex items-center gap-1.5 text-meta font-medium text-fg-muted"
          >
            <ThermometerIcon className="size-4 text-fg-subtle" aria-hidden />
            {t('receiptTemperature')}
          </span>
          <Segmented
            size="sm"
            value={temperature}
            onValueChange={(next) => {
              setTemperature(next)
              input.current?.focus({ preventScroll: true })
            }}
            aria-label={t('receiptTemperature')}
            options={RECEIPT_TEMPERATURES.map((x) => ({
              value: x,
              label: e('receiptTemperature', x),
            }))}
          />
        </div>
      </div>
      {log.length ? (
        <ul
          className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4"
          aria-live="polite"
        >
          {log.map((l) => (
            <li
              key={l.id}
              className={cn(
                'inline-flex max-w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs',
                l.tone === 'ok' && 'bg-success-soft text-success-text',
                l.tone === 'warn' && 'bg-warning-soft text-warning-text',
                l.tone === 'error' && 'bg-danger-soft text-danger-text',
              )}
            >
              {l.tone === 'ok' ? (
                <CircleCheckIcon strokeWidth={2.2} className="size-4" />
              ) : l.tone === 'warn' ? (
                <TriangleAlertIcon strokeWidth={2.2} className="size-4" />
              ) : (
                <CircleAlertIcon strokeWidth={2.2} className="size-4" />
              )}
              <span
                className={l.tone === 'error' ? '' : 'font-mono font-semibold'}
              >
                {l.text}
              </span>
              {l.tone === 'warn' ? (
                <span>{t('temperatureMismatch')}</span>
              ) : null}
              <span className="opacity-70">{f.relative(l.at, now)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  )
}

export function Component() {
  const t = useT('processing')
  const tc = useT('common')
  const e = useEnum()
  const f = useFormat()
  const { department } = usePreferences()
  const [sampleId, view] = useOverlayParam('sample')
  // Filters live in the URL so a view can be linked and survives reloads.
  const [status, setStatus] = useSearchParam<Tab>('status', 'received', TABS)
  const [priority, setPriority] = useSearchParam<Priority | 'all'>(
    'priority',
    'all',
    PRIORITY_FILTERS,
  )
  const [query, setQuery] = useSearchParam<string>('q', '')
  const q = useDeferredValue(query)
  const { data, isPending, isError, refetch } = useProcessing({
    status,
    q,
    ...(department ? { department } : {}),
    ...(priority !== 'all' ? { priority } : {}),
  })

  const changeTab = (v: Tab) => setStatus(v)

  const columns: Column<SampleRow>[] = [
    {
      id: 'sample',
      header: t('colSample'),
      sortValue: (r) => r.accessionNo ?? '',
      cell: (r) => (
        <div className="grid justify-items-start gap-1">
          <RecordLink
            kind="specimen"
            id={r.id}
            className="text-meta font-semibold whitespace-nowrap text-fg"
          >
            {r.accessionNo}
          </RecordLink>
          <ContainerChip
            container={r.container}
            className="text-xs text-fg-muted"
          />
        </div>
      ),
    },
    {
      id: 'patient',
      header: t('colPatient'),
      sortValue: (r) => r.patient.name,
      cell: (r) => <PatientCell patient={r.patient} showLocal={false} />,
    },
    {
      id: 'department',
      tabletHidden: true,
      header: t('colDepartment'),
      cell: (r) => (
        <div className="grid gap-1">
          <span className="text-meta text-fg">
            {e('department', r.department)}
          </span>
          <span className="text-xs text-fg-muted">
            {e('specimen', r.specimen)}
          </span>
        </div>
      ),
    },
    {
      id: 'tests',
      header: t('colTests'),
      cell: (r) => <TestChips tests={r.tests} max={2} />,
    },
    {
      id: 'received',
      tabletHidden: true,
      header: t('colReceived'),
      sortValue: (r) => r.receivedAt ?? r.collectedAt ?? 0,
      cell: (r) => (
        <span className="text-meta whitespace-nowrap text-fg">
          {r.receivedAt
            ? f.time(r.receivedAt)
            : r.collectedAt
              ? f.time(r.collectedAt)
              : '-'}
        </span>
      ),
    },
    {
      id: 'priority',
      header: t('colPriority'),
      sortValue: (r) => PRIORITIES.indexOf(r.priority) * -1,
      cell: (r) => <PriorityMark priority={r.priority} />,
    },
    {
      id: 'status',
      header: t('colStatus'),
      cell: (r) => (
        <div className="grid justify-items-start gap-1">
          <SampleStatusBadge status={r.status} />
          {r.status === 'processing' && r.allEntered ? (
            <Badge tone="warning" size="sm">
              {t('awaitingValidation')}
            </Badge>
          ) : null}
          {r.status === 'on_hold' && r.holdReason ? (
            <span className="text-xs text-fg-muted">
              {e('holdReason', r.holdReason)}
            </span>
          ) : null}
          {r.status === 'rejected' && r.rejection ? (
            <span className="text-xs text-danger-text">
              {e('rejectionReason', r.rejection.reason)}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      id: 'tat',
      header: t('colTat'),
      sortValue: (r) => r.tat?.ratio ?? -1,
      cell: (r) => <TatIndicator tat={r.tat} />,
    },
    {
      id: 'actions',
      header: <span className="sr-only">{tc('actions')}</span>,
      align: 'right',
      cell: (r) => <RowActions sample={r} onView={() => view(r.id)} />,
    },
  ]

  const counts = data?.counts
  const tabs: { value: Tab; label: string; count?: number; tone?: 'danger' }[] =
    [
      { value: 'collected', label: t('tabTransit'), count: counts?.collected },
      { value: 'received', label: t('tabReceived'), count: counts?.received },
      {
        value: 'processing',
        label: t('tabProcessing'),
        count: counts?.processing,
      },
      { value: 'on_hold', label: t('tabHold'), count: counts?.on_hold },
      {
        value: 'rejected',
        label: t('tabRejected'),
        count: counts?.rejected,
        tone: 'danger',
      },
      {
        value: 'completed',
        label: t('tabCompleted'),
        count: counts?.completed,
      },
      { value: 'all', label: t('tabAll') },
    ]

  return (
    <>
      <PageHeader title={t('title')} />
      <ReceiveCard />
      <Card className="overflow-hidden">
        <div className="border-b border-line px-3 pt-1">
          <FilterTabs value={status} onValueChange={changeTab} items={tabs} />
        </div>
        <FilterBar>
          <SearchInput
            value={query}
            onValueChange={setQuery}
            placeholder={t('searchPlaceholder')}
            aria-label={tc('search')}
            className="w-full sm:w-96"
          />
          <Select
            size="sm"
            aria-label={t('colPriority')}
            value={priority}
            onValueChange={setPriority}
            className="w-36"
            options={[
              { value: 'all' as const, label: tc('all') },
              ...PRIORITIES.map((p) => ({ value: p, label: e('priority', p) })),
            ]}
          />
        </FilterBar>
        <div className="border-t border-line">
          <DataTable
            caption={t('title')}
            columns={columns}
            rows={data?.rows}
            getRowId={(r) => r.id}
            rowLabel={(r) => r.accessionNo ?? r.patient.name}
            onRowClick={(r) => view(r.id)}
            activeRowId={sampleId}
            isLoading={isPending}
            isError={isError}
            onRetry={() => void refetch()}
            minWidth={1100}
            empty={
              <EmptyState
                icon={<TestTubeIcon />}
                title={t('emptyTitle')}
                description={
                  status === 'all' || status === 'received'
                    ? t('emptyBody')
                    : t('emptyFilteredBody')
                }
              />
            }
          />
        </div>
      </Card>
    </>
  )
}
