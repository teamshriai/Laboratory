// Second seeding pass: operational detail layered on top of the replayed lab
// (suppliers, storage, SKUs, maintenance plans, calibration records, QC control
// lots and failure events, bench assignment and catalog metadata).

import { DAY, HOUR, MINUTE } from '@/domain/time'
import type {
  Consumable,
  ControlLot,
  DepartmentId,
  LabTest,
  QcEvent,
  SpecimenId,
  Staff,
  StorageCondition,
  StorageLocation,
  Supplier,
} from '@/domain/types'
import type { LabDb } from '../schema'
import type { Rng } from './random'

export const EXTRA_TECHNICIANS: Staff[] = [
  {
    id: 'st_karthik',
    name: 'Karthik Subramanian',
    role: 'technician',
    department: 'hematology',
    qualification: 'B.Sc MLT',
  },
  {
    id: 'st_deepa',
    name: 'Deepa Menon',
    role: 'technician',
    department: 'biochemistry',
    qualification: 'M.Sc MLT',
  },
  {
    id: 'st_priya',
    name: 'Priya Nair',
    role: 'technician',
    department: 'biochemistry',
    qualification: 'B.Sc MLT',
  },
]

const SUPPLIERS: Supplier[] = [
  {
    id: 'sup_roche',
    name: 'Roche Diagnostics India Pvt Ltd',
    city: 'Mumbai',
    phone: '+91 22 6112 4000',
    leadDays: 5,
  },
  {
    id: 'sup_sysmex',
    name: 'Sysmex India Pvt Ltd',
    city: 'Bengaluru',
    phone: '+91 80 4110 7700',
    leadDays: 3,
  },
  {
    id: 'sup_transasia',
    name: 'Transasia Bio-Medicals Ltd',
    city: 'Mumbai',
    phone: '+91 22 4030 9000',
    leadDays: 4,
  },
  {
    id: 'sup_bd',
    name: 'BD India Pvt Ltd',
    city: 'Gurugram',
    phone: '+91 124 494 9000',
    leadDays: 6,
  },
  {
    id: 'sup_biomerieux',
    name: 'bioMérieux India Pvt Ltd',
    city: 'New Delhi',
    phone: '+91 11 4260 9800',
    leadDays: 7,
  },
  {
    id: 'sup_himedia',
    name: 'HiMedia Laboratories Pvt Ltd',
    city: 'Thane',
    phone: '+91 22 6147 1919',
    leadDays: 4,
  },
  {
    id: 'sup_bangalore_surgicals',
    name: 'Sri Venkateshwara Surgicals',
    city: 'Bengaluru',
    phone: '+91 80 2670 3311',
    leadDays: 1,
  },
]

const MANUFACTURER_SUPPLIER: Record<string, string> = {
  Roche: 'sup_roche',
  Sysmex: 'sup_sysmex',
  Stago: 'sup_transasia',
  'Bio-Rad': 'sup_transasia',
  BD: 'sup_bd',
  bioMérieux: 'sup_biomerieux',
  HiMedia: 'sup_himedia',
  DIESSE: 'sup_transasia',
  'J. Mitra': 'sup_transasia',
  Merck: 'sup_himedia',
  Leica: 'sup_transasia',
}

