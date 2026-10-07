import { CalendarClockIcon, ShieldAlertIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import {
  CONSENT_METHODS,
  LANGUAGES,
  type ConsentMethod,
  type Language,
} from '@/domain/types'
import { useNow } from '@/hooks/use-now'
import { useEnum, useLanguage, useT } from '@/i18n/context'
import { LANGUAGE_NAMES } from '@/i18n/core'
import { useFormat } from '@/i18n/format'
import { cn } from '@/lib/cn'
import { labApi, type SampleRow } from '@/services/lab-api'
import { useLabMutation } from '@/services/mutations'
import { GuardedButton } from '@/components/lab/guarded-button'
import { TubeDot } from '@/components/lab/sample'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/toggles'

const IST = 330 * 60_000
const toLocalInput = (ms: number) =>
  new Date(ms + IST).toISOString().slice(0, 16)
const fromLocalInput = (value: string) => Date.parse(`${value}:00Z`) - IST

/**
 * Tests that need consent (HIV counselling, invasive procedures) are not
 * collected until the patient's consent is on record. A refusal is
 * recorded too, and the specimen is then not collected.
 */
export function ConsentPanel({ sample }: { sample: SampleRow }) {
  const t = useT('collection')
  const e = useEnum()
  const { language } = useLanguage()
  const now = useNow()
  const [method, setMethod] = useState<ConsentMethod>('written')
  const [lang, setLang] = useState<Language>(
    sample.patient.preferredLanguage ?? language,
  )
  const [witness, setWitness] = useState('')
  const [agreed, setAgreed] = useState(false)
  const tests = sample.consentMissing.map((m) => m.testName).join(', ')
  const record = useLabMutation(
    (status: 'granted' | 'refused') =>
      labApi.patients.recordConsent(sample.patient.id, {
        purpose: 'test-procedure',
        status,
        method,
        language: lang,
        at: now,
        orderItemIds: sample.consentMissing.map((m) => m.itemId),
        ...(witness.trim() ? { witness: witness.trim() } : {}),
      }),
    {
      success: (_, status) =>
        status === 'granted' ? t('consentRecorded') : null,
      onSuccess: (_, status) => {
        if (status === 'refused') toast.warning(t('consentRefusedToast'))
      },
    },
  )
  const needsWitness = method === 'verbal-witnessed'
  const witnessOk = !needsWitness || witness.trim().includes(' ')
  return (
    <section
      aria-labelledby="consent-title"
      className="grid gap-3 rounded-xl border border-warning-text/30 bg-warning-soft/60 p-4"
    >
      <div className="flex items-start gap-2.5">
        <ShieldAlertIcon
          className="mt-0.5 size-4 shrink-0 text-warning-text"
          aria-hidden
        />
        <div>
          <h3 id="consent-title" className="text-sm font-semibold text-fg">
            {t('consentTitle')}
          </h3>
          <p className="text-meta text-fg-muted">
            {t('consentBody', { tests })}
          </p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('consentMethod')} required>
          <Select
            value={method}
            onValueChange={setMethod}
            options={CONSENT_METHODS.map((m) => ({
              value: m,
              label: e('consentMethod', m),
            }))}
          />
        </Field>
        <Field label={t('consentLanguage')} required>
          <Select
            value={lang}
            onValueChange={setLang}
            options={LANGUAGES.map((l) => ({
              value: l,
              label: LANGUAGE_NAMES[l],
            }))}
          />
        </Field>
        {needsWitness ? (
          <Field label={t('consentWitness')} required className="sm:col-span-2">
            <Input
              value={witness}
              onChange={(ev) => setWitness(ev.target.value)}
              autoComplete="off"
            />
          </Field>
        ) : null}
      </div>
      <Checkbox
        checked={agreed}
        onCheckedChange={setAgreed}
        label={t('consentAgree')}
      />
      <div className="flex flex-wrap gap-2">
        <GuardedButton
          permission="consent.record"
          variant="primary"
          disabled={!agreed || !witnessOk}
          loading={record.isPending && record.variables === 'granted'}
          onClick={() => record.mutate('granted')}
        >
          {t('recordConsent')}
        </GuardedButton>
        <GuardedButton
          permission="consent.record"
          variant="ghost"
          disabled={!witnessOk}
          loading={record.isPending && record.variables === 'refused'}
          onClick={() => record.mutate('refused')}
        >
          {t('consentRefused')}
        </GuardedButton>
      </div>
    </section>
  )
}

