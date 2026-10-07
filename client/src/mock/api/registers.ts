// Statutory registers (Tamil Nadu Clinical Establishments Rules 2018,
// Annexure-I Part VIII): Form III "Register of Laboratory Test Conducted"
// for a month, and the daily results, IQC and specimen collection
// registers. Kept electronically, each is printed monthly and signed.

import { ageInYears, istDay } from '@/domain/time'
import { isAbnormal } from '@/domain/flags'
import { LabApiError } from '../engine/core'
import { paginate } from './paging'
import { read } from './runtime'
import type {
  CollectionRegisterRow,
  DailyResultRow,
  FormIIIRow,
  IqcRegisterRow,
  PageQuery,
  RegisterResult,
} from './types'
import { staffName } from './views'
import type { LabDb } from '../db/schema'
import type { DbIndex } from './index-cache'
import type { OrderItem } from '@/domain/types'

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/
const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/

function checkMonth(month: string) {
  if (!MONTH.test(month))
    throw new LabApiError('validation-failed', { field: 'month' })
}
function checkDay(day: string) {
  if (!DAY_KEY.test(day))
    throw new LabApiError('validation-failed', { field: 'day' })
}

const initials = (name: string) =>
  name
    .replace(/^Dr\.?\s+/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase())
    .join('')

/** "Haemoglobin 13.2 g/dL; WBC 7.8 ..." for the register. */
function resultSummary(db: LabDb, index: DbIndex, item: OrderItem) {
  return (index.resultsByItem.get(item.id) ?? [])
    .filter((r) => r.value !== null)
    .map((r) => {
      const name = db.analytes[r.analyteId]?.name ?? r.analyteId
      return `${name} ${r.value}${r.unit ? ` ${r.unit}` : ''}`
    })
    .join('; ')
}

function validatedIn(db: LabDb, test: (at: number) => boolean) {
  return Object.values(db.items)
    .filter(
      (i) =>
        i.status === 'validated' &&
        i.active &&
        i.validatedAt !== undefined &&
        test(i.validatedAt),
    )
    .toSorted((a, b) => a.validatedAt! - b.validatedAt!)
}

export const registersApi = {
  /** Form III for one month (YYYY-MM): every test authorised that month. */
  formIII: (month: string, query: PageQuery = {}) =>
    read((db, { index }): RegisterResult<FormIIIRow> => {
      checkMonth(month)
      const items = validatedIn(db, (at) => istDay(at).startsWith(month))
      const rows = items.flatMap((item, i): FormIIIRow[] => {
        const order = db.orders[item.orderId]
        const patient = order ? db.patients[order.patientId] : undefined
        const sample = item.sampleId ? db.samples[item.sampleId] : undefined
        if (!order || !patient) return []
        const test = db.tests[item.testId]
        const equipment = sample?.equipmentId
          ? db.equipment[sample.equipmentId]
          : undefined
        const method = test?.method ?? ''
        return [
          {
            serialNo: i + 1,
            date: item.validatedAt!,
            labNo: sample?.accessionNo ?? order.orderNo ?? order.id,
            ...(sample ? { sampleId: sample.id } : {}),
            patientName: patient.name,
            age: Math.floor(ageInYears(patient.dob, item.validatedAt!)),
            sex: patient.sex,
            address: [patient.city, patient.state].filter(Boolean).join(', '),
            referredBy: db.doctors[order.doctorId]?.name ?? '',
            provisionalDiagnosis: order.clinicalNotes,
            investigation: item.testName,
            specimen: sample?.specimen ?? test?.specimen ?? 'blood',
            methodEquipment: [method, equipment?.name ?? 'Manual']
              .filter(Boolean)
              .join(' / '),
            result: resultSummary(db, index, item),
            initials: item.validatedBy
              ? initials(staffName(db, item.validatedBy))
              : '',
            ...(item.reportId ? { reportId: item.reportId } : {}),
            patientId: patient.id,
          },
        ]
      })
      return { ...paginate(rows, query, {}), period: month }
    }),

  /** Daily results register (YYYY-MM-DD). */
  daily: (day: string, query: PageQuery = {}) =>
    read((db, { index }): RegisterResult<DailyResultRow> => {
      checkDay(day)
      const rows = validatedIn(db, (at) => istDay(at) === day).flatMap(
        (item): DailyResultRow[] => {
          const order = db.orders[item.orderId]
          const patient = order ? db.patients[order.patientId] : undefined
          if (!order || !patient) return []
          const sample = item.sampleId ? db.samples[item.sampleId] : undefined
          return [
            {
              at: item.validatedAt!,
              labNo: sample?.accessionNo ?? order.orderNo ?? order.id,
              ...(sample ? { sampleId: sample.id } : {}),
              patientId: patient.id,
              patientName: patient.name,
              investigation: item.testName,
              result: resultSummary(db, index, item),
              abnormal: (index.resultsByItem.get(item.id) ?? []).some((r) =>
                isAbnormal(r.flag),
              ),
              authorisedBy: item.validatedBy
                ? staffName(db, item.validatedBy)
                : '',
            },
          ]
        },
      )
      return { ...paginate(rows, query, {}), period: day }
    }),

  /** Internal quality control register for one month. */
  iqc: (month: string, query: PageQuery = {}) =>
    read((db): RegisterResult<IqcRegisterRow> => {
      checkMonth(month)
      const rows = Object.values(db.qcRuns)
        .filter((r) => istDay(r.at).startsWith(month))
        .toSorted((a, b) => a.at - b.at)
        .map((r): IqcRegisterRow => ({
          at: r.at,
          equipmentName: db.equipment[r.equipmentId]?.name ?? r.equipmentId,
          analyteName: db.analytes[r.analyteId]?.name ?? r.analyteId,
          level: r.level,
          controlLot: r.controlLot,
          value: r.value,
          mean: r.mean,
          sd: r.sd,
          result: r.result,
          ...(r.rule ? { rule: r.rule } : {}),
          byName: staffName(db, r.by),
          ...(r.correctiveAction
            ? { correctiveAction: r.correctiveAction }
            : {}),
        }))
      return { ...paginate(rows, query, {}), period: month }
    }),

  /** Specimen collection register for one day. */
  collection: (day: string, query: PageQuery = {}) =>
    read((db): RegisterResult<CollectionRegisterRow> => {
      checkDay(day)
      const rows = Object.values(db.samples)
        .filter((s) => s.collectedAt && istDay(s.collectedAt) === day)
        .toSorted((a, b) => a.collectedAt! - b.collectedAt!)
        .flatMap((s): CollectionRegisterRow[] => {
          const patient = db.patients[s.patientId]
          const order = db.orders[s.orderId]
          if (!patient) return []
          return [
            {
              at: s.collectedAt!,
              labNo: s.accessionNo ?? s.id,
              sampleId: s.id,
              patientId: patient.id,
              patientName: patient.name,
              specimen: s.specimen,
              container: s.container,
              collectedBy: s.collectedBy ? staffName(db, s.collectedBy) : '',
              location: order?.ward ?? order?.encounter ?? '',
              rejected: Boolean(s.rejection),
            },
          ]
        })
      return { ...paginate(rows, query, {}), period: day }
    }),
}
