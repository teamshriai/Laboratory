// Demo network: doctor details and two outside referrers, collection
// centres, today's home collection visits (through the engine) and message
// templates. All names, numbers and addresses are fictional.

import { HOUR, MINUTE, startOfIstDay } from '@/domain/time'
import type { LabDb } from '../schema'
import type { EngineCtx } from '../../engine/core'
import { saveTemplate } from '../../engine/messaging'
import {
  assignHomeVisit,
  bookHomeVisit,
  saveCentre,
  saveDoctor,
  updateHomeVisit,
} from '../../engine/network'
import { setMessagingOptOut } from '../../engine/messaging'
import { shareReport } from '../../engine/reports'
import { isReportReleased } from '@/domain/workflow'

const MANAGER = 'st_ganesh'
const DESK = 'st_shruthi'

export function seedNetwork(db: LabDb, now: number) {
  const setup: EngineCtx = { now: now - 20 * 24 * HOUR, by: MANAGER }
  // Registration numbers and specialties for the hospital's doctors.
  let n = 40211
  for (const d of Object.values(db.doctors)) {
    d.registrationNo ??= `KMC ${n++}`
    d.specialty ??= d.qualification.replace(/^MD |^MS |^DM /, '')
  }
  saveDoctor(
    db,
    {
      name: 'Dr. Lakshmi Narayanan',
      department: 'general-medicine',
      qualification: 'MBBS, DNB Family Medicine',
      phone: '+91 94430 51870',
      specialty: 'Family medicine',
      registrationNo: 'TNMC 88124',
      external: true,
      clinic: 'Narayanan Family Clinic, Tiruppur',
    },
    setup,
  )
  saveDoctor(
    db,
    {
      name: 'Dr. Arvind Chandran',
      department: 'general-medicine',
      qualification: 'MD, Diabetology',
      phone: '+91 98940 22015',
      specialty: 'Diabetology',
      registrationNo: 'TNMC 79302',
      external: true,
      clinic: 'Chandran Diabetes Care, Salem',
    },
    setup,
  )

  const hosur = Object.values(db.accounts).find(
    (a) => a.kind === 'collection-centre',
  )
  saveCentre(
    db,
    {
      code: 'CC-HSR',
      name: 'HSR Layout Collection Centre',
      kind: 'own',
      address: '14, 27th Main, Sector 2, HSR Layout',
      city: 'Bengaluru',
      pinCode: '560102',
      phone: '+91 80 4123 7781',
      licenceNo: 'KA-BLR-CE-2021-1188',
      inchargeName: 'Rekha Prasad',
      inchargeQualification: 'DMLT',
      hours: '06:30-20:00, Monday to Saturday',
      transitMin: 45,
      coldChain: true,
      active: true,
    },
    setup,
  )
  saveCentre(
    db,
    {
      code: 'CC-HOS',
      name: 'Arogya Collection Point, Hosur',
      kind: 'franchise',
      address: '5, Bagalur Road, near Ramnagar bus stop',
      city: 'Hosur',
      pinCode: '635109',
      phone: '+91 4344 220 118',
      licenceNo: 'TN-KGI-CE-2022-0347',
      inchargeName: 'Murugan S',
      inchargeQualification: 'BSc MLT',
      hours: '07:00-14:00, Monday to Saturday',
      transitMin: 90,
      coldChain: true,
      ...(hosur ? { accountId: hosur.id } : {}),
      active: true,
    },
    setup,
  )
  saveCentre(
    db,
    {
      code: 'CC-MYS',
      name: 'Sri Ranga Nursing Home, Mysuru',
      kind: 'hospital',
      address: '112, Vani Vilas Road, Chamarajapuram',
      city: 'Mysuru',
      pinCode: '570004',
      phone: '+91 821 242 9910',
      inchargeName: 'Sister Philomena D',
      hours: '24 hours',
      transitMin: 180,
      coldChain: false,
      active: true,
    },
    setup,
  )

  // Today's home visits, booked yesterday evening and worked through today.
  const morning = startOfIstDay(now)
  const booked: EngineCtx = { now: morning - 3 * HOUR, by: DESK }
  const patients = Object.values(db.patients)
    .filter((p) => !p.mergedInto)
    .slice(0, 7)
  const slots = [7, 8, 10, 12, 15, 17, 18]
  const visits = patients.map((p, i) =>
    bookHomeVisit(
      db,
      {
        patientId: p.id,
        address: `${12 + i * 7}, ${['1st Cross', 'Temple Street', 'Lake View Road', '4th Main', 'Gandhi Nagar', 'Church Road', 'Station Road'][i]}, Bengaluru`,
        pinCode: [
          '560034',
          '560041',
          '560076',
          '560095',
          '560068',
          '560025',
          '560010',
        ][i]!,
        slotStart: morning + slots[i]! * HOUR,
        notes:
          i === 0
            ? 'Elderly, first floor without lift; fasting sample.'
            : undefined,
      },
      booked,
    ),
  )
  const phlebotomists = ['st_kavya', 'st_ravi']
  visits.forEach((v, i) => {
    if (i === 6) return // one still waiting to be assigned
    assignHomeVisit(db, v.id, phlebotomists[i % 2]!, {
      now: morning - 2 * HOUR,
      by: MANAGER,
    })
  })
  const step = (
    i: number,
    state: 'en-route' | 'collected' | 'missed',
    at: number,
    extra = {},
  ) => {
    const v = visits[i]
    if (!v || at > now) return
    updateHomeVisit(
      db,
      v.id,
      { state, ...extra },
      { now: at, by: v.phlebotomistId! },
    )
  }
  for (const i of [0, 1]) {
    const start = morning + slots[i]! * HOUR
    step(i, 'en-route', start - 20 * MINUTE)
    step(i, 'collected', start + 15 * MINUTE, {
      proof: {
        coldChain: true,
        receivedBy: i === 0 ? 'Self (patient)' : 'Ramya, daughter',
      },
    })
  }
  step(2, 'en-route', morning + slots[2]! * HOUR - 25 * MINUTE)
  if (visits[5] && now > morning + 6 * HOUR)
    updateHomeVisit(
      db,
      visits[5].id,
      { state: 'cancelled', reason: 'Patient travelling; rebook next week' },
      { now: morning + 6 * HOUR, by: DESK },
    )

  // Message templates (SMS needs a DLT-registered template id in India).
  const tpl = (
    event: Parameters<typeof saveTemplate>[1]['event'],
    channel: Parameters<typeof saveTemplate>[1]['channel'],
    language: Parameters<typeof saveTemplate>[1]['language'],
    body: string,
    dlt?: string,
  ) =>
    saveTemplate(
      db,
      {
        event,
        channel,
        language,
        body,
        active: true,
        ...(dlt ? { dltTemplateId: dlt } : {}),
      },
      setup,
    )
  tpl(
    'report-ready',
    'sms',
    'en',
    'Dear {name}, your report {report} from {lab} is ready. Collect it at the lab or ask for a secure link.',
    '1107172000000012345',
  )
  tpl(
    'report-ready',
    'whatsapp',
    'en',
    'Hello {name}, your laboratory report {report} from {lab} is ready. Reply LINK for a secure link (your date of birth is needed to open it).',
  )
  tpl(
    'report-ready',
    'whatsapp',
    'ta',
    'வணக்கம் {name}, {lab} ஆய்வகத்தின் உங்கள் அறிக்கை {report} தயாராக உள்ளது. பாதுகாப்பான இணைப்புக்கு LINK என்று பதிலளிக்கவும்.',
  )
  tpl(
    'report-ready',
    'whatsapp',
    'hi',
    'नमस्ते {name}, {lab} की आपकी रिपोर्ट {report} तैयार है। सुरक्षित लिंक के लिए LINK लिखकर भेजें।',
  )
  tpl(
    'report-ready',
    'email',
    'en',
    'Dear {name},\n\nYour report {report} is ready at {lab}. For your privacy we do not attach reports; ask the laboratory for a secure link.\n\n{lab}',
  )
  tpl(
    'home-visit-booked',
    'sms',
    'en',
    'Dear {name}, your home sample collection is booked for {slot}. Visit no. {visit}. {lab}',
    '1107172000000012399',
  )
  tpl(
    'payment-receipt',
    'whatsapp',
    'en',
    'Thank you {name}. We received INR {amount} for invoice {invoice}. {lab}',
  )

  // A few reports sent to patients today: recorded in the outbox, never
  // sent (no gateway). One patient asked not to get WhatsApp messages.
  const released = Object.values(db.reports)
    .filter((r) => isReportReleased(r) && !r.withdrawn)
    .map((r) => ({ r, at: (r.versions.at(-1)?.releasedAt ?? 0) + 20 * MINUTE }))
    .filter(({ at }) => at <= now && at > now - 2 * 24 * HOUR)
    .toSorted((a, b) => a.at - b.at)
    .slice(-6)
  released.forEach(({ r, at }, i) => {
    const patient = db.patients[r.patientId]
    if (!patient) return
    if (i === 2)
      setMessagingOptOut(db, patient.id, 'whatsapp', true, {
        now: at - 5 * MINUTE,
        by: DESK,
      })
    const channel = i % 3 === 1 ? 'sms' : 'whatsapp'
    shareReport(
      db,
      r.id,
      { channel, recipient: patient.mobile },
      { now: at, by: DESK },
    )
  })
}
