import { CalculatorIcon, GaugeIcon } from 'lucide-react'
import type { InstrumentFlag } from '@/domain/types'
import { useEnum, useT } from '@/i18n/context'
import { cn } from '@/lib/cn'
import { Badge } from '@/components/ui/badge'

/** Flags the analyzer sent with a value (haemolysis, clot, linearity...). */
export function InstrumentFlagChips({
  flags,
  className,
}: {
  flags: readonly InstrumentFlag[] | undefined
  className?: string
}) {
  const t = useT('results')
  const e = useEnum()
  if (!flags?.length) return null
  return (
    <span className={cn('flex flex-wrap gap-1', className)}>
      {flags.map((flag) => (
        <Badge
          key={flag}
          tone="warning"
          size="sm"
          className="text-left font-medium whitespace-normal"
        >
          <GaugeIcon aria-hidden />
          <span className="sr-only">{t('instrumentFlag')}: </span>
          {e('instrumentFlag', flag)}
        </Badge>
      ))}
    </span>
  )
}

/** Marks a value the system computes from other results. */
export function CalculatedTag({ className }: { className?: string }) {
  const t = useT('results')
  return (
    <Badge tone="info" size="sm" className={cn('font-medium', className)}>
      <CalculatorIcon aria-hidden />
      {t('calculated')}
    </Badge>
  )
}
