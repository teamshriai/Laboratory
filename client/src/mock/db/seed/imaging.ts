// Diagnostic imaging demo data: six reported studies (two each of CT, MRI
// and X-ray) and a few still to be acquired or reported. Every patient is a
// fictional demo patient and every report is written for this demo; nothing
// is copied from real reports.

import { MINUTE, istDayCompact } from '@/domain/time'
import type {
  ImagingReportVersion,
  ImagingStudy,
  Modality,
  Priority,
  Signatory,
} from '@/domain/types'

const RADIOLOGIST: Signatory = {
  name: 'Dr. Nirmala Rao',
  qualification: 'MD (Radio-diagnosis)',
}
const NEURORADIOLOGIST: Signatory = {
  name: 'Dr. Vikram Hegde',
  qualification: 'DNB (Radiology), Fellowship in Neuroradiology',
}
const CONSULTANT: Signatory = {
  name: 'Dr. Sowmya Prasad',
  qualification: 'MD, DNB (Radio-diagnosis)',
}

interface StudyPlan {
  patient: string
  doctorId: string
  modality: Modality
  examName: string
  bodyRegion: string
  indication: string
  contrast?: string
  priority: Priority
  /** Minutes before now (negative: later today). */
  scheduledAgo: number
  performedAgo?: number
  versions?: (Omit<ImagingReportVersion, 'version' | 'releasedAt'> & {
    releasedAgo: number
  })[]
}

