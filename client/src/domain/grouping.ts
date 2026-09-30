import type { ContainerId, DepartmentId, LabTest, SpecimenId } from './types'

export interface SampleRequirement {
  key: string
  department: DepartmentId
  container: ContainerId
  specimen: SpecimenId
  testIds: string[]
  volumeMl: number | null
  fasting: boolean
}

const CONTAINER_CAP_ML: Partial<Record<ContainerId, number>> = {
  edta: 3,
  sst: 5,
  plain: 5,
  citrate: 2.7,
  fluoride: 2,
  heparin: 4,
  urine: 30,
  'culture-bottle': 10,
  sterile: 20,
}

export function sampleKey(
  t: Pick<LabTest, 'department' | 'container' | 'specimen'>,
) {
  return `${t.department}|${t.container}|${t.specimen}`
}

/**
 * Groups ordered tests into the samples to collect: one sample per
 * (department, container, specimen), so each sample belongs to one bench.
 */
export function groupTestsIntoSamples(tests: LabTest[]): SampleRequirement[] {
  const groups = new Map<string, SampleRequirement>()
  for (const test of tests) {
    const key = sampleKey(test)
    const existing = groups.get(key)
    if (existing) {
      existing.testIds.push(test.id)
      existing.fasting ||= test.fasting
      if (test.volumeMl !== null) {
        const cap = CONTAINER_CAP_ML[test.container] ?? Infinity
        existing.volumeMl = Math.min(
          cap,
          (existing.volumeMl ?? 0) + Math.min(test.volumeMl, 1),
        )
      }
    } else {
      groups.set(key, {
        key,
        department: test.department,
        container: test.container,
        specimen: test.specimen,
        testIds: [test.id],
        volumeMl: test.volumeMl,
        fasting: test.fasting,
      })
    }
  }
  return [...groups.values()]
}
