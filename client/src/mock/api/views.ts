import {
  criticalState,
  escalationStep,
  isCriticalOverdue,
  isCriticalPending,
} from '@/domain/critical'
// Builders that turn database rows into the DTOs screens consume.

import { isAbnormal, isCriticalFlag } from '@/domain/flags'
import { itemTat, worstTat } from '@/domain/tat'
import { DAY, startOfIstDay } from '@/domain/time'
import type {
  CriticalAlert,
  LabOrder,
  OrderItem,
  Patient,
  Report,
  Result,
  Sample,
} from '@/domain/types'
import {
  deriveOrderStatus,
  deriveReportStatus,
  isItemEntered,
  isItemLive,
  isReportReleased,
  orderProgress,
  sampleStage,
} from '@/domain/workflow'
import type { LabDb } from '../db/schema'
import type { DbIndex } from './index-cache'
import type {
  CriticalRow,
  DatePreset,
  DoctorRef,
  OrderRow,
  PatientSummary,
  ReportRow,
  ResultView,
  SampleRow,
  TestChip,
} from './types'
import { byOrderOfDraw } from '@/domain/collection'
import { testsMissingConsent } from '../engine/consent'

export function patientSummary(p: Patient): PatientSummary {
  const s: PatientSummary = {
    id: p.id,
    uhid: p.uhid,
    name: p.name,
    sex: p.sex,
    dob: p.dob,
    mobile: p.mobile,
    allergies: p.allergies,
    encounter: p.encounter,
  }
  if (p.nameLocal) s.nameLocal = p.nameLocal
  if (p.bloodGroup) s.bloodGroup = p.bloodGroup
  if (p.preferredLanguage) s.preferredLanguage = p.preferredLanguage
  if (p.mergedInto) s.mergedInto = p.mergedInto
  return s
}

export function doctorRef(db: LabDb, id: string): DoctorRef {
  const d = db.doctors[id]
  return d
    ? {
        id: d.id,
        name: d.name,
        department: d.department,
        phone: d.phone,
        ...(d.active === false ? { active: false as const } : {}),
      }
    : { id, name: id, department: 'general-medicine', phone: '' }
}

export const staffName = (db: LabDb, id: string | undefined) =>
  id ? (db.staff[id]?.name ?? id) : ''

export function testChip(db: LabDb, item: OrderItem): TestChip {
  const test = db.tests[item.testId]
  return {
    itemId: item.id,
    testId: item.testId,
    code: item.testCode,
    shortName: test?.shortName ?? item.testName,
    name: item.testName,
    department: item.department,
    status: item.status,
    active: item.active,
    ...(item.rerunCount && item.status === 'draft' ? { rerun: true } : {}),
  }
}

export function inDateRange(
  at: number | null | undefined,
  preset: DatePreset | undefined,
  now: number,
) {
  if (!preset || preset === 'all') return true
  if (!at) return false
  const today = startOfIstDay(now)
  switch (preset) {
    case 'today':
      return at >= today
    case 'yesterday':
      return at >= today - DAY && at < today
    case '7d':
      return at >= today - 6 * DAY
    case '30d':
      return at >= today - 29 * DAY
  }
}

