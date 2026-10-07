// Demo quality, compliance and integration records, made through the
// engine: EQA rounds (one unacceptable, with its CAPA), non-conformances
// at each step, controlled documents, internal audits, the risk register,
// an LIS verification run, equipment qualification, temperature logs,
// privacy requests and an incident, a legal hold, sites, analyser
// interface traffic with a few errors, LOINC codes and an auto-verification
// rule. Everything is synthetic.

import { DAY, HOUR, MINUTE, startOfIstDay } from '@/domain/time'
import { addMonths } from '@/domain/quality'
import type { DepartmentId, InterfaceMessage, LabTest } from '@/domain/types'
import type { LabDb } from '../schema'
import type { EngineCtx } from '../../engine/core'
import {
  addFinding,
  advanceNc,
  approveDocument,
  completeAudit,
  createDocument,
  evaluateEqa,
  planAudit,
  raiseNc,
  recordQualification,
  recordTemperature,
  reviewLisVerification,
  reviseDocument,
  runLisVerification,
  saveColdUnit,
  saveRisk,
  startAudit,
  submitDocument,
  submitEqa,
} from '../../engine/quality'
import {
  advanceDataRequest,
  logBreach,
  logDataRequest,
  placeHold,
  updateBreach,
} from '../../engine/privacy'
import { saveSite } from '../../engine/interfaces'
import { approveRule, draftRule } from '../../engine/autoverify'
import type { Rng } from './random'

const MANAGER = 'st_ganesh'
const PATHOLOGIST = 'st_kavitha'
const PATHOLOGIST_2 = 'st_sanjay'
const HAEM = 'st_anjali'
const BIOCHEM = 'st_prakash'

/** LOINC codes for common analytes; the lab confirms each in its LOINC review. */
const LOINC: Record<string, string> = {
  hb: '718-7',
  rbc: '789-8',
  pcv: '4544-3',
  mcv: '787-2',
  mch: '785-6',
  mchc: '786-4',
  rdw: '788-0',
  wbc: '6690-2',
  neut: '770-8',
  lymph: '736-9',
  mono: '5905-5',
  eos: '713-8',
  baso: '706-2',
  plt: '777-3',
  mpv: '32623-1',
  esr: '30341-2',
  retic: '4679-7',
  pt: '5902-2',
  inr: '6301-6',
  glu_f: '1558-6',
  glu_r: '2345-7',
  hba1c: '4548-4',
  eag: '27353-2',
  tbil: '1975-2',
  dbil: '1968-7',
  ast: '1920-8',
  alt: '1742-6',
  alp: '6768-6',
  ggt: '2324-2',
  tp: '2885-2',
  alb: '1751-7',
  glob: '10834-0',
  ag: '1759-0',
  urea: '3091-6',
  bun: '3094-0',
  creat: '2160-0',
  uric: '3084-1',
  na: '2951-2',
  k: '2823-3',
  cl: '2075-0',
  ca: '17861-6',
  tc: '2093-3',
  tg: '2571-8',
  hdl: '2085-9',
  ldl: '13457-7',
  vldl: '13458-5',
  tchdl: '9830-1',
  b12: '2132-9',
  ferritin: '2276-4',
  ft3: '3051-0',
  ft4: '3024-7',
  tsh: '3016-3',
  crp: '1988-5',
  psa: '2857-1',
  hbsag: '5196-1',
  u_ph: '5803-2',
  u_sg: '5811-5',
}

