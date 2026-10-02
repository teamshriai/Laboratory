/**
 * The laboratory's fixed daily routine (IST), shown on the Today's Work
 * agenda beside the real deadlines of the day's work. A lab would set these
 * in Settings once the backend stores them.
 */
export const LAB_ROUTINE = [
  { key: 'wardRound', hour: 6, minute: 0, to: '/collection' },
  { key: 'qcMorning', hour: 7, minute: 30, to: '/quality-control' },
  { key: 'opdCollection', hour: 8, minute: 0, to: '/collection' },
  { key: 'signOut', hour: 13, minute: 0, to: '/verification?stage=authorise' },
  { key: 'eveningRound', hour: 17, minute: 0, to: '/collection' },
  { key: 'handover', hour: 20, minute: 0, to: '/work-queue' },
] as const

export type RoutineKey = (typeof LAB_ROUTINE)[number]['key']
