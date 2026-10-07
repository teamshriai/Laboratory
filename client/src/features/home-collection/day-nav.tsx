import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { useT } from '@/i18n/context'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { Input } from '@/components/ui/input'
import { isDayKey, shiftDay } from './day'

/** Previous / next / today, and a date field for any other day. */
export function DayNav({
  day,
  today,
  onChange,
}: {
  day: string
  today: string
  onChange: (day: string) => void
}) {
  const t = useT('homeCollection')
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <IconButton
        size="icon"
        variant="secondary"
        label={t('previousDay')}
        icon={<ChevronLeftIcon />}
        onClick={() => onChange(shiftDay(day, -1))}
      />
      <Input
        type="date"
        aria-label={t('pickDay')}
        value={day}
        onChange={(ev) => {
          if (isDayKey(ev.target.value)) onChange(ev.target.value)
        }}
        className="w-40"
      />
      <IconButton
        size="icon"
        variant="secondary"
        label={t('nextDay')}
        icon={<ChevronRightIcon />}
        onClick={() => onChange(shiftDay(day, 1))}
      />
      <Button
        variant="secondary"
        disabled={day === today}
        onClick={() => onChange(today)}
      >
        {t('today')}
      </Button>
    </div>
  )
}
