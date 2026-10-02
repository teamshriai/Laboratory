// Builds the demo laboratory. Every order is replayed through the real engine
// (create, collect, receive, process, enter, validate, release) at times in the
// past, in chronological order, stopping at "now". That keeps IDs, statuses,
// reports and critical alerts consistent with what the live app would produce.

import {
  groupTestsIntoSamples,
  type SampleRequirement,
} from '@/domain/grouping'
import { isAbnormal, computeFlag } from '@/domain/flags'
import { DAY, HOUR, MINUTE, istDay, istHour } from '@/domain/time'
import type {
  ClinicalDepartmentId,
  CollectionSite,
  CorrectionReason,
  DepartmentId,
  EncounterType,
  NotifyMethod,
  NotifyOutcome,
  NotifyRole,
  Patient,
  Priority,
  RejectionReason,
  Sample,
} from '@/domain/types'
import { deriveReportStatus, isItemLive } from '@/domain/workflow'
import { emptyDb, type LabDb } from '../schema'
import {
  itemsOfReport,
  itemsOfSample,
  notify,
  samplesOfOrder,
  type EngineCtx,
} from '../../engine/core'
import { documentCritical, escalateCritical } from '../../engine/critical'
import { createOrder } from '../../engine/orders'
import {
  correctReport,
  releaseReport,
  withdrawReport,
} from '../../engine/reports'
import {
  returnItem,
  reviewItems,
  requestRerun,
  saveResults,
  validateItems,
} from '../../engine/results'
import {
  collectSample,
  holdSample,
  printLabel,
  receiveSample,
  rejectSample,
  startProcessing,
} from '../../engine/samples'
import { ANALYTES, REFERENCE_RANGES, TESTS } from './catalog'
import { seedConsumables, seedEquipment, seedReagents } from './inventory'
import {
  CITIES,
  COMMON_ALLERGIES,
  DOCTORS,
  doctorsFor,
  FEMALE_FIRST,
  MALE_FIRST,
  NAMED_PATIENTS,
  SCENARIO_PATIENTS,
  STAFF,
  SURNAMES,
  WARDS,
  type PatientSeed,
} from './people'
import { createRng, type Rng } from './random'
import {
  dayShareUntilHour,
  rescaleDailyStats,
  seedDailyStats,
  seedQcRuns,
} from './stats'
import { antibiogramFor, generateItemValues } from './values'

import { enrichDatabase } from './enrich'
const SEED = 20260928

const PHLEBOTOMISTS = ['st_kavya', 'st_ravi', 'st_sumathi', 'st_joseph']
const TECH_BY_DEPT: Record<DepartmentId, string> = {
  hematology: 'st_anjali',
  biochemistry: 'st_prakash',
  'clinical-pathology': 'st_sneha',
  microbiology: 'st_imran',
  immunology: 'st_lavanya',
  serology: 'st_vinod',
  histopathology: 'st_rekha',
  cytology: 'st_rekha',
}

type Step = 'collect' | 'receive' | 'start' | 'enter' | 'validate' | 'release'
const STEPS: Step[] = [
  'collect',
  'receive',
  'start',
  'enter',
  'validate',
  'release',
]

/** Absolute times (epoch ms) for a sample's steps; missing ones use defaults. */
type StepTimes = Partial<Record<Step, number>>

interface SamplePlan extends StepTimes {
  /** Last step performed; 'none' leaves the sample awaiting collection. */
  stopAfter?: Step | 'none'
  reject?: {
    at: number
    reason: RejectionReason
    remarks?: string
    recollect: boolean
  }
  hold?: { at: number; remarks: string }
  returnTest?: { testId: string; at: number; reason: string }
  /** Technically reviewed but not yet authorised by a pathologist. */
  reviewOnly?: boolean
  /** Tests on the sample that are not resulted yet (a culture still growing). */
  pendingTestIds?: string[]
  /** Repeat analysis after the first entry, then the repeat value entered. */
  rerun?: {
    at: number
    testId: string
    reason: string
    dilution?: number
    reenterAt: number
    values: Record<string, string>
  }
}

interface FlowPlan {
  patient: PatientSeed
  doctorId: string
  department: ClinicalDepartmentId
  encounter: EncounterType
  ward?: string
  bed?: string
  priority: Priority
  notes: string
  testIds: string[]
  orderedAt: number
  /** Per sample key "department:container". */
  samples?: Record<string, SamplePlan>
  /** Applies to every sample without its own plan. */
  all?: SamplePlan
  overrides?: Record<string, string>
  critical?: {
    at: number
    notifiedTo: string
    role: NotifyRole
    method: NotifyMethod
    acknowledged: boolean
    /** An attempt that did not reach anyone (the alert stays open). */
    outcome?: NotifyOutcome
    /** Then raised to a senior clinician. */
    escalate?: { at: number; to: string; reason: string }
  }
  correction?: {
    at: number
    department: DepartmentId
    analyteId: string
    value: string
    reason: CorrectionReason
    comments: string
    by: string
  }
  draft?: boolean
  /** Released as a preliminary report (some tests still to follow). */
  preliminary?: { at: number; department: DepartmentId; by: string }
  /** Withdrawn after release. */
  withdraw?: {
    at: number
    department: DepartmentId
    reason: string
    by: string
  }
}

interface Action {
  at: number
  seq: number
  run: () => void
}

class Scheduler {
  private actions: Action[] = []
  private seq = 0
  errors: string[] = []

  add(at: number, run: () => void) {
    this.actions.push({ at, seq: this.seq++, run })
  }

  run(now: number) {
    const ordered = this.actions
      .filter((a) => a.at <= now)
      .toSorted((a, b) => a.at - b.at || a.seq - b.seq)
    for (const action of ordered) {
      try {
        action.run()
      } catch (error) {
        this.errors.push(
          error instanceof Error
            ? `${error.message} ${JSON.stringify((error as { params?: unknown }).params ?? {})}`
            : String(error),
        )
      }
    }
  }
}

function toPatient(seed: PatientSeed, now: number, rng: Rng): Patient {
  const birth = now - seed.ageYears * 365.25 * DAY - rng.int(10, 300) * DAY
  const patient: Patient = {
    id: seed.id,
    uhid: seed.uhid,
    name: seed.name,
    sex: seed.sex,
    dob: istDay(birth),
    mobile: seed.mobile,
    allergies: seed.allergies ?? [],
    city: seed.city,
    state: seed.state,
    encounter: {
      type: seed.encounter,
      department: seed.department,
      ...(seed.ward ? { ward: seed.ward } : {}),
      ...(seed.bed ? { bed: seed.bed } : {}),
      ...(seed.encounter === 'IPD' || seed.encounter === 'ICU'
        ? { ipNumber: `IP-26-${seed.uhid.slice(-5)}` }
        : {
            visitNo: `${seed.encounter === 'EMERGENCY' ? 'ER' : seed.encounter === 'DAYCARE' ? 'DC' : 'OP'}-26-${seed.uhid.slice(-5)}`,
          }),
      ...(DOCTORS.find((d) => d.department === seed.department)
        ? {
            attendingDoctorId: DOCTORS.find(
              (d) => d.department === seed.department,
            )!.id,
          }
        : {}),
    },
    notes: (seed.notes ?? []).map((text, i) => ({
      id: `note_${seed.id}_${i}`,
      at: now - (i + 1) * rng.int(2, 30) * HOUR,
      by:
        DOCTORS.find((d) => d.department === seed.department)?.name ??
        'Dr. Ramesh Iyer',
      text,
    })),
    registeredAt: now - rng.int(20, 1500) * DAY,
  }
  if (seed.nameLocal) patient.nameLocal = seed.nameLocal
  if (seed.bloodGroup) patient.bloodGroup = seed.bloodGroup
  return patient
}

