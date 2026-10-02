import {
  CompassIcon,
  PencilLineIcon,
  PinIcon,
  PinOffIcon,
  BadgeCheckIcon,
} from 'lucide-react'
import { Link, useParams, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { usePreferences } from '@/app/preferences/context'
import { useEnum, useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import type { SampleRow } from '@/services/lab-api'
import { useDepartment } from '@/services/queries'
import { PageHeader } from '@/app/layout/page-header'
import { MetricStrip } from '@/components/ui/metric-strip'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { CardSkeleton, Skeleton } from '@/components/ui/skeleton'
import { EmptyState, ErrorState } from '@/components/ui/states'
import {
  EquipmentCard,
  QcTodayCard,
  QueueCard,
  StaffCard,
  TatByTestCard,
  TestsCard,
} from './department-widgets'
import { isDepartmentId } from './workload'

export function Component() {
  const t = useT('departments')
  const e = useEnum()
  const f = useFormat()
  const { departmentId } = useParams()
  const valid = isDepartmentId(departmentId)
  const id = valid ? departmentId : undefined
  const { department: working, setDepartment, actorId } = usePreferences()
  const { data, isPending, isError, refetch, dataUpdatedAt } = useDepartment(id)
  const [params, setParams] = useSearchParams()

  if (!id) {
    return (
      <>
        <PageHeader
          back={{ to: '/departments', label: t('title') }}
          title={t('notFoundTitle')}
        />
        <Card>
          <EmptyState
            icon={<CompassIcon />}
            title={t('notFoundTitle')}
            description={t('notFoundBody')}
            action={
              <Link
                to="/departments"
                className={buttonVariants({ variant: 'primary' })}
              >
                {t('backToDepartments')}
              </Link>
            }
          />
        </Card>
      </>
    )
  }

  const name = e('department', id)
  const isWorking = working === id

  const openSample = (row: SampleRow) => {
    const next = new URLSearchParams(params)
    next.set('sample', row.id)
    setParams(next)
  }

  const toggleWorking = () => {
    if (isWorking) {
      setDepartment(null)
      toast.success(t('workingCleared'))
    } else {
      setDepartment(id)
      toast.success(t('workingSet', { department: name }), {
        description: t('workingSetBody'),
      })
    }
  }

  return (
    <>
      <PageHeader
        back={{ to: '/departments', label: t('title') }}
        title={name}
        titleExtra={
          isWorking ? (
            <Badge tone="accent">
              <PinIcon strokeWidth={2.2} />
              {t('workingBadge')}
            </Badge>
          ) : null
        }
        meta={
          data ? (
            <span>{t('updatedAt', { time: f.time(dataUpdatedAt) })}</span>
          ) : null
        }
        actions={
          <>
            <Button
              variant={isWorking ? 'ghost' : 'secondary'}
              onClick={toggleWorking}
            >
              {isWorking ? <PinOffIcon /> : <PinIcon />}
              {isWorking ? t('clearWorking') : t('setWorking')}
            </Button>
            <Link
              to="/worklists"
              className={buttonVariants({ variant: 'secondary' })}
            >
              <PencilLineIcon />
              {t('openResultEntry')}
            </Link>
            <Link
              to="/verification"
              className={buttonVariants({ variant: 'primary' })}
            >
              <BadgeCheckIcon />
              {t('openValidation')}
            </Link>
          </>
        }
      />

      {isError && !data ? (
        <Card>
          <ErrorState onRetry={() => void refetch()} />
        </Card>
      ) : isPending || !data ? (
        <div role="status" aria-busy className="grid gap-5">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
          <div className="grid gap-5 xl:grid-cols-3">
            <CardSkeleton className="xl:col-span-2" lines={8} />
            <CardSkeleton lines={8} />
          </div>
        </div>
      ) : (
        <div className="grid gap-5">
          <MetricStrip
            items={[
              {
                key: 'tests',
                label: t('kpiTestsToday'),
                value: data.testsToday,
              },
              {
                key: 'pending',
                label: t('kpiPending'),
                value: data.pending,
                href: '/reception',
              },
              {
                key: 'lab',
                label: t('kpiInLab'),
                value: data.processing,
                href: '/worklists',
              },
              {
                key: 'awaiting',
                label: t('kpiAwaiting'),
                value: data.awaitingValidation,
                href: '/verification',
              },
              {
                key: 'done',
                label: t('kpiCompleted'),
                value: data.completed,
                href: '/reports',
              },
              {
                key: 'delayed',
                label: t('kpiDelayed'),
                value: data.delayed,
                alert: data.delayed > 0,
                href: '/tat',
              },
              {
                key: 'critical',
                label: t('kpiCriticals'),
                value: data.criticalsOpen,
                alert: data.criticalsOpen > 0,
                href: '/critical-results?status=pending',
              },
            ]}
          />

          <QueueCard
            rows={data.queue}
            activeId={params.get('sample')}
            onOpen={openSample}
          />

          <div className="grid gap-5 xl:grid-cols-3">
            <div className="min-w-0 xl:col-span-2">
              <EquipmentCard rows={data.equipmentRows} />
            </div>
            <QcTodayCard runs={data.qcToday} />
          </div>

          <div className="grid gap-5 xl:grid-cols-3">
            <div className="min-w-0 xl:col-span-2">
              <TestsCard tests={data.tests} />
            </div>
            <TatByTestCard rows={data.tat} onTimePct={data.tatOnTimePct} />
          </div>

          <StaffCard staff={data.staff} actorId={actorId} />
        </div>
      )}
    </>
  )
}
