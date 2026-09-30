import { useEffect } from 'react'
import { toast } from 'sonner'
import { useT } from '@/i18n/context'
import { onStorageResult, wasDataRefreshed } from '@/services/lab-api'

/**
 * Warns once if the browser refuses to store the demo data, and says so when
 * saved work had to be replaced (an older data format or unreadable data).
 */
export function StorageWatcher() {
  const t = useT('errors')
  useEffect(() => {
    if (wasDataRefreshed()) toast.info(t('dataRefreshed'))
  }, [t])
  useEffect(() => {
    let warned = false
    const off = onStorageResult((ok) => {
      if (!ok && !warned) {
        warned = true
        toast.warning(t('storage-full'))
      }
    })
    return () => {
      off()
    }
  }, [t])
  return null
}
