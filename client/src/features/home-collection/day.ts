import { DAY, istDay } from '@/domain/time'
import type { HomeVisitState } from '@/domain/types'

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/

/** Epoch ms of midnight IST on a YYYY-MM-DD day. */
export const dayStart = (day: string) => Date.parse(`${day}T00:00:00+05:30`)

/** A well-formed, real calendar day (YYYY-MM-DD). */
export const isDayKey = (value: string) =>
  DAY_KEY.test(value) &&
  !Number.isNaN(dayStart(value)) &&
  istDay(dayStart(value)) === value

export const shiftDay = (day: string, by: number) =>
  istDay(dayStart(day) + by * DAY)

/** Epoch ms of an IST day and HH:MM time. */
export const slotAt = (day: string, time: string) =>
  Date.parse(`${day}T${time}:00+05:30`)

/** States the desk may still change (assign or cancel). */
export const isOpenForDesk = (state: HomeVisitState) =>
  state === 'booked' || state === 'assigned'

/** States the assigned phlebotomist moves along. */
export const isOnRoute = (state: HomeVisitState) =>
  state === 'assigned' || state === 'en-route'

export const isDone = (state: HomeVisitState) =>
  state === 'collected' || state === 'missed' || state === 'cancelled'
