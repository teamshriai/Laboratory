import {
  ArrowLeftIcon,
  BellRingIcon,
  HistoryIcon,
  FileTextIcon,
  SendIcon,
  PencilIcon,
  PrinterIcon,
  BadgeCheckIcon,
  Share2Icon,
  LanguagesIcon,
  TriangleAlertIcon,
  ArrowRightIcon,
} from 'lucide-react'
import { PageHeader } from '@/app/layout/page-header'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'
import {
  CORRECTION_REASONS,
  SHARE_CHANNELS,
  type CorrectionReason,
  type ShareChannel,
} from '@/domain/types'
import { usePreferences } from '@/app/preferences/context'
import { useNow } from '@/hooks/use-now'
import { useEnum, useLanguage, useT } from '@/i18n/context'
import { LANGUAGE_NAMES } from '@/i18n/core'
import { useFormat } from '@/i18n/format'
import { isLabApiError, labApi, type ReportDetail } from '@/services/lab-api'
import { useLabMutation } from '@/services/mutations'
import { useLabSettings, useReference, useReport } from '@/services/queries'
import { ReportStatusBadge } from '@/components/lab/status'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input, Textarea } from '@/components/ui/input'
import { usePrint, usePrintable } from '@/components/ui/print-context'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { Segmented } from '@/components/ui/toggles'
import { FormErrorSummary } from '@/components/ui/form-errors'
import { ReportSheet } from './report-sheet'

function Block({
  title,
  icon,
  children,
}: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Card className="px-4 py-3.5">
      <h2 className="mb-2.5 flex items-center gap-2 text-xs font-semibold text-fg-subtle [&_svg]:size-4">
        {icon}
        {title}
      </h2>
      {children}
    </Card>
  )
}

function ShareDialog({
  report,
  open,
  onOpenChange,
}: {
  report: ReportDetail
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const t = useT('reports')
  const tc = useT('common')
  const e = useEnum()
  const [channel, setChannel] = useState<ShareChannel>('whatsapp')
  const defaults: Record<ShareChannel, string> = {
    sms: report.patient.mobile,
    whatsapp: report.patient.mobile,
    email: '',
    doctor: report.order.doctor.name,
  }
  const [recipient, setRecipient] = useState(defaults.whatsapp)
  const share = useLabMutation(
    () => labApi.reports.share(report.id, { channel, recipient }),
    {
      success: () => t('shared', { channel: e('shareChannel', channel) }),
      onSuccess: () => onOpenChange(false),
    },
  )
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="sm"
      title={t('shareTitle', { report: report.reportNo })}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {tc('cancel')}
          </Button>
          <Button
            variant="primary"
            disabled={!recipient.trim()}
            loading={share.isPending}
            onClick={() => share.mutate()}
          >
            <SendIcon />
            {t('share')}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Field label={t('channel')}>
          <Segmented
            value={channel}
            onValueChange={(c) => {
              setChannel(c)
              setRecipient(defaults[c])
            }}
            options={SHARE_CHANNELS.map((c) => ({
              value: c,
              label: e('shareChannel', c),
            }))}
            className="w-full [&>*]:flex-1 [&>*]:justify-center"
          />
        </Field>
        <Field label={t('recipient')} required>
          <Input
            value={recipient}
            onChange={(ev) => setRecipient(ev.target.value)}
            type={channel === 'email' ? 'email' : 'text'}
          />
        </Field>
      </div>
    </Dialog>
  )
}

/** Pathologists and microbiologists who can sign a report. */
function useSignatories() {
  const { actorId } = usePreferences()
  const { data: reference } = useReference()
  const signatories = (reference?.staff ?? []).filter(
    (s) => s.role === 'pathologist' || s.role === 'microbiologist',
  )
  const defaultId = signatories.some((p) => p.id === actorId)
    ? actorId
    : (signatories[0]?.id ?? '')
  return { signatories, defaultId, actorId }
}

function SignatorySelect({
  value,
  onChange,
}: {
  value: string
  onChange: (id: string) => void
}) {
  const t = useT('reports')
  const e = useEnum()
  const { signatories } = useSignatories()
  return (
    <Field label={t('signatory')} required hint={t('signatoryHint')}>
      <Select
        value={value || undefined}
        onValueChange={onChange}
        options={signatories.map((s) => ({
          value: s.id,
          label: s.name,
          description: e('staffRole', s.role),
        }))}
      />
    </Field>
  )
}

