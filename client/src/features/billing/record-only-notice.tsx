import { InfoIcon } from 'lucide-react'
import { useT } from '@/i18n/context'
import { cn } from '@/lib/cn'

/**
 * Billing records what the desk received; nothing here takes or moves
 * money (there is no payment gateway in this build).
 */
export function RecordOnlyNotice({ className }: { className?: string }) {
  const t = useT('billing')
  return (
    <p
      role="note"
      className={cn(
        'flex items-start gap-2 rounded-lg bg-info-soft px-3.5 py-3 text-meta text-info-text',
        className,
      )}
    >
      <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>
        <span className="font-semibold">{t('recordOnlyTitle')}</span>{' '}
        {t('recordOnlyBody')}
      </span>
    </p>
  )
}
