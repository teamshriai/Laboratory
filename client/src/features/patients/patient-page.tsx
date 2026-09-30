import {
  ArrowLeftIcon,
  ClipboardListIcon,
  HistoryIcon,
  FileTextIcon,
  PlusIcon,
  CircleUserIcon,
  TriangleAlertIcon,
  PencilIcon,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { useRecentPatients } from '@/hooks/use-recent-patients'
import { useEnum, useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import { usePatient, useReference } from '@/services/queries'
import { AgeSex } from '@/components/lab/patient'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { Avatar } from '@/components/ui/misc'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { Tabs, TabsContent, TabsList } from '@/components/ui/tabs'
import {
  NotesCard,
  OrderList,
  PatientTimeline,
  ReportList,
  ResultsTable,
  SampleList,
} from './patient-sections'
import { EditPatientDialog } from './edit-patient-dialog'
import { TrendCard } from './trend-card'

const TABS = [
  'overview',
  'orders',
  'samples',
  'results',
  'reports',
  'history',
] as const
type Tab = (typeof TABS)[number]

export function Component() {
  const { patientId: id } = useParams()
  const t = useT('patients')
  const e = useEnum()
  const f = useFormat()
  const [params, setParams] = useSearchParams()
  const tab: Tab = TABS.includes(params.get('tab') as Tab)
    ? (params.get('tab') as Tab)
    : 'overview'
  const { data, isPending, isError, refetch } = usePatient(id)
  const { data: reference } = useReference()
  const { remember } = useRecentPatients()
  const [editing, setEditing] = useState(false)
  const p = data?.patient
  useDocumentTitle(p?.name)
  useEffect(() => {
    if (p) remember({ id: p.id, name: p.name, uhid: p.uhid })
  }, [p, remember])

  if (isPending) return <PatientSkeleton />
  if (isError) return <ErrorState onRetry={() => void refetch()} />
  if (!data || !p)
    return (
      <EmptyState
        icon={<CircleUserIcon />}
        title={t('notFound')}
        action={
          <Button asChild variant="secondary">
            <Link to="/laboratory/patients">{t('back')}</Link>
          </Button>
        }
      />
    )

  const staffName = (sid: string) =>
    reference?.staff.find((s) => s.id === sid)?.name ?? sid
  const active = data.orders.filter(
    (o) => o.status !== 'completed' && o.status !== 'cancelled',
  )
  const flagged = data.results.filter(
    (r) =>
      r.critical || (r.flag && r.flag !== 'NORMAL' && r.flag !== 'NEGATIVE'),
  )
  const location = p.encounter.ward
    ? `${p.encounter.ward}${p.encounter.bed ? ` / ${p.encounter.bed}` : ''}`
    : e('clinicalDepartment', p.encounter.department)

  return (
    <>
      <Link
        to="/laboratory/patients"
        className="tap-reach mb-3 inline-flex items-center gap-1.5 text-meta font-medium text-fg-muted hover:text-fg"
      >
        <ArrowLeftIcon aria-hidden />
        {t('title')}
      </Link>
      <header className="mb-5 flex flex-wrap items-start gap-x-4 gap-y-3 border-b border-line pb-5">
        <Avatar name={p.name} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <h1 className="text-title font-semibold text-fg">{p.name}</h1>
            {p.nameLocal ? (
              <span lang={p.nameLocal.lang} className="text-sm text-fg-muted">
                {p.nameLocal.text}
              </span>
            ) : null}
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-meta text-fg-muted">
            <AgeSex dob={p.dob} sex={p.sex} className="font-medium text-fg" />
            <span aria-hidden>·</span>
            <span className="font-mono text-fg">{p.uhid}</span>
            <span aria-hidden>·</span>
            <span>
              {e('encounter', p.encounter.type)}, {location}
            </span>
            {p.encounter.ipNumber || p.encounter.visitNo ? (
              <>
                <span aria-hidden>·</span>
                <span className="font-mono">
                  {p.encounter.ipNumber ?? p.encounter.visitNo}
                </span>
              </>
            ) : null}
            {p.attendingDoctor ? (
              <>
                <span aria-hidden>·</span>
                <span>{t('attending', { name: p.attendingDoctor })}</span>
              </>
            ) : null}
            {p.bloodGroup ? (
              <>
                <span aria-hidden>·</span>
                <span>
                  {t('bloodGroup')} {p.bloodGroup}
                </span>
              </>
            ) : null}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-muted">
            {p.allergies.length ? (
              <span className="inline-flex items-center gap-1 font-semibold text-danger-text">
                <TriangleAlertIcon
                  strokeWidth={2.2}
                  className="size-3.5"
                  aria-hidden
                />
                {t('allergies')}: {p.allergies.join(', ')}
              </span>
            ) : (
              <span>
                {t('allergies')}: {t('none')}
              </span>
            )}
            <span aria-hidden>·</span>
            <span className="tabular-nums">{p.mobile}</span>
            <span aria-hidden>·</span>
            <span>
              {p.city}, {p.state}
            </span>
            <span aria-hidden>·</span>
            <span>
              {t('registered')} {f.date(p.registeredAt)}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            <PencilIcon aria-hidden />
            {t('editDetails')}
          </Button>
          <Button asChild variant="secondary" size="sm">
            <Link
              to={`/laboratory/reports?q=${encodeURIComponent(p.uhid)}&date=all`}
            >
              {t('viewReports')}
            </Link>
          </Button>
          <Button asChild variant="primary" size="sm">
            <Link to={`/laboratory/orders/new?patient=${p.id}`}>
              <PlusIcon strokeWidth={2.5} aria-hidden />
              {t('newOrder')}
            </Link>
          </Button>
        </div>
      </header>
      {editing ? (
        <EditPatientDialog patient={p} onClose={() => setEditing(false)} />
      ) : null}

      <Tabs
        value={tab}
        onValueChange={(v) =>
          setParams(
            (prev) => {
              const n = new URLSearchParams(prev)
              if (v === 'overview') n.delete('tab')
              else n.set('tab', v)
              return n
            },
            { replace: true },
          )
        }
      >
        <TabsList
          className="mb-5"
          items={[
            {
              value: 'overview',
              label: t('tabOverview'),
            },
            {
              value: 'orders',
              label: t('tabOrders'),
              count: data.orders.length,
            },
            {
              value: 'samples',
              label: t('tabSamples'),
              count: data.samples.length,
            },
            {
              value: 'results',
              label: t('tabResults'),
              count: data.results.length,
            },
            {
              value: 'reports',
              label: t('tabReports'),
              count: data.reports.length,
            },
            {
              value: 'history',
              label: t('tabHistory'),
            },
          ]}
        />
        <TabsContent value="overview" className="grid gap-5">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-5">
              <TrendCard trends={data.trends} />
              <Card>
                <CardHeader
                  icon={<ClipboardListIcon />}
                  tone="sky"
                  title={t('activeOrders')}
                  action={<Badge>{active.length}</Badge>}
                />
                <OrderList orders={active} empty={t('noActive')} />
              </Card>
              <Card className="pb-2">
                <CardHeader
                  icon={<TriangleAlertIcon />}
                  tone="amber"
                  title={t('flagged')}
                  action={
                    <Badge tone={flagged.length ? 'warning' : 'neutral'}>
                      {flagged.length}
                    </Badge>
                  }
                />
                <ResultsTable results={flagged} filterable={false} limit={8} />
              </Card>
            </div>
            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-5">
              <NotesCard
                patientId={p.id}
                notes={p.notes}
                staffName={staffName}
              />
              <Card>
                <CardHeader
                  icon={<FileTextIcon />}
                  tone="teal"
                  title={t('recentReports')}
                />
                <ReportList
                  reports={data.reports.slice(0, 5)}
                  empty={t('noReports')}
                />
              </Card>
              <Card>
                <CardHeader
                  icon={<HistoryIcon />}
                  tone="indigo"
                  title={t('tabHistory')}
                />
                <PatientTimeline timeline={data.timeline.slice(0, 6)} />
              </Card>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="orders">
          <Card className="overflow-hidden">
            <OrderList orders={data.orders} empty={t('noOrders')} />
          </Card>
        </TabsContent>
        <TabsContent value="samples">
          <Card className="overflow-hidden">
            <SampleList samples={data.samples} empty={t('noOrders')} />
          </Card>
        </TabsContent>
        <TabsContent value="results">
          <Card className="overflow-hidden pt-4">
            <ResultsTable results={data.results} />
          </Card>
        </TabsContent>
        <TabsContent value="reports">
          <Card className="overflow-hidden">
            <ReportList reports={data.reports} empty={t('noReports')} />
          </Card>
        </TabsContent>
        <TabsContent value="history">
          <Card className="pt-5">
            <PatientTimeline timeline={data.timeline} />
          </Card>
        </TabsContent>
      </Tabs>
    </>
  )
}

function PatientSkeleton() {
  return (
    <div className="grid gap-5">
      <Skeleton className="h-40 rounded-xl" />
      <Skeleton className="h-11 rounded-lg" />
      <div className="grid grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-xl" />
    </div>
  )
}