function generatePatients(count: number, rng: Rng): PatientSeed[] {
  const used = new Set(
    [...NAMED_PATIENTS, ...SCENARIO_PATIENTS].map((p) => p.uhid),
  )
  const out: PatientSeed[] = []
  while (out.length < count) {
    const n = rng.int(120, 2229)
    const uhid = `SHRI-${String(n).padStart(6, '0')}`
    if (used.has(uhid)) continue
    used.add(uhid)
    const sex = rng.chance(0.5) ? 'M' : 'F'
    const encounter = rng.weighted<EncounterType>([
      ['OPD', 58],
      ['IPD', 25],
      ['EMERGENCY', 8],
      ['ICU', 6],
      ['DAYCARE', 3],
    ])
    const ageYears = rng.weighted<number>([
      [rng.int(2, 12), 8],
      [rng.int(18, 40), 32],
      [rng.int(40, 60), 34],
      [rng.int(60, 84), 26],
    ])
    const department: ClinicalDepartmentId =
      encounter === 'EMERGENCY'
        ? 'emergency'
        : encounter === 'ICU'
          ? 'critical-care'
          : ageYears < 13
            ? 'paediatrics'
            : sex === 'F' && ageYears < 40 && rng.chance(0.35)
              ? 'obstetrics'
              : rng.pick<ClinicalDepartmentId>([
                  'general-medicine',
                  'general-medicine',
                  'general-medicine',
                  'cardiology',
                  'endocrinology',
                  'nephrology',
                  'general-surgery',
                  'orthopaedics',
                  'oncology',
                  'pulmonology',
                  'gastroenterology',
                  'dermatology',
                ])
    const first = rng.pick(sex === 'M' ? MALE_FIRST : FEMALE_FIRST)
    const name = rng.chance(0.2)
      ? `${first} ${rng.pick(['R', 'K', 'S', 'M', 'N', 'P'])}`
      : `${first} ${rng.pick(SURNAMES)}`
    const [city, state] = rng.pick(CITIES)
    const ward =
      encounter === 'IPD'
        ? rng.pick(WARDS)
        : encounter === 'ICU'
          ? rng.pick(['MICU', 'SICU', 'CCU'])
          : encounter === 'EMERGENCY'
            ? 'ER'
            : undefined
    const bed =
      encounter === 'IPD' || encounter === 'ICU'
        ? String(rng.int(1, 24))
        : encounter === 'EMERGENCY'
          ? `Bay ${rng.int(1, 8)}`
          : undefined
    const seed: PatientSeed = {
      id: `pat_${uhid.slice(5)}`,
      uhid,
      name,
      sex,
      ageYears,
      mobile: `+91 ${rng.pick(['98', '99', '97', '94', '90', '88', '63', '70'])}${rng.int(100, 999)} ${rng.int(10000, 99999)}`,
      bloodGroup: rng.weighted([
        ['O+', 37],
        ['B+', 32],
        ['A+', 22],
        ['AB+', 6],
        ['O-', 1.5],
        ['B-', 1],
        ['A-', 0.5],
      ] as const),
      city,
      state,
      encounter,
      department,
      notes: [],
    }
    if (rng.chance(0.12)) seed.allergies = [rng.pick(COMMON_ALLERGIES)]
    if (ward) seed.ward = ward
    if (bed) seed.bed = bed
    out.push(seed)
  }
  return out
}

/** Typical test panels by clinical context. */
function panelFor(
  p: PatientSeed,
  rng: Rng,
): { tests: string[]; notes: string } {
  const opd: [string[], string][] = [
    [['cbc'], 'Routine blood count.'],
    [['cbc', 'esr'], 'Joint pain for 2 weeks.'],
    [['fbs', 'ppbs', 'hba1c'], 'Diabetes follow-up.'],
    [['lipid', 'fbs'], 'Annual health check. Fasting.'],
    [['thyroid'], 'Fatigue and weight gain.'],
    [['lft', 'kft'], 'Baseline before starting medication.'],
    [['urine_re'], 'Burning micturition for 3 days.'],
    [['cbc', 'crp'], 'Fever for 2 days.'],
    [['vitd', 'b12'], 'Generalised body ache and tingling.'],
    [
      ['cbc', 'dengue_ns1', 'malaria', 'widal'],
      'Fever with chills for 3 days.',
    ],
    [['rbs', 'kft'], 'Hypertension review.'],
    [['hba1c', 'kft', 'urine_re'], 'Diabetic nephropathy screening.'],
  ]
  const byDept: Partial<Record<ClinicalDepartmentId, [string[], string][]>> = {
    obstetrics: [
      [
        ['cbc', 'bg', 'hiv', 'hbsag', 'vdrl', 'urine_re', 'tsh_test'],
        'Antenatal profile, first trimester.',
      ],
      [['cbc', 'urine_re'], 'Antenatal follow-up.'],
    ],
    'general-surgery': [
      [
        ['cbc', 'pt_inr', 'aptt', 'hiv', 'hbsag', 'hcv', 'rbs', 'bg'],
        'Pre-operative work-up for laparoscopic cholecystectomy.',
      ],
      [['biopsy_small'], 'Excision biopsy, skin lesion.'],
      [['fnac'], 'Neck swelling for 2 months.'],
    ],
    oncology: [
      [['cbc', 'lft', 'kft'], 'Before chemotherapy cycle 3.'],
      [['biopsy_large'], 'Modified radical mastectomy specimen.'],
    ],
    pulmonology: [
      [['afb', 'cbc', 'esr'], 'Cough for 4 weeks with evening fever.'],
    ],
    dermatology: [
      [
        ['rf', 'crp', 'ana'],
        'Rash and joint pain. Rule out connective tissue disease.',
      ],
    ],
    orthopaedics: [
      [
        ['cbc', 'esr', 'crp', 'rf', 'accp'],
        'Morning stiffness, small joint pain.',
      ],
      [['calcium', 'vitd'], 'Osteoporosis screening.'],
    ],
    paediatrics: [
      [['cbc', 'crp'], 'Fever for 2 days.'],
      [['cbc', 'dengue_ns1'], 'High-grade fever.'],
      [['urine_re', 'urine_cs'], 'Suspected urinary tract infection.'],
    ],
    nephrology: [[['kft', 'calcium', 'cbc'], 'CKD follow-up.']],
    cardiology: [
      [['lipid', 'fbs'], 'Cardiac risk assessment. Fasting.'],
      [['trop', 'cbc'], 'Atypical chest pain.'],
    ],
    endocrinology: [
      [['thyroid'], 'Thyroid follow-up.'],
      [['fbs', 'ppbs', 'hba1c'], 'Diabetes review.'],
    ],
    gastroenterology: [
      [['lft', 'pt_inr'], 'Chronic liver disease follow-up.'],
      [['stool_re'], 'Loose stools for 4 days.'],
    ],
    emergency: [
      [['cbc', 'rbs', 'kft'], 'Giddiness and vomiting.'],
      [['trop', 'cbc', 'kft'], 'Chest pain.'],
      [['cbc', 'malaria', 'dengue_ns1'], 'High-grade fever with rigors.'],
    ],
    'critical-care': [
      [['cbc', 'kft', 'lft', 'pt_inr'], 'Daily ICU bloods.'],
      [['blood_cs', 'crp'], 'New fever spike in ICU.'],
      [['kft', 'cbc'], 'Post-operative day 1.'],
    ],
  }
  if (p.encounter === 'IPD' && rng.chance(0.4)) {
    const [tests, notes] = rng.pick<[string[], string]>([
      [['cbc', 'kft'], 'Daily ward bloods.'],
      [['cbc', 'lft', 'kft'], 'Inpatient review.'],
      [['pt_inr', 'aptt'], 'On anticoagulation.'],
      [['urine_re', 'urine_cs'], 'Catheter-associated fever.'],
      [['kft', 'calcium'], 'Electrolyte monitoring.'],
    ])
    return { tests, notes }
  }
  const options = byDept[p.department] ?? opd
  const [tests, notes] = rng.pick(
    p.department === 'general-medicine'
      ? opd
      : [...options, ...(p.encounter === 'OPD' ? opd.slice(0, 3) : [])],
  )
  const extra =
    p.sex === 'M' && p.ageYears > 55 && rng.chance(0.2) ? ['psa'] : []
  return { tests: [...tests, ...extra], notes }
}

