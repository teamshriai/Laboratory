// Test helpers: who does what. Each step of a workflow test is performed by
// a person whose role may do it, as in the laboratory.

import { labApi } from './index'
import { getActor, setActor } from './runtime'

export const STAFF = {
  reception: 'st_shruthi',
  phlebotomist: 'st_kavya',
  technician: 'st_anjali',
  biochemistry: 'st_prakash',
  manager: 'st_ganesh',
  pathologist: 'st_kavitha',
  microbiologist: 'st_meera',
} as const

/** Runs one API call as `staffId`, then restores the previous actor. */
export async function as<T>(staffId: string, action: () => Promise<T>) {
  const previous = getActor()
  setActor(staffId)
  try {
    return await action()
  } finally {
    setActor(previous)
  }
}

/**
 * The lab API as one person: `actingAs(STAFF.reception).orders.create(...)`
 * runs that call as the receptionist.
 */
export function actingAs(staffId: string): typeof labApi {
  return new Proxy(labApi, {
    get(api, group: string) {
      const target = (
        api as unknown as Record<string, Record<string, unknown>>
      )[group]!
      return new Proxy(target, {
        get(calls, name: string) {
          const call = calls[name]
          return typeof call === 'function'
            ? (...args: unknown[]) =>
                as(staffId, () =>
                  Promise.resolve(
                    (call as (...a: unknown[]) => unknown)(...args),
                  ),
                )
            : call
        },
      })
    },
  })
}