export function seedQuality(db: LabDb, now: number, rng: Rng) {
  const at = (by: string, ago: number): EngineCtx => ({ now: now - ago, by })

  // ---------- Lab profile dates, coding ----------
  db.settings.profile.registrationValidFrom = addMonths(now, -58)
  // Renewal falls inside the 90-day window, so the reminder shows.
  db.settings.profile.registrationValidTo = addMonths(now, 2)
  db.settings.profile.nablValidTo = addMonths(now, 14)
  for (const [analyteId, code] of Object.entries(LOINC)) {
    const analyte = db.analytes[analyteId]
    if (analyte) analyte.loinc = code
  }

  // ---------- Sites; some recent orders came through the branches ----------
  const ctxSetup = at(MANAGER, 400 * DAY)
  saveSite(
    db,
    {
      code: 'MAIN',
      name: 'SHRI HEALTH Central Laboratory',
      kind: 'main',
      city: 'Bengaluru',
      active: true,
    },
    ctxSetup,
  )
  const branches = [
    saveSite(
      db,
      {
        code: 'JNR',
        name: 'Jayanagar Branch Laboratory',
        kind: 'branch',
        city: 'Bengaluru',
        active: true,
      },
      ctxSetup,
    ),
    saveSite(
      db,
      {
        code: 'HSR',
        name: 'HSR Layout Satellite',
        kind: 'satellite',
        city: 'Bengaluru',
        active: true,
      },
      ctxSetup,
    ),
  ]
  // Missing siteId means the main laboratory; some orders came through the
  // branches.
  for (const order of Object.values(db.orders)) {
    const roll = rng.next()
    if (roll < 0.18) order.siteId = branches[0]!.id
    else if (roll < 0.28) order.siteId = branches[1]!.id
  }

  // ---------- EQA ----------
  const eqa = (
    scheme: string,
    roundNo: string,
    analyteId: string,
    equipmentId: string,
    receivedAgo: number,
  ) => {
    const id = `eqa_${scheme.toLowerCase().replace(/[^a-z0-9]/g, '')}_${roundNo}_${analyteId}`
    db.eqaRounds[id] = {
      id,
      provider:
        scheme === 'AIIMS-EQAS' ? 'AIIMS, New Delhi' : 'CMC Vellore EQAS',
      scheme,
      roundNo,
      analyteId,
      equipmentId,
      receivedAt: now - receivedAgo,
      dueAt: now - receivedAgo + 14 * DAY,
    }
    return id
  }
  const past = [
    ['CMC-EQAS', '2026-03', 'hb', 'eq_xn1000', 9.8, 10.1, 0.25],
    ['CMC-EQAS', '2026-03', 'plt', 'eq_xn1000', 212, 205, 12],
    ['AIIMS-EQAS', '2026-Q2', 'glu_f', 'eq_c311', 96, 98, 3],
    ['AIIMS-EQAS', '2026-Q2', 'creat', 'eq_c311', 1.42, 1.18, 0.07],
    ['AIIMS-EQAS', '2026-Q2', 'tc', 'eq_c311', 188, 182, 6],
  ] as const
  past.forEach(([scheme, round, analyte, eq, value, target, sd], i) => {
    const id = eqa(scheme, round, analyte, eq, (80 - i * 6) * DAY)
    submitEqa(
      db,
      id,
      value,
      at(eq === 'eq_xn1000' ? HAEM : BIOCHEM, (72 - i * 6) * DAY),
    )
    evaluateEqa(
      db,
      id,
      { targetValue: target, targetSd: sd },
      at(MANAGER, (50 - i * 4) * DAY),
    )
  })
  // Current round: received, one result submitted, one to do.
  const open1 = eqa('CMC-EQAS', '2026-09', 'hb', 'eq_xn1000', 6 * DAY)
  submitEqa(db, open1, 12.6, at(HAEM, 2 * DAY))
  eqa('CMC-EQAS', '2026-09', 'wbc', 'eq_xn1000', 6 * DAY)
  eqa('AIIMS-EQAS', '2026-Q3', 'tsh', 'eq_e411', 3 * DAY)

  // The creatinine EQA failure: worked through CAPA, now being verified.
  const creatNc = Object.values(db.ncs).find((n) => n.source === 'eqa')
  if (creatNc) {
    advanceNc(
      db,
      creatNc.id,
      {
        to: 'investigating',
        ownerId: BIOCHEM,
        dueAt: now + 10 * DAY,
        correction: 'Creatinine results since the last calibration reviewed.',
      },
      at(MANAGER, 44 * DAY),
    )
    advanceNc(
      db,
      creatNc.id,
      {
        to: 'action',
        rootCause:
          'Calibrator lot changed without a lot-to-lot comparison; positive bias of about 20% at the medical decision level.',
      },
      at(MANAGER, 38 * DAY),
    )
    advanceNc(
      db,
      creatNc.id,
      {
        to: 'verifying',
        correctiveAction:
          'Recalibrated with the new lot; lot-to-lot comparison added to SOP BC-04.',
        preventiveAction:
          'Inventory blocks a new calibrator lot until the comparison is recorded.',
      },
      at(MANAGER, 20 * DAY),
    )
  }
  // Other non-conformances at each step.
  raiseNc(
    db,
    {
      source: 'specimen',
      severity: 'minor',
      title: 'Haemolysed specimens from Ward 3 above 5% this week',
      description:
        'Seven of 112 specimens from Ward 3 were rejected as haemolysed between Monday and Thursday.',
      department: 'biochemistry',
    },
    at(BIOCHEM, 2 * DAY),
  )
  const tat = raiseNc(
    db,
    {
      source: 'complaint',
      severity: 'major',
      title: 'Emergency CBC reported after the 60-minute target',
      description:
        'The emergency department reported three CBC results beyond the target during the night shift on a single day.',
      department: 'hematology',
    },
    at(MANAGER, 12 * DAY),
  )
  advanceNc(
    db,
    tat.id,
    { to: 'investigating', ownerId: HAEM, dueAt: now + 4 * DAY },
    at(MANAGER, 11 * DAY),
  )
  const fridge = raiseNc(
    db,
    {
      source: 'equipment',
      severity: 'minor',
      title: 'Reagent refrigerator 2 read 9.1 °C at the morning check',
      description: 'Door found ajar after the evening delivery.',
      department: 'biochemistry',
    },
    at(BIOCHEM, 60 * DAY),
  )
  advanceNc(
    db,
    fridge.id,
    { to: 'investigating', ownerId: BIOCHEM, dueAt: now - 50 * DAY + 7 * DAY },
    at(MANAGER, 59 * DAY),
  )
  advanceNc(
    db,
    fridge.id,
    {
      to: 'action',
      rootCause: 'Delivery staff not trained on the door alarm.',
    },
    at(MANAGER, 57 * DAY),
  )
  advanceNc(
    db,
    fridge.id,
    {
      to: 'verifying',
      correctiveAction:
        'Door alarm enabled; delivery checklist signed by the receiver.',
    },
    at(MANAGER, 55 * DAY),
  )
  advanceNc(
    db,
    fridge.id,
    {
      to: 'closed',
      effective: true,
      note: 'No excursions in 30 days of twice-daily readings.',
    },
    at(PATHOLOGIST, 25 * DAY),
  )

  // ---------- Controlled documents ----------
  const docs: [string, string, LabTest['department'] | 'all', string][] = [
    [
      'QM-01',
      'Quality manual',
      'all',
      'Quality policy, objectives and the management system.',
    ],
    [
      'GEN-03',
      'Specimen collection and transport',
      'all',
      'Patient identification, order of draw, labelling and transport.',
    ],
    [
      'HM-02',
      'Complete blood count on the XN-1000',
      'hematology',
      'Start-up, IQC, running specimens and reporting.',
    ],
    [
      'BC-04',
      'Calibration and lot-to-lot comparison',
      'biochemistry',
      'Calibration frequency, new lot verification and acceptance limits.',
    ],
    [
      'MB-01',
      'Blood culture processing',
      'microbiology',
      'Loading, positive bottles, Gram stain and critical calls.',
    ],
    [
      'GEN-07',
      'Critical value communication',
      'all',
      'Critical limits, read-back and escalation.',
    ],
  ]
  docs.forEach(([code, title, department, summary], i) => {
    const doc = createDocument(
      db,
      {
        code,
        title,
        kind: code === 'QM-01' ? 'manual' : 'sop',
        department,
        reviewMonths: 12,
        summary,
      },
      at(MANAGER, (420 - i * 15) * DAY),
    )
    submitDocument(db, doc.id, at(MANAGER, (418 - i * 15) * DAY))
    approveDocument(db, doc.id, at(PATHOLOGIST, (414 - i * 15) * DAY))
  })
  // BC-04 revised after the EQA failure, waiting for authorisation.
  const bc04 = Object.values(db.documents).find((d) => d.code === 'BC-04')
  if (bc04) {
    reviseDocument(
      db,
      bc04.id,
      'Adds the lot-to-lot comparison before a new calibrator lot is used.',
      at(BIOCHEM, 21 * DAY),
    )
    submitDocument(db, bc04.id, at(BIOCHEM, 20 * DAY))
  }
  // A recently reviewed SOP.
  const gen07 = Object.values(db.documents).find((d) => d.code === 'GEN-07')
  if (gen07) {
    reviseDocument(
      db,
      gen07.id,
      'Adds the escalation tiers and timers.',
      at(MANAGER, 40 * DAY),
    )
    submitDocument(db, gen07.id, at(MANAGER, 39 * DAY))
    approveDocument(db, gen07.id, at(PATHOLOGIST_2, 36 * DAY))
  }
  createDocument(
    db,
    {
      code: 'GEN-11',
      title: 'Home collection and cold chain',
      kind: 'sop',
      department: 'all',
      reviewMonths: 24,
      summary: 'Booking, identification at home, cold box and hand-over.',
    },
    at(MANAGER, 5 * DAY),
  )

  // ---------- Internal audits ----------
  const done = planAudit(
    db,
    {
      area: 'Pre-examination: collection and reception',
      clauses: '7.2, 7.3',
      department: 'clinical-pathology',
      plannedFor: now - 70 * DAY,
      auditorId: BIOCHEM,
    },
    at(MANAGER, 100 * DAY),
  )
  startAudit(db, done.id, at(BIOCHEM, 70 * DAY))
  addFinding(
    db,
    done.id,
    {
      kind: 'nonconformity',
      clause: '7.2.6',
      text: 'Two specimens received without collection time on the request form.',
    },
    at(BIOCHEM, 70 * DAY - 2 * HOUR),
  )
  addFinding(
    db,
    done.id,
    {
      kind: 'observation',
      clause: '7.3.4',
      text: 'Rejection reasons are recorded but not trended monthly.',
    },
    at(BIOCHEM, 70 * DAY - HOUR),
  )
  completeAudit(
    db,
    done.id,
    'Collection and reception largely conform; one nonconformity raised for missing collection times.',
    at(BIOCHEM, 69 * DAY),
  )
  planAudit(
    db,
    {
      area: 'Examination: haematology IQC and EQA',
      clauses: '7.3.7',
      department: 'hematology',
      plannedFor: now + 9 * DAY,
      auditorId: BIOCHEM,
    },
    at(MANAGER, 30 * DAY),
  )
  planAudit(
    db,
    {
      area: 'Post-examination: reporting and release',
      clauses: '7.4',
      department: 'all',
      plannedFor: now + 40 * DAY,
      auditorId: PATHOLOGIST_2,
    },
    at(MANAGER, 30 * DAY),
  )

  // ---------- Risk register ----------
  const risks: [
    string,
    string,
    string,
    number,
    number,
    string,
    number,
    number,
  ][] = [
    [
      'Patient misidentification at collection',
      'Pre-examination',
      'Specimen labelled for the wrong patient',
      3,
      5,
      'Two identifiers confirmed; labels printed at the bedside',
      1,
      5,
    ],
    [
      'Critical value not communicated in time',
      'Post-examination',
      'Delayed treatment',
      2,
      5,
      'Read-back; escalation tiers; dashboard alert',
      1,
      5,
    ],
    [
      'Analyser interface down overnight',
      'Examination',
      'Manual transcription errors',
      3,
      4,
      'Manual entry double-checked; downtime procedure',
      2,
      3,
    ],
    [
      'Cold chain break in home collection',
      'Pre-examination',
      'Unreliable glucose and potassium',
      3,
      3,
      'Validated cold boxes; transit time limit',
      2,
      2,
    ],
    [
      'Calibrator lot change without comparison',
      'Examination',
      'Systematic bias in reported results',
      2,
      4,
      'Lot-to-lot comparison required by SOP BC-04',
      1,
      3,
    ],
    [
      'Unauthorised access to patient records',
      'Information',
      'Personal data breach',
      2,
      5,
      'Role-based access; access log reviewed monthly',
      1,
      4,
    ],
  ]
  risks.forEach(([title, process, hazard, l, s, controls, rl, rs], i) =>
    saveRisk(
      db,
      {
        title,
        process,
        hazard,
        likelihood: l,
        severity: s,
        controls,
        residualLikelihood: rl,
        residualSeverity: rs,
        ownerId: i % 2 ? PATHOLOGIST : MANAGER,
        reviewDueAt: now + (i * 25 - 20) * DAY,
        state: i === 4 ? 'treated' : 'open',
      },
      at(MANAGER, (200 - i * 10) * DAY),
    ),
  )

  // ---------- LIS verification: last run five months ago ----------
  try {
    const run = runLisVerification(
      db,
      { note: 'Half-yearly verification.' },
      at(BIOCHEM, 6 * DAY),
    )
    reviewLisVerification(db, run.id, at(MANAGER, 5 * DAY))
  } catch {
    // Fewer than ten released specimens in a very small seed: no run.
  }

  // ---------- Equipment qualification ----------
  for (const eq of Object.values(db.equipment)) {
    const installed = eq.lastCalibrationAt - 400 * DAY
    recordQualification(
      db,
      {
        equipmentId: eq.id,
        kind: 'iq',
        outcome: 'pass',
        reference: `IQ-${eq.serialNo}`,
        at: installed,
      },
      at(MANAGER, 0),
    )
    recordQualification(
      db,
      {
        equipmentId: eq.id,
        kind: 'oq',
        outcome: 'pass',
        reference: `OQ-${eq.serialNo}`,
        at: installed + 2 * DAY,
      },
      at(MANAGER, 0),
    )
    if (eq.testIds.length > 0)
      recordQualification(
        db,
        {
          equipmentId: eq.id,
          kind: 'pq',
          outcome: 'pass',
          reference: `PQ-${eq.serialNo}`,
          at: installed + 9 * DAY,
        },
        at(MANAGER, 0),
      )
  }

  // ---------- Cold storage, read twice a day for two weeks ----------
  const units: [
    string,
    'refrigerator' | 'freezer' | 'deep-freezer' | 'incubator' | 'room',
    string,
    DepartmentId | 'all',
    number,
    number,
    number,
  ][] = [
    [
      'Reagent refrigerator 1',
      'refrigerator',
      'Biochemistry',
      'biochemistry',
      2,
      8,
      4.6,
    ],
    [
      'Reagent refrigerator 2',
      'refrigerator',
      'Biochemistry',
      'biochemistry',
      2,
      8,
      5.1,
    ],
    [
      'Blood bank refrigerator',
      'refrigerator',
      'Haematology',
      'hematology',
      2,
      6,
      4.0,
    ],
    ['Serum freezer', 'freezer', 'Serology', 'serology', -25, -15, -20],
    ['Archive deep freezer', 'deep-freezer', 'Molecular', 'all', -86, -70, -78],
    [
      'Bacteriology incubator',
      'incubator',
      'Microbiology',
      'microbiology',
      35,
      37,
      36,
    ],
    ['Main laboratory', 'room', 'Main laboratory', 'all', 18, 26, 22.5],
  ]
  units.forEach(([name, kind, location, department, min, max, typical], u) => {
    const unit = saveColdUnit(
      db,
      { name, kind, location, department, min, max },
      ctxSetup,
    )
    for (let d = 14; d >= 0; d--)
      for (const hour of [8, 20]) {
        const when = startOfIstDay(now - d * DAY) + hour * HOUR
        if (when > now) continue
        const excursion = u === 1 && d === 3 && hour === 8
        const value = excursion
          ? 9.4
          : Math.round(rng.normal(typical, (max - min) / 12) * 10) / 10
        const clamped = excursion ? value : Math.min(max, Math.max(min, value))
        recordTemperature(
          db,
          unit.id,
          {
            value: clamped,
            ...(excursion
              ? {
                  action:
                    'Door closed; reagents checked against IQC before use; NC raised.',
                }
              : {}),
          },
          { now: when, by: rng.pick([HAEM, BIOCHEM, 'st_sneha']) },
        )
      }
  })

  // ---------- Privacy ----------
  const patients = Object.values(db.patients).filter((p) => !p.mergedInto)
  const p1 = patients[3]
  const p2 = patients[8]
  if (p1) {
    const r = logDataRequest(
      db,
      {
        kind: 'access',
        patientId: p1.id,
        requesterName: p1.name,
        contact: p1.mobile,
        details: 'Copy of all reports from the last two years.',
        receivedAt: now - 9 * DAY,
      },
      at(MANAGER, 9 * DAY),
    )
    advanceDataRequest(db, r.id, { to: 'verifying' }, at(MANAGER, 8 * DAY))
    advanceDataRequest(db, r.id, { to: 'in-progress' }, at(MANAGER, 7 * DAY))
    advanceDataRequest(
      db,
      r.id,
      {
        to: 'completed',
        response:
          'Reports shared through secure links, date of birth required.',
      },
      at(MANAGER, 6 * DAY),
    )
  }
  if (p2) {
    logDataRequest(
      db,
      {
        kind: 'correction',
        patientId: p2.id,
        requesterName: p2.name,
        contact: p2.mobile,
        details: 'Date of birth recorded incorrectly at registration.',
        receivedAt: now - 2 * DAY,
      },
      at(MANAGER, 2 * DAY),
    )
    const erasure = logDataRequest(
      db,
      {
        kind: 'erasure',
        patientId: p2.id,
        requesterName: p2.name,
        contact: p2.mobile,
        details: 'Asks for all personal data to be deleted.',
        receivedAt: now - 24 * DAY,
      },
      at(MANAGER, 24 * DAY),
    )
    advanceDataRequest(
      db,
      erasure.id,
      { to: 'verifying' },
      at(MANAGER, 23 * DAY),
    )
    placeHold(
      db,
      {
        entity: 'patient',
        entityId: p2.id,
        reason: 'Medico-legal case: records requested by the court.',
      },
      at(MANAGER, 20 * DAY),
    )
  }
  logDataRequest(
    db,
    {
      kind: 'grievance',
      requesterName: 'Selvi R',
      contact: '+91 94431 22870',
      details: 'Received an SMS meant for another patient.',
      receivedAt: now - 26 * DAY,
    },
    at(MANAGER, 26 * DAY),
  )
  const incident = logBreach(
    db,
    {
      title: 'Report SMS sent to a wrong number',
      description:
        'A mistyped mobile number sent one report-ready message (no results) to another person.',
      detectedAt: now - 26 * DAY,
      affectedCount: 1,
      dataKinds: 'Name, report number',
    },
    at(MANAGER, 26 * DAY),
  )
  updateBreach(
    db,
    incident.id,
    'contained',
    'Number corrected; the recipient confirmed deletion.',
    at(MANAGER, 26 * DAY - 2 * HOUR),
  )
  updateBreach(
    db,
    incident.id,
    'cert-in-reported',
    'Reported on the CERT-In incident form.',
    at(MANAGER, 26 * DAY - 4 * HOUR),
  )
  updateBreach(
    db,
    incident.id,
    'board-reported',
    'Details sent to the Data Protection Board.',
    at(MANAGER, 24 * DAY),
  )
  updateBreach(
    db,
    incident.id,
    'principals-notified',
    'Patient informed by phone and letter.',
    at(MANAGER, 25 * DAY),
  )
  updateBreach(
    db,
    incident.id,
    'closed',
    'Mobile numbers now confirmed by read-back at registration.',
    at(MANAGER, 20 * DAY),
  )

  // ---------- Interfaces: code maps and today's traffic ----------
  // Code maps set up when each analyser was installed (configuration, not
  // an edit, so no audit entry); later changes go through the engine.
  const interfaced = Object.values(db.equipment).filter(
    (e) => e.testIds.length > 0 && e.id !== 'eq_bx53' && e.id !== 'eq_cx23',
  )
  for (const eq of interfaced) {
    const analyteIds = [
      ...new Set(eq.testIds.flatMap((t) => db.tests[t]?.analyteIds ?? [])),
    ].filter((a) => db.analytes[a]?.resultType === 'numeric')
    analyteIds.forEach((analyteId, i) => {
      // One analyser has a code still unmapped (its messages fail).
      if (eq.id === 'eq_c311' && i === analyteIds.length - 1) return
      const id = `map_${eq.id}_${analyteId}`
      db.codeMappings[id] = {
        id,
        equipmentId: eq.id,
        instrumentCode: codeFor(analyteId),
        analyteId,
        version: 1,
        updatedAt: ctxSetup.now,
        updatedBy: MANAGER,
      }
    })
  }
  const log: InterfaceMessage[] = []
  const samples = Object.values(db.samples).filter(
    (s) =>
      s.equipmentId &&
      s.accessionNo &&
      (s.processingStartedAt ?? 0) > now - DAY,
  )
  for (const s of samples) {
    const eq = db.equipment[s.equipmentId!]
    if (!eq) continue
    const t = s.processingStartedAt!
    const protocol = eq.manufacturer.includes('Sysmex') ? 'HL7' : 'ASTM'
    log.push({
      id: `ifm_${s.id}_o`,
      equipmentId: eq.id,
      at: t - 2 * MINUTE,
      direction: 'out',
      kind: 'order',
      protocol,
      accessionNo: s.accessionNo!,
      state: 'processed',
      retries: 0,
      frame:
        protocol === 'HL7'
          ? `ORM^O01|${s.accessionNo}|`
          : `O|1|${s.accessionNo}||^^^ALL|R`,
    })
    log.push({
      id: `ifm_${s.id}_r`,
      equipmentId: eq.id,
      at: t + 18 * MINUTE,
      direction: 'in',
      kind: 'result',
      protocol,
      accessionNo: s.accessionNo!,
      state: 'processed',
      retries: 0,
      frame: protocol === 'HL7' ? `ORU^R01|${s.accessionNo}|F` : `R|1|^^^RES|F`,
    })
  }
  // A few failures to work through.
  const c311 = db.equipment.eq_c311
  if (c311) {
    const missing = [
      ...new Set(c311.testIds.flatMap((t) => db.tests[t]?.analyteIds ?? [])),
    ]
      .filter((a) => db.analytes[a]?.resultType === 'numeric')
      .at(-1)
    if (missing)
      log.push({
        id: 'ifm_err_map',
        equipmentId: c311.id,
        at: now - 40 * MINUTE,
        direction: 'in',
        kind: 'result',
        protocol: 'ASTM',
        accessionNo: samples[0]?.accessionNo ?? 'LAB-0000',
        instrumentCode: codeFor(missing),
        state: 'error',
        error: 'unmapped-code',
        retries: 0,
        frame: `R|3|^^^${codeFor(missing)}|`,
      })
  }
  log.push({
    id: 'ifm_err_acc',
    equipmentId: 'eq_xn1000',
    at: now - 25 * MINUTE,
    direction: 'in',
    kind: 'result',
    protocol: 'HL7',
    accessionNo: 'LAB-99999999-999',
    state: 'error',
    error: 'unknown-accession',
    retries: 1,
    frame: 'ORU^R01|LAB-99999999-999|F',
  })
  log.push({
    id: 'ifm_err_sum',
    equipmentId: 'eq_au480',
    at: now - 12 * MINUTE,
    direction: 'in',
    kind: 'result',
    protocol: 'ASTM',
    state: 'error',
    error: 'checksum',
    retries: 0,
    frame: 'R|1|^^^GLU|',
  })
  // The newest messages only: the monitor shows the recent traffic.
  db.interfaceLog = log
    .filter((m) => m.at <= now)
    .toSorted((a, b) => b.at - a.at)
    .slice(0, 80)

  // ---------- Auto-verification: an approved rule for the lipid profile ----------
  // The feature stays switched off until the lab turns it on.
  if (db.tests.lipid) {
    const rule = draftRule(
      db,
      {
        testId: 'lipid',
        checks: [
          'within-reference',
          'no-critical',
          'no-delta-failure',
          'qc-passed',
        ],
        note: 'Outpatient lipid profiles within reference and without delta failure.',
      },
      at(PATHOLOGIST_2, 30 * DAY),
    )
    approveRule(db, rule.id, at(PATHOLOGIST, 29 * DAY))
  }
  if (db.tests.cbc)
    draftRule(
      db,
      {
        testId: 'cbc',
        checks: [
          'within-reference',
          'no-critical',
          'no-instrument-flag',
          'qc-passed',
        ],
      },
      at(PATHOLOGIST, 3 * DAY),
    )
}

/** The instrument's own short code for an analyte (synthetic). */
function codeFor(analyteId: string) {
  return analyteId
    .replace(/[^a-z0-9]/gi, '')
    .toUpperCase()
    .slice(0, 8)
}