function doctorFor(dept: ClinicalDepartmentId, rng: Rng) {
  const options = doctorsFor(dept)
  return (options.length ? rng.pick(options) : DOCTORS[0]!).id
}

interface Timings {
  collect: number
  receive: number
  start: number
  enter: number
  validate: number
  release: number
}

function defaultTimings(
  req: SampleRequirement,
  orderedAt: number,
  priority: Priority,
  encounter: EncounterType,
  rng: Rng,
): Timings {
  const stat = priority === 'stat'
  const test = TESTS.filter((t) => req.testIds.includes(t.id))
  const tatHours = Math.max(
    ...test.map((t) =>
      stat
        ? t.statTatHours
        : priority === 'urgent'
          ? Math.max(t.statTatHours, t.tatHours * 0.6)
          : t.tatHours,
    ),
  )
  const collect =
    orderedAt +
    (stat
      ? rng.between(3, 9)
      : priority === 'urgent'
        ? rng.between(6, 18)
        : encounter === 'IPD'
          ? rng.between(12, 60)
          : rng.between(4, 32)) *
      MINUTE
  const receive =
    collect + (stat ? rng.between(4, 9) : rng.between(10, 28)) * MINUTE
  const start = receive + rng.between(3, 12) * MINUTE
  const fraction = rng.chance(0.09)
    ? rng.between(1.02, 1.3)
    : stat
      ? rng.between(0.35, 0.65)
      : rng.between(0.28, 0.6)
  const enter =
    start + Math.max(6 * MINUTE, tatHours * HOUR * fraction - 10 * MINUTE)
  const validate =
    enter +
    Math.min(
      tatHours * HOUR * 0.2,
      (stat ? rng.between(4, 9) : rng.between(8, 28)) * MINUTE,
    )
  const release = validate + rng.between(5, 18) * MINUTE
  return { collect, receive, start, enter, validate, release }
}

const VALIDATORS = ['st_kavitha', 'st_sanjay']
/** Technical review (the lab manager checks before a pathologist authorises). */
const REVIEWER = 'st_ganesh'

const COLLECTION_SITES: CollectionSite[] = [
  'left-antecubital',
  'right-antecubital',
  'left-antecubital',
  'dorsal-hand',
]

function siteFor(container: Sample['container'], rng: Rng): CollectionSite {
  if (container === 'urine' || container === 'stool') return 'midstream-urine'
  if (container === 'sterile') return 'other'
  if (container === 'formalin' || container === 'slide') return 'other'
  return rng.pick(COLLECTION_SITES)
}

