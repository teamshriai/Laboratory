import { afterEach, describe, expect, it } from 'vitest'
import { criticalState, isCriticalOverdue } from './critical'
import { computeFlag, deltaCheck, isCriticalFlag, parseNumeric } from './flags'
import { coefficientOfVariation, evaluateQc } from './qc'
import { formatRange, pickRange, rangeSnapshot } from './reference-ranges'
import { isEquipmentUsable, isLotUsable, lotStatus } from './stock'
import {
  APPROACHING_RATIO,
  itemTat,
  setTatWarnRatio,
  tatHoursFor,
  worstTat,
} from './tat'
import { busyLevel } from './lab-day'
import { DAY, HOUR, MINUTE } from './time'
import type {
  Equipment,
  OrderItem,
  ReagentLot,
  ReferenceRange,
  Sample,
} from './types'
import {
  canTransitionSample,
  deriveOrderStatus,
  deriveReportStatus,
  orderProgress,
} from './workflow'

const NOW = Date.UTC(2026, 8, 30, 6, 0)

function item(over: Partial<OrderItem> = {}): OrderItem {
  return {
    id: 'it1',
    orderId: 'o1',
    testId: 't1',
    testCode: 'CBC',
    testName: 'Complete blood count',
    department: 'hematology',
    specimen: 'whole-blood',
    container: 'edta',
    price: 300,
    tatHours: 4,
    analyteIds: ['hb'],
    active: true,
    sampleId: 's1',
    status: 'pending',
    comments: [],
    reportId: 'r1',
    ...over,
  }
}

function sample(over: Partial<Sample> = {}): Sample {
  return {
    id: 's1',
    accessionNo: 'LAB-1',
    orderId: 'o1',
    patientId: 'p1',
    department: 'hematology',
    container: 'edta',
    specimen: 'whole-blood',
    volumeMl: 3,
    status: 'pending_collection',
    createdAt: NOW - HOUR,
    labelPrintCount: 0,
    history: [],
    ...over,
  }
}

const samples = (...list: Sample[]) => new Map(list.map((s) => [s.id, s]))

describe('flags', () => {
  const numeric = { resultType: 'numeric' as const }
  const range = { low: 13, high: 17, criticalLow: 7, criticalHigh: 20 }

  it('parses plain, grouped and qualified numbers', () => {
    expect(parseNumeric('11.2')).toEqual({ value: 11.2, qualifier: null })
    expect(parseNumeric('8,400')).toEqual({ value: 8400, qualifier: null })
    expect(parseNumeric('<0.5')).toEqual({ value: 0.5, qualifier: '<' })
    expect(parseNumeric('> 1000')).toEqual({ value: 1000, qualifier: '>' })
    expect(parseNumeric('abc')).toBeNull()
    expect(parseNumeric('1.2.3')).toBeNull()
  })

  it('flags against the reference and critical limits', () => {
    expect(computeFlag(numeric, '14', range)).toBe('NORMAL')
    expect(computeFlag(numeric, '13', range)).toBe('NORMAL')
    expect(computeFlag(numeric, '12.9', range)).toBe('LOW')
    expect(computeFlag(numeric, '17.1', range)).toBe('HIGH')
    expect(computeFlag(numeric, '6.9', range)).toBe('CRITICAL_LOW')
    expect(computeFlag(numeric, '21', range)).toBe('CRITICAL_HIGH')
    expect(computeFlag(numeric, '', range)).toBeNull()
    expect(computeFlag(numeric, '14', null)).toBeNull()
  })

  it('never flags "<x" high or ">x" low', () => {
    expect(computeFlag(numeric, '<20', range)).not.toBe('CRITICAL_HIGH')
    expect(computeFlag(numeric, '<7', range)).toBe('CRITICAL_LOW')
    expect(computeFlag(numeric, '>7', range)).not.toBe('CRITICAL_LOW')
    expect(computeFlag(numeric, '>20', range)).toBe('CRITICAL_HIGH')
  })

  it('handles select and positive/negative results', () => {
    const culture = {
      resultType: 'select' as const,
      normalOptions: ['No growth'],
      criticalIfAbnormal: true,
    }
    expect(computeFlag(culture, 'No growth', null)).toBe('NORMAL')
    expect(computeFlag(culture, 'Growth of E. coli', null)).toBe('POSITIVE')
    expect(isCriticalFlag(culture, 'POSITIVE')).toBe(true)
    expect(
      computeFlag({ resultType: 'posneg' as const }, 'negative', null),
    ).toBe('NEGATIVE')
  })

  it('computes the delta against the previous result', () => {
    expect(deltaCheck('15', '10', 25)).toEqual({
      deltaPct: 50,
      exceeded: true,
    })
    expect(deltaCheck('11', '10', 25)?.exceeded).toBe(false)
    expect(deltaCheck('11', null, 25)).toBeNull()
  })
})

