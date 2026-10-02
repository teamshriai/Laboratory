// The data rules D1-D14 from the laboratory audit (improvemet.md §8),
// checked over the generated demo data and again after the time shift the
// store applies when the app has been away.

import { describe, expect, it } from 'vitest'
import { isCriticalFlag } from '@/domain/flags'
import {
  deriveOrderStatus,
  isItemFinal,
  isItemLive,
  isItemReported,
  IN_LAB_STATUSES,
} from '@/domain/workflow'
import { HOUR } from '@/domain/time'
import type { LabDb } from '../schema'
import { shiftInstants } from '../store'
import { seedDatabase } from './index'

const NOW = Date.UTC(2026, 8, 28, 11, 0)

function check(db: LabDb, now: number) {
  const items = Object.values(db.items)
  const samples = new Map(Object.entries(db.samples))
  const problems: string[] = []
  const fail = (rule: string, what: string) => problems.push(`${rule}: ${what}`)
  const resultsOf = (itemId: string) =>
    Object.values(db.results).filter((r) => r.orderItemId === itemId)

  // D1: Completed is derived and means every live test is on a final report.
  for (const order of Object.values(db.orders)) {
    const own = items.filter((i) => i.orderId === order.id)
    if (deriveOrderStatus(order, own, samples, db.reports) !== 'completed')
      continue
    for (const item of own.filter(isItemLive))
      if (!isItemFinal(item, db.reports[item.reportId]))
        fail('D1', `${order.orderNo} completed but ${item.testName} not final`)
  }

  for (const item of items) {
    const sample = item.sampleId ? db.samples[item.sampleId] : undefined
    const withValues = resultsOf(item.id).filter((r) => r.value !== null)
    // D2: a result needs a specimen received in the lab.
    if (
      withValues.length &&
      (!sample?.receivedAt || !IN_LAB_STATUSES.includes(sample.status))
    )
      fail('D2', `${item.testName} has results without a received specimen`)
    // D9: a cancelled test has a reason and no results.
    if (!item.active) {
      if (!item.cancelReason)
        fail('D9', `${item.testName} cancelled without a reason`)
      if (withValues.length)
        fail('D9', `${item.testName} cancelled with results`)
    }
    // D5: each step after the one before it.
    const order = db.orders[item.orderId]!
    const report = db.reports[item.reportId]
    const released = report?.versions.find(
      (v) => !v.itemIds || v.itemIds.includes(item.id),
    )?.releasedAt
    const steps: [string, number | null | undefined][] = [
      ['ordered', order.orderedAt],
      ['collected', sample?.collectedAt],
      ['received', sample?.receivedAt],
      ['entered', item.enteredAt],
      ['reviewed', item.reviewedAt],
      ['validated', item.validatedAt],
      ['released', isItemReported(item, report) ? released : undefined],
    ]
    let last = -Infinity
    let lastName = ''
    for (const [name, at] of steps) {
      if (at === undefined || at === null) continue
      if (at < last)
        fail(
          'D5',
          `${item.testName}: ${name} (${at}) before ${lastName} (${last})`,
        )
      last = at
      lastName = name
    }
  }

  for (const sample of Object.values(db.samples)) {
    // D3: a specimen belongs to an order and to its patient.
    const order = db.orders[sample.orderId]
    if (!order) fail('D3', `${sample.id} has no order`)
    else if (order.patientId !== sample.patientId)
      fail('D11', `${sample.accessionNo} patient differs from its order`)
    // D8: a rejected specimen keeps no results and links its recollection.
    if (sample.status === 'rejected') {
      const r = sample.rejection
      if (!r?.reason || !r.by || !r.at)
        fail(
          'D8',
          `${sample.accessionNo} rejected without reason, user or time`,
        )
      const own = items.filter((i) => i.sampleId === sample.id && isItemLive(i))
      if (own.some((i) => resultsOf(i.id).some((x) => x.value !== null)))
        fail('D8', `${sample.accessionNo} rejected but has results`)
      if (r?.recollectionRequested) {
        const next = sample.recollectedById
          ? db.samples[sample.recollectedById]
          : undefined
        if (next?.recollectionOfId !== sample.id)
          fail('D8', `${sample.accessionNo} recollection not linked`)
        if (next?.accessionNo && next.accessionNo === sample.accessionNo)
          fail('D8', `${sample.accessionNo} recollection reused the accession`)
      }
    }
  }

  // D4: a released version contains authorised tests only, with who and when.
  for (const report of Object.values(db.reports)) {
    if (report.patientId !== db.orders[report.orderId]?.patientId)
      fail('D11', `${report.reportNo} patient differs from its order`)
    for (const v of report.versions) {
      for (const id of v.itemIds ?? []) {
        const item = db.items[id]
        if (
          !item ||
          item.status !== 'validated' ||
          !item.validatedBy ||
          !item.validatedAt
        )
          fail(
            'D4',
            `${report.reportNo} v${v.version} has an unauthorised test`,
          )
      }
      if (!v.releasedBy || !v.releasedAt)
        fail('D4', `${report.reportNo} v${v.version} lacks releaser or time`)
    }
    // D13: an amended report keeps the earlier versions and why.
    const amended = report.versions.filter((v) => v.kind === 'amended')
    for (const v of amended) {
      if (
        v.version < 2 ||
        !report.versions.some((p) => p.version === v.version - 1)
      )
        fail('D13', `${report.reportNo} v${v.version} lost its prior version`)
      if (!v.correctionReason)
        fail('D13', `${report.reportNo} v${v.version} has no reason`)
    }
  }

  // D10: quantitative results carry the catalog unit and an interval
  // snapshot, or the catalog has none ("Not established").
  for (const r of Object.values(db.results)) {
    const analyte = db.analytes[r.analyteId]
    if (!analyte || analyte.resultType !== 'numeric' || r.value === null)
      continue
    if (r.unit !== analyte.unit) fail('D10', `${analyte.name} unit ${r.unit}`)
    const hasCatalogRange = Object.values(db.ranges).some(
      (x) => x.analyteId === analyte.id,
    )
    if (hasCatalogRange && !r.range)
      fail('D10', `${analyte.name} has no interval`)
    // D12: a critical value has a notification record.
    if (isCriticalFlag(analyte, r.flag)) {
      const alert = Object.values(db.criticals).find((c) => c.resultId === r.id)
      if (!alert)
        fail('D12', `${analyte.name} ${r.value} critical without a record`)
    }
  }

  // D6: nothing in the future; nothing before the patient was born or
  // registered. D14: age is never stored, only the date of birth.
  const walk = (value: unknown, path: string) => {
    if (Array.isArray(value)) value.forEach((v, i) => walk(v, `${path}[${i}]`))
    else if (value && typeof value === 'object')
      for (const [k, v] of Object.entries(value)) {
        if (
          typeof v === 'number' &&
          (k === 'at' || k.endsWith('At')) &&
          !/(expires|due|next|scheduled|calibration)/i.test(k) &&
          v > now + 1000
        )
          fail('D6', `${path}.${k} in the future`)
        else walk(v, `${path}.${k}`)
      }
  }
  walk(
    { ...db, lots: {}, consumables: {}, equipment: {}, controlLots: {} },
    'db',
  )
  for (const order of Object.values(db.orders)) {
    const patient = db.patients[order.patientId]!
    if ('age' in patient) fail('D14', `${patient.uhid} stores an age`)
    if (order.orderedAt !== null && order.orderedAt < Date.parse(patient.dob))
      fail('D6', `${order.orderNo} before ${patient.uhid} was born`)
    if (order.orderedAt !== null && order.orderedAt < patient.registeredAt)
      fail('D6', `${order.orderNo} before ${patient.uhid} was registered`)
  }

  // D7: identifiers are unique.
  const unique = (rule: string, label: string, values: (string | null)[]) => {
    const seen = new Set<string>()
    for (const v of values) {
      if (!v) continue
      if (seen.has(v)) fail(rule, `${label} ${v} repeated`)
      seen.add(v)
    }
  }
  unique(
    'D7',
    'UHID',
    Object.values(db.patients).map((p) => p.uhid),
  )
  unique(
    'D7',
    'Order',
    Object.values(db.orders).map((o) => o.orderNo),
  )
  unique(
    'D7',
    'Accession',
    Object.values(db.samples).map((s) => s.accessionNo),
  )
  unique(
    'D7',
    'Report',
    Object.values(db.reports).map((r) => r.reportNo),
  )
  return problems
}