export function orderRow(
  db: LabDb,
  index: DbIndex,
  order: LabOrder,
  now: number,
): OrderRow {
  const items = index.itemsByOrder.get(order.id) ?? []
  const samples = index.samplesByOrder.get(order.id) ?? []
  const live = items.filter(isItemLive)
  const patient = db.patients[order.patientId]!
  const tats = live
    .filter((i) => i.status !== 'validated')
    .map((i) =>
      itemTat(
        i,
        i.sampleId ? index.samplesById.get(i.sampleId) : undefined,
        now,
      ),
    )
  const openCriticals = items.reduce(
    (n, i) =>
      n +
      (index.criticalsByItem.get(i.id) ?? []).filter(
        (c) => c.status === 'open' || c.status === 'notified',
      ).length,
    0,
  )
  const row: OrderRow = {
    id: order.id,
    orderNo: order.orderNo,
    status: deriveOrderStatus(order, items, index.samplesById, db.reports),
    priority: order.priority,
    encounter: order.encounter,
    clinicalDepartment: order.department,
    createdAt: order.createdAt,
    orderedAt: order.orderedAt,
    patient: patientSummary(patient),
    doctor: doctorRef(db, order.doctorId),
    tests:
      order.state === 'draft'
        ? (order.draftTestIds ?? []).map((testId) => {
            const t = db.tests[testId]!
            return {
              itemId: testId,
              testId,
              code: t.code,
              shortName: t.shortName,
              name: t.name,
              department: t.department,
              status: 'pending' as const,
              active: true,
            }
          })
        : items.map((i) => testChip(db, i)),
    departments: [
      ...new Set(
        order.state === 'draft'
          ? (order.draftTestIds ?? []).map((id) => db.tests[id]!.department)
          : live.map((i) => i.department),
      ),
    ],
    progress: orderProgress(items, index.samplesById),
    hasRecollection: samples.some(
      (s) => s.recollectionOfId && s.status === 'pending_collection',
    ),
    openCriticals,
    total:
      order.state === 'draft'
        ? (order.draftTestIds ?? []).reduce(
            (sum, id) => sum + (db.tests[id]?.price ?? 0),
            0,
          )
        : live.reduce((sum, i) => sum + i.price, 0),
    tat: worstTat(tats),
  }
  if (order.ward) row.ward = order.ward
  if (order.bed) row.bed = order.bed
  return row
}

