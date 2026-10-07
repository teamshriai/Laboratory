import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { isApiError } from '@/domain/errors'
import { useLanguage, useT } from '@/i18n/context'
import { useOnline } from '@/hooks/use-online'
import { errorMessage } from '@/services/mutations'

/** Browser noise that is not a fault of the app. */
const BENIGN = [/ResizeObserver loop/i, /Loading chunk|dynamically imported/i]

/**
 * The last line of defence: an error no screen handled is still told to the
 * user (once every few seconds at most) instead of failing silently, and the
 * user hears when the connection drops and returns.
 */
export function GlobalErrors() {
  const t = useT('errors')
  const th = useT('header')
  const { language } = useLanguage()
  const online = useOnline()

  useEffect(() => {
    let lastShown = 0
    const report = (error: unknown) => {
      const message =
        error instanceof Error
          ? error.message
          : typeof error === 'string'
            ? error
            : ''
      if (BENIGN.some((re) => re.test(message))) return
      if (import.meta.env.DEV) console.error('Unhandled error', error)
      const now = Date.now()
      if (now - lastShown < 5_000) return
      lastShown = now
      toast.error(t('genericTitle'), {
        description: isApiError(error)
          ? errorMessage(error, language)
          : t('genericBody'),
      })
    }
    const onRejection = (event: PromiseRejectionEvent) => report(event.reason)
    const onError = (event: ErrorEvent) => report(event.error ?? event.message)
    window.addEventListener('unhandledrejection', onRejection)
    window.addEventListener('error', onError)
    return () => {
      window.removeEventListener('unhandledrejection', onRejection)
      window.removeEventListener('error', onError)
    }
  }, [t, language])

  // Announce a returning connection (the banner covers the offline state).
  const wasOffline = useRef(false)
  useEffect(() => {
    if (!online) {
      wasOffline.current = true
      return
    }
    if (wasOffline.current) {
      wasOffline.current = false
      toast.success(th('backOnline'))
    }
  }, [online, th])
  return null
}
