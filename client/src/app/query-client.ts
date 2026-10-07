import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { FINAL_CODES, isApiError } from '@/domain/errors'

/** A retry cannot fix a refusal (permission, missing record, bad input). */
function shouldRetry(failureCount: number, error: unknown) {
  if (isApiError(error) && FINAL_CODES.has(error.code)) return false
  return failureCount < 1
}

/**
 * A request answered "not signed in" means the session ended: refetching the
 * session lets the session gate (app/session-gate.tsx) ask to sign in again.
 */
function onError(error: unknown) {
  if (isApiError(error) && error.code === 'unauthenticated')
    void queryClient.invalidateQueries({ queryKey: ['session'] })
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError }),
  mutationCache: new MutationCache({ onError }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: shouldRetry,
      refetchOnWindowFocus: false,
    },
    mutations: { retry: false },
  },
})