export function sampleRow(
  db: LabDb,
  index: DbIndex,
  sample: Sample,
  now: number,
): SampleRow {
  const order = db.orders[sample.orderId]!
  const patient = db.patients[sample.patientId]!
  const items = index.itemsBySample.get(sample.id) ?? []
  const live = items.filter(isItemLive)
  const tests = live
    .map((i) => db.tests[i.testId])
    .filter((t) => t !== undefined)
  const reportReleased =
    live.length > 0 &&
    live.every((i) => {
      const r = db.reports[i.reportId]
      return r ? isReportReleased(r) : false
    })
  const equipment = sample.equipmentId
    ? db.equipment[sample.equipmentId]
    : undefined
  const row: SampleRow = {
    id: sample.id,
    accessionNo: sample.accessionNo,
    status: sample.status,
    stage: sampleStage(sample, items, reportReleased),
    department: sample.department,
    container: sample.container,
    specimen: sample.specimen,
    volumeMl: sample.volumeMl,
    priority: order.priority,
    orderId: order.id,
    orderNo: order.orderNo,
    orderedAt: order.orderedAt,
    createdAt: sample.createdAt,
    patient: patientSummary(patient),
    encounter: order.encounter,
    doctorId: order.doctorId,
    doctorName: db.doctors[order.doctorId]?.name ?? '',
    tests: (sample.status === 'rejected' || sample.status === 'discarded'
      ? items
      : live
    ).map((i) => testChip(db, i)),
    instructions: [...new Set(tests.flatMap((t) => t.instructions))],
    fasting: tests.some((t) => t.fasting),
    isRecollection: Boolean(sample.recollectionOfId),
    recollectionOf: sample.recollectionOfId
      ? (db.samples[sample.recollectionOfId]?.accessionNo ?? null)
      : null,
    recollectedBy: sample.recollectedById
      ? (db.samples[sample.recollectedById]?.accessionNo ?? null)
      : null,
    labelPrintCount: sample.labelPrintCount,
    allEntered: live.length > 0 && live.every(isItemEntered),
    tat: worstTat(
      live
        .filter((i) => i.status !== 'validated')
        .map((i) => itemTat(i, sample, now)),
    ),
    consentMissing:
      sample.status === 'pending_collection'
        ? testsMissingConsent(db, live).map((i) => ({
            itemId: i.id,
            testName: i.testName,
          }))
        : [],
    drawOrder:
      sample.status === 'pending_collection'
        ? byOrderOfDraw(
            (index.pendingByPatient.get(sample.patientId) ?? []).filter(
              (s) =>
                (s.scheduledFor === undefined || s.scheduledFor <= now) &&
                (index.itemsBySample.get(s.id) ?? []).some(isItemLive),
            ),
            (s) => s.container,
          ).map((s) => ({
            id: s.id,
            container: s.container,
            accessionNo: s.accessionNo,
          }))
        : [],
    aliquots: (index.aliquotsByParent.get(sample.id) ?? []).map((s) => ({
      id: s.id,
      accessionNo: s.accessionNo,
    })),
  }
  if (sample.scheduledFor !== undefined) row.scheduledFor = sample.scheduledFor
  if (sample.scheduleReason) row.scheduleReason = sample.scheduleReason
  if (sample.identityCheck)
    row.identityCheck = {
      method: sample.identityCheck.method,
      at: sample.identityCheck.at,
      byName: staffName(db, sample.identityCheck.by),
    }
  if (sample.fastingStatus) row.fastingStatus = sample.fastingStatus
  if (sample.receiptTemperature)
    row.receiptTemperature = sample.receiptTemperature
  if (sample.temperatureDeviation) row.temperatureDeviation = true
  if (sample.parentId)
    row.parent = {
      id: sample.parentId,
      accessionNo: db.samples[sample.parentId]?.accessionNo ?? null,
    }
  if (sample.sendOut) {
    const lab = db.referralLabs[sample.sendOut.labId]
    row.sendOut = {
      ...sample.sendOut,
      labName: lab?.name ?? sample.sendOut.labId,
      nablAccredited: lab?.nablAccredited ?? false,
    }
  }
  if (order.ward) row.ward = order.ward
  if (order.bed) row.bed = order.bed
  if (sample.collectedAt) row.collectedAt = sample.collectedAt
  if (sample.collectedBy) row.collectedBy = staffName(db, sample.collectedBy)
  if (sample.collectionSite) row.collectionSite = sample.collectionSite
  if (sample.receivedAt) row.receivedAt = sample.receivedAt
  if (sample.processingStartedAt)
    row.processingStartedAt = sample.processingStartedAt
  if (equipment)
    row.equipment = {
      id: equipment.id,
      name: equipment.name,
      status: equipment.status,
    }
  if (sample.status === 'on_hold') {
    if (sample.holdReason) row.holdReason = sample.holdReason
    if (sample.holdRemarks) row.holdRemarks = sample.holdRemarks
    if (sample.heldAt) row.heldAt = sample.heldAt
  }
  if (sample.completedAt) row.completedAt = sample.completedAt
  if (sample.assignedTo) {
    row.assignedTo = sample.assignedTo
    row.assignedName = staffName(db, sample.assignedTo)
  }
  if (sample.rejection)
    row.rejection = {
      ...sample.rejection,
      byName: staffName(db, sample.rejection.by),
    }
  return row
}

export function resultView(db: LabDb, r: Result): ResultView {
  const analyte = db.analytes[r.analyteId]
  const v: ResultView = {
    id: r.id,
    analyteId: r.analyteId,
    name: analyte?.name ?? r.analyteId,
    unit: r.unit,
    value: r.value,
    flag: r.flag,
    range: r.range,
    critical: analyte ? isCriticalFlag(analyte, r.flag) : false,
    revisions: r.revisions,
  }
  if (r.remarks) v.remarks = r.remarks
  if (r.dilution) v.dilution = r.dilution
  if (r.instrumentFlags?.length) v.instrumentFlags = r.instrumentFlags
  if (r.calculated) v.calculated = true
  return v
}

