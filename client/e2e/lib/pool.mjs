// Runs async jobs with at most `size` in flight. A job that throws is
// reported through onError and does not stop the others.
export async function runPool(items, size, job, onError) {
  let next = 0
  async function worker() {
    while (next < items.length) {
      const item = items[next]
      next += 1
      try {
        await job(item)
      } catch (e) {
        if (onError) onError(item, e)
        else throw e
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, worker),
  )
}

/** Gives up on a promise after `ms` (the work keeps running in the page). */
export function withTimeout(promise, ms, label) {
  let timer
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`${label} timed out after ${ms} ms`)),
        ms,
      )
    }),
  ])
}
