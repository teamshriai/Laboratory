import {
  Undo2Icon,
  MessageSquareTextIcon,
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
import { UnsavedChangesDialog } from '@/components/ui/unsaved-dialog'
import { toast } from 'sonner'
import {
  computeFlag,
  deltaCheck,
  isAbnormal,
  isCriticalFlag,
} from '@/domain/flags'
import type { Analyte } from '@/domain/types'
import { useEnum, useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import { PatientBanner } from '@/components/lab/patient-banner'
import { RecordLink } from '@/components/lab/record-link'
import { RerunDialog } from '@/components/lab/rerun-dialog'
import { cn } from '@/lib/cn'
import {
  isAnalyteRequired,
  isLabApiError,
  labApi,
  type EntryItem,
  type ResultEntryView,
} from '@/services/lab-api'
import { useLabMutation } from '@/services/mutations'
import { useResultEntry } from '@/services/queries'
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
import { CardSkeleton, Skeleton } from '@/components/ui/skeleton'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { FormErrorSummary } from '@/components/ui/form-errors'
import { focusFirstInvalid } from '@/lib/focus'
import { AnalyteInput } from './analyte-input'
import { DIFFERENTIAL } from './differential'
import { DifferentialCounter } from './differential-counter'
import { focusWhenScrollable } from '@/lib/scroll-focus'

type Values = Record<string, Record<string, { value: string; remarks: string }>>

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
  const [remarkOpen, setRemarkOpen] = useState<Record<string, boolean>>({})
  const editable = EDITABLE.includes(item.status)
  const plain = Object.fromEntries(
    Object.entries(values).map(([k, v]) => [k, v.value]),
  )
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
        <div className="flex items-center gap-2">
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
        <table className="w-full min-w-[760px] text-sm">
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
            {item.analytes.map(({ analyte, range, previous }) => {
              const v = values[analyte.id] ?? { value: '', remarks: '' }
              const required = isAnalyteRequired(analyte, plain, analytes)
              if (!required && !v.value) {
                if (analyte.dependsOn) return null
              }
              const flag = computeFlag(analyte, v.value, range)
              const critical = isCriticalFlag(analyte, flag)
              const delta =
                analyte.resultType === 'numeric'
                  ? deltaCheck(v.value, previous?.value, analyte.deltaPct)
                  : null
              const wide =
                analyte.resultType === 'narrative' ||
                analyte.resultType === 'antibiogram'
              const fieldId = `f-${item.itemId}-${analyte.id}`
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
                      {reruns.some((r) => r.analyte.id === analyte.id) ? (
                        <p className="mt-1 text-xs text-fg-muted tabular-nums">
                          {t('firstRun', {
                            value: text(
                              reruns.find((r) => r.analyte.id === analyte.id)!
                                .rev.value,
                              analyte,
                            ),
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
                      <AnalyteInput
                        id={fieldId}
                        analyte={analyte}
                        value={v.value}
                        onChange={(value) => onChange(analyte.id, { value })}
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
            })}
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
        <div className="border-t border-line px-5 py-3">
          <label
            htmlFor={`c-${item.itemId}`}
            className="mb-1.5 block text-sm font-medium text-fg-muted"
          >
            {t('testComment')}{' '}
            <span className="text-xs font-normal text-fg-subtle">
              ({tc('optional')})
            </span>
          </label>
          <Textarea
            id={`c-${item.itemId}`}
            value={comment}
            onChange={(ev) => onComment(ev.target.value)}
            rows={2}
            placeholder={t('testCommentPlaceholder')}
          />
        </div>
      ) : null}
    </Card>
  )
}

function EntryForm({ view }: { view: ResultEntryView }) {
  const t = useT('results')
  const navigate = useNavigate()
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

  const editableItems = view.items.filter((i) => EDITABLE.includes(i.status))
  let total = 0
  let done = 0
  let abnormal = 0
  let critical = 0
  for (const item of editableItems) {
    const plain = Object.fromEntries(
      Object.entries(values[item.itemId] ?? {}).map(([k, v]) => [k, v.value]),
    )
    for (const a of item.analytes) {
      if (!isAnalyteRequired(a.analyte, plain, analytes)) continue
      total += 1
      const value = plain[a.analyte.id] ?? ''
      if (value.trim()) done += 1
      const flag = computeFlag(a.analyte, value, a.range)
      if (isCriticalFlag(a.analyte, flag)) critical += 1
      else if (isAbnormal(flag)) abnormal += 1
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
        Object.entries(values[item.itemId] ?? {}).map(([analyteId, v]) => [
          analyteId,
          {
            value: v.value.trim() || null,
            ...(v.remarks.trim() ? { remarks: v.remarks.trim() } : {}),
          },
        ]),
      ),
    }))

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
      return res
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
        if (res.newCriticals > 0)
          toast.error(t('criticalToast', { count: res.newCriticals }), {
            description: t('criticalToastBody'),
            duration: 10_000,
            action: {
              label: t('openCritical'),
              onClick: () => void navigate('/critical-results?status=pending'),
            },
          })
        if (submit) void navigate('/worklists')
        else submitted.current = false
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
      <div className="grid gap-5 pb-24">
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
      <div className="sticky bottom-4 z-20">
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
  const { data, isPending, isError, error, refetch } = useResultEntry(sampleId)
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
            title={t('emptyTitle')}
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
  return (
    <EntryForm
      key={data.sample.id + data.items.map((i) => i.status).join()}
      view={data}
    />
  )
}