const LOCATIONS: StorageLocation[] = [
  { id: 'loc_store_a', name: 'Main store A', kind: 'store' },
  { id: 'loc_store_b', name: 'Main store B', kind: 'store' },
  { id: 'loc_cold_room', name: 'Walk-in cold room (2-8 °C)', kind: 'fridge' },
  { id: 'loc_freezer', name: 'Deep freezer (-20 °C)', kind: 'freezer' },
  {
    id: 'loc_hem_fridge',
    name: 'Hematology reagent fridge',
    kind: 'fridge',
    department: 'hematology',
  },
  {
    id: 'loc_bio_fridge',
    name: 'Biochemistry fridge 2',
    kind: 'fridge',
    department: 'biochemistry',
  },
  {
    id: 'loc_imm_fridge',
    name: 'Immunoassay fridge',
    kind: 'fridge',
    department: 'immunology',
  },
  {
    id: 'loc_micro_cold',
    name: 'Microbiology cold room',
    kind: 'fridge',
    department: 'microbiology',
  },
  {
    id: 'loc_hem_bench',
    name: 'Hematology bench',
    kind: 'bench',
    department: 'hematology',
  },
  {
    id: 'loc_bio_bench',
    name: 'Biochemistry bay',
    kind: 'bench',
    department: 'biochemistry',
  },
  {
    id: 'loc_cp_bench',
    name: 'Clinical pathology bench',
    kind: 'bench',
    department: 'clinical-pathology',
  },
  {
    id: 'loc_micro_bench',
    name: 'Microbiology lab',
    kind: 'bench',
    department: 'microbiology',
  },
  {
    id: 'loc_histo',
    name: 'Histopathology lab',
    kind: 'bench',
    department: 'histopathology',
  },
  { id: 'loc_reception', name: 'Sample reception', kind: 'bench' },
]

const FRIDGE_BY_DEPT: Partial<Record<DepartmentId, string>> = {
  hematology: 'loc_hem_fridge',
  biochemistry: 'loc_bio_fridge',
  immunology: 'loc_imm_fridge',
  serology: 'loc_imm_fridge',
  microbiology: 'loc_micro_cold',
}

const BENCH_BY_DEPT: Partial<Record<DepartmentId, string>> = {
  hematology: 'loc_hem_bench',
  biochemistry: 'loc_bio_bench',
  'clinical-pathology': 'loc_cp_bench',
  microbiology: 'loc_micro_bench',
  histopathology: 'loc_histo',
  cytology: 'loc_histo',
  immunology: 'loc_imm_fridge',
  serology: 'loc_imm_fridge',
}

function locationFor(storage: StorageCondition, dept: DepartmentId) {
  if (storage === 'frozen') return 'loc_freezer'
  if (storage === 'room-temperature')
    return BENCH_BY_DEPT[dept] ?? 'loc_store_a'
  return FRIDGE_BY_DEPT[dept] ?? 'loc_cold_room'
}

const LEGACY_LOCATIONS: Record<string, string> = {
  'Store A, Rack 1': 'loc_store_a',
  'Store A, Rack 2': 'loc_store_a',
  'Store B, Rack 1': 'loc_store_b',
  'Store B, Rack 3': 'loc_store_b',
  'Sample reception': 'loc_reception',
  'Microbiology cold room': 'loc_micro_cold',
  'Microbiology lab': 'loc_micro_bench',
  'Clinical pathology': 'loc_cp_bench',
  Histopathology: 'loc_histo',
  'Biochemistry bay': 'loc_bio_bench',
  'Hematology bench 1': 'loc_hem_bench',
  'Hematology bench 2': 'loc_hem_bench',
}

