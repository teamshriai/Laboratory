import {
  BadgeCheckIcon,
  ChevronDownIcon,
  FileTextIcon,
  PencilLineIcon,
  PlusIcon,
  SyringeIcon,
  TestTubeIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu'
import { PageHeader } from '@/app/layout/page-header'
import { istHour } from '@/domain/time'
import { useNow } from '@/hooks/use-now'
import { useEnum, useT } from '@/i18n/context'
import { usePreferences } from '@/app/preferences/context'
import { usePermissions } from '@/hooks/use-permission'
import { useFormat } from '@/i18n/format'
import type { DashboardView } from '@/services/lab-api'
import { useDashboard, useLabSettings } from '@/services/queries'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/states'
import { DashboardHome } from './home'
import { PipelineFlow } from './pipeline-flow'
import {
  AnalyzersPanel,
  KpiRow,
  StockPanel,
  TatPanel,
  WorkloadPanel,
} from './sections'

/*
 * The bento grid (design system 9.1): auto-placement only, so source order is
 * visual order is tab order at every width. The skeleton renders from the
 * same cells, so nothing jumps when the data arrives.
 */
const GRID =
  'grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-6'

const FULL = 'sm:col-span-2 md:col-span-4 xl:col-span-6'

const CELLS: {
  key: string
  span: string
  skeleton: string
  render: (data: DashboardView) => ReactNode
}[] = [
  {
    key: 'kpis',
    span: FULL,
    skeleton: 'h-40',
    render: (d) => <KpiRow data={d} />,
  },
  {
    key: 'home',
    span: FULL,
    skeleton: 'h-[52rem]',
    render: (d) => <DashboardHome dashboard={d} />,
  },
  {
    key: 'performance',
    span: FULL,
    skeleton: 'h-8',
    render: () => <PerformanceHeading />,
  },
  {
    key: 'pipeline',
    span: FULL,
    skeleton: 'h-44',
    render: (d) => <PipelineFlow pipeline={d.pipeline} />,
  },
  {
    key: 'tat',
    span: 'sm:col-span-2 md:col-span-4 xl:col-span-3',
    skeleton: 'h-80',
    render: (d) => <TatPanel tat={d.tat} byDepartment={d.tatByDepartment} />,
  },
  {
    key: 'workload',
    span: 'sm:col-span-2 md:col-span-4 xl:col-span-3',
    skeleton: 'h-80',
    render: (d) => <WorkloadPanel workload={d.workload} />,
  },
  {
    key: 'analyzers',
    span: 'sm:col-span-2 md:col-span-4 xl:col-span-4',
    skeleton: 'h-64',
    render: (d) => <AnalyzersPanel data={d} />,
  },
  {
    key: 'stock',
    span: 'sm:col-span-2 md:col-span-4 xl:col-span-2',
    skeleton: 'h-64',
    render: (d) => <StockPanel alerts={d.stockAlerts} />,
  },
]

/** Separates the working day from the longer-term figures below it. */
function PerformanceHeading() {
  const t = useT('today')
  return (
    <h2 className="pt-6 text-base font-semibold text-fg">
      {t('performanceTitle')}
    </h2>
  )
}

/** The day's routine jumps, without taking space on the dashboard. */
function QuickActions() {
  const t = useT('dashboard')
  const navigate = useNavigate()
  const actions = [
    {
      to: '/collection',
      label: t('actionCollect'),
      icon: <SyringeIcon />,
    },
    {
      to: '/reception?status=collected',
      label: t('actionReceive'),
      icon: <TestTubeIcon />,
    },
    {
      to: '/worklists',
      label: t('actionEnter'),
      icon: <PencilLineIcon />,
    },
    {
      to: '/verification',
      label: t('actionValidate'),
      icon: <BadgeCheckIcon />,
    },
    {
      to: '/reports?status=validated',
      label: t('actionRelease'),
      icon: <FileTextIcon />,
    },
  ]
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button>
          {t('quickActions')}
          <ChevronDownIcon aria-hidden />
        </Button>
      </MenuTrigger>
      <MenuContent align="end">
        {actions.map((a) => (
          <MenuItem
            key={a.to}
            icon={a.icon}
            onSelect={() => void navigate(a.to)}
          >
            {a.label}
          </MenuItem>
        ))}
      </MenuContent>
    </Menu>
  )
}

export function Component() {
  const t = useT('dashboard')
  const f = useFormat()
  const now = useNow()
  const { data, isPending, isError, refetch, dataUpdatedAt } = useDashboard()
  const tt = useT('today')
  const e = useEnum()
  const { department } = usePreferences()
  const { actor } = usePermissions()
  const { data: settings } = useLabSettings()
  const hour = istHour(now)
  const greeting = tt(
    hour < 12
      ? 'greeting.morning'
      : hour < 17
        ? 'greeting.afternoon'
        : 'greeting.evening',
    { name: actor?.name ?? '' },
  )
  const shift =
    hour >= 7 && hour < 14
      ? t('shiftMorning')
      : hour >= 14 && hour < 21
        ? t('shiftEvening')
        : t('shiftNight')

  return (
    <>
      <PageHeader
        title={greeting}
        documentTitle={t('title')}
        meta={
          <>
            <span>{f.date(now)}</span>
            <span>{shift}</span>
            <span>
              {department ? e('department', department) : tt('allDepartments')}
            </span>
            {settings?.labName ? <span>{settings.labName}</span> : null}
            {dataUpdatedAt ? (
              <span>{t('updated', { time: f.time(dataUpdatedAt) })}</span>
            ) : null}
          </>
        }
        actions={
          <>
            <QuickActions />
            <Button asChild variant="primary">
              <Link to="/orders/new">
                <PlusIcon strokeWidth={2.5} aria-hidden />
                {t('actionNewOrder')}
              </Link>
            </Button>
          </>
        }
      />
      {isError ? (
        <Card>
          <ErrorState onRetry={() => void refetch()} />
        </Card>
      ) : (
        <div className={GRID} aria-busy={isPending || undefined}>
          {CELLS.map((c) => (
            <div key={c.key} className={`min-w-0 ${c.span}`}>
              {isPending || !data ? (
                <Skeleton className={`w-full rounded-xl ${c.skeleton}`} />
              ) : (
                c.render(data)
              )}
            </div>
          ))}
        </div>
      )}
    </>
  )
}
