import { useCallback, useEffect, useState } from 'react'
import { readStored, STORAGE_PREFIX, writeStored } from '@/lib/storage'

/**
 * useState that survives reloads through localStorage (per browser).
 * A stored value is only used when it passes `isValid` (by default it must
 * have the same shape as `initial`); other tabs' changes are picked up.
 */
export function usePersistentState<T>(
  key: string,
  initial: T,
  isValid?: (value: unknown) => boolean,
) {
  const [value, setValue] = useState<T>(() => readStored(key, initial, isValid))

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_PREFIX + key)
        setValue(readStored(key, initial, isValid))
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [key, initial, isValid])

  const update = useCallback((next: T | ((prev: T) => T)) => {
    setValue((prev) =>
      typeof next === 'function' ? (next as (prev: T) => T)(prev) : next,
    )
  }, [])

  // Write after the state settles, never inside the updater (which React
  // may run twice).
  useEffect(() => {
    writeStored(key, value)
  }, [key, value])

  return [value, update] as const
}
