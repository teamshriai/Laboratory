// Laboratory analytics for a date range, built from the daily aggregates plus
// today's live figures. Single-day ranges are broken down by hour.

import {
  DAY,
  HOUR,
  MINUTE,
  istDay,
  istHour,
  startOfIstDay,
} from '@/domain/time'
import {
  CONSUMABLE_CATEGORIES,
  DEPARTMENTS,
  ENCOUNTER_TYPES,
  type DailyStat,
  type DepartmentId,
  type EncounterType,
} from '@/domain/types'
import { isItemLive } from '@/domain/workflow'
import { inventorySnapshot } from './operations'
import { todayStat } from './overview'
import { read } from './runtime'
import { dayShareUntilHour } from '../db/seed/stats'
import type { AnalyticsRange, AnalyticsReport } from './types'
import { hasPermission } from '@/domain/permissions'
import { LabApiError } from '../engine/core'

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/

/** A real calendar day as YYYY-MM-DD (2026-00-10 or 2026-02-30 is not). */
const isDayKey = (day: string) => {
  const ms = Date.parse(`${day}T12:00:00+05:30`)
  return DAY_KEY.test(day) && Number.isFinite(ms) && istDay(ms) === day
}

function resolveRange(range: AnalyticsRange, now: number) {
  const todayKey = istDay(now)
  const today = startOfIstDay(now)
  const key = (ms: number) => istDay(ms)
  switch (range.preset) {
    case 'today':
      return { from: todayKey, to: todayKey }
    case 'yesterday':
      return { from: key(today - DAY), to: key(today - DAY) }
    case '7d':
      return { from: key(today - 6 * DAY), to: todayKey }
    case '30d':
      return { from: key(today - 29 * DAY), to: todayKey }
    case 'custom': {
      for (const day of [range.from, range.to])
        if (day !== undefined && day !== '' && !isDayKey(day))
          throw new LabApiError('validation-failed', { field: 'range' })
      const earliest = key(today - 30 * DAY)
      let from = range.from && range.from >= earliest ? range.from : earliest
      let to = range.to && range.to <= todayKey ? range.to : todayKey
      if (from > to) [from, to] = [to, from]
      return { from, to }
    }
  }
}

