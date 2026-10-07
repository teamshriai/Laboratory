import {
  CalendarRangeIcon,
  CheckIcon,
  ChevronDownIcon,
  CircleCheckIcon,
  LightbulbIcon,
  ScrollTextIcon,
  SignalHighIcon,
  SignalLowIcon,
  SignalMediumIcon,
  ThumbsDownIcon,
  XIcon,
} from 'lucide-react'
import { useId, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { isSameIstDay } from '@/domain/time'
import { useT } from '@/i18n/context'
import type { TKey } from '@/i18n/core'
import { useFormat } from '@/i18n/format'
import { cn } from '@/lib/cn'
import type { InsightFeedbackKind } from '@/domain/types'
import { labApi, type Insight, type InsightKind } from '@/services/lab-api'
import { useLabMutation } from '@/services/mutations'
import { useInsights } from '@/services/queries'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { IconGlyph } from '@/components/ui/icon-tile'
import { Textarea } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/states'
import { GuardedButton } from './guarded-button'

type InsightKey = TKey<'insights'>

const CONFIDENCE_ICON: Record<Insight['confidence'], ReactNode> = {
  low: <SignalLowIcon className="size-3.5" aria-hidden />,
  medium: <SignalMediumIcon className="size-3.5" aria-hidden />,
  high: <SignalHighIcon className="size-3.5" aria-hidden />,
}

const WHY_KEYS: Record<string, InsightKey> = {
  'rejected-count': 'why.rejected-count',
  'collected-count': 'why.collected-count',
  'qc-runs': 'why.qc-runs',
  'peak-share': 'why.peak-share',
  'delayed-share': 'why.delayed-share',
  readings: 'why.readings',
}

const SOURCE_KEYS: Record<string, InsightKey> = {
  reception: 'source.reception',
  'quality-control': 'source.quality-control',
  tat: 'source.tat',
  'cold-storage': 'source.cold-storage',
}

const pad = (n: number) => String(n).padStart(2, '0')

/** Words for an insight: its statement, evidence and data window. */
function useInsightText() {
  const t = useT('insights')
  const f = useFormat()
  return {
    statement(i: Insight) {
      switch (i.kind) {
        case 'qc-shift':
          return t(
            i.params.direction === 'low'
              ? 'statement.qc-shift-low'
              : 'statement.qc-shift-high',
            i.params,
          )
        case 'cold-excursion':
          return t('statement.cold-excursion', i.params)
        case 'rejection-rise':
          return t('statement.rejection-rise', i.params)
        case 'tat-cluster':
          return t('statement.tat-cluster', i.params)
      }
    },
    why(w: Insight['why'][number]) {
      const key = WHY_KEYS[w.kind]
      if (!key) return t('why.other')
      const params =
        w.kind === 'readings' && typeof w.params.at === 'number'
          ? { ...w.params, at: `${pad(w.params.at)}:00` }
          : w.params
      return t(key, params)
    },
    window(i: Insight) {
      const { from, to } = i.window
      return isSameIstDay(from, to)
        ? t('window', { from: f.dateTime(from), to: f.time(to) })
        : t('window', { from: f.dateShort(from), to: f.dateShort(to) })
    },
    source(label: string) {
      const key = SOURCE_KEYS[label]
      return key ? t(key) : label
    },
  }
}

/**
 * The rule-based suggestions for the acting user, optionally only some
 * kinds. Renders nothing while there are none, unless `showEmpty`.
 */
export function InsightList({
  kinds,
  showEmpty,
  className,
}: {
  kinds?: readonly InsightKind[]
  showEmpty?: boolean
  className?: string
}) {
  const t = useT('insights')
  const tc = useT('common')
  const id = useId()
  const heading = useRef<HTMLHeadingElement>(null)
  const { data, isPending, isError, refetch } = useInsights()
  const items = (data ?? []).filter((i) => !kinds || kinds.includes(i.kind))
  const frame = cn(
    '@container min-w-0 rounded-xl border border-border bg-surface p-3.5 shadow-card sm:p-4',
    className,
  )

  if (isPending)
    return showEmpty ? (
      <div className={frame} aria-busy>
        <Skeleton className="mb-3 h-5 w-40 rounded-md" />
        <Skeleton className="h-28 rounded-xl" />
      </div>
    ) : null
  if (isError && !data)
    return (
      <div
        role="alert"
        className={cn(frame, 'flex flex-wrap items-center gap-x-3 gap-y-1')}
      >
        <p className="min-w-0 flex-1 text-meta text-fg-muted">
          {t('loadError')}
        </p>
        <Button size="sm" variant="ghost" onClick={() => void refetch()}>
          {tc('retry')}
        </Button>
      </div>
    )
  if (items.length === 0 && !showEmpty) return null

  return (
    <section aria-labelledby={id} className={frame}>
      <div className="mb-3 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <h2
          id={id}
          ref={heading}
          tabIndex={-1}
          className="flex items-center gap-2 text-base font-semibold text-fg outline-none"
        >
          <IconGlyph icon={<LightbulbIcon />} tone="amber" size={18} />
          {t('title')}
          {items.length ? (
            <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-xs font-semibold text-fg-muted tabular-nums">
              {items.length}
            </span>
          ) : null}
        </h2>
        <p className="text-xs text-fg-subtle">{t('subtitle')}</p>
      </div>
      {items.length === 0 ? (
        <EmptyState
          compact
          icon={<CircleCheckIcon />}
          tone="green"
          title={t('emptyTitle')}
          description={t('emptyBody')}
        />
      ) : (
        <ul className="grid gap-3 @3xl:grid-cols-2 @7xl:grid-cols-3">
          {items.map((i) => (
            <li key={i.key} className="min-w-0">
              <InsightCard
                insight={i}
                onResolved={() => heading.current?.focus()}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/**
 * One suggestion with its evidence (what it says, how sure the rule is,
 * why, over which window, from which records, by which rule version) and
 * the feedback a person gives. Never a diagnosis: a person decides.
 */
export function InsightCard({
  insight,
  onResolved,
  className,
}: {
  insight: Insight
  /** Called after Dismiss or Not useful, when the card leaves the list. */
  onResolved?: () => void
  className?: string
}) {
  const t = useT('insights')
  const tc = useT('common')
  const text = useInsightText()
  const id = useId()
  const [asking, setAsking] = useState(false)
  const [reason, setReason] = useState('')
  const [touched, setTouched] = useState(false)
  const closeDialog = () => {
    setAsking(false)
    setReason('')
    setTouched(false)
  }
  const feedback = useLabMutation(
    (v: { kind: InsightFeedbackKind; reason?: string }) =>
      labApi.insights.feedback(insight.key, v.kind, v.reason),
    {
      success: (_, v) =>
        v.kind === 'accepted'
          ? t('acceptedToast')
          : v.kind === 'dismissed'
            ? t('dismissedToast')
            : t('notUsefulToast'),
      onSuccess: (_, v) => {
        if (v.kind === 'not-useful') closeDialog()
        if (v.kind !== 'accepted') onResolved?.()
      },
    },
  )
  const pending = feedback.isPending ? feedback.variables?.kind : null
  const accepted = insight.feedback === 'accepted'

  return (
    <article
      aria-labelledby={id}
      className={cn(
        'flex h-full flex-col rounded-xl border border-line bg-surface p-3',
        className,
      )}
    >
      <p className="flex items-center gap-1.5 text-2xs font-semibold text-fg-muted">
        <IconGlyph icon={<LightbulbIcon />} tone="amber" size={14} />
        {t('label')}
      </p>
      <p id={id} className="mt-1 text-sm leading-snug font-medium text-fg">
        {text.statement(insight)}
      </p>
      <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-2xs text-fg-muted">
        <span className="inline-flex items-center gap-1">
          {CONFIDENCE_ICON[insight.confidence]}
          {t(`confidence.${insight.confidence}`)}
        </span>
        <span className="inline-flex items-center gap-1">
          <CalendarRangeIcon className="size-3.5" aria-hidden />
          {text.window(insight)}
        </span>
        <span className="inline-flex items-center gap-1">
          <ScrollTextIcon className="size-3.5" aria-hidden />
          {t('rule', { version: insight.ruleVersion })}
        </span>
      </p>
      <details className="group/why mt-2">
        <summary className="tap-reach inline-flex cursor-pointer list-none items-center gap-1 rounded-lg py-0.5 text-xs font-semibold text-accent-text hover:underline [&::-webkit-details-marker]:hidden">
          <ChevronDownIcon
            className="size-3.5 transition-transform group-open/why:rotate-180"
            aria-hidden
          />
          {t('why')}
        </summary>
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-fg-muted">
          {insight.why.map((w, n) => (
            <li key={n}>{text.why(w)}</li>
          ))}
        </ul>
      </details>
      {insight.sources.length ? (
        <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
          <span className="text-fg-subtle">{t('sources')}</span>
          {insight.sources.map((s) => (
            <Link
              key={s.link}
              to={s.link}
              className="inline-flex min-h-6 items-center py-0.5 font-semibold text-accent-text underline-offset-2 hover:underline"
            >
              {text.source(s.label)}
            </Link>
          ))}
        </p>
      ) : null}
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
        {accepted ? (
          <span className="inline-flex min-h-11 items-center gap-1.5 pr-1 text-xs font-semibold text-success-text">
            <CircleCheckIcon className="size-4" aria-hidden />
            {t('accepted')}
          </span>
        ) : (
          <GuardedButton
            permission="insight.feedback"
            size="sm"
            variant="soft"
            loading={pending === 'accepted'}
            disabled={feedback.isPending}
            onClick={() => feedback.mutate({ kind: 'accepted' })}
          >
            <CheckIcon />
            {t('accept')}
          </GuardedButton>
        )}
        <GuardedButton
          permission="insight.feedback"
          size="sm"
          variant="secondary"
          loading={pending === 'dismissed'}
          disabled={feedback.isPending}
          onClick={() => feedback.mutate({ kind: 'dismissed' })}
        >
          <XIcon />
          {t('dismiss')}
        </GuardedButton>
        <GuardedButton
          permission="insight.feedback"
          size="sm"
          variant="ghost"
          disabled={feedback.isPending}
          onClick={() => setAsking(true)}
        >
          <ThumbsDownIcon />
          {t('notUseful')}
        </GuardedButton>
      </div>
      <Dialog
        open={asking}
        onOpenChange={(o) => (o ? setAsking(true) : closeDialog())}
        size="sm"
        title={t('notUsefulTitle')}
        description={t('notUsefulBody')}
        footer={
          <>
            <Button variant="ghost" onClick={closeDialog}>
              {tc('cancel')}
            </Button>
            <Button
              variant="primary"
              loading={pending === 'not-useful'}
              onClick={() => {
                setTouched(true)
                if (!reason.trim()) return
                feedback.mutate({ kind: 'not-useful', reason: reason.trim() })
              }}
            >
              {t('notUseful')}
            </Button>
          </>
        }
      >
        <p className="mb-3 rounded-lg bg-surface-2 px-3 py-2 text-meta text-fg">
          {text.statement(insight)}
        </p>
        <Field
          label={t('reasonLabel')}
          required
          error={touched && !reason.trim() ? 'forms.required' : undefined}
        >
          <Textarea
            value={reason}
            onChange={(ev) => setReason(ev.target.value)}
            rows={3}
            placeholder={t('reasonPlaceholder')}
            autoFocus
          />
        </Field>
      </Dialog>
    </article>
  )
}