function scheduleFlow(db: LabDb, sched: Scheduler, plan: FlowPlan, rng: Rng) {
  const tests = TESTS.filter((t) => plan.testIds.includes(t.id))
  const groups = groupTestsIntoSamples(
    plan.testIds.map((id) => tests.find((t) => t.id === id)!),
  )
  const state: { orderId?: string; samples: Sample[] } = { samples: [] }
  const ctxAt = (at: number, by: string): EngineCtx => ({ now: at, by })

  sched.add(plan.orderedAt, () => {
    const order = createOrder(
      db,
      {
        patientId: plan.patient.id,
        doctorId: plan.doctorId,
        department: plan.department,
        encounter: plan.encounter,
        priority: plan.priority,
        clinicalNotes: plan.notes,
        testIds: plan.testIds,
        draft: plan.draft ?? false,
        ...(plan.ward ? { ward: plan.ward } : {}),
        ...(plan.bed ? { bed: plan.bed } : {}),
      },
      ctxAt(plan.orderedAt, 'st_shruthi'),
    )
    state.orderId = order.id
    state.samples = samplesOfOrder(db, order.id)
  })
  if (plan.draft) return

  const releaseByDept = new Map<DepartmentId, number>()
  const blockedDepts = new Set<DepartmentId>()

  groups.forEach((req, index) => {
    const key = `${req.department}:${req.container}`
    const sp: SamplePlan = { ...plan.all, ...plan.samples?.[key] }
    const t = defaultTimings(
      req,
      plan.orderedAt,
      plan.priority,
      plan.encounter,
      rng,
    )
    // Explicit times override defaults; later defaults shift to follow them.
    let prev = plan.orderedAt
    const times = {} as Timings
    for (const step of STEPS) {
      const explicit = sp[step]
      const fallback = t[step]
      const gap =
        step === 'collect'
          ? fallback - plan.orderedAt
          : fallback - t[STEPS[STEPS.indexOf(step) - 1]!]
      times[step] = explicit ?? prev + gap
      prev = times[step]
    }
    const stopIndex =
      sp.stopAfter === 'none'
        ? -1
        : sp.stopAfter
          ? STEPS.indexOf(sp.stopAfter)
          : STEPS.length - 1
    const tech = TECH_BY_DEPT[req.department]
    const validator =
      req.department === 'microbiology' ? 'st_meera' : rng.pick(VALIDATORS)
    const sample = () => state.samples[index]!
    const blockedAfter = (step: Step) => {
      if (sp.reject && sp.reject.at <= times[step]) return true
      if (sp.hold && sp.hold.at <= times[step]) return true
      return false
    }

    if (stopIndex >= 0 && !blockedAfter('collect')) {
      sched.add(times.collect, () => {
        // One phlebotomist labels and draws the specimen.
        const collector = rng.pick(PHLEBOTOMISTS)
        printLabel(db, sample().id, ctxAt(times.collect, collector))
        collectSample(
          db,
          sample().id,
          { collectedAt: times.collect, site: siteFor(req.container, rng) },
          ctxAt(times.collect, collector),
        )
      })
    }
    if (stopIndex >= 1 && !blockedAfter('receive'))
      sched.add(
        times.receive,
        () => void receiveSample(db, sample().id, ctxAt(times.receive, tech)),
      )

    if (stopIndex >= 2 && !blockedAfter('start')) {
      sched.add(times.start, () => {
        const eq = pickEquipment(db, req.testIds)
        if (eq === 'unavailable') {
          holdSample(
            db,
            sample().id,
            {
              reason: 'analyzer-down',
              remarks: 'Analyzer out of service. Sample stored at 2 to 8 °C.',
            },
            ctxAt(times.start, tech),
          )
          return
        }
        startProcessing(
          db,
          sample().id,
          eq ? { equipmentId: eq } : {},
          ctxAt(times.start, tech),
        )
      })
    }
    // Each test is resulted on its own clock: a CRP is not held back by an
    // ANA sharing the same tube.
    const testTimes = req.testIds.map((testId) => {
      if (sp.enter !== undefined)
        return {
          testId,
          enter: times.enter,
          validate: times.validate,
          release: times.release,
        }
      const test = tests.find((x) => x.id === testId)!
      const stat = plan.priority === 'stat'
      const tatH = stat
        ? test.statTatHours
        : plan.priority === 'urgent'
          ? Math.max(test.statTatHours, test.tatHours * 0.6)
          : test.tatHours
      const fraction = rng.chance(0.07)
        ? rng.between(1.02, 1.25)
        : stat
          ? rng.between(0.35, 0.65)
          : rng.between(0.28, 0.6)
      const enter =
        times.start + Math.max(6 * MINUTE, tatH * HOUR * fraction - 10 * MINUTE)
      const validate =
        enter +
        Math.min(
          tatH * HOUR * 0.2,
          (stat ? rng.between(4, 9) : rng.between(8, 28)) * MINUTE,
        )
      return {
        testId,
        enter,
        validate,
        release: validate + rng.between(5, 18) * MINUTE,
      }
    })
    const blockedAt = (at: number) =>
      Boolean(
        (sp.reject && sp.reject.at <= at) || (sp.hold && sp.hold.at <= at),
      )

    const enterItems = (testIds: string[], at: number) => {
      const s = sample()
      if (s.status !== 'processing' && s.status !== 'received') return
      const bg = plan.patient.bloodGroup
      const overrides = {
        ...(bg
          ? {
              abo: bg.slice(0, -1),
              rh: bg.endsWith('+') ? 'Positive' : 'Negative',
            }
          : {}),
        ...plan.overrides,
      }
      const entries = itemsOfSample(db, s.id)
        .filter(
          (i) =>
            isItemLive(i) &&
            testIds.includes(i.testId) &&
            ['pending', 'draft', 'returned'].includes(i.status),
        )
        .map((item) => {
          const values = generateItemValues(
            db,
            item,
            {
              sex: plan.patient.sex,
              ageYears: plan.patient.ageYears,
              overrides,
              ...(plan.patient.profile
                ? { profile: plan.patient.profile }
                : {}),
            },
            rng,
          )
          for (const id of item.analyteIds) {
            const analyte = db.analytes[id]!
            if (!analyte.dependsOn) continue
            const parentValue = values[analyte.dependsOn]
            const parent = db.analytes[analyte.dependsOn]!
            if (
              !parentValue ||
              !isAbnormal(computeFlag(parent, parentValue, null))
            ) {
              delete values[id]
              continue
            }
            if (analyte.resultType === 'antibiogram')
              values[id] = antibiogramFor(
                parentValue,
                analyte.antibiotics ?? [],
                rng,
              )
            else if (analyte.options) values[id] = analyte.options.at(-1)!
          }
          return {
            itemId: item.id,
            values: Object.fromEntries(
              Object.entries(values).map(([k, v]) => [k, { value: v }]),
            ),
          }
        })
      if (entries.length) saveResults(db, s.id, entries, true, ctxAt(at, tech))
    }

    if (stopIndex >= 3) {
      for (const tt of testTimes)
        if (!blockedAt(tt.enter) && !sp.pendingTestIds?.includes(tt.testId))
          sched.add(tt.enter, () => enterItems([tt.testId], tt.enter))
      if (plan.critical) {
        const c = plan.critical
        sched.add(c.at, () => {
          for (const alert of Object.values(db.criticals)) {
            if (
              alert.orderId !== state.orderId ||
              alert.status !== 'open' ||
              alert.sampleId !== sample().id
            )
              continue
            documentCritical(
              db,
              alert.id,
              {
                notifiedTo: c.notifiedTo,
                role: c.role,
                method: c.method,
                notifiedAt: c.at,
                acknowledged: c.acknowledged,
                readBack: c.acknowledged,
                ...(c.outcome ? { outcome: c.outcome } : {}),
              },
              ctxAt(c.at, tech),
            )
          }
        })
        if (c.escalate) {
          const esc = c.escalate
          sched.add(esc.at, () => {
            for (const alert of Object.values(db.criticals)) {
              if (
                alert.orderId !== state.orderId ||
                alert.status !== 'open' ||
                alert.sampleId !== sample().id
              )
                continue
              escalateCritical(
                db,
                alert.id,
                { to: esc.to, reason: esc.reason },
                ctxAt(esc.at, 'st_ganesh'),
              )
            }
          })
        }
      }
    }
    if (sp.rerun) {
      const r = sp.rerun
      const item = () =>
        itemsOfSample(db, sample().id).find(
          (i) => isItemLive(i) && i.testId === r.testId,
        )
      sched.add(r.at, () => {
        const it = item()
        if (!it) return
        requestRerun(
          db,
          it.id,
          { reason: r.reason, ...(r.dilution ? { dilution: r.dilution } : {}) },
          ctxAt(r.at, tech),
        )
      })
      sched.add(r.reenterAt, () => {
        const it = item()
        if (!it) return
        saveResults(
          db,
          sample().id,
          [
            {
              itemId: it.id,
              values: Object.fromEntries(
                Object.entries(r.values).map(([k, v]) => [k, { value: v }]),
              ),
            },
          ],
          true,
          ctxAt(r.reenterAt, tech),
        )
      })
    }
    if (sp.returnTest) {
      const r = sp.returnTest
      sched.add(r.at, () => {
        const item = itemsOfSample(db, sample().id).find(
          (i) => i.testId === r.testId,
        )
        if (item) returnItem(db, item.id, r.reason, ctxAt(r.at, 'st_kavitha'))
      })
    }
    if (stopIndex >= 4 && !sp.returnTest) {
      for (const tt of testTimes) {
        // Technical review by the lab manager, then authorisation. Events
        // after "now" never run, so recent tests wait at either stage.
        const reviewAt = tt.enter + Math.round((tt.validate - tt.enter) * 0.45)
        if (!blockedAt(reviewAt))
          sched.add(reviewAt, () => {
            const ids = itemsOfSample(db, sample().id)
              .filter(
                (i) =>
                  isItemLive(i) &&
                  i.testId === tt.testId &&
                  i.status === 'entered',
              )
              .map((i) => i.id)
            if (ids.length) reviewItems(db, ids, ctxAt(reviewAt, REVIEWER))
          })
        if (blockedAt(tt.validate) || sp.reviewOnly) continue
        sched.add(tt.validate, () => {
          const ids = itemsOfSample(db, sample().id)
            .filter(
              (i) =>
                isItemLive(i) &&
                i.testId === tt.testId &&
                i.status === 'reviewed',
            )
            .map((i) => i.id)
          if (ids.length) validateItems(db, ids, ctxAt(tt.validate, validator))
        })
      }
    }
    if (stopIndex >= 5 && !sp.reject && !sp.hold && !sp.returnTest) {
      releaseByDept.set(
        req.department,
        Math.max(
          releaseByDept.get(req.department) ?? 0,
          ...testTimes.map((tt) => tt.release),
        ),
      )
    } else {
      blockedDepts.add(req.department)
    }
    if (sp.reject) {
      const r = sp.reject
      sched.add(
        r.at,
        () =>
          void rejectSample(
            db,
            sample().id,
            {
              reason: r.reason,
              recollect: r.recollect,
              ...(r.remarks ? { remarks: r.remarks } : {}),
            },
            ctxAt(r.at, tech),
          ),
      )
    }
    if (sp.hold) {
      const h = sp.hold
      sched.add(
        h.at,
        () =>
          void holdSample(
            db,
            sample().id,
            { reason: 'analyzer-down', remarks: h.remarks },
            ctxAt(h.at, tech),
          ),
      )
    }
  })

  for (const [dept, at] of releaseByDept) {
    if (blockedDepts.has(dept)) continue
    const releasedBy =
      dept === 'microbiology' ? 'st_meera' : rng.pick(VALIDATORS)
    sched.add(at, () => {
      const report = Object.values(db.reports).find(
        (r) => r.orderId === state.orderId && r.department === dept,
      )
      // Samples held at runtime (analyzer down) never reach validation.
      if (
        report &&
        deriveReportStatus(report, itemsOfReport(db, report.id)) === 'validated'
      )
        releaseReport(db, report.id, ctxAt(at, releasedBy))
    })
  }

  const reportOf = (department: DepartmentId) =>
    Object.values(db.reports).find(
      (r) => r.orderId === state.orderId && r.department === department,
    )
  if (plan.preliminary) {
    const pr = plan.preliminary
    sched.add(pr.at, () => {
      const report = reportOf(pr.department)
      if (report)
        releaseReport(db, report.id, ctxAt(pr.at, pr.by), { preliminary: true })
    })
  }
  if (plan.withdraw) {
    const w = plan.withdraw
    sched.add(w.at, () => {
      const report = reportOf(w.department)
      if (report) withdrawReport(db, report.id, w.reason, ctxAt(w.at, w.by))
    })
  }

  if (plan.correction) {
    const c = plan.correction
    sched.add(c.at, () => {
      const report = Object.values(db.reports).find(
        (r) => r.orderId === state.orderId && r.department === c.department,
      )
      if (!report) return
      const item = Object.values(db.items).find(
        (i) => i.reportId === report.id && i.analyteIds.includes(c.analyteId),
      )
      const result = Object.values(db.results).find(
        (r) => r.orderItemId === item?.id && r.analyteId === c.analyteId,
      )
      if (!result) return
      correctReport(
        db,
        report.id,
        {
          corrections: [{ resultId: result.id, value: c.value }],
          reason: c.reason,
          comments: c.comments,
        },
        ctxAt(c.at, c.by),
      )
    })
  }
}