describe('reference ranges', () => {
  const r = (over: Partial<ReferenceRange>): ReferenceRange => ({
    id: 'r',
    analyteId: 'hb',
    sex: 'any',
    ageMin: 0,
    ageMax: 120,
    low: 12,
    high: 16,
    ...over,
  })

  it('prefers the sex-specific, narrower band', () => {
    const ranges = [
      r({ id: 'any' }),
      r({ id: 'male', sex: 'M', ageMin: 18, low: 13, high: 17 }),
      r({ id: 'female', sex: 'F', ageMin: 18, low: 12, high: 15 }),
      r({ id: 'child', ageMax: 12, low: 11, high: 14 }),
    ]
    expect(pickRange(ranges, { sex: 'M', ageYears: 40 })?.id).toBe('male')
    expect(pickRange(ranges, { sex: 'F', ageYears: 40 })?.id).toBe('female')
    expect(pickRange(ranges, { sex: 'M', ageYears: 8 })?.id).toBe('child')
    // The upper age bound is exclusive.
    expect(pickRange(ranges, { sex: 'F', ageYears: 12 })?.id).toBe('any')
  })

  it('snapshots critical limits and formats with a hyphen', () => {
    const snap = rangeSnapshot({ criticalLow: 7 }, r({ low: 13, high: 17 }))
    expect(snap).toEqual({ low: 13, high: 17, criticalLow: 7 })
    expect(formatRange(snap, 1)).toBe('13.0 - 17.0')
    expect(formatRange({ low: null, high: 200 })).toBe('< 200')
    expect(formatRange({ low: 40, high: null })).toBe('> 40')
  })
})

describe('TAT', () => {
  afterEach(() => setTatWarnRatio(APPROACHING_RATIO))
  const received = sample({ status: 'processing', receivedAt: NOW - 3 * HOUR })

  it('starts at receipt and moves through on track, at risk, overdue', () => {
    expect(itemTat(item(), sample(), NOW).state).toBe('not-started')
    expect(itemTat(item({ tatHours: 6 }), received, NOW).state).toBe('on-track')
    expect(itemTat(item({ tatHours: 4 }), received, NOW).state).toBe(
      'approaching',
    )
    expect(itemTat(item({ tatHours: 2 }), received, NOW).state).toBe('breached')
  })

  it('records met or missed once validated', () => {
    const done = { validatedAt: NOW - HOUR }
    expect(itemTat(item({ tatHours: 4, ...done }), received, NOW).state).toBe(
      'met',
    )
    expect(itemTat(item({ tatHours: 1, ...done }), received, NOW).state).toBe(
      'missed',
    )
  })

  it('follows the at-risk threshold from Settings', () => {
    const tat = item({ tatHours: 5 }) // 3 of 5 hours = 60%
    expect(itemTat(tat, received, NOW).state).toBe('on-track')
    setTatWarnRatio(0.5)
    expect(itemTat(tat, received, NOW).state).toBe('approaching')
    setTatWarnRatio(1.5) // out of range: ignored
    expect(itemTat(tat, received, NOW).state).toBe('approaching')
  })

  it('shortens targets for STAT and urgent work', () => {
    const test = { tatHours: 10, statTatHours: 2 }
    expect(tatHoursFor(test, 'routine')).toBe(10)
    expect(tatHoursFor(test, 'urgent')).toBe(6)
    expect(tatHoursFor(test, 'stat')).toBe(2)
  })

  it('reports the most urgent state first', () => {
    const infos = [
      itemTat(item({ tatHours: 6 }), received, NOW),
      itemTat(item({ tatHours: 2 }), received, NOW),
    ]
    expect(worstTat(infos)?.state).toBe('breached')
    expect(worstTat([])).toBeNull()
  })
})

