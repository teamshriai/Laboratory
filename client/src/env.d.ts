interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_API_PROXY_TARGET?: string
  readonly VITE_QUERY_DEVTOOLS?: string
  readonly VITE_DATA_SOURCE?: 'mock' | 'http'
  readonly VITE_LOGIN_URL?: string
  readonly VITE_LOGOUT_URL?: string
  readonly VITE_REQUEST_TIMEOUT_MS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
