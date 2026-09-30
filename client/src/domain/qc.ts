import type { QcResult, WestgardRule } from './types'

export interface QcEvaluation {
  z: number
  result: QcResult
  rule?: WestgardRule
}

/**
 * Westgard multirule evaluation. `previousZ` holds earlier z-scores for the
 * same analyte, control level and analyzer, most recent first.
 */
export function evaluateQc(
  value: number,
  mean: number,
  sd: number,
  previousZ: number[] = [],
): QcEvaluation {
  const z = sd > 0 ? (value - mean) / sd : 0
  const prev = previousZ[0]
  if (Math.abs(z) > 3) return { z, result: 'fail', rule: '1-3s' }
  if (Math.abs(z) > 2 && prev !== undefined) {
    if (Math.sign(prev) === Math.sign(z) && Math.abs(prev) > 2)
      return { z, result: 'fail', rule: '2-2s' }
    if (Math.sign(prev) !== Math.sign(z) && Math.abs(z - prev) > 4)
      return { z, result: 'fail', rule: 'R-4s' }
  }
  const lastFour = [z, ...previousZ.slice(0, 3)]
  if (
    lastFour.length === 4 &&
    (lastFour.every((v) => v > 1) || lastFour.every((v) => v < -1))
  )
    return { z, result: 'fail', rule: '4-1s' }
  if (Math.abs(z) > 2) return { z, result: 'warning', rule: '1-2s' }
  return { z, result: 'pass' }
}

export function coefficientOfVariation(values: number[]) {
  if (values.length < 2) return null
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance =
    values.reduce((a, b) => a + (b - mean) ** 2, 0) / (values.length - 1)
  const sd = Math.sqrt(variance)
  return { mean, sd, cv: mean !== 0 ? (sd / mean) * 100 : 0 }
}