/** Signing and releasing is clinically significant: confirm who signs. */
function ReleaseDialog({
  report,
  onClose,
}: {
  report: ReportDetail
  onClose: () => void
}) {
  const t = useT('reports')
  const tc = useT('common')
  const { defaultId } = useSignatories()
  const [by, setBy] = useState(defaultId)
  const release = useLabMutation(() => labApi.reports.release(report.id, by), {
    success: () => t('released', { report: report.reportNo }),
    onSuccess: onClose,
  })
  return (
    <Dialog
      open
      size="sm"
      onOpenChange={(o) => !o && onClose()}
      title={t('releaseTitle', { report: report.reportNo })}
      description={t('releaseBody', { patient: report.patient.name })}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {tc('cancel')}
          </Button>
          <Button
            variant="primary"
            disabled={!by}
            loading={release.isPending}
            onClick={() => release.mutate()}
          >
            <BadgeCheckIcon />
            {t('signAndRelease')}
          </Button>
        </>
      }
    >
      <SignatorySelect value={by} onChange={setBy} />
    </Dialog>
  )
}

/**
 * Requests a correction to a released report: one or more values, a reason
 * and an explanation. It takes effect only when a pathologist authorises it.
 */
function CorrectDialog({
  report,
  onClose,
}: {
  report: ReportDetail
  onClose: () => void
}) {
  const t = useT('reports')
  const tc = useT('common')
  const e = useEnum()
  const { actorId } = usePreferences()
  const rows = report.sections.flatMap((s) =>
    s.rows.filter((r) => r.resultType !== 'antibiogram' && r.value !== null),
  )
  const [values, setValues] = useState<Record<string, string>>({})
  const [reason, setReason] = useState<CorrectionReason | undefined>()
  const [comments, setComments] = useState('')
  const [tried, setTried] = useState(false)
  const changes = rows
    .map((r) => ({
      resultId: r.resultId,
      value: values[r.resultId]?.trim() ?? '',
    }))
    .filter(
      (c) =>
        c.value &&
        c.value !== rows.find((r) => r.resultId === c.resultId)?.value,
    )
  const request = useLabMutation(
    () =>
      labApi.reports.requestCorrection(
        report.id,
        { corrections: changes, reason: reason!, comments },
        actorId,
      ),
    { success: () => t('correctionRequested'), onSuccess: onClose },
  )
  const errors = {
    changes: changes.length === 0,
    reason: !reason,
    comments: !comments.trim(),
  }
  const invalidCount = Object.values(errors).filter(Boolean).length
  return (
    <Dialog
      open
      size="lg"
      onOpenChange={(o) => !o && onClose()}
      title={t('correctTitle', { report: report.reportNo })}
      description={t('correctBody')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {tc('cancel')}
          </Button>
          <Button
            variant="primary"
            loading={request.isPending}
            onClick={() => {
              setTried(true)
              if (invalidCount === 0) request.mutate()
            }}
          >
            {t('requestCorrection')}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        {tried ? <FormErrorSummary count={invalidCount} /> : null}
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-medium text-fg-muted">
            {t('correctParameters')}
          </legend>
          <div className="max-h-72 scrollbar-thin overflow-y-auto rounded-lg border border-line">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface-2 text-left text-xs text-fg-muted">
                <tr>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    {t('correctParameter')}
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    {t('reported')}
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    {t('correctValue')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.resultId} className="border-t border-line">
                    <th
                      scope="row"
                      className="px-3 py-1.5 text-left font-medium"
                    >
                      {r.name}
                    </th>
                    <td className="px-3 py-1.5 text-fg-muted tabular-nums">
                      {r.value} {r.unit}
                    </td>
                    <td className="px-3 py-1.5">
                      <Input
                        aria-label={t('correctValueFor', { name: r.name })}
                        value={values[r.resultId] ?? ''}
                        onChange={(ev) =>
                          setValues((v) => ({
                            ...v,
                            [r.resultId]: ev.target.value,
                          }))
                        }
                        className="h-9"
                        aria-invalid={
                          tried && errors.changes ? true : undefined
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {tried && errors.changes ? (
            <p role="alert" className="text-xs font-medium text-danger-text">
              {t('correctNoChange')}
            </p>
          ) : null}
        </fieldset>
        <Field
          label={t('correctReason')}
          required
          error={tried && errors.reason ? 'forms.selectOne' : undefined}
        >
          <Select
            value={reason}
            onValueChange={setReason}
            placeholder={tc('selectPlaceholder')}
            options={CORRECTION_REASONS.map((r) => ({
              value: r,
              label: e('correctionReason', r),
            }))}
          />
        </Field>
        <Field
          label={t('correctComments')}
          required
          error={tried && errors.comments ? 'forms.required' : undefined}
        >
          <Textarea
            value={comments}
            onChange={(ev) => setComments(ev.target.value)}
            rows={3}
          />
        </Field>
      </div>
    </Dialog>
  )
}

/** A requested correction: what changes, why, and who asked. */
function PendingAmendmentBlock({ report }: { report: ReportDetail }) {
  const t = useT('reports')
  const tc = useT('common')
  const e = useEnum()
  const f = useFormat()
  const { defaultId } = useSignatories()
  const [by, setBy] = useState(defaultId)
  const [declining, setDeclining] = useState(false)
  const [reason, setReason] = useState('')
  const pending = report.pendingAmendment
  const authorise = useLabMutation(
    () => labApi.reports.authoriseCorrection(report.id, by),
    {
      success: (r) => t('corrected', { version: r.version }),
      onSuccess: (r) => {
        if (r.newCriticals) toast.error(t('releaseBlocked'))
      },
    },
  )
  const decline = useLabMutation(
    () => labApi.reports.declineCorrection(report.id, reason, by),
    {
      success: () => t('correctionDeclined'),
      onSuccess: () => setDeclining(false),
    },
  )
  if (!pending) return null
  return (
    <Card className="grid gap-3 border-warning-text/35 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-warning-text">
        <PencilIcon className="size-4" aria-hidden />
        {t('amendmentPending')}
      </p>
      <p className="text-xs text-fg-muted">
        {t('amendmentBy', {
          name: pending.requestedByName,
          time: f.dateTime(pending.requestedAt),
        })}
      </p>
      <ul className="grid gap-1 text-sm">
        {pending.changes.map((c) => (
          <li
            key={c.resultId}
            className="flex flex-wrap items-baseline gap-x-2"
          >
            <span className="font-medium text-fg">{c.analyteName}</span>
            <span className="text-fg-subtle tabular-nums line-through">
              {c.from}
            </span>
            <ArrowRightIcon
              className="size-3 self-center text-fg-subtle"
              aria-hidden
            />
            <span className="font-semibold text-fg tabular-nums">
              {c.to} {c.unit}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-fg-muted">
        {e('correctionReason', pending.reason)}: {pending.comments}
      </p>
      <SignatorySelect value={by} onChange={setBy} />
      <div className="grid grid-cols-2 gap-2">
        <Button onClick={() => setDeclining(true)}>{t('decline')}</Button>
        <Button
          variant="primary"
          disabled={!by}
          loading={authorise.isPending}
          onClick={() => authorise.mutate()}
        >
          <BadgeCheckIcon />
          {t('authoriseCorrection')}
        </Button>
      </div>
      <Dialog
        open={declining}
        size="sm"
        onOpenChange={setDeclining}
        title={t('declineTitle')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeclining(false)}>
              {tc('cancel')}
            </Button>
            <Button
              variant="danger"
              disabled={!reason.trim()}
              loading={decline.isPending}
              onClick={() => decline.mutate()}
            >
              {t('decline')}
            </Button>
          </>
        }
      >
        <Field label={t('declineReason')} required>
          <Textarea
            value={reason}
            onChange={(ev) => setReason(ev.target.value)}
            rows={3}
            autoFocus
          />
        </Field>
      </Dialog>
    </Card>
  )
}

function Panel({
  report,
  sheetLang,
  setSheetLang,
}: {
  report: ReportDetail
  sheetLang: 'en' | 'ui'
  setSheetLang: (v: 'en' | 'ui') => void
}) {
  const t = useT('reports')
  const e = useEnum()
  const f = useFormat()
  const now = useNow()
  const { data: labSettings } = useLabSettings()
  const { language } = useLanguage()
  const { print } = usePrint()
  const [sharing, setSharing] = useState(false)
  const [correcting, setCorrecting] = useState(false)
  const [releasing, setReleasing] = useState(false)
  const [interp, setInterp] = useState(report.interpretation ?? '')
  const released =
    report.status === 'released' ||
    report.status === 'corrected' ||
    report.status === 'amendment-pending'
  const saveInterp = useLabMutation(
    () => labApi.reports.setInterpretation(report.id, interp),
    { success: () => t('interpretationSaved') },
  )
  const recordPrint = useLabMutation(() =>
    labApi.reports.recordPrint(report.id),
  )
  const sheet = (
    <ReportSheet
      report={report}
      lang={sheetLang === 'en' ? 'en' : language}
      now={now}
      lab={labSettings}
    />
  )
  // Ctrl+P prints the report too, and is recorded like the Print button.
  usePrintable(sheet, () => recordPrint.mutate())
  const doPrint = () => {
    recordPrint.mutate()
    toast.info(t('printHint'))
    print(sheet)
  }
  return (
    <div className="grid content-start gap-4">
      <Card className="grid gap-2 p-4">
        {!released ? (
          <>
            <Button
              variant="primary"
              size="lg"
              disabled={
                report.status !== 'validated' || report.openCriticals > 0
              }
              onClick={() => setReleasing(true)}
            >
              <BadgeCheckIcon />
              {t('release')}
            </Button>
            {report.openCriticals > 0 ? (
              <p className="flex items-start gap-2 rounded-lg bg-danger-soft p-2.5 text-xs text-danger-text">
                <BellRingIcon
                  strokeWidth={2.2}
                  className="mt-px size-4 shrink-0"
                />
                {t('releaseBlocked')}
              </p>
            ) : report.status !== 'validated' ? (
              <p className="flex items-start gap-2 rounded-lg bg-surface-2 p-2.5 text-xs text-fg-muted">
                <TriangleAlertIcon className="mt-px size-4 shrink-0" />
                {t('releaseNotReady')}
              </p>
            ) : null}
          </>
        ) : null}
        <Button size="lg" onClick={doPrint}>
          <PrinterIcon />
          {t('print')}
        </Button>
        {released ? (
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => setSharing(true)}>
              <Share2Icon />
              {t('share')}
            </Button>
            <Button
              disabled={Boolean(report.pendingAmendment)}
              onClick={() => setCorrecting(true)}
            >
              <PencilIcon />
              {t('correct')}
            </Button>
          </div>
        ) : null}
      </Card>
      <PendingAmendmentBlock report={report} />
      <Block title={t('language')} icon={<LanguagesIcon />}>
        <Segmented
          size="sm"
          value={sheetLang}
          onValueChange={setSheetLang}
          className="w-full [&>*]:flex-1 [&>*]:justify-center"
          options={[
            { value: 'en', label: t('languageEnglish') },
            { value: 'ui', label: LANGUAGE_NAMES[language] },
          ]}
        />
      </Block>
      {!released ? (
        <Block title={t('interpretation')} icon={<FileTextIcon />}>
          <Textarea
            value={interp}
            onChange={(ev) => setInterp(ev.target.value)}
            rows={3}
            placeholder={t('interpretationPlaceholder')}
          />
          <Button
            size="sm"
            className="mt-2"
            disabled={interp === (report.interpretation ?? '')}
            loading={saveInterp.isPending}
            onClick={() => saveInterp.mutate()}
          >
            {t('saveInterpretation')}
          </Button>
        </Block>
      ) : null}
      <Block title={t('versions')} icon={<HistoryIcon />}>
        {report.versions.length === 0 ? (
          <p className="text-meta text-fg-muted">-</p>
        ) : (
          <ol className="grid gap-2">
            {report.versions.toReversed().map((v) => {
              const prior = report.versions.find(
                (p) => p.version === v.version - 1,
              )
              const changed = (v.correctedResultIds ?? []).map((id) => ({
                id,
                name:
                  v.snapshot?.find((x) => x.resultId === id)?.analyteName ?? id,
                from: prior?.snapshot?.find((x) => x.resultId === id)?.value,
                to: v.snapshot?.find((x) => x.resultId === id)?.value,
              }))
              return (
                <li key={v.version} className="text-meta">
                  <p className="font-medium text-fg">
                    {t('versionRow', {
                      version: v.version,
                      time: f.dateTime(v.releasedAt),
                      by: v.releasedByName,
                    })}
                  </p>
                  {v.correctionReason ? (
                    <p className="text-xs text-warning-text">
                      {e('correctionReason', v.correctionReason)}
                      {v.correctionComments ? `: ${v.correctionComments}` : ''}
                    </p>
                  ) : null}
                  {v.requestedByName ? (
                    <p className="text-xs text-fg-subtle">
                      {t('requestedBy', { name: v.requestedByName })}
                    </p>
                  ) : null}
                  {changed.length ? (
                    <ul className="mt-1 grid gap-0.5 text-xs">
                      {changed.map((c) => (
                        <li key={c.id} className="text-fg-muted">
                          {c.name}:{' '}
                          <span className="line-through">{c.from ?? '-'}</span>{' '}
                          →{' '}
                          <span className="font-semibold text-fg">{c.to}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              )
            })}
          </ol>
        )}
        {report.printCount ? (
          <p className="mt-2 text-xs text-fg-subtle">
            {t('printedCount', { count: report.printCount })}
          </p>
        ) : null}
      </Block>
      <Block title={t('shareLog')} icon={<SendIcon />}>
        {report.shareLog.length === 0 ? (
          <p className="text-meta text-fg-muted">{t('notShared')}</p>
        ) : (
          <ul className="grid gap-1.5">
            {report.shareLog.map((s) => (
              <li key={s.id} className="text-meta">
                <span className="text-fg">
                  {t('shareRow', {
                    channel: e('shareChannel', s.channel),
                    recipient: s.recipient,
                  })}
                </span>
                <span className="block text-xs text-fg-subtle">
                  v{s.version} · {f.dateTime(s.at)} · {s.byName}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Block>
      {report.previousReports.length ? (
        <Block title={t('previous')} icon={<FileTextIcon />}>
          <ul className="grid gap-1">
            {report.previousReports.map((r) => (
              <li key={r.id}>
                <Link
                  to={`/laboratory/reports/${r.id}`}
                  className="-mx-2 flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-2"
                >
                  <span className="min-w-0 text-meta">
                    <span className="block font-mono font-medium text-fg">
                      {r.reportNo}
                    </span>
                    <span className="block text-xs text-fg-muted">
                      {e('department', r.department)} ·{' '}
                      {r.releasedAt ? f.date(r.releasedAt) : ''}
                    </span>
                  </span>
                  <ReportStatusBadge status={r.status} size="sm" />
                </Link>
              </li>
            ))}
          </ul>
        </Block>
      ) : null}
      <ShareDialog report={report} open={sharing} onOpenChange={setSharing} />
      {correcting ? (
        <CorrectDialog report={report} onClose={() => setCorrecting(false)} />
      ) : null}
      {releasing ? (
        <ReleaseDialog report={report} onClose={() => setReleasing(false)} />
      ) : null}
    </div>
  )
}

export function Component() {
  const { reportId } = useParams()
  const t = useT('reports')
  const now = useNow()
  const { data: labSettings } = useLabSettings()
  const { language } = useLanguage()
  const [sheetLang, setSheetLang] = useState<'en' | 'ui'>('en')
  const {
    data: report,
    isPending,
    isError,
    error,
    refetch,
  } = useReport(reportId)
  if (isPending)
    return (
      <div className="grid gap-5 xl:grid-cols-[1fr_20rem]">
        <Skeleton className="h-[60rem] rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    )
  if (isError || !report)
    return (
      <Card>
        {isLabApiError(error) && error.code === 'not-found' ? (
          <EmptyState
            icon={<FileTextIcon />}
            title={t('notFound')}
            action={
              <Link
                to="/laboratory/reports"
                className={buttonVariants({ variant: 'primary' })}
              >
                <ArrowLeftIcon />
                {t('back')}
              </Link>
            }
          />
        ) : (
          <ErrorState onRetry={() => void refetch()} />
        )}
      </Card>
    )
  return (
    <>
      <PageHeader
        back={{ to: '/laboratory/reports', label: t('title') }}
        title={<span className="font-mono">{report.reportNo}</span>}
        documentTitle={report.reportNo}
        titleExtra={<ReportStatusBadge status={report.status} />}
        meta={
          <Link
            to={`/laboratory/patients/${report.patient.id}`}
            className="font-medium text-fg-muted hover:text-fg hover:underline"
          >
            {report.patient.name} · {report.patient.uhid}
          </Link>
        }
      />
      <div className="grid items-start gap-5 xl:grid-cols-[1fr_20rem]">
        <div className="overflow-x-auto rounded-xl bg-surface-3/70 p-4 sm:p-8">
          <ReportSheet
            report={report}
            lang={sheetLang === 'en' ? 'en' : language}
            now={now}
            lab={labSettings}
          />
        </div>
        <Panel
          report={report}
          sheetLang={sheetLang}
          setSheetLang={setSheetLang}
        />
      </div>
    </>
  )
}
