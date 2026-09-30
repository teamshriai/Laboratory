// Conversions between instants and <input type="date|datetime-local"> values,
// always in IST so the lab sees the same wall-clock time everywhere.

const IST = 5.5 * 3_600_000

export const toDateTimeInput = (ms: number) =>
  new Date(ms + IST).toISOString().slice(0, 16)

export const fromDateTimeInput = (value: string) =>
  Date.parse(`${value}:00Z`) - IST

export const toDateInput = (ms: number) =>
  new Date(ms + IST).toISOString().slice(0, 10)

/** Noon IST on the chosen day, so the date never shifts across time zones. */
export const fromDateInput = (value: string) =>
  Date.parse(`${value}T12:00:00Z`) - IST
