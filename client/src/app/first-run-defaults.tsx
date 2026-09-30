import { useEffect } from 'react'
import { usePreferences } from '@/app/preferences/context'
import { useLanguage } from '@/i18n/context'
import { readStoredRaw, writeStored } from '@/lib/storage'
import { useLabSettings } from '@/services/queries'

const APPLIED = 'first-run-applied'

/**
 * On a browser's first visit, starts it in the laboratory's default language
 * and working department (Settings, Laboratory). Choices made afterwards on
 * this browser are the user's own and are never overridden.
 */
export function FirstRunDefaults() {
  const { data } = useLabSettings()
  const { setLanguage } = useLanguage()
  const { setDepartment } = usePreferences()
  useEffect(() => {
    if (!data || readStoredRaw(APPLIED) !== null) return
    writeStored(APPLIED, true)
    if (readStoredRaw('language') === null && data.defaultLanguage !== 'en')
      setLanguage(data.defaultLanguage)
    if (
      readStoredRaw('department') === null &&
      data.defaultDepartment !== 'all'
    )
      setDepartment(data.defaultDepartment)
  }, [data, setLanguage, setDepartment])
  return null
}
