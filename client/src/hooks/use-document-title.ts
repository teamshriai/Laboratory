import { useEffect } from 'react'
import { useT } from '@/i18n/context'

/** Names the browser tab "<title> · SHRI HEALTH" while the page is shown. */
export function useDocumentTitle(title: string | null | undefined) {
  const app = useT('common')('appTitle')
  useEffect(() => {
    if (title) document.title = `${title} · ${app}`
  }, [title, app])
}
