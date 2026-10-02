import { Link } from 'react-router'
import { RecordLink } from './record-link'
import { ageFromDob } from '@/domain/time'
import type { Sex } from '@/domain/types'
import { useNow } from '@/hooks/use-now'
import { useEnum, useT } from '@/i18n/context'
import { cn } from '@/lib/cn'
import type { PatientSummary } from '@/services/lab-api'
import { Avatar } from '../ui/misc'

export function useAgeText() {
  const now = useNow()
  const t = useT('common')
  return (dob: string) => {
    const age = ageFromDob(dob, now)
    if (age.years >= 2) return t('ageYears', { years: age.years })
    if (age.years >= 1 || age.months >= 1)
      return t('ageMonths', { months: age.years * 12 + age.months })
    return t('ageDays', { days: age.days })
  }
}

export function AgeSex({
  dob,
  sex,
  className,
}: {
  dob: string
  sex: Sex
  className?: string
}) {
  const age = useAgeText()
  const e = useEnum()
  return (
    <span className={cn('whitespace-nowrap tabular-nums', className)}>
      {age(dob)} / {e('sexShort', sex)}
    </span>
  )
}

/** Avatar, name and identifiers for tables and lists. */
export function PatientCell({
  patient,
  link = true,
  showLocal = true,
  size = 'md',
  avatar = true,
  className,
}: {
  patient: Pick<
    PatientSummary,
    'id' | 'name' | 'uhid' | 'dob' | 'sex' | 'nameLocal'
  >
  link?: boolean
  showLocal?: boolean
  size?: 'sm' | 'md'
  avatar?: boolean
  className?: string
}) {
  const name = link ? (
    <Link
      to={`/patients/${patient.id}`}
      onClick={(e) => e.stopPropagation()}
      className="truncate py-0.5 font-medium text-fg hover:text-accent-text hover:underline hover:underline-offset-2"
    >
      {patient.name}
    </Link>
  ) : (
    <span className="truncate font-medium text-fg">{patient.name}</span>
  )
  return (
    <div className={cn('flex min-w-0 items-center gap-3', className)}>
      {avatar ? (
        <Avatar name={patient.name} size={size === 'sm' ? 'sm' : 'md'} />
      ) : null}
      <div className="min-w-0">
        <div className="flex min-w-0 items-baseline gap-2">
          {name}
          {showLocal && patient.nameLocal ? (
            <span
              lang={patient.nameLocal.lang}
              className="hidden truncate text-xs text-fg-subtle xl:inline"
            >
              {patient.nameLocal.text}
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-x-1.5 text-xs text-fg-muted">
          {link ? (
            <RecordLink
              kind="patient"
              id={patient.id}
              className="tracking-tight whitespace-nowrap"
            >
              {patient.uhid}
            </RecordLink>
          ) : (
            <span className="font-mono tracking-tight whitespace-nowrap">
              {patient.uhid}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <span aria-hidden className="text-fg-subtle">
              /
            </span>
            <AgeSex dob={patient.dob} sex={patient.sex} />
          </span>
        </div>
      </div>
    </div>
  )
}
