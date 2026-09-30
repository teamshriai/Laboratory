import type { ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { queryClient } from '@/app/query-client'
import { I18nProvider } from '@/i18n/provider'
import { PreferencesProvider } from '@/app/preferences/provider'
import { ThemeProvider } from '@/app/theme/provider'
import { PrintProvider } from '@/components/ui/print'
import { Toaster } from '@/components/ui/toaster'
import { TooltipProvider } from '@/components/ui/tooltip'
import { StorageWatcher } from '@/app/storage-watcher'
import { FirstRunDefaults } from '@/app/first-run-defaults'

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
                <FirstRunDefaults />
              </PrintProvider>
            </TooltipProvider>
          </PreferencesProvider>
        </I18nProvider>
      </ThemeProvider>
      {/* Opt-in (VITE_QUERY_DEVTOOLS=true); never included in production builds. */}
      {import.meta.env.VITE_QUERY_DEVTOOLS === 'true' ? (
        <ReactQueryDevtools
          initialIsOpen={false}
          buttonPosition="bottom-right"
        />
      ) : null}
    </QueryClientProvider>
  )
}
