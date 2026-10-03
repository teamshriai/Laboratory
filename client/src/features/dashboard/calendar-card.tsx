import {
  ArrowRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ScanLineIcon,
} from 'lucide-react'
import {
  useEffect,
  useId,
  useRef,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { Link } from 'react-router'
import { LAB_ROUTINE } from '@/domain/lab-day'
import { DAY, HOUR, MINUTE, istDay } from '@/domain/time'
import { useNow } from '@/hooks/use-now'
import { useSearchParam } from '@/hooks/use-search-param'
import { useLanguage, useT } from '@/i18n/context'
import { INTL_LOCALE } from '@/i18n/core'
import { useFormat } from '@/i18n/format'
import { cn } from '@/lib/cn'
import type { BusyLevel, CalendarDay } from '@/services/lab-api'
import { useCalendar } from '@/services/queries'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/states'
import { Segmented } from '@/components/ui/toggles'

const VIEWS = ['week', 'month'] as const
type View = (typeof VIEWS)[number]

const BUSY_DOTS: Record<BusyLevel, number> = { light: 1, moderate: 2, high: 3 }
const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/

/* IST calendar-day arithmetic on YYYY-MM-DD keys (noon avoids edges). */
const noon = (day: string) => Date.parse(`${day}T12:00:00+05:30`)
const addDays = (day: string, n: number) => istDay(noon(day) + n * DAY)
/** Monday = 0. */
const weekdayOf = (day: string) => (new Date(noon(day)).getUTCDay() + 6) % 7
const startOfWeek = (day: string) => addDays(day, -weekdayOf(day))
const isValidDay = (day: string) =>
  DAY_KEY.test(day) && !Number.isNaN(noon(day)) && istDay(noon(day)) === day

function shiftMonth(day: string, delta: number) {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number]
  const index = y * 12 + (m - 1) + delta
  const year = Math.floor(index / 12)
  const month = (index % 12) + 1
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${year}-${pad(month)}-${pad(Math.min(d, last))}`
}

/** The days on screen: one week, or the six-week grid around a month. */
function visibleDays(view: View, selected: string) {
  const first =
    view === 'week'
      ? startOfWeek(selected)
      : startOfWeek(`${selected.slice(0, 8)}01`)
  return Array.from({ length: view === 'week' ? 7 : 42 }, (_, i) =>
    addDays(first, i),
  )
}

function BusyDots({ level }: { level?: BusyLevel }) {
  return (
    <span className="flex h-1.5 items-center gap-0.5" aria-hidden>
      {level
        ? Array.from({ length: BUSY_DOTS[level] }, (_, i) => (
            <span
              key={i}
              className={cn(
                'size-1 rounded-full',
                level === 'high' ? 'bg-warning' : 'bg-accent',
              )}
            />
          ))
        : null}
    </span>
  )
}

/**
 * The dashboard calendar: a week or a month of the lab's days. Each day shows
 * how busy it was; choosing one shows its figures (recorded history, today
 * live, scheduled imaging ahead). The view and the day live in the URL.
 */
export function CalendarCard({ className }: { className?: string }) {
  const t = useT('today')
  const f = useFormat()
  const { language } = useLanguage()
  const now = useNow()
  const id = useId()
  const today = istDay(now)
  const [view, setView] = useSearchParam<View>('cal', 'week', VIEWS)
  const [rawDay, setDay] = useSearchParam<string>('day', today)
  const selected = isValidDay(rawDay) ? rawDay : today
  const days = visibleDays(view, selected)
  const { data, isPending, isError, refetch } = useCalendar(
    days[0]!,
    days.at(-1)!,
  )
  const byDay = new Map(data?.days.map((d) => [d.day, d]))
  const info = byDay.get(selected)

  const buttons = useRef(new Map<string, HTMLButtonElement>())
  const keyboardMove = useRef(false)
  // Keys step from the newest choice, even before the URL catches up
  // (a held arrow key repeats faster than a render).
  const latest = useRef(selected)
  useEffect(() => {
    latest.current = selected
    if (!keyboardMove.current) return
    keyboardMove.current = false
    buttons.current.get(selected)?.focus()
  }, [selected])

  const locale = INTL_LOCALE[language]
  const fmt = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale, { timeZone: 'Asia/Kolkata', ...options })
  const weekdayShort = fmt({ weekday: 'short' })
  const dayNumber = fmt({ day: 'numeric' })
  const dayMonth = fmt({ day: 'numeric', month: 'short' })
  const monthYear = fmt({ month: 'long', year: 'numeric' })
  const fullDate = fmt({
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const choose = (day: string) => setDay(day === today ? null : day)
  const step = (direction: -1 | 1) =>
    choose(
      view === 'week'
        ? addDays(selected, 7 * direction)
        : shiftMonth(selected, direction),
    )
  const onKeyDown = (ev: KeyboardEvent<HTMLButtonElement>) => {
    const moves: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
      Home: -weekdayOf(latest.current),
      End: 6 - weekdayOf(latest.current),
    }
    const move = moves[ev.key]
    if (move === undefined) return
    ev.preventDefault()
    keyboardMove.current = true
    latest.current = addDays(latest.current, move)
    choose(latest.current)
  }

  const period =
    view === 'week'
      ? t('weekTitle', {
          from: dayMonth.format(noon(days[0]!)),
          to: dayMonth.format(noon(days.at(-1)!)),
        })
      : monthYear.format(noon(selected))
  const shownMonth = selected.slice(0, 7)
  const labelOf = (day: string, d?: CalendarDay) =>
    [
      fullDate.format(noon(day)),
      d?.hasData ? t('daySpecimens', { count: d.samples }) : null,
      d?.busy ? t(`busy.${d.busy}`) : null,
      d?.imaging ? t('cal.imaging', { count: d.imaging }) : null,
    ]
      .filter(Boolean)
      .join(', ')

  return (
    <section
      aria-labelledby={id}
      className={cn(
        '@container flex min-w-0 flex-col rounded-2xl border border-border/70 bg-surface p-3.5 shadow-card sm:p-4',
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h2
          id={id}
          className="min-w-0 truncate text-base font-semibold text-fg"
          aria-live="polite"
        >
          {period}
        </h2>
        <div className="flex items-center gap-1">
          <IconButton
            size="icon-xs"
            label={
              view === 'week' ? t('cal.previousWeek') : t('cal.previousMonth')
            }
            icon={<ChevronLeftIcon className="size-4" />}
            onClick={() => step(-1)}
          />
          <Button
            size="xs"
            variant="ghost"
            disabled={selected === today}
            onClick={() => choose(today)}
          >
            {t('weekToday')}
          </Button>
          <IconButton
            size="icon-xs"
            label={view === 'week' ? t('cal.nextWeek') : t('cal.nextMonth')}
            icon={<ChevronRightIcon className="size-4" />}
            onClick={() => step(1)}
          />
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-fg-subtle">{t('weekCaption')}</p>
        <Segmented
          size="sm"
          aria-label={t('cal.view')}
          value={view}
          onValueChange={setView}
          options={[
            { value: 'week', label: t('cal.week') },
            { value: 'month', label: t('cal.month') },
          ]}
        />
      </div>

      {isError && !data ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : (
        <div
          role="group"
          aria-label={t('cal.grid', { period })}
          aria-busy={isPending || undefined}
          className="mt-3 grid grid-cols-7 gap-y-1 text-center"
        >
          {days.slice(0, 7).map((day) => (
            <span
              key={`h-${day}`}
              aria-hidden
              className="pb-1 text-2xs font-medium text-fg-subtle"
            >
              {weekdayShort.format(noon(day))}
            </span>
          ))}
          {days.map((day) => {
            const d = byDay.get(day)
            const isSelected = day === selected
            const isToday = day === today
            const outside = view === 'month' && !day.startsWith(shownMonth)
            return (
              <span key={day} className="grid justify-items-center gap-0.5">
                <button
                  ref={(el) => {
                    if (el) buttons.current.set(day, el)
                    else buttons.current.delete(day)
                  }}
                  type="button"
                  tabIndex={isSelected ? 0 : -1}
                  aria-pressed={isSelected}
                  aria-current={isToday ? 'date' : undefined}
                  aria-label={labelOf(day, d)}
                  onClick={() => choose(day)}
                  onKeyDown={onKeyDown}
                  className={cn(
                    'focus-ring flex items-center justify-center rounded-full text-meta font-semibold tabular-nums transition-colors pointer-coarse:size-11',
                    view === 'week' ? 'size-9' : 'size-8',
                    isSelected
                      ? 'bg-accent text-on-accent'
                      : isToday
                        ? 'bg-accent-soft text-accent-text ring-2 ring-accent'
                        : outside || d?.state === 'future'
                          ? 'text-fg-subtle hover:bg-surface-2'
                          : 'text-fg hover:bg-surface-2',
                  )}
                >
                  {dayNumber.format(noon(day))}
                </button>
                <BusyDots level={d?.busy} />
              </span>
            )
          })}
        </div>
      )}

      <p
        className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-2xs text-fg-subtle"
        aria-hidden
      >
        {(['light', 'moderate', 'high'] as const).map((b) => (
          <span key={b} className="inline-flex items-center gap-1">
            <BusyDots level={b} />
            {t(`busy.${b}`)}
          </span>
        ))}
      </p>

      <div
        className="mt-3 border-t border-line pt-3"
        aria-live="polite"
        aria-atomic="true"
      >
        <div className="flex items-center gap-3">
          <span className="flex size-11 shrink-0 flex-col items-center justify-center rounded-xl bg-accent-soft text-accent-text">
            <span className="text-base leading-none font-bold tabular-nums">
              {dayNumber.format(noon(selected))}
            </span>
            <span className="mt-0.5 text-2xs font-semibold uppercase">
              {weekdayShort.format(noon(selected))}
            </span>
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-fg">
              {fullDate.format(noon(selected))}
            </p>
            <p className="text-xs text-fg-subtle">
              {selected === today
                ? t('weekToday')
                : info?.state === 'future'
                  ? t('cal.upcoming')
                  : t('cal.selected')}
              {info?.busy ? ` · ${t(`busy.${info.busy}`)}` : null}
            </p>
          </div>
        </div>

        {isPending && !info ? (
          <Skeleton className="mt-3 h-14 rounded-lg" />
        ) : info?.hasData ? (
          <>
            <p className="mt-3 flex flex-wrap gap-1.5 text-xs">
              <Chip>{t('daySpecimens', { count: info.samples })}</Chip>
              <Chip>{t('dayTests', { count: info.tests })}</Chip>
              <Chip>{t('cal.completed', { count: info.completed })}</Chip>
              {info.rejected ? (
                <Chip>{t('cal.rejected', { count: info.rejected })}</Chip>
              ) : null}
              {info.criticals ? (
                <Chip tone="danger">
                  {t('criticalCount', { count: info.criticals })}
                </Chip>
              ) : null}
              {info.tatAvgMin ? (
                <Chip>
                  {t('cal.tat', {
                    duration: f.duration(info.tatAvgMin * MINUTE),
                  })}
                </Chip>
              ) : null}
            </p>
            <Link
              to={`/analytics?range=custom&from=${selected}&to=${selected}`}
              className="mt-2 inline-flex min-h-[24px] items-center gap-1 text-xs font-semibold text-accent-text hover:underline"
            >
              {t('cal.openAnalytics')}
              <ArrowRightIcon className="size-3.5" aria-hidden />
            </Link>
          </>
        ) : info?.state === 'future' ? (
          <div className="mt-3">
            <p className="text-2xs font-semibold tracking-wide text-fg-muted uppercase">
              {t('cal.routine')}
            </p>
            <ul className="mt-1 grid grid-cols-1 gap-x-3 gap-y-0.5 text-xs text-fg-muted @sm:grid-cols-2">
              {LAB_ROUTINE.map((slot) => (
                <li key={slot.key} className="flex gap-2">
                  <span className="w-14 shrink-0 font-medium text-fg tabular-nums">
                    {f.time(
                      Date.parse(`${selected}T00:00:00+05:30`) +
                        slot.hour * HOUR +
                        slot.minute * MINUTE,
                    )}
                  </span>
                  <span className="truncate">{t(`routine.${slot.key}`)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mt-3 text-xs text-fg-muted">{t('cal.noRecords')}</p>
        )}

        {info?.imaging ? (
          <Link
            to="/imaging"
            className="mt-2 flex min-h-[24px] items-center gap-1.5 text-xs font-medium text-fg hover:text-accent-text hover:underline"
          >
            <ScanLineIcon className="size-3.5 text-fg-subtle" aria-hidden />
            {t('cal.imaging', { count: info.imaging })}
            <span className="sr-only"> - {t('cal.openImaging')}</span>
          </Link>
        ) : null}
      </div>
    </section>
  )
}

function Chip({ children, tone }: { children: ReactNode; tone?: 'danger' }) {
  return (
    <span
      className={cn(
        'rounded-md px-2 py-0.5',
        tone === 'danger'
          ? 'bg-danger-soft text-danger-text'
          : 'bg-surface-2 text-fg-muted',
      )}
    >
      {children}
    </span>
  )
}