const EXTRA_CONSUMABLES: (Omit<Consumable, 'transactions'> & {
  expiresInDays?: number
})[] = [
  {
    id: 'cs_n95',
    name: 'N95 Respirator Masks',
    category: 'ppe',
    unit: 'pcs',
    quantity: 180,
    reorderLevel: 150,
    location: 'Main store B',
    locationId: 'loc_store_b',
    dailyUsage: 24,
    expiresInDays: 420,
  },
  {
    id: 'cs_gown',
    name: 'Disposable Isolation Gowns (non-woven)',
    category: 'ppe',
    unit: 'pcs',
    quantity: 62,
    reorderLevel: 80,
    location: 'Main store B',
    locationId: 'loc_store_b',
    dailyUsage: 14,
  },
  {
    id: 'cs_shield',
    name: 'Face Shields (reusable)',
    category: 'ppe',
    unit: 'pcs',
    quantity: 36,
    reorderLevel: 20,
    location: 'Microbiology lab',
    locationId: 'loc_micro_bench',
    dailyUsage: 1,
  },
  {
    id: 'cs_swab',
    name: 'Alcohol Swabs 70% IPA',
    category: 'collection',
    unit: 'pcs',
    quantity: 1450,
    reorderLevel: 800,
    location: 'Sample reception',
    locationId: 'loc_reception',
    dailyUsage: 230,
    expiresInDays: 300,
  },
  {
    id: 'cs_tourniquet',
    name: 'Tourniquet (latex-free, single use)',
    category: 'collection',
    unit: 'pcs',
    quantity: 90,
    reorderLevel: 150,
    location: 'Sample reception',
    locationId: 'loc_reception',
    dailyUsage: 40,
  },
  {
    id: 'cs_sharps',
    name: 'Sharps Container 5 L',
    category: 'collection',
    unit: 'pcs',
    quantity: 14,
    reorderLevel: 10,
    location: 'Main store A',
    locationId: 'loc_store_a',
    dailyUsage: 2,
  },
  {
    id: 'cs_cotton',
    name: 'Absorbent Cotton Balls',
    category: 'collection',
    unit: 'packs',
    quantity: 22,
    reorderLevel: 12,
    location: 'Sample reception',
    locationId: 'loc_reception',
    dailyUsage: 2,
  },
]

const SERVICE_PROVIDER: Record<string, string> = {
  Sysmex: 'Sysmex India Service, Bengaluru',
  Roche: 'Roche Diagnostics Service, Bengaluru',
  Stago: 'Transasia Service Engineering',
  'Bio-Rad': 'Transasia Service Engineering',
  bioMérieux: 'bioMérieux Field Service',
  BD: 'BD India Technical Service',
  'Beckman Coulter': 'Beckman Coulter India Service',
  'Thermo Fisher': 'Thermo Fisher Scientific Service',
  Mindray: 'Mindray Medical India Service',
}

/** Control material manufacturer per analyzer vendor. */
const CONTROL_MAKER: Record<string, string> = {
  Sysmex: 'Sysmex',
  Stago: 'Stago',
}

const CATEGORY: Record<DepartmentId, string> = {
  hematology: 'Haematology',
  biochemistry: 'Clinical chemistry',
  'clinical-pathology': 'Clinical pathology',
  microbiology: 'Culture and microscopy',
  immunology: 'Immunoassay',
  serology: 'Infectious serology',
  histopathology: 'Surgical pathology',
  cytology: 'Cytopathology',
}

const CATEGORY_BY_TEST: Record<string, string> = {
  pt_inr: 'Coagulation',
  aptt: 'Coagulation',
  ddimer: 'Coagulation',
  bg: 'Blood bank',
  fbs: 'Diabetes',
  ppbs: 'Diabetes',
  rbs: 'Diabetes',
  hba1c: 'Diabetes',
  trop: 'Cardiac markers',
  vitd: 'Vitamins',
  b12: 'Vitamins',
  thyroid: 'Endocrinology',
  tsh_test: 'Endocrinology',
  ft3_test: 'Endocrinology',
  ft4_test: 'Endocrinology',
  psa: 'Tumour markers',
  crp: 'Inflammation',
  rf: 'Autoimmunity',
  ana: 'Autoimmunity',
  accp: 'Autoimmunity',
}

