import {
  ArrowDownIcon,
  ArrowUpIcon,
  OctagonAlertIcon,
  CirclePlusIcon,
} from 'lucide-react'
import { formatRange } from '@/domain/reference-ranges'
import type { Analyte, Flag, RangeSnapshot } from '@/domain/types'
import { useEnum, useT } from '@/i18n/context'
import { cn } from '@/lib/cn'
import { Badge } from '../ui/badge'

export function ResultFlag({
  flag,
  critical,
  variant = 'full',
  className,
}: {
  flag: Flag | null | undefined
  critical?: boolean
  variant?: 'full' | 'short'
  className?: string
}) {
  const e = useEnum()
  if (!flag || flag === 'NORMAL' || flag === 'NEGATIVE') {
    if (variant === 'short' || !flag) return null
    return (
      <span className={cn('text-xs text-fg-subtle', className)}>
        {e('flag', flag)}
      </span>
    )
  }
  const label = variant === 'short' ? e('flagShort', flag) : e('flag', flag)
  if (flag === 'CRITICAL_LOW' || flag === 'CRITICAL_HIGH' || critical)
    return (
      <Badge
        tone="solidDanger"
        size={variant === 'short' ? 'sm' : 'md'}
        className={className}
      >
        <OctagonAlertIcon strokeWidth={2.2} />
        {label}
      </Badge>
    )
  const icon =
    flag === 'LOW' ? (
      <ArrowDownIcon strokeWidth={2.5} />
    ) : flag === 'HIGH' ? (
      <ArrowUpIcon strokeWidth={2.5} />
    ) : (
      <CirclePlusIcon strokeWidth={2.5} />
    )
  return (
    <Badge
      tone="warning"
      size={variant === 'short' ? 'sm' : 'md'}
      className={className}
    >
      {icon}
      {label}
    </Badge>
  )
}

/** Displays a stored result value in words (posneg, antibiogram) or as entered. */
export function useResultText() {
  const e = useEnum()
  const t = useT('common')
  return (
    value: string | null | undefined,
    analyte: Pick<Analyte, 'resultType' | 'posnegStyle'>,
  ) => {
    if (value === null || value === undefined || value === '')
      return t('noValue')
    if (analyte.resultType === 'posneg') {
      const style = analyte.posnegStyle ?? 'positive'
      const v = value === 'positive' ? 'positive' : 'negative'
      if (style === 'reactive') return e('reactive', v)
      if (style === 'detected') return e('detected', v)
      return e('posneg', v)
    }
    if (analyte.resultType === 'antibiogram') {
      try {
        const parsed = JSON.parse(value) as Record<string, string>
        const resistant = Object.entries(parsed)
          .filter(([, v]) => v === 'R')
          .map(([k]) => k)
        return resistant.length ? `R: ${resistant.join(', ')}` : 'S'
      } catch {
        return value
      }
    }
    return value
  }
}

export function RangeText({
  range,
  analyte,
  className,
}: {
  range: RangeSnapshot | null | undefined
  analyte?: Pick<
    Analyte,
    'resultType' | 'decimals' | 'normalOptions' | 'posnegStyle'
  >
  className?: string
}) {
  const t = useT('common')
  const e = useEnum()
  const text = (() => {
    if (analyte?.resultType === 'posneg') {
      const style = analyte.posnegStyle ?? 'positive'
      return style === 'reactive'
        ? e('reactive', 'negative')
        : style === 'detected'
          ? e('detected', 'negative')
          : e('posneg', 'negative')
    }
    if (analyte?.resultType === 'select')
      return analyte.normalOptions?.join(', ') ?? null
    return formatRange(range, analyte?.decimals)
  })()
  return (
    <span
      className={cn(
        'text-fg-muted tabular-nums',
        !text && 'text-fg-subtle',
        className,
      )}
    >
      {text ?? t('noRange')}
    </span>
  )
}

export function valueTone(flag: Flag | null | undefined, critical?: boolean) {
  if (critical || flag === 'CRITICAL_HIGH' || flag === 'CRITICAL_LOW')
    return 'font-semibold text-danger-text'
  if (
    flag === 'LOW' ||
    flag === 'HIGH' ||
    flag === 'ABNORMAL' ||
    flag === 'POSITIVE'
  )
    return 'font-semibold text-warning-text'
  return 'text-fg'
}
