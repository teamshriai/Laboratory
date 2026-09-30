// Read models for the overview screens: dashboard, work queue, search,
// notifications, TAT, analytics and departments.

import { criticalState, isCriticalPending } from '@/domain/critical'
import { equipmentStatus, EXPIRY_WARNING_DAYS } from '@/domain/stock'
import { itemTat, type TatInfo } from '@/domain/tat'
import {
  DAY,
  HOUR,
  MINUTE,
  istDay,
  istHour,
  startOfIstDay,
} from '@/domain/time'
import {
  DEPARTMENTS,
  ENCOUNTER_TYPES,
  type DailyStat,
  type DepartmentId,
  type EncounterType,
  type OrderItem,
  type Priority,
} from '@/domain/types'
import {
  isItemEntered,
  isItemLive,
  isReportReleased,
  PIPELINE_STAGES,
  type PipelineStage,
} from '@/domain/workflow'
import type { LabDb } from '../db/schema'
import { dayShareUntilHour } from '../db/seed/stats'
import {
  markAllNotificationsRead,
  markNotificationsRead,
  markSummaryRead,
} from '../engine/notifications'
import type { DbIndex } from './index-cache'
import { read, write } from './runtime'
import { byUrgency } from './samples'
import type {
  AnalyticsView,
  DashboardView,
  DepartmentDetail,
  DepartmentSummary,
  NotificationsView,
  SearchResults,
  SummaryKey,
  SummaryNotification,
  TatTestRow,
  TatView,
  WorkQueueItem,
  WorkQueueView,
  WorkStage,
} from './types'
import {
  criticalRow,
  matchesQuery,
  patientSearchFields,
  patientSummary,
  sampleRow,
  staffName,
} from './views'
import { equipmentRows, inventorySnapshot, qcRows } from './operations'

const PRIORITY_RANK: Record<Priority, number> = {
  stat: 0,
  urgent: 1,
  routine: 2,
}

function liveItems(db: LabDb) {
  return Object.values(db.items).filter(
    (i) => isItemLive(i) && db.orders[i.orderId]?.state === 'active',
  )
}

