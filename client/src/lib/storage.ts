// Guarded localStorage access: storage can be unavailable (private mode,
// blocked site data) or full, and the app must keep working without it.

const PREFIX = 'shri-lims.'

/**
 * True when a stored value has the same basic shape as the fallback: the same
 * primitive type, an array for an array, a plain object for an object. Keeps
 * a hand-edited or stale value from crashing the screen that reads it.
 */
export function sameShape<T>(value: unknown, fallback: T): value is T {
  if (fallback === null || fallback === undefined) return true
  if (Array.isArray(fallback)) return Array.isArray(value)
  if (typeof fallback === 'object')
    return typeof value === 'object' && value !== null && !Array.isArray(value)
  return typeof value === typeof fallback
}

/**
 * Reads a JSON value. Unavailable storage, unparsable JSON and values that
 * fail `isValid` (by default: a different shape from the fallback) all give
 * the fallback.
 */
export function readStored<T>(
  key: string,
  fallback: T,
  isValid: (value: unknown) => boolean = (v) => sameShape(v, fallback),
): T {
  try {
    const raw = window.localStorage.getItem(PREFIX + key)
    if (raw === null) return fallback
    const value: unknown = JSON.parse(raw)
    return isValid(value) ? (value as T) : fallback
  } catch {
    return fallback
  }
}

/** Every stored key (without the prefix) that starts with `start`. */
export function storedKeys(start: string): string[] {
  try {
    const out: string[] = []
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const k = window.localStorage.key(i)
      if (k?.startsWith(PREFIX + start)) out.push(k.slice(PREFIX.length))
    }
    return out
  } catch {
    return []
  }
}

export const STORAGE_PREFIX = PREFIX

export function writeStored(key: string, value: unknown): boolean {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function removeStored(key: string) {
  try {
    window.localStorage.removeItem(PREFIX + key)
  } catch {
    // ignore
  }
}

export function readStoredRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(PREFIX + key)
  } catch {
    return null
  }
}

export function writeStoredRaw(key: string, value: string) {
  window.localStorage.setItem(PREFIX + key, value)
}

/** Validator for a stored value that must be one of a fixed list. */
export function oneOf<T>(allowed: readonly T[]) {
  return (value: unknown) => allowed.includes(value as T)
}