describe('demo data integrity (audit D1-D14)', () => {
  const { db } = seedDatabase(NOW)

  it('holds every rule on fresh data', () => {
    expect(check(db, NOW)).toEqual([])
  })

  it('catches records that break the rules', () => {
    const broken = structuredClone(db)
    // A report version releasing a test that was never authorised (D4).
    const report = Object.values(broken.reports).find(
      (r) => r.versions.length > 0,
    )!
    const pending = Object.values(broken.items).find(
      (i) => i.status !== 'validated' && isItemLive(i),
    )!
    report.versions[0]!.itemIds = [
      ...(report.versions[0]!.itemIds ?? []),
      pending.id,
    ]
    // A received time before the collection time (D5).
    const sample = Object.values(broken.samples).find(
      (x) => x.receivedAt && x.collectedAt,
    )!
    sample.receivedAt = sample.collectedAt! - HOUR
    // A repeated accession number (D7).
    const other = Object.values(broken.samples).find(
      (x) => x.accessionNo && x.id !== sample.id,
    )!
    other.accessionNo = sample.accessionNo
    // A stored age (D14).
    Object.assign(Object.values(broken.patients)[0]!, { age: 40 })
    const rules = new Set(check(broken, NOW).map((p) => p.split(':')[0]))
    expect([...rules]).toEqual(expect.arrayContaining(['D4', 'D5', 'D7']))
  })

  it('still holds after the app was away for two days', () => {
    const away = structuredClone(db)
    shiftInstants(away, 48 * HOUR)
    expect(check(away, NOW + 48 * HOUR)).toEqual([])
  })
})