/** The patient's tubes due now, in the order to fill them (CLSI GP41). */
export function DrawOrder({ sample }: { sample: SampleRow }) {
  const t = useT('collection')
  const e = useEnum()
  if (sample.drawOrder.length < 2) return null
  return (
    <section aria-labelledby="draw-order-title">
      <h3
        id="draw-order-title"
        className="mb-1 text-xs font-semibold tracking-wide text-fg-subtle uppercase"
      >
        {t('drawOrderTitle')}
      </h3>
      <p className="mb-2 text-xs text-fg-muted">{t('drawOrderHint')}</p>
      <ol className="grid gap-1">
        {sample.drawOrder.map((tube, i) => {
          const self = tube.id === sample.id
          return (
            <li
              key={tube.id}
              aria-current={self ? 'step' : undefined}
              className={cn(
                'flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-meta',
                self ? 'bg-accent-soft font-semibold text-fg' : 'text-fg-muted',
              )}
            >
              <span className="w-5 text-right tabular-nums">{i + 1}</span>
              <TubeDot container={tube.container} className="size-3" />
              <span className="flex-1">{e('container', tube.container)}</span>
              {tube.accessionNo ? (
                <span className="font-mono text-xs">{tube.accessionNo}</span>
              ) : null}
              {self ? (
                <span className="text-xs text-accent-text">
                  {t('drawThis')}
                </span>
              ) : null}
            </li>
          )
        })}
      </ol>
    </section>
  )
}

/** Shown when the collection was deliberately deferred. */
export function ScheduledNotice({ sample }: { sample: SampleRow }) {
  const t = useT('collection')
  const f = useFormat()
  const now = useNow()
  if (sample.scheduledFor === undefined || sample.scheduledFor <= now)
    return null
  return (
    <p className="flex items-start gap-2.5 rounded-xl border border-info/25 bg-info-soft/50 p-3 text-meta text-info-text">
      <CalendarClockIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
      {t('scheduledNotice', {
        time: f.time(sample.scheduledFor),
        reason: sample.scheduleReason ?? '',
      })}
    </p>
  )
}

/** Defers the collection to a later time, with the reason. */
export function DeferDialog({
  sample,
  open,
  onOpenChange,
}: {
  sample: SampleRow
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useT('collection')
  const tc = useT('common')
  const f = useFormat()
  const now = useNow()
  const [at, setAt] = useState(() => toLocalInput(now + 2 * 3_600_000))
  const [reason, setReason] = useState('')
  const when = at ? fromLocalInput(at) : NaN
  const valid = Number.isFinite(when) && when > now && reason.trim().length > 0
  const defer = useLabMutation(
    () => labApi.samples.schedule(sample.id, { at: when, reason }),
    {
      success: () => t('deferred', { time: f.dateTime(when) }),
      onSuccess: () => onOpenChange(false),
    },
  )
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="sm"
      title={t('deferTitle')}
      dirty={reason.trim().length > 0}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {tc('cancel')}
          </Button>
          <Button
            variant="primary"
            disabled={!valid}
            loading={defer.isPending}
            onClick={() => defer.mutate(undefined)}
          >
            {t('collectLater')}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Field label={t('deferAt')} required>
          <Input
            type="datetime-local"
            value={at}
            min={toLocalInput(now)}
            onChange={(ev) => setAt(ev.target.value)}
          />
        </Field>
        <Field label={t('deferReason')} hint={t('deferReasonHint')} required>
          <Input value={reason} onChange={(ev) => setReason(ev.target.value)} />
        </Field>
      </div>
    </Dialog>
  )
}
