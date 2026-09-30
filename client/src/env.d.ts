interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_API_PROXY_TARGET?: string
  readonly VITE_QUERY_DEVTOOLS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
