import {
  ArrowDownIcon,
  Undo2Icon,
  ArrowUpIcon,
  BellRingIcon,
  MessageSquareTextIcon,
  CheckIcon,
  CirclePauseIcon,
  BadgeCheckIcon,
  UserIcon,
  TriangleAlertIcon,
  ScanSearchIcon,
} from 'lucide-react'
import { PageHeader } from '@/app/layout/page-header'
import { useDeferredValue, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { usePreferences } from '@/app/preferences/context'
import { useEnum, useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import { cn } from '@/lib/cn'
import { labApi, type ValidationRow } from '@/services/lab-api'
import { useLabMutation } from '@/services/mutations'
import {
  useLabSettings,
  useReference,
  useValidationQueue,
  useValidationStages,
} from '@/services/queries'
import { useSearchParam } from '@/hooks/use-search-param'
import { AgeSex } from '@/components/lab/patient'
import {
  RangeText,
  ResultFlag,
  useResultText,
  valueTone,
} from '@/components/lab/result'
import {
  PriorityBadge,
  PriorityMark,
  ResultStatusBadge,
} from '@/components/lab/status'
import { TatIndicator } from '@/components/lab/tat'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { SearchInput, Textarea } from '@/components/ui/input'
import { Avatar } from '@/components/ui/misc'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { Checkbox, FilterTabs, Segmented } from '@/components/ui/toggles'

type Filter = 'all' | 'critical' | 'abnormal' | 'normal' | 'held'

function RangeBar({
  value,
  low,
  high,
}: {
  value: number
  low: number | null
  high: number | null
}) {
  if (low === null || high === null || high <= low) return null
  const span = high - low
  const min = low - span * 0.6
  const max = high + span * 0.6
  const pos = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100))
  const l = ((low - min) / (max - min)) * 100
  const h = ((high - min) / (max - min)) * 100
  const inside = value >= low && value <= high
  return (
    <span
      className="relative block h-1.5 w-24 rounded-full bg-surface-3"
      aria-hidden
    >
      <span
        className="absolute inset-y-0 rounded-full bg-success/35"
        style={{ left: `${l}%`, width: `${h - l}%` }}
      />
      <span
        className={cn(
          'absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface',
          inside ? 'bg-success' : 'bg-danger',
        )}
        style={{ left: `${pos}%` }}
      />
    </span>
  )
}

type Stage = 'review' | 'authorise'

