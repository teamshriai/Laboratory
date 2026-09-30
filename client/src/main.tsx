import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { AppProviders } from '@/app/providers'
import { router } from '@/app/router'
import { loadLanguage } from '@/i18n/core'
import { readSavedLanguage } from '@/i18n/provider'
import '@/styles/index.css'

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
