import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { LANGUAGES, type Language } from '@/domain/types'
import { oneOf, readStored, writeStored } from '@/lib/storage'
import { I18nContext } from './context'
import { loadLanguage } from './core'

export function readSavedLanguage(): Language {
  return readStored<Language>('language', 'en', oneOf(LANGUAGES))
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(readSavedLanguage)
  const [switching, setSwitching] = useState(false)

  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  const setLanguage = useCallback((next: Language) => {
    setSwitching(true)
    void loadLanguage(next).then(() => {
      writeStored('language', next)
      startTransition(() => {
        setLanguageState(next)
        setSwitching(false)
      })
    })
  }, [])

  const value = useMemo(
    () => ({ language, setLanguage, switching }),
    [language, setLanguage, switching],
  )
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}
