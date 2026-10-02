import { isAbnormal, isCriticalFlag, parseNumeric } from '@/domain/flags'
import type { CriticalState } from '@/domain/types'
import { isItemLive } from '@/domain/workflow'
import { must } from '../engine/core'
import {
  acknowledgeCritical,
  documentCritical,
  escalateCritical,
  voidCritical,
  type DocumentCriticalInput,
} from '../engine/critical'
import {
  addClinicalNote,
  registerPatient,
  updatePatient,
  type RegisterPatientInput,
  type UpdatePatientInput,
} from '../engine/patients'
import { read, write } from './runtime'
import type {
  CriticalFilters,
  CriticalRow,
  PatientDetail,
  PatientFilters,
  PatientResultRow,
  PatientRow,
  TrendSeries,
} from './types'
import {
  criticalRow,
  matchesQuery,
  orderRow,
  patientSearchFields,
  patientSummary,
  reportRow,
  sampleRow,
  staffName,
} from './views'

export type { DocumentCriticalInput, RegisterPatientInput, UpdatePatientInput }

const STATE_ORDER: CriticalState[] = [
  'escalated',
  'open',
  'contacting',
  'notified',
  'acknowledged',
  'voided',
]

const PENDING_STATES: CriticalState[] = [
  'open',
  'contacting',
  'notified',
  'escalated',
]

export const criticalApi = {
  list: (filters: CriticalFilters = {}) =>
    read((db, { now }) => {
      const all = Object.values(db.criticals)
        .filter((c) => {
          const p = db.patients[c.patientId]!
          return matchesQuery(filters.q, [
            ...patientSearchFields(p),
            db.analytes[c.analyteId]?.name,
            db.orders[c.orderId]?.orderNo,
          ])
        })
        .map((c) => criticalRow(db, c, now))
      const counts: Record<
        CriticalState | 'all' | 'pending' | 'overdue',
        number
      > = {
        all: all.length,
        pending: 0,
        overdue: 0,
        open: 0,
        contacting: 0,
        notified: 0,
        escalated: 0,
        acknowledged: 0,
        voided: 0,
      }
      for (const c of all) {
        counts[c.state] += 1
        if (PENDING_STATES.includes(c.state)) counts.pending += 1
        if (c.overdue) counts.overdue += 1
      }
      const status = filters.status ?? 'all'
      const rows: CriticalRow[] = all
        .filter(
          (c) =>
            status === 'all' ||
            (status === 'pending'
              ? PENDING_STATES.includes(c.state)
              : c.state === status),
        )
        .toSorted(
          (a, b) =>
            Number(b.overdue) - Number(a.overdue) ||
            STATE_ORDER.indexOf(a.state) - STATE_ORDER.indexOf(b.state) ||
            b.detectedAt - a.detectedAt,
        )
      return { rows, counts }
    }),

  get: (id: string) =>
    read((db, { now }) =>
      criticalRow(db, must(db.criticals, id, 'critical'), now),
    ),

  /** Records one notification attempt (reached or not). */
  document: (id: string, input: DocumentCriticalInput) =>
    write((db, ctx) => void documentCritical(db, id, input, ctx)),

  acknowledge: (
    id: string,
    input: { acknowledgedAt: number; readBack: boolean; remarks?: string },
  ) => write((db, ctx) => void acknowledgeCritical(db, id, input, ctx)),

  escalate: (id: string, input: { to: string; reason: string }) =>
    write((db, ctx) => void escalateCritical(db, id, input, ctx)),

  void: (id: string, reason: string) =>
    write((db, ctx) => void voidCritical(db, id, reason, ctx)),
}

