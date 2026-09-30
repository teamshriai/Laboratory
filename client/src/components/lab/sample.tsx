import { CheckIcon, XIcon } from 'lucide-react'
import type { ContainerId } from '@/domain/types'
import {
  PIPELINE_STAGES,
  stageIndex,
  type PipelineStage,
} from '@/domain/workflow'
import { useEnum } from '@/i18n/context'
import { cn } from '@/lib/cn'

const TUBE: Record<ContainerId, string> = {
  edta: 'bg-tube-edta',
  sst: 'bg-tube-sst',
  plain: 'bg-tube-plain',
  citrate: 'bg-tube-citrate',
  fluoride: 'bg-tube-fluoride',
  heparin: 'bg-tube-heparin',
  urine: 'bg-tube-sst',
  stool: 'bg-tube-formalin',
  'culture-bottle': 'bg-tube-culture',
  sterile: 'bg-tube-sterile',
  formalin: 'bg-tube-formalin',
  slide: 'bg-tube-slide',
}

export function TubeDot({
  container,
  className,
}: {
  container: ContainerId
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-block size-2.5 shrink-0 rounded-full ring-2 ring-surface outline outline-1 outline-line-strong',
        TUBE[container],
        className,
      )}
    />
  )
}

/** Tube-cap colour plus container name; the name keeps it readable without colour. */
export function ContainerChip({
  container,
  full,
  className,
}: {
  container: ContainerId
  full?: boolean
  className?: string
}) {
  const e = useEnum()
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-meta whitespace-nowrap text-fg',
        className,
      )}
    >
      <TubeDot container={container} />
      {full ? e('container', container) : e('containerShort', container)}
    </span>
  )
}

/** Where a sample sits in the 7-stage laboratory workflow. */
export function SamplePipeline({
  stage,
  rejected,
  compact,
  className,
}: {
  stage: PipelineStage
  rejected?: boolean
  compact?: boolean
  className?: string
}) {
  const e = useEnum()
  const current = stageIndex(stage)
  if (compact) {
    return (
      <span className={cn('inline-flex items-center gap-2', className)}>
        <span className="flex gap-0.5" aria-hidden>
          {PIPELINE_STAGES.map((s, i) => (
            <span
              key={s}
              className={cn(
                'h-1.5 w-3 rounded-full',
                rejected
                  ? 'bg-danger/40'
                  : i < current
                    ? 'bg-accent'
                    : i === current
                      ? 'bg-accent/60'
                      : 'bg-surface-3',
              )}
            />
          ))}
        </span>
        <span className="text-xs text-fg-muted">{e('stage', stage)}</span>
      </span>
    )
  }
  return (
    <ol
      className={cn('grid grid-cols-7 gap-1', className)}
      aria-label={e('stage', stage)}
    >
      {PIPELINE_STAGES.map((s, i) => {
        const done = !rejected && i < current
        const active = i === current
        return (
          <li
            key={s}
            className="flex min-w-0 flex-col items-center gap-2 text-center"
          >
            <div className="flex w-full items-center">
              <span
                className={cn(
                  'h-0.5 flex-1',
                  i === 0
                    ? 'opacity-0'
                    : done || active
                      ? 'bg-accent'
                      : 'bg-line',
                )}
              />
              <span
                aria-current={active ? 'step' : undefined}
                className={cn(
                  'grid size-7 shrink-0 place-items-center rounded-full text-2xs font-semibold',
                  done && 'bg-accent text-on-accent',
                  active &&
                    !rejected &&
                    'bg-accent-soft text-accent-text ring-2 ring-accent',
                  active && rejected && 'bg-danger text-on-danger',
                  !done && !active && 'bg-surface-3 text-fg-subtle',
                )}
              >
                {done ? (
                  <CheckIcon strokeWidth={2.5} className="size-3.5" />
                ) : active && rejected ? (
                  <XIcon strokeWidth={2.5} className="size-3.5" />
                ) : (
                  i + 1
                )}
              </span>
              <span
                className={cn(
                  'h-0.5 flex-1',
                  i === PIPELINE_STAGES.length - 1
                    ? 'opacity-0'
                    : done
                      ? 'bg-accent'
                      : 'bg-line',
                )}
              />
            </div>
            <span
              className={cn(
                'text-2xs leading-tight font-medium',
                active ? 'text-fg' : 'text-fg-muted',
              )}
            >
              {e('stage', s)}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
