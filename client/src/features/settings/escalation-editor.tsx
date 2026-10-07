import { PlusIcon, Trash2Icon } from 'lucide-react'
import { ESCALATION_TARGETS } from '@/domain/types'
import { useEnum, useT } from '@/i18n/context'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { IconButton } from '@/components/ui/icon-button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import {
  ESCALATION_MAX,
  ESCALATION_MIN,
  MAX_TIERS,
  escalationErrors,
  nextTier,
  type EscalationTier,
} from './escalation'

/** Critical value escalation tiers: after N minutes, escalate to someone. */
export function EscalationEditor({
  tiers,
  onChange,
  showErrors,
  className,
}: {
  tiers: EscalationTier[]
  onChange: (tiers: EscalationTier[]) => void
  showErrors: boolean
  className?: string
}) {
  const t = useT('settings')
  const e = useEnum()
  const errors = escalationErrors(tiers)
  const update = (i: number, patch: Partial<EscalationTier>) =>
    onChange(tiers.map((tier, j) => (j === i ? { ...tier, ...patch } : tier)))
  const last = tiers.at(-1)
  const canAdd =
    tiers.length < MAX_TIERS && (!last || last.afterMin < ESCALATION_MAX)
  return (
    <fieldset className={cn('min-w-0', className)}>
      <legend className="text-sm font-medium text-fg">
        {t('escalationTitle')}
      </legend>
      <p className="mt-0.5 text-xs text-fg-muted">{t('escalationHint')}</p>
      {tiers.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-line-strong px-3 py-2.5 text-meta text-fg-muted">
          {t('escalationEmpty')}
        </p>
      ) : (
        <ol className="mt-3 grid gap-3">
          {tiers.map((tier, i) => {
            const error = errors[i]
            return (
              <li
                key={i}
                className="flex flex-wrap items-start gap-x-3 gap-y-2 rounded-lg border border-line p-3"
              >
                <p className="w-full text-xs font-semibold text-fg-muted">
                  {t('escalationTier', { n: i + 1 })}
                </p>
                <Field
                  label={t('escalationAfter')}
                  error={showErrors && error ? t(error) : undefined}
                  className="w-40 min-w-0"
                >
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={ESCALATION_MIN}
                    max={ESCALATION_MAX}
                    step={1}
                    value={
                      Number.isFinite(tier.afterMin)
                        ? String(tier.afterMin)
                        : ''
                    }
                    onChange={(ev) =>
                      update(i, {
                        afterMin:
                          ev.target.value === ''
                            ? Number.NaN
                            : Number(ev.target.value),
                      })
                    }
                  />
                </Field>
                <Field
                  label={t('escalationTo')}
                  className="min-w-0 flex-1 basis-44"
                >
                  <Select
                    value={tier.to}
                    onValueChange={(to) => update(i, { to })}
                    options={ESCALATION_TARGETS.map((target) => ({
                      value: target,
                      label: e('escalationTarget', target),
                    }))}
                  />
                </Field>
                <IconButton
                  label={t('escalationRemove', { n: i + 1 })}
                  icon={<Trash2Icon />}
                  size="icon"
                  className="mt-6"
                  onClick={() => onChange(tiers.filter((_, j) => j !== i))}
                />
              </li>
            )
          })}
        </ol>
      )}
      <Button
        size="sm"
        className="mt-3"
        disabled={!canAdd}
        onClick={() => onChange([...tiers, nextTier(tiers)])}
      >
        <PlusIcon className="size-4" aria-hidden />
        {t('escalationAdd')}
      </Button>
    </fieldset>
  )
}
