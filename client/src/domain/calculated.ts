// Values the laboratory calculates instead of measuring. They are computed
// from the measured values of the same test, never typed, and shown as
// calculated on the report.

/** analyte id -> the analytes it is computed from. */
export const CALCULATED_FROM: Record<string, readonly string[]> = {
  eag: ['hba1c'],
  ibil: ['tbil', 'dbil'],
  glob: ['tp', 'alb'],
  ag: ['alb', 'tp'],
  bun: ['urea'],
  vldl: ['tg'],
  ldl: ['tc', 'hdl', 'tg'],
  tchdl: ['tc', 'hdl'],
}

export const isCalculated = (analyteId: string) => analyteId in CALCULATED_FROM

/**
 * Friedewald's LDL (TC - HDL - TG/5) is not valid above this triglyceride
 * level; the lab must measure LDL directly instead.
 */
export const FRIEDEWALD_TG_LIMIT = 400

export type CalculatedValue =
  | { value: string }
  /** Not computed: an input is missing, or the formula does not apply. */
  | { value: null; reason: 'missing-input' | 'tg-above-limit' }

/**
 * The calculated analytes among `ids`, from the measured `values`
 * (analyte id -> text as entered). Decimals follow the analyte.
 */
export function computeCalculated(
  ids: readonly string[],
  values: Readonly<Record<string, string | null | undefined>>,
  decimals: (analyteId: string) => number,
): Record<string, CalculatedValue> {
  const n = (k: string) => {
    const raw = values[k]
    if (raw === null || raw === undefined || raw.trim() === '') return NaN
    return Number(raw)
  }
  const out: Record<string, CalculatedValue> = {}
  const set = (k: string, v: number) => {
    if (!ids.includes(k)) return
    out[k] = Number.isFinite(v)
      ? { value: Math.max(0, v).toFixed(decimals(k)) }
      : { value: null, reason: 'missing-input' }
  }
  set('eag', 28.7 * n('hba1c') - 46.7)
  set('ibil', n('tbil') - n('dbil'))
  const glob = n('tp') - n('alb')
  set('glob', glob)
  set('ag', glob > 0 ? n('alb') / glob : NaN)
  set('bun', n('urea') / 2.14)
  set('vldl', n('tg') / 5)
  if (ids.includes('ldl')) {
    if (n('tg') > FRIEDEWALD_TG_LIMIT)
      out.ldl = { value: null, reason: 'tg-above-limit' }
    else set('ldl', n('tc') - n('hdl') - n('tg') / 5)
  }
  set('tchdl', n('hdl') > 0 ? n('tc') / n('hdl') : NaN)
  return out
}
