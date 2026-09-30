import { isItemLive } from '@/domain/workflow'
import { startOfIstDay } from '@/domain/time'
import type { HoldReason, Sample, SampleStatus } from '@/domain/types'
import type { LabDb } from '../db/schema'
import { must } from '../engine/core'
import {
  collectSample,
  holdSample,
  printLabel,
  receiveSample,
  rejectSample,
  resumeSample,
  startProcessing,
  type CollectInput,
  type RejectInput,
  assignSample,
} from '../engine/samples'
import type { DbIndex } from './index-cache'
import { read, write } from './runtime'
import type {
  EquipmentOption,
  SampleDetail,
  SampleFilters,
  SampleRow,
  MilestoneEntry,
} from './types'
import {
  matchesQuery,
  patientSearchFields,
  resultView,
  sampleRow,
  staffName,
  testChip,
} from './views'

const PRIORITY_RANK = { stat: 0, urgent: 1, routine: 2 } as const

export function byUrgency(a: SampleRow, b: SampleRow) {
  const p = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
  if (p !== 0) return p
  const ta = a.tat?.ratio ?? 0
  const tb = b.tat?.ratio ?? 0
  if (tb !== ta) return tb - ta
  return (a.orderedAt ?? a.createdAt) - (b.orderedAt ?? b.createdAt)
}

export function equipmentOptions(
  db: LabDb,
  testIds: string[],
  now: number,
): EquipmentOption[] {
  const today = startOfIstDay(now)
  return Object.values(db.equipment)
    .filter((e) => testIds.some((t) => e.testIds.includes(t)))
    .map((e) => ({
      id: e.id,
      name: e.name,
      model: `${e.manufacturer} ${e.model}`,
      status: e.status,
      qcFailedToday: Object.values(db.qcRuns).some(
        (r) => r.equipmentId === e.id && r.at >= today && r.result === 'fail',
      ),
    }))
}

function filterSamples(
  db: LabDb,
  index: DbIndex,
  now: number,
  filters: SampleFilters,
  statuses: SampleStatus[],
) {
  const today = startOfIstDay(now)
  const rows: SampleRow[] = []
  for (const s of Object.values(db.samples)) {
    if (!statuses.includes(s.status)) continue
    // Finished work only for today; open work regardless of age.
    if (s.status === 'rejected' && (s.rejection?.at ?? 0) < today) continue
    if (s.status === 'completed' && (s.completedAt ?? 0) < today) continue
    if (filters.department && s.department !== filters.department) continue
    const order = db.orders[s.orderId]!
    if (order.state !== 'active') continue
    if (filters.priority && order.priority !== filters.priority) continue
    const patient = db.patients[s.patientId]!
    if (
      !matchesQuery(filters.q, [
        ...patientSearchFields(patient),
        s.accessionNo,
        order.orderNo,
      ])
    )
      continue
    rows.push(sampleRow(db, index, s, now))
  }
  return rows
}

const PROCESSING_STATUSES: SampleStatus[] = [
  'collected',
  'received',
  'processing',
  'on_hold',
  'rejected',
  'completed',
]

