// QC history and the 30 days of daily aggregates behind Analytics.

import { evaluateQc } from '@/domain/qc'
import { DAY, HOUR, istDay, startOfIstDay } from '@/domain/time'
import {
  DEPARTMENTS,
  ENCOUNTER_TYPES,
  type DailyStat,
  type DepartmentId,
  type EncounterType,
  type QcLevel,
  type QcRun,
} from '@/domain/types'
import type { Rng } from './random'

interface QcConfig {
  equipmentId: string
  analyteId: string
  level: QcLevel
  mean: number
  sd: number
  lot: string
  /** z-scores forced on specific days ago (0 = today). */
  forced?: Record<number, number>
}

const QC_CONFIGS: QcConfig[] = [
  {
    equipmentId: 'eq_xn1000',
    analyteId: 'hb',
    level: 'L1',
    mean: 6.2,
    sd: 0.12,
    lot: 'XN CHECK L1 3165',
  },
  {
    equipmentId: 'eq_xn1000',
    analyteId: 'hb',
    level: 'L2',
    mean: 12.4,
    sd: 0.2,
    lot: 'XN CHECK L2 3165',
  },
  {
    equipmentId: 'eq_xn1000',
    analyteId: 'hb',
    level: 'L3',
    mean: 16.3,
    sd: 0.25,
    lot: 'XN CHECK L3 3165',
  },
  {
    equipmentId: 'eq_xn1000',
    analyteId: 'wbc',
    level: 'L2',
    mean: 7100,
    sd: 180,
    lot: 'XN CHECK L2 3165',
  },
  {
    equipmentId: 'eq_xn1000',
    analyteId: 'plt',
    level: 'L2',
    mean: 2.26,
    sd: 0.08,
    lot: 'XN CHECK L2 3165',
  },
  {
    equipmentId: 'eq_c311',
    analyteId: 'glu_f',
    level: 'L1',
    mean: 84,
    sd: 2.6,
    lot: 'Lyphochek Assayed Chemistry 26491',
  },
  {
    equipmentId: 'eq_c311',
    analyteId: 'glu_f',
    level: 'L2',
    mean: 242,
    sd: 6.1,
    lot: 'Lyphochek Assayed Chemistry 26492',
  },
  {
    equipmentId: 'eq_c311',
    analyteId: 'creat',
    level: 'L1',
    mean: 1.02,
    sd: 0.04,
    lot: 'Lyphochek Assayed Chemistry 26491',
    forced: { 5: 2.3 },
  },
  {
    equipmentId: 'eq_c311',
    analyteId: 'creat',
    level: 'L2',
    mean: 4.35,
    sd: 0.12,
    lot: 'Lyphochek Assayed Chemistry 26492',
  },
  {
    equipmentId: 'eq_c311',
    analyteId: 'alt',
    level: 'L1',
    mean: 38,
    sd: 1.8,
    lot: 'Lyphochek Assayed Chemistry 26491',
  },
  {
    equipmentId: 'eq_9180',
    analyteId: 'k',
    level: 'L1',
    mean: 3.9,
    sd: 0.07,
    lot: 'ISE Control 5102-1',
    forced: { 2: 1.4, 1: 2.4 },
  },
  {
    equipmentId: 'eq_9180',
    analyteId: 'k',
    level: 'L2',
    mean: 6.1,
    sd: 0.1,
    lot: 'ISE Control 5102-2',
    forced: { 2: 2.3, 1: 2.6 },
  },
  {
    equipmentId: 'eq_9180',
    analyteId: 'na',
    level: 'L2',
    mean: 148,
    sd: 1.4,
    lot: 'ISE Control 5102-2',
    forced: { 1: 1.8 },
  },
  {
    equipmentId: 'eq_d10',
    analyteId: 'hba1c',
    level: 'L1',
    mean: 5.4,
    sd: 0.1,
    lot: 'Lyphochek Diabetes 33861',
  },
  {
    equipmentId: 'eq_d10',
    analyteId: 'hba1c',
    level: 'L2',
    mean: 9.8,
    sd: 0.16,
    lot: 'Lyphochek Diabetes 33862',
  },
  {
    equipmentId: 'eq_e411',
    analyteId: 'tsh',
    level: 'L1',
    mean: 0.62,
    sd: 0.03,
    lot: 'Immunoassay Plus 40291',
  },
  {
    equipmentId: 'eq_e411',
    analyteId: 'tsh',
    level: 'L2',
    mean: 5.8,
    sd: 0.21,
    lot: 'Immunoassay Plus 40292',
  },
  {
    equipmentId: 'eq_e411',
    analyteId: 'tsh',
    level: 'L3',
    mean: 22.4,
    sd: 0.8,
    lot: 'Immunoassay Plus 40293',
    forced: { 0: 2.2 },
  },
  {
    equipmentId: 'eq_stago',
    analyteId: 'inr',
    level: 'L1',
    mean: 1.02,
    sd: 0.03,
    lot: 'STA Coag Control N 261744',
  },
  {
    equipmentId: 'eq_stago',
    analyteId: 'inr',
    level: 'L2',
    mean: 2.6,
    sd: 0.08,
    lot: 'STA Coag Control P 261744',
  },
]

