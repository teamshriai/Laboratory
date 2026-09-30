import { useSearchParams } from 'react-router'

/** Opens the sample drawer over the current page. */
export function useOpenSample() {
  const [, setParams] = useSearchParams()
  return (id: string) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('sample', id)
      return next
    })
}
