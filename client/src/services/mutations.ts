import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useLanguage } from '@/i18n/context'
import { translate } from '@/i18n/core'
import type { Language } from '@/domain/types'
import { isLabApiError } from './lab-api'

export function errorMessage(error: unknown, lang: Language) {
  if (isLabApiError(error))
    return translate(lang, 'errors', error.code, error.params)
  return translate(lang, 'errors', 'genericBody')
}

interface Feedback<TData, TVars> {
  /** Toast title on success; return null to stay silent. */
  success?: (
    data: TData,
    vars: TVars,
  ) => string | { title: string; description?: string } | null
  onSuccess?: (data: TData, vars: TVars) => void
  onError?: (error: unknown) => void
}

/** Mutation that refreshes lab data and reports the outcome in a toast. */
export function useLabMutation<TVars, TData>(
  fn: (vars: TVars) => Promise<TData>,
  feedback: Feedback<TData, TVars> = {},
) {
  const queryClient = useQueryClient()
  const { language } = useLanguage()
  return useMutation({
    mutationFn: fn,
    onSuccess: async (data, vars) => {
      await queryClient.invalidateQueries({ queryKey: ['lab'] })
      const message = feedback.success?.(data, vars)
      if (message) {
        if (typeof message === 'string') toast.success(message)
        else
          toast.success(
            message.title,
            message.description
              ? { description: message.description }
              : undefined,
          )
      }
      feedback.onSuccess?.(data, vars)
    },
    onError: (error) => {
      toast.error(translate(language, 'errors', 'genericTitle'), {
        description: errorMessage(error, language),
      })
      feedback.onError?.(error)
    },
  })
}
