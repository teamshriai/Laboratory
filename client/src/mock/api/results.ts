import { deltaCheck, isAbnormal, isCriticalFlag } from '@/domain/flags'
import { pickRange, rangeSnapshot } from '@/domain/reference-ranges'
import { itemTat } from '@/domain/tat'
import { ageInYears } from '@/domain/time'
import {
  awaitsAuthorisation,
  awaitsReview,
  isItemLive,
} from '@/domain/workflow'
import type { DepartmentId } from '@/domain/types'
import type { LabDb } from '../db/schema'
import { must } from '../engine/core'
import { qcHoldFor } from '../engine/qc-gate'
import {
  addItemComment,
  holdItem,
  returnItem,
  requestRerun,
  saveResults,
  reviewItems,
  validateItems,
  type ItemResultsInput,
} from '../engine/results'
import type { DbIndex } from './index-cache'
import { read, write } from './runtime'
import { equipmentOptions } from './samples'
import type {
  EntryItem,
  PreviousResult,
  ResultEntryView,
  SampleRow,
  ValidationRow,
} from './types'
import {
  matchesQuery,
  patientSearchFields,
  patientSummary,
  resultView,
  sampleRow,
  staffName,
} from './views'

export type { ItemResultsInput }

function previousResult(
  index: DbIndex,
  patientId: string,
  analyteId: string,
  orderId: string,
): PreviousResult | null {
  const hit = (index.history.get(`${patientId}:${analyteId}`) ?? []).find(
    (h) => h.orderId !== orderId,
  )
  return hit ? { value: hit.value, flag: hit.flag, at: hit.at } : null
}

const PRIORITY_RANK = { stat: 0, urgent: 1, routine: 2 } as const

export const resultsApi = {
  /** Samples in the lab with results still to enter (or sent back). */
  worklist: (filters: { department?: DepartmentId; q?: string } = {}) =>
    read((db, { index, now }) => {
      const rows: SampleRow[] = []
      for (const s of Object.values(db.samples)) {
        if (s.status !== 'received' && s.status !== 'processing') continue
        if (filters.department && s.department !== filters.department) continue
        const items = (index.itemsBySample.get(s.id) ?? []).filter(isItemLive)
        if (
          !items.some((i) =>
            ['pending', 'draft', 'returned'].includes(i.status),
          )
        )
          continue
        const patient = db.patients[s.patientId]!
        if (
          !matchesQuery(filters.q, [
            ...patientSearchFields(patient),
            s.accessionNo,
            db.orders[s.orderId]?.orderNo,
          ])
        )
          continue
        rows.push(sampleRow(db, index, s, now))
      }
      // STAT first, then the specimen that has waited longest since receipt.
      return rows.toSorted(
        (a, b) =>
          PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
          (a.receivedAt ?? a.createdAt) - (b.receivedAt ?? b.createdAt),
      )
    }),

  entry: (sampleId: string) =>
    read((db, { index, now }): ResultEntryView => {
      const sample = must(db.samples, sampleId, 'sample')
      const order = db.orders[sample.orderId]!
      const patient = db.patients[sample.patientId]!
      const ageYears = ageInYears(patient.dob, now)
      const items = (index.itemsBySample.get(sampleId) ?? []).filter(isItemLive)
      return {
        sample: sampleRow(db, index, sample, now),
        clinicalNotes: order.clinicalNotes,
        patientNotes: patient.notes.slice(0, 3),
        items: items.map((item): EntryItem => {
          const test = db.tests[item.testId]
          const results = index.resultsByItem.get(item.id) ?? []
          const entry: EntryItem = {
            itemId: item.id,
            testId: item.testId,
            testName: item.testName,
            shortName: test?.shortName ?? item.testName,
            code: item.testCode,
            department: item.department,
            status: item.status,
            comments: item.comments,
            analytes: item.analyteIds.map((analyteId) => {
              const analyte = db.analytes[analyteId]!
              const result = results.find((r) => r.analyteId === analyteId)
              return {
                analyte,
                result: result ? resultView(db, result) : null,
                range:
                  result?.range ??
                  rangeSnapshot(
                    analyte,
                    pickRange(index.rangesByAnalyte.get(analyteId) ?? [], {
                      sex: patient.sex,
                      ageYears,
                      specimen: item.specimen,
                    }),
                  ),
                previous: previousResult(
                  index,
                  patient.id,
                  analyteId,
                  order.id,
                ),
              }
            }),
          }
          if (test?.method) entry.method = test.method
          if (item.returnedReason) entry.returnedReason = item.returnedReason
          if (item.enteredAt) entry.enteredAt = item.enteredAt
          if (item.enteredBy) entry.enteredBy = staffName(db, item.enteredBy)
          return entry
        }),
        equipmentOptions: equipmentOptions(
          db,
          items.map((i) => i.testId),
          now,
        ),
      }
    }),

  save: (sampleId: string, entries: ItemResultsInput[], submit: boolean) =>
    write((db, ctx) => {
      const items = saveResults(db, sampleId, entries, submit, ctx)
      const alerts = Object.values(db.criticals).filter(
        (c) =>
          c.sampleId === sampleId &&
          c.status === 'open' &&
          c.detectedAt === ctx.now,
      )
      return { items: items.length, newCriticals: alerts.length }
    }),

  /** Rerun on the same specimen: both values stay on record. */
  rerun: (itemId: string, input: { reason: string; dilution?: number }) =>
    write((db, ctx) => void requestRerun(db, itemId, input, ctx)),
}

