import {
  BellRingIcon,
  HistoryIcon,
  UserPlusIcon,
  UsersIcon,
} from 'lucide-react'
import { PageHeader } from '@/app/layout/page-header'
import { useDeferredValue, useRef } from 'react'
import { Link, useNavigate } from 'react-router'
import { ENCOUNTER_TYPES, type EncounterType } from '@/domain/types'
import { useNow } from '@/hooks/use-now'
import { useOverlayParam, useUrlFilters } from '@/hooks/use-search-param'
import { useRecentPatients } from '@/hooks/use-recent-patients'
import { useEnum, useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import type { PatientFilters, PatientRow } from '@/services/lab-api'
import { usePatients } from '@/services/queries'
import { useTablePaging } from '@/hooks/use-table-paging'
import { PatientCell } from '@/components/lab/patient'
import { OrderStatusBadge } from '@/components/lab/status'
import { Badge } from '@/components/ui/badge'
import { GuardedButton } from '@/components/lab/guarded-button'
import { Card } from '@/components/ui/card'
import { DataTable, type Column } from '@/components/ui/data-table'
import { SearchInput } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { FilterTabs } from '@/components/ui/toggles'
import { FilterBar } from '@/components/lab/filter-bar'
import { EmptyState } from '@/components/ui/states'
import { RegisterPatientDialog } from './register-patient-dialog'

const CHIPS = ['all', 'active', 'critical', 'abnormal'] as const
type Chip = (typeof CHIPS)[number]

export function Component() {
  const t = useT('patients')
  const tc = useT('common')
  const e = useEnum()
  const f = useFormat()
  const now = useNow()
  const navigate = useNavigate()
  const { recent } = useRecentPatients()
  const url = useUrlFilters(
    { q: '', flag: 'all', encounter: 'all' },
    { flag: CHIPS, encounter: ['all', ...ENCOUNTER_TYPES] },
  )
  const query = url.values.q
  const setQuery = (v: string) => url.set({ q: v })
  const q = useDeferredValue(query)
  const chip = url.values.flag as Chip
  const encounter = url.values.encounter as EncounterType | 'all'
  // ?new=1 opens registration (the button and the command palette).
  const [newParam, openNew, closeNew] = useOverlayParam('new')
  const registering = newParam === '1'
  // After a registration the page moves to the new patient; closing the
  // dialog as well would be a second navigation that cancels it.
  const registeredRef = useRef(false)
  const setRegistering = (open: boolean) => {
    if (open) {
      registeredRef.current = false
      openNew('1')
    } else if (!registeredRef.current) closeNew()
  }
  const onRegistered = (p: { id: string }) => {
    registeredRef.current = true
    // The new patient's page takes the dialog's history entry, so Back does
    // not reopen the registration form.
    void navigate(`/patients/${p.id}`, { replace: true })
  }
  const paging = useTablePaging(25, ['patient', 'flags', 'visit'])
  const filters: PatientFilters = {
    q,
    ...(chip !== 'all' ? { flag: chip } : {}),
    ...(encounter !== 'all' ? { encounter } : {}),
  }
  const { data, isPending, isError, refetch } = usePatients({
    ...filters,
    ...paging.query,
  })

  const columns: Column<PatientRow>[] = [
    {
      id: 'patient',
      header: t('colPatient'),
      sortable: true,
      cell: (r) => <PatientCell patient={r} />,
    },
    {
      id: 'contact',
      header: t('colContact'),
      cell: (r) => (
        <span className="text-meta whitespace-nowrap text-fg tabular-nums">
          {r.mobile}
        </span>
      ),
    },
    {
      id: 'encounter',
      header: t('colEncounter'),
      cell: (r) => (
        <div className="text-meta">
          <p className="text-fg">{e('encounter', r.encounter.type)}</p>
          <p className="max-w-44 truncate text-xs text-fg-muted">
            {r.encounter.ward
              ? `${r.encounter.ward}${r.encounter.bed ? ` / ${r.encounter.bed}` : ''}`
              : e('clinicalDepartment', r.encounter.department)}
          </p>
        </div>
      ),
    },
    {
      id: 'latest',
      header: t('colLatest'),
      cell: (r) =>
        r.latestOrder ? (
          <div className="grid justify-items-start gap-1">
            <span className="max-w-[min(13rem,100%)] truncate text-meta text-fg">
              {r.latestOrder.tests.join(' + ')}
            </span>
            <OrderStatusBadge status={r.latestOrder.status} size="sm" />
          </div>
        ) : (
          <span className="text-xs text-fg-subtle">{t('noOrders')}</span>
        ),
    },
    {
      id: 'flags',
      header: t('colFlags'),
      sortable: true,
      cell: (r) => (
        <div className="flex flex-wrap gap-1">
          {r.openCriticals ? (
            <Badge tone="solidDanger" size="sm">
              <BellRingIcon strokeWidth={2.2} />
              {t('critical', { count: r.openCriticals })}
            </Badge>
          ) : null}
          {r.abnormalResults ? (
            <span className="text-xs font-semibold text-warning-text">
              {t('abnormal', { count: r.abnormalResults })}
            </span>
          ) : null}
          {r.activeOrders ? (
            <span className="text-xs text-fg-muted">
              {t('active', { count: r.activeOrders })}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      id: 'visit',
      tabletHidden: true,
      header: t('colLastVisit'),
      sortable: true,
      cell: (r) => (
        <span className="text-meta whitespace-nowrap text-fg-muted">
          {f.relative(r.lastVisitAt, now)}
        </span>
      ),
    },
  ]

  const chips: { value: Chip; label: string }[] = [
    { value: 'all', label: t('chipAll') },
    { value: 'active', label: t('chipActive') },
    { value: 'critical', label: t('chipCritical') },
    { value: 'abnormal', label: t('chipAbnormal') },
  ]

  return (
    <>
      <PageHeader
        title={t('title')}
        meta={
          <>{data ? <Badge tone="neutral">{data.page.total}</Badge> : null}</>
        }
        actions={
          <>
            <GuardedButton
              permission="patient.register"
              variant="primary"
              onClick={() => setRegistering(true)}
            >
              <UserPlusIcon />
              {t('register')}
            </GuardedButton>
          </>
        }
      />
      <Card className="overflow-hidden">
        <div className="border-b border-line px-3 pt-1">
          <FilterTabs
            value={chip}
            onValueChange={(v) => url.set({ flag: v })}
            aria-label={t('title')}
            items={chips}
          />
        </div>
        <FilterBar onClear={() => url.clear()} canClear={url.activeCount() > 0}>
          <SearchInput
            value={query}
            onValueChange={setQuery}
            placeholder={t('search')}
            aria-label={tc('search')}
            className="w-full sm:w-96"
            autoFocus
          />
          <Select
            size="sm"
            className="w-44"
            aria-label={t('colEncounter')}
            value={encounter}
            onValueChange={(v) => url.set({ encounter: v })}
            options={[
              { value: 'all' as const, label: t('allEncounters') },
              ...ENCOUNTER_TYPES.map((x) => ({
                value: x,
                label: e('encounter', x),
              })),
            ]}
          />
        </FilterBar>
        {recent.length ? (
          <div className="flex flex-wrap items-center gap-1.5 border-t border-line px-4 py-2">
            <span className="inline-flex items-center gap-1.5 text-xs text-fg-subtle">
              <HistoryIcon className="size-4" aria-hidden />
              {t('recent')}
            </span>
            {recent.slice(0, 4).map((p) => (
              <Link
                key={p.id}
                to={`/patients/${p.id}`}
                className="focus-ring tap-reach inline-flex h-7 items-center rounded-full bg-surface-2 px-2.5 text-xs font-medium text-fg hover:bg-surface-3"
              >
                {p.name}
              </Link>
            ))}
          </div>
        ) : null}
        <div className="border-t border-line">
          <DataTable
            caption={t('title')}
            columns={columns}
            rows={data?.rows}
            server={paging.table(data?.page)}
            getRowId={(r) => r.id}
            rowLabel={(r) => r.name}
            onRowClick={(r) => void navigate(`/patients/${r.id}`)}
            isLoading={isPending}
            isError={isError}
            onRetry={() => void refetch()}
            minWidth={960}
            empty={
              <EmptyState
                icon={<UsersIcon />}
                title={t('emptyTitle')}
                description={t('emptyBody')}
                action={
                  <GuardedButton
                    permission="patient.register"
                    variant="primary"
                    onClick={() => setRegistering(true)}
                  >
                    <UserPlusIcon />
                    {t('register')}
                  </GuardedButton>
                }
              />
            }
          />
        </div>
      </Card>
      <RegisterPatientDialog
        open={registering}
        onOpenChange={setRegistering}
        initialName={query}
        onRegistered={onRegistered}
      />
    </>
  )
}
