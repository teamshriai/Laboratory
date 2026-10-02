import {
  Undo2Icon,
  BellRingIcon,
  CheckCheckIcon,
  FileTextIcon,
  GaugeIcon,
  HourglassIcon,
  LockIcon,
  SyringeIcon,
  TimerIcon,
  CircleAlertIcon,
  WrenchIcon,
  CircleXIcon,
  BellOffIcon,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import type { NotificationType } from '@/domain/types'
import { useNow } from '@/hooks/use-now'
import { useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import { cn } from '@/lib/cn'
import { labApi, type SummaryKey } from '@/services/lab-api'
import { useLabMutation } from '@/services/mutations'
import { useNotifications } from '@/services/queries'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/menu'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/states'
import { Tooltip } from '@/components/ui/tooltip'
import { IconTile } from '@/components/ui/icon-tile'
import type { IconTone } from '@/lib/icon-tones'
import { useNotificationPrefs } from '@/hooks/use-notification-prefs'

const TYPE_ICON: Record<NotificationType, { icon: ReactNode; tone: IconTone }> =
  {
    'critical-detected': {
      icon: <BellRingIcon strokeWidth={2.2} />,
      tone: 'rose',
    },
    'critical-escalated': {
      icon: <BellRingIcon strokeWidth={2.2} />,
      tone: 'red',
    },
    'sample-rejected': {
      icon: <CircleXIcon />,
      tone: 'rose',
    },
    'recollection-requested': {
      icon: <SyringeIcon />,
      tone: 'amber',
    },
    'report-released': {
      icon: <FileTextIcon />,
      tone: 'green',
    },
    'report-corrected': {
      icon: <FileTextIcon />,
      tone: 'teal',
    },
    'report-withdrawn': {
      icon: <FileTextIcon />,
      tone: 'teal',
    },
    'qc-failed': { icon: <GaugeIcon />, tone: 'rose' },
    'equipment-down': {
      icon: <WrenchIcon />,
      tone: 'rose',
    },
    'lot-quarantined': {
      icon: <LockIcon />,
      tone: 'blue',
    },
    'result-returned': {
      icon: <Undo2Icon />,
      tone: 'amber',
    },
  }

const SUMMARY_ICON: Record<SummaryKey, ReactNode> = {
  'critical-pending': <CircleAlertIcon strokeWidth={2.2} />,
  'tat-approaching': <TimerIcon strokeWidth={2.2} />,
  'lots-expiring': <HourglassIcon strokeWidth={2.2} />,
  'recollection-pending': <SyringeIcon strokeWidth={2.2} />,
}

export function NotificationPanel({ trigger }: { trigger: ReactNode }) {
  const t = useT('notifications')
  const th = useT('header')
  const f = useFormat()
  const now = useNow()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const { data: raw, isPending } = useNotifications()
  const { showsType, showsSummary } = useNotificationPrefs()
  const data = raw
    ? {
        ...raw,
        items: raw.items.filter((n) => showsType(n.type)),
        summaries: raw.summaries.filter((x) => showsSummary(x.key)),
      }
    : raw
  const markRead = useLabMutation((ids: string[]) =>
    labApi.notifications.markRead(ids),
  )
  const markSummary = useLabMutation((v: { key: SummaryKey; count: number }) =>
    labApi.notifications.markSummaryRead(v.key, v.count),
  )
  const markAll = useLabMutation(() => labApi.notifications.markAllRead())
  const unread = data
    ? data.items.filter((n) => !n.read).length +
      data.summaries.filter((x) => !x.read).length
    : 0

  const go = (link: string) => {
    setOpen(false)
    void navigate(link)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip content={th('notificationsUnread', { count: unread })}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={th('notificationsUnread', { count: unread })}
            className="focus-ring tap-target relative rounded-lg text-fg-muted hover:bg-surface-2 hover:text-fg [&>svg]:size-[19px]"
          >
            {trigger}
            {unread > 0 ? (
              <span className="absolute top-1.5 right-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-2xs leading-none font-semibold text-on-danger tabular-nums">
                {unread > 9 ? '9+' : unread}
              </span>
            ) : null}
          </button>
        </PopoverTrigger>
      </Tooltip>
      <PopoverContent className="w-[min(26rem,calc(100vw-1.5rem))] overflow-hidden p-0">
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <p className="text-sm font-semibold text-fg">{t('title')}</p>
          <Button
            size="xs"
            variant="ghost"
            onClick={() => markAll.mutate()}
            disabled={unread === 0}
            loading={markAll.isPending}
          >
            <CheckCheckIcon />
            {t('markAllRead')}
          </Button>
        </div>
        <div className="max-h-[min(70dvh,34rem)] scrollbar-thin overflow-y-auto">
          {isPending ? (
            <div className="grid gap-3 p-4">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : !data ||
            (data.summaries.length === 0 && data.items.length === 0) ? (
            <EmptyState
              compact
              icon={<BellOffIcon />}
              title={t('empty')}
              description={t('emptyBody')}
            />
          ) : (
            <>
              {data.summaries.length > 0 ? (
                <div className="border-b border-line p-2">
                  <p className="px-2 pt-1 pb-2 text-2xs font-semibold tracking-wide text-fg-subtle uppercase">
                    {t('needsAttention')}
                  </p>
                  <div className="grid gap-1">
                    {data.summaries.map((s) => (
                      <button
                        key={s.key}
                        type="button"
                        onClick={() => {
                          markSummary.mutate({ key: s.key, count: s.count })
                          go(s.link)
                        }}
                        className={cn(
                          'flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors [&_svg]:size-4',
                          s.severity === 'danger'
                            ? 'bg-danger-soft/70 hover:bg-danger-soft'
                            : 'bg-warning-soft/60 hover:bg-warning-soft',
                        )}
                      >
                        <span
                          className={
                            s.severity === 'danger'
                              ? 'text-danger-text'
                              : 'text-warning-text'
                          }
                        >
                          {SUMMARY_ICON[s.key]}
                        </span>
                        <span className="flex-1 text-meta font-medium text-fg">
                          {t(`summary.${s.key}`, { count: s.count })}
                        </span>
                        {!s.read ? (
                          <span
                            className="size-2 shrink-0 rounded-full bg-accent"
                            aria-label="unread"
                          />
                        ) : null}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="p-2">
                <p className="px-2 pt-1 pb-2 text-2xs font-semibold tracking-wide text-fg-subtle uppercase">
                  {t('recent')}
                </p>
                <ul className="grid gap-0.5">
                  {data.items.slice(0, 25).map((n) => {
                    const spec = TYPE_ICON[n.type]
                    return (
                      <li key={n.id}>
                        <button
                          type="button"
                          onClick={() => {
                            if (!n.read) markRead.mutate([n.id])
                            go(n.link)
                          }}
                          className="flex w-full items-start gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors hover:bg-surface-2"
                        >
                          <IconTile
                            icon={spec.icon}
                            tone={spec.tone}
                            size="sm"
                          />
                          <span className="min-w-0 flex-1">
                            <span
                              className={cn(
                                'block text-meta',
                                n.read
                                  ? 'text-fg-muted'
                                  : 'font-medium text-fg',
                              )}
                            >
                              {t(n.type, n.params)}
                            </span>
                            <span className="mt-0.5 block text-xs text-fg-subtle">
                              {f.relative(n.at, now)} · {f.time(n.at)}
                            </span>
                          </span>
                          {!n.read ? (
                            <span
                              className="mt-1.5 size-2 shrink-0 rounded-full bg-accent"
                              aria-hidden
                            />
                          ) : null}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
