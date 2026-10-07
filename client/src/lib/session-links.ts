import { env } from './env'

/** The backend's sign-in page, returning to the current page afterwards. */
export function signInHref() {
  const next = `${window.location.pathname}${window.location.search}`
  const separator = env.loginUrl.includes('?') ? '&' : '?'
  return `${env.loginUrl}${separator}next=${encodeURIComponent(next)}`
}
