import { CircleCheckIcon, GitMergeIcon, UsersIcon } from 'lucide-react'
import { useDeferredValue, useState, type ReactNode } from 'react'
import { useT } from '@/i18n/context'
import { cn } from '@/lib/cn'
import { focusFirstInvalid } from '@/lib/focus'
import { labApi, type PatientDetail, type PatientRow } from '@/services/lab-api'
import { useLabMutation } from '@/services/mutations'
import { usePatients } from '@/services/queries'
import { GuardedButton } from '@/components/lab/guarded-button'
import { AgeSex } from '@/components/lab/patient'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { SearchInput, Textarea } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, ErrorState } from '@/components/ui/states'

type Survivor = PatientDetail['patient']

/**
 * Merges a duplicate registration into the open record. Everything filed
 * under the duplicate moves here; the duplicate stays, read-only, pointing
 * at this record.
 */
export function MergePatientDialog({
  patient,
  onClose,
}: {
  patient: Survivor
  onClose: () => void
}) {
  const t = useT('patients')
  const tc = useT('common')
  const [query, setQuery] = useState('')
  const q = useDeferredValue(query.trim())
  const [picked, setPicked] = useState<PatientRow | null>(null)
  const [reason, setReason] = useState('')
  const [tried, setTried] = useState(false)
  const { data, isPending, isError, refetch } = usePatients({
    q,
    pageSize: 10,
  })
  const rows = (data?.rows ?? []).filter(
    (r) => r.id !== patient.id && !r.mergedInto,
  )
  const merge = useLabMutation(
    (v: { duplicate: PatientRow; reason: string }) =>
      labApi.patients.merge({
        survivorId: patient.id,
        duplicateId: v.duplicate.id,
        reason: v.reason,
      }),
    {
      success: (_, v) => ({
        title: t('mergedToast', {
          from: v.duplicate.uhid,
          to: patient.uhid,
        }),
        description: t('mergedToastBody'),
      }),
      onSuccess: onClose,
    },
  )
  const reasonMissing = !reason.trim()
  const confirm = () => {
    setTried(true)
    if (!picked || reasonMissing) {
      window.setTimeout(() => focusFirstInvalid(), 0)
      return
    }
    merge.mutate({ duplicate: picked, reason: reason.trim() })
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      dirty={Boolean(picked) || Boolean(reason.trim())}
      size="lg"
      title={t('mergeTitle')}
      description={t('mergeBody', { uhid: patient.uhid })}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {tc('cancel')}
          </Button>
          <GuardedButton
            permission="patient.merge"
            variant="primary"
            disabled={!picked}
            loading={merge.isPending}
            onClick={confirm}
          >
            <GitMergeIcon aria-hidden />
            {t('mergeConfirm')}
          </GuardedButton>
        </>
      }
    >
      <div className="grid gap-5">
        {picked ? (
          <section aria-labelledby="merge-compare" className="grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 id="merge-compare" className="text-sm font-semibold text-fg">
                {t('mergeCompare')}
              </h3>
              <Button size="sm" variant="ghost" onClick={() => setPicked(null)}>
                {t('mergeChooseAnother')}
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Side title={t('mergeKeep')} tone="keep" person={patient} />
              <Side title={t('mergeDuplicate')} tone="merge" person={picked} />
            </div>
            <p className="rounded-xl border border-warning-text/30 bg-warning-soft px-3.5 py-3 text-meta text-fg">
              {t('mergeStatement', { from: picked.uhid, to: patient.uhid })}
            </p>
            <Field
              label={t('mergeReason')}
              required
              hint={t('mergeReasonHint')}
              error={
                tried && reasonMissing ? t('mergeReasonRequired') : undefined
              }
            >
              <Textarea
                value={reason}
                rows={2}
                maxLength={300}
                onChange={(ev) => setReason(ev.target.value)}
              />
            </Field>
          </section>
        ) : (
          <section aria-labelledby="merge-search" className="grid gap-3">
            <h3 id="merge-search" className="text-sm font-semibold text-fg">
              {t('mergeFind')}
            </h3>
            <SearchInput
              value={query}
              onValueChange={setQuery}
              placeholder={t('search')}
              aria-label={t('mergeFind')}
              clearLabel={t('clearSearch')}
              autoFocus
            />
            {tried ? (
              <p className="text-meta text-danger-text" role="alert">
                {t('mergePickRequired')}
              </p>
            ) : null}
            {isError ? (
              <ErrorState compact onRetry={() => void refetch()} />
            ) : isPending ? (
              <div className="grid gap-2">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-14 rounded-xl" />
                ))}
              </div>
            ) : rows.length === 0 ? (
              <EmptyState
                compact
                icon={<UsersIcon />}
                title={t('mergeNoMatches')}
                description={t('mergeNoMatchesBody')}
              />
            ) : (
              <ul className="grid gap-2">
                {rows.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setPicked(r)
                        setTried(false)
                      }}
                      className="focus-ring flex min-h-11 w-full flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-line px-3.5 py-2.5 text-left transition-colors hover:border-line-strong hover:bg-surface-2"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium text-fg">
                          {r.name}
                        </span>
                        <span className="block text-xs text-fg-muted">
                          <span className="font-mono">{r.uhid}</span> ·{' '}
                          <AgeSex dob={r.dob} sex={r.sex} /> ·{' '}
                          <span className="tabular-nums">{r.mobile}</span>
                        </span>
                      </span>
                      <span className="text-xs font-semibold text-accent-text">
                        {t('mergeSelect')}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </Dialog>
  )
}

function Side({
  title,
  tone,
  person,
}: {
  title: string
  tone: 'keep' | 'merge'
  person: Pick<PatientRow, 'name' | 'uhid' | 'dob' | 'sex' | 'mobile'>
}) {
  const t = useT('patients')
  return (
    <div
      className={cn(
        'rounded-xl border p-3.5',
        tone === 'keep'
          ? 'border-success-text/30 bg-success-soft/40'
          : 'border-line bg-surface-2',
      )}
    >
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-fg-muted">
        {tone === 'keep' ? (
          <CircleCheckIcon className="size-4 text-success-text" aria-hidden />
        ) : (
          <GitMergeIcon className="size-4 text-fg-muted" aria-hidden />
        )}
        {title}
      </p>
      <dl className="grid gap-2 text-meta">
        <Row label={t('fieldName')}>{person.name}</Row>
        <Row label={t('mergeUhid')}>
          <span className="font-mono">{person.uhid}</span>
        </Row>
        <Row label={t('mergeAgeSex')}>
          <AgeSex dob={person.dob} sex={person.sex} />
        </Row>
        <Row label={t('fieldMobile')}>
          <span className="tabular-nums">{person.mobile}</span>
        </Row>
      </dl>
    </div>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-2">
      <dt className="text-xs text-fg-subtle">{label}</dt>
      <dd className="break-words text-fg">{children}</dd>
    </div>
  )
}
