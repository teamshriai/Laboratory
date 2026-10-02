import type { ContainerId } from '@/domain/types'

/** Cap colour of each container, as a theme background class. */
export const TUBE_CLASS: Record<ContainerId, string> = {
  edta: 'bg-tube-edta',
  sst: 'bg-tube-sst',
  plain: 'bg-tube-plain',
  citrate: 'bg-tube-citrate',
  fluoride: 'bg-tube-fluoride',
  heparin: 'bg-tube-heparin',
  urine: 'bg-tube-sst',
  stool: 'bg-tube-formalin',
  'culture-bottle': 'bg-tube-culture',
  sterile: 'bg-tube-sterile',
  formalin: 'bg-tube-formalin',
  slide: 'bg-tube-slide',
}
