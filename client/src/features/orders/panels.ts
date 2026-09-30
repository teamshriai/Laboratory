// Frequently ordered combinations shown as one-click shortcuts in the wizard.
export const COMMON_PANELS: { id: string; testIds: string[] }[] = [
  { id: 'diabetes', testIds: ['fbs', 'ppbs', 'hba1c'] },
  { id: 'fever', testIds: ['cbc', 'crp', 'dengue_ns1', 'malaria', 'widal'] },
  { id: 'liverKidney', testIds: ['lft', 'kft'] },
  { id: 'cardiacRisk', testIds: ['lipid', 'fbs', 'hba1c'] },
  {
    id: 'preOp',
    testIds: ['cbc', 'pt_inr', 'aptt', 'hiv', 'hbsag', 'hcv', 'rbs', 'bg'],
  },
  {
    id: 'antenatal',
    testIds: ['cbc', 'bg', 'hiv', 'hbsag', 'vdrl', 'urine_re', 'tsh_test'],
  },
  { id: 'thyroid', testIds: ['thyroid'] },
  { id: 'sepsis', testIds: ['blood_cs', 'cbc', 'crp'] },
]
