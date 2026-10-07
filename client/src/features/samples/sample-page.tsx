import { ArrowLeftIcon, TestTubeIcon } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { useEnum, useT } from '@/i18n/context'
import { isLabApiError } from '@/services/lab-api'
import { useSample } from '@/services/queries'
import { PageHeader } from '@/app/layout/page-header'
import { PatientBanner } from '@/components/lab/patient-banner'
import { RecordLink } from '@/components/lab/record-link'
import { SamplePipeline } from '@/components/lab/sample'
import { PriorityBadge, SampleStatusBadge } from '@/components/lab/status'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { CardSkeleton, Skeleton } from '@/components/ui/skeleton'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { useSampleActions } from './sample-actions'
import {
  SampleAlerts,
  SampleDetails,
  SampleOrderLinks,
  SampleTests,
  SampleTimeline,
} from './sample-sections'
import { Button } from '@/components/ui/button'
import { showAliquots, showSendOut } from './handling-rules'
import { SampleAliquots, SampleSendOut } from './sample-handling'

export function Component() {
  const { sampleId } = useParams()
  const t = useT('processing')
  const tc = useT('common')
  const e = useEnum()
  const {
    data: sample,
    isPending,
    isError,
    error,
    refetch,
  } = useSample(sampleId)
  const { primary, secondary, dialogs } = useSampleActions(sample)

  if (isPending)
    return (
      <div className="grid gap-5">
        <Skeleton className="h-10 w-72 max-w-full" />
        <Skeleton className="h-28 rounded-xl" />
        <div className="grid gap-5 xl:grid-cols-3">
          <CardSkeleton className="xl:col-span-2" lines={10} />
          <CardSkeleton lines={8} />
        </div>
      </div>
    )
  if (isError || !sample)
    return (
      <Card>
        {isLabApiError(error) && error.code === 'not-found' ? (
          <EmptyState
            icon={<TestTubeIcon />}
            title={t('notFoundTitle')}
            description={t('notFoundBody')}
            action={
              <Link
                to="/reception"
                className={buttonVariants({ variant: 'primary' })}
              >
                <ArrowLeftIcon />
                {t('backToProcessing')}
              </Link>
            }
          />
        ) : (
          <ErrorState onRetry={() => void refetch()} />
        )}
      </Card>
    )

  return (
    <>
      <PageHeader
        back={{ to: '/reception', label: t('title') }}
        title={
          <span className="font-mono">
            {sample.accessionNo ?? t('pendingAccession')}
          </span>
        }
        documentTitle={sample.accessionNo ?? t('pendingAccession')}
        titleExtra={
          <>
            <SampleStatusBadge status={sample.status} />
            <PriorityBadge priority={sample.priority} hideRoutine />
          </>
        }
        meta={`${e('container', sample.container)} · ${e('specimen', sample.specimen)} · ${e('department', sample.department)}`}
        actions={
          <>
            {secondary.map((a) => (
              <Button
                key={a.key}
                size="sm"
                variant={a.danger ? 'danger-soft' : 'secondary'}
                onClick={a.onSelect}
              >
                {a.icon}
                {a.label}
              </Button>
            ))}
            {primary}
          </>
        }
      />
      <PatientBanner
        patient={sample.patient}
        extra={
          <span className="flex items-baseline gap-1.5">
            <span className="text-fg-muted">{tc('orderNo')}</span>
            <RecordLink
              kind="order"
              id={sample.orderId}
              className="font-semibold text-fg"
            >
              {sample.orderNo}
            </RecordLink>
          </span>
        }
      />
      <div className="grid gap-5">
        <SampleAlerts sample={sample} />
        <Card className="px-5 py-5">
          <SamplePipeline
            stage={sample.stage}
            rejected={sample.status === 'rejected'}
          />
        </Card>
        <div className="grid gap-5 xl:grid-cols-3">
          <div className="grid content-start gap-5 xl:col-span-2">
            <Card>
              <CardHeader title={t('sectionTests')} />
              <CardBody>
                <SampleTests sample={sample} />
              </CardBody>
            </Card>
            <Card>
              <CardHeader title={t('sectionTimeline')} />
              <CardBody>
                <SampleTimeline sample={sample} />
              </CardBody>
            </Card>
          </div>
          <div className="grid content-start gap-5">
            <Card>
              <CardHeader title={t('sectionSample')} />
              <CardBody>
                <SampleDetails sample={sample} />
              </CardBody>
            </Card>
            <Card>
              <CardHeader title={t('sectionOrder')} />
              <CardBody>
                <SampleOrderLinks sample={sample} />
              </CardBody>
            </Card>
            {showAliquots(sample) ? (
              <Card>
                <CardHeader title={t('sectionAliquots')} />
                <CardBody>
                  <SampleAliquots sample={sample} />
                </CardBody>
              </Card>
            ) : null}
            {showSendOut(sample) ? (
              <Card>
                <CardHeader title={t('sectionReferral')} />
                <CardBody>
                  <SampleSendOut sample={sample} />
                </CardBody>
              </Card>
            ) : null}
          </div>
        </div>
      </div>
      {dialogs}
    </>
  )
}
