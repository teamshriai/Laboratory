import {
  BookMarkedIcon,
  FlaskConicalIcon,
  ShieldCheckIcon,
  SyringeIcon,
} from 'lucide-react'
import { istDay } from '@/domain/time'
import { useNow } from '@/hooks/use-now'
import { useUrlFilters } from '@/hooks/use-search-param'
import { useT } from '@/i18n/context'
import { useFormat } from '@/i18n/format'
import { fromDateInput } from '@/lib/date-input'
import { PageHeader } from '@/app/layout/page-header'
import { Tabs, TabsContent, TabsList } from '@/components/ui/tabs'
import { DayPicker, MonthPicker } from './period-picker'
import {
  CollectionPanel,
  DailyPanel,
  FormIIIPanel,
  IqcPanel,
  type Period,
} from './register-panels'
import {
  DAY_PATTERN,
  MONTH_PATTERN,
  MONTHLY,
  REGISTER_TABS,
  useMonthLabel,
  type RegisterTab,
} from './registers'

export function Component() {
  const t = useT('registers')
  const f = useFormat()
  const monthLabel = useMonthLabel()
  const now = useNow()
  const today = istDay(now)
  const thisMonth = today.slice(0, 7)
  const url = useUrlFilters(
    { tab: 'form-iii', month: '', day: '' },
    { tab: REGISTER_TABS },
  )
  const tab = url.values.tab as RegisterTab
  // Hand-edited or future periods fall back on the current one.
  const month =
    MONTH_PATTERN.test(url.values.month) && url.values.month <= thisMonth
      ? url.values.month
      : thisMonth
  const day =
    DAY_PATTERN.test(url.values.day) && url.values.day <= today
      ? url.values.day
      : today

  const period: Period = MONTHLY[tab]
    ? {
        value: month,
        label: monthLabel(month),
        picker: (
          <MonthPicker
            value={month}
            latest={thisMonth}
            onChange={(m) => url.set({ month: m === thisMonth ? '' : m })}
          />
        ),
      }
    : {
        value: day,
        label: f.date(fromDateInput(day)),
        picker: (
          <DayPicker
            value={day}
            latest={today}
            onChange={(d) => url.set({ day: d === today ? '' : d })}
          />
        ),
      }

  return (
    <>
      <PageHeader title={t('title')} meta={<span>{t('pageMeta')}</span>} />
      <Tabs value={tab} onValueChange={(v) => url.set({ tab: v })}>
        <TabsList
          className="mb-5"
          items={[
            {
              value: 'form-iii',
              label: t('tabFormIii'),
              icon: <BookMarkedIcon />,
            },
            {
              value: 'daily',
              label: t('tabDaily'),
              icon: <ShieldCheckIcon />,
            },
            { value: 'iqc', label: t('tabIqc'), icon: <FlaskConicalIcon /> },
            {
              value: 'collection',
              label: t('tabCollection'),
              icon: <SyringeIcon />,
            },
          ]}
        />
        <TabsContent value="form-iii">
          <FormIIIPanel period={period} />
        </TabsContent>
        <TabsContent value="daily">
          <DailyPanel period={period} />
        </TabsContent>
        <TabsContent value="iqc">
          <IqcPanel period={period} />
        </TabsContent>
        <TabsContent value="collection">
          <CollectionPanel period={period} />
        </TabsContent>
      </Tabs>
    </>
  )
}
