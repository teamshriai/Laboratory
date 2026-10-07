import { ShieldAlertIcon, ShieldCheckIcon } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useT } from '@/i18n/context'
import { labApi, type ValidationRow } from '@/services/lab-api'
import { useLabMutation } from '@/services/mutations'
import { GuardedButton } from '@/components/lab/guarded-button'
import { SigningAs } from '@/components/lab/signing-as'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

type AutoCheck = NonNullable<ValidationRow['autoCheck']>

/**
 * A queue row's auto-verification outcome: passed, or held with the checks
 * it failed. The rule only marks results; a person still authorises.
 */
export function AutoCheckMark({ check }: { check: AutoCheck }) {
  const t = useT('insights')
  const rule = t('auto.rule', { version: check.version })
  if (check.passed)
    return (
      <span
        title={rule}
        className="inline-flex items-center gap-1 font-medium text-success-text"
      >
        <ShieldCheckIcon className="size-3" aria-hidden />
        {t('auto.passed')}
      </span>
    )
  if (!check.failed.length) return null
  const checks = check.failed.map((c) => t(`auto.check.${c}`)).join(', ')
  return (
    <span
      title={rule}
      className="inline-flex items-center gap-1 font-medium text-warning-text"
    >
      <ShieldAlertIcon className="size-3 shrink-0" aria-hidden />
      <span className="sr-only">{t('auto.heldLabel', { checks })}</span>
      <span aria-hidden>{t('auto.held', { checks })}</span>
    </span>
  )
}

/** Rows the authorise stage can sign in one go: passed and not held. */
const eligible = (rows: ValidationRow[]) =>
  rows.filter(
    (r) =>
      r.autoCheck?.passed === true &&
      !r.sampleOnHold &&
      !r.qcHold &&
      r.status !== 'held',
  )

/**
 * "Authorise all that passed": the authorise stage only, for people who may
 * authorise. It confirms first and says who signs; the engine still checks
 * every result as it would one at a time.
 */
export function AuthorisePassedButton({ rows }: { rows: ValidationRow[] }) {
  const t = useT('insights')
  const tv = useT('validation')
  const navigate = useNavigate()
  // What the dialog lists is exactly what is signed, even if the queue
  // refreshes while it is open.
  const [batch, setBatch] = useState<ValidationRow[] | null>(null)
  const validate = useLabMutation(
    (ids: string[]) => labApi.validation.validate(ids),
    {
      success: (r) => tv('validated', { count: r.validated }),
      onSuccess: (r) => {
        setBatch(null)
        for (const rep of r.readyReports.slice(0, 3))
          toast.success(tv('reportReady', { report: rep.reportNo }), {
            action: {
              label: tv('openReport'),
              onClick: () => void navigate(`/reports/${rep.id}`),
            },
          })
      },
    },
  )
  const ready = eligible(rows)
  if (!ready.length && !batch) return null
  const count = batch?.length ?? 0

  return (
    <>
      <GuardedButton
        permission="result.authorise"
        size="xs"
        variant="soft"
        onClick={() => setBatch(ready)}
      >
        <ShieldCheckIcon />
        {t('auto.authoriseAll', { count: ready.length })}
      </GuardedButton>
      <ConfirmDialog
        open={batch !== null}
        onOpenChange={(o) => {
          if (!o) setBatch(null)
        }}
        title={t('auto.confirmTitle', { count })}
        description={t('auto.confirmBody')}
        confirmLabel={t('auto.confirmAction')}
        loading={validate.isPending}
        disabled={count === 0}
        onConfirm={() => validate.mutate((batch ?? []).map((r) => r.itemId))}
      >
        <div className="grid gap-3">
          <SigningAs permission="result.authorise" />
          <div>
            <p className="mb-1.5 text-xs font-semibold text-fg-muted">
              {t('auto.confirmList')}
            </p>
            <ul className="max-h-48 scrollbar-thin divide-y divide-line overflow-y-auto rounded-lg border border-line text-meta">
              {(batch ?? []).map((r) => (
                <li
                  key={r.itemId}
                  className="flex flex-wrap items-baseline gap-x-2 px-3 py-1.5"
                >
                  <span className="font-medium text-fg">{r.shortName}</span>
                  <span className="font-mono text-xs text-fg-muted">
                    {r.accessionNo}
                  </span>
                  <span className="min-w-0 truncate text-xs text-fg-muted">
                    {r.patient.name}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </ConfirmDialog>
    </>
  )
}
