// Privacy screen: tabs and the next steps a request or incident offers.
// The engine decides what is allowed; these only choose which buttons show.

import type { BreachStep, DataRequestState } from '@/domain/types'

export const PRIVACY_TABS = [
  'requests',
  'incidents',
  'holds',
  'retention',
] as const
export type PrivacyTab = (typeof PRIVACY_TABS)[number]

export const REQUEST_FILTERS = ['open', 'closed', 'all'] as const
export type RequestFilter = (typeof REQUEST_FILTERS)[number]

export const HOLD_FILTERS = ['active', 'released', 'all'] as const
export type HoldFilter = (typeof HOLD_FILTERS)[number]

/** The step forward from each open state (refusing is always offered). */
export const REQUEST_FORWARD: Partial<
  Record<DataRequestState, 'verifying' | 'in-progress' | 'completed'>
> = {
  received: 'verifying',
  verifying: 'in-progress',
  'in-progress': 'completed',
}

export const isRequestOpen = (state: DataRequestState) =>
  state !== 'completed' && state !== 'refused'

/** When each reporting step of an incident was recorded. */
export function stepTimes(b: {
  certInReportedAt?: number
  boardReportedAt?: number
  principalsNotifiedAt?: number
  containedAt?: number
  closedAt?: number
}): Record<BreachStep, number | undefined> {
  return {
    'cert-in-reported': b.certInReportedAt,
    'board-reported': b.boardReportedAt,
    'principals-notified': b.principalsNotifiedAt,
    contained: b.containedAt,
    closed: b.closedAt,
  }
}
