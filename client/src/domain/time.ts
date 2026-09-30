// Time helpers. The laboratory runs on Indian Standard Time (UTC+05:30, no
// daylight saving), so "today" is always computed in IST regardless of the
// browser's time zone.

export const MINUTE = 60_000
export const HOUR = 60 * MINUTE
export const DAY = 24 * HOUR

const IST_OFFSET = 330 * MINUTE

/** IST calendar day as YYYY-MM-DD. */
export function istDay(ms: number) {
  return new Date(ms + IST_OFFSET).toISOString().slice(0, 10)
}

/** IST calendar day as YYYYMMDD, used in IDs. */
export function istDayCompact(ms: number) {
  return istDay(ms).replaceAll('-', '')
}

/** Epoch ms of midnight IST for the day containing `ms`. */
export function startOfIstDay(ms: number) {
  const shifted = ms + IST_OFFSET
  return shifted - (shifted % DAY) - IST_OFFSET
}

/** Hour of day (0-23) in IST. */
export function istHour(ms: number) {
  return new Date(ms + IST_OFFSET).getUTCHours()
}

export function isSameIstDay(a: number, b: number) {
  return istDay(a) === istDay(b)
}

export interface Age {
  years: number
  months: number
  days: number
}

export function ageFromDob(dob: string, now: number): Age {
  const [y, m, d] = dob.split('-').map(Number) as [number, number, number]
  const today = new Date(now + IST_OFFSET)
  let years = today.getUTCFullYear() - y
  let months = today.getUTCMonth() + 1 - m
  let days = today.getUTCDate() - d
  if (days < 0) {
    months -= 1
    const prevMonthDays = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0),
    ).getUTCDate()
    days += prevMonthDays
  }
  if (months < 0) {
    years -= 1
    months += 12
  }
  return { years, months, days }
}

/** Age in fractional years, for reference-range selection. */
export function ageInYears(dob: string, now: number) {
  const a = ageFromDob(dob, now)
  return a.years + a.months / 12 + a.days / 365
}
