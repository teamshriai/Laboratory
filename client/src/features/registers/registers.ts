// Registers: tabs, periods (a month or an IST day) and the plain-text table
// of each register, shared by the CSV export and the printout.

import { useCallback, useMemo } from 'react'
import { useLanguage } from '@/i18n/context'
import { INTL_LOCALE, type Params, type TKey } from '@/i18n/core'
import type { Formatter } from '@/i18n/format'
import type {
  CollectionRegisterRow,
  DailyResultRow,
  FormIIIRow,
  IqcRegisterRow,
} from '@/services/lab-api'
import type { useEnum } from '@/i18n/context'
import { ENCOUNTER_TYPES, type EncounterType } from '@/domain/types'

export const REGISTER_TABS = ['form-iii', 'daily', 'iqc', 'collection'] as const
export type RegisterTab = (typeof REGISTER_TABS)[number]

/** Form III and IQC cover a month; the others a day. */
export const MONTHLY: Record<RegisterTab, boolean> = {
  'form-iii': true,
  daily: false,
  iqc: true,
  collection: false,
}

export const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/
export const DAY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/

/** "2026-10" moved by whole months. */
export function shiftMonth(month: string, by: number) {
  const [y, m] = month.split('-').map(Number) as [number, number]
  const index = y * 12 + (m - 1) + by
  const year = Math.floor(index / 12)
  return `${String(year).padStart(4, '0')}-${String((index % 12) + 1).padStart(2, '0')}`
}

/** The last `count` months up to `latest`, newest first. */
export function recentMonths(latest: string, count: number) {
  return Array.from({ length: count }, (_, i) => shiftMonth(latest, -i))
}

/** "October 2026" in the reader's language. */
export function useMonthLabel() {
  const { language } = useLanguage()
  const format = useMemo(
    () =>
      new Intl.DateTimeFormat(INTL_LOCALE[language], {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
        numberingSystem: 'latn',
      }),
    [language],
  )
  return useCallback(
    (month: string) => {
      const [y, m] = month.split('-').map(Number) as [number, number]
      return format.format(Date.UTC(y, m - 1, 15))
    },
    [format],
  )
}

/** A register as text: the header row and one row per entry. */
export interface RegisterTable {
  headers: string[]
  rows: string[][]
}

export interface TableText {
  t: (key: TKey<'registers'>, params?: Params) => string
  e: ReturnType<typeof useEnum>
  f: Formatter
}

export function formIIITable(rows: FormIIIRow[], x: TableText): RegisterTable {
  const { t, e, f } = x
  return {
    headers: [
      t('colSerial'),
      t('colDate'),
      t('colLabNo'),
      t('colPatientName'),
      t('colAge'),
      t('colSex'),
      t('colAddress'),
      t('colReferredBy'),
      t('colDiagnosis'),
      t('colInvestigation'),
      t('colSpecimen'),
      t('colMethod'),
      t('colResult'),
      t('colInitials'),
    ],
    rows: rows.map((r) => [
      String(r.serialNo),
      f.date(r.date),
      r.labNo,
      r.patientName,
      String(Math.floor(r.age)),
      e('sex', r.sex),
      r.address,
      r.referredBy,
      r.provisionalDiagnosis,
      r.investigation,
      e('specimen', r.specimen),
      r.methodEquipment,
      r.result,
      r.initials,
    ]),
  }
}

export function dailyTable(rows: DailyResultRow[], x: TableText) {
  const { t, f } = x
  return {
    headers: [
      t('colTime'),
      t('colLabNo'),
      t('colPatientName'),
      t('colInvestigation'),
      t('colResult'),
      t('colFlag'),
      t('colAuthorisedBy'),
    ],
    rows: rows.map((r) => [
      f.time(r.at),
      r.labNo,
      r.patientName,
      r.investigation,
      r.result,
      r.abnormal ? t('abnormal') : '',
      r.authorisedBy,
    ]),
  } satisfies RegisterTable
}

export function iqcTable(rows: IqcRegisterRow[], x: TableText) {
  const { t, e, f } = x
  return {
    headers: [
      t('colDateTime'),
      t('colEquipment'),
      t('colAnalyte'),
      t('colLevel'),
      t('colLot'),
      t('colValue'),
      t('colMean'),
      t('colSd'),
      t('colOutcome'),
      t('colRule'),
      t('colRunBy'),
      t('colAction'),
    ],
    rows: rows.map((r) => [
      f.dateTime(r.at),
      r.equipmentName,
      r.analyteName,
      r.level,
      r.controlLot,
      String(r.value),
      String(r.mean),
      String(r.sd),
      e('qcResult', r.result),
      r.rule ?? '',
      r.byName,
      r.correctiveAction ?? '',
    ]),
  } satisfies RegisterTable
}

/** A ward name as recorded, or the encounter type in words. */
export function locationText(location: string, e: ReturnType<typeof useEnum>) {
  return (ENCOUNTER_TYPES as readonly string[]).includes(location)
    ? e('encounter', location as EncounterType)
    : location
}

export function collectionTable(rows: CollectionRegisterRow[], x: TableText) {
  const { t, e, f } = x
  return {
    headers: [
      t('colTime'),
      t('colLabNo'),
      t('colPatientName'),
      t('colSpecimen'),
      t('colContainer'),
      t('colCollectedBy'),
      t('colLocation'),
      t('colStatus'),
    ],
    rows: rows.map((r) => [
      f.time(r.at),
      r.labNo,
      r.patientName,
      e('specimen', r.specimen),
      e('container', r.container),
      r.collectedBy,
      locationText(r.location, e),
      r.rejected ? t('rejected') : '',
    ]),
  } satisfies RegisterTable
}