export function reportRow(
  db: LabDb,
  index: DbIndex,
  report: Report,
): ReportRow {
  const order = db.orders[report.orderId]!
  const items = (index.itemsByReport.get(report.id) ?? []).filter(isItemLive)
  let abnormal = 0
  let critical = 0
  for (const item of items) {
    for (const r of index.resultsByItem.get(item.id) ?? []) {
      const analyte = db.analytes[r.analyteId]
      if (isAbnormal(r.flag)) abnormal += 1
      if (analyte && isCriticalFlag(analyte, r.flag)) critical += 1
    }
  }
  const row: ReportRow = {
    id: report.id,
    reportNo: report.reportNo,
    status: deriveReportStatus(
      report,
      index.itemsByReport.get(report.id) ?? [],
    ),
    department: report.department,
    orderId: order.id,
    orderNo: order.orderNo,
    patient: patientSummary(db.patients[report.patientId]!),
    doctorName: db.doctors[order.doctorId]?.name ?? '',
    createdAt: report.createdAt,
    version: report.versions.at(-1)?.version ?? 0,
    tests: items.map((i) => db.tests[i.testId]?.shortName ?? i.testName),
    abnormalCount: abnormal,
    criticalCount: critical,
    renotifyPending: Boolean(report.renotifyPending),
  }
  const released = report.versions.at(-1)?.releasedAt
  if (released) row.releasedAt = released
  return row
}

export function criticalRow(
  db: LabDb,
  alert: CriticalAlert,
  now: number,
): CriticalRow {
  const order = db.orders[alert.orderId]!
  const analyte = db.analytes[alert.analyteId]
  const result = db.results[alert.resultId]
  const item = db.items[alert.orderItemId]
  const row: CriticalRow = {
    ...alert,
    patient: patientSummary(db.patients[alert.patientId]!),
    analyteName: analyte?.name ?? alert.analyteId,
    unit: result?.unit ?? analyte?.unit ?? '',
    testName: item?.testName ?? '',
    orderNo: order.orderNo,
    accessionNo: db.samples[alert.sampleId]?.accessionNo ?? null,
    range: result?.range ?? null,
    doctor: doctorRef(db, order.doctorId),
    encounter: order.encounter,
    detectedByName: staffName(db, alert.detectedBy),
    state: criticalState(alert),
    overdue: isCriticalOverdue(alert, now, db.settings.criticalNotifyMin),
    limitMin: db.settings.criticalNotifyMin,
    attempts: alert.attempts.map((a) => ({
      ...a,
      byName: staffName(db, a.by),
    })),
    history: alert.history
      .toSorted((a, b) => b.at - a.at)
      .map((h) => ({ ...h, byName: staffName(db, h.by) })),
  }
  if (alert.escalatedBy) row.escalatedByName = staffName(db, alert.escalatedBy)
  // Still not communicated: who it should have gone to by now.
  if (isCriticalPending(alert)) {
    const step = escalationStep(
      (now - alert.detectedAt) / 60_000,
      db.settings.criticalEscalation,
    )
    if (step)
      row.escalationDue = {
        step: step.index + 1,
        to: step.tier.to,
        afterMin: step.tier.afterMin,
      }
  }
  if (order.ward) row.ward = order.ward
  if (order.bed) row.bed = order.bed
  if (alert.notifiedBy) row.notifiedByName = staffName(db, alert.notifiedBy)
  if (alert.acknowledgedBy)
    row.acknowledgedByName = staffName(db, alert.acknowledgedBy)
  return row
}

/** Case-insensitive match across the identifiers staff search by. */
export function matchesQuery(
  q: string | undefined,
  fields: (string | null | undefined)[],
) {
  if (!q || !q.trim()) return true
  const needle = q.trim().toLowerCase()
  const digits = needle.replace(/\D/g, '')
  return fields.some((f) => {
    if (!f) return false
    const hay = f.toLowerCase()
    if (hay.includes(needle)) return true
    // Mobile numbers: match on digits regardless of spacing.
    return digits.length >= 4 && hay.replace(/\D/g, '').includes(digits)
  })
}

export function patientSearchFields(
  p: Pick<Patient, 'name' | 'uhid' | 'mobile' | 'nameLocal'>,
) {
  return [p.name, p.uhid, p.mobile, p.nameLocal?.text]
}

export const byNewest = <T extends { at: number }>(a: T, b: T) => b.at - a.at