describe('order status', () => {
  const order = { state: 'active' as const }

  it('derives each stage from items and samples', () => {
    const pending = sample()
    const collected = sample({ status: 'collected' })
    const inLab = sample({ status: 'processing' })
    expect(deriveOrderStatus(order, [item()], samples(pending), {})).toBe('new')
    expect(
      deriveOrderStatus(
        order,
        [item(), item({ id: 'it2', sampleId: 's2' })],
        samples(pending, { ...collected, id: 's2' }),
        {},
      ),
    ).toBe('partially-collected')
    expect(deriveOrderStatus(order, [item()], samples(collected), {})).toBe(
      'collected',
    )
    expect(deriveOrderStatus(order, [item()], samples(inLab), {})).toBe(
      'processing',
    )
    expect(
      deriveOrderStatus(
        order,
        [item({ status: 'entered' })],
        samples(inLab),
        {},
      ),
    ).toBe('awaiting-review')
    expect(
      deriveOrderStatus(
        order,
        [item({ status: 'reviewed' })],
        samples(inLab),
        {},
      ),
    ).toBe('awaiting-validation')
    // Authorised but not released is not completed (audit D1).
    expect(
      deriveOrderStatus(
        order,
        [item({ status: 'validated' })],
        samples(inLab),
        {},
      ),
    ).toBe('awaiting-release')
  })

  it('completes only when every test is on a final report', () => {
    const inLab = sample({ status: 'completed' })
    const both = [
      item({ status: 'validated' }),
      item({ id: 'it2', status: 'validated', reportId: 'r2' }),
    ]
    const released = (id: string, itemIds: string[], kind = 'final') => ({
      id,
      reportNo: id,
      orderId: 'o1',
      patientId: 'p1',
      department: 'hematology' as const,
      createdAt: NOW,
      shareLog: [],
      printCount: 0,
      versions: [
        {
          version: 1,
          kind: kind as 'final' | 'preliminary',
          itemIds,
          releasedAt: NOW,
          releasedBy: 'st_kavitha',
        },
      ],
    })
    expect(
      deriveOrderStatus(order, both, samples(inLab), {
        r1: released('r1', ['it1']),
      }),
    ).toBe('partially-reported')
    expect(
      deriveOrderStatus(order, both, samples(inLab), {
        r1: released('r1', ['it1']),
        r2: released('r2', ['it2'], 'preliminary'),
      }),
    ).toBe('partially-reported')
    expect(
      deriveOrderStatus(order, both, samples(inLab), {
        r1: released('r1', ['it1']),
        r2: released('r2', ['it2']),
      }),
    ).toBe('completed')
    // A withdrawn report no longer counts as released.
    expect(
      deriveOrderStatus(order, both, samples(inLab), {
        r1: {
          ...released('r1', ['it1']),
          withdrawn: { at: NOW, by: 'x', reason: 'wrong patient' },
        },
        r2: released('r2', ['it2']),
      }),
    ).toBe('partially-reported')
  })

  it('closes as rejected when every test was voided by rejection', () => {
    const rejected = sample({ status: 'rejected' })
    expect(
      deriveOrderStatus(
        order,
        [item({ status: 'void' })],
        samples(rejected),
        {},
      ),
    ).toBe('rejected')
    expect(
      deriveOrderStatus(
        order,
        [item({ active: false })],
        samples(sample()),
        {},
      ),
    ).toBe('cancelled')
  })

  it('counts progress per stage', () => {
    const inLab = sample({ status: 'processing' })
    const p = orderProgress(
      [
        item({ status: 'validated' }),
        item({ id: 'it2', status: 'reviewed' }),
        item({ id: 'it3', status: 'pending' }),
        item({ id: 'it4', status: 'void' }),
      ],
      samples(inLab),
    )
    expect(p).toEqual({
      total: 3,
      collected: 3,
      received: 3,
      entered: 2,
      reviewed: 2,
      validated: 1,
    })
  })

  it('only allows forward sample transitions', () => {
    expect(canTransitionSample('collected', 'received')).toBe(true)
    expect(canTransitionSample('on_hold', 'processing')).toBe(true)
    expect(canTransitionSample('completed', 'processing')).toBe(false)
    expect(canTransitionSample('pending_collection', 'processing')).toBe(false)
  })

  it('derives the report status, including a pending amendment', () => {
    const version = {
      version: 1,
      releasedAt: NOW,
      releasedBy: 'st_x',
    } as const
    expect(
      deriveReportStatus({ versions: [] }, [item({ status: 'validated' })]),
    ).toBe('validated')
    expect(
      deriveReportStatus({ versions: [] }, [item({ status: 'reviewed' })]),
    ).toBe('pending-validation')
    expect(
      deriveReportStatus(
        {
          versions: [version],
          pendingAmendment: {
            requestedAt: NOW,
            requestedBy: 'st_x',
            reason: 'transcription-error',
            comments: 'Typo',
            changes: [],
          },
        },
        [],
      ),
    ).toBe('amendment-pending')
  })
})

