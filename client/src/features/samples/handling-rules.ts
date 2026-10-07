import type { SampleDetail } from '@/services/lab-api'

/**
 * What the specimen page offers for aliquots and referral work. These only
 * decide which buttons to show: the engine enforces the same rules.
 */

/** Tests on the specimen that are not cancelled. */
export function liveItems(sample: SampleDetail) {
  return sample.items.filter((i) => i.active)
}

/** Tests not started yet, the only ones that can move to an aliquot. */
export function movableItems(sample: SampleDetail) {
  return liveItems(sample).filter(
    (i) => i.status === 'pending' || i.status === 'draft',
  )
}

export function canSplit(sample: SampleDetail) {
  return (
    (sample.status === 'received' || sample.status === 'processing') &&
    !sample.parent &&
    !sample.sendOut &&
    movableItems(sample).length > 0 &&
    liveItems(sample).length > 1
  )
}

export function canSendOut(sample: SampleDetail) {
  return sample.status === 'received' && !sample.sendOut
}

export function showAliquots(sample: SampleDetail) {
  return (
    Boolean(sample.parent) || sample.aliquots.length > 0 || canSplit(sample)
  )
}

export function showSendOut(sample: SampleDetail) {
  return Boolean(sample.sendOut) || canSendOut(sample)
}
