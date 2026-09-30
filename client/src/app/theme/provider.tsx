import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { readStored, writeStored } from '@/lib/storage'
import { ThemeContext, type ThemePreference } from './context'

const query = '(prefers-color-scheme: dark)'

function subscribeSystem(callback: () => void) {
  const media = window.matchMedia(query)
  media.addEventListener('change', callback)
  return () => media.removeEventListener('change', callback)
}

const systemDark = () => window.matchMedia(query).matches

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPref] = useState<ThemePreference>(() =>
    readStored<ThemePreference>('theme', 'system'),
  )
  const prefersDark = useSyncExternalStore(
    subscribeSystem,
    systemDark,
    () => false,
  )
  const resolved =
    preference === 'system' ? (prefersDark ? 'dark' : 'light') : preference

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', resolved === 'dark')
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', resolved === 'dark' ? '#14181F' : '#E8EDF4')
  }, [resolved])

  const setPreference = useCallback((p: ThemePreference) => {
    writeStored('theme', p)
    setPref(p)
  }, [])

  const value = useMemo(
    () => ({ preference, resolved, setPreference }),
    [preference, resolved, setPreference],
  )
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
