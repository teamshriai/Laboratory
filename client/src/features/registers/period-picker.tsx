import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { DAY, istDay } from '@/domain/time'
import { useT } from '@/i18n/context'
import { fromDateInput } from '@/lib/date-input'
import { IconButton } from '@/components/ui/icon-button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import {
  DAY_PATTERN,
  recentMonths,
  shiftMonth,
  useMonthLabel,
} from './registers'

/** Months to offer in the list; older ones are reached with the arrows. */
const MONTHS_LISTED = 36

/** A month (YYYY-MM), never later than `latest`. */
export function MonthPicker({
  value,
  latest,
  onChange,
}: {
  value: string
  latest: string
  onChange: (month: string) => void
}) {
  const t = useT('registers')
  const monthLabel = useMonthLabel()
  const months = recentMonths(latest, MONTHS_LISTED)
  const options = (months.includes(value) ? months : [...months, value]).map(
    (m) => ({ value: m, label: monthLabel(m) }),
  )
  return (
    <div className="flex items-center gap-1">
      <IconButton
        label={t('previousMonth')}
        icon={<ChevronLeftIcon />}
        size="icon"
        onClick={() => onChange(shiftMonth(value, -1))}
      />
      <Select
        aria-label={t('chooseMonth')}
        value={value}
        onValueChange={onChange}
        options={options}
        className="w-44"
      />
      <IconButton
        label={t('nextMonth')}
        icon={<ChevronRightIcon />}
        size="icon"
        disabled={value >= latest}
        onClick={() => onChange(shiftMonth(value, 1))}
      />
    </div>
  )
}

/** An IST day (YYYY-MM-DD), never later than `latest`. */
export function DayPicker({
  value,
  latest,
  onChange,
}: {
  value: string
  latest: string
  onChange: (day: string) => void
}) {
  const t = useT('registers')
  const shift = (days: number) => {
    const next = istDay(fromDateInput(value) + days * DAY)
    if (next <= latest) onChange(next)
  }
  return (
    <div className="flex items-center gap-1">
      <IconButton
        label={t('previousDay')}
        icon={<ChevronLeftIcon />}
        size="icon"
        onClick={() => shift(-1)}
      />
      <Input
        type="date"
        aria-label={t('chooseDay')}
        value={value}
        max={latest}
        onChange={(ev) => {
          const v = ev.target.value
          if (DAY_PATTERN.test(v) && v <= latest) onChange(v)
        }}
        className="w-44"
      />
      <IconButton
        label={t('nextDay')}
        icon={<ChevronRightIcon />}
        size="icon"
        disabled={value >= latest}
        onClick={() => shift(1)}
      />
    </div>
  )
}
