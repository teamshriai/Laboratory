import { DownloadIcon } from 'lucide-react'
import { istDay } from '@/domain/time'
import { useT } from '@/i18n/context'
import { downloadCsv, type CsvCell } from '@/lib/csv'
import { GuardedButton } from './guarded-button'

/**
 * Downloads what the list shows (its current filters) as CSV. Exporting is a
 * manager's right; others see why the button is disabled.
 */
export function ExportButton({
  filename,
  rows,
  disabled,
}: {
  filename: string
  /** Header row first; built only when clicked. */
  rows: () => CsvCell[][]
  disabled?: boolean
}) {
  const t = useT('common')
  return (
    <GuardedButton
      permission="data.export"
      disabled={disabled}
      onClick={() => downloadCsv(`${filename}-${istDay(Date.now())}`, rows())}
    >
      <DownloadIcon />
      {t('exportCsv')}
    </GuardedButton>
  )
}