const PLANS: StudyPlan[] = [
  {
    patient: 'Shanthamma',
    doctorId: 'dr_lakshmi',
    modality: 'ct',
    examName: 'CT Brain (plain)',
    bodyRegion: 'Head',
    indication:
      'Altered sensorium in a patient being treated for urosepsis. Rule out intracranial haemorrhage or acute infarct.',
    priority: 'stat',
    scheduledAgo: 2 * 24 * 60 + 200,
    performedAgo: 2 * 24 * 60 + 170,
    versions: [
      {
        kind: 'final',
        releasedAgo: 2 * 24 * 60 + 120,
        reportedBy: NEURORADIOLOGIST,
        verifiedBy: CONSULTANT,
        technique:
          'Non-contrast axial sections of the brain from the skull base to the vertex, 5 mm, with bone and soft-tissue windows and multiplanar reformats.',
        comparison: 'No previous imaging available.',
        findings: [
          {
            heading: 'Brain parenchyma',
            text: 'No intra-axial or extra-axial haemorrhage. No area of loss of grey-white differentiation to suggest an acute territorial infarct. Patchy periventricular white matter hypodensities in both cerebral hemispheres.',
          },
          {
            heading: 'Ventricles and CSF spaces',
            text: 'Prominent ventricles, sulci and cisterns, in keeping with age-related volume loss. No hydrocephalus. Midline structures are central.',
          },
          {
            heading: 'Posterior fossa',
            text: 'Cerebellum and brainstem appear normal. Fourth ventricle is normal in position.',
          },
          {
            heading: 'Bones and extracranial soft tissues',
            text: 'No fracture. Scalp soft tissues unremarkable. Visualised paranasal sinuses and mastoid air cells are clear.',
          },
        ],
        impression: [
          'No acute intracranial haemorrhage, mass effect or large territory infarct.',
          'Chronic small vessel ischaemic changes and age-related cerebral atrophy.',
        ],
        recommendations: [
          'MRI brain with diffusion-weighted imaging if a focal neurological deficit develops, as an early infarct may not be visible on CT.',
        ],
      },
    ],
  },
  {
    patient: 'Arun Prakash',
    doctorId: 'dr_srinivas',
    modality: 'ct',
    examName: 'CECT Abdomen and Pelvis',
    bodyRegion: 'Abdomen and pelvis',
    indication:
      'Obstructive jaundice for evaluation before ERCP. Raised bilirubin and alkaline phosphatase.',
    contrast: 'IV non-ionic contrast 80 mL, portal venous phase',
    priority: 'urgent',
    scheduledAgo: 26 * 60,
    performedAgo: 25 * 60,
    versions: [
      {
        kind: 'final',
        releasedAgo: 23 * 60,
        reportedBy: RADIOLOGIST,
        verifiedBy: CONSULTANT,
        technique:
          'Helical acquisition from the diaphragm to the pubic symphysis after oral and IV contrast, portal venous phase, 1.25 mm reconstructions with coronal and sagittal reformats.',
        findings: [
          {
            heading: 'Liver',
            text: 'Normal in size (15.2 cm) with homogeneous enhancement. Mild intrahepatic biliary radicle dilatation in both lobes. No focal lesion.',
          },
          {
            heading: 'Biliary tree',
            text: 'Common bile duct dilated to 11 mm along its course. A 9 mm hyperdense calculus is seen in the distal common bile duct, with abrupt tapering beyond it. No mass at the ampulla.',
          },
          {
            heading: 'Gallbladder',
            text: 'Partially distended, with multiple small calculi, the largest 7 mm. No wall thickening or pericholecystic fluid.',
          },
          {
            heading: 'Pancreas, spleen and adrenals',
            text: 'Pancreas normal in bulk and enhancement; main pancreatic duct not dilated. Spleen and both adrenal glands are normal.',
          },
          {
            heading: 'Kidneys and urinary bladder',
            text: 'Both kidneys normal in size and enhancement. No calculus or hydronephrosis. Urinary bladder well distended and normal.',
          },
          {
            heading: 'Bowel, peritoneum and lymph nodes',
            text: 'No bowel wall thickening or obstruction. No free fluid. No significant lymphadenopathy.',
          },
        ],
        impression: [
          'Choledocholithiasis: 9 mm calculus in the distal common bile duct with upstream biliary dilatation.',
          'Cholelithiasis without cholecystitis.',
          'No pancreatic or periampullary mass.',
        ],
        recommendations: [
          'ERCP with stone extraction, as planned. Correlate with liver function tests.',
        ],
      },
    ],
  },
  {
    patient: 'Lakshmi Krishnan',
    doctorId: 'dr_preethi',
    modality: 'mri',
    examName: 'MRI Lumbosacral Spine',
    bodyRegion: 'Lumbar spine',
    indication:
      'Low back pain for 3 months radiating to the left leg, with tingling in the left foot. Evaluate for nerve root compression.',
    priority: 'routine',
    scheduledAgo: 4 * 24 * 60,
    performedAgo: 4 * 24 * 60 - 30,
    versions: [
      {
        kind: 'final',
        releasedAgo: 3 * 24 * 60 + 200,
        reportedBy: RADIOLOGIST,
        verifiedBy: NEURORADIOLOGIST,
        technique:
          'Sagittal T1, T2 and STIR, and axial T2 sequences of the lumbosacral spine on a 1.5 T scanner. No contrast.',
        findings: [
          {
            heading: 'Alignment and vertebral bodies',
            text: 'Lumbar lordosis is straightened. Vertebral body heights are maintained. Degenerative endplate changes at L4-L5 (Modic type 2). No marrow oedema or destructive lesion.',
          },
          {
            heading: 'L3-L4',
            text: 'Diffuse disc bulge indenting the thecal sac without neural compression. Mild bilateral facet arthropathy.',
          },
          {
            heading: 'L4-L5',
            text: 'Disc desiccation with a diffuse bulge and a superimposed left paracentral protrusion narrowing the left lateral recess and compressing the traversing left L5 nerve root. Moderate canal stenosis (AP diameter 8 mm) with ligamentum flavum thickening.',
          },
          {
            heading: 'L5-S1',
            text: 'Mild disc bulge without nerve root compression. Neural foramina are patent.',
          },
          {
            heading: 'Conus and cauda equina',
            text: 'The conus ends at the L1 level and is normal in signal. Cauda equina nerve roots are normal.',
          },
        ],
        impression: [
          'L4-L5 left paracentral disc protrusion compressing the traversing left L5 nerve root, with moderate canal stenosis. Correlates with the left leg symptoms.',
          'Multilevel degenerative disc disease and facet arthropathy.',
        ],
        recommendations: ['Orthopaedic or spine surgery review.'],
      },
    ],
  },
  {
    patient: 'Deepa Menon',
    doctorId: 'dr_nandini',
    modality: 'mri',
    examName: 'MRI Brain with Pituitary Protocol',
    bodyRegion: 'Head (sella)',
    indication:
      'Headache and intermittent blurring of vision for 2 months. Evaluate the pituitary gland.',
    contrast: 'IV gadolinium 0.1 mmol/kg, dynamic pituitary sequences',
    priority: 'routine',
    scheduledAgo: 6 * 24 * 60,
    performedAgo: 6 * 24 * 60 - 40,
    versions: [
      {
        kind: 'final',
        releasedAgo: 5 * 24 * 60 + 300,
        reportedBy: RADIOLOGIST,
        verifiedBy: CONSULTANT,
        technique:
          'Sagittal T1, axial T2, FLAIR and DWI of the brain; coronal and sagittal T1 and T2 of the sella; post-contrast T1 on a 1.5 T scanner.',
        findings: [
          {
            heading: 'Brain',
            text: 'Normal grey-white matter differentiation. No restricted diffusion. Two tiny non-specific T2/FLAIR hyperintense foci in the right frontal subcortical white matter. No mass, haemorrhage or abnormal enhancement.',
          },
          {
            heading: 'Sella and pituitary',
            text: 'Pituitary gland normal in size (height 6 mm) with homogeneous enhancement. Stalk is central. Optic chiasm normal.',
          },
          {
            heading: 'Ventricles and extra-axial spaces',
            text: 'Normal ventricular size. No extra-axial collection.',
          },
        ],
        impression: [
          'No pituitary lesion identified.',
          'Two tiny non-specific white matter foci, likely incidental.',
        ],
      },
      {
        kind: 'amended',
        releasedAgo: 4 * 24 * 60 + 100,
        amendmentReason:
          'Dynamic post-contrast sequences were reviewed at the neuroradiology meeting; a pituitary microadenoma not described in version 1 was identified.',
        reportedBy: NEURORADIOLOGIST,
        verifiedBy: CONSULTANT,
        technique:
          'Sagittal T1, axial T2, FLAIR and DWI of the brain; coronal and sagittal T1 and T2 of the sella; dynamic and delayed post-contrast T1 on a 1.5 T scanner.',
        findings: [
          {
            heading: 'Brain',
            text: 'Normal grey-white matter differentiation. No restricted diffusion. Two tiny non-specific T2/FLAIR hyperintense foci in the right frontal subcortical white matter. No mass, haemorrhage or abnormal enhancement.',
          },
          {
            heading: 'Sella and pituitary',
            text: 'Pituitary gland height 6 mm. On dynamic sequences a 4 x 3 mm focus of delayed enhancement is seen in the right half of the gland, consistent with a microadenoma. No cavernous sinus invasion. Stalk is central. Optic chiasm normal and not compressed.',
          },
          {
            heading: 'Ventricles and extra-axial spaces',
            text: 'Normal ventricular size. No extra-axial collection.',
          },
        ],
        impression: [
          'Right-sided pituitary microadenoma (4 x 3 mm) without mass effect on the optic chiasm.',
          'Two tiny non-specific white matter foci, likely incidental.',
        ],
        recommendations: [
          'Serum prolactin and pituitary hormone profile; endocrinology review.',
          'Follow-up pituitary MRI in 6 to 12 months.',
        ],
      },
    ],
  },
  {
    patient: 'Suresh Babu',
    doctorId: 'dr_joseph',
    modality: 'xray',
    examName: 'X-Ray Chest PA View',
    bodyRegion: 'Chest',
    indication:
      'Chronic kidney disease stage 4 with breathlessness and pedal oedema. Assess for fluid overload.',
    priority: 'urgent',
    scheduledAgo: 7 * 60,
    performedAgo: 6 * 60 + 40,
    versions: [
      {
        kind: 'final',
        releasedAgo: 6 * 60,
        reportedBy: CONSULTANT,
        verifiedBy: RADIOLOGIST,
        technique: 'Erect PA view, adequate inspiration and penetration.',
        findings: [
          {
            heading: 'Heart and mediastinum',
            text: 'Cardiomegaly with a cardiothoracic ratio of 0.58. Mediastinum is central.',
          },
          {
            heading: 'Lungs',
            text: 'Bilateral perihilar haziness with upper lobe blood diversion and peribronchial cuffing. No focal consolidation.',
          },
          {
            heading: 'Pleura',
            text: 'Blunting of both costophrenic angles from small pleural effusions. No pneumothorax.',
          },
          {
            heading: 'Bones and soft tissues',
            text: 'No acute bony abnormality.',
          },
        ],
        impression: [
          'Features of pulmonary venous congestion with small bilateral pleural effusions, in keeping with fluid overload.',
          'Cardiomegaly.',
        ],
        recommendations: [
          'Correlate clinically; repeat chest radiograph after dialysis or diuresis.',
        ],
      },
    ],
  },
  {
    patient: 'Rajesh Kumar',
    doctorId: 'dr_preethi',
    modality: 'xray',
    examName: 'X-Ray Left Knee AP and Lateral',
    bodyRegion: 'Left knee',
    indication:
      'Pain and swelling of the left knee after a fall on the stairs. Rule out fracture.',
    priority: 'routine',
    scheduledAgo: 3 * 24 * 60 + 60,
    performedAgo: 3 * 24 * 60 + 40,
    versions: [
      {
        kind: 'final',
        releasedAgo: 3 * 24 * 60,
        reportedBy: RADIOLOGIST,
        verifiedBy: CONSULTANT,
        technique: 'AP and lateral views of the left knee.',
        findings: [
          {
            heading: 'Bones',
            text: 'No fracture or dislocation. Bone density is normal.',
          },
          {
            heading: 'Joint',
            text: 'Mild narrowing of the medial tibiofemoral joint space with tiny marginal osteophytes. Patellofemoral joint preserved.',
          },
          {
            heading: 'Soft tissues',
            text: 'Moderate suprapatellar joint effusion. No soft tissue calcification or foreign body.',
          },
        ],
        impression: [
          'No fracture.',
          'Joint effusion, likely post-traumatic.',
          'Early medial compartment osteoarthritis.',
        ],
        recommendations: [
          'MRI of the knee if pain or locking persists, to assess the menisci and ligaments.',
        ],
      },
    ],
  },
  // Not yet reported: acquired and waiting, or booked for later today.
  {
    patient: 'Harish Shetty',
    doctorId: 'dr_arvind',
    modality: 'xray',
    examName: 'X-Ray Chest AP (portable)',
    bodyRegion: 'Chest',
    indication: 'Chest pain with sweating. ECG changes. Baseline chest film.',
    priority: 'stat',
    scheduledAgo: 70,
    performedAgo: 55,
  },
  {
    patient: 'Mohammed Faisal',
    doctorId: 'dr_lakshmi',
    modality: 'ct',
    examName: 'CT KUB (plain)',
    bodyRegion: 'Abdomen and pelvis',
    indication:
      'Acute kidney injury on chronic kidney disease, oliguric. Rule out obstructive uropathy.',
    priority: 'urgent',
    scheduledAgo: 40,
    performedAgo: 15,
  },
  {
    patient: 'Meena Devi',
    doctorId: 'dr_nandini',
    modality: 'mri',
    examName: 'MRI Neck (thyroid)',
    bodyRegion: 'Neck',
    indication: 'Thyroid swelling; assess retrosternal extension.',
    priority: 'routine',
    scheduledAgo: -150,
  },
  {
    patient: 'Shanthamma',
    doctorId: 'dr_lakshmi',
    modality: 'xray',
    examName: 'X-Ray Chest AP (portable)',
    bodyRegion: 'Chest',
    indication: 'Septic shock on ventilatory support. Check endotracheal tube.',
    priority: 'urgent',
    scheduledAgo: -60,
  },
]