function Detail({
  row,
  stage,
  signerId,
  signerCanAuthorise,
  independentReview,
}: {
  row: ValidationRow
  stage: Stage
  signerId: string
  /** The signer is a pathologist or microbiologist. */
  signerCanAuthorise: boolean
  /** Lab policy: the analyst may not review their own results. */
  independentReview: boolean
}) {
  const validatorId = signerId
  const t = useT('validation')
  const tc = useT('common')
  const e = useEnum()
  const f = useFormat()
  const text = useResultText()
  const navigate = useNavigate()
  const [dialog, setDialog] = useState<'back' | 'hold' | null>(null)
  const [reason, setReason] = useState('')
  const [comment, setComment] = useState('')
  const [visibility, setVisibility] = useState<'internal' | 'report'>(
    'internal',
  )
  const validate = useLabMutation(
    (ids: string[]) => labApi.validation.validate(ids, validatorId),
    {
      success: (r) => t('validated', { count: r.validated }),
      onSuccess: (r) => {
        for (const rep of r.readyReports)
          toast.success(t('reportReady', { report: rep.reportNo }), {
            action: {
              label: t('openReport'),
              onClick: () => void navigate(`/laboratory/reports/${rep.id}`),
            },
          })
      },
    },
  )
  const review = useLabMutation(
    (ids: string[]) => labApi.validation.review(ids, validatorId),
    { success: (r) => t('reviewedToast', { count: r.reviewed }) },
  )
  const back = useLabMutation(
    () => labApi.validation.sendBack(row.itemId, reason.trim(), validatorId),
    {
      success: () => t('sentBack', { test: row.shortName }),
      onSuccess: () => {
        setDialog(null)
        setReason('')
      },
    },
  )
  const hold = useLabMutation(
    () => labApi.validation.hold(row.itemId, reason.trim(), validatorId),
    {
      success: () => t('heldToast', { test: row.shortName }),
      onSuccess: () => {
        setDialog(null)
        setReason('')
      },
    },
  )
  const addComment = useLabMutation(
    () => labApi.validation.comment(row.itemId, comment, visibility),
    {
      success: () => t('commentAdded'),
      onSuccess: () => setComment(''),
    },
  )
  const openAlert = row.alerts.find(
    (a) => a.status === 'open' || a.status === 'notified',
  )

  return (
    <Card className="flex min-h-0 flex-col overflow-hidden">
      <div className="flex flex-wrap items-center gap-4 border-b border-line px-5 py-4">
        <Avatar name={row.patient.name} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-fg">
            {row.testName}{' '}
            <span className="font-mono text-xs font-normal text-fg-subtle">
              {row.accessionNo}
            </span>
          </p>
          <p className="flex flex-wrap gap-x-2 text-meta text-fg-muted">
            <Link
              to={`/laboratory/patients/${row.patient.id}`}
              className="inline-block py-0.5 font-medium text-fg hover:text-accent-text"
            >
              {row.patient.name}
            </Link>
            <span className="font-mono">{row.patient.uhid}</span>
            <AgeSex dob={row.patient.dob} sex={row.patient.sex} />
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PriorityBadge priority={row.priority} hideRoutine />
          <ResultStatusBadge status={row.status} />
          <TatIndicator tat={row.tat} compact />
        </div>
      </div>
      {openAlert ? (
        <Link
          to={`/laboratory/critical-values?alert=${openAlert.id}`}
          className="flex items-center gap-2 border-b border-danger/25 bg-danger-soft/70 px-5 py-2.5 text-meta font-medium text-danger-text hover:bg-danger-soft"
        >
          <BellRingIcon strokeWidth={2.2} className="size-4" />
          {t('alertOpen')}
          <span className="ml-auto underline underline-offset-2">
            {t('alertLink')}
          </span>
        </Link>
      ) : null}
      {row.status === 'held' && row.heldReason ? (
        <p className="flex items-center gap-2 border-b border-warning/30 bg-warning-soft/60 px-5 py-2.5 text-meta text-warning-text">
          <CirclePauseIcon className="size-4" />
          {t('heldReason', { reason: row.heldReason })}
        </p>
      ) : null}
      {row.sampleOnHold ? (
        <p
          role="status"
          className="flex items-center gap-2 border-b border-warning/30 bg-warning-soft/60 px-5 py-2.5 text-meta text-warning-text"
        >
          <CirclePauseIcon className="size-4" aria-hidden />
          {t('onHoldBanner')}
        </p>
      ) : null}
      {row.enteredById === validatorId ? (
        <p className="flex items-center gap-2 border-b border-warning/30 bg-warning-soft/60 px-5 py-2.5 text-meta text-warning-text">
          <TriangleAlertIcon className="size-4" aria-hidden />
          {stage === 'review' && independentReview
            ? t('independentReview')
            : t('sameUser')}
        </p>
      ) : null}
      <div className="min-h-0 flex-1 scrollbar-thin overflow-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-line bg-surface-2/60 text-left text-xs text-fg-muted">
              <th scope="col" className="py-2.5 pr-3 pl-5 font-medium">
                {t('parameter')}
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">
                {t('result')}
              </th>
              <th scope="col" className="px-3 py-2.5 font-medium">
                {t('range')}
              </th>
              <th scope="col" className="px-3 py-2.5 font-medium" />
              <th scope="col" className="px-3 py-2.5 text-right font-medium">
                {t('previous')}
              </th>
              <th
                scope="col"
                className="py-2.5 pr-5 pl-3 text-right font-medium"
              >
                {t('change')}
              </th>
            </tr>
          </thead>
          <tbody>
            {row.analytes.map((a) => {
              const num = Number(a.value)
              return (
                <tr
                  key={a.resultId}
                  className={cn(
                    'border-b border-line/70',
                    a.critical && 'bg-danger-soft/50',
                  )}
                >
                  <td className="py-2.5 pr-3 pl-5">
                    <span className="font-medium text-fg">{a.name}</span>
                    {a.remarks ? (
                      <span className="block text-xs text-fg-muted">
                        {t('remarks', { text: a.remarks })}
                      </span>
                    ) : null}
                  </td>
                  <td
                    className={cn(
                      'px-3 py-2.5 text-right tabular-nums',
                      valueTone(a.flag, a.critical),
                    )}
                  >
                    {text(a.value, a)}{' '}
                    <span className="text-xs font-normal text-fg-subtle">
                      {a.unit}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs">
                    <div className="flex items-center gap-2">
                      {a.resultType === 'numeric' &&
                      Number.isFinite(num) &&
                      a.range ? (
                        <RangeBar
                          value={num}
                          low={a.range.low}
                          high={a.range.high}
                        />
                      ) : null}
                      <RangeText range={a.range} />
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <ResultFlag
                      flag={a.flag}
                      critical={a.critical}
                      variant="short"
                    />
                  </td>
                  <td className="px-3 py-2.5 text-right text-meta text-fg-muted tabular-nums">
                    {a.previous ? (
                      <>
                        {text(a.previous.value, a)}
                        <span className="block text-2xs text-fg-subtle">
                          {f.dateShort(a.previous.at)}
                        </span>
                      </>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="py-2.5 pr-5 pl-3 text-right">
                    {a.delta ? (
                      <span
                        className={cn(
                          'inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums',
                          a.delta.exceeded
                            ? 'text-danger-text'
                            : 'text-fg-muted',
                        )}
                        title={a.delta.exceeded ? t('deltaFlag') : undefined}
                      >
                        {a.delta.deltaPct >= 0 ? (
                          <ArrowUpIcon className="size-3" strokeWidth={2.5} />
                        ) : (
                          <ArrowDownIcon className="size-3" strokeWidth={2.5} />
                        )}
                        {f.decimal(Math.abs(a.delta.deltaPct))}%
                        {a.delta.exceeded ? (
                          <TriangleAlertIcon className="size-3.5" />
                        ) : null}
                      </span>
                    ) : (
                      <span className="text-xs text-fg-subtle">-</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div className="grid gap-3 px-5 py-4">
          <p className="flex items-center gap-2 text-xs font-semibold text-fg-subtle">
            <MessageSquareTextIcon className="size-4" />
            {t('comments')}
          </p>
          {row.comments.length ? (
            <ul className="grid gap-2">
              {row.comments.map((c) => (
                <li
                  key={c.id}
                  className="rounded-lg bg-surface-2 px-3 py-2 text-meta"
                >
                  <Badge
                    tone={c.visibility === 'report' ? 'accent' : 'neutral'}
                    size="sm"
                    className="mr-2"
                  >
                    {c.visibility === 'report' ? t('onReport') : t('internal')}
                  </Badge>
                  {c.text}
                  <span className="ml-2 text-xs text-fg-subtle">
                    {f.time(c.at)}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="flex flex-wrap items-start gap-2">
            <Textarea
              value={comment}
              onChange={(ev) => setComment(ev.target.value)}
              rows={1}
              placeholder={t('commentPlaceholder')}
              aria-label={t('comment')}
              className="min-h-9 flex-1"
            />
            <Segmented
              size="sm"
              value={visibility}
              onValueChange={setVisibility}
              aria-label={t('comments')}
              options={[
                { value: 'internal', label: t('internal') },
                { value: 'report', label: t('onReport') },
              ]}
            />
            <Button
              size="sm"
              disabled={!comment.trim()}
              loading={addComment.isPending}
              onClick={() => addComment.mutate()}
            >
              {t('addComment')}
            </Button>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-line bg-surface-2/60 px-5 py-3">
        <span className="mr-auto grid gap-0.5 text-xs text-fg-muted">
          {row.enteredBy ? (
            <span className="inline-flex items-center gap-1.5">
              <UserIcon className="size-3.5" aria-hidden />
              {t('enteredBy', { name: row.enteredBy })}
              {row.enteredAt ? ` · ${f.time(row.enteredAt)}` : ''}
            </span>
          ) : null}
          {row.reviewedBy ? (
            <span className="inline-flex items-center gap-1.5">
              <ScanSearchIcon className="size-3.5" aria-hidden />
              {t('reviewedBy', { name: row.reviewedBy })}
              {row.reviewedAt ? ` · ${f.time(row.reviewedAt)}` : ''}
            </span>
          ) : null}
        </span>
        <Button
          variant="ghost"
          className="text-danger-text hover:bg-danger-soft hover:text-danger-text"
          onClick={() => setDialog('back')}
        >
          <Undo2Icon />
          {t('sendBack')}
        </Button>
        {row.status === 'entered' || row.status === 'reviewed' ? (
          <Button disabled={row.sampleOnHold} onClick={() => setDialog('hold')}>
            <CirclePauseIcon />
            {t('hold')}
          </Button>
        ) : null}
        {stage === 'review' && signerCanAuthorise ? (
          <Button
            disabled={row.sampleOnHold}
            loading={validate.isPending}
            onClick={() => validate.mutate([row.itemId])}
          >
            <BadgeCheckIcon />
            {t('reviewAndAuthorise')}
          </Button>
        ) : null}
        {stage === 'review' ? (
          <Button
            variant="primary"
            disabled={row.sampleOnHold}
            loading={review.isPending}
            onClick={() => review.mutate([row.itemId])}
          >
            <ScanSearchIcon />
            {t('markReviewed')}
          </Button>
        ) : (
          <Button
            variant="primary"
            disabled={row.sampleOnHold || !signerCanAuthorise}
            loading={validate.isPending}
            onClick={() => validate.mutate([row.itemId])}
          >
            <BadgeCheckIcon />
            {t('validate')}
          </Button>
        )}
      </div>
      <Dialog
        open={dialog !== null}
        onOpenChange={(o) => !o && setDialog(null)}
        size="sm"
        title={
          dialog === 'back'
            ? t('sendBackTitle', { test: row.shortName })
            : t('holdTitle', { test: row.shortName })
        }
        description={dialog === 'back' ? t('sendBackBody') : t('holdBody')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              {tc('cancel')}
            </Button>
            <Button
              variant={dialog === 'back' ? 'danger' : 'primary'}
              disabled={!reason.trim()}
              loading={back.isPending || hold.isPending}
              onClick={() =>
                dialog === 'back' ? back.mutate() : hold.mutate()
              }
            >
              {dialog === 'back' ? t('sendBack') : t('hold')}
            </Button>
          </>
        }
      >
        <Field label={t('reasonLabel')} required>
          <Textarea
            value={reason}
            onChange={(ev) => setReason(ev.target.value)}
            rows={3}
            placeholder={t('reasonPlaceholder')}
            autoFocus
          />
        </Field>
      </Dialog>
      <span className="sr-only">{e('department', row.department)}</span>
    </Card>
  )
}

const STAGES = ['review', 'authorise'] as const
const FILTERS = ['all', 'critical', 'abnormal', 'normal', 'held'] as const
/** Technical review may be done by lab staff; authorisation by doctors. */
const REVIEWER_ROLES = [
  'technician',
  'lab-manager',
  'pathologist',
  'microbiologist',
]
const VALIDATOR_ROLES = ['pathologist', 'microbiologist']

export function Component() {
  const t = useT('validation')
  const tc = useT('common')
  const e = useEnum()
  const navigate = useNavigate()
  const { department, actorId } = usePreferences()
  const { data: reference } = useReference()
  const { data: settings } = useLabSettings()
  const actorRole = reference?.staff.find((s) => s.id === actorId)?.role
  const [stage, setStage] = useSearchParam<Stage>(
    'stage',
    actorRole && VALIDATOR_ROLES.includes(actorRole) ? 'authorise' : 'review',
    STAGES,
  )
  const [filter, setFilter] = useSearchParam<Filter>('filter', 'all', FILTERS)
  const [itemParam, setItemParam] = useSearchParam<string>('item', '')
  const [query, setQuery] = useState('')
  const q = useDeferredValue(query)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const signers = (reference?.staff ?? []).filter((s) =>
    (stage === 'review' ? REVIEWER_ROLES : VALIDATOR_ROLES).includes(s.role),
  )
  const [signerChoice, setSignerChoice] = useState<string | undefined>()
  const signerId =
    signerChoice && signers.some((s) => s.id === signerChoice)
      ? signerChoice
      : signers.some((s) => s.id === actorId)
        ? actorId
        : (signers[0]?.id ?? '')
  const signerRole = signers.find((s) => s.id === signerId)?.role
  const signerCanAuthorise = Boolean(
    signerRole && VALIDATOR_ROLES.includes(signerRole),
  )
  const stages = useValidationStages(department ? { department } : {})
  const { data, isPending, isError, refetch } = useValidationQueue({
    q,
    stage,
    ...(department ? { department } : {}),
  })

  const rows = (data ?? []).filter((r) =>
    filter === 'critical'
      ? r.criticalCount > 0
      : filter === 'abnormal'
        ? r.abnormalCount > 0
        : filter === 'normal'
          ? r.abnormalCount === 0 && r.criticalCount === 0
          : filter === 'held'
            ? r.status === 'held'
            : true,
  )
  const activeId = itemParam || rows[0]?.itemId
  const active = (data ?? []).find((r) => r.itemId === activeId) ?? rows[0]
  const normals = rows.filter(
    (r) =>
      r.abnormalCount === 0 &&
      r.criticalCount === 0 &&
      r.deltaFlags === 0 &&
      !r.sampleOnHold,
  )

  const bulk = useLabMutation(
    (ids: string[]) =>
      stage === 'review'
        ? labApi.validation.review(ids, signerId).then((r) => ({
            reviewed: r.reviewed,
            validated: 0,
            readyReports: [],
          }))
        : labApi.validation
            .validate(ids, signerId)
            .then((r) => ({ ...r, reviewed: 0 })),
    {
      success: (r) =>
        stage === 'review'
          ? t('reviewedToast', { count: r.reviewed })
          : t('validated', { count: r.validated }),
      onSuccess: (r) => {
        setSelected(new Set())
        for (const rep of r.readyReports.slice(0, 3))
          toast.success(t('reportReady', { report: rep.reportNo }), {
            action: {
              label: t('openReport'),
              onClick: () => void navigate(`/laboratory/reports/${rep.id}`),
            },
          })
      },
    },
  )

  const counts = {
    all: data?.length ?? 0,
    critical: data?.filter((r) => r.criticalCount > 0).length ?? 0,
    abnormal: data?.filter((r) => r.abnormalCount > 0).length ?? 0,
    normal:
      data?.filter((r) => r.abnormalCount === 0 && r.criticalCount === 0)
        .length ?? 0,
    held: data?.filter((r) => r.status === 'held').length ?? 0,
  }
  const changeStage = (next: Stage) => {
    setSelected(new Set())
    setStage(next)
  }

  return (
    <>
      <PageHeader
        title={t('title')}
        meta={
          <span>
            {stage === 'review'
              ? t('stageReviewHint')
              : t('stageAuthoriseHint')}
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <span className="text-meta text-fg-muted">{t('validator')}</span>
            <Select
              size="sm"
              className="w-56"
              value={signerId || undefined}
              onValueChange={setSignerChoice}
              aria-label={t('validator')}
              options={signers.map((v) => ({
                value: v.id,
                label: v.name,
                description: e('staffRole', v.role),
              }))}
            />
          </div>
        }
      />
      <div className="mb-4 border-b border-line">
        <FilterTabs
          value={stage}
          onValueChange={changeStage}
          aria-label={t('title')}
          items={[
            {
              value: 'review',
              label: t('stageReview'),
              count: stages.data?.review,
            },
            {
              value: 'authorise',
              label: t('stageAuthorise'),
              count: stages.data?.authorise,
            },
          ]}
        />
      </div>
      {isError && !data ? (
        <Card>
          <ErrorState onRetry={() => void refetch()} />
        </Card>
      ) : isPending ? (
        <div className="grid gap-5 xl:grid-cols-[24rem_1fr]">
          <Skeleton className="h-[36rem] rounded-xl" />
          <Skeleton className="h-[36rem] rounded-xl" />
        </div>
      ) : counts.all === 0 && !q ? (
        <Card>
          <EmptyState
            icon={<BadgeCheckIcon />}
            title={
              stage === 'review'
                ? t('emptyReviewTitle')
                : t('emptyAuthoriseTitle')
            }
            description={
              stage === 'review'
                ? t('emptyReviewBody')
                : t('emptyAuthoriseBody')
            }
          />
        </Card>
      ) : (
        <div className="grid gap-5 xl:h-[calc(100dvh-13rem)] xl:grid-cols-[25rem_1fr]">
          <Card className="flex min-h-0 flex-col overflow-hidden max-xl:max-h-[55dvh]">
            <div className="border-b border-line p-3">
              <SearchInput
                value={query}
                onValueChange={setQuery}
                placeholder={t('search')}
                aria-label={tc('search')}
              />
            </div>
            <div className="border-b border-line px-2">
              <FilterTabs
                value={filter}
                onValueChange={setFilter}
                items={[
                  { value: 'all', label: t('filterAll'), count: counts.all },
                  {
                    value: 'critical',
                    label: t('filterCritical'),
                    count: counts.critical,
                    tone: 'danger',
                  },
                  {
                    value: 'abnormal',
                    label: t('filterAbnormal'),
                    count: counts.abnormal,
                  },
                  {
                    value: 'normal',
                    label: t('filterNormal'),
                    count: counts.normal,
                  },
                  { value: 'held', label: t('filterHeld'), count: counts.held },
                ]}
              />
            </div>
            <div className="flex items-center gap-2 border-b border-line px-4 py-2">
              <Button
                size="xs"
                variant="ghost"
                disabled={normals.length === 0}
                onClick={() =>
                  setSelected(new Set(normals.map((r) => r.itemId)))
                }
              >
                <CheckIcon />
                {t('selectAllNormal')}
              </Button>
              {selected.size ? (
                <Button
                  size="xs"
                  variant="primary"
                  className="ml-auto"
                  disabled={stage === 'authorise' && !signerCanAuthorise}
                  loading={bulk.isPending}
                  onClick={() => bulk.mutate([...selected])}
                >
                  {stage === 'review' ? <ScanSearchIcon /> : <BadgeCheckIcon />}
                  {stage === 'review'
                    ? t('reviewSelected', { count: selected.size })
                    : t('validateSelected', { count: selected.size })}
                </Button>
              ) : null}
            </div>
            <ul
              className="min-h-0 flex-1 scrollbar-thin overflow-y-auto p-2"
              aria-label={t('title')}
            >
              {rows.map((r) => {
                const isActive = active?.itemId === r.itemId
                return (
                  <li key={r.itemId}>
                    <div
                      className={cn(
                        'mb-1 flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors',
                        isActive
                          ? 'border-accent/50 bg-accent-soft/50'
                          : 'border-transparent hover:bg-surface-2',
                        r.criticalCount > 0 && !isActive && 'bg-danger-soft/40',
                      )}
                    >
                      <Checkbox
                        className="mt-1"
                        checked={selected.has(r.itemId)}
                        label={r.testName}
                        onCheckedChange={(c) =>
                          setSelected((prev) => {
                            const next = new Set(prev)
                            if (c) next.add(r.itemId)
                            else next.delete(r.itemId)
                            return next
                          })
                        }
                      />
                      <button
                        type="button"
                        aria-current={isActive || undefined}
                        className="focus-ring min-w-0 flex-1 rounded-md text-left"
                        onClick={() => setItemParam(r.itemId)}
                      >
                        <span className="flex items-center gap-2">
                          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-fg">
                            {r.patient.name}
                          </span>
                          <TatIndicator
                            tat={r.tat}
                            compact
                            className="w-auto"
                          />
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-fg-muted">
                          {r.shortName} ·{' '}
                          <span className="font-mono">{r.accessionNo}</span>
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-2xs">
                          {r.priority !== 'routine' ? (
                            <PriorityMark priority={r.priority} />
                          ) : null}
                          {r.criticalCount ? (
                            <Badge tone="solidDanger" size="sm">
                              <BellRingIcon strokeWidth={2.2} />
                              {t('critical', { count: r.criticalCount })}
                            </Badge>
                          ) : null}
                          {r.abnormalCount ? (
                            <span className="font-semibold text-warning-text">
                              {t('abnormal', { count: r.abnormalCount })}
                            </span>
                          ) : null}
                          {r.deltaFlags ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-danger-text">
                              <TriangleAlertIcon
                                className="size-3"
                                aria-hidden
                              />
                              {t('deltaFlag')}
                            </span>
                          ) : null}
                          {r.sampleOnHold ? (
                            <span className="inline-flex items-center gap-1 font-medium text-warning-text">
                              <CirclePauseIcon className="size-3" aria-hidden />
                              {e('sampleStatus', 'on_hold')}
                            </span>
                          ) : r.status === 'held' ? (
                            <span className="font-medium text-fg-muted">
                              {e('resultStatus', 'held')}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          </Card>
          {active ? (
            <Detail
              key={active.itemId}
              row={active}
              stage={stage}
              signerId={signerId}
              signerCanAuthorise={signerCanAuthorise}
              independentReview={settings?.requireIndependentReview ?? true}
            />
          ) : (
            <Card>
              <EmptyState icon={<BadgeCheckIcon />} title={t('selectPrompt')} />
            </Card>
          )}
        </div>
      )}
    </>
  )
}
