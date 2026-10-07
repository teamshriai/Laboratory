import {
  CircleCheckIcon,
  FlaskConicalIcon,
  PrinterIcon,
  ScissorsIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  TriangleAlertIcon,
  TruckIcon,
} from 'lucide-react'
import { useState } from 'react'
import { useEnum, useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import { labApi, type SampleDetail } from '@/services/lab-api'
import { useLabMutation } from '@/services/mutations'
import { useReference, useSample } from '@/services/queries'
import { GuardedButton } from '@/components/lab/guarded-button'
import { LabelPrintDialog } from '@/components/lab/labels'
import { RecordLink } from '@/components/lab/record-link'
import { ResultStatusBadge } from '@/components/lab/status'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Timeline, type TimelineEntry } from '@/components/ui/misc'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/states'
import { Checkbox } from '@/components/ui/toggles'
import { canSendOut, canSplit, liveItems, movableItems } from './handling-rules'

type Created = { id: string; accessionNo: string | null }

function NablBadge({ accredited }: { accredited: boolean }) {
  const t = useT('processing')
  return accredited ? (
    <Badge tone="success" size="sm">
      <ShieldCheckIcon aria-hidden />
      {t('nablAccredited')}
    </Badge>
  ) : (
    <Badge tone="warning" size="sm">
      <ShieldAlertIcon aria-hidden />
      {t('notNabl')}
    </Badge>
  )
}

/** Fetches the new aliquot, then offers its label for printing. */
function AliquotLabel({ id, onClose }: { id: string; onClose: () => void }) {
  const { data } = useSample(id)
  if (!data) return null
  return (
    <LabelPrintDialog
      open
      onOpenChange={(o) => !o && onClose()}
      samples={[data]}
    />
  )
}

function SplitDialog({
  sample,
  onClose,
  onPrint,
}: {
  sample: SampleDetail
  onClose: () => void
  onPrint: (id: string) => void
}) {
  const t = useT('processing')
  const tc = useT('common')
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set())
  const [created, setCreated] = useState<Created | null>(null)
  const live = liveItems(sample)
  const movable = new Set(movableItems(sample).map((i) => i.itemId))
  const keepsOne = picked.size < live.length
  const split = useLabMutation(
    (ids: string[]) => labApi.samples.split(sample.id, [ids]),
    {
      success: (r) => t('splitDone', { accession: r[0]?.accessionNo ?? '' }),
      onSuccess: (r) => setCreated(r[0] ?? null),
    },
  )
  const toggle = (id: string, on: boolean) =>
    setPicked((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      dirty={!created && picked.size > 0}
      title={t('splitTitle', { accession: sample.accessionNo ?? '' })}
      description={created ? undefined : t('splitDescription')}
      footer={
        created ? (
          <>
            <Button variant="ghost" onClick={onClose}>
              {tc('done')}
            </Button>
            <GuardedButton
              permission="label.print"
              variant="primary"
              onClick={() => onPrint(created.id)}
            >
              <PrinterIcon />
              {t('printLabel')}
            </GuardedButton>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>
              {tc('cancel')}
            </Button>
            <Button
              variant="primary"
              disabled={picked.size === 0 || !keepsOne}
              loading={split.isPending}
              onClick={() => split.mutate([...picked])}
            >
              <ScissorsIcon />
              {t('splitConfirm')}
            </Button>
          </>
        )
      }
    >
      {created ? (
        <div className="flex items-start gap-3 rounded-xl border border-success-text/25 bg-success-soft/60 p-4 text-meta">
          <CircleCheckIcon
            className="mt-0.5 size-5 shrink-0 text-success-text"
            aria-hidden
          />
          <div className="min-w-0">
            <p className="font-semibold text-fg">
              {t('splitCreatedTitle')}{' '}
              <RecordLink
                kind="specimen"
                id={created.id}
                className="font-mono font-semibold"
              >
                {created.accessionNo}
              </RecordLink>
            </p>
            <p className="mt-0.5 text-fg-muted">{t('splitPrintPrompt')}</p>
          </div>
        </div>
      ) : (
        <fieldset className="grid gap-2">
          <legend className="mb-2 text-sm font-medium text-fg-muted">
            {t('splitTests')}
          </legend>
          {live.map((item) => {
            const id = `split-${item.itemId}`
            const canMove = movable.has(item.itemId)
            return (
              <label
                key={item.itemId}
                htmlFor={id}
                className={
                  canMove
                    ? 'flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-line px-3 py-2 hover:border-line-strong has-[[data-state=checked]]:border-accent has-[[data-state=checked]]:bg-accent-soft'
                    : 'flex min-h-11 items-center gap-3 rounded-lg border border-dashed border-line px-3 py-2 text-fg-muted'
                }
              >
                <Checkbox
                  id={id}
                  checked={picked.has(item.itemId)}
                  onCheckedChange={(on) => toggle(item.itemId, on)}
                  disabled={!canMove}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-fg">
                    {item.name}
                  </span>
                  <span className="block font-mono text-2xs text-fg-subtle">
                    {item.code}
                  </span>
                </span>
                {canMove ? null : <ResultStatusBadge status={item.status} />}
              </label>
            )
          })}
          {movable.size < live.length ? (
            <p className="text-xs text-fg-muted">{t('splitStartedHint')}</p>
          ) : null}
          {!keepsOne ? (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-lg bg-warning-soft p-3 text-meta text-warning-text"
            >
              <TriangleAlertIcon
                className="mt-0.5 size-4 shrink-0"
                aria-hidden
              />
              {t('splitKeepOne')}
            </p>
          ) : null}
        </fieldset>
      )}
    </Dialog>
  )
}