/**
 * Builds the imaging studies for the demo. `patientId` maps a demo
 * patient's name to their id; studies whose patient is missing are skipped.
 */
export function seedImaging(
  now: number,
  patientId: (name: string) => string | undefined,
): ImagingStudy[] {
  const counters = new Map<string, number>()
  const number = (prefix: string, at: number) => {
    const day = istDayCompact(at)
    const n = (counters.get(prefix + day) ?? 0) + 1
    counters.set(prefix + day, n)
    return `${prefix}-${day}-${String(n).padStart(4, '0')}`
  }
  const ago = (minutes: number) => now - minutes * MINUTE
  const studies: ImagingStudy[] = []
  PLANS.forEach((plan, i) => {
    const pid = patientId(plan.patient)
    if (!pid) return
    const scheduledAt = ago(plan.scheduledAgo)
    const versions = (plan.versions ?? []).map(
      ({ releasedAgo, ...v }, index): ImagingReportVersion => ({
        ...v,
        version: index + 1,
        releasedAt: ago(releasedAgo),
      }),
    )
    const study: ImagingStudy = {
      id: `img_${String(i + 1).padStart(3, '0')}`,
      accessionNo: number('IMG', scheduledAt),
      patientId: pid,
      orderingDoctorId: plan.doctorId,
      modality: plan.modality,
      examName: plan.examName,
      bodyRegion: plan.bodyRegion,
      indication: plan.indication,
      priority: plan.priority,
      scheduledAt,
      versions,
    }
    if (plan.contrast) study.contrast = plan.contrast
    if (plan.performedAgo !== undefined)
      study.performedAt = ago(plan.performedAgo)
    if (versions[0]) study.reportNo = number('RAD', versions[0].releasedAt)
    studies.push(study)
  })
  return studies
}

/** Report turnaround targets in hours, by priority. */
export const IMAGING_TAT_HOURS: Record<Priority, number> = {
  stat: 1,
  urgent: 4,
  routine: 24,
}