function validationRow(
  db: LabDb,
  index: DbIndex,
  itemId: string,
  now: number,
): ValidationRow {
  const item = db.items[itemId]!
  const sample = item.sampleId ? db.samples[item.sampleId] : undefined
  const order = db.orders[item.orderId]!
  const patient = db.patients[order.patientId]!
  const results = index.resultsByItem.get(item.id) ?? []
  const analytes = item.analyteIds
    .map((analyteId) => {
      const analyte = db.analytes[analyteId]!
      const r = results.find((x) => x.analyteId === analyteId)
      if (!r || r.value === null) return null
      const previous = previousResult(index, patient.id, analyteId, order.id)
      const row = {
        resultId: r.id,
        analyteId,
        name: analyte.name,
        unit: r.unit,
        resultType: analyte.resultType,
        value: r.value,
        flag: r.flag,
        range: r.range,
        critical: isCriticalFlag(analyte, r.flag),
        previous,
        delta:
          analyte.resultType === 'numeric'
            ? deltaCheck(r.value, previous?.value, analyte.deltaPct)
            : null,
        ...(r.remarks ? { remarks: r.remarks } : {}),
        ...(r.dilution ? { dilution: r.dilution } : {}),
      }
      // The value before the latest repeat analysis, for comparison.
      const firstRun = r.revisions.findLast((rev) => rev.rerun)
      return firstRun
        ? {
            ...row,
            firstRun: {
              value: firstRun.value,
              flag: firstRun.flag,
              ...(firstRun.reason ? { reason: firstRun.reason } : {}),
              ...(firstRun.dilution ? { dilution: firstRun.dilution } : {}),
            },
          }
        : row
    })
    .filter((a) => a !== null)
  const tests = db.tests[item.testId]
  const row: ValidationRow = {
    itemId: item.id,
    testId: item.testId,
    testName: item.testName,
    shortName: tests?.shortName ?? item.testName,
    department: item.department,
    status: item.status,
    comments: item.comments,
    sampleId: sample?.id ?? '',
    accessionNo: sample?.accessionNo ?? null,
    orderId: order.id,
    orderNo: order.orderNo,
    priority: order.priority,
    patient: patientSummary(patient),
    analytes,
    criticalCount: analytes.filter((a) => a.critical).length,
    abnormalCount: analytes.filter((a) => isAbnormal(a.flag)).length,
    deltaFlags: analytes.filter((a) => a.delta?.exceeded).length,
    alerts: (index.criticalsByItem.get(item.id) ?? [])
      .filter((c) => c.status !== 'voided')
      .map((c) => ({ id: c.id, status: c.status })),
    tat: itemTat(item, sample, now),
  }
  if (item.enteredAt) row.enteredAt = item.enteredAt
  if (item.enteredBy) {
    row.enteredBy = staffName(db, item.enteredBy)
    row.enteredById = item.enteredBy
  }
  if (item.heldReason) row.heldReason = item.heldReason
  if (item.reviewedAt) row.reviewedAt = item.reviewedAt
  if (item.reviewedBy) {
    row.reviewedBy = staffName(db, item.reviewedBy)
    row.reviewedById = item.reviewedBy
  }
  if (sample?.status === 'on_hold') row.sampleOnHold = true
  // An open QC failure on the analyzer blocks authorisation (QC gating).
  const qcAnalyte =
    sample?.equipmentId && qcHoldFor(db, sample.id, sample.equipmentId)
  if (qcAnalyte && sample?.equipmentId)
    row.qcHold = {
      equipment: db.equipment[sample.equipmentId]?.name ?? '',
      analyte: qcAnalyte,
    }
  if (item.rerunCount) row.rerunCount = item.rerunCount
  return row
}

