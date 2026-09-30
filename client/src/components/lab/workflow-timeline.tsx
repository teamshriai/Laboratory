import {
  CheckIcon,
  ClipboardListIcon,
  FileTextIcon,
  FlaskConicalIcon,
  LucideProvider,
  PackageIcon,
  PencilLineIcon,
  BadgeCheckIcon,
  SyringeIcon,
  ScanSearchIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useEnum, useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import { cn } from '@/lib/cn'
import type { Milestone, MilestoneEntry } from '@/services/lab-api'

const ICON: Record<Milestone, ReactNode> = {
  ordered: <ClipboardListIcon />,
  collected: <SyringeIcon />,
  received: <PackageIcon />,
  processing: <FlaskConicalIcon />,
  entered: <PencilLineIcon />,
  reviewed: <ScanSearchIcon />,
  validated: <BadgeCheckIcon />,
  released: <FileTextIcon />,
}

/** Fixed eight-step path from order to released report, with who and when. */
export function WorkflowTimeline({
  milestones,
  className,
}: {
  milestones: MilestoneEntry[]
  className?: string
}) {
  const t = useT('history')
  const e = useEnum()
  const f = useFormat()
  const current = milestones.findIndex((m) => m.at === undefined)
  return (
    <ol className={cn('relative', className)}>
      {milestones.map((m, i) => {
        const done = m.at !== undefined
        const isCurrent = i === current
        return (
          <li key={m.key} className="relative flex gap-3 pb-3.5 last:pb-0">
            {i < milestones.length - 1 ? (
              <span
                aria-hidden
                className={cn(
                  'absolute top-7 bottom-0 left-[13px] w-px',
                  done && milestones[i + 1]?.at !== undefined
                    ? 'bg-success/50'
                    : 'bg-line',
                )}
              />
            ) : null}
            <span
              className={cn(
                'relative grid size-7 shrink-0 place-items-center rounded-full bg-surface',
                done
                  ? 'text-ic-green'
                  : isCurrent
                    ? 'text-accent-text ring-2 ring-accent/40'
                    : 'text-fg-subtle',
              )}
            >
              <LucideProvider size={18} strokeWidth={done ? 2.2 : 1.8}>
                {ICON[m.key]}
              </LucideProvider>
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <p
                  className={cn(
                    'text-sm',
                    done
                      ? 'font-medium text-fg'
                      : isCurrent
                        ? 'font-medium text-fg'
                        : 'text-fg-subtle',
                  )}
                >
                  {t(`milestone.${m.key}`)}
                </p>
                {done ? (
                  <span className="inline-flex items-center gap-1 text-xs text-fg-muted tabular-nums">
                    <CheckIcon
                      strokeWidth={2.5}
                      className="size-3 text-success-text"
                      aria-hidden
                    />
                    {f.dateTime(m.at!)}
                  </span>
                ) : (
                  <span className="text-xs text-fg-subtle">
                    {isCurrent ? t('milestoneNext') : t('milestonePending')}
                  </span>
                )}
              </div>
              {done && (m.byName || m.note) ? (
                <p className="mt-0.5 text-xs text-fg-muted">
                  {m.byName}
                  {m.role ? (
                    <span className="text-fg-subtle">
                      {' '}
                      · {e('staffRole', m.role)}
                    </span>
                  ) : null}
                  {m.note ? (
                    <span className="text-fg-subtle"> · {m.note}</span>
                  ) : null}
                </p>
              ) : null}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