/** Equipment id for a sample, undefined if none is needed, or 'unavailable'. */
function pickEquipment(db: LabDb, testIds: string[]): string | undefined {
  const candidates = Object.values(db.equipment).filter((e) =>
    testIds.some((t) => e.testIds.includes(t)),
  )
  if (candidates.length === 0) return undefined
  const usable = candidates.find(
    (e) => e.status === 'operational' || e.status === 'calibration-due',
  )
  return usable ? usable.id : 'unavailable'
}

export interface SeedResult {
  db: LabDb
  errors: string[]
}

/**
 * Builds the demo database by replaying every order through the engine.
 * `scale` multiplies the generated patients and workload (the stress test
 * uses 10); the default reproduces the same demo every time.
 */
export function seedDatabase(
  now: number,
  { scale = 1 }: { scale?: number } = {},
): SeedResult {
  const rng = createRng(SEED)
  const db = emptyDb(now)
  const ago = (minutes: number) => now - minutes * MINUTE
  const daysAgo = (days: number, hour = 9) =>
    now - days * DAY - (hour - 9) * HOUR

  for (const t of TESTS) db.tests[t.id] = structuredClone(t)
  for (const a of ANALYTES) db.analytes[a.id] = structuredClone(a)
  for (const r of REFERENCE_RANGES) db.ranges[r.id] = { ...r }
  for (const s of STAFF) db.staff[s.id] = { ...s }
  for (const d of DOCTORS) db.doctors[d.id] = { ...d }
  for (const e of seedEquipment(now)) db.equipment[e.id] = e
  const { reagents, lots } = seedReagents(now)
  for (const r of reagents) db.reagents[r.id] = r
  for (const l of lots) db.lots[l.id] = l
  for (const c of seedConsumables(now)) db.consumables[c.id] = c
  for (const q of seedQcRuns(now, rng)) db.qcRuns[q.id] = q
  db.dailyStats = seedDailyStats(now, rng)

  const named = Object.fromEntries(
    [...NAMED_PATIENTS, ...SCENARIO_PATIENTS].map((p) => [p.name, p]),
  )
  const P = (name: string) => named[name]!
  const generated = generatePatients(70 * scale, rng)
  for (const p of [...NAMED_PATIENTS, ...SCENARIO_PATIENTS, ...generated])
    db.patients[p.id] = toPatient(p, now, rng)

  const sched = new Scheduler()
  const flow = (plan: FlowPlan) => scheduleFlow(db, sched, plan, rng)
  const base = (p: PatientSeed) => ({
    patient: p,
    doctorId: doctorFor(p.department, rng),
    department: p.department,
    encounter: p.encounter,
    ...(p.ward ? { ward: p.ward } : {}),
    ...(p.bed ? { bed: p.bed } : {}),
  })
  const history = (
    p: PatientSeed,
    days: number,
    testIds: string[],
    overrides: Record<string, string>,
    notes = 'Follow-up.',
  ) =>
    flow({
      ...base(p),
      encounter:
        p.encounter === 'ICU' || p.encounter === 'IPD' ? p.encounter : 'OPD',
      priority: 'routine',
      notes,
      testIds,
      orderedAt: daysAgo(days, 8),
      overrides,
    })

  // ---------- Patient history (trends, previous reports, delta checks) ----------
  const rajesh = P('Rajesh Kumar')
  history(
    rajesh,
    300,
    ['hba1c', 'fbs'],
    { hba1c: '8.9', eag: '209', glu_f: '186' },
    'Diabetes review.',
  )
  history(
    rajesh,
    200,
    ['hba1c', 'fbs'],
    { hba1c: '8.2', eag: '189', glu_f: '168' },
    'Diabetes review.',
  )
  history(
    rajesh,
    110,
    ['hba1c', 'fbs', 'cbc'],
    { hba1c: '7.8', eag: '177', glu_f: '151', hb: '12.1' },
    'Diabetes review.',
  )
  history(
    rajesh,
    35,
    ['hba1c', 'fbs', 'cbc'],
    { hba1c: '7.6', eag: '171', glu_f: '146', hb: '11.8' },
    'Diabetes review.',
  )
  const meena = P('Meena Devi')
  history(
    meena,
    200,
    ['thyroid'],
    { tsh: '5.42', ft4: '1.08', ft3: '3.04' },
    'Thyroid screening.',
  )
  history(
    meena,
    90,
    ['thyroid'],
    { tsh: '7.91', ft4: '0.98', ft3: '2.81' },
    'Thyroid follow-up.',
  )
  const suresh = P('Suresh Babu')
  history(
    suresh,
    60,
    ['kft'],
    { creat: '3.10', urea: '96', bun: '44.8', k: '5.0' },
    'CKD follow-up.',
  )
  history(
    suresh,
    30,
    ['kft'],
    { creat: '3.62', urea: '104', bun: '48.6', k: '5.2' },
    'CKD follow-up.',
  )
  history(
    suresh,
    10,
    ['kft', 'cbc'],
    { creat: '4.18', urea: '118', bun: '55.1', k: '5.4', hb: '9.6' },
    'CKD follow-up.',
  )
  history(
    suresh,
    3,
    ['kft'],
    { creat: '4.41', urea: '122', bun: '57.0', k: '5.5' },
    'Admission bloods.',
  )
  const karthik = P('Karthik Subramanian')
  history(
    karthik,
    3,
    ['dengue_ns1', 'dengue_ab', 'cbc'],
    {
      dns1: 'positive',
      digm: 'positive',
      digg: 'negative',
      plt: '0.86',
      hb: '14.6',
      pcv: '44.2',
      wbc: '3900',
    },
    'Fever for 3 days.',
  )
  history(
    karthik,
    2,
    ['cbc'],
    { plt: '0.42', hb: '14.9', pcv: '45.1', wbc: '3400' },
    'Platelet monitoring.',
  )
  history(
    karthik,
    1,
    ['cbc'],
    { plt: '0.28', hb: '15.4', pcv: '47.0', wbc: '3100' },
    'Platelet monitoring.',
  )
  history(
    P('Priya Nair'),
    30,
    ['cbc'],
    { hb: '10.4', mcv: '75.2', mch: '24.1' },
    'Antenatal booking visit.',
  )
  history(
    P('Lakshmi Krishnan'),
    180,
    ['lipid', 'fbs'],
    {
      tc: '236',
      ldl: '152',
      tg: '190',
      hdl: '41',
      vldl: '38',
      tchdl: '5.8',
      glu_f: '112',
    },
    'Cardiac risk review.',
  )
  history(
    P('Mohammed Faisal'),
    1,
    ['kft'],
    { creat: '4.82', urea: '142', bun: '66.4', k: '5.9', na: '133' },
    'ICU admission bloods.',
  )

  // Rajesh: yesterday's CBC was released, then corrected (platelet clumping).
  flow({
    ...base(rajesh),
    priority: 'routine',
    notes: 'Fatigue. Review blood count.',
    testIds: ['cbc'],
    orderedAt: ago(26 * 60),
    overrides: { hb: '11.4', plt: '0.92', wbc: '8100' },
    all: {
      collect: ago(26 * 60 - 12),
      receive: ago(26 * 60 - 30),
      start: ago(26 * 60 - 36),
      enter: ago(24 * 60 + 40),
      validate: ago(24 * 60 + 20),
      release: ago(24 * 60),
    },
    correction: {
      at: ago(21 * 60),
      department: 'hematology',
      analyteId: 'plt',
      value: '2.14',
      reason: 'repeat-analysis',
      comments:
        'Platelet clumps seen on smear (EDTA-induced pseudothrombocytopenia). Repeated on citrated sample: 2.14 lakh/µL.',
      by: 'st_sanjay',
    },
  })

  // Generated history for previous reports.
  for (let i = 0; i < 26 * scale; i++) {
    const p = rng.pick(generated)
    const { tests, notes } = panelFor(p, rng)
    const shortTests = tests.filter(
      (id) => (TESTS.find((t) => t.id === id)?.tatHours ?? 0) <= 24,
    )
    if (shortTests.length === 0) continue
    flow({
      ...base(p),
      encounter: p.encounter === 'EMERGENCY' ? 'OPD' : p.encounter,
      priority: 'routine',
      notes,
      testIds: shortTests,
      orderedAt: daysAgo(rng.int(1, 14), rng.int(7, 16)),
    })
  }
  // Creatinine baseline for the sent-back scenario.
  const deltaPatient = generated.find(
    (p) => p.encounter === 'OPD' && p.ageYears > 30,
  )!
  history(deltaPatient, 40, ['kft'], { creat: '1.10' }, 'Hypertension review.')

  // ---------- Today: named scenarios ----------
  flow({
    ...base(rajesh),
    doctorId: 'dr_ramesh',
    priority: 'routine',
    notes:
      'Fatigue for 3 weeks. Known T2DM on metformin. Review Hb and liver enzymes.',
    testIds: ['cbc', 'lft'],
    orderedAt: ago(125),
    all: {
      collect: ago(112),
      receive: ago(96),
      start: ago(88),
      stopAfter: 'start',
    },
  })
  flow({
    ...base(meena),
    doctorId: 'dr_nandini',
    priority: 'routine',
    notes:
      'Subclinical hypothyroidism. Repeat thyroid profile before deciding on thyroxine.',
    testIds: ['thyroid'],
    orderedAt: ago(430),
    all: {
      collect: ago(418),
      receive: ago(400),
      start: ago(392),
      enter: ago(150),
      validate: ago(120),
      release: ago(95),
    },
  })
  flow({
    ...base(P('Arun Prakash')),
    doctorId: 'dr_srinivas',
    priority: 'urgent',
    notes: 'Obstructive jaundice? Pre-ERCP work-up.',
    testIds: ['lft', 'pt_inr', 'hbsag'],
    orderedAt: ago(250),
    all: { collect: ago(236), receive: ago(221), start: ago(214) },
    samples: {
      'biochemistry:sst': {
        enter: ago(58),
        validate: ago(12),
        stopAfter: 'validate',
        reviewOnly: true,
      },
      'hematology:citrate': {
        enter: ago(150),
        validate: ago(90),
        stopAfter: 'validate',
        reviewOnly: true,
      },
      // Authorised but held for the rest of the order: nothing released yet.
      'serology:sst': {
        enter: ago(110),
        validate: ago(80),
        stopAfter: 'validate',
      },
    },
  })
  flow({
    ...base(P('Priya Nair')),
    doctorId: 'dr_farah',
    priority: 'routine',
    notes: 'Antenatal profile, 14 weeks. Tiredness.',
    testIds: ['cbc', 'bg', 'hiv', 'hbsag', 'vdrl', 'urine_re', 'tsh_test'],
    orderedAt: ago(185),
    all: { collect: ago(170), receive: ago(150), start: ago(145) },
    samples: {
      'hematology:edta': {
        enter: ago(95),
        validate: ago(70),
        release: ago(62),
      },
      'serology:sst': { stopAfter: 'start' },
      'immunology:sst': { stopAfter: 'start' },
      'clinical-pathology:urine': { stopAfter: 'receive' },
    },
  })
  flow({
    ...base(suresh),
    doctorId: 'dr_joseph',
    priority: 'urgent',
    notes:
      'CKD stage 4 with fluid overload. Check potassium before dialysis decision.',
    testIds: ['kft', 'calcium', 'cbc'],
    orderedAt: ago(310),
    samples: {
      'hematology:edta': {
        collect: ago(298),
        receive: ago(280),
        start: ago(275),
        enter: ago(210),
        validate: ago(185),
        release: ago(175),
      },
      'biochemistry:sst': {
        collect: ago(298),
        receive: ago(280),
        reject: {
          at: ago(262),
          reason: 'hemolyzed-sample',
          remarks: 'Grossly haemolysed. Potassium not reportable.',
          recollect: true,
        },
      },
    },
  })
  flow({
    ...base(P('Lakshmi Krishnan')),
    doctorId: 'dr_venkatesh',
    priority: 'routine',
    notes: 'Annual cardiac risk review. Fasting since 9 pm.',
    testIds: ['lipid', 'fbs', 'hba1c', 'kft'],
    orderedAt: ago(34),
    all: { stopAfter: 'none' },
  })
  flow({
    ...base(P('Mohammed Faisal')),
    doctorId: 'dr_lakshmi',
    priority: 'stat',
    notes:
      'AKI on CKD, oliguric. Urgent potassium. Chest discomfort overnight.',
    testIds: ['kft', 'cbc', 'trop'],
    orderedAt: ago(96),
    all: { collect: ago(90), receive: ago(83), start: ago(80) },
    critical: {
      at: ago(28),
      notifiedTo: 'Dr. Lakshmi Narayanan (ICU consultant)',
      role: 'consultant',
      method: 'phone',
      acknowledged: false,
      outcome: 'no-answer',
      escalate: {
        at: ago(9),
        to: 'Dr. Arvind Rao (ICU in-charge)',
        reason: 'Ordering consultant not reachable within 30 minutes',
      },
    },
    samples: {
      'biochemistry:sst': { enter: ago(41), stopAfter: 'enter' },
      'biochemistry:heparin': { enter: ago(58), stopAfter: 'enter' },
      'hematology:edta': {
        enter: ago(62),
        validate: ago(55),
        release: ago(50),
      },
    },
  })
  flow({
    ...base(P('Anitha R')),
    doctorId: 'dr_asha',
    priority: 'urgent',
    notes: 'Fever with myalgia for 3 days. Rule out dengue.',
    testIds: ['cbc', 'crp', 'dengue_ns1', 'dengue_ab'],
    orderedAt: ago(22),
    all: { stopAfter: 'none' },
  })
  flow({
    ...base(karthik),
    doctorId: 'dr_ramesh',
    priority: 'urgent',
    notes: 'Dengue day 5. Platelet monitoring every 12 hours.',
    testIds: ['cbc'],
    orderedAt: ago(290),
    all: {
      collect: ago(282),
      receive: ago(270),
      start: ago(266),
      enter: ago(238),
      validate: ago(215),
      release: ago(205),
    },
    critical: {
      at: ago(226),
      notifiedTo: 'Dr. Asha Kiran (duty resident, Ward 3A)',
      role: 'resident',
      method: 'phone',
      acknowledged: true,
    },
  })
  const deepa = P('Deepa Menon')
  flow({
    ...base(deepa),
    doctorId: 'dr_harpreet',
    priority: 'routine',
    notes: 'Solitary thyroid nodule, right lobe. USG TIRADS 3.',
    testIds: ['fnac'],
    orderedAt: ago(26 * 60),
    all: {
      collect: ago(25 * 60 + 20),
      receive: ago(25 * 60),
      start: ago(24 * 60 + 30),
      stopAfter: 'start',
    },
  })
  flow({
    ...base(deepa),
    doctorId: 'dr_harpreet',
    priority: 'routine',
    notes: 'Generalised fatigue and tingling of feet.',
    testIds: ['vitd', 'b12'],
    orderedAt: ago(200),
    all: {
      collect: ago(185),
      receive: ago(160),
      start: ago(150),
      stopAfter: 'start',
    },
  })
  flow({
    ...base(P('Harish Shetty')),
    doctorId: 'dr_arvind',
    priority: 'stat',
    notes: 'Chest pain for 2 hours with sweating. ECG: ST depression V4 to V6.',
    testIds: ['trop', 'cbc', 'kft'],
    orderedAt: ago(80),
    all: { collect: ago(75), receive: ago(68), start: ago(64) },
    samples: {
      'biochemistry:heparin': { stopAfter: 'start' },
      'biochemistry:sst': {
        enter: ago(30),
        validate: ago(22),
        release: ago(15),
      },
      'hematology:edta': {
        enter: ago(50),
        validate: ago(44),
        release: ago(40),
      },
    },
  })
  const shanthamma = P('Shanthamma')
  flow({
    ...base(shanthamma),
    doctorId: 'dr_lakshmi',
    priority: 'stat',
    notes: 'Urosepsis with septic shock. Blood cultures before antibiotics.',
    testIds: ['blood_cs'],
    orderedAt: ago(3 * 24 * 60 + 130),
    all: {
      collect: ago(3 * 24 * 60 + 120),
      receive: ago(3 * 24 * 60 + 100),
      start: ago(3 * 24 * 60 + 95),
      enter: ago(52),
      stopAfter: 'enter',
    },
    overrides: { bc_org: 'Escherichia coli' },
    critical: {
      at: ago(40),
      notifiedTo: 'Sister Mary Thomas (MICU charge nurse)',
      role: 'staff-nurse',
      method: 'phone',
      acknowledged: false,
    },
  })
  flow({
    ...base(shanthamma),
    doctorId: 'dr_lakshmi',
    priority: 'stat',
    notes: 'Sepsis monitoring.',
    testIds: ['cbc', 'crp'],
    orderedAt: ago(160),
  })
  flow({
    ...base(P('Ayesha Siddiqui')),
    doctorId: 'dr_nandini',
    priority: 'routine',
    notes: 'Weight gain, hair fall. Thyroid and vitamin work-up.',
    testIds: ['thyroid', 'vitd'],
    orderedAt: ago(38),
    draft: true,
  })

  // Rejections awaiting recollection, and one written off.
  const opd = generated.filter((p) => p.encounter === 'OPD' && p.ageYears >= 18)
  const ipd = generated.filter((p) => p.encounter === 'IPD')
  flow({
    ...base(opd[1]!),
    priority: 'routine',
    notes: 'Routine blood count.',
    testIds: ['cbc'],
    orderedAt: ago(150),
    all: {
      collect: ago(140),
      receive: ago(122),
      reject: {
        at: ago(118),
        reason: 'clotted-sample',
        remarks: 'Micro-clots in EDTA sample.',
        recollect: true,
      },
    },
  })
  flow({
    ...base(ipd[0]!),
    priority: 'routine',
    notes: 'Catheter-associated fever.',
    testIds: ['urine_cs'],
    orderedAt: ago(330),
    all: {
      collect: ago(300),
      receive: ago(270),
      reject: {
        at: ago(265),
        reason: 'insufficient-sample',
        remarks: 'Less than 1 mL urine received.',
        recollect: true,
      },
    },
  })
  flow({
    ...base(opd[2]!),
    priority: 'routine',
    notes: 'Baseline before starting statin.',
    testIds: ['lft', 'kft'],
    orderedAt: ago(200),
    all: {
      collect: ago(190),
      receive: ago(175),
      reject: {
        at: ago(170),
        reason: 'incorrect-label',
        remarks: 'Name on tube label does not match requisition.',
        recollect: true,
      },
    },
  })
  flow({
    ...base(opd[3]!),
    priority: 'routine',
    notes: 'Diabetes screening.',
    testIds: ['fbs'],
    orderedAt: ago(380),
    all: {
      collect: ago(372),
      receive: ago(300),
      reject: {
        at: ago(290),
        reason: 'delayed-transport',
        remarks:
          'Received 70 minutes after collection without cold chain. Patient left; clinician informed.',
        recollect: false,
      },
    },
  })

  // Electrolytes on hold (electrolyte analyzer out of service).
  flow({
    ...base(ipd[1]!),
    priority: 'urgent',
    notes: 'Hyponatraemia follow-up.',
    testIds: ['electrolytes'],
    orderedAt: ago(140),
  })
  flow({
    ...base(ipd[2]!),
    priority: 'routine',
    notes: 'Diuretic therapy monitoring.',
    testIds: ['electrolytes'],
    orderedAt: ago(260),
  })

  // Sent back by the pathologist (delta check).
  flow({
    ...base(deltaPatient),
    priority: 'routine',
    notes: 'Hypertension review.',
    testIds: ['kft'],
    orderedAt: ago(180),
    overrides: { creat: '2.84' },
    all: {
      collect: ago(170),
      receive: ago(150),
      start: ago(146),
      enter: ago(60),
      returnTest: {
        testId: 'kft',
        at: ago(35),
        reason:
          'Delta check failed for creatinine (+158% since last result). Repeat on a fresh aliquot.',
      },
    },
  })

  // Preliminary microbiology: the Gram stain is out, the culture is growing.
  flow({
    ...base(ipd[3]!),
    priority: 'urgent',
    notes:
      'Catheter-associated fever, day 4. Urine and catheter-site swab sent.',
    testIds: ['urine_cs', 'gram'],
    orderedAt: ago(9 * 60),
    all: {
      collect: ago(8 * 60 + 50),
      receive: ago(8 * 60 + 25),
      start: ago(8 * 60 + 15),
      enter: ago(7 * 60 + 20),
      validate: ago(7 * 60),
      stopAfter: 'validate',
      pendingTestIds: ['urine_cs'],
    },
    overrides: { gram: 'Gram-negative bacilli seen.' },
    preliminary: {
      at: ago(6 * 60 + 50),
      department: 'microbiology',
      by: 'st_meera',
    },
  })
  // Withdrawn after release: the specimen's identity was in doubt.
  flow({
    ...base(opd[4]!),
    priority: 'routine',
    notes: 'Routine blood count.',
    testIds: ['cbc'],
    orderedAt: ago(28 * 60),
    all: {
      collect: ago(28 * 60 - 10),
      receive: ago(28 * 60 - 35),
      start: ago(28 * 60 - 40),
      enter: ago(27 * 60),
      validate: ago(26 * 60 + 30),
      release: ago(26 * 60),
    },
    withdraw: {
      at: ago(23 * 60),
      department: 'hematology',
      reason:
        'Two patients with the same name were bled at the same time in OPD; specimen identity cannot be confirmed. Recollection requested before the report is issued again.',
      by: 'st_sanjay',
    },
  })
  // Repeat analysis: TSH above the measuring range, repeated at 1:10.
  flow({
    ...base(opd[5]!),
    priority: 'routine',
    notes: 'Known hypothyroidism, stopped thyroxine 2 months ago.',
    testIds: ['tsh_test'],
    orderedAt: ago(300),
    overrides: { tsh: '100.00' },
    all: {
      collect: ago(290),
      receive: ago(270),
      start: ago(262),
      enter: ago(110),
      stopAfter: 'enter',
      rerun: {
        at: ago(95),
        testId: 'tsh_test',
        reason:
          'Above the analytical measuring range (100 µIU/mL). Repeated on the same specimen at 1:10 dilution.',
        dilution: 10,
        reenterAt: ago(48),
        values: { tsh: '148.60' },
      },
    },
  })

  // ---------- Today: general workload ----------
  const reserved = new Set(
    [
      opd[1],
      opd[2],
      opd[3],
      opd[4],
      opd[5],
      ipd[0],
      ipd[1],
      ipd[2],
      ipd[3],
      deltaPatient,
    ].map((p) => p!.id),
  )
  const pool = generated.filter((p) => !reserved.has(p.id))
  for (let i = 0; i < 82 * scale; i++) {
    const p = rng.pick(pool)
    const { tests, notes } = panelFor(p, rng)
    const priority: Priority =
      p.encounter === 'EMERGENCY' || p.encounter === 'ICU'
        ? rng.weighted([
            ['stat', 5],
            ['urgent', 3],
            ['routine', 2],
          ] as const)
        : p.encounter === 'IPD'
          ? rng.weighted([
              ['urgent', 2],
              ['routine', 8],
            ] as const)
          : rng.weighted([
              ['urgent', 0.6],
              ['routine', 9.4],
            ] as const)
    const minutesAgo = rng.chance(0.58)
      ? rng.between(290, 600)
      : rng.between(4, 290)
    flow({
      ...base(p),
      priority,
      notes,
      testIds: tests.filter((t) => t !== 'electrolytes'),
      orderedAt: ago(minutesAgo),
    })
  }

  // Queue depth for the demo: results awaiting validation, validated reports
  // awaiting release, and samples received but not yet started.
  const shortPanels: string[][] = [
    ['cbc'],
    ['lft'],
    ['kft'],
    ['urine_re'],
    ['cbc', 'esr'],
    ['rbs'],
    ['lipid'],
    ['crp'],
  ]
  const validationPanels: string[][] = [
    ['cbc'],
    ['lft'],
    ['kft'],
    ['urine_re'],
    ['cbc', 'esr'],
    ['lipid'],
    ['thyroid'],
  ]
  for (let i = 0; i < 7; i++) {
    const orderedMin = rng.between(80, 110)
    flow({
      ...base(rng.pick(pool)),
      priority: 'routine',
      notes: 'Routine investigations.',
      testIds: rng.pick(validationPanels),
      orderedAt: ago(orderedMin),
      all: {
        collect: ago(orderedMin - 6),
        receive: ago(orderedMin - 20),
        start: ago(orderedMin - 26),
        enter: ago(rng.between(8, 30)),
        stopAfter: 'enter',
      },
    })
  }
  for (let i = 0; i < 3; i++)
    flow({
      ...base(rng.pick(pool)),
      priority: 'routine',
      notes: 'Routine investigations.',
      testIds: rng.pick(shortPanels),
      orderedAt: ago(rng.between(200, 260)),
      all: { stopAfter: 'validate' },
    })
  for (let i = 0; i < 3; i++)
    flow({
      ...base(rng.pick(pool)),
      priority: 'routine',
      notes: 'Routine investigations.',
      testIds: rng.pick(shortPanels),
      orderedAt: ago(rng.between(45, 70)),
      all: { stopAfter: 'receive' },
    })

  sched.run(now)
  enrichDatabase(db, now, rng)

  const todayKey = istDay(now)
  const collectedToday = Object.values(db.samples).filter(
    (s) => s.collectedAt && istDay(s.collectedAt) === todayKey,
  ).length
  const share = dayShareUntilHour(istHour(now), (now % HOUR) / HOUR)
  const typical =
    db.dailyStats.reduce((n, d) => n + d.samples, 0) /
    Math.max(1, db.dailyStats.length)
  if (share > 0.08 && typical > 0)
    rescaleDailyStats(db.dailyStats, collectedToday / share / typical)

  notify(
    db,
    { now: ago(20 * 60), by: 'st_prakash' },
    'qc-failed',
    'danger',
    {
      equipment: 'Electrolyte Analyzer',
      analyte: 'Potassium',
      level: 'L2',
      rule: '2-2s',
    },
    '/quality-control',
  )
  notify(
    db,
    { now: ago(20 * 60 - 5), by: 'st_prakash' },
    'equipment-down',
    'danger',
    { equipment: 'Electrolyte Analyzer' },
    '/equipment',
  )
  notify(
    db,
    { now: ago(5 * 60), by: 'st_lavanya' },
    'lot-quarantined',
    'warning',
    { item: 'Elecsys HIV combi PT', lot: '67398810' },
    '/reagents',
  )
  db.notifications.sort((a, b) => b.at - a.at)
  for (const n of db.notifications) {
    const routine =
      (n.type === 'report-released' && n.at < now - 20 * MINUTE) ||
      n.type === 'result-returned'
    if (n.at < now - 90 * MINUTE || routine) n.read = true
  }

  return { db, errors: sched.errors }
}