export const samplesApi = {
  collectionQueue: (filters: SampleFilters = {}) =>
    read((db, { index, now }) => {
      const pending = filterSamples(db, index, now, filters, [
        'pending_collection',
      ]).toSorted(byUrgency)
      const collected = filterSamples(db, index, now, filters, [
        'collected',
      ]).toSorted((a, b) => (a.collectedAt ?? 0) - (b.collectedAt ?? 0))
      return { pending, collected }
    }),

  processing: (filters: SampleFilters = {}) =>
    read((db, { index, now }) => {
      const all = filterSamples(
        db,
        index,
        now,
        { ...filters },
        PROCESSING_STATUSES,
      )
      const counts = Object.fromEntries(
        PROCESSING_STATUSES.map((s) => [s, 0]),
      ) as Record<SampleStatus, number>
      for (const r of all) counts[r.status] += 1
      const status =
        filters.status && filters.status !== 'all' ? filters.status : null
      const rows = (
        status ? all.filter((r) => r.status === status) : all
      ).toSorted(byUrgency)
      return { rows, counts }
    }),

  get: (id: string) =>
    read((db, { index, now }): SampleDetail => {
      const sample = must(db.samples, id, 'sample')
      const order = db.orders[sample.orderId]!
      const items = index.itemsBySample.get(id) ?? []
      const live = items.filter(isItemLive)
      const person = (id?: string) => {
        const staff = id ? db.staff[id] : undefined
        return staff ? { byName: staff.name, role: staff.role } : {}
      }
      const latest = <T>(values: (T | undefined)[], pick: (v: T) => number) =>
        values
          .filter((v): v is T => v !== undefined)
          .toSorted((a, b) => pick(b) - pick(a))[0]
      const allEntered = live.length > 0 && live.every((i) => i.enteredAt)
      const allValidated =
        live.length > 0 && live.every((i) => i.status === 'validated')
      const entered = allEntered
        ? latest(live, (i) => i.enteredAt ?? 0)
        : undefined
      const validated = allValidated
        ? latest(live, (i) => i.validatedAt ?? 0)
        : undefined
      const allReviewed = live.length > 0 && live.every((i) => i.reviewedAt)
      const reviewed = allReviewed
        ? latest(live, (i) => i.reviewedAt ?? 0)
        : undefined
      const releases = live.map((i) => db.reports[i.reportId]?.versions[0])
      const released = releases.every(Boolean)
        ? latest(releases, (v) => v.releasedAt)
        : undefined
      const milestones: MilestoneEntry[] = [
        {
          key: 'ordered',
          ...(order.orderedAt ? { at: order.orderedAt } : {}),
          ...person(order.createdBy),
          ...(order.priority !== 'routine'
            ? { note: order.priority.toUpperCase() }
            : {}),
        },
        {
          key: 'collected',
          ...(sample.collectedAt
            ? { at: sample.collectedAt, ...person(sample.collectedBy) }
            : {}),
          ...(sample.collectionRemarks
            ? { note: sample.collectionRemarks }
            : {}),
        },
        {
          key: 'received',
          ...(sample.receivedAt
            ? { at: sample.receivedAt, ...person(sample.receivedBy) }
            : {}),
        },
        {
          key: 'processing',
          ...(sample.processingStartedAt
            ? { at: sample.processingStartedAt, ...person(sample.processingBy) }
            : {}),
          ...(sample.equipmentId
            ? { note: db.equipment[sample.equipmentId]?.name ?? '' }
            : {}),
        },
        {
          key: 'entered',
          ...(entered?.enteredAt
            ? { at: entered.enteredAt, ...person(entered.enteredBy) }
            : {}),
        },
        {
          key: 'reviewed',
          ...(reviewed?.reviewedAt
            ? { at: reviewed.reviewedAt, ...person(reviewed.reviewedBy) }
            : {}),
        },
        {
          key: 'validated',
          ...(validated?.validatedAt
            ? { at: validated.validatedAt, ...person(validated.validatedBy) }
            : {}),
        },
        {
          key: 'released',
          ...(released
            ? { at: released.releasedAt, ...person(released.releasedBy) }
            : {}),
        },
      ]
      return {
        ...sampleRow(db, index, sample, now),
        milestones,
        history: sample.history
          .toSorted((a, b) => b.at - a.at)
          .map((h) => ({ ...h, byName: staffName(db, h.by) })),
        items: items.map((i) => ({
          ...testChip(db, i),
          results: (index.resultsByItem.get(i.id) ?? [])
            .toSorted(
              (a, b) =>
                i.analyteIds.indexOf(a.analyteId) -
                i.analyteIds.indexOf(b.analyteId),
            )
            .map((r) => resultView(db, r)),
          comments: i.comments,
        })),
        clinicalNotes: order.clinicalNotes,
        reportIds: [...new Set(items.map((i) => i.reportId))],
        equipmentOptions: equipmentOptions(
          db,
          items.filter(isItemLive).map((i) => i.testId),
          now,
        ),
      }
    }),

  /** Finds a sample by accession number or id (e.g. from a barcode scan). */
  lookup: (ref: string) =>
    read((db, { index, now }) => {
      const key = ref.trim().toUpperCase()
      const s: Sample | undefined =
        db.samples[ref] ??
        Object.values(db.samples).find(
          (x) => x.accessionNo?.toUpperCase() === key,
        )
      return s ? sampleRow(db, index, s, now) : null
    }, 'search'),

  printLabels: (ids: string[]) =>
    write((db, ctx) =>
      ids
        .map((id) => printLabel(db, id, ctx))
        .map((s) => ({ id: s.id, accessionNo: s.accessionNo })),
    ),

  collect: (id: string, input: CollectInput) =>
    write((db, ctx) => collectSample(db, id, input, ctx).accessionNo),

  receive: (ref: string) =>
    write((db, ctx) => {
      const s = receiveSample(db, ref, ctx)
      return { id: s.id, accessionNo: s.accessionNo }
    }),

  start: (id: string, equipmentId?: string) =>
    write(
      (db, ctx) =>
        void startProcessing(db, id, equipmentId ? { equipmentId } : {}, ctx),
    ),

  hold: (id: string, input: { reason: HoldReason; remarks?: string }) =>
    write((db, ctx) => void holdSample(db, id, input, ctx)),

  resume: (id: string) => write((db, ctx) => void resumeSample(db, id, ctx)),

  assign: (ids: string[], staffId: string | null) =>
    write((db, ctx) => {
      for (const id of ids) assignSample(db, id, staffId, ctx)
    }),

  /** Starts several received samples, each on an available analyzer of its bench. */
  startMany: (ids: string[]) =>
    write((db, ctx) => {
      let started = 0
      for (const id of ids) {
        const sample = must(db.samples, id, 'sample')
        if (sample.status !== 'received') continue
        const testIds = Object.values(db.items)
          .filter((i) => i.sampleId === id && isItemLive(i))
          .map((i) => i.testId)
        const eq = Object.values(db.equipment).find(
          (e) =>
            e.department === sample.department &&
            e.status !== 'out-of-service' &&
            e.status !== 'maintenance' &&
            e.testIds.some((t) => testIds.includes(t)),
        )
        startProcessing(db, id, eq ? { equipmentId: eq.id } : {}, ctx)
        started += 1
      }
      return started
    }),

  reject: (id: string, input: RejectInput) =>
    write((db, ctx) => {
      const { recollection } = rejectSample(db, id, input, ctx)
      return { recollectionId: recollection?.id ?? null }
    }),
}