/** Parent and aliquot links, and splitting off an aliquot. */
export function SampleAliquots({ sample }: { sample: SampleDetail }) {
  const t = useT('processing')
  const [open, setOpen] = useState<'split' | null>(null)
  const [labelFor, setLabelFor] = useState<string | null>(null)
  return (
    <div className="grid gap-3 text-meta">
      {sample.parent ? (
        <p className="flex flex-wrap items-baseline gap-x-1.5">
          <span className="text-fg-muted">{t('splitFrom')}</span>
          <RecordLink
            kind="specimen"
            id={sample.parent.id}
            className="py-0.5 font-mono font-semibold text-fg"
          >
            {sample.parent.accessionNo}
          </RecordLink>
        </p>
      ) : null}
      {sample.aliquots.length ? (
        <div>
          <p className="text-fg-muted">{t('aliquotsLabel')}</p>
          <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
            {sample.aliquots.map((a) => (
              <li key={a.id}>
                <RecordLink
                  kind="specimen"
                  id={a.id}
                  className="py-0.5 font-mono font-semibold text-fg"
                >
                  {a.accessionNo}
                </RecordLink>
              </li>
            ))}
          </ul>
        </div>
      ) : !sample.parent ? (
        <p className="text-fg-muted">{t('noAliquots')}</p>
      ) : null}
      {canSplit(sample) ? (
        <div>
          <GuardedButton
            permission="specimen.split"
            size="sm"
            variant="secondary"
            onClick={() => setOpen('split')}
          >
            <ScissorsIcon />
            {t('split')}
          </GuardedButton>
        </div>
      ) : null}
      {open === 'split' ? (
        <SplitDialog
          sample={sample}
          onClose={() => setOpen(null)}
          onPrint={(id) => {
            setOpen(null)
            setLabelFor(id)
          }}
        />
      ) : null}
      {labelFor ? (
        <AliquotLabel id={labelFor} onClose={() => setLabelFor(null)} />
      ) : null}
    </div>
  )
}

function SendOutDialog({
  sample,
  onClose,
}: {
  sample: SampleDetail
  onClose: () => void
}) {
  const t = useT('processing')
  const tc = useT('common')
  const { data, isPending, isError, refetch } = useReference()
  const labs = data?.referralLabs.filter((l) => l.active) ?? []
  const [labId, setLabId] = useState<string | undefined>(undefined)
  const [courier, setCourier] = useState('')
  const lab = labs.find((l) => l.id === labId)
  const send = useLabMutation(
    (v: { labId: string; courier: string }) =>
      labApi.samples.sendOut(
        sample.id,
        v.courier ? { labId: v.labId, courier: v.courier } : { labId: v.labId },
      ),
    {
      success: () =>
        t('sentOut', {
          accession: sample.accessionNo ?? '',
          lab: lab?.name ?? '',
        }),
      onSuccess: onClose,
    },
  )
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      dirty={Boolean(labId) || courier !== ''}
      title={t('sendOutTitle', { accession: sample.accessionNo ?? '' })}
      description={t('sendOutDescription')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {tc('cancel')}
          </Button>
          <Button
            variant="primary"
            disabled={!lab}
            loading={send.isPending}
            onClick={() =>
              lab && send.mutate({ labId: lab.id, courier: courier.trim() })
            }
          >
            <TruckIcon />
            {t('sendOutConfirm')}
          </Button>
        </>
      }
    >
      {isPending ? (
        <div className="grid gap-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-11 w-full rounded-lg" />
        </div>
      ) : isError ? (
        <ErrorState compact onRetry={() => void refetch()} />
      ) : labs.length === 0 ? (
        <p className="text-meta text-fg-muted">{t('noReferralLabs')}</p>
      ) : (
        <div className="grid gap-4">
          <Field label={t('referralLab')} required>
            <Select
              value={labId}
              onValueChange={setLabId}
              placeholder={t('referralLabPick')}
              options={labs.map((l) => ({
                value: l.id,
                label: l.name,
                description: `${t('referralLabMeta', {
                  city: l.city,
                  days: l.turnaroundDays,
                })} · ${l.nablAccredited ? t('nablAccredited') : t('notNabl')}`,
              }))}
            />
          </Field>
          {lab ? (
            <div className="grid gap-2 rounded-xl border border-line bg-surface-2/60 p-3.5 text-meta">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-fg">{lab.name}</span>
                <NablBadge accredited={lab.nablAccredited} />
              </div>
              <p className="text-fg-muted">
                {t('referralLabMeta', {
                  city: lab.city,
                  days: lab.turnaroundDays,
                })}
                {lab.certificateNo
                  ? ` · ${t('nablCertificate', { number: lab.certificateNo })}`
                  : ''}
              </p>
              <p className="text-fg-muted">{lab.contact}</p>
            </div>
          ) : null}
          {lab && !lab.nablAccredited ? (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-lg bg-warning-soft p-3 text-meta text-warning-text"
            >
              <ShieldAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
              {t('notNablWarning')}
            </p>
          ) : null}
          <Field
            label={t('courier')}
            hint={t('courierHint')}
            optionalLabel={tc('optional')}
          >
            <Input
              value={courier}
              onChange={(ev) => setCourier(ev.target.value)}
              autoComplete="off"
            />
          </Field>
        </div>
      )}
    </Dialog>
  )
}

