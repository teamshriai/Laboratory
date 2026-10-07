/**
 * Round axis bounds to a 1-2-5 step so ticks read as whole clinical values
 * (the same scale the patient trend card uses).
 */
export function niceScale(lo: number, hi: number) {
  const span = hi - lo || Math.abs(hi) || 1
  const raw = (span * 1.3) / 3
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = ([1, 2, 2.5, 5, 10].find((m) => m * mag >= raw) ?? 10) * mag
  const min = Math.max(0, Math.floor((lo - span * 0.15) / step) * step)
  const max = Math.ceil((hi + span * 0.15) / step) * step
  const ticks: number[] = []
  for (let v = min; v <= max + step / 2; v += step)
    ticks.push(Number(v.toFixed(6)))
  return { domain: [min, max] as [number, number], ticks }
}

export const isCriticalFlag = (flag: string | null | undefined) =>
  flag === 'CRITICAL_LOW' || flag === 'CRITICAL_HIGH'