function median(values: number[]) {
  if (values.length === 0) return null
  const s = values.toSorted((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2
}

const avg = (values: number[]) =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : null

function tatOf(index: DbIndex, item: OrderItem, now: number): TatInfo {
  return itemTat(
    item,
    item.sampleId ? index.samplesById.get(item.sampleId) : undefined,
    now,
  )
}

function yesterdayStat(db: LabDb): DailyStat | undefined {
  return db.dailyStats.at(-1)
}

export function todayStat(db: LabDb, index: DbIndex, now: number): DailyStat {
  const today = startOfIstDay(now)
  const samples = Object.values(db.samples).filter(
    (s) => (s.collectedAt ?? 0) >= today,
  )
  const items = liveItems(db).filter(
    (i) => (db.orders[i.orderId]!.orderedAt ?? 0) >= today,
  )
  const validatedToday = Object.values(db.items).filter(
    (i) =>
      i.active && i.status === 'validated' && (i.validatedAt ?? 0) >= today,
  )
  const tats = validatedToday.map((i) => tatOf(index, i, now))
  const mins = tats
    .filter((t) => t.startAt !== null)
    .map((t) => t.elapsedMs / MINUTE)
  const rejected = Object.values(db.samples).filter(
    (s) => s.rejection && s.rejection.at >= today,
  )
  const criticals = Object.values(db.criticals).filter(
    (c) => c.detectedAt >= today && c.status !== 'voided',
  )
  const byDepartment = Object.fromEntries(
    DEPARTMENTS.map((d) => [d, 0]),
  ) as Record<DepartmentId, number>
  for (const i of items) byDepartment[i.department] += 1
  const byEncounter = Object.fromEntries(
    ENCOUNTER_TYPES.map((e) => [e, 0]),
  ) as Record<EncounterType, number>
  for (const s of samples) byEncounter[db.orders[s.orderId]!.encounter] += 1
  const rejectionsByReason: DailyStat['rejectionsByReason'] = {}
  for (const s of rejected) {
    const r = s.rejection!.reason as keyof DailyStat['rejectionsByReason']
    rejectionsByReason[r] = (rejectionsByReason[r] ?? 0) + 1
  }
  const byHour = Array.from({ length: 24 }, () => 0)
  for (const s of samples) byHour[istHour(s.collectedAt!)]! += 1
  return {
    day: istDay(now),
    samples: samples.length,
    tests: items.length,
    completed: validatedToday.length,
    rejected: rejected.length,
    criticals: criticals.length,
    criticalsAcknowledged: criticals.filter((c) => c.status === 'acknowledged')
      .length,
    revenue: items.reduce((sum, i) => sum + i.price, 0),
    tatAvgMin: Math.round(avg(mins) ?? 0),
    tatMedianMin: Math.round(median(mins) ?? 0),
    delayedPct: tats.length
      ? Number(
          (
            (tats.filter((t) => t.state === 'missed').length / tats.length) *
            100
          ).toFixed(1),
        )
      : 0,
    byDepartment,
    byEncounter,
    rejectionsByReason,
    byHour,
    consumption: {
      tubes: Math.round(samples.length * 1.1),
      syringes: Math.round(samples.length * 0.9),
      containers: Math.round(samples.length * 0.3),
      gloves: Math.ceil(samples.length / 60),
      'pipette-tips': 1,
      slides: Math.ceil(samples.length / 90),
      labels: 1,
      'culture-media': Math.round(
        samples.filter((s) => s.department === 'microbiology').length * 2,
      ),
    },
  }
}

export const dashboardApi = {
  get: () =>
    read((db, { index, now }): DashboardView => {
      const today = startOfIstDay(now)
      const hourNow = istHour(now)
      const share = dayShareUntilHour(hourNow, (now % HOUR) / HOUR)
      const y = yesterdayStat(db)
      const atThisTime = (v: number | undefined) =>
        v === undefined ? null : Math.round(v * share)
      const live = liveItems(db)
      const inLab = (i: OrderItem) => {
        const s = i.sampleId ? index.samplesById.get(i.sampleId) : undefined
        return (
          s !== undefined &&
          ['received', 'processing', 'on_hold'].includes(s.status)
        )
      }
      const pending = live.filter((i) =>
        ['pending', 'draft', 'returned'].includes(i.status),
      )
      const processing = pending.filter(inLab)
      const awaiting = live.filter(
        (i) =>
          i.status === 'entered' ||
          i.status === 'held' ||
          i.status === 'reviewed',
      )
      const open = Object.values(db.criticals).filter(
        (c) => c.status === 'open' || c.status === 'notified',
      )
      const criticalsToday = Object.values(db.criticals).filter(
        (c) => c.detectedAt >= today && c.status !== 'voided',
      )
      const inProgressTat = live
        .filter((i) => i.status !== 'validated')
        .map((i) => ({ i, t: tatOf(index, i, now) }))
      const breached = inProgressTat.filter((x) => x.t.state === 'breached')
      const approaching = inProgressTat.filter(
        (x) => x.t.state === 'approaching',
      )
      const validatedToday = Object.values(db.items).filter(
        (i) =>
          i.active && i.status === 'validated' && (i.validatedAt ?? 0) >= today,
      )
      const doneTats = validatedToday.map((i) => tatOf(index, i, now))
      const missedToday = doneTats.filter((t) => t.state === 'missed').length
      const rejectedToday = Object.values(db.samples).filter(
        (s) => s.rejection && s.rejection.at >= today,
      )
      const awaitingRecollection = Object.values(db.samples).filter(
        (s) => s.recollectionOfId && s.status === 'pending_collection',
      ).length
      const releasedToday = Object.values(db.reports).filter(
        (r) => (r.versions[0]?.releasedAt ?? 0) >= today,
      )
      const samplesToday = Object.values(db.samples).filter(
        (s) => (s.collectedAt ?? 0) >= today,
      )
      const oldestProcessing = processing.reduce(
        (min, i) =>
          Math.min(min, index.samplesById.get(i.sampleId!)?.receivedAt ?? now),
        now,
      )
      const mins = doneTats
        .filter((t) => t.startAt !== null)
        .map((t) => t.elapsedMs / MINUTE)

      const workload = DEPARTMENTS.map((department) => {
        const dept = live.filter((i) => i.department === department)
        return {
          department,
          pending: dept.filter(
            (i) => i.status !== 'validated' && !inLab(i) && !isItemEntered(i),
          ).length,
          processing: dept.filter(
            (i) => i.status !== 'validated' && (inLab(i) || isItemEntered(i)),
          ).length,
          completed: dept.filter(
            (i) => i.status === 'validated' && (i.validatedAt ?? 0) >= today,
          ).length,
        }
      })

      const pipeline = Object.fromEntries(
        PIPELINE_STAGES.map((s) => [s, 0]),
      ) as Record<PipelineStage, number>
      for (const s of Object.values(db.samples)) {
        if (s.status === 'rejected' || s.status === 'discarded') continue
        if (db.orders[s.orderId]?.state !== 'active') continue
        const done = s.status === 'completed'
        if (done && (s.completedAt ?? 0) < today) continue
        pipeline[sampleRow(db, index, s, now).stage] += 1
      }

      const hourly = Array.from({ length: hourNow + 1 }, (_, hour) => ({
        hour,
        today: samplesToday.filter((s) => istHour(s.collectedAt!) === hour)
          .length,
        yesterday: y?.byHour[hour] ?? 0,
      }))

      const eqRows = equipmentRows(db, index, now)
      const history = db.dailyStats.slice(-14)
      const todaySoFar = todayStat(db, index, now)
      const qcRunsToday = Object.values(db.qcRuns).filter((r) => r.at >= today)

      return {
        generatedAt: now,
        kpis: {
          samplesToday: {
            value: samplesToday.length,
            yesterday: atThisTime(y?.samples),
          },
          pendingTests: {
            value: pending.length,
            yesterday: null,
            detail: {
              key: 'stat',
              value: pending.filter(
                (i) => db.orders[i.orderId]!.priority === 'stat',
              ).length,
            },
          },
          inProcessing: {
            value: processing.length,
            yesterday: null,
            detail: {
              key: 'oldestMin',
              value: Math.round((now - oldestProcessing) / MINUTE),
            },
          },
          awaitingValidation: {
            value: awaiting.length,
            yesterday: null,
            detail: {
              key: 'critical',
              value: awaiting.filter((i) =>
                (index.criticalsByItem.get(i.id) ?? []).some(
                  (c) => c.status !== 'voided',
                ),
              ).length,
            },
          },
          criticalResults: {
            value: criticalsToday.length,
            yesterday: atThisTime(y?.criticals),
            detail: { key: 'open', value: open.length },
          },
          delayedTests: {
            value: breached.length + missedToday,
            yesterday: y
              ? Math.round((y.delayedPct / 100) * y.tests * share)
              : null,
            detail: { key: 'breached', value: breached.length },
          },
          rejectedSamples: {
            value: rejectedToday.length,
            yesterday: atThisTime(y?.rejected),
            detail: { key: 'recollect', value: awaitingRecollection },
          },
          completedReports: {
            value: releasedToday.length,
            yesterday: y ? Math.round(y.samples * share * 0.42) : null,
          },
          validatedTests: {
            value: validatedToday.length,
            yesterday: atThisTime(y?.completed),
          },
        },
        trend: {
          days: history.map((d) => d.day),
          samples: history.map((d) => d.samples),
          criticals: history.map((d) => d.criticals),
          delayedPct: history.map((d) => d.delayedPct),
          rejected: history.map((d) => d.rejected),
          completed: history.map((d) => d.completed),
          revenue: history.map((d) => d.revenue),
        },
        tatByDepartment: DEPARTMENTS.map((d) =>
          departmentSummary(db, index, d, now),
        ).flatMap((d) =>
          d.tatOnTimePct === null
            ? []
            : [
                {
                  department: d.department,
                  onTimePct: Math.round(d.tatOnTimePct * 10) / 10,
                  completed: d.completed,
                },
              ],
        ),
        encounterMix: todaySoFar.byEncounter,
        revenue: {
          today: todaySoFar.revenue,
          yesterday: atThisTime(y?.revenue),
        },
        workload,
        pipeline,
        criticals: open
          .map((c) => criticalRow(db, c, now))
          .toSorted((a, b) => a.detectedAt - b.detectedAt)
          .slice(0, 5),
        tat: {
          onTimePct: doneTats.length
            ? Math.round(
                ((doneTats.length - missedToday) / doneTats.length) * 1000,
              ) / 10
            : null,
          avgMin: avg(mins),
          medianMin: median(mins),
          breached: breached.length,
          approaching: approaching.length,
          worst: [...breached, ...approaching]
            .toSorted((a, b) => b.t.ratio - a.t.ratio)
            .slice(0, 8)
            .map(({ i, t }) => ({
              itemId: i.id,
              sampleId: i.sampleId ?? '',
              accessionNo:
                index.samplesById.get(i.sampleId ?? '')?.accessionNo ?? null,
              testName: db.tests[i.testId]?.shortName ?? i.testName,
              patientName: db.patients[db.orders[i.orderId]!.patientId]!.name,
              tat: t,
            })),
        },
        hourly,
        activity: db.activity
          .slice(0, 14)
          .map((a) => ({ ...a, byName: staffName(db, a.by) })),
        analyzers: eqRows
          .filter((e) => e.testIds.length > 0)
          .map((e) => ({
            id: e.id,
            name: e.name,
            model: `${e.manufacturer} ${e.model}`,
            department: e.department,
            status: e.effectiveStatus,
            utilizationPct: e.utilizationPct,
            testsToday: e.testsToday,
            qcToday: e.qcToday,
          })),
        qcToday: {
          pass: qcRunsToday.filter((r) => r.result === 'pass').length,
          warning: qcRunsToday.filter((r) => r.result === 'warning').length,
          fail: qcRunsToday.filter((r) => r.result === 'fail').length,
        },
        stockAlerts: inventorySnapshot(db, index, now).alerts.slice(0, 6),
      }
    }),
}

export const workQueueApi = {
  get: (department?: DepartmentId) =>
    read((db, { index, now }): WorkQueueView => {
      const buckets = new Map<WorkStage, WorkQueueItem[]>()
      const add = (item: WorkQueueItem) => {
        const list = buckets.get(item.stage) ?? []
        list.push(item)
        buckets.set(item.stage, list)
      }
      for (const s of Object.values(db.samples)) {
        if (department && s.department !== department) continue
        const order = db.orders[s.orderId]!
        if (order.state !== 'active') continue
        const row = sampleRow(db, index, s, now)
        const tests = row.tests.map((t) => t.shortName).join(', ')
        const base = {
          priority: order.priority,
          patient: row.patient,
          tat: row.tat,
        }
        if (s.status === 'pending_collection')
          add({
            ...base,
            id: s.id,
            stage: s.recollectionOfId ? 'recollect' : 'collect',
            title: row.patient.name,
            subtitle: tests,
            since: s.createdAt,
            link: `/laboratory/collection?collect=${s.id}`,
          })
        else if (s.status === 'collected')
          add({
            ...base,
            id: s.id,
            stage: 'receive',
            title: row.patient.name,
            subtitle: `${s.accessionNo} · ${tests}`,
            since: s.collectedAt ?? s.createdAt,
            link: `/laboratory/samples?status=collected&sample=${s.id}`,
          })
        else if (s.status === 'received')
          add({
            ...base,
            id: s.id,
            stage: 'process',
            title: row.patient.name,
            subtitle: `${s.accessionNo} · ${tests}`,
            since: s.receivedAt ?? s.createdAt,
            link: `/laboratory/samples/${s.id}`,
          })
        else if (s.status === 'processing' && !row.allEntered)
          add({
            ...base,
            id: s.id,
            stage: 'enter',
            title: row.patient.name,
            subtitle: `${s.accessionNo} · ${tests}`,
            since: s.processingStartedAt ?? s.createdAt,
            link: `/laboratory/results/${s.id}`,
          })
      }
      for (const item of liveItems(db)) {
        if (!['entered', 'held', 'reviewed'].includes(item.status)) continue
        if (department && item.department !== department) continue
        const order = db.orders[item.orderId]!
        add({
          id: item.id,
          stage: 'validate',
          title: db.patients[order.patientId]!.name,
          subtitle: item.testName,
          priority: order.priority,
          patient: patientSummary(db.patients[order.patientId]!),
          since: item.enteredAt ?? now,
          tat: tatOf(index, item, now),
          link: `/laboratory/validation?item=${item.id}`,
        })
      }
      for (const c of Object.values(db.criticals)) {
        if (c.status !== 'open' && c.status !== 'notified') continue
        const item = db.items[c.orderItemId]
        if (department && item?.department !== department) continue
        const result = db.results[c.resultId]
        add({
          id: c.id,
          stage: 'acknowledge',
          title: db.patients[c.patientId]!.name,
          subtitle:
            `${db.analytes[c.analyteId]?.name} ${c.value} ${result?.unit ?? ''}`.trim(),
          priority: 'stat',
          patient: patientSummary(db.patients[c.patientId]!),
          since: c.detectedAt,
          tat: null,
          link: `/laboratory/critical-values?alert=${c.id}`,
        })
      }
      for (const r of Object.values(db.reports)) {
        if (department && r.department !== department) continue
        if (isReportReleased(r)) continue
        const items = (index.itemsByReport.get(r.id) ?? []).filter(isItemLive)
        if (items.length === 0 || !items.every((i) => i.status === 'validated'))
          continue
        const order = db.orders[r.orderId]!
        if (order.state !== 'active') continue
        add({
          id: r.id,
          stage: 'release',
          title: db.patients[r.patientId]!.name,
          subtitle: `${r.reportNo} · ${items.map((i) => db.tests[i.testId]?.shortName).join(', ')}`,
          priority: order.priority,
          patient: patientSummary(db.patients[r.patientId]!),
          since: Math.max(...items.map((i) => i.validatedAt ?? 0)),
          tat: null,
          link: `/laboratory/reports/${r.id}`,
        })
      }
      const stages: WorkStage[] = [
        'acknowledge',
        'collect',
        'recollect',
        'receive',
        'process',
        'enter',
        'validate',
        'release',
      ]
      return {
        stages: stages.map((stage) => {
          const list = (buckets.get(stage) ?? []).toSorted(
            (a, b) =>
              PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
              (b.tat?.ratio ?? 0) - (a.tat?.ratio ?? 0) ||
              a.since - b.since,
          )
          return { stage, count: list.length, items: list.slice(0, 6) }
        }),
      }
    }),
}

export const searchApi = {
  query: (q: string) =>
    read((db, { now }): SearchResults => {
      const term = q.trim()
      if (term.length < 2)
        return {
          patients: [],
          orders: [],
          samples: [],
          tests: [],
          reports: [],
          equipment: [],
          reagents: [],
          criticals: [],
        }
      const lower = term.toLowerCase()
      const patients = Object.values(db.patients)
        .filter((p) => matchesQuery(term, patientSearchFields(p)))
        .slice(0, 6)
        .map(patientSummary)
      const orders = Object.values(db.orders)
        .filter((o) => o.state !== 'draft' && matchesQuery(term, [o.orderNo]))
        .slice(0, 5)
        .map((o) => ({
          id: o.id,
          orderNo: o.orderNo,
          patientName: db.patients[o.patientId]!.name,
          tests: Object.values(db.items)
            .filter((i) => i.orderId === o.id && isItemLive(i))
            .map((i) => db.tests[i.testId]?.shortName ?? i.testName),
          status: 'new' as const,
        }))
      // In-transit samples first (the ones to receive), then the newest.
      const samples = Object.values(db.samples)
        .filter((s) => s.accessionNo && matchesQuery(term, [s.accessionNo]))
        .toSorted(
          (a, b) =>
            Number(b.status === 'collected') -
              Number(a.status === 'collected') || b.createdAt - a.createdAt,
        )
        .slice(0, 5)
        .map((s) => ({
          id: s.id,
          accessionNo: s.accessionNo,
          patientName: db.patients[s.patientId]!.name,
          status: s.status,
          department: s.department,
          container: s.container,
        }))
      const tests = Object.values(db.tests)
        .map((t) => {
          const direct = [
            t.name,
            t.shortName,
            t.code,
            ...(t.keywords ?? []),
          ].some((f) => f.toLowerCase().includes(lower))
          const analyte = t.analyteIds
            .map((id) => db.analytes[id])
            .find((a) => a?.name.toLowerCase().includes(lower))
          if (!direct && !analyte) return null
          return {
            id: t.id,
            code: t.code,
            name: t.name,
            department: t.department,
            ...(analyte && !direct ? { matchedAnalyte: analyte.name } : {}),
          }
        })
        .filter((x) => x !== null)
        .slice(0, 6)
      const reports = Object.values(db.reports)
        .filter(
          (r) =>
            r.versions.length > 0 &&
            matchesQuery(term, [r.reportNo, db.patients[r.patientId]?.name]),
        )
        .slice(0, 5)
        .map((r) => ({
          id: r.id,
          reportNo: r.reportNo,
          patientName: db.patients[r.patientId]!.name,
          status:
            r.versions.length > 1
              ? ('corrected' as const)
              : ('released' as const),
          department: r.department,
        }))
      const equipment = Object.values(db.equipment)
        .filter((eq) =>
          matchesQuery(term, [eq.name, eq.model, eq.serialNo, eq.manufacturer]),
        )
        .slice(0, 4)
        .map((eq) => ({
          id: eq.id,
          name: eq.name,
          model: eq.model,
          serialNo: eq.serialNo,
          department: eq.department,
          status: equipmentStatus(eq, now),
          connection: eq.connection ?? ('online' as const),
        }))
      const reagents: SearchResults['reagents'] = []
      for (const r of Object.values(db.reagents)) {
        if (reagents.length >= 5) break
        if (matchesQuery(term, [r.name, r.sku, r.manufacturer])) {
          reagents.push({ id: r.id, name: r.name, department: r.department })
          continue
        }
        const lot = Object.values(db.lots).find(
          (l) => l.reagentId === r.id && matchesQuery(term, [l.lotNumber]),
        )
        if (lot)
          reagents.push({
            id: r.id,
            name: r.name,
            department: r.department,
            lotId: lot.id,
            lotNumber: lot.lotNumber,
            lotState: lot.state,
          })
      }
      const criticals = Object.values(db.criticals)
        .filter((c) => {
          if (!isCriticalPending(c)) return false
          const analyte = db.analytes[c.analyteId]
          return matchesQuery(term, [
            db.patients[c.patientId]?.name,
            analyte?.name,
            analyte?.id,
          ])
        })
        .slice(0, 4)
        .map((c) => {
          const analyte = db.analytes[c.analyteId]
          return {
            id: c.id,
            patientName: db.patients[c.patientId]?.name ?? '',
            analyteName: analyte?.name ?? c.analyteId,
            value: c.value,
            unit: analyte?.unit ?? '',
            state: criticalState(c),
          }
        })
      return {
        patients,
        orders,
        samples,
        tests,
        reports,
        equipment,
        reagents,
        criticals,
      }
    }, 'search'),
}

function summaries(
  db: LabDb,
  index: DbIndex,
  now: number,
): SummaryNotification[] {
  const counts: Record<SummaryKey, number> = {
    'critical-pending': Object.values(db.criticals).filter(
      (c) => c.status === 'open' || c.status === 'notified',
    ).length,
    'tat-approaching': liveItems(db).filter((i) => {
      if (i.status === 'validated') return false
      const t = tatOf(index, i, now)
      return t.state === 'approaching' || t.state === 'breached'
    }).length,
    'lots-expiring': Object.values(db.lots).filter(
      (l) =>
        l.state === 'active' &&
        l.expiresAt > now &&
        l.expiresAt - now <= EXPIRY_WARNING_DAYS * DAY,
    ).length,
    'recollection-pending': Object.values(db.samples).filter(
      (s) => s.recollectionOfId && s.status === 'pending_collection',
    ).length,
  }
  const meta: Record<
    SummaryKey,
    { severity: SummaryNotification['severity']; link: string }
  > = {
    'critical-pending': {
      severity: 'danger',
      link: '/laboratory/critical-values?status=pending',
    },
    'tat-approaching': { severity: 'warning', link: '/laboratory/tat' },
    'lots-expiring': {
      severity: 'warning',
      link: '/laboratory/reagents?status=expiring-soon',
    },
    'recollection-pending': {
      severity: 'warning',
      link: '/laboratory/collection',
    },
  }
  return (Object.keys(counts) as SummaryKey[])
    .filter((key) => counts[key] > 0)
    .map((key) => ({
      key,
      count: counts[key],
      ...meta[key],
      read: db.summaryReads[key] === counts[key],
    }))
}

export const notificationsApi = {
  list: () =>
    read((db, { index, now }): NotificationsView => {
      const s = summaries(db, index, now)
      const items = db.notifications.slice(0, 60)
      return {
        summaries: s,
        items,
        unread:
          items.filter((n) => !n.read).length + s.filter((x) => !x.read).length,
      }
    }),
  markRead: (ids: string[]) =>
    write((db) => void markNotificationsRead(db, ids)),
  markSummaryRead: (key: SummaryKey, count: number) =>
    write((db) => void markSummaryRead(db, key, count)),
  markAllRead: () =>
    write((db) => {
      const idx = { now: Date.now() }
      const current = Object.fromEntries(
        summariesForWrite(db, idx.now).map((x) => [x.key, x.count]),
      )
      markAllNotificationsRead(db, current)
    }),
}

function summariesForWrite(db: LabDb, now: number) {
  // Writes run on a copy, so the read index is rebuilt for it.
  return summaries(db, buildLiteIndex(db), now)
}

function buildLiteIndex(db: LabDb): DbIndex {
  return { samplesById: new Map(Object.entries(db.samples)) } as DbIndex
}

function tatRows(
  db: LabDb,
  index: DbIndex,
  now: number,
  since: number,
  department?: DepartmentId,
): TatTestRow[] {
  const rows = new Map<string, { tests: OrderItem[] }>()
  for (const item of Object.values(db.items)) {
    if (!isItemLive(item)) continue
    if (department && item.department !== department) continue
    const sample = item.sampleId
      ? index.samplesById.get(item.sampleId)
      : undefined
    const relevant =
      (item.status === 'validated' && (item.validatedAt ?? 0) >= since) ||
      (item.status !== 'validated' && sample?.receivedAt)
    if (!relevant) continue
    const entry = rows.get(item.testId) ?? { tests: [] }
    entry.tests.push(item)
    rows.set(item.testId, entry)
  }
  return [...rows.entries()]
    .map(([testId, { tests }]) => {
      const test = db.tests[testId]!
      const tats = tests.map((i) => tatOf(index, i, now))
      const done = tats.filter((t) => t.state === 'met' || t.state === 'missed')
      const running = tats.filter(
        (t) =>
          t.state === 'on-track' ||
          t.state === 'approaching' ||
          t.state === 'breached',
      )
      const doneMins = done.map((t) => t.elapsedMs / MINUTE)
      return {
        testId,
        testName: test.name,
        shortName: test.shortName,
        department: test.department,
        targetHours: test.tatHours,
        completed: done.length,
        avgMin: avg(doneMins),
        medianMin: median(doneMins),
        inProgress: running.length,
        delayed:
          done.filter((t) => t.state === 'missed').length +
          running.filter((t) => t.state === 'breached').length,
        onTimePct: done.length
          ? (done.filter((t) => t.state === 'met').length / done.length) * 100
          : null,
        currentMaxMin: running.length
          ? Math.max(...running.map((t) => t.elapsedMs / MINUTE))
          : null,
      }
    })
    .toSorted(
      (a, b) => b.completed + b.inProgress - (a.completed + a.inProgress),
    )
}

export const tatApi = {
  get: (range: 'today' | '7d' = 'today') =>
    read((db, { index, now }): TatView => {
      const since =
        range === 'today' ? startOfIstDay(now) : startOfIstDay(now) - 6 * DAY
      const tests = tatRows(db, index, now, since)
      const all = Object.values(db.items).filter(
        (i) =>
          isItemLive(i) &&
          i.status === 'validated' &&
          (i.validatedAt ?? 0) >= since,
      )
      const done = all
        .map((i) => tatOf(index, i, now))
        .filter((t) => t.startAt !== null)
      const mins = done.map((t) => t.elapsedMs / MINUTE)
      const running = liveItems(db)
        .filter((i) => i.status !== 'validated')
        .map((i) => ({ i, t: tatOf(index, i, now) }))
        .filter((x) => x.t.startAt !== null)
      const atRisk = running
        .filter((x) => x.t.state === 'approaching' || x.t.state === 'breached')
        .toSorted((a, b) => b.t.ratio - a.t.ratio)
        .map(({ i, t }) => {
          const s = index.samplesById.get(i.sampleId!)!
          const order = db.orders[i.orderId]!
          return {
            itemId: i.id,
            sampleId: s.id,
            accessionNo: s.accessionNo,
            testName: i.testName,
            department: i.department,
            patient: patientSummary(db.patients[order.patientId]!),
            priority: order.priority,
            tat: t,
            stage: sampleRow(db, index, s, now).stage,
          }
        })
      return {
        summary: {
          onTimePct: done.length
            ? (done.filter((t) => t.state === 'met').length / done.length) * 100
            : null,
          avgMin: avg(mins),
          medianMin: median(mins),
          delayed:
            done.filter((t) => t.state === 'missed').length +
            running.filter((x) => x.t.state === 'breached').length,
          breachedNow: running.filter((x) => x.t.state === 'breached').length,
          approachingNow: running.filter((x) => x.t.state === 'approaching')
            .length,
        },
        tests,
        atRisk,
        byDepartment: DEPARTMENTS.map((department) => {
          const rows = tests.filter((t) => t.department === department)
          const completed = rows.reduce((n, r) => n + r.completed, 0)
          const weighted = rows
            .filter((r) => r.avgMin !== null)
            .reduce((n, r) => n + r.avgMin! * r.completed, 0)
          const onTime = rows
            .filter((r) => r.onTimePct !== null)
            .reduce((n, r) => n + (r.onTimePct! / 100) * r.completed, 0)
          return {
            department,
            avgMin: completed ? weighted / completed : null,
            onTimePct: completed ? (onTime / completed) * 100 : null,
            delayed: rows.reduce((n, r) => n + r.delayed, 0),
          }
        }),
      }
    }),
}

export const analyticsApi = {
  get: (days: 7 | 14 | 30 = 14) =>
    read((db, { index, now }): AnalyticsView => ({
      days: db.dailyStats.slice(-days),
      today: todayStat(db, index, now),
    })),
}

function departmentSummary(
  db: LabDb,
  index: DbIndex,
  department: DepartmentId,
  now: number,
): DepartmentSummary {
  const today = startOfIstDay(now)
  const items = liveItems(db).filter((i) => i.department === department)
  const inLab = (i: OrderItem) => {
    const s = i.sampleId ? index.samplesById.get(i.sampleId) : undefined
    return (
      s !== undefined &&
      ['received', 'processing', 'on_hold'].includes(s.status)
    )
  }
  const tats = items
    .filter((i) => i.status !== 'validated')
    .map((i) => tatOf(index, i, now))
  const doneToday = items.filter(
    (i) => i.status === 'validated' && (i.validatedAt ?? 0) >= today,
  )
  const doneTats = doneToday.map((i) => tatOf(index, i, now))
  const eq = Object.values(db.equipment).filter(
    (e) => e.department === department,
  )
  return {
    department,
    testsToday: items.filter(
      (i) => (db.orders[i.orderId]!.orderedAt ?? 0) >= today,
    ).length,
    pending: items.filter(
      (i) => ['pending', 'draft', 'returned'].includes(i.status) && !inLab(i),
    ).length,
    processing: items.filter(
      (i) => ['pending', 'draft', 'returned'].includes(i.status) && inLab(i),
    ).length,
    awaitingValidation: items.filter(
      (i) =>
        i.status === 'entered' ||
        i.status === 'held' ||
        i.status === 'reviewed',
    ).length,
    completed: doneToday.length,
    delayed:
      tats.filter((t) => t.state === 'breached').length +
      doneTats.filter((t) => t.state === 'missed').length,
    criticalsOpen: Object.values(db.criticals).filter(
      (c) =>
        (c.status === 'open' || c.status === 'notified') &&
        db.items[c.orderItemId]?.department === department,
    ).length,
    equipment: {
      total: eq.length,
      down: eq.filter((e) => equipmentStatus(e, now) === 'out-of-service')
        .length,
    },
    tatOnTimePct: doneTats.length
      ? (doneTats.filter((t) => t.state === 'met').length / doneTats.length) *
        100
      : null,
  }
}

export const departmentsApi = {
  list: () =>
    read((db, { index, now }) =>
      DEPARTMENTS.map((d) => departmentSummary(db, index, d, now)),
    ),
  get: (department: DepartmentId) =>
    read((db, { index, now }): DepartmentDetail => {
      const today = startOfIstDay(now)
      const summary = departmentSummary(db, index, department, now)
      const queue = Object.values(db.samples)
        .filter(
          (s) =>
            s.department === department &&
            ['collected', 'received', 'processing', 'on_hold'].includes(
              s.status,
            ) &&
            db.orders[s.orderId]?.state === 'active',
        )
        .map((s) => sampleRow(db, index, s, now))
        .toSorted(byUrgency)
      const orderedToday = new Map<string, number>()
      for (const i of liveItems(db))
        if (
          i.department === department &&
          (db.orders[i.orderId]!.orderedAt ?? 0) >= today
        )
          orderedToday.set(i.testId, (orderedToday.get(i.testId) ?? 0) + 1)
      const eqRows = equipmentRows(db, index, now).filter(
        (e) => e.department === department,
      )
      const eqIds = new Set(eqRows.map((e) => e.id))
      return {
        ...summary,
        queue,
        tests: Object.values(db.tests)
          .filter((t) => t.department === department)
          .map((t) => ({
            id: t.id,
            code: t.code,
            name: t.name,
            shortName: t.shortName,
            department: t.department,
            specimen: t.specimen,
            container: t.container,
            volumeMl: t.volumeMl,
            fasting: t.fasting,
            instructions: t.instructions,
            tatHours: t.tatHours,
            statTatHours: t.statTatHours,
            price: t.price,
            analyteNames: t.analyteIds.map((id) => db.analytes[id]?.name ?? id),
            keywords: t.keywords ?? [],
            orderedToday: orderedToday.get(t.id) ?? 0,
          }))
          .toSorted((a, b) => b.orderedToday - a.orderedToday),
        equipmentRows: eqRows,
        qcToday: qcRows(db, {}).filter(
          (r) => eqIds.has(r.equipmentId) && r.at >= today,
        ),
        tat: tatRows(db, index, now, today, department),
        staff: Object.values(db.staff)
          .filter(
            (s) => s.department === department || s.role === 'pathologist',
          )
          .map((s) => ({ id: s.id, name: s.name, role: s.role })),
      }
    }),
}