/** Referral (send-out) state, and sending a specimen out. */
export function SampleSendOut({ sample }: { sample: SampleDetail }) {
  const t = useT('processing')
  const tc = useT('common')
  const e = useEnum()
  const f = useFormat()
  const [open, setOpen] = useState(false)
  const [externalRef, setExternalRef] = useState('')
  const sendOut = sample.sendOut
  const update = useLabMutation(
    (state: 'received' | 'resulted') =>
      labApi.samples.updateSendOut(
        sample.id,
        externalRef.trim()
          ? { state, externalRef: externalRef.trim() }
          : { state },
      ),
    {
      success: (_, state) =>
        t('sendOutUpdated', {
          accession: sample.accessionNo ?? '',
          state: e('sendOutState', state),
        }),
      onSuccess: () => setExternalRef(''),
    },
  )

  if (!sendOut)
    return canSendOut(sample) ? (
      <div className="grid gap-3 text-meta">
        <p className="text-fg-muted">{t('sendOutNone')}</p>
        <div>
          <GuardedButton
            permission="specimen.send-out"
            size="sm"
            variant="secondary"
            onClick={() => setOpen(true)}
          >
            <TruckIcon />
            {t('sendOut')}
          </GuardedButton>
        </div>
        {open ? (
          <SendOutDialog sample={sample} onClose={() => setOpen(false)} />
        ) : null}
      </div>
    ) : null

  const steps: TimelineEntry[] = [
    {
      id: 'dispatched',
      tone: 'success',
      icon: <TruckIcon />,
      title: e('sendOutState', 'dispatched'),
      meta: [
        f.dateTime(sendOut.dispatchedAt),
        sendOut.dispatchedBy,
        sendOut.courier,
      ]
        .filter(Boolean)
        .join(' · '),
    },
    {
      id: 'received',
      tone: sendOut.receivedAt ? 'success' : 'neutral',
      icon: <FlaskConicalIcon />,
      title: e('sendOutState', 'received'),
      meta: sendOut.receivedAt
        ? f.dateTime(sendOut.receivedAt)
        : sendOut.state === 'dispatched'
          ? t('notYet')
          : t('notRecorded'),
    },
    {
      id: 'resulted',
      tone: sendOut.resultedAt ? 'success' : 'neutral',
      icon: <CircleCheckIcon />,
      title: e('sendOutState', 'resulted'),
      meta: sendOut.resultedAt ? f.dateTime(sendOut.resultedAt) : t('notYet'),
    },
  ]

  return (
    <div className="grid gap-4 text-meta">
      <div className="grid gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-fg">{sendOut.labName}</span>
          <NablBadge accredited={sendOut.nablAccredited} />
        </div>
        <p className="text-fg-muted">
          {t('sendOutStateNow', { state: e('sendOutState', sendOut.state) })}
          {sendOut.externalRef
            ? ` · ${t('externalRefValue', { ref: sendOut.externalRef })}`
            : ''}
        </p>
      </div>
      <Timeline items={steps} />
      {sendOut.state !== 'resulted' ? (
        <div className="grid gap-3 border-t border-line pt-4">
          {sendOut.externalRef ? null : (
            <Field
              label={t('externalRef')}
              hint={t('externalRefHint')}
              optionalLabel={tc('optional')}
            >
              <Input
                value={externalRef}
                onChange={(ev) => setExternalRef(ev.target.value)}
                autoComplete="off"
                className="max-w-sm"
              />
            </Field>
          )}
          <div className="flex flex-wrap gap-2">
            {sendOut.state === 'dispatched' ? (
              <GuardedButton
                permission="specimen.send-out"
                size="sm"
                variant="primary"
                loading={update.isPending && update.variables === 'received'}
                onClick={() => update.mutate('received')}
              >
                <FlaskConicalIcon />
                {t('markAtLab')}
              </GuardedButton>
            ) : null}
            <GuardedButton
              permission="specimen.send-out"
              size="sm"
              variant={sendOut.state === 'dispatched' ? 'secondary' : 'primary'}
              loading={update.isPending && update.variables === 'resulted'}
              onClick={() => update.mutate('resulted')}
            >
              <CircleCheckIcon />
              {t('markResulted')}
            </GuardedButton>
          </div>
        </div>
      ) : null}
    </div>
  )
}
