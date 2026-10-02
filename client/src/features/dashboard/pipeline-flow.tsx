import {
  BadgeCheckIcon,
  ChevronRightIcon,
  ClipboardListIcon,
  FileTextIcon,
  FlaskConicalIcon,
  PencilLineIcon,
  SyringeIcon,
  TestTubeIcon,
  TriangleAlertIcon,
  WorkflowIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import type { PipelineStage } from '@/domain/workflow'
import { useEnum, useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import { cn } from '@/lib/cn'
import { NAV_TONES, type IconTone } from '@/lib/icon-tones'
import type { DashboardView } from '@/services/lab-api'
import { Card, CardHeader } from '@/components/ui/card'
import { SoftIconTile } from '@/components/ui/icon-tile'

const STAGES: {
  stage: PipelineStage
  to: string
  icon: ReactNode
  tone: IconTone
}[] = [
  {
    stage: 'ordered',
    to: '/collection',
    icon: <ClipboardListIcon />,
    tone: NAV_TONES.orders,
  },
  {
    stage: 'collected',
    to: '/reception?status=collected',
    icon: <SyringeIcon />,
    tone: NAV_TONES.collection,
  },
  {
    stage: 'received',
    to: '/reception?status=received',
    icon: <TestTubeIcon />,
    tone: NAV_TONES.processing,
  },
  {
    stage: 'processing',
    to: '/worklists',
    icon: <FlaskConicalIcon />,
    tone: 'violet',
  },
  {
    stage: 'result-entered',
    to: '/verification',
    icon: <PencilLineIcon />,
    tone: NAV_TONES.results,
  },
  {
    stage: 'validated',
    to: '/reports?status=validated',
    icon: <BadgeCheckIcon />,
    tone: NAV_TONES.validation,
  },
  {
    stage: 'reported',
    to: '/reports?status=released',
    icon: <FileTextIcon />,
    tone: NAV_TONES.reports,
  },
]

/** The sample pipeline as a connected flow of stages, largest queue marked. */
export function PipelineFlow({
  pipeline,
}: {
  pipeline: DashboardView['pipeline']
}) {
  const t = useT('dashboard')
  const e = useEnum()
  const f = useFormat()
  // Reported samples are done for the day; the queues are the stages before.
  const active = STAGES.slice(0, -1)
  const largest = active.reduce((best, s) =>
    pipeline[s.stage] > pipeline[best.stage] ? s : best,
  )
  const inProgress = active.reduce((n, s) => n + pipeline[s.stage], 0)
  const max = Math.max(1, ...STAGES.map((s) => pipeline[s.stage]))
  return (
    <Card className="min-w-0">
      <CardHeader
        icon={<WorkflowIcon />}
        tone={NAV_TONES.workQueue}
        title={t('pipeline')}
        description={t('pipelineMeta', { count: f.number(inProgress) })}
      />
      <ol className="grid gap-2 px-4 pb-4 sm:px-5 sm:pb-5 md:grid-cols-7">
        {STAGES.map((s, i) => {
          const count = pipeline[s.stage]
          const isLargest = s.stage === largest.stage && count > 0
          const done = s.stage === 'reported'
          return (
            <li key={s.stage} className="relative flex md:block">
              {/* Phone: a vertical connector line between stages. */}
              {i < STAGES.length - 1 ? (
                <span
                  aria-hidden
                  className="absolute top-12 bottom-0 left-[26px] w-px bg-line md:hidden"
                />
              ) : null}
              <Link
                to={s.to}
                aria-label={t('stageLabel', {
                  stage: e('stage', s.stage),
                  count,
                })}
                className={cn(
                  'focus-ring group relative z-[1] flex w-full min-w-0 items-center gap-3 rounded-xl border p-2.5 transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:shadow-card-md md:h-full md:flex-col md:items-start md:gap-2 md:p-3',
                  isLargest
                    ? 'border-warning-text/35 bg-warning-soft'
                    : done
                      ? 'border-line bg-surface-2'
                      : 'border-line bg-surface',
                )}
              >
                <SoftIconTile icon={s.icon} tone={s.tone} size="md" />
                <span className="min-w-0 flex-1 md:w-full">
                  <span
                    className={cn(
                      'block text-2xl leading-none font-semibold tracking-tight tabular-nums',
                      done ? 'text-fg-muted' : 'text-fg',
                    )}
                  >
                    {f.number(count)}
                  </span>
                  <span className="mt-1 block truncate text-xs font-medium text-fg-muted">
                    {e('stage', s.stage)}
                  </span>
                  <span
                    aria-hidden
                    className="mt-2 block h-1.5 overflow-hidden rounded-full bg-surface-3"
                  >
                    <span
                      className={cn(
                        'block h-full rounded-full',
                        isLargest
                          ? 'bg-warning'
                          : done
                            ? 'bg-chart-6'
                            : 'bg-chart-1',
                      )}
                      style={{ width: `${(count / max) * 100}%` }}
                    />
                  </span>
                  <span
                    className={cn(
                      'mt-1.5 flex items-center gap-1 text-2xs font-semibold text-warning-text',
                      !isLargest && 'invisible max-md:hidden',
                    )}
                  >
                    <TriangleAlertIcon className="size-3" aria-hidden />
                    {t('largestQueue')}
                  </span>
                </span>
              </Link>
              {i < STAGES.length - 1 ? (
                <span
                  aria-hidden
                  className="absolute top-1/2 -right-[13px] z-[2] hidden size-[18px] -translate-y-1/2 items-center justify-center rounded-full border border-line bg-surface text-fg-subtle md:flex"
                >
                  <ChevronRightIcon className="size-3" strokeWidth={2.5} />
                </span>
              ) : null}
            </li>
          )
        })}
      </ol>
    </Card>
  )
}
