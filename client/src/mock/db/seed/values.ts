// Generates plausible result values for seeded orders.

import { pickRange } from '@/domain/reference-ranges'
import type { Analyte, OrderItem, Sex } from '@/domain/types'
import type { LabDb } from '../schema'
import type { Rng } from './random'

export interface ValueContext {
  sex: Sex
  ageYears: number
  /** Patient tendencies: analyte id -> typical value. */
  profile?: Record<string, number>
  /** Exact values for this order: analyte id -> value as entered. */
  overrides?: Record<string, string>
}

function fmt(value: number, decimals = 0) {
  return value.toFixed(decimals)
}

function numericValue(
  db: LabDb,
  analyte: Analyte,
  ctx: ValueContext,
  rng: Rng,
): string {
  const target = ctx.profile?.[analyte.id]
  if (target !== undefined) {
    const jitter = target * rng.between(-0.025, 0.025)
    return fmt(target + jitter, analyte.decimals)
  }
  const range = pickRange(
    Object.values(db.ranges).filter((r) => r.analyteId === analyte.id),
    { sex: ctx.sex, ageYears: ctx.ageYears },
  )
  let low = range?.low ?? null
  let high = range?.high ?? null
  if (low === null && high === null) return fmt(1, analyte.decimals)
  if (low === null) low = high! * 0.45
  if (high === null) high = low * 1.6
  const span = high - low
  let value = rng.normal(low + span / 2, span / 5)
  // A few mildly abnormal values; never critical in generated data.
  if (rng.chance(0.07))
    value = rng.chance(0.5)
      ? high + span * rng.between(0.05, 0.3)
      : low - span * rng.between(0.05, 0.2)
  value = Math.max(value, low - span * 0.25, 0)
  if (analyte.criticalLow !== undefined)
    value = Math.max(value, analyte.criticalLow * 1.15)
  if (analyte.criticalHigh !== undefined)
    value = Math.min(value, analyte.criticalHigh * 0.85)
  return fmt(value, analyte.decimals)
}

const TEXT_DEFAULTS: Record<string, string[]> = {
  hp_spec: [
    'Endometrial curettings',
    'Skin punch biopsy, left forearm',
    'Gastric antral biopsy',
    'Cervical biopsy',
  ],
  fnac_site: [
    'Right lobe of thyroid',
    'Left cervical lymph node',
    'Right breast lump, upper outer quadrant',
  ],
}

export function generateItemValues(
  db: LabDb,
  item: Pick<OrderItem, 'analyteIds'>,
  ctx: ValueContext,
  rng: Rng,
): Record<string, string> {
  const values: Record<string, string> = {}
  for (const id of item.analyteIds) {
    const analyte = db.analytes[id]
    if (!analyte) continue
    const override = ctx.overrides?.[id]
    if (override !== undefined) {
      values[id] = override
      continue
    }
    switch (analyte.resultType) {
      case 'numeric':
        values[id] = numericValue(db, analyte, ctx, rng)
        break
      case 'select': {
        const options = analyte.options ?? []
        const normal = analyte.normalOptions ?? []
        if (normal.length === 0) {
          values[id] = rng.pick(options)
        } else {
          const abnormal = options.filter((o) => !normal.includes(o))
          values[id] =
            abnormal.length > 0 &&
            rng.chance(analyte.criticalIfAbnormal ? 0 : 0.1)
              ? abnormal[0]!
              : rng.pick(normal)
        }
        break
      }
      case 'posneg':
        values[id] = 'negative'
        break
      case 'text':
        values[id] = rng.pick(TEXT_DEFAULTS[id] ?? ['Received'])
        break
      case 'narrative':
        values[id] = analyte.templates?.[0] ?? 'No abnormality detected.'
        break
      case 'antibiogram':
        break
    }
  }
  deriveCalculated(values, item.analyteIds, ctx.overrides ?? {})
  // Keep the differential count at 100%.
  if (item.analyteIds.includes('neut') && ctx.overrides?.neut === undefined) {
    const others = ['lymph', 'mono', 'eos', 'baso'].reduce(
      (sum, k) => sum + Number(values[k] ?? 0),
      0,
    )
    values.neut = String(Math.max(0, 100 - others))
  }
  return values
}

/** Calculated parameters follow the measured ones, as analyzers report them. */
function deriveCalculated(
  values: Record<string, string>,
  ids: string[],
  overrides: Record<string, string>,
) {
  const n = (k: string) => (values[k] === undefined ? NaN : Number(values[k]))
  const set = (k: string, v: number, decimals: number) => {
    if (!ids.includes(k) || overrides[k] !== undefined || !Number.isFinite(v))
      return
    values[k] = Math.max(0, v).toFixed(decimals)
  }
  set('eag', 28.7 * n('hba1c') - 46.7, 0)
  set('ibil', n('tbil') - n('dbil'), 2)
  set('glob', n('tp') - n('alb'), 1)
  set('ag', n('alb') / n('glob'), 2)
  set('bun', n('urea') / 2.14, 1)
  set('vldl', n('tg') / 5, 0)
  set('ldl', n('tc') - n('hdl') - n('vldl'), 0)
  set('tchdl', n('tc') / n('hdl'), 1)
}

/** Antibiogram JSON for an isolated organism. */
export function antibiogramFor(
  organism: string,
  antibiotics: string[],
  rng: Rng,
) {
  const resistantBias =
    organism.includes('Klebsiella') || organism.includes('Pseudomonas')
      ? 0.45
      : 0.25
  const result: Record<string, 'S' | 'I' | 'R'> = {}
  for (const ab of antibiotics) {
    if (
      ab === 'Vancomycin' &&
      !organism.includes('Staphylococcus') &&
      !organism.includes('Enterococcus')
    )
      continue
    if (ab === 'Nitrofurantoin' && organism.includes('Salmonella')) continue
    if (['Meropenem', 'Imipenem', 'Amikacin'].includes(ab))
      result[ab] = rng.chance(0.1) ? 'I' : 'S'
    else
      result[ab] = rng.chance(resistantBias)
        ? 'R'
        : rng.chance(0.12)
          ? 'I'
          : 'S'
  }
  return JSON.stringify(result)
}