const QC_DAYS = 24

export function seedQcRuns(now: number, rng: Rng): QcRun[] {
  const runs: QcRun[] = []
  const today = startOfIstDay(now)
  for (const cfg of QC_CONFIGS) {
    const z: number[] = []
    for (let daysAgo = QC_DAYS - 1; daysAgo >= 0; daysAgo--) {
      const at = today - daysAgo * DAY + 7 * HOUR + rng.between(10, 50) * 60_000
      if (at > now) continue
      // The electrolyte analyzer has been down since the 2-2s failure.
      if (cfg.equipmentId === 'eq_9180' && daysAgo === 0) continue
      const forced = cfg.forced?.[daysAgo]
      const zScore = forced ?? Math.max(-1.9, Math.min(1.9, rng.normal(0, 0.8)))
      const value = Number(
        (cfg.mean + zScore * cfg.sd).toFixed(
          cfg.mean > 100 ? 0 : cfg.mean > 10 ? 1 : 2,
        ),
      )
      const evaluation = evaluateQc(
        value,
        cfg.mean,
        cfg.sd,
        z.toReversed().slice(0, 3),
      )
      z.push(evaluation.z)
      runs.push({
        id: `qc_${cfg.equipmentId}_${cfg.analyteId}_${cfg.level}_${daysAgo}`,
        equipmentId: cfg.equipmentId,
        analyteId: cfg.analyteId,
        level: cfg.level,
        controlLot: cfg.lot,
        at,
        by:
          cfg.equipmentId === 'eq_xn1000' || cfg.equipmentId === 'eq_stago'
            ? 'st_anjali'
            : cfg.equipmentId === 'eq_e411'
              ? 'st_lavanya'
              : 'st_prakash',
        value,
        mean: cfg.mean,
        sd: cfg.sd,
        result: evaluation.result,
        ...(evaluation.rule ? { rule: evaluation.rule } : {}),
        ...(evaluation.result === 'fail'
          ? {
              correctiveAction:
                'Run stopped. Electrode cleaned and recalibrated; repeat QC failed. Analyzer taken out of service and vendor informed.',
            }
          : evaluation.result === 'warning'
            ? {
                correctiveAction:
                  'Warning noted. Patient runs accepted after review of other control level.',
              }
            : {}),
      })
    }
  }
  return runs
}

const DEPT_SHARE: Record<DepartmentId, number> = {
  hematology: 0.3,
  biochemistry: 0.34,
  'clinical-pathology': 0.12,
  microbiology: 0.06,
  immunology: 0.09,
  serology: 0.06,
  histopathology: 0.015,
  cytology: 0.015,
}
const ENCOUNTER_SHARE: Record<EncounterType, number> = {
  OPD: 0.58,
  IPD: 0.24,
  EMERGENCY: 0.1,
  ICU: 0.06,
  DAYCARE: 0.02,
}
/** Share of samples collected in each IST hour (morning OPD rush). */
const HOUR_SHAPE = [
  0.8, 0.5, 0.4, 0.4, 0.6, 1.2, 3.5, 7.5, 10.5, 11, 9.5, 8, 6.5, 5.5, 5, 4.8,
  4.5, 4, 3.4, 2.6, 2.2, 1.8, 1.4, 1,
]
const SHAPE_TOTAL = HOUR_SHAPE.reduce((a, b) => a + b, 0)

