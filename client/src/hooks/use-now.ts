import { useSyncExternalStore } from 'react'

// One shared ticker for every live duration on screen (waiting time, TAT),
// instead of a timer per row and instead of Date.now() during render.
const TICK_MS = 30_000
const listeners = new Set<() => void>()
let now = Date.now()
let timer: ReturnType<typeof setInterval> | undefined

function subscribe(listener: () => void) {
  listeners.add(listener)
  if (!timer) {
    now = Date.now()
    timer = setInterval(() => {
      now = Date.now()
      listeners.forEach((l) => l())
    }, TICK_MS)
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && timer) {
      clearInterval(timer)
      timer = undefined
    }
  }
}

function getSnapshot() {
  return now
}

/** Current time in epoch ms, refreshed every 30 seconds. */
export function useNow() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

/** Force the shared clock forward, e.g. right after a mutation. */
export function refreshNow() {
  now = Date.now()
  listeners.forEach((l) => l())
}
