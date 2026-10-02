import { useLocation } from 'react-router'

export type RecordKind = 'patient' | 'order' | 'specimen' | 'report'

/**
 * Where a record lives. Orders open as a drawer over the current page (the
 * drawer host reads ?order=); the others have their own page.
 */
export function useRecordHref() {
  const location = useLocation()
  return (kind: RecordKind, id: string) => {
    if (kind === 'patient') return `/patients/${id}`
    if (kind === 'specimen') return `/specimens/${id}`
    if (kind === 'report') return `/reports/${id}`
    const search = new URLSearchParams(location.search)
    search.set('order', id)
    return `${location.pathname}?${search.toString()}`
  }
}
