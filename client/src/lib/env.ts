// Build-time configuration (Vite `VITE_*` variables). Nothing secret belongs
// here: everything below ends up in the browser bundle.

const source = import.meta.env.VITE_DATA_SOURCE === 'http' ? 'http' : 'mock'
const timeout = Number(import.meta.env.VITE_REQUEST_TIMEOUT_MS)

export const env = {
  /**
   * Where the data comes from: `mock` (the in-browser demo, default) or
   * `http` (the laboratory backend at `apiBaseUrl`).
   */
  dataSource: source,
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '/api',
  /** The backend's sign-in page, for a session that has expired. */
  loginUrl: import.meta.env.VITE_LOGIN_URL ?? '/login',
  /** Ends the backend session (http mode). */
  logoutUrl: import.meta.env.VITE_LOGOUT_URL ?? '/logout',
  requestTimeoutMs: Number.isFinite(timeout) && timeout > 0 ? timeout : 20_000,
} as const