export function seedDailyStats(now: number, rng: Rng): DailyStat[] {
  const stats: DailyStat[] = []
  const today = startOfIstDay(now)
  for (let daysAgo = 30; daysAgo >= 1; daysAgo--) {
    const dayStart = today - daysAgo * DAY
    const weekday = new Date(dayStart + 6 * HOUR).getUTCDay()
    const factor = weekday === 0 ? 0.55 : weekday === 6 ? 0.8 : 1
    const samples = Math.round(rng.between(176, 228) * factor)
    const tests = Math.round(samples * rng.between(1.8, 2.05))
    const rejected = Math.max(
      1,
      Math.round(samples * rng.between(0.008, 0.024)),
    )
    const criticals = rng.int(2, 7)
    const byDepartment = Object.fromEntries(
      DEPARTMENTS.map((d) => [
        d,
        Math.round(tests * DEPT_SHARE[d] * rng.between(0.85, 1.15)),
      ]),
    ) as Record<DepartmentId, number>
    const byEncounter = Object.fromEntries(
      ENCOUNTER_TYPES.map((e) => [
        e,
        Math.round(samples * ENCOUNTER_SHARE[e] * rng.between(0.85, 1.15)),
      ]),
    ) as Record<EncounterType, number>
    const rejectionsByReason: DailyStat['rejectionsByReason'] = {}
    for (let i = 0; i < rejected; i++) {
      const reason = rng.weighted([
        ['hemolyzed-sample', 5],
        ['clotted-sample', 3],
        ['insufficient-sample', 3],
        ['incorrect-label', 1.5],
        ['wrong-container', 1],
        ['delayed-transport', 1],
        ['leaking-container', 0.5],
        ['improper-storage', 0.5],
        ['other', 0.5],
      ] as const)
      rejectionsByReason[reason] = (rejectionsByReason[reason] ?? 0) + 1
    }
    const byHour = HOUR_SHAPE.map((w) =>
      Math.round((samples * w) / SHAPE_TOTAL),
    )
    const tatAvgMin = Math.round(rng.between(68, 96))
    stats.push({
      day: istDay(dayStart + HOUR),
      samples,
      tests,
      completed: Math.round(tests * rng.between(0.955, 0.985)),
      rejected,
      criticals,
      criticalsAcknowledged: criticals - (rng.chance(0.15) ? 1 : 0),
      revenue: Math.round((tests * rng.between(385, 440)) / 10) * 10,
      tatAvgMin,
      tatMedianMin: Math.round(tatAvgMin * rng.between(0.78, 0.9)),
      delayedPct: Number(rng.between(5.5, 13.5).toFixed(1)),
      byDepartment,
      byEncounter,
      rejectionsByReason,
      byHour,
      consumption: {
        tubes: Math.round(samples * rng.between(1.05, 1.2)),
        syringes: Math.round(samples * rng.between(0.85, 0.95)),
        gloves: rng.int(3, 5),
        'pipette-tips': rng.int(1, 2),
        slides: rng.int(1, 3),
        containers: Math.round(samples * rng.between(0.25, 0.35)),
        labels: 1,
        'culture-media': rng.int(18, 30),
      },
    })
  }
  return stats
}

/** Cumulative share of a day's samples collected by the given IST hour. */
export function dayShareUntilHour(hour: number, minuteFraction = 0) {
  let sum = 0
  for (let h = 0; h < hour; h++) sum += HOUR_SHAPE[h]!
  sum += (HOUR_SHAPE[hour] ?? 0) * minuteFraction
  return sum / SHAPE_TOTAL
}

/**
 * Scales the synthetic history so "same time yesterday" comparisons match the
 * pace of the seeded day, whatever hour the demo is opened.
 */
export function rescaleDailyStats(stats: DailyStat[], factor: number) {
  const k = Math.max(0.6, Math.min(2.5, factor))
  const scale = (n: number) => Math.round(n * k)
  for (const d of stats) {
    d.samples = scale(d.samples)
    d.tests = scale(d.tests)
    d.completed = scale(d.completed)
    d.revenue = Math.round((d.revenue * k) / 10) * 10
    d.byHour = d.byHour.map(scale)
    for (const key of Object.keys(d.byDepartment) as DepartmentId[])
      d.byDepartment[key] = scale(d.byDepartment[key])
    for (const key of Object.keys(d.byEncounter) as EncounterType[])
      d.byEncounter[key] = scale(d.byEncounter[key])
    for (const key of Object.keys(
      d.consumption,
    ) as (keyof DailyStat['consumption'])[])
      d.consumption[key] = scale(d.consumption[key] ?? 0)
  }
}