export const patientsApi = {
  list: (filters: PatientFilters = {}) =>
    read((db, { index, now }) => {
      const rows: PatientRow[] = []
      for (const p of Object.values(db.patients)) {
        if (filters.encounter && p.encounter.type !== filters.encounter)
          continue
        const orders = (index.ordersByPatient.get(p.id) ?? []).filter(
          (o) => o.state !== 'draft',
        )
        const samples = orders.flatMap(
          (o) => index.samplesByOrder.get(o.id) ?? [],
        )
        // Order ids and accession numbers find the patient too.
        if (
          !matchesQuery(filters.q, [
            ...patientSearchFields(p),
            ...orders.map((o) => o.orderNo),
            ...samples.map((s) => s.accessionNo),
          ])
        )
          continue
        const latest = orders.toSorted(
          (a, b) => (b.orderedAt ?? 0) - (a.orderedAt ?? 0),
        )[0]
        const latestRow = latest ? orderRow(db, index, latest, now) : undefined
        const items = orders.flatMap((o) => index.itemsByOrder.get(o.id) ?? [])
        const openCriticals = items.reduce(
          (n, i) =>
            n +
            (index.criticalsByItem.get(i.id) ?? []).filter(
              (c) => c.status === 'open' || c.status === 'notified',
            ).length,
          0,
        )
        const abnormal = items
          .filter(
            (i) =>
              i.status === 'validated' &&
              (i.validatedAt ?? 0) > now - 30 * 86_400_000,
          )
          .reduce(
            (n, i) =>
              n +
              (index.resultsByItem.get(i.id) ?? []).filter((r) =>
                isAbnormal(r.flag),
              ).length,
            0,
          )
        const activeOrders = orders.filter((o) => {
          const row = orderRow(db, index, o, now)
          return row.status !== 'completed' && row.status !== 'cancelled'
        }).length
        if (filters.flag === 'critical' && openCriticals === 0) continue
        if (filters.flag === 'abnormal' && abnormal === 0) continue
        if (filters.flag === 'active' && activeOrders === 0) continue
        rows.push({
          ...patientSummary(p),
          ...(latestRow
            ? {
                latestOrder: {
                  id: latestRow.id,
                  orderNo: latestRow.orderNo,
                  orderedAt: latestRow.orderedAt,
                  tests: latestRow.tests
                    .filter((t) => t.active)
                    .map((t) => t.shortName),
                  status: latestRow.status,
                },
              }
            : {}),
          activeOrders,
          openCriticals,
          abnormalResults: abnormal,
          lastVisitAt: latest?.orderedAt ?? p.registeredAt,
          registeredAt: p.registeredAt,
        })
      }
      return rows.toSorted((a, b) => b.lastVisitAt - a.lastVisitAt)
    }),

  get: (id: string) =>
    read((db, { index, now }): PatientDetail => {
      const p = must(db.patients, id, 'patient')
      const orders = (index.ordersByPatient.get(id) ?? []).filter(
        (o) => o.state !== 'draft',
      )
      const orderRows = orders
        .map((o) => orderRow(db, index, o, now))
        .toSorted((a, b) => (b.orderedAt ?? 0) - (a.orderedAt ?? 0))
      const samples = orders.flatMap(
        (o) => index.samplesByOrder.get(o.id) ?? [],
      )
      const results: PatientResultRow[] = []
      for (const o of orders) {
        for (const item of (index.itemsByOrder.get(o.id) ?? []).filter(
          isItemLive,
        )) {
          if (
            !['entered', 'reviewed', 'validated', 'held'].includes(item.status)
          )
            continue
          for (const r of index.resultsByItem.get(item.id) ?? []) {
            if (r.value === null) continue
            const analyte = db.analytes[r.analyteId]!
            results.push({
              resultId: r.id,
              itemId: item.id,
              orderId: o.id,
              orderNo: o.orderNo,
              analyteId: r.analyteId,
              name: analyte.name,
              testName: item.testName,
              department: item.department,
              unit: r.unit,
              value: r.value,
              flag: r.flag,
              range: r.range,
              at: item.validatedAt ?? item.enteredAt ?? r.updatedAt,
              status: item.status,
              critical: isCriticalFlag(analyte, r.flag),
            })
          }
        }
      }
      results.sort((a, b) => b.at - a.at)
      const byAnalyte = new Map<string, PatientResultRow[]>()
      for (const r of results) {
        if (r.status !== 'validated' || !parseNumeric(r.value)) continue
        const list = byAnalyte.get(r.analyteId) ?? []
        list.push(r)
        byAnalyte.set(r.analyteId, list)
      }
      const trends: TrendSeries[] = [...byAnalyte.entries()]
        .filter(([, list]) => list.length >= 2)
        .map(([analyteId, list]) => ({
          analyteId,
          name: list[0]!.name,
          unit: list[0]!.unit,
          range: list[0]!.range,
          points: list.toReversed().map((r) => ({
            at: r.at,
            value: parseNumeric(r.value)!.value,
            flag: r.flag,
          })),
        }))
        .toSorted((a, b) => b.points.length - a.points.length)
      const timeline: PatientDetail['timeline'] = []
      // Enum values travel as "enum:group.value" and are shown translated.
      const enumParam = (group: string, value: unknown) =>
        typeof value === 'string' && value ? `enum:${group}.${value}` : ''
      for (const o of orders) {
        for (const h of o.history) {
          // The specimen's own entry records rejections (with the reason).
          if (h.type === 'rejection-recorded') continue
          timeline.push({
            id: h.id,
            at: h.at,
            type: `order-${h.type}`,
            params: {
              orderNo: o.orderNo ?? '',
              ...h.params,
              ...(h.type === 'cancelled'
                ? { reason: enumParam('cancelReason', h.params?.reason) }
                : {}),
            },
            byName: staffName(db, h.by),
            link: `/orders?order=${o.id}`,
          })
        }
      }
      for (const s of samples) {
        for (const h of s.history) {
          if (
            ![
              'collected',
              'received',
              'rejected',
              'results-entered',
              'rerun-requested',
              'completed',
            ].includes(h.type)
          )
            continue
          timeline.push({
            id: h.id,
            at: h.at,
            type: `sample-${h.type}`,
            params: {
              accession: s.accessionNo ?? '',
              ...h.params,
              ...(h.type === 'rejected'
                ? { reason: enumParam('rejectionReason', h.params?.reason) }
                : {}),
            },
            byName: staffName(db, h.by),
            link: `/specimens/${s.id}`,
          })
        }
      }
      for (const r of Object.values(db.reports)) {
        if (r.patientId !== id) continue
        const link = `/reports/${r.id}`
        for (const v of r.versions)
          timeline.push({
            id: `${r.id}_v${v.version}`,
            at: v.releasedAt,
            type:
              v.kind === 'preliminary'
                ? 'report-preliminary'
                : v.kind === 'amended' || (!v.kind && v.version > 1)
                  ? 'report-corrected'
                  : 'report-released',
            params: {
              report: r.reportNo,
              version: v.version,
              ...(v.correctionReason
                ? { reason: enumParam('correctionReason', v.correctionReason) }
                : {}),
            },
            byName: staffName(db, v.releasedBy),
            link,
          })
        if (r.pendingAmendment)
          timeline.push({
            id: `${r.id}_amend`,
            at: r.pendingAmendment.requestedAt,
            type: 'report-amendment-requested',
            params: {
              report: r.reportNo,
              reason: enumParam('correctionReason', r.pendingAmendment.reason),
            },
            byName: staffName(db, r.pendingAmendment.requestedBy),
            link,
          })
        if (r.withdrawn)
          timeline.push({
            id: `${r.id}_withdrawn`,
            at: r.withdrawn.at,
            type: 'report-withdrawn',
            params: { report: r.reportNo, reason: r.withdrawn.reason },
            byName: staffName(db, r.withdrawn.by),
            link,
          })
      }
      for (const c of Object.values(db.criticals)) {
        if (c.patientId !== id || c.status === 'voided') continue
        const analyte = db.analytes[c.analyteId]
        const what = `${analyte?.name ?? c.analyteId} ${c.value}${analyte?.unit ? ` ${analyte.unit}` : ''}`
        const link = `/critical-results?status=all&q=${encodeURIComponent(db.samples[c.sampleId]?.accessionNo ?? '')}`
        timeline.push({
          id: `${c.id}_detected`,
          at: c.detectedAt,
          type: 'critical-value-detected',
          params: { what },
          byName: '',
          link,
        })
        if (c.acknowledgedAt && c.notifiedTo)
          timeline.push({
            id: `${c.id}_ack`,
            at: c.acknowledgedAt,
            type: 'critical-value-communicated',
            params: { what, to: c.notifiedTo },
            byName: staffName(db, c.notifiedBy),
            link,
          })
        if (c.escalatedAt && c.escalatedTo)
          timeline.push({
            id: `${c.id}_esc`,
            at: c.escalatedAt,
            type: 'critical-escalated',
            params: { to: c.escalatedTo, reason: c.escalationReason ?? '' },
            byName: staffName(db, c.escalatedBy),
            link,
          })
      }
      timeline.sort((a, b) => b.at - a.at)
      return {
        patient: {
          ...patientSummary(p),
          city: p.city,
          state: p.state,
          registeredAt: p.registeredAt,
          notes: p.notes,
          ...(p.email ? { email: p.email } : {}),
          ...(p.encounter.attendingDoctorId &&
          db.doctors[p.encounter.attendingDoctorId]
            ? {
                attendingDoctor:
                  db.doctors[p.encounter.attendingDoctorId]!.name,
              }
            : {}),
        },
        orders: orderRows,
        samples: samples
          .map((s) => sampleRow(db, index, s, now))
          .toSorted((a, b) => b.createdAt - a.createdAt),
        results,
        reports: Object.values(db.reports)
          .filter(
            (r) =>
              r.patientId === id &&
              db.orders[r.orderId]?.state === 'active' &&
              (index.itemsByReport.get(r.id) ?? []).some(isItemLive),
          )
          .map((r) => reportRow(db, index, r))
          .toSorted(
            (a, b) =>
              (b.releasedAt ?? b.createdAt) - (a.releasedAt ?? a.createdAt),
          ),
        criticals: Object.values(db.criticals)
          .filter((c) => c.patientId === id && c.status !== 'voided')
          .map((c) => criticalRow(db, c, now))
          .toSorted((a, b) => b.detectedAt - a.detectedAt),
        timeline: timeline.slice(0, 200),
        trends,
      }
    }),

  register: (input: RegisterPatientInput) =>
    write((db, ctx) => {
      const p = registerPatient(db, input, ctx)
      return { id: p.id, uhid: p.uhid }
    }),

  update: (id: string, patch: UpdatePatientInput) =>
    write((db, ctx) => void updatePatient(db, id, patch, ctx)),

  addNote: (id: string, text: string) =>
    write((db, ctx) => void addClinicalNote(db, id, text, ctx)),
}