const DESCRIPTION: Record<string, string> = {
  cbc: 'Automated blood count with five-part differential; screens for anaemia, infection and platelet disorders.',
  esr: 'Westergren sedimentation rate; non-specific marker of inflammation.',
  ps: 'Manual review of a stained blood film for cell morphology and parasites.',
  plt_count: 'Platelet count, repeated on citrate if clumping is suspected.',
  hb_test:
    'Haemoglobin concentration for anaemia screening and transfusion decisions.',
  retic: 'Reticulocyte count to assess marrow response in anaemia.',
  pt_inr:
    'Extrinsic pathway clotting time; INR used to monitor warfarin therapy.',
  aptt: 'Intrinsic pathway clotting time; monitors unfractionated heparin.',
  bg: 'ABO grouping and Rh(D) typing by forward and reverse grouping.',
  ddimer: 'Fibrin degradation product; helps exclude venous thromboembolism.',
  fbs: 'Plasma glucose after an 8 to 10 hour fast.',
  ppbs: 'Plasma glucose two hours after a standard meal.',
  rbs: 'Plasma glucose at any time of day, for screening and emergencies.',
  hba1c: 'Average glycaemia over the previous 8 to 12 weeks by HPLC.',
  lft: 'Bilirubin, liver enzymes and proteins to assess hepatic function.',
  kft: 'Urea, creatinine, uric acid and electrolytes to assess renal function.',
  lipid:
    'Total cholesterol, triglycerides, HDL, LDL and VLDL for cardiovascular risk.',
  electrolytes: 'Sodium, potassium and chloride by ion-selective electrode.',
  calcium: 'Total serum calcium; interpret with albumin.',
  vitd: 'Total 25-hydroxy vitamin D by electrochemiluminescence.',
  b12: 'Serum cobalamin for macrocytic anaemia and neuropathy work-up.',
  ferritin: 'Iron stores; also an acute-phase reactant.',
  trop: 'High-sensitivity cardiac troponin I for suspected myocardial infarction.',
  urine_re: 'Physical, chemical (strip) and microscopic examination of urine.',
  stool_re:
    'Macroscopic and microscopic stool examination for ova, cysts and occult blood.',
  upt: 'Qualitative urine hCG card test.',
  bf: 'Cell count, biochemistry and microscopy of pleural, ascitic or CSF samples.',
  blood_cs:
    'Automated blood culture with identification and antibiotic susceptibility.',
  urine_cs:
    'Semi-quantitative urine culture with identification and susceptibility.',
  gram: 'Gram-stained smear for rapid presumptive identification.',
  afb: 'Ziehl-Neelsen stain of sputum for acid-fast bacilli.',
  thyroid: 'Free T3, free T4 and TSH for thyroid function.',
  tsh_test: 'Thyroid stimulating hormone; first-line thyroid screen.',
  ft3_test: 'Free triiodothyronine.',
  ft4_test: 'Free thyroxine.',
  crp: 'Quantitative C-reactive protein by immunoturbidimetry.',
  rf: 'Rheumatoid factor by latex turbidimetry.',
  ana: 'Antinuclear antibodies by indirect immunofluorescence on HEp-2 cells.',
  accp: 'Anti-cyclic citrullinated peptide antibody for rheumatoid arthritis.',
  psa: 'Total prostate specific antigen.',
  hiv: 'Fourth-generation HIV 1 and 2 antibody and p24 antigen screen; reactive samples need confirmation.',
  hbsag: 'Hepatitis B surface antigen screen.',
  hcv: 'Antibody to hepatitis C virus.',
  dengue_ns1:
    'Dengue NS1 antigen ELISA, most useful in the first five days of fever.',
  dengue_ab:
    'Dengue IgM and IgG antibodies to identify recent or past infection.',
  widal: 'Slide agglutination for Salmonella antibodies.',
  vdrl: 'Non-treponemal screening test for syphilis.',
  malaria: 'Rapid antigen test for Plasmodium falciparum and vivax.',
  biopsy_small: 'Processing and reporting of endoscopic and needle biopsies.',
  biopsy_large: 'Grossing, processing and reporting of resection specimens.',
  fnac: 'Fine needle aspiration smears from palpable or image-guided lesions.',
  pap: 'Conventional cervical smear reported in the Bethesda system.',
  bf_cyto:
    'Cytology of pleural, peritoneal and other body fluids for malignant cells.',
}

const SPECIMEN_HANDLING: Partial<
  Record<SpecimenId, { stabilityHours: number; storage: StorageCondition }>
