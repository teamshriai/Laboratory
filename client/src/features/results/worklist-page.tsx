import {
  PencilLineIcon,
  RotateCcwIcon,
  SaveIcon,
  Undo2Icon,
} from 'lucide-react'
import { useDeferredValue, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { PRIORITIES } from '@/domain/types'
import { usePreferences } from '@/app/preferences/context'
import { useEnum, useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import type { SampleRow } from '@/services/lab-api'
import { useEntryWorklist } from '@/services/queries'
import { PageHeader } from '@/app/layout/page-header'
import { FilterBar } from '@/components/lab/filter-bar'
import { RecordLink } from '@/components/lab/record-link'
import { PatientCell } from '@/components/lab/patient'
import { ContainerChip } from '@/components/lab/sample'
import { PriorityMark } from '@/components/lab/status'
import { TatIndicator, Waiting } from '@/components/lab/tat'
import { TestChips } from '@/components/lab/test-chips'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DataTable, type Column } from '@/components/ui/data-table'
import { SearchInput } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/states'

export function Component() {
  const t = useT('results')
  const tc = useT('common')
  const e = useEnum()
  const f = useFormat()
  const navigate = useNavigate()
  const { department } = usePreferences()
  const [query, setQuery] = useState('')
  const q = useDeferredValue(query)
  const { data, isPending, isError, refetch } = useEntryWorklist({
    q,
    ...(department ? { department } : {}),
  })

  // Where each specimen stands in result entry, in words (never colour only).
  const entryStatus = (r: SampleRow) =>
    r.tests.some((x) => x.status === 'returned') ? (
      <Badge tone="danger" size="sm">
        <Undo2Icon />
        {t('sentBack')}
      </Badge>
    ) : r.tests.some((x) => x.rerun) ? (
      <Badge tone="info" size="sm">
        <RotateCcwIcon />
        {t('statusRerun')}
      </Badge>
    ) : r.tests.some((x) => x.status === 'draft') ? (
      <Badge tone="neutral" size="sm">
        <SaveIcon />
        {t('draftSaved')}
      </Badge>
    ) : (
      <span className="text-meta text-fg-muted">{t('statusAwaiting')}</span>
    )

  // Audit §11 order: Priority, Accession No., Patient, Test(s), Specimen,
  // Received, Status, Time in queue, Action.
  const columns: Column<SampleRow>[] = [
    {
      id: 'priority',
      header: t('colPriority'),
      sortValue: (r) => PRIORITIES.indexOf(r.priority) * -1,
      cell: (r) => <PriorityMark priority={r.priority} />,
    },
    {
      id: 'sample',
      header: t('colSample'),
      sortValue: (r) => r.accessionNo ?? '',
      cell: (r) => (
        <RecordLink
          kind="specimen"
          id={r.id}
          className="text-meta font-semibold whitespace-nowrap text-fg"
        >
          {r.accessionNo}
        </RecordLink>
      ),
    },
    {
      id: 'patient',
      header: t('colPatient'),
      sortValue: (r) => r.patient.name,
      cell: (r) => <PatientCell patient={r.patient} showLocal={false} />,
    },
    {
      id: 'tests',
      header: t('colTests'),
      cell: (r) => <TestChips tests={r.tests} max={3} />,
    },
    {
      id: 'department',
      tabletHidden: true,
      header: t('colDepartment'),
      cell: (r) => (
        <span className="text-meta text-fg">
          {e('department', r.department)}
        </span>
      ),
    },
    {
      id: 'specimen',
      header: t('colSpecimen'),
      cell: (r) => (
        <div className="grid gap-0.5">
          <span className="text-meta whitespace-nowrap text-fg">
            {e('specimen', r.specimen)}
          </span>
          <ContainerChip
            container={r.container}
            className="text-xs text-fg-muted"
          />
        </div>
      ),
    },
    {
      id: 'received',
      tabletHidden: true,
      header: t('colReceived'),
      sortValue: (r) => r.receivedAt ?? 0,
      cell: (r) => (
        <span className="text-meta whitespace-nowrap tabular-nums">
          {r.receivedAt ? f.time(r.receivedAt) : '-'}
        </span>
      ),
    },
    {
      id: 'status',
      header: t('colStatus'),
      cell: entryStatus,
    },
    {
      id: 'queue',
      header: t('colInQueue'),
      sortValue: (r) => r.receivedAt ?? r.createdAt,
      cell: (r) => (
        <div className="grid justify-items-start gap-1">
          <Waiting since={r.receivedAt ?? r.createdAt} />
          <TatIndicator tat={r.tat} compact />
        </div>
      ),
    },
    {
      id: 'actions',
      header: <span className="sr-only">{tc('actions')}</span>,
      align: 'right',
      cell: (r) => (
        <Link
          to={`/results/${r.id}`}
          onClick={(ev) => ev.stopPropagation()}
          className={buttonVariants({ variant: 'primary', size: 'xs' })}
        >
          <PencilLineIcon />
          {r.tests.some((x) => x.status === 'draft')
            ? t('continueEntry')
            : t('enter')}
        </Link>
      ),
    },
  ]

  return (
    <>
      <PageHeader title={t('title')} />
      <Card className="overflow-hidden">
        <FilterBar>
          <SearchInput
            value={query}
            onValueChange={setQuery}
            placeholder={t('searchPlaceholder')}
            aria-label={tc('search')}
            className="w-full sm:w-96"
          />
        </FilterBar>
        <div className="border-t border-line">
          <DataTable
            caption={t('title')}
            columns={columns}
            rows={data}
            getRowId={(r) => r.id}
            rowLabel={(r) => r.accessionNo ?? r.patient.name}
            onRowClick={(r) => void navigate(`/results/${r.id}`)}
            isLoading={isPending}
            isError={isError}
            onRetry={() => void refetch()}
            empty={
              <EmptyState
                icon={<PencilLineIcon />}
                title={t('emptyTitle')}
                description={t('emptyBody')}
              />
            }
          />
        </div>
      </Card>
    </>
  )
}
