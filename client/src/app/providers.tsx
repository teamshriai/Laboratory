import { lazy, Suspense, type ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/app/query-client'
import { I18nProvider } from '@/i18n/provider'
import { PreferencesProvider } from '@/app/preferences/provider'
import { ThemeProvider } from '@/app/theme/provider'
import { PrintProvider } from '@/components/ui/print'
import { Toaster } from '@/components/ui/toaster'
import { TooltipProvider } from '@/components/ui/tooltip'
import { StorageWatcher } from '@/app/storage-watcher'
import { FirstRunDefaults } from '@/app/first-run-defaults'
import { GlobalErrors } from '@/app/global-errors'

/**
 * TanStack Query devtools: development builds only, and only when asked
 * (VITE_QUERY_DEVTOOLS=true). They are a dev dependency, never shipped.
 */
const QueryDevtools =
  import.meta.env.DEV && import.meta.env.VITE_QUERY_DEVTOOLS === 'true'
    ? lazy(() =>
        import('@tanstack/react-query-devtools').then((m) => ({
          default: m.ReactQueryDevtools,
        })),
      )
    : null

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <I18nProvider>
          <PreferencesProvider>
            <TooltipProvider delayDuration={300} skipDelayDuration={200}>
              <PrintProvider>
                {children}
                <Toaster />
                <StorageWatcher />
                <GlobalErrors />
                <FirstRunDefaults />
              </PrintProvider>
            </TooltipProvider>
          </PreferencesProvider>
        </I18nProvider>
      </ThemeProvider>
      {QueryDevtools ? (
        <Suspense fallback={null}>
          <QueryDevtools initialIsOpen={false} buttonPosition="bottom-right" />
        </Suspense>
      ) : null}
    </QueryClientProvider>
  )
}