function daysBetween(from: string, to: string) {
  return (
    Math.round(
      (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY,
    ) + 1
  )
}

function shiftDay(day: string, delta: number) {
  return istDay(Date.parse(`${day}T12:00:00+05:30`) + delta * DAY)
}

function statsFor(all: DailyStat[], from: string, to: string) {
  return all.filter((d) => d.day >= from && d.day <= to)
}

function totals(days: DailyStat[]): AnalyticsReport['totals'] {
  const sum = (pick: (d: DailyStat) => number) =>
    days.reduce((n, d) => n + pick(d), 0)
  const samples = sum((d) => d.samples)
  const tests = sum((d) => d.tests)
  const rejected = sum((d) => d.rejected)
  const weighted = (pick: (d: DailyStat) => number) =>
    tests ? days.reduce((n, d) => n + pick(d) * d.tests, 0) / tests : null
  return {
    samples,
    tests,
    released: sum((d) => d.completed),
    rejected,
    rejectionRate: samples ? (rejected / samples) * 100 : 0,
    criticals: sum((d) => d.criticals),
    criticalsAcknowledged: sum((d) => d.criticalsAcknowledged),
    revenue: sum((d) => d.revenue),
    tatAvgMin: weighted((d) => d.tatAvgMin),
    delayedPct: weighted((d) => d.delayedPct),
  }
}

function hourlyBuckets(
  day: DailyStat,
  hourLimit: number,
): AnalyticsReport['buckets'] {
  const totalHour = day.byHour.reduce((n, v) => n + v, 0) || 1
  const perSample = day.samples ? day.tests / day.samples : 0
  const releaseShare = day.tests ? day.completed / day.tests : 0
  return day.byHour.slice(0, hourLimit).map((received, h) => {
    const lagged = day.byHour[Math.max(0, h - 2)] ?? 0
    return {
      key: String(h).padStart(2, '0'),
      received,
      tests: Math.round(received * perSample),
      released: Math.round(lagged * perSample * releaseShare),
      rejected: Math.round((day.rejected * received) / totalHour),
      pending: Math.max(
        0,
        Math.round(received * perSample * (1 - releaseShare)),
      ),
    }
  })
}

export const analyticsReportApi = {
  report: (range: AnalyticsRange) =>
    read((db, { index, now, actor }): AnalyticsReport => {
      const seesRevenue = hasPermission(db.staff[actor], 'revenue.view')
      const gate = <T extends { revenue: number | null }>(x: T): T =>
        seesRevenue ? x : { ...x, revenue: null }
      const today = todayStat(db, index, now)
      const all = [...db.dailyStats.filter((d) => d.day !== today.day), today]
      const { from, to } = resolveRange(range, now)
      const days = statsFor(all, from, to)
      const length = daysBetween(from, to)
      let prevDays = statsFor(all, shiftDay(from, -length), shiftDay(from, -1))
      // Today is still running: compare with the same share of the matching earlier day.
      if (to === today.day && prevDays.length) {
        const share = dayShareUntilHour(
          istHour(now),
          (now % 3_600_000) / 3_600_000,
        )
        const last = prevDays.at(-1)!
        const scale = (n: number) => Math.round(n * share)
        prevDays = [
          ...prevDays.slice(0, -1),
          {
            ...last,
            samples: scale(last.samples),
            tests: scale(last.tests),
            completed: scale(last.completed),
            rejected: scale(last.rejected),
            criticals: scale(last.criticals),
            criticalsAcknowledged: scale(last.criticalsAcknowledged),
            revenue: scale(last.revenue),
          },
        ]
      }
      const single = length === 1 && days[0]

      const buckets: AnalyticsReport['buckets'] = single
        ? hourlyBuckets(
            days[0]!,
            days[0]!.day === today.day ? istHour(now) + 1 : 24,
          )
        : days.map((d) => ({
            key: d.day,
            received: d.samples,
            tests: d.tests,
            released: d.completed,
            rejected: d.rejected,
            pending: Math.max(0, d.tests - d.completed),
          }))

      const t = totals(days)
      // Department TAT is measured from the tests on record (receipt to
      // authorisation) in the range, not estimated from the daily totals.
      const fromMs = Date.parse(`${from}T00:00:00+05:30`)
      const toMs = Date.parse(`${to}T00:00:00+05:30`) + DAY
      const measured = new Map<DepartmentId, { mins: number[]; met: number }>()
      for (const item of Object.values(db.items)) {
        if (!isItemLive(item) || item.validatedAt === undefined) continue
        if (item.validatedAt < fromMs || item.validatedAt >= toMs) continue
        const received = item.sampleId
          ? index.samplesById.get(item.sampleId)?.receivedAt
          : undefined
        if (received === undefined) continue
        const elapsed = item.validatedAt - received
        const entry = measured.get(item.department) ?? { mins: [], met: 0 }
        entry.mins.push(elapsed / MINUTE)
        if (elapsed <= item.tatHours * HOUR) entry.met += 1
        measured.set(item.department, entry)
      }
      const byDepartment = DEPARTMENTS.map((department) => {
        const tests = days.reduce(
          (n, d) => n + (d.byDepartment[department] ?? 0),
          0,
        )
        const m = measured.get(department)
        const n = m?.mins.length ?? 0
        return {
          department,
          tests,
          tatCount: n,
          tatAvgMin: n
            ? Math.round(m!.mins.reduce((a, b) => a + b, 0) / n)
            : null,
          onTimePct: n ? (m!.met / n) * 100 : null,
        }
      })

      const reasons = new Map<string, number>()
      for (const d of days)
        for (const [reason, n] of Object.entries(d.rejectionsByReason))
          reasons.set(reason, (reasons.get(reason) ?? 0) + (n ?? 0))

      const byEncounter = Object.fromEntries(
        ENCOUNTER_TYPES.map((e) => [
          e,
          days.reduce((n, d) => n + (d.byEncounter[e] ?? 0), 0),
        ]),
      ) as Record<EncounterType, number>

      // Test mix: real order frequency scaled to the range's test volume.
      const freq = new Map<string, number>()
      const abnormal = new Map<string, { n: number; abn: number }>()
      for (const item of Object.values(db.items)) {
        if (!isItemLive(item)) continue
        freq.set(item.testId, (freq.get(item.testId) ?? 0) + 1)
        if (item.status !== 'validated') continue
        const results = index.resultsByItem.get(item.id) ?? []
        const entry = abnormal.get(item.testId) ?? { n: 0, abn: 0 }
        entry.n += 1
        if (
          results.some(
            (r) => r.flag && r.flag !== 'NORMAL' && r.flag !== 'NEGATIVE',
          )
        )
          entry.abn += 1
        abnormal.set(item.testId, entry)
      }
      const freqTotal = [...freq.values()].reduce((n, v) => n + v, 0) || 1
      const topTests = [...freq.entries()]
        .map(([testId, n]) => {
          const test = db.tests[testId]!
          const a = abnormal.get(testId)
          return {
            testId,
            name: test.name,
            shortName: test.shortName,
            department: test.department,
            ordered: Math.max(1, Math.round((t.tests * n) / freqTotal)),
            abnormalPct: a && a.n >= 3 ? (a.abn / a.n) * 100 : null,
          }
        })
        .toSorted((a, b) => b.ordered - a.ordered)
        .slice(0, 10)

      const liveCriticals = Object.values(db.criticals).filter(
        (c) =>
          c.status !== 'voided' &&
          c.detectedAt >= fromMs &&
          c.detectedAt < toMs,
      )
      const notifyMins = Object.values(db.criticals)
        .filter((c) => c.notifiedAt)
        .map((c) => (c.notifiedAt! - c.detectedAt) / 60_000)
        .toSorted((a, b) => a - b)
      const pending = liveCriticals.filter(
        (c) => c.status === 'open' || c.status === 'notified',
      ).length

      const snapshot = inventorySnapshot(db, index, now)
      const consumption = CONSUMABLE_CATEGORIES.map((category) => ({
        category,
        used: days.reduce((n, d) => n + (d.consumption[category] ?? 0), 0),
      })).filter((c) => c.used > 0)
      const highUse = Object.values(db.consumables)
        .map((c) => ({
          id: c.id,
          name: c.name,
          unit: c.unit,
          used: Math.round(c.dailyUsage * length),
        }))
        .toSorted((a, b) => b.used - a.used)
        .slice(0, 6)

      return {
        range: { from, to, days: length, label: range.preset },
        buckets,
        bucketUnit: single ? 'hour' : 'day',
        totals: gate(t),
        previous: prevDays.length ? gate(totals(prevDays)) : null,
        byDepartment,
        rejectionsByReason: [...reasons.entries()]
          .map(([reason, count]) => ({ reason, count }))
          .toSorted((a, b) => b.count - a.count),
        byEncounter,
        topTests,
        criticals: {
          detected: t.criticals,
          acknowledged: t.criticalsAcknowledged,
          pending: range.preset === 'today' || to === today.day ? pending : 0,
          medianNotifyMin: notifyMins.length
            ? notifyMins[Math.floor(notifyMins.length / 2)]!
            : null,
        },
        inventory: {
          consumption,
          highUse,
          lowStock:
            snapshot.counts['low-stock'] + snapshot.counts['out-of-stock'],
          expiring: snapshot.counts['expiring-soon'] + snapshot.counts.expired,
        },
      }
    }),
}