> = {
  'whole-blood': { stabilityHours: 24, storage: 'refrigerated' },
  serum: { stabilityHours: 72, storage: 'refrigerated' },
  'citrated-plasma': { stabilityHours: 4, storage: 'room-temperature' },
  'fluoride-plasma': { stabilityHours: 24, storage: 'refrigerated' },
  'heparin-plasma': { stabilityHours: 8, storage: 'refrigerated' },
  urine: { stabilityHours: 2, storage: 'refrigerated' },
  stool: { stabilityHours: 2, storage: 'room-temperature' },
  blood: { stabilityHours: 12, storage: 'room-temperature' },
  tissue: { stabilityHours: 72, storage: 'room-temperature' },
}

function enrichTest(t: LabTest) {
  const handling = SPECIMEN_HANDLING[t.specimen] ?? {
    stabilityHours: 24,
    storage: 'room-temperature' as const,
  }
  t.category ??= CATEGORY_BY_TEST[t.id] ?? CATEGORY[t.department]
  const description = DESCRIPTION[t.id]
  if (description) t.description ??= description
  t.stabilityHours ??= handling.stabilityHours
  t.storage ??= handling.storage
  if (t.volumeMl)
    t.minVolumeMl ??= Math.max(0.5, Math.round(t.volumeMl * 5) / 10)
  t.priceInsurance ??= Math.round((t.price * 1.15) / 10) * 10
}

