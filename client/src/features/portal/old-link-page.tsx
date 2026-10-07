import { LinkIcon } from 'lucide-react'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { useT } from '@/i18n/context'
import { PortalFrame } from './portal-frame'

/** Links that carried the report number (before secure tokens). */
export function Component() {
  const t = useT('portal')
  useDocumentTitle(t('oldLinkTitle'))
  return (
    <PortalFrame>
      <section className="mx-auto grid w-full max-w-xl justify-items-center gap-3 rounded-xl border border-line bg-surface px-6 py-12 text-center">
        <LinkIcon className="size-10 text-fg-subtle" aria-hidden />
        <h1 className="text-lg font-semibold text-fg">{t('oldLinkTitle')}</h1>
        <p className="text-meta text-fg-muted">{t('oldLinkBody')}</p>
      </section>
    </PortalFrame>
  )
}
