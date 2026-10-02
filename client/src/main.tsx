import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { AppProviders } from '@/app/providers'
import { router } from '@/app/router'
import { loadLanguage } from '@/i18n/core'
import { readSavedLanguage } from '@/i18n/provider'
import '@/styles/index.css'

// After a new release, a tab opened on the old one asks for code files that no
// longer exist. Reload to pick up the new release, at most once a minute so a
// file the server really cannot serve never causes a reload loop.
const RELOAD_KEY = 'shri-lims.release-reload-at'
window.addEventListener('vite:preloadError', (event) => {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0)
    if (Date.now() - last < 60_000) return
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
  } catch {
    return
  }
  event.preventDefault()
  window.location.reload()
})

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Root element #root not found')

// Load the saved language first so the UI never flashes in English.
await loadLanguage(readSavedLanguage()).catch(() => undefined)

createRoot(rootElement).render(
  <StrictMode>
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>,
)
