import { ExternalLinkIcon, EllipsisIcon } from 'lucide-react'
import { Link } from 'react-router'
import { useEnum, useT } from '@/i18n/context'
import { useSample } from '@/services/queries'
import { PatientBanner } from '@/components/lab/patient-banner'
import { SamplePipeline } from '@/components/lab/sample'
import { PriorityBadge, SampleStatusBadge } from '@/components/lab/status'
import { Button, buttonVariants } from '@/components/ui/button'
import { Drawer } from '@/components/ui/dialog'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu'
import { SkeletonText } from '@/components/ui/skeleton'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { useSampleActions } from './sample-actions'
import {
  SampleAlerts,
  SampleDetails,
  SampleOrderLinks,
  SampleTests,
  SampleTimeline,
} from './sample-sections'
import { TestTubeIcon } from 'lucide-react'
import { isLabApiError } from '@/services/lab-api'

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section>
      <h3 className="mb-2.5 text-xs font-semibold tracking-wide text-fg-subtle uppercase">
        {title}
      </h3>
      {children}
    </section>
  )
}

export default function SampleDrawer({
  sampleId,
  onClose,
}: {
  sampleId: string
  onClose: () => void
}) {
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
  return (
    <Drawer
      open
      onOpenChange={(o) => !o && onClose()}
      size="lg"
      title={
        <span className="font-mono">
          {sample?.accessionNo ?? t('pendingAccession')}
        </span>
      }
      headerExtra={
        sample ? (
          <>
            <SampleStatusBadge status={sample.status} />
            <PriorityBadge priority={sample.priority} hideRoutine />
          </>
        ) : null
      }
      description={
        sample
          ? `${e('container', sample.container)} · ${e('department', sample.department)}`
          : undefined
      }
      footer={
        sample ? (
          <>
            <Link
              to={`/specimens/${sample.id}`}
              className={buttonVariants({
                variant: 'ghost',
                className: 'mr-auto',
              })}
            >
              <ExternalLinkIcon />
              {t('openFullPage')}
            </Link>
            {secondary.length ? (
              <Menu>
                <MenuTrigger asChild>
                  <Button
                    size="icon-sm"
                    variant="secondary"
                    aria-label={tc('moreActions')}
                  >
                    <EllipsisIcon strokeWidth={2.5} />
                  </Button>
                </MenuTrigger>
                <MenuContent>
                  {secondary.map((a) => (
                    <MenuItem
                      key={a.key}
                      icon={a.icon}
                      onSelect={a.onSelect}
                      danger={a.danger}
                    >
                      {a.label}
                    </MenuItem>
                  ))}
                </MenuContent>
              </Menu>
            ) : null}
            {primary}
          </>
        ) : null
      }
    >
      {isPending ? (
        <div className="grid gap-6">
          <SkeletonText lines={3} />
          <SkeletonText lines={6} />
        </div>
      ) : isError || !sample ? (
        isLabApiError(error) && error.code === 'not-found' ? (
          <EmptyState
            icon={<TestTubeIcon />}
            title={t('notFoundTitle')}
            description={t('notFoundBody')}
          />
        ) : (
          <ErrorState onRetry={() => void refetch()} />
        )
      ) : (
        <div className="grid gap-6">
          <PatientBanner
            patient={sample.patient}
            sticky={false}
            className="mb-0"
          />
          <SampleAlerts sample={sample} />
          <div className="rounded-xl border border-line p-4">
            <SamplePipeline
              stage={sample.stage}
              rejected={sample.status === 'rejected'}
            />
          </div>
          <Section title={t('sectionTests')}>
            <SampleTests sample={sample} />
          </Section>
          <Section title={t('sectionSample')}>
            <SampleDetails sample={sample} />
          </Section>
          <Section title={t('sectionOrder')}>
            <SampleOrderLinks sample={sample} />
          </Section>
          <Section title={t('sectionTimeline')}>
            <SampleTimeline sample={sample} />
          </Section>
        </div>
      )}
      {dialogs}
    </Drawer>
  )
}
