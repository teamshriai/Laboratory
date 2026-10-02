import { useEffect, useState } from 'react'

/** The value once it has stopped changing for `ms` (search as you type). */
export function useDebouncedValue<T>(value: T, ms: number) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), ms)
    return () => window.clearTimeout(id)
  }, [value, ms])
  return debounced
}