describe('QC (Westgard)', () => {
  it('passes, warns and rejects by rule', () => {
    expect(evaluateQc(100, 100, 5)).toMatchObject({ result: 'pass' })
    expect(evaluateQc(111, 100, 5)).toMatchObject({
      result: 'warning',
      rule: '1-2s',
    })
    expect(evaluateQc(116, 100, 5)).toMatchObject({
      result: 'fail',
      rule: '1-3s',
    })
    expect(evaluateQc(111, 100, 5, [2.4])).toMatchObject({ rule: '2-2s' })
    expect(evaluateQc(111, 100, 5, [-2.4])).toMatchObject({ rule: 'R-4s' })
    expect(evaluateQc(106, 100, 5, [1.3, 1.5, 1.1])).toMatchObject({
      rule: '4-1s',
    })
  })

  it('computes the CV', () => {
    const cv = coefficientOfVariation([98, 100, 102])
    expect(cv?.mean).toBe(100)
    expect(cv?.sd).toBeCloseTo(2)
    expect(cv?.cv).toBeCloseTo(2)
    expect(coefficientOfVariation([1])).toBeNull()
  })
})

describe('stock and equipment', () => {
  const lot = (over: Partial<ReagentLot>): ReagentLot => ({
    id: 'l1',
    reagentId: 'rg1',
    lotNumber: 'A1',
    receivedAt: NOW - 10 * DAY,
    expiresAt: NOW + 90 * DAY,
    quantity: 50,
    initialQuantity: 100,
    qcStatus: 'passed',
    state: 'active',
    transactions: [],
    ...over,
  })
  const reagent = { reorderLevel: 20 }

  it('classifies lots', () => {
    expect(lotStatus(lot({}), reagent, 50, NOW)).toBe('in-stock')
    expect(lotStatus(lot({}), reagent, 10, NOW)).toBe('low-stock')
    expect(lotStatus(lot({ expiresAt: NOW + 5 * DAY }), reagent, 50, NOW)).toBe(
      'expiring-soon',
    )
    expect(lotStatus(lot({ expiresAt: NOW - 1 }), reagent, 50, NOW)).toBe(
      'expired',
    )
    expect(lotStatus(lot({ state: 'quarantined' }), reagent, 50, NOW)).toBe(
      'quarantined',
    )
    expect(isLotUsable(lot({ quantity: 0 }), NOW)).toBe(false)
    expect(isLotUsable(lot({ state: 'quarantined' }), NOW)).toBe(false)
  })

  it('refuses work on offline or broken analyzers', () => {
    const eq = {
      status: 'operational',
      calibrationDueAt: NOW + DAY,
    } as Pick<Equipment, 'status' | 'calibrationDueAt' | 'connection'>
    const usable = (over: Partial<Equipment>) =>
      isEquipmentUsable({ ...eq, ...over } as Equipment, NOW)
    expect(usable({})).toBe(true)
    expect(usable({ connection: 'offline' })).toBe(false)
    expect(usable({ status: 'out-of-service' })).toBe(false)
    expect(usable({ status: 'maintenance' })).toBe(false)
  })
})

describe('critical values', () => {
  const base = { status: 'open' as const, attempts: [], detectedAt: NOW }

  it('derives the displayed state', () => {
    expect(criticalState(base)).toBe('open')
    expect(
      criticalState({
        ...base,
        attempts: [
          {
            id: 'a1',
            at: NOW,
            by: 'st_x',
            to: 'Ward 3',
            role: 'staff-nurse',
            method: 'phone',
            outcome: 'no-answer',
          },
        ],
      }),
    ).toBe('contacting')
    expect(criticalState({ ...base, escalatedAt: NOW })).toBe('escalated')
    expect(criticalState({ ...base, status: 'notified' })).toBe('notified')
    expect(criticalState({ ...base, status: 'acknowledged' })).toBe(
      'acknowledged',
    )
  })

  it('is overdue past the notification limit only while open', () => {
    const old = { ...base, detectedAt: NOW - 31 * MINUTE }
    expect(isCriticalOverdue(old, NOW, 30)).toBe(true)
    expect(isCriticalOverdue(old, NOW, 45)).toBe(false)
    expect(isCriticalOverdue({ ...old, status: 'notified' }, NOW, 30)).toBe(
      false,
    )
  })
})

describe('busy level', () => {
  it('grades a day against the recorded average', () => {
    expect(busyLevel(80, 100)).toBe('light')
    expect(busyLevel(100, 100)).toBe('moderate')
    expect(busyLevel(120, 100)).toBe('high')
    expect(busyLevel(5, 0)).toBe('light')
  })

  it('compares a day still running pro rata', () => {
    // Half the day gone, half the usual specimens: a normal day.
    expect(busyLevel(50, 100, 0.5)).toBe('moderate')
    expect(busyLevel(70, 100, 0.5)).toBe('high')
  })
})
