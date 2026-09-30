import { TriangleAlertIcon } from 'lucide-react'
import { useT } from '@/i18n/context'

/** A short summary above a form after a failed submit. */
export function FormErrorSummary({
  count,
  onFocusFirst,
}: {
  count: number
  onFocusFirst?: () => void
}) {
  const t = useT('forms')
  if (count === 0) return null
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-lg border border-danger-text/25 bg-danger-soft px-3.5 py-3 text-sm text-danger-text"
    >
      <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <p className="min-w-0 flex-1">
        {t('errorSummary', { count })}{' '}
        {onFocusFirst ? (
          <button
            type="button"
            onClick={onFocusFirst}
            className="focus-ring rounded font-semibold underline underline-offset-2"
          >
            {t('goToFirstError')}
          </button>
        ) : null}
      </p>
    </div>
  )
}
