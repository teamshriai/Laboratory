import {
  Building2Icon,
  ChevronDownIcon,
  Undo2Icon,
  MessageSquarePlusIcon,
  MessageSquareTextIcon,
  PrinterIcon,
  CheckIcon,
  SaveIcon,
  KeyboardIcon,
  PencilLineIcon,
  TriangleAlertIcon,
  OctagonAlertIcon,
  RotateCcwIcon,
} from 'lucide-react'
import { Fragment, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes'
import { useAssistantClearance } from '@/hooks/use-assistant-clearance'
import { UnsavedChangesDialog } from '@/components/ui/unsaved-dialog'
import { FRIEDEWALD_TG_LIMIT } from '@/domain/calculated'
import { deltaCheck, isAbnormal } from '@/domain/flags'
import type { Analyte } from '@/domain/types'
import { useEnum, useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import { PatientBanner } from '@/components/lab/patient-banner'
import { RecordLink } from '@/components/lab/record-link'
import { RerunDialog } from '@/components/lab/rerun-dialog'
import { cn } from '@/lib/cn'
import {
  isLabApiError,
  labApi,
  type EntryItem,
  type ResultEntryView,
} from '@/services/lab-api'
import { useLabMutation } from '@/services/mutations'
import { useLabSettings, useResultEntry } from '@/services/queries'
import { useSearchParam } from '@/hooks/use-search-param'
import { PageHeader } from '@/app/layout/page-header'
import {
  RangeText,
  ResultFlag,
  useResultText,
  valueTone,
} from '@/components/lab/result'
import { ContainerChip } from '@/components/lab/sample'
import { PriorityBadge, ResultStatusBadge } from '@/components/lab/status'
import { TatIndicator } from '@/components/lab/tat'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { GuardedButton } from '@/components/lab/guarded-button'
import { Card } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { IconButton } from '@/components/ui/icon-button'
import { Input, Textarea } from '@/components/ui/input'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu'
import { Segmented } from '@/components/ui/toggles'
import { CardSkeleton, Skeleton } from '@/components/ui/skeleton'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { FormErrorSummary } from '@/components/ui/form-errors'
import { focusFirstInvalid } from '@/lib/focus'
import { AnalyteInput } from './analyte-input'
import { DIFFERENTIAL } from './differential'
import { DifferentialCounter } from './differential-counter'
import { focusWhenScrollable } from '@/lib/scroll-focus'
import {
  calculatedInputs,
  liveItem,
  liveRows,
  useAccreditation,
  type Values,
} from './entry-values'
import { CalculatedTag, InstrumentFlagChips } from './result-marks'
import { ReportPreview } from './report-preview'
import {
  CriticalAtEntryDialog,
  type EntryCritical,
} from './critical-entry-dialog'

const VIEWS = ['entry', 'preview'] as const

const EDITABLE = ['pending', 'draft', 'returned', 'entered']

function initialValues(view: ResultEntryView): Values {
  const out: Values = {}
  for (const item of view.items) {
    out[item.itemId] = {}
    for (const a of item.analytes)
      out[item.itemId]![a.analyte.id] = {
        value: a.result?.value ?? '',
        remarks: a.result?.remarks ?? '',
      }
  }
  return out
}

/** Who the results are for, and the specimen they come from. */
function SpecimenBanner({ view }: { view: ResultEntryView }) {
  const t = useT('results')
  const tc = useT('common')
  const e = useEnum()
  const f = useFormat()
  const s = view.sample
  return (
    <>
      <PatientBanner
        patient={s.patient}
        location={`${e('encounter', s.encounter)}${
          s.ward
            ? ` · ${s.bed ? tc('wardBed', { ward: s.ward, bed: s.bed }) : s.ward}`
            : ''
        } · ${s.doctorName}`}
        extra={
          <>
            <span className="flex items-baseline gap-1.5">
              <span className="text-fg-muted">{tc('sampleId')}</span>
              <RecordLink
                kind="specimen"
                id={s.id}
                className="font-semibold text-fg"
              >
                {s.accessionNo}
              </RecordLink>
            </span>
            <ContainerChip container={s.container} />
            <PriorityBadge priority={s.priority} hideRoutine />
            <span className="flex items-center gap-1.5">
              {s.receivedAt ? (
                <span className="text-fg-muted">
                  {t('received', { time: f.time(s.receivedAt) })}
                </span>
              ) : null}
              <TatIndicator tat={s.tat} compact />
            </span>
          </>
        }
      />
      {view.clinicalNotes ? (
        <Card className="mb-5 px-5 py-3 text-meta">
          <span className="font-medium text-fg-muted">
            {t('clinicalNotes')}:{' '}
          </span>
          <span className="text-fg">{view.clinicalNotes}</span>
        </Card>
      ) : null}
    </>
  )
}

/** The per-test report comment, with the lab's ready-made comments. */
function TestComment({
  item,
  comment,
  onComment,
}: {
  item: EntryItem
  comment: string
  onComment: (text: string) => void
}) {
  const t = useT('results')
  const tc = useT('common')
  // The last ready-made comment inserted: undo restores what was there
  // before, for as long as the box still holds the inserted text.
  const [inserted, setInserted] = useState<{
    before: string
    after: string
  } | null>(null)
  const undo = inserted && inserted.after === comment ? inserted : null
  const insert = (text: string) => {
    const after = comment.trim() ? `${comment.trim()}\n${text}` : text
    setInserted({ before: comment, after })
    onComment(after)
  }
  const id = `c-${item.itemId}`
  return (
    <div className="border-t border-line px-5 py-3">
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <label htmlFor={id} className="text-sm font-medium text-fg-muted">
          {t('testComment')}{' '}
          <span className="text-xs font-normal text-fg-subtle">
            ({tc('optional')})
          </span>
        </label>
        {item.commentTemplates.length ? (
          <Menu>
            <MenuTrigger asChild>
              <Button size="sm" variant="ghost">
                <MessageSquarePlusIcon />
                {t('insertComment')}
                <ChevronDownIcon />
              </Button>
            </MenuTrigger>
            <MenuContent
              align="end"
              className="max-w-[min(26rem,calc(100vw-2rem))]"
            >
              {item.commentTemplates.map((tpl) => (
                <MenuItem key={tpl} onSelect={() => insert(tpl)}>
                  {tpl}
                </MenuItem>
              ))}
            </MenuContent>
          </Menu>
        ) : null}
      </div>
      <Textarea
        id={id}
        value={comment}
        onChange={(ev) => onComment(ev.target.value)}
        rows={2}
        placeholder={t('testCommentPlaceholder')}
      />
      <div
        role="status"
        className="mt-1.5 flex min-h-6 flex-wrap items-center gap-x-2 text-xs text-fg-subtle"
      >
        {undo ? (
          <>
            <span>{t('commentInserted')}</span>
            <button
              type="button"
              onClick={() => {
                onComment(undo.before)
                setInserted(null)
              }}
              className="tap-reach inline-flex items-center gap-1 rounded-md py-0.5 font-medium text-accent-text hover:underline"
            >
              <Undo2Icon className="size-3.5" aria-hidden />
              {t('undoInsert')}
            </button>
          </>
        ) : comment.trim() ? (
          <span>{t('commentSavedHint')}</span>
        ) : null}
      </div>
    </div>
  )
}

/** A value the system computes from the measured ones: shown, never typed. */
function CalculatedOutput({
  id,
  value,
  tone,
}: {
  id: string
  value: string | null
  tone: string
}) {
  return (
    <output
      id={id}
      aria-live="polite"
      className={cn(
        'flex min-h-9 w-full items-center justify-end rounded-lg border border-dashed border-line-strong bg-surface-2 px-3 text-sm font-medium tabular-nums',
        value ? tone : 'text-fg-subtle',
      )}
    >
      {value ?? '-'}
    </output>
  )
}

function TestCard({
  item,
  values,
  analytes,
  onChange,
  showMissing,
  comment,
  onComment,
  onRerun,
}: {
  item: EntryItem
  values: Values[string]
  analytes: Record<string, Analyte>
  onChange: (
    analyteId: string,
    patch: Partial<{ value: string; remarks: string }>,
  ) => void
  /** After a failed submit: mark required fields that are still empty. */
  showMissing: boolean
  comment: string
  onComment: (text: string) => void
  onRerun: () => void
}) {
  const t = useT('results')
  const tc = useT('common')
  const f = useFormat()
  const text = useResultText()
  const accreditation = useAccreditation()
  const [remarkOpen, setRemarkOpen] = useState<Record<string, boolean>>({})
  const editable = EDITABLE.includes(item.status)
  const rows = liveRows(item, liveItem(item, values), analytes)
  // The latest repeat analysis, if any: its reason and the first-run values.
  const reruns = item.analytes.flatMap((a) => {
    const rev = a.result?.revisions.findLast((r) => r.rerun)
    return rev ? [{ analyte: a.analyte, rev }] : []
  })
  const rerunReason = reruns.at(-1)?.rev.reason
  const dilution = item.analytes.find((a) => a.result?.dilution)?.result
    ?.dilution
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-fg">
            {item.testName}{' '}
            <span className="ml-1 font-mono text-xs font-normal text-fg-subtle">
              {item.code}
            </span>
          </h2>
          {item.method ? (
            <p className="text-xs text-fg-muted">
              {t('method', { method: item.method })}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {item.enteredBy && item.enteredAt ? (
            <span className="text-xs text-fg-subtle">
              {t('enteredBy', {
                name: item.enteredBy,
                time: f.time(item.enteredAt),
              })}
            </span>
          ) : null}
          <ResultStatusBadge status={item.status} />
          {item.status === 'entered' || item.status === 'returned' ? (
            <GuardedButton
              permission="result.rerun"
              size="xs"
              variant="ghost"
              onClick={onRerun}
            >
              <RotateCcwIcon />
              {t('rerun')}
            </GuardedButton>
          ) : null}
        </div>
      </div>
      {item.performedBy ? (
        <div className="flex items-start gap-2 border-b border-info/20 bg-info-soft/60 px-5 py-2.5 text-meta text-info-text">
          <Building2Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            {t('performedBy', {
              lab: item.performedBy.name,
              accreditation: accreditation(item.performedBy),
            })}
          </span>
        </div>
      ) : null}
      {rerunReason ? (
        <div className="flex items-start gap-2 border-b border-info/20 bg-info-soft/60 px-5 py-2.5 text-meta text-info-text">
          <RotateCcwIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            {t('rerunBanner', { reason: rerunReason })}
            {dilution ? ` ${t('dilutionOf', { n: dilution })}` : ''}
          </span>
        </div>
      ) : null}
      {item.status === 'returned' && item.returnedReason ? (
        <div className="flex items-start gap-2 border-b border-danger/20 bg-danger-soft/60 px-5 py-2.5 text-meta text-danger-text">
          <Undo2Icon className="mt-0.5 size-4 shrink-0" />
          {t('returnedBanner', { reason: item.returnedReason })}
        </div>
      ) : null}
      {!editable ? (
        <p className="border-b border-line px-5 py-2.5 text-meta text-fg-muted">
          {t('notEditable')}
        </p>
      ) : null}
      <div
        ref={focusWhenScrollable}
        className="focus-ring relative scrollbar-thin overflow-x-auto"
      >
        <table className="w-full min-w-[680px] text-sm">
          <thead>
            <tr className="text-left text-xs text-fg-muted">
              <th scope="col" className="w-[26%] py-2.5 pr-3 pl-5 font-medium">
                {t('colParameter')}
              </th>
              <th scope="col" className="w-[24%] px-3 py-2.5 font-medium">
                {t('colResult')}
              </th>
              <th scope="col" className="px-3 py-2.5 font-medium">
                {t('colUnit')}
              </th>
              <th scope="col" className="px-3 py-2.5 font-medium">
                {t('colRange')}
              </th>
              <th scope="col" className="px-3 py-2.5 font-medium">
                {t('colFlag')}
              </th>
              <th scope="col" className="py-2.5 pr-5 pl-3 font-medium">
                {t('colPrevious')}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(
              ({
                analyte,
                range,
                value,
                flag,
                critical,
                required,
                calculated,
              }) => {
                const entry = item.analytes.find(
                  (a) => a.analyte.id === analyte.id,
                )
                const previous = entry?.previous ?? null
                const v = values[analyte.id] ?? { value: '', remarks: '' }
                if (!required && !value) {
                  if (analyte.dependsOn) return null
                }
                const delta =
                  analyte.resultType === 'numeric'
                    ? deltaCheck(value, previous?.value, analyte.deltaPct)
                    : null
                const wide =
                  analyte.resultType === 'narrative' ||
                  analyte.resultType === 'antibiogram'
                const fieldId = `f-${item.itemId}-${analyte.id}`
                const rerun = reruns.find((r) => r.analyte.id === analyte.id)
                return (
                  <Fragment key={analyte.id}>
                    <tr
                      className={cn(
                        'border-t border-line/70 align-top',
                        critical && 'bg-danger-soft/50',
                        !critical && isAbnormal(flag) && 'bg-warning-soft/35',
                      )}
                    >
                      <td className="py-2.5 pr-3 pl-5">
                        <label
                          htmlFor={fieldId}
                          className="block font-medium text-fg"
                        >
                          {analyte.name}
                        </label>
                        {calculated ? (
                          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                            <CalculatedTag />
                            {calculatedInputs(item, analyte.id).length ? (
                              <span className="text-xs text-fg-subtle">
                                {t('calculatedFrom', {
                                  inputs: calculatedInputs(
                                    item,
                                    analyte.id,
                                  ).join(', '),
                                })}
                              </span>
                            ) : null}
                          </span>
                        ) : null}
                        {calculated?.value === null &&
                        calculated.reason === 'tg-above-limit' ? (
                          <p className="mt-1 flex items-start gap-1 text-xs font-medium text-warning-text">
                            <TriangleAlertIcon
                              className="mt-px size-3.5 shrink-0"
                              aria-hidden
                            />
                            {t('ldlNotCalculated', {
                              limit: FRIEDEWALD_TG_LIMIT,
                            })}
                          </p>
                        ) : null}
                        {rerun ? (
                          <p className="mt-1 text-xs text-fg-muted tabular-nums">
                            {t('firstRun', {
                              value: text(rerun.rev.value, analyte),
                            })}
                          </p>
                        ) : null}
                        {critical ? (
                          <p className="mt-1 flex items-start gap-1 text-xs font-medium text-danger-text">
                            <OctagonAlertIcon
                              strokeWidth={2.2}
                              className="mt-px size-3.5 shrink-0"
                            />
                            {t('criticalWarning')}
                          </p>
                        ) : delta?.exceeded ? (
                          <p className="mt-1 flex items-center gap-1 text-xs font-medium text-warning-text">
                            <TriangleAlertIcon className="size-3.5 shrink-0" />
                            {t('deltaWarning', {
                              delta: `${delta.deltaPct > 0 ? '+' : ''}${f.decimal(delta.deltaPct)}%`,
                            })}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-3 py-2" colSpan={wide ? 4 : 1}>
                        {calculated ? (
                          <CalculatedOutput
                            id={fieldId}
                            value={calculated.value}
                            tone={valueTone(flag, critical)}
                          />
                        ) : (
                          <AnalyteInput
                            id={fieldId}
                            analyte={analyte}
                            value={v.value}
                            onChange={(next) =>
                              onChange(analyte.id, { value: next })
                            }
                            disabled={!editable}
                            invalid={
                              critical ||
                              (showMissing &&
                                editable &&
                                required &&
                                !v.value.trim())
                            }
                            tone={valueTone(flag, critical)}
                          />
                        )}
                        <InstrumentFlagChips
                          flags={entry?.result?.instrumentFlags}
                          className="mt-1.5"
                        />
                      </td>
                      {wide ? null : (
                        <>
                          <td className="px-3 py-2.5 text-meta text-fg-muted">
                            {analyte.unit}
                          </td>
                          <td className="px-3 py-2.5 text-meta">
                            <RangeText range={range} analyte={analyte} />
                          </td>
                          <td className="px-3 py-2.5">
                            <ResultFlag
                              flag={flag}
                              critical={critical}
                              variant="short"
                            />
                          </td>
                        </>
                      )}
                      <td className="py-2.5 pr-5 pl-3">
                        <div className="flex items-start justify-between gap-2">
                          {previous ? (
                            <div className="text-meta">
                              <p
                                className={cn(
                                  'tabular-nums',
                                  valueTone(previous.flag),
                                )}
                              >
                                {text(previous.value, analyte)}
                              </p>
                              <p className="text-xs text-fg-subtle">
                                {f.dateShort(previous.at)}
                              </p>
                            </div>
                          ) : (
                            <span className="text-xs text-fg-subtle">
                              {t('noPrevious')}
                            </span>
                          )}
                          {editable ? (
                            <IconButton
                              label={t('addRemark')}
                              icon={<MessageSquareTextIcon />}
                              size="icon-xs"
                              variant={v.remarks ? 'soft' : 'ghost'}
                              onClick={() =>
                                setRemarkOpen((prev) => ({
                                  ...prev,
                                  [analyte.id]: !prev[analyte.id],
                                }))
                              }
                            />
                          ) : null}
                        </div>
                      </td>
                    </tr>
                    {remarkOpen[analyte.id] || (v.remarks && !editable) ? (
                      <tr className={cn(critical && 'bg-danger-soft/50')}>
                        <td />
                        <td colSpan={5} className="px-3 pb-2.5">
                          <Input
                            value={v.remarks}
                            disabled={!editable}
                            onChange={(ev) =>
                              onChange(analyte.id, { remarks: ev.target.value })
                            }
                            placeholder={t('remarkPlaceholder')}
                            aria-label={`${tc('remarks')}: ${analyte.name}`}
                            className="h-8 text-meta"
                          />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                )
              },
            )}
          </tbody>
        </table>
      </div>
      {editable &&
      DIFFERENTIAL.every((d) =>
        item.analytes.some((a) => a.analyte.id === d.id),
      ) ? (
        <DifferentialCounter
          names={Object.fromEntries(
            item.analytes.map((a) => [a.analyte.id, a.analyte.name]),
          )}
          onApply={(pct) => {
            for (const [id, value] of Object.entries(pct))
              onChange(id, { value })
          }}
        />
      ) : null}
      {editable ? (
        <TestComment item={item} comment={comment} onComment={onComment} />
      ) : null}
    </Card>
  )
}

function EntryForm({
  view,
  onCriticals,
}: {
  view: ResultEntryView
  /** A submit raised critical values: the page asks for them to be called. */
  onCriticals: (criticals: EntryCritical[]) => void
}) {
  const t = useT('results')
  const navigate = useNavigate()
  const [layout, setLayout] = useSearchParam<(typeof VIEWS)[number]>(
    'view',
    'entry',
    VIEWS,
  )
  const initial = useMemo(() => initialValues(view), [view])
  const [values, setValues] = useState<Values>(initial)
  const [comments, setComments] = useState<Record<string, string>>({})
  const [showMissing, setShowMissing] = useState(false)
  const submitted = useRef(false)
  const analytes = useMemo(
    () =>
      Object.fromEntries(
        view.items.flatMap((i) =>
          i.analytes.map((a) => [a.analyte.id, a.analyte]),
        ),
      ),
    [view],
  )
  const dirty = JSON.stringify(values) !== JSON.stringify(initial)
  const blocker = useUnsavedChanges(dirty, () => submitted.current)
  // The action bar is sticky at the bottom: keep the assistant above it.
  useAssistantClearance(76)

  const editableItems = view.items.filter((i) => EDITABLE.includes(i.status))
  let total = 0
  let done = 0
  let abnormal = 0
  let critical = 0
  const live = Object.fromEntries(
    view.items.map((item) => [
      item.itemId,
      liveItem(item, values[item.itemId]),
    ]),
  )
  // Criticals the form shows right now (named in the alert after a submit).
  const criticalNow: EntryCritical[] = []
  for (const item of editableItems) {
    for (const r of liveRows(item, live[item.itemId]!, analytes)) {
      if (!r.required) continue
      // Calculated values are computed on save, not entered.
      if (!r.calculated) {
        total += 1
        if (r.value.trim()) done += 1
      }
      if (r.critical) {
        critical += 1
        criticalNow.push({
          analyte: r.analyte.name,
          testName: item.testName,
          value: r.value,
          unit: r.analyte.unit,
          flag: r.flag,
        })
      } else if (isAbnormal(r.flag)) abnormal += 1
    }
  }

  // Submitted values being changed: each needs a reason on record.
  const changes = editableItems
    .filter((item) => item.status === 'entered')
    .flatMap((item) =>
      item.analytes.flatMap(({ analyte }) => {
        const before = initial[item.itemId]?.[analyte.id]?.value.trim() ?? ''
        const after = values[item.itemId]?.[analyte.id]?.value.trim() ?? ''
        return before && before !== after
          ? [{ key: `${item.itemId}:${analyte.id}`, analyte, before, after }]
          : []
      }),
    )
  const [asking, setAsking] = useState<boolean | null>(null)
  const [changeReason, setChangeReason] = useState('')
  const [reasonTouched, setReasonTouched] = useState(false)
  const [rerunFor, setRerunFor] = useState<EntryItem | null>(null)

  const entries = (reason?: string) =>
    editableItems.map((item) => ({
      itemId: item.itemId,
      ...(reason && item.status === 'entered' ? { changeReason: reason } : {}),
      values: Object.fromEntries(
        Object.entries(values[item.itemId] ?? {}).map(([analyteId, v]) => {
          // Calculated analytes: what the system computes (it ignores typing).
          const calculated = live[item.itemId]?.calculated[analyteId]
          const value = calculated ? calculated.value : v.value.trim() || null
          return [
            analyteId,
            {
              value,
              ...(v.remarks.trim() ? { remarks: v.remarks.trim() } : {}),
            },
          ]
        }),
      ),
    }))

  /** The alerts a submit just raised, read back from the critical queue. */
  const raised = async (count: number): Promise<EntryCritical[]> => {
    if (count === 0) return []
    try {
      const { rows } = await labApi.critical.list({ status: 'pending' })
      const mine = rows
        .filter((r) => r.sampleId === view.sample.id && r.status === 'open')
        .toSorted((a, b) => b.detectedAt - a.detectedAt)
        .slice(0, count)
        .map((r) => ({
          alertId: r.id,
          analyte: r.analyteName,
          testName: r.testName,
          value: r.value,
          unit: r.unit,
          flag: r.flag,
        }))
      if (mine.length) return mine
    } catch {
      // The queue could not be read: name what the form shows instead.
    }
    return criticalNow
  }

  const save = useLabMutation(
    async ({ submit, reason }: { submit: boolean; reason?: string }) => {
      const res = await labApi.results.save(
        view.sample.id,
        entries(reason),
        submit,
      )
      // Test comments go on the report once the results are saved.
      for (const [itemId, text] of Object.entries(comments))
        if (text.trim())
          await labApi.validation.comment(itemId, text.trim(), 'report')
      setComments({})
      return { ...res, criticals: await raised(res.newCriticals) }
    },
    {
      success: (_res, { submit }) =>
        submit
          ? {
              title: t('submitted'),
              description: t('submittedBody', {
                tests: editableItems.map((i) => i.shortName).join(', '),
              }),
            }
          : t('draftSaved'),
      onSuccess: (res, { submit }) => {
        submitted.current = true
        setAsking(null)
        setChangeReason('')
        setReasonTouched(false)
        // A new critical value stops here until someone takes the call.
        if (res.criticals.length > 0) onCriticals(res.criticals)
        else if (submit) void navigate('/worklists')
        if (!submit || res.criticals.length > 0) submitted.current = false
      },
    },
  )

  const setValue = (
    itemId: string,
    analyteId: string,
    patch: Partial<{ value: string; remarks: string }>,
  ) =>
    setValues((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [analyteId]: {
          ...{ value: '', remarks: '' },
          ...prev[itemId]?.[analyteId],
          ...patch,
        },
      },
    }))

  const missing = total - done
  // Changing a submitted value asks why first.
  const attempt = (submit: boolean) => {
    if (changes.length) setAsking(submit)
    else save.mutate({ submit })
  }
  const submit = () => {
    if (missing > 0) {
      setShowMissing(true)
      window.setTimeout(() => focusFirstInvalid(), 0)
      return
    }
    attempt(true)
  }

  return (
    <div
      onKeyDown={(ev) => {
        if ((ev.ctrlKey || ev.metaKey) && ev.key === 'Enter') {
          ev.preventDefault()
          if (editableItems.length && !save.isPending) submit()
        }
      }}
    >
      <PageHeader
        back={{ to: '/worklists', label: t('backToWorklist') }}
        title={t('entryTitle')}
        actions={
          <span className="hidden items-center gap-1.5 text-xs text-fg-subtle lg:flex">
            <KeyboardIcon className="size-4" />
            {t('keyboardHint')}
          </span>
        }
      />
      <SpecimenBanner view={view} />
      {view.sample.status !== 'received' &&
      view.sample.status !== 'processing' ? (
        <Card className="mb-5 flex items-center gap-3 border-warning/30 bg-warning-soft/60 p-4 text-meta text-warning-text">
          <TriangleAlertIcon className="size-5" />
          {t('notInLab')}
        </Card>
      ) : null}
      {showMissing && missing > 0 ? (
        <div className="mb-4">
          <FormErrorSummary
            count={missing}
            onFocusFirst={() => focusFirstInvalid()}
          />
        </div>
      ) : null}
      {/* Entry and the printed preview side by side when the page is wide
          enough (about 1280px with the sidebar open); a switch below that. */}
      <div className="@container">
        <div className="mb-4 @min-[60rem]:hidden">
          <Segmented
            value={layout}
            onValueChange={setLayout}
            aria-label={t('viewSwitch')}
            options={[
              {
                value: 'entry',
                label: t('viewEntry'),
                icon: <PencilLineIcon />,
              },
              {
                value: 'preview',
                label: t('viewPreview'),
                icon: <PrinterIcon />,
              },
            ]}
          />
        </div>
        <div className="grid items-start gap-5 pb-24 @min-[60rem]:grid-cols-[minmax(0,1fr)_18rem] @min-[84rem]:grid-cols-[minmax(0,1fr)_22rem]">
          <div
            className={cn(
              'grid gap-5',
              layout === 'preview' && '@max-[60rem]:hidden',
            )}
          >
            {view.items.map((item) => (
              <TestCard
                key={item.itemId}
                item={item}
                values={values[item.itemId] ?? {}}
                analytes={analytes}
                showMissing={showMissing}
                comment={comments[item.itemId] ?? ''}
                onComment={(text) =>
                  setComments((prev) => ({ ...prev, [item.itemId]: text }))
                }
                onChange={(analyteId, patch) =>
                  setValue(item.itemId, analyteId, patch)
                }
                onRerun={() => setRerunFor(item)}
              />
            ))}
          </div>
          <ReportPreview
            items={view.items}
            values={values}
            comments={comments}
            analytes={analytes}
            className={cn(
              // Below the sticky patient banner, above the sticky action bar.
              '@min-[60rem]:sticky @min-[60rem]:top-[calc(var(--header-h,4rem)+7rem)] @min-[60rem]:max-h-[calc(100dvh-var(--header-h,4rem)-14rem)]',
              layout !== 'preview' && '@max-[60rem]:hidden',
            )}
          />
        </div>
      </div>
      <div className="sticky bottom-[calc(1rem+var(--bottom-nav-h,0px))] z-20">
        <Card className="flex flex-wrap items-center gap-3 border-line-strong px-5 py-3 shadow-overlay">
          <div className="flex flex-wrap items-center gap-2 text-meta">
            <span className="font-semibold text-fg tabular-nums">
              {t('progress', { done, total })}
            </span>
            {abnormal ? (
              <Badge tone="warning">{t('abnormal', { count: abnormal })}</Badge>
            ) : null}
            {critical ? (
              <Badge tone="solidDanger">
                <OctagonAlertIcon strokeWidth={2.2} />
                {t('critical', { count: critical })}
              </Badge>
            ) : null}
          </div>
          <span className="ml-auto" />
          <Button
            onClick={() => attempt(false)}
            loading={save.isPending && save.variables?.submit === false}
            disabled={editableItems.length === 0}
          >
            <SaveIcon />
            {t('saveDraft')}
          </Button>
          <GuardedButton
            permission="result.enter"
            variant="primary"
            onClick={submit}
            loading={save.isPending && save.variables?.submit === true}
            disabled={editableItems.length === 0}
          >
            <CheckIcon strokeWidth={2.5} />
            {t('submit')}
          </GuardedButton>
        </Card>
      </div>
      <ConfirmDialog
        open={asking !== null}
        onOpenChange={(o) => {
          if (o) return
          setAsking(null)
          setReasonTouched(false)
        }}
        title={t('changeReasonTitle')}
        description={t('changeReasonBody')}
        confirmLabel={asking ? t('submit') : t('saveDraft')}
        loading={save.isPending}
        onConfirm={() => {
          setReasonTouched(true)
          if (changeReason.trim())
            save.mutate({
              submit: Boolean(asking),
              reason: changeReason.trim(),
            })
        }}
      >
        <div className="grid gap-4">
          <ul className="grid gap-1 rounded-lg bg-surface-2 px-3 py-2 text-meta">
            {changes.map((c) => (
              <li key={c.key} className="flex flex-wrap gap-x-2">
                <span className="font-medium text-fg">{c.analyte.name}</span>
                <span className="text-fg-subtle tabular-nums line-through">
                  {c.before}
                </span>
                <span className="sr-only">{t('changedTo')}</span>
                <span className="font-medium text-fg tabular-nums">
                  {c.after || t('cleared')}
                </span>
              </li>
            ))}
          </ul>
          <Field
            label={t('changeReasonLabel')}
            required
            error={
              reasonTouched && !changeReason.trim()
                ? 'forms.reasonRequired'
                : undefined
            }
          >
            <Textarea
              value={changeReason}
              onChange={(ev) => setChangeReason(ev.target.value)}
              placeholder={t('changeReasonPlaceholder')}
              rows={3}
            />
          </Field>
        </div>
      </ConfirmDialog>
      <RerunDialog
        item={
          rerunFor ? { itemId: rerunFor.itemId, name: rerunFor.testName } : null
        }
        open={rerunFor !== null}
        onOpenChange={(o) => !o && setRerunFor(null)}
        onDone={(itemId) =>
          setValues((prev) => ({
            ...prev,
            [itemId]: Object.fromEntries(
              Object.keys(prev[itemId] ?? {}).map((k) => [
                k,
                { value: '', remarks: '' },
              ]),
            ),
          }))
        }
      />
      <UnsavedChangesDialog blocker={blocker} />
    </div>
  )
}

export function Component() {
  const { sampleId } = useParams()
  const t = useT('results')
  const tp = useT('processing')
  const navigate = useNavigate()
  const { data, isPending, isError, error, refetch } = useResultEntry(sampleId)
  const { data: settings } = useLabSettings()
  // Kept here, not in the form: a submit re-keys the form as statuses change.
  const [criticals, setCriticals] = useState<EntryCritical[]>([])
  if (isPending)
    return (
      <div className="grid gap-5">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-28 rounded-xl" />
        <CardSkeleton lines={10} />
      </div>
    )
  if (isError || !data)
    return (
      <Card>
        {isLabApiError(error) && error.code === 'not-found' ? (
          <EmptyState
            icon={<PencilLineIcon />}
            title={tp('notFoundTitle')}
            description={tp('notFoundBody')}
            action={
              <Link
                to="/worklists"
                className={buttonVariants({ variant: 'primary' })}
              >
                {t('backToWorklist')}
              </Link>
            }
          />
        ) : (
          <ErrorState onRetry={() => void refetch()} />
        )}
      </Card>
    )
  const alertIds = criticals.flatMap((c) => (c.alertId ? [c.alertId] : []))
  return (
    <>
      <EntryForm
        key={data.sample.id + data.items.map((i) => i.status).join()}
        view={data}
        onCriticals={setCriticals}
      />
      <CriticalAtEntryDialog
        criticals={criticals}
        patient={`${data.sample.patient.name} (${data.sample.patient.uhid})`}
        minutes={settings?.criticalNotifyMin ?? 30}
        onCommunicate={() => {
          setCriticals([])
          void navigate(
            alertIds.length === 1
              ? `/critical-results?alert=${alertIds[0]}`
              : `/critical-results?status=pending&q=${encodeURIComponent(data.sample.patient.uhid)}`,
          )
        }}
        onCallNow={() => {
          setCriticals([])
          void navigate('/worklists')
        }}
      />
    </>
  )
}