export function enrichDatabase(db: LabDb, now: number, rng: Rng) {
  for (const s of SUPPLIERS) db.suppliers[s.id] = { ...s }
  for (const l of LOCATIONS) db.locations[l.id] = { ...l }
  for (const t of Object.values(db.tests)) enrichTest(t)

  // ---------- Reagents and lots ----------
  const reagents = Object.values(db.reagents).toSorted((a, b) =>
    a.id.localeCompare(b.id),
  )
  reagents.forEach((r, i) => {
    r.sku ??= `RG-${r.department.slice(0, 3).toUpperCase()}-${String(1001 + i)}`
    r.supplierId ??= MANUFACTURER_SUPPLIER[r.manufacturer] ?? 'sup_transasia'
  })
  for (const lot of Object.values(db.lots)) {
    const reagent = db.reagents[lot.reagentId]
    if (!reagent) continue
    lot.supplierId ??= reagent.supplierId
    lot.locationId ??= locationFor(reagent.storage, reagent.department)
    const consumed = lot.transactions
      .filter((t) => t.type === 'consume')
      .map((t) => t.at)
    if (consumed.length)
      lot.openedAt ??= Math.max(lot.receivedAt, Math.min(...consumed))
  }

  // Deliveries this week, still awaiting lot QC.
  const deliveries: [string, string, number, number, number][] = [
    ['rg_glu', 'GLU-2610-118', 2, 600, 160],
    ['rg_tsh', '67982204', 1, 200, 120],
    ['rg_wdf', 'WDF-A2611', 4, 3, 150],
  ]
  for (const [
    reagentId,
    lotNumber,
    daysAgo,
    quantity,
    shelfDays,
  ] of deliveries) {
    const reagent = db.reagents[reagentId]
    if (!reagent) continue
    const at = now - daysAgo * DAY - 3 * HOUR
    const id = `lot_${reagentId}_new`
    db.lots[id] = {
      id,
      reagentId,
      lotNumber,
      receivedAt: at,
      expiresAt: now + shelfDays * DAY,
      quantity,
      initialQuantity: quantity,
      qcStatus: daysAgo > 2 ? 'passed' : 'pending',
      state: 'active',
      locationId: locationFor(reagent.storage, reagent.department),
      ...(reagent.supplierId ? { supplierId: reagent.supplierId } : {}),
      transactions: [
        {
          id: `${id}_rcv`,
          at,
          by: 'st_ganesh',
          type: 'receive',
          quantity,
          balance: quantity,
          note: `Invoice INV/${2400 + daysAgo * 37}`,
        },
      ],
    }
  }

  // ---------- Consumables ----------
  for (const c of EXTRA_CONSUMABLES) {
    const { expiresInDays, ...rest } = c
    db.consumables[c.id] = {
      ...rest,
      ...(expiresInDays !== undefined
        ? { expiresAt: now + expiresInDays * DAY }
        : {}),
      transactions: [
        {
          id: `${c.id}_use`,
          at: now - 2 * HOUR,
          by: 'st_shruthi',
          type: 'consume',
          quantity: -c.dailyUsage * 5,
          balance: c.quantity,
          note: 'Issued to collection and benches.',
        },
        {
          id: `${c.id}_rcv`,
          at: now - 9 * DAY,
          by: 'st_ganesh',
          type: 'receive',
          quantity: c.quantity + c.dailyUsage * 5,
          balance: c.quantity + c.dailyUsage * 5,
          note: 'Monthly indent received.',
        },
      ],
    }
  }
  Object.values(db.consumables)
    .toSorted((a, b) => a.id.localeCompare(b.id))
    .forEach((c, i) => {
      c.sku ??= `CS-${c.category.slice(0, 3).toUpperCase()}-${String(2001 + i)}`
      c.locationId ??= LEGACY_LOCATIONS[c.location] ?? 'loc_store_a'
      c.location = db.locations[c.locationId]?.name ?? c.location
      c.supplierId ??=
        c.category === 'tubes' || c.category === 'syringes'
          ? 'sup_bd'
          : c.category === 'culture-media'
            ? 'sup_himedia'
            : 'sup_bangalore_surgicals'
    })

  // ---------- Equipment ----------
  for (const eq of Object.values(db.equipment)) {
    eq.serviceProvider ??=
      SERVICE_PROVIDER[eq.manufacturer] ?? 'In-house biomedical engineering'
    const provider = eq.serviceProvider
    eq.maintenancePlan ??= [
      {
        id: `mnt_${eq.id}_done`,
        kind: 'preventive',
        dueAt: eq.lastMaintenanceAt,
        title: 'Monthly preventive maintenance',
        assignee: provider,
        status: 'done',
        completedAt: eq.lastMaintenanceAt,
      },
      {
        id: `mnt_${eq.id}_next`,
        kind: 'preventive',
        dueAt: eq.nextMaintenanceAt,
        title: 'Monthly preventive maintenance',
        assignee: provider,
        status: 'scheduled',
      },
      ...(eq.status === 'out-of-service' || eq.status === 'maintenance'
        ? [
            {
              id: `mnt_${eq.id}_fix`,
              kind: 'corrective' as const,
              dueAt: now + 6 * HOUR,
              title:
                eq.status === 'out-of-service'
                  ? 'Vendor visit: electrode module replacement'
                  : 'Scheduled service: probe and tubing replacement',
              assignee: provider,
              status: 'scheduled' as const,
            },
          ]
        : []),
    ]
    for (const entry of eq.log)
      if (entry.type === 'maintenance') {
        entry.performedBy ??= provider
        entry.downtimeMin ??= 45 + rng.int(0, 3) * 15
      }
    const year = new Date(eq.lastCalibrationAt).getUTCFullYear()
    const serial = eq.serialNo.slice(-4)
    eq.calibrations ??= [
      {
        id: `cal_${eq.id}_1`,
        at: eq.lastCalibrationAt,
        by: 'st_ganesh',
        result: 'pass',
        certificateNo: `CAL/${year}/${serial}-2`,
        nextDueAt: eq.calibrationDueAt,
        remarks: 'Two-point calibration with manufacturer calibrators.',
      },
      {
        id: `cal_${eq.id}_0`,
        at: eq.lastCalibrationAt - 90 * DAY,
        by: 'st_ganesh',
        result: 'pass',
        certificateNo: `CAL/${year}/${serial}-1`,
        nextDueAt: eq.lastCalibrationAt,
      },
    ]
  }

  // ---------- QC control lots and failure events ----------
  const series = new Map<string, ControlLot>()
  for (const run of Object.values(db.qcRuns).toSorted((a, b) => b.at - a.at)) {
    const key = `${run.equipmentId}|${run.analyteId}|${run.level}`
    if (series.has(key)) continue
    const maker =
      CONTROL_MAKER[db.equipment[run.equipmentId]?.manufacturer ?? ''] ??
      'Bio-Rad'
    series.set(key, {
      id: `ctl_${run.equipmentId}_${run.analyteId}_${run.level}`,
      equipmentId: run.equipmentId,
      lotNumber: run.controlLot,
      manufacturer: maker,
      analyteId: run.analyteId,
      level: run.level,
      mean: run.mean,
      sd: run.sd,
      expiresAt: now + (45 + rng.int(0, 120)) * DAY,
    })
  }
  for (const c of series.values()) db.controlLots[c.id] = c

  const byTime = Object.values(db.qcRuns).toSorted((a, b) => a.at - b.at)
  for (const run of byTime) {
    if (run.result !== 'fail') continue
    const repeat = byTime.find(
      (r) =>
        r.at > run.at &&
        r.equipmentId === run.equipmentId &&
        r.analyteId === run.analyteId &&
        r.level === run.level &&
        r.result !== 'fail',
    )
    const by = run.by
    const event: QcEvent = {
      id: `qce_${run.id}`,
      runId: run.id,
      equipmentId: run.equipmentId,
      analyteId: run.analyteId,
      level: run.level,
      openedAt: run.at,
      status: repeat ? 'resolved' : 'corrective',
      issue: 'Drift on electrode; reference electrode fill solution low.',
      action:
        'Electrode cleaned, fill solution replaced and analyzer recalibrated. Vendor engineer requested for module check.',
      steps: [
        {
          id: `${run.id}_s0`,
          status: 'open',
          at: run.at,
          by,
          note: run.rule ?? '',
        },
        {
          id: `${run.id}_s1`,
          status: 'investigating',
          at: run.at + 25 * MINUTE,
          by,
          note: 'Drift on electrode; reference electrode fill solution low.',
        },
        {
          id: `${run.id}_s2`,
          status: 'corrective',
          at: run.at + 70 * MINUTE,
          by,
          note: 'Electrode cleaned, fill solution replaced and analyzer recalibrated. Vendor engineer requested for module check.',
        },
      ],
    }
    if (repeat) {
      event.steps.push(
        {
          id: `${run.id}_s3`,
          status: 'repeat-pending',
          at: repeat.at - 10 * MINUTE,
          by,
          note: 'Repeat QC requested on fresh control vial.',
        },
        {
          id: `${run.id}_s4`,
          status: 'resolved',
          at: repeat.at,
          by: repeat.by,
          note: '',
        },
      )
      event.resolvedByRunId = repeat.id
      event.resolvedAt = repeat.at
    }
    db.qcEvents[event.id] = event
  }

  // ---------- Bench assignment ----------
  for (const t of EXTRA_TECHNICIANS) db.staff[t.id] = { ...t }
  const benchStaff = new Map<DepartmentId, string[]>()
  for (const s of Object.values(db.staff))
    if (s.role === 'technician' && s.department)
      benchStaff.set(s.department, [
        ...(benchStaff.get(s.department) ?? []),
        s.id,
      ])
  const benchStates = new Set([
    'received',
    'processing',
    'on_hold',
    'completed',
  ])
  for (const s of Object.values(db.samples).toSorted((a, b) =>
    a.id.localeCompare(b.id),
  )) {
    if (!benchStates.has(s.status) || s.assignedTo) continue
    const pool = benchStaff.get(s.department)
    if (!pool?.length) continue
    s.assignedTo =
      s.processingBy && pool.includes(s.processingBy)
        ? s.processingBy
        : rng.pick(pool)
  }
}