export const validationApi = {
  /**
   * The validation work list. `stage` review = entered or held, waiting for
   * technical review; authorise = reviewed, waiting for a pathologist.
   */
  queue: (
    filters: {
      department?: DepartmentId
      q?: string
      stage?: 'review' | 'authorise' | 'all'
    } = {},
  ) =>
    read((db, { index, now }) => {
      const rows: ValidationRow[] = []
      const stage = filters.stage ?? 'all'
      for (const item of Object.values(db.items)) {
        if (!isItemLive(item)) continue
        const inReview = awaitsReview(item)
        const inAuthorise = awaitsAuthorisation(item)
        if (!inReview && !inAuthorise) continue
        if (stage === 'review' && !inReview) continue
        if (stage === 'authorise' && !inAuthorise) continue
        if (filters.department && item.department !== filters.department)
          continue
        const order = db.orders[item.orderId]!
        const patient = db.patients[order.patientId]!
        if (
          !matchesQuery(filters.q, [
            ...patientSearchFields(patient),
            order.orderNo,
            item.testName,
            db.samples[item.sampleId ?? '']?.accessionNo,
          ])
        )
          continue
        rows.push(validationRow(db, index, item.id, now))
      }
      // Critical first, then abnormal, then by priority and age.
      return rows.toSorted((a, b) => {
        if (b.criticalCount !== a.criticalCount)
          return b.criticalCount - a.criticalCount
        const ab = Number(b.abnormalCount > 0) - Number(a.abnormalCount > 0)
        if (ab !== 0) return ab
        const p = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
        if (p !== 0) return p
        return (a.enteredAt ?? 0) - (b.enteredAt ?? 0)
      })
    }),

  /** Counts per stage, for the stage tabs. */
  stageCounts: (filters: { department?: DepartmentId } = {}) =>
    read((db) => {
      let review = 0
      let authorise = 0
      for (const item of Object.values(db.items)) {
        if (!isItemLive(item)) continue
        if (filters.department && item.department !== filters.department)
          continue
        if (awaitsReview(item)) review += 1
        else if (awaitsAuthorisation(item)) authorise += 1
      }
      return { review, authorise }
    }),

  // Verify, authorise, send back and hold are signed by the acting user.
  review: (itemIds: string[]) =>
    write((db, ctx) => ({ reviewed: reviewItems(db, itemIds, ctx).length })),

  validate: (itemIds: string[]) =>
    write((db, ctx) => {
      const items = validateItems(db, itemIds, ctx)
      // Reports that became ready for release with this validation.
      const ready = new Set<string>()
      for (const item of items) {
        const siblings = Object.values(db.items).filter(
          (i) => i.reportId === item.reportId && isItemLive(i),
        )
        if (siblings.every((i) => i.status === 'validated'))
          ready.add(item.reportId)
      }
      return {
        validated: items.length,
        readyReports: [...ready].map((id) => ({
          id,
          reportNo: db.reports[id]!.reportNo,
        })),
      }
    }),

  sendBack: (itemId: string, reason: string) =>
    write((db, ctx) => void returnItem(db, itemId, reason, ctx)),

  hold: (itemId: string, reason: string) =>
    write((db, ctx) => void holdItem(db, itemId, reason, ctx)),

  comment: (itemId: string, text: string, visibility: 'internal' | 'report') =>
    write(
      (db, ctx) => void addItemComment(db, itemId, { text, visibility }, ctx),
    ),
}
