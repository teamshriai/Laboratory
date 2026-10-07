import {
  BadgeCheckIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  CircleDotIcon,
  CircleIcon,
  CircleMinusIcon,
  CircleXIcon,
  ClockAlertIcon,
  FilePenLineIcon,
  OctagonAlertIcon,
  SearchIcon,
  ShieldCheckIcon,
  TriangleAlertIcon,
  WrenchIcon,
  type LucideIcon,
} from 'lucide-react'
import type { RiskLevel } from '@/domain/quality'
import type {
  EqaOutcome,
  NcSeverity,
  NcState,
  RiskState,
  RuleState,
} from '@/domain/types'
import { useT } from '@/i18n/context'
import { cn } from '@/lib/cn'
import { Badge, type BadgeTone } from '@/components/ui/badge'
import { RISK_TONE } from './quality'

const NC_STATE: Record<NcState, { tone: BadgeTone; icon: LucideIcon }> = {
  open: { tone: 'warning', icon: CircleDotIcon },
  investigating: { tone: 'info', icon: SearchIcon },
  action: { tone: 'accent', icon: WrenchIcon },
  verifying: { tone: 'info', icon: ShieldCheckIcon },
  closed: { tone: 'success', icon: CircleCheckIcon },
}

export function NcStateBadge({ state }: { state: NcState }) {
  const t = useT('quality')
  const { tone, icon: Icon } = NC_STATE[state]
  return (
    <Badge tone={tone} size="sm">
      <Icon aria-hidden />
      {t(`ncState.${state}`)}
    </Badge>
  )
}

const SEVERITY: Record<NcSeverity, { className: string; icon: LucideIcon }> = {
  minor: { className: 'text-fg-muted', icon: CircleIcon },
  major: { className: 'text-warning-text', icon: TriangleAlertIcon },
  critical: { className: 'text-danger-text', icon: OctagonAlertIcon },
}

/** Severity as text with an icon (not a badge: rows keep two badges at most). */
export function SeverityText({ severity }: { severity: NcSeverity }) {
  const t = useT('quality')
  const { className, icon: Icon } = SEVERITY[severity]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-meta font-medium whitespace-nowrap',
        className,
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {t(`ncSeverity.${severity}`)}
    </span>
  )
}

const OUTCOME: Record<EqaOutcome, { tone: BadgeTone; icon: LucideIcon }> = {
  acceptable: { tone: 'success', icon: CircleCheckIcon },
  warning: { tone: 'warning', icon: TriangleAlertIcon },
  unacceptable: { tone: 'danger', icon: CircleXIcon },
}

export function EqaOutcomeBadge({ outcome }: { outcome: EqaOutcome }) {
  const t = useT('quality')
  const { tone, icon: Icon } = OUTCOME[outcome]
  return (
    <Badge tone={tone} size="sm">
      <Icon aria-hidden />
      {t(`eqaOutcome.${outcome}`)}
    </Badge>
  )
}

const LEVEL_ICON: Record<RiskLevel, LucideIcon> = {
  low: CircleCheckIcon,
  medium: CircleAlertIcon,
  high: TriangleAlertIcon,
  extreme: OctagonAlertIcon,
}

export function RiskLevelBadge({ level }: { level: RiskLevel }) {
  const t = useT('quality')
  const Icon = LEVEL_ICON[level]
  return (
    <Badge
      tone={RISK_TONE[level]}
      size="sm"
      className={cn(level === 'extreme' && 'border-danger-text/60')}
    >
      <Icon aria-hidden />
      {t(`riskLevel.${level}`)}
    </Badge>
  )
}

const RISK_STATE: Record<RiskState, { className: string; icon: LucideIcon }> = {
  open: { className: 'text-warning-text', icon: CircleDotIcon },
  treated: { className: 'text-info-text', icon: WrenchIcon },
  accepted: { className: 'text-fg-muted', icon: CircleCheckIcon },
  closed: { className: 'text-fg-subtle', icon: CircleMinusIcon },
}

export function RiskStateText({ state }: { state: RiskState }) {
  const t = useT('quality')
  const { className, icon: Icon } = RISK_STATE[state]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-meta font-medium whitespace-nowrap',
        className,
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {t(`riskState.${state}`)}
    </span>
  )
}

const RULE_STATE: Record<RuleState, { tone: BadgeTone; icon: LucideIcon }> = {
  draft: { tone: 'warning', icon: FilePenLineIcon },
  approved: { tone: 'success', icon: BadgeCheckIcon },
  retired: { tone: 'neutral', icon: CircleMinusIcon },
}

export function RuleStateBadge({ state }: { state: RuleState }) {
  const t = useT('quality')
  const { tone, icon: Icon } = RULE_STATE[state]
  return (
    <Badge tone={tone} size="sm">
      <Icon aria-hidden />
      {t(`ruleState.${state}`)}
    </Badge>
  )
}

/** "Overdue" as text with an icon, for due-date cells. */
export function OverdueText({ label }: { label?: string }) {
  const t = useT('quality')
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold whitespace-nowrap text-danger-text">
      <ClockAlertIcon className="size-3.5 shrink-0" aria-hidden />
      {label ?? t('overdue')}
    </span>
  )
}
