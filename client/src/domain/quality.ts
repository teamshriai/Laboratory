// Pure quality and compliance rules: EQA scoring, risk scores, CAPA steps,
// document review, cold-chain limits, privacy and incident deadlines, the
// registration renewal window, measurement uncertainty and UCUM units.

import { DAY, HOUR } from './time'
import type {
  ControlledDocument,
  EqaOutcome,
  NcState,
  RetentionRule,
} from './types'

/** z = (reported - assigned) / SD for proficiency assessment. */
export function eqaZScore(reported: number, target: number, sd: number) {
  if (!(sd > 0)) return null
  return Math.round(((reported - target) / sd) * 100) / 100
}

/** |z| <= 2 acceptable, 2 < |z| < 3 warning, |z| >= 3 unacceptable. */
export function eqaOutcome(z: number): EqaOutcome {
  const a = Math.abs(z)
  if (a <= 2) return 'acceptable'
  if (a < 3) return 'warning'
  return 'unacceptable'
}

export const RISK_LEVELS = ['low', 'medium', 'high', 'extreme'] as const
export type RiskLevel = (typeof RISK_LEVELS)[number]

/** Likelihood x severity, each 1-5. */
export function riskScore(likelihood: number, severity: number) {
  return likelihood * severity
}

export function riskLevel(score: number): RiskLevel {
  if (score <= 4) return 'low'
  if (score <= 9) return 'medium'
  if (score <= 15) return 'high'
  return 'extreme'
}

export function isRiskRating(n: number) {
  return Number.isInteger(n) && n >= 1 && n <= 5
}

/**
 * The CAPA path: a step forward needs that step's record; an ineffective
 * verification goes back to action.
 */
export const NC_NEXT: Record<NcState, NcState[]> = {
  open: ['investigating'],
  investigating: ['action'],
  action: ['verifying'],
  verifying: ['closed', 'action'],
  closed: [],
}

/** The version in force (approved), if any. */
export function currentVersion(doc: ControlledDocument) {
  return doc.versions.findLast((v) => v.state === 'approved')
}

/** When the version in force is due for review. */
export function documentReviewDue(doc: ControlledDocument) {
  const current = currentVersion(doc)
  if (!current?.approvedAt) return null
  return addMonths(current.approvedAt, doc.reviewMonths)
}

export function addMonths(at: number, months: number) {
  const d = new Date(at)
  d.setUTCMonth(d.getUTCMonth() + months)
  return d.getTime()
}

export function isTemperatureInRange(value: number, min: number, max: number) {
  return value >= min && value <= max
}

/** CERT-In: report a cyber incident within 6 hours of noticing it. */
export function certInDue(detectedAt: number) {
  return detectedAt + 6 * HOUR
}

/** DPDP Rules 2025, Rule 7(2): details to the Board within 72 hours. */
export function boardDue(detectedAt: number) {
  return detectedAt + 72 * HOUR
}

export function dataRequestDue(receivedAt: number, days: number) {
  return receivedAt + days * DAY
}

/** Registration renewal: apply 90 days before expiry (TN Rules). */
export const RENEWAL_WINDOW_DAYS = 90

export function renewalState(validTo: number, now: number) {
  if (!validTo) return 'unknown' as const
  if (now > validTo) return 'expired' as const
  if (validTo - now <= RENEWAL_WINDOW_DAYS * DAY) return 'renew-now' as const
  return 'valid' as const
}

/** The date before which records of a class must be kept. */
export function retainUntil(createdAt: number, rule: RetentionRule) {
  return addMonths(createdAt, rule.months)
}

export interface Uncertainty {
  n: number
  mean: number
  sd: number
  /** Coefficient of variation, percent. */
  cv: number
  /** Expanded uncertainty (k = 2) from imprecision, percent. */
  expanded: number
}

/**
 * Measurement uncertainty from IQC imprecision (top-down): CV from at
 * least 20 control results; expanded U = 2 x CV (k = 2, about 95%). Bias
 * from EQA is reported separately, not folded in.
 */
export function uncertaintyFrom(values: number[]): Uncertainty | null {
  const n = values.length
  if (n < 20) return null
  const mean = values.reduce((a, b) => a + b, 0) / n
  if (mean === 0) return null
  const sd = Math.sqrt(
    values.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1),
  )
  const cv = (sd / Math.abs(mean)) * 100
  const round = (x: number, d = 2) => Math.round(x * 10 ** d) / 10 ** d
  return {
    n,
    mean: round(mean, 3),
    sd: round(sd, 3),
    cv: round(cv),
    expanded: round(2 * cv),
  }
}

/** UCUM codes for the units the catalog uses (display units stay as written). */
const UCUM: Record<string, string> = {
  'g/dL': 'g/dL',
  'mg/dL': 'mg/dL',
  'mg/L': 'mg/L',
  'g/L': 'g/L',
  'mmol/L': 'mmol/L',
  'mEq/L': 'meq/L',
  'U/L': 'U/L',
  'IU/L': '[IU]/L',
  'mIU/L': 'm[IU]/L',
  'µIU/mL': 'u[IU]/mL',
  'uIU/mL': 'u[IU]/mL',
  'ng/mL': 'ng/mL',
  'ng/dL': 'ng/dL',
  'pg/mL': 'pg/mL',
  'µg/dL': 'ug/dL',
  'pmol/L': 'pmol/L',
  '%': '%',
  fL: 'fL',
  pg: 'pg',
  'mm/hr': 'mm/h',
  'mm/h': 'mm/h',
  sec: 's',
  seconds: 's',
  s: 's',
  '/hpf': '/[HPF]',
  'U/mL': 'U/mL',
  'IU/mL': '[IU]/mL',
  'ng/L': 'ng/L',
  'µg/mL FEU': 'ug/mL{FEU}',
  'million/µL': '10*6/uL',
  'lakh/µL': '10*5/uL',
  titre: '{titer}',
  'x10³/µL': '10*3/uL',
  '10^3/µL': '10*3/uL',
  '×10³/µL': '10*3/uL',
  'x10⁶/µL': '10*6/uL',
  '10^6/µL': '10*6/uL',
  '×10⁶/µL': '10*6/uL',
  '/µL': '/uL',
  'cells/µL': '/uL',
  'mL/min/1.73m²': 'mL/min/{1.73_m2}',
  ratio: '{ratio}',
  INR: '{INR}',
}

export function ucumFor(unit: string) {
  const u = unit.trim()
  if (!u) return null
  return UCUM[u] ?? null
}
