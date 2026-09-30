import { useCallback, useState } from 'react'

/** Tracks an element's content size with ResizeObserver (callback ref). */
export function useElementSize<T extends HTMLElement>() {
  const [size, setSize] = useState({ width: 0, height: 0 })
  const ref = useCallback((node: T | null) => {
    if (!node) return
    const update = () => {
      const rect = node.getBoundingClientRect()
      setSize((prev) =>
        Math.abs(prev.width - rect.width) < 1 &&
        Math.abs(prev.height - rect.height) < 1
          ? prev
          : { width: rect.width, height: rect.height },
      )
    }
    update()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(update)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  return [ref, size] as const
}
