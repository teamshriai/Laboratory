import { Navigate, useLocation } from 'react-router'
import { legacyPath } from './legacy-paths'

/**
 * Pages used to live under /laboratory (…/dev/laboratory/laboratory/…).
 * Bookmarks, shared links and links saved in older data still work: they
 * are sent to the same page at its current address, query string intact.
 */
export function LegacyRedirect() {
  const { pathname, search, hash } = useLocation()
  return <Navigate to={legacyPath(pathname) + search + hash} replace />
}
